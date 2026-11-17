import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PUBLIC_MIN_COUNTRY, publicStats } from '../src/stats.js';

// A stand-in for the D1 binding: records each prepared query and its bound value, and answers
// each one with the canned rows for its position in the batch.
function fakeDb(answers) {
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

test('the public summary has totals only, in the shape the site expects', async () => {
  const db = fakeDb([
    [{ visits: 42, pageviews: 57 }],
    [{ avg_engaged_ms: 61000 }],
    [{ day: '2026-11-16', visits: 5 }, { day: '2026-11-17', visits: 7 }],
    [{ name: 'projects', n: 30 }],
    [{ name: 'desktop', n: 30 }, { name: 'mobile', n: 12 }],
    [{ name: 'US', n: 35 }],
  ]);
  const since = Date.UTC(2026, 9, 18);
  const out = await publicStats(db, since);

  assert.deepEqual(Object.keys(out).sort(), ['countries', 'daily', 'devices', 'engagement', 'sections', 'totals']);
  assert.deepEqual(out.totals, { visits: 42, pageviews: 57 });
  assert.deepEqual(out.engagement, { avg_engaged_ms: 61000 });
  assert.equal(out.daily.length, 2);
  assert.ok(db.seen.every((q) => q.value === since), 'every query is bound to the window start');
});

test('nothing private is queried, and small countries are held back', async () => {
  const db = fakeDb([]);
  await publicStats(db, 0);
  const sql = db.seen.map((q) => q.sql).join('\n');

  for (const column of ['label', 'target', 'href', 'referrer', 'message', 'track', 'x, y']) {
    assert.ok(!sql.includes(column), `public queries must not read ${column}`);
  }
  assert.match(sql, new RegExp(`HAVING n >= ${PUBLIC_MIN_COUNTRY}`));
});

test('an empty database gives zeros, not undefined', async () => {
  const out = await publicStats(fakeDb([]), 0);
  assert.deepEqual(out.totals, { visits: 0, pageviews: 0 });
  assert.deepEqual(out.engagement, { avg_engaged_ms: null });
});
