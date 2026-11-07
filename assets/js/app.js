/**
 * @file BTime - Rubik's Cube Speedcubing Timer Application
 * @description Provides offline TNoodle scramble generation, 15s WCA inspection,
 * spacebar/touch timing, manual time entry, Ao5/Ao12 session statistics,
 * solve penalty management (DNF/+2), and multi-event support.
 */
/* ==========================================================================
   1. DOM Element Cache & Constants
   ========================================================================== */

// Scramble & Visualizer Elements
const scrambleText = document.getElementById('scrambleText');
let scrambleVisualization = document.getElementById('scrambleVisualization');
const scrambleVisualStatus = document.getElementById('scrambleVisualStatus');
const newScrambleButton = document.getElementById('newScramble');

// Timer Elements
const timerPanel = document.getElementById('timerPanel');
const timerDisplay = document.getElementById('timerDisplay');
const timerState = document.getElementById('timerState');

// Solve Actions & History Elements
const solveActions = document.getElementById('solveActions');
const solveList = document.getElementById('solveList');
const eventSelect = document.getElementById('eventSelect');
const clearHistoryButton = document.getElementById('clearHistory');

// Statistics Elements
const bestTimeEl = document.getElementById('bestTime');
const bestAvg5El = document.getElementById('bestAvg5');
const avg5El = document.getElementById('avg5');
const avg12El = document.getElementById('avg12');
const meanTimeEl = document.getElementById('meanTime');
const statisticButtons = Object.fromEntries(['bestSingle', 'bestAvg5', 'avg5', 'avg12']
  .map(kind => [kind, document.getElementById('stat-' + kind)]));
let statisticTargets = {};
const averageDetails = document.getElementById('averageDetails');
const averageDetailsTitle = document.getElementById('averageDetailsTitle');
const averageDetailsText = document.getElementById('averageDetailsText');
const closeAverageDetailsButton = document.getElementById('closeAverageDetails');
const copyAverageDetailsButton = document.getElementById('copyAverageDetails');
const copyAverageStatus = document.getElementById('copyAverageStatus');
let averageDetailsTrigger = null;

// Settings Menu & Toggles
const menuToggle = document.getElementById('menuToggle');
const settingsMenu = document.getElementById('settingsMenu');
const inspectionToggle = document.getElementById('inspectionToggle');
const holdToStartToggle = document.getElementById('holdToStartToggle');
const manualTimeToggle = document.getElementById('manualTimeToggle');
const colorPaletteSelect = document.getElementById('colorPaletteSelect');
const paletteEditionTag = document.getElementById('paletteEditionTag');

// Solve Details Dialog Elements
const solveDetails = document.getElementById('solveDetails');
const solveDetailTime = document.getElementById('solveDetailTime');
const solveDetailScramble = document.getElementById('solveDetailScramble');
const copySolveScramble = document.getElementById('copySolveScramble');
const copyScrambleStatus = document.getElementById('copyScrambleStatus');
const solveDetailDrawing = document.getElementById('solveDetailDrawing');
const solveDetailDrawingStatus = document.getElementById('solveDetailDrawingStatus');
const closeSolveDetailsButton = document.getElementById('closeSolveDetails');

// Clear History Confirmation Dialog
const clearHistoryDialog = document.getElementById('clearHistoryDialog');
const clearHistoryMessage = document.getElementById('clearHistoryMessage');
const cancelClearHistoryButton = document.getElementById('cancelClearHistory');
const confirmClearHistoryButton = document.getElementById('confirmClearHistory');

// Alt+Z Delete Confirmation Dialog
const deleteSolveDialog = document.getElementById('deleteSolveDialog');
const deleteSolveMessage = document.getElementById('deleteSolveMessage');
const cancelDeleteSolveButton = document.getElementById('cancelDeleteSolve');
const confirmDeleteSolveButton = document.getElementById('confirmDeleteSolve');
let pendingDeleteSolve = null;

// LocalStorage Keys
const STORAGE_KEY = 'bcube-timer-history';
const EVENT_STORAGE_KEY = 'bcube-timer-event';
const INSPECTION_STORAGE_KEY = 'bcube-timer-inspection';
const THEME_STORAGE_KEY = 'bcube-timer-theme';
const HOLD_TO_START_STORAGE_KEY = 'bcube-timer-hold-to-start';
const MANUAL_TIME_STORAGE_KEY = 'bcube-timer-manual-time';

// Timing & Scramble Parameters
const INSPECTION_SECONDS = 15;
const INSPECTION_GRACE_SECONDS = 1;
const SCRAMBLE_PREFETCH_COUNT = 5;
const REQUIRED_HOLD_MS = 300;
const MIN_START_PRESS_MS = 100;
const MAX_HISTORY_ENTRIES = 50;
const MAX_SCRAMBLE_LENGTH = 10000;
const MAX_STORAGE_LENGTH = 1000000;
const VALID_RESULTS = new Set(['ok', '+2', 'dnf']);

// WCA Supported Events
const EVENTS = [
  { code: '333', label: '3x3' },
  { code: '222', label: '2x2' },
  { code: '444', label: '4x4' },
  { code: '555', label: '5x5' },
  { code: '666', label: '6x6' },
  { code: '777', label: '7x7' },
  { code: 'clock', label: 'Clock' },
  { code: 'minx', label: 'Megaminx' },
  { code: 'pyram', label: 'Pyraminx' },
  { code: 'skewb', label: 'Skewb' },
  { code: 'sq1', label: 'Square-1' },
];

const CUBE_EVENTS = new Set(['222', '333', '444', '555', '666', '777']);
const VALID_MOVE_REGEX = /^(?:[URFDLB]w?|[2-6][URFDLB]w?|[urfdlb])(?:2|')?$/;
const VALID_PALETTES = [
  'light',
  'night',
  'liquid-glass',
  'cartoon',
  'shell-pink',
  'dessert',
  'purple',
  'purple-mango',
  'chessboard',
  'oilspill',
  'sunrise',
  'shibuya',
  'christmas',
  'halloween',
  'jims-pride',
];

/* ==========================================================================
   2. Application State
   ========================================================================== */

/** @type {'ready' | 'holding' | 'inspecting' | 'readyToSolve' | 'solving'} */
let state = 'ready';

// User Preferences
let currentEvent = loadEventPreference();
let inspectionEnabled = loadInspectionPreference();
let colorPalette = loadThemePreference();
let holdToStartEnabled = loadHoldToStartPreference();
let manualTimeEntryEnabled = loadManualTimeEntryPreference();

// Input & Timing Flags
let manualTimeDraftActive = false;
let isSpaceDown = false;
let justStopped = false;
let spaceStartedInspection = false;
let pointerStartedInspection = false;
let justStoppedPointer = false;
let holdTimeoutId = null;
let isHoldReady = false;
let lastSolveStoppedAt = 0;

// High-resolution Timestamps
let solveStartTimestamp = null;
let inspectionStartTimestamp = null;
let rafId = null;
let inspectionGraceTimeoutId = null;

// Scramble Pipeline State
let scramble = [];
let scrambleReady = false;
let scrambleRequestPromise = null;
let scrambleRequestId = 0;
let scrambleRequestEvent = null;
const scrambleQueues = new Map();
let scrambleWarmupTimer = null;

// Solves History State
let recentSolves = loadHistory(currentEvent);
let lastSolveId = null;
let selectedSolveId = null;
const runningControlStates = new Map();

// Cached offline TNoodle worker client
let tnoodleScramblerPromise = null;
let scrambleDrawingFailed = false;

/* ==========================================================================
   3. Scramble Visualizer Dynamic Web Component Loader
   ========================================================================== */

import('/assets/vendor/2a3049222214d6d1997b.mjs')
  .then(() => {
    if (solveDetailDrawingStatus) {
      solveDetailDrawingStatus.textContent = '';
    }
    if (scrambleReady) {
      updateScrambleVisualization(currentEvent, scramble.join(' '));
    }
    if (scrambleVisualStatus) {
      scrambleVisualStatus.textContent = '';
    }
  })
  .catch((error) => {
    scrambleDrawingFailed = true;
    if (solveDetailDrawingStatus && solveDetailDrawing?.childElementCount) {
      solveDetailDrawingStatus.textContent = 'Scramble drawing is unavailable.';
    }
    console.error('Unable to load the scramble drawing component.', error);
    if (scrambleVisualStatus) {
      scrambleVisualStatus.textContent = 'Scramble drawing is unavailable.';
    }
  });

/**
 * Updates the 2D visual representation of the current scramble.
 * @param {string} eventCode - The WCA event code (e.g. '333')
 * @param {string} scrambleValue - The move sequence string
 */
function updateScrambleVisualization(eventCode, scrambleValue) {
  if (!scrambleVisualization || !scrambleValue) {
    return;
  }

  const startedAt = performance.now();
  if (scrambleVisualization.getAttribute('event') !== eventCode) {
    const nextVisualization = document.createElement('scramble-display');
    nextVisualization.id = 'scrambleVisualization';
    nextVisualization.setAttribute('event', eventCode);
    nextVisualization.setAttribute('visualization', '2D');
    nextVisualization.setAttribute('aria-label', 'Current scramble drawing');
    scrambleVisualization.replaceWith(nextVisualization);
    scrambleVisualization = nextVisualization;
  }

  scrambleVisualization.setAttribute('scramble', scrambleValue);
  // Measures the component update only; its internal asynchronous render may finish later.
  console.debug(`[BTime] ${eventCode} drawing update dispatch: ${(performance.now() - startedAt).toFixed(1)}ms`);
}

/* ==========================================================================
   4. Preferences & Storage Management
   ========================================================================== */

function eventStorageKey(eventCode) {
  return eventCode === '333' ? STORAGE_KEY : `${STORAGE_KEY}-${eventCode}`;
}

function scrambleStorageKey(eventCode) {
  return `bcube-timer-scramble-${eventCode}`;
}

function getEventLabel(eventCode) {
  return EVENTS.find((event) => event.code === eventCode)?.label || eventCode;
}

// Treat persisted data as untrusted; all rendering continues to use textContent.
function readStoredValue(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value !== null && value.length <= MAX_STORAGE_LENGTH ? value : fallback;
  } catch {
    return fallback;
  }
}

