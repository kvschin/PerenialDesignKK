# Sedge audit

Audited November 6, 2026, against the catalog at 0.9.79: 32 records in the Sedge
category (31 *Carex* plus *Luzula nivea*). The data fixes shipped in 0.9.80. The
drawing, browsing and new species below are still open.

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

- **Zones 10-11 have no sedge at all**, and zone 9 has 9. Europe has 2 straight species
  against 28 for North America. Only 1 of 32 records has a cultivar.
- **Native, proven:** *C. woodii* (the trial's top performer and best to mow), *haydenii*,
  *jamesii*, *crinita*, *leavenworthii*, *amphibola*, *radiata*.
- **Native, widely sold:** *C. blanda*, *lurida*, *laxiculmis* 'Hobb' (Bunny Blue).
- **Native, with a warning:** *C. emoryi*; the Wildflower Center calls it very aggressive.
- **Garden staples:** *C. oshimensis* 'Everest' and 'Everillo', *morrowii* 'Ice Dance',
  *testacea*, *flacca*, *comans* 'Frosted Curls', *buchananii*, *siderosticta* 'Variegata'.
- **Cultivars of existing records:** palm sedge 'Little Midge', Pennsylvania 'Straw Hat',
  plantain 'Seersucker', mountain 'Raureif'.
- **European natives:** *C. remota*, *sylvatica*, *Luzula sylvatica*.
- **West and warm zones:** *C. pansa*, *tumulicola*, *Rhynchospora colorata*. Zones for the
  two *Carex* still need checking.
- **Care needed:** *C. pendula* is on Cal-IPC's Watch list and regulated along some King
  County rivers, so it needs a caution. *C. divulsa* is often sold as *C. tumulicola*;
  [Calflora](https://calflora.org/app/taxon?crn=11215) has it as non-native, and I would leave it out.

### The drawing

1. **Low sedges do not form a carpet.** They read as separate dots on mulch and cover only
   about 3-13% of their tile. 28 of 32 draw under 70% of their stated spread.
2. **Palm sedge looks like a trellis:** five parallel poles with chevrons at matching heights.
3. **Seed heads are in the wrong place.** All bunch into one torch, and on low sedges they
   float high above the plant: Pennsylvania's reach 2.5x its real height. The trial's
   flower heights show they usually sit about level with the foliage.
4. **Snow looks like eggs:** mid-clump on tall sedges, in the air above palm sedge.
5. **Several sedges look the same:** Mead's and Sun Sedge overlap 80% in nearly one colour.
6. **Library and card previews are specks.** `libCanvas` caps scale at 1.15x, so an 8 in
   sedge is about 14 px wide.

### The model

- **Recommendations do not discriminate.** Every sedge gets `woodland` and `groundcover`
  by type, and the word "sedge" adds `coastal` and `wind`. Shade recommends 32 of 32,
  Coastal 31 and Prairie 30, Lake Sedge included.
- **No browsing by site** (see the Sedge catalog note in `CLAUDE.md`).
- **Clumping versus spreading is not modelled.** It is a core sedge decision and the trial
  records it. A spreader could also draw as a mat, which helps the carpet problem.
- **Evergreens get cut back.** In Today view `seasonEnvelope` drops every herbaceous plant
  to 12% on the first day of spring, Evergold, Slough Sedge and Christmas fern included.
- **Water-margin sedges cannot stand in water.** `isMarginalDef` requires `type:'water'`,
  so Tussock and Lake Sedge are refused on water tiles though their blurbs mention
  standing water or pond margins.
- **Evergold and Bowles' Golden have no parent species.** A shared `group` would let
  related cultivars sit together without changing saved gardens.
