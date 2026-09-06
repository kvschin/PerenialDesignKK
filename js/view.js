'use strict';
/* ---------- canvas / viewport glue ---------- */
const cnv = document.getElementById('gameCanvas');
const cx = cnv.getContext('2d');
function canvasViewportRect(){
  const r=cnv&&cnv.getBoundingClientRect ? cnv.getBoundingClientRect() : null;
  return {left:r&&Number.isFinite(r.left)?r.left:0,top:r&&Number.isFinite(r.top)?r.top:0,
    width:r&&r.width?r.width:VW,height:r&&r.height?r.height:VH};
}
function canvasClientPoint(e){
  const r=canvasViewportRect(); return {x:e.clientX-r.left,y:e.clientY-r.top};
}
/* Cap the canvas backing scale at 1.5x: past that the extra pixels are
   invisible in a painterly isometric scene but every full-screen pass (sky,
   ground blit, season tint) pays for them — a 4K@2x buffer is 16.6M px.
   1.5 matches the sprite cache's cap (pspriteScale), so sprite blits stay 1:1. */
let DPR = Math.min(1.5, window.devicePixelRatio||1);
/* view zoom: a small-screen base (phones start at 0.75x for ~1.3x more
   garden) times the player's own zoom - pinch, wheel, +/- keys, or the
   zoom pill. All drawing and input math runs through ZOOM. */
let ZOOM = 1, baseZoom = 1, userZoom = 1;
/* Two different ceilings, and they were three copied literals before this.
   ZOOM_MAX is the on-screen scale the pill reports; USER_ZOOM_MAX is the
   multiplier applied BEFORE baseZoom, so it has to be bigger or a phone can
   never reach the top of the range: baseZoom is 0.75 there, so 200% on screen
   needs userZoom 2.67. The old pair (1.8 / 2.2) capped the display at 180% and
   a phone at 165% — which is why small plants were hard to read on exactly the
   device where they are smallest. Zooming IN is cheap: fewer tiles are visible,
   so the ground bake and entity list shrink, and the sprite cache is already
   capped at 1.5x DPR. */
const ZOOM_MIN=0.4, ZOOM_MAX=2.0;
const USER_ZOOM_MIN=0.4, USER_ZOOM_MAX=2.8;
/* "Is this a phone-sized screen?", asked of the SHORTER side, because a phone
   in landscape is still a phone (and is DOCK for layout, so the responsive tier
   cannot answer this one). The threshold was 760, which is not a phone number:
   the largest phone is ~440 CSS px across its short side, while a 1280x720
   laptop is 720 and a browser window shorter than 760 is commonplace. So every
   720p desktop silently took the phone zoom and drew 1.8x the world area —
   measured on the bench garden, 1,794 tiles and 1,068 entities against 1,248
   and 795, and 8.95ms of frame JavaScript against 5.92ms. A 34% cliff crossed
   by resizing a window.
   600 leaves every real phone below it with room to spare and every tablet and
   laptop above it, so the only screens whose framing changes are the ones in
   the 600-759 gap this was never meant to catch. */
const PHONE_ZOOM_MAX_SIDE=600;
function calcZoom(){
  baseZoom = Math.min(innerWidth,innerHeight)<PHONE_ZOOM_MAX_SIDE ? 0.75 : 1;
  ZOOM = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, baseZoom*userZoom));
}
function setUserZoom(z){
  userZoom = Math.max(USER_ZOOM_MIN, Math.min(USER_ZOOM_MAX, z));
  calcZoom();   // no snapCam: the designer's camera is free and stays where it is
  updateZoomPill();
  tourNote('look');   // the tour camera step: every zoom route funnels here
}
function zoomBy(f){ setUserZoom(userZoom*f); }
function updateZoomPill(){
  const lab=document.getElementById('zoomLabel');
  if (lab) lab.textContent=Math.round(ZOOM*100)+'%';
}
/* The garden is a canvas workspace, not an empty viewport: the top bar, tool
   rail and bottom sheet can all claim part of it. Floating controls and camera
   recovery share this one rectangle so a selection pill, a building draft, or
   Fit Plot never lands beneath the editing chrome. It deliberately reads live
   DOM bounds only on state changes / explicit callers, never in render(). */
