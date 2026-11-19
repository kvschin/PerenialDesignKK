# Evergreen tree audit

Audited October 5, 2026, against the catalog at 0.9.58 (615 base records / 466
nested choices). Tier 1 is implemented in `js/plants.js`: **20 new species and
21 new cultivars**, bringing the catalog to 635 base records / 487 nested
choices. Shipped in 0.9.59 with the conifer renderer rework.

Audience, in order: US gardeners across zones 2-11 (native gardens matter a
lot), then European gardeners (Europe is a first-class native region).

## What the catalog had

- **Conifer trees (24 records):** eastern red cedar, Colorado blue spruce
  ('Fat Albert', 'Hoopsii'), blue Atlas cedar, deodar, blue weeping Alaska
  cedar, Green Giant arborvitae, American arborvitae ('Smaragd', 'Techny',
  'Art Boe', 'Rheingold'), Spartan and Taylor junipers, Arizona, sawara, hinoki
  ('Nana Gracilis', 'Crippsii') and Leyland cypress, Vanderwolf's limber pine,
  eastern white pine, Swiss stone pine, weeping white pine, Dwarf Alberta,
  Norway ('Pendula'), Wellspire black, Big Berta, Serbian and Black Hills
  spruce, concolor fir, eastern hemlock ('Sargentii'). Bald cypress is the one
  deciduous conifer.
- **Dwarf conifers (shrubs):** bird's nest and globe blue spruce, mugo pine,
  creeping juniper, 'Golden Mop'. Yews are shrubs or hedge/cone records.
- **Broadleaf evergreen trees:** only orchard crops (olive, loquat, the citrus,
  avocado, macadamia). Sweetbay magnolia is drawn deciduous (northern form).

The holes were structural, not marginal: no true fir except concolor, no
Douglas fir, none of the pines most planted in either the US or Europe, no
Italian cypress or cryptomeria, no western conifer except the blue spruce and
its relatives, and no broadleaf evergreen shade or screen tree at all. A
Southern garden had no Southern magnolia, live oak or holly; a European one no
holm oak, bay or strawberry tree.

## Sources

Sizes and zones are the Missouri Botanical Garden Plant Finder (plantfinder.mobot.org)
unless noted, cross-checked against the NC State Extension Plant Toolbox
(plants.ces.ncsu.edu) and the RHS (rhs.org.uk) for European plants. Native
ranges follow MBG/NCSU and the Wikipedia article each record links. Cultivar
sizes not in MBG come from nursery and arboretum listings (USU Varga
Arboretum, Chicago Botanic Garden, Van den Berk, Nature Hills, Monrovia,
Rutgers holly selections) and are given as a planning size within the
published range. Invasive status of English holly: King County Noxious Weed
Control Board (weed of concern, non-regulated) and Cal-IPC (rated Limited;
also in `dev/invasive-lists/calipc.json`).

"Planning size" below is what the record carries (`heightIn` x `spread`); it is
a typical garden-lifetime size, not the record tree.

## Tier 1: added

### Conifers (12 species)

| Key | Botanical | Common | Zones | Planning size | Native range | Why |
| --- | --- | --- | --- | --- | --- | --- |
| `douglasfir` | *Pseudotsuga menziesii* | Douglas fir | 4-8 | 60 x 20 ft (MBG 40-80 x 12-20) | W North America to Mexico | The dominant native conifer of the West; a top-selling Christmas and screen tree. Zone 8 is set for the Pacific Northwest, where it is the native; MBG's 4-6 reflects eastern heat. |
| `fraserfir` | *Abies fraseri* | Fraser fir | 4-7 | 40 x 20 ft (MBG 30-50 x 10-25) | S Appalachians | The US Christmas-tree fir, endangered in the wild; joins concolor in a new **Fir** family card. |
| `austrianpine` | *Pinus nigra* | Austrian pine | 4-7 | 50 x 30 ft (MBG 40-60 x 20-40) | S Europe, Turkey, NW Africa | Decades of windbreak and street planting in both continents; Corsican pine is the same species. Blurb carries the Diplodia/pine-wilt caution. |
| `scotspine` | *Pinus sylvestris* | Scots pine | 2-7 | 50 x 30 ft (MBG 30-60 x 30-40) | Europe, N Asia | Europe's most important native pine; orange upper bark. Pine-wilt caution for the Midwest. |
| `japaneseblackpine` | *Pinus thunbergii* | Japanese black pine | 5-8 | 30 x 20 ft (MBG 20-60 x 12) | Coastal Japan, S Korea | The salt-tolerant coastal pine and the cloud-pruned garden pine. Pine-wilt caution for the eastern US. |
| `ponderosapine` | *Pinus ponderosa* | Ponderosa pine | 3-7 | 70 x 30 ft (MBG 60-125 x 25-30) | W North America | The most widespread western pine; essential for Mountain West native gardens. |
| `italiancypress` | *Cupressus sempervirens* (Stricta Group) | Italian cypress | 7-10 | 40 x 6 ft (MBG species 40-70 x 10-20; Stricta far narrower) | E Mediterranean to Iran | The pencil cypress of the South, California and the Mediterranean. Recorded as the Stricta Group, provenance `selection`, because that is what is planted. |
| `incensecedar` | *Calocedrus decurrens* | Incense cedar | 5-8 | 40 x 10 ft (MBG 30-50 x 8-10) | Oregon, California, Nevada, Baja | Drought-tolerant, deer-resistant narrow screen; the West's alternative to Leyland. |
| `westernredcedar` | *Thuja plicata* | Western red cedar | 5-8 | 60 x 20 ft (MBG 50-70 x 15-25) | Pacific Northwest | PNW native and the standard European hedging thuja; joins **Arborvitae**. Zone 8 for the PNW coast it is native to (MBG 5-7). |
| `cryptomeria` | *Cryptomeria japonica* | Japanese cryptomeria | 5-9 | 55 x 25 ft (MBG 50-60 x 20-30) | Japan | The Southeast's Leyland replacement; own card. |
| `rockymountainjuniper` | *Juniperus scopulorum* | Rocky Mountain juniper | 3-7 | 30 x 12 ft (NCSU 30-40 x 3-15) | W North America to N Mexico | Plains and Mountain West native; parent of 'Skyrocket' and 'Wichita Blue'. Cedar-apple rust caution. Joins **Juniper**. |
| `cedaroflebanon` | *Cedrus libani* | Cedar of Lebanon | 5-8 | 60 x 50 ft (MBG 40-60 x 40-60) | Lebanon, Syria, Turkey | The estate cedar of Europe and the type of the true cedars; joins **True Cedar**. |

