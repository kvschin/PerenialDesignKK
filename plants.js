/* =====================================================
   HORTUS PERENNIS — species data
   =====================================================
   Each entry is the contract the rest of the game renders and plans
   against. drawPlant() uses: form, h, sea, stem. The planner features
   use: type, space, spread, zones, native, eco, sun, moist.

   form    one of: bunchgrass | vertgrass | turkeyfoot | cloudgrass |
           oatgrass | cone | globe | spike | shrub (herbaceous mound) |
           fern | leafmound (hosta) | bush (woody shrub) |
           tree (deciduous) | conifer
   type    grass | sedge | forb | shrub | tree — drives the tray categories
   grow    woody only: years to mature size (establishment horizon —
           perennials use 10 growing days; a bur oak uses 10 years).
           Woody plants skip the spring cutback; they are structure.
   cw      woody only: mature canopy/twig width in px for the renderer
           (real-world spread stays in `spread`; trees shade a radius of
           spread/TILE_IN/2 tiles as they establish, and only sun:'part'
           plants can be planted in that shade)
   h       mature height in px (drives the renderer, not real units)
   space   on-center planting distance in inches (what you'd order/space by)
   spread  mature clump width in inches (info card / export notes)
   zones   [min,max] USDA hardiness range
   native  true if the straight species is native to the central US;
           false for cultivars/hybrids of garden (non-native) origin
   eco     EPA Level III ecoregions where the species is naturally at home;
           empty for non-natives (the natives-only filter is how you hide them)
   sun     full | part — primary light preference
   moist   dry | medium | moist — primary soil preference
   phen    cool | mid | warm — when it wakes in spring and peaks:
           cool-season plants (sedges, Calamagrostis, the spring
           bloomers) emerge first; warm-season prairie grasses and
           late risers like butterfly weed wait for real heat
   stem    optional stem color override (salvia's near-black stems)
   cv      optional named cultivars: { key:{ name:"'Cultivar'", note,
           ...overrides } }. Overrides merge over the straight species —
           h, stem, and per-season sea keys. Cultivar names are facts
           (nominative use; names aren't copyrightable) — plant patents
           restrict propagation, not depiction. Avoid trademarked TRADE
           names as branding; the cultivar name in quotes is safe.
   group   optional family handle ('coneflower'): species sharing it
           collapse into one tray button, and the chip row picks the
           species (each stays a full entry — own latin, zones, eco)
   chip    short label for this species' chip inside its group
   look    optional tweaks for the cone form, how the flower carries
           itself: rays (count), rayLen, rayW, droop (how hard the
           rays fall), stems, leaves, leafW, leafLen — leafy purpurea
           vs wispy pallida vs hard-reflexed atrorubens
   sea     per-season appearance, the Oudolf heart of the game:
           fol (foliage), bloom (flower this season, omit for none),
           seed (persistent seedhead/structure — fall/winter presence is
           the whole point), eye (cone center, coneflowers only)

   Accuracy matters more than prettiness — Kevin grows these.
*/
'use strict';

