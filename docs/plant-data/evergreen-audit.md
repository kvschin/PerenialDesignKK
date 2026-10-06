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
| Palms: *Sabal palmetto*, *Trachycarpus fortunei* (windmill palm, zone 7), *Washingtonia*, *Chamaerops humilis* | Need a trunked tree-palm form. `fanpalm` draws saw palmetto's clonal low fans, not a crown of fronds on a trunk. |
| *Araucaria araucana* (monkey puzzle) | Rope-like whorled branches of overlapping scale leaves: an architecture of its own. Endangered in the wild. |
| *Pinus pinea* (Italian stone pine) | The umbrella crown on a bare trunk is the whole plant; the `pine` habit would draw a pyramid. Wait for the renderer. |
| *Sciadopitys verticillata* (umbrella pine) | Whorls of glossy needles like umbrella spokes; the `pine` tuft would misrepresent it. |
| *Pinus palustris* (longleaf pine) | Its years-long grass stage is the plant's character and no habit draws it. |
| *Eucalyptus* spp. | Australasian, invasive in California, and the broadleaf crowns do not draw its pendulous foliage and peeling trunk. |
| *Cinnamomum camphora* (camphor tree) | FLEPPC Category I invasive in Florida. |
| Free-grown *Taxus baccata* tree | The taxon is already in as hedge, cone and Irish yew; a free-grown dark dome needs its own renderer pass. |
| Larches (*Larix decidua*, tamarack *L. laricina*), dawn redwood | Deciduous conifers, outside this audit; tamarack is a real native gap worth its own pass. |

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
  vertical; drawn as `scale` with `columnar:0.78`.
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
- **Incense cedar:** flat sprays held on edge (vertical).
- **Western red cedar:** J-shaped upswept limbs with long pendulous sprays and
  a buttressed, fluted base.
- **Cedar of Lebanon at maturity:** tabular, flat-topped, several leaders;
  `cedar` shelves with a low `taper` approximate it.
- **Weeping blue Atlas cedar:** trained horizontally along a frame or arch,
  then hanging; the `weeping` habit makes a mound.
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
