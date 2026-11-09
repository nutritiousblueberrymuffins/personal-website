import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBot, parseUserAgent, toRows } from '../src/collect.js';

const now = Date.UTC(2026, 10, 9, 12);
const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

test('a click becomes one row with its position, labels and context', () => {
  const { rows, error } = toRows(
    {
      sid: 'abc123def456',
      ctx: { vw: 1440, lang: 'en-US' },
      events: [{ t: 'click', ts: now - 500, path: '/personal-website/', p: {
        target: 'a.project-card', label: '  Retriever   Rush ', href: 'https://github.com/x/y',
        x: 0.25, y: 0.5, doc_h: 3400, track: { project: 'retriever-rush' },
      } }],
    },
    { now, userAgent: chrome, country: 'US' },
  );
  assert.equal(error, undefined);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.type, 'click');
  assert.equal(row.label, 'Retriever Rush');
  assert.equal(row.x, 0.25);
  assert.equal(row.track, '{"project":"retriever-rush"}');
  assert.equal(row.props, '{"doc_h":3400}');
  assert.equal(row.ts, now - 500);
  assert.deepEqual([row.device, row.browser, row.os, row.country, row.viewport_w], ['desktop', 'Chrome', 'Windows', 'US', 1440]);
});

test('unknown event types, bad numbers and nested values are dropped', () => {
  const { rows } = toRows(
    {
      sid: 'abc123def456',
      events: [
        { t: 'drop_table', p: {} },
        { t: 'click', p: { x: 7, y: -1, target: 'div', track: { a: { nested: 1 } } } },
        { t: 'scroll_depth', p: { depth: 50, html: { x: 1 } } },
      ],
    },
    { now, userAgent: chrome },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].x, null);
  assert.equal(rows[0].y, null);
  assert.equal(rows[0].track, null);
  assert.equal(rows[1].props, '{"depth":50}');
});

test('long text is trimmed and a far-off browser clock falls back to server time', () => {
  const { rows } = toRows(
    { sid: 'abc123def456', events: [{ t: 'click', ts: now - 5 * 86400000, p: { label: 'x'.repeat(500) } }] },
    { now, userAgent: chrome },
  );
  assert.equal(rows[0].label.length, 80);
  assert.equal(rows[0].ts, now);
});

test('batches without a valid session id or events are rejected', () => {
  assert.ok(toRows({ sid: 'DROP TABLE', events: [{ t: 'click' }] }, { now }).error);
  assert.ok(toRows({ sid: 'abc123def456', events: [] }, { now }).error);
  assert.ok(toRows(null, { now }).error);
});

test('at most 50 events per batch are kept', () => {
  const events = Array.from({ length: 80 }, () => ({ t: 'pageview', p: {} }));
  assert.equal(toRows({ sid: 'abc123def456', events }, { now, userAgent: chrome }).rows.length, 50);
});

test('a touch-first screen with a desktop user agent is a tablet or phone', () => {
  const ipadSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15';
  const batch = (vw) => ({ sid: 'abc123def456', ctx: { vw, touch: true }, events: [{ t: 'pageview', p: {} }] });
  assert.equal(toRows(batch(1024), { now, userAgent: ipadSafari }).rows[0].device, 'tablet');
  assert.equal(toRows(batch(390), { now, userAgent: chrome }).rows[0].device, 'mobile');
  assert.equal(toRows({ ...batch(1440), ctx: { vw: 1440 } }, { now, userAgent: chrome }).rows[0].device, 'desktop');
});

test('user agents', () => {
  assert.deepEqual(parseUserAgent(iphone), { device: 'mobile', browser: 'Safari', os: 'iOS' });
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot('Mozilla/5.0 HeadlessChrome/142.0'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot(chrome), false);
});
