// Touch-gesture regression checks. Start scripts/serve.cjs first.
// Desktop WebKit does not render iOS's magnifier; check native touch cancellation
// and preserve pointer timing, buttons and editable input around that guard.
const assert = require('node:assert/strict');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';
(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}) });
  try {
    const context = await browser.newContext({ ...playwright.devices['iPhone 13'], serviceWorkers: 'block' });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
      localStorage.setItem('bcube-timer-inspection', 'false');
      localStorage.setItem('bcube-timer-hold-to-start', 'true');
      localStorage.setItem('bcube-timer-scramble-333', "R U2 F2 L2 D R2 U' B2 L' D2 F2 R' U2 B L2 D' F2 U R2 B'");
    });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
    await page.evaluate(() => {
      window.gestureLog = [];
      document.addEventListener('touchstart', event => gestureLog.push({ target: event.target.id,
        control: !!event.target.closest('button'), prevented: event.defaultPrevented }), { passive: true });
    });
    await page.waitForTimeout(650);
    const display = await page.locator('#timerDisplay').boundingBox();
    const x = display.x + display.width / 2, y = display.y + display.height / 2;
    await page.touchscreen.tap(x, y);
    assert.equal(await page.evaluate(() => gestureLog.at(-1).prevented), true, 'Native timer touch must cancel the selection gesture');
    assert.equal(await page.locator('.solve-record-button').count(), 0, 'A quick tap cannot start a solve');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'timerDisplay');
    if (engine === 'chromium') {
      // CDP can hold a real emulated touch through the full delay, then release.
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await page.waitForTimeout(350);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelector('#timerState').classList.contains('solving'));
      await page.waitForTimeout(150);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else {
      // Public Playwright WebKit offers instantaneous taps; model only the hold.
      await page.locator('#timerPanel').evaluate(async panel => {
        const pointer = type => panel.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 1 }));
        pointer('pointerdown');
        const touch = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.defineProperty(touch, 'touches', { value: [{}] });
        panel.dispatchEvent(touch);
        if (!touch.defaultPrevented) throw Error('Timer gesture listener must be non-passive');
        await new Promise(resolve => setTimeout(resolve, 350));
        pointer('pointerup');
      });
      await page.waitForFunction(() => document.querySelector('#timerState').classList.contains('solving'));
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);
    }
    await page.waitForFunction(() => document.querySelector('#timerState').classList.contains('ready') && document.body.dataset.historySaving === 'false');
    assert.equal(await page.locator('.solve-record-button').count(), 1, 'A held touch and stop must record exactly one solve');
    const time = await page.locator('.solve-record-button .time').textContent();
    await page.waitForTimeout(650);
    await page.locator('#solveActions [data-action="dnf"]').tap();
    assert.equal(await page.evaluate(() => gestureLog.at(-1).prevented), false, 'Action buttons keep native taps');
    assert.match(await page.locator('.solve-record-button .time').textContent(), /DNF/);
    await page.locator('#solveActions [data-action="reset"]').tap();
    assert.equal(await page.locator('.solve-record-button .time').textContent(), time);
    await page.locator('#menuToggle').tap(); await page.locator('#manualTimeToggle').check(); await page.locator('#menuToggle').tap();
    assert.equal(await page.locator('#timerDisplay').getAttribute('inputmode'), 'decimal');
    await page.locator('#timerDisplay').tap();
    assert.equal(await page.evaluate(() => gestureLog.at(-1).prevented), false, 'Manual entry keeps native text gestures');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'timerDisplay');
    await page.locator('#timerDisplay').fill('1:20.00'); await page.locator('#timerDisplay').press('Enter');
    await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
    assert.equal(await page.locator('.solve-record-button').count(), 2);
    assert.equal(await page.locator('.solve-record-button .time').first().textContent(), '1:20.00');
    assert.deepEqual(errors, []);
    console.log(engine + ': native timer-touch cancellation, hold/release/stop, single solve, native buttons and manual entry passed');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
