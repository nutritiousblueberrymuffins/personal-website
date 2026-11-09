// Section-to-section flow: the page reads as chapters rather than one long scroll.
//
//   - A section guide on the right edge (wide screens): a thin vertical thread with a dot per
//     section. The current section's dot grows and its name slides out briefly when you arrive;
//     hovering the guide shows every name; each dot jumps to its section.
//   - The section you arrive at gets .is-current, which motion.css uses to draw a navy line
//     under its label (every time you arrive, scrolling down or back up).
//   - motion.css also eases each section in as it scrolls into view and dims it as it leaves,
//     and settles the page at a section's start when you stop scrolling near it.
// The guide works for everyone; the motion only runs without prefers-reduced-motion.

const SECTIONS = [
  ['top', 'Intro'],
  ['about', 'About'],
  ['projects', 'Projects'],
  ['timeline', 'Timeline'],
  ['contact', 'Contact'],
];
const NAME_SHOWN_MS = 1600;

const sections = SECTIONS.map(([id, name]) => ({ id, name, element: document.getElementById(id) })).filter(
  (section) => section.element,
);

if (sections.length >= 2) {
  // ---------- The guide ----------
  const guide = document.createElement('nav');
  guide.className = 'section-guide';
  guide.setAttribute('aria-label', 'Sections');
  const list = document.createElement('ol');
  for (const section of sections) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.dataset.trackGuide = section.id;
    const dot = document.createElement('span');
    dot.className = 'section-guide__dot';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'section-guide__name';
    label.textContent = section.name;
    link.append(dot, label);
    item.append(link);
    list.append(item);
    section.link = link;
  }
  guide.append(list);
  document.body.append(guide);

  // The first label in each section is its chapter marker: it gets a line drawn under it.
  for (const section of sections) {
    section.element.querySelector('.label-section')?.classList.add('chapter-label');
  }

  // ---------- Which section is current ----------
  // The current section is the one crossing the middle of the window.
  let current = null;
  let nameTimer = 0;

  function setCurrent(section) {
    if (section === current) {
      return;
    }
    current?.element.classList.remove('is-current');
    current?.link.removeAttribute('aria-current');
    current = section;
    // Restart the chapter-line animation, even when returning to a section seen before.
    section.element.classList.remove('is-current');
    void section.element.offsetWidth;
    section.element.classList.add('is-current');
    section.link.setAttribute('aria-current', 'true');
    guide.style.setProperty('--progress', String(sections.indexOf(section) / (sections.length - 1)));
    // Show the arriving section's name for a moment.
    guide.classList.add('is-announcing');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => guide.classList.remove('is-announcing'), NAME_SHOWN_MS);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) {
            setCurrent(sections.find((section) => section.element === record.target));
          }
        }
      },
      // A one-pixel line across the middle of the window.
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section.element));
  }
  // Near the very top, the hero is current even before it crosses the middle.
  const atTop = () => {
    if (window.scrollY < 40) {
      setCurrent(sections[0]);
    }
  };
  window.addEventListener('scroll', atTop, { passive: true });
  atTop();
}
