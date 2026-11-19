# Application readiness

Reconciled November 18, 2026 against 0.9.133 (first reconciled September 7,
2026). These are the original application-readiness items, with their numbering
preserved for follow-up work. Store packaging, purchases, and submission have a
separate [launch proposal](app-store-launch-plan.md) and an operational
[launch checklist](launch-checklist.md); their numbering is different.
`CLAUDE.md` remains the authoritative implementation specification.

| Item | Status | What is done or remains |
| --- | --- | --- |
| 1. Autosave paused-clock edits | Implemented | Completed edits trigger a delayed save, independent of the clock. Unsaved state survives failed writes and retries. Two tabs on one garden no longer overwrite each other (0.9.125). Node tests cover failure/concurrency cases; browser checks verify real IndexedDB, reopening and two tabs. |
| 2. Garden-file validation | Implemented | Reject unsupported versions, malformed layers/records, invalid dimensions, and unreadable files before installing. Existing and legacy formats retain compatibility checks. |
| 3. Zones | Implemented | Catalog-derived choices (currently 1–11), an offline lookup of 40,502 published five-digit ZIPs, displayed half-zone results, and an official USDA-map link. Unsupported results are not silently clamped. A new garden's zone starts unset rather than guessed (0.9.118). See [source and behavior](zone-lookup.md). |
| 4. Local native status and suitability | Initial scope implemented | Continental filters identify their scope. Eight species have narrower range observations and six have site qualifications. Choosing a region or ecoregion and matching plants to it remains open. |
| 5. Regional invasive concerns | Removed by decision (0.9.117) | The filter, the cautions and the CSV column were taken out: they did not matter to designing a garden in this app. Plant descriptions still say in prose where a plant escapes or self-seeds. The code and the reviewed records are in git history; see [how it worked](plant-data/regional-guidance.md). |
| 6. Seasonal accuracy across climates | Open | Review evergreen, summer-dormant, and warm-climate exceptions to the shared growth model. The calendar and bloom renderer exist; local bloom timing and localized seasonal forecasting do not. |
| 7. Backup, recovery, and practical exports | Acceptance work remains | Save/import logic and browser persistence checks exist. Finish export → import → reopen with multiple schemes, site photos, and older saves; hand-check quantities and inspect PNG/CSV/print output on devices. |
| 8. Physical-device usability and performance | Open | Exercise the full workflow, gestures, large text/accessibility, rotation, and sustained dense-garden editing on supported phones/tablets. Browser viewport checks do not complete this item. The iPad pinch fix (0.9.39) has not been confirmed on an iPad, and sprite drawing has not been measured in WebKit. |
| 9. Repeatable browser release checks | Implemented | `npm run test:browser` covers separate-script loading, real IndexedDB, offline reopening, and waiting/accepted updates at root and project-subpath URLs. `test:tabs`, `test:skips` and `test:daily` cover two tabs on one garden, season skips and the daily challenge. Firefox's canvas acceleration has its own check (`dev/ff-accel-check.cjs`). A short device checklist accompanies them. |
| 10. Backlog and documentation cleanup | Reconciled | Reconciled again November 18, 2026: this file, the [October audit](improvement-audit-2026-10-07.md), the [regional roadmap](us-regional-plant-roadmap.md) and the launch checklist's status table. |

## Features that should not be rebuilt from old backlog entries

| Feature | Current implementation |
| --- | --- |
| Site/building placement | Draw/Edit footprint in the Site category (`js/tray.js`); `game.buildings` and footprint mutations in `js/world.js`. Legacy roofed houses still render and load, but their old House picker is not exposed. Reintroducing that picker would be a separate feature decision. |
| Matrix/scatter planting | `matrixSpacingBlocks`/`placePlantAt` (`js/commands.js`) and the Matrix brush controls. |
| Fill, Pick, and selection operations | `chooseFillMode`/`pickAt` and the selection action pill (`js/tray.js`); `doFloodFill` and move/copy/rotate/erase mutations (`js/commands.js`). Resizing a selection in place by its handles is built (0.9.71). |
| Raised beds and terraces | The Terrace tool sets a height and its wall in one gesture (0.9.66). Steps between levels were built and cut (0.8.1); see `CLAUDE.md` §12c. |
| Paused and established preview defaults | Garden creation and `enterGarden` (`js/screens.js`); preview controls in `js/ui.js`. |
| Duplicate garden | `duplicateWorld` (`js/screens.js`) uses the async storage/index pathways. It is not an unbuilt localStorage feature. |
| Mobile sheet and view controls | `setSheetState`/`applySheetState`, compact view menu, zoom/fit controls, and anchored selection actions (`js/tray.js`). The current layout supersedes the older Wave 4 proposal. |
| Gesture undo/redo | `finishMultiTouch` (`js/input.js`) dispatches two-finger undo and three-finger redo. Physical-device acceptance remains item 8. |
| Bloom calendar and exact plant replacement | `openBloomCalendar` (`js/io.js`); `startReplacePlant`/`applyPlantReplacement` (`js/tray.js`). Both were listed as future floaters after they were built. |
| Low and dwarf conifers | The `bun` and `mat` conifer habits (0.9.47): bird's nest spruce, globe blue spruce, mugo pine, creeping juniper and their cultivars. |
| Shrub leaf-out and leaf drop | `woodyLeafOut` (0.9.60), on the trees' timing and stages. |

## Deferred scope

Alaska has a three-plant starter batch; a nationwide gap audit is the next
regional step, and Hawaii is out of scope (decided November 17, 2026). Plant
photographs stay out of v1. Finer tree-canopy depth rendering and
growth-timeline controls remain optional follow-ups. Plant-health/watering
simulation and a dedicated Pencil tool are unscheduled ideas. Story mode,
avatar movement, and multiplayer remain outside the current product scope.

## Verification record

On November 18, 2026, at 0.9.133, the Node suite passed all 1161 tests.

On September 7, 2026, the Node suite passed 534 tests. The browser release suite
passed all 21 checks with Edge 152.0.4191.66 at desktop/root, phone/subpath, and
small-phone configurations. All 40,502 ZIP results also matched the four source
files, with their recorded hashes verified. The suite's JSON report records each individual run; see
[browser release checks](browser-release-checks.md) for commands and artifacts.
This is local verification. Physical-device acceptance and a deployed release
check remain outstanding.
