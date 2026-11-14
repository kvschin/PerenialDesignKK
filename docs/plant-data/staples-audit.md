# Stonecrop, blazing star, betony and allium audit (Nov 2026, 0.9.101)

Four families that were close but drew as some other plant. 41 choices
checked, 24 records changed (5 stonecrops, 4 blazing stars, 2 betonies, 13
onions). Each was looked at in four seasons, as a close-up of its head, at true
scale beside a 6 ft post, coming up through spring, and planted in a garden in
the app, in `dev/staples-review.html` (`?batch=stonecrop|liatris|betony|allium`,
`?only=key,key:cv`, `?ov=` to try a change, `?headFrac=`, `?check`,
`?bench=1`). Yarrow, mountain fleece and meadow sage are on the page as the
look-alikes.

## What was wrong, and what changed

| Plant | Problem | Change |
| --- | --- | --- |
| Stonecrops ('Autumn Joy', 'Matrona', 'Autumn Fire', 'Purple Emperor', 'Autumn Charm') | Drawn on the umbel form: a fan of leaves at the ground and bare stalks each topped by a spray of dots, so they read as small yarrows. An upright stonecrop is a bouquet of stout succulent stems clothed to the top in fleshy leaves, each ending in a broad flat head of tiny florets, the heads crowding into one domed top. *H. spectabile* is about 18 in tall and as broad, with flat heads about 6 in across (Wikipedia). | `habit:'stonecrop'` (`drawStonecrop`): stems placed in the round over a disc and painted far to near, fleshy obovate leaves in a spiral up every stem to the head (batched by light), flat broccoli plates with a scalloped rim and crumb texture on top. Green-cream buds before the bloom, the flower, then the dried head, which holds its own cap of snow; a few shrivelled leaves stay on the dead stems in winter. In spring the short shoots carry nearly full-size leaves, the knobbly rosettes a stonecrop comes up as. |
| 'Matrona' | Grey-green leaves with no sign of the purple rim the selection is grown for. | A season `edge` colour draws a purple margin round every leaf. |
| 'Autumn Charm' | "Cream-edged foliage" in the blurb, a uniformly yellowish leaf in the drawing. | A green leaf with a true cream margin (`edge`, `edgeInset`). |
| Blazing stars (dotted, cylindric, prairie, dense and 'Alba') | Each spike a column of round beads with a short whisker each: a grape hyacinth or a meadow sage. A blazing star's spike is a column of small heads, each a tuft of long thread-like styles, so it reads as feathery. It blooms from the top down (Minnesota Wildflowers for *L. pycnostachya*, *L. cylindracea* and *L. punctata*; Wildflower Center for *L. spicata*). Stems are leafy right up to the spike with narrow leaves shrinking upward. | `spikeStyle:'blazingstar'` (`drawBlazingStar`): heads spiral round the axis, each a purplish cup with a fan of threads, painted back half, axis, front half. The open part grows down from the top with the season; a stem whose turn has not come is buds the whole way; in seed every head is a tan puff of pappus. `headForm:'cylinder'` gives cylindric blazing star its few long, spaced heads with threads only from their tops. `stemLeafStyle:'spiral'` clothes the stems in narrow upward leaves to the spike. Dotted blazing star loses its basal tuft and becomes a clump of many short leafy stems, as it grows from a taproot. |
| Betony and 'Hummelo' | Spikes were tapering columns of round florets, a grape hyacinth on a stalk, over a sheaf of upright leaves; bare flower stalks stood up in spring. RHS: a clump of scalloped, oblong leaves with dense terminal spikes of purplish-pink flowers on upright stems. | `spikeStyle:'betony'` (`drawBetonySpike`): whorls of two-lipped flowers round the top of each stem, crowded above with the lowest whorl set apart, built in the round, the top whorl in bud; a dark knobbled spike in seed. `leafStyle:'rosette'`: a low mat of stalked, scalloped, heart-based leaves leaving the crown in every direction. Flower stems only in flower and seed (`bloomStemsOnly:'seed'`), with a pair or two of small leaves. |
| Dense alliums (Globemaster, Purple Sensation, Gladiator, Mount Everest, Pink Jewel, 'Millenium', azure) | A flat wheel of spokes with a star on each tip, a firework. These heads pack their florets so tightly they read as a solid ball with a starry skin (*A. hollandicum*: a spherical umbel of many star-shaped flowers). | `headShape:'ball'` (`drawAlliumHead`): florets on a Fibonacci sphere tilted toward the viewer, the near ones covering the face and the far ones peeking round the rim, each lit by its own surface normal; a dark core under them. In seed, pale pedicels each ending in a capsule. |
| Star of Persia | A flat starburst, in one plane. | `headShape:'starburst'`: the same sphere, few large stars far out on visible pedicels, the far half painted first. |
| Drumstick allium, 'Red Mohican' | Spiky red stars. Both are tight eggs of small bells (*A. sphaerocephalon*: spherical to egg-shaped, tightly packed). | `headShape:'egg'` with `floretShape:'dot'`; the drumstick keeps its green lower half (`headAccent:'lower'`), 'Red Mohican' its pale tuft as short stalks out of the top. |
| *A. atropurpureum*, prairie onion | A half fan of spokes. Both are domed umbels (*A. atropurpureum*: hemispherical). | `headShape:'dome'`, the top of the sphere. |
| All of the above alliums | A stem not yet in flower was a bare stick. | A bud in its papery spathe. |
| Nodding and prairie onion | Bare stalks in spring; in winter, with nothing authored, snow hung in the air. | Stems only in flower and seed, and `dormantWhenBare`: nothing on the tile while dormant. |
| Betony, the bulb alliums | `drawPlant`'s closing highlight strokes hung in the air among the stems. | `lowRosette:true`. |

