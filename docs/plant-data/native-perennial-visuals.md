# North American perennial visual corrections

Implemented in 0.9.12 after the visual audit, September 2026. This pass changes
rendering and seasonal appearance, not real dimensions, hardiness, native
eligibility, spacing, or placement rules.

## Seasonal correction

The shrub-form foliage fallback previously ran even without `sea.Winter.fol`.
It now requires foliage. Purple Poppy Mallow and Sunshine Mimosa disappear in
their empty winter slots; Square-bud Primrose retains its authored seed stems
without a green mound. Snow is suppressed when the shrub form has no organs,
and the default mound's seed caps attach to the rendered heads.

Virginia Bluebells have empty Summer, Fall, and Winter slots and opt into
`dormantWhenBare`. This guard runs inside `drawPlant`, so full-growth library
and Established previews respect dormancy as well as the normal garden.
Four seasons remain a simplified model: there is no new region-specific
dieback calendar or additional seasonal state.

## Plant changes

| Plant | Visual change and implementation |
| --- | --- |
| Water Blue Flag Iris | Existing iris fan, falls and standards; retains `type:'water'`. |
| White Wood Aster | Sparse white rays and yellow discs with the existing aster controls. Dry aster heads use tawny tufts rather than flower rays. |
| Virginia Bluebells | Broad ovate leaves, leaves on stems, arching terminal cymes, hanging blue trumpets and pink buds. |
| Nine milkweeds | Stem foliage replaces false basal fans. Broad opposite leaves on Common, Showy, Prairie and Swamp; fine whorls on Whorled and Narrowleaf; alternate foliage on Butterfly Weed, Green Milkweed and Antelope Horns. Leaf sizes, stem density and cluster sizes remain distinct. |
| Milkweed fruit | Shared follicles replace recoloured flower clusters. Fall mixes closed and opening pods; Winter carries split tawny shells with retained silk and no foliage. A seed colour is required before any pods draw. |
| Mountain Mint | Leafy opposite-leaved stems and paired silvery bracts below small heads; bract colour is independent of flower colour. |
| White Turtlehead | Inflated hooded two-lipped flowers in short terminal groups, above paired stem leaves. |
| Cardinal Flower, Great Blue Lobelia | Tubular flowers with two narrow upper and three larger lower lobes; alternate stem leaves. Great Blue has a pale throat. |
| Broadleaf Arrowhead | Sagittate blades with basal lobes on separate petioles; three-petalled flowers in three-flowered whorls. |
| Wild Geranium | Five-lobed palmate blades and loose five-petalled flowers above a spreading mound. |
| Nodding Onion, Prairie Onion | Shared allium spokes in both styles; hanging bells and a recurved neck on Nodding, upright starry heads on Prairie. Seedheads do not retain bells. Their exact `bloomDay` gates remain. |
| Pink Muhly, Purple Lovegrass, Tufted Hairgrass | Wider, finer panicle clouds, fanned culms and lower leaf mounds via existing cloudgrass controls. Cultivars inherit the species changes while retaining their overrides. |
| Lizard's Tail | A tapering curved raceme with a drooping tip and broad leaves along the stem. |

New leaf and flower structures are shared data-driven drawing options, not
species-key branches. Leaf-node and flower counts are bounded. Existing
`stemLeaves` records without a new arrangement keep their old interpretation.
The same seeded drawing serves library, tray, garden and cached sprites.
Fine grass veils use `panicle:'mist'` to batch tiny florets into three depth
tones instead of issuing a separate fill for every speck. This changes bake
work only; no seasonal geometry was added to the cached frame path.

`look.topScale` supplies headroom in both icon fitting and ordinary herbaceous
sprite bounds. Cloudgrass retains its existing measured panicle-height bound.
Tray art also respects authored `sideScale`; this keeps the broad 'Fast Forward'
muhly cloud inside the card while using the same geometry in the garden.

## Botanical references

The audit checked these identifying features against horticultural and botanical
references. The drawing parameters are art choices, not measurements from them.

- [NC State: Iris versicolor](https://plants.ces.ncsu.edu/plants/iris-versicolor/)
- [NC State: White Wood Aster](https://plants.ces.ncsu.edu/plants/eurybia-divaricata/)
- [NC State: Virginia Bluebells](https://plants.ces.ncsu.edu/plants/mertensia-virginica/)
- [NC State: Common Milkweed](https://plants.ces.ncsu.edu/plants/asclepias-syriaca/)
- [NC State: Butterfly Weed](https://plants.ces.ncsu.edu/plants/asclepias-tuberosa/)
- [Monarch Watch: milkweed identification guide](https://www.monarchwatch.org/milkweed/guide.html)
- [Flora of North America: Asclepias viridis](https://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=242416119)
- [Mt. Cuba Center: Clustered Mountain Mint](https://mtcubacenter.org/plants/clustered-mountain-mint/)
- [NC State: White Turtlehead](https://plants.ces.ncsu.edu/plants/chelone-glabra/)
- [NC State: Cardinal Flower](https://plants.ces.ncsu.edu/plants/lobelia-cardinalis/)
- [NC State: Broadleaf Arrowhead](https://plants.ces.ncsu.edu/plants/sagittaria-latifolia/)
- [Morton Arboretum: Wild Geranium](https://mortonarb.org/plant-and-protect/trees-and-plants/wild-geranium/)
- [NC State: Nodding Onion](https://plants.ces.ncsu.edu/plants/allium-cernuum/)
- [NC State: Pink Muhly](https://plants.ces.ncsu.edu/plants/muhlenbergia-capillaris/)
- [NC State: Lizard's Tail](https://plants.ces.ncsu.edu/plants/saururus-cernuus/)

## Verification

`node tests/run.js` covers empty-season foliage and snow, bluebell dormancy even
at forced full growth/bloom, deterministic finite morphology in both styles,
milkweed seed gating, onion bell/seed separation and water-iris placement.
The existing all-species/cultivar smoke and drawing-bound tests still run.

Serve the repository and open `dev/native-perennial-review.html` for the
four-season library contact sheets. Its **Check sprite edges** button checks
all 27 affected species (24 visual upgrades plus three winter corrections),
their five cultivars, both visual styles, three seeds and two growth sizes:
1,536 sprite checks. These use real canvas pixels, because stubbed drawing
tests cannot establish absence of clipping. Another 512 library/tray checks
cover the preview tops and sides; ground shadows intentionally meet the bottom
preview margin and are checked in full on the sprites. The page is dev-only.
