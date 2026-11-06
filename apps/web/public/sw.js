// Forms MESRC service worker - SAFE POLICY.
// Caches ONLY versioned public static assets (/_next/static/ and /icons/).
// Never caches HTML navigations, API/Supabase responses, form answers, tickets or files.
const CACHE = "forms-mesrc-static-v1";
const scopePath = new URL(self.registration.scope).pathname;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(scopePath.length - 1);
  if (!path.startsWith("/_next/static/") && !path.startsWith("/icons/")) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});