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
  { name: 'Short desktop', width: 1024, height: 600, desktop: true },
  { name: 'Narrow standalone', width: 320, height: 568, top: 20, standalone: true },
  { name: 'Standalone cold start with dvh 62px short', width: 393, height: 852, bottom: 34, dynamicHeight: 790, standalone: true },
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
            body: css.replace(/env\(safe-area-inset-(top|bottom|left|right)(?:,\s*0px)?\)/g, (_, side) => insets[side] + 'px').replace(/\b100dvh\b/g, value => scenario.dynamicHeight ? scenario.dynamicHeight + 'px' : value) }));
        }
        await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await context.addInitScript(standalone => {
          Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone });
          localStorage.setItem('bcube-timer-scramble-333', "R U F2 L2 D B2 R2 U' F2");
          localStorage.setItem('bcube-timer-scramble-222', "R U F2 R' U2 F R2 U' F2");
          for (const [eventCode, length] of [['444', 40], ['555', 60], ['666', 80], ['777', 100]]) {
            const moves = eventCode === '666' || eventCode === '777' ? ['Lw2', 'B2', 'U', '3Uw', "Rw'", '3Dw2'] : ['Rw2', 'U2', "Fw'", 'Lw2', 'D2', 'Bw'];
            localStorage.setItem('bcube-timer-scramble-' + eventCode, Array.from({ length }, (_, i) => moves[i % moves.length]).join(' '));
          }
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
          return { event: document.querySelector('#eventSelect').value, shell: rect('.page-shell'), header: rect('.topbar'), menuButton: rect('#menuToggle'), logo: rect('.brand-mark'),
            timer: rect('#timerPanel'), digits: rect('#timerDisplay'), footer: rect('.page-footer'),
            scramble: rect('.scramble-panel'), text: rect('#scrambleText'), stats: rect('.stats-panel'), actions: rect('#solveActions'),
            textHeight: document.querySelector('#scrambleText').clientHeight, textScrollHeight: document.querySelector('#scrambleText').scrollHeight,
            padding: parseFloat(getComputedStyle(document.querySelector('.page-shell')).paddingTop),
            headerPosition: getComputedStyle(document.querySelector('.topbar')).position,
            rootMinimum: parseFloat(getComputedStyle(document.documentElement).minHeight),
            bodyMinimum: parseFloat(getComputedStyle(document.body).minHeight),
            shellMinimum: parseFloat(getComputedStyle(document.querySelector('.page-shell')).minHeight),
            bodyColor: getComputedStyle(document.body).backgroundColor, canvasColor: getComputedStyle(document.documentElement).backgroundColor,
            workspaceOverflow: getComputedStyle(document.querySelector('.app-layout')).overflowY,
            width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollY };
        });
        const check = async () => {
          const layout = await measure();
          const gap = scenario.height <= 540 && scenario.width > scenario.height ? 4
            : scenario.width <= 840 ? 8 : Math.max(14, Math.min(36, scenario.width * 0.022));
          assert.ok(Math.abs(layout.padding - (insets.top + gap)) < 0.1, scenario.name + ': inset plus normal spacing');
          assert.ok(Math.abs(layout.header.top + layout.scrollY - (insets.top + gap)) < 1, scenario.name + ': header follows shell padding once: ' + JSON.stringify(layout));
          for (const box of [layout.header, layout.menuButton, layout.logo]) {
            assert.ok(box.top + layout.scrollY >= insets.top && box.left >= insets.left && box.right <= scenario.width - insets.right,
              scenario.name + ': header content stays in safe area');
          }
          if (scenario.standalone) {
            for (const minimum of [layout.rootMinimum, layout.bodyMinimum, layout.shellMinimum]) {
              assert.equal(minimum, scenario.height, 'Installed PWA fills stable viewport even if dvh initializes short');
            }
            assert.notEqual(layout.bodyColor, 'rgba(0, 0, 0, 0)', 'Installed PWA canvas must be opaque');
            assert.equal(layout.bodyColor, layout.canvasColor, 'Body and outer canvas match');
            assert.notEqual(layout.workspaceOverflow, 'auto', 'No added workspace scrollbar');
            assert.notEqual(layout.workspaceOverflow, 'scroll', 'No added workspace scrollbar');
          }
          assert.notEqual(layout.headerPosition, 'fixed'); assert.notEqual(layout.headerPosition, 'absolute');
          assert.ok(layout.digits.top >= layout.timer.top && layout.digits.bottom <= layout.timer.bottom, scenario.name + ': timer fits: ' + JSON.stringify(layout));
          assert.ok(layout.text.top >= layout.scramble.top && layout.text.bottom <= layout.scramble.bottom + 1, scenario.name + ': all scramble text stays inside its panel: ' + JSON.stringify(layout));
          assert.ok(layout.textScrollHeight <= layout.textHeight + 1, scenario.name + ': no internal scramble scrolling');
          assert.ok(layout.scramble.bottom <= layout.timer.top && layout.timer.bottom <= layout.stats.top, scenario.name + ': scramble, timer and stats do not overlap: ' + JSON.stringify(layout));
          assert.ok(layout.actions.top >= layout.timer.top && layout.actions.bottom <= layout.timer.bottom, scenario.name + ': timer controls stay inside timer');
          assert.ok(layout.width <= scenario.width + 1, scenario.name + ': no horizontal overflow');
          assert.ok(layout.footer.bottom <= Math.max(scenario.height, layout.height) - insets.bottom + 1, scenario.name + ': footer clears home indicator');

        };
        await check();
        await page.locator('#menuToggle').click();
        const menu = await page.locator('#settingsMenu').boundingBox();
        const menuButton = (await measure()).menuButton;
        assert.ok(menu.y >= menuButton.bottom && menu.y + menu.height <= scenario.height - insets.bottom + 1,
          scenario.name + ': positioned settings menu remains reachable');
        await page.locator('#menuToggle').click();
        if (scenario.standalone) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
          await check();
        }
        for (const eventCode of ['222', '333', '444', '555', '666', '777', '333']) {
          await page.selectOption('#eventSelect', eventCode);
          await page.waitForFunction(() => document.body.dataset.historySaving === 'false');
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await check();

        }
        assert.deepEqual(errors, [], scenario.name);
        console.log(engine + ': ' + scenario.name + ' passed');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