function readStoredJson(key, fallback = null) {
  const value = readStoredValue(key);
  if (value === null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function writeStoredValue(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

function readBooleanPreference(key, fallback) {
  const value = readStoredJson(key);
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeScramble(value) {
  return typeof value === 'string' && value.length <= MAX_SCRAMBLE_LENGTH &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(value)
    ? value.trim() : '';
}

function loadSavedScramble(eventCode) {
  return normalizeScramble(readStoredValue(scrambleStorageKey(eventCode), ''));
}

function saveScramble(eventCode, value) {
  const normalized = normalizeScramble(value);
  if (normalized) writeStoredValue(scrambleStorageKey(eventCode), normalized);
}

function loadEventPreference() {
  const saved = readStoredValue(EVENT_STORAGE_KEY);
  return EVENTS.some((event) => event.code === saved) ? saved : '333';
}

function saveEventPreference() {
  writeStoredValue(EVENT_STORAGE_KEY, currentEvent);
}

function normalizeSolve(entry, eventCode) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const result = entry.result ?? 'ok';
  if (!VALID_RESULTS.has(result)) return null;
  const rawTime = entry.baseTimeMs ?? entry.timeMs ?? (result === 'dnf' ? 0 : null);
  if (typeof rawTime !== 'number' && typeof rawTime !== 'string') return null;
  if (typeof rawTime === 'string' && !/^\d+(?:\.\d+)?$/.test(rawTime)) return null;
  const baseTimeMs = Number(rawTime);
  if (!Number.isFinite(baseTimeMs) || baseTimeMs < 0 || baseTimeMs > Number.MAX_SAFE_INTEGER - 2000) return null;
  const id = typeof entry.id === 'string' || typeof entry.id === 'number' ? String(entry.id) : '';
  return {
    id: id && id.length <= 128 ? id : generateSolveId(),
    baseTimeMs,
    timeMs: result === 'dnf' ? null : baseTimeMs + (result === '+2' ? 2000 : 0),
    result,
    tag: getEventLabel(eventCode),
    scramble: normalizeScramble(entry.scramble),
  };
}

function normalizeHistory(entries, eventCode) {
  if (!Array.isArray(entries)) return [];
  const ids = new Set();
  return entries.slice(-MAX_HISTORY_ENTRIES).map((entry) => normalizeSolve(entry, eventCode))
    .filter((entry) => {
      if (!entry) return false;
      if (ids.has(entry.id)) entry.id = generateSolveId();
      ids.add(entry.id);
      return true;
    });
}

function loadHistory(eventCode) {
  return normalizeHistory(readStoredJson(eventStorageKey(eventCode)), eventCode);
}

function saveHistory() {
  writeStoredValue(eventStorageKey(currentEvent), JSON.stringify(normalizeHistory(recentSolves, currentEvent)));
}

function loadInspectionPreference() {
  return readBooleanPreference(INSPECTION_STORAGE_KEY, true);
}

function saveInspectionPreference() {
  writeStoredValue(INSPECTION_STORAGE_KEY, JSON.stringify(inspectionEnabled));
}

function loadThemePreference() {
  try {
    const saved = readStoredValue(THEME_STORAGE_KEY);
    if (saved === null) {
      return 'light';
    }

    const parsed = JSON.parse(saved);
    if (typeof parsed === 'boolean') {
      return parsed ? 'night' : 'light';
    }

    const normalized = typeof parsed === 'string' ? parsed.toLowerCase() : parsed;
    return VALID_PALETTES.includes(normalized) ? normalized : 'light';
  } catch (error) {
    return 'light';
  }
}

function saveThemePreference() {
  writeStoredValue(THEME_STORAGE_KEY, JSON.stringify(colorPalette));
}

function loadHoldToStartPreference() {
  return readBooleanPreference(HOLD_TO_START_STORAGE_KEY, false);
}

function saveHoldToStartPreference() {
  writeStoredValue(HOLD_TO_START_STORAGE_KEY, JSON.stringify(holdToStartEnabled));
}

function loadManualTimeEntryPreference() {
  return readBooleanPreference(MANUAL_TIME_STORAGE_KEY, false);
}

function saveManualTimeEntryPreference() {
  writeStoredValue(MANUAL_TIME_STORAGE_KEY, JSON.stringify(manualTimeEntryEnabled));
}

function applyTheme() {
  document.body.classList.toggle('dark-mode',
    ['night', 'oilspill', 'sunrise', 'shibuya', 'halloween', 'purple-mango'].includes(colorPalette));
  document.body.dataset.palette = colorPalette;
  if (colorPaletteSelect) colorPaletteSelect.value = colorPalette;
  if (paletteEditionTag) {
    paletteEditionTag.hidden = !['jims-pride', 'purple-mango'].includes(colorPalette);
    paletteEditionTag.textContent = colorPalette === 'purple-mango' ? "Kyu's Signature" : 'Limited Edition';
  }
}

/* ==========================================================================
   5. Scramble Generation Pipeline & Prefetch Queue
   ========================================================================== */

/**
 * Asynchronously loads the offline TNoodle worker client once and caches it.
 * @returns {Promise<Function>} randomScrambleForEvent function
 */
async function loadScrambler() {
  if (!tnoodleScramblerPromise) {
    tnoodleScramblerPromise = import('/assets/js/tnoodle-client.mjs')
      .then(({ randomScrambleForEvent, setActiveEvent }) => (eventCode, options) => {
        setActiveEvent(currentEvent);
        return randomScrambleForEvent(eventCode, options);
      })
      .catch((error) => { tnoodleScramblerPromise = null; throw error; });
  }
  return tnoodleScramblerPromise;
}

/**
 * Generates a valid TNoodle scramble sequence for the given WCA event.
 * @param {string} eventCode
 * @returns {Promise<string>}
 */
async function getNewScramble(eventCode, background = false) {
  const startedAt = performance.now();
  const randomScrambleForEvent = await loadScrambler();
  const isCube = CUBE_EVENTS.has(eventCode);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const generatedScramble = await randomScrambleForEvent(eventCode, { background });
    const moves = generatedScramble.toString().trim().split(/\s+/);
    const isValid =
          moves.length > 0 &&
          (isCube ? moves.every((move) => VALID_MOVE_REGEX.test(move)) : true);

    if (isValid) {
      console.debug(`[BTime] ${eventCode} scramble generation: ${Math.round(performance.now() - startedAt)}ms`);
      return moves.join(' ');
    }
  }

  throw new Error(`The ${eventCode} scrambler did not return a valid sequence after 10 attempts.`);
}

function getScrambleQueue(eventCode) {
  if (!scrambleQueues.has(eventCode)) {
    scrambleQueues.set(eventCode, { items: [], pending: null, error: null });
  }
  return scrambleQueues.get(eventCode);
}

/**
 * Proactively fetches scrambles in the background so solves load immediately.
 * @param {string} eventCode
 */
function prefetchScrambles(eventCode = currentEvent, warmup = false) {
  // An inactive event gets at most one idle warmup, never a five-item refill.
  if (eventCode !== currentEvent && !warmup) return;
  const queue = getScrambleQueue(eventCode);
  const targetCount = eventCode === currentEvent ? SCRAMBLE_PREFETCH_COUNT : 1;
  if (queue.pending || queue.error || queue.items.length >= targetCount) {
    scheduleScrambleWarmup();
    return;
  }

  queue.pending = getNewScramble(eventCode, eventCode !== currentEvent)
    .then((nextScramble) => {
      queue.items.push(nextScramble);
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        queue.error = error;
        console.error(`Unable to prefetch a ${eventCode} scramble.`, error);
      }
    })
    .finally(() => {
      queue.pending = null;
      if (eventCode === currentEvent && !queue.error && queue.items.length < SCRAMBLE_PREFETCH_COUNT) {
        prefetchScrambles(eventCode);
      }
      scheduleScrambleWarmup();
    });
}

function scheduleScrambleWarmup() {
  if (scrambleWarmupTimer !== null) return;
  scrambleWarmupTimer = window.setTimeout(() => {
    scrambleWarmupTimer = null;
    const activeQueue = getScrambleQueue(currentEvent);
    if (document.hidden || state !== 'ready' || activeQueue.error) {
      scheduleScrambleWarmup();
      return;
    }
    // Active generation/refills always take priority over another idle job.
    if (activeQueue.items.length < SCRAMBLE_PREFETCH_COUNT ||
        [...scrambleQueues.values()].some((queue) => queue.pending)) {
      scheduleScrambleWarmup();
      return;
    }
    const nextEvent = EVENTS.find(({ code }) => {
      const queue = getScrambleQueue(code);
      return code !== currentEvent && !queue.items.length && !queue.error;
    });
    if (nextEvent) prefetchScrambles(nextEvent.code, true);
  }, 1500);
}

/**
 * Retrieves the next available scramble from the prefetch queue or generates one.
 * @param {string} eventCode
 * @returns {Promise<string>}
 */
async function getQueuedScramble(eventCode) {
  const queue = getScrambleQueue(eventCode);
  while (!queue.items.length) {
    if (eventCode !== currentEvent) {
      throw new Error('Scramble request superseded by an event switch.');
    }
    if (!queue.pending) {
      prefetchScrambles(eventCode);
    }
    if (queue.pending) {
      await queue.pending;
    }
    if (!queue.items.length && queue.error) {
      const error = queue.error;
      queue.error = null;
      throw error;
    }
  }

  const nextScramble = queue.items.shift();
  prefetchScrambles(eventCode);
  return nextScramble;
}

/**
 * Generates and displays a new scramble for the active event.
 * @param {string} eventCode
 */
function generateScramble(eventCode = currentEvent) {
  // Repeated refresh taps share an outstanding request instead of discarding its result.
  if (!scrambleReady && scrambleRequestPromise && scrambleRequestEvent === eventCode) {
    return scrambleRequestPromise;
  }
  scrambleRequestEvent = eventCode;
  const startedAt = performance.now();
  const requestId = ++scrambleRequestId;
  scrambleReady = false;

  if (scrambleText) {
    scrambleText.textContent = `Generating ${getEventLabel(eventCode)} scramble…`;
  }

  scrambleRequestPromise = getQueuedScramble(eventCode)
    .then((nextScramble) => {
      if (requestId !== scrambleRequestId) {
        return false;
      }

      scramble = nextScramble.split(' ');
      scrambleReady = true;
      console.debug(`[BTime] ${eventCode} scramble wait: ${Math.round(performance.now() - startedAt)}ms`);
      saveScramble(eventCode, nextScramble);

      if (scrambleText) {
        scrambleText.textContent = nextScramble;
      }
      updateScrambleVisualization(eventCode, nextScramble);
      return true;
    })
    .catch((error) => {
      if (requestId === scrambleRequestId) {
        scrambleReady = false;
        if (scrambleText) {
          scrambleText.textContent = 'Scramble generation failed. Select New scramble to retry.';
        }
        console.error(`Unable to generate a ${eventCode} TNoodle scramble.`, error);
      }
      return false;
    });

  return scrambleRequestPromise;
}

/**
 * Restores the previously saved scramble or generates a new one on startup/event switch.
 * @param {string} eventCode
 */
function restoreScramble(eventCode = currentEvent) {
  prefetchScrambles(eventCode);
  const savedScramble = loadSavedScramble(eventCode);

  if (!savedScramble) {
    return generateScramble(eventCode);
  }

  const requestId = ++scrambleRequestId;
  scrambleRequestEvent = eventCode;
  scramble = savedScramble.split(/\s+/);
  scrambleReady = true;
  scrambleRequestPromise = Promise.resolve(true);

  if (scrambleText) {
    scrambleText.textContent = savedScramble;
  }
  updateScrambleVisualization(eventCode, savedScramble);
  return Promise.resolve(requestId === scrambleRequestId);
}

/* ==========================================================================
   6. Time Formatting & Statistics Mathematics (WCA Ao5 / Ao12)
   ========================================================================== */

/**
 * Formats a duration in milliseconds to human-readable string (e.g. "12.34" or "1:05.23").
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
  }
  return `${seconds.toFixed(2)}`;
}

/**
 * Formats a statistical metric value or returns '--' when missing.
 * @param {number|null|undefined} value
 * @returns {string}
 */
function formatMetric(value) {
  return value === null || value === undefined || Number.isNaN(value) ? '--' : formatTime(value);
}

/**
 * Computes the numeric time value in milliseconds for a solve entry, accounting for penalties.
 * @param {object} entry
 * @returns {number|null} Time in ms or null if DNF
 */
function getSolveValue(entry) {
  if (!entry || entry.result === 'dnf') {
    return null;
  }

  const baseValue = Number(entry.baseTimeMs ?? entry.timeMs ?? 0);
  if (!Number.isFinite(baseValue)) {
    return null;
  }

  return entry.result === '+2' ? baseValue + 2000 : baseValue;
}

/**
 * Use the same window and exclusions for both the capsule and its breakdown.
 * Ties drop exactly two distinct solves: the first fastest and last slowest.
 */
function getTrimmedAverage(solves, solveCount) {
  if (solves.length < solveCount) {
    return { value: null, isDnf: false, solves: [], excludedIndices: [] };
  }
  const windowSolves = solves.slice(-solveCount);
  const ranked = windowSolves.map((solve, index) => ({
    index, value: getSolveValue(solve) ?? Infinity,
  })).sort((a, b) => (a.value - b.value) || (a.index - b.index));
  const excludedIndices = [ranked[0].index, ranked[ranked.length - 1].index];
  const counted = ranked.slice(1, -1);
  const isDnf = counted.some(solve => !Number.isFinite(solve.value));
  return {
    value: isDnf ? null : counted.reduce((sum, solve) => sum + solve.value, 0) / counted.length,
    isDnf, solves: windowSolves, excludedIndices,
  };
}

function getBestAverage(solves, solveCount) {
  let best = null;
  for (let end = solveCount; end <= solves.length; end += 1) {
    const average = getTrimmedAverage(solves.slice(end - solveCount, end), solveCount);
    if (!average.isDnf && average.value !== null && (!best || average.value < best.value)) best = average;
  }
  return best;
}

function syncStatisticButtons() {
  for (const [kind, button] of Object.entries(statisticButtons)) {
    if (button) button.disabled = state !== 'ready' || !statisticTargets[kind];
  }
}

function renderStats() {
  if (!bestTimeEl || !avg5El || !bestAvg5El || !avg12El) return;
  const validSolves = recentSolves.filter(solve => Number.isFinite(getSolveValue(solve)));
  const bestSingle = validSolves.reduce((best, solve) =>
    !best || getSolveValue(solve) < getSolveValue(best) ? solve : best, null);
  const meanTime = validSolves.length
    ? validSolves.reduce((sum, solve) => sum + getSolveValue(solve), 0) / validSolves.length : null;
  const bestAvg5 = getBestAverage(recentSolves, 5);
  const currentAvg5 = getTrimmedAverage(recentSolves, 5);
  const currentAvg12 = getTrimmedAverage(recentSolves, 12);
  statisticTargets = {
    bestSingle, bestAvg5,
    avg5: currentAvg5.solves.length ? currentAvg5 : null,
    avg12: currentAvg12.solves.length ? currentAvg12 : null,
  };
  bestTimeEl.textContent = formatMetric(bestSingle ? getSolveValue(bestSingle) : null);
  bestAvg5El.textContent = formatMetric(bestAvg5?.value);
  avg5El.textContent = currentAvg5.isDnf ? 'DNF' : formatMetric(currentAvg5.value);
  avg12El.textContent = currentAvg12.isDnf ? 'DNF' : formatMetric(currentAvg12.value);
  if (meanTimeEl) meanTimeEl.textContent = formatMetric(meanTime);
  syncStatisticButtons();
}

function formatAverageBreakdown(kind, average) {
  const label = kind === 'bestAvg5' ? 'Average of 5' : kind === 'avg12' ? 'Average of 12' : 'Average of 5';
  const result = average.isDnf ? 'DNF' : formatMetric(average.value);
  const lines = average.solves.map((solve, index) => {
    const time = formatHistoryValue(solve);
    const markedTime = average.excludedIndices.includes(index) ? '(' + time + ')' : time;
    return markedTime + ' - ' + (solve.scramble || 'Scramble was not saved for this solve.');
  });
  return [label + ': ' + result, 'Scramble generated by TNoodle in BTime', ...lines].join('\n');
}

function showStatisticDetails(kind) {
  if (state !== 'ready' || averageDetails?.open || solveDetails?.open) return;
  const target = statisticTargets[kind];
  if (!target) return;
  if (kind === 'bestSingle') {
    showSolveDetails(String(target.id));
    return;
  }
  if (!averageDetails || !averageDetailsText) return;
  const label = kind === 'bestAvg5' ? 'Average of 5' : kind === 'avg12' ? 'Average of 12' : 'Average of 5';
  averageDetailsTitle.textContent = label + ' · ' + getEventLabel(currentEvent);
  averageDetailsText.textContent = formatAverageBreakdown(kind, target);
  if (copyAverageStatus) copyAverageStatus.textContent = '';
  averageDetailsTrigger = statisticButtons[kind];
  averageDetails.showModal();
}

function formatHistoryValue(entry) {
  if (!entry || entry.result === 'dnf') {
    return 'DNF';
  }

  const value = getSolveValue(entry);
  if (value === null) {
    return 'DNF';
  }

  return entry.result === '+2' ? `${formatTime(value)} +2` : formatTime(value);
}

/**
 * Renders the session solves list.
 */
function renderHistory() {
  if (!solveList) {
    return;
  }

  solveList.replaceChildren();

  if (!recentSolves.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'solve-empty';
    emptyItem.textContent = 'No solves yet in this session.';
    solveList.appendChild(emptyItem);
    return;
  }

  [...recentSolves].reverse().forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'solve-item';

    const recordButton = document.createElement('button');
    recordButton.className = 'solve-record-button';
    recordButton.type = 'button';
    recordButton.dataset.solveId = String(entry.id);

    const indexLabel = document.createElement('span');
    indexLabel.className = 'index';
    indexLabel.textContent = String(recentSolves.length - index);

    const timeLabel = document.createElement('span');
    timeLabel.className = 'time';
    timeLabel.textContent = formatHistoryValue(entry);

    const tagLabel = document.createElement('span');
    tagLabel.className = 'tag';
    tagLabel.textContent = entry.result === 'dnf' ? 'DNF' : entry.tag;

    recordButton.append(indexLabel, timeLabel, tagLabel);
    item.appendChild(recordButton);
    solveList.appendChild(item);
  });
}

