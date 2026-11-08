# Plant work log

Unattended plant-catalog batches, newest last. Each entry names its branch so
later runs do not redo or touch the same records.

## 2026-10-26 — winter dormancy for perennials that drew a lone shadow

- Branch: `claude/plants-2026-10-26-dormant-leafmounds` (PR #12)
- Batch: audit item (a), appearance.
- `look.dormantWhenBare` added to hosta, brunnera, daylily, ladyfern,
  maidenhairfern, hayscentedfern, newyorkfern, japanesepaintedfern,
  jacobsladder, forgetmenot, poppymallow, rozanne, insideoutflower and
  sunshinemimosa (27 choices with cultivars). Each drew only a ground shadow
  in Winter.
- Brunnera (and 'Jack Frost', 'Looking Glass'): Fall `seed` removed. It was
  never drawn and gave a false seedhead role.
- Deferred, renderer work needed: heuchera scalloped leaves, Astrantia
  palmate leaves, astilbe ferny foliage and plumes, 'Jack Frost' veins.
- Noted, not changed: forget-me-not overwinters as a rosette in reality.
- Next in priority: (b) heightIn backfill for herbaceous records.

## 2026-10-27 — real heights for ornamental grasses

- Branch: `claude/plants-2026-10-27-grass-heights` (PR #14)
- Batch: item (b), heightIn backfill, grasses.
- `heightIn` (flowering height) added to sideoats, bluegrama, karl, overdam,
  sesleria, bluemoorgrass, lovegrass, mexicanfeather, northernseaoats,
  giantstipa, molinia, moorhexe, purplemoorgrass, blueoatgrass,
  quakinggrass, sandlovegrass, arizonacottontop, dropseed, and
  dropseed 'Tara'. `h` untouched.
- Deferred (a cultivar lacks a sourced height, which it would otherwise
  inherit wrongly): indiangrass ('St. Louis'), tuftedhair
  ('Bronzeschleier'), orientalfountain, koreanfeatherreed, and the large
  cultivar families bluestem, bigbluestem, switchgrass, pinkmuhly,
  miscanthus, fountaingrass, bluefescue, hakone.
- Still to do in (b): those grasses, 30 sedges, 210 forbs, 40 bulbs,
  6 water plants.
- Note: missouribotanicalgarden.org and plants.ces.ncsu.edu are blocked
  from the run environment, so values come from search-result excerpts.

## 2026-10-29 — real heights for sedges

- Branch: `claude/plants-2026-10-29-sedge-heights` (PR #16)
- Batch: item (b), heightIn backfill, sedges.
- `heightIn` (typical garden height in flower) added to all 30 `type:'sedge'`
  records that lacked one (sloughsedge already had it), including
  snowywoodrush, plus palm sedge 'Oehme' (24 in). `h` untouched.
- Every sedge now has a height; a test holds that.
- Still to do in (b): the deferred grass cultivar families (see 2026-10-27),
  210 forbs, 40 bulbs, 6 water plants.
- Same network limits as before: values from search excerpts.

## 2026-10-30 — real heights for water plants and single bulbs

- Branch: `claude/plants-2026-10-30-bulb-water-heights` (PR #17)
- Batch: item (b), heightIn backfill, water plants and bulbs.
- `heightIn` added to the 6 water plants lacking it (waterlotus,
  fragrantwaterlily, pickerelweed, waterblueflag, arrowhead, lizardtail) and
  to all 28 bulbs with no cultivars (the alliums, species tulips, golden
  crocus, camassias scilloides/quamash, the four lilies, scilla peruviana,
  puschkinia, English bluebell, winter aconite, trout lily, wood anemone,
  ivy-leaved cyclamen, lycoris). `h` untouched.
- Deferred: bulb families with cultivars (crocus, daffodil, muscari,
  gardentulip, camassialeichtlinii, snowdrop, anemoneblanda, ipheion,
  leucojum, fritillaria, colchicum, dahlia); snowdrop also overlaps
  backlog-6.
- Still to do in (b): those bulb families, the deferred grass families,
  ~210 forbs.

## 2026-11-02 — real heights for prairie forbs

- Branch: `claude/plants-2026-11-02-prairie-forb-heights` (PR #18)
- Batch: item (b), heightIn backfill, forbs (first batch).
- `heightIn` added to 38 cultivar-free prairie forbs: the 8 milkweeds
  (butterfly … antelopehorns), liatris/pycnostachya/cylindracea, the 6
  sunflowers, prairie/Baldwin's/giant/'Summer's Swan Song' ironweed,
  pallida/topeka/angustifolia/paradoxa, both prairie clovers, prairiedock,
  grayheadedconeflower, mexicanhat, both zizias, lanceleaf, talltickseed,
  rudbeckiatriloba/maxima, falsesunflower, rattlesnake. `h` untouched.
- To double-check: rudbeckiamaxima, antelopehorns, heartleafalexander,
  falsesunflower, rattlesnake, goldenalexander (set from standard references,
  no fresh citation).
- Still to do in (b): ~172 forbs (next: Southwest/desert forbs, ferns,
  woodland forbs, then cultivar families), plus the deferred grass and bulb
  families.

## 2026-11-03 — real heights for Southwest and desert forbs

- Branch: `claude/plants-2026-11-03-southwest-forb-heights` (PR #19)
- Batch: item (b), heightIn backfill, forbs (second batch).
- `heightIn` added to 27 cultivar-free Southwest/desert forbs: redyucca,
  sotol, ocotillo, parryagave, havardagave, blackfootdaisy, fournervedaisy,
  desertmarigold, chocolateflower, the penstemons (parry, palmer, eaton,
  desert, pineleaf), greggmistflower, mealycupsage, autumnsage, pitchersage,
  both globemallows, prairieverbena, both zinnias, tuftedprimrose,
  berlandiersundrops, engelmanndaisy, wrightbuckwheat. `h` untouched.
- Decision: agaves and sotol state the rosette/foliage height, since their
  stalk is monocarpic or irregular; ocotillo is 180 in (its canes).
- Still to do in (b): ~145 forbs. Next: ferns (avoid the five that PR #12
  touches), woodland forbs, then the cultivar families; plus the deferred
  grass and bulb families.

## 2026-11-07 — grass audit, step 1 (0.9.88)

- Direct to master. The audit is `docs/plant-data/grass-audit.md`; this is the per-plant record.
- `heightIn` (flowering height) added to the 12 grasses without one and to the 43 cultivars under them
  that redraw their own `h`. `h` untouched. In inches, with what each rests on: H Hoffman, C Chicago
  Botanic Garden, N NVK, U UGA B987-4.
  - bluestem 42 (N 39-49, H 36). standingovation 48 (H, C), theblues 42 (H 36, C 50), chameleon 24 (H),
    hahatonka 42 (H 39-48), carousel 30 (H; C 32), jazz 36 (C), prairiemunchkin 22 (C).
  - bigbluestem 72 (N 59-79, H 84, U 48-96). blackhawks 60 (H 48-60, C 62), redoctober 66 (H 60-72, C 70),
    dancingwind 75 (C).
  - switchgrass 60 (N 47-79, U 36-72). northwind 66 (H; C 75), heavymetal 56 (N 47-59, H 60, C 58),
    shenandoah 48 (H; C 52), prairiesky 54 (C), dallasblues 66 (N 59-69, H 72; C 86), cloudnine 84 (H 96, C 75),
    purpletears 48 (H).
  - indiangrass 72 (H; N 47-87). indiansteel 60 (H), stlouis 76 (C).
  - pinkmuhly 42 (H 48, U 36). whitecloud 54 (H 48-60), lenca 36 (Garden Oracle gives 'Regal Mist' 36-48; the low
    end, as the note says compact), fastforward 36 (Santa Rosa Gardens; others 24-36, to 48 in flower).
  - tuftedhair 30 (UC Sonoma: a foot or more above foot-tall tussocks; H 18). goldtau 24 (H),
    bronzeschleier 42 (trade listings about 40; RHS 20-39).
  - koreanfeatherreed 48 (H; N 35-49).
  - miscanthus 72 (N 59-98). adagio 60 (H), gracillimus 84 (H), morninglight 72 (H; K-State 84),
    strictus 90 (N 69-98, H 96), zebrinus 84 (N 59-89, H 96), malepartus 72 (N 49-79).
  - fountaingrass 42 (N 35-47, H 48). hameln 24, littlebunny 12, redhead 48, cassian 36, burgundybunny 18 (all H).
  - orientalfountain 36. karleyrose 36 (H; N 35-39; C 49).
  - bluefescue 12 (N 8-14). elijahblue 15 (H), boulderblue 12 (N 10-14), beyondblue 18 (H).
  - hakone 18 (N 16-20). aureola 14 (N 12-18), allgold 14 (N 12-16), benikaze 18 (N 16-20),
    nicholas 14: **no source read**, taken from 'Aureola'.
- Bloom months added: sideoats [7,8,9] (Wildflower Center June-November, Hoffman early summer), mexicanfeather
  [6,7,8,9] (Rita's Garden Path, White Flower Farm, NC State), miscanthus [8,9,10] (Chicago's bloom dates, Hoffman),
  bluefescue [5,6] (Hoffman), hakone [7,8,9] (NVK, Chicago), giantstipa [6,7,8,9] (RHS: summer and autumn),
  arizonacottontop [7,8,9,10] (University of Arizona: July-November; Texas A&M runs longer). Each has a `bloom`
  colour, because the calendar test wants one. Those colours are judgement, not sourced.
- Blue Fescue's `seed` in Spring and Summer became `bloom`, and `seedStems` 0 became 5, so it shows stalks in its
  window instead of never.
- Decision: Chicago's widths were not used alone. They include the flower spray, and NVK agrees with the catalog on
  'Dallas Blues', 'Heavy Metal' and the species of purple moor grass, so those stayed. 'Red Head' and 'Karley Rose'
  moved to 42 in on NVK (35-47), and 'Moorhexe' to 28 in on NVK and RHS.
- Next: step 2 of the audit, a crown for every grass.

## 2026-11-07 — grass audit, step 2 (0.9.89)

- Direct to master. The audit's "Shipped in 0.9.89" has the drawing and the measurements; this is the per-plant record.
- `look.crownIn` (clump width at the ground, inches) on all 40 grasses. Judgement, not sourced: about a third of
  the stated spread for the big clumps, more for the low ones so a drift closes. bluestem 9, bigbluestem 12,
  switchgrass 12, dropseed 12, indiangrass 8, sideoats 10, bluegrama 12, karl 8, overdam 8, sesleria 12,
  bluemoorgrass 14, lovegrass 10, pinkmuhly 10, mexicanfeather 6, tuftedhair 10, koreanfeatherreed 12,
  northernseaoats 12, miscanthus 18, fountaingrass 14, orientalfountain 14, bluefescue 11, hakone 10, giantstipa 14,
  molinia 14, moorhexe 12, purplemoorgrass 12, blueoatgrass 12, quakinggrass 10, sandlovegrass 12,
  arizonacottontop 10, deergrass 24, purpleneedlegrass 6, roemersfescue 8, elliottslovegrass 10,
  dwarffakahatcheegrass 14, prairiejunegrass 11, indianricegrass 10, lindheimersmuhly 18, alkalisacaton 10,
  slenderindiangrass 10.
- Cultivars stating their own: standingovation 7 and northwind 8 (upright), beyondblue 9 (reached past its sprite).
- Hair coats under the fine grasses: bluefescue, roemersfescue, bluegrama, sideoats, quakinggrass, sesleria,
  bluemoorgrass, prairiejunegrass, moorhexe, purplemoorgrass.
- More foliage, so a drift closes: `leaves` raised on most grasses, with `fan`/`leafFan` and `moorgrass`'s new
  `leafSpread` on the low ones; bigbluestem gained basal leaves and `stems:10`; the two fountain grasses `stems:11`.
- `sideScale` measured on the 21 choices whose library card or tray picture clipped: bluestem .56, chameleon 1.06,
  carousel 1.32, jazz .67, shenandoah .55, stlouis .77, fastforward 1.09, koreanfeatherreed .65, adagio .58,
  morninglight .58, zebrinus .58, fountaingrass .78, redhead .71, cassian .68, orientalfountain .75,
  karleyrose .92, hakone 1.42, benikaze 1.76, deergrass .79, dwarffakahatcheegrass .7, lindheimersmuhly .75.
- Next: step 3 of the audit, rebuilding the forms that draw the wrong plant.

## 2026-11-07 — grass audit, step 3 (0.9.90)

- Direct to master. The audit's "Shipped in 0.9.90" has the drawing and the measurements; this is the per-plant record.
  Every value below is judgement against photographs and the stated sizes, not sourced.
- Hanging panicles (`headStyle:'panicle'`): giantstipa (11 culms, 8 branches, awns 9px), quakinggrass (`spkShape:'locket'`),
  northernseaoats (`spkShape:'flat'`, `culmNod` .75, 4 leaves on each culm), blueoatgrass (`culmNod` .6, narrow),
  bluefescue (short upright culms), purpleneedlegrass (nodding, awns 7px). Basal leaves shortened under the culms and
  given `leafArch` on giantstipa (.34 of H), quakinggrass (.3), northernseaoats (.36).
- sideoats: `headStyle:'pennant'`, 9 culms with 9 spikes down one side, anthers in flower.
- Domes (`foliage:'dome'`): blueoatgrass (130 leaves, crownIn 12 to 8) and bluefescue (130 leaves, crownIn 11 to 7), which
  moved from `bunchgrass` to `oatgrass`. 'Beyond Blue' no longer states its own crown.
- moorgrass heads: sesleria and prairiejunegrass `'spike'`, bluemoorgrass a short `'spike'` that reads as an ovoid,
  moorhexe (18 culms) and purplemoorgrass (14, looser) `'narrow'`. Culm lengths set so the heads stand at `heightIn`.
- mexicanfeather `habit:'mop'`: 60 leaf threads under 80 blond ones.
- hakone and its four cultivars: the one-way cascade, 46 narrower blades (`leafW` 2.6 to 1.6), `arch` .74.
- miscanthus `fountain:true`: 34 ribbons with a pale midrib, 12 plumed culms, `plumeStyle:'silk'`. gracillimus and
  morninglight finer ribbons; zebrinus and strictus `bands`, and their Summer `fol` greener now that the bands carry
  the gold; strictus narrower and stiffer.
- `sideScale` re-measured on the new drawings: northernseaoats .66, blueoatgrass .76, adagio .65, morninglight .66,
  zebrinus .66, mexicanfeather 1.03 (from 1.42), hakone 1.23 (from 1.42), benikaze 1.53 (from 1.76); purpleneedlegrass
  needs none.
- Next: step 4, the missing species, drawn on these forms.

## 2026-11-08 — grass audit, step 4, first batch (0.9.91)

- Direct to master. Twelve species from the audit's "Add first" table and 'Undaunted' Ruby Muhly. Sizes, zones, ranges
  and bloom months are sourced, with the reasoning per plant in `docs/plant-data/grass-sources.json`; colours and drawing
  values are judgement against photographs.
- Hoffman supplied zone, season and height with and without bloom for six (read in the browser pane); New Moon, NVK,
  Prairie Moon, FNPS, UF, Plant Select, Chicago's trial and the Wildflower Center the rest. The Wildflower Center gave
  bloom months for all twelve, but for a Texas or whole-range season where a plant runs north, so Giant Sacaton, Eastern
  Gamagrass and Prairie Cordgrass carry an estimated zone 5-7 window.
- Zones that needed a decision: Bottlebrush 3-8 (sources 2-9), California Fescue 7-10 (sources 5-11; its range is west of
  the Cascades and Sierra), Eastern Gamagrass 4-10 (FNPS and UF Miami-Dade take it to 10), Sand Cordgrass 8-11 (FNPS and
  UF; Hoffman's 6-9 is beyond the range), Prairie Cordgrass 3-9 (Prairie Moon 3-8; the range reaches Louisiana).
- Wiregrass is Aristida stricta, as Hoffman and the Wildflower Center have it, with A. beyrichiana and A. stricta var.
  beyrichiana as synonyms. The cordgrasses carry their 2014 Sporobolus names as synonyms. Wikipedia files Wavy Hairgrass
  under Avenella flexuosa and Sand Cordgrass under Sporobolus bakeri; Prairie Cordgrass resolves only to the genus.
- Groups: gamagrass (eastern, and dwarffakahatcheegrass, which gains the group), hairgrass (wavy, and tuftedhair),
  cordgrass (prairie, sand).
- Drawing: bottlebrushgrass and canadawildrye `headStyle:'bristle'`; the cordgrasses and californiafescue
  `foliage:'fountain'` on `oatgrass`, the cordgrasses under `pennantUp` spikes; easterngamagrass a `vertgrass` fountain of
  3px ribbons; beakgrass a narrow panicle of big spikelets on leafy culms; giantsacaton, rubymuhly and wavyhairgrass
  `cloudgrass`; bushybluestem `vertgrass` with the silk plume; wiregrass `feathergrass` with awned panicle culms.
- `sideScale` measured off each choice's own reach: giantsacaton .76, californiafescue .61, easterngamagrass .82,
  sandcordgrass .8, prairiecordgrass .69, beakgrass .79, rubymuhly .82, undaunted 1.04.
- Next: the European and design grasses (Stipa calamagrostis, the Seslerias, Milium 'Aureum' and the rest), where the tab
  is thinnest, then step 5, site headings, now the tab is at 52.

## 2026-11-08 — grass audit, step 4, European and design grasses (0.9.92)

- Direct to master. The ten of the audit's "Europe and design grasses" table. Sizes, zones, ranges and bloom months are
  sourced, with the reasoning per plant in the `europe` batch of `docs/plant-data/grass-sources.json`; colours and
  drawing values are judgement against photographs.
- Knoll Gardens (product pages answer a plain fetch; their slugs come from the planting-area pages, and two are odd:
  `achnatherum-stipa-allgau`, `ampelodesmos-mauritanica`) gave height, flowering and habit for nine. The RHS
  (`/plants/<id>/wd/details`, ids from a search) gave size, hardiness rating and range for all ten. Digging Dog
  (`diggingdog.com/plant.php/G-nnnn`, ids from its genus pages) gave US zones, sizes and bloom months for eight. Hoffman
  stocks only 'Greenlee Hybrid'. NC State answered for Festuca amethystina and Melica ciliata and 404'd the rest.
- Decisions: Silver Spike Grass 5-8 (High Country Gardens and Jelitto) against Digging Dog's 7 and the RHS's H4. Tussock
  Grass 8-10 from the RHS's H4 and Plant Lust's 8a-11. Pheasant's Tail Grass is New Zealand's, though the RHS page says
  Taiwan. Bowles' Golden Grass is a base record for the selection, `provenance:'selection'`, with wood millet's range,
  rather than a wood millet record nobody grows. 'Greenlee Hybrid' is a hybrid with no wild range.
- Groups: the three Seslerias join `moorgrass` (chips Nest, Silver, Greenlee).
- Drawing: no new code. Seslerias `moorgrass` spikes; silverspikegrass, pheasantstailgrass (with orange `folTip`),
  tussockgrass and vinereed `foliage:'fountain'` under `headStyle:'panicle'`; largebluefescue the dome (crownIn 9, since 7
  failed the crown test on a plant twice Blue Fescue's height); bowlesgoldengrass a fan of broad gold leaves under an airy
  panicle; silkyspikemelic `vertgrass` with a narrow nodding `'spike'` plume (the `'fan'` plume drew pampas).
- `sideScale`: silverspikegrass .72, pheasantstailgrass .94, tussockgrass .7.
- One procedural draw is 0.15-0.27ms. The measuring harness once reported 9ms for Pheasant's Tail Grass; the review
  page's own bench, run twice, gives 0.23-0.25ms, so that was the harness.
- Next: "Worth adding next" and the missing cultivars, then step 5, site headings, now the tab is at 62.

## 2026-11-08 — grass audit, step 5, site headings (0.9.93)

- Direct to master. The Grasses tab lists by site: Dry meadow, Meadow, Wet meadow, Dry shade, Woodland, Moist shade, from
  each record's `sun` and `moist`. No plant data changed.
- `TRAY_CATS` names a layout with `sites:'grass'|'sedge'` (it was `sedgeSections:true`); `discoverySiteSections` reads it
  through `SITE_LAYOUTS`. Mixed families split by site (`splitGroupBySite`): moorgrass, featherreed, gamagrass, hairgrass.
- The browser search probe now expects headings on Grasses and takes Sun Perennials as its flat tab.
- Next: "Worth adding next" and the missing cultivars.
