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
function ftToTiles(ft){ return Math.max(2, Math.round(ft*12/TILE_IN)); }

/* Season ambience: sky gradient, grass tone, soil tone, light tint */
const AMBIENCE = {
  Spring:{sky:['#8aa4b8','#cfd8c2'], grass:['#7fa05e','#6f8f5a'], soil:'#5b4332', tint:'rgba(190,220,170,0.06)', snow:0},
  Summer:{sky:['#7d93a8','#b8c9a8'], grass:['#6f8f5a','#5d7a4c'], soil:'#54402f', tint:'rgba(255,240,180,0.05)', snow:0},
  Fall:  {sky:['#9a7d6e','#d9b98a'], grass:['#a78a4f','#8f7544'], soil:'#4e3a2b', tint:'rgba(255,170,90,0.08)', snow:0},
  Winter:{sky:['#6e7787','#cdd3d8'], grass:['#9b9484','#857f70'], soil:'#5a5048', tint:'rgba(200,215,235,0.10)', snow:1},
};

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
function drawPlant(ctx, x, y, key, growth, season, seed, sway, variant, bloomLvl){
  const P = plantDef(key, variant), S = P.sea[season], rnd = mulberry(seed);
  // how far into its bloom window this species is (1 = forced full bloom,
  // used by tray icons / previews); gates and thins the flower pass
  const blv = bloomLvl!==undefined ? bloomLvl : (S.bloom ? bloomLevel(key) : 0);
  const blooming = !!S.bloom && blv>0.08;
  const H = P.h * (0.25 + 0.75*growth);
  const mature = growth > 0.55;
  ctx.save(); ctx.translate(x, y);
  // soft ground shadow (canopy-wide for woody plants)
  const shR = (P.cw ? P.cw*0.42 : 14)*growth + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, shR, shR*0.36+1.5, 0, 0, 7); ctx.fill();

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
  else if (P.form === 'cone' || P.form === 'globe' || P.form === 'spike'){
    const L = P.look||{}; // per-species carriage: leafiness, wispiness, droop
    // basal foliage (skipped in seasons with no foliage color)
    if (S.fol){
      const fn = stemFor(L.leaves||8);
      ctx.strokeStyle = S.fol; ctx.lineWidth = L.leafW||1.8;
      for (let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*(L.leafLen||0.34);
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
    }
    // flower stems
    const sn = stemFor(P.form==='spike'?7:(L.stems||6));
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*14, len=H*(0.75+rnd()*0.3), tx=ox+sway*len*0.05;
      ctx.strokeStyle = P.stem || shade(S.fol,-18);
      ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(ox*0.4,0);
      ctx.quadraticCurveTo(ox,-len*0.55,tx,-len); ctx.stroke();
      if (!mature) continue;
      const hx=tx, hy=-len;
      // bloom staggering: only the leading fraction of stems flower
      const headOn = blooming && i < Math.max(1, Math.ceil(sn*blv));
      if (P.form==='cone'){
        if (headOn){ // rays + cone, carried per the species' look
          const rays=L.rays||7, rl=L.rayLen||6, dr=(L.droop===undefined)?2.5:L.droop;
          ctx.strokeStyle=S.bloom; ctx.lineWidth=L.rayW||2.2;
          for(let p=0;p<rays;p++){ const pa=p/rays*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.lineTo(hx+Math.cos(pa)*rl, hy+Math.sin(pa)*rl*0.75+dr); ctx.stroke(); }
          ctx.fillStyle=S.eye||'#b5651d';
          ctx.beginPath(); ctx.ellipse(hx,hy-1,3.2,3.6,0,0,7); ctx.fill();
        } else if (S.seed){ ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(hx,hy,3,3.8,0,0,7); ctx.fill(); }
      }
      else if (P.form==='globe'){
        const col = (headOn?S.bloom:null) || S.seed;
        if (col){ ctx.fillStyle=col;
          ctx.beginPath(); ctx.arc(hx,hy,key==='allium'?5:4.2,0,7); ctx.fill();
          ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7;
          for(let p=0;p<6;p++){ const pa=p/6*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.lineTo(hx+Math.cos(pa)*5.5,hy+Math.sin(pa)*5.5); ctx.stroke(); } }
      }
      else { // spike
        const col=(headOn?S.bloom:null)||S.seed;
        if (col){ ctx.fillStyle=col;
          for(let s=0;s<5;s++){ ctx.beginPath();
            ctx.ellipse(hx+(rnd()-0.5)*1.5, hy+s*3.2, 1.8,2.2,0,0,7); ctx.fill(); } }
      }
    }
  }
  else if (P.form === 'shrub'){
    // mounded clump of foliage dots
    const n = stemFor(26);
    for (let i=0;i<n;i++){
      const a=rnd()*Math.PI*2, r=rnd();
      const px=Math.cos(a)*16*r*(0.5+0.5*growth)+sway*2, py=-H*0.55*(0.25+rnd()*0.75);
      ctx.fillStyle = shade(S.fol,(rnd()-0.5)*30);
      ctx.beginPath(); ctx.ellipse(px,py,3.4,2.6,a,0,7); ctx.fill();
    }
    if (mature && ((blooming&&S.bloom)||S.seed)){
      const col=(blooming?S.bloom:null)||S.seed;
      const m0=stemFor(7), m=S.bloom&&!S.seed ? Math.max(1,Math.ceil(m0*blv)) : m0;
      for (let i=0;i<m;i++){
        const ox=(rnd()-0.5)*20, len=H*(0.85+rnd()*0.2);
        ctx.strokeStyle=shade(S.fol,-25); ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=col;
        if ((key==='baptisia'||key==='creamindigo')&&season==='Spring'){ for(let s=0;s<4;s++){
          ctx.beginPath(); ctx.ellipse(ox+sway*2,-len+s*3.4,1.9,2.4,0,0,7); ctx.fill(); } }
        else if (key==='amsonia'&&season==='Spring'){ for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
          ctx.beginPath(); ctx.ellipse(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3,1.3,0,0,7); ctx.fill(); } }
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
    const cw=(P.cw||100)*(0.3+0.7*growth), trunkH=H*0.42;
    const cy=-trunkH-H*0.30; // canopy center
    ctx.strokeStyle='#5e4a38'; ctx.lineCap='round';
    ctx.lineWidth=Math.max(2, 6*growth);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(sway*2,-trunkH); ctx.stroke();
    const tips=[];
    ctx.lineWidth=Math.max(1.2, 2.2*growth);
    for (let i=0;i<5;i++){
      const a=(i/4-0.5)*1.7+(rnd()-0.5)*0.2;
      const bx=Math.sin(a)*cw*0.34+sway*3, by=cy-Math.cos(a)*H*0.18;
      ctx.beginPath(); ctx.moveTo(sway*1.4,-trunkH*0.92);
      ctx.quadraticCurveTo(bx*0.35,-trunkH-H*0.12,bx,by); ctx.stroke();
      tips.push([bx,by]);
    }
    if (S.fol){ // leaf canopy
      const n=stemFor(26);
      for (let i=0;i<n;i++){
        const a=rnd()*Math.PI*2, r=Math.sqrt(rnd());
        ctx.fillStyle=shade(S.fol,(rnd()-0.5)*30);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a)*cw*0.48*r+sway*3, cy-Math.sin(a)*H*0.26*r,
          cw*0.15, cw*0.10, a, 0, 7);
        ctx.fill();
      }
    }
    if (blooming){ // flowers: on the canopy, or straight on bare branches (redbud)
      ctx.fillStyle=S.bloom;
      const spots=Math.max(2,Math.ceil((S.fol?10:14)*blv));
      for (let i=0;i<spots;i++){
        const [tx2,ty2]=tips[i%tips.length];
        const f=0.45+rnd()*0.55;
        ctx.beginPath();
        ctx.arc(sway*1.4+(tx2-sway*1.4)*f, -trunkH*0.92+(ty2+trunkH*0.92)*f, 1.8, 0, 7);
        ctx.fill();
      }
    }
    if (S.seed && mature){ // cottonwood fluff, oak's held leaves handled via fol
      ctx.fillStyle=S.seed;
      for (let i=0;i<8;i++){ ctx.beginPath();
        ctx.arc((rnd()-0.5)*cw*0.8+sway*3, cy-(rnd()-0.5)*H*0.4, 1.4, 0, 7); ctx.fill(); }
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
  else if (P.form === 'bush'){ // woody shrub: twigs hold through winter
    const cw=(P.cw||50)*(0.35+0.65*growth);
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
    if (blooming && mature){ ctx.fillStyle=S.bloom;
      tips.slice(0,Math.max(1,Math.ceil(tips.length*blv))).forEach(([tx2,ty2])=>{
        ctx.beginPath(); ctx.ellipse(tx2,ty2-2,2.2,3.2,0,0,7); ctx.fill(); }); }
    if (S.seed && mature){ ctx.fillStyle=S.seed; // berries/pods along upper twigs
      tips.forEach(([tx2,ty2])=>{ for (let b=0;b<3;b++){ const f=0.6+b*0.15;
        ctx.beginPath(); ctx.arc(tx2*f,ty2*f,1.6,0,7); ctx.fill(); } }); }
  }
  // winter snow caps on mature structure
  if (AMBIENCE[season].snow && mature){
    ctx.fillStyle='rgba(240,244,250,0.85)';
    const rs=mulberry(seed+9), caps=4;
    for(let i=0;i<caps;i++){ ctx.beginPath();
      ctx.ellipse((rs()-0.5)*18,-H*(0.5+rs()*0.45),3.5,1.6,0,0,7); ctx.fill(); }
  }
  ctx.restore();
}