/* ==========================================================================
   7. Solve Details & Action Management (DNF, +2, Revert, Delete)
   ========================================================================== */

function generateSolveId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hasManualTimeDraft() {
  return manualTimeEntryEnabled && state === 'ready' && Boolean(timerDisplay?.value.trim());
}

/**
 * Opens the solve details modal dialog for a specific solve record.
 * @param {string} solveId
 */
function showSolveDetails(solveId) {
  if (!solveDetails || !solveDetailTime || !solveDetailScramble) {
    return;
  }

  const entry = recentSolves.find((solve) => String(solve.id) === solveId);
  if (!entry) {
    return;
  }

  selectedSolveId = solveId;
  if (copySolveScramble) copySolveScramble.disabled = !entry.scramble;
  if (copyScrambleStatus) copyScrambleStatus.textContent = '';
  solveDetailTime.textContent = formatHistoryValue(entry);
  solveDetailScramble.textContent = entry.scramble || 'Scramble was not saved for this solve.';
  if (solveDetailDrawing) {
    // Recreate the component so switching puzzles cannot retain the previous drawing.
    solveDetailDrawing.replaceChildren();
    solveDetailDrawing.hidden = !entry.scramble;
    if (entry.scramble) {
      const drawing = document.createElement('scramble-display');
      drawing.setAttribute('event', currentEvent);
      drawing.setAttribute('visualization', '2D');
      drawing.setAttribute('scramble', entry.scramble);
      drawing.setAttribute('role', 'img');
      drawing.setAttribute('aria-label', `${getEventLabel(currentEvent)} scramble drawing for this solve`);
      solveDetailDrawing.appendChild(drawing);
    }
    if (solveDetailDrawingStatus) {
      solveDetailDrawingStatus.textContent = !entry.scramble ? ''
        : scrambleDrawingFailed ? 'Scramble drawing is unavailable.'
        : customElements.get('scramble-display') ? '' : 'Loading scramble drawing…';
    }
  }
  solveDetails.showModal();
}

