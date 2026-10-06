const scrambleText = document.getElementById('scrambleText');
const timerDisplay = document.getElementById('timerDisplay');
const timerState = document.getElementById('timerState');
const timerPanel = document.getElementById('timerPanel');
const manualTimeToggle = document.getElementById('manualTimeToggle');
const manualTimeHelp = document.getElementById('manualTimeHelp');
const newScrambleButton = document.getElementById('newScramble');
const clearHistoryButton = document.getElementById('clearHistory');
const clearHistoryDialog = document.getElementById('clearHistoryDialog');
const clearHistoryMessage = document.getElementById('clearHistoryMessage');
const cancelClearHistoryButton = document.getElementById('cancelClearHistory');
const confirmClearHistoryButton = document.getElementById('confirmClearHistory');
const eventSelect = document.getElementById('eventSelect');
let scrambleVisualization = document.getElementById('scrambleVisualization');
const scrambleVisualStatus = document.getElementById('scrambleVisualStatus');
const inspectionToggle = document.getElementById('inspectionToggle');
const colorPaletteSelect = document.getElementById('colorPaletteSelect');
const holdToStartToggle = document.getElementById('holdToStartToggle');
const menuToggle = document.getElementById('menuToggle');
const settingsMenu = document.getElementById('settingsMenu');
const solveActions = document.getElementById('solveActions');
const solveList = document.getElementById('solveList');
const solveDetails = document.getElementById('solveDetails');
const solveDetailTime = document.getElementById('solveDetailTime');
const solveDetailScramble = document.getElementById('solveDetailScramble');
const closeSolveDetailsButton = document.getElementById('closeSolveDetails');

const bestTimeEl = document.getElementById('bestTime');
const avg5El = document.getElementById('avg5');
const bestAvg5El = document.getElementById('bestAvg5');
const avg12El = document.getElementById('avg12');
const meanTimeEl = document.getElementById('meanTime');

const STORAGE_KEY = 'bcube-timer-history';
const EVENT_STORAGE_KEY = 'bcube-timer-event';
const INSPECTION_STORAGE_KEY = 'bcube-timer-inspection';
const THEME_STORAGE_KEY = 'bcube-timer-theme';
const HOLD_TO_START_STORAGE_KEY = 'bcube-timer-hold-to-start';
const MANUAL_TIME_STORAGE_KEY = 'bcube-timer-manual-time';
const INSPECTION_SECONDS = 15;
const INSPECTION_GRACE_SECONDS = 1;
const SCRAMBLE_PREFETCH_COUNT = 5;
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

let state = 'ready';
let currentEvent = loadEventPreference();
let inspectionEnabled = loadInspectionPreference();
let colorPalette = loadThemePreference();
let holdToStartEnabled = loadHoldToStartPreference();
let manualTimeEntryEnabled = loadManualTimeEntryPreference();
let manualTimeDraftActive = false;
let isSpaceDown = false;
let justStopped = false;
let spaceStartedInspection = false;
let solveStartTimestamp = null;
let inspectionStartTimestamp = null;
let rafId = null;
let inspectionGraceTimeoutId = null;
let scramble = [];
let scrambleReady = false;
let scrambleRequestPromise = null;
let scrambleRequestId = 0;
const scrambleQueues = new Map();
let recentSolves = loadHistory(currentEvent);
let lastSolveId = null;
let selectedSolveId = null;
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

function eventStorageKey(eventCode) {
  return eventCode === '333' ? STORAGE_KEY : `${STORAGE_KEY}-${eventCode}`;
}

