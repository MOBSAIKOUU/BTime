const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');

// Execute the complete application with deterministic browser/clock substitutes.
// External scrambler modules remain pending; no network or packages are required.
function createApp(saved = {}, storageBlocked = false) {
  const elements = new Map();
  const storage = new Map(Object.entries(saved));
  const timers = new Map();
  const frames = new Map();
  let nextId = 0;
  let now = 10000;
  class Element {
    constructor(id = '') {
      this.id = id;
      this.listeners = new Map();
      this.children = [];
      this.dataset = {};
      this.style = { setProperty() {} };
      this.attributes = new Map();
      this.disabled = false;
      this.hidden = true;
      this.readOnly = true;
      this.value = '';
      this.open = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    dispatch(type, options = {}) {
      const event = { type, target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...options };
      for (const callback of this.listeners.get(type) || []) callback(event);
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    replaceWith() {}
    remove() {}
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    closest() { return null; }
    contains() { return false; }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = null; }
    select() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    querySelectorAll() { return []; }
  }
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const actions = ['dnf', 'plus2', 'reset', 'delete'].map((action) => {
    const button = element(`action-${action}`);
    button.dataset.action = action;
    return button;
  });
  element('solveActions').querySelectorAll = () => actions;
  const document = new Element();
  document.body = new Element();
  document.activeElement = null;
  document.getElementById = element;
  document.createElement = () => new Element();
  document.querySelectorAll = (selector) => selector === '.solve-actions .result-action' ? actions
    : selector.startsWith('button, select, input') ? [...elements.values()] : [];
  const window = new Element();
  const schedule = (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay, due: now + delay }); return id; };
  window.setTimeout = schedule;
  window.clearTimeout = (id) => timers.delete(id);
  const context = vm.createContext({
    document, window, navigator: {}, customElements: { get: () => true },
    console: { error() {}, debug() {} },
    performance: { now: () => now },
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('Blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw Error('Blocked'); storage.set(key, value); },
    },
    setTimeout: schedule, clearTimeout: window.clearTimeout,
    requestAnimationFrame: (callback) => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    loadExternalModule: () => new Promise(() => {}),
  });
  vm.runInContext(source.replace(/import\('(?:https:|\/assets\/)[^']+'\)/g, 'loadExternalModule()'), context);
  return {
    run: (code) => vm.runInContext(code, context), element, window, storage,
    advance(ms) { now += ms; },
    frame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.due <= now) { timers.delete(id); timer.callback(); }
      }
    },
    holdReady(delay = 300) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, delay + 'ms start timeout scheduled');
      timers.delete(entry[0]); entry[1].callback();
    },
  };
}

test('complete startup tolerates unavailable storage and applies a saved theme', () => {
  const blocked = createApp({}, true);
  assert.equal(blocked.run('state'), 'ready');
  assert.equal(blocked.run('inspectionEnabled'), true);
  const saved = createApp({ 'bcube-timer-theme': '"cartoon"' });
  assert.equal(saved.run('document.body.dataset.palette'), 'cartoon');
});

test('rejects malformed history, invalid results/times, and oversized storage', () => {
  const app = createApp();
  assert.equal(app.run('normalizeHistory({}, "333").length'), 0);
  assert.equal(app.run('normalizeHistory([null, [], {baseTimeMs:-1}, {baseTimeMs:1,result:"bad"}, {baseTimeMs:1e100}], "333").length'), 0);
  assert.equal(app.run('normalizeScramble("<img onerror=alert(1)>")'), '');
  assert.equal(app.run('normalizeScramble("R".repeat(MAX_SCRAMBLE_LENGTH + 1))'), '');
  app.storage.set('oversized', 'x'.repeat(1000001));
  assert.equal(app.run('readStoredValue("oversized")'), null);
});

test('preserves valid/legacy solves and derives penalty times from the base time', () => {
  const app = createApp();
  assert.equal(app.run('normalizeSolve({id:1,timeMs:"12340",scramble:"R U"}, "333").baseTimeMs'), 12340);
  assert.equal(app.run('normalizeSolve({baseTimeMs:10000,timeMs:999,result:"+2"}, "333").timeMs'), 12000);
  assert.equal(app.run('normalizeSolve({result:"dnf"}, "333").timeMs'), null);
  assert.equal(app.run('normalizeHistory(Array.from({length:60}, (_,i)=>({id:i,baseTimeMs:i})), "333")[0].id'), '0');
  assert.equal(app.run('new Set(normalizeHistory([{id:"a",baseTimeMs:1},{id:"a",baseTimeMs:2}], "333").map(s=>s.id)).size'), 2);
});

test('booleans use strict defaults, and basic storage preserves every solve', () => {
  const app = createApp({ 'bcube-timer-inspection': '"false"', 'bcube-timer-hold-to-start': '{}' });
  assert.equal(app.run('inspectionEnabled'), true);
  assert.equal(app.run('holdToStartEnabled'), false);
  app.run('recentSolves = Array.from({length:60}, (_,i)=>({id:String(i),baseTimeMs:i,result:"ok"})); saveHistory()');
  const saved = JSON.parse(app.storage.get('bcube-timer-history'));
  assert.equal(saved.length, 60);
  assert.equal(saved[0].id, '0');
  assert.equal(saved[59].id, '59');
});

test('manual time entry handles ordinary times/penalties and rejects invalid numbers', () => {
  const app = createApp();
  assert.equal(app.run('parseManualTime("1234").timeMs'), 12340);
  assert.equal(app.run('parseManualTime("12.34+2").result'), '+2');
  assert.equal(app.run('parseManualTime("dnf").result'), 'dnf');
  for (const value of ['-1', 'Infinity', '<script>', '9'.repeat(64), '0']) {
    assert.equal(app.run(`parseManualTime(${JSON.stringify(value)})`), null);
  }
});

