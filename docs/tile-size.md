# Variable tile size — a planning note

*Written Sept 2026, against v0.8.49. The question was: now that units are a
setting, should the tile size be one too — 12 inches instead of 18 — and should
the two ship together?*

**Verdict: no, and definitely not together.** They look like the same feature
and share almost nothing. Units is a presentation change with no consequence for
stored data; tile size retroactively changes what every saved garden *means*,
decouples the two drawing axes, and costs quadratically. If it is ever done, the
driver will be metric-native tiling, not 12-versus-18 inches — and the thing
most people actually want from it is cheaper to get another way.

---

## 1. Why this is not the units change

Units worked out to be a formatter pass because the model was already right: the
inches-truth / px-art split means `space` and `spread` are real inches, `TILE_IN`
is a constant, and every derivation from them — tiles, footprints, spacing,
order quantities — is untouched by what the caption says. A test asserts that
invariance directly.

Tile size is the opposite. `TILE_IN` is not a label; it is the conversion between
the model's real units and its grid, and it appears in **47 geometry sites**. It
is also the one number that is *not* in the save file.

---

## 2. Hazard: it changes what every saved garden means

`buildSaveBlob` stores `gw` / `gh` — tile **counts** — and no tile size. The real
dimensions of every garden ever saved are implied by the global constant.

Change it and a 31×31 garden silently stops being 46 ft square and becomes 31 ft
square. Bed areas, plant order quantities, the plan's scale bar and the planting
list all change under a design somebody already finished and possibly already
bought plants from. That is not a rendering difference; it is the document
lying.

So the minimum correct shape is:

- `tileIn` in the blob, `SAVE_VERSION` 2 → 3, absent meaning 18;
- **per-garden and immutable after creation.** Re-tiling an existing garden means
  resampling every keyed layer (plants, bulbs, terrain, elevation, fences,
  lights, firepits, boulders, pets, pots, seats) plus the building polygons and
  the plot shape, both of which live on the tile-*corner* lattice. There is no
  correct answer for what happens to a 1-tile-wide path when the tile halves;
- the plot screen gains a choice that cannot be undone, which is a poor thing to
  put in front of somebody eleven decisions into a questionnaire.

---

## 3. Hazard: the two drawing axes are calibrated independently

Ground distance and drawn height are separate scales in this projection —
`CLAUDE.md` §11d says so explicitly — and `TILE_IN` moves only one of them.
Measured in the running app:

| | px per real inch |
| --- | --- |
| Ground — `hypot(TILE_W/2, TILE_H/2) / TILE_IN` | **2.36** |
| Height — `HERB_SCALE`, with `PX_PER_FT = HERB_SCALE × 12` pinned by a test | **1.75** |

Ratio today: **1.349**. Set `TILE_IN = 12` on its own and it becomes **2.023** —
the ground plane zooms 1.5× while every plant, fence, retaining wall and terrace
riser keeps its pixel height. A 6 ft fence is 126 px standing on a tile that now
means one foot.

Keeping the ratio honest means scaling the tile with it: `TILE_W` 76 → **50.67**,
`TILE_H` 38 → 25.33. Both fractional, in a ground bake that already bleeds 0.6 px
past every tile edge specifically to stop hairlines opening between antialiased
fills. Note also that `inchesToTiles`-based art (pots, seating, brick bond)
*would* follow correctly and `PX_PER_FT`-based art (fences, walls) would not, so
a partial change is worse than either extreme: the containers would rescale and
the fence beside them would not.

---

## 4. Hazard: cost is quadratic — measured, not assumed

One real 104 ft quarter-acre plot expressed at three tile sizes. `perfBench`
builds in normalized plot coords, so `gw` is exactly "how many tiles this area
becomes", and the three runs are the same garden. Desktop Chrome, 910×664
canvas, furnished, `rounds:15`, `edit:true`. Read the **median** — the mean is
dragged by a first-round outlier.

| tile | tiles | terrain tiles | plants | ground bake (med / min) | region trace (med) |
| --- | --- | --- | --- | --- | --- |
| 24 in | 2,704 | 1,271 | 834 | 38.8 / 35.9 ms | 3.0 ms |
| **18 in — today** | **4,761** | **2,235** | **1,482** | **60.1 / 56.1 ms** | **4.9 ms** |
| 12 in | 10,816 | 5,083 | 3,326 | 330.8 / 105.8 ms | 10.9 ms |

2.27× the tiles takes the ground bake from 60 ms to 331 ms median. The best case
(105.8 ms) is roughly the linear 2× you would predict; everything above it is
memory pressure and cache behaviour, which is the part that does not show up in
an op count.

Three things scale with that and are easy to forget:

- **The trace is inside the bake.** `buildTerrainRegions` runs within
  `paintGround`, so those two columns are not independent.
- **`snapshotState` clones every keyed layer on every pointerdown.** More tiles
  means more records means a fatter snapshot, 30 deep in the undo stack.
- **A finer grid means more plant records for the same planting.** The model is
  one plant per tile, so the bench's 1,482 → 3,326 is real, not an artifact.
  At ~53 bytes a planted tile that is 79 KB → 176 KB, and with six planting
  schemes ~1.06 MB against a 2.4 MB `SAVE_BUDGET_CHARS`. Survivable, not roomy.

