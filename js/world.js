'use strict';
/* ---------- world / state ---------- */
const DEFAULT_LAYER_VIS = Object.freeze({
  perennials:true,
  bulbs:true,
  woody:true,
  landscape:true,
  shade:false,
  moisture:false,
  height:false,
  matureCanopies:false,
  edgeRulers:false,
  night:false,
});
function defaultLayerVis(){ return Object.assign({}, DEFAULT_LAYER_VIS); }
function normalizeLayerVis(vis){
  const out=defaultLayerVis();
  if (vis && typeof vis==='object'){
    Object.keys(DEFAULT_LAYER_VIS).forEach(k=>{
      if (vis[k]!==undefined) out[k]=!!vis[k];
    });
  }
  return out;
}
function normalizeSiteNorthDeg(value){
  const n=Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(((n%360)+360)%360)%360;
}
const UNDERLAY_DATA_LIMIT=950000;
function normalizeUnderlay(raw){
  if (!raw || typeof raw!=='object') return null;
  const data=typeof raw.data==='string'?raw.data:'';
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(data) || data.length>UNDERLAY_DATA_LIMIT) return null;
  const sourceW=Math.round(+raw.pixelW||0), sourceH=Math.round(+raw.pixelH||0);
  if (sourceW<1||sourceH<1) return null;
  const pixelW=Math.min(4096,sourceW), pixelH=Math.min(4096,sourceH);
  return {
    v:1,
    data,
    pixelW,
    pixelH,
    cx:Number.isFinite(+raw.cx)?+raw.cx:GW/2,
    cy:Number.isFinite(+raw.cy)?+raw.cy:GH/2,
    widthTiles:Math.max(0.5,Math.min(Math.max(GW,GH)*8,+raw.widthTiles||Math.min(GW,pixelW/pixelH*GH))),
    rotation:Math.max(-180,Math.min(180,+raw.rotation||0)),
    opacity:Math.max(0.1,Math.min(0.85,+raw.opacity||0.35)),
    visible:raw.visible!==false,
    locked:raw.locked!==false,
  };
}
function underlaySize(u=game.underlay){
  if (!u) return {w:0,h:0};
  const w=Math.max(0.5,+u.widthTiles||1);
  return {w,h:w*(Math.max(1,+u.pixelH||1)/Math.max(1,+u.pixelW||1))};
}
function underlayContainsWorldPoint(u,p){
  if (!u||!p) return false;
  const {w,h}=underlaySize(u), rad=(+u.rotation||0)*Math.PI/180;
  const dx=p[0]-u.cx, dy=p[1]-u.cy;
  const lx=dx*Math.cos(rad)+dy*Math.sin(rad), ly=-dx*Math.sin(rad)+dy*Math.cos(rad);
  return Math.abs(lx)<=w/2+0.001 && Math.abs(ly)<=h/2+0.001;
}
// Scale the reference from a real-world distance while keeping the first
// calibration point anchored to the same garden position.
function calibrateUnderlayDistance(u,a,b,knownFt){
  const measured=a&&b?Math.hypot(b[0]-a[0],b[1]-a[1]):0;
  const feet=+knownFt, oldWidth=u&&+u.widthTiles;
  if (!u||!Number.isFinite(measured)||measured<0.001||!Number.isFinite(feet)||feet<=0||!oldWidth) return null;
  const desiredTiles=feet*12/TILE_IN, rawScale=desiredTiles/measured;
  const widthTiles=Math.max(0.5,Math.min(Math.max(GW,GH)*8,oldWidth*rawScale));
  const scale=widthTiles/oldWidth;
  return normalizeUnderlay(Object.assign({},u,{widthTiles,
    cx:a[0]+(u.cx-a[0])*scale,cy:a[1]+(u.cy-a[1])*scale}));
}
function markUnderlayChanged(){ game.dirty=true; }
function tileAreaSqFt(n){ return Math.max(0,+n||0)*TILE_IN*TILE_IN/144; }
function mulchYards(areaSqFt,depthIn){ return Math.max(0,+areaSqFt||0)*(Math.max(0,+depthIn||0)/12)/27; }
function plantsForTiles(n,spaceIn){
  const cells=Math.max(0,+n||0), spacing=Math.max(1,+spaceIn||TILE_IN);
  return Math.ceil(cells*TILE_IN*TILE_IN/(spacing*spacing));
}
function materialPerimeterFt(keys){
  const set=keys instanceof Set?keys:new Set(keys||[]); let edges=0;
  set.forEach(k=>{ const [x,y]=k.split(',').map(Number);
    if (!set.has(`${x-1},${y}`)) edges++;
    if (!set.has(`${x+1},${y}`)) edges++;
    if (!set.has(`${x},${y-1}`)) edges++;
    if (!set.has(`${x},${y+1}`)) edges++;
  });
  return edges*TILE_IN/12;
}
function persistLayerVis(){
  game.dirty=true;
  if (game.mode==='solo' && hasStorage && typeof saveSolo==='function') saveSolo(true);
}
function setLayerVis(key,val,autosave){
  if (!game.layerVis) game.layerVis=defaultLayerVis();
  const next=!!val;
  if (game.layerVis[key]===next) return false;
  game.layerVis[key]=next;
  if (autosave!==false) persistLayerVis();
  return true;
}
const game = {
  mode:null, code:null, playerId:null,
  char:{species:'cat', coatIdx:0, coat:COATS[0].c, coatD:COATS[0].d, mark:'solid', name:''},
  plants:{},          // "x,y" -> {s:key, d:absDayPlanted, t:ts} or {removed:true,t}
  bulbs:{},           // same shape — the layer under the plants
  terrain:{},         // "x,y" -> {k:'path'|'bed'|'water', t:ts} or {removed:true,t}
  elevation:{},       // "x,y" -> {h:-2..4, t:ts} or {removed:true,t}
  fences:{},          // "x,y" -> {style,height,gate,t} or {removed:true,t}
  lights:{},          // "x,y" -> {type,tone,t} or {removed:true,t}
  firepits:{},        // "x,y" origin -> {shape,size,t} or {removed:true,t}
  boulders:{},        // "x,y" origin -> {type,t} or {removed:true,t}
  startTs:Date.now(), elapsedMs:0, dayOffset:0, clockSuspended:false,
  px:15, py:15, tx:15, ty:15, moving:false, moveT:0, fromX:15, fromY:15,
  moveDur:170, pathTarget:null, sleepOnArrive:false,
  house:null, houseT:0,                              // per-garden house + sync stamp
  rot:0,                                             // view rotation, 90-degree steps
  siteNorthDeg:0,                                    // true north, degrees clockwise from plot-up; independent of view
  siteNorthPreviewDeg:null,                          // transient dialog preview; never persisted
  plotShape:null,                                    // optional lot-boundary polygon (tile-corner coords); null = full GWxGH rectangle
  hoverTile:null,                                    // pointer/armed tile for placement ghosts
  focusPlantKey:null,                                // plant card focus, used for shrub footprint outlines
  worldId:null, worldName:'My garden',               // current solo save slot
  gameMode:'story',                                  // 'story' (avatar) | 'design' (direct)
  visiting:false,                                    // Visit Gardens: read-only avatar stroll of a loaded garden
  design:null,                                       // design-garden answers {zone,type,nativesOnly,deer,rabbit,squirrel}
  drift:false,                                       // plant in clusters, Oudolf style
  matrix:false,                                      // scatter at real spacing across a painted region (flows around what's there)
  woodyAge:'new',                                    // age trees/shrubs plant at: new | young | mature (design defaults mature)
  freePlanting:false,                                // herbaceous plants can sit off the tile center
  edgeStyle:'organic',                               // terrain edge look: organic (smoothed) | formal (crisp tiles)
  eraseMode:'all',                                   // erase: all | plant | bulb | terrain
  brushSize:1,                                       // shared paint/erase brush diameter in tiles (BRUSH_SIZES)
  fx:[],                                             // short-lived planting pulses
  tool:'hand', toolVar:null,                         // active canvas tool or species + optional cultivar
  lastBrushTool:null, lastBrushVar:null,             // last placement brush chosen from the catalog
  lastBrushTrayCat:'grasses', lastBrushDrill:null, trayScroll:{}, // where the brush catalog was last browsed
  toolMenu:null,                                     // open flyout on the left canvas toolbar
  catMenuOpen:false,                                 // mobile category dropdown in the bottom sheet
  sheetState:'half',                                 // mobile palette: collapsed | half | full
  sheetCollapsed:false,                              // legacy alias kept in sync with sheetState
  previewMode:'today',                               // design view: today | established (visual only)
  layerVis:defaultLayerVis(),                         // layer view: visibility + overlays
  layerFocus:'all',                                  // active editable layer: all|perennials|bulbs|woody|landscape
  ruler:null,                                        // tape measure {a:[x,y], b:[x,y]|null}
  underlay:null,                                     // optional calibrated site-photo reference; never part of undo layers
  photoEditing:false,                                // transient editor gesture mode; never persisted
  underlayCalibration:null,                          // transient two-point calibration; never persisted
  sel:null,                                          // committed selection rect {x0,y0,x1,y1} (world tiles, inclusive)
  selItems:null,                                     // payload the selection owns (snapshotted at marquee time)
  selMode:'move',                                    // selection drag intent: 'move' | 'copy'
  fillMode:false,                                    // bucket-fill: tap floods a connected same-material region
  shrubFx:[],                                        // short-lived footprint pulses when shrubs block placement
  houses:[],                                         // placed houses (multiple allowed); each {x,y,w,h,wall,roof,sizeFt}
  buildings:[],                                      // design-site footprints: {id,vertices,status,label,wall,roof,t}; independent of story houses
  schemes:[],                                        // planting schemes over one site plan: [{id,name,t,plants,bulbs}] (see SCHEME_LAYERS)
  schemeActive:null,                                 // id of the scheme whose maps are live in game.plants/game.bulbs
  houseDraft:null,                                   // settings for the next house the House tool places
  buildingDraft:null,                                // unfinished footprint only; never persisted
  buildingStyleDraft:{status:'existing',label:'House',wall:'#8a7a60',roof:'#9a5f3a'},
  fenceDraft:{style:'black',height:4,gate:false},    // settings for the next fence/gate tile
  lightDraft:{type:'path',tone:'warm'},               // settings for the next lighting tile
  firepitDraft:{shape:'round',size:'round36'},        // settings for the next fire pit footprint
  boulderDraft:{type:'round1'},                        // settings for the next boulder footprint
  buildingsT:0,                                         // last shared footprint revision
  pathColor:'warm',                                  // selected path swatch for new/repainted paths
  bedStyle:'soil',                                   // selected bed material for new/repainted beds
  waterStyle:'pond',                                 // selected water swatch for ponds/rivers/lakes
  trayCat:'grasses',                                 // active tool-tray category
  filters:{zone:null, nativesOnly:false, deer:false, rabbit:false, squirrel:false}, // palette filters, persisted
  // Garden rules above stay separate from these reversible catalog lenses.
  // `source` is recommended | all | favorites | palette; a palette id only
  // matters when source==='palette'.  The rest restores per-garden browsing
  // context without ever changing what is legal to plant in that garden.
  discovery:{source:'recommended', collectionId:null, category:null, returnCategory:null, query:'', colorFamilies:[], bloomSeasons:[], limit:36, filterOpen:false},
  others:{},          // multiplayer presence
  pausedAt:0,
  lastDay:-1, dirty:false,
  rev:0,              // edit revision — bumped by every model mutation (see setTile/clearTile); undo watches it
  groundRev:0,         // ground render cache revision: terrain, elevation, houses, or plot-size state changed
  terrainRev:0,        // organic terrain-region cache revision: terrain map changed
  plotRev:0,           // plot-shape mask revision: bumped by setPlotShape/setWorldSize; onPlot mask rebuilds on change
};
// The mutable layers a garden is made of, enumerated once so undo, save/load,
// and multiplayer sync iterate this list instead of hand-listing every layer in
// six different places (a missed entry was a recurring bug — see the reverted
// `game.stock`). `array` marks the house/building lists (the rest are "x,y" maps);
// `sync` flushes that layer to the shared world in multiplayer. The sync refs
// are arrows so they resolve at call time — the functions live in io.js, which
// loads after this file. `GAME_MAPS` is the keyed subset that load shifts.
const GAME_LAYERS=[
  {k:'plants',    sync:()=>syncPlantsOut()},
  {k:'bulbs',     sync:()=>syncBulbsOut()},
  {k:'terrain',   sync:()=>syncTerrainOut()},
  {k:'elevation', sync:()=>syncElevationOut()},
  {k:'fences',    sync:()=>syncFencesOut()},
  {k:'lights',    sync:()=>syncLightsOut()},
  {k:'firepits',  sync:()=>syncFirepitsOut()},
  {k:'boulders',  sync:()=>syncBouldersOut()},
  {k:'houses', array:true, sync:()=>pushHouse()},
  {k:'buildings', array:true, sync:()=>pushBuildings()},
];
const GAME_MAPS=GAME_LAYERS.filter(L=>!L.array);
/* ---------- planting schemes: several plantings over one site plan ----------
   A scheme owns only SCHEME_LAYERS.  Every other layer in GAME_LAYERS is the
   shared site plan, so switching schemes leaves terrain/elevation/hardscape/
   houses untouched — which is what keeps a switch cheap: the ground bake and
   terrainLoopCache stay valid, and sceneStale() catches the swap by map
   identity, so a switch costs exactly one buildScene().  That is also why
   terrain is deliberately NOT per-scheme: it would invalidate the two most
   expensive caches in the renderer on every comparison.

   ONE invariant, mirrored in the save blob: the ACTIVE scheme's maps live in
   game.plants/game.bulbs and NEVER in its list entry (which holds null).
   stashActiveScheme() is the only thing that copies them back.  Runtime always
   holds at least one scheme; storage omits the key entirely below two, so
   single-scheme gardens save exactly as they always have. */
