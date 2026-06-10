/* =====================================================
   HORTUS PERENNIS — an Oudolf-style 2.5D gardening game
   ===================================================== */
'use strict';

/* ---------- core constants ---------- */
const SEASONS = ['Spring','Summer','Fall','Winter'];
const DAYS_PER_SEASON = 16;
const DAY_MS = 20000;                 // 20 real seconds per garden day
const GRID = 31;                      // 31x31 plot (~46ft square at 18" tiles)
const SPAWN = (GRID-1)/2;             // players start at the plot's center
const TILE_W = 76, TILE_H = 38;
const TILE_IN = 18;                   // real-world inches per tile side (export sheet math)

/* Season ambience: sky gradient, grass tone, soil tone, light tint */
const AMBIENCE = {
  Spring:{sky:['#8aa4b8','#cfd8c2'], grass:['#7fa05e','#6f8f5a'], soil:'#5b4332', tint:'rgba(190,220,170,0.06)', snow:0},
  Summer:{sky:['#7d93a8','#b8c9a8'], grass:['#6f8f5a','#5d7a4c'], soil:'#54402f', tint:'rgba(255,240,180,0.05)', snow:0},
  Fall:  {sky:['#9a7d6e','#d9b98a'], grass:['#a78a4f','#8f7544'], soil:'#4e3a2b', tint:'rgba(255,170,90,0.08)', snow:0},
  Winter:{sky:['#6e7787','#cdd3d8'], grass:['#9b9484','#857f70'], soil:'#5a5048', tint:'rgba(200,215,235,0.10)', snow:1},
};