/* CACHED, because the comment above is a promise the code was not keeping:
   positionSelectionActions calls this from inside render(), so with a selection
   live every frame did a getComputedStyle and five getBoundingClientRects — and
   updateCompass writes style.transform earlier in the same frame whenever the
   camera has moved, so the layout was always dirty when this read it. Write,
   then read, every frame: textbook thrash. Measured, a getBoundingClientRect on
   a dirty layout costs 463us in this app's 1,645-node DOM, and the call cost
   330us of every frame of a marquee drag.
   Nothing this measures moves with the camera — the bar, the rail, the sheet and
   the site-photo editor change only when the CHROME changes — so the answer is
   cached and invalidated two ways: explicitly from settleViewportChange (which
   every tier, dock, sheet and orientation change already funnels through), and
   by a ResizeObserver over the elements themselves, which catches whatever the
   explicit path misses. */
let usableRectCache=null, usableRectObs=null;
function invalidateUsableRect(){ usableRectCache=null; }
function watchUsableRect(){
  if (typeof ResizeObserver!=='function') return;
  if (!usableRectObs) usableRectObs=new ResizeObserver(invalidateUsableRect);
  // re-resolved on every measure, because #sitePhotoEditor is built on demand
  // and would never be observed if we only looked once. Observing an element
  // twice is a no-op.
  for (const sel of ['.hud-top','#canvasTools','.hud-bottom','#sitePhotoEditor','#gameCanvas']){
    const el=document.querySelector(sel); if (el) usableRectObs.observe(el);
  }
}
function usableCanvasRect(){
  if (usableRectCache && usableRectCache.vw===VW && usableRectCache.vh===VH) return usableRectCache.r;
  watchUsableRect();
  const r=measureUsableCanvasRect();
  usableRectCache={vw:VW, vh:VH, r};
  return r;
}
function measureUsableCanvasRect(){
  const out={left:8,top:8,right:Math.max(8,VW-8),bottom:Math.max(8,VH-8)};
  const frame=canvasViewportRect();
  const take=(el,edge)=>{
    if (!el || el.classList.contains('hidden')) return;
    const cs=getComputedStyle(el);
    if (cs.display==='none' || cs.visibility==='hidden') return;
    const raw=el.getBoundingClientRect(); if (!raw.width || !raw.height) return;
    const r={left:raw.left-frame.left,right:raw.right-frame.left,
      top:raw.top-frame.top,bottom:raw.bottom-frame.top,width:raw.width,height:raw.height};
    if (edge==='top') out.top=Math.max(out.top,Math.min(VH-8,r.bottom+8));
    if (edge==='bottom') out.bottom=Math.min(out.bottom,Math.max(8,r.top-8));
    if (edge==='left') out.left=Math.max(out.left,Math.min(VW-8,r.right+8));
    if (edge==='right') out.right=Math.min(out.right,Math.max(8,r.left-8));
  };
  take(document.querySelector('.hud-top'),'top');
  const rail=document.getElementById('canvasTools');
  if (rail){ const rr=rail.getBoundingClientRect(); take(rail,rr.left-frame.left+rr.width/2>VW/2?'right':'left'); }
  const sheet=document.querySelector('.hud-bottom');
  if (sheet && !sheet.classList.contains('sheet-collapsed') && getComputedStyle(sheet).visibility!=='hidden'){
    const r=sheet.getBoundingClientRect();
    if (r.width && r.height){
      const sideDocked=r.left>VW*.45 && r.top<VH*.3 && r.height>VH*.45;
      if (sideDocked) out.right=Math.min(out.right,Math.max(8,r.left-8));
      else out.bottom=Math.min(out.bottom,Math.max(8,r.top-8));
    }
  }
  take(document.getElementById('sitePhotoEditor'),'bottom');
  if (out.right-out.left<120){ out.left=8; out.right=Math.max(8,VW-8); }
  if (out.bottom-out.top<120){ out.top=8; out.bottom=Math.max(8,VH-8); }
  return out;
}
function fitPlot(){
  if (!game.inGarden) return;
  calcZoom();
  const corners=[[0,0],[GW-1,0],[0,GH-1],[GW-1,GH-1]].map(([x,y])=>worldToView(x,y));
  const xs=corners.map(p=>isoX(p[0],p[1])), ys=corners.map(p=>isoY(p[0],p[1]));
  const minX=Math.min(...xs)-TILE_W, maxX=Math.max(...xs)+TILE_W;
  const minY=Math.min(...ys)-TILE_H, maxY=Math.max(...ys)+TILE_H*2;
  const worldW=Math.max(1,maxX-minX), worldH=Math.max(1,maxY-minY);
  const safe=usableCanvasRect();
  const availW=Math.max(180,safe.right-safe.left);
  const availH=Math.max(180,safe.bottom-safe.top);
  const targetZoom=Math.max(0.42,Math.min(1.45,Math.min(availW/worldW,availH/worldH)));
  userZoom=Math.max(USER_ZOOM_MIN,Math.min(USER_ZOOM_MAX,targetZoom/baseZoom));
  calcZoom();
  const W=VW/ZOOM, H=VH/ZOOM;
  const wantX=(safe.left+safe.right)/(2*ZOOM), wantY=(safe.top+safe.bottom)/(2*ZOOM);
  cam.x=W/2+(minX+maxX)/2-wantX;
  cam.y=H*0.24+(minY+maxY)/2-wantY;
  compassKey='';
  updateCompass();
  updateZoomPill();
}
calcZoom();
// The true full-screen height under viewport-fit=cover. Measured on an iPhone
// standalone PWA: innerHeight / 100% / 100dvh all report the SHORT height (they
// stop ~one inset short of the screen), while 100vh / 100lvh span the whole
// screen. So take the LARGEST candidate - robust no matter which unit a given
// iOS version gets wrong - instead of trusting any single one.
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
/* How far the camera must move to hold the view still when the viewport
   resizes. viewScreen puts a tile at `VW/2 + ZOOM*(isoX - cam.x)` and
   `VH*0.24 + ZOOM*(isoY - cam.y)`, so solving for "same screen position at the
   new size" gives half the width delta and 0.24 of the height delta — in DRAW
   units, hence the /zoom, because cam is not in CSS pixels. Pure, because the
   invariant that matters ("the garden does not move when the library docks") is
   arithmetic and worth pinning down without a real canvas. */
