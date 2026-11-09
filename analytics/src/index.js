// Analytics collector and dashboard for the personal website.
//
//   POST /collect    events from the website's tracker (public, origin-checked)
//   GET  /           the dashboard page            (password)
//   GET  /api/stats  the dashboard's numbers, JSON (password)
//
// Events are stored in the D1 database bound as DB (schema.sql). The dashboard password is the
// DASHBOARD_PASSWORD secret; the browser asks for it (any user name works). A daily cron
// deletes events older than RETENTION_DAYS.
import dashboardHtml from './dashboard.html';
import { MAX_BODY_BYTES, isBot, toRows } from './collect.js';
import { stats } from './stats.js';

const INSERT = `INSERT INTO events
  (received_at, ts, session_id, type, path, target, label, href, x, y, track, props,
   viewport_w, lang, country, device, browser, os)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`;

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// One log line per collect request: what happened and why, never the payload. Visible in the
// Cloudflare dashboard under the Worker's Logs (observability is on in wrangler.toml).
function logCollect(outcome, details = {}) {
  console.log(JSON.stringify({ route: 'collect', outcome, ...details }));
}

async function collect(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).includes(origin)) {
    logCollect('rejected', { reason: 'origin', origin: origin.slice(0, 100) || '(none)' });
    return new Response('origin not allowed', { status: 403 });
  }
  const headers = corsHeaders(origin);
  const userAgent = request.headers.get('User-Agent') || '';
  // Bots and headless browsers are answered but not stored (ALLOW_HEADLESS is for local tests).
  if (isBot(userAgent) && env.ALLOW_HEADLESS !== 'true') {
    logCollect('skipped', { reason: 'bot', userAgent: userAgent.slice(0, 160) });
    return new Response(null, { status: 204, headers });
  }
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) {
    logCollect('rejected', { reason: 'too large', bytes: length });
    return new Response('too large', { status: 413, headers });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response('too large', { status: 413, headers });
  }
  let batch;
  try {
    batch = JSON.parse(body);
  } catch {
    logCollect('rejected', { reason: 'bad json', bytes: body.length });
    return new Response('bad json', { status: 400, headers });
  }
  const { rows, error } = toRows(batch, {
    now: Date.now(),
    userAgent,
    country: request.cf?.country,
  });
  if (error) {
    logCollect('rejected', { reason: error });
    return new Response(error, { status: 400, headers });
  }
  const statement = env.DB.prepare(INSERT);
  await env.DB.batch(
    rows.map((r) =>
      statement.bind(
        r.received_at, r.ts, r.session_id, r.type, r.path, r.target, r.label, r.href, r.x, r.y,
        r.track, r.props, r.viewport_w, r.lang, r.country, r.device, r.browser, r.os,
      ),
    ),
  );
  logCollect('stored', { events: rows.length, types: [...new Set(rows.map((r) => r.type))] });
  return new Response(null, { status: 204, headers });
}

// Constant-time comparison, so the response time does not reveal how much of a guess matched.
function sameText(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function authorised(request, env) {
  if (!env.DASHBOARD_PASSWORD) {
    return false;
  }
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) {
    return false;
  }
  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return sameText(password, env.DASHBOARD_PASSWORD);
}

function askForPassword(env) {
  const message = env.DASHBOARD_PASSWORD ? 'Password required' : 'DASHBOARD_PASSWORD is not set';
  return new Response(message, {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Website analytics", charset="UTF-8"' },
  });
}

const PRIVATE = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/collect') {
      if (request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin') || '';
        return allowedOrigins(env).includes(origin)
          ? new Response(null, { status: 204, headers: corsHeaders(origin) })
          : new Response(null, { status: 403 });
      }
      if (request.method === 'POST') {
        return collect(request, env);
      }
      return new Response('method not allowed', { status: 405 });
    }

    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405 });
    }
    if (url.pathname !== '/' && url.pathname !== '/api/stats') {
      return new Response('not found', { status: 404 });
    }
    if (!authorised(request, env)) {
      return askForPassword(env);
    }
    if (url.pathname === '/') {
      return new Response(dashboardHtml, {
        headers: { ...PRIVATE, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    const days = Math.min(Math.max(Number.parseInt(url.searchParams.get('days'), 10) || 30, 1), 400);
    const since = Date.now() - days * 86400000;
    const data = await stats(env.DB, since);
    return Response.json(
      { days, since, site: env.SITE_URL || '', ...data },
      { headers: PRIVATE },
    );
  },

  async scheduled(_event, env) {
    const days = Number.parseInt(env.RETENTION_DAYS, 10) || 395;
    await env.DB.prepare('DELETE FROM events WHERE received_at < ?1')
      .bind(Date.now() - days * 86400000)
      .run();
  },
};
