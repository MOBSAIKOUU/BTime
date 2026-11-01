# Offline dependencies

The files in `assets/vendor/` are precompiled modules, not a new application build.

| Package | Version | Included notice |
| --- | --- | --- |
| cubing | 0.59.1 | cubing-LICENSE-MPL.md; cubing.js-ATTRIBUTION.md |
| scramble-display | 0.59.1 | scramble-display-LICENSE.md |
| comlink | 4.4.2 | comlink-LICENSE |
| three | 0.170.0 | three-LICENSE |
| random-uint-below | 3.3.0 | random-uint-below-LICENSE.md |

esm.sh's browser Node-compatibility shims are also included in the inventory.
The generator rewrites import/worker URLs and removes source-map directives.
Original module comments and embedded license notices remain in the files.
`assets/vendor/inventory.json` records every upstream module URL.
Keep upstream licenses and notices with redistributed files, including the drawing
library's existing GPL notice. The readable vendored module source is shipped with BTime.

`node scripts/vendor-offline.cjs` refreshes the dependency snapshot when deliberately
updating it; running or deploying BTime requires neither this command nor Node.
After refreshing, review licenses, update the three import paths in `app.js` from
`entries.json`, bump `CACHE_VERSION` in `sw.js`, and rerun the offline browser test.
