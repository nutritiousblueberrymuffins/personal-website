// Home page timeline: renders src/data/timeline.json on the thread, oldest first, with cards
// alternating above and below the line and each date on the free side of it. The data is
// bundled at build time (GitHub Pages has no server), so editing the JSON and pushing updates
// the page. Entries marked draft show in local development only, which keeps samples and
// unfinished items off the live site. The type filters update ?type= in the address so a
// filtered view can be shared.
//
// Moving through it: one entry is selected at a time (the newest to start with) and its full
// details show under the thread. The back and forward arrows, the left and right arrow keys,
// and clicking a card change the selection; the thread can be dragged with a mouse or swiped
// on a touch screen, and the entry that comes to rest nearest the middle becomes the selected
// one.
import data from '../data/timeline.json';
import { track } from './analytics.js';

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
// How far the pointer must move before a press on the thread counts as a drag, not a click.
const DRAG_THRESHOLD = 5;

const thread = document.getElementById('timeline-thread');
const viewport = document.getElementById('timeline-viewport');
const filters = document.getElementById('timeline-filters');
const status = document.getElementById('timeline-status');
const detail = document.getElementById('timeline-detail');
const position = document.getElementById('timeline-position');
const prevButton = document.getElementById('timeline-prev');
const nextButton = document.getElementById('timeline-next');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const entries = data.entries
  .filter((entry) => import.meta.env.DEV || !entry.draft)
  .sort(oldestFirst);

let shown = [];
let current = -1;

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

// In the details panel: the full span, e.g. "Jun 2022 – Dec 2024", "Oct 9, 2026".
function longDate(isoDate) {
  const { month, day, date, year } = parts(isoDate);
  if (day) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (month) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return String(year);
}

function detailDate(entry) {
  if (entry.end) {
    return `${longDate(entry.start)} – ${longDate(entry.end)}`;
  }
  return ONGOING_TYPES.has(entry.type) ? `${longDate(entry.start)} – present` : longDate(entry.start);
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

  // The card is a button: clicking it (or Enter / Space) selects the entry.
  const card = element('button', 'event-card');
  card.type = 'button';
  card.dataset.index = String(index);
  card.tabIndex = -1;
  card.append(
    element('span', 'event-card__date', cardDate(entry)),
    element('span', 'event-card__title', entry.title),
    element('span', 'event-card__type', LABELS[entry.type] ?? entry.type),
  );

  const tick = element('span', 'thread__tick');
  tick.setAttribute('aria-hidden', 'true');
  const dot = element('span', 'thread__dot');
  dot.setAttribute('aria-hidden', 'true');

  item.append(axis, card, tick, dot);
  return item;
}

function cards() {
  return [...thread.querySelectorAll('.event-card')];
}

// ---------- The details panel ----------

function renderDetail(entry, index) {
  const eyebrow = element('p', 'label-section', `Entry ${index + 1} of ${shown.length}  ·  ${LABELS[entry.type] ?? entry.type}`);
  const title = element('h3', 'timeline-detail__title', entry.title);
  const meta = element('p', 'timeline-detail__meta', [detailDate(entry), entry.org].filter(Boolean).join('  ·  '));
  const body = [eyebrow, title, meta];
  if (entry.summary) {
    body.push(element('p', 'timeline-detail__summary', entry.summary));
  }
  if (entry.links?.length) {
    const links = element('p', 'timeline-detail__links');
    for (const link of entry.links) {
      const anchor = element('a', '', `${link.label}  →`);
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.dataset.trackTimelineLink = entry.id;
      links.append(anchor);
    }
    body.push(links);
  }
  detail.replaceChildren(...body);
  // Replays the panel's ease-in (motion.css) for the new entry.
  detail.classList.remove('is-swapping');
  void detail.offsetWidth;
  detail.classList.add('is-swapping');
}

// ---------- Selection ----------

let programmaticScroll = false;

// Where a card's middle sits along the scrolling thread, in the thread's scroll coordinates.
function cardMiddle(card) {
  const box = card.getBoundingClientRect();
  return viewport.scrollLeft + box.left - viewport.getBoundingClientRect().left + box.width / 2;
}

