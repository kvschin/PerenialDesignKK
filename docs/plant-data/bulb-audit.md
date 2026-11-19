# Bulb audit (0.9.124)

Every bulb in the catalog was drawn at true scale, close up and in its four
seasons (`dev/bulb-review.html`), its height checked against a source, and the
catalog checked for bulbs and cultivars a gardener would expect to find. Heights
and where each came from are in `bulb-sources.json`.

## Sizes

**Bulbs were drawn on a different vertical scale from everything else.**
`plantVisualH` draws a grass, sedge, forb or water plant at `h * HERB_SCALE`
(1.75), which is `PX_PER_FT / 12`, so a forb's `h` is its drawn height in inches.
A bulb's `h` passes through unscaled. Authored like a forb, with `h` near the
plant's real height, a bulb drew at 1/1.75 of it. Measured before the change, in
the bloom season over three seeds:

| Choice | Real height | Drawn |
| --- | --- | --- |
| American Turk's-cap lily | 72 in | 46 in |
| Michigan lily | 48 in | 33 in |
| Dahlia 'Kelvin Floodlight' | 48 in | 29 in |
| Allium 'Gladiator' | 42 in | 31 in |
| Great camas | 36 in | 22 in |
| Garden tulip 'Apeldoorn' | 24 in | 15 in |
| Daffodil 'Dutch Master' | 18 in | 14 in |

The smallest went the other way: a 4 in snow crocus drew at 7.7 in, because its
flowers were drawn at a fixed size of about 2.6 in and its stem then added most
of the plant's height again.

The fix is in the data, not `plantVisualH`: **a bulb's `h` is its drawn height in
pixels, 1.75 an inch**, set for each choice so its top lands on `heightIn`. The
test `every bulb draws at its sourced height` holds every choice within 15% or
1.5 in. Flowers drawn at a fixed size were brought to real size where they were
oversized (crocus goblets to 1.6-2.1 in, winter aconite to an inch, colchicum to
2.4 in, the wild daffodil and the small daffodils), and crocus and aconite stems
were shortened, so a crocus keeps leaves you can see.

Every choice now carries a `heightIn` (a few are estimates, said so in the
sources file). Two corrections of fact came out of it: 'Claude Shride' had
carried 60 in unsourced and is 3-4 ft, and **'Blue Melody' is a selection of
common camas, not great camas** (John Scheepers lists it under *C. quamash*,
15 in). It moved, and a saved 'Blue Melody' opens as the moved choice.

## Drawings

| What | Was | Now |
| --- | --- | --- |
| Daffodils | a spiky six-point star with a bell hung under it; read as an orange star | broad tepals turned sideways, the corona a tube standing out of them toward one side (`drawDaffodil`): trumpet, large cup or flat eye, `reflexed` for cyclamineus and triandrus, `doubleFlower` |
| Tulips, crocuses, colchicum | a fan of pointed tepals (a flame or crown), the eye drawn as a dot on the outside of the cup | a cup: three round-tipped tepals behind, three in front; the eye in the mouth. Lily-flowered tulips keep the pointed fan |
| English bluebell | bells laid down a straight diagonal, which ran together into a blue bar | the raceme bends over in a crook and the bells hang from it on one side (`arch`) |
| Guinea hen fritillary | the bell sat on top of the stem like a cup | the bell hangs from a crook beside the stem tip |
| *Scilla peruviana* | a sparse spray of small dots over two thirds of the stem | a broad dense cone of stars, the far half darker (`dense`, `headSpan`) |
| Dahlias | big heads on bare stems over a few basal leaves | opposite leaves up the stems, so the plant is a leafy bush |
| Every bulb | three faint highlight strokes, wider than the plant, floating in the air above it | none; drawPlant's closing highlight assumes foliage fills the box, which no bulb does |

## Added

Sixteen bulbs the catalog lacked, each with a reason a gardener would look for it:

