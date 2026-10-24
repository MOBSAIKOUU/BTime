import { setSearchDebug } from 'cubing/search';
import { randomScrambleForEvent } from 'cubing/scramble';
import { CUBE_EVENTS, VALID_MOVE_REGEX } from '../constants/events.js';

try {
  setSearchDebug({ logPerf: false });
} catch (e) {
  // Ignore in environments where search debug is already configured
}

const SCRAMBLE_PREFETCH_COUNT = 5;
const scrambleQueues = new Map();

/**
 * Generates a valid random-state scramble sequence for the given WCA event.
 * @param {string} eventCode
 * @returns {Promise<string>}
 */
export async function getNewScramble(eventCode) {
  const isCube = CUBE_EVENTS.has(eventCode);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const generatedScramble = await randomScrambleForEvent(eventCode);
    const moves = generatedScramble.toString().trim().split(/\s+/);
    const isValid =
      moves.length > 0 &&
      (eventCode !== '333' || (moves.length >= 19 && moves.length <= 22)) &&
      (!isCube || moves.every((move) => VALID_MOVE_REGEX.test(move)));

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
export function prefetchScrambles(eventCode) {
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
export async function getQueuedScramble(eventCode) {
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