/* The Oudolf palette — PLANTS and PLANT_KEYS — lives in plants.js,
   which index.html loads before this file. */

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
function drawPlant(ctx, x, y, key, growth, season, seed, sway){
  const P = PLANTS[key], S = P.sea[season], rnd = mulberry(seed);
  const H = P.h * (0.25 + 0.75*growth);
  const mature = growth > 0.55;
  ctx.save(); ctx.translate(x, y);
  // soft ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 14*growth+6, 5*growth+2.5, 0, 0, 7); ctx.fill();

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
  else if (P.form === 'cone' || P.form === 'globe' || P.form === 'spike'){
    // basal foliage
    const fn = stemFor(8);
    ctx.strokeStyle = S.fol; ctx.lineWidth = 1.8;
    for (let i=0;i<fn;i++){ const a=(i/(fn-1)-0.5)*1.8, l=H*0.34;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.sin(a)*l*0.7,-l*0.5,Math.sin(a)*l,-l*0.55); ctx.stroke(); }
    // flower stems
    const sn = stemFor(P.form==='spike'?7:6);
    for (let i=0;i<sn;i++){
      const ox=(rnd()-0.5)*14, len=H*(0.75+rnd()*0.3), tx=ox+sway*len*0.05;
      ctx.strokeStyle = P.form==='spike' ? '#3a3038' : shade(S.fol,-18);
      ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(ox*0.4,0);
      ctx.quadraticCurveTo(ox,-len*0.55,tx,-len); ctx.stroke();
      if (!mature) continue;
      const hx=tx, hy=-len;
      if (P.form==='cone'){
        if (S.bloom){ // petals + cone
          ctx.strokeStyle=S.bloom; ctx.lineWidth=2.2;
          for(let p=0;p<7;p++){ const pa=p/7*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.lineTo(hx+Math.cos(pa)*6, hy+Math.sin(pa)*4.5+2.5); ctx.stroke(); }
          ctx.fillStyle=S.eye||'#b5651d';
          ctx.beginPath(); ctx.ellipse(hx,hy-1,3.2,3.6,0,0,7); ctx.fill();
        } else if (S.seed){ ctx.fillStyle=S.seed;
          ctx.beginPath(); ctx.ellipse(hx,hy,3,3.8,0,0,7); ctx.fill(); }
      }
      else if (P.form==='globe'){
        const col = S.bloom || S.seed;
        if (col){ ctx.fillStyle=col;
          ctx.beginPath(); ctx.arc(hx,hy,key==='allium'?5:4.2,0,7); ctx.fill();
          ctx.strokeStyle=shade(col,-30); ctx.lineWidth=0.7;
          for(let p=0;p<6;p++){ const pa=p/6*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(hx,hy);
            ctx.lineTo(hx+Math.cos(pa)*5.5,hy+Math.sin(pa)*5.5); ctx.stroke(); } }
      }
      else { // spike
        const col=S.bloom||S.seed;
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
    if (mature && (S.bloom||S.seed)){
      const col=S.bloom||S.seed, m=stemFor(7);
      for (let i=0;i<m;i++){
        const ox=(rnd()-0.5)*20, len=H*(0.85+rnd()*0.2);
        ctx.strokeStyle=shade(S.fol,-25); ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.moveTo(ox*0.5,0); ctx.lineTo(ox+sway*2,-len); ctx.stroke();
        ctx.fillStyle=col;
        if (key==='baptisia'&&season==='Spring'){ for(let s=0;s<4;s++){
          ctx.beginPath(); ctx.ellipse(ox+sway*2,-len+s*3.4,1.9,2.4,0,0,7); ctx.fill(); } }
        else if (key==='amsonia'&&season==='Spring'){ for(let p=0;p<5;p++){ const pa=p/5*Math.PI*2;
          ctx.beginPath(); ctx.ellipse(ox+sway*2+Math.cos(pa)*3,-len+Math.sin(pa)*3,1.3,1.3,0,0,7); ctx.fill(); } }
        else { ctx.beginPath(); ctx.arc(ox+sway*2,-len,key==='mountainmint'?3.4:2.6,0,7); ctx.fill(); }
      }
    }
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

/* ---------- the cottage renderer ---------- */
function drawHouse(ctx, W, H, season){
  const wH=46, rH=26;
  const T=screenOf(HOUSE.x,HOUSE.y,W,H);                 // north corner
  const R=screenOf(HOUSE.x+HOUSE.w,HOUSE.y,W,H);          // east
  const B=screenOf(HOUSE.x+HOUSE.w,HOUSE.y+HOUSE.h,W,H);  // south
  const L=screenOf(HOUSE.x,HOUSE.y+HOUSE.h,W,H);          // west
  // ridge runs along world-x over the middle of the footprint
  const M1=screenOf(HOUSE.x,HOUSE.y+HOUSE.h/2,W,H);
  const M2=screenOf(HOUSE.x+HOUSE.w,HOUSE.y+HOUSE.h/2,W,H);
  const g1=[M1[0],M1[1]-wH-rH], g2=[M2[0],M2[1]-wH-rH];
  const up=(p,h)=>[p[0],p[1]-h];
  const quad=(a,b,c,d,col)=>{ ctx.fillStyle=col; ctx.beginPath();
    ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]);
    ctx.closePath(); ctx.fill(); };
  // back roof face first, then the two camera-facing walls
  quad(up(T,wH),up(R,wH),g2,g1,HOUSE_COL.roofD);
  quad(L,B,up(B,wH),up(L,wH),HOUSE_COL.wall);    // southwest wall
  quad(B,R,up(R,wH),up(B,wH),HOUSE_COL.wallD);   // southeast wall
  // gable end on the southeast, then the front roof face
  ctx.fillStyle=HOUSE_COL.wallD; ctx.beginPath();
  ctx.moveTo(B[0],B[1]-wH); ctx.lineTo(R[0],R[1]-wH);
  ctx.lineTo(g2[0],g2[1]); ctx.closePath(); ctx.fill();
  quad(up(L,wH),up(B,wH),g2,g1,HOUSE_COL.roof);
  // door on the southwest wall, over the door tile
  const d1=screenOf(HOUSE.doorX+0.22,HOUSE.y+HOUSE.h,W,H);
  const d2=screenOf(HOUSE.doorX+0.78,HOUSE.y+HOUSE.h,W,H);
  quad(d1,d2,up(d2,26),up(d1,26),HOUSE_COL.door);
  ctx.strokeStyle=HOUSE_COL.trim; ctx.lineWidth=1.2; ctx.beginPath();
  ctx.moveTo(d1[0],d1[1]); ctx.lineTo(d1[0],d1[1]-26); ctx.lineTo(d2[0],d2[1]-26);
  ctx.lineTo(d2[0],d2[1]); ctx.stroke();
  // a warm window on the southeast wall
  const w1=screenOf(HOUSE.x+HOUSE.w,HOUSE.y+1.35,W,H);
  const w2=screenOf(HOUSE.x+HOUSE.w,HOUSE.y+0.75,W,H);
  quad(up(w1,16),up(w2,16),up(w2,32),up(w1,32),HOUSE_COL.glow);
  // snow blankets the roof in winter
  if (AMBIENCE[season].snow){
    quad(up(L,wH),up(B,wH),g2,g1,'rgba(240,244,250,0.75)');
    quad(up(T,wH),up(R,wH),g2,g1,'rgba(240,244,250,0.45)');
  }
}

/* ---------- world / state ---------- */
const game = {
  mode:null, code:null, playerId:null,
  char:{species:'cat', coatIdx:0, coat:COATS[0].c, coatD:COATS[0].d, mark:'solid', name:''},
  plants:{},          // "x,y" -> {s:key, d:absDayPlanted, t:ts} or {removed:true,t}
  terrain:{},         // "x,y" -> {k:'path'|'bed', t:ts} or {removed:true,t}
  startTs:Date.now(), dayOffset:0,
  px:SPAWN, py:SPAWN, tx:SPAWN, ty:SPAWN, moving:false, moveT:0, fromX:SPAWN, fromY:SPAWN,
  moveDur:170, pathTarget:null, sleepOnArrive:false,
  tool:PLANT_KEYS[0],
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
function plantGrowth(p){ // 0..1 over 10 garden days
  return Math.min(1,(absDay()-p.d)/10);
}
function tileSeed(x,y){ return (x*73856093 ^ y*19349663)>>>0; }

/* path through the garden — a lazy Oudolf curve */
function isPath(x,y){
  const c = Math.round(GRID/2 + Math.sin(x*0.55)*2.2);
  return y===c || y===c-1;
}

/* the cottage: a 2x2 footprint you can't walk through, with a door tile
   on its south side. Anyone — you or a visiting gardener — sleeps there
   to bring on the next day. Sited northeast of spawn, clear of the walkway. */
const HOUSE = {x:SPAWN+3, y:SPAWN-6, w:2, h:2, doorX:SPAWN+3, doorY:SPAWN-4};
const HOUSE_COL = {wall:'#8a7a60', wallD:'#6b5d4a', roof:'#9a5f3a', roofD:'#7a4a2e',
  door:'#3a2c22', trim:'#efe6d3', glow:'#d9c08a'};
function inHouse(x,y){ return x>=HOUSE.x && x<HOUSE.x+HOUSE.w && y>=HOUSE.y && y<HOUSE.y+HOUSE.h; }
function isDoor(x,y){ return x===HOUSE.doorX && y===HOUSE.doorY; }
function canStand(x,y){ return x>=0 && y>=0 && x<GRID && y<GRID && !inHouse(x,y); }

/* player-laid terrain (paths and beds) on top of the built-in walkway */
function tileTerrain(x,y){ const t=game.terrain[`${x},${y}`]; return (t&&!t.removed)?t.k:null; }

/* ---------- isometric math ---------- */
let cam = {x:0,y:0};
function isoX(x,y){ return (x-y)*TILE_W/2; }
function isoY(x,y){ return (x+y)*TILE_H/2; }
function screenOf(x,y,W,H){ return [W/2 + isoX(x,y) - cam.x, H*0.24 + isoY(x,y) - cam.y]; }
function tileAt(sx,sy,W,H){
  const rx = sx - W/2 + cam.x, ry = sy - H*0.24 + cam.y - TILE_H/2;
  const fx = (rx/(TILE_W/2) + ry/(TILE_H/2))/2;
  const fy = (ry/(TILE_H/2) - rx/(TILE_W/2))/2;
  return [Math.round(fx), Math.round(fy)];
}

/* ---------- main render ---------- */
const cnv = document.getElementById('gameCanvas');
const cx = cnv.getContext('2d');
let DPR = Math.min(2, window.devicePixelRatio||1);
function sizeCanvas(c){ c.width=innerWidth*DPR; c.height=innerHeight*DPR;
  c.getContext('2d').setTransform(DPR,0,0,DPR,0,0); }
addEventListener('resize', ()=>{ sizeCanvas(cnv); sizeCanvas(mcnv); });

let snowFlakes = [];
function render(t){
  const W=innerWidth, H=innerHeight, cal=calClock(), amb=AMBIENCE[cal.season];
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
  const x1=Math.min(GRID-1,Math.max(crn[0][0],crn[1][0],crn[2][0],crn[3][0])+2);
  const y0=Math.max(0,Math.min(crn[0][1],crn[1][1],crn[2][1],crn[3][1])-2);
  const y1=Math.min(GRID-1,Math.max(crn[0][1],crn[1][1],crn[2][1],crn[3][1])+2);

  // ground tiles back-to-front
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    const terr=tileTerrain(x,y);
    const path=isPath(x,y)||terr==='path';
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

  // depth-sorted entities: plants + critters + the cottage,
  // culled to the same visible window as the ground
  const ents=[];
  if (HOUSE.x+HOUSE.w-1>=x0 && HOUSE.x<=x1 && HOUSE.y+HOUSE.h-1>=y0 && HOUSE.y<=y1)
    ents.push({depth:(HOUSE.x+HOUSE.w-1)+(HOUSE.y+HOUSE.h-1)+0.45,
      draw:()=>drawHouse(cx,W,H,cal.season)});
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    ents.push({depth:x+y+0.3, draw:()=>{ const [sx,sy]=screenOf(x,y,W,H);
      drawPlant(cx,sx,sy+TILE_H/2,p.s,plantGrowth(p),cal.season,tileSeed(x,y),sway);}});
  }
  // local player (smooth move)
  let dx=game.px, dy=game.py;
  ents.push({depth:dx+dy+0.5, draw:()=>{ const [sx,sy]=screenOf(dx,dy,W,H);
    drawCritter(cx,sx,sy+TILE_H/2,game.char,t,game.moving,1);
    cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
    const nm=game.char.name||'You', wN=cx.measureText(nm).width;
    cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
    cx.fillStyle='#f3ecdd'; cx.textAlign='center'; cx.fillText(nm,sx,sy-31); }});
  // other gardeners
  for (const id in game.others){ const o=game.others[id];
    if (Date.now()-o.ts > 30000) continue;
    ents.push({depth:o.x+o.y+0.5, draw:()=>{ const [sx,sy]=screenOf(o.x,o.y,W,H);
      drawCritter(cx,sx,sy+TILE_H/2,{species:o.sp,coat:o.c,coatD:o.cd,mark:o.m},t,false,1);
      cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
      const wN=cx.measureText(o.n).width;
      cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
      cx.fillStyle='#cfe3c2'; cx.textAlign='center'; cx.fillText(o.n,sx,sy-31); }});
  }
  ents.sort((a,b)=>a.depth-b.depth).forEach(e=>e.draw());

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
  const existing = game.plants[k], hasPlant = existing && !existing.removed;
  const terr = tileTerrain(x,y);
  if (game.tool==='shovel'){
    if (hasPlant){
      game.plants[k]={removed:true,t:Date.now()}; game.dirty=true;
      toast('Lifted. Good divisions make free plants.'); syncPlantsOut(); }
    else if (terr){
      game.terrain[k]={removed:true,t:Date.now()}; game.dirty=true;
      toast(terr==='path'?'Path dug up.':'Bed turned back to grass.'); syncTerrainOut(); }
    else if (isPath(x,y)) toast('The old walkway stays — Oudolf would approve.');
    else toast('Nothing here to lift.');
    return;
  }
  if (game.tool==='path'||game.tool==='bed'){
    if (isPath(x,y)){ toast('Already a path.'); return; }
    if (hasPlant){ toast('Lift the plant first.'); return; }
    if (terr===game.tool){ toast(terr==='path'?'Already a path.':'Already a bed.'); return; }
    game.terrain[k]={k:game.tool,t:Date.now()}; game.dirty=true;
    toast(game.tool==='path'?'Path laid.':'Bed dug. Ready for planting.');
    syncTerrainOut();
    return;
  }
  if (isPath(x,y)||terr==='path'){ toast('The path stays a path — Oudolf would approve.'); return; }
  if (hasPlant){ showPlantCard(existing); return; }
  game.plants[k]={s:game.tool,d:absDay(),t:Date.now()}; game.dirty=true;
  toast(`Planted ${PLANTS[game.tool].name}. Plant in drifts of 3+!`);
  syncPlantsOut();
}
function doSleep(){
  game.dayOffset++; game.dirty=true;
  if (game.mode==='multi') toast('You napped in the cottage — a shared garden keeps its own clock.');
  else toast('You slept in the cottage. A new day.');
}
function showPlantCard(p){
  const P=PLANTS[p.s], g=Math.round(plantGrowth(p)*100), el=document.getElementById('plantCard');
  el.innerHTML=`<h3>${P.name}</h3><div class="latin">${P.latin}</div>
    <p>${P.blurb}</p><p style="margin-top:6px;color:#efe6d3">${g<100?`Establishing — ${g}% grown`:'Fully established'}</p>`;
  el.style.display='block';
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.display='none',5200);
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
  const ex=document.getElementById('exportScreen');
  if (!ex.classList.contains('hidden')){ // planting list open: only Escape closes
    if (e.key==='Escape') ex.classList.add('hidden');
    return;
  }
  const k=e.key.toLowerCase();
  if (k==='e'||k===' '){ e.preventDefault(); actHere(); return; }
  /* keys move in SCREEN directions: D is right on screen, W is up, etc.
     One key = a screen-cardinal step (a world diagonal); holding two keys
     combines into the world axes for screen-diagonal moves. */
  const map={w:[-1,-1],arrowup:[-1,-1],s:[1,1],arrowdown:[1,1],
             a:[-1,1],arrowleft:[-1,1],d:[1,-1],arrowright:[1,-1]};
  if (map[k]){ e.preventDefault(); heldKeys[k]=map[k]; }
});
addEventListener('keyup',e=>{ delete heldKeys[e.key.toLowerCase()]; });