- **Siberian squill** (*Scilla siberica*) and **glory-of-the-snow** (*Scilla
  forbesii*, with 'Pink Giant'): the two most planted blue minor bulbs. Squill
  seeds into woods and is listed in some regions; its blurb says to check.
- **Dwarf iris** (*Iris reticulata*, with 'Harmony' and 'Katharine Hodgkin'):
  the late-winter iris.
- **Dutch crocus** (*Crocus vernus*, with 'Jeanne d'Arc' and 'Pickwick') and
  **showy autumn crocus** (*C. speciosus*), a true crocus for fall beside
  colchicum. The four crocuses are now one Crocus card.
- **Broad-leaved grape hyacinth** (*Muscari latifolium*): two colours on one
  spike (`topShare`).
- **Wild tulip** (*Tulipa sylvestris*): a European native that naturalizes.
- **Crown imperial** (*Fritillaria imperialis*, with 'Lutea'): drawn as a ring
  of hanging bells under a topknot (`lilyStyle:'crown'`).
- **Spring beauty** (*Claytonia virginica*): a native spring ephemeral.
- **Regal lily**, **Oriental lilies** ('Stargazer', 'Casa Blanca') and
  **Asiatic lilies** ('Landini'): the catalog had only martagon-type and native
  lilies, none of the lilies most gardens grow. New grammars: `lilyStyle:
  'trumpet'` (held out sideways, `flush` on the tube) and `'bowl'` (upturned).
  All seven lilies are now one Lily card.
- **Red spider lily** (*Lycoris radiata*): `spider` stamens on the lycoris form.
- **Golden garlic** (*Allium moly*) and **tumbleweed onion** (*A. schubertii*,
  `uneven` pedicels): the yellow allium and the firework one.
- **Crocosmia 'Lucifer'**: arching one-sided spikes over sword leaves
  (`spikeStyle:'crocosmia'`).

New cultivars where the record had none of a distinct look: daffodils 'Jetfire'
(cyclamineus, orange trumpet), 'Salome' (pink cup) and 'Tahiti' (double); garden
tulips 'Golden Parade' (there was no yellow), 'Purissima' (no white) and 'Negrita'
(no purple); golden crocus 'Blue Pearl' and 'Cream Beauty'.

## Folded look-alikes

At garden scale these drew as the choice they now open as, so a gardener was
choosing between two names for one picture. Each is an alias in
`PLANT_REF_ALIASES`, so saved gardens, schemes and palettes keep working:

| Retired | Opens as | Why |
| --- | --- | --- |
| daffodil 'King Alfred' | 'Dutch Master' | both all-yellow trumpets; true 'King Alfred' is rarely sold, and what is sold under the name is usually 'Dutch Master' |
| daffodil 'Carlton' | 'Dutch Master' | all-yellow; a large cup against a trumpet does not show at garden scale |
| snow crocus 'Barr's Purple', 'Whitewell Purple' | 'Ruby Giant' | three purples between the species' lavender and 'Ruby Giant' |
| snowdrop 'Atkinsii' | 'S. Arnott' | both tall single snowdrops |
| great camas 'Caerulea' | the species | the same blue |
| Grecian windflower 'Blue Shades' | the species | the same blue |
| starflower 'Wisley Blue' | 'Rolf Fiedler' | between the species and 'Rolf Fiedler' |

The test `no two choices of one bulb draw alike` holds this: within one record,
every pair of choices must differ in flower colour (OKLab 0.05), eye or corona
(0.08), drawing, or height by a quarter.

## Checked, not changed

- Sprite and preview edges, real pixels in Chrome: 5,472 bakes and 1,824 library
  and tray previews, both renderers, none touching its edge (crocosmia's classic
  preview did until it got a `sideScale`).
- Bake cost in the bloom season: 6.17 ms across the 42 original bulbs before,
  6.41 after. The dearest is a dahlia at 0.43 ms; every new bulb is under 0.41 ms.
- The title screen's spring border, which plants daffodils, tulips, hyacinths,
  grape hyacinths and great camas, still reads as it did, the tulips and camas
  taller.

## Not done

- Spring bulbs in the catalog that are still missing: *Anemone coronaria*,
  Spanish bluebell (invasive in parts of North America), *Fritillaria persica*,
  *Eremurus*, *Gladiolus communis* subsp. *byzantinus*, *Cyclamen coum*, and
  native *Lilium canadense* and *L. philadelphicum*. The last two need the
  `bowl` and a nodding variant; no source was read for *L. philadelphicum*.
- Heights estimated rather than sourced: the wild daffodil, 'Actaea', 'Spring
  Green', 'Ballerina', four dahlias and the three group records. Worth a second
  source.
- The yellow trout lily still draws one upturned star; the real flower nods with
  its tepals swept back.

## 0.9.136 (2026-11-18): the open items

What the section above left undone. Sources and the reasoning for every figure are
in `bulb-sources.json`.

### Added

Seven bulbs, each the wild species, with cultivars only where they add a colour the
record lacks:

| Bulb | Height, zones | Drawn as |
| --- | --- | --- |
| Poppy anemone (*Anemone coronaria*), 'Mr. Fokker', 'The Bride' | 10 in (MBG), cultivars 8 in (DutchGrown); 7-10 | `flowerStyle:'coronaria'` on the cone form: a saucer of broad tepals tipped toward you, round a boss of dark stamens and a dark knob, with a pale ring at the base (`ring`); feathery parsley leaves (`leafStyle:'feather'`) |
| Persian lily (*Fritillaria persica*), 'Ivory Bells' | 30 in, 33 in (John Scheepers); 5-8 | a long cone of small nodding plum bells on the bulb raceme (`floretShape:'noddingBell'`, the non-arching branch no bulb had used, with thin pedicels, `pedicelW`), over glaucous leaves up the lower stem |
| Foxtail lily (*Eremurus stenophyllus*), 'Cleopatra' | 48 in (RHS 1-1.5 m in flower; DutchGrown's 2 ft is an outlier); 5-8 | `spikeStyle:'foxtail'`: a narrow cylinder of small starry flowers opening from the bottom, buds at the top (`budCol`), the lowest fading (`fadeCol`), long stamens out of the open band; strap leaves that yellow as it flowers, a dry spike in fall |
| Byzantine gladiolus (*Gladiolus communis* subsp. *byzantinus*) | 20 in (MBG 1-2 ft, Scheepers 16-24 in); 6-10 | `spikeStyle:'gladiolus'`: a one-sided zigzag spike of hooded magenta funnels, a white streak on the lower tepals (`eye`), buds at the top, over a fan of sword leaves |
| Round-leaved cyclamen (*Cyclamen coum*), 'Album' | 4 in (RHS to 10 cm); 5-8 | the ivy-leaved cyclamen's reflexed flower with broader petals (`petalShape`), round notched leaves on stalks (`leafStyle:'parasol'`); leaves from autumn (`bulbSeason:'fall'`, `springFoliage`, `winterFoliage`), flowers in February and March on its month window, gone by summer |
| Canada lily (*Lilium canadense*) | 48 in (Native Plant Trust, Mt. Cuba 3-5 ft); 3-8 | `lilyStyle:'nodding'`: yellow-orange bells hanging from stalks that arch out round the top of the stem, flared at the mouth over reddish stamens, spotted inside; leaves in whorls (`leafWhorls`) |
| Wood lily (*Lilium philadelphicum*) | 24 in (Prairie Moon 2 ft, Minnesota Wildflowers 1-3 ft); 3-7 | the `bowl` style, one to three upturned orange-red cups whose tepals narrow to a claw at the base (`tepalShape:'obovate'`), spotted maroon; alternate leaves with one whorl under the flowers |

The two cyclamens are now one Cyclamen card, and the Persian lily joins the
fritillaries and the two lilies the Lily card. The poppy anemone, Persian lily,
foxtail lily and round-leaved cyclamen resist deer and rabbits where a source says so
(MBG, DutchGrown, and for the cyclamen the nurseries Burncoose and Plant Lust); the Persian lily resists squirrels too (John Scheepers: "Deer- and
rodent-resistant Fritillaria").

### Left out

**Spanish bluebell** (*Hyacinthoides hispanica*), by decision: it is invasive in
parts of North America (MBG's Plant Finder flags it so) and it hybridises with the
English bluebell (MBG notes that too). The sources file records this under `leftOut`.

Also not added, because the look is not new or the plant is a different one: the
double St. Brigid anemones, *Eremurus robustus* and *E. himalaicus*, and the red
*Lilium canadense* var. *coccineum*.

### Heights now sourced

| Choice | Was (estimate) | Now | Source |
| --- | --- | --- | --- |
| Wild daffodil | 12 in | 12 in | RHS subsp. *pseudonarcissus* to 30 cm, the species to 35 cm |
| Daffodil 'Actaea' | 17 | 15 | John Scheepers 14-16 in |
| Garden tulip (the group) | 20 | 17 | MBG Tulipa (group) 0.75-2 ft |
| 'Spring Green' | 20 | 17 | RHS 40 cm, DutchGrown 18 in |
| 'Ballerina' | 22 | 23 | RHS 60 cm, DutchGrown 22 in |
| Oriental lily (the group) | 36 | 42 | the median of the 13 Oriental cultivars in MBG's Plant Finder |
| Asiatic lily (the group) | 36 | 30 | the median of the 28 Asiatic cultivars in MBG's Plant Finder |
| Dahlia (the group) | 40 | 42 | MBG Dahlia (group) 1-6 ft |
| 'Bishop of Llandaff' | 40 | 39 | RHS to 1 m |
| 'Thomas Edison' | 40 | 40 | Dutch Bulbs 40 in, Nature Hills 36-48 in, RHS about 1 m |
| 'Kelvin Floodlight' | 48 | 42 | Spring Hill and DeGroot 36-48 in, RHS 0.5-1 m |

Each `h` was solved again so the drawing lands on the new height.

### Drawings

**The trout lily nods** (`nod`). It drew one upturned star; now the scape crooks over
at the top, a yellow bell hangs under the crook with its stamens below it, and its
tepal tips sweep back up past it, which is the flower an *Erythronium* has.

Every drawing option above is opt-in. The catalog as it stood, drawn through the old
and the new `draw.js` (four seasons, two seeds, two growths, two bloom levels, both
renderers), is the same call for call over 97,280 drawings. With the new data, the
only drawings that differ are the new choices, the trout lily, and the re-heighted
records above, each in the seasons it draws.

`snowOnLeaves` is new as well: *Cyclamen coum* flowers in snow, and the 2.2-unit caps
put on flower heads were bigger than its flowers, so its snow goes on its leaves.

### Checked

- Every bulb draws at its sourced height (`every bulb draws at its sourced height`,
  now 126 choices).
- Sprite and preview edges, real pixels in Chrome: 6,048 bakes and 2,016 library and
  tray previews, both renderers, none touching its edge.
- Bake cost in each choice's bloom season (headless Chrome, best of three): the new
  choices take 0.03-0.38 ms, inside the existing bulbs' 0.01-0.70 ms. The dearest new
  one is the Byzantine gladiolus at 0.38 ms; the nodding trout lily is 0.03 ms.
- Wikipedia articles for the seven new species resolve (`node
  dev/wikipedia-links.js --verify`, all 859).

### Still not done

- The wood lily's yellow throat is hidden by its front tepals at garden scale.
- *Cyclamen coum*'s leaves are plain dark green; the silver-marked and pewter forms
  are not drawn.
- MBG lists no *Cyclamen coum*, *Lilium canadense* or *L. philadelphicum*; their
  heights come from RHS, NC State, the Native Plant Trust, Mt. Cuba, Prairie Moon,
  Minnesota Wildflowers and the Wildflower Center instead.
