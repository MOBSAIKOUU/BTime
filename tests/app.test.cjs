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
      const event = { target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...options };
      for (const callback of this.listeners.get(type) || []) callback(event);
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    replaceWith() {}
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
  const schedule = (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id; };
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
  vm.runInContext(source.replace(/import\('(?:https:|\/assets\/vendor\/)[^']+'\)/g, 'loadExternalModule()'), context);
  return {
    run: (code) => vm.runInContext(code, context), element, window, storage,
    advance(ms) { now += ms; },
    frame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); },
    holdReady() {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === 300);
      assert.ok(entry, 'hold timeout scheduled');
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
  assert.equal(app.run('normalizeHistory(Array.from({length:60}, (_,i)=>({id:i,baseTimeMs:i})), "333")[0].id'), '10');
  assert.equal(app.run('new Set(normalizeHistory([{id:"a",baseTimeMs:1},{id:"a",baseTimeMs:2}], "333").map(s=>s.id)).size'), 2);
});

test('booleans use strict defaults, and history saves the newest fifty records', () => {
  const app = createApp({ 'bcube-timer-inspection': '"false"', 'bcube-timer-hold-to-start': '{}' });
  assert.equal(app.run('inspectionEnabled'), true);
  assert.equal(app.run('holdToStartEnabled'), false);
  app.run('recentSolves = Array.from({length:60}, (_,i)=>({id:String(i),baseTimeMs:i,result:"ok"})); saveHistory()');
  const saved = JSON.parse(app.storage.get('bcube-timer-history'));
  assert.equal(saved.length, 50);
  assert.equal(saved[0].id, '10');
  assert.equal(saved[49].id, '59');
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
        if (delayed) app.holdReady();
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
