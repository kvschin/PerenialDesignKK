# Meadow perennial audit (Nov 2026, 0.9.113)

Seven plants that drew close to, but not as, themselves, reported from the
garden: rattlesnake master, sea holly, mountain mint, the asters, yarrow,
prairie smoke and the prairie clovers. Each was looked at in four seasons, as a
close-up of its head, and at true scale beside a 6 ft post, in
`dev/meadow-review.html` (`?batch=eryngium|mint|aster|yarrow|smoke|clover`,
`?only=key,key:cv`, `?ov=` to try a change, `?headFrac=`, `?z=`, `?check`,
`?bench=1`). Echinops, calamint, Queen of the Prairie, golden Alexander, water
avens, the pasque flowers and dense blazing star are on the page as the plants
they are most often confused with. The same release checked the height of every
Sun Perennial (below).

## What was wrong, and what changed

| Plant | Problem | Change |
| --- | --- | --- |
| Rattlesnake master | Seven stalks, each with one egg-shaped head. The plant has a few stout stems that fork near the top, and fork again, into a loose dome of a dozen or more small bristly balls (MBG: "tiered, branched clusters" of globular heads, ¾–1 in). | `globeStyle:'cyme'` (`drawEryngiumCyme`): three stems, each ending in a cyme of 14 balls built in the round over the stem tip and joined back to it through three forks, painted far to near; each ball a lit sphere under a pelt of florets with the points of its bractlets. Brown balls stand into winter, each holding its snow. Stems only in flower and seed (`bloomStemsOnly:'seed'`), so spring is the yucca-like leaves alone. |
| Sea holly (*E. bourgatii*, 'Picos Blue') | A ball in a star of spines radiating all round it, a thistle seen face on, and no collar at all once the colour went in the seed season. The head is an upright cone of florets sitting on a flat ruff of long spiny bracts, and the ruff dries and stands with it. | `globeStyle:'collar'` (`drawEryngiumCollar`, `drawSeaHollyHead`): an upright cone, lit, with floret texture, in a flattened star of narrow bracts each carrying a pair of side spines, the far half of the ruff behind the cone; each stem branches below its tip into two side heads, with a small star of spiny leaves at the fork. Winter takes a bleached straw ruff (`bract`). |
| Mountain mint | Three or four stems with flat leaf pairs stacked like a pagoda, under big silver plates, and large dark seed heads. The plant is a dense, spreading clump of many branched square stems (MBG, New Moon: 1–3 ft, clump-forming, rhizomatous), its top leaves dusted silver, with small dense flower clusters. | Now the leafy-stem habit (`habit:'leafystems'`, a dome of 20 stems) with `frost`: the top third of every stem in the season's `bract` colour. `headStyle:'knot'`: a small tight knot of florets on every tip and smaller ones in the axils below; in seed the knots shrink and darken but stay quiet. |
| Asters (aromatic, New England, smooth blue, white wood, blue wood, Frikart's, Japanese) | Before the fall bloom, a translucent oval with a few leaves scattered in it: the scattered mound has no stems, so spring and summer were "just leaves". An aster is a clump of leafy stems all season, branching at the top into a panicle of daisies. | All seven on the leafy-stem habit, each with its own stem count, spread, arch and leaf (ovate, lance, heart-shaped). `headStyle:'aster'`: the top of each flowering stem branches into short shoots, each ending in a daisy, rays in one stroke and discs in one batch; tawny pappus tufts in seed. Winter keeps a few dead leaves (`winterThin`). |
| Yarrow (and four cultivars) | A grass-like fan of leaves under bare stalks topped with a loose cloud of a dozen dots. Yarrow's flowers are a flat plate (a compound corymb, 2–4 in across) over feathery, finely cut leaves. | `umbelStyle:'plate'`: a flat ellipse of seven tight sub-clusters on short rays, a dark underside under them, the far clusters first; the same plate in brown stands into winter. `leafStyle:'feather'` (`drawFeatherTuft`, `featherLeafPush`): a tuft of finely cut leaves as strokes in three tones by depth, and `stemLeafStyle:'feather'` puts smaller ones up the stems. |
| Prairie smoke | Pink balls on short stalks in spring, a starburst of straight lines in summer, bare stalks in fall, and the same starburst back in winter; no rosette. The plant is a semi-evergreen rosette of ferny, finely divided leaves, reddish in fall; each stem carries three nodding urn-shaped flowers, which turn up as the seed sets and pull out feathery plumes, the "smoke", gone by midsummer (MBG; Minnesota Wildflowers). | `flowerStyle:'avens'` on its own branch of the drumstick form (`drawAvensStem`): a feather rosette laid low, burgundy in fall and winter; reddish stems only in flower and seed, each forking into three pedicels hanging closed pink urns in a flare of bractlets; in summer the pedicels turn up and each head carries a fan of wispy pink plumes. No plumes in winter. |
| Prairie clovers (purple, white) | Beads up a stalk, over lumpy leaves. A *Dalea* head is a thimble of calyces that flowers from the bottom up: a ring of florets, anthers out, climbs it, silvery buds above and spent calyces below; the leaves are pinnate with three to seven needle-fine leaflets. | `spikeStyle:'dalea'` (`drawDaleaHead`): a rounded cylinder, buds silver above the ring and olive-tan below, the ring of florets in two halves round it with orange or yellow anthers on the near side; brown in seed into winter. No basal fan: a vase of wiry stems clothed in `stemLeafStyle:'feather'` leaves. |

## New species

Three mountain mints join *P. muticum* under a Mountain Mint card
(`group:'mountainmint'`), with sources in the record's estimates below:

| Key | Plant | Height | Spread | Zones | Notes |
| --- | --- | --- | --- | --- | --- |
| `virginiamountainmint` | *Pycnanthemum virginianum* | 30 in | 18 in | 3–7 | Narrow leaves, flat-topped clusters; wet meadows. MBG 2–3 ft by 1–1.5 ft, z3–7; Prairie Moon 3 ft, z3–7; New Moon 2–3 ft by 12–18 in. |
| `slendermountainmint` | *P. tenuifolium* | 28 in | 24 in | 4–8 | Needle-fine leaves, many small heads. MBG 2–3 ft by 2–3 ft, z4–8; Prairie Moon 2 ft, z4–9; New Moon 2–3 ft. |
| `hoarymountainmint` | *P. incanum* | 36 in | 36 in | 4–8 | Broad toothed leaves turning white toward the top, tiered heads. MBG 2–3 ft by 3–4 ft, z4–8; Prairie Moon 3 ft, z4–9; New Moon 3–4 ft by 3 ft, z5–8. |

*P. muticum* itself now carries `heightIn:30` (MBG 1–3 ft, New Moon 2–3 ft by
2 ft). Hairy mountain mint (*P. pilosum*) was left out: MBG's 1–3 ft and the
3–5 ft quoted elsewhere were too far apart to settle from one source.

## Renderer, opt-in

Every option is read only by a record that sets it. Drawing every choice in the
catalog with the old data through the old and new `draw.js` gave identical canvas
call streams (11,616 draws: each choice, four seasons, two growths), and every
unchanged plant with the new data was identical too (11,464 draws). The retired
`globeStyle:'seaHolly'`/`'rattlesnake'` branches and the three aster habits
(`asterdome`, `asterupright`, `asterclean`) were then removed, nothing reading
them.

- Globe `globeStyle:'cyme'`: `cymeHeads`, `cymeW`, `cymeH`, `headR`.
- Globe `globeStyle:'collar'`: `coneW`, `coneH`, `bracts`, `bractLen`,
  `bractW`, `bractDroop`, `sideHeads`, `forkDrop`, `forkReach`, `forkRise`; the
  season's `bract`.
- Leafy-stem habit: `headStyle:'aster'` (`headsPerStem`, `asterSpan`,
  `branchLen`, `rays`, `rayLen`, `rayW`, `discR`), `headStyle:'knot'`
  (`knotR`, `knotFlorets`, `axilHeads`, `axilSpan`), and `frost` (a fraction up
  the stem, coloured by the season's `bract`).
- Umbel `umbelStyle:'plate'`: `head`, `plateY`, `subClusters`, `subFlorets`,
  `subR`, `floretR`.
- Stemmed forbs: basal `leafStyle:'feather'` (`leafPairs`, `leafletLen`,
  `leafletW`, `leafRise`, `leafSpread`) and `stemLeafStyle:'feather'`
  (`stemLeafLen`, `stemLeafPairs`, `stemLeafletLen`).
- Spike `spikeStyle:'dalea'`: `spikeLen`, `spikeW`, `ringFlorets`, `floretR`,
  `ringH`; anthers from the season's `eye`.
- Drumstick `flowerStyle:'avens'`: `headsPerStem`, `pedicel`, `button`,
  `plumeCount`, `plumeLen`, `plumeW`, with the feather rosette.

## Cost

Headless Chrome, min of four interleaved passes against 0.9.112, eight draws a
bake, Summer, Fall and Winter. Every redrawn plant bakes in 0.34 ms or less
(slender mountain mint in summer the most), against 0.03–0.24 ms for the old
drawings: rattlesnake master 0.13–0.15 → 0.15, sea holly 0.13 → 0.19–0.20,
mountain mint 0.09–0.13 → 0.18–0.25, asters 0.03–0.24 → 0.03–0.25, yarrow
0.08–0.10 → 0.15–0.19, prairie smoke 0.01–0.04 → 0.01–0.06, prairie clover
0.10 → 0.10–0.24. All inside the catalog's range. Sprites: 1,728 bakes and 576
library and tray previews of these families, none touching its edge.

## Heights (every Sun Perennial)

A herbaceous plant draws its height from `h` (px-art, drawn at
`h*HERB_SCALE`, which is `PX_PER_FT/12` per inch), so `h` is a drawn height
in inches; the card quotes `heightIn`, or `h` when there is none. The two had
drifted. The backfills of October and November added `heightIn` and left
`h` alone, so pale purple coneflower was quoted at 36 in and drawn at 55,
prairie blazing star at 48 and 78, nodding onion drawn at 31 in for a 12-18 in
plant; and 84 of the 202 species, and most of their cultivars, had no sourced
height at all.

Every Sun Perennial choice (322) was measured in the real renderer: drawn at
full growth in each season and three seeds, its top read off the ink, in
inches, in the bloom season. Then:

- **A sourced height** (`heightIn`, height in flower) for every species and
  cultivar that lacked one and has a source: Missouri Botanical Garden's
  Plant Finder first (matched by botanical name, and its first hit checked,
  since six were the wrong cultivar), then RHS, Prairie Moon, New Moon and
  nursery listings where MBG had nothing. A range is quoted at its midpoint
  unless noted. Records that already carried a sourced height kept it.
- **A drawn height that matches it**: where a choice drew more than 8% (or
  2 in) off its `heightIn`, `h` was rescaled by the measured ratio of drawn
  height to `h`. A cultivar whose height differs from its species' gets its
  own `h` and `heightIn`; one within tolerance inherits.

After: every choice with a `heightIn` draws within 10% of it, except the
desert rosettes. Left alone on purpose: the yuccas, hesperaloes, agaves, sotols
and ocotillo (their `heightIn` is the rosette's and the drawing includes a
flower stalk, as the 0.9.94 desert audit records) and the stonecrops (0.9.102,
held to `h === heightIn` by a test). Aubrieta and moss phlox keep `h:8`:
these mats draw their width at a fixed size, and below `h:8` they clip their
own sprite, the trap the 0.9.2 notes describe.

No source was found, and the choice inherits its species' height, for:
'Picos Blue', 'Butterscotch', betony 'Rosea', 'Alba' blazing star, 'Blue Cloud'
calamint, scabiosa 'Blue Cockade' (an annual *S. atropurpurea* strain at
30-36 in, filed under *S. columbaria*: worth moving), the white nettle-leaved
mullein, white red valerian, white rose campion, 'Rubra' pasque flower, the
peony cultivars, 'Bees' Sunset', the white ragged robin and 'Catherine
Woodbery'. The garden daylily species record has no single source either.

Some figures are judgement within a wide range and worth a second source:
purple coneflower (MBG 2-5 ft, set 42 in), Culver's root (MBG 4-7 ft, 60 in),
*Penstemon digitalis* (MBG 3-5 ft, 42 in), 'Caradonna' (MBG 1-2 ft, 18 in;
often grown taller), 'Blue Spire' Russian sage (MBG 2-3 ft, now shorter than
the species at 48 in), 'Jeana' phlox (MBG 2-4 ft, 36 in) and narrowleaf
blue-eyed grass (MBG 1.5-2 ft, 18 in).

Noticed, not changed: the library previews of red yucca, Havard agave and
'Catherine Woodbery' daylily touch their canvas edge, as they did before this
release.

| Choice | heightIn (in) | Source | h | Drawn (in), before → after |
| --- | --- | --- | --- | --- |
| echinacea | - → 42 | MBG 2-5 ft | 48 → 39 | 51.4 → 42.3 |
| echinacea:magnus | - → 33 | MBG 2.5-3 ft | (inh.) → 31 | 51.4 → 34.3 |
| echinacea:whiteswan | - → 30 | MBG 2-3 ft | (inh.) → 28 | 51.4 → 31.4 |
| echinacea:tikitorch | - → 30 | MBG 2-3 ft | 34 → 27 | 37.7 → 30.3 |
| echinacea:cheyennespirit | - → 24 | MBG 1-2.5 ft | 30 → 21 | 33.7 → 24.6 |
| echinacea:greenjewel | - → 21 | MBG 1.5-2 ft | 24 → 18 | 27.4 → 21.1 |
| echinacea:pinkdoubledelight | - → 21 | MBG 1.5-2 ft | 24 → 18 | 27.4 → 21.1 |
| pallida | 36 → 36 | kept | 52 → 34 | 54.9 → 37.1 |
| topeka | 30 → 30 | kept | 44 → 28 | 46.9 → 30.9 |
| angustifolia | 18 → 18 | kept | 30 → 16 | 33.1 → 18.9 |
| paradoxa | 36 → 36 | kept | 42 → 34 | 44 → 36 |
| eryngiumbourgatii | - → 18 | MBG 1-2 ft | 24 → 18 | 24 → 18.9 |
| monarda | - → 36 | MBG 2-4 ft | 44 → 36 | 44 → 36.6 |
| spottedbeebalm | - → 21 | MBG 1.5-2 ft | 30 → 21 | 30.3 → 21.7 |
| scarletbeebalm | - → 36 | MBG 2-4 ft | 48 → 36 | 48 → 37.1 |
| scarletbeebalm:jacobcline | - → 44 | Estabrooks 40-48 in; Gertens 4 ft; North Creek 3-5 ft | 54 → 44 | 54.3 → 44.6 |
| scarletbeebalm:raspberrywine | - → 42 | MBG 3-4 ft | 44 → 44 | 44.6 → 44.6 |
| scarletbeebalm:marshallsdelight | - → 30 | Native Plant Trust 2-3 ft; Hoffie Nursery 30-36 in | 40 → 30 | 40.6 → 31.4 |
| easternbeebalm | - → 18 | MBG 1-2 ft | 26 → 17 | 26.9 → 18.3 |
| lemonbeebalm | - → 21 | MBG 1-2.5 ft | 28 → 21 | 28 → 21.7 |
| allium | - → 16 | MBG 1-1.5 ft | 36 → 14 | 40 → 17.7 |
| baptisia | - → 42 | MBG 3-4 ft | 50 → 32 | 65.7 → 42.3 |
| baptisia:creamwild | - → 27 | MBG (B. bracteata) 2-2.5 ft | 30 → 22 | 36.6 → 26.9 |
| baptisia:pinklemonade | - → 45 | MBG 3.5-4 ft | (inh.) → (inh.) | 65.7 → 42.3 |
| purpleprairieclover | 24 → 24 | kept | 30 → 25 | 28.6 → 24 |
| amsonia | - → 30 | MBG 2-3 ft | 44 → 30 | 44.6 → 32 |
| amsonia:stringtheory | - → 24 | Grimm's Gardens 18-22 in, to 24 in in flower (Kennedy's) | 26 → 24 | 26.3 → 24.6 |
| ozarkamsonia | - → 30 | MBG 2-3 ft | 46 → 29 | 48 → 31.4 |
| willowamsonia | - → 30 | MBG 2-3 ft | 42 → 29 | 44 → 31.4 |
| easternbluestar | - → 30 | MBG 2-3 ft | 40 → 29 | 41.7 → 31.4 |
| fringedbluestar | - → 30 | MBG 2-3 ft | 34 → 28 | 36 → 29.7 |
| aster | - → 24 | MBG 1-3 ft | 32 → 23 | 33.1 → 24 |
| newengland | - → 54 | MBG 3-6 ft | 54 → 54 | 54.3 → 54.3 |
| smoothaster | - → 36 | MBG 2-4 ft | 40 → 35 | 41.7 → 36.6 |
| frikartaster | - → 30 | RHS 0.5-1 m | 32 → 29 | 33.1 → 30.3 |
| kalimerisbluestar | - → 15 | MBG 1-1.5 ft | 28 → 14 | 29.1 → 15.4 |
| culvers | - → 60 | MBG 4-7 ft | 60 → 60 | 60 → 60 |
| culvers:fascination | - → 42 | MBG 3-4 ft | 48 → 40 | 50.9 → 43.4 |
| yarrow | - → 30 | MBG 2-3 ft | 30 → 30 | 28.6 → 28.6 |
| yarrow:terracotta | - → 33 | MBG 2.5-3 ft | (inh.) → 35 | 28.6 → 32.6 |
| yarrow:moonshine | - → 18 | MBG 1-2 ft | (inh.) → 19 | 28.6 → 18.3 |
| yarrow:waltherfuncke | - → 18 | MBG 1-2 ft | (inh.) → 19 | 28.6 → 18.3 |
| yarrow:summerwine | - → 18 | MBG 1-2 ft | (inh.) → 19 | 28.6 → 18.3 |
| phlox | - → 36 | MBG 2-4 ft | 50 → 34 | 52.6 → 37.1 |
| joepye | - → 54 | MBG 4-5 ft | 72 → 50 | 77.1 → 54.9 |
| babyjoe | - → 30 | MBG 2-3 ft | 30 → 30 | 30.9 → 30.9 |
| narrowleafironweed | - → 30 | Easyscape 2-3 ft; nurseries 3 ft | 34 → 29 | 34.9 → 29.7 |
| narrowleafironweed:ironbutterfly | - → 30 | MBG 2-3 ft | 28 → 28 | 29.1 → 29.1 |
| swansongironweed | 36 → 36 | kept | 44 → 35 | 45.7 → 36.6 |
| stachys | - → 21 | MBG 1.5-2 ft | 24 → 21 | 24 → 21.1 |
| betony | - → 21 | MBG (Stachys officinalis) 1.5-2 ft | 26 → 20 | 26.9 → 20.6 |
| penstemon | - → 42 | MBG 3-5 ft | 38 → 45 | 35.4 → 41.1 |
| penstemon:huskersred | - → 30 | MBG 2-3 ft | (inh.) → 32 | 35.4 → 29.7 |
| penstemon:darktowers | - → 27 | MBG 1.5-3 ft | (inh.) → 29 | 35.4 → 27.4 |
| largebeardtongue | - → 36 | MBG 2-4 ft | 42 → 39 | 38.9 → 35.4 |
| prairiemilkweed | 36 → 36 | kept | 42 → 37 | 40.6 → 36 |
| commonmilkweed | 42 → 42 | kept | 54 → 44 | 51.4 → 42.3 |
| liatris | 18 → 18 | kept | 32 → 18 | 31.4 → 18.3 |
| liatrispycnostachya | 48 → 48 | kept | 72 → 44 | 78.3 → 48.6 |
| liatriscylindracea | 18 → 18 | kept | 26 → 18 | 26.3 → 18.9 |
| liatrisspicata | - → 36 | MBG 2-4 ft | 48 → 40 | 43.4 → 36.6 |
| liatrisspicata:kobold | 20 → 20 | kept | 20 → 18 | 22.3 → 20 |
| goldenrod | - → 30 | MBG 2-3 ft | 50 → 33 | 45.1 → 30.3 |
| roughgoldenrod | - → 48 | MBG 3-5 ft | 54 → 54 | 48.6 → 48.6 |
| roughgoldenrod:fireworks | - → 39 | MBG 3-3.5 ft | 42 → 42 | 37.1 → 37.1 |
| autumnGoldenrod | - → 36 | Wikipedia to 120 cm; NC State 1-6 ft | 36 → 41 | 32 → 36.6 |
| meadowsage | - → 27 | MBG 1.5-3 ft | 34 → 27 | 33.7 → 26.9 |
| meadowsage:caradonna | - → 18 | MBG 1-2 ft | 38 → 18 | 37.7 → 18.3 |
| meadowsage:maynight | - → 21 | MBG 1.5-2 ft | (inh.) → 21 | 33.7 → 21.1 |
| meadowsage:bluehill | - → 21 | MBG 1.5-2 ft | (inh.) → 21 | 33.7 → 21.1 |
| meadowsage:amethyst | - → 30 | Plantlust 12-30 in; RHS Plants 1 m | (inh.) → 30 | 33.7 → 29.7 |
| echinops | - → 42 | MBG 3-4 ft | 46 → 41 | 46.9 → 42.3 |
| echinops:veitchsblue | - → 39 | MBG 3-3.5 ft | (inh.) → (inh.) | 46.9 → 42.3 |
| calamint | 15 → 15 | kept | 16 → 14 | 17.1 → 16 |
| agastache | - → 36 | MBG 2-4 ft | 48 → 38 | 45.1 → 36.6 |
| agastache:bluefortune | - → 30 | MBG 2-3 ft | 44 → 32 | 41.7 → 30.9 |
| agastache:goldenjubilee | - → 30 | MBG 2-3 ft | (inh.) → 32 | 45.1 → 30.9 |
| catmint | - → 18 | MBG 1-2 ft | 26 → 18 | 25.7 → 18.3 |
| catmint:walkerslow | - → 27 | MBG 2-2.5 ft | 30 → 27 | 29.7 → 26.3 |
| catmint:sixhills | - → 30 | MBG 2-3 ft | 34 → 31 | 33.1 → 30.3 |
| catmint:catspajamas | - → 14 | MBG 12-15 in | 18 → 14 | 18.3 → 14.9 |
| scabiosa | - → 24 | Boston Seeds 60-70 cm wild; garden plants shorter | 24 → 21 | 26.9 → 24 |
| scabiosa:butterflyblue | - → 15 | MBG 1-1.5 ft | (inh.) → 13 | 26.9 → 16 |
| scabiosa:pinkmist | - → 15 | MBG 1-1.5 ft | (inh.) → 13 | 26.9 → 16 |
| scabiosa:mariposablue | - → 16 | Roger's Gardens 18 in; Grasslands 25-35 cm | 20 → 14 | 22.9 → 17.1 |
| knautia | - → 21 | MBG 1.5-2 ft | 24 → 19 | 26.9 → 21.7 |
| knautia:marsmidget | - → 15 | MBG 1-1.5 ft | 14 → 14 | 16.6 → 16.6 |
| cirsiumatropurpureum | - → 48 | RHS 1-1.5 m | 54 → 44 | 58.3 → 48 |
| riverthistle | - → 48 | RHS ('Atropurpureum') 1-1.5 m | 48 → 44 | 52 → 47.4 |
| euphorbiawulfenii | 48 → 48 | kept | 44 → 54 | 39.4 → 48.6 |
| euphorbiawulfenii:lambrookgold | - → 44 | RHS 1-1.5 m; Plant Delights 40 in; Hardy's 120 cm | (inh.) → 49 | 39.4 → 44 |
| cushionspurge | 18 → 18 | kept | 18 → 15 | 22.3 → 18.9 |
| lavender | 24 → 24 | kept | 24 → 27 | 21.1 → 23.4 |
| lavender:munstead | 20 → 20 | kept | 20 → 23 | 17.7 → 20 |
| carthusianpink | 24 → 24 | kept | 24 → 22 | 26.3 → 24.6 |
| devilsbitscabious | 30 → 30 | kept | 30 → 27 | 33.1 → 29.7 |
| perennialcornflower | 20 → 20 | kept | 20 → 17 | 22.9 → 20 |
| oxeyedaisy | 24 → 24 | kept | 26 → 21 | 29.1 → 23.4 |
| candytuft | 10 → 10 | kept | 10 → 6 | 15.4 → 11.4 |
| aubrieta | 6 → 6 | kept | 8 → 8 (kept) | 8.6 → 8.6 |
| helenium | - → 48 | MBG 3-5 ft | 48 → 48 | 50.9 → 50.9 |
| helenium:moerheim | - → 30 | MBG 2-3 ft | (inh.) → 28 | 50.9 → 30.3 |
| helenium:sahinsearlyflowerer | - → 36 | RHS 0.5-1 m | 42 → 34 | 44 → 36 |
| helenium:rubinzwerg | 30 → 30 | kept | 34 → 28 | 36.6 → 30.3 |
| rudbeckia | - → 30 | MBG 2-3 ft | 38 → 28 | 40.6 → 30.3 |
| rudbeckia:americangoldrush | - → 21 | MBG 1.5-2 ft | 30 → 19 | 32.6 → 20.6 |
| rudbeckiatriloba | 36 → 36 | kept | 44 → 34 | 46.9 → 37.1 |
| rudbeckiatriloba:prairieglow | 42 → 42 | kept | 48 → 40 | 50.9 → 42.9 |
| falsesunflower | 48 → 48 | kept | 54 → 47 | 54.9 → 47.4 |
| falsesunflower:burninghearts | 42 → 42 | kept | 46 → 41 | 46.9 → 41.7 |
| falsesunflower:lorainesunshine | 32 → 32 | kept | 36 → 31 | 36.6 → 31.4 |
| sanguisorba | - → 54 | Prairie Moon 2-6 ft; most nurseries 4-5 ft | 56 → 49 | 61.7 → 54.3 |
| greatburnet | - → 33 | MBG 2.5-3 ft | 42 → 30 | 45.7 → 33.1 |
| greatburnet:tanna | - → 16 | RHS 0.1-0.5 m | 28 → 14 | 30.9 → 16.6 |
| greatburnet:redthunder | - → 42 | Gardenia 3-4 ft; Tesselaar 40-90 cm | 48 → 39 | 51.4 → 42.3 |
| lilacsquirrel | - → 36 | Hardy's 80 cm; GardenTags 60-90 cm; RHS 1-1.5 m | 42 → 32 | 48 → 37.7 |
| menziesburnet | - → 30 | Hardy's 60 cm; NVK 75-85 cm; RHS 0.5-1 m | 36 → 26 | 41.1 → 31.4 |
| coreopsis | - → 33 | MBG 2.5-3 ft | 28 → 28 | 30.9 → 30.9 |
| coreopsis:moonbeam | - → 21 | MBG 1.5-2 ft | (inh.) → 19 | 30.9 → 21.7 |
| coreopsis:zagreb | - → 15 | MBG 1-1.5 ft | (inh.) → 14 | 30.9 → 16.6 |
| lanceleaf | 24 → 24 | kept | 30 → 23 | 30.9 → 24 |
| bigflowertickseed | - → 24 | MBG 1.5-2.5 ft | 26 → 22 | 28.6 → 24.6 |
| bigflowertickseed:earlysunrise | - → 21 | MBG 1.5-2 ft | 22 → 18 | 25.1 → 21.1 |
| bigflowertickseed:sunray | - → 21 | MBG 1.5-2 ft | 24 → 19 | 26.9 → 21.7 |
| willowsunflower | 72 → 72 | kept | 80 → 70 | 82.3 → 72.6 |
| maximiliansunflower | 72 → 72 | kept | 76 → 68 | 80 → 71.4 |
| sawtoothsunflower | 96 → 96 | kept | 84 → 93 | 86.3 → 95.4 |
| spiderwort | - → 30 | MBG 2-3 ft | 34 → 28 | 36.6 → 30.3 |
| prairiespiderwort | - → 15 | MBG 1-1.5 ft | 20 → 14 | 21.7 → 16 |
| blueeyedgrass | - → 9 | MBG 0.5-1 ft | 12 → 8 | 13.7 → 9.7 |
| narrowblueeyedgrass | - → 18 | MBG 1.5-2 ft | 14 → 14 | 16 → 16 |
| blueflagiris | - → 24 | MBG 1-3 ft | 34 → 25 | 32.6 → 24.6 |
| northernblueflag | - → 27 | MBG 2-2.5 ft | 30 → 30 | 25.7 → 25.7 |
| germaniris | - → 30 | MBG 2-3 ft | 32 → 32 | 32 → 32 |
| siberianiris | - → 30 | Illinois Extension 1-3 ft; RHS cultivars 0.5-1 m | 34 → 34 | 30.9 → 30.9 |
| siberianiris:caesarsbrother | - → 40 | MBG 3-4 ft; Walters 36-42 in | (inh.) → 44 | 30.9 → 39.4 |
| goldenalexander | 24 → 24 | kept | 28 → 23 | 29.1 → 24 |
| pussytoes | - → 9 | MBG 0.5-1 ft | 8 → 8 | 10.9 → 10.9 |
| prairiedock | 96 → 96 | kept | 84 → 95 | 84.6 → 94.9 |
| poppymallow | - → 9 | MBG 0.5-1 ft | 12 → 12 | 10.3 → 10.3 |
| mossphlox | - → 5 | MBG 0.25-0.5 ft | 8 → 8 (kept) | 8.6 → 8.6 |
| gaura | - → 48 | MBG 3-5 ft | 36 → 44 | 39.4 → 48 |
| pasqueflower | - → 8 | MBG 3-12 in | 10 → 7 | 12 → 8.6 |
| filipendula | - → 84 | MBG 6-8 ft | 60 → 76 | 66.3 → 82.9 |
| sanguineumgeranium | - → 13 | MBG 0.75-1.5 ft | 12 → 15 | 10.3 → 12.6 |
| sanguineumgeranium:maxfrei | - → 8 | MBG 0.5-0.75 ft | 8 → 8 | 8 → 8 |
| silvermound | - → 10 | Proven Winners 6-12 in; most nurseries 12 in | 12 → 9 | 13.7 → 10.9 |
| broadleafwormwood | - → 30 | MBG (A. ludoviciana) 2-3 ft | 30 → 25 | 35.4 → 30.3 |
| rozanne | - → 15 | MBG 1-1.5 ft | 22 → 17 | 19.4 → 15.4 |
| peony | - → 30 | MBG 1.5-2.5 ft; its cultivars 2.5-3 ft | 36 → 28 | 38.9 → 30.9 |
| daylily:stelladeoro | - → 11 | MBG 0.75-1 ft | 12 → 10 | 13.7 → 12 |
| daylily:happyreturns | - → 15 | MBG 1-1.5 ft | 18 → 14 | 19.4 → 16 |
| russiansage | - → 48 | MBG (Perovskia atriplicifolia) 3-5 ft | 42 → 46 | 44 → 48 |
| russiansage:bluespire | - → 30 | MBG (Perovskia 'Blue Spire') 2-3 ft | 46 → 29 | 48 → 30.9 |
| russiansage:littlespire | - → 21 | MBG 1.5-2 ft | 24 → 20 | 25.7 → 21.7 |
| shastadaisy | - → 30 | MBG 2-3 ft | 40 → 28 | 42.3 → 30.3 |
| shastadaisy:becky | - → 42 | MBG 3-4 ft | 42 → 42 | 44.6 → 44.6 |
| shastadaisy:bananacream | - → 15 | MBG 1-1.5 ft | 18 → 13 | 21.1 → 16 |
| obedientplant | - → 42 | MBG 3-4 ft | 42 → 42 | 39.4 → 39.4 |
| obedientplant:missmanners | - → 27 | MBG 2-2.5 ft | 28 → 28 | 26.9 → 26.9 |
| obedientplant:pinkmanners | - → 30 | MBG 2-3 ft | 34 → 31 | 32.6 → 29.1 |
| grayheadedconeflower | 48 → 48 | kept | 54 → 45 | 57.7 → 48.6 |
| jerusalemsage | - → 30 | MBG 2-3 ft | 42 → 28 | 45.7 → 31.4 |
| lambsear | - → 13 | MBG 0.75-1.5 ft | 15 → 9 | 20.6 → 13.1 |
| lambsear:bigears | - → 9 | MBG 0.5-1 ft | 10 → 8 | 12 → 9.1 |
| lambsear:silvercarpet | - → 5 | MBG 0.25-0.5 ft | 8 → 4 | 12.6 → 6.3 |
| redhotpoker | - → 42 | MBG (Kniphofia uvaria) 3-4 ft | 39 → 43 | 37.7 → 41.7 |
| redhotpoker:royalstandard | - → 42 | MBG 3-4 ft | 36 → 43 | 35.4 → 41.7 |
| redhotpoker:alcazar | - → 30 | Cotswold Garden Flowers 75 cm | 30 → 30 | 29.7 → 29.7 |
| redhotpoker:timothy | - → 36 | RHS to 1 m | 36 → 36 | 35.4 → 35.4 |
| redhotpoker:percyspride | - → 44 | RHS to 1.2 m | 44 → 44 | 42.9 → 42.9 |
| redhotpoker:icequeen | - → 54 | RHS to 1.5 m | 54 → 54 | 52.6 → 52.6 |
| redhotpoker:tawnyking | - → 44 | RHS to 1.2 m | 44 → 44 | 42.9 → 42.9 |
| redhotpoker:toffeenosed | - → 44 | RHS to 1.2 m | 44 → 44 | 42.9 → 42.9 |
| redhotpoker:littlemaid | - → 24 | RHS to 60 cm | 24 → 24 | 24.6 → 24.6 |
| redhotpoker:papayapopsicle | - → 18 | Walters Gardens 18 in | 18 → 18 | 18.9 → 18.9 |
| orientalpoppy | - → 30 | Illinois Extension 2-3 ft | 36 → 28 | 38.3 → 30.3 |
| orientalpoppy:beautyoflivermere | - → 30 | MBG 2-3 ft | 40 → 28 | 42.3 → 30.3 |
| orientalpoppy:pattysplum | - → 27 | MBG 2-2.5 ft | 32 → 25 | 34.3 → 28 |
| delphinium | - → 54 | MBG (D. elatum) 3-5 ft; Ball (Pacific Giants) 54-72 in | 66 → 56 | 64 → 54.3 |
| delphinium:blackknight | - → 60 | Ball 54-72 in; nurseries 4-6 ft | 66 → 66 | 64 → 64 |
| delphinium:bluebird | - → 60 | Ball 54-72 in; RHS 1.5-2.5 m | 66 → 66 | 64 → 64 |
| spikespeedwell | - → 30 | MBG 2-3 ft | 27 → 32 | 25.1 → 29.7 |
| spikespeedwell:glory | - → 11 | MBG 9-12 in | 12 → 12 | 11.4 → 11.4 |
| spikespeedwell:icicle | - → 21 | MBG 1.5-2 ft | 24 → 24 | 22.3 → 22.3 |
| spikespeedwell:rotfuchs | - → 15 | MBG 1-1.5 ft | 15 → 15 | 14.3 → 14.3 |
| blanketflower | - → 24 | MBG 1-3 ft | 24 → 21 | 26.9 → 24 |
| arizonasun | - → 9 | MBG 0.5-1 ft | 10 → 7 | 13.1 → 9.7 |
| noddingonion | - → 15 | MBG 1-1.5 ft | 30 → 15 | 30.9 → 16 |
| prairieonion | - → 15 | MBG 1-1.5 ft | 32 → 15 | 33.1 → 16.6 |
| swamprosemallow:lordbaltimore | 54 → 54 | kept | 54 → 50 | 58.9 → 54.9 |
| swamprosemallow:lunawhite | 30 → 30 | kept | 30 → 26 | 34.3 → 30.3 |
| purplepitcherplant | 16 → 16 | kept | 20 → 16 | 20.6 → 16.6 |
| marshspurge | 36 → 36 | kept | 36 → 33 | 38.9 → 36 |
| blackfootdaisy | 10 → 10 | kept | 14 → 8 | 16.6 → 10.3 |
| desertmarigold | 16 → 16 | kept | 16 → 14 | 18.3 → 16.6 |
| chocolateflower | 18 → 18 | kept | 18 → 15 | 21.7 → 18.3 |
| antelopehorns | 18 → 18 | kept | 18 → 21 | 15.4 → 17.7 |
| greggmistflower | 18 → 18 | kept | 20 → 16 | 22.9 → 18.9 |
| mealycupsage | 30 → 30 | kept | 34 → 30 | 33.7 → 30.3 |
| pitchersage | 48 → 48 | kept | 52 → 48 | 52 → 48 |
| desertglobemallow | 36 → 36 | kept | 30 → 33 | 33.1 → 36 |
| scarletglobemallow | 10 → 10 | kept | 14 → 8 | 16.6 → 9.7 |
| prairieverbena | 10 → 10 | kept | 12 → 9 | 13.7 → 10.9 |
| prairiezinnia | 8 → 8 | kept | 10 → 7 | 12 → 8.6 |
| desertzinnia | 8 → 8 | kept | 9 → 7 | 10.9 → 8.6 |
| tuftedprimrose | 8 → 8 | kept | 10 → 7 | 12 → 8.6 |
| berlandiersundrops | 12 → 12 | kept | 12 → 10 | 14.3 → 12 |
| mexicanhat | 24 → 24 | kept | 30 → 21 | 34.9 → 25.7 |
| engelmanndaisy | 24 → 24 | kept | 30 → 22 | 33.1 → 25.1 |
| eatonpenstemon | 36 → 36 | kept | 36 → 39 | 33.1 → 36 |
| pineleafpenstemon | 12 → 12 | kept | 16 → 12 | 15.4 → 12 |
| californiafuchsia | 24 → 24 | kept | 24 → 28 | 20.6 → 23.4 |
| foothillpenstemon | 36 → 36 | kept | 26 → 37 | 25.1 → 34.9 |
| seasidedaisy | 12 → 12 | kept | 12 → 10 | 14.3 → 12.6 |
| beachsunflower | 18 → 18 | kept | 18 → 22 | 14.9 → 17.1 |
| wildstrawberry | 8 → 8 | kept | 12 → 9 | 10.3 → 8.6 |
| whitewoodaster | - → 21 | MBG (Eurybia divaricata) 1-2.5 ft | 30 → 20 | 32 → 21 |
