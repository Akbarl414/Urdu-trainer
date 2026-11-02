// Service worker TEMPLATE. vite.config.js replaces the two placeholders below
// at build time and emits the result as dist/sw.js.
//
// Rules (CLAUDE.md, "Shared origin"):
//  * The German app lives on the same origin, so every cache we create is
//    named `urdu-trainer-…` and we only ever delete caches that start with
//    `urdu-trainer-static-` and aren't the current one. We never delete
//    anything else. Never use the all-caches lookup on `caches` itself: always open one of
//    our own caches and match inside it.
//  * We only answer fetches inside our own scope (this repo's path).
//  * A new version installs and WAITS. The page shows "Update available —
//    Reload" and posts SKIP_WAITING. We never touch storage (we can't).

const BUILD_ID = '__BUILD_ID__';
const PRECACHE = __PRECACHE__; // paths relative to the scope, e.g. 'index.html', 'assets/index-abc.js'

const STATIC_PREFIX = 'urdu-trainer-static-';
const STATIC_CACHE = STATIC_PREFIX + BUILD_ID;
const FONTS_CACHE = 'urdu-trainer-fonts-v1'; // survives app updates; font files are content-hashed/versioned by name
const AUDIO_CACHE = 'urdu-trainer-audio-v1'; // filled on first play

const SCOPE = self.registration.scope; // ends with '/'
const INDEX_URL = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const fontsCache = await caches.open(FONTS_CACHE);
      for (const path of PRECACHE) {
        const url = new URL(path, SCOPE).href;
        if (path.startsWith('fonts/')) {
          if (!(await fontsCache.match(url))) await fontsCache.add(url);
        } else {
          await staticCache.add(url);
        }
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(STATIC_PREFIX) && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(SCOPE)) return; // not ours (other apps on this origin, other origins)
  const rel = url.href.slice(SCOPE.length);

  if (request.mode === 'navigate') {
    event.respondWith(fromCache(STATIC_CACHE, INDEX_URL).then((hit) => hit || fetch(request)));
    return;
  }
  if (rel.startsWith('fonts/')) {
    event.respondWith(cacheFirst(FONTS_CACHE, request));
    return;
  }
  if (rel.startsWith('audio/')) {
    if (request.headers.has('range')) return; // partial responses aren't cacheable; let the network handle them
    event.respondWith(cacheFirst(AUDIO_CACHE, request));
    return;
  }
  event.respondWith(cacheFirst(STATIC_CACHE, request));
});

async function fromCache(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request, { ignoreSearch: true });
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.status === 200) cache.put(request, response.clone());
  return response;
}