const SCHEME_LAYERS=['plants','bulbs'];
const MAX_SCHEMES=6;
function newSchemeId(){ return 'sc'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36); }
function schemeList(){ return Array.isArray(game.schemes)?game.schemes:(game.schemes=[]); }
function schemeCount(){ return schemeList().length; }
function multiScheme(){ return schemeCount()>1; }
function activeSchemeIndex(){ return schemeList().findIndex(s=>s.id===game.schemeActive); }
function activeScheme(){ const i=activeSchemeIndex(); return i<0?null:game.schemes[i]; }
function schemeById(id){ return schemeList().find(s=>s.id===id)||null; }
function activeSchemeName(){ const s=activeScheme(); return s?s.name:'Planting 1'; }
// lowest unused "Planting N", so deleting the middle one doesn't leave a gap
function nextSchemeName(){
  const used=new Set(schemeList().map(s=>s.name));
  for (let n=1;;n++){ const nm='Planting '+n; if (!used.has(nm)) return nm; }
}
function ensureSchemes(){
  const list=schemeList();
  if (!list.length){
    list.push({id:newSchemeId(), name:'Planting 1', t:Date.now(), plants:null, bulbs:null});
    game.schemeActive=list[0].id;
  }
  // the active entry must exist and must not hold maps (they're live in game.*)
  const act=schemeById(game.schemeActive) ? game.schemeActive : (game.schemeActive=list[0].id, list[0].id);
  const s=schemeById(act); if (s) for (const k of SCHEME_LAYERS) s[k]=null;
}
// Copy the live maps into the active scheme's entry. The ONLY writer of a
// scheme's stored maps — everything else in the app reads game.plants/bulbs.
function stashActiveScheme(){
  const s=activeScheme(); if (!s) return;
  for (const k of SCHEME_LAYERS) s[k]=game[k];
}
/* Switch schemes. Deliberately does NOT markGroundChanged(): shared layers did
   not move, so the ground bake and terrain region trace stay valid. */
function activateScheme(id){
  const next=schemeById(id);
  if (!next || id===game.schemeActive) return false;
  stashActiveScheme();
  game.schemeActive=id;
  for (const k of SCHEME_LAYERS){ game[k]=next[k]||{}; next[k]=null; }
  markModelChanged();
  return true;
}
// Single write paths for the layer maps, so the bookkeeping every edit needs —
// mark dirty for the renderer + bump the edit revision undo watches — can't be
// forgotten at a call site. Ground-cache revisions are narrower than game.rev:
// planting should not rebake terrain, but terrain/elevation/houses should.
// setTile stores a value; clearTile writes the {removed} tombstone the
// erase/sync/merge paths expect. (Multiplayer sync still flushes at gesture
// end via the existing syncToolLayer/endSweep paths.)
function markModelChanged(){ game.dirty=true; game.rev++; }
function markGroundChanged(opts){
  game.groundRev++;
  if (opts && opts.terrain) game.terrainRev++;
}
function markLayerCacheChanged(layer){
  // elevation splits organic terrain regions (a raised bed is its own terrace
  // blob), so elevation edits retrace the region cache along with terrain edits
  if (layer==='terrain' || layer==='elevation') markGroundChanged({terrain:true});
  else if (layer==='houses') markGroundChanged();
}
function setTile(layer,key,val){ game[layer][key]=val; markModelChanged(); markLayerCacheChanged(layer); }
function clearTile(layer,key){ game[layer][key]={removed:true,t:Date.now()}; markModelChanged(); markLayerCacheChanged(layer); }
function addHouse(h){ game.houses.push(h); markModelChanged(); markLayerCacheChanged('houses'); }
function removeHouseAtIndex(i){
  if (i<0 || i>=game.houses.length) return false;
  game.houses.splice(i,1); markModelChanged(); markLayerCacheChanged('houses');
  return true;
}
function addBuilding(b){ game.buildings.push(b); markModelChanged(); }
function removeBuildingAtIndex(i){
  if (i<0 || i>=game.buildings.length) return false;
  game.buildings.splice(i,1); markModelChanged(); return true;
}
/* Solo saves persist to localStorage now that the game runs standalone.
   sGet/sSet keep their old async signatures so callers are unchanged.
   `shared` keys land in the same localStorage, so shared gardens only
   sync between tabs on this device until a real backend exists. */
const hasStorage = (()=>{ try{ localStorage.setItem('hortus:probe','1');
  localStorage.removeItem('hortus:probe'); return true; }catch(e){ return false; } })();

function clockActive(){ return !!(game.mode && !game.pausedAt && !game.clockSuspended); }
function elapsedGameMs(){
  const base=game.elapsedMs||0;
  return base + (clockActive() ? Math.max(0, Date.now()-game.startTs) : 0);
}
function saveStartTs(){ return Date.now()-elapsedGameMs(); } // legacy field; elapsedMs is authoritative now
function absDay(){ return Math.floor(elapsedGameMs()/DAY_MS) + game.dayOffset; }
function calClock(){
  const ms=elapsedGameMs(), d=absDay(), year=Math.floor(d/(DAYS_PER_SEASON*4))+1;
  const sIdx=Math.floor(d/DAYS_PER_SEASON)%4;
  return {day:d%DAYS_PER_SEASON+1, season:SEASONS[sIdx], year,
          frac:(ms%DAY_MS)/DAY_MS};
}
/* ---------- phenology: how perennials actually behave ----------
   A plant's drawn size = establishment x seasonal envelope.

   Establishment counts only growing days (winter doesn't tick), so a
   plant put in the ground in January sits as a nub until spring.

   The envelope is the perennial year: everything is cut back to the
   crown when spring arrives, regrows on its own schedule (cool-season
   plants first, warm-season prairie grasses last), stands full through
   fall, and holds as dead structure all winter — the Oudolf point. */
const YEAR_DAYS = DAYS_PER_SEASON*4;
const PHEN = { cool:{w:0,f:14}, mid:{w:4,f:24}, warm:{w:7,f:28} }; // wake/full, in days into the year
function winterDaysBefore(d){ // winter days in [0,d); works for negative d
  const y=Math.floor(d/YEAR_DAYS), r=d-y*YEAR_DAYS;
  return y*DAYS_PER_SEASON + Math.max(0, r-(YEAR_DAYS-DAYS_PER_SEASON));
}
function growingDays(d0,d1){
  return (d1-d0)-(winterDaysBefore(d1)-winterDaysBefore(d0));
}
function plantEstab(p){ // perennials: 10 growing days; woody: grow years
  const P=PLANTS[p.s]||{};
  const horizon=P.grow ? P.grow*(YEAR_DAYS-DAYS_PER_SEASON) : 10;
  return Math.max(0, Math.min(1, growingDays(p.d, absDay())/horizon));
}
function seasonEnvelope(key){
  const ydf=(((absDay()%YEAR_DAYS)+YEAR_DAYS)%YEAR_DAYS)+calClock().frac;
  if (ydf>=YEAR_DAYS-DAYS_PER_SEASON) return 1;      // winter: structure stands
  const g=PHEN[(PLANTS[key]&&PLANTS[key].phen)||'mid'];
  if (ydf<g.w) return 0.12;                          // still at the crown
  if (ydf>=g.f) return 1;
  const t=(ydf-g.w)/(g.f-g.w);
  return 0.12+0.88*t*t*(3-2*t);                      // smoothstep up
}
function bulbEnvelope(key){ // spring ephemerals by default; onions can carry summer/fall bulbs
  const ydf=(((absDay()%YEAR_DAYS)+YEAR_DAYS)%YEAR_DAYS)+calClock().frac;
  const P=PLANTS[key]||{};
  if (P.bulbSeason==='summer'){
    if (ydf<12) return 0;
    if (ydf<18) return (ydf-12)/6;
    if (ydf<48) return 1;
    if (ydf<56) return Math.max(0,(56-ydf)/8);
    return 0;
  }
  if (P.bulbSeason==='fall'){
    if (ydf<24) return 0;
    if (ydf<32) return (ydf-24)/8;
    if (ydf<60) return 1;
    return Math.max(0,(YEAR_DAYS-ydf)/4);
  }
  if (ydf>=DAYS_PER_SEASON) return 0;          // underground from summer on
  if (ydf<1.5) return ydf/1.5;
  if (ydf<10) return 1;
  return Math.max(0,(DAYS_PER_SEASON-1-ydf)/5); // foliage yellows away
}
function plantGrowth(p){
  const P=PLANTS[p.s];
  if (isWoodyDef(P)) return plantEstab(p); // woody: no cutback
  if (P && P.type==='bulb') return plantEstab(p)*bulbEnvelope(p.s);
  return plantEstab(p)*seasonEnvelope(p.s);
}
function establishedPreviewActive(){
  return game.gameMode==='design' && game.previewMode==='established';
}
function displayPlantGrowth(p){
  return establishedPreviewActive() ? 1 : plantGrowth(p);
}
function matureWoodyDraft(key,v){
  const p={s:key,d:woodyPlantedDay(plantDef(key,v),'mature'),t:0};
  if (v) p.v=v;
  return p;
}
/* age-at-placement (T10): backdate the planting day so a tree that already
   exists in the yard is modeled at its real age. plantEstab counts GROWING
   days (winters skipped), so backdating by whole YEAR_DAYS credits exactly
   that many years — Mature = the species' full `grow` horizon (estab 1),
   Young = about half. Non-woody plants always plant new. */
const WOODY_AGES=['new','young','mature'];
function normalizeWoodyAge(a){ return WOODY_AGES.includes(a)?a:'new'; }
function woodyPlantedDay(def,age){
  age=normalizeWoodyAge(age);
  if (!isWoodyDef(def) || age==='new') return absDay();
  const years=def.grow||5;
  return absDay() - (age==='mature'?years:Math.ceil(years/2))*YEAR_DAYS;
}
/* the display lens for establishment-derived facts (canopy reach, shade
   washes/stunting, plan circles, footprint styling, the plant card): real
   establishment normally, maturity under the design "Established" preview.
   Placement RULES never read this — legality must not change with a view
   toggle — they use plantEstab via shadeAt/ensureShadeMap(real). */