/* tap / click: first tap walks, tap on own tile acts */
let lastTap=0;
cnv.addEventListener('pointerdown',e=>{
  const [x,y]=tileAt(e.clientX,e.clientY,innerWidth,innerHeight);
  if (x<0||y<0||x>=GRID||y>=GRID) return;
  if (inHouse(x,y)){ // tapping the cottage walks to the door, then sleeps
    game.pathTarget=[HOUSE.doorX,HOUSE.doorY]; game.sleepOnArrive=true; return; }
  game.sleepOnArrive=false;
  if (x===Math.round(game.px)&&y===Math.round(game.py)&&!game.moving){ actHere(); return; }
  // step one tile toward target repeatedly handled in loop via pathTarget
  game.pathTarget=[x,y];
});
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
async function saveSolo(){
  if (!hasStorage){ toast('No save storage here — garden lives this session only.'); return; }
  await sSet('hortus:solo',{grid:GRID,plants:game.plants,terrain:game.terrain,
    startTs:game.startTs,dayOffset:game.dayOffset,char:game.char});
  toast('Garden saved.');
}
function shiftKeys(m,d){ // translate every "x,y" key by +d on both axes
  if (!d) return m;
  const out={};
  for (const k in m){ const [x,y]=k.split(',').map(Number); out[`${x+d},${y+d}`]=m[k]; }
  return out;
}
async function loadSolo(){
  const s=await sGet('hortus:solo');
  if (!s) return false;
  // saves from before the world expansion were laid out around tile (6,6);
  // recenter them on the new, larger plot
  const shift = s.grid ? 0 : SPAWN-6;
  game.plants=shiftKeys(s.plants||{},shift);
  game.terrain=shiftKeys(s.terrain||{},shift);
  game.startTs=s.startTs||Date.now();
  game.dayOffset=s.dayOffset||0; if (s.char) game.char=s.char;
  return true;
}
async function saveChar(){ if (hasStorage) await sSet('hortus:char',game.char); }

