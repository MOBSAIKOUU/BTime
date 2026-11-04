// Optional Safari-engine check. Install Playwright/WebKit separately; no app dependency.
// Set BTIME_PLAYWRIGHT_PATH to the installed Playwright module if it is not on NODE_PATH.
const assert = require('node:assert/strict');
const { webkit, devices } = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';

(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    // Exercise installed-app UI detection; this does not emulate physical iOS OS chrome.
    await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('offlineStatus').textContent.includes('Offline ready'));
    const check = async (label) => {
      const result = await page.evaluate(() => {
        const root = document.querySelector('.page-shell').getBoundingClientRect();
        return { scrollY, top: root.top, bottom: root.bottom, height: visualViewport.height,
          bodyPosition: getComputedStyle(document.body).position };
      });
      assert.equal(result.scrollY, 0, label);
      assert.ok(result.top >= -1 && result.bottom <= result.height + 1, `${label}: ${JSON.stringify(result)}`);
      assert.notEqual(result.bodyPosition, 'fixed', 'Root must not create a fixed-position hit-testing layer');
      console.log(label, JSON.stringify(result));
    };
    const tap = async (selector) => {
      const button = page.locator(selector).first();
      await button.scrollIntoViewIfNeeded();
      const hit = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      });
      assert.equal(hit, true, `${selector}: visual center must hit the button`);
      await button.tap();
    };
    await check('Installed-app initial viewport');
    await page.evaluate(() => window.scrollTo(0, 100));
    await check('Root scrolling blocked without fixed positioning');
    await tap('#menuToggle');
    await page.locator('#manualTimeToggle').check();
    await tap('#menuToggle');
    await page.locator('#timerDisplay').fill('12.34');
    await page.locator('#timerDisplay').press('Enter');
    await check('After input focus');
    await tap('#menuToggle');
    await page.locator('#manualTimeToggle').uncheck();
    await tap('#menuToggle');
    await tap('.solve-record-button');
    await check('After dialog autofocus');
    await tap('#copySolveScramble');
    await page.waitForFunction(() => document.getElementById('copyScrambleStatus').textContent.includes('copied'));
    await tap('.solve-detail-actions [data-action="plus2"]');
    assert.match(await page.locator('#solveList').textContent(), /14\.34/);
    await check('After dialog close and focus restoration');
    for (const action of ['dnf', 'reset', 'delete']) {
      await tap('.solve-record-button');
      await tap(`.solve-detail-actions [data-action="${action}"]`);
      await check(`After ${action}`);
    }
    await tap('#menuToggle');
    await page.locator('#manualTimeToggle').check();
    await tap('#menuToggle');
    await page.locator('#timerDisplay').fill('9.87');
    await page.locator('#timerDisplay').press('Enter');
    await tap('#menuToggle');
    await page.locator('#manualTimeToggle').uncheck();
    await tap('#menuToggle');
    await tap('#clearHistory');
    assert.equal(await page.locator('#clearHistoryDialog').evaluate((element) => element.open), true);
    await tap('#cancelClearHistory');
    assert.equal(await page.locator('#clearHistoryDialog').evaluate((element) => element.open), false);
    assert.equal(await page.locator('.solve-record-button').count(), 1);
    await tap('#clearHistory');
    await tap('#confirmClearHistory');
    assert.equal(await page.locator('#clearHistoryDialog').evaluate((element) => element.open), false);
    assert.equal(await page.locator('.solve-record-button').count(), 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bcube-timer-history'))), []);
    await check('After clear confirmation');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.page-shell')).display === 'flex');
    assert.equal(await page.locator('.solve-record-button').count(), 0);
    console.log('WebKit Clear dialog: Cancel, confirm, and persisted empty history passed');
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 390, height: 664 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      await check(`Viewport ${viewport.width}x${viewport.height}`);
      await tap('#menuToggle');
      await tap('#menuToggle');
    }
    await tap('#menuToggle');
    await page.locator('#inspectionToggle').uncheck();
    await page.locator('#holdToStartToggle').uncheck();
    await tap('#menuToggle');
    for (const surface of ['.stats-panel', '.scramble-visual-panel', '.timer-panel']) {
      await page.waitForTimeout(750);
      await tap(surface);
      console.log('After surface tap', surface, await page.locator('#timerState').evaluate(e=>e.className));
      await page.waitForFunction(() => document.getElementById('timerState').classList.contains('solving'), null, { timeout: 5000 });
      // A disabled action must still be a valid stopping surface.
      const stop = page.locator('#solveActions [data-action="plus2"]');
      const rect = await stop.boundingBox();
      await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.waitForFunction(() => document.getElementById('timerState').classList.contains('ready'));
      assert.equal(await page.locator('#settingsMenu').isVisible(), false);
      console.log(`Native start from ${surface}, stop on disabled action passed`);
    }
    console.log('WebKit native button taps and viewport checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
