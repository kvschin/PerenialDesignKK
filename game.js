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

/* ---------- tiny seeded RNG so each plant clump is unique but stable ---------- */
function mulberry(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------- procedural plant renderer ----------
   Draws a species at screen (x,y) given growth 0..1, season, and a stable seed. */
function drawPlant(ctx, x, y, key, growth, season, seed, sway, variant, bloomLvl, detail){
  const P = plantDef(key, variant), S = P.sea[season], rnd = mulberry(seed);
  // how far into its bloom window this species is (1 = forced full bloom,
  // used by tray icons / previews); gates and thins the flower pass
  const blv = bloomLvl!==undefined ? bloomLvl : (S.bloom ? bloomLevel(key) : 0);
  const blooming = !!S.bloom && blv>0.08;
  const H = P.h * (0.25 + 0.75*growth);
  const mature = growth > 0.55;
  ctx.save(); ctx.translate(x, y);
  // soft ground shadow (canopy-wide for woody plants)
  const shadowW = isShrubDef(P) ? shrubVisualCw(P) : P.cw;
  const shR = (shadowW ? shadowW*0.42 : 14)*growth + 6;
  drawSoftShadow(ctx,0,3,shR,shR*0.36+1.8,P.cw?0.19:0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(0, 3, shR*0.58, shR*0.16+1.2, 0, 0, 7); ctx.fill();

  const stemFor = (n)=> Math.max(3, Math.round(n * (0.4+0.6*growth)));

  if (P.form === 'bunchgrass'){
    const n = stemFor(13);
    for (let i=0;i<n;i++){
      const a = (i/(n-1)-0.5)*1.5 + (rnd()-0.5)*0.3;
      const len = H*(0.6+rnd()*0.45);
      const bx = Math.sin(a)*len*0.55 + sway*len*0.06;
      const by = -Math.cos(a*0.5)*len;
      ctx.strokeStyle = shade(S.fol, (rnd()-0.5)*24);
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo((rnd()-0.5)*6,0);
      ctx.quadraticCurveTo(bx*0.4, by*0.62, bx, by); ctx.stroke();
      if (S.seed && mature && i%2===0){ ctx.fillStyle=S.seed;
        ctx.beginPath(); ctx.ellipse(bx,by,2.1,3.4,a,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'vertgrass'){
    const n = stemFor(9);
    for (let i=0;i<n;i++){
      const ox=(rnd()-0.5)*12, len=H*(0.8+rnd()*0.25), tip=ox+sway*len*0.05;
      ctx.strokeStyle = shade(S.fol,(rnd()-0.5)*20); ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke();
      if (S.seed && mature){ ctx.fillStyle=S.seed;
        ctx.beginPath(); ctx.ellipse(tip,-len-4,2.6,9,sway*0.05,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'turkeyfoot'){ // big bluestem: very tall, 3-pronged tips
    const bn = stemFor(7); // low basal blades
    for (let i=0;i<bn;i++){ const a=(i/(bn-1)-0.5)*1.5, l=H*0.3;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
    const n = stemFor(8);
    for (let i=0;i<n;i++){
      const ox=(rnd()-0.5)*14, len=H*(0.78+rnd()*0.25), tip=ox+sway*len*0.07;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*22); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke();
      if (S.seed && mature && i%2===0){ // the turkey foot
        ctx.strokeStyle=S.seed; ctx.lineWidth=1.6;
        for (let p3=-1;p3<=1;p3++){ ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+p3*3.6, -len-6-(p3===0?2.5:0)); ctx.stroke(); }
      }
    }
  }
  else if (P.form === 'cloudgrass'){ // switchgrass: clump under an airy seed cloud
    const n = stemFor(11);
    for (let i=0;i<n;i++){ // arching blades
      const a=(i/(n-1)-0.5)*1.3+(rnd()-0.5)*0.2, len=H*0.55*(0.7+rnd()*0.4);
      const bx=Math.sin(a)*len*0.6+sway*len*0.05;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.4,-len*0.7,bx,-len); ctx.stroke();
    }
    const sn = stemFor(6), cloud=S.seed||(blooming?S.bloom:null);
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*10, len=H*(0.85+rnd()*0.2), tip=ox+sway*len*0.06;
      ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=1.1;
      ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len*0.92); ctx.stroke();
      if (cloud && mature){ ctx.fillStyle=cloud;
        for (let d2=0;d2<9;d2++){ ctx.beginPath();
          ctx.arc(tip+(rnd()-0.5)*15, -len*0.92+2-rnd()*11, 0.9, 0, 7); ctx.fill(); } }
    }
  }
  else if (P.form === 'oatgrass'){ // sideoats: spikelets hung along one side
    const n = stemFor(9);
    for (let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*1.4+(rnd()-0.5)*0.2, len=H*0.5*(0.6+rnd()*0.5);
      const bx=Math.sin(a)*len*0.55+sway*len*0.05;
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*24); ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.4,-len*0.6,bx,-len); ctx.stroke(); }
    const sn = stemFor(5), oat=S.seed||(blooming?S.bloom:null);
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*8, len=H*(0.8+rnd()*0.25), tip=ox+5+sway*len*0.05;
      ctx.strokeStyle=shade(S.fol,-10); ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.quadraticCurveTo(ox+2.5,-len*0.6,tip,-len); ctx.stroke();
      if (oat && mature){ ctx.fillStyle=oat;
        for (let s2=0;s2<6;s2++){ const f=0.45+s2*0.09;
          const px=ox*0.5+(tip-ox*0.5)*f-2.4, py=-len*f;
          ctx.beginPath(); ctx.ellipse(px,py,1.9,1.1,0.5,0,7); ctx.fill(); } }
    }
  }
  else if (P.form === 'fountaingrass'){ // pennisetum: arching blades with bottlebrush plumes
    const L=P.look||{}, n=stemFor(L.leaves||13);
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*(L.fan||1.9)+(rnd()-0.5)*0.18, len=H*(L.leafLen||0.54)*(0.7+rnd()*0.45);
      const bx=Math.sin(a)*len*0.78+sway*len*0.06, by=-len*(0.46+rnd()*0.18);
      ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*22); ctx.lineWidth=L.leafW||1.35;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.28,-len*0.72,bx,by); ctx.stroke();
    }
    const brush=(blooming?S.bloom:null)||S.seed, sn=stemFor(L.stems||6);
    for (let i=0;i<sn;i++){
      const a=(i/(sn-1)-0.5)*(L.fan||1.7)+(rnd()-0.5)*0.18, len=H*(0.74+rnd()*0.24);
      const tip=Math.sin(a)*len*0.62+sway*len*0.06, topY=-len*(0.68+rnd()*0.08);
      ctx.strokeStyle=shade(S.fol||brush,-18); ctx.lineWidth=1.05;
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
      ctx.quadraticCurveTo(tip*0.36,-len*0.58,tip,topY); ctx.stroke();
      if (brush && mature){
        ctx.fillStyle=brush;
        const br=L.brush||5.5, shown=blooming?Math.max(3,Math.ceil(7*blv)):5;
        for (let b=0;b<shown;b++){
          ctx.beginPath();
          ctx.ellipse(tip+(rnd()-0.5)*2,topY-b*2.1,br*0.38,br*0.22,a*0.5,0,7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'forestgrass'){ // Hakonechloa: low cascading ribbons for shade
    const L=P.look||{}, n=stemFor(L.leaves||16);
    for (let i=0;i<n;i++){
      const a=(i/(n-1)-0.5)*(L.fan||2.2)+(rnd()-0.5)*0.12, len=H*(L.leafLen||0.7)*(0.72+rnd()*0.34);
      const bx=Math.sin(a)*len*0.78+sway*len*0.04, by=-len*(0.28+rnd()*0.18);
      const col=shade(S.fol,(rnd()-0.5)*18);
      ctx.strokeStyle=col; ctx.lineWidth=L.leafW||2.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(bx*0.22,-len*0.72,bx,by); ctx.stroke();
      if (L.stripe){
        ctx.strokeStyle=shade(L.stripe,(rnd()-0.5)*12); ctx.lineWidth=Math.max(0.7,(L.leafW||2.2)*0.32);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,-1);
        ctx.quadraticCurveTo(bx*0.22,-len*0.72,bx,by); ctx.stroke();
      }
    }
    if (S.seed && mature){
      ctx.strokeStyle=shade(S.fol||S.seed,-18); ctx.lineWidth=0.85;
      for (let i=0;i<3;i++){ const ox=(rnd()-0.5)*10, len=H*(0.62+rnd()*0.16), tip=ox+sway*2;
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.quadraticCurveTo(ox,-len*0.5,tip,-len); ctx.stroke();
        ctx.fillStyle=S.seed; ctx.beginPath(); ctx.ellipse(tip,-len,1.2,3.8,0.2,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'cone' || P.form === 'globe' || P.form === 'spike' || P.form === 'umbel'){
    const L = P.look||{}; // per-species carriage: leafiness, wispiness, droop
    // basal foliage (skipped in seasons with no foliage color)
    if (S.fol){
      const fn = stemFor(L.leaves||8);
      ctx.strokeStyle = S.fol; ctx.lineWidth = L.leafW||1.8;
      ctx.lineCap = L.leafCap || 'round';
      if (L.leafStyle === 'willow'){
        const spread = L.leafSpread || 1.8, fan = L.leafFan || 0.42;
        for (let i=0;i<fn;i++){
          const u=fn>1 ? i/(fn-1) : 0.5, side=Math.sin((u-0.5)*Math.PI);
          const l=H*(L.leafLen||0.6)*(0.82+rnd()*0.32);
          const bx=(rnd()-0.5)*7, by=(rnd()-0.5)*3;
          const ex=bx+side*l*fan*spread+(rnd()-0.5)*2.5, ey=by-l*(0.68+rnd()*0.24);
          ctx.beginPath(); ctx.moveTo(bx,by);
          ctx.quadraticCurveTo(bx+side*l*0.18,by-l*0.42,ex,ey); ctx.stroke();
        }
        const crowns = stemFor(L.crowns||0);
        for (let c=0;c<crowns;c++){
          const cx=(rnd()-0.5)*16, cy=-H*(0.28+rnd()*0.42), n=L.crownLeaves||6;
          for (let j=0;j<n;j++){
            const a=(j/n)*Math.PI*2, ll=H*0.11*(0.75+rnd()*0.45);
            ctx.beginPath(); ctx.moveTo(cx,cy);
            ctx.lineTo(cx+Math.cos(a)*ll*0.8, cy+Math.sin(a)*ll*0.55); ctx.stroke();
          }
        }
      } else {
        for (let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*(L.leafLen||0.34);
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
      }
      ctx.lineCap = 'butt';
    }
    // flower stems
    const sn = stemFor(P.form==='spike'?(L.stems||7):(L.stems||6));
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*(L.stemSpread||14);
      const len=H*((L.lenBase||0.75)+rnd()*(L.lenJitter||0.3));
      const tx=ox+sway*len*0.05+(P.form==='spike'?(rnd()-0.5)*(L.wildLean||0):0);
      ctx.strokeStyle = P.stem || shade(S.fol,-18);
      ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(ox*0.4,0);
      ctx.quadraticCurveTo(ox,-len*0.55,tx,-len); ctx.stroke();
      if (S.fol && L.stemLeaves){
        const leafPairs = Math.max(1, Math.round(L.stemLeaves));
        ctx.strokeStyle = S.fol; ctx.lineWidth = L.stemLeafW || 1;
        ctx.lineCap = 'round';
        for (let lp=0; lp<leafPairs; lp++){
          const f=(lp+1)/(leafPairs+1), px=ox*0.35+(tx-ox*0.35)*f*0.75, py=-len*(0.18+f*0.54);
          const side=((lp+i)%2===0?-1:1), ll=(L.stemLeafLen||7)*(0.8+rnd()*0.35);
          ctx.beginPath(); ctx.moveTo(px,py);
          ctx.quadraticCurveTo(px+side*ll*0.45,py-ll*0.08,px+side*ll,py-ll*0.28);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      if (!mature) continue;
      const hx=tx, hy=-len;
      // bloom staggering: only the leading fraction of stems flower
      const headOn = blooming && i < Math.max(1, Math.ceil(sn*blv));
      if (P.form==='cone'){
        const headCount = Math.max(1, Math.round(L.heads||1));
        const headOffset = (n,total)=>{
          if (total<=1) return {x:0,y:0,s:1};
          const side=n-(total-1)/2, row=Math.abs(side);
          return {
            x:side*(L.headSpread||4)+(rnd()-0.5)*1.5,
            y:row*(L.headDrop||2)+rnd()*1.3,
            s:row<0.3 ? 1 : (L.sideHeadScale||0.84)*(0.88+rnd()*0.2)
          };
        };
        const drawConeHead = (cx,cy,sc)=>{
          const rays=L.rays||7, rl=(L.rayLen||6)*sc, dr=(L.droop===undefined?2.5:L.droop)*sc;
          const dw=(L.discW||3.2)*sc, dh=(L.discH||3.6)*sc, dy=(L.discY===undefined?-1:L.discY)*sc;
          const rw=(L.rayW||2.2)*sc;
          ctx.strokeStyle=S.bloom; ctx.lineWidth=rw; ctx.lineCap=L.rayCap||'round';
          for(let p=0;p<rays;p++){ const pa=p/rays*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(cx,cy);
            const ex=cx+Math.cos(pa)*rl, ey=cy+Math.sin(pa)*rl*0.75+dr;
            if (L.rayShape==='notched'){
              ctx.quadraticCurveTo(cx+Math.cos(pa)*rl*0.55,cy+Math.sin(pa)*rl*0.28+dr*0.45,ex,ey); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(ex,ey);
              ctx.lineTo(ex+Math.cos(pa+0.55)*1.5*sc,ey+Math.sin(pa+0.55)*1.1*sc); ctx.stroke();
            } else if (L.rayShape==='spoon'){
              ctx.quadraticCurveTo(cx+Math.cos(pa)*rl*0.45,cy+Math.sin(pa)*rl*0.25+dr*0.4,ex,ey); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(ex,ey,rw*0.72,rw*0.42,pa,0,7); ctx.fillStyle=S.bloom; ctx.fill();
            } else {
              ctx.lineTo(ex,ey); ctx.stroke();
            } }
          ctx.fillStyle=S.eye||'#b5651d';
          ctx.beginPath(); ctx.ellipse(cx,cy+dy,dw,dh,0,0,7); ctx.fill();
          ctx.lineCap='butt';
        };
        const drawSeedHead = (cx,cy,sc)=>{
          ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(cx,cy,(L.seedW||3)*sc,(L.seedH||3.8)*sc,0,0,7); ctx.fill();
        };
        if (headOn){
          for(let h=0; h<headCount; h++){ const o=headOffset(h,headCount); drawConeHead(hx+o.x,hy+o.y,o.s); }
        } else if (S.seed){
          const seedCount = Math.max(1, Math.round(L.seedHeads || Math.min(headCount,3)));
          for(let h=0; h<seedCount; h++){ const o=headOffset(h,seedCount); drawSeedHead(hx+o.x,hy+o.y,o.s); }
        }
      }
      else if (P.form==='globe'){
        const col = (headOn?S.bloom:null) || S.seed;
        if (col){ ctx.fillStyle=col;
          const hr = L.headR || (key==='allium'?5:4.2);
          const ghx = hx + (L.nod?4:0), ghy = hy + (L.nod?5:0);
          if (L.nod){
            ctx.strokeStyle=shade(S.fol||col,-25); ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.quadraticCurveTo(hx+2,hy+3,ghx,ghy-hr*0.45); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(ghx,ghy,hr,0,7); ctx.fill();
          ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7;
          const spokes=L.spokes||6;
          for(let p=0;p<spokes;p++){ const pa=p/spokes*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(ghx,ghy);
            ctx.lineTo(ghx+Math.cos(pa)*hr*1.3,ghy+Math.sin(pa)*hr*1.3); ctx.stroke(); }
          if (L.topknot){
            ctx.fillStyle=L.topknot;
            ctx.beginPath(); ctx.ellipse(ghx, ghy-hr*1.15, hr*0.42, hr*0.28, 0, 0, 7); ctx.fill();
          } }
      }
      else if (P.form==='umbel'){ // flat-to-domed corymb of tiny florets
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){ ctx.fillStyle=col;
          const rad=L.head||6, dome=(L.dome===undefined?0.4:L.dome), dots=Math.round(rad*2);
          for(let d2=0;d2<dots;d2++){ const a2=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*rad;
            ctx.beginPath();
            ctx.ellipse(hx+Math.cos(a2)*rr, hy-rad*dome*0.5-Math.sin(a2)*rr*dome, 1.5,1.3,0,0,7);
            ctx.fill(); } }
      }
      else { // spike
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){
          if (L.spikeStyle==='liatris'){
            const spikeLen=L.spikeLen||18, florets=Math.max(3,Math.round(L.florets||8));
            const dense=L.dense||1, capW=L.capW||2.3, capH=L.capH||2.8;
            for(let s=0;s<florets;s++){
              const u=florets>1?s/(florets-1):0, yy=hy+u*spikeLen;
              const side=(s%2?-1:1), xx=hx+side*(L.zigzag||1.1)*(0.55+rnd())+(rnd()-0.5)*(L.ragged||1.4);
              ctx.fillStyle=shade(col,(rnd()-0.5)*18);
              ctx.beginPath(); ctx.ellipse(xx,yy,capW*(0.85+rnd()*0.3),capH*(0.85+rnd()*0.3),0,0,7); ctx.fill();
              if (blooming && L.fuzz){
                ctx.strokeStyle=shade(col,20); ctx.lineWidth=0.65; ctx.lineCap='round';
                for(let f=0;f<Math.max(1,Math.round(dense));f++){
                  const a=(rnd()-0.5)*Math.PI;
                  ctx.beginPath(); ctx.moveTo(xx,yy);
                  ctx.lineTo(xx+Math.cos(a)*L.fuzz,yy+Math.sin(a)*L.fuzz); ctx.stroke();
                }
                ctx.lineCap='butt';
              }
            }
          } else {
            ctx.fillStyle=col;
            for(let s=0;s<5;s++){ ctx.beginPath();
              ctx.ellipse(hx+(rnd()-0.5)*1.5, hy+s*3.2, 1.8,2.2,0,0,7); ctx.fill(); }
          }
        }
      }
    }
  }
  else if (P.form === 'bractstack'){ // spotted bee balm: stacked bracts with small spotted tubes
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||8);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.4;
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.45+(rnd()-0.5)*0.22, l=H*(L.leafLen||0.32)*(0.7+rnd()*0.4);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.48,Math.sin(a)*l,-l*0.62); ctx.stroke();
      }
    }
    const sn=stemFor(L.stems||4);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*12, len=H*(0.78+rnd()*0.2), tip=ox+sway*len*0.04;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-18); ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.55,tip,-len); ctx.stroke();
      if (!mature) continue;
      const tiers=L.tiers||3, shown=blooming?Math.max(1,Math.ceil(tiers*blv)):tiers;
      for(let tr=0;tr<shown;tr++){
        const y=-len*(0.42+tr*0.15), w=(L.bractW||8)*(1-tr*0.12), br=(S.bract||S.bloom||S.seed);
        if (br){
          ctx.fillStyle=shade(br,(rnd()-0.5)*16);
          for(let b=-2;b<=2;b++){
            ctx.beginPath(); ctx.ellipse(tip+b*w*0.28,y+(Math.abs(b)%2)*1.5,w*0.22,2.1,b*0.2,0,7); ctx.fill();
          }
        }
        const col=(blooming?S.bloom:null)||S.seed;
        if (col){
          ctx.fillStyle=col;
          for(let f=0;f<5;f++){
            ctx.beginPath(); ctx.ellipse(tip+(rnd()-0.5)*w,y-2-rnd()*3,1.2,1.8,0,0,7); ctx.fill();
          }
          if (blooming && S.eye){
            ctx.fillStyle=S.eye;
            for(let d=0;d<3;d++){ ctx.beginPath(); ctx.arc(tip+(rnd()-0.5)*w,y-2-rnd()*3,0.45,0,7); ctx.fill(); }
          }
        }
      }
    }
  }
  else if (P.form === 'pincushion'){ // scabiosa: wiry stems and pincushion disks
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||7);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.1;
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.7+(rnd()-0.5)*0.2, l=H*(L.leafLen||0.3);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.5,Math.sin(a)*l,-l*0.52); ctx.stroke();
      }
    }
    const sn=stemFor(L.stems||7);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*16, len=H*(0.72+rnd()*0.32), tip=ox+sway*len*0.08;
      ctx.strokeStyle=shade(S.fol||S.seed||'#6b6248',-18); ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(ox*0.3,0); ctx.quadraticCurveTo(ox,-len*0.56,tip,-len); ctx.stroke();
      if (!mature) continue;
      const headOn=blooming && i < Math.max(1,Math.ceil(sn*blv));
      const col=(headOn?S.bloom:null)||S.seed;
      if (col){
        const r=L.headR||4.6;
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.ellipse(tip,-len,r,r*0.78,0,0,7); ctx.fill();
        ctx.strokeStyle=shade(col,-25); ctx.lineWidth=0.7;
        for(let p=0;p<8;p++){ const pa=p/8*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(tip,-len);
          ctx.lineTo(tip+Math.cos(pa)*r*1.1,-len+Math.sin(pa)*r*0.82); ctx.stroke(); }
        if (headOn && S.eye){
          ctx.fillStyle=S.eye;
          for(let d=0;d<6;d++){ ctx.beginPath(); ctx.arc(tip+(rnd()-0.5)*r,-len+(rnd()-0.5)*r*0.7,0.55,0,7); ctx.fill(); }
        }
      }
    }
  }
  else if (P.form === 'pyramid'){ // Scilla peruviana: low straps below a dense pyramidal raceme
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||9);
      ctx.strokeStyle=S.fol; ctx.lineWidth=L.leafW||1.7;
      for(let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.45+(rnd()-0.5)*0.18, l=H*(L.leafLen||0.42)*(0.7+rnd()*0.35);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.35,-l*0.5,Math.sin(a)*l*0.75,-l); ctx.stroke();
      }
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed;
      const stems=Math.max(1,L.stems||1), dots=L.dots||28;
      for(let st=0;st<stems;st++){
        const ox=(st-(stems-1)/2)*5+(rnd()-0.5)*2, len=H*(0.74+rnd()*0.12);
        const topY=-len, baseY=-len*0.38, headW=L.headW||11;
        ctx.strokeStyle=shade(S.fol||col,-22); ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.lineTo(ox+sway*1.5,topY); ctx.stroke();
        ctx.fillStyle=col;
        const shown=blooming?Math.max(5,Math.ceil(dots*blv)):Math.max(8,Math.ceil(dots*0.55));
        for(let d=0;d<shown;d++){
          const f=rnd(), rowY=baseY+(topY-baseY)*f, w=headW*(1-f)*0.9+2;
          ctx.beginPath();
          ctx.arc(ox+sway*1.5+(rnd()-0.5)*w, rowY+(rnd()-0.5)*2, 1.25, 0, 7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'drumstick'){ // burnet: small buttons bobbing on wiry stems
    const L = P.look||{};
    if (S.fol){ const fn=stemFor(7); // low pinnate basal foliage
      ctx.strokeStyle=S.fol; ctx.lineWidth=1.3;
      for(let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*0.26;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); } }
    const sn=stemFor(L.stems||7);
    for(let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*17, len=H*(0.65+rnd()*0.4), tip=ox+sway*len*0.09;
      ctx.strokeStyle=shade(S.fol||'#6b6248',-14); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ox*0.3,0); ctx.quadraticCurveTo(ox,-len*0.6,tip,-len); ctx.stroke();
      if (!mature) continue;
      const headOn = blooming ? (i < Math.max(1,Math.ceil(sn*blv))) : false;
      const col=(headOn?S.bloom:null)||S.seed;
      if (col){ ctx.fillStyle=col;
        const bw=L.button||1.8, bl=L.buttonLen||3.2;
        ctx.beginPath(); ctx.ellipse(tip,-len-bl*0.4,bw,bl,sway*0.12,0,7); ctx.fill(); }
    }
  }
  else if (P.form === 'archbell'){ // Solomon's seal: arched stems, alternating leaves, pendant bells
    const L=P.look||{}, sn=stemFor(L.stems||4);
    for (let i=0;i<sn;i++){
      const ox=(i/(sn-1)-0.5)*12+(rnd()-0.5)*2;
      const len=H*(0.72+rnd()*0.18), tip=ox+12+sway*len*0.04;
      const ctrlX=ox+4+sway*2, ctrlY=-len*0.72;
      const stemCol=shade(S.fol||S.seed||'#6b6248',-18);
      ctx.strokeStyle=stemCol; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(ox,0);
      ctx.quadraticCurveTo(ctrlX,ctrlY,tip,-len*0.55); ctx.stroke();
      const bez=(f)=>{
        const u=1-f;
        return [u*u*ox+2*u*f*ctrlX+f*f*tip, 2*u*f*ctrlY+f*f*(-len*0.55)];
      };
      if (S.fol){
        const leaves=L.leaves||8;
        for (let j=0;j<leaves;j++){
          const f=0.12+j/(leaves+1)*0.74, side=j%2?-1:1, p=bez(f);
          ctx.fillStyle=shade(S.fol,(rnd()-0.5)*22);
          ctx.beginPath();
          ctx.ellipse(p[0]+side*4, p[1]+1.5, 5.2, 1.8, side*0.45, 0, 7); ctx.fill();
        }
      }
      if (mature && ((blooming&&S.bloom)||S.seed)){
        const headOn = blooming && i < Math.max(1, Math.ceil(sn*blv));
        const bells=headOn ? Math.max(2,Math.ceil((L.bells||5)*blv)) : (S.seed?Math.min(4,L.bells||5):0);
        ctx.fillStyle=(headOn?S.bloom:null)||S.seed;
        for (let b=0;b<bells;b++){
          const f=0.36+b*0.1, p=bez(f);
          ctx.beginPath();
          ctx.ellipse(p[0]+3, p[1]+4, headOn?2.1:1.8, headOn?3.3:2.1, -0.2, 0, 7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'martagon'){ // martagon lily: whorled leaves and recurved, nodding bells
    const L=P.look||{}, stemCol=shade(S.fol||S.seed||'#6b6248',-18);
    const sn=Math.max(1,L.stems||1);
    for(let st=0;st<sn;st++){
      const ox=(st-(sn-1)/2)*7+(rnd()-0.5)*2, len=H*(0.9+rnd()*0.08), tip=ox+sway*len*0.03;
      ctx.strokeStyle=stemCol; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox+sway*1.5,-len*0.48,tip,-len); ctx.stroke();
      if (S.fol){
        const whorls=L.whorls||4;
        for(let w=0;w<whorls;w++){
          const wy=-len*(0.18+w*0.14), leaves=5+(w%2);
          for(let j=0;j<leaves;j++){
            const a=j/leaves*Math.PI*2+(w*0.4), r=5.5-rnd()*1.2;
            ctx.fillStyle=shade(S.fol,(rnd()-0.5)*22);
            ctx.beginPath();
            ctx.ellipse(ox+Math.cos(a)*r, wy+Math.sin(a)*r*0.35, 4.5, 1.5, a*0.4, 0, 7); ctx.fill();
          }
        }
      }
      if (mature && ((blooming&&S.bloom)||S.seed)){
        const flowers=blooming?Math.max(1,Math.ceil((L.flowers||5)*blv)):Math.min(4,L.flowers||5);
        for(let f=0;f<flowers;f++){
          const side=f%2?-1:1, fy=-len*(0.72+f*0.045), fx=tip+side*(3+rnd()*3);
          ctx.strokeStyle=stemCol; ctx.lineWidth=0.9;
          ctx.beginPath(); ctx.moveTo(tip,fy-4); ctx.quadraticCurveTo(fx,fy-2,fx,fy+2); ctx.stroke();
          if (blooming && S.bloom){
            ctx.strokeStyle=S.bloom; ctx.lineWidth=1.8;
            for(let p=0;p<6;p++){
              const a=p/6*Math.PI*2;
              ctx.beginPath(); ctx.moveTo(fx,fy);
              ctx.quadraticCurveTo(fx+Math.cos(a)*3,fy+Math.sin(a)*2,fx+Math.cos(a)*4.6,fy+Math.sin(a)*4.2-2);
              ctx.stroke();
            }
            if (S.eye){ ctx.fillStyle=S.eye;
              ctx.beginPath(); ctx.arc(fx,fy,1.2,0,7); ctx.fill(); }
          } else if (S.seed){
            ctx.fillStyle=S.seed;
            ctx.beginPath(); ctx.ellipse(fx,fy,1.6,3.2,0,0,7); ctx.fill();
          }
        }
      }
    }
  }
  else if (P.form === 'rosette'){ // yucca: evergreen sword-leaf crown + bell tower
    const L=P.look||{};
    if (S.fol){
      const n=stemFor(L.leaves||18), baseLen=H*(L.leafLen||0.5), lw=L.leafW||2.8;
      ctx.lineCap='round';
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*2.35+(rnd()-0.5)*0.18;
        const len=baseLen*(0.72+rnd()*0.36), bx=Math.sin(a)*len*0.82+sway*len*0.025;
        const by=-Math.cos(a*0.45)*len*0.62;
        if (S.edge){
          ctx.strokeStyle=shade(S.edge,(rnd()-0.5)*12); ctx.lineWidth=lw+2.2;
          ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,0);
          ctx.quadraticCurveTo(bx*0.34,by*0.55,bx,by); ctx.stroke();
        }
        ctx.strokeStyle=shade(S.fol,(rnd()-0.5)*18); ctx.lineWidth=lw;
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*3,0);
        ctx.quadraticCurveTo(bx*0.34,by*0.55,bx,by); ctx.stroke();
        if (L.filaments && i%3===0){
          ctx.strokeStyle='rgba(239,230,211,0.55)'; ctx.lineWidth=0.55;
          ctx.beginPath(); ctx.moveTo(bx*0.72,by*0.78);
          ctx.quadraticCurveTo(bx*0.88+2,by*0.88+2,bx+1.8,by+4); ctx.stroke();
        }
      }
      ctx.lineCap='butt';
    }
    if (mature && (blooming || S.seed)){
      const sn=Math.max(1,L.stems||1), bells=L.bells||7;
      for (let st=0;st<sn;st++){
        const ox=(st-(sn-1)/2)*5+(rnd()-0.5)*2, len=H*(0.86+rnd()*0.1);
        const tip=ox+sway*len*0.025;
        ctx.strokeStyle=shade(S.fol||'#7d8f80',-24); ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.55,tip,-len); ctx.stroke();
        if (blooming && S.bloom){
          ctx.fillStyle=S.bloom;
          const shown=Math.max(2,Math.ceil(bells*blv));
          for (let b=0;b<shown;b++){
            const side=b%2?-1:1, py=-len*(0.35+b*0.065), px=tip+side*(3+rnd()*2);
            ctx.beginPath(); ctx.ellipse(px,py,2.3,4.1,side*0.35,0,7); ctx.fill();
            ctx.fillStyle=shade(S.bloom,-12);
            ctx.beginPath(); ctx.ellipse(px,py+2.2,1.6,1.0,0,0,7); ctx.fill();
            ctx.fillStyle=S.bloom;
          }
        } else if (S.seed){
          ctx.fillStyle=S.seed;
          for (let b=0;b<Math.min(5,bells);b++){
            const side=b%2?-1:1, py=-len*(0.38+b*0.08), px=tip+side*3;
            ctx.beginPath(); ctx.ellipse(px,py,1.8,3.2,side*0.2,0,7); ctx.fill();
          }
        }
      }
    }
  }
  else if (P.form === 'shrub'){
    const L=P.look||{}, habit=L.habit||'mound', fol=S.fol||'#6f8f5a';
    const leafDot=(px,py,w,h,a,col)=>{
      ctx.fillStyle=shade(col||fol,(rnd()-0.5)*26);
      ctx.beginPath(); ctx.ellipse(px,py,w,h,a,0,7); ctx.fill();
    };
    if (S.fol){
      ctx.save(); ctx.globalAlpha=0.20; ctx.fillStyle=shade(fol,-25);
      const sw=L.shadowW||18, sh=L.shadowH||H*0.24, sy=L.shadowY||-H*0.40;
      ctx.beginPath(); ctx.ellipse(sway, sy, sw*(0.5+0.5*growth), sh, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (S.fol && habit==='threadleaf'){
      const stems=stemFor(L.stems||22);
      ctx.strokeStyle=fol; ctx.lineWidth=L.leafW||0.82; ctx.lineCap='round';
      for(let i=0;i<stems;i++){
        const a=(i/(stems-1)-0.5)*(L.spread||2.2)+(rnd()-0.5)*0.18;
        const len=H*(0.45+rnd()*0.45), bx=(rnd()-0.5)*7;
        const tx=Math.sin(a)*len*0.58+sway*len*0.035, ty=-len;
        ctx.beginPath(); ctx.moveTo(bx,0);
        ctx.quadraticCurveTo(bx+Math.sin(a)*len*0.18,-len*0.48,tx,ty); ctx.stroke();
        if (i%3===0){
          ctx.strokeStyle=shade(fol,14);
          ctx.beginPath(); ctx.moveTo(tx,ty);
          ctx.lineTo(tx+(rnd()-0.5)*5,ty-3-rnd()*5); ctx.stroke();
          ctx.strokeStyle=fol;
        }
      }
      ctx.lineCap='butt';
    } else if (S.fol && habit==='broadamsonia'){
      const stems=stemFor(L.stems||12);
      for(let i=0;i<stems;i++){
        const ox=(rnd()-0.5)*13, len=H*(0.55+rnd()*0.35), tx=ox+sway*1.6;
        ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.35,0); ctx.quadraticCurveTo(ox,-len*0.52,tx,-len); ctx.stroke();
        const leaves=L.leaves||5;
        for(let j=0;j<leaves;j++){
          const f=(j+1)/(leaves+1), side=j%2?-1:1, px=ox+(tx-ox)*f*0.7, py=-len*(0.18+f*0.64);
          leafDot(px+side*(3+rnd()*2),py,4.2,2.6,side*0.35,fol);
        }
      }
    } else if (S.fol && habit==='baptisia'){
      const stems=stemFor(L.stems||11), baseW=L.baseW||18;
      for(let i=0;i<stems;i++){
        const ox=(i/(stems-1)-0.5)*baseW+(rnd()-0.5)*2.5, len=H*(0.68+rnd()*0.23);
        const tx=ox*0.45+(rnd()-0.5)*6+sway*1.5;
        ctx.strokeStyle=P.stem||shade(fol,-25); ctx.lineWidth=1.8;
        ctx.beginPath(); ctx.moveTo(ox,2); ctx.quadraticCurveTo(ox*0.7,-len*0.42,tx,-len); ctx.stroke();
        const whorls=L.leafWhorls||4;
        for(let w=0;w<whorls;w++){
          const f=0.42+w/(whorls+0.2)*0.50, px=ox+(tx-ox)*f, py=-len*f;
          for(let l=0;l<3;l++){
            const aa=(-0.9+l*0.9)+(rnd()-0.5)*0.18, side=Math.sin(aa);
            leafDot(px+side*(4.6+rnd()*1.6),py-Math.cos(aa)*2,3.8,2.5,aa,fol);
          }
        }
      }
    } else {
      const n = stemFor(L.leaves||26);
      const wide=L.foliageW||16, high=L.foliageH||0.55, leafW=L.leafW||3.4, leafH=L.leafH||2.6;
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=rnd();
        const px=Math.cos(a)*wide*r*(0.5+0.5*growth)+sway*2;
        const py=-H*high*(0.25+rnd()*0.75);
        leafDot(px,py,leafW,leafH,a,fol);
      }
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed;
      const m0=stemFor(L.flowerStems||7), m=S.bloom&&!S.seed ? Math.max(1,Math.ceil(m0*blv)) : m0;
      for (let i=0;i<m;i++){
        const ox=(rnd()-0.5)*(L.flowerW||20), len=H*((L.flowerLen||0.85)+rnd()*(L.flowerJitter||0.2));
        ctx.strokeStyle=shade(fol,-25); ctx.lineWidth=habit==='baptisia'?1.5:1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=col;
        if (habit==='baptisia'&&season==='Spring'){
          const pods=S.seed&&!blooming, count=pods?3:(L.raceme||6);
          for(let s=0;s<count;s++){
            ctx.beginPath();
            ctx.ellipse(ox+sway*2+(s%2?-1.8:1.8),-len+s*3.3,pods?2.1:2.0,pods?3.1:2.4,0,0,7); ctx.fill();
          }
        }
        else if ((habit==='threadleaf'||habit==='broadamsonia')&&season==='Spring'){
          for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
            ctx.beginPath(); ctx.ellipse(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3,1.3,0,0,7); ctx.fill(); }
        }
        else if (habit==='asterdome'||habit==='asterupright'||habit==='asterclean'){
          const heads=habit==='asterdome'?3:(habit==='asterclean'?2:1), rad=habit==='asterupright'?3.0:2.4;
          for(let h=0;h<heads;h++){
            const hx=ox+sway*2+(h-(heads-1)/2)*4, hy=-len+rnd()*3;
            ctx.beginPath(); ctx.arc(hx,hy,rad,0,7); ctx.fill();
            if (S.eye){ ctx.fillStyle=S.eye; ctx.beginPath(); ctx.arc(hx,hy,rad*0.35,0,7); ctx.fill(); ctx.fillStyle=col; }
          }
        }
        else { ctx.beginPath(); ctx.arc(ox+sway*2,-len,key==='mountainmint'?3.4:2.6,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'bulbcup'){ // crocus/tulip/daffodil: straps and cups
    const L2=P.look||{};
    if (S.fol){
      const n=stemFor(5);
      ctx.strokeStyle=S.fol; ctx.lineWidth=1.4;
      for (let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*1.2+(rnd()-0.5)*0.2, l=H*(0.5+rnd()*0.4);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.5,-l*0.6,Math.sin(a)*l*0.8,-l); ctx.stroke(); }
    }
    if (blooming){
      const sn=Math.max(1,Math.ceil((L2.stems||3)*blv)), cup=L2.cup||3;
      for (let i=0;i<sn;i++){
        const ox=(rnd()-0.5)*8, len=H*(0.7+rnd()*0.3);
        ctx.strokeStyle=shade(S.fol,-12); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway,-len); ctx.stroke();
        ctx.strokeStyle=S.bloom; ctx.lineWidth=1.8;
        for (let p2=-1;p2<=1;p2++){ ctx.beginPath();
          ctx.moveTo(ox+sway,-len);
          ctx.lineTo(ox+sway+p2*cup*0.8,-len-cup*1.6); ctx.stroke(); }
        if (S.eye){ ctx.fillStyle=S.eye;
          ctx.beginPath(); ctx.arc(ox+sway,-len-cup*0.5,cup*0.45,0,7); ctx.fill(); }
      }
    }
  }
  else if (P.form === 'waterleaf'){ // lotus / water lily: pads ride flat on the water
    const L=P.look||{}, fol=S.fol||'#5f7f55';
    const pads=stemFor(L.pads||6), padW=L.padW||16, padH=L.padH||9;
    if (S.fol){
      for (let i=0;i<pads;i++){
        const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*(L.upright?13:18);
        const px=Math.cos(a)*rr+sway*0.8, py=-4+Math.sin(a)*rr*0.35;
        ctx.fillStyle=shade(fol,(rnd()-0.5)*20);
        ctx.beginPath(); ctx.ellipse(px,py,padW*(0.65+rnd()*0.25),padH*(0.65+rnd()*0.25),rnd()*0.4,0,7); ctx.fill();
        ctx.fillStyle='rgba(25,40,25,0.16)';
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+padW*0.45,py-padH*0.12); ctx.lineTo(px+padW*0.12,py+padH*0.16); ctx.closePath(); ctx.fill();
      }
    }
    if (blooming && mature && S.bloom){
      const flowers=Math.max(1,Math.ceil((L.flower==='lotus'?2:3)*blv));
      for (let f=0;f<flowers;f++){
        const px=(rnd()-0.5)*22+sway, py=-(L.upright?H*0.50:10)-rnd()*8;
        if (L.upright){
          ctx.strokeStyle=shade(fol,-18); ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(px*0.25,0); ctx.lineTo(px,py+5); ctx.stroke();
        }
        for (let p=0;p<8;p++){
          const a=p/8*Math.PI*2, pet=L.flower==='lotus'?5.5:4.4;
          ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*12);
          ctx.beginPath(); ctx.ellipse(px+Math.cos(a)*pet*0.55,py+Math.sin(a)*pet*0.28,pet*0.42,pet*0.72,a,0,7); ctx.fill();
        }
        ctx.fillStyle=L.flower==='lotus'?'#caa45d':'#d7b85a';
        ctx.beginPath(); ctx.arc(px,py,2.2,0,7); ctx.fill();
      }
    }
    if (S.seed && mature){
      const pods=L.seedPods||2;
      ctx.fillStyle=S.seed;
      for (let i=0;i<pods;i++){
        const px=(rnd()-0.5)*22, py=-(L.upright?H*0.45:8)-rnd()*8;
        if (L.upright){ ctx.strokeStyle=shade(fol,-22); ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.moveTo(px*0.25,0); ctx.lineTo(px,py+4); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(px,py,3.6,2.6,0,0,7); ctx.fill();
      }
    }
  }
  else if (P.form === 'fern'){ // arching fronds, leaflets tapering to the tip
    if (S.fol){
      const n=stemFor(9);
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*1.9+(rnd()-0.5)*0.2;
        const len=H*(0.65+rnd()*0.4);
        const p1x=Math.sin(a)*len*0.8+sway*len*0.06, p1y=-Math.cos(a*0.55)*len;
        const cxc=p1x*0.35, cyc=p1y*0.7;
        const col=shade(S.fol,(rnd()-0.5)*22);
        ctx.strokeStyle=col; ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(cxc,cyc,p1x,p1y); ctx.stroke();
        ctx.fillStyle=col;
        for (let f=0.25;f<=0.95;f+=0.14){ // leaflets along the rachis
          const u=1-f;
          const bx=2*u*f*cxc+f*f*p1x, by=2*u*f*cyc+f*f*p1y;
          ctx.beginPath(); ctx.ellipse(bx,by,(1-f)*4.2+0.8,1.1,a*0.5,0,7); ctx.fill();
        }
      }
    }
    if (S.seed && (mature||!S.fol)){ // ostrich fern's stiff fertile fronds hold all winter
      ctx.strokeStyle=S.seed; ctx.lineWidth=1.8;
      for (let i=0;i<3;i++){ const ox=(rnd()-0.5)*6;
        ctx.beginPath(); ctx.moveTo(ox,0); ctx.lineTo(ox+sway*2,-H*(0.5+rnd()*0.2)); ctx.stroke(); }
    }
  }
  else if (P.form === 'leafmound'){ // hosta: broad overlapping leaves, scapes above
    if (S.fol){
      const n=stemFor(11);
      for (let i=0;i<n;i++){
        const a=(i/(n-1)-0.5)*2.4+(rnd()-0.5)*0.25;
        const l=H*0.62*(0.6+rnd()*0.45);
        const lx=Math.sin(a)*l, ly=-Math.cos(a*0.5)*l*0.7;
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*26);
        ctx.beginPath();
        ctx.ellipse(lx*0.7+sway, ly*0.8, l*0.42, l*0.24, Math.atan2(ly,lx), 0, 7);
        ctx.fill();
      }
    }
    if (blooming && mature){
      ctx.strokeStyle=shade(S.fol||'#6f8f5a',-18); ctx.lineWidth=1.1;
      const m=Math.max(1,Math.ceil(3*blv));
      for (let i=0;i<m;i++){ const ox=(rnd()-0.5)*10, len=H*(1.0+rnd()*0.2);
        ctx.beginPath(); ctx.moveTo(ox*0.4,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=S.bloom;
        for (let s2=0;s2<4;s2++){ ctx.beginPath();
          ctx.ellipse(ox+sway*2+(rnd()-0.5)*2,-len+s2*2.8,1.5,2,0,0,7); ctx.fill(); } }
    }
  }
  else if (P.form === 'tree'){ // deciduous: trunk + branches always, canopy by season
    const L=P.look||{};
    const cw=(P.cw||100)*(L.cwMul||1)*(0.3+0.7*growth), trunkH=H*(L.trunkH||0.42);
    const cy=-trunkH-H*(L.canopyY||0.30); // canopy center
    ctx.strokeStyle=L.bark||'#5e4a38'; ctx.lineCap='round';
    const trunks=Math.max(1,L.trunks||1), trunkW=Math.max(2,(L.trunkW||6)*growth);
    for (let tr=0;tr<trunks;tr++){
      const spread=(tr-(trunks-1)/2)*(L.trunkSpread||7)*(0.5+growth*0.5);
      const lean=(tr-(trunks-1)/2)*(L.trunkLean||2.5);
      ctx.lineWidth=trunkW*(trunks>1?0.72:1);
      ctx.beginPath(); ctx.moveTo(spread,0);
      ctx.quadraticCurveTo(spread*0.55,-trunkH*0.42,sway*2+lean,-trunkH); ctx.stroke();
      if (L.barkStripe){
        ctx.strokeStyle=L.barkStripe; ctx.lineWidth=Math.max(0.7,trunkW*0.16);
        for(let bs=0;bs<3;bs++){ ctx.beginPath();
          const y=-trunkH*(0.18+bs*0.22);
          ctx.moveTo(spread-2,y); ctx.lineTo(spread+3,y-1); ctx.stroke(); }
        ctx.strokeStyle=L.bark||'#5e4a38';
      }
    }
    const tips=[];
    ctx.lineWidth=Math.max(1.2, (L.branchW||2.2)*growth);
    const branchN=L.branches||5;
    for (let i=0;i<branchN;i++){
      const a=(i/(branchN-1)-0.5)*(L.branchSpread||1.7)+(rnd()-0.5)*0.2;
      const bx=Math.sin(a)*cw*(L.branchReach||0.34)+sway*3, by=cy-Math.cos(a)*H*(L.branchLift||0.18);
      ctx.beginPath(); ctx.moveTo(sway*1.4,-trunkH*0.92);
      ctx.quadraticCurveTo(bx*0.35,-trunkH-H*(L.branchY||0.12),bx,by); ctx.stroke();
      tips.push([bx,by]);
    }
    if (S.fol){ // leaf canopy
      ctx.save();
      ctx.globalAlpha=0.24;
      ctx.fillStyle=shade(S.fol,-26);
      ctx.beginPath();
      ctx.ellipse(sway*2, cy+H*0.06, cw*(L.canopyW||0.48)*0.92, H*(L.canopyH||0.26)*0.88, 0, 0, 7);
      ctx.fill();
      ctx.restore();
      const n=stemFor(L.leafN||26);
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=Math.sqrt(rnd());
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*30);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
          cw*(L.leafW||0.15), cw*(L.leafH||0.10), a, 0, 7);
        ctx.fill();
      }
      if (L.weep){
        ctx.strokeStyle=shade(S.fol,-10); ctx.lineWidth=1;
        for (let w=0;w<8;w++){
          const wx=(rnd()-0.5)*cw*0.7+sway*3, wy=cy+rnd()*H*0.12;
          ctx.beginPath(); ctx.moveTo(wx,wy);
          ctx.quadraticCurveTo(wx+(rnd()-0.5)*5,wy+H*0.16,wx+(rnd()-0.5)*7,wy+H*(0.24+rnd()*0.1)); ctx.stroke();
        }
      }
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=shade(S.fol,22);
      for (let i=0;i<Math.max(4,Math.round(n*0.18));i++){
        const a=-Math.PI*0.65+rnd()*Math.PI*0.42, r=Math.sqrt(rnd());
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*(L.canopyW||0.48)*r+sway*3, cy-Math.sin(a)*H*(L.canopyH||0.26)*r,
          cw*(L.leafW||0.15)*0.65, cw*(L.leafH||0.10)*0.62, a, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    if (blooming){ // flowers: on the canopy, or straight on bare branches (redbud)
      const spots=Math.max(2,Math.ceil((L.flowerN||(S.fol?10:14))*blv));
      if (L.smoke){
        ctx.save(); ctx.globalAlpha=0.48;
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.5+rnd()*0.45, hx=sway*1.4+(tx2-sway*1.4)*f, hy=-trunkH*0.92+(ty2+trunkH*0.92)*f;
          ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*26);
          for (let p=0;p<4;p++){ ctx.beginPath();
            ctx.ellipse(hx+(rnd()-0.5)*12,hy+(rnd()-0.5)*10,3.2,2.1,(rnd()-0.5)*1.2,0,7); ctx.fill(); }
        }
        ctx.restore();
      } else {
        ctx.fillStyle=S.bloom;
        for (let i=0;i<spots;i++){
          const [tx2,ty2]=tips[i%tips.length];
          const f=0.45+rnd()*0.55;
          ctx.beginPath();
          ctx.arc(sway*1.4+(tx2-sway*1.4)*f, -trunkH*0.92+(ty2+trunkH*0.92)*f, L.flowerSize||1.8, 0, 7);
          ctx.fill();
        }
      }
    }
    if (S.seed && mature){ // cottonwood fluff, oak's held leaves handled via fol
      ctx.fillStyle=S.seed;
      const seeds=L.seedN||8, seedR=L.seedR||1.4;
      for (let i=0;i<seeds;i++){ ctx.beginPath();
        ctx.arc((rnd()-0.5)*cw*0.8+sway*3, cy-(rnd()-0.5)*H*0.4, seedR, 0, 7); ctx.fill(); }
    }
  }
  else if (P.form === 'conifer'){ // stacked evergreen, dense at any season
    const cw=(P.cw||60)*(0.3+0.7*growth);
    ctx.strokeStyle='#5e4a38'; ctx.lineWidth=Math.max(2,4*growth);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-H*0.18); ctx.stroke();
    for (let t=0;t<3;t++){
      const w=cw*(0.95-t*0.27), yb=-H*(0.16+t*0.26), yt=-H*(0.46+t*0.27);
      ctx.fillStyle=shade(S.fol,(t-1)*10);
      ctx.beginPath(); ctx.moveTo(-w/2+sway*(t+1)*0.6,yb);
      ctx.lineTo(w/2+sway*(t+1)*0.6,yb); ctx.lineTo(sway*(t+1.6),yt);
      ctx.closePath(); ctx.fill();
    }
    if (S.seed && mature){ ctx.fillStyle=S.seed;
      for (let i=0;i<6;i++){ ctx.beginPath();
        ctx.arc((rnd()-0.5)*cw*0.6, -H*(0.25+rnd()*0.5), 1.2, 0, 7); ctx.fill(); } }
  }
  else if (P.form === 'bamboo'){ // linked cane grove / screen
    const L=P.look||{}, fol=S.fol||'#4f7c50', cane=L.cane||'#5f7f42';
    const cw=(P.cw||80)*(0.32+0.68*growth), dirs=(detail&&detail.bambooDirs)||[];
    if (dirs.length && S.fol){
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=shade(fol,-20);
      dirs.forEach(([dx,dy])=>{
        const len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
        ctx.beginPath();
        ctx.ellipse(ux*cw*0.30, -H*0.54+uy*8, cw*0.48, H*0.18, Math.atan2(uy,ux), 0, 7);
        ctx.fill();
      });
      ctx.restore();
    }
    const canes=stemFor((L.canes||11)+dirs.length*3);
    for (let i=0;i<canes;i++){
      const pull=dirs.length && i%3===0 ? dirs[(i/3|0)%dirs.length] : null;
      let ox=(rnd()-0.5)*cw*0.62, lean=(rnd()-0.5)*6+sway*2;
      if (pull){ const len=Math.hypot(pull[0],pull[1])||1; ox+=(pull[0]/len)*cw*0.20; lean+=(pull[0]/len)*4; }
      const ht=H*(0.72+rnd()*0.34);
      ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=3.2;
      ctx.beginPath(); ctx.moveTo(ox+1,0); ctx.quadraticCurveTo(ox+lean*0.25,-ht*0.45,ox+lean,-ht); ctx.stroke();
      ctx.strokeStyle=shade(cane,(rnd()-0.5)*24); ctx.lineWidth=2.1;
      ctx.beginPath(); ctx.moveTo(ox,0); ctx.quadraticCurveTo(ox+lean*0.25,-ht*0.45,ox+lean,-ht); ctx.stroke();
      ctx.strokeStyle='rgba(246,236,202,0.24)'; ctx.lineWidth=0.8;
      for (let n=1;n<5;n++){ const yy=-ht*n/5, xx=ox+lean*(n/5);
        ctx.beginPath(); ctx.moveTo(xx-2.4,yy); ctx.lineTo(xx+2.4,yy); ctx.stroke(); }
      if (S.fol){
        const leaves=Math.max(2,Math.round((L.leafN||36)/canes));
        for (let j=0;j<leaves;j++){
          const f=0.45+rnd()*0.48, lx=ox+lean*f, ly=-ht*f;
          const side=rnd()<0.5?-1:1;
          ctx.fillStyle=shade(fol,(rnd()-0.5)*26);
          ctx.beginPath(); ctx.ellipse(lx+side*(5+rnd()*7),ly+(rnd()-0.5)*5,8,2.1,side*0.35,0,7); ctx.fill();
        }
      }
    }
  }
  else if (P.form === 'bush'){ // woody shrub: twigs hold through winter
    const L=P.look||{};
    const cw=(shrubVisualCw(P)||50)*(0.35+0.65*growth);
    if (L.clip){
      const fol=S.fol||S.seed||'#4f6f45', shape=L.shape||'round';
      const bodyH=H*(L.bodyH||0.58), bodyW=cw*(L.bodyW||0.76), baseY=0;
      const hedgeDirs=(detail&&detail.hedgeDirs)||[];
      const connectedSquare=shape==='square' && hedgeDirs.length;
      if (shape==='sphere'){
        ctx.fillStyle=shade(fol,-20);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.47,bodyW*0.50,bodyH*0.52,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,-6);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.36,bodyW*0.46,bodyH*0.34,0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,14);
        ctx.beginPath(); ctx.ellipse(-bodyW*0.12,baseY-bodyH*0.66,bodyW*0.30,bodyH*0.19,-0.1,0,7); ctx.fill();
      } else if (shape==='square'){
        if (connectedSquare){
          const axis=detail.hedgeAxis||[Math.cos(detail.hedgeAngle||0),Math.sin(detail.hedgeAngle||0)];
          const step=detail.hedgeStep||bodyW, len=step*1.08, thick=Math.max(12,Math.min(bodyW*0.54,bodyH*0.78));
          const height=bodyH*0.76;
          const left=-len/2, right=len/2, endNeg=detail.hedgeEndNeg!==false, endPos=detail.hedgeEndPos!==false;
          const ux=axis[0], uy=axis[1];
          let nx=-uy, ny=ux; if (ny<0){ nx=-nx; ny=-ny; }
          const pt=(a,b,top)=>[ux*a+nx*b, uy*a+ny*b-(top?height:0)];
          const poly=(pts,fill)=>{ ctx.fillStyle=fill; ctx.beginPath();
            pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py)); ctx.closePath(); ctx.fill(); };
          const back=-thick/2, front=thick/2;
          const A=pt(left,back,0), B=pt(right,back,0), C=pt(right,front,0), D=pt(left,front,0);
          const At=pt(left,back,1), Bt=pt(right,back,1), Ct=pt(right,front,1), Dt=pt(left,front,1);
          poly([D,C,Ct,Dt],shade(fol,-18));             // front face
          if (endNeg) poly([A,D,Dt,At],shade(fol,-24)); // outside end cap
          if (endPos) poly([B,C,Ct,Bt],shade(fol,-24));
          poly([At,Bt,Ct,Dt],shade(fol,8));             // clipped top
          ctx.save(); ctx.strokeStyle=shade(fol,-31); ctx.lineWidth=1; ctx.globalAlpha=0.20;
          ctx.beginPath();
          [At,Bt,Ct,Dt,At].forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
          ctx.moveTo(Dt[0],Dt[1]); ctx.lineTo(D[0],D[1]); ctx.lineTo(C[0],C[1]); ctx.lineTo(Ct[0],Ct[1]);
          if (endNeg){ ctx.moveTo(A[0],A[1]); ctx.lineTo(At[0],At[1]); }
          if (endPos){ ctx.moveTo(B[0],B[1]); ctx.lineTo(Bt[0],Bt[1]); }
          ctx.stroke(); ctx.restore();
          if (L.fleck||L.needles){
            ctx.save();
            ctx.strokeStyle=shade(fol,L.needles?-24:-12); ctx.lineWidth=0.8; ctx.lineCap='round';
            for (let i=0;i<9;i++){ const a=left+rnd()*len, b=back+rnd()*thick, p1=pt(a-2,b,1), p2=pt(a+2,b+(rnd()-0.5)*2,1);
              ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke(); }
            ctx.restore();
          }
          ctx.restore();
          return;
        }
        const top=baseY-bodyH*0.92, frontTop=top+bodyH*(connectedSquare?0.18:0.14), bottom=baseY;
        const left=-bodyW/2, right=bodyW/2, inset=connectedSquare?0:bodyW*0.12;
        ctx.fillStyle=shade(fol,-18); ctx.fillRect(left,frontTop,bodyW,bottom-frontTop);
        ctx.fillStyle=shade(fol,10);
        ctx.beginPath();
        ctx.moveTo(left,frontTop); ctx.lineTo(left+inset,top);
        ctx.lineTo(right-inset,top); ctx.lineTo(right,frontTop);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle=shade(fol,-25); ctx.fillRect(left,bottom-bodyH*0.08,bodyW,bodyH*0.08);
        ctx.save();
        ctx.strokeStyle=shade(fol,-31); ctx.lineWidth=1; ctx.globalAlpha=connectedSquare?0.14:0.25;
        ctx.beginPath();
        if (!connectedSquare){
          ctx.moveTo(left,frontTop); ctx.lineTo(left,bottom);
          ctx.moveTo(right,frontTop); ctx.lineTo(right,bottom);
        }
        ctx.moveTo(left,frontTop); ctx.lineTo(right,frontTop);
        ctx.moveTo(left,bottom-bodyH*0.08); ctx.lineTo(right,bottom-bodyH*0.08);
        ctx.stroke(); ctx.restore();
      } else if (shape==='cone' || shape==='pyramid'){
        const layers=shape==='cone'?3:2;
        for (let q=0;q<layers;q++){
          const y=baseY-bodyH*(q/layers)*0.58, w=bodyW*(1-q*0.2);
          ctx.fillStyle=shade(fol,(q-1)*10);
          ctx.beginPath(); ctx.moveTo(-w/2,y);
          ctx.lineTo(w/2,y); ctx.lineTo(sway*1.2,baseY-bodyH*(0.95+q*0.06)); ctx.closePath(); ctx.fill();
        }
      } else if (shape==='column'){
        const w=bodyW*0.62;
        ctx.fillStyle=shade(fol,-13); ctx.fillRect(-w/2,baseY-bodyH,w,bodyH*0.94);
        ctx.fillStyle=shade(fol,8);
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH,w/2,bodyH*0.16,0,0,7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*0.08,w/2,bodyH*0.12,0,0,7); ctx.fill();
      } else {
        const isMound=shape==='mound';
        ctx.fillStyle=shade(fol,-20);
        ctx.beginPath(); ctx.ellipse(0,baseY-bodyH*(isMound?0.30:0.38),bodyW*(isMound?0.58:0.54),bodyH*(isMound?0.30:0.38),0,0,7); ctx.fill();
        ctx.fillStyle=shade(fol,8);
        ctx.beginPath(); ctx.ellipse(-bodyW*0.05,baseY-bodyH*(isMound?0.46:0.57),bodyW*(isMound?0.48:0.44),bodyH*(isMound?0.22:0.30),0,0,7); ctx.fill();
      }
      if (L.fleck||L.needles){
        ctx.strokeStyle=shade(fol,L.needles?-24:-12); ctx.lineWidth=0.8; ctx.lineCap='round';
        for (let i=0;i<9;i++){ const fx=(rnd()-0.5)*bodyW*0.8, fy=baseY-bodyH*(0.18+rnd()*0.64);
          ctx.beginPath(); ctx.moveTo(fx-2,fy); ctx.lineTo(fx+2,fy+(rnd()-0.5)*2); ctx.stroke(); }
      }
    } else {
      const tn=stemFor(7), tips=[];
      ctx.strokeStyle='#6e5a48'; ctx.lineWidth=1.6; ctx.lineCap='round';
      for (let i=0;i<tn;i++){
        const a=(i/(tn-1)-0.5)*1.5+(rnd()-0.5)*0.2;
        const tx2=Math.sin(a)*cw*0.5+sway*2, ty2=-H*(0.55+rnd()*0.45);
        ctx.beginPath(); ctx.moveTo((rnd()-0.5)*4,0);
        ctx.quadraticCurveTo(tx2*0.4,ty2*0.55,tx2,ty2); ctx.stroke();
        tips.push([tx2,ty2]);
      }
    if (S.fol){
        ctx.save(); ctx.globalAlpha=0.20; ctx.fillStyle=shade(S.fol,-24);
        ctx.beginPath(); ctx.ellipse(sway, -H*0.42, cw*0.45, H*0.28, 0, 0, 7); ctx.fill();
        ctx.restore();
        const n=stemFor(20);
        for (let i=0;i<n;i++){
          const a=rnd()*Math.PI*2, r=rnd();
          ctx.fillStyle=shade(S.fol,(rnd()-0.5)*28);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a)*cw*0.5*r+sway*2, -H*(0.35+rnd()*0.55),
            3.6, 2.6, a, 0, 7);
          ctx.fill();
        }
      }
      if (blooming && mature){
        const heads=tips.slice(0,Math.max(1,Math.ceil(tips.length*blv)));
        if (L.smoke){
          ctx.save(); ctx.globalAlpha=0.52;
          heads.forEach(([tx2,ty2])=>{ for (let p=0;p<6;p++){ ctx.fillStyle=shade(S.bloom,(rnd()-0.5)*24);
            ctx.beginPath(); ctx.ellipse(tx2+(rnd()-0.5)*16,ty2-3+(rnd()-0.5)*12,3.4,2.2,(rnd()-0.5)*1.2,0,7); ctx.fill(); } });
          ctx.restore();
        } else { ctx.fillStyle=S.bloom;
          heads.forEach(([tx2,ty2])=>{
            ctx.beginPath(); ctx.ellipse(tx2,ty2-2,2.2,3.2,0,0,7); ctx.fill(); }); }
      }
      if (S.seed && mature){ ctx.fillStyle=S.seed; // berries/pods along upper twigs
        tips.forEach(([tx2,ty2])=>{ for (let b=0;b<3;b++){ const f=0.6+b*0.15;
          ctx.beginPath(); ctx.arc(tx2*f,ty2*f,1.6,0,7); ctx.fill(); } }); }
    }
  }
  else if (P.form === 'hydrangea'){ // big mophead or panicle flowering shrub
    const L = P.look||{}, panicle = L.bloomShape==='panicle', lacecap = L.bloomShape==='lacecap';
    const cw=(shrubVisualCw(P)||70)*(0.4+0.6*growth), tn=stemFor(6), tips=[];
    ctx.strokeStyle='#6e5a48'; ctx.lineWidth=2; ctx.lineCap='round';
    for (let i=0;i<tn;i++){
      const a=(i/(tn-1)-0.5)*1.3+(rnd()-0.5)*0.2;
      const tx2=Math.sin(a)*cw*0.42+sway*2, ty2=-H*(0.6+rnd()*0.38);
      ctx.beginPath(); ctx.moveTo((rnd()-0.5)*5,0);
      ctx.quadraticCurveTo(tx2*0.4,ty2*0.55,tx2,ty2); ctx.stroke();
      tips.push([tx2,ty2]);
    }
    if (S.fol){ // broad leafy mound
      ctx.save(); ctx.globalAlpha=0.23; ctx.fillStyle=shade(S.fol,-24);
      ctx.beginPath(); ctx.ellipse(sway, -H*0.40, cw*0.44, H*0.26, 0, 0, 7); ctx.fill();
      ctx.restore();
      const n=stemFor(22);
      for (let i=0;i<n;i++){ const a=rnd()*Math.PI*2, r=rnd();
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*26);
        ctx.beginPath(); ctx.ellipse(Math.cos(a)*cw*0.46*r+sway*2, -H*(0.30+rnd()*0.5),
          4.4,3.2,a,0,7); ctx.fill(); }
    }
    const headR=L.headR||7;
    const drawHead=(hx,hy,col,scale)=>{
      const r=headR*(scale||1);
      if (panicle){ for (let k=0;k<16;k++){ const f=k/16; // taper to a point
        const wr=r*(1-f)*0.9;
        ctx.fillStyle=shade(col,(rnd()-0.5)*16);
        ctx.beginPath(); ctx.ellipse(hx+(rnd()-0.5)*2*wr, hy-r*0.3-f*r*1.7, 1.9,1.9,0,0,7); ctx.fill(); } }
      else if (lacecap){ // flat disc: tiny fertile center ringed by showy florets
        const cy=hy-r*0.4;
        ctx.fillStyle=shade(col,-46);
        for (let k=0;k<12;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r*0.6;
          ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*rr, cy+Math.sin(a)*rr*0.42, 1.1,1.1,0,0,7); ctx.fill(); }
        const ring=Math.round(7+r*0.5);
        for (let k=0;k<ring;k++){ const a=k/ring*Math.PI*2;
          ctx.fillStyle=shade(col,(rnd()-0.5)*14);
          ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*r, cy+Math.sin(a)*r*0.45, 2.4,2.2,a,0,7); ctx.fill(); } }
      else { for (let k=0;k<20;k++){ const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*r;
        ctx.fillStyle=shade(col,(rnd()-0.5)*16);
        ctx.beginPath(); ctx.ellipse(hx+Math.cos(a)*rr, hy-r*0.55+Math.sin(a)*rr*0.82, 2,2,0,0,7); ctx.fill(); } }
    };
    if (blooming && mature && S.bloom){
      const heads=Math.max(1,Math.ceil(tips.length*blv));
      for (let t=0;t<heads;t++) drawHead(tips[t][0],tips[t][1],S.bloom,1);
    } else if (S.seed && mature){ // dried heads hold through winter
      tips.forEach(([hx,hy])=>drawHead(hx,hy,S.seed,0.8));
    }
  }
  // winter snow caps on mature structure
  if (AMBIENCE[season].snow && mature){
    ctx.fillStyle='rgba(240,244,250,0.85)';
    const rs=mulberry(seed+9), caps=4;
    for(let i=0;i<caps;i++){ ctx.beginPath();
      ctx.ellipse((rs()-0.5)*18,-H*(0.5+rs()*0.45),3.5,1.6,0,0,7); ctx.fill(); }
  }
  if (!AMBIENCE[season].snow && S.fol && growth>0.28){
    const hl=mulberry(seed+0x51f15e), col=mixHex(S.fol,'#fff1c4',0.42);
    ctx.save(); ctx.globalAlpha=P.type==='tree'?0.16:0.13;
    ctx.strokeStyle=col; ctx.lineWidth=P.type==='tree'?1.2:0.9; ctx.lineCap='round';
    const n=P.type==='tree'?5:3;
    for (let i=0;i<n;i++){
      const px=(hl()-0.55)*(P.cw?P.cw*0.32:18), py=-H*(0.25+hl()*0.58);
      ctx.beginPath();
      ctx.moveTo(px-3,py+1);
      ctx.quadraticCurveTo(px,py-2,px+4,py-3-hl()*3);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function colorParts(col){
  if (!col) col='#6b6248'; // seasons without that color: dead-stem brown
  if (col[0]==='#'){
    const n=parseInt(col.slice(1),16);
    if (Number.isFinite(n)) return [(n>>16)&255,(n>>8)&255,n&255];
  }
  const m=String(col).match(/rgba?\(([^)]+)\)/i);
  if (m){
    const parts=m[1].split(',').slice(0,3).map(v=>parseFloat(v));
    if (parts.every(Number.isFinite)) return parts;
  }
  return [107,98,72];
}
function shade(col, amt){
  const [r0,g0,b0]=colorParts(col);
  let r=r0+amt, g=g0+amt, b=b0+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return `rgb(${r},${g},${b})`;
}

/* ---------- character renderer: round-bodied cats & dogs ---------- */
function drawCritter(ctx, x, y, ch, t, walking, scale){
  const s = scale||1, coat = ch.coat, dark = ch.coatD;
  const bob = walking ? Math.sin(t*0.02)*1.6*s : Math.sin(t*0.004)*0.7*s;
  ctx.save(); ctx.translate(x, y+bob);
  ctx.scale(s,s);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0,3,13,5,0,0,7); ctx.fill();
  // tail
  ctx.strokeStyle=dark; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath();
  if (ch.species==='cat'){ ctx.moveTo(8,-6);
    ctx.quadraticCurveTo(17,-10,15,-22+Math.sin(t*0.005)*2); }
  else { ctx.moveTo(9,-7); ctx.quadraticCurveTo(16,-12+Math.sin(t*0.012)*3,13,-16); }
  ctx.stroke();
  // body
  ctx.fillStyle=coat;
  ctx.beginPath(); ctx.ellipse(0,-9,11,10,0,0,7); ctx.fill();
  if (ch.mark==='tuxedo'){ ctx.fillStyle='#f3ecdd';
    ctx.beginPath(); ctx.ellipse(0,-7,5.5,7,0,0,7); ctx.fill(); }
  // legs hint
  ctx.fillStyle=dark;
  const lp = walking? Math.sin(t*0.02)*2 : 0;
  ctx.fillRect(-7,-2+lp*0.4,3.4,4); ctx.fillRect(3.6,-2-lp*0.4,3.4,4);
  // head
  ctx.fillStyle=coat;
  ctx.beginPath(); ctx.arc(0,-22,8.6,0,7); ctx.fill();
  if (ch.mark==='patch'){ ctx.fillStyle=dark;
    ctx.beginPath(); ctx.arc(-3.4,-24,3.6,0,7); ctx.fill(); }
  // ears
  ctx.fillStyle=coat;
  if (ch.species==='cat'){
    ctx.beginPath(); ctx.moveTo(-7,-26); ctx.lineTo(-5,-34); ctx.lineTo(-1.5,-28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7,-26); ctx.lineTo(5,-34); ctx.lineTo(1.5,-28); ctx.closePath(); ctx.fill();
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.moveTo(-6,-27.5); ctx.lineTo(-5,-31.5); ctx.lineTo(-3,-28.5); ctx.closePath(); ctx.fill();
  } else { // floppy dog ears
    ctx.fillStyle=dark;
    ctx.beginPath(); ctx.ellipse(-8,-22,3.2,6,0.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-22,3.2,6,-0.4,0,7); ctx.fill();
  }
  // face
  ctx.fillStyle='#19120f';
  ctx.beginPath(); ctx.arc(-3,-23,1.2,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(3,-23,1.2,0,7); ctx.fill();
  if (ch.species==='dog'){ ctx.beginPath(); ctx.ellipse(0,-19.5,2.2,1.7,0,0,7); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-1.4,-20); ctx.lineTo(1.4,-20); ctx.lineTo(0,-18.6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

/* ---------- the house renderer ----------
   Works in VIEW space so rotation just works: the footprint is mapped
   to a view-space rect, walls/roof/door are built on its lattice. Size
   and colors come from the passed house object. The door clings to its
   world tile — from behind the house it's simply out of sight. */
function drawHouse(ctx, W, H, season, hOv){
  const hh=hOv; if (!hh) return;
  const [va,vb]=worldToView(hh.x,hh.y), [vc,vd]=worldToView(hh.x+hh.w-1,hh.y+hh.h-1);
  const vx0=Math.min(va,vc), vy0=Math.min(vb,vd);
  const vw=Math.abs(va-vc)+1, vh=Math.abs(vb-vd)+1;
  const wH=Math.min(110, 28+Math.min(vw,vh)*9), rH=wH*0.55, dH=Math.min(wH-8,30);
  const P=(vx,vy)=>viewScreen(vx,vy,W,H);
  const T=P(vx0,vy0), R=P(vx0+vw,vy0), B=P(vx0+vw,vy0+vh), L=P(vx0,vy0+vh);
  const up=(p,h2)=>[p[0],p[1]-h2];
  const wall=hh.wall||'#8a7a60', roof=hh.roof||'#9a5f3a';
  const wallD=shade(wall,-24), roofD=shade(roof,-26);
  const quad=(a,b,c,d,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]);
    ctx.closePath(); ctx.fill(); };
  const tri=(a,b,c,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]);
    ctx.closePath(); ctx.fill(); };
  const cx0=(T[0]+R[0]+B[0]+L[0])/4, cy0=(T[1]+R[1]+B[1]+L[1])/4;
  drawSoftShadow(ctx,cx0,cy0+TILE_H*0.45,Math.max(TILE_W*vw*0.34,54),Math.max(TILE_H*vh*0.34,18),0.24);
  // ridge runs along the footprint's longer view axis
  let g1,g2,backRoof,frontRoof,gable;
  if (vw>=vh){
    g1=up(P(vx0,vy0+vh/2),wH+rH); g2=up(P(vx0+vw,vy0+vh/2),wH+rH);
    backRoof=[up(T,wH),up(R,wH),g2,g1]; frontRoof=[up(L,wH),up(B,wH),g2,g1];
    gable=[up(B,wH),up(R,wH),g2];
  } else {
    g1=up(P(vx0+vw/2,vy0),wH+rH); g2=up(P(vx0+vw/2,vy0+vh),wH+rH);
    backRoof=[up(T,wH),up(L,wH),g2,g1]; frontRoof=[up(R,wH),up(B,wH),g2,g1];
    gable=[up(L,wH),up(B,wH),g2];
  }
  quad(backRoof[0],backRoof[1],backRoof[2],backRoof[3],roofD);
  quad(L,B,up(B,wH),up(L,wH),wall);    // view-southwest wall
  quad(B,R,up(R,wH),up(B,wH),wallD);   // view-southeast wall
  tri(gable[0],gable[1],gable[2],wallD);
  quad(frontRoof[0],frontRoof[1],frontRoof[2],frontRoof[3],roof);
  ctx.strokeStyle='rgba(255,246,218,0.25)'; ctx.lineWidth=1.2; ctx.beginPath();
  ctx.moveTo(g1[0],g1[1]); ctx.lineTo(g2[0],g2[1]); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
  [frontRoof,backRoof].forEach(rf=>{
    ctx.beginPath(); ctx.moveTo(rf[0][0],rf[0][1]); ctx.lineTo(rf[1][0],rf[1][1]); ctx.stroke();
  });
  // door over its world tile, when that wall faces the camera
  const [dX,dY]=doorPos(hh); const [dvx,dvy]=worldToView(dX,dY);
  let doorWall=null; // 'sw' | 'se'
  if (Math.round(dvy)===vy0+vh && dvx>=vx0 && dvx<vx0+vw) doorWall='sw';
  else if (Math.round(dvx)===vx0+vw && dvy>=vy0 && dvy<vy0+vh) doorWall='se';
  if (doorWall){
    const d1=doorWall==='sw'?P(dvx+0.22,vy0+vh):P(vx0+vw,dvy+0.22);
    const d2=doorWall==='sw'?P(dvx+0.78,vy0+vh):P(vx0+vw,dvy+0.78);
    quad(d1,d2,up(d2,dH),up(d1,dH),HOUSE_TRIM.door);
    ctx.strokeStyle=HOUSE_TRIM.trim; ctx.lineWidth=1.2; ctx.beginPath();
    ctx.moveTo(d1[0],d1[1]); ctx.lineTo(d1[0],d1[1]-dH); ctx.lineTo(d2[0],d2[1]-dH);
    ctx.lineTo(d2[0],d2[1]); ctx.stroke();
  }
  // warm windows on the wall without the door
  const winWall=doorWall==='se'?'sw':'se';
  const len=winWall==='se'?vh:vw, n=Math.max(1,Math.min(4,Math.round(len/3)));
  for (let i=0;i<n;i++){
    const t=(i+0.5)/n;
    const w1=winWall==='se'?P(vx0+vw,vy0+vh*t-0.2):P(vx0+vw*t-0.2,vy0+vh);
    const w2=winWall==='se'?P(vx0+vw,vy0+vh*t+0.2):P(vx0+vw*t+0.2,vy0+vh);
    quad(up(w1,wH*0.34),up(w2,wH*0.34),up(w2,wH*0.62),up(w1,wH*0.62),HOUSE_TRIM.glow);
    ctx.strokeStyle='rgba(58,44,34,0.32)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(w1[0],w1[1]-wH*0.34); ctx.lineTo(w2[0],w2[1]-wH*0.34); ctx.stroke();
  }
  // snow blankets the roof in winter
  if (AMBIENCE[season].snow){
    quad(frontRoof[0],frontRoof[1],frontRoof[2],frontRoof[3],'rgba(240,244,250,0.75)');
    quad(backRoof[0],backRoof[1],backRoof[2],backRoof[3],'rgba(240,244,250,0.45)');
  }
}
function fenceAnchor(x,y,W,H){
  const [sx,sy]=screenOf(x,y,W,H);
  return [sx,sy+TILE_H/2];
}
function drawFence(ctx,W,H,season,f,x,y){
  const st=fenceStyle(f.style), tall=f.height>=6, h=tall?36:26;
  const [ax,ay]=fenceAnchor(x,y,W,H);
  const drawPost=(px,py,w=3.8)=>{
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=w+1.6;
    ctx.beginPath(); ctx.moveTo(px,py+1); ctx.lineTo(px,py-h-2); ctx.stroke();
    ctx.strokeStyle=st.post; ctx.lineWidth=w;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px,py-h); ctx.stroke();
  };
  const drawRail=(x1,y1,x2,y2,off,width,col)=>{
    ctx.strokeStyle=col; ctx.lineWidth=width; ctx.beginPath();
    ctx.moveTo(x1,y1-off); ctx.lineTo(x2,y2-off); ctx.stroke();
  };
  const drawPickets=(x1,y1,x2,y2)=>{
    const steps=4;
    ctx.strokeStyle=st.fill; ctx.lineWidth=f.style==='chainlink'?0.8:1.5;
    for (let i=1;i<steps;i++){
      const t=i/steps, px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
      if (f.style==='chainlink'){
        ctx.beginPath(); ctx.moveTo(px-4,py-h*.18); ctx.lineTo(px+4,py-h*.76); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px+4,py-h*.18); ctx.lineTo(px-4,py-h*.76); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(px,py-h*.12); ctx.lineTo(px,py-h*.82); ctx.stroke();
      }
    }
  };
  const drawSegment=(dx,dy,force)=>{
    if (!force && !fenceNeighbor(x+dx,y+dy)) return false;
    const [ex,ey]=fenceAnchor(x+dx*0.48,y+dy*0.48,W,H);
    if (f.style==='brick'){
      drawRail(ax,ay,ex,ey,h*.24,11,shade(st.rail,-20));
      drawRail(ax,ay,ex,ey,h*.42,11,st.rail);
      drawRail(ax,ay,ex,ey,h*.60,9,shade(st.rail,18));
      ctx.strokeStyle='rgba(76,38,28,0.35)'; ctx.lineWidth=1;
      for (let i=1;i<4;i++){ const t=i/4, px=ax+(ex-ax)*t, py=ay+(ey-ay)*t;
        ctx.beginPath(); ctx.moveTo(px,py-h*.16); ctx.lineTo(px,py-h*.68); ctx.stroke(); }
    } else {
      const lw=f.style==='chainlink'?1.2:(f.style==='black'?2:2.6);
      drawRail(ax,ay,ex,ey,h*.30,lw,st.rail);
      drawRail(ax,ay,ex,ey,h*.68,lw,st.rail);
      drawPickets(ax,ay,ex,ey);
    }
    return true;
  };
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  let connected=false;
  dirs.forEach(([dx,dy])=>{ if (drawSegment(dx,dy,false)) connected=true; });
  if (!connected){ drawSegment(1,0,true); drawSegment(-1,0,true); }
  drawPost(ax,ay,f.style==='brick'?7:3.8);
  if (f.gate){
    const gateCol=f.style==='vinyl'?'#6f6458':f.style==='black'?'#efe6d3':shade(st.fill,28);
    const hingeX=ax-13, latchX=ax+13, base=ay, top=ay-h*.72, mid=ay-h*.43;
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(hingeX,base-3); ctx.lineTo(hingeX,top);
    ctx.moveTo(latchX,base-3); ctx.lineTo(latchX,top); ctx.stroke();
    ctx.strokeStyle=gateCol; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(hingeX,base-3); ctx.lineTo(hingeX,top);
    ctx.moveTo(latchX,base-3); ctx.lineTo(latchX,top); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hingeX,top); ctx.lineTo(latchX,top);
    ctx.moveTo(hingeX,mid); ctx.lineTo(latchX,mid);
    ctx.moveTo(hingeX,base-h*.16); ctx.lineTo(latchX,base-h*.16);
    ctx.moveTo(hingeX,base-h*.16); ctx.lineTo(latchX,top);
    ctx.moveTo(hingeX,top); ctx.lineTo(latchX,base-h*.16);
    ctx.stroke();
    ctx.strokeStyle='rgba(239,230,211,0.55)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(hingeX+2,base-h*.18,22,-1.15,-0.12); ctx.stroke();
    ctx.fillStyle=f.style==='black'?'#c97f3f':'#efe6d3';
    ctx.beginPath(); ctx.arc(latchX-4,mid,2.5,0,7); ctx.fill();
  }
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.66)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ax-8,ay-h-1); ctx.lineTo(ax+8,ay-h-1); ctx.stroke();
  }
  ctx.restore();
}
function lightAt(x,y){ const l=game.lights&&game.lights[`${x},${y}`]; return (l&&!l.removed)?l:null; }
function lightDraft(){ return game.lightDraft=normalizeLightDraft(game.lightDraft); }
function lightLabel(l){
  const d=l||lightDraft();
  return `${lightTone(d.tone).label} ${lightType(d.type).label}`;
}
function drawLightFixture(ctx,W,H,season,l,x,y,lit){
  const typ=lightType(l.type), tone=lightTone(l.tone);
  const [sx,sy]=screenOf(x,y,W,H), base=sy+TILE_H/2;
  const h=typ.h, metal='#3f4038', metalHi='#6c6958';
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  drawSoftShadow(ctx,sx,base+2,typ.kind==='path'?9:13,4,0.18);
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(sx,base); ctx.lineTo(sx,base-h); ctx.stroke();
  ctx.strokeStyle=metal; ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.moveTo(sx,base); ctx.lineTo(sx,base-h); ctx.stroke();
  if (typ.kind==='path'){
    ctx.fillStyle=metal;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h); ctx.lineTo(sx+7,base-h); ctx.lineTo(sx+4,base-h-5); ctx.lineTo(sx-4,base-h-5); ctx.closePath(); ctx.fill();
    ctx.fillStyle=lit?tone.col:'#958f7f';
    ctx.beginPath(); ctx.ellipse(sx,base-h+1,4.5,2.2,0,0,7); ctx.fill();
  } else if (typ.kind==='post'){
    ctx.strokeStyle=metalHi; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h+7); ctx.lineTo(sx+7,base-h+7); ctx.stroke();
    ctx.fillStyle=metal;
    ctx.fillRect(sx-8,base-h-2,16,12);
    ctx.fillStyle=lit?tone.col:'#6f6a5e';
    ctx.fillRect(sx-5,base-h+1,10,7);
    ctx.strokeStyle=metal; ctx.lineWidth=1;
    ctx.strokeRect(sx-8,base-h-2,16,12);
    ctx.beginPath(); ctx.moveTo(sx-5,base-h-2); ctx.lineTo(sx,base-h-9); ctx.lineTo(sx+5,base-h-2); ctx.stroke();
  } else {
    ctx.fillStyle=metal;
    ctx.beginPath(); ctx.ellipse(sx,base-h,10,5,0,0,7); ctx.fill();
    ctx.fillStyle=lit?tone.col:'#777066';
    ctx.beginPath(); ctx.ellipse(sx,base-h+2,7,3,0,0,7); ctx.fill();
    ctx.strokeStyle=metalHi; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(sx-10,base-h); ctx.lineTo(sx+10,base-h); ctx.stroke();
  }
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.72)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(sx-7,base-h-4); ctx.lineTo(sx+7,base-h-4); ctx.stroke();
  }
  ctx.restore();
}
function drawLightGlow(ctx,W,H,l,x,y){
  const typ=lightType(l.type), tone=lightTone(l.tone);
  const [sx,sy]=screenOf(x,y,W,H), base=sy+TILE_H/2, head=base-typ.h;
  const r=typ.kind==='path'?42:typ.kind==='post'?74:58;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  let g=ctx.createRadialGradient(sx,head,0,sx,head,r);
  g.addColorStop(0,tone.glow+'0.58)');
  g.addColorStop(0.35,tone.glow+'0.22)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,head-r,r*2,r*2);
  g=ctx.createRadialGradient(sx,base,0,sx,base,r*0.72);
  g.addColorStop(0,tone.glow+'0.18)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(sx-r,base-r*0.72,r*2,r*1.45);
  ctx.restore();
  ctx.save();
  ctx.fillStyle=tone.col;
  ctx.beginPath(); ctx.arc(sx,head,typ.kind==='path'?2.5:3.5,0,7); ctx.fill();
  ctx.restore();
}
function firepitDraft(){ return game.firepitDraft=normalizeFirepitDraft(game.firepitDraft); }
function firepitLabel(f){
  const d=normalizeFirepitDraft(f||firepitDraft()), s=firepitSize(d.size,d.shape);
  return `${s.plan} ${d.shape} fire pit`;
}
function firepitAt(x,y){
  if (!game.firepits) return null;
  for (const k in game.firepits){
    const f=game.firepits[k]; if (!f || f.removed) continue;
    const [fx,fy]=k.split(',').map(Number), sz=firepitTileSize(f);
    if (x>=fx && x<fx+sz.w && y>=fy && y<fy+sz.h)
      return Object.assign({key:k,x:fx,y:fy},f);
  }
  return null;
}
function firepitFootprint(x,y,f){
  const sz=firepitTileSize(f), tiles=[];
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++) tiles.push([xx,yy]);
  return tiles;
}
function canPlaceFirepit(x,y,ignoreKey){
  const d=firepitDraft(), sz=firepitTileSize(d);
  if (x<0||y<0||x+sz.w>GW||y+sz.h>GH) return false;
  for (const [xx,yy] of firepitFootprint(x,y,d)){
    const k=`${xx},${yy}`;
    if (inHouse(xx,yy) || isDoor(xx,yy) || tileTerrain(xx,yy)==='water') return false;
    if (fenceAt(xx,yy) || lightAt(xx,yy) || shrubAt(xx,yy)) return false;
    const fp=firepitAt(xx,yy); if (fp && fp.key!==ignoreKey) return false;
    if (game.gameMode!=='design' && xx===Math.round(game.px) && yy===Math.round(game.py)) return false;
    const p=game.plants[k], b=game.bulbs[k];
    if ((p&&!p.removed) || (b&&!b.removed)) return false;
  }
  return true;
}
function placeFirepitAt(x,y){
  if (!game.firepits) game.firepits={};
  const d=normalizeFirepitDraft(firepitDraft()), k=`${x},${y}`;
  const cur=game.firepits[k];
  if (cur && !cur.removed && cur.shape===d.shape && cur.size===d.size) return null;
  if (!canPlaceFirepit(x,y,k)) return null;
  game.firepits[k]=Object.assign({},d,{t:Date.now()});
  game.dirty=true;
  return 'firepit';
}
function drawFirepit(ctx,W,H,season,f,x,y){
  const d=normalizeFirepitDraft(f), sz=firepitTileSize(d);
  const [sx,sy]=screenOf(x+(sz.w-1)/2,y+(sz.h-1)/2,W,H), base=sy+TILE_H/2;
  const rx=Math.max(17,sz.w*TILE_W*0.26), ry=Math.max(9,sz.h*TILE_H*0.36);
  ctx.save();
  drawSoftShadow(ctx,sx,base+3,rx*0.92,ry*0.58,0.22);
  const outer='#6d6358', rimHi='#968b7d', inner='#2a211c', coal='#4a2418';
  if (d.shape==='round'){
    ctx.fillStyle=outer; ctx.beginPath(); ctx.ellipse(sx,base,rx,ry,0,0,7); ctx.fill();
    ctx.fillStyle=rimHi; ctx.beginPath(); ctx.ellipse(sx,base-2,rx*0.86,ry*0.72,0,0,7); ctx.fill();
    ctx.fillStyle=inner; ctx.beginPath(); ctx.ellipse(sx,base-1,rx*0.58,ry*0.46,0,0,7); ctx.fill();
  } else {
    const diamond=(rxx,ryy,dy,fill)=>{ ctx.fillStyle=fill; ctx.beginPath();
      ctx.moveTo(sx,base-ryy+dy); ctx.lineTo(sx+rxx,base+dy);
      ctx.lineTo(sx,base+ryy+dy); ctx.lineTo(sx-rxx,base+dy); ctx.closePath(); ctx.fill(); };
    diamond(rx,ry,0,outer);
    diamond(rx*0.86,ry*0.72,-2,rimHi);
    diamond(rx*0.56,ry*0.45,-1,inner);
  }
  ctx.fillStyle=coal;
  ctx.beginPath(); ctx.ellipse(sx,base,rx*0.28,Math.max(3,ry*0.22),0,0,7); ctx.fill();
  ctx.strokeStyle='rgba(238,127,55,0.82)'; ctx.lineWidth=1.5; ctx.lineCap='round';
  [-0.22,0,0.22].forEach((off,i)=>{ ctx.beginPath();
    ctx.moveTo(sx+off*rx,base-1); ctx.quadraticCurveTo(sx+(off+0.04)*rx,base-7-i,sx+(off-0.02)*rx,base-11+i); ctx.stroke(); });
  if (AMBIENCE[season].snow){
    ctx.strokeStyle='rgba(240,244,250,0.68)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(sx,base-3,rx*0.86,ry*0.72,0,Math.PI*1.05,Math.PI*1.92); ctx.stroke();
  }
  ctx.restore();
}

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
  seeds:{}, flats:[], stock:{}, propSeeded:false, // Story propagation: seed inventory, sown trays, grown plugs
  plantFromStock:false, // a grown plug is armed: next placement spends one from game.stock
  startTs:Date.now(), elapsedMs:0, dayOffset:0, clockSuspended:false,
  px:15, py:15, tx:15, ty:15, moving:false, moveT:0, fromX:15, fromY:15,
  moveDur:170, pathTarget:null, sleepOnArrive:false,
  house:null, houseT:0,                              // per-garden house + sync stamp
  rot:0,                                             // view rotation, 90-degree steps
  hoverTile:null,                                    // pointer tile, for the house ghost
  focusPlantKey:null,                                // plant card focus, used for shrub footprint outlines
  worldId:null, worldName:'My garden',               // current solo save slot
  gameMode:'story',                                  // 'story' (avatar) | 'design' (direct)
  design:null,                                       // design-garden answers {zone,type,nativesOnly,deer,rabbit}
  drift:false,                                       // plant in clusters, Oudolf style
  freePlanting:false,                                // herbaceous plants can sit off the tile center
  eraseMode:'all',                                   // erase: all | plant | bulb | terrain
  eraseSize:1,                                       // erase brush diameter in tiles (odd)
  fx:[],                                             // short-lived planting pulses
  tool:'hand', toolVar:null,                         // active canvas tool or species + optional cultivar
  lastBrushTool:null, lastBrushVar:null,             // last plant/material tool chosen from the catalog
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
};
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

/* ---------- propagation: seed -> stratify -> grow out -> plug ----------
   Story-mode only. You don't pull plants from an infinite catalog; you sow
   seed and grow it on. Cold-strat seed must pass through one full winter
   before it germinates — one Winter->Spring boundary is one stratification
   cycle (double-dormancy seed needs two) — then it grows out over `growOut`
   *growing* days (winter doesn't tick, same as plant establishment). The
   timing fns are pure and take an explicit `now`, so they're deterministic
   and headless-testable; only the inventory wrappers read absDay()/game. */
const SEED_GROWOUT_DEFAULT = 6;   // germination -> plantable plug, in growing days
const STARTER_SEEDS = { bluestem:5, echinacea:5, butterfly:3, mountainmint:3, baptisia:2 };
function seedStrat(key){ const P=PLANTS[key]||{};
  return P.strat || (P.type==='grass'&&P.phen==='warm' ? 'none' : 'cold'); } // warm grasses sprout warm; most natives want cold-moist
function seedGrowOut(key){ return (PLANTS[key]||{}).growOut || SEED_GROWOUT_DEFAULT; }
function plantSpreads(key){ return (PLANTS[key]||{}).spreads || 'clump'; }  // clump | seed | run
function seedSeasonOf(key){ return (PLANTS[key]||{}).seedSeason || 'Fall'; }
function seedWild(key){ return (PLANTS[key]||{}).wild || 'common'; }         // forage rarity
function canSow(key){ const t=(PLANTS[key]||{}).type; return t==='grass'||t==='sedge'||t==='forb'; } // Phase 1: herbaceous only

// strict-next Spring start after day d (a Winter->Spring boundary == one
// completed winter). Spring begins wherever absDay % YEAR_DAYS === 0.
function nextSpringStart(d){ return (Math.floor(d/YEAR_DAYS)+1)*YEAR_DAYS; }
function stratCycles(strat){ return strat==='double' ? 2 : strat==='cold' ? 1 : 0; }
function germDay(sown, strat){ let d=sown; for (let i=stratCycles(strat);i>0;i--) d=nextSpringStart(d); return d; }
// first day at which `growDays` growing days have elapsed since `start`
function growthDayAfter(start, growDays){
  if (growDays<=0) return start;
  const cap=start+growDays+YEAR_DAYS*8;            // generous: winters don't tick
  let d=start; while (d<cap && growingDays(start,d)<growDays) d++;
  return d;
}
function flatReadyDay(flat){ return growthDayAfter(germDay(flat.sown,flat.strat), flat.grow); }
// 'stratifying' (cold seed still over winter) | 'growing' | 'ready' (a plug)
function flatStage(flat, now){
  if (now<germDay(flat.sown,flat.strat)) return 'stratifying';
  return now>=flatReadyDay(flat) ? 'ready' : 'growing';
}

// --- inventory (stateful; Story mode): seeds you hold, flats sown, plugs grown ---
function ensurePropState(){ if (!game.seeds) game.seeds={}; if (!game.flats) game.flats=[]; if (!game.stock) game.stock={}; }
function seedCount(key){ return (game.seeds&&game.seeds[key])||0; }
function stockCount(key){ return (game.stock&&game.stock[key])||0; }
function addSeed(key, n){ ensurePropState(); game.seeds[key]=(game.seeds[key]||0)+(n||1); }
function giveStarterSeeds(){ for (const k in STARTER_SEEDS) addSeed(k, STARTER_SEEDS[k]); }
function sowSeed(key){
  ensurePropState();
  if (!canSow(key) || seedCount(key)<=0) return null;
  if (--game.seeds[key]<=0) delete game.seeds[key];
  const flat={s:key, sown:absDay(), strat:seedStrat(key), grow:seedGrowOut(key), t:Date.now()};
  game.flats.push(flat); return flat;
}
function harvestReadyFlats(now){
  ensurePropState();
  if (now===undefined) now=absDay();
  let n=0; const keep=[];
  for (const f of game.flats){
    if (flatStage(f,now)==='ready'){ game.stock[f.s]=(game.stock[f.s]||0)+1; n++; }
    else keep.push(f);
  }
  game.flats=keep; return n;
}
function useStock(key){ ensurePropState(); if (stockCount(key)<=0) return false; if (--game.stock[key]<=0) delete game.stock[key]; return true; }

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
  game.elevation[k]=n===0 ? {removed:true,t:Date.now()} : {h:n,t:Date.now()};
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

/* ---------- main render ---------- */
const cnv = document.getElementById('gameCanvas');
const cx = cnv.getContext('2d');
let DPR = Math.min(2, window.devicePixelRatio||1);
/* view zoom: a small-screen base (phones start at 0.75x for ~1.3x more
   garden) times the player's own zoom — pinch, wheel, +/- keys, or the
   zoom pill. All drawing and input math runs through ZOOM. */
let ZOOM = 1, baseZoom = 1, userZoom = 1;
function calcZoom(){
  baseZoom = Math.min(innerWidth,innerHeight)<760 ? 0.75 : 1;
  ZOOM = Math.max(0.4, Math.min(1.8, baseZoom*userZoom));
}
function setUserZoom(z){
  userZoom = Math.max(0.4, Math.min(2.2, z));
  calcZoom(); if (game.mode && game.gameMode!=='design' && game.tool!=='hand') snapCam(); // design/hand keep a free camera
}
function zoomBy(f){ setUserZoom(userZoom*f); }
calcZoom();
// The true full-screen height under viewport-fit=cover. Measured on an iPhone
// standalone PWA: innerHeight / 100% / 100dvh all report the SHORT height (they
// stop ~one inset short of the screen), while 100vh / 100lvh span the whole
// screen. So take the LARGEST candidate — robust no matter which unit a given
// iOS version gets wrong — instead of trusting any single one.
function probeUnitH(unit){
  const d=document.createElement('div');
  d.style.cssText='position:fixed;left:-300px;top:0;width:0;height:'+unit+';visibility:hidden;pointer-events:none';
  document.body.appendChild(d); const h=d.getBoundingClientRect().height; d.remove(); return h||0;
}
function trueViewH(){ return Math.round(Math.max(innerHeight, probeUnitH('100vh'), probeUnitH('100lvh'))); }
function setViewportFill(color){
  if (!color) return;
  document.documentElement.style.setProperty('--viewport-fill', color);
  document.documentElement.style.background = color;
  document.body.style.background = color;
  const theme=document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', color);
}
// VW/VH = the canvas's true CSS-pixel size; render + pointer math use them, so
// the garden fills the whole screen and clicks stay accurate. sizeCanvas FORCES
// the canvas box to that size via inline style, overriding any (stale or short)
// CSS height so the --loam body bg can't leak as a band behind the home bar.
let VW=innerWidth, VH=innerHeight, activeCanvasId='menuCanvas';
function activeCanvas(){ return document.getElementById(activeCanvasId)||cnv; }
function sizeCanvas(c, opts){
  if (!c) return;
  const active=!!(opts&&opts.active);
  const h=trueViewH();
  const r=c.getBoundingClientRect();
  const w=Math.round(r.width||c.clientWidth||innerWidth);
  c.style.width=w+'px'; c.style.height=h+'px';
  if (active){ VW=w; VH=h; }   // the visible/active canvas owns render + pointer size
  c.width=w*DPR; c.height=h*DPR;
  c.getContext('2d').setTransform(DPR,0,0,DPR,0,0);
}
function setActiveCanvas(c){
  if (!c) return;
  activeCanvasId=c.id||activeCanvasId;
  sizeCanvas(c,{active:true});
  const other=c.id==='gameCanvas' ? document.getElementById('menuCanvas') : cnv;
  if (other) sizeCanvas(other,{active:false});
  const settle=()=>{ sizeCanvas(c,{active:true}); calcZoom(); };
  requestAnimationFrame(settle);
  requestAnimationFrame(()=>requestAnimationFrame(settle));
}
function resizeCanvases(){
  setActiveCanvas(activeCanvas());
  calcZoom();
}
addEventListener('resize', resizeCanvases);

let snowFlakes = [];
/* The ground (961 tiles, each a pile of fills/strokes/blades) is identical
   every frame unless the camera, season, window, or terrain changes — yet it
   was the entire frame cost (~12ms). So render it once to an offscreen layer
   and blit it; rebuild only when the cache key changes. groundDataSig captures
   the terrain/elevation/house data cheaply (it's sparse — usually empty), and
   camera/season/size go straight in the key. Trade-off: water ripples freeze
   while the view is perfectly still; any pan or edit resumes them. */
let groundCanvas=null, groundCtx=null, groundKey='';
function groundDataSig(){
  let s='';
  for (const k in game.terrain){ const o=game.terrain[k]; if (o&&!o.removed) s+=k+o.k+(o.c||'')+';'; }
  for (const k in game.elevation){ const o=game.elevation[k]; if (o&&!o.removed) s+='e'+k+o.h+';'; }
  const hs=game.houses||[]; for (let i=0;i<hs.length;i++){ const h=hs[i]; s+='H'+h.x+','+h.y+','+h.w+','+h.h+';'; }
  return s;
}
function paintGround(ctx,x0,x1,y0,y1,W,H,amb,t){
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    const showLand=layerShown('landscape');
    const terrObj=showLand?terrainAt(x,y):null, terr=terrObj&&terrObj.k;
    const path=terr==='path';
    const water=terr==='water';
    const rs=mulberry(tileSeed(x,y));
    let col;
    if (water) col = waterFill(terrObj,amb.snow);
    else if (path) col = pathFill(terrObj,amb.snow);
    else if (showLand && isDoor(x,y)) col = amb.snow?'#aaa49a':'#a89a80';   // flagstone doorstep
    else if (terr==='bed') col = shade(bedFill(terrObj,amb),(rs()-0.5)*12);
    else col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14);
    drawElevationSides(ctx,W,H,x,y,col);
    if (water) drawWaterTexture(ctx,sx,sy,x,y,terrObj,amb,t);
    else drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,col,rs,terrObj);
    drawElevationRim(ctx,sx,sy,elevationAt(x,y));
    if (amb.snow && !path && !water && rs()>0.4){ ctx.fillStyle='rgba(238,242,248,0.7)';
      ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); }
  }
}
function render(t){
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  // sky
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,amb.sky[0]); g.addColorStop(1,amb.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,W,H);
  drawSeasonSky(cx,W,H,cal.season);

  // camera eases toward the player (story only; design and Hand tool pan freely)
  if (game.gameMode!=='design' && game.tool!=='hand'){
    const [ptx,pty]=screenOf(game.px,game.py,W,H);
    cam.x += (ptx-W/2)*0.06; cam.y += (pty-H*0.45)*0.06;
  }

  const sway = Math.sin(t*0.0012);

  // visible tile window: invert the four screen corners to world tiles
  // and take the padded bounding box, so we only walk what's on screen
  // (the padding covers plant/cottage heights overhanging tile bounds)
  const crn=[tileAt(0,0,W,H),tileAt(W,0,W,H),tileAt(0,H,W,H),tileAt(W,H,W,H)];
  const pad=5; // large shrubs can overhang several tile centers
  const x0=Math.max(0,Math.min(crn[0][0],crn[1][0],crn[2][0],crn[3][0])-pad);
  const x1=Math.min(GW-1,Math.max(crn[0][0],crn[1][0],crn[2][0],crn[3][0])+pad);
  const y0=Math.max(0,Math.min(crn[0][1],crn[1][1],crn[2][1],crn[3][1])-pad);
  const y1=Math.min(GH-1,Math.max(crn[0][1],crn[1][1],crn[2][1],crn[3][1])+pad);
  const shadeTrees=[], futureShadeTrees=[], visibleShrubs=[], visibleLights=[];
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const shrub=shrubInfoFromKey(k);
    if (shrub && layerShown('woody')){
      const r=Math.ceil(shrubRadiusTiles(plantDef(p.s,p.v)))+1;
      if (!(shrub.x+r<x0 || shrub.x-r>x1 || shrub.y+r<y0 || shrub.y-r>y1)) visibleShrubs.push(shrub);
    }
    const sh=treeShadeInfo(k,p);
    if (!sh || sh.r<1) continue;
    const reach=treeShadeReach(sh);
    if (sh.x+reach<x0 || sh.x-reach>x1 || sh.y+reach<y0 || sh.y-reach>y1) continue;
    (sh.activePotential?shadeTrees:futureShadeTrees).push(sh);
  }
  if (layerShown('landscape')) for (const k in game.lights){ const l=game.lights[k];
    if (!l || l.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    visibleLights.push({l,x,y});
  }

  const tG0=dbg.on?performance.now():0;
  // ground tiles: static per camera/terrain/season, so render once to an
  // offscreen layer and blit it; rebuild only when the cache key changes.
  const gkey=cal.season+'|'+game.rot+'|'+ZOOM+'|'+cam.x+'|'+cam.y+'|'+
    (layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height+'|'+groundDataSig();
  if (!groundCanvas){ groundCanvas=document.createElement('canvas'); groundCtx=groundCanvas.getContext('2d'); }
  if (groundCanvas.width!==cnv.width||groundCanvas.height!==cnv.height){
    groundCanvas.width=cnv.width; groundCanvas.height=cnv.height; groundKey=''; }
  if (gkey!==groundKey){
    groundCtx.setTransform(1,0,0,1,0,0); groundCtx.clearRect(0,0,groundCanvas.width,groundCanvas.height);
    groundCtx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
    paintGround(groundCtx,x0,x1,y0,y1,W,H,amb,t);
    groundKey=gkey;
  }
  cx.save(); cx.setTransform(1,0,0,1,0,0); cx.drawImage(groundCanvas,0,0); cx.restore();
  if (layerShown('woody')) visibleShrubs.forEach(sh=>drawShrubFootprint(cx,W,H,sh,'base'));
  // active shade is a cool wash; young trees get only a faint future-canopy edge.
  shadeTrees.forEach(sh=>{
    const rr=treeShadeReach(sh);
    for (let yy=Math.max(y0,sh.y-rr); yy<=Math.min(y1,sh.y+rr); yy++)
      for (let xx=Math.max(x0,sh.x-rr); xx<=Math.min(x1,sh.x+rr); xx++){
        const score=treeShadeScore(sh,xx,yy);
        if (score<SHADE_ACTIVE_SCORE) continue;
        const [sx,sy]=screenOf(xx,yy,W,H);
        const a=(0.06+0.18*score)*(0.65+0.35*sh.est);
        tileDiamond(cx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
      }
  });
  futureShadeTrees.forEach(sh=>{
    const rr=treeShadeReach(sh);
    for (let yy=Math.max(y0,sh.y-rr); yy<=Math.min(y1,sh.y+rr); yy++)
      for (let xx=Math.max(x0,sh.x-rr); xx<=Math.min(x1,sh.x+rr); xx++){
        const score=treeShadeScore(sh,xx,yy);
        if (score>=SHADE_FUTURE_SCORE && score<SHADE_ACTIVE_SCORE){
          const [sx,sy]=screenOf(xx,yy,W,H);
          tileDiamond(cx,sx,sy,null,'rgba(210,168,92,0.34)',[5,5]);
        }
      }
  });
  // Shade-suitability overlay (Layers view): wash every tile by how much
  // canopy reaches it — amber = full sun, teal = shade, between = part shade
  if (game.layerVis.shade){
    for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
      let score=0;
      shadeTrees.forEach(sh=>{ const s=treeShadeScore(sh,xx,yy); if (s>score) score=s; });
      const [sx,sy]=screenOf(xx,yy,W,H);
      if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
      const col = score>=SHADE_ACTIVE_SCORE ? 'rgba(38,84,112,0.52)'      // shade — cool blue
        : score>0 ? 'rgba(70,132,128,0.44)'                              // part shade — teal
        : 'rgba(232,180,78,0.40)';                                       // full sun — amber
      tileDiamond(cx,sx,sy,col,null);
    }
  }
  const focusedShrub=layerShown('woody') && game.focusPlantKey ? shrubInfoFromKey(game.focusPlantKey) : null;
  if (focusedShrub) drawShrubFootprint(cx,W,H,focusedShrub,'focus');
  const hoverShrub=layerShown('woody') && game.hoverTile ? shrubAt(game.hoverTile[0],game.hoverTile[1]) : null;
  if (hoverShrub){
    let mode='hover';
    if (isPlacementTool(game.tool) && !['hand','select','pick','shovel','house'].includes(game.tool)){
      mode='blocked';
      if (PLANTS[game.tool] && plantDef(game.tool,game.toolVar).type==='shrub'){
        const [txh,tyh]=game.hoverTile, draft={s:game.tool,v:game.toolVar||null,d:absDay()};
        if (canPlaceShrubAt(txh,tyh,draft).ok) mode='hover';
      }
    }
    drawShrubFootprint(cx,W,H,hoverShrub,mode);
  }
  game.shrubFx=game.shrubFx.filter(f=>t-f.t0<760);
  game.shrubFx.forEach(f=>{
    const sh=shrubInfoFromKey(f.key);
    if (sh && layerShown('woody')) drawShrubFootprint(cx,W,H,sh,'pulse',t-f.t0);
  });
  // hover/selection cursor on player's tile
  const [hx,hy]=screenOf(game.tx,game.ty,W,H);
  cx.strokeStyle='rgba(243,236,221,0.85)'; cx.lineWidth=2;
  cx.beginPath(); cx.moveTo(hx,hy+2); cx.lineTo(hx+TILE_W/2-3,hy+TILE_H/2);
  cx.lineTo(hx,hy+TILE_H-2); cx.lineTo(hx-TILE_W/2+3,hy+TILE_H/2); cx.closePath(); cx.stroke();
  if (game.hoverTile && PLANTS[game.tool]){
    const def=plantDef(game.tool,game.toolVar);
    if (def && def.type==='shrub'){
      const [txh,tyh]=game.hoverTile, draft={s:game.tool,v:game.toolVar||null,d:absDay()};
      const ok=canPlaceShrubAt(txh,tyh,draft).ok;
      drawShrubFootprint(cx,W,H,{x:txh,y:tyh,p:draft},ok?'hover':'blocked');
    }
    if (def && def.sun!=='part' && def.type!=='tree' && def.type!=='bulb'){
      const [txh,tyh]=game.hoverTile, sh=shadeInfoAt(txh,tyh,true);
      if (sh){ const [sx,sy]=screenOf(txh,tyh,W,H);
        tileDiamond(cx,sx,sy,sh.active?'rgba(150,42,32,0.16)':'rgba(210,168,92,0.13)',
          sh.active?'rgba(230,118,92,0.88)':'rgba(234,188,102,0.78)',sh.active?null:[5,4]); }
    }
  }

  // RTS-style placement ghost while the House tool is armed: tinted
  // footprint (red when you're standing in it) under a translucent house
  let ghost=null;
  if (game.tool==='house' && game.hoverTile && game.houseDraft){
    const h=game.houseDraft;
    const gx=Math.max(0,Math.min(GW-h.w,game.hoverTile[0]));
    const gy=Math.max(0,Math.min(GH-h.h-1,game.hoverTile[1]));
    const ppx=Math.round(game.px), ppy=Math.round(game.py);
    const onAvatar = game.gameMode!=='design' && ppx>=gx&&ppx<gx+h.w&&ppy>=gy&&ppy<gy+h.h;
    const onHouse = game.houses.some(o=>gx<o.x+o.w&&gx+h.w>o.x&&gy<o.y+o.h&&gy+h.h>o.y);
    const blocked = onAvatar || onHouse;
    ghost=Object.assign({},h,{x:gx,y:gy,blocked});
    cx.fillStyle = blocked ? 'rgba(220,90,70,0.34)' : 'rgba(140,205,125,0.30)';
    for (let yy=gy; yy<gy+h.h; yy++) for (let xx=gx; xx<gx+h.w; xx++){
      const [sx,sy]=screenOf(xx,yy,W,H);
      cx.beginPath(); cx.moveTo(sx,sy); cx.lineTo(sx+TILE_W/2,sy+TILE_H/2);
      cx.lineTo(sx,sy+TILE_H); cx.lineTo(sx-TILE_W/2,sy+TILE_H/2); cx.closePath(); cx.fill();
    }
    const [dgx,dgy]=doorPos(ghost), [dsx,dsy]=screenOf(dgx,dgy,W,H);
    cx.fillStyle='rgba(243,236,221,0.45)';  // the doorstep-to-be
    cx.beginPath(); cx.moveTo(dsx,dsy); cx.lineTo(dsx+TILE_W/2,dsy+TILE_H/2);
    cx.lineTo(dsx,dsy+TILE_H); cx.lineTo(dsx-TILE_W/2,dsy+TILE_H/2); cx.closePath(); cx.fill();
  }

  // depth-sorted entities: plants + critters + the cottage,
  // culled to the same visible window as the ground
  if (dbg.on) dbg.accGround+=performance.now()-tG0;
  const tE0=dbg.on?performance.now():0;
  const ents=[];
  if (layerShown('landscape')) for (const k in game.fences){
    const f=game.fences[k]; if (f.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    ents.push({depth:viewDepth(x,y)+0.34, draw:()=>drawFence(cx,W,H,cal.season,f,x,y)});
  }
  visibleLights.forEach(({l,x,y})=>{
    ents.push({depth:viewDepth(x,y)+0.36, draw:()=>drawLightFixture(cx,W,H,cal.season,l,x,y,game.layerVis.night)});
  });
  if (layerShown('landscape')) for (const k in game.firepits){
    const f=game.firepits[k]; if (!f || f.removed) continue;
    const [x,y]=k.split(',').map(Number), sz=firepitTileSize(f);
    if (x+sz.w-1<x0||x>x1||y+sz.h-1<y0||y>y1) continue;
    ents.push({depth:viewDepth(x+sz.w-1,y+sz.h-1)+0.37, draw:()=>drawFirepit(cx,W,H,cal.season,f,x,y)});
  }
  if (layerShown('landscape')) for (const hh of game.houses){
    if (hh.x+hh.w-1>=x0 && hh.x<=x1 && hh.y+hh.h-1>=y0 && hh.y<=y1)
      ents.push({depth:houseDrawDepth(hh), draw:()=>drawHouse(cx,W,H,cal.season,hh)});
  }
  if (ghost)
    ents.push({depth:houseDrawDepth(ghost)+0.01,
      draw:()=>{ cx.globalAlpha=0.55; drawHouse(cx,W,H,cal.season,ghost); cx.globalAlpha=1; }});
  // active canopies stunt full-sun plants beneath them (they persist, smaller)
  // the bulb layer: invisible most of the year, so cull hard
  if (layerShown('bulbs'))
  for (const k in game.bulbs){ const p=game.bulbs[k];
    if (p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    const gB=plantGrowth(p); if (gB<=0.02) continue;
    ents.push({depth:plantDepth(x,y,p)+0.25, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlant(cx,sx,sy+TILE_H/2,p.s,gB,cal.season,(tileSeed(x,y)^0x9e37)>>>0,sway,p.v);}});
  }
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    if (!layerShown(plantLayerOf(p))) continue;       // perennials/woody view toggle
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    let g2v=plantGrowth(p);
    const P2=PLANTS[p.s];
    if (P2 && P2.sun!=='part' && P2.type!=='tree' &&
        shadeTrees.some(sh=>sh.p!==p && treeShadeScore(sh,x,y)>=SHADE_ACTIVE_SCORE))
      g2v*=0.45; // struggling under the canopy
    const detail=plantRenderDetail(x,y,p,W,H);
    ents.push({depth:plantDepth(x,y,p)+0.3, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlant(cx,sx,sy+TILE_H/2,p.s,g2v,cal.season,tileSeed(x,y),sway,p.v,undefined,detail);}});
  }
  // local player (smooth move) — story mode only; design has no avatar
  let dx=game.px, dy=game.py;
  if (game.gameMode!=='design')
  ents.push({depth:viewDepth(dx,dy)+0.5, draw:()=>{ const [sx,sy]=screenOf(dx,dy,W,H);
    drawCritter(cx,sx,sy+TILE_H/2,game.char,t,game.moving,1);
    cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
    const nm=game.char.name||'You', wN=cx.measureText(nm).width;
    cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
    cx.fillStyle='#f3ecdd'; cx.textAlign='center'; cx.fillText(nm,sx,sy-31); }});
  // other gardeners
  for (const id in game.others){ const o=game.others[id];
    if (Date.now()-o.ts > 30000) continue;
    ents.push({depth:viewDepth(o.x,o.y)+0.5, draw:()=>{ const [sx,sy]=screenOf(o.x,o.y,W,H);
      drawCritter(cx,sx,sy+TILE_H/2,{species:o.sp,coat:o.c,coatD:o.cd,mark:o.m},t,false,1);
      cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
      const wN=cx.measureText(o.n).width;
      cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
      cx.fillStyle='#cfe3c2'; cx.textAlign='center'; cx.fillText(o.n,sx,sy-31); }});
  }
  ents.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());
  if (dbg.on){ dbg.accEnts+=performance.now()-tE0; dbg.ents=ents.length; dbg.tiles=(x1-x0+1)*(y1-y0+1); }

  // planting pulses: an expanding diamond so a tap visibly took
  game.fx=game.fx.filter(f=>t-f.t0<550);
  game.fx.forEach(f=>{
    const a=(t-f.t0)/550, e2=0.55+a*0.85;
    const [sx,sy]=screenOf(f.x+(f.ox||0),f.y+(f.oy||0),W,H), cyx=sy+TILE_H/2;
    cx.strokeStyle=`rgba(243,236,221,${0.95*(1-a)})`; cx.lineWidth=2.5;
    cx.beginPath();
    cx.moveTo(sx, cyx-(TILE_H/2)*e2); cx.lineTo(sx+(TILE_W/2)*e2, cyx);
    cx.lineTo(sx, cyx+(TILE_H/2)*e2); cx.lineTo(sx-(TILE_W/2)*e2, cyx);
    cx.closePath(); cx.stroke();
  });

  // selection tool: marquee, committed selection, and move/copy ghost
  if (game.tool==='select') drawSelectionOverlay(cx,W,H,t,cal.season,sway);

  // season light tint + falling snow
  applySeasonLighting(cx,W,H,amb,cal.season);
  if (amb.snow){
    if (snowFlakes.length<70 && Math.random()<0.5)
      snowFlakes.push({x:Math.random()*W,y:-5,v:0.4+Math.random()*0.7,r:1+Math.random()*1.6,w:Math.random()*7});
    cx.fillStyle='rgba(245,248,252,0.85)';
    snowFlakes.forEach(f=>{ f.y+=f.v; f.x+=Math.sin((t*0.001)+f.w)*0.3;
      cx.beginPath(); cx.arc(f.x,f.y,f.r,0,7); cx.fill(); });
    snowFlakes=snowFlakes.filter(f=>f.y<H+5);
  } else snowFlakes.length=0;
  if (game.layerVis.night){
    applyDuskLighting(cx,W,H,cal.season);
    visibleLights.forEach(({l,x,y})=>drawLightGlow(cx,W,H,l,x,y));
  }

  if (game.photo){ // golden-hour wash, only on the captured frame
    const g2=cx.createRadialGradient(W*0.72,H*0.22,30, W*0.72,H*0.22,H*0.95);
    g2.addColorStop(0,'rgba(255,212,140,0.38)');
    g2.addColorStop(0.5,'rgba(228,160,90,0.10)');
    g2.addColorStop(1,'rgba(50,35,55,0.24)');
    cx.fillStyle=g2; cx.fillRect(0,0,W,H);
  }
}

function selDrawRect(cx,W,H,r,fill,stroke){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    if (x<0||y<0||x>=GW||y>=GH) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,fill,stroke);
  }
}
function selMetricLabel(n){
  const inches=n*TILE_IN;
  if (inches<24) return `${inches} in`;
  const feet=inches/12;
  return `${Number.isInteger(feet)?feet:feet.toFixed(1)} ft`;
}
function drawSelMetricLabel(cx,x,y,label){
  cx.font='700 11px "IBM Plex Sans", sans-serif';
  cx.textAlign='center';
  cx.textBaseline='middle';
  cx.lineWidth=4;
  cx.strokeStyle='rgba(243,236,221,0.9)';
  cx.fillStyle='#172733';
  cx.strokeText(label,x,y);
  cx.fillText(label,x,y);
}
function drawSelDimLine(cx,a,b,label,side){
  const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
  if (len<4) return;
  const ux=dx/len, uy=dy/len, nx=-dy/len, ny=dx/len;
  const off=20*side, tick=7, labelOff=13*side, inset=Math.min(12,len*0.2);
  const edgeA=[a[0]+ux*inset,a[1]+uy*inset];
  const edgeB=[b[0]-ux*inset,b[1]-uy*inset];
  const ax=edgeA[0]+nx*off, ay=edgeA[1]+ny*off;
  const bx=edgeB[0]+nx*off, by=edgeB[1]+ny*off;
  cx.save();
  cx.strokeStyle='#72c9ff';
  cx.lineWidth=3;
  cx.lineCap='round';
  cx.lineJoin='round';
  cx.beginPath();
  cx.moveTo(edgeA[0]+nx*3*side,edgeA[1]+ny*3*side); cx.lineTo(ax,ay);
  cx.moveTo(edgeB[0]+nx*3*side,edgeB[1]+ny*3*side); cx.lineTo(bx,by);
  cx.moveTo(ax,ay); cx.lineTo(bx,by);
  cx.moveTo(ax-nx*tick,ay-ny*tick); cx.lineTo(ax+nx*tick,ay+ny*tick);
  cx.moveTo(bx-nx*tick,by-ny*tick); cx.lineTo(bx+nx*tick,by+ny*tick);
  cx.stroke();

  if (label){
    const tx=(ax+bx)/2+nx*labelOff, ty=(ay+by)/2+ny*labelOff;
    drawSelMetricLabel(cx,tx,ty,label);
  }
  cx.restore();
}
function drawSelectionMetrics(cx,W,H,r){
  const w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  if (w<=0||h<=0) return;
  const a=screenOf(r.x0-0.5,r.y0-0.5,W,H);
  const b=screenOf(r.x1+0.5,r.y0-0.5,W,H);
  const c=screenOf(r.x1+0.5,r.y1+0.5,W,H);
  const d=screenOf(r.x0-0.5,r.y1+0.5,W,H);
  const wLabel=selMetricLabel(w), hLabel=selMetricLabel(h);
  const wLen=Math.hypot(c[0]-d[0],c[1]-d[1]);
  const hLen=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const compact=Math.min(wLen,hLen)<120;
  drawSelDimLine(cx,d,c,compact?null:wLabel,1);
  drawSelDimLine(cx,b,c,compact?null:hLabel,-1);
  if (compact){
    const cx0=(a[0]+b[0]+c[0]+d[0])/4, cy0=(a[1]+b[1]+c[1]+d[1])/4;
    drawSelMetricLabel(cx,cx0,cy0-18,w===h?`${wLabel} each side`:`${wLabel} x ${hLabel}`);
  }
}
function drawSelectionOverlay(cx,W,H,t,season,sway){
  if (selDrag){                                    // dragging out a marquee
    const r=normRect({x:selDrag.x0,y:selDrag.y0},{x:selDrag.x1,y:selDrag.y1});
    selDrawRect(cx,W,H,r,'rgba(120,195,255,0.22)','rgba(150,210,255,0.95)');
    drawSelectionMetrics(cx,W,H,r);
    return;
  }
  if (!game.sel) return;
  if (selMove){                                    // moving/copying: ghost + valid/invalid tiles
    const dx=selMove.curX-selMove.grabX, dy=selMove.curY-selMove.grabY;
    const items=game.selItems||[];
    selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.12)','rgba(150,210,255,0.45)');
    for (const c of items){
      const nx=c.x+dx, ny=c.y+dy, ok=selItemValidDest(c,nx,ny);
      const [sx,sy]=screenOf(nx,ny,W,H);
      tileDiamond(cx,sx,sy, ok?'rgba(120,210,130,0.28)':'rgba(220,90,70,0.42)',
        ok?'rgba(150,235,150,0.7)':'rgba(240,120,100,0.85)');
    }
    cx.save(); cx.globalAlpha=0.55;
    for (const c of items){
      const nx=c.x+dx, ny=c.y+dy; if (!selValidDest(nx,ny)) continue;
      const [sx,sy]=screenOf(nx,ny,W,H);
      if (c.fence) drawFence(cx,W,H,season,c.fence,nx,ny);
      if (c.light) drawLightFixture(cx,W,H,season,c.light,nx,ny,game.layerVis.night);
      if (c.firepit) drawFirepit(cx,W,H,season,c.firepit,nx,ny);
      if (c.bulb) drawPlant(cx,sx,sy+TILE_H/2,c.bulb.s,plantGrowth(c.bulb),season,(tileSeed(nx,ny)^0x9e37)>>>0,sway,c.bulb.v);
      if (c.plant) drawPlant(cx,sx,sy+TILE_H/2,c.plant.s,plantGrowth(c.plant),season,tileSeed(nx,ny),sway,c.plant.v);
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
}

/* ---------- movement & actions ---------- */
function tryMove(nx,ny){
  if (!canStand(nx,ny)||game.moving) return;
  game.fromX=game.px; game.fromY=game.py;
  game.tx=nx; game.ty=ny; game.moving=true; game.moveT=0;
  // diagonal grid steps cover more screen, so they take a bit longer
  game.moveDur = (Math.abs(nx-game.fromX)+Math.abs(ny-game.fromY)>1)?255:170;
}
function stepMove(dt){
  if (!game.moving) return;
  game.moveT += dt/game.moveDur;
  if (game.moveT>=1){ game.px=game.tx; game.py=game.ty; game.moving=false; pushPresence(); }
  else { game.px=game.fromX+(game.tx-game.fromX)*game.moveT;
         game.py=game.fromY+(game.ty-game.fromY)*game.moveT; }
}
function actHere(opts){
  const x=Math.round(game.tx), y=Math.round(game.ty), k=`${x},${y}`;
  if (isPlacementTool(game.tool)){
    const layer=toolTargetLayer(game.tool);
    if (blockIfWrongEditLayer(layer)) return;
    if (layer && !layerShown(layer)){ promptRevealLayer(layer,x,y); return; }
  }
  if (isDoor(x,y)){
    if (ENABLE_HOUSE_SLEEP) doSleep();
    else toast('The doorstep is just scenery for now.');
    return;
  }
  if (game.tool==='house'){ toast('Tap the spot where the house should stand.'); return; }
  if (game.tool==='fence'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fence needs clear ground outside the shrub spread.'); return; }
    const r=placeFenceAt(x,y);
    if (r){ syncFencesOut(); toast(`${fenceLabel()} placed.`); }
    else toast('Fence needs clear dry ground.');
    return;
  }
  if (game.tool==='light'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Lighting needs clear ground outside the shrub spread.'); return; }
    const r=placeLightAt(x,y);
    if (r){ syncLightsOut(); toast(`${lightLabel()} placed.`); }
    else toast('Lighting needs a clear dry tile.');
    return;
  }
  if (game.tool==='firepit'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fire pits need clear ground outside the shrub spread.'); return; }
    const r=placeFirepitAt(x,y);
    if (r){ syncFirepitsOut(); toast(`${firepitLabel()} placed.`); }
    else toast('Fire pit needs clear dry ground.');
    return;
  }
  if (isElevationTool(game.tool)){
    const before=elevationAt(x,y);
    if (applyToolAt(x,y)){
      syncElevationOut();
      const after=elevationAt(x,y);
      toast(game.tool==='level' ? 'Leveled ground.' : `Elevation ${after>before?'raised':'lowered'} to ${after}.`);
    } else {
      toast(game.tool==='raise' ? 'Already at the highest elevation.'
        : game.tool==='lower' ? 'Already at the lowest elevation.'
        : 'Already level.');
    }
    return;
  }
  const existing = game.plants[k], hasPlant = existing && !existing.removed;
  const shrubHit = shrubAt(x,y);
  const terrObj = terrainAt(x,y), terr = terrObj&&terrObj.k;
  const bulbHere=game.bulbs[k], hasBulb=bulbHere && !bulbHere.removed;
  if (game.tool==='shovel'){
    const counts={plants:0,bulbs:0,terr:0,elev:0,house:0,fence:0,light:0,firepit:0};
    eraseBrush(x,y,counts);
    const parts=[];
    if (counts.plants) parts.push(`${counts.plants} plant${counts.plants>1?'s':''}`);
    if (counts.bulbs) parts.push(`${counts.bulbs} bulb${counts.bulbs>1?'s':''}`);
    if (counts.terr) parts.push(`${counts.terr} terrain tile${counts.terr>1?'s':''}`);
    if (counts.elev) parts.push(`${counts.elev} elevation tile${counts.elev>1?'s':''}`);
    if (counts.fence) parts.push(`${counts.fence} fence${counts.fence>1?'s':''}`);
    if (counts.light) parts.push(`${counts.light} light${counts.light>1?'s':''}`);
    if (counts.firepit) parts.push(`${counts.firepit} fire pit${counts.firepit>1?'s':''}`);
    if (counts.house) parts.push(`${counts.house} house${counts.house>1?'s':''}`);
    if (parts.length){
      toast(`Erased ${parts.join(' and ')}.`);
      if (counts.plants) syncPlantsOut();
      if (counts.bulbs) syncBulbsOut();
      if (counts.terr) syncTerrainOut();
      if (counts.elev) syncElevationOut();
      if (counts.fence) syncFencesOut();
      if (counts.light) syncLightsOut();
      if (counts.firepit) syncFirepitsOut();
      if (counts.house) pushHouse();
    } else toast('Nothing to erase here.');
    return;
  }
  if (game.tool==='path'||game.tool==='bed'||game.tool==='water'){
    if (hasPlant){ toast('Lift the plant first.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Lift the shrub first — its mature spread claims this ground.'); return; }
    if (hasBulb && game.tool==='water'){ toast('Dig the bulb first.'); return; }
    if (game.tool==='water' && lightAt(x,y)){ toast('Move the light before making water.'); return; }
    if (firepitAt(x,y)){ toast('Move the fire pit before changing the ground.'); return; }
    if (game.tool==='water' && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)){
      toast('Step aside before making water.'); return;
    }
    if (terr===game.tool){
      if (game.tool==='water' && waterStyleId(terrObj.c)!==game.waterStyle){
        game.terrain[k]={k:'water',c:game.waterStyle,t:Date.now()}; game.dirty=true;
        toast(`${waterStyle(game.waterStyle).label} water applied.`);
        syncTerrainOut();
        return;
      }
      if (game.tool==='path' && pathColorId(terrObj.c)!==game.pathColor){
        game.terrain[k]={k:'path',c:game.pathColor,t:Date.now()}; game.dirty=true;
        toast(`${pathColor(game.pathColor).label} path color applied.`);
        syncTerrainOut();
        return;
      }
      if (game.tool==='bed' && bedStyleId(terrObj.c)!==game.bedStyle){
        game.terrain[k]={k:'bed',c:game.bedStyle,t:Date.now()}; game.dirty=true;
        toast(`${bedStyle(game.bedStyle).label} bed applied.`);
        syncTerrainOut();
        return;
      }
      toast(terr==='path'?'Already a path.':terr==='water'?'Already water.':'Already a bed.'); return;
    }
    game.terrain[k]=game.tool==='path'
      ? {k:'path',c:game.pathColor,t:Date.now()}
      : game.tool==='water'
      ? {k:'water',c:game.waterStyle,t:Date.now()}
      : {k:'bed',c:game.bedStyle,t:Date.now()};
    game.dirty=true;
    toast(game.tool==='path'?`${pathColor(game.pathColor).label} path laid.`
      : game.tool==='water'?`${waterStyle(game.waterStyle).label} water laid.`
      :`${bedStyle(game.bedStyle).label} bed dug. Ready for planting.`);
    syncTerrainOut();
    return;
  }
  if (fenceAt(x,y)){ toast('Fence is in the way.'); return; }
  if (lightAt(x,y)){ toast('A light is in the way.'); return; }
  if (firepitAt(x,y)){ toast('A fire pit is in the way.'); return; }
  const def=PLANTS[game.tool] ? plantDef(game.tool,game.toolVar) : null;
  if (!def) return;
  if (def.type==='water'){
    if (terr!=='water'){ toast('Water plants need a pond, river, or lake tile.'); return; }
    if (hasPlant){ showPlantCard(existing,x,y); return; }
    if (hasBulb){ toast('Lift the bulb before planting in water.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Water plants need open water outside the shrub spread.'); return; }
    const shadeTree=shadeInfoAt(x,y,false);
    if (shadeTree && def.sun!=='part'){
      toast(`Active canopy shade from the ${PLANTS[shadeTree.p.s].name.toLowerCase()} — part-shade water plants only.`);
      return;
    }
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n,opts); return; }
    if (applyToolAt(x,y,opts)){ syncPlantsOut(); toast(`Planted ${def.name} in the water.`); }
    else toast('No open water here.');
    return;
  }
  if (def.type==='bulb'){ // bulbs go UNDER perennials — but not under trees or shrubs
    if (hasBulb){ showPlantCard(bulbHere,x,y); return; }
    if (terr==='path'||terr==='water'){ toast(terr==='water'?'Not in the water.':'Not in the gravel — lift the path first.'); return; }
    if (shrubHit){
      pulseShrubFootprint(shrubHit);
      toast(`No bulbs under ${plantDef(shrubHit.p.s,shrubHit.p.v).name.toLowerCase()} — the shrub claims that ground.`);
      return;
    }
    if (hasPlant && plantLayerOf(existing)==='woody'){
      toast('No bulbs under trees or shrubs — their roots claim that ground.'); return; }
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n,opts); return; }
    if (applyToolAt(x,y,opts)){ syncBulbsOut();
      toast(`Tucked in ${def.name} — it shows at first thaw.`); }
    else toast('No spot for a bulb here.');
    return;
  }
  if (terr==='path'||terr==='water'){ toast(terr==='water'?'Dry land first — land plants and ponds disagree.':'Dig the path up first — plants and gravel disagree.'); return; }
  if (shrubHit && def.type!=='shrub' && (!hasPlant || shrubHit.key!==k)){
    pulseShrubFootprint(shrubHit);
    showPlantCard(shrubHit.p,shrubHit.x,shrubHit.y);
    toast(`${plantDef(shrubHit.p.s,shrubHit.p.v).name} needs this mature spread.`);
    return;
  }
  if (hasPlant){ showPlantCard(existing,x,y); return; }
  const shadeTree=shadeInfoAt(x,y,false);
  if (shadeTree && def.sun!=='part'){
    toast(`Active canopy shade from the ${PLANTS[shadeTree.p.s].name.toLowerCase()} — shade-tolerant plants only.`);
    return;
  }
  const n=game.drift?driftCount(def):1;
  if (n>1){ stampDrift(x,y,n,opts); return; }
  if (applyToolAt(x,y,opts)){ syncPlantsOut();
    toast(`Planted ${def.name}.${def.type==='forb'||def.type==='grass'?' Drifts of 3+ read better — try the Drift toggle.':''}`); }
  else toast('No room here.');
}
function plantFx(x,y,p){ const o=plantOffset(p); game.fx.push({x,y,ox:o.ox,oy:o.oy,t0:performance.now()}); }
function freePlantable(def){ return !!(game.freePlanting && def && !['bulb','shrub','tree'].includes(def.type)); }
function clampPlantOffset(v){ return Math.max(-0.44,Math.min(0.44,Number.isFinite(+v)?+v:0)); }
function roundedOffset(v){ return Math.round(clampPlantOffset(v)*100)/100; }
function naturalPlantOffset(x,y,opts){
  if (opts && Number.isFinite(+opts.ox) && Number.isFinite(+opts.oy))
    return {ox:roundedOffset(opts.ox), oy:roundedOffset(opts.oy)};
  const rs=mulberry((tileSeed(x,y) ^ Date.now())>>>0);
  return {ox:roundedOffset((rs()-0.5)*0.78), oy:roundedOffset((rs()-0.5)*0.78)};
}
/* drift planting: one action stamps a loose, natural cluster. Tighter
   spacers come in bigger drifts; woody plants always plant singly. */
function driftCount(def){
  if (def.type==='shrub'||def.type==='tree') return 1;
  return def.space<=6?9 : def.space<=12?7 : def.space<=18?5 : def.space<=30?3 : 1;
}
/* the one silent placer behind drifts, drags, and single planting:
   puts the armed tool on a tile if it fits, no toasts. Returns what
   it placed ('plant'|'bulb'|'path'|'bed'|'water'|'fence'|'gate'|'light') or null. */
function applyToolAt(x,y,opts){
  if (x<0||y<0||x>=GW||y>=GH) return null;
  if (inHouse(x,y) || isDoor(x,y)) return null;
  const k=`${x},${y}`, terrObj=terrainAt(x,y), terr=terrObj&&terrObj.k;
  if (game.tool==='fence') return placeFenceAt(x,y);
  if (game.tool==='light') return placeLightAt(x,y);
  if (game.tool==='firepit') return placeFirepitAt(x,y);
  if (isElevationTool(game.tool)) return applyElevationTool(x,y) ? 'elevation' : null;
  if (game.tool==='path'||game.tool==='bed'||game.tool==='water'){
    const ex=game.plants[k], eb=game.bulbs[k];
    if (ex && !ex.removed) return null;
    if (shrubAt(x,y)) return null;
    if (game.tool==='water' && fenceAt(x,y)) return null;
    if (game.tool==='water' && lightAt(x,y)) return null;
    if (firepitAt(x,y)) return null;
    if (game.tool==='water' && eb && !eb.removed) return null;
    if (game.tool==='water' && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return null;
    if (terr===game.tool){
      if (game.tool==='water' && waterStyleId(terrObj.c)!==game.waterStyle){
        game.terrain[k]={k:'water',c:game.waterStyle,t:Date.now()}; game.dirty=true;
        return 'water';
      }
      if (game.tool==='path' && pathColorId(terrObj.c)!==game.pathColor){
        game.terrain[k]={k:'path',c:game.pathColor,t:Date.now()}; game.dirty=true;
        return 'path';
      }
      if (game.tool==='bed' && bedStyleId(terrObj.c)!==game.bedStyle){
        game.terrain[k]={k:'bed',c:game.bedStyle,t:Date.now()}; game.dirty=true;
        return 'bed';
      }
      return null;
    }
    game.terrain[k]=game.tool==='path'
      ? {k:'path',c:game.pathColor,t:Date.now()}
      : game.tool==='water'
      ? {k:'water',c:game.waterStyle,t:Date.now()}
      : {k:'bed',c:game.bedStyle,t:Date.now()};
    game.dirty=true;
    return game.tool;
  }
  if (!PLANTS[game.tool]) return null;
  if (game.plantFromStock && stockCount(game.tool)<=0) return null; // armed a plug but none left
  const def=plantDef(game.tool,game.toolVar);
  if (fenceAt(x,y)) return null;
  if (lightAt(x,y)) return null;
  if (firepitAt(x,y)) return null;
  const np={s:game.tool,d:absDay(),t:Date.now()};
  if (game.toolVar) np.v=game.toolVar;
  if (def.type==='water'){
    const ex=game.plants[k], eb=game.bulbs[k];
    if (terr!=='water') return null;
    if ((ex && !ex.removed) || (eb && !eb.removed)) return null;
    if (shrubAt(x,y)) return null;
    const sh=shadeAt(x,y);
    if (sh && def.sun!=='part') return null;
    if (freePlantable(def)) Object.assign(np,naturalPlantOffset(x,y,opts));
    game.plants[k]=np; game.dirty=true; plantFx(x,y,np);
    return 'plant';
  }
  if (terr==='path'||terr==='water') return null;
  if (def.type==='bulb'){ // bulbs tuck in under perennials — but not under trees/shrubs
    const eb=game.bulbs[k];
    if (eb && !eb.removed) return null;
    if (shrubAt(x,y)) return null;
    const above=game.plants[k];
    if (above && !above.removed && plantLayerOf(above)==='woody') return null;
    game.bulbs[k]=np; game.dirty=true; plantFx(x,y,np);
    return 'bulb';
  }
  const ex=game.plants[k];
  if (ex && !ex.removed) return null;
  if (def.type!=='shrub' && shrubAt(x,y)) return null;
  if (def.type==='shrub' && !canPlaceShrubAt(x,y,np).ok) return null;
  const sh=shadeAt(x,y);
  if (sh && def.sun!=='part') return null;
  if (freePlantable(def)) Object.assign(np,naturalPlantOffset(x,y,opts));
  game.plants[k]=np; game.dirty=true; plantFx(x,y,np);
  if (game.plantFromStock) useStock(np.s); // spend the grown plug
  // a tree or shrub claims the ground — any bulb tucked under it is lost
  if (def.type==='shrub') clearBulbsUnderShrub(x,y,np);
  else if (def.type==='tree'){ const eb=game.bulbs[k];
    if (eb && !eb.removed){ game.bulbs[k]={removed:true,t:Date.now()}; syncBulbsOut(); } }
  return 'plant';
}
function syncToolLayer(what){
  if (what==='path'||what==='bed'||what==='water') syncTerrainOut();
  else if (what==='elevation') syncElevationOut();
  else if (what==='fence'||what==='gate') syncFencesOut();
  else if (what==='light') syncLightsOut();
  else if (what==='firepit') syncFirepitsOut();
  else if (what==='bulb') syncBulbsOut();
  else syncPlantsOut();
}
function stampDrift(cx0,cy0,n,opts){
  const offs=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
              [2,0],[0,2],[-2,0],[0,-2],[2,1],[1,2],[-1,2],[-2,1]];
  const rest=offs.slice(1); // keep the clicked tile first, shuffle the rest
  for (let i=rest.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0;
    [rest[i],rest[j]]=[rest[j],rest[i]]; }
  const def=plantDef(game.tool,game.toolVar);
  let placed=0, what=null;
  for (const [ox,oy] of [offs[0],...rest]){
    if (placed>=n) break;
    const r=applyToolAt(cx0+ox,cy0+oy,(!ox&&!oy)?opts:null);
    if (r){ placed++; what=r; }
  }
  if (placed){ syncToolLayer(what);
    toast(placed>1?`A drift of ${placed} — ${def.name}.`:`Planted ${def.name} — no room for more here.`); }
  else toast('No room for a drift here.');
}
function doSleep(){
  if (!ENABLE_HUD_SLEEP_BUTTON && !ENABLE_HOUSE_SLEEP){ toast('End Day is tucked away for now.'); return; }
  game.dayOffset++; game.dirty=true;
  if (game.mode==='multi') toast('Day advanced here — a shared garden keeps its own clock.');
  else toast('A new garden day begins.');
}

/* ---------- fence / structure placement ---------- */
function fenceDraft(){ return game.fenceDraft=normalizeFenceDraft(game.fenceDraft); }
function fenceLabel(f){
  const d=f||fenceDraft();
  return `${d.height}' ${fenceStyle(d.style).label}${d.gate?' gate':' fence'}`;
}
function canPlaceFence(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return false;
  if (inHouse(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water' || lightAt(x,y) || firepitAt(x,y)) return false;
  if (shrubAt(x,y)) return false;
  const d=fenceDraft();
  if (!d.gate && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return false;
  const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
  return !(p&&!p.removed) && !(b&&!b.removed);
}
function placeFenceAt(x,y){
  if (!canPlaceFence(x,y)) return null;
  const d=normalizeFenceDraft(fenceDraft()), k=`${x},${y}`, now=Date.now();
  const next={style:fenceStyleId(d.style),height:FENCE_HEIGHTS.includes(d.height)?d.height:4,gate:!!d.gate,t:now};
  const cur=fenceAt(x,y);
  if (cur && cur.style===next.style && cur.height===next.height && !!cur.gate===next.gate) return null;
  game.fences[k]=next; game.dirty=true;
  return next.gate?'gate':'fence';
}
function canPlaceLight(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return false;
  if (inHouse(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water') return false;
  if (fenceAt(x,y) || firepitAt(x,y) || shrubAt(x,y)) return false;
  if (game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return false;
  const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
  return !(p&&!p.removed) && !(b&&!b.removed);
}
function placeLightAt(x,y){
  if (!canPlaceLight(x,y)) return null;
  const d=normalizeLightDraft(lightDraft()), k=`${x},${y}`, now=Date.now();
  const next={type:lightTypeId(d.type),tone:lightToneId(d.tone),t:now};
  const cur=lightAt(x,y);
  if (cur && cur.type===next.type && cur.tone===next.tone) return null;
  game.lights[k]=next; game.dirty=true;
  return 'light';
}

/* ---------- house placement / sizing / paint ---------- */
function pushHouse(){ game.houseT=Date.now();
  if (game.mode==='multi') sSet(wkey('house'),{h:game.houses,t:game.houseT},true); }
function displacePlants(x,y,w,h){ // a house can't share ground with plants
  let n=0;
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const [px2,py2]=k.split(',').map(Number);
    const inside=px2>=x&&px2<x+w&&py2>=y&&py2<y+h;
    const overlaps=isShrubDef(plantDef(p.s,p.v)) && shrubFootprintOverlapsRect(px2,py2,p,x,y,w,h);
    if (inside || overlaps){ game.plants[k]={removed:true,t:Date.now()}; n++; }
  }
  if (n){ game.dirty=true; syncPlantsOut(); }
  return n;
}
function clearTerrainForHouse(x,y,w,h){
  let n=0;
  const clear=(xx,yy)=>{
    if (xx<0||yy<0||xx>=GW||yy>=GH) return;
    const k=`${xx},${yy}`;
    if (terrainAt(xx,yy)){ game.terrain[k]={removed:true,t:Date.now()}; n++; }
    if (fenceAt(xx,yy)){ game.fences[k]={removed:true,t:Date.now()}; n++; }
    if (lightAt(xx,yy)){ game.lights[k]={removed:true,t:Date.now()}; n++; }
    const fp=firepitAt(xx,yy);
    if (fp){ game.firepits[fp.key]={removed:true,t:Date.now()}; n++; }
  };
  for (let yy=y;yy<y+h;yy++) for (let xx=x;xx<x+w;xx++) clear(xx,yy);
  clear(x+((w-1)>>1),y+h); // keep the doorstep standable
  if (n){ game.dirty=true; syncTerrainOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut(); }
  return n;
}
function placeHouse(x,y){
  const d=game.houseDraft || (game.houseDraft=defaultDraft());
  const nx=Math.max(0,Math.min(GW-d.w,x)), ny=Math.max(0,Math.min(GH-d.h-1,y));
  const ppx=Math.round(game.px), ppy=Math.round(game.py);
  if (game.gameMode!=='design' && ppx>=nx&&ppx<nx+d.w&&ppy>=ny&&ppy<ny+d.h){
    toast("You're standing in the way."); return; }
  if (game.houses.some(o=>nx<o.x+o.w&&nx+d.w>o.x&&ny<o.y+o.h&&ny+d.h>o.y)){
    toast('That overlaps another house.'); return; }
  game.houses.push({x:nx,y:ny,w:d.w,h:d.h,wall:d.wall,roof:d.roof,sizeFt:d.sizeFt});
  game.dirty=true; pushHouse();
  const n=displacePlants(nx,ny,d.w,d.h);
  clearTerrainForHouse(nx,ny,d.w,d.h);
  toast('House placed.'+(n?` ${n} plant${n>1?'s':''} lifted from under it.`:''));
}
// the House tab's size/colour chips edit the draft — the settings the next
// placed house uses (existing houses are changed by erasing + re-placing)
function applyHouseSize(wFt,dFt,label){
  const w=ftToTiles(wFt), d=ftToTiles(dFt);
  if (w>GW-2 || d>GH-3){ toast('The plot is too small for that house.'); return; }
  const dr=game.houseDraft || (game.houseDraft=defaultDraft());
  dr.w=w; dr.h=d; dr.sizeFt=[wFt,dFt];
  toast(`${label} — ${wFt}' × ${dFt}'. Tap the map to place it.`);
}
function paintHouse(part,col,label){
  const dr=game.houseDraft || (game.houseDraft=defaultDraft());
  dr[part]=col;
  toast(part==='wall'?`Walls set ${label.toLowerCase()}. Tap to place.`
                     :`Roof set ${label.toLowerCase()}. Tap to place.`);
}
function showPlantCard(p,px2,py2){
  const P=plantDef(p.s,p.v), g=Math.round(plantEstab(p)*100), el=document.getElementById('plantCard');
  clearTimeout(el._t);
  const focusKey=plantKeyOf(p);
  game.focusPlantKey=focusKey;
  const dim=v=>v>=96?`${Math.round(v/12)}&prime;`:`${v}&Prime;`; // feet for tree-scale numbers
  const shaded = px2!==undefined && P.sun!=='part' && P.type!=='tree' && shadeInfoAt(px2,py2,false);
  const shrubFoot = P.type==='shrub' ? ` · reserves about ${Math.max(1,Math.round((P.spread||P.space||TILE_IN)/TILE_IN))} tiles wide` : '';
  el.innerHTML=`<h3>${P.name}</h3><div class="latin">${P.latin}</div>
    <p>${P.blurb}</p>
    <p style="margin-top:6px;color:#cdbfa9">${dim(P.space)} apart · ${dim(P.spread)} spread ·
      zones ${P.zones[0]}–${P.zones[1]} · ${P.sun} sun · ${P.moist} soil${
      P.grow?` · ~${P.grow} yrs to size`:''}${shrubFoot}</p>
    <p style="color:${P.native?'#9ab87a':'#c9a07f'}">${P.native
      ? 'Native — '+P.eco.slice(0,2).join(', ')+(P.eco.length>2?` +${P.eco.length-2} more`:'')
      : 'Garden cultivar (non-native)'}</p>
    <p style="color:#b9a88f">Roles: ${roleSummary(p.s)}</p>
    ${shaded?`<p style="color:#c9a07f">Struggling — active canopy shade from ${PLANTS[shaded.p.s].name} and it wants full sun.</p>`:''}
    <p style="margin-top:6px;color:#efe6d3">${g<100?`Establishing — ${g}% grown`:'Fully established'}</p>`;
  const xb=document.createElement('button'); xb.className='card-x'; xb.textContent='✕';
  const close=()=>{ el.style.display='none'; clearTimeout(el._t);
    if (game.focusPlantKey===focusKey) game.focusPlantKey=null; };
  xb.onclick=close;
  el.prepend(xb);
  el.style.display='block';
  el._t=setTimeout(close,8000);
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity=1;
  if (/nothing|no room|already|first|failed|coming soon|only|lift the plant|dig the path|not in|no spot|shade-tolerant|standing in the way|just scenery|enter the/i.test(msg))
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.opacity=0,2600);
}

/* keyboard */
const heldKeys={};
addEventListener('keydown',e=>{
  if (document.getElementById('hud').classList.contains('hidden')) return;
  if (e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT')) return;
  if (e.key==='`'){ toggleDebug(); return; }
  const confirmPop=document.getElementById('confirmPop');
  if (confirmPop){ if (e.key==='Escape') confirmPop.remove(); return; }
  const overlay=['gardenMenu','exportScreen','regionScreen','planScreen','pottingScreen']
    .map(id=>document.getElementById(id)).find(el=>el && !el.classList.contains('hidden'));
  if (overlay){ // an overlay is open: only Escape closes, game keys ignored
    if (e.key==='Escape'){ overlay.classList.add('hidden'); }
    return;
  }
  const k=e.key.toLowerCase();
  if ((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); return; }
  if ((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); doRedo(); return; }
  const confirmOpen=!document.getElementById('confirmSeasonScreen').classList.contains('hidden');
  if (confirmOpen){ if (e.key==='Escape') closeSeasonConfirm(); return; }
  const pauseOpen=!document.getElementById('pauseScreen').classList.contains('hidden');
  if (pauseOpen){ if (e.key==='Escape') closePause(); return; }
  if (e.key==='Escape' && game.tool==='select'){  // back out of a move, then the selection
    if (selMove){ selMove=null; toast('Move cancelled.'); }
    else if (game.sel){ clearSelection(); toast('Selection cleared.'); }
    return;
  }
  if (k===' ' && game.gameMode==='design'){ // hold space to pan the design canvas (PC)
    e.preventDefault(); spaceHeld=true; updateCanvasCursor(); return;
  }
  if (k==='e'||k===' '){ e.preventDefault(); withUndo(actHere); return; }
  if (k==='r'){ e.preventDefault(); rotateView(); return; }
  if (k==='+'||k==='='){ e.preventDefault(); zoomBy(1.12); return; }
  if (k==='-'){ e.preventDefault(); zoomBy(0.89); return; }
  /* keys move in SCREEN directions: D is right on screen, W is up, etc.
     One key = a screen-cardinal step (a view diagonal); holding two keys
     combines into the view axes. The loop converts view direction to
     world direction per the current rotation. */
  const map={w:[-1,-1],arrowup:[-1,-1],s:[1,1],arrowdown:[1,1],
             a:[-1,1],arrowleft:[-1,1],d:[1,-1],arrowright:[1,-1]};
  if (map[k]){ e.preventDefault(); heldKeys[k]=map[k]; }
});
addEventListener('keyup',e=>{ delete heldKeys[e.key.toLowerCase()];
  if (e.key===' '){ spaceHeld=false; updateCanvasCursor(); } });

/* tap / click: first tap walks, tap on own tile acts */
let lastTap=0;
let sweep=null; // shovel drag-lift in progress: {plants, terr}
/* the eraser: clears a square brush (game.eraseSize) centered on the
   tile, removing the layers selected by game.eraseMode. 'all' wipes
   plant + bulb + terrain on every tile in one pass; the others touch
   only their layer. Counts tally into `counts`. */
function eraseBrush(cx,cy,counts){
  const r=((game.eraseSize|0)-1)/2, m=game.eraseMode, now=Date.now();
  // a layer is erasable only if it's visible, in edit focus, and in eraseMode
  const can=(name,mode)=>layerShown(name) && layerEditable(name) && (m==='all'||m===mode);
  const peren=can('perennials','plant'), woody=can('woody','plant');
  const bulbOK=can('bulbs','bulb'), terrOK=can('landscape','terrain');
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
    const x=cx+dx, y=cy+dy;
    if (x<0||y<0||x>=GW||y>=GH) continue;
    const k=`${x},${y}`;
    let pk=k, p=game.plants[k];
    if (!(p && !p.removed)){
      const sh=shrubAt(x,y);
      if (sh){ pk=sh.key; p=sh.p; }
    }
    if (p && !p.removed && (plantLayerOf(p)==='woody'?woody:peren)){
      game.plants[pk]={removed:true,t:now}; game.dirty=true; counts.plants++; }
    const b=game.bulbs[k];
    if (bulbOK && b && !b.removed){
      game.bulbs[k]={removed:true,t:now}; game.dirty=true; counts.bulbs++; }
    if (terrOK && tileTerrain(x,y)){
      game.terrain[k]={removed:true,t:now}; game.dirty=true; counts.terr++; }
    if (terrOK && elevationAt(x,y)){
      game.elevation[k]={removed:true,t:now}; game.dirty=true; counts.elev=(counts.elev||0)+1; }
    if (terrOK && fenceAt(x,y)){
      game.fences[k]={removed:true,t:now}; game.dirty=true; counts.fence=(counts.fence||0)+1; }
    if (terrOK && lightAt(x,y)){
      game.lights[k]={removed:true,t:now}; game.dirty=true; counts.light=(counts.light||0)+1; }
    if (terrOK){
      const fp=firepitAt(x,y);
      if (fp){ game.firepits[fp.key]={removed:true,t:now}; game.dirty=true; counts.firepit=(counts.firepit||0)+1; }
    }
    if (terrOK){ const hh=houseAt(x,y);     // landscape erase also lifts a whole house
      if (hh){ const i=game.houses.indexOf(hh);
        if (i>=0){ game.houses.splice(i,1); game.dirty=true; counts.house=(counts.house||0)+1; } } }
  }
}
function sweepLift(x,y){ eraseBrush(x,y,sweep); }

/* ---------- selection tool: marquee a region, then move/copy/rotate/erase ----------
   game.sel is the committed rect; selDrag is an in-progress marquee; selMove
   is an in-progress move/copy drag. All edits go through withUndo so each is
   a single undo step. */
let selDrag=null, selMove=null;
const AREA_CLIP_KEY='hortus:areaClipboard';
let areaClipboard=null;
function normRect(a,b){ return {x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),
  x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)}; }
function inRect(r,x,y){ return r && x>=r.x0 && x<=r.x1 && y>=r.y0 && y<=r.y1; }
function selValidDest(x,y){ return x>=0&&y>=0&&x<GW&&y<GH && !inHouse(x,y) && !isDoor(x,y); }
function selItemValidDest(c,x,y){
  if (!c.firepit) return selValidDest(x,y);
  const sz=firepitTileSize(c.firepit);
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++)
    if (!selValidDest(xx,yy)) return false;
  return true;
}
function cloneCell(c){ return JSON.parse(JSON.stringify(c)); }
// snapshot every occupied tile in the rect across plants, bulbs, terrain, elevation, fences, and lights
function selectionPayload(r){
  const items=[];
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    const k=`${x},${y}`;
    const p=game.plants[k], b=game.bulbs[k], t=game.terrain[k], e=game.elevation[k], f=game.fences[k], l=game.lights[k], fp=game.firepits[k];
    const cell={x,y};
    if (p && !p.removed) cell.plant=JSON.parse(JSON.stringify(p));
    if (b && !b.removed) cell.bulb=JSON.parse(JSON.stringify(b));
    if (t && !t.removed) cell.terr=JSON.parse(JSON.stringify(t));
    if (e && !e.removed) cell.elev=JSON.parse(JSON.stringify(e));
    if (f && !f.removed) cell.fence=JSON.parse(JSON.stringify(f));
    if (l && !l.removed) cell.light=JSON.parse(JSON.stringify(l));
    if (fp && !fp.removed) cell.firepit=JSON.parse(JSON.stringify(fp));
    if (cell.plant||cell.bulb||cell.terr||cell.elev||cell.fence||cell.light||cell.firepit) items.push(cell);
  }
  return items;
}
function selectedPlantBrush(){
  const k=game.lastBrushTool;
  return PLANTS[k] ? [k,game.lastBrushVar||null] : null;
}
function selectedFillBrush(){
  const k=game.lastBrushTool;
  if (PLANTS[k]){
    const v=game.lastBrushVar||null, def=plantDef(k,v);
    return {tool:k, toolVar:v, label:def.name, plantDef:def};
  }
  if (k==='path') return {tool:k, toolVar:null, label:`${pathColor(game.pathColor).label} path`};
  if (k==='bed') return {tool:k, toolVar:null, label:`${bedStyle(game.bedStyle).label} bed`};
  if (k==='water') return {tool:k, toolVar:null, label:`${waterStyle(game.waterStyle).label} water`};
  return null;
}
function selectionAreaPayload(r){
  return {v:1,w:r.x1-r.x0+1,h:r.y1-r.y0+1,items:selectionPayload(r).map(c=>{
    const out=cloneCell(c); out.x-=r.x0; out.y-=r.y0; return out;
  })};
}
function storedArea(){
  if (areaClipboard) return areaClipboard;
  if (!hasStorage) return null;
  try{
    const raw=localStorage.getItem(AREA_CLIP_KEY);
    areaClipboard=raw?JSON.parse(raw):null;
  }catch(_){ areaClipboard=null; }
  return areaClipboard;
}
function saveSelectedArea(){
  if (!game.sel){ toast('Select an area first.'); return; }
  const area=selectionAreaPayload(game.sel);
  if (!area.items.length){ toast('Nothing in the selection to save.'); return; }
  area.savedAt=Date.now();
  areaClipboard=area;
  if (hasStorage){
    try{ localStorage.setItem(AREA_CLIP_KEY,JSON.stringify(area)); }
    catch(_){ toast('That selection is too large to save here.'); return; }
  }
  buildToolTray();
  toast(`Saved ${area.items.length} occupied tile${area.items.length>1?'s':''} as an area.`);
}
function rectForSavedArea(area,x0,y0){ return {x0,y0,x1:x0+area.w-1,y1:y0+area.h-1}; }
function rectFits(r){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++)
    if (!selValidDest(x,y)) return false;
  return true;
}
function clearRectLayers(r){
  const now=Date.now();
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    const k=`${x},${y}`;
    if (game.plants[k] && !game.plants[k].removed) game.plants[k]={removed:true,t:now};
    if (game.bulbs[k] && !game.bulbs[k].removed) game.bulbs[k]={removed:true,t:now};
    if (game.terrain[k] && !game.terrain[k].removed) game.terrain[k]={removed:true,t:now};
    if (game.elevation[k] && !game.elevation[k].removed) game.elevation[k]={removed:true,t:now};
    if (game.fences[k] && !game.fences[k].removed) game.fences[k]={removed:true,t:now};
    if (game.lights[k] && !game.lights[k].removed) game.lights[k]={removed:true,t:now};
    const fp=firepitAt(x,y);
    if (fp) game.firepits[fp.key]={removed:true,t:now};
  }
  game.dirty=true;
}
function syncSelectionLayers(){
  syncPlantsOut(); syncBulbsOut(); syncTerrainOut(); syncElevationOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut();
}
function pasteSavedArea(){
  const area=storedArea();
  if (!area || !area.items || !area.items.length){ toast('No saved area yet.'); return; }
  if (!game.sel){ toast('Select where to paste the saved area.'); return; }
  const target=rectForSavedArea(area,game.sel.x0,game.sel.y0);
  if (!rectFits(target)){ toast('Saved area would run off the plot or into a house.'); return; }
  const items=area.items.map(c=>{ const out=cloneCell(c); out.x=target.x0+c.x; out.y=target.y0+c.y; return out; });
  withUndo(()=>{ clearRectLayers(target); selWrite(items,c=>[c.x,c.y],false); });
  syncSelectionLayers();
  game.sel=target;
  game.selItems=selectionPayload(game.sel);
  buildToolTray();
  toast(`Pasted saved area: ${items.length} occupied tile${items.length>1?'s':''}.`);
}
function fillSelectionWithPlant(){
  if (!game.sel){ toast('Select an area first.'); return; }
  const brush=selectedFillBrush();
  if (!brush){ toast('Pick a plant or landscape material first, then return to Select.'); return; }
  const {tool,toolVar,plantDef:def}=brush;
  const oldTool=game.tool, oldVar=game.toolVar, oldDrift=game.drift;
  let placed=0, what=null;
  withUndo(()=>{
    game.tool=tool; game.toolVar=toolVar; game.drift=false;
    for (let y=game.sel.y0;y<=game.sel.y1;y++) for (let x=game.sel.x0;x<=game.sel.x1;x++){
      const k=`${x},${y}`;
      const oldPlant=def&&game.plants[k]?cloneCell(game.plants[k]):null;
      const oldBulb=def&&game.bulbs[k]?cloneCell(game.bulbs[k]):null;
      const now=Date.now();
      if (def && def.type==='bulb'){
        if (oldBulb && !oldBulb.removed) game.bulbs[k]={removed:true,t:now};
      } else if (def) {
        if (oldPlant && !oldPlant.removed) game.plants[k]={removed:true,t:now};
      }
      const r=applyToolAt(x,y);
      if (r){ placed++; what=r; }
      else if (def) {
        if (oldPlant) game.plants[k]=oldPlant; else delete game.plants[k];
        if (oldBulb) game.bulbs[k]=oldBulb; else delete game.bulbs[k];
      }
    }
    game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  });
  game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  if (placed){
    syncToolLayer(what);
    game.selItems=selectionPayload(game.sel);
    toast(`Filled ${placed} tile${placed>1?'s':''} with ${brush.label}.`);
  } else toast(`No open spots for ${brush.label} in that selection.`);
  buildToolTray(); refreshCanvasTools();
}
// write items to their destination tiles (getDst(cell)->[x,y]); clearSource
// first wipes the originals (move) — skipped for copy
function selWrite(items, getDst, clearSource){
  const now=Date.now();
  if (clearSource){
    for (const c of items){ const k=`${c.x},${c.y}`;
      if (c.plant) game.plants[k]={removed:true,t:now};
      if (c.bulb)  game.bulbs[k]={removed:true,t:now};
      if (c.terr)  game.terrain[k]={removed:true,t:now};
      if (c.elev)  game.elevation[k]={removed:true,t:now};
      if (c.fence) game.fences[k]={removed:true,t:now};
      if (c.light) game.lights[k]={removed:true,t:now};
      if (c.firepit) game.firepits[k]={removed:true,t:now};
    }
  }
  for (const c of items){ const [nx,ny]=getDst(c); const k=`${nx},${ny}`;
    if (c.plant) game.plants[k]=Object.assign({},c.plant,{t:now});
    if (c.bulb)  game.bulbs[k]=Object.assign({},c.bulb,{t:now});
    if (c.terr)  game.terrain[k]=Object.assign({},c.terr,{t:now});
    if (c.elev)  game.elevation[k]=Object.assign({},c.elev,{t:now});
    if (c.fence) game.fences[k]=Object.assign({},c.fence,{t:now});
    if (c.light) game.lights[k]=Object.assign({},c.light,{t:now});
    if (c.firepit) game.firepits[k]=Object.assign({},c.firepit,{t:now});
  }
  game.dirty=true;
  const layers=items.reduce((a,c)=>{ if(c.plant)a.p=1; if(c.bulb)a.b=1; if(c.terr)a.t=1; if(c.elev)a.e=1; if(c.fence)a.f=1; if(c.light)a.l=1; if(c.firepit)a.fp=1; return a;},{});
  if (layers.p) syncPlantsOut();
  if (layers.b) syncBulbsOut();
  if (layers.t) syncTerrainOut();
  if (layers.e) syncElevationOut();
  if (layers.f) syncFencesOut();
  if (layers.l) syncLightsOut();
  if (layers.fp) syncFirepitsOut();
}
// commit a move or copy by tile offset; returns true if applied. Operates on
// the selection's OWNED items (game.selItems), not whatever is in the rect now
function commitSelectionOffset(dx,dy,copy){
  if (!game.sel || (dx===0&&dy===0 && !copy)) return false;
  const items=game.selItems||[];
  if (!items.length) return false;
  const dst=c=>[c.x+dx,c.y+dy];
  if (items.some(c=>{ const [x,y]=dst(c); return !selItemValidDest(c,x,y); })){
    toast('That spot runs off the plot or into the house.'); return false;
  }
  withUndo(()=>selWrite(items, dst, !copy));
  items.forEach(c=>{ c.x+=dx; c.y+=dy; });   // the selection now owns the moved/copied tiles
  game.sel={x0:game.sel.x0+dx,y0:game.sel.y0+dy,x1:game.sel.x1+dx,y1:game.sel.y1+dy};
  toast(copy?`Duplicated ${items.length} tile${items.length>1?'s':''}.`
            :`Moved ${items.length} tile${items.length>1?'s':''}.`);
  return true;
}
// rotate the selection's owned contents 90° clockwise about the rect center
function rotateSelection(){
  if (!game.sel) return;
  const r=game.sel, items=game.selItems||[];
  if (!items.length){ toast('Nothing in the selection to rotate.'); return; }
  const cx2=(r.x0+r.x1)/2, cy2=(r.y0+r.y1)/2;
  const rot=(x,y)=>[Math.round(cx2-(y-cy2)), Math.round(cy2+(x-cx2))];
  if (items.some(c=>{ const [x,y]=rot(c.x,c.y); return !selItemValidDest(c,x,y); })){
    toast('Rotated selection would leave the plot.'); return;
  }
  withUndo(()=>selWrite(items, c=>rot(c.x,c.y), true));
  items.forEach(c=>{ const [nx,ny]=rot(c.x,c.y); c.x=nx; c.y=ny; });
  // new bounding box: width/height swap about the center
  const hw=(r.x1-r.x0)/2, hh=(r.y1-r.y0)/2;
  game.sel={x0:Math.round(cx2-hh),y0:Math.round(cy2-hw),
            x1:Math.round(cx2+hh),y1:Math.round(cy2+hw)};
  toast(`Rotated ${items.length} tile${items.length>1?'s':''}.`);
}
function eraseSelection(){
  if (!game.sel) return;
  const items=game.selItems||[];
  if (!items.length){ toast('Nothing in the selection to erase.'); clearSelection(); return; }
  withUndo(()=>{ const now=Date.now();
    for (const c of items){ const k=`${c.x},${c.y}`;
      if (c.plant) game.plants[k]={removed:true,t:now};
      if (c.bulb)  game.bulbs[k]={removed:true,t:now};
      if (c.terr)  game.terrain[k]={removed:true,t:now};
      if (c.elev)  game.elevation[k]={removed:true,t:now};
      if (c.fence) game.fences[k]={removed:true,t:now};
      if (c.light) game.lights[k]={removed:true,t:now};
      if (c.firepit) game.firepits[k]={removed:true,t:now};
    }
    game.dirty=true; syncPlantsOut(); syncBulbsOut(); syncTerrainOut(); syncElevationOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut(); });
  toast(`Erased ${items.length} tile${items.length>1?'s':''}.`);
  clearSelection();
}
function clearSelection(){ game.sel=null; game.selItems=null; selDrag=null; selMove=null; buildToolTray(); }
function selPointerDown(x,y,e){
  try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
  if (inRect(game.sel,x,y)){            // grab the selection to move/copy it
    selMove={grabX:x,grabY:y,curX:x,curY:y,copy:game.selMode==='copy'};
  } else {                              // start a fresh marquee
    selDrag={x0:x,y0:y,x1:x,y1:y};
    if (game.sel){ game.sel=null; game.selItems=null; buildToolTray(); }
  }
}
function selPointerMove(x,y){
  if (selDrag){ selDrag.x1=x; selDrag.y1=y; return true; }
  if (selMove){ selMove.curX=x; selMove.curY=y; return true; }
  return false;
}
function selPointerUp(){
  if (selDrag){
    game.sel=normRect({x:selDrag.x0,y:selDrag.y0},{x:selDrag.x1,y:selDrag.y1});
    // the selection OWNS exactly what was in the box when it was drawn — it
    // won't scoop up items that later end up inside the rect
    game.selItems=selectionPayload(game.sel);
    selDrag=null; buildToolTray();
    return;
  }
  if (selMove){
    const dx=selMove.curX-selMove.grabX, dy=selMove.curY-selMove.grabY;
    const copy=selMove.copy; selMove=null;
    if (dx||dy) commitSelectionOffset(dx,dy,copy);
    buildToolTray();
  }
}
function evPlacement(e){ // pointer position -> owning world tile + sub-tile offset
  const W=VW/ZOOM, H=VH/ZOOM;
  const sx=e.clientX/ZOOM, sy=e.clientY/ZOOM;
  const [wx,wy]=worldPointAt(sx, sy, W, H);
  const [x,y]=tileAt(sx, sy, W, H);
  return {x,y,ox:wx-x,oy:wy-y};
}
function evTile(e){ // pointer position -> world tile, zoom-aware
  const p=evPlacement(e);
  return [p.x,p.y];
}
/* ---------- undo: a stack of plants+bulbs+terrain+house snapshots ----------
   A gesture snapshots state on pointerdown and commits it only if the
   state actually changed by pointerup, so no-op taps don't pile up. */
let spaceHeld=false, panDrag=null, undoStack=[], redoStack=[], pendSnap=null, pendSig=null;
function updateCanvasCursor(){
  if (!cnv) return;
  cnv.style.cursor = panDrag ? 'grabbing'
    : (game.tool==='hand'||spaceHeld) ? 'grab'
    : (game.tool==='select'||game.tool==='pick') ? 'crosshair' : '';
}
function stateSig(){ return JSON.stringify([game.plants,game.bulbs,game.terrain,game.elevation,game.houses,game.fences,game.lights,game.firepits]); }
function snapshotState(){ return {
  plants:JSON.parse(JSON.stringify(game.plants)),
  bulbs:JSON.parse(JSON.stringify(game.bulbs)),
  terrain:JSON.parse(JSON.stringify(game.terrain)),
  elevation:JSON.parse(JSON.stringify(game.elevation||{})),
  houses:JSON.parse(JSON.stringify(game.houses||[])),
  fences:JSON.parse(JSON.stringify(game.fences||{})),
  lights:JSON.parse(JSON.stringify(game.lights||{})),
  firepits:JSON.parse(JSON.stringify(game.firepits||{}))}; }
// a new action invalidates the redo chain (standard undo/redo semantics)
function pushUndo(snap){ undoStack.push(snap); if (undoStack.length>30) undoStack.shift();
  redoStack.length=0; updateUndoBtn(); }
function beginUndo(){ pendSig=stateSig(); pendSnap=snapshotState(); }
function commitUndo(){ if (pendSig!==null && stateSig()!==pendSig) pushUndo(pendSnap); pendSig=null; pendSnap=null; }
function withUndo(fn){ const sig=stateSig(), snap=snapshotState(); fn();
  if (stateSig()!==sig) pushUndo(snap); }
function applySnapshot(s){ // restore plants/bulbs/terrain/houses/fences/lights/firepits + refresh UI
  game.plants=s.plants; game.bulbs=s.bulbs; game.terrain=s.terrain; game.elevation=s.elevation||{}; game.houses=s.houses||[]; game.fences=s.fences||{}; game.lights=s.lights||{}; game.firepits=s.firepits||{};
  game.dirty=true; updateUndoBtn();
  if (game.mode==='multi'){ syncPlantsOut(); syncBulbsOut(); syncTerrainOut(); syncElevationOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut(); pushHouse(); }
  buildToolTray();
}
function doUndo(){
  if (!undoStack.length){ toast('Nothing to undo.'); return; }
  redoStack.push(snapshotState()); if (redoStack.length>30) redoStack.shift();
  applySnapshot(undoStack.pop()); toast('Undone.');
}
function doRedo(){
  if (!redoStack.length){ toast('Nothing to redo.'); return; }
  undoStack.push(snapshotState()); if (undoStack.length>30) undoStack.shift();
  applySnapshot(redoStack.pop()); toast('Redone.');
}
function updateUndoBtn(){
  // Undo/Redo live in the canvas rail now; their greyed state is recomputed from
  // undoStack/redoStack each time the rail is (re)built.
  refreshCanvasTools();
}

/* two fingers pinch the zoom; everything else is one-finger business */
const activePtrs=new Map(); let pinch=null, toolDrag=null;
cnv.addEventListener('pointerdown',e=>{
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (activePtrs.size===2){
    const [a,b2]=[...activePtrs.values()];
    pinch={d0:Math.hypot(a[0]-b2[0],a[1]-b2[1])||1, z0:userZoom,
           cx0:(a[0]+b2[0])/2, cy0:(a[1]+b2[1])/2,   // centroid, for two-finger pan
           camx0:cam.x, camy0:cam.y};
    sweep=null; toolDrag=null; panDrag=null; game.pathTarget=null; game.sleepOnArrive=false;
    return;
  }
  if (activePtrs.size>1) return;
  // Hand tool pans the map; design mode also supports middle mouse / Space-drag.
  if (game.tool==='hand' || (game.gameMode==='design' && (e.button===1 || spaceHeld))){
    e.preventDefault();
    panDrag={sx:e.clientX, sy:e.clientY, camx0:cam.x, camy0:cam.y};
    updateCanvasCursor();
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  if (x<0||y<0||x>=GW||y>=GH) return;
  if (game.tool==='select'){ selPointerDown(x,y,e); return; }
  if (game.tool==='pick'){ pickAt(x,y); return; }   // eyedropper: sample, then become that brush
  // drawing onto a hidden layer? warn and offer to reveal it before placing
  if (isPlacementTool(game.tool)){
    const layer=toolTargetLayer(game.tool);
    if (blockIfWrongEditLayer(layer)) return;
    if (layer && !layerShown(layer)){ promptRevealLayer(layer,x,y); return; }
  }
  if (fillActive()){ doFloodFill(x,y); return; }  // bucket fill is a single tap, self-undoing
  beginUndo();   // snapshot before any placement gesture; committed at pointerup if it changed anything
  if (game.tool==='house'){ placeHouse(x,y); return; }
  if (game.tool==='shovel'){ // drag across the bed to lift plant after plant
    sweep={plants:0, bulbs:0, terr:0, elev:0, house:0, fence:0, light:0, firepit:0};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    sweepLift(x,y); return;
  }
  // plant/bulb/path/bed/water/elevation/fence/light/firepit: press-and-drag paints tiles like the shovel
  // sweeps them; a plain tap (resolved at pointerup) walks or acts
  if (PLANTS[game.tool] || game.tool==='path' || game.tool==='bed' || game.tool==='water' || isElevationTool(game.tool) || game.tool==='fence' || game.tool==='light' || game.tool==='firepit'){
    toolDrag={sx:x, sy:y, ox:place.ox, oy:place.oy, active:false, count:0, what:null};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  tapAction(x,y,place);
});
function tapAction(x,y,opts){ // the classic tap: walk there, act on your own tile
  if (game.gameMode==='design'){ // no avatar — act directly on the tapped tile
    if (x<0||y<0||x>=GW||y>=GH) return;
    game.tx=x; game.ty=y; actHere(opts); return;
  }
  if (inHouse(x,y)){
    if (ENABLE_HOUSE_SLEEP){ // old flow: tapping the house walked to the door, then slept
      const [dx2,dy2]=doorPos(houseAt(x,y));
      game.pathTarget=[dx2,dy2]; game.sleepOnArrive=true;
    } else {
      game.sleepOnArrive=false;
      toast('The house is just scenery for now.');
    }
    return;
  }
  game.sleepOnArrive=false;
  if (tileTerrain(x,y)==='water'){ toast('Water blocks the way.'); return; }
  if (fenceBlocks(x,y)){ toast('The fence blocks the way. Use a gate.'); return; }
  if (lightAt(x,y)){ toast('The light blocks the way.'); return; }
  if (firepitAt(x,y)){ toast('The fire pit blocks the way.'); return; }
  if (x===Math.round(game.px)&&y===Math.round(game.py)&&!game.moving){ actHere(opts); return; }
  game.pathTarget=[x,y];
}
function finishToolDrag(){
  if (!toolDrag || !toolDrag.active) return;
  if (toolDrag.count){
    syncToolLayer(toolDrag.what);
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    let msg;
    if (toolDrag.what==='path') msg=`Updated ${toolDrag.count} path tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='bed') msg=`Dug ${toolDrag.count} bed tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='water') msg=`Laid ${toolDrag.count} water tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='elevation') msg=`Adjusted ${toolDrag.count} elevation tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='fence'||toolDrag.what==='gate') msg=`Placed ${toolDrag.count} ${fenceLabel().toLowerCase()} tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='light') msg=`Placed ${toolDrag.count} ${lightLabel().toLowerCase()}${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='firepit') msg=`Placed ${toolDrag.count} ${firepitLabel().toLowerCase()}${toolDrag.count>1?'s':''}.`;
    else msg=`Planted ${toolDrag.count} - ${def.name}.`;
    toast(msg);
  } else toast('Nothing would take along that line.');
}
cnv.addEventListener('pointermove',e=>{
  if (panDrag){ // PC space/middle-drag pan
    cam.x=panDrag.camx0-(e.clientX-panDrag.sx)/ZOOM;
    cam.y=panDrag.camy0-(e.clientY-panDrag.sy)/ZOOM;
    return;
  }
  if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (pinch && activePtrs.size>=2){
    const [a,b2]=[...activePtrs.values()];
    setUserZoom(pinch.z0*(Math.hypot(a[0]-b2[0],a[1]-b2[1])||1)/pinch.d0);
    // two-finger drag pans the canvas (design mode has a free camera)
    if (game.gameMode==='design'){
      const cx=(a[0]+b2[0])/2, cy=(a[1]+b2[1])/2;
      cam.x=pinch.camx0-(cx-pinch.cx0)/ZOOM;
      cam.y=pinch.camy0-(cy-pinch.cy0)/ZOOM;
    }
    // (two-finger twist-to-rotate removed — rotate via the ⟳ button or R key)
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  if (game.tool==='select'){ if (selPointerMove(x,y)) return; }
  if (sweep){ sweepLift(x,y); return; }
  if (toolDrag){
    if (!toolDrag.active && (x!==toolDrag.sx||y!==toolDrag.sy)){
      toolDrag.active=true; // crossed a tile line: it's a paint-drag now
      const r0=applyToolAt(toolDrag.sx,toolDrag.sy,toolDrag);
      if (r0){ toolDrag.count++; toolDrag.what=r0; }
    }
    if (toolDrag.active){
      const r=applyToolAt(x,y,place);
      if (r){ toolDrag.count++; toolDrag.what=r; }
    }
    return;
  }
  game.hoverTile=(x>=0&&y>=0&&x<GW&&y<GH)?[x,y]:null;
});
cnv.addEventListener('wheel',e=>{
  if (!game.mode) return;
  e.preventDefault(); zoomBy(e.deltaY<0?1.12:0.89);
},{passive:false});
function endSweep(){
  if (!sweep) return;
  const parts=[];
  if (sweep.plants) parts.push(`${sweep.plants} plant${sweep.plants>1?'s':''}`);
  if (sweep.bulbs) parts.push(`${sweep.bulbs} bulb${sweep.bulbs>1?'s':''}`);
  if (sweep.terr) parts.push(`${sweep.terr} terrain tile${sweep.terr>1?'s':''}`);
  if (sweep.elev) parts.push(`${sweep.elev} elevation tile${sweep.elev>1?'s':''}`);
  if (sweep.fence) parts.push(`${sweep.fence} fence${sweep.fence>1?'s':''}`);
  if (sweep.light) parts.push(`${sweep.light} light${sweep.light>1?'s':''}`);
  if (sweep.firepit) parts.push(`${sweep.firepit} fire pit${sweep.firepit>1?'s':''}`);
  if (sweep.house) parts.push(`${sweep.house} house${sweep.house>1?'s':''}`);
  if (parts.length){
    toast(`Erased ${parts.join(' and ')}.`);
    if (sweep.plants) syncPlantsOut();
    if (sweep.bulbs) syncBulbsOut();
    if (sweep.terr) syncTerrainOut();
    if (sweep.elev) syncElevationOut();
    if (sweep.fence) syncFencesOut();
    if (sweep.light) syncLightsOut();
    if (sweep.firepit) syncFirepitsOut();
    if (sweep.house) pushHouse();
  }
  else toast('Nothing to erase there.');
  sweep=null;
}
cnv.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  if (panDrag){ panDrag=null; updateCanvasCursor(); return; }
  if (game.tool==='select' && (selDrag||selMove)){ selPointerUp(); return; }
  if (toolDrag){
    if (toolDrag.active) finishToolDrag();
    else tapAction(toolDrag.sx,toolDrag.sy,toolDrag);
    toolDrag=null;
  }
  endSweep();
  commitUndo();   // push the pre-gesture snapshot only if something changed
});
cnv.addEventListener('pointercancel',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  sweep=null; toolDrag=null; panDrag=null; selDrag=null; selMove=null; pendSig=null; pendSnap=null; updateCanvasCursor();
});
cnv.addEventListener('auxclick',e=>{ if (e.button===1) e.preventDefault(); }); // no middle-click autoscroll
cnv.addEventListener('pointerleave',()=>{ game.hoverTile=null; });
function followPath(){
  if (!game.pathTarget||game.moving) return;
  const [gx,gy]=game.pathTarget;
  const cxp=Math.round(game.px), cyp=Math.round(game.py);
  if (cxp===gx&&cyp===gy){
    game.pathTarget=null;
    if (ENABLE_HOUSE_SLEEP && game.sleepOnArrive&&isDoor(gx,gy)) doSleep();
    game.sleepOnArrive=false; return; }
  const sx=Math.sign(gx-cxp), sy=Math.sign(gy-cyp);
  // prefer a diagonal step when both axes differ; slide along one axis
  // when the diagonal is blocked (e.g. by the cottage)
  const opts = (sx&&sy) ? [[sx,sy],[sx,0],[0,sy]] : (sx?[[sx,0]]:[[0,sy]]);
  for (const [ox,oy] of opts){
    if (canStand(cxp+ox,cyp+oy)){ tryMove(cxp+ox,cyp+oy); return; }
  }
  game.pathTarget=null; // boxed in — give up rather than spin
}

/* ---------- storage: save / load / multiplayer ---------- */
async function sGet(key,shared){ try{ const r=localStorage.getItem(key);
  return r?JSON.parse(r):null; }catch(e){ return null; } }
async function sSet(key,val,shared){ try{ localStorage.setItem(key,JSON.stringify(val)); }
  catch(e){ console.error('storage',e); } }

async function ensurePlayerId(){
  if (!hasStorage){ game.playerId='p'+Math.random().toString(36).slice(2,8); return; }
  let id=await sGet('hortus:pid');
  if (!id){ id='p'+Math.random().toString(36).slice(2,10); await sSet('hortus:pid',id); }
  game.playerId=id;
}
/* solo worlds live in named slots: 'hortus:worlds' is the index
   [{id,name,ts,gw,gh}], each save under 'hortus:world:<id>'. The old
   single 'hortus:solo' key migrates into the first slot once. */
async function worldsIndex(){ return (await sGet('hortus:worlds'))||[]; }
async function migrateLegacyWorld(){
  let idx=await worldsIndex();
  if (idx.length) return idx;
  const legacy=await sGet('hortus:solo');
  if (!legacy) return idx;
  const entry={id:'w'+Date.now().toString(36), name:'My garden', ts:Date.now(),
    gw:legacy.gw||legacy.grid||31, gh:legacy.gh||legacy.grid||31};
  await sSet('hortus:world:'+entry.id, legacy);
  await sSet('hortus:worlds',[entry]);
  try{ localStorage.removeItem('hortus:solo'); }catch(e){}
  return [entry];
}
async function saveSolo(silent){
  if (!hasStorage){ toast('No save storage here — garden lives this session only.'); return; }
  if (!game.worldId) game.worldId='w'+Date.now().toString(36);
  await sSet('hortus:world:'+game.worldId,{wv:1,name:game.worldName,
    mode:game.gameMode,design:game.design,
    gw:GW,gh:GH,rot:game.rot,houses:game.houses,freePlanting:game.freePlanting,
    pathColor:game.pathColor,bedStyle:game.bedStyle,waterStyle:game.waterStyle,
    fenceDraft:game.fenceDraft,lightDraft:game.lightDraft,firepitDraft:game.firepitDraft,plants:game.plants,bulbs:game.bulbs,terrain:game.terrain,elevation:game.elevation,fences:game.fences,lights:game.lights,firepits:game.firepits,
    seeds:game.seeds,flats:game.flats,stock:game.stock,propSeeded:game.propSeeded,
    startTs:saveStartTs(),elapsedMs:elapsedGameMs(),savedAt:Date.now(),dayOffset:game.dayOffset,char:game.char});
  const idx=(await worldsIndex()).filter(w=>w.id!==game.worldId);
  idx.push({id:game.worldId, name:game.worldName||'My garden', ts:Date.now(), gw:GW, gh:GH, mode:game.gameMode});
  await sSet('hortus:worlds',idx);
  if (!silent) toast('Garden saved.');
}
function shiftKeys(m,d){ // translate every "x,y" key by +d on both axes
  if (!d) return m;
  const out={};
  for (const k in m){ const [x,y]=k.split(',').map(Number); out[`${x+d},${y+d}`]=m[k]; }
  return out;
}
async function loadSolo(id){
  const s=await sGet('hortus:world:'+id);
  if (!s) return false;
  // plot size: gw/gh (current), grid (square-era), or neither (13x13 era,
  // laid out around tile (6,6) — recenter on the classic plot)
  setWorldSize(s.gw||s.grid||31, s.gh||s.grid||31);
  const shift = (s.gw||s.grid) ? 0 : SPAWNX-6;
  game.gameMode = s.mode==='design' ? 'design' : 'story';
  game.design = s.design || null;
  game.plants=shiftKeys(s.plants||{},shift);
  game.bulbs=shiftKeys(s.bulbs||{},shift);
  game.terrain=shiftKeys(s.terrain||{},shift);
  game.elevation=shiftKeys(s.elevation||{},shift);
  game.fences=shiftKeys(s.fences||{},shift);
  game.lights=shiftKeys(s.lights||{},shift);
  game.firepits=shiftKeys(s.firepits||{},shift);
  // houses: new saves store an array; migrate old single-house saves, and
  // give story gardens a starter house when the save predates houses entirely
  game.houses = s.houses ? s.houses
    : (s.house ? [s.house] : (game.gameMode==='design' ? [] : [defaultHouse()]));
  if (shift) game.houses.forEach(h=>{ h.x+=shift; h.y+=shift; });
  game.houseDraft = draftFromHouses();
  game.pathColor=pathColorId(s.pathColor||game.pathColor);
  game.bedStyle=bedStyleId(s.bedStyle||'soil');
  game.waterStyle=waterStyleId(s.waterStyle||game.waterStyle);
  game.freePlanting=!!s.freePlanting;
  game.fenceDraft=normalizeFenceDraft(s.fenceDraft);
  game.lightDraft=normalizeLightDraft(s.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(s.firepitDraft);
  game.rot=s.rot||0;
  const migratedElapsed = s.elapsedMs!==undefined
    ? Math.max(0,+s.elapsedMs||0)
    : Math.max(0,((s.savedAt||Date.now())-(s.startTs||Date.now())));
  game.elapsedMs=migratedElapsed;
  game.startTs=Date.now();
  game.clockSuspended=false; game.pausedAt=0;
  game.dayOffset=s.dayOffset||0; if (s.char) game.char=s.char;
  game.worldName=s.name||'My garden';
  // Story propagation inventory; auto-grant the starter packet once per story
  // garden (stub for the NPC who hands you your first seeds) so it's testable
  game.seeds=s.seeds||{}; game.flats=s.flats||[]; game.stock=s.stock||{}; game.propSeeded=!!s.propSeeded;
  if (game.gameMode==='story' && !game.propSeeded){ giveStarterSeeds(); game.propSeeded=true; }
  // saves from before the walkway became terrain get it seeded once,
  // so the old built-in path is finally shovel-able
  if (!s.wv) seedWalkway();
  return true;
}
async function saveChar(){ if (hasStorage) await sSet('hortus:char',game.char); }

/* multiplayer: shared keys w:CODE:meta / :plants / :players (visible to all artifact users with the code) */
function wkey(part){ return `hortus:w:${game.code}:${part}`; }
let syncTimer=null, presenceThrottle=0;
async function hostWorld(){
  game.code=Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join('');
  game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.freePlanting=false;
  game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'};
  setWorldSize(31,31); game.houses=[defaultHouse()]; game.houseDraft=draftFromHouses(); game.rot=0; game.houseT=Date.now();
  seedWalkway();
  await sSet(wkey('meta'),{startTs:game.startTs,elapsedMs:game.elapsedMs,gw:GW,gh:GH},true);
  await sSet(wkey('plants'),{},true);
  await sSet(wkey('bulbs'),{},true);
  await sSet(wkey('terrain'),game.terrain,true);
  await sSet(wkey('elevation'),game.elevation,true);
  await sSet(wkey('fences'),game.fences,true);
  await sSet(wkey('lights'),game.lights,true);
  await sSet(wkey('firepits'),game.firepits,true);
  await sSet(wkey('house'),{h:game.houses,t:game.houseT},true);
}
async function joinWorld(code){
  game.code=code;
  const meta=await sGet(wkey('meta'),true);
  if (!meta){ toast('No garden found with that code.'); game.code=null; return false; }
  game.elapsedMs=meta.elapsedMs!==undefined ? Math.max(0,+meta.elapsedMs||0)
    : Math.max(0,Date.now()-(meta.startTs||Date.now()));
  game.startTs=Date.now(); game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  setWorldSize(meta.gw||31, meta.gh||31); game.rot=0;
  const pl=await sGet(wkey('plants'),true); game.plants=pl||{};
  const bl=await sGet(wkey('bulbs'),true); game.bulbs=bl||{};
  const tr=await sGet(wkey('terrain'),true); game.terrain=tr||{};
  const el=await sGet(wkey('elevation'),true); game.elevation=el||{};
  const fn=await sGet(wkey('fences'),true); game.fences=fn||{};
  const li=await sGet(wkey('lights'),true); game.lights=li||{};
  const fp=await sGet(wkey('firepits'),true); game.firepits=fp||{};
  const ho=await sGet(wkey('house'),true);
  const hh=ho&&ho.h;
  game.houses = Array.isArray(hh) ? hh : (hh ? [hh] : [defaultHouse()]);
  game.houseDraft=draftFromHouses(); game.houseT=(ho&&ho.t)||0;
  return true;
}
async function syncPlantsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('plants'),true)||{};
  mergeMap(game.plants,remote);
  await sSet(wkey('plants'),game.plants,true);
}
async function syncTerrainOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('terrain'),true)||{};
  mergeMap(game.terrain,remote);
  await sSet(wkey('terrain'),game.terrain,true);
}
async function syncElevationOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('elevation'),true)||{};
  mergeMap(game.elevation,remote);
  await sSet(wkey('elevation'),game.elevation,true);
}
async function syncBulbsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('bulbs'),true)||{};
  mergeMap(game.bulbs,remote);
  await sSet(wkey('bulbs'),game.bulbs,true);
}
async function syncFencesOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('fences'),true)||{};
  mergeMap(game.fences,remote);
  await sSet(wkey('fences'),game.fences,true);
}
async function syncLightsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('lights'),true)||{};
  mergeMap(game.lights,remote);
  await sSet(wkey('lights'),game.lights,true);
}
async function syncFirepitsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('firepits'),true)||{};
  mergeMap(game.firepits,remote);
  await sSet(wkey('firepits'),game.firepits,true);
}
function mergeMap(target,remote){ // last write wins, per tile
  for (const k in remote){ const r=remote[k], l=target[k];
    if (!l || (r.t||0)>(l.t||0)) target[k]=r; }
}
async function pushPresence(){
  if (game.mode!=='multi') return;
  const now=Date.now(); if (now-presenceThrottle<1500) return; presenceThrottle=now;
  const players=await sGet(wkey('players'),true)||{};
  players[game.playerId]={n:game.char.name||'Gardener',sp:game.char.species,c:game.char.coat,
    cd:game.char.coatD,m:game.char.mark,x:Math.round(game.px),y:Math.round(game.py),ts:now};
  await sSet(wkey('players'),players,true);
}
async function pollWorld(){
  if (game.mode!=='multi') return;
  const remote=await sGet(wkey('plants'),true);
  if (remote) mergeMap(game.plants,remote);
  const remoteT=await sGet(wkey('terrain'),true);
  if (remoteT) mergeMap(game.terrain,remoteT);
  const remoteE=await sGet(wkey('elevation'),true);
  if (remoteE) mergeMap(game.elevation,remoteE);
  const remoteB=await sGet(wkey('bulbs'),true);
  if (remoteB) mergeMap(game.bulbs,remoteB);
  const remoteF=await sGet(wkey('fences'),true);
  if (remoteF) mergeMap(game.fences,remoteF);
  const remoteL=await sGet(wkey('lights'),true);
  if (remoteL) mergeMap(game.lights,remoteL);
  const remoteFP=await sGet(wkey('firepits'),true);
  if (remoteFP) mergeMap(game.firepits,remoteFP);
  const ho=await sGet(wkey('house'),true);
  if (ho && ho.h && (ho.t||0)>game.houseT){
    game.houses = Array.isArray(ho.h) ? ho.h : [ho.h]; game.houseT=ho.t; }
  const players=await sGet(wkey('players'),true)||{};
  game.others={};
  let live=0;
  for (const id in players){ if (id===game.playerId) continue;
    if (Date.now()-players[id].ts<30000){ game.others[id]=players[id]; live++; } }
  const list=document.getElementById('playerList');
  const names=[game.char.name||'You',...Object.values(game.others).map(o=>o.n)];
  list.innerHTML='🌿 '+names.slice(0,4).join('<br>🌿 ');
  if (live>=4) toast('This bed is full — 4 gardeners max.');
}

/* ---------- export: the planting list ----------
   Tallies what's planted and converts game tiles to real quantities:
   one tile is TILE_IN inches square, so a species at tighter spacing
   needs more plants than tiles to fill the same ground, and a big
   clumper like baptisia needs fewer. */
function exportRows(){
  const counts={}; // keyed species|cultivar — cultivars order separately
  [game.plants,game.bulbs].forEach(layer=>{
    for (const k in layer){ const p=layer[k];
      if (!p.removed && p.s){ const ck=p.s+'|'+(p.v||'');
        counts[ck]=(counts[ck]||0)+1; } }
  });
  return Object.keys(counts).map(ck=>{
    const [s,v]=ck.split('|'), P=plantDef(s,v||null), n=counts[ck];
    return {name:P.name, latin:P.latin, native:P.native, count:n,
      areaFt:Math.round(n*(TILE_IN/12)*(TILE_IN/12)*10)/10,
      space:P.space,
      order:Math.ceil(n*TILE_IN*TILE_IN/(P.space*P.space))};
  }).sort((a,b)=>b.count-a.count);
}
function openExport(){
  const rows=exportRows(), body=$('exportBody');
  const where=game.mode==='multi'?`Garden ${game.code}`:'Solo garden';
  $('exportMeta').textContent=`${where} · ${new Date().toLocaleDateString()} · one tile = ${TILE_IN}" × ${TILE_IN}"`;
  if (!rows.length){
    body.innerHTML='<p class="note">Nothing planted yet. Plant a few drifts, then come back for the list.</p>';
  } else {
    const tr=rows.map(r=>`<tr><td>${r.name}${r.native?'':' *'}<div class="latin">${r.latin}</div></td>
      <td>${r.count}</td><td>${r.areaFt}</td><td>${r.space}"</td><td><b>${r.order}</b></td></tr>`).join('');
    const tot=rows.reduce((a,r)=>({c:a.c+r.count,f:a.f+r.areaFt,o:a.o+r.order}),{c:0,f:0,o:0});
    body.innerHTML=`<table class="export-table"><thead><tr>
      <th>Species</th><th>In the garden</th><th>Sq ft</th><th>Spacing</th><th>To order</th></tr></thead>
      <tbody>${tr}</tbody>
      <tfoot><tr><td>Total</td><td>${tot.c}</td><td>${Math.round(tot.f*10)/10}</td><td></td><td>${tot.o}</td></tr></tfoot></table>
      <p class="note">"To order" converts planted ground to plants at each species' recommended
      spacing — buy that many to fill the same area. * marks garden cultivars of non-native origin.</p>`;
  }
  $('exportScreen').classList.remove('hidden');
}

/* ---------- potting bench: the Story propagation UI ----------
   A view over game.seeds / game.flats / game.stock: sow seed (cold-strat
   sits over a winter), watch flats stratify -> grow -> ready, collect the
   plug into stock, then arm it to plant in the ground. No new data model —
   just the surface that lets you actually run the loop. */
const STRAT_LABEL = { none:'sow now', cold:'needs a winter', double:'needs two winters' };
function flatStatusText(f, now){
  const st=flatStage(f,now);
  if (st==='ready') return 'Ready — collect your plug';
  if (st==='stratifying') return 'Stratifying over winter — sprouts in spring';
  const left=Math.max(0, f.grow - growingDays(germDay(f.sown,f.strat), now));
  return `Growing — a plug in ~${left} growing day${left===1?'':'s'}`;
}
function openPotting(){ ensurePropState(); renderPotting(); $('pottingScreen').classList.remove('hidden'); }
function renderPotting(){
  const now=absDay();
  $('pottingMeta').textContent=`${clockMeta()} — cold-strat seed needs one winter before it sprouts`;
  const sec=(title,inner)=>`<div class="pot-section"><h3>${title}</h3>${inner}</div>`;
  const empty=msg=>`<div class="pot-empty">${msg}</div>`;
  const seedKeys=Object.keys(game.seeds||{}).filter(k=>game.seeds[k]>0 && PLANTS[k]).sort();
  const seedRows = seedKeys.length ? seedKeys.map(k=>
    `<div class="pot-row"><span class="pn"><b>${PLANTS[k].name}</b> &times;${game.seeds[k]}
       <span class="ps">${STRAT_LABEL[seedStrat(k)]||''}</span></span>
       <button class="btn sm" data-act="sow" data-key="${k}">Sow</button></div>`).join('')
    : empty('No seed in hand. (A starter packet comes with every story garden.)');
  const flatRows = game.flats.length ? game.flats.map((f,i)=>
    `<div class="pot-row"><span class="pn"><b>${PLANTS[f.s]?PLANTS[f.s].name:f.s}</b>
       <span class="ps">${flatStatusText(f,now)}</span></span>${
       flatStage(f,now)==='ready'?`<button class="btn sm" data-act="collect" data-idx="${i}">Collect</button>`:''
       }</div>`).join('')
    : empty('Nothing sown yet — sow a seed above.');
  const readyN=game.flats.filter(f=>flatStage(f,now)==='ready').length;
  const collectAll = readyN>1
    ? `<div class="pot-row"><span class="pn"></span><button class="btn sm" data-act="collectall">Collect all ${readyN}</button></div>` : '';
  const stockKeys=Object.keys(game.stock||{}).filter(k=>game.stock[k]>0 && PLANTS[k]).sort();
  const stockRows = stockKeys.length ? stockKeys.map(k=>
    `<div class="pot-row"><span class="pn"><b>${PLANTS[k].name}</b> &times;${game.stock[k]} plug${game.stock[k]===1?'':'s'}</span>
       <button class="btn sm" data-act="plant" data-key="${k}">Plant</button></div>`).join('')
    : empty('No plugs yet — sow seed and let it come up.');
  $('pottingBody').innerHTML = sec('Seeds in hand', seedRows)
    + sec('Sown', flatRows+collectAll)
    + sec('Grown plugs', stockRows);
}
function pottingClick(e){
  const b=e.target.closest('button[data-act]'); if (!b) return;
  const act=b.dataset.act, key=b.dataset.key;
  if (act==='sow'){
    if (sowSeed(key)){ syncPropOut();
      toast(`Sowed ${PLANTS[key].name}. ${seedStrat(key)==='none'?'It will come up shortly.':'It needs a winter to sprout.'}`);
      renderPotting(); }
  } else if (act==='collect'){
    const f=game.flats[+b.dataset.idx];
    if (f && flatStage(f,absDay())==='ready'){ const nm=PLANTS[f.s]?PLANTS[f.s].name:f.s;
      harvestReadyFlats(); syncPropOut(); toast(`Collected a ${nm} plug.`); renderPotting(); }
  } else if (act==='collectall'){
    const n=harvestReadyFlats(); if (n){ syncPropOut(); toast(`Collected ${n} plug${n===1?'':'s'}.`); renderPotting(); }
  } else if (act==='plant'){ armPlug(key); }
}
function armPlug(key){
  if (stockCount(key)<=0) return;
  setTool(key); game.plantFromStock=true;   // setTool clears the flag; re-arm right after
  closeOverlay('pottingScreen'); setActButton();
  toast(`Planting ${PLANTS[key].name} — tap your garden (${stockCount(key)} plug${stockCount(key)===1?'':'s'}).`);
}
function syncPropOut(){ game.dirty=true; if (game.mode==='solo'&&hasStorage) saveSolo(true); }
function exportCsv(){
  const rows=exportRows();
  if (!rows.length){ toast('Nothing planted yet.'); return; }
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  const lines=[['Common name','Latin name','Native','Tiles planted','Bed area (sq ft)','Spacing (in)','Plants to order'].map(esc).join(',')];
  rows.forEach(r=>lines.push([r.name,r.latin,r.native?'yes':'no',r.count,r.areaFt,r.space,r.order].map(esc).join(',')));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));
  a.download='hortus-planting-list.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ---------- the planting plan: an Oudolf-style drift map ----------
   Top-down 2D. Contiguous same-species tiles flood-fill into drifts,
   each drift's boundary is traced and smoothed into an organic blob,
   labeled with a short code. Trees draw as dashed mature-canopy
   circles, bulbs as scatter dots over the drifts. */
function planComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k]; if (!p.removed){
    const [x,y]=k.split(',').map(Number), def=plantDef(p.s,p.v);
    if (def.type==='shrub') shrubFootprintTiles(x,y,p,true).forEach(([xx,yy])=>{ if (!live[`${xx},${yy}`]) live[`${xx},${yy}`]=p; });
    else live[k]=p;
  } }
  const seen={}, comps=[];
  for (const k in live){
    if (seen[k]) continue;
    const p=live[k], stack=[k], tiles=[];
    seen[k]=true;
    while (stack.length){
      const cur=stack.pop(); tiles.push(cur);
      const [cx2,cy2]=cur.split(',').map(Number);
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
        if (!dx&&!dy) continue;
        const nk=`${cx2+dx},${cy2+dy}`;
        if (seen[nk]) continue;
        const np=live[nk];
        if (np && np.s===p.s && (np.v||'')===(p.v||'')){ seen[nk]=true; stack.push(nk); }
      }
    }
    comps.push({s:p.s, v:p.v||null, tiles});
  }
  return comps;
}
function traceOutlines(tileSet){ // rectilinear boundary loops of a tile set
  const has=(x,y)=>tileSet.has(`${x},${y}`);
  const edges=new Map(); // "x,y" start -> [end points]
  const add=(x1,y1,x2,y2)=>{ const k=`${x1},${y1}`;
    (edges.get(k)||edges.set(k,[]).get(k)).push([x2,y2]); };
  for (const k of tileSet){ const [x,y]=k.split(',').map(Number);
    if (!has(x,y-1)) add(x,y, x+1,y);
    if (!has(x+1,y)) add(x+1,y, x+1,y+1);
    if (!has(x,y+1)) add(x+1,y+1, x,y+1);
    if (!has(x-1,y)) add(x,y+1, x,y);
  }
  const loops=[];
  for (const [start] of edges){
    if (!edges.get(start).length) continue;
    const pts=[start.split(',').map(Number)];
    let cur=start;
    while (true){
      const outs=edges.get(cur);
      if (!outs || !outs.length) break;
      const [nx,ny]=outs.pop();
      const nk=`${nx},${ny}`;
      if (nk===start) break;
      pts.push([nx,ny]); cur=nk;
    }
    if (pts.length>2){
      // merge collinear runs so the smoothing gets long, sweeping curves
      const out=[];
      for (let i=0;i<pts.length;i++){
        const a=pts[(i+pts.length-1)%pts.length], b2=pts[i], c=pts[(i+1)%pts.length];
        if ((b2[0]-a[0])*(c[1]-b2[1])!==(b2[1]-a[1])*(c[0]-b2[0])) out.push(b2);
      }
      if (out.length>2) loops.push(out);
    }
  }
  return loops;
}
function planJitter(x,y){ // shared lattice wobble: neighboring blobs nest
  const r=mulberry((x*73856093 ^ y*83492791)>>>0);
  return [(r()-0.5)*0.5, (r()-0.5)*0.5];
}
function mixHex(a,b2,t){
  const pa=parseInt(a.slice(1),16), pb=parseInt(b2.slice(1),16);
  const ch=(sh)=>Math.round(((pa>>sh)&255)*(1-t)+((pb>>sh)&255)*t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function planColor(def){
  const s=def.sea.Summer||{}, f=def.sea.Fall||{}, sp=def.sea.Spring||{};
  return s.bloom||sp.bloom||f.bloom||f.seed||s.fol||sp.fol||'#8a8a70';
}
function roundedRectPath(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function isShrubPlanDef(def){
  return isShrubDef(def);
}
function shrubPlanComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const def=plantDef(p.s,p.v);
    if (!isShrubPlanDef(def)) continue;
    const [x,y]=k.split(',').map(Number);
    live[k]={p,def,x,y};
  }
  const seen={}, comps=[];
  for (const k in live){
    if (seen[k]) continue;
    const root=live[k], hedge=!!(root.def.look&&root.def.look.hedge);
    const id=root.p.s+'|'+(root.p.v||''), stack=[k], tiles=[];
    seen[k]=true;
    if (hedge){
      while (stack.length){
        const cur=stack.pop();
        tiles.push(cur);
        const [cx2,cy2]=cur.split(',').map(Number);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
          const nk=`${cx2+dx},${cy2+dy}`, nb=live[nk];
          if (!nb || seen[nk]) return;
          if ((nb.p.s+'|'+(nb.p.v||''))!==id) return;
          if (!(nb.def.look&&nb.def.look.hedge)) return;
          seen[nk]=true; stack.push(nk);
        });
      }
    } else {
      shrubFootprintTiles(root.x,root.y,root.p,true).forEach(([xx,yy])=>tiles.push(`${xx},${yy}`));
    }
    comps.push({s:root.p.s,v:root.p.v||null,tiles,shape:(root.def.look&&root.def.look.shape)||'round',hedge});
  }
  return comps;
}
function drawPlanCode(ctx,code,lx,ly,fs){
  ctx.textAlign='center';
  ctx.font=`600 ${fs}px IBM Plex Sans`;
  ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
  ctx.strokeText(code,lx,ly); ctx.fillStyle='#2c241c'; ctx.fillText(code,lx,ly);
}
function drawShrubPlan(ctx,c,codes,cell,X,Y){
  const def=plantDef(c.s,c.v), col=planColor(def), fill=mixHex(col,'#f7f3e8',0.62);
  const stroke=mixHex(col,'#2c241c',0.18);
  const pts=c.tiles.map(k=>k.split(',').map(Number));
  const code=codes[c.s+'|'+(c.v||'')];
  const shape=(def.look&&def.look.shape)||'round';
  const r=Math.max(cell*0.42,(def.spread/TILE_IN/2)*cell);
  ctx.save();
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=1.25;
  if (!c.hedge){
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cx2=(X(minX)+X(maxX+1))/2, cy2=(Y(minY)+Y(maxY+1))/2;
    const rx=Math.max(r*0.62, (maxX-minX+1)*cell*0.48);
    const ry=Math.max(r*0.48, (maxY-minY+1)*cell*0.48);
    ctx.beginPath();
    ctx.ellipse(cx2,cy2,rx,ry,0,0,7);
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle='#f7f3e8';
    ctx.beginPath(); ctx.ellipse(cx2-rx*0.22,cy2-ry*0.28,rx*0.38,ry*0.20,-0.08,0,7); ctx.fill(); ctx.restore();
    drawPlanCode(ctx,code,cx2,cy2+3,Math.max(8,Math.min(13,Math.min(rx,ry)*0.42)));
    ctx.restore();
    return;
  }
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const sameRow=minY===maxY, sameCol=minX===maxX;
  let rx,ry,rw,rh,rad;
  if (sameRow){
    const c1=X(minX)+cell/2, c2=X(maxX)+cell/2, cy2=Y(minY)+cell/2;
    rx=c1-r; ry=cy2-r*0.70; rw=(c2-c1)+r*2; rh=r*1.40; rad=Math.min(rh*0.18,cell*0.24);
  } else if (sameCol){
    const cx2=X(minX)+cell/2, c1=Y(minY)+cell/2, c2=Y(maxY)+cell/2;
    rx=cx2-r*0.70; ry=c1-r; rw=r*1.40; rh=(c2-c1)+r*2; rad=Math.min(rw*0.18,cell*0.24);
  } else {
    rx=X(minX)+cell/2-r; ry=Y(minY)+cell/2-r;
    rw=(X(maxX)-X(minX))+r*2; rh=(Y(maxY)-Y(minY))+r*2; rad=Math.min(cell*0.28,r*0.28);
  }
  roundedRectPath(ctx,rx,ry,rw,rh,rad);
  ctx.fill(); ctx.stroke();
  ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#f7f3e8';
  roundedRectPath(ctx,rx+rw*0.08,ry+rh*0.10,rw*0.58,rh*0.26,Math.min(rad,rh*0.13));
  ctx.fill(); ctx.restore();
  drawPlanCode(ctx,code,rx+rw/2,ry+rh/2+3,Math.max(8,Math.min(13,5+Math.sqrt(c.tiles.length)*2)));
  ctx.restore();
}
function planCodes(ids){ // short Oudolf-style codes, unique per species|cv
  const used={}, codes={};
  ids.forEach(id=>{
    const [s,v]=id.split('|'), P=plantDef(s,v||null);
    const latin=(P.latin||'').split(' ');
    const gen=(latin[0]||s).slice(0,3).toUpperCase(), ep=(latin[1]||'');
    let code=null;
    for (let n=0;n<=ep.length;n++){
      const c=gen+(n?ep.slice(0,n):'');
      if (!used[c]){ code=c; break; }
    }
    if (!code){ let i=2; while (used[gen+i]) i++; code=gen+i; }
    if (v) code+="'"+v.slice(0,2).toUpperCase();
    used[code]=1; codes[id]=code;
  });
  return codes;
}

function buildPlanMap(){
  const pc=$('planCanvas'), ctx=pc.getContext('2d');
  const cell=Math.max(9, Math.min(24, Math.floor(1000/Math.max(GW,GH))));
  const padL=34, padT=92;
  const allComps=planComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  const shrubComps=shrubPlanComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  const comps=allComps.filter(c=>!isShrubPlanDef(plantDef(c.s,c.v)));
  const bulbsLive=Object.keys(game.bulbs).filter(k=>!game.bulbs[k].removed);
  const ids=[...new Set([
    ...comps.map(c=>c.s+'|'+(c.v||'')),
    ...shrubComps.map(c=>c.s+'|'+(c.v||'')),
    ...bulbsLive.map(k=>{ const b2=game.bulbs[k]; return b2.s+'|'+(b2.v||''); })
  ])];
  const codes=planCodes(ids);
  const legCols=3, legRows=Math.ceil(ids.length/legCols);
  const W2=padL*2+GW*cell, H2=padT+GH*cell+34+legRows*15+26;
  pc.width=W2*2; pc.height=H2*2; pc.style.aspectRatio=`${W2}/${H2}`;
  ctx.setTransform(2,0,0,2,0,0);
  const X=x=>padL+x*cell, Y=y=>padT+y*cell;
  // paper
  ctx.fillStyle='#f7f3e8'; ctx.fillRect(0,0,W2,H2);
  ctx.strokeStyle='#b8ad95'; ctx.lineWidth=1;
  ctx.strokeRect(8,8,W2-16,H2-16);
  // title block
  ctx.fillStyle='#2c241c'; ctx.textAlign='left';
  ctx.font='600 22px Fraunces, serif';
  ctx.fillText(game.worldName||'Planting plan', padL, 38);
  ctx.font='11px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText(`Planting plan · Pocket Prairie Garden Design · ${new Date().toLocaleDateString()}`, padL, 56);
  ctx.fillText(`1 tile = ${TILE_IN}" · plot ${Math.round(GW*1.5)} × ${Math.round(GH*1.5)} ft`, padL, 70);
  // north arrow (world y points up-page on plans; our y+ is south)
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(W2-40,62); ctx.lineTo(W2-40,34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W2-40,30); ctx.lineTo(W2-45,42); ctx.lineTo(W2-35,42); ctx.closePath();
  ctx.fillStyle='#2c241c'; ctx.fill();
  ctx.font='10px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillText('N',W2-40,80);
  // elevation grade: subtle plan cue under materials/plants
  for (const k in game.elevation){ const e=game.elevation[k];
    if (!e || e.removed || !e.h) continue;
    const [x,y]=k.split(',').map(Number);
    ctx.fillStyle=e.h>0?'rgba(145,119,70,0.16)':'rgba(73,112,140,0.18)';
    ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
    ctx.fillStyle=e.h>0?'#8a6735':'#4f7388';
    ctx.font=`600 ${Math.max(7,Math.min(10,cell*0.42))}px IBM Plex Sans`;
    ctx.textAlign='center';
    ctx.fillText(`${e.h>0?'+':''}${e.h}`,X(x)+cell/2,Y(y)+cell/2+3);
  }
  // terrain
  for (const k in game.terrain){ const t2=game.terrain[k];
    if (t2.removed) continue;
    const [x,y]=k.split(',').map(Number);
    ctx.fillStyle=t2.k==='path'?pathPlanFill(t2):t2.k==='water'?waterPlanFill(t2):bedPlanFill(t2);
    ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
  }
  // fire pits
  for (const k in game.firepits){ const f=game.firepits[k];
    if (!f || f.removed) continue;
    const [x,y]=k.split(',').map(Number), d=normalizeFirepitDraft(f), sz=firepitTileSize(d);
    const px=X(x), py=Y(y), w=sz.w*cell, h=sz.h*cell;
    ctx.fillStyle='#766b60'; ctx.strokeStyle='#3b3028'; ctx.lineWidth=1.3;
    if (d.shape==='round'){
      ctx.beginPath(); ctx.ellipse(px+w/2,py+h/2,w*0.42,h*0.42,0,0,7); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2f261f'; ctx.beginPath(); ctx.ellipse(px+w/2,py+h/2,w*0.24,h*0.24,0,0,7); ctx.fill();
    } else {
      ctx.fillRect(px+cell*0.1,py+cell*0.1,w-cell*0.2,h-cell*0.2);
      ctx.strokeRect(px+cell*0.1,py+cell*0.1,w-cell*0.2,h-cell*0.2);
      ctx.fillStyle='#2f261f'; ctx.fillRect(px+w*0.32,py+h*0.32,w*0.36,h*0.36);
    }
  }
  // fences and gates
  for (const k in game.fences){ const f=game.fences[k];
    if (f.removed) continue;
    const [x,y]=k.split(',').map(Number), st=fenceStyle(f.style);
    const cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
    ctx.strokeStyle=st.post; ctx.lineWidth=f.style==='brick'?3:1.6;
    [[1,0],[0,1]].forEach(([dx,dy])=>{
      if (!fenceAt(x+dx,y+dy)) return;
      ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(X(x+dx)+cell/2,Y(y+dy)+cell/2); ctx.stroke();
    });
    ctx.fillStyle=f.gate?'#f7f3e8':st.post;
    ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2,cell*0.16),0,7); ctx.fill();
    if (f.gate){ ctx.strokeStyle=st.post; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(3,cell*0.24),0.2,Math.PI*1.3); ctx.stroke(); }
  }
  // drifts as smoothed blobs (largest first so small ones read on top)
  const smoothLoop=(loop)=>{
    const pts=loop.map(([x,y])=>{ const [jx,jy]=planJitter(x,y);
      return [X(x+jx*0.6), Y(y+jy*0.6)]; });
    const mid=(a,b2)=>[(a[0]+b2[0])/2,(a[1]+b2[1])/2];
    ctx.beginPath();
    let m=mid(pts[pts.length-1],pts[0]);
    ctx.moveTo(m[0],m[1]);
    for (let i=0;i<pts.length;i++){
      const nxt=mid(pts[i],pts[(i+1)%pts.length]);
      ctx.quadraticCurveTo(pts[i][0],pts[i][1],nxt[0],nxt[1]);
    }
    ctx.closePath();
  };
  comps.forEach(c=>{
    const def=plantDef(c.s,c.v);
    if (def.type==='tree') return; // trees become canopy circles below
    const col=planColor(def);
    const loops=traceOutlines(new Set(c.tiles));
    loops.forEach(loop=>{
      smoothLoop(loop);
      ctx.fillStyle=mixHex(col,'#f7f3e8',0.66); ctx.fill();
      ctx.strokeStyle=mixHex(col,'#2c241c',0.25); ctx.lineWidth=1.3; ctx.stroke();
    });
  });
  shrubComps.forEach(c=>drawShrubPlan(ctx,c,codes,cell,X,Y));
  // trees: mature canopy circles, trunk dot
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const def=plantDef(p.s,p.v);
    if (def.type!=='tree') continue;
    const [x,y]=k.split(',').map(Number);
    const r=Math.max(cell*0.6,(def.spread/TILE_IN/2)*cell);
    ctx.strokeStyle='#6e5a40'; ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,r,0,7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#4a3a28';
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,Math.max(2.5,cell*0.18),0,7); ctx.fill();
  }
  // bulbs: scatter rings over everything
  bulbsLive.forEach(k=>{
    const b2=game.bulbs[k], [x,y]=k.split(',').map(Number);
    ctx.strokeStyle=planColor(plantDef(b2.s,b2.v)); ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,Math.max(2,cell*0.2),0,7); ctx.stroke();
  });
  // houses
  game.houses.forEach(hh=>{
    ctx.fillStyle='#e3ddd2'; ctx.strokeStyle='#4a4238'; ctx.lineWidth=1.6;
    ctx.fillRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    ctx.strokeRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    const [dX,dY]=doorPos(hh);
    ctx.fillStyle='#4a4238';
    ctx.fillRect(X(dX)+cell*0.3,Y(dY)-2,cell*0.4,3);
    if (hh.w*cell>40){ ctx.font='10px IBM Plex Sans'; ctx.textAlign='center';
      ctx.fillText('HOUSE', X(hh.x)+hh.w*cell/2, Y(hh.y)+hh.h*cell/2+3); }
  });
  // labels at drift centroids, white halo for legibility
  ctx.textAlign='center';
  comps.forEach(c=>{
    const def=plantDef(c.s,c.v);
    if (def.type==='tree'){ var lt=c.tiles[0].split(',').map(Number);
      var lx=X(lt[0])+cell/2, ly=Y(lt[1])-cell*0.4; }
    else {
      let sx=0,sy=0;
      c.tiles.forEach(k=>{ const [x,y]=k.split(',').map(Number); sx+=x; sy+=y; });
      var lx=X(sx/c.tiles.length+0.5), ly=Y(sy/c.tiles.length+0.5)+3;
    }
    const fs=Math.max(8,Math.min(13,5+Math.sqrt(c.tiles.length)*2));
    ctx.font=`600 ${fs}px IBM Plex Sans`;
    ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
    const code=codes[c.s+'|'+(c.v||'')];
    ctx.strokeText(code,lx,ly); ctx.fillStyle='#2c241c'; ctx.fillText(code,lx,ly);
  });
  // legend + scale bar
  let ly2=padT+GH*cell+26;
  ctx.textAlign='left'; ctx.font='600 10px IBM Plex Sans';
  ctx.fillStyle='#6e5f48'; ctx.fillText('KEY', padL, ly2-8);
  const colW=(W2-padL*2)/legCols;
  const counts={};
  comps.forEach(c=>{ const id=c.s+'|'+(c.v||''); counts[id]=(counts[id]||0)+c.tiles.length; });
  shrubComps.forEach(c=>{ const id=c.s+'|'+(c.v||''); counts[id]=(counts[id]||0)+c.tiles.length; });
  bulbsLive.forEach(k=>{ const b2=game.bulbs[k], id=b2.s+'|'+(b2.v||'');
    counts[id]=(counts[id]||0)+1; });
  ids.forEach((id,i)=>{
    const [s,v]=id.split('|'), def=plantDef(s,v||null);
    const cx2=padL+(i%legCols)*colW, cy2=ly2+Math.floor(i/legCols)*15;
    ctx.fillStyle=mixHex(planColor(def),'#f7f3e8',0.5);
    ctx.fillRect(cx2,cy2-7,9,9);
    ctx.strokeStyle=mixHex(planColor(def),'#2c241c',0.25); ctx.lineWidth=1;
    ctx.strokeRect(cx2,cy2-7,9,9);
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    const nm=def.name.length>26?def.name.slice(0,25)+'…':def.name;
    ctx.fillText(`${codes[id]} — ${nm} (${counts[id]||0})`, cx2+14, cy2);
  });
  // scale bar: 10 ft
  const ftPx=cell/1.5, bx2=W2-padL-ftPx*10, by2=H2-18;
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(bx2,by2); ctx.lineTo(bx2+ftPx*10,by2); ctx.stroke();
  for (let f=0;f<=10;f+=5){ ctx.beginPath();
    ctx.moveTo(bx2+ftPx*f,by2-4); ctx.lineTo(bx2+ftPx*f,by2+4); ctx.stroke(); }
  ctx.font='9px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillStyle='#2c241c';
  ctx.fillText('10 ft', bx2+ftPx*5, by2-8);
}
function openPlan(){ buildPlanMap(); $('planScreen').classList.remove('hidden'); }
function downloadPlan(){
  $('planCanvas').toBlob(b2=>{
    if (!b2) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b2);
    a.download=`${(game.worldName||'garden').replace(/\s+/g,'-').toLowerCase()}-plan.png`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
}

/* ---------- plant roles ----------
   Designer mode uses roles to push the right plants forward for the
   chosen garden style. Roles are computed from the plant data so the
   species file stays focused on botany; explicit PLANTS[k].roles can be
   added later for finer curation. */
const DESIGN_STYLE_LABELS={
  any:'Any garden',
  cottage:'Cottage',
  prairie:'Prairie / Meadow',
  butterfly:'Pollinator',
  shade:'Shade / Woodland',
  japanese:'Japanese',
  mediterranean:'Mediterranean',
  modern:'Modern',
  gravel:'Gravel / Rock',
  formal:'Formal',
  coastal:'Coastal',
};
const ROLE_LABELS={
  architectural:'Architectural',
  aromatic:'Aromatic',
  block:'Block planting',
  bulbLayer:'Bulb layer',
  canopy:'Canopy',
  coastal:'Coastal',
  cottage:'Cottage',
  dry:'Dry garden',
  early:'Early season',
  evergreen:'Evergreen',
  fern:'Fern layer',
  flower:'Flower color',
  formal:'Formal',
  gravel:'Gravel garden',
  groundcover:'Groundcover',
  hedge:'Hedge',
  host:'Host plant',
  hydrangea:'Hydrangea',
  japanese:'Japanese',
  matrix:'Matrix',
  mediterranean:'Mediterranean',
  modern:'Modern',
  movement:'Movement',
  native:'Native',
  naturalistic:'Naturalistic',
  nectar:'Nectar',
  pollinator:'Pollinator',
  prairie:'Prairie',
  romantic:'Romantic',
  seasonal:'Seasonal color',
  seedhead:'Seedheads',
  shade:'Shade',
  silver:'Silver foliage',
  structure:'Structure',
  water:'Water plants',
  wet:'Moist soil',
  wind:'Wind tolerant',
  winter:'Winter interest',
  woodland:'Woodland',
};
const ROLE_DISPLAY_ORDER=[
  'prairie','matrix','pollinator','nectar','host','shade','woodland','groundcover',
  'structure','hedge','evergreen','architectural','modern','formal','japanese',
  'cottage','romantic','bulbLayer','early','dry','gravel','mediterranean',
  'coastal','wind','winter','seedhead','native','flower','seasonal','water','wet',
  'fern','hydrangea','aromatic','silver','movement','canopy','block'
];
const STYLE_ROLE_WEIGHTS={
  cottage:{cottage:9,romantic:5,flower:4,pollinator:3,bulbLayer:3,hydrangea:4,seasonal:2,shade:1},
  prairie:{prairie:9,native:4,matrix:5,naturalistic:4,pollinator:3,winter:3,seedhead:3,dry:1,movement:1},
  butterfly:{pollinator:9,nectar:6,host:6,flower:4,native:3,early:2,seasonal:1},
  shade:{shade:9,woodland:7,groundcover:4,fern:5,early:2,wet:2,structure:1,canopy:1},
  japanese:{japanese:10,structure:5,evergreen:4,shade:3,formal:2,canopy:2,groundcover:1},
  mediterranean:{mediterranean:9,dry:6,aromatic:4,silver:4,architectural:3,gravel:2},
  modern:{modern:9,architectural:6,structure:5,block:5,matrix:3,winter:3,formal:2,seedhead:2},
  gravel:{gravel:9,dry:6,architectural:4,silver:3,matrix:2,mediterranean:2},
  formal:{formal:10,hedge:8,evergreen:5,structure:5,block:3,bulbLayer:2,architectural:1},
  coastal:{coastal:9,wind:6,matrix:3,dry:2,groundcover:1,movement:1},
};
const STYLE_RECOMMEND_MIN={
  cottage:9,
  prairie:12,
  butterfly:14,
  shade:10,
  japanese:10,
  mediterranean:10,
  modern:10,
  gravel:10,
  formal:10,
  coastal:10,
};
const ROLE_CACHE={};
function hasSeasonProp(P,prop){
  return Object.values(P.sea||{}).some(s=>s && s[prop]);
}
function roleMatches(text,terms){
  return terms.some(t=>text.includes(t));
}
function plantRoles(k){
  if (ROLE_CACHE[k]) return ROLE_CACHE[k];
  const P=PLANTS[k]; if (!P) return [];
  const roles=new Set(P.roles||[]);
  const text=`${P.name} ${P.latin} ${P.group||''} ${P.form||''}`.toLowerCase();
  const group=P.group||'';
  roles.add(P.type);
  if (P.native) roles.add('native');
  if (P.sun==='part') roles.add('shade'), roles.add('woodland');
  if (P.moist==='dry') roles.add('dry');
  if (P.moist==='moist') roles.add('wet');
  if (hasSeasonProp(P,'bloom')) roles.add('flower'), roles.add('pollinator'), roles.add('seasonal');
  if (hasSeasonProp(P,'seed')) roles.add('winter'), roles.add('seedhead');
  if (P.native && ['grass','sedge','forb','bulb','water'].includes(P.type))
    roles.add('prairie'), roles.add('naturalistic');
  if (P.native && ['shrub','tree'].includes(P.type)) roles.add('naturalistic');
  if (P.type==='grass') roles.add('matrix'), roles.add('movement'), roles.add('wind');
  if (P.type==='sedge') roles.add('matrix'), roles.add('groundcover'), roles.add('woodland');
  if (P.type==='bulb') roles.add('bulbLayer'), roles.add('early'), roles.add('seasonal');
  if (P.type==='water') roles.add('wet'), roles.add('water'), roles.add('naturalistic');
  if (P.type==='shrub') roles.add('structure');
  if (P.type==='tree') roles.add('structure'), roles.add('canopy');
  if (P.form==='fern') roles.add('fern'), roles.add('shade'), roles.add('woodland');
  if (P.form==='leafmound') roles.add('groundcover'), roles.add('shade'), roles.add('woodland');
  if (['globe','spike','drumstick','rosette','vertgrass','fountaingrass','cloudgrass','conifer'].includes(P.form))
    roles.add('architectural');
  if (['umbel','cone','pincushion','bractstack'].includes(P.form)) roles.add('flower');
  if (P.form==='hydrangea') roles.add('hydrangea'), roles.add('cottage'), roles.add('romantic'), roles.add('shade');

  if (group==='boxwood' || group==='yew'){
    roles.add('evergreen'); roles.add('formal'); roles.add('hedge');
    roles.add('structure'); roles.add('japanese'); roles.add('block');
  }
  if (group==='allium' || text.includes('allium')){
    if (P.type==='bulb') roles.add('bulbLayer');
    roles.add('architectural'); roles.add('formal');
    roles.add('modern'); roles.add('pollinator'); roles.add('nectar');
  }
  if (roleMatches(text,['hydrangea','phlox','yarrow','stachys','scabiosa','sedum','sanguisorba','salvia','catmint','aster','monarda','iris','filipendula','lobelia','poppy mallow','poppymallow','gaura']))
    roles.add('cottage'), roles.add('romantic');
  if (roleMatches(text,['monarda','bee balm','asclepias','milkweed','butterfly weed','zizia','golden alexander','aster','goldenrod','liatris','mountain mint','agastache','coneflower','echinacea','rudbeckia','coreopsis','helenium','helianthus','sunflower','silphium','prairie dock','burnet','sanguisorba','scabiosa','phlox','penstemon','columbine','heuchera','lobelia','hypericum','st. johnswort','callirhoe','poppy mallow','gaura','oenothera','shooting star','primula','pasque','pulsatilla','filipendula','geum','prairie smoke','tradescantia','spiderwort','sisyrinchium','blue-eyed grass','iris','salvia','calamint','catmint','allium']))
    roles.add('pollinator'), roles.add('nectar');
  if (roleMatches(text,['asclepias','milkweed','butterfly weed'])) roles.add('host');
  if (roleMatches(text,['antennaria','pussytoes','zizia','golden alexander'])) roles.add('host');
  if (roleMatches(text,['monarda','mountain mint','calamint','agastache','catmint','salvia','yarrow']))
    roles.add('aromatic');
  if (roleMatches(text,['yucca','eryngium','rattlesnake','echinops','stipa','fescue','mexican feather','calamint','catmint','salvia','yarrow','agastache','allium','baptisia','leadplant','pussytoes','antennaria','pasque','pulsatilla','prairie smoke','geum','poppy mallow','callirhoe','gaura','blue-eyed grass','sisyrinchium']))
    roles.add('dry'), roles.add('gravel'), roles.add('mediterranean');
  if (roleMatches(text,['silver','blue fescue','yucca','eryngium','echinops','yarrow','stachys','rattlesnake','pussytoes','antennaria']))
    roles.add('silver');
  if (roleMatches(text,['japanese maple','flowering cherry','hakone','hosta','fern','astilbe','heuchera','hydrangea','ginkgo','birch','yew','boxwood']))
    roles.add('japanese');
  if (roleMatches(text,['fountain grass','miscanthus','feather reed','calamagrostis','fescue','hakone','boxwood','yew','hydrangea','allium','ginkgo','maple','cherry','birch','rattlesnake','eryngium','echinops']))
    roles.add('modern'), roles.add('block');
  if (roleMatches(text,['boxwood','yew','hydrangea','allium','japanese maple','flowering cherry','ginkgo','serviceberry']))
    roles.add('formal'), roles.add('structure');
  if (roleMatches(text,['muhly','fescue','stipa','sedge','carex','panicum','switchgrass','dropseed','sideoats','yucca','bald cypress','birch']))
    roles.add('coastal'), roles.add('wind');
  return ROLE_CACHE[k]=[...roles].sort();
}
function roleLabel(role){ return ROLE_LABELS[role] || cap(role); }
function roleSummary(k,max=6){
  const roles=plantRoles(k).filter(r=>ROLE_LABELS[r]);
  roles.sort((a,b)=>{
    const ai=ROLE_DISPLAY_ORDER.indexOf(a), bi=ROLE_DISPLAY_ORDER.indexOf(b);
    return (ai<0?999:ai)-(bi<0?999:bi) || roleLabel(a).localeCompare(roleLabel(b));
  });
  return roles.slice(0,max).map(roleLabel).join(', ');
}
function activeDesignType(){
  const d=game.design && game.design.type;
  return (game.gameMode==='design' && d && STYLE_ROLE_WEIGHTS[d]) ? d : null;
}
function designTypeName(type){ return DESIGN_STYLE_LABELS[type] || cap(type||'design'); }
function plantStyleScore(k,type=activeDesignType()){
  const weights=STYLE_ROLE_WEIGHTS[type]; if (!weights) return 0;
  return plantRoles(k).reduce((n,r)=>n+(weights[r]||0),0);
}
function plantStyleRecommended(k,type=activeDesignType()){
  return plantStyleScore(k,type)>=(STYLE_RECOMMEND_MIN[type]||1);
}

/* ---------- region filter ----------
   A plant fits if it survives the chosen zone, and (for natives) calls
   the chosen ecoregion home. Cultivars aren't native anywhere, so the
   eco filter can't exclude them — the natives-only switch is how. */
function plantFits(k){
  const P=PLANTS[k], r=game.region;
  if (r.zone && (P.zones[0]>r.zone || P.zones[1]<r.zone)) return false;
  if (r.nativesOnly && !P.native) return false;
  if (r.eco && P.native && !P.eco.includes(r.eco)) return false;
  return true;
}
function trayKeys(){ // grasses first (the matrix), then sedges, forbs, bulbs/water, woody
  const ord={grass:0, sedge:1, forb:2, bulb:3, water:4, shrub:5, tree:6};
  const d=activeDesignType();
  return PLANT_KEYS.filter(k=>!PLANTS[k].hidden).filter(plantFits).sort((a,b)=>{
    if (d){
      const ds=plantStyleScore(b,d)-plantStyleScore(a,d);
      if (ds) return ds;
    }
    return (ord[PLANTS[a].type]-ord[PLANTS[b].type]) || PLANTS[a].name.localeCompare(PLANTS[b].name);
  });
}
function openRegion(){
  const rs=$('regionSel'), zs=$('zoneSel');
  if (!rs.options.length){
    rs.innerHTML='<option value="">Anywhere</option>'+
      REGIONS.map(r=>`<option>${r.name}</option>`).join('');
    zs.innerHTML='<option value="">Any zone</option>'+
      [3,4,5,6,7,8,9].map(z=>`<option>${z}</option>`).join('');
    rs.onchange=()=>{ const r=REGIONS.find(x=>x.name===rs.value);
      $('regionBlurb').textContent=r?r.blurb:'';
      if (r) zs.value=String(r.zone); };
  }
  rs.value=game.region.eco||'';
  zs.value=game.region.zone?String(game.region.zone):'';
  const cur=REGIONS.find(x=>x.name===rs.value);
  $('regionBlurb').textContent=cur?cur.blurb:'';
  $('nativesOnly').checked=!!game.region.nativesOnly;
  $('regionScreen').classList.remove('hidden');
}
function applyRegion(){
  game.region={eco:$('regionSel').value||null,
    zone:$('zoneSel').value?+$('zoneSel').value:null,
    nativesOnly:$('nativesOnly').checked};
  sSet('hortus:region',game.region);
  updateRegionBtn();
  if (game.mode) buildToolTray();
  const visibleKeys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const n=visibleKeys.filter(plantFits).length;
  toast(`${n} of ${visibleKeys.length} species fit${game.region.eco?' the '+game.region.eco:''}${game.region.zone?', zone '+game.region.zone:''}.`);
  closeOverlay('regionScreen');
}
function updateRegionBtn(){
  const r=game.region;
  $('regionLbl').textContent=(r.eco||r.zone||r.nativesOnly)
    ? `${r.eco||'Any region'}${r.zone?' · z'+r.zone:''}` : 'Region';
}

/* ---------- HUD / tool tray ---------- */
/* tray categories: the bottom main menu. Shrubs and Trees are honest
   placeholders until woody plants exist (type 'shrub' / 'tree'). */
const TRAY_CATS=[
  {id:'grasses',  label:'Grasses',          types:['grass']},
  {id:'sedges',   label:'Sedges',           types:['sedge'], sedgeSections:true},
  {id:'sunper',   label:'Sun Perennials',   types:['forb'], sunFilter:'full'},
  {id:'shadeper', label:'Shade Perennials', types:['forb'], sunFilter:'part'},
  {id:'bulbs',    label:'Bulbs',            types:['bulb']},
  {id:'waterplants',label:'Water Plants',   types:['water']},
  {id:'shrubs',   label:'Shrubs',           types:['shrub']},
  {id:'trees',    label:'Trees',            types:['tree']},
  {id:'landscape',label:'Landscape',        tools:['path','bed','water']},
  {id:'leveling', label:'Leveling',         tools:['raise','lower','level']},
  {id:'structures',label:'Structures',      tools:['fence','firepit']},
  {id:'lighting', label:'Lighting',         tools:['light']},
  {id:'house',    label:'House',            tools:['house']},
];
// two-tier tab grouping: a top-level Plants / Build toggle decides which set
// of category sub-tabs shows, so the bar never spills all twelve at once.
const TRAY_GROUPS=[
  {id:'plants', label:'Plants', cats:['grasses','sedges','sunper','shadeper','bulbs','waterplants','shrubs','trees']},
  {id:'build',  label:'Build',  cats:['landscape','leveling','structures','lighting','house']},
];
function trayGroupOf(catId){ const g=TRAY_GROUPS.find(g=>g.cats.includes(catId)); return g?g.id:'plants'; }
let lastCatByGroup={plants:'grasses', build:'landscape'}; // remember the sub-tab per group
// which garden layer a planted tile belongs to (perennials vs woody)
function plantLayerOf(p){ const P=p&&PLANTS[p.s];
  return (P && (P.type==='shrub'||P.type==='tree')) ? 'woody' : 'perennials'; }
// is a layer currently visible? hidden layers don't render and can't be edited
function layerShown(name){ return game.layerVis[name]!==false; }
const ENABLE_LAYER_EDIT_FOCUS = false; // kept for later; hidden now because visibility is the useful layer control
// does the active edit focus permit touching this layer? (focus is 'all' for now)
function layerEditable(name){ return !ENABLE_LAYER_EDIT_FOCUS || game.layerFocus==='all' || game.layerFocus===name; }
const LAYER_LABELS={all:'All',perennials:'Perennials',bulbs:'Bulbs',woody:'Woody Plants',landscape:'Landscape/Hardscape'};
const LAYER_DEFS=[['perennials'],['bulbs'],['woody'],['landscape']]; // editable layers, in menu order
// the layer a placement tool draws onto (so we can warn when it's hidden)
function isPlacementTool(t){ return t==='house'||t==='fence'||t==='light'||t==='firepit'||t==='path'||t==='bed'||t==='water'||isElevationTool(t)||!!PLANTS[t]; }
function toolTargetLayer(t){ t=t||game.tool;
  if (t==='house'||t==='fence'||t==='light'||t==='firepit'||t==='path'||t==='bed'||t==='water'||isElevationTool(t)) return 'landscape';
  const P=PLANTS[t]; if (!P) return null;
  if (P.type==='bulb') return 'bulbs';
  if (P.type==='shrub'||P.type==='tree') return 'woody';
  return 'perennials';
}
function isBrushTool(k){ return !!PLANTS[k] || k==='path' || k==='bed' || k==='water' || isElevationTool(k) || k==='house' || k==='fence' || k==='light' || k==='firepit'; }
function isDrawableBrushTool(k){ return !!PLANTS[k] || k==='path' || k==='bed' || k==='water' || isElevationTool(k); }
function rememberBrushTool(){
  if (isDrawableBrushTool(game.tool)){ game.lastBrushTool=game.tool; game.lastBrushVar=game.toolVar||null; }
}
function setTool(k,v){
  game.toolMenu=null;
  game.plantFromStock=false; // any normal tool pick leaves "plant from stock" mode
  if (k!=='select'){ game.sel=null; game.selItems=null; selDrag=null; selMove=null; } // leaving select drops its marquee
  if (k==='fence'||k==='light'||k==='firepit'||k==='house'||k==='shovel'||k==='hand'||k==='select'||k==='pick') game.fillMode=false;
  game.tool=k; game.toolVar=v||null;
  rememberBrushTool();
  refreshTray(); renderCvRow(); refreshCanvasTools(); updateCanvasCursor();
}
function drawCanvasIcon(tc,kind){
  tc.clearRect(0,0,42,32);
  tc.strokeStyle='#d8c7ac'; tc.fillStyle='#d8c7ac'; tc.lineWidth=2;
  tc.lineCap='round'; tc.lineJoin='round';
  if (kind==='hand'){
    tc.beginPath(); tc.moveTo(11,20); tc.lineTo(11,11); tc.moveTo(17,20); tc.lineTo(17,8);
    tc.moveTo(23,20); tc.lineTo(23,10); tc.moveTo(29,21); tc.lineTo(29,14);
    tc.moveTo(11,20); tc.quadraticCurveTo(13,29,21,30); tc.quadraticCurveTo(30,30,31,23); tc.stroke();
  } else if (kind==='select'){
    tc.setLineDash([4,3]); tc.strokeRect(8,7,24,18); tc.setLineDash([]);
    tc.beginPath(); tc.moveTo(26,22); tc.lineTo(34,29); tc.moveTo(30,29); tc.lineTo(34,29); tc.lineTo(34,25); tc.stroke();
  } else if (kind==='brush'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.72);
    tc.fillStyle='#c97f3f'; tc.fillRect(-3,-13,6,19);
    tc.fillStyle='#efe6d3'; tc.fillRect(-5,4,10,6);
    tc.fillStyle='#6f8f5a'; tc.beginPath(); tc.moveTo(-6,10); tc.quadraticCurveTo(0,17,6,10); tc.closePath(); tc.fill();
    tc.restore();
  } else if (kind==='erase'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.5);
    tc.fillStyle='#e8b8c2'; tc.strokeStyle='#6e5a48'; tc.lineWidth=1.6;
    tc.fillRect(-11,-7,22,14); tc.strokeRect(-11,-7,22,14);
    tc.fillStyle='#cdbfa9'; tc.fillRect(-11,-7,8,14); tc.strokeRect(-11,-7,8,14);
    tc.restore();
  } else if (kind==='fill'){
    tc.save(); tc.translate(20,16); tc.rotate(-0.72);
    tc.strokeRect(-8,-7,16,14); tc.beginPath(); tc.moveTo(8,3); tc.lineTo(15,9); tc.stroke();
    tc.fillStyle='#5d93a8'; tc.beginPath(); tc.ellipse(14,12,4,2,0,0,7); tc.fill(); tc.restore();
  } else if (kind==='save'){
    tc.strokeRect(10,7,22,18);
    tc.beginPath(); tc.moveTo(15,7); tc.lineTo(15,14); tc.lineTo(27,14); tc.lineTo(27,7); tc.stroke();
    tc.beginPath(); tc.moveTo(15,25); tc.lineTo(15,19); tc.lineTo(27,19); tc.lineTo(27,25); tc.stroke();
  } else if (kind==='paste'){
    tc.strokeRect(12,10,18,16);
    tc.beginPath(); tc.moveTo(17,10); tc.lineTo(17,6); tc.lineTo(25,6); tc.lineTo(25,10); tc.stroke();
    tc.setLineDash([3,2]); tc.strokeRect(7,15,18,12); tc.setLineDash([]);
  } else if (kind==='dropper'){
    tc.beginPath(); tc.moveTo(13,23); tc.lineTo(27,9); tc.stroke();
    tc.strokeRect(24,6,6,6); tc.beginPath(); tc.moveTo(11,25); tc.lineTo(18,25); tc.stroke();
  } else if (kind==='undo'||kind==='redo'){
    const flip=kind==='redo'?-1:1; tc.save(); tc.translate(kind==='redo'?42:0,0); tc.scale(flip,1);
    tc.beginPath(); tc.arc(22,17,9,0.25*Math.PI,1.65*Math.PI,true); tc.stroke();
    tc.beginPath(); tc.moveTo(12,10); tc.lineTo(10,20); tc.lineTo(20,18); tc.stroke(); tc.restore();
  } else if (kind==='rotate'){
    tc.beginPath(); tc.arc(21,16,10,0.15*Math.PI,1.72*Math.PI,false); tc.stroke();
    tc.beginPath(); tc.moveTo(30,8); tc.lineTo(35,8); tc.lineTo(34,13); tc.stroke();
    tc.fillStyle='rgba(201,127,63,.28)'; tc.beginPath();
    tc.moveTo(21,7); tc.lineTo(32,16); tc.lineTo(21,25); tc.lineTo(10,16); tc.closePath(); tc.fill();
  } else if (kind==='layers'){
    for (let i=0;i<3;i++){ tc.beginPath(); tc.moveTo(21,8+i*7); tc.lineTo(33,14+i*7);
      tc.lineTo(21,20+i*7); tc.lineTo(9,14+i*7); tc.closePath(); tc.stroke(); }
  } else if (kind==='move'){
    // four-way arrows
    tc.beginPath(); tc.moveTo(21,6); tc.lineTo(21,28); tc.moveTo(10,17); tc.lineTo(32,17); tc.stroke();
    const tip=(x,y,dx,dy)=>{ tc.beginPath(); tc.moveTo(x,y);
      tc.lineTo(x+dx-dy*0.6,y+dy+dx*0.6); tc.moveTo(x,y); tc.lineTo(x+dx+dy*0.6,y+dy-dx*0.6); tc.stroke(); };
    tip(21,6,0,4); tip(21,28,0,-4); tip(10,17,4,0); tip(32,17,-4,0);
  } else if (kind==='copy'){
    // two overlapping marquees
    tc.setLineDash([3,2]);
    tc.strokeRect(9,8,16,13); tc.strokeRect(17,14,16,13);
    tc.setLineDash([]);
  }
}
function makeCanvasTool(label,kind,opts){
  const b=document.createElement('button');
  b.className='canvas-tool'+(opts&&opts.active?' sel':'')+(opts&&opts.danger?' danger':'')+(opts&&opts.disabled?' disabled':'')+(opts&&opts.todo?' todo':'');
  b.title=opts&&opts.title || label;
  const c=document.createElement('canvas'); c.width=42; c.height=32;
  drawCanvasIcon(c.getContext('2d'),kind);
  const s=document.createElement('span'); s.textContent=label;
  b.append(c,s);
  if (opts&&opts.onClick) b.onclick=opts.onClick;
  return b;
}
function drawPlantModeIcon(tc,drift){
  tc.clearRect(0,0,28,24);
  tc.strokeStyle='#d8c7ac'; tc.fillStyle='#d8c7ac'; tc.lineWidth=1.6;
  if (!drift){
    tc.save(); tc.translate(14,12); tc.rotate(-0.72);
    tc.fillStyle='#c97f3f'; tc.fillRect(-2,-10,4,13);
    tc.fillStyle='#efe6d3'; tc.fillRect(-4,3,8,4);
    tc.fillStyle='#6f8f5a'; tc.beginPath(); tc.moveTo(-5,7); tc.quadraticCurveTo(0,13,5,7); tc.closePath(); tc.fill();
    tc.restore();
    return;
  }
  tc.strokeStyle='#efe6d3';
  for (let i=0;i<5;i++){
    const x=7+(i%3)*7, y=7+Math.floor(i/3)*7;
    tc.beginPath(); tc.ellipse(x,y,4,2.5,0,0,7); tc.stroke();
    tc.beginPath(); tc.moveTo(x,y-4); tc.lineTo(x,y-10); tc.stroke();
  }
}
function drawPlacementIcon(tc,free){
  tc.clearRect(0,0,28,24);
  tc.strokeStyle='rgba(216,199,172,.55)'; tc.lineWidth=1;
  for (let i=0;i<2;i++) for (let j=0;j<2;j++){
    const x=6+i*10, y=5+j*8;
    tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x+5,y+3); tc.lineTo(x,y+6); tc.lineTo(x-5,y+3); tc.closePath(); tc.stroke();
  }
  const pts=free ? [[9,11],[19,8],[15,18]] : [[8,8],[18,8],[13,16]];
  tc.fillStyle=free?'#c97f3f':'#efe6d3';
  pts.forEach(([x,y])=>{ tc.beginPath(); tc.ellipse(x,y,3.2,2.2,0,0,7); tc.fill(); });
}
function plantCategoryFor(k){
  const P=PLANTS[k]; if (!P) return 'grasses';
  const cat=TRAY_CATS.find(c=>c.types && c.types.includes(P.type) &&
    (!c.sunFilter || P.sun===c.sunFilter));
  return cat ? cat.id : 'grasses';
}
function visiblePlantChoice(){
  const visible=trayKeys();
  if (game.lastBrushTool==='path'||game.lastBrushTool==='bed'||game.lastBrushTool==='water'||isElevationTool(game.lastBrushTool))
    return [game.lastBrushTool,null];
  if (PLANTS[game.lastBrushTool] && visible.includes(game.lastBrushTool))
    return [game.lastBrushTool,game.lastBrushVar||null];
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat && c.types);
  let keys=[];
  if (cat){
    keys=visible.filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
  }
  const k=keys[0] || visible.find(k=>PLANTS[k].type==='grass') || visible[0] ||
    PLANT_KEYS.find(k=>!PLANTS[k].hidden);
  return k ? [k,null] : null;
}
function armPlantToolFromRail(openMenu){
  const nextMenu=openMenu ? (game.toolMenu==='plant'?null:'plant') : null;
  const choice=visiblePlantChoice();
  game.fillMode=false;                  // plain planting, not bucket-fill
  game.drill=null;                      // returning to Plant starts at the grid
  if (choice){
    game.tool=choice[0]; game.toolVar=choice[1];
    game.trayCat=PLANTS[choice[0]] ? plantCategoryFor(choice[0])
      : isElevationTool(choice[0]) ? 'leveling'
      : 'landscape';
    rememberBrushTool();
  } else {
    game.tool='hand'; game.toolVar=null;
  }
  game.toolMenu=nextMenu;
  buildToolTray();
  renderCvRow();
  refreshCanvasTools();
  updateCanvasCursor();
  if (!choice) toast('Pick a plant from the catalog first.');
  return !!choice;
}
/* bucket fill: a tap floods the connected region of the tapped tile's
   GROUND material (grass / path / bed / water) and applies the armed brush
   to every tile in it — fill a bed block with a plant, recolour a path run,
   turn a lawn into beds, etc. Fill is a mode layered over the armed brush,
   so the bottom catalog still picks what you fill WITH. */
function fillActive(){ return game.fillMode && isBrushTool(game.tool) && game.tool!=='house' && game.tool!=='fence' && game.tool!=='light' && game.tool!=='firepit'; }
function groundMat(x,y){ return tileTerrain(x,y) || 'grass'; }
function armFillTool(){
  game.toolMenu=null;
  // keep the current plant/material if one's armed; otherwise pick a sensible default
  if (!isBrushTool(game.tool) || game.tool==='house' || game.tool==='fence' || game.tool==='light' || game.tool==='firepit'){
    const choice=visiblePlantChoice();
    if (choice){ game.tool=choice[0]; game.toolVar=choice[1]; }
    else { game.tool='hand'; game.toolVar=null; }
  }
  // keep the catalog tab on the armed brush so buildToolTray won't drop it
  if (PLANTS[game.tool]) game.trayCat=plantCategoryFor(game.tool);
  else if (isElevationTool(game.tool)) game.trayCat='leveling';
  else if (game.tool==='path'||game.tool==='bed'||game.tool==='water') game.trayCat='landscape';
  rememberBrushTool();
  game.fillMode = isBrushTool(game.tool) && game.tool!=='house' && game.tool!=='fence' && game.tool!=='light' && game.tool!=='firepit';
  buildToolTray(); renderCvRow(); refreshCanvasTools(); updateCanvasCursor();
  toast(game.fillMode
    ? 'Fill: tap an area to flood it with the selected plant, material, or grade.'
    : 'Pick a plant or material from the catalog, then tap to fill.');
}
function doFloodFill(sx,sy){
  if (sx<0||sy<0||sx>=GW||sy>=GH || inHouse(sx,sy) || isDoor(sx,sy)) return;
  const seed=groundMat(sx,sy);
  // BFS the 4-connected region sharing that ground material
  const region=[], seen=new Set([sx+','+sy]), q=[[sx,sy]];
  while (q.length){
    const [x,y]=q.shift(); region.push([x,y]);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy, key=nx+','+ny;
      if (nx<0||ny<0||nx>=GW||ny>=GH || seen.has(key)) continue;
      if (inHouse(nx,ny) || isDoor(nx,ny)) continue;
      if (groundMat(nx,ny)!==seed) continue;
      seen.add(key); q.push([nx,ny]);
    }
  }
  let placed=0, what=null;
  withUndo(()=>{ region.forEach(([x,y])=>{ const r=applyToolAt(x,y); if (r){ placed++; what=r; } }); });
  if (placed){
    syncToolLayer(what);
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    const label = def ? def.name : game.tool==='path'?`${pathColor(game.pathColor).label} path`
      : game.tool==='water'?`${waterStyle(game.waterStyle).label} water`
      : isElevationTool(game.tool)?(game.tool==='raise'?'raised grade':game.tool==='lower'?'lowered grade':'level grade')
      : `${bedStyle(game.bedStyle).label} bed`;
    toast(`Filled ${placed} tile${placed>1?'s':''} with ${label}.`);
  } else toast('Nothing here that fill can change.');
}
/* eyedropper: sample whatever is on the tapped tile (plant > bulb > fence/light/firepit > terrain)
   and arm it as the brush, dropping straight into Plant mode so the next tap
   paints with it. */
function pickAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return;
  const k=`${x},${y}`;
  const direct=game.plants[k], sh=shrubAt(x,y);
  const p=(direct&&!direct.removed)?direct:(sh&&sh.p), b=game.bulbs[k], f=fenceAt(x,y), l=lightAt(x,y), fp=firepitAt(x,y), terr=terrainAt(x,y);
  if (p && !p.removed){
    game.fillMode=false; game.trayCat=plantCategoryFor(p.s);
    setTool(p.s, p.v||null); buildToolTray();
    toast(`Picked ${plantDef(p.s,p.v).name}.`);
  } else if (b && !b.removed){
    game.fillMode=false; game.trayCat='bulbs';
    setTool(b.s, b.v||null); buildToolTray();
    toast(`Picked ${plantDef(b.s,b.v).name}.`);
  } else if (f){
    game.fillMode=false; game.trayCat='structures';
    game.fenceDraft=normalizeFenceDraft(f);
    setTool('fence', null); buildToolTray();
    toast(`Picked ${fenceLabel(f)}.`);
  } else if (l){
    game.fillMode=false; game.trayCat='lighting';
    game.lightDraft=normalizeLightDraft(l);
    setTool('light', null); buildToolTray();
    toast(`Picked ${lightLabel(l)}.`);
  } else if (fp){
    game.fillMode=false; game.trayCat='structures'; game.drill='firepit';
    game.firepitDraft=normalizeFirepitDraft(fp);
    setTool('firepit', null); buildToolTray();
    toast(`Picked ${firepitLabel(fp)}.`);
  } else if (terr){
    if (terr.k==='path') game.pathColor=pathColorId(terr.c||game.pathColor);
    if (terr.k==='water') game.waterStyle=waterStyleId(terr.c||game.waterStyle);
    if (terr.k==='bed') game.bedStyle=bedStyleId(terr.c||game.bedStyle);
    game.fillMode=false; game.trayCat='landscape';
    setTool(terr.k, null); buildToolTray();
    toast(terr.k==='path'?`Picked ${pathColor(game.pathColor).label} path.`
      : terr.k==='water'?`Picked ${waterStyle(game.waterStyle).label} water.`
      : `Picked ${bedStyle(game.bedStyle).label} bed.`);
  } else toast('Nothing here to pick — tap a plant or material.');
}
function choosePlantMode(drift){
  game.drift=!!drift;
  armPlantToolFromRail(false);
  toast(game.drift
    ? 'Drift planting on. Pick a plant, then paint natural clusters.'
    : 'Draw mode. Pick a plant, then paint single placements.');
}
function choosePlacementMode(free){
  game.freePlanting=!!free;
  armPlantToolFromRail(false);
  toast(game.freePlanting
    ? 'Free placement on. Herbaceous plants land where you click, not just tile centers.'
    : 'Grid placement on. Plants sit neatly at tile centers.');
}
function addPlantToolMenu(rail){
  const pop=document.createElement('div');
  pop.className='tool-popover';
  const option=(label,drift,title)=>{
    const b=document.createElement('button');
    b.className=game.drift===drift?'sel':'';
    b.title=title;
    const c=document.createElement('canvas'); c.width=28; c.height=24;
    drawPlantModeIcon(c.getContext('2d'),drift);
    const s=document.createElement('span'); s.textContent=label;
    b.append(c,s);
    b.onclick=(ev)=>{ ev.stopPropagation(); choosePlantMode(drift); };
    pop.appendChild(b);
  };
  option('Draw plants',false,'Paint selected plants one at a time');
  option('Drift plants',true,'Paint selected plants in natural clusters');
  const placement=(label,free,title)=>{
    const b=document.createElement('button');
    b.className=game.freePlanting===free?'sel':'';
    b.title=title;
    const c=document.createElement('canvas'); c.width=28; c.height=24;
    drawPlacementIcon(c.getContext('2d'),free);
    const s=document.createElement('span'); s.textContent=label;
    b.append(c,s);
    b.onclick=(ev)=>{ ev.stopPropagation(); choosePlacementMode(free); };
    pop.appendChild(b);
  };
  placement('Grid placement',false,'Plants snap to tile centers');
  placement('Free placement',true,'Plants keep the cursor position inside the tile');
  rail.appendChild(pop);
}
function renderEraseTray(tray){
  renderCvRow();
  const sep=t=>{ const s=document.createElement('span'); s.className='tray-sep';
    s.textContent=t; tray.appendChild(s); };
  const toolBtn=(label,kind,sel,fn,title)=>{
    const b=document.createElement('button');
    b.className='tool danger'+(sel?' sel':'');
    b.title=title||label;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const ctx2=c.getContext('2d'); ctx2.save(); ctx2.translate(3,6);
    drawCanvasIcon(ctx2,kind); ctx2.restore();
    const sp=document.createElement('span'); sp.textContent=label;
    b.append(c,sp); b.onclick=fn; tray.appendChild(b);
    return b;
  };
  sep('Erase');
  [['all','All'],['plant','Plants'],['bulb','Bulbs'],['terrain','Land']]
    .forEach(([m,lbl])=>toolBtn(lbl,'erase',game.eraseMode===m,()=>{
      game.eraseMode=m;
      buildToolTray(); refreshCanvasTools();
      toast(m==='all'?'Erasing everything.':`Erasing ${lbl.toLowerCase()} only.`);
    },`Erase ${lbl.toLowerCase()}`));
  sep('Size');
  [1,3,5].forEach(sz=>toolBtn(sz===1?'1 tile':`${sz}x${sz}`,'layers',game.eraseSize===sz,()=>{
    game.eraseSize=sz;
    buildToolTray(); refreshCanvasTools();
    toast(`Erase size: ${sz}x${sz}.`);
  },`Erase size ${sz}x${sz}`));
}
function renderSelectTray(tray){
  renderCvRow();
  const sep=t=>{ const s=document.createElement('span'); s.className='tray-sep';
    s.textContent=t; tray.appendChild(s); };
  const btn=(label,kind,sel,fn,title,dim)=>{
    const b=document.createElement('button');
    b.className='tool'+(sel?' sel':'')+(dim?' disabled':'');
    b.title=title||label;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const ctx2=c.getContext('2d'); ctx2.save(); ctx2.translate(3,6);
    drawCanvasIcon(ctx2,kind); ctx2.restore();
    const sp=document.createElement('span'); sp.textContent=label;
    b.append(c,sp); if (!dim) b.onclick=fn; tray.appendChild(b);
    return b;
  };
  if (!game.sel){
    const hint=document.createElement('span'); hint.className='tray-empty';
    hint.textContent='Drag a box on the garden to select an area.';
    tray.appendChild(hint);
    return;
  }
  // mode toggles: how a drag on the selection behaves
  sep('Drag to');
  btn('Move','move',game.selMode==='move',()=>{ game.selMode='move'; buildToolTray();
    toast('Drag the selection to move it.'); },'Drag the selection to a new spot');
  btn('Duplicate','copy',game.selMode==='copy',()=>{ game.selMode='copy'; buildToolTray();
    toast('Drag the selection to drop a copy.'); },'Drag to drop a copy, leaving the original');
  // one-shot actions
  sep('Actions');
  btn('Fill','fill',false,()=>{ fillSelectionWithPlant(); },
    'Fill the selection with the last selected plant or landscape material');
  btn('Rotate','rotate',false,()=>{ rotateSelection(); buildToolTray(); refreshCanvasTools(); },
    'Rotate the selection 90°');
  btn('Erase','erase',false,()=>{ eraseSelection(); refreshCanvasTools(); },
    'Delete everything in the selection');
  sep('Area');
  btn('Save','save',false,()=>{ saveSelectedArea(); },
    'Save this selected area for later pasting');
  btn('Paste','paste',false,()=>{ pasteSavedArea(); },
    'Paste the saved area starting at this selection',!storedArea());
}
function refreshCanvasTools(){ buildCanvasTools(); }
// The top bar carries the view/select controls — Select · Rotate · Layers, the
// non-painting tools — beside the season dial. Keep their icons + state in sync,
// and (re)render the Layers flyout pinned under its button.
function syncTopTools(){
  const sel=document.getElementById('btnSelectTool');
  if (sel){ sel.classList.toggle('sel',game.tool==='select');
    sel.onclick=()=>{ setTool('select'); buildToolTray(); };
    const c=document.getElementById('btnSelectIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'select'); }
  const rot=document.getElementById('btnRotateTool');
  if (rot){ rot.onclick=()=>rotateView(1);
    const c=document.getElementById('btnRotateIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'rotate'); }
  const lay=document.getElementById('btnLayersTool');
  if (lay){ lay.classList.toggle('sel',game.toolMenu==='layers'||layerViewActive());
    lay.onclick=()=>toggleLayerMenu();
    const c=document.getElementById('btnLayersIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'layers'); }
  renderLayerMenu();
}
function buildCanvasTools(){
  const rail=document.getElementById('canvasTools'); if (!rail) return;
  syncTopTools();
  rail.innerHTML='';
  const add=(label,kind,opts)=>rail.appendChild(makeCanvasTool(label,kind,opts||{}));
  const sep=()=>{ const s=document.createElement('div'); s.className='canvas-sep'; rail.appendChild(s); };
  add('Hand','hand',{active:game.tool==='hand',title:'Hand / safe select: drag the map to pan',
    onClick:()=>setTool('hand')});
  add('Plant','brush',{active:!!PLANTS[game.tool]&&!game.fillMode,
    title:'Plant: pick a species below; set Draw/Drift and Grid/Free in the brush bar',
    onClick:()=>armPlantToolFromRail(false)});
  add('Erase','erase',{active:game.tool==='shovel',danger:true,title:'Erase plants, bulbs, or landscape',
    onClick:()=>{ setTool('shovel'); buildToolTray(); }});
  add('Pick','dropper',{active:game.tool==='pick',
    title:'Eyedropper: tap a tile to copy its plant or material onto the brush',
    onClick:()=>{ setTool('pick'); buildToolTray(); }});
  // Undo/Redo are one-shot history actions, not modes — docked below a divider
  // so they read apart from the paint tools; greyed when their stack is empty.
  sep();
  add('Undo','undo',{disabled:!undoStack.length,title:'Undo (Ctrl+Z)',onClick:doUndo});
  add('Redo','redo',{disabled:!redoStack.length,title:'Redo (Ctrl+Shift+Z)',onClick:doRedo});
}
/* a small themed yes/no modal, built on the fly (matches the .screen panels).
   Returns nothing; calls onOk only if the user confirms. */
function showConfirm(title, body, okLabel, onOk){
  const old=document.getElementById('confirmPop'); if (old) old.remove();
  const scr=document.createElement('div');
  scr.id='confirmPop'; scr.className='screen';
  scr.style.cssText='z-index:60;background:rgba(0,0,0,.55)';
  scr.innerHTML='<div class="panel pause-panel"><h2></h2><p class="sub"></p>'+
    '<div class="row" style="margin-top:14px">'+
    '<button class="btn" data-x></button><button class="btn primary" data-ok></button></div></div>';
  scr.querySelector('h2').textContent=title;
  scr.querySelector('p').textContent=body||'';
  scr.querySelector('[data-x]').textContent='Cancel';
  scr.querySelector('[data-ok]').textContent=okLabel||'OK';
  const close=()=>scr.remove();
  scr.querySelector('[data-x]').onclick=close;
  scr.querySelector('[data-ok]').onclick=()=>{ close(); onOk&&onOk(); };
  scr.addEventListener('click',e=>{ if (e.target===scr) close(); });
  document.body.appendChild(scr);
}
/* the layer is hidden but the gardener is trying to draw on it: offer to
   reveal it, and honor their click by placing once they say yes. */
function promptRevealLayer(layer,x,y){
  const label=LAYER_LABELS[layer];
  showConfirm(`Show the ${label} layer?`,
    `The ${label} layer is hidden right now, so you can't see what you place there. Show it and plant?`,
    'Show layer',
    ()=>{
      game.layerVis[layer]=true; refreshCanvasTools();
      withUndo(()=>{
        if (game.tool==='house'){ placeHouse(x,y); }
        else { game.tx=x; game.ty=y; actHere(); }
      });
    });
}
// true when the view is anything other than "everything visible, no overlay"
function layerViewActive(){
  return (ENABLE_LAYER_EDIT_FOCUS && game.layerFocus!=='all') || game.layerVis.shade || LAYER_DEFS.some(([k])=>!layerShown(k));
}
function blockIfWrongEditLayer(layer){
  if (!layer || layerEditable(layer)) return false;
  toast(`Edit focus is ${LAYER_LABELS[game.layerFocus]||game.layerFocus}. Switch to All or ${LAYER_LABELS[layer]} to edit here.`);
  return true;
}
function toggleLayerMenu(){
  game.toolMenu = game.toolMenu==='layers' ? null : 'layers';
  refreshCanvasTools();
}
// The Layers flyout hangs off the top-bar Layers button now, so pin it there as
// a fixed dropdown (same idea as the garden/time menus) and rebuild it in place
// whenever the rail refreshes — its rows call refreshCanvasTools() to re-render.
function renderLayerMenu(){
  const old=document.getElementById('layerPop'); if (old) old.remove();
  const btn=document.getElementById('btnLayersTool');
  if (game.toolMenu!=='layers' || !btn) return;
  const pop=buildLayerPopover(); pop.id='layerPop';
  pop.style.position='fixed'; pop.style.zIndex='40';
  pop.style.bottom='auto'; pop.style.right='auto';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(), w=pop.offsetWidth||172;
  let left=Math.min(Math.round(r.left), innerWidth-w-8); left=Math.max(8,left);
  pop.style.top=Math.round(r.bottom+6)+'px';
  pop.style.left=left+'px';
}
function buildLayerPopover(){
  if (!ENABLE_LAYER_EDIT_FOCUS) game.layerFocus='all';
  const pop=document.createElement('div');
  pop.className='tool-popover layer-popover';
  const section=title=>{ const h=document.createElement('div');
    h.className='layer-section'; h.textContent=title; pop.appendChild(h); };
  // one row = a visibility toggle. The whole row (eye + label) flips it;
  // the row mutes when off and stays put so it can be turned back on.
  const row=(get,set,label)=>{
    const on=get();
    const b=document.createElement('button');
    b.className='layer-row'+(on?'':' off');
    b.title=(on?'Hide ':'Show ')+label;
    const eye=document.createElement('span'); eye.className='layer-eye';
    eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); set(!on); refreshCanvasTools();
      toast(`${label} ${!on?'shown':'hidden'}.`); };
    pop.appendChild(b);
  };
  const focusRow=(key,label)=>{
    const on=game.layerFocus===key;
    const b=document.createElement('button');
    b.className='layer-row'+(on?' sel':'');
    b.title=`Edit ${label}`;
    const eye=document.createElement('span'); eye.className='layer-eye';
    eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); game.layerFocus=key; refreshCanvasTools();
      toast(key==='all'?'Editing all visible layers.':`Editing ${label} only.`); };
    pop.appendChild(b);
  };
  section('Visible');
  const allVisible=()=>LAYER_DEFS.every(([key])=>layerShown(key)) && !game.layerVis.shade;
  const allRow=document.createElement('button');
  allRow.className='layer-row'+(allVisible()?' sel':'');
  allRow.title='Show the normal full garden';
  const allEye=document.createElement('span'); allEye.className='layer-eye'; allEye.textContent=allVisible()?'*':'-';
  const allName=document.createElement('span'); allName.className='layer-name'; allName.textContent='All';
  allRow.append(allEye,allName);
  allRow.onclick=ev=>{ ev.stopPropagation();
    LAYER_DEFS.forEach(([key])=>{ game.layerVis[key]=true; });
    game.layerVis.shade=false; refreshCanvasTools(); toast('All layers shown.'); };
  pop.appendChild(allRow);
  LAYER_DEFS.forEach(([key])=>row(
    ()=>layerShown(key), v=>{ game.layerVis[key]=v; }, LAYER_LABELS[key]));
  if (ENABLE_LAYER_EDIT_FOCUS){
    section('Edit');
    focusRow('all','All');
    LAYER_DEFS.forEach(([key])=>focusRow(key,LAYER_LABELS[key]));
  }
  section('Overlays');
  row(()=>!!game.layerVis.shade, v=>{ game.layerVis.shade=v; }, 'Shade Overlay');
  return pop;
}
function buildToolTray(){
  const tabs=document.getElementById('trayTabs'); tabs.innerHTML='';
  const activeGroup=trayGroupOf(game.trayCat);
  lastCatByGroup[activeGroup]=game.trayCat;
  const selectCat=(id)=>{ game.trayCat=id; game.toolMenu=null; game.drill=null;
    if (game.tool==='shovel'||game.tool==='select'||game.tool==='pick') setTool('hand');
    else refreshCanvasTools();
    buildToolTray(); };
  // tier 1: Plants / Build
  TRAY_GROUPS.forEach(g=>{
    const b=document.createElement('button');
    b.className='tab grp'+(activeGroup===g.id?' sel':''); b.textContent=g.label;
    b.onclick=()=>selectCat(lastCatByGroup[g.id]||g.cats[0]);
    tabs.appendChild(b);
  });
  // search is a toggle (a magnifier), not a permanent input row. When open it
  // takes the sub-tabs' place, so it never adds a wrapping row.
  const canSearch = game.tool!=='shovel' && game.tool!=='select';
  if (canSearch){
    const sb=document.createElement('button');
    // when open, the glyph flips to ✕ so it's obvious how to get the
    // categories back (it took their place); 🔍 when closed
    sb.className='tab tab-search'+(game.searchOpen?' sel close':'');
    sb.textContent=game.searchOpen?'✕':'\u{1F50D}';
    sb.title=game.searchOpen?'Close search — back to categories':'Search the open category';
    sb.onclick=()=>{ game.searchOpen=!game.searchOpen; if (!game.searchOpen) game.traySearch='';
      buildToolTray(); const i=document.getElementById('traySearch'); if (i) i.focus(); };
    tabs.appendChild(sb);
  }
  const div=document.createElement('span'); div.className='tab-div'; tabs.appendChild(div);
  if (canSearch && game.searchOpen){
    const si=document.createElement('input'); // search within the open category
    si.id='traySearch'; si.type='search'; si.placeholder='search plants…';
    si.value=game.traySearch||'';
    si.oninput=()=>{ game.traySearch=si.value; applyTraySearch(); };
    si.onkeydown=(e)=>{ if (e.key==='Escape'){ e.stopPropagation();
      game.searchOpen=false; game.traySearch=''; buildToolTray(); } };
    tabs.appendChild(si);
  } else {
    // tier 2: the active group's category sub-tabs
    const groupCats=TRAY_GROUPS.find(g=>g.id===activeGroup).cats;
    TRAY_CATS.filter(c=>groupCats.includes(c.id)).forEach(c=>{
      const b=document.createElement('button');
      b.className='tab'+(game.trayCat===c.id?' sel':''); b.textContent=c.label;
      b.onclick=()=>selectCat(c.id);
      tabs.appendChild(b);
    });
  }
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat)||TRAY_CATS[0];
  if (game.tool==='select'){
    renderSelectTray(tray);
    updateCanvasCursor();
    return;
  }
  if (game.tool==='shovel'){
    renderEraseTray(tray);
    updateCanvasCursor();
    return;
  }
  if (cat.types){
    let keys=trayKeys().filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
    // if the filter took the selected species away, fall back sensibly
    const all=trayKeys();
    if (PLANTS[game.tool] && !all.includes(game.tool)){ game.tool='hand'; game.toolVar=null; }
    if (PLANTS[game.tool] && keys.length && !keys.includes(game.tool)){ game.tool='hand'; game.toolVar=null; }
    if (!keys.length){
      const sp=document.createElement('span'); sp.className='tray-empty';
      sp.textContent='Nothing fits the region filter here.';
      tray.appendChild(sp);
    }
    // drilled into a species' sub-species? show those (+ Back) instead of the grid.
    if (game.drill && !PLANTS[game.drill]) game.drill=null;
    if (game.drill){
      const D=PLANTS[game.drill];
      const members=D.group ? keys.filter(k=>PLANTS[k].group===D.group)
                            : (keys.includes(game.drill)?[game.drill]:[]);
      if (members.length){
        renderDrillIn(tray, game.drill, members);
        renderCvRow(); applyTraySearch(); updateCanvasCursor();
        return;
      }
      game.drill=null; // the drilled species fell outside this filter/category
    }
    const grouped={};
    const designType=activeDesignType();
    let sections;
    if (cat.sedgeSections){
      sections=[['Sun sedges',keys.filter(k=>PLANTS[k].sun==='full')],
        ['Shade sedges',keys.filter(k=>PLANTS[k].sun!=='full')]];
    } else if (designType){
      const best=keys.filter(k=>plantStyleRecommended(k,designType));
      const other=keys.filter(k=>!plantStyleRecommended(k,designType));
      sections=[
        best.length ? ['Best fit',best,`Recommended for ${designTypeName(designType)}`] : null,
        other.length ? ['Other fits',other,`Still matches zone/native filters, but is less tied to ${designTypeName(designType)}`] : null,
      ].filter(Boolean);
    } else {
      sections=[[null,keys]];
    }
    const addPlantButton=(k)=>{
      const P=PLANTS[k];
      // species sharing a group collapse into one button; the chip row
      // (renderCvRow) picks the species inside it
      if (P.group){
        if (grouped[P.group]) return false;
        grouped[P.group]=true;
      }
      const activeGroup = P.group && keys.includes(game.tool) &&
        PLANTS[game.tool] && PLANTS[game.tool].group===P.group;
      const rep = activeGroup ? game.tool : k;
      const R=PLANTS[rep];
      const drillable=!!(P.group || P.cv);
      const b=document.createElement('button');
      b.className='tool'+((P.group ? activeGroup : game.tool===k)?' sel':'')+(drillable?' has-sub':'');
      b.dataset.k=k; if (P.group) b.dataset.group=P.group;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const sc=Math.min(0.62, 36/(R.h||40));   // tall plants shrink to fit
      const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
      const iconSeason=R.type==='bulb' ? (SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring') : 'Summer';
      drawPlant(ctx2,24/sc,42/sc,rep,1,iconSeason,tileSeed(3,7),0,undefined,1);
      const sp=document.createElement('span');
      const label=P.group ? (R.groupLabel||P.group[0].toUpperCase()+P.group.slice(1))
                          : P.name.split(' ').slice(0,2).join(' ');
      sp.textContent=label;
      b.append(c,sp);
      b.onclick=()=>{
        if (drillable){ game.drill=k; buildToolTray(); }   // open its sub-species
        else { setTool(k,null); toast(`${P.name} — ${P.latin}`); }
      };
      tray.appendChild(b);
      return true;
    };
    sections.forEach(([label,sectionKeys,title])=>{
      if (!sectionKeys.length) return;
      if (label){
        const sep=document.createElement('span');
        sep.className='tray-sep';
        sep.textContent=label;
        if (title) sep.title=title;
        tray.appendChild(sep);
      }
      sectionKeys.forEach(addPlantButton);
    });
    renderCvRow(); applyTraySearch(); updateCanvasCursor();
    return;
  }
  // material categories: Landscape and House.
  // A tool tab arms its first tool right away — RTS style.
  if (!cat.tools.includes(game.tool)){ game.tool=cat.tools[0]; game.toolVar=null; rememberBrushTool(); }
  renderCvRow();
  if (cat.tools.includes('path')||cat.tools.includes('bed')||cat.tools.includes('water')||cat.tools.some(isElevationTool)){
    const pathCol=pathColor(game.pathColor);
    const bedCol=bedStyle(game.bedStyle);
    const waterCol=waterStyle(game.waterStyle);
    const drawMat=(tc,opt)=>{
      const seed=opt.seed||1, rs=mulberry(seed);
      tc.fillStyle=opt.fill;
      tc.beginPath(); tc.moveTo(24,12); tc.lineTo(42,23); tc.lineTo(24,34); tc.lineTo(6,23);
      tc.closePath(); tc.fill();
      if (opt.deep){
        tc.fillStyle=opt.deep;
        tc.beginPath(); tc.moveTo(24,23); tc.lineTo(42,23); tc.lineTo(24,34); tc.lineTo(6,23);
        tc.closePath(); tc.fill();
      }
      tc.strokeStyle='rgba(239,230,211,.45)'; tc.lineWidth=1.2; tc.stroke();
      if (opt.texture==='water'){
        tc.strokeStyle='rgba(232,248,244,.78)'; tc.lineWidth=1;
        for (let r=0;r<2;r++){ tc.beginPath(); tc.ellipse(24,21+r*6,12-r*3,2.2,0,0,7); tc.stroke(); }
      } else if (opt.texture==='leaf'){
        const cols=['rgba(181,111,52,.75)','rgba(83,50,28,.72)','rgba(211,153,77,.55)'];
        for (let i=0;i<6;i++){ tc.fillStyle=cols[i%cols.length]; tc.beginPath();
          tc.ellipse(24+(rs()-0.5)*24,23+(rs()-0.5)*10,3.4,1.1,rs()*3,0,7); tc.fill(); }
      } else if (opt.texture==='mulch'){
        tc.strokeStyle='rgba(30,16,10,.55)'; tc.lineWidth=2;
        for (let i=0;i<6;i++){ const ox=24+(rs()-0.5)*24, oy=23+(rs()-0.5)*10;
          tc.beginPath(); tc.moveTo(ox-4,oy); tc.lineTo(ox+5,oy+(rs()-0.5)*3); tc.stroke(); }
      } else {
        tc.fillStyle=opt.texture==='rock'?'rgba(255,255,255,.20)':'rgba(0,0,0,.18)';
        const n=opt.texture==='rock'?5:6;
        for (let i=0;i<n;i++){ tc.beginPath();
          tc.ellipse(24+(rs()-0.5)*22,23+(rs()-0.5)*10,opt.texture==='rock'?2.8:2,opt.texture==='rock'?1.6:1.2,rs()*3,0,7); tc.fill(); }
      }
    };
    const drawElev=(tc,kind)=>{
      const high=kind==='raise', low=kind==='lower';
      tc.fillStyle=low?'#6f7f83':'#8ba263';
      tc.beginPath(); tc.moveTo(24,10+(low?9:0)); tc.lineTo(42,21+(low?9:0)); tc.lineTo(24,32+(low?9:0)); tc.lineTo(6,21+(low?9:0));
      tc.closePath(); tc.fill();
      if (high){
        tc.fillStyle='#5c6f46';
        tc.beginPath(); tc.moveTo(6,21); tc.lineTo(24,32); tc.lineTo(24,40); tc.lineTo(6,29); tc.closePath(); tc.fill();
        tc.fillStyle='#42563e';
        tc.beginPath(); tc.moveTo(42,21); tc.lineTo(24,32); tc.lineTo(24,40); tc.lineTo(42,29); tc.closePath(); tc.fill();
      }
      tc.strokeStyle='rgba(239,230,211,.55)'; tc.lineWidth=1.3; tc.stroke();
      tc.fillStyle='#efe6d3'; tc.font='700 18px IBM Plex Sans'; tc.textAlign='center';
      tc.fillText(kind==='level'?'0':(high?'+':'-'),24,26+(low?8:0));
    };
    const materialBtn=(k,label,sel,draw,fn,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(game.tool===k?' sel':''); b.dataset.k=k;
      if (sel!==undefined) b.className='tool'+(sel?' sel':'');
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=fn;
      tray.appendChild(b);
      return b;
    };
    [
      ['path','Path',tc=>drawMat(tc,{fill:pathCol.fill,texture:'gravel',seed:11}),`${pathCol.label} path: drag or act to lay paths.`],
      ['bed','Bed',tc=>drawMat(tc,{fill:bedCol.fill||'#54402f',texture:bedCol.texture,seed:23}),`${bedCol.label} bed: drag or act to prepare planting beds.`],
      ['water','Water',tc=>drawMat(tc,{fill:waterCol.fill,deep:waterCol.deep,texture:'water',seed:37}),`${waterCol.label}: drag to paint ponds, rivers, or lakes.`],
      ['raise','Raise',tc=>drawElev(tc,'raise'),'Raise ground one step. Drag to build a berm or terrace.'],
      ['lower','Lower',tc=>drawElev(tc,'lower'),'Lower ground one step. Drag to shape a swale or basin.'],
      ['level','Level',tc=>drawElev(tc,'level'),'Return ground to level grade.'],
    ].filter(([k])=>cat.tools.includes(k))
    .forEach(([k,label,draw,hint])=>{
      materialBtn(k,label,game.tool===k,draw,()=>{ setTool(k,null); buildToolTray(); toast(hint); },hint);
    });
    if (game.tool==='path' && cat.tools.includes('path')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Path color'; tray.appendChild(sep);
      PATH_COLORS.forEach((pc,i)=>materialBtn('path',pc.label.split(' ')[0],
        game.tool==='path'&&game.pathColor===pc.id,
        tc=>drawMat(tc,{fill:pc.fill,texture:'gravel',seed:100+i}),
        ()=>{ game.pathColor=pc.id; setTool('path',null); buildToolTray(); toast(`${pc.label} path selected.`); },
        pc.label).dataset.pathColor=pc.id);
    }
    if (game.tool==='bed' && cat.tools.includes('bed')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Bed type'; tray.appendChild(sep);
      BED_STYLES.forEach((bs,i)=>materialBtn('bed',bs.short||bs.label,
        game.tool==='bed'&&game.bedStyle===bs.id,
        tc=>drawMat(tc,{fill:bs.fill||'#54402f',texture:bs.texture,seed:150+i}),
        ()=>{ game.bedStyle=bs.id; setTool('bed',null); buildToolTray(); toast(`${bs.label} bed selected.`); },
        bs.label).dataset.bedStyle=bs.id);
    }
    if (game.tool==='water' && cat.tools.includes('water')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Water'; tray.appendChild(sep);
      WATER_STYLES.forEach((ws,i)=>materialBtn('water',ws.label,
        game.tool==='water'&&game.waterStyle===ws.id,
        tc=>drawMat(tc,{fill:ws.fill,deep:ws.deep,texture:'water',seed:200+i}),
        ()=>{ game.waterStyle=ws.id; setTool('water',null); buildToolTray(); toast(`${ws.label} water selected.`); },
        ws.label).dataset.waterStyle=ws.id);
    }
  }
  if (cat.tools.includes('fence')){
    const fd=fenceDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniFence=(tc,d)=>{
      const st=fenceStyle(d.style), h=d.height>=6?25:18, y=34;
      tc.lineCap='round'; tc.lineJoin='round';
      if (d.style==='black'){
        tc.strokeStyle='rgba(239,230,211,.34)'; tc.lineWidth=5;
        [12,24,36].forEach(x=>{ tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x,y-h); tc.stroke(); });
        [h*.35,h*.72].forEach(off=>{ tc.beginPath(); tc.moveTo(10,y-off); tc.lineTo(38,y-off); tc.stroke(); });
      }
      tc.strokeStyle=st.post; tc.lineWidth=d.style==='brick'?5:3;
      [12,24,36].forEach(x=>{ tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x,y-h); tc.stroke(); });
      tc.strokeStyle=st.rail; tc.lineWidth=d.style==='brick'?7:2;
      [h*.35,h*.72].forEach(off=>{ tc.beginPath(); tc.moveTo(10,y-off); tc.lineTo(38,y-off); tc.stroke(); });
      if (d.style==='chainlink'){
        tc.strokeStyle=st.fill; tc.lineWidth=0.8;
        for (let x=14;x<=34;x+=6){ tc.beginPath(); tc.moveTo(x-4,y-h*.22); tc.lineTo(x+4,y-h*.72); tc.stroke(); }
      }
      if (d.gate){ tc.strokeStyle=st.fill; tc.lineWidth=1.5;
        tc.beginPath(); tc.moveTo(15,y-h*.25); tc.lineTo(33,y-h*.72);
        tc.moveTo(15,y-h*.72); tc.lineTo(33,y-h*.25); tc.stroke();
        const gateCol=d.style==='black'?'#efe6d3':(d.style==='vinyl'?'#6f6458':shade(st.fill,30));
        tc.strokeStyle=gateCol; tc.lineWidth=2;
        tc.beginPath(); tc.moveTo(13,y-h*.1); tc.lineTo(13,y-h*.82);
        tc.moveTo(35,y-h*.1); tc.lineTo(35,y-h*.82);
        tc.moveTo(13,y-h*.82); tc.lineTo(35,y-h*.82);
        tc.moveTo(13,y-h*.48); tc.lineTo(35,y-h*.48);
        tc.moveTo(13,y-h*.1); tc.lineTo(35,y-h*.82);
        tc.stroke();
        tc.strokeStyle='rgba(239,230,211,.55)'; tc.lineWidth=1;
        tc.beginPath(); tc.arc(14,y-h*.14,16,-1.2,-0.08); tc.stroke();
        tc.fillStyle=d.style==='black'?'#c97f3f':'#efe6d3';
        tc.beginPath(); tc.arc(31,y-h*.48,1.8,0,7); tc.fill();
      }
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Structures';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const bx=c.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
      bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
      const sp=document.createElement('span'); sp.textContent='Back';
      b.append(c,sp);
      b.onclick=()=>{ game.drill=null; buildToolTray(); };
      tray.appendChild(b);
    };
    const mainFenceBtn=()=>{
      const b=document.createElement('button');
      b.className='tool has-sub'+(game.tool==='fence'?' sel':'');
      b.dataset.k='fence';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFence(c.getContext('2d'),fd);
      const sp=document.createElement('span'); sp.textContent='Fence';
      b.append(c,sp);
      b.title=`Fence: ${fenceLabel()}. Open to choose gate, height, and material.`;
      b.onclick=()=>{ setTool('fence',null); game.drill='fence'; buildToolTray();
        toast(`${fenceLabel()} selected. Choose height/material or drag to draw connected runs.`); };
      tray.appendChild(b);
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='fence';
      if (draftPatch.gate!==undefined) b.dataset.fenceGate=String(!!draftPatch.gate);
      if (draftPatch.height!==undefined) b.dataset.fenceHeight=String(draftPatch.height);
      if (draftPatch.style!==undefined) b.dataset.fenceStyle=draftPatch.style;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFence(c.getContext('2d'),Object.assign({},fd,draftPatch));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.fenceDraft=normalizeFenceDraft(Object.assign({},fenceDraft(),draftPatch));
        setTool('fence',null); buildToolTray();
        toast(`${fenceLabel()} selected. Drag to draw connected runs.`); };
      tray.appendChild(b); return b;
    };
    if (!game.drill){
      mainFenceBtn();
    } else if (game.drill==='fence'){
      backBtn();
      sep('Place');
      toolBtn('Fence', game.tool==='fence'&&!fd.gate, {gate:false}, 'Draw connected fence tiles');
      toolBtn('Gate', game.tool==='fence'&&!!fd.gate, {gate:true}, 'Draw walkable fence doors / gates');
      sep('Height');
      FENCE_HEIGHTS.forEach(h=>toolBtn(`${h} ft`, fd.height===h, {height:h}, `${h} foot tall fence`));
      sep('Material');
      FENCE_STYLES.forEach(st=>toolBtn(st.label.split(' ')[0], fd.style===st.id, {style:st.id}, st.label));
    }
  }
  if (cat.tools.includes('firepit')){
    const fd=firepitDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniFirepit=(tc,d)=>{
      d=normalizeFirepitDraft(d);
      const sz=firepitTileSize(d), rx=d.shape==='round'?14+sz.w*3:13+sz.w*4, ry=d.shape==='round'?7+sz.h*2.2:8+sz.h*2.4;
      const cx2=24, cy2=27;
      tc.fillStyle='rgba(0,0,0,.24)'; tc.beginPath(); tc.ellipse(cx2,cy2+5,rx,4,0,0,7); tc.fill();
      if (d.shape==='round'){
        tc.fillStyle='#74695d'; tc.beginPath(); tc.ellipse(cx2,cy2,rx,ry,0,0,7); tc.fill();
        tc.fillStyle='#9a8f81'; tc.beginPath(); tc.ellipse(cx2,cy2-2,rx*.82,ry*.68,0,0,7); tc.fill();
        tc.fillStyle='#30261f'; tc.beginPath(); tc.ellipse(cx2,cy2-1,rx*.5,ry*.38,0,0,7); tc.fill();
      } else {
        const diamond=(rxx,ryy,yoff,fill)=>{ tc.fillStyle=fill; tc.beginPath();
          tc.moveTo(cx2,cy2-ryy+yoff); tc.lineTo(cx2+rxx,cy2+yoff);
          tc.lineTo(cx2,cy2+ryy+yoff); tc.lineTo(cx2-rxx,cy2+yoff); tc.closePath(); tc.fill(); };
        diamond(rx,ry,0,'#74695d'); diamond(rx*.82,ry*.68,-2,'#9a8f81'); diamond(rx*.48,ry*.36,-1,'#30261f');
      }
      tc.strokeStyle='#ef7f37'; tc.lineWidth=1.5; tc.lineCap='round';
      tc.beginPath(); tc.moveTo(cx2-4,cy2-2); tc.quadraticCurveTo(cx2-2,cy2-9,cx2,cy2-5);
      tc.moveTo(cx2+3,cy2-1); tc.quadraticCurveTo(cx2+5,cy2-8,cx2+2,cy2-11); tc.stroke();
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Structures';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const bx=c.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
      bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
      const sp=document.createElement('span'); sp.textContent='Back';
      b.append(c,sp);
      b.onclick=()=>{ game.drill=null; buildToolTray(); };
      tray.appendChild(b);
    };
    const choose=(patch)=>{
      const cur=firepitDraft(), next=Object.assign({},cur,patch);
      if (patch.shape && !patch.size && patch.shape!==cur.shape) next.size=firepitSize(null,patch.shape).id;
      game.firepitDraft=normalizeFirepitDraft(next);
      setTool('firepit',null); game.drill='firepit'; buildToolTray();
      toast(`${firepitLabel()} selected. Tap clear dry ground to place.`);
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizeFirepitDraft(Object.assign({},fd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='firepit';
      if (patch.shape!==undefined) b.dataset.firepitShape=patch.shape;
      if (patch.size!==undefined) b.dataset.firepitSize=patch.size;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFirepit(c.getContext('2d'),d);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (!game.drill){
      const b=document.createElement('button');
      b.className='tool has-sub'+(game.tool==='firepit'?' sel':'');
      b.dataset.k='firepit';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFirepit(c.getContext('2d'),fd);
      const sp=document.createElement('span'); sp.textContent='Fire Pit';
      b.append(c,sp);
      b.title=`Fire Pit: ${firepitLabel()}. Open to choose shape and size.`;
      b.onclick=()=>{ setTool('firepit',null); game.drill='firepit'; buildToolTray();
        toast(`${firepitLabel()} selected. Choose shape/size or tap to place.`); };
      tray.appendChild(b);
    } else if (game.drill==='firepit'){
      backBtn();
      sep('Shape');
      toolBtn('Round', fd.shape==='round', {shape:'round'}, 'Round fire pit');
      toolBtn('Square', fd.shape==='square', {shape:'square'}, 'Square or rectangular fire pit');
      sep('Size');
      FIREPIT_SIZES.filter(s=>s.shape===fd.shape).forEach(s=>
        toolBtn(s.label, fd.size===s.id, {size:s.id}, `${s.plan} ${fd.shape} fire pit`));
    }
  }
  if (cat.tools.includes('light')){
    const ld=lightDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniLight=(tc,d,lit)=>{
      const typ=lightType(d.type), tone=lightTone(d.tone), base=35, h=typ.id==='lantern'?31:typ.id==='lamp'?23:16;
      tc.lineCap='round'; tc.lineJoin='round';
      tc.strokeStyle='rgba(0,0,0,.22)'; tc.lineWidth=4;
      tc.beginPath(); tc.moveTo(24,base); tc.lineTo(24,base-h); tc.stroke();
      tc.strokeStyle='#3f4038'; tc.lineWidth=2.4;
      tc.beginPath(); tc.moveTo(24,base); tc.lineTo(24,base-h); tc.stroke();
      if (lit){
        const g=tc.createRadialGradient(24,base-h,0,24,base-h,20);
        g.addColorStop(0,tone.glow+'0.42)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        tc.fillStyle=g; tc.fillRect(4,base-h-20,40,40);
      }
      if (typ.id==='lantern'){
        tc.fillStyle='#3f4038'; tc.fillRect(15,base-h-2,18,13);
        tc.fillStyle=lit?tone.col:'#706a5d'; tc.fillRect(19,base-h+1,10,7);
        tc.strokeStyle='#3f4038'; tc.lineWidth=1.2; tc.strokeRect(15,base-h-2,18,13);
        tc.beginPath(); tc.moveTo(19,base-h-2); tc.lineTo(24,base-h-9); tc.lineTo(29,base-h-2); tc.stroke();
      } else if (typ.id==='lamp'){
        tc.fillStyle='#3f4038'; tc.beginPath(); tc.ellipse(24,base-h,11,5,0,0,7); tc.fill();
        tc.fillStyle=lit?tone.col:'#777066'; tc.beginPath(); tc.ellipse(24,base-h+2,7,3,0,0,7); tc.fill();
      } else {
        tc.fillStyle='#3f4038'; tc.beginPath();
        tc.moveTo(16,base-h); tc.lineTo(32,base-h); tc.lineTo(29,base-h-5); tc.lineTo(19,base-h-5); tc.closePath(); tc.fill();
        tc.fillStyle=lit?tone.col:'#958f7f'; tc.beginPath(); tc.ellipse(24,base-h+1,5,2.2,0,0,7); tc.fill();
      }
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='light';
      if (draftPatch.type!==undefined) b.dataset.lightType=draftPatch.type;
      if (draftPatch.tone!==undefined) b.dataset.lightTone=draftPatch.tone;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniLight(c.getContext('2d'),Object.assign({},ld,draftPatch),game.layerVis.night);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.lightDraft=normalizeLightDraft(Object.assign({},lightDraft(),draftPatch));
        setTool('light',null); buildToolTray();
        toast(`${lightLabel()} selected. Drag to place lighting.`); };
      tray.appendChild(b); return b;
    };
    sep('Fixture');
    LIGHT_TYPES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.type===t2.id, {type:t2.id}, t2.label));
    sep('Light');
    LIGHT_TONES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.tone===t2.id, {tone:t2.id}, t2.label));
  }
  if (cat.tools.includes('house')){
    // the House tab works like the plant tray: icon buttons in labeled
    // sections — Place, House size, Wall color, Roof color
    const hc=game.houseDraft||(game.houseDraft=defaultDraft());
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const toolBtn=(label,sel,draw,fn)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.onclick=fn; tray.appendChild(b); return b;
    };
    const miniHouse=(tc,wf,df,wall,roof)=>{
      const w2=Math.min(40,13+wf*0.55), h2=Math.min(20,7+df*0.3);
      const x0=24-w2/2, y0=36-h2;
      tc.fillStyle=wall; tc.fillRect(x0,y0,w2,h2);
      tc.fillStyle=roof; tc.beginPath();
      tc.moveTo(x0-3,y0); tc.lineTo(24,y0-6-wf*0.14); tc.lineTo(x0+w2+3,y0);
      tc.closePath(); tc.fill();
      tc.fillStyle=HOUSE_TRIM.door; tc.fillRect(22,36-Math.min(9,h2-1),4,Math.min(9,h2-1));
    };
    const pb=toolBtn('Place', game.tool==='house',
      tc=>{ miniHouse(tc,24,18,hc.wall,hc.roof);
        tc.strokeStyle='#efe6d3'; tc.setLineDash([3,3]); tc.lineWidth=1.2;
        tc.strokeRect(3,8,42,32); },
      ()=>{ setTool('house',null); buildToolTray();
        toast('Tap the map to set a house down — hover shows where. Place as many as you like.'); });
    pb.dataset.k='house';
    sep('House size');
    HOUSE_SIZES.forEach(([label,wf,df])=>{
      const sel=hc.w===ftToTiles(wf) && hc.h===ftToTiles(df);
      toolBtn(`${label} ${wf}'×${df}'`, sel,
        tc=>miniHouse(tc,wf,df,hc.wall,hc.roof),
        ()=>{ applyHouseSize(wf,df,label); setTool('house',null); buildToolTray(); });
    });
    sep('Wall color');
    WALL_COLS.forEach(([n,c2])=>{
      toolBtn(n, hc.wall===c2,
        tc=>{ tc.fillStyle=c2; tc.fillRect(13,11,22,22);
          tc.strokeStyle='rgba(0,0,0,.3)'; tc.strokeRect(13,11,22,22); },
        ()=>{ paintHouse('wall',c2,n); setTool('house',null); buildToolTray(); });
    });
    sep('Roof color');
    ROOF_COLS.forEach(([n,c2])=>{
      toolBtn(n, hc.roof===c2,
        tc=>{ tc.fillStyle=c2; tc.beginPath();
          tc.moveTo(8,32); tc.lineTo(24,12); tc.lineTo(40,32);
          tc.closePath(); tc.fill(); },
        ()=>{ paintHouse('roof',c2,n); setTool('house',null); buildToolTray(); });
    });
  }
  updateCanvasCursor();
}
function cap(s){ return s[0].toUpperCase()+s.slice(1); }
function applyTraySearch(){ // hide tray buttons that don't match the query
  const q=(game.traySearch||'').toLowerCase().trim();
  document.querySelectorAll('#toolTray .tool').forEach(b=>{
    const k=b.dataset.k, P=k&&PLANTS[k];
    let hay=k||'';
    if (b.dataset.pathColor) hay+=' '+pathColor(b.dataset.pathColor).label;
    if (b.dataset.bedStyle) hay+=' '+bedStyle(b.dataset.bedStyle).label+' bed gravel rock leaf litter mulch soil';
    if (b.dataset.waterStyle) hay+=' '+waterStyle(b.dataset.waterStyle).label+' pond river lake water';
    if (isElevationTool(k)) hay+=' elevation grade grading raised lowered berm swale terrace level';
    if (k==='fence') hay+=' structures fence gate door '+FENCE_STYLES.map(f=>f.label).join(' ');
    if (k==='firepit') hay+=' structures fire pit round square '+FIREPIT_SIZES.map(f=>f.label+' '+f.plan).join(' ');
    if (k==='light') hay+=' lighting lights path lantern post outdoor lamp '+LIGHT_TYPES.map(l=>l.label).join(' ')+' '+LIGHT_TONES.map(l=>l.label).join(' ');
    if (P){ hay=P.name+' '+P.latin+' '+(P.group||'')+' '+roleSummary(k,12);
      if (P.group) PLANT_KEYS.forEach(k2=>{ if (PLANTS[k2].group===P.group)
        hay+=' '+PLANTS[k2].name+' '+PLANTS[k2].latin+' '+roleSummary(k2,12); }); }
    b.style.display=(!q||hay.toLowerCase().includes(q))?'':'none';
  });
}
function refreshTray(){
  const cur=PLANTS[game.tool];
  document.querySelectorAll('.tool').forEach(el=>{
    const sel=el.dataset.pathColor
      ? game.tool==='path' && game.pathColor===el.dataset.pathColor
      : el.dataset.bedStyle
      ? game.tool==='bed' && game.bedStyle===el.dataset.bedStyle
      : el.dataset.waterStyle
      ? game.tool==='water' && game.waterStyle===el.dataset.waterStyle
      : el.dataset.fenceStyle
      ? game.tool==='fence' && fenceDraft().style===el.dataset.fenceStyle
      : el.dataset.fenceHeight
      ? game.tool==='fence' && String(fenceDraft().height)===el.dataset.fenceHeight
      : el.dataset.fenceGate
      ? game.tool==='fence' && String(!!fenceDraft().gate)===el.dataset.fenceGate
      : el.dataset.firepitShape
      ? game.tool==='firepit' && firepitDraft().shape===el.dataset.firepitShape
      : el.dataset.firepitSize
      ? game.tool==='firepit' && firepitDraft().size===el.dataset.firepitSize
      : el.dataset.lightType
      ? game.tool==='light' && lightDraft().type===el.dataset.lightType
      : el.dataset.lightTone
      ? game.tool==='light' && lightDraft().tone===el.dataset.lightTone
      : el.dataset.group
      ? !!(cur && cur.group===el.dataset.group)
      : el.dataset.k===game.tool;
    el.classList.toggle('sel', sel);
  });
  updateCanvasCursor();
}
/* variant chips: species inside a group, and/or cultivars of the
   selected species. A chip is a (species, cultivar|null) pair. */
function renderCvRow(){
  // Sub-species now drill into the catalog row (see renderDrillIn), so this
  // legacy chip row stays hidden. The two calls below are the live hooks that
  // ride along on every tool change: the brush bar and the collapsible sheet.
  renderBrushBar();
  applySheetState();
  const row=document.getElementById('cvRow');
  if (row){ row.innerHTML=''; row.classList.add('hidden'); }
}
/* drill-in catalog: a grouped species (or one with cultivars) expands here into
   its members + cultivars, fronted by a Back chip — so sub-species never need a
   separate always-on row. Each button arms (species, cultivar) and stays in the
   drill so you can compare; Back returns to the species grid. */
function renderDrillIn(tray, drillKey, members){
  const back=document.createElement('button');
  back.className='tool tool-back'; back.title='Back to the catalog';
  const bc=document.createElement('canvas'); bc.width=48; bc.height=44;
  const bx=bc.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
  bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
  const bs=document.createElement('span'); bs.textContent='Back'; back.append(bc,bs);
  back.onclick=()=>{ game.drill=null; buildToolTray(); };
  tray.appendChild(back);
  const mk=(k,v,label)=>{
    const R=plantDef(k,v);
    const b=document.createElement('button');
    b.className='tool'+((game.tool===k && (game.toolVar||null)===(v||null))?' sel':'');
    b.dataset.k=k; if (v) b.dataset.v=v;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const sc=Math.min(0.62, 36/(R.h||40));
    const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
    const iconSeason=R.type==='bulb' ? (SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring') : 'Summer';
    drawPlant(ctx2,24/sc,42/sc,k,1,iconSeason,tileSeed(3,7),0,v||undefined,1);
    const sp=document.createElement('span'); sp.textContent=label; b.append(c,sp);
    b.onclick=()=>{ setTool(k,v||null); buildToolTray();
      const D=plantDef(k,v); toast(`${D.name} — ${D.latin}`); };
    tray.appendChild(b);
  };
  members.forEach(k=>{
    const M=PLANTS[k];
    mk(k, null, M.group ? (M.chip||M.name.split(' ').slice(0,2).join(' '))
                        : M.name.split(' ').slice(0,2).join(' '));
    for (const v in (M.cv||{})) mk(k, v, M.cv[v].name);
  });
}
/* the Plant tool's brush styles, docked in the palette instead of a floating
   flyout: two segmented toggles — pattern (Draw/Drift) and placement
   (Grid/Free). Visible only when a plant species is the armed brush. */
function renderBrushBar(){
  const bar=document.getElementById('brushBar'); if (!bar) return;
  bar.innerHTML='';
  if (!PLANTS[game.tool] || game.tool==='shovel' || game.tool==='select'){
    bar.classList.add('hidden'); return;
  }
  bar.classList.remove('hidden');
  const seg=(opts)=>{
    const s=document.createElement('div'); s.className='seg';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='seg-opt'+(o.on?' on':''); b.title=o.title||o.label;
      const c=document.createElement('canvas'); c.width=28; c.height=24;
      o.draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=o.label;
      b.append(c,sp); b.onclick=o.click; s.appendChild(b);
    });
    return s;
  };
  const lab=document.createElement('span'); lab.className='brush-lab'; lab.textContent='Brush';
  const woody = PLANTS[game.tool].type==='shrub' || PLANTS[game.tool].type==='tree';
  const parts=[lab];
  // Draw vs Drift is a no-op for woody plants (they always plant singly), so
  // only herbaceous plants get that toggle; everyone gets Grid/Free placement.
  if (!woody) parts.push(seg([
    {label:'Draw', on:!game.drift, title:'Paint one plant at a time',
      draw:tc=>drawPlantModeIcon(tc,false), click:()=>choosePlantMode(false)},
    {label:'Drift',on:game.drift,  title:'Paint natural clusters',
      draw:tc=>drawPlantModeIcon(tc,true),  click:()=>choosePlantMode(true)},
  ]));
  parts.push(seg([
    {label:'Grid', on:!game.freePlanting, title:'Snap to tile centers',
      draw:tc=>drawPlacementIcon(tc,false), click:()=>choosePlacementMode(false)},
    {label:'Free', on:game.freePlanting,   title:'Land where you tap, not just centers',
      draw:tc=>drawPlacementIcon(tc,true),  click:()=>choosePlacementMode(true)},
  ]));
  bar.append(...parts);
}
/* the collapsible palette (phones only): the handle folds the catalog away so
   the garden gets the room while you paint; the brush bar + act button stay.
   sheetContextLabel names whatever brush is armed, for the collapsed strip. */
function sheetContextLabel(){
  const P=PLANTS[game.tool];
  if (P) return plantDef(game.tool,game.toolVar).name+(game.drift?' · drift':'');
  if (game.tool==='path')  return pathColor(game.pathColor).label+' path';
  if (game.tool==='water') return waterStyle(game.waterStyle).label+' water';
  if (game.tool==='bed')   return bedStyle(game.bedStyle).label+' bed';
  if (isElevationTool(game.tool)) return game.tool[0].toUpperCase()+game.tool.slice(1)+' grade';
  if (game.tool==='fence') return fenceLabel();
  if (game.tool==='light') return 'Lighting';
  if (game.tool==='firepit') return firepitLabel();
  if (game.tool==='house') return 'House';
  if (game.tool==='shovel') return 'Erase';
  if (game.tool==='select') return 'Select';
  if (game.tool==='pick') return 'Eyedropper';
  return 'Tap to choose a plant';
}
function applySheetState(){
  const hb=document.querySelector('.hud-bottom'); if (!hb) return;
  hb.classList.toggle('collapsed', !!game.sheetCollapsed);
  const ctx=document.getElementById('sheetCtx'); if (ctx) ctx.textContent=sheetContextLabel();
  const chev=document.querySelector('#sheetHandle .chev'); if (chev) chev.textContent=game.sheetCollapsed?'▴':'▾';
  drawSheetSwatch();
}
/* a mini render of the armed plant in the collapse handle, so you always see
   what you're about to paint. Materials/tools show no swatch (the label says it). */
function drawSheetSwatch(){
  const c=document.getElementById('sheetSwatch'); if (!c) return;
  const P=PLANTS[game.tool];
  if (!P){ c.style.display='none'; return; }
  c.style.display='';
  const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height);
  const R=plantDef(game.tool,game.toolVar);
  const sc=Math.min(0.5, 18/(R.h||40));
  g.save(); g.scale(sc,sc);
  const iconSeason=R.type==='bulb'?(SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring'):'Summer';
  drawPlant(g,(c.width/2)/sc,(c.height-2)/sc,game.tool,1,iconSeason,tileSeed(3,7),0,game.toolVar||undefined,1);
  g.restore();
}
let lastHint='', lastAct='';
function setHint(txt){
  const el=document.getElementById('actionHint');
  if (!ENABLE_ACTION_HINT){
    el.classList.add('hidden');
    if (lastHint!==''){ lastHint=''; el.textContent=''; }
    return;
  }
  el.classList.remove('hidden');
  if (txt!==lastHint){ lastHint=txt; el.textContent=txt; }
}
function setActButton(){ // the big mobile do-it button, labeled by context
  if (!ENABLE_MOBILE_ACT_BUTTON){
    document.getElementById('btnAct').classList.add('hidden');
    document.getElementById('actionHint').classList.toggle('hidden',!ENABLE_ACTION_HINT);
    lastAct='';
    return;
  }
  const px3=Math.round(game.px), py3=Math.round(game.py);
  let label=null;
  if (ENABLE_HOUSE_SLEEP && isDoor(px3,py3)) label='Sleep';
  else if (game.tool==='hand') label=null;
  else if (game.tool==='shovel') label=game.eraseSize>1?`Erase ${game.eraseSize}×${game.eraseSize}`:'Erase here';
  else if (game.tool==='path') label='Lay path';
  else if (game.tool==='bed') label='Dig bed';
  else if (game.tool==='water') label='Add water';
  else if (game.tool==='raise') label='Raise grade';
  else if (game.tool==='lower') label='Lower grade';
  else if (game.tool==='level') label='Level grade';
  else if (game.tool==='fence') label=fenceDraft().gate?'Place gate':'Place fence';
  else if (game.tool==='light') label='Place light';
  else if (game.tool==='firepit') label='Place fire pit';
  else if (game.tool==='house') label=null;           // house places by tap
  else if (PLANTS[game.tool]) label=game.drift?'Plant a drift':'Plant here';
  const state=(baseZoom<1 && label) ? label : '';
  if (state!==lastAct){ lastAct=state;
    const b=document.getElementById('btnAct');
    b.classList.toggle('hidden',!state);
    if (state) b.textContent=state;
    // the big button replaces the instructional hint on phones
    document.getElementById('actionHint').classList.toggle('hidden',!!state||!ENABLE_ACTION_HINT);
  }
}
/* the time readout string. Design is a planner — real days are meaningless, so
   it shows season + how far through it; Story keeps the life-sim calendar. */
// the season box fill colour — Kevin's palette: easter green, dark green,
// the existing fall bronze, a darker winter blue
const SEASON_FILL = { Spring:'#7fc24e', Summer:'#2f7d3a', Fall:'#c97f3f', Winter:'#3f6190' };
// game-ms added per real-ms while holding the season box (~2 garden days/sec)
const FF_RATE = 40;
function clockMeta(){
  const cal=calClock();
  if (game.gameMode==='design'){
    const sf=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
    return `${cal.season} · ${sf<0.34?'early':sf<0.67?'mid':'late'} season`;
  }
  return `${cal.season} · Year ${cal.year} · Day ${cal.day}`;
}
/* the top-bar day/night toggle: promoted out of the Layers overlay menu, it
   flips game.layerVis.night (which relights the world and switches lighting on).
   Shows the current state — sun by day, moon by night. */
function updateDayNightBtn(){
  const b=document.getElementById('btnDayNight'); if (!b) return;
  const night=!!game.layerVis.night;
  b.textContent=night?'☾':'☀';
  b.classList.toggle('on',night);
  b.title=night?'Switch to day':'Switch to night (preview lighting)';
}
function updateHUD(){
  const cal=calClock();
  document.getElementById('seasonName').textContent=cal.season;
  document.getElementById('seasonYear').textContent=`Year ${cal.year}`;
  document.getElementById('seasonDay').textContent=`Day ${cal.day}`;
  // Design is a planner: real days are meaningless (a day is 20s), so show the
  // season + how far through it instead of a Year/Day count. Story keeps the
  // life-sim calendar. The internal clock is unchanged either way.
  const design=game.gameMode==='design';
  const seasonFrac=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
  const phase=seasonFrac<0.34?'Early season':seasonFrac<0.67?'Mid-season':'Late season';
  document.getElementById('seasonPhase').textContent=phase;
  document.getElementById('seasonClkCal').style.display=design?'none':'';
  document.getElementById('seasonPhase').style.display=design?'':'none';
  // the season box fills across the whole season, tinted by the season colour
  const fill=document.getElementById('seasonFill');
  if (fill){
    const w=Math.round(seasonFrac*1000)/10;
    if (w!==game._fillW){ fill.style.width=w+'%'; game._fillW=w; }
    const fillBg=game.pausedAt ? '#8c867c' : (SEASON_FILL[cal.season]||'#7fc24e');
    if (fillBg!==game._fillBg){ fill.style.background=fillBg; game._fillBg=fillBg; }
  }
  updateDayNightBtn();
  setHint(game.tool==='house'
    ? 'Hover shows where the house lands — click to set it down'
    : game.tool==='hand'
    ? 'Hand: drag the map to pan'
    : game.tool==='shovel'
    ? `Erase (${game.eraseMode==='all'?'everything':game.eraseMode+' only'}, ${game.eraseSize}×${game.eraseSize}) — tap or drag`
    : game.tool==='water'
    ? 'Drag to paint ponds, rivers, and lakes'
    : game.tool==='fence'
    ? `Drag to draw ${fenceLabel().toLowerCase()} runs`
    : game.tool==='light'
    ? `Drag to place ${lightLabel().toLowerCase()}`
    : game.tool==='firepit'
    ? `Tap clear ground to place a ${firepitLabel().toLowerCase()}`
    : ENABLE_HOUSE_SLEEP && isDoor(Math.round(game.px),Math.round(game.py))
    ? 'At the door — press E or tap here to sleep'
    : 'Tap a tile to walk · drag selected plants or tools to place them — or WASD + E');
  setActButton();
  const sd=absDay();
  if (sd!==game.lastDay){
    if (game.lastDay>=0 && sd%DAYS_PER_SEASON===0)
      toast(cal.season==='Spring'
        ? 'Spring. Last year is cut back — everything starts small and grows again.'
        : `${cal.season} begins. Watch the garden change.`);
    game.lastDay=sd;
    if (game.mode==='solo'&&hasStorage){ saveSolo(true); game.dirty=false; }
  }
}

/* ---------- screens ---------- */
const $=id=>document.getElementById(id);
function show(id){ ['menuScreen','multiScreen','creatorScreen','codeScreen','plotScreen','worldsScreen','designScreen','libraryScreen'].forEach(s=>
  $(s).classList.toggle('hidden',s!==id));
  if (id==='menuScreen'){ advanceMenuSeason(); refreshMenuCards(); }
}
function closeOverlay(id){ $(id).classList.add('hidden'); }
function suspendClock(){
  if (!game.mode || game.pausedAt || game.clockSuspended) return;
  game.elapsedMs=elapsedGameMs();
  game.clockSuspended=true;
  game.startTs=Date.now();
}
function resumeClockSession(){
  if (!game.mode || !game.clockSuspended) return;
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function pauseClock(){
  if (!game.mode || game.pausedAt) return;
  game.elapsedMs=elapsedGameMs();
  game.pausedAt=Date.now();
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function resumeClock(){
  if (!game.pausedAt) return;
  game.pausedAt=0;
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function nextSeasonName(){
  const cal=calClock();
  return SEASONS[(SEASONS.indexOf(cal.season)+1)%SEASONS.length];
}
function openPause(){
  const ps=$('pauseScreen');
  $('pauseMeta').textContent=clockMeta();
  $('btnPauseResume').textContent=game.pausedAt?'Resume':'Pause day';
  ps.classList.remove('hidden');
  // drop the panel down under the season box, left-aligned to it
  const box=$('btnSeasonBox'), p=ps.querySelector('.panel');
  if (box && p){ const r=box.getBoundingClientRect();
    p.style.top=(r.bottom+6)+'px';
    p.style.left=Math.max(8,Math.round(r.left))+'px'; }
}
function closePause(){
  $('confirmSeasonScreen').classList.add('hidden');
  $('pauseScreen').classList.add('hidden');
}
function resumeFromTimeMenu(){ resumeClock(); closePause(); updateHUD(); }
function toggleClock(){
  if (game.pausedAt){ resumeClock(); toast('Day started.'); }
  else { pauseClock(); toast('Day paused.'); }
  updateHUD();
}
function closeSeasonConfirm(){ $('confirmSeasonScreen').classList.add('hidden'); }
function skipToAbsDay(targetDay){
  const d=absDay();
  if (targetDay<=d) return;
  game.dayOffset += targetDay-d;
  game.dirty=true;
  if (game.mode==='solo'&&hasStorage) saveSolo(true);
}
function openSeasonConfirm(){
  $('confirmSeasonTitle').textContent=`Skip to ${nextSeasonName()}?`;
  $('confirmSeasonScreen').classList.remove('hidden');
}
function confirmSkipSeason(){
  const d=absDay();
  skipToAbsDay((Math.floor(d/DAYS_PER_SEASON)+1)*DAYS_PER_SEASON);
  closeSeasonConfirm();
  const cal=calClock();
  $('pauseMeta').textContent=clockMeta();
  toast(`${cal.season} begins.`);
}
function skipNextYear(){
  const d=absDay(), yearLen=DAYS_PER_SEASON*SEASONS.length;
  skipToAbsDay((Math.floor(d/yearLen)+1)*yearLen);
  const cal=calClock();
  $('pauseMeta').textContent=clockMeta();
  toast(`Year ${cal.year} begins.`);
}

/* ---------- plant library: browse every species ---------- */
const LIB_CATS=[
  {label:'Grasses & Sedges', types:['grass','sedge']},
  {label:'Perennials',       types:['forb']},
  {label:'Bulbs',            types:['bulb']},
  {label:'Water Plants',     types:['water']},
  {label:'Shrubs',           types:['shrub']},
  {label:'Trees',            types:['tree']},
];
function libSeed(key){ let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0; return h||7; }
function libCanvas(key,variant,season,w,h){
  const c=document.createElement('canvas'); c.width=w*2; c.height=h*2;
  c.style.width=w+'px'; c.style.height=h+'px';
  const ctx=c.getContext('2d'); ctx.scale(2,2);
  const P=plantDef(key,variant), drawH=(P.h||40)*1.3+12, sc=Math.min(1.15,h/drawH);
  ctx.save(); ctx.translate(w/2,h-5); ctx.scale(sc,sc);
  drawPlant(ctx,0,0,key,1,season,libSeed(key),0,variant,1);
  ctx.restore();
  return c;
}
/* a real photo for the species, if one has been added to photos/.
   Tries .jpg → .jpeg → .png, then quietly removes itself (renders
   below remain the fallback). Drop a file at photos/<key>.jpg. */
function plantPhoto(key){
  const wrap=document.createElement('div'); wrap.className='ld-photo';
  const img=document.createElement('img'); img.alt='';
  const exts=['jpg','jpeg','png']; let i=0;
  img.onerror=()=>{ i++; if (i<exts.length) img.src=`photos/${key}.${exts[i]}`; else wrap.remove(); };
  img.onload=()=>{ wrap.classList.add('has'); };
  img.src=`photos/${key}.${exts[0]}`;
  wrap.appendChild(img);
  return wrap;
}
let libSel=null;
function openLibrary(){ buildLibraryList(''); show('libraryScreen');
  if (!libSel) showLibraryDetail(PLANT_KEYS[0]);
  applyLibrarySearch(); }
function buildLibraryList(q){
  const list=$('libraryList'); list.innerHTML='';
  LIB_CATS.forEach(cat=>{
    const keys=PLANT_KEYS.filter(k=>cat.types.includes(PLANTS[k].type));
    if (!keys.length) return;
    const head=document.createElement('div'); head.className='lib-cat'; head.textContent=cat.label;
    head.dataset.cat='1'; list.appendChild(head);
    keys.forEach(k=>{
      const P=PLANTS[k];
      const b=document.createElement('button'); b.className='lib-item'+(libSel===k?' sel':''); b.dataset.k=k;
      const cvHay=(P.libraryCultivars||[]).map(c=>(c.name||'')+' '+(c.size||'')+' '+(c.note||'')).join(' ');
      b.dataset.hay=(P.name+' '+P.latin+' '+roleSummary(k,12)+' '+cvHay).toLowerCase();
      b.append(libCanvas(k,null,'Summer',30,36));
      const t=document.createElement('span');
      t.innerHTML=`${P.name}<span class="li-latin">${P.latin}</span>`;
      b.append(t);
      b.onclick=()=>showLibraryDetail(k);
      list.appendChild(b);
    });
  });
}
function showLibraryDetail(key){
  libSel=key;
  document.querySelectorAll('.lib-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===key));
  const P=PLANTS[key], d=$('libraryDetail');
  const dim=v=>v>=96?`${Math.round(v/12)} ft`:`${v}"`;
  const seasons=['Spring','Summer','Fall','Winter'];
  const imgs=document.createElement('div'); imgs.className='ld-img';
  seasons.forEach(s=>{ const fig=document.createElement('figure');
    fig.append(libCanvas(key,null,s,80,104));
    const cap=document.createElement('figcaption'); cap.textContent=s; fig.append(cap);
    imgs.append(fig); });
  const facts=[
    ['Type', P.type[0].toUpperCase()+P.type.slice(1)],
    ['Mature size', `${dim(P.spread)} wide`+(P.grow?` · ~${P.grow} yrs`:'')],
    ['Spacing', `${dim(P.space)} on center`],
    ['Hardiness', `USDA zones ${P.zones[0]}–${P.zones[1]}`],
    ['Light', P.sun==='full'?'Full sun':'Part shade'],
    ['Soil', P.moist[0].toUpperCase()+P.moist.slice(1)+' moisture'],
    ['Origin', P.native?('Native — '+(P.eco.join(', ')||'central US')):'Garden plant (non-native)'],
    ['Roles', roleSummary(key)],
  ];
  const cvKeys=Object.keys(P.cv||{}), libraryCultivars=P.libraryCultivars||[];
  d.innerHTML='';
  const card=document.createElement('div'); card.className='ld-card';
  card.append(plantPhoto(key));   // real photo if photos/<key>.jpg exists, else nothing
  card.append(imgs);
  const nm=document.createElement('div'); nm.className='ld-name'; nm.textContent=P.name; card.append(nm);
  const la=document.createElement('div'); la.className='ld-latin'; la.textContent=P.latin; card.append(la);
  const bl=document.createElement('p'); bl.className='ld-blurb'; bl.textContent=P.blurb; card.append(bl);
  const dl=document.createElement('dl'); dl.className='ld-facts';
  facts.forEach(([k,v])=>{ const dt=document.createElement('dt'); dt.textContent=k;
    const dd=document.createElement('dd'); dd.textContent=v; dl.append(dt,dd); });
  card.append(dl);
  if (cvKeys.length || libraryCultivars.length){
    const cvs=document.createElement('div'); cvs.className='ld-cvs';
    const n=cvKeys.length+libraryCultivars.length;
    const h4=document.createElement('h4'); h4.textContent=`${n} cultivar${n>1?'s':''}`;
    cvs.append(h4);
    cvKeys.forEach(v=>{ const row=document.createElement('div'); row.className='ld-cv';
      row.innerHTML=`<b>${P.cv[v].name}</b> — ${P.cv[v].note||''}`; cvs.append(row); });
    libraryCultivars.forEach(c=>{ const row=document.createElement('div'); row.className='ld-cv';
      const size=c.size ? ` <span>${c.size}</span>` : '';
      row.innerHTML=`<b>${c.name}</b>${size} - ${c.note||''}`; cvs.append(row); });
    card.append(cvs);
  }
  d.append(card); d.scrollTop=0;
}
function applyLibrarySearch(){
  const q=($('librarySearch').value||'').toLowerCase().trim();
  document.querySelectorAll('.lib-item').forEach(b=>{
    b.style.display=(!q||b.dataset.hay.includes(q))?'':'none'; });
  document.querySelectorAll('.lib-cat').forEach(h=>{
    let n=h.nextElementSibling, any=false;
    while(n && !n.dataset.cat){ if(n.style.display!=='none') any=true; n=n.nextElementSibling; }
    h.style.display=any?'':'none'; });
}

let pendingMode=null;
const MULTIPLAYER_ENABLED=false;

async function refreshMenuCards(){
  const g=$('btnGardens'); if (!g) return;
  const idx=hasStorage ? await migrateLegacyWorld() : [];
  g.querySelector('small').textContent=idx.length
    ? `${idx.length} saved garden${idx.length>1?'s':''}`
    : 'Open and manage your saved gardens';
}

$('btnDesign').onclick=()=>{ pendingMode='design'; openWorlds('design'); };
$('btnStory').onclick=()=>{ pendingMode='story'; openWorlds('story'); };
$('btnLibrary').onclick=openLibrary;
$('btnLibraryClose').onclick=()=>show('menuScreen');
$('librarySearch').oninput=applyLibrarySearch;
$('btnGardens').onclick=()=>{ pendingMode=null; openWorlds('all'); };

/* the worlds screen — filtered by game mode. Legacy saves with no
   `mode` are Story gardens (they had an avatar). */
let worldsFilter='all';
function worldMode(w){ return w.mode==='design'?'design':'story'; }
function startNewGarden(mode){
  if (mode==='design'){ pendingMode='design'; openDesignSetup(); }
  else { pendingMode='story'; openCreator(); }
}
async function openWorlds(filter){
  worldsFilter=filter||'all';
  const all=await migrateLegacyWorld();
  const idx=worldsFilter==='all' ? all : all.filter(w=>worldMode(w)===worldsFilter);
  if (!idx.length && worldsFilter!=='all'){ startNewGarden(worldsFilter); return; } // none yet → create
  const titles={design:'Design gardens', story:'Story gardens', all:'My gardens'};
  const subs={
    design:'Continue a planting plan, or start a new one.',
    story:'Continue tending, or start a new garden.',
    all:'Every garden saved on this device.'};
  $('worldsTitle').textContent=titles[worldsFilter];
  $('worldsSub').textContent=subs[worldsFilter];
  $('btnNewWorld').textContent = worldsFilter==='story' ? 'Start a new garden' : 'Design a new garden';
  const list=$('worldList'); list.innerHTML='';
  if (!idx.length){ const e=document.createElement('p'); e.className='note';
    e.textContent='No gardens yet — start one below.'; list.appendChild(e); }
  idx.sort((a,b)=>b.ts-a.ts).forEach(w=>{
    const row=document.createElement('button'); row.className='world-row';
    const info=document.createElement('span'); info.style.flex='1';
    const nm=document.createElement('span'); nm.className='wname'; nm.textContent=w.name||'My garden';
    const badge=worldMode(w)==='design'?' · Design':' · Story';
    const meta=document.createElement('span'); meta.className='meta';
    meta.textContent=`${Math.round((w.gw||31)*1.5)} × ${Math.round((w.gh||31)*1.5)} ft${badge} · ${new Date(w.ts).toLocaleDateString()}`;
    info.append(nm,document.createElement('br'),meta);
    const del=document.createElement('button'); del.className='world-del'; del.textContent='✕';
    del.title='Delete this garden';
    del.onclick=e=>{ e.stopPropagation();
      if (del.dataset.arm){ deleteWorld(w.id); }
      else { del.dataset.arm='1'; del.textContent='Sure?'; } };
    row.append(info,del);
    row.onclick=()=>enterWorld(w.id);
    list.appendChild(row);
  });
  show('worldsScreen');
}
async function enterWorld(id){
  game.worldId=id; game.mode='solo';
  if (!(await loadSolo(id))){ toast('That garden failed to load.'); game.mode=null; return; }
  enterGarden();
}
async function deleteWorld(id){
  const idx=(await worldsIndex()).filter(w=>w.id!==id);
  await sSet('hortus:worlds',idx);
  try{ localStorage.removeItem('hortus:world:'+id); }catch(e){}
  openWorlds(worldsFilter);
}
$('btnNewWorld').onclick=()=>startNewGarden(worldsFilter==='story'?'story':'design');
$('btnHost').onclick=async()=>{ pendingMode='multi-host'; await hostWorld();
  $('codeDisplay').textContent=game.code; show('codeScreen'); };
$('btnCodeContinue').onclick=()=>openCreator();
$('btnJoin').onclick=async()=>{
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ toast('Enter the 5-character garden code.'); return; }
  if (await joinWorld(code)){ pendingMode='multi-join'; openCreator(); }
};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ show('menuScreen'); });

/* creator */
function openCreator(){
  // coat swatches
  const row=$('coatRow'); row.innerHTML='';
  COATS.forEach((c,i)=>{ const b=document.createElement('button');
    b.className='swatch'+(i===game.char.coatIdx?' sel':''); b.style.background=c.c; b.title=c.n;
    b.onclick=()=>{ game.char.coatIdx=i; game.char.coat=c.c; game.char.coatD=c.d;
      document.querySelectorAll('.swatch').forEach((s,j)=>s.classList.toggle('sel',j===i)); };
    row.appendChild(b); });
  $('petName').value=game.char.name||'';
  show('creatorScreen');
}
$('speciesRow').onclick=e=>{ const b=e.target.closest('[data-species]'); if(!b)return;
  game.char.species=b.dataset.species;
  $('speciesRow').querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };
$('markRow').onclick=e=>{ const b=e.target.closest('[data-mark]'); if(!b)return;
  game.char.mark=b.dataset.mark;
  $('markRow').querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };

/* live preview */
const pcv=$('previewCanvas'), pcx=pcv.getContext('2d');
function previewLoop(t){
  if (!$('creatorScreen').classList.contains('hidden')){
    pcx.clearRect(0,0,340,380);
    pcx.save(); pcx.scale(2,2);
    drawPlant(pcx,40,168,'karl',1,'Fall',7,Math.sin(t*0.001),undefined,1);
    drawPlant(pcx,132,172,'echinacea',1,'Summer',13,Math.sin(t*0.001),undefined,1);
    drawCritter(pcx,86,168,game.char,t,false,2.1);
    pcx.restore();
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

$('btnStartGame').onclick=async()=>{
  game.char.name=$('petName').value.trim()||'Bramble';
  await saveChar();
  if (pendingMode==='story'){ game.mode='solo'; game.gameMode='story'; game.worldId=null;
    openPlotScreen(); return;  // always a new garden: lay out the plot first
  } else {
    game.mode='multi';
    $('playersPill').classList.remove('hidden');
    syncTimer=setInterval(pollWorld,4000); pollWorld(); pushPresence();
  }
  enterGarden();
};
function starterDrift(){ // a welcoming drift near spawn so the world isn't empty
  const SX=SPAWNX, SY=SPAWNY;
  const picks=[['karl',SX-3,SY-3],['karl',SX-2,SY-3],['bluestem',SX-3,SY-2],
               ['echinacea',SX+3,SY+3],['echinacea',SX+4,SY+3],['dropseed',SX+3,SY+4]];
  // backdated 26 days = 10 growing days last fall + the winter between,
  // so the drift arrives established and wakes with the player's first spring
  picks.forEach(([s,x,y])=>{ if(tileTerrain(x,y)!=='path'&&!inHouse(x,y))
    game.plants[`${x},${y}`]={s,d:absDay()-26,t:Date.now()}; });
}
function enterGarden(){
  show(''); $('hud').classList.remove('hidden');
  cnv.classList.remove('hidden'); mcnv.classList.add('hidden');
  setActiveCanvas(cnv);
  setViewportFill('#4b5044');
  game.tool='hand'; game.toolVar=null; game.pausedAt=0; game.clockSuspended=false; game.startTs=Date.now();
  document.body.classList.toggle('design-mode', game.gameMode==='design');
  if (!Array.isArray(game.houses)) game.houses=[];
  if (!game.elevation) game.elevation={};
  if (!game.fences) game.fences={};
  if (!game.lights) game.lights={};
  if (!game.firepits) game.firepits={};
  if (!game.houseDraft) game.houseDraft=draftFromHouses();
  game.fenceDraft=normalizeFenceDraft(game.fenceDraft);
  game.lightDraft=normalizeLightDraft(game.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(game.firepitDraft);
  game.bedStyle=bedStyleId(game.bedStyle);
  if (game.gameMode==='design'){
    // free camera centered on the plot; no avatar, no forced house
    game.px=game.tx=SPAWNX; game.py=game.ty=SPAWNY; game.moving=false;
    snapCam();
  } else {
    if (!game.houses.length) game.houses=[defaultHouse()];
    const [spx,spy]=safeSpawn();   // never start stuck inside the house
    game.px=game.tx=spx; game.py=game.ty=spy;
    snapCam();
  }
  game.lastDay=absDay();
  undoStack=[]; redoStack=[]; updateUndoBtn();
  buildToolTray();
  buildCanvasTools();
  $('worldLabel').textContent = game.mode==='multi'
    ? `Garden ${game.code}` : (game.worldName||'Solo garden');
}
/* the plot screen: size a brand-new solo garden in real feet */
const PLOT_PRESETS=[['Classic',46,46],['1/10 acre',66,66],['1/5 acre',93,93],['1/4 acre',104,104]];
const FT_MIN=24, FT_MAX=200; // 16..134 tiles per side
function plotFt(id){ return Math.max(FT_MIN,Math.min(FT_MAX,+$(id).value||46)); }
function updatePlotNote(){
  const w=plotFt('plotW'), l=plotFt('plotL');
  $('plotNote').textContent=
    `${ftToTiles(w)} × ${ftToTiles(l)} tiles · ${(w*l).toLocaleString()} sq ft · ${(w*l/43560).toFixed(2)} acres`;
}
function openPlotScreen(){
  const row=$('plotPresets');
  if (!row.children.length){
    PLOT_PRESETS.forEach(([n,w,l],i)=>{
      const b=document.createElement('button');
      b.className='chip'+(i===0?' sel':''); b.textContent=n;
      b.onclick=()=>{ $('plotW').value=w; $('plotL').value=l; updatePlotNote();
        row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };
      row.appendChild(b);
    });
    $('plotW').oninput=$('plotL').oninput=()=>{ updatePlotNote();
      row.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel')); };
    $('btnPlotStart').onclick=()=>{
      setWorldSize(ftToTiles(plotFt('plotW')), ftToTiles(plotFt('plotL')));
      game.worldId='w'+Date.now().toString(36);
      game.worldName=$('plotName').value.trim()||'My garden';
      game.rot=0; game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
      game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.freePlanting=false;
      game.seeds={}; game.flats=[]; game.stock={}; game.propSeeded=false;
      game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'};
      if (pendingMode==='design'){            // serious design: blank plot, no avatar, no house
        game.mode='solo'; game.gameMode='design'; game.houses=[]; game.houseDraft=defaultDraft();
      } else {                                // story: avatar garden with a house + welcome drift
        game.gameMode='story'; game.houses=[defaultHouse()]; game.houseDraft=draftFromHouses();
        seedWalkway(); starterDrift(); giveStarterSeeds(); game.propSeeded=true;
      }
      enterGarden();
      saveSolo(true); // claim the slot right away
    };
    $('btnPlotBack').onclick=()=>{ if (pendingMode==='design'){ openDesignSetup(); } else { game.mode=null; show('menuScreen'); } };
  }
  $('plotW').value=46; $('plotL').value=46; $('plotName').value=''; updatePlotNote();
  show('plotScreen');
}

/* design setup: a questionnaire that tunes the palette before sizing */
const GARDEN_TYPES=[
  ['any','Any garden','Use every plant that matches your zone and native-plant filters.'],
  ['cottage','Cottage','Romantic and abundant — layered perennials and self-seeders.'],
  ['prairie','Prairie / Meadow','Native grasses and forbs in naturalistic drifts.'],
  ['butterfly','Pollinator','Nectar and host plants for butterflies and bees.'],
  ['shade','Shade / Woodland','Understory calm — hostas, ferns, sedges, woodland bulbs.'],
  ['japanese','Japanese','Restraint and structure — evergreens, moss, stone.'],
  ['mediterranean','Mediterranean','Silver foliage and herbs that love dry heat.'],
  ['modern','Modern','Bold blocks and clean structure, a tight palette.'],
  ['gravel','Gravel / Rock','Drought-tough plants in lean, sharp drainage.'],
  ['formal','Formal','Symmetry and clipped lines — axial beds and hedges.'],
  ['coastal','Coastal','Salt- and wind-tolerant grasses and dune plants.'],
];
function openDesignSetup(){
  const zs=$('dgnZone'), ts=$('dgnType');
  if (!zs.options.length){
    [3,4,5,6,7,8,9].forEach(z=>{ const o=document.createElement('option');
      o.value=z; o.textContent='Zone '+z; zs.appendChild(o); });
    GARDEN_TYPES.forEach(([id,label])=>{ const o=document.createElement('option');
      o.value=id; o.textContent=label; ts.appendChild(o); });
    const note=()=>{ const t=GARDEN_TYPES.find(g=>g[0]===ts.value); $('dgnTypeNote').textContent=t?t[2]:''; };
    ts.onchange=note;
    $('btnDesignNext').onclick=()=>{
      const zone=+zs.value, type=ts.value;
      game.design={zone, type, nativesOnly:$('dgnNatives').checked,
        deer:$('dgnDeer').checked, rabbit:$('dgnRabbit').checked};
      // tune the live palette: zone/native filters apply, style ranks the tray
      game.region={eco:null, zone, nativesOnly:$('dgnNatives').checked};
      sSet('hortus:region',game.region); updateRegionBtn();
      openPlotScreen();
    };
    $('btnDesignBack').onclick=()=>{ game.mode=null; show('menuScreen'); };
  }
  const d=game.design||{};
  zs.value=String(d.zone||6); ts.value=d.type||'any';
  $('dgnNatives').checked=!!d.nativesOnly; $('dgnDeer').checked=!!d.deer; $('dgnRabbit').checked=!!d.rabbit;
  $('dgnTypeNote').textContent=(GARDEN_TYPES.find(g=>g[0]===ts.value)||[])[2]||'';
  show('designScreen');
}
function quitToMenu(){
  suspendClock();
  if (game.mode==='solo'&&hasStorage) saveSolo();
  if (syncTimer){ clearInterval(syncTimer); syncTimer=null; }
  game.mode=null; game.pausedAt=0; game.clockSuspended=false;
  game.others={}; game.pathTarget=null; game.sleepOnArrive=false;
  document.body.classList.remove('design-mode');
  $('exportScreen').classList.add('hidden'); $('regionScreen').classList.add('hidden');
  $('planScreen').classList.add('hidden'); $('pauseScreen').classList.add('hidden');
  $('gardenMenu').classList.add('hidden'); $('confirmSeasonScreen').classList.add('hidden');
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden'); $('playersPill').classList.add('hidden');
  setActiveCanvas(mcnv);
  setMenuViewportFill();
  show('menuScreen');
}
function openGardenMenu(){
  const gm=$('gardenMenu'); gm.classList.remove('hidden');
  if ($('btnPotting')) $('btnPotting').style.display = game.gameMode==='design' ? 'none' : ''; // Story only
  // anchor the dropdown right under the ☰ button, right-aligned to the action
  // bar — robust to the bar's height/width at any breakpoint
  const bar=$('actionBar').getBoundingClientRect(), p=gm.querySelector('.panel');
  if (p && bar.width){ p.style.top=(bar.bottom+6)+'px';
    p.style.right=Math.max(8,Math.round(innerWidth-bar.right))+'px'; }
}
$('btnMenu').onclick=openGardenMenu;
// click the backdrop (anywhere off the panel) to dismiss, like any dropdown
$('gardenMenu').onclick=(e)=>{ if (e.target===$('gardenMenu')) closeOverlay('gardenMenu'); };
$('btnQuit').onclick=quitToMenu;
$('btnGmClose').onclick=()=>closeOverlay('gardenMenu');
if ($('btnPotting')) $('btnPotting').onclick=()=>{ closeOverlay('gardenMenu'); openPotting(); };
if ($('btnPottingClose')) $('btnPottingClose').onclick=()=>closeOverlay('pottingScreen');
if ($('pottingBody')) $('pottingBody').onclick=pottingClick;
/* no Save button: autosave covers day changes, quitting, and the tab
   being hidden or closed mid-session */
function autosaveNow(){ if (game.mode==='solo'&&hasStorage){ saveSolo(true); game.dirty=false; } }
addEventListener('visibilitychange',()=>{
  if (document.hidden){ suspendClock(); autosaveNow(); }
  else { resumeClockSession(); updateHUD(); }
});
addEventListener('pagehide',()=>{ suspendClock(); autosaveNow(); });
if ($('btnSleep')){ $('btnSleep').classList.toggle('hidden',!ENABLE_HUD_SLEEP_BUTTON); $('btnSleep').onclick=doSleep; }
if ($('btnDayNight')) $('btnDayNight').onclick=()=>{ game.layerVis.night=!game.layerVis.night;
  updateDayNightBtn(); refreshCanvasTools();
  toast(game.layerVis.night?'Night — your garden lighting switches on.':'Back to daylight.'); };
if ($('btnPause')) $('btnPause').onclick=toggleClock;
// the season box: hold to fast-forward time, tap to open the time menu
(function wireSeasonBox(){
  const box=$('btnSeasonBox'); if (!box) return;
  let holdTimer=null, ffStarted=false;
  const cancelFF=()=>{ if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    if (ffStarted){ game.ffActive=false; ffStarted=false; } };
  box.addEventListener('pointerdown',e=>{ e.preventDefault(); ffStarted=false;
    holdTimer=setTimeout(()=>{ game.ffActive=true; ffStarted=true; },200); });
  box.addEventListener('pointerup',()=>{ if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    if (ffStarted){ game.ffActive=false; ffStarted=false; } else openPause(); });
  box.addEventListener('pointerleave',cancelFF);
  box.addEventListener('pointercancel',cancelFF);
})();
// the menu's primary button now pauses or resumes, since the dial's Pause button is gone
$('btnPauseResume').onclick=()=>{ if (game.pausedAt) resumeClock(); else pauseClock(); closePause(); updateHUD(); };
// the time menu is a dropdown — click the backdrop (off the panel) to dismiss
$('pauseScreen').onclick=(e)=>{ if (e.target===$('pauseScreen')) closePause(); };
$('btnSkipSeason').onclick=openSeasonConfirm;
$('btnSkipYear').onclick=skipNextYear;
$('btnCancelSeasonSkip').onclick=closeSeasonConfirm;
$('btnConfirmSeasonSkip').onclick=confirmSkipSeason;
$('btnExport').onclick=()=>{ closeOverlay('gardenMenu'); openExport(); };
$('btnExportClose').onclick=()=>closeOverlay('exportScreen');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;
$('btnRegion').onclick=()=>{ closeOverlay('gardenMenu'); openRegion(); };
$('btnRegionApply').onclick=applyRegion;
$('btnRegionClose').onclick=()=>closeOverlay('regionScreen');
if ($('btnRotate')) $('btnRotate').onclick=()=>rotateView(1);
$('btnPhoto').onclick=()=>{ closeOverlay('gardenMenu'); takePhoto(); };
$('btnPlan').onclick=()=>{ closeOverlay('gardenMenu'); openPlan(); };
$('btnPlanClose').onclick=()=>closeOverlay('planScreen');
$('btnPlanPng').onclick=downloadPlan;
$('btnPlanList').onclick=()=>{ closeOverlay('planScreen'); openExport(); };
$('btnAct').onclick=()=>{ if (ENABLE_MOBILE_ACT_BUTTON) actHere(); };
if ($('sheetHandle')) $('sheetHandle').onclick=()=>{ game.sheetCollapsed=!game.sheetCollapsed; applySheetState(); };

/* ---------- menu background: a living meadow ---------- */
const mcnv=$('menuCanvas'), mcx=mcnv.getContext('2d');
setActiveCanvas(mcnv);
const MENU_SCENES={
  Spring:{
    sky:['#6f8795','#cfdac3','#1c1813'],
    glow:['rgba(202,213,132,.30)','rgba(96,132,78,.18)'],
    ground:'rgba(30,46,29,.30)', pageBg:'#1d1f16', alpha:.72, bloom:1,
    keys:['crocus','daffodil','muscari','camassia','baptisia','creamindigo','amsonia','sedge','karl']
  },
  Summer:{
    sky:['#627d83','#9ebd91','#1d1812'],
    glow:['rgba(218,184,96,.28)','rgba(80,112,70,.18)'],
    ground:'rgba(31,55,29,.34)', pageBg:'#1e2216', alpha:.66, bloom:1,
    keys:['echinacea','pallida','rattlesnake','allium','yarrow','monarda','culvers','switchgrass','dropseed']
  },
  Fall:{
    sky:['#211610','#3b2a22','#17100d'],
    glow:['rgba(166,91,44,.28)','rgba(92,58,36,.16)'],
    ground:'rgba(16,10,8,.34)', pageBg:'#150e0b', alpha:.58, bloom:1,
    keys:['aster','newengland','goldenrod','liatris','sedum','bluestem','switchgrass','indiangrass','sanguisorba','helenium']
  },
  Winter:{
    sky:['#26303a','#6d746f','#171613'],
    glow:['rgba(211,221,226,.20)','rgba(112,116,108,.12)'],
    ground:'rgba(235,238,232,.11)', pageBg:'#2e2e2a', alpha:.64, bloom:undefined, snow:true,
    keys:['bluestem','bigbluestem','switchgrass','rattlesnake','allium','culvers','sanguisorba','goldenrod','karl','sideoats']
  }
};
const meadow=[], menuSnow=[];
let menuSeason='Fall';
function rgbaWithAlpha(color, alpha){
  const m=String(color).match(/^rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)$/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${alpha})` : color;
}
function setMenuViewportFill(){
  const sc=MENU_SCENES[menuSeason]||MENU_SCENES.Fall;
  setViewportFill(sc.pageBg||sc.sky[2]||'#241a16');
}
function seedMenuMeadow(){
  const sc=MENU_SCENES[menuSeason], keys=sc.keys;
  meadow.length=0; menuSnow.length=0;
  for (let i=0;i<54;i++) meadow.push({k:keys[i%keys.length], x:Math.random(),
    y:0.76+Math.random()*0.22, s:0.45+Math.random()*1.05, seed:(Math.random()*1e9)|0});
  meadow.sort((a,b)=>a.y-b.y);
}
function advanceMenuSeason(){
  let next=0;
  if (hasStorage){
    const raw=localStorage.getItem('hortus:menuSeasonIdx');
    next=((raw===null?-1:(parseInt(raw,10)||0))+1)%SEASONS.length;
    try{ localStorage.setItem('hortus:menuSeasonIdx',String(next)); }catch(_){}
  } else {
    next=(SEASONS.indexOf(menuSeason)+1)%SEASONS.length;
  }
  menuSeason=SEASONS[next];
  seedMenuMeadow();
  setMenuViewportFill();
}
function menuRender(t){
  const W=VW,H=VH;
  const sc=MENU_SCENES[menuSeason]||MENU_SCENES.Fall;
  const g=mcx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,sc.sky[0]); g.addColorStop(0.52,sc.sky[1]); g.addColorStop(1,sc.sky[2]);
  mcx.fillStyle=g; mcx.fillRect(0,0,W,H);
  const glow=mcx.createRadialGradient(W*.5,H*.7,10,W*.5,H*.72,Math.max(W,H)*.58);
  glow.addColorStop(0,sc.glow[0]);
  glow.addColorStop(0.42,sc.glow[1]);
  glow.addColorStop(1,'rgba(23,16,13,0)');
  mcx.fillStyle=glow; mcx.fillRect(0,0,W,H);
  const ground=mcx.createLinearGradient(0,H*.68,0,H);
  ground.addColorStop(0,rgbaWithAlpha(sc.ground,0));
  ground.addColorStop(.55,rgbaWithAlpha(sc.ground,.14));
  ground.addColorStop(1,sc.ground);
  mcx.fillStyle=ground;
  mcx.fillRect(0,H*.68,W,H*.32);
  const sway=Math.sin(t*0.0011);
  mcx.save(); mcx.globalAlpha=sc.alpha;
  meadow.forEach(m=>{ mcx.save(); mcx.translate(m.x*W,m.y*H); mcx.scale(m.s,m.s);
    drawPlant(mcx,0,0,m.k,1,menuSeason,m.seed,sway+Math.sin(t*0.0014+m.seed)*0.42,undefined,sc.bloom); mcx.restore(); });
  mcx.restore();
  if (sc.snow){
    if (menuSnow.length<48 && Math.random()<0.42)
      menuSnow.push({x:Math.random()*W,y:-5,v:0.25+Math.random()*0.45,r:1+Math.random()*1.4,w:Math.random()*7});
    mcx.fillStyle='rgba(245,248,252,0.72)';
    menuSnow.forEach(f=>{ f.y+=f.v; f.x+=Math.sin((t*0.001)+f.w)*0.22;
      mcx.beginPath(); mcx.arc(f.x,f.y,f.r,0,7); mcx.fill(); });
    for (let i=menuSnow.length-1;i>=0;i--) if (menuSnow[i].y>H+5) menuSnow.splice(i,1);
  }
}

/* ---------- main loop ---------- */
let prev=performance.now(), keyCooldown=0;
/* ---- debug HUD: perf diagnostics, off by default ----
   Toggle with the backtick key (`) or add ?debug to the URL. Costs nothing
   when off (every measurement is guarded by dbg.on). Shows FPS + a per-frame
   time breakdown — ground pass vs entity/plant pass vs the rest — so we can
   see where the frame actually goes, plus entity/tile counts and the canvas
   pixel budget. Works identically on desktop and tablet for side-by-side. */
const dbg={on:false, el:null, fps:0, frames:0, fpsAt:0, n:0,
  accTotal:0, accGround:0, accEnts:0, ents:0, tiles:0, tG0:0, tE0:0};
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
  dbg.frames=0; dbg.fpsAt=performance.now(); dbg.n=dbg.accTotal=dbg.accGround=dbg.accEnts=0;
}
function updateDebugHud(){
  if (!dbg.el) return;
  const c=document.getElementById('gameCanvas'), n=dbg.n||1, avg=ms=>(ms/n).toFixed(1);
  const mp=c?(c.width*c.height/1e6).toFixed(2):'?';
  dbg.el.textContent=
    `FPS ${(dbg.fps||0).toFixed(0)}    frame ${avg(dbg.accTotal)}ms\n`+
    `ground ${avg(dbg.accGround)}ms   plants ${avg(dbg.accEnts)}ms\n`+
    `entities ${dbg.ents}   tiles ${dbg.tiles}\n`+
    `canvas ${c?c.width+'×'+c.height:'?'} (${mp}MP)  dpr ${devicePixelRatio}  zoom ${ZOOM.toFixed(2)}`;
}
function loop(t){
  const dt=Math.min(50,t-prev); prev=t;
  if (game.mode){
    if (game.ffActive){ game.elapsedMs=(game.elapsedMs||0)+FF_RATE*dt; game.dirty=true; }
    if (game.gameMode!=='design'){ // story mode: avatar movement
      keyCooldown-=dt;
      if (keyCooldown<=0 && !game.moving){
        const vecs=Object.values(heldKeys);
        if (vecs.length){
          let mx=0,my=0; vecs.forEach(v=>{mx+=v[0];my+=v[1];});
          mx=Math.sign(mx); my=Math.sign(my);
          if (mx||my){ const [wx,wy]=viewDirToWorld(mx,my);
            tryMove(Math.round(game.px)+wx,Math.round(game.py)+wy); keyCooldown=40; }
        }
      }
      followPath(); stepMove(dt);
    }
    if (dbg.on){
      const r0=performance.now(); render(t); dbg.accTotal+=performance.now()-r0; dbg.n++; dbg.frames++;
      if (t-dbg.fpsAt>=500){ dbg.fps=dbg.frames*1000/(t-dbg.fpsAt); updateDebugHud();
        dbg.frames=0; dbg.fpsAt=t; dbg.n=dbg.accTotal=dbg.accGround=dbg.accEnts=0; }
    } else render(t);
    updateHUD();
  } else menuRender(t);
  requestAnimationFrame(loop);
}
(async function init(){
  await ensurePlayerId();
  if (hasStorage){
    const c=await sGet('hortus:char'); if (c) game.char=c;
    const r=await sGet('hortus:region'); if (r) game.region=r;
  }
  updateRegionBtn();
  advanceMenuSeason();
  refreshMenuCards();
  if (location.search.includes('debug')) toggleDebug();
  requestAnimationFrame(loop);
})();
