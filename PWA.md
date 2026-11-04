# BTime PWA: implementation and testing

All complete source files are included in the project. No build command or dependency
installation is required: deploy the project root as static files over HTTPS.

## Files

- `manifest.webmanifest`: BTime identity, `/` start URL and scope, standalone display,
  default theme/background `#f3f4f6`, and ordinary/maskable icons.
- `sw.js`: versioned shell/static caches, network-first HTML with a four-second timeout,
  cache-first static assets, atomic installation, and old-cache cleanup on activation.
- `assets/js/pwa.js`: install prompt, iOS instructions, offline readiness, waiting-worker
  notice, and explicit update acceptance. It observes the existing timer state and
  never reloads a running solve or inspection.
- `assets/js/app.js`: loads the offline TNoodle worker client and maintains scramble queues.
- `assets/js/tnoodle-client.mjs` and `tnoodle-worker.mjs`: worker lifecycle and TNoodle generation.
- `index.html`: root manifest link, menu controls, update notice, and PWA script.
- `assets/css/style.css`: small theme-aware install/update styles and menu scrolling.
- `assets/icons/`: 192 and 512 PNGs plus a separate opaque, safe-zone maskable 512 PNG,
  resized from `assets/Images/Logo/BtimeLogo-clean.png`.
- `assets/vendor/`: local precompiled drawing modules and the content-hashed TNoodle engine.
  Workers, dynamic puzzle modules, solver code, and embedded WASM are included.
- `scripts/vendor-offline.cjs`: optional maintenance downloader; not a build step.
- `vercel.json`: MIME/cache headers and existing security headers. The live Vercel
  domain configuration manages the canonical-domain redirect.
- `tests/pwa.test.cjs`: manifest, dependency closure, caching, and activation checks.
- `tests/browser-pwa.cjs`: optional headless Chromium offline integration check.
- `tests/app.test.cjs`: existing timing tests updated to stub local library imports.
- `license/`: upstream attribution and redistribution notices for bundled modules.

## TNoodle engine

Scrambles use TNoodle-LIB 0.20.0 compiled to JavaScript and executed in a dedicated
worker. All eleven events work after an offline reload. Source, browser adaptations,
licenses and rebuild instructions are in [scripts/tnoodle/README.md](scripts/tnoodle/README.md).
The drawing component still uses Cubing.js; it does not generate the app scrambles.

## Offline behavior

Visit once online and wait for **Settings → BTime app → Offline ready**. Installation
only completes after every required shell and library file is cached. No automatic
page refresh is needed on the first visit. A failed dependency download prevents
installation; an existing working worker remains active.

The application generates new scrambles offline, rather than relying on a small
queue of previously saved scrambles. All 11 supported events use local workers and
modules, and the drawing component also loads locally. Google fonts are optional:
they are cached when encountered by the worker, with existing system-font fallbacks
when unavailable. Analytics is not cached and may fail harmlessly offline.

HTML uses the network first and falls back to the installed `/index.html` offline.
Static files use the cache first. API/payment endpoints and arbitrary cross-origin
requests are not cached. Saved solves and preferences remain in localStorage;
service-worker updates do not clear them.

## Hosting

1. Serve over HTTPS, or localhost for development. Opening `index.html` through
   `file://` does not support service workers or module workers.
2. Serve the files at the domain root: `/sw.js`, `/manifest.webmanifest`, `/assets/...`.
   Subdirectory hosting needs matching manifest, import, cache, and registration paths.
3. MIME types: `.js` and `.mjs` → `application/javascript`; `.webmanifest` →
   `application/manifest+json`; `.png` → `image/png`; `.wasm` → `application/wasm`
   if a future vendor snapshot adds separate WASM files. Do not rewrite missing
   asset/module requests to HTML, especially with `X-Content-Type-Options: nosniff`.
4. `/sw.js` must use `Cache-Control: no-cache, max-age=0, must-revalidate`;
   registration also sets `updateViaCache: 'none'`. Do not give the manifest a long
   immutable cache lifetime. Keep unversioned HTML/CSS/application JS revalidatable.
5. Production currently redirects `btime.site` → `www.btime.site` in Vercel's domain
   configuration. Keep that existing origin and the matching canonical URL. Adding
   an opposite application redirect would create a loop. To switch deliberately to
   non-www, first change the Vercel primary-domain redirect, then set a permanent
   `www.btime.site` → `btime.site` redirect and update the canonical URL. Configure
   DNS/TLS for both domains and preserve users' existing www history before switching.
6. On another host, reproduce `vercel.json`'s headers and redirect in that host's
   configuration. No CORS configuration is needed for the local library modules.
7. If tightening CSP later, preserve same-origin module workers, their blob fallback,
   WebAssembly compilation, optional Google fonts, and Vercel analytics as appropriate.
   The existing conservative policy is retained.

## Releasing updates

1. Change `CACHE_VERSION` in `sw.js` whenever changing shell/static/vendor files.
2. Deploy the complete project together, including the vendor inventory and all files
   referenced by it. Missing files make the new worker's installation fail safely.
3. Returning users see **Update available, tap to refresh** when a worker is waiting.
   Tapping activates it and reloads that tab. The action is disabled during inspection,
   holding, and solving. There is no forced timer interruption or automatic reload.
