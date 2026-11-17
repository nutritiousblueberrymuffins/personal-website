// "Site stats": a thin tab hanging from the header, on the right under the nav. Pull it down (or
// click it) and a drawer opens with the site's own analytics for the last 30 days: visits, page
// views, pages per visit, time on page, scroll depth, quick exits, a chart of visits per day, how
// far visitors get, where they come from, projects opened, contact clicks, devices, browsers,
// operating systems and countries. The drawer scrolls when it's taller than the screen. The tab and
// drawer behaviour come from header-drawer.js.
//
// The numbers come from the analytics Worker's public summary, /api/public-stats (aggregates
// only; see analytics/src/stats.js), fetched the first time the drawer opens and again if it's
// more than five minutes old. The look lives in site.css ("Header drawers", "Site stats").
import { createHeaderDrawer } from './header-drawer.js';

const COLLECTOR = import.meta.env.VITE_ANALYTICS_ENDPOINT || 'https://personal-website-analytics.tonynscholar.workers.dev/collect';
const STATS_URL = new URL('/api/public-stats', COLLECTOR).href;
const HOW_IT_WORKS = 'https://github.com/nutritiousblueberrymuffins/personal-website/tree/main/analytics';
const REFRESH_MS = 5 * 60 * 1000;

const SECTIONS = [
  ['top', 'Intro'],
  ['about', 'About'],
  ['projects', 'Projects'],
  ['timeline', 'Timeline'],
  ['contact', 'Contact'],
];
const DEVICES = { desktop: 'Desktop', mobile: 'Phone', tablet: 'Tablet' };
const PROJECTS = { notestudo: 'NoTestudo', nexus: 'Nexus', 'this-website': 'This website' };
const CONTACTS = { email: 'Email', linkedin: 'LinkedIn', github: 'GitHub', phone: 'Phone' };

let loadedAt = 0;
let loading = false;

const drawer = createHeaderDrawer({
  id: 'stats',
  tab: 'Site stats',
  heading: 'Site stats  ·  last 30 days',
  place: 'right',
  footer: `<p class="header-drawer__note">From my own analytics: no cookies, no IP addresses. Referring sites and countries appear once they have 3 visits. <a href="${HOW_IT_WORKS}" target="_blank" rel="noopener">How it works  →</a></p>`,
  onOpen: () => {
    if (Date.now() - loadedAt > REFRESH_MS) {
      load();
    }
  },
});
const body = drawer?.body;

// ---------- Loading ----------

