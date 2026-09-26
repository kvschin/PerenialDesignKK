'use strict';

let snowFlakes = [];
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
const GROUND_JOB_BANDS=12;
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
/* Bake the next `n` bands of the job into the spare canvas. The camera and the
   rotation are borrowed for the call and put back in a finally — the
   gsBorrowCamera pattern — because the ground painters read both; the season
   travels in `amb`, which is all they read of it. */
function stepGroundJob(t,n){
  const j=groundJob; if (!j) return;
  const tB=dnow();
  const W=VW/ZOOM, H=VH/ZOOM, amb=AMBIENCE[j.season], s=DPR*ZOOM, bh=Math.ceil(j.h/GROUND_JOB_BANDS);
  const cx0=cam.x, cy0=cam.y, r0=game.rot;
  cam.x=j.camX; cam.y=j.camY; game.rot=j.rot;
  try{
    for (let i=0; i<n && j.band<GROUND_JOB_BANDS; i++, j.band++){
      const py=j.band*bh;
      bakeGroundRect(0,py,j.w,Math.min(bh,j.h-py),W,H,amb,t,j.MD,5,j.MD/s,groundSpareCtx);
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
function groundViewIdle(t){
  return !game.ffActive && typeof lastMeaningfulChange!=='undefined' && t-lastMeaningfulChange>GROUND_IDLE_MS
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
  // a pending Skip is waiting on this picture: two bands a frame, so the ground
  // is never what holds the turn back
  if (groundJob && !groundJobDone() && groundJobValid(MD)) stepGroundJob(t,ahead&&ahead.skip?2:1);
}
/* Is everything a pending Skip will show ready? The last frame drew every
   visible entity with its destination picture already baked (AHEAD.readyFor),
   and the destination ground is baked — or the wait has gone on long enough
   that stand-ins are the lesser evil. */
function skipPrepared(p){
  if (performance.now()-p.t0>SKIP_PREP_MAX_MS) return true;
  if (AHEAD.readyFor!==p.season) return false;
  const MD=Math.round(GROUND_MARGIN_CSS*DPR), gs=groundStructKey(p.season,game.rot);
  return groundKeyStruct===gs || (!!groundJob && groundJob.struct===gs && groundJobDone() && groundJobValid(MD));
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
/* One tile of ground. Extracted from paintGround's inner loop so the damage
   overlay (drawGroundDamage) paints a pending tile through the SAME code the
   bake will use for it a moment later — the two can't drift apart.
   `organic` false forces the per-tile material rendering, which is what the
   overlay wants: it is standing in for a blob that has not been traced yet. */
function paintGroundTile(ctx,x,y,W,H,amb,showLand,organic){
  const [sx,sy]=screenOf(x,y,W,H);
  const terrObj=showLand?terrainAt(x,y):null, terrRaw=terrObj&&terrObj.k;
  const terr = (organic && smoothableTerrain(terrRaw)) ? null : terrRaw;  // organic: grass base under blobs
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
  drawElevationSides(ctx,W,H,x,y,col);
  if (water) drawWaterTexture(ctx,sx,sy,x,y,terrObj,amb);
  else drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,col,rs,terrObj);
  drawElevationRim(ctx,sx,sy,elevationAt(x,y));
  if (!organic && terr) drawTileEdging(ctx,W,H,x,y);   // (ctx,W,H,x,y) like every other painter
  if (amb.snow && !path && !water && rs()>0.4){ ctx.fillStyle='rgba(238,242,248,0.7)';
    ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); }
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
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    if (!onPlot(x,y)) continue;   // off an irregular lot: draw nothing, same as beyond the plot rectangle
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W-ex||sx>W+TILE_W+ex||sy<-TILE_H*2-ex||sy>H+TILE_H*2+ex) continue;
    if (rect && (sx<rx0||sx>rx1||sy<ry0||sy>ry1)) continue;
    paintGroundTile(ctx,x,y,W,H,amb,showLand,organic);
  }
  if (organic) paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t);
  if (showLand) paintWallRuns(ctx,W,H);
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
/* ---- an EDIT re-bakes only what is on screen ----

   A brush stroke does not move the camera, and while the camera has not moved
   the baked margin is entirely OFF screen — that is the whole point of it. So
   an edit bake can leave the margin alone and repaint the viewport, which on a
   1440x900 desktop is 47% of the canvas. The margin then holds ground from
   before the edit, which is invisible until the camera moves, so the first
   camera move afterwards has to bake in full rather than scroll: `marginStale`
   says so, and both the trigger and the scroll test read it.

   This is the one lever available for painting. A stroke cannot scroll (the
   data changed, not the camera) and the organic contour genuinely can move
   anywhere along a traced arc, so repainting only the brushed tiles would be
   wrong; halving the area is what is provably safe. */
let groundMarginStale=false;
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
   flipping treatment four times along one run. */
function terrainUnitEdges(loop, set, solid, myRank, rankAt){
  const edges=[];
  const SOFT=0, HARD=1, COVERED=2;
  const classify=(key)=>{
    if (solid[key]){
      const r=rankAt[key];
      if (r<myRank) return SOFT;                 // laid over it: draw organic, on top
      return r>myRank ? COVERED : HARD;
    }
    const ci=key.indexOf(','), ox=+key.slice(0,ci), oy=+key.slice(ci+1);
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
      const over = cls===SOFT && !!solid[out];
      const oc=out.indexOf(','), ox=+out.slice(0,oc), oy=+out.slice(oc+1);
      const nrm = dx!==0 ? [0, oy===y ? 1 : -1] : [ox===x ? 1 : -1, 0];
      edges.push({a:[x,y], b:[nx,ny], hard:cls!==SOFT, covered:cls===COVERED, over, n:nrm});
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
  const out=[];
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
      const drop=h-elevationAt(outX,outY);
      const ci=inK.indexOf(','), ix=+inK.slice(0,ci), iy=+inK.slice(ci+1);
      const n=[outX-ix, outY-iy];
      /* A RIDGE face: the far side of this same tile also falls away, so the
         two faces are the two sides of ONE wall and the run is billed for one
         of them. That is the difference between a terrace, whose contour IS its
         wall, and a wall painted one tile wide, whose contour runs up one side
         and back down the other. */
      const ridge=elevationAt(ix-n[0], iy-n[1])<h;
      out.push({a:[x,y], b:[nx,ny], drop, n, ridge, wall:wallStyleAt(ix,iy), seed:tileSeed(ix,iy)});
      x=nx; y=ny;
    }
  }
  return out;
}
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
    if (h>0) addLevel(x,y);
    else if (h<0) for (const [dx,dy] of ELEV_DIRS){
      const nx=x+dx, ny=y+dy;
      if (nx>=0&&ny>=0&&nx<GW&&ny<GH && elevationAt(nx,ny)>h) rim.add(nx+','+ny);
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
        return prev.drop!==cur.drop || prev.wall!==cur.wall;
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
        if (pend && (pend[0].drop!==e.drop || pend[0].wall!==e.wall)) flush();
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
  return {pts:p, edges, h, drop:e.drop, wall:e.wall, seed:e.seed, tiles,
          billTiles:tiles*(weight/edges.length)};
}
/* Linear feet the planting list bills — the traced contour, not a count of
   exposed tile faces. Faces double-count a diagonal (every step contributes
   both of its sides), so the wall in the garden that prompted this was billed
   at 54 ft for a run of about 24. It is a number somebody quotes from. */
