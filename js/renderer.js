'use strict';

/* The ground (961 tiles, each a pile of fills/strokes/blades) is identical
   every frame unless the season, window, or terrain changes — yet repainting
   it was the entire frame cost (~12ms). So bake it once to a WORLD-ANCHORED
   offscreen layer sized viewport + margin, keyed WITHOUT the camera or zoom:
   the camera is a pure screen translation (viewScreen subtracts cam), so a
   pan frame is one integer-offset drawImage instead of a repaint (measured
   65% of a panning frame before this). Rebake when the data/season/rot/size
   key changes, when the camera leaves the baked margin, or — settle passes —
   ~140ms after the last zoom tick (mid-gesture frames scale-blit the stale
   bake: briefly soft, never slow) and ~180ms after a pan ends (so a resting
   frame is always freshly rasterized, never a resampled blit). Trade-off:
   water ripples freeze except at rebakes (they already froze on a still view). */
let groundCanvas=null, groundCtx=null, groundKey='', groundKeyStruct='', groundRefs={terrain:null,elevation:null,houses:null};
let underlayImage={src:null,img:null,ready:false,error:false};
let groundCamX=0, groundCamY=0, groundZoom=1;          // camera/zoom at bake time
let groundZoomPrev=-1, groundZoomT=-1e9;               // last zoom tick, for settle
let groundCamPrevX=NaN, groundCamPrevY=NaN, groundCamT=-1e9; // last cam tick, for settle
const GROUND_MARGIN_CSS=200;    // pan headroom baked around the viewport, CSS px
const GROUND_ZOOM_SETTLE=140;   // ms after the last zoom tick before the crisp rebake
const GROUND_PAN_SETTLE=180;    // ms after the last cam move before the crisp rebake
const GROUND_ZOOM_IN_MAX=1.6;   // mid-gesture rebake once a zoom IN magnifies the stale bake this far
/* Edit settle: the shortest gap between two authoritative bakes while the
   gardener is painting. 90ms is ~11 authoritative updates a second — fast
   enough that organic edges look like they are following the brush, slow
   enough to drop ~5 of every 6 bakes out of a 60fps stroke. Raising it makes
   strokes cheaper and the smoothing laggier; that is the only trade here. */
const GROUND_EDIT_SETTLE=90;
/* Past this many pending tiles the overlay stops being cheaper than the bake it
   is deferring, so bake instead. It is also what keeps a flood fill — thousands
   of tiles in one gesture — on the immediate path. */
const GROUND_DAMAGE_CAP=400;
let groundEditT=-1e9;           // last data-driven bake — the rate-limit anchor
let groundDamageT=-1e9;         // last frame that saw pending damage — the burst detector
/* Should this frame DEFER its bake and let drawGroundDamage stand in?

   Extracted from render so the policy has a name and can be unit-tested — the
   test harness stubs the canvas, so anything that reaches a real gradient
   cannot run headless, and this decision is the part worth pinning down.

   The leading edge is anchored to the last EDIT, not the last bake. Anchoring
   it to the bake looks equivalent and is not: it leaves a settle-long dead zone
   after every bake, so an isolated tap landing inside one gets deferred and
   pops ~90ms later. `newBurst` asks the question that actually matters — is
   this the first edit after a quiet moment — so discrete taps stay immediate at
   any cadence and only a genuine stroke is rate-limited.

   Deferral needs every changed tile to be known and cheap to cover: nothing
   unlocated (undo/load/elevation/houses set groundDamageFull), a non-empty set
   under the cap, and an unchanged STRUCT key. Everything else bakes now — which
   is also what keeps an external `groundKey=''` (stressGarden, perfBench)
   forcing one. */
function groundEditThrottled(t, keyChanged, structMatches){
  const hasDamage = groundDamage.size>0 && !groundDamageFull;
  const newBurst = hasDamage && t-groundDamageT>GROUND_EDIT_SETTLE;
  if (hasDamage) groundDamageT=t;      // "the gardener is still painting"
  return !!(keyChanged && hasDamage && groundDamage.size<=GROUND_DAMAGE_CAP
    && structMatches && !newBurst && t-groundEditT<GROUND_EDIT_SETTLE);
}
/* Does a zoom still in progress need the ground baked NOW, rather than at the
   settle? Only when the scaled old bake would leave ground missing on screen,
   or a zoom IN has magnified it past GROUND_ZOOM_IN_MAX and it has gone soft.

   It replaced a flat 18% drift from the baked zoom, and a mouse wheel moves
   12% a notch, so every second notch was a full bake: measured on a 261-plant
   garden at 2114x1241 in Chrome, 13-15 of them in one wheel gesture, each
   roughly 100ms of GPU raster. Zooming OUT is the case that needed the
   question asked properly. The minified bake shrinks towards the zoom anchor
   and stops covering the screen after ~16%, but whatever it no longer covers
   is only a gap if there is ground there: once the whole plot sits inside the
   bake, the gap is sky, which the sky pass has already painted.

   Asked in DEVICE pixels with the blit's own arithmetic — the space the blit
   happens in. The 0.8.39 note in CLAUDE.md is about asking a containment
   question in tile space instead, and what that cost. */
function groundZoomDriftDue(MD){
  if (!groundCanvas || !(groundZoom>0)) return true;
  const k=ZOOM/groundZoom;
  if (k>GROUND_ZOOM_IN_MAX) return true;
  const bdx=DPR*VW/2*(1-k) - k*MD + DPR*ZOOM*(groundCamX-cam.x);
  const bdy=DPR*VH*0.24*(1-k) - k*MD + DPR*ZOOM*(groundCamY-cam.y);
  const bw=groundCanvas.width*k, bh=groundCanvas.height*k;
  if (bdx<=0 && bdy<=0 && bdx+bw>=cnv.width && bdy+bh>=cnv.height) return false;
  const g=plotGroundExtentDevice();
  return !(g.x0>=bdx && g.y0>=bdy && g.x1<=bdx+bw && g.y1<=bdy+bh);
}
/* The screen box, in device pixels, that the plot's ground can occupy at the
   current camera: the four corner tiles' diamonds, padded for terraces lifted
   above them, faces and hollows hanging below, and edging reaching past a tile.
   Generous on purpose — too big only means a bake that could have waited. */
function plotGroundExtentDevice(){
  const W=VW/ZOOM, H=VH/ZOOM, s=DPR*ZOOM;
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for (const c of [[0,0],[GW-1,0],[0,GH-1],[GW-1,GH-1]]){
    const p=screenOfFlat(c[0],c[1],W,H);
    if (p[0]<x0) x0=p[0]; if (p[0]>x1) x1=p[0];
    if (p[1]<y0) y0=p[1]; if (p[1]>y1) y1=p[1];
  }
  const lift=ELEV_MAX*ELEV_STEP, drop=-ELEV_MIN*ELEV_STEP;
  return {x0:(x0-TILE_W)*s, x1:(x1+TILE_W)*s,
          y0:(y0-TILE_H-lift)*s, y1:(y1+TILE_H*2+drop+lift)*s};
}
/* The STRUCT half of the ground key: everything that makes a whole new picture. */
function groundStructKey(season,rot){
  return season+'|'+rot+'|'+game.edgeStyle+'|'+(layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height;
}
// two struct keys that differ in nothing but the season
function groundSeasonOnly(a,b){
  return a!==b && a.slice(a.indexOf('|'))===b.slice(b.indexOf('|'));
}
/* ---------- the next ground picture, baked a band at a time ----------
   A full bake is ~100ms of GPU raster at 2114x1241 in Chrome — the grain is
   thousands of small fills, which is what it is for — and three things asked
   for one on a frame the gardener was watching: a season turn, a rotation,
   and the settle at the end of every zoom. Each can instead be baked into a
   SECOND canvas, one horizontal band per frame, and swapped in whole. A band
   is a clipped strip through bakeGroundRect, the path a pan already scrolls
   strips in by, so there is no new way of painting the ground to get wrong.
     zoom   - after the settle, the soft stale bake stays on screen while the
              crisp one fills in behind it;
     season - while the clock runs towards a season boundary, or a Skip is
              pending or likely, the next season is baked ahead of it; a turn
              nothing got ahead of keeps the old season's ground until the new
              one is ready (under a crossfade; a Skip waits for it instead);
     rot    - once the view is idle, the NEXT rotation — the button and R both
              turn one way — at the camera rotateView will snap to.
   A job is a promise about one picture: season, rotation, zoom, camera,
   ground data and layer objects, canvas size. If any of those moves it is
   dropped, and one on a stale footing is never swapped in. */
// Four columns per row keep an individual preparation step small enough to
// yield between tiles of work, even on a wide viewport. `band` counts chunks.
const GROUND_JOB_COLS=4, GROUND_JOB_ROWS=12;
const GROUND_JOB_BANDS=GROUND_JOB_COLS*GROUND_JOB_ROWS;
const GROUND_SEASON_LEAD_MS=1500;   // bake the next season this long, in real time, before it arrives
const GROUND_IDLE_MS=600;           // quiet this long before pre-baking the next rotation
let groundJob=null, groundSpare=null, groundSpareCtx=null;
function groundJobDone(){ return !!groundJob && groundJob.band>=GROUND_JOB_BANDS; }
function groundJobValid(MD){
  const j=groundJob;
  return !!j && j.data===groundDataKey() && j.zoom===ZOOM && j.MD===MD
    && j.w===cnv.width+2*MD && j.h===cnv.height+2*MD
    && j.refs.terrain===game.terrain && j.refs.elevation===game.elevation && j.refs.houses===game.houses
    && j.struct===groundStructKey(j.season,j.rot);    // edge style, landscape layer, canvas size
}
/* Keep a valid job already heading for this picture; otherwise start one. The
   camera is not part of "the same picture": a job baked at another camera is
   still the right ground, and the pan logic scrolls it into place. */
function ensureGroundJob(why,season,rot,camX,camY,MD){
  const struct=groundStructKey(season,rot);
  if (groundJob && groundJob.struct===struct && groundJobValid(MD)){ groundJob.why=why; return; }
  const w=cnv.width+2*MD, h=cnv.height+2*MD;
  if (!groundSpare){ groundSpare=document.createElement('canvas'); groundSpareCtx=groundSpare.getContext('2d'); }
  if (groundSpare.width!==w || groundSpare.height!==h){ groundSpare.width=w; groundSpare.height=h; }
  groundJob={why, season, rot, struct, data:groundDataKey(), zoom:ZOOM, camX, camY, MD, w, h,
    refs:{terrain:game.terrain,elevation:game.elevation,houses:game.houses}, band:0};
}
/* Bake the next `n` chunks of the job into the spare canvas. The camera and the
   rotation are borrowed for the call and put back in a finally — the
   gsBorrowCamera pattern — because the ground painters read both; the season
   travels in `amb`, which is all they read of it. */
function stepGroundJob(t,n){
  const j=groundJob; if (!j) return;
  const tB=dnow();
  const W=VW/ZOOM, H=VH/ZOOM, amb=AMBIENCE[j.season], s=DPR*ZOOM;
  const bw=Math.ceil(j.w/GROUND_JOB_COLS), bh=Math.ceil(j.h/GROUND_JOB_ROWS);
  const cx0=cam.x, cy0=cam.y, r0=game.rot;
  cam.x=j.camX; cam.y=j.camY; game.rot=j.rot;
  try{
    for (let i=0; i<n && j.band<GROUND_JOB_BANDS; i++, j.band++){
      const px=(j.band%GROUND_JOB_COLS)*bw, py=Math.floor(j.band/GROUND_JOB_COLS)*bh;
      if (px<j.w && py<j.h)
        bakeGroundRect(px,py,Math.min(bw,j.w-px),Math.min(bh,j.h-py),W,H,amb,t,j.MD,5,j.MD/s,groundSpareCtx);
    }
  } finally { cam.x=cx0; cam.y=cy0; game.rot=r0; }
  dev('bakeBand',tB,groundSpareCtx);
}
// swap the finished picture in; the old canvas becomes the next job's spare
function adoptGroundJob(t){
  const j=groundJob;
  const oc=groundCanvas, ox=groundCtx;
  groundCanvas=groundSpare; groundCtx=groundSpareCtx; groundSpare=oc; groundSpareCtx=ox;
  groundKey=j.struct+'|'+j.data; groundKeyStruct=j.struct; groundZoom=j.zoom;
  groundCamX=j.camX; groundCamY=j.camY; groundRefs=j.refs;
  groundMarginStale=false; clearGroundDamage(); groundEditT=t;
  noteGroundBaked();    // a job is dropped the moment the data moves, so this is the ground it baked
  groundJob=null;
  dev('adopt',performance.now());
}
/* The season the clock is about to turn into, and the garden-ms instant it
   does, when that is under GROUND_SEASON_LEAD_MS away in REAL time at the rate
   the clock is running. Null when it is not running, so a paused planner
   bakes nothing ahead — unless a Skip is pending or likely (skipAheadTarget,
   ui.js), which names its own destination and is answered first. */
function seasonTurnAhead(){
  const sk=skipAheadTarget(); if (sk) return sk;
  const clock=clockActive(), ff=!!game.ffActive;
  if (!clock && !ff) return null;
  const rate=(ff?FF_RATE:0)+(clock?1:0);
  const d=absDay(), s=Math.floor(d/DAYS_PER_SEASON)+1;
  const at=(s*DAYS_PER_SEASON-game.dayOffset)*DAY_MS;
  return (at-elapsedGameMs())/rate<=GROUND_SEASON_LEAD_MS ? {season:SEASONS[((s%4)+4)%4], at} : null;
}
/* Quiet in both senses: the picture has not changed, and nobody has touched
   anything. The second is its own clock (lastInputAt, screens.js) since input
   stopped counting as a change to the picture. */
function groundViewIdle(t){
  return !game.ffActive && typeof lastMeaningfulChange!=='undefined' && t-lastMeaningfulChange>GROUND_IDLE_MS
    && !(typeof lastInputAt!=='undefined' && t-lastInputAt<=GROUND_IDLE_MS)
    && !(typeof hasActiveGesture==='function' && hasActiveGesture());
}
/* Once a frame, after the blit: queue work nothing is waiting for yet (the
   next season, the next rotation), then bake one band of whatever is queued.
   Work a frame IS waiting for (a zoom settle, a season already turned) was
   queued by render itself and is never displaced by a guess. */
function groundJobTick(t,MD,season,ahead){
  if (!groundJob || groundJob.why==='ahead' || groundJob.why==='rot'){
    if (ahead) ensureGroundJob('ahead',ahead.season,game.rot,cam.x,cam.y,MD);
    else if (groundViewIdle(t)){
      const r=(game.rot+1)%4, c=snapCamFor(r);
      ensureGroundJob('rot',season,r,c[0],c[1],MD);
    }
  }
  if (groundJob && !groundJobDone() && groundJobValid(MD)){
    if (ahead) prepareGroundWithinBudget(t,AHEAD.budget/2);
    else stepGroundJob(t,GROUND_JOB_COLS);
  }
}
// Ground and sprites spend the SAME preparation allowance. A single canvas
// operation cannot be interrupted; check the clock again after every chunk.
function prepareGroundWithinBudget(t,limit){
  while (!groundJobDone() && groundJob && AHEAD.ms<limit){
    const start=performance.now();
    stepGroundJob(t,1);
    AHEAD.ms+=performance.now()-start;
  }
}
/* Readiness belongs to a complete destination view, never to elapsed time or
   the absence of attempts after the speculative cache hit its memory limit. */
function skipPrepared(p){
  return !!skipPreparation && skipPreparation.p===p && skipPreparation.ready;
}
function groundDataKey(){ return game.groundRev+'|'+GW+'x'+GH; }
function terrainRegionKey(){ return game.terrainRev+'|'+GW+'x'+GH; }
function groundRefsChanged(){
  return groundRefs.terrain!==game.terrain || groundRefs.elevation!==game.elevation
    || groundRefs.houses!==game.houses;
}
function currentUnderlayImage(){
  const u=game.underlay;
  if (!u || !u.data) return null;
  if (underlayImage.src!==u.data){
    const img=new Image();
    underlayImage={src:u.data,img,ready:false,error:false};
    img.onload=()=>{ if (underlayImage.img===img) underlayImage.ready=true; };
    img.onerror=()=>{ if (underlayImage.img===img) underlayImage.error=true; };
    img.src=u.data;
  }
  return underlayImage.ready && !underlayImage.error ? underlayImage.img : null;
}
// The reference is composited above the opaque grass cache but below every
// plant, structure, selection, and analysis overlay. At its deliberately low
// opacity it remains traceable without hiding finished design objects.
function drawSiteUnderlay(ctx,W,H){
  const u=game.underlay, img=u&&u.visible&&currentUnderlayImage();
  if (!u || !img) return;
  const {w,h}=underlaySize(u), rad=(+u.rotation||0)*Math.PI/180;
  const c=screenOfFlat(u.cx,u.cy,W,H), x1=screenOfFlat(u.cx+1,u.cy,W,H), y1=screenOfFlat(u.cx,u.cy+1,W,H);
  const vx=[x1[0]-c[0],x1[1]-c[1]], vy=[y1[0]-c[0],y1[1]-c[1]];
  const ex=[vx[0]*Math.cos(rad)+vy[0]*Math.sin(rad),vx[1]*Math.cos(rad)+vy[1]*Math.sin(rad)];
  const ey=[-vx[0]*Math.sin(rad)+vy[0]*Math.cos(rad),-vx[1]*Math.sin(rad)+vy[1]*Math.cos(rad)];
  const corners=[screenOfFlat(-0.5,-0.5,W,H),screenOfFlat(GW-0.5,-0.5,W,H),
    screenOfFlat(GW-0.5,GH-0.5,W,H),screenOfFlat(-0.5,GH-0.5,W,H)];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(corners[0][0],corners[0][1]);
  corners.slice(1).forEach(p=>ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.clip();
  ctx.globalAlpha=u.opacity;
  ctx.translate(c[0],c[1]);
  ctx.transform(ex[0],ex[1],ey[0],ey[1],0,0);
  ctx.drawImage(img,-w/2,-h/2,w,h);
  ctx.restore();
  if (game.photoEditing){
    const worldCorner=(lx,ly)=>{
      const wx=u.cx+lx*Math.cos(rad)-ly*Math.sin(rad), wy=u.cy+lx*Math.sin(rad)+ly*Math.cos(rad);
      return screenOfFlat(wx,wy,W,H);
    };
    const q=[worldCorner(-w/2,-h/2),worldCorner(w/2,-h/2),worldCorner(w/2,h/2),worldCorner(-w/2,h/2)];
    ctx.save(); ctx.strokeStyle='#72c9ff'; ctx.lineWidth=2.5; ctx.setLineDash([7,5]);
    ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); q.slice(1).forEach(p=>ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle='#172733';
    q.forEach(p=>{ ctx.beginPath(); ctx.arc(p[0],p[1],4.5,0,7); ctx.fill(); }); ctx.restore();
    const points=game.underlayCalibration&&game.underlayCalibration.points;
    if (points&&points.length){
      const ps=points.map(p=>screenOfFlat(p[0],p[1],W,H));
      ctx.save(); ctx.strokeStyle='#f4c66a'; ctx.fillStyle='#172733'; ctx.lineWidth=3; ctx.setLineDash([]);
      if (ps.length>1){ ctx.beginPath(); ctx.moveTo(ps[0][0],ps[0][1]); ctx.lineTo(ps[1][0],ps[1][1]); ctx.stroke(); }
      ps.forEach((p,i)=>{ ctx.beginPath(); ctx.arc(p[0],p[1],7,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#f4c66a'; ctx.font="700 10px 'IBM Plex Sans', sans-serif"; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(i+1),p[0],p[1]); ctx.fillStyle='#172733'; });
      ctx.restore();
    }
  }
}
const smoothableTerrain = t2 => t2==='path'||t2==='bed'||t2==='water'||t2==='lawn';
/* The level a tile counts as when its material is traced: a soft tile counts as
   grade (0.9.156). A berm is shaped from the ground round it, so a bed laid over
   a berm and on past its foot is ONE bed, drawn over the slope (paintTerrainBlobs
   projects it through groundHeightAt), and not a bed cut at every level. */
function regionLevelAt(x,y){ return isSoftTile(x,y) ? 0 : (elevationAt(x,y)||0); }
/* Under organic edges a terrain tile paints a whole grass tile, bevel and blades
   included, and the region silhouette then covers it. Where all eight neighbours
   are terrain at the same height nothing of that grass can ever show, so the tile
   lays a flat base instead: 443 of 656 terrain tiles on a measured garden, and a
   full bake went 137ms -> 111ms in Firefox with 0 pixels changed. The base stays
   rather than going altogether, so a hairline between two regions shows grass and
   not the sky behind the canvas.
   The tile ring round the plot is never inner: its outer edge has no neighbour to
   be covered by. Rides terrainRev like elevationGrid, which an elevation edit also
   raises, with the lot shape and the map identity alongside. */
let innerTerrainCache={rev:-1, plot:-1, ref:null, gw:-1, gh:-1, g:null};
function innerTerrainGrid(){
  const c=innerTerrainCache, src=game.terrain;
  if (c.rev===game.terrainRev && c.plot===game.plotRev && c.ref===src && c.gw===GW && c.gh===GH) return c.g;
  const laid=new Uint8Array(GW*GH), g=new Uint8Array(GW*GH), E=elevationGrid();
  let level=E.g;
  if (E.anySoft){ level=Int8Array.from(E.g); for (let i=0;i<level.length;i++) if (E.soft[i]) level[i]=0; }
  for (const k in src){ const t=src[k];
    if (!t || t.removed || !smoothableTerrain(t.k)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (x>=0 && y>=0 && x<GW && y<GH && onPlot(x,y)) laid[y*GW+x]=1;
  }
  const ring=[-GW-1,-GW,-GW+1,-1,1,GW-1,GW,GW+1];
  for (let y=1;y<GH-1;y++) for (let x=1;x<GW-1;x++){
    const i=y*GW+x; if (!laid[i]) continue;
    let inner=1;
    for (let d=0;d<8;d++){ const n=i+ring[d]; if (!laid[n] || level[n]!==level[i]){ inner=0; break; } }
    g[i]=inner;
  }
  innerTerrainCache={rev:game.terrainRev, plot:game.plotRev, ref:src, gw:GW, gh:GH, g};
  return g;
}
/* One tile of ground. Extracted from paintGround's inner loop so the damage
   overlay (drawGroundDamage) paints a pending tile through the SAME code the
   bake will use for it a moment later — the two can't drift apart.
   `organic` false forces the per-tile material rendering, which is what the
   overlay wants: it is standing in for a blob that has not been traced yet. */
// plain lawn at grade, where a raised tile stands (paintGround's first pass)
function paintGradeUnder(ctx,x,y,W,H,amb){
  const [gx,gy]=screenOfFlat(x,y,W,H), rg=mulberry(tileSeed(x,y));
  drawGroundTexture(ctx,gx,gy,x,y,null,false,amb,shade(amb.grass[(x+y)%2],(rg()-0.5)*14),rg,null);
}
function paintGroundTile(ctx,x,y,W,H,amb,showLand,organic){
  if (isSoftTile(x,y)){ paintSoftTile(ctx,x,y,W,H,amb,showLand,organic); return; }
  const [sx,sy]=screenOf(x,y,W,H);
  const terrObj=showLand?terrainAt(x,y):null, terrRaw=terrObj&&terrObj.k;
  const terr = (organic && smoothableTerrain(terrRaw)) ? null : terrRaw;  // organic: grass base under blobs
  const buried = organic && smoothableTerrain(terrRaw) && innerTerrainGrid()[y*GW+x]===1;
  const path=terr==='path';
  const water=terr==='water';
  const rs=mulberry(tileSeed(x,y));
  let col;
  if (water) col = waterFill(terrObj,amb.snow);
  else if (path) col = pathFill(terrObj,amb.snow);
  else if (showLand && isDoor(x,y)) col = amb.snow?'#aaa49a':'#a89a80';   // flagstone doorstep
  // A bed's base tone no longer varies per tile. The old +-12 was carrying
  // all of a bed's unevenness, and it could get away with it because the tile
  // bevel hid where one tile stopped; with the bevel gone under a material
  // (see drawGroundTexture) any per-tile jitter reads as flat diamond
  // patches, and the grain supplies the unevenness now. The rs() draw is kept
  // so the grain scatter below sits at the same point in the tile's stream.
  else if (terr==='bed'){ rs(); col = bedFill(terrObj,amb); }
  /* No rs() draw here, unlike the bed above: that one exists to hold the point
     in the tile's stream where the old per-tile jitter used to sit, and a lawn
     material has no such history to preserve. */
  else if (terr==='lawn') col = lawnFill(terrObj,amb);
  else col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14);
  // a raised bed's bed and wall are drawn along its own curve, not tile by tile;
  // what is under it is paintGradeUnder's
  if (organic && elevationAt(x,y)>0){
    const rbt=raisedBedTiles();
    if (rbt && rbt.has(x+','+y)) return;
  }
  /* A bank under a bed or a path is earth. In an organic garden `col` is the
     grass laid under the blob, so a soil-topped bank showed green sides. */
  drawElevationSides(ctx,W,H,x,y,(organic && (terrRaw==='bed'||terrRaw==='path') && amb.soil) ? amb.soil : col);
  if (water) drawWaterTexture(ctx,sx,sy,x,y,terrObj,amb);
  else if (buried){ isoDiamondPath(ctx,sx,sy,0); ctx.fillStyle=col; ctx.fill(); }
  else drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,col,rs,terrObj);
  drawElevationRim(ctx,sx,sy,elevationAt(x,y));
  if (!organic && terr) drawTileEdging(ctx,W,H,x,y);   // (ctx,W,H,x,y) like every other painter
  if (amb.snow && !path && !water && !buried && rs()>0.4){ ctx.fillStyle='rgba(238,242,248,0.7)';
    ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); }
}
// a projector that lays tile-corner points on the drawn ground, marked for drapedEmitter
function softDrapeProj(W,H){
  const f=([gx,gy])=>{ const p=screenOfCorner(gx,gy,W,H); return [p[0],p[1]-groundHeightAt(gx,gy,true)*ELEV_STEP]; };
  f.drape=true; return f;
}
/* A soft tile (0.9.156): the tile's own ground, drawn by the same painter a flat
   tile uses, once into each of its four triangles through softTileTris' shear,
   then each triangle lit by how it faces the light. The base is laid first over
   the whole tile, bled a little, so the seams between triangles and between
   tiles show ground and not the canvas. No sides, no rim, no tile grid: the
   surface is continuous, and it meets flat ground at that ground's own height. */
function paintSoftTile(ctx,x,y,W,H,amb,showLand,organic){
  const terrObj=showLand?terrainAt(x,y):null, terrRaw=terrObj&&terrObj.k;
  const terr = (organic && smoothableTerrain(terrRaw)) ? null : terrRaw;
  const buried = organic && smoothableTerrain(terrRaw) && innerTerrainGrid()[y*GW+x]===1;
  const path=terr==='path', seed=tileSeed(x,y);
  // the same draws paintGroundTile makes before the texture, so the grain is this tile's own
  let col, pre=0;
  { const rs=mulberry(seed);
    if (path) col = pathFill(terrObj,amb.snow);
    else if (showLand && isDoor(x,y)) col = amb.snow?'#aaa49a':'#a89a80';
    else if (terr==='bed'){ rs(); pre=1; col = bedFill(terrObj,amb); }
    else if (terr==='lawn') col = lawnFill(terrObj,amb);
    else { col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14); pre=1; } }
  const tris=softTileTris(x,y,W,H), [fx,fy]=screenOfFlat(x,y,W,H), ol=tris.outline;
  /* The ground in its own light, then its marks once (drawSoftTileGround). */
  drawSoftTileGround(ctx,tris,col,buried ? null : ()=>{
    const rs=mulberry(seed); for (let i=0;i<pre;i++) rs();
    drawGroundTexture(ctx,fx,fy,x,y,terr,path,amb,col,rs,terrObj,'marks');
  });
  // the faint edge a flat lawn tile has
  if (!buried && !terr && !amb.snow){
    ctx.beginPath(); ol.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
    ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1; ctx.stroke();
  }
  // the snow patch a flat tile carries, on the surface at the tile's centre
  if (amb.snow && !path && !buried){ const rs=mulberry(seed); for (let i=0;i<pre;i++) rs();
    if (rs()>0.4){ const [sx,sy]=screenOf(x,y,W,H); ctx.fillStyle='rgba(238,242,248,0.7)';
      ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); } }
}
/* `rect` (optional, draw units [x0,y0,x1,y1]) bounds the tile LOOP the way a
   canvas clip bounds the raster. A partial bake already clips, which is what
   saves the pixels — but a clip does not save the per-path SETUP, and a thin
   band's tile bbox is a wide diagonal parallelogram, so on a small plot it is
   very nearly every tile. Measured on Firefox, a 200px band submitted 12ms
   against 8.9ms for the whole canvas: all the pixel cost gone and none of the
   path cost, because the loop had not shrunk at all. Rejecting a tile in screen
   space costs four compares and is exact — anything whose drawing could reach
   the rectangle is kept, since the slack allows for a tile's own diamond, its
   standing grain and an elevation face below it. */
function paintGround(ctx,x0,x1,y0,y1,W,H,amb,t,ex,rect){
  ex=ex||0;   // extra cull slack in draw units — the world-anchored bake paints a margin past the viewport
  const rx0=rect?rect[0]-TILE_W:0, ry0=rect?rect[1]-TILE_H*3:0;
  const rx1=rect?rect[2]+TILE_W:0, ry1=rect?rect[3]+TILE_H*3:0;
  const showLand=layerShown('landscape');
  // Organic edges: terrain draws its GRASS base in this tile pass and the
  // material is overlaid as a smoothed blob afterward (paintTerrainBlobs), so
  // the curve can cut a corner and show grass under it. Formal edges keep the
  // crisp per-tile material rendering. Doorstep + elevation stay per-tile.
  const organic = showLand && game.edgeStyle==='organic';
  /* The ground UNDER every raised tile, first and in a pass of its own. A raised
     tile used to paint only its lifted top, so wherever a wall or that top did not
     quite reach (the foot of most walls, a raised bed's rounded corners, most of
     a curved terrace's front) the sky showed through. What shows there now is
     the lawn round it. It has to be its own pass because this loop runs in WORLD
     order, which is back to front only at rotation 0: painted tile by tile, a
     later tile's ground landed on an earlier tile's lifted top and its faces.
     Only RAISED tiles: under a hollow's floor is where the far rim's face hangs. */
  if (showLand && elevationGrid().hi>0) for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    if (!onPlot(x,y) || !(elevationAt(x,y)>0) || isSoftTile(x,y)) continue;
    const [sx,sy]=screenOfFlat(x,y,W,H);
    if (sx<-TILE_W-ex||sx>W+TILE_W+ex||sy<-TILE_H*2-ELEV_MAX*ELEV_STEP-ex||sy>H+TILE_H*2+ex) continue;
    if (rect && (sx<rx0||sx>rx1||sy<ry0||sy>ry1)) continue;
    paintGradeUnder(ctx,x,y,W,H,amb);
  }
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    if (!onPlot(x,y)) continue;   // off an irregular lot: draw nothing, same as beyond the plot rectangle
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W-ex||sx>W+TILE_W+ex||sy<-TILE_H*2-ELEV_MAX*ELEV_STEP-ex||sy>H+TILE_H*2+ex) continue;
    if (rect && (sx<rx0||sx>rx1||sy<ry0||sy>ry1)) continue;
    paintGroundTile(ctx,x,y,W,H,amb,showLand,organic);
  }
  if (organic) paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t,rect);
  if (showLand){ paintPoolCopings(ctx,W,H,amb,ex,rect); paintCrossings(ctx,W,H,amb,ex,rect); }
  if (showLand) paintWallRuns(ctx,W,H,amb,ex,rect);
}
/* ---------- formal pools and crossings (0.9.154) ----------
   A formal pool's coping is laid along its traced outline by drawWallCap, the
   painter of a wall's top, a foot wide and inside the pool's own tiles, so the
   water area is its tiles less the stone. The outline is traced with the pool
   on its right, so the side to lay the stone on is always +1. Under the stone
   on the far sides, where you look into the pool, its wall shows down to the
   water, a few inches below the coping. Both are kept on terrainRev. */
let poolOutlineCache={key:'', ref:null, loops:[]};
function poolOutlines(){
  const key=game.terrainRev+'|'+GW+'x'+GH;
  if (poolOutlineCache.key===key && poolOutlineCache.ref===game.terrain) return poolOutlineCache.loops;
  const loops=[], seen=new Set();
  const isPool=(x,y)=>{ const t=terrainAt(x,y); return !!(t && t.k==='water' && waterStyle(t.c).crisp); };
  for (const k in game.terrain||{}){
    if (seen.has(k)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (!isPool(x,y)) continue;
    const h=elevationAt(x,y)||0, set=new Set(), stack=[[x,y]]; seen.add(k);
    while (stack.length){
      const [cx,cy]=stack.pop(); set.add(cx+','+cy);
      for (const [dx,dy] of ELEV_DIRS){
        const nx=cx+dx, ny=cy+dy, nk=nx+','+ny;
        if (!seen.has(nk) && isPool(nx,ny) && (elevationAt(nx,ny)||0)===h){ seen.add(nk); stack.push([nx,ny]); }
      }
    }
    // existing when every tile of it is (0.9.155): its coping is then not ordered
    const ex=[...set].every(t=>{ const r=game.terrain[t]; return !!(r&&r.ex); });
    for (const pts of traceOutlines(set)){
      let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
      for (const [px,py] of pts){ if (px<x0) x0=px; if (px>x1) x1=px; if (py<y0) y0=py; if (py>y1) y1=py; }
      loops.push({pts, h, seed:tileSeed(pts[0][0],pts[0][1]), x0,x1,y0,y1, ex});
    }
  }
  poolOutlineCache={key, ref:game.terrain, loops};
  return loops;
}
const POOL_WATER_DROP_IN=3;           // how far the water stands below the coping
function paintPoolCopings(ctx,W,H,amb,ex,rect){
  const loops=poolOutlines(); if (!loops.length) return;
  const vx0=rect?rect[0]:-ex, vx1=rect?rect[2]:W+ex, vy0=rect?rect[1]:-ex, vy1=rect?rect[3]:H+ex;
  for (const L of loops){
    const lift=L.h*ELEV_STEP, proj=wallCapProj(W,H,lift);
    const a=proj(L.x0,L.y0,0), b=proj(L.x1,L.y0,0), c=proj(L.x1,L.y1,0), d=proj(L.x0,L.y1,0);
    const mx0=Math.min(a[0],b[0],c[0],d[0]), mx1=Math.max(a[0],b[0],c[0],d[0]);
    const my0=Math.min(a[1],b[1],c[1],d[1])-TILE_H, my1=Math.max(a[1],b[1],c[1],d[1])+TILE_H;
    if (mx1<vx0||mx0>vx1||my1<vy0||my0>vy1) continue;
    const pts=L.pts, n=pts.length, {mit,segN}=wallCapMiters(pts,1,true), tI=POOL_COPING.topIn/TILE_IN;
    // the pool's own wall, under the stone on the sides you look into it from
    ctx.fillStyle=amb.snow?'#7f8c90':'#3e4a48'; ctx.beginPath();
    for (let i=0;i<n;i++){ const j=(i+1)%n, A=pts[i], B=pts[j];
      const mxp=(A[0]+B[0])/2, myp=(A[1]+B[1])/2;
      if (proj(mxp-segN[i][0]*0.25,myp-segN[i][1]*0.25,0)[1] > proj(mxp,myp,0)[1]+1e-6) continue;   // a near side: hidden
      const p=[A[0]+mit[i][0]*tI,A[1]+mit[i][1]*tI], q=[B[0]+mit[j][0]*tI,B[1]+mit[j][1]*tI];
      const p0=proj(p[0],p[1],0), q0=proj(q[0],q[1],0), q1=proj(q[0],q[1],-POOL_WATER_DROP_IN), p1=proj(p[0],p[1],-POOL_WATER_DROP_IN);
      ctx.moveTo(p0[0],p0[1]); ctx.lineTo(q0[0],q0[1]); ctx.lineTo(q1[0],q1[1]); ctx.lineTo(p1[0],p1[1]); ctx.closePath();
    }
    ctx.fill();
    drawWallCap(ctx,pts,1,true,POOL_COPING,proj,L.seed,!!amb.snow);
  }
}
/* Every crossing tile in view, back to front, each drawn against its deck
   (crossingRegions): which way it spans, and which neighbours are the same deck. */
function paintCrossings(ctx,W,H,amb,ex,rect){
  const R=crossingRegions(); if (!R.list.length) return;
  const vx0=rect?rect[0]-TILE_W:-TILE_W-ex, vx1=rect?rect[2]+TILE_W:W+TILE_W+ex;
  const vy0=rect?rect[1]-TILE_H*2:-TILE_H*2-ex, vy1=rect?rect[3]+TILE_H*2:H+TILE_H*2+ex;
  const tiles=[];
  for (const reg of R.list) for (const [x,y] of reg.tiles){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<vx0||sx>vx1||sy<vy0||sy>vy1) continue;
    tiles.push([x,y,reg,viewDepth(x,y)]);
  }
  tiles.sort((p,q)=>p[3]-q[3]);
  const dry=(x,y)=>onPlot(x,y) && tileTerrain(x,y)!=='water';
  for (const [x,y,reg] of tiles){
    const proj=wallCapProj(W,H,(elevationAt(x,y)||0)*ELEV_STEP);
    drawCrossingTile(ctx,x,y,reg.type,reg.axis,proj,(a,b)=>reg.has.has(a+','+b),dry,!!amb.snow,(reg.x0*73856093^reg.y0*19349663)>>>0);
  }
}
/* Repaint ONE rectangle of the bake, in device pixels. Clears it, clips to it,
   and paints the tiles that can reach it — so the tile loop is bounded by the
   rectangle rather than by the canvas, and the raster is bounded by the clip.
   Shared by the two partial bakes below (a pan's exposed band, an edit's
   viewport) so there is one definition of "repaint this much of the ground". */
function bakeGroundRect(px,py,pw,ph,W,H,amb,t,MD,pad,ex,ctx){
  if (pw<=0||ph<=0) return;
  ctx=ctx||groundCtx;                 // a ground job bakes into the spare canvas
  const s=DPR*ZOOM;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(px,py,pw,ph);
  ctx.save();
  ctx.beginPath(); ctx.rect(px,py,pw,ph); ctx.clip();
  ctx.setTransform(s,0,0,s,MD,MD);
  // the rectangle in draw units, then the tile bbox covering it — padded exactly
  // like the full bake, since a shrub or a blob reaches past its own tile
  const dx0=(px-MD)/s, dy0=(py-MD)/s, dx1=(px+pw-MD)/s, dy1=(py+ph-MD)/s;
  const c4=[tileAt(dx0,dy0,W,H),tileAt(dx1,dy0,W,H),tileAt(dx0,dy1,W,H),tileAt(dx1,dy1,W,H)];
  const tx0=Math.max(0,Math.min(c4[0][0],c4[1][0],c4[2][0],c4[3][0])-pad);
  const tx1=Math.min(GW-1,Math.max(c4[0][0],c4[1][0],c4[2][0],c4[3][0])+pad);
  const ty0=Math.max(0,Math.min(c4[0][1],c4[1][1],c4[2][1],c4[3][1])-pad);
  const ty1=Math.min(GH-1,Math.max(c4[0][1],c4[1][1],c4[2][1],c4[3][1])+pad);
  paintGround(ctx,tx0,tx1,ty0,ty1,W,H,amb,t,ex,[dx0,dy0,dx1,dy1]);
  ctx.restore();
}
/* ---- panning re-bakes the STRIP that came into view, not the whole canvas ----

   A pan changes where the ground sits and nothing about what it is: the bake is
   a pure function of the camera (screenOfFlat subtracts it; the jitter is seeded
   off the world lattice, so nothing in the picture is camera-derived), and
   translating the camera translates every baked pixel by one vector. So the
   canvas can COPY what it already holds and repaint only the band that has come
   into view.

   It is worth the trouble because the bake is far more expensive than the event
   timer says. `dev('bake')` closes over command SUBMISSION and reports ~10ms;
   a readback-flushed frame carrying one bake measures 96ms against 13ms for the
   same frame without it (Chrome 153, 1440x900, the demo garden — Firefox 155:
   46ms against 3ms). Ablated, the bake IS the pan: with paintGround stubbed out
   the same drag runs at the display's refresh rate instead of 49fps, and with
   only the per-tile texture stubbed it runs at 158fps — so the cost is the
   ~10,000 small tessellated path fills the grain lays down, which is what the
   grain is for. The lever is not to make them cheaper but to stop asking for
   nine tenths of them again when they are already on the canvas.

   Returns false when nothing of the old bake is worth keeping and the caller
   should bake in full. */
function scrollGroundBake(t,W,H,amb,MD,pad){
  const s=DPR*ZOOM;
  if (!(s>0) || !groundCanvas) return false;
  /* Rounding the shift to whole DEVICE pixels is what keeps the copy exact. The
     sub-pixel remainder rides on the effective camera this canvas now holds
     rather than resampling the picture, and it cannot accumulate, because the
     next scroll is measured from the camera recorded here. */
  const sdx=Math.round(s*(groundCamX-cam.x)), sdy=Math.round(s*(groundCamY-cam.y));
  const cw=groundCanvas.width, ch=groundCanvas.height;
  if (Math.abs(sdx)>=cw || Math.abs(sdy)>=ch) return false;   // nothing of it survives
  if (!sdx && !sdy){
    // under half a device pixel: the per-frame blit already rounds by that much,
    // so adopt the camera rather than repainting to chase it
    groundCamX=cam.x; groundCamY=cam.y; return true;
  }
  const cx0=cam.x, cy0=cam.y;
  const bakeCamX=groundCamX-sdx/s, bakeCamY=groundCamY-sdy/s;
  /* `copy`, not the default source-over, and that is not a detail: this canvas
     is mostly TRANSPARENT — an irregular lot, or any plot smaller than the
     margin canvas, leaves the ground as a diamond in a sea of nothing — so a
     source-over self-draw lays the shifted picture OVER the old one and the
     vacated area keeps whatever was there. Measured, that is a second ghost
     plot: 187,496 pixels carrying ground the full bake leaves empty, on a
     200px shift. `copy` replaces the destination outright, so everything the
     shifted picture does not cover becomes transparent — which is exactly the
     state the exposed band wants to be in before it is repainted. */
  groundCtx.setTransform(1,0,0,1,0,0);
  groundCtx.globalCompositeOperation='copy';
  groundCtx.drawImage(groundCanvas,sdx,sdy);          // the shifted picture; the exposed band is now empty
  groundCtx.globalCompositeOperation='source-over';
  /* The two bands must not OVERLAP. Every tile is painted with translucent
     strokes over a bled base, so a tile painted twice comes out darker than its
     neighbours — a seam exactly where this is trying not to leave one. The
     column takes full height and the row takes only what is left of the width. */
  const vx0 = sdx>0 ? 0 : cw+sdx, vx1 = sdx>0 ? sdx : cw;
  const hy0 = sdy>0 ? 0 : ch+sdy, hy1 = sdy>0 ? sdy : ch;
  const strips=[];
  if (sdx) strips.push([vx0,0,vx1-vx0,ch]);
  if (sdy){
    const hx0 = sdx>0 ? vx1 : 0, hx1 = sdx<0 ? vx0 : cw;
    if (hx1>hx0) strips.push([hx0,hy0,hx1-hx0,hy1-hy0]);
  }
  cam.x=bakeCamX; cam.y=bakeCamY;
  try{
    for (const st of strips) bakeGroundRect(st[0],st[1],st[2],st[3],W,H,amb,t,MD,pad,MD/s);
  } finally { cam.x=cx0; cam.y=cy0; }
  groundCamX=bakeCamX; groundCamY=bakeCamY;
  return true;
}
/* ---- an EDIT re-bakes what it changed ----

   A stroke cannot scroll, since the data changed and not the camera. But it can
   name what it changed, and repaint that (groundEditRect) with the margin
   included, so the next pan can still scroll.

   Repainting only the brushed tiles would be wrong: the simplifier can move an
   organic contour anywhere along its run. So the outline is compared too, as
   PIECES (tracePiecesOf): one corner's curve at a time. Comparing whole arcs
   instead would be useless, because an island bed is one closed loop and every
   edit to it would flag the lot. A closed chain changing inside a box cannot change what is
   inside the outline away from that box, so the fill and the clip are covered by
   the same box as the stroke. A bump on a long straight bed edge still repaints
   about half the bed, because that is really how far its rounding moves.

   Three things reach further than that, and keep the old viewport repaint:
   - WATER depth and flow are fields over the whole body (waterSetSig).
   - ELEVATION: walls are traced along their whole run, and a face reads its
     neighbours. Edits say nothing (groundDamageFull); an undo names its tiles for
     the throttle, so it says so separately (groundDamageBroad).
   - Anything unlocated: a house, a footprint, a load.
   That path repaints the viewport and leaves the margin holding older ground,
   invisible until the camera moves, so the first move afterwards has to bake in
   full: `marginStale` says so, and both the trigger and the scroll test read it.
   It also takes over when the changed box would cost more than the viewport.

   Known and accepted: two materials of one rank that share a hard edge paint in
   region order, and removing the first-laid tile of one can flip that order. Only
   the ~1px seam differs, and only until the next full bake. */
let groundMarginStale=false;
const GROUND_EDIT_PAD=3;       // tiles round an edited tile: a flagstone reaches ~2.3 past the tile that draws it
const GROUND_EDIT_ARC_PAD=1;   // tiles round a moved piece of outline: its stroke and edging
let groundBaked=null;          // {pieces, water}: what the canvas was last painted from
const TRACE_Q=256;             // outline points compare at 1/256 tile, as text
/* Every piece of every outline in a trace, each with its box in tile-corner
   space, for comparing with another trace. Once per trace, so once per edit. An
   arc carrying EDGING is one piece, because its joints are set out from the arc's
   start and a change anywhere moves all of them. */
function tracePiecesOf(regions){
  const keys=new Map(), boxes=[];
  const add=(key,pts)=>{
    if (keys.has(key)) return;
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    for (const p of pts){ if (p[0]<x0) x0=p[0]; if (p[0]>x1) x1=p[0]; if (p[1]<y0) y0=p[1]; if (p[1]>y1) y1=p[1]; }
    keys.set(key,boxes.length); boxes.push(x0,y0,x1,y1);
  };
  const pointKey=p=>Math.round(p[0]*TRACE_Q)+','+Math.round(p[1]*TRACE_Q);
  const heading=(from,to)=>{ const dx=to[0]-from[0], dy=to[1]-from[1], l=Math.hypot(dx,dy)||1;
    return Math.round(dx/l*1024)+'/'+Math.round(dy/l*1024); };
  /* A piece is named by what it DRAWS, not by which neighbours it has. A corner is
     its curve: from where it starts rounding to where it stops, which on a bed is
     halfway along both runs (TERRAIN_FILLET Infinity), so a bump on a long side
     really does move the outline that far, and on paving is a fixed radius, so it
     does not. Anything else is a point and the directions leaving it. The straights
     between need no piece of their own: a point that keeps its place and its
     directions still draws along the same lines, so a run can only have changed
     between points that did not, and the edit is repainted as ONE box round them. */
  const addLine=(tag,pts,closed,curved,fillet)=>{
    const n=pts.length, f=(curved&&n>=3)?filletFractions(pts,closed,fillet):null;
    for (let i=0;i<n;i++){
      const a=i>0?i-1:(closed?n-1:-1), c=i<n-1?i+1:(closed?0:-1), fi=f&&f[i], p=pts[i];
      if (fi){ const s=_tlLerp(p,pts[a],fi[0]), e=_tlLerp(p,pts[c],fi[1]);
        add(tag+'|'+pointKey(s)+'|'+pointKey(p)+'|'+pointKey(e),[s,p,e]); }
      else add(tag+'|'+(a<0?'':heading(p,pts[a]))+'|'+pointKey(p)+'|'+(c<0?'':heading(p,pts[c])),[p]);
    }
  };
  for (const r of regions){
    const head=r.kind+'|'+(r.c||'')+'|'+r.elev+'|', edging=regionEdging(r), edged=edgingStyle(edging).w;
    for (const loop of r.loops) for (const arc of (loop.closed?[loop]:loop.arcs)){
      const tag=head+(arc.hard?'h':'s')+(arc.covered?'c':'');
      if (edged && !arc.hard && !arc.covered) add(tag+'|'+edging+'|'+arc.pts.map(pointKey).join(';'),arc.pts);
      else addLine(tag,arc.pts,!!loop.closed,!arc.hard,arc.fillet);
    }
    if (r.skirts) for (const s of r.skirts){
      for (const ring of s.rings) addLine(head+'skirt',ring,true,false);
      // the coverer's tiles that show this band's grain, read off the coverer's curve
      for (const k of s.tiles){ const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
        add(head+'skirttile|'+k,[[x,y],[x+1,y+1]]); }
    }
  }
  return {keys,boxes};
}
function terrainTracePieces(){
  const regions=buildTerrainRegions();     // first, so edging is read against the state this trace is of
  return terrainLoopCache.pieces||(terrainLoopCache.pieces=tracePiecesOf(regions));
}
function waterSetSig(){
  let s='';
  for (const k in game.terrain){ const t=game.terrain[k];
    if (t && !t.removed && t.k==='water') s+=k+':'+(t.c||'')+';'; }
  return s;
}
const organicGroundOn=()=>layerShown('landscape') && game.edgeStyle==='organic';
// the canvas now shows the ground as it stands; the next edit is measured from here
function noteGroundBaked(){
  groundBaked={pieces:organicGroundOn()?terrainTracePieces():null, water:waterSetSig()};
}
// grow `box` by every piece of `a` that `b` does not have
function growBoxByPieces(box,a,b){
  const P=GROUND_EDIT_ARC_PAD;
  for (const [k,i] of a.keys){
    if (b.keys.has(k)) continue;
    const q=a.boxes;
    if (q[i]-P<box[0]) box[0]=q[i]-P;
    if (q[i+1]-P<box[1]) box[1]=q[i+1]-P;
    if (q[i+2]+P>box[2]) box[2]=q[i+2]+P;
    if (q[i+3]+P>box[3]) box[3]=q[i+3]+P;
  }
}
/* What an edit changed, as one box in tile-corner space, or null if it cannot be
   bounded. Measured against groundBaked and not the previous trace: a plan sheet
   or a list can retrace between the edit and its bake. */
function groundEditBox(){
  if (groundDamageFull || groundDamageBroad || !groundBaked) return null;
  if (!groundDamage.size || groundDamage.size>GROUND_DAMAGE_CAP) return null;
  if (waterSetSig()!==groundBaked.water) return null;
  const box=[Infinity,Infinity,-Infinity,-Infinity], P=GROUND_EDIT_PAD;
  for (const k of groundDamage){
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (!Number.isFinite(x)||!Number.isFinite(y)) return null;
    if (x-P<box[0]) box[0]=x-P;
    if (y-P<box[1]) box[1]=y-P;
    if (x+1+P>box[2]) box[2]=x+1+P;
    if (y+1+P>box[3]) box[3]=y+1+P;
  }
  if (organicGroundOn()){
    if (!groundBaked.pieces) return null;
    const now=terrainTracePieces();
    growBoxByPieces(box,now,groundBaked.pieces);
    growBoxByPieces(box,groundBaked.pieces,now);
  }
  return box;
}
/* That box as a rectangle of the bake, in device pixels: possibly empty, for an
   edit off the canvas altogether. Null when it cannot be bounded, or when it would
   cost more than the viewport repaint it is standing in for. A terrace draws up to
   its full lift above where the flat lattice puts it, a hollow's faces below. */
function groundEditRect(W,H,MD){
  const box=groundEditBox(); if (!box) return null;
  const s=DPR*ZOOM, E=elevationGrid();
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for (const [gx,gy] of [[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]]){
    const p=screenOfCorner(gx,gy,W,H);
    if (p[0]<x0) x0=p[0];
    if (p[0]>x1) x1=p[0];
    if (p[1]<y0) y0=p[1];
    if (p[1]>y1) y1=p[1];
  }
  const px=Math.max(0,Math.floor(x0*s+MD)), py=Math.max(0,Math.floor((y0-E.hi*ELEV_STEP)*s+MD));
  const qx=Math.min(groundCanvas.width,Math.ceil(x1*s+MD)), qy=Math.min(groundCanvas.height,Math.ceil((y1-E.lo*ELEV_STEP)*s+MD));
  const pw=Math.max(0,qx-px), ph=Math.max(0,qy-py);
  if (pw*ph>=cnv.width*cnv.height) return null;
  return [px,py,pw,ph];
}
/* The transient stand-in for tiles edited since the last authoritative bake.
   Drawn onto the LIVE canvas every frame, never cached — so it cannot go stale
   and needs no invalidation of its own. It reads current model state, so a tile
   painted and then erased inside one settle window draws as grass.
   Deliberately per-tile (organic=false): it is covering for a blob whose
   contour has not been retraced yet, and a formal diamond at the brush tip for
   ~90ms reads as wet paint, where a missing tile reads as a dropped input. */
function drawGroundDamage(ctx,W,H,amb){
  if (!groundDamage.size) return 0;
  const showLand=layerShown('landscape');
  if (!showLand) return 0;
  let n=0;
  for (const k of groundDamage){
    const ci=k.indexOf(','); if (ci<0) continue;
    const x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (!Number.isFinite(x)||!Number.isFinite(y)||!onPlot(x,y)) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;   // off-screen: the bake will get it
    paintGroundTile(ctx,x,y,W,H,amb,showLand,false);
    n++;
  }
  return n;
}
/* ---------- organic terrain: smoothed region blobs (Wave 3 + Tier 1) ----------
   Reuses the plan sheet's traceOutlines pipeline. Contiguous same-material
   tiles flood into regions (8-connected, split by elevation level); each
   region's rectilinear boundary is traced ONCE, classified into ARCS, and
   cached in world (tile-corner) space keyed by terrainRev — tracing runs only
   on edit, never per pan frame.

   The arc classification is what lets materials meet (the old renderer inset
   every region away from every boundary, so beds could never touch paths and
   grass seams showed everywhere):
   - HARD arcs — boundary shared with another region (other material, other
     colour, or the same material at another elevation) — draw as exact tile
     lines, no jitter, no rounding: the two fills butt seamlessly and the
     corners the gardener painted stay corners.
   - SOFT arcs — boundary facing grass — keep the organic treatment:
     Douglas-Peucker'd (staircases → straight diagonals), interiors jittered
     inward-bounded, drawn as a midpoint-quadratic spline pinned exactly to the
     arc's endpoints (so curves land on the corners where a hard edge begins).
   - PINCH corners — where 8-connected lobes of one region touch diagonally —
     are pinned exact so the lobes kiss at the corner instead of gapping.
   Soft interiors are pre-jittered in tile space, so the garden renderer and
   the plan sheet project the SAME cached geometry (terrainLoopPath takes a
   projector) — the plan finally matches the garden. Regions carry their
   elevation and draw lifted by elev*ELEV_STEP, low-to-high, so raised beds
   sit on their terraces instead of rendering flat. */
let terrainLoopCache={sig:null, terrainRef:null, elevRef:null, regions:[]};
// Douglas–Peucker on a closed boundary loop: `traceOutlines` renders a diagonal
// edge as a rectilinear staircase (right/down/right/down); left alone, the
// spline uses each step corner as a control point and scallops into a zigzag.
// Collapsing the staircase to its endpoints first makes it draw as one straight
// diagonal. eps is in tiles: a 45° staircase deviates ~0.71 from its ideal
// chord and a genuine one-tile jog deviates ~1, so ~0.9 erases the artifact
// while keeping real notches. Runs only on edit (cached), so cost is irrelevant.
const TERRAIN_SIMPLIFY_EPS=0.9;
// Douglas-Peucker on an OPEN polyline — endpoints always survive, so an arc
// simplified between two pinned corners still lands exactly on those corners.
function dpOpen(arr, eps){
  const segDist=(p,a,b)=>{
    const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy;
    if (L2<1e-12) return Math.hypot(p[0]-a[0],p[1]-a[1]);
    let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2; t=t<0?0:t>1?1:t;
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
  };
  const dp=(a)=>{
    if (a.length<3) return a.slice();
    let idx=-1, max=0;
    for (let i=1;i<a.length-1;i++){ const d=segDist(a[i],a[0],a[a.length-1]);
      if (d>max){ max=d; idx=i; } }
    if (max>eps) return dp(a.slice(0,idx+1)).slice(0,-1).concat(dp(a.slice(idx)));
    return [a[0], a[a.length-1]];
  };
  return dp(arr);
}
function simplifyClosedLoop(pts, eps){
  if (pts.length<=4) return pts;
  // anchor on two extreme, guaranteed-real corners so no kink is introduced
  let a0=0; for (let i=1;i<pts.length;i++){ const p=pts[i], q=pts[a0];
    if (p[0]<q[0] || (p[0]===q[0] && p[1]<q[1])) a0=i; }
  let a1=a0, best=-1;
  for (let i=0;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[a0][0], pts[i][1]-pts[a0][1]);
    if (d>best){ best=d; a1=i; } }
  const lo=Math.min(a0,a1), hi=Math.max(a0,a1);
  if (hi-lo<1) return pts;
  const out=dpOpen(pts.slice(lo,hi+1),eps).slice(0,-1)
    .concat(dpOpen(pts.slice(hi).concat(pts.slice(0,lo+1)),eps).slice(0,-1));
  return out.length>=3 ? out : pts;
}
// drop interior points collinear with their neighbors (integer lattice input)
function mergeCollinearOpen(pts){
  if (pts.length<3) return pts.slice();
  const out=[pts[0]];
  for (let i=1;i<pts.length-1;i++){
    const a=pts[i-1], b=pts[i], c=pts[i+1];
    if ((b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0])) out.push(b);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function mergeCollinearClosed(pts){
  const n=pts.length, out=[];
  for (let i=0;i<n;i++){
    const a=pts[(i+n-1)%n], b=pts[i], c=pts[(i+1)%n];
    if ((b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0])) out.push(b);
  }
  return out.length>2?out:pts;
}
/* Expand a traced loop (corners only) back to unit tile edges, classifying each
   edge by what sits on its OUTSIDE. Lawn = SOFT (smooth organically). Anything
   that is not lawn is hard — the plot boundary, and a house or building wall,
   which is the same kind of line and used to read as lawn here because the only
   question asked was whether the neighbour carried terrain. A bed painted to
   either runs exactly to it (leave a grass tile if you want a margin);
   isLawnTile (world.js) is the shared predicate. Orientation-free: of the two
   tiles flanking an edge, the one not in the region is out.

   Against another material the answer is TERRAIN_RANK, not a flat "hard":
   - the neighbour outranks me  -> HARD and COVERED. It is painted after me and
     its curve will land on my fill, so I stay exact and skip my stroke there;
     stroking it would outline a staircase the fill no longer shows.
   - same rank (bed vs bed, two path colours) -> HARD. Both stay exact and butt,
     which is right and is what this has always done.
   - I outrank the neighbour -> SOFT. A path laid through a bed keeps one
     continuous organic edge for its whole run; anything the curve cuts away
     reveals the bed underneath rather than a sliver of lawn.
   That last case is the whole point: judging by "is the neighbour solid" made a
   path smooth over grass and a raw tile staircase the moment it entered a bed,
   flipping treatment four times along one run.

   `skirt` marks a covered edge whose coverer stands at MY elevation: the ones
   terrainSkirts lays this region's material under (see there). A raised path
   beside a sunken bed is a terrace face, not a joint, and gets none. */
/* `dropSoft`: what an edge across a change of LEVEL is. Normally HARD — a bed on
   a terrace runs to the terrace's edge, and a bed at the foot of a wall runs to
   the wall — where it used to be soft whenever the ground over the drop was
   lawn, so a raised bed drew as an oval of soil on a box of lawn and a sunken
   patio rounded its corners off inside its own walls. A raised bed that is the
   WHOLE top of its terrace (raisedBedInfo) is the exception: its edges stay soft
   and its wall is drawn along the curve they make (paintRaisedBedWall). */
/* `crispAt`/`meCrisp` (0.9.154): a formal pool is square whatever the garden's
   edge style, so every edge of it is HARD, and so is a neighbour's edge facing
   it: a path or a bed against its coping stops on the line rather than
   rounding or bleeding over the stone. */
function terrainUnitEdges(loop, set, solid, myRank, rankAt, myElev, elevAt, dropSoft, crispAt, meCrisp){
  const edges=[];
  const SOFT=0, HARD=1, COVERED=2;
  let drop=false;
  const classify=(key)=>{
    const ci=key.indexOf(','), ox=+key.slice(0,ci), oy=+key.slice(ci+1);
    drop=onPlot(ox,oy) && regionLevelAt(ox,oy)!==(myElev||0);
    if (drop) return dropSoft ? SOFT : HARD;
    if (solid[key]){
      const r=rankAt[key];
      if (r>myRank) return COVERED;
      if (meCrisp || (crispAt && crispAt[key])) return HARD;
      return r<myRank ? SOFT : HARD;             // laid over it: draw organic, on top
    }
    if (meCrisp) return HARD;
    return isLawnTile(ox,oy) ? SOFT : HARD;      // lawn smooths; a wall or the plot line does not
  };
  for (let i=0;i<loop.length;i++){
    const a=loop[i], b=loop[(i+1)%loop.length];
    const dx=Math.sign(b[0]-a[0]), dy=Math.sign(b[1]-a[1]);
    let x=a[0], y=a[1];
    while (x!==b[0] || y!==b[1]){
      const nx=x+dx, ny=y+dy;
      let out;
      if (dx!==0){ const tx=Math.min(x,nx), t1=`${tx},${y-1}`, t2=`${tx},${y}`;
        out = set.has(t1) ? t2 : t1; }
      else { const ty=Math.min(y,ny), t1=`${x-1},${ty}`, t2=`${x},${ty}`;
        out = set.has(t1) ? t2 : t1; }
      const cls=classify(out);
      // `over` marks the soft edges I get because I am LAID OVER the neighbour,
      // as opposed to the soft edges I get because the neighbour is lawn. Those
      // are the ones the bleed in terrainLoopArcs applies to, and `n` is the
      // outward unit normal it moves along.
      const over = cls===SOFT && !drop && !!solid[out];   // nothing is laid over ground at another level
      const oc=out.indexOf(','), ox=+out.slice(0,oc), oy=+out.slice(oc+1);
      const nrm = dx!==0 ? [0, oy===y ? 1 : -1] : [ox===x ? 1 : -1, 0];
      const skirt = cls===COVERED && (!elevAt || (elevAt[out]||0)===(myElev||0));
      edges.push({a:[x,y], b:[nx,ny], hard:cls!==SOFT, covered:cls===COVERED, over, n:nrm, skirt, out});
      x=nx; y=ny;
    }
  }
  return edges;
}
/* `P` is the laid-over bleed, and it is applied HERE — after simplification —
   rather than to the lattice points on the way in. Bled first, it put a
   0.45-tile step into the middle of any run that changes neighbour material
   partway along (a path crossing a bed), which manufactured a fake corner
   there and pushed the real one off the chord the simplifier measures against.
   Measured on a real garden's patio: the straight west run bowed 1.08 ft with
   the bleed applied first and 0.58 ft with it applied last, and 0.58 is the
   bleed itself — the intended half-tile the winner spreads over the bed it
   covers. The jitter is still seeded from the UNBLED integer lattice point,
   which is what planJitter's "neighbouring blobs nest" property depends on. */
function finishTerrainArc(hard, pts, covered, P){
  P = P || (p=>p);
  pts=mergeCollinearOpen(pts);
  if (!hard && pts.length>2){
    // A pinch lobe's arc starts and ends on the SAME corner, so the DP chord
    // is a point and a unit-tile lobe (corners ~0.71 < eps) collapses to a
    // sliver. Keep unit-scale lobes verbatim; anchor-split larger near-closed
    // arcs at their farthest corner so DP always has real chords to test.
    const a=pts[0], b=pts[pts.length-1];
    const closedish=Math.hypot(a[0]-b[0],a[1]-b[1])<1;
    if (pts.length<=5){ /* single-tile lobe: every corner is structural */ }
    else if (closedish){
      let far=1, best=-1;
      for (let i=1;i<pts.length-1;i++){ const d=Math.hypot(pts[i][0]-a[0],pts[i][1]-a[1]);
        if (d>best){ best=d; far=i; } }
      pts=dpOpen(pts.slice(0,far+1),TERRAIN_SIMPLIFY_EPS).slice(0,-1)
        .concat(dpOpen(pts.slice(far),TERRAIN_SIMPLIFY_EPS));
    }
    /* One DP over the whole arc is enough, and it is worth recording why the
       obvious extra guard is not here. A real 90-degree corner between two long
       runs is design, not noise, and DP measures it against a chord that may
       span the entire L — the patio corner above came to 0.9054 against eps 0.9,
       i.e. it survived by four thousandths of a tile. Splitting the polyline at
       long-run corners before simplifying was built to protect exactly that, and
       measured ZERO difference on the garden that motivated it and on a
       synthetic reconstruction of the same shape: once the bleed stops
       corrupting the input, real corners clear the tolerance on their own. It
       was removed rather than shipped as an untested tuning constant. If a
       corner ever IS lost, the cause is the eps, not the chord. */
    else pts=dpOpen(pts, TERRAIN_SIMPLIFY_EPS);
  }
  const outPts=pts.map(P);
  if (!hard){   // inward-bounded lattice jitter, interiors only — endpoints stay pinned
    for (let i=1;i<outPts.length-1;i++){ const [jx,jy]=planJitter(pts[i][0],pts[i][1]);
      outPts[i]=[outPts[i][0]+jx*0.55, outPts[i][1]+jy*0.55]; }
  }
  pts=outPts;
  return {hard, covered:!!covered, pts};
}
// Split one loop's unit edges into maximal same-hardness arcs, cutting also at
// pinch corners so those corners stay exact and lobes kiss: same-region
// pinches (useCount>=2: the boundary passes through the corner twice) and
// cross-material saddles (two solid tiles meeting only at this corner across
// grass — e.g. a soil bed corner touching a path corner diagonally).
/* How far a region's edge is bled outward where it is LAID OVER a lower-ranked
   one, in tiles. The loser stops exactly on the shared tile line, but the
   winner's smoothed edge curves back INSIDE that line and the strip between
   them is unpainted — a ribbon of lawn down both sides of every path that
   crosses a bed. Bleeding the winner out by roughly what the smoothing then
   cuts back (a Douglas-Peucker chord across a 45-degree staircase gives up
   ~0.35) lands the curve on the tile line instead of inside it.

   It is the WINNER that bleeds, not the loser. Skirting the loser under the
   winner closes the same gap and was tried first, but it eats the winner from
   both sides: a one-tile-wide path crossing a bed lost half a tile to each
   skirt and broke into disconnected lozenges. The winner can always bleed
   safely, because whatever it covers is the loser's fill by definition. */
const LAID_OVER_BLEED = 0.45;
function terrainLoopArcs(es, useCount, saddle, fillet){
  const n=es.length;
  /* Bleed every lattice point that touches a laid-over edge. Doing it per POINT
     rather than per arc is what keeps the silhouette closed: the corner where a
     laid-over arc meets a lawn-facing one is a single point shared by both, so
     both arcs move with it and no step opens between them. Components are
     clamped to +-1 so a straight run moves by one normal and a right-angle
     corner moves along the diagonal — the correct miter for a rectilinear loop. */
  const off={};
  for (const e of es){
    if (!e.over) continue;
    for (const p of [e.a,e.b]){
      const k=p[0]+','+p[1], o=off[k]||(off[k]=[0,0]);
      o[0]=Math.max(-1,Math.min(1,o[0]+e.n[0]));
      o[1]=Math.max(-1,Math.min(1,o[1]+e.n[1]));
    }
  }
  const P=p=>{ const o=off[p[0]+','+p[1]];
    return o ? [p[0]+o[0]*LAID_OVER_BLEED, p[1]+o[1]*LAID_OVER_BLEED] : p; };
  const isCut=i=>{
    const prev=es[(i+n-1)%n];
    // covered changes as well as hard: an arc has to be uniformly one or the
    // other, because the stroke pass emits whole arcs
    if (prev.hard!==es[i].hard || prev.covered!==es[i].covered) return true;
    const v=es[i].a;
    if (useCount[v.join(',')]>=2) return true;
    return !!(saddle && saddle(v[0],v[1]));
  };
  const cuts=[];
  for (let i=0;i<n;i++) if (isCut(i)) cuts.push(i);
  if (!cuts.length){                       // uniform loop, no pins — closed treatment
    const raw=es.map(e=>e.a), hard=es[0].hard;
    let pts=mergeCollinearClosed(raw);
    if (!hard) pts=simplifyClosedLoop(pts, TERRAIN_SIMPLIFY_EPS);
    const outPts=pts.map(P);                       // bleed AFTER simplifying — see finishTerrainArc
    if (!hard) for (let i=0;i<outPts.length;i++){ const [jx,jy]=planJitter(pts[i][0],pts[i][1]);
      outPts[i]=[outPts[i][0]+jx*0.55, outPts[i][1]+jy*0.55]; }
    return {closed:true, hard, covered:!!es[0].covered, pts:outPts, fillet};
  }
  const arcs=[];
  for (let c=0;c<cuts.length;c++){
    const i0=cuts[c], i1=cuts[(c+1)%cuts.length];
    let len=(i1-i0+n)%n; if (len===0) len=n;
    const pts=[]; for (let s=0;s<=len;s++) pts.push(es[(i0+s)%n].a);
    arcs.push(finishTerrainArc(es[i0].hard, pts, es[i0].covered, P));
  }
  arcs.forEach(a=>{ a.fillet=fillet; });
  return {closed:false, arcs};
}
/* The SKIRT: a band of this region's own material laid under the region that
   covers it, TERRAIN_SKIRT tiles deep, so whatever the coverer's curve leaves
   uncovered shows this material and never the lawn.

   The bleed above is meant to land the winner's curve on the shared tile line,
   and a straight run does land there. A JOG does not: the simplifier collapses a
   one-tile step into a long shallow diagonal (a jog deviates ~0.6-0.8 tiles from
   its chord, under TERRAIN_SIMPLIFY_EPS), which cuts back inside the path's own
   tiles by more than the 0.45 bleed, while the bed stays exact on the tile line.
   Nothing painted the strip between them, so lawn showed down the joint. The
   daily woodland and gravel sites, both "winding" paths built from one-tile
   steps, measured up to 63% of a path tile showing lawn.

   Raising the bleed instead would push the path's own visible edge out over the
   bed, changing the shape the gardener drew; the skirt sits UNDER the winner,
   so wherever the winner covers it, it is invisible. Only an edge facing the
   coverer at the same elevation skirts, and a point that also touches a SOFT
   edge (lawn, or something this region is laid over) stays put, so the band
   tapers to nothing there: next to lawn the winner's rounding is the design,
   and filling it with bed would poke a square corner into the grass. A mitred
   corner is kept only if the diagonal tile it reaches into is the coverer too.
   Returns [{rings, tiles}], `tiles` being the coverer's tiles the band crosses,
   which the renderer textures in this material.
   The band's inner side starts TERRAIN_SKIRT_OVERLAP inside this region rather
   than on its tile line: two antialiased fills that only abut leave a hairline
   of whatever is under them (the grass base), which drew the outline of every
   cut triangle faintly along the joint. Overlapping puts the joint under solid
   fill; the band is painted before the grain, so the grain still covers it. */
const TERRAIN_SKIRT = 0.5, TERRAIN_SKIRT_OVERLAP = 0.08;
function terrainSkirts(es, coveredAt){
  const n=es.length; if (!n || !es.some(e=>e.skirt)) return null;
  const key=p=>p[0]+','+p[1], off={}, pin={};
  for (const e of es){
    if (!e.hard){ pin[key(e.a)]=1; pin[key(e.b)]=1; continue; }
    if (!e.skirt) continue;
    for (const p of [e.a,e.b]){ const k=key(p), o=off[k]||(off[k]=[0,0]);
      o[0]=Math.max(-1,Math.min(1,o[0]+e.n[0]));
      o[1]=Math.max(-1,Math.min(1,o[1]+e.n[1])); }
  }
  const tiles=new Set();
  const at=p=>{ const k=key(p), o=off[k];
    if (!o || pin[k] || (!o[0] && !o[1])) return p;
    if (o[0] && o[1]){
      const tx=p[0]+(o[0]>0?0:-1), ty=p[1]+(o[1]>0?0:-1);
      if (!coveredAt(tx,ty)) return p;
      tiles.add(tx+','+ty);
    }
    return [p[0]+o[0]*TERRAIN_SKIRT, p[1]+o[1]*TERRAIN_SKIRT]; };
  const inner=p=>{ const k=key(p), o=off[k];
    return (!o || pin[k]) ? p : [p[0]-o[0]*TERRAIN_SKIRT_OVERLAP, p[1]-o[1]*TERRAIN_SKIRT_OVERLAP]; };
  const out=[];
  if (es.every(e=>e.skirt)){                  // the whole loop is covered: a ring
    for (const e of es) tiles.add(e.out);
    out.push({rings:[es.map(e=>inner(e.a)), es.map(e=>at(e.a))], tiles:[...tiles]});
    return out;
  }
  for (let i=0;i<n;i++){
    if (!es[i].skirt || es[(i+n-1)%n].skirt) continue;   // start of a run only
    tiles.clear();
    const line=[es[i].a];
    for (let j=i; es[j%n].skirt && j<i+n; j++){ line.push(es[j%n].b); tiles.add(es[j%n].out); }
    const band=line.map(inner).concat(line.slice().reverse().map(at));
    out.push({rings:[band], tiles:[...tiles]});
  }
  return out.length ? out : null;
}
/* Most of a skirt is under its coverer for good — a straight run lands on the
   tile line — so texturing every tile it crosses paid for grain nobody can see:
   measured on the demo garden, ~2ms of a ~52ms bake, against ~0.1ms for the
   flat fill. Once per trace (an edit), keep only the tiles where some of the
   band falls outside the coverer's silhouette. Both are flattened to rings in
   tile space and sampled on a grid, so a sliver thinner than a sample step may
   go untextured; it is still filled, just without grain. */
function terrainRingsOf(drawLoops){
  const rings=[]; let ring=null, cur=null;
  drawLoops({ beginPath(){}, closePath(){},
    moveTo(x,y){ ring=[[x,y]]; rings.push(ring); cur=[x,y]; },
    lineTo(x,y){ ring.push([x,y]); cur=[x,y]; },
    quadraticCurveTo(cx,cy,x,y){ const a=cur;
      for (let i=1;i<=8;i++){ const t=i/8, u=1-t;
        ring.push([u*u*a[0]+2*u*t*cx+t*t*x, u*u*a[1]+2*u*t*cy+t*t*y]); }
      cur=[x,y]; } });
  return rings;
}
function terrainRingsHit(rings, x, y){
  let inside=false;
  for (const r of rings) for (let i=0, j=r.length-1; i<r.length; j=i++){
    const xi=r[i][0], yi=r[i][1], xj=r[j][0], yj=r[j][1];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function exposeSkirtTiles(regions){
  const owner={}, sil=new Map(), id=p=>p;
  for (const r of regions) for (const k of r.tiles) owner[k]=r;
  const silOf=r=>{ let s=sil.get(r);
    if (!s){ s=terrainRingsOf(ctx=>{ for (const loop of r.loops) terrainLoopPath(ctx,loop,id); }); sil.set(r,s); }
    return s; };
  for (const r of regions) if (r.skirts) for (const s of r.skirts){
    const band=terrainRingsOf(ctx=>terrainSkirtPath(ctx,s,id));
    s.tiles=s.tiles.filter(k=>{
      const cover=owner[k]; if (!cover) return true;
      const ci=k.indexOf(','), tx=+k.slice(0,ci), ty=+k.slice(ci+1), c=silOf(cover);
      for (let i=0;i<6;i++) for (let j=0;j<6;j++){
        const px=tx+(i+0.5)/6, py=ty+(j+0.5)/6;
        if (terrainRingsHit(band,px,py) && !terrainRingsHit(c,px,py)) return true;
      }
      return false;
    });
  }
}
// One skirt onto a fresh ctx path; fill and clip it 'evenodd' (a ring has two).
function terrainSkirtPath(ctx, s, proj){
  ctx.beginPath();
  for (const ring of s.rings){
    if (proj.drape){ const em=drapedEmitter(ctx,proj,true); em.move(ring[0]);
      for (let i=1;i<=ring.length;i++) em.line(ring[i%ring.length]); ctx.closePath(); continue; }
    ring.forEach((p,i)=>{ const q=proj(p); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); });
    ctx.closePath();
  }
}
/* An outline laid over SOFT ground (0.9.156). A projector marked `drape` lifts
   each point to the surface under it, and the outline is then walked in TILE
   space, the same curve the flat one makes, sampled every third of a tile and
   each sample lifted. Projected only at its corners, a straight edge across a
   swale stayed straight while the ground under it dipped, and a path's gravel
   fell out of its own outline. */
const DRAPE_STEP=0.34;
function drapedEmitter(ctx, lift, moveFirst){
  let last=null;
  const step=p=>{
    const n=Math.max(1,Math.ceil(Math.hypot(p[0]-last[0],p[1]-last[1])/DRAPE_STEP));
    for (let i=1;i<=n;i++){ const t=i/n, q=lift([last[0]+(p[0]-last[0])*t, last[1]+(p[1]-last[1])*t]); ctx.lineTo(q[0],q[1]); }
    last=p;
  };
  return {
    move:p=>{ last=p; if (moveFirst!==false){ const q=lift(p); ctx.moveTo(q[0],q[1]); } },
    line:p=>step(p),
    // sampled by its length: a four-point bed outline is four quads of ten tiles each
    quad:(from,c,p)=>{ const K=Math.max(4,Math.ceil((Math.hypot(c[0]-from[0],c[1]-from[1])+Math.hypot(p[0]-c[0],p[1]-c[1]))/0.4));
      for (let k=1;k<=K;k++){ const t=k/K, u=1-t;
      step([u*u*from[0]+2*u*t*c[0]+t*t*p[0], u*u*from[1]+2*u*t*c[1]+t*t*p[1]]); } },
  };
}
/* The corner radius comes from TERRAIN_FILLET (core.js) — per MATERIAL, because
   a bed edge and a paving edge want opposite things. Unbounded reproduces the
   original renderer exactly: each vertex is the spline's control point, cutting
   the corner by |(A-B)+(C-B)|/4, which grows with the runs either side.
   The clamp is computed on the TILE-space points and applied as a FRACTION of
   the projected segment, never in projected units — otherwise the radius would
   mean pixels, changing with zoom and differing between the garden and the plan
   sheet. Every projector here is affine, so a fraction along a tile segment is
   the same fraction along its projection. */
const TERRAIN_FILLET_DEFAULT = 1.0;
function filletFractions(tilePts, closed, R){
  R = R===undefined ? TERRAIN_FILLET_DEFAULT : R;
  const n=tilePts.length, out=new Array(n).fill(null);
  const seg=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  for (let i=0;i<n;i++){
    const prev = closed ? tilePts[(i+n-1)%n] : tilePts[i-1];
    const next = closed ? tilePts[(i+1)%n] : tilePts[i+1];
    if (!prev || !next) continue;
    const la=seg(prev,tilePts[i]), lc=seg(tilePts[i],next);
    out[i]=[ la?Math.min(R,la/2)/la:0, lc?Math.min(R,lc/2)/lc:0 ];
  }
  return out;
}
const _tlLerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
/* ONE definition of the smoothed edge, walked by three consumers: the fill
   path, the outline stroke, and the sampled polyline the edging strip follows
   (edgingCurvePoints). They have to agree exactly or the strip sits visibly off
   its own bed, so this is a walk with an emitter rather than three copies of
   the same spline. `emit.quad` is handed its own start point so a sampling
   consumer does not have to track the pen. */
function terrainCurveWalk(tilePts, projPts, closed, emit, R){
  const n=projPts.length, f=filletFractions(tilePts,closed,R);
  if (closed){
    const startOf=i=>_tlLerp(projPts[i], projPts[(i+n-1)%n], f[i][0]);
    let cur=startOf(0); emit.move(cur);
    for (let i=0;i<n;i++){
      const to=_tlLerp(projPts[i], projPts[(i+1)%n], f[i][1]);
      emit.quad(cur, projPts[i], to);
      cur=startOf((i+1)%n); emit.line(cur);
    }
    return;
  }
  emit.move(projPts[0]);                       // endpoints are PINNED: arcs must still tile the loop
  let cur=projPts[0];
  for (let i=1;i<n-1;i++){
    cur=_tlLerp(projPts[i], projPts[i-1], f[i][0]); emit.line(cur);
    const to=_tlLerp(projPts[i], projPts[i+1], f[i][1]);
    emit.quad(cur, projPts[i], to); cur=to;
  }
  emit.line(projPts[n-1]);
}
function ctxEmitter(ctx, moveFirst){
  return {
    move:p=>{ if (moveFirst!==false) ctx.moveTo(p[0],p[1]); },
    line:p=>ctx.lineTo(p[0],p[1]),
    quad:(from,c,p)=>ctx.quadraticCurveTo(c[0],c[1],p[0],p[1]),
  };
}
// One arc onto the current path. Hard arcs are exact lines; soft arcs are
// bounded-fillet curves pinned to their endpoints.
function terrainArcPath(ctx, arc, proj, moveFirst){
  if (proj.drape){
    const em=drapedEmitter(ctx,proj,!!moveFirst);
    if (arc.hard || arc.pts.length<3){ em.move(arc.pts[0]); for (let i=1;i<arc.pts.length;i++) em.line(arc.pts[i]); return; }
    terrainCurveWalk(arc.pts, arc.pts, false, em, arc.fillet);
    return;
  }
  const pts=arc.pts.map(proj);
  if (arc.hard || pts.length<3){
    if (moveFirst) ctx.moveTo(pts[0][0],pts[0][1]);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    return;
  }
  terrainCurveWalk(arc.pts, pts, false, ctxEmitter(ctx, !!moveFirst), arc.fillet);
}
/* Append one cached region loop to the current ctx path through an arbitrary
   projector ([gx,gy] tile corners → canvas px) — the garden (iso + elevation
   lift) and the plan sheet (flat paper) draw the SAME geometry. This is the
   SILHOUETTE, used for the fill and the clip: every arc, closed. */
function terrainLoopPath(ctx, loop, proj){
  if (loop.closed && proj.drape){
    const em=drapedEmitter(ctx,proj,true);
    if (loop.hard || loop.pts.length<3){ em.move(loop.pts[0]); for (let i=1;i<=loop.pts.length;i++) em.line(loop.pts[i%loop.pts.length]); }
    else terrainCurveWalk(loop.pts, loop.pts, true, em, loop.fillet);
    ctx.closePath(); return;
  }
  if (loop.closed){
    const pts=loop.pts.map(proj);
    if (loop.hard || pts.length<3){
      pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath(); return;
    }
    terrainCurveWalk(loop.pts, pts, true, ctxEmitter(ctx, true), loop.fillet);
    ctx.closePath(); return;
  }
  loop.arcs.forEach((arc,ai)=> terrainArcPath(ctx,arc,proj,ai===0));
  ctx.closePath();
}
/* The OUTLINE, used for the edge stroke: the same geometry minus the arcs a
   higher-ranked region covers. A bed whose neighbour is a path stays exact
   along that boundary so the path's curve has something to land on — but the
   path is drawn over it, so stroking the bed there would outline a tile
   staircase the fill no longer shows. Each surviving arc is its own subpath;
   they still tile the loop end to end, so a fully-uncovered loop strokes
   exactly as it did when this was one closed path. */
function terrainLoopStroke(ctx, loop, proj){
  if (loop.closed){ if (!loop.covered) terrainLoopPath(ctx,loop,proj); return; }
  for (const arc of loop.arcs) if (!arc.covered) terrainArcPath(ctx,arc,proj,true);
}
/* ---------- retaining walls as CONTOURS, not per-tile faces ----------
   A wall lives on the exposed face of a level change, and it used to be drawn
   one tile at a time: two screen parallelograms per raised tile, meeting at 90
   degrees. So a curved terrace came out as a staircase of blocks — and worse,
   the terrace TOP was smoothed (paintTerrainBlobs traces and splines it) while
   the face below it kept the tile lattice, so the two documents of the same
   edge disagreed on screen: a flowing cap sitting on square steps.
   This traces the ELEVATION lattice the way buildTerrainRegions traces the
   material lattice. Each unit edge of a level's outline is a face if the ground
   outside it is lower; contiguous faces sharing a drop, a facing and a material
   become one RUN, and a run is one wall — its courses are laid along its whole
   length instead of restarting every 18 inches.
   Camera facing is baked in (only the two view-facing sides of a level change
   are visible, exactly as the per-tile version chose), so game.rot is part of
   the key; rotation is rare and this way the draw pass has no work to do. */
let wallRunCache={sig:null, elevRef:null, runs:[]};
/* Rotation is deliberately NOT in this key. Camera facing decides what is
   DRAWN, and it used to be baked in here — which made the runs, and therefore
   the linear feet the planting list bills from them, change when the gardener
   turned the view: 24.2 / 24.7 / 25.9 / 25.6 ft for one wall at the four
   rotations. A materials estimate cannot depend on where you are standing. So
   the contour is traced once and paintWallRuns splits it by facing at bake
   time instead. */
function wallRunKey(){ return game.terrainRev+'|'+GW+'x'+GH+'|'+game.edgeStyle; }
/* Walk one traced outline of a level, emitting its unit edges with what sits
   outside each. Mirrors terrainUnitEdges — of the two tiles flanking an edge,
   the one not in the set is out — but the question asked is the drop, not the
   hardness. */
function elevationUnitEdges(loop, set, h){
  const out=[], kx=k=>+k.slice(0,k.indexOf(',')), ky=k=>+k.slice(k.indexOf(',')+1);
  for (let i=0;i<loop.length;i++){
    const a=loop[i], b=loop[(i+1)%loop.length];
    const dx=Math.sign(b[0]-a[0]), dy=Math.sign(b[1]-a[1]);
    let x=a[0], y=a[1];
    while (x!==b[0] || y!==b[1]){
      const nx=x+dx, ny=y+dy;
      let inK, outX, outY;
      if (dx!==0){ const tx=Math.min(x,nx);
        if (set.has(tx+','+(y-1))){ inK=tx+','+(y-1); outX=tx; outY=y; }
        else { inK=tx+','+y; outX=tx; outY=y-1; } }
      else { const ty=Math.min(y,ny);
        if (set.has((x-1)+','+ty)){ inK=(x-1)+','+ty; outX=x; outY=ty; }
        else { inK=x+','+ty; outX=x-1; outY=ty; } }
      // to soft ground: down to where its surface meets the face, in whole levels
      const drop=isSoftTile(outX,outY) ? Math.round(softFaceDrop(kx(inK),ky(inK),outX-kx(inK),outY-ky(inK),h)) : h-elevationAt(outX,outY);
      const ci=inK.indexOf(','), ix=+inK.slice(0,ci), iy=+inK.slice(ci+1);
      const n=[outX-ix, outY-iy];
      /* A RIDGE face: the far side of this same tile also falls away, so the
         two faces are the two sides of ONE wall and the run is billed for one
         of them. That is the difference between a terrace, whose contour IS its
         wall, and a wall painted one tile wide, whose contour runs up one side
         and back down the other. */
      const ridge=elevationAt(ix-n[0], iy-n[1])<h;
      /* STEPS (0.9.151). A face on a step is a RISER where it faces the way the
         flight goes down, and a cheek otherwise; the face down ONTO the top step
         is that flight's top riser, faced in the flight's material, with the
         coping of the terrace it hangs from (capWall) kept across it. */
      const sIn=stepDirAt(ix,iy), sOut=stepDirAt(outX,outY), own=wallStyleAt(ix,iy);
      const riser=!!((sIn && sIn[0]===n[0] && sIn[1]===n[1]) || (sOut && sOut[0]===n[0] && sOut[1]===n[1]));
      const wall=(!sIn && sOut && riser) ? wallStyleAt(outX,outY) : own;
      out.push({a:[x,y], b:[nx,ny], drop, n, ridge, wall, capWall:own, step:!!sIn, riser, seed:tileSeed(ix,iy), tile:inK});
      x=nx; y=ny;
    }
  }
  return out;
}
// a step's faces are not a terrace's: a run never mixes the two, nor a riser with a cheek
function wallRunSplits(p,q){ return p.step!==q.step || p.riser!==q.riser || p.capWall!==q.capWall; }
function buildElevationRuns(){
  const sig=wallRunKey();
  if (wallRunCache.sig===sig && wallRunCache.elevRef===game.elevation) return wallRunCache.runs;
  const t0=dnow();
  const runs=[];
  /* A face belongs to the HIGHER tile, and for a HOLLOW the higher tile is
     ordinary ground at grade -- which carries no elevation record, so nothing
     here would ever index it and a sunken patio traced no wall at all. The rim
     is therefore collected explicitly: any in-bounds neighbour of a below-grade
     tile that stands above it. Raised ground is indexed exactly as before, so a
     terrace still traces one solid set rather than a ring. */
  const byLevel={}, addLevel=(x,y)=>{
    const h=elevationAt(x,y);
    (byLevel[h]||(byLevel[h]=new Set())).add(x+','+y);
  };
  const rim=new Set();
  for (const k in game.elevation||{}){
    const e=game.elevation[k]; if (!e||e.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const h=elevationAt(x,y);
    if (isSoftTile(x,y)) continue;              // shaped earth has no face
    if (h>0) addLevel(x,y);
    else if (h<0) for (const [dx,dy] of ELEV_DIRS){
      const nx=x+dx, ny=y+dy;
      if (nx>=0&&ny>=0&&nx<GW&&ny<GH && elevationAt(nx,ny)>h && !isSoftTile(nx,ny)) rim.add(nx+','+ny);
    }
  }
  for (const k of rim){
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    addLevel(x,y);
  }
  for (const hs of Object.keys(byLevel).sort((p,q)=>(+p)-(+q))){
    const h=+hs, set=byLevel[hs];
    for (const loop of traceOutlines(set)){
      const es=elevationUnitEdges(loop,set,h);
      const n=es.length;
      const drawable=e=>e.drop>0;
      // a run breaks where the face stops, changes depth, or changes material
      const breaks=i=>{
        const prev=es[(i+n-1)%n], cur=es[i];
        if (!drawable(cur) || !drawable(prev)) return true;
        return prev.drop!==cur.drop || prev.wall!==cur.wall || wallRunSplits(prev,cur);
      };
      let start=-1;
      for (let i=0;i<n;i++) if (breaks(i)){ start=i; break; }
      if (start<0){                                   // the whole loop is one wall
        if (!drawable(es[0])) continue;
        runs.push(makeWallRun(es.slice(),h));
        continue;
      }
      let pend=null;
      const flush=()=>{ if (pend && pend.length) runs.push(makeWallRun(pend,h)); pend=null; };
      for (let s2=0;s2<n;s2++){
        const i=(start+s2)%n, e=es[i];
        if (!drawable(e)){ flush(); continue; }
        if (pend && (pend[0].drop!==e.drop || pend[0].wall!==e.wall || wallRunSplits(pend[0],e))) flush();
        if (!pend) pend=[];
        pend.push(e);
      }
      flush();
    }
  }
  runs.sort((p,q)=>p.h-q.h);      // low terraces first, so a higher one paints over
  wallRunCache={sig, elevRef:game.elevation, runs};
  dev('wallrun',t0);
  return runs;
}
/* Shape a contiguous stretch of face into a polyline. Smoothed the same way a
   soft terrain arc is, and with the same jitter SEED, so where a terrace's
   material outline and its level outline coincide the cap and the face land on
   the same curve. Formal edges keep the exact tile line, because that is what
   the ground above them draws too. */
function wallRunPoints(edges){
  let p=mergeCollinearOpen(edges.map(e=>e.a).concat([edges[edges.length-1].b]));
  if (game.edgeStyle==='organic' && p.length>2){
    p=dpOpen(p, TERRAIN_SIMPLIFY_EPS);
    p=p.map((q,i)=>{ if (i===0||i===p.length-1) return q;
      const [jx,jy]=planJitter(q[0],q[1]); return [q[0]+jx*0.55, q[1]+jy*0.55]; });
  }
  return p;
}
function polyTiles(p){
  let d=0; for (let i=1;i<p.length;i++) d+=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]);
  return d;
}
function makeWallRun(edges,h){
  const p=wallRunPoints(edges), e=edges[0], tiles=polyTiles(p);
  let weight=0; for (const q of edges) weight+=q.ridge?0.5:1;
  return {pts:p, edges, h, drop:e.drop, wall:e.wall, capWall:e.capWall, step:!!e.step, riser:!!e.riser,
          seed:e.seed, tiles, billTiles:tiles*(weight/edges.length)};
}
/* Linear feet the planting list bills — the traced contour, not a count of
   exposed tile faces. Faces double-count a diagonal (every step contributes
   both of its sides), so the wall in the garden that prompted this was billed
   at 54 ft for a run of about 24. It is a number somebody quotes from. */
function wallRunFeet(run){ return run.billTiles*TILE_IN/12; }
// how high its face stands, in inches: the drop, and a wall's own proud top
function wallRunFaceIn(run,st){ st=st||wallStyle(run.wall); return run.drop*ELEV_RISER_IN+(st.cope?0:(st.capIn||0)); }
/* The faced runs, drawn after the ground and its material blobs. A wall hangs
   DOWN from its terrace edge, so it has to come after the surface it belongs to
   or the blob would paint over its own coping; runs are ordered low terrace
   first so a higher one in front covers a lower one behind. (Known limit, the
   same one the blob pass has: a much higher terrace standing in front of a low
   wall can still overdraw it.)
   Facing is applied HERE rather than in the trace, so the cached contour — and
   the feet billed from it — do not change when the camera turns. */
/* Two kinds of wall since 0.9.143. A raised bed's runs along its bed's curve
   (paintRaisedBedWall). Every other wall stands on the TILE edge, in organic
   gardens too: the bed or lawn on top now runs exactly to that edge, and a wall
   smoothed on its own drifted off it (sky showed in the gap) and, split by facing
   before smoothing, came apart on a diagonal. The feet BILLED are still measured
   along the smoothed contour (makeWallRun), so a diagonal is not billed twice. */
function wallRunDrawPoints(edges){
  return mergeCollinearOpen(edges.map(e=>e.a).concat([edges[edges.length-1].b]));
}
/* `ex` and `rect` are paintGround's: the bake's margin past the viewport, and the
   band a partial bake is repainting. The wall pass used to cull to the viewport
   alone, so a wall in the margin was left out of the bake and popped in at the
   pan-settle rebake, and a band bake drew every wall in view, clipped away. */
function paintWallRuns(ctx,W,H,amb,ex,rect){
  const runs=buildElevationRuns(), rbt=raisedBedTiles();
  const beds=rbt ? buildTerrainRegions().filter(r=>r.raised) : [];
  if (!runs.length && !beds.length) return;
  const face=viewDirToWorld(1,0), side=viewDirToWorld(0,1);
  const shown=e=>((e.n[0]===face[0]&&e.n[1]===face[1])||(e.n[0]===side[0]&&e.n[1]===side[1]))
    && !(rbt && rbt.has(e.tile));                 // a raised bed draws its own, along its curve
  ex=ex||0;
  const inView=(x0,x1,y0,y1)=>!(x1<-TILE_W-ex || x0>W+TILE_W+ex || y1<-TILE_H-ex || y0>H+TILE_H*2+ex) &&
    !(rect && (x1<rect[0]-8 || x0>rect[2]+8 || y1<rect[1]-8 || y0>rect[3]+8));
  const snow=!!(amb && amb.snow), endsFor=wallRunEndsFor(runs);
  const jobs=[];
  for (const r of beds) jobs.push([r.elev, ()=>paintRaisedBedWall(ctx,r,W,H,inView,snow)]);
  for (const run of runs) jobs.push([run.h, ()=>paintWallRun(ctx,run,W,H,shown,inView,snow,rbt,endsFor)]);
  jobs.sort((a,b)=>a[0]-b[0]);                    // low terraces first, as before
  for (const j of jobs) j[1]();
}
/* A lattice run's top, as drawWallCap wants it: the face line on the tile edges,
   which side is the ground it holds (from the first edge: its outward normal `n`
   points at the lower tile), and whether it closes on itself. Shared by the
   garden and the plan sheet, so the two cannot disagree about where a top runs. */
// what a step run's tread is laid in: the paving on its first tile, or null
function stepTreadOf(run){
  const t=game.terrain && game.terrain[run.edges[0].tile];
  return (t && !t.removed && t.k==='path') ? pathColorId(t.c) : null;
}
function wallRunCapGeom(run){
  const e0=run.edges[0], d=[e0.b[0]-e0.a[0],e0.b[1]-e0.a[1]], last=run.edges[run.edges.length-1];
  return {pts:wallRunDrawPoints(run.edges), sgn:Math.sign((-e0.n[0])*(-d[1])+(-e0.n[1])*d[0])||1,
          closed:last.b[0]===e0.a[0]&&last.b[1]===e0.a[1]};
}
/* Where one run's top meets another's at a corner (a sunken patio's rim is
   several runs), each needs the other's direction to mitre the corner. Keyed by
   the vertex AND the level, since only a top at the same height carries on. */
/* A step's riser and its cheek are separate runs too, and their nosings mitre the
   same way, though only with each other: a step's nosing never joins a coping. */
function wallRunEndsFor(runs){
  const ends=new Map(), endKey=(p,h,s)=>p[0]+','+p[1]+','+h+(s?'s':'');
  for (const run of runs){ if (!wallStyle(run.wall).cap && !run.step) continue;
    const a=run.edges[0], b=run.edges[run.edges.length-1];
    if (b.b[0]===a.a[0]&&b.b[1]===a.a[1]) continue;
    for (const [p,e] of [[a.a,a],[b.b,b]]){ const k=endKey(p,run.h,run.step);
      (ends.get(k)||ends.set(k,[]).get(k)).push({run,n:[-e.n[0],-e.n[1]]}); } }
  return run=>{ const a=run.edges[0], b=run.edges[run.edges.length-1];
    const other=p=>{ const l=ends.get(endKey(p,run.h,run.step))||[]; const o=l.find(q=>q.run!==run); return o?o.n:null; };
    return {n0:other(a.a), n1:other(b.b)}; };
}
/* The projector a wall's top is drawn through: tile-corner coordinates on a
   terrace `lift` draw units up, and zIn inches above it. */
function wallCapProj(W,H,lift){
  return (gx,gy,zIn)=>{ const q=screenOfCorner(gx,gy,W,H); return [q[0],q[1]-lift-zIn*EDGE_RISE_PX]; };
}
function paintWallRun(ctx,run,W,H,shown,inView,snow,rbt,endsFor){
  const st=wallStyle(run.wall);
  if (!st.face) return;                           // bare earth: drawn per tile above
  const lift=run.h*ELEV_STEP, fall=run.drop*ELEV_STEP;
  const all=wallRunDrawPoints(run.edges);
  if (inView){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const [gx,gy] of all){ const q=screenOfCorner(gx,gy,W,H);
      if (q[0]<minX) minX=q[0]; if (q[0]>maxX) maxX=q[0]; if (q[1]<minY) minY=q[1]; if (q[1]>maxY) maxY=q[1]; }
    const reach=TILE_W*0.6;                       // the top's offset along the ground, either way
    if (!inView(minX-reach,maxX+reach,minY-lift-reach-(st.capIn||0)*EDGE_RISE_PX,maxY-lift+fall+reach)) return;
  }
  // a step's faces stand behind taller ground often enough to need hiding (stepFaceOccluders)
  const hide=(run.step||run.riser) ? stepFaceOccluders(run,W,H) : null;
  if (hide){ ctx.save(); for (const d of hide){ ctx.beginPath(); ctx.rect(-1e6,-1e6,2e6,2e6);
    ctx.moveTo(d[0][0],d[0][1]); for (let i=1;i<4;i++) ctx.lineTo(d[i][0],d[i][1]); ctx.closePath(); ctx.clip('evenodd'); } }
  try { paintWallRunBody(ctx,run,W,H,shown,snow,rbt,endsFor,st,lift,fall); }
  finally { if (hide) ctx.restore(); }
}
/* WALLS ARE DRAWN AFTER ALL THE GROUND (paintWallRuns), so a face standing behind
   taller ground is painted over it. That was rare while a wall meant a terrace,
   and with steps it is every flight seen from its terrace's side: each step's
   side would show through the terrace in front of it. So a step's faces are
   clipped by the tops of the taller tiles in front of them, those in a 4 x 4
   window toward the camera from each face that stand above the face's top.
   Each is clipped out on its own (a clip intersects the one before, so the
   result is everything but their union). Null when nothing is in front. */
function stepFaceOccluders(run,W,H){
  const face=viewDirToWorld(1,0), side=viewDirToWorld(0,1), seen=new Set(), out=[];
  for (const e of run.edges){
    const n=e.n, s=(n[0]===face[0]&&n[1]===face[1]) ? side : (n[0]===side[0]&&n[1]===side[1]) ? face : null;
    if (!s) continue;                               // facing away: not drawn
    const ci=e.tile.indexOf(','), tx=+e.tile.slice(0,ci), ty=+e.tile.slice(ci+1);
    for (let a=0;a<4;a++) for (let b=0;b<4;b++){
      if (!a && !b) continue;
      const x=tx+a*s[0]+b*n[0], y=ty+a*s[1]+b*n[1], k=x+','+y;
      if (seen.has(k) || x<0||y<0||x>=GW||y>=GH) continue;
      seen.add(k);
      const h=elevationAt(x,y); if (h<=run.h) continue;
      // a little over a pixel larger than the tile, or the seam between two shows a hairline of the face
      const c=screenOfCorner(x+0.5,y+0.5,W,H);
      out.push([[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([qx,qy])=>{ const q=screenOfCorner(qx,qy,W,H);
        return [q[0]+(q[0]-c[0])*0.04, q[1]+(q[1]-c[1])*0.04-h*ELEV_STEP]; }));
    }
  }
  return out.length ? out : null;
}
function paintWallRunBody(ctx,run,W,H,shown,snow,rbt,endsFor,st,lift,fall){
  let piece=[];
  const emit=()=>{
    if (piece.length>0){
      const p=wallRunDrawPoints(piece);
      drawWallRun(ctx,p.map(([gx,gy])=>{ const q=screenOfCorner(gx,gy,W,H); return [q[0],q[1]-lift]; }),fall,st,piece[0].seed,polyTiles(p));
    }
    piece=[];
  };
  for (const e of run.edges){ if (shown(e)) piece.push(e); else emit(); }
  emit();
  // the top, round the whole run whichever way it faces; a raised bed's tiles
  // draw theirs along the bed's curve
  if (rbt && run.edges.every(e=>rbt.has(e.tile))) return;
  const g=wallRunCapGeom(run);
  // a step has its tread's nosing, not a coping (drawStepNosing)
  if (run.step){ drawStepNosing(ctx,g.pts,g.sgn,g.closed,st,stepTreadOf(run),wallCapProj(W,H,lift),snow,g.closed||!endsFor?null:endsFor(run)); return; }
  // the top riser keeps the coping of the terrace it hangs from
  const cs=run.capWall && run.capWall!==run.wall && wallStyle(run.capWall).cap ? wallStyle(run.capWall) : st;
  drawWallCap(ctx,g.pts,g.sgn,g.closed,cs,wallCapProj(W,H,lift),run.edges[0].seed,snow,g.closed||!endsFor?null:endsFor(run));
}
/* A fixed order for painting a region's grain, where the flood's order would do
   for everything else. Grains of neighbouring tiles overlap a little, so paint
   order decides a few pixels; the flood's order changes with any edit to the
   region, so one tile dug out of a bed reshuffled which shred lay on top dozens of
   tiles away. Those pixels are not repainted by an edit (groundEditRect), and a
   later full bake would change them under a gardener who had touched nothing. */
function tilesInPaintOrder(keys){
  return [...keys].map(k=>{ const ci=k.indexOf(','); return [+k.slice(ci+1),+k.slice(0,ci),k]; })
    .sort((a,b)=>(a[0]-b[0])||(a[1]-b[1])).map(a=>a[2]);
}
function buildTerrainRegions(){
  const sig=terrainRegionKey();
  if (terrainLoopCache.sig===sig && terrainLoopCache.terrainRef===game.terrain &&
      terrainLoopCache.elevRef===game.elevation) return terrainLoopCache.regions;
  const tTrace=dnow();   // cache miss only: this is the per-EDIT trace, not per-frame
  const solid={};  // every live terrain tile, any material — the hardness lookup
  const keyOf={};  // "x,y" -> kind|colour|elev (regions split at all three)
  const rankAt={}; // "x,y" -> TERRAIN_RANK: which of two materials is laid on top
  const elevAt={}; // "x,y" -> level, so a skirt only runs under a coverer at its own height
  const crispAt={}; // "x,y" -> a formal pool: square, and squared against
  for (const k in game.terrain){ const o=game.terrain[k];
    if (!o || o.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    solid[k]=true;
    if (o.k==='water' && waterStyle(o.c).crisp) crispAt[k]=true;
    rankAt[k]=terrainRank(o.k);
    elevAt[k]=regionLevelAt(x,y);
    keyOf[k]=o.k+'|'+(o.c||'')+'|'+elevAt[k];
  }
  const seen={}, regions=[];
  for (const k in keyOf){
    if (seen[k]) continue;
    const key=keyOf[k], stack=[k], set=new Set();
    seen[k]=true;
    while (stack.length){
      const cur=stack.pop(); set.add(cur);
      const ci=cur.indexOf(','), cx2=+cur.slice(0,ci), cy2=+cur.slice(ci+1);
      // 8-connectivity: tiles of one material touching only at a corner join
      // one region; the pinch handling in terrainLoopArcs makes the lobes
      // actually meet at that corner instead of both rounding away from it
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nk=`${cx2+dx},${cy2+dy}`;
        if (seen[nk] || keyOf[nk]!==key) continue;
        seen[nk]=true; stack.push(nk);
      }
    }
    const o=game.terrain[k];
    const rank=terrainRank(o.k), elev=elevAt[k], raised=raisedBedInfo(set,elev);
    const unit=traceOutlines(set).map(l=>terrainUnitEdges(l,set,solid,rank,rankAt,elev,elevAt,!!raised,crispAt,!!crispAt[k]));
    const useCount={};
    for (const es of unit) for (const e of es){
      const vk=e.a.join(','); useCount[vk]=(useCount[vk]||0)+1; }
    // saddle: at this corner, two solid tiles meet only diagonally across
    // grass — pin it in BOTH regions so their curves connect at the point
    const sTile=(tx,ty)=>!!solid[tx+','+ty];
    const saddle=(x,y)=>{
      const nw=sTile(x-1,y-1), ne=sTile(x,y-1), sw=sTile(x-1,y), se=sTile(x,y);
      return (nw&&se&&!ne&&!sw)||(ne&&sw&&!nw&&!se);
    };
    const coveredAt=(tx,ty)=>{ const kk=tx+','+ty; return !!solid[kk] && rankAt[kk]>rank && elevAt[kk]===elev; };
    const skirts=[];
    for (const es of unit){ const s=terrainSkirts(es,coveredAt); if (s) skirts.push(...s); }
    // a raised bed's corners round by a tile at most, so a rectangle keeps its
    // straight walls (built walls are straight) and a curved bed still curves
    const fillet=raised ? Math.min(terrainFillet(o.k),RAISED_BED_FILLET) : terrainFillet(o.k);
    let soft=false; for (const t of set){ const ci=t.indexOf(','); if (isSoftTile(+t.slice(0,ci),+t.slice(ci+1))){ soft=true; break; } }
    regions.push({ kind:o.k, c:o.c, rank, elev, soft, tiles:set, paintTiles:tilesInPaintOrder(set),
      loops:unit.map(es=>{ const L=terrainLoopArcs(es,useCount,saddle,fillet);
        /* Which hand the outside is on as the loop is walked: the sign of
           direction x outward normal, the same for every edge of a traced loop,
           and the arcs keep the trace's order. A raised bed's wall uses it to
           know which way each stretch of its curve faces. */
        const e=es[0]; L.side=Math.sign((e.b[0]-e.a[0])*e.n[1]-(e.b[1]-e.a[1])*e.n[0])||1;
        return L; }),
      skirts:skirts.length?skirts:null, raised });
  }
  // Elevation first — higher terraces paint over lower edges — then rank, so a
  // path lands on the bed it runs through rather than the other way round. The
  // soft-edge classification above assumes exactly this order.
  regions.sort((a,b)=>(a.elev-b.elev)||(a.rank-b.rank));
  exposeSkirtTiles(regions);
  for (const r of regions) if (r.skirts) for (const s of r.skirts) s.tiles=tilesInPaintOrder(s.tiles);
  const raisedTiles=new Set();
  for (const r of regions) if (r.raised) for (const t of r.tiles) raisedTiles.add(t);
  terrainLoopCache={sig, terrainRef:game.terrain, elevRef:game.elevation, regions, raisedTiles};
  dev('trace',tTrace);
  return regions;
}
/* ---------- raised beds ----------
   A raised bed is a bed that is the WHOLE top of its terrace, faced all round in
   one wall material at one height: what the Terrace tool builds and then a bed
   painted over it. Its bed and its wall share ONE outline. The bed keeps its
   soft, traced curve (corners rounding by RAISED_BED_FILLET at most), and the wall
   is drawn along that same curve (paintRaisedBedWall), where it used to be drawn
   along the tile lattice under a bed that rounded away from it: an oval of soil
   on a box of lawn, and on a curved bed a wall broken into pieces. Anything else
   on a terrace (a top only partly planted, a mix of materials, a bank rather than
   a wall, a bed against the plot line or a house) keeps the tile edge, and its
   bed runs exactly to it. Organic gardens only: a formal one is the lattice. */
const RAISED_BED_FILLET = 1;
function raisedBedInfo(set,elev){
  if (!(elev>0)) return null;
  let wall=null, drop=0;
  for (const k of set){
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    for (const [dx,dy] of ELEV_DIRS){
      const nx=x+dx, ny=y+dy;
      if (set.has(nx+','+ny)) continue;
      if (!onPlot(nx,ny) || siteStructureAt(nx,ny)) return null;
      const nh=elevationAt(nx,ny)||0;
      if (nh>=elev) return null;                   // the top is shared with something else
      const w=wallStyleAt(x,y), d=elev-nh;
      if (!wallStyle(w).face) return null;         // a bank is drawn tile by tile
      if (wall===null){ wall=w; drop=d; } else if (w!==wall || d!==drop) return null;
    }
  }
  return wall ? {wall, drop} : null;
}
// the tiles of raised beds, which the tile pass and the lattice walls leave to the bed
function raisedBedTiles(){
  if (game.edgeStyle!=='organic') return null;
  buildTerrainRegions();
  const s=terrainLoopCache.raisedTiles;
  return s && s.size ? s : null;
}
/* A raised bed's wall, along the bed's own curve. Only the stretches whose
   outward side faces the camera are drawn, judged segment by segment on the
   smoothed curve: splitting the TILE edges by facing first and then smoothing
   each piece on its own is what broke a curved terrace's wall into fragments,
   since along a diagonal every other tile edge faces away. */
function paintRaisedBedWall(ctx,region,W,H,inView,snow){
  const st=wallStyle(region.raised.wall);
  if (!st.face) return;
  const lift=region.elev*ELEV_STEP, fall=region.raised.drop*ELEV_STEP;
  const scr=p=>{ const q=screenOfCorner(p[0],p[1],W,H); return [q[0],q[1]-lift]; };
  const first=region.tiles.values().next().value, ci=first.indexOf(',');
  const seed=tileSeed(+first.slice(0,ci),+first.slice(ci+1));
  if (inView){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const k of region.tiles){ const c=k.indexOf(','), q=screenOfFlat(+k.slice(0,c),+k.slice(c+1),W,H);
      if (q[0]<minX) minX=q[0]; if (q[0]>maxX) maxX=q[0]; if (q[1]<minY) minY=q[1]; if (q[1]>maxY) maxY=q[1]; }
    if (!inView(minX-TILE_W,maxX+TILE_W,minY-lift-TILE_H*2,maxY-lift+fall+TILE_H*2)) return;
  }
  let pieceNo=0;
  for (const loop of region.loops){
    const side=loop.side||1;
    for (const arc of (loop.closed?[loop]:loop.arcs)){
      if (arc.hard || arc.covered) continue;
      const wp=edgingCurvePoints(arc,p=>p);
      let piece=[], len=0;
      // each stretch its own seed, or every stretch of a bed starts with the same stones
      const emit=()=>{ if (piece.length>1) drawWallRun(ctx,piece.map(scr),fall,st,(seed^Math.imul(++pieceNo,0x9e3779b1))>>>0,len); piece=[]; len=0; };
      for (let i=1;i<wp.length;i++){
        const a=wp[i-1], b=wp[i], dx=b[0]-a[0], dy=b[1]-a[1], m=Math.hypot(dx,dy);
        if (!(m>1e-9)){ continue; }
        /* the outward normal, from the trace's winding (loop.side): asking which
           side of the curve is a bed tile fails at a rounded corner, where the
           curve runs inside the tiles and both sides of it are bed */
        const nx=-dy/m*side, ny=dx/m*side;
        const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
        const s0=scr([mx,my]), s1=scr([mx+nx*0.25,my+ny*0.25]);
        if (s1[1]>s0[1]+1e-6){ if (!piece.length) piece.push(a); piece.push(b); len+=m; }
        else emit();
      }
      emit();
      // the top, all the way round; the trace's winding says which side is the bed
      drawWallCap(ctx,wp,-side,!!loop.closed,st,wallCapProj(W,H,lift),seed,snow);
    }
  }
}
/* Could a region tile's drawing land in this band of the bake? The same slack
   paintGround's tile loop allows: a tile's own diamond, the bleed and skirt past
   it, an edging stroke, and standing grain. */
function tileReachesRect(sx,sy,rect){
  return !(sx<rect[0]-TILE_W||sx>rect[2]+TILE_W||sy<rect[1]-TILE_H*3||sy>rect[3]+TILE_H*3);
}
/* One clipped pass of per-tile grain: a region's own, or one of its skirts.
   A partial bake must bound this loop by its rectangle (paintGround explains why
   a clip alone does not), and it did not: the tile bbox of a thin band is a wide
   diagonal parallelogram, so on a small plot every bed tile laid its grain again,
   all of it clipped away. Measured on a 31x31 garden, one background ground job,
   48 chunks, cost 11,661 tile draws where a full bake costs 1,618, and Firefox's
   sustained pan went 28.8ms -> 6.1ms a frame with the band cull. Pixel-identical
   on a software canvas.
   The flagstone scratch lives for one pass and not for the region, because a
   stone the region drew under its own clip still has to be drawn under the
   skirt's. */
/* Light and shade over a material's grain on soft ground: its grain covers most
   of its base, so a lit base would barely show. A translucent wash a TRIANGLE,
   the exact ramp of its three corners' light, which its neighbours share, so it
   runs on across the slope; a ramp fitted a tile met its neighbour a shade off
   and drew the tiles as a mosaic over a dark mulch. The ramp has to follow the
   tone through its bends too (softWashFill), or it is the triangles that show.

   soft-light, so a dark mulch darkens and lightens as itself rather than being
   washed with cream or green; the ramp is doubled to carry through it.

   The blend is what costs, per DRAW: a fill in soft-light is several times one in
   source-over, whatever its size, and this was a fill a triangle, four a tile.
   Measured (0.9.169) on a 31x31 garden with 183 soft tiles under beds and meadow,
   a full ground bake: 44-52 ms in Chrome against 20-22 with no wash, the same
   triangles filled flat in soft-light 49 ms, flat in source-over 21, the region
   clip nothing. So on a ground bake the triangles are laid into ONE scratch with
   `lighter` and the scratch goes down once in soft-light (softWashBatch). `lighter`
   ADDS, so the two partial coverages along a shared edge sum to the whole, which
   source-over would not, and a pixel inside a triangle is the triangle's own tone
   either way. The portrait, and any canvas that is not a bake surface, keeps the
   fill a triangle: a portrait must have nothing accelerated composited into it. */
function softShadeOverlay(ctx,tiles,rect){
  if (!tiles.length) return;
  if ((ctx===groundCtx || ctx===groundSpareCtx) && softWashBatch(ctx,tiles,rect)) return;
  const was=ctx.globalCompositeOperation; ctx.globalCompositeOperation='soft-light';
  for (const tris of tiles) for (const t of tris){
    ctx.fillStyle=softWashFill(ctx,t.l,t.vl);
    ctx.beginPath(); ctx.moveTo(t.l[0][0],t.l[0][1]); ctx.lineTo(t.l[1][0],t.l[1][1]); ctx.lineTo(t.l[2][0],t.l[2][1]); ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation=was;
}
/* The wash for a ground bake, as one draw (softShadeOverlay). The scratch is the
   triangles' box in DEVICE pixels, whole pixels, so it lands on the canvas with no
   resampling and its triangles rasterise exactly as they would on the canvas: a
   band of a partial bake and a full bake agree. It comes from spriteBakeSurface and
   leaves as an ImageBitmap, which is what keeps Firefox's canvas on the GPU (the
   sprite note in §11), and is retired a frame later like a sprite. The canvas's
   clip (the region's outline, a band's rectangle) still applies to the draw.
   False where it cannot run (no getTransform), and the caller fills per triangle. */
function softWashBatch(ctx,tiles,rect){
  const m=typeof ctx.getTransform==='function' ? ctx.getTransform() : null;
  if (!m || !Number.isFinite(m.a) || !ctx.canvas) return false;
  const dx=(x,y)=>m.a*x+m.c*y+m.e, dy=(x,y)=>m.b*x+m.d*y+m.f;
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for (const tris of tiles) for (const t of tris) for (const p of t.l){
    const X=dx(p[0],p[1]), Y=dy(p[0],p[1]);
    if (X<x0) x0=X; if (X>x1) x1=X; if (Y<y0) y0=Y; if (Y>y1) y1=Y;
  }
  if (rect){                                       // a band: no need for more than it
    const rx=[dx(rect[0],rect[1]),dx(rect[2],rect[1]),dx(rect[0],rect[3]),dx(rect[2],rect[3])];
    const ry=[dy(rect[0],rect[1]),dy(rect[2],rect[1]),dy(rect[0],rect[3]),dy(rect[2],rect[3])];
    x0=Math.max(x0,Math.min(...rx)); x1=Math.min(x1,Math.max(...rx));
    y0=Math.max(y0,Math.min(...ry)); y1=Math.min(y1,Math.max(...ry));
  }
  const bx=Math.max(0,Math.floor(x0)-2), by=Math.max(0,Math.floor(y0)-2);
  const bw=Math.min(ctx.canvas.width,Math.ceil(x1)+2)-bx, bh=Math.min(ctx.canvas.height,Math.ceil(y1)+2)-by;
  if (!(bw>0 && bh>0)) return true;                // none of it on this canvas
  const surf=spriteBakeSurface('wash',bw,bh), g=surf.getContext('2d');
  if (!g) return false;
  g.setTransform(m.a,m.b,m.c,m.d,m.e-bx,m.f-by);
  g.globalCompositeOperation='lighter';
  for (const tris of tiles) for (const t of tris){
    g.fillStyle=softWashFill(g,t.l,t.vl);
    g.beginPath(); g.moveTo(t.l[0][0],t.l[0][1]); g.lineTo(t.l[1][0],t.l[1][1]); g.lineTo(t.l[2][0],t.l[2][1]); g.closePath();
    g.fill();
  }
  const img=spriteBakeImage('wash',surf);
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1; ctx.globalCompositeOperation='soft-light';
  ctx.drawImage(img,bx,by);
  ctx.restore();
  retireSpriteImage(img);
  return true;
}
function paintRegionGrain(ctx,tiles,region,o,base,isWater,amb,x0,x1,y0,y1,W,H,rect){
  flagRegionBegin();
  const softTris=[];
  try{
    for (const kk of tiles){ const c=kk.indexOf(',');
      const tx=+kk.slice(0,c), ty=+kk.slice(c+1);
      if (tx<x0-2||tx>x1+2||ty<y0-2||ty>y1+2) continue;
      const [sx,sy]=screenOf(tx,ty,W,H);
      if (rect && !tileReachesRect(sx,sy,rect)) continue;
      if (!isWater && isSoftTile(tx,ty)){
        // on the slope: each triangle, through its shear (paintSoftTile)
        // its grain once, through the tile's plane, clipped to the tile (paintSoftTile)
        const [fx,fy]=screenOfFlat(tx,ty,W,H), tris=softTileTris(tx,ty,W,H), ol=tris.outline;
        ctx.save();
        ctx.beginPath(); ol.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); ctx.clip();
        ctx.transform(...tris.plane);
        drawGroundTexture(ctx,fx,fy,tx,ty,region.kind,region.kind==='path',amb,base,mulberry(tileSeed(tx,ty)),o,'marks');
        ctx.restore();
        softTris.push(tris);
        continue;
      }
      const rs=mulberry(tileSeed(tx,ty));
      if (isWater) drawWaterTexture(ctx,sx,sy,tx,ty,o,amb,true);
      // skipBase: the region silhouette above already laid this material's base
      // across every one of these tiles, so the per-tile base fill would only
      // repaint it — a full-tile fill on every tile of every bed.
      else drawGroundTexture(ctx,sx,sy,tx,ty,region.kind,region.kind==='path',amb,base,rs,o,true);
    }
    softShadeOverlay(ctx,softTris,rect);
  } finally { flagRegionEnd(); }
}
function paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t,rect){
  for (const region of buildTerrainRegions()){
    let vis=false;
    for (const kk of region.tiles){ const c=kk.indexOf(',');
      const tx=+kk.slice(0,c), ty=+kk.slice(c+1);
      if (tx<x0-2||tx>x1+2||ty<y0-2||ty>y1+2) continue;
      if (rect){ const [sx,sy]=screenOf(tx,ty,W,H); if (!tileReachesRect(sx,sy,rect)) continue; }
      vis=true; break; }
    if (!vis) continue;
    const isWater=region.kind==='water', o={k:region.kind,c:region.c};
    const base = isWater ? waterFill(o,amb.snow)
      : region.kind==='path' ? pathFill(o,amb.snow)
      : region.kind==='lawn' ? lawnFill(o,amb) : bedFill(o,amb);
    // project cached tile-corner geometry into the iso view, lifted to the
    // region's terrace (screenOfFlat + explicit lift: the old screenOf call
    // missed elevation entirely for fractional corners, so raised beds drew flat)
    const lift=region.elev*ELEV_STEP;
    // traceOutlines works on the tile-CORNER lattice, so it needs the corner
    // transform, not the tile one (they only agree at rot 0 — see cornerToView).
    // A region on soft ground follows the surface, point by point.
    const proj=region.soft
      ? softDrapeProj(W,H)
      : ([gx,gy])=>{ const p=screenOfCorner(gx,gy,W,H); return [p[0],p[1]-lift]; };
    // fill the silhouette
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.fillStyle=base; ctx.fill('evenodd');
    // the skirt's base goes down with the silhouette's, BEFORE any grain: its
    // overlap into this region is then covered by this region's own grain
    if (region.skirts) for (const s of region.skirts){ terrainSkirtPath(ctx,s,proj); ctx.fill('evenodd'); }
    // per-tile texture, clipped to the blob (grain/surface marks preserved)
    ctx.save();
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.clip('evenodd');
    paintRegionGrain(ctx,region.paintTiles,region,o,base,isWater,amb,x0,x1,y0,y1,W,H,rect);
    ctx.restore();
    /* The skirt's grain (terrainSkirts), clipped to the band, on the coverer's
       tiles. The coverer paints after this, so the band only ever shows where
       its curve falls short. */
    if (region.skirts) for (const s of region.skirts){
      ctx.save();
      terrainSkirtPath(ctx,s,proj);
      ctx.clip('evenodd');
      paintRegionGrain(ctx,s.tiles,region,o,base,isWater,amb,x0,x1,y0,y1,W,H,rect);
      ctx.restore();
    }
    /* One continuous edge stroke (replaces the per-tile diamond strokes),
       skipping boundaries a higher-ranked region is about to cover -- and
       skipped ENTIRELY for a surface that declares itself discontinuous.
       Stepping stones are grass with slabs in it, so an outline round the field
       would draw a line where nothing changes. */
    if (!(region.kind==='lawn' && lawnStyle(region.c).noEdge)){
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopStroke(ctx,loop,proj);
    // A mowing line is a soft green shadow, not the earth-dark joint a bed or a
    // path cuts: the two surfaces either side of it are the same stuff at two
    // heights, and a hard brown line there reads as a trench.
    ctx.strokeStyle = isWater ? (amb.snow?'rgba(255,255,255,0.5)':waterStyle(region.c).edge)
      : region.kind==='path' ? 'rgba(60,48,34,0.32)'
      : region.kind==='lawn' ? 'rgba(44,56,32,0.24)' : 'rgba(48,36,24,0.30)';
    ctx.lineWidth=1.6; ctx.stroke();
    }
    /* Edging goes on the SOFT arcs only — the ones facing lawn. A hard arc is
       where this material butts a peer (a bed meeting a path), which already
       reads as a joint and wants no restraint drawn on it, and a covered arc
       is about to be painted over. So the arc classification the blob renderer
       already does is exactly the question edging needed answered. */
    const edging=edgingStyle(regionEdging(region));
    if (edging.w){
      for (const loop of region.loops){
        if (loop.closed){ if (!loop.covered && !loop.hard) strokeEdgingArc(ctx,loop,proj,edging); continue; }
        for (const arc of loop.arcs) if (!arc.covered && !arc.hard) strokeEdgingArc(ctx,arc,proj,edging);
      }
    }
  }
}
/* The region's material: the first tile in it that carries one AND actually
   draws it — a tile with a side facing lawn (edgingDrawsAt, the same predicate
   the planting list bills by and the formal renderer draws by).
   Asking EVERY tile let a buried interior tile — which draws no edging and is
   billed for none — decide the whole outline. Lifting the edging off a bed's
   visible edge then emptied the planting list and changed nothing on screen,
   because one tile in the middle of the bed still carried steel: the bug read
   as "the edging cannot be removed".
   Edging is still not part of the region flood key on purpose — splitting a bed
   into two blobs because half of it is edged would be a much worse artifact
   than resolving one material for the whole outline, and a tap edges the whole
   region anyway (paintEdgingAt). */
/* Since 0.9.142 the tool writes one material to the whole region, so a mixed
   one comes only from two edged beds painted together or an older save. It
   then takes the material carrying the most lawn-facing SIDES rather than the
   first tile the flood happened to reach, so what is drawn no longer depends
   on the order the bed was painted in. 'none' never votes: a stretch with no
   edging must not erase the rest of the outline the planting list bills. */
function regionEdging(region){
  if (region.edging!=null) return region.edging;
  let out='none', best=0;
  const votes={};
  for (const k of region.tiles){
    const t=game.terrain[k];
    if (!t || t.removed) continue;
    const e=edgingStyleId(t.e); if (e==='none') continue;
    const ci=k.indexOf(','), n=edgingSidesAt(+k.slice(0,ci),+k.slice(ci+1));
    if (!n) continue;                               // an interior tile draws none
    votes[e]=(votes[e]||0)+n;
    if (votes[e]>best || (votes[e]===best && e<out)){ best=votes[e]; out=e; }
  }
  /* Memoised onto the region, which rides terrainLoopCache and is therefore
     rebuilt by exactly the edits that could change the answer (terrainRev
     covers a repainted edging as much as a moved tile) — no new cache key, the
     same trick a retaining wall plays on the elevation record. It matters
     because the scan can run the whole region before answering 'none': every
     bake that REUSES the cached trace — a pan settle, a zoom settle, a season
     turn, a rotation — would otherwise pay for it again. Measured on a solid
     39x39 bed edged only in its interior: 2.4ms a call. */
  return (region.edging=out);
}
/* Edging follows the SAME curve the fill drew, sampled into a polyline. Two
   things have to match or the strip sits visibly off its own bed: a closed
   loop is a midpoint spline that WRAPS (it starts halfway along the last
   segment, not at a corner), and an open arc runs corner to corner. Treating
   a closed ring as an open polyline left one side of every bed unedged and a
   tail hanging off the start. */
function edgingCurvePoints(arc, proj){
  if (proj.drape){
    // the curve in tile space, sampled finely enough to follow the slope, then lifted
    const flat=edgingCurvePoints(arc, p=>p), out=[];
    for (let i=0;i<flat.length;i++){
      if (!i){ out.push(proj(flat[0])); continue; }
      const a=flat[i-1], b=flat[i], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/DRAPE_STEP));
      for (let k=1;k<=n;k++) out.push(proj([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]));
    }
    return out;
  }
  const pts=arc.pts.map(proj);
  if (arc.hard || pts.length<3) return arc.closed ? pts.concat([pts[0]]) : pts;
  const SEG=5, out=[];
  terrainCurveWalk(arc.pts, pts, !!arc.closed, {
    move:p=>out.push(p),
    line:p=>out.push(p),
    quad:(from,c,p)=>{ for (let s=1;s<=SEG;s++){ const t=s/SEG, u=1-t;
      out.push([u*u*from[0]+2*u*t*c[0]+t*t*p[0], u*u*from[1]+2*u*t*c[1]+t*t*p[1]]); } },
  }, arc.fillet);
  return out;
}
/* `edgePx` is given only by the plan sheet, which is read from above, so it
   also asks for the flat drawing. The seed comes from the arc's first WORLD
   point, never a screen one: see drawEdgingRun. */
function strokeEdgingArc(ctx,arc,proj,st,edgePx){
  const pts=edgingCurvePoints(arc,proj);
  if (pts.length>=2) drawEdgingRun(ctx,pts,st,edgingArcSeed(arc),edgePx,!!edgePx);
}
function edgingArcSeed(arc){
  const p=arc.pts[0]||[0,0];
  return tileSeed(Math.round(p[0]*8),Math.round(p[1]*8));
}
/* ---------- plant sprite cache (perf) ----------
   drawPlant re-runs a plant's whole procedural recipe every frame, which is
   ~88% of a heavy frame. A plant tile looks identical frame to frame apart
   from a global wind sway, so render it once to a small offscreen canvas —
   keyed by its own seed, so every clump stays unique (no shared variants) —
   and blit it on later frames, shearing the blit for sway. Growth and bloom
   are bucketed so the key is stable across frames; the cache clears on a zoom
   change (sprites bake the current device scale, so a 1:1 blit stays crisp)
   and is evicted LRU under a memory budget. It only kicks in once a frame is
   heavy enough that the bucketing is imperceptible — light gardens keep the
   pristine, smoothly-growing procedural path. Toggle PSPRITE.off to A/B it. */
const PSPRITE={ map:new Map(), slot:new Map(), scale:-1, frame:0, rendered:0, bytes:0,
  MEM:48*1024*1024, BUDGET:160, off:false, active:false,
  FLOOR:3, HI_MS:6, LO_MS:2.5, hot:0, calm:0, plantMs:0,
  /* What the STRUCTURES in the draw pass cost, so the governor can take them
     back out — see the note on updateSpriteMode. Sampled rather than measured
     every frame: a clock pair costs 0.358us, so splitting ~400 structures
     exactly would be 0.14ms on EVERY frame, and at the 0.1ms clock resolution
     this app ships with (no cross-origin isolation) a single ~7us structure
     rounds to zero anyway. Sampling one frame in SAMPLE and smoothing is both
     cheaper and no less accurate. */
  structMs:0, SAMPLE:8, structRing:[], RING:8,
  /* The per-frame budget for bakes that have something to show meanwhile —
     see plantStandInKey. BAKE_MS is JS time spent baking this frame, BAKE_CAP
     a count backstop for the GPU side that JS time cannot see. A cold miss
     with nothing to stand in is not held to either: it bakes up to BUDGET as
     before. `spec` maps a sprite key minus its seed to the newest key baked
     for it, so one clump can borrow a sibling's sprite. */
  BAKE_MS:4, BAKE_CAP:24, bakeMs:0, spec:new Map(),
  /* `cold`: this pass is the garden being prepared behind its cover, where every
     clump bakes its OWN sprite and nothing stands in (prepareGardenOpen).
     `waiting` counts the clumps a frame drew as something other than their own
     current sprite, so the loop keeps full-rate frames coming until it is none
     (spritesPending): at the idle cadence the same catch-up took twice as long. */
  cold:false, waiting:0 };
function spritesPending(){ return PSPRITE.active && !PSPRITE.off && PSPRITE.waiting>0; }
/* sprite-mode governor: engage the cache when the DRAW PHASE is measured
   heavy, not at a fixed plant count — the old 300-plant threshold left a
   typical 150–250 plant design fully procedural forever, even on a window
   where that costs 10ms+ a frame. Now a garden that's cheap on a fast desktop
   stays pristine procedural, and the same garden on a weak GPU or a huge
   window flips to sprites. Turning sprites ON makes draw fast, so the OFF
   decision can't read the live number (it would flap): it predicts what
   procedural WOULD cost — plantCount × a per-plant ms learned (EMA) while
   procedural was last active — and disengages only when that stays cheap.
   The plant floor keeps genuinely light gardens procedural regardless. It was
   40, set when a plant cost a few dozen microseconds; a habit tree or shrub
   now costs 0.5-2ms procedurally, so 25 shrubs and nothing else measured
   12ms a frame and never qualified, where sprites draw them in about 1ms. At 12
   the frame still has to be measured heavy (HI_MS) for 3 frames to engage.
   It is 3 now (0.9.171), for the same reason one step on: ten ninebarks in a new
   garden cost 6.3ms a frame on a desktop (0.6ms each in summer, 2.6 times an
   arrowwood) and several times that on a tablet, and at twelve or fewer they
   could never be cached however slow the frame got. The measurement is the
   gate; the floor only keeps a garden of one or two plants out of it.

   IT IS HANDED THE WHOLE ENTITY PASS AND MUST TAKE THE STRUCTURES BACK OUT.
   `drawMs` covers fences, building tiles, pots, seats, boulders, fire pits,
   pets and houses as well as the planting, and dividing that by plantCount
   alone charged every one of them to the plants. Two things went wrong with
   that, in opposite directions. A garden with light planting and heavy
   hardscape — a courtyard, 60 plants against 400 footprint and fence tiles —
   could push the whole pass over HI_MS on structures alone and engage the
   plant cache for 60 plants that cost about a millisecond: pointless bakes and
   memory. And the per-plant cost it learned from that frame was inflated by
   roughly the structure share, so the disengage predictor (plantCount x
   plantMs) then over-estimated procedural cost and the cache never released —
   a wrong constant that outlives the frame that produced it and poisons every
   later decision in the session.
   Subtracting a SAMPLED absolute rather than a fraction is deliberate: the
   structures cost about the same each frame whether or not the plants are
   sprited, so an absolute stays valid across the flip a fraction would jump
   at. It is floored at zero because a noisy sample can exceed a cheap frame. */
function updateSpriteMode(drawMs, plantCount, structMs){
  if (PSPRITE.off){ PSPRITE.active=false; PSPRITE.hot=0; PSPRITE.calm=0; return; }
  if (structMs!==undefined && structMs!==null && structMs>=0){
    /* A MEDIAN of the last few samples. Both obvious estimators are biased
       here, in opposite directions, and both were tried:
         a mean is dragged UP by real spikes — one 11ms frame (a GC, a ground
         bake landing on the sampled frame) took the estimate from 1.8 to
         2.65ms and it stayed there;
         a minimum is dragged DOWN by quantization luck — this app ships
         without cross-origin isolation, so performance.now() rounds to 100us
         while a single structure costs about 3, and the min just picks the
         sample where the most roundings fell downward (1.0ms against a
         directly measured 1.5).
       The median is unbiased against the rounding, which is symmetric, and a
       spike cannot carry it. Eight samples at one frame in SAMPLE is about a
       second of history, and sorting eight numbers once every eight frames is
       nothing. Over-estimating is the more dangerous direction — it
       under-states the planting, so the cache fails to engage on a garden that
       needs it, which is the jank this governor exists to prevent. */
    const r=PSPRITE.structRing;
    r.push(structMs); if (r.length>PSPRITE.RING) r.shift();
    const sorted=r.slice().sort((p,q)=>p-q);
    PSPRITE.structMs = sorted[(sorted.length/2)|0];
  }
  // the planting alone — what this governor is actually deciding about
  const plantMs = Math.max(0, drawMs - PSPRITE.structMs);
  if (!PSPRITE.active){
    /* Learned at any count the cache can engage at. It was only learned past 20
       plants, from when the floor was 40; a garden of fifteen shrubs then engaged
       with nothing learned, was predicted at 0.02ms a plant, read as calm, and
       dropped back to procedural 45 frames later, round and round. */
    if (plantCount>PSPRITE.FLOOR && plantMs>0){
      const per=plantMs/plantCount;
      PSPRITE.plantMs = PSPRITE.plantMs ? PSPRITE.plantMs*0.9+per*0.1 : per;
    }
    PSPRITE.hot = (plantCount>PSPRITE.FLOOR && plantMs>PSPRITE.HI_MS) ? PSPRITE.hot+1 : 0;
    if (PSPRITE.hot>=3){ PSPRITE.active=true; PSPRITE.hot=0; PSPRITE.calm=0; }
  } else {
    const predicted=plantCount*(PSPRITE.plantMs||0.02);
    PSPRITE.calm = (plantCount<=PSPRITE.FLOOR || predicted<PSPRITE.LO_MS) ? PSPRITE.calm+1 : 0;
    if (PSPRITE.calm>=45){ PSPRITE.active=false; PSPRITE.calm=0; }
  }
}
/* Set for one frame in PSPRITE.SAMPLE, read by drawSceneEnt's structure branch.
   Module-level rather than threaded through the draw call because it changes
   once a frame and the entity loop is the hottest code in the app. */
let structSampling=false, structSampleMs=0;
/* ---------- zoom heat: don't re-bake a sprite while the zoom is still moving ----------
   Both sprite caches re-bake an entry whose baked scale has drifted 12% from
   the current one, so the blit stays 1:1 and crisp. At rest that is right. In
   the MIDDLE of a zoom it is a storm: a mouse wheel is a stream of discrete
   ticks, ~6% each, so the threshold is crossed every other tick and every
   visible plant re-bakes — up to PSPRITE.BUDGET (160) of them inside one frame.
   Measured on a real 70x39 garden (220 plants, 150 fence tiles, a 196-tile
   footprint): one 15-tick wheel zoom did 780 plant bakes and 17 structure
   bakes before this, and does 270 and 4 with it — the counts are deterministic
   and reproduced exactly across five interleaved passes. Gesture frame time
   fell from a 1046ms median to 438ms, and neither cache ever fell through to a
   procedural draw. This is a PC-shaped bug: a pinch is one gesture that ends,
   a wheel is seven threshold crossings.

   Do NOT tune this against a worst-frame number without a compositing tab.
   Capping the settle burst so it spreads over several frames was tried at 12,
   24 and 48 and measured WORSE than the uncapped 160, with run-to-run variance
   larger than the effect — so no such constant ships. The bake COUNT is the
   signal that survives measurement here; the millisecond totals drift 30-40%.

   The ground bake already solved exactly this, and this is its pattern:
   GROUND_ZOOM_SETTLE defers the crisp bake until ~140ms after the last zoom
   tick and blits the stale bake meanwhile — "briefly soft, never slow". The
   sprite caches had the same 12% threshold and no settle at all.

   SPRITE_ZOOM_DRIFT is the escape: past a large drift, re-bake even
   mid-gesture, or a long continuous zoom IN would blit a sprite at six times
   the size it was baked at for the whole gesture. 0.6 means at most a 1.6x
   upscale before it refreshes — a handful of re-bakes across a big zoom
   instead of one every two wheel ticks.

   It applies to zooming IN only. It is a RATIO of the two scales, not the
   difference-over-current form the 12% rest threshold uses, and it used to
   fire at 1.6x either way — but zooming out merely minifies a stale sprite,
   which looks fine, so those re-bakes were work thrown away at the next
   crossing (spriteRescaleDue).

   Shared by PSPRITE and SSPRITE because it is one fact about the camera, and
   deliberately separate from groundZoomT: the ground stamps its tick later in
   render(), after both caches have already been aged for the frame. */
let spriteZoomPrev=-1, spriteZoomT=-1e9, spriteZoomSettled=true;
const SPRITE_ZOOM_SETTLE=140;   // ms after the last zoom tick before the crisp rebake
const SPRITE_ZOOM_DRIFT=0.6;    // rebake mid-gesture once the scale has drifted this far
function noteSpriteZoom(t){
  const s=pspriteScale();
  if (s!==spriteZoomPrev){ spriteZoomT=t; spriteZoomPrev=s; }
  /* game.photo renders ONE frame straight into a downloaded PNG, so softness
     there outlives the gesture that caused it. It is not a gesture and cannot
     stutter — always give it the crisp bake. */
  spriteZoomSettled = (t-spriteZoomT)>SPRITE_ZOOM_SETTLE || !!game.photo;
}
/* Should a cached sprite that has drifted off the current scale re-bake NOW?
   Shared by both caches. A non-finite or non-positive scale on either side
   cannot be reasoned about, so re-bake rather than strand the sprite stale
   forever behind a NaN comparison. */
function spriteRescaleDue(baked,current){
  if (spriteZoomSettled) return true;
  if (!(baked>0) || !(current>0)) return true;
  /* Zooming OUT only minifies a sprite, which reads fine for the length of a
     gesture, so its crisp re-bake waits for the settle like the ground's does.
     It used to fire past 1.6x in either direction, and a mouse wheel spun out
     from 2.8x to 0.4x crossed that four times: four re-bakes of every visible
     plant, each thrown away at the next crossing. Zooming IN still escapes,
     because an upscaled sprite is the one that turns to mush. */
  if (baked>current) return false;
  return current/baked > 1+SPRITE_ZOOM_DRIFT;
}
function pspriteScale(){ return Math.min(DPR,1.5)*ZOOM; } // cap DPR so retina sprites don't 4x the budget
/* The longest side a single baked sprite may have, in device pixels.

   It was a flat 1024, and the giants are where all the memory is: measured on a
   quarter acre, 51 sprites held 80% of 57.7MB, and on a retina phone the same
   garden sat at 61.7MB against a 48MB budget with ZERO evictable sprites — the
   whole working set was on screen, so eviction could not act and the budget was
   decorative in exactly the situation it exists for.

   A cap proportional to the canvas is the principled version of the same idea:
   a sprite much larger than the screen's SHORTER side is one you can only ever
   see a fraction of, so the detail past that point is memory nobody looks at.
   Measured deterministically on the biggest species in the catalog (cottonwood,
   813x962 draw units), against a true 1:1 bake: the old 1024 cap ALREADY
   differed by 2.9% of pixels at a mean of 11.5/255 — this trade is one the app
   was making already — and 640 takes that to 4.1% and 14.8 while cutting that
   one sprite from 3.39MB to 1.32MB. On the phone above it takes the scene from
   61.7MB to 47.1MB, which is the first time the budget has been reachable.
   Big screens keep the old behaviour: the cap only bites when the canvas is
   small, which is where the memory matters. */
const SPRITE_CAP_MIN=512, SPRITE_CAP_MAX=1024, SPRITE_CAP_SCREENS=1.15;
function spriteMaxPx(){
  const shortSide=Math.min(cnv.width||0, cnv.height||0);
  if (!shortSide) return SPRITE_CAP_MAX;
  return Math.max(SPRITE_CAP_MIN, Math.min(SPRITE_CAP_MAX, Math.round(shortSide*SPRITE_CAP_SCREENS)));
}
/* Retiring an image also retires its indexes. A sibling may have replaced the
   species lookup already, so only remove pointers that still name this image.
   The slot lives on the entry: the key's JSON detail may contain separators. */
function retirePlantSprite(k,e){
  PSPRITE.bytes-=e.bytes; PSPRITE.map.delete(k); releasePlantEntry(e);
  if (e.slot!==undefined && PSPRITE.slot.get(e.slot)===k) PSPRITE.slot.delete(e.slot);
  const sk=k.slice(k.indexOf('|')+1);
  if (PSPRITE.spec.get(sk)===k) PSPRITE.spec.delete(sk);
}
function pspriteFrame(){                        // once per render: age the cache
  closeRetiredSprites();                        // last frame's, which nothing can draw now
  atlasFrame();                                 // last frame's small bakes move into the shared pages
  PSPRITE.frame++; PSPRITE.rendered=0; PSPRITE.bakeMs=0; PSPRITE.waiting=0; PSPRITE.scale=pspriteScale();
  // Evict only sprites NOT drawn last frame (off-screen), oldest first, down to
  // budget — never the visible set. This is what stops the cache thrashing and
  // flickering when the working set is large (e.g. a dense garden on retina):
  // memory may overshoot to hold everything on screen, but it never re-renders
  // a visible plant it just discarded.
  // Look-ahead renews leases in place, so a protected entry can precede stale
  // ones. Skip it rather than ending the sweep before those can be reclaimed.
  if (PSPRITE.bytes>PSPRITE.MEM){
    for (const [k,e] of PSPRITE.map){
      if (PSPRITE.bytes<=PSPRITE.MEM) break;
      if (e.used>=PSPRITE.frame-1) continue;
      retirePlantSprite(k,e);
    }
    PREBAKE.gen++;   // a sprite it had counted as there may be gone
  }
}
function gbucket(v,n){ v=v<0?0:v>1?1:v; return Math.round(v*(n-1)); }
/* The box a plant's drawing occupies around its placement point, in draw units.
   Two callers, and they must not disagree: makePlantSprite sizes the bake from
   it, and buildScene sizes the viewport cull from it at FULL growth (a superset
   of whatever any frame draws). A box that is too small clips a sprite; the
   same box too small in the cull pops the plant in at the screen edge. */
function plantDrawBox(P,key,growth){
  // trees: display-rescaled (T10). The 0.25/0.3 floors here are deliberately
  // LARGER than draw.js's tree sapling floor (0.12) — the box only has to
  // contain the drawing, so young trees just get a bit of empty margin.
  const H=plantVisualH(P)*(0.25+0.75*growth);
  // the box must cover the whole drawing — woody canopies reach well above the
  // drawn height and wide of the drawn cw, so trees clip if we size from H alone.
  const woody=isWoodyDef(P);
  const canopy=(woodyVisualCw(P)||80)*(0.3+0.7*growth);
  const grassW=plantVisualWidthScale(P,key);
  const L=P.look||{};
  // A sedge's reach is known exactly and a matrix means hundreds of its sprites, so
  // its box is tight: the generic one left ~40% of a low clump's sprite empty.
  if (L.tuftIn||L.sedgeHabit==='palm'){
    const shadowBelow=plantDrawBelow(P,growth,H), realTop=H*((P.heightIn||P.h)/P.h);
    if (L.sedgeHabit==='palm')
      return {halfW:H*((L.palmSpread||0.34)+(L.palmLeafLen||0.3)*1.12)+(L.baseW||9)/2+8, top:realTop+18, bot:Math.max(18,shadowBelow+6)};
    const rx=sedgeGroundRx(P,growth), ry=rx*0.5, blade=H*(L.leafLen||0.86)*1.04;
    return {
      halfW:Math.max(rx*1.2+2, rx*1.12+blade*(L.spread||0.68)+(L.baseW||5)/2)+8,
      top:ry*1.13+Math.max(blade*((L.dome||0.68)+0.155),realTop)+14,   // 14: the tallest head above its culm
      bot:Math.max(ry*1.2+6,shadowBelow+4),
    };
  }
  const authoredHalf=H*Math.max(0,L.sideScale||0);
  const herbHalf=P.form==='sotol'
    ? Math.max(H*0.62,H*(L.leafLen||0.82)*1.1)
    : H*0.62*Math.max(1,grassW);
  // A crown's far side stands up the screen, so the top has to allow for it. The sides and the foot
  // do not: measured over every grass, the padding already holds them, and adding the crown to the
  // width made 20% more sprite for nothing. A cultivar too wide for that gets a smaller crownIn.
  const crownRx=grassCrownRx(P,key,growth)*Math.max(1,grassW);
  const halfW=(woody?Math.max(canopy*0.62,H*0.5,authoredHalf):Math.max(herbHalf,authoredHalf))+18;
  // Cloud grasses can throw a seed veil substantially above their nominal
  // height. Size its sprite for the tallest panicle plus cloud rather than
  // clipping tall, airy forms such as Molinia 'Transparent'.
  const artH=plantArtTop(P)*(0.25+0.75*growth);
  // A smoke cloud's culms are as tall as the plant really is (drawSmokeCloud), whatever its leaves.
  const herbTop=P.form==='cloudgrass' && L.cloudStyle==='smoke'
    ? Math.max(H*1.12, H*((P.heightIn||P.h)/P.h)*(L.culmLen||0.97)*1.06+10)
    : P.form==='cloudgrass'
    ? Math.max(H*1.12, H*1.05*(L.cloudTop||0.92)+(L.cloudHeight||11)+6)
    : P.form==='sotol' ? artH*1.05
    : artH*1.12;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):herbTop+crownRx*0.5)+26;
  // Everything a plant paints BELOW its placement point — the cast ground
  // shadow, and a weeping conifer's cascade — so the cached and live procedural
  // versions do not change silhouette when the governor flips. `growth` here is
  // the same value drawPlant is handed, since the shadow scales with it.
  const below=plantDrawBelow(P,growth,H)+8;
  /* A climber takes its frame's shape (0.9.158): along a fence or a 6 ft panel
     it spreads up to CLIMB_REACH of its height either side of its foot, and a
     run seen in iso slopes, so one end of it is lower on the screen than the
     foot and the other higher. The box holds that reach in both directions,
     plus a leaf, for every frame. */
  if (P.type==='vine'){
    const reach=H*CLIMB_REACH;
    return {halfW:Math.max(halfW, reach*0.9+H*0.08+12), top:Math.max(top, H+reach*0.46+H*0.08+20),
      bot:Math.max(18, Number.isFinite(below)?below:18, reach*0.46+H*0.06+12)};
  }
  return {halfW, top, bot:Math.max(18,Number.isFinite(below)?below:18)};
}
/* ---------- sprite pixels live in ImageBitmaps, not <canvas> elements ----------
   Every baked sprite used to be its own <canvas>, and in Firefox that alone
   took the garden canvas off the GPU for the rest of the page. Firefox's
   accelerated canvas (DrawTargetWebgl) scores every frame: a frame FAILS when
   texture uploads + readbacks + layers exceed 66% of its draw requests
   (gfx.canvas.accelerated.profile-cache-miss-ratio), and after 10 frames a
   canvas whose failed frames exceed 30% of ALL its frames is permanently
   dropped to a software canvas in the content process (profile-frames,
   profile-fallback-ratio; the counters are cumulative and never reset). A
   small canvas — under 128x128 in area, or past the 200-canvas cap on GPU
   draw targets — is a software surface in the GPU process, and blitting it
   into the garden re-uploads it EVERY frame, cached or not. So a frame of
   sprite blits is a failed frame, and the tenth frame after a garden opens
   is the last accelerated one.
   Measured in Firefox 157 at 2130x1259 on a 261-plant, 233-bulb garden: the
   demotion lands on exactly frame #10, and from then on every frame is
   ~80ms (12fps panning, 11.5 fast-forwarding), ~60% of it Skia's software
   raster on the main thread and ~20% blocked on per-sprite IPC readbacks,
   because the garden canvas is now local while its sprites are still remote.
   A page with no app code reproduces it: 100 small canvases blitted per
   frame demote a big canvas at frame 10; the same sprites as ImageBitmaps,
   or packed into one atlas canvas, never do. With bitmaps the same garden
   runs 165fps panning and 158 fast-forwarding, and a frame's JS falls from
   ~80ms to ~1.5ms (400 blits of a remote canvas cost ~20us of recording
   each; a bitmap's is nearly free). Chrome was never affected and is equal
   or a little better (2.1 -> 1.7ms of JS a frame, and 2,823 sprite canvases
   created over the same session against 30).
   OffscreenCanvas.transferToImageBitmap() is used because it is SYNCHRONOUS
   — a bake is used in the frame that makes it — and one scratch surface per
   cache is reused, so bakes no longer mint a draw target each (the 200-target
   cap is shared with the garden canvas itself, which Firefox cannot
   accelerate when it is re-created, on a resize, past it). Pixels: Chrome
   identical; Firefox rasterises a small OffscreenCanvas with slightly
   different antialiasing than a small <canvas>, which changed 5% of a frame's
   pixels by a mean of 2/255 (max 39), all on structure and plant edges and
   invisible side by side at 2x.
   WebKit keeps canvases: unmeasured there, and already smooth on the phones
   that run it. `spriteBitmaps=false` in the console A/Bs the old path (clear
   both caches after). */
function spriteBitmapsSupported(){
  try{
    if (typeof OffscreenCanvas!=='function'
        || typeof OffscreenCanvas.prototype.transferToImageBitmap!=='function') return false;
    const ua=(typeof navigator!=='undefined' && navigator.userAgent) || '';
    if (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return false;   // Safari, every iOS browser
    return !!new OffscreenCanvas(1,1).getContext('2d');
  }catch(_){ return false; }
}
let spriteBitmaps=spriteBitmapsSupported();
const spriteScratch={};
/* A surface sized pw x ph to bake one sprite into; spriteBakeImage turns it
   into the thing the cache keeps. Setting the size clears the surface and
   resets its state, which every bake relies on. A bake inside a bake (none
   exists today) gets a surface of its own rather than one being drawn on. */
function spriteBakeSurface(which,pw,ph){
  if (!spriteBitmaps){
    const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
    return cv;
  }
  let s=spriteScratch[which];
  if (s && s.busy) return new OffscreenCanvas(pw,ph);
  if (!s) s=spriteScratch[which]={oc:new OffscreenCanvas(pw,ph), busy:false};
  s.oc.width=pw; s.oc.height=ph; s.busy=true;
  return s.oc;
}
function spriteBakeImage(which,cv){
  if (typeof OffscreenCanvas!=='function' || !(cv instanceof OffscreenCanvas)) return cv;
  const s=spriteScratch[which]; if (s && s.oc===cv) s.busy=false;
  return cv.transferToImageBitmap();
}
// a surface that got no context: nothing to keep, and the shared one is free again
function abandonBakeSurface(which,cv){
  const s=spriteScratch[which];
  if (s && s.oc===cv){ s.busy=false; return; }
  releaseSpriteImage(cv);
}
/* The browser refused a canvas. Give back every sprite that is not on screen,
   in both caches and whatever the budgets say, so the next bake has room, and
   leave a line in the error log for a report. At most once a frame. */
let spritePressureAt=-1, spritePressureNoted=false;
function spriteMemoryPressure(){
  if (spritePressureAt===PSPRITE.frame) return;
  spritePressureAt=PSPRITE.frame;
  for (const [k,e] of PSPRITE.map) if (e.used<PSPRITE.frame-1) retirePlantSprite(k,e);
  PREBAKE.gen++;
  for (const [k,e] of SSPRITE.map) if (e.used<SSPRITE.frame-1){ SSPRITE.bytes-=e.bytes; SSPRITE.map.delete(k); retireSpriteImage(e.cv); }
  for (let i=ATLAS.pages.length-1;i>=0;i--) if (!ATLAS.pages[i].live){ releaseSpriteImage(ATLAS.pages[i].cv); ATLAS.pages.splice(i,1); }
  if (!spritePressureNoted && typeof noteError==='function'){
    spritePressureNoted=true;
    noteError(new Error('The browser refused a sprite canvas (out of canvas memory)'),'sprite-memory');
  }
}
/* A retired image is released at the start of the NEXT frame, not on the spot:
   a stand-in drawn earlier in the same frame may still be in that frame's
   recorded commands. Releasing frees its memory now rather than at the next GC,
   which a fast-forward that bakes ~150 sprites a second would otherwise wait on.
   A bitmap is closed. A <canvas> sprite, which is what every sprite is in
   WebKit (every iPad and iPhone browser), has its size set to nothing, which
   hands back its pixels: it has no close(), and until 0.9.171 it was simply
   dropped for the collector to find. WebKit does not collect on canvas memory,
   and it refuses new canvases past a total. Measured in Chrome made to take the
   canvas path: a game year of fast-forward in Today view on a 353-plant garden
   baked 5,144 sprites, 196MB of pixels in 34 seconds, each in a canvas of its
   own; thirty mature ninebarks at close zoom are 1.2MB apiece and re-bake some
   25 times a year, most of a gigabyte. That is the shape of a tablet that runs
   out of memory "after planting and moving the time a bit". */
let spriteRetired=[];
function releaseSpriteImage(img){
  if (!img) return;
  try{
    if (typeof img.close==='function') img.close();
    else if (typeof img.getContext==='function'){ img.width=0; img.height=0; }
  }catch(_){ }
}
function retireSpriteImage(img){
  if (img && (typeof img.close==='function' || typeof img.getContext==='function')) spriteRetired.push(img);
}
function closeRetiredSprites(){
  if (!spriteRetired.length) return;
  for (const b of spriteRetired) releaseSpriteImage(b);
  spriteRetired=[];
}
// A sprite's pixels, for the dev verifiers, whichever kind of image it is.
function spritePixels(img){
  const w=img.width, h=img.height;
  if (typeof img.getContext==='function'){
    const c=img.getContext('2d');
    if (c && typeof c.getImageData==='function') return c.getImageData(0,0,w,h).data;
  }
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const c=cv.getContext('2d',{willReadFrequently:true}); c.drawImage(img,0,0);
  return c.getImageData(0,0,w,h).data;
}
/* `bK` is the bloom part of the key: the bloom bucket (0-3) plus four times the
   after-bloom bucket (bloomAfterBucket, 0-2), so one small integer says both how
   many stems are flowering and whether the rest have finished. */
function makePlantSprite(key,gB,bK,season,seed,variant,detail,lB){
  const P=plantDef(key,variant), growth=gB/8, bB=bK&3, aB=bK>>2;
  const box=plantDrawBox(P,key,growth);
  const halfW=box.halfW, top=box.top, bot=box.bot, want=pspriteScale();
  // giant woody sprites (a T10-rescaled oak is ~800 draw units tall): clamp
  // the bake RESOLUTION instead of bailing to per-frame procedural — the blit
  // scales it up slightly soft at high zoom, which reads fine on foliage and
  // keeps one oak from costing 13MB of sprite memory. The cap follows the
  // canvas (see spriteMaxPx), because it is small screens the memory hurts.
  const s=Math.min(want, spriteMaxPx()/Math.max(halfW*2, top+bot));
  const pw=Math.max(1,Math.ceil(halfW*2*s)), ph=Math.max(1,Math.ceil((top+bot)*s));
  if (pw>2600||ph>2600) return null;           // absurd size — don't cache, fall back
  const cv=spriteBakeSurface('plant',pw,ph);
  /* No context: the browser has refused the canvas, which in WebKit means its
     canvas memory is spent. Returning null draws this clump procedurally for the
     frame; dereferencing it threw inside render, and a throw there is the crash
     panel. The cache gives back what it is not showing, so the next bake has room. */
  const c2=cv.getContext('2d');
  if (!c2){ abandonBakeSurface('plant',cv); spriteMemoryPressure(); return null; }
  c2.setTransform(s,0,0,s,halfW*s,top*s);
  const spriteDetail=Object.assign({},detail||{},{bloomFallback:true,spent:aB});
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,spriteDetail,lB>=0?lB:undefined); // still (sway 0), bucketed bloom and leaf-out
  const entry={ cv:spriteBakeImage('plant',cv), ox:halfW, oy:top, s, want, capped:s<want, bytes:pw*ph*4, pw, ph };
  if (ATLAS.on && pw<=ATLAS.MAX && ph<=ATLAS.MAX){ entry.aq=true; ATLAS.fresh.push(entry); }
  return entry;
}
// blit a cached plant if we can, else fall back to a live procedural draw.
/* ---- the parts of a sprite key that do not change from frame to frame ----
   The key is content-addressed, which is what makes both caches work; what was
   missing is that COMPUTING it was not cached. Every clump rebuilt two strings
   and a JSON.stringify of its detail bake on every frame — 0.494us x 645 plants
   = 0.32ms — for a value whose only moving parts are two small integers off the
   clock. Everything else (the seed, the species, the cultivar, the season, the
   neighbour-derived detail) is fixed for the life of the scene list, so it is
   baked once by buildScene and the frame concatenates the buckets onto it.
   Season is safe to bake because sceneKey distinguishes it in both previews. */
function bakePlantKeyParts(rec,key,variant,season,seed,detail){
  rec.kSlot=seed+'|'+key+'|'+(variant||'')+'|'+season;
  rec.kTail='|'+(detail?JSON.stringify(detail):'');
  rec._kg=-1; rec._kk='';   // the whole key drawPlantMaybeCached keeps is built from these
  rec.sv=key+'|'+(variant||'');
  rec.hasBloom=!!bloomAppearanceFor(plantDef(key,variant),season);
  // whether "after the bloom" can change what this plant shows this season (world.js)
  rec.seedAfter=bloomAfterMatters(plantDef(key,variant),season);
  // a deciduous tree or shrub in spring carries its leaf-out stage
  // (woodyLeafOut) as well, and one that drops its leaves its leaf-drop stage in fall
  const lo=(season==='Spring'||season==='Fall') ? woodyLeafOut(plantDef(key,variant)) : null;
  rec.leafOut=!!lo && (season==='Spring' || !!lo.drop);
}
/* bloomLevel is a pure function of the species and the clock, so within one
   frame every clump of a species has the same answer — 532 calls collapsing to
   one per species (0.324us each, 0.17ms a frame). Keyed on the record's baked
   `sv` so the lookup allocates nothing, and cleared per frame off pspriteFrame's
   counter, which increments exactly once per render. */
/* ...and while the garden's clock stands still the answer does not change from
   one frame to the next either. A planner opens paused and mostly stays paused,
   so "per frame" was every frame for the same numbers: with bloomWindowsFor,
   about 50ms a second on a 1,482-plant garden of many species (8 on the demo
   garden). The memo is now kept until the instant it was filled at moves.
   gardenClockStamp is that instant, or NaN while the clock runs on wall time,
   which is then never equal to itself, so a running clock clears every frame as
   before. Fast-forward and a Skip move game.elapsedMs, which moves the stamp.
   The look-ahead bakes borrow the clock and ask bloomLevel directly, so they
   never read this. */
function gardenClockStamp(){
  return clockActive() ? NaN : (game.elapsedMs||0)+game.dayOffset*DAY_MS;
}
let bloomMemo=new Map(), bloomMemoFrame=-1, bloomMemoAt=NaN;
function bloomLevelForFrame(sv,key,variant){
  if (bloomMemoFrame!==PSPRITE.frame){
    bloomMemoFrame=PSPRITE.frame;
    const at=gardenClockStamp();
    if (at!==bloomMemoAt){ bloomMemoAt=at; bloomMemo.clear(); }
  }
  let v=bloomMemo.get(sv);
  if (v===undefined){ v=bloomLevel(key,variant); bloomMemo.set(sv,v); }
  return v;
}
/* The bloom part of a sprite key, from a bloom level and the season it is drawn
   in: one definition for the frame, the look-ahead and the tests. */
function plantBloomKey(rec,level,aft){
  const bB=rec.hasBloom?gbucket(level,4):0;
  return bB+4*(rec.seedAfter?bloomAfterBucket(bB,aft):0);
}
// the after-bloom state, like bloom one answer per species per frame (and
// season), and likewise kept while the clock stands still
let afterMemo=new Map(), afterMemoFrame=-1, afterMemoSeason=null, afterMemoAt=NaN;
function bloomAfterForFrame(sv,key,variant,season){
  if (afterMemoFrame!==PSPRITE.frame || afterMemoSeason!==season){
    const at=gardenClockStamp(), moved=at!==afterMemoAt || afterMemoSeason!==season;
    afterMemoFrame=PSPRITE.frame; afterMemoSeason=season; afterMemoAt=at;
    if (moved) afterMemo.clear();
  }
  let v=afterMemo.get(sv);
  if (v===undefined){ v=bloomAfterNow(plantDef(key,variant),season); afterMemo.set(sv,v); }
  return v;
}
// the leaf stage, like bloom one answer per species per frame (and season),
// and likewise kept while the clock stands still
let leafMemo=new Map(), leafMemoFrame=-1, leafMemoSeason=null, leafMemoAt=NaN;
function leafStageForFrame(sv,key,variant,season){
  if (leafMemoFrame!==PSPRITE.frame || leafMemoSeason!==season){
    const at=gardenClockStamp(), moved=at!==leafMemoAt || leafMemoSeason!==season;
    leafMemoFrame=PSPRITE.frame; leafMemoSeason=season; leafMemoAt=at;
    if (moved) leafMemo.clear();
  }
  let v=leafMemo.get(sv);
  if (v===undefined){ v=leafStageNow(plantDef(key,variant),season); leafMemo.set(sv,v); }
  return v;
}
/* The key a clump's sprite is cached under NOW, left on its record with the three
   buckets it was built from (`_kg` growth, `_kb` bloom plus after-bloom, `_kl`
   leaf stage or -1). One definition, for the frame that draws the clump and for
   the bake that runs ahead of the camera (prebakePlant), so the two cannot ask
   for different pictures.
   The key is the baked parts plus three small integers, and the integers move
   a few times a season. It was concatenated again on every frame, which made
   a new string for every plant drawn and left the cache lookups to flatten and
   hash it each time. The record keeps the string it built last; the same string
   object carries its hash with it. Only the STRING is kept: the lookups still
   run, so every rule about what is in the cache is untouched. The underscore
   marks these as memos, like `_spec`: a scene record's content is everything
   without one (tests/browser-skips.cjs compares a prepared scene with a fresh
   build so). */
function plantKeyNow(rec,key,variant,season,growth){
  const gB=gbucket(growth,9);
  // bloom bucket, plus the after-bloom bucket where spent heads can show (see makePlantSprite)
  let bB=rec.hasBloom?gbucket(bloomLevelForFrame(rec.sv,key,variant),4):0;
  if (rec.seedAfter && bB<3) bB+=4*bloomAfterBucket(bB,bloomAfterForFrame(rec.sv,key,variant,season));
  const lB=rec.leafOut?leafStageForFrame(rec.sv,key,variant,season):-1;
  if (rec._kg===gB && rec._kb===bB && rec._kl===lB) return rec._kk;
  rec._kg=gB; rec._kb=bB; rec._kl=lB;
  return (rec._kk=rec.kSlot+'|'+gB+'|'+bB+(lB>=0?'|L'+lB:'')+rec.kTail);
}
function drawPlantMaybeCached(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites,rec){
  if (!useSprites || PSPRITE.off){
    if (rec) rec._pf=PSPRITE.frame;   // drawn live this frame: see the stand-in note below
    drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail,leafStageNow(plantDef(key,variant),season)); return; }
  // a caller with no record (or one from before this frame's scene) pays the old price
  if (!rec || rec.kSlot===undefined) { rec=rec||{}; bakePlantKeyParts(rec,key,variant,season,seed,detail); }
  const kk=plantKeyNow(rec,key,variant,season,growth), gB=rec._kg, bB=rec._kb, lB=rec._kl;
  /* This clump's own SLOT — what identifies the plant rather than the moment.

     Growth and bloom are bucketed off the clock, so the instant either moves,
     the sprite at the old key is dead: nothing will ever ask for it again.
     Leaving it for the memory ceiling to notice is what took a 285-plant
     garden to 2020 cached sprites sitting exactly on the 48MB budget — about
     seven stale buckets per plant — where the cache then evicts and re-bakes
     continuously. Spring is the worst of it, because everything is regrowing
     and the buckets churn; the same garden settled in Fall held 284.

     Season stays IN the slot rather than superseding. Flipping between seasons
     to compare a planting is the thing this app is for, so a clump keeps at
     most one sprite per season it has actually been seen in — four rather than
     one, against re-baking every plant on every season change, which would
     land in the middle of the 1.1s crossfade.

     `detail` is deliberately NOT in the slot either: it is a neighbour-derived
     bake, so an old one is as dead as an old growth bucket. */
  const slot=rec.kSlot;   // baked above — it IS seed|key|variant|season
  let e=PSPRITE.map.get(kk);
  // A sprite baked at a very different zoom blits soft, so re-render it (budget
  // permitting) at the current scale. But to keep zooming smooth, reuse the old
  // one for this frame rather than dropping a visible plant to a slow procedural
  // draw — the cache converges back to crisp within a few frames after a zoom.
  // Resolution-capped giants (T10) compare on the REQUESTED scale and never
  // rebake while zooming further in — the bake would come out identical.
  // The rescale also waits for the gesture to settle (see noteSpriteZoom); a
  // MISS with nothing to stand in for it never waits, or a plant entering the
  // viewport mid-zoom would fall through to a procedural draw, which is what
  // this cache exists to avoid.
  const eScale=e&&(e.want!==undefined?e.want:e.s);
  const drift=e?Math.abs(eScale-PSPRITE.scale):0;
  const rescale = !!e && drift>PSPRITE.scale*0.12
    && !(e.capped && PSPRITE.scale>e.s)
    && spriteRescaleDue(eScale,PSPRITE.scale);
  if (!e || rescale){
    /* Once this frame's bake time is spent, a bake that has something to show
       in the meantime waits for a later frame instead of stalling this one: a
       rescale shows its own stale sprite, a miss whatever plantStandInKey
       finds. Before this, every frame could bake up to BUDGET (160) sprites,
       and the bursts that ask for that many are exactly the moments a gardener
       is watching — a season turn re-bakes every plant, a wheel zoom every
       plant several times, a scheme switch or a replacement a whole planting.
       game.photo is exempt: it renders ONE frame into a downloaded PNG, where a
       stand-in would outlive the moment it stood in for.
       Two more rules, both from what a gardener sees (0.9.171).
       A clump that was drawn LIVE last frame, because the cache has only just
       been switched on for a planting that was procedural, goes on being drawn
       live until its own bake lands. That costs what last frame cost; a
       sibling's sprite made the whole planting change shape at once and change
       back a plant at a time. A bake costs about what the live draw does, so
       these are held to the count and not to the time.
       And behind the opening cover (cold) nothing waits and nothing stands in:
       that pass exists to bake every clump's own picture. */
    const live=!e && rec._pf===PSPRITE.frame-1;
    const spent=!game.photo && !PSPRITE.cold
      && (PSPRITE.rendered>=PSPRITE.BAKE_CAP || (!live && PSPRITE.bakeMs>=PSPRITE.BAKE_MS));
    if (spent && live){
      rec._pf=PSPRITE.frame; PSPRITE.waiting++;
      drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail,lB>=0?lB:undefined);
      return;
    }
    const standKey=spent ? (e ? kk : plantStandInKey(kk,slot)) : null;
    if (standKey){
      PSPRITE.waiting++;
      const s=PSPRITE.map.get(standKey);
      PSPRITE.map.delete(standKey); s.used=PSPRITE.frame; PSPRITE.map.set(standKey,s);   // LRU, like any hit
      blitPlantSprite(ctx,s,bx,by,sway);
      return;
    }
    if (PSPRITE.rendered<PSPRITE.BUDGET){
      const t0=performance.now();
      const ne=makePlantSprite(key,gB,bB,season,seed,variant,detail,lB);
      PSPRITE.bakeMs+=performance.now()-t0;
      if (ne){ if (e){ PSPRITE.bytes-=e.bytes; releasePlantEntry(e); } e=ne; PSPRITE.rendered++; PSPRITE.bytes+=e.bytes;
        PSPRITE.spec.set(kk.slice(kk.indexOf('|')+1),kk); }
    }
    if (!e){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail,lB>=0?lB:undefined); return; }
  }
  /* Retire whatever this clump was cached as before. Only now — if the bake
     above was refused for budget we are still holding the OLD sprite, and
     dropping it would buy a procedural draw for nothing. */
  const wasKey=PSPRITE.slot.get(slot);
  if (wasKey!==undefined && wasKey!==kk){
    const dead=PSPRITE.map.get(wasKey);
    if (dead) retirePlantSprite(wasKey,dead);
  }
  if (wasKey!==kk) PSPRITE.slot.set(slot,kk);
  if (PSPRITE.map.has(kk)) PSPRITE.map.delete(kk);   // LRU: re-insert at the end
  e.used=PSPRITE.frame; e.slot=slot; e.pre=false;   // slot carried so eviction can clear the index
  PSPRITE.map.set(kk,e);
  blitPlantSprite(ctx,e,bx,by,sway);
}
function blitPlantSprite(ctx,e,bx,by,sway){
  if (!e.cv.width) return;   // a closed bitmap (retireSpriteImage) — drawImage would throw
  // in the atlas the sprite is a cell of a shared page (atlasFrame); otherwise it is the whole image
  const c=e.cell, sw=c?e.pw:e.cv.width, sh=c?e.ph:e.cv.height;
  const dw=sw/e.s, dh=sh/e.s, lx=bx-e.ox, ly=by-e.oy;
  if (!sway){ if (c) ctx.drawImage(e.cv,e.sx,e.sy,sw,sh,lx,ly,dw,dh); else ctx.drawImage(e.cv,lx,ly,dw,dh); return; }
  /* The wind: a shear about the plant's foot, x' = x + k(y-by). */
  const k=sway*0.05;
  if (plantBlitScale && ctx===cx){
    /* In render's entity pass the garden canvas's transform is a plain scale
       (plantBlitScale), so the sheared matrix can be SET and the scale set back:
       three context calls a plant where save, translate, shear, translate back,
       draw, restore were six. Translate-shear-translate multiplies out to
       [1,0,k,1,-k*by,0], times the scale. Measured on a 1,482-plant garden with
       every frame drawing: 2.89 -> 2.60ms of script a frame.
       Set, not composed and undone: multiplying by the inverse shear came out
       the same speed, but it leaves a matrix that is only exactly a scale again
       where the multiply is not fused (it is on ARM), and everything drawn after
       a plant wants an axis-aligned matrix. */
    const s=plantBlitScale;
    ctx.setTransform(s,0,s*k,s,-s*k*by,0);
    if (c) ctx.drawImage(e.cv,e.sx,e.sy,sw,sh,lx,ly,dw,dh); else ctx.drawImage(e.cv,lx,ly,dw,dh);
    ctx.setTransform(s,0,0,s,0,0);
    return;
  }
  // anywhere else the caller's transform is its own business: save and restore it
  ctx.save(); ctx.translate(bx,by); ctx.transform(1,0,k,1,0,0); ctx.translate(-bx,-by);
  if (c) ctx.drawImage(e.cv,e.sx,e.sy,sw,sh,lx,ly,dw,dh); else ctx.drawImage(e.cv,lx,ly,dw,dh);
  ctx.restore();
}
/* The scale of the garden canvas's transform while render's entity pass runs,
   0 at any other time. See blitPlantSprite. */
let plantBlitScale=0;
/* What to draw for a clump whose own sprite is waiting for bake time, as the
   key of a cached sprite, or null when nothing will do. In order:
     1. this clump at the growth or bloom bucket it showed last — a growth
        tick, and the picture is continuous;
     2. this clump in another season, the one being left first — a season
        turn, drawn under the crossfade that is showing the old season anyway;
     3. the same species, cultivar, season, bucket and detail, baked for
        another clump — right size and colours, a sibling's shape. Only for a
        clump with no sprite of its own at all: a scheme switch, a replacement.
   The clump's OWN picture has to come before a sibling's. The other way round,
   a season turn's first few bakes filled the sibling index and every clump
   after them wore a sibling's shape in the new colours until its own landed:
   each plant twitched out to another shape and back, across the whole garden,
   which is what the gardener saw as the planting spazzing at a season change.
   A sprite drawn as a stand-in keeps its own slot. Retiring happens only when
   the clump's real sprite lands, exactly as before. */
/* ---------- the coming season, baked before it arrives ----------
   A season turn needs a new sprite for every plant and every structure on
   screen: 374 plants and 11 structures in a 261-plant garden. Baked on the
   turn, that was frames of 103, 279 and 127ms; spread over the frames after it
   with stand-ins, it was smooth but the plants changed colour one by one, a
   wave across the garden under the crossfade. So while the clock is running
   towards a boundary (seasonTurnAhead — the same lead the ground uses), each
   frame spends up to AHEAD.BUDGET_MS baking the coming season's sprites for
   whatever it draws, with growth and bloom evaluated at the instant of the
   turn. When the turn comes every clump already has its new picture and the
   whole garden changes at once, under the crossfade, the way it should.
   The sprites are LEASED past the turn (`used` set ahead of the frame
   counter), because the eviction sweep discards what was not drawn last frame
   and nothing draws a sprite of a season that has not arrived yet.
   The per-frame budget is a SHARE of the frame (`budget`, set in render), not
   a flat 2ms: the lead is 1.5s of real time, and at 60Hz a flat 2ms is 180ms
   of baking in it, half of what a 374-plant turn needs, where 164Hz gets 490.
   The Time menu starts this work early. An explicit Skip then checks the exact
   destination scene in preparePendingSkip, holding the previous complete view
   until everything is ready. It has no crossfade to hide stand-ins under — it
   is the palette-comparison control. `short` counts ALL unfinished attempts,
   including memory refusals and failed bakes; `epoch` moves with the destination,
   so a clump marked done for one lead is checked again (and its lease renewed)
   for the next. */
const AHEAD={season:null, at:0, ms:0, BUDGET_MS:2, MAX_MS:6, SKIP_MS:6, budget:2, LEASE:1500,
  epoch:0, token:null, short:0, readyFor:null, lastT:0, vs:0};
/* What render tells the look-ahead at the top of each frame. The share is of
   the DISPLAY's interval — the smallest recent frame gap, drifting back up 2%
   a frame — never of the last gap: a slow frame must not buy the next frame
   more baking, or the budget feeds on its own cost (measured, a share of the
   last gap took fast-forward's worst frames from 48ms to 61). The prewarm of a
   paused planner is the exception: those frames come at the 30fps idle
   cadence and have the time. */
function aheadFrame(t,ahead){
  const token=ahead?ahead.season+'|'+ahead.at:null;
  if (token!==AHEAD.token){ AHEAD.token=token; AHEAD.epoch++; }
  const dt=AHEAD.lastT?Math.min(34,Math.max(4,t-AHEAD.lastT)):16.7;
  AHEAD.lastT=t;
  AHEAD.vs=Math.min(dt,(AHEAD.vs||dt)*1.02);
  AHEAD.season=ahead?ahead.season:null; AHEAD.at=ahead?ahead.at:0; AHEAD.ms=0; AHEAD.short=0;
  AHEAD.budget=!ahead ? AHEAD.BUDGET_MS
    : ahead.skip ? AHEAD.SKIP_MS
    : ahead.prewarm && !clockActive() && !game.ffActive ? AHEAD.MAX_MS
    : Math.min(AHEAD.MAX_MS,Math.max(AHEAD.BUDGET_MS,AHEAD.vs*0.3));
}
function aheadBakePlant(e,prepared=false){
  const next=AHEAD.season;
  if (e.aheadFor===AHEAD.epoch || e.kSlot===undefined) return;
  if (AHEAD.ms>=AHEAD.budget){ AHEAD.short++; return; }
  if (!prepared && PSPRITE.bytes>PSPRITE.MEM*1.5){ AHEAD.short++; return; }
  const t0=performance.now();
  // growth and bloom as they will be just after the boundary: borrow the clock
  const was=game.elapsedMs, susp=game.clockSuspended;
  let g, bl, lv, af;
  const Pn=plantDef(e.p.s,e.p.v);
  game.elapsedMs=AHEAD.at+(prepared?0:DAY_MS*0.02); game.clockSuspended=true;
  try{ g=displayPlantGrowth(e.p)*(e.stunt?STUNT_GROWTH:1); bl=bloomLevel(e.p.s,e.p.v); lv=leafStageNow(Pn,next); af=bloomAfterNow(Pn,next); }
  finally{ game.elapsedMs=was; game.clockSuspended=susp; }
  if (e.kind===SCENE_K.BULB && g<=0.02){ e.aheadFor=AHEAD.epoch; return; }
  // the bloom part of the key as the coming season will ask for it (plantBloomKey)
  const gB=gbucket(g,9), bB0=bloomAppearanceFor(Pn,next)?gbucket(bl,4):0, lB=lv===undefined?-1:lv;
  const bB=bB0+4*bloomAfterBucket(bB0,af);
  const cut=e.kSlot.lastIndexOf('|'), slot=e.kSlot.slice(0,cut+1)+next;
  const kk=slot+'|'+gB+'|'+bB+(lB>=0?'|L'+lB:'')+e.kTail;
  const have=PSPRITE.map.get(kk);
  if (have && (!prepared || preparedSpriteScale(have,pspriteScale()))){
    have.used=Math.max(have.used||0,PSPRITE.frame+AHEAD.LEASE); e.aheadFor=AHEAD.epoch; return;
  }
  const ne=makePlantSprite(e.p.s,gB,bB,next,e.seed,e.p.v,e.detail,lB);
  AHEAD.ms+=performance.now()-t0;
  if (!ne){ AHEAD.short++; return; }
  if (have) retirePlantSprite(kk,have);
  // whatever this clump held in that season before (last year's) is dead now
  const old=PSPRITE.slot.get(slot);
  if (old!==undefined && old!==kk){ const d=PSPRITE.map.get(old); if (d) retirePlantSprite(old,d); }
  ne.used=PSPRITE.frame+AHEAD.LEASE; ne.slot=slot;
  PSPRITE.map.set(kk,ne); PSPRITE.slot.set(slot,kk); PSPRITE.bytes+=ne.bytes;
  PSPRITE.spec.set(kk.slice(kk.indexOf('|')+1),kk);
  e.aheadFor=AHEAD.epoch;
}
function aheadBakeStruct(e,W,H,lit,prepared=false){
  const next=AHEAD.season;
  if (e.aheadFor===AHEAD.epoch) return;
  if (AHEAD.ms>=AHEAD.budget){ AHEAD.short++; return; }
  const spec=structSpriteSpec(e); if (!spec){ e.aheadFor=AHEAD.epoch; return; }
  const kk=spec.key+'|'+next+'|'+game.rot+'|'+(lit?1:0);   // drawStructMaybeCached's key, next season
  const have=SSPRITE.map.get(kk);
  if (have && (!prepared || preparedSpriteScale(have,ssprScale()))){
    have.used=Math.max(have.used||0,SSPRITE.frame+AHEAD.LEASE); e.aheadFor=AHEAD.epoch; return;
  }
  const t0=performance.now();
  const ns=makeStructSprite(e,spec,next,W,H,lit);
  AHEAD.ms+=performance.now()-t0;
  if (!ns){ AHEAD.short++; return; }
  if (have){ SSPRITE.bytes-=have.bytes; retireSpriteImage(have.cv); }
  ns.used=SSPRITE.frame+AHEAD.LEASE;
  SSPRITE.map.set(kk,ns); SSPRITE.bytes+=ns.bytes;
  e.aheadFor=AHEAD.epoch;
}
function preparedSpriteScale(e,scale){
  const baked=e.want!==undefined?e.want:e.s;
  return Math.abs(baked-scale)<=scale*0.12 || (e.capped && scale>e.s);
}
function plantStandInKey(kk,slot){
  const was=PSPRITE.slot.get(slot);
  if (was!==undefined && PSPRITE.map.has(was)) return was;
  const cut=slot.lastIndexOf('|'), i=SEASONS.indexOf(slot.slice(cut+1));
  if (i>=0){
    const base=slot.slice(0,cut+1);
    for (let d=3; d>=1; d--){                   // (i+3)%4 is the season just left
      const k2=PSPRITE.slot.get(base+SEASONS[(i+d)%4]);
      if (k2!==undefined && PSPRITE.map.has(k2)) return k2;
    }
  }
  const sk=kk.slice(kk.indexOf('|')+1), other=PSPRITE.spec.get(sk);
  if (other!==undefined){
    if (PSPRITE.map.has(other)) return other;
    PSPRITE.spec.delete(sk);                    // the sibling was retired or evicted
  }
  return null;
}
/* ---------- small sprites share a few big canvases (the atlas) ----------
   Every sprite was an image of its own, and a frame drew each with its own
   drawImage. In Chrome and Edge that is a draw call and a texture apiece: the
   cost of a frame followed the NUMBER of sprites on screen and nothing else.
   Measured on a desktop GPU with the whole of a 140 ft garden in view, 4,707
   sprites of about 18px: 60ms a frame, 16fps, with 16ms of script. A page with
   no app code does the same (4,700 blits of 4,700 small bitmaps: 60.6ms), and
   the same blits out of ONE canvas take 12.1ms: draws from one texture are
   batched. So a sprite no longer than MAX on a side is moved, the frame after
   it is baked, into a cell of a shared page, and blitted from there.
   The rules it is built on, each measured or read from an engine's source:
     - A page is written only at the START of a frame (atlasFrame), before
       anything is drawn from it. A canvas drawn from and then written to is
       copied by Chrome at the write (0.25ms each) and may be by WebKit; one
       batch of writes a frame is one such turn a page. So a bake still goes to
       a surface of its own, as it always has, is drawn from there for the frame
       it was made in, and is ADOPTED into a cell at the start of the next.
       Freeing a cell writes nothing; the cell is cleared when it is next used.
     - Not in Firefox. Its canvas already batches separate bitmaps (165fps on
       the same 4,700), and drawing from a big canvas that bakes are painted
       into is exactly what demotes it (the sprite-bitmap note above).
     - Not in WebKit by default either (0.9.172). The gain is Chromium's: it is
       the per-image cost there that the pages remove. Run in Playwright's
       WebKit build the same pages draw about 10% SLOWER than separate canvases
       (1,800 sprites: 54ms a frame against 49; 300 larger ones: 47 against 43).
       That build rasterises in software and is not an iPad, but it is the only
       WebKit measurement there is, and the canvases a tablet could not afford
       are answered another way (a retired one is emptied at once). ?atlas=1 in
       the address turns it on anywhere, for a comparison on a device, and
       ?atlas=0 turns it off.
     - A page is a canvas ELEMENT, never an OffscreenCanvas: Firefox draws from
       those at a third of the speed, and one kind is one thing to test.
   Cells come from shelves: a row of one height (rounded up to 8px), filled left
   to right, with freed cells kept by width for the next
   sprite of that size. An emptied shelf can be given to another height, an
   emptied last shelf gives its room back, and an emptied page starts over. A
   page is 1024 square (4MB), so a garden of a few dozen plants holds one, and
   what the pages hold beyond the sprites in them stays small; Chrome draws from
   a hundred pages as fast as from one (measured: 82fps against 86), it is the
   thousands of separate images that cost. Pages stop at SHARE of the sprite
   budget, and a sprite that finds no cell simply stays an image of its own, as
   before. A sweep (atlasSweep) frees
   the cells of sprites that left the cache by a route that did not say so. */
/* COST: what a sprite in the atlas is charged against the sprite budget, as a
   multiple of its cell. A page is held whole however full it is, and measured
   over a session of a 350-plant garden the pages came to 1.36-1.49 times the
   cells in them (12 pages, 50MB, for 34MB of cells). Charged for the cells
   alone the cache could hold a budget of sprites in pages worth half as much
   again; charged this, pages and separate images together come to the budget. */
const ATLAS={on:atlasWanted(), MAX:224, PAGE:1024, SHARE:1, SLACK:32, COST:1.4, ADOPT:320, IDLE:300, ROOM:8*1024*1024,
  pages:[], fresh:[], cells:new Set(), triedAt:-1e9, freed:0, wantFreed:-1};
function atlasWanted(){
  try{
    if (typeof document==='undefined' || typeof document.createElement!=='function') return false;
    const q=(typeof location!=='undefined' && location.search) || '';
    if (/[?&]atlas=0(&|$)/.test(q)) return false;
    if (/[?&]atlas=1(&|$)/.test(q)) return true;
    const ua=(typeof navigator!=='undefined' && navigator.userAgent) || '';
    // Chrome, Edge and the rest of that family. Every iOS browser is WebKit and says CriOS or EdgiOS, not these.
    return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox\//.test(ua);
  }catch(_){ return false; }
}
function atlasBytes(){ let b=0; for (const p of ATLAS.pages) b+=p.size*p.size*4; return b; }
function atlasRound(n){ return (n+7)&~7; }
function atlasNewPage(){
  const size=ATLAS.PAGE;
  if (atlasBytes()+size*size*4>PSPRITE.MEM*ATLAS.SHARE) return null;
  const cv=document.createElement('canvas'); cv.width=size; cv.height=size;
  const g=cv.getContext('2d');
  if (!g){ releaseSpriteImage(cv); return null; }          // the browser has no canvas memory to give
  const p={cv,g,size,shelves:[],y:0,live:0,idle:PSPRITE.frame};
  ATLAS.pages.push(p);
  return p;
}
function atlasTake(p,sh,x,w,h){
  sh.live++; p.live++;
  const c={p,sh,x,y:sh.y,w,h,freed:false};
  ATLAS.cells.add(c);
  return c;
}
function atlasAllocIn(p,cw,ch){
  if (cw>p.size) return null;
  for (const sh of p.shelves){                               // a shelf of this height with room
    if (sh.h!==ch) continue;
    const fl=sh.free.get(cw);
    if (fl && fl.length) return atlasTake(p,sh,fl.pop(),cw,ch);
    if (sh.x+cw<=p.size){ const x=sh.x; sh.x+=cw; return atlasTake(p,sh,x,cw,ch); }
  }
  /* ...or a little taller with room at its end. Sprites come in many heights and
     a shelf apiece left most shelves half full: 353 sprites of a real garden
     took seven pages, where they are five pages of pixels. */
  for (const sh of p.shelves){
    if (!sh.live || sh.h<ch || sh.h-ch>ATLAS.SLACK || sh.x+cw>p.size) continue;
    const x=sh.x; sh.x+=cw;
    return atlasTake(p,sh,x,cw,ch);
  }
  for (const sh of p.shelves){                               // an emptied shelf tall enough
    if (sh.live || sh.H<ch) continue;
    sh.h=ch; sh.x=cw; sh.free.clear();
    return atlasTake(p,sh,0,cw,ch);
  }
  if (p.y+ch<=p.size){                                       // a new shelf
    const sh={y:p.y,H:ch,h:ch,x:cw,live:0,free:new Map()};
    p.y+=ch; p.shelves.push(sh);
    return atlasTake(p,sh,0,cw,ch);
  }
  return null;
}
function atlasAlloc(w,h){
  const cw=atlasRound(w), ch=atlasRound(h);
  for (const p of ATLAS.pages){ const c=atlasAllocIn(p,cw,ch); if (c) return c; }
  const p=atlasNewPage();
  return p ? atlasAllocIn(p,cw,ch) : null;
}
function atlasFree(c){
  if (!c || c.freed) return;
  c.freed=true; ATLAS.cells.delete(c); ATLAS.freed++;
  const sh=c.sh, p=c.p;
  sh.live--; p.live--;
  if (!sh.live){ sh.x=0; sh.free.clear(); }
  else { let fl=sh.free.get(c.w); if (!fl) sh.free.set(c.w,fl=[]); fl.push(c.x); }
  while (p.shelves.length && !p.shelves[p.shelves.length-1].live) p.y=p.shelves.pop().y;
  if (!p.live){ p.shelves.length=0; p.y=0; p.idle=PSPRITE.frame; }
}
// a sprite leaving the cache: its cell back to the atlas, or its image to be released
const ATLAS_GONE={width:0,height:0};
function releasePlantEntry(e){
  e.gone=true;
  if (e.cell){ atlasFree(e.cell); e.cell=null; e.cv=ATLAS_GONE; }
  else retireSpriteImage(e.cv);
}
/* Leaving the garden for the menu: give back every picture it was holding. The
   sprite caches (up to 48MB of plants and 24MB of structures), the atlas pages,
   the ground canvas and its spare (each the viewport and its margin, 20MB and
   more apiece on a large tablet), the night map and the four whole-screen
   washes all stayed alive behind the title screen, whose border then baked up
   to 48MB of its own beside them: the menu after a session held more than the
   garden had. The garden canvas is hidden there and nothing draws from any of
   it; opening a garden prepares its picture behind the cover whatever was
   kept. Canvases are emptied, not dropped (releaseSpriteImage). */
function releaseGardenSurfaces(){
  for (const [k,e] of [...PSPRITE.map]) retirePlantSprite(k,e);
  PSPRITE.map.clear(); PSPRITE.slot.clear(); PSPRITE.spec.clear(); PSPRITE.bytes=0; PSPRITE.waiting=0;
  for (const e of SSPRITE.map.values()) retireSpriteImage(e.cv);
  SSPRITE.map.clear(); SSPRITE.bytes=0;
  ATLAS.fresh.length=0; atlasSweep();
  for (const p of ATLAS.pages) releaseSpriteImage(p.cv);
  ATLAS.pages.length=0; ATLAS.cells.clear(); ATLAS.wantFreed=-1;
  closeRetiredSprites();
  for (const cv of [groundCanvas,groundSpare,NIGHT_MAP.cv]) if (cv){ try{ cv.width=0; cv.height=0; }catch(_){ } }
  groundCanvas=null; groundCtx=null; groundSpare=null; groundSpareCtx=null;
  groundJob=null; groundKey=''; groundKeyStruct=''; groundBaked=null; groundMarginStale=false;
  NIGHT_MAP.cv=null; NIGHT_MAP.g=null; NIGHT_MAP.key=''; NIGHT_MAP.scene=null;
  seasonFade.active=false; dropSeasonFadeCanvas();
  releaseWashSurfaces();
  PREBAKE.gen++;
}
// cells whose sprite is no longer in the cache (a tool that cleared the map without retiring)
function atlasSweep(){
  if (!ATLAS.cells.size) return;
  const live=new Set();
  for (const e of PSPRITE.map.values()) if (e.cell) live.add(e.cell);
  for (const c of [...ATLAS.cells]) if (!live.has(c)) atlasFree(c);
}
/* No cell to be had. What is on screen is what the atlas is for, so make room
   for it out of what is not: first the sprites baked at another zoom, which
   would be baked again before they were shown anyway, then the least recently
   drawn ones, oldest first (the cache's own order), up to ROOM. Those are other
   seasons' pictures and the ring baked ahead of a pan; losing a few costs a bake
   when they are next wanted. At most every 30 frames. */
function atlasMakeRoom(){
  if (PSPRITE.frame-ATLAS.triedAt<30) return false;
  ATLAS.triedAt=PSPRITE.frame;
  atlasSweep();
  const sc=PSPRITE.scale, was=ATLAS.freed;
  for (const [k,e] of PSPRITE.map){
    if (!e.cell || e.used>=PSPRITE.frame-1) continue;
    const es=e.want!==undefined?e.want:e.s;
    if (Math.abs(es-sc)>sc*0.12 && !(e.capped && sc>e.s)) retirePlantSprite(k,e);
  }
  if (ATLAS.freed===was){
    let got=0;
    for (const [k,e] of PSPRITE.map){
      if (got>=ATLAS.ROOM) break;
      if (!e.cell || e.used>=PSPRITE.frame-1) continue;
      got+=e.bytes; retirePlantSprite(k,e);
    }
  }
  PREBAKE.gen++;
  return ATLAS.freed!==was;
}
// move up to `max` of the sprites baked since last time into cells; the rest wait a frame
function atlasAdopt(max){
  const A=ATLAS, list=A.fresh;
  if (!list.length) return 0;
  let n=0, w=0, full=false;
  for (let i=0;i<list.length;i++){
    const e=list[i];
    if (e.gone || e.cell || e.used===undefined) continue;    // retired, or never put in the cache
    if (n>=max){ list[w++]=e; continue; }
    e.aq=false;
    if (full) continue;                                      // no room this frame: it stays its own image for now
    let c=atlasAlloc(e.pw+2,e.ph+2);
    if (!c && atlasMakeRoom()) c=atlasAlloc(e.pw+2,e.ph+2);
    if (!c){ full=true; A.wantFreed=A.freed; continue; }      // ask again once something has been freed (atlasFrame)
    const g=c.p.g;
    g.clearRect(c.x,c.y,c.w,c.h);
    g.drawImage(e.cv,c.x+1,c.y+1);
    retireSpriteImage(e.cv);
    const cost=Math.round(c.w*c.h*4*A.COST);
    PSPRITE.bytes+=cost-e.bytes; e.bytes=cost;
    e.cv=c.p.cv; e.cell=c; e.sx=c.x+1; e.sy=c.y+1;
    n++;
  }
  list.length=w;
  return n;
}
function atlasFrame(){
  const A=ATLAS;
  if (!A.on){ if (A.fresh.length) A.fresh.length=0; return; }
  if (A.cells.size && !PSPRITE.map.size) atlasSweep();
  /* Sprites that found the atlas full stayed images of their own. Once cells
     have been freed since (an eviction, a zoom), the ones being DRAWN are
     offered again, a batch a frame; nothing is asked while nothing has changed. */
  if (A.wantFreed>=0 && A.freed!==A.wantFreed && !A.fresh.length){
    A.wantFreed=-1;
    let n=0;
    for (const e of PSPRITE.map.values()){
      if (e.cell || e.aq || e.pw===undefined || e.pw>A.MAX || e.ph>A.MAX || e.used<PSPRITE.frame-1) continue;
      e.aq=true; A.fresh.push(e);
      if (++n>=A.ADOPT){ A.wantFreed=A.freed-1; break; }     // more to offer next frame
    }
  }
  atlasAdopt(A.ADOPT);
  // a page with nothing in it for a while gives its pixels back (zoomed in, every sprite is too big for it)
  for (let i=A.pages.length-1;i>=0;i--){
    const p=A.pages[i];
    if (!p.live && PSPRITE.frame-p.idle>A.IDLE){ releaseSpriteImage(p.cv); A.pages.splice(i,1); }
  }
}
/* ---------- sprites baked ahead of the camera ----------
   Every clump is its own picture (the key carries its tile seed), so a clump
   that has never been on screen has no sprite, and when a pan brought a row of
   them into view the frame's bake time ran out part way along it. The rest were
   drawn as a SIBLING, another clump of the same kind, until their own bake
   landed a few frames later: each plant came in wearing one shape and changed
   to another. Seen from the chair, that is plants turning round as they arrive.
   So the clumps just OFF screen are baked before they are needed. The entity
   pass already tests every record against the screen; a record that fails is
   tested once more against the screen grown by a ring (RING of its shorter
   side), nearest band first, and what is found is baked with whatever is left
   of the frame's ordinary bake allowance, the time (BAKE_MS) and the count
   (BAKE_CAP) both, so a frame never bakes more than it already could. A pan
   then arrives at pictures that are waiting.
   What keeps it cheap and out of the way:
     - only while the garden's clock stands still (gardenClockStamp). While time
       runs every bucket is moving and a bake ahead of the camera would be dead
       before the camera got there; fast-forward has its own look-ahead.
     - a record found baked is marked with the generation (`_pb`), and the
       generation moves only when a key can have (the clock, the season, the
       zoom) or a sprite can have gone (an eviction). A settled garden pays four
       compares for each record near the screen and nothing else.
     - the far band stops at MEM of the budget. The NEAR band may go on to a
       little past the budget (OVER), but only while the cache's oldest sprite
       is something stale: then the next sweep, which takes the oldest first,
       drops that and keeps what was just baked beside the screen. When the
       oldest thing left is on screen, or is itself a bake from this ring, there
       is nothing to trade and it stops, or it would be baking for the sweep.
     - a moving view gets a share of the allowance (MOVING), an idle one all of it. */
const PREBAKE={gen:1, at:NaN, scale:-1, season:null, near:[], far:[],
  RING:0.6, NEAR:0.22, LIST:96, MEM:0.8, OVER:1.12, MOVING:0.5, on:true};
// is the least recently used sprite something a sweep could take in place of a new one
function prebakeCanTrade(){
  const it=PSPRITE.map.values().next();
  return !it.done && it.value.used<PSPRITE.frame-1 && !it.value.pre;
}
// the ring's reach this frame in draw units, or 0 when nothing is to be baked ahead
function prebakeReach(W,H,season){
  if (!PREBAKE.on || PSPRITE.cold) return 0;
  const at=gardenClockStamp();
  if (at!==at) return 0;                         // the clock is running
  if (game.ffActive) return 0;
  if (PSPRITE.bytes>=PSPRITE.MEM*PREBAKE.MEM && !(PSPRITE.bytes<PSPRITE.MEM*PREBAKE.OVER && prebakeCanTrade())) return 0;
  if (at!==PREBAKE.at || PSPRITE.scale!==PREBAKE.scale || season!==PREBAKE.season){
    PREBAKE.at=at; PREBAKE.scale=PSPRITE.scale; PREBAKE.season=season; PREBAKE.gen++;
  }
  return Math.min(W,H)*PREBAKE.RING;
}
// a record the screen test rejected: is it inside the ring, and how near
function prebakeNote(e,x0,x1,y0,y1,W,H,reach){
  const dx=x1<0?-x1:x0>W?x0-W:0, dy=y1<0?-y1:y0>H?y0-H:0, d=dx>dy?dx:dy;
  if (d>reach) return;
  const list=d<=reach*PREBAKE.NEAR ? PREBAKE.near : PREBAKE.far;
  if (list.length<PREBAKE.LIST) list.push(e);
}
// bake one clump's sprite as the frame would ask for it; 1 if a bake was done
function prebakePlant(e,season){
  let g=sceneEntGrowth(e);
  if (e.kind===SCENE_K.BULB){ if (g<=0.02){ e._pb=PREBAKE.gen; return 0; } }   // underground
  else if (e.stunt) g*=STUNT_GROWTH;
  const kk=plantKeyNow(e,e.p.s,e.p.v,season,g), have=PSPRITE.map.get(kk);
  if (have){
    const hs=have.want!==undefined?have.want:have.s;
    const stale=Math.abs(hs-PSPRITE.scale)>PSPRITE.scale*0.12 && !(have.capped && PSPRITE.scale>have.s);
    if (!stale || !spriteZoomSettled){ if (!stale) e._pb=PREBAKE.gen; return 0; }
  }
  const ne=makePlantSprite(e.p.s,e._kg,e._kb,season,e.seed,e.p.v,e.kind===SCENE_K.PLANT?e.detail:undefined,e._kl);
  if (!ne){ e._pb=PREBAKE.gen; return 0; }
  if (have){ PSPRITE.bytes-=have.bytes; releasePlantEntry(have); }
  // whatever this clump was cached as before is an old bucket: dead
  const slot=e.kSlot, was=PSPRITE.slot.get(slot);
  if (was!==undefined && was!==kk){ const d=PSPRITE.map.get(was); if (d) retirePlantSprite(was,d); }
  ne.used=PSPRITE.frame; ne.slot=slot; ne.pre=true;   // baked ahead and not yet drawn
  PSPRITE.map.set(kk,ne); PSPRITE.slot.set(slot,kk); PSPRITE.bytes+=ne.bytes;
  PSPRITE.spec.set(kk.slice(kk.indexOf('|')+1),kk);
  e._pb=PREBAKE.gen;
  return 1;
}
// after the entity pass: spend what is left of the frame's bake allowance on the ring
function prebakeRun(season,idle){
  const P=PREBAKE;
  if (!P.near.length && !P.far.length) return 0;
  const cap=PSPRITE.BAKE_CAP-PSPRITE.rendered;
  const ms=Math.min(PSPRITE.BAKE_MS-PSPRITE.bakeMs, PSPRITE.BAKE_MS*(idle?1:P.MOVING));
  let baked=0;
  if (cap>0 && ms>0){
    const t0=performance.now(), far=PSPRITE.MEM*P.MEM, near=PSPRITE.MEM*P.OVER;
    for (let pass=0; pass<2; pass++){
      const list=pass?P.far:P.near;
      for (let i=0;i<list.length;i++){
        if (baked>=cap || performance.now()-t0>=ms){ pass=2; break; }
        if (PSPRITE.bytes>=far && (pass || PSPRITE.bytes>=near || !prebakeCanTrade())) break;
        baked+=prebakePlant(list[i],season);
      }
    }
    PSPRITE.bakeMs+=performance.now()-t0; PSPRITE.rendered+=baked;
  }
  P.near.length=0; P.far.length=0;
  return baked;
}
/* ---------- structure sprite cache ----------
   Everything in the depth pass that is NOT a plant — fence, building tile,
   pot, seat, boulder, fire pit, pet, light, house — re-ran its whole procedural
   recipe on every frame, forever. Measured with drawProfile on a modestly
   furnished 69ft garden (651 plants, 85 fence tiles, a 195-tile garage, 14
   pots, 10 seats) that was 8.2ms of a 20.3ms frame: 40%, as much as all the
   sprite-cached planting put together, at 42us a fence tile, 14us a footprint
   tile, 52us a pot and 103us a seat against 11us for a blitted plant.

   None of them animate. Unlike drawPlant they take no `t` and no `sway`, so a
   structure is a pure function of its record, the season, the rotation and the
   zoom — which makes it exactly as cacheable as the ground, and it was the one
   large body of per-frame-constant drawing with no cache in front of it.

   Why this is per-ENTITY and not one baked layer: structures depth-sort
   INTERLEAVED with plants (a fence in front of a clump draws over it, a clump
   in front of a fence draws over that), so a single blitted layer would break
   the sort. Same shape as PSPRITE: bake small, blit in sorted position.

   THE KEY IS THE CONTENT, NOT THE POSITION, and that is what makes this pay.
   A key names everything the drawing reads — the record, the neighbours the
   drawing consults, the season, the rotation — and nothing else, so:
     - identical tiles SHARE one sprite. A 180-tile perimeter fence is a
       handful of distinct sprites (run, corner, end, post/no-post), and a
       195-tile building footprint is at most four (interior, two edges, both).
     - it needs no invalidation machinery at all. Edit a fence and its own key
       changes, and so do its neighbours' masks; the stale sprites fall out by
       LRU. No revision counter to bump, nothing to forget to bump, and no
       thrash while dragging — a long run of identical tiles is still one bake.
   The trap this avoids: keying on a layer revision looks equivalent and is
   not. Every stamp of a fence drag would invalidate every fence sprite, so the
   drag would pay the full procedural cost PLUS a bake — strictly worse than
   having no cache.

   Correctness rests on the keys being complete, so the record is serialised
   WHOLESALE (structRecordSig) rather than field by field: a field added to a
   pot or a seat later is in the key automatically, where a hand-listed key
   would silently start sharing sprites between different-looking objects. Only
   the two draws that read outside their own record — the fence and the
   building tile — name those reads explicitly. verifyStructureSprites() pixel-
   diffs the cached path against the procedural one for exactly this reason. */
const SSPRITE={ map:new Map(), frame:0, rendered:0, bytes:0,
  MEM:24*1024*1024,        // half the plant budget: far fewer, far smaller sprites
  BUDGET:24,               // bakes per frame; the rest fall through to procedural
  /* ...and JS time per frame for a RE-bake, one that has its own stale sprite
     to show meanwhile — PSPRITE's BAKE_MS rule, one cache over. A zoom settling
     re-bakes every structure on screen in one frame, and a structure is no longer
     a few shapes: a boulder is a solid of a few dozen faces (0.2-0.6ms
     procedurally, a grouping of five ~0.7ms) and a fire pit 0.5-1.4ms. Twenty
     boulders were a ~10ms frame at the end of every zoom; spent 4ms at a time
     they land over three, each still blitting its old sprite until then. A MISS
     never waits (it has nothing to show), nor does a photo. */
  BAKE_MS:4, bakeMs:0,
  off:false, active:true, scale:-1, hits:0, misses:0, fell:0,
  /* Bake at 1.5x the scale the blit needs. A structure carries detail as fine
     as a chair leg (1.6in, about 2px), and rasterising that onto the sprite's
     own grid and resampling it back softened exactly those members. Measured
     as the share of canvas pixels differing from the procedural draw: pots
     0.203% -> 0.047% and seats 0.270% -> 0.112% at rot 0, and roughly halved
     at rot 3. 2.0x measured NO better than 1.5x (0.065 / 0.141) for 1.8x the
     memory, so 1.5 is the knee rather than a taste. Costs area, i.e. 2.25x
     the bytes — 1.4MB to 3.1MB on a furnished garden, against a 24MB budget. */
  SS:1.5 };
// The scale the blit needs — the retina cap plants use.
function ssprBlitScale(){ return Math.min(DPR,1.5)*ZOOM; }
// ...and the scale we actually bake at (see SS above).
function ssprScale(){ return ssprBlitScale()*SSPRITE.SS; }
function ssprFrame(){
  SSPRITE.frame++; SSPRITE.rendered=0; SSPRITE.bakeMs=0; SSPRITE.scale=ssprScale();
  // evict only what was NOT drawn last frame, oldest first — never the visible
  // set, so the cache cannot thrash or flicker (the PSPRITE rule)
  if (SSPRITE.bytes>SSPRITE.MEM) for (const [k,e] of SSPRITE.map){
    if (SSPRITE.bytes<=SSPRITE.MEM) break;
    if (e.used>=SSPRITE.frame-1) continue; // renewed look-ahead leases need not be last in the Map
    SSPRITE.bytes-=e.bytes; SSPRITE.map.delete(k); retireSpriteImage(e.cv);
  }
}
/* The whole record, minus the bookkeeping that cannot change how it draws.
   Deliberately not a hand-listed field set — see the note above. */
function structRecordSig(rec){
  if (!rec) return '-';
  let out='';
  for (const k of Object.keys(rec).sort()){
    if (k==='t' || k==='removed') continue;
    const v=rec[k];
    out+=k+':'+(v&&typeof v==='object'?JSON.stringify(v):v)+';';
  }
  return out;
}
/* The screen point every one of these draws positions itself from. Recomputed
   per frame, so the camera cancels out of the bake and a pan is a pure blit. */
function structAnchor(e,W,H){
  if (e.kind===SCENE_K.HOUSE) return screenOf(e.h.x,e.h.y,W,H);
  if (e.kind===SCENE_K.BUILDING_OUTLINE){
    const r=buildingBounds(e.b);
    return r?screenOf(r.x0,r.y0,W,H):screenOf(0,0,W,H);
  }
  return screenOf(e.x,e.y,W,H);
}
/* One definition of "draw this entity procedurally", so the bake and the
   fallback cannot drift apart (the terrainCurveWalk rule). */
function drawStructEnt(ctx,e,W,H,season,lit){
  switch(e.kind){
    case SCENE_K.FENCE:   drawFence(ctx,W,H,season,e.f,e.x,e.y); return;
    case SCENE_K.LIGHT:   drawLightFixture(ctx,W,H,season,e.l,e.x,e.y,lit); return;
    case SCENE_K.FIREPIT: drawFirepit(ctx,W,H,season,e.f,e.x,e.y,lit); return;
    case SCENE_K.WATERF:  drawWaterFeature(ctx,W,H,season,e.wf,e.x,e.y); return;
    case SCENE_K.SUPPORT: drawSupport(ctx,W,H,season,e.sp,e.x,e.y); return;
    case SCENE_K.PERGOLA: drawPergola(ctx,W,H,season,e.pg,e.x,e.y,lit); return;
    case SCENE_K.BOULDER: drawBoulder(ctx,W,H,season,e.b,e.x,e.y); return;
    case SCENE_K.PET:{
      const [sx,sy]=screenOf(e.x,e.y,W,H);
      drawPet(ctx,sx,sy+TILE_H/2,e.p,1); return;
    }
    case SCENE_K.POT:  drawPot(ctx,W,H,season,e.p,e.x,e.y); return;
    case SCENE_K.SEAT: drawSeat(ctx,W,H,season,e.s,e.x,e.y); return;
    case SCENE_K.ORNAMENT: drawOrnament(ctx,W,H,season,e.o,e.x,e.y); return;
    case SCENE_K.BUILDING: drawBuildingTile(ctx,W,H,e.b,e.x,e.y); return;
    case SCENE_K.BUILDING_OUTLINE: drawBuildingOutline(ctx,W,H,e.b); return;
    case SCENE_K.HOUSE: drawHouse(ctx,W,H,season,e.h); return;
  }
}
/* What this entity's sprite is keyed on, how many tiles it spans and how far
   it reaches above the ground. `up` is deliberately generous — a clipped
   sprite is a visible bug and the memory is bounded by the LRU anyway — and
   verifyStructureSprites() is what proves each of these numbers covers its
   drawing. Returning null means "never cache this one". */
/* How many tiles a structure spans and how far its drawing reaches beyond
   them, in draw units. Split out of structSpriteSpec because the viewport cull
   needs the same numbers and a second copy of them would drift: a box too small
   here clips a sprite, and the identical box too small in the cull pops the
   structure in at the screen edge. Returning null means "no box" — only for a
   footprint with no bounds, which draws nothing either. */
function structDrawBox(e){
  switch(e.kind){
    case SCENE_K.FENCE:{
      /* A GATE spans a contiguous run of gate tiles and is drawn by its leading
         tile, so its reach is the run's, not its own. The span is cheap to ask
         for and gardens have one or two of them. */
      let span=0;
      if (e.f.gate){ const g=fenceGateSpan(e.x,e.y,fenceRunAxis(e.x,e.y)); span=g.a+g.b; }
      return {w:1, h:1, up:fenceDrawH(e.f)*1.5+52, pad:TILE_W*0.62+span*TILE_W*0.5, down:16+span*TILE_H*0.5};
    }
    case SCENE_K.BUILDING: return {w:1, h:1, up:26, pad:8, down:20};
    case SCENE_K.BUILDING_OUTLINE:{
      const r=buildingBounds(e.b); if (!r) return null;
      return {w:r.x1-r.x0+1, h:r.y1-r.y0+1, up:26, pad:14, down:24};
    }
    /* The three sideways-reaching kinds. Their pad and down are wider than they
       look because a piece's drawn LENGTH is its real length along its own
       axis, which projects past the diagonal span of the tiles it claims — and
       by different amounts at each camera rotation, since the object turns with
       the view. Measured against the actual ink at all four rotations
       (measureStructBoxes, dev), the old numbers were escaped by up to 79px on
       a seat, 47 on a pot and 12 on a boulder: sprites clipped at rot 1/2/3 and
       the viewport cull, which shares this box, dropped them early. (The
       boulder's 12 was not reach at all but its own position — it drew through
       the corner lattice until it was rebuilt, and now sits inside its tiles.) */
    case SCENE_K.POT:{
      const sz=potTileSize(e.p);
      return {w:sz.w, h:sz.h, up:feetToPx(46/12)+30, pad:TILE_W*1.05, down:48};
    }
    case SCENE_K.SEAT:{
      /* Measured on the rebuilt seats (drawSeatArt lays every member out in
         real inches inside its own footprint): across every piece, facing and
         rotation they reach 28px sideways, 66 above the footprint and 13 below
         it. The old 129 / 121 / 72 was holding the old painter, whose long
         pieces slid off their tiles as the view turned. What the box must still
         hold is a SLOPE, the boulder's reason: a seat may straddle a level
         change, and it is centred on the mean of its end tiles while the sprite
         is anchored on one. */
      const sz=seatTileSize(e.s), slope=(ELEV_MAX-ELEV_MIN)*ELEV_STEP/2;
      return {w:sz.w, h:sz.h, up:feetToPx(38/12)+slope+12, pad:TILE_W*0.5, down:slope+22};
    }
    case SCENE_K.ORNAMENT:{
      /* Every part is built inside the piece's stated box (ornamentBuild), so
         it reaches up by its own height and sideways by little more than its
         shadow: the widest, the 24 in insect hotel and the 30 in sphere, stand
         inside their tile diamonds at every turn. The slope is the seat's:
         a 2x2 piece is centred on the mean of its tiles and anchored on one. */
      const sz=ornamentTileSize(e.o), slope=sz.w*sz.h>1?(ELEV_MAX-ELEV_MIN)*ELEV_STEP/2:0;
      return {w:sz.w, h:sz.h, up:feetToPx(sz.spec.hIn/12)+slope+16, pad:TILE_W*0.3, down:slope+14};
    }
    case SCENE_K.BOULDER:{
      /* A boulder sits INSIDE its own tile diamonds — measured across every
         type, both seasons and all four rotations it needs 1px beyond them.
         This box used to be pad 42 / up 123 / down 24, and what it was holding
         was the old corner-lattice drift (half a tile sideways at rot 1 and 3,
         40px up at rot 2); measureStructBoxes passed the broken painter because
         of it. What it must still hold is a SLOPE: the centre is the mean of
         two tiles' elevations and the sprite is anchored on one, so a footprint
         straddling the whole earthwork range moves the stone half of it, up or
         down, off the anchor. */
      /* It now has a real HEIGHT, and stands up past the top of its own tiles
         by however much that height outreaches them: a 5 ft standing stone by
         ~80px, a 12 in pebble not at all. boulderReachUp is a bound rather than
         a guess because rockMesh rescales every shell to its stated size. The
         sides stay inside the diamonds — a type's width fits its footprint, a
         test pins it — so the pad is the soft shadow and a leaning stone. */
      const sz=boulderTileSize(e.b), slope=(ELEV_MAX-ELEV_MIN)*ELEV_STEP/2, spec=sz.spec;
      const over=Math.max(0,boulderReachUp(spec)-(sz.w+sz.h)*TILE_H/4);
      const lean=spec.form==='standing' ? spec.hIn*0.1*(TILE_W/2)/TILE_IN : 0;
      return {w:sz.w, h:sz.h, up:Math.ceil(over)+slope+12, pad:TILE_W*0.2+lean, down:slope+12};
    }
    case SCENE_K.FIREPIT:{
      /* Drawn at real size now, so it sits INSIDE its own footprint — the pad is
         the shadow's soft edge — and the tallest thing is the night fire in a
         fire bowl: a 16 in rim, a log stack and flames with sparks over them.
         Measured across every style, size, turn, season and night at all four
         rotations, that reaches 55px over the footprint's top vertex; this
         leaves ~18px of slack there and ~12px either side. */
      const sz=firepitTileSize(e.f);
      return {w:sz.w, h:sz.h, up:feetToPx(28/12)+24, pad:TILE_W*0.2, down:14};
    }
    case SCENE_K.WATERF:{
      // the tallest form is the 62in tiered fountain; the gravel bed and the
      // wall spout's backboard are what the pad has to cover sideways
      const sz=waterFeatureTileSize(e.wf);
      return {w:sz.w, h:sz.h, up:feetToPx(70/12)+30, pad:TILE_W*0.9, down:34};
    }
    case SCENE_K.SUPPORT:{
      // the tallest is the 8ft arch, and an arch's curve reaches wide of its legs
      const sz=supportTileSize(e.sp);
      return {w:sz.w, h:sz.h, up:feetToPx(9)+24, pad:TILE_W*0.8, down:22};
    }
    case SCENE_K.PERGOLA:
      // the tallest is 9 ft, and a rafter overhangs its own tile either side
      return {w:1, h:1, up:feetToPx(9)+26, pad:TILE_W*0.95, down:20};
    case SCENE_K.PET:   return {w:1, h:1, up:TILE_H*1.6+20, pad:TILE_W*0.4, down:18};
    case SCENE_K.LIGHT: return {w:1, h:1, up:feetToPx(8)+34, pad:TILE_W*0.4, down:18};
    case SCENE_K.HOUSE: return {w:e.h.w, h:e.h.h, up:TILE_H*e.h.h*1.2+240, pad:TILE_W*0.7, down:26};
  }
  return null;
}
/* Memoised on the scene record, for the reason bakePlantKeyParts exists: this
   was 1.265us x 295 structures = 0.373ms a frame, and every input it reads —
   the record, the neighbouring fences, the elevation samples, the rotation the
   building tile asks viewDirToWorld about — is something that rebuilds the
   scene list when it changes. A fresh record has no `_spec`, so a rebuild
   invalidates this by construction and there is nothing to remember to clear.
   `season`, `rot` and `lit` are deliberately NOT in spec.key (the caller
   appends them), so a night toggle, which does not rebuild the scene, still
   reaches a different sprite. */
function structSpriteSpec(e){
  if (e._spec!==undefined) return e._spec;
  return (e._spec=computeStructSpriteSpec(e));
}
function computeStructSpriteSpec(e){
  const box=structDrawBox(e);
  if (!box) return null;
  switch(e.kind){
    case SCENE_K.FENCE:{
      const f=e.f;
      /* A gate is not cached. It spans a contiguous run of gate tiles, so its
         drawing reaches arbitrarily far outside its own tile and its key would
         have to carry the whole run — for something a garden has one or two
         of. Not worth the surface area. */
      if (f.gate) return null;
      const x=e.x, y=e.y, st=fenceStyle(f.style);
      const nb=(fenceNeighbor(x+1,y)?1:0)|(fenceNeighbor(x-1,y)?2:0)|
               (fenceNeighbor(x,y+1)?4:0)|(fenceNeighbor(x,y-1)?8:0);
      const ax=fenceRunAxis(x,y);
      /* The half-segments end at ±0.48 of a tile, and screenOf lifts by
         elevation, so a fence on a terrace edge is a different shape. Five
         samples cover every point the drawing can reach. */
      const ev=elevationAt(x,y)+'.'+elevationAt(x+1,y)+'.'+elevationAt(x-1,y)+
               '.'+elevationAt(x,y+1)+'.'+elevationAt(x,y-1);
      /* fencePostHere folds in the run ends, corners, tees, gate jambs AND
         `coord % FENCE_POST_TILES`, so ASK it rather than restating it —
         restating it is how a cached fence loses its posts. */
      const post=fencePostHere(x,y)?1:0;
      // the seed reaches the drawing through one path only: masonry joints
      const seed=st.infill==='masonry'?tileSeed(x,y):0;
      return Object.assign({key:'F|'+structRecordSig(f)+'|'+nb+'|'+ax[0]+','+ax[1]+'|'+post+'|'+ev+'|'+seed}, box);
    }
    case SCENE_K.BUILDING:{
      /* Only the two faces the CAMERA can see are conditional, and they depend
         on whether the footprint continues that way — so a whole garage is at
         most four distinct sprites. */
      const set=buildingTileSet(e.b);
      const [rx,ry]=viewDirToWorld(1,0), [dx,dy]=viewDirToWorld(0,1);
      const r=set.has((e.x+rx)+','+(e.y+ry))?1:0, d=set.has((e.x+dx)+','+(e.y+dy))?1:0;
      const b=e.b;
      return Object.assign({key:'U|'+(b.fill||b.roof||'')+'|'+(b.edge||b.wall||'')+'|'+(b.status||'')+'|'+r+d}, box);
    }
    case SCENE_K.BUILDING_OUTLINE:
      return Object.assign({key:'V|'+structRecordSig(e.b)}, box);
    case SCENE_K.POT:
      return Object.assign({key:'P|'+structRecordSig(e.p)}, box);
    case SCENE_K.SEAT:
      return Object.assign({key:'S|'+structRecordSig(e.s)}, box);
    // a made thing: nothing is seeded off its tile, so two of a kind share a sprite
    case SCENE_K.ORNAMENT:
      return Object.assign({key:'D|'+structRecordSig(e.o)}, box);
    case SCENE_K.BOULDER:
      /* The shape comes from the stone's own seed (boulderSeedAt), not from
         where it stands — so a moved stone finds its sprite already baked,
         and a stone with no seed of its own falls back to its tile's. */
      return Object.assign({key:'O|'+structRecordSig(e.b)+'|'+boulderSeedAt(e.b,e.x,e.y)}, box);
    case SCENE_K.FIREPIT:
      /* The stones, the logs and the flames are seeded off the tile, like a
         boulder's shape; the night fire is the `lit` flag the caller appends. */
      return Object.assign({key:'R|'+structRecordSig(e.f)+'|'+tileSeed(e.x,e.y)}, box);
    case SCENE_K.WATERF:
      /* The gravel bed and the ripples are seeded off the tile, like a boulder's
         shape -- and whether the piece stands IN water is the one thing the
         drawing reads that is NOT on its own record, so it is named here for the
         reason the fence names its neighbour mask. Leave it out and dropping a
         pond around a birdbath leaves the dry sprite in place. */
      return Object.assign({key:'W|'+structRecordSig(e.wf)+'|'+tileSeed(e.x,e.y)+
        '|'+(tileTerrain(e.x,e.y)==='water'?1:0)}, box);
    case SCENE_K.SUPPORT:
      // the willow weave is seeded off the tile; timber and metal are not
      return Object.assign({key:'V|'+structRecordSig(e.sp)+'|'+tileSeed(e.x,e.y)}, box);
    case SCENE_K.PERGOLA:
      /* Like a fence, it reads OUTSIDE its own record -- the whole roof decides
         where this tile's posts, beams and rafter ends fall. pergolaFrameAt is
         that answer as plain data, and drawPergolaBay reads nothing else, so
         the frame IS the key: ASK it rather than restating its rules, which is
         how a cached fence once lost its posts. Elevation is not in it: every
         member is placed off this tile's own anchor, which the blit supplies. */
      // a lit roof's strings are frame too: where this bay's piece of string runs
      return Object.assign({key:'G|'+structRecordSig(e.pg)+'|'+JSON.stringify(pergolaFrameAt(e.x,e.y))+
        '|'+JSON.stringify(festoonRunAt(e.x,e.y))}, box);
    case SCENE_K.PET:
      return Object.assign({key:'T|'+structRecordSig(e.p)}, box);
    case SCENE_K.LIGHT:
      return Object.assign({key:'L|'+structRecordSig(e.l)}, box);
    case SCENE_K.HOUSE:
      return Object.assign({key:'H|'+structRecordSig(e.h)}, box);
  }
  return null;
}
/* The sprite's rect in draw units, relative to the anchor. The footprint's
   screen extent comes from screenDeltaForWorld, so it is correct at every
   rotation rather than assuming rot 0. */
function structSpriteBox(spec){
  let minX=-TILE_W/2, maxX=TILE_W/2, minY=0, maxY=TILE_H;
  const corners=[[0,0],[spec.w-1,0],[0,spec.h-1],[spec.w-1,spec.h-1]];
  for (const [dx,dy] of corners){
    const [px,py]=screenDeltaForWorld(dx,dy);
    if (px-TILE_W/2<minX) minX=px-TILE_W/2;
    if (px+TILE_W/2>maxX) maxX=px+TILE_W/2;
    if (py<minY) minY=py;
    if (py+TILE_H>maxY) maxY=py+TILE_H;
  }
  return {left:minX-spec.pad, right:maxX+spec.pad,
          top:minY-spec.up, bottom:maxY+(spec.down||16)};
}
function makeStructSprite(e,spec,season,W,H,lit){
  const b=structSpriteBox(spec);
  const bw=b.right-b.left, bh=b.bottom-b.top;
  if (!(bw>0&&bh>0)) return null;
  const want=ssprScale();
  // clamp the RESOLUTION of a giant (a house) rather than refusing to cache it
  const s=Math.min(want, spriteMaxPx()/Math.max(bw,bh));
  const pw=Math.max(1,Math.ceil(bw*s)), ph=Math.max(1,Math.ceil(bh*s));
  if (pw>2200||ph>2200) return null;
  const cv=spriteBakeSurface('struct',pw,ph);
  const c2=cv.getContext('2d'); if (!c2){ abandonBakeSurface('struct',cv); spriteMemoryPressure(); return null; }
  const [sx,sy]=structAnchor(e,W,H);
  /* Bake with the CURRENT camera and translate it back out: the draws compute
     their own screen position through screenOf, so shifting the origin by the
     anchor is what makes the result camera-independent. */
  c2.setTransform(s,0,0,s,-b.left*s,-b.top*s);
  c2.translate(-sx,-sy);
  drawStructEnt(c2,e,W,H,season,lit);
  return {cv:spriteBakeImage('struct',cv), ox:b.left, oy:b.top, s, want, capped:s<want, bytes:pw*ph*4};
}
// blit a cached structure if we can, else draw it live — never drop one
function drawStructMaybeCached(e,W,H,season,lit,ctx=cx){
  if (SSPRITE.off || !SSPRITE.active){ drawStructEnt(ctx,e,W,H,season,lit); return; }
  const spec=structSpriteSpec(e);
  if (!spec){ drawStructEnt(ctx,e,W,H,season,lit); return; }
  // the string is kept with the three things appended to it, as a plant's is
  // (drawPlantMaybeCached): it was rebuilt per structure per frame
  let kk;
  const lit1=lit?1:0;
  if (spec.kSeason===season && spec.kRot===game.rot && spec.kLit===lit1) kk=spec.kk;
  else { kk=spec.key+'|'+season+'|'+game.rot+'|'+lit1; spec.kSeason=season; spec.kRot=game.rot; spec.kLit=lit1; spec.kk=kk; }
  let sp=SSPRITE.map.get(kk);
  // a sprite baked at a very different zoom blits soft: rebake it, budget
  // permitting, but keep using the old one this frame rather than dropping to
  // a slow procedural draw mid-gesture (the PSPRITE rule) — and, also as
  // PSPRITE does, wait for the zoom gesture to settle before rescaling at all.
  // Far fewer sprites here (39 for 318 entities on a furnished garden), so this
  // is the smaller half of the win; it is here so the two caches cannot drift.
  const had=!!sp, eScale=sp&&(sp.want!==undefined?sp.want:sp.s);
  const sDrift=sp?Math.abs(eScale-SSPRITE.scale):0;
  const sRescale = !!sp && sDrift>SSPRITE.scale*0.12
    && !(sp.capped && SSPRITE.scale>sp.s)
    && spriteRescaleDue(eScale,SSPRITE.scale);
  if (!sp || sRescale){
    // only on the live canvas: preparing a garden to open must finish its bakes
    const wait=sRescale && ctx===cx && !game.photo && SSPRITE.bakeMs>=SSPRITE.BAKE_MS;
    if (!wait && SSPRITE.rendered<SSPRITE.BUDGET){
      const t0=performance.now();
      const ns=makeStructSprite(e,spec,season,W,H,lit);
      SSPRITE.bakeMs+=performance.now()-t0;
      if (ns){ if (sp){ SSPRITE.bytes-=sp.bytes; retireSpriteImage(sp.cv); } sp=ns; SSPRITE.rendered++; SSPRITE.bytes+=ns.bytes; }
    }
    if (!sp){ SSPRITE.fell++; drawStructEnt(ctx,e,W,H,season,lit); return; }
  }
  if (had) SSPRITE.hits++; else SSPRITE.misses++;
  if (SSPRITE.map.has(kk)) SSPRITE.map.delete(kk);   // LRU: re-insert at the end
  sp.used=SSPRITE.frame;
  SSPRITE.map.set(kk,sp);
  if (!sp.cv.width) return;   // a closed bitmap (retireSpriteImage) — drawImage would throw
  // the anchor baked with the scene plus this frame's camera (setEntDrawPoint)
  let ax, ay;
  if (e.px!==undefined){ ax=e.px+W/2-cam.x; ay=e.py+H*0.24-cam.y; }
  else { const a=structAnchor(e,W,H); ax=a[0]; ay=a[1]; }
  ctx.drawImage(sp.cv, ax+sp.ox, ay+sp.oy, sp.cv.width/sp.s, sp.cv.height/sp.s);
}
/* ---- dev-only: prove the cached path draws the same picture ----
   The whole design rests on a key naming everything its drawing reads, and the
   failure mode of getting that wrong is silent: a sprite that is subtly stale,
   or a box that clips a fence post off the top. So diff the two paths pixel by
   pixel rather than trusting the reasoning.

     verifyStructureSprites()            // every kind present in the garden
     verifyStructureSprites({rot:true})  // and at all four rotations

   `diff` is the share of canvas pixels that differ at all and `worst` the
   largest single-channel difference. Small numbers are antialiasing — the
   sprite rasterises on its own pixel grid and blits back at a fractional
   offset, so edges land a fraction differently. A CLIPPED sprite or a stale
   key does not look like that: it shows as a large diff share. */
/* Did any sprite draw right up to its own edge? This is the direct test for a
   box that is too small, and the pixel diff is a poor substitute for it: a
   clipped fence post is a few hundred pixels, which rounds to nothing as a
   share of the canvas. Non-transparent pixels on the border row or column
   mean the drawing wanted more room than structSpriteSpec gave it. */
/* ---- dev-only: are the structure boxes big enough? ----
   structDrawBox feeds two things — the sprite bake and the viewport cull — and
   the failure of a box that is too small is different in each: a clipped sprite,
   and a structure that pops in at the screen edge. Both are silent.

   So measure the drawing rather than reasoning about it: paint each kind into a
   big offscreen canvas centred on its anchor, find the ink, and compare against
   what the box allows. AT ALL FOUR ROTATIONS — a piece turns with the camera and
   its drawn length projects past the diagonal span of the tiles it claims by a
   different amount at each one, which is exactly what the first cut of this got
   wrong (seat 79px, pot 47px, boulder 12px out, at rot 1-3 only).

     measureStructBoxes()   // {} means every box contains its drawing */
function measureStructBoxes(){
  const PAD=700, rot0=game.rot;
  const cv=document.createElement('canvas'); cv.width=PAD*2; cv.height=PAD*2;
  const c2=cv.getContext('2d',{willReadFrequently:true});
  if (!c2 || typeof c2.getImageData!=='function') return {unavailable:true};
  const W=VW/ZOOM, H=VH/ZOOM, season=calClock().season, x=23, y=23;
  const inkOf=(fn,ax,ay)=>{
    c2.setTransform(1,0,0,1,0,0); c2.clearRect(0,0,cv.width,cv.height);
    c2.setTransform(1,0,0,1,PAD-ax,PAD-ay); fn(c2); c2.setTransform(1,0,0,1,0,0);
    let d; try{ d=c2.getImageData(0,0,cv.width,cv.height).data; }catch(_){ return null; }
    let l=1e9,r=-1e9,t=1e9,b=-1e9;
    for (let i=3;i<d.length;i+=4){ if (d[i]<8) continue;
      const p=(i-3)/4, px=p%cv.width, py=(p/cv.width)|0;
      if (px<l)l=px; if (px>r)r=px; if (py<t)t=py; if (py>b)b=py; }
    return l>r ? null : {left:l-PAD, right:r-PAD, top:t-PAD, bottom:b-PAD};
  };
  const cases=[];
  for (const st of SEAT_TYPES) for (let f=0;f<4;f++)
    cases.push({name:'SEAT:'+st.id+'/f'+f, kind:SCENE_K.SEAT, field:'s', rec:{type:st.id,finish:'teak',face:f,t:1},
      size:s=>seatTileSize(s), draw:(c,s)=>drawSeat(c,W,H,season,s,x,y)});
  for (const o of ORNAMENTS) for (const fin of ornamentFinishes(o.id)) for (let f=0;f<4;f++)
    cases.push({name:'ORNAMENT:'+o.id+'/'+fin.id+'/f'+f, kind:SCENE_K.ORNAMENT, field:'o', rec:{kind:o.id,finish:fin.id,face:f,t:1},
      size:s=>ornamentTileSize(s), draw:(c,s)=>drawOrnament(c,W,H,season,s,x,y)});
  for (const p of POT_STYLES) for (let f=0;f<4;f++) for (const sz of POT_SIZES)
    cases.push({name:'POT:'+p.id+'/'+sz.id+'/f'+f, kind:SCENE_K.POT, field:'p',
      rec:{style:p.id,size:potSizeFor(p.id,sz.id),face:f,t:1},
      size:s=>potTileSize(s), draw:(c,s)=>drawPot(c,W,H,season,s,x,y)});
  // every type at every facing, in its default stone and (where it comes in
  // it) water-worn river rock, the one stone that changes the shell
  for (const b of BOULDER_TYPES) for (let f=0;f<4;f++)
    for (const stone of [...new Set([boulderTypeStones(b.id)[0].id, boulderStoneFor(b.id,'river')])])
      cases.push({name:'BOULDER:'+b.id+'/'+stone+'/f'+f, kind:SCENE_K.BOULDER, field:'b', rec:{type:b.id,stone,face:f,t:1},
        size:s=>boulderTileSize(s), draw:(c,s)=>drawBoulder(c,W,H,season,s,x,y)});
  // every style at every size it is made in, turned, and by night — the night
  // fire in a bowl is the tallest thing the box has to hold
  for (const st of FIREPIT_STYLES) for (const sz of firepitStyleSizes(st.id))
    for (const face of (sz.wIn!==sz.dIn?[0,1]:[0])) for (const lit of [false,true])
      cases.push({name:'FIREPIT:'+st.id+'/'+sz.id+'/f'+face+(lit?'/lit':''), kind:SCENE_K.FIREPIT, field:'f',
        rec:{style:st.id,shape:sz.shape,size:sz.id,face,t:1},
        size:s=>firepitTileSize(s), draw:(c,s)=>drawFirepit(c,W,H,season,s,x,y,lit)});
  for (const w of WATER_FEATURES) for (const fin of waterFeatureFinishes(w.id)) for (let f=0;f<4;f++)
    cases.push({name:'WATERF:'+w.id+'/'+fin.id+'/f'+f, kind:SCENE_K.WATERF, field:'wf',
      rec:{form:w.id,finish:fin.id,face:f,t:1},
      size:s=>waterFeatureTileSize(s), draw:(c,s)=>drawWaterFeature(c,W,H,season,s,x,y)});
  for (const sp of SUPPORT_STYLES) for (const m of sp.materials) for (let f=0;f<4;f++)
    cases.push({name:'SUPPORT:'+sp.id+'/'+m+'/f'+f, kind:SCENE_K.SUPPORT, field:'sp',
      rec:{style:sp.id,mat:m,face:f,t:1},
      size:s=>supportTileSize(s), draw:(c,s)=>drawSupport(c,W,H,season,s,x,y)});
  for (const fs of FENCE_STYLES) for (const h of fenceStyleHeights(fs.id))
    cases.push({name:'FENCE:'+fs.id+'/'+h, kind:SCENE_K.FENCE, field:'f', rec:{style:fs.id,height:h,gate:false,t:1},
      size:()=>({w:1,h:1}), draw:(c,s)=>drawFence(c,W,H,season,s,x,y)});
  for (const m of PERGOLA_MATERIALS) for (const ht of PERGOLA_HEIGHTS)
    cases.push({name:'PERGOLA:'+m.id+'/'+ht, kind:SCENE_K.PERGOLA, field:'pg',
      rec:{mat:m.id,height:ht,t:1},
      size:()=>({w:1,h:1}), draw:(c,s)=>drawPergola(c,W,H,season,s,x,y)});
  // lit as well as not: a torch's flame is a night-only part, and the box must hold it
  for (const lt of LIGHT_TYPES) for (const fi of lightTypeFinishes(lt.id)) for (const lit of [false,true])
    cases.push({name:'LIGHT:'+lt.id+'/'+fi.id+(lit?'/lit':''), kind:SCENE_K.LIGHT, field:'l',
      rec:{type:lt.id,tone:'warm',finish:fi.id,t:1},
      size:()=>({w:1,h:1}), draw:(c,s)=>drawLightFixture(c,W,H,season,s,x,y,lit)});
  for (const sp of PET_SPECIES)
    cases.push({name:'PET:'+sp.id, kind:SCENE_K.PET, field:'p', rec:{species:sp.id,coat:PET_COATS[0].id,t:1},
      size:()=>({w:1,h:1}), draw:(c,s)=>{ const [sx,sy]=screenOf(x,y,W,H); drawPet(c,sx,sy+TILE_H/2,s,1); }});
  const worst={}, escaping=[];
  try{
    for (let r=0;r<4;r++){
      game.rot=r;
      for (const cse of cases){
        const rec=cse.rec, sz=cse.size(rec);
        const e={kind:cse.kind, x, y, bx0:x, bx1:x+sz.w-1, by0:y, by1:y+sz.h-1};
        e[cse.field]=rec;
        const box=structDrawBox(e); if (!box) continue;
        const [ax,ay]=screenOf(x,y,W,H);
        const ink=inkOf(c=>cse.draw(c,rec),ax,ay); if (!ink) continue;
        let ox0=Infinity,ox1=-Infinity,oy0=Infinity,oy1=-Infinity;
        for (let yy=e.by0; yy<=e.by1; yy++) for (let xx=e.bx0; xx<=e.bx1; xx++){
          const [vx,vy]=worldToView(xx,yy), px=isoX(vx,vy), py=isoY(vx,vy);
          if (px<ox0)ox0=px; if (px>ox1)ox1=px; if (py<oy0)oy0=py; if (py>oy1)oy1=py;
        }
        const [v0x,v0y]=worldToView(x,y), a0x=isoX(v0x,v0y), a0y=isoY(v0x,v0y);
        const esc={
          left:  Math.max(0, ((ox0-(TILE_W*0.5+box.pad))-a0x) - ink.left),
          right: Math.max(0, ink.right - ((ox1+(TILE_W*0.5+box.pad))-a0x)),
          top:   Math.max(0, ((oy0-box.up)-a0y) - ink.top),
          bottom:Math.max(0, ink.bottom - ((oy1+TILE_H+box.down)-a0y)) };
        if (!(esc.left||esc.right||esc.top||esc.bottom)) continue;
        const kind=cse.name.split(':')[0];
        const w=worst[kind]||(worst[kind]={left:0,right:0,top:0,bottom:0});
        for (const k in esc) if (esc[k]>w[k]) w[k]=esc[k];
        escaping.push({rot:r, name:cse.name, esc});
      }
    }
  } finally { game.rot=rot0; game.sceneRev++; groundKey=''; }
  console.log('measureStructBoxes: '+escaping.length+' of '+(cases.length*4)+' escape their box');
  return {worstByKind:worst, escaping:escaping.length, cases:escaping.slice(0,12)};
}
/* ---- dev-only: does a piece's INK sit over the tiles it claims? ----
   The blind spot the other three verifiers share, and the one that has now cost
   three bugs: water features drifting 152px at rot2, pots and seats up to 114px,
   and — caught by mutating it — a support centred on the wrong footprint.
   measureStructBoxes cannot see any of them, because `pad` is deliberately wide
   enough that a whole tile of drift still fits inside the box; and
   verifyStructureSprites cannot, because both of its arms draw through the same
   function, so a shared wrong position cancels. The instrument that works is
   the one §12d records: measure ink against the tiles the piece claims, at all
   four rotations. Every case here is horizontally symmetric about its ground
   centre, so the ink's mid-x IS the answer.

     measureFootprintCentres()      // {worst, off:[...]}  — expect worst under ~5px

   It reports past 6px rather than past 0, and the slack is measured rather than
   chosen: a piece centred on the wrong footprint is out by at least half a tile
   — mutating drawSupport to centre on {w:1,h:1} put the trellis at 19.5px and
   the arch at 38.5 — while a drawing that is honestly LOPSIDED sits a few px
   off its own centre whatever the code does. The sun lounger used to be the
   one here, ~4.5px off because it reclines at one end; rebuilt in real inches
   with a footprint shadow it measures under 1px, like every other seat, and
   the seeded outline of a rounded boulder is now the lopsided case. 6px keeps
   a real drift caught with three times the margin.

   Multi-tile pieces only: a 1x1 piece is right at every rotation by
   construction, which is exactly why all three bugs lasted as long as they did. */
function measureFootprintCentres(){
  const PAD=700;
  const cv=document.createElement('canvas'); cv.width=PAD*2; cv.height=PAD*2;
  const c2=cv.getContext('2d',{willReadFrequently:true});
  if (!c2 || typeof c2.getImageData!=='function') return {unavailable:true};
  const W=VW/ZOOM, H=VH/ZOOM, season=calClock().season, x=15, y=15, rot0=game.rot;
  const cases=[];
  for (const t of SEAT_TYPES) for (let f=0;f<4;f++)
    cases.push({name:'SEAT:'+t.id+'/f'+f, rec:{type:t.id,finish:'teak',face:f,t:1},
      size:s=>seatTileSize(s), draw:(c,s)=>drawSeat(c,W,H,season,s,x,y)});
  // the large sphere and the compost bay are 2x2; every piece is checked anyway
  for (const o of ORNAMENTS) for (let f=0;f<4;f++)
    cases.push({name:'ORNAMENT:'+o.id+'/f'+f, rec:{kind:o.id,finish:o.finishes[0],face:f,t:1},
      size:s=>ornamentTileSize(s), draw:(c,s)=>drawOrnament(c,W,H,season,s,x,y)});
  for (const p of POT_STYLES) for (const sz of potStyleSizes(p.id)) for (let f=0;f<4;f++)
    cases.push({name:'POT:'+p.id+'/'+sz.id+'/f'+f, rec:{style:p.id,size:sz.id,face:f,t:1},
      size:s=>potTileSize(s), draw:(c,s)=>drawPot(c,W,H,season,s,x,y)});
  for (const w of WATER_FEATURES) for (let f=0;f<4;f++)
    cases.push({name:'WATERF:'+w.id+'/f'+f, rec:{form:w.id,finish:waterFeatureFinishes(w.id)[0].id,face:f,t:1},
      size:s=>waterFeatureTileSize(s), draw:(c,s)=>drawWaterFeature(c,W,H,season,s,x,y)});
  for (const sp of SUPPORT_STYLES) for (const m of sp.materials) for (let f=0;f<4;f++)
    cases.push({name:'SUPPORT:'+sp.id+'/'+m+'/f'+f, rec:{style:sp.id,mat:m,face:f,t:1},
      size:s=>supportTileSize(s), draw:(c,s)=>drawSupport(c,W,H,season,s,x,y)});
  /* Every fire pit is multi-tile — even a 24 in pit claims 2x2 — and it drew
     through the corner lattice until it was rebuilt, i.e. a whole tile off its
     own footprint at rot 2. */
  for (const st of FIREPIT_STYLES) for (const sz of firepitStyleSizes(st.id))
    for (const face of (sz.wIn!==sz.dIn?[0,1]:[0]))
      cases.push({name:'FIREPIT:'+st.id+'/'+sz.id+'/f'+face, rec:{style:st.id,shape:sz.shape,size:sz.id,face,t:1},
        size:s=>firepitTileSize(s), draw:(c,s)=>drawFirepit(c,W,H,season,s,x,y,false)});
  /* Boulders drew through the same corner polygon as the old fire pit, and
     drifted the same way: +35px in x at rot 1, -45px in y at rot 2, -41px in x
     at rot 3. This measures x only, so the rot-2 half of that is invisible
     here — but the corner lattice cannot be out at rot 2 without also being
     out at rot 1 and 3, which is where it is caught. A rounded boulder is not
     exactly symmetric — its outline is seeded — so its ink sits a few px off
     centre by design, the lounger's case. */
  /* A rock is not symmetric about its ground centre — its shell is seeded, a
     standing stone leans and a grouping is laid as a scalene triangle — so its
     honest ink centre is measured off the shell itself (`lop`), and what is
     checked is that the drawing lands where its own geometry says it should. */
  for (const b of BOULDER_TYPES) for (let f=0;f<4;f++)
    cases.push({name:'BOULDER:'+b.id+'/f'+f, rec:{type:b.id,face:f,t:1},
      size:s=>boulderTileSize(s), draw:(c,s)=>drawBoulder(c,W,H,season,s,x,y),
      lop:s=>{ const d=normalizeBoulderDraft(s), [ax,ay]=turnAxes(isoAxes(),d.face), P=fpProjector(0,0,ax,ay);
        let l=1e9, r=-1e9;
        for (const m of boulderMeshes(d,boulderSeedAt(s,x,y))) for (const p of m.V){ const q=P(p[0],p[1],p[2]); if (q[0]<l)l=q[0]; if (q[0]>r)r=q[0]; }
        return (l+r)/2; }});
  const off=[]; let worst=0, worstName='', n=0;
  try{
    for (let r=0;r<4;r++){
      game.rot=r;
      for (const cse of cases){
        const sz=cse.size(cse.rec);
        if (sz.w===1 && sz.h===1) continue;     // right by construction
        const [ax,ay]=screenOf(x,y,W,H);
        c2.setTransform(1,0,0,1,0,0); c2.clearRect(0,0,cv.width,cv.height);
        c2.setTransform(1,0,0,1,PAD-ax,PAD-ay); cse.draw(c2,cse.rec); c2.setTransform(1,0,0,1,0,0);
        let d; try{ d=c2.getImageData(0,0,cv.width,cv.height).data; }catch(_){ continue; }
        let l=1e9, rr=-1e9;
        for (let i=3;i<d.length;i+=4){ if (d[i]<24) continue;
          const px=((i-3)/4)%cv.width; if (px<l)l=px; if (px>rr)rr=px; }
        if (l>rr) continue;
        n++;
        const ink=(l+rr)/2-PAD+ax, want=groundCenterRot(x,y,sz,W,H)[0]+(cse.lop?cse.lop(cse.rec):0), dx=Math.abs(ink-want);
        if (dx>worst){ worst=dx; worstName=cse.name+' rot'+r; }
        if (dx>6) off.push({rot:r, name:cse.name, px:+dx.toFixed(1)});
      }
    }
  } finally { game.rot=rot0; game.sceneRev++; groundKey=''; }
  console.log('measureFootprintCentres: '+n+' multi-tile cases, worst '+worst.toFixed(1)+
    'px ('+(worstName||'none')+')\n  '+(off.length
      ? off.length+' piece(s) drawn off their own footprint by more than 6px:\n    '+
        off.slice(0,8).map(o=>o.name+' rot'+o.rot+'  '+o.px+'px').join('\n    ')
      : 'every piece sits over the tiles it claims'));
  return {worst:+worst.toFixed(1), worstName, cases:n, off};
}
/* ---- dev-only: does the viewport cull ever drop something visible? ----
   The cull rejects roughly half the entity pass, and the failure mode is a
   structure or a clump that pops in at the screen edge — localised, brief, and
   camera-dependent, which is to say almost impossible to notice by looking. So
   diff the frame against one rendered with the cull disabled entirely.

     verifySceneCull()             // several cameras, all four rotations
     verifySceneCull({rot:false})  // just the current rotation

   Three things make the comparison honest, each of which cost a wrong answer
   first. Both sprite caches are pinned OFF, because the no-cull arm draws ~700
   more entities and perturbs the bake budget and the LRU, which changes whether
   an ON-screen plant is blitted or drawn live — a 1-6 level difference smeared
   over the whole canvas. The clock is paused so neither growth nor a day/season
   boundary changes the scene underneath the harness.
   And each arm renders until two consecutive frames are byte-identical, since
   the frame after a camera move is a warm-up. */
function verifySceneCull(opts){
  opts=opts||{};
  if (!cx || typeof cx.getImageData!=='function') return {unavailable:true};
  const p0=PSPRITE.off, s0=SSPRITE.off, rot0=game.rot, cx0=cam.x, cy0=cam.y,
        pa0=game.pausedAt, pv0=game.previewMode, T=12345.678;
  try{
    PSPRITE.off=true; SSPRITE.off=true;
    if (!game.pausedAt) game.pausedAt=Date.now();
    game.previewMode='established';        // full-size plants: the worst case for overhang
    game.sceneRev++; groundKey='';
    const grab=()=>cx.getImageData(0,0,cnv.width,cnv.height).data;
    const diff=(p,q)=>{ let n=0,w=0;
      for (let i=0;i<p.length;i+=4){
        const m=Math.max(Math.abs(p[i]-q[i]),Math.abs(p[i+1]-q[i+1]),Math.abs(p[i+2]-q[i+2]));
        if (m>0){ n++; if (m>w) w=m; } }
      return {n,w}; };
    const settle=()=>{ let prev=null;
      for (let i=0;i<40;i++){ render(T); const c=grab(); if (prev && diff(prev,c).n===0) return c; prev=c; }
      return prev; };
    const cams=opts.cams||[[0,0],[-380,-260],[420,300],[-700,180],[640,-240],[900,520],[-980,-560]];
    const rots=opts.rot===false?[game.rot]:[0,1,2,3];
    const out=[];
    for (const r of rots){
      if (game.rot!==r){ game.rot=r; game.sceneRev++; groundKey=''; }
      for (const [dx,dy] of cams){
        snapCam(); cam.x+=dx; cam.y+=dy;
        const a=settle(), ctrl=settle();
        // both screen-space culls: the entity pass AND the shrub footprint pass
        const ents=scene.ents.concat(scene.shrubs);
        const saved=ents.map(e=>[e.ox0,e.ox1,e.oy0,e.oy1]);
        const W=VW/ZOOM, H=VH/ZOOM, offX=W/2-cam.x, offY=H*0.24-cam.y;
        let culled=0;
        for (const e of ents){
          if (e.ox1+offX<0||e.ox0+offX>W||e.oy1+offY<0||e.oy0+offY>H) culled++;
          e.ox0=-1e9; e.ox1=1e9; e.oy0=-1e9; e.oy1=1e9;
        }
        /* The entity pass reads the boxes PACKED (scene.bounds), not off the
           records, so widening the records alone would leave this arm culling
           exactly as the first one did and the two would always agree. Disown
           the packed boxes for the arm, which sends the pass back to the records. */
        const wasScene=scene, wasFor=scene.boundsFor;
        scene.boundsFor=null;
        let b;
        try{ b=settle(); }
        finally{ if (wasScene.boundsFor===null) wasScene.boundsFor=wasFor; }
        ents.forEach((e,i)=>{ e.ox0=saved[i][0]; e.ox1=saved[i][1]; e.oy0=saved[i][2]; e.oy1=saved[i][3]; });
        const d=diff(a,b), c=diff(a,ctrl);
        out.push({rot:r, cam:dx+','+dy, culled, kept:ents.length-culled, diff:d.n, worst:d.w, control:c.n});
      }
    }
    const bad=out.filter(o=>o.diff>o.control);
    console.log('verifySceneCull: '+bad.length+' of '+out.length+' cases lost visible pixels');
    return {cases:out.length, failing:bad.length, bad, all:out};
  } finally {
    PSPRITE.off=p0; SSPRITE.off=s0; game.pausedAt=pa0; game.previewMode=pv0;
    game.rot=rot0; game.sceneRev++; groundKey=''; cam.x=cx0; cam.y=cy0;
    render(performance.now());
  }
}
function ssprClippedSprites(){
  const out=[];
  for (const [k,sp] of SSPRITE.map){
    const w=sp.cv.width, h=sp.cv.height;
    let d; try{ d=spritePixels(sp.cv); }catch(_){ continue; }
    if (!d || !w || !h) continue;
    const A=(x,y)=>d[(y*w+x)*4+3];
    let top=0,bot=0,left=0,right=0;
    for (let x=0;x<w;x++){ if (A(x,0)>8) top++; if (A(x,h-1)>8) bot++; }
    for (let y=0;y<h;y++){ if (A(0,y)>8) left++; if (A(w-1,y)>8) right++; }
    if (top+bot+left+right>0) out.push({key:k.slice(0,60), w, h, top, bot, left, right});
  }
  return out;
}
function verifyStructureSprites(opts){
  opts=opts||{};
  if (!cnv || typeof cx.getImageData!=='function'){ console.warn('verifyStructureSprites: needs a live canvas.'); return null; }
  const rots=opts.rot?[0,1,2,3]:[game.rot];
  const wasRot=game.rot, wasOff=SSPRITE.off, wasEnts=scene.ents, wasBudget=SSPRITE.BUDGET;
  /* This TURNS the garden and pins the cache off, so an interrupted run left
     the camera rotated and the structures uncached — the same trap
     drawProfile had, and a louder one. Restore on every path out. */
  try{
  const names={}; for (const k in SCENE_K) names[SCENE_K[k]]=k;
  const out=[];
  const shot=()=>{ const d=cx.getImageData(0,0,cnv.width,cnv.height).data; return d; };
  for (const rot of rots){
    game.rot=rot; game.sceneRev++;
    buildScene(VW/ZOOM,VH/ZOOM);
    const all=scene.ents.slice(), groups={};
    for (const e of all) (groups[e.kind]||(groups[e.kind]=[])).push(e);
    for (const k in groups){
      const kind=names[k]||k;
      if (kind==='PLANT'||kind==='BULB'||kind==='GHOST') continue;
      scene.ents=groups[k];
      SSPRITE.off=true;  render(performance.now()); const a=shot();
      SSPRITE.map.clear(); SSPRITE.bytes=0;      // force a cold bake, not a stale hit
      SSPRITE.off=false;
      // several frames: the per-frame bake budget may not cover them all at once
      for (let i=0;i<8;i++){ scene.ents=groups[k]; render(performance.now()); }
      const b=shot();
      let diff=0, worst=0;
      for (let i=0;i<a.length;i+=4){
        const dr=Math.abs(a[i]-b[i]), dg=Math.abs(a[i+1]-b[i+1]), db=Math.abs(a[i+2]-b[i+2]);
        const m=dr>dg?(dr>db?dr:db):(dg>db?dg:db);
        if (m>8){ diff++; if (m>worst) worst=m; }
      }
      out.push({rot, kind, n:groups[k].length,
        diffPct:+(diff/(a.length/4)*100).toFixed(3), worst});
    }
    scene.ents=all;
  }
  /* Now force a COLD bake of every sprite the garden needs (lifting the
     per-frame budget, which would otherwise leave most of them un-baked) and
     ask each one whether its drawing reached its own border. */
  game.rot=wasRot; SSPRITE.off=false; game.sceneRev++;
  buildScene(VW/ZOOM,VH/ZOOM);
  SSPRITE.map.clear(); SSPRITE.bytes=0;
  const budget=SSPRITE.BUDGET; SSPRITE.BUDGET=1e9;
  for (let i=0;i<6;i++) render(performance.now());
  SSPRITE.BUDGET=budget;
  const clipped=ssprClippedSprites();
  const sprites=SSPRITE.map.size, mb=+(SSPRITE.bytes/1048576).toFixed(2);
  SSPRITE.off=wasOff;
  out.sort((p,q)=>q.diffPct-p.diffPct);
  console.log('verifyStructureSprites — sprite vs procedural, % of canvas pixels differing by >8/255\n'+
    out.map(r=>'  rot'+r.rot+' '+r.kind.padEnd(17)+String(r.diffPct).padStart(7)+'%  worst '+
      String(r.worst).padStart(3)+'  x'+r.n).join('\n')+
    '\n  (small = antialiasing on a fractional blit offset; large = a clipped box or a stale key)\n'+
    '  '+sprites+' distinct sprites for '+out.reduce((a,r)=>a+r.n,0)+' entities, '+mb+'MB\n'+
    (clipped.length
      ? '  CLIPPED: '+clipped.length+' sprite(s) draw to their own border — widen up/pad in structSpriteSpec\n'+
        clipped.slice(0,6).map(c=>'    '+c.key+'  '+c.w+'x'+c.h+'  t'+c.top+' b'+c.bot+' l'+c.left+' r'+c.right).join('\n')
      : '  no sprite draws to its own border — every box contains its drawing'));
  return {rows:out, clipped, sprites, mb};
  } finally {
    game.rot=wasRot; SSPRITE.off=wasOff; SSPRITE.BUDGET=wasBudget;
    scene.ents=wasEnts; game.sceneRev++;
  }
}
// cursor footprint: tint each tile of the brush disc so the stamp/erase area
// reads before commit. Reuses the same brushOffsets the paint/erase paths use,
// so the preview can't disagree with what actually gets placed.
function drawBrushGhost(cx,W,H,cxT,cyT,size,mode){
  const fill = mode==='erase' ? 'rgba(200,84,68,0.16)' : 'rgba(224,206,150,0.15)';
  const stroke = mode==='erase' ? 'rgba(236,120,96,0.62)' : 'rgba(240,224,170,0.58)';
  for (const [dx,dy] of brushOffsets(size)){
    const x=cxT+dx, y=cyT+dy;
    if (!onPlot(x,y)) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,fill,stroke);
  }
}
function screenDeltaForWorld(dx,dy){
  const [v0x,v0y]=worldToView(0,0), [v1x,v1y]=worldToView(dx,dy);
  return [isoX(v1x-v0x,v1y-v0y), isoY(v1x-v0x,v1y-v0y)];
}
function drawTreeShadeSweepGhost(ctx,sh,sx,cy){
  if (!sh || sh.r<=0) return;
  const scale=shadeSeasonScale();
  ctx.save();
  for (const sample of orientedSunPath()){
    const mag=Math.hypot(sample.sun[0],sample.sun[1])||1;
    const sunX=sample.sun[0]/mag, sunY=sample.sun[1]/mag;
    const shadeX=-sunX, shadeY=-sunY;
    const len=sh.r*sample.len*scale*SHADE_AREA_SCALE*(0.65+0.35*sh.est);
    const width=sh.r*sample.width*SHADE_AREA_SCALE;
    const [dx,dy]=screenDeltaForWorld(shadeX*len,shadeY*len);
    const [wx,wy]=screenDeltaForWorld(-shadeY*width,shadeX*width);
    const lpx=Math.hypot(dx,dy), wpx=Math.hypot(wx,wy);
    if (lpx<4 || wpx<3) continue;
    ctx.save();
    ctx.translate(sx+dx*0.52,cy+dy*0.52);
    ctx.rotate(Math.atan2(dy,dx));
    ctx.fillStyle=`rgba(41,65,47,${0.08+sample.weight*0.10})`;
    ctx.beginPath();
    ctx.ellipse(0,0,lpx*0.55,wpx*0.85,0,0,7);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function drawTreePlacementGhost(ctx,W,H,x,y,key,v){
  if (!layerShown('woody')) return false;
  const def=plantDef(key,v);
  if (!isTreeDef(def)) return false;
  const draft=matureWoodyDraft(key,v), sh=treeShadeInfo(`${x},${y}`,draft);
  if (!sh || sh.r<=0) return false;
  const [sx,sy]=screenOf(x,y,W,H), cy=sy+TILE_H/2;
  drawTreeShadeSweepGhost(ctx,sh,sx,cy);
  tileDiamond(ctx,sx,sy,'rgba(46,70,42,0.20)','rgba(246,220,156,0.84)');
  ctx.save();
  ctx.setLineDash([7,5]);
  ctx.lineWidth=1.8;
  ctx.strokeStyle='rgba(246,220,156,0.86)';
  ctx.beginPath();
  ctx.ellipse(sx,cy,(TILE_W/2)*sh.r,(TILE_H/2)*sh.r,0,0,7);
  ctx.stroke();
  ctx.restore();
  return true;
}
function drawMatureCanopyRing(ctx,W,H,x,y,p){
  const P=p && plantDef(p.s,p.v);
  if (!isWoodyDef(P)) return false;
  const r=woodyRadiusTiles(P);
  if (r<=0) return false;
  const [sx,sy]=screenOf(x,y,W,H), cy=sy+TILE_H/2;
  ctx.save();
  ctx.setLineDash([7,5]);
  ctx.lineWidth=1.4;
  ctx.strokeStyle=isTreeDef(P) ? 'rgba(246,220,156,0.74)' : 'rgba(199,221,158,0.70)';
  ctx.beginPath();
  ctx.ellipse(sx,cy,(TILE_W/2)*r,(TILE_H/2)*r,0,0,7);
  ctx.stroke();
  ctx.restore();
  return true;
}
function drawMatureCanopyOverlay(ctx,W,H,x0,x1,y0,y1){
  if (!game.layerVis.matureCanopies || !layerShown('woody')) return 0;
  let n=0;
  for (const k in game.plants){
    const p=game.plants[k];
    if (!p || p.removed) continue;
    const P=plantDef(p.s,p.v);
    if (!isWoodyDef(P)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const reach=Math.ceil(woodyRadiusTiles(P));
    if (x+reach<x0 || x-reach>x1 || y+reach<y0 || y-reach>y1) continue;
    if (drawMatureCanopyRing(ctx,W,H,x,y,p)) n++;
  }
  return n;
}
/* ---------- persistent scene list (perf) ----------
   Between edits nothing on the ground moves: an entity's depth changes only on
   edit / rotation / layer toggle / the game day. The old gather allocated a
   fresh {depth, draw:closure} per visible entity and re-sorted them EVERY
   FRAME — thousands of objects per frame whose only job was to become garbage
   (GC pauses read as stutter even when the average frame looks fine). So the
   scene is built once into plain records, depth-sorted, and a frame only culls
   (numeric compares) and draws. Time-varying looks — growth, sway, bloom — are
   computed at draw time from the live plant refs, so nothing visual goes stale;
   day-granular facts (tree shade reach/stunting — plantEstab is integer-day)
   use absDay() in Today, but only the season in Established, where canopies
   do not grow. In-place edits invalidate via game.sceneRev
   (markModelChanged in setTile/clearTile/addHouse/applySnapshot);
   wholesale map swaps (load / new garden / legacy fixups) are caught by object
   identity in sceneStale. Side fix: stunting is now computed against the FULL
   tree list — the old per-frame pass used the viewport-culled list, so an
   off-screen tree's shade stopped stunting a visible plant. */
const SCENE_K={FENCE:0,LIGHT:1,FIREPIT:2,BOULDER:3,HOUSE:4,BULB:5,PLANT:6,GHOST:7,BUILDING:8,BUILDING_OUTLINE:9,PET:10,POT:11,SEAT:12,WATERF:13,SUPPORT:14,PERGOLA:15,ORNAMENT:16};
let scene={key:null, refs:null, ents:[], shadeTrees:[], futureShadeTrees:[], shrubs:[], lights:[], firepits:[], boulders:[], festoons:[], stunted:new Set()};
const STUNT_GROWTH=0.45;   // a full-sun plant struggling under an active canopy draws at this share of its growth
function sceneLayerBits(){
  return (layerShown('perennials')?1:0)|(layerShown('woody')?2:0)|
    (layerShown('bulbs')?4:0)|(layerShown('landscape')?8:0);
}
// sceneRev, not game.rev: this list holds plants, bulbs, hardscape, houses and
// buildings — no terrain. Keyed on game.rev, every painted path tile rebuilt it
// (O(all plants)) for a layer it does not contain. See LAYER_CACHES in world.js
// for what bumps it, and why elevation still does.
function sceneKey(){
  const when=establishedPreviewActive()?calClock().season:absDay();
  return game.sceneRev+'|'+game.rot+'|N'+effectiveSiteNorthDeg()+'|'+when+'|'+sceneLayerBits()+'|'+GW+'x'+GH+
    '|'+(establishedPreviewActive()?1:0);   // preview flips shade trees + stunting
}
function sceneStale(skey){
  return scene.key!==skey || sceneRefsChanged(scene.refs);
}
function sceneRefs(){
  return {plants:game.plants,bulbs:game.bulbs,fences:game.fences,
    lights:game.lights,firepits:game.firepits,boulders:game.boulders,pets:game.pets,
    pots:game.pots,seats:game.seats,ornaments:game.ornaments,waterFeatures:game.waterFeatures,supports:game.supports,
    pergolas:game.pergolas,houses:game.houses,buildings:game.buildings};
}
function sceneRefsChanged(r){
  return !r ||
    r.plants!==game.plants || r.bulbs!==game.bulbs || r.fences!==game.fences ||
    r.lights!==game.lights || r.firepits!==game.firepits || r.boulders!==game.boulders || r.pets!==game.pets || r.houses!==game.houses || r.buildings!==game.buildings ||
    r.pots!==game.pots || r.seats!==game.seats || r.ornaments!==game.ornaments || r.waterFeatures!==game.waterFeatures || r.supports!==game.supports ||
    r.pergolas!==game.pergolas;
}
/* ---- camera-free screen bounds, for the viewport cull ----
   The entity pass used to reject on the TILE bounding box of the four inverted
   screen corners. Under this projection the preimage of a screen rectangle is a
   DIAMOND, and the bbox of a diamond's corners is far larger than the diamond —
   the same trap the ground bake's margin note records one system over, and the
   same conclusion: ask a containment question in the space the containment
   happens in. Measured, the surplus was 60% of the pass on a 375x812 phone and
   71% on a quarter acre; every one of those entities had its sprite key built,
   its cache looked up and a drawImage issued before the browser clipped it away.

   The camera is a pure screen translation (viewScreen subtracts cam) and W/H
   only shift the origin, so a record's screen box is stable for the life of the
   scene list once both are taken out: bake isoX/isoY of the tile corners here,
   add W/2-cam.x and H*0.24-cam.y at frame time. Elevation is baked too — it
   bumps sceneRev, so a terrace edit rebuilds this. */
/* How far a fire pit's glow reaches past its own footprint, for the night cull.
   drawFirepitGlow paints a radius of at most 180 from the FIRE, which sits
   inside the footprint's own screen box; a cull that under-estimates it snuffs
   out a fire at the edge of the screen. */
const FIREPIT_GLOW_REACH = 200;
function setEntScreenBounds(e){
  const x0=e.bx0!==undefined?e.bx0:e.x, x1=e.bx1!==undefined?e.bx1:e.x;
  const y0=e.by0!==undefined?e.by0:e.y, y1=e.by1!==undefined?e.by1:e.y;
  let ox0=Infinity, ox1=-Infinity, oy0=Infinity, oy1=-Infinity;
  for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
    const [vx,vy]=worldToView(xx,yy);
    const sx=isoX(vx,vy), sy=isoY(vx,vy)-elevationAt(xx,yy)*ELEV_STEP;
    if (sx<ox0) ox0=sx; if (sx>ox1) ox1=sx;
    if (sy<oy0) oy0=sy; if (sy>oy1) oy1=sy;
  }
  /* The tile diamond, PLUS whatever the drawing reaches past it — a sum, not a
     max, exactly as structSpriteBox composes the same numbers for the sprite
     bake. Taking the max instead let two seats out of their boxes and they drew
     visibly from off screen; verifySceneCull found them by bisection. */
  let pad=TILE_W*0.5, up=0, down=TILE_H;
  if (e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB){
    /* Full growth, so the box is a superset of whatever any frame draws, and
       the plant's draw point is TILE_H/2 below this anchor. `slip` covers the
       free-planting sub-tile offset; POT_LIFT_MAX covers standing on a vessel
       and POT_CENTRE_MAX its centring shift off this tile; and SWAY_SKEW is the
       wind, which leans the drawing sideways by up to that fraction of its own
       height (the same 0.05 the blit skews by, and what drawPlant bends its
       stems with). Leaving the wind out is what the last 16-41px of cull error
       turned out to be. The pot terms are charged to every plant rather than
       only to potted ones: they are ~40px against a pad in the hundreds, and a
       box that depends on a second layer is a box that goes stale when that
       layer moves without this one. */
    const b=plantDrawBox(plantDef(e.p.s,e.p.v),e.p.s,1), o=plantOffset(e.p);
    const slip=(Math.abs(o.ox)+Math.abs(o.oy)+1)*TILE_W*0.5;
    const potX=POT_CENTRE_MAX*TILE_W*0.5, potY=POT_CENTRE_MAX*TILE_H*0.5;
    pad+=b.halfW+slip+potX+b.top*SWAY_SKEW+SCENE_CULL_SLACK;
    up+=b.top+slip+POT_LIFT_MAX+potY+SCENE_CULL_SLACK;
    down+=b.bot+slip+potY+SCENE_CULL_SLACK;
  } else {
    const b=structDrawBox(e);
    if (b){ pad+=b.pad; up+=b.up; down+=b.down; }
    else { pad+=TILE_W*2; up+=TILE_H*8; down+=TILE_H*3; }   // no box: keep it generously
  }
  e.ox0=ox0-pad; e.ox1=ox1+pad; e.oy0=oy0-up; e.oy1=oy1+down;
}
/* ...and the point a plant is drawn at, with the camera taken out the same way.
   plantScreenOf was asked for every drawn plant on every frame: is it in a pot,
   its sub-tile offset, the view rotation, the tile's elevation, then the camera.
   Only the last of those can change without rebuilding this list (pots,
   elevation and plants all carry `scene` in LAYER_CACHES; rotation and plot size
   are in sceneKey), so the rest is asked once here and a frame adds
   W/2-cam.x and H*0.24-cam.y, as it does to the cull box above. Measured on a
   1,482-plant garden: about 25ms a second of projection, and two arrays a plant
   a frame. Asked of plantScreenOf itself with the camera and canvas zeroed, so
   it cannot disagree with it; the camera is put back in a finally. */
function setEntDrawPoint(e){
  const cx0=cam.x, cy0=cam.y;
  cam.x=0; cam.y=0;
  try{
    // a structure's sprite is placed from structAnchor, which reads the same things
    const s=(e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB) ? plantScreenOf(e.x,e.y,e.p,0,0) : structAnchor(e,0,0);
    e.px=s[0]; e.py=s[1];
  }
  finally{ cam.x=cx0; cam.y=cy0; }
}
/* The tallest vessel any container stands a plant on, and the furthest one can
   pull that plant sideways off its own origin tile — so a potted plant's box
   covers both without asking which vessel it is in. */
const POT_LIFT_MAX=(typeof POT_SIZES!=='undefined' && POT_SIZES.length)
  ? Math.max(...POT_SIZES.map(s=>Math.ceil(s.hIn/12*PX_PER_FT))) : 90;
const POT_CENTRE_MAX=(typeof POT_SIZES!=='undefined' && POT_SIZES.length)
  ? Math.max(...POT_SIZES.map(s=>(Math.max(1,Math.round(s.wIn/TILE_IN))-1)/2)) : 1;
// the wind's horizontal lean, as a fraction of the drawing's height — the same
// 0.05 drawPlantMaybeCached skews the blit by
const SWAY_SKEW=0.05;
/* Slack on the cull box, and only on the cull box. The sprite bake wants its box
   tight, because that box is memory; this one only has to answer "cannot
   possibly be visible", where being generous costs one entity's bookkeeping and
   being tight costs a plant popping in at the screen edge.
   Sized from measurement rather than taste: across every species in a planted
   garden, drawn at full growth and compared against its real ink, exactly one
   (slender indiangrass) exceeds plantDrawBox at all, by 1.9px. This covers that
   and the antialiased fringe several times over, and it is nothing against the
   ~1700px of bounding-box slop the screen cull replaces. Do not raise it to
   chase the handful of isolated pixels verifySceneCull still reports: those do
   not respond to it, they are rasteriser batching (two draw sequences, ±1-8 of
   255 on scattered single pixels), and a genuinely dropped entity shows up as a
   contiguous blob of hundreds instead. */
const SCENE_CULL_SLACK=24;
/* One plant's record, one bulb's, and what every record is given once the list
   is in order. Shared by the full build and by sceneApplyEdits, which puts a
   single record into a list that already exists: two copies of this would be
   two definitions of where a plant is drawn. */
function scenePlantRec(x,y,p,W,H){
  const pDetail=plantRenderDetail(x,y,p,W,H);
  /* A climber sorts in FRONT of the thing it climbs. A fence record sits at
     viewDepth+0.34 and a plant at +0.30, so a rose on a fence drew BEHIND
     the panel — visible only as a few leaves at its foot. Supports are put
     at +0.30 in their own pass for the same reason.
     And measured against the FRAME'S footprint, not its own tile: a piece
     standing on more than one tile sorts on the far corner of its footprint
     (footprintDrawDepth), so a climber on the NEAR leg of a 2-wide trellis or
     a 3-wide arch came out a whole tile behind the very thing it climbs —
     drawn through the lattice instead of over it. A fence is 1x1, so that
     case is unchanged and this was invisible until the frames arrived. */
  let dep=plantDepth(x,y,p)+0.3;
  if (pDetail&&pDetail.climb){
    const sup=supportAt(x,y);
    dep=(sup?footprintDrawDepth(sup.x,sup.y,sup.w,sup.h):plantDepth(x,y,p))+0.44;
  } else {
    // and the same rule for a container, which is a frame the plant stands IN
    const po=potAt(x,y);
    if (po) dep=potPlantDepth(po)+0.3;
  }
  return {d:dep, kind:SCENE_K.PLANT, bx0:x,bx1:x,by0:y,by1:y,
    x,y,p, seed:tileSeed(x,y), detail:pDetail, stunt:false};
}
function sceneBulbRec(x,y,p){
  const po=potAt(x,y);
  return {d:(po?potPlantDepth(po):plantDepth(x,y,p))+0.25, kind:SCENE_K.BULB,
    bx0:x,bx1:x,by0:y,by1:y,
    x,y,p, seed:(tileSeed(x,y)^0x9e37)>>>0};
}
// full-sun plants under an ACTIVE canopy render stunted
function scenePlantStunted(rec){
  const P2=PLANTS[rec.p.s];
  return !!(P2 && P2.sun!=='part' && !isTreeDef(P2)) && shadeScoreAt(rec.x,rec.y)>=SHADE_ACTIVE_SCORE;
}
function sceneFinishRec(e,season){
  setEntScreenBounds(e);
  setEntDrawPoint(e);
  if (e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB)
    bakePlantKeyParts(e,e.p.s,e.p.v,season,e.seed,e.detail);
}
/* Records of equal depth draw in the order a full build pushed them: plants in
   their map's key order, then bulbs in theirs, then everything else. `q` is that
   order written down, so a record put in later lands where a rebuild would have
   put it. Plants count from 0, bulbs from Q_BULB, the rest from Q_REST. */
const SCENE_Q_BULB=1e9, SCENE_Q_REST=2e9;
// everything sceneKey reads but the revision: what must NOT have moved for an edit to be applied in place
function sceneKeyRest(){
  const when=establishedPreviewActive()?calClock().season:absDay();
  return game.rot+'|N'+effectiveSiteNorthDeg()+'|'+when+'|'+sceneLayerBits()+'|'+GW+'x'+GH+
    '|'+(establishedPreviewActive()?1:0);
}
// a plant whose record depends on nothing but itself: no canopy, no spread, no frame, no joined neighbours
function scenePlantSimple(p){
  const P=p && plantDef(p.s,p.v);
  return !!P && !isWoodyDef(P) && P.type!=='vine' && P.type!=='bulb' && P.form!=='bamboo';
}
// where a record with this depth and order belongs in a sorted list
function sceneInsertAt(ents,d,q){
  let lo=0, hi=ents.length;
  while (lo<hi){ const m=(lo+hi)>>1, e=ents[m]; if (e.d<d || (e.d===d && e.q<=q)) lo=m+1; else hi=m; }
  return lo;
}
function sceneIndexOf(ents,rec){
  let i=sceneInsertAt(ents,rec.d,rec.q)-1;
  if (i>=0 && ents[i]===rec) return i;
  return ents.indexOf(rec);
}
/* The order a key that is NOT new to its map sorts at: halfway between the
   records of the keys either side of it. Reached only when a tile is planted
   again after being cleared (the tombstone keeps the key's place), so the walk
   over the map's keys is rare; a new key simply goes last. */
function sceneOrderFor(layer,key,index,next){
  let prev=null, seen=false, after=null;
  for (const k in game[layer]){
    if (k===key){ seen=true; continue; }
    const r=index.get(k); if (!r) continue;
    if (!seen) prev=r.q; else { after=r.q; break; }
  }
  if (after===null) return next;
  return prev===null ? after-1 : (prev+after)/2;
}
/* Put the planted tiles that changed into the scene list, in place of a rebuild.
   True when it did; false means the caller builds in full, which is always
   right. Refused unless every change since the list was built is a located
   plant or bulb edit (SCENE_EDITS, world.js), nothing else the key reads has
   moved, and neither the old plant on a tile nor the new one is a tree, a shrub,
   a climber or a bamboo: those change the shade map, the shrub list, a frame's
   climber or a joined neighbour, none of which one record can answer for.
   A new scene OBJECT is published, with a new list: what keys on the scene's
   identity (the night map, the fireflies) sees a change exactly as it did, and
   anything holding the old list keeps a list that is still whole. The records
   themselves are kept, so 4,700 clumps do not have their keys built again
   because one more was planted. tests/game.test.js compares the result with a
   full build after hundreds of random edits. */
function sceneApplyEdits(W,H){
  const E=SCENE_EDITS, sc=scene;
  if (!sc.index || sc.rev===undefined || !E.n) return false;
  if (E.base!==sc.rev || E.base+E.n!==game.sceneRev || E.list.length!==E.n) return false;
  if (sceneRefsChanged(sc.refs) || sceneKeyRest()!==sc.rest) return false;
  for (const ed of E.list){
    if (ed.layer==='plants'){
      const old=sc.index.plants.get(ed.key), cur=game.plants[ed.key];
      if (old && !scenePlantSimple(old.p)) return false;
      if (cur && !cur.removed && !scenePlantSimple(cur)) return false;
    }
  }
  let ents=sc.ents.slice(), bounds=sc.bounds;
  const season=calClock().season, stunted=sc.stunted;
  const cut=i=>{
    ents.splice(i,1);
    const nb=new Float64Array(ents.length*4);
    nb.set(bounds.subarray(0,i*4)); nb.set(bounds.subarray(i*4+4),i*4);
    bounds=nb;
  };
  const put=rec=>{
    const i=sceneInsertAt(ents,rec.d,rec.q);
    ents.splice(i,0,rec);
    const nb=new Float64Array(ents.length*4);
    nb.set(bounds.subarray(0,i*4)); nb.set(bounds.subarray(i*4),i*4+4);
    nb[i*4]=rec.ox0; nb[i*4+1]=rec.ox1; nb[i*4+2]=rec.oy0; nb[i*4+3]=rec.oy1;
    bounds=nb;
  };
  for (const ed of E.list){
    const plants=ed.layer==='plants', index=plants?sc.index.plants:sc.index.bulbs, k=ed.key;
    const old=index.get(k), p=game[ed.layer][k];
    let q=old?old.q:null;
    if (old){
      const i=sceneIndexOf(ents,old);
      if (i<0) return false;
      cut(i); index.delete(k);
      if (plants) stunted.delete(old.y*GW+old.x);
    }
    if (!p || p.removed) continue;
    if (plants ? !layerShown(plantLayerOf(p)) : !layerShown('bulbs')) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const rec=plants ? scenePlantRec(x,y,p,W,H) : sceneBulbRec(x,y,p);
    if (q===null) q=ed.fresh ? (plants?sc.qP++:sc.qB++) : sceneOrderFor(ed.layer,k,index,plants?sc.qP++:sc.qB++);
    rec.q=q;
    if (plants){ rec.stunt=scenePlantStunted(rec); if (rec.stunt) stunted.add(y*GW+x); }
    sceneFinishRec(rec,season);
    put(rec); index.set(k,rec);
  }
  scene=Object.assign({},sc,{key:sceneKey(), rev:game.sceneRev, ents, bounds, boundsFor:ents});
  resetSceneEdits();
  return true;
}
function buildScene(W,H){
  ensureShadeMap(); // preserve the synchronous shade event timer; the steps then reuse it
  const steps=sceneBuildSteps(W,H);
  let step;
  do { step=steps.next(); } while (!step.done);
}
// One builder for ordinary draws and prepared skips. Yield between bounded
// groups of records, and within the shade calculation, before publishing scene.
function* sceneBuildSteps(W,H){
  const ents=[], shadeTrees=[], futureShadeTrees=[], shrubs=[], lights=[], firepits=[], boulders=[], festoons=[];
  const plantRecs=[], pIndex=new Map(), bIndex=new Map();
  let count=0, qP=0, qB=SCENE_Q_BULB, qR=SCENE_Q_REST;
  for (const k in game.plants){ const p=game.plants[k];
    if (++count%32===0) yield;
    if (p.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (layerShown('woody')){
      const shrub=shrubInfoFromKey(k);
      if (shrub){
        const rTiles=woodyRadiusTiles(plantDef(p.s,p.v));
        shrub.cullR=Math.ceil(rTiles)+1;
        /* Camera-free screen bounds of the footprint ELLIPSE, for the same
           reason the entity pass has them: the tile bbox is the bounding box of
           a diamond, and this loop was drawing a large translucent ellipse for
           every shrub that survived it. Measured on a quarter acre, 45 passed
           and 12 were on screen — 73% of the pass was overdraw nobody saw. */
        const [vx,vy]=worldToView(shrub.x,shrub.y);
        const ax=isoX(vx,vy), ay=isoY(vx,vy)-elevationAt(shrub.x,shrub.y)*ELEV_STEP+TILE_H/2;
        const rx=(TILE_W/2)*rTiles*1.06+4, ry=(TILE_H/2)*rTiles*1.06+4;
        shrub.ox0=ax-rx; shrub.ox1=ax+rx; shrub.oy0=ay-ry; shrub.oy1=ay+ry;
        shrubs.push(shrub);
      }
    }
    const sh=treeShadeInfo(k,p);
    if (sh && sh.r>=1){ sh.reach=treeShadeReach(sh); (sh.activePotential?shadeTrees:futureShadeTrees).push(sh); }
    if (!layerShown(plantLayerOf(p))) continue;
    const rec=scenePlantRec(x,y,p,W,H);
    rec.q=qP++;
    plantRecs.push(rec); ents.push(rec); pIndex.set(k,rec);
  }
  // full-sun plants under an ACTIVE canopy render stunted; canopy-granular, so
  // it lives here (against ALL trees, not just the on-screen ones)
  yield* shadeMapSteps();
  const stunted=new Set();   // by tile, for a selection ghost to draw at the same growth
  for (const rec of plantRecs){
    if (++count%64===0) yield;
    rec.stunt=scenePlantStunted(rec);
    if (rec.stunt) stunted.add(rec.y*GW+rec.x);
  }
  if (layerShown('bulbs')) for (const k in game.bulbs){ const p=game.bulbs[k];
    if (++count%64===0) yield;
    if (p.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const rec=sceneBulbRec(x,y,p);
    rec.q=qB++;
    ents.push(rec); bIndex.set(k,rec);
  }
  const restFrom=ents.length;
  if (layerShown('landscape')){
    for (const k in game.fences){ const f=game.fences[k];
      if (++count%64===0) yield;
      if (f.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      ents.push({d:viewDepth(x,y)+0.34, kind:SCENE_K.FENCE, bx0:x,bx1:x,by0:y,by1:y, x,y,f});
    }
    for (const k in game.lights){ const l=game.lights[k];
      if (++count%64===0) yield;
      if (!l || l.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      const rec={d:viewDepth(x,y)+0.36, kind:SCENE_K.LIGHT, bx0:x,bx1:x,by0:y,by1:y, x,y,l};
      ents.push(rec); lights.push(rec);
    }
    for (const k in game.firepits){ const f=game.firepits[k];
      if (++count%64===0) yield;
      if (!f || f.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=firepitTileSize(f);
      const rec={d:footprintDrawDepth(x,y,sz.w,sz.h)+0.37, kind:SCENE_K.FIREPIT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,f};
      ents.push(rec); firepits.push(rec);
    }
    /* A support sorts just BEHIND its own climber's depth, so the plant draws
       in front of the frame it is growing on rather than through it. */
    for (const k in game.supports||{}){ const sp=game.supports[k];
      if (++count%64===0) yield;
      if (!sp || sp.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=supportTileSize(sp);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.30, kind:SCENE_K.SUPPORT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,sp});
    }
    /* A pergola sorts just BEHIND a climber's depth, for the same reason a
       support does: the plant grows in FRONT of the frame it is on. */
    for (const k in game.pergolas||{}){ const pg=game.pergolas[k];
      if (++count%64===0) yield;
      if (!pg || pg.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      const rec={d:viewDepth(x,y)+0.28, kind:SCENE_K.PERGOLA, bx0:x,bx1:x,by0:y,by1:y, x,y,pg};
      ents.push(rec);
      // a bay of a lit roof: the night pass lights the ground under it and its bulbs
      if (pergolaLitAt(x,y)){ rec.fest=festoonRunAt(x,y); festoons.push(rec); }
    }
    for (const k in game.waterFeatures||{}){ const wf=game.waterFeatures[k];
      if (++count%64===0) yield;
      if (!wf || wf.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=waterFeatureTileSize(wf);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.375, kind:SCENE_K.WATERF,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,wf});
    }
    for (const k in game.boulders){ const b=game.boulders[k];
      if (++count%64===0) yield;
      if (!b || b.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=boulderTileSize(b);
      const rec={d:footprintDrawDepth(x,y,sz.w,sz.h)+0.38, kind:SCENE_K.BOULDER,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,b};
      ents.push(rec); boulders.push(rec);
    }
    for (const k in game.pets){ const p=game.pets[k];
      if (++count%64===0) yield;
      if (!p || p.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      ents.push({d:viewDepth(x,y)+0.42, kind:SCENE_K.PET, bx0:x,bx1:x,by0:y,by1:y, x,y,p});
    }
    /* The vessel sorts BEHIND the planting standing in it, so the foliage draws
       over its own rim. It used to say so and sit at the plant's own +0.30 —
       equal depths, and a stable sort gives the tie to whichever pass pushed
       last, which is this one. So the pot painted over the plant: measured by
       ablation on a 24 in pot, the plant added ZERO pixels to the frame.
       0.24 clears the bulb layer at +0.25 as well, and nothing else can share a
       pot's tile — canPlacePot refuses every other placeable. */
    for (const k in game.pots||{}){ const p=game.pots[k];
      if (++count%64===0) yield;
      if (!p || p.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=potTileSize(p);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.24, kind:SCENE_K.POT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,p});
    }
    for (const k in game.seats||{}){ const s2=game.seats[k];
      if (++count%64===0) yield;
      if (!s2 || s2.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=seatTileSize(s2);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.39, kind:SCENE_K.SEAT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,s:s2});
    }
    for (const k in game.ornaments||{}){ const o=game.ornaments[k];
      if (++count%64===0) yield;
      if (!o || o.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=ornamentTileSize(o);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.385, kind:SCENE_K.ORNAMENT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,o});
    }
    for (const b of game.buildings||[]){
      if (++count%64===0) yield;
      const r=buildingBounds(b); if (!r) continue;
      for (const p of buildingTiles(b)){
        if (++count%64===0) yield;
        ents.push({d:viewDepth(p[0],p[1])+0.345,kind:SCENE_K.BUILDING,
          bx0:p[0],bx1:p[0],by0:p[1],by1:p[1],b,x:p[0],y:p[1]});
      }
      ents.push({d:buildingDrawDepth(b),kind:SCENE_K.BUILDING_OUTLINE,
        bx0:r.x0,bx1:r.x1,by0:r.y0,by1:r.y1,b});
    }
    for (const hh of game.houses){
      if (++count%64===0) yield;
      ents.push({d:houseDrawDepth(hh), kind:SCENE_K.HOUSE,
        bx0:hh.x,bx1:hh.x+hh.w-1,by0:hh.y,by1:hh.y+hh.h-1, h:hh});
    }
  }
  // each uplight learns which tree or shrub it lights (uplightAim)
  if (lights.length && plantRecs.length) uplightAims(lights,plantRecs);
  yield;
  for (let i=restFrom;i<ents.length;i++) ents[i].q=qR++;   // everything pushed after the bulbs, in push order
  ents.sort((a,b)=>a.d-b.d);
  yield;
  const season=calClock().season;      // sceneKey always distinguishes seasons
  /* The cull boxes again, side by side: [ox0,ox1,oy0,oy1] for ents[i] at i*4.
     The frame tests every record in the garden against the screen, and read off
     the records that was a cache miss apiece (each is its own object, wherever
     the heap put it): 19ms a second for 2,100 records at 164Hz, more than the
     four compares could cost. Float64, so the test is the same test. */
  const bounds=new Float64Array(ents.length*4);
  for (let i=0;i<ents.length;i++){
    const e=ents[i];
    if (++count%32===0) yield;
    sceneFinishRec(e,season);
    bounds[i*4]=e.ox0; bounds[i*4+1]=e.ox1; bounds[i*4+2]=e.oy0; bounds[i*4+3]=e.oy1;
  }
  /* rev, rest, index and the two order counters are what sceneApplyEdits needs
     to put one more record into this list later. qP and qB go on from the last
     order handed out here, so a key new to its map sorts after all of these. */
  scene={key:sceneKey(), refs:sceneRefs(), rev:game.sceneRev, rest:sceneKeyRest(),
    index:{plants:pIndex, bulbs:bIndex}, qP, qB,
    ents, bounds, boundsFor:ents, shadeTrees, futureShadeTrees, shrubs, lights, firepits, boulders, festoons, stunted};
  resetSceneEdits();
}
/* An UPLIGHT is aimed at something, and in a garden that something is a tree or
   a shrub: the one it stands under, or failing that the nearest it could be
   lighting. A tree counts while the light is inside most of its crown's reach
   (woodyRadiusTiles, the real spread), a shrub within its spread and a little;
   of those, the nearest relative to its reach wins and a tree beats a shrub at
   the same reach. The answer is the plant's SCENE RECORD, so the night pass
   reads its draw point and its growth exactly as the plant pass does, and it
   is rebuilt with the scene, which every plant and light edit already does. */
const UPLIGHT_SEARCH=4;
function uplightAim(x,y,woody){
  let best=null, bestS=Infinity;
  for (let dy=-UPLIGHT_SEARCH;dy<=UPLIGHT_SEARCH;dy++) for (let dx=-UPLIGHT_SEARCH;dx<=UPLIGHT_SEARCH;dx++){
    const r=woody.get((y+dy)*GW+(x+dx)); if (!r || r.y!==y+dy || r.x!==x+dx) continue;
    const P=plantDef(r.p.s,r.p.v), tree=isTreeDef(P), d=Math.hypot(dx,dy);
    const reach=tree ? Math.max(1.6,woodyRadiusTiles(P)*0.8) : Math.max(1.3,woodyRadiusTiles(P)+0.6);
    if (d>reach) continue;
    const sc=(d/reach)*(tree?0.8:1);
    if (sc<bestS){ bestS=sc; best=r; }
  }
  return best;
}
function uplightAims(lights,plantRecs){
  const woody=new Map();
  for (const r of plantRecs) if (isWoodyDef(plantDef(r.p.s,r.p.v))) woody.set(r.y*GW+r.x,r);
  for (const rec of lights){
    if (lightType(rec.l&&rec.l.type).glow!=='up') continue;
    rec.aim=woody.size ? uplightAim(rec.x,rec.y,woody) : null;
  }
}
/* How big a record's plant is drawn. Under the Established preview that is 1.
   Under Today it is plantGrowth, establishment times the seasonal envelope,
   which reads the clock four times and walks the calendar: asked for every
   plant on every frame (38ms a second on a 1,482-plant garden), for an answer
   that cannot change until the garden's clock moves, which in a paused planner
   is never. So it is kept on the record with the instant it was worked out at
   (gardenClockStamp: NaN while the clock runs on wall time, so a running clock
   is still asked every frame, and fast-forward and a Skip move the instant). A
   record holds one plant for its life, and a plant record is never edited in
   place. The look-ahead bakes borrow the clock and ask plantGrowth themselves. */
function sceneEntGrowth(e){
  if (establishedPreviewActive()) return 1;
  const at=gardenClockStamp();
  if (e._gAt===at) return e._g;
  e._gAt=at;
  return (e._g=plantGrowth(e.p));
}
// draw one record; returns 1 when it drew a plant/bulb (the sprite-cache count)
function drawSceneEnt(e,W,H,season,sway,useSprites,ctx=cx,cacheStructures=ctx===cx){
  switch(e.kind){
    /* Every structure goes through one cached blitter. They are pure
       functions of (record, season, rot, camera) — no `t`, no `sway` — so
       they are as cacheable as the ground, and this is where they stopped
       being redrawn from scratch on every frame. */
    case SCENE_K.FENCE:
    case SCENE_K.LIGHT:
    case SCENE_K.FIREPIT:
    case SCENE_K.WATERF:
    case SCENE_K.SUPPORT:
    case SCENE_K.PERGOLA:   // missing here until 0.9.62, so no pergola ever drew
    case SCENE_K.BOULDER:
    case SCENE_K.PET:
    case SCENE_K.POT:
    case SCENE_K.SEAT:
    case SCENE_K.ORNAMENT:
    case SCENE_K.BUILDING:
    case SCENE_K.BUILDING_OUTLINE:
    case SCENE_K.HOUSE:
      // Offscreen portraits draw once, without populating or resizing the
      // live viewport's sprite caches (or charging its performance governor).
      if (!cacheStructures){ drawStructEnt(ctx,e,W,H,season,game.layerVis.night); return 0; }
      if (structSampling){
        const t0=performance.now();
        drawStructMaybeCached(e,W,H,season,game.layerVis.night,ctx);
        structSampleMs+=performance.now()-t0;
      } else drawStructMaybeCached(e,W,H,season,game.layerVis.night,ctx);
      if (AHEAD.season && SSPRITE.active && !SSPRITE.off && ctx===cx) aheadBakeStruct(e,W,H,game.layerVis.night);
      return 0;
    case SCENE_K.BULB:{
      // ahead of the underground test: a bulb that comes UP at the turn has no
      // picture of its own to stand in, so it is the one most worth baking early
      if (AHEAD.season && useSprites && ctx===cx) aheadBakePlant(e);
      const g=sceneEntGrowth(e); if (g<=0.02) return 0;   // underground
      // the baked draw point plus this frame's camera (setEntDrawPoint); a record
      // from anywhere but buildScene is asked the long way
      let sx, sy;
      if (e.px!==undefined){ sx=e.px+W/2-cam.x; sy=e.py+H*0.24-cam.y; }
      else { const s=plantScreenOf(e.x,e.y,e.p,W,H); sx=s[0]; sy=s[1]; }
      drawPlantMaybeCached(ctx,sx,sy+TILE_H/2,e.p.s,g,season,e.seed,sway,e.p.v,undefined,useSprites,e);
      return 1;
    }
    case SCENE_K.PLANT:{
      let g=sceneEntGrowth(e); if (e.stunt) g*=STUNT_GROWTH;      // struggling under canopy
      let sx, sy;
      if (e.px!==undefined){ sx=e.px+W/2-cam.x; sy=e.py+H*0.24-cam.y; }
      else { const s=plantScreenOf(e.x,e.y,e.p,W,H); sx=s[0]; sy=s[1]; }
      drawPlantMaybeCached(ctx,sx,sy+TILE_H/2,e.p.s,g,season,e.seed,sway,e.p.v,e.detail,useSprites,e);
      if (AHEAD.season && useSprites && ctx===cx) aheadBakePlant(e);
      return 1;
    }
    case SCENE_K.GHOST:
      ctx.globalAlpha=0.55; drawHouse(ctx,W,H,season,e.h); ctx.globalAlpha=1; return 0;
  }
  return 0;
}
/* ---------- automatic garden covers ----------
   A single offscreen composition on Save & quit, never in render/autosave.
   Use the real ground and depth-sorted entity painters, with a fixed angle,
   Established plants and daylight in the garden's own season. The live canvas,
   zoom, sprite caches, cursor, overlays and season transition are not involved.
   Projection still reads cam/rot, so this whole operation is synchronous and
   restores its temporary view even when a painter or image encoder throws. */
const GARDEN_PORTRAIT_WIDTH=420, GARDEN_PORTRAIT_HEIGHT=315;
function gardenPortraitBounds(){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const include=(l,t,r,b)=>{ x0=Math.min(x0,l); y0=Math.min(y0,t); x1=Math.max(x1,r); y1=Math.max(y1,b); };
  // Walk the actual lot, including raised edges; a skewed lot need not use
  // every corner of the rectangular grid that contains it.
  for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
    if (!onPlot(x,y)) continue;
    const [sx,sy]=screenOf(x,y,0,0);
    include(sx-TILE_W/2,sy,sx+TILE_W/2,sy+TILE_H+Math.max(0,elevationAt(x,y))*ELEV_STEP);
  }
  for (const e of scene.ents){
    if (e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB){
      const growth=displayPlantGrowth(e.p)*(e.stunt?STUNT_GROWTH:1);
      if (growth<=0.02) continue;
      const b=plantDrawBox(plantDef(e.p.s,e.p.v),e.p.s,growth);
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,0,0), base=sy+TILE_H/2;
      include(sx-b.halfW,base-b.top,sx+b.halfW,base+b.bot);
    } else include(e.ox0,e.oy0,e.ox1,e.oy1);
  }
  return {x0,y0,x1,y1};
}
/* The portrait is drawn in SOFTWARE (willReadFrequently), and so is everything
   composited into it: the season wash is painted directly (drawSeasonSky's and
   applySeasonLighting's `direct`) rather than blitted from the shared baked
   surfaces, which are accelerated canvases. That is what makes the picture a
   function of the garden. Chrome's accelerated canvas is not bit-exact from one
   draw to the next — how it rasterises depends on what the GPU process was just
   doing — so the same garden, drawn twice in one synchronous task with identical
   canvas calls, could come out a few pixels different. Measured: the first cover
   after reopening a saved garden (whose opening bake was still running) differed
   from the next ones by the same 17 isolated pixels, up to 17/255, spread over
   eleven species, in ~30% of browser-check runs; everything JavaScript produced
   — the entity list, every drawPlant argument, the whole command stream — was
   identical. Entities alone on a software canvas: 0 of 16 differ (3 of 16 on an
   accelerated one); the whole portrait with the wash in software too: 0 of 20.
   A software canvas is also simply the right one here: it is drawn once and read
   back at once (JPEG cover, share card). Cost measured the same either way. */
function renderGardenPortrait(width=GARDEN_PORTRAIT_WIDTH,height=GARDEN_PORTRAIT_HEIGHT,atDay=null){
  const cv=document.createElement('canvas');
  cv.width=width; cv.height=height;
  const ctx=cv.getContext('2d',{willReadFrequently:true}); if (!ctx) return null;
  const t0=dnow(), prior={x:cam.x,y:cam.y,rot:game.rot,preview:game.previewMode,
    vis:game.layerVis,north:game.siteNorthPreviewDeg,scene,elapsed:game.elapsedMs,suspended:game.clockSuspended,dayOffset:game.dayOffset};
  try{
    // Freeze just this composition even if called with the garden clock live.
    game.elapsedMs=elapsedGameMs(); game.clockSuspended=true;
    // Sharing can show another season without advancing the saved garden.
    if(Number.isSafeInteger(atDay)&&atDay>=0){game.elapsedMs=atDay*DAY_MS;game.dayOffset=0;}
    game.rot=0; game.previewMode='established'; game.layerVis=defaultLayerVis(); game.siteNorthPreviewDeg=null;
    cam.x=0; cam.y=0;
    buildScene(0,0);
    const b=gardenPortraitBounds(), pad=Math.min(width,height)*18/GARDEN_PORTRAIT_HEIGHT;
    const scale=Math.min((cv.width-2*pad)/Math.max(1,b.x1-b.x0),(cv.height-2*pad)/Math.max(1,b.y1-b.y0));
    const W=cv.width/scale, H=cv.height/scale;
    cam.x=(b.x0+b.x1)/2; cam.y=(b.y0+b.y1)/2-H*0.26;
    const season=calClock().season, amb=AMBIENCE[season];
    ctx.setTransform(scale,0,0,scale,0,0);
    drawSeasonSky(ctx,W,H,season,amb,true);
    paintGround(ctx,0,GW-1,0,GH-1,W,H,amb,0);
    const shadeMap=ensureShadeMap();
    if (shadeMap.hasShade) for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
      if (!onPlot(x,y)) continue;
      const a=shadeMap.activeAlpha[y*GW+x]; if (a<=0) continue;
      const [sx,sy]=screenOf(x,y,W,H);
      tileDiamond(ctx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
    }
    for (const e of scene.ents) drawSceneEnt(e,W,H,season,0,false,ctx);
    applySeasonLighting(ctx,W,H,amb,season,true);
    return cv;
  } finally {
    cam.x=prior.x; cam.y=prior.y; game.rot=prior.rot; game.previewMode=prior.preview;
    game.layerVis=prior.vis; game.siteNorthPreviewDeg=prior.north; scene=prior.scene;
    game.elapsedMs=prior.elapsed; game.clockSuspended=prior.suspended;game.dayOffset=prior.dayOffset;
    dev('portrait',t0);
  }
}
/* ---------- season crossfade ----------
   Seasons used to flip abruptly (sky, ground, every plant) on the frame the
   day counter crossed the boundary — jarring mid-fast-forward and after the
   menu's Skip. Blending colors per frame would defeat the season-keyed ground
   bake and sprite caches, so instead the LAST frame of the old season is
   snapshotted once and faded out over the new season's live frames: one
   drawImage per frame for ~1.1s, no cache touched. Explicit season skips
   suppress that blend so the new palette is immediately accurate to compare. */
const SEASON_FADE_MS=1100;
const seasonFade={cv:null, t0:0, active:false, last:null, suppressOnce:false};
/* Reads the app's own motion preference, not the media query directly: the
   season crossfade is the one animation here that carries information, so
   Settings can keep it while the OS switch is on (and drop it while the OS
   switch is off). reducedMotion() folds both in. */
function seasonFadeActive(){ return seasonFade.active; }
/* The snapshot is a whole-screen canvas, made at each turn and finished with a
   second later. It is emptied when done, not just dropped: a held fast-forward
   turns a season every eight seconds, and in WebKit each dropped snapshot kept
   its pixels (12MB on a large tablet) until a collection that canvas memory
   does not hurry. */
function dropSeasonFadeCanvas(){
  const cv=seasonFade.cv;
  if (cv){ try{ cv.width=0; cv.height=0; }catch(_){ } }
  seasonFade.cv=null;
}
function resetSeasonFade(){ seasonFade.active=false; dropSeasonFadeCanvas(); seasonFade.last=null; seasonFade.suppressOnce=false; }
function suppressNextSeasonFade(){ seasonFade.active=false; dropSeasonFadeCanvas(); seasonFade.suppressOnce=true; }
function maybeStartSeasonFade(t,season){
  /* Counted on the season CHANGE, not on the crossfade — reduced-motion skips
     the fade but still saw the year turn, and that is the differentiator the
     funnel is asking about. */
  if (seasonFade.last && seasonFade.last!==season) funnel(FUNNEL_EVENTS.seasonTurned);
  /* The tour's season step, for the reason directly above: the CHANGE is the
     thing, not the crossfade that renders it. It used to fire the instant the
     hold threshold passed, so the callout vanished at 360ms — before anything
     on screen had moved. Fast-forward, Skip and the natural clock all arrive
     here, so every route out of that step counts. */
  if (seasonFade.last && seasonFade.last!==season) tourNote('season');
  if (seasonFade.last && seasonFade.last!==season && !seasonFade.suppressOnce && !game.photo &&
      !reducedMotion()){
    if (!seasonFade.cv) seasonFade.cv=document.createElement('canvas');
    if (seasonFade.cv.width!==cnv.width || seasonFade.cv.height!==cnv.height){
      seasonFade.cv.width=cnv.width; seasonFade.cv.height=cnv.height; }
    const fcx=seasonFade.cv.getContext('2d');
    // no context means the browser is out of canvas memory: turn without the fade
    if (fcx){
      fcx.clearRect(0,0,seasonFade.cv.width,seasonFade.cv.height);
      fcx.drawImage(cnv,0,0);                     // canvas still shows the OLD season here
      seasonFade.t0=t; seasonFade.active=true;
    } else dropSeasonFadeCanvas();
  }
  seasonFade.suppressOnce=false;
  seasonFade.last=season;
}
function drawSeasonFade(t){
  if (!seasonFade.active) return;
  const f=(t-seasonFade.t0)/SEASON_FADE_MS;
  if (f>=1 || !seasonFade.cv || seasonFade.cv.width!==cnv.width || seasonFade.cv.height!==cnv.height){
    seasonFade.active=false; dropSeasonFadeCanvas(); return;   // done, or resized mid-fade
  }
  cx.save(); cx.setTransform(1,0,0,1,0,0);
  cx.globalAlpha=Math.pow(1-f,1.4);              // ease-out: old season lingers then lets go
  cx.drawImage(seasonFade.cv,0,0);
  cx.restore();
}
/* Opening has no old picture to stand in for a cold cache. Prepare the actual
   visible clumps before revealing the canvas instead of showing changing
   siblings. Keep the normal painters/keys, cull, and measured sprite governor:
   one procedural measurement is spread across frames, then only a heavy
   planting gets sprites. Ground uses the existing banded bake. */
let gardenOpening=null;
/* Preparation runs behind the "Opening garden…" cover, a still plate: nothing on
   screen moves, so a frame there may do far more than a live frame's 4ms and 24
   clumps, and waiting out sixty frames at that pace was most of an opening.
   DECIDE stops the measuring pass once its answer cannot change: the governor
   engages when more than FLOOR plants cost more than HI_MS, both sums only grow,
   so past DECIDE times the threshold the rest of the measurement only redraws
   every plant once more to arrive where it already is (and the excess is a fair
   sample for the per-plant cost the governor keeps). Measured on the demo garden
   (323 plants), from the click to the reveal: 500ms to 300ms at 1440x925, and
   1.95s to 0.87s at a phone viewport with the CPU slowed four times, the same
   sprite decision every time. */
/* BAKE_MS and BAKE_CAP are the sprite pass's own batch: it is all baking, and a
   bake's raster lands in the GPU process after the script that asked for it, so
   a longer batch is fewer vsyncs waited out for the same work. BAKE_CAP stays
   under PSPRITE.BUDGET, past which a frame refuses to bake at all. */
const OPEN_PREP={MS:12, CAP:96, GROUND_COLS:12, DECIDE:2, BAKE_MS:20, BAKE_CAP:144};
function beginGardenOpen(){
  gardenOpening={ready:false, key:null};
  document.body.classList.add('garden-opening-active');
  document.getElementById('gardenOpening').classList.remove('hidden');
  document.getElementById('hud').inert=true;
}
function captureGardenPortrait(){
  const cv=renderGardenPortrait();
  return cv?{v:1,day:absDay(),image:cv.toDataURL('image/jpeg',0.86)}:null;
}
function finishGardenOpen(){
  if (gardenOpening && gardenOpening.cv) gardenOpening.cv.width=gardenOpening.cv.height=0;
  gardenOpening=null;
  document.body.classList.remove('garden-opening-active');
  document.getElementById('gardenOpening').classList.add('hidden');
  document.getElementById('hud').inert=false;
}
function prepareGardenOpen(t){
  const o=gardenOpening;
  if (!o.ready) return false; // enterGarden's synchronous layout is still running
  const W=VW/ZOOM, H=VH/ZOOM, season=calClock().season;
  const skey=sceneKey(), MD=Math.round(GROUND_MARGIN_CSS*DPR);
  const key=skey+'|'+groundDataKey()+'|'+groundStructKey(season,game.rot)
    +'|'+ZOOM+'|'+cam.x+'|'+cam.y;
  if (o.key!==key || sceneStale(skey)){
    if (sceneStale(skey)) buildScene(W,H);
    const ox=W/2-cam.x, oy=H*0.24-cam.y;
    o.ents=scene.ents.filter(e=>!(e.ox1+ox<0 || e.ox0+ox>W || e.oy1+oy<0 || e.oy0+oy>H));
    o.key=key; o.phase='ground'; o.index=0; o.plants=0; o.plantMs=0;
    // Age once for the whole preparation. Otherwise a working set over MEM
    // evicts its first batches before the last batches have been prepared.
    pspriteFrame(); ssprFrame();
    groundJob=null;
  }
  if (o.phase==='ground'){
    const gkey=groundStructKey(season,game.rot)+'|'+groundDataKey();
    if (groundKey!==gkey || groundRefsChanged() || groundZoom!==ZOOM
        || groundCamX!==cam.x || groundCamY!==cam.y || groundMarginStale){
      ensureGroundJob('open',season,game.rot,cam.x,cam.y,MD);
      stepGroundJob(t,OPEN_PREP.GROUND_COLS);
      if (groundJobDone()){ adoptGroundJob(t); o.phase='measure'; }
      return false;
    }
    o.phase='measure';
  }
  noteSpriteZoom(t);
  // This is a settled view, not a zoom gesture. A reused garden may have old
  // sprites at another scale; prepare the final scale before revealing it.
  spriteZoomSettled=true;
  PSPRITE.rendered=0; PSPRITE.bakeMs=0; PSPRITE.scale=pspriteScale();
  SSPRITE.rendered=0;
  aheadFrame(t,null); structSampling=false;
  // Partial procedural draws and first sprite blits must stay off the live
  // canvas. Preparing them there leaves Firefox's later frames persistently
  // slow, even after the normal opaque sky repaint: frames made mostly of
  // first uploads are "failed" frames to Firefox, and enough of them early in
  // a canvas's life demote it for good (see spriteBitmapsSupported). A
  // disposable surface keeps preparation separate; the live canvas first
  // receives a full frame.
  if (!o.cv){ o.cv=document.createElement('canvas'); o.ctx=o.cv.getContext('2d'); }
  if (o.cv.width!==cnv.width) o.cv.width=cnv.width;
  if (o.cv.height!==cnv.height) o.cv.height=cnv.height;
  o.ctx.setTransform(1,0,0,1,0,0);
  o.ctx.clearRect(0,0,o.cv.width,o.cv.height);
  o.ctx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  const start=performance.now();
  let count=0;
  /* The sprite pass bakes EVERY visible clump's own picture, which is the whole
     reason for the cover. From 0.9.121 to 0.9.170 it did not: the batch grew to
     12ms and 96 clumps while a frame's bake allowance stayed 4ms, so past the
     first few bakes of a batch each clump was "prepared" by blitting a sibling's
     sprite into the scratch canvas and moving on. Measured at the reveal on a
     353-plant garden, 228 of the 293 clumps on screen had no sprite of their
     own; they were shown as siblings and changed to themselves a few a frame
     over the next third of a second, or several seconds on a large garden at
     the idle cadence. `cold` lifts the allowance and refuses stand-ins. */
  const sprites=o.phase==='sprites', ms=sprites?OPEN_PREP.BAKE_MS:OPEN_PREP.MS, cap=sprites?OPEN_PREP.BAKE_CAP:OPEN_PREP.CAP;
  // the last batch's bakes go into the atlas now, so the reveal draws from pages, not thousands of images
  if (ATLAS.on) atlasAdopt(Infinity);
  PSPRITE.cold=sprites;
  try{
    while (o.index<o.ents.length && count<cap && performance.now()-start<ms){
      const e=o.ents[o.index++], t0=performance.now();
      const plants=drawSceneEnt(e,W,H,season,0,sprites,o.ctx,true);
      count++;
      if (o.phase==='measure' && plants){
        o.plants+=plants; o.plantMs+=performance.now()-t0;
        if (o.plants>PSPRITE.FLOOR && o.plantMs>PSPRITE.HI_MS*OPEN_PREP.DECIDE){ o.index=o.ents.length; break; }
      }
    }
  } finally { PSPRITE.cold=false; }
  if (o.index<o.ents.length) return false;
  if (o.phase==='measure'){
    PSPRITE.active=!PSPRITE.off && o.plants>PSPRITE.FLOOR && o.plantMs>PSPRITE.HI_MS;
    PSPRITE.plantMs=o.plants ? o.plantMs/o.plants : 0;
    PSPRITE.hot=0; PSPRITE.calm=0;
    // Structure samples from a previous garden must not mask this one's plants.
    PSPRITE.structMs=0; PSPRITE.structRing.length=0;
    if (PSPRITE.active){ o.phase='sprites'; o.index=0; return false; }
  }
  // Leave speculative rotation/season preparation until this picture is shown.
  lastMeaningfulChange=t;
  return true;
}
/* Explicit skips keep one complete frame while the destination is prepared.
   Unlike speculative look-ahead, this can retire the old season under memory
   pressure: its pixels are held, so no live draw will ask for those sprites.
   Build the destination scene with its OWN shade/stunting, then borrow its
   clock only synchronously. The model, HUD and saves stay on the current day
   until the ground and all visible sprites can be revealed together. */
let skipPreparation=null;
function resetSkipPreparation(){
  if (skipPreparation){
    skipPreparation.cv.width=skipPreparation.cv.height=0;
    // Cancelled/superseded destinations must not retain speculative leases.
    if (!skipPreparation.ready){
      for (const e of PSPRITE.map.values()) if (e.used>PSPRITE.frame) e.used=PSPRITE.frame-2;
      for (const e of SSPRITE.map.values()) if (e.used>SSPRITE.frame) e.used=SSPRITE.frame-2;
    }
  }
  if (groundJob && groundJob.why==='skip') groundJob=null;
  skipPreparation=null;
}
function trimSkipSprites(season){
  if (PSPRITE.bytes>PSPRITE.MEM*1.5){
    for (const [k,e] of PSPRITE.map)
      if (!e.slot || !e.slot.endsWith('|'+season)) retirePlantSprite(k,e);
    PREBAKE.gen++;
  }
  if (SSPRITE.bytes>SSPRITE.MEM*1.5){
    const tail='|'+season+'|'+game.rot+'|'+(game.layerVis.night?1:0);
    for (const [k,e] of SSPRITE.map) if (!k.endsWith(tail)){
      SSPRITE.bytes-=e.bytes; SSPRITE.map.delete(k); retireSpriteImage(e.cv);
    }
  }
}
function preparePendingSkip(t){
  const p=pendingSkip;
  if (!p) return true;
  if (p.day<=absDay()){ landSkipNow(); return true; }
  if (!skipPreparation){
    const cv=document.createElement('canvas'); cv.width=cnv.width; cv.height=cnv.height;
    cv.getContext('2d').drawImage(cnv,0,0);
    skipPreparation={p,cv,key:null,ready:false};
  }
  const o=skipPreparation, start=performance.now();
  const W=VW/ZOOM, H=VH/ZOOM, MD=Math.round(GROUND_MARGIN_CSS*DPR);
  const was={elapsed:game.elapsedMs,suspended:game.clockSuspended,scene,shade:shadeMapCache};
  aheadFrame(t,skipAheadTarget());
  game.elapsedMs=AHEAD.at; game.clockSuspended=true;
  try{
    if (o.scene) scene=o.scene;
    if (o.shade) shadeMapCache=o.shade;
    const key=sceneKey()+'|'+groundDataKey()+'|'+groundStructKey(p.season,game.rot)
      +'|'+ZOOM+'|'+DPR+'|'+VW+'|'+VH+'|'+cam.x+'|'+cam.y+'|'+(game.layerVis.night?1:0)
      +'|'+PSPRITE.active+'|'+PSPRITE.off+'|'+SSPRITE.active+'|'+SSPRITE.off;
    // A photo can render the current day while this view is held, replacing
    // same-season sprite slots. Revalidate after any intervening live render.
    if (o.key!==key || sceneRefsChanged(o.refs) || o.plantFrame!==PSPRITE.frame || o.structFrame!==SSPRITE.frame){
      o.key=key; o.refs=sceneRefs(); o.index=0; o.ready=false; o.ents=null;
      o.build=sceneStale(sceneKey())?sceneBuildSteps(W,H):null;
      o.scene=null;
      AHEAD.epoch++; // camera, lighting, preview or edits must recheck every key
      // Age once for the whole preparation, never between its batches.
      pspriteFrame(); ssprFrame();
      o.plantFrame=PSPRITE.frame; o.structFrame=SSPRITE.frame;
    }
    if (o.build){
      while (performance.now()-start<AHEAD.budget){
        if (o.build.next().done){ o.build=null; break; }
      }
      if (o.build) return false;
    }
    if (!o.ents){
      o.scene=scene; o.shade=shadeMapCache;
      const ox=W/2-cam.x, oy=H*0.24-cam.y;
      o.ents=scene.ents.filter(e=>!(e.ox1+ox<0 || e.ox0+ox>W || e.oy1+oy<0 || e.oy0+oy>H));
    }
    trimSkipSprites(p.season);
    // the destination's sprites go into the atlas behind the held picture, not on the frame that lands
    if (ATLAS.on) atlasAdopt(Infinity);
    // Scene, shade, ground and sprites spend the same frame allowance.
    AHEAD.ms=performance.now()-start;
    const gs=groundStructKey(p.season,game.rot), gkey=gs+'|'+groundDataKey();
    const groundReady=groundKey===gkey && !groundRefsChanged() && groundZoom===ZOOM
      && groundCamX===cam.x && groundCamY===cam.y && !groundMarginStale;
    if (!groundReady){
      // A camera move during a held view must not leave a finishing pan bake
      // for the reveal frame. Prepare precisely the view that will be shown.
      if (groundJob && (groundJob.camX!==cam.x || groundJob.camY!==cam.y)) groundJob=null;
      ensureGroundJob('skip',p.season,game.rot,cam.x,cam.y,MD);
      prepareGroundWithinBudget(t,AHEAD.budget);
      if (!groundJobDone()) return false;
    }
    while (o.index<o.ents.length && performance.now()-start<AHEAD.budget){
      const e=o.ents[o.index];
      AHEAD.ms=performance.now()-start;
      if (e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB){
        if (PSPRITE.active && !PSPRITE.off) aheadBakePlant(e,true);
        else e.aheadFor=AHEAD.epoch;
      } else if (SSPRITE.active && !SSPRITE.off) aheadBakeStruct(e,W,H,game.layerVis.night,true);
      else e.aheadFor=AHEAD.epoch;
      if (e.aheadFor!==AHEAD.epoch) break;
      o.index++;
    }
    AHEAD.ms=performance.now()-start;
    if (o.index===o.ents.length){
      if (!groundReady) adoptGroundJob(t);
      o.ready=true;
    }
  } finally {
    // A completed shade map can precede the completed scene by several batches.
    // Keep it private to this job until both are ready to reveal.
    AHEAD.ms=performance.now()-start;
    o.shade=shadeMapCache;
    game.elapsedMs=was.elapsed; game.clockSuspended=was.suspended;
    scene=was.scene; shadeMapCache=was.shade;
    if (!o.ready){
      // Also restores the held view after a canvas resize, which clears pixels.
      cx.save(); cx.setTransform(1,0,0,1,0,0);
      cx.drawImage(o.cv,0,0,cnv.width,cnv.height); cx.restore();
      if (!o.notified && performance.now()-p.t0>250){
        toast('Preparing '+p.season+'…'); o.notified=true;
      }
    }
  }
  if (!o.ready) return false;
  scene=o.scene; shadeMapCache=o.shade;
  lastMeaningfulChange=t;
  return true;
}
/* ---------- the tree-shade wash ----------
   Every tile a canopy shades is tinted, under the planting. That was a loop over
   the visible tiles on every frame: project the tile, build an rgba() string for
   its alpha, set it as the fill style (which parses it), trace a diamond, fill.
   0.83us a shaded tile a frame, measured, which under a canopy is a large share
   of the whole frame: 0.28 of 0.97ms of script on a 27x27 garden with fourteen
   trees, and on a quarter acre with seventy (2,002 shaded tiles, the whole plot
   on screen) the frame was 5.3ms of script at 38fps against 4.0ms and 52fps with
   the wash switched off.
   None of it moves with the camera except by translation, and it changes only
   when the shade map does (a tree edit, the season, a rotation) or the ground
   under it is raised. So what the loop worked out is kept, in camera-free space
   (the cull box's trick): the shaded tiles, grouped into BLOCKS of 4x4 tiles and,
   within a block, by alpha stepped to 0.01. A frame culls the blocks to the
   screen and then draws them one of two ways, by how many shaded tiles are on
   screen (TILES_MAX):
     few: a fill a tile, as before, from the kept points and the kept style
       strings. The same drawing the loop sent, for less script.
     many: each block's tiles of one step as ONE kept Path2D, translated.
       Next to no script, and far fewer draws.
   Why two, and why blocks, is all measurement (Chrome 153 and Firefox 157):
     one path per alpha for the whole plot is free in script and 45fps on the
       quarter acre fitted, but zoomed in to 100% it is SLOWER than the loop
       (139 against 161fps): the tiles off screen are still tessellated;
     the same batched on the context each frame is slower than the loop in
       script as well (13.6 against 5.3ms; a long context path is costly);
     blocks culled to the screen are 48fps fitted and level with the loop
       zoomed in at 4 tiles a side (8 a side gave some of that back, 16 most);
     and in Firefox block paths are 142 against 119fps panning that quarter
       acre, but 1-2% BEHIND the loop on a small plot (338 and 729 shaded
       tiles on screen), where a fill a tile costs it nothing to speak of.
   The map's alphas run 0.09-0.24 and a tile is one flat tint, so a step of a
   hundredth is not something to see; both ways use the stepped tint, so the wash
   does not change as the view crosses from one to the other. Inside a path the
   hairline where two antialiased diamonds met is gone.
   The dashed outline of a FUTURE canopy (a young tree, Today view) is still
   drawn a tile at a time: there are few, and one stroke over shared edges would
   draw them once where they are drawn twice now. */
const SHADE_WASH={BLOCK:4, STEP:0.01, TILES_MAX:900, cache:null, vis:[]};
function shadeWashElevSame(c,E){
  if (c.grid===E) return true;
  let same=!!(c.grid.empty && E.empty);
  if (!same && !c.grid.empty && !E.empty && c.grid.g.length===E.g.length){
    same=true;
    const a=c.grid.g, b=E.g;
    for (let i=0;i<a.length;i++) if (a[i]!==b[i]){ same=false; break; }
  }
  // the grid object is rebuilt on any terrain edit; the heights usually are not
  if (same) c.grid=E;
  return same;
}
function shadeWashBlocks(shadeMap){
  const E=elevationGrid(), c0=SHADE_WASH.cache;
  if (c0 && c0.map===shadeMap && c0.rot===game.rot && c0.gw===GW && c0.gh===GH && shadeWashElevSame(c0,E)) return c0;
  const B=SHADE_WASH.BLOCK, STEP=SHADE_WASH.STEP, hw=TILE_W/2;
  const blocks=new Map(), future=[];
  const cx0=cam.x, cy0=cam.y;
  cam.x=0; cam.y=0;                        // camera-free, as setEntDrawPoint
  try{
    for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
      const si=y*GW+x, a=shadeMap.activeAlpha[si];
      if (a<=0){
        if (shadeMap.futureDrawScore[si]>=SHADE_FUTURE_SCORE){ const s=screenOf(x,y,0,0); future.push(s[0],s[1]); }
        continue;
      }
      const s=screenOf(x,y,0,0), sx=s[0], sy=s[1];
      const step=Math.round(Math.max(0.035,a)/STEP), bk=((y/B)|0)*4096+((x/B)|0);
      let bl=blocks.get(bk);
      if (!bl){ bl={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity,n:0,fills:new Map()}; blocks.set(bk,bl); }
      let f=bl.fills.get(step);
      // pts: where each tile's diamond starts (its top corner); path: built from them when first wanted
      if (!f){ f={style:'rgba(32,52,42,'+(step*STEP).toFixed(2)+')', pts:[], path:null}; bl.fills.set(step,f); }
      f.pts.push(sx,sy); bl.n++;
      if (sx-hw<bl.x0) bl.x0=sx-hw; if (sx+hw>bl.x1) bl.x1=sx+hw;
      if (sy<bl.y0) bl.y0=sy; if (sy+TILE_H>bl.y1) bl.y1=sy+TILE_H;
    }
  } finally { cam.x=cx0; cam.y=cy0; }
  const list=[];
  for (const bl of blocks.values()) list.push({x0:bl.x0,x1:bl.x1,y0:bl.y0,y1:bl.y1,n:bl.n,fills:[...bl.fills.values()]});
  return (SHADE_WASH.cache={map:shadeMap, rot:game.rot, gw:GW, gh:GH, grid:E, blocks:list, future});
}
// isoDiamondPath's diamond for each kept point, as one path
function shadeWashPath(pts){
  const p=new Path2D(), hw=TILE_W/2, hh=TILE_H/2;
  for (let i=0;i<pts.length;i+=2){
    const sx=pts[i], sy=pts[i+1];
    p.moveTo(sx,sy); p.lineTo(sx+hw,sy+hh); p.lineTo(sx,sy+TILE_H); p.lineTo(sx-hw,sy+hh); p.closePath();
  }
  return p;
}
function drawShadeWash(ctx,W,H,shadeMap){
  const c=shadeWashBlocks(shadeMap), ox=W/2-cam.x, oy=H*0.24-cam.y;
  const vis=SHADE_WASH.vis; vis.length=0;
  let n=0;
  for (const bl of c.blocks){
    if (bl.x1+ox<0 || bl.x0+ox>W || bl.y1+oy<0 || bl.y0+oy>H) continue;
    vis.push(bl); n+=bl.n;
  }
  let last='';
  if (n>SHADE_WASH.TILES_MAX && typeof Path2D==='function'){
    ctx.save(); ctx.translate(ox,oy);
    for (const bl of vis) for (const f of bl.fills){
      if (f.style!==last){ ctx.fillStyle=f.style; last=f.style; }
      ctx.fill(f.path || (f.path=shadeWashPath(f.pts)));
    }
    ctx.restore();
  } else {
    const hw=TILE_W/2, hh=TILE_H/2;
    for (const bl of vis) for (const f of bl.fills){
      if (f.style!==last){ ctx.fillStyle=f.style; last=f.style; }
      const p=f.pts;
      for (let i=0;i<p.length;i+=2){
        const sx=p[i]+ox, sy=p[i+1]+oy;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+hw,sy+hh); ctx.lineTo(sx,sy+TILE_H); ctx.lineTo(sx-hw,sy+hh); ctx.closePath();
        ctx.fill();
      }
    }
  }
  vis.length=0;
  const F=c.future;
  for (let i=0;i<F.length;i+=2){
    const sx=F[i]+ox, sy=F[i+1]+oy;
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    tileDiamond(ctx,sx,sy,null,'rgba(210,168,92,0.34)',[5,5]);
  }
}
function render(t){
  if (gardenOpening && !game.photo && !prepareGardenOpen(t)) return;
  if (!game.photo && !preparePendingSkip(t)) return;
  /* Sky: three full-screen gradient fills, now one opaque blit of a bake keyed
     on (season, canvas size) — see the season-wash note in world.js. This
     stretch used to be covered by no phase timer at all, which hid ~31% of the
     frame; `sky` is what closed that. */
  const tSky=dnow();
  // a Skip whose destination is ready lands here, before anything reads the clock
  landPreparedSkip();
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  maybeStartSeasonFade(t,cal.season);            // must run before the sky pass clears the frame
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  drawSeasonSky(cx,W,H,cal.season,amb);
  dmark('sky',tSky);

  const tCompass=dnow(); updateCompass(); dmark('compass',tCompass);

  const sway = Math.sin(t*0.0012);
  noteSpriteZoom(t);            // must precede both: it decides whether they may rescale
  pspriteFrame(); ssprFrame();
  // the season the clock is about to turn into, if it is close: its ground and
  // its sprites are baked ahead of it (groundJobTick, aheadBakePlant)
  const ahead=game.photo?null:seasonTurnAhead();
  aheadFrame(t,ahead);

  // visible tile window: invert the four screen corners to world tiles
  // and take the padded bounding box, so we only walk what's on screen
  // (the padding covers plant/cottage heights overhanging tile bounds)
  const crn=[tileAt(0,0,W,H),tileAt(W,0,W,H),tileAt(0,H,W,H),tileAt(W,H,W,H)];
  const pad=5; // large shrubs can overhang several tile centers
  const x0=Math.max(0,Math.min(crn[0][0],crn[1][0],crn[2][0],crn[3][0])-pad);
  const x1=Math.min(GW-1,Math.max(crn[0][0],crn[1][0],crn[2][0],crn[3][0])+pad);
  const y0=Math.max(0,Math.min(crn[0][1],crn[1][1],crn[2][1],crn[3][1])-pad);
  const y1=Math.min(GH-1,Math.max(crn[0][1],crn[1][1],crn[2][1],crn[3][1])+pad);
  // Persistent scene list: edits / rotation / layers, plus Today days or Established seasons.
  // (or when a load swapped the maps wholesale) — never on pan/zoom frames
  // Scene rebuilds are invalidation-triggered, not per-frame, so they are an
  // EVENT: folded into the 'gather' average they made a rare O(all plants)
  // rebuild indistinguishable from the cheap per-frame dynamic gather below,
  // which shares that label.
  if (sceneStale(sceneKey())){
    const tScene=dnow();
    // a perennial or a bulb in or out is one record; anything else is a rebuild
    if (sceneApplyEdits(W,H)) dev('sceneEdit',tScene);
    else { buildScene(W,H); dev('scene',tScene); }
  }

  const tG0=dnow();
  // world-anchored ground layer: bake viewport+margin keyed WITHOUT cam/zoom,
  // then blit per frame (see the note at the top of this file).
  // The key splits in two: STRUCT (season/rotation/edge style/canvas — a whole
  // new picture) and DATA (groundDataKey — the gardener edited a tile). Only a
  // data change is eligible for the edit throttle below; a struct change always
  // bakes at once, because there is nothing on screen worth keeping.
  const gStruct=groundStructKey(cal.season,game.rot);
  const gkey=gStruct+'|'+groundDataKey();
  let bakeMs=0;                                        // charged to the 'bake' event, not the 'ground' phase
  const MD=Math.round(GROUND_MARGIN_CSS*DPR);          // margin in device px
  if (!groundCanvas){ groundCanvas=document.createElement('canvas'); groundCtx=groundCanvas.getContext('2d'); }
  if (!groundCtx){
    /* The browser would not give the ground a canvas: it is out of canvas
       memory. Hand back what the sprite caches are not showing and let the next
       frame ask again; going on would dereference nothing and end in the crash
       panel. The sky is on the frame, so this one shows no ground. */
    groundCanvas=null; spriteMemoryPressure();
    return;
  }
  if (groundCanvas.width!==cnv.width+2*MD||groundCanvas.height!==cnv.height+2*MD){
    groundCanvas.width=cnv.width+2*MD; groundCanvas.height=cnv.height+2*MD; groundKey=''; }
  /* A picture baked behind the scenes (groundJob) is swapped in when it is
     exactly what this frame needs. If the canvas on screen cannot stand in —
     a rotation, not merely a season — the job is finished now: the bands
     already baked are the saving, and there is nothing to show meanwhile. */
  if (groundJob){
    if (!groundJobValid(MD)) groundJob=null;
    else if (groundJob.struct===gStruct){
      if (!groundJobDone() && groundKeyStruct!==gStruct && !groundSeasonOnly(groundKeyStruct,gStruct))
        stepGroundJob(t,GROUND_JOB_BANDS);
      if (groundJobDone()) adoptGroundJob(t);
    }
  }
  if (ZOOM!==groundZoomPrev){ groundZoomT=t; groundZoomPrev=ZOOM; }        // zoom gesture heat
  if (cam.x!==groundCamPrevX||cam.y!==groundCamPrevY){ groundCamT=t; groundCamPrevX=cam.x; groundCamPrevY=cam.y; }
  const zoomStale=ZOOM!==groundZoom;
  const camStale=cam.x!==groundCamX||cam.y!==groundCamY;
  const panDev=Math.max(Math.abs(cam.x-groundCamX),Math.abs(cam.y-groundCamY))*DPR*ZOOM;
  /* Edit throttle. A brush drag bumps groundRev on every tile it paints, so
     `gkey!==groundKey` was true on every frame of the stroke and the whole
     viewport rebaked each time — the one gesture the bake-once-blit-forever
     design never covered. Now the burst behind the brush settles at ~11Hz while
     drawGroundDamage stands in for the handful of tiles at the tip.

     The leading edge is anchored to the last EDIT, not the last bake. Anchoring
     it to the bake looks equivalent and is not: it leaves a settle-long dead
     zone after every bake, so an isolated tap that happens to land inside one
     gets deferred and pops ~90ms later. `newBurst` asks the question that
     actually matters — is this the first edit after a quiet moment — so a tap
     is always immediate and only a genuine stroke is rate-limited.

     It engages only when every changed tile is known and cheap to cover: no
     unlocated change (undo/load/elevation/houses set groundDamageFull), a
     non-empty set under the cap, and the same STRUCT key. Anything else falls
     through to an immediate bake, which is also what makes an external
     `groundKey=''` (stressGarden, perfBench) still force one. */
  const editThrottled = groundEditThrottled(t, gkey!==groundKey, groundKeyStruct===gStruct);
  /* Two changes leave a picture on screen that can stand in for a few frames
     while the right one is baked behind it (groundJob): a season turn, whose
     old ground sits under the crossfade that is showing the old season anyway,
     and the settle after a zoom, whose stale bake is merely soft. Both used to
     bake in full on the frame they happened, ~100ms of GPU at 2114x1241. */
  // A photo is one frame written straight into a PNG: nothing may stand in for it.
  const seasonOnly = !game.photo && groundKey!=='' && groundSeasonOnly(groundKeyStruct,gStruct)
    && groundKey.slice(groundKeyStruct.length)===gkey.slice(gStruct.length) && !groundRefsChanged();
  const zoomSettled = zoomStale && t-groundZoomT>GROUND_ZOOM_SETTLE;
  const mustBake = (gkey!==groundKey && !editThrottled && !seasonOnly)
    || groundRefsChanged()
    || panDev>=MD
    // a stale margin becomes visible the moment the camera moves, so bake at once
    || (camStale && groundMarginStale)
    // a zoom that would leave ground missing on screen cannot wait
    || (zoomStale && (groundZoomDriftDue(MD) || (zoomSettled && !!game.photo)))
    || (camStale && !zoomStale && t-groundCamT>GROUND_PAN_SETTLE);
  if (!mustBake && (seasonOnly || zoomSettled))
    ensureGroundJob(seasonOnly?'season':'zoom',cal.season,game.rot,cam.x,cam.y,MD);
  if (mustBake){
    // this bake supersedes any job heading for the same picture
    if (groundJob && groundJob.struct===gStruct) groundJob=null;
    const tBake=dnow();                                // 'ground' below is the per-frame BLIT; this is the bake
    /* A pan can reuse what is already baked (see scrollGroundBake). Only a pan:
       a data change (gkey), a struct change, a swapped layer or a zoom all make
       the kept pixels wrong, and each of those keeps the full bake. */
    const scrolled = groundKey!=='' && gkey===groundKey && !groundRefsChanged()
      && !zoomStale && camStale && !groundMarginStale && scrollGroundBake(t,W,H,amb,MD,pad);
    /* An edit with the camera still: repaint what it changed, or failing that
       the viewport and leave the margin. Either needs a bake already on the
       canvas to keep, and the same structure and scale, since a season turn or a
       zoom invalidates every pixel including the ones off screen. */
    const inPlace = !scrolled && groundKey!=='' && groundKeyStruct===gStruct
      && !groundRefsChanged() && !zoomStale && !camStale;
    const editRect = inPlace ? groundEditRect(W,H,MD) : null;
    if (editRect){
      bakeGroundRect(editRect[0],editRect[1],editRect[2],editRect[3],W,H,amb,t,MD,pad,MD/(DPR*ZOOM));
    } else if (inPlace){
      /* a few pixels INTO the margin, so the clip boundary — where the repaint
         antialiases against nothing — sits off screen rather than on the
         outermost row of pixels the gardener can see */
      const ov=8;
      bakeGroundRect(MD-ov,MD-ov,cnv.width+2*ov,cnv.height+2*ov,W,H,amb,t,MD,pad,TILE_W*2);
      groundMarginStale=true;
    } else if (!scrolled){
      const Mu=MD/(DPR*ZOOM);                            // margin in draw units
      // expanded tile bbox: the viewport window plus the baked margin
      const bc=[tileAt(-Mu,-Mu,W,H),tileAt(W+Mu,-Mu,W,H),tileAt(-Mu,H+Mu,W,H),tileAt(W+Mu,H+Mu,W,H)];
      const bx0=Math.max(0,Math.min(bc[0][0],bc[1][0],bc[2][0],bc[3][0])-pad);
      const bx1=Math.min(GW-1,Math.max(bc[0][0],bc[1][0],bc[2][0],bc[3][0])+pad);
      const by0=Math.max(0,Math.min(bc[0][1],bc[1][1],bc[2][1],bc[3][1])-pad);
      const by1=Math.min(GH-1,Math.max(bc[0][1],bc[1][1],bc[2][1],bc[3][1])+pad);
      groundCtx.setTransform(1,0,0,1,0,0); groundCtx.clearRect(0,0,groundCanvas.width,groundCanvas.height);
      groundCtx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,MD,MD);   // shift by the margin, device px
      paintGround(groundCtx,bx0,bx1,by0,by1,W,H,amb,t,Mu);
      groundCamX=cam.x; groundCamY=cam.y; groundMarginStale=false;
    }
    groundKey=gkey; groundKeyStruct=gStruct; groundZoom=ZOOM;
    groundRefs={terrain:game.terrain,elevation:game.elevation,houses:game.houses};
    if (!scrolled) noteGroundBaked();   // a scroll moves the picture, not the data
    // this bake is authoritative for everything edited up to now, and it starts
    // the next throttle window
    clearGroundDamage(); groundEditT=t;
    bakeMs=dev(scrolled?'bakePan':editRect?'bakeEdit':'bake',tBake,groundCtx);   // the bake DRAWS, so flush mode attributes its raster
  }
  // affine blit: exact 1:1 copy for pans (k=1, integer offset); a scaled
  // approximation mid-zoom-gesture that the settle rebake replaces crisp.
  const k=ZOOM/groundZoom;
  let bdx=DPR*VW/2*(1-k) - k*MD + DPR*ZOOM*(groundCamX-cam.x);
  let bdy=DPR*VH*0.24*(1-k) - k*MD + DPR*ZOOM*(groundCamY-cam.y);
  if (k===1){ bdx=Math.round(bdx); bdy=Math.round(bdy); }  // 1:1 copy, no resampling
  cx.save(); cx.setTransform(1,0,0,1,0,0);
  cx.drawImage(groundCanvas,bdx,bdy,groundCanvas.width*k,groundCanvas.height*k);
  cx.restore();
  // one band of the next ground picture, and queue one if the view is idle
  // or the clock is about to turn the season
  if (!game.photo) groundJobTick(t,MD,cal.season,ahead);
  // tiles edited since that bake, painted live over it (ground, so it belongs
  // under the site photo and everything else). Costs nothing when not editing.
  if (dbg.on) dbg.gdmg=drawGroundDamage(cx,W,H,amb); else drawGroundDamage(cx,W,H,amb);
  drawSiteUnderlay(cx,W,H);
  // Offsetting the start by bakeMs charges 'ground' with the per-frame blit
  // ALONE, so that row stays a stable ~0.1ms and a bake shows up where it can
  // actually be read — as an event with its own last/max, not as a one-frame
  // spike smeared across the window's average.
  dmark('ground',tG0+bakeMs);
  const tShade=dnow();
  // screen-space, not the tile bbox — see the bounds baked in buildScene
  const shOffX=W/2-cam.x, shOffY=H*0.24-cam.y;
  if (layerShown('woody')) for (const sh of scene.shrubs){
    if (sh.ox1+shOffX<0 || sh.ox0+shOffX>W || sh.oy1+shOffY<0 || sh.oy0+shOffY>H) continue;
    drawShrubFootprint(cx,W,H,sh,'base');
  }
  // active shade is a cool wash; young trees get only a faint future-canopy
  // edge. Hoist the shade map once (the At() helpers re-check the cache key
  // per call — a string build per tile per frame) and skip treeless gardens.
  const shadeMap=ensureShadeMap();
  if (shadeMap.hasShade) drawShadeWash(cx,W,H,shadeMap);
  // Shade-suitability overlay (Layers view): wash every tile by how much
  // canopy reaches it — amber = full sun, teal = shade, between = part shade
  if (game.layerVis.shade){
    for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
      const score=shadeMap.activeScore[yy*GW+xx]||0;
      const [sx,sy]=screenOf(xx,yy,W,H);
      if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
      const col = score>=SHADE_ACTIVE_SCORE ? 'rgba(38,84,112,0.52)'      // shade — cool blue
        : score>0 ? 'rgba(70,132,128,0.44)'                              // part shade — teal
        : 'rgba(232,180,78,0.40)';                                       // full sun — amber
      tileDiamond(cx,sx,sy,col,null);
    }
  }
  if (game.layerVis.matureCanopies) drawMatureCanopyOverlay(cx,W,H,x0,x1,y0,y1);
  if (game.layerVis.moisture) drawMoistureOverlay(cx,W,H,x0,x1,y0,y1);
  if (game.layerVis.height) drawHeightOverlay(cx,W,H,x0,x1,y0,y1);
  dmark('shade',tShade);
  const tCursor=dnow();
  const focusedShrub=layerShown('woody') && game.focusPlantKey ? shrubInfoFromKey(game.focusPlantKey) : null;
  if (focusedShrub) drawShrubFootprint(cx,W,H,focusedShrub,'focus');
  const hoverShrub=layerShown('woody') && game.hoverTile ? shrubAt(game.hoverTile[0],game.hoverTile[1]) : null;
  // the spread a hovered tile sits in — information, never a refusal: since
  // 0.9.61 a shrub's spread takes anything, and placing inside it is advice
  if (hoverShrub) drawShrubFootprint(cx,W,H,hoverShrub,'hover');
  game.shrubFx=game.shrubFx.filter(f=>t-f.t0<760);
  game.shrubFx.forEach(f=>{
    const sh=shrubInfoFromKey(f.key);
    if (sh && layerShown('woody')) drawShrubFootprint(cx,W,H,sh,'pulse',t-f.t0);
  });
  // cursor on the tile the last action addressed (where E acts again)
  const [hx,hy]=screenOf(game.actX,game.actY,W,H);
  cx.strokeStyle='rgba(243,236,221,0.85)'; cx.lineWidth=2;
  cx.beginPath(); cx.moveTo(hx,hy+2); cx.lineTo(hx+TILE_W/2-3,hy+TILE_H/2);
  cx.lineTo(hx,hy+TILE_H-2); cx.lineTo(hx-TILE_W/2+3,hy+TILE_H/2); cx.closePath(); cx.stroke();
  if (game.hoverTile && PLANTS[game.tool] && layerShown(toolTargetLayer(game.tool)) &&
      onPlot(game.hoverTile[0],game.hoverTile[1])){   // void tiles get no ghost — the stamp would refuse them anyway
    const def=plantDef(game.tool,game.toolVar);
    if (isShrubDef(def)){
      const [txh,tyh]=game.hoverTile, draft=matureWoodyDraft(game.tool,game.toolVar);
      const ok=canPlaceShrubAt(txh,tyh,draft).ok;
      drawShrubFootprint(cx,W,H,{x:txh,y:tyh,p:draft},ok?'ghost':'ghostBlocked');
    } else if (isTreeDef(def)){
      const [txh,tyh]=game.hoverTile;
      drawTreePlacementGhost(cx,W,H,txh,tyh,game.tool,game.toolVar);
    }
    if (def && def.sun!=='part' && !isTreeDef(def) && def.type!=='bulb'){
      const [txh,tyh]=game.hoverTile;
      // red only where placement will actually refuse (true establishment);
      // preview-mature or future canopies warn amber-dashed instead
      const shReal=shadeInfoAt(txh,tyh,false,true);
      const sh=shReal||shadeInfoAt(txh,tyh,true);
      if (sh){ const [sx,sy]=screenOf(txh,tyh,W,H);
        tileDiamond(cx,sx,sy,shReal?'rgba(150,42,32,0.16)':'rgba(210,168,92,0.13)',
          shReal?'rgba(230,118,92,0.88)':'rgba(234,188,102,0.78)',shReal?null:[5,4]); }
    }
  }
  // brush footprint ghost: the disc a sizable paint/elevation tool will stamp,
  // and the erase brush's reach — so the stamp area is visible before commit
  // (desktop hover; touch has no hover, it paints on contact).
  if (game.hoverTile){
    const [bxT,byT]=game.hoverTile, bmeta=toolMeta(game.tool);
    if (game.tool==='shovel') drawBrushGhost(cx,W,H,bxT,byT,game.brushSize,'erase');
    else if (bmeta.sizable && normalizeBrushSize(game.brushSize)>1) drawBrushGhost(cx,W,H,bxT,byT,game.brushSize,'paint');
  }

  // RTS-style placement ghost while the House tool is armed: tinted
  // footprint (red where it would overlap another house) under a translucent house
  let ghost=null;
  if (game.tool==='house' && game.hoverTile && game.houseDraft){
    const h=game.houseDraft;
    const gx=Math.max(0,Math.min(GW-h.w,game.hoverTile[0]));
    const gy=Math.max(0,Math.min(GH-h.h-1,game.hoverTile[1]));
    const blocked = game.houses.some(o=>gx<o.x+o.w&&gx+h.w>o.x&&gy<o.y+o.h&&gy+h.h>o.y);
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

  // depth-sorted entities: the persistent scene list is already sorted, so a
  // frame only culls each record (numeric compares) and merges in the one
  // per-frame dynamic entity, the house ghost.
  dmark('cursor',tCursor);
  const tGather=dnow();
  const dyn=[];
  if (ghost) dyn.push({d:houseDrawDepth(ghost)+0.01, kind:SCENE_K.GHOST, h:ghost});
  dmark('gather',tGather);
  const tSort=dnow(); if (dyn.length>1) dyn.sort((a,b)=>a.d-b.d); dmark('sort',tSort);
  const useSprites = PSPRITE.active;   // set by the governor at last frame's end
  /* One frame in SAMPLE pays for an exact structure/plant split; the rest
     reuse the smoothed absolute. Deliberately NOT gated on dbg.on — the
     governor runs for every user, so this cannot be debug-only.
     It also samples unconditionally until the first measurement lands: `hot`
     engages after 3 frames and a purely periodic sample can arrive as late as
     the 8th, so a garden could commit to the cache having never subtracted its
     structures even once — which is the whole bug, just narrowed to the frames
     that decide it. */
  structSampling = !PSPRITE.structMs || (PSPRITE.frame % PSPRITE.SAMPLE)===0;
  structSampleMs=0;
  const tDraw=dnow(), tDrawWall=performance.now();
  const sents=scene.ents;
  // SCREEN-space reject, not the tile bbox — see setEntScreenBounds. Same four
  // numeric compares as before; they just answer the question that was asked.
  const offX=W/2-cam.x, offY=H*0.24-cam.y;
  let plantCount=0, drawn=0, di=0;
  /* The pass draws under a plain scale, stated here rather than inherited from
     whatever ran above, because a sheared sprite blit sets the matrix and sets
     this scale back (plantBlitScale, blitPlantSprite). */
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  plantBlitScale=DPR*ZOOM;
  // the same boxes packed in one array (sceneBuildSteps); a scene from anywhere
  // else has none, and its records are read as before
  // (nor has a list a dev tool swapped in: the boxes belong to the array they were built for)
  const sb=scene.bounds && scene.boundsFor===sents ? scene.bounds : null;
  // clumps just off screen are baked ahead of the camera (prebakeReach); 0 = not this frame
  const ring=(useSprites && sb && !game.photo && !ahead) ? prebakeReach(W,H,cal.season) : 0;
  const pgen=PREBAKE.gen;
  try{
    for (let i=0;i<sents.length;i++){
      const e=sents[i];
      while (di<dyn.length && dyn[di].d<=e.d){
        plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
      if (sb){ const j=i*4;
        if (sb[j+1]+offX<0 || sb[j]+offX>W || sb[j+3]+offY<0 || sb[j+2]+offY>H){
          if (ring && e._pb!==pgen && e.kSlot!==undefined)
            prebakeNote(e,sb[j]+offX,sb[j+1]+offX,sb[j+2]+offY,sb[j+3]+offY,W,H,ring);
          continue;
        }
      }
      else if (e.ox1+offX<0 || e.ox0+offX>W || e.oy1+offY<0 || e.oy0+offY>H) continue;
      plantCount+=drawSceneEnt(e,W,H,cal.season,sway,useSprites);
      drawn++;
    }
    while (di<dyn.length){
      plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
  } finally { plantBlitScale=0; }
  const tPlantPass=performance.now()-tDrawWall;   // the governor's measure: the pass, not the bakes ahead of it
  if (ring) prebakeRun(cal.season,groundViewIdle(t));
  dmark('draw',tDraw);
  // Diagnostic speculative readiness; explicit skips check their destination
  // scene separately, including its shade, scale and visible working set.
  AHEAD.readyFor=AHEAD.season && !AHEAD.short ? AHEAD.season : null;
  drawBuildingDraftOverlay(cx,W,H);
  updateSpriteMode(tPlantPass, plantCount,
    structSampling ? structSampleMs : null);
  structSampling=false;
  if (dbg.on){ dbg.ents=drawn; dbg.tiles=(x1-x0+1)*(y1-y0+1); }
  const tFx=dnow();

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
  dmark('pulse',tFx);
  const tOver=dnow();

  if (game.focusTile && !focusedShrub) drawPlantFocusRing(cx,W,H,game.focusTile);

  // selection tool: marquee, committed selection, and move/copy ghost
  drawExistingOverlay(cx,W,H);
  if (game.tool==='select') drawSelectionOverlay(cx,W,H,t,cal.season,sway);
  drawRulerOverlay(cx,W,H);
  drawPergolaGhost(cx,W,H,cal.season);
  drawTerraceGhost(cx,W,H);
  drawBermGhost(cx,W,H);
  drawStepsGhost(cx,W,H);
  drawEdgingGhost(cx,W,H);
  drawWallFaceHover(cx,W,H);
  drawToolDragMetric(cx,W,H);
  if (game.layerVis.edgeRulers && VW>640) drawSelectionMetrics(cx,W,H,{x0:0,y0:0,x1:GW-1,y1:GH-1});
  if (typeof positionSelectionActions==='function') positionSelectionActions();
  dmark('over',tOver);
  const tLight=dnow();

  // season light tint (falling snow is a layer of its own over the canvas: snowFrame)
  applySeasonLighting(cx,W,H,amb,cal.season);
  if (game.layerVis.night){
    /* Culled in SCREEN space -- the trap this file documents twice already: the
       tile bbox is the bbox of a DIAMOND, so it keeps lights that are off screen
       and DROPS lights whose pool still lands on screen while their own tile
       does not. A fire pit is padded by FIREPIT_GLOW_REACH off its baked box; a
       fixture's emitters carry their own extent (nightEmitters). */
    const offX=W/2-cam.x, offY=H*0.24-cam.y;
    const night=nightEmitters(W,H,offX,offY);
    applyDuskLighting(cx,W,H,cal.season,nightLightMap(W,H,cal.season,night));
    for (const e of night.pits) drawFirepitGlow(cx,W,H,e.f,e.x,e.y);
    for (const L of night.lights) if (L.vis) drawLightGlowAt(cx,L.sx,L.base,L.l,L.crown);
    drawFestoonGlow(cx,night.bulbs);
    drawFireflies(cx,W,H,t,cal,offX,offY);
  }

  drawSeasonFade(t);                            // old season dissolves over the new one
  /* Split three ways, because 'fx' was a catch-all for everything after the
     entity pass and read as "planting pulses" when it was mostly a full-screen
     lighting wash. A live session showed it at 31% of the frame while planting
     and there was no way to tell which half was responsible.
       pulse — the planting pulse diamonds (game.fx), transient
       over   — selection/ruler/metric overlays, only when those tools are live
       light  — season tint, snow, dusk/glow: full-screen work EVERY frame */
  dmark('light',tLight);
  if (gardenOpening && !game.photo) finishGardenOpen();
}

/* ---------- night: what is lit, and the map of it ----------
   Night used to be a 26% blue tint with each fixture's glow added over it in
   screen blend, so a lamp could only ever ADD colour to a scene that was barely
   darker than day: its pool hardly showed, and an uplight painted a cone of fog
   in the air. Night is darker now (NIGHT_DARK, world.js), and light is what
   takes the darkness away: every fixture, fire pit and lit pergola hands over
   EMITTERS (lightEmitters, firepitEmitters, the festoon bulbs below), the night
   map is the darkness with each of them erased from it, and that map is laid
   over the garden in place of the old tint. Where a lamp shines, the garden
   shows in its own colours; the glow pass then warms it in the lamp's colour.

   The map is drawn at a quarter of the canvas's device size (NIGHT_MAP.DOWN)
   and stretched: light is soft, so the quarter-size map is the same picture at a
   sixteenth of the pixels, and a frame lays one blit for it where the tint was
   one fill. It is kept while nothing it depends on moves: the scene, the camera,
   the canvas, the season and the garden's clock (an uplight's tree grows), so
   an idle night garden does not redraw it. */
const NIGHT_MAP={DOWN:4, cv:null, g:null, key:'', scene:null};
let nightBlobImg=null;
function nightBlobImage(){
  if (nightBlobImg) return nightBlobImg;
  const n=64, cv=spriteBakeSurface('nightblob',n,n), g=cv.getContext('2d');
  const gr=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.34,'rgba(255,255,255,0.9)');
  gr.addColorStop(0.62,'rgba(255,255,255,0.5)'); gr.addColorStop(0.85,'rgba(255,255,255,0.13)');
  gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,n,n);
  return (nightBlobImg=spriteBakeImage('nightblob',cv));
}
// a bay of a lit pergola, camera-free: its ground centre and its bulbs, kept on the record
function festoonPoints(rec){
  if (rec._fb) return rec._fb;
  const cx0=cam.x, cy0=cam.y; cam.x=0; cam.y=0;
  let c;
  try{ c=groundCenterRot(rec.x,rec.y,null,0,0); }
  finally{ cam.x=cx0; cam.y=cy0; }
  const pts=[];
  if (rec.fest){
    const a=pergolaFrameAt(rec.x,rec.y).a, [ax,ay]=isoAxes();
    const G=festoonGeom(rec.fest,pergolaSpec(rec.pg&&rec.pg.mat),pergolaDrawH(rec.pg));
    for (const [r,z] of G.bulbs){
      const wx=a?r:0, wy=a?0:r;              // b=0: the string hangs along the rafter
      pts.push([c[0]+ax[0]*wx+ay[0]*wy, c[1]+ax[1]*wx+ay[1]*wy-z]);
    }
  }
  return (rec._fb={c,pts});
}
const FESTOON_GLOW_R=11, FESTOON_POOL=0.95;
function nightEmitters(W,H,offX,offY){
  const blobs=[], lights=[], pits=[], bulbs=[];
  const onScr=(x,y,rx,ry)=>!(x+rx<0 || x-rx>W || y+ry<0 || y-ry>H);
  const R=FIREPIT_GLOW_REACH;
  for (const e of scene.firepits){
    if (e.ox1+offX< -R || e.ox0+offX>W+R || e.oy1+offY< -R || e.oy0+offY>H+R) continue;
    pits.push(e);
    for (const b of firepitEmitters(e.f,e.x,e.y,W,H)) blobs.push(b);
  }
  for (const e of scene.lights){
    const sx=e.px+offX, base=e.py+offY+TILE_H/2;
    let crown=null;
    if (e.aim){
      const a=e.aim, g=sceneEntGrowth(a)*(a.stunt?STUNT_GROWTH:1);
      crown=woodyCrownAt(plantDef(a.p.s,a.p.v),g,a.px+offX,a.py+offY+TILE_H/2);
    }
    const em=lightEmitters(e.l,sx,base,crown);
    let vis=false;
    for (const b of em.out) if (onScr(b.x,b.y,b.rx,b.ry)){ vis=true; blobs.push(b); }
    lights.push({l:e.l,sx,base,crown,vis});
  }
  for (const e of scene.festoons){
    const f=festoonPoints(e), gx=f.c[0]+offX, gy=f.c[1]+offY;
    const rx=TILE_W*FESTOON_POOL, ry=TILE_H*FESTOON_POOL;
    if (onScr(gx,gy,rx,ry)) blobs.push({x:gx,y:gy,rx,ry,a:0.62,g:0});
    for (const p of f.pts){
      const x=p[0]+offX, y=p[1]+offY;
      if (!onScr(x,y,FESTOON_GLOW_R*2,FESTOON_GLOW_R*2)) continue;
      bulbs.push([x,y]);
      blobs.push({x,y,rx:FESTOON_GLOW_R*1.7,ry:FESTOON_GLOW_R*1.7,a:0.6,g:0});
    }
  }
  return {blobs,lights,pits,bulbs};
}
function nightLightMap(W,H,season,night){
  const m=NIGHT_MAP, dev=cx.canvas;
  const mw=Math.max(16,Math.ceil(dev.width/m.DOWN)), mh=Math.max(16,Math.ceil(dev.height/m.DOWN));
  if (!m.cv){ m.cv=document.createElement('canvas'); m.g=m.cv.getContext('2d'); }
  const stamp=gardenClockStamp();
  const key=mw+'x'+mh+'|'+W+'x'+H+'|'+cam.x+','+cam.y+'|'+season+'|'+stamp+'|'+night.blobs.length;
  // NaN !== NaN: a running clock redraws it every frame
  if (m.scene===scene && m.key===key && stamp===stamp) return m.cv;
  if (m.cv.width!==mw || m.cv.height!==mh){ m.cv.width=mw; m.cv.height=mh; }
  const g=m.g, k=mw/W, img=nightBlobImage();
  g.setTransform(1,0,0,1,0,0);
  g.globalAlpha=1; g.globalCompositeOperation='copy';
  g.fillStyle=nightDark(season); g.fillRect(0,0,mw,mh);
  g.globalCompositeOperation='destination-out';
  for (const b of night.blobs){
    g.globalAlpha=b.a;
    g.drawImage(img,(b.x-b.rx)*k,(b.y-b.ry)*k,b.rx*2*k,b.ry*2*k);
  }
  g.globalAlpha=1; g.globalCompositeOperation='source-over';
  m.key=key; m.scene=scene;
  return m.cv;
}
// a lit festoon bulb, again in screen blend: the sprite's bulb was dimmed with the rest
function drawFestoonGlow(ctx,bulbs){
  if (!bulbs.length) return;
  const img=lightGlowImage(lightTone('warm').glow), r=FESTOON_GLOW_R;
  ctx.save(); ctx.globalCompositeOperation='screen';
  ctx.globalAlpha=0.5;
  for (const [x,y] of bulbs) ctx.drawImage(img,x-r,y-r,r*2,r*2);
  ctx.globalAlpha=0.95;
  for (const [x,y] of bulbs) ctx.drawImage(img,x-3,y-3,6,6);
  ctx.restore();
}
/* ---------- fireflies ----------
   On a summer night, over the planting: a few dozen, each hovering a foot or
   four above a herbaceous plant (never a tree: fireflies belong to the meadow),
   each flashing for a third of a second every few seconds with a little rising
   swoop, dark in between, which is what fireflies do. Placed off the scene's
   plant records, so they stay on the garden as the camera moves, seeded so a
   garden has the same ones, and timed off the frame's clock, so they flash at
   the same rate at any frame rate. The garden already redraws at 30fps when
   idle (the wind), so they cost no extra frames: a soft dot each, only while
   flashing. None when less motion is asked for. */
const FIREFLY={MAX:64, MIN:8, PER_PLANTS:3.5, PERIOD:[2.4,4.8], FLASH:0.36, SWOOP:7,
  glow:'rgba(206,244,104,', core:'#f4ffc6'};
let fireflyField={scene:null, flies:[]};
function fireflyFlies(){
  if (fireflyField.scene===scene) return fireflyField.flies;
  const herbs=[];
  for (const e of scene.ents) if (e.kind===SCENE_K.PLANT && !isWoodyDef(plantDef(e.p.s,e.p.v))) herbs.push(e);
  const n=herbs.length ? Math.max(FIREFLY.MIN,Math.min(FIREFLY.MAX,Math.round(herbs.length/FIREFLY.PER_PLANTS))) : 0;
  const rnd=mulberry(0x5f1e5), flies=[];
  for (let i=0;i<n;i++){
    const e=herbs[Math.floor(rnd()*herbs.length)];
    flies.push({e, jx:(rnd()-0.5)*TILE_W*0.9, jy:(rnd()-0.5)*TILE_H*0.9, lift:feetToPx(0.9+rnd()*3.3),
      ax:5+rnd()*14, ay:3+rnd()*7, wx:0.22+rnd()*0.4, wy:0.3+rnd()*0.5, ph:rnd()*6.283, ph2:rnd()*6.283,
      per:FIREFLY.PERIOD[0]+rnd()*(FIREFLY.PERIOD[1]-FIREFLY.PERIOD[0]), off:rnd()*10, dir:rnd()<0.5?-1:1});
  }
  fireflyField={scene, flies};
  return flies;
}
function drawFireflies(ctx,W,H,t,cal,offX,offY){
  if (!cal || cal.season!=='Summer' || game.photo || reducedMotion()) return;
  const flies=fireflyFlies(); if (!flies.length) return;
  const img=lightGlowImage(FIREFLY.glow), sec=t/1000;
  ctx.save(); ctx.globalCompositeOperation='screen';
  for (const f of flies){
    const fl=(sec+f.off)%f.per;
    if (fl>FIREFLY.FLASH) continue;
    const u=fl/FIREFLY.FLASH, b=Math.pow(Math.sin(Math.PI*u),2);
    const x=f.e.px+offX+f.jx+f.ax*Math.sin(sec*f.wx+f.ph)+f.dir*u*2.5;
    const y=f.e.py+offY+TILE_H/2+f.jy-f.lift+f.ay*Math.sin(sec*f.wy+f.ph2)-u*u*FIREFLY.SWOOP;
    if (x<-12 || x>W+12 || y<-12 || y>H+12) continue;
    ctx.globalAlpha=0.85*b; ctx.drawImage(img,x-10,y-10,20,20);
    ctx.globalAlpha=b; ctx.fillStyle=FIREFLY.core;
    ctx.beginPath(); ctx.arc(x,y,1.3,0,7); ctx.fill();
  }
  ctx.restore();
}
function selDrawRect(cx,W,H,r,fill,stroke){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    if (x<0||y<0||x>=GW||y>=GH) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,fill,stroke);
  }
}
/* "Metric" here has always meant "a measurement", not the metric system —
   these are the on-canvas readouts for the marquee, the ruler and a paint drag.
   All three were the same rule written three times, differing only in what they
   convert to inches first; they are wrappers over fmtLengthIn (core.js) now, so
   the ruler and the selection cannot disagree about what 30 inches is called,
   and one change taught all three the metric system. */
function selMetricLabel(n){ return fmtLengthIn(n*TILE_IN); }
function distanceMetricLabel(a,b){
  const dx=(b[0]-a[0]), dy=(b[1]-a[1]);
  return fmtLengthIn(Math.max(TILE_IN,Math.round(Math.hypot(dx,dy)*TILE_IN)));
}
function inchesMetricLabel(inches){ return fmtLengthIn(inches); }
function tileCenterScreen(x,y,W,H){
  const [sx,sy]=screenOf(x,y,W,H);
  return [sx,sy+TILE_H/2];
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
function drawRulerEndpoint(cx,p){
  cx.save();
  cx.strokeStyle='#72c9ff';
  cx.fillStyle='rgba(23,39,51,0.62)';
  cx.lineWidth=2.4;
  cx.beginPath(); cx.arc(p[0],p[1],5.5,0,7); cx.fill(); cx.stroke();
  cx.restore();
}
function drawRulerOverlay(cx,W,H){
  const r=game.ruler;
  if (!r || !r.a) return;
  const a=tileCenterScreen(r.a[0],r.a[1],W,H);
  drawRulerEndpoint(cx,a);
  if (!r.b){
    drawSelMetricLabel(cx,a[0],a[1]-22,'Start');
    return;
  }
  const b=tileCenterScreen(r.b[0],r.b[1],W,H);
  drawRulerEndpoint(cx,b);
  drawSelDimLine(cx,a,b,distanceMetricLabel(r.a,r.b),1);
}
/* What the live paint-drag readout says, or null for none. The ARMED TOOL's
   row decides (TOOLS[t].measure), not the noun its hook returned: a fence run
   returns 'gate' for a gate, and the readout is about the gesture, not the
   tile. It used to gate on ['path','bed','water','fence','gate'] — written
   before lawn and the pergola, so a meadow drag and a pergola run measured
   nothing — which is the kind list that refused every shared garden with a
   lawn in it (isTerrainKind), one surface over.
   A run is `x N wide` only for a tool whose brush has a width: a fence or a
   pergola is one tile wide whatever the size dots say. Mowing is an area too,
   but the one area that is REMOVED, so it says so: without the word, a mown
   path's readout reads as the size of the meadow it is cut through. */
function toolDragMetricLabel(drag){
  if (!drag || !drag.active) return null;
  // a rectangle (the pergola, a terrace) reads its footprint, which exists
  // before any tile does — and a terrace its height, which is the other half
  if (drag.rect){ const r=pergolaRect(drag.sx,drag.sy,drag.cx,drag.cy);
    const size=pergolaSizeText(r.x1-r.x0+1,r.y1-r.y0+1);
    return game.tool==='terrace' ? `${size}, ${terraceHeightText(terraceDraft().h).toLowerCase()}` : size; }
  if (!drag.what) return null;
  const meta=toolMeta(game.tool);
  if (meta.measure==='area'){
    const label=fmtAreaSqFt(tileAreaSqFt(drag.affected?drag.affected.size:0));
    return lawnMowArmed() ? `${label} mown` : label;
  }
  if (meta.measure==='run'){
    const label=inchesMetricLabel(drag.runInches||TILE_IN), size=toolBrushSize();
    return size>1 ? `${label} x ${selMetricLabel(size)} wide` : label;
  }
  return null;
}
/* What a pergola tap or drag is about to lay, before it is laid: the tiles of
   the footprint (red where something stands in the way, since a pergola is
   laid whole or not at all), and while dragging the translucent frame itself,
   so where the posts land and which way the rafters run is visible before the
   gesture commits. Hovering an existing pergola outlines it instead -- a tap
   there restyles it. Drawn only with the pergola armed, and the frame only for
   a footprint small enough to cost nothing (PERGOLA_GHOST_MAX tiles). */
const PERGOLA_GHOST_MAX=400;
function drawPergolaGhost(cx,W,H,season){
  if (game.tool!=='pergola' || !layerShown('landscape')) return;
  const td=typeof toolDrag!=='undefined'?toolDrag:null;
  let r=null, framed=false;
  if (td && td.rect && td.active){ r=pergolaRect(td.sx,td.sy,td.cx,td.cy); framed=true; }
  else if (!td && game.hoverTile){
    const [hx,hy]=game.hoverTile;
    const reg=pergolaRegionAt(hx,hy);
    if (reg){
      for (const [x,y] of reg.tiles){ const [sx,sy]=screenOf(x,y,W,H);
        tileDiamond(cx,sx,sy,'rgba(243,236,221,0.16)','rgba(243,236,221,0.5)',[4,3]); }
      return;
    }
    r=pergolaTapRect(hx,hy);
  }
  if (!r) return;
  const blocked=!!pergolaRectBlocker(r), tiles=[];
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    tiles.push([x,y]);
    const [sx,sy]=screenOf(x,y,W,H), bad=pergolaBlockerAt(x,y);
    tileDiamond(cx,sx,sy,bad?'rgba(196,58,44,0.42)':blocked?'rgba(196,58,44,0.12)':'rgba(243,236,221,0.22)',null);
  }
  // the roof's edge, on the corner lattice (screenOfCorner: it turns differently)
  cx.save(); cx.setLineDash([6,4]); cx.lineWidth=1.6;
  cx.strokeStyle=blocked?'rgba(230,118,92,0.9)':'rgba(243,236,221,0.85)';
  cx.beginPath();
  [[r.x0,r.y0],[r.x1+1,r.y0],[r.x1+1,r.y1+1],[r.x0,r.y1+1]].forEach(([qx,qy],i)=>{
    const [px,py]=screenOfCorner(qx,qy,W,H); i?cx.lineTo(px,py):cx.moveTo(px,py); });
  cx.closePath(); cx.stroke(); cx.restore();
  if (!framed || blocked || tiles.length>PERGOLA_GHOST_MAX) return;
  const info=pergolaRegionInfo(tiles), has=(x,y)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;
  const axes=isoAxes(), d=pergolaDraft();
  tiles.sort((p,q)=>viewDepth(p[0],p[1])-viewDepth(q[0],q[1]));
  cx.save(); cx.globalAlpha=0.6;
  for (const [x,y] of tiles){
    const [gx,gy]=groundCenterRot(x,y,null,W,H);
    drawPergolaBay(cx,gx,gy,axes,pergolaFrameIn(has,info,x,y),d,season);
  }
  cx.restore();
}
/* What a terrace tap or drag is about to build, before the ground bake does:
   the box it will become, standing (or sunk) at the armed height, its two
   camera-facing walls painted in the armed facing through the garden's own
   wall painter. Red where a building is in the way, since a terrace is built
   whole or not at all. Hovering an existing terrace outlines it instead -- a
   tap there rebuilds it. With Fill on there is no box to show: the fill takes
   whatever region the tap lands in. Drawn only with the Terrace armed; the
   per-tile blocker scan and the region flood are cached on game.rev, so a
   still pointer costs a few path fills a frame. */
const TERRACE_GHOST_UNITS=48;      // past this many tile edges the walls draw as flat tone
/* What an Edging tap is about to do, on the bed under the pointer: its whole
   lawn-facing outline in the armed material over a pale halo, or, with No
   edging armed, a red dash where edging would come off. A tap edges the whole
   bed, so the preview has to show the whole bed, or a gardener hovering one
   corner of a long border would not know the far end changes too. Built only
   while Edging is armed and the pointer is over a bed; the region is kept
   until the pointer leaves it or the garden changes (edgingGhostCache). */
const edgingGhostCache={reg:null,rev:-1};
function edgingGhostRegion(x,y){
  const c=edgingGhostCache, k=x+','+y;
  if (c.rev!==game.rev || !c.reg || !c.reg.has.has(k)){ c.reg=edgingRegionAt(x,y); c.rev=game.rev; }
  return c.reg && c.reg.has.has(k) ? c.reg : null;
}
function edgingGhostRuns(reg,hx,hy,W,H){
  const runs=[];
  if (game.edgeStyle==='organic'){
    const k0=hx+','+hy, region=buildTerrainRegions().find(r=>r.tiles.has(k0));
    if (!region) return runs;
    const lift=region.elev*ELEV_STEP;
    const proj=([gx,gy])=>{ const p=screenOfCorner(gx,gy,W,H); return [p[0],p[1]-lift]; };
    for (const loop of region.loops){
      if (loop.closed){ if (!loop.covered && !loop.hard) runs.push([edgingCurvePoints(loop,proj),edgingArcSeed(loop)]); continue; }
      for (const arc of loop.arcs) if (!arc.covered && !arc.hard) runs.push([edgingCurvePoints(arc,proj),edgingArcSeed(arc)]);
    }
    return runs;
  }
  for (const [x,y] of reg.tiles){
    const [sx,sy]=screenOf(x,y,W,H), cy=sy+TILE_H/2;
    const N=[sx,sy], E=[sx+TILE_W/2,cy], S=[sx,sy+TILE_H], Wp=[sx-TILE_W/2,cy];
    for (const [[dx,dy],a,b] of [[[1,0],E,S],[[0,1],S,Wp],[[-1,0],Wp,N],[[0,-1],N,E]])
      if (isLawnTile(x+dx,y+dy)) runs.push([[a,b],tileSeed(x,y)]);
  }
  return runs;
}
function drawEdgingGhost(cx,W,H){
  if (game.tool!=='edging' || !game.hoverTile || !layerShown('landscape')) return;
  const [hx,hy]=game.hoverTile, reg=edgingGhostRegion(hx,hy);
  if (!reg || !reg.sides || reg.tiles.length>2500) return;
  const want=edgingDraft(), st=edgingStyle(want), runs=edgingGhostRuns(reg,hx,hy,W,H);
  const m=cx.getTransform&&cx.getTransform(), dev=(m&&(m.a||m.b))?Math.hypot(m.a,m.b):1;
  cx.save(); cx.lineJoin='round'; cx.lineCap='round';
  const trace=pts=>{ cx.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++) cx.lineTo(pts[i][0],pts[i][1]); };
  if (!st.w){
    cx.beginPath(); for (const [pts] of runs) trace(pts);
    cx.setLineDash([6/dev*1.4,4/dev*1.4]); cx.strokeStyle='rgba(230,118,92,0.95)'; cx.lineWidth=2.4/dev; cx.stroke();
  } else {
    cx.beginPath(); for (const [pts] of runs) trace(pts);
    cx.strokeStyle='rgba(243,236,221,0.55)'; cx.lineWidth=st.w+7/dev; cx.stroke();
    for (const [pts,seed] of runs) drawEdgingRun(cx,pts,st,seed);
  }
  cx.restore();
}
const terraceGhostCache={key:null,bad:null,reg:null,regRev:-1};
function terraceGhostBad(r){
  const key=`${r.x0},${r.y0},${r.x1},${r.y1},${game.rev},${GW},${GH}`;
  if (terraceGhostCache.key!==key){
    const bad=[];
    for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++) if (terraceBlockerAt(x,y)) bad.push([x,y]);
    terraceGhostCache.key=key; terraceGhostCache.bad=bad;
  }
  return terraceGhostCache.bad;
}
function terraceGhostRegion(x,y){
  const c=terraceGhostCache;
  if (c.regRev!==game.rev || !c.reg || !c.reg.has.has(x+','+y)){
    c.reg=terraceRegionAt(x,y); c.regRev=game.rev;
  }
  return c.reg && c.reg.has.has(x+','+y) ? c.reg : null;
}
/* The berm a drag (or a tap) will shape, before it is shaped: its contours, one
   for every level it climbs (or falls), traced over the ground as it is now, the
   way a grading plan draws one. Red dashes round the box where there is nothing
   it can shape. The plan is worked out once per box and garden revision. */
let bermGhostCache={key:'', plan:null, rings:null};
function drawBermGhost(cx,W,H){
  if (game.tool!=='berm' || !layerShown('landscape')) return;
  const td=typeof toolDrag!=='undefined'?toolDrag:null, d=bermDraft();
  let r=null;
  if (td && td.rect && td.active) r=pergolaRect(td.sx,td.sy,td.cx,td.cy);
  else if (!td && game.hoverTile) r=bermTapRect(game.hoverTile[0],game.hoverTile[1],d.h);
  if (!r) return;
  const key=[r.x0,r.y0,r.x1,r.y1,d.h,game.rev,GW,GH].join(',');
  if (bermGhostCache.key!==key){
    const plan=bermPlan(r,d.h), lv=new Map(plan.tiles.map(([x,y,v])=>[x+','+y,v]));
    const rings=[];
    for (let L=1;L<=Math.abs(plan.peak);L++){
      const set=new Set();
      for (const [k,v] of lv) if (Math.abs(v)>=L) set.add(k);
      if (set.size) rings.push({L, loops:traceOutlines(set)});
    }
    bermGhostCache={key, plan, rings};
  }
  const {plan,rings}=bermGhostCache;
  const P=([gx,gy])=>{ const p=screenOfCorner(gx,gy,W,H); return [p[0],p[1]-groundHeightAt(gx,gy)*ELEV_STEP]; };
  cx.save();
  if (!plan.tiles.length){
    const q=[[r.x0,r.y0],[r.x1+1,r.y0],[r.x1+1,r.y1+1],[r.x0,r.y1+1]].map(P);
    cx.beginPath(); q.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1])); cx.closePath();
    cx.fillStyle='rgba(196,58,44,0.12)'; cx.fill();
    cx.setLineDash([6,4]); cx.lineWidth=1.6; cx.strokeStyle='rgba(230,118,92,0.9)'; cx.stroke();
    cx.restore(); return;
  }
  const n=rings.length;
  for (const ring of rings){
    cx.beginPath();
    for (const loop of ring.loops){
      const pts=simplifyClosedLoop(loop,0.9);
      const sp=(pts.length>=3?pts:loop).map(P), m=sp.length;
      for (let i=0;i<m;i++){
        const a=sp[i], b=sp[(i+1)%m], mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        if (!i){ const z=sp[m-1]; cx.moveTo((z[0]+a[0])/2,(z[1]+a[1])/2); }
        cx.quadraticCurveTo(a[0],a[1],mid[0],mid[1]);
      }
      cx.closePath();
    }
    if (ring.L===1){ cx.fillStyle=d.h<0?'rgba(40,62,78,0.16)':'rgba(243,236,221,0.14)'; cx.fill(); }
    cx.setLineDash(ring.L===1?[6,4]:[]);
    cx.lineWidth=ring.L===1?1.6:1.1;
    cx.strokeStyle=`rgba(243,236,221,${(0.5+0.4*ring.L/n).toFixed(2)})`;
    cx.stroke();
  }
  cx.restore();
}
function drawTerraceGhost(cx,W,H){
  if (game.tool!=='terrace' || game.fillMode || !layerShown('landscape')) return;
  const td=typeof toolDrag!=='undefined'?toolDrag:null;
  let r=null;
  if (td && td.rect && td.active) r=pergolaRect(td.sx,td.sy,td.cx,td.cy);
  else if (!td && game.hoverTile){
    const [hx,hy]=game.hoverTile, reg=terraceGhostRegion(hx,hy);
    if (reg){
      /* Its OUTLINE, the tile edges with no terrace on the other side: an
         outline per tile drew the whole terrace as a dashed grid. */
      if (reg.tiles.length>1200) return;
      const sides=[[1,0],[0,1],[-1,0],[0,-1]].map(([vx,vy])=>viewDirToWorld(vx,vy));
      cx.save(); cx.fillStyle='rgba(243,236,221,0.12)';
      const edges=[];
      for (const [x,y] of reg.tiles){
        const [sx,sy]=screenOf(x,y,W,H), c=[[sx+TILE_W/2,sy+TILE_H/2],[sx,sy+TILE_H],[sx-TILE_W/2,sy+TILE_H/2],[sx,sy]];
        cx.beginPath(); cx.moveTo(sx,sy); c.forEach(p=>cx.lineTo(p[0],p[1])); cx.closePath(); cx.fill();
        // view +x is the right->bottom edge, +y bottom->left, -x left->top, -y top->right
        sides.forEach(([dx,dy],i)=>{ if (!reg.has.has((x+dx)+','+(y+dy))) edges.push(c[i],c[(i+1)%4]); });
      }
      cx.beginPath();
      for (let i=0;i<edges.length;i+=2){ cx.moveTo(edges[i][0],edges[i][1]); cx.lineTo(edges[i+1][0],edges[i+1][1]); }
      cx.setLineDash([5,4]); cx.lineWidth=1.6; cx.strokeStyle='rgba(243,236,221,0.85)'; cx.stroke();
      cx.restore();
      return;
    }
    r=terraceTapRect(hx,hy);
  }
  if (!r) return;
  const bad=terraceGhostBad(r), d=terraceDraft(), st=wallStyle(d.w), lift=d.h*ELEV_STEP;
  const units=(r.x1-r.x0+1)+(r.y1-r.y0+1);
  const flat=[[r.x0,r.y0],[r.x1+1,r.y0],[r.x1+1,r.y1+1],[r.x0,r.y1+1]].map(([qx,qy])=>screenOfCorner(qx,qy,W,H));
  const poly=(pts,fill,stroke,dash)=>{ cx.beginPath(); pts.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1]));
    cx.closePath(); if (fill){ cx.fillStyle=fill; cx.fill(); }
    if (stroke){ cx.setLineDash(dash||[]); cx.strokeStyle=stroke; cx.lineWidth=1.6; cx.stroke(); cx.setLineDash([]); } };
  // a run of two edges meeting at corner i, as the wall painter takes it
  const run=(pts,i)=>[pts[(i+3)%4],pts[i],pts[(i+1)%4]];
  const walls=(pts,drop)=>{
    if (!st.face){ cx.fillStyle='rgba(107,90,68,0.85)';
      for (const [a,b] of [[pts[0],pts[1]],[pts[1],pts[2]]]){ cx.beginPath(); cx.moveTo(a[0],a[1]); cx.lineTo(b[0],b[1]);
        cx.lineTo(b[0],b[1]+drop); cx.lineTo(a[0],a[1]+drop); cx.closePath(); cx.fill(); } }
    else if (units>TERRACE_GHOST_UNITS){ cx.fillStyle=st.tone; cx.beginPath(); cx.moveTo(pts[0][0],pts[0][1]);
      pts.forEach(p=>cx.lineTo(p[0],p[1])); for (let i=pts.length-1;i>=0;i--) cx.lineTo(pts[i][0],pts[i][1]+drop);
      cx.closePath(); cx.fill(); }
    else drawWallRun(cx,pts,drop,st,7,units);
  };
  cx.save();
  if (bad.length){
    // refused whole: show where, and nothing of the box it will not build
    poly(flat,'rgba(196,58,44,0.12)','rgba(230,118,92,0.9)',[6,4]);
    if (bad.length<=400) for (const [x,y] of bad){ const [sx,sy]=screenOf(x,y,W,H);
      tileDiamond(cx,sx,sy,'rgba(196,58,44,0.42)',null); }
    cx.restore(); return;
  }
  cx.globalAlpha=0.72;
  if (d.h>0){
    const top=flat.map(p=>[p[0],p[1]-lift]);
    let lo=0; for (let i=1;i<4;i++) if (top[i][1]>top[lo][1]) lo=i;   // the corner nearest the camera
    walls(run(top,lo),lift);
    poly(top,'rgba(243,236,221,0.2)','rgba(243,236,221,0.9)',[6,4]);
  } else {
    const drop=-lift, floor=flat.map(p=>[p[0],p[1]+drop]);
    let hi=0; for (let i=1;i<4;i++) if (flat[i][1]<flat[hi][1]) hi=i;  // the far corner: its walls face us
    poly(flat,null,null); cx.save(); cx.clip();
    poly(floor,'rgba(40,48,32,0.35)',null);
    walls(run(flat,hi),drop);
    cx.restore();
    poly(flat,null,'rgba(243,236,221,0.9)',[6,4]);
  }
  cx.restore();
}
/* The flight a Steps tap would lay, before it is laid (stepsHover, set on
   pointermove from the edge nearest the pointer): each step a box at its height,
   its tread in the tread's colour and its camera-facing sides in the riser's;
   red where it would be refused, with the tile in the way marked. Over a flight,
   its outline, since a tap restyles all of it. Kept per aim, garden revision and
   draft, so a still pointer works nothing out. */
const stepsGhostCache={key:null,plan:null,flight:null};
function drawStepsGhost(cx,W,H){
  if (game.tool!=='steps' || typeof stepsHover==='undefined' || !stepsHover || !layerShown('landscape')) return;
  const d=stepDraft(), key=stepsHover.key+'|'+game.rev+'|'+d.w+'|'+d.tread+'|'+d.width;
  const c=stepsGhostCache;
  if (c.key!==key){ c.key=key;
    c.flight=stepsHover.flight ? stepFlightAt(stepsHover.x,stepsHover.y) : null;
    c.plan=stepsHover.flight ? null : stepFlightPlan(stepsHover,d); }
  const corners=(x,y,lift)=>[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([qx,qy])=>{ const q=screenOfCorner(qx,qy,W,H); return [q[0],q[1]-lift]; });
  const poly=(pts)=>{ cx.beginPath(); pts.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1])); cx.closePath(); };
  cx.save(); cx.lineJoin='round';
  if (c.flight){
    cx.setLineDash([5,4]); cx.lineWidth=1.6; cx.strokeStyle='rgba(243,236,221,0.9)';
    for (const [x,y] of c.flight.tiles){ poly(corners(x,y,elevationAt(x,y)*ELEV_STEP)); cx.stroke(); }
    cx.restore(); return;
  }
  const p=c.plan;
  if (!p || !p.tiles){
    // a single step already, or an edge too short: mark the edge that was aimed at
    if (p && p.aim){ const a=p.aim, lift=a.H*ELEV_STEP, n=a.n;
      const ex=a.hx+(n[0]>0?1:0), ey=a.hy+(n[1]>0?1:0), along=n[0]?[0,1]:[1,0];
      const q0=screenOfCorner(ex,ey,W,H), q1=screenOfCorner(ex+along[0],ey+along[1],W,H);
      cx.setLineDash([5,4]); cx.lineWidth=2.4; cx.strokeStyle='rgba(230,118,92,0.95)';
      cx.beginPath(); cx.moveTo(q0[0],q0[1]-lift); cx.lineTo(q1[0],q1[1]-lift); cx.stroke(); }
    cx.restore(); return;
  }
  const L=p.aim.L, st=wallStyle(d.w), pc=pathColor(d.tread), tread=(pc.tones&&pc.tones[1])||pc.fill;
  if (p.blocked){
    cx.setLineDash([6,4]); cx.lineWidth=1.5; cx.strokeStyle='rgba(230,118,92,0.9)'; cx.fillStyle='rgba(196,58,44,0.12)';
    for (const [x,y] of p.tiles){ poly(corners(x,y,L*ELEV_STEP)); cx.fill(); cx.stroke(); }
    if (onPlot(p.blocked.x,p.blocked.y)){ const [sx,sy]=screenOf(p.blocked.x,p.blocked.y,W,H);
      tileDiamond(cx,sx,sy,'rgba(196,58,44,0.45)',null); }
    cx.restore(); return;
  }
  const order=p.tiles.slice().sort((a,b)=>viewDepth(a[0],a[1])-viewDepth(b[0],b[1]));
  cx.globalAlpha=0.78;
  for (const [x,y,h] of order){
    const top=corners(x,y,h*ELEV_STEP), drop=(h-L)*ELEV_STEP;
    let lo=0; for (let i=1;i<4;i++) if (top[i][1]>top[lo][1]) lo=i;   // the corner nearest the camera
    cx.fillStyle=st.tone;
    for (const [a,b] of [[top[(lo+3)%4],top[lo]],[top[lo],top[(lo+1)%4]]]){
      cx.beginPath(); cx.moveTo(a[0],a[1]); cx.lineTo(b[0],b[1]); cx.lineTo(b[0],b[1]+drop); cx.lineTo(a[0],a[1]+drop); cx.closePath(); cx.fill(); }
    cx.fillStyle=tread; poly(top); cx.fill();
    cx.strokeStyle='rgba(243,236,221,0.9)'; cx.lineWidth=1.2; cx.stroke();
  }
  cx.restore();
}
/* Everything a Wall tap would face, before it is faced: every camera-facing face
   of the terrace or sunken patio under the pointer (wallTargetAt), tinted in the
   armed material, or dashed red with Bare earth armed where a wall would come
   off. A tap faces the whole of it, so the preview has to show the whole of it;
   it used to light only the one face under the pointer. Kept per hovered tile
   and garden revision (wallHoverCache), so a still pointer works nothing out. */
const wallHoverCache={key:null,t:null};
function drawWallFaceHover(cx,W,H){
  if (game.tool!=='wall' || !game.hoverTile || !layerShown('landscape')) return;
  const [hx,hy]=game.hoverTile, key=hx+','+hy+'|'+game.rev;
  if (wallHoverCache.key!==key){ wallHoverCache.key=key; wallHoverCache.t=wallTargetAt(hx,hy); }
  const t=wallHoverCache.t;
  if (!t || t.owners.length>2500) return;
  const st=wallStyle(wallDraft()), strip=!st.face;
  cx.save(); cx.lineWidth=1.5; cx.lineJoin='round';
  cx.strokeStyle=strip?'rgba(230,118,92,0.95)':'rgba(243,236,221,0.92)';
  cx.fillStyle=strip?'rgba(196,58,44,0.16)':st.tone;
  if (strip) cx.setLineDash([5,4]); else cx.globalAlpha=0.62;
  cx.beginPath();
  for (const [x,y] of t.owners) for (const f of wallFaceQuads(x,y,W,H)){
    cx.moveTo(f.a[0],f.a[1]); cx.lineTo(f.b[0],f.b[1]);
    cx.lineTo(f.b[0],f.b[1]+f.drop); cx.lineTo(f.a[0],f.a[1]+f.drop); cx.closePath();
  }
  cx.fill(); cx.globalAlpha=1; cx.stroke();
  cx.restore();
}
function drawToolDragMetric(cx,W,H){
  if (typeof toolDrag==='undefined' || !toolDrag) return;
  const label=toolDragMetricLabel(toolDrag);
  if (!label) return;
  const b=tileCenterScreen(toolDrag.cx||toolDrag.sx,toolDrag.cy||toolDrag.sy,W,H);
  const safe=typeof usableCanvasRect==='function'?usableCanvasRect():{left:8,top:8,right:VW-8,bottom:VH-8};
  const x=Math.max(safe.left/ZOOM+46,Math.min(safe.right/ZOOM-46,b[0]));
  const y=Math.max(safe.top/ZOOM+22,Math.min(safe.bottom/ZOOM-22,b[1]-28));
  drawSelMetricLabel(cx,x,y,label);
}
function overlayPlantAt(x,y){
  const k=`${x},${y}`;
  const p=game.plants[k]; if (p && !p.removed) return p;
  const b=game.bulbs[k]; if (b && !b.removed) return b;
  return null;
}
function plantHeightIn(p){
  const D=p && plantDef(p.s,p.v);
  if (!D) return 0;
  return D.heightIn || D.height || D.h || 36;
}
function drawMoistureOverlay(cx,W,H,x0,x1,y0,y1){
  const cols={dry:'rgba(224,168,86,0.38)',medium:'rgba(103,155,97,0.34)',moist:'rgba(74,142,174,0.42)'};
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const terr=terrainAt(x,y);
    const p=overlayPlantAt(x,y), D=p&&plantDef(p.s,p.v);
    const moist=terr&&terr.k==='water' ? 'moist' : D&&D.moist;
    if (!moist) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,cols[moist]||cols.medium,null);
  }
}
function drawHeightOverlay(cx,W,H,x0,x1,y0,y1){
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const p=overlayPlantAt(x,y); if (!p) continue;
    const h=plantHeightIn(p);
    const col = h>=96 ? 'rgba(92,66,122,0.46)'
      : h>=48 ? 'rgba(161,101,62,0.42)'
      : h>=24 ? 'rgba(191,151,73,0.38)'
      : 'rgba(125,164,104,0.34)';
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,col,null);
  }
}
function drawSelDimLine(cx,a,b,label,side){
  const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
  if (len<4) return;
  const ux=dx/len, uy=dy/len, nx=-dy/len, ny=dx/len;
  const off=20*side, tick=7, labelOff=13*side;
  const ax=a[0]+nx*off, ay=a[1]+ny*off;
  const bx=b[0]+nx*off, by=b[1]+ny*off;
  cx.save();
  cx.strokeStyle='#72c9ff';
  cx.lineWidth=3;
  cx.lineCap='round';
  cx.lineJoin='round';
  cx.beginPath();
  cx.moveTo(a[0]+nx*4*side,a[1]+ny*4*side); cx.lineTo(ax,ay);
  cx.moveTo(b[0]+nx*4*side,b[1]+ny*4*side); cx.lineTo(bx,by);
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
/* Where a moved selection may legally land, resolved once per POSITION rather
   than once per frame.

   Every part of this is a pure function of (the items, the offset, copy-or-move,
   the world) — and a drag changes the offset perhaps 60 times a second while the
   screen redraws at whatever the display runs at, so the overlay was rebuilding
   twelve Sets and twelve Maps over every selected tile, then re-running the
   whole placement rulebook per item, on frames where nothing about the answer
   had moved. game.rev is in the key because it bumps on any model mutation,
   which is the only other thing that can change a verdict. */
let selMoveValid={items:null,key:''};
function selectionMoveValidity(items,dx,dy,copy){
  const key=dx+','+dy+'|'+(copy?1:0)+'|'+game.rev+'|'+(game.plotRev||0);
  if (selMoveValid.items===items && selMoveValid.key===key) return selMoveValid;
  const ctx=selectionValidationContext(items,c=>[c.x+dx,c.y+dy],copy);
  const ok=new Array(items.length), dest=new Array(items.length);
  for (let i=0;i<items.length;i++){
    const c=items[i], nx=c.x+dx, ny=c.y+dy;
    ok[i]=selItemDestValid(c,nx,ny,ctx);
    dest[i]=selValidDest(nx,ny);
  }
  selMoveValid={items,key,ctx,ok,dest};
  return selMoveValid;
}
/* The plant the open card describes. Only shrubs were ever marked (their
   footprint, in the ground pass), so tapping one coneflower in a drift of
   coneflowers opened a card about ONE of them with nothing saying which.
   It is drawn OVER the planting, like the planting pulse and the selection:
   a ground ring under the plant was tried first and a mature clump covers its
   own tile completely — a 42in baptisia hid it without a trace. So the ring is
   sized to the plant's mature spread and encloses the clump it names, capped
   so a wide perennial cannot ring its neighbours too; a tree is ringed at the
   trunk, since its crown would ring half the garden. Two strokes, dark then
   light, so it reads over foliage, soil and pale gravel alike. */
function drawPlantFocusRing(ctx,W,H,tile){
  const k=tile[0]+','+tile[1], p=game.plants[k]||game.bulbs[k];
  const P=p && !p.removed && PLANTS[p.s] ? plantDef(p.s,p.v) : null;
  const reach=P && !isTreeDef(P) ? Math.max(1,Math.min(3,(P.spread||TILE_IN)/TILE_IN)) : 1.2;
  const [sx,sy]=screenOf(tile[0],tile[1],W,H), cyx=sy+TILE_H/2;
  const hw=TILE_W/2*reach, hh=TILE_H/2*reach;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx,cyx-hh); ctx.lineTo(sx+hw,cyx); ctx.lineTo(sx,cyx+hh); ctx.lineTo(sx-hw,cyx);
  ctx.closePath();
  ctx.lineJoin='round';
  ctx.strokeStyle='rgba(36,26,22,0.6)'; ctx.lineWidth=4.5; ctx.stroke();
  ctx.strokeStyle='rgba(240,183,101,0.95)'; ctx.lineWidth=2.2; ctx.stroke();
  ctx.restore();
}
/* ---------- what is already there (0.9.155) ----------
   Every tile carrying something marked existing (`ex`), kept on game.rev: a
   plant or a bulb on its own tile, a surface, a fence, a light, a pergola bay,
   and every tile of a placed piece's footprint. */
let existingTileCache={rev:-1, tiles:[]};
function existingTiles(){
  if (existingTileCache.rev===game.rev) return existingTileCache.tiles;
  const set=new Set();
  for (const layer of ['plants','bulbs','terrain','fences','lights','pergolas']){
    const m=game[layer]||{};
    for (const k in m){ const r=m[k]; if (r && !r.removed && r.ex) set.add(k); }
  }
  for (const id of SEL_FOOTPRINT_KEYS){
    const fp=SEL_FOOTPRINTS[id], m=game[fp.layer]||{};
    for (const k in m){ const r=m[k]; if (!r || r.removed || !r.ex) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=fp.size(r);
      for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++) set.add(xx+','+yy); }
  }
  existingTileCache={rev:game.rev, tiles:[...set].map(k=>{ const ci=k.indexOf(','); return [+k.slice(0,ci),+k.slice(ci+1)]; })};
  return existingTileCache.tiles;
}
/* Hatched, as a drawing hatches what exists: drawn while the Existing tool is
   in hand or the Layers menu's Existing overlay is on, over the planting, so a
   marked tree shows at its foot. */
function drawExistingOverlay(cx,W,H){
  if (game.tool!=='survey' && !game.layerVis.existing) return;
  const tiles=existingTiles(); if (!tiles.length) return;
  const HX=TILE_W*0.5, HY=TILE_H*0.5;
  cx.save();
  const shown=[];
  for (const [x,y] of tiles){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    shown.push([sx,sy]);
  }
  if (!shown.length){ cx.restore(); return; }
  const diamonds=()=>{ cx.beginPath();
    for (const [sx,sy] of shown){ const cy=sy+HY; cx.moveTo(sx,cy-HY); cx.lineTo(sx+HX,cy); cx.lineTo(sx,cy+HY); cx.lineTo(sx-HX,cy); cx.closePath(); } };
  diamonds(); cx.fillStyle='rgba(246,242,232,0.22)'; cx.fill();
  cx.save(); diamonds(); cx.clip();
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for (const [sx,sy] of shown){ if (sx-HX<x0) x0=sx-HX; if (sx+HX>x1) x1=sx+HX; if (sy<y0) y0=sy; if (sy+TILE_H>y1) y1=sy+TILE_H; }
  cx.strokeStyle='rgba(36,32,26,0.42)'; cx.lineWidth=1; cx.beginPath();
  for (let d=x0-(y1-y0);d<x1;d+=6){ cx.moveTo(d,y1); cx.lineTo(d+(y1-y0),y0); }
  cx.stroke(); cx.restore();
  diamonds(); cx.setLineDash([3,2]); cx.strokeStyle='rgba(250,246,236,0.85)'; cx.lineWidth=1.1; cx.stroke(); cx.setLineDash([]);
  cx.restore();
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
    const valid=selectionMoveValidity(items,dx,dy,selMove.copy);
    selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.12)','rgba(150,210,255,0.45)');
    for (let i=0;i<items.length;i++){
      const c=items[i], nx=c.x+dx, ny=c.y+dy, ok=valid.ok[i];
      const [sx,sy]=screenOf(nx,ny,W,H);
      tileDiamond(cx,sx,sy, ok?'rgba(120,210,130,0.28)':'rgba(220,90,70,0.42)',
        ok?'rgba(150,235,150,0.7)':'rgba(240,120,100,0.85)');
    }
    /* Ghost planting goes through the SPRITE CACHE, and the seed is the one the
       clump is standing on RIGHT NOW rather than the tile it is heading for.

       Drawn procedurally this was the most expensive thing in the app: every
       selected plant re-ran its whole recipe every frame, so a 241-plant marquee
       cost 30ms a frame in Chrome and 63ms in Firefox — 12.9fps and 5.6fps, both
       measured on the demo garden, against 165 for the same garden sitting
       still. It is also the one draw in the file that had a free cache sitting
       next to it: the source clumps are still in the scene while the move is
       uncommitted, so their sprites are already baked at this growth bucket, at
       this season, at this zoom. Keying the ghost on the DESTINATION tile seed
       is what made that unreachable — a new seed is a new sprite, and a drag is
       a new destination every frame, so a cached ghost would have baked a fresh
       set of sprites per frame and thrashed the budget rather than saving
       anything. Keyed on the source tile the ghost is a pure cache hit: measured
       30.2ms -> 0.9ms a frame (Chrome, 12.9 -> 96.8fps) with zero extra bakes.

       What it costs is that a clump's seeded variation no longer changes under
       the pointer as it crosses tiles. That variation is a rendering detail, not
       data, and the ghost is a 55%-alpha preview of a plant you are holding; the
       committed plant still takes its destination's seed on drop, exactly as
       before.

       The ghost asks for what the scene draws for that clump, growth included.
       A full-sun plant under a canopy is stunted in the scene and was not in the
       ghost, so the two landed in different growth buckets of one sprite slot and
       retired each other every frame: 18 such plants in a whole-plot marquee were
       ~1,750 bakes over 90 frames. A bulb that is underground draws nothing. */
    cx.save(); cx.globalAlpha=0.55;
    const ghostSprites=PSPRITE.active;
    for (let i=0;i<items.length;i++){
      const c=items[i];
      const nx=c.x+dx, ny=c.y+dy; if (!valid.dest[i]) continue;
      const [sx,sy]=screenOf(nx,ny,W,H);
      if (c.fence) drawFence(cx,W,H,season,c.fence,nx,ny);
      if (c.light) drawLightFixture(cx,W,H,season,c.light,nx,ny,game.layerVis.night);
      if (c.firepit) drawFirepit(cx,W,H,season,c.firepit,nx,ny,game.layerVis.night);
      if (c.waterFeature) drawWaterFeature(cx,W,H,season,c.waterFeature,nx,ny);
      if (c.support) drawSupport(cx,W,H,season,c.support,nx,ny);
      if (c.boulder) drawBoulder(cx,W,H,season,c.boulder,nx,ny);
      if (c.ornament) drawOrnament(cx,W,H,season,c.ornament,nx,ny);
      if (c.bulb){ const g=displayPlantGrowth(c.bulb);
        if (g>0.02) drawPlantMaybeCached(cx,sx,sy+TILE_H/2,c.bulb.s,g,season,
          (tileSeed(c.x,c.y)^0x9e37)>>>0,sway,c.bulb.v,undefined,ghostSprites); }
      /* the SOURCE tile's detail as well as its seed: detail is out of the
         sprite SLOT but in its key, so a ghost that disagreed with the scene
         about a hedge's neighbours would share the clump's slot, miss on the
         key, and the two draws would retire each other's sprite every frame —
         a bake apiece per frame for exactly the plants a cache helps most. */
      if (c.plant){ const g=displayPlantGrowth(c.plant)*(scene.stunted.has(c.y*GW+c.x)?STUNT_GROWTH:1);
        drawPlantMaybeCached(cx,sx,sy+TILE_H/2,c.plant.s,g,season,
          tileSeed(c.x,c.y),sway,c.plant.v,plantRenderDetail(c.x,c.y,c.plant,W,H),ghostSprites); }
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
  drawSelHandles(cx,W,H,game.sel);
}
/* The resize handles (selActiveHandles, commands.js). Drawn at a constant
   SCREEN size, so divided by ZOOM; a little larger on a finger, though the
   hit radius is larger still — the dot marks the spot, it is not the target.
   The handle being dragged is filled with the selection blue. */
function drawSelHandles(cx,W,H,r){
  const coarse=selHandleHitPx()===SEL_HANDLE_HIT_PX.coarse;
  const rad=(coarse?6.5:4.5)/ZOOM, active=selResize&&selResize.handle.id;
  cx.save();
  cx.lineWidth=1.6/ZOOM;
  for (const h of selActiveHandles(r,W,H)){
    cx.beginPath();
    if (h.sx&&h.sy) cx.arc(h.x,h.y,rad,0,Math.PI*2);
    else cx.rect(h.x-rad*0.8,h.y-rad*0.8,rad*1.6,rad*1.6);
    cx.fillStyle=h.id===active ? 'rgba(150,210,255,1)' : 'rgba(248,246,240,0.98)';
    cx.strokeStyle='rgba(30,70,110,0.95)';
    cx.fill(); cx.stroke();
  }
  cx.restore();
}