function shade(hex, amt){
  if (!hex) hex='#6b6248'; // seasons without that color: dead-stem brown
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
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
   and colors come from game.house. The door clings to its world tile —
   from behind the house it's simply out of sight. */
function drawHouse(ctx, W, H, season, hOv){
  const hh=hOv||game.house; if (!hh) return;
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
  }
  // snow blankets the roof in winter
  if (AMBIENCE[season].snow){
    quad(frontRoof[0],frontRoof[1],frontRoof[2],frontRoof[3],'rgba(240,244,250,0.75)');
    quad(backRoof[0],backRoof[1],backRoof[2],backRoof[3],'rgba(240,244,250,0.45)');
  }
}

/* ---------- world / state ---------- */
const game = {
  mode:null, code:null, playerId:null,
  char:{species:'cat', coatIdx:0, coat:COATS[0].c, coatD:COATS[0].d, mark:'solid', name:''},
  plants:{},          // "x,y" -> {s:key, d:absDayPlanted, t:ts} or {removed:true,t}
  bulbs:{},           // same shape — the layer under the plants
  terrain:{},         // "x,y" -> {k:'path'|'bed', t:ts} or {removed:true,t}
  startTs:Date.now(), dayOffset:0,
  px:15, py:15, tx:15, ty:15, moving:false, moveT:0, fromX:15, fromY:15,
  moveDur:170, pathTarget:null, sleepOnArrive:false,
  house:null, houseT:0,                              // per-garden house + sync stamp
  rot:0,                                             // view rotation, 90-degree steps
  hoverTile:null,                                    // pointer tile, for the house ghost
  worldId:null, worldName:'My garden',               // current solo save slot
  drift:false,                                       // plant in clusters, Oudolf style
  fx:[],                                             // short-lived planting pulses
  tool:PLANT_KEYS[0], toolVar:null,                  // species + optional cultivar
  trayCat:'grasses',                                 // active tool-tray category
  region:{eco:null, zone:null, nativesOnly:false},   // palette filter, persisted
  others:{},          // multiplayer presence
  lastDay:-1, dirty:false,
};
/* Solo saves persist to localStorage now that the game runs standalone.
   sGet/sSet keep their old async signatures so callers are unchanged.
   `shared` keys land in the same localStorage, so shared gardens only
   sync between tabs on this device until a real backend exists. */
const hasStorage = (()=>{ try{ localStorage.setItem('hortus:probe','1');
  localStorage.removeItem('hortus:probe'); return true; }catch(e){ return false; } })();

