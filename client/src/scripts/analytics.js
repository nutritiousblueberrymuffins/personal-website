// Our own visitor analytics: records how people use the page and sends it to the collector in
// analytics/ (a Cloudflare Worker + D1 database), whose dashboard shows the results.
//
// What it records:
//   pageview           each page load, with the referring site and utm_* tags
//   click              every click: the element (or the link, button or card it is in), its text, its link,
//                      where on the page (as a fraction of the page size), and any
//                      data-track-* labels on it or its parents (e.g. data-track-project)
//   rage_click         3 or more clicks within a second in the same spot
//   dead_click         a click on something that looks clickable where nothing happens
//   scroll_depth       25, 50, 75 and 100% of the page reached
//   section_viewed     each section that comes 40% into view
//   page_leave         time the page was visible, and the deepest scroll
//   js_error           JavaScript errors on the page
//   ...and custom events through track(), such as timeline_filtered.
//
// Privacy: no cookies and no storage of personal data. A visit is a random id that exists only
// while the page is open, so no one is followed across visits. Text typed into fields is never
// read. Browsers that send Do Not Track or Global Privacy Control are not tracked, and visiting
// any page with ?notrack (once) stops tracking in that browser, which is handy for excluding
// yourself; ?track turns it back on.
//
// It only runs when VITE_ANALYTICS_ENDPOINT is set at build time (the deploy workflow sets it)
// and never in the Vite dev server.

const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const OPT_OUT_KEY = 'analytics-opt-out';
const FLUSH_MS = 5000;
const MAX_BATCH = 20;

function optedOut() {
  const params = new URLSearchParams(window.location.search);
  try {
    if (params.has('notrack')) {
      localStorage.setItem(OPT_OUT_KEY, '1');
    } else if (params.has('track')) {
      localStorage.removeItem(OPT_OUT_KEY);
    }
    if (localStorage.getItem(OPT_OUT_KEY) === '1') {
      return true;
    }
  } catch {
    // Storage blocked: fall through to the browser signals.
  }
  return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
}

// Never inside a frame: the dashboard's heatmap shows the site in one, and that is not a visit.
const framed = window.self !== window.top;
const enabled = Boolean(ENDPOINT) && !import.meta.env.DEV && !framed && !optedOut();

const touchFirst = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
const queue = [];
let flushTimer = null;

function send(events) {
  const body = JSON.stringify({
    v: 1,
    sid: sessionId,
    // touch: a touch-first screen, so the collector can tell iPads (which identify as a Mac)
    // and phones from desktops.
    ctx: { vw: window.innerWidth, lang: navigator.language, touch: touchFirst },
    events,
  });
  // text/plain keeps it a "simple" request: no CORS preflight, and sendBeacon still delivers it
  // while the page is closing.
  const blob = new Blob([body], { type: 'text/plain' });
  if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) {
    return;
  }
  fetch(ENDPOINT, { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit' }).catch(() => {});
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  while (queue.length) {
    send(queue.splice(0, MAX_BATCH));
  }
}

// Records an event. Does nothing when analytics is off.
export function track(type, properties = {}) {
  if (!enabled) {
    return;
  }
  queue.push({ t: type, ts: Date.now(), path: window.location.pathname, p: properties });
  if (queue.length >= MAX_BATCH) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_MS);
  }
}

// ---------- Clicks ----------

const CLICKABLE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [tabindex]:not([tabindex="-1"])';

