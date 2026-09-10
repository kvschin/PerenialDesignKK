# The design plan sheet

How `openPlan` / `buildPlanMap` (§14b, `js/io.js`) compares with how a planting
plan is actually drawn, what was wrong with it, and what is left.

Written after a legibility review of a real 326-tile garden whose sheet drew
**86 labelled blobs** — an average drift of 3.8 tiles — and read, in the
gardener's words, "sorta messy". Every figure below marked *measured* comes off
that garden's own rendered sheet.

## What a planting plan is

Two independent bodies of practice converge here and the app should satisfy
both.

**The naturalistic-planting tradition (Oudolf).** Plants are drawn as
amoeboid drifts, hand-coloured, with the name or an abbreviation written inside
the drift. The legibility of those sheets does not come from the drift shapes —
it comes from a **layer hierarchy**. Oudolf and Kingsbury describe a designed
plant community as four layers: a **structural** layer, a **seasonal theme**
layer, a **groundcover matrix**, and a **dynamic filler** layer, at roughly
70% matrix to 30% primary. The metaphor in *Planting: A New Perspective* is a
fruitcake — the matrix is the cake and the conspicuous plants are the fruit.
On paper the cake has to recede or the fruit cannot be seen.

**The landscape-architecture tradition.** A plan is a measurable document: a
title block, a north arrow, a stated scale plus a graphic scale bar, existing
elements distinguished from proposed, plant tags keyed to a **schedule** giving
botanical name, common name, quantity, pot size and spacing **o.c.**
("on center"). Groundcover is hatched or stippled; trees are circles with a
trunk mark; the drawing distinguishes but the schedule identifies.

**Bulbs are a separate sheet.** Oudolf's bulb design is an *overlay* of the
perennial design — two independent designs on the same ground. This is not a
stylistic choice: bulbs occupy tiles that perennials also occupy, and one
drawing cannot show both honestly.

## What we already had right

Worth stating, because most of the bones are good and shouldn't be disturbed:
the north arrow rotates within a fixed plan; the scale bar reads `TILE_IN` so
it cannot drift from the drawing it measures; tree canopy circles are honest to
the `effectiveEstab` preview lens; terrain is traced through the same
`terrainLoopPath` the garden renderer uses, so the sheet matches the screen;
the smoothed drift blobs genuinely read as hand-drawn; the plot boundary is
the deeded line.

## What was wrong

1. **The drift was the wrong unit.** `planComponents` floods 8-connected
   same-species-and-cultivar tiles. A hand-drawn drift is one gesture; a
   component is whatever the brush left connected. The Matrix brush — the app's
   signature gesture, and correct naturalistic practice — lays a
   *checkerboard*, which 8-connects into dozens of one-tile components. On the
   review garden, **32 of the 86 components were a single tile** (measured) —
   Butterfly Weed's 23 tiles drew as a dozen separate labelled pills. That is
   not a dozen drifts; it is one intergrown population, and the drawing was
   lying about it.

2. **Every component was labelled and the label carried no weight.** Font size
   was `max(8, min(13, 5+√tiles*2))` — five pixels of range across the whole
   sheet, which is not a hierarchy but a uniform texture. Plus 86 white halos
   at `lineWidth:3`, itself a large share of the noise. (Note what this was
   *not*: measured, only **one pair of labels actually overlapped** — the sheet
   read as crowded rather than collided. That ranking held only until 0.8.84
   drew the sheet to a real scale and took the same garden to eleven
   overlapping pairs; see the placed-labels section.)

3. **The codes were undecodable.** `planCodes` appended `o.v.slice(0,2)` — the
   first two letters of the internal **key slug** — so `'theblues'` rendered as
   `SC'TH`. And a lone genus collapsed to two letters, making *Nassella*
   `NA`, indistinguishable from "N/A" on a drawing.

