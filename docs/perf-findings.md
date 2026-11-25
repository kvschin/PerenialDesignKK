# Performance audit findings

A log kept by the weekly unattended performance audit. Each entry records the
area investigated, the fix made (if any) and ranked proposals. Measurements here
are WORK COUNTS from the Node sandbox, never frame times: the audit runs on a
cloud VM with no GPU (see CLAUDE.md, "A plausible wrong number is worse than
none"). Areas already recorded here are not re-investigated.

## 2026-10-14 — keyed multi-tile structure lookups (commands.js)

**Area.** `seatAt`, `firepitAt`, `waterFeatureAt`, `boulderAt`: the linear scans
§12b says want the `potIndex` treatment. Each walked its whole layer (tombstones
included), with a `split(',').map(Number)` per record per lookup. They sit under
every placement guard (`placePlantAt`, `canPlaceShrubAt`, every `canPlace*`
footprint loop, terrain guards, selection lookups), so a brush stroke or a
footprint check paid O(tiles × structures).

**Fix.** Branch `claude/perf-2026-10-14-footprint-index`, PR #3.
`footprintIndex(layer,sizeOf)` gives a tile -> record map:
- numeric keys, keyed on a new per-layer `LAYER_REV` (bumped in
  `markLayerCacheChanged`) plus map identity plus GW/GH;
- first-wins on overlap, like the old scan;
- falls back to the old scan when any record is off-plot or has a non-integer
  origin.

Counted: a whole-plot sweep of the four lookups (21×21, 9 structures) went from
**3,929 to 3** size-function calls. It is 0 on an unchanged garden and 0 after a
planting edit. The answers match the old scan tile by tile. No version bump.

**Decision recorded.** I added a per-layer revision rather than keying on
`sceneRev`, because a planting drag bumps `sceneRev` on every stamp (the
`potsRev` lesson). It is a module-level monotonic counter that is never reset;
map identity covers load, undo and new garden.

### Proposals (ranked by expected benefit)

1. **`structureSupportAt` (commands.js) — same scan, same fix.**
   - Why I suspect it: it is the fifth copy of the pattern. It is reached from
     `supportAt`, which `climberRenderDetail` (world.js) calls for every vine on
     every `buildScene`. It is also in 10 placement-guard call sites.
   - Proposed fix: route it through `footprintAt('supports', supportTileSize, …)`.
     Gain is small per garden, but zero risk with the new helper. Left out of
     this run to keep one finding per PR, and to stay clear of
     `claude/backlog-1-selection`, which edits supports in `commands.js`
     selection code. Do it after that branch lands.
   - How to measure: the same sandbox count as the new test (size calls). No
     browser tool is needed.
2. **Template-string keys in per-tile lookups** (`fenceAt`, `lightAt`, `petAt`,
   `pergolaAt`, `pergolaNeighbor`).
   - Why I suspect it: each call allocates a `${x},${y}` string, and
     `fenceNeighbor`/`pergolaNeighbor` are reached from the fence/pergola frame
     derivation and from sprite-key building (`computeStructSpriteSpec`).
   - Expected gain: GC churn only. `elevationGrid` already showed the key was
     ~85% of `screenOf`'s cost.
   - Risk: low, but it is near sprite-key code. Only change the lookup, never
     the key's contents.
   - How to measure: on the owner's machine, open the demo garden with the
     debug HUD and watch the `scene` event during a fence drag.
3. **Tombstone accumulation in the keyed structure layers.**
   - Why I suspect it: every `clearTile` leaves `{removed:true}`. The old scans
     paid for these on every lookup; the new index pays only on rebuild. The
     save blob still carries them until compaction.
   - What to check: whether `compactSoloMap` runs on every keyed layer at
     save/load, not just plants/bulbs. This is a save-size and parse-time
     question, not a frame-time one.

## 2026-10-21 — saving and storage (io.js, worlds list)

**Area.** The autosave path (`buildSaveBlob` → `saveSoloNow` → `updateWorldsIndex`),
`loadSolo`, and the worlds list (`openWorlds`, `adoptOrphanedWorlds`). This also
answers proposal 3 from 2026-10-14: `loadSolo` compacts every keyed layer, but
nothing compacted on SAVE.

**Fix.** Branch `claude/perf-2026-10-21-save-tombstones`, PR #9. `buildSaveBlob`
runs each keyed layer through `compactSoloMap`, the filter load already
applies. The live maps keep their tombstones and identity.

Counted on a 31×31 garden with 200 drift tiles and 200 bed tiles painted and
375 of them erased:
- blob records **400 → 50**;
- JSON **18,881 → 4,036 chars**;
- both blobs reload to byte-identical layers.

No version bump.

### Proposals (ranked by expected benefit)

1. **`openWorlds` (screens.js) reads every saved garden's FULL blob to draw the list.**
   - Why I suspect it: for each row it does `sGet('hortus:world:'+id)` just for
     the thumbnail, the plant count, the season and the portrait. That is a full
     IndexedDB read plus structured-clone deserialisation of the whole garden,
     including a ~1MB site photo (`underlay`) when there is one. The cost scales
     with every saved garden, not with the visible rows. All reads fire at once
     on opening the list, and opening it also awaits `pendingSaves`.
   - Proposed fix: store a small `listing` record per garden beside the blob. It
     would hold plant count, season, scheme count, the portrait and a tiny
     thumbnail data model, written by `saveSoloNow` inside the same
     `updateWorldsIndex` callback. The list would read only those records, with
     the current full read kept as a fallback for older gardens. Draw rows
     lazily with an IntersectionObserver, as the discovery thumbnails do.
   - How to measure: count `sGet` bytes in the sandbox. On your machine, use a
     phone profile with ~10 gardens, a few with site photos, and devtools →
     Performance on opening "Your gardens" (main-thread deserialisation time).
   - Expected gain: large on iOS, where photo gardens are common.
   - Risk: a new storage key. It must be deleted with its garden and copied by
     duplicate/import, and adopted orphans need one too. I did not do this
     unattended because `screens.js` is also edited by `claude/backlog-4-search-list`.
2. **Tombstones in the LIVE maps.**
   - Why I suspect it: `clearTile` never deletes, so every
     `for (k in game.plants)` scan (`buildScene`, `treeIndex`, `shrubIndex`,
     exports, `snapshotState`'s shallow copy on every pointerdown) walks
     erased tiles too, for the whole session.
   - Proposed fix: compacting in place would change map identity semantics and
     undo assumptions. A safer step is to compact when a garden is entered or
     undo is cleared, or to measure first.
   - How to measure: in the sandbox, count tombstone/live ratios after a
     scripted paint-erase session. On your machine, watch the `snap` and `scene`
     events in `?debug` on a long-edited garden.
   - Expected gain: modest. Risk: medium (undo, `sceneStale`).
3. **`structuredClone` of the whole blob on every autosave.**
   - Why I suspect it: after this week's fix the blob holds only live records,
     but `saveSoloNow` still clones the unchanged `underlay` data URL
     (~1MB string) every 750ms of editing quiet.
   - Proposed fix: strings are immutable, so the clone could skip the underlay
     and attach the same string after the clone. Check whether `structuredClone`
     copies large strings at all in V8/JSC before doing this; it may already
     share them.
   - How to measure: on your machine, use `?debug`'s `blob` event plus a
     Performance trace of one autosave in a photo-calibrated garden.
   - Expected gain: unknown until measured. Risk: low.
4. **`openWorlds` reads `hortus:worlds` three to four times**
   (`migrateLegacyWorld`, `adoptOrphanedWorlds`' chain read, `worldsIndex`).
   - Minor. Risk: low. Only worth doing alongside proposal 1.

## 2026-10-28 — the per-frame HUD and loop path (screens.js `frame`, ui.js `updateHUD`)

**Area.** What runs on every rendered frame outside `render()`: `shouldRenderGarden`
(`renderStateSig`, `hasTransientGardenWork`), `updateHUD` and its helpers
(`syncStartHere`, `hudText`, `updateDayNightBtn`, `updatePreviewToggle`,
`setHint`, `setActButton`), plus a look at the canvas `pointermove` handler.
Most of it is already change-guarded (`hudText`, the season fill,
`updateDayNightBtn`, the preview note, `syncStartHere`'s signature).

**Fix.** Branch `claude/perf-2026-10-28-hud-class-writes`.
- `setHint`, `setActButton` and `updatePreviewToggle` made six
  `classList.add/remove/toggle` calls a frame whose class was already in that
  state. Each is still a DOM attribute write (update steps plus a mutation
  record). A new `hudClass(el,cls,on)` writes only on a real change, as
  `hudText` does for text.
- The action-hint string was built every frame (template literals, label
  lookups) and then thrown away, because `ENABLE_ACTION_HINT` is false. The
  chain moved to `actionHintText()` and is called only while the hint is on.

Counted in the sandbox over 20 steady frames: class writes **120 → 0**, hint
builds **20 → 0**. The resulting classes match the old path for both preview
modes. Expected gain is small: unchanged-class writes cost no style
invalidation in Blink. It is worth having because it runs at the display's
refresh rate for the whole session. No version bump.

**Noticed, not mine.** Two `game.test.js` tests failed in 3 of 6 suite runs
on this VM, including one with master's `ui.js`. They run before any test this
branch adds, so the change cannot affect them. They did not fail in two clean
runs of master either, and the failing runs were the ones sharing the CPU with
another suite. The tests: "two clumps of one species never share a slot" and
"the slot index does not outlive the sprites it points at". Both call
`drawPlantMaybeCached` several times in one "frame". I suspect that on a slow
shared CPU the 4ms `PSPRITE.BAKE_MS` budget runs out, so the second clump gets
a sibling stand-in instead of its own bake. If so, the tests are measuring
wall-clock. They should probably bump `PSPRITE.frame` between draws, or pin
the budget, so they cannot depend on the machine's speed.

### Proposals (ranked by expected benefit)

1. **`tileAt` (world.js) probes every elevation level on a flat garden.**
   - Why I suspect it: every canvas `pointermove` goes through `evPlacement` →
     `tileAt`. That loops ELEV_MAX..ELEV_MIN (six non-zero levels), and each
     level does a `tileAtElevation` inversion plus an `elevationAt` read before
     the grade fallback. Most gardens have no elevation at all.
   - Proposed fix: `elevationGrid` already knows whether any tile is non-zero
     (it computes `elevationHasSunken`). A matching "has raised" flag, or the
     grid's min/max, would let `tileAt` loop only the levels present. A flat
     garden then skips straight to the grade inversion.
   - How to measure: in the sandbox, count `tileAtElevation` calls per
     `tileAt` (6 → 0 on a flat garden). Assert the answer is identical tile by
     tile over a screen-point grid at all four rotations, with and without
     terraces.
   - Expected gain: small per call, but it runs on every pointermove, i.e.
     120–1000Hz with a high-rate mouse. Risk: low (hit-testing only, nothing
     drawn). I left it for a later run to keep one finding per PR.
2. **`renderStateSig` (screens.js) builds a ~25-field string every frame.**
   - Why I suspect it: it builds an array plus a `join` per frame, and
     `layerVisibilitySig` does `Object.keys().sort().map().join()` each time.
     Tens of short-lived strings a frame, at refresh rate, even while idle at
     the 30fps cadence.
   - Proposed fix: memoise `layerVisibilitySig` on a `layerVis` revision, or
     compare the fields directly instead of joining them.
   - How to measure: count allocations is not possible in the sandbox. On your
     machine, use devtools → Memory → allocation sampling for 10s of idle and
     10s of pan on the demo garden, and look at `renderStateSig`'s share.
   - Expected gain: GC churn only. Risk: low, but a missed field means a
     garden that does not repaint. Keep the string as the fallback if unsure.
3. **`gardenHasPlanting` (ui.js) walks tombstones every frame.**
   - Why I suspect it: `syncStartHere` calls `startHereApplies` →
     `gardenHasPlanting` on every frame. A garden whose plants were all erased
     walks every `{removed:true}` record of `game.plants` and `game.bulbs`
     each frame before returning false. (2026-10-21 proposal 2 notes the live
     maps keep tombstones for the whole session.)
   - Proposed fix: cache the answer on `game.plantsRev` plus map identity.
   - How to measure: in the sandbox, count loop iterations per frame after a
     plant-500-then-erase-all script (500 → 0).
   - Expected gain: only in that edge case. Risk: low.

## 2026-11-04 — canvas pointer input and hit-testing, and the undo snapshot (input.js pointermove/pointerdown, `evPlacement`, `tileAt`, `snapshotState`)

**Area.** What one canvas pointer event costs once it reaches placement:
- the pointermove handler → `evPlacement` → `canvasClientPoint`/`tileAt`/`worldPointAt`;
- the per-pointerdown undo snapshot (`beginUndo` → `snapshotState`), plus `applySnapshot` on undo/redo.

**Fix.** Branch `claude/perf-2026-11-04-tileat-levels`, PR #20. This is proposal 1 from 2026-10-28.
- `elevationGrid()` records `lo`/`hi`, the range of levels actually present.
- `tileAt` probes only that range instead of all six non-zero levels.

Counted: `tileAtElevation` calls per 100 `tileAt` calls went **600 → 0** on a flat garden and **600 → 200** on a garden raised to level 2. The answers match the old loop at every one of ~27k screen points × 4 rotations, across six elevation configurations, tombstone-only included. It is mutation-checked. No version bump.

### Proposals (ranked by expected benefit)

1. **`canvasClientPoint` → `canvasViewportRect` calls `getBoundingClientRect` on every pointermove (view.js).**
   - Why I suspect it: during a drag, a rendered frame writes DOM in between pointer events (`updateCompass`'s `style.transform`, HUD text, toasts, the brush bar). The next pointermove then reads layout, so this can be a forced synchronous layout per event. That is the same write-then-read pattern `usableCanvasRect` was cached for (§15; 463us per dirty read was measured there). High-rate mice deliver several events a frame.
   - Proposed fix: cache the rect, invalidated by `settleViewportChange`/`applySheetState`/`setLeftHandedLayout` plus a ResizeObserver on the canvas, exactly as `usableCanvasRect` does. Also drop it on `scroll` if the body can ever scroll.
   - How to measure: Chrome devtools Performance on the demo garden, desktop profile. Record a 3s bed drag and a 3s plant drag, then look for "Layout (forced)" attributed to `canvasViewportRect`. In the sandbox you can count `getBoundingClientRect` calls per pointermove (1 → 0 at steady state).
   - Expected gain: a few hundred µs per event when layout is dirty, nothing when it is clean.
   - Risk: low to medium. A stale rect would offset every tap, so the invalidation list must be complete. Check iOS URL-bar collapse and rotation.
2. **`snapshotState` shallow-copies every keyed layer on every placement pointerdown (commands.js).**
   - Why I suspect it: it is O(all records, tombstones included) across ~16 layers, even when the gesture only touches one layer or is a no-op tap. CLAUDE.md measured it at 115µs on a 562-plant garden. It scales with garden size and long sessions, because tombstones accumulate in the live maps (2026-10-21 proposal 2).
   - Proposed fix: copy-on-write. The snapshot holds references, and `setTile`/`clearTile` materialise a layer's copy into the pending snapshot on its first write.
   - Why I did not do it unattended: `restoreLayerInPlace` writes terrain and elevation in place during undo, while the redo snapshot just taken may still share them. So the COW bookkeeping must cover that path too, and any future direct writer would silently corrupt undo.
   - How to measure: `?debug`'s `snap` event on a quarter-acre stress garden (`stressGarden()`) and on the demo garden. In the sandbox, count copied keys per pointerdown.
   - Expected gain: most of `snap` on large gardens. Risk: medium to high (undo correctness).
3. **`applySnapshot` stringifies `houses` and `buildings` 8 times per undo** (4 in `applySnapshot`, 4 more in `applySnapshotGround`).
   - Proposed fix: compute the two equality answers once and pass them in.
   - Expected gain: tiny (the arrays are small, but buildings carry vertex lists). Risk: low. Only worth doing if commands.js is being touched anyway; `claude/backlog-1-selection` also edits commands.js.
4. **`sceneBuildSteps` allocates per plant on every scene rebuild (renderer.js).**
   - Why I suspect it: it allocates via `shrubInfoFromKey` and `treeShadeInfo`, each doing `k.split(',').map(Number)` for every plant, even though the loop has already parsed `x,y`. A planting drag bumps `sceneRev` on every stamp, so this runs per stamp.
   - Proposed fix: pass the parsed coordinates in. It is pure JS, but it lives in renderer.js and the scene path, so the owner should review it rather than this routine.
   - How to measure: `?debug`'s `scene` event during a drift drag on the demo garden.
   - Expected gain: GC churn only. Risk: low.

## 2026-11-17 — whole-app audit on the owner's machine, in real browsers (0.9.123)

Unlike the entries above, this one was measured: headed Chrome 153 at 164Hz (RTX 3080 Ti, 1440x900 window), a throwaway profile, the service worker off, and the app's own loop driving the frames. The release and the working tree were served side by side and run alternately. Two gardens: the demo garden (323 plants, fitted) and `perfBench({gw:69})` at 100% zoom (1,482 plants, 2,101 scene records). Numbers are main-thread time unless they say fps.

**Method.** Three passes, in this order:
1. A soak for things that ACCUMULATE: six kinds of session cycled, with DOM nodes, listeners and the heap read after a forced GC each cycle.
2. Per-interaction cost from `Performance.getMetrics` (script, style, layout, task time per second), layout reads counted by wrapping `getBoundingClientRect` and `getComputedStyle`, and rAF pacing.
3. A sampling CPU profile per interaction (100us), self time by function and, for the hot ones, by line.

**Found nothing (worth knowing).**
- No leak. Nodes and listeners are flat across every scenario. The heap levels off after about ten garden round trips. The Library builds its 811 rows once (7,754 nodes, 871 listeners) and keeps them.
- 2026-11-04 proposal 1 (`canvasViewportRect` per pointermove) is closed: 7us a call, 2 layouts a second during a drag. No forced layout is behind it.

**Fixed.**

| What | Before | After |
| --- | --- | --- |
| Pointer moving over the canvas, Hand tool (quarter acre) | 689ms/s, 156 frames/s drawn | 117ms/s, 28 drawn |
| Pointer moving over the plant library (quarter acre) | 691ms/s | 159ms/s |
| Same two, demo garden | 306 and 365ms/s | 69 and 127ms/s |
| Script per frame, every frame drawing (quarter acre) | 3.47ms | 2.33ms |
| Same, demo garden | 0.98ms | 0.73ms |
| Same, demo garden with 14 trees (the shade wash) | 1.24ms | 0.86ms |
| Quarter acre with 70 trees, fitted, every frame drawing | 8.0ms, 37fps | 4.4ms, 45fps |
| The same garden in Firefox 157: pan / fast-forward / night pan | 124-130 / 89-91 / 123-125fps | 119-143 / 106-135 / 143-152fps |
| Layouts a second during fast-forward | 113 | under 1 |

1. **Input was taken for a change to the picture** (screens.js). Any pointer, wheel, key or touch event on the page restarted the 250ms grace, so the garden drew at the display's rate while a pointer moved over the library or a finger scrolled the sheet. Input is now only remembered, for `groundViewIdle`. A hover change (`hoverSig`) gets one frame and no grace. The site photo, its editor state and the cursor diamond joined `renderStateSig`, since they were repainted only by that grace.
2. **Answers recomputed every frame with the clock paused** (renderer.js, world.js): bloom level and its windows, leaf stage, Today-view growth. Kept until `gardenClockStamp()` moves.
3. **Per-record work the camera cannot change**: the draw point is baked with the scene (`setEntDrawPoint`); the cull boxes are packed into one `Float64Array`.
4. **The wind**: three context calls a sprite, not six (`plantBlitScale`).
5. **Key strings** rebuilt per record per frame: kept until a bucket moves.
6. **The tree-shade wash**: 0.83us a shaded tile a frame. The tiles are now kept by 4x4 block and culled to the screen; with few on screen it is still a fill a tile (from kept points and styles), with many each block is a kept `Path2D`. A whole-plot path, a per-frame batch, larger blocks, and paths always were each measured and are each worse somewhere: paths always is 1-2% behind the old loop in Firefox on a small plot (see `SHADE_WASH` in renderer.js).
7. **`gardenHasPlanting`** walked every plant each frame: `for...in` over a dictionary-mode object collects all keys before the first iteration. A witness now.
8. **The season bar** was animated by `width`, a layout per frame under fast-forward. A transform now.
9. **Two dev tools read the garden canvas back in a loop** (`perf-audit.cjs`, `plant-blit-bench.cjs`), which takes it off the GPU in Chrome after about a hundred reads. Both flush through a 1x1 scratch canvas now.
10. **`js/tray.js` held a raw NUL byte**, so grep and ripgrep treated it as binary.

Checked: 1,131 tests (13 new, each mutation-tested). Against the release under a software raster, where the release is bit-identical to itself, the entity changes differ on at most 122 of 789,000 pixels by 1/255, and the shade wash by at most 3/255 (mean 1) on shaded pixels. Firefox (`dev/ff-accel-check.cjs`, three canopy gardens) stayed on the GPU in every run of the working tree; the release was demoted once on the quarter acre with seventy trees.

### Proposals not taken (ranked by expected benefit)

1. **Release the garden's caches on leaving for the menu.** After a session the menu holds the garden's sprites, both ground canvases (6.4MB each at 1440x900, 16.5MB at 2114x1241) and its own border (17MB). Measured 23MB kept on the demo garden. It is well inside every limit, and releasing it makes reopening the same garden a cold open (300ms on a desktop, about 0.9s on a slow phone), which is what a trip to the Plant Library and back is. Worth doing only if a phone is ever seen short of canvas memory; the spare ground canvas alone could go at no cost.
2. **Skip the LRU re-insert for a sprite drawn last frame**, and keep the cache entry on the record. About 3% of the frame each. Both change what the sprite caches hold, and 35 tests clear `PSPRITE.map` directly, so a kept entry needs a validity check that gives most of it back.
3. **`renderStateSig` builds about 25 short strings every animation frame** (2026-10-28 proposal 2). Measured now: 1-3ms a second at 164Hz. Not worth the risk of a missed field.
4. **The idle garden still draws 28 frames a second for the wind**: 54ms/s on the demo garden, 116 on the quarter acre. With motion reduced nothing needs to move, so it could stop entirely there. Not measured on a phone.
5. **`snapshotState` copy-on-write** (2026-11-04 proposal 2) is unchanged: 0.2ms/s in a profile of a planting drag on the quarter acre, so it stays unranked.

## 2026-11-25 — large gardens, the first frames after opening, and canvas memory (0.9.171)

**Asked.** Three shared gardens (31x31, about 350 plants each, all in Today
view), larger gardens with more trees and shrubs, crashes on an iPad "after
planting and moving the time a bit", ninebark feeling slow, and plants that
"spin around" when a garden first loads and as they move into frame.

**Method.** Four designed test gardens (`node dev/make-test-gardens.cjs`: up to
131 trees, 485 shrubs and 4,000 perennials on a 140 ft plot). A scratch driver
on headed Chrome at an iPad-sized viewport (1180x820, device scale 2, so a
1215x1146 canvas) that wraps `makePlantSprite`, `plantStandInKey`, `drawPlant`
and `render` to count, per frame, bakes, stand-ins from the clump's own older
sprite, stand-ins borrowed from a SIBLING clump, and live draws, and records
rAF spacing. Baselines from `git archive HEAD` served beside the working tree.
An "iPad-like" arm slows the CPU four times through CDP. Pixels compared on a
software raster, where the release is identical to itself.

| What | 0.9.170 | 0.9.171 |
| --- | --- | --- |
| Clumps on screen with no sprite of their own at the reveal, 11/23 garden | 228 of 293 | 0 |
| Same, estate (4,707 on screen) | 3,471 | 0 |
| Sibling stand-in draws, panning the 11/23 garden at 110%, CPU slowed 4x | 1,782 over 54 frames | 0 |
| Whole estate on screen, any frame | 60.6ms, 16fps | 18.2ms, 54fps |
| Whole arboretum / shrub border on screen | 39 / 49fps | 107 / 122fps |
| Frame after a planted tile, estate | 54ms (scene rebuild 18-25ms) | 15ms (no rebuild) |
| Planting drag, estate | 15fps | 50fps |
| Ten ninebarks in a new garden, script a frame | 6.3ms, never cached | 0.2ms |
| Sprite canvases left to the collector in a game year of fast-forward (canvas path) | 5,144 (196MB) | 0: each is emptied a frame after it is retired |
| Held behind the menu after a session | sprite caches, ground canvases, washes | none of them |

1. **The opening pass skipped its own bakes** (renderer.js `prepareGardenOpen`).
   Its batch (12ms, 96 clumps, since 0.9.121) outran a frame's bake allowance
   (4ms), and a clump past the allowance was drawn as a sibling into the scratch
   canvas and left without a sprite. This is the "spinning" at load. `PSPRITE.cold`.
2. **A pan arrived at clumps that had never been baked.** They are now baked in
   a ring ahead of the camera with the frame's leftover allowance (`PREBAKE`).
3. **Every sprite was a separate image**, about 10us each in Chrome whatever its
   size. Small sprites are adopted into shared atlas pages (`ATLAS`). Not in
   Firefox, which batches bitmaps itself and is slower from a canvas page.
4. **Every plant edit rebuilt the scene list.** A perennial or bulb edit now
   changes one record (`sceneApplyEdits`); the tree and shrub indexes are left
   alone by an edit that touches neither.
5. **The governor's floor (12) kept a handful of heavy shrubs procedural.** 3.
6. **Canvases were dropped, not emptied** (WebKit keeps a dropped canvas's
   pixels until a collection): retired sprite canvases, the season-fade
   snapshot, the wash surfaces at each season turn, and everything the garden
   held when the menu opened. This also takes proposal 1 of 2026-11-17.
7. **A bake the browser refused threw inside `render`** (a null 2D context).
   It is a live draw and a trimmed cache now, and a line in the error log.

Checked: 1,334 tests (15 new). `?atlas=0` is byte-identical to 0.9.170 on a
software canvas; with the atlas 0.05-0.06% of pixels differ by 1/255. Firefox
157 stays accelerated on the 11/23 garden (4,034 frames) and the shrub border
(2,338). **Not checked: any of it on an iPad.** There is no WebKit on this
machine; item 6 and 7 are what the crash report most plausibly was, and the
crash itself was not reproduced.

### Proposals not taken (ranked by expected benefit)

1. **Fewer bakes while time is held forward in Today view.** A 2,035-plant
   garden bakes 540 sprites a second there and cannot keep up (39fps, with 600
   clumps a frame shown a bucket behind). A clump could keep its sprite while it
   is one growth bucket out, or draw the stale one scaled, and be baked exactly
   when the hold ends.
2. **A dense garden zoomed in on a hi-DPI tablet holds one screenful in the
   48MB budget** (the woodland at 110%: 271 sprites, 52MB), so every pan bakes
   what it reveals and a slow CPU falls behind into sibling stand-ins. A larger
   budget where memory allows, or a tighter sprite box for woody plants.
3. **The entity pass is 3us of script a record**: 16ms a frame with 4,700 on
   screen, which is what the estate is bound by now.
4. **A whole-plot planting kept as one layer when zoomed far out**, where wind
   moves a 15px plant by under a pixel.
