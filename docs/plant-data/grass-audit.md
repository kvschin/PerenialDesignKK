# Grass audit

Audited November 7, 2026, against the catalog at 0.9.87: 40 records in the Grasses category, with
45 cultivars. The data fixes, bugs and snow shipped in 0.9.88, a crown for every grass in 0.9.89, and the
rebuilt forms in 0.9.90, the twelve "Add first" species in 0.9.91, the ten European and design grasses in 0.9.92,
site headings in 0.9.93, the twelve "Worth adding next" with giant miscanthus in 0.9.130, the seventeen missing
cultivars in 0.9.131, and every grass drawn at its height in flower in 0.9.133.

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

All twelve shipped in 0.9.91; see below.

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

All twelve shipped in 0.9.130, with 'Black Mountain' and 'Canyon Prince'; see below. The notes are the audit's, and
two of them changed on reading: no filter hides a plant any more, so Broomsedge's EU listing is said in its blurb, and
Florida's protection of sea oats turned out as recalled.

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
by designers, so read them on their own terms rather than by count. All ten shipped in 0.9.92; see below.

| Plant | Evidence |
| --- | --- |
| *Stipa calamagrostis* (*Achnatherum calamagrostis*) | [Knoll](https://www.knollgardens.co.uk/planting-area/sun-baked-and-dry/), [RHS](https://www.rhs.org.uk/Plants/63571/Stipa-calamagrostis/Details) |
| *Sesleria nitida*, *S. argentea*, *S.* 'Greenlee Hybrid' | Knoll; Hoffman for 'Greenlee Hybrid' (z5-9). A real matrix grass, as sedges are |
| *Milium effusum* 'Aureum' | Gardeners' World, Minnesota. Gold for shade |
| *Anemanthele lessoniana* | Gardeners' World, Knoll. New Zealand |
| *Festuca amethystina*, *Melica ciliata* | Knoll for the *Festuca*. For the *Melica*, a search result quoting Tom Stuart-Smith's Hampton Court list, whose PDF did not load |
| *Ampelodesmos mauritanicus*, *Poa labillardierei* | Knoll. Mediterranean and Australian |

### Decide before adding

Decided November 17, 2026.

| Plant | Lists | The problem | Answer |
| --- | --- | --- | --- |
| **Pampas Grass**, *Cortaderia selloana* | 6 | The most-named plant here after Bottlebrush Grass, and rated High by Cal-IPC. Gardeners will search for it, and the caution is a useful answer, so I lean toward adding it and letting the filter hide it in North America. The EU lists subsp. *jubata* | Left out, as *Arundo donax* is, because Cal-IPC rates it High. There is no filter to hide it since 0.9.117 |
| **Buffalograss**, *Bouteloua dactyloides* | 5 | Grown as a lawn, 6-8 in. It could be a plant record or a surface in `LAWN_STYLES`. I lean toward the surface | Skipped, as neither a plant record nor a lawn surface |
| ***Miscanthus × giganteus*** | 2 | No viable seed in Chicago's trial, so it may be the Miscanthus to offer. It also stands 10-12 ft and spreads by rhizome | Added in 0.9.130, its blurb saying all three |

### Left out on purpose

*Arundo donax* (Cal-IPC High), *Cortaderia selloana* (Cal-IPC High, decided above), *Ammophila arenaria*
(Cal-IPC High; *A. breviligulata* is the native one, added in 0.9.130), *Imperata cylindrica* (3 lists; its US federal status still needs a read),
*Cenchrus setaceus* (Cal-IPC Moderate, EU Union concern), *Saccharum ravennae* (Cal-IPC Moderate),
*Festuca arundinacea* (Cal-IPC Moderate), and annual or short-lived grasses such as *Briza maxima* and
*Hordeum jubatum*, since the catalog holds perennials.

## Missing cultivars

All seventeen shipped in 0.9.131; see below.

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
form is rebuilt in step 3. (Done in 0.9.90.)

## Shipped in 0.9.89

Step 2: a crown for every grass.

### The crown

`look.crownIn` is the width of a clump at the ground, in real inches. Each blade and culm steps out to its own place
on that ellipse before it is drawn and steps back after (`grassCrownIn`/`grassCrownOut`, draw.js), so no form's
geometry changed. A blade leaving the left of the clump stands at the left of the crown, and the back of the clump
stands up the screen from the front. Under the blades lies a soft wash (`crownWash`, default 0.2) and, on the fine
grasses, a coat of short hairs in one thread batch (`hairs`, `hairLen`, `hairLift`, `hairFan`, `hairSpread`, `hairW`),
which is what hides the soil between tufts, as on the sedges. The crown grows with the plant, from 0.35 of its
width at planting.

Every grass carries one, and a test refuses one on anything else. Without one a form draws exactly as before: with
the code in and no plant opted in, 10,032 of 10,032 drawings matched 0.9.88 call for call, both renderers, every
season. Most grasses also got more leaves (`leaves`, `fan`, and on `moorgrass` a new `leafSpread`), and Big Bluestem's
`turkeyfoot` got basal leaves of its own (`basalN`, `basalLen`, `basalLift`, `basalFan`) and a `stems` count.

**A cultivar's crown follows its own size.** A cultivar is drawn inside `plantVisualWidthScale`, which already
stretches it by its spread against the species', so its crown is scaled by its height against the species' and
what reaches the screen follows its real spread. 'Little Bunny' stands on a crown half the width of the species'.
'Standing Ovation' (7), 'Northwind' (8) and 'Beyond Blue' (9) state a smaller one, the first two for their upright
habit and 'Beyond Blue' because it reached past its sprite.

**The sprite box makes room for the crown at the top only.** The far side of a crown stands up the screen, and
without that allowance Lindheimer's Muhly and Slender Indiangrass clipped by 3px. Measured over every grass and 40
seeds, the padding already holds the sides and the foot, and adding the crown to the width made 20% more sprite for
nothing. 21 choices whose library card or tray picture clipped got a measured `sideScale`.

### What it did

Measured as in the next section, in the real renderer: crown is the width of the clump where it meets the ground,
width is in Fall, drift is Summer. The last column is the same drift on 0.9.87, where that table has it. The drawn crown
is read off the ink in the lowest few pixels, so Blue Fescue and Blue Moor Grass, which put little ink there, come out
narrower than their `crownIn`.

| Grass | `crownIn` | Crown drawn, in | Width | Drift % | Was |
| --- | --- | --- | --- | --- | --- |
| Roemer's Fescue | 8 | 9 | 0.82 | 61 | |
| Blue Moor Grass | 14 | 8 | 1.16 | 65 | 10 |
| Prairie Junegrass | 11 | 13 | 1.28 | 65 | 15 |
| Blue Fescue | 11 | 6 | 1.37 | 72 | 13 |
| Purple Needlegrass | 6 | 8 | 1.17 | 72 | 52 |
| Indian Ricegrass | 10 | 13 | 0.75 | 74 | 42 |
| Japanese Forest Grass | 10 | 11 | 1.21 | 76 | 41 |
| Autumn Moor Grass | 12 | 13 | 1.42 | 80 | 15 |
| Quaking Grass | 10 | 13 | 1.34 | 81 | 26 |
| Arizona Cottontop | 10 | 13 | 0.67 | 81 | 32 |
| Blue Grama | 12 | 14 | 1.04 | 82 | 22 |
| Elliott's Lovegrass | 10 | 11 | 0.96 | 85 | |
| Purple Lovegrass | 10 | 13 | 1.19 | 87 | |
| Pink Muhly Grass | 10 | 13 | 1.19 | 87 | |
| Sideoats Grama | 10 | 13 | 1.17 | 89 | 28 |
| Mexican Feather Grass | 6 | 9 | 1.38 | 89 | 81 |
| 'Overdam' | 8 | 11 | 0.87 | 90 | |
| Prairie Dropseed | 12 | 15 | 1.13 | 91 | 50 |
| Indiangrass | 8 | 12 | 1.21 | 91 | |
| Tufted Hairgrass | 10 | 13 | 1.20 | 92 | |
| Little Bluestem | 9 | 12 | 1.09 | 94 | |
| Big Bluestem | 12 | 16 | 1.08 | 94 | 46 |
| 'Moorhexe' | 12 | 15 | 0.79 | 94 | 16 |
| Purple Moor Grass | 12 | 15 | 0.91 | 94 | 28 |
| Slender Indiangrass | 10 | 14 | 1.03 | 94 | |
| Fountain Grass | 14 | 17 | 0.94 | 95 | 60 |
| Oriental Fountain Grass | 14 | 17 | 0.88 | 95 | |
| Blue Oat Grass | 12 | 15 | 1.00 | 95 | 35 |
| 'Karl Foerster' | 8 | 11 | 0.96 | 96 | |
| Alkali Sacaton | 10 | 13 | 1.16 | 96 | |
| Korean Feather Reed Grass | 12 | 15 | 1.05 | 97 | |
| Northern Sea Oats | 12 | 16 | 0.88 | 98 | 55 |
| 'Transparent' | 14 | 18 | 0.62 | 98 | |
| Sand Lovegrass | 12 | 16 | 0.88 | 98 | 63 |
| Miscanthus | 18 | 23 | 0.93 | 99 | 57 |
| Giant Feather Grass | 14 | 18 | 0.80 | 99 | 46 |
| Dwarf Fakahatchee Grass | 14 | 18 | 0.80 | 99 | |
| Lindheimer's Muhly | 18 | 19 | 0.84 | 99 | |
| Switchgrass | 12 | 16 | 0.83 | 100 | 61 |
| Deergrass | 24 | 29 | 0.60 | 100 | |

A drift of the tall grasses now reads as one planted mass. The low ones still read as tufts, closer together: a tile
is 18 in, so a 12 in fescue on every tile has bare ground between clumps however its crown is drawn, and that is true
of the garden too. The wrong forms are still wrong: the crown is under them, not instead of them.

### How it was checked

- Real pixels: 2,040 sprites (every choice, four seasons, three seeds, two ages) with no ink on their border, and 680
  library cards and tray pictures with nothing cut off. `dev/grass-review.html?check` now sweeps the previews too.
- Tests hold that every grass has a crown and nothing else does; that the clump is wider at the ground with one than
  without, in both renderers; that a plant with none spends no random numbers on it; that every form steps back out of
  the crown however it leaves its loop, Oatgrass's early exit in Spring included; that a cultivar's crown follows its
  spread; and that the sprite box holds every blade at two ages. Each was checked by breaking the code on purpose,
  six ways, and each break fails a test.
- Snow now lands within 12px of a drawn line on every grass. Japanese Forest Grass in the classic renderer is the
  farthest, 11.5px; it was 9.9 in 0.9.88, when the test allowed 16. Every other grass is under 8.3px.

### What it costs

The crown itself is a translate per blade. The cost is the foliage added so a drift closes. Against 0.9.88, in one
headless browser, alternating three rounds, best of each: one procedural draw of all 40 grasses goes 5.71 to 7.79ms in
Summer, 6.09 to 8.02 in Fall and 6.06 to 8.07 in Winter; the median grass 0.137 to 0.175ms, which is about the
catalog's median plant. The fountain grasses (0.19 to 0.34ms) and Big Bluestem (0.09 to 0.20) roughly double; the
hair coats take the low grasses from about 0.09 to 0.16. Nothing that is not a grass changed: 9,352 of 10,032
drawings are identical, and all 680 that differ are grasses.

That is paid once per sprite bake. `dev/ff-bench.cjs` on the all-grass demo garden (323 plants, 2-year hold, each
build running 0.9.88's bench, alternating):

| | 0.9.88 | 0.9.89 |
| --- | --- | --- |
| Desktop sprite frame, 3 runs | 4.67, 4.86, 4.74ms | 5.18, 5.17, 5.08ms |
| Desktop, while baking (Spring, Summer, Fall, Winter, mean of 3) | 6.71, 6.79, 6.06, 7.13ms | 6.96, 7.02, 6.31, 7.18ms |
| Bakes a frame, Summer | 7.3 | 7.4 |
| Desktop cache peak, of 48MB | 16.3MB | 17.7MB |
| Phone sprite frame, 1 run | 4.50ms | 4.67ms |
| Phone cache peak, of 48MB | 35.5MB | 38.6MB |

So about 0.4ms a frame on desktop, 8%, on a garden made of nothing but grasses, and 0.2ms on the phone profile. The
bake count does not move. The sprites are 7-9% bigger, which is the room at the top for the back of the crown, and the
blit is what that costs. The procedural frame swung between 92 and 162ms from run to run in both builds, so it is not
read here; the single-draw figures above are the measure of it.

## Shipped in 0.9.90

Step 3: the forms that drew the wrong plant. Each new drawing is chosen by `look`, so a grass that does not ask for
one draws exactly as it did; the 25 grasses outside this list are untouched.

### What each one became

- **A hanging panicle** (`headStyle:'panicle'`, `drawGrassPanicle`). Branches leave the top of the culm, point all round
  it, spread and droop, and every spikelet hangs from a fine stalk; a branch pointing at the viewer comes out short and
  the far ones go a shade darker. Giant Feather Grass is a see-through veil of golden oats with long awns, held on
  eleven culms over a low arching mound. Quaking Grass dangles plump lockets (`spkShape:'locket'`). Sea Oats nods its
  culms over (`culmNod`), carries its broad leaves up them (`culmLeaves`), and turns some spikelets edge-on
  (`spkShape:'flat'`) so they read as flat. Blue Oat Grass and Purple Needlegrass carry narrow nodding panicles, the
  needlegrass with long awns.
- **Pennants** (`headStyle:'pennant'`, Sideoats Grama). Short spikes hang down one side of each culm, the curtipendula
  of its name, with the anthers under them in flower.
- **A dome** (`foliage:'dome'`, Blue Oat Grass and Blue Fescue, which moved from `bunchgrass` to `oatgrass`). Stiff leaves
  radiate from a tight crown: near level at the rim, upright in the middle, the near ones coming down the screen. Each
  is a tapered three-segment curve lit by where its tip sits on the dome, laid back half first. Leaves are spaced by
  angle, not by depth: by depth, nothing pointed at the viewer and the middle went hollow.
- **Moor grass heads** (`moorgrass` `headStyle`). Culms held clear of the tuft, at the stated flowering height. Autumn
  Moor Grass, Prairie Junegrass and Blue Moor Grass carry one lit spike along the culm, the first with its pale anthers.
  The two Molinias are a brush of wiry culms, 18 on 'Moorhexe' and 14 looser on the species, each topped with a narrow
  panicle of short branches pressed to the axis.
- **A mop** (`habit:'mop'`, Mexican Feather Grass). Hair-fine threads rise from the crown and fall over all round, green
  leaves under blond panicles; each thread is one polyline, lit by where its tip sits.
- **A one-way cascade** (`forestgrass`, Japanese Forest Grass and its cultivars). Blades rise, arch and spill to the
  same side, those from the back of the crown highest and laid last, so the top of the wave lies over the skirt. The
  flow points right and a little toward the viewer in every clump, as a planting of it flows toward the light. The
  blades are narrower, so one pointing at the viewer no longer reads as a slab, and the flower stalks lean with the
  flow among the leaves instead of standing out of the mound.
- **A fountain** (`vertgrass` `fountain:true`, Miscanthus and its six cultivars). Ribbons with a pale midrib rise from
  the crown, arch out and fall, the outer ones furthest; the culms carry only the plumes, which are a fan of silky
  racemes (`plumeStyle:'silk'`) where the old fan read as a shuttlecock. 'Zebrinus' and 'Strictus' have their gold
  bands, and greener leaves now the bands carry the gold; 'Gracillimus' and 'Morning Light' have finer ribbons.

### What it did

Measured with the same harness as before, in the real renderer: width in Fall, drift in Summer, height in Fall against
the height in flower the record states.

| Grass | Drift % | Width | Height, ft |
| --- | --- | --- | --- |
| Giant Feather Grass | 99 → 97 | 0.80 → 1.01 | 6.9 → 6.6, of 6.0 |
| Quaking Grass | 81 → 83 | 1.34 → 1.51 | 2.1 → 2.4, of 2.5 |
| Northern Sea Oats | 98 → 91 | 0.88 → 1.26 | 3.9 → 3.6, of 3.5 |
| Sideoats Grama | 89 → 84 | 1.17 → 1.08 | 2.7 → 2.8, of 2.5 |
| Blue Oat Grass | 95 → 98 | 1.00 → 1.10 | 3.3 → 3.2, of 3.5 |
| Blue Fescue | 72 → 48 | 1.37 → 1.20 | 0.9 → 0.9, of 1.0 |
| Mexican Feather Grass | 89 → 92 | 1.38 → 1.13 | 1.9 → 2.0, of 1.8 |
| Purple Needlegrass | 72 → 80 | 1.17 → 0.84 | 2.0 → 2.8, of 3.0 |
| Autumn Moor Grass | 80 → 84 | 1.42 → 1.42 | 1.5 → 1.8, of 1.7 |
| Blue Moor Grass | 65 → 61 | 1.16 → 1.12 | 1.2 → 1.1, of 1.0 |
| 'Moorhexe' | 94 → 84 | 0.79 → 0.72 | 3.0 → 3.1, of 3.0 |
| Purple Moor Grass | 94 → 83 | 0.91 → 0.84 | 2.9 → 3.1, of 3.0 |
| Prairie Junegrass | 65 → 61 | 1.28 → 1.28 | 1.7 → 1.6, of 1.5 |
| Japanese Forest Grass | 76 → 89 | 1.21 → 0.82 | 1.3 → 1.6, of 1.5 |
| Miscanthus | 99 → 100 | 0.93 → 0.97 | 7.8 → 6.8, of 6.0 |

Blue Fescue is the one that loses ground, and that is the trade it was given: a tight hemisphere on an 18 in tile
covers less of it than a fan splayed flat, and 48% is nearer what a 12 in clump on that spacing really covers. The
Molinias lose some because their culms are now held up where the heads belong, not packed into the tuft, and the
species' tussock came down to about half its height in flower, as its sources and its own blurb describe it. Purple
Needlegrass and Japanese Forest Grass reach their stated height, which they fell well short of. Miscanthus comes down a
foot to near its 6 ft, and Giant Feather Grass and Sea Oats closer to theirs.

### How it was checked

- Real pixels: 2,040 sprites with no ink on their border and 680 library cards and tray pictures with nothing cut off,
  in the default renderer. The Classic renderer clips five library cards of Little Bluestem 'Carousel' and Prairie
  Dropseed, exactly as 0.9.89 does; none of the rebuilt grasses. Eight choices carry a new or re-measured `sideScale`,
  four of them smaller than before, since the new drawings reach less far than the old ones did.
- New tests hold that a panicle's spikelets hang below their stalks from branches on both sides of the culm, that
  Sideoats hangs its spikes down one side, that Japanese Forest Grass flows one way, that a Miscanthus ribbon reaches out
  and falls with bands only on the banded cultivars, and that the Molinia heads stand above the leaves. Eight deliberate
  breaks each fail one.
- The crown test now runs over every grass, measured where strokes start, and the test recorders sample each curve along
  its length rather than keeping only its end, which makes the sprite-box and snow tests stricter for all 40 grasses.

### What it costs

Against 0.9.89, in one headless browser, alternating three rounds, best of each: one procedural draw of every grass
choice in Spring, Summer and Winter goes 8.76 to 9.06ms, 17.19 to 17.66 and 17.21 to 17.78, about 3%, which is near
the run-to-run spread of the untouched grasses. Underneath that the forms moved both ways. Miscanthus and its
cultivars, Giant Feather Grass and Sea Oats roughly double, to about 0.2ms a draw, for their ribbons, veils and leafy
culms; Japanese Forest Grass goes up a third. The batched forms got cheaper: Mexican Feather Grass 0.24 to 0.07ms a
draw, Prairie Junegrass by 43%, Purple Needlegrass by a third, the blue fescues and Blue Oat Grass by a quarter to a
third, and the other moor grasses by 2-19%.

`dev/ff-bench.cjs` on the all-grass demo garden (323 plants, 2-year hold, alternating, the same bench in both):

| | 0.9.89 | 0.9.90 |
| --- | --- | --- |
| Desktop sprite frame, 3 runs | 5.36, 5.27, 5.29ms | 5.11, 5.07, 4.89ms |
| Desktop, while baking (Spring, Summer, Fall, Winter, mean of 3) | 7.41, 7.48, 6.72, 7.68ms | 7.25, 7.22, 6.38, 7.52ms |
| Bakes a frame, Summer | 7.4 | 7.3 |
| Desktop cache peak, of 48MB | 17.7MB | 17.6MB |
| Phone sprite frame, 1 run | 4.84ms | 4.74ms |
| Phone cache peak, of 48MB | 38.6MB | 38.3MB |

So nothing on the path a garden actually draws, and a little back: the re-measured `sideScale` values made the widest
grass sprites smaller, which is what a blit costs. The bake count does not move.

## Shipped in 0.9.91

Step 4, first batch: the twelve grasses of the "Add first" table, drawn on the step 3 forms. Each was read against
three to five sources; the record, the sources and the reasoning where they disagree are in
`docs/plant-data/grass-sources.json`. All twelve are straight North American natives, and Wavy Hairgrass is European
and Asian too. 'Undaunted', the Ruby Muhly sold under Plant Select, came with it.

| | 0.9.87 | 0.9.91 |
| --- | --- | --- |
| Records, cultivars | 40, 45 | 52, 46 |
| Straight species native to North America / Europe / Asia | 24 / 8 / 5 | 36 / 9 / 6 |
| Moisture: dry / medium / moist | 20 / 18 / 2 | 24 / 22 / 6 |
| Light: full / part | 34 / 6 | 42 / 10 |
| Species per zone, 3 to 11 | 9, 23, 30, 35, 37, 40, 31, 7, 0 | 11, 29, 39, 44, 47, 52, 41, 12, 1 |

So the four gaps the audit named moved: wet ground (Bushy Bluestem, the two cordgrasses, Eastern Gamagrass), shade
(Bottlebrush Grass, Beak Grass, Wavy Hairgrass, California Fescue), zone 10 (five more) and zone 11 (Sand Cordgrass, the
first). Europe barely moved; its grasses are the next batch.

### How each is drawn

- **Bottlebrush Grass and Canada Wild Rye** carry a new head, `headStyle:'bristle'` (`drawGrassBristles`): spikelets
  stand off the top of the culm in pairs at each joint, pointing round the axis, each drawn out into a long awn. Bottlebrush
  Grass holds them out nearly level, which is the bottle brush; Canada Wild Rye holds them close in, under awns that curl
  out, on culms that nod. Both carry leaves up the culm. Three strokes a head, however many spikelets.
- **The cordgrasses** stand on Miscanthus's arching ribbons, which `oatgrass` now takes as `foliage:'fountain'`, and carry
  short spikes held up against the culm on both sides, alternately (`pennantUp` on the Sideoats pennants). Prairie
  Cordgrass's leaves turn gold in fall.
- **California Fescue** is the same fountain, fine and blue-green, under nodding open panicles.
- **Eastern Gamagrass** is a `vertgrass` fountain of broad, coarse ribbons under slender spikes, and shares a card with
  Dwarf Fakahatchee, its Florida relative (group `gamagrass`).
- **Beak Grass** is broad glossy leaves with leafy arching culms carrying a few big beaked seeds, the sea oats panicle
  narrowed.
- **Giant Sacaton, Ruby Muhly and Wavy Hairgrass** are `cloudgrass`, as their relatives Alkali Sacaton, Pink Muhly and
  Tufted Hairgrass are; Wavy Hairgrass shares a card with Tufted (group `hairgrass`).
- **Bushy Bluestem** is `vertgrass` with Miscanthus's silky plume over copper fall leaves; **Wiregrass** is a mop of wiry
  leaves under awned panicles, as Purple Needlegrass is.

Measured as before (width in Fall, drift and height in Summer):

| Grass | Drift % | Width | Height, ft |
| --- | --- | --- | --- |
| Bottlebrush Grass | 89 | 1.27 | 3.9, of 3.5 |
| Canada Wild Rye | 94 | 0.94 | 4.5, of 4.0 |
| Beak Grass | 93 | 0.87 | 2.7, of 2.5 |
| California Fescue | 98 | 1.05 | 4.0, of 4.0 |
| Prairie Cordgrass | 100 | 1.19 | 7.7, of 6.5 |
| Sand Cordgrass | 100 | 0.87 | 5.0, of 4.0 |
| Eastern Gamagrass | 100 | 1.17 | 5.6, of 5.0 |
| Bushy Bluestem | 87 | 1.00 | 5.1, of 4.5 |
| Giant Sacaton | 100 | 1.15 | 7.1, of 6.0 |
| Ruby Muhly | 74 | 1.09 | 2.9, of 2.3 |
| Wavy Hairgrass | 72 | 1.34 | 2.5, of 1.7 |
| Wiregrass | 87 | 0.81 | 2.9, of 2.5 |

All inside what the existing grasses already do. Wavy Hairgrass and Ruby Muhly draw a cloud over a low tuft and stand
over their height as Tufted Hairgrass (3.7, of 2.5) and Pink Muhly (4.1, of 3.5) do.

### How it was checked

- Every plant in the catalog, all four seasons, both renderers, two seeds and two growths: 40,128 draws call for call
  identical to 0.9.90. The new pieces are opt-in, so nothing that does not ask for them moved.
- Real pixels: 2,352 sprites across all 52 grasses with no ink on their border and 784 library and tray pictures with
  nothing cut off. In the Classic renderer the five cards that clipped in 0.9.89 still do, and nothing new. Eight choices
  carry a `sideScale` measured off their own reach.
- New tests hold the twelve records to their reviewed sources, the three groups to their members, a bristle head to its
  pairs of awned spikelets standing further out on Bottlebrush Grass than on Canada Wild Rye, the cordgrass spikes to
  standing up on both sides of the culm, and the oatgrass fountain to ribbons that arch and fall. Eight deliberate breaks
  each fail one.
- Invasive lists: EASIN and Cal-IPC name other species of four of these genera, and none of the twelve.

### What it costs

One procedural draw measures 0.13-0.49ms, against 0.51 for Switchgrass, the costliest grass already here. Since no
existing plant draws differently, a garden without the new grasses costs exactly what it did, and a frame-time A/B
would measure nothing.

## Shipped in 0.9.92

Step 4, second batch: the ten of "Europe and design grasses". Seven are European natives: Silver Spike Grass
(*Achnatherum calamagrostis*), Nest and Silver Moor Grass (*Sesleria nitida*, *S. argentea*), Bowles' Golden Grass
(*Milium effusum* 'Aureum', a selection of wood millet, which is native across the north), Large Blue Fescue (*Festuca
amethystina*), Silky-spike Melic (*Melica ciliata*) and Mauritania Vine Reed (*Ampelodesmos mauritanicus*). The other
three are design staples from elsewhere: Greenlee's Moor Grass, a garden hybrid with no wild range, Pheasant's Tail Grass
from New Zealand and Common Tussock Grass from Australia. Sources and reasoning are in the `europe` batch of
`docs/plant-data/grass-sources.json`.

| | 0.9.91 | 0.9.92 |
| --- | --- | --- |
| Records | 52 | 62 |
| Straight species native to North America / Europe / Asia / Australasia | 36 / 9 / 6 / 1 | 36 / 15 / 8 / 3 |
| Moisture: dry / medium / moist | 24 / 22 / 6 | 31 / 25 / 6 |
| Light: full / part | 42 / 10 | 49 / 13 |
| Species per zone, 3 to 11 | 11, 29, 39, 44, 47, 52, 41, 12, 1 | 11, 33, 46, 51, 54, 62, 45, 15, 1 |

**Sources.** The European half was the audit's weak half, and still leans on one UK nursery: Knoll Gardens gave height,
flowering and habit for nine of the ten, the RHS sizes and ranges for all ten, and Digging Dog, a Californian nursery, US
zones for eight. A European source gives no USDA zone at all, and the RHS's hardiness ratings are its own scale, so the
zones lean on US nurseries and on NC State where it had a page. Two disagreements worth knowing: the RHS rates Silver Spike
Grass H4 (to -10 C) and Digging Dog zone 7, where High Country Gardens and Jelitto, the German seed house, give 5-8, which
fits a plant of the Alps; and the RHS gives Pheasant's Tail Grass's range as Taiwan, where it is endemic to New Zealand.
Still not read: any German or Dutch nursery.

**Drawing.** No new form or option. The three Seslerias are `moorgrass` spikes and join Autumn and Blue Moor Grass on one
card; Silver Spike Grass, Pheasant's Tail Grass, Tussock Grass and the Vine Reed stand the step 4 oatgrass fountain under
hanging panicles; Large Blue Fescue is the Blue Fescue dome, finer and floppier under violet stems; Bowles' Golden Grass
is a fan of broad gold leaves under an airy panicle; Silky-spike Melic is `vertgrass` with narrow, nodding cream spikes.

| Grass | Drift % | Width | Height, ft |
| --- | --- | --- | --- |
| Silver Spike Grass | 98 | 0.83 | 3.0, of 3.0 |
| Nest Moor Grass | 67 | 1.09 | 2.1, of 1.8 |
| Silver Moor Grass | 83 | 1.42 | 1.9, of 1.7 |
| Greenlee's Moor Grass | 86 | 1.13 | 1.4, of 1.2 |
| Bowles' Golden Grass | 75 | 1.21 | 2.0, of 1.7 |
| Pheasant's Tail Grass | 98 | 0.89 | 2.9, of 2.5 |
| Large Blue Fescue | 75 | 1.93 | 1.9, of 1.7 |
| Silky-spike Melic | 74 | 1.25 | 2.7, of 2.0 |
| Mauritania Vine Reed | 100 | 1.17 | 7.5, of 7.0 |
| Common Tussock Grass | 98 | 1.05 | 3.6, of 3.3 |

Large Blue Fescue draws nearly twice its stated spread across, for the reason Blue Fescue does: a 12 in clump's leaves
flop out past it, and the dome reads by its silhouette. Nest Moor Grass covers the least ground, as a stiff, upright tuft
should.

**Checks.** No existing line of plant data or drawing code changed, so every other plant draws exactly as in 0.9.91. All 62
grasses: 2,592 sprites with no ink on their border and 864 library and tray pictures with nothing cut off, the Classic
renderer's five old clips aside. Three choices carry a `sideScale` measured off their reach. The sources test now covers
both batches, and holds the European one to seven natives, a hybrid with no range and a selection; five deliberate breaks
each fail it or the calendar test. Neither EASIN nor Cal-IPC lists any of the ten. One procedural draw is 0.15-0.27ms,
against Miscanthus's 0.21.

## Shipped in 0.9.93

Step 5: the Grasses tab lists by site, as the Sedges tab has since 0.9.82, with one site more in front. A grass is
filed by its light and moisture: **Dry meadow** (full sun, dry: prairie, steppe and gravel, the largest group),
**Meadow** (full sun, average soil), **Wet meadow** (full sun, moist), then **Dry shade**, **Woodland** and **Moist
shade** for part shade from dry to wet. The names are the sedges' own, so the two tabs read alike.

| Site | Grasses (records) |
| --- | --- |
| Dry meadow | 27 |
| Meadow | 18 |
| Wet meadow | 4 |
| Dry shade | 4 |
| Woodland | 7 |
| Moist shade | 2 |

A family card used to be filed by its first member, which for the moor grasses would have put Nest and Silver Moor Grass,
both for dry sun, under Dry shade with Autumn Moor Grass. A family whose choices grow in different places is now a card
under each site, holding only what grows there, and opens on those choices alone. Four families split: the moor grasses
(Dry meadow, Dry shade, Woodland), the feather reed grasses ('Karl Foerster' and 'Overdam' in Meadow, Korean in
Woodland), the gamagrasses and the hairgrasses. A family that grows in one place keeps its own card, which is why the
Sedges tab, where no family is split, is unchanged. The category strip still counts families, so a split family counts
once there and once under each heading it appears in.

A style's list keeps only its own sites, as the sedges do: the demo garden, a prairie, shows Dry meadow, Meadow and Wet
meadow. A search, which clears the category, is still one flat list.

Checked in the real app in headless Chrome, at 1440x900 and on a 390x844 phone, and by the browser search test on both;
a new test holds the six sites, every choice filed once, the split families, and a split card opening on its own choices.

## Shipped in 0.9.130

Step 4, third batch: the twelve of "Worth adding next", and giant miscanthus from "Decide before adding". Each was read
against three to seven sources; the record, the sources and the reasoning where they disagree are in the `worth-adding`
and `decided` batches of `docs/plant-data/grass-sources.json`. Eleven are straight North American natives, Blue Lyme Grass
is the European one, and Giant Miscanthus is a sterile hybrid with no wild range. Two cultivars came with them:
Splitbeard Bluestem 'Black Mountain' and Giant Wild Rye 'Canyon Prince'.

| | 0.9.92 | 0.9.130 |
| --- | --- | --- |
| Records, cultivars | 62, 46 | 75, 48 |
| Straight species native to North America / Europe / Asia / Australasia | 36 / 15 / 8 / 3 | 47 / 16 / 8 / 3 |
| Moisture: dry / medium / moist | 31 / 25 / 6 | 40 / 28 / 7 |
| Light: full / part | 49 / 13 | 59 / 16 |
| Species per zone, 3 to 11 | 11, 33, 46, 51, 54, 62, 45, 15, 1 | 13, 40, 54, 60, 66, 75, 56, 19, 2 |

The coast had little before: Sea Oats, American Beachgrass, Coastal Panicgrass, Giant Wild Rye, Blue Lyme Grass and
Mendocino Reed Grass each carry a `coastal` role from a source naming dunes, shores or coastal bluffs. The West gained
four (Coast Range Melic, Idaho Fescue, Giant Wild Rye, Mendocino Reed Grass), and dry shade a melic.

### Where reading changed the plan

- **No filter can hide a plant now** (0.9.117), so the audit's "hide it in Europe" became a sentence. Broomsedge is on
  the EU list of invasive alien species of Union concern (Implementing Regulation 2019/1262, read on EUR-Lex), which
  bans selling and growing it there, and its blurb says so. Blue Lyme Grass says it runs hard, that NC State suggests a
  container, and that it has escaped onto the western shore of Lake Michigan (NVK). American Beachgrass says it has become
  invasive where it was planted on the Pacific coast, and that it declines on settled soil, so it belongs on a dune.
- **Sea oats**: Florida Statutes 161.242 makes it unlawful to cut, harvest, remove or eradicate sea oats on public land,
  or on private land without the owner's consent, and lets licensed nurseries sell plants they grew. The blurb says that,
  and that North Carolina protects it too (NC State).
- **No duplicates.** Roemer's Fescue is *Festuca roemeri*, once *F. idahoensis* subsp. *roemeri*: a separate species,
  so Idaho Fescue is a new record beside it. Nothing else of the thirteen was in the catalog under another name. POWO
  now files both bluestems under *Anatherum*, which each carries as a synonym.
- **Zones at the edge.** Splitbeard Bluestem keeps Hoffman's 6-9: Chicago lost all its plants in zone 5. MBG and NC
  State give Coastal Panicgrass 2-9; it grows wild only on the coast from Connecticut south, so it is 5-9, what Chicago
  has shown. American Beachgrass is 3-8 against Hoffman's 3-9, its range ending at North Carolina.
- **Giant miscanthus**: Chicago x-rayed its seed in 2010 and found none viable, and calls it a sterile triploid. It
  stands 10-12 ft (Hoffman), spreads slowly by rhizome and is hard to dig once old. The blurb says all of it.
- **Two take part shade.** Coast Range Melic files under Dry shade and Mendocino Reed Grass under Woodland: both grow in
  sun on the coast and in shade inland, and the sources say so.

### How each is drawn

No new drawing option: each is an existing form with its own `look`.

- **Broomsedge and Splitbeard Bluestem** are `bunchgrass` with Little Bluestem's fluffy racemes: broomsedge's up a narrow
  clump that turns orange and stays orange through winter, splitbeard's as paired silver tufts over purple and red.
- **Coastal Panicgrass** is `cloudgrass`: broad powder-blue leaves arching out under a tall, narrow cloud.
- **Giant Wild Rye, 'Canyon Prince', Blue Lyme Grass and American Beachgrass** are `vertgrass` with Karl Foerster's spike;
  the Leymus with broad blue blades.
- **Giant Miscanthus** is Miscanthus's fountain of ribbons under silk plumes, at 11 ft.
- **Coast Range Melic and Purpletop** are an `oatgrass` fan under hanging panicles, purpletop's purple.
- **Sea Oats and Mendocino Reed Grass** stand the oatgrass fountain: heavy drooping panicles of flat oats, and narrow
  nodding plumes.
- **Idaho Fescue** is Large Blue Fescue's dome under narrow panicles; **Slender Wood Oats** is Northern Sea Oats' leafy
  culms with a narrow spike of small flat oats held close.

Three family cards: **Wood Oats** (Northern Sea Oats and Slender Wood Oats, one card under Moist shade), **Wild Rye**
(Canada Wild Rye under Meadow; Giant Wild Rye and Blue Lyme Grass under Dry meadow) and **Miscanthus** (Chinese
silvergrass with its six cultivars, and Giant Miscanthus, under Meadow). The old records keep their names. By site,
Dry meadow gained eight, Meadow two, and Woodland, Dry shade and Moist shade one each.

Measured in headless Chrome. Height is read off the recorded geometry in the seasons a head stands. Width is the ink
in Fall over the stated spread, on the earlier tables' scale (ink width times 0.36 over the spread, which matches their
figures to within 0.04 for seven of ten grasses checked, Large Blue Fescue the worst at 0.34 out). Drift is how much of the middle 3x3 tiles of a 5x5 drift is covered in
Summer, which reads lower than the earlier tables for a low grass, so three older grasses are measured alongside.

| Grass | Height, ft | Width | Drift % |
| --- | --- | --- | --- |
| Broomsedge | 3.6, of 3.5 | 0.86 | 75 |
| Splitbeard Bluestem | 3.2, of 3.0 | 0.70 | 59 |
| 'Black Mountain' | 2.7, of 2.5 | 0.60 | 44 |
| Coast Range Melic | 2.5, of 2.5 | 1.20 | 69 |
| Idaho Fescue | 2.1, of 2.0 | 0.88 | 38 |
| Coastal Panicgrass | 5.3, of 5.0 | 0.65 | 100 |
| Giant Wild Rye | 6.2, of 6.0 | 0.67 | 92 |
| 'Canyon Prince' | 3.6, of 3.5 | 0.66 | 97 |
| Blue Lyme Grass | 3.2, of 3.0 | 0.78 | 94 |
| Purpletop | 4.0, of 4.0 | 1.01 | 79 |
| Sea Oats | 5.1, of 5.0 | 1.45 | 99 |
| Mendocino Reed Grass | 1.5, of 1.5 | 0.91 | 49 |
| Slender Wood Oats | 3.2, of 3.0 | 1.07 | 77 |
| American Beachgrass | 3.1, of 3.0 | 1.09 | 91 |
| Giant Miscanthus | 11.1, of 11.0 | 1.14 | 100 |
| *Canada Wild Rye* | *4.3, of 4.0* | *0.97* | *89* |
| *Switchgrass* | *5.3, of 5.0* | *0.84* | *100* |
| *Nest Moor Grass* | *2.0, of 1.8* | *1.00* | *39* |

Sea Oats draws widest, its heavy panicles hanging out past the clump. The low bunchgrasses (Idaho Fescue, 'Black
Mountain', Mendocino Reed Grass) leave ground between clumps, as Nest Moor Grass does.

### How it was checked

- Every plant already in the catalog, all four seasons, both renderers, two seeds and two growths: 47,584 draws call for
  call identical to 0.9.129. No drawing code changed, and the three records joining a card gained only `group` fields.
- Real pixels: 360 sprites of the 15 new choices with no ink on their border, and 180 library cards and catalog pictures
  (list row and tile) with nothing cut off, in both renderers. Blue Lyme Grass and Mendocino Reed Grass carry a
  `sideScale` measured off their reach.
- New tests hold the thirteen and the two cultivars to their sources, the cautions in their blurbs, the three cards, the
  sites they are filed under, and their drawn height within 12% of the height in flower. Three deliberate breaks each
  fail one.
- `dev/grass-review.html?check` threw: it rebuilt the old tray picture from `TRAY_ART_W`, gone since the catalog's
  pictures were redrawn in 0.9.115. It now checks the catalog's own list-row and tile pictures. Over every grass that
  finds twelve older choices whose list-row picture is cut off at the sides (Prairie Dropseed 'Tara', Blue Grama, the
  autumn, blue, silver and Greenlee moor grasses, Blue Fescue and two of its cultivars, Large Blue Fescue, Bowles' Golden
  Grass, 'Little Bunny'), three of them in the tile too. That predates this batch and is not fixed here.

### Style lists

In a North American garden Prairie recommends eight of the thirteen, the dune grasses among them: Prairie is a test of
sun, not place, as `style-recommendations.md` records. Coastal recommends seven, Idaho Fescue only by the catalog's name
match on "fescue", which no source read supports. Shade takes the melic, the reed grass and Slender Wood Oats. Giant
Miscanthus is recommended for Modern alone.

Both were fixed in 0.9.132 (`style-recommendations.md`). American Beachgrass, Sea Oats and Coastal Panicgrass carry a
`dune` role and leave Prairie for Coastal, and the word lists match `festuca glauca`, so Idaho, California and Roemer's
Fescue are off Coastal, Mediterranean and Gravel. The new Rain garden style takes the wet meadow grasses: Prairie
Cordgrass, Eastern Gamagrass, Bushy Bluestem and Sand Cordgrass, with Switchgrass, Big Bluestem, Indiangrass, Canada
Wild Rye, Bottlebrush Grass and Northern Sea Oats from the rain garden lists.

### What it costs

One procedural draw measures 0.05-0.44ms, Sea Oats in Summer the most, against 0.46 for Switchgrass and 0.50 for Giant
Sacaton already here. No existing plant draws differently, so a garden without the new grasses costs what it did.

## Shipped in 0.9.131

The seventeen of "Missing cultivars", and the twelve clipped pictures the 0.9.130 check found. Each cultivar was read
against three to six sources; the figures, the sources and the reasoning where they disagree are in the `cultivars`
batch of `docs/plant-data/grass-sources.json`. Hoffman was read this time, by genus listing in the browser pane (its
detail pages and a headless Chrome both meet a Cloudflare check); it carries eleven of the seventeen.

| | 0.9.130 | 0.9.131 |
| --- | --- | --- |
| Grass cultivars | 48 | 65 |
| Records carrying a cultivar | 16 | 20: Blue Grama, Purple Moor Grass, 'Transparent', 'Karl Foerster' |

### Where each one sits

A cultivar belongs on the record of the species it is a selection of, and draws as that record does. Three needed
thought.

- **Purple moor grass.** The catalog holds the species (`purplemoorgrass`, *Molinia caerulea*, drawn as a compact
  tussock under narrow heads) and two named selections as records of their own: 'Moorhexe' (subsp. *caerulea*) and
  'Transparent' (subsp. *arundinacea*, drawn as a see-through veil over a low tussock). Chicago, the RHS and Digging Dog
  agree on the subspecies: 'Heidebraut' and 'Poul Petersen' are subsp. *caerulea*, 'Skyracer', 'Windspiel' and
  'Cordoba' subsp. *arundinacea*. So the first two are choices on the species record, with the compact drawing, and
  the tall three are choices on 'Transparent', the record already drawn as a tall moor grass. They are not selections
  of 'Transparent': each carries its own `latin` and a `fullName` ("Purple Moor Grass 'Skyracer'"), so it reads as a
  sibling everywhere a name is shown. No new Molinia record was added, and the card still holds every choice. A
  cultivar that changed `form` instead would have had no precedent, inherited the species' moor grass `look` keys, and
  lost the roles `staticPlantRoles` gives 'Transparent', since roles are kept per record.
- **Feather reed grass.** 'Avalanche' and 'Eldorado' are sports of 'Karl Foerster' (Walters, Digging Dog,
  Greenleaf), so they sit on its record, named in full and striped: a white band on 'Avalanche', gold on 'Eldorado'.
- **Fountain grass.** 'Desert Plains' (a seedling of 'Cassian') and 'Piglet' are *Pennisetum alopecuroides* in every
  source, which is *Cenchrus alopecuroides*, the `fountaingrass` record; not the oriental one.

'MinnblueA' is the cultivar name; Blue Heaven is the trade name it is sold under, kept as a synonym so a search finds
it.

### How they look

No new drawing code: every one uses its species' form with its own `look` and colours. 'Blonde Ambition' holds bigger
chartreuse flags flat out (`headTilt` 0) on stems twice the species' height over the same low tuft; 'Heidebraut' has
near-black heads and gold culms; 'Poul Petersen' is a vase; the tall Molinias are 'Transparent''s veil, 'Skyracer'
narrower, 'Windspiel' purple-pink, 'Cordoba' with the biggest heads and the brightest gold; 'Sioux Blue' is metallic
blue; 'Rotstrahlbusch' reddens from the tips; 'Thundercloud' is a blue-green column, the tallest switchgrass here;
'Cape Breeze' stays green into fall; 'Blaze' is the reddest little bluestem, 'Twilight Zone' a purple column that
flowers late, 'MinnblueA' blue-grey turning burgundy; 'Desert Plains' a big purple-plumed mound; 'Piglet' a dwarf.

Each sets its own `h` so it draws within 10% of its `heightIn` in the seasons a head stands (1.01-1.08), measured off
the recorded geometry. That leaves two families uneven: 'Transparent' and 'Karl Foerster' themselves draw a third over
their `heightIn`, so a sibling drawn true stands lower beside them at true scale. Fixing the parents would change how
existing gardens look, and is left for a height pass over the grasses like 0.9.113's for the forbs. That pass is
0.9.133, below.

### The clipped pictures

The catalog's row and tile pictures and the Library card fit a plant by its height and its declared `sideScale`, and
since 0.9.115 a row is enlarged to fill its 56 px, so a low grass wider than its sideScale says was cut off at the
sides. Each was measured off its own ink (`libSeed`, four seasons, both renderers) and given the `sideScale` that
fits every picture with 1.5 px to spare:

| Choice | `sideScale` |
| --- | --- |
| Prairie Dropseed, 'Tara' | 0.6, 0.73 |
| Blue Grama | 0.72 |
| Autumn Moor Grass, Silver Moor Grass | 0.72 |
| Blue Moor Grass | 1.15 |
| Greenlee's Moor Grass | 1.05 |
| Blue Fescue, 'Beyond Blue' ('Boulder Blue' inherits) | 0.95, 1.2 |
| Large Blue Fescue | 0.9 |
| Bowles' Golden Grass | 0.78 |
| 'Little Bunny' | 1.3, from 0.78 |
| 'Carousel' (Classic renderer, Spring) | 1.42, from 1.32 |
| 'Cape Breeze', 'Piglet' (new) | 0.7, 0.89 |

`dev/grass-review.html?check` now reports nothing cut off for every grass choice in both renderers (3,360 sprites,
1,680 pictures each), and the old Classic clips of Prairie Dropseed and 'Carousel' are gone too. `sideScale` also
widens the sprite box where it is larger than the box's own allowance: on these fifteen choices the sprite area grows
by 12% in all, 36% on Blue Moor Grass at the most. They are the smallest sprites in the tab.

### How it was checked

- Every older plant, all four seasons, both renderers, two seeds and two growths: 48,064 draws call for call identical
  to 0.9.130 (`sideScale` changes boxes and previews, not the drawing).
- Real pixels: 3,360 sprites with no ink on their border, and 1,680 library and catalog pictures with nothing cut off,
  in each renderer. Screenshots of every new choice in four seasons, as a drift and at true scale.
- New tests hold the seventeen to their reviewed figures and sources, the placement above, their drawn height within
  10%, and every grass and sedge picture to holding its drawing: `paintLibCanvas` runs onto a canvas that follows the
  transform and records where the drawing lands, in both renderers. Run against 0.9.130's data it names the twelve.
- One procedural draw is 0.05-0.49ms, 'Thundercloud' in Winter the most, against 0.45 for Switchgrass and 0.46 for
  Giant Sacaton already here.

## Shipped in 0.9.133

Every grass choice drawn at the height in flower its `heightIn` states, the pass 0.9.113 made over the Sun Perennials
and the 2026-11-17 backfill over every forb. No plant added, no drawing code changed: `h` and `sideScale` only.

| | Before | After |
| --- | --- | --- |
| Choices more than 10% (or 2 in) off | 62 of 140 | 1 of 140, excused |
| Drawn height over `heightIn` | 0.71-1.58 | 0.92-1.09 |
| Choices with `h` solved | | 73 |

### How it was measured

The top of the tallest culm or head in the seasons a head stands (`bloom` or `seed`), at full growth and full bloom,
read off the recorded geometry through every translate and scale a crown makes and along every curve, then the median
of five clumps (seeds 9137, 7, 4410, 123, 2026). The earlier height tests read the endpoints of each curve, ignored the
crown's translate and took one seed, which read some of the 0.9.130 and 0.9.131 grasses a few percent lower than they
draw; five of them (Idaho Fescue, Blue Lyme Grass, Slender Wood Oats, 'Cape Breeze', 'Piglet') were
re-solved here. It is measured in ART2, which is what a gardener sees; the Classic renderer (`?art2=0`, a development comparison) draws two plumes
differently, 'Red October' at 1.10 and Slender Indiangrass at 0.88, and is not held.

Where a choice drew more than 8% (or 1.5 in) off, `h` was solved: rescaled by the measured ratio, then the integer
nearest the height chosen from the ones either side. Everything else was left alone. The test holds every choice to
10% or 2 in, the 2 in being for the low fescues, where one step of `h` is a tenth of the plant.

### What does not scale

Most forms draw every part from `h`, so a choice drawn a third too tall came down by a third and kept its proportions,
leaf to culm. Two forms draw part of themselves at a fixed size, and there `h` fell further than the error:

- **A cloudgrass's cloud.** `cloudHeight` and `cloudWidth` are draw units, so the cloud stands the same height on any
  plant. Tufted hair grass came down from `h` 36 to 19, Purple Lovegrass and Wavy Hairgrass to 12. That moved the leaf
  toward the sources: tufted hair grass drew 31 in of leaf under a plant that stands 30 in, and now draws 17, against
  UC Sonoma's "a foot or more above foot-tall tussocks". 'Fast Forward' and 'Undaunted' came out with less leaf than
  their sources give (18 in where the trade gives 24-36, and 12 where Ruby Muhly's is 18). A smaller `cloudHeight` on
  those would let `h` give the leaf back; that is a change to how the cloud looks, left for a pass that looks at it.
- **A fountain grass's bottlebrush.** Seven florets 2.1 units apart, about 8 in of plume on any plant. **'Little Bunny'
  is the one choice excused**: on a 12 in dwarf the plume alone is two thirds of the plant. It keeps `h` 9, the floor of
  the audited range, which leaves 8.6 in of leaf, and draws 15 in. 'Burgundy Bunny' (`h` 13) and 'Piglet' (13) fit.

### Widths

A grass's width follows its `h`, so the choices drawn shorter are narrower, by about the same share. A cultivar's width
is its species' drawn width times its spread over the species' (`plantVisualWidthScale` multiplies by the species'
`h`), so when a species' `h` moved, all its cultivars' widths moved with it, whether or not their own height changed:
'Avalanche' and 'Eldorado' are 17% narrower beside 'Karl Foerster', 'Bronzeschleier' 28%, the Molinia cultivars 18-22%,
and fountain grass's, whose species was drawn too short and went from `h` 38 to 45, 11-24% wider. A cultivar drawn
shorter over a fixed-size cloud widens that cloud, since the scale multiplies it as well: 'Shenandoah', 'Prairie Sky'
and 'Heavy Metal' draw 11-16% wider. None of this was measured against the sources' spreads, which conflict
(see "Sources"); it is how the families now read beside each other.

### Pictures

25 choices took a wider `sideScale`, because a fixed-size cloud or plume on a smaller plant reaches further past its
height: first from the recorded geometry (sprite box and the three pictures), then 0.03-0.05 more on five, and a first
`sideScale` on Indian Ricegrass and Nest Moor Grass, where the real pixels of `dev/grass-review.html?check` still
painted a side column. Each carries 0.02 over what it measured. The largest moves: 'Little Bunny' 1.3 to 2.11,
'Fast Forward' 1.09 to 1.63, Purple Lovegrass 0.92 to 1.63, 'Undaunted' 1.04 to 1.6, 'Lenca' (inherited 0.85) to 1.35.
A plant with a large `sideScale` is drawn smaller in its picture, which is the price of not cutting it off.

### How it was checked

- `every grass draws at its sourced height in flower` (`tests/game.test.js`, `grassDrawnTop`) holds all 140 choices
  and Sawgrass, and replaces the two narrower tests for the 0.9.130 and 0.9.131 grasses. Put back at 'Karl Foerster''s
  old `h` it names that plant; 'Little Bunny' at its old `h` fails its excuse.
- The sprite box and picture tests pass unchanged. Real pixels, in each renderer: 3,360 sprites with no ink on their
  border and 1,680 library and catalog pictures with nothing cut off.
- Screenshots of every grass at true scale beside its height line, in headless Chrome.
- `node tests/run.js` and `npm run test:browser` pass.

| Choice | `heightIn` | `h` | Drawn, before → after |
| --- | --- | --- | --- |
| Little Bluestem | 42 | 46 → 40 | 48.0 → 41.7 |
| Little Bluestem 'The Blues' | 42 | 48 → 40 | 49.8 → 41.7 |
| Little Bluestem 'Carousel' | 30 | 32 → 28 | 33.7 → 29.7 |
| Little Bluestem 'Prairie Munchkin' | 22 | 24 → 20 | 25.5 → 21.4 |
| Big Bluestem | 72 | 78 → 69 | 81.2 → 72.4 |
| Big Bluestem 'Blackhawks' | 60 | 62 → 56 | 65.7 → 59.7 |
| Switchgrass 'Northwind' | 66 | 66 → 57 | 75.3 → 66.5 |
| Switchgrass 'Heavy Metal' | 56 | 60 → 45 | 70.3 → 55.6 |
| Switchgrass 'Shenandoah' | 48 | 52 → 37 | 62.4 → 47.7 |
| Switchgrass 'Prairie Sky' | 54 | 66 → 44 | 76.5 → 54.5 |
| Switchgrass 'Dallas Blues' | 66 | 64 → 55 | 74.5 → 65.6 |
| Switchgrass 'Purple Tears' | 48 | 48 → 40 | 56.3 → 48.4 |
| Switchgrass 'Cape Breeze' | 30 | 25 → 22 | 32.8 → 30.0 |
| Prairie Dropseed | 30 | 36 → 25 | 40.1 → 29.9 |
| Prairie Dropseed 'Tara' | 24 | 24 → 21 | 27.1 → 24.5 |
| Indiangrass | 72 | 70 → 59 | 85.3 → 71.7 |
| Indiangrass 'Indian Steel' | 60 | 60 → 48 | 74.2 → 59.5 |
| Indiangrass 'St. Louis' | 76 | 76 → 61 | 94.9 → 76.5 |
| Blue Grama | 16 | 20 → 16 | 19.5 → 15.8 |
| Feather Reed Grass 'Karl Foerster' | 60 | 62 → 46 | 80.7 → 60.2 |
| Feather Reed Grass 'Overdam' | 48 | 48 → 37 | 62.7 → 48.5 |
| Purple Lovegrass | 20 | 24 → 12 | 28.0 → 20.1 |
| Pink Muhly Grass | 42 | 40 → 32 | 47.4 → 42.0 |
| Pink Muhly Grass 'Lenca' | 36 | 36 → 24 | 44.6 → 36.4 |
| Pink Muhly Grass 'Fast Forward' | 36 | 36 → 24 | 44.6 → 36.4 |
| Mexican Feather Grass | 22 | 24 → 21 | 24.5 → 21.8 |
| Tufted Hairgrass | 30 | 36 → 19 | 44.1 → 29.6 |
| Tufted Hairgrass 'Goldtau' | 24 | 30 → 16 | 38.0 → 23.9 |
| Tufted Hairgrass 'Bronzeschleier' | 42 | 42 → 33 | 49.5 → 41.8 |
| Korean Feather Reed Grass | 48 | 42 → 37 | 55.2 → 48.6 |
| Miscanthus | 72 | 76 → 68 | 80.5 → 72.3 |
| Miscanthus 'Morning Light' | 72 | 60 → 67 | 64.3 → 72.0 |
| Miscanthus 'Strictus' | 90 | 102 → 85 | 108.3 → 90.5 |
| Miscanthus 'Malepartus' | 72 | 84 → 68 | 88.9 → 72.3 |
| Fountain Grass | 42 | 38 → 45 | 37.4 → 42.2 |
| Fountain Grass 'Hameln' | 24 | 24 → 21 | 26.7 → 24.4 |
| Fountain Grass 'Little Bunny' | 12 | 12 → 9 | 17.6 → 15.4 (excused) |
| Fountain Grass 'Burgundy Bunny' | 18 | 18 → 13 | 22.3 → 18.4 |
| Fountain Grass 'Piglet' | 18 | 15 → 13 | 19.8 → 18.4 |
| Blue Fescue 'Elijah Blue' | 15 | 12 → 14 | 12.8 → 15.2 |
| Blue Fescue 'Boulder Blue' | 12 | 9 → 11 | 10.0 → 11.6 |
| Blue Fescue 'Beyond Blue' | 18 | 12 → 17 | 12.8 → 18.3 |
| Giant Feather Grass | 72 | 78 → 71 | 78.9 → 71.8 |
| Purple Moor Grass 'Transparent' | 72 | 72 → 51 | 95.8 → 72.3 |
| Sand Lovegrass | 36 | 42 → 26 | 50.6 → 36.0 |
| Bottlebrush Grass | 42 | 42 → 39 | 45.4 → 42.1 |
| Giant Sacaton | 72 | 72 → 58 | 84.7 → 71.9 |
| Ruby Muhly | 28 | 28 → 20 | 33.8 → 28.1 |
| Ruby Muhly 'Undaunted' | 24 | 24 → 15 | 30.8 → 24.1 |
| Wavy Hairgrass | 20 | 22 → 12 | 28.7 → 20.1 |
| Bushy Bluestem | 54 | 54 → 49 | 59.8 → 54.2 |
| Sand Cordgrass | 48 | 48 → 40 | 56.9 → 48.6 |
| Wiregrass | 30 | 30 → 28 | 32.7 → 30.3 |
| Prairie Cordgrass | 78 | 78 → 66 | 91.7 → 78.3 |
| Canada Wild Rye | 48 | 50 → 45 | 53.1 → 48.3 |
| Nest Moor Grass | 22 | 22 → 19 | 25.1 → 21.5 |
| Silver Moor Grass | 20 | 20 → 18 | 21.9 → 20.2 |
| Greenlee's Moor Grass | 14 | 14 → 12 | 16.1 → 14.1 |
| Pheasant's Tail Grass | 30 | 30 → 26 | 33.8 → 29.8 |
| Large Blue Fescue | 20 | 20 → 18 | 22.0 → 20.2 |
| Silky-spike Melic | 24 | 24 → 17 | 30.8 → 23.7 |
| Idaho Fescue | 24 | 24 → 22 | 26.1 → 24.3 |
| Blue Lyme Grass | 36 | 30 → 27 | 40.0 → 35.6 |
| Slender Wood Oats | 36 | 36 → 33 | 39.0 → 36.0 |
| Arizona Cottontop | 30 | 30 → 26 | 33.5 → 29.7 |
| Deergrass | 60 | 48 → 43 | 67.0 → 60.3 |
| Purple Needlegrass | 36 | 30 → 34 | 32.2 → 36.5 |
| Roemer's Fescue | 36 | 32 → 29 | 39.0 → 36.1 |
| Elliott's Lovegrass | 36 | 36 → 29 | 42.7 → 36.5 |
| Dwarf Fakahatchee Grass | 36 | 36 → 27 | 46.7 → 35.5 |
| Indian Ricegrass | 24 | 24 → 19 | 28.7 → 24.0 |
| Lindheimer's Muhly | 60 | 48 → 43 | 66.9 → 60.0 |
| Slender Indiangrass | 72 | 72 → 54 | 95.0 → 71.8 |

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
   Fixed in 0.9.89 with a crown for every grass.
2. **Drifts do not knit.** Ten species cover under 30% of the ground in a drift, and they stand as a grid of
   separate dots. 21 of 40 draw under 0.6 of their stated spread. In 0.9.89 every grass covers at least 61%, and
   none draws under 0.6; Deergrass is the narrowest at 0.60.
3. **Snow floated.** Every grass in winter carried the white ovals the sedge audit called eggs, in the air and
   across the stems, because grass forms returned no `snowAnchors`. Fixed in 0.9.88.
4. **Foliage was drawn as tall as the flowers.** Hoffman gives Karl Foerster 2 ft of leaf and 6 ft in flower, and
   Indiangrass the same; 'Overdam' is 1.5 ft and 5 ft. Oudolf's word for that habit is
   [emergent](https://hoffmannursery.com/blog/article/five-great-grasses-from-the-oudolf-garden). The `vertgrass`
   form already takes `foliageHeight`: Karl and Indiangrass do not set it, and 'Overdam' sets 0.72 where Hoffman
   gave about 0.3. Fixed in 0.9.88 for those three, by data alone; the rest of `vertgrass` is close.
5. **Blades do not arch.** `vertgrass` puts its control point on the line, so Miscanthus cannot fall over.
   Fixed for Miscanthus in 0.9.90, which draws ribbons that arch and fall.
6. **Cultivars differ mostly by colour.** 'Zebrinus' and 'Strictus' have no bands, though the note promises them;
   'Morning Light' has no pale margins; 'Overdam' has so pale a `fol` that it reads as straw in Summer, where Chicago
   gives it green with cream margins. 'Overdam' fixed in 0.9.88; the bands and the paler, finer 'Morning Light' in 0.9.90.

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

**Not from this work, and since resolved:** in a 3-year hold both builds jumped from about 3ms to 120-150ms a frame around
day 198, with no bakes. That was the bench, not either build, and the A/B above is unaffected: it used 2-year holds,
which end around game day 156, before the slowdown starts. The bench read the garden canvas back once a chunk, and Chrome moves a
canvas read back that often to the CPU for good after about 100 reads, which is about day 190 of a 3-year run. A gardener's
hold never gets there: the app's own loop held fast-forward to game day 510 at an unchanged 8.6ms a frame. `dev/ff-bench.cjs`
now flushes without reading the garden canvas and refuses a run in which that canvas changes mode; its note in `CLAUDE.md`
has the detail. The timed-out 3-year runs fit, since a slowed run needs far more than 240s. The one crash is unexplained.

## Switchgrass (0.9.181)

The lollipop above is gone: every switchgrass is a clump of leafy culms (`leafStyle:'culms'`) under the smoke cloud, and
its sizes and colours were checked against MBG, NVK, this trial and the 'Purple Tears' patent (`grass-sources.json`,
`switchgrass`). Heavy Metal and Prairie Sky are blue, as every source says; 'Northwind', 'Prairie Sky' and 'Cloud Nine'
took new heights. `CLAUDE.md` has the detail. The six popular switchgrasses the catalog lacked ('Cheyenne Sky', 'Hot Rod',
Ruby Ribbons, 'Totem Pole', 'Warrior', 'Rehbraun') followed in 0.9.182, batch 'switchgrass-added'.

## Proposed order

1. **Fixes with no design question.** Shipped in 0.9.88.
2. **A crown for every grass:** blades rising from a ground ellipse, opt-in by `look` as `tuftIn` is, with denser
   foliage on the low species so a drift knits. Shipped in 0.9.89.
3. **Rebuild the wrong forms:** a dangling open panicle in `oatgrass` for Giant Feather Grass, Quaking Grass, Sea Oats
   and Sideoats; a dome for Blue Oat Grass and Blue Fescue; a real `moorgrass`; a mop for `feathergrass`; a one-way
   cascade for `forestgrass`; arching ribbons with bands for Miscanthus. Shipped in 0.9.90.
4. **The missing species,** after step 3, so new records use the new drawing. The "Add first" twelve shipped in
   0.9.91, Bottlebrush Grass with a bristle head of its own. The sedges' `brush` did not serve: it is a glyph a few
   pixels long with short awns, where these heads are a fifth of the culm with awns longer than their spikelets.
   The European and design grasses followed in 0.9.92, "Worth adding next" with giant miscanthus in 0.9.130, and
   the missing cultivars in 0.9.131.
5. **Site headings on the tab,** as sedges have, once it passes 50 or so records. Shipped in 0.9.93, at 62.
6. **Every grass at its height in flower,** `h` solved against `heightIn` and held by a test. Shipped in 0.9.133.