test('manual entries interpret compact minutes and explicit minute notation', () => {
  const app = createApp();
  for (const [input, expected] of [
    ['900', 9000], ['1234', 12340], ['12000', 80000], ['12345', 83450],
    ['10000', 60000], ['123456', 754560], ['0012000', 80000],
    ['1:20', 80000], ['1:20.0', 80000], ['1:20.00', 80000],
    ['12:34.56', 754560], ['120.00', 120000], ['6000', 60000],
  ]) {
    const parsed = app.run('parseManualTime(' + JSON.stringify(input) + ')');
    assert.equal(parsed.timeMs, expected, input);
    assert.equal(parsed.result, 'ok', input);
  }
  assert.equal(app.run('parseManualTime("12000+2").timeMs'), 80000);
  assert.equal(app.run('parseManualTime("1:20.00+2").result'), '+2');
  for (const input of ['1:60', '1:60.00', '1:20:00', '1:', ':20', '0:00', '1:-20']) {
    assert.equal(app.run('parseManualTime(' + JSON.stringify(input) + ')'), null, input);
  }
});

test('manual submission saves compact minute times and applies penalties to the base time', () => {
  const app = createApp({ 'bcube-timer-manual-time': 'true' });
  const input = app.element('timerDisplay');
  for (const [value, timeMs, result] of [['900', 9000, 'ok'], ['12000', 80000, 'ok'], ['12000+2', 80000, '+2']]) {
    input.value = value;
    input.dispatch('input');
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(app.run('recentSolves.at(-1).baseTimeMs'), timeMs);
    assert.equal(app.run('recentSolves.at(-1).result'), result);
    assert.equal(input.value, '', 'ready for the next manual entry');
  }
  assert.equal(app.run('formatHistoryValue(recentSolves.at(-1))'), '1:22.00 +2');
});

test('time display carries rounded hundredths into the next minute', () => {
  const app = createApp();
  for (const [timeMs, display] of [[9000, '9.00'], [80000, '1:20.00'], [59994, '59.99'],
    [59995, '1:00.00'], [60000, '1:00.00'], [119999, '2:00.00']]) {
    assert.equal(app.run('formatTime(' + timeMs + ')'), display);
  }
});

test('hide-time preference defaults off and survives toggling and reloading', () => {
  const app = createApp();
  assert.equal(app.run('hideTimeWhileSolving'), false);
  const toggle = app.element('hideTimeToggle');
  assert.equal(toggle.checked, false);
  toggle.checked = true;
  toggle.dispatch('change');
  assert.equal(app.run('hideTimeWhileSolving'), true);
  assert.equal(app.storage.get('bcube-timer-hide-time'), 'true');
  const restored = createApp(Object.fromEntries(app.storage));
  assert.equal(restored.element('hideTimeToggle').checked, true);
  restored.element('hideTimeToggle').checked = false;
  restored.element('hideTimeToggle').dispatch('change');
  assert.equal(restored.storage.get('bcube-timer-hide-time'), 'false');
  assert.equal(createApp({}, true).run('hideTimeWhileSolving'), false);
});

for (const input of ['keyboard', 'touch']) {
  test(input + ': hidden solve time keeps inspection visible and reveals the correct result on stop', () => {
    const app = createApp({ 'bcube-timer-hide-time': 'true' });
    app.run('beginInspection()');
    app.advance(1000);
    app.frame();
    assert.equal(app.element('timerDisplay').value, '14');
    const target = app.element('timerPanel');
    if (input === 'keyboard') app.window.dispatch('keydown', { key: ' ', code: 'Space', target });
    else target.dispatch('pointerdown', { pointerType: 'touch' });
    app.holdReady(100);
    if (input === 'keyboard') app.window.dispatch('keyup', { key: ' ', code: 'Space', target });
    else target.dispatch('pointerup', { pointerType: 'touch' });
    assert.equal(app.run('state'), 'solving');
    assert.equal(app.element('timerDisplay').value, '...');
    app.advance(81234);
    app.frame();
    assert.equal(app.element('timerDisplay').value, '...', 'elapsed digits stay hidden');
    if (input === 'keyboard') app.window.dispatch('keydown', { key: 'a', code: 'KeyA', target });
    else target.dispatch('pointerdown', { pointerType: 'touch' });
    assert.equal(app.run('state'), 'ready');
    assert.equal(app.run('recentSolves.at(-1).baseTimeMs'), 81234);
    assert.equal(app.element('timerDisplay').value, '1:21.23');
    app.run('resetSession()');
    assert.equal(app.element('timerDisplay').value, '0.00');
  });
}

test('live solve time remains visible when hiding is disabled', () => {
  const app = createApp();
  app.run('beginSolve()');
  assert.equal(app.element('timerDisplay').value, '0.00');
  app.advance(81234);
  app.frame();
  assert.equal(app.element('timerDisplay').value, '1:21.23');
});

