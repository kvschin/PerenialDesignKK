# Florida expansion — phase 2

Implemented locally August 31, 2026, version 0.8.45. Adds the ten Florida
species FL-01 through FL-10 from the regional roadmap. Catalog totals: 505 base
records / 377 nested choices. No new runtime dependency or remote request was
added.

Evidence: [botanical review](phase2-sources.json) and [ten verified Wikipedia
references](phase2-wikipedia.json). The botanical artifact records exact taxa,
source URLs, confidence limits, and the distinction between published sizes
and design estimates.

## Authoring decisions

- All ten use the existing broad North American origin contract. That does not
  claim local nativity or suitability throughout Florida or the US. Phase 0
  remains deferred: no zone-picker, regional-native, climate, invasive/legal,
  site-qualifier, or seasonal-engine change is included.
- The Florida calendars describe reviewed warm-site display. Beach sunflower,
  porterweed, and firebush can bloom year-round only where frost permits;
  descriptions retain cold dieback, reseeding, and dormancy limits. Simpson's
  stopper records its main March–June display instead of incidental flowers
  through the year. Dwarf Fakahatchee's June–August window and saw palmetto's
  March–June window remain lower-confidence calendar translations in the
  botanical review.
- Frogfruit, sunshine mimosa, beach sunflower, and native blue porterweed are
  herbaceous placement modules even though their colonies can exceed the
  modeled spread. Their descriptions state the spreading behavior. Elliott's
  lovegrass and dwarf Fakahatchee grass remain short-lived rather than being
  described as permanent unchanging tussocks.
- Coastal design roles are limited to plants with reviewed salt-spray
  tolerance. Sunshine mimosa, dwarf Fakahatchee grass, and firebush are not
  recommended for exposed coastal use.
- Coontie, firebush, saw palmetto, and Simpson's stopper use hard mature shrub
  occupancy. Saw palmetto represents a 6 × 12-foot clump at 10-foot spacing;
  its 20-year growth horizon is explicitly a planning estimate. Simpson's
  stopper represents the documented 12 × 5-foot screen form, not the largest
  old tree-form specimen or a compact selection.
- Native blue porterweed is the low *Stachytarpheta jamaicensis* record. Its
  description excludes taller *S. cayennensis*, *S. urticifolia*, and hybrid
  retail material. Beach sunflower lists the Atlantic, Gulf, and inland
  subspecies contexts and warns against mixing ecotypes.
- Coontie's description retains whole-plant toxicity, especially its seeds,
  and requires reputable nursery-grown stock. Dwarf Fakahatchee retains its
  Florida threatened status and propagated-stock requirement. Firebush calls
  for locally appropriate Florida-native material rather than the commonly
  sold nonlocal yellow-orange forms.

## Visuals and verification

Two reusable forms keep the essential architecture honest without checking a
species key. `cycad` draws low crowns of rigid paired pinnate fronds with
optional cones; `fanpalm` draws offset clonal crowns, toothed petioles,
segmented palmate blades, inflorescences, and fruit. Existing `matflower`
groundcovers can opt into bounded button, puff, or spike heads and pinnate
runner leaves. A shared `sideScale` bound keeps unusually wide low forms inside
sprites and fits them into library canvases, while fan-palm vertical scaling
preserves the mature height-to-spread relationship. Other plants retain their
previous path because all additions are data gated.

The regression suite covers the reviewed roster and dimensions, safety and
provenance wording, exact synonym discovery, mature woody reservations, all
season finite/deterministic rendering in classic and ART2 modes, and distinct
cycad/fan-palm traces. `dev/florida-review.html` is an offline dev-only contact
sheet with four-season previews, renderer selection, and sprite-edge checks;
it is not linked from the app or service-worker precache.

Completed verification: 431 tests passed; JavaScript syntax checks passed;
120 sprite-edge cases in each renderer mode passed; and the live library was
checked on desktop and at a 390 x 844 phone viewport, including the
*Serenoa serrulata* synonym and four-season detail layout. The work remains
local; no commit, push, or deployment was performed.
