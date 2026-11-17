// "Site stats": a thin tab hanging from the middle of the header. Pull it down (or click it) and a
// drawer opens under the header with the site's own analytics for the last 30 days: visits,
// page views, time on page, visits per day, how far visitors get, devices and countries. The
// tab rides on the drawer's bottom edge, so pushing it back up (or clicking it, the close button,
// Escape, or a click elsewhere) closes it.
//
// The numbers come from the analytics Worker's public summary, /api/public-stats (totals only;
// see analytics/src/stats.js), fetched the first time the drawer opens and again if it's more
// than five minutes old. The look lives in site.css ("Site stats drawer").

const COLLECTOR = import.meta.env.VITE_ANALYTICS_ENDPOINT || 'https://personal-website-analytics.tonynscholar.workers.dev/collect';
const STATS_URL = new URL('/api/public-stats', COLLECTOR).href;
const HOW_IT_WORKS = 'https://github.com/nutritiousblueberrymuffins/personal-website/tree/main/analytics';
const REFRESH_MS = 5 * 60 * 1000;
// How far the tab must be dragged before it counts as a pull rather than a click.
const PULL_PX = 24;

const SECTIONS = [
  ['top', 'Intro'],
  ['about', 'About'],
  ['projects', 'Projects'],
  ['timeline', 'Timeline'],
  ['contact', 'Contact'],
];
const DEVICES = { desktop: 'Desktop', mobile: 'Phone', tablet: 'Tablet' };

const header = document.querySelector('.site-header');

