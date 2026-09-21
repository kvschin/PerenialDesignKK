# Regional plant guidance: initial review

Reviewed September 6, 2026. This implements the initial release scope of readiness items 4–5: clear continental-origin limits, sourced site qualifications, and visible regional invasive cautions. It is a bounded review, not a complete regional recommendation system.

The authoritative records are `PLANT_GUIDANCE` and `PLANT_GUIDANCE_SOURCES` in `js/core.js`. Each assessment names a taxon, review date, geographic scope, source, and advice. Native-range observations, growing conditions, and invasive concerns are separate fields. The app does not collect or infer a garden location from the chosen origin continent or USDA zone.

## Reviewed coverage

| Catalog entry | Regional invasive caution | Source |
| --- | --- | --- |
| Mexican feather grass | California | [Cal-IPC](https://www.cal-ipc.org/plants/profile/stipa-tenuissima-profile/) |
| Miscanthus | Maryland | [University of Maryland Extension](https://www.extension.umd.edu/resource/ornamental-and-native-grasses-landscape) |
| Chinese fountain grass | Maryland | [University of Maryland Extension](https://www.extension.umd.edu/resource/ornamental-and-native-grasses-landscape) |
| Cherry laurel | King County, Washington | [King County](https://kingcounty.gov/en/dept/dnrp/nature-recreation/environment-ecology-conservation/noxious-weeds/identification-control/cherry-laurel) |
| Fragrant waterlily | Washington | [King County](https://kingcounty.gov/en/dept/dnrp/nature-recreation/environment-ecology-conservation/noxious-weeds/identification-control/fragrant-water-lily) |
| Japanese spirea | North Carolina | [NC State Extension](https://plants.ces.ncsu.edu/plants/spiraea-japonica/common-name/japanese-spirea/) |
| Common milkweed | European Union | [EPPO categorization](https://gd.eppo.int/taxon/ASCSY/categorization) |
| Fig | California | [Cal-IPC](https://www.cal-ipc.org/plants/profile/ficus-carica-profile/) |
| Olive | California | [Cal-IPC](https://www.cal-ipc.org/plants/profile/olea-europaea-profile/) |

Narrower species-range observations are included for little bluestem, big bluestem, switchgrass, blueblossom, firebush, beach sunflower, and Catawba rhododendron. These describe the source's region; they do not certify an individual garden or nursery plant's provenance.

Six species have additional site qualifications: blue fescue (drainage/heat), blueblossom (drainage/winter exposure), firebush (freeze response/establishment), beach sunflower (drainage/irrigation/coastal exposure), Catawba rhododendron (acidity/drainage), and cenizo (humidity/hot nights/drainage). Sources are linked in each record and displayed beside the advice. Source pages beyond the table above: [OSU blueblossom](https://landscapeplants.oregonstate.edu/plants/ceanothus-thyrsiflorus), [UF/IFAS firebush](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/firebush/), [UF/IFAS beach sunflower](https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/beach-sunflower/), [NC State rhododendron](https://plants.ces.ncsu.edu/plants/rhododendron-catawbiense/), and [NC State cenizo](https://plants.ces.ncsu.edu/plants/leucophyllum-frutescens/common-name/texas-barometer-bush/).

## How it behaves

- Native-filter copy explicitly names continental scope. The stored `nativeRegion`/`nativeMode` values and filtering behavior are unchanged.
- Exact plant choices show a separate notes button; families with a reviewed concern direct people to individual choices. The library and planted-plant card provide the same guidance. Source links open only when clicked; all advice is readable offline.
- Show invasive-risk text only when a reviewed caution exists. Otherwise omit the statement from plant details and leave the CSV guidance field empty. Missing guidance remains unknown in the data, without inferred local nativity or automatic recommendation exclusion. Warnings are regional assessments, not a global ban list.
- The resolved botanical name must match the reviewed taxon. Different species and unreviewed hybrids nested under another entry do not inherit its assessment. Named selections of the reviewed species keep species cautions, with an explicit statement that the selection has not been individually cleared. Fig and olive records retain the source's cultivar qualifications.
- Saved plants, inactive schemes, imports, Favorites, and palettes remain intact. Planting-list exports carry local-status uncertainty and regional cautions with dates and source URLs; quantities are unchanged.
- Generic bamboo is deliberately unassessed: the catalog's Fargesia/Phyllostachys grouping does not identify an exact species. It must not inherit a golden-bamboo assessment by visual name alone. Chinese and Oriental fountain grasses likewise remain distinct.

## The invasive filter (0.9.3–0.9.4)

Each invasive note now carries two more fields, and both exist so the catalog gate can read the table at all:

- **`region`** — the served region the caution applies to (`north-america` or `europe`). The state or county in `area` stays as the human-readable record, but it is *not* the filter's resolution: `nativeRegion` is continental, so per-state precision is precision the gate cannot consume. Trying to settle "invasive" state by state is what stalled this review at eleven records.
- **`severity`** — `avoid` or `caution`, following each note's own recorded wording. This is what per-state variation was really for: King County listing yellow flag Class C, *control not required*, is not the claim that a plant smothers woodland.

`filters.invasive` (`hide` | `show`, default `hide`) gates the catalog through `plantRefFitsCriteria`, so every discovery source — recommended, all eligible, Favorites, named palettes — inherits it. Before this the eleven records were read by nothing, and all six style palettes offered all eleven flagged plants to a North American garden.

**A plant native to the region is never hidden by that region's own caution** (`invasiveFilterHides`). Invasive means *introduced* and spreading, and a plant cannot be introduced to the continent it comes from: Cal-IPC's record for *Nassella tenuissima* describes a range expansion from its native Texas and New Mexico into coastal California, not an arrival in North America. Two species are in this class — *Nassella tenuissima* and *Nymphaea odorata* — and both stay in the catalog carrying their caution. The filter handles what continental resolution can express (introduced species); the card handles what it cannot. Asking the question globally instead would delete *Asclepias syriaca* from a North American garden because the EU lists it, and take *Vinca minor*, *Iris pseudacorus* and *Prunus laurocerasus* out of Europe, where all three are native.

Display and gating therefore diverge deliberately: `invasiveCautionsFor` is what a card shows, `invasiveFilterHides` is what leaves the catalog. Counts for the filter's own copy come from `invasiveFilterCounts`, which reports `hidden` and `keptNative` from one walk — the hint must promise what the filter delivers, not what the table holds. North America: 8 hidden, 2 kept. Europe: 1 hidden, 0 kept.

Caution treatment on a row is **region-scoped and severity-led** — `Invasive in California` against `Caution in Washington`. Severity is stated in words rather than tint, because background and colour are both discarded under forced colours, and because a Kansas gardener needs to read *which place* a record is about in order to judge that it is not about them. A caution recorded for another region stays reachable in the dialog but no longer alarms the row; unscoped, a European garden was warned by North Carolina's list about a plant native to Europe.

## The checker (`dev/invasive-check.js`, 0.9.5)

Source-first review: one published list intersected with the whole catalog in a single pass, rather than 596 plant-by-plant decisions. Dev only; it writes nothing to `js/`.

```bash
node dev/invasive-check.js --list              # configured sources, and what is not
node dev/invasive-check.js --source calipc     # intersect, and draft what is unrecorded
node dev/invasive-check.js --verify            # schema, live links, coverage drift
```

Configured and verified working:

| id | region | source | plants |
|---|---|---|---|
| `easin` | europe | EU List of Invasive Alien Species of Union Concern (JRC), `/apixg/catxg/euconcern` — JSON, no key, publishes `Synonyms` and `IsPartNative` | 48 |
| `calipc` | north-america | California Invasive Plant Inventory — rating (High/Moderate/Limited/Watch) plus a "still in the horticultural trade" column | 331 |

Not configured, with the reason, so it is not rediscovered: **USDA PLANTS**' Invasive/Noxious dataset was not migrated to the 2021 rebuild and a replacement is pending; the **Invasive Plant Atlas** refuses automated requests (HTTP 403). Cal-IPC speaks only for California, so North American coverage remains a genuine gap.

Fetches snapshot to `dev/invasive-lists/<id>.json` with a retrieval date and count, so `--verify --offline` works and a run is reproducible.

**First run findings (2026-09-21).** EASIN matched one plant, *Asclepias syriaca*, already recorded — the catalog is otherwise clean of EU-listed plants. Cal-IPC matched seven, of which **three had no record**: *Cynara cardunculus* (Moderate), *Digitalis purpurea* (Limited) and *Leucanthemum vulgare* (Moderate), all three still sold in the trade and all three added during the European expansion, where a Californian list was not something anyone thought to check against a European native. Two recorded severities disagree with the source's own rating and are left for a human: fig (we say `caution`, Cal-IPC Moderate) and *Nassella tenuissima* (we say `avoid`, Cal-IPC Limited — the lowest tier).

**Matching.** Everything compares as a binomial. Results fall in three buckets: matched, same-genus (worth a look), and same-epithet — which is how a genus transfer appears (`Cenchrus alopecuroides` ← *Pennisetum alopecuroides*, a synonym this catalog records only in prose) but measured 46 of 46 coincidences against Cal-IPC, so it is counted by default and printed under `--all`. Nothing is dropped silently.

**What it cannot do.** Decide whether a single county's listing belongs in a continental filter; judge a cultivar exemption; or write the note. Drafts leave `source` and `text` as `TODO` deliberately.

## Remaining coverage work

Backfill narrower native-range and site reviews across the regional palettes; add country/state/ecoregion selection only with matching reviewed coverage. Review additional invasive concerns and exact cultivar exceptions as evidence becomes available. Maintain dates and recheck changing assessments before release. Do not infer clearance from a missing entry, continental origin, nursery availability, or the word “sterile.”

Validation on September 6, 2026: `npm run check` passed; `node tests/run.js` passed all 531 tests. Automated checks cover record integrity, taxon/cultivar isolation, unknown states, unchanged eligibility, readable source links, exports, and saved-scheme preservation. Headless Edge browser checks passed at 320×568, 390×844, 820×1180, and 1280×900: library and catalog guidance, exact-species cautions, modal keyboard navigation and return focus, wrapping, and CSV downloads. No page errors or automatic external requests were observed. Physical-device validation is still separate.
