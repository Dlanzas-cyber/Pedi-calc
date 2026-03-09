/* PediCode Service Worker — v3.6 */
/* Estrategia: network-first para HTML (siempre recibe actualizaciones),
   cache-first para assets estáticos (iconos, manifest) */

const CACHE = 'pedicode-v3.6';

const HTML_FILES = [
  './index.html',
  './',
];

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* ── INSTALL: pre-cache assets ───────────────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([...HTML_FILES, ...STATIC_ASSETS])
    )
  );
  self.skipWaiting();
});

/* ── ACTIVATE: eliminar caches viejas ────────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => {
            console.log('[SW] Borrando cache antigua:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH ────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  /* NAVEGACIÓN (HTML): network-first
     Siempre intenta red primero → el usuario recibe siempre la última versión.
     Solo usa cache si está offline. */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  /* ASSETS ESTÁTICOS (iconos, manifest): cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});

/* ── MESSAGE: forzar actualización desde la página ───────────────────── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
