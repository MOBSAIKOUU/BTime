// Maintenance only: download pinned, precompiled ESM files. No build step or npm install.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = path.resolve(__dirname, '../assets/vendor');
const roots = {
  scramble: 'https://esm.sh/cubing@0.59.1/scramble?target=es2022',
  search: 'https://esm.sh/cubing@0.59.1/search?target=es2022',
  drawing: 'https://esm.sh/scramble-display@0.59.1?deps=cubing@0.59.1&target=es2022',
};
const resources = new Map();
function filename(url) {
  const extension = new URL(url).pathname.endsWith('.wasm') ? '.wasm' : '.mjs';
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 20) + extension;
}
function discover(text, base) {
  const dependencies = new Map();
  for (const match of text.matchAll(/(["'`])((?:https:\/\/esm\.sh\/|\.{1,2}\/|\/)[^"'`\s]+)\1/g)) {
    const specifier = match[2];
    if (!/\.(?:m?js|wasm)(?:\?|$)/.test(specifier) && !/^\/(?:[^/]+@|@[^/]+\/[^/]+@)/.test(specifier)) continue;
    const url = new URL(specifier, base);
    if (url.origin === 'https://esm.sh') dependencies.set(specifier, url.href);
  }
  return dependencies;
}
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const binary = new URL(url).pathname.endsWith('.wasm');
  const content = binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
  if (!binary && !/javascript/.test(response.headers.get('content-type') || '')) throw Error(`Not JavaScript: ${url}`);
  resources.set(url, { content, dependencies: binary ? new Map() : discover(content, url) });
}
(async () => {
  const pending = new Set(Object.values(roots));
  while (pending.size) {
    const batch = [...pending].slice(0, 5);
    batch.forEach((url) => pending.delete(url));
    await Promise.all(batch.map(download));
    for (const url of batch) for (const dependency of resources.get(url).dependencies.values()) {
      if (!resources.has(dependency)) pending.add(dependency);
    }
    if (resources.size > 400) throw Error('Unexpected dependency graph size');
  }
  fs.mkdirSync(directory, { recursive: true });
  for (const [url, resource] of resources) {
    let content = resource.content;
    if (typeof content === 'string') {
      for (const [specifier, dependency] of resource.dependencies) {
        content = content.split(JSON.stringify(specifier)).join(JSON.stringify('./' + filename(dependency)))
          .split("'" + specifier + "'").join("'./" + filename(dependency) + "'")
          .split('`' + specifier + '`').join('`./' + filename(dependency) + '`');
      }
      content = content.replace(/^\/\/# sourceMappingURL=.*$/gm, '');
    }
    fs.writeFileSync(path.join(directory, filename(url)), content);
  }
  const entries = Object.fromEntries(Object.entries(roots).map(([name, url]) => [name, '/assets/vendor/' + filename(url)]));
  fs.writeFileSync(path.join(directory, 'entries.json'), JSON.stringify(entries, null, 2) + '\n');
  const inventory = [...resources.keys()].map((url) => ({ path: '/assets/vendor/' + filename(url), source: url }));
  fs.writeFileSync(path.join(directory, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
  console.log(JSON.stringify({ files: resources.size, entries, bytes: [...resources.values()].reduce((sum, resource) => sum + Buffer.byteLength(resource.content), 0) }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