// A short, readable description of an element, e.g. a.project-card or button#play.
function describe(element) {
  let text = element.tagName.toLowerCase();
  if (element.id) {
    text += `#${element.id}`;
  } else if (typeof element.className === 'string' && element.className.trim()) {
    text += `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
  }
  return text;
}

// A short name for what was clicked, never what was typed into a field: a card's title, a
// link's or button's text, or, for anything else, only the element's own text (not everything
// inside it, so a click on a section's background does not report the whole section).
function visibleText(element, clickable) {
  if (element.matches('input, textarea, select')) {
    return element.getAttribute('aria-label') || element.name || element.type || '';
  }
  let text = element.getAttribute('aria-label');
  if (!text && clickable) {
    const title = element.querySelector('h1, h2, h3, h4, [class*="__title"]');
    text = (title || element).innerText;
  }
  if (!text) {
    text = Array.from(element.childNodes, (node) => (node.nodeType === Node.TEXT_NODE ? node.textContent : '')).join(' ');
  }
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// data-track-* labels on the element and its parents; the nearest one wins.
function trackLabels(element) {
  const labels = {};
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    for (const [key, value] of Object.entries(node.dataset || {})) {
      if (key.startsWith('track') && key.length > 5) {
        const name = key.slice(5).toLowerCase();
        if (!(name in labels)) {
          labels[name] = value;
        }
      }
    }
  }
  return Object.keys(labels).length ? labels : undefined;
}

function clickDetails(event, element) {
  const doc = document.documentElement;
  const pageWidth = Math.max(doc.scrollWidth, 1);
  const pageHeight = Math.max(doc.scrollHeight, 1);
  const link = element.closest('a');
  return {
    target: describe(element),
    label: visibleText(element, Boolean(element.closest(CLICKABLE))),
    href: link ? link.href : undefined,
    x: Math.min(Math.max(event.pageX / pageWidth, 0), 1),
    y: Math.min(Math.max(event.pageY / pageHeight, 0), 1),
    doc_h: pageHeight,
    track: trackLabels(element),
  };
}

// Rage clicks: 3+ clicks within a second, all within 30 px of each other.
const recentClicks = [];
function checkRage(event, details) {
  const now = event.timeStamp;
  recentClicks.push({ time: now, x: event.clientX, y: event.clientY });
  while (recentClicks.length && now - recentClicks[0].time > 1000) {
    recentClicks.shift();
  }
  const near = recentClicks.filter((c) => Math.hypot(c.x - event.clientX, c.y - event.clientY) < 30);
  if (near.length === 3) {
    track('rage_click', { ...details, clicks: near.length });
  }
}

// Dead clicks: the pointer showed it was clickable, yet within a second nothing changed on the
// page, it did not scroll, and it did not navigate or open anything.
function watchForDeadClick(element, details) {
  if (element.closest('a[href^="mailto:"], a[href^="tel:"], input, select, textarea')) {
    return;
  }
  if (!element.closest(CLICKABLE) && getComputedStyle(element).cursor !== 'pointer') {
    return;
  }
  let changed = false;
  const mark = () => {
    changed = true;
  };
  const observer = new MutationObserver(mark);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const startUrl = window.location.href;
  window.addEventListener('scroll', mark, { once: true, passive: true });
  document.addEventListener('visibilitychange', mark, { once: true });
  window.addEventListener('blur', mark, { once: true });
  setTimeout(() => {
    observer.disconnect();
    window.removeEventListener('scroll', mark);
    document.removeEventListener('visibilitychange', mark);
    window.removeEventListener('blur', mark);
    if (!changed && window.location.href === startUrl) {
      track('dead_click', details);
    }
  }, 1000);
}

function onClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const element = event.target.closest(CLICKABLE) || event.target;
  const details = clickDetails(event, element);
  track('click', details);
  checkRage(event, details);
  watchForDeadClick(element, details);
}

// ---------- Scrolling, sections and time on page ----------

let maxDepth = 0;
const depthMarks = [25, 50, 75, 100];

function onScroll() {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  const depth = scrollable <= 0 ? 100 : Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
  while (depthMarks.length && depth >= depthMarks[0]) {
    const mark = depthMarks.shift();
    maxDepth = mark;
    track('scroll_depth', { depth: mark });
  }
}

function watchSections() {
  if (!('IntersectionObserver' in window)) {
    return;
  }
  const observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting) {
          track('section_viewed', { section: record.target.id });
          observer.unobserve(record.target);
        }
      }
    },
    { threshold: 0.4 },
  );
  for (const section of document.querySelectorAll('main section[id]')) {
    observer.observe(section);
  }
}

// Time the page was actually visible, not just open in a background tab.
let visibleSince = document.visibilityState === 'visible' ? performance.now() : null;
let visibleMs = 0;
let left = false;

function pauseClock() {
  if (visibleSince !== null) {
    visibleMs += performance.now() - visibleSince;
    visibleSince = null;
  }
}

function leave() {
  if (left) {
    return;
  }
  left = true;
  pauseClock();
  track('page_leave', { engaged_ms: Math.round(visibleMs), max_depth: maxDepth });
  flush();
}

// ---------- Start ----------

function referrerHost() {
  try {
    const host = document.referrer ? new URL(document.referrer).host : '';
    return host && host !== window.location.host ? host : undefined;
  } catch {
    return undefined;
  }
}

if (enabled) {
  const params = new URLSearchParams(window.location.search);
  track('pageview', {
    referrer: referrerHost(),
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  });
  document.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  watchSections();
  window.addEventListener('error', (event) => {
    track('js_error', {
      message: String(event.message || 'error').slice(0, 200),
      source: event.filename ? event.filename.split('/').pop() : undefined,
      line: event.lineno || undefined,
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseClock();
      flush();
    } else if (!left) {
      visibleSince = performance.now();
    }
  });
  window.addEventListener('pagehide', leave);
  // Back/forward cache: a restored page is a new view of the same visit.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      left = false;
      visibleMs = 0;
      visibleSince = performance.now();
      track('pageview', { referrer: referrerHost(), restored: true });
    }
  });
}
