// Timeline page: fetches entries from the API and renders them as a list.
// If the API is unreachable (cold start, offline, not deployed yet), it falls back to a copy of
// api/data/timeline.json that Vite bundles at build time, so the page never renders empty.
import fallbackEntries from '../../../api/data/timeline.json';

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

function newestFirst(a, b) {
  return a.start < b.start ? 1 : a.start > b.start ? -1 : 0;
}

async function loadEntries() {
  try {
    const response = await fetch('/api/timeline');
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }
    const data = await response.json();
    return { entries: data.entries, source: 'API' };
  } catch (error) {
    console.warn('Timeline API unavailable, using the bundled copy.', error);
    return { entries: [...fallbackEntries].sort(newestFirst), source: 'bundled copy' };
  }
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

async function init() {
  const { entries, source } = await loadEntries();
  list.replaceChildren(...entries.map(entryElement));
  status.textContent = `${entries.length} entries, loaded from the ${source}.`;
}

init();
