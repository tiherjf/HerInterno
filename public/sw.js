/* Service worker da Intranet HER (PWA).
 * Estratégia conservadora para evitar servir versão desatualizada e para
 * NUNCA armazenar dados sensíveis:
 *  - /api/ e storage → nunca interceptados (sempre rede).
 *  - /_next/static/ (assets com hash, imutáveis) → cache-first.
 *  - navegação (HTML) → network-first, com cache apenas como fallback offline.
 */
const STATIC_CACHE = "her-static-v1";
const NAV_CACHE = "her-nav-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== NAV_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só mesma origem

  // Nunca cachear API nem storage (dados sensíveis / sempre atualizados)
  if (url.pathname.startsWith("/api/")) return;

  // Assets estáticos com hash → cache-first (imutáveis)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navegação → network-first (sempre a versão nova quando online),
  // cache só como fallback quando offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(NAV_CACHE);
          cache.put(req, res.clone());
          return res;
        } catch {
          const cache = await caches.open(NAV_CACHE);
          const hit = await cache.match(req);
          return hit || (await cache.match("/intranet")) || Response.error();
        }
      })(),
    );
  }
});
