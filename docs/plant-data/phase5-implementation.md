# Carolinas and humid Southeast expansion — phase 5

Implemented locally September 1, 2026, version 0.8.51. Adds the four woodland
and lower-layer species SE-01 through SE-04 and four meadow/woody species SE-05
through SE-08 from the regional roadmap. Catalog totals: 535 base records / 377
nested choices. No runtime dependency or remote request was added.

Evidence: [woodland/lower-layer botanical review](phase5a-sources.json),
[meadow/woody botanical review](phase5b-sources.json), and [eight verified
Wikipedia references](phase5-wikipedia.json). The botanical artifacts record
accepted taxa, synonyms, source URLs, confidence limits, and the distinction
between published values and planning estimates.

## Authoring decisions

- All eight use the existing broad North American origin contract. That does
  not assert nativity or suitability throughout either Carolina, the humid
  Southeast, or the US. Phase 0 remains deferred, so mountain/Piedmont/coast
  context, local origin, heat, moisture, soil, and regional phenology remain
  description-level qualifications.
- Green-and-gold retains the narrower documented range behind the roadmap's
  broad regional role. Indian pink records nursery-propagated sourcing, its
  North Carolina conservation status, and toxicity; it is not presented as a
  plant to collect from the wild.
- Carolina wild petunia remains the native *Ruellia caroliniensis*, distinct
  from invasive Mexican petunia, and states its short-lived, reseeding habit.
  Blue mistflower keeps its rapid rhizomatous spread and moist-site behavior.
- Swamp sunflower keeps its tall, spreading wet-meadow structure. Slender
  Indiangrass remains a non-rhizomatous clump with a loose, nodding flower head
  rather than inheriting the denser silhouette of Indiangrass.
- Yaupon holly records that plants are male or female, so one plant does not
  promise fruit; berry toxicity, caffeinated leaves, and fire behavior remain
  explicit. Sweetbay magnolia states that foliage persistence and mature size
  change by climate, and keeps *Magnolia virginiana* var. *australis* within
  the species record rather than promising one uniform form.

## Visuals and verification

Shared mat flowers can lift authored heads above the foliage mass with
`matHeadRise`. Shared spike flowers can opt into five-lobed `starTube` flowers,
and penstemon-like flowers can opt into a contrasting `tubeThroat`. Vertical
grasses can bend only their upper flower plume with a bounded `plumeNod`.
Broadleaf trees can call the shared flower helper for an authored magnolia
shape. Each control is data gated and seeded, and no renderer checks a Phase 5
species key.

Blue mistflower joins the existing mistflower presentation group and swamp
sunflower joins the sunflower group; exact records, synonyms, dimensions, and
saved references remain independent. Yaupon holly uses the normal mature shrub
reservation. Sweetbay magnolia uses normal tree trunk occupancy while allowing
compatible ground-layer planting beneath its canopy.

The regression suite covers source-reviewed identities, dimensions, range and
safety qualifications, synonym search across library/tray/discovery, exact
season-color reachability, grouping, mature woody placement, and finite,
deterministic, data-gated all-season rendering in both renderer modes.
`dev/phase5-review.html` is a dev-only offline contact sheet with both
four-plant batches, four seasons, renderer selection, and sprite-edge checks;
it is not linked from the app or service-worker precache.

Automated verification passed all 465 tests and `npm run check`. The contact
sheet completed 96 sprite checks in ART2 and 96 in classic with no painted
edges. The live library loaded version 0.8.51 and the 535-record catalog;
*Eupatorium coelestinum* found Blue Mistflower and *Magnolia glauca* found
Sweetbay Magnolia. At 390 x 844, search, details, and the four-season row stayed
usable, and the browser reported no console warnings or errors. The work
remains local; no commit, push, or deployment was performed.