/* multiplayer: shared keys w:CODE:meta / :plants / :players (visible to all artifact users with the code) */
function wkey(part){ return `hortus:w:${game.code}:${part}`; }
let syncTimer=null, presenceThrottle=0;
async function hostWorld(){
  game.code=Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join('');
  game.startTs=Date.now(); game.dayOffset=0; game.plants={}; game.terrain={};
  await sSet(wkey('meta'),{startTs:game.startTs},true);
  await sSet(wkey('plants'),{},true);
  await sSet(wkey('terrain'),{},true);
}
async function joinWorld(code){
  game.code=code;
  const meta=await sGet(wkey('meta'),true);
  if (!meta){ toast('No garden found with that code.'); game.code=null; return false; }
  game.startTs=meta.startTs; game.dayOffset=0;
  const pl=await sGet(wkey('plants'),true); game.plants=pl||{};
  const tr=await sGet(wkey('terrain'),true); game.terrain=tr||{};
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
  const counts={};
  for (const k in game.plants){ const p=game.plants[k];
    if (!p.removed && p.s) counts[p.s]=(counts[p.s]||0)+1; }
  return Object.keys(counts).map(s=>{
    const P=PLANTS[s], n=counts[s];
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

/* ---------- HUD / tool tray ---------- */
function buildToolTray(){
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  PLANT_KEYS.forEach(k=>{
    const b=document.createElement('button'); b.className='tool'+(game.tool===k?' sel':''); b.dataset.k=k;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const ctx2=c.getContext('2d'); ctx2.scale(0.62,0.62);
    drawPlant(ctx2,38,66,k,1,'Summer',tileSeed(3,7),0);
    const sp=document.createElement('span'); sp.textContent=PLANTS[k].name.split(' ').slice(0,2).join(' ');
    b.append(c,sp);
    b.onclick=()=>{ game.tool=k; refreshTray();
      const P=PLANTS[k]; toast(`${P.name} — ${P.latin}`); };
    tray.appendChild(b);
  });
  // terrain tools: lay a path, dig a bed
  [['path','Path','#bba98c','Path: stand on grass and act to lay gravel.'],
   ['bed','Bed','#54402f','Bed: stand on grass and act to dig a planting bed.']]
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
    b.onclick=()=>{ game.tool=k; refreshTray(); toast(hint); };
    tray.appendChild(b);
  });
  const sh=document.createElement('button'); sh.className='tool'+(game.tool==='shovel'?' sel':'');
  sh.dataset.k='shovel'; sh.innerHTML='<span style="font-size:20px;margin-bottom:8px">⛏</span><span>Shovel</span>';
  sh.onclick=()=>{ game.tool='shovel'; refreshTray(); toast('Shovel: lifts plants, paths, and beds where you stand.'); };
  tray.appendChild(sh);
}
function refreshTray(){ document.querySelectorAll('.tool').forEach(el=>
  el.classList.toggle('sel',el.dataset.k===game.tool)); }
let lastHint='';
function setHint(txt){ if (txt!==lastHint){ lastHint=txt;
  document.getElementById('actionHint').textContent=txt; } }
function updateHUD(){
  const cal=calClock();
  document.getElementById('seasonName').textContent=cal.season;
  document.getElementById('seasonDay').textContent=`Day ${cal.day} · Year ${cal.year}`;
  document.getElementById('dayBarFill').style.width=(cal.frac*100)+'%';
  setHint(isDoor(Math.round(game.px),Math.round(game.py))
    ? 'At the cottage door — press E or tap here to sleep'
    : 'Tap a tile to walk · tap again to act — or WASD + E');
  const sd=absDay();
  if (sd!==game.lastDay){
    if (game.lastDay>=0 && sd%DAYS_PER_SEASON===0)
      toast(`${cal.season} begins. Watch the garden change.`);
    game.lastDay=sd;
    if (game.mode==='solo'&&hasStorage&&game.dirty){ saveSolo(); game.dirty=false; }
  }
}

/* ---------- screens ---------- */
const $=id=>document.getElementById(id);
function show(id){ ['menuScreen','multiScreen','creatorScreen','codeScreen'].forEach(s=>
  $(s).classList.toggle('hidden',s!==id)); }
let pendingMode=null;

$('btnSolo').onclick=async()=>{ pendingMode='solo'; openCreator(); };
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
    drawPlant(pcx,40,168,'karl',1,'Fall',7,Math.sin(t*0.001));
    drawPlant(pcx,132,172,'echinacea',1,'Summer',13,Math.sin(t*0.001));
    drawCritter(pcx,86,168,game.char,t,false,2.1);
    pcx.restore();
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

$('btnStartGame').onclick=async()=>{
  game.char.name=$('petName').value.trim()||'Bramble';
  await saveChar();
  if (pendingMode==='solo'){ game.mode='solo';
    const had=await loadSolo();
    if (!had){ game.startTs=Date.now(); game.plants={}; game.terrain={}; starterDrift(); }
  } else {
    game.mode='multi';
    $('playersPill').classList.remove('hidden');
    $('worldPill').innerHTML=`Garden <b>${game.code}</b> · <button id="btnQuit2">Menu</button>`;
    $('btnQuit2').onclick=quitToMenu;
    syncTimer=setInterval(pollWorld,4000); pollWorld(); pushPresence();
  }
  enterGarden();
};
function starterDrift(){ // a welcoming drift near spawn so the world isn't empty
  const S=SPAWN;
  const picks=[['karl',S-3,S-3],['karl',S-2,S-3],['bluestem',S-3,S-2],
               ['echinacea',S+3,S+3],['echinacea',S+4,S+3],['dropseed',S+3,S+4]];
  picks.forEach(([s,x,y])=>{ if(!isPath(x,y)) game.plants[`${x},${y}`]={s,d:absDay()-10,t:Date.now()}; });
}
function enterGarden(){
  show(''); $('hud').classList.remove('hidden');
  cnv.classList.remove('hidden'); mcnv.classList.add('hidden');
  sizeCanvas(cnv);
  game.px=game.tx=SPAWN; game.py=game.ty=SPAWN; game.lastDay=absDay();
  // start the camera on the player instead of easing in from the plot corner
  cam.x=isoX(game.px,game.py); cam.y=isoY(game.px,game.py)-innerHeight*0.21;
  buildToolTray();
}
function quitToMenu(){
  if (game.mode==='solo'&&hasStorage) saveSolo();
  if (syncTimer){ clearInterval(syncTimer); syncTimer=null; }
  game.mode=null; game.others={}; game.pathTarget=null; game.sleepOnArrive=false;
  $('exportScreen').classList.add('hidden');
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden'); $('playersPill').classList.add('hidden');
  $('worldPill').innerHTML='Solo garden · <button id="btnSave">Save</button> <button id="btnQuit">Menu</button>';
  wireHudButtons(); show('menuScreen');
}
function wireHudButtons(){
  const s=$('btnSave'); if (s) s.onclick=saveSolo;
  const q=$('btnQuit'); if (q) q.onclick=quitToMenu;
}
wireHudButtons();
$('btnSleep').onclick=doSleep;
$('btnExport').onclick=openExport;
$('btnExportClose').onclick=()=>$('exportScreen').classList.add('hidden');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;

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
    drawPlant(mcx,0,0,m.k,1,'Fall',m.seed,sway+Math.sin(t*0.0014+m.seed)*0.5); mcx.restore(); });
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
        if (mx||my){ tryMove(Math.round(game.px)+mx,Math.round(game.py)+my); keyCooldown=40; }
      }
    }
    followPath(); stepMove(dt); render(t); updateHUD();
  } else menuRender(t);
  requestAnimationFrame(loop);
}
(async function init(){
  await ensurePlayerId();
  if (hasStorage){ const c=await sGet('hortus:char'); if (c) game.char=c; }
  requestAnimationFrame(loop);
})();
