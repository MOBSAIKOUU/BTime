// Optional real-browser integration check. Uses only Node and an installed Chromium browser.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const currentVersion = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_VERSION = '([^']+)'/)[1];
const executable = process.env.BTIME_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'btime-pwa-'));
let browser;
let socket;
let server;
let simulateOffline = false;
let simulateUpdate = false;
const timeout = (promise, milliseconds = 20000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('Browser operation timed out')), milliseconds);
  })]).finally(() => clearTimeout(timer));
};
(async () => {
  server = http.createServer((request, response) => {
    if (simulateOffline) { response.writeHead(503); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end(); return;
    }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.wasm': 'application/wasm' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-cache');
    if (pathname === '/sw.js' && simulateUpdate) {
      response.end(fs.readFileSync(file, 'utf8').replace(/const CACHE_VERSION = '[^']+'/, "const CACHE_VERSION = 'browser-update'"));
      return;
    }
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(executable, ['--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true });
  const endpoint = await timeout(new Promise((resolve, reject) => {
    let output = '';
    browser.on('error', reject);
    browser.stderr.on('data', (data) => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
  }));
  console.log('Browser started');
  socket = new WebSocket(endpoint);
  await timeout(new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  }));
  let sequence = 0;
  let loaded;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Page.domContentEventFired' && loaded) { loaded(); loaded = null; }
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error ? callback.reject(Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) => timeout(new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  }), 60000);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Page.navigate', { url: origin }, sessionId);
  // Navigation acknowledgment precedes script execution; wait for the page load.
  for (let index = 0; index < 100; index++) {
    if (await evaluate('document.readyState === "complete" && !!document.getElementById("timerState")')) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log('Application loaded');
  const ready = await evaluate(`navigator.serviceWorker.ready.then(async r => {
    if(r.active.state!=='activated')await new Promise(resolve=>r.active.addEventListener('statechange',()=>{if(r.active.state==='activated')resolve()}));
    return {active:r.active.state,caches:await caches.keys()};
  })`);
  assert.equal(ready.active, 'activated');
  console.log('Service worker ready', ready.caches);
  const result = await evaluate(`(async()=>{
    const entries=await (await fetch('/assets/vendor/entries.json')).json();
    const {setSearchDebug}=await import(entries.search);setSearchDebug({logPerf:false});
    const {randomScrambleForEvent}=await import(entries.scramble);
    return (await randomScrambleForEvent('333')).toString();
  })()`);
  assert.ok(result.length);
  simulateOffline = true;
  const offlineLoad = new Promise((resolve) => { loaded = resolve; });
  // A normal reload exercises the worker. Chromium's hard reload deliberately bypasses it.
  await send('Page.reload', {}, sessionId);
  await timeout(offlineLoad);
  for (let index = 0; index < 100; index++) {
    if (await evaluate('document.readyState === "complete" && !!document.getElementById("timerState")')) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log('Offline reload loaded');
  assert.ok(await evaluate('navigator.serviceWorker.controller?.scriptURL'));
  const offline = await evaluate(`(async()=>{
    const entries=await (await fetch('/assets/vendor/entries.json')).json();
    await import(entries.drawing);
    const {randomScrambleForEvent}=await import(entries.scramble);
    const results=[];
    for(const event of ['333','222','444','555','666','777','clock','minx','pyram','skewb','sq1']){
      const scramble=(await randomScrambleForEvent(event)).toString();
      if(!scramble)throw Error('Empty scramble: '+event);
      const drawing=document.createElement('scramble-display');
      // TwistyPlayer renders lazily: keep each probe in the viewport for the SVG check.
      drawing.style.cssText='position:fixed;top:0;left:0;width:250px;height:200px;pointer-events:none';
      drawing.setAttribute('event',event);drawing.setAttribute('visualization','2D');drawing.setAttribute('scramble',scramble);
      document.body.appendChild(drawing);results.push(event);
    }
    return {events:results,drawingDefined:!!customElements.get('scramble-display')};
  })()`);
  assert.equal(offline.events.length, 11);
  assert.equal(offline.drawingDefined, true);
  console.log('Offline fresh-scramble generation passed for:', offline.events.join(', '));
  await send('DOM.enable', {}, sessionId);
  const descendants = (node) => [node, ...(node.children || []).flatMap(descendants), ...(node.shadowRoots || []).flatMap(descendants), ...(node.contentDocument ? descendants(node.contentDocument) : [])];
  let drawings = 0;
  for (let index = 0; index < 20; index++) {
    const { root: documentRoot } = await send('DOM.getDocument', { depth: -1, pierce: true }, sessionId);
    drawings = descendants(documentRoot).filter((node) => node.nodeName === 'SCRAMBLE-DISPLAY'
      && descendants(node).some((child) => child.nodeName.toLowerCase() === 'svg')).length;
    if (drawings >= 11) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(drawings >= 11, `Expected SVG drawings for all events, found ${drawings}`);
  console.log('Offline SVG drawings rendered:', drawings);
  simulateOffline = false;
  simulateUpdate = true;
  await evaluate(`(async()=>{
    const r=await navigator.serviceWorker.getRegistration();await r.update();
    if(!r.waiting)await new Promise(resolve=>{
      const w=r.installing;if(!w)return resolve();
      w.addEventListener('statechange',()=>{if(w.state==='installed')resolve()});
    });
    await new Promise(resolve=>setTimeout(resolve,100));
  })()`);
  assert.equal(await evaluate('document.getElementById("pwaUpdateNotice").hidden'), false);
  await evaluate(`document.getElementById('timerPanel').focus();window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));`);
  assert.equal(await evaluate('document.getElementById("refreshBTime").disabled'), true);
  await evaluate(`const toggle=document.getElementById('inspectionToggle');toggle.checked=false;toggle.dispatchEvent(new Event('change'));`);
  assert.equal(await evaluate('document.getElementById("refreshBTime").disabled'), false);
  const updatedLoad = new Promise((resolve) => { loaded = resolve; });
  await evaluate('document.getElementById("refreshBTime").click()');
  await timeout(updatedLoad);
  const updatedCaches = await evaluate('caches.keys()');
  assert.ok(updatedCaches.includes('btime-browser-update-shell'));
  assert.equal(updatedCaches.includes('btime-' + currentVersion + '-shell'), false);
  console.log('Waiting update, timer guard, accepted reload, and old-cache cleanup passed');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }, sessionId);
  await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  const touchTap = async (selector) => {
    const point = await evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(selector)});button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,disabled:button.disabled,hit:button.contains(document.elementFromPoint(x,y))}})()`);
    assert.equal(point.disabled, false, `${selector} must be enabled`);
    assert.equal(point.hit, true, `${selector} visual center must hit the button`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] }, sessionId);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 80));
  };
  await evaluate(`(()=>{const toggle=document.getElementById('manualTimeToggle');toggle.checked=true;toggle.dispatchEvent(new Event('change'));const input=document.getElementById('timerDisplay');input.value='12.34';input.dispatchEvent(new Event('input'));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));toggle.checked=false;toggle.dispatchEvent(new Event('change'));})()`);
  await touchTap('.solve-record-button');
  assert.equal(await evaluate('document.getElementById("solveDetails").open'), true);
  const scrambleToCopy = await evaluate('document.getElementById("solveDetailScramble").textContent');
  await touchTap('#copySolveScramble');
  assert.equal(await evaluate('navigator.clipboard.readText()'), scrambleToCopy);
  await touchTap('.solve-detail-actions [data-action="plus2"]');
  assert.match(await evaluate('document.getElementById("solveList").textContent'), /14\.34/);
  await touchTap('.solve-record-button');
  await touchTap('.solve-detail-actions [data-action="dnf"]');
  assert.match(await evaluate('document.getElementById("solveList").textContent'), /DNF/);
  await touchTap('.solve-record-button');
  await touchTap('.solve-detail-actions [data-action="reset"]');
  assert.match(await evaluate('document.getElementById("solveList").textContent'), /12\.34/);
  await touchTap('.solve-record-button');
  await touchTap('#closeSolveDetails');
  assert.equal(await evaluate('document.getElementById("solveDetails").open'), false);
  await touchTap('.solve-record-button');
  await touchTap('.solve-detail-actions [data-action="delete"]');
  assert.equal(await evaluate('document.querySelectorAll(".solve-record-button").length'), 0);
  console.log('Native mobile touch: copy, +2, DNF, revert, close, and delete passed');
  const manifest = await send('Page.getAppManifest', {}, sessionId);
  assert.equal(manifest.errors.length, 0);
  console.log('Browser manifest validation passed');
  console.log('Installability diagnostics:', JSON.stringify(await send('Page.getInstallabilityErrors', {}, sessionId)));
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const layouts = [];
  for (const [width, height] of [[1920,1080],[390,844],[320,568],[844,390]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 }, sessionId);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const layout = await evaluate(`(()=>({viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],clipped:['.topbar','.scramble-panel','.timer-panel','.stats-panel','.history-header','.solve-list','.scramble-visual-panel'].filter(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.top<0||r.left<0||r.bottom>innerHeight+1||r.right>innerWidth+1})}))()`);
    assert.deepEqual(layout.clipped, [], `Clipped controls at ${width}x${height}`);
    assert.ok(layout.page[0] <= width + 1 && layout.page[1] <= height + 1, `Page overflow at ${width}x${height}`);
    const touchArea = await evaluate(`(()=>{const display=document.getElementById('timerDisplay').getBoundingClientRect(),actions=document.getElementById('solveActions').getBoundingClientRect();return {scrollY,overlap:display.left<actions.right&&display.right>actions.left&&display.top<actions.bottom&&display.bottom>actions.top}})()`);
    assert.equal(touchArea.scrollY, 0, `Document shifted at ${width}x${height}`);
    assert.equal(touchArea.overlap, false, `Timer text overlaps actions at ${width}x${height}`);
    layouts.push(layout);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync(path.join(root, 'artifacts', `pwa-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  console.log('Viewport checks passed:', JSON.stringify(layouts));
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone' }, sessionId);
  const iosLoad = new Promise((resolve) => { loaded = resolve; });
  await send('Page.reload', {}, sessionId);
  await timeout(iosLoad);
  assert.match(await evaluate('document.getElementById("installHint").textContent'), /Share > Add to Home Screen/);
  assert.equal(await evaluate('document.getElementById("installBTime").hidden'), false);
  console.log('Simulated iOS install hint passed (not a physical-device installation)');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); browser?.kill(); server?.closeAllConnections(); server?.close();
  console.log('Temporary browser profile:', profile);
});
