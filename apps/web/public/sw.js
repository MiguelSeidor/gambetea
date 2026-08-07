/* Service worker de Gambetea (PWA). Conservador a propósito:
   - Navegaciones (HTML): network-first → siempre HTML fresco tras un deploy; si no hay red,
     se sirve la última página cacheada como fallback offline.
   - Estáticos same-origin (JS/CSS/img con nombre hasheado): cache-first + revalidación.
   - NO tocamos peticiones cross-origin (la API y los escudos viven en otro dominio) ni no-GET.
   Los chunks de Next van hasheados, así que cachear no deja JS obsoleto: el HTML nuevo apunta a
   URLs nuevas. */
const CACHE = "gambetea-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API/CDN externos: sin intervención

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(OFFLINE_URL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached),
    ),
  );
});