function viewportAnchorDelta(dW,dH,zoom){
  if (!(zoom>0) || (!dW && !dH)) return {dx:0,dy:0};
  return { dx: dW/(2*zoom), dy: dH*0.24/zoom };
}
/* Publish the top bar's real height so the full-height catalog sheet can
   reserve it (--sheet-safe-top, styles.css). It has to be measured rather than
   hardcoded: the bar is 56px in the docked shell and taller on a phone, where
   it takes max(8px, env(safe-area-inset-top)) of top padding, so the one
   number covers both the chrome and the notch. Cheap — one rect read per
   resize, never per frame. */
function syncHudTopHeight(){
  const bar=document.querySelector('.hud-top'); if (!bar) return;
  const h=Math.round(bar.getBoundingClientRect().height);
  if (h>0 && h!==syncHudTopHeight._last){
    syncHudTopHeight._last=h;
    document.documentElement.style.setProperty('--hud-top-h',h+'px');
  }
}
/* ...and the same for what sits BELOW it. --rail-top reserves the top bar;
   there was no counterpart underneath, so #canvasTools reserved the bar and
   nothing else and ran straight under the catalog sheet: on every phone
   shorter than ~910px its last two rows (Undo, Redo) sat behind the sheet,
   where a tap hit the sheet handle and the catalog instead. On DOCK the
   sheet is side-docked and the thing in the way is the zoom pill, whose
   Zoom out and Fit were being taken by the rail on viewports under ~540px.

   Geometric rather than tier-keyed, so it cannot disagree with the layout:
   reserve for anything visible that overlaps the rail's own column AND
   starts below the rail's top. The side-docked library starts above it and
   is skipped; a bottom sheet and the zoom pill are not. Reading only the
   rail's top and x-range keeps this free of feedback — neither moves when
   the reservation changes its height. */
