# Personal Website

Tony's portfolio site, built to be linked from the resume. See [docs/PLAN.md](docs/PLAN.md)
for the full plan, the hosting decision, and the phase checklist.

Status: phase 0 (repo hygiene) is complete. Next is phase 1: a Vite build for the client and
a managed Azure Functions API.

## What is here today

| Path | What it is |
|------|------------|
| `client/public/personalwebsite.html` | The home page: hero, projects grid, contact |
| `client/src/utils/*.css` | Design tokens (cream `#ffead1`, red `#ff0808`, Outfit font), animations, page styles |
| `client/public/assets/` | SVG icons and the vinyl graphic |
| `musicplayer.js` | Play/pause/next/previous logic; not yet wired into the page |
| `music/` | Placeholder tracks and covers. These get replaced with licensed tracks before the site goes public. |
| `docs/PLAN.md` | The plan |

## Run it locally (today)

There is no build step yet.

1. `npm install` (the Outfit font is loaded from `node_modules`)
2. Open `client/public/personalwebsite.html` with the VS Code Live Preview extension. The
   workspace settings already point Live Preview at that file.

## Where it is going

Azure Static Web Apps, Free plan. The client is built with Vite and served from the CDN, and a
managed Azure Functions API under `/api` serves data such as the timeline. GitHub Actions
deploys from the `main` branch, and pull requests get preview environments.