function scrambleStorageKey(eventCode) {
  return `bcube-timer-scramble-${eventCode}`;
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
        id: entry.id || `${Date.now()}-${Math.random()}`,
        baseTimeMs: Number(entry.baseTimeMs ?? entry.timeMs ?? 0),
        timeMs: Number(entry.timeMs ?? entry.baseTimeMs ?? 0),
        result: entry.result ?? 'ok',
        tag: entry.tag || EVENTS.find((event) => event.code === eventCode).label,
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

    return [
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
    ].includes(parsed)
      ? parsed
      : 'light';
  } catch (error) {
    return 'light';
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

function saveInspectionPreference() {
  try {
    localStorage.setItem(INSPECTION_STORAGE_KEY, JSON.stringify(inspectionEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

function saveThemePreference() {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(colorPalette));
  } catch (error) {
    // Ignore storage errors
  }
}

function saveHoldToStartPreference() {
  try {
    localStorage.setItem(HOLD_TO_START_STORAGE_KEY, JSON.stringify(holdToStartEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

function saveManualTimeEntryPreference() {
  try {
    localStorage.setItem(MANUAL_TIME_STORAGE_KEY, JSON.stringify(manualTimeEntryEnabled));
  } catch (error) {
    // Ignore storage errors
  }
}

function applyTheme() {
  document.body.classList.toggle(
    'dark-mode',
    colorPalette === 'night' ||
    colorPalette === 'oilspill' ||
    colorPalette === 'sunrise' ||
    colorPalette === 'shibuya'
  );
  document.body.dataset.palette = colorPalette;

  if (colorPaletteSelect) {
    colorPaletteSelect.value = colorPalette;
  }
}

function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
  }

  return `${seconds.toFixed(2)}`;
}

function formatMetric(value) {
  return value === null || value === undefined || Number.isNaN(value) ? '--' : formatTime(value);
}

function getSolveValue(entry) {
  if (!entry || entry.result === 'dnf') return null;

  const baseValue = Number(entry.baseTimeMs ?? entry.timeMs ?? 0);
  if (!Number.isFinite(baseValue)) {
    return null;
  }

  const value = entry.result === '+2' ? baseValue + 2000 : baseValue;
  return value;
}

function getTrimmedAverage(solves, solveCount) {
  if (solves.length < solveCount) {
    return { value: null, isDnf: false };
  }

  const window = solves.slice(-solveCount);
  const dnfCount = window.filter((solve) => solve.result === 'dnf').length;
  if (dnfCount > 1) {
    return { value: null, isDnf: true };
  }

  const times = window
    .filter((solve) => solve.result !== 'dnf')
    .map((solve) => getSolveValue(solve))
    .filter((value) => value !== null && !Number.isNaN(value))
    .sort((a, b) => a - b);
  const countedTimes = dnfCount === 1 ? times.slice(1) : times.slice(1, -1);

  return {
    value: countedTimes.reduce((sum, value) => sum + value, 0) / countedTimes.length,
    isDnf: false,
  };
}

function renderStats() {
  if (!bestTimeEl || !avg5El || !bestAvg5El || !avg12El) {
    return;
  }

  const values = recentSolves
    .filter((solve) => solve.result !== 'dnf')
    .map((solve) => getSolveValue(solve))
    .filter((value) => value !== null && !Number.isNaN(value));
  const timedSolveValues = recentSolves
    .filter((solve) => String(solve.result).toLowerCase() !== 'dnf')
    .map((solve) => getSolveValue(solve))
    .filter((value) => value !== null && Number.isFinite(value));

  const best = values.length ? Math.min(...values) : null;
  const mean = timedSolveValues.length
    ? timedSolveValues.reduce((sum, value) => sum + value, 0) / timedSolveValues.length
    : null;
  const avg5 = getTrimmedAverage(recentSolves, 5);
  const avg12 = getTrimmedAverage(recentSolves, 12);
  let bestAvg5 = null;

  for (let end = 5; end <= recentSolves.length; end += 1) {
    const windowAvg5 = getTrimmedAverage(recentSolves.slice(0, end), 5);
    if (!windowAvg5.isDnf && windowAvg5.value !== null) {
      bestAvg5 = bestAvg5 === null ? windowAvg5.value : Math.min(bestAvg5, windowAvg5.value);
    }
  }

  bestTimeEl.textContent = formatMetric(best);
  avg5El.textContent = avg5.isDnf ? 'DNF' : formatMetric(avg5.value);
  bestAvg5El.textContent = formatMetric(bestAvg5);
  avg12El.textContent = avg12.isDnf ? 'DNF' : formatMetric(avg12.value);
  if (meanTimeEl) {
    meanTimeEl.textContent = formatMetric(mean);
  }
}

function formatHistoryValue(entry) {
  if (!entry) return 'DNF';

  if (entry.result === 'dnf') {
    return 'DNF';
  }

  const value = getSolveValue(entry);
  if (value === null) {
    return 'DNF';
  }

  if (entry.result === '+2') {
    return `${formatTime(value)} +2`;
  }

  return formatTime(value);
}

function renderHistory() {
  if (!solveList) {
    return;
  }

  solveList.innerHTML = '';

  if (!recentSolves.length) {
    const empty = document.createElement('li');
    empty.className = 'solve-empty';
    empty.textContent = 'Nun here bro 😭 Start a solve or smth.';
    solveList.appendChild(empty);
    return;
  }

  [...recentSolves].reverse().forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'solve-item';
    const timeText = formatHistoryValue(entry);
    const recordButton = document.createElement('button');
    recordButton.className = 'solve-record-button';
    recordButton.type = 'button';
    recordButton.dataset.solveId = String(entry.id);

    const indexLabel = document.createElement('span');
    indexLabel.className = 'index';
    indexLabel.textContent = String(recentSolves.length - index);

    const timeLabel = document.createElement('span');
    timeLabel.className = 'time';
    timeLabel.textContent = timeText;

    const tagLabel = document.createElement('span');
    tagLabel.className = 'tag';
    tagLabel.textContent = entry.result === 'dnf' ? 'DNF' : entry.tag;

    recordButton.append(indexLabel, timeLabel, tagLabel);
    item.appendChild(recordButton);
    solveList.appendChild(item);
  });
}

function showSolveDetails(solveId) {
  if (
    !solveDetails ||
    !solveDetailTime ||
    !solveDetailScramble
  ) {
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
    hideSolveActions();
  }

  saveHistory();
  renderStats();
  renderHistory();

  if (selectedSolveId === solveId) {
    if (action === 'delete') {
      solveDetails.close();
      selectedSolveId = null;
    } else {
      solveDetailTime.textContent = formatHistoryValue(entry);
    }
  }

  if (String(lastSolveId) === solveId && action === 'reset') {
    updateDisplay(formatTime(entry.baseTimeMs));
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

function syncManualTimeEntry() {
  if (!timerDisplay) {
    return;
  }

  const canEditTime = manualTimeEntryEnabled && state === 'ready';
  timerDisplay.readOnly = !canEditTime;
  timerDisplay.setAttribute('aria-label', canEditTime ? 'Enter solve time' : 'Timer display');
  timerPanel?.classList.toggle('manual-entry-active', canEditTime);
  if (manualTimeHelp) {
    manualTimeHelp.hidden = !canEditTime;
  }
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

function updateDisplay(value) {
  if (timerDisplay) {
    timerDisplay.value = value;
    timerDisplay.style.width = `${Math.max(3.2, value.length * 0.8 + 1.2)}ch`;
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

async function getNewScramble(eventCode) {
  const { setSearchDebug } = await import('https://esm.sh/cubing@0.59.1/search');
  setSearchDebug({ logPerf: false });
  const { randomScrambleForEvent } = await import(
    'https://esm.sh/cubing@0.59.1/scramble'
  );
  const validMove = /^(?:[URFDLB]w?|[2-6][URFDLB]w?|[urfdlb])(?:2|')?$/;
  const cubeEvent = ['222', '333', '444', '555', '666', '777'].includes(eventCode);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const generatedScramble = await randomScrambleForEvent(eventCode);
    const moves = generatedScramble.toString().trim().split(/\s+/);
    const isValid =
      moves.length > 0 &&
      (eventCode !== '333' || (moves.length >= 19 && moves.length <= 22)) &&
      (!cubeEvent || moves.every((move) => validMove.test(move)));

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

function generateScramble(eventCode = currentEvent) {
  const requestId = ++scrambleRequestId;
  scrambleReady = false;
  if (scrambleText) {
    const eventLabel = EVENTS.find((event) => event.code === eventCode).label;
    scrambleText.textContent = `Generating ${eventLabel} scramble…`;
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

      const remaining = Math.max(
        0,
        INSPECTION_GRACE_SECONDS * 1000 - (performance.now() - graceStartTimestamp),
      );
      updateDisplay(String(Math.ceil(remaining / 1000)));
      if (remaining > 0) {
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
    id: Date.now() + Math.random(),
    baseTimeMs: 0,
    timeMs: null,
    result: 'dnf',
    tag: EVENTS.find((event) => event.code === currentEvent).label,
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
  showSolveActions();
  generateScramble();
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
}

function hideSolveActions() {
  syncSolveActionAvailability();
}

function showSolveActions() {
  syncSolveActionAvailability();
}

function syncSolveActionAvailability() {
  if (solveActions) {
    solveActions.querySelectorAll('.result-action').forEach((button) => {
      const hasDraft = manualTimeDraftActive && Boolean(timerDisplay?.value.trim());
      if (manualTimeEntryEnabled) {
        if (button.dataset.action === 'dnf') {
          button.disabled = state !== 'ready';
        } else if (button.dataset.action === 'plus2') {
          button.disabled = state !== 'ready' || !hasDraft;
        } else {
          button.disabled = state !== 'ready' || !hasDraft;
        }
        return;
      }

      button.disabled = !lastSolveId;
    });
  }
}

function finishSolve() {
  cancelAnimation();
  const elapsed = performance.now() - solveStartTimestamp;
  const finalTime = Math.max(0, elapsed);
  recordSolve(finalTime);
  setTimerState('ready');
  updateDisplay(formatTime(finalTime));
  flashDisplay();
  showSolveActions();
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
}

function recordSolve(finalTime, result = 'ok') {
  const scrambleUsed = scramble.join(' ');
  const solveEntry = {
    id: Date.now() + Math.random(),
    baseTimeMs: finalTime,
    timeMs: result === 'dnf' ? null : result === '+2' ? finalTime + 2000 : finalTime,
    result,
    tag: EVENTS.find((event) => event.code === currentEvent).label,
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

function parseManualTime(value) {
  const enteredTime = value.trim().toLowerCase();
  if (enteredTime === 'dnf') {
    return { timeMs: 0, result: 'dnf' };
  }

  const match = enteredTime.match(/^(\d+(?:\.\d+)?)(\+2)?$/);
  if (!match) {
    return null;
  }

  const parsedTime = Number(match[1]);
  const seconds = match[1].includes('.') ? parsedTime : parsedTime / 100;
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
  showSolveActions();
  timerDisplay.removeAttribute('aria-invalid');
  timerDisplay.blur();
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

function resetSession() {
  cancelInspectionGracePeriod();
  cancelAnimation();
  isSpaceDown = false;
  justStopped = false;
  spaceStartedInspection = false;
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
  lastSolveId = null;
  hideSolveActions();
  setTimerState('ready');
  updateDisplay(manualTimeEntryEnabled ? '' : '0.00');
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
    return;
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

function isSpaceKey(event) {
  return event.code === 'Space' || event.key === ' ' || event.keyCode === 32;
}

window.addEventListener('keydown', (event) => {
  if (!isSpaceKey(event)) {
    if (event.key === 'Escape' && settingsMenu && !settingsMenu.hidden) {
      closeSettingsMenu(true);
    }
    return;
  }

  if (!timerPanel) {
    return;
  }

  const isReadOnlyTimerDisplay = event.target === timerDisplay && timerDisplay.readOnly;
  if (
    !isReadOnlyTimerDisplay &&
    event.target.closest('input, button, select, textarea, [contenteditable="true"]')
  ) {
    return;
  }

  if (manualTimeEntryEnabled && state !== 'solving') {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  if (event.repeat || isSpaceDown) {
    return;
  }

  isSpaceDown = true;
  spaceStartedInspection = false;

  if (state === 'solving') {
    finishSolve();
    justStopped = true;
    return;
  }

  if (state === 'inspecting') {
    if (holdToStartEnabled) {
      timerDisplay.classList.add('space-held');
    } else {
      beginSolve();
    }
    return;
  }

  if (state === 'ready' && inspectionEnabled) {
    spaceStartedInspection = true;
    if (holdToStartEnabled) {
      cancelAnimation();
      setTimerState('holding');
      updateDisplay('0.00');
      return;
    }

    beginInspection();
    return;
  }

  if ((state === 'ready' || state === 'readyToSolve') && holdToStartEnabled) {
    cancelAnimation();
    setTimerState('holding');
    updateDisplay('0.00');
    return;
  }

  handleTimerAction();
});

window.addEventListener('keyup', (event) => {
  if (!isSpaceKey(event) || !timerPanel) {
    return;
  }

  const startedInspection = spaceStartedInspection;
  spaceStartedInspection = false;
  isSpaceDown = false;
  if (justStopped) {
    justStopped = false;
    return;
  }

  if (manualTimeEntryEnabled && state !== 'solving') {
    timerDisplay.classList.remove('space-held');
    if (state === 'holding') {
      resetSession();
    }
    return;
  }

  if (
    holdToStartEnabled &&
    !startedInspection &&
    (state === 'inspecting' || state === 'readyToSolve')
  ) {
    timerDisplay.classList.remove('space-held');
    beginSolve();
    return;
  }

  if (state === 'inspecting') {
    timerDisplay.classList.remove('space-held');
    return;
  }

  if (state === 'holding') {
    if (startedInspection && inspectionEnabled) {
      beginInspection();
    } else {
      beginSolve();
    }
  }
});

window.addEventListener('blur', () => {
  if (state === 'holding') {
    resetSession();
  }
  isSpaceDown = false;
  justStopped = false;
  spaceStartedInspection = false;
});

if (newScrambleButton) {
  newScrambleButton.addEventListener('click', (event) => {
    event.stopPropagation();
    newScrambleButton.blur();
    generateScramble();
  });
}

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
    hideSolveActions();
    resetSession();
    restoreScramble(currentEvent);
    renderStats();
    renderHistory();
  });
}

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
    timerDisplay.style.width = `${Math.max(3.2, timerDisplay.value.length * 0.8 + 1.2)}ch`;
    timerDisplay.removeAttribute('aria-invalid');
    manualTimeDraftActive =
      manualTimeEntryEnabled && state === 'ready' && Boolean(timerDisplay.value.trim());
    syncSolveActionAvailability();
  });
}

if (clearHistoryButton) {
  clearHistoryButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const eventLabel = EVENTS.find((event) => event.code === currentEvent).label;
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
    hideSolveActions();
    saveHistory();
    renderStats();
    renderHistory();
    clearHistoryDialog.close();
    clearHistoryButton?.blur();
  });
}

if (solveList) {
  solveList.addEventListener('click', (event) => {
    const recordButton = event.target.closest('.solve-record-button');
    if (!recordButton) {
      return;
    }

    showSolveDetails(recordButton.dataset.solveId);
  });
}

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

document.querySelectorAll('.solve-actions .result-action').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const hasManualDraft =
      manualTimeEntryEnabled && state === 'ready' && Boolean(timerDisplay?.value.trim());

    if (action === 'dnf' && manualTimeEntryEnabled && state === 'ready') {
      recordManualTime('dnf');
      return;
    }
    if (action === 'plus2') {
      if (manualTimeEntryEnabled) {
        if (hasManualDraft) {
          recordManualTime('+2');
        }
        return;
      }

      if (!lastSolveId) {
        return;
      }

      applySolveAction(String(lastSolveId), action);
      return;
    }
    if ((action === 'reset' || action === 'delete') && manualTimeEntryEnabled) {
      if (hasManualDraft) {
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

document.querySelectorAll('.solve-detail-actions .result-action').forEach((button) => {
  button.addEventListener('click', () => {
    if (!selectedSolveId) {
      return;
    }

    applySolveAction(selectedSolveId, button.dataset.action);
  });
});

if (colorPaletteSelect) {
  colorPaletteSelect.addEventListener('change', () => {
    colorPalette = colorPaletteSelect.value;
    saveThemePreference();
    applyTheme();
  });
}

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

if (timerPanel) {
  let pointerActionHandled = false;

  const handleTimerPointerAction = (event) => {
    if (manualTimeEntryEnabled && state !== 'solving') {
      return;
    }

    const isReadOnlyTimerDisplay = event.target === timerDisplay && timerDisplay.readOnly;
    if (event.target.closest('button, input, label') && !isReadOnlyTimerDisplay) {
      return;
    }

    if (holdToStartEnabled && state !== 'solving') {
      return;
    }

    handleTimerAction();
  };

  timerPanel.addEventListener('pointerup', (event) => {
    if (event.button !== 0) {
      return;
    }

    pointerActionHandled = true;
    window.setTimeout(() => {
      pointerActionHandled = false;
    }, 800);
    handleTimerPointerAction(event);
  });

  timerPanel.addEventListener('click', (event) => {
    if (event.detail > 0 && pointerActionHandled) {
      return;
    }

    handleTimerPointerAction(event);
  });
}

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

applyTheme();
hideSolveActions();
renderStats();
renderHistory();

if (timerPanel) {
  resetSession();
  restoreScramble(currentEvent);
}
