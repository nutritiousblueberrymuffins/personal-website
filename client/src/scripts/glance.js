// About: the "At a glance" card, one fact at a time. Back / forward arrows, a dot per fact and
// the left / right arrow keys (while focus is in the card) step through Background, Focus,
// Stack and Next, looping at either end. The look lives in site.css ("Stepping").
//
// Without this script the card is a plain list of all four facts, so nothing is lost.

const card = document.getElementById('glance');
const list = document.getElementById('glance-facts');
const controls = card?.querySelector('.glance__controls');
const dotsBox = card?.querySelector('.glance__dots');
const prev = document.getElementById('glance-prev');
const next = document.getElementById('glance-next');
const status = document.getElementById('glance-status');

if (card && list && controls && dotsBox && prev && next) {
  const facts = [...list.children];
  const label = (fact) => fact.querySelector('dt').textContent.trim();
  const value = (fact) => fact.querySelector('dd').textContent.trim();
  let current = 0;

  // One dot per fact, named after it ("Background", "Focus", ...).
  const dots = facts.map((fact, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'glance__dot';
    dot.setAttribute('aria-label', label(fact));
    dot.setAttribute('aria-controls', 'glance-facts');
    dot.addEventListener('click', () => show(index, Math.sign(index - current)));
    dotsBox.append(dot);
    return dot;
  });

  // direction: 1 slides the new fact in from the right, -1 from the left. The arrows pass
  // their own way (so looping from Next back to Background still slides forward); the dots
  // pass whichever way the chosen fact lies.
  function show(index, direction = 1, { announce = true } = {}) {
    const target = (index + facts.length) % facts.length;
    if (target === current && facts[current].classList.contains('is-current')) {
      return;
    }

    list.style.setProperty('--dir', String(direction < 0 ? -1 : 1));

    facts.forEach((fact, i) => {
      fact.classList.toggle('is-leaving', i === current && i !== target);
      fact.classList.toggle('is-current', i === target);
      // Hidden facts are out of the reading order and can't be focused.
      fact.inert = i !== target;
      fact.setAttribute('aria-hidden', String(i !== target));
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === target)));

    current = target;
    if (announce && status) {
      status.textContent = `${label(facts[target])}: ${value(facts[target])} (${target + 1} of ${facts.length})`;
    }
  }

  prev.addEventListener('click', () => show(current - 1, -1));
  next.addEventListener('click', () => show(current + 1, 1));

  card.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      show(current + direction, direction);
    }
  });

  card.classList.add('is-stepping');
  controls.hidden = false;
  show(0, 1, { announce: false });
}
