# Plant photos

A photograph here shows what a species looks like in a real garden. It appears
in the Plant Library **below** the four seasonal illustrations, which stay the
primary art — they show how a plant behaves across the year, which is what the
app is for and what a photograph cannot say. Most species will never have a
photo, and that is a normal state: the card renders exactly as it always has.

## Dropping a file here is no longer enough

The Library used to guess: it tried `photos/<key>.jpg`, then `.jpeg`, then
`.png`, and gave up quietly. That worked while a photo was just a picture, and
stopped working the moment a photo carried licence terms — a guessed file has no
creator, no source and no licence to show beside it.

A photograph is now **declared in `js/plants.js`** with its full credit, and a
file with no record is never displayed. See **`docs/plant-photos.md`** for the
checklist that has to be completed first, and:

```bash
node dev/commons-photo.js <plantKey> "File:Something.jpg"
```

which fetches the licensing metadata from Wikimedia Commons, refuses anything
off the allowlist, and prints the record to paste in.

## Rules

- **Name** the file after the plant key, e.g. `echinacea.jpg` — the list below
  is the naming reference. The record's `file` field is what actually resolves.
- **Format:** JPEG (`.jpg` preferred; `.jpeg`, `.png` and `.webp` also work).
  iPhones save HEIC by default and browsers can NOT show HEIC — set
  Settings -> Camera -> Formats -> **Most Compatible**, or convert on export.
- **Size:** keep them small (~1000px, under ~250 KB). Run
  `resize-photos.ps1` after dropping full-size photos in — it shrinks and
  recompresses every JPEG here in place.
- **Downscale and re-encode only. Never save a cropped version.** The Library
  frames the picture with `aspect-ratio` + `object-fit` in CSS at render time,
  so the stored file stays the licensor's own work. That is a licensing
  decision, not a layout one — `docs/plant-photos.md` explains why.
- **Strip EXIF**, including GPS. Home-garden coordinates are common in plant
  photography and redistributing them is a privacy harm we would be creating.
- **Add the file to `PRECACHE` in `sw.js`.** A test fails until you do: the app
  ships offline, and a credit is only complete offline if the picture is there
  too.
- **Sourcing:** your own photographs, or Wikimedia Commons under a licence on
  the allowlist in `js/photos.js` — CC0, public domain, CC BY, CC BY-SA. Prefer
  CC0 and CC BY where you have a choice. Never NonCommercial, never
  NoDerivatives, never GFDL, and never an image taken from a Wikipedia article
  rather than from Commons (Wikipedia hosts non-free files locally).

## Filenames (146 species)

### Grasses & Sedges

- `bluestem.jpg` — Little Bluestem (*Schizachyrium scoparium*)
- `bigbluestem.jpg` — Big Bluestem (*Andropogon gerardii*)
- `switchgrass.jpg` — Switchgrass (*Panicum virgatum*)
- `dropseed.jpg` — Prairie Dropseed (*Sporobolus heterolepis*)
- `indiangrass.jpg` — Indiangrass (*Sorghastrum nutans*)
- `sideoats.jpg` — Sideoats Grama (*Bouteloua curtipendula*)
- `karl.jpg` — Feather Reed Grass 'Karl Foerster' (*Calamagrostis × acutiflora*)
- `lovegrass.jpg` — Purple Lovegrass (*Eragrostis spectabilis*)
- `pinkmuhly.jpg` — Pink Muhly Grass (*Muhlenbergia capillaris*)
- `mexicanfeather.jpg` — Mexican Feather Grass (*Nassella tenuissima*)
- `tuftedhair.jpg` — Tufted Hairgrass (*Deschampsia cespitosa*)
- `miscanthus.jpg` — Miscanthus (*Miscanthus sinensis*)
- `fountaingrass.jpg` — Fountain Grass (*Cenchrus alopecuroides*)
- `orientalfountain.jpg` — Oriental Fountain Grass (*Cenchrus orientalis*)
- `bluefescue.jpg` — Blue Fescue (*Festuca glauca*)
- `hakone.jpg` — Japanese Forest Grass (*Hakonechloa macra*)
- `giantstipa.jpg` — Giant Feather Grass (*Stipa gigantea*)
- `sedge.jpg` — Plains Oval Sedge (*Carex brevior*)
- `foxsedge.jpg` — Fox Sedge (*Carex vulpinoidea*)
- `grayssedge.jpg` — Gray's Sedge (*Carex grayi*)
- `prairiesedge.jpg` — Prairie Sedge (*Carex prairea*)
- `broomsedgecarex.jpg` — Broom Sedge (*Carex scoparia*)
- `palmsedge.jpg` — Palm Sedge (*Carex muskingumensis*)
- `bromoides.jpg` — Brome-like Sedge (*Carex bromoides*)
- `plantainsedge.jpg` — Plantain-leaf Sedge (*Carex plantaginea*)
- `appalachiansedge.jpg` — Appalachian Sedge (*Carex appalachica*)
- `rosysedge.jpg` — Rosy Sedge (*Carex rosea*)
- `ivorysedge.jpg` — Ivory Sedge (*Carex eburnea*)
- `pennsedge.jpg` — Pennsylvania Sedge (*Carex pensylvanica*)

