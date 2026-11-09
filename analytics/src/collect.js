// Turns a batch sent by the website's tracker into rows for the events table. Everything from
// the browser is untrusted: types are whitelisted, strings are trimmed and capped, numbers are
// checked, and anything unexpected is dropped rather than stored.

export const EVENT_TYPES = new Set([
  'pageview',
  'click',
  'rage_click',
  'dead_click',
  'scroll_depth',
  'section_viewed',
  'timeline_filtered',
  'timeline_navigated',
  'page_leave',
  'js_error',
]);

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_EVENTS_PER_BATCH = 50;
const SESSION_ID = /^[a-z0-9]{8,32}$/;
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|java\//i;

function text(value, max) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function fraction(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? Math.round(value * 10000) / 10000
    : null;
}

function whole(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

// Keeps a small flat object of short strings and numbers; drops nesting and long values.
function flat(value, maxKeys = 12) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const out = {};
  for (const [key, raw] of Object.entries(value).slice(0, maxKeys)) {
    const name = text(key, 40);
    if (!name || !/^[a-z0-9_]+$/i.test(name)) {
      continue;
    }
    if (typeof raw === 'string') {
      const v = text(raw, 200);
      if (v) {
        out[name] = v;
      }
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[name] = raw;
    } else if (typeof raw === 'boolean') {
      out[name] = raw;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function parseUserAgent(ua = '') {
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua)
      ? 'mobile'
      : 'desktop';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Other';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Other';
  return { device, browser, os };
}

export function isBot(ua = '') {
  return !ua || BOT_UA.test(ua);
}

// Returns { rows } on success or { error } describing why the batch was rejected.
export function toRows(batch, { now, userAgent, country }) {
  if (!batch || typeof batch !== 'object') {
    return { error: 'not an object' };
  }
  const sessionId = typeof batch.sid === 'string' && SESSION_ID.test(batch.sid) ? batch.sid : null;
  if (!sessionId) {
    return { error: 'bad session id' };
  }
  if (!Array.isArray(batch.events) || batch.events.length === 0) {
    return { error: 'no events' };
  }
  const context = batch.ctx && typeof batch.ctx === 'object' ? batch.ctx : {};
  const viewportW = whole(context.vw, 100, 10000);
  const lang = text(context.lang, 20);
  const parsed = parseUserAgent(userAgent);
  const { browser, os } = parsed;
  // iPads identify as a Mac, and some browsers hide the device: a touch-first screen that the
  // user agent calls a desktop is a tablet or phone, by width.
  let { device } = parsed;
  if (device === 'desktop' && context.touch === true) {
    device = viewportW && viewportW < 768 ? 'mobile' : 'tablet';
  }
  const countryCode = typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : null;

  const rows = [];
  for (const event of batch.events.slice(0, MAX_EVENTS_PER_BATCH)) {
    if (!event || typeof event !== 'object' || !EVENT_TYPES.has(event.t)) {
      continue;
    }
    // Browser clocks drift; keep the browser time only when it is within a day of ours.
    const ts = Number.isFinite(event.ts) && Math.abs(event.ts - now) < 86400000 ? Math.round(event.ts) : now;
    const p = event.p && typeof event.p === 'object' ? event.p : {};
    const isClick = event.t === 'click' || event.t === 'rage_click' || event.t === 'dead_click';
    const { target, label, href, x, y, track, ...rest } = p;
    rows.push({
      received_at: now,
      ts,
      session_id: sessionId,
      type: event.t,
      path: text(event.path, 200),
      target: isClick ? text(target, 120) : null,
      label: isClick ? text(label, 80) : null,
      href: isClick ? text(href, 300) : null,
      x: isClick ? fraction(x) : null,
      y: isClick ? fraction(y) : null,
      track: isClick && flat(track, 6) ? JSON.stringify(flat(track, 6)) : null,
      props: flat(rest) ? JSON.stringify(flat(rest)) : null,
      viewport_w: viewportW,
      lang,
      country: countryCode,
      device,
      browser,
      os,
    });
  }
  return rows.length ? { rows } : { error: 'no valid events' };
}
