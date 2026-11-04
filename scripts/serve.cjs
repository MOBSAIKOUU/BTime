// Local static server for browser/Lighthouse checks; no build tooling required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const security = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers;
http.createServer((request, response) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  } catch { response.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some((part) => part.startsWith('.')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  for (const { key, value } of security) response.setHeader(key, value);
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  if (request.method === 'HEAD') { response.end(); return; }
  fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log('BTime: http://127.0.0.1:' + (Number(process.env.PORT) || 4173)));
