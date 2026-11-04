// Browser regression: a slow inactive 4x4 must not delay cached active scrambles.
const assert = require('node:assert/strict');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    let generations = 0;
    page.on('console', message => {
      if (/\[BTime\] 333 scramble generation:/.test(message.text())) generations++;
    });
    await page.goto(process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
    // One displayed scramble and five spare scrambles must be generated first.
    const deadline = Date.now() + 60000;
    while (generations < 6 && Date.now() < deadline) await page.waitForTimeout(100);
    assert.ok(generations >= 6, 'Active event filled its five-item queue');
    await page.evaluate(async () => {
      const { randomScrambleForEvent } = await import('/assets/js/tnoodle-client.mjs');
      window.testWarmupPending = true;
      window.testWarmupError = null;
      randomScrambleForEvent('444', { background: true })
        .catch(error => { window.testWarmupError = error.message; })
        .finally(() => { window.testWarmupPending = false; });
    });
    const durations = [];
    for (const action of ['refresh', 'refresh', 'refresh', 'solve']) {
      const result = await page.evaluate(async action => {
        const text = document.getElementById('scrambleText');
        const previous = text.textContent;
        const start = performance.now();
        const changed = new Promise(resolve => {
          const observer = new MutationObserver(() => {
            if (text.textContent !== previous && !/Generating|failed/.test(text.textContent)) {
              observer.disconnect(); resolve();
            }
          });
          observer.observe(text, { childList: true, characterData: true, subtree: true });
        });
        if (action === 'refresh') document.getElementById('newScramble').click();
        else {
          const toggle = document.getElementById('manualTimeToggle');
          toggle.checked = true; toggle.dispatchEvent(new Event('change'));
          const input = document.getElementById('timerDisplay');
          input.value = '12.34'; input.dispatchEvent(new Event('input'));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        await changed;
        return { milliseconds: performance.now() - start, pending: window.testWarmupPending,
          error: window.testWarmupError, solves: document.querySelectorAll('.solve-item').length };
      }, action);
      assert.ok(result.milliseconds < 1000, action + ' should use an already-generated scramble');
      assert.equal(result.pending, true, 'Inactive 4x4 is still busy while active scrambles succeed');
      assert.equal(result.error, null);
      if (action === 'solve') assert.equal(result.solves, 1);
      durations.push({ action, milliseconds: Math.round(result.milliseconds) });
    }
    console.log(engine, 'active scrambles during 4x4 warmup:', JSON.stringify(durations));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
