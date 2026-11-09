// Home page timeline: renders src/data/timeline.json on the thread, oldest first, with cards
// alternating above and below the line and each date on the free side of it. The data is
// bundled at build time (GitHub Pages has no server), so editing the JSON and pushing updates
// the page. Entries marked draft show in local development only, which keeps samples and
// unfinished items off the live site. The type filters update ?type= in the address so a
// filtered view can be shared.
//
// Moving through it: the thread is an endless strip. The entries repeat in both directions, so
// dragging (mouse) or swiping (touch) keeps going forward or backward, past the newest entry
// round to the oldest and the other way. A quick flick carries on through several entries;
// a horizontal trackpad swipe or Shift + wheel moves it too; the back / forward arrows and the
// arrow keys step one entry and loop the same way. It always settles with one entry centred,
// which is the selected one, and that entry's full details show under the thread.
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
const DRAG_THRESHOLD = 6;
// A flick carries on for about this long at the speed it was released at.
const MOMENTUM_MS = 320;
const MAX_CARRY = 5;
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

const thread = document.getElementById('timeline-thread');
const viewport = document.getElementById('timeline-viewport');
const filters = document.getElementById('timeline-filters');
const status = document.getElementById('timeline-status');
const detail = document.getElementById('timeline-detail');
const positionLabel = document.getElementById('timeline-position');
const prevButton = document.getElementById('timeline-prev');
const nextButton = document.getElementById('timeline-next');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const entries = data.entries
  .filter((entry) => import.meta.env.DEV || !entry.draft)
  .sort(oldestFirst);

let shown = [];
// The selected entry's index in `shown`.
let current = -1;
// The track: the entries repeated, laid out side by side. `period` items repeat seamlessly (twice
// the entry count when it is odd, so cards keep their above / below side); the track holds three
// periods and the settled position is always kept inside the middle one.
let period = 0;
let looping = false;
// Position along the track, in items: the item centred in the window. Fractional while moving.
let pos = 0;
// Measured layout: distance between neighbouring items, and the first item's centre.
let pitch = 0;
let firstCentre = 0;

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

// `index` is the item's place on the track; `entryIndex` is which entry it shows.
function entryElement(entry, index, entryIndex) {
  const item = element('li', `thread__item thread__item--${index % 2 === 0 ? 'above' : 'below'}`);
  item.style.setProperty('--col', String(index + 1));

  // The axis date repeats when the entry started, so screen readers skip it and read the card.
  const axis = element('time', 'thread__date', axisDate(entry));
  axis.dateTime = entry.start;
  axis.setAttribute('aria-hidden', 'true');

  // Clicking a card brings it to the middle. The whole track is hidden from screen readers and
  // the keyboard (the region and the details panel stand in for it), so cards are not tab stops.
  const card = element('button', 'event-card');
  card.type = 'button';
  card.dataset.track = String(index);
  card.dataset.entry = String(entryIndex);
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

function items() {
  return thread.children;
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

// ---------- Moving the track ----------

// Layout positions (offsetLeft), not on-screen ones: the section scales slightly while it eases
// into view, and on-screen measurements taken then would be too small.
function measure() {
  const list = items();
  if (!list.length) {
    return;
  }
  const a = list[0];
  firstCentre = a.offsetLeft - thread.offsetLeft + a.offsetWidth / 2;
  pitch = list.length > 1 ? list[1].offsetLeft - a.offsetLeft : a.offsetWidth;
}

function place(position, duration = 0) {
  pos = position;
  const offset = viewport.clientWidth / 2 - (firstCentre + pos * pitch);
  thread.style.transition = duration ? `transform ${duration}ms ${EASE}` : 'none';
  thread.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
}

// The entry shown by the track item at a (rounded) position.
function entryAt(position) {
  const n = shown.length;
  return ((Math.round(position) % n) + n) % n;
}

// Keeps a settled position inside the middle period. The track repeats every `period` items, so
// this jump is invisible.
function normalise() {
  if (!looping) {
    return;
  }
  let p = Math.round(pos);
  while (p < period) {
    p += period;
  }
  while (p >= 2 * period) {
    p -= period;
  }
  if (p !== Math.round(pos)) {
    place(p);
  }
}

// Highlights the centred card (only that copy, not every repeat of the entry) and updates the
// "n / total" position.
function highlight(position) {
  const centred = Math.round(position);
  for (const item of items()) {
    const card = item.querySelector('.event-card');
    const on = Number(card.dataset.track) === centred;
    item.classList.toggle('is-current', on);
    card.setAttribute('aria-current', on ? 'true' : 'false');
  }
  positionLabel.textContent = `${entryAt(position) + 1} / ${shown.length}`;
}

let settleTimer = 0;

// Moves the track to a whole item position and selects the entry there.
function goTo(target, { via, duration } = {}) {
  if (!shown.length) {
    return;
  }
  if (!looping) {
    target = Math.max(0, Math.min(target, shown.length - 1));
  }
  target = Math.round(target);
  const distance = Math.abs(target - pos);
  const time = reduceMotion.matches ? 0 : duration ?? Math.min(250 + distance * 90, 900);
  place(target, time);
  highlight(target);
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    normalise();
    select(entryAt(target), via, Math.round(distance));
  }, time);
}

