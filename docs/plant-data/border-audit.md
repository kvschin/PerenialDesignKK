# Border perennial audit (Nov 2026, 0.9.97)

Four perennials that drew as some other plant: lesser calamint, great
St. Johnswort, the bee balms and the red-hot pokers. 18 choices before, 26
after. Each was looked at in four seasons, as a close-up of its flower head,
and at true scale beside a 6 ft post, in `dev/border-review.html`
(`?batch=beebalm`, `?only=key,key:cv`, `?ov=` to try a change, `?check`,
`?bench=1`). Catmint is on that page as calamint's nearest look-alike.

## What was wrong, and what changed

| Plant | Problem | Change |
| --- | --- | --- |
| Lesser calamint | Drawn as a `umbel`: eight bare stalks each topped by a flat white plate, like a small yarrow. It is a tidy, bushy dome of small leafy stems with loose sprays of tiny white-to-lilac flowers all over its top (RHS: "loose clusters of tiny ... flowers", "compact, bushy"; Walters Gardens: "a perfect mound"). | Moved to the `shrub` form's `leafystems` habit with `mass:'dome'` and the `haze` head style (catmint's grammar, finer and greener). Height 15 in (RHS to 30 cm; Walters 8-12 in; Nature Hills 12-18 in). |
| Great St. Johnswort | Drawn as a `cone` daisy: five rays round a bristly dome on bare stalks over a basal fan, so it read as a coneflower. *Hypericum ascyron* has erect stems leafy to the top with opposite, clasping leaves; flowers with five twisted, floppy petals round about 100 stamens in five bundles; then upright, pointed capsules about an inch long that dry brownish black (Minnesota Wildflowers; Illinois Wildflowers). | `flowerStyle:'hypericum'` (pinwheel petals round an erect stamen boss) and `seedStyle:'capsule'`; no basal fan; opposite leaves up the stems, gone in winter. Two open flowers a stem: each lasts a day, so a cyme rarely shows more. Bloom July-August (Minnesota Wildflowers). |
| Wild bergamot, scarlet and eastern bee balm | A lit ball with six spokes and star florets on a bare stalk over a basal fan: an allium. A bee balm head is a whorl of long two-lipped tubes splayed round a cushion of calyces on a ruff of bracts, on square stems leafy to the top. | `globeStyle:'monarda'`: tubes built in the round, the bract ruff (pale on wild bergamot, red-flushed on Oswego tea), a green knot on stems not yet in flower, and a bristly brown seed ball through winter. Opposite leaves, pairs turned a quarter at each node (`decussate`) so the stems stop reading as ladders, and clumps as wide as their spread. Eastern bee balm's lips are freckled. |
| Spotted and lemon bee balm | Tiers of oval blobs stacked into one lumpy column on a bare stalk. | The same whorl, tiered up the stem with bare stem between (`whorlStyle:'monarda'` on the `bractstack` form): showy pink-white bracts under small spotted yellow tubes on horsemint, narrow recurved lavender bracts on lemon mint. Leafy stems. Hummingbird sage keeps the old `bractstack` drawing. |
| Red-hot poker | A column of round beads, red over yellow. A torch is a dense raceme of narrow tubes: buds at the top point up and press to a point, open flowers below turn and hang, so the torch widens downward. | `spikeStyle:'torch'`: buds pointing up in the `eye` colour, open flowers hanging in the `bloom` colour, the open part climbing from the bottom through the season to `budFrac` of the torch at peak; a younger stem in bud; a seed spike set with capsules. The foliage is a fountain of strap leaves arching out on both sides (`leafArch`). The six euphorbias and other plants on `poker` are untouched. |

## Cultivars added

All under `redhotpoker` (*Kniphofia* hybrids), each a distinct colour or size:

