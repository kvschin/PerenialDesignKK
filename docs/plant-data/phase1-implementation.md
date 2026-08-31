# West Coast expansion — phases 1A / 1B

Implemented locally August 30, 2026, version 0.8.44. Adds the 12 California and 10 Pacific Northwest species from the regional roadmap, plus 'Howard McMinn' as a nested Vine Hill manzanita selection. Catalog totals: 495 base records / 377 nested choices. No new runtime dependencies or remote requests.

Evidence: [California botanical review](phase1a-sources.json), [Pacific Northwest botanical review](phase1b-sources.json), and [22 verified Wikipedia references](phase1-wikipedia.json). These preserve source URLs, uncertainty, and the difference between sourced measurements and planning estimates. Roemer's fescue redirects to a broader Idaho fescue article that discusses its subspecies synonym.

## Authoring decisions

- All 22 use the existing North American origin contract. This does not imply local nativity or suitability everywhere in the US. Phase 0 remains deferred: no zone-picker, native-filter, climate, or seasonal-engine changes.
- Real height, mature width, spacing, and renderer dimensions remain distinct. Woody growth years are simulation estimates, not botanical guarantees. Final CA horizons are buckwheat 4, Cleveland sage 5, blueblossom 10, manzanita 8 (Howard McMinn 10), and coffeeberry 10 years.
- Low Oregon grape uses its documented larger eventual 36 × 72-inch size, with 60-inch design spacing and an estimated 15-year growth horizon, rather than the source review's 10-year 24 × 48-inch plant. It and salal keep mature shrub occupancy even with groundcover roles.
- Seaside daisy uses medium moisture to accommodate inland cultivation; the description explains its maritime preference and inland protection needs. California fuchsia and foothill penstemon remain woody-based, maintained perennials in the existing forb category, like the existing pineleaf penstemon convention.
- Oregon iris allows winter or drought dieback and has no green winter foliage slot. Sword fern has evergreen foliage but no bloom-month or seed-head metadata; the existing spring growth envelope remains unchanged. Winter snow and regional bloom timing are still approximations in the existing engine.
- Bloom-month tables use the reviewed regional windows. Grass and sedge flowers have seasonal colors as well as later seed colors. Several conservative USDA upper endpoints have weaker evidence; consult the botanical reviews before broadening them or asserting nationwide suitability.
- Ribes carries the reviewed North Carolina restriction and humid-Southeast caveat in its description. This is not a new legal-filter system.
- Search now includes recorded botanical synonyms in the library and ordinary tray, matching the existing exact-discovery search behavior.

## Visuals and verification

New shared drawing options cover fine grass panicles, shorter deergrass foliage, exposed manzanita branches, pinnate Oregon grape leaves, tiered sage flowers, matte buckwheat seedheads, and compound/reflexed inside-out flowers. No renderer checks a species key. Existing paths retain their seeded layouts when these options are absent.

Run `node tests/run.js` and `npm run check`. The new regression cases cover the approved roster, synonym discovery, woody groundcover reservations, tree underplanting, deterministic geometry, and actual grass seed-stem rendering. `dev/west-coast-review.html` is an offline dev-only contact sheet with four-season previews, classic/ART2 selection, and an edge check over the new species and cultivar. It is not linked from the app or service-worker precache.

Completed verification: 427 tests passed; syntax checks passed; 276 sprite-edge cases in each renderer mode passed; desktop library and 390 × 844 phone library checked, including botanical-synonym search and four-season layout. Independent review compared 6,792 original species/cultivar renderings with the baseline and found no changes. Its new-flower stroke-state finding was fixed and covered by a regression test. Work remains local; no commit, push, or deployment was performed.
