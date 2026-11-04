/* Bump this version whenever HTML, CSS, JavaScript, or vendor assets change. */
const CACHE_PREFIX = 'btime-';
const CACHE_VERSION = 'v14';
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-static`;
const FONT_CACHE = `${CACHE_PREFIX}fonts-v1`;
const APP_SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/assets/css/style.css',
  '/assets/js/app.js', '/assets/js/pwa.js',
  '/assets/Images/Logo/BtimeLogo-clean.png',
  '/assets/Images/Logo/Favicon%20Assets/favicon.ico',
  '/assets/Images/Logo/Favicon%20Assets/apple-touch-icon.png',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/icon-maskable-512.png',
  '/assets/vendor/entries.json', '/assets/vendor/inventory.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const inventoryResponse = await fetch('/assets/vendor/inventory.json', { cache: 'reload' });
    if (!inventoryResponse.ok) throw new Error('Offline dependency inventory unavailable');
    const inventory = await inventoryResponse.json();
    if (!Array.isArray(inventory) || !inventory.length || inventory.some((entry) =>
      typeof entry.path !== 'string' || !/^\/assets\/vendor\/[a-f0-9]{20}\.(mjs|wasm)$/.test(entry.path))) {
      throw new Error('Invalid offline dependency inventory');
    }
    const cache = await caches.open(SHELL_CACHE);
    // Fail installation if any required dependency is missing; keep the old worker usable.
    const paths = [...new Set([...APP_SHELL, ...inventory.map((entry) => entry.path)])];
    for (let index = 0; index < paths.length; index += 8) {
      await cache.addAll(paths.slice(index, index + 8).map((url) => new Request(url, { cache: 'reload' })));
    }
    // Updates remain waiting until the user explicitly accepts them.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, STATIC_CACHE, FONT_CACHE]);
    await Promise.all((await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX) && !keep.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING' && event.source?.url &&
      new URL(event.source.url).origin === self.location.origin) {
    event.waitUntil(self.skipWaiting());
  }
});

async function networkFirstHtml(request) {
  const cache = await caches.open(SHELL_CACHE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(request, response.clone());
      return response;
    }
    if (response.status < 500) return response;
  } catch { /* Offline or timed out: use the installed shell. */ }
  finally { clearTimeout(timeout); }
  return await cache.match(request) || await cache.match('/index.html') || Response.error();
}

async function cacheFirst(request, cacheName) {
  const shell = await caches.open(SHELL_CACHE);
  const cache = await caches.open(cacheName);
  const cached = await shell.match(request) || await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Only store successful readable responses; never cache error/opaque responses.
  if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js' || url.pathname.startsWith('/_vercel/')) return;
    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
      event.respondWith(networkFirstHtml(request));
    } else if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest') {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
    }
  } else if (['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
});
