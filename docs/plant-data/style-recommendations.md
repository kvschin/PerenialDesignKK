# What each garden style recommends

Reviewed November 7, 2026, at 0.9.85. A style's Recommended list only changes what is put in front of
a gardener. It never changes what may be planted, and All eligible is one tap away.

The sedge audit found the lists could not say no: they add role weights, and a low bar is cleared by
accident. Every grass cleared Coastal for being a grass, every native tree with a seedhead cleared
Prairie, and any plant with an authored bloom colour cleared Pollinator and Cottage.

## The change, North American garden, plants in the catalog

| Style | Before | After | What left |
| --- | --- | --- | --- |
| Prairie / Meadow | 370 | 170 | Every tree, water plant, vine, fern, and shrub but two, and part-shade plants without a source |
| Pollinator | 535 | 488 | Grasses, rushes, cattails and catkin trees |
| Cottage | 535 | 465 | Grasses, catkin trees, water plants but irises, palms and desert spines |
| Coastal | 65 | 43 | Grasses with no recorded link to the coast |

Shade, Japanese, Mediterranean, Modern, Gravel and Formal did not change.

A European garden's Prairie list goes from 179 to 53, and is now its own native plants of open ground.

## The rules

- **Prairie** needs the `prairie` role. A native grass, forb or bulb of full sun gets it, except agaves,
  palms and the like. Anything else needs it in its own record, with a source. The role counts only in
  the region the plant is native to.
- **Coastal** needs the `coastal` role, authored or matched by name.
- **Cottage** takes no water plant without the `cottage` role, which leaves the irises, and no agave,
  palm, cycad, ocotillo or palo verde.
- **Pollinator** keeps its bar. The style's own label is "Nectar and host plants for butterflies and
  bees", so an apple or a lilac belongs. Raising the bar to require a nectar role or native origin was
  tried: it dropped apples, plums, lilacs and spireas for want of a term in a list, so it was backed
  out. The list stays broad, and the ranking puts nectar, host and native plants first.
- **A sedge** needs the role its style is named for, in every style.

Wind-pollinated plants (grasses, sedges, rushes, cattails, catkin trees) no longer carry `pollinator`,
which also takes it off their Library cards. A record may say otherwise for itself, as White-topped
Sedge does.

## Roles added, with sources

