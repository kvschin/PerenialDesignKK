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
let groundCanvas=null, groundCtx=null, groundKey='';
let groundCamX=0, groundCamY=0, groundZoom=1;          // camera/zoom at bake time
let groundZoomPrev=-1, groundZoomT=-1e9;               // last zoom tick, for settle
let groundCamPrevX=NaN, groundCamPrevY=NaN, groundCamT=-1e9; // last cam tick, for settle
const GROUND_MARGIN_CSS=200;    // pan headroom baked around the viewport, CSS px
const GROUND_ZOOM_SETTLE=140;   // ms after the last zoom tick before the crisp rebake
const GROUND_PAN_SETTLE=180;    // ms after the last cam move before the crisp rebake
const GROUND_ZOOM_DRIFT=0.18;   // mid-gesture rebake if scale drifts this far from the bake
function groundDataSig(){
  let s='';
  for (const k in game.terrain){ const o=game.terrain[k]; if (o&&!o.removed) s+=k+o.k+(o.c||'')+';'; }
  for (const k in game.elevation){ const o=game.elevation[k]; if (o&&!o.removed) s+='e'+k+o.h+';'; }
  const hs=game.houses||[]; for (let i=0;i<hs.length;i++){ const h=hs[i]; s+='H'+h.x+','+h.y+','+h.w+','+h.h+';'; }
  return s;
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
/* ---------- organic terrain: smoothed region blobs (Wave 3) ----------
   Reuses the plan sheet's traceOutlines pipeline. Contiguous same-material
   (kind+colour) tiles flood into regions; each region's rectilinear boundary
   is traced ONCE and cached in world (tile-corner) space, keyed by
   groundDataSig() so tracing runs only on edit — never per pan frame. The
   per-frame cost is just projecting cached corners through screenOf and
   drawing a midpoint-quadratic spline (inward-bounded, so it never claims
   ground the tile rules don't). The per-tile texture pass runs clipped to the
   blob, so gravel/mulch/water detail is preserved; grass shows in cut corners. */
let terrainLoopCache={sig:null, regions:[]};
// Douglas–Peucker on a closed boundary loop: `traceOutlines` renders a diagonal
// edge as a rectilinear staircase (right/down/right/down); left alone, the
// spline uses each step corner as a control point and scallops into a zigzag.
// Collapsing the staircase to its endpoints first makes it draw as one straight
// diagonal. eps is in tiles: a 45° staircase deviates ~0.71 from its ideal
// chord and a genuine one-tile jog deviates ~1, so ~0.9 erases the artifact
// while keeping real notches. Runs only on edit (cached), so cost is irrelevant.
const TERRAIN_SIMPLIFY_EPS=0.9;
function simplifyClosedLoop(pts, eps){
  if (pts.length<=4) return pts;
  const segDist=(p,a,b)=>{
    const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy;
    if (L2<1e-12) return Math.hypot(p[0]-a[0],p[1]-a[1]);
    let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2; t=t<0?0:t>1?1:t;
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
  };
  const dp=(arr)=>{
    if (arr.length<3) return arr.slice();
    let idx=-1, max=0;
    for (let i=1;i<arr.length-1;i++){ const d=segDist(arr[i],arr[0],arr[arr.length-1]);
      if (d>max){ max=d; idx=i; } }
    if (max>eps) return dp(arr.slice(0,idx+1)).slice(0,-1).concat(dp(arr.slice(idx)));
    return [arr[0], arr[arr.length-1]];
  };
  // anchor on two extreme, guaranteed-real corners so no kink is introduced
  let a0=0; for (let i=1;i<pts.length;i++){ const p=pts[i], q=pts[a0];
    if (p[0]<q[0] || (p[0]===q[0] && p[1]<q[1])) a0=i; }
  let a1=a0, best=-1;
  for (let i=0;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[a0][0], pts[i][1]-pts[a0][1]);
    if (d>best){ best=d; a1=i; } }
  const lo=Math.min(a0,a1), hi=Math.max(a0,a1);
  if (hi-lo<1) return pts;
  const out=dp(pts.slice(lo,hi+1)).slice(0,-1)
    .concat(dp(pts.slice(hi).concat(pts.slice(0,lo+1))).slice(0,-1));
  return out.length>=3 ? out : pts;
}
function buildTerrainRegions(){
  const sig=groundDataSig();
  if (terrainLoopCache.sig===sig) return terrainLoopCache.regions;
  const keyOf={}; // "x,y" -> "kind|colour"
  for (const k in game.terrain){ const o=game.terrain[k];
    if (o && !o.removed) keyOf[k]=o.k+'|'+(o.c||''); }
  const seen={}, regions=[];
  for (const k in keyOf){
    if (seen[k]) continue;
    const key=keyOf[k], stack=[k], set=new Set();
    seen[k]=true;
    while (stack.length){
      const cur=stack.pop(); set.add(cur);
      const [cx2,cy2]=cur.split(',').map(Number);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nk=`${cx2+dx},${cy2+dy}`;
        if (seen[nk] || keyOf[nk]!==key) continue;
        seen[nk]=true; stack.push(nk);
      }
    }
    const o=game.terrain[k];
    regions.push({ kind:o.k, c:o.c, tiles:set,
      loops:traceOutlines(set).map(l=>simplifyClosedLoop(l,TERRAIN_SIMPLIFY_EPS)) });
  }
  terrainLoopCache={sig, regions};
  return regions;
}
// append one smoothed loop (jittered corners + midpoint quadratic) to the
// current path — no beginPath, so multiple loops accumulate for one fill/clip
function addSmoothTerrainLoop(ctx,loop,W,H){
  const pts=loop.map(([gx,gy])=>{ const [jx,jy]=planJitter(gx,gy);
    return screenOf(gx+jx*0.55, gy+jy*0.55, W, H); });
  if (pts.length<3){ pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); return; }
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  let m=mid(pts[pts.length-1],pts[0]); ctx.moveTo(m[0],m[1]);
  for (let i=0;i<pts.length;i++){ const n=mid(pts[i],pts[(i+1)%pts.length]);
    ctx.quadraticCurveTo(pts[i][0],pts[i][1],n[0],n[1]); }
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
    // fill the smoothed silhouette
    ctx.beginPath();
    for (const loop of region.loops) addSmoothTerrainLoop(ctx,loop,W,H);
    ctx.fillStyle=base; ctx.fill('evenodd');
    // per-tile texture, clipped to the blob (gravel/mulch/ripples preserved)
    ctx.save();
    ctx.beginPath();
    for (const loop of region.loops) addSmoothTerrainLoop(ctx,loop,W,H);
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
    for (const loop of region.loops) addSmoothTerrainLoop(ctx,loop,W,H);
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
  const H=P.h*(0.25+0.75*growth);
  // the box must cover the whole drawing — woody canopies reach well above P.h
  // and wide of P.cw, so trees clip if we size from P.h alone.
  const woody=P.type==='tree'||P.type==='shrub';
  const canopy=(isShrubDef(P)?(shrubVisualCw(P)||50):(P.cw||80))*(0.3+0.7*growth);
  const halfW=(woody?Math.max(canopy*0.62,H*0.5):H*0.62)+18;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):H*1.12)+26;
  const bot=18, s=pspriteScale();
  const pw=Math.max(1,Math.ceil(halfW*2*s)), ph=Math.max(1,Math.ceil((top+bot)*s));
  if (pw>2600||ph>2600) return null;           // absurd size — don't cache, fall back
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); c2.setTransform(s,0,0,s,halfW*s,top*s);
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,detail); // still (sway 0), bucketed bloom
  return { cv, ox:halfW, oy:top, s, bytes:pw*ph*4 };
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
  if (!e || Math.abs(e.s-PSPRITE.scale) > PSPRITE.scale*0.12){
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
const SCENE_K={FENCE:0,LIGHT:1,FIREPIT:2,HOUSE:3,BULB:4,PLANT:5,GHOST:6,PLAYER:7,OTHER:8};
let scene={key:null, refs:null, ents:[], shadeTrees:[], futureShadeTrees:[], shrubs:[], lights:[], firepits:[]};
function sceneLayerBits(){
  return (layerShown('perennials')?1:0)|(layerShown('woody')?2:0)|
    (layerShown('bulbs')?4:0)|(layerShown('landscape')?8:0);
}
function sceneKey(){
  return game.rev+'|'+game.rot+'|'+absDay()+'|'+sceneLayerBits()+'|'+GW+'x'+GH;
}
function sceneStale(skey){
  const r=scene.refs;
  return scene.key!==skey || !r ||
    r.plants!==game.plants || r.bulbs!==game.bulbs || r.fences!==game.fences ||
    r.lights!==game.lights || r.firepits!==game.firepits || r.houses!==game.houses;
}
function buildScene(W,H){
  const ents=[], shadeTrees=[], futureShadeTrees=[], shrubs=[], lights=[], firepits=[];
  const plantRecs=[];
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (layerShown('woody')){
      const shrub=shrubInfoFromKey(k);
      if (shrub){ shrub.cullR=Math.ceil(shrubRadiusTiles(plantDef(p.s,p.v)))+1; shrubs.push(shrub); }
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
    if (P2 && P2.sun!=='part' && P2.type!=='tree')
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
    for (const hh of game.houses)
      ents.push({d:houseDrawDepth(hh), kind:SCENE_K.HOUSE,
        bx0:hh.x,bx1:hh.x+hh.w-1,by0:hh.y,by1:hh.y+hh.h-1, h:hh});
  }
  ents.sort((a,b)=>a.d-b.d);
  scene={key:sceneKey(), refs:{plants:game.plants,bulbs:game.bulbs,fences:game.fences,
    lights:game.lights,firepits:game.firepits,houses:game.houses},
    ents, shadeTrees, futureShadeTrees, shrubs, lights, firepits};
}
// draw one record; returns 1 when it drew a plant/bulb (the sprite-cache count)
function drawSceneEnt(e,W,H,season,sway,useSprites,t){
  switch(e.kind){
    case SCENE_K.FENCE: drawFence(cx,W,H,season,e.f,e.x,e.y); return 0;
    case SCENE_K.LIGHT: drawLightFixture(cx,W,H,season,e.l,e.x,e.y,game.layerVis.night); return 0;
    case SCENE_K.FIREPIT: drawFirepit(cx,W,H,season,e.f,e.x,e.y); return 0;
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
function render(t){
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
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
    (layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height+'|'+groundDataSig();
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
  dmark('ground',tG0);
  const tShade=dnow();
  if (layerShown('woody')) for (const sh of scene.shrubs){
    if (sh.x+sh.cullR<x0 || sh.x-sh.cullR>x1 || sh.y+sh.cullR<y0 || sh.y-sh.cullR>y1) continue;
    drawShrubFootprint(cx,W,H,sh,'base');
  }
  // active shade is a cool wash; young trees get only a faint future-canopy edge.
  for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
    const [sx,sy]=screenOf(xx,yy,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    const a=shadeActiveAlphaAt(xx,yy);
    if (a>0) tileDiamond(cx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
    else if (shadeFutureDrawScoreAt(xx,yy)>=SHADE_FUTURE_SCORE)
      tileDiamond(cx,sx,sy,null,'rgba(210,168,92,0.34)',[5,5]);
  }
  // Shade-suitability overlay (Layers view): wash every tile by how much
  // canopy reaches it — amber = full sun, teal = shade, between = part shade
  if (game.layerVis.shade){
    for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
      const score=shadeScoreAt(xx,yy);
      const [sx,sy]=screenOf(xx,yy,W,H);
      if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
      const col = score>=SHADE_ACTIVE_SCORE ? 'rgba(38,84,112,0.52)'      // shade — cool blue
        : score>0 ? 'rgba(70,132,128,0.44)'                              // part shade — teal
        : 'rgba(232,180,78,0.40)';                                       // full sun — amber
      tileDiamond(cx,sx,sy,col,null);
    }
  }
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
  const a=tileCenterScreen(toolDrag.sx,toolDrag.sy,W,H);
  const b=tileCenterScreen(toolDrag.cx||toolDrag.sx,toolDrag.cy||toolDrag.sy,W,H);
  drawSelDimLine(cx,a,b,distanceMetricLabel([toolDrag.sx,toolDrag.sy],[toolDrag.cx||toolDrag.sx,toolDrag.cy||toolDrag.sy]),1);
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
      if (c.bulb) drawPlant(cx,sx,sy+TILE_H/2,c.bulb.s,displayPlantGrowth(c.bulb),season,(tileSeed(nx,ny)^0x9e37)>>>0,sway,c.bulb.v);
      if (c.plant) drawPlant(cx,sx,sy+TILE_H/2,c.plant.s,displayPlantGrowth(c.plant),season,tileSeed(nx,ny),sway,c.plant.v);
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
}
