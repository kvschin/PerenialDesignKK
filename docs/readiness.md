# Application readiness

Reconciled September 7, 2026 against the local implementation. These are the
original application-readiness items, with their numbering preserved for
follow-up work. Store packaging, purchases, and submission have a separate
[launch proposal](app-store-launch-plan.md); its numbering is different.
`CLAUDE.md` remains the authoritative implementation specification.

| Item | Status | What is done or remains |
| --- | --- | --- |
| 1. Autosave paused-clock edits | Implemented | Completed edits trigger a delayed save, independent of the clock. Unsaved state survives failed writes and retries. Node tests cover failure/concurrency cases; browser checks verify real IndexedDB and reopening. |
| 2. Garden-file validation | Implemented | Reject unsupported versions, malformed layers/records, invalid dimensions, and unreadable files before installing. Existing and legacy formats retain compatibility checks. |
| 3. Zones | Implemented | Catalog-derived choices (currently 2–11), an offline lookup of 40,502 published five-digit ZIPs, displayed half-zone results, and an official USDA-map link. Unsupported results are not silently clamped. See [source and behavior](zone-lookup.md). |
| 4. Local native status and suitability | Initial scope implemented | Continental filters identify their scope. Seven species have narrower range observations and six have site qualifications. Local garden matching and broader reviewed coverage remain open. |
| 5. Regional invasive concerns | Initial scope implemented | Nine species have sourced, dated regional cautions. Plants without a recorded caution show no invasive-risk statement; exports leave that field empty. More regional and cultivar review remains open. See [coverage](plant-data/regional-guidance.md). |
| 6. Seasonal accuracy across climates | Open | Review evergreen, summer-dormant, and warm-climate exceptions to the shared growth model. The calendar and bloom renderer exist; localized seasonal forecasting does not. |
| 7. Backup, recovery, and practical exports | Acceptance work remains | Save/import logic and browser persistence checks exist. Finish export → import → reopen with multiple schemes, site photos, and older saves; hand-check quantities and inspect PNG/CSV/print output on devices. |
| 8. Physical-device usability and performance | Open | Exercise the full workflow, gestures, large text/accessibility, rotation, and sustained dense-garden editing on supported phones/tablets. Browser viewport checks do not complete this item. |
| 9. Repeatable browser release checks | Implemented | `npm run test:browser` covers separate-script loading, real IndexedDB, offline reopening, and waiting/accepted updates at root and project-subpath URLs. A short device checklist accompanies it. |
| 10. Backlog and documentation cleanup | Reconciled | Current menu, controls, implemented features, and remaining work are aligned across README, agent guide, specification, and direction record. Historical proposals remain labeled as proposals. |

## Features that should not be rebuilt from old backlog entries

| Feature | Current implementation |
| --- | --- |
| Site/building placement | Draw/Edit footprint in the Site category (`js/tray.js`); `game.buildings` and footprint mutations in `js/world.js`. Legacy roofed houses still render and load, but their old House picker is not exposed. Reintroducing that picker would be a separate feature decision. |
| Matrix/scatter planting | `matrixSpacingBlocks`/`placePlantAt` (`js/commands.js`) and the Matrix brush controls. |
| Fill, Pick, and selection operations | `chooseFillMode`/`pickAt` and the selection action pill (`js/tray.js`); `doFloodFill` and move/copy/rotate/erase mutations (`js/commands.js`). Selection resizing remains open. |
| Paused and established preview defaults | Garden creation and `enterGarden` (`js/screens.js`); preview controls in `js/ui.js`. |
| Duplicate garden | `duplicateWorld` (`js/screens.js`) uses the async storage/index pathways. It is not an unbuilt localStorage feature. |
| Mobile sheet and view controls | `setSheetState`/`applySheetState`, compact view menu, zoom/fit controls, and anchored selection actions (`js/tray.js`). The current layout supersedes the older Wave 4 proposal. |
| Gesture undo/redo | `finishMultiTouch` (`js/input.js`) dispatches two-finger undo and three-finger redo. Physical-device acceptance remains item 8. |
| Bloom calendar and exact plant replacement | `openBloomCalendar` (`js/io.js`); `startReplacePlant`/`applyPlantReplacement` (`js/tray.js`). Both were listed as future floaters after they were built. |

## Deferred scope

Catalog expansion, including Alaska/Hawaii and low/dwarf conifers, can be
scheduled independently of readiness unless those regions are launch targets.
Plant photographs, selection resizing, finer tree-canopy depth rendering, and
growth-timeline controls remain optional follow-ups. Plant-health/watering
simulation and a dedicated Pencil tool are unscheduled ideas. Story mode,
avatar movement, and multiplayer remain outside the current product scope.

## Verification record

On September 7, 2026, the Node suite passed 534 tests. The browser release suite
passed all 21 checks with Edge 152.0.4191.66 at desktop/root, phone/subpath, and
small-phone configurations. All 40,502 ZIP results also matched the four source
files, with their recorded hashes verified. The suite's JSON report records each individual run; see
[browser release checks](browser-release-checks.md) for commands and artifacts.
This is local verification. Physical-device acceptance and a deployed release
check remain outstanding.
