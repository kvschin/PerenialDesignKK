# Five plant additions from the improvement audit

Implemented locally October 8, 2026, from audit items N01–N05. The additions
are Wild Strawberry (*Fragaria virginiana*), Spicebush (*Lindera benzoin*),
Bunchberry (*Cornus canadensis*), Prickly Rose (*Rosa acicularis*), and Woolly
Geranium (*Geranium erianthum*). All five are straight species, with no new
cultivars or duplicate base taxa. The catalog now contains 640 base records
and 487 nested choices. Prepared for release 0.9.65 on October 11, 2026;
application, package and offline-cache versions are synchronized.

## Source review and planning values

Sources were reviewed October 8, 2026. Real dimensions below are inches;
`h` and `cw` remain separate drawing parameters. Spacing represents an
on-center design choice, and `grow` is a planning estimate for years to the
represented woody size. Neither is a source-backed growth guarantee.
Spreading colonies can extend beyond the recorded mature planning patch.

| Plant | Authored planning values | Evidence and limits |
| --- | --- | --- |
| Wild Strawberry | Height 8; spread 24; spacing 12; zones 4–9; sun; medium moisture | [Missouri Botanical Garden](https://plantfinder.mobot.org/PlantFinderDetails.aspx?taxonid=291715) gives 3–9 in height and 12–24 in spread. Its summary says zones 5–9 while its culture text says 4–9; the catalog uses the latter and does not imply universal zone-4 performance. [NC State Extension](https://plants.ces.ncsu.edu/plants/fragaria-virginiana/) supports the species identity and low spreading habit. Sun or partial shade is described in the blurb; runners, variable winter foliage and summer heat response remain explicit. |
| Spicebush | Height 120; spread 120; spacing 96; zones 4–9; part shade; moist soil; `grow:5` | [Morton Arboretum](https://mortonarb.org/plant-and-protect/trees-and-plants/spicebush/) describes a 6–12 ft shrub and zones 4–9. Ten feet represents that range; eight-foot spacing and five years to represented size are authoring estimates. The fruit illustration represents a female with a nearby male pollinizer, not a promise that every plant fruits. Yellow flowers precede leaf-out. |
| Bunchberry | Height 9; spread 12; spacing 12; zones 2–6; part shade; moist soil; `grow:3` | [NC State Extension](https://plants.ces.ncsu.edu/plants/cornus-canadensis/) and [Missouri Botanical Garden](https://plantfinder.mobot.org/PlantFinderDetails.aspx?taxonid=279331) support the low woodland habit and cool, moist, acidic site requirements. [Kew](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A271519-1) supports the North American/Asian range. It remains a deciduous dwarf **shrub** despite its herbaceous appearance; the `umbel` form describes the drawing, not its biology. Its one-foot patch is not a colony boundary. Three years is a planning estimate. |
| Prickly Rose | Height 48; spread 60; spacing 48; zones 1–6; sun; medium moisture; `grow:3` | [Oregon State University](https://landscapeplants.oregonstate.edu/plants/rosa-acicularis) supports zone-1 cold hardiness. The upper zone 6 is a conservative **planning limit**, not a source-verified heat ceiling. [US Forest Service FEIS](https://research.fs.usda.gov/feis/species-reviews/rosaci) supports persistent hips, suckering and animal browse. [Kew](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A30089555-2) records the broad North American/European/Asian range. Representative dimensions, spacing and three years to size are planning estimates; local provenance and regional form still matter. |
| Woolly Geranium | Height 24; spread 20; spacing 18; provisional zones 3–7; part shade; medium moisture | [RHS](https://www.rhs.org.uk/plants/7878/geranium-erianthum/details) supports the cultivated perennial habit and gives H7; **H7 is not USDA zone 7** and is not converted directly. [Kew](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A109140-2) supports the North American/Asian range. The [UAF landscape checklist](https://www.uaf.edu/afes/publications/database/miscellaneous-publications/files/pdfs/MP_2005-08.pdf) is evidence of Alaska garden experience, not a tested summer-heat ceiling. Zones 3–7 remain an explicitly provisional planning range in the app; dimensions and spacing represent a cultivated clump, with local nursery advice still needed. |

The zone-3 search snippet on a J.C. Raulston Arboretum page belonged to the
neighboring *Geranium macrorrhizum* entry and was rejected as evidence for
*G. erianthum*. No plant receives deer or rabbit resistance merely because
of genus or aromatic foliage; Prickly Rose explicitly retains its browse
qualification.

## Identity, range and seasonal decisions

- New records declare `nativeTo` and `provenance:'species'` inline. These are
  continental native ranges, not local provenance or recommendations inferred
  from USDA zones. Alaska coastal/interior differences and the remaining
  national/Hawaii coverage work are still open.
- Bunchberry retains the useful synonym *Chamaepericlymenum canadense*.
  *Cornus canadensis* var. *intermedia* belongs to *C. unalaschkensis* and is
  deliberately **not** an alias for this entry. Woolly Geranium retains
  *Geranium pratense* var. *erianthum* for discovery. Prickly Rose remains a
  species-level record; no subspecies or nursery provenance is implied.
- `BLOOM_MONTHS` owns approximate calendar windows: Wild Strawberry April–May,
  Spicebush March–April, and Bunchberry, Prickly Rose and Woolly Geranium
  May–July. The wider northern windows allow for geographic timing; in
  particular they do not promise repeated or continuous flowering on a rose.
- Wild Strawberry has white spring flowers and a separate red summer fruit
  display. Bunchberry has four white bracts around tiny flowers followed by
  red fruit. Spicebush has conditional female fruit in fall; Prickly Rose
  carries autumn and some winter hips. The seasonal scene is representative,
  not a local phenology forecast or a fruit-set simulation.
- Each species has a Wikipedia article title in `WIKIPEDIA_ARTICLES`; the five
  exact article pages were checked on the review date. No photograph or new
  runtime request is required for these entries.

## Shared rendering contract

The additions reuse the existing mat, umbel and woody-bush renderers. New
options are opt-in and bounded, with seeded geometry and no species-key
branches:

- `shrub` with `habit:'matflower'` accepts `compound:'trifoliate'` for three
  toothed leaflets on a short petiole, with bounded `compoundLen`.
- The same mat grammar accepts `fruitStyle:'fleshy'` and bounded `fruitR` for
  a small fruit and calyx after flowering; ordinary dry seedheads keep their
  existing treatment.
- `stemLeafArrangement:'terminalWhorl'` places six leaves immediately below
  a shoot tip, including nonflowering leafy shoots.
- `umbelStyle:'bracted'` accepts `bractN`, clamped to 3–6, plus `bractLen` and
  `bractW`. Bunchberry authors four bracts; fruit stages omit those flowering
  bracts. Entries without the option retain the existing bracted grammar.

Spicebush uses bare-stem flowers; Prickly Rose uses arching woody stems,
pinnate leaves, single rose flowers and hips; Woolly Geranium uses palmate
foliage and loose five-petaled flowers. Bunchberry follows ordinary shrub
placement and individual counting despite its low `umbel` drawing.

## Implementation verification

- All module syntax checks passed; the automated suite passed **859 tests**.
  The shrub dimension validator now permits six-inch dwarf shrubs rather than
  incorrectly requiring every woody species to reach one foot.
- [The seasonal review page](../../dev/audit-plants-review.html) uses actual
  library and tray drawing paths. **240 sprite checks and 80 preview checks**
  passed with no painted edges in ART2 and Classic, across four seasons,
  three seeds and two growth buckets. Both seasonal sheets were inspected.
- **672 existing shrub/umbel preview comparisons** were pixel-identical to
  the previous renderer. The new opt-in branches do not alter those plants.
  A full-growth ART2 spring drawing recorded respectively 82, 601, 42, 1047
  and 80 curved-path primitives for strawberry, spicebush, bunchberry, rose
  and geranium; corresponding fill/stroke calls were 104, 28, 67, 22 and 66.
  These are drawing-operation counts, not frame-rate measurements.
- An isolated Edge browser passed **15 library searches and detail views**
  at 1200, 390 and 320-pixel widths, without horizontal overflow. All five
  passed the North American straight-species filter, ordinary placement,
  save/load and planting-list export checks, with no browser script errors.
- A read-only final reviewer examined the implementation and both visual
  styles and found no actionable issues. No physical-device or local growing
  trials are claimed.

## Release 0.9.65 verification — October 11, 2026

The additions were checked again on top of the intervening 0.9.62–0.9.64
changes. All syntax checks and **869 automated tests** passed. All **24 browser
release checks** passed across desktop and two phone viewports, including
saved gardens, offline reopening and the service-worker update flow.

The separate season-skip suite failed its first `today-year` scenario with
three outdated sprites on arrival. A read-only comparison serving the exact
0.9.64 HEAD files reproduced the same failure. This is an existing issue;
season-skip acceptance remains open and is not claimed as passing for this
release. No unrelated skip behavior was changed by the plant addition.
