// Site-wide entry point, loaded by every page.

// Loads the Inter variable font (weights 100-900); Vite bundles the font files.
import '@fontsource-variable/inter/wght.css';
// Our own visitor analytics (analytics.js and the analytics/ collector); off unless
// VITE_ANALYTICS_ENDPOINT is set at build time.
import './analytics.js';

// Links marked data-home-link always point at the site root, whatever base path the site is
// deployed under (for example /personal-website/ on GitHub Pages). The 404 page needs this
// because it can be served at any depth.
for (const link of document.querySelectorAll('[data-home-link]')) {
  link.href = import.meta.env.BASE_URL;
}