/**
 * Modifies or deletes an existing solve entry (DNF, +2 penalty, revert, delete).
 * @param {string} solveId
 * @param {'dnf' | 'plus2' | 'reset' | 'delete'} action
 */
function applySolveAction(solveId, action) {
  const targetIndex = recentSolves.findIndex((solve) => String(solve.id) === solveId);
  if (targetIndex === -1) {
    return;
  }

  const entry = recentSolves[targetIndex];

  if (action === 'delete') {
    recentSolves.splice(targetIndex, 1);
  } else if (action === 'dnf') {
    entry.result = 'dnf';
    entry.timeMs = null;
  } else if (action === 'plus2') {
    entry.result = '+2';
    entry.timeMs = entry.baseTimeMs + 2000;
  } else if (action === 'reset') {
    entry.result = 'ok';
    entry.timeMs = entry.baseTimeMs;
  } else {
    return;
  }

  if (action === 'delete' && String(lastSolveId) === solveId) {
    lastSolveId = null;
    syncSolveActionAvailability();
  }

  saveHistory();
  renderStats();
  renderHistory();

  // Update open modal if modifying the active solve
  if (selectedSolveId === solveId) {
    if (action === 'delete') {
      solveDetails.close();
      selectedSolveId = null;
    } else {
      solveDetailTime.textContent = formatHistoryValue(entry);
    }
  }

  // Update timer display if reverting the last completed solve
  if (String(lastSolveId) === solveId && action === 'reset') {
    updateDisplay(formatTime(entry.baseTimeMs));
  }
}

/**
 * Enables or disables solve action buttons based on solve availability.
 */
function syncSolveActionAvailability() {
  if (!solveActions) {
    return;
  }

  const hasDraft = hasManualTimeDraft();
  solveActions.querySelectorAll('.result-action').forEach((button) => {
    if (state === 'solving') {
      button.disabled = true;
      return;
    }
    if (button.dataset.action === 'dnf') {
      button.disabled = state !== 'ready';
      return;
    }
    if (manualTimeEntryEnabled) {
      if (button.dataset.action === 'dnf') {
        button.disabled = state !== 'ready';
      } else {
        button.disabled = state !== 'ready' || !hasDraft;
      }
      return;
    }

    button.disabled = !lastSolveId;
  });
}

/* ==========================================================================
   8. Timer UI & Manual Entry Synchronization
   ========================================================================== */

function syncDisplayWidth(value) {
  if (timerDisplay) {
    timerDisplay.style.width = `${Math.max(3.2, value.length * 0.8 + 1.2)}ch`;
  }
}

function updateDisplay(value) {
  if (timerDisplay) {
    timerDisplay.value = value;
    syncDisplayWidth(value);
  }
}

function flashDisplay() {
  if (!timerDisplay) {
    return;
  }
  timerDisplay.classList.remove('flash');
  void timerDisplay.offsetWidth;
  timerDisplay.classList.add('flash');
}

/**
 * Updates the visual timer state and styles.
 * @param {'ready' | 'holding' | 'inspecting' | 'readyToSolve' | 'solving'} nextState
 */
function syncRunningControls() {
  if (state === 'solving') {
    closeSettingsMenu();
    document.querySelectorAll('button, select, input:not(#timerDisplay)').forEach((control) => {
      if (!runningControlStates.has(control)) {
        runningControlStates.set(control, control.disabled);
      }
      control.disabled = true;
    });
  } else {
    runningControlStates.forEach((disabled, control) => {
      control.disabled = disabled;
    });
    runningControlStates.clear();
  }
}

function setTimerState(nextState) {
  state = nextState;

  const labels = {
    ready: 'Ready',
    holding: 'Release to start',
    inspecting: 'Inspecting',
    readyToSolve: 'Ready',
    solving: 'Solving',
  };

  if (!timerState || !timerDisplay) {
    return;
  }

  syncRunningControls();
  syncStatisticButtons();
  syncManualTimeEntry();

  timerState.textContent = labels[nextState] || 'Ready';
  timerState.className = `timer-state ${nextState}`;

  if (nextState === 'holding' || nextState === 'readyToSolve') {
    timerDisplay.classList.add('holding');
  } else {
    timerDisplay.classList.remove('holding');
  }

  if (nextState === 'inspecting') {
    timerDisplay.classList.add('inspecting');
  } else {
    timerDisplay.classList.remove('inspecting');
    timerDisplay.classList.remove('space-held');
  }
}

/**
 * Synchronizes the input element state between physical timer mode and manual entry mode.
 */
function syncManualTimeEntry() {
  if (!timerDisplay) {
    return;
  }

  const canEditTime = manualTimeEntryEnabled && state === 'ready';
  timerDisplay.readOnly = !canEditTime;
  timerDisplay.inputMode = canEditTime ? 'decimal' : 'none';
  timerDisplay.tabIndex = canEditTime ? 0 : -1;
  timerDisplay.setAttribute('aria-label', canEditTime ? 'Enter solve time' : 'Timer display');
  timerPanel?.classList.toggle('manual-entry-active', canEditTime);
  

  if (canEditTime) {
    if (!manualTimeDraftActive) {
      timerDisplay.value = '';
      timerDisplay.style.width = '3.2ch';
    }
  } else {
    manualTimeDraftActive = false;
    if (!manualTimeEntryEnabled && state === 'ready' && !timerDisplay.value) {
      timerDisplay.value = '0.00';
      timerDisplay.style.width = '5.2ch';
    }
    timerDisplay.removeAttribute('aria-invalid');
  }

  syncSolveActionAvailability();
}

/* ==========================================================================
   9. Timer Engine (Inspection, Solving, Recording)
   ========================================================================== */

function cancelAnimation() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function cancelInspectionGracePeriod() {
  if (inspectionGraceTimeoutId !== null) {
    window.clearTimeout(inspectionGraceTimeoutId);
    inspectionGraceTimeoutId = null;
  }
}

/**
 * Initiates the 15-second WCA inspection countdown.
 */