### Perennials

- `echinacea.jpg` — Purple Coneflower (*Echinacea purpurea*)
- `pallida.jpg` — Pale Purple Coneflower (*Echinacea pallida*)
- `topeka.jpg` — Topeka Coneflower (*Echinacea atrorubens*)
- `angustifolia.jpg` — Narrowleaf Coneflower (*Echinacea angustifolia*)
- `paradoxa.jpg` — Yellow Coneflower (*Echinacea paradoxa*)
- `rattlesnake.jpg` — Rattlesnake Master (*Eryngium yuccifolium*)
- `yucca.jpg` — Yucca (*Yucca glauca*)
- `monarda.jpg` — Wild Bergamot (*Monarda fistulosa*)
- `spottedbeebalm.jpg` — Spotted Bee Balm (*Monarda punctata*)
- `baptisia.jpg` — Baptisia family (*Baptisia australis* and the Cream Wild Indigo exact-species choice, *B. bracteata*)
- `mountainmint.jpg` — Mountain Mint (*Pycnanthemum muticum*)
- `amsonia.jpg` — Amsonia (*Amsonia hubrichtii*)
- `ozarkamsonia.jpg` — Ozark Amsonia (*Amsonia illustris*)
- `aster.jpg` — Aromatic Aster (*Symphyotrichum oblongifolium*)
- `newengland.jpg` — New England Aster (*Symphyotrichum novae-angliae*)
- `smoothaster.jpg` — Smooth Blue Aster (*Symphyotrichum laeve*)
- `culvers.jpg` — Culver's Root (*Veronicastrum virginicum*)
- `yarrow.jpg` — Common Yarrow (*Achillea millefolium*)
- `sedum.jpg` — Stonecrop 'Autumn Joy' (*Hylotelephium* (Herbstfreude Group) 'Herbstfreude')
- `phlox.jpg` — Garden Phlox 'Jeana' (*Phlox paniculata* 'Jeana')
- `joepye.jpg` — Joe Pye Weed 'Gateway' (*Eutrochium maculatum* 'Gateway')
- `stachys.jpg` — Betony 'Hummelo' (*Betonica officinalis* 'Hummelo')
- `penstemon.jpg` — Foxglove Beardtongue (*Penstemon digitalis*)
- `butterfly.jpg` — Butterfly Weed (*Asclepias tuberosa*)
- `liatris.jpg` — Dotted Blazing Star (*Liatris punctata*)
- `goldenrod.jpg` — Showy Goldenrod (*Solidago speciosa*)
- `meadowsage.jpg` — Meadow Sage (*Salvia nemorosa*) and its exact cultivar choices
- `echinops.jpg` — Blue Echinops (*Echinops ritro*)
- `calamint.jpg` — Lesser Calamint (*Calamintha nepeta subsp. nepeta*)
- `agastache.jpg` — Anise Hyssop (*Agastache foeniculum*)
- `catmint.jpg` — Catmint (*Nepeta x faassenii*)
- `scabiosa.jpg` — Scabiosa (*Scabiosa columbaria*)
- `helenium.jpg` — Sneezeweed (*Helenium autumnale*)
- `rudbeckia.jpg` — Black-eyed Susan (*Rudbeckia fulgida var. sullivantii*)
- `sanguisorba.jpg` — Canadian Burnet (*Sanguisorba canadensis*)
- `greatburnet.jpg` — Great Burnet (*Sanguisorba officinalis*)
- `lilacsquirrel.jpg` — Burnet 'Lilac Squirrel' (*Sanguisorba hakusanensis*)
- `coreopsis.jpg` — Threadleaf Coreopsis (*Coreopsis verticillata*)
- `lanceleaf.jpg` — Lanceleaf Coreopsis (*Coreopsis lanceolata*)
- `talltickseed.jpg` — Tall Tickseed (*Coreopsis tripteris*)
- `willowsunflower.jpg` — Willowleaf Sunflower (*Helianthus salicifolius*)
- `hosta.jpg` — Hosta (*Hosta hybrida*)
- `ostrichfern.jpg` — Ostrich Fern (*Matteuccia struthiopteris*)
- `ladyfern.jpg` — Lady Fern (*Athyrium filix-femina*)
- `christmasfern.jpg` — Christmas Fern (*Polystichum acrostichoides*)
- `columbine.jpg` — Wild Columbine (*Aquilegia canadensis*)
- `woodlandphlox.jpg` — Woodland Phlox (*Phlox divaricata*)
- `wildgeranium.jpg` — Wild Geranium (*Geranium maculatum*)
- `solomonsseal.jpg` — Solomon's Seal (*Polygonatum biflorum*)
- `bluebells.jpg` — Virginia Bluebells (*Mertensia virginica*)
- `heuchera.jpg` — Heuchera (*Heuchera americana*)
- `astilbe.jpg` — Astilbe (*Astilbe chinensis*)

