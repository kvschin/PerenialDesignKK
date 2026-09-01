# Colorado and Rocky Mountain expansion — phase 3

Implemented locally August 31, 2026, version 0.8.46. Adds the ten Colorado and
Rocky Mountain species CO-01 through CO-10 from the regional roadmap. Catalog
totals: 515 base records / 377 nested choices. No new runtime dependency or
remote request was added.

Evidence: [botanical review](phase3-sources.json) and [ten verified Wikipedia
references](phase3-wikipedia.json). The botanical artifact records accepted
taxa, searchable legacy names, source URLs, confidence limits, and where a
published value ends and a planning estimate begins.

## Authoring decisions

- All ten use the existing broad North American origin contract. That does not
  claim local nativity or suitability throughout Colorado, the Rockies, or the
  US. Phase 0 remains deferred: no regional-native, elevation, ecotype,
  climate, drainage, host-risk, or legal filter is included.
- Prairie Junegrass and Indian ricegrass are cool-season dryland grasses,
  distinct from warm-season blue grama. Both descriptions ask for provenance
  suited to local elevation; Junegrass notes summer quiet or dormancy, while
  ricegrass states its slow establishment and short- to medium-lived nature.
- Rocky Mountain penstemon keeps drainage and airflow guidance and is not
  presented as a low-desert substitute. Blue flax remains a short-lived,
  reseeding filler and explicitly distinguishes *Linum lewisii* from
  *L. perenne* and retail material sold as 'Appar'.
- Sulphur buckwheat represents a low semievergreen mat while acknowledging the
  many regional taxa within this variable species. Colorado blue columbine is
  part sun / medium moisture and carries no dry, gravel, or matrix role.
- Fringed sage is botanically a woody-based evergreen subshrub but stays in the
  soft perennial placement layer. Its description records drainage, subtle
  flowers, and widening rhizomes.
- Rubber rabbitbrush represents a four-foot ecotype and warns that regional
  forms vary and may spread aggressively. Mountain mahogany is the deciduous
  open foothill *Cercocarpus montanus*, not evergreen curlleaf mountain
  mahogany; its 15-year represented-size horizon is a planning estimate.
- Golden currant keeps its white pine blister-rust host warning, directs users
  to current state and local *Ribes* rules, and excludes 'Crandall' and
  *R. odoratum/villosum* material from this straight-species record. Summer
  berries do not create false winter-interest or seedhead roles.

## Visuals and verification

The shared `cloudgrass` form can add bounded awns, and `airywand` can opt into
five-petaled radial flowers. A reusable columbine branch draws backward spurs,
sepals, a contrasting inner cup, and dry follicles; Wild Columbine uses the
same grammar. Shrub flower size can be tuned through `flowerR`, and woody plants
can opt into short or long plumed achenes without a species-key branch. All
options are data gated, seeded, and available in classic and ART2 renderers.

The regression suite covers the reviewed roster and dimensions, exact synonym
discovery, regional caveat wording, mature woody reservations, berry versus
winter-seedhead roles, and all-season finite deterministic rendering in both
renderers. `dev/colorado-review.html` is an offline dev-only contact sheet with
four-season previews, renderer selection, and sprite-edge checks; it is not
linked from the app or service-worker precache.

Final verification completed September 1, 2026: the automated suite passed all
436 tests at the end of Phase 3, and `npm run check` passed. The contact sheet
completed 120 sprite checks in ART2 and 120 in classic with no painted edges;
the rendered Colorado ground-layer and woody batches were inspected in the
browser with no console errors. The work remains local; no commit, push, or
deployment was performed.