async function load() {
  if (loading) return;
  loading = true;
  if (!loadedAt) {
    body.replaceChildren(note('Loading…'));
  }
  try {
    const response = await fetch(STATS_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    render(await response.json());
    loadedAt = Date.now();
  } catch {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'stats-drawer__retry';
    retry.textContent = 'Try again';
    retry.addEventListener('click', load);
    body.replaceChildren(note("The stats couldn't be loaded right now."), retry);
  } finally {
    loading = false;
  }
}

function note(text) {
  const p = document.createElement('p');
  p.className = 'stats-drawer__status';
  p.textContent = text;
  return p;
}

// ---------- Drawing ----------
// Everything below builds markup from numbers, fixed labels and escaped text; nothing from the
// response is inserted as HTML unescaped.

const number = new Intl.NumberFormat('en-US');
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {}

function escape(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function duration(ms) {
  if (!ms) return '–';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function tile(value, label) {
  return `<div><p class="stats-tile__value">${value}</p><p class="stats-tile__label">${label}</p></div>`;
}

// A titled list of rows: name, a meter scaled to `scale`, and the value text.
function block(title, rows, { scale, value, empty = 'Nothing yet' }) {
  const items = rows.length
    ? rows.map((row) => {
      const width = scale ? Math.min(100, Math.round((row.n / scale) * 100)) : 0;
      return `<li><span class="stats-list__name">${row.label}</span><span class="stats-meter" aria-hidden="true"><span style="width:${width}%"></span></span><span class="stats-num">${value(row)}</span></li>`;
    }).join('')
    : `<li class="stats-list__empty">${empty}</li>`;
  return `<section class="stats-block"><h3 class="stats-subhead">${title}</h3><ul class="stats-list">${items}</ul></section>`;
}

const rowsOf = (list, label) => (list ?? [])
  .map((row) => ({ n: Number(row.n) || 0, label: label(String(row.name ?? '')) }))
  .filter((row) => row.label);

// Visits per day: one column per day of the window (a faint slot even when empty), a scale on
// the left with gridlines, and dates along the bottom.
function chart(daily, windowDays) {
  const byDay = new Map((daily ?? []).map((d) => [d.day, { visits: Number(d.visits) || 0, pageviews: Number(d.pageviews) || 0 }]));
  const days = [];
  const now = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = date.toISOString().slice(0, 10);
    days.push({ date, ...(byDay.get(key) ?? { visits: 0, pageviews: 0 }) });
  }
  const peak = Math.max(...days.map((d) => d.visits));
  // A round top for the scale: the peak itself when small, else the next even number.
  const top = Math.max(2, peak <= 4 ? peak : Math.ceil(peak / 2) * 2);
  const busiest = days.reduce((best, d) => (d.visits > best.visits ? d : best), days[0]);

  const columns = days.map((d) => {
    const label = `${shortDate.format(d.date)}: ${d.visits} ${d.visits === 1 ? 'visit' : 'visits'}, ${d.pageviews} ${d.pageviews === 1 ? 'page view' : 'page views'}`;
    const height = d.visits ? Math.max(4, (d.visits / top) * 100) : 0;
    return `<span class="stats-chart__col${d.visits ? '' : ' is-empty'}" title="${escape(label)}"><span class="stats-chart__bar" style="height:${height.toFixed(1)}%"></span></span>`;
  }).join('');

  const middle = days[Math.floor(days.length / 2)].date;
  const summary = peak
    ? `Busiest day: ${shortDate.format(busiest.date)}, ${busiest.visits} ${busiest.visits === 1 ? 'visit' : 'visits'}`
    : 'No visits in this window yet';

  return `
    <figure class="stats-chart">
      <figcaption><span>Visits per day</span><span class="stats-chart__peak">${summary}</span></figcaption>
      <div class="stats-chart__plot" role="img" aria-label="Visits per day for the last ${days.length} days. ${escape(summary)}.">
        <div class="stats-chart__y" aria-hidden="true"><span>${top}</span><span>${oneDecimal.format(top / 2)}</span><span>0</span></div>
        <div class="stats-chart__bars">${columns}</div>
      </div>
      <div class="stats-chart__x" aria-hidden="true"><span>${shortDate.format(days[0].date)}</span><span>${shortDate.format(middle)}</span><span>Today</span></div>
    </figure>`;
}

function render(data) {
  const visits = Number(data.totals?.visits) || 0;
  const pageviews = Number(data.totals?.pageviews) || 0;
  const engagement = data.engagement ?? {};
  const leaves = Number(engagement.leaves) || 0;
  const ofVisits = (row) => `${percent(row.n, visits)}%`;
  const count = (row) => number.format(row.n);

  const tiles = [
    tile(number.format(visits), 'Visits'),
    tile(number.format(pageviews), 'Page views'),
    tile(visits ? oneDecimal.format(pageviews / visits) : '–', 'Pages per visit'),
    tile(duration(engagement.avg_engaged_ms), 'Avg. time on page'),
    tile(engagement.avg_scroll == null ? '–' : `${engagement.avg_scroll}%`, 'Avg. scroll depth'),
    tile(leaves ? `${percent(Number(engagement.quick_exits) || 0, leaves)}%` : '–', 'Left within 10s'),
  ].join('');

  const seen = new Map((data.sections ?? []).map((s) => [s.name, Number(s.n) || 0]));
  const sections = SECTIONS.map(([id, label]) => ({ label, n: seen.get(id) ?? 0 }));

  // Referring sites are stored as bare domains; anything that doesn't look like one is skipped.
  const sources = rowsOf(data.sources, (name) => (name === 'Direct' ? 'Direct or unknown' : /^[a-z0-9.-]+$/i.test(name) ? escape(name) : ''));
  const projects = rowsOf(data.projects, (name) => PROJECTS[name] ?? '');
  const contacts = rowsOf(data.contacts, (name) => CONTACTS[name] ?? '');
  const devices = rowsOf(data.devices, (name) => escape(DEVICES[name] ?? name));
  const browsers = rowsOf(data.browsers, (name) => escape(name));
  const systems = rowsOf(data.os, (name) => escape(name));
  const countries = rowsOf(data.countries, (name) => escape(regionNames?.of(name) ?? name));
  const most = (rows) => Math.max(1, ...rows.map((row) => row.n));

  body.innerHTML = `
    <div class="stats-tiles">${tiles}</div>
    ${chart(data.daily, Number(data.days) || 30)}
    <div class="stats-grid">
      ${block('How far visitors get', sections, { scale: visits, value: ofVisits })}
      ${block('Where visitors come from', sources, { scale: visits, value: ofVisits })}
    </div>
    <div class="stats-grid">
      ${block('Projects opened', projects, { scale: most(projects), value: count, empty: 'No project clicks yet' })}
      ${block('Contact clicks', contacts, { scale: most(contacts), value: count, empty: 'No contact clicks yet' })}
    </div>
    <div class="stats-grid stats-grid--small">
      ${block('Devices', devices, { scale: visits, value: ofVisits })}
      ${block('Browsers', browsers, { scale: visits, value: ofVisits })}
      ${block('Operating systems', systems, { scale: visits, value: ofVisits })}
      ${block('Top countries', countries, { scale: visits, value: ofVisits, empty: 'None with 3+ visits yet' })}
    </div>`;
}
