# Sedge audit

Audited November 6, 2026, against the catalog at 0.9.79: 32 records in the Sedge
category (31 *Carex* plus *Luzula nivea*). The data fixes shipped in 0.9.80, the drawing
in 0.9.81, recommendations and browsing by site in 0.9.82, and the missing species in
0.9.83. The rest of the model below is still open.

## Sources

- **[Mt. Cuba Center's Carex trial](https://mtcubacenter.org/trials/carex-for-the-mid-atlantic-region/)
  and its [data sheet](https://mtcubacenter.org/wp-content/uploads/2023/01/Carex-Website-Data-.xlsx)**
  are the best single source: 70 taxa with shade and sun ratings, foliage size, flower
  height, clumping or spreading habit, blade width in mm, and winter foliage. It covers
  Mid-Atlantic natives only, grown in Delaware. Its plants run larger than nursery
  figures, and "semi evergreen" need not hold in a cold zone.
- Lists counted for missing species:
  [Hoffman's Carex chart via Izel](https://www.izelplants.com/pub/media/pdf/Carex_Chart_Izel_Native_Plants.pdf),
  [Knoll Gardens](https://www.knollgardens.co.uk/product-category/ornamental-grasses/carex/),
  [Gardener's Path](https://gardenerspath.com/plants/grasses-rushes-sedges/best-sedge-varieties/),
  [Wildflower Center](https://www.wildflower.org/magazine/native-plants/versatile-sedges),
  [Fine Gardening](https://www.finegardening.com/collection/all-about-growing-sedges)
  (paywalled, captions only) and
  [Pure Air Natives](https://www.pureairnatives.com/cat/seeds-plants/sedges/bloom_colors-green-or-tan/).
- Could not be read: Plant Delights and New Leaf Natives (rate limited), Hoffman's blog and
  Oklahoma State (refused), the Shaw Nature Reserve PDF (certificate error), Prairie Moon
  (list loads by script). So the missing list is solid but not exhaustive.

## Shipped in 0.9.80

Nothing changed on the trial's word alone: each change also has a second source.

| Record | Change | Evidence |
| --- | --- | --- |
| Blue Wood Sedge | `leafW` 1.05 to 2.0, fewer and wider leaves, blurb no longer "fine-textured" | Trial: coarse, 14 mm. [FNA via Name That Plant](https://namethatplant.net/plantdetail.shtml?plant=2269): widest blades 6.3-14.7 mm. [LNPS](https://www.lnps.org/thinfruit-sedge/): about 1/2 in. |
| Cherokee Sedge | `leafW` 2.5 to 1.4, arching look, blurb no longer "broad-leaved" | Trial: medium, 6 mm. [Sems](https://www.semsgarden.com/en/plant/carex-cherokeensis): 1/4 in. |
| Inflated Narrow-leaved Sedge | `leafW` 1.15 to 1.6, fewer leaves | Trial: 10 mm. [Go Botany](https://gobotany.nativeplanttrust.org/species/carex/grisea/): 3.7-9.1 mm, and it notes the name is misleading because the leaves are not especially narrow. |
| Gray's, Fox, Broom | `sun` full to part, so a canopy no longer stunts them. Fox and Broom blurbs say so. | Trial flags all three for shade. [NC State](https://plants.ces.ncsu.edu/plants/carex-grayi/common-name/asa-grays-sedge/) (Gray's), [Chicago Botanic Garden](https://www.chicagobotanic.org/plantcollections/plantfinder/carex_vulpinoidea--brown_fox_sedge) (Fox), [Prairie Restorations](https://www.prairieresto.com/plant/carex-scoparia/) (Broom). |
| Oak, White Bear, Brome-like, Cherokee, Bristly, Ivory, Gray's, Inflated Narrow-leaved, Pennsylvania, Plantain-leaf, Rosy, Long-beaked, Fox | Fall and Winter foliage keep some green | Trial: semi-evergreen. [New Moon](https://www.newmoonnursery.com/plant/Carex-sprengelii) and other nurseries agree. RHS calls Gray's deciduous, and only a [trade listing](https://www.nvknurseries.com/plant/Carex-comosa) backs Bristly, so these two are the weakest. |

`roleMatches` also moved to whole words, which took false roles off 15 species. The
ones that matter are in `CLAUDE.md`. Style lists changed only by losing plants that
never belonged: cottage 546 to 539, butterfly 544 to 539, Mediterranean and gravel lose
2 each, prairie loses cottonwood.

## Shipped in 0.9.81: the drawing

What it fixed, measured or seen at true scale in the real renderer:

1. **Low sedges did not form a carpet.** They read as separate dots on mulch, covering about
   3-13% of their tile, and 28 of 32 drew under 70% of their stated spread. Now small fans on
   a wide crown over a coat of hairs; `dev/sedge-review.html` shows them knitting. Tall sedges
   stay narrower than their stated spread on purpose, since ground and height are different
   scales in this projection and a true-width 30 in sedge comes out squat.
2. **Palm sedge looked like a trellis:** five parallel poles with chevrons at matching heights.
   Now arching stems with leaves in a spiral, shortening toward the top. 'Oehme' draws
   shorter than the species, as it grows.
3. **Seed heads were in the wrong place.** All met in one torch, and on low sedges they
   floated above the plant: Pennsylvania's reached 2.5x its real height. They now stand with
   their own tuft at the height in flower. `brush` drew a tulip and is now a bristly spike,
   and Bristly Sedge's nod.
4. **Snow looked like eggs:** mid-clump on tall sedges, in the air above palm sedge. It lands on
   the foliage now.
5. **Several sedges looked the same.** Mead's and Sun Sedge overlapped 80% in nearly one colour.
   Habit now separates them (a weeping mop, upright tufts, broad straps held up or lying out),
   and so do colours each with a source below.
6. **Library and card previews were specks.** `libCanvas` caps scale at 1.15x, which left an
   8 in sedge about 14 px wide. The cap is unchanged: the drawing is wider, so previews fill.

Colours changed to separate look-alikes:

| Record | Change | Source |
| --- | --- | --- |
| Mead's Sedge | blue-green to grey-green | [Illinois Wildflowers](https://illinoiswildflowers.info/grasses/plants/mead_sedge.htm), [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/meads-sedge) |
| Sun Sedge | dark purplish brown spikes in spring | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/sun-loving-sedge) |
| Mountain Sedge | bright apple green, orange-bronze in autumn | [RHS](https://www.rhs.org.uk/plants/111578/carex-montana/details) |
| White Bear Sedge | pale green | [Go Botany](https://gobotany.nativeplanttrust.org/species/carex/albursina/) |
| Plantain-leaf Sedge | bright green; it was the darkest sedge | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/plantain-leaved-sedge) |
| Rosy Sedge | deep green | [New Moon](https://newmoonnursery.com/plant/Carex-rosea); a nursery's wording, so the weakest here |

Other plants: call-for-call identical to 0.9.80 across 1,180 choices and 38,816 draws. On a
676-clump garden with the GPU quiet, sprites held level (desktop 4.8-5.3ms a frame before and
4.7-5.0 after, phone 4.8 and 5.0) while the cache grew from 14.9 to 17MB on desktop and 30 to
34MB on a phone, of a 48MB budget. The procedural path costs more, about 94 to 135ms on desktop.
`dev/ff-accel-check.cjs` stayed accelerated in Firefox at about 165fps panning, though one run
of four, with another program holding the GPU, named a single frame while every later phase
read a probe of 0ms.

## Shipped in 0.9.82: recommendations and browsing

Style lists, sedges only, in a North American garden, across all 32 records:

| Style | Before | After |
| --- | --- | --- |
| Shade | 32 | 20: `sun:'part'`, not recorded on prairie |
| Prairie | 30 | 7 |
| Coastal | 31 | 2 |
| Cottage, Butterfly | 4 each | 0; those four had an authored spikelet `bloom` |

No plant of any other type changed role or recommendation, compared record by record
against 0.9.81. A European garden's Prairie list is Mountain Sedge alone, since the style
asks for the garden's own natives.

The Sedge tab now reads as five headed lists, which were dead code before: Meadow (6), Wet
meadow (6), Dry shade (5), Woodland (7), Moist shade (8).

**Where a source names prairie or meadow** (`roles:['prairie']`):

| Record | Evidence |
| --- | --- |
| Plains Oval | [Illinois Wildflowers](https://illinoiswildflowers.info/grasses/plants/ploval_sedge.html): black soil, sand and river-bottom prairies. [Wikipedia](https://en.wikipedia.org/wiki/Carex_brevior): dry to dry-mesic prairies. |
| Mead's | [Illinois Wildflowers](https://illinoiswildflowers.info/grasses/plants/mead_sedge.htm), [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/meads-sedge) |
| Sun Sedge | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/sun-loving-sedge) |
| Clustered Field | [Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/clustered-field-sedge): prairie swales |
| Fox | [Illinois Wildflowers](https://www.illinoiswildflowers.info/grasses/plants/brfx_sedge.htm): river-bottom prairies, prairie swales |
| Tussock | [Illinois Wildflowers](https://www.illinoiswildflowers.info/grasses/plants/tussock_sedge.html): prairie swales, sedge meadows |
| Broom | [Illinois Wildflowers](https://www.illinoiswildflowers.info/grasses/plants/pb_sedge.htm): wet prairies. [Prairie Moon](https://www.prairiemoon.com/carex-scoparia-lance-fruited-oval-sedge) names wet pastures and marshes instead, so this is the weakest. |
| Mountain (Europe) | [Pladias](https://pladias.cz/en/factsheet/default/2027): dry grasslands and meadows, and beech forest. [Notranjski Park](https://notranjski-park.si/en/discover/encyclopedia/plant-world/pencil-sharpeners/mountain-chess): dry meadows. Blurb no longer "woodland". |

**Prairie Sedge is left off.** [Go Botany](https://gobotany.nativeplanttrust.org/species/carex/prairea/) and
[Maine](https://www.maine.gov/dacf/mnap/features/carxpra.htm) have it in high-pH fens, and
[Minnesota Wildflowers](https://www.minnesotawildflowers.info/grass-sedge-rush/prairie-sedge) in
wet limy meadows and fens; none names a prairie. Its blurb said prairie swales and now says otherwise.

**Where a source names the coast** (`roles:['coastal']`):

| Record | Evidence |
| --- | --- |
| Clustered Field | [California Flora](https://www.calfloranursery.com/plants/carex-praegracilis/): tolerates salt spray. [Wikipedia](https://en.wikipedia.org/wiki/Carex_praegracilis): spreading along salted roads. |
| Slough | [Log House](https://loghouseplants.com/plants/shop/carex-obnupta-slough-sedge/): coastal wetlands and estuaries, slightly salt tolerant. [California Flora](https://www.calfloranursery.com/plants/carex-obnupta/): moist coastal sites. |

Pennsylvania Sedge stays off: the one claim found is a nursery answer about runoff, with a
caveat. This list is what could be read, not a survey, so another salt-tolerant sedge may be
missing. No sedge carries `wind` now, as no source was read for it.

**Slough Sedge moved to `sun:'part'`.** Log House gives full sun to part shade, and California
Flora calls it one of the more shade-tolerant sedges, under redwoods.

Also: `groundcover` now means 18 in or under, and `woodland` and `shade` follow the site rather
than the word sedge.

## Shipped in 0.9.83: the missing species

26 records and 6 cultivars, taking the tab from 32 records to 58 and from 1 cultivar to 7.
Every figure and its source is in `sedge-sources.json`, with `estimates` naming each value that
is a judgement. Sizes conflict badly: Fringed Sedge alone runs 1-4 ft across three sources.

| Gap the audit found | Before | After |
| --- | --- | --- |
| Sedges for zone 10 | 0 | 5 |
| Sedges for zone 11 | 0 | 0 |
| Sedges for zone 9 | 9 | 27 |
| Straight species native to Europe | 2 | 7 |
| Cultivars | 1 | 7 |

Where the reading changed the plan:

- **Zone 11 stays empty.** White-topped Sedge looked like the answer, but NC State stops at 10a and
  the Florida Native Plant Society at 10b, so it does not claim 11.
- **'Seersucker' is not a cultivar.** It is a common name for plantain sedge, so it became a synonym.
- **Berkeley Sedge carries a warning instead of a synonym.** The European *C. divulsa* is sold under
  its name, and is still left out as a record of its own.
- **Pendulous Sedge is hidden in North America by default, and kept in Europe where it is native.**
  Cal-IPC has it on the Watch list after a 2016 high-risk evaluation, and King County's assessment
  quotes the Pacific Northwest sedge guide saying not to plant it there.
- **Emory's Sedge warns rather than hides.** It is native, and running is its nature.
- **New Zealand sedges are filed under Meadow** because their sources give full sun first, though they
  grow in pastures and scrub rather than a meadow as such. Mountain, Broom and Plains Oval are there
  as well; the heading means open ground.

## Shipped in 0.9.84: the model

- **Evergreens are no longer cut back in spring.** In Today view every herbaceous plant dropped
  to 12% on the first day of Spring, Evergold and Christmas fern included. A plant with an evergreen
  role, or a Winter colour that is still green, now stands at full size all year.
- **Eight sedges may stand in water**: Tussock, Lake, Bristly, Slough, Sallow, Fringed, Awl-fruited
  and White-topped, each with a source in `sedge-sources.json`. Depth is not modelled.
- **Clump or colony** is recorded for 53 of 58 sedges, from the trial first. The rest have no source
  read, so they show nothing rather than a guess. A colony earns a "Spreads" tag on its card.

## Checked and left alone

- **Palm sedge in winter.** The trial says semi-evergreen, but
  [gardenia.net](https://www.gardenia.net/plant/carex-muskingumensis) and others call it
  deciduous with gold to copper fall colour. It stays gold, then straw.
- **Awl-fruited Sedge.** The trial's row is var. *maxima*, not this taxon. For winter,
  [Plant Lust](https://plantlust.com/plants/38301/carex-stipata/) says deciduous or
  semi-evergreen, so it stays straw. For light, the
  [Wildflower Center](https://www.wildflower.org/plants/result.php?id_plant=CAST5) says sun
  and [Prairie Restorations](https://www.prairieresto.com/plant/carex-stipata/) full or
  partial sun, so it stays `full`.
- **Cherokee Sedge height.** The trial's 35 in foliage is an outlier: [NC State](https://plants.ces.ncsu.edu/plants/carex-cherokeensis/) gives
  1-2 ft and nurseries 12-18 in. It stays 18 in.
- **Broom Sedge moisture.** The trial says moist to wet, but
  [Prairie Moon](https://www.prairiemoon.com/carex-scoparia-lance-fruited-oval-sedge)
  includes medium, so it stays `medium`.
- **`leafW` on the other sedges.** Tussock (5 mm) and Brome-like (2 mm) both draw wider
  than their real blades suggest, but `leafW` is not to scale on any plant, and a thin
  blade on a big clump reads as wisps. That belongs with the drawing work.

## Still open

### Missing species

- **Zone 11 has no sedge.** No source read reaches it. A South Florida flora might.
- **Well rated in the trial and still not here:** *C. bicknellii*, a prairie sedge, and others. The
  list above came from counting nursery lists, so it is not every good sedge.

### The model

- **Other plant types carry the same defect.** In a North American garden, measured at
  0.9.82: Butterfly and Cottage each recommend 33 of 40 grasses, which the wind pollinates, and
  31 of 34 water plants, because an authored `bloom` adds `pollinator`. Prairie recommends
  27 of 34 water plants and Coastal 40 of 40 grasses.
- **Lake, Awl-fruited, Bristly and Prairie Sedge are recommended for no style.** No style
  asks for wet ground; they show under All eligible and in an unstyled garden.
- **Japanese Sedge 'Evergold' is not on the Japanese list**, which no sedge is. I found no
  source that names the use.
- **Browsing by site exists only on the Sedge tab.** A sun and moisture filter across the
  catalog would serve every plant type; `sun` and `moist` are already on every record.
- **Bowles' Golden has no parent species.** Evergold now sits with the Japanese sedges.
- **Water depth is not modelled.** A wading sedge goes on any water tile, as a marginal does.
