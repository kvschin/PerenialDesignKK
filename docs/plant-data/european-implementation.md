# European garden additions — 0.8.58

Adds the agreed 14 choices: ten base records and four nested cultivars. The
catalog now contains 545 base records and 381 nested choices. This is a
European garden-use expansion, not a claim that every addition is native to
Europe. Existing saves retain their keys.

## Botanical references and catalog placement

| Reference | App reference | Authoring decision |
| --- | --- | --- |
| [Cirsium rivulare 'Atropurpureum'](https://www.rhs.org.uk/plants/89285/cirsium-rivulare-atropurpureum/details) | `cirsiumatropurpureum` | European selection; tall wine-red thistle punctuation for moist sun. |
| [Baltic parsley](https://www.rhs.org.uk/plants/42450/cenolophium-denudatum/details) | `cenolophium` | Cenolophium fischeri; C. denudatum remains searchable. Europe and Asia. |
| [Aster × frikartii 'Mönch'](https://www.rhs.org.uk/plants/93410/aster-%C3%97-frikartii-m%C3%B6nch/details) | `frikartaster` | Garden hybrid in the Aster group; ASCII Monch alias. |
| [Helenium 'Sahin's Early Flowerer'](https://www.rhs.org.uk/plants/126137/helenium-sahins-early-flowerer/details) | `helenium.cv.sahinsearlyflowerer` | Explicit hybrid Latin/provenance and no asserted wild range; July–October window. |
| [Sanguisorba officinalis 'Tanna'](https://www.rhs.org.uk/plants/76164/sanguisorba-officinalis-tanna/details) | `greatburnet.cv.tanna` | Compact species selection in the existing Burnet group. |
| [Veronicastrum virginicum 'Fascination'](https://www.rhs.org.uk/plants/109381/veronicastrum-virginicum-fascination/details) | `culvers.cv.fascination` | Violet candelabras; retains North American species origin. |
| [Astrantia 'Roma'](https://www.rhs.org.uk/plants/180785/astrantia-roma/details) | `astrantiaroma` | Hybrid sibling of A. major in a Masterwort group. |
| [Kalimeris incisa 'Blue Star'](https://www.rhs.org.uk/plants/105290/kalimeris-incisa-blue-star/details) | `kalimerisbluestar` | Asian selection; small blue daisy filler in the Aster group. |
| [Carex oshimensis 'Evergold'](https://www.rhs.org.uk/plants/45191/carex-oshimensis-evergold-v/details) | `evergoldsedge` | Asian evergreen selection; gold central stripe on green arching leaves. Inconspicuous flowers are omitted from its display calendar. |
| [Deschampsia cespitosa 'Goldtau'](https://www.rhs.org.uk/plants/114437/deschampsia-cespitosa-goldtau/details) | `tuftedhair.cv.goldtau` | Compact gold panicles; inherits species origin and June–July calendar. |
| [Calamagrostis × acutiflora 'Overdam'](https://www.rhs.org.uk/plants/93664/calamagrostis-acutiflora-overdam-%28v%29/details) | `overdam` | Exact hybrid-cultivar sibling beside Karl Foerster; green center on cream blade margins. |
| [Calamagrostis brachytricha](https://www.rhs.org.uk/plants/129801/calamagrostis-brachytricha/details) | `koreanfeatherreed` | Asian species; arching foliage and late pink-silver plumes. |
| [Sesleria caerulea](https://www.rhs.org.uk/plants/74599/sesleria-caerulea/details) | `bluemoorgrass` | European evergreen blue matrix with spring heads; grouped beside autumn moor grass. |
| [Luzula nivea](https://www.rhs.org.uk/plants/10577/luzula-nivea/details) | `snowywoodrush` | European evergreen woodrush. The app's Sedge category includes this grass-like woodland matrix; the name and blurb identify it as a woodrush. |

Dimensions represent a typical mature garden plant including flowering stems;
spacing and spread remain inches. USDA zones are garden screening ranges,
not conversions of RHS hardiness classes. Bloom months are broad temperate
garden windows and vary with local conditions. Helenium's orange/copper
variation is approximated by seasonal ray colors rather than per-petal
bicoloring.

## Rendering and references

Existing forms supply the architecture. Two shared opt-in additions supply
the missing detail: a tapered central stripe following the blade curve, and
a thistle involucre under a vertically proportioned pincushion head. Neither
adds a species-key branch or consumes additional random values. Snowy woodrush
uses the existing openPanicle mound seed grammar. Evergreen plants keep their
foliage; deciduous flowering plants carry dried stems and heads.

The ten Wikipedia titles were resolved through `dev/wikipedia-links.js` using
only new records. Returned redirects include Calamagrostis brachytricha →
Calamagrostis arundinacea, Kalimeris incisa → Aster incisus, and Cenolophium
fischeri → Cenolophium. Roma uses the genus article. These are reference-page
targets, independent of the catalog's display names.

## Verification

Catalog tests cover exact choices, provenance, source-name search aliases,
grouping, and the earlier Helenium window. Renderer tests cover the optional
stripe pass. `dev/european-review.html` displays all 14 choices in four seasons
in ART2 and classic modes and checks sprite edges across three seeds.

Completed validation: 483 tests passed; JavaScript syntax and diff whitespace
checks passed; 168 sprite checks per renderer mode found no painted edges.
Four-season screenshots were inspected in both modes. Read-only QA found no
actionable regressions.
