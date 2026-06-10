/* =====================================================
   HORTUS PERENNIS — species data
   =====================================================
   Each entry is the contract the rest of the game renders and plans
   against. drawPlant() uses: form, h, sea. The planner features use:
   space, spread, zones, native, eco.

   form    one of: bunchgrass | vertgrass | cone | globe | spike | shrub
   h       mature height in px (drives the renderer, not real units)
   space   on-center planting distance in inches (what you'd order/space by)
   spread  mature clump width in inches (info card / export notes)
   zones   [min,max] USDA hardiness range
   native  true if the straight species is native to the central US;
           false for cultivars/hybrids of garden (non-native) origin
   eco     EPA Level III ecoregions where the species is naturally at home;
           empty for non-natives. Names follow the EPA Level III convention,
           e.g. 'Flint Hills', 'Central Great Plains', 'High Plains',
           'Southwestern Tablelands', 'Central Irregular Plains',
           'Western Corn Belt Plains'.
   sea     per-season appearance, the Oudolf heart of the game:
           fol (foliage), bloom (flower this season, omit for none),
           seed (persistent seedhead/structure — fall/winter presence is
           the whole point), eye (cone center, echinacea only)

   Accuracy matters more than prettiness — Kevin grows these.
*/
'use strict';

const PLANTS = {
  bluestem:{ name:'Little Bluestem', latin:'Schizachyrium scoparium', form:'bunchgrass', h:46,
    space:18, spread:18, zones:[3,9], native:true,
    eco:['Flint Hills','Central Great Plains','High Plains','Southwestern Tablelands',
         'Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Blue-green all summer, then the best copper in the prairie. Backlit in November it glows.',
    sea:{Spring:{fol:'#7fa07a'}, Summer:{fol:'#6e8f9b'}, Fall:{fol:'#c0623b',seed:'#efe6d3'}, Winter:{fol:'#a35a35',seed:'#f3ecdd'}}},
  dropseed:{ name:'Prairie Dropseed', latin:'Sporobolus heterolepis', form:'bunchgrass', h:34,
    space:18, spread:24, zones:[3,9], native:true,
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'A fine-textured fountain that smells faintly of popcorn in bloom. Turns pumpkin-gold in fall.',
    sea:{Spring:{fol:'#7d9a5f'}, Summer:{fol:'#6f8f5a',seed:'#d8c9a8'}, Fall:{fol:'#d99a4e'}, Winter:{fol:'#c2a06a'}}},
  karl:{ name:"Feather Reed Grass 'Karl Foerster'", latin:'Calamagrostis × acutiflora', form:'vertgrass', h:62,
    space:24, spread:24, zones:[4,9], native:false, eco:[],
    blurb:'The exclamation point. Vertical wheat-colored plumes by June that stand straight through snow.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#7d9a5f',seed:'#d9c08a'}, Fall:{fol:'#b89a5e',seed:'#d9c08a'}, Winter:{fol:'#b09a6e',seed:'#e0d2ae'}}},
  echinacea:{ name:'Purple Coneflower', latin:'Echinacea purpurea', form:'cone', h:48,
    space:18, spread:18, zones:[3,8], native:true,
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Pink petals around an orange cone in July; black seedheads that feed goldfinches all winter.',
    sea:{Spring:{fol:'#5d7a4c'}, Summer:{fol:'#5d7a4c',bloom:'#c76b8e',eye:'#b5651d'}, Fall:{fol:'#6b6248',seed:'#3a2c22'}, Winter:{fol:'#6b5d4a',seed:'#241a16'}}},
  rattlesnake:{ name:'Rattlesnake Master', latin:'Eryngium yuccifolium', form:'globe', h:52,
    space:18, spread:24, zones:[3,8], native:true,
    eco:['Flint Hills','Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Silver yucca-like leaves and pale spiky globes. Architectural in every season.',
    sea:{Spring:{fol:'#8fa8a0'}, Summer:{fol:'#8fa8a0',bloom:'#dfe8dd'}, Fall:{fol:'#9a9a86',seed:'#8a7a5e'}, Winter:{fol:'#8d8674',seed:'#6e5f48'}}},
  allium:{ name:"Ornamental Onion 'Millenium'", latin:'Allium', form:'globe', h:36,
    space:12, spread:12, zones:[4,8], native:false, eco:[],
    blurb:'Rosy-purple drumsticks in high summer, mobbed by pollinators. Tan globes persist after frost.',
    sea:{Spring:{fol:'#6f8f5a'}, Summer:{fol:'#6f8f5a',bloom:'#b06a9e'}, Fall:{fol:'#9a8a5e',seed:'#c2ad85'}, Winter:{fol:'#9a8f78',seed:'#cdbb95'}}},
  baptisia:{ name:'Blue False Indigo', latin:'Baptisia australis', form:'shrub', h:50,
    space:36, spread:42, zones:[3,9], native:true,
    eco:['Flint Hills','Central Great Plains','Central Irregular Plains'],
    blurb:'Indigo spikes in spring on a shrub-like clump; charcoal seed pods that rattle in winter wind.',
    sea:{Spring:{fol:'#6f8f6e',bloom:'#4a5d9e'}, Summer:{fol:'#5d7a5c'}, Fall:{fol:'#6e6a55',seed:'#2c2620'}, Winter:{fol:'#5e574a',seed:'#1d1814'}}},
  mountainmint:{ name:'Mountain Mint', latin:'Pycnanthemum muticum', form:'shrub', h:40,
    space:24, spread:30, zones:[4,8], native:true,
    eco:['Central Irregular Plains','Western Corn Belt Plains'],
    blurb:'Silver-dusted bracts that look frosted in July. The single best pollinator plant in the bed.',
    sea:{Spring:{fol:'#7d9a6e'}, Summer:{fol:'#8fa89a',bloom:'#e8e8e0'}, Fall:{fol:'#8a8a70',seed:'#4e463a'}, Winter:{fol:'#7d7666',seed:'#3a342c'}}},
  amsonia:{ name:'Bluestar', latin:'Amsonia hubrichtii', form:'shrub', h:44,
    space:36, spread:36, zones:[5,8], native:true,
    eco:['Ouachita Mountains','Arkansas Valley'],
    blurb:'Steel-blue stars in spring, ferny green all summer, then pure molten gold in October.',
    sea:{Spring:{fol:'#7d9a6e',bloom:'#7d93c8'}, Summer:{fol:'#6f8f5a'}, Fall:{fol:'#e8b84a'}, Winter:{fol:'#b09a6e'}}},
  salvia:{ name:"Meadow Sage 'Caradonna'", latin:'Salvia nemorosa', form:'spike', h:38,
    space:18, spread:15, zones:[4,8], native:false, eco:[],
    blurb:'Near-black stems with violet spikes in waves from May. Cut nothing; the dark stems hold.',
    sea:{Spring:{fol:'#5d7a4c',bloom:'#5a3a8e'}, Summer:{fol:'#5d7a4c',bloom:'#6a4a9e'}, Fall:{fol:'#6b6248',seed:'#3a3030'}, Winter:{fol:'#5e574a',seed:'#2c2624'}}},
};
const PLANT_KEYS = Object.keys(PLANTS);
