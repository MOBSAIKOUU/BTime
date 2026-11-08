// Optional real IndexedDB integration/performance check. Start scripts/serve.cjs first.
const assert = require('node:assert/strict');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';
const archiveCount = Number(process.env.BTIME_HISTORY_TEST_COUNT || 20000);
const oracleSteps = Number(process.env.BTIME_HISTORY_TEST_STEPS || 260);
const rangeLabel = (count, offset = 0) => (count - offset - 49) + String.fromCharCode(8211) + (count - offset) + ' of ' + count;

(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}),
  });
  try {
    const context = await browser.newContext({ ...playwright.devices['iPhone 13'],
      viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await context.addInitScript(() => {
      localStorage.setItem('bcube-timer-manual-time', 'true');
      localStorage.setItem('bcube-timer-inspection', 'false');
      if (!localStorage.getItem('bcube-timer-history')) {
        localStorage.setItem('bcube-timer-history', JSON.stringify(Array.from({ length: 60 }, (_, i) => ({
          id: 'legacy-' + i, baseTimeMs: 10000 + i * 100, result: 'ok', scramble: 'R U2 F2',
        }))));
      }
      localStorage.setItem('bcube-timer-scramble-333', 'R U2 F2');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.text().startsWith('[history-test]')) console.log(message.text()); });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.locator('#stat-bestSingle:enabled').waitFor();
    assert.equal(await page.locator('.solve-record-button').count(), 50);
    assert.equal(await page.locator('#historyRange').textContent(), '11–60 of 60');
    await page.locator('#olderHistory').tap();
    await page.waitForFunction(() => document.getElementById('historyRange').textContent === '1–10 of 60');
    assert.equal(await page.locator('.solve-record-button').count(), 10);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#stat-bestSingle:enabled').waitFor();
    assert.equal(await page.locator('#historyRange').textContent(), '11–60 of 60', 'Migration runs only once');

    console.log(engine + ': migration and reload passed; starting database oracle');
    const oracleResult = await page.evaluate(async ({ archiveCount, oracleSteps }) => {
      const { openHistoryStore } = await import('/assets/js/history-store.js');
      const store = await openHistoryStore();
      await store.migrate('clock', []);
      let entries = [];
      let seed = 123456;
      const random = maximum => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % maximum; };
      const value = solve => solve.result === 'dnf' ? Infinity : solve.baseTimeMs + (solve.result === '+2' ? 2000 : 0);
      function average(list, size) {
        if (list.length < size) return { value: null, isDnf: false };
        const times = list.slice(-size).map(value).sort((a, b) => a - b).slice(1, -1);
        return times.some(time => !Number.isFinite(time)) ? { value: null, isDnf: true }
          : { value: times.reduce((sum, time) => sum + time, 0) / times.length, isDnf: false };
      }
      const check = (condition, detail) => { if (!condition) throw Error(detail); };
      let checks = 0;
      async function verify() {
        const snapshot = await store.snapshot('clock');
        check(snapshot.count === entries.length, 'Count mismatch');
        check(JSON.stringify(snapshot.latest.map(solve => solve.id)) === JSON.stringify(entries.slice(-50).map(solve => solve.id)), 'Latest page mismatch');
        const valid = entries.filter(solve => Number.isFinite(value(solve)));
        check(snapshot.validCount === valid.length, 'Valid count mismatch');
        check(snapshot.total === valid.reduce((sum, solve) => sum + value(solve), 0), 'Mean total mismatch');
        const bestSingle = valid.reduce((best, solve) => !best || value(solve) < value(best) ? solve : best, null);
        check(snapshot.bestSingle?.id === bestSingle?.id, 'Best single mismatch');
        for (const size of [5, 12]) {
          const expected = average(entries, size);
          const actual = snapshot['avg' + size];
          check(actual.isDnf === expected.isDnf && (actual.value === expected.value || Math.abs(actual.value - expected.value) < 1e-7), 'Current Ao' + size + ' mismatch');
        }
        let best = null;
        for (let end = 5; end <= entries.length; end++) {
          const window = entries.slice(end - 5, end);
          const candidate = average(window, 5);
          if (!candidate.isDnf && (!best || candidate.value < best.value)) best = { ...candidate, solves: window };
        }
        check(snapshot.bestAvg5?.value === best?.value, 'Best Ao5 value mismatch');
        check(JSON.stringify(snapshot.bestAvg5?.solves.map(solve => solve.id)) === JSON.stringify(best?.solves.map(solve => solve.id)), 'Best Ao5 window mismatch');
        checks++;
      }
      for (let i = 0; i < oracleSteps; i++) {
        if (entries.length < 12 || random(3) === 0) {
          const entry = { id: 'test-' + i, baseTimeMs: 1000 + random(10) * 1000,
            result: ['ok', '+2', 'dnf'][random(3)], scramble: 'R U2', tag: 'Clock' };
          entries.push(entry);
          await store.append('clock', entry);
          if (i % 7 === 0) await store.append('clock', entry); // Retrying a committed append cannot duplicate it.
        } else {
          const index = random(entries.length);
          const entry = entries[index];
          const action = ['delete', 'dnf', 'plus2', 'reset'][random(4)];
          await store.change('clock', entry.id, action);
          if (action === 'delete') entries.splice(index, 1);
          else entry.result = action === 'dnf' ? 'dnf' : action === 'plus2' ? '+2' : 'ok';
        }
        await verify();
        if (i % 50 === 0) console.log('[history-test] verified ' + (i + 1) + ' mutations');
      }
      console.log('[history-test] oracle passed; checking concurrent writers');
      const second = await openHistoryStore();
      const concurrent = Array.from({ length: 20 }, (_, i) => ({ id: 'concurrent-' + i, baseTimeMs: 2000 + i,
        result: 'ok', scramble: 'R U', tag: 'Clock' }));
      await Promise.all(concurrent.map((solve, i) => (i % 2 ? store : second).append('clock', solve)));
      const snapshot = await store.snapshot('clock');
      check(snapshot.count === entries.length + 20, 'Concurrent writes lost solves');
      await store.clear('clock');
      await store.migrate('clock', concurrent);
      check((await store.snapshot('clock')).count === 0, 'A cleared event was reimported');
      check((await store.snapshot('333')).count === 60, 'Clearing one event changed another');
      second.close();

      console.log('[history-test] concurrency passed; seeding large archive');
      await store.clear('333');
      console.log('[history-test] archive clear committed');
      // A large archive is seeded separately from the measured append/read paths.
      const solves = Array.from({ length: archiveCount }, (_, i) => ({ id: 'archive-' + i,
        baseTimeMs: i < 5 ? 1000 + i * 100 : 10000 + i % 1000,
        result: i >= 5 && i % 17 === 0 ? 'dnf' : 'ok', scramble: 'R U2 F2', tag: '3x3' }));
      // Reset only this isolated test fixture marker before importing the large archive.
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('btime-history');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['events'], 'readwrite');
        tx.objectStore('events').delete('333');
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
      });
      db.close();
      console.log('[history-test] fixture marker reset; importing archive');
      const started = performance.now();
      await store.migrate('333', solves);
      console.log('[history-test] archive import committed');
      const populated = await store.snapshot('333');
      check(populated.count === archiveCount && populated.latest.length === 50, 'Large archive was truncated or fully loaded');
      check(populated.bestSingle.id === 'archive-0' && populated.bestAvg5.solves[0].id === 'archive-0', 'Old best results were lost');
      store.close();
      return { checks, archiveCount: populated.count, seedMs: Math.round(performance.now() - started) };
    }, { archiveCount, oracleSteps });
    console.log(engine + ': IndexedDB oracle, atomic edits/deletions, retry idempotence, concurrent writers and event isolation', JSON.stringify(oracleResult));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#stat-bestSingle:enabled').waitFor();
    assert.equal(await page.locator('#historyRange').textContent(), rangeLabel(archiveCount));
    assert.equal(await page.locator('.solve-record-button').count(), 50);
    await page.locator('#stat-bestSingle').tap();
    assert.equal(await page.locator('#solveDetailTime').textContent(), '1.00');
    await page.locator('#closeSolveDetails').tap();
    await page.locator('#stat-bestAvg5').tap();
    assert.match(await page.locator('#averageDetailsText').textContent(), /^Average of 5: 1.20/);
    await page.locator('#closeAverageDetails').tap();
    for (const viewport of [{ width: 390, height: 664 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const panel = document.getElementById('historyPagination').getBoundingClientRect();
        const history = document.getElementById('solveList').getBoundingClientRect();
        return { width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          overlap: panel.bottom > history.top + 1, rows: document.querySelectorAll('.solve-record-button').length };
      });
      assert.ok(layout.pageWidth <= layout.width, JSON.stringify(layout));
      assert.equal(layout.overlap, false, JSON.stringify(layout));
      assert.equal(layout.rows, 50);
    }
    await page.setViewportSize({ width: 390, height: 664 });
    await page.locator('#olderHistory').tap();
    await page.waitForFunction(label => document.getElementById('historyRange').textContent === label, rangeLabel(archiveCount, 50));
    const olderId = await page.locator('.solve-record-button').first().getAttribute('data-solve-id');
    await page.locator('.solve-record-button').first().tap();
    await page.locator('.solve-detail-actions [data-action="plus2"]').tap();
    await page.locator('#stat-bestSingle:enabled').waitFor();
    await page.locator('.solve-record-button').first().tap();
    assert.match(await page.locator('#solveDetailTime').textContent(), /\+2$/);
    await page.locator('.solve-detail-actions [data-action="delete"]').tap();
    await page.waitForFunction(count => document.getElementById('historyRange').textContent.endsWith('of ' + count), archiveCount - 1);
    assert.equal(await page.locator('[data-solve-id="' + olderId + '"]').count(), 0);
    await page.locator('#newerHistory').tap();
    await page.waitForFunction(label => document.getElementById('historyRange').textContent === label, rangeLabel(archiveCount - 1));

    // Simulate a real storage failure; the failed operation must remain retryable.
    await page.evaluate(() => {
      window.originalTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function(stores, mode, options) {
        if (mode === 'readwrite') throw new DOMException('Storage full', 'QuotaExceededError');
        return window.originalTransaction.call(this, stores, mode, options);
      };
    });
    await page.locator('#timerDisplay').fill('1234');
    await page.locator('#timerDisplay').press('Enter');
    await page.locator('#retryHistory').waitFor({ state: 'visible' });
    assert.match(await page.locator('#historyStorageStatus').textContent(), /Could not save/);
    await page.evaluate(() => { IDBDatabase.prototype.transaction = window.originalTransaction; });
    await page.locator('#retryHistory').tap();
    await page.waitForFunction(() => document.getElementById('historyStorageStatus').hidden);
    assert.equal(await page.locator('#historyRange').textContent(), rangeLabel(archiveCount));

    const dispatches = await page.evaluate(() => {
      const times = [];
      for (let i = 0; i < 20; i++) {
        const started = performance.now();
        const input = document.getElementById('timerDisplay');
        input.value = '1234';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        times.push(performance.now() - started);
      }
      return times.sort((a, b) => a - b);
    });
    await page.waitForFunction(label => document.getElementById('historyRange').textContent === label, rangeLabel(archiveCount + 20));
    await page.waitForFunction(() => document.getElementById('historyStorageStatus').hidden && !document.getElementById('olderHistory').disabled);
    assert.equal(await page.locator('.solve-record-button').count(), 50);
    assert.ok(dispatches[18] < 100, 'Main-thread solve processing exceeded 100ms: ' + JSON.stringify(dispatches));
    console.log(engine + ': ' + archiveCount + '-solve archive, migration, mobile pages, old details, penalties/delete and storage retry passed; solve UI p95=' + dispatches[18].toFixed(1) + 'ms');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#stat-bestSingle:enabled').waitFor();
    assert.equal(await page.locator('#historyRange').textContent(), rangeLabel(archiveCount + 20));
    await page.evaluate(() => {
      window.originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) {
        if (this.name === 'solves') throw new DOMException('Storage full', 'QuotaExceededError');
        return key === undefined ? window.originalPut.call(this, value) : window.originalPut.call(this, value, key);
      };
    });
    await page.locator('#timerDisplay').fill('1234');
    await page.locator('#timerDisplay').press('Enter');
    await page.locator('#retryHistory').waitFor({ state: 'visible' });
    await page.locator('#clearHistory').tap();
    await page.locator('#confirmClearHistory').tap();
    await page.waitForFunction(() => document.getElementById('historyStorageStatus').hidden && document.body.dataset.historySaving === 'false');
    assert.equal(await page.locator('.solve-record-button').count(), 0);
    console.log(engine + ': explicit Clear recovers even when an append cannot fit in storage');
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
