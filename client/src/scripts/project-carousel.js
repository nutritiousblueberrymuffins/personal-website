// Projects: back / forward arrows for the sideways row of project cards. The row itself is a
// CSS scroll-snap strip (site.css, "Project carousel"), so swiping, trackpads and the keyboard
// work without this script; the arrows start hidden and only appear once it runs.
//
// Each click moves one card. The arrow that can't go further is disabled (CSS fades it out),
// and both stay hidden if every card already fits.

const track = document.getElementById('project-track');
const prev = document.getElementById('project-prev');
const next = document.getElementById('project-next');

if (track && prev && next) {
  const smooth = document.documentElement.classList.contains('motion-ok');

  // The distance from one card to the next: a card's width plus the gap.
  const step = () => {
    const [first, second] = track.children;
    return second ? second.offsetLeft - first.offsetLeft : track.clientWidth;
  };

  const go = (direction) => {
    track.scrollBy({ left: direction * step(), behavior: smooth ? 'smooth' : 'auto' });
  };

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const fits = max <= 1;
    prev.hidden = fits;
    next.hidden = fits;

    const wasFocused = document.activeElement;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;

    // A disabled button drops keyboard focus; hand it to the other arrow instead.
    if (wasFocused === prev && prev.disabled && !next.disabled) next.focus();
    if (wasFocused === next && next.disabled && !prev.disabled) prev.focus();
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  // Runs on every scroll event, which is cheap: a few comparisons.
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  update();
}
