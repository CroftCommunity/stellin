// app.js — bootstrap: store init, chrome, dev-bar, router registration.
import * as store from './store.js';
import * as router from './router.js';
import { renderChrome } from './chrome.js';
import { renderDevbar, setHardRerender } from './devbar.js';
import { me } from './actions.js';

import feed from './screens/feed.js';
import profile from './screens/profile.js';
import network from './screens/network.js';
import jobs from './screens/jobs.js';
import employer from './screens/employer.js';
import messaging from './screens/messaging.js';
import notifications from './screens/notifications.js';
import searchScreen from './screens/search.js';
import settings from './screens/settings.js';
import company from './screens/company.js';
import onboarding from './screens/onboarding.js';
import loggedOut from './screens/loggedOut.js';
import frontiers from './screens/frontiers.js';

store.init();
router.mount(document.getElementById('app-root'));

// ---- routes ----
router.register('#/', (o, c) => root(o, c), 'Meridian');
router.register('#/feed', feed, 'Home · Meridian');
router.register('#/join', onboarding, 'Join Meridian');
router.register('#/me', (o, c) => { const id = me(); if (!id) return loggedOut(o, c); location.hash = '#/in/' + store.sel.user(id).slug; }, 'Your profile · Meridian');
router.register('#/in/:slug', profile, (c) => `${c.params.slug} · Meridian`);
router.register('#/network', network, 'My network · Meridian');
router.register('#/jobs', jobs, 'Jobs · Meridian');
router.register('#/employer', employer, 'Hiring · Meridian');
router.register('#/messaging', messaging, 'Messaging · Meridian');
router.register('#/notifications', notifications, 'Notifications · Meridian');
router.register('#/search', searchScreen, 'Search · Meridian');
router.register('#/settings', settings, 'Settings · Meridian');
router.register('#/company/:slug', company, (c) => `${c.params.slug} · Meridian`);
router.register('#/frontiers', frontiers, 'Frontiers · Meridian');
router.setNotFound((o) => root(o, {}));

function root(outlet, ctx) {
  // '#/' — logged out sees the public teaser; logged in goes to the feed.
  if (me()) { location.hash = '#/feed'; return; }
  return loggedOut(outlet, ctx);
}

// ---- chrome + devbar ----
renderDevbar();
renderChrome();
setHardRerender(() => { renderDevbar(); renderChrome(); router.rerender(); });

// Re-render chrome (badges) on every store change. Re-render the current
// route too, unless the user is mid-typing inside it (avoids wiping inputs).
let scheduled = false;
store.subscribe(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderChrome();
    const active = document.activeElement;
    const editing = active && active.closest && active.closest('#app-root') &&
      (active.matches('input, textarea, [contenteditable="true"]'));
    if (!editing) router.rerender();
  });
});

window.addEventListener('meridian:navigated', () => { renderChrome(); });
window.addEventListener('meridian:storage-full', () => {
  import('./ui/toast.js').then(({ toast }) => toast('Storage is full. Export and trim your data, or Delete All.', { type: 'danger' }));
});

// ---- service worker (registered last; bypassed with ?nosw or devPref) ----
if ('serviceWorker' in navigator && !location.search.includes('nosw') && !store.getDevPrefs().swBypass) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

router.start();
