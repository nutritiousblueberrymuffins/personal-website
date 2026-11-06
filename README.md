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
| `client/timeline/index.html` | Timeline page: year groups, type filters, reveal on scroll |
| `client/404.html` | Not-found page, served by GitHub Pages for unknown URLs |
| `client/src/data/timeline.json` | The timeline entries. Edit this file to change the timeline |
| `client/src/data/timeline.schema.json` | What an entry may contain; editors use it to validate `timeline.json` |
| `client/src/data/tracks.json` | The music player's track list and credits |
| `client/src/styles/` | Design tokens (cream `#ffead1`, red `#ff0808`, Outfit font), animations, page and hero styles |
| `client/src/scripts/` | Page scripts: the hero's music player, portrait slides and animation showcase, and the timeline page |
| `client/public/` | Files served as they are: icons, the vinyl graphic, placeholder portraits, audio, `sitemap.xml` |
| `client/public/music/` | The audio files: three tracks by Kevin MacLeod, licensed CC BY 4.0 |
| `client/public/og-image.png` | The 1200 x 630 preview image that chat apps and social sites show for links to the site |
| `docs/sharing-image/` | The HTML the preview image and the touch icon are rendered from |
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
  the frame. Around 1100 px wide as JPEG or WebP keeps the page fast, and the `alt` text should
  say what the photo shows.
- **Sharing image and touch icon:** `docs/sharing-image/og.html` and `icon.html` are the sources.
  After changing the name or tagline, re-render them with Chrome and copy the results over
  `client/public/og-image.png` and `client/public/apple-touch-icon.png`:

  ```bash
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --allow-file-access-from-files --force-device-scale-factor=1 --hide-scrollbars --virtual-time-budget=8000 --window-size=1200,630 --screenshot=client\public\og-image.png docs\sharing-image\og.html
  ```
- **Music:** add files to `client/public/music/` and describe them in `client/src/data/tracks.json`.
  Keep the artist and license fields accurate: the player prints them as the credit, which the
  current CC BY 4.0 tracks require.
- **Timeline:** edit `client/src/data/timeline.json`. Each entry has a type (work, education,
  certification, project or milestone), a start date and optionally an end date, a summary, tags
  and links; `timeline.schema.json` spells out the rules. An entry with `"draft": true` shows in
  local development only, never on the live site, so samples and unfinished items can stay in the
  file. Filters can be linked to directly, for example `/timeline/?type=work`.
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
change to the build; only the absolute URLs need updating: the canonical, `og:url` and `og:image`
tags in the two pages' `<head>`, `client/public/sitemap.xml`, and the address printed on the
sharing image. To test the prefixed build locally, pass the same prefix to Vite directly:

```bash
npm run build -- --base /personal-website/
```

```bash
npm run preview -- --base /personal-website/
```

The preview then serves the site at http://localhost:4173/personal-website/ .

## Quality checks

The polish pass (2026-11-06) checked the live site with Lighthouse 13.6, a layout sweep from 320
to 1440 px in headless Chrome, and a keyboard walkthrough of both pages. Lighthouse scores on the
live site, mobile / desktop:

| Page | Performance | Accessibility | Best practices | SEO |
|------|-------------|---------------|----------------|-----|
| Home | 99 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| Timeline | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |

Mobile performance moves a point or two between runs, because it is a throttled simulation; the
other scores are stable. What the pass covers:

- **Layout** from 320 to 1440 px: no horizontal overflow on any page; the header keeps one row
  down to 501 px and stacks below that; the project grid becomes one column below 761 px; the
  timeline moves its line to the left below 901 px.
- **Keyboard:** a "Skip to content" link is the first Tab stop on every page, every control shows
  a 3 px focus ring, only the selected portrait dot is in the Tab order (the arrow keys choose the
  others), and the player, showcase buttons, project cards, filters and links are all reachable.
- **Contrast** (WCAG AA): the brand red is `#e60000`, small red text uses `#c00000` and secondary
  text uses `#625d5b`; the ratios are noted in `client/src/styles/designtoken.css`.
- **Motion:** with "reduce motion" switched on, nothing animates and every element shows its final
  state.
- **Sharing:** the Open Graph tags point at `og-image.png`; paste the site URL into a chat app or a
  social post to see the card.

To run Lighthouse again (it uses the installed Chrome and opens the report in the browser):

```bash
npx lighthouse https://nutritiousblueberrymuffins.github.io/personal-website/ --view
```

```bash
npx lighthouse https://nutritiousblueberrymuffins.github.io/personal-website/timeline/ --preset=desktop --view
```

https://pagespeed.web.dev/ runs the same audit on Google's machines, with no install.

Two informational notes in the report cannot be acted on with GitHub Pages: it does not allow
custom response headers, so there is no Content-Security-Policy or HSTS header, and it serves every
file with a ten-minute cache lifetime. Neither affects the scores.
