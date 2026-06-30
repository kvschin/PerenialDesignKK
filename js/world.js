'use strict';
/* ---------- world / state ---------- */
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
  startTs:Date.now(), elapsedMs:0, dayOffset:0, clockSuspended:false,
  px:15, py:15, tx:15, ty:15, moving:false, moveT:0, fromX:15, fromY:15,
  moveDur:170, pathTarget:null, sleepOnArrive:false,
  house:null, houseT:0,                              // per-garden house + sync stamp
  rot:0,                                             // view rotation, 90-degree steps
  hoverTile:null,                                    // pointer tile, for the house ghost
  focusPlantKey:null,                                // plant card focus, used for shrub footprint outlines
  worldId:null, worldName:'My garden',               // current solo save slot
  gameMode:'story',                                  // 'story' (avatar) | 'design' (direct)
  visiting:false,                                    // Visit Gardens: read-only avatar stroll of a loaded garden
  design:null,                                       // design-garden answers {zone,type,nativesOnly,deer,rabbit}
  drift:false,                                       // plant in clusters, Oudolf style
  freePlanting:false,                                // herbaceous plants can sit off the tile center
  eraseMode:'all',                                   // erase: all | plant | bulb | terrain
  eraseSize:1,                                       // erase brush diameter in tiles (odd)
  fx:[],                                             // short-lived planting pulses
  tool:'hand', toolVar:null,                         // active canvas tool or species + optional cultivar
  lastBrushTool:null, lastBrushVar:null,             // last placement brush chosen from the catalog
  lastBrushTrayCat:'grasses', lastBrushDrill:null, trayScroll:{}, // where the brush catalog was last browsed
  toolMenu:null,                                     // open flyout on the left canvas toolbar
  layerVis:{perennials:true,bulbs:true,woody:true,landscape:true,shade:false,night:false}, // layer view: visibility + overlays
  layerFocus:'all',                                  // active editable layer: all|perennials|bulbs|woody|landscape
  sel:null,                                          // committed selection rect {x0,y0,x1,y1} (world tiles, inclusive)
  selItems:null,                                     // payload the selection owns (snapshotted at marquee time)
  selMode:'move',                                    // selection drag intent: 'move' | 'copy'
  fillMode:false,                                    // bucket-fill: tap floods a connected same-material region
  shrubFx:[],                                        // short-lived footprint pulses when shrubs block placement
  houses:[],                                         // placed houses (multiple allowed); each {x,y,w,h,wall,roof,sizeFt}
  houseDraft:null,                                   // settings for the next house the House tool places
  fenceDraft:{style:'black',height:4,gate:false},    // settings for the next fence/gate tile
  lightDraft:{type:'path',tone:'warm'},               // settings for the next lighting tile
  firepitDraft:{shape:'round',size:'round36'},        // settings for the next fire pit footprint
  pathColor:'warm',                                  // selected path swatch for new/repainted paths
  bedStyle:'soil',                                   // selected bed material for new/repainted beds
  waterStyle:'pond',                                 // selected water swatch for ponds/rivers/lakes
  trayCat:'grasses',                                 // active tool-tray category
  region:{eco:null, zone:null, nativesOnly:false},   // palette filter, persisted
  others:{},          // multiplayer presence
  pausedAt:0,
  lastDay:-1, dirty:false,
  rev:0,              // edit revision — bumped by every model mutation (see setTile/clearTile); undo watches it
};
// The mutable layers a garden is made of, enumerated once so undo, save/load,
// and multiplayer sync iterate this list instead of hand-listing all eight in
// six different places (a missed entry was a recurring bug — see the reverted
// `game.stock`). `array` marks the houses list (the rest are "x,y" maps);
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
  {k:'houses', array:true, sync:()=>pushHouse()},
];
const GAME_MAPS=GAME_LAYERS.filter(L=>!L.array);
// Single write paths for the layer maps, so the bookkeeping every edit needs —
// mark dirty for the renderer + bump the edit revision undo watches — can't be
// forgotten at a call site. setTile stores a value; clearTile writes the
// {removed} tombstone the erase/sync/merge paths expect. (Multiplayer sync
// still flushes at gesture end via the existing syncToolLayer/endSweep paths.)
function setTile(layer,key,val){ game[layer][key]=val; game.dirty=true; game.rev++; }
function clearTile(layer,key){ game[layer][key]={removed:true,t:Date.now()}; game.dirty=true; game.rev++; }
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
  if (P && (P.type==='shrub'||P.type==='tree')) return plantEstab(p); // woody: no cutback
  if (P && P.type==='bulb') return plantEstab(p)*bulbEnvelope(p.s);
  return plantEstab(p)*seasonEnvelope(p.s);
}
function shrubRadiusTiles(P){
  return isShrubDef(P) ? Math.max(0.45, ((P.spread||P.space||TILE_IN)/TILE_IN)/2) : 0;
}
function shrubClaimsTile(cx,cy,p,x,y,mature){
  const P=p && p.s ? plantDef(p.s,p.v) : p;
  if (!isShrubDef(P)) return x===cx && y===cy;
  if (x===cx && y===cy) return true;
  const est=p && p.s ? plantEstab(p) : 1;
  const r=shrubRadiusTiles(P)*(mature===false ? Math.max(0.35,est) : 1);
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
  const r=shrubRadiusTiles(P)*(mature===false ? Math.max(0.35,est) : 1);
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
  const direct=livePlantKeyAt(x,y);
  if (direct && direct!==ignore){
    const sh=shrubInfoFromKey(direct);
    if (sh) return sh;
  }
  for (const k in game.plants){ if (k===ignore) continue;
    const p=game.plants[k]; if (!p||p.removed) continue;
    if (!isShrubDef(plantDef(p.s,p.v))) continue;
    const [cx2,cy2]=k.split(',').map(Number);
    if (cx2===x && cy2===y) continue;
    const r=shrubRadiusTiles(plantDef(p.s,p.v));
    if (Math.abs(x-cx2)>Math.ceil(r) || Math.abs(y-cy2)>Math.ceil(r)) continue;
    if (shrubClaimsTile(cx2,cy2,p,x,y,true)) return {key:k,p,x:cx2,y:cy2,center:false};
  }
  return null;
}
function canPlaceShrubAt(x,y,np,opts){
  opts=opts||{};
  const P=plantDef(np.s,np.v);
  if (!isShrubDef(P)) return {ok:true};
  const ignore=opts.ignoreKey||null;
  for (const [xx,yy] of shrubFootprintTiles(x,y,np,true)){
    if (xx<0||yy<0||xx>=GW||yy>=GH) return {ok:false, reason:'plot'};
    if (inHouse(xx,yy) || isDoor(xx,yy)) return {ok:false, reason:'house'};
    if (fenceAt(xx,yy)) return {ok:false, reason:'fence'};
    if (lightAt(xx,yy)) return {ok:false, reason:'light'};
    if (firepitAt(xx,yy)) return {ok:false, reason:'firepit'};
    const terr=tileTerrain(xx,yy);
    if (terr==='path'||terr==='water') return {ok:false, reason:terr};
    const k=`${xx},${yy}`, p=game.plants[k];
    if (p && !p.removed && k!==ignore){
      if (shrubHedgeCompatible(np,p) && Math.hypot(xx-x,yy-y)>=0.95) continue;
      return {ok:false, reason:'plant'};
    }
    const other=shrubAt(xx,yy,{ignoreKey:ignore});
    if (other){
      if (shrubHedgeCompatible(np,other.p) && Math.hypot(other.x-x,other.y-y)>=0.95) continue;
      return {ok:false, reason:'shrub'};
    }
  }
  return {ok:true};
}
function clearBulbsUnderShrub(x,y,p){
  let n=0, now=Date.now();
  for (const [xx,yy] of shrubFootprintTiles(x,y,p,true)){
    const k=`${xx},${yy}`, b=game.bulbs[k];
    if (b && !b.removed){ game.bulbs[k]={removed:true,t:now}; n++; }
  }
  if (n){ game.dirty=true; syncBulbsOut(); }
  return n;
}
function shrubFootprintOverlapsRect(cx,cy,p,x,y,w,h){
  return shrubFootprintTiles(cx,cy,p,true).some(([xx,yy])=>xx>=x&&xx<x+w&&yy>=y&&yy<y+h);
}
function drawShrubFootprint(ctx,W,H,sh,mode,age){
  const p=sh && sh.p;
  if (!p || p.removed) return;
  const est=plantEstab(p);
  const P=plantDef(p.s,p.v), r=shrubRadiusTiles(P);
  let fill='rgba(35,52,31,0.075)', stroke='rgba(239,230,211,0.08)', dash=null, line=1;
  if (mode==='hover'){
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
/* bloom staggering: within a bloom season each species rises, peaks,
   and fades instead of switching on at the season line. Cool species
   peak early in the season, warm late, with a per-species nudge so a
   mixed bed rolls rather than blinks. */
function bloomLevel(key){
  const d=(((absDay()%DAYS_PER_SEASON)+DAYS_PER_SEASON)%DAYS_PER_SEASON)+calClock().frac;
  const P=PLANTS[key]||{};
  const centers={cool:5, mid:8, warm:11};
  const jit=(((key.charCodeAt(0)||0)+key.length)%5-2)*0.8;
  const c=(P.bloomDay!==undefined)?P.bloomDay:(centers[P.phen]||8)+jit;
  const t2=Math.max(0, 1-Math.abs(d-c)/7);
  return t2*t2*(3-2*t2);
}
/* trees throw shade as they establish; baby trees show a future canopy,
   but they don't block full-sun perennials until the canopy is meaningful. */
const SHADE_ACTIVE_ESTAB = 0.35;
const SHADE_MIN_RADIUS = 1.5;
const SHADE_ACTIVE_SCORE = 0.42;
const SHADE_FUTURE_SCORE = 0.18;
const SHADE_AREA_SCALE = Math.SQRT1_2; // length x width ~= half the former restricted area
/* Garden-space compass: north is y-1, south is y+1, east is x+1,
   west is x-1. View rotation changes the camera, not these directions.
   Kansas sun is modeled as a daily arc across the southern sky, so
   tree shade falls generally northward, with morning/evening drift. */
const DIRS = {N:[0,-1], E:[1,0], S:[0,1], W:[-1,0]};
const SUN_PATH = [
  {name:'morning',   sun:[0.72,0.70],  weight:0.25, len:1.20, width:0.44}, // SE sun -> NW shade
  {name:'midday',    sun:DIRS.S,       weight:0.40, len:0.88, width:0.56}, // S sun  -> N shade
  {name:'afternoon', sun:[-0.72,0.70], weight:0.35, len:1.25, width:0.46}, // SW sun -> NE shade
];
function canopyRadius(p){ const P=PLANTS[p.s];
  if (!P || P.type!=='tree') return 0;
  return (P.spread/TILE_IN/2)*plantEstab(p);
}
function treeShadeInfo(k,p){
  const P=PLANTS[p.s]; if (!P || P.type!=='tree') return null;
  const [tx2,ty2]=k.split(',').map(Number), r=canopyRadius(p), est=plantEstab(p);
  return {p,x:tx2,y:ty2,r,est,activePotential:est>=SHADE_ACTIVE_ESTAB && r>=SHADE_MIN_RADIUS};
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
  for (const sample of SUN_PATH){
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
function shadeInfoAt(x,y,includeFuture){
  let active=null, future=null;
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const sh=treeShadeInfo(k,p);
    if (!sh) continue;
    const reach=treeShadeReach(sh);
    if (Math.abs(x-sh.x)>reach || Math.abs(y-sh.y)>reach) continue;
    const score=treeShadeScore(sh,x,y);
    if (sh.activePotential && score>=SHADE_ACTIVE_SCORE){
      const hit=Object.assign({score,active:true},sh);
      if (!active || hit.score>active.score) active=hit;
    } else if (includeFuture && score>=SHADE_FUTURE_SCORE){
      const hit=Object.assign({score,active:false},sh);
      if (!future || hit.score>future.score) future=hit;
    }
  }
  return active||future;
}
function shadeAt(x,y){
  const sh=shadeInfoAt(x,y,false);
  return sh&&sh.p;
}
function tileSeed(x,y){ return (x*73856093 ^ y*19349663)>>>0; }

/* the starter walkway — a lazy Oudolf curve, seeded as ordinary path
   terrain when a world is created so the shovel can take it out like
   anything else the gardener lays down */
function seedWalkway(){
  for (let x=0;x<GW;x++){
    const c = Math.round(GH/2 + Math.sin(x*0.55)*2.2);
    [c,c-1].forEach(y=>{
      if (y<0||y>=GH) return;
      const k=`${x},${y}`;
      if (!game.terrain[k]) game.terrain[k]={k:'path',t:Date.now()};
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
function doorPos(h){ return h ? [h.x+((h.w-1)>>1), h.y+h.h] : [-1,-1]; }
function isDoor(x,y){
  for (const h of game.houses){ const [dx,dy]=doorPos(h); if (x===dx && y===dy) return true; }
  return false;
}
function fenceAt(x,y){ const f=game.fences[`${x},${y}`]; return (f&&!f.removed)?f:null; }
function fenceBlocks(x,y){ const f=fenceAt(x,y); return !!(f && !f.gate); }
function fenceNeighbor(x,y){ return x>=0 && y>=0 && x<GW && y<GH && !!fenceAt(x,y); }
function canStand(x,y){ return x>=0 && y>=0 && x<GW && y<GH && !inHouse(x,y) && !fenceBlocks(x,y) && !lightAt(x,y) && !firepitAt(x,y) && tileTerrain(x,y)!=='water'; }
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
  game.dirty=true;
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
function worldPointAt(sx,sy,W,H){
  return viewToWorld(...viewPointAt(sx,sy,W,H));
}
function tileAt(sx,sy,W,H){
  const [vx,vy]=viewPointAt(sx,sy,W,H);
  return viewToWorld(Math.round(vx), Math.round(vy));
}
function houseDrawDepth(h){
  const [dx,dy]=doorPos(h);
  return viewDepth(dx,dy)+0.05;
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
function drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,base,rs,terrObj){
  isoDiamondPath(ctx,sx,sy,0);
  ctx.fillStyle=base; ctx.fill();
  const top=toneColor(base,amb.snow?12:9), bottom=toneColor(base,-9);
  fillDiamondFace(ctx,sx,sy,[[sx,sy],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H/2]],top);
  fillDiamondFace(ctx,sx,sy,[[sx,sy+TILE_H/2],[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H],[sx-TILE_W/2,sy+TILE_H/2]],bottom);
  ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1;
  isoDiamondPath(ctx,sx,sy,0); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.moveTo(sx,sy+1); ctx.lineTo(sx+TILE_W/2-1,sy+TILE_H/2); ctx.stroke();
  if (amb.snow) return;
  ctx.save();
  if (terr==='bed'){
    const bs=bedStyle(terrObj&&terrObj.c);
    if (bs.texture==='gravel'){
      for (let i=0;i<10;i++){ ctx.beginPath();
        ctx.fillStyle=i%2?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.16)';
        ctx.ellipse(sx+(rs()-0.5)*34, sy+TILE_H/2+(rs()-0.5)*13, 1.2+rs()*1.2, 0.7+rs()*0.8, rs()*3,0,7); ctx.fill(); }
    } else if (bs.texture==='rock'){
      for (let i=0;i<6;i++){
        const ox=sx+(rs()-0.5)*32, oy=sy+TILE_H/2+(rs()-0.5)*12;
        ctx.fillStyle=i%2?'rgba(240,236,224,0.18)':'rgba(30,28,25,0.20)';
        ctx.beginPath(); ctx.ellipse(ox,oy,2.8+rs()*2.2,1.6+rs()*1.2,rs()*3,0,7); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.7; ctx.stroke();
      }
    } else if (bs.texture==='leaf'){
      const cols=['rgba(173,112,54,0.44)','rgba(91,56,31,0.42)','rgba(196,142,76,0.30)'];
      for (let i=0;i<7;i++){
        const ox=sx+(rs()-0.5)*32, oy=sy+TILE_H/2+(rs()-0.5)*12, a=rs()*Math.PI;
        ctx.fillStyle=cols[i%cols.length];
        ctx.beginPath(); ctx.ellipse(ox,oy,3.8,1.2,a,0,7); ctx.fill();
        ctx.strokeStyle='rgba(40,26,16,0.20)'; ctx.lineWidth=0.6;
        ctx.beginPath(); ctx.moveTo(ox-Math.cos(a)*3,oy-Math.sin(a)*1.1); ctx.lineTo(ox+Math.cos(a)*3,oy+Math.sin(a)*1.1); ctx.stroke();
      }
    } else if (bs.texture==='mulch'){
      ctx.strokeStyle='rgba(30,16,10,0.34)'; ctx.lineWidth=2;
      for (let i=0;i<8;i++){
        const ox=sx+(rs()-0.5)*32, oy=sy+TILE_H/2+(rs()-0.5)*12;
        ctx.beginPath(); ctx.moveTo(ox-3-rs()*2,oy); ctx.lineTo(ox+4+rs()*3,oy+(rs()-0.5)*4); ctx.stroke();
      }
    } else {
      ctx.fillStyle='rgba(18,11,7,0.16)';
      for (let i=0;i<5;i++){ ctx.beginPath();
        ctx.ellipse(sx+(rs()-0.5)*32, sy+TILE_H/2+(rs()-0.5)*12, 2.2+rs()*1.4, 0.8+rs()*0.9, rs()*3,0,7); ctx.fill(); }
      ctx.strokeStyle='rgba(239,230,211,0.05)';
      for (let i=0;i<2;i++){ ctx.beginPath();
        const ox=sx+(rs()-0.5)*28, oy=sy+TILE_H/2+(rs()-0.5)*11;
        ctx.moveTo(ox-4,oy); ctx.lineTo(ox+5,oy+(rs()-0.5)*2); ctx.stroke(); }
    }
  } else if (path){
    ctx.fillStyle='rgba(255,255,255,0.13)';
    for (let i=0;i<6;i++){ ctx.beginPath();
      ctx.ellipse(sx+(rs()-0.5)*34, sy+TILE_H/2+(rs()-0.5)*12, 1.3+rs()*1.2, 0.7+rs()*0.6, rs()*3,0,7); ctx.fill(); }
    ctx.fillStyle='rgba(0,0,0,0.12)';
    for (let i=0;i<3;i++){ ctx.beginPath();
      ctx.ellipse(sx+(rs()-0.5)*32, sy+TILE_H/2+(rs()-0.5)*10, 1.3,0.8,rs()*3,0,7); ctx.fill(); }
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

