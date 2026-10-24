import { getSolveValue } from './timeFormatter.js';

/**
 * Calculates standard WCA trimmed average for a window of solves.
 * Drops the fastest and slowest times. Allows at most one DNF (treated as slowest).
 * @param {Array<object>} solves
 * @param {number} solveCount
 * @returns {{ value: number|null, isDnf: boolean }}
 */
export function getTrimmedAverage(solves, solveCount) {
  if (solves.length < solveCount) {
    return { value: null, isDnf: false };
  }

  const windowSolves = solves.slice(-solveCount);
  const dnfCount = windowSolves.filter((s) => s.result === 'dnf').length;

  if (dnfCount > 1) {
    return { value: null, isDnf: true };
  }

  const times = windowSolves
    .filter((s) => s.result !== 'dnf')
    .map(getSolveValue)
    .filter((v) => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);

  const countedTimes = dnfCount === 1 ? times.slice(1) : times.slice(1, -1);

  return {
    value: countedTimes.reduce((sum, v) => sum + v, 0) / countedTimes.length,
    isDnf: false,
  };
}

/**
 * Computes all session metrics: Best Single, Best Ao5, Current Ao5, Current Ao12, and Mean.
 * @param {Array<object>} solves
 * @returns {object}
 */
export function computeSessionStats(solves) {
  const validTimes = solves
    .filter((s) => s.result !== 'dnf')
    .map(getSolveValue)
    .filter((v) => v !== null && Number.isFinite(v));

  const bestSingle = validTimes.length ? Math.min(...validTimes) : null;
  const mean = validTimes.length
    ? validTimes.reduce((sum, v) => sum + v, 0) / validTimes.length
    : null;

  const currentAvg5 = getTrimmedAverage(solves, 5);
  const currentAvg12 = getTrimmedAverage(solves, 12);

  let bestAvg5 = null;
  for (let end = 5; end <= solves.length; end += 1) {
    const windowAvg5 = getTrimmedAverage(solves.slice(end - 5, end), 5);
    if (!windowAvg5.isDnf && windowAvg5.value !== null) {
      bestAvg5 = bestAvg5 === null ? windowAvg5.value : Math.min(bestAvg5, windowAvg5.value);
    }
  }

  return {
    bestSingle,
    bestAvg5,
    avg5: currentAvg5,
    avg12: currentAvg12,
    mean,
  };
}