| Record | Role | Source |
| --- | --- | --- |
| Leadplant | prairie | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/flower/lead-plant): dry prairies |
| New Jersey Tea | prairie | [Illinois Wildflowers](https://www.illinoiswildflowers.info/prairie/plantx/nj_teax.htm), [Minnesota Wildflowers](https://www.minnesotawildflowers.info/shrub/new-jersey-tea) |
| Shooting Star | prairie | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/flower/prairie-shooting-star): open prairie |
| Little Bluestem, Feather Reed Grass, Fountain Grass | coastal | [UW Miller Library](https://depts.washington.edu/hortlib/pal/ornamental-grasses-that-tolerate-salt-water/), quoting Minnesota Extension: high tolerance |
| Tufted Hairgrass | coastal | Same page, from King County's guide to marine shorelines |
| Miscanthus, Mexican Feather Grass | coastal | Same page, from Tenenbaum's *Gardening at the Shore*, which calls the feather grass aggressive |
| Alkali Sacaton | coastal | [NC State](https://plants.ces.ncsu.edu/plants/sporobolus-airoides/): tolerates saline soil |

Yarrow, sedum, globe thistle, knautia and verbena joined the nectar terms, from butterfly lists including
[Gardeners' World](https://www.gardenersworld.com/plants/perennials-for-butterflies).

## Still loose

- **Coastal's name match predates this.** Prairie Dropseed and Sideoats Grama carry `coastal` because
  of a term in a list, and no source read supports or contradicts it. Fakahatchee is a mismatch the other
  way: the catalog's dwarf form is marked salt-intolerant from its own review, while UF's list names
  Fakahatchee grass as at least moderately salt tolerant.
- **Prairie is a test of sun, not of place.** A desert marigold is a native forb of full sun, so it is on
  the list. A native plant of open ground is closer to right than the old list, not the same as a prairie
  plant. Only the plants of part shade were checked against a habitat.
- **Modern recommends 282 plants**, since every woody plant carries `structure`. It is broad rather than
  false, and was left alone.

## 0.9.132: Rain garden, the dune plants, and the fescues

Reviewed November 17, 2026. Counts are family cards, what the New garden page and the catalog show:
any origin or the garden's own natives, in a North American or a European garden.

| Style | z5 any NA | z5 native NA | z5 any EU | z5 native EU | z7 any NA | z7 native NA | z7 any EU | z7 native EU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Eligible | 447 | 289 | 447 | 129 | 515 | 328 | 515 | 142 |
| Cottage | 279 | 155 | 279 | 89 | 317 | 176 | 317 | 94 |
| Prairie / Meadow | 99 -> 97 | 99 -> 97 | 48 | 48 | 111 -> 107 | 111 -> 107 | 52 | 52 |
| Pollinator | 292 | 165 | 292 | 95 | 334 | 188 | 334 | 100 |
| Shade / Woodland | 213 | 135 | 213 | 62 | 250 | 156 | 250 | 69 |
| Japanese | 54 | 38 | 54 | 9 | 63 | 43 | 63 | 13 |
| Mediterranean | 59 -> 58 | 37 -> 36 | 59 -> 58 | 22 | 84 -> 81 | 53 -> 50 | 84 -> 81 | 30 |
| Modern | 152 | 97 | 152 | 39 | 174 | 113 | 174 | 44 |
| Gravel / Rock | 80 -> 79 | 55 -> 54 | 80 -> 79 | 28 | 99 -> 96 | 71 -> 68 | 99 -> 96 | 32 |
| Formal | 22 | 9 | 22 | 6 | 34 | 18 | 34 | 11 |
| Coastal | 28 -> 26 | 17 -> 16 | 28 -> 26 | 9 -> 8 | 42 -> 38 | 29 -> 26 | 42 -> 38 | 11 -> 10 |
| Rain garden (new) | 82 | 82 | 6 | 4 | 83 | 83 | 8 | 5 |

### Rain garden

A rain garden fills after a storm, drains within a day or two, and is dry between storms, so its
plants take standing water and drought. `rain` is a place style, like Prairie and Coastal: a plant
needs the `rain` role, and the sum of its other roles cannot stand in for it. Without that rule a
moist woodland fern clears the bar on `wet` and `native` alone.

A plant earns the role two ways.

- **The lists name it.** Thirteen rain garden lists were read (City of Madison, Brooklyn Botanic
  Garden, Missouri Botanical Garden, NC State, Virginia Cooperative Extension, University of
  Minnesota Extension, Illinois DNR, Penn State Extension, UW-Madison Extension Waukesha County,
  Nebraska Extension, the RHS twice, and the UK Rain Garden Guide). A plant is listed for a continent
  where two of that continent's lists name it for the basin or the moist slope, or one puts it in the
  wet bottom and its own record already says moist soil. Dry-rim, berm and upland entries were not
  counted, and nor were genus-only entries ("Carex spp.", "Hosta spp."). `RAIN_GARDEN_KEYS` in
  `js/ui.js` holds the result; [rain-sources.json](rain-sources.json) holds every list, what was
  counted, and every vote, and a test holds the two together.
- **It is a wet meadow sedge or grass of the garden's own region**: open ground and moist soil, the
  plants filed under Wet meadow on their tabs. They are a rain garden basin's matrix, and the lists
  name few sedges by species.

A list speaks for its own continent. The RHS and the UK guide name yellow flag, pendulous sedge,
bugle and miscanthus, which escape in North America; the American lists name swamp milkweed and
Joe Pye weed, which no British list does. So a European rain garden is a short list (6 cards at zone
5, 8 at zone 7): the two British lists are short, and no full-sun wet sedge or grass in the catalog
is European.

**Water plants.** A floating plant needs standing water and never earns the role. A marginal earns it
only where the lists name it: soft rush, blue flag (both records), arrowhead, pickerelweed, marsh
marigold, soft-stem bulrush and American sweet flag in North America, and soft rush, yellow flag and
calla lily in Europe. Cattails, thalia, water canna, taro, golden club, arrow arum, the Japanese and
Louisiana irises, bogbean and flowering rush are on no list read. NC State and Waukesha name
pickerelweed, Waukesha in its clay-soil list. Brooklyn, Waukesha and Minnesota all name "Acorus
calamus" among natives, so the vote goes to American sweet flag, not the Asian record.

**The wet-ground perennials of 0.9.79 are mostly off.** Swamp rose mallow and monkey flower are on
the lists; ligularia, rodgersia, the candelabra primulas, umbrella plant, giant rhubarb, meadowsweet,
ragged robin, water avens and cuckoo flower are not. They want moist soil all year, which is a bog,
not a basin that dries out. Those records carried a `rainGarden` role, authored with the pond and bog
batches and read by no code; it is gone, as are the copies on eastern hemlock, arborvitae, western
red cedar and black spruce.

**The four sedges.** Bristly Sedge is on four lists. Awl-fruited Sedge is on Illinois DNR's moist
list, and the MPCA's *Plants for Stormwater Design* (2024) calls it well adapted to wet basins. Lake
Sedge is on Minnesota Extension's list, and the same MPCA guide says it is aggressive and "would
probably not be ideal for landscape conditions or rain gardens". Prairie Sedge is on no rain garden
list; Minnesota Wildflowers and Go Botany place it in wet meadows and calcareous fens. Lake and
Prairie Sedge carry the role as wet meadow sedges, not from a list.

The weights put sun and natives first: `rain` 9, `wet` 4, `native` 4, `prairie` 3, `pollinator` 3,
`matrix` 2, then 1 each for `naturalistic`, `seedhead` and `structure`. Without `prairie`, foamflower
led the list and pictured the style's card.

### The Rain garden list

North America, zone 5, any origin (90 species; 82 cards): big bluestem, switchgrass, Indiangrass,
northern sea oats, bottlebrush grass, eastern gamagrass, bushy bluestem, prairie cordgrass, Canada
wild rye; fox, Gray's, prairie, broom, palm, tussock, lake, awl-fruited, bristly, Hayden's, fringed,
Emory's and porcupine sedge; wild bergamot, scarlet bee balm, Virginia mountain mint, willow and
eastern bluestar, New England aster, Culver's root, Joe Pye weed and 'Baby Joe', prairie ironweed,
foxglove beardtongue, swamp milkweed, prairie and dense blazing star, sneezeweed, brown-eyed Susan,
false sunflower, southern and northern blue flag, golden Alexander, prairie dock, cardinal flower,
great blue lobelia, white turtlehead, golden ragwort, queen of the prairie, obedient plant,
foamflower, ostrich, cinnamon, royal, interrupted, sensitive and marsh fern, woodland phlox, wild
geranium, Virginia bluebells, jack-in-the-pulpit, zigzag goldenrod, Virginia waterleaf, blue
mistflower, swamp rose mallow, monkey flower; red-twig dogwood, arrowwood, American cranberrybush,
winterberry, black chokeberry, inkberry, American elder, summersweet, Virginia sweetspire,
buttonbush, spicebush; pickerelweed, blue flag, arrowhead, marsh marigold, soft rush, soft-stem
bulrush, American sweet flag; swamp white oak, red maple, river birch, bald cypress, eastern redbud,
sweetbay magnolia. Zone 7 (91 species; 83 cards) adds yaupon holly and White-topped Sedge and loses
American sweet flag.

Europe, zone 7, any origin: miscanthus, bugle, Siberian iris, cardinal flower, yellow flag, soft rush,
pendulous sedge. Zone 5 loses the pendulous sedge.

The shade plants (the ferns, foamflower, woodland phlox, wild geranium, bluebells, waterleaf,
jack-in-the-pulpit, zigzag goldenrod) are there because two lists put them in a shady rain garden,
mostly Brooklyn's shady wet zone and Madison's mesic slope. Hosta, astilbe and the woodland plants of
moist soil that no list names are not.

### Prairie and the dune plants

Prairie gives a native grass, forb or bulb of full sun the `prairie` role, which a dune grass is. A
record whose sources put it on the dunes now carries an authored `dune` role, which implies `coastal`
and stops the computed `prairie` one: American Beachgrass, Sea Oats and Coastal Panicgrass (the grass
audit's sources: the Wildflower Center, NC State, Hoffman), Spanish Dagger (the Wildflower Center:
coastal dunes from North Carolina to Florida), Seaside Daisy ([Calscape](https://calscape.org/Erigeron-glaucus-(Seaside-Daisy)):
"bluffs, dunes and beaches") and Beach Sunflower ([FNPS](https://www.fnps.org/plant/helianthus-debilis-debilis):
"beach dunes, coastal grasslands, sandhill"). All six stay on Coastal. Prairie lost American
Beachgrass and Coastal Panicgrass at zone 5, and Sea Oats, Spanish Dagger and Seaside Daisy as well
at zone 7. Little Bluestem, which has an authored `coastal` role for salt tolerance, stays a prairie
plant: the marker is the dune, not the coast. Adam's Needle and Giant Wild Rye grow on dunes and well
inland, and keep the prairie role.

### The fescues

The word lists matched `fescue`, so every fescue was a Mediterranean, gravel and coastal plant. The
sources name *Festuca glauca*: the UW Miller Library's list of grasses for salt water quotes
Tenenbaum's *Gardening at the Shore* for it and Minnesota Extension for 'Elijah Blue'. The term is now
`festuca glauca`. Idaho Fescue left Coastal, Mediterranean and Gravel; California and Roemer's Fescue
left the same three (they fit zone 7, not 5); Large Blue Fescue left Coastal and stays on Mediterranean
and Gravel on its dry and silver roles.

### The coastal word list, measured and left

| Term | Plants it gives `coastal` | Read |
| --- | --- | --- |
| muhly | Pink, Ruby and Lindheimer's Muhly | Tenenbaum names *Muhlenbergia capillaris* (pink muhly) only |
| stipa | Giant Feather Grass, Purple Needlegrass | not read |
| panicum, switchgrass | Switchgrass | NC State: "slightly salt tolerant" |
| dropseed | Prairie Dropseed | nothing found either way |
| sideoats | Sideoats Grama | nothing found either way |
| yucca | Soapweed, Adam's Needle, Red and Beaked Yucca | Adam's Needle grows on dunes; the desert yuccas were not read |
| bald cypress | Bald Cypress | NC State: resistant to salt and wind |
| birch | River and Paper Birch | the Morton Arboretum lists road salt among their tolerances; no source read on salt spray |

`fescue` is still in the Modern list, so Idaho, California, Roemer's and Large Blue Fescue are
recommended for Modern on the word. A fine bunchgrass in a block is a modern planting, so it was left.

### Older builds

A garden saved with `type:'rain'` and opened by 0.9.131 or earlier reads as Any garden: the style has
no weights there, so everything is recommended, and the Garden criteria dialog shows Any garden.
`normalizeDesign` keeps the id, so the garden comes back a Rain garden when a newer build opens it.