for (const input of ['keyboard', 'touch']) {
  for (const delayed of [false, true]) {
    for (const inspection of [false, true]) {
      test(`${input}: release starts with delay=${delayed}, inspection=${inspection}; any key stops`, () => {
        const app = createApp();
        app.run(`holdToStartEnabled=${delayed}; inspectionEnabled=${inspection}`);
        const target = app.element('timerPanel');
        const press = () => input === 'keyboard'
          ? app.window.dispatch('keydown', { key: ' ', code: 'Space', target })
          : target.dispatch('pointerdown', { pointerType: 'touch' });
        const release = () => input === 'keyboard'
          ? app.window.dispatch('keyup', { key: ' ', code: 'Space', target })
          : target.dispatch('pointerup', { pointerType: 'touch' });
        if (inspection) { press(); release(); assert.equal(app.run('state'), 'inspecting'); }
        press();
        assert.notEqual(app.run('state'), 'solving');
        app.holdReady(delayed ? 300 : 100);
        release();
        assert.equal(app.run('state'), 'solving');
        app.advance(1234);
        app.window.dispatch('keydown', { key: 'a', code: 'KeyA', target });
        assert.equal(app.run('state'), 'ready');
        assert.equal(app.run('recentSolves.at(-1).baseTimeMs'), 1234);
      });
    }
  }
}

test('mobile supporting panels share hold, release, cancellation, and pointer ownership', () => {
  const app = createApp();
  app.run("window.matchMedia = () => ({ matches: true }); inspectionEnabled=false; holdToStartEnabled=true");
  const surface = app.element('statsPanel');
  surface.closest = (selector) => selector === '.page-shell' ? surface : null;
  const document = app.run('document');
  const touch = { target: surface, pointerType: 'touch', pointerId: 5 };
  document.dispatch('pointerdown', touch);
  assert.equal(app.run('state'), 'holding');
  document.dispatch('pointercancel', { ...touch, pointerId: 6 });
  assert.equal(app.run('state'), 'holding');
  document.dispatch('pointercancel', touch);
  assert.equal(app.run('state'), 'ready');
  document.dispatch('pointerdown', touch);
  app.holdReady();
  document.dispatch('pointerup', touch);
  assert.equal(app.run('state'), 'solving');
});

