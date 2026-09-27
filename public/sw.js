/* Pari AI service worker.
 * App-shell caching for fast loads + push notifications for reminders.
 * No offline chat: chat needs the network, and this worker never pretends otherwise.
 */
const CACHE_VERSION = 'pari-ai-v1';
const APP_SHELL = ['/', '/index.html'];

// Assets are hashed by Vite, so they are safe to cache aggressively.
function isAppAsset(url) {
  const p = new URL(url).pathname;
  return p.startsWith('/assets/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShell =
    url.pathname === '/' || url.pathname === '/index.html' || isAppAsset(url);
  if (!isShell) return; // API calls and everything else go straight to the network.

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Promise.reject(new Error('offline')));
      return cached || networked;
    }),
  );
});

self.addEventListener('push', (event) => {
  let title = 'Pari AI';
  let options = {
    body: 'You have a reminder.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: '/' },
  };
  try {
    if (event.data) {
      const payload = event.data.json();
      if (payload.title) title = String(payload.title);
      options = {
        ...options,
        ...(payload.body ? { body: String(payload.body) } : {}),
        ...(payload.url ? { data: { url: String(payload.url) } } : {}),
        ...(payload.tag ? { tag: String(payload.tag) } : {}),
      };
    }
  } catch (_) {
    // fall back to the defaults above
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      }),
  );
});