function select(index, via, steps = 0) {
  const changed = index !== current;
  current = index;
  highlight(pos);
  if (!looping) {
    prevButton.disabled = current === 0;
    nextButton.disabled = current === shown.length - 1;
  }
  if (changed || !detail.childElementCount) {
    renderDetail(shown[current], current);
  }
  if (via && changed) {
    track('timeline_navigated', { via, entry: shown[current].id, position: current + 1, steps });
  }
}

prevButton.addEventListener('click', () => goTo(Math.round(pos) - 1, { via: 'arrow' }));
nextButton.addEventListener('click', () => goTo(Math.round(pos) + 1, { via: 'arrow' }));

thread.addEventListener('click', (event) => {
  const card = event.target.closest('.event-card');
  if (card) {
    goTo(Number(card.dataset.track), { via: 'card' });
  }
});

// Arrow keys on the strip step one entry (and loop); Home and End jump to the oldest / newest.
viewport.addEventListener('keydown', (event) => {
  const here = Math.round(pos);
  const base = looping ? here - entryAt(here) : 0;
  const moves = {
    ArrowLeft: here - 1,
    ArrowRight: here + 1,
    Home: base,
    End: base + shown.length - 1,
  };
  if (event.key in moves) {
    event.preventDefault();
    goTo(moves[event.key], { via: 'key' });
  }
});

// ---------- Dragging, swiping and flicking ----------
// The track follows the pointer (mouse or finger) item by item. On release it carries on in the
// same direction for a moment if it was flicked, then settles on the nearest entry.

let drag = null;
let suppressClick = false;

viewport.addEventListener('pointerdown', (event) => {
  if (!shown.length || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }
  clearTimeout(settleTimer);
  // Catch the track wherever it is, even mid-animation.
  const now = new DOMMatrixReadOnly(getComputedStyle(thread).transform).m41;
  const caught = (viewport.clientWidth / 2 - now - firstCentre) / pitch;
  place(caught);
  drag = {
    id: event.pointerId,
    type: event.pointerType,
    x: event.clientX,
    y: event.clientY,
    start: caught,
    moved: false,
    samples: [{ x: event.clientX, t: event.timeStamp }],
  };
});

viewport.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) {
    return;
  }
  const dx = event.clientX - drag.x;
  if (!drag.moved) {
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    drag.moved = true;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  }
  let next = drag.start - dx / pitch;
  if (!looping) {
    // Past either end the strip resists, like a rubber band.
    const max = shown.length - 1;
    if (next < 0) {
      next /= 3;
    } else if (next > max) {
      next = max + (next - max) / 3;
    }
  }
  place(next);
  highlight(next);
  drag.samples.push({ x: event.clientX, t: event.timeStamp });
  if (drag.samples.length > 12) {
    drag.samples.shift();
  }
});

