// Portrait carousel in the hero: crossfades between slides, advances on a timer, and lets the
// pagination dots pick a slide. It pauses while hovered or focused, stops when the tab is hidden,
// and never auto-advances for people who prefer reduced motion.
const region = document.querySelector('.portrait-slides');

if (region) {
  const slides = [...region.querySelectorAll('.portrait-slide')];
  const dots = [...document.querySelectorAll('.portrait-pagination [role="tab"]')];
  const INTERVAL_MS = 6000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
  let timer = null;

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((slide, k) => {
      const active = k === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, k) => {
      const active = k === current;
      dot.setAttribute('aria-selected', String(active));
      dot.tabIndex = active ? 0 : -1;
    });
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (reduceMotion.matches || slides.length < 2) {
      return;
    }
    timer = setInterval(() => show(current + 1), INTERVAL_MS);
  }

  dots.forEach((dot, k) => {
    dot.addEventListener('click', () => {
      show(k);
      start();
    });
    dot.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return;
      }
      event.preventDefault();
      show(event.key === 'ArrowRight' ? current + 1 : current - 1);
      dots[current].focus();
      start();
    });
  });

  region.addEventListener('mouseenter', stop);
  region.addEventListener('mouseleave', start);
  region.addEventListener('focusin', stop);
  region.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener('change', start);

  show(current);
  start();
}