test('touching any control stops a solve and suppresses its follow-up click', () => {
  const app = createApp();
  app.run('beginSolve()');
  app.advance(1234);
  const target = app.element('menuToggle');
  let prevented = 0;
  app.window.dispatch('pointerdown', { target, pointerType: 'touch', preventDefault() { prevented++; } });
  assert.equal(app.run('state'), 'ready');
  assert.equal(app.run('recentSolves.at(-1).baseTimeMs'), 1234);
  app.window.dispatch('click', { target, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
  app.advance(701);
  app.window.dispatch('click', { target, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
});

test('early release cancels a delayed start; inspection timeout still records DNF', () => {
  const app = createApp();
  const target = app.element('timerPanel');
  app.run('holdToStartEnabled=true;inspectionEnabled=false');
  app.window.dispatch('keydown', { key: ' ', code: 'Space', target });
  app.window.dispatch('keyup', { key: ' ', code: 'Space', target });
  assert.equal(app.run('state'), 'ready');
  app.run('inspectionEnabled=true;beginInspection()');
  app.advance(15000); app.frame();
  assert.equal(app.run('state'), 'readyToSolve');
  app.run('recordInspectionDnf()');
  assert.equal(app.run('recentSolves.at(-1).result'), 'dnf');
});

test('post-solve cooldown does not cancel native releases on dialog or menu buttons', () => {
  const app = createApp();
  app.run('lastSolveStoppedAt=performance.now();justStoppedPointer=true');
  for (const target of ['copySolveScramble', 'closeSolveDetails', 'confirmClearHistory', 'action-dnf']) {
    let prevented = false;
    app.window.dispatch('pointerup', {
      target: app.element(target), pointerType: 'touch',
      preventDefault() { prevented = true; },
    });
    assert.equal(prevented, false, `${target} retains native touch activation`);
  }
});

test('touching a timer action does not cancel an in-progress hold', () => {
  const app = createApp();
  app.run('holdTimeoutId=123;isHoldReady=false');
  const button = app.element('action-dnf');
  button.closest = () => button;
  app.element('timerPanel').dispatch('pointerup', { target: button, pointerType: 'touch' });
  assert.equal(app.run('holdTimeoutId'), 123);
});

test('confirmation touch fallback handles one tap once and preserves keyboard clicks', () => {
  const app = createApp();
  app.run(`globalThis.confirmationCalls=0;globalThis.probe=document.createElement('button');
    probe.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:40});
    bindConfirmationAction(probe,()=>confirmationCalls++);
    probe.dispatch('pointerdown',{pointerType:'touch',pointerId:1,clientX:10,clientY:10});
    probe.dispatch('pointerup',{pointerType:'touch',pointerId:1,clientX:10,clientY:10});
    probe.dispatch('click');`);
  assert.equal(app.run('confirmationCalls'), 1);
  app.advance(701);
  app.run("probe.dispatch('click')");
  assert.equal(app.run('confirmationCalls'), 2);
  app.run(`probe.dispatch('pointerdown',{pointerType:'touch',pointerId:2,clientX:10,clientY:10});
    probe.dispatch('pointerup',{pointerType:'touch',pointerId:2,clientX:90,clientY:10});`);
  assert.equal(app.run('confirmationCalls'), 2, 'drag is not a tap');
  app.run("probe.disabled=true;probe.dispatch('click')");
  assert.equal(app.run('confirmationCalls'), 2, 'disabled button remains inert');
});

test('clear confirmation cancel preserves solves and confirm clears only the current event', () => {
  const app = createApp({ 'bcube-timer-history-222': '[{"id":"other","baseTimeMs":1000,"result":"ok"}]' });
  app.run('recordSolve(12340)');
  app.element('clearHistory').dispatch('click');
  assert.equal(app.element('clearHistoryDialog').open, true);
  app.element('cancelClearHistory').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 1);
  app.element('clearHistory').dispatch('click');
  app.element('confirmClearHistory').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 0);
  assert.equal(app.element('clearHistoryDialog').open, false);
  assert.equal(app.storage.get('bcube-timer-history'), '[]');
  assert.equal(JSON.parse(app.storage.get('bcube-timer-history-222')).length, 1);
});

test('read-only timer opts out of input focus; manual mode restores editing', () => {
  const app = createApp();
  assert.equal(app.element('timerDisplay').inputMode, 'none');
  assert.equal(app.element('timerDisplay').tabIndex, -1);
  app.run('manualTimeEntryEnabled=true;syncManualTimeEntry()');
  assert.equal(app.element('timerDisplay').inputMode, 'decimal');
  assert.equal(app.element('timerDisplay').tabIndex, 0);
  assert.equal(app.element('timerDisplay').readOnly, false);
});

test('accidental touch selections clear without interfering with editable targets', () => {
  const app = createApp();
  app.run(`navigator.maxTouchPoints=1;globalThis.selectionClears=0;
    window.getSelection=()=>({rangeCount:1,removeAllRanges(){selectionClears++}});
    clearAccidentalTouchSelection({target:timerPanel});`);
  assert.equal(app.run('selectionClears'), 1);
  app.run(`clearAccidentalTouchSelection({target:{closest:()=>({})}})`);
  assert.equal(app.run('selectionClears'), 1);
});

for (const holdEnabled of [false, true]) {
  test('timer touch gesture blocks the iOS loupe without double starts; hold=' + holdEnabled, () => {
    const app = createApp();
    app.run('inspectionEnabled=false;holdToStartEnabled=' + holdEnabled);
    const panel = app.element('timerPanel');
    let prevented = 0;
    const nativeTouch = () => panel.dispatch('touchstart', { touches: [{}], preventDefault() { prevented++; } });
    panel.dispatch('pointerdown', { pointerType: 'touch' });
    nativeTouch();
    assert.equal(prevented, 1);
    assert.equal(app.run('state'), 'holding');
    app.holdReady(holdEnabled ? 300 : 100);
    panel.dispatch('pointerup', { pointerType: 'touch' });
    assert.equal(app.run('state'), 'solving');
    app.advance(12340);
    panel.dispatch('pointerdown', { pointerType: 'touch' });
    nativeTouch();
    assert.equal(prevented, 2);
    assert.equal(app.run('state'), 'ready');
    assert.equal(app.run('recentSolves.length'), 1);
    assert.equal(app.run('recentSolves[0].baseTimeMs'), 12340);
  });
}

test('loupe prevention leaves controls, manual input and multi-touch alone', () => {
  const app = createApp();
  const panel = app.element('timerPanel');
  let prevented = 0;
  const dispatch = options => panel.dispatch('touchstart', { touches: [{}], preventDefault() { prevented++; }, ...options });
  const button = { closest: selector => selector === 'button, select, label, a, [role="button"]' ? button : null };
  const input = { closest: selector => selector.startsWith('input:not([readonly])') ? input : null };
  dispatch({ target: button });
  dispatch({ target: input });
  dispatch({ touches: [{}, {}] });
  app.run('manualTimeEntryEnabled=true;syncManualTimeEntry()');
  dispatch({});
  assert.equal(prevented, 0);
  assert.equal(app.element('timerDisplay').readOnly, false);
});

test('penalties, revert, and trimmed averages retain their behavior', () => {
  const app = createApp();
  app.run('recordSolve(10000); applySolveAction(String(lastSolveId), "plus2")');
  assert.equal(app.run('getSolveValue(recentSolves.at(-1))'), 12000);
  app.run('applySolveAction(String(lastSolveId), "dnf")');
  assert.equal(app.run('getSolveValue(recentSolves.at(-1))'), null);
  app.run('applySolveAction(String(lastSolveId), "reset")');
  assert.equal(app.run('getSolveValue(recentSolves.at(-1))'), 10000);
  assert.equal(app.run('getTrimmedAverage([10000,11000,12000,13000,14000].map(baseTimeMs=>({baseTimeMs,timeMs:baseTimeMs,result:"ok"})),5).value'), 12000);
  assert.equal(app.run('getTrimmedAverage(Array.from({length:5},(_,i)=>({baseTimeMs:10000,timeMs:10000,result:i<2?"dnf":"ok"})),5).isDnf'), true);
});

test('security policy disables embedding and unsafe inline handlers without blocking workers', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /script-src-attr 'none'/);
  assert.doesNotMatch(headers['Content-Security-Policy'], /(?:default|worker)-src/);
});

function deferredScrambles(app) {
  app.run(`scrambleQueues.clear(); scrambleRequestPromise = null; scrambleRequestEvent = null;
    scrambleReady = false; window.generations = []; window.resolveScrambles = [];
    getNewScramble = (event, background) => {
      window.generations.push({ event, background });
      return new Promise(resolve => window.resolveScrambles.push(resolve));
    };`);
}

test('repeated refreshes share a pending scramble instead of consuming discarded results', async () => {
  const app = createApp();
  deferredScrambles(app);
  const first = app.run('generateScramble()');
  const repeated = app.run('generateScramble()');
  assert.equal(first, repeated);
  assert.equal(app.run('window.generations.length'), 1);
  app.run('window.resolveScrambles.shift()("R U2")');
  assert.equal(await first, true);
  assert.equal(app.element('scrambleText').textContent, 'R U2');
  // Only one refill follows consumption; another click did not discard that scramble.
  assert.equal(app.run('window.generations.length'), 2);
});

