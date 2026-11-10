<p align="center">
  <img src="assets/Images/Logo/BtimeLogo-clean.png" alt="BTime logo" width="96" />
</p>

# BTime

**Your Cube Buddy.**

BTime is a browser-based speedcubing timer for everyday practice. Generate scrambles,
time solves, review your history, and track your averages on a desktop or phone.
It supports offline scramble generation and can be installed as a Progressive Web
App (PWA).

[Open BTime](https://www.btime.site/) | [GitHub repository](https://github.com/MOBSAIKOUU/BTime)

## Features

- Keyboard and touch timing, with optional inspection and hold delay.
- A hide-time setting that reveals the result when a solve finishes.
- Manual time entry, including compact digits, decimal seconds, and minute notation.
- Offline TNoodle scrambles for 11 puzzle events, with visual scramble drawings.
- Separate solve histories for each event, with saved scrambles and solve details.
- Best Single, Best Ao5, current Ao5/Ao12/Ao25/Ao50/Ao100, and Mean statistics.
- Copyable scramble and average breakdowns, plus +2, DNF, revert, and delete actions.
- Persistent browser storage and history pages of 50 solves, with no fixed solve-count cap.
- Customizable color palettes, including Fern and Milk Stick signature themes.
- Installable desktop/mobile app experience with offline support and controlled updates.

### Supported puzzles

2x2, 3x3, 4x4, 5x5, 6x6, 7x7, Clock, Megaminx, Pyraminx, Skewb, and Square-1.

## Run locally

The committed website needs no dependency installation or application build step.
With Node.js installed, clone the project and start the included static server:

```sh
git clone https://github.com/MOBSAIKOUU/BTime.git
cd BTime
node scripts/serve.cjs
```

Open **http://127.0.0.1:4173/** in your browser.

You can also open the repository folder in VS Code and use Live Server on
`index.html`. Serve the repository root so absolute module and asset paths resolve
correctly. Use localhost HTTP or HTTPS for service workers and module workers.

Java and Maven are only needed when rebuilding the TNoodle engine.

## Using the timer

1. Select a puzzle from the scramble panel. Use the refresh button for a new scramble.
2. Open the settings menu to choose inspection, hold delay, hidden timing, manual
   entry, or a color palette.
3. On desktop, press and hold **Space**, then release to start. On mobile, press and
   release the timer surface. If inspection is enabled, the first press starts
   inspection; the next press-and-release starts the solve.
4. Press a key or tap the timer while solving to stop and save the result.
5. Select a saved solve to inspect its time, scramble, drawing, and penalty actions.

The hold-delay setting requires a 300 ms press before release. With that setting
off, a 100 ms minimum press helps prevent accidental starts. Inspection counts down
from 15 seconds; the current implementation adds a one-second "Start now" grace
period before recording an inspection DNF.

### Keyboard controls

| Input | Action |
| --- | --- |
| Space | Start inspection, or hold and release to start a solve |
| Any key during a running solve | Stop and record the solve |
| Ctrl+1 | Revert the latest or selected solve's penalty |
| Ctrl+2 | Apply +2 to the latest or selected solve |
| Ctrl+3 | Mark the latest or selected solve as DNF |
| Alt+Z | Open confirmation to delete the latest or selected solve |
| Alt+D | Open confirmation to clear the current event's history |
| Enter in manual entry | Record the entered time |
| Escape in manual entry | Cancel the draft and leave the input |

Penalty and delete shortcuts use the selected solve while its details are open.
Otherwise, they use the last recorded solve in the current tab. Those shortcuts
leave editable inputs alone.

### Manual time entry

Enable **Settings > Timer > Manual time entry**, type a time, and press **Enter**.

| Input | Recorded time |
| --- | --- |
| `900` or `9.00` | 9.00 seconds |
| `1234` or `12.34` | 12.34 seconds |
| `12000`, `1:20`, or `1:20.00` | 1 minute, 20 seconds |
| `120.00` | 2 minutes |
| `12.34+2` | 12.34 seconds with a +2 penalty, totaling 14.34 |
| `dnf` | DNF |

For compact digit-only entries, the final two digits are hundredths, the preceding
two are seconds, and any remaining digits are minutes. Explicit minute notation
uses `minutes:seconds`, with optional decimal seconds.

## Statistics and solve details

| Statistic | Meaning |
| --- | --- |
| Best Single | Fastest non-DNF result for the selected event, including penalties |
| Best Ao5 | Best trimmed average across a consecutive five-solve window |
| Ao5 | Trimmed average of the latest five solves |
| Ao12 | Trimmed average of the latest twelve solves |
| Ao25 | Trimmed average of the latest 25 solves |
| Ao50 | Trimmed average of the latest 50 solves |
| Ao100 | Trimmed average of the latest 100 solves |
| Mean | Arithmetic mean of all non-DNF results for the selected event |

Averages discard the fastest and slowest 5% of their window, rounding up at each
end, then average the remaining results. Ao5/Ao12 discard one result from each end;
Ao25 discards two, Ao50 three, and Ao100 five. +2 penalties are included before
ranking. DNFs can be discarded among the worst results; any DNF remaining in the
counted results makes the average DNF. Metrics show
`--` when there are not enough results.

Click **Best Single** to open that solve's details. Click **Best Ao5** or any current
average capsule to open a copyable breakdown of its times and scrambles. Parentheses mark
the excluded results, and the copy button copies the complete breakdown.

## History and saved data

Solves are stored individually in **IndexedDB**. Preferences and saved current
scrambles use **localStorage**. Existing histories from the earlier localStorage
format migrate automatically, separately for each event.

There is no fixed number of saved solves. Browser storage quota and device space
are the practical limits. The interface displays 50 records per page, with
**Newer** and **Older** navigation below the list. Indexed statistics and bounded
rendering keep the full archive out of the visible list. Only the latest 100 solves
are loaded for current averages, alongside the selected history page.

History belongs to the current browser profile and site origin; automatic
cross-device synchronization is not implemented. Clearing browser site data also
removes saved solves. Service-worker updates preserve history and preferences.
If a history write fails, the app displays a retry action and keeps pending writes
in the current tab. Browsers without IndexedDB use a basic localStorage fallback.

## Color palettes

Choose a palette under **Settings > Looks**. Options include Default, Night,
Liquid Glass, Playground, Bella pink, Vanilla cream, Lavender, Chessboard,
Oil spill, Sunrise, Shibuya, Christmas, and Halloween.

The signature palettes are:

- **Fern** - Kyu's Signature, with charcoal and muted violet colors.
- **Milk Stick** - Trish's Signature, with royal blue, a navy timer, and cream panels.
- **Conan blue (New!)** - Shin's Signature, with charcoal/navy panels, blue-gray text, and brick-red buttons.

Palette selections are remembered between visits.

## Offline use and installation

1. Visit BTime online and wait for **Settings > BTime app > Offline ready**.
2. Use **Install BTime** or your browser's installation option when available.
   On iPhone/iPad, the app provides **Share > Add to Home Screen** instructions.
3. Reopen BTime offline to time solves and generate new scrambles.

Offline generation uses local workers and engine files, including precomputed 4x4
tables. The initial online setup must finish before offline use is available.
Scrambler initialization can take longer on the first use of an event. Optional
Google Fonts have system-font fallbacks.

New app versions wait for you to accept **Update available, tap to refresh**.
Update activation waits while the timer is busy or history writes are pending.
See [PWA.md](PWA.md) for the detailed offline, installation, and update workflow.

## Technology and project structure

BTime uses HTML, CSS, and JavaScript without a frontend framework. Its browser
features include Web Workers, IndexedDB, localStorage, service workers, and a web
app manifest. Scrambles use **TNoodle-LIB 0.20.0**, compiled to JavaScript with
**TeaVM 0.16.0**. Scramble drawings use the Cubing.js-based `scramble-display`
component. Runtime engine and drawing dependencies are bundled locally.

| Path | Purpose |
| --- | --- |
| `index.html` | Timer interface, settings, statistics, and dialogs |
| `assets/css/style.css` | Responsive layout and color palettes |
| `assets/js/app.js` | Timing, manual entry, statistics, and interface behavior |
| `assets/js/history-store.js` | IndexedDB history, paging, and indexed statistics |
| `assets/js/tnoodle-client.mjs` | Scramble worker management and requests |
| `assets/js/tnoodle-worker.mjs` | TNoodle generation, validation, and 4x4 table loading |
| `assets/js/pwa.js` | Installation, offline status, and update controls |
| `assets/vendor/` | Compiled engine, puzzle tables, drawing modules, and inventory |
| `assets/Images/` and `assets/icons/` | Branding, favicons, and installation icons |
| `sw.js` | App and vendor caching for offline use |
| `manifest.webmanifest` | Installed-app name, icons, display mode, and startup colors |
| `scripts/tnoodle/` | Source and build tools for the offline TNoodle engine |
| `scripts/serve.cjs` | Local static development server |
| `scripts/vendor-offline.cjs` | Optional dependency snapshot maintenance |
| `tests/` | Timing, statistics, storage, browser, and offline checks |
| `vercel.json` | Hosting headers and MIME/cache configuration |
| `robots.txt` and `sitemap.xml` | Crawler instructions and canonical page discovery |
| `license/` | Third-party license texts and attribution |

### Rebuilding TNoodle

The Java sources in `scripts/tnoodle/` are used to rebuild the browser engine.
The site runs from the committed files in `assets/vendor/`.

Rebuilding requires JDK 21 or newer and Maven 3.9.x:

```sh
cd scripts/tnoodle
mvn -B -ntp process-classes
node publish.cjs
```

The generated `target/` directory is disposable build output. Full build details,
source adaptations, and dependency versions are documented in
[scripts/tnoodle/README.md](scripts/tnoodle/README.md).

## Testing

Run the automated checks from the repository root:

```sh
node --test tests/app.test.cjs tests/pwa.test.cjs tests/tnoodle-client.test.cjs
```

Optional browser checks:

| Command | Coverage |
| --- | --- |
| `node tests/browser-pwa.cjs` | Chromium offline use, drawings, installation checks, and updates |
| `node tests/webkit-mobile.cjs` | WebKit touch controls, dialogs, and mobile layout |
| `node tests/stats-browser.cjs` | Interactive statistics and copyable breakdowns |
| `node tests/extended-stats-browser.cjs` | Ao25/Ao50/Ao100 windows, copy, edits, and responsive layout |
| `node tests/tnoodle-browser.cjs` | Fresh offline generation for all supported events |
| `node tests/history-browser.cjs` | History migration, edits, persistence, and large-archive performance |

`browser-pwa.cjs` starts its own server and uses an installed Chromium browser.
The other listed browser scripts expect the local server at port 4173 and a
separate Playwright installation. Set `BTIME_PLAYWRIGHT_PATH` when Playwright is
outside normal Node module resolution. Browser selection and executable paths can
be configured through `BTIME_BROWSER_ENGINE` and `BTIME_BROWSER_PATH` where the
script supports them. See [PWA.md](PWA.md) and the
[TNoodle guide](scripts/tnoodle/README.md) for details.

## Deployment and cache updates

Deploy the repository root as a static site over HTTPS. The project includes
Vercel configuration, and the canonical production address is
**https://www.btime.site/**. Application imports and the PWA currently expect root
hosting.

When releasing changes to HTML, CSS, JavaScript, the manifest, or cached assets:

1. Bump `CACHE_VERSION` in `sw.js` once for the release.
2. Deploy the complete site, including every required vendor inventory file.
3. Check the app online, then test an offline reload and the update prompt.

Documentation-only changes do not require an app-cache version bump. Existing
clients may still request older vendor filenames, so retain those assets during
releases that change dependency hashes.

## Author and licenses

Created by **Jherzy Jhay C. Dela Cruz** ([MOBSAIKOUU](https://github.com/MOBSAIKOUU)).

See [LICENSE.md](LICENSE.md) for the project's license text. Bundled dependencies
have separate upstream licenses and attribution in [license/](license/), including
[TNoodle's license](license/tnoodle-LICENSE.txt). Dependency notices and versions
are listed in [license/OFFLINE-DEPENDENCIES.md](license/OFFLINE-DEPENDENCIES.md) and
the [TNoodle build guide](scripts/tnoodle/README.md).
