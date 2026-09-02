# US regional plant expansion roadmap

Prepared August 30, 2026. Updated through local implementation of phases **1A/1B, 2, 3, 4, and 5**: 62 species plus the independently sized 'Howard McMinn' manzanita selection. Phase 0 remains deferred at the user's request. Phase 6 remains a backlog.

**The next regional gap is an initial Alaska/Hawaii and nationwide audit.** The implemented West Coast, Florida, Colorado, Texas, Arizona, and humid Southeast batches improve those regions without claiming automatic state-level suitability.

The original roadmap contains **68 candidate taxa**; 62 are now implemented and 6 remain. Source reviews and implementation decisions are in [phase 1](plant-data/phase1-implementation.md), [phase 2](plant-data/phase2-implementation.md), [phase 3](plant-data/phase3-implementation.md), [phase 4](plant-data/phase4-implementation.md), and [phase 5](plant-data/phase5-implementation.md) notes. The last batch still requires production verification of dimensions, hardiness, local distribution, bloom timing, provenance, and nursery availability. A recommendation for a region is not a claim that the plant is native throughout it.

| Phase | Work | Candidate taxa |
| --- | --- | ---: |
| 0 | Climate, local-origin, site, and seasonal accuracy — deferred | Existing-data/platform work |
| 1 | California + Pacific Northwest — implemented locally | 22 |
| 2 | Florida — implemented locally | 10 |
| 3 | Colorado/Rockies — implemented locally | 10 |
| 4 | Texas + Arizona/arid Southwest — implemented locally | 12 |
| 5 | Carolinas/humid Southeast — implemented locally | 8 |
| 6 | Nationwide gap audit + Alaska/Hawaii starters | 6 |

Phases express priority, not a requirement to finish every region before starting another. The user chose to implement 1A/1B before Phase 0; these plants use existing filters and seasonal rules, with site caveats in their descriptions. They do not introduce automatic regional suitability claims. The first five plant phases contain 62 candidates for the areas requested; the final six begin the remaining nationwide work.

## What the catalog currently covers

The initial audit counted **473 base records and 376 nested choices**. Through Phase 5, the local catalog contains **535 base records and 377 nested choices**. Those are not unique-species counts: some records preserve different shapes or placement layers, and nested choices include both cultivars and exact species. The table below records the starting gaps, before this expansion.

| Area | Assessment | Existing examples to reuse | Main gaps |
| --- | --- | --- | --- |
| California | Major gaps | Clustered field sedge; some shared dryland taxa | Local meadow grasses, Mediterranean shrubs, coastal edging, dry-shade groundcover |
| Pacific Northwest | Major gaps | Common/great camas, tufted hairgrass, red-twig dogwood, goat's beard | Evergreen woodland structure, western sedges, local prairie grasses, small trees |
| Florida | Major gaps, especially central/south Florida | Pink muhly, beautyberry, buttonbush, pickerelweed, bald cypress | Subtropical groundcovers, coastal and evergreen structure, palms, warm-climate seasonality |
| Colorado/Rockies | Partial coverage | Blue grama, sideoats grama, prairie smoke, dotted blazing star, showy milkweed, prairie zinnia | Cool-season western grasses, foothill shrubs, mountain flowers |
| Texas/Arizona | Substantial dry-flower foundation; uneven structure | Red yucca, sotol, ocotillo, agaves, blackfoot daisy, desert willow, autumn sage, flame acanthus | Regional trees/shrubs, additional matrix grasses, shade and groundcover options |
| Carolinas/humid Southeast | Better covered, with specific holes | Southern blue flag, eastern bluestar, native sedges, sweetspire, summersweet, oakleaf hydrangea | Coastal evergreen structure, characteristic southern perennials and low groundcovers |
| Northeast/Midwest | Strongest starting coverage | Prairie grasses, forbs, sedges, woodland plants, shrubs, deciduous trees | Audit local suitability and cold edges rather than expand indiscriminately |
| Alaska/Hawaii | Require dedicated work | Some cold-climate and warm-climate records overlap | Local palettes, full zone range, island/elevation distinctions, appropriate seasonality |

These are qualitative coverage judgments. The app has no state/ecoregion native data from which an honest regional coverage percentage could be calculated.

