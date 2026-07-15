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
let groundCanvas=null, groundCtx=null, groundKey='', groundRefs={terrain:null,elevation:null,houses:null};
let underlayImage={src:null,img:null,ready:false,error:false};
let groundCamX=0, groundCamY=0, groundZoom=1;          // camera/zoom at bake time
let groundZoomPrev=-1, groundZoomT=-1e9;               // last zoom tick, for settle
let groundCamPrevX=NaN, groundCamPrevY=NaN, groundCamT=-1e9; // last cam tick, for settle
const GROUND_MARGIN_CSS=200;    // pan headroom baked around the viewport, CSS px
const GROUND_ZOOM_SETTLE=140;   // ms after the last zoom tick before the crisp rebake
const GROUND_PAN_SETTLE=180;    // ms after the last cam move before the crisp rebake
const GROUND_ZOOM_DRIFT=0.18;   // mid-gesture rebake if scale drifts this far from the bake
function groundDataKey(){ return game.groundRev+'|'+GW+'x'+GH; }
function terrainRegionKey(){ return game.terrainRev+'|'+GW+'x'+GH; }
function groundRefsChanged(){
  return groundRefs.terrain!==game.terrain || groundRefs.elevation!==game.elevation || groundRefs.houses!==game.houses;
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
function paintGround(ctx,x0,x1,y0,y1,W,H,amb,t,ex){
  ex=ex||0;   // extra cull slack in draw units — the world-anchored bake paints a margin past the viewport
  const showLand=layerShown('landscape');
  // Organic edges: terrain draws its GRASS base in this tile pass and the
  // material is overlaid as a smoothed blob afterward (paintTerrainBlobs), so
  // the curve can cut a corner and show grass under it. Formal edges keep the
  // crisp per-tile material rendering. Doorstep + elevation stay per-tile.
  const organic = showLand && game.edgeStyle==='organic';
  const smoothable = t2 => t2==='path'||t2==='bed'||t2==='water';
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W-ex||sx>W+TILE_W+ex||sy<-TILE_H*2-ex||sy>H+TILE_H*2+ex) continue;
    const terrObj=showLand?terrainAt(x,y):null, terrRaw=terrObj&&terrObj.k;
    const terr = (organic && smoothable(terrRaw)) ? null : terrRaw;  // organic: grass base under blobs
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
  if (organic) paintTerrainBlobs(ctx,x0,x1,y0,y1,W,H,amb,t);
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
// Expand a traced loop (corners only) back to unit tile edges, classifying
// each edge by what sits on its OUTSIDE: another region's material = HARD
// (butt exactly), grass = SOFT (smooth organically). The plot boundary is
// hard too — a bed painted to the edge of the plot runs exactly to it (leave
// a grass tile if you want a margin). Orientation-free: of the two tiles
// flanking an edge, the one not in the region is out.
function terrainUnitEdges(loop, set, solid){
  const edges=[];
  const hardOut=(key)=>{
    if (solid[key]) return true;
    const ci=key.indexOf(','), ox=+key.slice(0,ci), oy=+key.slice(ci+1);
    return ox<0 || oy<0 || ox>=GW || oy>=GH;      // beyond the plot
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
      edges.push({a:[x,y], b:[nx,ny], hard:hardOut(out)});
      x=nx; y=ny;
    }
  }
  return edges;
}
function finishTerrainArc(hard, pts){
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
    else pts=dpOpen(pts, TERRAIN_SIMPLIFY_EPS);
  }
  if (!hard){   // inward-bounded lattice jitter, interiors only — endpoints stay pinned
    for (let i=1;i<pts.length-1;i++){ const [jx,jy]=planJitter(pts[i][0],pts[i][1]);
      pts[i]=[pts[i][0]+jx*0.55, pts[i][1]+jy*0.55]; }
  }
  return {hard, pts};
}
// Split one loop's unit edges into maximal same-hardness arcs, cutting also at
// pinch corners so those corners stay exact and lobes kiss: same-region
// pinches (useCount>=2: the boundary passes through the corner twice) and
// cross-material saddles (two solid tiles meeting only at this corner across
// grass — e.g. a soil bed corner touching a path corner diagonally).
function terrainLoopArcs(es, useCount, saddle){
  const n=es.length;
  const isCut=i=>{
    const prev=es[(i+n-1)%n];
    if (prev.hard!==es[i].hard) return true;
    const v=es[i].a;
    if (useCount[v.join(',')]>=2) return true;
    return !!(saddle && saddle(v[0],v[1]));
  };
  const cuts=[];
  for (let i=0;i<n;i++) if (isCut(i)) cuts.push(i);
  if (!cuts.length){                       // uniform loop, no pins — closed treatment
    const raw=es.map(e=>e.a), hard=es[0].hard;
    let pts=mergeCollinearClosed(raw);
    if (!hard){
      pts=simplifyClosedLoop(pts, TERRAIN_SIMPLIFY_EPS)
        .map(([x,y])=>{ const [jx,jy]=planJitter(x,y); return [x+jx*0.55, y+jy*0.55]; });
    }
    return {closed:true, hard, pts};
  }
  const arcs=[];
  for (let c=0;c<cuts.length;c++){
    const i0=cuts[c], i1=cuts[(c+1)%cuts.length];
    let len=(i1-i0+n)%n; if (len===0) len=n;
    const pts=[]; for (let s=0;s<=len;s++) pts.push(es[(i0+s)%n].a);
    arcs.push(finishTerrainArc(es[i0].hard, pts));
  }
  return {closed:false, arcs};
}
/* Append one cached region loop to the current ctx path through an arbitrary
   projector ([gx,gy] tile corners → canvas px) — the garden (iso + elevation
   lift) and the plan sheet (flat paper) draw the SAME geometry. Hard arcs are
   straight exact lines; soft arcs are midpoint-quadratic splines pinned to
   their endpoints; fully-soft loops keep the original closed spline. */