function absDay(){ return Math.floor((Date.now()-game.startTs)/DAY_MS) + game.dayOffset; }
function calClock(){
  const d=absDay(), year=Math.floor(d/(DAYS_PER_SEASON*4))+1;
  const sIdx=Math.floor(d/DAYS_PER_SEASON)%4;
  return {day:d%DAYS_PER_SEASON+1, season:SEASONS[sIdx], year,
          frac:((Date.now()-game.startTs)%DAY_MS)/DAY_MS};
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
function bulbEnvelope(){ // up with the thaw, gone under the summer canopy
  const ydf=(((absDay()%YEAR_DAYS)+YEAR_DAYS)%YEAR_DAYS)+calClock().frac;
  if (ydf>=DAYS_PER_SEASON) return 0;          // underground from summer on
  if (ydf<1.5) return ydf/1.5;
  if (ydf<10) return 1;
  return Math.max(0,(DAYS_PER_SEASON-1-ydf)/5); // foliage yellows away
}
function plantGrowth(p){
  const P=PLANTS[p.s];
  if (P && (P.type==='shrub'||P.type==='tree')) return plantEstab(p); // woody: no cutback
  if (P && P.type==='bulb') return plantEstab(p)*bulbEnvelope();
  return plantEstab(p)*seasonEnvelope(p.s);
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
/* trees throw shade as they establish; only part-sun plants grow there */
function canopyRadius(p){ const P=PLANTS[p.s];
  if (!P || P.type!=='tree') return 0;
  return (P.spread/TILE_IN/2)*plantEstab(p);
}
function shadeAt(x,y){
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const P=PLANTS[p.s]; if (!P || P.type!=='tree') continue;
    const [tx2,ty2]=k.split(',').map(Number);
    if (tx2===x && ty2===y) continue; // the trunk tile itself is just occupied
    const r=canopyRadius(p);
    if (r>=1 && Math.max(Math.abs(x-tx2),Math.abs(y-ty2))<=r) return p;
  }
  return null;
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

/* the house: a per-garden footprint you can't walk through, with a door
   tile centered on its south side. Anyone — you or a visiting gardener —
   sleeps there to bring on the next day. Position, size (real feet), and
   colors live in game.house; the House tool moves/resizes/paints it. */
const HOUSE_TRIM = {door:'#3a2c22', trim:'#efe6d3', glow:'#d9c08a'};
const HOUSE_SIZES = [ // [label, width ft, depth ft] -> tiles via ftToTiles
  ['Shed',3,3],['Tiny home',12,9],['Cottage',24,18],['House',36,27],['Big house',45,36]];
const WALL_COLS = [['Cedar','#8a7a60'],['Cream','#d9cdb0'],['Sage','#8a9a78'],
  ['Barn red','#9a4a3a'],['Slate','#6e7787']];
const ROOF_COLS = [['Rust','#9a5f3a'],['Charcoal','#3f3a38'],['Forest','#4a5d46'],
  ['Weathered','#8a8274']];
function defaultHouse(){ // a shed on small plots, a cottage on real yards
  const big=GW*GH>=1900, w=big?ftToTiles(24):2, h=big?ftToTiles(18):2;
  return {x:Math.max(0,Math.min(GW-w-1,SPAWNX+3)), y:Math.max(0,SPAWNY-6-(h-2)),
          w, h, wall:'#8a7a60', roof:'#9a5f3a'};
}
function inHouse(x,y){ const h=game.house; if (!h) return false;
  return x>=h.x && x<h.x+h.w && y>=h.y && y<h.y+h.h; }
function doorPos(hOv){ const h=hOv||game.house;
  return h ? [h.x+((h.w-1)>>1), h.y+h.h] : [-1,-1]; }
function isDoor(x,y){ const [dx,dy]=doorPos(); return x===dx && y===dy; }
function canStand(x,y){ return x>=0 && y>=0 && x<GW && y<GH && !inHouse(x,y); }

/* player-laid terrain (paths and beds) on top of the built-in walkway */
function tileTerrain(x,y){ const t=game.terrain[`${x},${y}`]; return (t&&!t.removed)?t.k:null; }

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
function screenOf(x,y,W,H){ const [vx,vy]=worldToView(x,y); return viewScreen(vx,vy,W,H); }
function viewDepth(x,y){ const [vx,vy]=worldToView(x,y); return vx+vy; }
function tileAt(sx,sy,W,H){
  const rx = sx - W/2 + cam.x, ry = sy - H*0.24 + cam.y - TILE_H/2;
  const fx = (rx/(TILE_W/2) + ry/(TILE_H/2))/2;
  const fy = (ry/(TILE_H/2) - rx/(TILE_W/2))/2;
  return viewToWorld(Math.round(fx), Math.round(fy));
}
function snapCam(){ const [vx,vy]=worldToView(game.px,game.py);
  cam.x=isoX(vx,vy); cam.y=isoY(vx,vy)-(innerHeight/ZOOM)*0.21; }
function rotateView(){
  game.rot=(game.rot+1)%4; snapCam(); game.dirty=true;
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
  calcZoom(); if (game.mode) snapCam();
}
function zoomBy(f){ setUserZoom(userZoom*f); }
calcZoom();
function sizeCanvas(c){ c.width=innerWidth*DPR; c.height=innerHeight*DPR;
  c.getContext('2d').setTransform(DPR,0,0,DPR,0,0); }
addEventListener('resize', ()=>{ sizeCanvas(cnv); sizeCanvas(mcnv); calcZoom(); });

let snowFlakes = [];
function render(t){
  const W=innerWidth/ZOOM, H=innerHeight/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  // sky
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,amb.sky[0]); g.addColorStop(1,amb.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,W,H);

  // camera eases toward player
  const [ptx,pty]=screenOf(game.px,game.py,W,H);
  cam.x += (ptx-W/2)*0.06; cam.y += (pty-H*0.45)*0.06;

  const sway = Math.sin(t*0.0012);

  // visible tile window: invert the four screen corners to world tiles
  // and take the padded bounding box, so we only walk what's on screen
  // (the padding covers plant/cottage heights overhanging tile bounds)
  const crn=[tileAt(0,0,W,H),tileAt(W,0,W,H),tileAt(0,H,W,H),tileAt(W,H,W,H)];
  const x0=Math.max(0,Math.min(crn[0][0],crn[1][0],crn[2][0],crn[3][0])-2);
  const x1=Math.min(GW-1,Math.max(crn[0][0],crn[1][0],crn[2][0],crn[3][0])+2);
  const y0=Math.max(0,Math.min(crn[0][1],crn[1][1],crn[2][1],crn[3][1])-2);
  const y1=Math.min(GH-1,Math.max(crn[0][1],crn[1][1],crn[2][1],crn[3][1])+2);

  // ground tiles back-to-front
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    const terr=tileTerrain(x,y);
    const path=terr==='path';
    const rs=mulberry(tileSeed(x,y));
    let col;
    if (path) col = amb.snow?'#b8b2a6':'#bba98c';
    else if (isDoor(x,y)) col = amb.snow?'#aaa49a':'#a89a80';   // flagstone doorstep
    else if (terr==='bed') col = shade(amb.soil,(rs()-0.5)*12);
    else col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14);
    cx.fillStyle=col;
    cx.beginPath();
    cx.moveTo(sx,sy); cx.lineTo(sx+TILE_W/2,sy+TILE_H/2);
    cx.lineTo(sx,sy+TILE_H); cx.lineTo(sx-TILE_W/2,sy+TILE_H/2);
    cx.closePath(); cx.fill();
    cx.strokeStyle='rgba(0,0,0,0.07)'; cx.lineWidth=1; cx.stroke();
    if (terr==='bed' && !amb.snow){ cx.fillStyle='rgba(0,0,0,0.12)';   // mulch flecks
      for (let i=0;i<3;i++){ cx.beginPath();
        cx.ellipse(sx+(rs()-0.5)*32, sy+TILE_H/2+(rs()-0.5)*11, 2.2,1.2,0,0,7); cx.fill(); } }
    if (amb.snow && !path && rs()>0.4){ cx.fillStyle='rgba(238,242,248,0.7)';
      cx.beginPath(); cx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); cx.fill(); }
  }
  // hover/selection cursor on player's tile
  const [hx,hy]=screenOf(game.tx,game.ty,W,H);
  cx.strokeStyle='rgba(243,236,221,0.85)'; cx.lineWidth=2;
  cx.beginPath(); cx.moveTo(hx,hy+2); cx.lineTo(hx+TILE_W/2-3,hy+TILE_H/2);
  cx.lineTo(hx,hy+TILE_H-2); cx.lineTo(hx-TILE_W/2+3,hy+TILE_H/2); cx.closePath(); cx.stroke();

  // RTS-style placement ghost while the House tool is armed: tinted
  // footprint (red when you're standing in it) under a translucent house
  let ghost=null;
  if (game.tool==='house' && game.hoverTile && game.house){
    const h=game.house;
    const gx=Math.max(0,Math.min(GW-h.w,game.hoverTile[0]));
    const gy=Math.max(0,Math.min(GH-h.h-1,game.hoverTile[1]));
    const ppx=Math.round(game.px), ppy=Math.round(game.py);
    const blocked = ppx>=gx&&ppx<gx+h.w&&ppy>=gy&&ppy<gy+h.h;
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
  const ents=[];
  const hh=game.house;
  if (hh && hh.x+hh.w-1>=x0 && hh.x<=x1 && hh.y+hh.h-1>=y0 && hh.y<=y1)
    ents.push({depth:Math.max(viewDepth(hh.x,hh.y),viewDepth(hh.x+hh.w-1,hh.y),
        viewDepth(hh.x,hh.y+hh.h-1),viewDepth(hh.x+hh.w-1,hh.y+hh.h-1))+0.45,
      draw:()=>drawHouse(cx,W,H,cal.season)});
  if (ghost)
    ents.push({depth:Math.max(viewDepth(ghost.x,ghost.y),viewDepth(ghost.x+ghost.w-1,ghost.y),
        viewDepth(ghost.x,ghost.y+ghost.h-1),viewDepth(ghost.x+ghost.w-1,ghost.y+ghost.h-1))+0.46,
      draw:()=>{ cx.globalAlpha=0.55; drawHouse(cx,W,H,cal.season,ghost); cx.globalAlpha=1; }});
  // canopies stunt full-sun plants beneath them (they persist, smaller)
  const shadeTrees=[];
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const P=PLANTS[p.s];
    if (P && P.type==='tree'){ const r=canopyRadius(p);
      if (r>=1){ const [tx2,ty2]=k.split(',').map(Number); shadeTrees.push([tx2,ty2,r,k]); } }
  }
  // the bulb layer: invisible most of the year, so cull hard
  for (const k in game.bulbs){ const p=game.bulbs[k];
    if (p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    const gB=plantGrowth(p); if (gB<=0.02) continue;
    ents.push({depth:viewDepth(x,y)+0.25, draw:()=>{ const [sx,sy]=screenOf(x,y,W,H);
      drawPlant(cx,sx,sy+TILE_H/2,p.s,gB,cal.season,(tileSeed(x,y)^0x9e37)>>>0,sway,p.v);}});
  }
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    let g2v=plantGrowth(p);
    const P2=PLANTS[p.s];
    if (P2 && P2.sun!=='part' && P2.type!=='tree' &&
        shadeTrees.some(([sx2,sy2,r,sk])=>sk!==k &&
          Math.max(Math.abs(x-sx2),Math.abs(y-sy2))<=r))
      g2v*=0.45; // struggling under the canopy
    ents.push({depth:viewDepth(x,y)+0.3, draw:()=>{ const [sx,sy]=screenOf(x,y,W,H);
      drawPlant(cx,sx,sy+TILE_H/2,p.s,g2v,cal.season,tileSeed(x,y),sway,p.v);}});
  }
  // local player (smooth move)
  let dx=game.px, dy=game.py;
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

  // planting pulses: an expanding diamond so a tap visibly took
  game.fx=game.fx.filter(f=>t-f.t0<550);
  game.fx.forEach(f=>{
    const a=(t-f.t0)/550, e2=0.55+a*0.85;
    const [sx,sy]=screenOf(f.x,f.y,W,H), cyx=sy+TILE_H/2;
    cx.strokeStyle=`rgba(243,236,221,${0.95*(1-a)})`; cx.lineWidth=2.5;
    cx.beginPath();
    cx.moveTo(sx, cyx-(TILE_H/2)*e2); cx.lineTo(sx+(TILE_W/2)*e2, cyx);
    cx.lineTo(sx, cyx+(TILE_H/2)*e2); cx.lineTo(sx-(TILE_W/2)*e2, cyx);
    cx.closePath(); cx.stroke();
  });

  // season light tint + falling snow
  cx.fillStyle=amb.tint; cx.fillRect(0,0,W,H);
  if (amb.snow){
    if (snowFlakes.length<70 && Math.random()<0.5)
      snowFlakes.push({x:Math.random()*W,y:-5,v:0.4+Math.random()*0.7,r:1+Math.random()*1.6,w:Math.random()*7});
    cx.fillStyle='rgba(245,248,252,0.85)';
    snowFlakes.forEach(f=>{ f.y+=f.v; f.x+=Math.sin((t*0.001)+f.w)*0.3;
      cx.beginPath(); cx.arc(f.x,f.y,f.r,0,7); cx.fill(); });
    snowFlakes=snowFlakes.filter(f=>f.y<H+5);
  } else snowFlakes.length=0;

  if (game.photo){ // golden-hour wash, only on the captured frame
    const g2=cx.createRadialGradient(W*0.72,H*0.22,30, W*0.72,H*0.22,H*0.95);
    g2.addColorStop(0,'rgba(255,212,140,0.38)');
    g2.addColorStop(0.5,'rgba(228,160,90,0.10)');
    g2.addColorStop(1,'rgba(50,35,55,0.24)');
    cx.fillStyle=g2; cx.fillRect(0,0,W,H);
  }
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
function actHere(){
  const x=Math.round(game.tx), y=Math.round(game.ty), k=`${x},${y}`;
  if (isDoor(x,y)){ doSleep(); return; }
  if (game.tool==='house'){ toast('Tap the spot where the house should stand.'); return; }
  const existing = game.plants[k], hasPlant = existing && !existing.removed;
  const terr = tileTerrain(x,y);
  const bulbHere=game.bulbs[k], hasBulb=bulbHere && !bulbHere.removed;
  if (game.tool==='shovel'){
    if (hasPlant){
      game.plants[k]={removed:true,t:Date.now()}; game.dirty=true;
      toast('Lifted. Good divisions make free plants.'); syncPlantsOut(); }
    else if (hasBulb){
      game.bulbs[k]={removed:true,t:Date.now()}; game.dirty=true;
      toast('Bulb dug up.'); syncBulbsOut(); }
    else if (terr){
      game.terrain[k]={removed:true,t:Date.now()}; game.dirty=true;
      toast(terr==='path'?'Path dug up.':'Bed turned back to grass.'); syncTerrainOut(); }
    else toast('Nothing here to lift.');
    return;
  }
  if (game.tool==='path'||game.tool==='bed'){
    if (hasPlant){ toast('Lift the plant first.'); return; }
    if (terr===game.tool){ toast(terr==='path'?'Already a path.':'Already a bed.'); return; }
    game.terrain[k]={k:game.tool,t:Date.now()}; game.dirty=true;
    toast(game.tool==='path'?'Path laid.':'Bed dug. Ready for planting.');
    syncTerrainOut();
    return;
  }
  const def=PLANTS[game.tool] ? plantDef(game.tool,game.toolVar) : null;
  if (!def) return;
  if (def.type==='bulb'){ // bulbs go UNDER plants — a plant here is no obstacle
    if (hasBulb){ showPlantCard(bulbHere,x,y); return; }
    if (terr==='path'){ toast('Not in the gravel — lift the path first.'); return; }
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n); return; }
    if (applyToolAt(x,y)){ syncBulbsOut();
      toast(`Tucked in ${def.name} — it shows at first thaw.`); }
    else toast('No spot for a bulb here.');
    return;
  }
  if (terr==='path'){ toast('Dig the path up first — plants and gravel disagree.'); return; }
  if (hasPlant){ showPlantCard(existing,x,y); return; }
  const shadeTree=shadeAt(x,y);
  if (shadeTree && def.sun!=='part'){
    toast(`Too shady under the ${PLANTS[shadeTree.s].name.toLowerCase()} — shade-tolerant plants only.`);
    return;
  }
  const n=game.drift?driftCount(def):1;
  if (n>1){ stampDrift(x,y,n); return; }
  if (applyToolAt(x,y)){ syncPlantsOut();
    toast(`Planted ${def.name}.${def.type==='forb'||def.type==='grass'?' Drifts of 3+ read better — try the Drift toggle.':''}`); }
  else toast('No room here.');
}
function plantFx(x,y){ game.fx.push({x,y,t0:performance.now()}); }
/* drift planting: one action stamps a loose, natural cluster. Tighter
   spacers come in bigger drifts; woody plants always plant singly. */
