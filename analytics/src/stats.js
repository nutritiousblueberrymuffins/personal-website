// The dashboard's numbers: one batch of read-only queries over events received since `since`
// (ms since epoch). Every query is parameterised; nothing from the request reaches the SQL text.

const QUERIES = {
  totals: `
    SELECT COUNT(DISTINCT session_id) AS visits,
           SUM(type = 'pageview') AS pageviews,
           SUM(type = 'click') AS clicks,
           SUM(type = 'rage_click') AS rage_clicks,
           SUM(type = 'dead_click') AS dead_clicks,
           SUM(type = 'js_error') AS errors
    FROM events WHERE received_at >= ?1`,
  engagement: `
    SELECT CAST(AVG(json_extract(props, '$.engaged_ms')) AS INTEGER) AS avg_engaged_ms,
           COUNT(*) AS leaves
    FROM events WHERE type = 'page_leave' AND received_at >= ?1`,
  clickingVisits: `
    SELECT COUNT(DISTINCT session_id) AS visits
    FROM events WHERE type = 'click' AND received_at >= ?1`,
  daily: `
    SELECT strftime('%Y-%m-%d', received_at / 1000, 'unixepoch') AS day,
           COUNT(DISTINCT session_id) AS visits,
           SUM(type = 'click') AS clicks
    FROM events WHERE received_at >= ?1
    GROUP BY day ORDER BY day`,
  topClicks: `
    SELECT COALESCE(label, target) AS name, href, COUNT(*) AS n
    FROM events WHERE type = 'click' AND received_at >= ?1
    GROUP BY name, href ORDER BY n DESC LIMIT 15`,
  tracked: `
    SELECT j.key AS kind, j.value AS name, COUNT(*) AS n
    FROM events, json_each(events.track) AS j
    WHERE events.type = 'click' AND events.track IS NOT NULL AND events.received_at >= ?1
    GROUP BY kind, name ORDER BY n DESC`,
  sections: `
    SELECT json_extract(props, '$.section') AS name, COUNT(DISTINCT session_id) AS n
    FROM events WHERE type = 'section_viewed' AND received_at >= ?1
    GROUP BY name`,
  scrollDepth: `
    SELECT json_extract(props, '$.depth') AS depth, COUNT(DISTINCT session_id) AS n
    FROM events WHERE type = 'scroll_depth' AND received_at >= ?1
    GROUP BY depth ORDER BY depth`,
  referrers: `
    SELECT COALESCE(json_extract(props, '$.referrer'), 'Direct or unknown') AS name, COUNT(*) AS n
    FROM events WHERE type = 'pageview' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC LIMIT 10`,
  pages: `
    SELECT COALESCE(path, '?') AS name, COUNT(*) AS n
    FROM events WHERE type = 'pageview' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC LIMIT 10`,
  countries: `
    SELECT COALESCE(country, '??') AS name, COUNT(*) AS n
    FROM events WHERE type = 'pageview' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC LIMIT 10`,
  devices: `
    SELECT device AS name, COUNT(*) AS n
    FROM events WHERE type = 'pageview' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC`,
  browsers: `
    SELECT browser AS name, COUNT(*) AS n
    FROM events WHERE type = 'pageview' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC`,
  filters: `
    SELECT json_extract(props, '$.filter') AS name, COUNT(*) AS n
    FROM events WHERE type = 'timeline_filtered' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC`,
  timelineEntries: `
    SELECT json_extract(props, '$.entry') AS name, COUNT(*) AS n
    FROM events WHERE type = 'timeline_navigated' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC LIMIT 12`,
  timelineVia: `
    SELECT json_extract(props, '$.via') AS name, COUNT(*) AS n
    FROM events WHERE type = 'timeline_navigated' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC`,
  frustration: `
    SELECT type, COALESCE(label, target) AS name, COUNT(*) AS n
    FROM events WHERE type IN ('rage_click', 'dead_click') AND received_at >= ?1
    GROUP BY type, name ORDER BY n DESC LIMIT 12`,
  errors: `
    SELECT json_extract(props, '$.message') AS name, COUNT(*) AS n
    FROM events WHERE type = 'js_error' AND received_at >= ?1
    GROUP BY name ORDER BY n DESC LIMIT 10`,
  heatmap: `
    SELECT type, x, y, viewport_w AS vw, json_extract(props, '$.doc_h') AS doc_h
    FROM events
    WHERE type IN ('click', 'rage_click', 'dead_click') AND x IS NOT NULL AND y IS NOT NULL
      AND received_at >= ?1
    ORDER BY id DESC LIMIT 3000`,
  recent: `
    SELECT received_at, type, path, COALESCE(label, target) AS name, props, track,
           country, device, browser
    FROM events WHERE received_at >= ?1
    ORDER BY id DESC LIMIT 40`,
};

export async function stats(db, since) {
  const names = Object.keys(QUERIES);
  const results = await db.batch(names.map((name) => db.prepare(QUERIES[name]).bind(since)));
  const out = {};
  names.forEach((name, i) => {
    out[name] = results[i].results;
  });
  // Single-row queries come back as objects.
  for (const name of ['totals', 'engagement', 'clickingVisits']) {
    out[name] = out[name][0] ?? {};
  }
  return out;
}
