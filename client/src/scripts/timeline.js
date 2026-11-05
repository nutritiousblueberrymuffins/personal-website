// Timeline page: renders the entries in src/data/timeline.json, newest first.
// GitHub Pages serves static files only, so the data is bundled at build time rather than
// fetched from an API. Edit the JSON file and push to update the timeline.
import entries from '../data/timeline.json';

const list = document.getElementById('timeline-list');
const status = document.getElementById('timeline-status');

const TYPE_LABELS = {
  work: 'Work',
  education: 'Education',
  certification: 'Certification',
  project: 'Project',
  milestone: 'Milestone',
};

// Types where a missing end date means "still going" rather than "a single moment".
const ONGOING_TYPES = new Set(['work', 'education']);

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
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function entryElement(entry) {
  const item = element('li', 'timeline-entry');
  item.dataset.type = entry.type;

  const meta = element('p', 'timeline-entry__meta');
  const time = document.createElement('time');
  time.dateTime = entry.start;
  time.textContent = dateRange(entry);
  meta.append(time, element('span', 'timeline-entry__type', TYPE_LABELS[entry.type] ?? entry.type));

  item.append(meta, element('h2', 'timeline-entry__title', entry.title));

  if (entry.org) {
    item.append(element('p', 'timeline-entry__org', entry.org));
  }
  if (entry.summary) {
    item.append(element('p', 'timeline-entry__summary', entry.summary));
  }
  if (entry.links?.length) {
    const links = element('p', 'timeline-entry__links');
    for (const link of entry.links) {
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      links.append(anchor);
    }
    item.append(links);
  }
  return item;
}

const sorted = [...entries].sort(newestFirst);
list.replaceChildren(...sorted.map(entryElement));
status.textContent = sorted.length ? `${sorted.length} entries, newest first.` : 'No entries yet.';
