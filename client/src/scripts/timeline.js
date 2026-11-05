// Timeline page: renders src/data/timeline.json as year groups on a centre line, with type
// filters and a reveal-on-scroll. The data is bundled at build time (GitHub Pages has no server),
// so editing the JSON and pushing updates the page. Entries marked draft show in local
// development only, which keeps samples and unfinished items off the live site.
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

const timeline = document.getElementById('timeline');
const filters = document.getElementById('timeline-filters');
const status = document.getElementById('timeline-status');

const entries = data.entries
  .filter((entry) => import.meta.env.DEV || !entry.draft)
  .sort(newestFirst);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const REVEAL_FALLBACK_MS = 3000;
let observer = null;
let revealFallback = null;

// Dates are ISO strings (YYYY, YYYY-MM or YYYY-MM-DD), so string order is date order.
function newestFirst(a, b) {
  return a.start < b.start ? 1 : a.start > b.start ? -1 : 0;
}

// "2024-01" -> "Jan 2024", "2024" -> "2024", "2024-01-15" -> "Jan 2024"
function formatDate(isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  if (!month) {
    return String(year);
  }
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(entry) {
  const start = formatDate(entry.start);
  if (entry.end) {
    return `${start} to ${formatDate(entry.end)}`;
  }
  return ONGOING_TYPES.has(entry.type) ? `${start} to present` : start;
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

function entryElement(entry) {
  const item = element('li', 'timeline-entry');
  item.dataset.type = entry.type;
  const card = element('article', 'timeline-card');

  const meta = element('p', 'timeline-card__meta');
  const time = document.createElement('time');
  time.dateTime = entry.start;
  time.textContent = dateRange(entry);
  meta.append(time, element('span', 'timeline-card__type', LABELS[entry.type] ?? entry.type));
  card.append(meta, element('h3', 'timeline-card__title', entry.title));

  if (entry.org) {
    card.append(element('p', 'timeline-card__org', entry.org));
  }
  if (entry.summary) {
    card.append(element('p', 'timeline-card__summary', entry.summary));
  }
  if (entry.tags?.length) {
    const tags = element('ul', 'timeline-card__tags');
    tags.setAttribute('aria-label', 'Tags');
    tags.append(...entry.tags.map((tag) => element('li', '', tag)));
    card.append(tags);
  }
  if (entry.links?.length) {
    const links = element('p', 'timeline-card__links');
    for (const link of entry.links) {
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      links.append(anchor);
    }
    card.append(links);
  }

  item.append(card);
  return item;
}

function yearSection(year, list) {
  const section = element('section', 'timeline-year');
  const heading = element('h2', 'timeline-year__label');
  heading.append(element('span', '', year));
  const items = element('ol', 'timeline-year__list');
  items.append(...list.map(entryElement));
  section.append(heading, items);
  return section;
}

// Reveal cards as they scroll into view. Only enabled when motion is allowed; otherwise the
// cards are simply visible, and they stay visible if the observer is unavailable.
function enableReveal() {
  observer?.disconnect();
  clearTimeout(revealFallback);
  if (reduceMotion || !('IntersectionObserver' in window)) {
    timeline.classList.remove('reveal-enabled');
    return;
  }
  timeline.classList.add('reveal-enabled');
  // Safety net: whatever the observer does, nothing stays hidden for long.
  revealFallback = setTimeout(() => {
    for (const item of timeline.querySelectorAll('.timeline-entry')) {
      item.classList.add('is-visible');
    }
  }, REVEAL_FALLBACK_MS);
  observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting) {
          record.target.classList.add('is-visible');
          observer.unobserve(record.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
  );
  for (const item of timeline.querySelectorAll('.timeline-entry')) {
    observer.observe(item);
  }
}

function render(type) {
  const selected = type ? entries.filter((entry) => entry.type === type) : entries;
  timeline.replaceChildren();

  if (selected.length === 0) {
    const label = type ? LABELS[type].toLowerCase() : '';
    timeline.append(element('p', 'timeline-empty', type ? `No ${label} entries yet.` : 'No entries yet.'));
    status.textContent = type ? `Showing 0 ${label} entries.` : 'Showing 0 entries.';
    return;
  }

  const byYear = new Map();
  for (const entry of selected) {
    const year = entry.start.slice(0, 4);
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year).push(entry);
  }
  for (const [year, list] of byYear) {
    timeline.append(yearSection(year, list));
  }

  const noun = selected.length === 1 ? 'entry' : 'entries';
  status.textContent = type
    ? `Showing ${selected.length} ${LABELS[type].toLowerCase()} ${noun}.`
    : `Showing ${selected.length} ${noun}, newest first.`;
  enableReveal();
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

function buildFilters() {
  const counts = {};
  for (const entry of entries) {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  }
  const chips = [['', 'All', entries.length], ...TYPES.map(([type, label]) => [type, label, counts[type] ?? 0])];
  for (const [type, label, count] of chips) {
    const button = element('button', '', `${label} `);
    button.type = 'button';
    button.dataset.type = type;
    button.setAttribute('aria-pressed', 'false');
    button.append(element('span', '', String(count)));
    button.addEventListener('click', () => setFilter(type));
    filters.append(button);
  }
}

buildFilters();
const requested = new URLSearchParams(window.location.search).get(QUERY_PARAM);
setFilter(requested && LABELS[requested] ? requested : '', { updateUrl: false });