const PLANTS = {
  /* ---------- grasses & sedges: the matrix ---------- */
  bluestem:{ name:'Little Bluestem', latin:'Schizachyrium scoparium', form:'bunchgrass', type:'grass', h:46,
    space:18, spread:18, zones:[3,9], native:true, sun:'full', moist:'dry', phen:'warm',
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Blue-green all summer, then the best copper in the prairie. Backlit in November it glows.',
    sea:{Spring:{fol:'#7fa07a'}, Summer:{fol:'#6e8f9b'}, Fall:{fol:'#c0623b',seed:'#efe6d3'}, Winter:{fol:'#a35a35',seed:'#f3ecdd'}},
    cv:{
      standingovation:{name:"'Standing Ovation'", note:'stiffly upright on blue legs, wine-red fall',
        sea:{Summer:{fol:'#5d7a9b'}, Fall:{fol:'#8a4a52',seed:'#efe6d3'}, Winter:{fol:'#7a4a48',seed:'#f3ecdd'}}},
      theblues:{name:"'The Blues'", note:'powder-blue stems all season',
        sea:{Summer:{fol:'#7d93b8'}, Fall:{fol:'#b06a4a',seed:'#efe6d3'}}},
    }},
  bigbluestem:{ name:'Big Bluestem', latin:'Andropogon gerardii', form:'turkeyfoot', type:'grass', h:78,
    space:24, spread:30, zones:[3,9], native:true, sun:'full', moist:'medium', phen:'warm',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains',
         'Western Corn Belt Plains','Southwestern Tablelands'],
    blurb:'King of the tallgrass — turkey-foot seedheads at eye level by September. The Flint Hills are made of it.',
    sea:{Spring:{fol:'#7d9a6e'}, Summer:{fol:'#6e8a8a'}, Fall:{fol:'#a8584a',seed:'#c9b08a'}, Winter:{fol:'#8a5040',seed:'#d6c4a4'}},
    cv:{
      blackhawks:{name:"'Blackhawks'", note:'foliage darkens to near-black purple',
        sea:{Summer:{fol:'#5e5468'}, Fall:{fol:'#4a3a4e',seed:'#c9b9a0'}, Winter:{fol:'#3f3442',seed:'#cdbfa8'}}},
    }},
  switchgrass:{ name:'Switchgrass', latin:'Panicum virgatum', form:'cloudgrass', type:'grass', h:66,
    space:24, spread:30, zones:[3,9], native:true, sun:'full', moist:'medium', phen:'warm',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains',
         'Western Corn Belt Plains','Southwestern Tablelands'],
    blurb:'A sturdy clump under an airy cloud of seed. Birds work it all winter.',
    sea:{Spring:{fol:'#7d9a5f'}, Summer:{fol:'#6f8f5a',bloom:'#d8b8c2'}, Fall:{fol:'#d9b85e',seed:'#e0cfae'}, Winter:{fol:'#c2a878',seed:'#e6d8ba'}},
    cv:{
      northwind:{name:"'Northwind'", note:'steel-blue, a strict vertical column',
        sea:{Summer:{fol:'#6e8f9b'}, Fall:{fol:'#d9b86a',seed:'#e8d9b0'}}},
      shenandoah:{name:"'Shenandoah'", note:'leaves flushed wine-red by July',
        sea:{Summer:{fol:'#8a6a62'}, Fall:{fol:'#a04438',seed:'#d8b8a0'}}},
    }},
  dropseed:{ name:'Prairie Dropseed', latin:'Sporobolus heterolepis', form:'bunchgrass', type:'grass', h:34,
    space:18, spread:24, zones:[3,9], native:true, sun:'full', moist:'medium', phen:'warm',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'A fine-textured fountain that smells faintly of popcorn in bloom. Turns pumpkin-gold in fall.',
    sea:{Spring:{fol:'#7d9a5f'}, Summer:{fol:'#6f8f5a',seed:'#d8c9a8'}, Fall:{fol:'#d99a4e'}, Winter:{fol:'#c2a06a'}}},
  indiangrass:{ name:'Indiangrass', latin:'Sorghastrum nutans', form:'vertgrass', type:'grass', h:70,
    space:24, spread:24, zones:[4,9], native:true, sun:'full', moist:'medium', phen:'warm',
    eco:['Flint Hills','Central Great Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'The tallgrass skyline. Bronze plumes in September; Kansas and Oklahoma both claim it as state grass.',
    sea:{Spring:{fol:'#7d9a6e'}, Summer:{fol:'#6f8f7a'}, Fall:{fol:'#c98a4a',seed:'#d9b87a'}, Winter:{fol:'#b08a5e',seed:'#e0cfa8'}}},
  sideoats:{ name:'Sideoats Grama', latin:'Bouteloua curtipendula', form:'oatgrass', type:'grass', h:30,
    space:15, spread:18, zones:[3,9], native:true, sun:'full', moist:'dry', phen:'warm',
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Oat sprays hung neatly along one side of the stem. Purple-tinged in bloom, polite everywhere.',
    sea:{Spring:{fol:'#7d9a5f'}, Summer:{fol:'#7a9a6a',seed:'#b8a88a'}, Fall:{fol:'#c2925a',seed:'#d9c4a0'}, Winter:{fol:'#b09a78',seed:'#cdbb95'}}},
  karl:{ name:"Feather Reed Grass 'Karl Foerster'", latin:'Calamagrostis × acutiflora', form:'vertgrass', type:'grass', h:62,
    space:24, spread:24, zones:[4,9], native:false, sun:'full', moist:'medium', phen:'cool', eco:[],
    blurb:'The exclamation point. Vertical wheat-colored plumes by June that stand straight through snow.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#7d9a5f',seed:'#d9c08a'}, Fall:{fol:'#b89a5e',seed:'#d9c08a'}, Winter:{fol:'#b09a6e',seed:'#e0d2ae'}}},
  sedge:{ name:'Plains Oval Sedge', latin:'Carex brevior', form:'bunchgrass', type:'sedge', h:22,
    space:12, spread:15, zones:[3,8], native:true, sun:'part', moist:'medium', phen:'cool',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'A tidy cool-season tuft for bed edges and part shade. Green early, seed heads by June.',
    sea:{Spring:{fol:'#6f9a5a',seed:'#c2b48a'}, Summer:{fol:'#5d8a4c'}, Fall:{fol:'#9a8a5e'}, Winter:{fol:'#a89a78'}}},

  /* ---------- forbs: the flowering layer ---------- */
  echinacea:{ name:'Purple Coneflower', latin:'Echinacea purpurea', form:'cone', type:'forb', h:48,
    group:'coneflower', chip:'Purple',
    space:18, spread:18, zones:[3,8], native:true, sun:'full', moist:'medium', phen:'mid',
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    look:{leaves:10, leafW:2.3, leafLen:0.38, stems:6, rays:8, rayLen:6, droop:2.5, rayW:2.4},
    blurb:'Pink petals around an orange cone in July; black seedheads that feed goldfinches all winter. The leafiest of the tribe.',
    sea:{Spring:{fol:'#5d7a4c'}, Summer:{fol:'#5d7a4c',bloom:'#c76b8e',eye:'#b5651d'}, Fall:{fol:'#6b6248',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}},
    cv:{
      magnus:{name:"'Magnus'", note:'flat, deep-rose rays held wide',
        look:{leaves:10, leafW:2.3, leafLen:0.38, stems:6, rays:8, rayLen:6.5, droop:1, rayW:2.4},
        sea:{Summer:{fol:'#5d7a4c',bloom:'#b84a78',eye:'#a05518'}}},
      whiteswan:{name:"'White Swan'", note:'white rays around a green-gold cone',
        sea:{Summer:{fol:'#5d7a4c',bloom:'#f0ead8',eye:'#b58a2e'}}},
    }},
  pallida:{ name:'Pale Purple Coneflower', latin:'Echinacea pallida', form:'cone', type:'forb', h:52,
    group:'coneflower', chip:'Pale Purple',
    space:18, spread:18, zones:[4,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    look:{leaves:5, leafW:1.2, leafLen:0.3, stems:4, rays:7, rayLen:8.5, droop:6, rayW:1.3},
    blurb:'Long pale ribbons drooping from the cone on wiry, near-naked stems, weeks before purpurea. The prairie original.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#d8a0b8',eye:'#8a5a3a'}, Fall:{fol:'#8a7a55',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}}},
  topeka:{ name:'Topeka Coneflower', latin:'Echinacea atrorubens', form:'cone', type:'forb', h:44,
    group:'coneflower', chip:'Topeka',
    space:15, spread:12, zones:[5,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains'],
    look:{leaves:4, leafW:1.4, leafLen:0.28, stems:4, rays:6, rayLen:5.5, droop:7, rayW:1.6},
    blurb:'The Flint Hills coneflower — deep wine rays swept back hard against the stem. Rare in the trade; grow it if you find it.',
    sea:{Spring:{fol:'#5d7a4c'}, Summer:{fol:'#5d7a4c',bloom:'#a84a5e',eye:'#5e3a2a'}, Fall:{fol:'#7a6a4a',seed:'#352820'}, Winter:{fol:'#6b5d4a',seed:'#201812'}}},
  angustifolia:{ name:'Narrowleaf Coneflower', latin:'Echinacea angustifolia', form:'cone', type:'forb', h:30,
    group:'coneflower', chip:'Narrowleaf',
    space:12, spread:12, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['High Plains','Central Great Plains','Flint Hills','Southwestern Tablelands'],
    look:{leaves:6, leafW:1.3, leafLen:0.3, stems:4, rays:8, rayLen:5, droop:3, rayW:1.7},
    blurb:'The shortgrass echinacea — pink stars close to the ground on a taproot. The one the Plains tribes used for everything.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#c08aaa',eye:'#7a4a2e'}, Fall:{fol:'#8a7a55',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}}},
  paradoxa:{ name:'Yellow Coneflower', latin:'Echinacea paradoxa', form:'cone', type:'forb', h:42,
    group:'coneflower', chip:'Yellow',
    space:18, spread:15, zones:[4,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Ozark Highlands'],
    look:{leaves:5, leafW:1.4, leafLen:0.32, stems:5, rays:7, rayLen:8, droop:6.5, rayW:1.7},
    blurb:'The paradox: an echinacea in clear yellow, rays falling like a shuttlecock. Ozark glades only, but happy in any dry garden.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#e8c23a',eye:'#5e4a2a'}, Fall:{fol:'#8a7a55',seed:'#3a3024'}, Winter:{fol:'#6b5d4a',seed:'#2a241c'}}},
  rattlesnake:{ name:'Rattlesnake Master', latin:'Eryngium yuccifolium', form:'globe', type:'forb', h:52,
    space:18, spread:24, zones:[3,8], native:true, sun:'full', moist:'medium', phen:'mid',
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Silver yucca-like leaves and pale spiky globes. Architectural in every season.',
    sea:{Spring:{fol:'#8fa8a0'}, Summer:{fol:'#8fa8a0',bloom:'#dfe8dd'}, Fall:{fol:'#9a9a86',seed:'#8a7a5e'}, Winter:{fol:'#8d8674',seed:'#6e5f48'}}},
  monarda:{ name:'Wild Bergamot', latin:'Monarda fistulosa', form:'globe', type:'forb', h:44,
    space:24, spread:30, zones:[3,9], native:true, sun:'full', moist:'medium', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Shaggy lavender mopheads in July, bee balm of the old prairie. Give it elbow room.',
    sea:{Spring:{fol:'#6f8f6e'}, Summer:{fol:'#6f8f6e',bloom:'#b88ac8'}, Fall:{fol:'#8a7a5a',seed:'#5e4a3a'}, Winter:{fol:'#7d7666',seed:'#4a3c30'}}},
  allium:{ name:"Ornamental Onion 'Millenium'", latin:'Allium', form:'globe', type:'forb', h:36,
    space:12, spread:12, zones:[4,8], native:false, sun:'full', moist:'medium', phen:'mid', eco:[],
    blurb:'Rosy-purple drumsticks in high summer, mobbed by pollinators. Tan globes persist after frost.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#b06a9e'}, Fall:{fol:'#9a8a5e',seed:'#c2ad85'}, Winter:{fol:'#9a8f78',seed:'#cdbb95'}}},
  baptisia:{ name:'Blue False Indigo', latin:'Baptisia australis', form:'shrub', type:'forb', h:50,
    space:36, spread:42, zones:[3,9], native:true, sun:'full', moist:'medium', phen:'cool',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains'],
    blurb:'Indigo spikes in spring on a shrub-like clump; charcoal seed pods that rattle in winter wind.',
    sea:{Spring:{fol:'#6f8f6e',bloom:'#4a5d9e'}, Summer:{fol:'#5d7a5c'}, Fall:{fol:'#6e6a55',seed:'#2c2620'}, Winter:{fol:'#5e574a',seed:'#1d1814'}}},
  creamindigo:{ name:'Cream Wild Indigo', latin:'Baptisia bracteata', form:'shrub', type:'forb', h:30,
    space:30, spread:36, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'cool',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains'],
    blurb:'Cream pea-flowers low to the ground in April, before the grasses wake. Slow but permanent.',
    sea:{Spring:{fol:'#7d9a6e',bloom:'#e8e0b8'}, Summer:{fol:'#6f8f6e'}, Fall:{fol:'#6e6a55',seed:'#2c2620'}, Winter:{fol:'#5e574a',seed:'#1d1814'}}},
  mountainmint:{ name:'Mountain Mint', latin:'Pycnanthemum muticum', form:'shrub', type:'forb', h:40,
    space:24, spread:30, zones:[4,8], native:true, sun:'full', moist:'medium', phen:'mid',
    eco:['Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Silver-dusted bracts that look frosted in July. The single best pollinator plant in the bed.',
    sea:{Spring:{fol:'#7d9a6e'}, Summer:{fol:'#8fa89a',bloom:'#e8e8e0'}, Fall:{fol:'#8a8a70',seed:'#4e463a'}, Winter:{fol:'#7d7666',seed:'#3a342c'}}},
  amsonia:{ name:'Bluestar', latin:'Amsonia hubrichtii', form:'shrub', type:'forb', h:44,
    space:36, spread:36, zones:[5,8], native:true, sun:'full', moist:'medium', phen:'cool',
    eco:['Ouachita Mountains','Arkansas Valley'],
    blurb:'Steel-blue stars in spring, ferny green all summer, then pure molten gold in October.',
    sea:{Spring:{fol:'#7d9a6e',bloom:'#7d93c8'}, Summer:{fol:'#6f8f5a'}, Fall:{fol:'#e8b84a'}, Winter:{fol:'#b09a6e'}}},
  aster:{ name:'Aromatic Aster', latin:'Symphyotrichum oblongifolium', form:'shrub', type:'forb', h:32,
    space:24, spread:30, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Low violet-blue dome in October when everything else has quit. Smells of balsam when brushed.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#5d7a4c'}, Fall:{fol:'#5d7a4c',bloom:'#8a6ab8'}, Winter:{fol:'#7a7060',seed:'#b8a88a'}}},
  butterfly:{ name:'Butterfly Weed', latin:'Asclepias tuberosa', form:'shrub', type:'forb', h:26,
    space:18, spread:18, zones:[3,9], native:true, sun:'full', moist:'dry', phen:'warm',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Screaming-orange umbels on a tough taproot. Monarchs raise their young on it.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#5d8a4c',bloom:'#e07a2e'}, Fall:{fol:'#9a8a5e',seed:'#9a8a6e'}, Winter:{fol:'#8a7a60',seed:'#6e5f48'}}},
  liatris:{ name:'Dotted Blazing Star', latin:'Liatris punctata', form:'spike', type:'forb', h:32,
    space:12, spread:12, zones:[3,9], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands'],
    blurb:'Purple bottlebrush spikes from a taproot that laughs at drought. Shortgrass royalty.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a'}, Fall:{fol:'#8a8a5e',bloom:'#9a5aae'}, Winter:{fol:'#9a8a6e',seed:'#c2b49a'}}},
  goldenrod:{ name:'Showy Goldenrod', latin:'Solidago speciosa', form:'spike', type:'forb', h:50,
    space:18, spread:18, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Dense golden wands in September. Blamed for hay fever it does not cause.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#5d8a4c'}, Fall:{fol:'#7a8a55',bloom:'#e8c23a'}, Winter:{fol:'#8a7a60',seed:'#b8a888'}}},
  salvia:{ name:"Meadow Sage 'Caradonna'", latin:'Salvia nemorosa', form:'spike', type:'forb', h:38,
    space:18, spread:15, zones:[4,8], native:false, sun:'full', moist:'dry', phen:'cool', eco:[], stem:'#3a3038',
    blurb:'Near-black stems with violet spikes in waves from May. Cut nothing; the dark stems hold.',
    sea:{Spring:{fol:'#5d7a4c',bloom:'#5a3a8e'}, Summer:{fol:'#5d7a4c',bloom:'#6a4a9e'}, Fall:{fol:'#6b6248',seed:'#3a3030'}, Winter:{fol:'#5e574a',seed:'#2c2624'}}},

  /* ---------- shade perennials: under the canopy ---------- */
  hosta:{ name:'Hosta', latin:'Hosta hybrida', form:'leafmound', type:'forb', h:30,
    space:30, spread:36, zones:[3,9], native:false, sun:'part', moist:'medium', phen:'mid', eco:[],
    blurb:'The shade workhorse — broad ribbed leaves in a tidy mound, lavender scapes in July. Deer agree.',
    sea:{Spring:{fol:'#7a9a6a'}, Summer:{fol:'#6f8f5a',bloom:'#b8a8d8'}, Fall:{fol:'#c9b86a'}, Winter:{}},
    cv:{
      blueangel:{name:"'Blue Angel'", note:'huge blue-gray leaves',
        sea:{Spring:{fol:'#7e95a0'}, Summer:{fol:'#7a93a0',bloom:'#cfc8e8'}, Fall:{fol:'#b8ad7a'}, Winter:{}}},
      sumsubstance:{name:"'Sum and Substance'", note:'chartreuse, the brighter the shade the better',
        sea:{Spring:{fol:'#aac25a'}, Summer:{fol:'#a8c25a',bloom:'#cabfe0'}, Fall:{fol:'#c9b85a'}, Winter:{}}},
    }},
  ostrichfern:{ name:'Ostrich Fern', latin:'Matteuccia struthiopteris', form:'fern', type:'forb', h:55,
    space:36, spread:48, zones:[3,7], native:true, sun:'part', moist:'moist', phen:'cool',
    eco:['Western Corn Belt Plains'],
    blurb:'Vase of plumes shoulder-high in a damp corner; stiff fertile fronds stand all winter. Fiddleheads in April.',
    sea:{Spring:{fol:'#7aa55a'}, Summer:{fol:'#5d8a4c'}, Fall:{fol:'#a8893f',seed:'#6e4a32'}, Winter:{seed:'#6e4a32'}}},
  ladyfern:{ name:'Lady Fern', latin:'Athyrium filix-femina', form:'fern', type:'forb', h:36,
    space:24, spread:30, zones:[3,8], native:true, sun:'part', moist:'moist', phen:'cool',
    eco:['Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Lacy, fresh-green, and forgiving — the fern for the north side of anything.',
    sea:{Spring:{fol:'#8ab06a'}, Summer:{fol:'#6f9a55'}, Fall:{fol:'#b09a55'}, Winter:{}}},
  christmasfern:{ name:'Christmas Fern', latin:'Polystichum acrostichoides', form:'fern', type:'forb', h:30,
    space:24, spread:24, zones:[3,9], native:true, sun:'part', moist:'medium', phen:'cool',
    eco:['Ozark Highlands','Central Irregular Plains'],
    blurb:'Leathery fronds still green at Christmas, hence the name. Dry shade once settled.',
    sea:{Spring:{fol:'#5d8a52'}, Summer:{fol:'#4e7a48'}, Fall:{fol:'#4e7a48'}, Winter:{fol:'#3f5e42'}}},
  pennsedge:{ name:'Pennsylvania Sedge', latin:'Carex pensylvanica', form:'bunchgrass', type:'sedge', h:18,
    space:12, spread:15, zones:[3,8], native:true, sun:'part', moist:'dry', phen:'cool',
    eco:['Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'A soft no-mow lawn for dry shade — ankle-high swirls under the oaks.',
    sea:{Spring:{fol:'#7aa55a',seed:'#c2b48a'}, Summer:{fol:'#6f9a55'}, Fall:{fol:'#a8945e'}, Winter:{fol:'#a89a78'}}},
  columbine:{ name:'Wild Columbine', latin:'Aquilegia canadensis', form:'globe', type:'forb', h:32,
    space:12, spread:15, zones:[3,8], native:true, sun:'part', moist:'medium', phen:'cool',
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Red-and-yellow lanterns nodding over lacy leaves in April, made for returning hummingbirds.',
    sea:{Spring:{fol:'#6f8f6e',bloom:'#c8503a'}, Summer:{fol:'#7a936a'}, Fall:{fol:'#9a8a5e',seed:'#5e5244'}, Winter:{seed:'#4a4238'}}},

  /* ---------- woody shrubs ---------- */
  leadplant:{ name:'Leadplant', latin:'Amorpha canescens', form:'bush', type:'shrub', h:36, cw:44,
    space:36, spread:36, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'mid', grow:3,
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:"Silver leaflets and violet spikes on a shrub the bison couldn't kill. Roots go sixteen feet down.",
    sea:{Spring:{fol:'#8a9a8a'}, Summer:{fol:'#7d8f7d',bloom:'#6a4a9e'}, Fall:{fol:'#8a8a70'}, Winter:{seed:'#3a342c'}}},
  sumac:{ name:'Fragrant Sumac', latin:'Rhus aromatica', form:'bush', type:'shrub', h:42, cw:78,
    space:72, spread:96, zones:[3,9], native:true, sun:'full', moist:'dry', phen:'mid', grow:4,
    eco:['Flint Hills','Central Great Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Glossy three-part leaves, knee to chest high, and the best scarlet fall on the dry side of the yard.',
    sea:{Spring:{fol:'#7d9a5f',bloom:'#e8d97a'}, Summer:{fol:'#5d7a4c'}, Fall:{fol:'#c0523a'}, Winter:{seed:'#a8504a'}},
    cv:{
      growlow:{name:"'Gro-Low'", note:'knee-high and twice as wide — living mulch', h:24, cw:90,
        sea:{Spring:{fol:'#7d9a5f',bloom:'#e8d97a'}, Summer:{fol:'#5d7a4c'}, Fall:{fol:'#c0523a'}, Winter:{seed:'#a8504a'}}},
    }},
  newjersey:{ name:'New Jersey Tea', latin:'Ceanothus americanus', form:'bush', type:'shrub', h:30, cw:48,
    space:36, spread:42, zones:[4,8], native:true, sun:'full', moist:'dry', phen:'mid', grow:3,
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'A foam of white over a tidy woody knot. Tea from the leaves once started a revolution, roughly.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#5d8a4c',bloom:'#f0efe2'}, Fall:{fol:'#8a8a5e'}, Winter:{seed:'#5e5248'}}},
  coralberry:{ name:'Coralberry', latin:'Symphoricarpos orbiculatus', form:'bush', type:'shrub', h:34, cw:64,
    space:48, spread:60, zones:[2,7], native:true, sun:'part', moist:'medium', phen:'mid', grow:3,
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'An easy thicket that holds its coral-pink berries on bare winter stems. Quail cover.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#5d7a4c'}, Fall:{fol:'#9a8a5e',seed:'#c25a6e'}, Winter:{seed:'#b8506a'}}},

  /* ---------- trees ---------- */
  buroak:{ name:'Bur Oak', latin:'Quercus macrocarpa', form:'tree', type:'tree', h:120, cw:150,
    space:480, spread:840, zones:[3,8], native:true, sun:'full', moist:'dry', phen:'warm', grow:10,
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'The savanna king — corky bark, fringed acorns, two centuries of patience. Plant it for someone else.',
    sea:{Spring:{fol:'#7d9a5f'}, Summer:{fol:'#4e6e44'}, Fall:{fol:'#9a7a45'}, Winter:{fol:'#8a6e4e'}}},
  redbud:{ name:'Eastern Redbud', latin:'Cercis canadensis', form:'tree', type:'tree', h:70, cw:95,
    space:240, spread:300, zones:[4,9], native:true, sun:'part', moist:'medium', phen:'cool', grow:5,
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:"Magenta flowers straight out of the bare branches in April, heart leaves after. The prairie edge's small tree.",
    sea:{Spring:{bloom:'#c75a8e'}, Summer:{fol:'#5d7a4c'}, Fall:{fol:'#e8c23a'}, Winter:{seed:'#5e4a3a'}}},
  cottonwood:{ name:'Eastern Cottonwood', latin:'Populus deltoides', form:'tree', type:'tree', h:140, cw:170,
    space:600, spread:900, zones:[3,9], native:true, sun:'full', moist:'moist', phen:'mid', grow:5,
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'The state tree of Kansas: fast, huge, glittering leaves, June cotton everywhere. Needs room and water.',
    sea:{Spring:{fol:'#8aa86a'}, Summer:{fol:'#6f9a4e',seed:'#f3efe5'}, Fall:{fol:'#e8c23a'}, Winter:{}}},
  redcedar:{ name:'Eastern Red Cedar', latin:'Juniperus virginiana', form:'conifer', type:'tree', h:90, cw:55,
    space:180, spread:240, zones:[2,9], native:true, sun:'full', moist:'dry', phen:'cool', grow:7,
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Native evergreen with blue juniper berries. Honest warning: off the yard it eats unburned prairie.',
    sea:{Spring:{fol:'#4e6e52'}, Summer:{fol:'#46624a'}, Fall:{fol:'#4e6650',seed:'#7a93a8'}, Winter:{fol:'#3f5a46',seed:'#7a93a8'}}},
};
const PLANT_KEYS = Object.keys(PLANTS);

/* Curated ecoregions for the region picker (EPA Level III, the prairie
   states this game grew up in). zone is the default USDA suggestion the
   picker pre-fills — gardeners can override it. Don't ship shapefiles. */
const REGIONS = [
  {name:'Flint Hills', zone:6,
   blurb:'Tallgrass prairie over limestone and chert — too rocky to plow, so it never was.'},
  {name:'Central Great Plains', zone:6,
   blurb:'Mixed-grass heart of Kansas; hot summers, honest wind.'},
  {name:'High Plains', zone:5,
   blurb:'Shortgrass country — dry, high, and tough as nails.'},
  {name:'Southwestern Tablelands', zone:6,
   blurb:'Red-rock breaks and canyons off the southwest shoulder of the plains.'},
  {name:'Central Irregular Plains', zone:6,
   blurb:'Rolling Osage country where tallgrass meets scattered oak.'},
  {name:'Western Corn Belt Plains', zone:5,
   blurb:'Loess hills and old tallgrass, mostly under corn now.'},
];
