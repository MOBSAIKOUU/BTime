// Run against scripts/serve.cjs with Playwright installed separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';

(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}),
  });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    // Optional web fonts are outside this offline engine test; use a deterministic stylesheet.
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({
      status: 200, contentType: 'text/css', body: '/* System fonts for engine tests. */',
    }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getElementById('offlineStatus').textContent.includes('Offline ready'), null, { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('scrambleText').textContent.trim() &&
      !document.getElementById('scrambleText').textContent.startsWith('Generating'), null, { timeout: 60000 });
    await page.evaluate(async () => {
      localStorage.setItem('btime-test-saved-history', 'preserve me');
      // Fonts are optional and outside this test. Seed a local CSS response so WebKit
      // does not report an unrelated third-party font-fetch failure after going offline.
      const fonts = await caches.open('btime-fonts-v1');
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        if (new URL(link.href).hostname === 'fonts.googleapis.com') {
          await fonts.put(link.href, new Response('/* System fonts for offline engine tests. */', {
            headers: { 'Content-Type': 'text/css' },
          }));
        }
      }
    });
    errors.length = 0; // Check errors from the offline reload and generation below.
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.ok(await page.evaluate(() => navigator.serviceWorker.controller));
    const samples = [];
    for (const event of ['333', '222', '444', '555', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1']) {
      await page.selectOption('#eventSelect', event);
      const result = await page.evaluate(async (event) => {
        let ticks = 0;
        const interval = setInterval(() => ticks++, 25);
        try {
          const start = performance.now();
          // This module is shared with the app, so requests use its existing worker.
          const { randomScrambleForEvent } = await import('/assets/js/tnoodle-client.mjs');
          const scramble = await randomScrambleForEvent(event);
          return { event, scramble,
            ticks, milliseconds: Math.round(performance.now() - start) };
        } finally { clearInterval(interval); }
      }, event);
      assert.ok(result.scramble.length > 5, `${event}: nonempty scramble`);
      assert.doesNotMatch(result.scramble, /Generating|failed|Error/);
      if (result.milliseconds > 500) assert.ok(result.ticks > 0, `${event}: UI must remain responsive`);
      samples.push(result);
      console.log(engine, 'offline', event, result.milliseconds + 'ms', 'UI ticks:', result.ticks);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('btime-test-saved-history')), 'preserve me');
    assert.deepEqual(errors, [], 'No uncaught errors during offline generation');
    const samplePath = path.join(os.tmpdir(), `btime-tnoodle-${engine}-samples.json`);
    fs.writeFileSync(samplePath, JSON.stringify(samples, null, 2));
    console.log('Offline samples:', samplePath);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
