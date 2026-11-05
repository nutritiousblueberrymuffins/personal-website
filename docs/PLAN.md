# Personal Website — Plan (approved 2026-11-05)

Status: **approved 2026-11-05** with the recommended choices, hosting changed to GitHub Pages the same day.
Phases 0 to 5 are done, except for content that needs files or facts from Tony: the resume PDF, real portrait photos, and real timeline entries (the sample entries are drafts, shown in local development only). The site is live at https://nutritiousblueberrymuffins.github.io/personal-website/. Phase 6 (polish) is next.

## Hosting change (2026-11-05)

Hosting moved from Azure Static Web Apps to **GitHub Pages**, because the Azure account has no
subscription and adding one requires a paid-upgrade step. What this changes:

- No server-side code: the Functions API (`api/`) is gone. The timeline reads its entries from
  `client/src/data/timeline.json` at build time instead of calling `GET /api/timeline`.
- The site lives at `https://nutritiousblueberrymuffins.github.io/personal-website/`. The Vite
  build takes the `/personal-website` prefix from the deploy workflow (`BASE_PATH`), so renaming the
  repo to `nutritiousblueberrymuffins.github.io` for a root URL, or adding a custom domain, needs no
  code change.
- Deploys run from `.github/workflows/deploy-pages.yml` on every push to `main`. Pages must be set
  to the GitHub Actions source once. No preview environments.
- GitHub Pages limits: 1 GB site, soft limits of 100 GB bandwidth a month and 10 builds an hour,
  free for public repositories, custom domains with free HTTPS.
- Section 3 (the Azure comparison) and the API notes in sections 4 and 6 describe the original
  plan and are kept for the record.

## 1. Goal

A personal portfolio site that is linked from the resume. It must:

- load instantly and reliably when a recruiter clicks the link (no cold starts, HTTPS, shareable URL)
- cost $0 to host (Azure free tier)
- keep a clean client/server split: a front end in `client/`, backend code in `api/`
- show: intro/hero (portrait, music player, animation showcase), projects, a **timeline** of
  work and learning so far, contact, and a link to the resume
- use the existing design: cream background `#ffead1`, red accent `#ff0808`, black text,
  Outfit variable font, red project cards (see `client/src/utils/designtoken.css`)

## 2. Decisions (accepted 2026-11-05)

| # | Decision | Recommendation | Alternative |
|---|----------|----------------|-------------|
| 1 | Hosting | **Azure Static Web Apps, Free plan** | App Service F1 running a Node server |
| 2 | Front end | **Keep vanilla HTML/CSS/JS, add Vite** for bundling and dev server | React or Astro |
| 3 | Backend | **Managed Azure Functions in `api/`** (Node 22, HTTP endpoints) | Express server on App Service F1 |
| 4 | Timeline data | **Curated `timeline.json` served by `GET /api/timeline`**, optional GitHub activity feed | Static JSON loaded directly by the client (no API) |
| 5 | Design reference | **The existing hero design already in the repo** | A Figma file or image you share |
| 6 | Music | **Replace the commercial MP3s with licensed/royalty-free tracks** before publishing | Embed Spotify/SoundCloud previews instead of hosting audio |

## 3. Why Static Web Apps Free and not App Service F1

Both are $0. The numbers below come from Microsoft's docs as of 2026-11-05.

| | Static Web Apps **Free** | App Service **F1** |
|---|---|---|
| Custom domain | 2 per app, free auto-renewing SSL | **0** (only `*.azurewebsites.net`), no custom-domain SSL |
| Compute | Static files on a global CDN; API on managed Functions (Consumption) | Shared VM, **60 CPU minutes/day**, 3 min per 5-min window |
| Idle behaviour | Static pages always served instantly; only the API can cold-start | No "Always On": app unloads when idle, first visitor waits for a cold start |
| Bandwidth | 100 GB/month included, **no overage** (site stops serving if exceeded) | 165 MB/day |
| App size | 250 MB per environment, 500 MB total | 1 GB |
| Preview environments | 3 per app (one per open pull request) | none |
| CI/CD | GitHub Actions workflow generated for you when you link the repo | manual setup |
| SLA | none | none |

Verdict: for a resume link, the page must render instantly even if nobody visited for a week.
Static Web Apps serves the HTML/CSS/JS from a CDN, so only the data call can be slow after idle,
and the page can show a fallback while it waits. App Service F1 would put the whole site behind
a cold start and cannot use a custom domain.

Note on "server renders the page": on the Free plan the backend cannot run a Node web server.
The split is: **the CDN serves the static client, the API serves data (JSON), the client renders it.**
If you ever want true server-side rendering, that means App Service (cold starts) or the
Next.js hybrid mode in Static Web Apps, which is more complexity than a portfolio needs.