if (header) {
  const CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CLOSE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  const drawer = document.createElement('div');
  drawer.className = 'stats-drawer';
  drawer.innerHTML = `
    <div class="stats-drawer__panel" id="stats-panel" role="region" aria-label="Site stats, last 30 days" inert>
      <div class="stats-drawer__inner">
        <div class="stats-drawer__head">
          <p class="label-section">Site stats  ·  last 30 days</p>
          <button class="stats-drawer__close" type="button" aria-label="Close site stats">${CLOSE}</button>
        </div>
        <div class="stats-drawer__body" aria-live="polite"></div>
        <p class="stats-drawer__note">From my own analytics: no cookies, no IP addresses. <a href="${HOW_IT_WORKS}" target="_blank" rel="noopener">How it works  →</a></p>
      </div>
    </div>
    <button class="stats-handle" type="button" aria-expanded="false" aria-controls="stats-panel">
      <span class="stats-handle__grip" aria-hidden="true"></span>
      <span class="stats-handle__label">Site stats</span>${CHEVRON}
    </button>`;
  header.append(drawer);

  const panel = drawer.querySelector('.stats-drawer__panel');
  const body = drawer.querySelector('.stats-drawer__body');
  const handle = drawer.querySelector('.stats-handle');
  const closeButton = drawer.querySelector('.stats-drawer__close');

  let loadedAt = 0;
  let loading = false;
  const isOpen = () => drawer.classList.contains('is-open');

  function setOpen(open) {
    drawer.classList.toggle('is-open', open);
    panel.inert = !open;
    handle.setAttribute('aria-expanded', String(open));
    handle.setAttribute('aria-label', open ? 'Close site stats' : 'Open site stats');
    if (open && Date.now() - loadedAt > REFRESH_MS) {
      load();
    }
  }

  // ---------- Pull, click, Escape, click elsewhere ----------

  let drag = null;
  let pulled = false;
  handle.addEventListener('pointerdown', (event) => {
    drag = { y: event.clientY, id: event.pointerId };
    pulled = false;
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dy = event.clientY - drag.y;
    if (!isOpen() && dy > PULL_PX) {
      pulled = true;
      drag = null;
      setOpen(true);
    } else if (isOpen() && dy < -PULL_PX) {
      pulled = true;
      drag = null;
      setOpen(false);
    }
  });
  const endDrag = () => { drag = null; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  // Pointer capture keeps the drag going if the pointer slips off the thin tab.
  handle.addEventListener('pointerdown', (event) => {
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {}
  });

  handle.addEventListener('click', () => {
    // A pull already opened or closed it; the click that ends it shouldn't undo that.
    if (pulled) {
      pulled = false;
      return;
    }
    setOpen(!isOpen());
  });
  closeButton.addEventListener('click', () => {
    setOpen(false);
    handle.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      handle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !drawer.contains(event.target)) {
      setOpen(false);
    }
  });

  // ---------- Loading and drawing ----------

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

  const number = new Intl.NumberFormat('en-US');
  const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
  let regionNames = null;
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {}

  function duration(ms) {
    if (!ms) return '–';
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  }

  // Builds markup from numbers and fixed labels only; country names come from Intl, so nothing
  // from the response is inserted as HTML.
  function escape(text) {
    return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function render(data) {
    const visits = Number(data.totals?.visits) || 0;
    const pageviews = Number(data.totals?.pageviews) || 0;

    // One bar per day for the whole window, zero where nothing came in.
    const byDay = new Map((data.daily ?? []).map((d) => [d.day, Number(d.visits) || 0]));
    const days = [];
    const today = new Date();
    for (let i = (data.days || 30) - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      const key = d.toISOString().slice(0, 10);
      days.push([key, byDay.get(key) ?? 0]);
    }
    const peak = Math.max(1, ...days.map(([, n]) => n));
    const W = 300;
    const H = 64;
    const step = W / days.length;
    const bars = days
      .map(([day, n], i) => {
        const h = n ? Math.max(2, (n / peak) * (H - 4)) : 0;
        return `<rect x="${(i * step + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(step - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"><title>${escape(day)}: ${n} ${n === 1 ? 'visit' : 'visits'}</title></rect>`;
      })
      .join('');

    const seen = new Map((data.sections ?? []).map((s) => [s.name, Number(s.n) || 0]));
    const sectionRows = SECTIONS.map(([id, label]) => {
      const share = percent(seen.get(id) ?? 0, visits);
      return `<li><span>${label}</span><span class="stats-meter" aria-hidden="true"><span style="width:${share}%"></span></span><span class="stats-num">${share}%</span></li>`;
    }).join('');

    const deviceTotal = (data.devices ?? []).reduce((sum, d) => sum + (Number(d.n) || 0), 0);
    const devices = (data.devices ?? [])
      .map((d) => `${escape(DEVICES[d.name] ?? d.name)} ${percent(Number(d.n) || 0, deviceTotal)}%`)
      .join('  ·  ') || '–';

    const countries = (data.countries ?? [])
      .map((c) => escape(regionNames?.of(String(c.name)) ?? c.name))
      .join(', ') || 'Not enough visits yet';

    body.innerHTML = `
      <div class="stats-tiles">
        <div><p class="stats-tile__value">${number.format(visits)}</p><p class="stats-tile__label">Visits</p></div>
        <div><p class="stats-tile__value">${number.format(pageviews)}</p><p class="stats-tile__label">Page views</p></div>
        <div><p class="stats-tile__value">${duration(data.engagement?.avg_engaged_ms)}</p><p class="stats-tile__label">Avg. time on page</p></div>
      </div>
      <div class="stats-grid">
        <figure class="stats-chart">
          <figcaption>Visits per day</figcaption>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visits per day over the last ${days.length} days, peaking at ${peak}.">${bars}</svg>
          <div class="stats-chart__axis"><span>${days.length} days ago</span><span>Today</span></div>
        </figure>
        <div>
          <p class="stats-subhead">How far visitors get</p>
          <ul class="stats-sections">${sectionRows}</ul>
        </div>
      </div>
      <dl class="stats-facts">
        <div><dt>Devices</dt><dd>${devices}</dd></div>
        <div><dt>Top countries</dt><dd>${countries}</dd></div>
      </dl>`;
  }
}
