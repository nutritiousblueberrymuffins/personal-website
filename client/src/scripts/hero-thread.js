// The hero's "On this thread" strip: it drifts slowly to the left, forever. The four section
// cards are repeated so the line never runs out, and the track wraps by one set of cards at a
// time, which looks seamless.
//
// Interacting with it:
//   hover (mouse)        the drift eases to a stop, so a card is easy to read and click
//   drag (mouse/finger)  pulls the strip either way; a flick carries on, then the drift resumes
//   click / tap a card   jumps to that section, as before (a drag is never a click)
//   Tab to a card        the drift stops and the card is brought into view
// Visitors who prefer reduced motion get no drift, but can still drag it.

const marquee = document.getElementById('thread-marquee');
const track = document.getElementById('thread-nav-track');

const DRIFT_SPEED = 18; // px per second, leftwards
const DRAG_THRESHOLD = 6; // px a press must move before it counts as a drag
// A flick starts at most this fast (px per second) and slows at this rate, so even a hard one
// carries the strip only about two cards before it drifts on.
const MAX_FLICK = 1200;
const FLICK_DECAY = 2.2;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (marquee && track) {
  const originals = [...track.children];
  const setSize = originals.length;

  let pitch = 0; // distance between neighbouring cards
  let period = 0; // width of one set of cards
  let offset = 0; // the track's translateX, kept within (-period, 0]
  let velocity = 0; // px per second; negative = moving left
  let hovering = false;
  let focused = false;
  let visible = true;
  let drag = null;
  let suppressClick = false;
  let lastTime = 0;
  let frame = 0;

  // Repeats the cards enough times to cover the window plus one extra set to wrap into. The
  // copies are hidden from screen readers and skipped by Tab, but stay clickable with a mouse
  // or finger, since they look exactly like the originals.
  function fill() {
    for (const item of [...track.children].slice(setSize)) {
      item.remove();
    }
    const first = track.children[0].getBoundingClientRect();
    const second = track.children[1].getBoundingClientRect();
    pitch = second.left - first.left;
    period = pitch * setSize;
    const sets = Math.max(2, Math.ceil(marquee.clientWidth / period) + 1);
    for (let copy = 1; copy < sets; copy++) {
      originals.forEach((original, i) => {
        const item = original.cloneNode(true);
        item.style.setProperty('--col', String(copy * setSize + i + 1));
        item.setAttribute('aria-hidden', 'true');
        item.querySelector('a')?.setAttribute('tabindex', '-1');
        track.append(item);
      });
    }
    track.style.setProperty('--count', String(sets * setSize));
    originals.forEach((item, i) => item.style.setProperty('--stagger', String(i)));
    [...track.children].slice(setSize).forEach((item, i) => item.style.setProperty('--stagger', String(Math.min(setSize + i, 7))));
  }

  function wrap(value) {
    if (!period) {
      return value;
    }
    let next = value % period;
    if (next > 0) {
      next -= period;
    }
    return next;
  }

  function render() {
    track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
  }

  function drifting() {
    return !reduceMotion.matches && !hovering && !focused && !drag && visible;
  }

  function tick(time) {
    frame = 0;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (!drag) {
      // Ease the speed toward the drift (or toward a stop while hovered), so a flick slows down
      // smoothly and a hover brakes gently instead of halting.
      const target = drifting() ? -DRIFT_SPEED : 0;
      const ease = 1 - Math.exp(-dt * (Math.abs(velocity) > DRIFT_SPEED * 2 ? FLICK_DECAY : 3));
      velocity += (target - velocity) * ease;
      // While a card has keyboard focus the strip holds still where focus put it (no wrap).
      offset = focused ? offset + velocity * dt : wrap(offset + velocity * dt);
      render();
    }
    if (Math.abs(velocity) > 0.05 || drifting() || drag) {
      frame = requestAnimationFrame(tick);
    } else {
      lastTime = 0;
    }
  }

  function start() {
    if (!frame) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  // ---------- Hover ----------
  marquee.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') {
      hovering = true;
    }
  });
  marquee.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') {
      hovering = false;
      start();
    }
  });

  // ---------- Dragging and flicking ----------
  marquee.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: offset,
      moved: false,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
    start();
  });

  marquee.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(event.clientY - drag.y)) {
        return;
      }
      drag.moved = true;
      marquee.setPointerCapture(event.pointerId);
      marquee.classList.add('is-dragging');
    }
    offset = wrap(drag.start + dx);
    render();
    drag.samples.push({ x: event.clientX, t: event.timeStamp });
    if (drag.samples.length > 12) {
      drag.samples.shift();
    }
  });

  function release(event) {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }
    const finished = drag;
    drag = null;
    marquee.classList.remove('is-dragging');
    if (finished.moved) {
      // Swallow the click this release may fire; cleared right after so a later click works.
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
      // Carry on at the speed of the last 100 ms of movement (none if the pointer had stopped).
      const recent = finished.samples.filter((sample) => event.timeStamp - sample.t <= 100);
      velocity = 0;
      if (recent.length >= 2 && event.type !== 'pointercancel') {
        const a = recent[0];
        const b = recent[recent.length - 1];
        velocity = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, ((b.x - a.x) / Math.max(b.t - a.t, 1)) * 1000));
      }
    }
    start();
  }

  marquee.addEventListener('pointerup', release);
  marquee.addEventListener('pointercancel', release);
  marquee.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
  // Links would otherwise start a native "drag this link" instead of moving the strip.
  marquee.addEventListener('dragstart', (event) => event.preventDefault());

  // ---------- Keyboard ----------
  marquee.addEventListener('focusin', (event) => {
    focused = true;
    const item = event.target.closest('.thread__item');
    if (!item) {
      return;
    }
    // Slide the strip so the focused card sits fully inside the window.
    const box = item.getBoundingClientRect();
    const view = marquee.getBoundingClientRect();
    const margin = 32;
    let shift = 0;
    if (box.left < view.left + margin) {
      shift = view.left + margin - box.left;
    } else if (box.right > view.right - margin) {
      shift = view.right - margin - box.right;
    }
    if (shift) {
      // No wrap here: the focused card is an original, so the strip must move to it, even if
      // that briefly leaves the track a little right of its usual range. The next wrap, once
      // the drift resumes, is seamless.
      offset += shift;
      velocity = 0;
      render();
    }
  });
  // Browsers scroll a clipped box on their own to reveal a focused link; the transform does that
  // job here, so keep the box itself unscrolled.
  marquee.addEventListener('scroll', () => {
    marquee.scrollLeft = 0;
  });
  marquee.addEventListener('focusout', (event) => {
    if (!marquee.contains(event.relatedTarget)) {
      focused = false;
      start();
    }
  });

  // ---------- Only run while it can be seen ----------
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((records) => {
      visible = records[0].isIntersecting;
      if (visible) {
        start();
      }
    }).observe(marquee);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      start();
    }
  });
  reduceMotion.addEventListener?.('change', start);

  // ---------- Layout ----------
  let resizeFrame = 0;
  const relayout = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const fraction = period ? offset / period : 0;
      fill();
      offset = wrap(fraction * period);
      render();
    });
  };
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);

  fill();
  render();
  start();
}