function release(event) {
  if (!drag || (event && event.pointerId !== drag.id)) {
    return;
  }
  const finished = drag;
  drag = null;
  viewport.classList.remove('is-dragging');
  if (!finished.moved) {
    // A tap or click: settle back where it was.
    goTo(Math.round(finished.start));
    return;
  }
  // Swallow the click this release may fire; cleared right after so a later click still works.
  suppressClick = true;
  setTimeout(() => {
    suppressClick = false;
  }, 0);
  // Speed over the last 100 ms of movement. If the pointer stopped before letting go (a drag
  // that comes to rest), there is no momentum; a flick carries on.
  const releasedAt = event?.timeStamp ?? performance.now();
  const recent = finished.samples.filter((sample) => releasedAt - sample.t <= 100);
  let velocity = 0; // px per ms, positive = dragged right
  if (recent.length >= 2 && event?.type !== 'pointercancel') {
    const first = recent[0];
    const last = recent[recent.length - 1];
    velocity = (last.x - first.x) / Math.max(last.t - first.t, 1);
  }
  // A hard fling carries on at most MAX_CARRY entries.
  const carry = Math.max(-MAX_CARRY, Math.min(MAX_CARRY, (velocity * MOMENTUM_MS) / pitch));
  const target = Math.round(pos - carry);
  goTo(target, { via: finished.type === 'mouse' ? 'drag' : 'swipe' });
}

viewport.addEventListener('pointerup', release);
viewport.addEventListener('pointercancel', release);
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

// Trackpads (and Shift + wheel) scroll it sideways; it settles once the scrolling stops.
let wheelTimer = 0;
viewport.addEventListener(
  'wheel',
  (event) => {
    const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!shown.length || Math.abs(dx) <= Math.abs(event.shiftKey ? 0 : event.deltaY)) {
      return;
    }
    event.preventDefault();
    clearTimeout(settleTimer);
    let next = pos + dx / pitch;
    if (!looping) {
      next = Math.max(-0.4, Math.min(next, shown.length - 0.6));
    }
    place(next);
    highlight(next);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => goTo(Math.round(pos), { via: 'wheel' }), 140);
  },
  { passive: false },
);

// The layout changes size with the window (and the fonts loading): re-measure and re-centre.
let resizeFrame = 0;
const relayout = () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (shown.length) {
      measure();
      place(Math.round(pos));
    }
  });
};
window.addEventListener('resize', relayout);
document.fonts?.ready.then(relayout);

// ---------- Filters ----------

function render(type) {
  shown = type ? entries.filter((entry) => entry.type === type) : entries;
  const n = shown.length;
  looping = n >= 2;
  period = n % 2 ? n * 2 : n;
  const count = looping ? period * 3 : n;
  // Start on the newest entry, in the middle period of the track.
  const start = looping ? period + n - 1 : n - 1;
  const trackItems = [];
  for (let i = 0; i < count; i++) {
    const item = entryElement(shown[i % n], i, i % n);
    // Reveal outward from the starting entry.
    item.style.setProperty('--stagger', String(Math.min(Math.abs(i - start), 8)));
    trackItems.push(item);
  }
  thread.replaceChildren(...trackItems);
  thread.style.setProperty('--count', String(count));
  const empty = n === 0;
  viewport.hidden = empty;
  detail.hidden = empty;
  prevButton.disabled = empty || n === 1;
  nextButton.disabled = empty || n === 1;
  positionLabel.textContent = '';
  current = -1;
  detail.replaceChildren();

  if (empty) {
    status.textContent = type ? `No ${LABELS[type].toLowerCase()} entries yet.` : 'No entries yet.';
    return;
  }
  const noun = entries.length === 1 ? 'entry' : 'entries';
  status.textContent = `Showing ${shown.length} of ${entries.length} ${noun}${SHARE_NOTE}`;
  measure();
  place(start);
  select(n - 1);
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
