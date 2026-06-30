'use strict';
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
  MEM:48*1024*1024, BUDGET:160, MIN:300, off:false, active:false };
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
function render(t){
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  // sky
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,amb.sky[0]); g.addColorStop(1,amb.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,W,H);
  drawSeasonSky(cx,W,H,cal.season);

  // camera eases toward the player (story + visiting; design and Hand tool pan
  // freely — but a visit always follows the avatar, since its tool stays 'hand')
  if (game.visiting || (game.gameMode!=='design' && game.tool!=='hand')){
    const [ptx,pty]=screenOf(game.px,game.py,W,H);
    cam.x += (ptx-W/2)*0.06; cam.y += (pty-H*0.45)*0.06;
  }

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

  const tG0=dnow();
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
  dmark('ground',tG0);
  const tShade=dnow();
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
  dmark('shade',tShade);
  const tCursor=dnow();
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
  dmark('cursor',tCursor);
  const tGather=dnow();
  const ents=[];
  let plantCount=0, useSprites=false;          // sprite cache kicks in only when dense (set after gather)
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
    plantCount++;
    ents.push({depth:plantDepth(x,y,p)+0.25, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,p.s,gB,cal.season,(tileSeed(x,y)^0x9e37)>>>0,sway,p.v,undefined,useSprites);}});
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
    plantCount++;
    ents.push({depth:plantDepth(x,y,p)+0.3, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,p.s,g2v,cal.season,tileSeed(x,y),sway,p.v,detail,useSprites);}});
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
  // dense gardens only — keeps light ones pristine. Hysteresis (on >MIN, off
  // <0.7·MIN) stops a flicker between procedural/cached while panning the edge.
  PSPRITE.active = !PSPRITE.off && plantCount > (PSPRITE.active ? PSPRITE.MIN*0.7 : PSPRITE.MIN);
  useSprites = PSPRITE.active;
  dmark('gather',tGather);
  const tSort=dnow(); ents.sort((a,b)=>a.depth-b.depth); dmark('sort',tSort);
  const tDraw=dnow(); ents.forEach(e=>e.draw()); dmark('draw',tDraw);
  if (dbg.on){ dbg.ents=ents.length; dbg.tiles=(x1-x0+1)*(y1-y0+1); }
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
  const overlay=['gardenMenu','exportScreen','regionScreen','planScreen']
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
// Cheap structural hash of every layer for undo change-detection — folds keys
// and values into one number, so begin/commit no longer JSON-serialize (and
// allocate + string-compare) the whole garden twice per gesture. A true
// revision counter would be cleaner, but reliably bumping it needs a single
// mutation chokepoint (the deferred refactor #3); this gets the same win
// centrally, without scattering rev++ across every write site.
function stateSig(){
  let h=2166136261;
  const mix=n=>{ h^=n|0; h=Math.imul(h,16777619); };
  const fold=v=>{
    if (v==null){ mix(1); return; }
    const t=typeof v;
    if (t==='number'){ mix(v|0); mix((v*4096)|0); }
    else if (t==='boolean'){ mix(v?3:2); }
    else if (t==='string'){ for (let i=0;i<v.length;i++) mix(v.charCodeAt(i)); mix(v.length); }
    else if (Array.isArray(v)){ for (let i=0;i<v.length;i++) fold(v[i]); mix(v.length); }
    else for (const k in v){ for (let i=0;i<k.length;i++) mix(k.charCodeAt(i)); fold(v[k]); }
  };
  for (const L of GAME_LAYERS) fold(game[L.k]);
  return h>>>0;
}
function snapshotState(){
  const s={};
  for (const L of GAME_LAYERS) s[L.k]=JSON.parse(JSON.stringify(game[L.k]||(L.array?[]:{})));
  return s;
}
// a new action invalidates the redo chain (standard undo/redo semantics)
function pushUndo(snap){ undoStack.push(snap); if (undoStack.length>30) undoStack.shift();
  redoStack.length=0; updateUndoBtn(); }
function beginUndo(){ pendSig=stateSig(); pendSnap=snapshotState(); }
function commitUndo(){ if (pendSig!==null && stateSig()!==pendSig) pushUndo(pendSnap); pendSig=null; pendSnap=null; }
function cancelPendingUndo(restore){
  if (restore && pendSnap && pendSig!==null && stateSig()!==pendSig) applySnapshot(pendSnap);
  pendSig=null; pendSnap=null;
}
function withUndo(fn){ const sig=stateSig(), snap=snapshotState(); fn();
  if (stateSig()!==sig) pushUndo(snap); }
function applySnapshot(s){ // restore every layer + refresh UI
  for (const L of GAME_LAYERS) game[L.k]=s[L.k]||(L.array?[]:{});
  game.dirty=true; updateUndoBtn();
  if (game.mode==='multi') for (const L of GAME_LAYERS) L.sync();
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
const activePtrs=new Map(); let pinch=null, toolDrag=null, fillTap=null;
function cancelCanvasGesture(restore){
  cancelPendingUndo(restore);
  sweep=null; toolDrag=null; fillTap=null; panDrag=null; selDrag=null; selMove=null;
  game.pathTarget=null; game.sleepOnArrive=false;
  updateCanvasCursor();
}
cnv.addEventListener('pointerdown',e=>{
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (activePtrs.size===2){
    const [a,b2]=[...activePtrs.values()];
    pinch={d0:Math.hypot(a[0]-b2[0],a[1]-b2[1])||1, z0:userZoom,
           cx0:(a[0]+b2[0])/2, cy0:(a[1]+b2[1])/2,   // centroid, for two-finger pan
           camx0:cam.x, camy0:cam.y};
    cancelCanvasGesture(true);
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
  if (fillActive()){ // bucket fill commits on pointerup so a pinch can still cancel it
    fillTap={x,y};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
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
  if (game.visiting){ // read-only stroll: walk to walkable tiles, never edit
    if (x<0||y<0||x>=GW||y>=GH) return;
    if (inHouse(x,y)||tileTerrain(x,y)==='water'||fenceBlocks(x,y)||lightAt(x,y)||firepitAt(x,y)) return;
    game.sleepOnArrive=false; game.pathTarget=[x,y]; return;
  }
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
  if (fillTap){ const f=fillTap; fillTap=null; doFloodFill(f.x,f.y); return; }
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
  cancelCanvasGesture(true);
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