4. Other tabs are not forcibly reloaded. Finish active solves in those tabs before
   accepting an update. For deployments that change vendor hashes, retain old vendor
   files until old tabs have closed; an old tab can request a lazy module later.
5. Cache-first assets intentionally remain at the installed version until activation.
   Forgetting the version bump can leave stale CSS/JavaScript. Network-first HTML can
   also reference a newer shell; avoid incompatible HTML/JS changes across releases
   without an update test.

## Testing checklist

### DevTools and installation

- Serve locally or deploy a preview over HTTPS. Use a clean profile; avoid clearing
  a real user's localStorage, which would delete their solves.
- Application → Manifest: name BTime, start URL `/`, standalone display, no errors,
  correct 192/512 icon previews. Inspect the maskable icon's safe zone.
- Application → Service Workers: `/sw.js` scope `/`, activated and controlling the page.
- Cache Storage: shell contains HTML, CSS, both application scripts, logo/icons,
  entries/inventory JSON, and every module in the inventory.
- Settings shows **Offline ready** after the initial online install completes.
- In a Chromium browser, use **Install BTime** when the browser fires
  `beforeinstallprompt`. Browser heuristics can delay the event; it is not guaranteed
  on first load. Confirm standalone launch, icon, and saved settings.
- On iPhone/iPad, use Safari's Share → Add to Home Screen. Confirm the hint is shown
  and the installed app launches. Other iOS browser installation UI can differ.

### Offline

- After Offline ready, set Network → Offline, close the tab, and reopen normally.
  Also test airplane mode on a real installed phone.
- Use a normal reload: hard/Shift reload and DevTools **Bypass for network** deliberately
  bypass service workers and are not valid offline-cache tests.
- Generate several new scrambles for 3×3, 2×2, 4×4, 5×5, 6×6, 7×7, Clock,
  Megaminx, Pyraminx, Skewb, and Square-1; verify every drawing.
- Record solves, inspect saved scramble details/drawings, copy a scramble, and test
  penalties, statistics, themes, manual entry, inspection, and touch start/stop.
- Reload offline again and confirm history/preferences persist. Optional web fonts
  and analytics may be unavailable; timing and drawings must still function.

### Update

- With the current worker active, bump `CACHE_VERSION`, make a visible change, and
  redeploy. DevTools → Service Workers → Update can trigger the check.
- Confirm the new worker waits; the running page is not refreshed automatically.
- Start inspection/a solve and confirm the update button is disabled. Stop, accept
  the update, and verify one reload, the new styles/code, retained history, and old
  BTime caches removed. Unrelated caches must remain.
- Test a deliberately missing precache file in a disposable preview: the new worker
  should fail installation while the previous app remains usable.

### Lighthouse and automated checks

- Run Lighthouse in a clean Chromium profile for Performance, Accessibility, and Best
  Practices. Lighthouse versions differ; recent releases may not include the old PWA
  category. Use Application → Manifest/Service Workers and real install/offline tests
  rather than treating a Lighthouse score alone as proof of installability.
- Run `node --test tests/app.test.cjs tests/pwa.test.cjs` from the project root.
- Optional real-browser check: `node tests/browser-pwa.cjs`. It uses installed Windows
  Chrome by default; set `BTIME_BROWSER_PATH` to another Chromium executable if needed.
  It starts a temporary local server and disposable browser profile, installs the
  worker, stops serving files, reloads through the worker, then generates fresh
  scrambles for all 11 events with local modules/workers, checks actual rendered SVGs,
  and verifies waiting-update acceptance, the timer guard, reload, and cache cleanup.

Verified in headless Chrome during implementation: 23 automated checks passed;
offline reload and fresh generation for all 11 events passed; 12 SVG drawings rendered
(the main drawing plus 11 probes); update/refresh and old-cache cleanup passed.
Real-device installation still needs the manual checks above.
Additional predeployment verification completed: Chromium reports no manifest or
installability errors; 1920×1080, 390×844, 320×568, and 844×390 layouts have no clipped
primary controls or document scrolling. Screenshots were inspected. The iOS install
hint passed under simulated iPhone identification; this is not a physical-device test.
Local Lighthouse scores: Performance 99, Accessibility 100, Best Practices 96, SEO 100.
The Best Practices deduction is the expected local 404 for the Vercel Analytics
endpoint, which must be checked on production. Physical iOS/Android installation
and home-screen launch still require real devices.

## Limits and feature risks

- Offline requires one successful online installation; it cannot work on a first-ever
  offline visit. Browser storage eviction or clearing site data can remove caches.
- Browser/OS install support varies, especially on iOS and in private browsing.
- The initial download grows by about 2.6 MB before compression. First initialization
  of complex scramblers still consumes CPU; caching does not remove solver setup time.
- The worker/manifest assumes root hosting. Incorrect MIME types, rewrites, partial
  uploads, CSP changes, and missing vendor files can break scrambles/drawings.
- Canonical redirects change origin: localStorage/caches/installed apps from the `www`
  origin do not automatically migrate. Export or otherwise preserve any existing
  `www` history before switching domains.
- Future premium theme entitlements and payment verification must remain server-backed;
  never treat an offline CSS cache or localStorage flag as proof of purchase.
- Bundled third-party source has upstream licenses. Keep the included notices and
  source when redistributing. See `license/OFFLINE-DEPENDENCIES.md`.
