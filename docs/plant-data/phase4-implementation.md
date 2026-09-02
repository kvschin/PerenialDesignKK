# Texas and Arizona/arid Southwest expansion — phase 4

Implemented locally September 1, 2026, version 0.8.47. Adds the six Texas
species TX-01 through TX-06 and six Arizona/arid Southwest species AZ-01
through AZ-06 from the regional roadmap. Catalog totals: 527 base records / 377
nested choices. No new runtime dependency or remote request was added.

Evidence: [Texas botanical review](phase4a-sources.json), [Arizona botanical
review](phase4b-sources.json), and [twelve verified Wikipedia
references](phase4-wikipedia.json). The two botanical artifacts record accepted
taxa, synonyms, source URLs, confidence limits, and the distinction between
published values and planning estimates.

## Authoring decisions

- All twelve use the existing broad North American origin contract. That does
  not assert nativity or suitability throughout Texas, Arizona, the Southwest,
  or the US. Phase 0 remains deferred, so state subregions, high-country versus
  low-desert climate, drainage, salinity, rainfall response, humidity, and
  local origin remain description-level qualifications.
- Lindheimer's muhly keeps medium moisture as the safer planning default and is
  distinct from pink muhly and pampas grass. Heartleaf skullcap is a part-shade
  woodland filler that may become quiet in summer rather than a dryland matrix
  plant.
- Turk's cap is the Texas *Malvaviscus* taxon, not Turk's-cap lily; its record
  describes cold dieback and root resprouting. Texas rock rose keeps its short
  life, reseeding, and mildew limits. Cenizo is a dry-site *Leucophyllum*, not a
  *Salvia* or a wet East Texas default.
- Texas mountain laurel remains separate from eastern *Kalmia latifolia* and is
  searchable by *Sophora secundiflora* and *Calia secundiflora*. Its large,
  slow-growing footprint and severe red-seed toxicity warning are explicit.
- Alkali sacaton is tied to alkaline, saline, or seasonally wet desert flats,
  not generalized to every dry slope. Trailing indigo bush keeps its five-foot
  woody-groundcover reservation and states that it is a Chihuahuan garden
  option rather than an Arizona-native claim.
- Brittlebush records warm-desert frost and summer-dormancy limits. Jojoba
  states that male and female flowers occur on separate plants, so one plant
  does not promise seed. Pink fairy duster stays distinct from Baja fairy
  duster. Blue palo verde reserves a 25-foot crown and names thorn, litter,
  pruning, borer, mistletoe, and witches'-broom concerns.

## Visuals and verification

Shared shrub flowers now support a furled Turk's-cap side view, a bounded daisy
head, and a pea-family banner/wing/keel shape. Shrub bloom branches propagate
authored eye colors, and `bloomStyle:'powderpuff'` supplies reusable filament
heads. Broadleaf trees can opt into a bounded twig canopy and suppress the
default leaf wash, allowing blue palo verde's green branching and open crown
to remain legible. All controls are data gated and seeded; no renderer checks a
Phase 4 species key.

The regression suite covers source-reviewed identities and dimensions,
synonym search across library/tray/discovery, regional and safety caveats,
mature shrub reservations, and finite deterministic all-season rendering in
both renderer modes. `dev/phase4-review.html` is a dev-only offline contact
sheet with Texas/Arizona batches, four seasons, renderer selection, and
sprite-edge checks; it is not linked from the app or service-worker precache.

Automated verification passed all 440 tests and `npm run check`. The contact
sheet completed 144 sprite checks in ART2 and 144 in classic with no painted
edges, and a clean browser tab reported no console warnings or errors. The live
library was checked at desktop and 390 x 844: all four seasons stay visible,
the 527-record count and version 0.8.47 are current, and the legacy names
*Sophora secundiflora* and *Cercidium floridum* find the correct details. The
work remains local; no commit, push, or deployment was performed.

The final read-only QA pass also verified adjacent-season discovery: February
Texas mountain-laurel flowers remain available to the Winter purple filter,
and June brittlebush flowers remain available to the Summer yellow filter even
though their representative whole-season illustrations stay visually
conservative.
