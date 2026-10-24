/**
 * @file BTime - Rubik's Cube Speedcubing Timer Application
 * @description Provides random-state scramble generation, 15s WCA inspection,
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

// Settings Menu & Toggles
const menuToggle = document.getElementById('menuToggle');
const settingsMenu = document.getElementById('settingsMenu');
const inspectionToggle = document.getElementById('inspectionToggle');
const holdToStartToggle = document.getElementById('holdToStartToggle');
const manualTimeToggle = document.getElementById('manualTimeToggle');
const colorPaletteSelect = document.getElementById('colorPaletteSelect');

// Solve Details Dialog Elements
const solveDetails = document.getElementById('solveDetails');
const solveDetailTime = document.getElementById('solveDetailTime');
const solveDetailScramble = document.getElementById('solveDetailScramble');
const closeSolveDetailsButton = document.getElementById('closeSolveDetails');

// Clear History Confirmation Dialog
const clearHistoryDialog = document.getElementById('clearHistoryDialog');
const clearHistoryMessage = document.getElementById('clearHistoryMessage');
const cancelClearHistoryButton = document.getElementById('cancelClearHistory');
const confirmClearHistoryButton = document.getElementById('confirmClearHistory');

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
  'shell-pink',
  'dessert',
  'purple',
  'chessboard',
  'oilspill',
  'sunrise',
  'shibuya',
  'christmas',
  'halloween',
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
const scrambleQueues = new Map();

// Solves History State
let recentSolves = loadHistory(currentEvent);
let lastSolveId = null;
let selectedSolveId = null;

// Cached Cubing.js Scrambler Module Loader
let cubingScramblerPromise = null;

/* ==========================================================================
   3. Scramble Visualizer Dynamic Web Component Loader
   ========================================================================== */

import('https://esm.sh/scramble-display@0.59.1?deps=cubing@0.59.1')
  .then(() => {
    if (scrambleReady) {
      updateScrambleVisualization(currentEvent, scramble.join(' '));
    }
    if (scrambleVisualStatus) {
      scrambleVisualStatus.textContent = '';
    }
  })
  .catch((error) => {
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

function loadSavedScramble(eventCode) {
  try {
    return localStorage.getItem(scrambleStorageKey(eventCode)) || '';
  } catch (error) {
    console.error(`Unable to load the saved ${eventCode} scramble.`, error);
    return '';
  }
}

function saveScramble(eventCode, value) {
  try {
    localStorage.setItem(scrambleStorageKey(eventCode), value);
  } catch (error) {
    console.error(`Unable to save the ${eventCode} scramble.`, error);
  }
}

function loadEventPreference() {
  try {
    const saved = localStorage.getItem(EVENT_STORAGE_KEY);
    return EVENTS.some((event) => event.code === saved) ? saved : '333';
  } catch (error) {
    return '333';
  }
}

function saveEventPreference() {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, currentEvent);
  } catch (error) {
    console.error('Unable to save the selected event.', error);
  }
}

function loadHistory(eventCode) {
  try {
    const saved = localStorage.getItem(eventStorageKey(eventCode));
    if (!saved) {
      return [];
    }

    return JSON.parse(saved)
      .map((entry) => ({
        id: entry.id || generateSolveId(),
        baseTimeMs: Number(entry.baseTimeMs ?? entry.timeMs ?? 0),
        timeMs: Number(entry.timeMs ?? entry.baseTimeMs ?? 0),
        result: entry.result ?? 'ok',
        tag: entry.tag || getEventLabel(eventCode),
        scramble: typeof entry.scramble === 'string' ? entry.scramble : '',
      }))
      .filter((entry) => entry.result === 'dnf' || Number.isFinite(entry.baseTimeMs));
  } catch (error) {
    return [];
  }
}

function saveHistory() {
  try {
    const cleanHistory = recentSolves
      .filter((entry) => entry.result === 'dnf' || Number.isFinite(entry.baseTimeMs))
      .slice(0, 50);

    localStorage.setItem(eventStorageKey(currentEvent), JSON.stringify(cleanHistory));
  } catch (error) {
    console.error(`Unable to save ${currentEvent} solve history.`, error);
  }
}

