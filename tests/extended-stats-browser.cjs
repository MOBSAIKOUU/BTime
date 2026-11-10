// Optional IndexedDB/UI checks for Ao25/Ao50/Ao100. Start scripts/serve.cjs first.
const assert = require('node:assert/strict');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';
const sizes = [25, 50, 100];
const format = ms => {
  const cs = Math.round(ms / 10), minutes = Math.floor(cs / 6000), seconds = ((cs % 6000) / 100).toFixed(2);
  return minutes ? minutes + ':' + seconds.padStart(5, '0') : seconds;
};
function expectedAverage(solves, size) {
  const window = solves.slice(-size);
  if (window.length < size) return { text: '--', solves: [], excluded: [] };
  const ranked = window.map((solve, i) => ({ i, time: solve.result === 'dnf' ? Infinity : solve.baseTimeMs + (solve.result === '+2' ? 2000 : 0) }))
    .sort((a, b) => a.time - b.time || a.i - b.i);
  const trim = Math.ceil(size / 20), counted = ranked.slice(trim, size - trim);
  const dnf = counted.some(solve => solve.time === Infinity);
  return { text: dnf ? 'DNF' : format(counted.reduce((sum, solve) => sum + solve.time, 0) / counted.length),
    solves: window, excluded: ranked.filter((_, i) => i < trim || i >= size - trim).map(solve => solve.i) };
}
(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}) });
  try {
    const context = await browser.newContext({ ...playwright.devices['iPhone 13'], viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    let entries = Array.from({ length: 120 }, (_, i) => ({ id: 'extended-' + i, baseTimeMs: (i + 1) * 1000,
      result: i === 100 ? '+2' : 'ok', scramble: "R U2 F2 L2 D R2 U' B2 L' D2 F2 R' U2 B L2 D' F2 U R2 B'" }));
    await context.addInitScript(entries => {
      if (!localStorage.getItem('bcube-timer-history')) localStorage.setItem('bcube-timer-history', JSON.stringify(entries));
      if (!localStorage.getItem('bcube-timer-history-222')) localStorage.setItem('bcube-timer-history-222', JSON.stringify(entries.slice(0, 99)));
      localStorage.setItem('bcube-timer-scramble-333', 'R U2 F2');
      localStorage.setItem('bcube-timer-scramble-222', 'R U2 F2');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied = text; } } });
    }, entries);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.body.dataset.historySaving === 'false' && !document.getElementById('stat-bestSingle').disabled);
    async function verify() {
      await ready();
      for (const size of sizes) assert.equal(await page.locator('#avg' + size).textContent(), expectedAverage(entries, size).text, 'Ao' + size);
      assert.equal(await page.locator('.solve-record-button').count(), Math.min(50, entries.length));
      const data = await page.evaluate(async () => {
        const { openHistoryStore } = await import('/assets/js/history-store.js'); const store = await openHistoryStore();
        try { const snapshot = await store.snapshot('333'); return { count: snapshot.count, latest: snapshot.latest.map(solve => solve.id) }; }
        finally { store.close(); }
      });
      assert.equal(data.count, entries.length); assert.deepEqual(data.latest, entries.slice(-100).map(solve => solve.id));
    }
    async function breakdown(size) {
      const expected = expectedAverage(entries, size);
      await page.locator('#stat-avg' + size).tap();
      assert.match(await page.locator('#averageDetailsTitle').textContent(), new RegExp('^Ao' + size + ' '));
      const text = await page.locator('#averageDetailsText').textContent(), lines = text.split('\n');
      assert.equal(lines[0], 'Average of ' + size + ': ' + expected.text); assert.equal(lines.length, size + 2);
      const marked = lines.slice(2).flatMap((line, index) => line.startsWith('(') ? [index] : []);
      assert.deepEqual(marked.sort((a,b) => a-b), expected.excluded.sort((a,b) => a-b));
      for (const [index, solve] of expected.solves.entries()) assert.ok(lines[index + 2].endsWith(solve.scramble));
      await page.locator('#copyAverageDetails').tap();
      await page.waitForFunction(() => document.getElementById('copyAverageStatus').textContent === 'Average copied.');
      assert.equal(await page.evaluate(() => window.copied), text);
      const box = await page.locator('#averageDetails').evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }));
      assert.ok(box.width <= box.viewport && box.scroll <= box.client);
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'stat-avg' + size);
    }
    await page.goto(origin, { waitUntil: 'domcontentloaded' }); await verify();
    for (const size of sizes) await breakdown(size);
    for (const [width, height] of [[320,568], [390,664], [844,390], [768,1024], [1280,800], [800,600]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        return { pageHeight: document.documentElement.scrollHeight, pageWidth: document.documentElement.scrollWidth,
          averages: [25,50,100].map(size => box('stat-avg' + size)), timer: box('timerPanel'), display: box('timerDisplay') };
      });
      assert.ok(layout.pageWidth <= width + 1 && layout.pageHeight <= height + 1, 'Viewport overflow: ' + JSON.stringify({ width, height, ...layout }));
      assert.ok(layout.averages.every(box => Math.abs(box.top - layout.averages[0].top) < 1), 'new averages stay side by side');
      assert.ok(layout.averages.every(box => box.left >= 0 && box.right <= width));
      assert.ok(layout.display.top >= layout.timer.top && layout.display.bottom <= layout.timer.bottom);
      console.log(engine + ': ' + width + 'x' + height + ' layout passed');
    }
    await page.setViewportSize({ width: 390, height: 664 });
    const range = (from, to) => from + String.fromCharCode(8211) + to + ' of 120';
    assert.equal(await page.locator('#historyRange').textContent(), range(71,120));
    await page.locator('#olderHistory').tap(); await page.waitForFunction(text => document.getElementById('historyRange').textContent === text, range(21,70));
    await page.locator('#olderHistory:enabled').waitFor(); await page.locator('#olderHistory').tap();
    await page.waitForFunction(text => document.getElementById('historyRange').textContent === text, range(1,20));
    await page.locator('#newerHistory:enabled').waitFor(); await page.locator('#newerHistory').tap();
    await page.waitForFunction(text => document.getElementById('historyRange').textContent === text, range(21,70));
    await page.locator('#newerHistory:enabled').waitFor(); await page.locator('#newerHistory').tap();
    await page.waitForFunction(text => document.getElementById('historyRange').textContent === text, range(71,120));
    await page.locator('[data-solve-id="extended-85"]').tap(); await page.locator('.solve-detail-actions [data-action="plus2"]').tap();
    entries[85].result = '+2'; await verify();
    await page.locator('[data-solve-id="extended-85"]').tap(); await page.locator('.solve-detail-actions [data-action="delete"]').tap();
    entries.splice(85,1); await verify();
    await page.locator('#menuToggle').tap(); await page.locator('#manualTimeToggle').check(); await page.locator('#menuToggle').tap();
    await page.locator('#timerDisplay').fill('12.34'); await page.locator('#timerDisplay').press('Enter'); await ready();
    const appended = await page.evaluate(async () => { const { openHistoryStore } = await import('/assets/js/history-store.js'); const store = await openHistoryStore(); try { return (await store.snapshot('333')).latest.at(-1); } finally { store.close(); } });
    entries.push(appended); await verify();
    await page.selectOption('#eventSelect','222'); await ready(); assert.equal(await page.locator('#stat-avg100').isDisabled(),true);
    await page.locator('#timerDisplay').fill('8.00'); await page.locator('#timerDisplay').press('Enter'); await ready();
    assert.equal(await page.locator('#stat-avg100').isEnabled(),true);
    await page.locator('#clearHistory').tap(); await page.locator('#confirmClearHistory').tap();
    await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
    for (const size of sizes) assert.equal(await page.locator('#stat-avg' + size).isDisabled(),true);
    await page.selectOption('#eventSelect','333'); await verify();
    for (let i=0;i<6;i++) {
      const entry = entries[entries.length-1-i]; entry.result = 'dnf';
      await page.evaluate(async id => { const { openHistoryStore } = await import('/assets/js/history-store.js'); const store = await openHistoryStore(); try { await store.change('333',id,'dnf'); } finally { store.close(); } }, entry.id);
      if (i === 4 || i === 5) {
        await page.reload({waitUntil:'domcontentloaded'}); await verify(); await breakdown(100);
        assert.equal(await page.locator('#avg100').textContent() === 'DNF', i === 5, 'Ao100 discards at most five DNFs');
      }
    }
    assert.deepEqual(errors, []);
    console.log(engine + ': larger-average windows, exclusions, copy/focus, paging, append/edit/delete, event boundaries, clear and DNF thresholds passed');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