## 4. Architecture

```
Browser (built from client/)                      Azure Static Web Apps (Free)
+-----------------------------+   GET /          +--------------------------------+
| index.html, CSS, JS, assets | <--------------- | Global CDN: static files        |
|                             |                  |                                |
| timeline.js ------------------> GET /api/timeline -> managed Functions (Node 22)|
|   renders cards  <------------- JSON ------------- timeline.js (reads JSON)     |
|                             |                  |   github.js (optional, cached) |
+-----------------------------+                  +--------------------------------+

GitHub repo -- push to main --> GitHub Actions --> builds client/ + api/ --> deploy
            -- open PR -------> preview environment (3 on Free)
```

Local development: the Static Web Apps CLI (`swa start`) serves the Vite dev server and the
Functions API together under one origin, so `/api/*` works exactly as in production.

### Repo layout (target)

```
personal-website/
|- client/                         # front end (Vite, vanilla JS, multi-page)
|  |- index.html                   # home: hero, projects, contact
|  |- timeline.html                # timeline page
|  |- src/
|  |  |- styles/                   # designtoken.css, animations.css, site.css
|  |  |- scripts/                  # main.js, music-player.js, showcase.js, timeline.js
|  |- public/
|  |  |- assets/                   # svg icons, vinyl.svg, portrait photos
|  |  |- music/                    # licensed tracks + covers
|  |  |- resume.pdf
|  |- staticwebapp.config.json     # routes, headers, fallback, apiRuntime node:22
|  |- package.json, vite.config.js
|- api/                            # managed Azure Functions (Node 22, v4 programming model)
|  |- src/functions/timeline.js    # GET /api/timeline
|  |- src/functions/github.js      # GET /api/github  (optional)
|  |- data/timeline.json           # the source of truth for the timeline
|  |- host.json, package.json
|- .github/workflows/azure-static-web-apps-<name>.yml   # generated by Azure on link
|- docs/PLAN.md
|- .gitignore
|- README.md
```

### Why Vite instead of plain files

The current CSS imports the Outfit font from `node_modules` by relative path. That works in
VS Code Live Preview but breaks on a real host. Vite resolves that import, hashes assets,
gives a dev server, and builds to `client/dist`, which is what the deploy uploads.
No framework is needed: the existing HTML and CSS move over almost unchanged.

## 5. Pages and sections

| Page | Sections | Notes |
|------|----------|-------|
| `/` | Hero (portrait slides, intro, socials, music player, animation showcase), Projects grid, Contact | Existing design; clear the TODO list in the HTML (mobile, SEO, BEM, a11y, music, portfolio, projects) |
| `/timeline` | Year-grouped vertical timeline with type filters | New; fed by `/api/timeline` |
| `/resume.pdf` | The resume itself | Linked from the nav and hero; the resume links back to the site |

Contact: `mailto:` plus LinkedIn/GitHub links at first. A contact form needs spam protection
and is a separate later task.

## 6. Timeline feature

Done 2026-11-05: year groups on a centre line, cards alternating sides on wide screens, type filter
chips with counts (linkable as `?type=work`), reveal on scroll that respects reduced motion, and a
`draft` flag that keeps entries off the live site. `timeline.schema.json` documents the entry shape.

Purpose: show the path so far, with work, education, certifications (CPA), projects, and
milestones on one scrollable view.

Data model (one entry in `api/data/timeline.json`):

```json
{
  "id": "cpa-license",
  "type": "certification",
  "title": "Earned CPA license",
  "org": "State board",
  "start": "2023-06",
  "end": null,
  "summary": "One or two sentences about what it was and why it mattered.",
  "tags": ["accounting"],
  "links": [{ "label": "Details", "url": "https://example.com" }]
}
```

`type` is one of `work`, `education`, `certification`, `project`, `milestone`.

API: `GET /api/timeline` returns the entries sorted by `start` descending, with
`Cache-Control: public, max-age=3600`. The function is a few lines; the value of putting it
behind the API is that the client never changes when the data source does (later: a database,
the Cosmos DB free tier, or an admin page).

Resilience: the Vite build also copies `timeline.json` into the client as a fallback, so the
page renders even if the API cold-starts or is down.

UI: vertical line, cards alternating left/right on desktop, single column on mobile; filter
chips by type; cards reveal on scroll, disabled under `prefers-reduced-motion` (the CSS
already handles that media query).

Optional later: `GET /api/github` pulls public repos/activity for
`nutritiousblueberrymuffins`, cached for an hour in the function, so coding milestones can
appear automatically.

## 7. Music player