function driftCount(def){
  if (def.type==='shrub'||def.type==='tree') return 1;
  return def.space<=6?9 : def.space<=12?7 : def.space<=18?5 : def.space<=30?3 : 1;
}
/* the one silent placer behind drifts, drags, and single planting:
   puts the armed tool on a tile if it fits, no toasts. Returns what
   it placed ('plant'|'bulb'|'path'|'bed') or null. */
function applyToolAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return null;
  if (inHouse(x,y) || isDoor(x,y)) return null;
  const k=`${x},${y}`, terr=tileTerrain(x,y);
  if (game.tool==='path'||game.tool==='bed'){
    const ex=game.plants[k];
    if (ex && !ex.removed) return null;
    if (terr===game.tool) return null;
    game.terrain[k]={k:game.tool,t:Date.now()}; game.dirty=true;
    return game.tool;
  }
  if (!PLANTS[game.tool]) return null;
  const def=plantDef(game.tool,game.toolVar);
  if (terr==='path') return null;
  const np={s:game.tool,d:absDay(),t:Date.now()};
  if (game.toolVar) np.v=game.toolVar;
  if (def.type==='bulb'){ // bulbs tuck in under whatever is planted above
    const eb=game.bulbs[k];
    if (eb && !eb.removed) return null;
    game.bulbs[k]=np; game.dirty=true; plantFx(x,y);
    return 'bulb';
  }
  const ex=game.plants[k];
  if (ex && !ex.removed) return null;
  const sh=shadeAt(x,y);
  if (sh && def.sun!=='part') return null;
  game.plants[k]=np; game.dirty=true; plantFx(x,y);
  return 'plant';
}
function syncToolLayer(what){
  if (what==='path'||what==='bed') syncTerrainOut();
  else if (what==='bulb') syncBulbsOut();
  else syncPlantsOut();
}
function stampDrift(cx0,cy0,n){
  const offs=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
              [2,0],[0,2],[-2,0],[0,-2],[2,1],[1,2],[-1,2],[-2,1]];
  const rest=offs.slice(1); // keep the clicked tile first, shuffle the rest
  for (let i=rest.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0;
    [rest[i],rest[j]]=[rest[j],rest[i]]; }
  const def=plantDef(game.tool,game.toolVar);
  let placed=0, what=null;
  for (const [ox,oy] of [offs[0],...rest]){
    if (placed>=n) break;
    const r=applyToolAt(cx0+ox,cy0+oy);
    if (r){ placed++; what=r; }
  }
  if (placed){ syncToolLayer(what);
    toast(placed>1?`A drift of ${placed} — ${def.name}.`:`Planted ${def.name} — no room for more here.`); }
  else toast('No room for a drift here.');
}
function doSleep(){
  game.dayOffset++; game.dirty=true;
  if (game.mode==='multi') toast('You napped in the house — a shared garden keeps its own clock.');
  else toast('You slept well. A new day.');
}

/* ---------- house placement / sizing / paint ---------- */
function pushHouse(){ game.houseT=Date.now();
  if (game.mode==='multi') sSet(wkey('house'),{h:game.house,t:game.houseT},true); }
