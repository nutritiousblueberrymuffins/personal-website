# Website analytics

Our own analytics for the website, in the spirit of PostHog but with no third party: a small
tracker on the site, a collector on Cloudflare Workers that stores events in a Cloudflare D1
database, and a password-protected dashboard served by the same Worker.

| Part | File |
|------|------|
| Tracker (runs on the site) | `client/src/scripts/analytics.js` |
| Collector + dashboard API | `analytics/src/index.js`, `collect.js` (validation), `stats.js` (queries) |
| Dashboard page | `analytics/src/dashboard.html` |
| Database table | `analytics/schema.sql` |
| Deploy | `.github/workflows/deploy-analytics.yml` |

## What it records

Page views (with the referring site and `utm_*` tags), every click (the element, its text, its
link, where on the page, and any `data-track-*` labels such as `data-track-project`), rage
clicks, dead clicks, scroll depth, sections viewed, time the page was visible, timeline filter
use, and JavaScript errors. Add `data-track-<name>="<value>"` to any element to label clicks on
it; call `track('event_name', { ... })` from `analytics.js` for a custom event (add the event
type to `EVENT_TYPES` in `analytics/src/collect.js`).

The dashboard shows totals, visits and clicks per day, how far visitors get, the most clicked
things, projects opened, contact methods, the hero's thread links, timeline filters, scroll
depth, rage and dead clicks, referrers, countries, devices, browsers, pages, errors, a click
heatmap over the live page (desktop and phone), and the latest events.

## Privacy

No cookies and no IP addresses. A visit is a random id that exists only while the page is
open. Text typed into fields is never read. Browsers sending Do Not Track or Global Privacy
Control are skipped, bots are dropped, and events older than 395 days are deleted daily.
Visit the site once with `?notrack` to stop counting your own visits in that browser (`?track`
undoes it).

## Turning it on

1. **Cloudflare:** in the dashboard, open **Workers & Pages** once so the account gets its
   `workers.dev` subdomain. Copy the **Account ID** (shown on the account's overview page).
2. **API token:** My Profile > API Tokens > Create Token > template **Edit Cloudflare Workers**;
   add the permission **Account > D1 > Edit**; choose your account under Account Resources;
   create it and copy the token.
3. **GitHub:** in the repository, Settings > Secrets and variables > Actions > **Secrets**, add
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANALYTICS_DASHBOARD_PASSWORD` (a password
   you choose for the dashboard).
4. **Deploy:** Actions > **Deploy analytics** > Run workflow. Its summary shows the dashboard and
   collector addresses.
5. **Connect the site:** Settings > Secrets and variables > Actions > **Variables**, add
   `ANALYTICS_ENDPOINT` = the collector address (`https://personal-website-analytics.<your
   subdomain>.workers.dev/collect`). Then Actions > **Deploy to GitHub Pages** > Run workflow.

Open the dashboard address and sign in with any user name and the dashboard password.

## Working on it locally

```bash
cd analytics
npm install
npm test
```

Create `analytics/.dev.vars` (ignored by git) with local settings:

```
ALLOWED_ORIGINS=http://localhost:4173
ALLOW_HEADLESS=true
DASHBOARD_PASSWORD=local-password
SITE_URL=http://localhost:4173/
```

```bash
npm run db:init:local
```

```bash
npm run dev
```

Then build and preview the site against it from `client/`:

```bash
VITE_ANALYTICS_ENDPOINT=http://localhost:8787/collect npm run build
```

```bash
npm run preview
```

The dashboard is at http://localhost:8787/ and the site at http://localhost:4173/.
