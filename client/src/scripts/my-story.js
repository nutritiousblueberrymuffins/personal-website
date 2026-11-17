// "My story": the tab in the middle of the header opens a short journey in 3D. The camera pulls
// back and tilts, so you're looking down at the page lying like a sheet on the site's dotted
// background; a panel pops up out of the page from the tab; and a timeline plays forward from
// where I started to today, a stop at a time, ending on a quote. The words live in
// <template id="my-story"> in index.html, so they can be edited as plain HTML; pages without it
// get no tab. The look lives in site.css ("My story").
//
// Close it with the × button, Escape, or a press anywhere around the panel: in one quick move the
// panel sinks straight back into the page while the camera returns. The timeline can be paused,
// stepped with the arrows (the buttons or the arrow keys), or jumped by clicking a stop. With
// reduced motion there's no camera move or pop: the panel simply appears over the frosted page,
// and the line steps from stop to stop instead of running.
//
// Keeping it smooth: everything that moves is a transform or opacity animation, which the browser
// runs off the main thread. The costly bits of main-thread work (putting the rest of the page to
// sleep and waking it, about 20 ms each) wait until a frame has gone out, so they never hold up
// the start of a move or land in the middle of one.
//
// Until someone opens it, the tab gives a little tug every few seconds (motion.css, "The My
// story tab tugs"). Opening it once stops that for good in this browser.
import { createHeaderDrawer } from './header-drawer.js';

