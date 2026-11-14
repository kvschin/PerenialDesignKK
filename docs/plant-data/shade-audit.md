# Shade perennials audit (Nov 2026, 0.9.103)

The Shade Perennials tab is every forb that takes part shade: 98 records and 131
choices (87 family cards). Each was looked at in four seasons, drawn large, as a
drift at garden scale, and planted in a garden in the app, in
`dev/shade-review.html` (`?batch=ferns|foliage|bigleaf|groundcover|spring|summer|fall|bog|dry`,
`?only=key,key:cv`, `?ov=` to try a change unedited, `?heads`, `?drift`,
`?scale`, `?check` for sprite and preview edges, `?measure` for how far each
drawing really reaches, `?bench=1`). 52 records (77 choices) changed. The plants
that already read as themselves were left alone: the wet-ground plants
(ligularia, rodgersia, umbrella plant, giant rhubarb, the bog primroses), the
0.9.12 natives (bluebells, columbine, lobelias, turtlehead, Indian pink), bleeding
heart, Solomon's seal, the masterworts, golden ragwort and the woodland asters.

Four drawings carried most of the tab and none read as its plant:

1. **Every fern** was a bare stick carrying five to twelve pairs of ellipses: a
   fishbone, in 30 choices.
2. **Every foliage mound** (hosta, heuchera, brunnera, lungwort, lenten rose,
   epimedium) was the same fan of pointed, folded-paper blades, with a stack of
   round beads on a stalk for a flower, so a hosta and a heuchera were one plant
   in two colours and all of them flowered like a grape hyacinth.
