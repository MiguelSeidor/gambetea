/* Service worker de Gambetea (PWA). Diseñado para NO servir nunca contenido obsoleto tras un
   deploy (el bug clásico de PWA: el usuario ve el build viejo cacheado):
   - Navegaciones (HTML): network-first → siempre la versión desplegada; sólo si NO hay red se
     sirve la última página cacheada como fallback offline.
   - Todo lo demás (JS/CSS/imágenes): SIN caché del SW → el navegador lo pide normal y siempre llega
     fresco. Los chunks de Next van hasheados, así que esto no penaliza.
   Al activarse una versión nueva del SW se borran las cachés antiguas y toma el control al instante.
   Cambiar CACHE (v2, v3…) fuerza la limpieza de la caché anterior. */
const CACHE = "gambetea-v2";
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

// Permite que la página fuerce la activación del SW nuevo (ver PwaRegister).
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Solo interceptamos NAVEGACIONES (documento): network-first con fallback offline. El resto de
  // peticiones (estáticos, RSC, API) se dejan pasar sin caché → nunca obsoletas.
  if (req.mode !== "navigate") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(OFFLINE_URL, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(OFFLINE_URL)),
  );
});