Done 2026-11-05: the player is wired to three Kevin MacLeod tracks (CC BY 4.0, credit printed in the
player) in `client/public/music`, and the old `music/` folder of commercial tracks is removed from the
working tree (it remains in git history until a history rewrite).

What exists: `musicplayer.js` (play/pause/next/prev over an `Audio` element) and a styled but
disconnected player in the hero. The TODO says "FIX MUSIC PLAYER".

Plan: move the script into `client/src/scripts/music-player.js`, wire the hero's buttons,
progress slider and time labels, show the cover image, and start paused (browsers block
autoplay with sound).

Licensing (must be settled before the site goes public): the four tracks in `music/songs`
are commercial recordings (Kavinsky, The Weeknd, nobodyknows+). Hosting them on a public
site is copyright infringement and a bad look on a resume site. Options:

1. Royalty-free or Creative Commons tracks (Pixabay Music, Free Music Archive), credited in
   the player. Recommended.
2. Your own recordings.
3. Embed Spotify/SoundCloud players and host no audio.

Size: the folder is 41 MB. Re-encode at 128 kbps (about 1 MB per minute) and keep 3 or 4 tracks.
Audio is the only realistic way to approach the 100 GB/month bandwidth cap.

## 8. Repo hygiene (do first)

- `node_modules` is committed (14 tracked files) and there is no `.gitignore`. Add one and
  run `git rm -r --cached node_modules`.
- Branches: local has `master` and `music-player`; GitHub's default branch is `music-player`
  and `master` was never pushed. Create `main` from the merged result, push it, make it the
  default on GitHub, and let Static Web Apps deploy from `main`. Feature branches open PRs,
  which get preview environments.
- Root leftovers `test.html`, `CV.html`, `personalwebsite.js` are superseded; delete or move
  into `client/`.
- `.vscode/launch.json` is a C/C++ debug config pointing at paths that do not exist; harmless,
  but worth removing.

## 9. Phases

| Phase | Work | Done when |
|-------|------|-----------|
| 0. Hygiene | `.gitignore`, untrack `node_modules`, `main` branch, README | `git status` clean, `main` is the GitHub default |
| 1. Scaffold | Vite client from existing HTML/CSS; `api/` with `GET /api/health` and `GET /api/timeline` (sample data); `staticwebapp.config.json`; SWA CLI | `swa start` serves the site and API locally |
| 2. First deploy | GitHub Pages: deploy workflow on push to `main`, Pages source set to GitHub Actions | HTTPS URL loads and the timeline page renders |
| 3. Hero | Music player wired to licensed tracks, portrait slides, animation showcase content | Hero TODOs cleared |
| 4. Content | Real project cards, resume PDF, contact links, SEO/Open Graph meta, favicon | Resume -> site -> resume loop works |
| 5. Timeline | Real entries in `timeline.json`, designed timeline page with year groups and filters | Page renders the real entries |
| 6. Polish | Responsive QA 360 to 1440 px, a11y pass (keyboard, contrast, labels), Lighthouse 90+, optional custom domain | Scores recorded in README |

Phases 3, 4 and 5 are independent of each other once phase 1 is in.

## 10. Tooling to install

| Tool | Why | Install |
|------|-----|---------|
| Static Web Apps CLI | local dev with `/api` routing; also deploys | `npm i -D @azure/static-web-apps-cli` |
| Azure Functions Core Tools v4 | runs the API locally | `npm i -g azure-functions-core-tools@4` |
| Node 22 LTS for `api/` | managed Functions run `node:22`; local Node is 26 | pin with `.nvmrc`/`engines`, use fnm or nvm-windows |
| Azure subscription | create the Static Web App; the account must hold a subscription first (free account or Azure for Students; the Free plan costs nothing either way) | sign up at https://azure.microsoft.com/free, then the portal is enough; Azure CLI optional |

## 11. Cost

Hosting: $0 (Static Web Apps Free). GitHub Actions: free for public repos (this one is public).
Optional: a custom domain name, roughly $10 to $15 per year from a registrar; SSL is free on
Static Web Apps.

## 12. Risks

- Bandwidth cap is hard: over 100 GB/month the Free plan stops serving until the next month.
  Keep audio small; everything else is tiny.
- Managed functions cold-start after idle; the timeline page uses the bundled fallback so the
  visitor never sees an empty page.
- Node version drift between local (26) and Azure (22): pin it.
- No SLA on the Free plan; acceptable for a personal site.
- Music licensing: resolved by decision 6 above.

## 13. Sources

- Static Web Apps plans: https://learn.microsoft.com/en-us/azure/static-web-apps/plans
- Static Web Apps quotas: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas
- Managed Functions in Static Web Apps: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions
- Supported API runtimes: https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes
- App Service limits (Free column): https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits
- App Service plans overview: https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans
