// A small easter egg on every page: a mug button fixed in the bottom-left corner. Clicking it
// slides "The Office x LinkedIn" banner, full width, up from the bottom edge of the screen
// (about 350 ms, ease-out, slide only); the slide ends as the whole banner comes into view. A
// 9-second Michael Scott clip starts at the same moment. Clicking anywhere or pressing Escape
// slides it back down and stops the sound. The look lives in site.css ("Office easter egg");
// the files are in public/assets/office/.

const base = import.meta.env.BASE_URL;
const IMAGE = `${base}assets/office/the-office-linkedin.webp`;
const CLIP = `${base}assets/office/no-god-no.mp3`;

const MUG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
  + '<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
  + '<path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" stroke="currentColor" stroke-width="1.6"/>'
  + '<path d="M8 2.5c-.6.8-.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  + '</svg>';

const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'office-toggle';
toggle.setAttribute('aria-label', 'Play a clip from The Office');
toggle.setAttribute('aria-expanded', 'false');
toggle.setAttribute('aria-controls', 'office-overlay');
toggle.title = 'Psst.';
toggle.innerHTML = MUG;

const overlay = document.createElement('div');
overlay.className = 'office-overlay';
overlay.id = 'office-overlay';
overlay.inert = true;
overlay.innerHTML = `<img class="office-overlay__banner" src="${IMAGE}" alt="The cast of The Office in their work clothes, beside the show's logo, an x, and the LinkedIn logo." width="1400" height="350">`;

document.body.append(overlay, toggle);

// The mug jingles (motion.css) until it's been found. Remembered in this browser, so a returning
// visitor isn't nudged again; if storage is blocked it simply keeps jingling.
const FOUND_KEY = 'office-mug-found';
try {
  if (localStorage.getItem(FOUND_KEY)) toggle.classList.add('is-found');
} catch {}

let audio = null;
const isOpen = () => overlay.classList.contains('is-open');

function open() {
  // Made on first use, so the clip only downloads if someone asks for it. Started in the same
  // click as the slide, so it plays as the banner comes up.
  audio ??= new Audio(CLIP);
  audio.currentTime = 0;
  audio.play().catch(() => {});

  overlay.inert = false;
  overlay.classList.add('is-open');
  toggle.setAttribute('aria-expanded', 'true');

  toggle.classList.add('is-found');
  try {
    localStorage.setItem(FOUND_KEY, '1');
  } catch {}
}

function close() {
  audio?.pause();
  overlay.classList.remove('is-open');
  overlay.inert = true;
  toggle.setAttribute('aria-expanded', 'false');
}

// The mug's own click mustn't reach the page-wide listener below, or it would close the banner
// the moment it opened.
toggle.addEventListener('click', (event) => {
  event.stopPropagation();
  if (isOpen()) close();
  else open();
});

// While it's up, a click anywhere on the page (the banner included) closes it.
document.addEventListener('click', () => {
  if (isOpen()) close();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isOpen()) close();
});