| Choice | Look | Height, bloom | Sources |
| --- | --- | --- | --- |
| 'Alcazar' | one even red-orange | 30 in, Jun-Aug | Cotswold Garden Flowers (75 cm, "uniform red-orange", Jun-Aug) |
| 'Timothy' | salmon-orange | 36 in, Jun-Sep | RHS (to 1 m, early summer to early autumn, AGM) |
| 'Percy's Pride' | green buds opening greenish yellow | 44 in, Jul-Sep | RHS (to 1.2 m, mid summer to early autumn) |
| 'Ice Queen' | pale green fading through cream to near white | 54 in, Jul-Sep | RHS (to 1.5 m, mid to late summer into autumn) |
| 'Tawny King' | dull orange buds opening cream | 44 in, Jul-Sep | RHS (to 1.2 m, mid summer to early autumn, AGM) |
| 'Toffee Nosed' | slim cream torches tipped toffee brown | 44 in, Aug-Sep | RHS (to 1.2 m, late summer and early autumn, AGM) |
| 'Little Maid' | dwarf, grassy; greenish buds opening buff, fading cream | 24 in, Aug-Sep | RHS (to 60 cm, late summer and early autumn) |
| 'Papaya Popsicle' | compact, papaya orange | 18 in, Jun-Sep, zones 6-9 | Walters Gardens (18 in, summer through fall, USDA 6-9) |

'Royal Standard' and 'Bees' Sunset' gained a `budFrac` each. Zones for the
RHS cultivars are the species record's (RHS gives H5/H6, which is not a USDA
zone).

Not added: 'Shining Sceptre' (orange buds opening light yellow, RHS: too close
to 'Bees' Sunset' and 'Royal Standard'), 'Mango Popsicle' (another compact
orange beside 'Papaya Popsicle'), 'Lemon Popsicle' (no source page could be
read), 'Flamenco' (a seed mix, not one plant).

## Renderer, opt-in

Every new option is read only by a record that sets it. Drawing every choice
in the catalog through the old and new `draw.js` with the old data gave
identical canvas call streams (1,302 choices, 20,832 draws).

- `globeStyle:'monarda'` (globe) and `whorlStyle:'monarda'` (bractstack), both
  through `drawMonardaHead`: `headR`, `cushion`, `tubes`, `tubeLen`, `tubeW`,
  `tubeArch`, `tubeLift`, `bracts`, `bractLen`, `bractW`, `bractRise`,
  `bractCurl`, `spots`, and on the tiered form `tiers`, `tierGap`. The season's
  `bract` colour draws the ruff.
- `flowerStyle:'hypericum'`, `stamens` and `seedStyle:'capsule'`,
  `capsuleLen` on the cone form.
- `spikeStyle:'torch'` (`drawTorchLily`): `spikeLen`, `torchW`, `rows`,
  `tubeW`, `budFrac`.
- Stemmed forbs: `stemBase` (how far out a stem rises from; default 0.4),
  `stemLeafSpan` and `stemLeafRise` for arranged stem leaves, `decussate`,
  `winterBare`; and `leafArch` on the basal fan.

## Cost

Interleaved bench in headless Chrome, min of three rounds, the 12 choices that
existed before, in Summer, Fall and Winter: 6.2 ms to 9.1 ms summed over 36
bakes, the worst single bake 0.63 ms (wild bergamot in flower, eleven leafy
stems). The bee balms and St. Johnswort cost more because their stems now
carry leaves; the pokers cost less. Paid once per sprite bake, never per
frame. The eight new pokers sum 6.7 ms over 24 bakes. 1,248 sprites and 416
previews checked in both renderers, none touching an edge.

## Noticed, not changed

- Calamint is drawn white; 'Blue Cloud' pale blue. Other common selections
  ('Montrose White', 'Marvelette Blue') would draw the same as these two.
- Great St. Johnswort is the catalog's only *Hypericum*. The shrubby native
  St. Johnsworts (*H. prolificum*, *H. kalmianum*, *H. frondosum*) are absent.
- North American *H. ascyron* is sometimes treated as *H. pyramidatum*
  (Minnesota Wildflowers, missouriplants.com). The record keeps the name it had.