function effectiveEstab(p){
  return establishedPreviewActive() ? 1 : plantEstab(p);
}
function shrubClaimsTile(cx,cy,p,x,y,mature){
  const P=p && p.s ? plantDef(p.s,p.v) : p;
  if (!isShrubDef(P)) return x===cx && y===cy;
  if (x===cx && y===cy) return true;
  const est=p && p.s ? plantEstab(p) : 1;
  const r=woodyRadiusTiles(P)*(mature===false ? Math.max(0.35,est) : 1);
  const dx=Math.abs(x-cx), dy=Math.abs(y-cy), dist=Math.hypot(dx,dy);
  if (dist<=Math.max(0,r-0.36)) return true;
  if (!dx || !dy) return dist<=r+0.001;
  if (dist>r+0.72) return false;
  let hits=0;
  for (const ox of [-0.45,0,0.45]) for (const oy of [-0.45,0,0.45]){
    if (Math.hypot((x+ox)-cx,(y+oy)-cy)<=r+0.001) hits++;
  }
  return hits>=7;
}
function shrubFootprintTiles(cx,cy,p,mature){
  const P=p && p.s ? plantDef(p.s,p.v) : p;
  if (!isShrubDef(P)) return [[cx,cy]];
  const est=p && p.s ? plantEstab(p) : 1;
  const r=woodyRadiusTiles(P)*(mature===false ? Math.max(0.35,est) : 1);
  const reach=Math.ceil(r), tiles=[];
  for (let yy=cy-reach; yy<=cy+reach; yy++) for (let xx=cx-reach; xx<=cx+reach; xx++){
    if (xx<0||yy<0||xx>=GW||yy>=GH) continue;
    if (shrubClaimsTile(cx,cy,p,xx,yy,mature)) tiles.push([xx,yy]);
  }
  if (!tiles.some(([x,y])=>x===cx&&y===cy)) tiles.push([cx,cy]);
  return tiles;
}
function shrubHedgeCompatible(a,b){
  const A=plantDef(a.s,a.v), B=plantDef(b.s,b.v);
  return isShrubDef(A) && isShrubDef(B) &&
    A.group && A.group===B.group &&
    !!(A.look&&A.look.hedge) && !!(B.look&&B.look.hedge);
}
function livePlantKeyAt(x,y){ const k=`${x},${y}`, p=game.plants[k]; return (p&&!p.removed) ? k : null; }
function shrubInfoFromKey(k){
  const p=game.plants[k]; if (!p || p.removed) return null;
  if (!isShrubDef(plantDef(p.s,p.v))) return null;
  const [x,y]=k.split(',').map(Number);
  return {key:k,p,x,y,center:true};
}
function shrubAt(x,y,opts){
  opts=opts||{};
  const ignore=opts.ignoreKey||null;
  const ignoreKeys=opts.ignoreKeys||null;
  const ignored=k=>k===ignore || !!(ignoreKeys && (ignoreKeys.has ? ignoreKeys.has(k) : ignoreKeys[k]));
  const direct=livePlantKeyAt(x,y);
  if (direct && !ignored(direct)){
    const sh=shrubInfoFromKey(direct);
    if (sh) return sh;
  }
  for (const k in game.plants){ if (k===ignore) continue;
    if (ignored(k)) continue;
    const p=game.plants[k]; if (!p||p.removed) continue;
    if (!isShrubDef(plantDef(p.s,p.v))) continue;
    const [cx2,cy2]=k.split(',').map(Number);
    if (cx2===x && cy2===y) continue;
    const r=woodyRadiusTiles(plantDef(p.s,p.v));
    if (Math.abs(x-cx2)>Math.ceil(r) || Math.abs(y-cy2)>Math.ceil(r)) continue;
    if (shrubClaimsTile(cx2,cy2,p,x,y,true)) return {key:k,p,x:cx2,y:cy2,center:false};
  }
  return null;
}
function canPlaceShrubAt(x,y,np,opts){
  opts=opts||{};
  const P=plantDef(np.s,np.v);
  if (!isShrubDef(P)) return {ok:true};
  const ignore=opts.ignoreKey||null, ignoreKeys=opts.ignoreKeys||null;
  const ignored=k=>k===ignore || !!(ignoreKeys && (ignoreKeys.has ? ignoreKeys.has(k) : ignoreKeys[k]));
  for (const [xx,yy] of shrubFootprintTiles(x,y,np,true)){
    if (!onPlot(xx,yy)) return {ok:false, reason:'plot'};
    if (siteStructureAt(xx,yy) || isDoor(xx,yy)) return {ok:false, reason:'house'};
    if (fenceAt(xx,yy)) return {ok:false, reason:'fence'};
    if (lightAt(xx,yy)) return {ok:false, reason:'light'};
    if (firepitAt(xx,yy)) return {ok:false, reason:'firepit'};
    if (boulderAt(xx,yy)) return {ok:false, reason:'boulder'};
    const terr=tileTerrain(xx,yy);
    if (terr==='path'||terr==='water') return {ok:false, reason:terr};
    const k=`${xx},${yy}`, p=game.plants[k];
    if (p && !p.removed && !ignored(k)){
      if (shrubHedgeCompatible(np,p) && Math.hypot(xx-x,yy-y)>=0.95) continue;
      return {ok:false, reason:'plant'};
    }
    const other=shrubAt(xx,yy,{ignoreKey:ignore,ignoreKeys});
    if (other){
      if (shrubHedgeCompatible(np,other.p) && Math.hypot(other.x-x,other.y-y)>=0.95) continue;
      return {ok:false, reason:'shrub'};
    }
  }
  return {ok:true};
}
function clearBulbsUnderShrub(x,y,p,autosync,removedKeys){
  let n=0;
  for (const [xx,yy] of shrubFootprintTiles(x,y,p,true)){
    const k=`${xx},${yy}`, b=game.bulbs[k];
    if (b && !b.removed){ clearTile('bulbs',k); if (removedKeys) removedKeys.add(k); n++; }
  }
  if (n && autosync!==false) syncBulbsOut();
  return n;
}
function shrubFootprintOverlapsRect(cx,cy,p,x,y,w,h){
  return shrubFootprintTiles(cx,cy,p,true).some(([xx,yy])=>xx>=x&&xx<x+w&&yy>=y&&yy<y+h);
}
function drawShrubFootprint(ctx,W,H,sh,mode,age){
  const p=sh && sh.p;
  if (!p || p.removed) return;
  const est=effectiveEstab(p);   // Established preview: never the "young" dashed style
  const P=plantDef(p.s,p.v), r=woodyRadiusTiles(P);
  let fill='rgba(35,52,31,0.075)', stroke='rgba(239,230,211,0.08)', dash=null, line=1;
  if (mode==='ghost'){
    fill='rgba(218,170,84,0.10)'; stroke='rgba(246,220,156,0.78)'; line=1.7; dash=[7,5];
  } else if (mode==='ghostBlocked'){
    fill='rgba(166,64,48,0.16)'; stroke='rgba(236,118,92,0.86)'; line=1.8; dash=[7,5];
  } else if (mode==='hover'){
    fill='rgba(218,170,84,0.13)'; stroke='rgba(246,220,156,0.72)'; line=1.6;
  } else if (mode==='blocked'){
    fill='rgba(166,64,48,0.18)'; stroke='rgba(236,118,92,0.86)'; line=1.8;
  } else if (mode==='focus'){
    fill='rgba(224,185,98,0.12)'; stroke='rgba(247,232,176,0.78)'; line=1.7;
  } else if (mode==='pulse'){
    const a=Math.max(0,1-(age||0)/760);
    fill=`rgba(170,64,48,${0.10+0.12*a})`;
    stroke=`rgba(244,130,102,${0.25+0.62*a})`;
    line=1.5+1.8*a;
  } else if (est<0.45){
    fill='rgba(35,52,31,0.045)';
    stroke='rgba(239,230,211,0.12)';
    dash=[4,4];
  }
  ctx.save();
  ctx.lineWidth=line;
  if (dash) ctx.setLineDash(dash);
  const [sx,sy]=screenOf(sh.x,sh.y,W,H), cy=sy+TILE_H/2;
  ctx.beginPath();
  ctx.ellipse(sx,cy,(TILE_W/2)*r*1.06,(TILE_H/2)*r*1.06,0,0,7);
  if (fill){ ctx.fillStyle=fill; ctx.fill(); }
  if (stroke){ ctx.strokeStyle=stroke; ctx.stroke(); }
  if (mode!=='base'){
    ctx.strokeStyle=stroke; ctx.lineWidth=line+0.3;
    ctx.beginPath(); ctx.ellipse(sx,sy+TILE_H/2,10,4,0,0,7); ctx.stroke();
  }
  ctx.restore();
}
function pulseShrubFootprint(hit){
  const key=typeof hit==='string'?hit:(hit&&hit.key);
  if (!key) return;
  game.shrubFx.push({key,t0:performance.now()});
}
/* Annual bloom windows ----------------------------------------------------
   Flower timing used to restart inside every 16-day visual season. That made
   a genuinely long-blooming gaura or salvia fade out at Summer's end and
   begin a second bloom cycle in Fall. `bloomMonths` is already the curated,
   real-world source for the calendar, so turn its consecutive runs into
   year-relative game windows as well. `sea` still supplies seasonal colour;
   it no longer owns the timing clock.

   The optional `bloomWindow:{start,end}` data shape is available for a later,
   finer-grained month contract. Existing catalogue entries need no migration:
   their month runs are continuous windows now.
   `bloomDay` remains the exact day-in-season override for bulbs, onions, and
   other carefully staggered single-season species. */
function bloomMonthPhase(month){ return ((month-3+12)%12)*(YEAR_DAYS/12); }
function bloomWindowsFor(P){
  if (!P) return [];
  const explicit=P.bloomWindow;
  if (explicit && Number.isFinite(explicit.start) && Number.isFinite(explicit.end)){
    const start=((explicit.start-3+12)%12)*(YEAR_DAYS/12);
    const end=((explicit.end-3+12)%12)*(YEAR_DAYS/12);
    return [[start,end<=start ? end+YEAR_DAYS : end]];
  }
  const months=(P.bloomMonths||[]).filter(m=>Number.isInteger(m)&&m>=1&&m<=12);
  if (months.length){
    const on=Array(12).fill(false); months.forEach(m=>{ on[m-1]=true; });
    if (on.every(Boolean)) return [[0,YEAR_DAYS]];
    const gap=on.findIndex(v=>!v), out=[];
    for (let step=1;step<=12;){
      const i=(gap+step)%12;
      if (!on[i]){ step++; continue; }
      let len=0;
      while (len<12 && on[(i+len)%12]) len++;
      const start=bloomMonthPhase(i+1);
      out.push([start,start+len*(YEAR_DAYS/12)]);
      step+=len;
    }
    return out;
  }
  const on=SEASONS.map(s=>!!(P.sea&&P.sea[s]&&P.sea[s].bloom));
  if (!on.some(Boolean)) return [];
  if (on.every(Boolean)) return [[0,YEAR_DAYS]];
  const gap=on.findIndex(v=>!v), out=[];
  for (let step=1;step<=4;){
    const i=(gap+step)%4;
    if (!on[i]){ step++; continue; }
    let len=0;
    while (len<4 && on[(i+len)%4]) len++;
    out.push([i*DAYS_PER_SEASON,(i+len)*DAYS_PER_SEASON]);
    step+=len;
  }
  return out;
}
function bloomAppearance(P,season){
  const sea=P&&P.sea||{}, here=sea[season]||{};
  if (here.bloom) return here;
  const at=SEASONS.indexOf(season);
  if (at<0) return null;
  for (let d=1;d<SEASONS.length;d++){
    const before=sea[SEASONS[(at-d+SEASONS.length)%SEASONS.length]];
    if (before&&before.bloom) return before;
    const after=sea[SEASONS[(at+d)%SEASONS.length]];
    if (after&&after.bloom) return after;
  }
  return null;
}
// Exact bloomDay entries have a deliberately seasonal performance. The
// adjacent-season colour bridge belongs only to month-window plants.
function bloomAppearanceFor(P,season){
  const here=P&&P.sea&&(P.sea[season]||{});
  return P&&P.bloomDay!==undefined ? (here&&here.bloom?here:null) : bloomAppearance(P,season);
}
function smoothBloom(t){ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); }
function bloomWindowLevel(day,start,end){
  let d=day;
  if (end>YEAR_DAYS && d<start) d+=YEAR_DAYS;
  if (d<start || d>end) return 0;
  const span=end-start, rise=Math.min(3,span*0.32), fall=Math.min(4,span*0.34);
  return Math.min(smoothBloom((d-start)/rise),smoothBloom((end-d)/fall));
}
/* Within a single, deliberately staggered bloom season, retain the familiar
   rise/peak/fade. Across a month- or season-spanning run, use one annual
   rise/hold/fade instead, so it cannot blink off at a seasonal boundary. */
function bloomLevel(key){
  const P=PLANTS[key]||{};
  const seasonDay=(((absDay()%DAYS_PER_SEASON)+DAYS_PER_SEASON)%DAYS_PER_SEASON)+calClock().frac;
  if (P.bloomDay!==undefined){
    const t2=Math.max(0,1-Math.abs(seasonDay-P.bloomDay)/7);
    return t2*t2*(3-2*t2);
  }
  const annualDay=(((absDay()%YEAR_DAYS)+YEAR_DAYS)%YEAR_DAYS)+calClock().frac;
  return bloomWindowsFor(P).reduce((level,[start,end])=>Math.max(level,bloomWindowLevel(annualDay,start,end)),0);
}
/* trees throw shade as they establish; baby trees show a future canopy,
   but they don't block full-sun perennials until the canopy is meaningful. */
const SHADE_ACTIVE_ESTAB = 0.35;
const SHADE_MIN_RADIUS = 1.5;
const SHADE_ACTIVE_SCORE = 0.42;
const SHADE_FUTURE_SCORE = 0.18;
const SHADE_AREA_SCALE = Math.SQRT1_2; // length x width ~= half the former restricted area
/* Site orientation is independent of camera rotation. Zero degrees means true
   north points toward plot y-; positive degrees rotate clockwise on the plan.
   SUN_PATH stays immutable in compass space (x=east, y=south), then a cached
   derived path rotates those samples into world-grid space. */
const DIRS = {N:[0,-1], E:[1,0], S:[0,1], W:[-1,0]};
const SUN_PATH = [
  {name:'morning',   sun:[0.72,0.70],  weight:0.25, len:1.20, width:0.44}, // SE sun -> NW shade
  {name:'midday',    sun:DIRS.S,       weight:0.40, len:0.88, width:0.56}, // S sun  -> N shade
  {name:'afternoon', sun:[-0.72,0.70], weight:0.35, len:1.25, width:0.46}, // SW sun -> NE shade
];
let siteDirectionCache={deg:null,dirs:null,path:null};
function effectiveSiteNorthDeg(){
  return game.siteNorthPreviewDeg===null||game.siteNorthPreviewDeg===undefined
    ? normalizeSiteNorthDeg(game.siteNorthDeg) : normalizeSiteNorthDeg(game.siteNorthPreviewDeg);
}
function siteDirections(deg=effectiveSiteNorthDeg()){
  deg=normalizeSiteNorthDeg(deg);
  if (siteDirectionCache.deg===deg && siteDirectionCache.dirs) return siteDirectionCache.dirs;
  const r=deg*Math.PI/180, north=[Math.sin(r),-Math.cos(r)], east=[Math.cos(r),Math.sin(r)];
  const dirs={N:north,E:east,S:[-north[0],-north[1]],W:[-east[0],-east[1]]};
  siteDirectionCache={deg,dirs,path:null};
  return dirs;
}
function orientedSunPath(){
  const deg=effectiveSiteNorthDeg(), dirs=siteDirections(deg);
  if (siteDirectionCache.deg===deg && siteDirectionCache.path) return siteDirectionCache.path;
  // A base sample is expressed as east/south components. Rotate both basis
  // vectors once per orientation, never once per shaded tile.
  siteDirectionCache.path=SUN_PATH.map(sample=>Object.assign({},sample,{sun:[
    sample.sun[0]*dirs.E[0]+sample.sun[1]*dirs.S[0],
    sample.sun[0]*dirs.E[1]+sample.sun[1]*dirs.S[1]
  ]}));
  return siteDirectionCache.path;
}
function setSiteNorthDeg(value){
  const next=normalizeSiteNorthDeg(value);
  clearSiteNorthPreview();
  if (next===normalizeSiteNorthDeg(game.siteNorthDeg)) return false;
  game.siteNorthDeg=next; siteDirectionCache={deg:null,dirs:null,path:null};
  markModelChanged(); resetShadeMapCache();
  if (typeof invalidateCompass==='function') invalidateCompass();
  return true;
}
function previewSiteNorthDeg(value){
  const next=normalizeSiteNorthDeg(value);
  if (next===effectiveSiteNorthDeg()) return;
  game.siteNorthPreviewDeg=next; siteDirectionCache={deg:null,dirs:null,path:null};
  resetShadeMapCache();
  if (typeof invalidateCompass==='function') invalidateCompass();
}
function clearSiteNorthPreview(){
  if (game.siteNorthPreviewDeg===null||game.siteNorthPreviewDeg===undefined) return;
  game.siteNorthPreviewDeg=null; siteDirectionCache={deg:null,dirs:null,path:null};
  resetShadeMapCache();
  if (typeof invalidateCompass==='function') invalidateCompass();
}
/* real=true reads true establishment (placement rules); default reads the
   display lens (effectiveEstab — mature under the Established preview) */