## Phase 0 — make regional recommendations trustworthy

Do the smallest useful foundation first; do not make every new plant wait for a complete nationwide database.

- [ ] **Represent the full USDA zone range without silent clamping.** `openDesignSetup()` in `js/screens.js` currently offers zones 3–9 and clamps ZIP-derived values into that range. `ZIP_ZONE_BANDS` in `js/core.js` already returns 10 for parts of Florida and 11 for Hawaii, which the setup then reduces to 9. Allow accurate manual selection, label the three-digit ZIP estimate as approximate, and provide a user-initiated link to the official map. Do not introduce an automatic network dependency. USDA zones measure winter cold; heat, moisture, humidity, exposure, and soils also matter. [USDA guidance](https://planthardiness.ars.usda.gov/pages/how-to-use-the-maps)
- [ ] **Separate local native status from garden suitability.** Preserve the existing continental `nativeTo`/`provenance` contract until an explicit extension is designed. Add reviewed regional suitability and local-origin information separately, with source/date and an unknown state. North American origin must never become a claim of California or Florida nativity. Backfill existing plants used in each regional palette as that palette ships.
- [ ] **Use climate-aware regional choices.** Separate California coast/interior, PNW west/east of the Cascades, Colorado plains/foothills/mountains, humid east Texas/central Texas/arid west Texas, Arizona low desert/high country, and Florida north/central/south. Separate Carolina mountains/Piedmont/coast. State boundaries alone are insufficient; EPA ecoregions can support the reference data behind simpler user labels. [EPA framework](https://www.epa.gov/eco-research/ecoregions)
- [ ] **Add site qualifiers before claiming a plant fits.** Prioritize drainage/winter-wet sensitivity, seasonal irrigation, acid/alkaline soil needs, heat/humidity, and coastal exposure. Keep salt spray distinct from saline soil or inundation. The existing `sun:'full'|'part'` and `moist:'dry'|'medium'|'moist'` are useful but too coarse to express all these constraints.
- [ ] **Review regional invasive concerns in the existing catalog.** Example: Mexican feathergrass is tagged North American in the app, but Cal-IPC currently rates it invasive in California with a Limited rating. Regional recommendations should warn or exclude it there without silently deleting it from saved gardens. This is a regional assessment, not a claim of a nationwide legal ban. [Cal-IPC assessment](https://www.cal-ipc.org/plants/profile/stipa-tenuissima-profile/)
- [ ] **Make seasonal presentation honest.** `seasonEnvelope()` in `js/world.js` applies spring cutback to non-woody plants, and the `BLOOM_MONTHS` table describes mostly broad zone 5–7 timing unless a species has southern/desert data. Add reviewed evergreen, summer-dormant, and warm-climate behavior where needed. Until then, identify the calendar as representative rather than a local flowering forecast. Florida has its own regional growing calendars and year-round gardening conditions. [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/care/florida-friendly/florida-gardening-for-new-residents/)

**First deliverable:** a gardener can choose an accurate zone and a reviewed regional palette containing both existing and new plants, with honest limitations. Ship optional new metadata with backward-compatible defaults. These are proposed requirements, not changes to the current schema.

## Phase 1 — West Coast foundations: 22 candidates

**Implemented locally:** all CA-01–CA-12 and PNW-01–PNW-10, plus 'Howard McMinn' nested under Vine Hill manzanita. No Phase 0 infrastructure changes. Roemer's fescue's reference link covers the taxon within the broader Idaho fescue article.

### 1A. California: 12 candidates

Start with the grasses and low plants, then the woody group. Retain clustered field sedge as an existing matrix option. Deergrass is added once here and reused in appropriate Southwest palettes.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| CA-01 | Deergrass — *Muhlenbergia rigens* | Large bunchgrass structure; regional Southwest crossover | [CNPS](https://www.cnps.org/gardening/native-grass-alternatives-to-lawns-31226) |
| CA-02 | Purple needlegrass — *Stipa pulchra* | Fine meadow matrix; retain *Nassella pulchra* as a synonym | [UC ANR](https://ucanr.edu/site/mg-sonoma/native-grasses) |
| CA-03 | California fuchsia — *Epilobium canum* | Spreading late-season flowers; searchable under Zauschneria | [CNPS](https://chapters.cnps.org/southcoast/2024/10/07/ca-native-plants-for-the-s-ca-habitat-garden/) |
| CA-04 | California buckwheat — *Eriogonum fasciculatum* | Dry subshrub; persistent flower-head structure | [CNPS](https://www.cnps.org/gardening/buckwheats-in-the-garden-528) |
| CA-05 | Cleveland sage — *Salvia clevelandii* | Rounded aromatic structure; southern California origin | [CNPS](https://www.cnps.org/gardening/fragrant-natives-for-the-garden-5684) |
| CA-06 | Foothill penstemon — *Penstemon heterophyllus* | Blue flowering accent; drainage-sensitive siting | [UC ANR](https://ucanr.edu/node/124921/printable/print) |
| CA-07 | Narrowleaf milkweed — *Asclepias fascicularis* | Western milkweed; verify local range/provenance | [CNPS](https://chapters.cnps.org/southcoast/2024/10/07/ca-native-plants-for-the-s-ca-habitat-garden/) |
| CA-08 | Hummingbird sage — *Salvia spathacea* | Spreading dry-shade layer; summer dormancy varies with water | [CNPS](https://chapters.cnps.org/montereybay/local-heroes-salvias/) |
| CA-09 | Seaside daisy — *Erigeron glaucus* | Low coastal edging and flowers | [CNPS](https://chapters.cnps.org/southcoast/2024/10/07/ca-native-plants-for-the-s-ca-habitat-garden/) |
| CA-10 | Blueblossom — *Ceanothus thyrsiflorus* | Evergreen flowering screen; coastal California/Oregon contexts | [OSU](https://landscapeplants.oregonstate.edu/plants/ceanothus-thyrsiflorus) |
| CA-11 | Vine Hill manzanita — *Arctostaphylos densiflora* | Evergreen bark/branch structure; nursery-grown 'Howard McMinn' merits a selection record | [UC ANR](https://ucanr.edu/blog/garden-notes/article/manzanita-little-apple) |
| CA-12 | California coffeeberry — *Frangula californica* | Evergreen background and fruit; retain *Rhamnus californica* synonym | [CNPS](https://www.cnps.org/life-with-plants/california-coffeeberry-3025) |

Do not label every selection native across California. A garden cultivar of a narrowly native manzanita is still a named selection, not a locally sourced straight species.

### 1B. Pacific Northwest west of the Cascades: 10 candidates

This fills woodland, upland meadow, and wet-site roles. It does not substitute for an inland Washington/Oregon palette.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| PNW-01 | Western sword fern — *Polystichum munitum* | Evergreen woodland anchor | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-02 | Roemer's fescue — *Festuca roemeri* | Upland prairie matrix; retain older *F. idahoensis* subsp. *roemeri* name | [USDA NRCS](https://www.nrcs.usda.gov/plant-materials/cp/releases) |
| PNW-03 | Red-flowering currant — *Ribes sanguineum* | Early flowering deciduous structure | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-04 | Salal — *Gaultheria shallon* | Colonizing evergreen groundcover/shrub | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-05 | Oregon iris — *Iris tenax* | Low spring flowering clump | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-06 | Oregon sunshine — *Eriophyllum lanatum* | Low sunny flowers; choose the regional taxon | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-07 | Low Oregon grape — *Mahonia nervosa* | Evergreen woodland matrix; synonym *Berberis nervosa* | [OSU](https://landscapeplants.oregonstate.edu/plants/mahonia-nervosa) |
| PNW-08 | Slough sedge — *Carex obnupta* | Wet-site matrix; vigorous rhizomes need room | [WNPS](https://www.wnps.org/native-plant-directory/78%3Acarex-obnupta) |
| PNW-09 | Inside-out flower — *Vancouveria hexandra* | Spreading woodland groundcover | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |
| PNW-10 | Vine maple — *Acer circinatum* | Small woodland tree | [OSU](https://extension.oregonstate.edu/catalog/ec-1577-gardening-oregon-native-plants-west-cascades?reference=catalog) |

**Implementation:** reuse grass, sedge, fern, iris, perennial, shrub, and tree renderers. Tune shared morphology for sage flower tiers, manzanita branching, and compound Oregon-grape leaves if necessary. Review the hard shrub footprint before promising that a spreading woody groundcover behaves like an interplantable herbaceous matrix. Ship California in two six-plant batches and PNW in two five-plant batches.

## Phase 2 — Florida: 10 candidates

**Implemented locally:** all FL-01–FL-10 with reviewed warm-site calendars,
searchable synonyms, mature shrub footprints, and distinct reusable cycad and
fan-palm forms. Phase 0 infrastructure remains deferred, so north/central/south
Florida, freeze, provenance, spreading, and sourcing limits remain explicit in
plant descriptions rather than being presented as automatic filters.

Prioritize the persistent ground layer and warm-climate structure. FL-01 through FL-06 and FL-08/FL-10 can be a first batch using existing morphology families with tuning. FL-07 and FL-09 need distinct cycad and fan-palm treatment. Florida's north/central/south differences must remain visible in recommendations.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| FL-01 | Frogfruit — *Phyla nodiflora* | Flowering groundcover; spreading and seasonally dormant; Texas crossover | [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/frogfruit/) |
| FL-02 | Sunshine mimosa — *Mimosa strigillosa* | Low spreading ground layer with puff flowers; distinct from mimosa trees | [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/powderpuff-mimosa/) |
| FL-03 | Beach sunflower — *Helianthus debilis* | Sunny sandy groundcover; choose local subspecies; perennial in warm areas, annual where it freezes | [UF/IFAS](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/beach-sunflower/) |
| FL-04 | Elliott's lovegrass — *Eragrostis elliottii* | Airy matrix grass; short-lived, not permanent unchanging clumps | [FNPS](https://www.fnps.org/plant/eragrostis-elliottii) |
| FL-05 | Dwarf Fakahatchee grass — *Tripsacum floridanum* | Coarse grass clumps; southern Florida origin, cold affects foliage | [FNPS](https://www.fnps.org/plant/tripsacum-floridanum) |
| FL-06 | Native blue porterweed — *Stachytarpheta jamaicensis* | Low trailing flowers; verify native species, not taller nonnative lookalikes; short-lived | [FNPS](https://www.fnps.org/plant/stachytarpheta-jamaicensis) |
| FL-07 | Coontie — *Zamia integrifolia* | Evergreen architectural cycad; toxic parts; nursery-grown stock | [FNPS](https://www.fnps.org/plant/zamia-integrifolia) |
| FL-08 | Firebush — *Hamelia patens* | Warm-climate flowering shrub; verify Florida-native stock and cold limits | [FNPS](https://www.fnps.org/plant/hamelia-patens) |
| FL-09 | Saw palmetto — *Serenoa repens* | Essential fan-leaf structure; spreading habit needs room | [FNPS](https://www.fnps.org/plant/serenoa-repens) |
| FL-10 | Simpson's stopper — *Myrcianthes fragrans* | Evergreen flowering/fruiting screen for suitable warm coastal/hammock sites | [FNPS](https://www.fnps.org/plant/myrcianthes-fragrans) |

**Implementation:** do not render coontie as an unchanged fern, or saw palmetto as a yucca. Isolate these morphology tickets so they do not delay the other eight. If a replacement is needed for that first release, consider oblongleaf twinflower (*Dyschoriste oblongifolia*) or Walter's viburnum (*Viburnum obovatum*); these are reserves, outside the 68 numbered candidates. [FNPS twinflower](https://www.fnps.org/plant/dyschoriste-oblongifolia), [FNPS Walter's viburnum](https://www.fnps.org/plant/viburnum-obovatum)

Do not present beach sunflower as permanently perennial in cold gardens. Distinguish short-lived plants and spreading groundcovers from stable long-lived clumps. Do not generalize an Atlantic-coast subspecies to Gulf-coast habitat plantings.

## Phase 3 — Colorado and Rocky Mountain gardens: 10 candidates

**Implemented locally:** all CO-01–CO-10 with reviewed synonyms, dimensions,
season windows, reusable cool-season grass and flower morphology, and mature
reservations for the three woody shrubs. Phase 0 remains deferred, so ecotype,
elevation, provenance, drainage, host-risk, and local-rule limits remain in the
plant descriptions rather than being presented as automatic Colorado filters.

This batch complements the existing shortgrass and dry-flower catalog. Start with CO-01 through CO-07, then the three shrubs. Keep the blue columbine in a cooler/moister palette, separate from the driest sunny matrix.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| CO-01 | Prairie Junegrass — *Koeleria macrantha* | Small cool-season matrix grass | [CSU](https://extension.colostate.edu/resource/native-grasses-for-use-in-colorado-landscapes/) |
| CO-02 | Indian ricegrass — *Eriocoma hymenoides* | Airy dryland grass; synonym *Achnatherum hymenoides* | [CSU](https://extension.colostate.edu/resource/native-grasses-for-use-in-colorado-landscapes/) |
| CO-03 | Rocky Mountain penstemon — *Penstemon strictus* | Blue-purple vertical flowering accent | [CSU](https://extension.colostate.edu/resource/native-herbaceous-perennials-for-colorado-landscapes/) |
| CO-04 | Blue flax — *Linum lewisii* | Fine flowering filler; distinguish from *L. perenne* | [CSU](https://extension.colostate.edu/resource/native-herbaceous-perennials-for-colorado-landscapes/) |
| CO-05 | Sulphur buckwheat — *Eriogonum umbellatum* | Low mat and persistent flower structure | [CSU](https://extension.colostate.edu/resource/native-herbaceous-perennials-for-colorado-landscapes/) |
| CO-06 | Colorado blue columbine — *Aquilegia coerulea* | Cooler/moister mountain and partial-shade planting | [CSU](https://extension.colostate.edu/resource/native-herbaceous-perennials-for-colorado-landscapes/) |
| CO-07 | Fringed sage — *Artemisia frigida* | Silver dry-ground layer | [CSU](https://extension.colostate.edu/resource/ground-cover-plants/) |
| CO-08 | Rubber rabbitbrush — *Ericameria nauseosa* | Late-flowering dryland shrub; synonym *Chrysothamnus nauseosus* | [CSU](https://elpaso.extension.colostate.edu/wp-content/uploads/sites/44/2022/09/Pollinator-Native-Plant-List-final.pdf) |
| CO-09 | Mountain mahogany — *Cercocarpus montanus* | Open foothill shrub; distinctive seed tails | [CSU](https://extension.colostate.edu/resource/native-shrubs-for-colorado-landscapes/) |
| CO-10 | Golden currant — *Ribes aureum* | Flowering/fruiting deciduous structure | [CSU](https://extension.colostate.edu/resource/native-shrubs-for-colorado-landscapes/) |

**Implementation:** primarily data and shared morphology tuning. Preserve differences between cool-season grasses and warm-season blue grama. Verify seed/flower silhouettes rather than recoloring the nearest existing flower. Front Range, Western Slope, foothill, and high-elevation recommendations need separate qualifiers.

## Phase 4 — Texas and Arizona/arid Southwest: 12 candidates

**Implemented locally:** all TX-01–TX-06 and AZ-01–AZ-06 with independently
reviewed data, searchable botanical synonyms, representative regional bloom
windows, and reusable flower and airy-canopy morphology. The eight shrubs use
the normal mature woody reservation path, including trailing indigo bush's
five-foot spread. Phase 0 remains deferred, so Texas subregions, Arizona low
desert versus high country, rainfall response, drainage, humidity, local
origin, and safety limits stay explicit in descriptions rather than becoming
automatic regional filters.

### 4A. Texas regional structure and shade: 6 candidates

Combine these with the existing Texas sedges, northern sea oats, sideoats grama, sages, red yucca, flame acanthus, blackfoot daisy, pecan, and bald cypress. Frogfruit from Phase 2 and yaupon/blue mistflower from Phase 5 supply additional appropriate Texas roles without duplicate records. If Texas is tackled first, those shared taxa can move forward without changing their identity.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| TX-01 | Lindheimer's muhly — *Muhlenbergia lindheimeri* | Large structural grass; central Texas limestone-country character | [NPSOT](https://www.npsot.org/posts/native-plant/big-muhly/) |
| TX-02 | Heartleaf skullcap — *Scutellaria ovata* | Shade filler; cool-season foliage, possible summer dormancy | [NPSOT](https://www.npsot.org/posts/native-plant/scutellaria-ovata/) |
| TX-03 | Turk's cap — *Malvaviscus arboreus* var. *drummondii* | Flowering shade shrub/subshrub; cold dieback; unrelated to Turk's-cap lily | [NPSOT](https://www.npsot.org/posts/a-nice-bloomer-during-the-hot-summer/) |
| TX-04 | Texas rock rose — *Pavonia lasiopetala* | Low flowering shrub for drained beds; central Texas emphasis | [Texas Master Gardeners](https://txmg.org/grayson/rock-rose/) |
| TX-05 | Cenizo / Texas sage — *Leucophyllum frutescens* | Silver shrub for dry sites; not a wet East Texas default or a Salvia | [Texas A&M](https://rangeplants.tamu.edu/plant/ceniza-purplesage-texas-silverleaf/) |
| TX-06 | Texas mountain laurel — *Dermatophyllum secundiflorum* | Evergreen small-tree/screen structure; well-drained central/south Texas sites | [NPSOT](https://www.npsot.org/chapters/boerne/articles-by-bill-ward/mountain-laurel-is-nice-plant-of-the-month-by-bill-ward/), [Arizona Extension nomenclature](https://extension.arizona.edu/publication/pruning-shrubs-low-and-mid-elevation-deserts-arizona) |

Retain *Sophora secundiflora* and *Calia secundiflora* as searchable synonyms for Texas mountain laurel. Its identity must remain separate from the existing eastern mountain laurel, *Kalmia latifolia*.

### 4B. Arizona low desert and selected arid Southwest sites: 6 candidates

These are separate site options, not one interchangeable Arizona/west Texas native palette. Sonoran choices require their own range and cold qualifications. Flagstaff/high-country gardening needs the mountain/cold-dry review instead.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| AZ-01 | Alkali sacaton — *Sporobolus airoides* | Structural bunchgrass for alkaline or seasonally moist desert flats | [USDA plant guide](https://plants.usda.gov/DocumentLibrary/plantguide/pdf/cs_spai.pdf) |
| AZ-02 | Trailing indigo bush — *Dalea greggii* | Spreading woody groundcover; Chihuahuan origin, drained sites | [University of Arizona](https://apps.cals.arizona.edu/arboretum/taxon.aspx?id=1044) |
| AZ-03 | Brittlebush — *Encelia farinosa* | Silver mound/spring daisies; Sonoran/Mojave warm-desert focus | [Arizona Extension](https://extension.arizona.edu/events/new-short-take-highlighting-native-plants-brittlebush-encelia-farinosa) |
| AZ-04 | Jojoba — *Simmondsia chinensis* | Evergreen shrub framework; Sonoran emphasis, separate sexes | [Arizona Extension](https://yavapaiplants.extension.arizona.edu/simmondsia-chinensis) |
| AZ-05 | Pink fairy duster — *Calliandra eriophylla* | Fine foliage and puff flowers; distinct from Baja fairy duster | [University of Arizona](https://cales.arizona.edu/desertlegumeprogram/legume-taxa/calliandra-eriophylla.html) |
| AZ-06 | Blue palo verde — *Parkinsonia florida* | Airy green-barked desert canopy; mature-space requirements | [Arizona Extension](https://extension.arizona.edu/publication/mesquite-and-palo-verde-trees-urban-landscape) |

**Implementation:** two independent six-plant batches. Reuse shared grass/shrub/tree architecture with fine foliage, puff flowers, open canopies, and green bark where required. Check whether the current shrub footprint suits trailing indigo bush's proposed use. No cactus renderer is needed for this batch; a later cactus pass should be separate rather than delay these missing functions.

## Phase 5 — Carolinas and humid Southeast: 8 candidates

**Implemented locally:** all SE-01–SE-08 in two independently reviewed four-plant batches. The records retain narrower-range, nursery-propagation, reseeding, spreading, wet-site, dioecious-fruit, regional leaf-persistence, and mature-size qualifications in their descriptions because Phase 0 remains deferred. Green-and-gold and Indian pink strengthen the woodland layer; Carolina wild petunia and blue mistflower add long and late flower windows; swamp sunflower and slender Indiangrass add tall wet-meadow structure; yaupon holly and sweetbay magnolia add evergreen or seasonally persistent woody structure where climate permits.

Focus on shaded ground layers, late-season flowers, and coastal woody structure. Existing Cherokee/blue wood sedges, Southern blue flag, cardinal flower, sweetspire, summersweet, and oakleaf hydrangea already supply useful companions where locally suitable.

| ID | Plant | Role and qualification | Source |
| --- | --- | --- | --- |
| SE-01 | Green-and-gold — *Chrysogonum virginianum* | Low woodland groundcover; moist, drained shade | [NC State](https://plants.ces.ncsu.edu/plants/chrysogonum-virginianum/) |
| SE-02 | Indian pink — *Spigelia marilandica* | Red/yellow woodland flowering accent; nursery-propagated stock | [NC State](https://plants.ces.ncsu.edu/plants/spigelia-marilandica/) |
| SE-03 | Carolina wild petunia — *Ruellia caroliniensis* | Flowering edge/understory filler; distinct from Mexican petunia | [NC State](https://plants.ces.ncsu.edu/plants/ruellia-caroliniensis/) |
| SE-04 | Blue mistflower — *Conoclinium coelestinum* | Late flowers for moist naturalized beds; spreads strongly | [NC State](https://plants.ces.ncsu.edu/plants/conoclinium-coelestinum/common-name/blue-boneset/) |
| SE-05 | Swamp sunflower — *Helianthus angustifolius* | Tall late flowers for moist acidic sites; spreading | [NC State](https://plants.ces.ncsu.edu/plants/helianthus-angustifolius/) |
| SE-06 | Slender Indiangrass — *Sorghastrum elliottii* | Regional grass and winter structure; distinct from *S. nutans* | [NC State](https://plants.ces.ncsu.edu/plants/sorghastrum-elliottii/) |
| SE-07 | Yaupon holly — *Ilex vomitoria* | Evergreen screen/small tree; Texas crossover, sex matters for fruit | [NC State](https://plants.ces.ncsu.edu/plants/ilex-vomitoria/) |
| SE-08 | Sweetbay magnolia — *Magnolia virginiana* | Flowering tree for moist acidic sites; size/leaf persistence vary regionally | [NC State](https://plants.ces.ncsu.edu/plants/magnolia-virginiana/) |

**Implementation:** the two four-plant batches reuse data-gated mat, spike, mistflower, sunflower, vertical-grass, shrub, and broadleaf-tree architecture. New reusable controls lift mat flowers above foliage, shape Indian-pink star tubes, add optional trumpet throats and magnolia flowers, and bend nodding grass plumes. Blue mistflower and swamp sunflower join their existing presentation groups without losing exact species records. The dev-only `dev/phase5-review.html` contact sheet covers both renderer modes, all seasons, and sprite-edge checks. Southern evergreen or semi-evergreen appearance is not extrapolated to every northern location.

## Phase 6 — national coverage audit and Alaska/Hawaii starter batches: 6 candidates

Completing the named regions is not enough to claim complete US coverage. Audit the inland Northwest/Great Basin, northern Plains, cold Northeast/Upper Midwest, Gulf Coast, Alaska, and Hawaii against the expanded catalog. Reuse appropriate earlier additions before adding more species.

| ID | Plant | Initial target and role | Source |
| --- | --- | --- | --- |
| AK-01 | Woolly geranium — *Geranium erianthum* | Alaska flowering perennial | [UAF landscape checklist](https://www.uaf.edu/afes/publications/database/miscellaneous-publications/files/pdfs/MP_2005-08.pdf) |
| AK-02 | Bunchberry — *Cornus canadensis* | Northern woodland groundcover | [UAF landscape checklist](https://www.uaf.edu/afes/publications/database/miscellaneous-publications/files/pdfs/MP_2005-08.pdf) |
| AK-03 | Prickly rose — *Rosa acicularis* | Northern flowering shrub | [UAF landscape checklist](https://www.uaf.edu/afes/publications/database/miscellaneous-publications/files/pdfs/MP_2005-08.pdf) |
| HI-01 | Oahu sedge — *Carex wahuensis* subsp. *wahuensis* | Hawaiian grasslike matrix | [Native Plants Hawaii](https://nativeplants.hawaii.edu/landscape_uses/erosion-control/) |
| HI-02 | Ilima — *Sida fallax* | Hawaiian low shrub/groundcover; specify growth form | [Native Plants Hawaii](https://nativeplants.hawaii.edu/plants/sida-fallax/) |
| HI-03 | Hawaiian white hibiscus — *Hibiscus arnottianus* | Hawaiian flowering shrub/small tree | [University of Hawaii](https://www.ctahr.hawaii.edu/hawnprop/plants/hib-arno.htm) |

These are starter candidates for dedicated local review, not complete Alaska/Hawaii palettes. Alaska needs coastal/interior distinctions and local cold performance; Hawaii needs island, elevation, rainfall, and provenance distinctions. Hawaii cannot inherit a continental North America native label. Confirm current nomenclature, conservation status, and appropriate nursery sources before implementation; use the older UAF checklist as evidence of garden experience, not a current invasive-plant clearance.

## Definition of done for every plant batch

- [ ] Recheck base entries, nested exact taxa, cultivar Latin overrides, synonyms, and migration aliases. Never add a second species just to obtain another tray card.
- [ ] Record botanical identity and sources; distinguish native range from cultivated suitability. Verify true species vs cultivar/hybrid provenance.
- [ ] Verify `heightIn`, mature `spread`, on-center `space`, zone range, light/moisture, growth habit, persistence/lifespan, bloom months, and regional qualifications. Real inches stay separate from art `h`/`cw`. Do not infer deer/rabbit resistance from genus alone.
- [ ] Author seasonal appearance, including dormant structure or year-round foliage where appropriate. Put bloom timing in the canonical `BLOOM_MONTHS` table. Identify regional timing as approximate unless supported locally.
- [ ] Reuse shared renderer forms/parameters. New palms, cacti, or other distinctive architecture require a reusable morphology extension; never disguise them as a generic grass or shrub. Keep variation deterministic and expensive work outside the frame loop.
- [ ] Verify searchable common/scientific names, synonyms, family grouping, regional recommendations, and mobile tray readability. Keep one Sedge tab with its existing habitat headings.
- [ ] For implementation releases, run `node --check` on touched modules and `node tests/run.js`; update count assertions intentionally. Browser-check load order, four-season previews, placement/spacing, woody footprints, save/load, native modes, and mobile scrolling. New metadata requires behavioral tests and backward-compatible defaults.
- [ ] Check art at tray size and in a dense garden. If photos are added, follow the existing attribution/licensing workflow and offline caching rules. Bump all three version locations only when preparing an actual app release.
- [ ] Assemble at least one usable regional example from existing plus new plants. Keep incompatible moisture/site groups separate. A suggested product acceptance target is 20–30 reviewed choices per common regional site profile, including multiple ground-layer options, structural choices, and seasonal flowering succession; it is a coverage goal, not a universal botanical threshold.

For each regional release, validate a sunny low-water design, a woodland/partial-shade design, and a moisture-loving design where locally relevant. Verify coastal and high-elevation cases separately. Report empty or weak combinations honestly instead of padding them with unsuitable plants.

## Existing-data reviews that should not be counted as new plants

- `serviceberry.cv.standingovation` is already present but needs its taxon/selection attribution reconciled before proposing another Saskatoon-serviceberry record.
- `heuchera.cv.palacepurple` already exists; resolve its species attribution rather than counting a related western alumroot as wholly missing. [NC State discussion](https://plants.ces.ncsu.edu/plants/heuchera-palace-purple/)
- The yarrow, lady fern, and pasqueflower records currently carry Europe-only origin data. Review their exact taxonomic scope and North American lineages before relying on native-filter counts. Do not blanket-change all cultivars to locally native.
- Preserve the existing Southwest pack: it already includes Arizona cottontop, red yucca, sotol, ocotillo, Parry/Havard agaves, blackfoot/four-nerve/chocolate daisies, desert marigold, multiple penstemons, flame acanthus, damianita, Apache plume, desert willow, mistflower, sages, globemallows, zinnias, and primroses.

This roadmap prioritizes native regional gaps because the existing catalog already contains many general garden ornamentals. It does not make the app native-only. A later ornamentals pass should follow the same regional suitability and invasive-risk review, and annual bedding plants should remain separate from persistent perennial structure.