// Scrolls the thread sideways so the card sits in the middle; never scrolls the page itself.
function centre(index, smooth) {
  const card = cards()[index];
  if (!card || viewport.scrollWidth <= viewport.clientWidth) {
    return;
  }
  const target = cardMiddle(card) - viewport.clientWidth / 2;
  const left = Math.max(0, Math.min(target, viewport.scrollWidth - viewport.clientWidth));
  if (Math.abs(left - viewport.scrollLeft) < 1) {
    return;
  }
  programmaticScroll = true;
  viewport.scrollTo({ left, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
}

function select(index, { via, scroll = true, focus = false } = {}) {
  if (!shown.length) {
    return;
  }
  const next = Math.max(0, Math.min(index, shown.length - 1));
  const changed = next !== current;
  current = next;
  cards().forEach((card, i) => {
    const on = i === current;
    card.setAttribute('aria-current', on ? 'true' : 'false');
    card.tabIndex = on ? 0 : -1;
    card.closest('.thread__item').classList.toggle('is-current', on);
  });
  prevButton.disabled = current === 0;
  nextButton.disabled = current === shown.length - 1;
  position.textContent = `${current + 1} / ${shown.length}`;
  renderDetail(shown[current], current);
  if (scroll) {
    centre(current, Boolean(via));
  }
  if (focus) {
    cards()[current].focus({ preventScroll: true });
  }
  if (via && changed) {
    track('timeline_navigated', { via, entry: shown[current].id, position: current + 1 });
  }
}

prevButton.addEventListener('click', () => select(current - 1, { via: 'arrow' }));
nextButton.addEventListener('click', () => select(current + 1, { via: 'arrow' }));

thread.addEventListener('click', (event) => {
  const card = event.target.closest('.event-card');
  if (card) {
    select(Number(card.dataset.index), { via: 'card' });
  }
});

// Left / Right (and Home / End) on a focused card move the selection and the focus with it.
thread.addEventListener('keydown', (event) => {
  const moves = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: shown.length - 1 };
  if (event.key in moves) {
    event.preventDefault();
    select(moves[event.key], { via: 'key', focus: true });
  }
});

// ---------- Dragging and swiping ----------
// Touch screens scroll the thread natively (a swipe). With a mouse, pressing and dragging moves
// it; a press that moves less than DRAG_THRESHOLD is still a click on the card.

let drag = null;
let suppressClick = false;

viewport.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || viewport.scrollWidth <= viewport.clientWidth) {
    return;
  }
  drag = { x: event.clientX, left: viewport.scrollLeft, moved: false, id: event.pointerId };
});

viewport.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) {
    return;
  }
  const dx = event.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) {
    return;
  }
  if (!drag.moved) {
    drag.moved = true;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  }
  viewport.scrollLeft = drag.left - dx;
});

function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.id)) {
    return;
  }
  if (drag.moved) {
    // Swallow the click this release may fire; clear the flag right after, so a later real
    // click still works when the browser fires none.
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    viewport.classList.remove('is-dragging');
    settle('drag');
  }
  drag = null;
}

viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);
// The click that ends a drag is not a click on a card.
viewport.addEventListener(
  'click',
  (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    }
  },
  true,
);

// When the thread comes to rest after a drag or swipe, the entry nearest the middle (or the
// first or last, at either end) becomes the selected one.
function settle(via) {
  if (!shown.length || viewport.scrollWidth <= viewport.clientWidth) {
    return;
  }
  const max = viewport.scrollWidth - viewport.clientWidth;
  let index;
  if (viewport.scrollLeft <= 2) {
    index = 0;
  } else if (viewport.scrollLeft >= max - 2) {
    index = shown.length - 1;
  } else {
    const middle = viewport.scrollLeft + viewport.clientWidth / 2;
    let best = Infinity;
    cards().forEach((card, i) => {
      const distance = Math.abs(cardMiddle(card) - middle);
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
  }
  select(index, { via, scroll: false });
}

let scrollTimer = null;
function onScrollRest() {
  clearTimeout(scrollTimer);
  if (programmaticScroll) {
    programmaticScroll = false;
    return;
  }
  if (!drag) {
    settle('swipe');
  }
}
if ('onscrollend' in window) {
  viewport.addEventListener('scrollend', onScrollRest);
} else {
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(onScrollRest, 150);
  }, { passive: true });
}

// ---------- Filters ----------

function render(type) {
  shown = type ? entries.filter((entry) => entry.type === type) : entries;
  thread.replaceChildren(...shown.map(entryElement));
  thread.style.setProperty('--count', String(shown.length));
  const empty = shown.length === 0;
  thread.hidden = empty;
  detail.hidden = empty;
  prevButton.disabled = empty;
  nextButton.disabled = empty;
  position.textContent = '';
  current = -1;

  if (empty) {
    status.textContent = type ? `No ${LABELS[type].toLowerCase()} entries yet.` : 'No entries yet.';
    return;
  }
  const noun = entries.length === 1 ? 'entry' : 'entries';
  status.textContent = `Showing ${shown.length} of ${entries.length} ${noun}${SHARE_NOTE}`;
  // Start on the newest entry, with the thread scrolled to it.
  select(shown.length - 1, { scroll: true });
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
    button.addEventListener('click', () => {
      setFilter(type);
      track('timeline_filtered', { filter: type || 'all', shown: thread.children.length });
    });
  }
}

buildFilters();
const requested = new URLSearchParams(window.location.search).get(QUERY_PARAM);
setFilter(requested && LABELS[requested] ? requested : '', { updateUrl: false });
