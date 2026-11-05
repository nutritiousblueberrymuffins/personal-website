# Personal Website

Tony's portfolio site, built to be linked from the resume. See [docs/PLAN.md](docs/PLAN.md)
for the plan, the hosting decisions, and the phase checklist.

Hosting: GitHub Pages, deployed by GitHub Actions on every push to `main`.
Live site: https://nutritiousblueberrymuffins.github.io/personal-website/

## Layout

| Path | What it is |
|------|------------|
| `client/` | The site: a Vite project with plain HTML, CSS and JavaScript |
| `client/index.html` | Home page: hero, projects grid, contact |
| `client/timeline/index.html` | Timeline page (placeholder styling until phase 5) |
| `client/404.html` | Not-found page, served by GitHub Pages for unknown URLs |
| `client/src/data/timeline.json` | The timeline entries. Edit this file to change the timeline |
| `client/src/data/tracks.json` | The music player's track list and credits |
| `client/src/styles/` | Design tokens (cream `#ffead1`, red `#ff0808`, Outfit font), animations, page and hero styles |
| `client/src/scripts/` | Page scripts: the hero's music player, portrait slides and animation showcase, and the timeline page |
| `client/public/` | Files served as they are: icons, the vinyl graphic, placeholder portraits, audio |
| `client/public/music/` | The audio files: three tracks by Kevin MacLeod, licensed CC BY 4.0 |
| `.github/workflows/deploy-pages.yml` | Builds the client and publishes `client/dist` to GitHub Pages |

## Run it locally

Requirements: Node 22 or newer and npm. Install from the repo root (a postinstall step also
installs `client/`):

```bash
npm install
```

Start the dev server at http://localhost:5173/ :

```bash
npm run dev
```

| URL | What you get |
|-----|--------------|
| http://localhost:5173/ | Home page |
| http://localhost:5173/timeline/ | Timeline page |

Build the site into `client/dist`:

```bash
npm run build
```

Serve the built site at http://localhost:4173/ :

```bash
npm run preview
```

## Swapping in your own content

- **Portraits:** put photos in `client/public/assets/portraits/` and point the three `<img>` tags
  of the portrait carousel in `client/index.html` at them. Any size works; they are cropped to
  the frame.
- **Music:** add files to `client/public/music/` and describe them in `client/src/data/tracks.json`.
  Keep the artist and license fields accurate: the player prints them as the credit, which the
  current CC BY 4.0 tracks require.
- **Timeline:** edit `client/src/data/timeline.json`.
- **Projects and contact details:** the project cards, the email link and the GitHub links are plain
  markup in `client/index.html`.
- **Resume:** put `resume.pdf` in `client/public/` and add a link such as
  `<a class="resume-button" href="/resume.pdf">Resume</a>` under the hero's social links in
  `client/index.html`; the button style already exists in `site.css`.

## How deploys work

The workflow in `.github/workflows/deploy-pages.yml` runs on every push to `main`: it builds the
client with Node 22 and publishes `client/dist` to GitHub Pages. One-time setting on GitHub:
Settings, Pages, Build and deployment, Source: GitHub Actions. Until that is set, the workflow's
Configure Pages step fails.

GitHub Pages serves a project site under `/personal-website/`. The workflow passes that prefix to
the build as `BASE_PATH`, so asset and page links come out right. Renaming the repo to
`nutritiousblueberrymuffins.github.io` (which gives a root URL) or adding a custom domain needs no
code change. To test the prefixed build locally, pass the same prefix to Vite directly:

```bash
npm run build -- --base /personal-website/
```

```bash
npm run preview -- --base /personal-website/
```

The preview then serves the site at http://localhost:4173/personal-website/ .
