// Animation showcase in the hero: a small carousel of CSS animations stepped through with the
// previous/next buttons. Showing a slide re-runs its animations, because they start when the
// slide is displayed again.
const panel = document.getElementById('showcase');

if (panel) {
  const slides = [...panel.querySelectorAll('.showcase-slide')];
  const prev = document.getElementById('showcase-prev');
  const next = document.getElementById('showcase-next');
  let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((slide, k) => {
      const active = k === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
  }

  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));

  show(current);
}
