// "My story": the tab in the middle of the header. Pull it down (or click it) for a short
// first-person account: a quote, then how the journey has gone so far. The words live in the
// <template id="my-story"> in index.html, so they can be edited as plain HTML; pages without it
// get no tab. The tab and drawer behaviour come from header-drawer.js; the look lives in
// site.css ("Header drawers", "My story").
//
// Until someone opens it, the tab gives a little tug every few seconds (motion.css, "The My
// story tab tugs"). Opening it once stops that for good in this browser.
import { createHeaderDrawer } from './header-drawer.js';

const story = document.getElementById('my-story');
const FOUND_KEY = 'my-story-opened';

if (story instanceof HTMLTemplateElement) {
  const markFound = () => drawer?.element.classList.add('is-found');
  const drawer = createHeaderDrawer({
    id: 'story',
    tab: 'My story',
    heading: 'My story',
    place: 'center',
    onOpen: () => {
      markFound();
      try {
        localStorage.setItem(FOUND_KEY, '1');
      } catch {}
    },
  });
  if (drawer) {
    drawer.body.append(story.content.cloneNode(true));
    try {
      if (localStorage.getItem(FOUND_KEY)) markFound();
    } catch {}
  }
}