### Bulbs

- `allium.jpg` — Ornamental Onion 'Millenium' (*Allium 'Millenium'*)
- `crocus.jpg` — Snow Crocus (*Crocus tommasinianus*)
- `daffodil.jpg` — Daffodil (*Narcissus pseudonarcissus*)
- `muscari.jpg` — Grape Hyacinth (*Muscari armeniacum*)
- `tulip.jpg` — Species Tulip (*Tulipa clusiana*)
- `camassia.jpg` — Wild Hyacinth (*Camassia scilloides*)
- `claudeshride.jpg` — Martagon Lily 'Claude Shride' (*Lilium martagon*)
- `scillaperuviana.jpg` — Scilla peruviana (*Scilla peruviana*)
- `puschkinia.jpg` — Puschkinia (*Puschkinia scilloides var. libanotica*)
- `snowdrop.jpg` — Snowdrop (*Galanthus nivalis*)
- `noddingonion.jpg` — Nodding Onion (*Allium cernuum*)
- `prairieonion.jpg` — Prairie Onion (*Allium stellatum*)
- `alliumPinkJewel.jpg` — Allium 'Pink Jewel' (*Allium 'Pink Jewel'*)
- `alliumAtropurpureum.jpg` — Allium atropurpureum (*Allium atropurpureum*)
- `alliumChristophii.jpg` — Allium christophii (*Allium cristophii*)
- `alliumRedMohican.jpg` — Allium 'Red Mohican' (*Allium 'Red Mohican'*)

### Shrubs