function beginInspection() {
  if (!timerPanel || !timerDisplay) {
    return;
  }

  cancelAnimation();
  setTimerState('inspecting');
  inspectionStartTimestamp = performance.now();
  const startValue = INSPECTION_SECONDS * 1000;

  const tick = () => {
    const elapsed = performance.now() - inspectionStartTimestamp;
    const remaining = Math.max(0, startValue - elapsed);
    const display = String(Math.ceil(remaining / 1000));
    updateDisplay(display);

    if (remaining > 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    // 15 seconds elapsed: enter 1s grace countdown before DNF
    timerDisplay.classList.remove('space-held');
    setTimerState('readyToSolve');
    timerState.textContent = 'Start now';
    const graceStartTimestamp = performance.now();
    updateDisplay(String(INSPECTION_GRACE_SECONDS));
    flashDisplay();

    const updateGraceDisplay = () => {
      if (state !== 'readyToSolve') {
        return;
      }
      const graceRemaining = Math.max(
        0,
        INSPECTION_GRACE_SECONDS * 1000 - (performance.now() - graceStartTimestamp),
      );
      updateDisplay(String(Math.ceil(graceRemaining / 1000)));
      if (graceRemaining > 0) {
        rafId = requestAnimationFrame(updateGraceDisplay);
      }
    };

    rafId = requestAnimationFrame(updateGraceDisplay);
    inspectionGraceTimeoutId = window.setTimeout(() => {
      inspectionGraceTimeoutId = null;
      if (state === 'readyToSolve' || state === 'holding') {
        recordInspectionDnf();
      }
    }, INSPECTION_GRACE_SECONDS * 1000);
  };

  rafId = requestAnimationFrame(tick);
}

/**
 * Starts the live solving timer.
 */
function beginSolve() {
  cancelInspectionGracePeriod();
  if (!timerPanel || !timerDisplay) {
    return;
  }

  cancelAnimation();
  setTimerState('solving');
  solveStartTimestamp = performance.now();

  const tick = () => {
    const elapsed = performance.now() - solveStartTimestamp;
    updateDisplay(formatTime(elapsed));
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

function recordInspectionDnf() {
  cancelAnimation();
  const solveEntry = {
    id: generateSolveId(),
    baseTimeMs: 0,
    timeMs: null,
    result: 'dnf',
    tag: getEventLabel(currentEvent),
    scramble: scramble.join(' '),
  };

  recentSolves.push(solveEntry);
  lastSolveId = solveEntry.id;
  recentSolves = recentSolves.slice(-MAX_HISTORY_ENTRIES);
  saveHistory();
  renderStats();
  renderHistory();
  setTimerState('ready');
  updateDisplay('DNF');
  syncSolveActionAvailability();
  generateScramble();
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
}

/**
 * Halts the solving timer and records the solve.
 */
function finishSolve() {
  cancelAnimation();
  const elapsed = performance.now() - solveStartTimestamp;
  const finalTime = Math.max(0, elapsed);
  recordSolve(finalTime);
  setTimerState('ready');
  updateDisplay(formatTime(finalTime));
  flashDisplay();
  syncSolveActionAvailability();
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
}

function recordSolve(finalTime, result = 'ok') {
  const scrambleUsed = scramble.join(' ');
  const solveEntry = {
    id: generateSolveId(),
    baseTimeMs: finalTime,
    timeMs: result === 'dnf' ? null : result === '+2' ? finalTime + 2000 : finalTime,
    result,
    tag: getEventLabel(currentEvent),
    scramble: scrambleUsed,
  };

  recentSolves.push(solveEntry);
  lastSolveId = solveEntry.id;
  recentSolves = recentSolves.slice(-MAX_HISTORY_ENTRIES);
  saveHistory();
  renderStats();
  renderHistory();
  generateScramble();
}

/* ==========================================================================
   10. Manual Time Entry Processor
   ========================================================================== */

/**
 * Parses user-entered manual time strings (e.g. "12.34", "1234", "dnf", "12.34+2").
 * @param {string} value
 * @returns {{ timeMs: number, result: string } | null}
 */
function parseManualTime(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  const enteredTime = value.trim().toLowerCase();
  if (enteredTime === 'dnf') {
    return { timeMs: 0, result: 'dnf' };
  }

  const match = enteredTime.match(/^(\d+(?:\.\d+)?)(\+2)?$/);
  if (!match) {
    return null;
  }

  const parsedNumber = Number(match[1]);
  const seconds = match[1].includes('.') ? parsedNumber : parsedNumber / 100;
  const timeMs = Math.round(seconds * 1000);

  if (!Number.isSafeInteger(timeMs) || timeMs <= 0 || timeMs > Number.MAX_SAFE_INTEGER - 2000) {
    return null;
  }

  return { timeMs, result: match[2] ? '+2' : 'ok' };
}

function recordManualTime(resultOverride = null) {
  if (!timerDisplay || !manualTimeEntryEnabled || state !== 'ready') {
    return;
  }

  const parsedTime = resultOverride === 'dnf'
    ? { timeMs: 0, result: 'dnf' }
    : parseManualTime(timerDisplay.value);

  if (parsedTime === null || (resultOverride === '+2' && parsedTime.result === 'dnf')) {
    timerDisplay.setAttribute('aria-invalid', 'true');
    timerDisplay.select();
    return;
  }

  const result = resultOverride || parsedTime.result;
  manualTimeDraftActive = false;
  recordSolve(parsedTime.timeMs, result);
  setTimerState('ready');
  timerDisplay.value = '';
  timerDisplay.style.width = '3.2ch';
  flashDisplay();
  syncSolveActionAvailability();
  timerDisplay.removeAttribute('aria-invalid');
  // Keep focus on timer display for fast entry
  timerDisplay.focus({ preventScroll: true });
}

function clearManualTimeDraft() {
  if (!timerDisplay) {
    return;
  }
  manualTimeDraftActive = false;
  timerDisplay.value = '';
  timerDisplay.style.width = '3.2ch';
  timerDisplay.removeAttribute('aria-invalid');
  syncSolveActionAvailability();
  timerDisplay.focus({ preventScroll: true });
}

/* ==========================================================================
   11. Session Resets & Action Controllers
   ========================================================================== */

function resetSession() {
  cancelInspectionGracePeriod();
  cancelAnimation();
  if (holdTimeoutId !== null) {
    clearTimeout(holdTimeoutId);
    holdTimeoutId = null;
  }
  isHoldReady = false;
  isSpaceDown = false;
  justStopped = false;
  spaceStartedInspection = false;
  pointerStartedInspection = false;
  justStoppedPointer = false;
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
  lastSolveId = null;
  syncSolveActionAvailability();
  setTimerState('ready');
  updateDisplay(manualTimeEntryEnabled ? '' : '0.00');
  timerDisplay?.classList.remove('holding-wait', 'holding-ready', 'space-held');
}

function handleTimerAction() {
  if (holdToStartEnabled && state !== 'solving') {
    return;
  }

  if (state === 'solving') {
    finishSolve();
    return;
  }

  if (state === 'inspecting') {
    beginSolve();
    return;
  }

  if (state === 'ready' || state === 'readyToSolve') {
    if (inspectionEnabled && state === 'ready') {
      beginInspection();
    } else {
      beginSolve();
    }
  }
}

function closeSettingsMenu(restoreTimerFocus = false) {
  if (!settingsMenu || !menuToggle) {
    return;
  }

  settingsMenu.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');

  if (settingsMenu.contains(document.activeElement) || document.activeElement === menuToggle) {
    document.activeElement.blur();
  }

  if (restoreTimerFocus && timerPanel) {
    timerPanel.focus({ preventScroll: true });
  }
}

function focusTimerAfterAction() {
  // A modal makes the timer inert, so close it before returning focus.
  if (solveDetails?.open) {
    solveDetails.close();
  }
  timerPanel?.focus({ preventScroll: true });
}

/* ==========================================================================
   12. Input Event Handlers (Keyboard, Pointer, Buttons)
   ========================================================================== */

function isSpaceKey(event) {
  return event.code === 'Space' || event.key === ' ' || event.keyCode === 32;
}

// Shared delayed-start feedback for keyboard and touch, including optional haptics.
function prepareDelayedStart(vibrate = false, delayMs = REQUIRED_HOLD_MS) {
  const inspecting = state === 'inspecting' || state === 'readyToSolve';
  isHoldReady = false;
  if (holdTimeoutId !== null) clearTimeout(holdTimeoutId);
  if (!inspecting) {
    spaceStartedInspection = false;
    pointerStartedInspection = false;
    cancelAnimation();
    setTimerState('holding');
    updateDisplay('0.00');
  }
  timerState.textContent = 'Hold...';
  if (!inspecting) timerState.className = 'timer-state holding holding-wait';
  timerDisplay.classList.add('holding-wait');
  if (inspecting) timerDisplay.classList.add('space-held');
  timerDisplay.classList.remove('holding-ready');
  holdTimeoutId = window.setTimeout(() => {
    holdTimeoutId = null;
    isHoldReady = true;
    timerState.textContent = 'Release to start';
    if (!inspecting) timerState.className = 'timer-state holding holding-ready';
    timerDisplay.classList.remove('holding-wait');
    timerDisplay.classList.add('holding-ready');
    flashDisplay();
    if (vibrate && navigator.vibrate) {
      try { navigator.vibrate(40); } catch { /* Haptics are optional. */ }
    }
  }, delayMs);
}

// Even with hold delay off, ignore accidental presses shorter than 100 ms.
function prepareQuickStart() {
  prepareDelayedStart(false, MIN_START_PRESS_MS);
}

function requestDeleteSolve(entry) {
  if (!deleteSolveDialog || !deleteSolveMessage || deleteSolveDialog.open) return;
  // Capture the exact solve and event; confirmation must not retarget another result.
  pendingDeleteSolve = { id: String(entry.id), eventCode: currentEvent };
  deleteSolveMessage.textContent = `Delete ${formatHistoryValue(entry)} from your ${getEventLabel(currentEvent)} session?`;
  deleteSolveDialog.showModal();
  confirmDeleteSolveButton?.focus({ preventScroll: true });
}

// Clear All Solves Handler
function clearAllSolves() {
  if (confirmClearHistoryButton && clearHistoryDialog) {
    const eventLabel = getEventLabel(currentEvent);
    if (clearHistoryMessage) {
      clearHistoryMessage.textContent = `Are you sure you want to delete all ${eventLabel} session records? This cannot be undone.`;
    }
    clearHistoryDialog.showModal();
    // Focus the confirm button for quick confirmation
    setTimeout(() => {
      if (clearHistoryDialog.open) confirmClearHistoryButton?.focus({ preventScroll: true });
    }, 10);
  }
}

// Global Keyboard Handler (Spacebar Start, Any Key Stop)
// A stopping touch must never activate the control beneath the finger.
let stoppedTouchTarget = null;
let stoppedTouchAt = -Infinity;
const blockRunningControlInteraction = (event) => {
  if (event.type === 'pointerdown' && state === 'solving' && event.pointerType !== 'mouse') {
    event.preventDefault();
    event.stopImmediatePropagation();
    stoppedTouchTarget = event.target;
    stoppedTouchAt = performance.now();
    finishSolve();
    lastSolveStoppedAt = performance.now();
    justStopped = true;
    justStoppedPointer = true;
    return;
  }
  if (event.type === 'click' && event.target === stoppedTouchTarget && performance.now() - stoppedTouchAt < 700) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (state === 'solving' && event.target?.closest?.('button, select, input:not(#timerDisplay), label')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
};
window.addEventListener('pointerdown', blockRunningControlInteraction, { capture: true });
window.addEventListener('click', blockRunningControlInteraction, { capture: true });
window.addEventListener('change', blockRunningControlInteraction, { capture: true });

window.addEventListener('keydown', (event) => {
  if (timerPanel && state === 'solving') {
    event.preventDefault();
    // Holding the start key must not immediately stop the solve.
    if (event.repeat || (isSpaceKey(event) && isSpaceDown)) {
      return;
    }

    if (isSpaceKey(event)) {
      isSpaceDown = true;
      justStopped = true;
    }
    finishSolve();
    lastSolveStoppedAt = performance.now();
    return;
  }

  // Let the modal own Enter, Space and Escape while confirmation is open.
  if (deleteSolveDialog?.open || averageDetails?.open) return;

  const penaltyActions = { '1': 'reset', '2': 'plus2', '3': 'dnf' };
  const deleteShortcut = event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey &&
    (event.code === 'KeyZ' || event.key?.toLowerCase() === 'z');
  const shortcutAction = deleteShortcut ? 'delete'
    : event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey
      ? penaltyActions[event.key] : null;
  if (shortcutAction) {
    // Leave typing and unrelated dialogs alone.
    if (
      state !== 'ready' ||
      clearHistoryDialog?.open ||
      event.target?.closest?.('input:not([readonly]), textarea, [contenteditable="true"]')
    ) {
      return;
    }

    event.preventDefault();
    if (event.repeat) return;

    const solveId = solveDetails?.open ? selectedSolveId : lastSolveId;
    const entry = recentSolves.find((solve) => String(solve.id) === String(solveId));
    if (entry && (shortcutAction !== 'reset' || entry.result === '+2' || entry.result === 'dnf')) {
      if (shortcutAction === 'delete') {
        requestDeleteSolve(entry);
      } else {
        applySolveAction(String(entry.id), shortcutAction);
        focusTimerAfterAction();
      }
    }
    return;
  }

  if (!isSpaceKey(event)) {
    if (event.key === 'Escape' && settingsMenu && !settingsMenu.hidden) {
      closeSettingsMenu(true);
      return;
    }
    
    // Alt+D: Clear all solves for current event
    if (event.altKey && (event.key === 'd' || event.key === 'D')) {
      event.preventDefault();
      clearAllSolves();
      return;
    }
    
    return;
  }

  if (!timerPanel) {
    return;
  }

  const isReadOnlyTimerDisplay = event.target === timerDisplay && timerDisplay.readOnly;
  if (
    !isReadOnlyTimerDisplay &&
    event.target?.closest?.('input, button, select, textarea, [contenteditable="true"]')
  ) {
    return;
  }

  if (manualTimeEntryEnabled && state !== 'solving') {
    event.preventDefault();
    return;
  }

  event.preventDefault();

  // Suppress OS key repeat events while holding space
  if (event.repeat || isSpaceDown) {
    return;
  }

  isSpaceDown = true;

  // During inspection: arm on press and start on release, with an optional hold delay.
  if (state === 'inspecting' || state === 'readyToSolve') {
    if (holdToStartEnabled) {
      prepareDelayedStart(false);

      return;
    } else {
      prepareQuickStart();
      return;
    }
  }

  // When ready: if inspection is enabled, start inspection immediately on tap (no hold delay)
  if (state === 'ready') {
    if (inspectionEnabled) {
      spaceStartedInspection = true;
      beginInspection();
      return;
    }

    // If inspection is disabled: check holdToStart setting
    if (holdToStartEnabled) {
      prepareDelayedStart(false);

      return;
    } else {
      prepareQuickStart();
      return;
    }
  }
});
window.addEventListener('keyup', (event) => {
  if (!isSpaceKey(event) || !timerPanel) {
    return;
  }

  const startedInspection = spaceStartedInspection;
  spaceStartedInspection = false;
  isSpaceDown = false;

  if (holdTimeoutId !== null) {
    clearTimeout(holdTimeoutId);
    holdTimeoutId = null;
  }

    // Ignore keyup from the stopping tap
  if (justStopped) {
    justStopped = false;
    return;
  }

  // If space tap started inspection, ignore keyup
  if (startedInspection) {
    return;
  }

  if (manualTimeEntryEnabled && state !== 'solving') {
    timerDisplay.classList.remove('space-held', 'holding-wait', 'holding-ready');
    if (state === 'holding') {
      resetSession();
    }
    return;
  }
  // Releasing after full hold: start solve!
  if (isHoldReady) {
    isHoldReady = false;
    timerDisplay.classList.remove('holding-wait', 'holding-ready', 'space-held');

    if (state === 'holding') {
      beginSolve();
      return;
    }

    if (state === 'inspecting' || state === 'readyToSolve') {
      beginSolve();
      return;
    }
  } else {
    // Released too early -> Cancel and do not start!
    isHoldReady = false;
    timerDisplay.classList.remove('holding-wait', 'holding-ready', 'space-held');

    if (state === 'holding') {
      setTimerState('ready');
      const lastSolve = recentSolves.find((s) => String(s.id) === String(lastSolveId));
      if (lastSolve && Number.isFinite(lastSolve.baseTimeMs)) {
        updateDisplay(formatTime(lastSolve.baseTimeMs));
      } else {
        updateDisplay('0.00');
      }
      return;
    }

    if (state === 'inspecting') {
      timerState.textContent = 'Inspecting';
      timerState.className = 'timer-state inspecting';
    }
  }
});

window.addEventListener('blur', () => {
  if (holdTimeoutId !== null) {
    clearTimeout(holdTimeoutId);
    holdTimeoutId = null;
  }
  isHoldReady = false;
  timerDisplay?.classList.remove('holding-wait', 'holding-ready', 'space-held');
  if (state === 'holding') {
    resetSession();
  }
  isSpaceDown = false;
  justStopped = false;
  spaceStartedInspection = false;
  pointerStartedInspection = false;
  justStoppedPointer = false;
});

// Scramble Refresh Button
if (newScrambleButton) {
  newScrambleButton.addEventListener('click', (event) => {
    event.stopPropagation();
    newScrambleButton.blur();
    generateScramble();
  });
}

// Event Selector Dropdown
function syncEventSelectorWidth() {
  if (!eventSelect) return;
  const label = getEventLabel(currentEvent);
  const context = document.createElement('canvas').getContext?.('2d');
  if (context) context.font = '600 16px Inter, sans-serif';
  const textWidth = context ? context.measureText(label).width : label.length * 9;
  eventSelect.style.setProperty('--event-select-width', `${Math.max(64, Math.ceil(textWidth + 38))}px`);
}

if (eventSelect) {
  eventSelect.value = currentEvent;
  syncEventSelectorWidth();
  eventSelect.addEventListener('change', () => {
    const selectedEvent = EVENTS.find((event) => event.code === eventSelect.value);
    if (!selectedEvent || state === 'solving') {
      eventSelect.value = currentEvent;
      return;
    }

    currentEvent = selectedEvent.code;
    syncEventSelectorWidth();
    saveEventPreference();
    recentSolves = loadHistory(currentEvent);
    lastSolveId = null;
    resetSession();
    restoreScramble(currentEvent);
    renderStats();
    renderHistory();
  });
}

// Manual Timer Display Input Handlers
if (timerDisplay) {
  timerDisplay.addEventListener('focus', () => {
    if (!timerDisplay.readOnly) {
      timerDisplay.select();
    }
  });

  timerDisplay.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !timerDisplay.readOnly) {
      event.preventDefault();
      recordManualTime();
    } else if (event.key === 'Escape' && !timerDisplay.readOnly) {
      event.preventDefault();
      updateDisplay('0.00');
      timerDisplay.blur();
    }
  });

  timerDisplay.addEventListener('input', () => {
    syncDisplayWidth(timerDisplay.value);
    timerDisplay.removeAttribute('aria-invalid');
    manualTimeDraftActive = hasManualTimeDraft();
    syncSolveActionAvailability();
  });
}

// Clear History Confirmation
function bindConfirmationAction(button, action) {
  if (!button) return;
  let press = null;
  let lastTouchActivation = -Infinity;
  button.addEventListener('pointerdown', (event) => {
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && !button.disabled) {
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });
  button.addEventListener('pointercancel', () => { press = null; });
  button.addEventListener('pointerup', (event) => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || button.disabled) return;
    const rect = button.getBoundingClientRect();
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 ||
        event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) return;
    // Some installed iOS sessions omit the synthesized click after a modal tap.
    // Handle the completed tap directly and ignore its follow-up click if one arrives.
    event.preventDefault();
    event.stopPropagation();
    lastTouchActivation = performance.now();
    action();
  });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled || performance.now() - lastTouchActivation < 700) return;
    action();
  });
}