function wallRunFeet(run){ return run.billTiles*TILE_IN/12; }
/* The faced runs, drawn after the ground and its material blobs. A wall hangs
   DOWN from its terrace edge, so it has to come after the surface it belongs to
   or the blob would paint over its own coping; runs are ordered low terrace
   first so a higher one in front covers a lower one behind. (Known limit, the
   same one the blob pass has: a much higher terrace standing in front of a low
   wall can still overdraw it.)
   Facing is applied HERE rather than in the trace, so the cached contour — and
   the feet billed from it — do not change when the camera turns. */
function paintWallRuns(ctx,W,H){
  const runs=buildElevationRuns();
  if (!runs.length) return;
  const face=viewDirToWorld(1,0), side=viewDirToWorld(0,1);
  const shown=e=>(e.n[0]===face[0]&&e.n[1]===face[1])||(e.n[0]===side[0]&&e.n[1]===side[1]);
  for (const run of runs){
    const st=wallStyle(run.wall);
    if (!st.face) continue;                       // bare earth: drawn per tile above
    const lift=run.h*ELEV_STEP, fall=run.drop*ELEV_STEP;
    let piece=[];
    const emit=()=>{
      if (piece.length>0){
        const p=wallRunPoints(piece);
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
        const pts=p.map(([gx,gy])=>{
          const q=screenOfCorner(gx,gy,W,H), r=[q[0],q[1]-lift];
          if (r[0]<minX) minX=r[0]; if (r[0]>maxX) maxX=r[0];
          if (r[1]<minY) minY=r[1]; if (r[1]>maxY) maxY=r[1];
          return r; });
        if (!(maxX<-TILE_W || minX>W+TILE_W || maxY+fall<-TILE_H || minY>H+TILE_H*2))
          drawWallRun(ctx,pts,fall,st,run.seed,polyTiles(p));
      }
      piece=[];
    };
    for (const e of run.edges){ if (shown(e)) piece.push(e); else emit(); }
    emit();
  }
}
function buildTerrainRegions(){
  const sig=terrainRegionKey();
  if (terrainLoopCache.sig===sig && terrainLoopCache.terrainRef===game.terrain &&
      terrainLoopCache.elevRef===game.elevation) return terrainLoopCache.regions;
  const tTrace=dnow();   // cache miss only: this is the per-EDIT trace, not per-frame
  const solid={};  // every live terrain tile, any material — the hardness lookup
  const keyOf={};  // "x,y" -> kind|colour|elev (regions split at all three)
  const rankAt={}; // "x,y" -> TERRAIN_RANK: which of two materials is laid on top
  for (const k in game.terrain){ const o=game.terrain[k];
    if (!o || o.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    solid[k]=true;
    rankAt[k]=terrainRank(o.k);
    keyOf[k]=o.k+'|'+(o.c||'')+'|'+(elevationAt(x,y)||0);
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
    const ci=k.indexOf(',');
    const rank=terrainRank(o.k);
    const unit=traceOutlines(set).map(l=>terrainUnitEdges(l,set,solid,rank,rankAt));
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
    regions.push({ kind:o.k, c:o.c, rank, elev:elevationAt(+k.slice(0,ci),+k.slice(ci+1))||0, tiles:set,
      loops:unit.map(es=>terrainLoopArcs(es,useCount,saddle,terrainFillet(o.k))) });
  }
  // Elevation first — higher terraces paint over lower edges — then rank, so a
  // path lands on the bed it runs through rather than the other way round. The
  // soft-edge classification above assumes exactly this order.
  regions.sort((a,b)=>(a.elev-b.elev)||(a.rank-b.rank));
  terrainLoopCache={sig, terrainRef:game.terrain, elevRef:game.elevation, regions};
  dev('trace',tTrace);
  return regions;
}
function paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t){
  for (const region of buildTerrainRegions()){
    let vis=false;
    for (const kk of region.tiles){ const c=kk.indexOf(',');
      const tx=+kk.slice(0,c), ty=+kk.slice(c+1);
      if (tx>=x0-2&&tx<=x1+2&&ty>=y0-2&&ty<=y1+2){ vis=true; break; } }
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
    // transform, not the tile one (they only agree at rot 0 — see cornerToView)
    const proj=([gx,gy])=>{ const p=screenOfCorner(gx,gy,W,H); return [p[0],p[1]-lift]; };
    // fill the silhouette
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.fillStyle=base; ctx.fill('evenodd');
    // per-tile texture, clipped to the blob (grain/surface marks preserved)
    ctx.save();
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.clip('evenodd');
    for (const kk of region.tiles){ const c=kk.indexOf(',');
      const tx=+kk.slice(0,c), ty=+kk.slice(c+1);
      if (tx<x0-2||tx>x1+2||ty<y0-2||ty>y1+2) continue;
      const [sx,sy]=screenOf(tx,ty,W,H);
      const rs=mulberry(tileSeed(tx,ty));
      if (isWater) drawWaterTexture(ctx,sx,sy,tx,ty,o,amb,true);
      // skipBase: the region silhouette above already laid this material's base
      // across every one of these tiles, so the per-tile base fill would only
      // repaint it — a full-tile fill on every tile of every bed.
      else drawGroundTexture(ctx,sx,sy,tx,ty,region.kind,region.kind==='path',amb,base,rs,o,true);
    }
    ctx.restore();
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
   than resolving one material for the whole outline, and filling the bed is the
   gesture the tool is built around anyway. */
function regionEdging(region){
  if (region.edging!=null) return region.edging;
  let out='none';
  for (const k of region.tiles){
    const t=game.terrain[k];
    if (!t || t.removed) continue;
    const e=edgingStyleId(t.e); if (e==='none') continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (edgingDrawsAt(x,y)){ out=e; break; }       // an interior tile draws none
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
function strokeEdgingArc(ctx,arc,proj,st,edgePx){
  const pts=edgingCurvePoints(arc,proj);
  if (pts.length>=2) drawEdgingRun(ctx,pts,st,1,edgePx);
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
  FLOOR:40, HI_MS:6, LO_MS:2.5, hot:0, calm:0, plantMs:0,
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
  BAKE_MS:4, BAKE_CAP:24, bakeMs:0, spec:new Map() };
/* sprite-mode governor: engage the cache when the DRAW PHASE is measured
   heavy, not at a fixed plant count — the old 300-plant threshold left a
   typical 150–250 plant design fully procedural forever, even on a window
   where that costs 10ms+ a frame. Now a garden that's cheap on a fast desktop
   stays pristine procedural, and the same garden on a weak GPU or a huge
   window flips to sprites. Turning sprites ON makes draw fast, so the OFF
   decision can't read the live number (it would flap): it predicts what
   procedural WOULD cost — plantCount × a per-plant ms learned (EMA) while
   procedural was last active — and disengages only when that stays cheap.
   The 40-plant floor keeps genuinely light gardens procedural regardless.

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
    if (plantCount>20 && plantMs>0){
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
  PSPRITE.bytes-=e.bytes; PSPRITE.map.delete(k);
  if (e.slot!==undefined && PSPRITE.slot.get(e.slot)===k) PSPRITE.slot.delete(e.slot);
  const sk=k.slice(k.indexOf('|')+1);
  if (PSPRITE.spec.get(sk)===k) PSPRITE.spec.delete(sk);
}
function pspriteFrame(){                        // once per render: age the cache
  PSPRITE.frame++; PSPRITE.rendered=0; PSPRITE.bakeMs=0; PSPRITE.scale=pspriteScale();
  // Evict only sprites NOT drawn last frame (off-screen), oldest first, down to
  // budget — never the visible set. This is what stops the cache thrashing and
  // flickering when the working set is large (e.g. a dense garden on retina):
  // memory may overshoot to hold everything on screen, but it never re-renders
  // a visible plant it just discarded.
  // Look-ahead renews leases in place, so a protected entry can precede stale
  // ones. Skip it rather than ending the sweep before those can be reclaimed.
  if (PSPRITE.bytes>PSPRITE.MEM) for (const [k,e] of PSPRITE.map){
    if (PSPRITE.bytes<=PSPRITE.MEM) break;
    if (e.used>=PSPRITE.frame-1) continue;
    retirePlantSprite(k,e);
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
  const authoredHalf=H*Math.max(0,L.sideScale||0);
  const herbHalf=P.form==='sotol'
    ? Math.max(H*0.62,H*(L.leafLen||0.82)*1.1)
    : H*0.62*Math.max(1,grassW);
  const halfW=(woody?Math.max(canopy*0.62,H*0.5,authoredHalf):Math.max(herbHalf,authoredHalf))+18;
  // Cloud grasses can throw a seed veil substantially above their nominal
  // height. Size its sprite for the tallest panicle plus cloud rather than
  // clipping tall, airy forms such as Molinia 'Transparent'.
  const artH=plantArtTop(P)*(0.25+0.75*growth);
  const herbTop=P.form==='cloudgrass'
    ? Math.max(H*1.12, H*1.05*(L.cloudTop||0.92)+(L.cloudHeight||11)+6)
    : P.form==='sotol' ? artH*1.05
    : artH*1.12;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):herbTop)+26;
  // Everything a plant paints BELOW its placement point — the cast ground
  // shadow, and a weeping conifer's cascade — so the cached and live procedural
  // versions do not change silhouette when the governor flips. `growth` here is
  // the same value drawPlant is handed, since the shadow scales with it.
  const below=plantDrawBelow(P,growth,H)+8;
  return {halfW, top, bot:Math.max(18,Number.isFinite(below)?below:18)};
}
function makePlantSprite(key,gB,bB,season,seed,variant,detail){
  const P=plantDef(key,variant), growth=gB/8;
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
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); c2.setTransform(s,0,0,s,halfW*s,top*s);
  const spriteDetail=Object.assign({},detail||{},{bloomFallback:true});
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,spriteDetail); // still (sway 0), bucketed bloom
  return { cv, ox:halfW, oy:top, s, want, capped:s<want, bytes:pw*ph*4 };
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
   Season is safe to bake because it derives from absDay(), which sceneKey
   already carries. */
function bakePlantKeyParts(rec,key,variant,season,seed,detail){
  rec.kSlot=seed+'|'+key+'|'+(variant||'')+'|'+season;
  rec.kTail='|'+(detail?JSON.stringify(detail):'');
  rec.sv=key+'|'+(variant||'');
  rec.hasBloom=!!bloomAppearanceFor(plantDef(key,variant),season);
}
/* bloomLevel is a pure function of the species and the clock, so within one
   frame every clump of a species has the same answer — 532 calls collapsing to
   one per species (0.324us each, 0.17ms a frame). Keyed on the record's baked
   `sv` so the lookup allocates nothing, and cleared per frame off pspriteFrame's
   counter, which increments exactly once per render. */
let bloomMemo=new Map(), bloomMemoFrame=-1;
function bloomLevelForFrame(sv,key,variant){
  if (bloomMemoFrame!==PSPRITE.frame){ bloomMemoFrame=PSPRITE.frame; bloomMemo.clear(); }
  let v=bloomMemo.get(sv);
  if (v===undefined){ v=bloomLevel(key,variant); bloomMemo.set(sv,v); }
  return v;
}
function drawPlantMaybeCached(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites,rec){
  if (!useSprites || PSPRITE.off){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  // a caller with no record (or one from before this frame's scene) pays the old price
  if (!rec || rec.kSlot===undefined) { rec=rec||{}; bakePlantKeyParts(rec,key,variant,season,seed,detail); }
  const gB=gbucket(growth,9);
  const bB=rec.hasBloom?gbucket(bloomLevelForFrame(rec.sv,key,variant),4):0;
  const kk=rec.kSlot+'|'+gB+'|'+bB+rec.kTail;
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
       stand-in would outlive the moment it stood in for. */
    const spent=!game.photo && (PSPRITE.bakeMs>=PSPRITE.BAKE_MS || PSPRITE.rendered>=PSPRITE.BAKE_CAP);
    const standKey=spent ? (e ? kk : plantStandInKey(kk,slot)) : null;
    if (standKey){
      const s=PSPRITE.map.get(standKey);
      PSPRITE.map.delete(standKey); s.used=PSPRITE.frame; PSPRITE.map.set(standKey,s);   // LRU, like any hit
      blitPlantSprite(ctx,s,bx,by,sway);
      return;
    }
    if (PSPRITE.rendered<PSPRITE.BUDGET){
      const t0=performance.now();
      const ne=makePlantSprite(key,gB,bB,season,seed,variant,detail);
      PSPRITE.bakeMs+=performance.now()-t0;
      if (ne){ if (e) PSPRITE.bytes-=e.bytes; e=ne; PSPRITE.rendered++; PSPRITE.bytes+=e.bytes;
        PSPRITE.spec.set(kk.slice(kk.indexOf('|')+1),kk); }
    }
    if (!e){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
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
  e.used=PSPRITE.frame; e.slot=slot;   // carried so eviction can clear the index
  PSPRITE.map.set(kk,e);
  blitPlantSprite(ctx,e,bx,by,sway);
}
function blitPlantSprite(ctx,e,bx,by,sway){
  const dw=e.cv.width/e.s, dh=e.cv.height/e.s, lx=bx-e.ox, ly=by-e.oy;
  if (sway){
    ctx.save(); ctx.translate(bx,by); ctx.transform(1,0,sway*0.05,1,0,0); ctx.translate(-bx,-by);
    ctx.drawImage(e.cv,lx,ly,dw,dh); ctx.restore();
  } else ctx.drawImage(e.cv,lx,ly,dw,dh);
}
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
   A Skip is the one turn the clock does not run up to, so it gets a lead of
   its own (skipAheadTarget, ui.js): the Skip WAITS until the frame before has
   drawn every visible clump with its destination picture ready (`readyFor`),
   then lands in one frame. It has no crossfade to hide stand-ins under — it is
   the palette-comparison control — so without that wait a Skip showed the old
   season in plants and ground, turning over from the top of the screen down,
   because bakes happen in drawing order, back to front. `short` counts the
   clumps a frame left for later; `epoch` moves whenever the destination does,
   so a clump marked done for one lead is checked again (and its lease renewed)
   for the next. */
const AHEAD={season:null, at:0, ms:0, BUDGET_MS:2, MAX_MS:6, SKIP_MS:16, budget:2, LEASE:1500,
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
function aheadBakePlant(e){
  const next=AHEAD.season;
  if (e.aheadFor===AHEAD.epoch || e.kSlot===undefined) return;
  if (AHEAD.ms>=AHEAD.budget){ AHEAD.short++; return; }
  if (PSPRITE.bytes>PSPRITE.MEM*1.5) return;   // a garden whose visible set nearly fills the cache turns progressively
  const t0=performance.now();
  // growth and bloom as they will be just after the boundary: borrow the clock
  const was=game.elapsedMs, susp=game.clockSuspended;
  let g, bl;
  game.elapsedMs=AHEAD.at+DAY_MS*0.02; game.clockSuspended=true;
  try{ g=displayPlantGrowth(e.p)*(e.stunt?0.45:1); bl=bloomLevel(e.p.s,e.p.v); }
  finally{ game.elapsedMs=was; game.clockSuspended=susp; }
  e.aheadFor=AHEAD.epoch;
  if (g<=0.02) return;                         // not up yet in the coming season
  const gB=gbucket(g,9), bB=bloomAppearanceFor(plantDef(e.p.s,e.p.v),next)?gbucket(bl,4):0;
  const cut=e.kSlot.lastIndexOf('|'), slot=e.kSlot.slice(0,cut+1)+next;
  const kk=slot+'|'+gB+'|'+bB+e.kTail;
  const have=PSPRITE.map.get(kk);
  if (have){ have.used=Math.max(have.used||0,PSPRITE.frame+AHEAD.LEASE); return; }
  const ne=makePlantSprite(e.p.s,gB,bB,next,e.seed,e.p.v,e.detail);
  AHEAD.ms+=performance.now()-t0;
  if (!ne) return;
  // whatever this clump held in that season before (last year's) is dead now
  const old=PSPRITE.slot.get(slot);
  if (old!==undefined && old!==kk){ const d=PSPRITE.map.get(old); if (d) retirePlantSprite(old,d); }
  ne.used=PSPRITE.frame+AHEAD.LEASE; ne.slot=slot;
  PSPRITE.map.set(kk,ne); PSPRITE.slot.set(slot,kk); PSPRITE.bytes+=ne.bytes;
  PSPRITE.spec.set(kk.slice(kk.indexOf('|')+1),kk);
}
function aheadBakeStruct(e,W,H,lit){
  const next=AHEAD.season;
  if (e.aheadFor===AHEAD.epoch) return;
  if (AHEAD.ms>=AHEAD.budget){ AHEAD.short++; return; }
  e.aheadFor=AHEAD.epoch;
  const spec=structSpriteSpec(e); if (!spec) return;
  const kk=spec.key+'|'+next+'|'+game.rot+'|'+(lit?1:0);   // drawStructMaybeCached's key, next season
  const have=SSPRITE.map.get(kk);
  if (have){ have.used=Math.max(have.used||0,SSPRITE.frame+AHEAD.LEASE); return; }
  const t0=performance.now();
  const ns=makeStructSprite(e,spec,next,W,H,lit);
  AHEAD.ms+=performance.now()-t0;
  if (!ns) return;
  ns.used=SSPRITE.frame+AHEAD.LEASE;
  SSPRITE.map.set(kk,ns); SSPRITE.bytes+=ns.bytes;
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
  SSPRITE.frame++; SSPRITE.rendered=0; SSPRITE.scale=ssprScale();
  // evict only what was NOT drawn last frame, oldest first — never the visible
  // set, so the cache cannot thrash or flicker (the PSPRITE rule)
  if (SSPRITE.bytes>SSPRITE.MEM) for (const [k,e] of SSPRITE.map){
    if (SSPRITE.bytes<=SSPRITE.MEM) break;
    if (e.used>=SSPRITE.frame-1) continue; // renewed look-ahead leases need not be last in the Map
    SSPRITE.bytes-=e.bytes; SSPRITE.map.delete(k);
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
    case SCENE_K.PERGOLA: drawPergola(ctx,W,H,season,e.pg,e.x,e.y); return;
    case SCENE_K.BOULDER: drawBoulder(ctx,W,H,season,e.b,e.x,e.y); return;
    case SCENE_K.PET:{
      const [sx,sy]=screenOf(e.x,e.y,W,H);
      drawPet(ctx,sx,sy+TILE_H/2,e.p,1); return;
    }
    case SCENE_K.POT:  drawPot(ctx,W,H,season,e.p,e.x,e.y); return;
    case SCENE_K.SEAT: drawSeat(ctx,W,H,season,e.s,e.x,e.y); return;
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
      const sz=boulderTileSize(e.b), slope=(ELEV_MAX-ELEV_MIN)*ELEV_STEP/2;
      return {w:sz.w, h:sz.h, up:slope+12, pad:TILE_W*0.2, down:slope+12};
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
    case SCENE_K.BOULDER:
      // shape comes from tileSeed, so two boulders of one type differ
      return Object.assign({key:'O|'+structRecordSig(e.b)+'|'+tileSeed(e.x,e.y)}, box);
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
    case SCENE_K.PERGOLA:{
      /* Like a fence, it reads OUTSIDE its own record: which neighbours it
         connects to decides the beams, and pergolaPostHere decides the posts.
         ASK that function rather than restating its rule -- restating the
         fence's is how a cached fence loses its posts. */
      const x=e.x, y=e.y;
      const nb=(pergolaNeighbor(x+1,y)?1:0)|(pergolaNeighbor(x-1,y)?2:0)|
               (pergolaNeighbor(x,y+1)?4:0)|(pergolaNeighbor(x,y-1)?8:0);
      const ax=pergolaRunAxis(x,y), post=pergolaPostHere(x,y)?1:0;
      const ev=elevationAt(x,y)+'.'+elevationAt(x+1,y)+'.'+elevationAt(x-1,y)+
               '.'+elevationAt(x,y+1)+'.'+elevationAt(x,y-1);
      return Object.assign({key:'G|'+structRecordSig(e.pg)+'|'+nb+'|'+ax[0]+','+ax[1]+
        '|'+post+'|'+ev}, box);
    }
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
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); if (!c2) return null;
  const [sx,sy]=structAnchor(e,W,H);
  /* Bake with the CURRENT camera and translate it back out: the draws compute
     their own screen position through screenOf, so shifting the origin by the
     anchor is what makes the result camera-independent. */
  c2.setTransform(s,0,0,s,-b.left*s,-b.top*s);
  c2.translate(-sx,-sy);
  drawStructEnt(c2,e,W,H,season,lit);
  return {cv, ox:b.left, oy:b.top, s, want, capped:s<want, bytes:pw*ph*4};
}
// blit a cached structure if we can, else draw it live — never drop one
function drawStructMaybeCached(e,W,H,season,lit,ctx=cx){
  if (SSPRITE.off || !SSPRITE.active){ drawStructEnt(ctx,e,W,H,season,lit); return; }
  const spec=structSpriteSpec(e);
  if (!spec){ drawStructEnt(ctx,e,W,H,season,lit); return; }
  const kk=spec.key+'|'+season+'|'+game.rot+'|'+(lit?1:0);
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
    if (SSPRITE.rendered<SSPRITE.BUDGET){
      const ns=makeStructSprite(e,spec,season,W,H,lit);
      if (ns){ if (sp) SSPRITE.bytes-=sp.bytes; sp=ns; SSPRITE.rendered++; SSPRITE.bytes+=ns.bytes; }
    }
    if (!sp){ SSPRITE.fell++; drawStructEnt(ctx,e,W,H,season,lit); return; }
  }
  if (had) SSPRITE.hits++; else SSPRITE.misses++;
  if (SSPRITE.map.has(kk)) SSPRITE.map.delete(kk);   // LRU: re-insert at the end
  sp.used=SSPRITE.frame;
  SSPRITE.map.set(kk,sp);
  const [ax,ay]=structAnchor(e,W,H);
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
  for (const p of POT_STYLES) for (let f=0;f<4;f++) for (const sz of POT_SIZES)
    cases.push({name:'POT:'+p.id+'/'+sz.id+'/f'+f, kind:SCENE_K.POT, field:'p',
      rec:{style:p.id,size:potSizeFor(p.id,sz.id),face:f,t:1},
      size:s=>potTileSize(s), draw:(c,s)=>drawPot(c,W,H,season,s,x,y)});
  for (const b of BOULDER_TYPES)
    cases.push({name:'BOULDER:'+b.id, kind:SCENE_K.BOULDER, field:'b', rec:{type:b.id,t:1},
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
  for (const lt of LIGHT_TYPES) for (const fi of lightTypeFinishes(lt.id))
    cases.push({name:'LIGHT:'+lt.id+'/'+fi.id, kind:SCENE_K.LIGHT, field:'l',
      rec:{type:lt.id,tone:'warm',finish:fi.id,t:1},
      size:()=>({w:1,h:1}), draw:(c,s)=>drawLightFixture(c,W,H,season,s,x,y,false)});
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
  for (const b of BOULDER_TYPES)
    cases.push({name:'BOULDER:'+b.id, rec:{type:b.id,t:1},
      size:s=>boulderTileSize(s), draw:(c,s)=>drawBoulder(c,W,H,season,s,x,y)});
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
        const ink=(l+rr)/2-PAD+ax, want=groundCenterRot(x,y,sz,W,H)[0], dx=Math.abs(ink-want);
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
   over the whole canvas. The clock is paused, because sceneKey carries absDay()
   and a long run ticks the day and rebuilds the scene underneath the harness.
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
        const b=settle();
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
    const c=sp.cv.getContext('2d'); if (!c || typeof c.getImageData!=='function') continue;
    const w=sp.cv.width, h=sp.cv.height;
    let d; try{ d=c.getImageData(0,0,w,h).data; }catch(_){ continue; }
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
   sit in the key via absDay(). In-place edits invalidate via game.rev
   (markModelChanged in setTile/clearTile/addHouse/applySnapshot);
   wholesale map swaps (load / new garden / legacy fixups) are caught by object
   identity in sceneStale. Side fix: stunting is now computed against the FULL
   tree list — the old per-frame pass used the viewport-culled list, so an
   off-screen tree's shade stopped stunting a visible plant. */
const SCENE_K={FENCE:0,LIGHT:1,FIREPIT:2,BOULDER:3,HOUSE:4,BULB:5,PLANT:6,GHOST:7,BUILDING:8,BUILDING_OUTLINE:9,PET:10,POT:11,SEAT:12,WATERF:13,SUPPORT:14,PERGOLA:15};
let scene={key:null, refs:null, ents:[], shadeTrees:[], futureShadeTrees:[], shrubs:[], lights:[], firepits:[], boulders:[]};
function sceneLayerBits(){
  return (layerShown('perennials')?1:0)|(layerShown('woody')?2:0)|
    (layerShown('bulbs')?4:0)|(layerShown('landscape')?8:0);
}
// sceneRev, not game.rev: this list holds plants, bulbs, hardscape, houses and
// buildings — no terrain. Keyed on game.rev, every painted path tile rebuilt it
// (O(all plants)) for a layer it does not contain. See LAYER_CACHES in world.js
// for what bumps it, and why elevation still does.
function sceneKey(){
  return game.sceneRev+'|'+game.rot+'|N'+effectiveSiteNorthDeg()+'|'+absDay()+'|'+sceneLayerBits()+'|'+GW+'x'+GH+
    '|'+(establishedPreviewActive()?1:0);   // preview flips shade trees + stunting
}
function sceneStale(skey){
  const r=scene.refs;
  return scene.key!==skey || !r ||
    r.plants!==game.plants || r.bulbs!==game.bulbs || r.fences!==game.fences ||
    r.lights!==game.lights || r.firepits!==game.firepits || r.boulders!==game.boulders || r.pets!==game.pets || r.houses!==game.houses || r.buildings!==game.buildings ||
    r.waterFeatures!==game.waterFeatures || r.supports!==game.supports ||
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
function buildScene(W,H){
  const ents=[], shadeTrees=[], futureShadeTrees=[], shrubs=[], lights=[], firepits=[], boulders=[];
  const plantRecs=[];
  for (const k in game.plants){ const p=game.plants[k];
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
    const rec={d:dep, kind:SCENE_K.PLANT, bx0:x,bx1:x,by0:y,by1:y,
      x,y,p, seed:tileSeed(x,y), detail:pDetail, stunt:false};
    plantRecs.push(rec); ents.push(rec);
  }
  // full-sun plants under an ACTIVE canopy render stunted; day-granular, so
  // it lives here (against ALL trees, not just the on-screen ones)
  ensureShadeMap();
  for (const rec of plantRecs){
    const P2=PLANTS[rec.p.s];
    if (P2 && P2.sun!=='part' && !isTreeDef(P2))
      rec.stunt=shadeScoreAt(rec.x,rec.y)>=SHADE_ACTIVE_SCORE;
  }
  if (layerShown('bulbs')) for (const k in game.bulbs){ const p=game.bulbs[k];
    if (p.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const po=potAt(x,y);
    ents.push({d:(po?potPlantDepth(po):plantDepth(x,y,p))+0.25, kind:SCENE_K.BULB,
      bx0:x,bx1:x,by0:y,by1:y,
      x,y,p, seed:(tileSeed(x,y)^0x9e37)>>>0});
  }
  if (layerShown('landscape')){
    for (const k in game.fences){ const f=game.fences[k];
      if (f.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      ents.push({d:viewDepth(x,y)+0.34, kind:SCENE_K.FENCE, bx0:x,bx1:x,by0:y,by1:y, x,y,f});
    }
    for (const k in game.lights){ const l=game.lights[k];
      if (!l || l.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      const rec={d:viewDepth(x,y)+0.36, kind:SCENE_K.LIGHT, bx0:x,bx1:x,by0:y,by1:y, x,y,l};
      ents.push(rec); lights.push(rec);
    }
    for (const k in game.firepits){ const f=game.firepits[k];
      if (!f || f.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=firepitTileSize(f);
      const rec={d:footprintDrawDepth(x,y,sz.w,sz.h)+0.37, kind:SCENE_K.FIREPIT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,f};
      ents.push(rec); firepits.push(rec);
    }
    /* A support sorts just BEHIND its own climber's depth, so the plant draws
       in front of the frame it is growing on rather than through it. */
    for (const k in game.supports||{}){ const sp=game.supports[k];
      if (!sp || sp.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=supportTileSize(sp);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.30, kind:SCENE_K.SUPPORT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,sp});
    }
    /* A pergola sorts just BEHIND a climber's depth, for the same reason a
       support does: the plant grows in FRONT of the frame it is on. */
    for (const k in game.pergolas||{}){ const pg=game.pergolas[k];
      if (!pg || pg.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      ents.push({d:viewDepth(x,y)+0.28, kind:SCENE_K.PERGOLA, bx0:x,bx1:x,by0:y,by1:y, x,y,pg});
    }
    for (const k in game.waterFeatures||{}){ const wf=game.waterFeatures[k];
      if (!wf || wf.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=waterFeatureTileSize(wf);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.375, kind:SCENE_K.WATERF,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,wf});
    }
    for (const k in game.boulders){ const b=game.boulders[k];
      if (!b || b.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=boulderTileSize(b);
      const rec={d:footprintDrawDepth(x,y,sz.w,sz.h)+0.38, kind:SCENE_K.BOULDER,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,b};
      ents.push(rec); boulders.push(rec);
    }
    for (const k in game.pets){ const p=game.pets[k];
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
      if (!p || p.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=potTileSize(p);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.24, kind:SCENE_K.POT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,p});
    }
    for (const k in game.seats||{}){ const s2=game.seats[k];
      if (!s2 || s2.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=seatTileSize(s2);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.39, kind:SCENE_K.SEAT,
        bx0:x,bx1:x+sz.w-1,by0:y,by1:y+sz.h-1, x,y,s:s2});
    }
    for (const b of game.buildings||[]){
      const r=buildingBounds(b); if (!r) continue;
      for (const p of buildingTiles(b)) ents.push({d:viewDepth(p[0],p[1])+0.345,kind:SCENE_K.BUILDING,
        bx0:p[0],bx1:p[0],by0:p[1],by1:p[1],b,x:p[0],y:p[1]});
      ents.push({d:buildingDrawDepth(b),kind:SCENE_K.BUILDING_OUTLINE,
        bx0:r.x0,bx1:r.x1,by0:r.y0,by1:r.y1,b});
    }
    for (const hh of game.houses)
      ents.push({d:houseDrawDepth(hh), kind:SCENE_K.HOUSE,
        bx0:hh.x,bx1:hh.x+hh.w-1,by0:hh.y,by1:hh.y+hh.h-1, h:hh});
  }
  ents.sort((a,b)=>a.d-b.d);
  const season=calClock().season;      // safe to bake: sceneKey carries absDay()
  for (const e of ents){
    setEntScreenBounds(e);
    if (e.kind===SCENE_K.PLANT || e.kind===SCENE_K.BULB)
      bakePlantKeyParts(e,e.p.s,e.p.v,season,e.seed,e.detail);
  }
  scene={key:sceneKey(), refs:{plants:game.plants,bulbs:game.bulbs,fences:game.fences,
    lights:game.lights,firepits:game.firepits,boulders:game.boulders,pets:game.pets,pots:game.pots,seats:game.seats,waterFeatures:game.waterFeatures,supports:game.supports,pergolas:game.pergolas,houses:game.houses,buildings:game.buildings},
    ents, shadeTrees, futureShadeTrees, shrubs, lights, firepits, boulders};
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
    case SCENE_K.BOULDER:
    case SCENE_K.PET:
    case SCENE_K.POT:
    case SCENE_K.SEAT:
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
      const g=displayPlantGrowth(e.p); if (g<=0.02) return 0;   // underground
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,W,H);
      drawPlantMaybeCached(ctx,sx,sy+TILE_H/2,e.p.s,g,season,e.seed,sway,e.p.v,undefined,useSprites,e);
      return 1;
    }
    case SCENE_K.PLANT:{
      let g=displayPlantGrowth(e.p); if (e.stunt) g*=0.45;      // struggling under canopy
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,W,H);
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
      const growth=displayPlantGrowth(e.p)*(e.stunt?0.45:1);
      if (growth<=0.02) continue;
      const b=plantDrawBox(plantDef(e.p.s,e.p.v),e.p.s,growth);
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,0,0), base=sy+TILE_H/2;
      include(sx-b.halfW,base-b.top,sx+b.halfW,base+b.bot);
    } else include(e.ox0,e.oy0,e.ox1,e.oy1);
  }
  return {x0,y0,x1,y1};
}
function captureGardenPortrait(){
  const cv=document.createElement('canvas');
  cv.width=GARDEN_PORTRAIT_WIDTH; cv.height=GARDEN_PORTRAIT_HEIGHT;
  const ctx=cv.getContext('2d'); if (!ctx) return null;
  const t0=dnow(), prior={x:cam.x,y:cam.y,rot:game.rot,preview:game.previewMode,
    vis:game.layerVis,north:game.siteNorthPreviewDeg,scene,elapsed:game.elapsedMs,suspended:game.clockSuspended};
  try{
    // Freeze just this composition even if called with the garden clock live.
    game.elapsedMs=elapsedGameMs(); game.clockSuspended=true;
    game.rot=0; game.previewMode='established'; game.layerVis=defaultLayerVis(); game.siteNorthPreviewDeg=null;
    cam.x=0; cam.y=0;
    buildScene(0,0);
    const b=gardenPortraitBounds(), pad=18;
    const scale=Math.min((cv.width-2*pad)/Math.max(1,b.x1-b.x0),(cv.height-2*pad)/Math.max(1,b.y1-b.y0));
    const W=cv.width/scale, H=cv.height/scale;
    cam.x=(b.x0+b.x1)/2; cam.y=(b.y0+b.y1)/2-H*0.26;
    const season=calClock().season, amb=AMBIENCE[season];
    ctx.setTransform(scale,0,0,scale,0,0);
    drawSeasonSky(ctx,W,H,season,amb);
    paintGround(ctx,0,GW-1,0,GH-1,W,H,amb,0);
    const shadeMap=ensureShadeMap();
    if (shadeMap.hasShade) for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
      if (!onPlot(x,y)) continue;
      const a=shadeMap.activeAlpha[y*GW+x]; if (a<=0) continue;
      const [sx,sy]=screenOf(x,y,W,H);
      tileDiamond(ctx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
    }
    for (const e of scene.ents) drawSceneEnt(e,W,H,season,0,false,ctx);
    applySeasonLighting(ctx,W,H,amb,season);
    return {v:1,day:absDay(),image:cv.toDataURL('image/jpeg',0.86)};
  } finally {
    cam.x=prior.x; cam.y=prior.y; game.rot=prior.rot; game.previewMode=prior.preview;
    game.layerVis=prior.vis; game.siteNorthPreviewDeg=prior.north; scene=prior.scene;
    game.elapsedMs=prior.elapsed; game.clockSuspended=prior.suspended;
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
function resetSeasonFade(){ seasonFade.active=false; seasonFade.cv=null; seasonFade.last=null; seasonFade.suppressOnce=false; }
function suppressNextSeasonFade(){ seasonFade.active=false; seasonFade.cv=null; seasonFade.suppressOnce=true; }
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
    fcx.clearRect(0,0,seasonFade.cv.width,seasonFade.cv.height);
    fcx.drawImage(cnv,0,0);                     // canvas still shows the OLD season here
    seasonFade.t0=t; seasonFade.active=true;
  }
  seasonFade.suppressOnce=false;
  seasonFade.last=season;
}
function drawSeasonFade(t){
  if (!seasonFade.active) return;
  const f=(t-seasonFade.t0)/SEASON_FADE_MS;
  if (f>=1 || !seasonFade.cv || seasonFade.cv.width!==cnv.width || seasonFade.cv.height!==cnv.height){
    seasonFade.active=false; seasonFade.cv=null; return;   // done, or resized mid-fade
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
function beginGardenOpen(){
  gardenOpening={ready:false, key:null};
  document.body.classList.add('garden-opening-active');
  document.getElementById('gardenOpening').classList.remove('hidden');
  document.getElementById('hud').inert=true;
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
      stepGroundJob(t,1);
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
  // slow, even after the normal opaque sky repaint. A disposable surface
  // keeps preparation separate; the live canvas first receives a full frame.
  if (!o.cv){ o.cv=document.createElement('canvas'); o.ctx=o.cv.getContext('2d'); }
  if (o.cv.width!==cnv.width) o.cv.width=cnv.width;
  if (o.cv.height!==cnv.height) o.cv.height=cnv.height;
  o.ctx.setTransform(1,0,0,1,0,0);
  o.ctx.clearRect(0,0,o.cv.width,o.cv.height);
  o.ctx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  const start=performance.now();
  let count=0;
  while (o.index<o.ents.length && count<PSPRITE.BAKE_CAP
      && performance.now()-start<PSPRITE.BAKE_MS){
    const e=o.ents[o.index++], t0=performance.now();
    const plants=drawSceneEnt(e,W,H,season,0,o.phase==='sprites',o.ctx,true);
    if (o.phase==='measure' && plants){ o.plants+=plants; o.plantMs+=performance.now()-t0; }
    count++;
  }
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
function render(t){
  if (gardenOpening && !game.photo && !prepareGardenOpen(t)) return;
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
  // persistent scene list: rebuild only on edit / rot / layer toggle / day tick
  // (or when a load swapped the maps wholesale) — never on pan/zoom frames
  // Scene rebuilds are invalidation-triggered, not per-frame, so they are an
  // EVENT: folded into the 'gather' average they made a rare O(all plants)
  // rebuild indistinguishable from the cheap per-frame dynamic gather below,
  // which shares that label.
  if (sceneStale(sceneKey())){ const tScene=dnow(); buildScene(W,H); dev('scene',tScene); }

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
    /* An edit with the camera still: repaint the viewport, leave the margin.
       It needs a bake already on the canvas to leave a margin OF, and the same
       structure and scale, since a season turn or a zoom invalidates every
       pixel including the ones off screen. */
    const viewportOnly = !scrolled && groundKey!=='' && groundKeyStruct===gStruct
      && !groundRefsChanged() && !zoomStale && !camStale;
    if (viewportOnly){
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
    // this bake is authoritative for everything edited up to now, and it starts
    // the next throttle window
    clearGroundDamage(); groundEditT=t;
    bakeMs=dev(scrolled?'bakePan':'bake',tBake,groundCtx);   // the bake DRAWS, so flush mode attributes its raster
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
  if (shadeMap.hasShade) for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
    const si=yy*GW+xx;
    const a=shadeMap.activeAlpha[si];
    const fut=a>0?0:shadeMap.futureDrawScore[si];
    if (a<=0 && fut<SHADE_FUTURE_SCORE) continue;
    const [sx,sy]=screenOf(xx,yy,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    if (a>0) tileDiamond(cx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
    else tileDiamond(cx,sx,sy,null,'rgba(210,168,92,0.34)',[5,5]);
  }
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
  if (hoverShrub){
    let mode='hover';
    if (isPlacementTool(game.tool) && game.tool!=='house'){  // placement tools are blocked by a shrub here; house ghosts instead
      mode='blocked';
      if (PLANTS[game.tool] && isShrubDef(plantDef(game.tool,game.toolVar))){
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
  for (let i=0;i<sents.length;i++){
    const e=sents[i];
    while (di<dyn.length && dyn[di].d<=e.d){
      plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
    if (e.ox1+offX<0 || e.ox0+offX>W || e.oy1+offY<0 || e.oy0+offY>H) continue;
    plantCount+=drawSceneEnt(e,W,H,cal.season,sway,useSprites);
    drawn++;
  }
  while (di<dyn.length){
    plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
  dmark('draw',tDraw);
  // every visible clump now has its picture for the coming season (a pending
  // Skip lands on the next frame if the ground is ready too — skipPrepared)
  AHEAD.readyFor=AHEAD.season && !AHEAD.short ? AHEAD.season : null;
  drawBuildingDraftOverlay(cx,W,H);
  updateSpriteMode(performance.now()-tDrawWall, plantCount,
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

  // selection tool: marquee, committed selection, and move/copy ghost
  if (game.tool==='select') drawSelectionOverlay(cx,W,H,t,cal.season,sway);
  drawRulerOverlay(cx,W,H);
  drawToolDragMetric(cx,W,H);
  if (game.layerVis.edgeRulers && VW>640) drawSelectionMetrics(cx,W,H,{x0:0,y0:0,x1:GW-1,y1:GH-1});
  if (typeof positionSelectionActions==='function') positionSelectionActions();
  dmark('over',tOver);
  const tLight=dnow();

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
    /* Culled in SCREEN space and padded by the REACH of the glow -- the trap
       this file documents twice already. The tile bbox is the bbox of a
       DIAMOND, so it keeps lights that are off screen and, worse here, DROPS
       lights whose pool still lands on screen while their own tile does not:
       a lantern throws 113px and a big fire pit close to 200, so a fixture can
       be a tile and a half out and still be lighting the corner you are looking
       at. The baked box is camera-free (setEntScreenBounds), so the frame adds
       the same two offsets the entity pass adds. */
    const offX=W/2-cam.x, offY=H*0.24-cam.y;
    const litOn=(e,reach)=>!(e.ox1+offX< -reach || e.ox0+offX>W+reach ||
                             e.oy1+offY< -reach || e.oy0+offY>H+reach);
    for (const e of scene.firepits){
      if (!litOn(e,FIREPIT_GLOW_REACH)) continue;
      drawFirepitGlow(cx,W,H,e.f,e.x,e.y);
    }
    for (const e of scene.lights){
      // an uplight's beam runs 1.7x its pool UPWARD, so pad by the larger
      const lt=lightType(e.l&&e.l.type);
      if (!litOn(e, feetToPx(lt.poolFt)*(lt.glow==='up'?1.8:1.1))) continue;
      drawLightGlow(cx,W,H,e.l,e.x,e.y);
    }
  }

  if (game.photo){ // golden-hour wash, only on the captured frame
    const g2=cx.createRadialGradient(W*0.72,H*0.22,30, W*0.72,H*0.22,H*0.95);
    g2.addColorStop(0,'rgba(255,212,140,0.38)');
    g2.addColorStop(0.5,'rgba(228,160,90,0.10)');
    g2.addColorStop(1,'rgba(50,35,55,0.24)');
    cx.fillStyle=g2; cx.fillRect(0,0,W,H);
  }
  drawSeasonFade(t);                             // old season dissolves over the new one
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
  if (!drag || !drag.active || !drag.what) return null;
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
       before. */
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
      if (c.bulb) drawPlantMaybeCached(cx,sx,sy+TILE_H/2,c.bulb.s,displayPlantGrowth(c.bulb),season,
        (tileSeed(c.x,c.y)^0x9e37)>>>0,sway,c.bulb.v,undefined,ghostSprites);
      /* the SOURCE tile's detail as well as its seed: detail is out of the
         sprite SLOT but in its key, so a ghost that disagreed with the scene
         about a hedge's neighbours would share the clump's slot, miss on the
         key, and the two draws would retire each other's sprite every frame —
         a bake apiece per frame for exactly the plants a cache helps most. */
      if (c.plant) drawPlantMaybeCached(cx,sx,sy+TILE_H/2,c.plant.s,displayPlantGrowth(c.plant),season,
        tileSeed(c.x,c.y),sway,c.plant.v,plantRenderDetail(c.x,c.y,c.plant,W,H),ghostSprites);
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
}
