-- Visitor interaction events collected from the website by client/src/scripts/analytics.js.
-- One row per event. No IP addresses and no cookies: a visit is an anonymous random id that
-- lives only as long as the page is open.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY,
    received_at INTEGER NOT NULL,  -- server time, ms since epoch
    ts          INTEGER NOT NULL,  -- browser time, ms since epoch
    session_id  TEXT    NOT NULL,  -- random per page visit
    type        TEXT    NOT NULL,  -- pageview, click, rage_click, dead_click, scroll_depth,
                                   -- section_viewed, timeline_filtered, timeline_navigated,
                                   -- page_leave, js_error
    path        TEXT,              -- page path, e.g. /personal-website/
    target      TEXT,              -- clicks: a short description of the element, e.g. a.project-card
    label       TEXT,              -- clicks: the element's visible text (trimmed)
    href        TEXT,              -- clicks: the link's destination
    x           REAL,              -- clicks: horizontal position as a fraction of the page width
    y           REAL,              -- clicks: vertical position as a fraction of the page height
    track       TEXT,              -- clicks: data-track-* labels as JSON, e.g. {"project":"retriever-rush"}
    props       TEXT,              -- anything else for the event type, as JSON
    viewport_w  INTEGER,           -- browser window width in CSS px
    lang        TEXT,              -- browser language
    country     TEXT,              -- two-letter country from Cloudflare (not stored as IP)
    device      TEXT,              -- desktop, tablet or mobile
    browser     TEXT,
    os          TEXT
);

CREATE INDEX IF NOT EXISTS events_received ON events (received_at);
CREATE INDEX IF NOT EXISTS events_type_received ON events (type, received_at);
CREATE INDEX IF NOT EXISTS events_session ON events (session_id);
