// Safe-area regression checks. Start scripts/serve.cjs first.
// Desktop WebKit cannot reproduce the iOS status bar. Inject only env() values
// into the served stylesheet to test the real layout and responsive cascade.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.BTIME_PLAYWRIGHT_PATH || 'playwright');
const engine = process.env.BTIME_BROWSER_ENGINE || 'webkit';
const origin = process.env.BTIME_TEST_ORIGIN || 'http://127.0.0.1:4173';
const css = fs.readFileSync(path.join(__dirname, '../assets/css/style.css'), 'utf8');
const cases = [
  { name: 'Safari portrait', width: 390, height: 664 },
  { name: 'Android portrait', width: 412, height: 915 },
  { name: 'Desktop', width: 1280, height: 800, desktop: true },
  { name: 'Standalone native status-bar viewport', width: 393, height: 790, standalone: true },
  { name: 'Standalone without notch', width: 375, height: 667, top: 20, standalone: true },
  { name: 'Standalone notch', width: 390, height: 844, top: 47, bottom: 34, standalone: true },
  { name: 'Standalone Dynamic Island', width: 393, height: 852, top: 59, bottom: 34, standalone: true },
  { name: 'Standalone larger inset', width: 430, height: 932, top: 62, bottom: 34, standalone: true },
  { name: 'Safari landscape notch', width: 844, height: 390, left: 47, right: 47, bottom: 21 },
  { name: 'Standalone landscape', width: 852, height: 393, top: 20, left: 59, right: 59, bottom: 21, standalone: true },
];
(async () => {
  const browser = await playwright[engine].launch({ headless: true,
    ...(process.env.BTIME_BROWSER_PATH ? { executablePath: process.env.BTIME_BROWSER_PATH } : {}) });
  try {
    for (const scenario of cases) {
      const context = await browser.newContext({
        ...(scenario.desktop ? {} : playwright.devices['iPhone 13']),
        viewport: { width: scenario.width, height: scenario.height }, serviceWorkers: 'block',
      });
      try {
        const insets = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(side => [side, scenario[side] || 0]));
        // Zero-inset cases use native env() evaluation to cover ordinary browsers.
        if (Object.values(insets).some(Boolean)) {
          await context.route('**/assets/css/style.css', route => route.fulfill({ contentType: 'text/css',
            body: css.replace(/env\(safe-area-inset-(top|bottom|left|right)(?:,\s*0px)?\)/g, (_, side) => insets[side] + 'px') }));
        }
        await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await context.addInitScript(standalone => {
          Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone });
          localStorage.setItem('bcube-timer-scramble-333', "R U F2 L2 D B2 R2 U' F2");
          localStorage.setItem('bcube-timer-scramble-222', "R U F2 R' U2 F R2 U' F2");
          localStorage.setItem('bcube-timer-scramble-777', Array.from({ length: 100 }, (_, i) => ['Lw2', 'B2', 'U', '3Uw', "Rw'", '3Dw2'][i % 6]).join(' '));
        }, !!scenario.standalone);
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
        const measure = () => page.evaluate(() => {
          const rect = selector => {
            const box = document.querySelector(selector).getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
          };
          return { shell: rect('.page-shell'), header: rect('.topbar'), menuButton: rect('#menuToggle'), logo: rect('.brand-mark'),
            timer: rect('#timerPanel'), digits: rect('#timerDisplay'), footer: rect('.page-footer'),
            padding: parseFloat(getComputedStyle(document.querySelector('.page-shell')).paddingTop),
            headerPosition: getComputedStyle(document.querySelector('.topbar')).position,
            width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollY };
        });
        const check = async () => {
          const layout = await measure();
          const gap = scenario.height <= 540 && scenario.width > scenario.height ? 4
            : scenario.width <= 840 ? 8 : Math.max(14, Math.min(36, scenario.width * 0.022));
          assert.ok(Math.abs(layout.padding - (scenario.standalone ? gap : insets.top + gap)) < 0.1, scenario.name + ': inset plus normal spacing');
          assert.ok(Math.abs(layout.header.top - (insets.top + gap)) < 1, scenario.name + ': header follows shell padding once: ' + JSON.stringify(layout));
          for (const box of [layout.header, layout.menuButton, layout.logo]) {
            assert.ok(box.top >= insets.top && box.left >= insets.left && box.right <= scenario.width - insets.right,
              scenario.name + ': header content stays in safe area');
          }
          if (scenario.standalone) {
            assert.ok(Math.abs(layout.shell.top - insets.top) < 1, 'Container starts at the safe-area edge');
            assert.ok(Math.abs(layout.shell.bottom - (scenario.height - insets.bottom)) < 1, 'Container ends at the safe-area edge');
          }
          assert.notEqual(layout.headerPosition, 'fixed'); assert.notEqual(layout.headerPosition, 'absolute');
          assert.ok(layout.digits.top >= layout.timer.top && layout.digits.bottom <= layout.timer.bottom, scenario.name + ': timer fits');
          assert.ok(layout.width <= scenario.width + 1, scenario.name + ': no horizontal overflow');
          assert.ok(layout.footer.bottom <= Math.max(scenario.height, layout.height) - insets.bottom + 1, scenario.name + ': footer clears home indicator');
          assert.equal(layout.scrollY, 0);
        };
        await check();
        await page.locator('#menuToggle').click();
        const menu = await page.locator('#settingsMenu').boundingBox();
        const menuButton = (await measure()).menuButton;
        assert.ok(menu.y >= menuButton.bottom && menu.y + menu.height <= scenario.height - insets.bottom + 1,
          scenario.name + ': positioned settings menu remains reachable');
        await page.locator('#menuToggle').click();
        if (scenario.standalone) {
          await page.waitForTimeout(100);
          await check(); // Closing settings must not move the root document.
          assert.equal(await page.evaluate(() => history.scrollRestoration), 'manual');
          await page.evaluate(() => window.scrollTo(0, 100));
          await check();
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
          await check(); // Include same-URL reloads and their previous scroll position.
          for (const eventCode of ['777', '222', '333']) {
            await page.selectOption('#eventSelect', eventCode);
            await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await check();
            const workspace = await page.evaluate(() => {
              const main = document.querySelector('.app-layout');
              main.scrollTop = main.scrollHeight;
              return { scroll: main.scrollTop, max: main.scrollHeight - main.clientHeight };
            });
            if (workspace.max > 1) assert.ok(workspace.scroll > 0, 'Long content remains reachable');
            assert.equal(await page.evaluate(() => scrollY), 0, 'Workspace scroll must not move the document');
            assert.equal(await page.locator('.topbar').evaluate(el => Math.round(el.getBoundingClientRect().top)), Math.round(insets.top + (scenario.height <= 540 && scenario.width > scenario.height ? 4 : 8)));
            await page.evaluate(() => document.querySelector('.app-layout').scrollTop = 0);
          }
        }
        assert.deepEqual(errors, [], scenario.name);
        console.log(engine + ': ' + scenario.name + ' passed');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
