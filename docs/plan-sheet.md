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
   *not*: measured, only **one pair of labels actually overlapped**. The sheet
   read as crowded rather than collided, which is why leader lines are further
   down the open list than eyeballing the image suggested.)

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
| `matrix` | 80% paper, a whisper of a stroke (0.8px at 12% ink), soft label ink | the cake — it has to recede |
| `drift` | 66% paper, 1.3px at 25% ink, dark label | unchanged; this was already right |
| `structure` | 60% paper, 1.9px at 45% ink, dark label | the fruit — it has to advance |

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

### Measured after

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

1. **Split `buildPlanMap` into sheets.** It is one ~470-line function that
   sizes the canvas, draws paper/title/north/grid, then ground, then planting,
   then schedule and scale bar, all inline. Splitting it into a common
   `drawSiteBase(ctx, geom)` plus `drawPlantingLayer(ctx, geom, opts)` is the
   enabling refactor for everything below.

2. **The bulb sheet** — the reason this review started. The *model* is already
   done: bulbs are a separate layer (`game.bulbs`), already scheme-partitioned
   (`SCHEME_LAYERS`), already layer-toggleable, with their own placement rules.
   Nothing in the save format needs to move. Today they draw as one stroked
   ring per tile over the top of everything ([io.js](../js/io.js), "bulbs:
   scatter rings over everything"), with no code label — so two bulb species
   are distinguishable only by hue, landing on drifts that already carry their
   own fill, outline and label. The app has exactly the problem the overlay
   convention exists to solve; it just does not show up until a garden has
   bulbs in it.

   The shape of the fix:
   - Sheet 1 "Planting plan": perennials/grasses/shrubs solid, bulbs omitted.
   - Sheet 2 "Bulb plan": bulbs solid with their own codes and schedule;
     perennial drifts dropped to a pale unlabelled ghost (~15% alpha, no
     outline) so you can see *where* they are without reading them. Trees and
     shrubs stay solid on both — you plant bulbs around them.
   - `planComponents()` hardcodes `game.plants`; parameterise the layer and
     bulbs get drifts, stands, codes and labels for free.
   - Keep `planCodes` **global** across sheets, not per-sheet: a code should
     mean the same plant on every sheet and in the schedule.
   - `#planScreen` needs a sheet toggle; `downloadPlan()` should export both
     (`-plan.png`, `-bulb-plan.png`); the print CSS should give two pages.
   - Gate sheet 2 on `bulbsLive.length` so gardens without bulbs are unchanged.

   Level 3, if the goal becomes "a sheet you can hand an installer": Oudolf's
   bulb overlays are *density over an area* ("N. 'Thalia' × 200 naturalised
   through here"), which draws as a dashed zone boundary + stipple + count, not
   as an outlined shape. Our model knows every bulb's tile, so this is a
   drawing decision, not a data one.

3. **Label collision and leader lines.** Labels are placed and drawn with no
   overlap test. This ranks lower than it looked: measured, the old sheet had
   exactly one overlapping pair and the new one has none, so the symptom was
   crowding rather than collision. It will still matter on a garden denser than
   this one, and the convention is a leader line out to clear paper when a
   label will not fit inside its own shape.

4. **A stated drawing scale.** `cell = max(9, min(24, floor(1000/max(GW,GH))))`
   — a 31-tile plot gets 24px/tile and a quarter acre gets 9px, where labels
   become unreadable. The scale *bar* is honest, but there is no drawing-to-a-
   ratio (1:50, ¼"=1'), which is what makes a plan measurable off the print.

5. **Colour is doing a job it cannot do.** `planColor` resolves summer bloom →
   spring bloom → fall bloom → fall seed → foliage, so the sheet is coloured by
   *flower colour*. On the review garden the three largest forbs — Salvia,
   Allium and Agastache — were all the same lavender and mutually
   indistinguishable. Either drive saturation/value off the layer role, or
   accept that a dozen species cannot be separated by hue and lean on the tag.

6. **One sheet still does four jobs.** A real set is layout/hardscape →
   planting → bulbs → schedule. Ours puts terrain, elevation, walls, buildings,
   lights, boulders, trees, shrubs, perennials and bulbs on one page. Item 1
   gets the hardscape separation for free.

7. **Hedge stands.** `shrubPlanComponents` already groups a hedge run, but
   `drawShrubPlan` labels it with a code and no count. A hedge is the one woody
   case where `×N` is what a buyer needs.

8. **A scheme question worth deciding before the bulb sheet.** Bulbs are inside
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
