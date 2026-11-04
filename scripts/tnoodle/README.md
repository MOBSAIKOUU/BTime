# Offline TNoodle browser engine

BTime generates scrambles with **TNoodle-LIB 0.20.0**, compiled to JavaScript with
**TeaVM 0.16.0**. This is a custom browser build for practice, not the official
TNoodle-WCA competition application. All eleven BTime events use this engine,
including the random-state 4x4 implementation (not `FOUR_FAST`).

The Java sources are included in `src/main/java`. `upstream.json` records the
original Maven source archives, versions and SHA-256 checksums. The module is
GPL-3.0; upstream license texts are in `../../license/`. TeaVM's runtime is Apache-2.0
and SLF4J's no-op logging implementation is MIT licensed.

## Browser adaptations

- `Puzzle.getSecureRandom()` uses `new SecureRandom()`. TeaVM implements it using
  `crypto.getRandomValues`, replacing the JVM-only SUN/SHA1PRNG provider lookup.
  The app does not expose TNoodle's seeded-scramble API.
- Six solver logging fields use `NOPLogger` instead of JVM logger discovery.
- `AlgorithmBuilder` omits the per-move debug message.
- `btime.TNoodleBridge` creates puzzle instances lazily, exports generation and
  validation, and avoids reflection-based registry lookup. Puzzle algorithms and
  TNoodle's minimum-distance checks are unchanged.

## Rebuild

Requires JDK 21 or newer and Maven 3.9.x on the development machine only:

```sh
cd scripts/tnoodle
mvn -B -ntp process-classes
node publish.cjs
```

Maven downloads the pinned compiler dependencies on the first build. `publish.cjs`
writes a content-hashed engine file and updates the worker import, entry manifest
and offline inventory, including precomputed 4x4 tables. Bump `CACHE_VERSION` in `sw.js` before releasing changes.
The generated module is committed, so static hosting needs no Java or build step.
Keep older hashed assets available for already-open clients during releases.

## Runtime

`assets/js/tnoodle-client.mjs` manages up to two module workers and correlates
responses with requests. The active worker serves the selected puzzle; the background
worker warms one spare scramble per inactive event after the active queue fills to five.
Switching to an event promotes its warmed worker when possible. These scramble queues
are in memory for the current page session. `tnoodle-worker.mjs` calls TNoodle and verifies that its
output parses to a nonsolved puzzle state. The existing app queue prefetches
scrambles; calculations never run on the timer's main thread. Large puzzle tables,
especially 4x4, can take several seconds to initialize on first use. The build
precomputes 4x4 lookup tables with TNoodle's own `Tools.saveTo` method and bundles
3.4 MB of compressed data. The worker decompresses them with `DecompressionStream`
and loads them with `Tools.initFrom`, avoiding minutes of table construction in WebKit.

The service worker precaches the client, worker and compiled engine. After the
app reports **Offline ready**, a fresh offline reload can generate new scrambles
without a server. The Cubing.js-based drawing component is retained for diagrams.

## Checks

```sh
node --test tests/app.test.cjs tests/pwa.test.cjs tests/tnoodle-client.test.cjs
node scripts/serve.cjs
# In another terminal, with Playwright/WebKit installed:
node tests/tnoodle-browser.cjs
node tests/scramble-prefetch-browser.cjs
```

Set `BTIME_PLAYWRIGHT_PATH` if Playwright is installed outside this project.
For Chrome, also set `BTIME_BROWSER_ENGINE=chromium` and optionally
`BTIME_BROWSER_PATH` to its executable. The browser check reloads fully offline,
generates all eleven events, and checks that the main thread remains responsive.
