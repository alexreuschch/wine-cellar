/* Wine Cellar service worker: keeps the app working offline and updates it in the background. */
const SHELL_CACHE = 'wc-shell-v102';
const RUNTIME_CACHE = 'wc-runtime-v1';
const SHELL = ['./', './index.html', './geo.js', './app.js', './cellar.js', './ai.js', './views.js', './profile.js', './sheets.js', './form.js', './settings.js', './taste.js', './hints.js', './actions.js', './styles.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => (k.startsWith('wc-shell-') && k !== SHELL_CACHE) || (k.startsWith('wc-runtime-') && k !== RUNTIME_CACHE))
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
    return;
  }
  const h = url.hostname;
  if (h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com' || h === 'cdn.jsdelivr.net' || h === 'docs.opencv.org') {
    e.respondWith(cacheFirst(req));
  }
  // Everything else (your Google Apps Script) always goes to the network.
});

/* App files: always try the newest version first, so updates show on the next start.
   Without a connection, or if the network takes longer than 4 seconds, the saved copy is used. */
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
  } catch (e) { /* offline or slow: fall back to the saved copy */ }
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === 'navigate') {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return Response.error();
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}
