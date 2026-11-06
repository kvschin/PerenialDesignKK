# Wet-ground perennials

Implemented November 6, 2026, version 0.9.79. Adds 24 base records and 17 cultivars for the ground
beside a pond rather than in it. Catalog totals: 691 base records / 522 nested choices. No runtime
dependency or remote request was added.

Evidence: [wetground-sources.json](wetground-sources.json) records every source URL, and names every
field that is a planning value rather than a published figure, and why.

## Why this pass

The pond pass (0.9.77) left out plants that grow beside water. The brief named eight candidates, all
absent from the catalog. Counting 20 published lists, 12 of bog plants and 8 of pond plants, kept seven
of them, dropped one, and found that the biggest gaps were not on the brief at all:

| Lists (of 20) | Added | |
| --- | --- | --- |
| 8 | Bigleaf ligularia and 2 cultivars, 'The Rocket' | not on the brief |
| 7 | Featherleaf, chestnut-leaved and bronzeleaf rodgersia, and 'Superba' | not on the brief |
| 7 | Japanese primrose and 2 cultivars, Bulley's primrose, giant cowslip, drumstick primrose | not on the brief |
| 5 | Meadowsweet and 'Aurea'; 'Golden Queen' and 'Superbus' on the existing globeflower | not on the brief |
| 5 | Swamp rose mallow and 3 cultivars, scarlet rose mallow | candidate |
| 4 | Purple pitcher plant, water avens and 'Leonard's Variety', cuckoo flower | candidates |
| 4 | Giant rhubarb | not on the brief |
| 3 | Umbrella plant, Bowles' golden sedge, marsh spurge, slender sweet flag and 2 cultivars | not on the brief |
| 2 | Monkey flower, ragged robin and 2 cultivars, marsh fern | candidates |
| 2 | Ornamental rhubarb and 'Atrosanguineum' | not on the brief |

**Dropped: cotton grass**, on 1 list of 20. It is a plant of acid peat rather than garden soil. Reading
the bog lists alone would have dropped ragged robin and cuckoo flower too, because both are British
wildlife-pond staples that bog lists do not mention. That is why the pond lists are counted.

Left out on purpose, with reasons in the sources file: the loosestrifes, skunk cabbage, and wet-ground
shrubs such as swamp rose, which is the gap left for a shrub pass.

These are ordinary `forb` records plus one `sedge`. They carry no `marginal` flag: that means a plant
that stands in water, it drives the amber advice away from water, and a test holds it to water plants.

## Drawing

Every option is data gated and no renderer checks a species key. Against the previous build, 37,504
draws of all 1,172 existing plant choices (both renderers, four seasons, two growth stages, two seeds)
matched call for call, so no existing plant changed.

- **`leafStyle:'parasol'`** in the shared basal foliage pass: big leaves held out on stalks and seen
  from a little above (`drawParasolLeaf`). `lobes`, `lobeDepth` and `lobeCut` take one shape from a
  round Darmera leaf through a toothed Ligularia to a Rodgersia cut nearly into leaflets, so five genera
  share it. Near leaves stand at half the height of far ones and tip toward the viewer. At one height
  they merged into a flat table on a stem, and Darmera and Gunnera looked like small trees. `S.edge` is
  the back of the leaf, which is what shows on 'Desdemona'.
- **`leafStyle:'pitcher'`** (`drawPitcher`): hollow leaves in a rosette laid out on the ground plane,
  so front ones come toward the viewer. Drawn as a fan they read as a basket with every mouth in a row.
- **`flowerStyle:'mallow'`** on the leafy-stem mound's `bloom` head (`drawMallowFlower`): five petals, a
  dark eye and a staminal column. `petalW` narrows the petals until they part, the scarlet mallow's star.