function syncRailBottom(){
  const rail=document.getElementById('canvasTools'); if (!rail) return;
  const rr=rail.getBoundingClientRect(); if (!rr.width) return;
  const H=trueViewH();
  let reserve=0;
  const consider=el=>{
    if (!el) return;
    const cs=getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden') return;
    const r=el.getBoundingClientRect();
    if (!r.width||!r.height) return;
    if (r.top<=rr.top) return;                    // beside or behind, not beneath
    if (r.right<=rr.left||r.left>=rr.right) return;  // different column
    reserve=Math.max(reserve,H-r.top);
  };
  consider(document.querySelector('.hud-bottom'));
  consider(document.querySelector('.zoom-pill'));
  const px=Math.max(0,Math.round(reserve));
  if (px!==syncRailBottom._last){
    syncRailBottom._last=px;
    document.documentElement.style.setProperty('--rail-bottom-h',px+'px');
  }
}
function sizeCanvas(c, opts){
  if (!c) return;
  syncHudTopHeight();
  syncRailBottom();
  const active=!!(opts&&opts.active);
  const host=c.id==='gameCanvas'&&c.parentElement&&c.parentElement.classList.contains('canvas-stage') ? c.parentElement : null;
  const hostRect=host&&host.getBoundingClientRect ? host.getBoundingClientRect() : null;
  const h=Math.round(hostRect&&hostRect.height ? hostRect.height : trueViewH());
  // Clear the inline width we set last time before measuring: it wins over the
  // CSS width:100%, so leaving it on makes getBoundingClientRect() read back the
  // OLD pixel width — freezing width across resize/rotation (height escaped only
  // because it comes from trueViewH()'s fresh probe, not the rect). Cleared, the
  // rect re-resolves width:100% against the current viewport.
  c.style.width=''; c.style.height='';
  const r=c.getBoundingClientRect();
  const w=Math.round(hostRect&&hostRect.width ? hostRect.width : (r.width||c.clientWidth||innerWidth));
  c.style.width=w+'px'; c.style.height=h+'px';
  if (active){
    /* Keep the visible garden ANCHORED across a viewport change.
       viewScreen puts a tile at `VW/2 + ZOOM*(isoX - cam.x)`, so widening the
       canvas by dW slides the entire garden right by dW/2. That is what made
       docking or undocking the plant library read as "the map resized and
       jumped" instead of simply uncovering the strip the panel was sitting on.
       Compensating cam by the same amount — in DRAW units, hence the /ZOOM —
       spends the new pixels on more garden rather than on moving the garden.
       This lives in sizeCanvas because it is the one place VW/VH change, so
       every path (library dock, window resize, rotation, the rAF settles in
       setActiveCanvas) is covered by construction. */
    const d=viewportAnchorDelta(w-VW, h-VH, ZOOM);
    if ((d.dx||d.dy) && typeof game!=='undefined' && game.inGarden){ cam.x+=d.dx; cam.y+=d.dy; }
    VW=w; VH=h;   // the visible/active canvas owns render + pointer size
  }
  // Assigning canvas.width RESETS the bitmap even when the value is unchanged,
  // and cnv.width is part of the ground bake key — so an unguarded write here
  // meant every spurious ResizeObserver fire (docking the library, an open
  // dropdown reflowing) silently bought a full viewport rebake. Only pay when
  // the backing store actually has to change size.
  // `||1` also catches NaN (Math.max(1,NaN) is NaN): a non-finite measurement
  // would both defeat the comparison below — NaN!==NaN, so it would rebake
  // forever — and set canvas.width to NaN, which the spec clamps to 0.
  const bw=(Math.max(1,Math.round(w*DPR))||1), bh=(Math.max(1,Math.round(h*DPR))||1);
  if (c.width!==bw || c.height!==bh){ c.width=bw; c.height=bh; }
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
function repositionOpenChrome(){
  if (typeof syncTopTools==='function') syncTopTools();
  const shown=id=>{ const el=document.getElementById(id);
    return el && !el.classList.contains('hidden'); };
  if (shown('pauseScreen') && typeof openPause==='function') openPause();
  if (shown('gardenMenu') && typeof openGardenMenu==='function') openGardenMenu();
  if (typeof tourRender==='function') tourRender();
}
function settleViewportChange(){
  invalidateUsableRect();   // the chrome is what usableCanvasRect measures
  syncHudTopHeight();   // tier changes resize the bar; the sheet reserves it
  syncRailBottom();     // ...and the sheet/zoom pill are what the RAIL reserves
  setActiveCanvas(activeCanvas());
  calcZoom();
  /* No snapCam here. It recentres on the plot, so every library dock/undock
     threw the designer's camera back to the middle of the garden. setUserZoom
     skips it for the same reason ("design keeps a free camera"); this path used
     to disagree with it. The anchoring in sizeCanvas is what the camera actually
     needed: hold the view still and let the reclaimed width show more garden. */
  updateZoomPill();
  compassKey='';
  updateCompass();
  repositionOpenChrome();
  /* Draw the new size in THIS frame. Resizing the backing store clears it, so
     returning without drawing composites one blank frame — the grey flash as
     the library docks or undocks. The bake is invalidated by the size change
     anyway, so this is when that cost was always going to be paid; paying it
     before the frame is composited is what makes it invisible. */
  if (typeof game!=='undefined' && game.inGarden && activeCanvasId==='gameCanvas'
      && !cnv.classList.contains('hidden') && typeof render==='function'){
    render(performance.now());
  }
}
function resizeCanvases(){
  settleViewportChange();
  requestAnimationFrame(settleViewportChange);
}
addEventListener('resize', resizeCanvases);
addEventListener('orientationchange', resizeCanvases);
const canvasStage=document.getElementById('canvasStage');
if (canvasStage && typeof ResizeObserver==='function'){
  let canvasStageResizeFrame=0;
  new ResizeObserver(()=>{
    if (activeCanvasId!=='gameCanvas' || cnv.classList.contains('hidden')) return;
    if (canvasStageResizeFrame) cancelAnimationFrame(canvasStageResizeFrame);
    canvasStageResizeFrame=requestAnimationFrame(()=>{
      canvasStageResizeFrame=0;
      // Docking/undocking the plant library resizes the stage without a window
      // resize. The partial list this used to inline re-measured the canvas but
      // skipped repositionOpenChrome(), so an open time/garden dropdown stayed
      // pinned to coordinates that had just moved. settleViewportChange is the
      // one path that does all of it — measure, anchor the camera, reposition
      // the chrome, and repaint before the frame is composited.
      settleViewportChange();
    });
  }).observe(canvasStage);
}

/* Cardinal direction markers sit just past the plot edge. They are not clamped
   to the viewport; when that part of the garden edge leaves the screen, the
   marker leaves too. This keeps the directions spatial instead of HUD-like. */
let compassDom=null, compassKey='', compassChrome={key:'',rects:[]};
if (typeof globalThis!=='undefined') globalThis.__compassReady=true;
function invalidateCompass(){ compassKey=''; compassChrome={key:'',rects:[]}; updateCompass(); }
function compassElements(){
  if (compassDom && compassDom.root && compassDom.root.isConnected) return compassDom;
  const root=document.getElementById('compassEdges');
  if (!root) return null;
  compassDom={ root, labels:Array.from(root.querySelectorAll('.compass-edge-label')) };
  return compassDom;
}
function compassChromeStateKey(){
  const bodyCls=(document.body&&document.body.className)||'';
  const ids=['hud','canvasTools','zoomPill','sheetHandle','btnAct','cvRow','brushBar','trayTabs','toolTray','plantCard','selectionActions','sitePhotoEditor'];
  const parts=ids.map(id=>{
    const el=document.getElementById(id);
    return el ? [id,el.className||'',el.style&&el.style.display||''].join(':') : id+':x';
  });
  return [VW,VH,bodyCls,game.sheetState||'',game.toolMenu||'',game.trayCat||'',game.drill||'',
    game.searchOpen?1:0,game.catMenuOpen?1:0,parts.join('|')].join('|');
}
function compassChromeRects(stateKey){
  if (compassChrome.key===stateKey) return compassChrome.rects;
  const sels=['.hud-top','#canvasTools','.hud-bottom','#zoomPill','#plantCard','.tool-popover','.cat-pop','.selection-actions'];
  const frame=canvasViewportRect();
  const rects=[];
  for (const sel of sels){
    document.querySelectorAll(sel).forEach(el=>{
      if (!el || (el.classList&&el.classList.contains('hidden'))) return;
      const cs=typeof getComputedStyle==='function' ? getComputedStyle(el) : null;
      if (cs && (cs.display==='none' || cs.visibility==='hidden')) return;
      const r=el.getBoundingClientRect&&el.getBoundingClientRect();
      if (!r || r.width<=0 || r.height<=0) return;
      const pad=sel==='.hud-top'||sel==='.hud-bottom' ? 22 : 18;
      rects.push({left:r.left-frame.left-pad,top:r.top-frame.top-pad,
        right:r.right-frame.left+pad,bottom:r.bottom-frame.top+pad});
    });
  }
  compassChrome={key:stateKey,rects};
  return rects;
}
function compassBlockedByChrome(p,rects){
  return rects.some(r=>p[0]>=r.left && p[0]<=r.right && p[1]>=r.top && p[1]<=r.bottom);
}
function updateCompass(){
  const dom=compassElements(); if (!dom) return;
  const chromeKey=compassChromeStateKey();
  const key=[game.inGarden?1:0,game.rot,effectiveSiteNorthDeg(),VW,VH,ZOOM.toFixed(3),cam.x.toFixed(2),cam.y.toFixed(2),GW,GH,game.plotRev,chromeKey].join('|');
  if (key===compassKey) return;
  compassKey=key;
  if (!game.inGarden){ dom.labels.forEach(el=>el.classList.add('off')); return; }
  const W=VW/ZOOM, H=VH/ZOOM, pad=42;
  const chromeRects=compassChromeRects(chromeKey);
  const project=(x,y)=>{ const [sx,sy]=screenOfFlat(x,y,W,H); return [sx*ZOOM,sy*ZOOM]; };
  const center=[(GW-1)/2,(GH-1)/2], bounds={l:-.5,r:GW-.5,t:-.5,b:GH-.5};
  const shape=game.plotShape;
  const ray=(d,offset)=>{
    let edge;
    if (shape){                                     // irregular lot: ray-hit the polygon edges
      edge=rayPolygonExitT(center,d,shape);
      if (edge===null || !Number.isFinite(edge)) edge=0;   // degenerate: center sits outside the shape
    } else {
      const ts=[];
      if (d[0]>.000001) ts.push((bounds.r-center[0])/d[0]);
      else if (d[0]<-.000001) ts.push((bounds.l-center[0])/d[0]);
      if (d[1]>.000001) ts.push((bounds.b-center[1])/d[1]);
      else if (d[1]<-.000001) ts.push((bounds.t-center[1])/d[1]);
      edge=Math.min(...ts.filter(t=>t>=0));
    }
    return [center[0]+d[0]*(edge+offset),center[1]+d[1]*(edge+offset)];
  };
  const dirs=siteDirections(), edges={};
  Object.keys(dirs).forEach(d=>{ edges[d]={m:ray(dirs[d],.26),tip:ray(dirs[d],1.08)}; });
  dom.labels.forEach(el=>{
    const d=el.dataset.dir, def=edges[d]; if (!def) return;
    const p=project(def.m[0],def.m[1]);
    if (p[0]<-pad || p[0]>VW+pad || p[1]<-pad || p[1]>VH+pad || compassBlockedByChrome(p,chromeRects)){
      el.classList.add('off'); return;
    }
    const tip=project(def.tip[0],def.tip[1]);
    const ang=Math.atan2(tip[1]-p[1],tip[0]-p[0])*180/Math.PI;
    el.classList.remove('off');
    el.style.transform=`translate(${Math.round(p[0])}px,${Math.round(p[1])}px) translate(-50%,-50%)`;
    el.style.setProperty('--compass-arrow',`${ang.toFixed(1)}deg`);
  });
}

/* Rendering, command mutations, and canvas input are split into renderer.js, commands.js, and input.js. */
