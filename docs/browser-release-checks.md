# Browser release checks

Run these before a web release, after the ordinary syntax and logic checks:

```sh
npm run check
npm test
npm run test:browser
```

`tests/browser-release.cjs` uses a real headless Chromium browser through an
existing Playwright installation. It does not install packages, download a
browser, change app files, or use the user's browser profile. The application
still has no npm dependencies or build step.

## Runtime and results

Use Node 18 or newer and an already installed `playwright` or `playwright-core`
package. The runner also recognizes the bundled Codex workspace runtime on this
machine. It prefers a local Edge/Chrome/Chromium installation; otherwise it uses
Playwright's already installed Chromium. Missing prerequisites fail with a
nonzero exit code rather than skipping the checks.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `PLAYWRIGHT_MODULE_PATH` | Absolute path to an existing Playwright package directory. |
| `PP_BROWSER_PATH` | Absolute path to the Chromium/Chrome/Edge executable. |
| `PP_BROWSER_RESULTS` | Directory for the JSON report and failure artifacts. Defaults to a new directory in the OS temporary folder. |

The final console line gives the results directory. `results.json` records the
app version, browser version, timestamps, and each check's result and duration.
A failure also retains a screenshot and page/request diagnostics. Keep that
report with the release candidate; a green run describes those tested bytes,
not subsequent edits or the live deployment.

## Automated coverage

The same sequence runs at 1280×900 from `/` and at 390×844 and 320×568 with touch
enabled from `/PerenialDesignKK/`, matching the deployed subpath. Each uses a fresh
browser context and a read-only loopback HTTP server on a free port.

1. Load `index.html` with its actual separate script tags, verify startup,
   font loading, worker scope, first installation, and absence of a spurious
   update offer.
2. Exercise published ZIP results, unsupported/unlisted ZIPs, manual recovery,
   reachable zone buttons after toggling help, and the official-map link.
3. Create a named garden through the questionnaire, make a deterministic edit
   through `withUndo`/`setTile`, and wait for the real paused-clock autosave.
   Read the record directly from IndexedDB so a localStorage fallback cannot
   make the check pass. Close the tab and reopen the saved garden through
   **Your gardens** in a new tab.
4. Stop the HTTP server, open privacy/terms/credits from their own cache entries,
   then open the app and garden in a new tab. An uncached request must fail
   while cached scripts, fonts, the ZIP lookup, and the saved planting remain available.
5. Restart the server with a new build. Confirm the worker waits, both caches
   exist, and the running HTML and scripts remain on the old build. Dismiss
   the offer and confirm no takeover occurs.
6. Relaunch to re-offer the update, edit the garden, and accept **Reload**.
   Verify the latest planting survives, the new HTML and scripts agree, the
   old cache is retired, and the updated installation also reopens offline.
7. Fail on uncaught page errors, HTTP error responses, or automatic third-party
   requests.

The update pair uses the current source with two build labels: a synthetic
`<version>-release-check-before` and the actual current version. Only served
HTML and the two version constants differ; registration, caching, storage,
timers, and update UI run unchanged. This checks the update mechanism. It does
not claim compatibility with every historical release, browser engine, or
native wrapper. Node tests cover legacy save shapes separately.

## Short device checklist

Use disposable test gardens and retain one exported backup. Record app
version/commit, device, OS, browser or installed-app mode, date, and result.
Repeat on the smallest supported phone and a tablet, including Safari/iOS;
Chromium viewport emulation does not establish physical-device behavior.

- [ ] Create → plant → change season → close/reopen → export without coaching.
- [ ] Place with one finger; pan/pinch with two; confirm no accidental plants.
  Exercise selection move/cancel, undo/redo, tray scroll, keyboard, and rotation.
- [ ] Background and relaunch after a paused-clock edit. Reopen in airplane
  mode and check fonts, saved plants, and the Library.
- [ ] Update an actual prior installation: dismiss once, then accept after an
  edit. Confirm saved gardens/schemes and preferences survive; reopen offline.
- [ ] Open a downloaded backup and usable PNG/CSV/print output on the device.
  Include a garden with alternative schemes and a site-photo reference.
- [ ] Check large text, light/dark mode, safe areas, reduced motion, and
  screen-reader navigation of controls. Note canvas accessibility limitations.
- [ ] Use a dense garden for sustained editing; record heat, sluggishness,
  crashes, or lost work rather than inferring performance from desktop tests.

Leave unchecked items open. Physical-device acceptance remains separate from
the automated browser result.
