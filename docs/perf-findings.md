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