- `leadplant.jpg` — Leadplant (*Amorpha canescens*)
- `sumac.jpg` — Fragrant Sumac (*Rhus aromatica*)
- `newjersey.jpg` — New Jersey Tea (*Ceanothus americanus*)
- `coralberry.jpg` — Coralberry (*Symphoricarpos orbiculatus*)
- `boxwoodround.jpg` — Boxwood (*Buxus sempervirens / hybrids*)
- `boxwoodsquare.jpg` — Boxwood (*Buxus sempervirens / hybrids*)
- `boxwoodcone.jpg` — Boxwood (*Buxus sempervirens / hybrids*)
- `boxwoodcolumn.jpg` — Boxwood (*Buxus sempervirens / hybrids*)
- `boxwoodlow.jpg` — Boxwood (*Buxus sempervirens / hybrids*)
- `yewlow.jpg` — Yew (*Taxus x media*)
- `yewmedium.jpg` — Yew (*Taxus x media*)
- `yewtall.jpg` — Yew (*Taxus x media*)
- `smokebush.jpg` — Smokebush (*Cotinus coggygria*)
- `hydrangea.jpg` — Bigleaf Hydrangea (*Hydrangea macrophylla*)
- `smoothhydrangea.jpg` — Smooth Hydrangea (*Hydrangea arborescens*)
- `bigleaflace.jpg` — Bigleaf Lacecap (*Hydrangea macrophylla*)
- `smoothlace.jpg` — Smooth Lacecap (*Hydrangea arborescens*)
- `serratahydrangea.jpg` — Mountain Hydrangea (*Hydrangea serrata*)
- `panniclehydrangea.jpg` — Panicle Hydrangea (*Hydrangea paniculata*)
- `oakleafhydrangea.jpg` — Oakleaf Hydrangea (*Hydrangea quercifolia*)

### Trees

- `smoketree.jpg` — American Smoketree (*Cotinus obovatus*)
- `serviceberry.jpg` — Serviceberry (*Amelanchier laevis*)
- `japanesemaple.jpg` — Japanese Maple (*Acer palmatum*)
- `whiteoak.jpg` — White Oak (*Quercus alba*)
- `redoak.jpg` — Northern Red Oak (*Quercus rubra*)
- `swampwhiteoak.jpg` — Swamp White Oak (*Quercus bicolor*)
- `chinkapinoak.jpg` — Chinkapin Oak (*Quercus muehlenbergii*)
- `redmaple.jpg` — Red Maple (*Acer rubrum*)
- `sugarmaple.jpg` — Sugar Maple (*Acer saccharum*)
- `silvermaple.jpg` — Silver Maple (*Acer saccharinum*)
- `freemanmaple.jpg` — Freeman Maple (*Acer x freemanii*)
- `blackgum.jpg` — Black Gum (*Nyssa sylvatica*)
- `sweetgum.jpg` — Sweet Gum (*Liquidambar styraciflua*)
- `hackberry.jpg` — Hackberry (*Celtis occidentalis*)
- `coffeetree.jpg` — Kentucky Coffeetree (*Gymnocladus dioicus*)
- `honeylocust.jpg` — Honey Locust (*Gleditsia triacanthos*)
- `floweringcherry.jpg` — Flowering Cherry (*Prunus serrulata*)
- `riverbirch.jpg` — River Birch (*Betula nigra*)
- `riverbirchmulti.jpg` — River Birch (*Betula nigra*)
- `paperbirch.jpg` — Paper Birch (*Betula papyrifera*)
- `americanelm.jpg` — American Elm (*Ulmus americana*)
- `baldcypress.jpg` — Bald Cypress (*Taxodium distichum*)
- `ginkgo.jpg` — Ginkgo (*Ginkgo biloba*)
- `buroak.jpg` — Bur Oak (*Quercus macrocarpa*)
- `redbud.jpg` — Eastern Redbud (*Cercis canadensis*)
- `cottonwood.jpg` — Eastern Cottonwood (*Populus deltoides*)
- `redcedar.jpg` — Eastern Red Cedar (*Juniperus virginiana*)
