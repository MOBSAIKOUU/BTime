const scrambleText = document.getElementById('scrambleText');
const timerDisplay = document.getElementById('timerDisplay');
const timerState = document.getElementById('timerState');
const timerPanel = document.getElementById('timerPanel');
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
import('https://cdn.cubing.net/v0/js/scramble-display')
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

    return ['light', 'night', 'shell-pink', 'purple', 'chessboard'].includes(parsed)
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

function applyTheme() {
  document.body.classList.toggle('dark-mode', colorPalette === 'night');
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

function updateDisplay(value) {
  if (timerDisplay) {
    timerDisplay.textContent = value;
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
  const { randomScrambleForEvent } = await import('https://cdn.cubing.net/v0/js/cubing/scramble');
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

async function waitForScramble() {
  while (!scrambleReady && scrambleRequestPromise) {
    const currentRequest = scrambleRequestPromise;
    const succeeded = await currentRequest;
    if (!succeeded && currentRequest === scrambleRequestPromise) {
      return false;
    }
  }

  return scrambleReady;
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

async function beginInspection() {
  const expectedState = state;
  if (!(await waitForScramble()) || state !== expectedState) {
    return;
  }

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

async function beginSolve() {
  cancelInspectionGracePeriod();
  const expectedState = state;
  if (!(await waitForScramble()) || state !== expectedState) {
    return;
  }

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
  if (solveActions) {
    solveActions.querySelectorAll('.result-action').forEach((button) => {
      button.disabled = true;
    });
  }
}

function showSolveActions() {
  if (solveActions) {
    solveActions.querySelectorAll('.result-action').forEach((button) => {
      button.disabled = false;
    });
  }
}

function finishSolve() {
  cancelAnimation();
  const elapsed = performance.now() - solveStartTimestamp;
  const finalTime = Math.max(0, elapsed);
  const scrambleUsed = scramble.join(' ');
  const solveEntry = {
    id: Date.now() + Math.random(),
    baseTimeMs: finalTime,
    timeMs: finalTime,
    result: 'ok',
    tag: EVENTS.find((event) => event.code === currentEvent).label,
    scramble: scrambleUsed,
  };

  recentSolves.push(solveEntry);
  lastSolveId = solveEntry.id;
  recentSolves = recentSolves.slice(-50);
  saveHistory();
  renderStats();
  renderHistory();
  setTimerState('ready');
  updateDisplay(formatTime(finalTime));
  flashDisplay();
  showSolveActions();
  generateScramble();
  solveStartTimestamp = null;
  inspectionStartTimestamp = null;
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
  updateDisplay('0.00');
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

  if (event.target.closest('input, button, select, textarea, [contenteditable="true"]')) {
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
  button.addEventListener('click', () => {
    if (!lastSolveId) {
      return;
    }

    const action = button.dataset.action;
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
    if (event.target.closest('button, input, label')) {
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
      updateDisplay('0.00');
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

applyTheme();
hideSolveActions();
renderStats();
renderHistory();

if (timerPanel) {
  resetSession();
  restoreScramble(currentEvent);
}
