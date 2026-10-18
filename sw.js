const CACHE_VERSION = "safak-v2";
// Ağ bu süre içinde yanıt vermezse önbellekteki kopya gösterilir (zayıf çekim için).
const NETWORK_TIMEOUT_MS = 3000;
const PRECACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/quotes.js",
  "./manifest.webmanifest",
  "./img/background.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "no-cache" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Önce ağ: güncel dosya varsa onu getir ve önbelleği tazele; ağ yoksa ya da geç kalırsa önbellek.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(networkFirst(event));
});

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_VERSION);
  // Gezinme istekleri RequestInit ile kopyalanamadığı için URL üzerinden istenir.
  const network = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((resp) => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  });
  event.waitUntil(network.catch(() => {}));

  const cached = await cache.match(req, { ignoreSearch: true });
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}
