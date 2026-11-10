// IndexedDB keeps full history on disk; each solve touches only nearby Ao5 windows.
const DATABASE = 'btime-history';
const STORES = ['solves', 'averages', 'events'];
const PAGE_SIZE = 50;
const AVERAGE_SIZES = [5, 12, 25, 50, 100];
const RECENT_SOLVE_LIMIT = Math.max(...AVERAGE_SIZES);
const MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;

function valueOf(solve) {
  return solve.result === 'dnf' ? null : solve.baseTimeMs + (solve.result === '+2' ? 2000 : 0);
}

export function averageOf(solves, size) {
  if (solves.length < size) return { value: null, isDnf: false, solves: [], excludedIndices: [] };
  const window = solves.slice(-size);
  const ranked = window.map((solve, index) => ({ index, value: valueOf(solve) ?? Infinity }))
    .sort((a, b) => (a.value - b.value) || a.index - b.index);
  const trimCount = Math.ceil(size * 0.05);
  const counted = ranked.slice(trimCount, -trimCount);
  const isDnf = counted.some(solve => !Number.isFinite(solve.value));
  return { value: isDnf ? null : counted.reduce((sum, solve) => sum + solve.value, 0) / counted.length,
    isDnf, solves: window, excludedIndices: [...ranked.slice(0, trimCount), ...ranked.slice(-trimCount)].map(solve => solve.index) };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function emptyEvent(eventCode) {
  return { eventCode, count: 0, validCount: 0, total: 0, nextSequence: 0 };
}

function adjustTotals(meta, solve, direction) {
  const value = valueOf(solve);
  meta.count += direction;
  if (value !== null) { meta.validCount += direction; meta.total += direction * value; }
  if (!meta.validCount) meta.total = 0;
}

function storedSolve(entry, eventCode, sequence) {
  const row = { ...entry, eventCode, sequence, reverseSequence: -sequence };
  const value = valueOf(row);
  delete row.sortValue;
  if (value !== null) row.sortValue = value;
  row.timeMs = value;
  return row;
}

export async function openHistoryStore() {
  const opening = indexedDB.open(DATABASE, 2);
  opening.onupgradeneeded = event => {
    const db = opening.result;
    const solves = event.oldVersion === 0 ? db.createObjectStore('solves', { keyPath: ['eventCode', 'sequence'] })
      : opening.transaction.objectStore('solves');
    if (event.oldVersion === 0) {
      solves.createIndex('byId', ['eventCode', 'id'], { unique: true });
      solves.createIndex('byValue', ['eventCode', 'sortValue', 'sequence']);
      const averages = db.createObjectStore('averages', { keyPath: ['eventCode', 'endSequence'] });
      averages.createIndex('byValue', ['eventCode', 'value', 'endSequence']);
      db.createObjectStore('events', { keyPath: 'eventCode' });
    }
    solves.createIndex('byNewest', ['eventCode', 'reverseSequence']);
    if (event.oldVersion === 1) {
      const cursorRequest = solves.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        cursor.update({ ...cursor.value, reverseSequence: -cursor.value.sequence });
        cursor.continue();
      };
    }
  };
  const db = await new Promise((resolve, reject) => {
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('Close other BTime tabs, then retry loading history.'));
  });
  db.onversionchange = () => db.close();

  const range = (eventCode, lower = 0, upper = MAX_SEQUENCE, lowerOpen = false, upperOpen = false) =>
    IDBKeyRange.bound([eventCode, lower], [eventCode, upper], lowerOpen, upperOpen);
  const valueRange = eventCode => IDBKeyRange.bound([eventCode, 0], [eventCode, MAX_SEQUENCE, MAX_SEQUENCE]);

  async function transaction(mode, work) {
    const tx = db.transaction(STORES, mode);
    const complete = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('History transaction aborted.'));
      tx.onerror = () => {}; // The abort event reports transaction failures.
    });
    complete.catch(() => {});
    try {
      const result = await work(tx);
      await complete;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* Already committed/aborted. */ }
      throw error;
    }
  }

  function rows(store, query, direction = 'prev', limit = PAGE_SIZE) {
    if (direction === 'next') return requestResult(store.getAll(query, limit));
    // A reverse-sequence index lets all browsers fetch a page in one request.
    // Per-record cursor callbacks are disproportionately expensive in mobile WebKit.
    const eventCode = query.lower[0];
    const reversed = IDBKeyRange.bound([eventCode, -query.upper[1]], [eventCode, -query.lower[1]],
      query.upperOpen, query.lowerOpen);
    return requestResult(store.index('byNewest').getAll(reversed, limit));
  }

  function putAverage(store, eventCode, solves) {
    if (solves.length < 5) return;
    const average = averageOf(solves, 5);
    const endSequence = solves[solves.length - 1].sequence;
    if (!average.isDnf) store.put({ eventCode, endSequence, value: average.value,
      sequences: average.solves.map(solve => solve.sequence) });
  }

  return {
    close: () => db.close(),
    async migrate(eventCode, entries) {
      await transaction('readwrite', async tx => {
        const events = tx.objectStore('events');
        if (await requestResult(events.get(eventCode))) return;
        const meta = emptyEvent(eventCode);
        const tail = [];
        for (const entry of entries) {
          const row = storedSolve(entry, eventCode, ++meta.nextSequence);
          tx.objectStore('solves').put(row);
          adjustTotals(meta, row, 1);
          tail.push(row);
          if (tail.length > 5) tail.shift();
          putAverage(tx.objectStore('averages'), eventCode, tail);
        }
        events.put(meta); // A committed marker makes migration idempotent, including empty histories.
      });
    },
    async append(eventCode, entry) {
      await transaction('readwrite', async tx => {
        const solves = tx.objectStore('solves');
        if (await requestResult(solves.index('byId').get([eventCode, String(entry.id)]))) return;
        const meta = await requestResult(tx.objectStore('events').get(eventCode)) || emptyEvent(eventCode);
        const tail = (await rows(solves, range(eventCode), 'prev', 4)).reverse();
        const row = storedSolve(entry, eventCode, ++meta.nextSequence);
        solves.put(row);
        adjustTotals(meta, row, 1);
        tail.push(row);
        putAverage(tx.objectStore('averages'), eventCode, tail);
        tx.objectStore('events').put(meta);
      });
    },
    async change(eventCode, id, action) {
      await transaction('readwrite', async tx => {
        const solves = tx.objectStore('solves');
        const old = await requestResult(solves.index('byId').get([eventCode, String(id)]));
        if (!old) return;
        const meta = await requestResult(tx.objectStore('events').get(eventCode));
        const before = (await rows(solves, range(eventCode, 0, old.sequence, false, true), 'prev', 4)).reverse();
        const after = await rows(solves, range(eventCode, old.sequence, MAX_SEQUENCE, true), 'next', 4);
        const averages = tx.objectStore('averages');
        adjustTotals(meta, old, -1);
        const changed = action === 'delete' ? null : storedSolve({ ...old,
          result: action === 'dnf' ? 'dnf' : action === 'plus2' ? '+2' : 'ok',
        }, eventCode, old.sequence);
        if (changed) { solves.put(changed); adjustTotals(meta, changed, 1); }
        else solves.delete([eventCode, old.sequence]);
        averages.delete([eventCode, old.sequence]);
        const nearby = [...before, ...(changed ? [changed] : []), ...after];
        // Only windows ending at the changed solve or its next four neighbours can differ.
        for (const row of [...(changed ? [changed] : []), ...after]) {
          averages.delete([eventCode, row.sequence]);
          const end = nearby.indexOf(row) + 1;
          putAverage(averages, eventCode, nearby.slice(Math.max(0, end - 5), end));
        }
        tx.objectStore('events').put(meta);
      });
    },
    async clear(eventCode) {
      await transaction('readwrite', async tx => {
        const previous = await requestResult(tx.objectStore('events').get(eventCode));
        tx.objectStore('solves').delete(range(eventCode));
        tx.objectStore('averages').delete(range(eventCode));
        tx.objectStore('events').put({ ...emptyEvent(eventCode), nextSequence: previous?.nextSequence || 0 });
      });
    },
    async snapshot(eventCode, before = null) {
      return transaction('readonly', async tx => {
        const solves = tx.objectStore('solves');
        const [meta, latestRows, pageRows, bestRows, bestWindows, pageOffset] = await Promise.all([
          requestResult(tx.objectStore('events').get(eventCode)),
          rows(solves, range(eventCode), 'prev', RECENT_SOLVE_LIMIT),
          rows(solves, before === null ? range(eventCode) : range(eventCode, 0, before, false, true), 'prev', PAGE_SIZE + 1),
          rows(solves.index('byValue'), valueRange(eventCode), 'next', 1),
          rows(tx.objectStore('averages').index('byValue'), valueRange(eventCode), 'next', 1),
          before === null ? Promise.resolve(0) : requestResult(solves.count(range(eventCode, before))),
        ]);
        const bestWindow = bestWindows[0];
        const bestSolves = bestWindow ? await Promise.all(bestWindow.sequences.map(sequence =>
          requestResult(solves.get([eventCode, sequence])))) : [];
        const latest = latestRows.reverse();
        return { ...(meta || emptyEvent(eventCode)), latest,
          page: pageRows.slice(0, PAGE_SIZE).reverse(), pageOffset, hasOlder: pageRows.length > PAGE_SIZE,
          bestSingle: bestRows[0] || null,
          bestAvg5: bestSolves.length === 5 && bestSolves.every(Boolean) ? averageOf(bestSolves, 5) : null,
          ...Object.fromEntries(AVERAGE_SIZES.map(size => ['avg' + size, averageOf(latest, size)])),
        };
      });
    },
  };
}
