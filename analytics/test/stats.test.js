import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PUBLIC_CONTACTS, PUBLIC_MIN_GROUP, PUBLIC_PROJECTS, publicStats } from '../src/stats.js';

// A stand-in for the D1 binding: records each prepared query and its bound value, and answers
// each one with the canned rows for its position in the batch.
function fakeDb(answers = []) {
  const seen = [];
  return {
    seen,
    prepare(sql) {
      return {
        bind(value) {
          seen.push({ sql, value });
          return { sql, value };
        },
      };
    },
    async batch(statements) {
      return statements.map((_, i) => ({ results: answers[i] ?? [] }));
    },
  };
}

const KEYS = ['browsers', 'contacts', 'countries', 'daily', 'devices', 'engagement', 'os', 'projects', 'sections', 'sources', 'totals'];

test('the public summary has the shape the site expects', async () => {
  const db = fakeDb([
    [{ visits: 42, pageviews: 57 }],
    [{ avg_engaged_ms: 61000, avg_scroll: 63, quick_exits: 9, leaves: 50 }],
    [{ day: '2026-11-16', visits: 5, pageviews: 6 }, { day: '2026-11-17', visits: 7, pageviews: 9 }],
  ]);
  const since = Date.UTC(2026, 9, 18);
  const out = await publicStats(db, since);

  assert.deepEqual(Object.keys(out).sort(), KEYS);
  assert.deepEqual(out.totals, { visits: 42, pageviews: 57 });
  assert.deepEqual(out.engagement, { avg_engaged_ms: 61000, avg_scroll: 63, quick_exits: 9, leaves: 50 });
  assert.equal(out.daily.length, 2);
  assert.ok(db.seen.every((q) => q.value === since), 'every query is bound to the window start');
});

test('nothing a visitor typed or a single click could be traced from is queried', async () => {
  const db = fakeDb();
  await publicStats(db, 0);
  const sql = db.seen.map((q) => q.sql).join('\n');

  for (const column of ['label', 'target', 'href', '$.message', 'x, y', 'session_id AS', 'path']) {
    assert.ok(!sql.includes(column), `public queries must not read ${column}`);
  }
});

test('referring sites and countries need a minimum count; Direct is always shown', async () => {
  const db = fakeDb();
  await publicStats(db, 0);
  const sources = db.seen.find((q) => q.sql.includes('$.referrer')).sql;
  const countries = db.seen.find((q) => q.sql.includes('SELECT country')).sql;

  assert.match(sources, new RegExp(`name = 'Direct' OR n >= ${PUBLIC_MIN_GROUP}`));
  assert.match(countries, new RegExp(`HAVING n >= ${PUBLIC_MIN_GROUP}`));
});

test('project and contact clicks are limited to the labels the site uses', async () => {
  const db = fakeDb();
  await publicStats(db, 0);
  const tracked = db.seen.filter((q) => q.sql.includes('json_each(events.track)')).map((q) => q.sql);

  assert.equal(tracked.length, 2);
  for (const name of PUBLIC_PROJECTS) assert.ok(tracked[0].includes(`'${name}'`));
  for (const name of PUBLIC_CONTACTS) assert.ok(tracked[1].includes(`'${name}'`));
  assert.ok(tracked.every((sql) => /j\.value IN \(/.test(sql)), 'labels are whitelisted');
});

test('an empty database gives zeros, not undefined', async () => {
  const out = await publicStats(fakeDb(), 0);
  assert.deepEqual(out.totals, { visits: 0, pageviews: 0 });
  assert.deepEqual(out.engagement, { avg_engaged_ms: null, avg_scroll: null, quick_exits: 0, leaves: 0 });
});
