# Water plants

Implemented November 6, 2026, version 0.9.77. Adds 25 base records and 14 cultivars, taking
water plants from 9 records and no cultivars to 34 records and 14 cultivars. Catalog totals:
667 base records / 505 nested choices. No runtime dependency or remote request was added.

Evidence: [water-sources.json](water-sources.json) records every source URL, and names every
field that is a planning value rather than a published figure, and why.

## Why this pass

An audit of seven published pond plant lists found the catalog's natives well chosen (marsh
marigold on 6 of 7, pickerelweed on 5) and the staples absent: not one cattail, rush, bulrush,
horsetail or sweet flag, no canna or thalia, and no water lily but the native white. Nothing
flowered pink or red, nothing stood taller than 4 ft, and Europe had no water lily at all. The
counts are a rough guide to popularity, drawn mostly from retail and gardening sites plus the
RHS and Iowa State, and the RHS list is UK-focused.

| Added | Records |
| --- | --- |
| Floating | White water lily, hardy water lily hybrids and six cultivars, sacred lotus, spatterdock, water hawthorn |
| Uprights | Common and dwarf cattail, soft rush and 'Spiralis', soft-stem bulrush and 'Zebrinus', scouring rush, dwarf horsetail |
| Sword leaves | American and Eurasian sweet flag and 'Variegatus', Japanese, rabbit-ear and Louisiana iris and 'Black Gamecock' |
| Broad leaves | Thalia, water canna and two hybrids, golden club, water plantain, arrow arum, taro and 'Black Magic', calla and 'Crowborough' |
| Others | Water forget-me-not, flowering rush |

Left out on purpose: water hyacinth, water lettuce, parrot feather, purple loosestrife, frogbit
and chameleon plant are invasive and widely restricted, and submerged oxygenators such as
hornwort would barely show in the garden. Bank-side plants that are not pond plants, such as
swamp rose mallow and pitcher plant, remain a gap for another pass.

## The marginal rule

`marginal:true` (`isMarginalDef`, core.js) marks a water plant that stands in shallow water or on
the wet ground beside it. Twenty-seven records carry it, including the seven existing marginals.
The other seven float and stay on water.

- **Where:** a marginal plants on water or any plantable ground, in a pot on paving (a tub water
  garden), and never into a bare path. Tap, drag, drift, fill, selection moves and replacement all
  follow this.
- **Out of reach of water is advice, not a refusal** (`marginalOutOfReach`, `marginalDry` in
  `PLANT_PLACEMENT_POLICY`). More than two tiles (3 ft) from water the toast goes amber and says to
  plan on a bog or a rain garden, because those are wet ground no water tile can describe. A gesture
  says it once for the whole stroke, and a pot never asks.
- **Digging and turfing:** water may be painted under a marginal, the one planting a pond can be dug
  around. Lawn may not be laid over a floating plant's tile, which used to strand a lily on grass.
- **A marquee carries its water.** Moving a lily by selection normally brings its water tile along,
  so it stays on water wherever it lands. The rule only bites on a selection whose terrain stays
  behind.

Water depth is not modelled: a lily may be planted at the very edge of a pond. Depth guidance lives
in each blurb. The existing `waterblueflag`/`northernblueflag` pair remains because the keys are in
saved gardens, but no new plant needs a second record to reach the bank.

## Drawing

Every option is data gated, and no renderer checks a species key.

- **`form:'emergent'`** (`drawEmergent`) draws what no other form did: straight verticals from a
  tight base. Strap blades (`blades`) and leafless culms (`stems`) with `curl` (corkscrew), `bands`
  (zebra, in the season's `edge` colour) and `joints` (horsetail), and a head of `tuft`, `droop` or
  `cone`, stiff separate `heads` for a cattail, or `spadices` for sweet flag. Thirty culms stroke in
  three tone batches rather than thirty strokes.
- **`waterleaf`** gains `padSpread` and `padFlat` (pads lying flat and apart), `flowerOnPads`,
  `raisedPads` (a lotus's saucers on stalks), `flowers`, `flowerScale`, `petals`, `doubleFlower`,
  `flower:'cup'` and `'fork'`, centre colour from `eye` and leaf blotches from `edge`. The whole
  lily family adopted the flat layout, the existing fragrant lily and American lotus included: pads
  had piled into a mound that read as a rock.
- **`umbel`** gains `umbelStyle:'spathe'` and `'spadix'` (`drawSpathe`) and `whorlRows`/`whorlN`/
  `whorlGap`/`whorlTaper`. The shared petiolate leaf gains `leafDroop`, which is taro.
- **Yellow flag now draws as an iris.** It had been a spike of florets since it was added.

What dies back draws nothing in winter, shadow included (`dormantWhenBare`). The uprights carry the
pond through winter, which is the point of them.

## Regional cautions

Five new records carry a sourced caution for North America, so the default invasive filter hides
them there. Flowering rush (Minnesota, Ontario) and sacred lotus (Wisconsin) are legal restrictions.
Water forget-me-not rests on NC State's unnamed "one or more Midwestern states", and taro and calla
on Cal-IPC, which is the single-source over-reach already recorded under Open decisions in
[regional-guidance.md](regional-guidance.md). A gardener can still show them with the filter.

`dev/invasive-check.js` cannot see flowering rush: it is on neither cached list, and neither is
sacred lotus nor water forget-me-not. Those notes were read and written by hand.

Common cattail carries no caution note: it is native to North America, so the filter would keep it
anyway, and its habit of taking over is stated in the blurb instead.

## Open questions

- Zones and sizes marked as estimates in `water-sources.json` deserve a check against a nursery in
  hand. Missouri Botanical Garden pages failed a certificate check on direct fetch, so their values
  come from search-result excerpts.
- `synonyms` here also carries common names such as Horsetail and Elephant Ear, because the app only
  searches that field and never displays it. Earlier records use it for botanical names alone.

## Verification

`node tests/run.js` passes with 9 new tests. Nine mutations of the new rules were each caught by the
suite. `dev/water-review.html` shows every water plant in four seasons at library size and at true
garden scale side by side (`?only=`, `?seasons=`, `?scaleSeason=`, `?check`, `?bench=1`): 576 sprite
edge checks came back clean in each renderer. Bake cost in Chrome is at most 0.45ms for any new plant
against 0.55ms for switchgrass and 0.26ms for coneflower. In a real garden, real pointer taps gave
the refusal on land, the amber advice away from water, and planting on the bank and in the pond, and
the pond read correctly at 145% zoom in all four seasons. Physical-device checks were not run.
