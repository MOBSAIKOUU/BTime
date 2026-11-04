const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const originalWorker = global.Worker;
let clients = 0;
let workers = [];

class FakeWorker {
  constructor(url, options) { this.url = url; this.options = options; this.listeners = {}; this.sent = []; workers.push(this); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  postMessage(data) { this.sent.push(data); }
  terminate() { this.terminated = true; }
  respond(data) { this.listeners.message({ data }); }
  fail() { this.listeners.error({ message: 'Worker failed', preventDefault() {} }); }
}
async function client() {
  global.Worker = FakeWorker;
  const url = pathToFileURL(path.resolve(__dirname, '../assets/js/tnoodle-client.mjs'));
  url.search = '?test=' + ++clients;
  const module = await import(url.href);
  return Object.assign(module.randomScrambleForEvent, { setActiveEvent: module.setActiveEvent });
}
test.afterEach(() => { for (const worker of workers) worker.fail(); workers = []; global.Worker = originalWorker; });

test('TNoodle correlates concurrent event requests and reuses its worker', async () => {
  const generate = await client();
  const first = generate('333'), second = generate('777');
  assert.equal(workers.length, 1);
  const worker = workers[0];
  assert.equal(worker.options.type, 'module');
  worker.respond({ id: worker.sent[1].id, scramble: '3Rw U2' });
  worker.respond({ id: worker.sent[0].id, scramble: "R U R'" });
  assert.deepEqual(await Promise.all([first, second]), ["R U R'", '3Rw U2']);
});
test('unsupported events fail without starting a worker', async () => {
  const generate = await client();
  await assert.rejects(generate('unknown'), /Unsupported event/);
  assert.equal(workers.length, 0);
});
test('worker failure rejects all waiting requests and a subsequent request restarts it', async () => {
  const generate = await client();
  const first = assert.rejects(generate('333'), /Worker failed/);
  const second = assert.rejects(generate('444'), /Worker failed/);
  workers[0].fail();
  await Promise.all([first, second]);
  assert.equal(workers[0].terminated, true);
  const retry = generate('333');
  assert.equal(workers.length, 2);
  workers[1].respond({ id: workers[1].sent[0].id, scramble: 'R U2 F' });
  assert.equal(await retry, 'R U2 F');
});
test('a generation error is reported without discarding unrelated results', async () => {
  const generate = await client();
  const failed = assert.rejects(generate('444'), /Unable to load/);
  const success = generate('333');
  workers[0].respond({ id: workers[0].sent[0].id, error: 'Unable to load TNoodle 4x4 tables.' });
  workers[0].respond({ id: workers[0].sent[1].id, scramble: 'R U2' });
  await failed;
  assert.equal(await success, 'R U2');
});
test('empty responses never become a displayed scramble', async () => {
  const generate = await client();
  const rejected = assert.rejects(generate('333'), /empty or invalid/);
  workers[0].respond({ id: workers[0].sent[0].id, scramble: '' });
  await rejected;
});

test('slow inactive warmups cannot queue ahead of active-event generation', async () => {
  const generate = await client();
  const active = generate('333');
  const warmup = generate('444', { background: true });
  assert.equal(workers.length, 2);
  workers[0].respond({ id: workers[0].sent[0].id, scramble: 'R U2' });
  assert.equal(await active, 'R U2');
  const refill = generate('333');
  workers[0].respond({ id: workers[0].sent[1].id, scramble: 'F R2' });
  assert.equal(await refill, 'F R2');
  // The inactive 4x4 has not completed either time the active event was served.
  workers[1].respond({ id: workers[1].sent[0].id, scramble: 'Rw U2' });
  assert.equal(await warmup, 'Rw U2');
});

test('switching to a warmed event promotes its worker without another initialization', async () => {
  const generate = await client();
  const oldActive = generate('333');
  const warmup = generate('444', { background: true });
  workers[1].respond({ id: workers[1].sent[0].id, scramble: 'Rw U2' });
  await warmup;
  generate.setActiveEvent('444');
  const next = generate('444');
  assert.equal(workers.length, 2);
  assert.equal(workers[1].sent.length, 2);
  workers[1].respond({ id: workers[1].sent[1].id, scramble: 'Uw R2' });
  assert.equal(await next, 'Uw R2');
  workers[0].respond({ id: workers[0].sent[0].id, scramble: 'R U' });
  await oldActive;
});

test('event switches free the active lane while retaining at most two live workers', async () => {
  const generate = await client();
  const previous = generate('444');
  const cancelled = assert.rejects(generate('555', { background: true }), { name: 'AbortError' });
  generate.setActiveEvent('333');
  await cancelled;
  const current = generate('333');
  assert.equal(workers.filter(worker => !worker.terminated).length, 2);
  workers[2].respond({ id: workers[2].sent[0].id, scramble: 'R U' });
  assert.equal(await current, 'R U');
  workers[0].respond({ id: workers[0].sent[0].id, scramble: 'Rw U' });
  assert.equal(await previous, 'Rw U');
});