test('restoring an event without a saved scramble preserves its in-flight request', async () => {
  const app = createApp();
  deferredScrambles(app);
  const first = app.run('generateScramble()');
  const restored = app.run('restoreScramble()');
  assert.equal(first, restored);
  app.run('window.resolveScrambles.shift()("F R2")');
  assert.equal(await restored, true);
});

test('inactive events receive one background scramble while the active event fills five', async () => {
  const app = createApp();
  deferredScrambles(app);
  app.run('prefetchScrambles("444", true)');
  assert.equal(app.run('window.generations[0].background'), true);
  app.run('window.resolveScrambles.shift()("Rw U2")');
  await app.run('getScrambleQueue("444").pending');
  app.run('prefetchScrambles("444", true)');
  assert.equal(app.run('getScrambleQueue("444").items.length'), 1);
  assert.equal(app.run('window.generations.length'), 1);
  app.run('prefetchScrambles("333")');
  for (let index = 0; index < 5; index++) {
    assert.equal(app.run('window.generations[window.generations.length - 1].background'), false);
    app.run('window.resolveScrambles.shift()("R U2")');
    await app.run('getScrambleQueue("333").pending');
  }
  assert.equal(app.run('getScrambleQueue("333").items.length'), 5);
  assert.equal(app.run('getScrambleQueue("333").pending'), null);
});

for (const input of ['keyboard', 'touch']) {
  for (const inspection of [false, true]) {
    test(`${input}: hold-off rejects 99ms presses and starts on release after 100ms, inspection=${inspection}`, () => {
      const app = createApp();
      app.run(`holdToStartEnabled=false;inspectionEnabled=${inspection}`);
      const target = app.element('timerPanel');
      const press = () => input === 'keyboard'
        ? app.window.dispatch('keydown', { key: ' ', code: 'Space', target })
        : target.dispatch('pointerdown', { pointerType: 'touch' });
      const release = () => input === 'keyboard'
        ? app.window.dispatch('keyup', { key: ' ', code: 'Space', target })
        : target.dispatch('pointerup', { pointerType: 'touch' });
      if (inspection) { press(); release(); }
      press(); app.tick(99); release();
      assert.equal(app.run('state'), inspection ? 'inspecting' : 'ready');
      assert.equal(app.run('holdTimeoutId'), null);
      press(); app.tick(100);
      assert.notEqual(app.run('state'), 'solving', 'Timer waits for release');
      release(); assert.equal(app.run('state'), 'solving');
      app.advance(1234);
      app.window.dispatch('keydown', { key: 'a', code: 'KeyA', target });
      assert.equal(app.run('recentSolves.at(-1).baseTimeMs'), 1234);
      // Preserve the existing touch cooldown, then check the next solve's quick-tap guard.
      app.advance(601);
      if (inspection) { press(); release(); }
      press(); app.tick(99); release();
      assert.equal(app.run('state'), inspection ? 'inspecting' : 'ready');
      press(); app.tick(100); release();
      assert.equal(app.run('state'), 'solving');
    });
  }
}

test('Alt+Z deletes the current solve and persists the same change as Delete', () => {
  const app = createApp();
  app.run('recordSolve(10000);recordSolve(12000)');
  app.window.dispatch('keydown', { key: 'z', code: 'KeyZ', altKey: true, target: app.element('timerPanel') });
  assert.equal(app.element('deleteSolveDialog').open, true);
  assert.equal(app.run('recentSolves.length'), 2, 'Confirmation does not delete immediately');
  assert.match(app.element('deleteSolveMessage').textContent, /12\.00/);
  app.element('confirmDeleteSolve').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 1);
  assert.equal(app.run('recentSolves[0].baseTimeMs'), 10000);
  assert.equal(app.run('lastSolveId'), null);
  assert.equal(JSON.parse(app.storage.get('bcube-timer-history')).length, 1);
  assert.equal(app.run('document.activeElement'), app.element('timerPanel'));
  app.window.dispatch('keydown', { key: 'z', code: 'KeyZ', altKey: true, repeat: true, target: app.element('timerPanel') });
  assert.equal(app.run('recentSolves.length'), 1);
});

test('Alt+Z deletes the selected solve when its details are open', () => {
  const app = createApp();
  app.run('recordSolve(10000);recordSolve(12000);showSolveDetails(String(recentSolves[0].id))');
  app.window.dispatch('keydown', { key: 'z', code: 'KeyZ', altKey: true, target: app.element('solveDetails') });
  assert.equal(app.run('recentSolves.length'), 2);
  assert.equal(app.element('deleteSolveDialog').open, true);
  app.element('confirmDeleteSolve').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 1);
  assert.equal(app.run('recentSolves[0].baseTimeMs'), 12000);
  assert.equal(app.element('solveDetails').open, false);
});

test('delete shortcut ignores editing, confirmation dialogs, repeats and extra modifiers', () => {
  for (const scenario of ['editing', 'confirmation', 'inspection', 'repeat', 'ctrl', 'shift', 'meta', 'no-alt']) {
    const app = createApp();
    app.run('recordSolve(12000)');
    const target = app.element('timerPanel');
    const event = { key: 'z', code: 'KeyZ', altKey: true, target };
    if (scenario === 'editing') target.closest = () => target;
    if (scenario === 'confirmation') app.element('clearHistoryDialog').open = true;
    if (scenario === 'inspection') app.run('state="inspecting"');
    if (scenario === 'repeat') event.repeat = true;
    if (scenario === 'ctrl') event.ctrlKey = true;
    if (scenario === 'shift') event.shiftKey = true;
    if (scenario === 'meta') event.metaKey = true;
    if (scenario === 'no-alt') event.altKey = false;
    app.window.dispatch('keydown', event);
    assert.equal(app.run('recentSolves.length'), 1, scenario);
  }
});

