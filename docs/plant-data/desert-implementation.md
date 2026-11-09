# Desert rosettes and ocotillo (0.9.94)

## What was wrong with the drawings

The yuccas, red yucca, agaves, desert spoon and ocotillo were all drawn as a
**fan**: blades swept out left and right of one point.

- A yucca came out as a half-dome of blades opening to the sides, like an iris fan.
  A real one bristles toward you and away as much as to the sides.
- An agave was a radial star lying flat on the ground (a daisy seen from above).
  A real one is an artichoke whose young leaves stand up in a cone in the middle.
- Desert spoon was a flat starburst at ground level. It is a sphere.
- Ocotillo was a dense V of straight sticks, drawn at 6 ft for a plant whose canes
  run to 15. It is a sparse vase of canes, see-through, each wavering a little.

## How they are drawn now

One painter, `drawSpikyRosette` (draw.js), serves the `rosette` form when the look
names a `leafShape`, and the `agave` and `sotol` forms outright. Each leaf has an
azimuth (the golden angle) and an elevation (low for the oldest, upright for the
youngest), is built in 3D and projected (`ROS_TILT`), painted back to front and
shaded by which face the viewer sees against the light at the upper left. The look
fields are documented over the painter. What tells the plants apart is data:

| Plant | Leaf | Notes |
| --- | --- | --- |
| Soapweed yucca | `needle`, batched | a bristling ball of 96 narrow leaves, dead ones skirting the foot |
| Adam's needle | `sword` | broad flexible leaves that arch, `filaments` peeling off the margins |
| Spanish dagger | `dagger` | stiff spined leaves on a short `trunk` with a skirt of old leaves |
| Beaked yucca | `needle`, `ball`, batched | a powder-blue pompom on a shaggy trunk, `mass` for depth |
| Red yucca, giant hesperaloe | `strap` | arching (red) or upright (giant) straps with threads |
| False aloe | `lance` | a flat rosette of soft leaves |
| Desert spoon, Texas sotol | `ribbon`, `ball`, batched | a sphere with a dark interior `mass` |
| Texas beargrass | `grass`, batched | a fountain of wiry leaves spilling over (`arch` 0.95) |
| Agaves | `agave`, `lance` | cupped (`arch` negative), spined, toothed, offsets (`pups`) where the plant suckers |

Variegated cultivars set `margin`, which reads the season's `edge` as the margin
colour (the yucca records already carried it that way). Flower stalks go through
`drawRosetteScape`: nodding bells on a raceme or a branched panicle (yuccas), slim
tubes on arching wands (hesperaloe, false aloe), a narrow column (sotol), loose
plumes (beargrass). Ocotillo has its own painter, `drawOcotillo`.

Leaves never go below the ground: one that would lies along it. Those lying toward
the viewer come down the screen below the plant's foot, so `spikyRosetteBelow` adds
that strip to `plantDrawBelow`, the one bound the sprite box and the drawing share.

The daylily, which shares the `rosette` form and names no `leafShape`, draws as before.

## Cost

Measured in headless Chrome, which rasterises in software (the pessimistic case),
one procedural bake, interleaved against the previous build in one session:

| Plant | Before | After |
| --- | --- | --- |
| Soapweed yucca | 0.39ms | 0.38ms |
| Red yucca | 0.59ms | 0.81ms |
| Desert spoon | 1.48ms | 0.70ms |
| Ocotillo (in leaf) | 0.48ms | 1.01ms |
| Parry's agave | 0.43ms | ~1.4ms |
| Havard's agave | 0.43ms | 0.96ms |

The new plants run 0.35 to 0.96ms. Split onto a 1x1 canvas, 70-80% of every figure
is raster, which a GPU canvas pays far less of. That is the range the tree and shrub
habits already sit in, and a garden dense enough to feel it bakes them into sprites.

## Catalog changes

- 'Color Guard', 'Bright Edge' and 'Golden Sword' are selections of *Yucca
  filamentosa* and were filed under soapweed yucca with no native range. They move
  to the new Adam's needle record; `PLANT_REF_ALIASES` carries every saved garden
  and palette across.
- Family cards: Yucca (soapweed, Adam's needle, Spanish dagger, beaked), Hesperaloe
  (red, giant), Sotol (desert spoon, Texas), Agave (adds whale's tongue).
- New species: Adam's needle, Spanish dagger, beaked yucca, false aloe, giant
  hesperaloe, Texas sotol, Texas beargrass, whale's tongue agave.
- New choices: Spanish dagger 'Variegata' and Bright Star, beaked yucca 'Sapphire
  Skies', red yucca Brakelights and 'Yellow Sun', Parry's agave var. truncata and the
  New Mexico agave (subsp. *neomexicana*), whale's tongue 'Frosty Blue'.
- Ocotillo draws about 8 ft (h 72 to 96) for its 15 ft canes; it drew 6 ft.

Sources and every estimate are in `desert-sources.json`. `dev/desert-review.html`
shows every choice in four seasons and at true scale beside a 6 ft post
(`?nocards&zoom=3&only=key,key:cv`), sweeps the sprite edges (`?check`), and times a
bake (`?bench`).

## Left out, and why

- **Century plant** (*Agave americana*): huge and tender (zone 8+), and it may carry
  a European invasive caution that would need reading before it ships.
- **Prickly pear and cholla**: the commonest dry-garden look still missing, but a pad
  or a jointed stem is a new form, not a rosette.
- **Mexican grass tree** (*Dasylirion longissimum*): plants sold under the name are
  often *D. quadrangulatum*, which needs settling first.
