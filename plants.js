/* =====================================================
   HORTUS PERENNIS — species data
   =====================================================
   Each entry is the contract the rest of the game renders and plans
   against. drawPlant() uses: form, h, sea, stem. The planner features
   use: type, space, spread, zones, native, eco, sun, moist.

   form    one of: bunchgrass | vertgrass | cone | globe | spike | shrub
   type    grass | sedge | forb — groups the tool tray (matrix first)
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
    sea:{Spring:{fol:'#7fa07a'}, Summer:{fol:'#6e8f9b'}, Fall:{fol:'#c0623b',seed:'#efe6d3'}, Winter:{fol:'#a35a35',seed:'#f3ecdd'}}},
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
  sideoats:{ name:'Sideoats Grama', latin:'Bouteloua curtipendula', form:'bunchgrass', type:'grass', h:30,
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
    space:18, spread:18, zones:[3,8], native:true, sun:'full', moist:'medium', phen:'mid',
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Pink petals around an orange cone in July; black seedheads that feed goldfinches all winter.',
    sea:{Spring:{fol:'#5d7a4c'}, Summer:{fol:'#5d7a4c',bloom:'#c76b8e',eye:'#b5651d'}, Fall:{fol:'#6b6248',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}}},
  pallida:{ name:'Pale Purple Coneflower', latin:'Echinacea pallida', form:'cone', type:'forb', h:52,
    space:18, spread:18, zones:[4,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Pale drooping petals on wiry stems weeks before purpurea. The prairie original.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#d8a0b8',eye:'#8a5a3a'}, Fall:{fol:'#8a7a55',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}}},
  topeka:{ name:'Topeka Coneflower', latin:'Echinacea atrorubens', form:'cone', type:'forb', h:44,
    space:15, spread:12, zones:[5,8], native:true, sun:'full', moist:'dry', phen:'mid',
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains'],
    blurb:'The Flint Hills coneflower — deep wine petals swept back hard. Rare in the trade; grow it if you find it.',
    sea:{Spring:{fol:'#5d7a4c'}, Summer:{fol:'#5d7a4c',bloom:'#a84a5e',eye:'#5e3a2a'}, Fall:{fol:'#7a6a4a',seed:'#352820'}, Winter:{fol:'#6b5d4a',seed:'#201812'}}},
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
