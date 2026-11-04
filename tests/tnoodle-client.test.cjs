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
  return (await import(url.href)).randomScrambleForEvent;
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