// Alt+Z asks for confirmation; the existing Delete buttons keep their handlers.
if (deleteSolveDialog) {
  bindConfirmationAction(cancelDeleteSolveButton, () => {
    if (deleteSolveDialog.open) {
      pendingDeleteSolve = null;
      deleteSolveDialog.close();
    }
  });
  bindConfirmationAction(confirmDeleteSolveButton, () => {
    if (!deleteSolveDialog.open) return;
    const target = pendingDeleteSolve;
    deleteSolveDialog.close();
    if (target && state === 'ready' && target.eventCode === currentEvent) {
      applySolveAction(target.id, 'delete');
      focusTimerAfterAction();
    }
  });
  deleteSolveDialog.addEventListener('close', () => {
    // A queued close event can arrive after the user has reopened this dialog.
    if (deleteSolveDialog.open) return;
    pendingDeleteSolve = null;
    if (solveDetails?.open) closeSolveDetailsButton?.focus({ preventScroll: true });
    else timerPanel?.focus({ preventScroll: true });
  });
}

if (clearHistoryButton) {
  clearHistoryButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state !== 'solving' && !clearHistoryDialog?.open) clearAllSolves();
  });
}

if (cancelClearHistoryButton && clearHistoryDialog) {
  bindConfirmationAction(cancelClearHistoryButton, () => {
    if (!clearHistoryDialog.open) return;
    clearHistoryDialog.close();
    timerPanel?.focus({ preventScroll: true });
  });

  clearHistoryDialog.addEventListener('click', (event) => {
    if (event.target === clearHistoryDialog) {
      clearHistoryDialog.close();
    }
  });
}

