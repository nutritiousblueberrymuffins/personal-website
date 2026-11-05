# Personal Website

Tony's portfolio site, built to be linked from the resume. See [docs/PLAN.md](docs/PLAN.md)
for the full plan, the hosting decision, and the phase checklist.

Status: phase 1 (scaffold) is complete. The site runs locally through the Azure Static Web
Apps emulator with a working API. Next is phase 2: the first deploy to Azure.

## Layout

| Path | What it is |
|------|------------|
| `client/` | The front end: a Vite project with plain HTML, CSS and JavaScript |
| `client/index.html` | Home page: hero, projects grid, contact |
| `client/timeline.html` | Timeline page, rendered from the API (placeholder styling until phase 5) |
| `client/src/styles/` | Design tokens (cream `#ffead1`, red `#ff0808`, Outfit font), animations, page styles |
| `client/src/scripts/` | Page scripts. `music-player.js` is not wired in yet |
| `client/public/` | Files served as they are: icons and the vinyl graphic |
| `client/staticwebapp.config.json` | Static Web Apps routing, response headers and the API runtime (Node 22) |
| `api/` | Managed Azure Functions API (Node.js, v4 programming model) |
| `api/src/functions/` | `health.js` (GET /api/health) and `timeline.js` (GET /api/timeline) |
| `api/data/timeline.json` | The timeline entries. Edit this file to change the timeline |
| `swa-cli.config.json` | Static Web Apps CLI settings for local development |
| `music/` | Placeholder tracks and covers, to be replaced with licensed tracks before the site goes public |

## Run it locally

Requirements: Node 22 and npm. The Azure Functions tooling refuses newer Node majors, so this
repo carries a `.nvmrc`. With [fnm](https://github.com/Schniz/fnm) installed
(`winget install Schniz.fnm`, then its one-time shell setup), run this in the repo folder:

```bash
fnm use
```

Any other way of getting a shell where `node -v` prints 22 works too.

Install everything from the repo root (a postinstall step also installs `client/` and `api/`):

```bash
npm install
```

Start the local stack:

```bash
npm run dev
```

This runs the Static Web Apps emulator at http://localhost:4280 with the Vite dev server behind it
and the Functions API mounted on `/api`. The first run downloads Azure Functions Core Tools.

| URL | What you get |
|-----|--------------|
| http://localhost:4280/ | Home page |
| http://localhost:4280/timeline | Timeline page |
| http://localhost:4280/api/health | `{ "status": "ok", ... }` |
| http://localhost:4280/api/timeline | Timeline entries as JSON. Add `?type=work` (or education, certification, project, milestone) to filter |

Build the client into `client/dist`:

```bash
npm run build
```

Serve the built client through the emulator together with the API, the closest thing to
production that runs locally:

```bash
npm run preview
```

`api/local.settings.json` is committed and must never hold secrets. Secrets go in the Static Web
App's application settings in the Azure portal.

## Where it is going

Azure Static Web Apps, Free plan. The client is built with Vite and served from the CDN, and the
managed Azure Functions API under `/api` serves data such as the timeline. GitHub Actions deploys
from the `main` branch, and pull requests get preview environments.
