/**
 * Formats duration in milliseconds to mm:ss.xx or ss.xx string.
 * @param {number} ms
 * @returns {string}
 */
export function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
  }
  return `${seconds.toFixed(2)}`;
}

/**
 * Formats statistical metric or returns '--'.
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatMetric(value) {
  return value === null || value === undefined || Number.isNaN(value) ? '--' : formatTime(value);
}

/**
 * Computes numeric solve time taking penalties into account.
 * @param {object} entry
 * @returns {number|null}
 */
export function getSolveValue(entry) {
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
 * Formats time string for history listing.
 * @param {object} entry
 * @returns {string}
 */
export function formatHistoryValue(entry) {
  if (!entry || entry.result === 'dnf') {
    return 'DNF';
  }

  const value = getSolveValue(entry);
  if (value === null) {
    return 'DNF';
  }

  return entry.result === '+2' ? `${formatTime(value)} +2` : formatTime(value);
}