### Broadleaf evergreen trees (8 species)

| Key | Botanical | Common | Zones | Planning size | Native range | Why |
| --- | --- | --- | --- | --- | --- | --- |
| `southernmagnolia` | *Magnolia grandiflora* | Southern magnolia | 7-10 | 60 x 35 ft (MBG 60-80 x 30-50) | SE US coastal plain | The single most-requested evergreen tree in the South; joins **Magnolia**. |
| `liveoak` | *Quercus virginiana* | Southern live oak | 8-10 | 50 x 80 ft (MBG 40-80 x 60-100) | SE US (MBG/NCSU add Mexico) | The iconic Deep South shade tree; semi-evergreen, which the blurb explains. Joins **Oak**. |
| `holmoak` | *Quercus ilex* | Holm oak | 7-10 | 50 x 50 ft (MBG 40-70 x 40-70) | Mediterranean (Europe, W Turkey, Algeria, Tunisia) | Europe's evergreen oak; coasts, tall hedges, topiary. Joins **Oak**. |
| `americanholly` | *Ilex opaca* | American holly | 5-9 | 30 x 18 ft (MBG 15-30 x 10-20) | E and C United States | The native evergreen holly; new **Holly** family card. |
| `englishholly` | *Ilex aquifolium* | English holly | 7-9 | 40 x 20 ft (MBG 30-50 x 15-25) | W/S Europe, NW Africa, SW Asia | The European native holly. Invasive in the Pacific Northwest (see follow-ups). |
| `nelliestevensholly` | *Ilex* 'Nellie R. Stevens' | 'Nellie R. Stevens' holly | 6-9 | 25 x 12 ft (MBG 15-25 x 8-12) | garden hybrid (*I. aquifolium* x *I. cornuta*) | The standard tall evergreen screen of the South and Mid-Atlantic. `provenance:'hybrid'`, no wild range. |
| `baylaurel` | *Laurus nobilis* | Bay laurel | 8-10 | 30 x 20 ft (MBG 10-30 x 5-20; RHS 8-12 m) | Mediterranean | The culinary bay, clipped or free-grown. |
| `strawberrytree` | *Arbutus unedo* | Strawberry tree | 7-10 | 20 x 20 ft (MBG 10-15; NCSU 10-35 x 8-20; RHS 4-8 m) | Mediterranean, W France; Irish stands now thought introduced | Fall flowers beside ripe fruit; drought and alkaline-soil tolerant. |

Data decisions:

- **Evergreen is a green Winter `fol`.** `treeLeafOut` (world.js) treats a tree
  as deciduous unless its Winter foliage is green (g > r, g >= b), and the
  fall-palette test treats a Fall `fol` markedly warmer than Summer's as a
  turn. All eight broadleaf records satisfy both, and a new test pins it.