function canopyRadius(p,real){ const P=plantDef(p.s,p.v);
  if (!isTreeDef(P)) return 0;
  return woodyRadiusTiles(P)*(real?plantEstab(p):effectiveEstab(p));
}
function treeShadeInfo(k,p,real){
  const P=plantDef(p.s,p.v); if (!isTreeDef(P)) return null;
  const [tx2,ty2]=k.split(',').map(Number), r=canopyRadius(p,real), est=real?plantEstab(p):effectiveEstab(p);
  return {p,x:tx2,y:ty2,r,est,activePotential:est>=SHADE_ACTIVE_ESTAB && r>=SHADE_MIN_RADIUS};
}
/* Tree spacing (T3). A trunk is one HARD tile — occupancy already stops two
   trees (or a tree and a perennial/bulb) from sharing it, and the canopy area
   around it stays open for underplanting on purpose (§D). What was missing is
   that nothing noticed two big trees dropped inside their combined spread. So
   spacing is a SOFT signal: `nearestTreeCrowder` returns the closest tree the
   one at (x,y) would crowd — judged by the AVERAGE of the two species'
   recommended on-center spacing, so a large oak beside a small redbud is rated
   by their real needs — or null. It never blocks; callers just warn. */
function treeSpacingTiles(P){
  return Math.max(1, (P.space||P.spread||TILE_IN)/TILE_IN);
}
function nearestTreeCrowder(x,y,def,ignoreKey){
  if (!isTreeDef(def)) return null;
  const aSpace=treeSpacingTiles(def);
  let best=null;
  for (const key in game.plants){
    if (key===ignoreKey) continue;
    const p=game.plants[key]; if (!p||p.removed) continue;
    const P=plantDef(p.s,p.v); if (!isTreeDef(P)) continue;
    const ci=key.indexOf(','), tx=+key.slice(0,ci), ty=+key.slice(ci+1);
    if (tx===x && ty===y) continue;
    const dist=Math.hypot(tx-x,ty-y), want=(aSpace+treeSpacingTiles(P))/2;
    if (dist<want && (!best || dist<best.dist)) best={key,x:tx,y:ty,p,dist,wantTiles:want};
  }
  return best;
}
function shadeSeasonScale(){
  const s=calClock().season;
  return s==='Summer'?0.9:s==='Winter'?1.45:1.12;
}
function treeShadeReach(sh){
  return Math.ceil(sh.r*(1.4*shadeSeasonScale()*SHADE_AREA_SCALE+0.75));
}
function treeShadeScore(sh,x,y){
  if (!sh || sh.r<1 || (x===sh.x && y===sh.y)) return 0;
  const dx=x-sh.x, dy=y-sh.y, dist=Math.hypot(dx,dy);
  const scale=shadeSeasonScale();
  let score=0;
  for (const sample of orientedSunPath()){
    const mag=Math.hypot(sample.sun[0],sample.sun[1])||1;
    const sx=sample.sun[0]/mag, sy=sample.sun[1]/mag;
    const shx=-sx, shy=-sy;
    const proj=dx*shx+dy*shy;
    const crown=sh.r*(0.22+0.24*sh.est)*SHADE_AREA_SCALE;
    if (dist<=crown){
      score += sample.weight*0.58;
      continue;
    }
    const len=sh.r*sample.len*scale*(0.65+0.35*sh.est)*SHADE_AREA_SCALE;
    if (proj<-sh.r*0.12 || proj>len) continue;
    const perp=Math.abs(dx*(-shy)+dy*shx);
    const taper=1-(Math.max(0,proj)/Math.max(1,len))*0.55;
    const width=sh.r*sample.width*taper*SHADE_AREA_SCALE;
    if (perp<=width){
      const across=1-perp/Math.max(0.1,width)*0.35;
      const along=1-Math.max(0,proj)/Math.max(0.1,len)*0.25;
      score += sample.weight*across*along;
    }
  }
  return Math.min(1,score);
}
/* Shade only changes when the model, day/season, rotation, or plot size
   changes. Cache it per tile so render-time plant stunting, canopy washes, and
   shade overlays are table lookups instead of plant x tree x sun-sample math. */
/* two slots: `shadeMapCache` is the DISPLAY map (effectiveEstab — what washes,
   stunting, the plan, and cards show); `shadeMapCacheReal` is the RULES map
   (true establishment — what shadeAt/placement guards read). Outside the
   Established preview the two are identical, so the real path aliases the
   display slot and the second map is never built. */
function emptyShadeCache(){
  return {key:null, plantsRef:null, activeScore:null, activeAlpha:null,
    futureScore:null, futureDrawScore:null, activeTree:null, futureTree:null};
}
let shadeMapCache=emptyShadeCache(), shadeMapCacheReal=emptyShadeCache();
function shadeMapIndex(x,y){ return y*GW+x; }
function shadeMapKey(real){ return game.rev+'|'+game.rot+'|N'+effectiveSiteNorthDeg()+'|'+absDay()+'|'+GW+'x'+GH+
  ((!real && establishedPreviewActive())?'|est':''); }
function resetShadeMapCache(){
  shadeMapCache=emptyShadeCache(); shadeMapCacheReal=emptyShadeCache();
}
function ensureShadeMap(real){
  real = !!real && establishedPreviewActive();   // maps coincide outside the preview
  const key=shadeMapKey(real), n=Math.max(0,GW*GH);
  const cached = real ? shadeMapCacheReal : shadeMapCache;
  if (cached.key===key && cached.plantsRef===game.plants &&
      cached.activeScore && cached.activeScore.length===n) return cached;
  const activeScore=new Float32Array(n), activeAlpha=new Float32Array(n);
  const futureScore=new Float32Array(n), futureDrawScore=new Float32Array(n);
  const activeTree=new Array(n), futureTree=new Array(n);
  let trees=0;   // hasShade lets the render wash loop skip treeless gardens entirely
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const sh=treeShadeInfo(k,p,real);
    if (!sh || sh.r<1) continue;
    trees++;
    const reach=treeShadeReach(sh);
    sh.reach=reach;
    const yA=Math.max(0,sh.y-reach), yB=Math.min(GH-1,sh.y+reach);
    const xA=Math.max(0,sh.x-reach), xB=Math.min(GW-1,sh.x+reach);
    for (let yy=yA; yy<=yB; yy++) for (let xx=xA; xx<=xB; xx++){
      const score=treeShadeScore(sh,xx,yy);
      if (score<=0) continue;
      const idx=shadeMapIndex(xx,yy);
      if (sh.activePotential && score>activeScore[idx]){
        activeScore[idx]=score;
        if (score>=SHADE_ACTIVE_SCORE) activeTree[idx]=sh;
      }
      if (sh.activePotential && score>=SHADE_ACTIVE_SCORE){
        const alpha=(0.06+0.18*score)*(0.65+0.35*sh.est);
        if (alpha>activeAlpha[idx]) activeAlpha[idx]=alpha;
      } else if (score>=SHADE_FUTURE_SCORE && score>futureScore[idx]){
        futureScore[idx]=score; futureTree[idx]=sh;
      }
      if (!sh.activePotential && score>=SHADE_FUTURE_SCORE && score>futureDrawScore[idx])
        futureDrawScore[idx]=score;
    }
  }
  const built={key, plantsRef:game.plants, activeScore, activeAlpha,
    futureScore, futureDrawScore, activeTree, futureTree, hasShade:trees>0};
  if (real) shadeMapCacheReal=built; else shadeMapCache=built;
  return built;
}
function shadeScoreAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return 0;
  return ensureShadeMap().activeScore[shadeMapIndex(x,y)]||0;
}
function shadeActiveAlphaAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return 0;
  return ensureShadeMap().activeAlpha[shadeMapIndex(x,y)]||0;
}
function shadeFutureDrawScoreAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return 0;
  return ensureShadeMap().futureDrawScore[shadeMapIndex(x,y)]||0;
}
function shadeInfoAt(x,y,includeFuture,real){
  if (x<0||y<0||x>=GW||y>=GH) return null;
  const m=ensureShadeMap(real), idx=shadeMapIndex(x,y);
  const active=m.activeTree[idx];
  if (active) return Object.assign({score:m.activeScore[idx],active:true},active);
  if (includeFuture){
    const future=m.futureTree[idx];
    if (future) return Object.assign({score:m.futureScore[idx],active:false},future);
  }
  return null;
}
function shadeAt(x,y){ // placement-rule helper: always TRUE establishment
  const sh=shadeInfoAt(x,y,false,true);
  return sh&&sh.p;
}
function tileSeed(x,y){ return (x*73856093 ^ y*19349663)>>>0; }

/* ---------- shared disc brush (materials, elevation, erase) ----------
   One `game.brushSize` (diameter in tiles) drives paint and erase alike.
   brushOffsets returns the tile offsets of a disc centered on the cursor
   tile — a rounded footprint, so a fat dragged stroke reads as a curved
   ribbon and a 5-wide erase clips its corners instead of a hard square.
   Pure + tiny, so it's unit-tested and cheap to call per gesture/frame.
   size 1 -> 1 tile, 3 -> the full 3x3, 5 -> a rounded 5x5 (21 of 25). */
const BRUSH_SIZES=[1,2,3,5,7];
function normalizeBrushSize(s){ s=s|0; return BRUSH_SIZES.includes(s)?s:1; }
function brushOffsets(size){
  size=normalizeBrushSize(size);
  if (size===1) return [[0,0]];
  const r=size/2, reach=Math.ceil(r), out=[];
  for (let dy=-reach;dy<=reach;dy++) for (let dx=-reach;dx<=reach;dx++)
    if (Math.hypot(dx,dy)<=r+1e-6) out.push([dx,dy]);
  return out;
}

/* the starter walkway — a lazy Oudolf curve, seeded as ordinary path
   terrain when a world is created so the shovel can take it out like
   anything else the gardener lays down */
function seedWalkway(){
  for (let x=0;x<GW;x++){
    const c = Math.round(GH/2 + Math.sin(x*0.55)*2.2);
    [c,c-1].forEach(y=>{
      if (!onPlot(x,y)) return;
      const k=`${x},${y}`;
      if (!game.terrain[k]) setTile('terrain',k,{k:'path',t:Date.now()});
    });
  }
}

/* houses: per-garden footprints you can't walk through, each with a door
   tile centered on its south side. Sleeping used to live there, but is
   feature-flagged off because it made the house feel like a daily chore and
   added HUD clutter. game.houses holds every placed house ({x,y,w,h,wall,
   roof,sizeFt}); game.houseDraft is the settings the House tool places with.
   Place adds a house, Erase (landscape) removes one. */
const HOUSE_TRIM = {door:'#3a2c22', trim:'#efe6d3', glow:'#d9c08a'};
const HOUSE_SIZES = [ // [label, width ft, depth ft] -> tiles via ftToTiles
  ['Shed',3,3],['Tiny home',12,9],['Cottage',24,18],['House',36,27],['Big house',45,36]];
const WALL_COLS = [['Cedar','#8a7a60'],['Cream','#d9cdb0'],['Sage','#8a9a78'],
  ['Barn red','#9a4a3a'],['Slate','#6e7787']];
const ROOF_COLS = [['Rust','#9a5f3a'],['Charcoal','#3f3a38'],['Forest','#4a5d46'],
  ['Weathered','#8a8274']];
function defaultDraft(){ // settings for a freshly-armed House tool
  const big=GW*GH>=1900;
  return {w: big?ftToTiles(24):2, h: big?ftToTiles(18):2,
          wall:'#8a7a60', roof:'#9a5f3a', sizeFt: big?[24,18]:[3,3]};
}
function defaultHouse(){ // a placed starter house (story mode), shed/cottage by plot size
  const d=defaultDraft();
  return {x:Math.max(0,Math.min(GW-d.w-1,SPAWNX+3)), y:Math.max(0,SPAWNY-6-(d.h-2)),
          w:d.w, h:d.h, wall:d.wall, roof:d.roof, sizeFt:d.sizeFt};
}
function draftFromHouses(){ // seed the draft from an existing house, else defaults
  const h=game.houses && game.houses[0];
  return h ? {w:h.w,h:h.h,wall:h.wall,roof:h.roof,sizeFt:h.sizeFt||[h.w,h.h]} : defaultDraft();
}
function houseAt(x,y){ // the placed house covering this tile, or null
  for (const h of game.houses){ if (x>=h.x && x<h.x+h.w && y>=h.y && y<h.y+h.h) return h; }
  return null;
}
function inHouse(x,y){ return !!houseAt(x,y); }
/* Building Footprints are design-site context, not a second house system. The
   persisted truth is an orthogonal polygon on the tile-corner lattice; its
   tile fill/bounds live in a WeakMap so saves and the renderer never carry
   cache baggage or re-rasterize every frame. */