Colour changes: 'Autumn Joy' summer buds greener (`#b8c79e`), 'Autumn Joy' and
'Autumn Fire' fall leaves still grey-green rather than tan, cylindric blazing
star's cups a dull purple (`bract`).

## Renderer, opt-in

Every option is read only by a record that sets it. Drawing every choice in the
catalog through the old and new `draw.js` with the old data gave identical
canvas call streams (10,480 draws: each choice, four seasons, two growths), and
every unchanged plant with the new data was identical too (10,272 draws). A
negative control on the changed plants differed in 194 of 208.

- Umbel `habit:'stonecrop'`: `stems`, `head`, `plateY`, `clumpW`, `baseW`,
  `leafNodes`, `leafL`, `leafWR`, `leafRise`, `leafTeeth`, `edgeInset`,
  `winterLeaves`; a season's `edge` and `bud` colours. `LEAF_SHAPES.obovate`.
- Spike `spikeStyle:'blazingstar'`: `heads`, `spikeLen`, `spikeW`, `capW`,
  `capH`, `threads`, `threadLen`, `threadW`, `threadFan`, `headForm:'cylinder'`;
  `bract` and `bud` colours.
- Spike `spikeStyle:'betony'`: `whorls`, `spikeLen`, `whorlR`, `whorlN`,
  `interrupt`, `tubeW`, `lipR`.
- Stemmed forbs: `stemLeafStyle:'spiral'` (`stemLeaves`, `stemLeafLen`,
  `stemLeafW`, `stemLeafTop`) and basal `leafStyle:'rosette'` (`leafLen`,
  `leafWR`, `leafRise`, `leafSpread`).
- Allium globes: `headShape:'ball'|'egg'|'dome'|'starburst'`, `florets`,
  `floretR`, `floretShape:'dot'`.

## Cost

Interleaved bench in headless Chrome against 0.9.100, min of four passes, each
choice in Summer, Fall and Winter, eight draws a bake:

| Family | Bakes | Before | After | Worst bake after |
| --- | --- | --- | --- | --- |
| Stonecrops | 15 | 1.65 ms | 4.45 ms | 0.40 ms ('Matrona', Fall) |
| Blazing stars | 15 | 1.99 ms | 4.18 ms | 0.44 ms (prairie, Summer) |
| Betony | 9 | 0.66 ms | 2.51 ms | 0.38 ms ('Hummelo', Summer) |
| Alliums | 42 | 2.86 ms | 4.42 ms | 0.28 ms (Globemaster, Summer) |
| Controls (yarrow, mountain fleece, meadow sage) | 33 | 3.35 ms | 3.30 ms | 0.25 ms |

The old drawings were cheap because they were sparse. The new ones sit inside
the catalog's range (wild bergamot is 0.63 ms a bake). Paid once per sprite
bake, never per frame. 1,824 sprites and 608 library and tray previews checked
in both renderers, none touching an edge.

## Noticed, not changed

- Pretty garlic and nodding onion keep their hanging bells: those were right.
- The stonecrops carry no `heightIn`; their cards still quote the drawn height.
- 'Autumn Joy' is drawn with opposite-to-spiral leaves; Wikipedia's page for
  *H. spectabile* gives both alternate and opposite-or-in-threes.
- Liatris cultivars beyond 'Alba' ('Kobold', the dwarf dense blazing star) are
  absent.
