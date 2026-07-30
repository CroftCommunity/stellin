// sw.js — app-shell caching. Cache-first with a versioned cache name.
// Bump CACHE_VERSION on every deploy. Skip with ?nosw (handled in app.js by
// not registering) — the SW itself also honors a bypass query on requests.
const CACHE_VERSION = 'meridian-shell-v1';
const SHELL = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/storage.js',
  './js/actions.js',
  './js/latency.js',
  './js/chrome.js',
  './js/devbar.js',
  './js/frontier.js',
  './data/seed.js',
  './js/engines/degrees.js',
  './js/engines/pymk.js',
  './js/engines/feedrank.js',
  './js/engines/search.js',
  './js/engines/notify.js',
  './js/engines/ratelimit.js',
  './js/ui/dom.js',
  './js/ui/avatar.js',
  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/tabs.js',
  './js/ui/skeleton.js',
  './js/ui/degreeBadge.js',
  './js/ui/reactionPicker.js',
  './js/ui/hoverCard.js',
  './js/ui/frontierChip.js',
  './js/ui/postCard.js',
  './js/ui/composer.js',
  './js/ui/media.js',
  './js/ui/imagePipeline.js',
  './js/ui/entityTypeahead.js',
  './js/ui/pymkModule.js',
  './js/screens/feed.js',
  './js/screens/profile.js',
  './js/screens/profileEdit.js',
  './js/screens/network.js',
  './js/screens/jobs.js',
  './js/screens/employer.js',
  './js/screens/messaging.js',
  './js/screens/notifications.js',
  './js/screens/search.js',
  './js/screens/settings.js',
  './js/screens/company.js',
  './js/screens/onboarding.js',
  './js/screens/loggedOut.js',
  './js/screens/frontiers.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.search.includes('nosw')) return; // bypass
  // cache-first for same-origin app shell; fall back to network, then shell.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
