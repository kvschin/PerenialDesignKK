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

## Remaining coverage work

Backfill narrower native-range and site reviews across the regional palettes; add country/state/ecoregion selection only with matching reviewed coverage. Review additional invasive concerns and exact cultivar exceptions as evidence becomes available. Maintain dates and recheck changing assessments before release. Do not infer clearance from a missing entry, continental origin, nursery availability, or the word “sterile.”

Validation on September 6, 2026: `npm run check` passed; `node tests/run.js` passed all 531 tests. Automated checks cover record integrity, taxon/cultivar isolation, unknown states, unchanged eligibility, readable source links, exports, and saved-scheme preservation. Headless Edge browser checks passed at 320×568, 390×844, 820×1180, and 1280×900: library and catalog guidance, exact-species cautions, modal keyboard navigation and return focus, wrapping, and CSV downloads. No page errors or automatic external requests were observed. Physical-device validation is still separate.