const BUILDING_GEOM=new WeakMap();
function polygonContains(px,py,verts){
  let inside=false;
  for (let i=0,j=verts.length-1;i<verts.length;j=i++){
    const [xi,yi]=verts[i], [xj,yj]=verts[j];
    if ((yi>py)!==(yj>py) && px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function buildingGeometry(b){
  if (!b || !Array.isArray(b.vertices) || !b.vertices.length) return {tiles:[],tileSet:new Set(),bounds:null};
  const hit=BUILDING_GEOM.get(b); if (hit) return hit;
  const vs=b.vertices, xs=vs.map(p=>p[0]), ys=vs.map(p=>p[1]);
  const minX=Math.max(0,Math.floor(Math.min(...xs))), maxX=Math.min(GW-1,Math.ceil(Math.max(...xs))-1);
  const minY=Math.max(0,Math.floor(Math.min(...ys))), maxY=Math.min(GH-1,Math.ceil(Math.max(...ys))-1);
  const tiles=[];
  for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++)
    if (polygonContains(x+.5,y+.5,vs)) tiles.push([x,y]);
  const out={tiles,tileSet:new Set(tiles.map(p=>p[0]+','+p[1])),
    bounds:tiles.length?{x0:minX,y0:minY,x1:maxX,y1:maxY}:null};
  BUILDING_GEOM.set(b,out); return out;
}
function buildingTiles(b){ return buildingGeometry(b).tiles; }
function buildingTileSet(b){ return buildingGeometry(b).tileSet; }
function buildingBounds(b){ return buildingGeometry(b).bounds; }
function buildingAt(x,y,ignoreId){
  for (const b of game.buildings||[]){
    if (!b || b.id===ignoreId) continue;
    const r=buildingBounds(b); if (!r || x<r.x0||x>r.x1||y<r.y0||y>r.y1) continue;
    if (buildingTiles(b).some(p=>p[0]===x&&p[1]===y)) return b;
  }
  return null;
}
function inBuilding(x,y){ return !!buildingAt(x,y); }
function siteStructureAt(x,y){ return buildingAt(x,y) || houseAt(x,y); }
function buildingDrawDepth(b){
  const r=buildingBounds(b); return r ? footprintDrawDepth(r.x0,r.y0,r.x1-r.x0+1,r.y1-r.y0+1)+0.355 : -Infinity;
}
function doorPos(h){ return h ? [h.x+((h.w-1)>>1), h.y+h.h] : [-1,-1]; }
function isDoor(x,y){
  for (const h of game.houses){ const [dx,dy]=doorPos(h); if (x===dx && y===dy) return true; }
  return false;
}
function fenceAt(x,y){ const f=game.fences[`${x},${y}`]; return (f&&!f.removed)?f:null; }
function fenceBlocks(x,y){ const f=fenceAt(x,y); return !!(f && !f.gate); }
function fenceNeighbor(x,y){ return x>=0 && y>=0 && x<GW && y<GH && !!fenceAt(x,y); }

/* ---------- plot shape (lot boundary) ----------
   An optional polygon mask over the GWxGH rectangle, for an irregular lot
   instead of the default axis-aligned plot. game.plotShape is either null
   (the full rectangle) or exactly four [x,y] tile-CORNER lattice vertices
   (integers, 0..GW / 0..GH), listed once around a simple (non-crossing)
   quad. The mask is derived, never stored: rebuildPlotMask() only runs on
   setup/load (see setWorldSize/setPlotShape below), never per frame. */
let plotMask=null;
function rebuildPlotMask(){
  if (!game.plotShape){ plotMask=null; return; }
  const verts=game.plotShape, mask=new Uint8Array(Math.max(0,GW*GH));
  for (let y=0;y<GH;y++) for (let x=0;x<GW;x++)
    if (polygonContains(x+0.5,y+0.5,verts)) mask[y*GW+x]=1;
  plotMask=mask;
}
// the one legality predicate for "is this the player's lot": bounds, then
// the mask lookup (or true everywhere when no shape is set). Allocation-free
// so it's cheap to call from placement/collision loops.
function onPlot(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return false;
  return plotMask ? !!plotMask[y*GW+x] : true;
}
// Ray-vs-polygon-boundary hit test, used by the compass to find where a
// direction ray leaves an irregular lot instead of the default rectangle.
// verts are plotShape's tile-CORNER lattice coords; origin/dir are in the
// tile-CENTER space screenOfFlat uses, so each vertex shifts -0.5 first.
// Returns the smallest non-negative t (origin + t*dir), or null if the ray
// never crosses an edge (e.g. origin sits outside a concave shape).
function rayPolygonExitT(origin,dir,verts){
  let best=null;
  for (let i=0;i<verts.length;i++){
    const ax=verts[i][0]-0.5, ay=verts[i][1]-0.5;
    const bx=verts[(i+1)%verts.length][0]-0.5, by=verts[(i+1)%verts.length][1]-0.5;
    const ex=ax-origin[0], ey=ay-origin[1], sx=bx-ax, sy=by-ay;
    const denom=dir[0]*sy-dir[1]*sx;
    if (Math.abs(denom)<1e-9) continue;             // parallel to this edge
    const t=(ex*sy-sx*ey)/denom, u=(ex*dir[1]-dir[0]*ey)/denom;
    if (t>=0 && u>=-1e-6 && u<=1+1e-6 && (best===null||t<best)) best=t;
  }
  return best;
}
function plotEdgesCross(a,b,c,d){ // strict segment intersection (CCW test)
  const ccw=(p,q,r)=>(r[1]-p[1])*(q[0]-p[0])>(q[1]-p[1])*(r[0]-p[0]);
  return ccw(a,c,d)!==ccw(b,c,d) && ccw(a,b,c)!==ccw(a,b,d);
}
// null clears the shape (full rectangle). Otherwise: exactly four vertices,
// rounded to integers and clamped onto the lattice, non-self-intersecting
// (only the two diagonally-opposite edge pairs of a simple quad can cross),
// and enclosing at least 9 tiles (reject slivers). Returns true/false.
function setPlotShape(verts){
  if (verts===null || verts===undefined){
    game.plotShape=null;
  } else {
    if (!Array.isArray(verts) || verts.length!==4 || !verts.every(v=>Array.isArray(v)&&v.length>=2))
      return false;
    const clean=verts.map(v=>[
      Math.max(0,Math.min(GW,Math.round(+v[0]))),
      Math.max(0,Math.min(GH,Math.round(+v[1])))
    ]);
    if (clean.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y))) return false;
    if (plotEdgesCross(clean[0],clean[1],clean[2],clean[3])) return false;   // edge 0-1 vs 2-3
    if (plotEdgesCross(clean[1],clean[2],clean[3],clean[0])) return false;   // edge 1-2 vs 3-0
    let enclosed=0;
    for (let y=0;y<GH;y++) for (let x=0;x<GW;x++)
      if (polygonContains(x+0.5,y+0.5,clean)) enclosed++;
    if (enclosed<9) return false;
    game.plotShape=clean;
  }
  game.plotRev++;
  rebuildPlotMask();
  markGroundChanged({terrain:true});
  markModelChanged();
  return true;
}
function canStand(x,y){ return onPlot(x,y) && !siteStructureAt(x,y) && !fenceBlocks(x,y) && !lightAt(x,y) && !firepitAt(x,y) && !boulderAt(x,y) && tileTerrain(x,y)!=='water'; }
/* a standable starting tile near plot center — the door if the house
   sits on the spawn, else a spiral search outward, so re-entering a
   garden never drops the player stuck inside their own walls */
function safeSpawn(){
  if (canStand(SPAWNX,SPAWNY)) return [SPAWNX,SPAWNY];
  for (const h of game.houses){ const [dx,dy]=doorPos(h); if (canStand(dx,dy)) return [dx,dy]; }
  for (let r=1;r<Math.max(GW,GH);r++)
    for (let oy=-r;oy<=r;oy++) for (let ox=-r;ox<=r;ox++){
      if (Math.max(Math.abs(ox),Math.abs(oy))!==r) continue;
      const x=SPAWNX+ox, y=SPAWNY+oy;
      if (canStand(x,y)) return [x,y];
    }
  return [0,0];
}

/* player-laid terrain (paths, beds, and water) on top of the built-in walkway */
function terrainAt(x,y){ const t=game.terrain[`${x},${y}`]; return (t&&!t.removed)?t:null; }
function tileTerrain(x,y){ const t=terrainAt(x,y); return t?t.k:null; }
function elevationAt(x,y){
  const e=game.elevation && game.elevation[`${Math.round(x)},${Math.round(y)}`];
  return (e && !e.removed && Number.isFinite(+e.h)) ? Math.max(ELEV_MIN,Math.min(ELEV_MAX,+e.h|0)) : 0;
}
function setElevationAt(x,y,h){
  const k=`${x},${y}`, n=Math.max(ELEV_MIN,Math.min(ELEV_MAX,+h|0));
  if (n===elevationAt(x,y)) return false;
  if (!game.elevation) game.elevation={};
  if (n===0) clearTile('elevation',k); else setTile('elevation',k,{h:n,t:Date.now()});
  return true;
}
function applyElevationTool(x,y){
  const h=elevationAt(x,y);
  if (game.tool==='raise') return setElevationAt(x,y,h+1);
  if (game.tool==='lower') return setElevationAt(x,y,h-1);
  if (game.tool==='level') return setElevationAt(x,y,0);
  return false;
}

/* ---------- isometric math + view rotation ----------
   The camera always looks at VIEW space; game.rot rotates world tiles
   into it in 90-degree steps so the garden can be seen from any side.
   World logic (movement, planting, saves) never changes — only the
   world<->view mapping. */
