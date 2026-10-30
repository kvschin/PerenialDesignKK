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
