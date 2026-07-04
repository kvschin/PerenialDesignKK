/* =====================================================
   HORTUS PERENNIS — an Oudolf-style 2.5D gardening game
   ===================================================== */
'use strict';

/* ---------- core constants ---------- */
const SEASONS = ['Spring','Summer','Fall','Winter'];
const DAYS_PER_SEASON = 16;
const DAY_MS = 20000;                 // 20 real seconds per garden day
/* The plot is sized per garden (plot screen / save): GW x GH tiles.
   31x31 (~46ft square at 18-inch tiles) is the classic default. */
let GW = 31, GH = 31;
let SPAWNX = 15, SPAWNY = 15;         // players start at the plot's center
function setWorldSize(gw,gh){ GW=gw; GH=gh;
  SPAWNX=Math.floor(gw/2); SPAWNY=Math.floor(gh/2); }
const TILE_W = 76, TILE_H = 38;
const TILE_IN = 18;                   // real-world inches per tile side (export + plot math)
const ELEV_STEP = 9;                   // pixels per elevation step in the isometric view
const ELEV_MIN = -2, ELEV_MAX = 4;     // first-pass earthwork range: shallow swales to low berms
function ftToTiles(ft){ return Math.max(2, Math.round(ft*12/TILE_IN)); }

/* Approximate USDA hardiness zone from a US ZIP, by 3-digit prefix. Coarse on
   purpose: species use zone RANGES and the region filter is changeable in-game,
   so within ~half a zone is plenty. Stored as [lo,hi,zone] prefix bands (not
   930 rows) with the band's representative zone; gaps + non-US input return null
   (the questionnaire then falls back to the winter-cold picker). Nothing here
   leaves the device — it's a static lookup. Callers clamp to the palette's 3–9. */
