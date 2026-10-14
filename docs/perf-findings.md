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
