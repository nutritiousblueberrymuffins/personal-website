// Home page timeline: renders src/data/timeline.json on the thread, oldest first, with cards
// alternating above and below the line and each date on the free side of it. The data is
// bundled at build time (GitHub Pages has no server), so editing the JSON and pushing updates
// the page. Entries marked draft show in local development only, which keeps samples and
// unfinished items off the live site. The type filters update ?type= in the address so a
// filtered view can be shared.
import data from '../data/timeline.json';

const TYPES = [
  ['work', 'Work'],
  ['education', 'Education'],
  ['certification', 'Certification'],
  ['project', 'Project'],
  ['milestone', 'Milestone'],
];
const LABELS = Object.fromEntries(TYPES);
// Types where a missing end date means "still going" rather than "a single moment".
const ONGOING_TYPES = new Set(['work', 'education']);
const QUERY_PARAM = 'type';
const SHARE_NOTE = '  ·  the filters update the address, so a view can be shared.';

const thread = document.getElementById('timeline-thread');
const filters = document.getElementById('timeline-filters');
const status = document.getElementById('timeline-status');

const entries = data.entries
  .filter((entry) => import.meta.env.DEV || !entry.draft)
  .sort(oldestFirst);

// Dates are ISO strings (YYYY, YYYY-MM or YYYY-MM-DD), so string order is date order.
function oldestFirst(a, b) {
  return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
}

function parts(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day, date: new Date(year, (month || 1) - 1, day || 1) };
}

// On the card: "2018 – 2022" for a span, "Oct 2026" for a dated moment, "2024" otherwise.
function cardDate(entry) {
  const start = parts(entry.start);
  if (entry.end) {
    const end = parts(entry.end);
    return start.year === end.year ? String(start.year) : `${start.year} – ${end.year}`;
  }
  if (ONGOING_TYPES.has(entry.type)) {
    return `${start.year} – present`;
  }
  if (start.day) {
    return start.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return String(start.year);
}

// On the axis: when it started, "Oct 9, 2026" for a full date, otherwise the year.
function axisDate(entry) {
  const start = parts(entry.start);
  if (start.day) {
    return start.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(start.year);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function entryElement(entry, index) {
  const item = element('li', `thread__item thread__item--${index % 2 === 0 ? 'above' : 'below'}`);
  item.style.setProperty('--col', String(index + 1));

  // The axis date repeats when the entry started, so screen readers skip it and read the card.
  const axis = element('time', 'thread__date', axisDate(entry));
  axis.dateTime = entry.start;
  axis.setAttribute('aria-hidden', 'true');

  const card = element('article', 'event-card');
  card.append(
    element('p', 'event-card__date', cardDate(entry)),
    element('h3', 'event-card__title', entry.title),
    element('p', 'event-card__type', LABELS[entry.type] ?? entry.type),
  );

  const tick = element('span', 'thread__tick');
  tick.setAttribute('aria-hidden', 'true');
  const dot = element('span', 'thread__dot');
  dot.setAttribute('aria-hidden', 'true');

  item.append(axis, card, tick, dot);
  return item;
}

function render(type) {
  const selected = type ? entries.filter((entry) => entry.type === type) : entries;
  thread.replaceChildren(...selected.map(entryElement));
  thread.style.setProperty('--count', String(selected.length));
  thread.hidden = selected.length === 0;

  if (selected.length === 0) {
    status.textContent = type ? `No ${LABELS[type].toLowerCase()} entries yet.` : 'No entries yet.';
    return;
  }
  const noun = entries.length === 1 ? 'entry' : 'entries';
  status.textContent = `Showing ${selected.length} of ${entries.length} ${noun}${SHARE_NOTE}`;
}

function setFilter(type, { updateUrl = true } = {}) {
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.type === type));
  }
  render(type);
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (type) {
      url.searchParams.set(QUERY_PARAM, type);
    } else {
      url.searchParams.delete(QUERY_PARAM);
    }
    window.history.replaceState(null, '', url);
  }
}

// The chips are in the HTML (one per type in TYPES, plus "All") so they take up space before the
// script runs; this fills in the counts and wires up the clicks.
function buildFilters() {
  const counts = {};
  for (const entry of entries) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  }
  for (const button of filters.querySelectorAll('button')) {
    const type = button.dataset.type;
    button.querySelector('.chip__count').textContent = String(type ? counts[type] ?? 0 : entries.length);
    button.addEventListener('click', () => setFilter(type));
  }
}

buildFilters();
const requested = new URLSearchParams(window.location.search).get(QUERY_PARAM);
setFilter(requested && LABELS[requested] ? requested : '', { updateUrl: false });