And that is the quarter acre. The plot field allows **200 ft**, which at 12 in is
**40,000 tiles** — 3.7× the 12-inch quarter acre above, and 2.3× the largest
plot the app can make today (133 × 133 = 17,689).

---

## 5. The tail: constants written in tiles or assuming 18 inches

None of these are wrong today; all of them would need re-deriving, and each is a
place where a wrong answer looks like an unrelated rendering bug.

| constant | where | today's meaning |
| --- | --- | --- |
| `FENCE_POST_TILES = 4` | draw.js | 4 × 18 in = 6 ft on centre |
| — | draw.js | a vertical member divides "the same 9 inches of half-tile" |
| — | draw.js | one gate tile is an 18-inch opening |
| `LAID_OVER_BLEED = 0.45` | renderer.js | tiles, tuned against what DP then cuts back |
| `TERRAIN_SIMPLIFY_EPS = 0.9` | renderer.js | tile space |
| `TERRAIN_FILLET.path = 1.0` | core.js | the paving-corner clamp, 1 tile = 1.5 ft; at 12 in the same number means 1.0 ft |
| `BRUSH_SIZES = [1,2,3,5,7]` | world.js | a size-7 disc is 10.5 ft today, 7 ft at 12 in |
| `GRAIN_INSET`, the ~21 µs/tile grain budget | world.js | per tile, and there would be 2.27× as many |
| `ELEV_STEP / PX_PER_FT` | core.js | 5.14 in per level — height, so it does *not* follow |

---

## 6. What would actually trigger this

Not 12-versus-18. **Metric-native tiling.** With units shipped, a metric
gardener's plan sheet now reads `1 tile = 46 × 46 cm`, which is honest and ugly.
A 50 cm tile (19.7 in) or a 30 cm tile would make every derived figure land on a
round number in the reader's own units, and *that* is a reason a user would
notice and care about.

Which means: **units had to ship first regardless**, and the signal to watch for
is metric users complaining about the plan sheet — not anybody asking for a
finer grid.

Note that 50 cm is only 9% larger than today's 18 in, so it is also the cheapest
possible version of this change: `TILE_W` 76 → 83, a quarter acre going 69 → 63
tiles a side (**17% fewer tiles**, so it is faster, not slower), and none of the
§5 constants meaningfully disturbed. It is the one variant that is a tuning
change rather than a re-architecture — though it still needs §2, because it
still changes what a saved `gw`/`gh` means.

---

## 7. Cheaper answers to what people actually want

**"I want finer planting detail."** The real limit is matrix spacing, which is
`round(space/TILE_IN)` tiles. Measured against the shipped catalog's 38 distinct
authored spacings:

| tile | distinct matrix radii | spacings collapsing to 1 tile |
| --- | --- | --- |
| 24 in | 16 | everything ≤ 36 in |
| **18 in — today** | **19** | 3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 24 in |
| 12 in | 24 | 6 … 18 in |
| 9 in | 26 | — |

So twelve of thirty-eight authored spacings currently mean the same thing to the
matrix brush. That is a genuine loss of fidelity, and 12-inch tiles do improve it
— from 19 distinct radii to 24. But it is a **spacing-resolution** problem, and
sub-tile placement is a far cheaper place to fix it: `game.freePlanting` already
stores a sub-tile offset, though today it is art only. Giving that offset real
positional meaning inside `matrixSpacingBlocks` costs one layer's worth of
thought, not a save migration and a 2.3× frame budget.

**"My garden is small and I want to see more detail."** That is zoom, and it
already works.

**"The numbers should be round."** That is §6, and it wants 50 cm, not 12 in.

---

## 8. If it is ever built, in this order

1. `tileIn` in the blob, `SAVE_VERSION` 3, absent → 18. Ship this alone and let
   it bake; every reader has to tolerate the field before any writer sets it.
2. Make `TILE_IN` a per-garden `let` fed from the blob, and audit all 47 geometry
   sites for load-time capture — several read it at module scope.
3. Derive `TILE_W`/`TILE_H` from it so the ground:height ratio stays at 1.349,
   and re-verify the ground bake for hairlines at a fractional tile.
4. Re-derive the §5 constants in real units, not tiles.
5. Re-run `perfBench` at the new size and set a plot-size ceiling from it.
6. Only then a UI, on the plot screen, immutable after creation, and probably
   only offered below some plot area.

## 9. How to re-measure any of this

```bash
node tests/run.js
```

Then, in a garden, from the console:

```
perfBench({gw:69, gh:69, rounds:15, edit:true})
```

`gw` is the tile count for a fixed real area, so compare 52 / 69 / 104 for
24 / 18 / 12-inch tiles on a 104 ft plot. Read the median. The tab must be
visible — `perfBench` warns on `document.hidden` because canvas timings in a
backgrounded tab are worthless.

The axis-ratio check is:

```js
Math.hypot(TILE_W/2, TILE_H/2) / TILE_IN / HERB_SCALE   // 1.349 today
```
