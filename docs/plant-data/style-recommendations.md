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