function displacePlants(x,y,w,h){ // a house can't share ground with plants
  let n=0;
  for (let yy=y;yy<y+h;yy++) for (let xx=x;xx<x+w;xx++){
    const k=`${xx},${yy}`, p=game.plants[k];
    if (p && !p.removed){ game.plants[k]={removed:true,t:Date.now()}; n++; }
  }
  if (n){ game.dirty=true; syncPlantsOut(); }
  return n;
}
function placeHouse(x,y){
  const h=game.house; if (!h) return;
  const nx=Math.max(0,Math.min(GW-h.w,x)), ny=Math.max(0,Math.min(GH-h.h-1,y));
  const ppx=Math.round(game.px), ppy=Math.round(game.py);
  if (ppx>=nx&&ppx<nx+h.w&&ppy>=ny&&ppy<ny+h.h){ toast("You're standing in the way."); return; }
  h.x=nx; h.y=ny; game.dirty=true; pushHouse();
  const n=displacePlants(nx,ny,h.w,h.h);
  toast('The house settles onto new ground.'+(n?` ${n} plant${n>1?'s':''} lifted from under it.`:''));
}
function applyHouseSize(wFt,dFt,label){
  const h=game.house, w=ftToTiles(wFt), d=ftToTiles(dFt);
  if (w>GW-2 || d>GH-3){ toast('The plot is too small for that house.'); return; }
  h.w=w; h.h=d; h.sizeFt=[wFt,dFt];
  h.x=Math.max(0,Math.min(GW-w,h.x)); h.y=Math.max(0,Math.min(GH-d-1,h.y));
  if (inHouse(Math.round(game.px),Math.round(game.py))){
    const [dx2,dy2]=doorPos(); game.px=game.tx=dx2; game.py=game.ty=dy2; game.moving=false; }
  game.dirty=true; pushHouse();
  const n=displacePlants(h.x,h.y,w,d);
  toast(`${label} — ${wFt}' × ${dFt}'.`+(n?` ${n} plant${n>1?'s':''} lifted from under it.`:''));
}
function paintHouse(part,col,label){
  game.house[part]=col; game.dirty=true; pushHouse();
  toast(part==='wall'?`Walls painted ${label.toLowerCase()}.`:`Roof done in ${label.toLowerCase()}.`);
}
function showPlantCard(p,px2,py2){
  const P=plantDef(p.s,p.v), g=Math.round(plantEstab(p)*100), el=document.getElementById('plantCard');
  const dim=v=>v>=96?`${Math.round(v/12)}&prime;`:`${v}&Prime;`; // feet for tree-scale numbers
  const shaded = px2!==undefined && P.sun!=='part' && P.type!=='tree' && shadeAt(px2,py2);
  el.innerHTML=`<h3>${P.name}</h3><div class="latin">${P.latin}</div>
    <p>${P.blurb}</p>
    <p style="margin-top:6px;color:#cdbfa9">${dim(P.space)} apart · ${dim(P.spread)} spread ·
      zones ${P.zones[0]}–${P.zones[1]} · ${P.sun} sun · ${P.moist} soil${
      P.grow?` · ~${P.grow} yrs to size`:''}</p>
    <p style="color:${P.native?'#9ab87a':'#c9a07f'}">${P.native
      ? 'Native — '+P.eco.slice(0,2).join(', ')+(P.eco.length>2?` +${P.eco.length-2} more`:'')
      : 'Garden cultivar (non-native)'}</p>
    ${shaded?'<p style="color:#c9a07f">Struggling — a canopy has grown over it and it wants full sun.</p>':''}
    <p style="margin-top:6px;color:#efe6d3">${g<100?`Establishing — ${g}% grown`:'Fully established'}</p>`;
  const xb=document.createElement('button'); xb.className='card-x'; xb.textContent='✕';
  xb.onclick=()=>{ el.style.display='none'; clearTimeout(el._t); };
  el.prepend(xb);
  el.style.display='block';
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.display='none',8000);
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity=1;
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.opacity=0,2600);
}