test('Ctrl+1/2/3 penalty shortcuts retain their behavior alongside Alt+Z', () => {
  const app = createApp();
  app.run('recordSolve(12000)');
  for (const [key, result] of [['2', '+2'], ['1', 'ok'], ['3', 'dnf']]) {
    app.window.dispatch('keydown', { key, ctrlKey: true, target: app.element('timerPanel') });
    assert.equal(app.run('recentSolves[0].result'), result);
  }
});

test('Alt+Z confirmation supports Cancel and dismissal without changing saved solves', () => {
  for (const cancel of ['button', 'dismiss']) {
    const app = createApp();
    app.run('recordSolve(12000)');
    const saved = app.storage.get('bcube-timer-history');
    app.window.dispatch('keydown', { key: 'z', code: 'KeyZ', altKey: true, target: app.element('timerPanel') });
    assert.equal(app.run('document.activeElement'), app.element('confirmDeleteSolve'));
    if (cancel === 'button') app.element('cancelDeleteSolve').dispatch('click');
    else app.element('deleteSolveDialog').close();
    assert.equal(app.run('recentSolves.length'), 1);
    assert.equal(app.storage.get('bcube-timer-history'), saved);
    assert.equal(app.run('pendingDeleteSolve'), null);
  }
});

test('delete confirmation owns keyboard input and does not retarget an event', () => {
  const app = createApp();
  app.run('recordSolve(12000)');
  const target = app.element('timerPanel');
  app.window.dispatch('keydown', { key: 'z', code: 'KeyZ', altKey: true, target });
  for (const event of [{ key: ' ', code: 'Space' }, { key: 'd', altKey: true }, { key: '3', ctrlKey: true }, { key: 'z', code: 'KeyZ', altKey: true, repeat: true }]) {
    app.window.dispatch('keydown', { target, ...event });
  }
  assert.equal(app.run('state'), 'ready');
  assert.equal(app.element('clearHistoryDialog').open, false);
  assert.equal(app.run('recentSolves[0].result'), 'ok');
  app.run('currentEvent="222"');
  app.element('confirmDeleteSolve').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 1);
});

test('a delayed close event cannot clear a reopened delete confirmation', () => {
  const app = createApp();
  app.run('recordSolve(12000)');
  const shortcut = { key: 'z', code: 'KeyZ', altKey: true, target: app.element('timerPanel') };
  app.window.dispatch('keydown', shortcut);
  app.element('cancelDeleteSolve').dispatch('click');
  app.window.dispatch('keydown', shortcut);
  app.element('deleteSolveDialog').dispatch('close');
  assert.notEqual(app.run('pendingDeleteSolve'), null);
  app.element('confirmDeleteSolve').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 0);
});


function seedStats(app, seconds) {
  app.run('recentSolves=' + JSON.stringify(seconds.map((seconds, index) => ({
    id: String(index), baseTimeMs: seconds * 1000, result: 'ok', scramble: 'R U' + (index % 2 ? '2' : ''),
  }))) + '; renderStats()');
}

test('Best Single opens the existing details for the fastest penalized solve', () => {
  const app = createApp();
  assert.equal(app.element('stat-bestSingle').disabled, true);
  seedStats(app, [12, 11, 10]);
  app.run('applySolveAction("2", "plus2")');
  app.element('stat-bestSingle').dispatch('click');
  assert.equal(app.element('solveDetails').open, true);
  assert.equal(app.run('selectedSolveId'), '1');
  assert.equal(app.element('solveDetailTime').textContent, '11.00');
  assert.equal(app.element('solveDetailScramble').textContent, 'R U2');
});

test('current Ao5 and Ao12 export their chronological windows and exact exclusions', () => {
  const app = createApp();
  seedStats(app, [1, 2, 3, 4]);
  assert.equal(app.element('stat-avg5').disabled, true);
  assert.equal(app.element('stat-avg12').disabled, true);
  seedStats(app, [30, 1, 9, 2, 8, 3, 7, 4, 6, 5, 10, 11]);
  app.element('stat-avg5').dispatch('click');
  assert.equal(app.element('averageDetails').open, true);
  assert.equal(app.element('averageDetailsText').textContent, [
    'Average of 5: 7.00', 'BTime — Scrambles Powered by TNoodle', '(4.00) - R U2', '6.00 - R U',
    '5.00 - R U2', '10.00 - R U', '(11.00) - R U2',
  ].join('\n'));
  assert.equal(app.element('avg5').textContent, '7.00');
  app.element('closeAverageDetails').dispatch('click');
  app.element('stat-avg12').dispatch('click');
  const lines = app.element('averageDetailsText').textContent.split('\n');
  assert.equal(lines[0], 'Average of 12: 6.50');
  assert.equal(lines.length, 14);
  assert.equal(lines[2], '(30.00) - R U');
  assert.equal(lines[3], '(1.00) - R U2');
  assert.equal(lines.filter(line => line.startsWith('(')).length, 2);
});

