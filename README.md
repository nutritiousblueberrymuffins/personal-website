# Personal Website

Tony's portfolio site, built to be linked from the resume. See [docs/PLAN.md](docs/PLAN.md)
for the plan, the hosting decisions, and the phase checklist.

Hosting: GitHub Pages, deployed by GitHub Actions on every push to `main`.
Live site: https://nutritiousblueberrymuffins.github.io/personal-website/

## Layout

| Path | What it is |
|------|------------|
| `client/` | The site: a Vite project with plain HTML, CSS and JavaScript |
| `client/index.html` | The one-page site: hero with the thread links, about, projects, timeline, contact |
| `client/timeline/index.html` | Forwards old `/timeline/` links to the home page's timeline, keeping any filter |
| `client/404.html` | Not-found page, served by GitHub Pages for unknown URLs |
| `client/src/data/timeline.json` | The timeline entries. Edit this file to change the timeline |
| `client/src/data/timeline.schema.json` | What an entry may contain; editors use it to validate `timeline.json` |
| `client/src/styles/` | Threadline design tokens (navy `#273b70` on white, Inter font), page and component styles, motion preferences |
| `client/src/scripts/` | `main.js` (font, shared links) and `timeline.js` (renders and filters the timeline) |
| `client/public/` | Files served as they are: the icons from Figma, the favicon, `sitemap.xml` |
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
| http://localhost:5173/ | The site; in development the timeline also shows the draft sample entries |

Build the site into `client/dist`:

```bash
npm run build
```

Serve the built site at http://localhost:4173/ :

```bash
npm run preview
```

## Swapping in your own content

- **Photo:** put the photo in `client/public/assets/` and add
  `<img src="/assets/your-photo.jpg" alt="Tony Nguyen">` as the first child of the hero's
  `.photo` frame in `client/index.html`. It is cropped to fill the 400 x 480 frame, under the name
  tag. Around 800 px wide as JPEG or WebP keeps the page fast.
- **Resume:** put `resume.pdf` in `client/public/` and remove `hidden` from the header's
  "Resume" link and the hero's "Download resume" button in `client/index.html`.
- **LinkedIn and phone:** the links are already in `client/index.html` (hero links and contact
  cards) but hidden. Fill in the URL or `tel:` number and the shown value, then remove `hidden`.
- **Timeline:** edit `client/src/data/timeline.json`. Each entry has a type (work, education,
  certification, project or milestone), a start date and optionally an end date;
  `timeline.schema.json` spells out the rules. The cards show the date, title and type; a
  full date (`2026-10-09`) also prints the day on the line, a year or month prints the year. An
  entry with `"draft": true` shows in local development only, never on the live site, so samples
  and unfinished items can stay in the file. Filters can be linked to directly, for example
  `/?type=work#timeline`; old `/timeline/` links forward there.
- **Projects and contact details:** the project cards, the email link and the GitHub links are plain
  markup in `client/index.html`.
- **Sharing image and touch icon:** `docs/sharing-image/og.html` and `icon.html` are the sources
  of `client/public/og-image.png` and `apple-touch-icon.png`. They still show the previous cream
  and red design and need redrawing in the Threadline style; then re-render them with Chrome:

  ```bash
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --allow-file-access-from-files --force-device-scale-factor=1 --hide-scrollbars --virtual-time-budget=8000 --window-size=1200,630 --screenshot=client\public\og-image.png docs\sharing-image\og.html
  ```

## The design

The site follows the Figma file "Tony — Personal website (Threadline style)": navy on white, Inter
throughout, hairline borders, 10 px cards, and one thread line that everything hangs on.
`client/src/styles/designtoken.css` holds the colours, spacing and text styles under the Figma
names; `site.css` builds the components (event, project and contact cards, buttons, filter chips,
the thread) and the page. One difference from Figma: secondary text uses `#687482` instead of
`#74808e`, which is too light on white for WCAG AA at caption sizes.

Behind every page a dot grid drifts slowly to the right (224 px every 30 s, constant speed) and
fades between 90% and 50%, like the Figma prototype; the dots are 2.5 px rather than Figma's 2 px
at 60% to 30%, which were too faint to notice on real screens. It is one fixed, window-sized layer
animated with `transform` and `opacity` only, so it stays smooth on phones and desktops, and it
stands still for visitors who ask for reduced motion.

The layout is fluid: gutters, section spacing, headings, the photo and the gaps between cards
scale with the window (via `clamp()` in `designtoken.css` and `site.css`), reaching the Figma
sizes at 1440 px. Above 1440 px the whole page scales up with the window, like zooming the
Figma frame: sizes are in `rem`, and the root size grows from 16 px at 1440 px to 28.44 px at
2560 px, so big monitors and a zoomed-out browser keep the design's proportions instead of a
narrow column with wide margins. Hairline borders and the 2 px thread line stay in pixels. The project grid fits as many 300 px columns as there is room for. Below 900 px
the thread turns vertical and the photo and about panel move under their text; below 640 px the
header stacks. Checked from 320 to 1920 px in 10 px steps and on iPhone, Pixel and iPad
emulation: no sideways scrolling and nothing cut off.

## How deploys work

The workflow in `.github/workflows/deploy-pages.yml` runs on every push to `main`: it builds the
client with Node 22 and publishes `client/dist` to GitHub Pages. One-time setting on GitHub:
Settings, Pages, Build and deployment, Source: GitHub Actions. Until that is set, the workflow's
Configure Pages step fails.

GitHub Pages serves a project site under `/personal-website/`. The workflow passes that prefix to
the build as `BASE_PATH`, so asset and page links come out right. Renaming the repo to
`nutritiousblueberrymuffins.github.io` (which gives a root URL) or adding a custom domain needs no
change to the build; only the absolute URLs need updating: the canonical, `og:url` and `og:image`
tags in `client/index.html`, the canonical in `client/timeline/index.html`,
`client/public/sitemap.xml`, and the address printed on the
sharing image. To test the prefixed build locally, pass the same prefix to Vite directly:

```bash
npm run build -- --base /personal-website/
```

```bash
npm run preview -- --base /personal-website/
```

The preview then serves the site at http://localhost:4173/personal-website/ .

## Quality checks

These checks and scores are from the polish pass of the previous design (2026-11-06); run them
again once the Threadline redesign is live. That pass checked the live site with Lighthouse 13.6,
a layout sweep from 320 to 1440 px in headless Chrome, and a keyboard walkthrough of both pages.
Lighthouse scores on the live site, mobile / desktop:

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
npx lighthouse https://nutritiousblueberrymuffins.github.io/personal-website/ --preset=desktop --view
```

https://pagespeed.web.dev/ runs the same audit on Google's machines, with no install.

Two informational notes in the report cannot be acted on with GitHub Pages: it does not allow
custom response headers, so there is no Content-Security-Policy or HSTS header, and it serves every
file with a ten-minute cache lifetime. Neither affects the scores.
