'use strict';

/* Daily briefs pair suggested plant choices with composition exercises and
   self-review goals. Finishing is the gardener's decision, never a rule score. */
const DAILY_THEMES = [
  {
    id:"matrix",
    title:"Matrix & Scatter",
    season:"Summer",
    palette:[{s:"dropseed",v:null},{s:"bluestem",v:null},{s:"sideoats",v:null},{s:"prairiejunegrass",v:null},{s:"pallida",v:null},{s:"purpleprairieclover",v:null},{s:"butterfly",v:null},{s:"liatris",v:null},{s:"pussytoes",v:null},{s:"heartleafalexander",v:null}],
    exercises:[["A woven carpet","Make a connected grass layer with flowering plants threaded through."],["Quiet matrix","Keep the grass layer calm and let a few flowering accents stand out."],["Repeated scatter","Repeat the same flowering accents through a continuous grass layer."]],
    goals:["Keep the grass matrix visually connected.","Let flowering accents emerge through the matrix.","Avoid isolated blocks that break the ground layer."]
  },
  {
    id:"evergreen",
    title:"Evergreen Bones",
    season:"Winter",
    palette:[{s:"boxwoodlow",v:null},{s:"yewlow",v:null},{s:"inkberry",v:null},{s:"sweetbox",v:null},{s:"skimmia",v:null},{s:"loworegongrape",v:null},{s:"christmasfern",v:null},{s:"marginalwoodfern",v:null},{s:"evergoldsedge",v:null},{s:"hollyfern",v:null}],
    exercises:[["Winter framework","Use compact woody evergreens with a lower leafy layer."],["A winter focal point","Give one woody form prominence in a restrained winter composition."],["Evergreen rhythm","Repeat evergreen forms to connect the winter view."]],
    goals:["Leave mature woody plants room to grow.","Connect woody forms with lower foliage.","Inspect the winter view using Time."]
  },
  {
    id:"water-edge",
    title:"Water's Edge",
    season:"Summer",
    palette:[{s:"pickerelweed",v:null},{s:"marshmarigold",v:null},{s:"americansweetflag",v:null},{s:"softrush",v:null},{s:"arrowhead",v:null},{s:"cardinallobelia",v:null},{s:"swampmilkweed",v:null},{s:"blueflagiris",v:null},{s:"tussocksedge",v:null},{s:"fragrantwaterlily",v:null}],
    exercises:[["From water to land","Grade the planting from plants in the water, through the margin, to drier ground."],["A marginal frame","Frame one stretch of water with a bold group of marginal plants and leave the rest open."],["Reflections","Keep part of the water clear so the planting at its edge is seen twice."]],
    goals:["Give each plant its place: in the water, at the margin or on drier ground.","Leave some of the water open.","Keep a way to the water's edge clear."]
  },
  {
    id:"cottage",
    title:"Cottage Abundance",
    season:"Summer",
    palette:[{s:"yarrow",v:null},{s:"meadowsage",v:null},{s:"echinacea",v:null},{s:"phlox",v:null},{s:"stachys",v:null},{s:"catmint",v:null},{s:"shastadaisy",v:null},{s:"spikespeedwell",v:null},{s:"dropseed",v:null},{s:"quakinggrass",v:null}],
    exercises:[["Soft edges","Let low flowers soften the path while taller plants rise behind."],["A restrained cottage","Make a full-looking border from a small, repeated plant palette."],["Flower ribbons","Carry repeated flower colours through the planting like ribbons."]],
    goals:["Use low flowers to soften the path.","Place taller accents behind lower planting.","Repeat colours to connect the abundance."]
  },
  {
    id:"bulbs",
    title:"Bulbs Through Perennials",
    season:"Spring",
    palette:[{s:"crocus",v:null},{s:"scillasiberica",v:null},{s:"muscari",v:null},{s:"daffodil",v:null},{s:"tulipsylvestris",v:null},{s:"camassia",v:null},{s:"alliumPurpleSensation",v:null},{s:"bluemoorgrass",v:null},{s:"amsonia",v:null},{s:"sanguineumgeranium",v:null}],
    exercises:[["A bulb carpet","Scatter early bulbs through a perennial layer that will hide their fading leaves."],["Bold bulb drifts","Plant a few bold drifts of bulbs that flower one after another."],["A spring succession","Arrange the bulbs so something flowers from early to late spring along the route."]],
    goals:["Plant bulbs among perennials, not on bare ground.","Choose perennials that cover fading bulb leaves.","Step through spring using Time to watch the sequence."]
  },
  {
    id:"blue-gold",
    title:"Blue and Gold",
    season:"Summer",
    palette:[{s:"meadowsage",v:"caradonna"},{s:"catmint",v:null},{s:"russiansage",v:null},{s:"amsonia",v:null},{s:"baptisia",v:null},{s:"goldenrod",v:null},{s:"coreopsis",v:null},{s:"yarrow",v:"moonshine"},{s:"goldenalexander",v:null},{s:"bluestem",v:"theblues"}],
    exercises:[["Complementary pairs","Pair blue and yellow flowers so that each makes the other look brighter."],["Mostly blue","Let blue lead the planting, with a few yellow accents to lift it."],["Alternating notes","Alternate blue and yellow groups along the route in a steady beat."]],
    goals:["Pair blue and yellow flowers within view of each other.","Decide which colour leads and which accents.","Use blue-grey foliage to link the two colours."]
  },
  {
    id:"deer-border",
    title:"Deer-Resistant Border",
    season:"Summer",
    palette:[{s:"yarrow",v:null},{s:"meadowsage",v:null},{s:"monarda",v:null},{s:"mountainmint",v:null},{s:"agastache",v:null},{s:"catmint",v:null},{s:"calamint",v:null},{s:"lambsear",v:null},{s:"dropseed",v:null},{s:"bluestem",v:null}],
    exercises:[["Aromatic border","Connect aromatic flowers with contrasting foliage along the path."],["A tough little garden","Use a small palette to make a legible, repeated border."],["Scented repetition","Carry aromatic groups through the planting in a repeated sequence."]],
    goals:["Use aromatic plants along the route.","Contrast fine leaves with a bolder texture.","Remember deer resistance is relative, not a guarantee."]
  },
  {
    id:"sensory",
    title:"Sensory Garden",
    season:"Summer",
    palette:[{s:"lavender",v:null},{s:"catmint",v:null},{s:"calamint",v:null},{s:"agastache",v:null},{s:"meadowsage",v:null},{s:"lambsear",v:null},{s:"silvermound",v:null},{s:"yarrow",v:null},{s:"dropseed",v:null},{s:"bluefescue",v:null}],
    exercises:[["A scented edge","Place aromatic and soft foliage near the path in a sunny, free-draining study."],["A small sensory corner","Create a compact corner of contrasting soft and aromatic foliage."],["Texture along the path","Repeat aromatic groups and soft textures along the route."]],
    goals:["Put aromatic and soft foliage near the route.","Keep taller plants behind lower planting.","Repeat textures so the edge feels connected."]
  },
  {
    id:"hot-colours",
    title:"Hot Colours",
    season:"Summer",
    palette:[{s:"helenium",v:"moerheim"},{s:"redhotpoker",v:null},{s:"blanketflower",v:null},{s:"butterfly",v:null},{s:"rudbeckia",v:null},{s:"yarrow",v:"terracotta"},{s:"falsesunflower",v:null},{s:"echinacea",v:"tikitorch"},{s:"crocosmia",v:null},{s:"switchgrass",v:"shenandoah"}],
    exercises:[["Warm drifts","Build drifts of red, orange and yellow flowers held together by grasses."],["A single hot spot","Gather the hottest colours into one group and let green calm the rest of the site."],["Sunset gradient","Grade the colours from yellow at one end of the site to deep red at the other."]],
    goals:["Use warm colours as the main theme.","Give hot colours some green or grass between them.","Check the Bloom calendar for a long warm season."]
  },
  {
    id:"dry-prairie",
    title:"Dry Prairie Matrix",
    season:"Summer",
    palette:[{s:"bluestem",v:null},{s:"dropseed",v:null},{s:"sideoats",v:null},{s:"bluegrama",v:null},{s:"pallida",v:null},{s:"angustifolia",v:null},{s:"purpleprairieclover",v:null},{s:"butterfly",v:null},{s:"liatris",v:null},{s:"goldenrod",v:null}],
    exercises:[["Woven meadow","Let the grasses connect the bed, with flowers emerging through them."],["Prairie pockets","Build a few compact flowering pockets surrounded by grass."],["A repeated horizon","Repeat low grasses along the route, with upright accents behind."]],
    goals:["Keep the grasses visually connected.","Mix flowering forms into the grass.","Leave a clear route through the planting."]
  },
  {
    id:"spring",
    title:"Spring Ephemerals",
    season:"Spring",
    palette:[{s:"bluebells",v:null},{s:"woodlandphlox",v:null},{s:"shootingstar",v:null},{s:"columbine",v:null},{s:"dwarfcrestediris",v:null},{s:"hepatica",v:null},{s:"yellowtroutlily",v:null},{s:"christmasfern",v:null},{s:"rosysedge",v:null},{s:"maidenhairfern",v:null}],
    exercises:[["Spring into summer","Place spring flowers among leafy companions that fill later gaps."],["A spring clearing","Make a small spring-flowering pocket framed by summer foliage."],["Woodland echoes","Repeat spring flowers and their leafy companions along the route."]],
    goals:["Plant spring flowers beside leafy companions.","Look for summer gaps after early flowers fade.","Compare spring and summer using Time."]
  },
  {
    id:"silver",
    title:"Silver Foliage",
    season:"Summer",
    palette:[{s:"broadleafwormwood",v:null},{s:"fringedsage",v:null},{s:"silvermound",v:null},{s:"lambsear",v:null},{s:"blueoatgrass",v:null},{s:"largebluefescue",v:null},{s:"silvermoorgrass",v:null},{s:"eryngiumbourgatii",v:null},{s:"rattlesnake",v:null},{s:"lavender",v:null}],
    exercises:[["Silver and shadow","Set silver foliage against darker greens so that both read clearly."],["A pale glow","Gather silver plants into one luminous group in a quiet green setting."],["Silver threads","Repeat silver plants through the site so the eye follows them from group to group."]],
    goals:["Make silver and grey foliage the main feature.","Contrast fine silver leaves with one bolder shape.","Look at the planting by night with the day and night switch."]
  },
  {
    id:"shrub-border",
    title:"Shrubs and Perennials",
    season:"Fall",
    palette:[{s:"ninebark",v:null},{s:"arrowwood",v:null},{s:"oakleafhydrangea",v:null},{s:"fothergilla",v:null},{s:"virginiasweetspire",v:null},{s:"beautyberry",v:null},{s:"bigrootgeranium",v:null},{s:"amsonia",v:null},{s:"newengland",v:null},{s:"pennsedge",v:null}],
    exercises:[["Shrubs as anchors","Place a few shrubs as anchors and weave perennials between them."],["A layered border","Step the planting from low perennials at the front to shrubs at the back."],["Autumn colour","Repeat shrubs with strong autumn colour so they connect across the site."]],
    goals:["Leave shrubs room for their mature spread.","Fill between and in front of the shrubs with perennials.","Inspect autumn colour and winter twigs using Time."]
  },
  {
    id:"entrance",
    title:"Welcoming Entrance",
    season:"Summer",
    palette:[{s:"dropseed",v:null},{s:"bluefescue",v:null},{s:"bluestem",v:null},{s:"meadowsage",v:null},{s:"catmint",v:null},{s:"stachys",v:null},{s:"echinacea",v:null},{s:"penstemon",v:null},{s:"sedum",v:null},{s:"yarrow",v:null}],
    exercises:[["Mark the arrival","Treat the path's outer end as the entrance. Use a recognisable planting group to welcome someone into the garden."],["Lead the eye","Carry a planting motif from the entrance toward the far end of the path, with a clear destination."],["Reveal around the bend","Use the turn in the path to reveal a focal planting gradually, keeping the inside of the bend low."]],
    goals:["Make the entrance easy to recognise.","Leave the route open as plants reach mature size.","Give the arrival and the destination different emphasis."]
  },
  {
    id:"foliage",
    title:"Foliage First",
    season:"Summer",
    palette:[{s:"hosta",v:null},{s:"hakone",v:null},{s:"heuchera",v:null},{s:"brunnera",v:null},{s:"solomonsseal",v:null},{s:"japanesepaintedfern",v:null},{s:"christmasfern",v:null},{s:"marginalwoodfern",v:null},{s:"evergoldsedge",v:null},{s:"plantainsedge",v:null}],
    exercises:[["Leaf contrasts","Compose with fine, broad and upright leaves in a part-shade study."],["One bold leaf","Let a bold-leaved focal group stand out against quieter textures."],["Texture rhythm","Repeat contrasting foliage shapes through the bed."]],
    goals:["Contrast fine, broad and upright leaves.","Balance a bold focal group with quieter textures.","Look at the design without relying on flower colour."]
  },
  {
    id:"rhythm",
    title:"Repetition & Rhythm",
    season:"Summer",
    palette:[{s:"dropseed",v:null},{s:"karl",v:null},{s:"bluestem",v:null},{s:"echinacea",v:null},{s:"stachys",v:null},{s:"meadowsage",v:null},{s:"sedum",v:null},{s:"penstemon",v:null},{s:"allium",v:null},{s:"rudbeckia",v:null}],
    exercises:[["A repeated phrase","Choose a short planting phrase and repeat it across the site."],["Three-plant composition","Explore how much variety three repeated species can create."],["Four-part rhythm","Use four species in a recurring sequence with contrasting forms."]],
    goals:["Make the repeated planting phrase visible.","Carry the same idea through the whole site.","Use spacing to create pauses in the rhythm."]
  },
  {
    id:"wet-spot",
    title:"Slow-Draining Low",
    season:"Summer",
    palette:[{s:"foxsedge",v:null},{s:"grayssedge",v:null},{s:"tussocksedge",v:null},{s:"swampmilkweed",v:null},{s:"liatrisspicata",v:null},{s:"babyjoe",v:null},{s:"northernblueflag",v:null},{s:"blueflagiris",v:null},{s:"roughgoldenrod",v:null},{s:"greatstjohnswort",v:null}],
    exercises:[["Sedge framework","Use sedges to connect flowering groups in a damp-site planting."],["A damp pocket","Concentrate a few moisture-loving plants in a coherent central group."],["Wet meadow rhythm","Repeat sedges and flowers through the bed while keeping the route clear."]],
    goals:["Connect flowers with a sedge layer.","Keep taller plants from hiding the lower layer.","Keep the outside route clear."]
  },
  {
    id:"pollinator",
    title:"Pollinator Patch",
    season:"Summer",
    palette:[{s:"echinacea",v:null},{s:"monarda",v:null},{s:"mountainmint",v:null},{s:"penstemon",v:null},{s:"goldenalexander",v:null},{s:"liatrispycnostachya",v:null},{s:"rudbeckia",v:null},{s:"newengland",v:null},{s:"butterfly",v:null},{s:"dropseed",v:null}],
    exercises:[["Flower patches","Use generous patches of flowers with space to see each patch."],["A small feast","Create a compact composition from a restrained flowering palette."],["Connected blooms","Repeat flowering patches across the site instead of isolating each species."]],
    goals:["Make flowering groups easy to distinguish.","Repeat a flower colour through the planting.","Use the Bloom calendar to inspect flowering gaps."]
  },
  {
    id:"host-plants",
    title:"Butterfly Host Plants",
    season:"Summer",
    palette:[{s:"commonmilkweed",v:null},{s:"butterfly",v:null},{s:"prairiemilkweed",v:null},{s:"goldenalexander",v:null},{s:"whiteturtlehead",v:null},{s:"newengland",v:null},{s:"pussytoes",v:null},{s:"commonblueviolet",v:null},{s:"bluestem",v:null},{s:"spicebush",v:null}],
    exercises:[["Food for every stage","Mix plants that caterpillars eat with flowers that feed the butterflies."],["A host-plant patch","Gather host plants into one generous patch that can be left a little untidy."],["Leave the stems","Plan an area to stand uncut through winter, where insects can shelter."]],
    goals:["Include plants that caterpillars eat, not only flowers.","Plant host plants in groups rather than one of each.","Check which stems will still stand in winter using Time."]
  },
  {
    id:"patio-view",
    title:"View from the Patio",
    season:"Summer",
    palette:[{s:"dropseed",v:null},{s:"bluestem",v:null},{s:"karl",v:null},{s:"amsonia",v:null},{s:"echinacea",v:null},{s:"meadowsage",v:null},{s:"catmint",v:null},{s:"sedum",v:null},{s:"stachys",v:null},{s:"alliumPurpleSensation",v:null}],
    exercises:[["Frame the view","Imagine sitting on the patio. Frame one planted focal group with quieter shapes on either side."],["A layered outlook","Build a view from the patio with a low foreground, a middle layer and taller plants beyond."],["An open window","Keep a deliberate opening in the planting so the view from the patio reaches into the garden."]],
    goals:["Choose what the eye meets first from the patio.","Keep low planting beside the paving and taller forms beyond.","Check the view from another camera angle before finishing."]
  },
  {
    id:"tapestry",
    title:"Naturalistic Tapestry",
    season:"Summer",
    palette:[{s:"molinia",v:null},{s:"sesleria",v:null},{s:"persicaria",v:null},{s:"greatburnet",v:null},{s:"astrantia",v:null},{s:"culvers",v:null},{s:"joepye",v:null},{s:"echinacea",v:null},{s:"stachys",v:null},{s:"helenium",v:null}],
    exercises:[["Plants as a tapestry","Weave repeated perennials and grasses together so that no single group dominates."],["Structure and filler","Place a few tall structural plants, then fill between them with a quieter layer."],["A see-through veil","Set airy, tall plants near the front so the planting behind is seen through them."]],
    goals:["Mix plants into a layered tapestry rather than solid blocks.","Let a few structural plants stand above the rest.","Check how the planting reads after flowering using Time."]
  },
  {
    id:"monochrome",
    title:"Monochrome Study",
    season:"Summer",
    palette:[{s:"yarrow",v:null},{s:"penstemon",v:null},{s:"whiteprairieclover",v:null},{s:"mountainmint",v:null},{s:"shastadaisy",v:null},{s:"culvers",v:null},{s:"candytuft",v:null},{s:"echinacea",v:"whiteswan"},{s:"dropseed",v:null},{s:"karl",v:null}],
    exercises:[["White and cream","Connect white and cream flowers with grasses for texture."],["A pale focal point","Make one pale flowering group the focus of a restrained composition."],["White ribbons","Repeat white and cream flowers through the bed, changing height and texture."]],
    goals:["Use white and cream flowers as the main colour.","Let foliage and grasses provide contrast.","Repeat the pale flowers through the composition."]
  },
  {
    id:"late-season",
    title:"Late-Season Glow",
    season:"Fall",
    palette:[{s:"aster",v:null},{s:"newengland",v:null},{s:"smoothaster",v:null},{s:"goldenrod",v:null},{s:"autumnGoldenrod",v:null},{s:"sedum",v:null},{s:"narrowleafironweed",v:null},{s:"bluestem",v:null},{s:"dropseed",v:null},{s:"switchgrass",v:null}],
    exercises:[["Autumn partners","Set late flowers against warm grasses and lasting seedheads."],["A late focal point","Build a restrained autumn composition around one flowering focal group."],["Autumn procession","Repeat late flowers along the route with grasses between."]],
    goals:["Balance late flowers with grasses.","Connect flowering groups through repetition.","Inspect the autumn view using Time."]
  },
  {
    id:"winter",
    title:"Winter Silhouettes",
    season:"Winter",
    palette:[{s:"switchgrass",v:null},{s:"bluestem",v:null},{s:"miscanthus",v:null},{s:"karl",v:null},{s:"monarda",v:null},{s:"rudbeckia",v:null},{s:"echinacea",v:null},{s:"sedum",v:null},{s:"baptisia",v:null},{s:"rattlesnake",v:null}],
    exercises:[["Seedheads in snow","Choose plants for the shapes they keep long after flowering."],["Dark against pale","Set dark seedheads in front of pale winter grasses."],["Grasses as a frame","Use grasses as the framework and set the seedheads within it."]],
    goals:["Choose plants that stand through winter.","Contrast round seedheads with upright grasses.","Compare winter with summer using Time."]
  },
  {
    id:"four-season",
    title:"Four-Season Interest",
    season:"Fall",
    palette:[{s:"bluestem",v:null},{s:"dropseed",v:null},{s:"karl",v:null},{s:"echinacea",v:null},{s:"penstemon",v:null},{s:"amsonia",v:null},{s:"aster",v:null},{s:"sedum",v:null},{s:"goldenrod",v:null},{s:"alliumPurpleSensation",v:null}],
    exercises:[["Standing structure","Make a framework that still reads when the flowers fade."],["One lasting focal point","Use a strong central shape with a restrained supporting palette."],["Winter echoes","Repeat lasting forms so the winter view has a clear rhythm."]],
    goals:["Include shapes that stand after flowering.","Balance a focal group with repeated supporting plants.","Inspect summer and winter using Time."]
  },
  {
    id:"woodland",
    title:"Shade Woodland Floor",
    season:"Spring",
    palette:[{s:"pennsedge",v:null},{s:"rosysedge",v:null},{s:"plantainsedge",v:null},{s:"christmasfern",v:null},{s:"marginalwoodfern",v:null},{s:"maidenhairfern",v:null},{s:"hosta",v:null},{s:"heuchera",v:null},{s:"woodlandphlox",v:null},{s:"solomonsseal",v:null}],
    exercises:[["Leaf layers","Build a low woodland carpet beneath arching and upright leaves."],["A quiet clearing","Leave a calm opening between a few bold foliage groups."],["Fern rhythm","Carry a repeated fern shape along the path."]],
    goals:["Contrast fine and broad leaves.","Place low plants beneath taller foliage.","Look for a quiet area between bold groups."]
  },
  {
    id:"grasses",
    title:"Grasses Only",
    season:"Fall",
    palette:[{s:"bluestem",v:null},{s:"dropseed",v:null},{s:"sideoats",v:null},{s:"bluegrama",v:null},{s:"lovegrass",v:null},{s:"karl",v:null},{s:"moorhexe",v:null},{s:"switchgrass",v:null},{s:"prairiejunegrass",v:null},{s:"bluefescue",v:null}],
    exercises:[["Moving textures","Combine low fountains and upright grasses to make contrasting textures."],["Grass sculpture","Create a small composition where each grass shape has room to read."],["A flowing rhythm","Repeat the same grass shapes through the planting like a repeating phrase."]],
    goals:["Contrast low fountains and upright forms.","Leave room for mature clumps.","Inspect movement and winter structure using Time."]
  },
  {
    id:"gravel",
    title:"Hot, Dry Gravel",
    season:"Summer",
    palette:[{s:"bluegrama",v:null},{s:"bluefescue",v:null},{s:"dropseed",v:null},{s:"pallida",v:null},{s:"liatris",v:null},{s:"purpleprairieclover",v:null},{s:"yucca",v:null},{s:"eryngiumbourgatii",v:null},{s:"lambsear",v:null},{s:"pussytoes",v:null}],
    exercises:[["Shapes in gravel","Set upright accents among low mounds with open ground between."],["One sculptural accent","Give a strong plant shape room to stand out from a quiet setting."],["Repeated islands","Arrange repeated groups separated by visible open ground."]],
    goals:["Leave open ground between groups.","Contrast an upright form with low mounds.","Give the strongest shape room to read."]
  },
  {
    id:"ground-layer",
    title:"Living Ground Layer",
    season:"Spring",
    palette:[{s:"pennsedge",v:null},{s:"wildginger",v:null},{s:"foamflower",v:null},{s:"barrenwort",v:null},{s:"creepingphlox",v:null},{s:"greenandgold",v:null},{s:"alleghenyspurge",v:null},{s:"wildgeranium",v:null},{s:"ladysmantle",v:null},{s:"sweetwoodruff",v:null}],
    exercises:[["No bare soil","Knit low plants together until the ground is covered."],["Carpet and accents","Lay a carpet of one or two groundcovers and lift it with a few taller plants."],["Patchwork","Plant groundcovers in patches that interlock without leaving gaps."]],
    goals:["Cover the ground with plants rather than mulch.","Combine spreading and clumping plants.","Compare spring and summer using Time."]
  },
  {
    id:"hummingbird",
    title:"Hummingbird Garden",
    season:"Summer",
    palette:[{s:"columbine",v:null},{s:"penstemon",v:null},{s:"indianpink",v:null},{s:"scarletbeebalm",v:null},{s:"cardinallobelia",v:null},{s:"greatbluelobelia",v:null},{s:"obedientplant",v:null},{s:"liliumsuperbum",v:null},{s:"switchgrass",v:null},{s:"foxsedge",v:null}],
    exercises:[["Flower stops","Arrange patches of tubular flowers in a moist, sun-to-part-shade study."],["A compact stopover","Concentrate a few flowering species into bold groups."],["A flowering route","Repeat flowering patches through the site with supporting foliage between."]],
    goals:["Make bold patches of tubular flowers.","Use supporting foliage between flowering groups.","Check the Bloom calendar for a sequence of flowers."]
  }
];
const DAILY_SITES={
  "border": {
    "label": "Pathside border",
    "description": "A 24 × 18 ft plot with a deep planting bed beside a path.",
    "widthFt": 24,
    "lengthFt": 18
  },
  "split": {
    "label": "Two beds and a path",
    "description": "A 24 × 18 ft plot with two beds divided by a walkable route.",
    "widthFt": 24,
    "lengthFt": 18
  },
  "island": {
    "label": "Island bed",
    "description": "A 24 × 24 ft plot with a central bed and a route around it.",
    "widthFt": 24,
    "lengthFt": 24
  },
  woodland:{label:'Woodland clearing',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft clearing with leaf-litter beds, a winding gravel path and an established serviceberry.',
    conditions:'Design for part shade and average moisture. The tree casts shade; move or remove it with the usual tools. The starting tree is excluded from plant counts.'},
  narrow:{label:'Narrow border',widthFt:30,lengthFt:12,
    description:'A 30 × 12 ft strip with a deep border along a straight limestone path.',
    conditions:'An open, sunny edge. Build depth with low planting near the path and taller groups behind.'},
  patio:{label:'Patio edge',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft garden with an offset paved terrace set into generous beds, and a short path out to the lawn.',
    conditions:'Keep the terrace open and compose a planting to enjoy from its edge. Choose plant positions for the conditions shown in their details.'},
  slope:{label:'Gentle terraced slope',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft site with two shallow planting terraces above a level gravel route.',
    conditions:'Design for a sunny slope. The raised ground uses editable grade steps and dry-stone edges; drainage is a design assumption.'},
  hollow:{label:'Lowered planting hollow',widthFt:24,lengthFt:24,
    description:'A 24 × 24 ft garden with a shallow lowered soil bed and a level path around it.',
    conditions:'Imagine a damp planting pocket in sun to part shade. The bed is plantable soil; the grade does not simulate water or drainage.'},
  gravel:{label:'Gravel garden pockets',widthFt:30,lengthFt:21,
    description:'A 30 × 21 ft gravel garden with broad planting pockets beside a bending slate path.',
    conditions:'Design for sun and free-draining soil. Gravel beds accept plants; the darker slate is the route to keep clear.'},
  corner:{label:'Tapered corner',widthFt:30,lengthFt:24,
    description:'A tapered corner within a 30 × 24 ft outline, with a turning path and two unequal planting areas.',
    conditions:'Use repetition to connect the broad bed and the narrowing end. The plot outline and all ground materials are editable.'},
  /* The second set of sites (0.9.165). Seven sites over sixty days had the same
     layout back on screen every few days, and three of the themes stood on one
     site for all three of their exercises. Each of these is a different way a
     garden is laid out, not a different colour of the same one. A description
     names its size once, as "W × L ft", and no other length: dailySiteText
     converts that one phrase for a metric gardener, and an inch or a foot
     anywhere else would stay imperial. */
  pond:{label:'Pond margin',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft garden around a natural pond, with beds running down to the water and a gravel path along one bank.',
    conditions:'Sun, with wet ground at the water and average soil further out. Water plants go in the pond and its margin suits plants for wet ground. Depth is not modelled.'},
  stream:{label:'Streamside',widthFt:30,lengthFt:21,
    description:'A 30 × 21 ft garden crossed by a winding stream, with a timber footbridge, wet banks and drier beds above them.',
    conditions:'Sun to part shade. Plants that stand in shallow water can go in the stream and the banks suit wet-ground plants. Flow and depth are not simulated.'},
  pool:{label:'Formal pool',widthFt:30,lengthFt:21,
    description:'A 30 × 21 ft garden with a rectangular pool set in a pale paved terrace, framed by planting beds.',
    conditions:'An open, sunny site. Water lilies and marginals can go in the pool; keep enough of it clear to reflect the planting.'},
  meadow:{label:'Mown path through meadow',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft long meadow with a mown path winding through it, two planting bays and a small flagstone seat.',
    conditions:'Sun and average soil. The long meadow is plantable: set drifts and accents straight into it, and keep the mown path open.'},
  lawn:{label:'Borders round a lawn',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft garden with an oval lawn surrounded by deep curving borders and a paved circle at its head.',
    conditions:'Sun to part shade. Keep the lawn and its entrance open; the borders are yours to fill.'},
  double:{label:'Double border',widthFt:30,lengthFt:18,
    description:'A 30 × 18 ft garden with a mown grass path between two deep borders and a paved square at its centre.',
    conditions:'An open, sunny site. Plan the two borders together so they answer each other across the path.'},
  raised:{label:'Raised beds',widthFt:30,lengthFt:21,
    description:'A 30 × 21 ft courtyard of four timber raised beds, divided by brick paths and edged with plantable gravel.',
    conditions:'Sun and free-draining soil. The gravel around the raised beds takes plants too, and the beds can be reshaped with the grade tools.'},
  diagonal:{label:'Diagonal walk',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft garden crossed corner to corner by a bluestone path, with a small landing halfway and two broad beds.',
    conditions:'Sun to part shade. The path splits the site into two angled beds; plant them to be seen from the walk.'},
  edge:{label:'Woodland edge',widthFt:30,lengthFt:18,
    description:'A 30 × 18 ft border beneath an established redbud and flowering dogwood, with a winding path along the front.',
    conditions:'Part shade under the trees, brighter at the front. The trees cast real shade and are left out of plant counts; move or remove them with the usual tools.'},
  treebed:{label:'Under a shade tree',widthFt:24,lengthFt:24,
    description:'A 24 × 24 ft lawn with a broad round bed beneath an established Japanese maple and a slate path to a seat by its trunk.',
    conditions:'Part shade beneath the tree, sun on the lawn around it. The tree casts real shade and is left out of plant counts.'},
  bank:{label:'Stepped bank',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft bank of three stone-walled terraces climbing from a level path, with flights of steps up the middle.',
    conditions:'A sunny, free-draining slope. The terraces, walls and steps are all editable with the grade tools.'},
  berm:{label:'Berm in a gravel garden',widthFt:30,lengthFt:24,
    description:'A 30 × 24 ft gravel garden with a broad grassy berm rising from it and a slate path curving along its foot.',
    conditions:'Sun and free-draining soil, driest on the crown of the berm. Plant into the grass or the gravel, or lay a bed over the mound; it is soft earth from the grade tools.'}
};
/* Each exercise starts on an ecologically suitable site. Shade exercises keep
   a canopy; damp-site palettes never rotate onto a dry gravel template; and a
   theme's three exercises stand on three different sites.
   The ORDER of DAILY_THEMES and these triples were chosen together (0.9.165),
   by a search over every theme's suitable sites, so that across the 90-day
   cycle no site comes back within 12 days of itself. Day d is theme d % 30 and
   exercise floor(d / 30) % 3, so neighbouring themes are neighbouring days:
   reorder the list or change a triple and a test checks the spacing again. */
const DAILY_SITE_ROTATION={
  matrix:['slope','meadow','corner'], evergreen:['pool','edge','treebed'],
  'water-edge':['pond','stream','pool'], cottage:['double','patio','lawn'],
  bulbs:['diagonal','double','narrow'], 'blue-gold':['lawn','slope','patio'],
  'deer-border':['patio','narrow','diagonal'], sensory:['narrow','raised','double'],
  'hot-colours':['corner','diagonal','raised'], 'dry-prairie':['gravel','berm','slope'],
  spring:['edge','treebed','woodland'], silver:['bank','gravel','berm'],
  'shrub-border':['treebed','corner','edge'], entrance:['stream','meadow','gravel'],
  foliage:['woodland','edge','treebed'], rhythm:['raised','bank','corner'],
  'wet-spot':['pond','hollow','stream'], pollinator:['diagonal','lawn','patio'],
  'host-plants':['lawn','slope','diagonal'], 'patio-view':['patio','pool','lawn'],
  tapestry:['slope','narrow','double'], monochrome:['double','raised','narrow'],
  'late-season':['narrow','patio','bank'], winter:['berm','diagonal','meadow'],
  'four-season':['corner','double','berm'], woodland:['treebed','woodland','edge'],
  grasses:['bank','meadow','gravel'], gravel:['gravel','berm','raised'],
  'ground-layer':['woodland','edge','treebed'], hummingbird:['hollow','pond','stream']
};
/* A winding route, as tiles: `centre(t)` is the path's centreline x at row t,
   and a tile is on it when its centre lies within DAILY_ROUTE_HALF of that line,
   measured square to the line rather than along the row, so the path keeps its
   width where it runs on a slant (a row there takes three tiles, not two).
   These routes used to be a straight two-tile strip stepped sideways by one tile
   once or twice. A one-tile jog is under the organic renderer's simplifying
   tolerance, so it never read as a bend, only as a wobble, and the gravel site's
   "bending" path came out as a straight band set at an angle. A curve has to be
   drawn as a curve, and with the step between rows held to one tile, because a
   path whose rows only touch at a corner pinches into a string of lozenges. */
const DAILY_ROUTE_HALF=1.05;
function dailyRouteTile(x,y,gh,centre,half=DAILY_ROUTE_HALF){
  const cx=x+0.5,cy=y+0.5;
  // a point further than `half` along the route cannot be within `half` of it,
  // so only the few steps beside the tile ask the curve (the same t values as ever)
  for(let t=-1;t<=gh+1;t+=0.05){
    const dy=cy-t; if(dy>=half||dy<=-half)continue;
    if(Math.hypot(cx-centre(t),dy)<half)return true;
  }
  return false;
}
// the same, for a route that runs ACROSS the site: centre(t) is its y at column t
function dailyRouteAcross(x,y,gw,centre,half=DAILY_ROUTE_HALF){ return dailyRouteTile(y,x,gw,centre,half); }
/* The later sites describe a tile at a time: `cell(x,y,inner)` returns its
   ground ({k,c}, with `x` for a crossing laid on water) and, where the ground is
   raised or lowered, its grade ({h,w}, with `s` for a step and `m`/`z` for soft
   earth), or null for plain lawn. `inner` is false on the outermost ring. */
function dailyEachTile(p,cell){
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    if(!blobOnPlot(x,y,p.gw,p.gh,p.shape))continue;
    const r=cell(x,y,x>0&&y>0&&x<p.gw-1&&y<p.gh-1); if(!r)continue;
    const key=x+','+y;
    if(r.k)p.terrain[key]=r.x?{k:r.k,c:r.c,x:r.x}:{k:r.k,c:r.c};
    if(r.h||r.m){
      const e={h:r.h||0,w:r.w||'none'};
      if(r.s)e.s=r.s;
      if(r.m){e.m=true;e.z=r.z;}
      p.elevation[key]=e;
    }
  }
}
/* One function a site. Each lays its routes first, so a path or a bridge always
   wins the tile, and reaches the plot's edge, so the way in is from outside. */
const DAILY_SITE_LAYOUTS={
  /* A pond of two lobes and a path along the far bank. One bed material on the
     water sites: two bed materials meet along exact tile lines (they are peers,
     §11), so a bog band round the water drew as a staircase. */
  pond(p){
    const lobe=(cx,cy)=>Math.min(Math.hypot((cx-7.5)/4.6,(cy-8)/3.4),Math.hypot((cx-11)/2.8,(cy-10.2)/2.3));
    const walk=t=>15.4-1.6*Math.sin((t+2)*Math.PI/11);
    dailyEachTile(p,(x,y,inner)=>{
      if(dailyRouteTile(x,y,p.gh,walk))return {k:'path',c:'warm'};
      if(!inner)return null;
      const r=lobe(x+.5,y+.5);
      return r<1?{k:'water',c:'pond'}:{k:'bed',c:'soil'};
    });
  },
  /* The stream runs edge to edge and the path crosses it where it turns, so the
     footbridge is a level deck two tiles wide rather than a slanted one. */
  stream(p){
    const river=t=>6.6+2.1*Math.sin((t-1.5)*Math.PI/11);
    dailyEachTile(p,(x,y,inner)=>{
      const wet=dailyRouteAcross(x,y,p.gw,river,1.35), way=x===6||x===7;
      if(wet)return way?{k:'water',c:'river',x:'plank'}:{k:'water',c:'river'};
      if(way)return {k:'path',c:'sandstone'};
      if(!inner)return null;
      return {k:'bed',c:'soil'};
    });
  },
  pool(p){
    dailyEachTile(p,(x,y,inner)=>{
      if(x>=7&&x<=12&&y>=5&&y<=7)return {k:'water',c:'formal'};
      if((x>=5&&x<=14&&y>=3&&y<=9)||(x>=9&&x<=10&&y>=10))return {k:'path',c:'porcelain'};
      return inner?{k:'bed',c:'soil'}:null;
    });
  },
  // the mown path is bare ground, which is mown lawn, so only the seat is paved
  meadow(p){
    const mown=t=>9+3.6*Math.sin((t-1)*Math.PI/13);
    dailyEachTile(p,(x,y,inner)=>{
      const cx=x+.5,cy=y+.5;
      if(Math.hypot(cx-14.2,cy-7.2)<1.6)return {k:'path',c:'sandstone'};
      if(dailyRouteTile(x,y,p.gh,mown)||!inner)return null;
      if(Math.hypot((cx-4.6)/3,(cy-4.2)/2.3)<1||Math.hypot((cx-15.2)/3.2,(cy-12.2)/2.3)<1)return {k:'bed',c:'soil'};
      return {k:'lawn',c:'meadow'};
    });
  },
  lawn(p){
    dailyEachTile(p,(x,y)=>{
      const cx=x+.5,cy=y+.5;
      if(Math.hypot(cx-10,cy-4)<1.6)return {k:'path',c:'paver'};
      const oval=Math.pow(Math.abs(cx-10)/5.4,2.6)+Math.pow(Math.abs(cy-8.4)/3.8,2.6)<1;
      // the borders run to the boundary, so the corners are planted and the outer edge straight
      if(oval||(Math.abs(cx-10)<1.1&&cy>11.5))return null;
      return {k:'bed',c:'soil'};
    });
  },
  /* The path between the borders is mown grass, bare ground, so only its square
     is paved. Both borders run to the plot's edge: an edge facing lawn is drawn
     soft, and with lawn all round them two rectangles rounded into pills. */
  double(p){
    dailyEachTile(p,(x,y)=>{
      if(x>=8&&x<=11&&y>=4&&y<=7)return {k:'path',c:'sandstone'};
      return y!==5&&y!==6?{k:'bed',c:'soil'}:null;
    });
  },
  raised(p){
    dailyEachTile(p,(x,y,inner)=>{
      if(y===6||y===7||x===9||x===10)return {k:'path',c:'brick'};
      if(!inner)return null;
      const bx=(x>=2&&x<=7)||(x>=12&&x<=17), by=(y>=2&&y<=4)||(y>=9&&y<=11);
      return bx&&by?{k:'bed',c:'soil',h:2,w:'sleeper'}:{k:'bed',c:'gravel'};
    });
  },
  diagonal(p){
    const walk=t=>15.6-t*0.8;
    dailyEachTile(p,(x,y,inner)=>{
      if(dailyRouteTile(x,y,p.gh,walk)||Math.hypot(x+.5-9.6,y+.5-7.6)<1.8)return {k:'path',c:'bluestone'};
      return inner?{k:'bed',c:'mulch'}:null;
    });
  },
  edge(p){
    const walk=t=>7.6+0.9*Math.sin((t-2)*Math.PI/10);
    dailyEachTile(p,(x,y,inner)=>{
      if(dailyRouteAcross(x,y,p.gw,walk))return {k:'path',c:'lime'};
      return inner?{k:'bed',c:'leaf'}:null;
    });
    p.context.push({id:'canopy-1',s:'redbud',v:null,x:5,y:3},{id:'canopy-2',s:'floweringdogwood',v:null,x:14,y:2});
  },
  treebed(p){
    dailyEachTile(p,(x,y)=>{
      const cx=x+.5,cy=y+.5;
      if((Math.abs(cx-8)<1.1&&cy>10)||Math.hypot(cx-8,cy-10.3)<1.9)return {k:'path',c:'slate'};
      return Math.hypot((cx-8)/6.2,(cy-7.6)/5.8)<1?{k:'bed',c:'mulch'}:null;
    });
    p.context.push({id:'canopy-1',s:'japanesemaple',v:null,x:7,y:6});
  },
  /* Three terraces two levels apart (about 10 in), each flight one step deep,
     which is the flight the Steps tool lays down a drop that size: the step goes
     on the LOWER ground, a level above it, and points the way it goes down. */
  bank(p){
    const level=y=>y<4?6:y<8?4:y<11?2:0, stair=x=>x>=8&&x<=11;
    dailyEachTile(p,(x,y,inner)=>{
      const h=level(y);
      if(y===11||y===12)return stair(x)&&y===11?{k:'path',c:'sandstone',h:1,w:'stone',s:2}:{k:'path',c:'sandstone'};
      if(stair(x)&&(y===8||y===4))return {k:'path',c:'sandstone',h:h+1,w:'stone',s:2};
      if((stair(x)&&y>=1&&y<11)||(x>=6&&x<=13&&(y===1||y===2)))return {k:'path',c:'sandstone',h,w:'stone'};
      if(!inner)return h?{h,w:'stone'}:null;
      return h?{k:'bed',c:'soil',h,w:'stone'}:{k:'bed',c:'soil'};
    });
  },
  /* The berm is laid by the Berm tool's own profile (bermLevels), so it is the
     mound the gardener would get from that tool, soft and inside its slope limit.
     It is grass: soft ground under a bed or a meadow is shaded a tile at a time,
     and on gravel, soil or meadow those tiles showed as a faint grid, where bare
     grass is lit as one smooth surface. Its foot meets the path. */
  berm(p){
    const walk=t=>16.3-1.4*Math.sin((t+1)*Math.PI/15), inside=(x,y)=>x>=0&&y>=0&&x<p.gw&&y<p.gh;
    const onWalk=(x,y)=>dailyRouteTile(x,y,p.gh,walk);
    const mound=bermLevels({x0:3,y0:2,x1:14,y1:12},4,()=>0,(x,y)=>!inside(x,y)||onWalk(x,y),inside);
    dailyEachTile(p,(x,y,inner)=>{
      if(onWalk(x,y))return {k:'path',c:'slate'};
      const v=mound.get(x+','+y);
      if(v>=0.15)return {h:Math.round(v),w:'none',m:true,z:Math.round(v*100)/100};
      return inner?{k:'bed',c:'gravel'}:null;
    });
  }
};
/* Pure blueprint: preview, start and saved brief all consume the same data.
   Legacy layouts remain available only to older saved briefs. */
const dailySitePlans=new Map();
// a blueprint is pure, so each kind is built once and every caller gets its own copy
function dailySitePlan(kind){
  if(!Object.prototype.hasOwnProperty.call(DAILY_SITES,kind))return null;
  if(!dailySitePlans.has(kind))dailySitePlans.set(kind,buildDailySitePlan(kind));
  return JSON.parse(JSON.stringify(dailySitePlans.get(kind)));
}
function buildDailySitePlan(kind){
  const site=DAILY_SITES[kind]; if(!site)return null;
  const gw=ftToTiles(site.widthFt),gh=ftToTiles(site.lengthFt);
  const p={v:1,kind,label:site.label,description:site.description,
    conditions:site.conditions||'Everything on the site is editable.',gw,gh,
    shape:kind==='corner'?[[0,0],[20,0],[14,16],[0,16]]:null,terrain:{},elevation:{},context:[]};
  if(DAILY_SITE_LAYOUTS[kind]){DAILY_SITE_LAYOUTS[kind](p);return p;}
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    if(!blobOnPlot(x,y,gw,gh,p.shape))continue;
    let k=null,c='soil',h=0,w='none';
    const inner=x>0&&y>0&&x<gw-1&&y<gh-1;
    if(kind==='border')k=y<gh-4?'bed':y<gh-2?'path':null;
    if(kind==='split')k=Math.abs(x-(gw-1)/2)<1.1?'path':inner?'bed':null;
    if(kind==='island'){
      const r=Math.hypot((x-(gw-1)/2)/(gw/2),(y-(gh-1)/2)/(gh/2));
      k=r<.65?'bed':r<.86?'path':null;
    }
    if(kind==='woodland'){
      k=dailyRouteTile(x,y,gh,t=>13.2+2.2*Math.sin((t-1.5)*Math.PI/9))?'path':inner?'bed':null;
      c=k==='path'?'warm':'leaf';
    }
    if(kind==='narrow'){k=y<5?'bed':y<7?'path':null;c=k==='path'?'lime':'soil';}
    // The terrace sits two rows in from the lawn border so its path is three
    // tiles long. On the border itself the path was a one-tile tab, and the
    // organic renderer drew its two sides differently: a tab that short is
    // straightened or kept on a knife edge (0.894 against 0.95 tiles here).
    if(kind==='patio'){
      k=(x>=11&&x<=17&&y>=6&&y<=12)||(x>=14&&x<=15&&y>=12)?'path':inner?'bed':null;
      c=k==='path'?'paver':'mulch';
    }
    if(kind==='slope'){
      k=y>=12&&y<=13?'path':inner&&y<12?'bed':null;
      h=y<4?2:y<8?1:0;w='drystone';
    }
    if(kind==='hollow'){
      const r=Math.hypot((x-7.5)/6,(y-7.5)/5.5);
      k=r<.92?'bed':r<1.3?'path':null;h=k==='bed'?-1:0;
    }
    if(kind==='gravel'){
      k=dailyRouteTile(x,y,gh,t=>9.6+2*Math.cos(t*Math.PI/13))?'path':inner?'bed':null;
      c=k==='path'?'slate':'gravel';
    }
    if(kind==='corner'){
      k=(x>=5&&x<=6&&y>=6)||(y>=5&&y<=6&&x>=5)?'path':inner?'bed':null;
      c=k==='path'?'lime':'soil';
    }
    if(k)p.terrain[x+','+y]={k,c:c==='soil'&&k==='path'?'warm':c};
    if(h)p.elevation[x+','+y]={h,w};
  }
  if(kind==='woodland')p.context.push({id:'canopy-1',s:'serviceberry',v:null,x:7,y:9});
  return p;
}
function dailyStartingPlan(c){return c.sitePlan||dailySitePlan(c.site);}
/* A site's size is authored in feet inside its description, and a saved brief
   keeps its own copy of that text, so the dimension is re-read for display
   rather than rewritten in the data. Imperial comes back byte-identical. */
function dailySiteText(text){
  return String(text||'').replace(/(\d+(?:\.\d+)?) × (\d+(?:\.\d+)?) ft\b/g,
    (whole,w,l)=>metricUnits()?`${fmtFeet(+w,1)} × ${fmtFeet(+l,1)}`:whole);
}
function renderDailySite(prefix,c,resuming=false){
  const p=dailyStartingPlan(c),canvas=$(prefix+'SiteCanvas');
  $(prefix+'SiteSummary').textContent=`${p.label} · ${fmtFeet(p.gw*TILE_IN/12,1)} × ${fmtFeet(p.gh*TILE_IN/12,1)}`;
  $(prefix+'Site').textContent=dailySiteText(p.description)+' '+p.conditions;
  $(prefix+'SiteCaption').textContent=resuming?'Original starting site · your edits are saved in the garden':'Your starting site · everything is editable';
  const legend=$(prefix+'SiteLegend');legend.replaceChildren();
  for(const [kind,label,colour] of dailySiteLegend(p)){
    const span=document.createElement('span'),swatch=document.createElement('i');
    swatch.className='daily-site-swatch '+kind;swatch.setAttribute('aria-hidden','true');
    if(colour)swatch.style.background=colour;
    span.append(swatch,label);legend.appendChild(span);
  }
  canvas.setAttribute('aria-label',p.label+'. '+dailySiteText(p.description)+' '+p.conditions);
  drawDailySitePlan(canvas,p);
}
/* The preview's colours, a step darker than the plan sheet's so the site reads
   at the size of a phone. A material with no tone of its own takes its kind's. */
const DAILY_PATH_TONES={slate:'#7f888a',bluestone:'#8b959b',brick:'#b47b63',paver:'#bdb9b0',porcelain:'#dcd7cd',sandstone:'#d5bf96',lime:'#ddd4be'};
const DAILY_BED_TONES={gravel:'#b8ad8e',leaf:'#97866b',mulch:'#8b6e54',bog:'#77785a'};
function dailySiteTone(t){
  if(!t)return '#b5bc91';
  if(t.k==='water')return t.c==='formal'?'#4e7d8b':'#6f9eac';
  if(t.k==='lawn')return '#c6c189';
  if(t.k==='path')return DAILY_PATH_TONES[t.c]||'#d2c5aa';
  return DAILY_BED_TONES[t.c]||'#ac9272';
}
// what the legend names: only what this site has, each swatch the colour the map uses for it
function dailySiteLegend(p){
  const t=Object.values(p.terrain),e=Object.values(p.elevation),most=k=>{
    const n=new Map();for(const r of t)if(r.k===k&&!r.x)n.set(r.c,(n.get(r.c)||0)+1);
    let best=null;for(const [c,v] of n)if(!best||v>best[1])best=[c,v];
    return best?dailySiteTone({k,c:best[0]}):null;
  };
  let bare=false;
  for(let y=0;y<p.gh&&!bare;y++)for(let x=0;x<p.gw;x++)if(blobOnPlot(x,y,p.gw,p.gh,p.shape)&&!p.terrain[x+','+y]){bare=true;break;}
  return [['bed','Planting beds',most('bed')],
    ...(t.some(r=>r.k==='lawn')?[['meadow','Long meadow',most('lawn')]]:[]),
    ...(bare?[['lawn','Lawn',dailySiteTone(null)]]:[]),
    ['path','Paths / terrace',most('path')],
    ...(t.some(r=>r.k==='water')?[['water','Water',most('water')]]:[]),
    ...(t.some(r=>r.x)?[['bridge','Footbridge',null]]:[]),
    ...(p.context.length?[['tree',p.context.length>1?'Existing tree canopies':'Existing tree canopy',null]]:[]),
    ...(e.some(r=>!r.m&&!r.s)?[['grade','Grade changes',null]]:[]),
    ...(e.some(r=>r.s)?[['steps','Steps',null]]:[]),
    ...(e.some(r=>r.m)?[['mound','Mounded ground',null]]:[])];
}
function drawDailySitePlan(canvas,p){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  canvas.height=Math.round(Math.min(440,Math.max(200,canvas.width*(p.gh+3)/(p.gw+3))));
  const W=canvas.width,H=canvas.height,scale=Math.min((W-68)/p.gw,(H-56)/p.gh);
  const ox=(W-p.gw*scale)/2,oy=(H-p.gh*scale)/2+7;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#f3efe4';ctx.fillRect(0,0,W,H);
  const outline=p.shape||[[0,0],[p.gw,0],[p.gw,p.gh],[0,p.gh]];
  const trace=()=>{ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(ox+x*scale,oy+y*scale):ctx.moveTo(ox+x*scale,oy+y*scale));ctx.closePath();};
  ctx.save();trace();ctx.clip();
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    if(!blobOnPlot(x,y,p.gw,p.gh,p.shape))continue;
    const key=x+','+y,t=p.terrain[key],e=p.elevation[key];
    const X=ox+x*scale,Y=oy+y*scale;
    ctx.fillStyle=dailySiteTone(t);
    ctx.fillRect(X,Y,scale+.5,scale+.5);
    if(t&&t.x){
      // a footbridge: its boards across the water, the way the garden lays them
      ctx.fillStyle=t.x==='stepping'?'#aaa498':'#9b7a52';ctx.fillRect(X,Y,scale+.5,scale+.5);
      ctx.strokeStyle='rgba(60,42,26,.55)';ctx.lineWidth=1;
      for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(X,Y+i*scale/4);ctx.lineTo(X+scale,Y+i*scale/4);ctx.stroke();}
    }
    if(e){
      const lift=e.m?e.z:e.h;
      ctx.fillStyle=lift<0?'rgba(47,66,49,.15)':`rgba(255,248,215,${Math.min(2,lift)*.11+Math.max(0,lift-2)*.05})`;
      ctx.fillRect(X,Y,scale+.5,scale+.5);
    }
    if(e&&e.s){
      // a step: treads drawn across the way it goes down
      const [sx,sy]=ELEV_DIRS[e.s-1];ctx.strokeStyle='rgba(70,62,50,.6)';ctx.lineWidth=1;
      for(const f of [.33,.66]){ctx.beginPath();
        if(sx)ctx.moveTo(X+f*scale,Y),ctx.lineTo(X+f*scale,Y+scale);else ctx.moveTo(X,Y+f*scale),ctx.lineTo(X+scale,Y+f*scale);ctx.stroke();}
    }
    /* Trace grade boundaries, including the lower hollow, without implying water.
       Soft earth has no face to draw, so its levels are dashed, like contours. */
    const height=e?.h||0;
    ctx.strokeStyle='#655d4c';
    for(const [dx,dy,ax,ay,bx,by] of [[1,0,1,0,1,1],[0,1,0,1,1,1]]){
      const n=p.elevation[(x+dx)+','+(y+dy)];
      if(!blobOnPlot(x+dx,y+dy,p.gw,p.gh,p.shape)||(n?.h||0)===height)continue;
      const soft=(e?.m||!e)&&(n?.m||!n);
      ctx.lineWidth=soft?1:1.4;ctx.setLineDash(soft?[3,3]:[]);
      ctx.beginPath();ctx.moveTo(ox+(x+ax)*scale,oy+(y+ay)*scale);ctx.lineTo(ox+(x+bx)*scale,oy+(y+by)*scale);ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  for(const tree of p.context){
    const x=ox+(tree.x+.5)*scale,y=oy+(tree.y+.5)*scale;
    ctx.beginPath();ctx.arc(x,y,woodyRadiusTiles(plantDef(tree.s,tree.v))*scale,0,Math.PI*2);
    ctx.fillStyle='rgba(55,92,63,.24)';ctx.fill();ctx.strokeStyle='#49684a';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle='#554330';ctx.fill();
  }
  ctx.restore();trace();ctx.strokeStyle='#697154';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='#45533e';ctx.font='22px sans-serif';ctx.textAlign='center';
  ctx.fillText(fmtFeet(p.gw*TILE_IN/12,1),W/2,19);
  ctx.textAlign='left';ctx.fillText('N ↑',12,24);
  ctx.save();ctx.translate(ox-12,oy+p.gh*scale/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(fmtFeet(p.gh*TILE_IN/12,1),0,0);ctx.restore();
}
function dailyDateKey(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
/* The key is for storage; people read the long form. The start screen said
   "Monday, September 28" while the brief and the history said "2026-09-28".
   The year shows only when it is not this one, except on a shared image,
   which outlives the year it was posted in. */
function dailyDateLabel(key,withYear=false){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));
  if(!m)return String(key||'');
  const date=new Date(+m[1],+m[2]-1,+m[3]), opts={weekday:'long',month:'long',day:'numeric'};
  if(withYear||date.getFullYear()!==new Date().getFullYear())opts.year='numeric';
  return date.toLocaleDateString(undefined,opts);
}
function dailyChallengeFor(date=new Date()){
  const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/864e5);
  const i=((day%DAILY_THEMES.length)+DAILY_THEMES.length)%DAILY_THEMES.length;
  const variation=((Math.floor(day/DAILY_THEMES.length)%3)+3)%3;
  const theme=DAILY_THEMES[i], {id,season}=theme, [exercise,focus]=theme.exercises[variation];
  const site=DAILY_SITE_ROTATION[id][variation];
  return normalizeDailyChallenge({v:3,id:`${id}-${variation+1}`,date:dailyDateKey(date),site,sitePlan:dailySitePlan(site),season,
    title:`${theme.title}: ${exercise}`,brief:focus,goals:theme.goals,checked:[],
    plants:'Ten suggested plants to get you started. Choose All plants to explore the wider catalog.',
    palette:theme.palette});
}
function todaysChallenge(){ return dailyChallengeFor(); }
function dailyEligiblePalette(c,criteria){
  return (c.palette||[]).filter(ref=>plantRefFitsCriteria(ref,criteria,true));
}
function dailyPlantCount(){
  const c=game.challenge;
  const context=new Map((c?.sitePlan?.context||[]).map(p=>[p.id,plantRefId(p)])),seenContext=new Set();
  let count=0;
  for(const layer of [game.plants,game.bulbs])for(const [key,p] of Object.entries(layer)){
    if(!p||p.removed||!PLANTS[p.s])continue;
    const [x,y]=key.split(',').map(Number); if(!Number.isInteger(x)||!Number.isInteger(y)||!onPlot(x,y))continue;
    // One original tree may move, but copied/replanted trees count as additions.
    if(layer===game.plants&&p.dailySiteId&&context.get(p.dailySiteId)===plantRefId(p)&&!seenContext.has(p.dailySiteId)){
      seenContext.add(p.dailySiteId);continue;
    }
    count++;
  }
  return count;
}
function renderDailyHeading(prefix,c){
  // Split the saved wording for display, never reconstruct it from today's themes.
  const split=c.title.indexOf(': '),theme=split<0?'':c.title.slice(0,split);
  $(prefix+'Theme').textContent=theme;
  $(prefix+'Theme').classList.toggle('hidden',!theme);
  $(prefix+'Title').textContent=split<0?c.title:c.title.slice(split+2);
}
function dailyPlantRole(ref,criteria){
  const roles=plantRoles(ref.s,criteria,ref.v),P=refDef(ref);
  if(roles.includes('canopy'))return 'Overhead structure';
  if(roles.includes('structure'))return 'Woody structure';
  if(roles.includes('matrix'))return 'Connects planting groups';
  if(roles.includes('groundcover'))return 'Ground layer';
  if(P.form==='fern'||P.form==='leafmound')return 'Leaf texture';
  if(roles.includes('architectural'))return 'Strong plant shape';
  if(roles.includes('flower'))return 'Seasonal flowers';
  return 'Foliage contrast';
}
function renderDailyPalette(target,c,criteria){
  const key=JSON.stringify([c.palette,c.season,metricUnits()]);
  if(target._dailyPaletteKey===key){
    Array.from(target.children).forEach((li,i)=>refreshDailyPlantCard(li,c.palette[i],criteria));return;
  }
  target._dailyPaletteKey=key;
  target.replaceChildren();
  for(const ref of c.palette||[]){
    const P=refDef(ref),li=document.createElement('li'),name=document.createElement('strong');
    const art=libCanvas(ref.s,ref.v,c.season,72,80);art.setAttribute('aria-hidden','true');
    art.className='daily-plant-art';
    const copy=document.createElement('div');copy.className='daily-plant-copy';
    name.textContent=plantRefDisplayName(ref);
    const role=document.createElement('span');role.className='daily-plant-role';role.textContent=dailyPlantRole(ref,criteria);
    copy.append(name,role);li.append(art,copy);
    const why=document.createElement('small');why.className='daily-plant-filter';why.textContent='Outside your current filters';copy.appendChild(why);
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='Plant details';summary.setAttribute('aria-label',`Plant details: ${P.name}`);
    details.appendChild(summary);
    // Details are read on demand. Use the same exact-reference data and size
    // helpers as the catalog/library; opening them never leaves the brief.
    details.ontoggle=()=>{
      if(!details.open||details.dataset.filled)return;
      details.dataset.filled='1';
      const latin=document.createElement('p');latin.className='daily-plant-latin';latin.textContent=P.latin;details.appendChild(latin);
      const description=document.createElement('p');description.textContent=P.note||P.blurb;details.appendChild(description);
      const facts=document.createElement('dl');
      for(const [label,value] of [['Mature size',matureSizeText(P,false)],['Spacing',plantMeasure(P.space,false)+' on center'],
        ['Hardiness',`Zones ${P.zones[0]}–${P.zones[1]}`],['Light',P.sun==='full'?'Full sun':'Part shade'],
        ['Moisture',P.type==='water'||P.wades?(P.marginal||P.wades?'Pond margin or wet ground':'Open water'):
          ({dry:'Dry soil',avg:'Average moisture',moist:'Moist soil'}[P.moist]||P.moist)],['Bloom',libraryBloomText(P)]]){
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;facts.append(dt,dd);
      }
      details.append(facts,buildPlantGuidance(ref));
    };
    li.appendChild(details);
    target.appendChild(li);
    refreshDailyPlantCard(li,ref,criteria);
  }
}
function refreshDailyPlantCard(li,ref,criteria){
  const unavailable=!plantRefFitsCriteria(ref,criteria,true);
  li.classList.toggle('daily-plant-unavailable',unavailable);
  li.querySelector('.daily-plant-filter').classList.toggle('hidden',!unavailable);
  li.querySelector('.daily-plant-role').textContent=dailyPlantRole(ref,criteria);
}
let dailySelection=null, dailyResumeId=null, dailyOpening=0, dailyStarting=false, dailyCriteria=null, dailyReady=false;
function renderDailyEntry(){
  const c=dailySelection; if(!c)return;
  const resuming=!!dailyResumeId;
  // a saved design is a picture and one button: its panel is the narrower one
  $('dailyPanel').classList.toggle('is-resuming',resuming);
  $('dailyResume').classList.toggle('hidden',!resuming);
  $('dailyBriefSummary').classList.toggle('hidden',!resuming);
  $('dailyBriefDetails').classList.toggle('is-resuming',resuming);
  renderDailyHeading('daily',c); $('dailyBrief').textContent=c.brief;
  $('dailyPlants').textContent=c.plants;
  $('dailyPreviewSeason').textContent=`Plant previews shown in ${c.season.toLowerCase()}. Open Plant details for size and growing conditions.`;
  renderDailySite('daily',c,!!dailyResumeId);
  renderDailyGoals($('dailyGoals'),c); renderDailyPalette($('dailyPlantList'),c,dailyCriteria);
  $('dailyPaletteDetails').classList.toggle('hidden',!c.palette);
  const available=dailyEligiblePalette(c,dailyCriteria);
  $('dailyPalette').textContent=c.paletteFree?'All plants · current filters still apply':c.palette?`Suggested plants · ${available.length} of ${c.palette.length} match your filters`:
    `Suggested plants · ${challengePaletteSize(c)} choices`;
  $('dailyClimate').textContent=dailyCriteria.zone?`Hardiness filter: zone ${dailyCriteria.zone}.`:'Hardiness filter: all zones. Regional plant guidance still applies.';
  const blocked=dailyReady&&!resuming&&c.palette&&!c.paletteFree&&!available.length;
  $('dailyAvailability').textContent=blocked?'No suggested plants match your filters.':'';
  $('btnDailyResolve').classList.toggle('hidden',!blocked);
  $('btnDailyResolve').textContent=dailyCriteria.zone?'Show all hardiness zones':'Use all plants';
  $('btnDailyStudy').classList.toggle('hidden',!!dailyResumeId||!dailyCriteria.zone);
  $('btnDailyStudy').disabled=!dailyReady;
  $('btnDailyPalette').classList.toggle('hidden',!!dailyResumeId||!c.palette);
  $('btnDailyPalette').disabled=!dailyReady;
  $('btnDailyPalette').textContent=c.paletteFree?'Use suggested plants':'Use all plants';
  $('btnDailyStart').disabled=!dailyReady||(!dailyResumeId&&c.palette&&!c.paletteFree&&!available.length);
}
function refreshChallengePalette(){
  const c=game.challenge;if(!c)return;
  const filters=activeFilters(),available=dailyEligiblePalette(c,filters);
  $('challengePreviewSeason').textContent=`Plant previews shown in ${c.season.toLowerCase()}. Open Plant details for size and growing conditions.`;
  $('challengeClimate').textContent=(c.paletteFree?'All plants. ':'Suggested plants. ')+(filters.zone?`Hardiness filter: zone ${filters.zone}.`:'Hardiness filter: all zones.');
  renderDailyPalette($('challengePlantList'),c,filters);
  $('challengePaletteDetails').classList.toggle('hidden',!c.palette);
  $('challengeAvailability').textContent=c.palette&&!c.paletteFree&&!available.length?'No suggested plants match your filters. Change the garden criteria or choose Use all plants in the plant catalog.':'';
  $('btnChallengeStudy').classList.toggle('hidden',!c.palette||c.paletteFree||!filters.zone||available.length===c.palette.length);
}
function renderDailyGoals(target,c,editable=false){
  target.replaceChildren();
  c.goals.forEach((goal,i)=>{
    const li=document.createElement('li');
    if (editable){
      const label=document.createElement('label'), input=document.createElement('input'), span=document.createElement('span');
      input.type='checkbox'; input.checked=c.checked.includes(i); span.textContent=goal;
      input.onchange=()=>{ c.checked=c.checked.filter(n=>n!==i); if(input.checked)c.checked.push(i); markModelChanged(); };
      label.append(input,span); li.appendChild(label);
    } else li.textContent=goal;
    target.appendChild(li);
  });
}
// Apply only at creation. Reopening always loads the gardener's edited layers.
function prepareDailySite(plan){
  if(typeof plan==='string')plan=dailySitePlan(plan);
  const now=Date.now();
  setPlotShape(plan.shape?.map(p=>p.slice())||null);
  for(const layer of ['terrain','elevation'])for(const [key,p] of Object.entries(plan[layer]))setTile(layer,key,{...p,t:now});
  for(const p of plan.context)setTile('plants',p.x+','+p.y,{...matureWoodyDraft(p.s,p.v),dailySiteId:p.id,t:now});
}
/* Everything a brand-new garden starts from. Both routes in — the plot
   screen and the daily challenge — kept their own copy of this list, and
   the daily one was missing `buildings` and `schemes`: starting a challenge
   after a garden with a shed inherited the shed, and switching schemes
   inside it loaded the previous garden's plantings.

   The layer maps come from GAME_LAYERS rather than being named here, so a
   layer added later is cleared by default instead of waiting to be noticed
   in whichever copy someone remembers to update. What each caller still
   owns is what genuinely differs: the name, the plot, true north, the edge
   style and the plant criteria. */
function resetNewGardenState(){
  resetGardenAutosave();
  game.challenge=null;
  game.savedView=null;   // a new garden opens fitted to the screen
  game.startHere=null;   // and with the start-here checklist fresh
  for (const L of GAME_LAYERS) game[L.k]=L.array?[]:{};
  game.schemes=[]; game.schemeActive=null;
  game.freePlanting=false;
  game.buildingDraft=null; game.buildingStyleDraft=normalizeBuildingStyle();
  game.houseDraft=defaultDraft();
  game.layerVis=defaultLayerVis(); game.underlay=null; game.photoEditing=false;
  game.rot=0; game.siteNorthPreviewDeg=null;
  game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0;
  game.clockSuspended=false; game.pausedAt=0;
  game.previewMode='established';
  game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond';
  game.fenceDraft={style:'black',height:4,gate:false};
  game.lightDraft={type:'path',tone:'warm',finish:'graphite'};
  game.pergolaDraft={mat:'timber',height:8};
  game.firepitDraft={style:'stone',finish:'fieldstone',shape:'round',size:'round36',face:0};
  game.boulderDraft={type:'round1'};
  game.petDraft=normalizePetDraft();
  markGroundChanged({terrain:true});
}
async function openDaily(){
  const request=++dailyOpening, c=todaysChallenge(); dailySelection=c; dailyResumeId=null;
  dailyReady=false;
  $('dailyBriefDetails').open=true;
  $('dailyResumePreview').replaceChildren();
  const prior=normalizeFilters(game.filters);
  dailyCriteria=normalizeFilters({zone:prior.zone,nativeRegion:prior.nativeRegion});
  $('dailyDate').textContent=dailyDateLabel(c.date);
  $('btnDailyStart').textContent='Checking saved designs…'; $('btnDailyStart').disabled=true;
  $('dailyHistory').replaceChildren();
  $('dailyHistoryHeading').classList.add('hidden');
  // The status sits in the sticky footer now, so the standing "a new prompt
  // each day" line moved into the intro rather than riding every screen.
  $('dailyStatus').textContent='';
  renderDailyEntry();
  show('dailyScreen');
  try{
    await pendingSaves(); await worldsIndexChain;
    const [idx0,storedCriteria]=await Promise.all([
      hasStorage?migrateLegacyWorld():[],hasStorage?sGet('hortus:filters'):null
    ]);
    /* Which gardens are daily attempts is on their rows (io.js, worldRowSummary),
       so only the designs this screen shows are read in full: today's attempt
       and the six most recent others (audit P02). It read every garden. Rows
       from before summaries are read once and summarised here. */
    const idx=await backfillWorldSummaries(idx0);
    const attempts=idx.filter(row=>worldSummaryCurrent(row.sum)&&row.sum.daily).sort((a,b)=>b.ts-a.ts);
    const todayRow=attempts.find(row=>row.sum.daily.date===c.date);
    const shownRows=(todayRow?[todayRow]:[]).concat(attempts.filter(row=>row!==todayRow).slice(0,6));
    const saved=await Promise.all(shownRows.map(async row=>{
      const blob=await sGet('hortus:world:'+row.id), challenge=normalizeDailyChallenge(blob&&blob.challenge);
      return challenge?{...row,challenge,criteria:normalizeFilters(blob.design),blob}:null;
    }));
    if(request!==dailyOpening || !screenOpen('dailyScreen'))return;
    const designs=saved.filter(Boolean).sort((a,b)=>b.ts-a.ts);
    const today=designs.find(row=>row.challenge.date===c.date);
    if(today){
      dailyResumeId=today.id;
      // A resumed attempt owns its original wording, even after an app update.
      const savedBrief=today.challenge;
      dailySelection=savedBrief; dailyCriteria=today.criteria;
      $('dailyBriefDetails').open=false;
      $('dailyResumeStatus').textContent=today.challenge.completedAt?'Finished design':'In progress · saved';
      renderDailyResume(today.blob,request,today.id);
      // Nothing in the footer: the status sits beside the picture now, a line above the button.
    } else {
      // Loading an older garden must not replace the user's preference for
      // future challenges. Existing attempts still keep their own criteria.
      const preferred=normalizeFilters(storedCriteria||prior);
      dailyCriteria=normalizeFilters({zone:preferred.zone,nativeRegion:preferred.nativeRegion});
      if(!hasStorage)$('dailyStatus').textContent='Storage is unavailable. This design will last for this session; export the garden file to keep it.';
    }
    for(const row of designs.filter(row=>row.id!==dailyResumeId).slice(0,6))
      $('dailyHistory').appendChild(dailyHistoryCard(row,request));
    $('dailyHistoryHeading').classList.toggle('hidden',!$('dailyHistory').children.length);
  } catch(e){
    if(request!==dailyOpening)return;
    $('dailyStatus').textContent='Saved designs could not be checked. Try opening the daily challenge again.';
    $('btnDailyStart').textContent='Check again'; $('btnDailyStart').disabled=false;
    dailySelection=null; return;
  }
  dailyReady=true;
  // "Continue designing", not "Continue today's design": the footer's status
  // already says the design is saved, and the shorter label fits beside Back on a phone.
  $('btnDailyStart').textContent=dailyResumeId?'Continue designing':'Start designing'; renderDailyEntry();
  $('dailyPanel').scrollTop=0;
}
/* A saved garden's own picture for the daily screen: its map at once, and its
   portrait in place of the map where the portrait is still current. `shown`
   says whether the screen that asked is still the one on screen when the
   portrait has decoded. No garden is loaded and no live scene is rendered. */
function dailyGardenPortrait(blob,shown,use){
  const portrait=normalizeGardenPortrait(blob.portrait);
  const day=Math.floor((blob.elapsedMs||0)/DAY_MS)+(blob.dayOffset||0);
  if(!portrait||portrait.day!==day)return;
  const img=new Image();img.alt='';img.decoding='async';
  img.onload=()=>{if(shown())use(img);};
  img.src=portrait.image;
}
// Reuse the saved-garden preview. Never load a garden or render its live scene here.
function renderDailyResume(blob,request,id){
  const target=$('dailyResumePreview'),thumb=document.createElement('canvas');
  /* The map is drawn to fit its canvas, so the canvas takes the plot's own
     shape and the frame takes the canvas's. A 30 x 12 ft border in a fixed 4:3
     canvas was a strip of garden between two dark bars. */
  const gw=blob.gw||blob.grid||31,gh=blob.gh||blob.grid||31;
  thumb.width=480;thumb.height=Math.round(Math.max(150,Math.min(360,480*gh/gw)));thumb.setAttribute('aria-hidden','true');
  target.style.aspectRatio=thumb.width+' / '+thumb.height;
  drawWorldThumb(thumb,blob);target.replaceChildren(thumb);
  dailyGardenPortrait(blob,()=>request===dailyOpening&&dailyResumeId===id&&screenOpen('dailyScreen'),
    img=>{target.style.aspectRatio='4 / 3';target.replaceChildren(img);});
}
/* An earlier daily design: its picture, the exercise, its theme, and whether it
   was finished and when. It was one line of text, every design alike. */
function dailyHistoryCard(row,request){
  const c=row.challenge,split=c.title.indexOf(': ');
  const b=document.createElement('button');b.className='daily-history-item';b.type='button';
  const thumb=document.createElement('canvas');thumb.className='daily-history-thumb';
  thumb.width=160;thumb.height=120;thumb.setAttribute('aria-hidden','true');
  drawWorldThumb(thumb,row.blob);
  const copy=document.createElement('span');copy.className='daily-history-copy';
  const name=document.createElement('strong');name.textContent=split<0?c.title:c.title.slice(split+2);
  copy.appendChild(name);
  if(split>0){const theme=document.createElement('small');theme.textContent=c.title.slice(0,split);copy.appendChild(theme);}
  const when=document.createElement('small');
  when.textContent=`${c.completedAt?'Finished':'In progress'} · ${dailyDateLabel(c.date)}`;
  copy.appendChild(when);
  b.append(thumb,copy,uiIcon('chevron-right'));
  b.onclick=()=>enterWorld(row.id);
  dailyGardenPortrait(row.blob,()=>request===dailyOpening&&screenOpen('dailyScreen'),img=>{
    img.className='daily-history-thumb';thumb.replaceWith(img);});
  return b;
}
// Freeze the brief displayed on the start screen, even across midnight.
async function startDailyChallenge(){
  if(dailyStarting)return;
  if(!dailySelection){ openDaily(); return; }
  dailyStarting=true; $('btnDailyStart').disabled=true;
  try{
  if(dailyResumeId){ await enterWorld(dailyResumeId); return; }
  const c=normalizeDailyChallenge(dailySelection), site=dailyStartingPlan(c);
  if(c.palette&&!c.paletteFree&&!dailyEligiblePalette(c,dailyCriteria).length){
    renderDailyEntry();return;
  }
  setWorldSize(site.gw,site.gh);
  game.worldId=newWorldId();
  game.worldName=`Daily: "${c.title}"`;
  game.inGarden=true;
  resetNewGardenState();
  game.challenge=c;
  game.discovery=defaultDiscovery();
  game.dayOffset=SEASONS.indexOf(c.season)*DAYS_PER_SEASON;
  prepareDailySite(site);
  game.siteNorthDeg=0;
  game.edgeStyle='organic';                               // daily challenges default to naturalistic edges
  game.design={...dailyCriteria,type:'any'};
  game.filters=normalizeFilters(game.design); updateFilterBtn();
  enterGarden();
  game.trayCat=firstStockedTrayCat(); buildToolTray();   // open on a populated sub-tab for this prompt
  await saveSolo(true);
  } finally { dailyStarting=false; renderDailyEntry(); }
}

/* The menu footer is the only place a user ever reads a version number, so it
   has to come from APP_VERSION rather than being typed into the markup — as a
   fourth hand-kept copy it drifted thirteen releases behind. The crash panel
   already did this correctly (screens.js, reportCrash). */
function syncMenuVersion(){
  const a=document.getElementById('menuVersion'); if (!a) return;
  const txt=`Pocket Prairie v${APP_VERSION}`;   // Credits is its own footer link now (credits.html)
  if (a.textContent!==txt) a.textContent=txt;
}
async function refreshMenuCards(){
  syncMenuVersion();
  const dc=$('btnDaily'); if (dc) dc.querySelector('small').textContent='Today · '+todaysChallenge().title;
  // the Library's own count, so the menu and its search field name one number
  const lb=$('btnLibrary'); if (lb) lb.querySelector('small').textContent=`${libraryAllKeys().length} plants, each drawn in four seasons`;
  const g=$('btnDesign'); if (!g) return;
  const idx=hasStorage ? await migrateLegacyWorld() : [];
  g.querySelector('small').textContent=idx.length
    ? `${idx.length} saved garden${idx.length>1?'s':''} — continue or start another`
    : 'Design your first planting';
  // the thumbnail is a stack once there is more than one garden to open
  const art=$('menuArtGardensWrap'); if (art) art.classList.toggle('stack',idx.length>1);
}

$('btnDesign').onclick=openWorlds;
$('btnDaily').onclick=openDaily;
$('btnDailyStart').onclick=startDailyChallenge;
$('btnDailyPalette').onclick=()=>{
  if(!dailySelection||dailyResumeId)return;
  dailySelection.paletteFree=!dailySelection.paletteFree; renderDailyEntry();
};
function useDailyAnyZone(){
  dailyCriteria={...dailyCriteria,zone:null};
  // This is an explicit preference, even if the gardener leaves before starting.
  game.filters=normalizeFilters({...game.filters,zone:null,
    nativeRegion:dailyCriteria.nativeRegion});
  sSet('hortus:filters',game.filters);
  renderDailyEntry();
}
$('btnDailyStudy').onclick=useDailyAnyZone;
$('btnDailyResolve').onclick=()=>{
  if(!dailySelection||dailyResumeId)return;
  if(dailyCriteria.zone)useDailyAnyZone();
  else dailySelection.paletteFree=true;
  renderDailyEntry();
  if(!$('btnDailyStart').disabled)$('btnDailyStart').focus();
};
/* Both entry points lead to the saved-image screen; reading the brief never
   saves a completion timestamp or prepares an image. */
function syncChallengeFinishButton(done){
  const b=$('btnChallengeFinish'), label=done?'Save & share design':'Finish design';
  // the row is an icon and a name; writing the button's own text would take the icon
  const name=b.querySelector&&b.querySelector('.gm-name');
  (name&&name.parentNode===b?name:b).textContent=label;
  b.classList.toggle('primary',!done);
  document.querySelectorAll('.discovery-challenge-finish').forEach(el=>{el.textContent=label;});
}
$('btnChallengeStudy').onclick=()=>{
  applyGardenCriteria({...game.filters,zone:null},{announce:false});
  markModelChanged(); refreshChallengePalette();
};
const DAILY_SHARE_FORMATS={
  portrait:{label:'Portrait',width:1080,height:1350},
  square:{label:'Square',width:1080,height:1080},
  story:{label:'Story',width:1080,height:1920}
};
let dailyShareImage=null, dailyShareRequest=0, dailyFinishing=false,dailySharing=false;
function syncDailyShareControls(){
  $('btnChallengeDownload').disabled=!dailyShareImage;
  $('btnChallengeCaption').disabled=!dailyShareImage;
  $('btnChallengeShare').disabled=!dailyShareImage||dailySharing;
  $('btnChallengeShare').classList.toggle('hidden',!dailyShareImage?.canShare);
  $('challengeShareFormat').disabled=$('challengeShareSeason').disabled=dailySharing;
}
function clearDailyShare(hide=true){
  dailyShareRequest++;
  if(dailyShareImage)URL.revokeObjectURL(dailyShareImage.url);
  dailyShareImage=null;
  $('challengeImage').removeAttribute('src');$('challengeCaption').value='';
  $('challengeShare').classList.toggle('hidden',hide);
  $('challengeShare').setAttribute('aria-busy','false');
  $('btnChallengeShareRetry').classList.add('hidden');
  $('challengeShareStatus').textContent='';syncDailyShareControls();
}
function openChallengeBrief(){
  const c=game.challenge; if(!normalizeDailyChallenge(c))return;
  closeOverlay('gardenMenu',false); closeOverlay('challengeFinishScreen',false);
  renderDailyHeading('challenge',c);
  $('challengeDate').textContent='Daily design · '+dailyDateLabel(c.date);
  $('challengeBrief').textContent=c.brief;
  renderDailySite('challenge',c,true);
  $('challengePlants').textContent=c.plants;
  renderDailyGoals($('challengeGoals'),c,true);
  refreshChallengePalette();
  const overlay=openOverlay('challengeScreen','#btnChallengeClose');
  // The menu row is hidden once the modal opens; return to its visible owner.
  if(overlay)overlay._returnFocus=$('btnMenu');
}
function openChallengeFinish(){
  const c=game.challenge;if(!c)return;
  closeOverlay('gardenMenu',false);closeOverlay('challengeScreen',false);clearDailyShare();
  $('challengeFinishTitle').textContent=c.completedAt?'Design saved':'Finish design';
  $('challengeFinishName').textContent=c.title;
  $('challengeStatus').textContent='';
  $('btnChallengeSaveRetry').classList.add('hidden');
  const overlay=openOverlay('challengeFinishScreen','#btnChallengeFinishClose');
  if(overlay)overlay._returnFocus=$('btnMenu');
  $('challengeFinishScreen').querySelector('.panel').scrollTop=0;
}
async function finishDailyDesign(){
  if(dailyFinishing||!game.challenge)return;
  openChallengeFinish();
  if(!dailyPlantCount()){
    $('challengeFinishTitle').textContent='Finish design';
    $('challengeStatus').textContent='Add some plants before finishing your design. The prepared site is your starting point.'; return;
  }
  const c=game.challenge, id=game.worldId, prior=c.completedAt,shareRequest=dailyShareRequest;
  dailyFinishing=true; $('btnChallengeFinish').disabled=true;$('btnChallengeSaveRetry').disabled=true;
  $('challengeFinishTitle').textContent='Saving design…';
  try{
    c.completedAt=Date.now(); markModelChanged();
    try{ rememberGardenPortrait(captureGardenPortrait()); }catch(e){ noteError(e,'daily-portrait'); }
    const saved=await saveSolo(true);
    if(game.worldId!==id||game.challenge!==c)return;
    if(!saved){
      c.completedAt=prior; markModelChanged();
      $('challengeFinishTitle').textContent='Design not saved';
      $('btnChallengeSaveRetry').classList.remove('hidden');
      $('challengeStatus').textContent='The finished design could not be saved. Download the image now, and export the garden file from the menu to keep your work.';
    }else{
      $('challengeFinishTitle').textContent='Design saved';
      $('challengeStatus').textContent='Finished and saved to Your gardens.';
      syncChallengeFinishButton(true);
    }
    if(shareRequest===dailyShareRequest){
      await prepareDailyShare();
    }
  } finally { dailyFinishing=false; $('btnChallengeFinish').disabled=false;$('btnChallengeSaveRetry').disabled=false; }
}
function dailyShareMoment(options){
  const current=absDay(),s=SEASONS.indexOf(options.season);
  const day=s<0?current:Math.floor(current/YEAR_DAYS)*YEAR_DAYS+s*DAYS_PER_SEASON+Math.floor(DAYS_PER_SEASON/2);
  return {day,season:SEASONS[Math.floor(day/DAYS_PER_SEASON)%4],atDay:s<0?null:day};
}
function dailyShareTitleLines(ctx,title,width){
  let lines=[];
  for(let size=44;size>=28;size-=2){
    ctx.font=`bold ${size}px serif`;lines=[''];
    for(const word of title.trim().split(/\s+/)){
      const i=lines.length-1, next=lines[i]?lines[i]+' '+word:word;
      if(lines[i]&&ctx.measureText(next).width>width)lines.push(word);else lines[i]=next;
    }
    if(lines.length<=2&&lines.every(line=>ctx.measureText(line).width<=width))return {lines,size};
  }
  lines=lines.slice(0,2);
  lines=lines.map((line,i)=>{
    const chars=Array.from(line);let clipped=i===1;
    while(chars.length&&ctx.measureText(chars.join('')+(clipped?'…':'')).width>width){chars.pop();clipped=true;}
    return chars.join('')+(clipped?'…':'');
  });
  return {lines,size:28};
}
function renderDailyShareCard(c,options,moment){
  const format=DAILY_SHARE_FORMATS[options.format],cv=document.createElement('canvas');
  cv.width=format.width;cv.height=format.height;
  const ctx=cv.getContext('2d');if(!ctx)throw new Error('No share canvas');
  const inset=48,width=cv.width-inset*2,top=options.format==='story'?200:64;
  ctx.fillStyle='#f3efe4';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.fillStyle='#59664d';ctx.font='20px sans-serif';ctx.fillText('POCKET PRAIRIE · DAILY DESIGN',inset,top);
  const title=dailyShareTitleLines(ctx,c.title,width),titleY=top+62;
  ctx.fillStyle='#29362c';ctx.font=`bold ${title.size}px serif`;
  title.lines.forEach((line,i)=>ctx.fillText(line,inset,titleY+i*54));
  const dateY=titleY+(title.lines.length-1)*54+48,imageY=dateY+40;
  ctx.font='23px sans-serif';ctx.fillStyle='#59664d';ctx.fillText(dailyDateLabel(c.date,true)+' · '+moment.season+' · My interpretation',inset,dateY);
  const footerY=cv.height-(options.format==='story'?280:120),imageHeight=footerY-48-imageY;
  const portrait=renderGardenPortrait(width,imageHeight,moment.atDay);if(!portrait)throw new Error('No portrait canvas');
  ctx.drawImage(portrait,inset,imageY);
  ctx.fillStyle='#29362c';ctx.font='29px serif';ctx.fillText('A little garden. A new idea every day.',inset,footerY);
  ctx.font='22px sans-serif';ctx.fillStyle='#59664d';ctx.fillText('Made in Pocket Prairie Garden Design',inset,footerY+48);
  return cv;
}
async function prepareDailyShare(){
  clearDailyShare(false);
  const request=dailyShareRequest, c=game.challenge, id=game.worldId;
  if(!c){clearDailyShare();return;}
  const options=normalizeDailyShareOptions(c.share),format=DAILY_SHARE_FORMATS[options.format],moment=dailyShareMoment(options);
  $('challengeShareFormat').value=options.format;$('challengeShareSeason').value=options.season;
  $('challengeImageFrame').style.aspectRatio=format.width+'/'+format.height;
  $('challengeImageFrame').style.maxWidth=options.format==='story'?'260px':'320px';
  $('challengeShare').setAttribute('aria-busy','true');
  $('challengeShareStatus').textContent='Preparing your image…';
  try{
    const cv=renderDailyShareCard(c,options,moment);
    const blob=await new Promise(resolve=>cv.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Image encoding failed');
    if(request!==dailyShareRequest||game.challenge!==c||game.worldId!==id)return;
    const name=`pocket-prairie-${c.date}-${c.id}-${options.format}-${moment.season.toLowerCase()}.png`, url=URL.createObjectURL(blob);
    const file=typeof File==='function'?new File([blob],name,{type:'image/png'}):null;
    let canShare=false;
    try{canShare=!!(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));}catch(e){/* download is always available */}
    dailyShareImage={blob,file,name,url,canShare,worldId:id,title:c.title,format:options.format,season:moment.season};
    $('challengeImage').alt=`${c.title} · ${moment.season} · ${format.label} sharing image`;
    $('challengeImage').src=url;
    $('challengeCaption').value=`My ${c.title} garden for the Pocket Prairie daily design challenge on ${dailyDateLabel(c.date,true)}, shown in ${moment.season.toLowerCase()}.\n#PocketPrairie #GardenDesign`;
    $('challengeShareStatus').textContent=`${format.label} · ${format.width} × ${format.height} PNG · ${moment.season}. `+
      (canShare?'Ready to download or share.':'Ready to download. File sharing isn’t available in this browser.');
    syncDailyShareControls();
  }catch(e){
    if(request===dailyShareRequest){
      $('challengeShareStatus').textContent='The image could not be prepared. Try again; your garden is unchanged.';
      $('btnChallengeShareRetry').classList.remove('hidden');
    }
    noteError(e,'daily-share');
  }finally{
    if(request===dailyShareRequest)$('challengeShare').setAttribute('aria-busy','false');
  }
}
$('challengeShareFormat').onchange=$('challengeShareSeason').onchange=()=>{
  if(!game.challenge||dailySharing)return;
  game.challenge.share=normalizeDailyShareOptions({format:$('challengeShareFormat').value,season:$('challengeShareSeason').value});
  markModelChanged();prepareDailyShare();
};
$('btnChallengeShareRetry').onclick=()=>prepareDailyShare();
$('btnChallenge').onclick=openChallengeBrief;
$('btnChallengeClose').onclick=$('btnChallengeReturn').onclick=()=>closeOverlay('challengeScreen');
$('btnChallengeFinishClose').onclick=$('btnChallengeFinishReturn').onclick=()=>closeOverlay('challengeFinishScreen');
$('btnChallengeFinish').onclick=$('btnChallengeSaveRetry').onclick=finishDailyDesign;
$('btnChallengeDownload').onclick=()=>{
  if(!dailyShareImage||dailyShareImage.worldId!==game.worldId)return;
  const a=document.createElement('a'); a.href=dailyShareImage.url; a.download=dailyShareImage.name;
  document.body.appendChild(a);a.click();a.remove();
  $('challengeShareStatus').textContent='Download requested. If your browser opens the image, use its save-image action. Copy the caption separately when posting.';
};
$('btnChallengeShare').onclick=async()=>{
  const image=dailyShareImage;if(!image?.canShare||image.worldId!==game.worldId||dailySharing)return;
  dailySharing=true;syncDailyShareControls();
  try{
    // The file is already encoded: share() stays in the button's user gesture.
    await navigator.share({files:[image.file],title:image.title});
    if(dailyShareImage===image)$('challengeShareStatus').textContent='Share menu opened. Complete your post in the app you choose.';
  }catch(e){
    if(dailyShareImage===image)$('challengeShareStatus').textContent=e.name==='AbortError'
      ?'Sharing cancelled or no app was chosen. Your image is still ready to download.'
      :'Sharing is unavailable here. Download the image, then choose it in the app where you want to post.';
  }finally{dailySharing=false;syncDailyShareControls();}
};
$('btnChallengeCaption').onclick=async()=>{
  if(!dailyShareImage)return;
  const field=$('challengeCaption');
  try{ await navigator.clipboard.writeText(field.value); toast('Caption copied.'); }
  catch(e){ field.focus(); field.select(); toast('Select and copy this caption.'); }
};
$('btnLibrary').onclick=openLibrary;
// btnGardens is gone: it ran this same handler, so each label was wrong in one
// of the two states the shared screen has.
$('librarySearch').oninput=libraryQueryInput;
$('btnLibraryBack').onclick=libraryBack;
/* A rotation can cross the SHEET/DOCK tier with the library open, and the two
   layouts want different bodies built — the split needs every section and a
   filled detail pane, the phone needs a view state. syncLibraryTier no-ops
   unless the tier actually changed. */
addEventListener('resize', syncLibraryTier);
addEventListener('orientationchange', syncLibraryTier);

/* Worlds-list fallback: a top-down map drawn from the saved garden until its
   first automatic portrait is available. Also stays visible if decoding the
   saved JPEG fails. Opening the list never runs the full garden renderer. */
// Point-in-polygon test against a SAVED garden's OWN shape — never the live
// mask (game.plotShape/onPlot), since a worlds-list row's blob may not be the
// currently loaded garden. Mirrors rebuildPlotMask/onPlot exactly, just
// parameterized off the blob instead of the live globals.
function blobOnPlot(x,y,gw,gh,shape){
  if (x<0||y<0||x>=gw||y>=gh) return false;
  return shape ? polygonContains(x+0.5,y+0.5,shape) : true;
}
function drawWorldThumb(cvs, s){
  const g=cvs.getContext('2d'); if (!g) return;
  const gw=s.gw||s.grid||31, gh=s.gh||s.grid||31;
  const shape=Array.isArray(s.plotShape)?s.plotShape:null;
  const W=cvs.width, H=cvs.height;
  const sc=Math.min(W/gw, H/gh), ox=(W-gw*sc)/2, oy=(H-gh*sc)/2;
  const amb=AMBIENCE.Summer;
  g.clearRect(0,0,W,H);   // odd-aspect plots show the .world-thumb css mat
  if (sc>=1.6){                                   // checker reads only when tiles have pixels
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
      if (!blobOnPlot(x,y,gw,gh,shape)) continue;
      g.fillStyle=amb.grass[(x+y)%2];
      g.fillRect(ox+x*sc, oy+y*sc, sc+0.5, sc+0.5);
    }
  } else { g.fillStyle=amb.grass[0]; g.fillRect(ox,oy,gw*sc,gh*sc); }
  const terr=s.terrain||{};
  for (const k in terr){ const t=terr[k]; if (!t || t.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (x<0||y<0||x>=gw||y>=gh) continue;
    g.fillStyle = t.k==='water' ? waterFill(t,false)
      : t.k==='path' ? pathFill(t,false)
      : t.k==='lawn' ? lawnFill(t,amb) : bedFill(t,amb);
    g.fillRect(ox+x*sc, oy+y*sc, sc+0.5, sc+0.5);
  }
  const houses=Array.isArray(s.houses)?s.houses:(s.house?[s.house]:[]);
  const buildings=Array.isArray(s.buildings)?s.buildings:[];
  for (const b of buildings){
    if (!b || !Array.isArray(b.vertices) || b.vertices.length<3) continue;
    g.save(); g.fillStyle=(b.roof||'#9a5f3a')+(b.status==='proposed'?'88':'cc');
    g.strokeStyle=b.status==='proposed'?'#d79b55':'#3f3329'; g.lineWidth=Math.max(1,sc*.35);
    if (b.status==='proposed') g.setLineDash([2,1]);
    g.beginPath(); b.vertices.forEach(([x,y],i)=>{ if (i) g.lineTo(ox+x*sc,oy+y*sc); else g.moveTo(ox+x*sc,oy+y*sc); }); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  for (const hh of houses){ if (!hh) continue;
    g.fillStyle=hh.wall||'#8a7a60';
    g.fillRect(ox+hh.x*sc, oy+hh.y*sc, (hh.w||2)*sc, (hh.h||2)*sc);
    g.fillStyle=hh.roof||'#9a5f3a';
    g.fillRect(ox+hh.x*sc, oy+hh.y*sc, (hh.w||2)*sc, (hh.h||2)*sc*0.45);
  }
  const dots=(map,woodyBoost)=>{
    for (const k in (map||{})){ const p=map[k]; if (!p || p.removed || !p.s) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      if (x<0||y<0||x>=gw||y>=gh) continue;
      let P=null; try{ P=plantDef(p.s,p.v); }catch(e){}
      if (!P || !P.sea) continue;
      const S=P.sea.Summer||P.sea.Spring||P.sea.Fall||P.sea.Winter||{};
      const woody=isWoodyDef(P);
      g.fillStyle=S.fol||S.bloom||S.seed||'#6f8f5a';
      const r=Math.max(woody?2:1, sc*(woody?(woodyBoost||1.3):0.5));
      g.beginPath(); g.arc(ox+(x+0.5)*sc, oy+(y+0.5)*sc, r, 0, 7); g.fill();
    }
  };
  dots(s.plants,1.3); dots(s.bulbs,0.5);
  g.strokeStyle='rgba(239,230,211,0.25)'; g.lineWidth=1;
  g.strokeRect(ox+0.5,oy+0.5,gw*sc-1,gh*sc-1);
}
// live plant count + the garden's own season, from a save blob (pure — the
// worlds list shows it so a row answers "which garden was this?" unopened).
// The counts read the top-level maps, which are the ACTIVE planting scheme —
// so a row describes the scheme you left the garden in, and `schemes` just
// says how many others are waiting inside.
function worldSaveMeta(s){
  let plants=0;
  for (const k in (s.plants||{})) if (s.plants[k] && !s.plants[k].removed) plants++;
  for (const k in (s.bulbs||{}))  if (s.bulbs[k]  && !s.bulbs[k].removed)  plants++;
  const day=Math.floor((s.elapsedMs||0)/DAY_MS)+(s.dayOffset||0);
  const yearDays=DAYS_PER_SEASON*4;
  const season=SEASONS[Math.floor((((day%yearDays)+yearDays)%yearDays)/DAYS_PER_SEASON)];
  const schemes=(s.schemes && Array.isArray(s.schemes.list)) ? s.schemes.list.length : 1;
  return {plants, season, schemes};
}
function startNewGarden(){
  game.discovery=defaultDiscovery(); openDesignSetup();
}
/* "Today", "Yesterday", then a short date. Every card used to read 11/14/2026,
   most of them the same day, in whichever order the device's locale puts the
   numbers. Counted in calendar days, so 11pm yesterday is Yesterday. */
function worldDateLabel(ts,now=Date.now()){
  const d=new Date(ts), n=new Date(now);
  if (!isFinite(d.getTime())) return '';
  const day=x=>Math.floor(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())/864e5);
  const ago=day(n)-day(d);
  if (ago===0) return 'Today';
  if (ago===1) return 'Yesterday';
  const opts={month:'short',day:'numeric'};
  if (d.getFullYear()!==n.getFullYear()) opts.year='numeric';
  return d.toLocaleDateString(undefined,opts);
}
/* One saved garden, as a card: its picture, its name, and two lines of detail.

   U04: a row used to be a <button> with the Actions <button> inside it, which
   is invalid HTML (interactive content inside a button) and left screen
   readers announcing one control that contained another. The card is a plain
   list item; the garden's NAME is the Open button, and its ::after stretches
   over the whole card (styles.css, .world-open), so the picture and the
   details still open the garden on a click or tap. Actions sits above that
   overlay as a separate button. */
function worldCard(w){
  const row=document.createElement('div'); row.className='world-row'; row.setAttribute('role','listitem');
  const thumb=document.createElement('canvas'); thumb.className='world-thumb';
  thumb.width=280; thumb.height=210;
  thumb.setAttribute('aria-hidden','true');
  const info=document.createElement('span'); info.className='world-info';
  const nm=document.createElement('button'); nm.type='button'; nm.className='wname world-open';
  nm.textContent=w.name||'My garden';
  nm.onclick=()=>enterWorld(w.id);
  const meta=document.createElement('span'); meta.className='meta';
  /* 1.5 was feet-per-tile written as a literal in three places (here and
     twice on the plan sheet). It reads TILE_IN now, so the card cannot start
     lying about a garden's size the day the tile becomes a setting. */
  const ftPerTile=TILE_IN/12;
  // one decimal: a 31-tile side is 46.5 ft, and "47 ft" disagreed with the
  // plot screen the garden was made on
  meta.textContent=`${fmtFeet((w.gw||31)*ftPerTile,1)} × ${fmtFeet((w.gh||31)*ftPerTile,1)} · ${worldDateLabel(w.ts)}`;
  const details=document.createElement('span'); details.className='meta world-details';
  // the size, date and plant count are read with the Open button, not as stray text
  const metaId='world-meta-'+w.id, detailsId='world-details-'+w.id;
  meta.id=metaId; details.id=detailsId;
  nm.setAttribute('aria-describedby',metaId+' '+detailsId);
  info.append(nm,details,meta);
  /* One overflow control per card. Three buttons cost more width than the
     garden's own name had, and every one of them needed stopPropagation to
     avoid opening the garden they sit on. */
  const more=document.createElement('button'); more.className='world-more'; more.type='button';
  setUiIcon(more,'ellipsis');
  more.title='Rename, duplicate or delete this garden';
  more.setAttribute('aria-label',`Actions for ${w.name||'this garden'}`);
  more.setAttribute('aria-haspopup','menu'); more.setAttribute('aria-expanded','false');
  more.onclick=e=>{ e.stopPropagation(); showWorldMenu(more,w); };
  row.append(thumb,info,more);
  /* The details come from the row's summary at once (io.js, worldRowSummary). A
     row from before summaries fills them in from the garden when its picture is
     read, and is summarised for next time by backfillWorldSummaries. */
  const sum=worldSummaryCurrent(w.sum) ? w.sum : null;
  if (sum) fillWorldCardDetails(row,details,sum);
  queueWorldPicture({row, thumb, id:w.id, gen:worldPicGen,
    onBlob: sum ? null : s=>{ const m=worldRowSummary(s); if (m) fillWorldCardDetails(row,details,m); }});
  return row;
}
function fillWorldCardDetails(row,details,sum){
  details.textContent=`${sum.plants} plant${sum.plants===1?'':'s'} · ${sum.season}`;
  if (sum.schemes>1) details.textContent+=` · ${sum.schemes} schemes`;
  /* A daily challenge is an ordinary garden once it is saved, and can be
     renamed like one, so the card says which ones they are. */
  if (sum.daily){   // called once a card: from the row's summary, or else from its garden
    const badge=document.createElement('span'); badge.className='world-badge';
    // short: on a 320px phone the card is 131px wide and the overflow control has the other corner
    badge.textContent=sum.daily.done?'Daily · done':'Daily';
    row.appendChild(badge);
  }
}
/* ---------- card pictures, read as they near the screen (audit P01) ----------
   A card's picture is its saved portrait, or the map drawn from the garden where
   there is none, and either way it means reading the whole garden. So a card asks
   for its garden only when it comes within WORLD_PIC_MARGIN of the list's view,
   and at most WORLD_PIC_PARALLEL are read at a time. The portrait is tried first;
   the map is drawn only where there is no current portrait, or it fails to load
   (it used to be drawn for every card, then covered). `worldPicGen` moves when
   the list is rebuilt, so a read that lands for a card no longer shown paints
   nothing. Without IntersectionObserver every card is read, as before. */
const WORLD_PIC_PARALLEL=3, WORLD_PIC_MARGIN='240px';
let worldPicGen=0, worldPicObserver=null, worldPicQueue=[], worldPicBusy=0;
const worldPicJobs=new WeakMap();
function resetWorldPictures(root){
  worldPicGen++; worldPicQueue=[];
  if (worldPicObserver){ worldPicObserver.disconnect(); worldPicObserver=null; }
  if (typeof IntersectionObserver==='function' && root){
    worldPicObserver=new IntersectionObserver(entries=>{
      for (const e of entries){
        if (!e.isIntersecting) continue;
        worldPicObserver.unobserve(e.target);
        const job=worldPicJobs.get(e.target);
        if (job) worldPicQueue.push(job);
      }
      pumpWorldPictures();
    },{root, rootMargin:WORLD_PIC_MARGIN});
  }
}
function queueWorldPicture(job){
  if (worldPicObserver){ worldPicJobs.set(job.row,job); worldPicObserver.observe(job.row); }
  else { worldPicQueue.push(job); pumpWorldPictures(); }
}
function pumpWorldPictures(){
  while (worldPicBusy<WORLD_PIC_PARALLEL && worldPicQueue.length){
    const job=worldPicQueue.shift();
    if (job.gen!==worldPicGen) continue;
    worldPicBusy++;
    sGet('hortus:world:'+job.id).then(s=>{
      if (!s || job.gen!==worldPicGen) return;
      if (job.onBlob) job.onBlob(s);
      paintWorldPicture(job.thumb,s);
    }).catch(e=>noteError(e,'world-picture')).finally(()=>{ worldPicBusy--; pumpWorldPictures(); });
  }
}
function paintWorldPicture(thumb,s){
  const portrait=normalizeGardenPortrait(s.portrait);
  const day=Math.floor((s.elapsedMs||0)/DAY_MS)+(s.dayOffset||0);
  if (!portrait || portrait.day!==day){ drawWorldThumb(thumb,s); return; }
  const img=new Image(); img.className='world-thumb'; img.alt=''; img.decoding='async';
  img.width=GARDEN_PORTRAIT_WIDTH; img.height=GARDEN_PORTRAIT_HEIGHT;
  img.onload=()=>thumb.replaceWith(img);
  img.onerror=()=>drawWorldThumb(thumb,s);   // a damaged picture still leaves the map
  img.src=portrait.image;
}
/* Nothing saved yet. The two standing actions are still in their usual place;
   this adds the third way in, which the first-run offer makes exactly once and
   which was otherwise gone for good after "Not now". The picture is the menu's
   own garden, copied rather than drawn again. */
function worldsEmptyState(){
  const box=document.createElement('div'); box.className='worlds-empty';
  const art=document.createElement('canvas'); art.width=148; art.height=148; art.setAttribute('aria-hidden','true');
  try{
    const src=$('menuArtGardens'), g=art.getContext && art.getContext('2d');
    if (g && src && src.width) g.drawImage(src,0,0,art.width,art.height);
  }catch(e){}
  const h=document.createElement('h3'); h.textContent='Nothing planted yet';
  const p=document.createElement('p');
  p.textContent='New garden starts one of your own. Import garden opens a file someone shared with you. Or look round a finished one first.';
  const row=document.createElement('div'); row.className='row';
  const demo=document.createElement('button'); demo.type='button'; demo.className='btn'; demo.id='btnWorldsDemo';
  demo.textContent='Open the demo garden';
  demo.onclick=async()=>{ demo.disabled=true; try{ await openDemoGarden(); } finally{ demo.disabled=false; } };
  row.appendChild(demo);
  box.append(art,h,p,row);
  return box;
}
async function openWorlds(){
  await pendingSaves();   // Save & quit may still be writing the new portrait
  await migrateLegacyWorld();
  /* Reconcile before listing: a garden stored without an index row is invisible
     here and still eating the device's quota, and this screen is the only place
     that can hand it back. Normally finds nothing and costs one key scan. */
  const recovered=await adoptOrphanedWorlds();
  const idx=await worldsIndex();
  $('worldsTitle').textContent='Your gardens';
  /* Gardens live in this browser and nowhere else, which is worth saying on the
     one screen that lists them: it is why a garden made on a phone is not on
     the laptop, and what Import garden is for. */
  $('worldsSub').textContent=idx.length
    ? `${idx.length} garden${idx.length===1?'':'s'} · saved on this device`
    : 'Saved on this device';
  $('btnNewWorld').replaceChildren(uiIcon('plus'),document.createTextNode('New garden'));
  const list=$('worldList'); list.innerHTML='';
  resetWorldPictures(list);
  /* An empty list SHOWS this screen rather than skipping it. Bouncing straight
     into the questionnaire hid "Import garden" — the only import control in
     the app — behind a screen a fresh device never reached, so a garden a
     friend shared could not be opened by the person it was sent to. */
  if (idx.length) list.setAttribute('role','list');
  else { list.removeAttribute('role'); list.appendChild(worldsEmptyState()); }
  idx.sort((a,b)=>b.ts-a.ts).forEach(w=>list.appendChild(worldCard(w)));
  show('worldsScreen');
  list.scrollTop=0;
  /* Rows saved before summaries: read once, in the background, so the next
     opening has them. Cards still fill in from their own pictures meanwhile. */
  if (hasStorage && idx.some(w=>!worldSummaryCurrent(w.sum))) backfillWorldSummaries(idx).catch(e=>noteError(e,'world-summaries'));
  // Say so, rather than silently growing the list by one.
  if (recovered.length) toast(recovered.length===1
    ? `Recovered "${recovered[0]}" — it had lost its place in this list.`
    : `Recovered ${recovered.length} gardens that had lost their place in this list.`);
}
async function enterWorld(id){
  /* Adopt the id and the contents together. Assigning game.worldId first and
     awaiting the read second left a window in which an autosave wrote the
     PREVIOUS garden under this id — see the loadingWorld note in io.js.
     loadSolo mutates nothing before its own early return, so a failed load
     leaves the current garden exactly as it was. */
  beginWorldLoad();
  let ok=false;
  try{
    ok=await loadSolo(id);
    if (ok){ game.worldId=id; game.inGarden=true; }
  }
  finally{ endWorldLoad(); }
  if (!ok){ toast('That garden failed to load.'); return false; }
  funnel(FUNNEL_EVENTS.gardenOpened);
  enterGarden();
  // Opening tidies a few things up (enterGarden); none of that is an edit made
  // in this tab, so it must not count as one against another tab's (io.js).
  saveSession.syncRev=game.rev;
  syncStaleBar();
  return true;
}
/* share-a-file: a garden is just a JSON blob, so export it to a file a friend
   can import (no backend). Export wraps the stored world in a small envelope;
   import validates the envelope, writes it as a fresh local world, and lists
   it so it can be opened. */
async function shareCurrentGarden(){
  closeOverlay('gardenMenu');
  if (!game.inGarden || !game.worldId){ toast('Save the garden first, then share it.'); return; }
  /* Export what is ON SCREEN, not what is in storage. This used to save and
     then read the stored copy back, discarding saveSolo's result — so on a
     full device it shared the last blob that HAD saved, silently omitting
     the session's work. That is the path the storage-full warning tells
     people to use to rescue exactly that work, so it is the one that must
     not quietly lie. The save is still attempted, and still warns on its
     own if it fails; the share no longer depends on it. */
  await saveSolo(true);
  const w=buildSaveBlob();
  const env=JSON.stringify({ pocketPrairie:1, v:1, exported:Date.now(), world:w });
  const fname=((game.worldName||w.name||'garden').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase())||'garden';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([env],{type:'application/json'}));
  a.download=fname+'.prairie.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  funnel(FUNNEL_EVENTS.gardenShared);
  toast('Garden file downloaded — send it to a friend to share.');
}
/* One validator and one writer for every garden that arrives from outside this
   device — a friend's exported file and the bundled demo garden are the same
   envelope, so they should not be able to disagree about what a valid garden is.
   Returns the new slot id, or null if the envelope is not one of ours. */
async function installWorldBlob(env, name, reportProblem){
  const problem=gardenFileProblem(env);
  if (problem){ if (reportProblem) reportProblem(problem); return null; }
  const w=JSON.parse(JSON.stringify(env.world));
  /* Mint, store the blob, and add the row as ONE critical section. The id is
     minted against a fresh index (this writes a whole garden to
     hortus:world:<id>, so a repeat would overwrite one), and the row cannot be
     lost to a concurrent write. */
  let id=null;
  const installed=await updateWorldsIndex(async fresh=>{
    id=newWorldId(new Set(fresh.map(x=>x.id)));
    w.name=typeof name==='string' ? name.trim().slice(0,80) : (w.name||'Shared garden');
    if (!(await sSet('hortus:world:'+id, w))){ id=null; return null; }
    const out=fresh.filter(x=>x.id!==id);
    out.push({ id, name:w.name, ts:Date.now(), gw:w.gw||w.grid||31, gh:w.gh||w.grid||31, mode:'design', sum:worldRowSummary(w) });
    return out;
  });
  if (!installed){
    if (reportProblem) reportProblem('The garden could not be imported. Free some device storage and try again.');
    return null;
  }
  return id;
}
function importWorldFile(file){
  if (!file) return;
  if (file.size>GARDEN_FILE_MAX_BYTES){ toast('This garden file is too large to import (maximum 16 MB).','warn'); return; }
  const reader=new FileReader();
  reader.onload=async()=>{
    let env; try{ env=JSON.parse(reader.result); }catch(e){ toast('That file is not readable garden JSON. Export a fresh copy.','warn'); return; }
    const raw=env && env.world && typeof env.world.name==='string' ? env.world.name : 'Shared garden';
    try{
      const id=await installWorldBlob(env, raw.replace(/ \(shared\)$/,'')+' (shared)',msg=>toast(msg,'warn'));
      if (!id) return;
      toast(`Imported "${raw.replace(/ \(shared\)$/,'')} (shared)". Open it below.`);
      await openWorlds();
    }catch(e){ toast('The garden could not be imported. Try selecting the file again.','warn'); noteError(e,'garden-import'); }
  };
  reader.onerror=()=>toast('That garden file could not be read. Try selecting it again.','warn');
  reader.onabort=()=>toast('Garden import was interrupted. Select the file to try again.','warn');
  try{ reader.readAsText(file); }catch(e){ reader.onerror(); }
}
/* The demo garden ships as an ordinary exported garden file. That is the whole
   trick: it needs no bundled format, no separate loader and no seeding code —
   it is authored IN the app, exported, and committed, so replacing it is a
   design job rather than a programming one. See docs/demo-garden.md. */
async function openDemoGarden(){
  let env;
  try{
    const res=await fetch('demo-garden.json',{cache:'no-cache'});
    if (!res.ok) throw new Error('HTTP '+res.status);
    env=await res.json();
  }catch(e){
    noteError(e,'demo-garden');
    toast('The demo garden could not be opened. Start a garden from the menu instead.');
    return false;
  }
  const id=await installWorldBlob(env,'Demo garden');
  if (!id){
    toast('The demo garden could not be opened. Start a garden from the menu instead.');
    return false;
  }
  await enterWorld(id);                 // same path the worlds list uses
  return true;
}
/* Row overflow menu. Delete is the reason this needs care: it used to be a
   two-step arm on the button itself (first press swapped the label to "Sure?",
   second press deleted). That pattern cannot survive a menu, because the menu
   closes on the first press and takes the armed state with it — a naive move
   would leave a Delete that silently does nothing. So the confirmation moves
   into showConfirm, which is the app's idiom for a destructive action anyway,
   and names the garden so you can see which one you are about to lose. */
function closeWorldMenu(){
  const old=document.getElementById('worldMenu'); if (old) old.remove();
  document.querySelectorAll('.world-more[aria-expanded="true"]')
    .forEach(b=>b.setAttribute('aria-expanded','false'));
  document.removeEventListener('pointerdown',worldMenuOutside,true);
  removeEventListener('keydown',worldMenuKey,true);
}
function worldMenuOutside(e){
  const pop=document.getElementById('worldMenu');
  if (!pop) return;
  if (pop.contains(e.target) || (e.target.closest && e.target.closest('.world-more'))) return;
  closeWorldMenu();
}
function worldMenuKey(e){ if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeWorldMenu(); } }
function showWorldMenu(anchor,w){
  const open=document.getElementById('worldMenu');
  closeWorldMenu();
  if (open && open.dataset.for===w.id) return;   // second press on the same row closes it
  const pop=document.createElement('div');
  pop.id='worldMenu'; pop.className='selection-more world-menu';
  pop.dataset.for=w.id; pop.setAttribute('role','menu');
  pop.setAttribute('aria-label',`Actions for ${w.name||'this garden'}`);
  const add=(label,fn,cls)=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    b.setAttribute('role','menuitem'); if (cls) b.className=cls;
    b.onclick=e=>{ e.stopPropagation(); closeWorldMenu(); fn(); };
    pop.appendChild(b);
  };
  const name=w.name||'this garden';
  add('Rename…',()=>renameWorld(w.id));
  add('Duplicate',()=>duplicateWorld(w.id));
  add('Delete…',()=>{
    showConfirm('Delete this garden?',
      `"${name}" and everything planted in it will be removed. This cannot be undone.`,
      'Delete', ()=>{ deleteWorld(w.id); });
  },'danger');
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), w2=pop.offsetWidth||190, h=pop.offsetHeight||140;
  let top=r.bottom+6; if (top+h>innerHeight-8) top=Math.max(8,r.top-h-6);
  pop.style.left=Math.max(8,Math.min(innerWidth-w2-8,r.right-w2))+'px';
  pop.style.top=Math.round(top)+'px';
  anchor.setAttribute('aria-expanded','true');
  document.addEventListener('pointerdown',worldMenuOutside,true);
  addEventListener('keydown',worldMenuKey,true);
  const first=pop.querySelector('button'); if (first) first.focus({preventScroll:true});
}
/* The row and the blob go in ONE write (updateWorldsIndex's {index,del}). Row
   first and blob second used to leave an orphan whenever the blob delete
   failed — and sDel reported success regardless, so the gardener was told
   nothing while adoptOrphanedWorlds brought the garden back next visit. */
async function deleteWorld(id){
  closeWorldMenu();
  const done=await updateWorldsIndex(fresh=>({index:fresh.filter(w=>w.id!==id),
    del:['hortus:world:'+id]}));
  if (!done) toast('That garden could not be deleted. It is still in your list.');
  else announceGardenChange(id);
  await openWorlds();
  return !!done;
}
/* A garden's name is the title block on its printed plan, the header of its
   planting list, the heading in the garden menu and the filename when it is
   shared — and it was written once at btnPlotStart and never again. Meanwhile
   planting schemes rename inline and building footprints rename through
   showPrompt, so the app already had two rename idioms, applied to the two
   nouns that matter least.
   The name lives in BOTH the blob and the index row, so both are written
   inside one updateWorldsIndex callback against a fresh read — the same
   critical-section discipline duplicateWorld uses, and for the same reason. */
async function renameWorld(id){
  const src=await sGet('hortus:world:'+id);
  if (!src){ toast('That garden could not be renamed.'); return; }
  showPrompt('Rename garden','What should this garden be called?',
    src.name||'My garden','Rename', async(raw)=>{
    const name=(raw||'').trim().slice(0,60);
    if (!name || name===(src.name||'')) return;
    let ok=false;
    await updateWorldsIndex(async fresh=>{
      const row=fresh.find(w=>w.id===id); if (!row) return null;
      const blob=await sGet('hortus:world:'+id); if (!blob) return null;
      blob.name=name;
      if (!(await sSet('hortus:world:'+id,blob))) return null;
      /* A rename is a change to the stored garden, so it takes a new stamp:
         another tab with this garden open would otherwise save its old name
         straight back over the new one (io.js, "a garden open in two tabs"). */
      const stamp=newId('s');
      row.name=name; row.stamp=stamp; ok=true;
      if (saveSession.syncId===id) saveSession.stamp=stamp;
      return fresh;
    });
    if (!ok){ toast('That garden could not be renamed.'); return; }
    announceGardenChange(id);
    // the open garden holds its own copy of the name for the plan/list headers
    if (game.worldId===id) game.worldName=name;
    toast(`Renamed to "${name}".`);
    openWorlds();
  });
}
async function duplicateWorld(id){
  const src=await sGet('hortus:world:'+id);
  if (!src){ toast('That garden could not be duplicated.'); return; }
  const copy=JSON.parse(JSON.stringify(src));
  const base=(copy.name||'My garden').replace(/ copy(?: \d+)?$/i,'');
  /* Duplicate is the one control a gardener can realistically double-tap, so
     the whole operation — the sibling-name count, the id, the blob and the row
     — runs against a single fresh read. Reading names outside this section is
     what made two rapid duplicates come out identically titled. */
  let name=null;
  await updateWorldsIndex(async fresh=>{
    name=copyGardenName(base,fresh);
    const newIdv=newWorldId(new Set(fresh.map(w=>w.id)));
    copy.name=name;
    copy.savedAt=Date.now();
    if (!(await sSet('hortus:world:'+newIdv,copy))){ name=null; return null; }
    const next=fresh.filter(w=>w.id!==newIdv);
    next.push({id:newIdv,name,ts:Date.now(),gw:copy.gw||copy.grid||31,gh:copy.gh||copy.grid||31,
      mode:'design',sum:worldRowSummary(copy)});
    return next;
  });
  if (!name){ toast('That garden could not be duplicated.'); return; }
  toast(`Duplicated "${base}".`);
  openWorlds();
}
$('btnNewWorld').onclick=startNewGarden;
if ($('btnImport')) $('btnImport').onclick=()=>$('importFile').click();
if ($('importFile')) $('importFile').onchange=e=>{ importWorldFile(e.target.files&&e.target.files[0]); e.target.value=''; };
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ show('menuScreen'); });

function enterGarden(){
  closeOverlay('challengeFinishScreen',false); closeOverlay('challengeScreen',false);
  beginGardenOpen(); // viewport setup can request a draw before the garden is ready
  show(''); $('hud').classList.remove('hidden');
  cnv.classList.remove('hidden'); mcnv.classList.add('hidden');
  releaseMenuBorder();
  setActiveCanvas(cnv);
  setViewportFill('#4b5044');
  resetSelectionState();
  resetTerraceTouched();   // what the Terrace panel changes on a tap belongs to the last garden
  hidePlantCard();     // a card about the last garden's plant would describe nothing here
  game.ruler=null;
  resetSeasonFade();   // never crossfade from a previous garden's last frame
  cancelPendingSkip(); // nor land a Skip meant for it
  game.tool='hand'; game.toolVar=null; game.clockSuspended=false; game.startTs=Date.now();
  game.previewMode=game.previewMode||'established';
  game.woodyAge='mature';                       // designers plan around existing/mature trees
  game.pausedAt=Date.now();                     // a planner opens with the clock held
  document.body.classList.add('design-mode');
  resetZoomFloor(); userZoom=1; calcZoom();   // this garden's own floor is found when it is fitted or restored
  let groundReset=false;
  if (!Array.isArray(game.houses)){ game.houses=[]; groundReset=true; }
  if (!game.elevation){ game.elevation={}; groundReset=true; }
  if (!game.fences) game.fences={};
  if (!game.lights) game.lights={};
  if (!game.firepits) game.firepits={};
  if (!game.boulders) game.boulders={};
  if (!game.pets) game.pets={};
  if (!game.pots) game.pots={};
  if (!game.seats) game.seats={};
  if (!game.ornaments) game.ornaments={};
  if (!game.buildings) game.buildings=[];
  ensureSchemes();   // every garden runs on at least one planting scheme
  if (!game.houseDraft) game.houseDraft=draftFromHouses();
  game.buildingDraft=null;
  game.buildingStyleDraft=normalizeBuildingStyle(game.buildingStyleDraft);
  game.fenceDraft=normalizeFenceDraft(game.fenceDraft);
  game.lightDraft=normalizeLightDraft(game.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(game.firepitDraft);
  game.boulderDraft=normalizeBoulderDraft(game.boulderDraft);
  game.petDraft=normalizePetDraft(game.petDraft);
  game.edgeStyle=edgeStyleId(game.edgeStyle);
  game.bedStyle=bedStyleId(game.bedStyle);
  game.actX=SPAWNX; game.actY=SPAWNY;   // free camera centred on the plot
  snapCam();
  /* Where it was left, or the whole plot. The usable rect is measured fresh:
     the HUD has only just been shown, and a cached answer from the last garden
     can describe a library that was open then and is shut now. */
  invalidateUsableRect();
  let fitted=false;
  if (!restoreGardenView(game.savedView)) fitPlot(), fitted=true;
  game.savedView=null;
  if (groundReset) markGroundChanged();
  game.lastDay=absDay();
  undoStack=[]; redoStack=[]; updateUndoBtn();
  buildToolTray();
  buildCanvasTools();
  updateCompass();
  $('worldLabel').textContent = game.worldName||'My garden';
  $('btnChallenge').classList.toggle('hidden',!game.challenge);
  $('btnChallengeFinish').classList.toggle('hidden',!game.challenge);
  syncChallengeFinishButton(!!game.challenge?.completedAt);
  gardenOpening.ready=true;
  if (fitted) settleOpeningFit();   // the chrome it was fitted to has not come to rest yet
  if (game.challenge)
    setTimeout(()=>{ if (game.challenge){
      toast(game.challenge.paletteFree?'All plants — current filters still apply.':'Suggested plants selected. Choose Use all plants in the catalog to explore more.');
    } }, 450);
  // Beat 1. The time coach used to fire here too, 900ms in; it is beat 3 now
  // and waits until there is a planting worth running a year over.
  setTimeout(coachBeatEnter,900);
}
/* the plot screen: size a brand-new solo garden in real-world dimensions.
   Everything here is FEET internally — see plotFt/setPlotField — whatever unit
   the fields are labelled in. */
/* Width and length in FEET — the model side, whatever the gardener reads.
   The imperial name is the fraction of an acre; the metric name is the area in
   square metres, because "1/5 acre" is not a size anybody outside the US can
   picture and converting it ("0.08 ha") is worse. */
const PLOT_PRESETS=[
  {label:'Small yard', metric:'Small yard', w:46, l:46},
  {label:'1/10 acre', metric:'400 sq m', w:66, l:66},
  {label:'1/5 acre',  metric:'800 sq m', w:93, l:93},
  {label:'1/4 acre',  metric:'1,000 sq m', w:104, l:104},
];
function plotPresetLabel(p){ return metricUnits()?p.metric:p.label; }
/* What a size chip leads with: the side it really builds, in the reader's
   units. The first chip was called "Classic", which is a name for a plot only
   to whoever remembers the 31-tile default; "46.5 × 46.5 ft" is a size. */
function plotPresetSize(p){
  const side=ft=>ftToDisplay(ftToTiles(ft)*TILE_IN/12,1);
  // the unit is in the row's label ("Size, feet"), as it is for the two fields
  return `${side(p.w)} × ${side(p.l)}`;
}
const FT_MIN=24, FT_MAX=200; // 16..134 tiles per side
/* plotNorthSet: north was chosen on the New garden page (the dial dragged, or
   the dialog applied), so the garden opens with Start here's first step ticked
   and is not asked the same question twice. */
let plotNorthDraft=0, plotNorthSet=false, siteNorthEditorContext=null, siteNorthEditorDraft=0;
function siteNorthEdgeName(value){
  const deg=normalizeSiteNorthDeg(value), names={0:'top',90:'right',180:'bottom',270:'left'};
  return names[deg]||null;
}
function siteNorthSummary(value){
  const deg=normalizeSiteNorthDeg(value), edge=siteNorthEdgeName(deg);
  return edge ? `North at ${edge} · ${deg}°` : `North · ${deg}° clockwise from top`;
}
/* The North button under the plot diagram: which side of the plot north is on,
   in words, beside an arrow that turns with it. */
function plotNorthText(value){
  const deg=normalizeSiteNorthDeg(value), edge=siteNorthEdgeName(deg);
  return edge ? `${edge[0].toUpperCase()+edge.slice(1)} of the plot` : `${deg}° from the top`;
}
function updatePlotNorthSummary(){
  const label=$('plotNorthLabel'), btn=$('btnPlotNorth'), arrow=btn&&btn.querySelector&&btn.querySelector('.north-summary-arrow');
  if (label) label.textContent=plotNorthText(plotNorthDraft);
  if (arrow && arrow.style && arrow.style.setProperty) arrow.style.setProperty('--north-deg',`${normalizeSiteNorthDeg(plotNorthDraft)}deg`);
}
function updateSiteNorthEditor(){
  const deg=normalizeSiteNorthDeg(siteNorthEditorDraft), edge=siteNorthEdgeName(deg);
  $('siteNorthRange').value=deg; $('siteNorthNumber').value=deg;
  $('siteNorthPreview').style.setProperty('--north-deg',`${deg}deg`);
  $('siteNorthReadout').textContent=edge
    ? `North points toward the ${edge} edge · ${deg}°.`
    : `North points ${deg} degrees clockwise from the top edge.`;
  document.querySelectorAll('[data-north-deg]').forEach(b=>{
    const on=+b.dataset.northDeg===deg; b.classList.toggle('sel',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function setSiteNorthEditorDraft(value){
  siteNorthEditorDraft=normalizeSiteNorthDeg(value);
  if (siteNorthEditorContext==='garden') previewSiteNorthDeg(siteNorthEditorDraft);
  updateSiteNorthEditor();
}
function openSiteNorthEditor(context){
  siteNorthEditorContext=context==='plot'?'plot':'garden';
  if (siteNorthEditorContext==='garden') clearSiteNorthPreview();
  siteNorthEditorDraft=siteNorthEditorContext==='plot'?plotNorthDraft:normalizeSiteNorthDeg(game.siteNorthDeg);
  updateSiteNorthEditor(); openOverlay('siteNorthScreen','#siteNorthRange');
}
function cancelSiteNorthEditor(){
  if (siteNorthEditorContext==='garden') clearSiteNorthPreview();
  siteNorthEditorContext=null; closeOverlay('siteNorthScreen');
}
function applySiteNorthEditor(){
  const context=siteNorthEditorContext;
  if (context==='plot'){
    plotNorthDraft=normalizeSiteNorthDeg(siteNorthEditorDraft); plotNorthSet=true; updatePlotNorthSummary();
    drawPlotShapeEditor();                    // the diagram's dial mirrors the applied bearing
  } else if (context==='garden'){
    const changed=setSiteNorthDeg(siteNorthEditorDraft);
    markStartStep('north');   // confirming north is the tick, even when north is up
    buildToolTray(); refreshCanvasTools();
    if (changed && game.inGarden) saveSolo(true);
    toast('North set. Sun and shade directions updated.');
  }
  siteNorthEditorContext=null; closeOverlay('siteNorthScreen');
}
/* FT_MIN/FT_MAX are the clamp in FEET and stay that way — the plot is a
   number of tiles and the tile is 18 inches, so the real limits do not move
   when the label does. Only the field is converted. */
/* Every unit word, bound and step that is typed into index.html rather than
   produced by a formatter. Three fields take a real dimension FROM the
   gardener, and each needs three things kept in step with the preference: the
   word beside it, the min/max (which live in feet in the model and have to be
   restated in the field's own unit), and a step coarse enough to be usable and
   fine enough to reach a real size. Called on load, on a units change, and
   whenever a screen carrying one of these opens. */
function syncUnitLabels(){
  const metric=metricUnits();
  const set=(id,txt)=>{ const el=$(id); if (el && el.textContent!==txt) el.textContent=txt; };
  const attrs=(id,min,max,step)=>{ const el=$(id); if (!el) return;
    el.min=String(min); el.max=String(max); el.step=String(step); };

  set('plotWLabel',`Width, ${lengthUnitWord()}`);
  set('plotLLabel',`Length, ${lengthUnitWord()}`);
  set('ngSizeLab',`Size, ${lengthUnitWord()}`);
  /* FT_MIN/FT_MAX are the real limits; the field just restates them. Rounding
     INWARD matters — a metric max of 61 m rounded up to 62 would let the field
     offer a plot plotFt then silently clamps back, which reads as the app
     ignoring what you typed. */
  // half a foot in imperial too: a tile is 1.5 ft, so 46.5 is a real plot
  // side, and a step of 1 marked the field invalid the moment it snapped there
  attrs('plotW', Math.ceil(ftToDisplay(FT_MIN,2)), Math.floor(ftToDisplay(FT_MAX,2)), 0.5);
  attrs('plotL', Math.ceil(ftToDisplay(FT_MIN,2)), Math.floor(ftToDisplay(FT_MAX,2)), 0.5);

  set('plotTileSize',tileSizeText());
  set('sitePhotoWidthUnit',lengthUnit());
  attrs('sitePhotoWidth', metric?1:3, metric?300:1000, metric?0.1:0.5);
  set('sitePhotoKnownUnit',lengthUnit());
  attrs('sitePhotoKnownDistance', metric?0.2:0.5, metric?600:2000, metric?0.1:0.5);

  /* The size chips stay up across a units change (settings can open over this
     page from the menu's gear only after leaving it, but the preference can
     also move in another tab), so they are relabelled in place. */
  for (const c of plotPresetChips){ c.size.textContent=plotPresetSize(c.p); c.cap.textContent=plotPresetLabel(c.p); }
}
/* The size chips' two lines, kept so syncUnitLabels can rewrite them. */
let plotPresetChips=[];
function plotFt(id){ const ft=displayToFt($(id).value); return Math.max(FT_MIN,Math.min(FT_MAX,Number.isFinite(ft)?ft:46)); }
/* A plot is a whole number of 18-inch tiles, so every side is a multiple of
   1.5 ft — and that, not the number typed, is the garden that gets built. The
   screen used to quote three different sizes for one plot: 46 typed, 47 on the
   diagram (31 tiles is 46.5 ft, rounded), and 2,116 sq ft in the note (46 x 46,
   when 46.5 x 46.5 is 2,162). Everything now reads plotRealFt, and a field
   snaps to it when you finish typing — at one decimal, which is what a half
   foot needs and what the imperial field used to round away. */
function plotRealFt(id){ return ftToTiles(plotFt(id))*TILE_IN/12; }
function setPlotField(id,ft){ $(id).value=ftToDisplay(ftToTiles(ft)*TILE_IN/12,1); }
/* ---------- lot-shape editor (plot setup) ----------
   A pending 4-corner shape drafted BEFORE the world exists — btnPlotStart
   applies it via setPlotShape only after setWorldSize (which always clears
   any shape). Pure helpers are top-level for the headless tests; validation
   mirrors setPlotShape's rules against the PENDING gw/gh, reusing the same
   plotEdgesCross/polygonContains the world-side validator uses. */
let pendingPlotShape=null, plotShapeDrag=null;
function defaultPlotShapeVerts(gw,gh){ return [[0,0],[gw,0],[gw,gh],[0,gh]]; }
/* FEET, still — the canvas formats them at draw time. Kept numeric because
   the shape validator and the tests read these as lengths, not as captions. */
/* To the nearest half foot, not the nearest foot: every straight side is a
   multiple of 1.5 ft, and rounding 46.5 to 47 is how the diagram came to
   disagree with the field beside it. */
function plotShapeSideLengthsFt(verts){
  return verts.map((v,i)=>{ const w=verts[(i+1)%verts.length];
    return Math.round(Math.hypot(w[0]-v[0],w[1]-v[1])*TILE_IN/12*2)/2; });
}
function plotShapeSnap(px,py,gw,gh){
  return [Math.max(0,Math.min(gw,Math.round(px))), Math.max(0,Math.min(gh,Math.round(py)))];
}
function plotShapeQuadOk(verts,gw,gh){
  if (!Array.isArray(verts)||verts.length!==4) return false;
  if (verts.some(([x,y])=>x<0||y<0||x>gw||y>gh)) return false;
  if (plotEdgesCross(verts[0],verts[1],verts[2],verts[3])) return false;
  if (plotEdgesCross(verts[1],verts[2],verts[3],verts[0])) return false;
  let n=0;
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) if (polygonContains(x+0.5,y+0.5,verts)) n++;
  return n>=9;
}
function plotShapeIsRect(verts,gw,gh){
  const d=defaultPlotShapeVerts(gw,gh);
  return verts.every((v,i)=>v[0]===d[i][0]&&v[1]===d[i][1]);
}
function plotEdgeResizeTiles(axisVal){ // one axis of an edge-resize drag -> clamped whole tiles
  return Math.max(ftToTiles(FT_MIN), Math.min(ftToTiles(FT_MAX), Math.round(axisVal)));
}
function plotDialDeg(dx,dy){ // pointer offset from the dial center -> bearing, snapped to 5°
  const deg=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  return Math.round(deg/5)*5%360;
}
function plotShapeMetrics(){
  // asymmetric right pad keeps a gutter for the north dial so a wide plot's
  // corner handle never sits under it
  const cvs=$('plotShapeCanvas'), gw=ftToTiles(plotFt('plotW')), gh=ftToTiles(plotFt('plotL'));
  const cssW=cvs.clientWidth||300, cssH=cvs.clientHeight||236;
  const padL=30,padR=60,padT=30,padB=34;
  const sc=Math.min((cssW-padL-padR)/gw,(cssH-padT-padB)/gh);
  return {cvs,gw,gh,cssW,cssH,sc,
    ox:padL+((cssW-padL-padR)-gw*sc)/2, oy:padT+((cssH-padT-padB)-gh*sc)/2,
    dial:[cssW-28,30]};
}
function drawPlotShapeEditor(){
  const cvs=$('plotShapeCanvas');
  if (!cvs || !cvs.clientWidth) return;                  // plot screen not laid out
  // during a drag, draw with the metrics frozen at pointerdown so the fit
  // doesn't re-scale under the cursor while an edge resize changes the plot
  const m=(plotShapeDrag&&plotShapeDrag.m)||plotShapeMetrics();
  const {cssW,cssH,sc,ox,oy}=m;
  const gw=ftToTiles(plotFt('plotW')), gh=ftToTiles(plotFt('plotL'));
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if (cvs.width!==Math.round(cssW*dpr)||cvs.height!==Math.round(cssH*dpr)){
    cvs.width=Math.round(cssW*dpr); cvs.height=Math.round(cssH*dpr); }
  const g=cvs.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,cssW,cssH);
  const P=(v)=>[ox+v[0]*sc, oy+v[1]*sc];
  const verts=(plotShapeDrag&&plotShapeDrag.verts)||pendingPlotShape||defaultPlotShapeVerts(gw,gh);
  const invalid=!!(plotShapeDrag&&plotShapeDrag.type==='corner'&&!plotShapeDrag.valid);
  /* Every line here is the theme's ink at an alpha, where it was a cream
     literal: on paper the outline, the grid and the dial's caption were cream
     on cream and the plot was a green smudge with four gold dots. The lot's
     green and the handles' gold read on both surfaces; gold deepens on paper,
     as --bronze does, where the pale one measures about 2:1. */
  const ink=uiInk('--icon-ink'), halo=uiInk('--icon-halo'), light=resolvedTheme()==='light';
  const gold=light?'#a2581f':'#daa54a', goldHot=light?'#c97f3f':'#f0cd8b';
  // bounding rectangle + a light tile grid every 4 tiles for scale
  g.strokeStyle=ink; g.globalAlpha=.24; g.setLineDash([4,4]); g.lineWidth=1;
  g.strokeRect(ox,oy,gw*sc,gh*sc); g.setLineDash([]);
  g.globalAlpha=light?.13:.08;
  for (let x=4;x<gw;x+=4){ g.beginPath(); g.moveTo(ox+x*sc,oy); g.lineTo(ox+x*sc,oy+gh*sc); g.stroke(); }
  for (let y=4;y<gh;y+=4){ g.beginPath(); g.moveTo(ox,oy+y*sc); g.lineTo(ox+gw*sc,oy+y*sc); g.stroke(); }
  g.globalAlpha=1;
  // the lot itself
  g.beginPath(); verts.forEach((v,i)=>{ const [x,y]=P(v); i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath();
  g.fillStyle=invalid?'rgba(166,64,48,0.18)':(light?'rgba(96,134,74,0.34)':'rgba(111,143,90,0.30)'); g.fill();
  if (invalid){ g.strokeStyle=light?'rgba(160,52,36,0.95)':'rgba(236,118,92,0.9)'; }
  else { g.strokeStyle=ink; g.globalAlpha=.78; }
  g.lineWidth=1.6; g.stroke(); g.globalAlpha=1;
  /* Per-side lengths, held just outside each edge's midpoint. A side that runs
     up the screen has its caption start BESIDE the edge: centred on a point
     13px out, a 40px caption reached back across the edge and under the resize
     square, so "46.5 ft" read "5.5 ft" on every plot. */
  const fts=plotShapeSideLengthsFt(verts);
  g.font='600 11.5px IBM Plex Sans, sans-serif'; g.textBaseline='middle';
  for (let i=0;i<4;i++){
    const a=P(verts[i]), b=P(verts[(i+1)%4]);
    const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1;
    const nx=dy/len, ny=-dx/len;               // outward for clockwise winding
    const side=Math.abs(nx)>.6;
    g.textAlign=side?(nx>0?'left':'right'):'center';
    let lx=mx+nx*(side?12:13), ly=my+ny*13;
    const cap=fmtFeet(fts[i],1);
    /* The two resize squares stand on the bounding box, which a shaped lot's
       side has left: a slanted side's caption then lands on a square again.
       It steps past whichever one it would cover. */
    const tw=g.measureText(cap).width||0, x0=g.textAlign==='left'?lx:g.textAlign==='right'?lx-tw:lx-tw/2;
    for (const [hx,hy] of [[ox+gw*sc,oy+gh*sc/2],[ox+gw*sc/2,oy+gh*sc]]){
      if (Math.abs(ly-hy)>12 || x0>hx+9 || x0+tw<hx-9) continue;
      if (side){ g.textAlign='left'; lx=hx+11; } else ly=hy+(ny>=0?15:-15);
    }
    g.strokeStyle=halo; g.lineWidth=3; g.strokeText(cap,lx,ly);
    g.fillStyle=ink; g.fillText(cap,lx,ly);
  }
  // edge-resize handles: small squares at the right/bottom box midpoints —
  // squares resize the plot, circles shape it
  [[gw,gh/2],[gw/2,gh]].forEach((v,i)=>{ const [x,y]=P(v);
    const hot=plotShapeDrag&&plotShapeDrag.type==='edge'&&plotShapeDrag.edge===i;
    g.fillStyle=hot?goldHot:gold;
    g.strokeStyle=halo; g.lineWidth=1.5;
    g.beginPath(); g.rect(x-5.5,y-5.5,11,11); g.fill(); g.stroke(); });
  // corner handles (shape)
  verts.forEach((v,i)=>{ const [x,y]=P(v);
    const hot=plotShapeDrag&&plotShapeDrag.type==='corner'&&plotShapeDrag.i===i;
    g.beginPath(); g.arc(x,y,7,0,7);
    g.fillStyle=hot?goldHot:gold; g.fill();
    g.strokeStyle=halo; g.lineWidth=1.5; g.stroke(); });
  // the north DIAL: drag to rotate the site bearing, tap for the fine dialog
  const deg=(typeof normalizeSiteNorthDeg==='function'?normalizeSiteNorthDeg(plotNorthDraft):0);
  const [dcx,dcy]=m.dial, hotDial=plotShapeDrag&&plotShapeDrag.type==='dial';
  g.beginPath(); g.arc(dcx,dcy,14,0,7);
  g.fillStyle='rgba(20,14,11,0.62)';
  g.strokeStyle=hotDial?goldHot:uiInk('--icon-ink-dim'); g.lineWidth=hotDial?2:1.2;
  g.fill(); g.stroke();
  g.save(); g.translate(dcx,dcy); g.rotate(deg*Math.PI/180);
  g.strokeStyle='#efe6d3'; g.lineWidth=1.7; g.lineCap='round';
  g.beginPath(); g.moveTo(0,8); g.lineTo(0,-6); g.stroke();
  g.beginPath(); g.moveTo(-3.5,-2); g.lineTo(0,-8); g.lineTo(3.5,-2); g.stroke();
  g.restore();
  g.fillStyle=ink; g.globalAlpha=.9; g.font='600 10.5px IBM Plex Sans, sans-serif';
  g.textAlign='center';
  g.fillText('N',dcx,dcy+23);
  g.fillText(deg+'°',dcx,dcy+35);
  g.globalAlpha=1;
}
/* What the drawing's three handles do. The markup used to say so and the
   screen never showed it: openPlotScreen replaced the line with "Drag a
   corner" before anyone saw it, so nothing told a gardener that the squares
   resize the plot or that the 28px dial is a control at all. */
function plotShapeHintText(){ return 'Drag a square to resize, a corner to shape the lot, the N dial to set north.'; }
function setPlotShapeHint(text){
  const hint=$('plotShapeHint');
  if (hint) hint.textContent=text||plotShapeHintText();
  // Reset is only on offer while there is a shape to reset
  const reset=$('btnPlotShapeReset'); if (reset&&reset.classList) reset.classList.toggle('hidden',!pendingPlotShape);
}
function resetPendingPlotShape(fromResize){
  const had=!!pendingPlotShape;
  pendingPlotShape=null; plotShapeDrag=null;
  setPlotShapeHint(had && fromResize ? 'Plot resized, so the lot is a rectangle again.' : '');
  drawPlotShapeEditor();
}
/* A plain tap on the dial opens the north dialog, and it has to do so from the
   CLICK. Opened on pointerup, the click the browser makes out of that same tap
   arrived a moment later on whatever was now under the finger: on a tablet and
   a phone on its side that is the dialog's scrim, whose own handler closes it,
   so the dialog opened and shut inside one tap. */
let plotDialTap=false, plotEditorWired=false;
function wirePlotShapeEditor(){
  const cvs=$('plotShapeCanvas'); if (!cvs || plotEditorWired) return;
  plotEditorWired=true;
  $('btnPlotShapeReset').onclick=()=>{ resetPendingPlotShape(false); plotSetupChanged(); };
  cvs.addEventListener('click',()=>{ if (!plotDialTap) return; plotDialTap=false; openSiteNorthEditor('plot'); });
  const pos=(e)=>{ const r=cvs.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; };
  cvs.addEventListener('pointerdown',e=>{
    plotDialTap=false;                         // a tap whose click never came is not owed one
    const m=plotShapeMetrics(), [px,py]=pos(e);
    const verts=pendingPlotShape||defaultPlotShapeVerts(m.gw,m.gh);
    // hit priority: shape corners, then edge-resize squares, then the dial
    let best=-1, bestD=24;                     // generous touch targets throughout
    verts.forEach((v,i)=>{ const d=Math.hypot(px-(m.ox+v[0]*m.sc), py-(m.oy+v[1]*m.sc));
      if (d<bestD){ bestD=d; best=i; } });
    if (best>=0){
      plotShapeDrag={type:'corner', i:best, m, verts:verts.map(v=>v.slice()), last:verts.map(v=>v.slice()), valid:true};
    } else {
      let eBest=-1, eD=22;
      [[m.gw,m.gh/2],[m.gw/2,m.gh]].forEach((v,i)=>{
        const d=Math.hypot(px-(m.ox+v[0]*m.sc), py-(m.oy+v[1]*m.sc));
        if (d<eD){ eD=d; eBest=i; } });
      if (eBest>=0){
        if (pendingPlotShape){ pendingPlotShape=null; setPlotShapeHint('Plot resized, so the lot is a rectangle again.'); }
        plotShapeDrag={type:'edge', edge:eBest, m};
      } else if (Math.hypot(px-m.dial[0],py-m.dial[1])<=22){
        plotShapeDrag={type:'dial', m, moved:false};
      } else return;
    }
    e.preventDefault();
    cvs.setPointerCapture(e.pointerId);
    drawPlotShapeEditor();
  });
  cvs.addEventListener('pointermove',e=>{
    const d=plotShapeDrag; if (!d) return;
    e.preventDefault();
    const m=d.m, [px,py]=pos(e);
    if (d.type==='corner'){
      d.verts[d.i]=plotShapeSnap((px-m.ox)/m.sc,(py-m.oy)/m.sc,m.gw,m.gh);
      d.valid=plotShapeQuadOk(d.verts,m.gw,m.gh);
      if (d.valid){ d.last=d.verts.map(v=>v.slice()); setPlotShapeHint(); }
      else {
        const bow=plotEdgesCross(d.verts[0],d.verts[1],d.verts[2],d.verts[3])
          || plotEdgesCross(d.verts[1],d.verts[2],d.verts[3],d.verts[0]);
        setPlotShapeHint(bow?"Corners can't cross.":'Too small to garden.');
      }
    } else if (d.type==='edge'){
      // live-resize the plot: write the inputs (tile-snapped), keep the frozen
      // scale so the geometry doesn't chase the cursor; refit happens on release
      if (d.edge===0){
        const maxT=Math.floor((m.cssW-44-m.ox)/m.sc);
        const t=Math.min(plotEdgeResizeTiles((px-m.ox)/m.sc), Math.max(ftToTiles(FT_MIN),maxT));
        setPlotField('plotW', t*TILE_IN/12);
      } else {
        const maxT=Math.floor((m.cssH-18-m.oy)/m.sc);
        const t=Math.min(plotEdgeResizeTiles((py-m.oy)/m.sc), Math.max(ftToTiles(FT_MIN),maxT));
        setPlotField('plotL', t*TILE_IN/12);
      }
      plotSetupChanged();
    } else if (d.type==='dial'){
      const dx=px-m.dial[0], dy=py-m.dial[1];
      if (Math.hypot(dx,dy)>4){ d.moved=true; plotNorthDraft=plotDialDeg(dx,dy); plotNorthSet=true; updatePlotNorthSummary(); }
    }
    drawPlotShapeEditor();
  });
  const finish=(e)=>{
    const d=plotShapeDrag; if (!d) return;
    plotShapeDrag=null;
    if (d.type==='corner'){
      const verts=d.valid?d.verts:d.last;
      pendingPlotShape=plotShapeIsRect(verts,d.m.gw,d.m.gh)?null:verts.map(v=>v.slice());
      setPlotShapeHint();
      plotSetupChanged();
    } else if (d.type==='dial' && !d.moved){
      // a plain tap opens the fine-tune dialog, from the click that follows
      plotDialTap=!!(e && e.type==='pointerup');
    }
    drawPlotShapeEditor();                     // refits to any new size
  };
  cvs.addEventListener('pointerup',finish);
  cvs.addEventListener('pointercancel',finish);
  // the drawing is fitted to its box, so a resized window needs it drawn again
  addEventListener('resize',()=>{ const s=$('designScreen'); if (s && !s.classList.contains('hidden')) drawPlotShapeEditor(); });
}
/* The page that is open says what else follows a change to the plot (its size
   note, the footer's summary, which size chip is on). A no-op until it does. */
let plotSetupChanged=()=>{};
/* The area of the lot as drawn: the shape's own, once a corner has been moved.
   It quoted the bounding rectangle's, so a 93 ft plot with a corner cut off
   still read 8,649 sq ft. Shoelace over the tile-corner polygon. */
function plotLotSqFt(){
  const w=plotRealFt('plotW'), l=plotRealFt('plotL'), v=pendingPlotShape;
  if (!v) return w*l;
  let a=0;
  for (let i=0;i<v.length;i++){ const p=v[i], q=v[(i+1)%v.length]; a+=p[0]*q[1]-q[0]*p[1]; }
  return Math.abs(a)/2*(TILE_IN/12)*(TILE_IN/12);
}
function plotAreaText(){
  const w=plotRealFt('plotW'), l=plotRealFt('plotL'), sqFt=plotLotSqFt();
  /* Acres are dropped in metric rather than converted: a garden is 0.04 ha,
     which is a number nobody can hold, and square metres already answer the
     question the acre figure was there for. */
  const area=metricUnits()
    ? `${Math.round(sqFt*SQM_PER_SQFT).toLocaleString()} sq m`
    : `${Math.round(sqFt).toLocaleString()} sq ft · ${(sqFt/43560).toFixed(2)} acres`;
  return `${area} · ${ftToTiles(w)} × ${ftToTiles(l)} tiles`;
}
function plotNoteText(){
  const w=plotRealFt('plotW'), l=plotRealFt('plotL');
  // the real size leads: it is what the garden will be, whatever is mid-typing
  return `${fmtFeet(w,1)} × ${fmtFeet(l,1)} · ${plotAreaText()}`;
}
/* On the page the size itself is in the chips, the fields and the footer, so
   the line under the drawing is what they do not say: the area and the grid. */
function updatePlotNote(){ $('plotNote').textContent=plotAreaText()+'.'; }
/* Kept under its old name: scripts and notes reach a new garden through it. */
function openPlotScreen(){ openDesignSetup(); }

if ($('siteNorthRange')) $('siteNorthRange').oninput=e=>setSiteNorthEditorDraft(e.target.value);
if ($('siteNorthNumber')) $('siteNorthNumber').onchange=e=>setSiteNorthEditorDraft(e.target.value);
document.querySelectorAll('[data-north-deg]').forEach(b=>b.onclick=()=>setSiteNorthEditorDraft(b.dataset.northDeg));
if ($('btnSiteNorthCancel')) $('btnSiteNorthCancel').onclick=cancelSiteNorthEditor;
if ($('btnSiteNorthApply')) $('btnSiteNorthApply').onclick=applySiteNorthEditor;
if ($('siteNorthScreen')) $('siteNorthScreen').onclick=e=>{ if (e.target===$('siteNorthScreen')) cancelSiteNorthEditor(); };

/* ---------- New garden ----------
   One page makes a garden: the plot on one side, what to plant in it on the
   other, one button. It was a questionnaire and then a plot screen, eight
   questions about plants before the two about the site, in an older panel
   whose only button sat one to three screens down.

   NOTHING here has to be answered. Every control opens on a usable value, so
   New garden, Break ground is a garden, and the rest is there for whoever
   wants it. Three things that follow from that:

   - The zone is not guessed. A device that has never been told one opens on
     "Not set" (every plant shown), where it used to open on Zone 6 with nothing
     saying so; the daily challenge already declined that fallback. A device
     that has been told opens on what it was told.
   - Answers are remembered. Zone, origin and resistance come from the garden
     filters this device keeps (hortus:filters); the style and the plot's size
     from LAST_SETUP_KEY. After a reload the zone used to go back to 6 while
     the native mode beside it was kept.
   - "Start with" is gone. It was the catalog's own source picker asked one
     screen early, its first row repeated the count above it, and Favorites
     could be chosen at "0 saved", which opened an empty library.

   Controls are built once per opening and changed IN PLACE after that. Each
   press used to empty its row and build it again, which dropped keyboard focus
   on the body (the next Tab started again at Zone 1) and meant nothing could
   animate, the pressed chip having been replaced before it could. */
const GARDEN_TYPES=[
  ['any','Any garden','Every plant that suits the garden, in no particular style.'],
  ['cottage','Cottage','Romantic and abundant: layered perennials and self-seeders.'],
  ['prairie','Prairie / Meadow','Native grasses and forbs in naturalistic drifts.'],
  ['rain','Rain garden','A basin that floods after storms and dries between: plants that take both.'],
  ['butterfly','Pollinator','Nectar and host plants for butterflies and bees.'],
  ['shade','Shade / Woodland','Understory calm: hostas, ferns, sedges, woodland bulbs.'],
  ['japanese','Japanese','Restraint and structure: evergreens, moss, stone.'],
  ['mediterranean','Mediterranean','Silver foliage and herbs that love dry heat.'],
  ['modern','Modern','Bold blocks and clean structure, a tight palette.'],
  ['gravel','Gravel / Rock','Drought-tough plants in lean, sharp drainage.'],
  ['formal','Formal','Symmetry and clipped lines: axial beds and hedges.'],
  ['coastal','Coastal','Salt- and wind-tolerant grasses and dune plants.'],
];
// Approximate winter-low choices. Show the temperature range with the label;
// frost wording alone cannot identify a zone. ZIP results describe a listed
// ZIP, not the exact site's microclimate. Manual choices remain available.
const WINTER_BANDS=[
  ['Extreme cold','−50 to −40°F',2],
  ['Deep freeze','−30 to −20°F',4],
  ['Cold winters','−10 to 0°F',6],
  ['Regular freezes','10 to 20°F',8],
  ['Light frost','30 to 40°F',10],
  ['Frost-free','40 to 50°F',11],
];
/* The style and plot size of the last garden made here, to start the next one
   from. A device preference, in localStorage like the others: it is read while
   the page is being built, which IndexedDB cannot answer in time, so it must
   stay out of IDB_KEYS. */
const LAST_SETUP_KEY='hortus:lastSetup';
function readLastSetup(){
  if (!hasStorage) return null;
  try{
    const v=JSON.parse(localStorage.getItem(LAST_SETUP_KEY)||'null');
    if (!v || typeof v!=='object') return null;
    const side=n=>Number.isFinite(+n)&&+n>0 ? Math.max(FT_MIN,Math.min(FT_MAX,+n)) : null;
    return {type:GARDEN_TYPES.some(g=>g[0]===v.type)?v.type:null, w:side(v.w), l:side(v.l)};
  }catch(_){ return null; }
}
function writeLastSetup(v){
  if (!hasStorage) return;
  try{ localStorage.setItem(LAST_SETUP_KEY,JSON.stringify(v)); }catch(_){ }
}
/* What the page held when it was left without breaking ground. Back used to
   keep the questionnaire's answers and throw the plot's away. */
let newGardenDraft=null, designSetupOpen=0;

/* A style card pictures three of the plants it would put first, drawn by the
   garden's own painter: the menu's idea, that an entry shows what it opens.
   The three are the style's top-ranked plants for this zone and origin, one
   of each drawing form so a prairie is not three grasses, tallest in the
   middle. Canvases are kept per style for the session and repainted only when
   their three plants change. */
const STYLE_ART=new Map(), STYLE_ART_W=120, STYLE_ART_H=56;
const STYLE_ANY_KEYS=['echinacea','bluestem','hosta'];
function styleCardKeys(type,zone,criteria){
  const ranked=styleMeadowKeys(type,zone,criteria) || styleMeadowKeys(type,null,null) ||
    STYLE_ANY_KEYS.filter(k=>PLANTS[k]);
  const out=[], forms=new Set();
  for (const k of ranked){ const f=PLANTS[k].form; if (forms.has(f)) continue; forms.add(f); out.push(k); if (out.length===3) break; }
  for (const k of ranked){ if (out.length>=3) break; if (!out.includes(k)) out.push(k); }
  const tall=k=>plantVisualH(plantDef(k))||0;
  out.sort((a,b)=>tall(b)-tall(a));
  return out.length===3 ? [out[1],out[0],out[2]] : out;
}
function paintStyleArt(c,keys){
  const g=c.getContext && c.getContext('2d'); if (!g) return;
  const W=STYLE_ART_W, H=STYLE_ART_H, n=keys.length, slot=W/Math.max(1,n);
  g.setTransform(2,0,0,2,0,0); g.clearRect(0,0,W,H);
  // the outer two first, the middle one over them
  [0,2,1].filter(i=>i<n).forEach(i=>{
    const k=keys[i], P=PLANTS[k], box=plantDrawBox(P,k,1);
    // the box is a sprite's, padded for wind and snow; the drawing is inside it
    const sc=Math.min(1.7,(H-6)/Math.max(1,box.top-22),(slot*1.55)/Math.max(1,(box.halfW-16)*2));
    g.save(); g.translate(slot*(i+.5),H-4); g.scale(sc,sc);
    drawPlant(g,0,0,k,1,libraryPreviewSeason(P),libSeed(k),0,null,1);
    g.restore();
  });
}
function styleArtCanvas(type){
  let a=STYLE_ART.get(type);
  if (!a){
    const c=document.createElement('canvas'); c.width=STYLE_ART_W*2; c.height=STYLE_ART_H*2; c.setAttribute('aria-hidden','true');
    a={canvas:c,sig:null}; STYLE_ART.set(type,a);
  }
  return a.canvas;
}
function paintStyleCard(type,zone,criteria){
  const a=STYLE_ART.get(type); if (!a) return false;
  const keys=styleCardKeys(type,zone,criteria), sig=keys.join(',');
  if (sig===a.sig) return false;
  a.sig=sig; paintStyleArt(a.canvas,keys);
  return true;
}
/* A one-shot animation class: on for one run of its keyframes, then off, so
   the next press can play it again. The page's controls are kept across
   presses, and a class left on would never replay. */
function ngPop(node,cls='pop'){
  if (!node || !node.classList) return;
  node.classList.add(cls);
  if (!node.addEventListener) return;
  const done=e=>{ if (e && e.target!==node) return; node.classList.remove(cls); node.removeEventListener('animationend',done); };
  node.addEventListener('animationend',done);
}
/* One tab stop for a row of either/or buttons, moved through with the arrow
   keys the way a radio group is. */
function roveGroup(host,selector){
  if (!host) return;
  host.onkeydown=e=>{
    const step=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
    if (!step || !host.querySelectorAll) return;
    const all=Array.from(host.querySelectorAll(selector)), at=all.indexOf(document.activeElement);
    if (at<0) return;
    e.preventDefault();
    const next=all[(at+step+all.length)%all.length];
    if (next.focus) next.focus();
    next.click();
  };
}
function openDesignSetup(){
  const token=++designSetupOpen;
  const d=game.design||{}, last=readLastSetup()||{}, draft=newGardenDraft;
  const base=normalizeFilters(Object.keys(d).length?d:game.filters);
  const knownType=t=>GARDEN_TYPES.some(g=>g[0]===t)?t:null;
  const sel=draft?draft.sel:{zone:base.zone?clampZone(base.zone):null,
    type:knownType(d.type)||knownType(last.type)||'any',
    nativeRegion:base.nativeRegion, nativeMode:base.nativeMode,
    deer:base.deer, rabbit:base.rabbit, squirrel:base.squirrel,
    carried:!!base.zone, zoneHelp:false, rulesOpen:false};
  sel.zoneHelp=false;
  const zipEl=$('dgnZip'), zipStatus=$('dgnZipStatus'), startBtn=$('btnPlotStart');
  const winterEl=$('dgnWinter'), zoneChipsEl=$('dgnZoneChips'), typeEl=$('dgnTypeChips'), consEl=$('dgnConstraints'),
    helpEl=$('dgnZoneHelp'), zoneToggle=$('dgnZoneToggle'), rulesToggle=$('dgnRulesToggle'), rulesEl=$('dgnRules'),
    nativeModeEl=$('dgnNativeMode'), nativeRegionEl=$('dgnNativeRegion'), sizeRow=$('plotPresets');
  const mk=(tag,cls,text)=>{ const n=document.createElement(tag); if (cls) n.className=cls; if (text!=null) n.textContent=text; return n; };
  const btn=(cls,text)=>{ const b=mk('button',cls,text); b.type='button'; return b; };
  const press=(b,on)=>b.setAttribute('aria-pressed',on?'true':'false');
  const radio=(b,on)=>{ b.setAttribute('aria-checked',on?'true':'false'); b.tabIndex=on?0:-1; };
  /* An opened section is brought into view: on a phone it opens below the fold
     of a page already scrolled to its heading, and looked like nothing happened. */
  const disclose=(panel,open)=>{ panel.classList.toggle('hidden',!open); if (!open) return; ngPop(panel,'enter');
    if (panel.scrollIntoView) panel.scrollIntoView({block:'nearest',behavior:reducedMotion()?'auto':'smooth'}); };
  const styleName=id=>((GARDEN_TYPES.find(g=>g[0]===id)||[])[1]||'').split(' / ')[0];
  const syncMeadow=()=>applyMeadowPalette(sel.type, sel.zone, sel);  // replant the backdrop to match
  let zipRequest=0, zipBlocked=false;

  /* One walk of the catalog answers both figures on this page, so the tally is
     computed when one of the knobs it depends on has actually moved, and read
     otherwise. `type` is in the key because the style decides the recommended
     half. */
  let tally=null, tallyKey='', countShown='';
  function paletteTally(){
    const key=[sel.zone,sel.nativeRegion,sel.nativeMode,sel.deer?1:0,sel.rabbit?1:0,sel.squirrel?1:0,sel.type].join('|');
    if (key!==tallyKey){ tallyKey=key; tally=paletteCounts(sel,sel.type); }
    return tally;
  }
  /* What a style DOES, said under the cards: its plants lead the library and
     nothing is ruled out, and it decides whether beds get soft or crisp edges.
     Both were true and neither was said. */
  function syncStyleNote(){
    const row=GARDEN_TYPES.find(g=>g[0]===sel.type)||GARDEN_TYPES[0];
    let lead='';
    if (sel.type!=='any' && !zipBlocked){
      const t=paletteTally();
      lead=t.recommended<t.eligible
        ? ` Its ${t.recommended} plant${t.recommended===1?'':'s'} lead the library; the rest stay available.`
        : ' None of its plants grow under these rules, so the library lists everything.';
    }
    $('dgnTypeNote').textContent=`${row[2]}${lead} ${edgeStyleFromType(sel.type)==='formal'?'Crisp':'Soft, curved'} bed edges.`;
  }
  /* The count rides the header, so it is on screen whatever is being pressed:
     it sat 1,100px down the form on a phone, below every control that moves it. */
  function updateCount(){
    const out=$('dgnCount');
    if (zipBlocked){ out.textContent='Choose a zone to see the plants.'; countShown=''; syncStyleNote(); return; }
    const n=paletteTally().eligible, text=String(n);
    out.innerHTML=`<b>${n}</b> plant${n===1?'':'s'} suit this garden`;
    if (countShown && countShown!==text) ngPop(out,'tick');
    countShown=text; syncStyleNote();
  }
  function syncSummary(){
    const w=plotRealFt('plotW'), l=plotRealFt('plotL');
    const bits=[`${ftToDisplay(w,1)} × ${fmtFeet(l,1)}`, zipBlocked?'zone to choose':(sel.zone?`Zone ${sel.zone}`:'Every zone')];
    if (sel.type!=='any') bits.push(styleName(sel.type));
    $('ngSummary').textContent=bits.join(' · ');
  }

  /* ---- winter cold ---- */
  const range=zoneRange(), zoneBtns=[], winterBtns=[];
  zoneChipsEl.innerHTML='';
  for (let z=range.lo;z<=range.hi;z++){
    const b=btn('ng-chip ng-zone-chip',String(z));
    b.setAttribute('aria-label','Zone '+z); b.title=`Zone ${z} · ${zoneTemperatureText(z)}`;
    b.onclick=()=>{ setZone(z); ngPop(b); };
    zoneBtns.push([z,b]); zoneChipsEl.appendChild(b);
  }
  const unsure=btn('ng-chip ng-zone-unsure','Not sure');
  unsure.title='Leave the zone unset. Plants for every climate are shown, and it can be set later.';
  unsure.onclick=()=>{ setZone(null); ngPop(unsure); };
  zoneChipsEl.appendChild(unsure);
  winterEl.innerHTML='';
  WINTER_BANDS.forEach(([label,,z])=>{
    const b=btn('ng-chip ng-winter');
    b.append(mk('b',null,label), mk('small',null,zoneTemperatureText(z)));
    b.onclick=()=>{ setZone(z); ngPop(b); };
    winterBtns.push([clampZone(z),b]); winterEl.appendChild(b);
  });
  function syncZone(){
    zoneBtns.forEach(([n,b])=>press(b,!zipBlocked&&n===sel.zone));
    winterBtns.forEach(([n,b])=>press(b,!zipBlocked&&n===sel.zone));
    press(unsure,!zipBlocked&&sel.zone==null);
    $('dgnZoneOut').innerHTML=zipBlocked ? 'Choose a supported zone to continue.'
      : sel.zone ? `<b>Zone ${sel.zone}</b> · coldest winter nights ${zoneTemperatureText(sel.zone)}`+
          (sel.carried?' <span class="ng-carried">· as in your last garden</span>':'')
      : '<b>Not set</b> · plants for every climate are shown';
    zoneToggle.textContent=sel.zoneHelp?'Done':(sel.zone?'Change':'Find my zone');
    zoneToggle.classList.toggle('accent',!sel.zoneHelp&&!sel.zone);
    zoneToggle.setAttribute('aria-expanded',sel.zoneHelp?'true':'false');
    startBtn.disabled=zipBlocked;
  }
  function setZone(z,fromZip=false){
    if (!fromZip){ zipRequest++; zipEl.value=''; zipStatus.textContent=''; }
    zipBlocked=false; sel.zone=z==null?null:clampZone(z); sel.carried=false;
    syncZone(); updateCount(); syncSummary(); syncMeadow(); queueStyleArt();
  }
  function blockZip(message){
    zipBlocked=true; zipStatus.textContent=message;
    syncZone(); updateCount(); syncSummary();
  }
  async function readZip(){
    const request=++zipRequest, zip=zipEl.value.trim();
    const current=()=>zipEl.oninput===readZip && request===zipRequest && !$('designScreen').classList.contains('hidden');
    if (!/^\d{5}$/.test(zip)){
      /* A postcode from somewhere else used to get no answer at all. */
      zipStatus.textContent=/\D/.test(zip)?'ZIP codes are five digits. Outside the US, use the choices below.':'';
      // Clearing an unsuccessful lookup restores the earlier manual choice.
      zipBlocked=false; syncZone(); updateCount(); syncSummary(); return;
    }
    blockZip('Looking up ZIP…');
    try{
      const data=await loadZipZones(); if (!current()) return;
      const half=halfZoneFromZip(zip,data), z=zoneFromZip(zip,data);
      if (!half){ blockZip('This ZIP is not in the bundled 2023 listing. Check the USDA map, then choose a zone.'); return; }
      if (z<range.lo || z>range.hi){
        blockZip(`ZIP ${zip}: Zone ${half} (${zoneTemperatureText(half)}). The catalog currently covers zones ${range.lo}–${range.hi}. Check your site on the map; this result has not been rounded to another zone.`); return;
      }
      setZone(z,true);
      zipStatus.textContent=`ZIP ${zip}: Zone ${half} (${zoneTemperatureText(half)}). Using whole Zone ${z} for plant filters. Confirm your exact site on the map.`;
    }catch(e){ if (current()) blockZip('ZIP lookup is unavailable. Choose a zone manually, or check the USDA map when online.'); }
  }
  zipEl.value=''; zipStatus.textContent=''; zipEl.oninput=readZip;
  zoneToggle.onclick=()=>{
    sel.zoneHelp=!sel.zoneHelp; disclose(helpEl,sel.zoneHelp); syncZone();
    // the keyboard a focused field raises on a phone would cover the choices under it
    if (sel.zoneHelp && zipEl.focus && typeof matchMedia==='function' && matchMedia('(pointer:fine)').matches) zipEl.focus({preventScroll:true});
  };
  helpEl.classList.add('hidden');

  /* ---- garden style ---- */
  typeEl.innerHTML='';
  const cards=GARDEN_TYPES.map(([id,label],i)=>{
    const b=btn('ng-style'); b.setAttribute('role','radio'); b.setAttribute('aria-label',label); b.title=label;
    if (b.style && b.style.setProperty) b.style.setProperty('--k',String(i));   // its place in the deal
    const art=mk('span','ng-style-art'); art.appendChild(styleArtCanvas(id));
    const tick=mk('i','ng-tick'); tick.setAttribute('aria-hidden','true');
    b.append(art,mk('span','ng-style-name',label.split(' / ')[0]),tick);
    b.onclick=()=>{ if (sel.type===id) return;
      typeEl.classList.remove('dealing');   // or its entrance would run again when the pop ends
      sel.type=id; syncStyle(); ngPop(b); updateCount(); syncSummary(); syncMeadow(); };
    typeEl.appendChild(b);
    return {id,b};
  });
  function syncStyle(){ cards.forEach(c=>radio(c.b,c.id===sel.type)); }
  roveGroup(typeEl,'.ng-style');
  /* The pictures are drawn a card a frame, after the page is up: eleven cards
     of three plants each is not a cost to put in the tap that opened it. */
  let artQueue=[], artFrame=0;
  const artStep=()=>{
    artFrame=0;
    if (token!==designSetupOpen) return;
    const c=artQueue.shift(); if (!c) return;
    paintStyleCard(c.id,sel.zone,sel);
    if (artQueue.length) artFrame=requestAnimationFrame(artStep);
  };
  function queueStyleArt(){ artQueue=cards.slice(); if (!artFrame) artFrame=requestAnimationFrame(artStep); }

  /* ---- plant rules: where plants come from, and what they must shrug off ----
     The same controls, words and order as the Garden criteria dialog, which
     asks these again inside the garden. They were two vocabularies for one
     question ("Continent" here, "Natives + selections" there). */
  function rulesLine(){
    const mode=(GARDEN_NATIVE_MODES.find(m=>m[0]===sel.nativeMode)||GARDEN_NATIVE_MODES[0])[1];
    const place=sel.nativeMode==='any'?'':` (${nativeRegionLabel(sel.nativeRegion,true)})`;
    const resists=GARDEN_RESIST.filter(([id])=>sel[id]).map(([,label])=>label.toLowerCase());
    return `${mode}${place} · ${resists.length?'resists '+resists.join(', '):'no animal limits'}`;
  }
  function rulesChanged(){ $('dgnRulesLine').textContent=rulesLine(); updateCount(); syncMeadow(); queueStyleArt(); }
  function renderNative(){
    criteriaSegment(nativeModeEl,GARDEN_NATIVE_MODES,sel.nativeMode,id=>{ sel.nativeMode=id; renderNative(); rulesChanged(); });
    /* Its WORD changes with the mode, as in the criteria dialog: origin is what
       a native mode restricts, place is what the garden is. */
    $('dgnNativeRegionLabel').textContent=sel.nativeMode==='any'?'Garden region':'Continent of origin';
    $('dgnNativeHint').textContent=nativeCriteriaText(sel);
  }
  nativeRegionEl.innerHTML='';
  NATIVE_REGIONS.filter(r=>r.selectable!==false).forEach(r=>{
    const o=document.createElement('option'); o.value=r.id; o.textContent=r.label; o.selected=r.id===sel.nativeRegion; nativeRegionEl.appendChild(o);
  });
  nativeRegionEl.onchange=()=>{ sel.nativeRegion=normalizeNativeRegion(nativeRegionEl.value); renderNative(); rulesChanged(); };
  consEl.innerHTML='';
  GARDEN_RESIST.forEach(([id,label])=>{
    const b=btn('gc-check'); b.append(mk('i','gc-box'),mk('span',null,label)); press(b,!!sel[id]);
    b.onclick=()=>{ sel[id]=!sel[id]; press(b,sel[id]); ngPop(b); rulesChanged(); };
    consEl.appendChild(b);
  });
  rulesToggle.onclick=()=>{
    sel.rulesOpen=!sel.rulesOpen; disclose(rulesEl,sel.rulesOpen);
    rulesToggle.setAttribute('aria-expanded',sel.rulesOpen?'true':'false');
  };
  rulesEl.classList.toggle('hidden',!sel.rulesOpen);
  rulesToggle.setAttribute('aria-expanded',sel.rulesOpen?'true':'false');

  /* ---- the plot ---- */
  sizeRow.innerHTML=''; plotPresetChips=[];
  const sizeBtns=PLOT_PRESETS.map(p=>{
    const b=btn('ng-size'); b.setAttribute('role','radio');
    const size=mk('b',null,plotPresetSize(p)), cap=mk('small',null,plotPresetLabel(p));
    b.append(size,cap); plotPresetChips.push({p,size,cap});
    b.onclick=()=>{ setPlotField('plotW',p.w); setPlotField('plotL',p.l); resetPendingPlotShape(true); syncPlot();
      ngPop(b); ngPop($('plotShapeCanvas')); };
    sizeRow.appendChild(b);
    return [p,b];
  });
  roveGroup(sizeRow,'.ng-size');
  /* Which size chip is on is read off the fields, so it cannot go stale: the
     chips were built once and the fields reset on every opening, which left a
     second garden at 46.5 ft under a chip still saying 1/10 acre. */
  function syncPlot(){
    const gw=ftToTiles(plotFt('plotW')), gh=ftToTiles(plotFt('plotL'));
    let any=false;
    sizeBtns.forEach(([p,b])=>{ const on=!pendingPlotShape && ftToTiles(p.w)===gw && ftToTiles(p.l)===gh; radio(b,on); any=any||on; });
    if (!any && sizeBtns[0]) sizeBtns[0][1].tabIndex=0;   // a custom size still leaves the row reachable
    updatePlotNote(); syncSummary();
  }
  plotSetupChanged=syncPlot;
  $('plotW').oninput=$('plotL').oninput=()=>{ resetPendingPlotShape(true); syncPlot(); };
  // on finishing a value (blur or Enter), not per keystroke: rewriting the
  // field mid-typing would fight the person typing it
  $('plotW').onchange=()=>{ setPlotField('plotW',plotFt('plotW')); syncPlot(); drawPlotShapeEditor(); };
  $('plotL').onchange=()=>{ setPlotField('plotL',plotFt('plotL')); syncPlot(); drawPlotShapeEditor(); };
  $('btnPlotNorth').onclick=()=>openSiteNorthEditor('plot');
  wirePlotShapeEditor();

  /* ---- break ground ---- */
  const start=()=>{
    if (zipBlocked) return;
    game.design={zone:sel.zone, type:sel.type, nativeRegion:sel.nativeRegion, nativeMode:sel.nativeMode,
      deer:sel.deer, rabbit:sel.rabbit, squirrel:sel.squirrel};
    // tune the live palette: filters apply, style ranks the tray
    game.filters=normalizeFilters(game.design);
    game.discovery=defaultDiscovery();          // the library opens on the style's own list
    sSet('hortus:filters',game.filters); updateFilterBtn();
    writeLastSetup({type:sel.type, w:plotRealFt('plotW'), l:plotRealFt('plotL')});
    setWorldSize(ftToTiles(plotFt('plotW')), ftToTiles(plotFt('plotL')));
    if (pendingPlotShape && !setPlotShape(pendingPlotShape))     // sized first — setWorldSize clears any shape
      toast('That lot shape was too tight, so the plot starts as a rectangle.');
    game.worldId=newWorldId();
    funnel(FUNNEL_EVENTS.gardenCreated);   // cleared the whole setup flow
    game.worldName=$('plotName').value.trim()||'My garden';
    resetNewGardenState();
    game.siteNorthDeg=normalizeSiteNorthDeg(plotNorthDraft);
    /* North chosen here is north confirmed: Start here's first step opens
       ticked, where it used to ask the question a second time. */
    if (plotNorthSet) game.startHere={north:true,dismissed:false};
    // naturalistic styles get smoothed bed/path edges; structured styles stay crisp
    game.edgeStyle=edgeStyleFromType(sel.type);
    newGardenDraft=null;
    // a blank plot: no house, nothing planted, the whole site yours to draw
    game.inGarden=true;
    enterGarden();
    saveSolo(true); // claim the slot right away
  };
  startBtn.onclick=start;
  // a name and Enter is a garden
  $('plotName').onkeydown=e=>{ if (e.key==='Enter'){ e.preventDefault(); start(); } };
  /* Back goes where New garden was pressed, and keeps the page for a return.
     It went to the title screen, one further than it came from. */
  $('btnDesignBack').onclick=()=>{
    newGardenDraft={sel, name:$('plotName').value, w:plotFt('plotW'), l:plotFt('plotL'),
      shape:pendingPlotShape, north:plotNorthDraft, northSet:plotNorthSet};
    game.inGarden=false; openWorlds();
  };

  /* ---- first paint ---- */
  syncUnitLabels();
  const w0=draft?draft.w:(last.w||46), l0=draft?draft.l:(last.l||46);
  setPlotField('plotW',w0); setPlotField('plotL',l0);
  $('plotName').value=draft?draft.name:'';
  plotNorthDraft=draft?draft.north:0; plotNorthSet=!!(draft&&draft.northSet);
  plotShapeDrag=null;
  pendingPlotShape=draft&&draft.shape&&plotShapeQuadOk(draft.shape,ftToTiles(w0),ftToTiles(l0)) ? draft.shape.map(v=>v.slice()) : null;
  updatePlotNorthSummary(); setPlotShapeHint();
  $('dgnRulesLine').textContent=rulesLine();
  syncZone(); syncStyle(); renderNative(); updateCount(); syncPlot();
  syncMeadow();   // replant the backdrop for the initial style/zone
  // the cards are dealt in as the page opens; the class goes once they have landed
  typeEl.classList.add('dealing');
  setTimeout(()=>{ if (token===designSetupOpen) typeEl.classList.remove('dealing'); },900);
  show('designScreen');
  const body=$('ngBody'); if (body) body.scrollTop=0;   // it reopened wherever it had been left
  drawPlotShapeEditor();                                  // canvas is measurable once shown
  queueStyleArt();
  /* Somewhere for the keyboard to be: the name on a desk, where a name and
     Enter makes the garden; the heading on a touch screen, where focusing a
     field would raise the keyboard over the page. */
  requestAnimationFrame(()=>{
    if (token!==designSetupOpen || $('designScreen').classList.contains('hidden')) return;
    const fine=typeof matchMedia==='function' && matchMedia('(pointer:fine)').matches;
    const target=fine?$('plotName'):$('ngTitle');
    if (target && target.focus) target.focus({preventScroll:true});
  });
}
function quitToMenu(){
  closeOverlay('challengeFinishScreen',false); closeOverlay('challengeScreen',false);
  finishGardenOpen();
  if (game.photoEditing) closeSitePhotoEdit(false);
  landSkipNow();                 // a Skip still preparing is still a Skip
  suspendClock();
  if (game.inGarden&&hasStorage){
    try{ rememberGardenPortrait(captureGardenPortrait()); }
    catch(e){ rememberGardenPortrait(null); noteError(e,'garden-portrait'); }
    saveSolo();
  }
  game.inGarden=false; game.pausedAt=0; game.clockSuspended=false;
  /* The controls tour points at things that only exist in a garden. Its callout
     hides itself when there is no garden, but only when it is next rendered,
     and nothing rendered it on the way out: quitting part-way through the tour
     left it standing on the title screen. */
  if (typeof tourRender==='function') tourRender();
  document.body.classList.remove('design-mode');
  closeGardenOverlays();
  syncStaleBar();
  dismissCoachTip();
  hidePlantCard();   // it lives outside #hud, so hiding the HUD does not take it
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden');
  setActiveCanvas(mcnv);
  setMenuViewportFill();
  show('menuScreen');
}
function openGardenMenu(){
  syncSchemeLabel();
  // the first row on show: View brief in a daily garden, the planting list otherwise
  const gm=openOverlay('gardenMenu','.gm-body .gm-row:not(.hidden)');
  // anchor the dropdown right under the menu button, right-aligned to the action
  // bar — robust to the bar's height/width at any breakpoint
  const bar=$('actionBar').getBoundingClientRect(), p=gm.querySelector('.panel');
  if (p && bar.width){ p.style.top=(bar.bottom+6)+'px';p.style.setProperty('--garden-menu-top',(bar.bottom+6)+'px');
    p.style.right=Math.max(8,Math.round(innerWidth-bar.right))+'px'; }
}
$('btnMenu').onclick=openGardenMenu;
if ($('coachTipClose')) $('coachTipClose').onclick=dismissCoachTip;
// click the backdrop (anywhere off the panel) to dismiss, like any dropdown
$('gardenMenu').onclick=(e)=>{ if (e.target===$('gardenMenu')) closeOverlay('gardenMenu'); };
$('btnQuit').onclick=quitToMenu;
if ($('btnShare')) $('btnShare').onclick=shareCurrentGarden;
/* Help rows. Both close the garden menu first, like Settings below, so there
   is one layer on screen and Escape means one thing. */
if ($('btnGardenGuide')) $('btnGardenGuide').onclick=()=>{ closeOverlay('gardenMenu',false); openGuide(); };
if ($('btnGardenTour')) $('btnGardenTour').onclick=()=>{
  closeOverlay('gardenMenu',false);
  tourSession=null;   // a replay, as Settings' own row does
  toast(startTour() ? 'Tour started.' : 'Nothing to tour here.');
};
if ($('btnGardenSettings')) $('btnGardenSettings').onclick=()=>{
  /* A dropdown that spawns a modal should get out of the way: leaving the
     garden menu open behind the scrim puts two dismissable layers on screen and
     makes Escape ambiguous. Focus does not go back to it either — openSettings
     owns the return, and the row it would return to is gone. */
  closeOverlay('gardenMenu',false);
  openSettings($('btnGardenSettings'));
};
$('btnGmClose').onclick=()=>closeOverlay('gardenMenu');

/* ---------- settings ----------
   One surface for every DEVICE preference, reachable from the main menu (the
   gear, top-right) and from an open garden (Menu -> Settings). Appearance,
   haptics and the rail side used to be three rows inside the garden menu, which
   meant somebody who had not opened a garden yet could not find dark mode at
   all, and that the 236px garden dropdown was carrying preferences among the
   planting list, the plan and Share.

   settingsSections() is a PURE description of the screen — the rows, their
   current values and what each one does — and renderSettings() is a thin loop
   over it. That split is deliberate: the sandbox has no selector engine, so a
   test that counted rendered rows would pass without testing anything, whereas
   the table and its get/set closures are exactly where the behaviour lives.
   Adding a setting is one entry here. */
function settingsSwitchRow(id,label,hint,get,set){
  return {kind:'switch', id, label, hint, get, set};
}
function settingsSections(){
  const sections=[];

  sections.push({title:'Appearance', rows:[
    {kind:'choice', id:'theme', label:'Theme',
     hint:'The garden keeps its own seasonal colours in both — a meadow at midday is not dark mode.',
     options:THEME_CHOICES.map(id=>({id, label:id==='auto'?'Auto':id==='light'?'Light':'Dark'})),
     get:()=>themePref,
     set:id=>{ setThemePref(id); return `Theme: ${themeLabel()}.`; }},
    {kind:'choice', id:'motion', label:'Motion',
     hint:'Reduced removes panel and menu animation, and the season crossfade. Auto follows your device.',
     options:[{id:'auto',label:'Auto'},{id:'reduce',label:'Reduced'},{id:'full',label:'Full'}],
     get:()=>motionPref,
     set:id=>{ setMotionPref(id); return `Motion: ${motionLabel()}.`; }},
  ]});

  /* Units sits with Language rather than with Theme: both answer "what does
     this app speak", where Theme answers "what does it look like". It is also
     the row a gardener outside the US is most likely to have come here for. */
  sections.push({title:'Language & units', rows:[
    {kind:'choice', id:'units', label:'Measurements',
     hint:'Changes what is DISPLAYED — the planting list, the plan sheet, the ruler and the plot setup. Plant spacing and every quantity are calculated the same way either way.',
     options:[{id:'imperial',label:'Feet & inches'},{id:'metric',label:'Metric'}],
     get:()=>unitsPref,
     set:id=>{ setUnitsPref(id); return `Measurements: ${unitsLabel()}.`; }},
    LANGUAGES.length>1
      ? {kind:'choice', id:'lang', label:'Language', hint:'',
         options:LANGUAGES.map(l=>({id:l.id, label:l.native})),
         get:()=>langPref, set:id=>{ setLangPref(id); return `Language: ${languageLabel()}.`; }}
      : {kind:'note', id:'lang', label:'Language', value:languageLabel(),
         hint:'Pocket Prairie is English-only today. More languages are planned — botanical Latin names stay as they are either way.'},
  ]});

  const controls=[
    settingsSwitchRow('handed','Left-handed layout',
      'Moves the canvas tool rail to the right edge, and the chrome that hangs off it with it.',
      ()=>leftHandedLayout,
      on=>{ setLeftHandedLayout(on,true); return `Left-handed layout ${on?'on':'off'}.`; }),
  ];
  /* Capability-gated rather than shown-and-disabled: a desktop has no vibration
     motor, and a switch that cannot do anything is worse than an absent one. */
  if (supportsHaptics())
    controls.push(settingsSwitchRow('haptics','Haptic feedback',
      'A short pulse when a placement lands or is refused. Never once per tile in a drag.',
      ()=>hapticsOn,
      on=>{ const got=setHapticsEnabled(on); if (got) hapticFeedback('success');
            return `Haptic feedback ${got?'on':'off'}.`; }));
  controls.push({kind:'action', id:'tips', label:'Show tips again',
    hint:'Replays the short tips that explain planting, drag-to-plant and running the year.',
    action:'Reset tips',
    run:()=>{ resetCoachTips(); return 'Tips will show again the next time you open a garden.'; }});
  /* Its own row rather than only riding the tips reset: the tour is the thing
     someone comes here looking for when they cannot find a control, and burying
     it inside a button labelled "Reset tips" means they never do. Only offered
     from inside a garden — every step points at a control that does not exist
     on the menu, so from there it would start by pointing at nothing. */
  if (game.inGarden) controls.push({kind:'action', id:'tour', label:'Tour the controls',
    hint:'Seven short steps: moving around, identifying a plant, running the year, planting, and the planting list.',
    action:tourFinished()?'Run it again':'Start tour',
    run:()=>{ closeSettings(); tourSession=null;
      return startTour() ? 'Tour started.' : 'Nothing to tour here.'; }});
  sections.push({title:'Controls & accessibility', rows:controls});

  sections.push({title:'Storage', rows:[
    {kind:'note', id:'storage', label:'On this device', value:'Checking…', block:true,
     hint:'Gardens live in this browser. Share a garden from its own menu to keep a copy you can move.',
     fill:settingsStorageLine},
  ]});

  sections.push({title:'About', rows:[
    {kind:'action', id:'version', label:'Version', value:`v${APP_VERSION}`,
     hint:'A new build installs in the background and waits until you accept it.',
     action:'Check for updates', run:checkForAppUpdate},
    {kind:'links', id:'legal', label:'Credits and policies', links:[
      {href:'credits.html', text:'Credits'},
      {href:'privacy.html', text:'Privacy'},
      {href:'terms.html', text:'Terms'},
    ], hint:'Pocket Prairie makes no network requests and sends nothing anywhere.'},
  ]});

  /* The paid tier's PLACEMENT, decided and built, behind one constant. Off, this
     section does not exist and the app is unchanged — an Upgrade button that
     cannot take money is worse than no button.

     Settings is deliberately the RESTORE surface rather than the conversion
     surface. Apple requires a restore path for any app with a purchase and this
     is where people look for it; conversion belongs at the moment of value (the
     planting list, the plan sheet, Share) and on the main menu, not three rows
     into a preferences screen where nobody in a buying mood is looking. */
  if (PREMIUM_ENABLED) sections.push({title:'Pocket Prairie Premium', rows:[
    {kind:'note', id:'premium-state', label:'Status',
     value:isPremium()?'Premium':'Free',
     hint:isPremium()
       ? 'Everything is unlocked on this device.'
       : PREMIUM_FEATURES.map(f=>'· '+f).join('\n')},
    ...(isPremium() ? [] : [{kind:'action', id:'premium-buy', label:'Upgrade',
      hint:'One purchase, this device.', action:'See pricing', run:startPremiumPurchase}]),
    {kind:'action', id:'premium-restore', label:'Already bought it?',
     hint:'Restores a purchase made with the same store account.',
     action:'Restore purchase', run:restorePremiumPurchase},
  ]});

  return sections;
}

/* Origin-wide usage, which includes the ~1.7MB offline shell — that IS what the
   app occupies on the device, so reporting only the gardens would understate
   it. Persistence is worth naming: without it a browser under pressure may
   evict the whole origin, which is the difference between "saved" and "saved
   unless the phone needs the space". */
function formatBytes(n){
  if (!(n>0)) return '0 KB';
  if (n<1024*1024) return `${Math.max(1,Math.round(n/1024))} KB`;
  return `${(n/(1024*1024)).toFixed(n<10*1024*1024?1:0)} MB`;
}
async function settingsStorageLine(){
  const parts=[];
  try{ const idx=await worldsIndex();
    parts.push(`${idx.length} garden${idx.length===1?'':'s'} saved`); }catch(_){ }
  try{
    if (navigator.storage && navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      if (e && e.usage) parts.push(`${formatBytes(e.usage)} used`);
    }
  }catch(_){ }
  try{
    if (navigator.storage && navigator.storage.persisted)
      parts.push(await navigator.storage.persisted()
        ? 'kept until you delete it'
        : 'the browser may clear it if space runs short');
  }catch(_){ }
  return parts.length ? parts.join(' · ') : 'Storage is unavailable in this browser.';
}

/* The manual half of the update path. sw.js installs a new build and then
   waits, and an installed PWA is resumed rather than navigated — so the
   automatic check fires rarely on exactly the device where staleness bites.
   This answers "am I on the latest?" on demand. */
async function checkForAppUpdate(){
  if (!('serviceWorker' in navigator)) return 'Offline updates are not available in this browser.';
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    if (!reg) return 'Offline updates are not set up on this device.';
    await reg.update();
    /* Same guard watchForAppUpdate uses: no controller means this is a first
       visit, where the worker activates with nothing to wait for and there is
       no update to offer. */
    if (reg.waiting && navigator.serviceWorker.controller){
      offerAppUpdate(reg.waiting);
      closeSettings();
      return 'A new version is ready — see the bar at the top.';
    }
    return `You are on the latest version (v${APP_VERSION}).`;
  }catch(e){ noteError(e,'update-check'); return 'Could not check for updates just now.'; }
}

/* The two functions a store integration has to fill in, and the only two.
   Unreachable while PREMIUM_ENABLED is false. */
const PREMIUM_FEATURES=[
  'Unlimited saved gardens and planting schemes',
  'The printable design plan and the nursery-ready planting list',
  'The full species library, with cultivars and photographs',
];
function startPremiumPurchase(){
  funnel(FUNNEL_EVENTS.premiumStarted);
  return 'Purchasing is not available in this build yet.';
}
function restorePremiumPurchase(){
  funnel(FUNNEL_EVENTS.premiumRestored);
  return 'No purchase found on this device.';
}

/* ---- rendering ---- */
function settingsHint(text){
  const p=document.createElement('p'); p.className='set-hint';
  String(text).split('\n').forEach((line,i)=>{
    if (i) p.appendChild(document.createElement('br'));
    p.appendChild(document.createTextNode(line));
  });
  return p;
}
/* Arrow keys move within a radiogroup — a real expectation of the role, and the
   difference between "keyboard reachable" and "keyboard usable" when a group
   holds three options and Tab treats the whole group as one stop. */
function settingsChoiceGroup(row,announce){
  const g=document.createElement('div');
  g.className='set-choice'; g.setAttribute('role','radiogroup');
  g.setAttribute('aria-label',row.label);
  const current=row.get();
  const btns=row.options.map(o=>{
    const b=document.createElement('button'); b.type='button';
    b.className='set-choice-opt'+(o.id===current?' on':'');
    b.setAttribute('role','radio');
    b.setAttribute('aria-checked',o.id===current?'true':'false');
    b.tabIndex=o.id===current?0:-1;
    b.textContent=o.label;
    b.onclick=()=>{ announce(row.set(o.id)); renderSettings(); };
    g.appendChild(b);
    return b;
  });
  g.onkeydown=e=>{
    const i=btns.indexOf(document.activeElement);
    if (i<0) return;
    let j=-1;
    if (e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%btns.length;
    else if (e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+btns.length)%btns.length;
    else if (e.key==='Home') j=0;
    else if (e.key==='End') j=btns.length-1;
    if (j<0) return;
    e.preventDefault(); btns[j].focus(); btns[j].click();
  };
  return g;
}
function settingsRowEl(row,announce){
  const el=document.createElement('div');
  el.className='set-row set-row-'+row.kind;
  const head=document.createElement('div'); head.className='set-row-head';
  const lab=document.createElement('span'); lab.className='set-label'; lab.textContent=row.label;
  head.appendChild(lab);

  if (row.kind==='switch'){
    const on=row.get();
    const sw=document.createElement('button'); sw.type='button';
    sw.className='set-switch'+(on?' on':'');
    sw.setAttribute('role','switch'); sw.setAttribute('aria-checked',on?'true':'false');
    sw.setAttribute('aria-label',row.label);
    const knob=document.createElement('span'); knob.className='set-knob'; sw.appendChild(knob);
    sw.onclick=()=>{ announce(row.set(!row.get())); renderSettings(); };
    head.appendChild(sw);
  } else if (row.kind==='action'){
    if (row.value){
      const v=document.createElement('span'); v.className='set-value'; v.textContent=row.value;
      head.appendChild(v);
    }
    const b=document.createElement('button'); b.type='button';
    b.className='set-action'; b.textContent=row.action;
    b.onclick=async()=>{
      b.disabled=true;
      try{ announce(await row.run()); }
      catch(err){ noteError(err,'settings-'+row.id); announce('That did not work.'); }
      b.disabled=false;
    };
    head.appendChild(b);
  } else if (row.kind==='note'){
    /* A one-word value ("English") sits on the right of its label; a sentence
       ("0 gardens saved · 4.7 MB used · the browser may clear it…") squeezes
       the label into two lines and reads as a collision. block:true gives the
       value its own line under the label instead. */
    const v=document.createElement('span');
    v.className='set-value'+(row.block?' set-value-block':'');
    v.textContent=row.value;
    /* Async values fill in place rather than blocking the open: the storage
       estimate is a round trip and settings must appear at once. */
    if (row.fill){
      v.id='setNote-'+row.id;
      Promise.resolve(row.fill()).then(t=>{
        const live=document.getElementById(v.id); if (live) live.textContent=t;
      },()=>{});
    }
    head.appendChild(v);
  }
  el.appendChild(head);
  if (row.kind==='choice') el.appendChild(settingsChoiceGroup(row,announce));
  if (row.kind==='links'){
    const nav=document.createElement('div'); nav.className='set-links';
    row.links.forEach(l=>{
      const a=document.createElement('a'); a.className='ext-link';
      a.href=l.href; a.textContent=l.text; nav.appendChild(a);
    });
    el.appendChild(nav);
  }
  if (row.hint) el.appendChild(settingsHint(row.hint));
  return el;
}
function renderSettings(){
  const body=$('settingsBody'); if (!body) return;
  const announce=msg=>{ if (msg) toast(msg); };
  const frag=document.createDocumentFragment();
  settingsSections().forEach(sec=>{
    const s=document.createElement('section'); s.className='set-section';
    const h=document.createElement('h3'); h.textContent=sec.title; s.appendChild(h);
    sec.rows.forEach(r=>s.appendChild(settingsRowEl(r,announce)));
    frag.appendChild(s);
  });
  body.replaceChildren(frag);
}
/* aria-expanded is managed here rather than through openOverlay's controller
   lookup: two buttons open this dialog (the menu gear and the garden menu's
   row), and that lookup takes the FIRST [aria-controls] match, which would
   leave the wrong one claiming to be expanded. Neither carries aria-controls,
   so the lookup finds nothing and this owns it. */
let settingsOpener=null;
function openSettings(opener){
  funnel(FUNNEL_EVENTS.settingsOpened);
  /* Counted per OPEN rather than from settingsSections(), which is pure and is
     re-run on every row change — three theme taps would otherwise read as three
     views of a section nobody scrolled to. */
  if (PREMIUM_ENABLED) funnel(FUNNEL_EVENTS.premiumViewed);
  settingsOpener=opener||null;
  renderSettings();
  if (settingsOpener) settingsOpener.setAttribute('aria-expanded','true');
  openOverlay('settingsScreen','.set-choice-opt');
}
function closeSettings(){
  closeOverlay('settingsScreen');
  if (settingsOpener) settingsOpener.setAttribute('aria-expanded','false');
  settingsOpener=null;
}
if ($('btnSettings')) $('btnSettings').onclick=()=>openSettings($('btnSettings'));
if ($('btnSettingsClose')) $('btnSettingsClose').onclick=closeSettings;
if ($('btnSettingsX')) $('btnSettingsX').onclick=closeSettings;
if ($('settingsScreen')) $('settingsScreen').onclick=e=>{
  if (e.target===$('settingsScreen')) closeSettings();
};

/* ---------- planting schemes: several plantings over one shared site plan ----------
   Creation lives here in the Garden Menu (an infrequent, garden-scoped action,
   beside Plant filters and Design plan); switching lives on the top-bar chip,
   which only exists once there is something to switch between. */
function syncSchemeLabel(){ hudText('schemeLbl',String(schemeCount())); }
function renderSchemeManager(){
  const list=$('schemeList'); if (!list) return;
  list.innerHTML='';
  const only=schemeCount()<2;
  schemeList().forEach(s=>{
    const on=s.id===game.schemeActive;
    const row=document.createElement('div'); row.className='scheme-row'+(on?' sel':'');
    const copy=document.createElement('span'); copy.className='scheme-row-copy';
    // rename in place: a text field inside a panel, like the plot and character
    // screens — a native prompt() would read as a stray browser dialog
    const nm=document.createElement('input'); nm.className='scheme-name'; nm.type='text';
    nm.value=s.name; nm.maxLength=32; nm.setAttribute('aria-label',`Name of ${s.name}`);
    nm.onchange=()=>{ if (renameScheme(s.id,nm.value)) syncSchemeLabel(); else nm.value=s.name; refreshCanvasTools(); };
    const meta=document.createElement('span'); meta.className='scheme-row-meta';
    // the active scheme's plants are live in game.plants; the others hold their own
    const maps=on?[game.plants,game.bulbs]:[s.plants,s.bulbs];
    let n=0; for (const m of maps) for (const k in (m||{})) if (m[k] && !m[k].removed) n++;
    meta.textContent=`${n} plant${n===1?'':'s'}${on?' · showing':''}`;
    copy.append(nm,meta);
    const pick=document.createElement('button'); pick.className='scheme-pick'; pick.type='button';
    pick.textContent=on?'Showing':'Show'; pick.disabled=on;
    pick.title=on?`${s.name} is showing`:`Show ${s.name}`;
    // close on the way out: you asked to look at this scheme, and the panel
    // (with its scrim) sits over the garden you are trying to look at. Repeated
    // A/B lives on the chip and the [ ] keys, so the manager is for setup.
    pick.onclick=()=>{ switchScheme(s.id); closeOverlay('schemeScreen'); };
    const del=document.createElement('button'); del.className='scheme-act danger'; del.type='button';
    del.textContent='Delete'; del.title=only?'A garden keeps at least one scheme':`Delete ${s.name}`;
    del.disabled=only;
    del.onclick=()=>showConfirm(`Delete "${s.name}"?`,
      'The plants in this scheme go with it. Your beds, paths and buildings are shared, so they stay.',
      'Delete scheme',
      ()=>{ if (deleteScheme(s.id)){ renderSchemeManager(); syncSchemeLabel(); } });
    row.append(copy,pick,del);
    list.appendChild(row);
  });
  const full=schemeCount()>=MAX_SCHEMES;
  $('btnSchemeNewEmpty').disabled=full;
  $('btnSchemeNewCopy').disabled=full;
  // "Duplicate from existing" copies the ACTIVE scheme; on a list of six that is
  // not obvious from the label, so name the source rather than rename the button
  $('btnSchemeNewCopy').title=`Copy "${activeSchemeName()}" into a new scheme`;
  $('schemeNote').textContent = full
    ? `A garden holds up to ${MAX_SCHEMES} planting schemes.`
    : `Duplicating copies "${activeSchemeName()}". Switch schemes from the chip beside the season box, or with [ and ].`;
  syncSchemeLabel();
}
function openSchemeManager(){
  closeOverlay('gardenMenu');
  ensureSchemes(); renderSchemeManager();
  openOverlay('schemeScreen','.scheme-pick');
}
if ($('btnSchemes')) $('btnSchemes').onclick=openSchemeManager;
if ($('btnSchemeClose')) $('btnSchemeClose').onclick=()=>closeOverlay('schemeScreen');
if ($('btnSchemeNewEmpty')) $('btnSchemeNewEmpty').onclick=()=>{ if (createScheme(false)) renderSchemeManager(); };
if ($('btnSchemeNewCopy')) $('btnSchemeNewCopy').onclick=()=>{ if (createScheme(true)) renderSchemeManager(); };
$('schemeScreen').onclick=(e)=>{ if (e.target===$('schemeScreen')) closeOverlay('schemeScreen'); };
if ($('btnPlantGuidanceClose')) $('btnPlantGuidanceClose').onclick=()=>closeOverlay('plantGuidanceScreen');
if ($('plantGuidanceScreen')) $('plantGuidanceScreen').onclick=e=>{ if (e.target===$('plantGuidanceScreen')) closeOverlay('plantGuidanceScreen'); };
/* Edits autosave after settling, even with time paused. Lifecycle/day saves
   flush immediately; only saveSolo may mark a successful write clean. */
function autosaveNow(){ if (game.inGarden&&hasStorage) return saveSolo(true); }
addEventListener('visibilitychange',()=>{
  if (document.hidden){ landSkipNow(); suspendClock(); autosaveNow(); }
  else {
    resumeClockSession(); updateHUD(); showDeferredGardenNotice();
    // Coming back to a tab is when it is most likely to be behind another one.
    if (game.inGarden) checkGardenFresh().then(r=>{ if (r) onGardenStale(r,true); });
  }
});
/* ---------- the garden was changed in another tab ----------
   io.js decides THAT this tab is behind (the stamp on the garden's row; see "a
   garden open in two tabs" there). This is what the gardener sees.

   A tab with no edits of its own that is brought back to the front simply loads
   the newer version: there is nothing to choose between, and asking would only
   be a chance to pick wrong. Anywhere else the tab stops saving over the other
   version and says so, in a bar that stays until it is answered:
   - changed: Load latest (asks first if this tab has edits, which it drops), or
     Keep mine as a copy (this tab's version saved beside the other one).
   - deleted: Keep it (saved back to the list) or Close (asks first if this tab
     has edits, then leaves without saving).
   It is a bar and not a modal for the update bar's reason: the garden in this
   tab is still worth looking at, and nothing is lost while the question waits.
   It never auto-reloads a tab that is merely on screen beside the one being
   worked in: two windows side by side would reload on every save made in the
   other, which is a lot of work for a tab nobody is looking at. */
function syncStaleBar(){
  const bar=$('staleBar'); if (!bar) return;
  const reason=game.inGarden && game.worldId && saveSession.syncId===game.worldId ? saveSession.stale : null;
  bar.hidden=!reason;
  if (document.body) document.body.classList.toggle('has-stale',!!reason);
  if (!reason) return;
  const deleted=reason==='deleted';
  hudText('staleBarText', deleted
    ? 'This garden was deleted in another tab.'
    : 'This garden was changed in another tab, so this tab can’t save over it.');
  hudText('btnStalePrimary', deleted ? 'Keep it' : 'Load latest');
  hudText('btnStaleSecondary', deleted ? 'Close' : 'Keep mine as a copy');
}
function onGardenStale(reason,returning){
  if (!game.inGarden) return;
  if (reason==='changed' && returning && !gardenEditedSinceSync()
      && !pendSnap && !canvasGestureWouldLoseWork()){
    reloadLatestGarden(true); return;
  }
  syncStaleBar();
}
/* The overlays that show this garden's contents. Leaving the garden closes them,
   and so does reloading it, or they would go on describing the version left behind. */
function closeGardenOverlays(){
  closeOverlay('exportScreen',false); closeOverlay('discoveryFilterScreen',false); closeOverlay('paletteScreen',false);
  closeOverlay('planScreen',false); closeOverlay('bloomScreen',false);
  closeOverlay('pauseScreen',false);
  closeOverlay('gardenMenu',false);
}
async function reloadLatestGarden(auto){
  const id=game.worldId; if (!id || !game.inGarden) return false;
  closeGardenOverlays(); hidePlantCard();
  saveSession.stale=null; syncStaleBar();
  const ok=await enterWorld(id);
  if (ok) toast(auto ? 'This garden was changed in another tab. Showing the latest version.'
                     : 'Showing the latest version of this garden.');
  return ok;
}
let deferredGardenNotice='';
function showDeferredGardenNotice(){
  if (!deferredGardenNotice) return;
  const msg=deferredGardenNotice; deferredGardenNotice='';
  toast(msg,'warn');
}
/* A tab behind another one saved its edits as a copy (io.js): from the stale
   bar's Keep mine as a copy, or because it was quitting or going into the
   background when it found out. Say where the edits went, now or when the tab is
   next looked at. */
function onGardenForked(info,adopted){
  if (adopted && game.inGarden && $('worldLabel')) $('worldLabel').textContent=info.name;
  syncStaleBar();
  const why=info.reason==='deleted' ? 'was deleted' : 'was changed';
  const msg=`Your edits were saved as "${info.name}" because "${info.from}" ${why} in another tab.`;
  if (pageHidden()) deferredGardenNotice=msg; else toast(msg,'warn');
}
if ($('btnStalePrimary')) $('btnStalePrimary').onclick=()=>{
  const reason=saveSession.stale; if (!reason || !game.inGarden) return;
  if (reason==='deleted'){
    // Back into the list under its own id: a session that has not synced with
    // a garden has nothing to be behind (gardenConflict), so the save writes.
    saveSession.syncId=null; saveSession.stale=null; syncStaleBar();
    saveSolo(true).then(ok=>{ if (ok) toast('Kept. This garden is back in your list.'); });
    return;
  }
  if (!gardenEditedSinceSync()){ reloadLatestGarden(false); return; }
  showConfirm('Load the latest version?',
    'The edits made in this tab since it last saved will be lost. To keep them, choose Keep mine as a copy instead.',
    'Load latest', ()=>{
      // A save of this tab already on its way must not turn the dropped edits into a copy.
      saveSession.discard=true;
      reloadLatestGarden(false);
    });
};
if ($('btnStaleSecondary')) $('btnStaleSecondary').onclick=()=>{
  const reason=saveSession.stale; if (!reason || !game.inGarden) return;
  if (reason==='deleted'){
    const leave=()=>{ saveSession.discard=true; quitToMenu(); };
    if (!gardenEditedSinceSync()){ leave(); return; }
    showConfirm('Close without saving?',
      'This garden was deleted in another tab, and the edits made here will not be kept.',
      'Close', leave);
    return;
  }
  saveSession.fork=true;
  saveSolo(true);
};
addEventListener('pagehide',()=>{ landSkipNow(); suspendClock(); autosaveNow(); });
if ($('btnDayNight')) $('btnDayNight').onclick=()=>{ setLayerVis('night',!game.layerVis.night);
  updateDayNightBtn(); refreshCanvasTools();
  toast(game.layerVis.night?'Night — your garden lighting switches on.':'Back to daylight.'); };
if ($('btnPause')) $('btnPause').onclick=toggleClock;
// the season box: hold to fast-forward time, tap to toggle the time menu.
// The box stays pressable while the menu is open (see openPause's z-lift),
// so a hold always fast-forwards — starting one dismisses the dropdown so
// the garden underneath is visible while time runs.
/* Driven from frame() so the hold deadline does not depend on a timer getting
   an event-loop turn. See armFastForward below. */
let pollFastForwardHold=()=>{};
(function wireSeasonBox(){
  const box=$('btnSeasonBox'); if (!box) return;
  const HOLD_MS=360;
  let holdTimer=null, ffStarted=false, pressActive=false, pressAt=0;
  const resetFF=()=>{
    const wasFast=ffStarted;
    if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    pressAt=0;
    game.ffActive=false; ffStarted=false;
    box.classList.remove('hold-arming','fast-forwarding');
    box.setAttribute('aria-label','Time — tap for controls, hold to fast-forward');
    // The hold itself writes nothing (see the day-change note in ui.js), so
    // the clock is banked here, once, however the hold ended.
    if (wasFast && game.inGarden && hasStorage) saveSolo(true);
    return wasFast;
  };
  const cancelFF=()=>{ pressActive=false; resetFF(); };
  /* One idempotent activation, reached from the 360ms timer OR from the
     animation frame — because under load the timer does not arrive.

     Firefox prioritises the refresh driver, so when the main thread is
     saturated by rendering a normal-priority timer can simply be starved. Not
     theoretical: in a 23.05s Gecko profile of a heavy garden, 320 long tasks
     totalling 22.90s (median 71.4ms) left the thread ~99% busy, and across
     FOUR long presses — held 5737, 4618, 1180 and 3649ms — the 360ms callback
     never ran. The only timer callbacks inside those holds fired at +70..74ms
     and belonged to something else. Meanwhile all four `--hold-sweep` CSS
     transitions completed on schedule, because the compositor drives those,
     which is why the button LOOKED like it was arming the whole time. Each
     press then released still in `hold-arming`, took the short-tap path, and
     toggled the Time menu — so a five-second hold read as a tap, and
     fast-forward appeared not to work at all on the one garden heavy enough
     to starve the timer.

     The frame loop is the one thing guaranteed to run here — it IS the work
     starving the timer — so the deadline is checked there too. The timer
     stays: it is what makes activation crisp at 360ms on an idle thread,
     where the next frame might be up to a frame late. */
  const armFastForward=()=>{
    if (ffStarted || !pressActive) return;                 // idempotent
    if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    game.ffActive=true; ffStarted=true; closePause();
    box.classList.remove('hold-arming'); box.classList.add('fast-forwarding');
    box.setAttribute('aria-label','Time — fast-forwarding while held');
    hapticFeedback('success');
  };
  pollFastForwardHold=()=>{
    if (pressActive && !ffStarted && pressAt && performance.now()-pressAt>=HOLD_MS)
      armFastForward();
  };
  box.addEventListener('pointerdown',e=>{
    e.preventDefault(); dismissCoachTip(); resetFF(); pressActive=true;
    box.classList.add('hold-arming');
    try{ box.setPointerCapture(e.pointerId); }catch(_){ }
    pressAt=performance.now();
    holdTimer=setTimeout(armFastForward,HOLD_MS);
  });
  box.addEventListener('pointerup',()=>{
    if (!pressActive) return;
    pressActive=false;
    const wasFast=resetFF();
    if (!wasFast){
      if (!$('pauseScreen').classList.contains('hidden')) closePause();
      else openPause();
    }
  });
  box.addEventListener('click',e=>{
    if (e.detail!==0) return;          // pointer clicks are handled above
    if (!$('pauseScreen').classList.contains('hidden')) closePause(); else openPause();
  });
  box.addEventListener('pointerleave',cancelFF);
  box.addEventListener('pointercancel',cancelFF);
  box.addEventListener('lostpointercapture',()=>{ if (pressActive) cancelFF(); });
})();
// the menu's primary button now pauses or resumes, since the dial's Pause button is gone
$('btnPauseResume').onclick=()=>{ if (game.pausedAt) resumeClock(); else pauseClock(); closePause(); updateHUD(); };
// the time menu dismisses via a document-level outside-press listener
// (openPause/closePause in ui.js) — its backdrop is pointer-transparent so
// the season box keeps working while the menu is open
$('btnSkipSeason').onclick=skipNextSeason;   // skip straight away — no confirm
$('btnSkipYear').onclick=skipNextYear;
if ($('btnPreviewToday')) $('btnPreviewToday').onclick=()=>setPreviewMode('today');
if ($('btnPreviewEstablished')) $('btnPreviewEstablished').onclick=()=>setPreviewMode('established');
$('btnExport').onclick=()=>{ closeOverlay('gardenMenu'); openExport(); };
$('btnExportClose').onclick=()=>closeOverlay('exportScreen');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;
$('btnFilters').onclick=()=>{ closeOverlay('gardenMenu'); openFilters(); };
if ($('btnDiscoveryApply')) $('btnDiscoveryApply').onclick=applyDiscoveryFilters;
if ($('btnDiscoveryClose')) $('btnDiscoveryClose').onclick=()=>{ discoveryCriteriaDraft=null; discoveryStyleDraft=null; closeOverlay('discoveryFilterScreen'); };
if ($('btnPaletteClose')) $('btnPaletteClose').onclick=()=>{ palettePendingRef=null; paletteRenameId=null; closeOverlay('paletteScreen'); };
if ($('btnPaletteCreate')) $('btnPaletteCreate').onclick=createPaletteFromInput;
if ($('paletteName')) $('paletteName').onkeydown=e=>{ if (e.key==='Enter'){ e.preventDefault(); createPaletteFromInput(); } };
if ($('btnRotate')) $('btnRotate').onclick=()=>rotateView(1);
$('btnPlan').onclick=()=>{ closeOverlay('gardenMenu'); openPlan(); };
$('btnPlanClose').onclick=()=>closeOverlay('planScreen');
$('btnPlanPng').onclick=downloadPlan;
// sheet set: both are already drawn, so switching is a visibility flip
$('btnPlanSheetPlanting').onclick=()=>setPlanSheet('planting');
$('btnPlanSheetBulbs').onclick=()=>setPlanSheet('bulbs');
$('btnPlanSheetSchedule').onclick=()=>setPlanSheet('schedule');
$('btnPlanList').onclick=()=>{ closeOverlay('planScreen'); openExport(); };
$('btnBloom').onclick=()=>{ closeOverlay('gardenMenu'); openBloomCalendar(); };
$('btnBloomClose').onclick=()=>closeOverlay('bloomScreen');
$('btnAct').onclick=()=>{ if (ENABLE_MOBILE_ACT_BUTTON) actHere(); };
if ($('btnZoomOut')) $('btnZoomOut').onclick=()=>zoomBy(0.89);
if ($('btnZoomIn')) $('btnZoomIn').onclick=()=>zoomBy(1.12);
if ($('btnZoomFit')) $('btnZoomFit').onclick=()=>fitPlot();
if ($('btnLibraryToggle')) $('btnLibraryToggle').onclick=toggleLibrary;
if ($('btnLibraryPlacing')) $('btnLibraryPlacing').onclick=()=>setSheetState('full');
(function wireSheetHandle(){
  const h=$('sheetHandle'); if (!h) return;
  const down=$('btnSheetDown'), up=$('btnSheetUp');
  let drag=null;
  h.addEventListener('pointerdown',e=>{
    // the chevrons and the Plants/Landscape switch are buttons, not the grip
    if (e.target.closest && e.target.closest('.sheet-actions,.sheet-mode')) return;
    drag={y:e.clientY,moved:false};
    h.classList.add('dragging');
    try{ h.setPointerCapture(e.pointerId); }catch(_){}
  });
  h.addEventListener('pointermove',e=>{
    if (!drag) return;
    if (Math.abs(e.clientY-drag.y)>10) drag.moved=true;
  });
  const finish=e=>{
    if (!drag) return;
    const dy=e.clientY-drag.y, moved=drag.moved;
    drag=null;
    h.classList.remove('dragging');
    if (moved && Math.abs(dy)>28) nudgeCatalogHandle(dy<0?1:-1);
    else nudgeCatalogHandle(normalizedSheetState(game.sheetState)==='collapsed'?1:-1);
  };
  h.addEventListener('pointerup',finish);
  h.addEventListener('pointercancel',()=>{ drag=null; h.classList.remove('dragging'); });
  if (down) down.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(-1); };
  if (up) up.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(1); };
})();

/* ---------- menu background: a planted border ----------
   The title screen is a planting, drawn by the same drawPlant the garden uses,
   and it is the backdrop of every screen reached from the menu (gardens list,
   questionnaire, plot setup, daily brief).

   It used to be 54 plants scattered along the bottom edge at 58-72% opacity,
   every one redrawn procedurally every frame: measured ~33ms of JavaScript a
   frame at 1024x768, for a picture that read as confetti on a dark gradient.
   Now each season is a PLANTING SCHEME, the way a border is designed: a matrix
   of grasses the rest sits in, drifts of forbs that come round again across the
   width, a few tall emergents standing through them, low plants along the
   front. It runs from a hazed far field to foreground clumps under a low sun,
   so the colour is the plants' own.

   Two halves, deliberately. menuBorderPlan is PURE: season, size and scheme in,
   a list of who stands where out, with no canvas in it, so the layout can be
   tested. menuBorderBuild bakes that plan once into images; a frame is then
   blits (~0.5ms of JavaScript at 1024x768) and the wind is a shear on each
   blit, the garden's own sprite trick. The build is a generator stepped a few
   ms per animation frame, so the border that is up keeps moving while the next
   one is planted behind it, and the two crossfade.

   What it costs is memory, so three things bound it. Near sprites share a byte
   budget (MENU_BORDER.MEM) and are baked a little soft on a very large canvas
   rather than exceed it. The part of a front-row clump below the bottom of the
   screen is never baked. And the whole border is released when a garden opens,
   so it never sits beside the garden's own sprite cache.

   Sprites are ImageBitmaps where the garden's are (spriteBakeSurface): in
   Firefox a frame of small-canvas blits is a frame of texture uploads, and
   enough of those take a canvas off the GPU for good (renderer.js has the
   record). Nothing here uses backdrop-filter either; legibility is a shade
   painted into the picture. */
const mcnv=$('menuCanvas'), mcx=mcnv.getContext('2d');
setActiveCanvas(mcnv);
/* sky: stops from the top of the canvas (0) to the horizon (1). land: horizon,
   mid, foreground. shade: the rgb of the shadow the title stands in. accent:
   what the title's italic word and eyebrow take for the season; it sits on that
   shade in both themes, so it is a light colour in both. */
const MENU_SCENES={
  Spring:{ seed:1207, accent:'#c8dd8e', shade:'14,26,24', pageBg:'#0e1714', bloom:1,
    sky:[[0,'#3f637a'],[.34,'#7aa3b2'],[.64,'#c6d8c4'],[.86,'#eee9c2'],[1,'#f6f0cc']], sunX:.74, sun:'255,250,212', haze:'#dde8cc',
    land:['#a6c27c','#5d8345','#1e2b17'],
    matrix:['switchgrass','pennsedge','bluestem','tuftedhair','sesleria'],
    drifts:['amsonia','baptisia','peony','catmint','euphorbiawulfenii','germaniris','meadowsage','camassialeichtlinii','woodlandphlox','orientalpoppy','goldenalexander','easternbluestar','columbine','spiderwort','globeflower','bluebells'],
    emergents:['baptisia','euphorbiawulfenii','karl','ostrichfern'],
    front:['daffodil','muscari','gardentulip','cushionspurge','blueoatgrass','hakone','prairiesmoke','hyacinth','lambsear'] },
  Summer:{ seed:3391, accent:'#ecaac4', shade:'16,27,20', pageBg:'#0f170f', bloom:1,
    sky:[[0,'#356482'],[.36,'#739fb2'],[.66,'#bfd4c0'],[.86,'#ece5b6'],[1,'#f6ecc0']], sunX:.72, sun:'255,245,196', haze:'#d6e2c2',
    land:['#93b06c','#4f7140','#1b2915'],
    matrix:['bluestem','dropseed','mexicanfeather','switchgrass','tuftedhair'],
    drifts:['echinacea','monarda','catmint','russiansage','liatrisspicata','agastache','amsonia','baptisia','mountainmint','echinops','helenium','persicaria','allium','yarrow','rudbeckia','scarletbeebalm','pallida','peony'],
    emergents:['karl','culvers','rattlesnake','joepye','rudbeckiamaxima','giantstipa','liatrispycnostachya'],
    front:['catmint','calamint','allium','stachys','blueoatgrass','lambsear','butterfly','sesleria'] },
  Fall:{ seed:5521, accent:'#e6a565', shade:'25,15,18', pageBg:'#130c0c', bloom:1,
    sky:[[0,'#2a1f31'],[.30,'#5a3e4e'],[.56,'#a7675a'],[.80,'#e0a367'],[1,'#f2cb8b']], sunX:.70, sun:'255,216,150', haze:'#dcaa78',
    land:['#b48d54','#6f5331','#231711'],
    matrix:['bluestem','dropseed','switchgrass','bluestem','tuftedhair'],
    drifts:['amsonia','pinkmuhly','roughgoldenrod','newengland','lovegrass','smoothaster','persicaria','helenium','sedum','russiansage','baptisia','bluemistflower','prairieironweed','japaneseanemone','echinacea','rudbeckiatriloba','goldenrod'],
    emergents:['bigbluestem','indiangrass','molinia','miscanthus','karl','joepye'],
    front:['sedum','autumnfire','lovegrass','rubymuhly','aster','calamint','sesleria','matrona'] },
  Winter:{ seed:7741, accent:'#c2d5e2', shade:'15,21,30', pageBg:'#0e131a', bloom:undefined, snow:true,
    sky:[[0,'#263141'],[.36,'#596a7d'],[.64,'#a6b0b9'],[.86,'#dbd6cd'],[1,'#eee4d4']], sunX:.66, sun:'255,238,216', haze:'#d9d8d3',
    land:['#dedcd4','#aeada5','#4b4a47'],
    matrix:['bluestem','switchgrass','dropseed','tuftedhair','moorhexe'],
    drifts:['echinacea','rudbeckia','sedum','baptisia','amsonia','russiansage','monarda','matrona','helenium','pinkmuhly','lovegrass','blueoatgrass','agastache','culvers','persicaria'],
    emergents:['bigbluestem','indiangrass','karl','molinia','miscanthus','joepye','rattlesnake'],
    front:['sedum','blueoatgrass','dropseed','lentenrose','christmasfern','matrona','sesleria'] }
};
const MENU_SCHEME_PARTS=['matrix','drifts','emergents','front'];
/* ROWS: each row of the border, as a fraction of the way from the horizon to
   the bottom edge; a plant's scale follows the same number, which is what
   perspective is. The first FAR rows are stamped small into one still layer and
   veiled row by row, so distance hazes out; the rest are a sprite a clump. */
const MENU_BORDER={
  ROWS:[.006,.018,.034,.054,.08,.112,.15,.20, .285,.40,.56,.77,1.04], FAR:8,
  FAR_VEIL:[.16,.15,.14,.13,.12,.10,.08,.05], NEAR_TINT:[.07,.04,0,0,0],
  MEM:48*1048576,       // bytes of near sprites one border may hold
  /* Planting per animation frame, while frames arrive at speed: a SHARE of the
     display's frame interval, between STEP_MIN_MS and STEP_MS (menuBakeBudget). */
  STEP_SHARE:.3, STEP_MIN_MS:1.5, STEP_MS:6,
  SETTLE_MS:140,        // a resize holds still this long before the border is replanted
  /* FIRST_MS is the planting coming up over the bare sky, on a cold start and back
     from a garden: 600ms of it was most of the wait before the menu looked done. */
  FADE_MS:950, SWAP_MS:260, FIRST_MS:300,
  /* the title column, as styles.css lays it out (.menu-shell). The shade is
     fitted to it from these rather than from a layout read; a test holds the
     two together. */
  SHELL_MIN:28, SHELL_VW:.065, SHELL_MAX:112, SHELL_W:430,
  /* The border turns to the next season after this long on screen (menuSeasonTurn).
     It used to turn on every return to the menu, Back from any screen included,
     which made each Back a whole replant. */
  TURN_MS:90000,
  /* A frame's planting while no planted border is on screen: the sky alone stands
     still, so there is no movement for a busy GPU to stutter, and the first
     border of a visit is what decides how quickly the menu looks finished. */
  FIRST_STEP_MS:16,
};
let menuSeason='Fall';
/* menuSeasonHeld: a season dot was pressed, so the border keeps that season for
   the rest of the visit. menuSeasonOnShowMs: time a finished border has been on
   screen in this season. */
let menuSeasonHeld=false, menuSeasonOnShowMs=0;
let menuBorder=null, menuJob=null, menuBorderSeq=0;
let menuPalette=null, menuPaletteSig='';         // the questionnaire's style palette, or none
let menuSizeKey='', menuSizeAt=-Infinity;
let menuFade=null, menuFadeCv=null, menuShadeA=1, menuDrawnSig='';
let menuRetired=[];
const menuPipButtons=[];

function menuHash(n){ let x=Math.imul((n|0)^0x9e3779b9,0x85ebca6b); x^=x>>>13; x=Math.imul(x,0xc2b2ae35); x^=x>>>16; return (x>>>0)/4294967296; }
function menuKeySeed(s){ let h=7; for (let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return (h%1e9)|0; }
function menuRgb(hex){ const n=parseInt(hex.slice(1),16); return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255); }
function menuSeasonColour(k,season){ const s=(plantDef(k).sea||{})[season]||{}; return s.bloom||s.seed||s.fol||'#8a8a70'; }
function setMenuViewportFill(){
  const sc=MENU_SCENES[menuSeason]||MENU_SCENES.Fall;
  setViewportFill(sc.pageBg||'#241a16');
}
/* The design questionnaire replants the border behind it to match the chosen
   style + zone, so a choice visibly changes the world, not just a form. Reuses
   the tray's own plantStyleScore ranking (herbaceous only, no trees in the
   backdrop) filtered to the zone; 'Any garden' (no style weights) keeps the
   season's own scheme. */
function styleMeadowKeys(type, zone, criteria){
  if (!type || !STYLE_ROLE_WEIGHTS[type]) return null;
  const herb=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge'||t==='forb'||t==='bulb'; };
  const f=normalizeFilters(Object.assign({},criteria||{},{zone}));
  const fits=k=>!PLANTS[k].hidden && herb(k) && passesNativeFilter(PLANTS[k],f) &&
    (!zone || (PLANTS[k].zones[0]<=zone && PLANTS[k].zones[1]>=zone));
  const ranked=PLANT_KEYS.filter(fits)
    .map(k=>[k,plantStyleScore(k,type,null,f)]).filter(e=>e[1]>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>e[0]);
  return ranked.length>=4 ? ranked : null;
}
/* A ranked style palette is a flat list; a border needs to know who is the
   matrix and who stands through it. Grasses and sedges are the matrix where the
   style has any, the tallest few are the emergents, the lowest the front. */
function menuSchemeFromKeys(keys){
  const grassy=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge'; };
  const tall=k=>plantVisualH(plantDef(k))||0;
  const grasses=keys.filter(grassy), forbs=keys.filter(k=>!grassy(k));
  const byH=keys.slice().sort((a,b)=>tall(b)-tall(a));
  return {
    matrix: grasses.length ? grasses.slice(0,4) : forbs.slice(0,3),
    drifts: forbs.length ? forbs : grasses,
    emergents: byH.slice(0,Math.max(1,Math.min(3,Math.floor(keys.length/4)))),
    front: byH.slice(-4).reverse(),
  };
}
/* The species are swapped over the same ground: the rows and the outlines of
   the drifts are seeded by the season, not the palette, so a style choice reads
   as the border being replanted where it stands rather than as a new picture. */
function applyMeadowPalette(type, zone, criteria){
  const keys=styleMeadowKeys(type,zone,criteria), sig=keys?keys.join(','):'';
  if (sig===menuPaletteSig) return;
  menuPaletteSig=sig; menuPalette=keys?menuSchemeFromKeys(keys):null;
}
function syncMenuSeasonChrome(){
  const name=$('menuKeySeason'); if (name && name.textContent!==menuSeason) name.textContent=menuSeason;
  for (const b of menuPipButtons) b.setAttribute('aria-pressed',String(b.dataset.season===menuSeason));
}
function setMenuSeason(season, remember){
  if (!MENU_SCENES[season]) return;
  menuSeason=season; menuSeasonOnShowMs=0;
  if (remember && hasStorage){ try{ localStorage.setItem('hortus:menuSeasonIdx',String(SEASONS.indexOf(season))); }catch(_){ } }
  setMenuViewportFill();
  /* The title turns colour here, not when the border lands: the 900ms it takes
     then runs alongside the planting and the crossfade instead of after them,
     and the first paint of a visit already has the season's colour. */
  document.documentElement.style.setProperty('--menu-accent',MENU_SCENES[season].accent);
  syncMenuSeasonChrome();
}
/* Opening the app starts on the season after the last one shown, so the next
   visit carries on from there. Within a visit the border turns on its own
   (menuSeasonTurn), and a press on one of the four dots holds it. */
function advanceMenuSeason(){
  let next=0;
  if (hasStorage){
    const raw=localStorage.getItem('hortus:menuSeasonIdx');
    next=((raw===null?-1:(parseInt(raw,10)||0))+1)%SEASONS.length;
    try{ localStorage.setItem('hortus:menuSeasonIdx',String(next)); }catch(_){}
  } else {
    next=(SEASONS.indexOf(menuSeason)+1)%SEASONS.length;
  }
  menuPalette=null; menuPaletteSig='';      // back from the questionnaire: the season's own scheme
  setMenuSeason(SEASONS[next],false);
}
/* Back on the menu: the border stands in the season it was showing, with the
   season's own plants again if the New garden page had replanted it in a style.
   Clearing a palette that is not set moves no key, so a plain Back plants
   nothing. It used to advance the season here, so every Back was a replant. */
function menuSeasonOwnScheme(){ menuPalette=null; menuPaletteSig=''; }
/* The next season, once a finished border has been on screen for TURN_MS. Only
   time on screen counts: not a covered menu (menuBorderWork is not called), not
   a hidden tab (a long gap counts as a quarter second), and not the planting or
   the crossfade. A held season does not turn, and neither does a reader who has
   asked for less motion: an automatic change every minute and a half is exactly
   what that setting is for. */
function menuSeasonTurn(gap){
  if (menuSeasonHeld || reducedMotion() || !menuBorder || !menuBorder.ready || menuJob || menuFade) return;
  menuSeasonOnShowMs+=Math.min(250,Math.max(0,gap||0));
  if (menuSeasonOnShowMs<MENU_BORDER.TURN_MS) return;
  setMenuSeason(SEASONS[(SEASONS.indexOf(menuSeason)+1)%SEASONS.length],true);
}

/* Who stands where. Pure: no canvas, no clock, no Math.random. Every row has
   its own seeded stream and walks left to right, so a wider window keeps the
   plants it had and adds more to the right. */
function menuBorderPlan(season,W,H,sheet,scheme){
  const S=MENU_SCENES[season]||MENU_SCENES.Fall, P=scheme||S, B=MENU_BORDER, ROWS=B.ROWS, R=ROWS.length;
  const U=Math.max(.8,Math.min(3,H/860))*(sheet?.9:1);
  const horizon=Math.round(H*(sheet?.635:.565)), depth=H-horizon, gxs=(sheet?2.3:1)/H;
  // drifts: ellipses on the ground plane, each species coming round again
  const rb=mulberry(S.seed), blobs=[]; let order=[];
  for (let gx=-.25; gx<4.4; gx+=.10+rb()*.05){
    if (!order.length){
      order=P.drifts.slice();
      for (let i=order.length-1;i>0;i--){ const j=(rb()*(i+1))|0, o=order[i]; order[i]=order[j]; order[j]=o; }
    }
    blobs.push({k:order.pop(), cx:gx, cd:.06+rb()*.9, rx:.09+rb()*.14, rd:.07+rb()*.14});
  }
  const matrixAt=(gx,d)=>P.matrix[Math.min(P.matrix.length-1,(menuHash(Math.floor(gx*2.7+d*1.9)+S.seed)*P.matrix.length)|0)];
  // forbs stand closer together than grasses, so a drift has mass
  const close=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge' ? 1 : t==='bulb' ? .5 : .66; };
  const grassy=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge'; };
  function pick(gx,d,r,rr){
    if (r===R-1){
      if (rr()<.14) return P.matrix[(rr()*P.matrix.length)|0];
      return P.front[Math.min(P.front.length-1,(menuHash(Math.floor(gx*3.4)+S.seed*3)*P.front.length)|0)];
    }
    for (const b of blobs){
      const dx=(gx-b.cx)/b.rx, dd=(d-b.cd)/b.rd;
      if (dx*dx+dd*dd<1+(rr()-.5)*.4) return rr()<.14 ? matrixAt(gx,d) : b.k;
    }
    if (r>=5 && r<=R-2 && rr()<.085)
      return P.emergents[Math.min(P.emergents.length-1,(menuHash(Math.floor(gx*1.6+d*4)+S.seed*7)*P.emergents.length)|0)];
    return rr()<.22 ? P.matrix[(rr()*P.matrix.length)|0] : matrixAt(gx,d);
  }
  const gap=r=>depth*((ROWS[r+1]||ROWS[r]*1.3)-ROWS[r]);
  const far=[], near=[], tally=new Map(), note=(k,w)=>tally.set(k,(tally.get(k)||0)+w);
  for (let r=0;r<B.FAR;r++){
    const yf=ROWS[r], s=(.2+2.1*yf)*U, y=horizon+depth*yf, rr=mulberry(S.seed+r*977), step=24*s, stamps=[];
    for (let x=-50*s-rr()*step, k=null; x<W+50*s; x+=step*(.55+rr()*.9)*(k?close(k):1)){
      const jy=(rr()-.35)*gap(r), d=(r+jy/gap(r))/(R-1);
      k=pick(x*gxs,d,r,rr);
      stamps.push({k, v:(rr()*3)|0, x, y:y+jy, z:s*(.84+rr()*.34)});
      note(k,.25);
    }
    stamps.sort((a,b)=>a.y-b.y);
    far.push({veil:B.FAR_VEIL[r], stamps});
  }
  for (let r=B.FAR;r<R;r++){
    const yf=ROWS[r], s=(.2+2.1*yf)*U, y=horizon+depth*yf, rr=mulberry(S.seed+r*977);
    const last=r===R-1, step=(last?44:32)*s;
    for (let x=-60*s-rr()*step, i=0, k=null; x<W+60*s; x+=step*(.6+rr()*.8)*(k?close(k):1), i++){
      const jy=last?0:(rr()-.4)*gap(r)*.8, d=(r+jy/gap(r))/(R-1);
      k=pick(x*gxs,d,r,rr);
      const z=s*(.86+rr()*.3);
      near.push({k, row:r, x, y:y+jy, z, seed:(S.seed*31+r*7919+i*104729)|0,
        ph:rr()*6.28, amp:(grassy(k)?1.25:.8)*(.8+rr()*.4)});
      note(k,1+yf);
    }
  }
  near.sort((a,b)=>a.y-b.y);
  return {season, W, H, sheet:!!sheet, U, horizon, depth, far, near, tally};
}

/* ---- baking ---- */
function menuRetireImage(img){ if (img && typeof img.close==='function') menuRetired.push(img); }
function menuCloseRetired(){
  if (!menuRetired.length) return;
  for (const b of menuRetired){ try{ b.close(); }catch(_){ } }
  menuRetired=[];
}
function menuBakeSurface(w,h,paint){
  const s=spriteBakeSurface('menu',Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
  paint(s.getContext('2d'),s.width,s.height);
  return spriteBakeImage('menu',s);
}
function menuHills(g,W,H,base,amp,col,seed,rough){
  const r=mulberry(seed), a=[r()*6,r()*6,r()*6,r()*6];
  g.beginPath(); g.moveTo(-2,base+1);
  for (let x=-2;x<=W+3;x+=3){
    const u=x/(H*.3);
    g.lineTo(x, base-amp*(.42+.28*Math.sin(u*1.3+a[0])+.18*Math.sin(u*3.1+a[1])+.12*rough*Math.sin(u*9.7+a[2])+.07*rough*Math.abs(Math.sin(u*23+a[3]))));
  }
  g.lineTo(W+3,base+1); g.closePath(); g.fillStyle=col; g.fill();
}
/* Sky, sun, far hills and the ground the planting stands on. Half resolution:
   it is all gradients and one soft skyline, and at full size it was the single
   largest image a border held. */
function menuPaintBackground(S,W,H,horizon,dpr){
  const k=dpr/2;
  return menuBakeSurface(W*k,H*k,g=>{
    g.setTransform(k,0,0,k,0,0);
    const sky=g.createLinearGradient(0,0,0,horizon); S.sky.forEach(st=>sky.addColorStop(st[0],st[1]));
    g.fillStyle=sky; g.fillRect(0,0,W,horizon+2);
    const sx=W*S.sunX, sy=horizon-H*.012, rg=g.createRadialGradient(sx,sy,0,sx,sy,Math.max(W,H)*.6);
    rg.addColorStop(0,`rgba(${S.sun},.92)`); rg.addColorStop(.07,`rgba(${S.sun},.55)`);
    rg.addColorStop(.3,`rgba(${S.sun},.16)`); rg.addColorStop(1,`rgba(${S.sun},0)`);
    g.fillStyle=rg; g.fillRect(0,0,W,horizon+2);
    menuHills(g,W,H,horizon,H*.05,mixHex(S.haze,S.land[1],.30),S.seed+11,1);
    menuHills(g,W,H,horizon,H*.024,mixHex(S.haze,S.land[1],.52),S.seed+29,.6);
    const lg=g.createLinearGradient(0,horizon,0,H);
    lg.addColorStop(0,mixHex(S.land[0],S.haze,.45)); lg.addColorStop(.16,S.land[0]); lg.addColorStop(.5,S.land[1]); lg.addColorStop(1,S.land[2]);
    g.fillStyle=lg; g.fillRect(0,horizon,W,H-horizon);
    const sp=g.createRadialGradient(sx,horizon,0,sx,horizon,W*.42);   // the sun spilling onto the far field
    sp.addColorStop(0,`rgba(${S.sun},.42)`); sp.addColorStop(1,`rgba(${S.sun},0)`);
    g.save(); g.beginPath(); g.rect(0,horizon,W,(H-horizon)*.5); g.clip();
    g.transform(1,0,0,.28,0,horizon*.72); g.fillStyle=sp; g.fillRect(0,horizon-W*.42,W,W*.84); g.restore();
  });
}
/* Legibility is painted INTO the picture, as shade: the title stands in the
   shadow of something out of frame and looks out at a lit border. It is tinted
   by the season and crossfades with the rest, and it is only laid while the
   menu itself is up; the panels of the other screens bring their own plates. */
function menuPaintShade(S,W,H,sheet){
  const K=4, B=MENU_BORDER;
  return menuBakeSurface(W/K,H/K,g=>{
    g.setTransform(1/K,0,0,1/K,0,0);
    const a=o=>`rgba(${S.shade},${o})`;
    if (!sheet){
      const left=Math.max(B.SHELL_MIN,Math.min(B.SHELL_MAX,W*B.SHELL_VW)), right=left+Math.min(B.SHELL_W,W-left-18);
      const x2=Math.min(W,right+W*.30), lg=g.createLinearGradient(0,0,x2,0);
      lg.addColorStop(0,a(.92)); lg.addColorStop(Math.min(.9,Math.max(.02,left/x2)),a(.88));
      lg.addColorStop(Math.min(.95,right/x2),a(.58)); lg.addColorStop(1,a(0));
      g.fillStyle=lg; g.fillRect(0,0,x2,H);
    } else {
      const y2=H*.60, lg=g.createLinearGradient(0,0,0,y2);
      lg.addColorStop(0,a(.90)); lg.addColorStop(.42,a(.66)); lg.addColorStop(1,a(0));
      g.fillStyle=lg; g.fillRect(0,0,W,y2);
    }
    const top=H*(sheet?.80:.86), bg=g.createLinearGradient(0,H,0,top);
    bg.addColorStop(0,a(sheet?.84:.5)); bg.addColorStop(1,a(0));
    g.fillStyle=bg; g.fillRect(0,top,W,H-top);
  });
}
/* One clump, at px device pixels per drawing unit. `below` crops what would
   fall under the bottom of the screen; null keeps the whole drawing. */
function menuBakePlant(k,season,seed,px,bloom,tint,box,below){
  const bot=below==null?box.bot:Math.min(box.bot,below);
  if (box.top+bot<=2) return null;                       // wholly below the screen
  const w=Math.ceil(box.halfW*2*px)+2, h=Math.ceil((box.top+bot)*px)+2;
  const img=menuBakeSurface(w,h,g=>{
    g.setTransform(px,0,0,px,box.halfW*px+1,box.top*px+1);
    drawPlant(g,0,0,k,1,season,seed,0,undefined,bloom);
    if (tint){ g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-atop'; g.fillStyle=tint; g.fillRect(0,0,w,h); }
  });
  return {img, ox:box.halfW*px+1, oy:box.top*px+1, w, h};
}
/* A generator, so the bake can be spread over frames. The first value it hands
   back is the border with only its sky and shade, which is enough to put on
   screen at once; everything else is published together at the end, so a
   half-planted border is never drawn. `made` is what a cancelled build has to
   give back. */
function* menuBorderBuild(plan){
  const S=MENU_SCENES[plan.season]||MENU_SCENES.Fall, B=MENU_BORDER, R=B.ROWS.length;
  const W=plan.W, H=plan.H, U=plan.U, horizon=plan.horizon, dw=mcnv.width, dh=mcnv.height, dpr=dw/W;
  const b={id:++menuBorderSeq, season:plan.season, W, H, dw, dh, ready:false, tally:plan.tally,
    bg:menuPaintBackground(S,W,H,horizon,dpr), shade:menuPaintShade(S,W,H,plan.sheet),
    far:null, farY:0, farW:0, farH:0, glow:null, sprites:[], bytes:0, made:[]};
  yield b;
  const boxes=new Map(), boxOf=k=>{ let bx=boxes.get(k); if (!bx){ bx=plantDrawBox(plantDef(k),k,1); boxes.set(k,bx); } return bx; };
  // the far field: stamped from a small pool into one still layer, veiled row by row
  const farY0=Math.floor(horizon-150*U), farCss=Math.ceil(plan.depth*B.ROWS[B.FAR]+170*U);
  const fw=Math.max(1,Math.round(W*dpr)), fh=Math.max(1,Math.round(farCss*dpr));
  let fs;
  if (spriteBitmaps) fs=new OffscreenCanvas(fw,fh);
  else { fs=document.createElement('canvas'); fs.width=fw; fs.height=fh; }
  const fg=fs.getContext('2d'); fg.setTransform(dpr,0,0,dpr,0,-farY0*dpr); fg.imageSmoothingQuality='high';
  const pool=new Map(), px0=.64*U*dpr, haze=menuRgb(S.haze);
  for (const row of plan.far){
    for (const st of row.stamps){
      const key=st.k+'|'+st.v; let sp=pool.get(key);
      if (sp===undefined){
        sp=menuBakePlant(st.k,plan.season,menuKeySeed(key),px0,S.bloom,null,boxOf(st.k),null);
        pool.set(key,sp); if (sp) b.made.push(sp.img);
        yield null;
      }
      if (!sp) continue;
      const z=st.z/px0;
      fg.drawImage(sp.img, st.x-sp.ox*z, st.y-sp.oy*z, sp.w*z, sp.h*z);
    }
    fg.globalCompositeOperation='source-atop'; fg.fillStyle=`rgba(${haze},${row.veil})`;
    fg.fillRect(0,farY0,W,farCss); fg.globalCompositeOperation='source-over';
    yield null;
  }
  const far=(spriteBitmaps && typeof fs.transferToImageBitmap==='function') ? fs.transferToImageBitmap() : fs;
  b.made.push(far);
  // near rows: a sprite a clump, so the wind can move each one. Sized against the budget first.
  const resOf=p=>dpr*(p.row>=R-2?.8:1);        // the two nearest rows stand in shade and are a touch soft
  const belowOf=p=>(H-p.y)/p.z+2;
  let est=0;
  for (const p of plan.near){
    const bx=boxOf(p.k), bot=Math.min(bx.bot,belowOf(p)); if (bx.top+bot<=2) continue;
    const px=p.z*resOf(p); est+=(bx.halfW*2*px+2)*((bx.top+bot)*px+2)*4;
  }
  const q=Math.max(.5,Math.min(1,Math.sqrt(B.MEM/Math.max(1,est))));
  const sprites=[]; let bytes=0;
  for (const p of plan.near){
    const res=resOf(p)*q, last=p.row===R-1;
    const tint=last ? `rgba(${S.shade},.30)` : p.row===R-2 ? `rgba(${S.shade},.10)`
      : B.NEAR_TINT[p.row-B.FAR] ? `rgba(${haze},${B.NEAR_TINT[p.row-B.FAR]})` : null;
    const sp=menuBakePlant(p.k,plan.season,p.seed,p.z*res,S.bloom,tint,boxOf(p.k),belowOf(p));
    if (sp){
      b.made.push(sp.img); bytes+=sp.w*sp.h*4;
      sprites.push({img:sp.img, ox:sp.ox, oy:sp.oy, up:dpr/res, x:p.x*dpr, y:p.y*dpr, ph:p.ph, amp:p.amp});
    }
    yield null;
  }
  // light coming through the planting from behind
  const gw=192, gh=Math.max(96,Math.round(gw*H/W));
  const glow=menuBakeSurface(gw,gh,g=>{
    const gx=gw*S.sunX, gy=gh*(horizon/H), gr=g.createRadialGradient(gx,gy,0,gx,gy,gw*.5);
    gr.addColorStop(0,`rgba(${S.sun},.24)`); gr.addColorStop(.5,`rgba(${S.sun},.07)`); gr.addColorStop(1,`rgba(${S.sun},0)`);
    g.fillStyle=gr; g.fillRect(0,0,gw,gh);
  });
  // the pool has been stamped and transferred; a border keeps none of it
  for (const sp of pool.values()) if (sp) menuRetireImage(sp.img);
  b.far=far; b.farY=farY0*dpr; b.farW=fw; b.farH=fh; b.glow=glow; b.sprites=sprites; b.bytes=bytes; b.q=q;
  b.made=null; b.ready=true;
  return b;
}
function menuBorderImages(b){
  const out=[b.bg,b.shade,b.far,b.glow];
  for (const p of b.sprites) out.push(p.img);
  return out;
}
function menuRetireBorder(b){ if (b) for (const img of menuBorderImages(b)) menuRetireImage(img); }
function menuCancelJob(){
  const job=menuJob; if (!job) return;
  menuJob=null;
  const b=job.b; if (!b) return;
  if (b.made) for (const img of b.made) menuRetireImage(img);
  if (b!==menuBorder){ menuRetireImage(b.bg); menuRetireImage(b.shade); }
}
/* A garden has opened: give the border's memory back. It is replanted when the
   menu returns, sky first. */
function releaseMenuBorder(){
  menuCancelJob();
  menuRetireBorder(menuBorder); menuBorder=null;
  menuFade=null; menuFadeCv=null; menuDrawnSig='';
  menuCloseRetired();
}
function menuBorderKey(){ return menuSeason+'|'+mcnv.width+'x'+mcnv.height+'|'+(mobileSheetUi()?1:0)+'|'+menuPaletteSig; }
function menuAdoptBorder(b,t){
  const old=menuBorder;
  if (old && menuDrawnSig && !reducedMotion()){
    if (!menuFadeCv) menuFadeCv=document.createElement('canvas');
    if (menuFadeCv.width!==mcnv.width || menuFadeCv.height!==mcnv.height){ menuFadeCv.width=mcnv.width; menuFadeCv.height=mcnv.height; }
    const g=menuFadeCv.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1;
    g.clearRect(0,0,menuFadeCv.width,menuFadeCv.height); g.drawImage(mcnv,0,0);
    const B=MENU_BORDER;
    menuFade={t0:t, ms: old===b ? B.FIRST_MS : old.season===b.season ? B.SWAP_MS : B.FADE_MS};
  }
  if (old!==b) menuRetireBorder(old);
  menuBorder=b; menuDrawnSig='';
  if (b.ready) syncMenuBorderChrome(b);
}
/* How long a frame may spend planting. The time budget counts the SCRIPT of a
   bake, and that is the smaller part of it: the clumps are drawn onto an
   accelerated surface, so their raster lands in the GPU process after the
   frame's script has finished, at several times the script's cost. A flat 6ms
   was 6ms of script and well over a 164Hz frame of GPU, and every turn of the
   season (which is every return to the menu: show() advances it) dropped 6-8
   frames, the worst 42-67ms, while the main thread never ran a task over 12ms
   and the GPU process was busy for 680ms of the 1.4s. Measured on that display,
   turning the season at 1440x925, interleaved, eight turns each:
     6ms     7 frames missed a turn, worst 48-67ms, planted in ~190ms
     2ms     2.6 missed, worst 18ms, ~255ms
     1.5ms   1.1 missed, worst 18ms, ~330ms
     1ms     1 missed, worst 18ms, ~490ms
   so the planting barely slows (the GPU was the limit all along) while the
   frames stop dropping. The share is of the DISPLAY's interval, as the
   garden's look-ahead does it (aheadFrame): the smallest recent gap, drifting
   back up 2% a frame, never the last gap, or a slow frame would buy the next
   one more planting. It comes out at 1.8ms at 164Hz and 5ms at 60Hz, where the
   GPU has the same share of a longer frame. The one frame that still runs long
   is the far field's: Chrome rasterises that whole layer when it is handed
   over, not as it is stamped, so ending frames between stamps only moved it. */
let menuVs=0;
function menuBakeBudget(gap){
  const B=MENU_BORDER, dt=Math.min(34,Math.max(4,gap||16.7));
  menuVs=Math.min(dt,(menuVs||dt)*1.02);
  return Math.min(B.STEP_MS,Math.max(B.STEP_MIN_MS,menuVs*B.STEP_SHARE));
}
/* Plant the border that should be up, a little at a time. Called every
   animation frame the menu is the backdrop, not only on the 30fps frames that
   draw it, so a build takes a third of a second rather than a second and a
   half. Where frames are NOT arriving at speed nothing is animating to protect,
   so the planting simply finishes. */
function menuBorderWork(t,gap){
  const W=VW, H=VH;
  if (!(W>0 && H>0) || !mcnv.width || !mcnv.height) return;
  const size=mcnv.width+'x'+mcnv.height;
  if (size!==menuSizeKey){ menuSizeKey=size; menuSizeAt=t; }
  menuSeasonTurn(gap);
  const want=menuBorderKey();
  const have=menuJob ? menuJob.key : (menuBorder && menuBorder.ready ? menuBorder.key : '');
  if (have!==want && (!menuBorder || t-menuSizeAt>=MENU_BORDER.SETTLE_MS)){
    menuCancelJob();
    const plan=menuBorderPlan(menuSeason,W,H,mobileSheetUi(),menuPalette);
    menuJob={key:want, it:menuBorderBuild(plan), b:null};
  }
  const budget=menuBakeBudget(gap);       // tracked every frame, building or not
  const job=menuJob; if (!job) return;
  /* With no planted border on screen (a cold start, back from a garden) only the
     still sky is showing, so the planting takes FIRST_STEP_MS a frame; and the
     frame that hands back the sky ends there, so the sky is painted at once
     rather than after a frame's planting. */
  const first=!(menuBorder && menuBorder.ready);
  const t0=performance.now(), ms=gap>180 ? 400 : first ? Math.max(budget,MENU_BORDER.FIRST_STEP_MS) : budget;
  let r;
  do {
    r=job.it.next();
    if (!r.done && r.value){
      job.b=r.value; job.b.key=job.key;
      if (!menuBorder){ menuAdoptBorder(job.b,t); break; }
    }
  } while (!r.done && performance.now()-t0<ms);
  if (r.done){ menuJob=null; r.value.key=job.key; menuAdoptBorder(r.value,t); }
}
function menuDrawBorder(b,t,shadeA,still){
  const dw=mcnv.width, dh=mcnv.height, sx=dw/b.dw, sy=dh/b.dh;
  mcx.setTransform(1,0,0,1,0,0); mcx.globalAlpha=1; mcx.globalCompositeOperation='source-over';
  mcx.drawImage(b.bg,0,0,dw,dh);
  if (b.far) mcx.drawImage(b.far,0,b.farY*sy,b.farW*sx,b.farH*sy);
  for (const p of b.sprites){
    /* a gust travelling across the border, plus each clump's own time */
    const k=still?0:(.62*Math.sin(t*.0011-p.x*.0026)+.38*Math.sin(t*.0017+p.ph))*.042*p.amp, u=p.up;
    if (!p.img.width) continue;            // a closed bitmap would throw, and a throw here ends the loop
    mcx.setTransform(u*sx,0,k*u*sx,u*sy,sx*(p.x-u*p.ox-k*u*p.oy),sy*(p.y-u*p.oy));
    mcx.drawImage(p.img,0,0);
  }
  mcx.setTransform(1,0,0,1,0,0);
  if (b.glow){ mcx.globalCompositeOperation='screen'; mcx.drawImage(b.glow,0,0,dw,dh); mcx.globalCompositeOperation='source-over'; }
  if (shadeA>0){ mcx.globalAlpha=shadeA; mcx.drawImage(b.shade,0,0,dw,dh); mcx.globalAlpha=1; }
  // falling snow is a layer of its own over this canvas: snowFrame
}
function menuRender(t){
  if (!(VW>0 && VH>0) || !mcnv.width || !mcnv.height) return;
  menuCloseRetired();          // a frame after they were last drawn
  const b=menuBorder;
  if (!b){
    mcx.setTransform(1,0,0,1,0,0);
    mcx.fillStyle=(MENU_SCENES[menuSeason]||MENU_SCENES.Fall).pageBg; mcx.fillRect(0,0,mcnv.width,mcnv.height);
    mcx.setTransform(DPR,0,0,DPR,0,0);
    return;
  }
  const still=reducedMotion(), target=screenOpen('menuScreen')?1:0;
  menuShadeA=still ? target : menuShadeA+(target-menuShadeA)*.3;
  if (Math.abs(target-menuShadeA)<.01) menuShadeA=target;
  /* With motion off nothing in the picture moves, so one frame IS the picture:
     draw again only when the border, the canvas or the shade has changed. */
  const sig=b.id+'|'+(b.ready?1:0)+'|'+mcnv.width+'x'+mcnv.height+'|'+menuShadeA;
  if (still && !menuFade && sig===menuDrawnSig) return;
  menuDrawnSig=sig;
  menuDrawBorder(b,t,menuShadeA,still);
  if (menuFade){
    const e=Math.min(1,Math.max(0,(t-menuFade.t0)/menuFade.ms));
    if (e<1 && menuFadeCv){
      mcx.globalAlpha=1-e*e*(3-2*e); mcx.drawImage(menuFadeCv,0,0,mcnv.width,mcnv.height); mcx.globalAlpha=1;
    } else menuFade=null;
  }
  mcx.setTransform(DPR,0,0,DPR,0,0);
}

/* ---- the menu's own chrome: the key, the season dots, the entry art ---- */
function buildMenuPips(){
  const host=$('menuPips'); if (!host || menuPipButtons.length) return;
  SEASONS.forEach(s=>{
    const b=document.createElement('button'); b.type='button'; b.className='menu-pip'; b.dataset.season=s;
    b.style.setProperty('--pip',SEASON_FILL[s]); b.title=s;
    b.setAttribute('aria-label','Show the border in '+s); b.setAttribute('aria-pressed','false');
    b.appendChild(document.createElement('i'));
    // a chosen season stays for the rest of the visit, the current one included
    b.onclick=()=>{ menuSeasonHeld=true; if (s!==menuSeason) setMenuSeason(s,true); };
    host.appendChild(b); menuPipButtons.push(b);
  });
}
/* The Plant Library, open on one plant: the key's rows land here. */
function openPlantLibraryAt(key){
  openLibrary();
  if (!PLANTS[key] || !libraryAllKeys().includes(key)) return;
  showLibraryDetail(key);
  const row=document.querySelector('.lib-item.sel');
  if (row && typeof row.scrollIntoView==='function') row.scrollIntoView({block:'center'});
}
/* What is planted in the border, as a plan sheet names it: the six that carry
   the most of it, each with the colour it has this season. */
function menuKeyPlants(tally,n){
  return [...tally.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(e=>e[0]);
}
function syncMenuBorderChrome(b){
  paintMenuGardenArt(b.season);
  const list=$('menuKeyList'), line=$('menuKeyLine'); if (!list) return;
  const all=menuKeyPlants(b.tally,99), top=all.slice(0,6);
  list.replaceChildren();
  top.forEach(k=>{
    const P=plantDef(k), li=document.createElement('li'), row=document.createElement('button');
    row.type='button'; row.className='menu-key-row';
    const sw=document.createElement('i'); sw.style.background=menuSeasonColour(k,b.season);
    const nm=document.createElement('span'); nm.textContent=P.name;
    const la=document.createElement('em'); la.textContent=P.latin;
    row.append(sw,nm,la); row.onclick=()=>openPlantLibraryAt(k);
    li.appendChild(row); list.appendChild(li);
  });
  if (line){
    const short=k=>plantDef(k).name.replace(/\s*'[^']*'/,'');
    line.textContent=all.slice(0,3).map(short).join(', ')+(all.length>3?` and ${all.length-3} more`:'');
  }
}
/* Each entry shows the thing it opens, drawn by the app: a garden, a plant in
   its four seasons, a plan. */
const MENU_GARDEN_ART={
  Spring:['baptisia','amsonia','camassia','sesleria','cushionspurge','muscari','camassia','sesleria','daffodil'],
  Summer:['culvers','echinacea','monarda','dropseed','yarrow','allium','echinacea','sesleria','calamint'],
  Fall:['indiangrass','newengland','bluestem','goldenrod','aster','sedum','bluestem','dropseed','sedum'],
  Winter:['bigbluestem','echinacea','bluestem','rudbeckia','switchgrass','sedum','bluestem','dropseed','sedum'] };
function paintMenuGardenArt(season){
  const c=$('menuArtGardens'); if (!c || !c.getContext) return;
  const g=c.getContext('2d'), w=c.width, h=c.height, A=AMBIENCE[season]||AMBIENCE.Fall;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h);
  const sky=g.createLinearGradient(0,0,0,h); sky.addColorStop(0,A.sky[0]); sky.addColorStop(1,A.sky[1]); g.fillStyle=sky; g.fillRect(0,0,w,h);
  const X=w/2, Y=h*.69, hw=w*.47, hh=hw/2;
  const diamond=(y,a,b)=>{ g.beginPath(); g.moveTo(X,y-b); g.lineTo(X+a,y); g.lineTo(X,y+b); g.lineTo(X-a,y); g.closePath(); };
  diamond(Y+7,hw,hh); g.fillStyle=mixHex(A.soil,'#000000',.35); g.fill();          // the plot's edge
  diamond(Y,hw,hh); g.fillStyle=A.snow?'#e4e6e2':A.grass[0]; g.fill();
  diamond(Y-1,hw*.74,hh*.74); g.fillStyle=A.snow?'#d3d4cf':A.soil; g.fill();
  const keys=MENU_GARDEN_ART[season]||MENU_GARDEN_ART.Fall, cells=[];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) cells.push([i,j]);
  cells.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]));
  cells.forEach((cell,n)=>{ const k=keys[n%keys.length]; if (!PLANTS[k]) return;
    g.save(); g.translate(X+(cell[0]-cell[1])*hw*.235, Y-1+(cell[0]+cell[1]-2)*hh*.235); g.scale(.36,.36);
    drawPlant(g,0,0,k,1,season,tileSeed(cell[0]+3,cell[1]+8),0,undefined,(MENU_SCENES[season]||MENU_SCENES.Fall).bloom); g.restore(); });
}
function paintMenuLibraryArt(){
  const c=$('menuArtLibrary'); if (!c || !c.getContext) return;
  const g=c.getContext('2d'), w=c.width, h=c.height, pw=w/2, ph=h/2, k='echinacea', P=plantDef(k);
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h);
  SEASONS.forEach((s,i)=>{ const x=(i%2)*pw, y=((i/2)|0)*ph, A=AMBIENCE[s];
    g.save(); g.beginPath(); g.rect(x,y,pw,ph); g.clip();
    const sky=g.createLinearGradient(0,y,0,y+ph); sky.addColorStop(0,A.sky[0]); sky.addColorStop(1,A.sky[1]); g.fillStyle=sky; g.fillRect(x,y,pw,ph);
    g.fillStyle=A.snow?'#e4e6e2':A.grass[1]; g.fillRect(x,y+ph*.86,pw,ph*.14);
    const sc=(ph*.76)/(plantArtTop(P)||80);
    g.translate(x+pw/2,y+ph*.9); g.scale(sc,sc); drawPlant(g,0,0,k,1,s,4410,0,undefined,1); g.restore(); });
  g.fillStyle='rgba(20,14,11,.55)'; g.fillRect(pw-1,0,2,h); g.fillRect(0,ph-1,w,2);
}
function paintMenuPlanArt(){
  const c=$('menuArtDaily'); if (!c || !c.getContext) return;
  const g=c.getContext('2d'), w=c.width, h=c.height;
  g.setTransform(1,0,0,1,0,0);
  g.fillStyle='#efe6d3'; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(70,52,40,.10)'; g.lineWidth=1;
  for (let i=1;i<8;i++){ g.beginPath(); g.moveTo(i*w/8+.5,0); g.lineTo(i*w/8+.5,h); g.moveTo(0,i*h/8+.5); g.lineTo(w,i*h/8+.5); g.stroke(); }
  const path=()=>{ g.beginPath(); g.moveTo(-6,h*.74); g.bezierCurveTo(w*.3,h*.58,w*.5,h*.92,w+6,h*.50); };
  path(); g.strokeStyle='#d9ccb0'; g.lineWidth=17; g.lineCap='round'; g.stroke();          // a gravel path through it
  path(); g.strokeStyle='rgba(70,52,40,.22)'; g.lineWidth=1; g.setLineDash([3,3]); g.stroke(); g.setLineDash([]);
  const blob=(x,y,rx,ry,seed)=>{
    const r=mulberry(seed), n=9, pts=[];
    for (let i=0;i<n;i++){ const a=i/n*6.283, m=.78+r()*.44; pts.push([x+Math.cos(a)*rx*m,y+Math.sin(a)*ry*m]); }
    g.beginPath(); g.moveTo((pts[n-1][0]+pts[0][0])/2,(pts[n-1][1]+pts[0][1])/2);
    for (let i=0;i<n;i++){ const p=pts[i], q=pts[(i+1)%n]; g.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2); }
    g.closePath();
  };
  const drifts=[[.26,.28,.20,.13,'#b8c79c',3],[.62,.22,.17,.12,'#cba7bd',9],[.86,.30,.11,.14,'#d8c070',14],
    [.20,.50,.12,.08,'#c98f70',21],[.52,.46,.15,.10,'#a8bacb',27],[.30,.90,.20,.09,'#cba7bd',33],[.74,.84,.17,.10,'#b8c79c',39]];
  for (const d of drifts){ blob(d[0]*w,d[1]*h,d[2]*w,d[3]*h,d[5]); g.fillStyle=d[4]; g.fill();
    g.strokeStyle=mixHex(d[4],'#3a2a20',.45); g.lineWidth=1.3; g.stroke(); }
  g.setLineDash([4,3]); g.strokeStyle='rgba(58,42,32,.62)'; g.lineWidth=1.4;          // a tree's crown
  g.beginPath(); g.arc(w*.83,h*.62,w*.105,0,6.3); g.stroke(); g.setLineDash([]);
  g.fillStyle='rgba(58,42,32,.8)'; g.beginPath(); g.arc(w*.83,h*.62,2.6,0,6.3); g.fill();
  g.strokeStyle='rgba(58,42,32,.85)'; g.lineWidth=1.6;                                 // north
  g.beginPath(); g.moveTo(w*.09,h*.16); g.lineTo(w*.09,h*.05); g.moveTo(w*.06,h*.09); g.lineTo(w*.09,h*.05); g.lineTo(w*.12,h*.09); g.stroke();
  g.strokeStyle='rgba(58,42,32,.7)'; g.lineWidth=2; g.strokeRect(1,1,w-2,h-2);
}
function paintMenuArt(){ paintMenuGardenArt(menuSeason); paintMenuLibraryArt(); paintMenuPlanArt(); }
/* The Library and the guidebook are full-bleed plates over the menu canvas. A
   border kept moving behind them is paint nobody can see, and their 4px
   backdrop blur is recomposited for every frame of it. */
function menuBackdropCovered(){ return screenOpen('libraryScreen') || screenOpen('guideScreen'); }

/* ---------- falling snow ----------
   A layer of its own over the canvas, drawn on every animation frame. It was
   drawn into the garden's frame and the menu's, and each flake moved a fixed
   step per frame DRAWN: the garden draws at the display's rate while it is being
   used and at 30fps when it is idle, so snow fell five times faster the moment
   the garden was touched at 164Hz and slowed and stepped when it was let go, and
   the menu's fell in 30fps steps. Both also started from an empty sky and filled
   in at random. Here a flake's place is a function of the clock: steady at any
   frame rate, the whole fall there from the first frame (faded in), and the
   garden is never redrawn for it. Three depths, the far flakes small, slow and
   faint, so the fall has depth rather than being one sheet. The layer is
   display:none when no snow falls. Less motion: no falling snow (the winter
   scene keeps its snow).
   What it costs is measured as GPU time a second at 1440x925, 164Hz: the old
   snow 72ms on the winter menu, 130 in an idle winter garden and 805 panning
   one; this layer drawn every frame with arcs 376, 314 and 909 with 10 frames
   dropped while panning, because a layer that changes every frame has the whole
   screen composited every frame. Drawn about 60 times a second (FRAME_MS) and
   with each flake STAMPED from one soft dot (snowFlakeImage) rather than traced
   as an arc: 94, 165 and 797, nothing dropped. */
const SNOW={
  PER_MPX:85, MIN:40, MAX:240,          // flakes per million CSS px^2, bounded
  FADE_MS:1400, WIND:9, MARGIN:8,
  FRAME_MS:1000/60,                     // drawn about this often (snowFrame), whatever the display
  LAYERS:[
    {share:.45, r:[.7,1.2], v:[18,30], amp:[4,9],   a:.55},
    {share:.35, r:[1.2,1.9], v:[30,48], amp:[7,14], a:.75},
    {share:.20, r:[1.9,2.8], v:[48,72], amp:[10,20], a:.9},
  ],
};
const snowLayers={}, snowFlakeImages=[];
/* One soft dot, white by day and a dimmer blue at night, made through the sprite
   caches' own surface so it is an ImageBitmap where that matters (a small canvas
   drawn into a big one is re-uploaded every frame in Firefox: renderer.js,
   spriteBitmapsSupported). */
function snowFlakeImage(night){
  const k=night?1:0;
  if (snowFlakeImages[k]) return snowFlakeImages[k];
  const cv=spriteBakeSurface('snow',32,32), g=cv.getContext('2d'), col=night?'196,206,226':'246,249,252';
  const gr=g.createRadialGradient(16,16,0,16,16,16);
  gr.addColorStop(0,'rgba('+col+',1)'); gr.addColorStop(.55,'rgba('+col+',.9)'); gr.addColorStop(1,'rgba('+col+',0)');
  g.fillStyle=gr; g.fillRect(0,0,32,32);
  return (snowFlakeImages[k]=spriteBakeImage('snow',cv));
}
/* The same flakes for the same size: seeded, so a resize re-lays them and
   nothing else does. */
function snowField(W,H){
  const n=Math.max(SNOW.MIN,Math.min(SNOW.MAX,Math.round(W*H/1e6*SNOW.PER_MPX)));
  const rnd=mulberry(7717), span=(a)=>a[0]+rnd()*(a[1]-a[0]), sy=H+2*SNOW.MARGIN;
  return SNOW.LAYERS.map(L=>{
    const out=[], k=Math.round(n*L.share);
    for (let i=0;i<k;i++){
      const v=span(L.v);
      out.push({x0:rnd()*(W+2*SNOW.MARGIN), y0:rnd()*sy, v, r:span(L.r), amp:span(L.amp),
        w:.9+rnd()*1.6, ph:rnd()*6.2832, drift:SNOW.WIND*v/48});
    }
    return out;
  });
}
/* One layer for one frame. `want` fades it in or out; `off` hides it at once,
   for a layer that has stopped being the one on screen. */
function snowStep(id,t,gap,want,night,off){
  let s=snowLayers[id];
  if (!s){
    if (!want) return;
    const cv=$(id); if (!cv || !cv.getContext) return;
    s=snowLayers[id]={cv, g:cv.getContext('2d'), w:0, h:0, dpr:0, level:0, shown:false, field:null};
  }
  if (off) s.level=0;
  else if (s.level===0 && !want) return;
  else {
    const step=Math.min(100,Math.max(0,gap||0))/SNOW.FADE_MS;
    s.level=want ? Math.min(1,s.level+step) : Math.max(0,s.level-step);
  }
  if (s.level<=0){
    if (s.shown){ s.shown=false; s.cv.classList.add('hidden'); }
    return;
  }
  if (!s.shown){ s.shown=true; s.cv.classList.remove('hidden'); }
  const W=VW, H=VH;
  if (s.w!==W || s.h!==H || s.dpr!==DPR){
    s.w=W; s.h=H; s.dpr=DPR;
    s.cv.style.width=W+'px'; s.cv.style.height=H+'px';
    s.cv.width=Math.max(1,Math.round(W*DPR)); s.cv.height=Math.max(1,Math.round(H*DPR));
    s.field=snowField(W,H);
  }
  const g=s.g, sec=t/1000, M=SNOW.MARGIN, sx=W+2*M, sy=H+2*M;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,s.cv.width,s.cv.height);
  g.setTransform(DPR,0,0,DPR,0,0);
  const img=snowFlakeImage(night), dim=night ? .62 : 1;
  for (let L=0;L<SNOW.LAYERS.length;L++){
    g.globalAlpha=SNOW.LAYERS[L].a*dim*s.level;
    for (const f of s.field[L]){
      const y=((f.y0+f.v*sec)%sy+sy)%sy-M;
      const x=((f.x0+f.drift*sec+f.amp*Math.sin(sec*f.w+f.ph))%sx+sx)%sx-M;
      const d=f.r*2.4;                 // the dot's soft edge: its solid core is about r
      g.drawImage(img,x-d/2,y-d/2,d,d);
    }
  }
  g.globalAlpha=1;
}
/* Which layer should be snowing: the menu's over a winter border, the garden's
   in a winter garden. A screen laid over the canvas, a garden still opening, or
   the other one being on screen puts a layer away at once; a season turning
   fades it. */
let snowVs=0, snowSkip=0, snowGap=0;
function snowFrame(t,gap){
  /* Every Nth frame, N the display interval into FRAME_MS (the guidebook's
     cadence): a layer that changes on every frame makes the browser composite
     the whole screen on every frame, where the menu and an idle garden change 30
     times a second. The fade is driven by the time since the last draw. */
  const dt=Math.min(34,Math.max(4,gap||16.7));
  snowVs=Math.min(dt,(snowVs||dt)*1.02);
  snowGap+=Math.max(0,gap||0);
  if (--snowSkip>0) return;
  snowSkip=SNOW.FRAME_MS>0 ? Math.max(1,Math.round(SNOW.FRAME_MS/snowVs)) : 1;
  gap=snowGap; snowGap=0;
  const still=reducedMotion(), garden=!!game.inGarden;
  const menuOff=garden || menuBackdropCovered();
  const menuWant=!menuOff && !still && !!menuBorder && menuBorder.ready && !!MENU_SCENES[menuBorder.season].snow;
  snowStep('menuSnow',t,gap,menuWant,false,menuOff||still);
  const gardenOff=!garden || !!gardenOpening || fullScreenRenderBlocked();
  let gardenWant=false;
  if (!gardenOff && !still){ const a=AMBIENCE[calClock().season]; gardenWant=!!(a && a.snow); }
  snowStep('gardenSnow',t,gap,gardenWant,!!(game.layerVis && game.layerVis.night),gardenOff||still);
}

/* ---------- main loop ---------- */
const MENU_FRAME_MS=1000/30;
const IDLE_FRAME_MS=1000/30;
/* How long after the last input the garden keeps rendering at full rate even
   though its signature says nothing has changed.

   This was 700ms, which bought nothing and cost ~42 full frames after every
   pause in a gesture — and the pauses in design work are constant. It buys
   nothing because responsiveness does not depend on it: an input that changes
   anything changes renderStateSig, and the very next frame renders. What the
   grace genuinely has to cover is the repaint an input DEFERS — the crisp
   ground rebake at GROUND_PAN_SETTLE (180ms) and the sprite rescale at
   SPRITE_ZOOM_SETTLE (140ms), neither of which moves the signature. 250 clears
   the longest of those with room to spare.
   This is a battery and thermal fix rather than a frame-time one, and on a
   phone that is the same thing in the end: sustained draw means throttling, and
   a throttled phone makes every other cost here worse for the rest of the
   session. */
const IDLE_GRACE_MS=250;
const HUD_IDLE_MS=500;
let prev=performance.now(), lastMenuRender=-Infinity, lastGardenRender=-Infinity, lastHudUpdate=0;
let lastMeaningfulChange=performance.now(), lastRenderSig='', lastHoverSig='';

/* Raw input, anywhere on the page, says the gardener is HERE. It does not say
   the garden's picture changed, and it used to be taken for that: every one of
   these events restarted the grace below, so the garden was redrawn at the
   display's full rate for as long as a pointer moved over the plant library, a
   wheel scrolled its list, a finger scrolled the sheet on a phone or a key went
   down in Find. Measured at 164Hz on a 1,482-plant quarter acre: 20% of the
   main thread with the pointer still and 74% while it moved, for a picture that
   was the same in both (36 against 184ms of script a second on the demo
   garden). On a phone that work competes with the list being scrolled.
   What needs a frame is a change to the picture, and that is renderStateSig's
   job (plus hoverSig, and hasTransientGardenWork for a gesture in progress).
   So input is only remembered, for the one reader that wants to know whether
   anybody is about: speculative work, which waits for a quiet moment
   (groundViewIdle). */
let lastInputAt=performance.now();
function markLoopActivity(){ lastInputAt=performance.now(); }
['pointerdown','pointermove','pointerup','wheel','keydown','keyup','touchstart','touchmove'].forEach(type=>
  addEventListener(type,markLoopActivity,{passive:true}));
function screenOpen(id){
  const el=document.getElementById(id);
  return !!el && !el.classList.contains('hidden');
}
function fullScreenRenderBlocked(){
  return screenOpen('libraryScreen') || screenOpen('guideScreen') ||
    screenOpen('planScreen') || screenOpen('bloomScreen') || screenOpen('exportScreen') || screenOpen('challengeScreen') || screenOpen('challengeFinishScreen');
}
function layerVisibilitySig(){
  const vis=game.layerVis||{};
  return Object.keys(vis).sort().map(k=>k+':'+(vis[k]?1:0)).join(',');
}
function selectionSig(){
  const s=game.sel;
  return s ? `${s.x0},${s.y0},${s.x1},${s.y1}` : '';
}
function rulerSig(){
  const r=game.ruler;
  return r ? `${r.a?r.a.join(','):''}>${r.b?r.b.join(','):''}` : '';
}
function buildingDraftSig(){
  /* The footprint draft's rubber-band edge follows the CORNER under the pointer,
     which is finer than game.hoverTile — so without these two the signature says
     "nothing changed" while the line the gardener is dragging moves. It used to
     be covered only because any pointermove kept the 700ms grace alive; the
     grace is now short enough that the signature has to be honest. */
  const d=game.buildingDraft;
  const h=(typeof buildingHover!=='undefined' && buildingHover) ? buildingHover.join(',') : '';
  return (d&&d.pts?d.pts.length:0)+'@'+h;
}
/* The site photo is drawn every frame and edited from DOM controls (opacity,
   width, rotation, the nudge buttons), none of which moves game.rev. Those
   edits were repainted only because any input restarted the grace. */
function underlaySig(){
  const c=game.underlayCalibration;
  return (game.underlayRev||0)+(game.photoEditing?'e':'')+(c&&c.points?'c'+c.points.length:'');
}
function renderStateSig(){
  return [
    game.rev, game.groundRev, game.terrainRev, game.rot, effectiveSiteNorthDeg(), absDay(),
    GW, GH, VW, VH, ZOOM.toFixed(3), cam.x.toFixed(1), cam.y.toFixed(1),
    game.tool, game.toolVar||'', game.eraseMode, game.brushSize,
    game.previewMode, game.edgeStyle, layerVisibilitySig(),
    selectionSig(), rulerSig(),
    buildingDraftSig(), game.focusTile?game.focusTile.join(','):'', underlaySig(),
    // the cursor diamond: a tap moves it and may change nothing else
    game.actX, game.actY
  ].join('|');
}
/* What the pointer's position changes on the canvas, kept apart from the
   signature above because of what each is owed. A change up there may have
   deferred a repaint (the crisp ground bake after a pan, the sprite rescale
   after a zoom), so it is followed by the grace. A ghost that moved to another
   tile defers nothing: it is owed one frame, now.
   Under most tools something is drawn AT the hovered tile (a brush footprint,
   a placement ghost), so the tile is the answer. Under the four below nothing
   is, and the only thing hovering changes is the spread ring of a shrub the
   pointer is over (render's hoverShrub), so the answer is which shrub. Hand is
   the tool every garden opens in: with the tile in the signature, moving the
   pointer across a garden redrew it at full rate for a ring that was not there.
   A tool that is not listed gets the tile, so a new one is right by default. */
const HOVER_RING_ONLY=new Set(['hand','select','ruler','pick']);
function hoverSig(){
  const h=game.hoverTile;
  if (!h) return '';
  if (game.tool==='steps') return stepsHover ? stepsHover.key : '';
  if (HOVER_RING_ONLY.has(game.tool)){
    const sh=layerShown('woody') ? shrubAt(h[0],h[1]) : null;
    return sh ? 's'+sh.key : '';
  }
  return h[0]+','+h[1];
}
function hasActiveGesture(){
  return (typeof activePtrs!=='undefined' && activePtrs.size>0)
    || (typeof pinch!=='undefined' && !!pinch)
    || (typeof toolDrag!=='undefined' && !!toolDrag)
    || (typeof fillTap!=='undefined' && !!fillTap)
    || (typeof rulerDrag!=='undefined' && !!rulerDrag)
    || (typeof panDrag!=='undefined' && !!panDrag)
    || (typeof selDrag!=='undefined' && !!selDrag)
    || (typeof selMove!=='undefined' && !!selMove)
    || (typeof selResize!=='undefined' && !!selResize)
    || (typeof sweep!=='undefined' && !!sweep);
}
function hasTransientGardenWork(){
  return !!(gardenOpening || game.ffActive || hasActiveGesture()
    || (game.fx&&game.fx.length) || (game.shrubFx&&game.shrubFx.length)
    || seasonFadeActive()     // the season crossfade needs live frames for ~1s
    || skipPending());        // and a Skip being prepared lands sooner at full rate
}
function shouldRenderGarden(t){
  if (fullScreenRenderBlocked()) return false;
  const sig=renderStateSig(), hover=hoverSig();
  if (sig!==lastRenderSig){
    lastRenderSig=sig; lastHoverSig=hover;
    lastMeaningfulChange=t;
    return true;
  }
  // the pointer is over something that draws differently: one frame, no grace
  if (hover!==lastHoverSig){ lastHoverSig=hover; return true; }
  if (hasTransientGardenWork()) return true;
  if (t-lastMeaningfulChange<IDLE_GRACE_MS) return true;
  return t-lastGardenRender>=IDLE_FRAME_MS;
}
/* ---- glass governor ----
   The chrome's backdrop-filter blur is recomposited by the GPU every frame the
   canvas animates under it — a cost the JS phase timers can't see. If frame
   SPACING stays janky while the user is actively interacting (idle frames are
   deliberately 30fps, so they don't count), drop the blur for the session via
   body.no-glass (solid fills keep the look). Warmup skips the first ~90 hot
   frames so first-load font/shader jank can't trip it. Session-only: a fast
   machine is never punished twice, a slow one re-trips in a few seconds.
   Force it off yourself with ?noglass. */
const GLASS={ema:16.7, off:false, warm:0, LIMIT_MS:30, WARM_FRAMES:90};
function updateGlassMode(dt){
  if (GLASS.off) return;
  if (GLASS.warm<GLASS.WARM_FRAMES){ GLASS.warm++; return; }
  GLASS.ema=GLASS.ema*0.9+dt*0.1;
  if (GLASS.ema>GLASS.LIMIT_MS){
    GLASS.off=true;
    if (document.body && document.body.classList) document.body.classList.add('no-glass');
  }
}
/* ---------- app updates ----------
   sw.js installs a new build and then WAITS, because taking over a live
   session would let it start fetching assets from a build the session did not
   start on. That was written assuming the wait ends at the next visit, which
   is true on a desktop and false on a phone: an installed PWA's client can
   outlive being swiped away, another tab on the origin is another client, and
   a resumed PWA rarely runs an update check at all. A phone could therefore
   sit on an old build indefinitely with nothing to indicate it — observed,
   across several shipped versions.

   So the app offers the update and the gardener decides. That keeps the
   original invariant (no session silently mixes two builds) and ends the wait.
   Nothing here is urgent or destructive, so it is a dismissible bar and never
   a modal. */
let updateTakingOver=false, lastUpdateCheck=0;
const UPDATE_CHECK_GAP=60000;   // at most one check a minute on resume
function offerAppUpdate(worker){
  const bar=document.getElementById('updateBar'), go=document.getElementById('btnUpdateNow'),
        later=document.getElementById('btnUpdateLater');
  if (!bar || !go || !worker || updateTakingOver) return false;
  bar.hidden=false;
  if (document.body) document.body.classList.add('has-update');
  later.onclick=()=>{ bar.hidden=true;
    if (document.body) document.body.classList.remove('has-update'); };
  go.onclick=()=>{
    if (updateTakingOver) return;
    updateTakingOver=true;
    go.disabled=true; later.disabled=true;
    hudText('updateBarText','Updating…');
    /* Bank the garden first. A reload is a session boundary and this app holds
       the garden in memory; pagehide would save anyway, but not being sure is
       not good enough for the one action whose whole purpose is to reload. */
    const go2=()=>{ try{ worker.postMessage({type:'SKIP_WAITING'}); }catch(_){ }
      /* controllerchange normally does the reload. If the worker never claims
         — an edge nobody should be stranded by — reload anyway. */
      setTimeout(()=>{ try{ location.reload(); }catch(_){ } }, 2000); };
    let p=null;
    try{ if (game.inGarden && hasStorage){
      // The page is about to go: edits behind another tab's version are saved as a copy.
      if (gardenEditedSinceSync()) saveSession.fork=true;
      p=saveSolo(true);
    } }catch(e){ noteError(e,'update-save'); }
    if (p && p.then) p.then(go2,go2); else go2();
  };
  return true;
}
function watchForAppUpdate(reg){
  if (!reg || !navigator.serviceWorker) return;
  /* No controller means this is the first visit on this origin: the worker
     installs and activates with nothing to wait for, so there is no update to
     offer and saying so would be nonsense. */
  const offer=()=>{ if (reg.waiting && navigator.serviceWorker.controller) offerAppUpdate(reg.waiting); };
  offer();
  reg.addEventListener('updatefound',()=>{
    const w=reg.installing; if (!w) return;
    w.addEventListener('statechange',()=>{ if (w.state==='installed') offer(); });
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if (!updateTakingOver) return;      // never reload out from under a session that did not ask
    updateTakingOver=false;             // guard the reload against firing twice
    try{ location.reload(); }catch(_){ }
  });
  /* An installed PWA is resumed rather than navigated, so left alone it may go
     a day between update checks. Ask on resume, throttled. */
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) return;
    const now=Date.now();
    if (now-lastUpdateCheck < UPDATE_CHECK_GAP) return;
    lastUpdateCheck=now;
    try{ reg.update().then(offer,()=>{}); }catch(_){ }
  });
}
/* ---- debug HUD: perf diagnostics, off by default ----
   Toggle with the backtick key (`) or add ?debug to the URL. Costs nothing
   when off (every measurement is guarded by dbg.on). Shows FPS + a per-frame
   time breakdown — ground pass vs entity/plant pass vs the rest — so we can
   see where the frame actually goes, plus entity/tile counts and the canvas
   pixel budget. Works identically on desktop and tablet for side-by-side. */
const dbg={on:false, flush:false, el:null, fps:0, fpsAt:0, n:0, acc:{}, ents:0, tiles:0,
  ev:Object.create(null), gapLast:0, gapMax:0, gapOver:0, gapN:0, gapSusp:0,
  GAP_BUDGET:20, GAP_SUSPEND:250, gapSuspMax:0};
// Labelled phase timing with ~zero cost when off: dnow() reads the clock only
// while on; dmark folds the elapsed delta into a named accumulator; dtime wraps
// an ad-hoc call so any function can be timed (e.g. dtime('flood',()=>doFloodFill())).
/* ---- flush attribution: the phase timers were measuring the wrong thing ----
   A canvas 2D call SUBMITS a command; the backend rasterizes later. Every
   dmark therefore closed over submission time alone, and the raster landed
   outside all of them. Measured on a furnished 69ft garden the phases summed
   to 7.0ms against a 10.4ms frame — a third of the frame attributed to
   nothing, and the missing third sat almost entirely in the three full-screen
   passes (sky, the ground blit, the light wash) that the breakdown was
   reporting at 0.00-0.15ms.

   Forcing a 1px readback at each phase boundary makes the backend finish the
   queue before the clock is read, so a phase carries its own raster: the same
   frame then attributes 29.17ms of 29.25ms, and those three read 3.9 / 6.9 /
   3.5ms against the 0.00-0.15ms they reported before.

   Read those as SHARES, never as a frame budget, and the reason is sharper
   than "the readback costs something" — measured, a bare readback on an empty
   queue is 1.7us, so the floor is nothing.  What it costs is PIPELINING: the
   ground blit is 33.5us amortised across 200 back-to-back calls and 4.8ms
   when you wait for one to land, because normally it overlaps the next
   frame's JS and here it cannot.  So flush mode tells you WHERE the GPU work
   is, and overstates what removing it would give you back.

   When you need a number you can subtract, use drawProfile: it A/Bs whole
   frames that differ only in which entities are present, so the pipelining is
   identical on both sides and the delta is real.  Off by default, and one
   boolean read when off. */
function dflush(ctx2){
  if (!dbg.on || !dbg.flush) return;   // dbg.on so the helper is safe to call from anywhere
  const c=ctx2||(typeof cx!=='undefined'?cx:null);
  if (!c || typeof c.getImageData!=='function') return;
  try{ c.getImageData(0,0,1,1); }catch(_){ }
}
function toggleFlushProfiling(){
  dbg.flush=!dbg.flush; dbgReset();
  console.log('flush attribution '+(dbg.flush?'ON — phases now carry their raster; absolutes inflate, read shares':'off'));
  return dbg.flush;
}
function dnow(){ if (!dbg.on) return 0; dflush(); return performance.now(); }
function dmark(label,t0){ if (!dbg.on) return; dflush(); dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t0); }
function dtime(label,fn){ if (!dbg.on) return fn(); const t=performance.now();
  try{ return fn(); } finally{ dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t); } }
/* ---- EVENT timers: the costs a per-frame average cannot show ----
   The expensive work in this app is invalidation-triggered, not per-frame: a
   ground bake, a region trace, a scene rebuild, an undo snapshot. Folded into
   dbg.acc they are averaged over the ~500ms window and then reset, so a 70ms
   bake either smears into +2ms across 35 frames or misses the window entirely
   and reads 0.00 — which is exactly what the HUD showed while we were trying to
   find it. Events are therefore reported as last/max/count and deliberately
   SURVIVE dbgReset: the whole point is to catch something that happened once.
   dev allocates one record per LABEL, never per call. */
function dev(label,t0,ctx2){
  if (!dbg.on) return 0;
  // Only an event that DRAWS passes a context. Flushing a pure-JS event (trace,
  // scene, snap) would bill it for whatever canvas work happened to be pending.
  if (ctx2) dflush(ctx2);
  const ms=performance.now()-t0;
  let e=dbg.ev[label];
  if (!e) e=dbg.ev[label]={last:0,max:0,n:0,total:0};
  e.last=ms; e.n++; e.total+=ms;
  if (ms>e.max) e.max=ms;
  return ms;   // callers subtract a rare event out of the phase it sits inside
}
function devTime(label,fn){ if (!dbg.on) return fn(); const t=performance.now();
  try{ return fn(); } finally{ dev(label,t); } }
/* Real rAF spacing. The phase timers can sum to 3ms while frames land 30ms
   apart — GPU composite, backdrop-blur recomposite, GC and layout are all
   outside them. That gap is what the glass governor trips on and what nothing
   else could see. Fed the UNCLAMPED delta (loop's dt is capped at 50ms so a
   long stall would read as 50) and only on interaction frames, since the idle
   cadence is a deliberate 30fps and would otherwise read as constant jank. */
function dgap(raw){
  if (!dbg.on) return;
  dbg.gapLast=raw; dbg.gapN++;
  /* A backgrounded tab stops rAF entirely and the first frame back reports the
     whole hidden period as one gap — measured at 709ms and 1158ms in a session
     where the worst REAL stall was under 40ms. That is a suspend, not jank, and
     letting it set gapMax buries every genuine stall beneath it. Count them
     separately so the resume is still visible but cannot pollute the signal.

     But DISCARDING the size was its own blind spot, found while chasing a
     report of fast-forward taking 4-5s to restart after a long hold: a stall
     that big is over the threshold, so the HUD showed `(+2 suspend)` and threw
     away the one number the investigation needed — and a real multi-second
     freeze is indistinguishable here from a tab resume. Keep the worst of them
     so the reading is `(+2 suspend, worst 4300ms)`. It still cannot say WHICH
     it was, but a suspend the user never caused is now at least visible. */
  if (raw>dbg.GAP_SUSPEND){ dbg.gapSusp++;
    if (raw>dbg.gapSuspMax) dbg.gapSuspMax=raw; return; }
  if (raw>dbg.gapMax) dbg.gapMax=raw;
  if (raw>dbg.GAP_BUDGET) dbg.gapOver++;
}
function dbgReset(){ dbg.n=0; dbg.acc={}; }              // per-window phase averages
function devReset(){ dbg.ev=Object.create(null); dbg.gapMax=0; dbg.gapOver=0; dbg.gapN=0; dbg.gapSusp=0; dbg.gapSuspMax=0; }
function toggleDebug(){
  dbg.on=!dbg.on;
  if (dbg.on && !dbg.el){
    dbg.el=document.createElement('div'); dbg.el.id='debugHud';
    dbg.el.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99;'+
      'background:rgba(10,7,5,.82);color:#cfe3c2;font:11px/1.5 ui-monospace,Menlo,monospace;'+
      'padding:6px 11px;border-radius:6px;white-space:pre;pointer-events:none;letter-spacing:.02em';
    document.body.appendChild(dbg.el);
  }
  if (dbg.el) dbg.el.style.display=dbg.on?'block':'none';
  dbg.fpsAt=performance.now(); dbgReset(); devReset();   // each session starts on clean event stats
}
function updateDebugHud(){
  if (!dbg.el) return;
  const c=document.getElementById('gameCanvas'), n=dbg.n||1, avg=ms=>ms/n;
  const mp=c?(c.width*c.height/1e6).toFixed(2):'?';
  const total=dbg.acc.frame||0;
  // flush mode inflates every absolute, so say so on the HUD rather than letting
  // a 3x number be read as a frame budget
  const flushNote=dbg.flush?'  [FLUSH: shares only]':'';
  // every measured phase, biggest first, with its share of the frame
  const rows=Object.keys(dbg.acc).filter(k=>k!=='frame')
    .sort((a,b)=>dbg.acc[b]-dbg.acc[a])
    .map(k=>`  ${k.padEnd(7)}${avg(dbg.acc[k]).toFixed(2).padStart(6)}ms ${(total?Math.round(dbg.acc[k]/total*100):0).toString().padStart(3)}%`)
    .join('\n');
  // events: last/max/count, worst-max first. These persist across windows, so a
  // bake that happened three seconds ago is still on screen to be read.
  const evKeys=Object.keys(dbg.ev).sort((a,b)=>dbg.ev[b].max-dbg.ev[a].max);
  const evRows=evKeys.length
    ? '\nevents (last/max ×n)\n'+evKeys.map(k=>{ const e=dbg.ev[k];
        return `  ${k.padEnd(7)}${e.last.toFixed(1).padStart(6)}/${e.max.toFixed(1).padStart(6)}ms ×${e.n}`;
      }).join('\n')
    : '';
  /* The two sprite caches decide whether a dense garden is affordable, and
     neither had a readout. The distinct count is the one to watch for
     structures: it is how much SHARING the content keys are winning — a
     195-tile building footprint should be about four sprites, not 195. */
  const sspr=(typeof SSPRITE!=='undefined')
    ? '\nsprites  plant '+PSPRITE.map.size+' ('+(PSPRITE.bytes/1048576).toFixed(1)+'MB'+(PSPRITE.active?', on':', off')+')'
      +'  struct '+SSPRITE.map.size+' ('+(SSPRITE.bytes/1048576).toFixed(1)+'MB)'+(SSPRITE.off?' OFF':'')
    : '';
  const gap=dbg.gapN
    ? `\nspacing  last ${dbg.gapLast.toFixed(1)}ms  max ${dbg.gapMax.toFixed(1)}ms`+
      `  over-${dbg.GAP_BUDGET}ms ${dbg.gapOver}/${dbg.gapN}`+
      (dbg.gapSusp?`  (+${dbg.gapSusp} suspend, worst ${dbg.gapSuspMax.toFixed(0)}ms)`:'')
    : '';
  dbg.el.textContent=
    `FPS ${(dbg.fps||0).toFixed(0)}   frame ${avg(total).toFixed(2)}ms  (${dbg.ents} ents, ${dbg.tiles} tiles)${flushNote}\n`+
    rows+evRows+sspr+gap+'\n'+
    `canvas ${c?c.width+'×'+c.height:'?'} (${mp}MP)  dpr ${devicePixelRatio}  zoom ${ZOOM.toFixed(2)}`+
    `  glass ${GLASS.off?'OFF':'on'} (${GLASS.ema.toFixed(1)}ms)`;
}
/* ---- debug-only: repeatable ground-bake benchmark ----
   Eyeballing the HUD cannot compare two builds: the bake fires on edit, the
   numbers move with window size and zoom, and a single sample on a machine that
   is doing anything else is noise. perfBench builds a DETERMINISTIC garden
   (mulberry-seeded, so the same call gives the same layout every time), forces
   `rounds` bakes, and reports min/median/max — min being the honest one, since
   noise only ever adds time.

     perfBench()                                  // 46ft plot, organic, 15 rounds
     perfBench({gw:46, edge:'formal'})            // same real garden on a 12in grid
     perfBench({gw:69, rounds:25, edit:false})    // settle-rebake only, no re-trace

   `edit:true` (default) also invalidates terrainRev each round, so the region
   trace is included — that is what a brush stroke actually costs. `edit:false`
   measures a pan/zoom settle rebake, where the trace is cached.

   Two things this cannot do for you: it needs a COMPOSITING window (a hidden or
   backgrounded tab does not rasterize, and canvas timings taken there swing by
   3x and can even show less work costing more), and it replaces whatever garden
   is open. It parks itself on a scratch world id so autosave cannot overwrite a
   real garden, but save your work first. */
function perfBench(opts){
  opts=opts||{};
  const gw=Math.max(8,opts.gw||31), gh=Math.max(8,opts.gh||gw);
  const edge=opts.edge==='formal'?'formal':'organic';
  const rounds=Math.max(3,opts.rounds||15), edit=opts.edit!==false;
  /* Furnish the bench garden with the layers added after the ground-bake
     work. Edging and the wall facing land INSIDE the bake, so a bench that
     builds neither measures a July garden and reports a fortnight of new
     hardscape as free. Pass furnish:false for the old bare comparison. */
  const furnish=opts.furnish!==false;
  if (!game.inGarden){ console.warn('perfBench: open a garden first (it needs a live canvas).'); return null; }
  const wasOn=dbg.on; dbg.on=true; devReset();
  const rnd=mulberry(0x9E3779B9);
  // --- deterministic garden: beds/path in NORMALIZED plot coords, so the same
  // real layout lands on any grid size and two grids stay comparable ---
  game.previewMode='established';
  setWorldSize(gw,gh);
  game.worldId='perfbench'; game.worldName='perfBench scratch';
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={};
  game.fences={}; game.lights={}; game.firepits={}; game.boulders={}; game.pets={}; game.pots={}; game.seats={}; game.ornaments={};
  game.houses=[]; game.buildings=[]; game.schemes=[]; game.schemeActive=null;
  game.rot=0; game.edgeStyle=edge; game.bedStyle='soil'; game.pathColor='warm';
  const keys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const pool=t=>keys.filter(k=>PLANTS[k].type===t);
  const herb=pool('grass').concat(pool('forb')), trees=pool('tree'), shrubs=pool('shrub');
  const now=Date.now(), day=absDay();
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
    const u=(x+0.5)/gw, v=(y+0.5)/gh;
    if (Math.abs(v-0.5-0.14*Math.sin(u*6))<0.045) setTile('terrain',x+','+y,{k:'path',c:'warm',t:now});
    else if (Math.sin(u*5.1+1.3)*0.5+Math.cos(v*4.4)*0.5+u*0.3 > 0.0825)
      setTile('terrain',x+','+y,{k:'bed',c:'soil',t:now});
  }
  const drop=(list,n,age)=>{ let placed=0,guard=0;
    while (placed<n && guard++<n*400){
      const x=(rnd()*gw)|0, y=(rnd()*gh)|0, k=x+','+y;
      if (game.plants[k]) continue;
      setTile('plants',k,{s:list[(rnd()*list.length)|0],d:day-age,t:now}); placed++; } };
  if (trees.length) drop(trees,8,3650);
  if (shrubs.length) drop(shrubs,22,1825);
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
    const k=x+','+y, tt=game.terrain[k];
    if (!tt || tt.k!=='bed' || game.plants[k]) continue;
    if (rnd()>0.8) continue;
    setTile('plants',k,{s:herb[(rnd()*herb.length)|0],d:day-40,t:now});
  }
  if (furnish) furnishGarden(typeof opts.furnish==='object'?opts.furnish:{});
  enterGarden(); fitPlot();
  game.edgeStyle=edge;                       // enterGarden re-normalizes it
  const samples=[], traces=[];
  buildTerrainRegions();                     // warm the region cache before the warmup bakes
  for (let i=0;i<4;i++){ groundKey=''; render(performance.now()); }
  devReset();                                // discard warmup
  for (let i=0;i<rounds;i++){
    if (edit) markGroundChanged({terrain:true});
    groundKey='';
    render(performance.now());
    if (dbg.ev.bake) samples.push(dbg.ev.bake.last);
    if (dbg.ev.trace) traces.push(dbg.ev.trace.last);
  }
  dbg.on=wasOn;
  /* performance.now() is clamped to 1ms without cross-origin isolation, which
     is what this app ships as — every individual sample comes back a whole
     number, so min/med/max are quantized and a sub-3ms cost is unreadable. The
     MEAN is the way through: quantization error is roughly uniform, so it
     cancels at ~quantum/sqrt(12N) — about 0.08ms over 15 rounds. Read `mean`
     when comparing two builds; read min/max for the spread. */
  const stat=a=>{ if (!a.length) return null; const s=a.slice().sort((x,y)=>x-y);
    let sum=0; for (const v of a) sum+=v;
    return {mean:+(sum/a.length).toFixed(2), min:+s[0].toFixed(1),
      med:+s[(s.length/2)|0].toFixed(1), max:+s[s.length-1].toFixed(1)}; };
  const out={plot:`${gw}x${gh}`, feet:`${Math.round(gw*TILE_IN/12)}x${Math.round(gh*TILE_IN/12)}ft`,
    edge, edit, rounds, tileIn:TILE_IN, furnished:furnish,
    fences:Object.keys(game.fences).length, pots:Object.keys(game.pots||{}).length,
    seats:Object.keys(game.seats||{}).length, elevation:Object.keys(game.elevation).length,
    terrainTiles:Object.keys(game.terrain).length, plants:Object.keys(game.plants).length,
    bakeMs:stat(samples), traceMs:stat(traces),
    canvas:cnv?`${cnv.width}x${cnv.height}`:'?', dpr:DPR, zoom:+ZOOM.toFixed(2),
    compositing:!document.hidden};
  if (document.hidden) console.warn('perfBench: tab is HIDDEN — canvas timings here are not trustworthy.');
  const line=(k,s)=>s?`mean ${s.mean}  (min ${s.min} med ${s.med} max ${s.max})`:'n/a';
  console.log(`perfBench ${out.plot} (${out.feet}) ${edge}${edit?' +edit':''}  `+
    `${out.terrainTiles} terrain tiles, ${out.plants} plants`+
    (furnish?`, ${out.fences} fence, ${out.elevation} terrace, ${out.pots} pots, ${out.seats} seats`:` (BARE: no hardscape — pass furnish:true for the shipping app)`)+`\n`+
    `  bake  ${line('bake',out.bakeMs)} ms\n`+
    `  trace ${out.traceMs?line('trace',out.traceMs):'cached'} ms\n`+
    `  canvas ${out.canvas} dpr ${out.dpr} zoom ${out.zoom}`+
    `   — compare on MEAN (the clock quantizes each sample to 1ms)`);
  return out;
}
/* ---- debug-only: where the DRAW phase goes, by entity class ----
   The breakdown stops at `draw`, which on a furnished garden is half the frame
   and holds a dozen unrelated kinds of object. Plants have a sprite cache;
   fences, buildings, pots, seats, boulders, firepits, pets and houses do not —
   every one of them re-runs its procedural recipe on every frame forever. So
   "draw 6.5ms" could be 640 plants or it could be one 224-tile building
   footprint, and nothing on the HUD could tell you which.

   They interleave in ONE depth-sorted pass, so there is nowhere to hang a
   per-class timer that does not cost something on every frame. Ablation is the
   way through: render the scene holding only one class, against an empty-scene
   baseline, and take the min over several rounds.

     drawProfile()                       // as the sprite governor has it now
     drawProfile({sprites:'off'})        // procedural plants — the honest worst case
     drawProfile({frames:30, rounds:8})  // longer, for a quieter machine

   `us` — microseconds per entity — is the number comparisons want: it says what
   one more chair, or one more tile of footprint, costs on every future frame. */
function drawProfile(opts){
  opts=opts||{};
  if (typeof scene==='undefined' || !cnv){ console.warn('drawProfile: needs a live canvas.'); return null; }
  if (document.hidden) console.warn('drawProfile: tab is HIDDEN — canvas timings here are not trustworthy.');
  const frames=Math.max(4,opts.frames||20), rounds=Math.max(3,opts.rounds||5);
  const wasOff=PSPRITE.off, wasActive=PSPRITE.active, wasDbg=dbg.on;
  const wasEnts=scene.ents;
  /* Everything below PINS renderer state, and an interrupted or throwing run
     used to leave it pinned. One aborted drawProfile({sprites:'off'}) left
     PSPRITE.off true and silently disabled the plant cache for the rest of
     the session: a 4.7ms garden then measured 143ms and the governor could
     not turn it back on, because `off` is exactly the flag that tells it not
     to. An instrument that leaves its subject in a different state than it
     found it is worse than no instrument. */
  try{
  dbg.on=false;                       // the phase timers would tax every ablation
  const pinOff = opts.sprites==='off', pinOn = opts.sprites==='on';
  if (pinOff) PSPRITE.off=true;
  if (pinOn) PSPRITE.off=false;
  buildScene(VW/ZOOM,VH/ZOOM);        // measure the scene as it really stands
  const all=scene.ents.slice();
  const names={}; for (const k in SCENE_K) names[SCENE_K[k]]=k;
  const groups={};
  for (const e of all) (groups[e.kind]||(groups[e.kind]=[])).push(e);
  /* One readback after the batch forces the backend to finish what it queued.
     Without it this measures command SUBMISSION and every class reads as nearly
     free — the same blind spot dbg.flush exists for. */
  const flush=()=>{ try{ cx.getImageData(0,0,1,1); }catch(_){ } };
  const run=(ents)=>{
    let best=Infinity;
    for (let r=0;r<rounds;r++){
      scene.ents=ents; render(performance.now()); flush();          // warm
      const t0=performance.now();
      for (let i=0;i<frames;i++){
        scene.ents=ents;                                            // re-pin: render may rebuild
        if (pinOn) PSPRITE.active=true; else if (pinOff) PSPRITE.active=false;
        render(performance.now());
      }
      flush();
      const v=(performance.now()-t0)/frames;
      if (v<best) best=v;
    }
    return best;
  };
  const base=run([]), full=run(all);
  const rows=[];
  for (const k in groups){
    const n=groups[k].length, ms=run(groups[k])-base;
    rows.push({kind:names[k]||k, n, ms:+ms.toFixed(2), us:+((ms/n)*1000).toFixed(1),
      pct:full>0?Math.round(ms/full*100):0});
  }
  rows.sort((a,b)=>b.ms-a.ms);
  const cached=new Set(['PLANT','BULB']);
  const uncached=rows.filter(r=>!cached.has(r.kind)).reduce((acc,r)=>acc+r.ms,0);
  const out={frameMs:+full.toFixed(2), baselineMs:+base.toFixed(2), entities:all.length,
    sprites:pinOff?'off':pinOn?'on':(wasActive?'auto-on':'auto-off'),
    rows, uncachedMs:+uncached.toFixed(2),
    uncachedPct:full>0?Math.round(uncached/full*100):0,
    canvas:cnv?cnv.width+'x'+cnv.height:'?', dpr:DPR, zoom:+ZOOM.toFixed(2),
    compositing:!document.hidden};
  /* An ablation of ONE entity measures a frame against a frame, so its
     per-entity figure is whatever the frame-to-frame noise happened to be —
     on the demo garden a lone pet read 140us on one run and -87us on the
     next. Say so instead of printing a confident microsecond number. */
  const NOISY=8;
  console.log('drawProfile  frame '+out.frameMs+'ms  ('+out.entities+' ents, sprites '+out.sprites+
      ', '+out.canvas+' dpr '+out.dpr+')\n'+
    '  baseline (no entities) '+out.baselineMs+'ms — sky + ground blit + shade + light\n'+
    rows.map(r=>'  '+r.kind.padEnd(16)+String(r.ms).padStart(6)+'ms '+String(r.pct).padStart(3)+
      '%  x'+String(r.n).padStart(4)+'  '+(r.n<NOISY?'   (n too small to time)':String(r.us).padStart(6)+'us each')).join('\n')+
    '\n  uncached structures '+out.uncachedMs+'ms ('+out.uncachedPct+
      '% of frame) — redrawn every frame, never cached');
  return out;
  } finally {
    scene.ents=wasEnts; game.sceneRev++;   // restore on every path out
    PSPRITE.off=wasOff; PSPRITE.active=wasActive; dbg.on=wasDbg;
  }
}
/* ---- debug-only: the layers the bench could not see ----
   perfBench and stressGarden build plants, bulbs and terrain — which was the
   whole app as it stood in July. Everything added since (edging, faced
   retaining walls, real-height fences, containers, seating, editable building
   footprints) lands in a bench garden containing none of it, so the bench kept
   reporting a garden that got no more expensive while the frame filled up with
   objects it never created. This furnishes the CURRENT garden deterministically,
   so both dev tools measure the app that actually ships.

   Deliberately mirrors a real design rather than packing the plot: a perimeter
   fence, one terrace faced in stone, edging on the beds, a handful of pots and
   chairs, one garage footprint. Pass counts to push any one of them. */
function furnishGarden(opts){
  opts=opts||{};
  const rnd=mulberry(opts.seed||0x5EED1234), now=Date.now();
  const num=(v,d)=>v==null?d:v;
  if (!game.pots) game.pots={};
  if (!game.seats) game.seats={};
  // edging rides the terrain record, so it is a region-trace cost, not a layer
  let edged=0;
  if (opts.edging!==false) for (const k in game.terrain){
    const e=game.terrain[k];
    if (e && !e.removed && e.k==='bed'){ e.e=(typeof opts.edging==='string')?opts.edging:'steel'; edged++; }
  }
  // one raised terrace with a faced wall
  let terraced=0;
  if (opts.walls!==false){
    const x0=Math.max(1,(GW*0.55)|0), y0=Math.max(1,(GH*0.18)|0);
    const w=Math.max(3,(GW*0.30)|0), h=Math.max(3,(GH*0.26)|0);
    for (let y=y0;y<Math.min(GH-1,y0+h);y++) for (let x=x0;x<Math.min(GW-1,x0+w);x++){
      setTile('elevation',x+','+y,{h:1,w:(typeof opts.walls==='string')?opts.walls:'drystone',t:now});
      terraced++; }
  }
  // perimeter fence — the commonest hardscape gesture there is
  let fenced=0;
  if (opts.fences!==false){
    const st=(typeof opts.fences==='string')?opts.fences:'privacy', hgt=num(opts.fenceFt,6);
    const put=(x,y)=>{ if (canPlaceFence(x,y)){
      setTile('fences',x+','+y,{style:st,height:hgt,gate:false,t:now}); fenced++; } };
    for (let x=0;x<GW;x++){ put(x,0); put(x,GH-1); }
    for (let y=1;y<GH-1;y++){ put(0,y); put(GW-1,y); }
  }
  const scatter=(layer,n,make)=>{ let placed=0,guard=0;
    while (placed<n && guard++<n*300){
      const x=(rnd()*GW)|0, y=(rnd()*GH)|0, k=x+','+y;
      if (!onPlot(x,y) || game[layer][k] || game.pots[k] || game.seats[k]) continue;
      setTile(layer,k,make()); placed++; }
    return placed; };
  const potStyles=POT_STYLES.map(p=>p.id), potSizes=POT_SIZES.map(p=>p.id);
  const seatTypes=SEAT_TYPES.map(t2=>t2.id), fins=SEAT_FINISHES.map(t2=>t2.id);
  const pots=scatter('pots',num(opts.pots,14),()=>({style:potStyles[(rnd()*potStyles.length)|0],
    size:potSizes[(rnd()*potSizes.length)|0],t:now}));
  const seats=scatter('seats',num(opts.seats,10),()=>({type:seatTypes[(rnd()*seatTypes.length)|0],
    finish:fins[(rnd()*fins.length)|0],face:(rnd()*4)|0,t:now}));
  // the ornaments last, so the pieces above land exactly where they always have
  if (!game.ornaments) game.ornaments={};
  const ornKinds=ORNAMENTS.filter(o=>o.wIn<=TILE_IN*1.4&&o.dIn<=TILE_IN*1.4).map(o=>o.id);
  const ornaments=scatter('ornaments',num(opts.ornaments,8),()=>{ const kind=ornKinds[(rnd()*ornKinds.length)|0];
    return {kind,finish:ornamentKind(kind).finishes[0],face:(rnd()*4)|0,t:now}; });
  /* One building footprint. It is the class most able to surprise you: the
     polygon becomes one scene entity per TILE, so a garage is 200+ entities. */
  let footprint=0;
  if (opts.building!==false){
    const w=Math.max(4,num(opts.buildingW,(GW*0.34)|0)), h=Math.max(4,num(opts.buildingH,(GH*0.30)|0));
    const x0=Math.max(1,(GW*0.10)|0), y0=Math.max(1,(GH*0.10)|0);
    const x1=Math.min(GW-1,x0+w), y1=Math.min(GH-1,y0+h);
    game.buildings=(game.buildings||[]).concat([{id:'bench-'+now, status:'existing', label:'Garage',
      vertices:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]], fill:'#8b8378', edge:'#5a544c', t:now}]);
    markModelChanged(); markLayerCacheChanged('buildings');
    footprint=buildingTiles(game.buildings[game.buildings.length-1]).length;
  }
  markGroundChanged({terrain:true}); markModelChanged(); game.sceneRev++;
  groundKey='';
  const out={edgedTiles:edged, terraceTiles:terraced, fenceTiles:fenced, pots, seats, ornaments, footprintTiles:footprint};
  console.log('furnishGarden '+JSON.stringify(out));
  return out;
}
// debug-only: pack the plot with a dense mix so the profiler sees worst-case.
function stressGarden(){
  const keys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const byType={}; for (const k of keys){ (byType[PLANTS[k].type]||(byType[PLANTS[k].type]=[])).push(k); }
  const pick=t=>{ const a=byType[t]; return a&&a[(Math.random()*a.length)|0]; };
  game.plants={}; game.bulbs={};
  const now=Date.now(), d=absDay();
  for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
    if (inHouse(x,y)||isDoor(x,y)) continue;
    const r=Math.random(); let s=null;
    if (r<0.04) s=pick('tree');
    else if (r<0.11) s=pick('shrub');
    else if (r<0.58) s=pick(Math.random()<0.5?'grass':'forb');
    else if (r<0.70){ const b=pick('bulb'); if (b) setTile('bulbs',x+','+y,{s:b,d,t:now}); continue; }
    else continue;
    if (s) setTile('plants',x+','+y,{s,d,t:now});
  }
  groundKey='';
  toast('Stress garden: '+Object.keys(game.plants).length+' plants, '+Object.keys(game.bulbs).length+' bulbs');
}
/* ---------- crash recovery ----------
   rAF swallows nothing, so an uncaught throw inside render() used to leave a
   black canvas with no way back, no save, and no report — the app was simply
   dead until the tab was closed, taking the session's work with it.

   Two different failures get two different responses, deliberately. A throw in
   the render loop IS fatal (the frame never completes, the garden is frozen),
   so it banks the work and shows a way out. A throw anywhere else — a click
   handler, a rejected promise — leaves a working app, so it is recorded for the
   report and otherwise left alone; panelling the screen over a stray rejection
   would be worse than the bug.

   The panel builds its own DOM with inline styles and calls no app function
   beyond the save: whatever broke the frame may equally break showConfirm or a
   token lookup, and a recovery screen that needs a working app is not one. */
let crashed=false;
const errLog=[];                                   // ring buffer, joins the report
function noteError(err,where){
  errLog.push({where, msg:(err&&err.message)||String(err),
    stack:(err&&err.stack)||'', t:Date.now()});
  if (errLog.length>12) errLog.shift();
  try{ console.error('[pocket-prairie]',where,err); }catch(_){ }
}
function reportCrash(err,where){
  finishGardenOpen(); // keep the recovery controls reachable if preparation failed
  if (crashed) return;                             // a throwing frame would
  crashed=true;                                    // otherwise storm the report
  noteError(err,where);
  const panel=buildCrashPanel(err,where);
  // Bank the garden before anything else can go wrong. saveSolo is async, so
  // the panel says "saving" and tells the truth once the write actually lands.
  let p=null;
  try{ if (game.inGarden&&hasStorage){
    // Nobody can answer the stale bar from here: edits behind another tab go to a copy.
    if (gardenEditedSinceSync()) saveSession.fork=true;
    p=saveSolo(true);
  } }catch(e){ noteError(e,'crash-save'); }
  if (p&&p.then) p.then(ok=>panel.setSave(ok?'saved':'failed'),()=>panel.setSave('failed'));
  else panel.setSave(game.inGarden?'failed':'none');
}
function buildCrashPanel(err,where){
  const wrap=document.createElement('div');
  wrap.setAttribute('role','alertdialog');
  wrap.setAttribute('aria-label','Pocket Prairie stopped');
  wrap.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;'+
    'align-items:center;justify-content:center;padding:24px;'+
    'background:rgba(20,14,11,.88);color:#ece3d4;'+
    "font-family:'IBM Plex Sans',system-ui,sans-serif";
  const card=document.createElement('div');
  card.style.cssText='max-width:440px;width:100%;background:#2f231d;'+
    'border:1px solid #40312a;border-radius:9px;padding:22px 24px;'+
    'box-shadow:0 12px 40px rgba(0,0,0,.5)';
  const h=document.createElement('h2');
  h.textContent='Pocket Prairie stopped';
  h.style.cssText="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;"+
    'font-size:24px;font-weight:600;color:#ece3d4';
  const body=document.createElement('p');
  body.textContent='Something went wrong while drawing the garden. This is a bug, not something you did.';
  body.style.cssText='margin:0 0 14px;font-size:15px;line-height:1.5;color:#b3a692';
  const save=document.createElement('p');
  save.textContent='Saving your garden…';
  save.style.cssText='margin:0 0 18px;font-size:14px;line-height:1.5;color:#c97f3f';
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
  const mk=(label,primary)=>{ const b=document.createElement('button');
    b.type='button'; b.textContent=label;
    b.style.cssText='flex:1 1 auto;min-width:120px;padding:11px 14px;font:inherit;'+
      'font-size:14px;font-weight:500;border-radius:5px;cursor:pointer;'+
      (primary?'background:#c97f3f;color:#1b1310;border:1px solid #c97f3f'
             :'background:transparent;color:#ece3d4;border:1px solid #5a4a40');
    row.appendChild(b); return b; };
  mk('Reload',true).onclick=()=>location.reload();
  const copy=mk('Copy error details',false);
  copy.onclick=()=>{
    /* The funnel rides along. A stack alone says what broke; the counters say
       what the gardener had actually done by then, which is usually the
       difference between a reproducible report and a guess. It is device-local
       either way — this is the gardener choosing to paste it. */
    let fn=''; try{ fn='\n\n'+funnelSummary(); }catch(_){ }
    const txt=['Pocket Prairie '+(APP_VERSION||'?')+' — '+where,
      navigator.userAgent, '',
      ...errLog.map(e=>e.where+': '+e.msg+'\n'+e.stack)].join('\n')+fn;
    try{ navigator.clipboard.writeText(txt).then(
      ()=>{ copy.textContent='Copied'; },
      ()=>{ copy.textContent='Press Ctrl+C'; window.prompt('Copy this:',txt); }); }
    catch(_){ window.prompt('Copy this:',txt); }
  };
  card.append(h,body,save,row); wrap.appendChild(card);
  document.body.appendChild(wrap);
  return { setSave(state){
    save.textContent = state==='saved' ? 'Your garden was saved. Reloading is safe.'
      : state==='none' ? 'No garden was open, so nothing was lost.'
      : 'Your garden could not be saved automatically. Reloading may lose recent changes.';
    save.style.color = state==='failed' ? '#d9645a' : '#c97f3f';
  } };
}
window.addEventListener('error', e=>noteError(e.error||e.message,'window'));
window.addEventListener('unhandledrejection', e=>noteError(e.reason,'promise'));

function loop(t){
  if (crashed) return;                             // the frame that threw is not
  try{ frame(t); }                                 // going to succeed on a retry
  catch(err){ reportCrash(err,'render-loop'); return; }
  requestAnimationFrame(loop);
}
function frame(t){
  const rawGap=t-prev;                                // unclamped: stall detection needs the real spacing
  const dt=Math.min(50,Math.max(0,rawGap)); prev=t;   // floor 0: a backward t must never rewind FF time
  if (game.inGarden){
    const tFrame=dnow();
    pollFastForwardHold();          // the hold deadline, checked where it cannot be starved
    /* Fast-forward advances by REAL elapsed time, not by the 50ms frame clamp.
       Sharing that clamp made the fast-forward RATE a function of framerate: it
       is a fixed FF_RATE ms of garden time per ms of real time only while a
       frame fits inside 50ms, and past that the gesture silently slows down in
       proportion. Measured against DAY_MS/FF_RATE = 2.00 game days a second:
       67.88ms frames gave 1.47 days/s (74%), a 169.7ms stall 0.59 (29%), and a
       552ms one 0.18 (9%) — so a season is 8 seconds on a fast machine and up
       to a minute and a half on a slow one. Reported as `I can't fast forward`
       on one heavy garden while every other garden felt fine, which is exactly
       the shape of a bug that scales with frame cost rather than switching on.
       The cap stays, because a resumed tab hands back one enormous gap and
       nobody wants a year of garden time in a single frame; it is just the
       app's own threshold for that (dbg.GAP_SUSPEND, 250ms) instead of a frame
       budget. Anything from 4fps up now fast-forwards at its true rate, and the
       worst a single frame can jump is FF_RATE*250 = half a garden day. */
    if (game.ffActive && !game.skipClockHeld){
      game.elapsedMs=(game.elapsedMs||0)+FF_RATE*Math.min(FF_MAX_STEP_MS,Math.max(0,rawGap));
      game.dirty=true;
    }
    const shouldDraw=shouldRenderGarden(t);
    if (shouldDraw){
      // glass governor samples frame SPACING, but only while the user is
      // actively interacting — idle frames run at a deliberate 30fps cadence
      // and would read as jank.
      if (hasTransientGardenWork() || t-lastMeaningfulChange<IDLE_GRACE_MS){ updateGlassMode(dt); dgap(rawGap); }
      render(t);                                   // render adds its own phase marks
      lastGardenRender=t;
      const tHud=dnow(); updateHUD(); lastHudUpdate=t; dmark('hud',tHud);
      dmark('frame',tFrame);
      if (dbg.on){ dbg.n++;
        if (t-dbg.fpsAt>=500){ dbg.fps=dbg.n*1000/(t-dbg.fpsAt); updateDebugHud(); dbg.fpsAt=t; dbgReset(); } }
    } else if (t-lastHudUpdate>=HUD_IDLE_MS){
      updateHUD(); lastHudUpdate=t;
    }
  } else if (!menuBackdropCovered()){
    menuBorderWork(t,rawGap);
    if (t-lastMenuRender>=MENU_FRAME_MS){
      menuRender(t);
      lastMenuRender=t;
    }
  }
  snowFrame(t,rawGap);
}
/* ---------- first run ----------
   A stranger's first path through this app was the questionnaire: zone, style,
   natives, deer, rabbit, then a plot to name, size and shape — about eleven
   decisions before a single plant existed, opening on "what is your USDA
   hardiness zone?", a question the app already ships two fallbacks for because
   most people cannot answer it cold.

   So offer the finished garden first. Somebody who says yes is planting inside
   ten seconds; somebody who says no has spent one tap and is on the menu, which
   is where they were headed anyway. The key is device-local (it is a
   preference, not a document, so it stays out of IDB_KEYS and reads
   synchronously). */
const WELCOME_KEY='hortus:welcomed';
/* Storage can be unavailable — private mode, blocked cookies — and this used to
   read that as "already seen", which suppressed the offer AND (because
   coachArmed degraded the other way) every coach beat with it. A whole cohort
   got no onboarding at all. The session flag keeps both working: they are asked
   once per launch rather than never, which is the same way showCoachTip's own
   one-shot already degrades. */
let welcomeSeenSession=false;
function welcomeSeen(){
  if (welcomeSeenSession) return true;
  try{ return localStorage.getItem(WELCOME_KEY)==='1'; }catch(_){ return false; }
}
function markWelcomeSeen(){
  welcomeSeenSession=true;
  try{ localStorage.setItem(WELCOME_KEY,'1'); }catch(_){ }
}
async function maybeOfferDemoGarden(){
  if (welcomeSeen()) return false;
  /* Having gardens is the stronger signal of a returning gardener than the flag
     is of a new one — someone who cleared their preferences, or arrived from a
     build that predates this, should not be greeted as though they were new. */
  let idx=[]; try{ idx=await worldsIndex(); }catch(_){ }
  if (idx.length){ markWelcomeSeen(); return false; }
  /* Arm the coach beats here, not on the answer: someone who declines the demo
     and starts from scratch is exactly as new as someone who accepts it. */
  armCoach();
  funnel(FUNNEL_EVENTS.demoOffered);
  showConfirm(
    'First time here?',
    'There is a small finished garden you can open and play with — plant into it, wind it through a year, and watch what the planting does. It is a copy, so nothing you do to it can spoil anything.',
    'Open the demo garden',
    ()=>{ markWelcomeSeen(); funnel(FUNNEL_EVENTS.demoAccepted); openDemoGarden(); },
    'Start from scratch',
    ()=>{ markWelcomeSeen(); funnel(FUNNEL_EVENTS.demoDeclined); show('menuScreen'); }
  );
  return true;
}

(async function init(){
  /* Count the session, and arrange for the counters to reach storage. funnel()
     only bumps memory — it is called from plantFx, once per placed tile — so the
     serialising happens here: on the way out, and on the same visibility change
     the garden autosaves on, which is the one event a closing tab reliably gets. */
  funnelLoad().sessions++;
  funnel(FUNNEL_EVENTS.appOpen);
  addEventListener('visibilitychange',()=>{ if (document.hidden) funnelFlush(); });
  addEventListener('pagehide',funnelFlush);
  if (hasStorage){
    const f=await sGet('hortus:filters'); if (f) game.filters=normalizeFilters(f);
    await loadPlantCollections();
  }
  updateFilterBtn();
  buildMenuPips();
  paintMenuArt();
  advanceMenuSeason();
  refreshMenuCards();
  syncUnitLabels();     // the unit words typed into index.html default to imperial
  if (location.search.includes('debug')) toggleDebug();
  if (location.search.includes('noglass')){ GLASS.off=true; document.body.classList.add('no-glass'); }
  requestAnimationFrame(loop);
  // after the loop, so the meadow is already drawing behind the dialog
  maybeOfferDemoGarden();
})();