3. **The tall shade perennials** (astilbe, black cohosh, goat's beard, monkshood,
   Japanese anemone, meadow-rue, globeflower, foamflower, lady's mantle) stood on a
   tuft of grass blades, the default basal fan, where each has broad, cut or
   compound leaves, which is most of what you see of it.
4. **The creeping mats** (creeping phlox, periwinkle, blue-eyed Mary, trailing
   bellflower) drew their flower stalks to full height with the flower left on the
   mat, so a tall bundle of bare dark stalks stood over every one.

## What was wrong, and what changed

| Plant | Problem | Change |
| --- | --- | --- |
| All 19 ferns but hart's tongue (30 choices) | A rachis with 5-12 ellipse pairs: a fishbone. A fern frond is a blade, 15-30 pairs of leaflets so close they read as one feather. | `frondStyle:'blade'` (`drawFernFronds`): each frond a filled outline of leaflets swept toward the tip, the side facing the light lit, the rachis stroked over it, painted far to near. The outline is the species': `bladeShape` 'oblance' (ostrich, widest near the top), 'lance' (lady, cinnamon, male), 'both' (New York, tapering both ways), 'ovate' (Goldie's, marginal, autumn, royal), 'deltoid' (sensitive), 'linear' (Christmas, sword, holly). `pairs`, `bladeW`, `stalk`, `gap`, `sweep`, `pinnaWide`, `cut` (serrated, lacy) and `pinnaEnd:'round'` (royal, holly, Christmas) separate the rest. |
| Northern maidenhair | A fan of bead strings. It is a flat horseshoe of fingers held level on a near-black wire. | `frondStyle:'pedate'` (`drawPedateFronds`): each frond a wire rising clear of the clump and opening into `fingers` round-leafleted blades on an arc, far side painted first. |
| Ostrich fern | Winter: one bare stick. Its fertile fronds are stiff brown plumes in the centre of the vase. | `fertileStyle:'plume'`: brown narrow fronds behind the green ones, standing through winter. |
| Cinnamon fern | Its cinnamon clubs stood all year, through winter. They come up in spring and wither by early summer. | Spring only, and `dormantWhenBare`: nothing on the tile in winter. |
| Royal fern | A stick in fall and winter. Its fertile parts are brown tassels at the tops of fronds in spring and early summer. | `fertileStyle:'tassel'`: the top leaflets of the central fronds drawn as brown clusters, olive in spring, rust in summer; nothing in winter. |
| Interrupted fern | A stick in fall and winter. Its fertile leaflets sit in the middle of the frond in spring, wither, and leave the gap the name is for. | `fertileStyle:'interrupt'`: those leaflets left out of the central fronds all season and drawn as dark clusters in spring; nothing in winter. |
| Sensitive fern | Bead sticks standing in summer. They appear late summer and stand through winter. | Fall and winter only. |
| Wood ferns (marginal, Goldie's, autumn, male) | A fertile stick drawn from the seed colour, which for these is the spores under the leaflets. | A blade fern draws only the fertile parts it names. |
| Hosta and both cultivars | Folded-paper blades in a fan; bead balls on scapes. A hosta is a dome of broad ribbed leaves on stalks, inner ones up, outer ones arching out and down, with funnel flowers hanging from one side of a scape. | `leafStyle:'hosta'` (`drawHostaLeaves`): leaves built in the round, each with an azimuth, a stalk and a blade lying in a cupped plane, projected with a look-down, lit by its own normal, the pale underside where it turns away, with arcing veins. `scapeStyle:'raceme'`: funnels down the top of the scape, buds closed at the tip. 'Blue Angel' is broader and heavily ribbed, 'Sum and Substance' broad and smooth. `margin` draws a variegated rim from a season's `edge` for future cultivars. |
| Lungworts ('Diana Clare', 'Blue Ensign', 'Sissinghurst White') | A few tiny pointed blades. Long elliptic leaves lying out in a rosette, spotted silver. | The hosta leaf with `leafShape:'lance'`, laid low, with `spots` in the season's `edge`; `scapeStyle:'cyme'`, nodding clusters just above the leaves. |
| Heuchera and five cultivars | Folded-paper blades; a bead ball on one stalk. A low mound of rounded, scalloped leaves on stalks, under tall airy wands of tiny bells. | `leafStyle:'parasol'` in the leaf mound (`drawParasolFoliage`, shared with the stemmed forms) with `lobes` 7 and a `sinus`, the notch where the stalk joins a heart-based leaf. `scapeStyle:'spray'`: a fine panicle of tiny bells. 'Green Spice' and 'Steel City' carry their dark veining (`veinCol`), 'Steel City' its purple underside, 'Apple Crisp' a ruffled rim. |
| Siberian bugloss and two cultivars | Folded-paper blades; blue bead spikes. Heart-shaped leaves on stalks and an airy spray of forget-me-not flowers. | Notched round leaf with `tipPt` (the point of the heart) and `scapeStyle:'spray'`. 'Jack Frost' silver with green veins, 'Looking Glass' silver with the veins barely showing. |
| Lenten rose | Spiky strap tuft; pink tulip shapes on tall stalks. Leathery leaves cut to the base into 7-9 leaflets on stout stalks, nodding cups just above. | Deep-cut parasol leaf (`lobeDepth` 0.85), `scapeStyle:'nodding'`: two or three big cups facing down and out. |
| Barrenwort and 'Sulphureum' | A bundle of brown sticks topped with a cream ball. Wiry stems holding three heart-shaped leaflets in a layered canopy, sprays of tiny spurred flowers. | Three-lobed parasol leaf on tall stalks, `scapeStyle:'spray'`. |
| Astilbe and three cultivars | Grass tuft; a column of beads. A mound of cut, glossy leaves under feathery tapering plumes. | Deep-cut parasol leaves, `spikeStyle:'plume'` (the rodgersia plume), stalks only in bloom and seed. |
| Black cohosh, goat's beard, 'Kneiffii' | Grass tuft; bead columns or a candelabra of them. Big compound leaves under slender white wands (cohosh) or a broad branched cream plume (goat's beard). | Deep-cut parasol leaves; narrow plumes for cohosh, broad ones for goat's beard, finer for 'Kneiffii'. |
| Monkshood | Grass tuft; a dark bead cylinder. Palmately cut leaves up the stems, a raceme of helmets. | Palmate parasol leaves, palmate stem leaves, `spikeStyle:'hooded'`. |
| Japanese anemone and 'Honorine Jobert' | Grass tuft; small daisies. A mound of three-lobed leaves, tall branched stems of saucer flowers. | Three-lobed parasol leaves, rounder larger rays, three heads a stem. |
| Meadow-rue, globeflower, foamflower, lady's mantle, wild and woolly geranium, liverleaf | A grass tuft or spiky star leaves. | Each its own parasol leaf: small three-lobed leaflets (meadow-rue), deep palmate (globeflower, geraniums), notched and lobed (foamflower), round and scalloped (lady's mantle), three-lobed and low (liverleaf). Foamflower's spike became a fluffy narrow plume; lady's mantle and deadnettle stand flower stems only in bloom and seed. |
| Shooting star | Petals hanging down under a disc: a small coneflower, upside down. Its petals sweep back up and the beak points down. And it stood bare stalks all summer, when it is dormant. | `flowerStyle:'reflexedCyclamen'` in a nodding umbel, a low rosette of leaves, `dormantWhenBare`. |
| Creeping phlox, 'Sherwood Purple', periwinkle, blue-eyed Mary, trailing bellflower | Flower stalks drawn to full height, flowers left on the mat. | Creeping phlox holds its flowers at the tips of 6-8 in stems (`habit:'matflower'`, `matHeadRise`); the other three keep their stalks inside the mat (`flowerLen`). |
| Bugle, spotted deadnettle, London pride | A tuft of blades. Ajuga is a carpet of glossy spoon-shaped leaves, deadnettle heart-shaped leaves blotched silver down the middle, London pride rosettes of spoon leaves. | Basal `leafStyle:'rosette'`; deadnettle's silver blotch (`mottle`, from the season's `edge`, the leaf now green round it); London pride an umbel of tiny flowers over its rosettes. |
| Bear's breeches, comfrey | Bear's breeches a thin stalk with a short poker over a few blades; comfrey a grass tuft. | Big lobed (bear's breeches) and broad (comfrey) leaves in a rosette; bear's breeches' spike half the plant's height. |
| Jacob's ladder | Three bare stalks; the leaves too small to see. A mound of ladder-like pinnate leaves. | `leafStyle:'pinnate'`: a rosette of pinnate leaves, leafy stems, blue cup clusters. |
| Bigroot geranium | A thin runner mat under a few flowers. A dense mound of lobed aromatic leaves, magenta flowers just above. | Lobed parasol leaves, open flowers on stems. |
| Woodland phlox | Grass tuft; cloud puffs. Leafy stems with opposite leaves and loose clusters of flat flowers. | No basal fan, opposite stem leaves, open flowers. |

Jacob's ladder, London pride and bigroot geranium moved from the generic `shrub`
form to `umbel`, which adds the `flower` role they deserve.

## Renderer, opt-in

Every option is read only by a record that sets it. Drawing every choice in the
catalog through the old and new `draw.js` with the old data gave identical canvas
call streams (20,976 draws: each choice, four seasons, two growths, both
renderers), and with the new data the draws that differ are exactly the 77
choices edited (1,078 draws).

- Ferns: `frondStyle:'blade'` (`pairs`, `bladeShape`, `bladeW`, `stalk`, `gap`,
  `sweep`, `pinnaWide`, `cut`, `pinnaEnd:'round'`, `pinnaDroop`, `crownW`) and
  `frondStyle:'pedate'` (`fingers`, `fingerLen`, `fanArc`, `fanTilt`);
  `fertileStyle:'plume'|'tassel'|'interrupt'` (`fertileFrom`, `fertileTo`).
  Blade ferns draw only fertile parts they name.
- Leaf mounds: `leafStyle:'hosta'` (`leafLen`, `leafWR`, `cup`, `leafRise`,
  `petioleLen`, `veins`, `margin`, `spots`, `spotR`, `stalkCol`, `leafShape:'lance'`),
  `leafStyle:'parasol'`, and `scapeStyle:'raceme'|'spray'|'cyme'|'nodding'`
  (`scapeH`, `scapeSpread`, `scapeLean`, `sprayW`, `sprayBranches`, `racemeSpan`).
- Parasol leaves (both forms): `sinus`, `tipPt`, `edgeCol`/`edgeW`, `veinCol`,
  `veinAlpha`. The parasol block was lifted into `drawParasolFoliage` unchanged.
- Basal leaves of the stemmed forms: `leafStyle:'pinnate'` (`pinnatePairs`,
  `leafWR`), and `mottle` on `leafStyle:'rosette'`.

## Cost

Interleaved bench in headless Chrome against 0.9.102, min of two passes of three,
each choice in four seasons, eight draws a bake:

| Group | Bakes | Before | After | Worst bake after |
| --- | --- | --- | --- | --- |
| Ferns | 120 | 16.6 ms | 33.6 ms | 0.95 ms (maidenhair, Spring) |
| Hosta, lungworts | 24 | 1.8 ms | 4.2 ms | 0.38 ms (hosta, Summer) |
| Heuchera, brunnera, lenten rose, barrenwort | 48 | 2.9 ms | 20.0 ms | 0.64 ms ('Apple Crisp', Summer) |
| Astilbe, black cohosh, goat's beard | 28 | 6.0 ms | 9.7 ms | 0.59 ms (goat's beard, Summer) |
| Other changed | 104 | 10.9 ms | 22.2 ms | 0.71 ms (lady's mantle, Summer) |
| Unchanged (control) | | 39.4 ms | 38.5 ms | |

The old drawings were cheap because they were nearly empty. The new ones sit in
the catalog's range (a habit tree bakes in 1-2 ms), paid once per sprite bake.
6,720 sprites and 2,240 library and tray previews checked in both renderers: none
touching an edge, after 23 records gained a measured `sideScale` (their leaves now
reach wider than the preview assumed) and bear's breeches' front leaves were
raised.

## Missing plants

The catalog has no wild ginger, trillium, bloodroot, mayapple, Jack-in-the-pulpit,
toad lily, bergenia, sweet woodruff, lily of the valley, Allegheny spurge,
fringed bleeding heart, celandine poppy, false Solomon's seal, bellwort, bugbane,
spikenard or native violet: no genus of them at all. Several are the plants a
shade garden is planned around. Counted by site, the tab has only **9 dry-shade
family cards**, three of them really sun plants that tolerate shade (false aloe,
Texas beargrass, woodland sunflower), against 47 woodland and 31 moist-shade cards;
dry shade under trees is the commonest shade problem there is.

**Add first** (the staples, each with a grammar to start from):

| Plant | Why | Draws from |
| --- | --- | --- |
| Wild ginger, *Asarum canadense* (NA) and European ginger, *A. europaeum* | The native shade groundcover; the glossy evergreen one for Europe | Low notched parasol leaf |
| Large-flowered trillium, *Trillium grandiflorum* (NA) | The emblem of the spring woodland | New: a whorl of three leaves and a three-petalled flower; a spring ephemeral like wood anemone |
| Bloodroot, *Sanguinaria canadensis*, and 'Multiplex' | First native flower of spring; lobed glaucous leaf | Lobed parasol leaf, white cone flower |
| Mayapple, *Podophyllum peltatum* | Colonies of umbrella leaves | Peltate parasol leaf (the Darmera leaf, smaller) |
| Jack-in-the-pulpit, *Arisaema triphyllum* | Native, red berries in fall | New: a hooded spathe |
| Toad lily, *Tricyrtis hirta* | The fall-flowering shade plant; the tab has almost nothing after August | Leafy arching stems, new spotted flower |
| Variegated Solomon's seal, *Polygonatum odoratum* 'Variegatum' | PPA Perennial Plant of the Year 2013 | The existing Solomon's seal arch with a white leaf margin |
| Fringed bleeding heart, *Dicentra eximia* (NA) | Native, flowers spring to frost, ferny leaves | Archbell with fern-cut leaves |
| Celandine poppy, *Stylophorum diphyllum* (NA) | Native yellow woodland poppy | Pinnatifid rosette, `rayShape:'poppy'` |
| False Solomon's seal, *Maianthemum racemosum* (NA) | Native; a plume at the tip of each arching stem | Archbell stem with a plume head |
| Bugbane, *Actaea simplex* Atropurpurea Group ('Brunette', 'Hillside Black Beauty') | The dark-leaved late-season wand | The new black cohosh with dark leaves |
| Allegheny spurge, *Pachysandra procumbens* (NA) | The native pachysandra; *P. terminalis* needs an invasive caution | Whorled leaves on short stems |
| Sweet woodruff, *Galium odoratum* | European dry-shade carpet | Matflower with whorled leaves |
| Bergenia, *Bergenia cordifolia* | Evergreen big-leaved edging, Europe and Asia; dry shade | The hosta leaf, round and glossy |
| Creeping Jacob's ladder, *Polemonium reptans* (NA), and 'Stairway to Heaven' | The catalog's Jacob's ladder is European only | The new pinnate rosette |
| Blue wood aster, *Symphyotrichum cordifolium*; big-leaved aster, *Eurybia macrophylla*; zigzag goldenrod, *Solidago flexicaulis* (NA) | Dry-shade fall flowers | The aster and goldenrod habits already in use |
| Mrs. Robb's bonnet, *Euphorbia amygdaloides* var. *robbiae* | The European dry-shade standby | The spurge already drawn for *E. characias* |
| Yellow wax bells, *Kirengeshoma palmata* | Late-summer shade flower, maple-like leaves | Palmate stem leaves, bells |

**Worth adding next:** Aralia 'Sun King' (*A. cordata*, PPA 2020) and American
spikenard (*A. racemosa*); doll's eyes (*Actaea pachypoda*); Dutchman's breeches
(*Dicentra cucullaria*) and western bleeding heart (*D. formosa*); bellwort
(*Uvularia grandiflora*); rue anemone (*Thalictrum thalictroides*), twinleaf
(*Jeffersonia diphylla*), blue cohosh (*Caulophyllum thalictroides*), bishop's cap
(*Mitella diphylla*), Virginia waterleaf (*Hydrophyllum virginianum*); violets
(*Viola sororia*, *V. canadensis*; both self-sow); Christmas rose (*Helleborus
niger*) and stinking hellebore (*H. foetidus*); English primrose and cowslip
(*Primula vulgaris*, *P. veris*); lily of the valley (*Convallaria majalis*, needs
a regional invasive review first); liriope (*Liriope muscari*; *L. spicata* is
invasive in parts of the Southeast); strawberry begonia (*Saxifraga stolonifera*);
hardy begonia (*Begonia grandis*); *Geranium phaeum* and *G. nodosum*;
× *Heucherella*; and the Pacific Northwest shade natives the West Coast phase
skipped: western wild ginger (*Asarum caudatum*), redwood sorrel (*Oxalis
oregana*), vanilla leaf (*Achlys triphylla*), fringecups (*Tellima grandiflora*)
and piggyback plant (*Tolmiea menziesii*). Yellow archangel (*Lamium galeobdolon*)
and creeping Jenny (*Lysimachia nummularia*) are widely sold and invasive in parts
of North America; leave them out or add them with cautions.

## Missing cultivars

| Species | Has | Missing (the ones a buyer meets) |
| --- | --- | --- |
| Hosta | 'Blue Angel', 'Sum and Substance' | 'Patriot' (white margin), 'June' (gold centre, blue rim), 'Frances Williams', 'Halcyon' (small blue), 'Francee', 'Guacamole', 'Empress Wu' (giant), 'Blue Mouse Ears' (miniature), 'Krossa Regal' (vase). The new hosta leaf draws a margin already; a centre variegation needs one more option. |
| Heuchera | 'Green Spice', 'Palace Purple', 'Caramel', 'Apple Crisp', 'Steel City' | From Mt. Cuba Center's trial of 83 heucheras: *H. villosa* 'Bronze Wave', 'Citronelle', 'Southern Comfort', 'Color Dream', 'Frosted Violet', 'Spellbound', 'Carousel'; and *H. villosa* 'Autumn Bride' (white, fall), 'Obsidian' (near black). |
| Astilbe | 'Fanal', 'Bridal Veil', 'Visions' | 'Deutschland' (white), 'Rheinland' (pink, early), 'Peach Blossom', *A. simplicifolia* 'Sprite', *A. chinensis* var. *pumila* (low groundcover), 'Purple Candles' |
| Lenten rose | none | 'Ivory Prince', the Honeymoon and Wedding Party series, 'Pink Frost'; and a dark slate one |
| Brunnera | 'Jack Frost' (PPA 2012), 'Looking Glass' | 'Sea Heart', 'Alexander's Great', 'Hadspen Cream' (cream margin) |
| Japanese anemone | 'Honorine Jobert' (PPA 2016) | 'September Charm', 'Queen Charlotte', 'Whirlwind', *A. tomentosa* 'Robustissima', 'Pamina' |
| Barrenwort | 'Sulphureum' | *E. × rubrum*, 'Frohnleiten', *E. grandiflorum* 'Lilafee', *E. × youngianum* 'Niveum' |
| Bleeding heart | 'Alba', 'Gold Heart' | 'Valentine' (red) |
| Bugle | none | 'Black Scallop', 'Chocolate Chip', 'Burgundy Glow', 'Catlin's Giant' |
| Spotted deadnettle | none | 'White Nancy', 'Beacon Silver', 'Purple Dragon', 'Pink Pewter' (mostly silver leaves) |
| Foamflower | none | 'Spring Symphony', 'Pink Skyrocket', 'Sugar and Spice', *T. cordifolia* var. *collina* (clumping) |
| Lungwort | three | 'Raspberry Splash', 'Trevi Fountain', 'Mrs. Moon', *P. longifolia* 'Bertram Anderson' |
| Woodland phlox | none | 'Blue Moon' (tied for top performer with the species in Mt. Cuba's phlox for shade trial), 'May Breeze', 'Fuller's White', 'Chattahoochee' (hybrid) |
| Creeping phlox | 'Sherwood Purple' (a Mt. Cuba top performer; PPA 1990 for the species) | 'Pink Ridge' (Mt. Cuba top pink), 'Bruce's White', 'Home Fires' |
| Solomon's seal | species | *P. biflorum* var. *commutatum* (giant), and *P. odoratum* 'Variegatum' above |
| Wild columbine | species | 'Little Lanterns' (compact), 'Corbett' (yellow) |
| Wild geranium | species | 'Espresso' (bronze leaves), 'Album' |
| Bigroot geranium | species | 'Bevan's Variety', 'Ingwersen's Variety', 'Spessart'; and *G. × cantabrigiense* 'Biokovo' (PPA 2015) |
| Monkshood | species | *A. carmichaelii* 'Arendsii' (fall) |
| White turtlehead | species | *Chelone lyonii* 'Hot Lips' (pink), the popular one |
| Jacob's ladder | species | 'Brise d'Anjou' (variegated) |
| Lady's mantle | species | *Alchemilla erythropoda* (dwarf) |
| Golden ragwort | species | round-leaf ragwort, *Packera obovata* (species, dry shade) |
| Periwinkle | species | 'Bowles' Variety', 'Illumination' (already flagged invasive in North America) |

## Sub-labels for the Shade Perennials tab (added in 0.9.104)

Grasses and sedges list their plants under site headings (`SITE_LAYOUTS`). The
Shade Perennials tab now does too, under the same three shade headings, with the
same ids and words, so a gardener who learns "Dry shade" on one tab meets it on the
next: **Dry shade 9 · Woodland 47 · Moist shade 31** family cards over the whole
catalog (46 woodland in a North American garden), filed by `moist` alone because
every plant on the tab takes part shade (`shadeSiteOf`). The thin Dry shade heading
is honest about a real gap, and the plants listed above fill it. Ferns stay with the
plants of their site: a heading is a site, and a Ferns heading among them would mix
a kind of plant into a list of places. A search still draws one flat list.

## Noticed, not changed

- Wood forget-me-not, yellow corydalis, foxglove and peach-leaved bellflower read
  roughly right; the bellflower's bells are oversized.
- Dwarf crested iris (8 px, no `heightIn`) has its leaves hidden by its flowers.
- White wood aster flowers in a few large heads on bare stalks where it carries
  many small stars in loose flat clusters.
- 'Blue Angel' and 'Sum and Substance' inherit the species' 30 in height and 36 in
  spread; both grow far larger. Most shade records (every fern but two, hosta,
  heuchera, astilbe, brunnera) carry no `heightIn`, so their cards quote the drawn
  height.
- `sun:'part'` means "takes part shade", so a few sun plants sit on this tab:
  false aloe, Texas beargrass, woodland sunflower, mountain fleece, cardinal flower.
- Several dry-tolerant shade plants are marked `medium` (lenten rose, Solomon's
  seal, Christmas fern), which would undercount Dry shade under site headings.

## Sources

- Perennial Plant Association, Perennial Plant of the Year: Phlox stolonifera
  1990, Heuchera 'Palace Purple' 1991, Athyrium 'Pictum' 2004, Helleborus ×
  hybridus 2005, Hakonechloa 'Aureola' 2009, Brunnera 'Jack Frost' 2012,
  Polygonatum odoratum 'Variegatum' 2013, Geranium 'Biokovo' 2015, Anemone
  'Honorine Jobert' 2016, Aralia 'Sun King' 2020 (Purdue Yard and Garden,
  Bloomin' Designs, Walters Gardens listings).
- Mt. Cuba Center, *Heuchera for the Mid-Atlantic Region* (2014; 83 cultivars
  over three years), via Fine Gardening and Longfield Gardens summaries.
- Mt. Cuba Center phlox trial (2015-2017, 94 selections of eight species), via
  Penn State Extension and North Creek Nurseries.