let cam = {x:0,y:0};
function isoX(x,y){ return (x-y)*TILE_W/2; }
function isoY(x,y){ return (x+y)*TILE_H/2; }
function worldToView(x,y){
  switch(game.rot){
    case 1:  return [y, GW-1-x];
    case 2:  return [GW-1-x, GH-1-y];
    case 3:  return [GH-1-y, x];
    default: return [x,y];
  }
}
function viewToWorld(vx,vy){
  switch(game.rot){
    case 1:  return [GW-1-vy, vx];
    case 2:  return [GW-1-vx, GH-1-vy];
    case 3:  return [vy, GH-1-vx];
    default: return [vx,vy];
  }
}
function viewDirToWorld(dvx,dvy){ // direction vectors: linear part of viewToWorld
  switch(game.rot){
    case 1:  return [-dvy, dvx];
    case 2:  return [-dvx,-dvy];
    case 3:  return [ dvy,-dvx];
    default: return [dvx,dvy];
  }
}
function viewScreen(vx,vy,W,H){ return [W/2 + isoX(vx,vy) - cam.x, H*0.24 + isoY(vx,vy) - cam.y]; }
function screenOfFlat(x,y,W,H){ const [vx,vy]=worldToView(x,y); return viewScreen(vx,vy,W,H); }
function screenOf(x,y,W,H){ const [sx,sy]=screenOfFlat(x,y,W,H); return [sx,sy-elevationAt(x,y)*ELEV_STEP]; }
function plantOffset(p){
  const ox=Number(p&&p.ox), oy=Number(p&&p.oy);
  return {ox:Number.isFinite(ox)?ox:0, oy:Number.isFinite(oy)?oy:0};
}
function plantScreenOf(x,y,p,W,H){
  const o=plantOffset(p);
  return screenOf(x+o.ox,y+o.oy,W,H);
}
function isHedgePlant(p){
  const D=p && plantDef(p.s,p.v);
  return !!(D && D.look && D.look.hedge);
}
function hedgeRenderDetail(x,y,p,W,H){
  if (!isHedgePlant(p)) return null;
  const base=PLANTS[p.s], group=base && (base.group||p.s);
  const [sx,sy]=screenOf(x,y,W,H);
  const hedgeDirs=[], neighbors={};
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    const np=game.plants[`${x+dx},${y+dy}`];
    if (!np || np.removed || !isHedgePlant(np)) return;
    const nb=PLANTS[np.s], ng=nb && (nb.group||np.s);
    if (ng!==group) return;
    const [nx,ny]=screenOf(x+dx,y+dy,W,H);
    neighbors[`${dx},${dy}`]=true;
    hedgeDirs.push([nx-sx,ny-sy]);
  });
  if (!hedgeDirs.length) return null;
  const axis = (neighbors['1,0'] || neighbors['-1,0']) ? [1,0] : [0,1];
  const [ax,ay]=screenOf(x+axis[0],y+axis[1],W,H);
  const hx=ax-sx, hy=ay-sy, hedgeStep=Math.hypot(hx,hy)||1;
  let hedgeAngle=Math.atan2(hy,hx);
  if (hedgeAngle>Math.PI/2) hedgeAngle-=Math.PI;
  if (hedgeAngle<-Math.PI/2) hedgeAngle+=Math.PI;
  return {
    hedgeDirs, hedgeAngle, hedgeAxis:[hx/hedgeStep,hy/hedgeStep], hedgeStep,
    hedgeEndNeg:!neighbors[`${-axis[0]},${-axis[1]}`],
    hedgeEndPos:!neighbors[`${axis[0]},${axis[1]}`]
  };
}
function bambooRenderDetail(x,y,p,W,H){
  const P=p && plantDef(p.s,p.v);
  if (!P || P.form!=='bamboo') return null;
  const group=P.group||p.s, [sx,sy]=screenOf(x,y,W,H), bambooDirs=[];
  [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].forEach(([dx,dy])=>{
    const np=game.plants[`${x+dx},${y+dy}`];
    if (!np || np.removed) return;
    const NP=plantDef(np.s,np.v);
    if (!NP || NP.form!=='bamboo' || (NP.group||np.s)!==group) return;
    const [nx,ny]=screenOf(x+dx,y+dy,W,H);
    bambooDirs.push([nx-sx,ny-sy]);
  });
  return bambooDirs.length ? {bambooDirs} : null;
}
function plantRenderDetail(x,y,p,W,H){
  return hedgeRenderDetail(x,y,p,W,H) || bambooRenderDetail(x,y,p,W,H);
}
function viewDepth(x,y){ const [vx,vy]=worldToView(x,y); return vx+vy; }
function plantDepth(x,y,p){
  const o=plantOffset(p);
  return viewDepth(x+o.ox,y+o.oy);
}
function viewPointAt(sx,sy,W,H){
  const rx = sx - W/2 + cam.x, ry = sy - H*0.24 + cam.y - TILE_H/2;
  const fx = (rx/(TILE_W/2) + ry/(TILE_H/2))/2;
  const fy = (ry/(TILE_H/2) - rx/(TILE_W/2))/2;
  return [fx,fy];
}
function worldPointAt(sx,sy,W,H,elev){
  return viewToWorld(...viewPointAt(sx,sy+(elev||0)*ELEV_STEP,W,H));
}
function inWorldTile(x,y){ return x>=0&&y>=0&&x<GW&&y<GH; }
function pointInTileDiamond(sx,sy,x,y,W,H){
  const [tx,ty]=screenOf(x,y,W,H), cx=tx, cy=ty+TILE_H/2;
  const dx=Math.abs(sx-cx)/(TILE_W/2), dy=Math.abs(sy-cy)/(TILE_H/2);
  return dx+dy<=1.0001;
}
function tileAtElevation(sx,sy,W,H,h){
  const [vx,vy]=viewPointAt(sx,sy+h*ELEV_STEP,W,H);
  return viewToWorld(Math.round(vx),Math.round(vy));
}
function tileAt(sx,sy,W,H){
  for (let h=ELEV_MAX; h>=ELEV_MIN; h--){
    if (h===0) continue;
    const [x,y]=tileAtElevation(sx,sy,W,H,h);
    if (inWorldTile(x,y) && elevationAt(x,y)===h && pointInTileDiamond(sx,sy,x,y,W,H)) return [x,y];
  }
  const [vx,vy]=viewPointAt(sx,sy,W,H);
  return viewToWorld(Math.round(vx), Math.round(vy));
}
function footprintDrawDepth(x,y,w,h){
  return Math.max(
    viewDepth(x,y), viewDepth(x+w-1,y),
    viewDepth(x,y+h-1), viewDepth(x+w-1,y+h-1)
  );
}
function houseDrawDepth(h){
  return footprintDrawDepth(h.x,h.y,h.w,h.h)+0.05;
}
function isoDiamondPath(ctx,sx,sy,inset){
  const i=inset||0, hw=TILE_W/2-i, hh=TILE_H/2-i*0.5, cy=sy+TILE_H/2;
  ctx.beginPath(); ctx.moveTo(sx,sy+i*0.5); ctx.lineTo(sx+hw,cy);
  ctx.lineTo(sx,sy+TILE_H-i*0.5); ctx.lineTo(sx-hw,cy); ctx.closePath();
}
function tileDiamond(ctx,sx,sy,fill,stroke,dash){
  if (dash){ ctx.save(); ctx.setLineDash(dash); }
  isoDiamondPath(ctx,sx,sy,0);
  if (fill){ ctx.fillStyle=fill; ctx.fill(); }
  if (stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=1.5; ctx.stroke(); }
  if (dash) ctx.restore();
}
function drawElevationSides(ctx,W,H,x,y,base){
  const h=elevationAt(x,y);
  if (h<=0) return;
  const [sx,sy]=screenOf(x,y,W,H), cy=sy+TILE_H/2;
  const right=[sx+TILE_W/2,cy], bottom=[sx,sy+TILE_H], left=[sx-TILE_W/2,cy];
  const side=(a,b,dy,fill)=>{
    ctx.fillStyle=fill;
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
    ctx.lineTo(b[0],b[1]+dy); ctx.lineTo(a[0],a[1]+dy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(35,28,20,0.16)'; ctx.lineWidth=1; ctx.stroke();
  };
  [[1,0,right,bottom,-18],[0,1,bottom,left,-28]].forEach(([dvx,dvy,a,b,shadeAmt])=>{
    const [dx,dy]=viewDirToWorld(dvx,dvy), nh=elevationAt(x+dx,y+dy), diff=h-nh;
    if (diff>0) side(a,b,diff*ELEV_STEP,toneColor(base,shadeAmt));
  });
}
function drawElevationRim(ctx,sx,sy,h){
  if (!h) return;
  const a=Math.min(0.32,0.12+Math.abs(h)*0.045);
  tileDiamond(ctx,sx,sy,h>0?`rgba(255,244,210,${a*0.28})`:`rgba(28,36,48,${a})`,
    h>0?'rgba(245,220,160,0.36)':'rgba(105,128,145,0.42)');
}
function toneColor(col,amt){ return col && col[0]==='#' ? shade(col,amt) : col; }
function drawSoftShadow(ctx,x,y,rx,ry,alpha){
  ctx.fillStyle=`rgba(0,0,0,${alpha*0.22})`;
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,7); ctx.fill();
  ctx.fillStyle=`rgba(0,0,0,${alpha*0.34})`;
  ctx.beginPath(); ctx.ellipse(x,y,rx*0.70,ry*0.68,0,0,7); ctx.fill();
  ctx.fillStyle=`rgba(0,0,0,${alpha*0.42})`;
  ctx.beginPath(); ctx.ellipse(x,y,rx*0.42,ry*0.42,0,0,7); ctx.fill();
}
function fillDiamondFace(ctx,sx,sy,points,fill){
  ctx.fillStyle=fill;
  ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
  for (let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath(); ctx.fill();
}
/* ---------- ground grain: batched material texture ----------
   A ground material reads as a material when its grains are DENSE, varied in
   hue as well as value, shaped like the stuff actually is, and lit the same way
   as everything else in the scene. The old texture was none of those: five to
   ten randomly-rotated ellipses of flat white-or-black alpha, scattered inside
   a small box around the tile centre. That is noise, and it made crushed gravel,
   river cobble and bark mulch differ only by base tint.

   THE COST MODEL, measured on this canvas at 961 tiles a bake. Do not design
   against intuition here; the intuitive answer is wrong in both directions.

     ctx.fill()          ~0.02us   — a fill of an EMPTY path is free, and 961
                                     fills measured 0.17ms total
     ctx.rect            ~0.42us   — special-cased in Skia, but see grainGrit
     baked triangle      ~0.63us
     baked quad          ~0.80us
     baked pentagon      ~0.90us
     ellipse r<=2        ~0.88us
     ellipse r~4         ~1.15us   — ellipse cost rises with radius (tessellation)
     ellipse r~6         ~1.76us
     ellipse r~10        ~1.65us
     baked hexagon r~6   ~1.09us   — polygons do NOT scale with radius

   So the currency is SHAPE INSTANCES, not fills, and the old assumption that
   "batching into one fill makes grains free" is false — grouping 60 shapes into
   4 fills measured the same as 60 shapes in 1 fill (57.1ms vs 55.3ms). What
   batching buys is TONE GROUPS AT NO COST: a recipe can split its grains into
   four or six colours for nothing, and hue variety is most of what makes a
   material read. So each recipe stages its grains once in module-level scratch
   (as draw.js's fcPush/fcDraw do for florets) and paints them in several tones
   with a stride.

   The corollary is the expensive habit to avoid: painting the SAME staged set a
   second time as a dropped shadow, or a third as a sheen, doubles or triples the
   instance count. A first cut did that everywhere and came in 2-3x over — the
   soil bed at 12.8x. Now only grains large enough to show one get a highlight,
   and on a stride so it is a quarter-pass, not a whole one. Where a material
   needs dark between its grains, that comes from the BASE COLOUR showing
   through, which costs nothing at all.

   Budget: ~21us of grain per tile, which lands each material at or under what
   its flat speckle used to cost. Two more rules, both measured:
   - Batch within a TILE, never across tiles. One path holding a whole 961-tile
     region measured 199ms against 35ms per-tile: Skia degrades sharply past a
     few hundred subpaths in one path.
   - Nothing allocates. The scratch is reused and never grown; overflow past
     GRAIN_MAX is dropped rather than reallocated, as fcPush does.

   Colours come from BED_STYLES/PATH_COLORS `tones` (core.js), never from here. */
const GRAIN_MAX = 64;    // the densest recipe stages 38; the rest is headroom
// Mortar/sand joint between laid units, in real inches. Wider than a mason
// would lay it, because much under this it stops reading as masonry at all.
const JOINT_IN = 0.75;
const _gnX=new Float64Array(GRAIN_MAX), _gnY=new Float64Array(GRAIN_MAX),
      _gnA=new Float64Array(GRAIN_MAX), _gnB=new Float64Array(GRAIN_MAX),
      _gnC=new Float64Array(GRAIN_MAX), _gnD=new Float64Array(GRAIN_MAX);
let _gnN=0, _gnDropped=0;
function grainReset(){ _gnN=0; }
function grainAt(x,y){ _gpx=x; _gpy=y; }   // place a grain directly, without grainSite's scatter
function grainPush(a,b,c,d){    // x,y come from the last grainSite / grainAt
  if (_gnN>=GRAIN_MAX){ _gnDropped++; return; }   // counted, not grown: a recipe
  _gnX[_gnN]=_gpx; _gnY[_gnN]=_gpy;               // that overflows would just go
  _gnA[_gnN]=a; _gnB[_gnN]=b;                     // quiet, so a test watches this
  _gnC[_gnN]=c||0; _gnD[_gnN]=d||0; _gnN++;
}
function grainDropCount(){ return _gnDropped; }
function grainStagedCount(){ return _gnN; }
/* Uniform point in the tile diamond. The map (u+v)/2, (u-v)/2 carries the unit
   square exactly onto the diamond, so this is a fixed two rng draws per grain
   with no rejection loop.

   Covering the WHOLE diamond is most of why the old texture read as sparse: it
   scattered inside a +-17 x +-6 box around the tile centre — under a quarter of
   the tile — so every boundary wore a bare ring and the grid showed through the
   material. The extent is inset by most of the grain's radius. Inset by ALL of
   it no grain crosses the tile line and a band of thin coverage traces the grid
   back in; inset by none, the per-tile path's next base fill slices every
   overhang off along the tile edge, which is worse — a hard line rather than a
   soft one. At 0.72 the overhang is small enough to be invisible where it is
   cut, and the organic path does not cut it at all because there is no per-tile
   base fill inside a region. */
const GRAIN_INSET = 0.72;
let _gpx=0, _gpy=0;
function grainSite(sx,cy,rx,ry,rs){
  const u=rs()*2-1, v=rs()*2-1;
  _gpx = sx + (u+v)*0.5*(TILE_W*0.5-rx*GRAIN_INSET);
  _gpy = cy + (u-v)*0.5*(TILE_H*0.5-ry*GRAIN_INSET);
}
/* Crushed stone and cut slate are SHARP; an ellipse reads as a pebble however
   it is tinted. Three sets of unit silhouettes are baked at load — five-sided
   chips for stone you can see the shape of, three-sided grits for the fines,
   and the pebbles below — twelve of each, and each carries its own vertex
   phase, so choosing a silhouette is also choosing a rotation.

   The grit set exists because a triangle costs ~0.63us against ~0.90us for the
   chip, which is what makes a dense fine material affordable. `ctx.rect` is
   cheaper still at ~0.42us and was tried first: at two or three pixels it does
   not read as a speck, it reads as a SQUARE, and a gravel path came out as
   grey confetti in a scene where every other edge runs on the isometric
   diagonal. The extra 0.2us buys the material back. */
const CHIP_SIL=12, CHIP_V=5, GRIT_V=3, PEB_V=6;
const _chipPt=new Float64Array(CHIP_SIL*CHIP_V*2);
const _gritPt=new Float64Array(CHIP_SIL*GRIT_V*2);
// Water-worn cobble: six sides with only a little wobble, so it reads as a
// rounded stone with the slight flats a real one has. It exists mainly because
// a baked hexagon costs ~1.09us at cobble size against ~1.76us for the ellipse
// it replaced — polygon cost does not grow with radius and ellipse cost does.
const _pebPt=new Float64Array(CHIP_SIL*PEB_V*2);
(function bakeGrainSilhouettes(){
  const r=mulberry(0x51ed270b);
  const bake=(buf,n,wob,lo,hi)=>{
    for (let s=0;s<CHIP_SIL;s++){
      const phase=r()*6.283;
      for (let v=0;v<n;v++){
        const a=phase+(v/n)*6.283+(r()-0.5)*wob, rad=lo+r()*hi, j=(s*n+v)*2;
        buf[j]=Math.cos(a)*rad; buf[j+1]=Math.sin(a)*rad;
      }
    }
  };
  bake(_chipPt,CHIP_V,0.72,0.60,0.55);
  bake(_gritPt,GRIT_V,0.72,0.60,0.55);
  bake(_pebPt, PEB_V, 0.22,0.88,0.22);
})();
/* Every grain is a baked polygon; there is no ellipse painter here. Ellipses
   lost on both counts — dearer (and dearer still as they grow), and smoother
   than any of these materials actually are.

   Each painter walks the staged set with a stride, so one staged scatter splits
   into tone groups without sorting or a second pass of placement maths:
   (ph, md) = (0,3),(1,3),(2,3) paints thirds, and the default (0,1) paints all.
   dx/dy offset the whole group (sheen, joint shadow) and k scales it. */
function grainPoly(ctx,buf,n,col,dx,dy,k,ph,md){    // A=rx B=ry C=silhouette
  if (!_gnN) return;
  ctx.fillStyle=col; ctx.beginPath();
  for (let i=ph||0;i<_gnN;i+=md||1){
    const rx=_gnA[i]*k, ry=_gnB[i]*k, x=_gnX[i]+dx, y=_gnY[i]+dy;
    const p=((_gnC[i]|0)%CHIP_SIL)*n*2;
    ctx.moveTo(x+buf[p]*rx, y+buf[p+1]*ry);
    for (let v=1;v<n;v++) ctx.lineTo(x+buf[p+v*2]*rx, y+buf[p+v*2+1]*ry);
    ctx.closePath();
  }
  ctx.fill();
}
function grainChips (ctx,col,dx,dy,k,ph,md){ grainPoly(ctx,_chipPt,CHIP_V,col,dx,dy,k,ph,md); }
function grainGrit  (ctx,col,dx,dy,k,ph,md){ grainPoly(ctx,_gritPt,GRIT_V,col,dx,dy,k,ph,md); }
function grainPebble(ctx,col,dx,dy,k,ph,md){ grainPoly(ctx,_pebPt, PEB_V, col,dx,dy,k,ph,md); }
/* Laid units — brick, paver. X,Y is the unit's CENTRE already projected to
   screen; A,B are its half-length and half-width in TILES along the two ground
   axes, so the quad lands on the iso plane rather than on the screen plane. */
function grainUnits(ctx,col,dx,dy,k,ph,md){         // A=halfLen B=halfWid (tiles)
  if (!_gnN) return;
  const HX=TILE_W*0.5, HY=TILE_H*0.5;
  ctx.fillStyle=col; ctx.beginPath();
  for (let i=ph||0;i<_gnN;i+=md||1){
    const ax=_gnA[i]*k*HX, ay=_gnA[i]*k*HY;         // along +u
    const bx=-_gnB[i]*k*HX, by=_gnB[i]*k*HY;        // along +v
    const x=_gnX[i]+dx, y=_gnY[i]+dy;
    ctx.moveTo(x-ax-bx, y-ay-by);
    ctx.lineTo(x+ax-bx, y+ay-by);
    ctx.lineTo(x+ax+bx, y+ay+by);
    ctx.lineTo(x-ax+bx, y-ay+by);
    ctx.closePath();
  }
  ctx.fill();
}
/* Shredded bark is fibrous and directional — it lies the way it was raked — so
   a shred is a tapered quad along its own axis, not a rotated ellipse. Four
   corners, not six: the torn butt and frayed tip of the first cut cost a third
   more per shred and are two pixels of detail nobody can see. */
function grainShreds(ctx,col,dx,dy,k,ph,md){        // A=halfLen B=halfWid C,D=unit dir
  if (!_gnN) return;
  ctx.fillStyle=col; ctx.beginPath();
  for (let i=ph||0;i<_gnN;i+=md||1){
    const L=_gnA[i]*k, w=_gnB[i]*k, ux=_gnC[i], uy=_gnD[i];
    const x=_gnX[i]+dx, y=_gnY[i]+dy, px=-uy*w, py=ux*w;
    ctx.moveTo(x-ux*L+px*0.55, y-uy*L+py*0.55);
    ctx.lineTo(x+ux*L+px*0.30, y+uy*L+py*0.30);
    ctx.lineTo(x+ux*L-px*0.30, y+uy*L-py*0.30);
    ctx.lineTo(x-ux*L-px*0.55, y-uy*L-py*0.55);
    ctx.closePath();
  }
  ctx.fill();
}
/* Materials whose base follows the season (soil reads AMBIENCE) declare no
   palette, so derive one from whatever the base currently is. shade() memoises,
   so this is a map hit per tile rather than four colour parses. */
const _derivedTones=['','','',''];
function materialTones(tones,base){
  if (tones) return tones;
  _derivedTones[0]=shade(base,-26); _derivedTones[1]=shade(base,-6);
  _derivedTones[2]=shade(base,22);  _derivedTones[3]=shade(base,-15);
  return _derivedTones;
}
/* One recipe per material. `mat` is the BED_STYLES / PATH_COLORS entry, so a
   recipe can read anything the material declares — `tones`, and `unit` for the
   laid ones. `T` is [deep, body, light, accent]. `wx,wy` are the world tile,
   which only the laid units need (their bond has to line up across tiles).
   Sizes are real: the tile is 18in across and drawn 76x38, so an inch is
   ~4.2px in x and ~2.1px in y, and a 3in river cobble really is ~12x6px. */
function drawMaterialGrain(ctx,sx,cy,mat,base,rs,wx,wy){
  const tex=mat&&mat.texture, T=materialTones(mat&&mat.tones,base);
  grainReset();
  if (tex==='gravel'){
    // Crushed stone is GRADED — a dominant fine size with a scatter of larger
    // pieces — and packed, so the dark you see is between stones rather than
    // under them. A handful of dark mottle grains carry that interstitial
    // shadow for a fraction of what re-painting every grain as a shadow pass
    // would cost.  (~23us)
    for (let i=0;i<7;i++){
      const rx=2.0+rs()*1.9; grainSite(sx,cy,rx,rx*0.56,rs); grainPush(rx,rx*0.56,(rs()*CHIP_SIL)|0);
    }
    grainGrit(ctx,T[0],0,0,1);
    grainReset();
    for (let i=0;i<30;i++){
      const rx=0.9+rs()*1.4; grainSite(sx,cy,rx,rx*0.58,rs); grainPush(rx,rx*0.58,(rs()*CHIP_SIL)|0);
    }
    grainGrit(ctx,T[1],0,0,1,0,3);
    grainGrit(ctx,T[2],0,0,1,1,3);
    grainGrit(ctx,T[3],0,0,1,2,3);
    grainReset();
    for (let i=0;i<6;i++){
      const rx=1.7+rs()*1.5; grainSite(sx,cy,rx,rx*0.58,rs); grainPush(rx,rx*0.58,(rs()*CHIP_SIL)|0);
    }
    grainChips(ctx,T[2],0,0,1,0,2);
    grainChips(ctx,T[3],0,0,1,1,2);
  } else if (tex==='fines'){
    // Compacted screenings: mostly dust walked flat, with a few chips sitting
    // proud of it. Quieter than gravel on purpose — a limestone path is a
    // surface you notice the edge of, not the grain of.  (~21us)
    for (let i=0;i<26;i++){
      const rx=0.6+rs()*1.0; grainSite(sx,cy,rx,rx*0.60,rs); grainPush(rx,rx*0.60,(rs()*CHIP_SIL)|0);
    }
    grainGrit(ctx,T[0],0,0,1,0,3);
    grainGrit(ctx,T[2],0,0,1,1,3);
    grainGrit(ctx,T[1],0,0,1,2,3);
    grainReset();
    for (let i=0;i<5;i++){
      const rx=1.1+rs()*1.2; grainSite(sx,cy,rx,rx*0.60,rs); grainPush(rx,rx*0.60,(rs()*CHIP_SIL)|0);
    }
    grainChips(ctx,T[3],0,0,1);
  } else if (tex==='rock'){
    // Water-worn cobble, 2-4in: rounded, close packed, and MIXED — a river bar
    // is grey and tan and rust together, which is why the accent tone earns its
    // place here more than anywhere else. No shadow pass: at this size the base
    // colour showing between the cobbles IS the gap, and re-painting the whole
    // set to say so again costs more than every other tone put together. Four
    // body tones on a stride of four rather than three, because grains this big
    // merge into one pale mass when two neighbours share a tone — that merging
    // is what read as popcorn.  (~22us)
    for (let i=0;i<18;i++){
      const rx=3.4+rs()*3.0, sq=0.44+rs()*0.16;
      grainSite(sx,cy,rx,rx*sq,rs); grainPush(rx,rx*sq,(rs()*CHIP_SIL)|0);
    }
    grainPebble(ctx,T[1],0,0,1,0,4);
    grainPebble(ctx,T[3],0,0,1,1,4);
    grainPebble(ctx,T[2],0,0,1,2,4);
    grainPebble(ctx,shade(T[0],26),0,0,1,3,4);        // the odd dark basalt cobble
    grainPebble(ctx,T[2],LIT.x*2.6,LIT.y*2.2,0.22,0,3);   // wet-worn sheen, quarter pass
  } else if (tex==='mulch'){
    // Shredded hardwood, 1-3in shreds, raked into a common drift with the usual
    // spread around it, laid deep enough that shreds are all you see. Fresh
    // shreds are dark and the top layer weathers grey-tan; that value split is
    // what makes a mulch bed read as mulch rather than as brown ground. The
    // dark between them is the bed's own base colour.  (~21us)
    const drift=rs()*6.283, dcx=Math.cos(drift), dsx=Math.sin(drift);
    for (let i=0;i<34;i++){
      const L=2.2+rs()*2.4, w=0.55+rs()*0.55, a=(rs()-0.5)*1.35;
      const ca=Math.cos(a), sa=Math.sin(a);
      grainSite(sx,cy,L,w+0.6,rs);
      grainPush(L,w, dcx*ca-dsx*sa*0.42, (dsx*ca+dcx*sa)*0.42);   // flattened into the ground plane
    }
    grainShreds(ctx,T[1],0,0,1,0,4);
    grainShreds(ctx,T[3],0,0,1,1,4);
    grainShreds(ctx,T[2],0,0,1,2,4);
    grainShreds(ctx,T[0],0,0,1,3,4);
  } else if (tex==='needle'){
    // Pine straw: 4-6in needles in two- and three-needle fascicles, raked into
    // a deep mat. Longer and far finer than a bark shred, and layered in more
    // than one direction — a single drift reads as combed hair rather than as
    // straw. The dark between them is the bed's own base.  (~24us)
    const dA=rs()*6.283, dB=dA+1.1+rs()*0.9;
    for (let i=0;i<38;i++){
      const drift=(i%3)?dA:dB, a=drift+(rs()-0.5)*0.55;
      const L=3.8+rs()*3.6, w=0.28+rs()*0.20;
      const ca=Math.cos(a), sa=Math.sin(a);
      grainSite(sx,cy,L,w+0.5,rs);
      grainPush(L,w, ca, sa*0.42);               // flattened into the ground plane
    }
    grainShreds(ctx,T[1],0,0,1,0,4);
    grainShreds(ctx,T[3],0,0,1,1,4);
    grainShreds(ctx,T[2],0,0,1,2,4);
    grainShreds(ctx,T[0],0,0,1,3,4);
  } else if (tex==='pebble'){
    // Pea gravel: 3/8in rounded stone, the size between crushed gravel and
    // river cobble. Rounded like the cobble and small like the grit, packed
    // tight enough that the base is a shadow rather than a background. (~23us)
    for (let i=0;i<30;i++){
      const rx=2.0+rs()*1.9; grainSite(sx,cy,rx,rx*0.52,rs); grainPush(rx,rx*0.52,(rs()*CHIP_SIL)|0);
    }
    grainPebble(ctx,T[1],0,0,1,0,4);
    grainPebble(ctx,T[3],0,0,1,1,4);
    grainPebble(ctx,T[2],0,0,1,2,4);
    grainPebble(ctx,shade(T[0],16),0,0,1,3,4);
  } else if (tex==='brick'){
    // Laid units in running bond — brick at 8x4in, concrete paver at whatever
    // `unit` says. Laid out in VIEW space, not tile-local: the courses have to
    // run continuously from tile to tile, and taking the phase from view coords
    // keeps every tile agreeing on where they fall (the bake is per-rotation,
    // so the bond turns with the garden rather than with the screen). A unit
    // that overhangs onto the next tile is exactly where that tile would draw
    // it too, so the bond is seamless with no per-tile clip.
    // The joint is the base colour showing between units — the same trick the
    // loose materials use for the dark between their grains, and it costs
    // nothing where an extra full-tile fill would have cost the most.
    const U=(mat&&mat.unit)||[8,4];
    const bl=U[0]/TILE_IN, bw=U[1]/TILE_IN;      // unit length / width, in tiles
    // Joint width is a real dimension, and BOTH neighbours inset by half of it,
    // or a 16in paver ends up grouted like a brick.
    const jt=Math.min(JOINT_IN*0.5/TILE_IN, bl*0.14, bw*0.14);
    const vv=worldToView(wx|0,wy|0), vx=vv[0], vy=vv[1];
    const HX=TILE_W*0.5, HY=TILE_H*0.5;
    // Big units get clipped to the tile. They are drawn whole so the bond stays
    // continuous, but a 16in paver is larger than the tile it is being drawn
    // for, so most of every fill lands outside it: unclipped the paver measured
    // ~19x the tile's area in overdraw and cost 59ms against 38ms clipped.
    // Brick is small enough that its fills mostly land on the tile anyway, and
    // there the clip measured as pure overhead — so it is paid for only when a
    // unit is a decent fraction of a tile.
    const clipped = bl>0.5 || bw>0.5;
    if (clipped){
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sx,cy-HY-0.3); ctx.lineTo(sx+HX+0.6,cy);
      ctx.lineTo(sx,cy+HY+0.3); ctx.lineTo(sx-HX-0.6,cy); ctx.closePath();
      ctx.clip();
    }
    // margin of half a unit: that is exactly far enough for every unit that
    // overlaps this tile, and a whole unit either side was a third more fills
    const j0=Math.floor((vy-bw*0.5)/bw), j1=Math.floor((vy+1+bw*0.5)/bw);
    for (let j=j0;j<=j1;j++){
      const off=(j&1)?bl*0.5:0;
      const i0=Math.floor((vx-bl*0.5-off)/bl), i1=Math.floor((vx+1+bl*0.5-off)/bl);
      for (let i=i0;i<=i1;i++){
        const ca=(i+0.5)*bl+off-(vx+0.5), cb=(j+0.5)*bw-(vy+0.5);
        grainAt(sx+(ca-cb)*HX, cy+(ca+cb)*HY);
        grainPush(bl*0.5-jt, bw*0.5-jt, 0);
      }
    }
    // Four tones on a stride of four: units vary batch to batch, and each is
    // drawn exactly once. A shrunk highlight pass was tried and stamps a dot in
    // the middle of every unit, which reads as a maker's mark, not as wear.
    grainUnits(ctx,T[1],0,0,1,0,4);
    grainUnits(ctx,T[2],0,0,1,1,4);
    grainUnits(ctx,T[3],0,0,1,2,4);
    grainUnits(ctx,shade(T[2],9),0,0,1,3,4);
    if (clipped) ctx.restore();
  } else if (tex==='leaf'){
    // Fallen deciduous leaves, lying every which way and overlapping so heavily
    // that what you actually see is edges and partial leaves, not whole ones.
    // Angular silhouettes, NOT ellipses: a smooth oval with a midrib down it is
    // a coffee bean, and no amount of recolouring fixed that. The irregular
    // outline carries the leaf on its own, so the rib pass goes away with it —
    // which also makes this the cheapest of the three big-grain materials at
    // ~0.9us a leaf against ~1.4us for the ellipse it replaced.  (~22us)
    for (let i=0;i<24;i++){
      const rx=2.8+rs()*3.4, sq=0.46+rs()*0.24;
      grainSite(sx,cy,rx,rx*sq,rs); grainPush(rx,rx*sq,(rs()*CHIP_SIL)|0);
    }
    grainChips(ctx,T[1],0,0,1,0,4);
    grainChips(ctx,T[3],0,0,1,1,4);
    grainChips(ctx,T[2],0,0,1,2,4);
    grainChips(ctx,shade(T[0],20),0,0,1,3,4);    // the odd wet, dark leaf
  } else if (tex==='soil'){
    // Worked soil is a CRUMB — aggregates a quarter-inch to an inch, each one
    // shading the crevice behind it — but it is the quietest recipe here on
    // purpose. Soil is the backdrop a planting is read against, and pushing the
    // contrast further turns a seedbed into coffee grounds. Grit rather than
    // chips throughout, because a crumb is 2px and this is the material most
    // likely to cover a whole garden.
    // (~20us; the first cut of this one measured 12.8x its old cost)
    for (let i=0;i<36;i++){
      const rx=0.9+rs()*1.5; grainSite(sx,cy,rx,rx*0.60,rs); grainPush(rx,rx*0.60,(rs()*CHIP_SIL)|0);
    }
    grainGrit(ctx,T[0],0,0,1,0,3);               // crevices
    grainGrit(ctx,T[1],0,0,1,1,3);
    grainGrit(ctx,T[3],0,0,1,2,3);
    grainGrit(ctx,T[2],LIT.x*0.8,LIT.y*0.7,0.55,0,4);   // lit crumb tops, quarter pass
  } else if (tex==='clay'){
    // Compacted clay: a smooth surface that crazes as it dries, with the odd
    // pebble worked up out of it. The cracks are the identity, so they are a
    // single batched stroke rather than a fill.  (~12us)
    for (let i=0;i<12;i++){
      const rx=1.8+rs()*2.6; grainSite(sx,cy,rx,rx*0.58,rs); grainPush(rx,rx*0.58,(rs()*CHIP_SIL)|0);
    }
    grainGrit(ctx,T[1],0,0,1,0,2);               // damp/dry mottling, low contrast
    grainGrit(ctx,T[2],0,0,1,1,2);
    grainReset();
    for (let i=0;i<5;i++){                       // the odd pebble worked up out of it
      const rx=0.9+rs()*1.0; grainSite(sx,cy,rx,rx*0.60,rs); grainPush(rx,rx*0.60,(rs()*CHIP_SIL)|0);
    }
    grainChips(ctx,T[3],0,0,1);
    // Crazing: fine and low-contrast. Drawn dark and heavy it stops reading as
    // a dried surface and starts reading as twigs dropped on the path.
    ctx.strokeStyle=shade(T[0],16); ctx.lineWidth=0.4; ctx.beginPath();
    for (let i=0;i<4;i++){
      const u=rs()*2-1, v=rs()*2-1;
      const x=sx+(u+v)*0.5*30, y=cy+(u-v)*0.5*14, a=rs()*3.14, len=2.5+rs()*3.5;
      ctx.moveTo(x-Math.cos(a)*len,y-Math.sin(a)*len*0.5);
      ctx.lineTo(x+Math.cos(a)*len*0.4,y+Math.sin(a)*len*0.2);
      ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len*0.5);
    }
    ctx.stroke();
  } else if (tex==='flag'){
    // Cut flagstone: a couple of big plates per tile, overlapping so the base
    // colour showing between them reads as the JOINT. The first cut used four
    // plates a third this size, which floated as separate shards on a slab —
    // laid stone is defined by its joints, so the plates have to be large
    // enough to run off the tile and meet the neighbouring ones.
    for (let i=0;i<3;i++){
      const rx=15+rs()*10; grainSite(sx,cy,rx,rx*0.50,rs); grainPush(rx,rx*0.50,(rs()*CHIP_SIL)|0);
    }
    grainChips(ctx,T[0],0.6,1.0,1.05);           // joint shadow
    grainChips(ctx,T[1],0,0,1,0,3);
    grainChips(ctx,T[2],0,0,1,1,3);
    grainChips(ctx,T[3],0,0,1,2,3);
  }
}
/* `skipBase` is set by the organic path, where paintTerrainBlobs has already
   filled the whole region in one go: repainting the base per tile inside it
   only re-covers ground that is already covered, and it is a full-tile fill —
   the most expensive kind — on every tile of every bed. */
function drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,base,rs,terrObj,skipBase){
  // The material's grain recipe and palette both come from its data entry, so a
  // "Bark mulch" path and a bark-mulch bed are the same material rather than two
  // tints of one generic speckle.
  const mat = terr==='bed' ? bedStyle(terrObj&&terrObj.c)
            : path ? pathColor(terrObj&&terrObj.c) : null;
  // A material's base is bled half a pixel past the tile so neighbouring
  // diamonds overlap. Two antialiased fills that merely ABUT leave a hairline
  // of whatever is underneath along every shared edge — invisible while the
  // bevel stroke below covered it, and a full tile grid the moment a material
  // stopped drawing that stroke.
  if (!skipBase){ isoDiamondPath(ctx,sx,sy,mat?-0.6:0); ctx.fillStyle=base; ctx.fill(); }
  // Grass (and the flagstone doorstep) keep the bevelled tile: the lit facet,
  // the shaded skirt and the seam are what give a lawn its isometric relief.
  // A MATERIAL gets a flat base instead, because that bevel and seam are drawn
  // per tile and a continuous gravel bed with a grid stamped across it does not
  // read as gravel — it reads as a tilemap. Its relief comes from the grain,
  // which does not know where the tile edges are. Under snow nothing else is
  // visible, so the bevel is all the relief there is and every tile keeps it.
  if (!mat || amb.snow){
    const top=toneColor(base,amb.snow?12:9), bottom=toneColor(base,-9);
    fillDiamondFace(ctx,sx,sy,[[sx,sy],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H/2]],top);
    fillDiamondFace(ctx,sx,sy,[[sx,sy+TILE_H/2],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H],[sx-TILE_W/2,sy+TILE_H/2]],bottom);
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1;
    isoDiamondPath(ctx,sx,sy,0); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(sx,sy+1); ctx.lineTo(sx+TILE_W/2-1,sy+TILE_H/2); ctx.stroke();
  }
  if (amb.snow) return;
  ctx.save();
  if (mat){
    drawMaterialGrain(ctx,sx,sy+TILE_H/2,mat,base,rs,x,y);
  } else {
    const blades=2+((x*17+y*11)&1);
    for (let i=0;i<blades;i++){
      const ox=sx+(rs()-0.5)*30, oy=sy+TILE_H/2+(rs()-0.5)*12, len=3+rs()*4;
      ctx.strokeStyle=`rgba(38,63,38,${0.12+rs()*0.10})`;
      ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(ox,oy);
      ctx.quadraticCurveTo(ox+(rs()-0.5)*3,oy-len*0.7,ox+(rs()-0.5)*5,oy-len);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawWaterTexture(ctx,sx,sy,x,y,tile,amb,t){
  const w=waterStyle(tile&&tile.c), frozen=!!amb.snow;
  const base=frozen ? mixHex(w.fill,'#e8f0f5',0.58) : w.fill;
  isoDiamondPath(ctx,sx,sy,0);
  ctx.fillStyle=base; ctx.fill();
  fillDiamondFace(ctx,sx,sy,[[sx,sy],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H/2]],frozen?mixHex(w.fill,'#ffffff',0.72):mixHex(w.fill,'#9ed0d4',0.18));
  fillDiamondFace(ctx,sx,sy,[[sx,sy+TILE_H/2],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H],[sx-TILE_W/2,sy+TILE_H/2]],frozen?mixHex(w.deep,'#d7e7f0',0.55):w.deep);
  const nbs=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>tileTerrain(x+dx,y+dy)==='water').length;
  ctx.strokeStyle=frozen?'rgba(255,255,255,0.48)':w.edge;
  ctx.lineWidth=nbs<3?1.8:0.8;
  isoDiamondPath(ctx,sx,sy,1.5); ctx.stroke();
  const rr=mulberry(tileSeed(x,y)^0x517cc1);
  ctx.save();
  if (frozen){
    ctx.strokeStyle='rgba(255,255,255,0.38)'; ctx.lineWidth=0.8;
    for (let i=0;i<2;i++){ const ox=sx+(rr()-0.5)*24, oy=sy+TILE_H/2+(rr()-0.5)*9;
      ctx.beginPath(); ctx.moveTo(ox-6,oy); ctx.lineTo(ox+6,oy+(rr()-0.5)*4); ctx.stroke(); }
  } else {
    ctx.strokeStyle='rgba(230,248,244,0.42)'; ctx.lineWidth=0.9;
    for (let i=0;i<2;i++){
      const phase=Math.sin(t*0.002+i+x*0.7+y*0.4), ox=sx+(rr()-0.5)*24, oy=sy+TILE_H/2+(rr()-0.5)*8;
      ctx.beginPath(); ctx.ellipse(ox,oy,7+phase*1.4,2.2,0,0,7); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawSeasonSky(ctx,W,H,season){
  const L=SEASON_LIGHT[season]||SEASON_LIGHT.Summer;
  let g=ctx.createRadialGradient(W*0.72,H*0.14,0,W*0.72,H*0.14,H*0.9);
  g.addColorStop(0,L.sun); g.addColorStop(0.5,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  g=ctx.createLinearGradient(0,H*0.18,0,H*0.62);
  g.addColorStop(0,'rgba(255,255,255,0)');
  g.addColorStop(1,L.haze);
  ctx.fillStyle=g; ctx.fillRect(0,H*0.18,W,H*0.46);
}
function applySeasonLighting(ctx,W,H,amb,season){
  const L=SEASON_LIGHT[season]||SEASON_LIGHT.Summer;
  ctx.fillStyle=amb.tint; ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.globalCompositeOperation='screen';
  const beam=ctx.createLinearGradient(W*0.18,0,W*0.92,H*0.92);
  beam.addColorStop(0,L.beam);
  beam.addColorStop(0.45,'rgba(255,255,255,0.02)');
  beam.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=beam; ctx.fillRect(0,0,W,H);
  ctx.restore();
  const vg=ctx.createRadialGradient(W*0.50,H*0.44,Math.min(W,H)*0.20,W*0.50,H*0.44,Math.max(W,H)*0.74);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,L.vignette);
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
}
function applyDuskLighting(ctx,W,H,season){
  const winter=season==='Winter';
  ctx.save();
  ctx.fillStyle=winter?'rgba(20,28,46,0.30)':'rgba(18,25,42,0.26)';
  ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='screen';
  let g=ctx.createRadialGradient(W*0.74,H*0.16,0,W*0.74,H*0.16,H*0.86);
  g.addColorStop(0,winter?'rgba(178,202,232,0.18)':'rgba(156,178,220,0.14)');
  g.addColorStop(0.38,'rgba(92,118,176,0.07)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  g=ctx.createLinearGradient(0,H*0.52,0,H);
  g.addColorStop(0,'rgba(255,255,255,0)');
  g.addColorStop(1,'rgba(186,116,72,0.08)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.restore();
  const vg=ctx.createRadialGradient(W*0.48,H*0.46,Math.min(W,H)*0.22,W*0.48,H*0.46,Math.max(W,H)*0.78);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(5,10,20,0.26)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
}
function snapCam(){ const [vx,vy]=worldToView(game.px,game.py);
  cam.x=isoX(vx,vy); cam.y=isoY(vx,vy)-(VH/ZOOM)*0.21; }
function rotateView(dir){
  game.rot=(game.rot+(dir||1)+4)%4; snapCam(); game.dirty=true;
  updateCompass();
  toast(`View rotated — ${game.rot*90}°.`);
}
/* photo mode: one frame rendered with a golden-hour wash, saved as PNG.
   The HUD is DOM, not canvas, so the shot is clean automatically. */
function takePhoto(){
  game.photo=true; render(performance.now()); game.photo=false;
  cnv.toBlob(b=>{
    if (!b){ toast('The camera jammed — try again.'); return; }
    const a=document.createElement('a'), cal=calClock();
    a.href=URL.createObjectURL(b);
    a.download=`hortus-${cal.season.toLowerCase()}-y${cal.year}-d${cal.day}.png`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
  toast('Photo taken — golden hour included.');
}
