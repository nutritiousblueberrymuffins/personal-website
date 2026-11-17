// Hero: the photo frame as a slideshow. One photo at a time, cross-fading; the arrows, a click
// or tap on the photo, a sideways swipe and the left / right arrow keys (while an arrow has
// focus) move through them, looping at either end. A "2 / 6" counter sits in the corner and
// screen readers hear each photo's description. The look lives in site.css ("Photo slideshow").
//
// Without this script the frame simply shows the first photo.

const frame = document.getElementById('photo');
const box = document.getElementById('photo-slides');
const prev = document.getElementById('photo-prev');
const next = document.getElementById('photo-next');
const count = document.getElementById('photo-count');
const status = document.getElementById('photo-status');
const SWIPE_PX = 40;

if (frame && box && prev && next && box.children.length > 1) {
  const slides = [...box.children];
  // The photo's own description (not the blurred fill copy, which has alt="").
  const describe = (slide) => slide.querySelector('img:not(.photo__fill)')?.alt ?? '';
  let current = 0;

  function show(index, { announce = true } = {}) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === current;
      slide.classList.toggle('is-current', on);
      slide.setAttribute('aria-hidden', String(!on));
      // Start loading the next photo early so it's ready when asked for.
      if (i === (current + 1) % slides.length) {
        slide.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
      }
    });
    if (count) {
      count.textContent = `${current + 1} / ${slides.length}`;
    }
    if (announce && status) {
      status.textContent = `Photo ${current + 1} of ${slides.length}: ${describe(slides[current])}`;
    }
  }

  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));

  frame.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  // Click or tap the photo for the next one; swipe sideways to go either way. A swipe also
  // fires a click when the finger lifts, so the click is skipped right after one.
  let start = null;
  let swiped = false;
  box.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
    swiped = false;
  });
  box.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      show(current + (dx < 0 ? 1 : -1));
    }
  });
  box.addEventListener('pointercancel', () => { start = null; });
  box.addEventListener('click', () => {
    if (!swiped) show(current + 1);
    swiped = false;
  });

  frame.classList.add('is-sliding');
  const controls = frame.querySelector('.photo__controls');
  if (controls) controls.hidden = false;
  show(0, { announce: false });
}
