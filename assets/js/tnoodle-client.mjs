// Keep TNoodle's synchronous Java algorithms off the timer's UI thread.
const events = new Set(['222', '333', '444', '555', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1']);
const pending = new Map();
let worker = null;
let nextId = 0;

function failWorker(instance, error) {
  if (worker !== instance) return;
  worker = null;
  instance.terminate();
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(error);
  }
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  const instance = new Worker(new URL('./tnoodle-worker.mjs', import.meta.url), {
    type: 'module', name: 'btime-tnoodle',
  });
  worker = instance;
  instance.addEventListener('message', ({ data }) => {
    if (worker !== instance) return;
    const request = pending.get(data?.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timeout);
    if (data.error) request.reject(new Error(data.error));
    else if (typeof data.scramble === 'string' && data.scramble.trim()) request.resolve(data.scramble);
    else request.reject(new Error('TNoodle returned an empty or invalid scramble.'));
  });
  instance.addEventListener('error', (event) => {
    event.preventDefault();
    failWorker(instance, new Error(event.message || 'Unable to load the TNoodle worker.'));
  });
  instance.addEventListener('messageerror', () => {
    failWorker(instance, new Error('Unable to read the TNoodle worker response.'));
  });
  return instance;
}

export function randomScrambleForEvent(eventCode) {
  if (!events.has(eventCode)) return Promise.reject(new Error(`Unsupported event: ${eventCode}`));
  return new Promise((resolve, reject) => {
    const instance = getWorker();
    const id = ++nextId;
    // Large puzzle tables initialize once per worker; slower phones need extra time.
    const timeout = setTimeout(() => {
      failWorker(instance, new Error('TNoodle generation timed out. Select New scramble to retry.'));
    }, 180000);
    pending.set(id, { resolve, reject, timeout });
    try { instance.postMessage({ id, eventCode }); }
    catch (error) { failWorker(instance, error); }
  });
}
