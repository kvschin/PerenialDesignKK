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
  SPAWNX=Math.floor(gw/2); SPAWNY=Math.floor(gh/2);
  game.plotShape=null; game.plotRev++; rebuildPlotMask();   // a shape from another plot size is meaningless
}
const TILE_W = 76, TILE_H = 38;
const TILE_IN = 18;                   // real-world inches per tile side (export + plot math)
const ELEV_STEP = 9;                   // pixels per elevation step in the isometric view
const ELEV_MIN = -2, ELEV_MAX = 4;     // first-pass earthwork range: shallow swales to low berms
function ftToTiles(ft){ return Math.max(2, Math.round(ft*12/TILE_IN)); }

/* Approximate USDA hardiness zone from a US ZIP, by 3-digit prefix. Coarse on
   purpose: species use zone RANGES and plant filters are changeable in-game,
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

/* Haptics are an explicit, device-local preference and default off. Feedback
   stays short and gesture-level: one pulse after a completed placement or
   success, never a buzz for every tile in a paint drag. */
const HAPTIC_KEY='hortus:haptics';
let hapticsOn=false, lastHapticAt=0;
try{ hapticsOn=localStorage.getItem(HAPTIC_KEY)==='1'; }catch(_){ }
function supportsHaptics(){
  if (typeof navigator==='undefined' || typeof navigator.vibrate!=='function') return false;
  return (navigator.maxTouchPoints||0)>0 || (typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches);
}
function setHapticsEnabled(on){
  hapticsOn=!!on && supportsHaptics();
  try{ localStorage.setItem(HAPTIC_KEY,hapticsOn?'1':'0'); }catch(_){ }
  return hapticsOn;
}
function hapticFeedback(kind){
  if (!hapticsOn || !supportsHaptics()) return;
  const now=Date.now(), gap=kind==='invalid'?240:70;
  if (now-lastHapticAt<gap) return;
  lastHapticAt=now;
  const pattern=kind==='invalid' ? [8,28,8] : kind==='success' ? 16 : 8;
  try{ navigator.vibrate(pattern); }catch(_){ }
}

/* The mobile rail side is a device preference, not garden data. Apply the
   class while scripts load so opening the HUD never flashes on the wrong side. */
const LEFT_HANDED_KEY='hortus:leftHanded';
let leftHandedLayout=false;
try{ leftHandedLayout=localStorage.getItem(LEFT_HANDED_KEY)==='1'; }catch(_){ }
function applyLeftHandedLayout(animate){
  if (typeof document==='undefined'||!document.body) return;
  document.body.classList.toggle('left-handed-layout',leftHandedLayout);
  if (animate){
    document.body.classList.add('handedness-changing');
    setTimeout(()=>document.body&&document.body.classList.remove('handedness-changing'),220);
  }
  if (typeof globalThis!=='undefined' && globalThis.__compassReady && typeof invalidateCompass==='function') invalidateCompass();
}
function setLeftHandedLayout(on,animate=true){
  leftHandedLayout=!!on;
  try{ localStorage.setItem(LEFT_HANDED_KEY,leftHandedLayout?'1':'0'); }catch(_){ }
  applyLeftHandedLayout(animate);
  return leftHandedLayout;
}
applyLeftHandedLayout(false);

/* ---------- Theme (device preference, like haptics and the rail side) ----------
   'auto' follows the OS; 'light'/'dark' pin it. Only the CHROME themes — the
   garden keeps its seasonal AMBIENCE palette in both, because a meadow at
   midday is not "dark mode". An inline bootstrap in index.html stamps the
   resolved value on <html> before first paint so there is no flash; this code
   owns it from then on, including following the OS while set to 'auto'. */
const THEME_KEY='hortus:theme';
const THEME_CHOICES=['auto','light','dark'];
let themePref='auto';
try{ const v=localStorage.getItem(THEME_KEY); if (THEME_CHOICES.includes(v)) themePref=v; }catch(_){ }
function systemPrefersLight(){
  return typeof matchMedia==='function' && matchMedia('(prefers-color-scheme: light)').matches;
}
function resolvedTheme(pref=themePref){
  return pref==='auto' ? (systemPrefersLight()?'light':'dark') : pref;
}
/* Canvas icons cannot resolve CSS variables, so they read the resolved colours
   through here. Cached because icon builders call it many times per rebuild;
   the cache is dropped whenever the theme changes. */