test('Best Ao5 opens its winning window, retains earliest ties, and tracks edits/deletions', () => {
  const app = createApp();
  seedStats(app, [10, 11, 12, 13, 14, 50, 51, 52, 53, 54]);
  app.element('stat-bestAvg5').dispatch('click');
  assert.match(app.element('averageDetailsText').textContent, /^Average of 5: 12.00\n/);
  assert.equal(app.element('averageDetailsText').textContent.includes('50.00'), false);
  app.element('averageDetails').close();
  app.run('applySolveAction("1", "plus2"); applySolveAction("2", "delete")');
  assert.equal(app.element('bestAvg5').textContent, '13.33');
  app.element('stat-bestAvg5').dispatch('click');
  assert.match(app.element('averageDetailsText').textContent, /^Average of 5: 13.33\n/);
  assert.match(app.element('averageDetailsText').textContent, /13.00 \+2/);
  app.element('averageDetails').close();
  seedStats(app, [10, 10, 10, 10, 10, 10]);
  assert.equal(app.run('getBestAverage(recentSolves,5).solves[0].id'), '0');
});

test('averages trim two distinct ties and handle +2, one DNF, and multiple DNFs', () => {
  const app = createApp();
  seedStats(app, [10, 10, 10, 10, 10]);
  assert.deepEqual(Array.from(app.run('getTrimmedAverage(recentSolves,5).excludedIndices')), [0, 4]);
  app.run('applySolveAction("0","plus2"); applySolveAction("4","dnf")');
  app.element('stat-avg5').dispatch('click');
  const lines = app.element('averageDetailsText').textContent.split('\n');
  assert.equal(lines[0], 'Average of 5: 10.67');
  assert.equal(lines[2], '12.00 +2 - R U');
  assert.equal(lines[3], '(10.00) - R U2');
  assert.equal(lines[6], '(DNF) - R U');
  app.element('averageDetails').close();
  app.run('applySolveAction("3","dnf")');
  assert.equal(app.element('avg5').textContent, 'DNF');
  assert.equal(app.element('stat-avg5').disabled, false);
  assert.equal(app.element('stat-bestAvg5').disabled, true);
  app.element('stat-avg5').dispatch('click');
  assert.match(app.element('averageDetailsText').textContent, /^Average of 5: DNF\n/);
});

test('stats follow event changes and recover availability after a timed solve or clear', () => {
  const app = createApp();
  seedStats(app, [10, 11, 12, 13, 14]);
  app.run('beginSolve()');
  assert.equal(app.element('stat-avg5').disabled, true);
  assert.equal(app.element('stat-avg12').disabled, true);
  app.advance(10000);
  app.run('finishSolve()');
  assert.equal(app.element('stat-avg5').disabled, false);
  assert.equal(app.element('stat-avg12').disabled, true);
  app.element('eventSelect').value = '222';
  app.element('eventSelect').dispatch('change');
  assert.equal(app.element('stat-avg5').disabled, true);
  seedStats(app, [20, 21, 22, 23, 24]);
  app.element('stat-avg5').dispatch('click');
  assert.equal(app.element('averageDetailsTitle').textContent, 'Ao5 · 2x2');
  app.element('averageDetails').close();
  app.element('clearHistory').dispatch('click');
  app.element('confirmClearHistory').dispatch('click');
  assert.equal(app.element('stat-bestSingle').disabled, true);
  assert.equal(app.element('stat-avg5').disabled, true);
});

test('average dialog owns timer and penalty shortcuts without changing solves', () => {
  const app = createApp();
  seedStats(app, [10, 11, 12, 13, 14]);
  app.run('lastSolveId="4"');
  app.element('stat-avg5').dispatch('click');
  for (const event of [{ key:' ', code:'Space' }, { key:'z', altKey:true }, { key:'d', altKey:true }, { key:'3', ctrlKey:true }]) {
    app.window.dispatch('keydown', { target: app.element('averageDetails'), ...event });
  }
  assert.equal(app.run('state'), 'ready');
  assert.equal(app.run('recentSolves.length'), 5);
  assert.equal(app.run('recentSolves[4].result'), 'ok');
  assert.equal(app.element('clearHistoryDialog').open, false);
  assert.equal(app.element('deleteSolveDialog').open, false);
});

test('average copy supports the Clipboard API, fallback, and failure feedback', async () => {
  const app = createApp();
  seedStats(app, [10, 11, 12, 13, 14]);
  app.element('stat-avg5').dispatch('click');
  app.run('navigator.clipboard={writeText: async text => { window.copied=text; }}');
  app.element('copyAverageDetails').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.run('window.copied'), app.element('averageDetailsText').textContent);
  assert.equal(app.element('copyAverageStatus').textContent, 'Average copied.');
  app.run('navigator.clipboard=undefined; document.execCommand=()=>true');
  app.element('copyAverageDetails').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.element('copyAverageStatus').textContent, 'Average copied.');
  assert.equal(app.run('scrambleCopyFallbackText'), null);
  app.run('document.execCommand=()=>false');
  app.element('copyAverageDetails').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.element('copyAverageStatus').textContent, 'Unable to copy. Please try again.');
});


