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
const GROUND_ZOOM_DRIFT=0.18;   // mid-gesture rebake if scale drifts this far from the bake
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
/* ---------- a pan cannot invalidate a bake that already holds the whole plot ----------
   `panDev>=MD` re-bakes the instant the camera leaves the baked margin, with no
   throttle of any kind — the edit path got GROUND_EDIT_SETTLE and the pan path
   got nothing. On a desktop that is the dominant cost of using the app:
   simulated on a real 70x39 garden, ONE SECOND of ordinary mouse-drag panning
   forced 2 bakes at a slow drag, 6 at a normal one and 10 at a fast one, each
   ~30ms of submission alone.

   Almost all of it is redoing work that changes nothing. The bake window is
   CLAMPED to the plot, so once the whole plot is inside it there is no further
   ground anywhere: `paintGround` skips off-lot tiles, so beyond the deeded
   boundary the bake is transparent and the sky shows through, which is exactly
   what a pan should reveal. The blit is world-anchored and slides by the camera
   delta, so it keeps being right however far you go. Verified rather than
   argued: with the bake FROZEN outright and the camera panned 600 device px —
   three times the 200px margin — the frame came out pixel-identical to one that
   re-baked freely (0% of pixels differing, against 0% for the control of
   rendering the same frame twice).

   `groundBakeComplete` is that fact about the bake being held. It deliberately
   suppresses only the mid-gesture forced bake; the GROUND_PAN_SETTLE bake still
   fires ~180ms after the camera stops, so a resting frame is still freshly
   rasterized and the blit's half-pixel rounding is still corrected. Net: a pan
   goes from 2-10 bakes per second to one at the end of the gesture.

   The limit worth knowing: this only helps while the whole plot fits in the
   baked canvas, i.e. zoomed out far enough to see the garden. Zoomed into a
   bed, `panDev` still forces bakes, and only an incremental strip re-bake would
   help there. */
let groundBakeComplete=false;
/* Did that bake reach `pad` tiles BEYOND the plot on every side?

   The test is on the UNPADDED corner range — the tiles that genuinely project
   into the canvas — because the clamped-and-padded window reports 0..GW-1 as
   soon as `pad` alone carries it there, which it does even when the plot runs
   several tiles off the edge of the canvas and is being clipped away. Reading
   completeness off the clamped window would call that bake complete, skip the
   pan re-bake, and slide a clipped edge into view. Requiring a full `pad` of
   skirt is deliberately conservative: the ground bake's tallest content is a
   retaining-wall face (~20 inches), so 5 tiles of clearance is far more than
   anything can overhang. */
function bakeCoversWholePlot(rx0,rx1,ry0,ry1,padTiles){
  return rx0<=-padTiles && rx1>=GW-1+padTiles && ry0<=-padTiles && ry1>=GH-1+padTiles;
}
/* Does leaving the baked margin force a bake THIS frame? Named and extracted
   for the same reason groundEditThrottled is: this is the policy, and the test
   harness cannot reach it through a real paintGround. A zoom in flight is
   deliberately excluded — the blit resamples at k!==1, so a complete bake is no
   longer a sufficient answer, and the zoom disjunct owns that case anyway. */