function loadInspectionPreference() {
  try {
    const saved = localStorage.getItem(INSPECTION_STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch (error) {
    return true;
  }
}

function saveInspectionPreference() {
  try {
    localStorage.setItem(INSPECTION_STORAGE_KEY, JSON.stringify(inspectionEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

function loadThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
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
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(colorPalette));
  } catch (error) {
    // Ignore storage errors
  }
}

function loadHoldToStartPreference() {
  try {
    const saved = localStorage.getItem(HOLD_TO_START_STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : false;
  } catch (error) {
    return false;
  }
}

function saveHoldToStartPreference() {
  try {
    localStorage.setItem(HOLD_TO_START_STORAGE_KEY, JSON.stringify(holdToStartEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

function loadManualTimeEntryPreference() {
  try {
    const saved = localStorage.getItem(MANUAL_TIME_STORAGE_KEY);
    if (saved === null) {
      return false;
    }
    const parsed = JSON.parse(saved);
    return typeof parsed === 'boolean' ? parsed : false;
  } catch (error) {
    return false;
  }
}

function saveManualTimeEntryPreference() {
  try {
    localStorage.setItem(MANUAL_TIME_STORAGE_KEY, JSON.stringify(manualTimeEntryEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * Applies the active color palette and updates the dark-mode class and select value.
 */
function applyTheme() {
  document.body.classList.toggle(
    'dark-mode',
    colorPalette === 'night' ||
    colorPalette === 'oilspill' ||
    colorPalette === 'sunrise' ||
    colorPalette === 'shibuya' ||
    colorPalette === 'halloween'
  );
  document.body.dataset.palette = colorPalette;

  if (colorPaletteSelect) {
    colorPaletteSelect.value = colorPalette;
  }
}

/* ==========================================================================
   5. Scramble Generation Pipeline & Prefetch Queue
   ========================================================================== */

/**
 * Asynchronously loads the Cubing.js scramble engine once and caches it.
 * @returns {Promise<Function>} randomScrambleForEvent function
 */
async function loadScrambler() {
  if (!cubingScramblerPromise) {
    cubingScramblerPromise = Promise.all([
      import('https://esm.sh/cubing@0.59.1/search'),
      import('https://esm.sh/cubing@0.59.1/scramble'),
    ]).then(([{ setSearchDebug }, { randomScrambleForEvent }]) => {
      setSearchDebug({ logPerf: false });
      return randomScrambleForEvent;
    });
  }
  return cubingScramblerPromise;
}

/**
 * Generates a valid random-state scramble sequence for the given WCA event.
 * @param {string} eventCode
 * @returns {Promise<string>}
 */
async function getNewScramble(eventCode) {
  const randomScrambleForEvent = await loadScrambler();
  const isCube = CUBE_EVENTS.has(eventCode);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const generatedScramble = await randomScrambleForEvent(eventCode);
    const moves = generatedScramble.toString().trim().split(/\s+/);
    const isValid =
          moves.length > 0 &&
          (eventCode !== '333' || (moves.length >= 19 && moves.length <= 22)) &&
          (isCube ? moves.every((move) => VALID_MOVE_REGEX.test(move)) : true);

    if (isValid) {
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
function prefetchScrambles(eventCode = currentEvent) {
  const queue = getScrambleQueue(eventCode);
  if (queue.pending || queue.error || queue.items.length >= SCRAMBLE_PREFETCH_COUNT) {
    return;
  }

  queue.pending = getNewScramble(eventCode)
    .then((nextScramble) => {
      queue.items.push(nextScramble);
    })
    .catch((error) => {
      queue.error = error;
      console.error(`Unable to prefetch a ${eventCode} scramble.`, error);
    })
    .finally(() => {
      queue.pending = null;
      if (!queue.error && queue.items.length < SCRAMBLE_PREFETCH_COUNT) {
        prefetchScrambles(eventCode);
      }
    });
}

/**
 * Retrieves the next available scramble from the prefetch queue or generates one.
 * @param {string} eventCode
 * @returns {Promise<string>}
 */
async function getQueuedScramble(eventCode) {
  const queue = getScrambleQueue(eventCode);
  while (!queue.items.length) {
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
        console.error(`Unable to generate a ${eventCode} random-state scramble.`, error);
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
  const requestId = ++scrambleRequestId;
  const savedScramble = loadSavedScramble(eventCode);

  if (!savedScramble) {
    return generateScramble(eventCode);
  }

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
 * Calculates a standard WCA trimmed average for a window of solves.
 * Drops the fastest and slowest times. Allows at most one DNF (treated as slowest).
 * @param {Array<object>} solves
 * @param {number} solveCount - Size of the average (e.g. 5 or 12)
 * @returns {{ value: number|null, isDnf: boolean }}
 */
function getTrimmedAverage(solves, solveCount) {
  if (solves.length < solveCount) {
    return { value: null, isDnf: false };
  }

  const windowSolves = solves.slice(-solveCount);
  const dnfCount = windowSolves.filter((solve) => solve.result === 'dnf').length;

  // More than 1 DNF in an average window results in an overall DNF average
  if (dnfCount > 1) {
    return { value: null, isDnf: true };
  }

  const times = windowSolves
    .filter((solve) => solve.result !== 'dnf')
    .map(getSolveValue)
    .filter((value) => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

  // If there's 1 DNF, it counts as the single worst time; drop 1 best time and average the rest.
  // Otherwise, drop both the single fastest and single slowest times.
  const countedTimes = dnfCount === 1 ? times.slice(1) : times.slice(1, -1);

  return {
    value: countedTimes.reduce((sum, value) => sum + value, 0) / countedTimes.length,
    isDnf: false,
  };
}

/**
 * Recalculates and renders Best Single, Best Ao5, Current Ao5, Current Ao12, and Session Mean.
 */
function renderStats() {
  if (!bestTimeEl || !avg5El || !bestAvg5El || !avg12El) {
    return;
  }

  // Filter valid numeric times across the session
  const validTimes = recentSolves
    .filter((solve) => solve.result !== 'dnf')
    .map(getSolveValue)
    .filter((value) => value !== null && Number.isFinite(value));

  const bestSingle = validTimes.length ? Math.min(...validTimes) : null;
  const meanTime = validTimes.length
    ? validTimes.reduce((sum, value) => sum + value, 0) / validTimes.length
    : null;

  const currentAvg5 = getTrimmedAverage(recentSolves, 5);
  const currentAvg12 = getTrimmedAverage(recentSolves, 12);

  // Compute all-time best Ao5 in this session
  let bestAvg5 = null;
  for (let end = 5; end <= recentSolves.length; end += 1) {
    const windowAvg5 = getTrimmedAverage(recentSolves.slice(end - 5, end), 5);
    if (!windowAvg5.isDnf && windowAvg5.value !== null) {
      bestAvg5 = bestAvg5 === null ? windowAvg5.value : Math.min(bestAvg5, windowAvg5.value);
    }
  }

  bestTimeEl.textContent = formatMetric(bestSingle);
  bestAvg5El.textContent = formatMetric(bestAvg5);
  avg5El.textContent = currentAvg5.isDnf ? 'DNF' : formatMetric(currentAvg5.value);
  avg12El.textContent = currentAvg12.isDnf ? 'DNF' : formatMetric(currentAvg12.value);

  if (meanTimeEl) {
    meanTimeEl.textContent = formatMetric(meanTime);
  }
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

  solveList.innerHTML = '';

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
  solveDetailTime.textContent = formatHistoryValue(entry);
  solveDetailScramble.textContent = entry.scramble || 'Scramble was not saved for this solve.';
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

  if (eventSelect) {
    eventSelect.disabled = nextState === 'solving';
  }
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
  recentSolves = recentSolves.slice(-50);
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
  recentSolves = recentSolves.slice(-50);
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

  if (!Number.isFinite(timeMs) || timeMs <= 0) {
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
  timerDisplay.focus();
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
  timerDisplay.focus();
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
    timerPanel.focus();
  }
}

/* ==========================================================================
   12. Input Event Handlers (Keyboard, Pointer, Buttons)
   ========================================================================== */

function isSpaceKey(event) {
  return event.code === 'Space' || event.key === ' ' || event.keyCode === 32;
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
    setTimeout(() => confirmClearHistoryButton?.focus(), 10);
  }
}

// Global Keyboard Handler (Spacebar Hold-to-Start)
window.addEventListener('keydown', (event) => {
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

  // Stop solve immediately on keydown
  if (state === 'solving') {
    finishSolve();
    lastSolveStoppedAt = performance.now();
    justStopped = true;
    return;
  }
  // During inspection: start solve immediately if holdToStart is disabled, or hold if enabled
  if (state === 'inspecting' || state === 'readyToSolve') {
    if (holdToStartEnabled) {
      isHoldReady = false;
      timerState.textContent = 'Hold...';
      timerDisplay.classList.add('space-held', 'holding-wait');
      timerDisplay.classList.remove('holding-ready');

      if (holdTimeoutId !== null) {
        clearTimeout(holdTimeoutId);
      }

      holdTimeoutId = window.setTimeout(() => {
        isHoldReady = true;
        timerState.textContent = 'Release to start';
        timerDisplay.classList.remove('holding-wait');
        timerDisplay.classList.add('holding-ready');
        flashDisplay();
      }, REQUIRED_HOLD_MS);

      return;
    } else {
      // Instant start when Hold-to-Start is disabled (0ms delay)
      beginSolve();
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
      isHoldReady = false;
      spaceStartedInspection = false;
      cancelAnimation();
      setTimerState('holding');
      timerState.textContent = 'Hold...';
      timerState.className = 'timer-state holding holding-wait';
      timerDisplay.classList.add('holding-wait');
      timerDisplay.classList.remove('holding-ready');
      updateDisplay('0.00');

      if (holdTimeoutId !== null) {
        clearTimeout(holdTimeoutId);
      }

      holdTimeoutId = window.setTimeout(() => {
        isHoldReady = true;
        timerState.textContent = 'Release to start';
        timerState.className = 'timer-state holding holding-ready';
        timerDisplay.classList.remove('holding-wait');
        timerDisplay.classList.add('holding-ready');
        flashDisplay();
      }, REQUIRED_HOLD_MS);

      return;
    } else {
      // Instant start when Hold-to-Start is disabled (0ms delay)
      beginSolve();
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
  if (!holdToStartEnabled) {
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
if (eventSelect) {
  eventSelect.value = currentEvent;
  eventSelect.addEventListener('change', () => {
    const selectedEvent = EVENTS.find((event) => event.code === eventSelect.value);
    if (!selectedEvent || state === 'solving') {
      eventSelect.value = currentEvent;
      return;
    }

    currentEvent = selectedEvent.code;
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
if (clearHistoryButton) {
  clearHistoryButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const eventLabel = getEventLabel(currentEvent);
    if (clearHistoryMessage) {
      clearHistoryMessage.textContent = `Are you sure you want to delete all ${eventLabel} session records? This cannot be undone.`;
    }
    clearHistoryDialog?.showModal();
  });
}

if (cancelClearHistoryButton && clearHistoryDialog) {
  cancelClearHistoryButton.addEventListener('click', () => {
    clearHistoryDialog.close();
  });

  clearHistoryDialog.addEventListener('click', (event) => {
    if (event.target === clearHistoryDialog) {
      clearHistoryDialog.close();
    }
  });
}

if (confirmClearHistoryButton && clearHistoryDialog) {
  confirmClearHistoryButton.addEventListener('click', () => {
    recentSolves = [];
    lastSolveId = null;
    resetSession();
    saveHistory();
    renderStats();
    renderHistory();
    clearHistoryDialog.close();
    clearHistoryButton?.blur();
  });
}

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

    if (action === 'dnf' && manualTimeEntryEnabled && state === 'ready') {
      recordManualTime('dnf');
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

// Modal Solve Detail Actions
document.querySelectorAll('.solve-detail-actions .result-action').forEach((button) => {
  button.addEventListener('click', () => {
    if (selectedSolveId) {
      applySolveAction(selectedSolveId, button.dataset.action);
    }
  });
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

  // Immediate stop on screen touch down when solving (smartphone / touchscreen only)
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (state === 'solving') {
        if (event.pointerType === 'mouse') {
          return;
        }
        if (!event.target.closest('#settingsMenu, .solve-dialog')) {
          event.preventDefault();
          event.stopPropagation(); // CRITICAL: Stop event from bubbling to timerPanel
          finishSolve();
          lastSolveStoppedAt = performance.now();
          justStopped = true;
          justStoppedPointer = true;
        }
      }
    },
    { capture: true }
  );

  // Prevent lifting finger after stopping from re-triggering anything
  window.addEventListener(
    'pointerup',
    (event) => {
      if (justStoppedPointer || performance.now() - lastSolveStoppedAt < 600) {
        justStoppedPointer = false;
        if (event.pointerType !== 'mouse') {
          event.preventDefault();
        }
      }
    },
    { capture: true }
  );

  timerPanel.addEventListener('pointerdown', (event) => {
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
        isHoldReady = false;
        pointerStartedInspection = false;
        cancelAnimation();
        setTimerState('holding');
        timerState.textContent = 'Hold...';
        timerState.className = 'timer-state holding holding-wait';
        timerDisplay.classList.add('holding-wait');
        timerDisplay.classList.remove('holding-ready');
        updateDisplay('0.00');

        if (holdTimeoutId !== null) {
          clearTimeout(holdTimeoutId);
        }

        holdTimeoutId = window.setTimeout(() => {
          isHoldReady = true;
          timerState.textContent = 'Release to start';
          timerState.className = 'timer-state holding holding-ready';
          timerDisplay.classList.remove('holding-wait');
          timerDisplay.classList.add('holding-ready');
          flashDisplay();
          if (navigator.vibrate) {
            try { navigator.vibrate(40); } catch (_) {}
          }
        }, REQUIRED_HOLD_MS);

        event.preventDefault();
        return;
      } else {
        // Instant start when Hold-to-Start is disabled (0ms delay)
        beginSolve();
        event.preventDefault();
        return;
      }
    }

    // During inspection: instant start if holdToStart is disabled, or hold if enabled
    if (state === 'inspecting' || state === 'readyToSolve') {
      if (holdToStartEnabled) {
        isHoldReady = false;
        timerState.textContent = 'Hold...';
        timerDisplay.classList.add('space-held', 'holding-wait');
        timerDisplay.classList.remove('holding-ready');

        if (holdTimeoutId !== null) {
          clearTimeout(holdTimeoutId);
        }

        holdTimeoutId = window.setTimeout(() => {
          isHoldReady = true;
          timerState.textContent = 'Release to start';
          timerDisplay.classList.remove('holding-wait');
          timerDisplay.classList.add('holding-ready');
          flashDisplay();
          if (navigator.vibrate) {
            try { navigator.vibrate(40); } catch (_) {}
          }
        }, REQUIRED_HOLD_MS);

        event.preventDefault();
        return;
      } else {
        // Instant start when Hold-to-Start is disabled (0ms delay)
        beginSolve();
        event.preventDefault();
        return;
      }
    }
  });

  const handlePointerRelease = (event) => {
    if (holdTimeoutId !== null) {
      clearTimeout(holdTimeoutId);
      holdTimeoutId = null;
    }

    if (shouldIgnorePointer(event)) {
      return;
    }

        if (justStoppedPointer || performance.now() - lastSolveStoppedAt < 600) {
      justStoppedPointer = false;
      return;
    }

    // If tap started inspection, ignore pointerup
    if (pointerStartedInspection) {
      pointerStartedInspection = false;
      return;
    }
    if (!holdToStartEnabled) {
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
  timerPanel.addEventListener('pointercancel', () => {
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
