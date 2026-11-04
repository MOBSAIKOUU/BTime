// TNoodle-LIB 0.20.0, compiled with TeaVM. See scripts/tnoodle/README.md.
import { generateScramble, isValidScramble, loadFourByFourTables } from '/assets/vendor/8d3399e01ff941cfa06d.mjs';

let tablesReady = false;
let queue = Promise.resolve();

async function prepareFourByFour() {
  if (tablesReady) return;
  const response = await fetch('/assets/vendor/3b70acdf152807e89d1c.bin');
  if (!response.ok || !response.body) throw new Error('Unable to load TNoodle 4x4 tables.');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  loadFourByFourTables(new Uint8Array(await new Response(stream).arrayBuffer()));
  tablesReady = true;
}

self.addEventListener('message', ({ data }) => {
  if (!Number.isSafeInteger(data?.id) || typeof data.eventCode !== 'string') return;
  const { id, eventCode } = data;
  // Serialize asynchronous table loading as well as synchronous generation.
  queue = queue.then(async () => {
    try {
      if (eventCode === '444') await prepareFourByFour();
      const scramble = generateScramble(eventCode).trim().replace(/\s+/g, ' ');
      if (!scramble || !isValidScramble(eventCode, scramble)) {
        throw new Error('TNoodle generated an invalid scramble.');
      }
      self.postMessage({ id, scramble });
    } catch (error) {
      self.postMessage({ id, error: error?.message || String(error) });
    }
  });
});