if (confirmClearHistoryButton && clearHistoryDialog) {
  bindConfirmationAction(confirmClearHistoryButton, () => {
    if (!clearHistoryDialog.open || state === 'solving') return;
    recentSolves = [];
    lastSolveId = null;
    resetSession();
    saveHistory();
    renderStats();
    renderHistory();
    clearHistoryDialog.close();
    clearHistoryButton?.blur();
    timerPanel?.focus({ preventScroll: true });
  });
}

// Native buttons support both touch and keyboard activation.
for (const [kind, button] of Object.entries(statisticButtons)) {
  button?.addEventListener('click', () => showStatisticDetails(kind));
}
closeAverageDetailsButton?.addEventListener('click', () => averageDetails?.close());
averageDetails?.addEventListener('close', () => {
  if (averageDetails.open) return;
  if (averageDetailsTrigger && !averageDetailsTrigger.disabled) averageDetailsTrigger.focus({ preventScroll: true });
  averageDetailsTrigger = null;
});
averageDetails?.addEventListener('click', event => {
  if (event.target === averageDetails) averageDetails.close();
});

// Solve History List Item Click -> Opens Details Modal
if (solveList) {
  solveList.addEventListener('click', (event) => {
    const recordButton = event.target.closest('.solve-record-button');
    if (recordButton) {
      showSolveDetails(recordButton.dataset.solveId);
    }
  });
}

// Close Solve Details Modal
if (closeSolveDetailsButton && solveDetails) {
  closeSolveDetailsButton.addEventListener('click', () => {
    solveDetails.close();
  });

  solveDetails.addEventListener('close', () => {
    selectedSolveId = null;
  });

  solveDetails.addEventListener('click', (event) => {
    if (event.target === solveDetails) {
      solveDetails.close();
    }
  });
}

// Last Solve Actions Buttons (Quick DNF, +2, Revert, Delete on main panel)
document.querySelectorAll('.solve-actions .result-action').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const hasDraft = hasManualTimeDraft();

    if (action === 'dnf' && state === 'ready') {
      if (manualTimeEntryEnabled && (hasDraft || !lastSolveId)) {
        recordManualTime('dnf');
      } else if (lastSolveId) {
        applySolveAction(String(lastSolveId), 'dnf');
      } else {
        recordInspectionDnf();
      }
      return;
    }

    if (action === 'plus2') {
      if (manualTimeEntryEnabled) {
        if (hasDraft) {
          recordManualTime('+2');
        }
        return;
      }
      if (lastSolveId) {
        applySolveAction(String(lastSolveId), action);
      }
      return;
    }

    if ((action === 'reset' || action === 'delete') && manualTimeEntryEnabled) {
      if (hasDraft) {
        clearManualTimeDraft();
      }
      return;
    }

    if (!lastSolveId) {
      return;
    }

    applySolveAction(String(lastSolveId), action);
    if (action === 'delete') {
      resetSession();
    }
  });
});

// Prevent manual copying/cutting; only the explicit scramble-copy action is allowed.
let scrambleCopyFallbackText = null;
function isEditableTouchTarget(target) {
  return Boolean(target?.closest?.('input:not([readonly]):not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea:not([readonly]), select, [contenteditable="true"]'));
}

function clearAccidentalTouchSelection(event) {
  const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  if (!touchDevice || scrambleCopyFallbackText !== null || isEditableTouchTarget(event?.target)) return;
  const selection = window.getSelection?.();
  if (selection?.rangeCount) selection.removeAllRanges();
  if (document.activeElement === timerDisplay && timerDisplay.readOnly) {
    timerDisplay.blur();
    timerPanel?.focus({ preventScroll: true });
  }
}

document.addEventListener('pointerdown', clearAccidentalTouchSelection, { capture: true });
document.addEventListener('touchend', clearAccidentalTouchSelection, { passive: true });
document.addEventListener('selectionchange', () => {
  clearAccidentalTouchSelection({ target: document.activeElement });
});
document.addEventListener('contextmenu', (event) => {
  const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  if (touchDevice && !isEditableTouchTarget(event.target)) {
    event.preventDefault();
    clearAccidentalTouchSelection(event);
  }
});
document.addEventListener('copy', (event) => {
  event.preventDefault();
  if (scrambleCopyFallbackText !== null) {
    event.clipboardData?.setData('text/plain', scrambleCopyFallbackText);
  }
});
document.addEventListener('cut', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => event.preventDefault());

async function copyText(text, container, trigger) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
  } catch {
    // Keep fallback selection inside the active modal for Safari and older browsers.
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.top = '0';
    input.style.left = '0';
    input.readOnly = true;
    input.style.setProperty('user-select', 'text', 'important');
    input.style.setProperty('-webkit-user-select', 'text', 'important');
    container.appendChild(input);
    try {
      scrambleCopyFallbackText = text;
      input.select();
      if (!document.execCommand('copy')) throw new Error('Copy failed');
    } finally {
      scrambleCopyFallbackText = null;
      input.remove();
      trigger.focus({ preventScroll: true });
    }
  }
}

copySolveScramble?.addEventListener('click', async () => {
  const entry = recentSolves.find((solve) => String(solve.id) === String(selectedSolveId));
  if (!entry?.scramble || state === 'solving') return;
  const solveId = selectedSolveId;
  try {
    await copyText(entry.scramble, solveDetails, copySolveScramble);
    if (copyScrambleStatus && selectedSolveId === solveId) copyScrambleStatus.textContent = 'Scramble copied.';
  } catch {
    if (copyScrambleStatus && selectedSolveId === solveId) copyScrambleStatus.textContent = 'Unable to copy. Please try again.';
  }
});

