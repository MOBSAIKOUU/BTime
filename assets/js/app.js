const scrambleText = document.getElementById('scrambleText');
const timerDisplay = document.getElementById('timerDisplay');
const timerState = document.getElementById('timerState');
const timerPanel = document.getElementById('timerPanel');
const newScrambleButton = document.getElementById('newScramble');
const clearHistoryButton = document.getElementById('clearHistory');
const eventSelect = document.getElementById('eventSelect');
const inspectionToggle = document.getElementById('inspectionToggle');
const themeToggle = document.getElementById('themeToggle');
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
const avg12El = document.getElementById('avg12');
const recentTimeEl = document.getElementById('recentTime');

const STORAGE_KEY = 'bcube-timer-history';
const EVENT_STORAGE_KEY = 'bcube-timer-event';
const INSPECTION_STORAGE_KEY = 'bcube-timer-inspection';
const THEME_STORAGE_KEY = 'bcube-timer-theme';
const HOLD_TO_START_STORAGE_KEY = 'bcube-timer-hold-to-start';
const INSPECTION_SECONDS = 15;
const INSPECTION_GRACE_SECONDS = 1;
const EVENTS = [
  { code: '333', label: '3x3' },
  { code: '222', label: '2x2' },
  { code: '444', label: '4x4' },
  { code: '555', label: '5x5' },
  { code: '666', label: '6x6' },
  { code: '777', label: '7x7' },
];

let state = 'ready';
let currentEvent = loadEventPreference();
let inspectionEnabled = loadInspectionPreference();
let darkModeEnabled = loadThemePreference();
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
let recentSolves = loadHistory(currentEvent);
let lastSolveId = null;
let selectedSolveId = null;

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
    return saved !== null ? JSON.parse(saved) : false;
  } catch (error) {
    return false;
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
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(darkModeEnabled));
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
  document.body.classList.toggle('dark-mode', darkModeEnabled);

  if (themeToggle) {
    themeToggle.checked = !darkModeEnabled;
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

function getAverage(values) {
  if (!values || !values.length) return null;
  if (values.length >= 5) {
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function renderStats() {
  if (!bestTimeEl || !avg5El || !avg12El || !recentTimeEl) {
    return;
  }

  const values = recentSolves
    .filter((solve) => solve.result !== 'dnf')
    .map((solve) => getSolveValue(solve))
    .filter((value) => value !== null && !Number.isNaN(value));

  const best = values.length ? Math.min(...values) : null;
  const avg5 = values.length >= 5 ? getAverage(values.slice(-5)) : null;
  const avg12 = values.length >= 12 ? getAverage(values.slice(-12)) : null;
  const recent = values.length ? values[values.length - 1] : null;

  bestTimeEl.textContent = formatMetric(best);
  avg5El.textContent = formatMetric(avg5);
  avg12El.textContent = formatMetric(avg12);
  recentTimeEl.textContent = formatMetric(recent);
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
    empty.textContent = 'No solves yet';
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
  const generatedScramble = await randomScrambleForEvent(eventCode);
  const moves = generatedScramble.toString().trim().split(/\s+/);
  const validMove = /^(?:[URFDLB]w?|[2-6][URFDLB]w?|[urfdlb])(?:2|')?$/;

  if (
    !moves.length ||
    (eventCode === '333' && (moves.length < 19 || moves.length > 22)) ||
    moves.some((move) => !validMove.test(move))
  ) {
    throw new Error(`The ${eventCode} scrambler returned an invalid sequence: ${generatedScramble.toString()}`);
  }

  return moves.join(' ');
}

function generateScramble(eventCode = currentEvent) {
  const requestId = ++scrambleRequestId;
  scrambleReady = false;
  if (scrambleText) {
    const eventLabel = EVENTS.find((event) => event.code === eventCode).label;
    scrambleText.textContent = `Generating ${eventLabel} scramble…`;
  }

  scrambleRequestPromise = getNewScramble(eventCode)
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
    const display = `${(remaining / 1000).toFixed(1)}`;
    updateDisplay(display);

    if (remaining > 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    timerDisplay.classList.remove('space-held');
    setTimerState('readyToSolve');
    timerState.textContent = 'Start now';
    const graceStartTimestamp = performance.now();
    updateDisplay(`${INSPECTION_GRACE_SECONDS.toFixed(1)}`);
    flashDisplay();

    const updateGraceDisplay = () => {
      if (state !== 'readyToSolve') {
        return;
      }

      const remaining = Math.max(
        0,
        INSPECTION_GRACE_SECONDS * 1000 - (performance.now() - graceStartTimestamp),
      );
      updateDisplay((remaining / 1000).toFixed(1));
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
    beginSolve();
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
    clearHistoryButton.blur();
    recentSolves = [];
    lastSolveId = null;
    hideSolveActions();
    saveHistory();
    renderStats();
    renderHistory();
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

    applySolveAction(String(lastSolveId), button.dataset.action);
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

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    darkModeEnabled = !themeToggle.checked;
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
