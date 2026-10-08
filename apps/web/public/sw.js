// Cache only the offline fallback. Never cache authenticated pages, API data or documents.
const CACHE = 'loma-public-v1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('/offline.html')),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode !== 'navigate' ||
    event.request.method !== 'GET' ||
    url.origin !== location.origin ||
    /^\/(app|customer|request|login|auth|platform)(\/|$)/.test(url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/offline.html')),
  );
});
