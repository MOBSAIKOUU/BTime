// Keep active scrambles independent of slow background warmups, using at most two workers.
const events = new Set(['222', '333', '444', '555', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1']);
const pending = new Map();
let activeWorker = null;
let backgroundWorker = null;
let activeEvent = null;
let nextId = 0;

function failWorker(slot, error) {
  if (activeWorker !== slot && backgroundWorker !== slot) return;
  if (activeWorker === slot) activeWorker = null;
  if (backgroundWorker === slot) backgroundWorker = null;
  slot.worker.terminate();
  for (const [id, request] of pending) {
    if (request.slot !== slot) continue;
    clearTimeout(request.timeout);
    pending.delete(id);
    request.reject(error);
  }
}

export function setActiveEvent(eventCode) {
  if (!events.has(eventCode) || activeEvent === eventCode) return;
  activeEvent = eventCode;
  // Reuse a warmed engine, including its initialized 4x4 tables, on event switches.
  if (backgroundWorker?.eventCode === eventCode) {
    [activeWorker, backgroundWorker] = [backgroundWorker, activeWorker];
  } else if (activeWorker && activeWorker.eventCode !== eventCode &&
      [...pending.values()].some(request => request.slot === activeWorker)) {
    // Retain the old active calculation in the background and free the active lane.
    if (backgroundWorker) {
      const error = new Error('Background warmup superseded by an event switch.');
      error.name = 'AbortError';
      failWorker(backgroundWorker, error);
    }
    backgroundWorker = activeWorker;
    activeWorker = null;
  }
}

function getWorker(background) {
  const existing = background ? backgroundWorker : activeWorker;
  if (existing) return existing;
  const slot = { worker: new Worker(new URL('./tnoodle-worker.mjs', import.meta.url), {
    type: 'module', name: background ? 'btime-tnoodle-warmup' : 'btime-tnoodle-active',
  }), eventCode: null };
  if (background) backgroundWorker = slot;
  else activeWorker = slot;
  slot.worker.addEventListener('message', ({ data }) => {
    const request = pending.get(data?.id);
    if (!request || request.slot !== slot) return;
    pending.delete(data.id);
    clearTimeout(request.timeout);
    if (data.error) request.reject(new Error(data.error));
    else if (typeof data.scramble === 'string' && data.scramble.trim()) request.resolve(data.scramble);
    else request.reject(new Error('TNoodle returned an empty or invalid scramble.'));
  });
  slot.worker.addEventListener('error', (event) => {
    event.preventDefault();
    failWorker(slot, new Error(event.message || 'Unable to load the TNoodle worker.'));
  });
  slot.worker.addEventListener('messageerror', () => {
    failWorker(slot, new Error('Unable to read the TNoodle worker response.'));
  });
  return slot;
}

export function randomScrambleForEvent(eventCode, { background = false } = {}) {
  if (!events.has(eventCode)) return Promise.reject(new Error(`Unsupported event: ${eventCode}`));
  if (!activeEvent && !background) setActiveEvent(eventCode);
  return new Promise((resolve, reject) => {
    const slot = getWorker(background);
    slot.eventCode = eventCode;
    const id = ++nextId;
    const timeout = setTimeout(() => {
      failWorker(slot, new Error('TNoodle generation timed out. Select New scramble to retry.'));
    }, 180000);
    pending.set(id, { resolve, reject, timeout, slot });
    try { slot.worker.postMessage({ id, eventCode }); }
    catch (error) { failWorker(slot, error); }
  });
}