/* keyboard */
const heldKeys={};
addEventListener('keydown',e=>{
  if (document.getElementById('hud').classList.contains('hidden')) return;
  if (e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT')) return;
  const overlay=['exportScreen','regionScreen','planScreen']
    .map(id=>document.getElementById(id)).find(el=>!el.classList.contains('hidden'));
  if (overlay){ // an overlay is open: only Escape closes, game keys ignored
    if (e.key==='Escape') overlay.classList.add('hidden');
    return;
  }
  const k=e.key.toLowerCase();
  if (k==='e'||k===' '){ e.preventDefault(); actHere(); return; }
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
addEventListener('keyup',e=>{ delete heldKeys[e.key.toLowerCase()]; });

/* tap / click: first tap walks, tap on own tile acts */
let lastTap=0;
let sweep=null; // shovel drag-lift in progress: {plants, terr}
function sweepLift(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return;
  const k=`${x},${y}`, p=game.plants[k];
  if (p && !p.removed){
    game.plants[k]={removed:true,t:Date.now()};
    game.dirty=true; sweep.plants++;
    return;
  }
  const b3=game.bulbs[k]; // then the layer underneath
  if (b3 && !b3.removed){
    game.bulbs[k]={removed:true,t:Date.now()};
    game.dirty=true; sweep.bulbs++;
    return;
  }
  // bare ground: laid path/bed comes up instead
  if (tileTerrain(x,y)){
    game.terrain[k]={removed:true,t:Date.now()};
    game.dirty=true; sweep.terr++;
  }
}
function evTile(e){ // pointer position -> world tile, zoom-aware
  return tileAt(e.clientX/ZOOM, e.clientY/ZOOM, innerWidth/ZOOM, innerHeight/ZOOM);
}
/* two fingers pinch the zoom; everything else is one-finger business */
const activePtrs=new Map(); let pinch=null, toolDrag=null;
cnv.addEventListener('pointerdown',e=>{
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (activePtrs.size===2){
    const [a,b2]=[...activePtrs.values()];
    pinch={d0:Math.hypot(a[0]-b2[0],a[1]-b2[1])||1, z0:userZoom};
    sweep=null; toolDrag=null; game.pathTarget=null; game.sleepOnArrive=false;
    return;
  }
  if (activePtrs.size>1) return;
  const [x,y]=evTile(e);
  if (x<0||y<0||x>=GW||y>=GH) return;
  if (game.tool==='house'){ placeHouse(x,y); return; }
  if (game.tool==='shovel'){ // drag across the bed to lift plant after plant
    sweep={plants:0, bulbs:0, terr:0};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    sweepLift(x,y); return;
  }
  // plant/bulb/path/bed: press-and-drag paints tiles like the shovel
  // sweeps them; a plain tap (resolved at pointerup) walks or acts
  if (PLANTS[game.tool] || game.tool==='path' || game.tool==='bed'){
    toolDrag={sx:x, sy:y, active:false, count:0, what:null};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  tapAction(x,y);
});
function tapAction(x,y){ // the classic tap: walk there, act on your own tile
  if (inHouse(x,y)){ // tapping the house walks to the door, then sleeps
    const [dx2,dy2]=doorPos();
    game.pathTarget=[dx2,dy2]; game.sleepOnArrive=true; return; }
  game.sleepOnArrive=false;
  if (x===Math.round(game.px)&&y===Math.round(game.py)&&!game.moving){ actHere(); return; }
  game.pathTarget=[x,y];
}
function finishToolDrag(){
  if (!toolDrag || !toolDrag.active) return;
  if (toolDrag.count){
    syncToolLayer(toolDrag.what);
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    toast(toolDrag.what==='path' ? `Laid ${toolDrag.count} path tile${toolDrag.count>1?'s':''}.`
        : toolDrag.what==='bed'  ? `Dug ${toolDrag.count} bed tile${toolDrag.count>1?'s':''}.`
        : `Planted ${toolDrag.count} — ${def.name}.`);
  } else toast('Nothing would take along that line.');
}
cnv.addEventListener('pointermove',e=>{
  if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (pinch && activePtrs.size>=2){
    const [a,b2]=[...activePtrs.values()];
    setUserZoom(pinch.z0*(Math.hypot(a[0]-b2[0],a[1]-b2[1])||1)/pinch.d0);
    return;
  }
  const [x,y]=evTile(e);
  if (sweep){ sweepLift(x,y); return; }
  if (toolDrag){
    if (!toolDrag.active && (x!==toolDrag.sx||y!==toolDrag.sy)){
      toolDrag.active=true; // crossed a tile line: it's a paint-drag now
      const r0=applyToolAt(toolDrag.sx,toolDrag.sy);
      if (r0){ toolDrag.count++; toolDrag.what=r0; }
    }
    if (toolDrag.active){
      const r=applyToolAt(x,y);
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
  if (sweep.terr) parts.push(`${sweep.terr} path/bed tile${sweep.terr>1?'s':''}`);
  if (parts.length){
    toast(`Lifted ${parts.join(' and ')}.`);
    if (sweep.plants) syncPlantsOut();
    if (sweep.bulbs) syncBulbsOut();
    if (sweep.terr) syncTerrainOut();
  }
  else toast('Nothing under the shovel there.');
  sweep=null;
}
cnv.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  if (toolDrag){
    if (toolDrag.active) finishToolDrag();
    else tapAction(toolDrag.sx,toolDrag.sy);
    toolDrag=null;
  }
  endSweep();
});
cnv.addEventListener('pointercancel',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  sweep=null; toolDrag=null;
});
cnv.addEventListener('pointerleave',()=>{ game.hoverTile=null; });
function followPath(){
  if (!game.pathTarget||game.moving) return;
  const [gx,gy]=game.pathTarget;
  const cxp=Math.round(game.px), cyp=Math.round(game.py);
  if (cxp===gx&&cyp===gy){
    game.pathTarget=null;
    if (game.sleepOnArrive&&isDoor(gx,gy)) doSleep();
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
    gw:GW,gh:GH,rot:game.rot,house:game.house,
    plants:game.plants,bulbs:game.bulbs,terrain:game.terrain,
    startTs:game.startTs,dayOffset:game.dayOffset,char:game.char});
  const idx=(await worldsIndex()).filter(w=>w.id!==game.worldId);
  idx.push({id:game.worldId, name:game.worldName||'My garden', ts:Date.now(), gw:GW, gh:GH});
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
  game.plants=shiftKeys(s.plants||{},shift);
  game.bulbs=shiftKeys(s.bulbs||{},shift);
  game.terrain=shiftKeys(s.terrain||{},shift);
  game.house=s.house||defaultHouse();
  game.rot=s.rot||0;
  game.startTs=s.startTs||Date.now();
  game.dayOffset=s.dayOffset||0; if (s.char) game.char=s.char;
  game.worldName=s.name||'My garden';
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
  game.startTs=Date.now(); game.dayOffset=0;
  game.plants={}; game.bulbs={}; game.terrain={};
  setWorldSize(31,31); game.house=defaultHouse(); game.rot=0; game.houseT=Date.now();
  seedWalkway();
  await sSet(wkey('meta'),{startTs:game.startTs,gw:GW,gh:GH},true);
  await sSet(wkey('plants'),{},true);
  await sSet(wkey('bulbs'),{},true);
  await sSet(wkey('terrain'),game.terrain,true);
  await sSet(wkey('house'),{h:game.house,t:game.houseT},true);
}
async function joinWorld(code){
  game.code=code;
  const meta=await sGet(wkey('meta'),true);
  if (!meta){ toast('No garden found with that code.'); game.code=null; return false; }
  game.startTs=meta.startTs; game.dayOffset=0;
  setWorldSize(meta.gw||31, meta.gh||31); game.rot=0;
  const pl=await sGet(wkey('plants'),true); game.plants=pl||{};
  const bl=await sGet(wkey('bulbs'),true); game.bulbs=bl||{};
  const tr=await sGet(wkey('terrain'),true); game.terrain=tr||{};
  const ho=await sGet(wkey('house'),true);
  game.house=(ho&&ho.h)||defaultHouse(); game.houseT=(ho&&ho.t)||0;
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
async function syncBulbsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('bulbs'),true)||{};
  mergeMap(game.bulbs,remote);
  await sSet(wkey('bulbs'),game.bulbs,true);
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
  const remoteB=await sGet(wkey('bulbs'),true);
  if (remoteB) mergeMap(game.bulbs,remoteB);
  const ho=await sGet(wkey('house'),true);
  if (ho && ho.h && (ho.t||0)>game.houseT){ game.house=ho.h; game.houseT=ho.t; }
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
  for (const k in game.plants){ const p=game.plants[k]; if (!p.removed) live[k]=p; }
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
  const comps=planComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  const bulbsLive=Object.keys(game.bulbs).filter(k=>!game.bulbs[k].removed);
  const ids=[...new Set([
    ...comps.map(c=>c.s+'|'+(c.v||'')),
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
  ctx.fillText(`Planting plan · Hortus Perennis · ${new Date().toLocaleDateString()}`, padL, 56);
  ctx.fillText(`1 tile = ${TILE_IN}" · plot ${Math.round(GW*1.5)} × ${Math.round(GH*1.5)} ft`, padL, 70);
  // north arrow (world y points up-page on plans; our y+ is south)
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(W2-40,62); ctx.lineTo(W2-40,34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W2-40,30); ctx.lineTo(W2-45,42); ctx.lineTo(W2-35,42); ctx.closePath();
  ctx.fillStyle='#2c241c'; ctx.fill();
  ctx.font='10px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillText('N',W2-40,80);
  // terrain
  for (const k in game.terrain){ const t2=game.terrain[k];
    if (t2.removed) continue;
    const [x,y]=k.split(',').map(Number);
    ctx.fillStyle=t2.k==='path'?'#dccdaa':'#ebe2c9';
    ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
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
  // house
  const hh=game.house;
  if (hh){
    ctx.fillStyle='#e3ddd2'; ctx.strokeStyle='#4a4238'; ctx.lineWidth=1.6;
    ctx.fillRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    ctx.strokeRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    const [dX,dY]=doorPos();
    ctx.fillStyle='#4a4238';
    ctx.fillRect(X(dX)+cell*0.3,Y(dY)-2,cell*0.4,3);
    if (hh.w*cell>40){ ctx.font='10px IBM Plex Sans'; ctx.textAlign='center';
      ctx.fillText('HOUSE', X(hh.x)+hh.w*cell/2, Y(hh.y)+hh.h*cell/2+3); }
  }
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
function trayKeys(){ // grasses first (the matrix), then sedges, forbs, bulbs, woody
  const ord={grass:0, sedge:1, forb:2, bulb:3, shrub:4, tree:5};
  return PLANT_KEYS.filter(plantFits).sort((a,b)=>
    (ord[PLANTS[a].type]-ord[PLANTS[b].type]) || PLANTS[a].name.localeCompare(PLANTS[b].name));
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
  const n=PLANT_KEYS.filter(plantFits).length;
  toast(`${n} of ${PLANT_KEYS.length} species fit${game.region.eco?' the '+game.region.eco:''}${game.region.zone?', zone '+game.region.zone:''}.`);
  $('regionScreen').classList.add('hidden');
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
  {id:'grasses',  label:'Grasses',          types:['grass','sedge']},
  {id:'sunper',   label:'Sun Perennials',   types:['forb'], sunFilter:'full'},
  {id:'shadeper', label:'Shade Perennials', types:['forb','sedge'], sunFilter:'part'},
  {id:'bulbs',    label:'Bulbs',            types:['bulb']},
  {id:'shrubs',   label:'Shrubs',           types:['shrub']},
  {id:'trees',    label:'Trees',            types:['tree']},
  {id:'dig',      label:'Dig',              tools:['shovel']},
  {id:'landscape',label:'Landscape',        tools:['path','bed']},
  {id:'house',    label:'House',            tools:['house']},
];
function buildToolTray(){
  const tabs=document.getElementById('trayTabs'); tabs.innerHTML='';
  TRAY_CATS.forEach(c=>{
    const b=document.createElement('button');
    b.className='tab'+(game.trayCat===c.id?' sel':''); b.textContent=c.label;
    b.onclick=()=>{ game.trayCat=c.id; buildToolTray(); };
    tabs.appendChild(b);
  });
  const si=document.createElement('input'); // search within the open category
  si.id='traySearch'; si.type='search'; si.placeholder='search…';
  si.value=game.traySearch||'';
  si.oninput=()=>{ game.traySearch=si.value; applyTraySearch(); };
  tabs.appendChild(si);
  const dr=document.createElement('button'); // drift toggle, right-aligned
  dr.className='tab drift'+(game.drift?' sel':'');
  dr.textContent=game.drift?'✦ Drift':'Drift';
  dr.title='Plant in loose clusters of 3–7 — the Oudolf way';
  dr.onclick=()=>{ game.drift=!game.drift; buildToolTray();
    toast(game.drift?'Drift planting on — each planting stamps a natural cluster.'
                    :'Single planting.'); };
  tabs.appendChild(dr);
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat)||TRAY_CATS[0];
  if (cat.types){
    let keys=trayKeys().filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
    // if the filter took the selected species away, fall back sensibly
    const all=trayKeys();
    if (PLANTS[game.tool] && !all.includes(game.tool)){ game.tool=all[0]||'path'; game.toolVar=null; }
    // browsing plants disarms tap-action tools (house placement, shovel sweep)
    if ((game.tool==='house'||game.tool==='shovel') && keys.length){
      game.tool=keys[0]; game.toolVar=null; }
    if (!keys.length){
      const sp=document.createElement('span'); sp.className='tray-empty';
      sp.textContent='Nothing fits the region filter here.';
      tray.appendChild(sp);
    }
    const grouped={};
    keys.forEach(k=>{
      const P=PLANTS[k];
      // species sharing a group collapse into one button; the chip row
      // (renderCvRow) picks the species inside it
      if (P.group){
        if (grouped[P.group]) return;
        grouped[P.group]=true;
      }
      const rep = P.group && PLANTS[game.tool] && PLANTS[game.tool].group===P.group
        ? game.tool : k;
      const R=PLANTS[rep];
      const b=document.createElement('button');
      b.className='tool'+((P.group ? PLANTS[game.tool]&&PLANTS[game.tool].group===P.group
                                   : game.tool===k)?' sel':'');
      b.dataset.k=k; if (P.group) b.dataset.group=P.group;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const sc=Math.min(0.62, 36/(R.h||40));   // tall plants shrink to fit
      const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
      drawPlant(ctx2,24/sc,42/sc,rep,1,R.type==='bulb'?'Spring':'Summer',tileSeed(3,7),0,undefined,1);
      const sp=document.createElement('span');
      sp.textContent=P.group ? P.group[0].toUpperCase()+P.group.slice(1)
                             : P.name.split(' ').slice(0,2).join(' ');
      b.append(c,sp);
      b.onclick=()=>{ game.tool=rep; game.toolVar=null; refreshTray(); renderCvRow();
        const D=PLANTS[game.tool];
        toast(P.group ? `${cap(P.group)}s — pick a species above`
                      : `${D.name} — ${D.latin}${D.cv?' · cultivars above':''}`); };
      tray.appendChild(b);
    });
    renderCvRow(); applyTraySearch();
    return;
  }
  // tool categories: Landscape (path, bed), Dig (shovel), House.
  // A tool tab arms its first tool right away — RTS style.
  if (!cat.tools.includes(game.tool)){ game.tool=cat.tools[0]; game.toolVar=null; }
  renderCvRow();
  if (cat.tools.includes('path')||cat.tools.includes('bed')){
    [['path','Path','#bba98c','Path: stand on grass and act to lay gravel.'],
     ['bed','Bed','#54402f','Bed: stand on grass and act to dig a planting bed.']]
    .filter(([k])=>cat.tools.includes(k))
    .forEach(([k,label,colr,hint])=>{
      const b=document.createElement('button'); b.className='tool'+(game.tool===k?' sel':''); b.dataset.k=k;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const tc=c.getContext('2d'); tc.fillStyle=colr;
      tc.beginPath(); tc.moveTo(24,12); tc.lineTo(42,23); tc.lineTo(24,34); tc.lineTo(6,23);
      tc.closePath(); tc.fill();
      tc.fillStyle='rgba(0,0,0,0.18)';
      const rs=mulberry(k==='path'?11:23);
      for (let i=0;i<5;i++){ tc.beginPath();
        tc.ellipse(24+(rs()-0.5)*22, 23+(rs()-0.5)*10, 2,1.2,0,0,7); tc.fill(); }
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp);
      b.onclick=()=>{ game.tool=k; game.toolVar=null; refreshTray(); toast(hint); };
      tray.appendChild(b);
    });
  }
  if (cat.tools.includes('house')){
    // the House tab works like the plant tray: icon buttons in labeled
    // sections — Place, House size, Wall color, Roof color
    const hc=game.house||{wall:'#8a7a60',roof:'#9a5f3a'};
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
      ()=>{ game.tool='house'; game.toolVar=null; refreshTray();
        toast('Tap the map to set the house down — hover shows where.'); });
    pb.dataset.k='house';
    sep('House size');
    HOUSE_SIZES.forEach(([label,wf,df])=>{
      const sel=!!game.house && game.house.w===ftToTiles(wf) && game.house.h===ftToTiles(df);
      toolBtn(`${label} ${wf}'×${df}'`, sel,
        tc=>miniHouse(tc,wf,df,hc.wall,hc.roof),
        ()=>{ applyHouseSize(wf,df,label); buildToolTray(); });
    });
    sep('Wall color');
    WALL_COLS.forEach(([n,c2])=>{
      toolBtn(n, !!game.house && game.house.wall===c2,
        tc=>{ tc.fillStyle=c2; tc.fillRect(13,11,22,22);
          tc.strokeStyle='rgba(0,0,0,.3)'; tc.strokeRect(13,11,22,22); },
        ()=>{ paintHouse('wall',c2,n); buildToolTray(); });
    });
    sep('Roof color');
    ROOF_COLS.forEach(([n,c2])=>{
      toolBtn(n, !!game.house && game.house.roof===c2,
        tc=>{ tc.fillStyle=c2; tc.beginPath();
          tc.moveTo(8,32); tc.lineTo(24,12); tc.lineTo(40,32);
          tc.closePath(); tc.fill(); },
        ()=>{ paintHouse('roof',c2,n); buildToolTray(); });
    });
  }
  if (cat.tools.includes('shovel')){
    const sh=document.createElement('button'); sh.className='tool'+(game.tool==='shovel'?' sel':'');
    sh.dataset.k='shovel'; sh.innerHTML='<span style="font-size:20px;margin-bottom:8px">⛏</span><span>Shovel</span>';
    sh.onclick=()=>{ game.tool='shovel'; game.toolVar=null; refreshTray(); toast('Shovel: drag to lift plants — and bare paths or beds.'); };
    tray.appendChild(sh);
  }
}
function cap(s){ return s[0].toUpperCase()+s.slice(1); }
function applyTraySearch(){ // hide tray buttons that don't match the query
  const q=(game.traySearch||'').toLowerCase().trim();
  document.querySelectorAll('#toolTray .tool').forEach(b=>{
    const k=b.dataset.k, P=k&&PLANTS[k];
    let hay=k||'';
    if (P){ hay=P.name+' '+P.latin+' '+(P.group||'');
      if (P.group) PLANT_KEYS.forEach(k2=>{ if (PLANTS[k2].group===P.group)
        hay+=' '+PLANTS[k2].name+' '+PLANTS[k2].latin; }); }
    b.style.display=(!q||hay.toLowerCase().includes(q))?'':'none';
  });
}
function refreshTray(){
  const cur=PLANTS[game.tool];
  document.querySelectorAll('.tool').forEach(el=>
    el.classList.toggle('sel', el.dataset.group
      ? !!(cur && cur.group===el.dataset.group)
      : el.dataset.k===game.tool));
}
/* variant chips: species inside a group, and/or cultivars of the
   selected species. A chip is a (species, cultivar|null) pair. */
function renderCvRow(){
  const row=document.getElementById('cvRow'), P=PLANTS[game.tool];
  row.innerHTML='';
  if (game.tool==='house'){ // house options live in the tray itself now
    row.classList.add('hidden'); return;
  }
  if (!P || (!P.cv && !P.group)){ row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  const mk=(k,v,label,note)=>{
    const b=document.createElement('button');
    b.className='chip'+((game.tool===k && (game.toolVar||null)===v)?' sel':'');
    b.textContent=label; if (note) b.title=note;
    b.onclick=()=>{ game.tool=k; game.toolVar=v; refreshTray(); renderCvRow();
      const def=plantDef(k,v);
      toast(v?`${def.name} — ${note}`:`${def.name} — ${def.latin}`); };
    row.appendChild(b);
  };
  const members=P.group ? trayKeys().filter(k=>PLANTS[k].group===P.group) : [game.tool];
  members.forEach(k=>{
    const M=PLANTS[k];
    mk(k, null, M.group ? (M.chip||M.name) : 'Straight species');
    for (const v in (M.cv||{})) mk(k, v, M.cv[v].name, M.cv[v].note);
  });
}
let lastHint='', lastAct='';
function setHint(txt){ if (txt!==lastHint){ lastHint=txt;
  document.getElementById('actionHint').textContent=txt; } }
function setActButton(){ // the big mobile do-it button, labeled by context
  const px3=Math.round(game.px), py3=Math.round(game.py);
  let label=null;
  if (isDoor(px3,py3)) label='Sleep';
  else if (game.tool==='shovel') label='Dig here';
  else if (game.tool==='path') label='Lay path';
  else if (game.tool==='bed') label='Dig bed';
  else if (game.tool==='house') label=null;           // house places by tap
  else if (PLANTS[game.tool]) label=game.drift?'Plant a drift':'Plant here';
  const state=(baseZoom<1 && label) ? label : '';
  if (state!==lastAct){ lastAct=state;
    const b=document.getElementById('btnAct');
    b.classList.toggle('hidden',!state);
    if (state) b.textContent=state;
    // the big button replaces the instructional hint on phones
    document.getElementById('actionHint').classList.toggle('hidden',!!state);
  }
}
function updateHUD(){
  const cal=calClock();
  document.getElementById('seasonName').textContent=cal.season;
  document.getElementById('seasonDay').textContent=`Day ${cal.day} · Year ${cal.year}`;
  document.getElementById('dayBarFill').style.width=(cal.frac*100)+'%';
  setHint(game.tool==='house'
    ? 'Hover shows where the house lands — click to set it down'
    : game.tool==='shovel'
    ? 'Drag to lift plants — bare path and bed tiles clear too'
    : isDoor(Math.round(game.px),Math.round(game.py))
    ? 'At the door — press E or tap here to sleep'
    : 'Tap a tile to walk · tap again to act — or WASD + E');
  setActButton();
  const sd=absDay();
  if (sd!==game.lastDay){
    if (game.lastDay>=0 && sd%DAYS_PER_SEASON===0)
      toast(cal.season==='Spring'
        ? 'Spring. Last year is cut back — everything starts small and grows again.'
        : `${cal.season} begins. Watch the garden change.`);
    game.lastDay=sd;
    if (game.mode==='solo'&&hasStorage&&game.dirty){ saveSolo(true); game.dirty=false; }
  }
}

/* ---------- screens ---------- */
const $=id=>document.getElementById(id);
function show(id){ ['menuScreen','multiScreen','creatorScreen','codeScreen','plotScreen','worldsScreen'].forEach(s=>
  $(s).classList.toggle('hidden',s!==id)); }
let pendingMode=null;

$('btnSolo').onclick=()=>{ openWorlds(); };

/* the worlds screen: continue a saved garden or break new ground */
async function openWorlds(){
  const idx=await migrateLegacyWorld();
  if (!idx.length){ pendingMode='solo'; openCreator(); return; } // nothing saved yet
  const list=$('worldList'); list.innerHTML='';
  idx.sort((a,b)=>b.ts-a.ts).forEach(w=>{
    const row=document.createElement('button'); row.className='world-row';
    const info=document.createElement('span'); info.style.flex='1';
    const nm=document.createElement('span'); nm.className='wname'; nm.textContent=w.name||'My garden';
    const meta=document.createElement('span'); meta.className='meta';
    meta.textContent=`${Math.round((w.gw||31)*1.5)} × ${Math.round((w.gh||31)*1.5)} ft · last tended ${new Date(w.ts).toLocaleDateString()}`;
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
  if (idx.length) openWorlds(); else show('menuScreen');
}
$('btnNewWorld').onclick=()=>{ pendingMode='solo'; openCreator(); };
$('btnMulti').onclick=()=>{ if(!hasStorage){ toast('Shared gardens need storage, which this view lacks.'); return; } show('multiScreen'); };
$('btnHost').onclick=async()=>{ pendingMode='multi-host'; await hostWorld();
  $('codeDisplay').textContent=game.code; show('codeScreen'); };
$('btnCodeContinue').onclick=()=>openCreator();
$('btnJoin').onclick=async()=>{
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ toast('Enter the 5-character garden code.'); return; }
  if (await joinWorld(code)){ pendingMode='multi-join'; openCreator(); }
};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show('menuScreen'));

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
  if (pendingMode==='solo'){ game.mode='solo'; game.worldId=null;
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
  sizeCanvas(cnv);
  if (!game.house) game.house=defaultHouse();
  game.px=game.tx=SPAWNX; game.py=game.ty=SPAWNY; game.lastDay=absDay();
  snapCam(); // start the camera on the player instead of easing in
  buildToolTray();
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
      game.house=defaultHouse(); game.rot=0;
      game.startTs=Date.now(); game.dayOffset=0;
      game.plants={}; game.bulbs={}; game.terrain={};
      seedWalkway(); starterDrift(); enterGarden();
      saveSolo(true); // claim the slot right away
    };
    $('btnPlotBack').onclick=()=>{ game.mode=null; show('menuScreen'); };
  }
  $('plotW').value=46; $('plotL').value=46; $('plotName').value=''; updatePlotNote();
  show('plotScreen');
}
function quitToMenu(){
  if (game.mode==='solo'&&hasStorage) saveSolo();
  if (syncTimer){ clearInterval(syncTimer); syncTimer=null; }
  game.mode=null; game.others={}; game.pathTarget=null; game.sleepOnArrive=false;
  $('exportScreen').classList.add('hidden'); $('regionScreen').classList.add('hidden');
  $('planScreen').classList.add('hidden');
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden'); $('playersPill').classList.add('hidden');
  show('menuScreen');
}
$('btnMenu').onclick=quitToMenu;
$('btnZoomIn').onclick=()=>zoomBy(1.18);
$('btnZoomOut').onclick=()=>zoomBy(0.85);
/* no Save button: autosave covers day changes, quitting, and the tab
   being hidden or closed mid-session */
function autosaveNow(){ if (game.mode==='solo'&&hasStorage&&game.dirty){ saveSolo(true); game.dirty=false; } }
addEventListener('visibilitychange',()=>{ if (document.hidden) autosaveNow(); });
addEventListener('pagehide',autosaveNow);
$('btnSleep').onclick=doSleep;
$('btnExport').onclick=openExport;
$('btnExportClose').onclick=()=>$('exportScreen').classList.add('hidden');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;
$('btnRegion').onclick=openRegion;
$('btnRegionApply').onclick=applyRegion;
$('btnRegionClose').onclick=()=>$('regionScreen').classList.add('hidden');
$('btnRotate').onclick=rotateView;
$('btnPhoto').onclick=takePhoto;
$('btnPlan').onclick=openPlan;
$('btnPlanClose').onclick=()=>$('planScreen').classList.add('hidden');
$('btnPlanPng').onclick=downloadPlan;
$('btnPlanList').onclick=()=>{ $('planScreen').classList.add('hidden'); openExport(); };
$('btnAct').onclick=()=>actHere();

/* ---------- menu background: a living meadow ---------- */
const mcnv=$('menuCanvas'), mcx=mcnv.getContext('2d');
sizeCanvas(mcnv); sizeCanvas(cnv);
const meadow=[];
(function seedMeadow(){
  const keys=['karl','bluestem','echinacea','allium','dropseed','salvia','rattlesnake'];
  for (let i=0;i<46;i++) meadow.push({k:keys[i%keys.length], x:Math.random(),
    y:0.68+Math.random()*0.3, s:0.8+Math.random()*1.5, seed:(Math.random()*1e9)|0});
  meadow.sort((a,b)=>a.y-b.y);
})();
function menuRender(t){
  const W=innerWidth,H=innerHeight;
  const g=mcx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#3a2c3e'); g.addColorStop(0.55,'#7a5a52'); g.addColorStop(1,'#241a16');
  mcx.fillStyle=g; mcx.fillRect(0,0,W,H);
  // low sun
  mcx.fillStyle='rgba(228,170,100,0.25)';
  mcx.beginPath(); mcx.arc(W*0.74,H*0.42,90,0,7); mcx.fill();
  mcx.fillStyle='rgba(228,170,100,0.5)';
  mcx.beginPath(); mcx.arc(W*0.74,H*0.42,38,0,7); mcx.fill();
  const sway=Math.sin(t*0.0011);
  meadow.forEach(m=>{ mcx.save(); mcx.translate(m.x*W,m.y*H); mcx.scale(m.s,m.s);
    drawPlant(mcx,0,0,m.k,1,'Fall',m.seed,sway+Math.sin(t*0.0014+m.seed)*0.5,undefined,1); mcx.restore(); });
}

/* ---------- main loop ---------- */
let prev=performance.now(), keyCooldown=0;
function loop(t){
  const dt=Math.min(50,t-prev); prev=t;
  if (game.mode){
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
    followPath(); stepMove(dt); render(t); updateHUD();
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
  requestAnimationFrame(loop);
})();