copyAverageDetailsButton?.addEventListener('click', async () => {
  if (!averageDetails?.open) return;
  const text = averageDetailsText.textContent;
  try {
    await copyText(text, averageDetails, copyAverageDetailsButton);
    if (averageDetails.open && averageDetailsText.textContent === text) copyAverageStatus.textContent = 'Average copied.';
  } catch {
    if (averageDetails.open && averageDetailsText.textContent === text) copyAverageStatus.textContent = 'Unable to copy. Please try again.';
  }
});

// Modal Solve Detail Actions
document.querySelectorAll('.solve-detail-actions .result-action').forEach((button) => {
  button.addEventListener('click', () => {
    if (selectedSolveId) {
      applySolveAction(selectedSolveId, button.dataset.action);
    }
  });
});

// Run after the action handlers, including branches that return early.
document.querySelectorAll('.solve-actions .result-action, .solve-detail-actions .result-action').forEach((button) => {
  button.addEventListener('click', focusTimerAfterAction);
});

// Palette Selector Change
if (colorPaletteSelect) {
  colorPaletteSelect.addEventListener('change', () => {
    colorPalette = colorPaletteSelect.value;
    saveThemePreference();
    applyTheme();
  });
}

// Settings Menu Dropdown Toggle
if (menuToggle && settingsMenu) {
  menuToggle.addEventListener('click', () => {
    settingsMenu.hidden = !settingsMenu.hidden;
    menuToggle.setAttribute('aria-expanded', String(!settingsMenu.hidden));
    if (settingsMenu.hidden) {
      menuToggle.blur();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu')) {
      closeSettingsMenu();
    }
  });
}

// Touch / Mouse Pointer Interaction on Timer Panel
if (timerPanel) {
  // Prevent context menu (magnifier/copy callout) on long press
  timerPanel.addEventListener('contextmenu', (event) => {
    if (event.target !== timerDisplay || timerDisplay.readOnly) {
      event.preventDefault();
    }
  });

  const shouldIgnorePointer = (event) => {
    // Disallow mouse clicks on PC - only allow touch/smartphone/tablet interactions
    if (event.pointerType === 'mouse') {
      return true;
    }
    if (manualTimeEntryEnabled && state !== 'solving') {
      return true;
    }
    const isReadOnlyTimerDisplay = event.target === timerDisplay && timerDisplay.readOnly;
    if (event.target.closest('button, select, label, [role="button"]') && !isReadOnlyTimerDisplay) {
      return true;
    }
    return false;
  };

  // The timer's release handler owns its cooldown. Never cancel pointerup globally:
  // doing so can suppress native taps on dialog/menu buttons in mobile browsers.

  let activeTouchId = null;
  const handlePointerPress = (event) => {
    if (activeTouchId !== null || event.isPrimary === false) return;
    if (shouldIgnorePointer(event)) {
      return;
    }

    // Cooldown lockout after stopping a solve
    if (performance.now() - lastSolveStoppedAt < 600) {
      event.preventDefault();
      return;
    }

    if (state === 'solving') {
      finishSolve();
      lastSolveStoppedAt = performance.now();
      justStopped = true;
      justStoppedPointer = true;
      event.preventDefault();
      return;
    }

    activeTouchId = event.pointerId ?? 0;
    if (event.pointerId !== undefined) timerPanel.setPointerCapture?.(event.pointerId);
    justStoppedPointer = false;

        // When ready: if inspection is enabled, start inspection immediately on tap (no hold delay)
    if (state === 'ready') {
      if (inspectionEnabled) {
        pointerStartedInspection = true;
        beginInspection();
        event.preventDefault();
        return;
      }
      // If inspection is disabled: check holdToStart setting
      if (holdToStartEnabled) {
        prepareDelayedStart(true);

        event.preventDefault();
        return;
      } else {
        prepareQuickStart();
        event.preventDefault();
        return;
      }
    }

    // During inspection: arm on press and start on release, with an optional hold delay.
    if (state === 'inspecting' || state === 'readyToSolve') {
      if (holdToStartEnabled) {
        prepareDelayedStart(true);

        event.preventDefault();
        return;
      } else {
        prepareQuickStart();
        event.preventDefault();
        return;
      }
    }
  };
  timerPanel.addEventListener('pointerdown', handlePointerPress);
  // Passive mobile surfaces share the timer's existing hold/inspection state machine.
  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!target?.closest?.('.page-shell') || target.closest('#timerPanel, #settingsMenu, button, select, input, label, a, dialog, .solve-list, [role="button"]')) return;
    const text = target.closest('.scramble-text');
    if (text && text.scrollHeight > text.clientHeight) return;
    if (!window.matchMedia?.('(max-width: 840px), (max-height: 540px) and (orientation: landscape)').matches) return;
    handlePointerPress(event);
  });

  const handlePointerRelease = (event, ownedTouch = false) => {
    if (activeTouchId !== null && event.pointerId !== undefined && activeTouchId !== event.pointerId) return;
    if (!ownedTouch && shouldIgnorePointer(event)) {
      return;
    }

    if (holdTimeoutId !== null) {
      clearTimeout(holdTimeoutId);
      holdTimeoutId = null;
    }

    activeTouchId = null;
        if (justStoppedPointer || performance.now() - lastSolveStoppedAt < 600) {
      justStoppedPointer = false;
      return;
    }

    // If tap started inspection, ignore pointerup
    if (pointerStartedInspection) {
      pointerStartedInspection = false;
      return;
    }
    // If held for full hold duration: start solve!
    if (isHoldReady) {
      isHoldReady = false;
      timerDisplay.classList.remove('holding-wait', 'holding-ready', 'space-held');

      if (state === 'holding') {
        beginSolve();
        pointerStartedInspection = false;
        event.preventDefault();
        return;
      }

      if (state === 'inspecting' || state === 'readyToSolve') {
        beginSolve();
        pointerStartedInspection = false;
        event.preventDefault();
        return;
      }
    } else {
      // Released too early -> Cancel and do not start!
      isHoldReady = false;
      timerDisplay.classList.remove('holding-wait', 'holding-ready', 'space-held');

      if (state === 'holding') {
        setTimerState('ready');
        const lastSolve = recentSolves.find((s) => String(s.id) === String(lastSolveId));
        if (lastSolve && Number.isFinite(lastSolve.baseTimeMs)) {
          updateDisplay(formatTime(lastSolve.baseTimeMs));
        } else {
          updateDisplay('0.00');
        }
        event.preventDefault();
        return;
      }

      if (state === 'inspecting') {
        timerState.textContent = 'Inspecting';
        timerState.className = 'timer-state inspecting';
      }
    }
  };

  timerPanel.addEventListener('pointerup', handlePointerRelease);
  // Safari may retain the original release target despite pointer capture.
  document.addEventListener('pointerup', (event) => {
    if (activeTouchId !== null && !event.target?.closest?.('#timerPanel')) handlePointerRelease(event, true);
  });
  const cancelPointerHold = (event) => {
    if (activeTouchId !== null && event.pointerId !== undefined && activeTouchId !== event.pointerId) return;
    activeTouchId = null;
    if (holdTimeoutId !== null) {
      clearTimeout(holdTimeoutId);
      holdTimeoutId = null;
    }
    isHoldReady = false;
    timerDisplay.classList.remove('holding-wait', 'holding-ready', 'space-held');

    if (state === 'holding') {
      setTimerState('ready');
      const lastSolve = recentSolves.find((s) => String(s.id) === String(lastSolveId));
      if (lastSolve && Number.isFinite(lastSolve.baseTimeMs)) {
        updateDisplay(formatTime(lastSolve.baseTimeMs));
      } else {
        updateDisplay('0.00');
      }
    }
    pointerStartedInspection = false;
    justStoppedPointer = false;
  };
  timerPanel.addEventListener('pointercancel', cancelPointerHold);
  document.addEventListener('pointercancel', (event) => {
    if (activeTouchId !== null && !event.target?.closest?.('#timerPanel')) cancelPointerHold(event);
  });
}

// Inspection Mode Toggle
if (inspectionToggle) {
  inspectionToggle.checked = inspectionEnabled;
  inspectionToggle.addEventListener('change', () => {
    inspectionEnabled = inspectionToggle.checked;
    saveInspectionPreference();

    if (state === 'inspecting') {
      resetSession();
    }

    if (!inspectionEnabled && state === 'ready') {
      updateDisplay(manualTimeEntryEnabled ? '' : '0.00');
    }
  });
}

// Hold to Start Mode Toggle
if (holdToStartToggle) {
  holdToStartToggle.checked = holdToStartEnabled;
  holdToStartToggle.addEventListener('change', () => {
    holdToStartEnabled = holdToStartToggle.checked;
    saveHoldToStartPreference();

    if (state === 'holding') {
      resetSession();
    }
  });
}

// Manual Time Entry Toggle
if (manualTimeToggle) {
  manualTimeToggle.checked = manualTimeEntryEnabled;
  manualTimeToggle.addEventListener('change', () => {
    manualTimeEntryEnabled = manualTimeToggle.checked;
    saveManualTimeEntryPreference();
    syncManualTimeEntry();
    syncSolveActionAvailability();
    timerDisplay?.blur();
  });
}

/* ==========================================================================
   13. Application Startup Initialization
   ========================================================================== */
applyTheme();
syncSolveActionAvailability();
renderStats();
renderHistory();

if (timerPanel) {
  resetSession();
  restoreScramble(currentEvent);
}
