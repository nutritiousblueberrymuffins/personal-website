// Motion: scroll reveals, threads that draw themselves, click ripples, cards that tilt and glow
// toward the cursor, buttons that lean toward the pointer, and a scroll progress bar. The look
// lives in src/styles/motion.css.
//
// It only runs when <html> has .motion-ok, which a tiny script in each page's <head> adds when
// the visitor has not asked for reduced motion. Cursor effects only run with a mouse or
// trackpad (a "fine" pointer that can hover); ripples and reveals also work on touch screens.

const root = document.documentElement;
const motionOk = root.classList.contains('motion-ok');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Keep in step with the reveal list in motion.css. Elements that share a parent rise in one
// after another, `stagger` ms apart.
const REVEAL = [
  ['.intro > *', 90],
  ['.photo', 0],
  ['.section-heading > *', 80],
  ['.about__text > *', 90],
  ['.glance', 0],
  ['.whiteboard', 0],
  ['.project-grid > *', 110],
  ['.timeline-controls', 0],
  ['.contact-grid > li', 90],
  ['.site-footer .container', 0],
  ['.not-found > *', 90],
];

const RIPPLE_TARGETS = '.button, .arrow-button, .chip, .project-card, .contact-card, .thread .event-card';
const TILT_TARGETS = '.project-card, .contact-card, .photo';
const GLOW_TARGETS = '.project-card, .contact-card, .glance, .timeline-detail, .thread .event-card';
const MAGNET_TARGETS = '.button, .arrow-button';
const MAX_TILT_DEG = 5;
const MAX_PULL_PX = 5;

// ---------- Scroll reveals ----------

function setUpReveals() {
  const targets = [];
  for (const [selector, stagger] of REVEAL) {
    const siblings = new Map();
    for (const element of document.querySelectorAll(selector)) {
      const index = siblings.get(element.parentElement) ?? 0;
      siblings.set(element.parentElement, index + 1);
      element.style.setProperty('--reveal-delay', `${index * stagger}ms`);
      targets.push(element);
    }
  }
  // Threads draw their line and pop their entries when they come into view.
  targets.push(...document.querySelectorAll('.thread'));

  const reveal = (element) => element.classList.add('is-revealed');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(reveal);
    return;
  }
  const observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting) {
          reveal(record.target);
          observer.unobserve(record.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );
  targets.forEach((element) => observer.observe(element));
}

// ---------- Click ripples ----------

function ripple(event) {
  const target = event.target instanceof Element ? event.target.closest(RIPPLE_TARGETS) : null;
  if (!target || event.button > 0) {
    return;
  }
  const box = target.getBoundingClientRect();
  const size = Math.max(box.width, box.height) * 2.2;
  const wave = document.createElement('span');
  wave.className = 'ripple';
  wave.setAttribute('aria-hidden', 'true');
  wave.style.setProperty('--size', `${size}px`);
  wave.style.setProperty('--x', `${event.clientX - box.left}px`);
  wave.style.setProperty('--y', `${event.clientY - box.top}px`);
  target.append(wave);
  wave.addEventListener('animationend', () => wave.remove(), { once: true });
}

// ---------- Cursor-following tilt, glow and magnetic buttons ----------

let pending = null;
let frame = 0;

function applyPointer() {
  frame = 0;
  const { event } = pending;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }
  for (const card of [target.closest(GLOW_TARGETS)].filter(Boolean)) {
    const box = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - box.left}px`);
    card.style.setProperty('--my', `${event.clientY - box.top}px`);
  }
  const tilt = target.closest(TILT_TARGETS);
  if (tilt) {
    const box = tilt.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    tilt.classList.add('is-tilting');
    tilt.style.setProperty('--rx', `${(-py * MAX_TILT_DEG).toFixed(2)}deg`);
    tilt.style.setProperty('--ry', `${(px * MAX_TILT_DEG).toFixed(2)}deg`);
  }
  const magnet = target.closest(MAGNET_TARGETS);
  if (magnet && !magnet.disabled) {
    const box = magnet.getBoundingClientRect();
    const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
    const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
    magnet.style.setProperty('--tx', `${(dx * MAX_PULL_PX).toFixed(1)}px`);
    magnet.style.setProperty('--ty', `${(dy * MAX_PULL_PX).toFixed(1)}px`);
  }
}

function onPointerMove(event) {
  if (event.pointerType !== 'mouse') {
    return;
  }
  pending = { event };
  if (!frame) {
    frame = requestAnimationFrame(applyPointer);
  }
}

// When the pointer leaves a tilted card or a magnetic button, it settles back.
function onPointerOut(event) {
  const from = event.target instanceof Element ? event.target : null;
  const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
  for (const selector of [TILT_TARGETS, MAGNET_TARGETS]) {
    const left = from?.closest(selector);
    if (left && left !== to?.closest(selector)) {
      left.classList.remove('is-tilting');
      for (const name of ['--rx', '--ry', '--tx', '--ty']) {
        left.style.removeProperty(name);
      }
    }
  }
}

// ---------- Scroll progress ----------

function setUpProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  let ticking = false;
  const update = () => {
    ticking = false;
    const scrollable = root.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0})`;
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

if (motionOk) {
  setUpReveals();
  setUpProgress();
  document.addEventListener('pointerdown', ripple, { passive: true });
  if (finePointer) {
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
  }
}