function terrainLoopPath(ctx, loop, proj){
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if (loop.closed){
    const pts=loop.pts.map(proj);
    if (loop.hard || pts.length<3){
      pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath(); return;
    }
    let m=mid(pts[pts.length-1],pts[0]); ctx.moveTo(m[0],m[1]);
    for (let i=0;i<pts.length;i++){ const nn=mid(pts[i],pts[(i+1)%pts.length]);
      ctx.quadraticCurveTo(pts[i][0],pts[i][1],nn[0],nn[1]); }
    ctx.closePath(); return;
  }
  loop.arcs.forEach((arc,ai)=>{
    const pts=arc.pts.map(proj);
    if (ai===0) ctx.moveTo(pts[0][0],pts[0][1]);
    if (arc.hard || pts.length<3){
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    } else {
      for (let i=1;i<pts.length-1;i++){
        const end = i===pts.length-2 ? pts[i+1] : mid(pts[i],pts[i+1]);
        ctx.quadraticCurveTo(pts[i][0],pts[i][1], end[0],end[1]);
      }
    }
  });
  ctx.closePath();
}
function buildTerrainRegions(){
  const sig=terrainRegionKey();
  if (terrainLoopCache.sig===sig && terrainLoopCache.terrainRef===game.terrain &&
      terrainLoopCache.elevRef===game.elevation) return terrainLoopCache.regions;
  const solid={};  // every live terrain tile, any material — the hardness lookup
  const keyOf={};  // "x,y" -> kind|colour|elev (regions split at all three)
  for (const k in game.terrain){ const o=game.terrain[k];
    if (!o || o.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    solid[k]=true;
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
    const unit=traceOutlines(set).map(l=>terrainUnitEdges(l,set,solid));
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
    regions.push({ kind:o.k, c:o.c, elev:elevationAt(+k.slice(0,ci),+k.slice(ci+1))||0, tiles:set,
      loops:unit.map(es=>terrainLoopArcs(es,useCount,saddle)) });
  }
  regions.sort((a,b)=>a.elev-b.elev);   // higher terraces paint over lower edges
  terrainLoopCache={sig, terrainRef:game.terrain, elevRef:game.elevation, regions};
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
    const proj=([gx,gy])=>{ const p=screenOfFlat(gx,gy,W,H); return [p[0],p[1]-lift]; };
    // fill the silhouette
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.fillStyle=base; ctx.fill('evenodd');
    // per-tile texture, clipped to the blob (gravel/mulch/ripples preserved)
    ctx.save();
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.clip('evenodd');
    for (const kk of region.tiles){ const c=kk.indexOf(',');
      const tx=+kk.slice(0,c), ty=+kk.slice(c+1);
      if (tx<x0-2||tx>x1+2||ty<y0-2||ty>y1+2) continue;
      const [sx,sy]=screenOf(tx,ty,W,H);
      const rs=mulberry(tileSeed(tx,ty));
      if (isWater) drawWaterTexture(ctx,sx,sy,tx,ty,o,amb,t);
      else drawGroundTexture(ctx,sx,sy,tx,ty,region.kind,region.kind==='path',amb,base,rs,o);
    }
    ctx.restore();
    // one continuous edge stroke (replaces the per-tile diamond strokes)
    ctx.beginPath();
    for (const loop of region.loops) terrainLoopPath(ctx,loop,proj);
    ctx.strokeStyle = isWater ? (amb.snow?'rgba(255,255,255,0.5)':waterStyle(region.c).edge)
      : region.kind==='path' ? 'rgba(60,48,34,0.32)' : 'rgba(48,36,24,0.30)';
    ctx.lineWidth=1.6; ctx.stroke();
  }
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
const PSPRITE={ map:new Map(), scale:-1, frame:0, rendered:0, bytes:0,
  MEM:48*1024*1024, BUDGET:160, off:false, active:false,
  FLOOR:40, HI_MS:6, LO_MS:2.5, hot:0, calm:0, plantMs:0 };
/* sprite-mode governor: engage the cache when the DRAW PHASE is measured
   heavy, not at a fixed plant count — the old 300-plant threshold left a
   typical 150–250 plant design fully procedural forever, even on a window
   where that costs 10ms+ a frame. Now a garden that's cheap on a fast desktop
   stays pristine procedural, and the same garden on a weak GPU or a huge
   window flips to sprites. Turning sprites ON makes draw fast, so the OFF
   decision can't read the live number (it would flap): it predicts what
   procedural WOULD cost — plantCount × a per-plant ms learned (EMA) while
   procedural was last active — and disengages only when that stays cheap.
   The 40-plant floor keeps genuinely light gardens procedural regardless. */
function updateSpriteMode(drawMs, plantCount){
  if (PSPRITE.off){ PSPRITE.active=false; PSPRITE.hot=0; PSPRITE.calm=0; return; }
  if (!PSPRITE.active){
    if (plantCount>20 && drawMs>0){
      const per=drawMs/plantCount;
      PSPRITE.plantMs = PSPRITE.plantMs ? PSPRITE.plantMs*0.9+per*0.1 : per;
    }
    PSPRITE.hot = (plantCount>PSPRITE.FLOOR && drawMs>PSPRITE.HI_MS) ? PSPRITE.hot+1 : 0;
    if (PSPRITE.hot>=3){ PSPRITE.active=true; PSPRITE.hot=0; PSPRITE.calm=0; }
  } else {
    const predicted=plantCount*(PSPRITE.plantMs||0.02);
    PSPRITE.calm = (plantCount<=PSPRITE.FLOOR || predicted<PSPRITE.LO_MS) ? PSPRITE.calm+1 : 0;
    if (PSPRITE.calm>=45){ PSPRITE.active=false; PSPRITE.calm=0; }
  }
}
function pspriteScale(){ return Math.min(DPR,1.5)*ZOOM; } // cap DPR so retina sprites don't 4x the budget
function pspriteFrame(){                        // once per render: age the cache
  PSPRITE.frame++; PSPRITE.rendered=0; PSPRITE.scale=pspriteScale();
  // Evict only sprites NOT drawn last frame (off-screen), oldest first, down to
  // budget — never the visible set. This is what stops the cache thrashing and
  // flickering when the working set is large (e.g. a dense garden on retina):
  // memory may overshoot to hold everything on screen, but it never re-renders
  // a visible plant it just discarded.
  if (PSPRITE.bytes>PSPRITE.MEM) for (const [k,e] of PSPRITE.map){
    if (PSPRITE.bytes<=PSPRITE.MEM || e.used>=PSPRITE.frame-1) break;
    PSPRITE.bytes-=e.bytes; PSPRITE.map.delete(k);
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
  const halfW=(woody?Math.max(canopy*0.62,H*0.5):H*0.62*Math.max(1,grassW))+18;
  // Cloud grasses can throw a seed veil substantially above their nominal
  // height. Size its sprite for the tallest panicle plus cloud rather than
  // clipping tall, airy forms such as Molinia 'Transparent'.
  const L=P.look||{};
  const herbTop=P.form==='cloudgrass'
    ? Math.max(H*1.12, H*1.05*(L.cloudTop||0.92)+(L.cloudHeight||11)+6)
    : H*1.12;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):herbTop)+26;
  const bot=18, want=pspriteScale();
  // giant woody sprites (a T10-rescaled oak is ~800 draw units tall): clamp
  // the bake RESOLUTION instead of bailing to per-frame procedural — the blit
  // scales it up slightly soft at high zoom, which reads fine on foliage and
  // keeps one oak from costing 13MB of sprite memory.
  const s=Math.min(want, 1024/Math.max(halfW*2, top+bot));
  const pw=Math.max(1,Math.ceil(halfW*2*s)), ph=Math.max(1,Math.ceil((top+bot)*s));
  if (pw>2600||ph>2600) return null;           // absurd size — don't cache, fall back
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); c2.setTransform(s,0,0,s,halfW*s,top*s);
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,detail); // still (sway 0), bucketed bloom
  return { cv, ox:halfW, oy:top, s, want, capped:s<want, bytes:pw*ph*4 };
}
// blit a cached plant if we can, else fall back to a live procedural draw.
function drawPlantMaybeCached(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites){
  if (!useSprites || PSPRITE.off){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  const P=plantDef(key,variant), S=P.sea[season];
  const gB=gbucket(growth,9), bB=(S&&S.bloom)?gbucket(bloomLevel(key),4):0;
  const kk=seed+'|'+key+'|'+(variant||'')+'|'+season+'|'+gB+'|'+bB+'|'+(detail?JSON.stringify(detail):'');
  let e=PSPRITE.map.get(kk);
  // A sprite baked at a very different zoom blits soft, so re-render it (budget
  // permitting) at the current scale. But to keep zooming smooth, reuse the old
  // one for this frame rather than dropping a visible plant to a slow procedural
  // draw — the cache converges back to crisp within a few frames after a zoom.
  // Resolution-capped giants (T10) compare on the REQUESTED scale and never
  // rebake while zooming further in — the bake would come out identical.
  const eScale=e&&(e.want!==undefined?e.want:e.s);
  if (!e || (Math.abs(eScale-PSPRITE.scale) > PSPRITE.scale*0.12 &&
             !(e.capped && PSPRITE.scale>e.s))){
    if (PSPRITE.rendered<PSPRITE.BUDGET){
      const ne=makePlantSprite(key,gB,bB,season,seed,variant,detail);
      if (ne){ if (e) PSPRITE.bytes-=e.bytes; e=ne; PSPRITE.rendered++; PSPRITE.bytes+=e.bytes; }
    }
    if (!e){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  }
  if (PSPRITE.map.has(kk)) PSPRITE.map.delete(kk);   // LRU: re-insert at the end
  e.used=PSPRITE.frame;
  PSPRITE.map.set(kk,e);
  const dw=e.cv.width/e.s, dh=e.cv.height/e.s, lx=bx-e.ox, ly=by-e.oy;
  if (sway){
    ctx.save(); ctx.translate(bx,by); ctx.transform(1,0,sway*0.05,1,0,0); ctx.translate(-bx,-by);
    ctx.drawImage(e.cv,lx,ly,dw,dh); ctx.restore();
  } else ctx.drawImage(e.cv,lx,ly,dw,dh);
}
// cursor footprint: tint each tile of the brush disc so the stamp/erase area
// reads before commit. Reuses the same brushOffsets the paint/erase paths use,
// so the preview can't disagree with what actually gets placed.
function drawBrushGhost(cx,W,H,cxT,cyT,size,mode){
  const fill = mode==='erase' ? 'rgba(200,84,68,0.16)' : 'rgba(224,206,150,0.15)';
  const stroke = mode==='erase' ? 'rgba(236,120,96,0.62)' : 'rgba(240,224,170,0.58)';
  for (const [dx,dy] of brushOffsets(size)){
    const x=cxT+dx, y=cyT+dy;
    if (x<0||y<0||x>=GW||y>=GH) continue;
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
   (markModelChanged in setTile/clearTile/addHouse/applySnapshot/mergeMap);
   wholesale map swaps (load / new garden / legacy fixups) are caught by object
   identity in sceneStale. Side fix: stunting is now computed against the FULL
   tree list — the old per-frame pass used the viewport-culled list, so an
   off-screen tree's shade stopped stunting a visible plant. */
const SCENE_K={FENCE:0,LIGHT:1,FIREPIT:2,BOULDER:3,HOUSE:4,BULB:5,PLANT:6,GHOST:7,PLAYER:8,OTHER:9,BUILDING:10};
let scene={key:null, refs:null, ents:[], shadeTrees:[], futureShadeTrees:[], shrubs:[], lights:[], firepits:[], boulders:[]};
function sceneLayerBits(){
  return (layerShown('perennials')?1:0)|(layerShown('woody')?2:0)|
    (layerShown('bulbs')?4:0)|(layerShown('landscape')?8:0);
}
function sceneKey(){
  return game.rev+'|'+game.rot+'|N'+effectiveSiteNorthDeg()+'|'+absDay()+'|'+sceneLayerBits()+'|'+GW+'x'+GH+
    '|'+(establishedPreviewActive()?1:0);   // preview flips shade trees + stunting
}
function sceneStale(skey){
  const r=scene.refs;
  return scene.key!==skey || !r ||
    r.plants!==game.plants || r.bulbs!==game.bulbs || r.fences!==game.fences ||
    r.lights!==game.lights || r.firepits!==game.firepits || r.boulders!==game.boulders || r.houses!==game.houses || r.buildings!==game.buildings;
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
    for (const b of game.buildings||[]){
      const r=buildingBounds(b); if (!r) continue;
      ents.push({d:buildingDrawDepth(b), kind:SCENE_K.BUILDING,
        bx0:r.x0,bx1:r.x1,by0:r.y0,by1:r.y1,b});
    }
    for (const hh of game.houses)
      ents.push({d:houseDrawDepth(hh), kind:SCENE_K.HOUSE,
        bx0:hh.x,bx1:hh.x+hh.w-1,by0:hh.y,by1:hh.y+hh.h-1, h:hh});
  }
  ents.sort((a,b)=>a.d-b.d);
  scene={key:sceneKey(), refs:{plants:game.plants,bulbs:game.bulbs,fences:game.fences,
    lights:game.lights,firepits:game.firepits,boulders:game.boulders,houses:game.houses,buildings:game.buildings},
    ents, shadeTrees, futureShadeTrees, shrubs, lights, firepits, boulders};
}
// draw one record; returns 1 when it drew a plant/bulb (the sprite-cache count)
function drawSceneEnt(e,W,H,season,sway,useSprites,t){
  switch(e.kind){
    case SCENE_K.FENCE: drawFence(cx,W,H,season,e.f,e.x,e.y); return 0;
    case SCENE_K.LIGHT: drawLightFixture(cx,W,H,season,e.l,e.x,e.y,game.layerVis.night); return 0;
    case SCENE_K.FIREPIT: drawFirepit(cx,W,H,season,e.f,e.x,e.y); return 0;
    case SCENE_K.BOULDER: drawBoulder(cx,W,H,season,e.b,e.x,e.y); return 0;
    case SCENE_K.BUILDING: drawBuilding(cx,W,H,season,e.b); return 0;
    case SCENE_K.HOUSE: drawHouse(cx,W,H,season,e.h); return 0;
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
    case SCENE_K.PLAYER:{
      const [sx,sy]=screenOf(e.x,e.y,W,H);
      drawCritter(cx,sx,sy+TILE_H/2,game.char,t,game.moving,1);
      cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
      const nm=game.char.name||'You', wN=cx.measureText(nm).width;
      cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
      cx.fillStyle='#f3ecdd'; cx.textAlign='center'; cx.fillText(nm,sx,sy-31);
      return 0;
    }
    case SCENE_K.OTHER:{
      const o=e.o, [sx,sy]=screenOf(o.x,o.y,W,H);
      drawCritter(cx,sx,sy+TILE_H/2,{species:o.sp,coat:o.c,coatD:o.cd,mark:o.m},t,false,1);
      cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
      const wN=cx.measureText(o.n).width;
      cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
      cx.fillStyle='#cfe3c2'; cx.textAlign='center'; cx.fillText(o.n,sx,sy-31);
      return 0;
    }
  }
  return 0;
}
/* ---------- season crossfade ----------
   Seasons used to flip abruptly (sky, ground, every plant) on the frame the
   day counter crossed the boundary — jarring mid-fast-forward and after the
   menu's Skip. Blending colors per frame would defeat the season-keyed ground
   bake and sprite caches, so instead the LAST frame of the old season is
   snapshotted once and faded out over the new season's live frames: one
   drawImage per frame for ~1.1s, no cache touched. */
const SEASON_FADE_MS=1100;
const seasonFade={cv:null, t0:0, active:false, last:null};
const seasonFadeRMQ=(typeof matchMedia==='function') ? matchMedia('(prefers-reduced-motion: reduce)') : null;
function seasonFadeActive(){ return seasonFade.active; }
function resetSeasonFade(){ seasonFade.active=false; seasonFade.cv=null; seasonFade.last=null; }
function maybeStartSeasonFade(t,season){
  if (seasonFade.last && seasonFade.last!==season && !game.photo &&
      !(seasonFadeRMQ && seasonFadeRMQ.matches)){
    if (!seasonFade.cv) seasonFade.cv=document.createElement('canvas');
    if (seasonFade.cv.width!==cnv.width || seasonFade.cv.height!==cnv.height){
      seasonFade.cv.width=cnv.width; seasonFade.cv.height=cnv.height; }
    const fcx=seasonFade.cv.getContext('2d');
    fcx.clearRect(0,0,seasonFade.cv.width,seasonFade.cv.height);
    fcx.drawImage(cnv,0,0);                     // canvas still shows the OLD season here
    seasonFade.t0=t; seasonFade.active=true;
  }
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
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  maybeStartSeasonFade(t,cal.season);            // must run before the sky pass clears the frame
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  // sky
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,amb.sky[0]); g.addColorStop(1,amb.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,W,H);
  drawSeasonSky(cx,W,H,cal.season);

  // camera eases toward the player in avatar modes; design mode keeps a free camera.
  if (game.gameMode!=='design'){
    const [ptx,pty]=screenOf(game.px,game.py,W,H);
    cam.x += (ptx-W/2)*0.06; cam.y += (pty-H*0.45)*0.06;
  }
  const tCompass=dnow(); updateCompass(); dmark('compass',tCompass);

  const sway = Math.sin(t*0.0012);
  pspriteFrame();

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
  const tScene=dnow();
  if (sceneStale(sceneKey())) buildScene(W,H);
  dmark('gather',tScene);

  const tG0=dnow();
  // world-anchored ground layer: bake viewport+margin keyed WITHOUT cam/zoom,
  // then blit per frame (see the note at the top of this file).
  const gkey=cal.season+'|'+game.rot+'|'+game.edgeStyle+'|'+
    (layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height+'|'+groundDataKey();
  const MD=Math.round(GROUND_MARGIN_CSS*DPR);          // margin in device px
  if (!groundCanvas){ groundCanvas=document.createElement('canvas'); groundCtx=groundCanvas.getContext('2d'); }
  if (groundCanvas.width!==cnv.width+2*MD||groundCanvas.height!==cnv.height+2*MD){
    groundCanvas.width=cnv.width+2*MD; groundCanvas.height=cnv.height+2*MD; groundKey=''; }
  if (ZOOM!==groundZoomPrev){ groundZoomT=t; groundZoomPrev=ZOOM; }        // zoom gesture heat
  if (cam.x!==groundCamPrevX||cam.y!==groundCamPrevY){ groundCamT=t; groundCamPrevX=cam.x; groundCamPrevY=cam.y; }
  const zoomStale=ZOOM!==groundZoom;
  const camStale=cam.x!==groundCamX||cam.y!==groundCamY;
  const panDev=Math.max(Math.abs(cam.x-groundCamX),Math.abs(cam.y-groundCamY))*DPR*ZOOM;
  const mustBake = gkey!==groundKey
    || groundRefsChanged()
    || panDev>=MD
    || (zoomStale && (t-groundZoomT>GROUND_ZOOM_SETTLE || Math.abs(ZOOM/groundZoom-1)>GROUND_ZOOM_DRIFT))
    || (camStale && !zoomStale && t-groundCamT>GROUND_PAN_SETTLE);
  if (mustBake){
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
    groundKey=gkey; groundCamX=cam.x; groundCamY=cam.y; groundZoom=ZOOM;
    groundRefs={terrain:game.terrain,elevation:game.elevation,houses:game.houses};
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
  drawSiteUnderlay(cx,W,H);
  dmark('ground',tG0);
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
  // hover/selection cursor on player's tile
  const [hx,hy]=screenOf(game.tx,game.ty,W,H);
  cx.strokeStyle='rgba(243,236,221,0.85)'; cx.lineWidth=2;
  cx.beginPath(); cx.moveTo(hx,hy+2); cx.lineTo(hx+TILE_W/2-3,hy+TILE_H/2);
  cx.lineTo(hx,hy+TILE_H-2); cx.lineTo(hx-TILE_W/2+3,hy+TILE_H/2); cx.closePath(); cx.stroke();
  if (game.hoverTile && PLANTS[game.tool] && layerShown(toolTargetLayer(game.tool))){
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

  // depth-sorted entities: the persistent scene list is already sorted, so a
  // frame only culls each record (numeric compares) and merges in the handful
  // of per-frame dynamic entities (house ghost, avatar, other gardeners).
  dmark('cursor',tCursor);
  const tGather=dnow();
  const dyn=[];
  if (ghost) dyn.push({d:houseDrawDepth(ghost)+0.01, kind:SCENE_K.GHOST, h:ghost});
  if (game.gameMode!=='design')
    dyn.push({d:viewDepth(game.px,game.py)+0.5, kind:SCENE_K.PLAYER, x:game.px, y:game.py});
  for (const id in game.others){ const o=game.others[id];
    if (Date.now()-o.ts > 30000) continue;
    dyn.push({d:viewDepth(o.x,o.y)+0.5, kind:SCENE_K.OTHER, o});
  }
  dmark('gather',tGather);
  const tSort=dnow(); if (dyn.length>1) dyn.sort((a,b)=>a.d-b.d); dmark('sort',tSort);
  const useSprites = PSPRITE.active;   // set by the governor at last frame's end
  const tDraw=dnow(), tDrawWall=performance.now();
  const sents=scene.ents;
  let plantCount=0, drawn=0, di=0;
  for (let i=0;i<sents.length;i++){
    const e=sents[i];
    while (di<dyn.length && dyn[di].d<=e.d){
      plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites,t); drawn++; }
    if (e.bx1<x0||e.bx0>x1||e.by1<y0||e.by0>y1) continue;
    plantCount+=drawSceneEnt(e,W,H,cal.season,sway,useSprites,t);
    drawn++;
  }
  while (di<dyn.length){
    plantCount+=drawSceneEnt(dyn[di++],W,H,cal.season,sway,useSprites,t); drawn++; }
  dmark('draw',tDraw);
  drawBuildingDraftOverlay(cx,W,H);
  updateSpriteMode(performance.now()-tDrawWall, plantCount);
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

  // selection tool: marquee, committed selection, and move/copy ghost
  if (game.tool==='select') drawSelectionOverlay(cx,W,H,t,cal.season,sway);
  drawRulerOverlay(cx,W,H);
  drawToolDragMetric(cx,W,H);
  if (game.layerVis.edgeRulers && VW>640) drawSelectionMetrics(cx,W,H,{x0:0,y0:0,x1:GW-1,y1:GH-1});
  if (typeof positionSelectionActions==='function') positionSelectionActions();

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
  dmark('fx',tFx);
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