const ZIP_ZONE_BANDS=[
  [10,19,5],[20,27,6],[28,29,6],[30,38,5],[39,49,4],[50,59,4],[60,69,6],[70,89,6],   // New England + NJ
  [100,104,7],[105,109,6],[110,119,7],[120,139,5],[140,149,6],[150,168,6],[169,179,5],
  [180,189,6],[190,199,7],                                                            // NY / PA / DE
  [200,205,7],[206,219,7],[220,237,7],[238,246,6],[247,268,6],[270,279,7],[280,289,7],
  [290,299,8],                                                                        // DC / MD / VA / WV / NC / SC
  [300,319,8],[320,329,9],[330,349,10],[350,369,8],[370,385,7],[386,399,8],           // GA / FL / AL / TN / MS
  [400,427,6],[430,459,6],[460,479,6],[480,489,6],[490,499,5],                        // KY / OH / IN / MI
  [500,528,5],[530,549,5],[550,567,4],[570,577,5],[580,588,4],[590,599,4],            // IA / WI / MN / SD / ND / MT
  [600,629,6],[630,658,6],[660,679,6],[680,693,5],                                    // IL / MO / KS / NE
  [700,714,9],[716,729,7],[730,749,7],[750,769,8],[770,779,9],[780,789,8],[790,799,7],// LA / AR / OK / TX
  [800,816,5],[820,831,4],[832,838,5],[840,847,6],[850,853,9],[855,865,8],[870,875,7],
  [877,884,6],[889,891,9],[893,898,6],                                                // CO / WY / ID / UT / AZ / NM / NV
  [900,928,9],[930,961,9],[967,968,11],[970,979,8],[980,986,8],[988,994,6],[995,999,4],// CA / HI / OR / WA / AK
];
function zoneFromZip(zip){
  const digits=String(zip||'').replace(/\D/g,'');
  if (digits.length<3) return null;
  const p=+digits.slice(0,3);
  for (let i=0;i<ZIP_ZONE_BANDS.length;i++){
    const b=ZIP_ZONE_BANDS[i];
    if (p>=b[0] && p<=b[1]) return b[2];
  }
  return null;
}
function mixHex(a,b2,t){
  const pa=parseInt(a.slice(1),16), pb=parseInt(b2.slice(1),16);
  const ch=(sh)=>Math.round(((pa>>sh)&255)*(1-t)+((pb>>sh)&255)*t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/* UX feature flags for retired / optional interactions.
   End Day stays as a deliberate HUD action, but house-door sleep is disabled so
   the house feels like a planning landmark instead of a required daily chore.
   The mobile action button is hidden because drag-to-place made a large
   "Plant here" CTA redundant. The movement hint is hidden because the toolbar
   already carries the current task well enough on small screens. */
const ENABLE_HUD_SLEEP_BUTTON = true;
const ENABLE_HOUSE_SLEEP = false;
const ENABLE_MOBILE_ACT_BUTTON = false;
const ENABLE_ACTION_HINT = false;

/* Season ambience: sky gradient, grass tone, soil tone, light tint */
const AMBIENCE = {
  Spring:{sky:['#8aa4b8','#cfd8c2'], grass:['#7fa05e','#6f8f5a'], soil:'#5b4332', tint:'rgba(190,220,170,0.06)', snow:0},
  Summer:{sky:['#7d93a8','#b8c9a8'], grass:['#6f8f5a','#5d7a4c'], soil:'#54402f', tint:'rgba(255,240,180,0.05)', snow:0},
  Fall:  {sky:['#9a7d6e','#d9b98a'], grass:['#a78a4f','#8f7544'], soil:'#4e3a2b', tint:'rgba(255,170,90,0.08)', snow:0},
  Winter:{sky:['#6e7787','#cdd3d8'], grass:['#9b9484','#857f70'], soil:'#5a5048', tint:'rgba(200,215,235,0.10)', snow:1},
};
const SEASON_LIGHT = {
  Spring:{sun:'rgba(255,235,180,0.20)', haze:'rgba(229,238,210,0.20)', beam:'rgba(255,246,190,0.08)', vignette:'rgba(42,55,42,0.13)'},
  Summer:{sun:'rgba(255,225,135,0.18)', haze:'rgba(210,226,188,0.13)', beam:'rgba(255,240,165,0.10)', vignette:'rgba(32,46,36,0.14)'},
  Fall:  {sun:'rgba(255,184,105,0.23)', haze:'rgba(224,174,112,0.18)', beam:'rgba(255,176,92,0.12)', vignette:'rgba(58,35,28,0.16)'},
  Winter:{sun:'rgba(228,236,246,0.18)', haze:'rgba(231,238,245,0.18)', beam:'rgba(210,228,245,0.08)', vignette:'rgba(35,42,54,0.18)'},
};

const PATH_COLORS = [
  {id:'warm', label:'Warm gravel', fill:'#bba98c', plan:'#dccdaa'},
  {id:'lime', label:'Limestone', fill:'#d0c6ad', plan:'#e5dcc6'},
  {id:'bark', label:'Bark mulch', fill:'#6b4a34', plan:'#b08a68'},
  {id:'slate', label:'Slate', fill:'#7a8386', plan:'#b8c0c2'},
  {id:'clay', label:'Red clay', fill:'#a76543', plan:'#d3a184'},
  {id:'charcoal', label:'Charcoal', fill:'#4c4942', plan:'#8f8a7e'},
];
function pathColor(id){ return PATH_COLORS.find(c=>c.id===id)||PATH_COLORS[0]; }
function pathColorId(id){ return pathColor(id).id; }
function pathFill(t,snow){ const p=pathColor(t&&t.c);
  return snow ? mixHex(p.fill,'#eef2f8',0.42) : p.fill; }
function pathPlanFill(t){ return pathColor(t&&t.c).plan; }
const BED_STYLES = [
  {id:'soil', label:'Soil', fill:null, plan:'#ebe2c9', texture:'soil'},
  {id:'gravel', label:'Gravel', fill:'#a99f86', plan:'#d6ceb8', texture:'gravel'},
  {id:'rock', label:'River rock', short:'Rock', fill:'#87877f', plan:'#c5c5bb', texture:'rock'},
  {id:'leaf', label:'Leaf litter', short:'Leaf', fill:'#6d4d32', plan:'#b88c60', texture:'leaf'},
  {id:'mulch', label:'Bark mulch', short:'Bark', fill:'#5b3526', plan:'#9d7558', texture:'mulch'},
];
function bedStyle(id){ return BED_STYLES.find(c=>c.id===id)||BED_STYLES[0]; }
function bedStyleId(id){ return bedStyle(id).id; }
function bedFill(t,amb){
  const b=bedStyle(t&&t.c), fill=b.fill||amb.soil;
  if (!amb.snow) return fill;
  const snowMix=b.id==='soil' ? 0.76
    : (b.id==='leaf'||b.id==='mulch') ? 0.64
    : 0.52;
  return mixHex(fill,'#eef2f8',snowMix);
}
function bedPlanFill(t){ return bedStyle(t&&t.c).plan; }
const WATER_STYLES = [
  {id:'pond', label:'Pond', fill:'#4f8491', deep:'#2f6578', edge:'#7da7a3', plan:'#9fc8d0'},
  {id:'river', label:'River', fill:'#5d93a8', deep:'#336f8e', edge:'#8ab4b9', plan:'#a9d2df'},
  {id:'lake', label:'Lake', fill:'#426f8d', deep:'#254f72', edge:'#789cae', plan:'#8fb7cf'},
];
function waterStyle(id){ return WATER_STYLES.find(c=>c.id===id)||WATER_STYLES[0]; }
function waterStyleId(id){ return waterStyle(id).id; }
// terrain edge look: crisp tiles for the structured styles, smoothed curves
// for the naturalistic ones. Seeds game.edgeStyle from the questionnaire.
const FORMAL_EDGE_STYLES=['formal','modern','japanese'];
function edgeStyleFromType(type){ return FORMAL_EDGE_STYLES.includes(type)?'formal':'organic'; }
function edgeStyleId(s){ return s==='formal'?'formal':'organic'; }
function waterFill(t,snow){ const w=waterStyle(t&&t.c);
  return snow ? mixHex(w.fill,'#e8f0f5',0.58) : w.fill; }
function waterPlanFill(t){ return waterStyle(t&&t.c).plan; }
const ELEV_TOOLS = ['raise','lower','level'];
function isElevationTool(t){ return ELEV_TOOLS.includes(t); }
const FENCE_STYLES = [
  {id:'black', label:'Black Aluminum', post:'#1e1d1b', rail:'#2f312f', fill:'#151514'},
  {id:'wood', label:'Wood', post:'#7b5636', rail:'#9a7148', fill:'#6a4529'},
  {id:'vinyl', label:'Vinyl', post:'#eee8dc', rail:'#f8f3e8', fill:'#d8d0c2'},
  {id:'chainlink', label:'Chainlink', post:'#68757a', rail:'#aab5b5', fill:'#d5dddd'},
  {id:'brick', label:'Brick', post:'#8f4e3a', rail:'#a85f45', fill:'#6f382d'},
];
const FENCE_HEIGHTS = [4,6];
function fenceStyle(id){ return FENCE_STYLES.find(f=>f.id===id)||FENCE_STYLES[0]; }
function fenceStyleId(id){ return fenceStyle(id).id; }
function normalizeFenceDraft(d){
  d=d||{};
  return {
    style:fenceStyleId(d.style),
    height:FENCE_HEIGHTS.includes(d.height)?d.height:4,
    gate:!!d.gate
  };
}
const LIGHT_TYPES = [
  {id:'path', label:'Path light', short:'Path', h:18, kind:'path'},
  {id:'lantern', label:'Lantern post', short:'Lantern', h:42, kind:'post'},
  {id:'lamp', label:'Outdoor lamp', short:'Lamp', h:30, kind:'lamp'},
];
const LIGHT_TONES = [
  {id:'eco', label:'Eco friendly', short:'Eco', col:'#b9d483', glow:'rgba(190,224,130,'},
  {id:'warm', label:'Warm', short:'Warm', col:'#ffd28a', glow:'rgba(255,194,112,'},
  {id:'bright', label:'Bright', short:'Bright', col:'#f1f7ff', glow:'rgba(218,234,255,'},
];
function lightType(id){ return LIGHT_TYPES.find(l=>l.id===id)||LIGHT_TYPES[0]; }
function lightTone(id){ return LIGHT_TONES.find(l=>l.id===id)||LIGHT_TONES[1]; }
function lightTypeId(id){ return lightType(id).id; }
function lightToneId(id){ return lightTone(id).id; }
function normalizeLightDraft(d){
  d=d||{};
  return {type:lightTypeId(d.type), tone:lightToneId(d.tone)};
}
const FIREPIT_SIZES = [
  {id:'round24', shape:'round', label:'24 in', plan:'24x24', wIn:24, hIn:24},
  {id:'round36', shape:'round', label:'36 in', plan:'36x36', wIn:36, hIn:36},
  {id:'round48', shape:'round', label:'48 in', plan:'48x48', wIn:48, hIn:48},
  {id:'square36', shape:'square', label:'36 sq', plan:'36x36', wIn:36, hIn:36},
  {id:'rect24x48', shape:'square', label:'24x48', plan:'24x48', wIn:48, hIn:24},
];
function firepitSize(id,shape){
  const s=FIREPIT_SIZES.find(f=>f.id===id);
  if (s && (!shape || s.shape===shape)) return s;
  return FIREPIT_SIZES.find(f=>f.shape===(shape||'round'))||FIREPIT_SIZES[1];
}
function normalizeFirepitDraft(d){
  d=d||{};
  const shape=d.shape==='square'?'square':'round';
  const size=firepitSize(d.size,shape);
  return {shape:size.shape, size:size.id};
}
function firepitTileSize(f){
  const s=firepitSize(f&&f.size,f&&f.shape);
  return {
    w:Math.max(1,Math.ceil(s.wIn/TILE_IN)),
    h:Math.max(1,Math.ceil(s.hIn/TILE_IN)),
    spec:s
  };
}

/* The Oudolf palette — PLANTS and PLANT_KEYS — lives in plants.js,
   which index.html loads before this file. */

/* Resolve a species key + optional cultivar into an effective plant def:
   the cultivar's overrides merge over the straight species, per-season
   colors included. Cached — render asks every frame. */
const _defCache={};
function plantDef(key,v){
  const base=PLANTS[key];
  if (!v || !base || !base.cv || !base.cv[v]) return base;
  const ck=key+'|'+v;
  if (_defCache[ck]) return _defCache[ck];
  const c=base.cv[v];
  const d=Object.assign({},base,c,{name:base.name+' '+c.name,sea:{}});
  for (const s of SEASONS) d.sea[s]=Object.assign({},base.sea[s],(c.sea||{})[s]);
  return _defCache[ck]=d;
}
function isShrubDef(P){ return P && P.type==='shrub'; }
function shrubVisualCw(P){
  if (!isShrubDef(P)) return P && P.cw;
  const realWidth=((P.spread||P.space||TILE_IN)/TILE_IN)*TILE_W*0.50;
  return Math.max(P.cw||0, realWidth);
}
function plantKeyOf(p){
  for (const k in game.plants) if (game.plants[k]===p) return k;
  return null;
}

/* coat palettes for cats & dogs */
const COATS = [
  {n:'Marmalade', c:'#d98a4a', d:'#a35a2e'},
  {n:'Charcoal',  c:'#4a4a52', d:'#2e2e34'},
  {n:'Cream',     c:'#e8d9b8', d:'#c2a87e'},
  {n:'Cocoa',     c:'#7a5236', d:'#54371f'},
  {n:'Smoke',     c:'#9a9aa2', d:'#6e6e78'},
  {n:'Birch',     c:'#f0ece2', d:'#c9c2b0'},
];