4. **No layer hierarchy.** A 53-tile grass matrix, a 1-tile climber, a shrub
   and a specimen all got the same 66%-paper fill, coloured outline and coded
   label. On the review garden the grasses and sedges were 141 of 326 tiles —
   **nearly half the noise on the sheet was the layer that should be
   quietest.**

5. **No quantity, spacing or botanical name.** The legend gave `(53)` — a count
   of *game tiles*, not plants — truncated the name at 26 characters (cutting
   off the cultivar, the exact thing you would order), and carried no Latin
   name at all.

## What changed (0.8.80)

### One label per stand

`planStands` (io.js) groups components of one species/cultivar that sit within
`PLAN_STAND_GAP` (2) tiles of each other, transitively, into a **stand**. The
blobs still draw separately — the shapes were never the problem — but the
stand is labelled **once**.

The grouping is a union-find over components, joined by probing each tile's
`(2·GAP+1)²` neighbourhood in a tile→component map. That is exact for
Chebyshev distance and O(tiles × 25); the naive pairwise form is O(tiles²) and
would matter on a stress garden. `buildPlanMap` runs once on open, never in a
frame, so none of this is on the render path.

The label sits on the stand tile **closest to the centroid**, not on the
centroid itself: a scattered or L-shaped stand has a centroid outside its own
planting, and a label floating on bare ground reads as a different drift.

Line two is `×N`, the plant count from `plantsForTiles(standTiles, space)` —
the number an installer reads. It is dropped when it would say `×1`, where the
code alone is the whole story.

> **Known rounding property.** Per-stand quantities `ceil` independently, so
> they can sum slightly above the schedule's own figure, which rounds once over
> the whole garden. That is normal on a real plan — you round up per drift when
> ordering — and both numbers come from the same `plantsForTiles`, so neither
> is inventing arithmetic. The schedule agrees with the planting list exactly.

**`PLAN_STAND_GAP=2` is measured, not chosen.** Sweeping it over the review
garden's 86 components:

| gap | stands | single-tile stands | biggest stand |
| --- | --- | --- | --- |
| 1 | 86 | 32 | 22 |
| **2** | **53** | **5** | **22** |
| 3 | 50 | 5 | 22 |
| 4 | 47 | 5 | **42** |
| 5 | 42 | 4 | 42 |

Gap 1 reaches nothing — a matrix scatter sits *two* tiles apart, so 1 merges
none of it. Gap 2 takes single-tile labels from 32 to 5, which is the whole
problem. Gap 3 buys three labels. **Gap 4 fuses two genuinely separate
plantings into one 42-tile stand**, whose single label would then sit between
them on ground carrying neither — the over-merge failure, and the reason not to
reach for a bigger number when the sheet still looks busy.

Trees are deliberately **excluded** from stand merging and keep a label per
component over the trunk: a tree is a specimen placed individually, not a
population.

### Three drawing weights

`planLayerOf(s)` returns `matrix` | `drift` | `structure`, and
`PLAN_LAYER_STYLE` gives each its fill, stroke and label ink. Matrix paints
first (underneath), then drifts, then structure.

| Layer | Treatment | Why |
| --- | --- | --- |
| `matrix` | lightest band, a whisper of a stroke (0.8px), soft label ink | the cake — it has to recede |
| `drift` | middle band, 1.3px stroke, dark label | unchanged; this was already right |
| `structure` | darkest band, 1.9px stroke, dark label | the fruit — it has to advance |

> These were **paper-mix fractions** (0.80 / 0.66 / 0.60) until 0.8.85, when a
> fraction turned out to leave 114 species drawing on the paper. They are
> lightness *targets* now — see the plan-colour section — which is what makes
> the bands a real ladder rather than an advisory one.

**It asks the role table rather than restating a type chain.**
`staticPlantRoles` (ui.js) already tags every grass and sedge `matrix` and
every woody `structure` — that is most of the Oudolf taxonomy already sitting
in the data model, previously unread by the plan. A species classified there is
classified here, so the two cannot drift apart.