const template = document.getElementById('my-story');
const page = document.querySelector('.page');
const FOUND_KEY = 'my-story-opened';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Where the camera ends up: how far it pulls back (px), how much lower the page sits (a share of
// the window's height), how steeply it looks down, and the page's slight turn.
const CAMERA = { perspective: 1600, back: 620, drop: 0.16, tilt: 54, turn: -7 };
const CAMERA_MS = 950;
const CAMERA_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// The panel starts rising once the camera is mostly back, and takes this long to pop up. It
// starts this small, lying in the page where the tab is.
const POP_DELAY = 550;
const POP_MS = 950;
const POP_FROM = 0.22;
// Closing is quicker than opening and happens in one go: the panel sinks straight back into the
// page (speeding up as it goes, and fading out), and a moment after it starts, the camera glides
// back to the normal view, settling gently.
const SINK_MS = 260;
const SINK_EASE = 'cubic-bezier(0.4, 0, 1, 1)';
const RETURN_DELAY = 80;
const RETURN_MS = 520;
const RETURN_EASE = 'cubic-bezier(0.25, 0.1, 0.15, 1)';
// A caption stays up for a moment plus a little per character, so longer ones stay longer.
const dwellFor = (text) => Math.max(3800, 1600 + text.length * 42);

const CLOSE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const PLAY_ICONS = {
  pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor"/></svg>',
  play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.8v8.4L10 6z" fill="currentColor"/></svg>',
  replay: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.6 6.4a3.5 3.5 0 1 0 1-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2.4 1.4v2.4h2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const PLAY_LABELS = { pause: 'Pause', play: 'Play', replay: 'Replay' };

// The camera at `t` of the way there (0 is where it normally is). Every frame uses the same list of
// functions, so the browser can blend them smoothly.
function cameraAt(t, viewHeight) {
  const { perspective, back, drop, tilt, turn } = CAMERA;
  return `perspective(${perspective}px) translate3d(0px, ${(drop * viewHeight * t).toFixed(1)}px, ${(-back * t).toFixed(1)}px) `
    + `rotateX(${(tilt * t).toFixed(2)}deg) rotateZ(${(turn * t).toFixed(2)}deg)`;
}

// The panel standing upright, facing you, in the same list of functions as its pop.
const UPRIGHT = `translate(0px, 0px) perspective(${CAMERA.perspective}px) translate3d(0px, 0px, 0px) `
  + 'rotateX(0deg) rotateZ(0deg) translate3d(0px, 0px, 0px) scale(1)';

// Runs after the next frame has gone out.
function afterNextFrame(callback) {
  requestAnimationFrame(() => setTimeout(callback, 0));
}

// The stops and the closing quote, from the template.
function readStory() {
  const stops = [...template.content.querySelectorAll('ol > li')].map((item) => {
    const [heading, caption] = item.querySelectorAll('p');
    const title = heading?.textContent.trim() ?? '';
    return { label: item.dataset.label || title, heading: title, caption };
  });
  return { stops, quote: template.content.querySelector('figure') };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createJourney({ stops, quote }) {
  const root = element('div', 'journey');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'journey-title');
  root.innerHTML = `
    <div class="journey__panel">
      <div class="journey__card" tabindex="-1">
        <div class="journey__head">
          <div>
            <p class="label-section" id="journey-title">My story</p>
            <p class="journey__sub">From where I started to today</p>
          </div>
          <button class="journey__close" type="button" aria-label="Close my story">${CLOSE_ICON}</button>
        </div>
        <div class="journey__track" style="--stops: ${stops.length}">
          <span class="journey__line" aria-hidden="true"><span class="journey__fill"></span></span>
          <ol class="journey__stops"></ol>
        </div>
        <div class="journey__stage"></div>
        <p class="journey__live" aria-live="polite"></p>
        <div class="journey__foot">
          <button class="journey__play" type="button"></button>
          <div class="journey__step">
            <button class="journey__arrow" type="button" data-step="-1" aria-label="Previous stop">‹</button>
            <span class="journey__count" aria-hidden="true"></span>
            <button class="journey__arrow" type="button" data-step="1" aria-label="Next stop">›</button>
          </div>
        </div>
      </div>
    </div>`;

  const panel = root.querySelector('.journey__panel');
  const card = root.querySelector('.journey__card');
  const fill = root.querySelector('.journey__fill');
  const list = root.querySelector('.journey__stops');
  const stage = root.querySelector('.journey__stage');
  const live = root.querySelector('.journey__live');
  const playButton = root.querySelector('.journey__play');
  const count = root.querySelector('.journey__count');
  const [prev, next] = root.querySelectorAll('.journey__arrow');
  const last = stops.length - 1;

  // A dot and a short label per stop on the track, and a caption per stop on the stage. The
  // captions share one grid cell, so the panel keeps one size as they change.
  const points = [];
  const captions = [];
  const spoken = [];
  stops.forEach((stop, i) => {
    const point = element('button', 'journey__stop');
    point.type = 'button';
    point.dataset.index = String(i);
    point.setAttribute('aria-label', `${stop.heading} (stop ${i + 1} of ${stops.length})`);
    point.append(element('span', 'journey__dot'), element('span', 'journey__label', stop.label));
    const item = document.createElement('li');
    item.append(point);
    list.append(item);
    points.push(point);

    const caption = element('div', 'journey__caption');
    const text = element('p', 'journey__text');
    if (stop.caption) {
      text.append(...[...stop.caption.childNodes].map((node) => node.cloneNode(true)));
    }
    caption.append(element('p', 'journey__when', stop.heading), text);
    let words = `${stop.heading}. ${text.textContent.trim()}`;
    if (i === last && quote) {
      const figure = quote.cloneNode(true);
      figure.className = 'journey__quote';
      caption.append(figure);
      words += ` ${figure.textContent.replace(/\s+/g, ' ').trim()}`;
    }
    stage.append(caption);
    captions.push(caption);
    spoken.push(words);
  });

  // Moved with the page while it's open, so the white sheet stands out on the white, dotted
  // background: a thin edge around it, with a soft shadow just outside it.
  const frame = element('div', 'journey-frame');
  frame.setAttribute('aria-hidden', 'true');
  document.body.append(frame, root);

  // ---------- Playing the timeline ----------
  // While a stop is up, the navy line runs on toward the next one; when it gets there, that stop
  // comes up. The line's run is the timer, so pausing it pauses everything.

  let index = 0;
  let playing = false;
  let ended = false;
  let run = null;
  let state = 'closed'; // opening, open, closing

  function setMode(mode) {
    playButton.innerHTML = `${PLAY_ICONS[mode]}<span>${PLAY_LABELS[mode]}</span>`;
  }

  function setPlaying(on) {
    playing = on;
    setMode(ended ? 'replay' : playing ? 'pause' : 'play');
  }

  function runLine(autoplay) {
    run?.cancel();
    run = null;
    const from = last ? index / last : 1;
    fill.style.width = `${(from * 100).toFixed(3)}%`;
    ended = index >= last;
    if (ended) {
      setPlaying(false);
      return;
    }
    run = fill.animate(
      [{ width: `${(from * 100).toFixed(3)}%` }, { width: `${(((index + 1) / last) * 100).toFixed(3)}%` }],
      {
        duration: dwellFor(captions[index].textContent),
        // With reduced motion the line doesn't run: it waits, then steps to the next stop.
        easing: reduceMotion.matches ? 'steps(1, end)' : 'linear',
        fill: 'forwards',
      },
    );
    run.finished.then(() => show(index + 1)).catch(() => {});
    // While the panel is still rising it waits; it starts once the panel is up.
    if (!autoplay || state !== 'open') {
      run.pause();
    }
    setPlaying(autoplay);
  }

  function show(i, autoplay = playing) {
    index = Math.max(0, Math.min(last, i));
    points.forEach((point, k) => {
      point.classList.toggle('is-current', k === index);
      point.classList.toggle('is-reached', k < index);
      if (k === index) {
        point.setAttribute('aria-current', 'step');
      } else {
        point.removeAttribute('aria-current');
      }
    });
    captions.forEach((caption, k) => {
      caption.classList.toggle('is-current', k === index);
      caption.classList.toggle('is-before', k < index);
      caption.setAttribute('aria-hidden', String(k !== index));
    });
    count.textContent = `${index + 1} / ${stops.length}`;
    prev.disabled = index === 0;
    next.disabled = index === last;
    live.textContent = spoken[index];
    runLine(autoplay);
  }

  playButton.addEventListener('click', () => {
    if (ended) {
      show(0, true);
    } else if (playing) {
      run?.pause();
      setPlaying(false);
    } else {
      if (state === 'open') {
        run?.play();
      }
      setPlaying(true);
    }
  });
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  list.addEventListener('click', (event) => {
    const point = event.target.closest('.journey__stop');
    if (point) {
      show(Number(point.dataset.index));
    }
  });

  // ---------- Opening and closing ----------

  let flat = false;
  let opener = null;
  let camera = [];
  let pop = null;
  let popTimer = 0;
  // The panel lying in the page at the tab, where it rises from and sinks back to.
  let restPose = UPRIGHT;

  // What the page needs as a sheet is set straight on it as plain properties: CSS custom
  // properties would be inherited by every element on the page, and changing one would restyle
  // all of them (about 20 ms each time).
  const SHEET_PROPERTIES = ['clip-path', 'transform-origin', 'background-image', 'background-position'];

  // The page as a sheet: cut to the part that was on screen, and turned about its middle.
  function frameSheet() {
    const rect = page.getBoundingClientRect();
    const top = -rect.top;
    const bottom = Math.max(0, rect.height - top - window.innerHeight);
    page.style.clipPath = `inset(${top.toFixed(1)}px 0px ${bottom.toFixed(1)}px 0px round 22px)`;
    page.style.transformOrigin = `${(document.documentElement.clientWidth / 2 - rect.left).toFixed(1)}px ${(top + window.innerHeight / 2).toFixed(1)}px`;
  }

  // The sheet carries its own copy of the dot grid. Lined up with the drifting grid around it
  // (which holds still while the journey is open) and just as strong, the swap between the two
  // can't be seen when the page lies back or comes back up.
  function matchDots() {
    const dots = getComputedStyle(document.body, '::before');
    const cell = parseFloat(dots.backgroundSize) || 28;
    const drift = dots.transform === 'none' ? 0 : new DOMMatrixReadOnly(dots.transform).m41;
    const rect = page.getBoundingClientRect();
    const phase = (n) => (((n % cell) + cell) % cell).toFixed(2);
    page.style.backgroundPosition = `${phase((parseFloat(dots.left) || 0) + drift - rect.left)}px ${phase(-rect.top)}px`;
    page.style.backgroundImage = `radial-gradient(circle at 0.875rem 0.875rem, rgb(157 174 196 / ${dots.opacity}) 0.0781rem, transparent 0.1094rem)`;
  }

  // While the journey is open the rest of the page sleeps: no focus, no clicks, hidden from screen
  // readers. Switching that on or off restyles the whole page (about 20 ms), so it waits until a
  // frame has gone out. Asleep, each element's own setting is kept to put back on waking.
  let sleepers = [];
  function sleep() {
    if (!sleepers.length) {
      sleepers = [...document.body.children]
        .filter((node) => node !== root && node !== frame)
        .map((node) => [node, node.inert]);
    }
    afterNextFrame(() => {
      if (state !== 'closed') {
        for (const [node] of sleepers) {
          node.inert = true;
        }
      }
    });
  }
  function wake() {
    afterNextFrame(() => {
      // Opened again in the meantime: it stays asleep.
      if (state !== 'closed') {
        return;
      }
      for (const [node, wasInert] of sleepers) {
        node.inert = wasInert;
      }
      sleepers = [];
      opener?.focus({ preventScroll: true });
    });
  }

  // Lifts the panel out of the page: it starts small, lying in the page where the tab is, and
  // rises to face you, overshooting toward you a little before it settles.
  function popUp(tab, viewHeight) {
    const viewWidth = document.documentElement.clientWidth;
    const box = panel.getBoundingClientRect();
    const dx = box.left + box.width / 2 - viewWidth / 2;
    const dy = box.top + box.height / 2 - viewHeight / 2;
    const from = tab.getBoundingClientRect();
    const tx = from.left + from.width / 2 - viewWidth / 2;
    const ty = from.top + from.height / 2 - viewHeight / 2;
    const p = CAMERA.perspective;
    restPose = `translate(${-dx}px, ${-dy}px) ${cameraAt(1, viewHeight)} translate3d(${tx}px, ${ty}px, 0px) scale(${POP_FROM})`;
    return panel.animate(
      [
        { transform: restPose, opacity: 0, easing: 'cubic-bezier(0.3, 0.6, 0.3, 1)' },
        { offset: 0.14, opacity: 1 },
        {
          offset: 0.7,
          transform: `translate(0px, 0px) perspective(${p}px) translate3d(0px, 0px, 60px) rotateX(-7deg) rotateZ(0.6deg) translate3d(0px, 0px, 0px) scale(1)`,
          easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
        },
        { transform: UPRIGHT, opacity: 1 },
      ],
      { duration: POP_MS, fill: 'both' },
    );
  }

  function open(tab) {
    if (state !== 'closed') {
      return;
    }
    state = 'opening';
    opener = tab;
    flat = reduceMotion.matches || !page;
    const viewHeight = window.innerHeight;
    // Stops any scroll still gliding (a nav link's smooth scroll, say), so the sheet is cut
    // from where the page actually comes to rest: a jump to where it is now cancels the glide.
    // (The page scrolls smoothly by default, so that's switched off for the jump.)
    const html = document.documentElement;
    const scrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(window.scrollX, window.scrollY);
    html.style.scrollBehavior = scrollBehavior;

    sleep();
    if (page) {
      matchDots();
    }
    if (!flat) {
      frameSheet();
    }
    html.classList.add('journey-open');
    root.classList.toggle('journey--flat', flat);
    root.hidden = false;
    card.style.removeProperty('transform');
    cardBox = null;
    if (flat) {
      state = 'open';
    }
    show(0, true);
    card.focus({ preventScroll: true });
    if (flat) {
      return;
    }

    const timing = { duration: CAMERA_MS, easing: CAMERA_EASE, fill: 'both' };
    camera = [
      page.animate([{ transform: cameraAt(0, viewHeight) }, { transform: cameraAt(1, viewHeight) }], timing),
      frame.animate(
        [
          { transform: cameraAt(0, viewHeight), opacity: 0 },
          { transform: cameraAt(1, viewHeight), opacity: 1 },
        ],
        timing,
      ),
    ];
    // Hidden at the tab until it starts to rise.
    pop = popUp(tab, viewHeight);
    pop.pause();
    popTimer = setTimeout(() => pop?.play(), POP_DELAY);
    Promise.all([pop.finished, ...camera.map((move) => move.finished)])
      .then(() => {
        if (state === 'opening') {
          state = 'open';
          if (playing) {
            run?.play();
          }
        }
      })
      .catch(() => {});
  }

  function close() {
    if (state !== 'opening' && state !== 'open') {
      return;
    }
    const settled = state === 'open';
    state = 'closing';
    run?.pause();
    setPlaying(false);
    clearTimeout(popTimer);
    root.classList.add('is-closing');
    if (flat) {
      finish();
      return;
    }

    // The panel sinks straight back into the page at the tab, fading as it goes. It starts from
    // wherever it is, so closing while it's still rising doesn't jump.
    const panelNow = getComputedStyle(panel);
    const sink = panel.animate(
      [
        { transform: settled ? UPRIGHT : panelNow.transform, opacity: panelNow.opacity },
        { offset: 0.2, opacity: panelNow.opacity },
        { transform: restPose, opacity: 0 },
      ],
      { duration: SINK_MS, easing: SINK_EASE, fill: 'forwards' },
    );
    pop?.cancel();
    pop = sink;
    sink.finished.then(() => { root.hidden = true; }).catch(() => {});

    // Meanwhile the camera glides back to the normal view, from wherever it has got to.
    camera = camera.map((move) => {
      const target = move.effect.target;
      const [start, end] = move.effect.getKeyframes();
      const now = getComputedStyle(target);
      const from = { transform: settled ? end.transform : now.transform };
      const to = { transform: start.transform };
      if ('opacity' in start) {
        from.opacity = settled ? end.opacity : now.opacity;
        to.opacity = start.opacity;
      }
      const back = target.animate([from, to], { duration: RETURN_MS, delay: RETURN_DELAY, easing: RETURN_EASE, fill: 'both' });
      move.cancel();
      return back;
    });
    Promise.all(camera.map((move) => move.finished)).then(finish).catch(() => {});
  }

  function finish() {
    if (state === 'closed') {
      return;
    }
    run?.cancel();
    run = null;
    pop?.cancel();
    pop = null;
    for (const move of camera) {
      move.cancel();
    }
    camera = [];
    root.hidden = true;
    root.classList.remove('is-closing', 'journey--flat');
    document.documentElement.classList.remove('journey-open');
    for (const property of SHEET_PROPERTIES) {
      page?.style.removeProperty(property);
    }
    state = 'closed';
    wake();
  }

  root.querySelector('.journey__close').addEventListener('click', close);
  // Pressing anywhere around the panel closes it: with a mouse as soon as the button goes down,
  // by touch or pen on the tap.
  root.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 0 && !card.contains(event.target)) {
      close();
    }
  });
  root.addEventListener('click', (event) => {
    if (!card.contains(event.target)) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (state !== 'opening' && state !== 'open') {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  // If the window changes size, or the page scrolls anyway, the sheet is cut again from what's on
  // screen.
  const reframe = () => {
    cardBox = null;
    if (!flat && (state === 'opening' || state === 'open')) {
      frameSheet();
    }
  };
  window.addEventListener('resize', reframe);
  window.addEventListener('scroll', reframe, { passive: true });

  // The panel leans a little toward the mouse: at most once a frame, measuring it only once, and
  // setting its transform directly (no custom properties to restyle the panel's contents).
  let cardBox = null;
  let pointer = null;
  let tiltFrame = 0;
  function tilt() {
    tiltFrame = 0;
    if (!pointer || state !== 'open') {
      return;
    }
    cardBox ??= card.getBoundingClientRect();
    const lean = (at, start, size) => Math.max(-1, Math.min(1, (at - start - size / 2) / (size / 2)));
    const x = lean(pointer.x, cardBox.left, cardBox.width) * 3;
    const y = lean(pointer.y, cardBox.top, cardBox.height) * 3;
    card.style.transform = `perspective(1000px) rotateX(${(-y).toFixed(2)}deg) rotateY(${x.toFixed(2)}deg)`;
  }
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || flat || state !== 'open') {
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    tiltFrame ||= requestAnimationFrame(tilt);
  });
  root.addEventListener('pointerleave', () => {
    pointer = null;
    card.style.removeProperty('transform');
  });

  return { open };
}

if (template instanceof HTMLTemplateElement) {
  const story = readStory();
  if (story.stops.length) {
    const journey = createJourney(story);
    let tab = null;
    const markFound = () => tab?.element.classList.add('is-found');
    tab = createHeaderDrawer({
      id: 'story',
      tab: 'My story',
      heading: 'My story',
      place: 'center',
      launch: (handle) => {
        markFound();
        try {
          localStorage.setItem(FOUND_KEY, '1');
        } catch {}
        journey.open(handle);
      },
    });
    try {
      if (localStorage.getItem(FOUND_KEY)) markFound();
    } catch {}
  }
}