for (const size of [25, 50, 100]) {
  test('Ao' + size + ' uses its latest window, trims 5%, and exports the same breakdown', () => {
    const app = createApp();
    seedStats(app, Array.from({length:size-1}, () => 10));
    assert.equal(app.element('stat-avg' + size).disabled, true);
    assert.equal(app.element('avg' + size).textContent, '--');
    seedStats(app, [999, ...Array.from({length:size}, (_,i) => i+1)]);
    const average = app.run('getTrimmedAverage(recentSolves,' + size + ')');
    assert.equal(average.value, (size+1)*500);
    assert.equal(average.solves[0].id, '1', 'older solve excluded from the window');
    assert.equal(average.excludedIndices.length, Math.ceil(size*0.05)*2);
    app.element('stat-avg' + size).dispatch('click');
    const lines = app.element('averageDetailsText').textContent.split('\n');
    assert.equal(lines.length, size+2);
    assert.equal(lines[0], 'Average of ' + size + ': ' + app.element('avg' + size).textContent);
    assert.equal(lines.filter(line => line.startsWith('(')).length, Math.ceil(size*0.05)*2);
    assert.equal(lines.some(line => line.includes('16:39.00')), false);
    app.element('averageDetails').close();
    app.run('beginSolve()');
    assert.equal(app.element('stat-avg' + size).disabled, true);
    app.run('resetSession()');
    app.element('clearHistory').dispatch('click');
    app.element('confirmClearHistory').dispatch('click');
    assert.equal(app.element('stat-avg' + size).disabled, true);
    assert.equal(app.element('avg' + size).textContent, '--');
  });

  test('Ao' + size + ' handles tied exclusions, +2, and its DNF threshold', () => {
    const app = createApp();
    seedStats(app, Array.from({length:size}, () => 10));
    const trim = Math.ceil(size*0.05);
    const original = app.run('getTrimmedAverage(recentSolves,' + size + ')');
    assert.equal(new Set(original.excludedIndices).size, trim*2);
    assert.deepEqual(Array.from(original.excludedIndices), [...Array.from({length:trim},(_,i)=>i), ...Array.from({length:trim},(_,i)=>size-trim+i)]);
    app.run('recentSolves[0].result="+2";renderStats()');
    assert.equal(app.run('getTrimmedAverage(recentSolves,' + size + ').value'), 10000, '+2 is ranked before exclusions');
    for (let i=0;i<trim;i++) app.run('recentSolves[' + (size-1-i) + '].result="dnf"');
    app.run('renderStats()');
    assert.equal(app.run('getTrimmedAverage(recentSolves,' + size + ').isDnf'), false);
    app.run('recentSolves[' + (size-1-trim) + '].result="dnf";renderStats()');
    assert.equal(app.element('avg' + size).textContent, 'DNF');
    assert.equal(app.element('stat-avg' + size).disabled, false);
  });
}

test('unchanged history refreshes preserve record buttons during asynchronous saves', () => {
  const app = createApp();
  app.run('recordSolve(12000)');
  const item = app.element('solveList').children[0];
  app.run('renderHistory(); renderStats(); renderHistory()');
  assert.equal(app.element('solveList').children[0], item);
});

test('3x3 OH has independent saved history, statistics and selection', () => {
  const regular = Array.from({ length: 5 }, (_, i) => ({ id: 'regular-' + i, baseTimeMs: 10000 + i * 1000, result: 'ok', scramble: 'R U2 F2' }));
  const oh = Array.from({ length: 5 }, (_, i) => ({ id: 'oh-' + i, baseTimeMs: 20000 + i * 1000, result: 'ok', scramble: "F R U2 R'" }));
  const app = createApp({ 'bcube-timer-event': '333oh', 'bcube-timer-history': JSON.stringify(regular),
    'bcube-timer-history-333oh': JSON.stringify(oh) });
  assert.equal(app.run('currentEvent'), '333oh');
  assert.equal(app.element('eventSelect').value, '333oh');
  assert.equal(app.element('avg5').textContent, '22.00');
  assert.equal(app.run('recentSolves[0].tag'), '3x3 OH');
  assert.notEqual(app.run("eventStorageKey('333oh')"), app.run("eventStorageKey('333')"));
  app.run('recordSolve(15000)');
  assert.equal(JSON.parse(app.storage.get('bcube-timer-history')).length, 5);
  assert.equal(JSON.parse(app.storage.get('bcube-timer-history-333oh')).length, 6);
  app.run("updateScrambleVisualization('333oh', 'R U2 F2');openSolveDetails(String(lastSolveId))");
  assert.equal(app.run("scrambleVisualization.getAttribute('event')"), '333');
  assert.equal(app.element('solveDetailDrawing').children[0].getAttribute('event'), '333');
  app.element('solveDetails').close();
  const restored = createApp(Object.fromEntries(app.storage));
  assert.equal(restored.run('currentEvent'), '333oh');
  assert.equal(restored.run('recentSolves.length'), 6);
  app.element('eventSelect').value = '333'; app.element('eventSelect').dispatch('change');
  assert.equal(app.run('recentSolves.length'), 5);
  assert.equal(app.element('avg5').textContent, '12.00');
  app.element('eventSelect').value = '333oh'; app.element('eventSelect').dispatch('change');
  app.element('clearHistory').dispatch('click'); app.element('confirmClearHistory').dispatch('click');
  assert.equal(app.run('recentSolves.length'), 0);
  assert.equal(JSON.parse(app.storage.get('bcube-timer-history')).length, 5);
});

test('3x3 OH uses and validates the ordinary 3x3 engine without sending a new worker code', async () => {
  const app = createApp();
  app.run(`currentEvent='333oh';tnoodleScramblerPromise=null;
    window.engineCalls=[];window.activeCodes=[];window.samples=['INVALID', "R U2 F2"];
    loadExternalModule=async()=>({
      setActiveEvent:code=>window.activeCodes.push(code),
      randomScrambleForEvent:async(code,options)=>{window.engineCalls.push({code,background:options.background});return window.samples.shift();}
    });`);
  assert.equal(await app.run("getNewScramble('333oh')"), 'R U2 F2');
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(window.engineCalls)')), [{ code: '333', background: false }, { code: '333', background: false }]);
  assert.equal(app.run('window.activeCodes.every(code=>code==="333")'), true);
  assert.notEqual(app.run("getScrambleQueue('333oh')"), app.run("getScrambleQueue('333')"));
});