- **`umbelStyle:'nodding'`** hangs a ring of bells from the top of a stalk (giant cowslip), or one wide
  bell (the pitcher plant's flower). **`whorlPetals`** sets the petals on a whorled umbel; arrowhead
  and water plantain keep their 3, and the candelabra primroses take 5.
- **`spikeStyle:'plume'`**: a branched cone for Rodgersia and Rheum that holds in seed.
- **`bloomStemsOnly:'seed'`** keeps bare stalks through the seed season as well as in flower.
- **`lowRosette`** and the two new leaf styles skip the closing highlight strokes (`basalFoliageOnly`).
  Those strokes assume foliage fills the plant's height, and hung in the air over a low rosette whose
  height belongs to a flower stem. Existing `bloomStemsOnly` plants keep them, to stay identical.

Monkey flower and marsh spurge were first drawn with stem leaves and read as fir trees, so they moved to
the existing leafy-stem mound. Meadowsweet did the same with stem leaves added to hide bare spring stalks;
it now has a full basal mound, and its stalks stand only in flower and seed. Ligularia's daisies were
reduced to their real 3-5 in, which also took them onto the cheap stroke path (0.79ms to 0.43ms a bake).

## Regional cautions

Three new records carry cautions read from primary documents, so the default filter hides them:

- **Ragged robin** in North America. Connecticut Public Act 25-126 names it among plants no one may
  import, sell, buy, transplant or cultivate, and the October 2025 state list marks it prohibited and
  potentially invasive. Go Botany says it is not a major invasive in New England but can form large patches.
- **Meadowsweet** in North America. Wisconsin's NR 40 list has it in the Restricted category, and NC
  State calls it weedy.
- **Giant rhubarb** in Europe. The RHS says plants grown in Britain as this species are really the hybrid
  *Gunnera x cryptica*, which must not be newly planted, and Gardeners' World reports sales banned. It
  stays offered in North America, where nothing read restricts it. *G. tinctoria* is on the EU list and
  in Cal-IPC, and `dev/invasive-check.js` reports it as a same-genus neighbour.

Each is one jurisdiction speaking for a continent, which is the over-reach recorded under Open decisions
in [regional-guidance.md](regional-guidance.md). A gardener can still show them with the filter.

`dev/invasive-check.js` found no exact match among the new plants on either cached list. Neither list has
Connecticut or Wisconsin in it, so the checker could not have found the first two; they came from reading.

No caution was written for three things a source mentions without evidence of harm: pitcher plant
(naturalised in Swiss bogs and in Ireland), umbrella plant (naturalised in Britain and Ireland), and
slender sweet flag (called invasive by a retail pond list that cites nothing, and on neither cached list).

## Open questions

- *Hibiscus moscheutos* and *H. coccineus* moved to *Muenchhusia* in 2025, and NC State and Wikipedia
  have followed. Labels have not, so the display name stays *Hibiscus* with the new name searchable.
- Whether *Cardamine pratensis* is native to North America is disputed; see the sources file. The Flora
  of North America page could not be read, so the record claims Europe and Asia only.
- Heritage Perennials' zones are often wider than anyone else's. Several were narrowed as a cautious
  reading, and those deserve a check against a nursery in hand. Each is named in the sources file.
- Marsh fern's zones rest on one archived page.

## Verification

`node tests/run.js` passes with new tests in both suites, and 26 mutations of the new rules were each caught,
two only after their loose tests were tightened. `dev/wetground-review.html` shows every new choice in four seasons at
library size and true scale beside a 6 ft post (`?only=`, `?seasons=`, `?scaleSeason=`, `?nocards`,
`?check`, `?bench=1`, `?art=0`): 492 sprite edge checks came back clean in each renderer, and every plant
was looked at in screenshots in all four seasons. A bake costs at most 0.54ms (ornamental rhubarb) against
0.63ms for switchgrass, in the same headless Chrome. In the real app, 27 of these plants set round a pond
through the app's own placement path held up in all four seasons at 150% zoom. Search finds the older names:
Lychnis, Muenchhusia, Peltiphyllum, Gunnera x cryptica. Physical-device checks were not run.
