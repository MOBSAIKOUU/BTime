const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const origin = 'https://btime.site';
const version = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_VERSION = '([^']+)'/)[1];
const shellCache = 'btime-' + version + '-shell';

function workerHarness() {
  const listeners = new Map();
  const buckets = new Map();
  let offline = false;
  let requests = 0;
  let skipped = false;
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const fetch = async (request) => {
    requests++;
    if (offline) throw Error('Offline');
    const file = path.join(root, decodeURIComponent(new URL(key(request)).pathname === '/' ? '/index.html' : new URL(key(request)).pathname));
    if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/javascript' } });
  };
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return {
        async match(request) { return bucket.get(key(request))?.clone(); },
        async put(request, response) { bucket.set(key(request), response.clone()); },
        async addAll(requests) { for (const request of requests) {
          const response = await fetch(request);
          if (!response.ok) throw Error('Precache failed');
          bucket.set(key(request), response);
        } },
      };
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); },
  };
  const self = {
    location: { origin }, clients: { claim: async () => {} },
    skipWaiting: async () => { skipped = true; },
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  class RelativeRequest extends Request { constructor(url, options) { super(new URL(url, origin), options); } }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    self, caches, fetch, Request: RelativeRequest, Response, URL, AbortController, setTimeout, clearTimeout,
  });
  return {
    buckets, caches, listeners,
    setOffline() { offline = true; }, count: () => requests, skipped: () => skipped,
    lifecycle(name) { let pending; listeners.get(name)({ waitUntil: (promise) => { pending = promise; } }); return pending; },
    request(url, mode = 'cors') {
      let pending;
      listeners.get('fetch')({ request: { url: new URL(url, origin).href, method: 'GET', mode }, respondWith: (promise) => { pending = promise; } });
      return pending;
    },
  };
}

test('manifest icons exist at their declared dimensions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.name, 'BTime');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons.length, 3);
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('vendored module and worker references are local and included in the precache inventory', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/inventory.json')));
  const files = new Set(inventory.map((item) => path.basename(item.path)));
  for (const item of inventory) {
    if (!item.path.endsWith('.mjs')) continue;
    const source = fs.readFileSync(path.join(root, item.path), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
      if (match[1].startsWith('node:')) continue;
      if (!/^(?:\.\.?\/|\/|https?:)/.test(match[1])) continue; // Ignore prose embedded in shader source.
      assert.ok(match[1].startsWith('./'), `External module in ${item.path}: ${match[1]}`);
      assert.ok(files.has(path.basename(match[1])), `Missing module ${match[1]}`);
    }
    for (const match of source.matchAll(/["'](\.\/[a-f0-9]{20}\.mjs)["']/g)) {
      assert.ok(files.has(path.basename(match[1])), `Missing dynamic module or worker ${match[1]}`);
    }
  }
});

test('installation precaches the complete local app and vendor graph', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  const bucket = worker.buckets.get(shellCache);
  assert.ok(bucket.has(origin + '/index.html'));
  assert.ok(bucket.has(origin + '/assets/js/pwa.js'));
  assert.ok(bucket.has(origin + '/assets/js/tnoodle-client.mjs'));
  assert.ok(bucket.has(origin + '/assets/js/tnoodle-worker.mjs'));
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/inventory.json')));
  for (const item of inventory) assert.ok(bucket.has(origin + item.path));
  assert.equal(worker.skipped(), false);
});

test('HTML falls back offline and static libraries are served without network requests', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  worker.setOffline();
  const html = await worker.request('/', 'navigate');
  assert.match(await html.text(), /<title>BTime – Free Online Rubik's Cube &amp; Speedcubing Timer<\/title>/);
  const count = worker.count();
  const { scramble } = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/entries.json')));
  const library = await worker.request(scramble);
  assert.equal(library.status, 200);
  assert.equal(worker.count(), count);
});

test('activation removes only outdated BTime caches', async () => {
  const worker = workerHarness();
  for (const name of ['btime-old-shell', shellCache, 'btime-fonts-v1', 'another-app']) await worker.caches.open(name);
  await worker.lifecycle('activate');
  assert.equal(worker.buckets.has('btime-old-shell'), false);
  assert.ok(worker.buckets.has('another-app'));
  assert.ok(worker.buckets.has('btime-fonts-v1'));
});

test('analytics and service-worker requests bypass the static cache', () => {
  const worker = workerHarness();
  assert.equal(worker.request('/_vercel/insights/script.js'), undefined);
  assert.equal(worker.request('/sw.js'), undefined);
});

test('activation message is accepted only from a same-origin client', async () => {
  const worker = workerHarness();
  let pending;
  worker.listeners.get('message')({ data: { type: 'SKIP_WAITING' }, source: { url: 'https://other.example' }, waitUntil: (value) => { pending = value; } });
  assert.equal(pending, undefined);
  worker.listeners.get('message')({ data: { type: 'SKIP_WAITING' }, source: { url: origin + '/' }, waitUntil: (value) => { pending = value; } });
  await pending;
  assert.equal(worker.skipped(), true);
});