The matrix stroke is a whisper rather than nothing so that two *different*
grasses meeting along an edge still separate. Dropping it entirely was tried
and merges adjacent matrix species into one shape.

`groundcover` is deliberately **not** folded into `matrix`. It would demote
hosta and fern drifts, which read as feature plants, and that is a taste call
the data does not make. It is the obvious tuning knob if the matrix layer ever
wants to be broader.

Shrubs and trees already draw through `drawShrubPlan` / `drawTreePlan` with
their own heavier treatment, so `structure` in the drift pass only catches the
handful of *herbaceous* species the role table calls structural — bamboo,
clipped forms.

### A plant schedule instead of a legend

The three-column `CODE — Common name (tiles)` legend is now a five-column
table: **swatch + code · botanical name · common name · qty · spacing o.c.**,
which is the convention both traditions agree on.

- Botanical name resolves the cultivar epithet (`Schizachyrium scoparium 'The
  Blues'`) via `planBotanicalName`, which leaves a nested exact-species choice
  (`fullName`, or a cultivar carrying its own `latin`) alone.
- Common name drops the cultivar, since the botanical column carries it.
- Quantity is `plantsForTiles(plantedRecords, space)` — the same figure the
  planting list calls "to order", counted from **planted records** rather than
  plan tiles. That distinction matters: `shrubPlanComponents` tiles are the
  mature *footprint*, so counting them would bill one viburnum as nine.
- Spacing goes through `plantMeasure`, the shared formatter, so it follows the
  units preference like everything else (§18) — never a unit string built here.
- Truncation is by `ctx.measureText` (`planFitText`) rather than a character
  count, so a column is filled rather than guessed at.

`ids` is now built from the planted maps and sorted by count descending, so the
schedule reads biggest-first and in the same order as the planting list.

### Codes that can be read back

`planCodes` now takes **three genus letters** and appends a **digit** — and
only when the garden actually holds more than one selection of that species,
because a suffix is only information when there is something to tell apart. On
the review garden every tag became exactly three characters: `SC'TH` → `SCH`,
`AG'BL` → `AGA`, `FE'EL` → `FES`, `AL` → `ALL`, `NA` → `NAS`.

Two different species in one genus still grow into the epithet on collision
(`VIB`, then `VIBD`), which is the pre-existing behaviour and is preserved.

**Letters were kept over numbers deliberately.** A number is shorter and
unambiguous, but `SCH` is a *hint* — it tells a gardener it is a
*Schizachyrium* without the key — and this app's reader is often the gardener
rather than a contractor. Switching to `1..n` is a small change to `planCodes`
alone if that trade is ever re-decided; nothing else reads the code's shape.

### The bulb sheet (0.8.81)

A garden with bulbs is a **sheet set**, because Oudolf's bulb design is an
*overlay* of the perennial design — two independent designs on the same ground,
and one drawing cannot show both honestly. A garden *without* bulbs is one
sheet and is untouched by all of this.

`planSheets()` is the set: always the planting plan, plus a bulb plan when any
live bulb exists. Both are built on open into their own canvas
(`#planCanvas`, `#planBulbCanvas`), and a `.seg` toggle flips which is on
screen. Building both up front is what makes the toggle instant *and* what lets
print emit the set rather than whichever tab happened to be open.

`drawPlanSheet(pc, sheet, index, shared)` is the old `buildPlanMap` body, and
`buildPlanMap` is now the orchestrator. What differs per sheet is only which
planting is the **subject** and which is **context**:

| | planting plan | bulb plan |
| --- | --- | --- |
| perennials | subject — layer weights, labels | ghost: 88% paper, fill only, no stroke, no label |
| bulbs | absent | subject — drifts, stands, `×N`, plus the ring scatter |
| trees, shrubs | solid, labelled | solid, **unlabelled** |
| site base | identical | identical |
| schedule | its own species | its own species |

