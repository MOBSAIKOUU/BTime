// Optional WebKit regression check for populated mobile sessions.
// Start scripts/serve.cjs and set BTIME_PLAYWRIGHT_PATH if Playwright is not on NODE_PATH.
const assert = require('node:assert/strict');
const { webkit, devices } = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';

(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 393, height: 852 }, { width: 390, height: 664 },
      { width: 320, height: 568 }, { width: 844, height: 390 },
    ]) {
      for (const count of [0, 50]) {
        const context = await browser.newContext({ ...devices['iPhone 13'], viewport, serviceWorkers: 'block' });
        try {
          await context.addInitScript((count) => {
            const short = Array.from({ length: 20 }, (_, index) => ['R', 'U', "R'", "U'"][index % 4]).join(' ');
            const long = Array.from({ length: 100 }, (_, index) => ['Lw2', 'B2', 'U', '3Uw', "Rw'", '3Dw2'][index % 6]).join(' ');
            localStorage.setItem('bcube-timer-event', '333');
            localStorage.setItem('bcube-timer-theme', JSON.stringify('night'));
            for (const event of ['333', '222', '777']) {
              const scramble = event === '777' ? long : short;
              const key = event === '333' ? 'bcube-timer-history' : 'bcube-timer-history-' + event;
              localStorage.setItem(key, JSON.stringify(Array.from({ length: count }, (_, index) => ({
                id: String(index), baseTimeMs: 12000 + index, result: 'ok', scramble,
              }))));
              localStorage.setItem('bcube-timer-scramble-' + event, scramble);
            }
          }, count);
          const page = await context.newPage();
          await page.goto(origin, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          for (const event of ['333', '222', '777']) {
            await page.selectOption('#eventSelect', event);
            const result = await page.evaluate(() => {
              const rect = (selector) => {
                const box = document.querySelector(selector).getBoundingClientRect();
                return { top: box.top, bottom: box.bottom, height: box.height };
              };
              const list = document.querySelector('#solveList');
              const text = document.querySelector('#scrambleText');
              return {
                viewport: innerHeight, pageHeight: document.documentElement.scrollHeight,
                timer: rect('#timerPanel'), display: rect('#timerDisplay'),
                scramble: rect('#scrambleText'), panel: rect('.scramble-panel'),
                listHeight: list.clientHeight, listScrollHeight: list.scrollHeight,
                textHeight: text.clientHeight, textScrollHeight: text.scrollHeight,
                solves: document.querySelectorAll('.solve-item').length,
                saved: JSON.parse(localStorage.getItem(document.querySelector('#eventSelect').value === '333'
                  ? 'bcube-timer-history' : 'bcube-timer-history-' + document.querySelector('#eventSelect').value)).length,
              };
            });
            const label = `${viewport.width}x${viewport.height}, ${event}, ${count} saved solves`;
            assert.equal(result.solves, count, label);
            assert.equal(result.saved, count, `${label}: preserve stored history`);
            assert.ok(result.timer.height < result.viewport, `${label}: timer must not expand with solve count`);
            assert.ok(result.display.top >= result.timer.top && result.display.bottom <= result.timer.bottom,
              `${label}: timer digits stay inside the timer`);
            assert.ok(result.scramble.bottom <= result.panel.bottom, `${label}: no clipped scramble`);
            assert.ok(result.scramble.bottom <= result.viewport, `${label}: full scramble visible without scrolling`);
            assert.ok(result.textScrollHeight <= result.textHeight + 1, `${label}: no internal scramble scrolling`);
            assert.ok(result.listHeight <= 121, `${label}: history remains bounded`);
            if (count === 50) assert.ok(result.listScrollHeight > result.listHeight, `${label}: history scrolls internally`);
            if (event !== '777' && viewport.width >= 390) {
              assert.ok(result.pageHeight <= result.viewport + 1, `${label}: short scrambles fit the viewport`);
            }
            console.log('PASS', label, JSON.stringify({ pageHeight: result.pageHeight, timerHeight: result.timer.height }));
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