- **Hollies claim no bloom.** Their flowers never read at garden scale
  (inkberry's precedent); live oak and holm oak likewise. Southern magnolia
  (May-June), bay (March-April) and strawberry tree (October-December) do
  bloom, through `BLOOM_MONTHS`.
- **Male holly:** 'Jersey Knight' carries `look.seedN:0`, the pistachio
  'Peters' convention.
- **Groups:** new **Fir** (concolor + Fraser) and **Holly** (American, English,
  Nellie Stevens) cards. Douglas fir is not a true fir and keeps its own card,
  as hemlock does. Incense cedar and cryptomeria keep their own cards.
- **px-art:** each new species' `h`/`cw` was solved with
  `dev/cultivar-size.cjs` against the nearest existing tree of the same habit
  (white fir for the firs and Douglas fir, eastern white pine for the pines,
  hinoki for the scale-leaved trees, eastern red cedar for the juniper, Atlas
  cedar for Lebanon, sweetbay for the magnolia, bur oak for the oaks, loquat
  and olive for the small broadleaves), so it sits on that tree's drawn-size
  curve. Every cultivar was then solved against its own species.

### Cultivars (21)

| Ref | Planning size | Notes |
| --- | --- | --- |
| `bluespruce.babyblue` | 20 x 12 ft | Seed-raised, reliably blue, semi-dwarf (nursery 15-25 x 10-15). |
| `bluespruce.iselifastigiate` | 20 x 6 ft | Narrow blue spire (Van den Berk: about 23 x 8 ft at 20 years). |
| `norwayspruce.cupressina` | 30 x 6 ft | Columnar Norway spruce (20-30 x 5-6). |
| `whitefir.candicans` | 40 x 20 ft | The most silver concolor (30-50 x 15-25). |
| `whitepine.fastigiata` | 35 x 10 ft | Columnar white pine (MBG 30-40 x 7-10). |
| `serbianspruce.bruns` | 30 x 10 ft | Narrower, bluer (USU 30-35 x 8-10). |
| `blueatlascedar.glaucapendula` | 12 x 15 ft | Weeping; size is set by training (MBG 3-12 ft). |
| `himalayancedar.shalimar` | species size | Cold-hardy deodar, Arnold Arboretum from 1964 Kashmir seed; zones 6-8. |
| `redcedar.canaertii` | 25 x 12 ft | Belgian selection, 1868, heavy-fruiting female (MBG 20-35 x 8-15). |
| `arizonacypress.blueice` | 30 x 12 ft | Smooth Arizona cypress (var. *glabra*), zones 6-9. |
| `leylandcypress.castlewellan` | 40 x 10 ft | Golden Leyland (RHS >12 m x 2.5-4 m); a hybrid like its parent. |
| `westernredcedar.atrovirens` | species size | The glossy dark hedging clone. |
| `cryptomeria.yoshino` | 35 x 20 ft | The US standard (MBG 30-40 x 20-30), zones 5-8. |
| `rockymountainjuniper.skyrocket` | 18 x 3 ft | 15-20 x 2-3 ft. |
| `rockymountainjuniper.wichitablue` | 14 x 6 ft | MBG 10-15 x 4-6. |
| `southernmagnolia.littlegem` | 20 x 10 ft | MBG 15-20 x 7-10; repeat bloom May-September; `broadcolumn` crown. |
| `southernmagnolia.brackensbrownbeauty` | 30 x 18 ft | MBG 20-30 x 15-25; the hardy one, zones 6-9. |
| `americanholly.jerseyprincess` | species size | Glossy female (Rutgers). |
| `americanholly.jerseyknight` | species size | Male pollinizer, no fruit. |
| `englishholly.argenteamarginata` | species size | Cream-edged female, RHS AGM. |
| `strawberrytree.compacta` | 8 x 8 ft | Shrub-sized for many years. |

## Tier 2: worth adding later

Every row below, the "More cultivars" row included, was added on November 18,
2026; see "Tier 2 shipped" further down for sizes, decisions and what is
still drawn approximately.

| Botanical | Common | Zones | Size | Native range | Why / what it needs |
| --- | --- | --- | --- | --- | --- |
| *Abies koreana* (+ 'Horstmann's Silberlocke') | Korean fir | 5-7 | 15-30 x 6-12 ft | Korea | The small-garden fir with purple cones; cultivar has curled silver needles. Fits the Fir card as is. |
| *Abies balsamea* | Balsam fir | 3-6 | 50-70 x 15-25 ft | NE North America | Northern native; struggles in heat. |
| *Abies nordmanniana* | Nordmann fir | 4-6 | 35-50 x 15-25 ft | Caucasus, Turkey | Europe's Christmas tree; specimen use. |
| *Pinus taeda* | Loblolly pine | 6-9 | 40-90 x 20-40 ft | SE US | The Southeast's native pine, mostly an existing tree on a lot. |
| *Pinus resinosa* | Red pine | 2-5 | 50-80 x 20-25 ft | NE North America | Upper Midwest native. |
| *Pinus edulis* | Pinyon pine | 4-8 | 10-20 x 10-20 ft | SW US | Small drought pine for the Southwest. |
| *Pinus bungeana* | Lacebark pine | 4-8 | 30-50 x 20-35 ft | China | Specimen grown for its patchwork bark (needs a bark treatment the conifer trunk lacks). |
| *Pinus parviflora* | Japanese white pine | 5-7 | 20-50 ft | Japan | Japanese-garden pine. |
| *Picea orientalis* (+ 'Skylands') | Oriental spruce | 4-7 | 50-60 x 15-20 ft | Caucasus, Turkey | Fine-needled, handsome; gold 'Skylands'. |
| *Picea glauca* | White spruce (species) | 2-6 | 40-60 x 10-20 ft | N North America | Only var. *densata* and two cultivars exist. |
| *Cedrus atlantica* (green species) | Atlas cedar | 6-9 | 40-60 x 30-40 ft | Atlas Mountains | Only the Glauca Group exists. |
| *Chamaecyparis thyoides* | Atlantic white cedar | 4-8 | 40-50 ft | E US coast | Wet-site native conifer. |
| *Chamaecyparis lawsoniana* | Lawson cypress | 5-7 | 40-60 ft | Oregon, California | Huge in European hedging; *Phytophthora* root rot in the US. |
| *Hesperocyparis macrocarpa* 'Goldcrest' | Monterey cypress | 7-10 | 15-25 ft (cv) | Coastal California | Popular gold conifer in Europe. |
| *Callitropsis nootkatensis* (species) | Alaska cedar | 4-7 | 30-50 ft | Pacific NW | Only the weeping cultivar exists. |
| *Sequoiadendron giganteum* | Giant sequoia | 6-8 | 60+ x 25-60 ft | Sierra Nevada | Estate tree in Europe and the PNW; drawable with the spruce/scale habits but needs the tall clear trunk. |
| *Sequoia sempervirens* | Coast redwood | 7-9 | 50-100 ft in gardens | CA/OR coast | California native gardens. |
| *Quercus agrifolia* | Coast live oak | 9-10 | 30-70 x 30-70 ft | California | The signature native oak of coastal California. |
| *Quercus suber* | Cork oak | 8-10 | 40-60 ft | W Mediterranean | Mediterranean gardens; corky bark. |
| *Prunus caroliniana* | Carolina cherry laurel | 7-10 | 20-30 ft | SE US | Native broadleaf evergreen screen. |
| *Ilex x attenuata* 'Fosteri', 'Savannah' | Foster / Savannah holly | 6-9 | 20-30 ft | hybrid | Southern holly screens. |
| *Umbellularia californica* | California bay | 7-10 | 30-80 ft | California, Oregon | West Coast native evergreen. |
| More cultivars | | | | | Southern magnolia 'D.D. Blanchard', 'Teddy Bear', 'Kay Parris'; live oak 'Cathedral', 'Highrise'; RMJ 'Moonglow', 'Blue Arrow'; red cedar 'Burkii', 'Brodie', 'Emerald Sentinel'; arborvitae 'Holmstrup', 'DeGroot's Spire'; Scots pine 'Fastigiata'; cryptomeria 'Radicans'; Arizona cypress 'Carolina Sapphire'; western red cedar 'Can-can', 'Zebrina'; English holly 'J.C. van Tol'. |

## Tier 3: noted and skipped

| Plant | Why skipped |
| --- | --- |
| Palms: *Sabal palmetto*, *Trachycarpus fortunei* (windmill palm, zone 7), *Washingtonia*, *Chamaerops humilis* | Need a trunked tree-palm form. `fanpalm` draws saw palmetto's clonal low fans, not a crown of fronds on a trunk. **Added in 0.9.137** with a `palm` form (W. filifera; W. robusta left out, below). |
| *Araucaria araucana* (monkey puzzle) | Rope-like whorled branches of overlapping scale leaves: an architecture of its own. Endangered in the wild. **Added in 0.9.137** (the `araucaria` habit). |
| *Pinus pinea* (Italian stone pine) | The umbrella crown on a bare trunk is the whole plant; the `pine` habit would draw a pyramid. **Added in 0.9.137** (`look.aged`, leaders). |
| *Sciadopitys verticillata* (umbrella pine) | Whorls of glossy needles like umbrella spokes; the `pine` tuft would misrepresent it. **Added in 0.9.137** (`tuftStyle:'whorl'`). |
| *Pinus palustris* (longleaf pine) | Its years-long grass stage is the plant's character and no habit draws it. |
| *Eucalyptus* spp. | Australasian, invasive in California, and the broadleaf crowns do not draw its pendulous foliage and peeling trunk. |
| *Cinnamomum camphora* (camphor tree) | FLEPPC Category I invasive in Florida. |
| Free-grown *Taxus baccata* tree | The taxon is already in as hedge, cone and Irish yew; a free-grown dark dome needs its own renderer pass. |
| Larches (*Larix decidua*, tamarack *L. laricina*), dawn redwood | Deciduous conifers, outside this audit; tamarack is a real native gap worth its own pass. **Added November 18, 2026** with a leaf cycle of their own (below). |

## Follow-ups outside `plants.js`

- **English holly needs a `PLANT_GUIDANCE` caution** (core.js) so the
  invasive filter can hide it for North American gardens: King County weed of
  concern, Cal-IPC Limited. Today only the blurb says so. Nellie Stevens is
  half *I. aquifolium*; whether it seeds in should be checked before deciding
  anything for it. Holm oak naturalizes on some British coasts (spread by
  jays); that is in its blurb but has not been reviewed against a source list.
  The regional review (`dev/invasive-check.js`) should also be run over the
  Mediterranean and Eurasian additions here (Austrian and Scots pine, Italian
  cypress, bay, strawberry tree) before release.
- *(Fixed in 0.9.59: `treeLeafOut` returns null for every conifer that does not
  say `look.deciduous`. The invasive filter this list also mentions was removed
  in 0.9.117; the cautions live in the blurbs.)*
- **Blue and gold conifers read as deciduous to `treeLeafOut`.** Its evergreen
  test is "Winter `fol` is green" (g > r and g >= b), so silver-blue
  (Colorado blue spruce, Atlas cedar, Arizona cypress, concolor fir, Taylor
  juniper, Vanderwolf pine and their blue cultivars) and gold ('Rheingold',
  'Crippsii', 'Castlewellan') conifers get a leaf-out and leaf-drop stage. The
  conifer renderer ignores `leafStage`, so nothing draws wrong, but the sprite
  key carries `|L<stage>` for them in spring and fall, i.e. avoidable re-bakes.
  Exempting `form:'conifer'` with a Winter `fol` would fix it. The new records
  keep their honest colours rather than being bent to the predicate.

## Architecture the conifer habits do not yet express

These were authored with the closest existing habit and knobs; the renderer
rework can pick them up. No new `look` fields were added.

- **Italian cypress:** a true flame-tipped pencil with foliage held tight and
  vertical; drawn as `scale` with `columnar:0.78`. *Done November 18, 2026:
  `sprayUp` and a pointed crown `profile` (see "Stretch: done" below).*
- **Douglas fir:** soft, irregular tiers with pendulous branchlets hanging from
  upturned limbs, and hanging cones with three-pointed bracts; drawn as `spruce`.
- **Scots and Austrian pine at maturity:** a flat-topped, irregular crown on a
  long clear trunk (Scots pine's upper trunk orange, lower grey-brown); drawn as
  a whorled `pine` pyramid, with `crownBase` lifting the Scots crown.
- **Ponderosa pine:** tall clear trunk, open crown of long-needle tufts held at
  drooping-then-upturned branch ends, plated orange bark.
- **Japanese black pine:** leaning, irregular trunk and cloud-pruned pads.
- **Cryptomeria:** rope-like, plumose sprays of awl leaves with drooping tips;
  `scale` sprays read as fans.
- **Incense cedar:** flat sprays held on edge (vertical). *Done November 18,
  2026, with `sprayUp`.*
- **Western red cedar:** J-shaped upswept limbs with long pendulous sprays and
  a buttressed, fluted base.
- **Cedar of Lebanon at maturity:** tabular, flat-topped, several leaders;
  `cedar` shelves with a low `taper` approximate it.
- **Weeping blue Atlas cedar:** trained horizontally along a frame or arch,
  then hanging; the `weeping` habit makes a mound.
- *Douglas fir, the old Scots, Austrian and ponderosa pines, cryptomeria,
  western red cedar and the old cedar of Lebanon: done in 0.9.137 (below).*
- Deferred until the renderer can: Italian stone pine's umbrella, umbrella
  pine's whorls, monkey puzzle, trunked palms (Tier 3).

## Verification

- `node tests/run.js`: 841 passed, 0 failed, both in the working tree and in a
  clean `git archive HEAD` export carrying only these data and test changes.
  Two new tests pin the conifer additions (ranges, families, cultivar sizes,
  cautions) and the broadleaf evergreens (latin, crown habit, green winter
  foliage, no fall turn, provenance, groups). The existing sprite-box, drawn
  size-curve, bark, texture, crown and fall-palette tests cover the rest.
- All 20 Wikipedia titles resolve to standard (non-disambiguation) articles.
- A headless contact sheet of every new species and cultivar in four seasons
  was reviewed; it led to denser holly, live oak and magnolia crowns, a more
  conical cryptomeria, and fewer strawberry-tree flower trusses.

## Tier 2 shipped (November 18, 2026)

All of Tier 2 and its "More cultivars" row, plus three deciduous conifers:
**25 new species and 23 cultivars**, the catalog going from 852 base records /
668 nested choices to 877 / 691. Every figure and its source is in
`docs/plant-data/evergreen-sources.json`; px-art was solved with
`dev/cultivar-size.cjs` on the nearest existing tree of the same habit (white
fir, eastern white pine, Serbian and Black Hills spruce, blue Atlas cedar,
hinoki, eastern hemlock, bald cypress, live oak, holm oak, bay laurel, 'Nellie
R. Stevens'), and every cultivar on its own species.

### Species (planning size, ft)

| Key | Botanical | Zones | Size | Family | Native |
| --- | --- | --- | --- | --- | --- |
| `koreanfir` | *Abies koreana* | 5-7 | 25 x 10 | Fir | Asia |
| `balsamfir` | *Abies balsamea* | 3-6 | 50 x 20 | Fir | North America |
| `nordmannfir` | *Abies nordmanniana* | 4-6 | 45 x 20 | Fir | Asia (Caucasus) |
| `loblollypine` | *Pinus taeda* | 6-9 | 60 x 30 | Pine | North America |
| `redpine` | *Pinus resinosa* | 2-5 | 60 x 24 | Pine | North America |
| `pinyonpine` | *Pinus edulis* | 4-8 | 20 x 18 | Pine | North America |
| `lacebarkpine` | *Pinus bungeana* | 4-8 | 35 x 25 | Pine | Asia |
| `japanesewhitepine` | *Pinus parviflora* | 5-7 | 30 x 30 | Pine | Asia |
| `orientalspruce` | *Picea orientalis* | 4-7 | 55 x 20 | Spruce | Asia (Caucasus, Turkey) |
| `whitespruce` | *Picea glauca* | 2-6 | 50 x 15 | Spruce | North America |
| `atlascedar` | *Cedrus atlantica* | 6-9 | 50 x 35 | True Cedar | Africa |
| `atlanticwhitecedar` | *Chamaecyparis thyoides* | 4-8 | 40 x 15 | Cypress | North America |
| `lawsoncypress` | *Chamaecyparis lawsoniana* | 5-8 | 50 x 15 | Cypress | North America |
| `montereycypress` | *Hesperocyparis macrocarpa* | 7-10 | 50 x 30 | Cypress | North America |
| `alaskacedar` | *Callitropsis nootkatensis* | 4-7 | 50 x 20 | Cypress | North America |
| `giantsequoia` | *Sequoiadendron giganteum* | 6-8 | 80 x 30 | Redwood (new) | North America |
| `coastredwood` | *Sequoia sempervirens* | 7-9 | 80 x 25 | Redwood | North America |
| `tamarack` | *Larix laricina* | 2-5 | 50 x 20 | Larch (new) | North America |
| `europeanlarch` | *Larix decidua* | 2-6 | 60 x 25 | Larch | Europe |
| `dawnredwood` | *Metasequoia glyptostroboides* | 4-8 | 70 x 25 | Redwood | Asia |
| `coastliveoak` | *Quercus agrifolia* | 8-10 | 40 x 40 | Oak | North America, Mexico |
| `corkoak` | *Quercus suber* | 8-10 | 45 x 45 | Oak | Europe, Africa |
| `carolinacherrylaurel` | *Prunus caroliniana* | 7-10 | 25 x 18 | own card | North America |
| `topalholly` | *Ilex × attenuata* | 6-9 | 25 x 13 | Holly | natural hybrid |
| `californiabay` | *Umbellularia californica* | 7-10 | 40 x 35 | own card | North America |

Bald cypress, already in the catalog, is now marked deciduous too.

### Cultivars

Korean fir 'Silberlocke' (20 x 10); oriental spruce 'Skylands' (25 x 10);
Monterey cypress 'Goldcrest' (25 x 8); topal holly 'Fosteri' (25 x 12) and
'Savannah' (25 x 10); Southern magnolia 'D.D. Blanchard' (45 x 25), 'Southern
Charm' sold as Teddy Bear (20 x 12) and 'Kay Parris' (25 x 10); live oak
'SDLN' sold as Cathedral (50 x 50) and 'QVTIA' sold as Highrise (40 x 20);
Rocky Mountain juniper 'Moonglow' (18 x 7) and 'Blue Arrow' (13 x 3); eastern
red cedar 'Burkii' (20 x 8, male), 'Brodie' (25 x 7) and 'Corcorcor' sold as
Emerald Sentinel (20 x 8); arborvitae 'Holmstrup' (12 x 4) and 'DeGroot's
Spire' (20 x 5); Scots pine 'Fastigiata' (25 x 7); cryptomeria 'Radicans'
(35 x 15); Arizona cypress 'Carolina Sapphire' (35 x 15); western red cedar
'Can-can' (8 x 4) and 'Zebrina' (40 x 12); English holly 'J.C. van Tol'
(20 x 12, self-fertile).

### Data decisions

- **The Caucasus is Asia.** Nordmann fir and oriental spruce are recorded as
  Asian natives only, following the botanical regions (WGSRPD puts the Caucasus
  in Asia-Temperate). A European native garden does not get them.
- **Atlantic white cedar is 15 ft wide**, from the Florida Native Plant
  Society's 10-20 ft. MBG and NC State list a 30-40 ft spread that does not fit
  the columnar, steeple-topped tree both describe.
- **Lawson cypress's 15 ft spread is an estimate.** MBG gives 40-60 ft tall in
  cultivation; the published spreads (30-60 ft) are for wild trees of 110-175 ft.
- **Monterey cypress is in.** Cal-IPC rates it Limited: it spreads from
  windbreaks into coastal prairie in parts of California. Its blurb says so.
  European larch has naturalized in the Northeast, which no US list calls
  invasive; its blurb says so too. Carolina cherry laurel's blurb carries NC
  State's "weedy" and its toxicity.
- **Topal holly is a hybrid with a wild range.** It occurs naturally in
  Florida, so it records `nativeTo:['north-america']` and `provenance:'hybrid'`,
  which keeps it out of both native modes, as the contract says.
- **Bloom months** only for Carolina cherry laurel (March-April) and California
  bay (March-April). The oaks and hollies claim none, as before.
- **Blue Arrow is 3 ft wide**, the top of its 2-3 ft range: at 2.5 ft the
  drawing floors at its narrowest width and the drawn-size curve test fails.

### Deciduous conifers

`look.deciduous` is the switch. `treeLeafOut` gives such a conifer the
broadleaf leaf cycle (needles out through spring and down through late fall,
timed by `phen`), and `drawConiferTree` draws the stages: tufts at every
spray's place, small and pale, over bare twigs; whole sprays going in fall, the
rest keeping place and colour, with the fallen needles under the tree. A spray
is laid out identically at every stage, so nothing jumps. Its spring is all new
needles, and a bare one's winter snow lies along its limbs. An evergreen conifer
has no leaf stage, as before. The larches use the `pine` habit with short soft
needles; dawn redwood the `cedar` habit, dense. Every other plant draws call for
call as before (31,054 drawings compared, leaf stages included); bald cypress is
the one existing plant that changed, on purpose.

### Still drawn approximately

- The `scale` habit's dark interior shows as a cone between the sprays on the
  broader cypresses (Monterey, Atlantic white cedar, giant sequoia), as it did
  already on Arizona cypress. Density was raised to cover most of it.
- Lacebark pine is often several-trunked; the conifer renderer draws one trunk.
  Its patchwork bark is drawn (the new `patchwork` bark style).
- Scots pine 'Fastigiata' is still wider than a true column: pine brushes are
  sized by needle length, so a narrow pine cannot close up. Short needles and
  more whorls narrow it.
- Giant sequoia and coast redwood are drawn branched to the ground, which is
  right at planning size; the tall clear trunk of an old tree still waits for
  the renderer.
- Bald cypress drops its needles with the other `warm` trees (late October to
  mid-November), a week or two early for it.

### Stretch: done

- **Italian cypress** is now a flame-tipped pencil. A new opt-in `look.sprayUp`
  (0..1) on the `scale` habit holds its sprays upright and tight (narrower,
  taller, turned toward vertical; less tall near the top, which the sprite box
  has to hold), and a crown `profile` ({p:0.3, eLo:2.5, eHi:1.15, lo:0.85},
  `fullness` 0.86, `density` 1.6) brings the top to a point instead of the
  `columnar` blunt end. `sprayUp` 0.8.
- **Incense cedar** takes the same option at 0.6, so its flat sprays stand on
  edge.

Every other drawing is unchanged (the stream hash changed for these two
records only), 48 sprites of the two pass the edge check, and a test holds the
pointed crown and that `sprayUp` is opt-in.

### Not done in this pass

The rest of the stretch list: the approximately drawn conifers of the section
above ("Architecture the conifer habits do not yet express") and the
renderer-blocked Tier 3 plants. What each needs:

- **Douglas fir**: hanging branchlets under upturned limbs, and the three-pointed
  cone bracts. A `slab` fringe that hangs further (the `hang` knob) gets part way.
- **Mature Scots and Austrian pine, ponderosa**: a clear trunk with an irregular,
  flat crown; `profile` and `crownBase` do the outline, but the limbs still come
  in regular whorls. Needs irregular whorl spacing and missing limbs at height.
- **Cryptomeria**: rope-like plumose sprays with drooping tips; a `fan` spray
  variant drawn as a curved rope.
- **Western red cedar**: J-shaped upswept limbs with hanging sprays and a fluted
  base; the `weeping` drape on an upright limb would do it.
- **Cedar of Lebanon at maturity**: several leaders and tabular tiers.
- **Tier 3**: Italian stone pine (an umbrella crown on a bare trunk: a `profile`
  with a flat top and high `crownBase` gets the outline, but the pine whorls
  read as a pyramid), umbrella pine (whorled glossy spokes), monkey puzzle (rope
  branches of scales) and the trunked palms (a crown of fronds on a trunk; a new
  form). Each is a renderer pass of its own.

### Verification

- `node tests/run.js`: 1,165 passed in a clean LF export of the branch (the
  daily-brief test fails only in a CRLF checkout, as CLAUDE.md records). New
  tests pin the Tier 2 records (ranges, families, cultivars no bigger than their
  species, cautions), the deciduous conifers' leaf stages (full needle is the
  authored tree; tufts are the full tufts, smaller; a later fall stage's sprays
  are a subset of an earlier one's; every stage inside its sprite box), snow on
  a bare deciduous conifer's limbs, and that an evergreen conifer still has no
  stage.
- `dev/conifer-review.html?check=tier2`: 1,296 sprites baked as the garden bakes
  them, none touching an edge.
- `node dev/wikipedia-links.js --verify`: all 877 articles resolve.
- Headless contact sheets of every new choice in four seasons, and of the
  deciduous conifers March to June and September to December, were reviewed. They
  led to the larches moving from the `cedar` to the `pine` habit (the shelves read
  as pancakes on a pole), a denser dawn redwood, denser loblolly, pinyon and
  lacebark crowns, and denser sprays on the broad cypresses.

## The reshaped conifers and Tier 3 (0.9.137, November 18, 2026)

The rest of the stretch list: six existing conifers redrawn as the sources
describe them, and the four Tier 3 entries that waited for the renderer:
**seven new species** (catalog 884 base records to 891; nested choices
unchanged at 696). Every figure and every shape claim, with its source, is in
`docs/plant-data/evergreen-sources.json` (`plants` for the new records,
`reshaped` for the redrawn ones). All the new drawing options are opt-in: the
whole catalog was hashed call for call before and after (four seasons, two
seeds, two growths, every woody plant at every leaf stage, 32,638 drawings),
and only the trees below changed.

### Reshaped

| Tree | What changed | Source for the shape |
| --- | --- | --- |
| Douglas fir | Irregular whorls (`whorlJitter`), limbs turned up at the tips, short pendulous branchlets hanging under each plate (`branchlets`), pendent cones with three-pointed bracts (`coneStyle:'bract'`). | OSU (lower branches drooping, upper ascending; 3-pronged bracts), NZPCN (irregular whorls, branchlets usually drooping), MBG |
| Scots pine | A cone branched to the ground when young; with age (`look.aged`) a long clear trunk, orange above grey-brown, under an irregular flattened crown. | MBG (conical young, open-rounded irregular crown with age; orange upper bark) |
| Austrian pine | A dense pyramid young; old, a spreading flat-topped dome on a shorter clear trunk. | MBG |
| Ponderosa pine | Young: a dark-barked cone. Old: a tall clear trunk of orange plates under an open crown of long-needle tufts at the ends of limbs that droop and turn up. | MBG (tufts at the branch ends; bark dark young, orange plates old) |
| Cryptomeria | Its sprays are ropes: cords of awl leaves that arch out and droop at the tip (`sprayStyle:'rope'`), not fans. Its two cultivars follow. | MBG (tiered branching slightly pendulous at the tips; awl-shaped needles) |
| Western red cedar | A new `sweep` habit: limbs that dip and sweep up at the tip (`limbJ`), carrying short curtains of hanging sprays (`strandLen`), on a buttressed foot (`buttress`) with ridged bark. Its three cultivars follow. | OSU (branches horizontal or drooping, turning up at the end; buttressed base; keeps its lower branches) |
| Cedar of Lebanon | A pyramid young; old, a few broad level tiers with sky between, flat on top, on a trunk forking into three leaders (`leaders`), still branched low. | MBG (flattened top, lower branches often touching the ground), Wikipedia (broadly tabular with age; old trunks fork into several erect branches) |

The pines and the cedar of Lebanon change shape with age, so their shape now
follows growth: the record's own look is the young tree and `look.aged` the
old one, blended as growth runs from `aged.start` to full. In the garden an
Established tree and every preview is the old one; Today shows a young planting
young. 'Fastigiata' (Scots pine) opts out (`aged:null`).

### Added

| Key | Botanical | Zones | Planning size | Native | Drawn as |
| --- | --- | --- | --- | --- | --- |
| `stonepine` | *Pinus pinea* | 8-10 | 50 x 35 ft (MBG 40-60 x 20-40) | Europe, Asia (Turkey, Lebanon) | A rounded bush young; old, a broad flat-topped parasol on a clear trunk forking into four leaders. Joins **Pine**. |
| `umbrellapine` | *Sciadopitys verticillata* | 5-8 | 25 x 15 ft (MBG 25-30 x 15-20) | Japan | A dense narrow pyramid whose shoots end in whorls of long flat needles like umbrella ribs (`tuftStyle:'whorl'`). Own card: the only member of its family. |
| `monkeypuzzle` | *Araucaria araucana* | 7-10 | 40 x 20 ft (MBG 50-80 ft, but 20-30 ft typical in cultivation) | South America | A new `araucaria` habit: rope limbs clad in scale leaves, in whorls, with rope branchlets; an open pyramid young, a domed crown on a bare trunk old. Endangered in the wild (IUCN). |
| `windmillpalm` | *Trachycarpus fortunei* | 7-10 | 20 x 8 ft (MBG 20-40 ft) | China | A slim fibre-clad trunk under a round head of fans; brown dead fronds hang under the crown. New **Palm** card. |
| `cabbagepalmetto` | *Sabal palmetto* | 8-11 (NC State 7b) | 30 x 12 ft (NC State 12-35 x 10-15) | SE United States | Criss-cross boots on the upper trunk under a dense head of hard-arching costapalmate fans. |
| `mediterraneanfanpalm` | *Chamaerops humilis* | 8-11 (MBG 8b) | 10 x 10 ft (MBG 6-15 x 6-20) | Europe, North Africa | A clump of five short leaning fibre-clad trunks with stiff, deeply split fans. |
| `californiafanpalm` | *Washingtonia filifera* | 9-11 | 40 x 12 ft (Calscape 49-66 x 10-15) | SW United States, NW Mexico | A stout ringed trunk under grey-green threaded fans, with a petticoat of dead fronds. |

The palms are a new form, `palm`, built in the round: each frond is placed in
three dimensions in a spiral and projected with the conifers' look-down, so a
frond pointing at the viewer shows its fan and one pointing sideways is seen
nearly edge on. Saw palmetto keeps its low clonal `fanpalm` fans.

### Data decisions

- **Washingtonia robusta is left out.** Cal-IPC rates the Mexican fan palm
  Moderate (Alert) in California and the Florida Plant Atlas lists it as FISC
  Category II. The native California fan palm takes its place, and its blurb
  says which one not to buy.
- **Windmill palm is in, with a caution.** No North American list calls it
  invasive, but the Swiss federal environment office bans its sale for
  invading the forests of Ticino; the blurb says it seeds into woods where
  winters are mild.
- **The Mediterranean fan palm is recorded as a tree**, though MBG calls it "a
  shrub or small tree": the catalog draws shrubs near true scale and trees on a
  compressed curve, and as a shrub a 10 ft clump drew taller than a 40 ft palm.
- **Cabbage palmetto is North American only.** NC State adds the Bahamas and
  Cuba, and the Caribbean has no region in the catalog.
- **Zones** are rounded to whole zones conservatively where a source names a
  half zone at the cold end (Sabal 7b, Chamaerops 8b are recorded as 8).
- px-art was solved with `dev/cultivar-size.cjs` on eastern white pine for the
  pines, monkey puzzle and the palms, and on white fir for the umbrella pine.

### Costs and checks

- Bake cost on the sprite path (OffscreenCanvas, min of 9 rounds, headless
  Chrome, Summer and Winter): the reshaped trees 1.3-2.8 ms; stone pine 3.0-3.8
  (its dense umbrella of tufts, beside dawn redwood's 3.3), umbrella pine
  2.5-3.0, monkey puzzle 1.3-1.4, the palms 0.9-2.0. The catalog's existing
  tree conifers measure 1.2-3.4 on the same page.
- Fills at full growth stay inside the 460 a tree is allowed: western red cedar
  373 in winter (its curtains are each a few strands in one path), umbrella pine
  418, monkey puzzle 89, a palm under 200.
- `dev/conifer-review.html?check=tier3`: 552 sprites baked as the garden bakes
  them (four seasons, three seeds, two growths, and a third, part way, for a tree
  that changes with age), none touching an edge.
- `node dev/wikipedia-links.js --verify`: all 891 articles resolve.
- Headless sheets of every new and reshaped choice in four seasons, age series
  for the aged trees, and a true-scale lineup beside existing trees were
  reviewed; they led to the denser stone pine canopy, the interior's alpha
  stepping in at half age (blended, it was a grey haze), rope sprays thick
  enough to cover cryptomeria's dark core, strand sets for western red cedar
  (one wide strand per curtain read as a paper panel), whorls with a fuller dark
  star, the cedar of Lebanon kept branched low (MBG), and a young ponderosa's
  dark bark.

### Still approximate, or not done

- **Japanese black pine** (leaning trunk, cloud-pruned pads) and the **trained
  weeping blue Atlas cedar** were outside this pass.
- **Lacebark pine** is still one trunk; `leaders` with a fork below the crown
  (`forkAt` negative, as the stone pine uses) could now draw it several-stemmed.
- **Scots pine 'Fastigiata'** is still wider than a true column.
- **Western red cedar 'Can-can'** is an 8 ft cone and its sprite is small, so its
  curtains read softer than the species'.
- **Palm flowers and fruit** are dots along arching stalks; a windmill palm's
  dense yellow panicles and a Washingtonia's 15 ft sprays are only suggested.
- **Longleaf pine, Eucalyptus, camphor tree, free-grown English yew** stay
  skipped for the reasons in Tier 3.