function groundPanForcesBake(panDev, marginDev, zoomStale){
  if (panDev<marginDev) return false;
  return zoomStale || !groundBakeComplete;
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
const smoothableTerrain = t2 => t2==='path'||t2==='bed'||t2==='water';
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
  else col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14);
  drawElevationSides(ctx,W,H,x,y,col);
  if (water) drawWaterTexture(ctx,sx,sy,x,y,terrObj,amb);
  else drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,col,rs,terrObj);
  drawElevationRim(ctx,sx,sy,elevationAt(x,y));
  if (!organic && terr) drawTileEdging(ctx,W,H,x,y);   // (ctx,W,H,x,y) like every other painter
  if (amb.snow && !path && !water && rs()>0.4){ ctx.fillStyle='rgba(238,242,248,0.7)';
    ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); }
}
function paintGround(ctx,x0,x1,y0,y1,W,H,amb,t,ex){
  ex=ex||0;   // extra cull slack in draw units — the world-anchored bake paints a margin past the viewport
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
    paintGroundTile(ctx,x,y,W,H,amb,showLand,organic);
  }
  if (organic) paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t);
  if (showLand) paintWallRuns(ctx,W,H);
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
  /* Only ground ABOVE grade shows a face, which is what drawElevationSides has
     always done — a SUNKEN area shows none. That is a known limitation carried
     over deliberately, not a new one (see the note in world.js). */
  const byLevel={};
  for (const k in game.elevation||{}){
    const e=game.elevation[k]; if (!e||e.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    const h=elevationAt(x,y); if (h<=0) continue;
    (byLevel[h]||(byLevel[h]=new Set())).add(k);
  }
  for (const hs of Object.keys(byLevel).sort((p,q)=>p-q)){
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
      : region.kind==='path' ? pathFill(o,amb.snow) : bedFill(o,amb);
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
    // one continuous edge stroke (replaces the per-tile diamond strokes),
    // skipping boundaries a higher-ranked region is about to cover
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopStroke(ctx,loop,proj);
    ctx.strokeStyle = isWater ? (amb.snow?'rgba(255,255,255,0.5)':waterStyle(region.c).edge)
      : region.kind==='path' ? 'rgba(60,48,34,0.32)' : 'rgba(48,36,24,0.30)';
    ctx.lineWidth=1.6; ctx.stroke();
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
  structMs:0, SAMPLE:8, structRing:[], RING:8 };
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

   SPRITE_ZOOM_DRIFT is the ground's GROUND_ZOOM_DRIFT escape: past a large
   drift, re-bake even mid-gesture, or a long continuous zoom would blit a
   sprite baked at a sixth of its current size for the whole gesture. 0.6 means
   at most a 1.6x resample before it refreshes — a handful of re-bakes across a
   big zoom instead of one every two wheel ticks.

   It is a RATIO of the two scales, not the difference-over-current form the
   12% rest threshold uses, because that form is asymmetric in the wrong
   direction: |baked-now| > 0.6*now needs a 2.5x zoom IN to fire but only a
   1.6x zoom OUT, and zooming in is the case that upscales a stale sprite into
   mush. Zooming out merely minifies it, which looks fine. A ratio is 1.6x
   either way.

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
  const ratio = baked>current ? baked/current : current/baked;
  return ratio > 1+SPRITE_ZOOM_DRIFT;
}
function pspriteScale(){ return Math.min(DPR,1.5)*ZOOM; } // cap DPR so retina sprites don't 4x the budget
function pspriteFrame(){                        // once per render: age the cache
  PSPRITE.frame++; PSPRITE.rendered=0; PSPRITE.scale=pspriteScale();
  // Evict only sprites NOT drawn last frame (off-screen), oldest first, down to
  // budget — never the visible set. This is what stops the cache thrashing and
  // flickering when the working set is large (e.g. a dense garden on retina):
  // memory may overshoot to hold everything on screen, but it never re-renders
  // a visible plant it just discarded.
  /* An evicted sprite has to clear its slot, or the index outlives the cache:
     the stale pointer is harmless on lookup (nothing sits at that key any
     more) but it would accumulate one dead string per eviction, forever. The
     slot is carried ON the entry rather than parsed back out of the key — the
     key's last field is JSON and may contain the separator. */
  if (PSPRITE.bytes>PSPRITE.MEM) for (const [k,e] of PSPRITE.map){
    if (PSPRITE.bytes<=PSPRITE.MEM || e.used>=PSPRITE.frame-1) break;
    PSPRITE.bytes-=e.bytes; PSPRITE.map.delete(k);
    if (e.slot!==undefined && PSPRITE.slot.get(e.slot)===k) PSPRITE.slot.delete(e.slot);
  }
}
function gbucket(v,n){ v=v<0?0:v>1?1:v; return Math.round(v*(n-1)); }
function makePlantSprite(key,gB,bB,season,seed,variant,detail){
  const P=plantDef(key,variant), growth=gB/8;
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
  const herbHalf=P.form==='sotol'
    ? Math.max(H*0.62,H*(L.leafLen||0.82)*1.1)
    : H*0.62*Math.max(1,grassW);
  const halfW=(woody?Math.max(canopy*0.62,H*0.5):herbHalf)+18;
  // Cloud grasses can throw a seed veil substantially above their nominal
  // height. Size its sprite for the tallest panicle plus cloud rather than
  // clipping tall, airy forms such as Molinia 'Transparent'.
  const artH=plantArtTop(P)*(0.25+0.75*growth);
  const herbTop=P.form==='cloudgrass'
    ? Math.max(H*1.12, H*1.05*(L.cloudTop||0.92)+(L.cloudHeight||11)+6)
    : P.form==='sotol' ? artH*1.05
    : H*1.12;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):herbTop)+26;
  // Everything a plant paints BELOW its placement point — the cast ground
  // shadow, and a weeping conifer's cascade — so the cached and live procedural
  // versions do not change silhouette when the governor flips. `growth` here is
  // the same value drawPlant is handed, since the shadow scales with it.
  const below=plantDrawBelow(P,growth,H)+8;
  const bot=Math.max(18,Number.isFinite(below)?below:18), want=pspriteScale();
  // giant woody sprites (a T10-rescaled oak is ~800 draw units tall): clamp
  // the bake RESOLUTION instead of bailing to per-frame procedural — the blit
  // scales it up slightly soft at high zoom, which reads fine on foliage and
  // keeps one oak from costing 13MB of sprite memory.
  const s=Math.min(want, 1024/Math.max(halfW*2, top+bot));
  const pw=Math.max(1,Math.ceil(halfW*2*s)), ph=Math.max(1,Math.ceil((top+bot)*s));
  if (pw>2600||ph>2600) return null;           // absurd size — don't cache, fall back
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); c2.setTransform(s,0,0,s,halfW*s,top*s);
  const spriteDetail=Object.assign({},detail||{},{bloomFallback:true});
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,spriteDetail); // still (sway 0), bucketed bloom
  return { cv, ox:halfW, oy:top, s, want, capped:s<want, bytes:pw*ph*4 };
}
// blit a cached plant if we can, else fall back to a live procedural draw.
function drawPlantMaybeCached(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites){
  if (!useSprites || PSPRITE.off){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  const P=plantDef(key,variant), bloomS=bloomAppearanceFor(P,season);
  const gB=gbucket(growth,9), bB=bloomS?gbucket(bloomLevel(key,variant),4):0;
  const kk=seed+'|'+key+'|'+(variant||'')+'|'+season+'|'+gB+'|'+bB+'|'+(detail?JSON.stringify(detail):'');
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
  const slot=seed+'|'+key+'|'+(variant||'')+'|'+season;
  let e=PSPRITE.map.get(kk);
  // A sprite baked at a very different zoom blits soft, so re-render it (budget
  // permitting) at the current scale. But to keep zooming smooth, reuse the old
  // one for this frame rather than dropping a visible plant to a slow procedural
  // draw — the cache converges back to crisp within a few frames after a zoom.
  // Resolution-capped giants (T10) compare on the REQUESTED scale and never
  // rebake while zooming further in — the bake would come out identical.
  // The rescale also waits for the gesture to settle (see noteSpriteZoom); a
  // genuine MISS (!e) never waits, or a plant entering the viewport mid-zoom
  // would fall through to a procedural draw, which is what this cache exists
  // to avoid.
  const eScale=e&&(e.want!==undefined?e.want:e.s);
  const drift=e?Math.abs(eScale-PSPRITE.scale):0;
  const rescale = !!e && drift>PSPRITE.scale*0.12
    && !(e.capped && PSPRITE.scale>e.s)
    && spriteRescaleDue(eScale,PSPRITE.scale);
  if (!e || rescale){
    if (PSPRITE.rendered<PSPRITE.BUDGET){
      const ne=makePlantSprite(key,gB,bB,season,seed,variant,detail);
      if (ne){ if (e) PSPRITE.bytes-=e.bytes; e=ne; PSPRITE.rendered++; PSPRITE.bytes+=e.bytes; }
    }
    if (!e){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  }
  /* Retire whatever this clump was cached as before. Only now — if the bake
     above was refused for budget we are still holding the OLD sprite, and
     dropping it would buy a procedural draw for nothing. */
  const wasKey=PSPRITE.slot.get(slot);
  if (wasKey!==undefined && wasKey!==kk){
    const dead=PSPRITE.map.get(wasKey);
    if (dead){ PSPRITE.bytes-=dead.bytes; PSPRITE.map.delete(wasKey); }
  }
  if (wasKey!==kk) PSPRITE.slot.set(slot,kk);
  if (PSPRITE.map.has(kk)) PSPRITE.map.delete(kk);   // LRU: re-insert at the end
  e.used=PSPRITE.frame; e.slot=slot;   // carried so eviction can clear the index
  PSPRITE.map.set(kk,e);
  const dw=e.cv.width/e.s, dh=e.cv.height/e.s, lx=bx-e.ox, ly=by-e.oy;
  if (sway){
    ctx.save(); ctx.translate(bx,by); ctx.transform(1,0,sway*0.05,1,0,0); ctx.translate(-bx,-by);
    ctx.drawImage(e.cv,lx,ly,dw,dh); ctx.restore();
  } else ctx.drawImage(e.cv,lx,ly,dw,dh);
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
    if (SSPRITE.bytes<=SSPRITE.MEM || e.used>=SSPRITE.frame-1) break;
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
    case SCENE_K.FIREPIT: drawFirepit(ctx,W,H,season,e.f,e.x,e.y); return;
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
function structSpriteSpec(e){
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
      return {key:'F|'+structRecordSig(f)+'|'+nb+'|'+ax[0]+','+ax[1]+'|'+post+'|'+ev+'|'+seed,
        w:1, h:1, up:fenceDrawH(f)*1.5+52, pad:TILE_W*0.62, down:16};
    }
    case SCENE_K.BUILDING:{
      /* Only the two faces the CAMERA can see are conditional, and they depend
         on whether the footprint continues that way — so a whole garage is at
         most four distinct sprites. */
      const set=buildingTileSet(e.b);
      const [rx,ry]=viewDirToWorld(1,0), [dx,dy]=viewDirToWorld(0,1);
      const r=set.has((e.x+rx)+','+(e.y+ry))?1:0, d=set.has((e.x+dx)+','+(e.y+dy))?1:0;
      const b=e.b;
      return {key:'U|'+(b.fill||b.roof||'')+'|'+(b.edge||b.wall||'')+'|'+(b.status||'')+'|'+r+d,
        w:1, h:1, up:26, pad:8, down:20};
    }
    case SCENE_K.BUILDING_OUTLINE:{
      const r=buildingBounds(e.b); if (!r) return null;
      const b=e.b;
      return {key:'V|'+structRecordSig(b), w:r.x1-r.x0+1, h:r.y1-r.y0+1,
        up:26, pad:14, down:24};
    }
    case SCENE_K.POT:{
      const sz=potTileSize(e.p);
      return {key:'P|'+structRecordSig(e.p), w:sz.w, h:sz.h,
        up:feetToPx(46/12)+30, pad:TILE_W*0.35, down:22};
    }
    case SCENE_K.SEAT:{
      const sz=seatTileSize(e.s);
      return {key:'S|'+structRecordSig(e.s), w:sz.w, h:sz.h,
        up:feetToPx(52/12)+30, pad:TILE_W*0.55, down:24};
    }
    case SCENE_K.BOULDER:{
      const sz=boulderTileSize(e.b);
      // shape comes from tileSeed, so two boulders of one type differ
      return {key:'O|'+structRecordSig(e.b)+'|'+tileSeed(e.x,e.y), w:sz.w, h:sz.h,
        up:TILE_H*2.6+24, pad:TILE_W*0.35, down:20};
    }
    case SCENE_K.FIREPIT:{
      const sz=firepitTileSize(e.f);
      return {key:'R|'+structRecordSig(e.f), w:sz.w, h:sz.h,
        up:TILE_H*2.4+24, pad:TILE_W*0.35, down:20};
    }
    case SCENE_K.PET:
      return {key:'T|'+structRecordSig(e.p), w:1, h:1, up:TILE_H*1.6+20, pad:TILE_W*0.4, down:18};
    case SCENE_K.LIGHT:
      return {key:'L|'+structRecordSig(e.l), w:1, h:1, up:feetToPx(8)+34, pad:TILE_W*0.4, down:18};
    case SCENE_K.HOUSE:{
      const h=e.h;
      return {key:'H|'+structRecordSig(h), w:h.w, h:h.h,
        up:TILE_H*h.h*1.2+240, pad:TILE_W*0.7, down:26};
    }
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
  const s=Math.min(want, 1024/Math.max(bw,bh));
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
function drawStructMaybeCached(e,W,H,season,lit){
  if (SSPRITE.off || !SSPRITE.active){ drawStructEnt(cx,e,W,H,season,lit); return; }
  const spec=structSpriteSpec(e);
  if (!spec){ drawStructEnt(cx,e,W,H,season,lit); return; }
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
    if (!sp){ SSPRITE.fell++; drawStructEnt(cx,e,W,H,season,lit); return; }
  }
  if (had) SSPRITE.hits++; else SSPRITE.misses++;
  if (SSPRITE.map.has(kk)) SSPRITE.map.delete(kk);   // LRU: re-insert at the end
  sp.used=SSPRITE.frame;
  SSPRITE.map.set(kk,sp);
  const [ax,ay]=structAnchor(e,W,H);
  cx.drawImage(sp.cv, ax+sp.ox, ay+sp.oy, sp.cv.width/sp.s, sp.cv.height/sp.s);
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
const SCENE_K={FENCE:0,LIGHT:1,FIREPIT:2,BOULDER:3,HOUSE:4,BULB:5,PLANT:6,GHOST:7,BUILDING:8,BUILDING_OUTLINE:9,PET:10,POT:11,SEAT:12};
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
    r.lights!==game.lights || r.firepits!==game.firepits || r.boulders!==game.boulders || r.pets!==game.pets || r.houses!==game.houses || r.buildings!==game.buildings;
}
function buildScene(W,H){
  const ents=[], shadeTrees=[], futureShadeTrees=[], shrubs=[], lights=[], firepits=[], boulders=[];
  const plantRecs=[];
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (layerShown('woody')){
      const shrub=shrubInfoFromKey(k);
      if (shrub){ shrub.cullR=Math.ceil(woodyRadiusTiles(plantDef(p.s,p.v)))+1; shrubs.push(shrub); }
    }
    const sh=treeShadeInfo(k,p);
    if (sh && sh.r>=1){ sh.reach=treeShadeReach(sh); (sh.activePotential?shadeTrees:futureShadeTrees).push(sh); }
    if (!layerShown(plantLayerOf(p))) continue;
    const rec={d:plantDepth(x,y,p)+0.3, kind:SCENE_K.PLANT, bx0:x,bx1:x,by0:y,by1:y,
      x,y,p, seed:tileSeed(x,y), detail:plantRenderDetail(x,y,p,W,H), stunt:false};
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
    ents.push({d:plantDepth(x,y,p)+0.25, kind:SCENE_K.BULB, bx0:x,bx1:x,by0:y,by1:y,
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
    /* The vessel sorts just BEHIND the plant standing in it, so foliage always
       draws over its own rim. */
    for (const k in game.pots||{}){ const p=game.pots[k];
      if (!p || p.removed) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), sz=potTileSize(p);
      ents.push({d:footprintDrawDepth(x,y,sz.w,sz.h)+0.30, kind:SCENE_K.POT,
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
  scene={key:sceneKey(), refs:{plants:game.plants,bulbs:game.bulbs,fences:game.fences,
    lights:game.lights,firepits:game.firepits,boulders:game.boulders,pets:game.pets,pots:game.pots,seats:game.seats,houses:game.houses,buildings:game.buildings},
    ents, shadeTrees, futureShadeTrees, shrubs, lights, firepits, boulders};
}
// draw one record; returns 1 when it drew a plant/bulb (the sprite-cache count)
function drawSceneEnt(e,W,H,season,sway,useSprites){
  switch(e.kind){
    /* Every structure goes through one cached blitter. They are pure
       functions of (record, season, rot, camera) — no `t`, no `sway` — so
       they are as cacheable as the ground, and this is where they stopped
       being redrawn from scratch on every frame. */
    case SCENE_K.FENCE:
    case SCENE_K.LIGHT:
    case SCENE_K.FIREPIT:
    case SCENE_K.BOULDER:
    case SCENE_K.PET:
    case SCENE_K.POT:
    case SCENE_K.SEAT:
    case SCENE_K.BUILDING:
    case SCENE_K.BUILDING_OUTLINE:
    case SCENE_K.HOUSE:
      if (structSampling){
        const t0=performance.now();
        drawStructMaybeCached(e,W,H,season,game.layerVis.night);
        structSampleMs+=performance.now()-t0;
      } else drawStructMaybeCached(e,W,H,season,game.layerVis.night);
      return 0;
    case SCENE_K.BULB:{
      const g=displayPlantGrowth(e.p); if (g<=0.02) return 0;   // underground
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,e.p.s,g,season,e.seed,sway,e.p.v,undefined,useSprites);
      return 1;
    }
    case SCENE_K.PLANT:{
      let g=displayPlantGrowth(e.p); if (e.stunt) g*=0.45;      // struggling under canopy
      const [sx,sy]=plantScreenOf(e.x,e.y,e.p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,e.p.s,g,season,e.seed,sway,e.p.v,e.detail,useSprites);
      return 1;
    }
    case SCENE_K.GHOST:
      cx.globalAlpha=0.55; drawHouse(cx,W,H,season,e.h); cx.globalAlpha=1; return 0;
  }
  return 0;
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
const seasonFadeRMQ=(typeof matchMedia==='function') ? matchMedia('(prefers-reduced-motion: reduce)') : null;
function seasonFadeActive(){ return seasonFade.active; }
function resetSeasonFade(){ seasonFade.active=false; seasonFade.cv=null; seasonFade.last=null; seasonFade.suppressOnce=false; }
function suppressNextSeasonFade(){ seasonFade.active=false; seasonFade.cv=null; seasonFade.suppressOnce=true; }
function maybeStartSeasonFade(t,season){
  /* Counted on the season CHANGE, not on the crossfade — reduced-motion skips
     the fade but still saw the year turn, and that is the differentiator the
     funnel is asking about. */
  if (seasonFade.last && seasonFade.last!==season) funnel(FUNNEL_EVENTS.seasonTurned);
  if (seasonFade.last && seasonFade.last!==season && !seasonFade.suppressOnce && !game.photo &&
      !(seasonFadeRMQ && seasonFadeRMQ.matches)){
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
function render(t){
  /* Sky: three full-screen gradient fills, now one opaque blit of a bake keyed
     on (season, canvas size) — see the season-wash note in world.js. This
     stretch used to be covered by no phase timer at all, which hid ~31% of the
     frame; `sky` is what closed that. */
  const tSky=dnow();
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  maybeStartSeasonFade(t,cal.season);            // must run before the sky pass clears the frame
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  drawSeasonSky(cx,W,H,cal.season,amb);
  dmark('sky',tSky);

  const tCompass=dnow(); updateCompass(); dmark('compass',tCompass);

  const sway = Math.sin(t*0.0012);
  noteSpriteZoom(t);            // must precede both: it decides whether they may rescale
  pspriteFrame(); ssprFrame();

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
  const gStruct=cal.season+'|'+game.rot+'|'+game.edgeStyle+'|'+
    (layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height;
  const gkey=gStruct+'|'+groundDataKey();
  let bakeMs=0;                                        // charged to the 'bake' event, not the 'ground' phase
  const MD=Math.round(GROUND_MARGIN_CSS*DPR);          // margin in device px
  if (!groundCanvas){ groundCanvas=document.createElement('canvas'); groundCtx=groundCanvas.getContext('2d'); }
  if (groundCanvas.width!==cnv.width+2*MD||groundCanvas.height!==cnv.height+2*MD){
    groundCanvas.width=cnv.width+2*MD; groundCanvas.height=cnv.height+2*MD; groundKey=''; }
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
  const mustBake = (gkey!==groundKey && !editThrottled)
    || groundRefsChanged()
    || groundPanForcesBake(panDev,MD,zoomStale)
    || (zoomStale && (t-groundZoomT>GROUND_ZOOM_SETTLE || Math.abs(ZOOM/groundZoom-1)>GROUND_ZOOM_DRIFT))
    || (camStale && !zoomStale && t-groundCamT>GROUND_PAN_SETTLE);
  if (mustBake){
    const tBake=dnow();                                // 'ground' below is the per-frame BLIT; this is the bake
    const Mu=MD/(DPR*ZOOM);                            // margin in draw units
    // expanded tile bbox: the viewport window plus the baked margin
    const bc=[tileAt(-Mu,-Mu,W,H),tileAt(W+Mu,-Mu,W,H),tileAt(-Mu,H+Mu,W,H),tileAt(W+Mu,H+Mu,W,H)];
    // the UNCLAMPED, UNPADDED range is what actually projects into the canvas —
    // it is what groundBakeComplete has to be judged on (see bakeCoversWholePlot)
    const rx0=Math.min(bc[0][0],bc[1][0],bc[2][0],bc[3][0]);
    const rx1=Math.max(bc[0][0],bc[1][0],bc[2][0],bc[3][0]);
    const ry0=Math.min(bc[0][1],bc[1][1],bc[2][1],bc[3][1]);
    const ry1=Math.max(bc[0][1],bc[1][1],bc[2][1],bc[3][1]);
    const bx0=Math.max(0,rx0-pad);
    const bx1=Math.min(GW-1,rx1+pad);
    const by0=Math.max(0,ry0-pad);
    const by1=Math.min(GH-1,ry1+pad);
    groundBakeComplete=bakeCoversWholePlot(rx0,rx1,ry0,ry1,pad);
    groundCtx.setTransform(1,0,0,1,0,0); groundCtx.clearRect(0,0,groundCanvas.width,groundCanvas.height);
    groundCtx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,MD,MD);   // shift by the margin, device px
    paintGround(groundCtx,bx0,bx1,by0,by1,W,H,amb,t,Mu);
    groundKey=gkey; groundKeyStruct=gStruct; groundCamX=cam.x; groundCamY=cam.y; groundZoom=ZOOM;
    groundRefs={terrain:game.terrain,elevation:game.elevation,houses:game.houses};
    // this bake is authoritative for everything edited up to now, and it starts
    // the next throttle window
    clearGroundDamage(); groundEditT=t;
    bakeMs=dev('bake',tBake,groundCtx);   // the bake DRAWS, so flush mode attributes its raster
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
  if (layerShown('woody')) for (const sh of scene.shrubs){
    if (sh.x+sh.cullR<x0 || sh.x-sh.cullR>x1 || sh.y+sh.cullR<y0 || sh.y-sh.cullR>y1) continue;
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
  let plantCount=0, drawn=0, di=0;
  for (let i=0;i<sents.length;i++){
    const e=sents[i];
    while (di<dyn.length && dyn[di].d<=e.d){
      plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
    if (e.bx1<x0||e.bx0>x1||e.by1<y0||e.by0>y1) continue;
    plantCount+=drawSceneEnt(e,W,H,cal.season,sway,useSprites);
    drawn++;
  }
  while (di<dyn.length){
    plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites); drawn++; }
  dmark('draw',tDraw);
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
    for (const e of scene.firepits){
      if (e.bx1<x0||e.bx0>x1||e.by1<y0||e.by0>y1) continue;
      drawFirepitGlow(cx,W,H,e.f,e.x,e.y);
    }
    for (const e of scene.lights){
      if (e.bx1<x0||e.bx0>x1||e.by1<y0||e.by0>y1) continue;
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
function distanceMetricLabel(a,b){
  const dx=(b[0]-a[0]), dy=(b[1]-a[1]);
  const inches=Math.max(TILE_IN,Math.round(Math.hypot(dx,dy)*TILE_IN));
  if (inches<24) return `${inches} in`;
  const feet=inches/12;
  return `${Number.isInteger(feet)?feet:feet.toFixed(1)} ft`;
}
function inchesMetricLabel(inches){
  inches=Math.max(0,+inches||0);
  if (inches<24) return `${Math.round(inches)} in`;
  const feet=inches/12;
  return `${Number.isInteger(feet)?feet:feet.toFixed(1)} ft`;
}
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
function drawToolDragMetric(cx,W,H){
  if (typeof toolDrag==='undefined' || !toolDrag || !toolDrag.active || !toolDrag.what) return;
  if (!['path','bed','water','fence','gate'].includes(toolDrag.what)) return;
  const b=tileCenterScreen(toolDrag.cx||toolDrag.sx,toolDrag.cy||toolDrag.sy,W,H);
  let label;
  if (toolDrag.what==='bed'||toolDrag.what==='water'){
    const n=toolDrag.affected?toolDrag.affected.size:0, area=tileAreaSqFt(n);
    label=`${area<10?area.toFixed(1):Math.round(area)} sq ft`;
  } else {
    label=inchesMetricLabel(toolDrag.runInches||TILE_IN);
    if (toolDrag.what==='path' && toolBrushSize()>1) label+=` x ${selMetricLabel(toolBrushSize())} wide`;
  }
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
    const selCtx=selectionValidationContext(items,c=>[c.x+dx,c.y+dy],selMove.copy);
    selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.12)','rgba(150,210,255,0.45)');
    for (const c of items){
      const nx=c.x+dx, ny=c.y+dy, ok=selItemDestValid(c,nx,ny,selCtx);
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
      if (c.boulder) drawBoulder(cx,W,H,season,c.boulder,nx,ny);
      if (c.bulb) drawPlant(cx,sx,sy+TILE_H/2,c.bulb.s,displayPlantGrowth(c.bulb),season,(tileSeed(nx,ny)^0x9e37)>>>0,sway,c.bulb.v);
      if (c.plant) drawPlant(cx,sx,sy+TILE_H/2,c.plant.s,displayPlantGrowth(c.plant),season,tileSeed(nx,ny),sway,c.plant.v);
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
}
