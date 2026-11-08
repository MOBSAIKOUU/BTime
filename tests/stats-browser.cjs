// Optional native-browser stats checks; start scripts/serve.cjs first.
// Set BTIME_PLAYWRIGHT_PATH and optionally BTIME_BROWSER_ENGINE=chromium.
const assert = require('node:assert/strict');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';

(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}),
  });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block',
        ...(mobile ? { ...playwright.devices['iPhone 13'], viewport: { width: 390, height: 664 } }
          : { viewport: { width: 1280, height: 800 } }),
      });
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await context.addInitScript(() => {
        localStorage.setItem('bcube-timer-inspection', 'false');
        localStorage.setItem('bcube-timer-history', JSON.stringify(
          [30, 1, 9, 2, 8, 3, 7, 4, 6, 5, 10, 11].map((time, index) => ({
            id: String(index), baseTimeMs: time * 1000, result: 'ok', scramble: index % 2 ? 'R U2' : 'R U',
          }))));
        Object.defineProperty(navigator, 'clipboard', { configurable: true,
          value: { writeText: async text => { window.copied = text; } },
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.locator('#stat-bestSingle:enabled').waitFor();
      const activate = async selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
      await activate('#stat-bestSingle');
      assert.equal(await page.locator('#solveDetails').evaluate(el => el.open), true);
      assert.equal(await page.locator('#solveDetailTime').textContent(), '1.00');
      assert.equal(await page.locator('#solveDetailScramble').textContent(), 'R U2');
      await activate('#closeSolveDetails');
      for (const [kind, expected, count] of [['bestAvg5', 'Average of 5: 4.33', 5], ['avg5', 'Average of 5: 7.00', 5], ['avg12', 'Average of 12: 6.50', 12]]) {
        await activate('#stat-' + kind);
        assert.equal(await page.locator('#averageDetails').evaluate(el => el.open), true);
        const text = await page.locator('#averageDetailsText').textContent();
        const lines = text.split('\n');
        assert.equal(lines[0], expected);
        assert.equal(lines[1], 'BTime — Scrambles Powered by TNoodle');
        assert.equal(lines.length, count + 2);
        assert.equal(lines.filter(line => line.startsWith('(')).length, 2);
        const layout = await page.locator('#averageDetails').evaluate(el => ({
          horizontalOverflow: el.scrollWidth > el.clientWidth,
          width: el.getBoundingClientRect().width, viewport: innerWidth,
        }));
        assert.equal(layout.horizontalOverflow, false);
        assert.ok(layout.width <= layout.viewport);
        await activate('#copyAverageDetails');
        await page.waitForFunction(() => document.getElementById('copyAverageStatus').textContent === 'Average copied.');
        assert.equal(await page.evaluate(() => window.copied), text);
        await page.keyboard.press('Alt+z');
        await page.keyboard.press('Control+3');
        assert.equal(await page.locator('#deleteSolveDialog').evaluate(el => el.open), false);
        assert.equal(await page.locator('.solve-record-button').count(), 12);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#averageDetails').evaluate(el => el.open), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'stat-' + kind);
      }
      // Enter/Space use the browser's native button activation.
      await page.locator('#stat-avg5').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#averageDetails').evaluate(el => el.open), true);
      await page.evaluate(() => {
        navigator.clipboard.writeText = async () => { throw Error('Unavailable'); };
        document.execCommand = command => {
          if (command !== 'copy') return false;
          const clipboardData = new DataTransfer();
          document.dispatchEvent(new ClipboardEvent('copy', { clipboardData }));
          window.fallbackCopied = clipboardData.getData('text/plain');
          return true;
        };
      });
      await activate('#copyAverageDetails');
      await page.waitForFunction(() => window.fallbackCopied === document.getElementById('averageDetailsText').textContent);
      await activate('#closeAverageDetails');
      await page.locator('#stat-avg12').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#averageDetails').evaluate(el => el.open), true);
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      console.log(engine + ' ' + (mobile ? 'mobile taps' : 'desktop clicks') + ': stats, windows, copy/fallback, keyboard and focus passed');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