Measured on the review garden with 73 bulbs planted through it, as RGB
distance from paper (luminance is the wrong metric here — it would call a
daffodil's yellow "pale"):

| | planting sheet | bulb sheet |
| --- | --- | --- |
| perennials | 46 | **24** (ghost) |
| bare bed | 37 | 37 |
| bulbs | **37 — identical to bare bed, i.e. absent** | **63** |

So on the bulb sheet the reading order is bulbs (63) over bare ground (37) over
the perennial ghost (24) — the ghost is fainter than the ground it sits on,
which is what makes it read as *underneath* rather than as another planting.

Four decisions worth keeping.

**Codes are assigned across the SET, never per sheet.** *Campanula* and
*Camassia* both reduce to `CAM` and live on different sheets, so a per-sheet
assignment would hand the same tag to two different plants and the set would
contradict itself. `buildPlanMap` assigns once over both layers and passes the
result down; a test pins that exact pair.

**Structure draws on the bulb sheet without a code.** You plant bulbs around a
tree, so trees and shrubs are context there — but a code the sheet's own
schedule cannot explain is a dangling reference, so `drawShrubPlan` takes a
`label` flag and the tree label pass is skipped.

**Rings were kept, inside the drift** — and then replaced in 0.8.83 by the
stipple, which says the same thing about *density* rather than about tiles. See
the bulb-zone section above.

**Download gives the sheet you are looking at, not both.** Exporting the set as
two PNGs is the obvious reading and is worse in practice: two programmatic
downloads from one gesture raises Chrome's "Download multiple files?" prompt.
Print still gives the set, as two pages — gated on a `has-sheet` class so a
bulb-less garden does not print the undrawn default canvas as a blank page.

Two CSS traps, both hit: `.seg` is `display:inline-flex` and `#planCanvas` was
`display:block`, and **both beat the UA rule for the `hidden` attribute** — so
the toggle showed on bulb-less gardens and the two canvases stacked. Explicit
`[hidden]{display:none}` rules for each.

### Plan colour: a tint, not a mix (0.8.85)

The open item said colour was "doing a job it cannot do" — three lavenders
indistinguishable. Measuring first found a much worse defect underneath it.

**A layer used to set a FRACTION to mix the species colour toward paper**, and
a fraction preserves whatever lightness the source happened to have. Measured
across all 554 species, that put **114 of them (21%) within 0.03 OKLab of the
paper itself** — Culver's Root, Snowy Woodrush and White Wood Aster at 0.006,
which is a drift you cannot see at all. It spanned every type: 39 shrubs, 30
forbs, 27 trees, 7 grasses. Structure was the worst offender in principle: its
band claimed to be the darkest and its lower quartile sat 0.015 from paper.

A layer now names a **target lightness** and the tint keeps the species' hue
with a banded chroma (`planTintAt`, in OKLab — sRGB distance is not perceptual
and `mixHex` cannot set a lightness while keeping a hue). That makes the layer
weight mean something and no fill can reach the paper.

| | before | after |
| --- | --- | --- |
| species drawing on the paper | **114 of 554** | **0** |
| matrix, distance from paper | 0.004–0.098 | **0.059–0.108** |
| drift | 0.003–0.198 | **0.109–0.142** |
| structure | 0.001–0.239 | **0.159–0.182** |

The bands no longer overlap at all: no matrix tint is ever as strong as the
weakest drift. On the review garden's render the ladder went matrix 16 / drift
30 / structure 47 RGB distance from paper to **39 / 66 / 77** — the same
ordering, everything further off the page.

**Then the collisions.** Across the catalog, 74 pairs of forbs sat under 0.02
OKLab and Culver's Root and Common Yarrow at exactly **zero**. So a sheet's
species are tinted *together* (`planSheetTints`): in the schedule's own order,
so the biggest planting keeps the colour its plant gave it and the small ones
do the moving — the same principle as label placement. Hue rotation alone
cannot do it, since at these chromas a full 60° moves only ~0.03, so lightness
(±0.015, small enough that a nudge cannot invert a ladder whose bands are 0.05
apart) and chroma are candidates too.

Measured on realistic mixed palettes, three random draws each:

| species on a sheet | pairs under 0.02 | closest pair |
| --- | --- | --- |
| 14 (the review garden's size) | **0** | 0.035 |
| 21 (the demo garden's size) | **0** | 0.035 |
| 30 | 1 of 435 | 0.009 |

**Two findings worth keeping.**

*A cream bloom has just enough chroma to look like a hue and carry none.* The
"this colour has no usable hue" threshold went in at 0.004 — near zero, which
seemed safe — and it was the wrong number for the wrong reason. Every cream in
the catalog points the same yellowish direction, so twelve white-flowered forbs
all passed the test, all landed on one hue at the chroma floor, and the
separation pass had nothing to turn: **45 of 66 pairs under 0.02, closest
exactly 0.0000**. At 0.045 those blooms fall through to **foliage**, which is
the honest fallback — always a real green, blue-green or grey-green, and it
varies between species. Same set after: **0 pairs under 0.02, closest 0.035.**

*How far a hue may be rotated depends on how much it means.* A hue read off a
real bloom is information and stays within 60°, so a blue aster never comes out
green. A hue that fell through to foliage carries much less and may go to 110°
— which is what gives a sheet of white-flowered forbs anywhere to go.

**And the key now shows the colour that is on the drawing.** The swatch mixed
0.5 toward paper while a drift filled at 0.66, so the key was a different
colour from the thing it keyed. Both come from one resolved tint now; measured
across the review garden's 14 species, 13 match to the pixel and the 14th is a
one-tile shape where the probe hit its own outline.

`edgeDrop` was checked against what the old strokes actually resolved to,
which is the only way to keep the sheet in its own register: the old drift
stroke landed near OKLab L 0.56 and 0.30 reproduces it at 0.555. The old
structure stroke landed at 0.50; 0.40 takes it to 0.405 — deliberately a
little heavier, but not the 0.355 a first pass gave, which read as ink rather
than as a plant.

Side effect on the bulb sheet, which a lightness target made reachable where
paper-mixing had not: the zone went from **level with** the bare bed (37/37) to
clearly above it (**47** vs 37), and the perennial ghost from 24 to **17**. The
reading order is now zone over ground over ghost, which is what the overlay
wanted in 0.8.83 and only approximated.

Past what colour can carry it accepts a collision, and that is the honest end
of it: colour is indicative on a planting plan and the **code** is what
identifies.

### A stated scale, and placed labels (0.8.84)

These two shipped together because the first created the problem the second
solves, which is the most useful thing measured in this whole review.

**The sheet is drawn to a standard scale.** `cell` used to be
`max(9, min(24, floor(1000/side)))` — an arbitrary fit that gave a 31-tile plot
24px a tile and a quarter acre 9, so the sheet was a picture rather than a
drawing and nothing on it could be measured except through the graphic bar.
`planScale()` now picks the most detailed standard ratio at which the plot
still fits a portrait page, `planGeometry` derives `cell` from it at
`PLAN_DPI` (96) units to the paper inch, the title block states it, and the
print CSS sizes the canvas in real inches (`--plan-in`) so a rule laid on the
page agrees.

| plot | scale | cell |
| --- | --- | --- |
| 13 tiles (19.5 ft) | 1/4" = 1 ft (1:48) | 36px |
| 31 tiles (46.5 ft) | 1/8" = 1 ft (1:96) | 18px |
| 69 tiles (quarter acre) | 1" = 16 ft (1:192) | 9px |
| 111 tiles (166 ft) | 1" = 16 ft (1:192) | 9px, on a wider sheet |

Two honesties it has to keep. **The scale is always true and it is the PAPER
that grows** — a plot too big for the page at every legible scale keeps the
coarsest legible one and produces a wider sheet, exactly as a real site goes
onto a bigger sheet rather than being drawn at a ratio nobody can read;
`PLAN_CELL_MIN` (8px) is what enforces that. And **a browser's fit-to-page
rescales the print and no stated ratio survives it**, so the title block says
"at full size" and the graphic bar stays the thing that is true either way —
which is why a real drawing prints its paper size beside its scale.

Verified on the review garden: 46.5 ft drawn in 5.81 paper inches is exactly
8.0 ft to the inch, i.e. 1:96; the sheet is 6.88in wide, inside Letter and A4
portrait with margins; and the schedule still fits its columns at the narrower
660px sheet with nothing truncated. Metric resolves 1:100.

**Labels are placed, not just drawn.** `planLabelPlacer` measures each label,
tries it at its anchor, and on a collision moves it outward to the nearest free
spot with a **leader line** back — the standing convention for a label that
will not fit inside its own shape. Candidates step vertically first, because a
drift is wider than it is tall on this projection and there is more clear paper
above and below a shape than beside it. Shrub codes go down in the *drawing*
pass and cannot move, so they are seeded in as obstacles and stand labels move
around them.

Two refusals matter as much as the placement. When nothing is free the label
**stays on its anchor and overlaps** — a label a long way from the thing it
names is worse than two labels touching, because the reader cannot tell which
shape it belongs to; `PLAN_LABEL_RING` bounds the wander for the same reason.
And the drawing bounds are hard: a label outside the sheet is never chosen.

> **The measurement that justifies doing both at once.** The earlier note in
> this document said label collision "ranks lower than it looked — measured,
> exactly one overlapping pair". That was true *at cell 24*. Drawing to scale
> took the cell to 18 and the same garden's labels to **11 overlapping pairs**;
> the placer takes it to **0**, with 9 leaders and displacements of 17–21px,
> about a tile. A ranking measured under one set of constants does not survive
> a change to those constants.

### Bulb zones: density over an area (0.8.83)

A bulb sheet says "scatter this many through here" — a density over an **area**
— where a perennial drift says "this plant, on this ground". Drawn as drifts,
bulbs said the wrong thing twice over: a scatter at the spacing bulbs are
actually naturalised at came out as forty separate one-tile shapes, and the
per-tile ring of 0.8.81 was a *per-tile symbol*, which is precisely the claim
this convention exists to avoid making. (That note is superseded: the rings are
gone, replaced by the stipple.)

A bulb stand now draws as a **zone**:

- its planting **grown by a tile**, so a scatter reads as one flowing area;
- a **dashed** boundary, because the boundary is indicative;
- a **stipple** at the real planting density;
- the count on the label.

**The number is the authoritative part and the shape is not** — which is what a
dashed line means on a drawing. The count still comes from the *planted* tiles
via `plantsForTiles`, never from the grown zone, so the label, the schedule and
the planting list cannot disagree; the zone is bigger than the planting on
purpose.

**`BULB_STAND_GAP` is derived, not chosen**: `2 * BULB_ZONE_GROW + 1`. Two
planted tiles at Chebyshev distance *d* have grown zones that touch exactly when
*d* ≤ that, and two touching zones trace as one loop. Grouped at the perennial
gap of 2, a scatter three tiles apart stayed **42 separate stands** whose zones
abutted — 42 dashed shapes with seams between them, the opposite of the one
flowing area the zone exists to draw. At the derived gap it is **2 stands**
(one real scatter plus one genuine outlier), and at four tiles apart they are
genuinely two plantings and stay two.

**A zone never spreads across paving, water or a building.** You do not
naturalise bulbs into a gravel path, and a zone that ran over one would claim
ground the design has already spent. A path through a naturalised area
therefore comes back from the trace as an inner **loop** — so the zone is
filled as one accumulated path with **even-odd**. Filled loop by loop, that
hole paints solid and the tint covers the path, undoing the exclusion that put
the hole there.

**Stipple density** is real bulbs per zone tile, square-root compressed. The
linear figure spans 36:1 across the catalog (crocus at 3in against allium at
12in) and would go from unreadably solid to a single dot. Compressed, a crocus
carpet and a camassia scatter on the same 25 tiles measure **6 dots a tile
against 2** — while a *sparse* scatter of a dense bulb and a *tight* drift of a
sparser one land in the same place, which is the truth about them. Dots are
seeded off `tileSeed`, so a sheet reprints the same.

**Two measurements worth keeping.** The tint was set to 0.80 first and measured
**27** against the bare bed's own **37** — the zone came out *paler than the
ground it sits on* and read as a patch cut out of the planting. It is 0.72 now,
level with the bed. But the general lesson is that **the tint is not what marks
the zone**: the distance is linear in `(1-t)` and scales with how far the
species' own colour sits from paper, so a pale bulb always tints more weakly
than a saturated one. Measured on the *marking* instead — the darkest ink found
in a tile — a zone reads **118** against **226** for both bare bed and the
perennial ghost, on paper at 243. The stipple does the work.

The planting sheet is **byte-identical** through all of this (op trace hashed
against the 0.8.81 baseline): every change is inside the bulb branch.

### The site base split (0.8.82)

Every sheet in a set draws the same site: the same paper, north arrow, ground,
buildings and lot line. Those ~300 lines used to sit inline in `drawPlanSheet`,
so the two sheets shared them only by being one body called twice — which
worked, and hid the seam. They are now named:

| | draws |
| --- | --- |
| `planGeometry(rowsBelow)` | paper size, the 660px floor, the centred origin, the `X`/`Y` projectors |
| `drawPlanPaper(ctx,g,sheetName)` | paper, border, title block, true-north arrow |
| `drawPlanGround(ctx,g,site)` | grid, grade, terrain, firepits, water features, boulders, fences, walls, lights |
| `drawPlanStructures(ctx,g)` | footprints, houses, the deeded lot line — the base that goes *over* the planting |
| `drawPlanKeyRows(ctx,g,ly2,legRows,site)` | the light/boulder/tree-note rows under the schedule |
| `drawPlanScaleBar(ctx,g)` | the graphic scale |

`drawPlanSheet` keeps only what actually differs per sheet: the components, the
ghost/subject decision, the labels and the schedule.

**The base functions know nothing about which sheet they are drawing** — a test
asserts none of them reads `shared`, `sheetIndex` or `onBulbSheet`, and that
none recomputes the geometry. That is the whole point: a third sheet
(hardscape) becomes a small change rather than surgery on a 480-line function.

**They deliberately do NOT wrap themselves in save/restore.** Canvas state
leaks from block to block today and later blocks rely on it — the grid inherits
the north arrow's `textAlign`, the schedule sets its own. Isolating them would
be a behaviour change wearing a tidy-up's clothes.

Verified two ways, because a pure refactor deserves proof rather than a passing
test suite:

- **Runtime**: every canvas call and property write the plan makes was recorded
  with its arguments, plus an FNV hash of all 3.6M rendered pixels, on four
  gardens (a real 326-plant garden with and without bulbs, the demo garden with
  and without) — **identical op count, identical op sequence, identical
  pixels** on all four. One arm looked like a regression until it turned out I
  had installed the demo copy under a different *name* in the two runs, and the
  garden name is drawn in the title block. Replayed with the name matched, it
  was identical too. A diff instrument needs its control held as carefully as
  its arm.
- **Textual**: each moved block was diffed against the committed file
  line-for-line, ignoring only the wrapper and destructuring lines actually
  added — **all seven blocks character-identical**, which covers every branch
  including the ones no test garden reaches (an irregular lot, the small-plot
  paper floor, formal edges, legacy houses).

One real bug the tests caught mid-refactor: `drawPlanKeyRows`'s tree-note row
positions itself with `fixtureRows`, which had stayed behind in `drawPlanSheet`.
It only fires on a garden with trees, so the bulb-sheet tests were all green —
it was the demo garden's oak that found it. `fixtureRows` rides the `site`
object now, so there is one definition of it.

### Measured after (0.8.80, the single sheet)

Off the review garden's own rendered sheet, in the browser (the plan canvas
sizes itself explicitly rather than from the viewport, so it renders correctly
even in a hidden pane — which is just as well, because `innerWidth` is 0 there
and a screenshot is worthless):

| | before | after |
| --- | --- | --- |
| labels on the drawing | 86 | **53** |
| single-tile labels | 32 | **5** |
| overlapping label pairs | 1 | **0** |
| label font range | 8–13px | **9–13.5px** |
| longest tag | `SC'TH` (5) | **`SCH` (3)** |
| schedule columns | 1 (code + name + tiles) | **5** |

The layer hierarchy is real in the pixels, not just in the constants — median
luminance sampled at every planted tile against paper at 243:

| layer | tiles | median luminance | contrast from paper |
| --- | --- | --- | --- |
| matrix | 141 | 227 | 16 |
| drift | 156 | 213 | 30 |
| structure | 29 | 196 | 47 |

A clean monotonic ladder: the matrix carries about half the drift's contrast and
structure about 1.6× it. Note the split — 141 matrix tiles against 156 drift —
which is the 70/30 fruitcake ratio arriving at roughly 45/50 in a real garden,
and is why quieting the matrix moves so much of the sheet.

Also verified: nothing truncates at the real font (longest botanical name
185px in a 205px column, where the sandbox's 6.2px/char approximation does
truncate it); nothing overflows the paper; the small-plot paper floor applies
and centres the drawing (13-tile plot, 312px drawing on 660px paper, centred at
174); two selections of one species number as `SCH1`/`SCH2`; a cultivar
carrying its own `latin` is not double-appended (`Salvia nemorosa 'Caradonna'`);
bulbs reach the schedule; and the spacing column follows the units preference
(`18" o.c.` / `46 cm o.c.`). The sheet grew 150px taller for the full schedule.

## What is still open

Ranked, most valuable first.

1. **One sheet still does four jobs.** A real set is layout/hardscape →
   planting → bulbs → schedule. Ours puts terrain, elevation, walls, buildings,
   lights, boulders, trees, shrubs, perennials and bulbs on one page. Item 1
   gets the hardscape separation for free.

2. **Hedge stands.** `shrubPlanComponents` already groups a hedge run, but
   `drawShrubPlan` labels it with a code and no count. A hedge is the one woody
   case where `×N` is what a buyer needs.

3. **A scheme question worth deciding before the bulb sheet.** Bulbs are inside
   `SCHEME_LAYERS`, so switching planting schemes switches the bulb plan too.
   Oudolf's bulb layer is usually *one* layer under several possible perennial
   treatments. Not necessarily wrong — but if "bulbs shared across schemes"
   ever becomes wanted, that is a `SCHEME_LAYERS` edit and a save-format
   question, much cheaper to decide now than after people have gardens.

## Sources

- [Oudolf Garden Detroit — Bulbs](https://oudolfgardendetroit.org/our-plants/bulbs/)
- [Lurie Garden — Planting a new Piet Oudolf Garden](https://www.luriegarden.org/planting-a-new-piet-oudolf-garden/)
- [Matrix planting (Wikipedia)](https://en.wikipedia.org/wiki/Matrix_planting)
- [Colwynn — How to Read a Planting Plan](https://www.colwynn.com/p/how-to-read-a-plan)
- [The Landscape Library — Plant Symbols for Landscape Design](https://www.thelandscapelibrary.academy/blog/plant-symbols-for-landscape-design)
- [The New Perennialist — Designing with Oudolf & Diblik](https://www.thenewperennialist.com/designing-w-remarkable-plantsmen-piet-oudolf-roy-diblik/)
