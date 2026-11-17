// Header drawers: a thin tab hanging from the header that opens a drawer underneath it. Used by
// "My story" (my-story.js, in the middle) and "Site stats" (header-stats.js, on the right).
//
// Pull the tab down (or click it) to open; push it back up, click it, the close button, Escape,
// or a click elsewhere to close. The tab rides on the drawer's bottom edge. Opening one drawer
// closes any other. The look lives in site.css ("Header drawers").

// How far a tab must be dragged before it counts as a pull rather than a click.
const PULL_PX = 24;
const CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOSE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const drawers = new Set();

/**
 * @param {object} options
 * @param {string} options.id         Base for element ids, e.g. "stats".
 * @param {string} options.tab        The tab's text, e.g. "Site stats".
 * @param {string} options.heading    The small label at the top of the drawer.
 * @param {'center'|'right'} options.place
 * @param {string} [options.footer]   Markup for a note under the body.
 * @param {() => void} [options.onOpen]
 * @returns {{ body: HTMLElement, inner: HTMLElement, setOpen: (open: boolean) => void } | null}
 */
export function createHeaderDrawer({ id, tab, heading, place, footer = '', onOpen }) {
  const host = document.querySelector('.site-header .container');
  if (!host) {
    return null;
  }

  const drawer = document.createElement('div');
  drawer.className = `header-drawer header-drawer--${place}`;
  drawer.innerHTML = `
    <div class="header-drawer__panel" id="${id}-panel" role="region" aria-label="${heading}" inert>
      <div class="header-drawer__inner">
        <div class="header-drawer__head">
          <p class="label-section">${heading}</p>
          <button class="header-drawer__close" type="button" aria-label="Close ${tab.toLowerCase()}">${CLOSE}</button>
        </div>
        <div class="header-drawer__body" aria-live="polite"></div>
        ${footer}
      </div>
    </div>
    <button class="header-tab" type="button" aria-expanded="false" aria-controls="${id}-panel">
      <span class="header-tab__grip" aria-hidden="true"></span>
      <span class="header-tab__label">${tab}</span>${CHEVRON}
    </button>`;
  host.append(drawer);

  const panel = drawer.querySelector('.header-drawer__panel');
  const inner = drawer.querySelector('.header-drawer__inner');
  const body = drawer.querySelector('.header-drawer__body');
  const handle = drawer.querySelector('.header-tab');
  const closeButton = drawer.querySelector('.header-drawer__close');
  const isOpen = () => drawer.classList.contains('is-open');

  function setOpen(open) {
    if (open) {
      // Only one drawer at a time.
      for (const other of drawers) {
        if (other !== api) other.setOpen(false);
      }
    }
    drawer.classList.toggle('is-open', open);
    panel.inert = !open;
    handle.setAttribute('aria-expanded', String(open));
    handle.setAttribute('aria-label', `${open ? 'Close' : 'Open'} ${tab.toLowerCase()}`);
    if (open) {
      inner.scrollTop = 0;
      onOpen?.();
    }
  }

  // ---------- Pull, click, Escape, click elsewhere ----------

  let drag = null;
  let pulled = false;
  handle.addEventListener('pointerdown', (event) => {
    drag = { y: event.clientY, id: event.pointerId };
    pulled = false;
    // Pointer capture keeps the drag going if the pointer slips off the thin tab.
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {}
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dy = event.clientY - drag.y;
    if (!isOpen() && dy > PULL_PX) {
      pulled = true;
      drag = null;
      setOpen(true);
    } else if (isOpen() && dy < -PULL_PX) {
      pulled = true;
      drag = null;
      setOpen(false);
    }
  });
  const endDrag = () => { drag = null; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  handle.addEventListener('click', () => {
    // A pull already opened or closed it; the click that ends it shouldn't undo that.
    if (pulled) {
      pulled = false;
      return;
    }
    setOpen(!isOpen());
  });
  closeButton.addEventListener('click', () => {
    setOpen(false);
    handle.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      handle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !drawer.contains(event.target)) {
      setOpen(false);
    }
  });

  const api = { element: drawer, body, inner, setOpen };
  drawers.add(api);
  return api;
}
