# Daisy family audit (Nov 2026, 0.9.96)

Sneezeweed, daisies, coneflowers, black-eyed Susans and sunflowers: 40 choices
before, 49 after. Each was looked at in four seasons, as a close-up of its
flower head, and at true scale beside a 6 ft post, in `dev/daisy-review.html`
(`?batch=sunflowers`, `?only=key,key:cv`, `?ov=` to try a change, `?check`,
`?bench=1`). The tickseeds and prairie dock are on that page as the nearest
look-alikes.

All of these share the `cone` form: a basal fan, a few stems, heads at the
tips. The defects were in the data that form reads, so every fix but two is
data. The two renderer options are opt-in, and drawing every plant in the
catalog through the old and new `draw.js` with the old data gave identical
canvas call streams (10,344 draws).

## What was wrong, and what changed

| Plant | Problem | Change |
| --- | --- | --- |
| Maximilian, sawtooth, ashy, woodland sunflower | Dark brown button, so each drew as a black-eyed Susan. All four have yellow disks (Minnesota Wildflowers; missouriplants.com; NC State; Illinois Wildflowers). | Yellow buttons. Stiff, willowleaf, swamp and beach sunflower keep their dark ones, which are right. |
| Sawtooth, ashy, woodland sunflower | Bare poles over a basal fan; the real plants are leafy to the flowers. | Stem leaves: alternate on sawtooth, opposite pairs on ashy and woodland; fewer, shorter basal leaves; sawtooth branched into three heads a stem. |
| Willowleaf sunflower | A 34-blade basal fan reaching a third of the plant's height either side, plus starbursts on the stems: it read as a yucca or a cycad. | Stems clothed top to bottom in drooping thread leaves (new `stemLeafDroop`, `stemLeafTop`), a short basal fan, no starbursts (`crowns:0` now means none). |
| Sneezeweed (species) | Brown button; *Helenium autumnale* has a yellow one (missouriplants.com, Illinois Wildflowers). Seven heads bunched on bare stalks. | Yellow button; leafy stems branching into a broad spray, three heads a stem. The copper cultivars keep their brown buttons. |
| Black-eyed Susan, 'American Gold Rush', brown-eyed Susan | The dark cone covered over half the head, so the clump read as dark buttons ringed in gold. A real cone is about a quarter of a 3 in head. Clumps were narrow bunches. | Smaller cones; wider clumps; leafy stems on black-eyed Susan. |
| Purple coneflower | "The leafiest of the tribe" in its own blurb, drawn with no stem leaves. | Stem leaves, a little wider clump. |
| 'Tiki Torch', 'Cheyenne Spirit' | Two orange coneflowers drawn alike, both with the species' drooping rays although Tiki Torch's note says flat. | Rays held flat on both; Cheyenne Spirit shown as the amber-gold member of its mixed strain. |
| Oxeye vs Shasta daisy | Near-identical heads. A Shasta's is about 3 in, an oxeye's under 2 in. | Oxeye heads smaller, Shasta's larger. |
| Stiff sunflower | Blurb said "clean yellow disks"; they are usually purplish brown (Minnesota Wildflowers). | Blurb corrected; cone sized like the others. |
| Beach sunflower | Its dark eye was a dot under the rays, so flowers read as yellow coins. | Eye sized on its own (new matflower `eyeR`). |

Left alone because they look right: pale purple, Topeka, narrowleaf and yellow
coneflower, 'Magnus', 'White Swan', gray-headed coneflower, Mexican hat, great
coneflower, false sunflower, swamp sunflower, blackfoot, four-nerve,
Engelmann's and seaside daisy.

## Look-alikes

Still close after the audit, all on purpose or for lack of a better answer:

- **Shasta and 'Becky'.** 'Becky' is the commonest Shasta, and the species
  record is the generic garden hybrid; the two are one plant under two names.
- **Oxeye and Shasta.** Now told apart by head size and height, but both are
  white with a gold eye.
- **'Moerheim Beauty' and 'Sahin's Early Flowerer'.** Both copper-orange with
  brown buttons; Sahin's is more orange and flowers earlier. 'Rubinzwerg' was
  added as the clearly different red.
- **Brown-eyed Susan and swamp sunflower.** The same small gold dark-eyed head;
  the habit separates them (3 ft branching plant against a 6 ft colony that
  flowers in October).
- **Maximilian and sawtooth sunflower.** Both tall and yellow-eyed. Maximilian
  flowers along the top of the stem, sawtooth in a branched top. They are
  confused in the wild too.
- **Gold daisies with gold centres:** Engelmann's daisy, four-nerve daisy,
  lanceleaf coreopsis, false sunflower, woodland sunflower. At garden scale
  the head is the same; height and leaf tell them apart.
- **'Prairie Glow' and Mexican hat.** Both red-orange; Mexican hat's tall
  thimble separates them.

Fixed: Tiki Torch against Cheyenne Spirit, and four sunflowers against the
black-eyed Susans.

## Cultivars added

| Choice | Why it is not a duplicate | Sources |
| --- | --- | --- |
| Echinacea 'Green Jewel' | the only green coneflower | Proven Winners, RHS (50-70 cm) |
| Echinacea 'Pink Double Delight' | a pompom, drawn as a pink dome over drooping rays | Rita's Garden Path, J. Parker's, CFIA trial (55 cm) |
| Helenium 'Rubinzwerg' | ruby red, against two copper-orange cultivars | RHS, Tesselaar, Perennials.com |
| Rudbeckia triloba 'Prairie Glow' | red-orange tipped yellow | Gardenia, Grimm's, SiteOne (36-48 in) |
| Leucanthemum 'Banana Cream' | butter yellow fading to cream, compact | Perennials.com, Proven Winners (15-18 in) |
| Heliopsis 'Burning Hearts' | burgundy foliage, purple stems, copper eye | North Creek, Gardenia (36-48 in) |
| Heliopsis 'Loraine Sunshine' | white leaves netted green | USPP10690, Plant Delights, Perennials.com |
| Helianthus salicifolius 'Low Down' | dwarf mound, not a 6 ft column | USPP13197, Garden Center Marketing, Rita's Garden Path |
| Helianthus 'Lemon Queen' | pale lemon, bushy 6 ft; a hybrid of stiff sunflower and Jerusalem artichoke, filed under stiff sunflower | RHS, Cotswold Garden Flowers |

Not added: 'Goldsturm' and 'Little Goldstar' (a test already records them as
redundant), Echinacea 'Hot Papaya' (another orange double), Helenium 'Mardi
Gras' (its bicolour cannot be shown and would read as Sahin's), 'Butterpat'
(would now read as the species), Heliopsis 'Summer Sun' (the species again),
Shasta 'Snowcap' (a small Shasta reads as an oxeye).

## Noticed, not changed

- Prairie dock (*Silphium terebinthinaceum*) is drawn with a dark brown
  button; its disk florets are reported yellow. Outside this list and not yet
  sourced here.
- Maximilian sunflower really flowers in the upper leaf axils, a spike of
  heads down the top third of the stem. The `cone` form can only put heads at
  stem tips; `heads:4` approximates it.

## Cost

Interleaved bench in headless Chrome, min of three rounds, the 16 changed
choices in Summer, Fall and Winter: 9.6 ms to 11.7 ms summed per bake, the
worst single bake 0.46 ms (willowleaf in fall). Paid once per sprite bake,
never per frame. 2,352 sprites and 784 previews checked, none touching an edge.