let uiInkCache=null;
function uiInk(name){
  if (!uiInkCache){
    uiInkCache={};
    if (typeof getComputedStyle==='function' && typeof document!=='undefined' && document.documentElement){
      const cs=getComputedStyle(document.documentElement);
      ['--icon-ink','--icon-ink-soft','--icon-ink-dim','--icon-warm','--icon-halo'].forEach(k=>{
        const v=(cs.getPropertyValue(k)||'').trim(); if (v) uiInkCache[k]=v;
      });
    }
  }
  // Fall back to the dark values so a headless/stubbed DOM still draws.
  const fallback={'--icon-ink':'#efe6d3','--icon-ink-soft':'#d8c7ac','--icon-ink-dim':'#7d7164',
    '--icon-warm':'#c9a07f','--icon-halo':'rgba(20,14,11,0.75)'};
  return uiInkCache[name]||fallback[name]||'#efe6d3';
}
function applyTheme(){
  if (typeof document==='undefined'||!document.documentElement) return resolvedTheme();
  const t=resolvedTheme();
  document.documentElement.setAttribute('data-theme',t);
  uiInkCache=null;
  // Sprite/ground caches key off season and zoom, not theme, so only the DOM
  // chrome and the canvas-drawn ICONS need rebuilding.
  if (typeof refreshCanvasTools==='function') refreshCanvasTools();
  if (typeof buildToolTray==='function' && typeof game!=='undefined' && game.mode) buildToolTray();
  if (typeof syncTopTools==='function') syncTopTools();
  if (typeof drawSheetSwatch==='function') drawSheetSwatch();
  return t;
}
function setThemePref(pref){
  themePref=THEME_CHOICES.includes(pref)?pref:'auto';
  try{ localStorage.setItem(THEME_KEY,themePref); }catch(_){ }
  return applyTheme();
}
function cycleThemePref(){ return setThemePref(THEME_CHOICES[(THEME_CHOICES.indexOf(themePref)+1)%THEME_CHOICES.length]); }
function themeLabel(){ return themePref==='auto'?`Auto (${resolvedTheme()})`:themePref==='light'?'Light':'Dark'; }
if (typeof matchMedia==='function'){
  const mq=matchMedia('(prefers-color-scheme: light)');
  const onChange=()=>{ if (themePref==='auto') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change',onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

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

/* Ground materials carry their own GRAIN PALETTE, next to their base colour,
   because a material's colour is data — `drawGroundTexture` reads these and
   hardcodes none of them. `texture` names the grain recipe (the shape of the
   stuff: angular chip, rounded cobble, shred, leaf…) and `tones` are the grain
   colours painted over the base, listed dark-to-light.
   The tones are what stopped every material reading as the same speckle: a
   real aggregate varies in HUE, not just in value, and `shade()` — which adds
   a constant to r/g/b — cannot produce that. Warm gravel really is buff stone
   with grey and rust in it; limestone screenings really are one pale tone.
   `null` tones mean "derive from the tile's own base" and are for materials
   whose base is seasonal (soil follows AMBIENCE). */
const PATH_COLORS = [
  {id:'warm', label:'Warm gravel', fill:'#bba98c', plan:'#dccdaa',
   texture:'gravel', tones:['#8a7a5d','#ae9d80','#c4b596','#9a8765']},
  {id:'lime', label:'Limestone', fill:'#d0c6ad', plan:'#e5dcc6',
   texture:'fines', tones:['#aba189','#c3b99f','#ded5bd','#b9ad92']},
  {id:'bark', label:'Bark mulch', fill:'#6b4a34', plan:'#b08a68',
   texture:'mulch', tones:['#4a3122','#7a5539','#96775a','#61402a']},
  {id:'slate', label:'Slate', fill:'#7a8386', plan:'#b8c0c2',
   texture:'flag', tones:['#5c6567','#7f888a','#98a1a2','#6d7678']},
  {id:'clay', label:'Red clay', fill:'#a76543', plan:'#d3a184',
   texture:'clay', tones:['#8a4f33','#b2704c','#c48a63','#96593a']},
  {id:'charcoal', label:'Charcoal', fill:'#4c4942', plan:'#8f8a7e',
   texture:'gravel', tones:['#35332e','#5a574f','#726e64','#454239']},
  /* Laid units. `unit` is the paver size in INCHES and the recipe lays them in
     running bond; `fill` is the MORTAR, because the joint is the base showing
     between units, so it stays a shade that still reads as paving from the
     world thumbnail. */
  {id:'brick', label:'Brick', fill:'#7a5a4e', plan:'#c98d72',
   texture:'brick', unit:[8,4], tones:['#8a4633','#a85f45','#bd7358','#94503a']},
  {id:'paver', label:'Concrete paver', short:'Paver', fill:'#7e7b74', plan:'#c7c4bc',
   texture:'brick', unit:[16,16], tones:['#918e86','#a5a29a','#b5b2aa','#8a877f']},
  // Slate covers the cool greys; a warm flagstone is a different design choice,
  // not a tint of the same one.
  {id:'sandstone', label:'Sandstone', fill:'#a58e6a', plan:'#dcc7a4',
   texture:'flag', tones:['#8a7150','#b89c74','#cbb189','#a3855c']},
];
function pathColor(id){ return PATH_COLORS.find(c=>c.id===id)||PATH_COLORS[0]; }
function pathColorId(id){ return pathColor(id).id; }
function pathFill(t,snow){ const p=pathColor(t&&t.c);
  return snow ? mixHex(p.fill,'#eef2f8',0.42) : p.fill; }
function pathPlanFill(t){ return pathColor(t&&t.c).plan; }
const BED_STYLES = [
  // soil follows the season (fill:null -> AMBIENCE.soil), so its grains are
  // derived from whatever that is rather than pinned to one brown
  {id:'soil', label:'Soil', fill:null, plan:'#ebe2c9', texture:'soil', tones:null},
  {id:'gravel', label:'Gravel', fill:'#a99f86', plan:'#d6ceb8', texture:'gravel',
   tones:['#7d7461','#a89d84','#bdb296','#93856c']},
  // A river bar is grey AND tan AND rust, never one grey — the fourth tone is
  // doing real work here, and the light one stays close to the body tone
  // because where two pale cobbles overlap they merge into one pale blob.
  {id:'rock', label:'River rock', short:'Rock', fill:'#87877f', plan:'#c5c5bb', texture:'rock',
   tones:['#4e4e4a','#82827a','#97968a','#8a7a63']},
  {id:'leaf', label:'Leaf litter', short:'Leaf', fill:'#6d4d32', plan:'#b88c60', texture:'leaf',
   tones:['#4a3524','#7d5836','#96784c','#66502f']},
  {id:'mulch', label:'Bark mulch', short:'Bark', fill:'#5b3526', plan:'#9d7558', texture:'mulch',
   tones:['#3a2016','#6d4028','#8a6446','#4e2c1d']},
  // The default bed mulch across the whole Southeast, and nothing else in the
  // list looks remotely like it — long rusty needles rather than chips.
  {id:'pine', label:'Pine straw', short:'Pine', fill:'#5e3c22', plan:'#c9a173', texture:'needle',
   tones:['#8a5a30','#a8703c','#c39257','#7a4a26']},
  // The size between crushed gravel and river cobble, and the one most people
  // actually mean by "gravel" in a bed or a patio.
  {id:'pea', label:'Pea gravel', short:'Pea', fill:'#6f6a5c', plan:'#d4cfc0', texture:'pebble',
   tones:['#9c9482','#bdb5a0','#cfc8b4','#a08a68']},
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
/* Which material is laid ON which, when two of them meet. A path is laid over a
   bed — you cut a path THROUGH planting, the bed does not stop and restart — so
   a path outranks a bed, and a bed outranks the water it runs down to.
   The organic renderer needs this because smoothing a boundary means pulling
   the edge in off the tile line, and if BOTH sides do that a sliver of lawn
   opens between them. Only one side has to stay exact, though: rank decides
   which, the higher rank is painted last, and its curve lands on the other's
   fill rather than on grass. Materials of equal rank (two bed styles, two path
   colours) both stay exact and butt, which is what they should do. */
const TERRAIN_RANK = { water:0, bed:1, path:2 };
function terrainRank(kind){ const r=TERRAIN_RANK[kind]; return r===undefined?1:r; }
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
const BOULDER_TYPES = [
  {id:'round1',   label:'Round Boulder',       short:'Round',      shape:'round',  plan:'1x1', w:1, h:1, tone:'#808276'},
  {id:'small1',   label:'Small Boulder',       short:'Small 1x1',  shape:'round',  plan:'1x1', w:1, h:1, tone:'#77796e'},
  {id:'small2',   label:'Small Boulder',       short:'Small 2x2',  shape:'round',  plan:'2x2', w:2, h:2, tone:'#86867b'},
  {id:'medium2',  label:'Medium Boulder',      short:'Medium',     shape:'round',  plan:'2x2', w:2, h:2, tone:'#7d8178'},
  {id:'large32',  label:'Large Boulder',       short:'Large 3x2',  shape:'round',  plan:'3x2', w:3, h:2, tone:'#87877e'},
  {id:'large3',   label:'Large Boulder',       short:'Large 3x3',  shape:'round',  plan:'3x3', w:3, h:3, tone:'#777b72'},
  {id:'oblong21', label:'Oblong Boulder',      short:'Oblong 2x1', shape:'oblong', plan:'2x1', w:2, h:1, tone:'#827d72'},
  {id:'oblong31', label:'Long Oblong Boulder', short:'Oblong 3x1', shape:'oblong', plan:'3x1', w:3, h:1, tone:'#797b73'},
  {id:'rect32',   label:'Rectangular Boulder', short:'Rect 3x2',   shape:'rect',   plan:'3x2', w:3, h:2, tone:'#7f7a70'},
];
function boulderType(id){ return BOULDER_TYPES.find(b=>b.id===id)||BOULDER_TYPES[0]; }
function boulderTypeId(id){ return boulderType(id).id; }
function normalizeBoulderDraft(d){ d=d||{}; return {type:boulderTypeId(d.type)}; }
function boulderTileSize(b){
  const spec=boulderType(b&&b.type);
  return {w:Math.max(1,spec.w||1), h:Math.max(1,spec.h||1), spec};
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
  if (base.flowerColorFamilies || c.flowerColorFamilies){
    d.flowerColorFamilies={};
    for (const s of SEASONS) d.flowerColorFamilies[s]=Object.assign({},base.flowerColorFamilies||{},c.flowerColorFamilies||{})[s];
  }
  return _defCache[ck]=d;
}
function isShrubDef(P){ return P && P.type==='shrub'; }
function isTreeDef(P){ return P && P.type==='tree'; }
function isWoodyDef(P){ return isShrubDef(P) || isTreeDef(P); }
/* Woody spread is truth data (inches); h/cw are drawing hints. Keep the
   spread->tile radius conversion here so shade, shrub footprints, plan marks,
   and cards cannot drift into slightly different ideas of plant size. */
function woodyRadiusTiles(P){
  if (!isWoodyDef(P)) return 0;
  const minRadius=isShrubDef(P) ? 0.45 : 0;
  return Math.max(minRadius, ((P.spread||P.space||TILE_IN)/TILE_IN)/2);
}
function woodyVisualCw(P){
  if (!P) return undefined;
  if (!isWoodyDef(P)) return P.cw;
  if (isTreeDef(P)){
    /* T10 compression curve: trees drew ~24x smaller than reality (white oak
       cw:160px vs 3800px of true 75ft crown) while perennials sit near 1:1.
       Blend the art cw toward true screen width in log space — small trees
       land near real size, giants compress to ~16% of real (oak ~605px) so
       one oak reads as a TREE without swallowing the plot. The species' cw
       stays the shape signal, so narrow cultivars stay narrow. */
    const cw=P.cw||100, realPx=woodyRadiusTiles(P)*2*TILE_W;
    if (realPx<=cw) return cw;
    return Math.round(Math.min(realPx, Math.exp(Math.log(cw)*0.58 + Math.log(realPx)*0.42)));
  }
  return Math.max(P.cw||0, woodyRadiusTiles(P)*TILE_W);
}
/* HERB_SCALE (H1): herbaceous plants were drawn at ~half the on-screen scale
   of shrubs — a mature drift at correct spacing showed ~65% bare ground and
   read as scattered sprigs, not a mass. Every herbaceous form derives its
   whole geometry from the drawn height H, so ONE height factor at this seam
   scales width and height together and preserves each species' hand-drawn
   proportions. Bulbs already read closed (~0.85 of spacing) so they opt out.
   Tuned by measuring drawn-width ÷ spacing across all species. */
const HERB_SCALE = 1.75;
/* plantVisualH — the universal drawn-height display transform (data P.h is
   untouched). Trees/shrubs: scale h by the same factor woodyVisualCw applied
   to cw, so the intended h:cw aspect survives (T2 widened shrub bodies toward
   true spread but left height at art px — a low yew drew six times wider than
   tall). Herbaceous (grass/sedge/forb/water): × HERB_SCALE. Bulbs: unchanged. */
function plantVisualH(P){
  if (!P) return undefined;
  if (isWoodyDef(P)) return Math.round((P.h||80) * (woodyVisualCw(P)/(P.cw||P.h||80)));
  if (P.type==='bulb') return P.h;
  return Math.round((P.h||36) * HERB_SCALE);
}
/* Some plants carry a flower scape well above the foliage mass.  Keep this
   display-only extent separate from `h`: the renderer still uses h for the
   plant's basic geometry while icons and sprite bounds reserve enough room
   for the full silhouette. */
function plantArtTop(P){
  const H=plantVisualH(P)||40, L=P&&P.look||{};
  return Math.round(H*Math.max(1,L.topScale||1));
}
/* Grass forms derive their width from H. Counter that coupling for cultivars
   so a taller selection can stay narrow and a shorter one can still be broad.
   Straight species retain their hand-tuned form silhouette. */
function plantVisualWidthScale(P,key){
  const base=key&&PLANTS[key];
  if (!P || P.type!=='grass' || !base || !P.h || !base.h || !P.spread || !base.spread) return 1;
  return (P.spread/base.spread) * (base.h/P.h);
}
// back-compat alias: this used to be woody-only; it now covers every plant.
function woodyVisualH(P){ return plantVisualH(P); }
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

