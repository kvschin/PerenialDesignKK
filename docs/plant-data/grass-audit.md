# Grass audit

Audited November 7, 2026, against the catalog at 0.9.87: 40 records in the Grasses category, with
45 cultivars. The data fixes, bugs and snow shipped in 0.9.88. A crown for every grass, the rebuilt forms
and the missing species are still open, in the order at the end.

`dev/grass-review.html` is the page used for all of it. It shows every grass in four seasons, as a
drift, and at true scale beside a 6 ft post. It takes `?base`, `?form=vertgrass`, `?only=`, `?check`
and `?bench=1`.

## Sources

- **[Chicago Botanic Garden, Plant Evaluation Notes 43](https://www.chicagobotanic.org/plant-evaluation/hardy-ornamental-grasses)**
  (Hawke, 2018) is the best single source: 109 taxa over 2006-2017, with star ratings, leaf and fall
  colour, bloom period and height and width in inches, with Miscanthus left unrated on purpose. It stands
  to the grasses as the Mt. Cuba trial stands to the sedges. It is one site near Chicago, on clay loam, and
  its plants run large.
- **[Hoffman Nursery's catalog](https://hoffmannursery.com/plants)**: zone, warm or cool season,
  moisture, light, height without and with bloom, and bloom season for every plant. Read through the
  browser pane; it refuses a plain fetch. Height without bloom is the figure nothing else gives.
- Lists counted for missing species (21):
  [Epic Gardening, native](https://www.epicgardening.com/native-ornamental-grasses/) and
  [shade](https://www.epicgardening.com/?p=229514),
  [K-State](https://www.k-state.edu/turf/resources/ornamental-grasses/native/),
  [NC Extension, Henderson County](https://henderson.ces.ncsu.edu/news/list-of-native-grasses/),
  [UGA B987-4](https://secure.caes.uga.edu/extension/publications/files/html/B987-4/Grass-Sedge-Selection-Guide.pdf),
  [Minnesota, shade](https://extension.umn.edu/landscape-design/ornamental-grasses-shady-sites) and
  [native poster](https://grasses.cfans.umn.edu/sites/grasses.umn.edu/files/files/native-grass-poster.pdf),
  [Wisconsin](https://hort.extension.wisc.edu/files/2022/02/Ornamental-Grasses-in-the-Landscape-Kiss-My-Grass-Handout.pdf),
  [UF Gardening Solutions](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/native-grasses/),
  [UF Miami-Dade](https://sfyl.ifas.ufl.edu/miami-dade/landscapes--gardening/ornamental-grasses/),
  [UC Sonoma](https://www.ucanr.edu/site/mg-sonoma/native-grasses),
  [CNPS Santa Clara](https://www.cnps-scv.org/images/handouts/Grasses.pdf),
  [California Native Plants](https://californianativeplants.com/blog/native-grasses),
  [Hoffman](https://hoffmannursery.com/plants), [Izel](https://www.izelplants.com/native-grasses/ornamental-grasses/),
  [Knoll Gardens](https://www.knollgardens.co.uk/planting-area/sun-baked-and-dry/),
  [Gardeners' World](https://www.gardenersworld.com/how-to/grow-plants/20-of-the-best-ornamental-grasses/),
  [Wikipedia](https://en.wikipedia.org/wiki/Ornamental_grass),
  [Alaster Anderson](https://alaster-anderson-website.squarespace.com/planting-notes/ornamental-grasses),
  [Gardening Gone Wild](https://gardeninggonewild.com/?p=7901) and
  [Garden Oracle](https://gardenoracle.com/grass.html).
- **[NVK Nurseries](https://www.nvknurseries.com/plant/Panicum-virgatum-Dallas-Blues)** gives height, spread, bloom time and
  warm or cool season on one line for most plants, and answers a plain fetch. It settled the size conflicts below.
- Invasive status comes from the repo's Cal-IPC and EASIN snapshots (`dev/invasive-lists/`).
- **Could not be read:** Oklahoma's fact sheet, Prairie Moon, Prairie Nursery, RHS lists, High Country
  Gardens. Only two of Knoll's planting areas were read, so European shade grasses are undercounted, and
  no German or Dutch nursery was read. The European half of the missing list is the weaker half.

## Where the catalog stands

| Measure | Count |
| --- | --- |
| Straight species native to North America / Europe / Asia | 24 / 8 / 5 |
| Moisture: dry / medium / moist | 20 / 18 / 2 |
| Light: full / part | 34 / 6 |
| Species per zone, 3 to 10 | 9, 23, 30, 35, 37, 40, 31, 7 |
| Species with a sourced `heightIn` | All 40; 44 of 45 cultivars, the last inheriting its species' |
| Species with no bloom months | None |

The gaps are wet ground, shade, zone 10 and Europe. Nothing here is grown for a wet site, and only six
grasses take any shade, in a planting style that leans on grasses as its matrix.

## Missing species

The count is how many of the 21 lists name the plant. Facts are Hoffman's unless noted.

### Add first

| Plant | Lists | Why | Facts |
| --- | --- | --- | --- |
| **Bottlebrush Grass**, *Elymus hystrix* | 9 | The most-named grass missing, and the native woodland grass the tab lacks | z4-9, cool, part sun to shade, 3 ft, 4 ft in flower |
| **Giant Sacaton**, *Sporobolus wrightii* | 5 | Big Southwest fountain, and a native answer where Miscanthus is hidden | z5-9, warm, dry to wet, 4-5 ft, 6-7 ft in flower. 'Windbreaker' rated 4 stars in Chicago |
| **California Fescue**, *Festuca californica* | 5 | Evergreen West Coast grass for sun to part shade | [UC Sonoma](https://www.ucanr.edu/site/mg-sonoma/native-grasses): 2-3 ft by 1-2 ft |
| **Eastern Gamagrass**, *Tripsacum dactyloides* | 5 | Only its dwarf relative is here, and that record's synonym hid the gap from a name match | [UGA](https://secure.caes.uga.edu/extension/publications/files/html/B987-4/Grass-Sedge-Selection-Guide.pdf): 4-8 ft |
| **Ruby Muhly**, *Muhlenbergia reverchonii* | 4 | A pink cloud at half the height of Pink Muhly. 'Undaunted' is the form sold | z5-10, warm, 1.5 ft, 2-2.5 ft in flower |
| **Wavy Hairgrass**, *Deschampsia flexuosa* | 4 | Dry shade | z4-7, cool, sun to shade, 1.5 ft, 2 ft in flower |
| **Bushy Bluestem**, *Andropogon glomeratus* | 4 | Wet ground in sun | z5-9, warm, average to wet, 4 ft, 6 ft in flower |
| **Sand Cordgrass**, *Spartina bakeri* | 4 | Wet Florida sun | z6-9, warm, dry to wet, 5 ft. [UF](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/native-grasses/) says 3-4 ft |
| **Wiregrass**, *Aristida stricta* | 4 | The groundcover of southern pine savanna | z8-10, 1-3 ft |
| **Prairie Cordgrass**, *Spartina pectinata* | 3 | Wet prairie; nothing tall stands in wet ground here | Not yet read |
| **Canada Wild Rye**, *Elymus canadensis* | 3 | Nodding prairie heads, and cool season where most prairie grasses are warm | Not yet read |
| **Beak Grass**, *Diarrhena americana* | Trial | Full shade, 4 stars in Chicago, though few lists name it | 36 by 40 in |

### Worth adding next

| Plant | Lists | Note |
| --- | --- | --- |
| Broomsedge, *Andropogon virginicus* | 5 | Rated 2 stars in Chicago, and on the EU list of Union concern, so hide it in Europe. It earns its place by its orange winter colour in poor ground |
| Melic, *Melica imperfecta* | 4 | California. CNPS: to 44 in, generally 24-30 in |
| Splitbeard Bluestem, *Andropogon ternarius* | 3 | z6-9. Did not flower in Chicago, 2 stars, which is the zone edge. Add 'Black Mountain' with it |
| Idaho Fescue, *Festuca idahoensis* | 3 | The Interior West. A synonym on Roemer's Fescue hid this one too |
| Coastal Panicgrass, *Panicum amarum* | 3 | Powder blue, 78 by 80 in in Chicago, 3 stars. Coastal, where the tab has little |
| Giant Wild Rye, *Leymus condensatus* | 3 | California. 'Canyon Prince' is the form sold |
| Blue Lyme Grass, *Leymus arenarius* | 2 | z4-9, runs hard. Native to northern Europe |
| Purpletop, *Tridens flavus* | 2 | Eastern meadows |
| Sea Oats, *Uniola paniculata* | 2 | Dunes. Wild plants are protected in Florida, as I recall it; read that before writing the note |
| Mendocino Reed Grass, *Calamagrostis foliosa* | 2 | California coast |
| Slender Wood Oats, *Chasmanthium laxum* | 1 | z4-9, part sun to shade. It belongs in the shade gap more than its count suggests |
| American Beachgrass, *Ammophila breviligulata* | 1 | The native choice. Cal-IPC rates *A. arenaria* High, so do not add that one |

### Europe and design grasses

These are named by few of the lists read, because few European lists could be read. They are in common use
by designers, so read them on their own terms rather than by count.

| Plant | Evidence |
| --- | --- |
| *Stipa calamagrostis* (*Achnatherum calamagrostis*) | [Knoll](https://www.knollgardens.co.uk/planting-area/sun-baked-and-dry/), [RHS](https://www.rhs.org.uk/Plants/63571/Stipa-calamagrostis/Details) |
| *Sesleria nitida*, *S. argentea*, *S.* 'Greenlee Hybrid' | Knoll; Hoffman for 'Greenlee Hybrid' (z5-9). A real matrix grass, as sedges are |
| *Milium effusum* 'Aureum' | Gardeners' World, Minnesota. Gold for shade |
| *Anemanthele lessoniana* | Gardeners' World, Knoll. New Zealand |
| *Festuca amethystina*, *Melica ciliata* | Knoll for the *Festuca*. For the *Melica*, a search result quoting Tom Stuart-Smith's Hampton Court list, whose PDF did not load |
| *Ampelodesmos mauritanicus*, *Poa labillardierei* | Knoll. Mediterranean and Australian |

### Decide before adding

| Plant | Lists | The problem |
| --- | --- | --- |
| **Pampas Grass**, *Cortaderia selloana* | 6 | The most-named plant here after Bottlebrush Grass, and rated High by Cal-IPC. Gardeners will search for it, and the caution is a useful answer, so I lean toward adding it and letting the filter hide it in North America. The EU lists subsp. *jubata* |
| **Buffalograss**, *Bouteloua dactyloides* | 5 | Grown as a lawn, 6-8 in. It could be a plant record or a surface in `LAWN_STYLES`. I lean toward the surface |
| ***Miscanthus × giganteus*** | 2 | No viable seed in Chicago's trial, so it may be the Miscanthus to offer. It also stands 10-12 ft and spreads by rhizome |

### Left out on purpose

*Arundo donax* (Cal-IPC High), *Imperata cylindrica* (3 lists; its US federal status still needs a read),
*Cenchrus setaceus* (Cal-IPC Moderate, EU Union concern), *Saccharum ravennae* (Cal-IPC Moderate),
*Festuca arundinacea* (Cal-IPC Moderate), and annual or short-lived grasses such as *Briza maxima* and
*Hordeum jubatum*, since the catalog holds perennials.

## Missing cultivars

| Species | Add | Evidence |
| --- | --- | --- |
| Blue Grama | **'Blonde Ambition'**, the one to do first. No Blue Grama cultivar is here | Hoffman, Izel. 36 by 42 in, 4 stars |
| Purple Moor Grass | 'Skyracer', 'Heidebraut', 'Poul Petersen', 'Windspiel', 'Cordoba' | All 5 stars in Chicago, where this genus took 11 of the 22 five-star ratings. The catalog has 'Transparent' and 'Moorhexe' |
| Indiangrass | 'Sioux Blue' | [Mississippi State trial](https://blogs.extension.msstate.edu/ornamentals/plant/tri17176/), Monrovia |
| Feather Reed | 'Avalanche', 'Eldorado' | Hoffman, Knoll |
| Switchgrass | 'Rotstrahlbusch', 'Thundercloud', 'Cape Breeze' | Hoffman, Izel. Widely sold, though the first two rated only fair in Chicago |
| Little Bluestem | 'Blaze', 'Twilight Zone', 'Blue Heaven' | Hoffman, Izel. 'Blaze' and 'Blue Heaven' rated fair in Chicago |
| Fountain Grass | 'Desert Plains' (5 stars), 'Piglet' | Chicago, Hoffman |

## Shipped in 0.9.88

Step 1 of the proposed order: everything that needed no design decision.

### Data

| Record | Change | Evidence |
| --- | --- | --- |
| Alkali Sacaton | Blooms June-September, not April-May. Spring colour moved to Summer | [FEIS](https://www.fs.usda.gov/database/feis/plants/graminoid/spoair/all.html) gives April-May for the Southwest only and June-October on the Great Plains; [Wildflower Center](https://www.wildflower.org/plants/result.php?id_plant=spai) June-November. The record runs z4-10 |
| Giant Feather Grass | `phen` warm to cool | [RHS](https://www.rhs.org.uk/plants/17802/stipa-gigantea/details): evergreen. [NVK](https://www.nvknurseries.com/plant/Stipa-gigantea): cold season |
| Mexican Feather Grass | `phen` warm to cool | Hoffman |
| Japanese Forest Grass | `phen` cool to warm | [NVK](https://www.nvknurseries.com/plant/Hakonechloa-macra): warm season. One nursery, so the weakest row |
| Purple Moor Grass, three records | All `phen:'mid'`. 'Transparent' was warm and the other two cool | Chicago and NVK say cool, Hoffman says warm for 'Skyracer'. No other grass uses `mid`; it wakes later than a true cool-season grass, which is what the split reflects |
| Northern Sea Oats | `h` 54 to 40, so it draws 3.7 ft, not 5. `heightIn` 36 to 42, z3-8 to z4-9 | [NVK](https://www.nvknurseries.com/plant/Chasmanthium-latifolium): 30-35 in, z4. Hoffman: 4 ft in flower, z5-10. K-State: z4-9 |
| 'Moorhexe' | `h` 18 to 36, `heightIn` 20 to 36, spread 18 to 28 in | [NVK](https://www.nvknurseries.com/plant/Molinia-caerulea-Moorhexe): 50-90 cm by 75-80 cm. [RHS Plants](https://rhsplants.co.uk/plants/_/molinia-caerulea-moorhexe/classid.2000033556): spread 0.7 m. Trade listings: 90 cm in flower, 50 cm in leaf. The old figure was the leaf alone |
| Purple Moor Grass | `h` and `heightIn` 30 to 36 | NVK 16-28 in, Chicago 45 in |
| 'Red Head', 'Karley Rose' | Spread to 42 in, from 36 and 30 | NVK: 35-47 in. Heights stay, since Hoffman agrees with them |
| 'Karl Foerster', 'Overdam', Indiangrass | `foliageHeight` 0.4, 0.36, 0.45, more blades and culms to match | Hoffman: 2 ft under 6 ft, 1.5 ft under 5 ft, 2 ft under 6 ft. Indiangrass sits above that ratio by judgement, since its culms are leafy partway up |
| 'Overdam' | Spring and Summer `fol` greener, stripe wider, so it no longer reads as straw | Chicago: green with cream margins |
| 7 species | Bloom months, and a `bloom` colour for them | In `docs/plant-work-log.md`. The colours are judgement, not sourced |
| 12 species, 43 cultivars | `heightIn` | Every figure and its source is in `docs/plant-work-log.md`. One is unsourced: 'Nicolas' |
| Miscanthus caution | A second note, from Chicago | Naturalized in 25 states, DC and Ontario, on the invasive lists of Illinois, Alabama, Connecticut and Georgia, with viable seed from most of 34 taxa. Chicago declined to rate any of them |

The Miscanthus seed counts are one year at one site, in 2010, so zero is not proof of sterility: 'Cabaret',
'Hinjo' and 'Silberpfeil' set none that year, against 203,699 for 'Malepartus' and 6,103 for 'Gracillimus'.

### Drawing

- **Snow lands on the plant.** All nine grass forms record their heads and arches (`grassSnowOn`), where they
  had the scatter that hung white ovals in the air. Slender Sweet Flag shares the `bunchgrass` form and gains this too.
- **Mexican Feather Grass no longer clips its sprite.** It touched the edge in 9 of 9 full-growth sprites in Summer,
  Fall and Winter, so a dense garden cut its sides off. 2,040 sprites now sweep clean. Purple Needlegrass, whose reach
  works out to just past its box though the sweep never caught it, declares its reach too.
- **Japanese Forest Grass has a Winter colour.** Its slot was empty and it drew in `shade(undefined)`'s fallback mud.
- **Its flower stalks stand only in July-September.** A Summer `seed` showed them from the first day of Summer.
- **Culms take part of their colour from the head,** so 'Karl Foerster' no longer looks like plumes over nothing on a
  green lawn. `culmW` widens a culm.
- **Six grasses moved to `panicle:'mist'`,** three depth tones instead of a lit floret per speck: Switchgrass, Prairie
  Dropseed, Sand Lovegrass, Elliott's Lovegrass, Alkali Sacaton and 'Goldtau'. Switchgrass also has smaller specks in a
  wider cloud, which helps the lollipop without curing it.
- **Blue Fescue shows flower stalks in May and June.** It had `seedStems:0` and never drew a flower.
- **A stray `flowerStyle==='radial'` block is gone from `fountaingrass`.** It read `bx` and `by` from a loop it was not in.

### Checked and left alone

- **'Dallas Blues' and 'Heavy Metal' keep their spread.** The audit first listed them as too narrow, on Chicago's 100 and
  56 in. [NVK](https://www.nvknurseries.com/plant/Panicum-virgatum-Dallas-Blues) gives 70-100 and 50-80 cm, which agrees
  with the catalog. Chicago's width takes in the flower spray, so it does not measure what `spread` means here. The same
  goes for Purple Moor Grass's 24 in, where NVK gives 60-70 cm against Chicago's 50 in.
- **Sizes from Chicago were not used alone.** Most cultivars already match it ('Carousel', 'Jazz', 'Blackhawks', 'Shenandoah'
  and 'Tara' to the inch), and where it stood apart a second source usually sided with the catalog.
- **Slender Indiangrass stays z4-9.** It looks too cold for a southeastern grass, but [NC State](https://plants.ces.ncsu.edu/plants/sorghastrum-elliottii/)
  gives 4a-9b.

### Made worse until step 3

'Moorhexe' and Purple Moor Grass are now the right height, so the hyacinth they draw as is a bigger hyacinth. Their
form is rebuilt in step 3.

## How they look

Measured on 0.9.87, before any of the above, in the real renderer at full growth, in Fall, on a neutral grey backdrop with the cast shadow gated
out, over four seeds each. "Width" is drawn width over stated spread, where about 0.7 would be a true
proportion, because ground and height use different scales here. "Drift" is how much of the middle ground is
covered in a 5 by 5 block with one clump per tile, in Summer. The last two columns are my reading of the
pictures, not a measurement.

| Grass | Crown at ground, in | Width | Drift % | Draws as | Should read as |
| --- | --- | --- | --- | --- | --- |
| Blue Moor Grass | 2 | 0.25 | 10 | A speck with a bead spike | A dense low tuffet |
| Blue Fescue | 3 | 0.78 | 13 | A small flat star | A tight blue hemisphere |
| Autumn Moor Grass | 2 | 0.59 | 15 | A white hyacinth | A chartreuse tuffet with pale wands above |
| Prairie Junegrass | 2 | 0.42 | 15 | One stalk of beads | A low tuft with narrow heads |
| 'Moorhexe' | 2 | 0.47 | 16 | A grape hyacinth | Dense upright leaves, wiry stems, a narrow dark panicle |
| Blue Grama | 2 | 0.58 | 22 | Sparse, with flat combs | A fine tuft with eyelash combs. The combs are good |
| Quaking Grass | 2 | 0.45 | 26 | A column of beads | Hair-fine open panicles of dangling lockets |
| Sideoats Grama | 2 | 0.39 | 28 | A thin flower spike | A blue-green mound, oats down one side of arching stems |
| Purple Moor Grass | 3 | 0.29 | 28 | A lupine | As 'Moorhexe', larger |
| Arizona Cottontop | 3 | 0.35 | 32 | A cotton swab | Narrow upright cottony heads |
| Blue Oat Grass | 3 | 0.35 | 35 | A blue column with a bead spike | The blurb's "steel-blue hedgehog" with arching oat stems |
| Japanese Forest Grass | 3 | 0.88 | 41 | A flat two-way rosette | A cascade with every blade flowing one way |
| Indian Ricegrass | 3 | 0.50 | 42 | White cotton balls | A wide lacy cloud with seeds at the tips |
| Big Bluestem | 14 | 0.63 | 46 | Three or four poles on a skirt | Leafy culms in a clump, turkey feet above |
| Giant Feather Grass | 4 | 0.46 | 46 | One ladder of beads, like a delphinium | A huge see-through veil of golden oats. The largest gap between drawing and plant |
| Prairie Dropseed | 4 | 0.81 | 50 | A bouquet over a thin skirt | A fine fountain of hair leaves, panicles barely above |
| Northern Sea Oats | 4 | 0.63 | 55 | Basal straps and a bead column | Leaves along arching stems, flat oats dangling |
| Miscanthus | 4 | 0.57 | 57 | Nine straight spears | A big arching fountain of ribbons |
| Fountain Grass | 3 | 0.71 | 60 | Sparse, with caterpillar plumes | A dense mound with many arching brushes |
| Switchgrass, Sand Lovegrass | 4 | 0.49, 0.59 | 61, 63 | A lollipop: stem column, dense round head | A column under a wide open haze |
| Mexican Feather Grass | 3 | 1.38 | 81 | A flat fan from one point, no green | A soft rounded mop, green under blond |
| Purple Needlegrass | 2 | 1.14 | 52 | The same flat fan, a foot short | An upright tuft with long nodding awns |

These hold up and should stay as they are, or nearly: **Deergrass, Lindheimer's Muhly, Pink Muhly in fall, Tufted
Hairgrass, Purple Lovegrass, Korean Feather Reed, Alkali Sacaton**, and Little Bluestem's colour. Fall colour is
good across the tab.

### What runs through all of them

1. **Every clump grows from a point.** The crown is 2-7 in across on 39 of 40, and the fortieth is only Big
   Bluestem's skirt. So each grass is a bunch of flowers held at the stem. This is the largest single problem,
   and most of the others follow from it. Sedges had it until 0.9.81 and `drawSedgeTufts` fixed it there.
2. **Drifts do not knit.** Ten species cover under 30% of the ground in a drift, and they stand as a grid of
   separate dots. 21 of 40 draw under 0.6 of their stated spread.
3. **Snow floated.** Every grass in winter carried the white ovals the sedge audit called eggs, in the air and
   across the stems, because grass forms returned no `snowAnchors`. Fixed in 0.9.88.
4. **Foliage was drawn as tall as the flowers.** Hoffman gives Karl Foerster 2 ft of leaf and 6 ft in flower, and
   Indiangrass the same; 'Overdam' is 1.5 ft and 5 ft. Oudolf's word for that habit is
   [emergent](https://hoffmannursery.com/blog/article/five-great-grasses-from-the-oudolf-garden). The `vertgrass`
   form already takes `foliageHeight`: Karl and Indiangrass do not set it, and 'Overdam' sets 0.72 where Hoffman
   gave about 0.3. Fixed in 0.9.88 for those three, by data alone; the rest of `vertgrass` is close.
5. **Blades do not arch.** `vertgrass` puts its control point on the line, so Miscanthus cannot fall over.
6. **Cultivars differ mostly by colour.** 'Zebrinus' and 'Strictus' have no bands, though the note promises them;
   'Morning Light' has no pale margins; 'Overdam' has so pale a `fol` that it reads as straw in Summer, where Chicago
   gives it green with cream margins.

### Cost

Against 0.9.87, in one browser and interleaved, on a software canvas, so relative figures only. One draw of all 40
went 6.39 to 5.97ms in Summer, 6.95 to 6.27 in Fall and 6.80 to 6.27 in Winter. 'Karl Foerster' and Indiangrass double,
0.07 to 0.14ms, for their extra culms. The mist panicles fall by about a third: Switchgrass 0.53 to 0.35ms.

`dev/ff-bench.cjs` on desktop, with the demo garden's 323 plants all swapped for grasses, three runs a side:

| | 0.9.87 | 0.9.88 |
| --- | --- | --- |
| Sprite frame | 5.4ms | 5.0ms |
| Spring, while baking | 7.0ms | 7.1ms |
| Summer, while baking | 6.7ms, 6.5 bakes a frame | 7.4ms, 7.3 bakes a frame |
| Fall, while baking | 7.0ms | 6.3ms |
| Winter, while baking | 7.9ms | 7.5ms |
| Cache peak, of 48MB | 16MB | 16.3MB |

Summer bakes more because seven grasses now have a bloom window to re-bake through. That is a single-digit cost on a garden
made of nothing else, and the same plants save it back in Fall and Winter.

**Not from this work, and still open:** in a 3-year hold, both builds jump from about 3ms to 120-150ms a frame around day
198, with no bakes. Two-year holds never reach it. It needs a look of its own. In the first set of 3-year runs, which had a
240s limit, one 0.9.88 run crashed its tab and both 0.9.87 runs timed out, so that crash cannot be pinned on either build.
It did not recur in the later 3-year or 2-year runs.

## Proposed order

1. **Fixes with no design question.** Shipped in 0.9.88.
2. **A crown for every grass:** blades rising from a ground ellipse, opt-in by `look` as `tuftIn` is, with denser
   foliage on the low species so a drift knits.
3. **Rebuild the wrong forms:** a dangling open panicle in `oatgrass` for Giant Feather Grass, Quaking Grass, Sea Oats
   and Sideoats; a dome for Blue Oat Grass and Blue Fescue; a real `moorgrass`; a mop for `feathergrass`; a one-way
   cascade for `forestgrass`; arching ribbons with bands for Miscanthus.
4. **The missing species,** after step 3, so new records use the new drawing. Bottlebrush Grass needs its bristly
   head, and the sedges' `brush` may serve.
5. **Site headings on the tab,** as sedges have, once it passes 50 or so records.
