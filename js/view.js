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
const USER_ZOOM_MAX=2.8;
/* How far OUT the view may go. 40% is as far as a plot ever needs that fits
   the screen by then, and it was the limit for every plot: a quarter acre on
   a desktop needs 18% to be seen whole, and on a phone the smallest plot needs
   13%, so those gardens opened as edge-to-edge lawn with no boundary in sight,
   the Fit button fitted nothing, and no gesture could ever show the plan the
   planner is for. So a plot that does not fit at 40% may go on out to where it
   does (zoomFloor), and no further: the worst case is the whole plot on
   screen, which is bounded by the plot and is what a big monitor at 40% already
   draws. ZOOM_FLOOR is where the largest preset, a quarter acre, fits a 320px
   phone (a tile is then 3.4px wide); the largest plot that can be made, on a
   phone would need 3%.
   The floor only ever FALLS within a garden. It is lowered to what a fit needs
   in the layout at hand (a docked library, a raised sheet); were a roomier
   layout to raise it again, the view would jump in by itself the next time
   anything recalculated the zoom. enterGarden puts it back to 40%. */
const ZOOM_FLOOR=0.045;
let zoomFloor=ZOOM_MIN;
function resetZoomFloor(){ zoomFloor=ZOOM_MIN; }
function lowerZoomFloor(fit){ if (fit>0) zoomFloor=Math.max(ZOOM_FLOOR,Math.min(zoomFloor,fit)); }
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
  ZOOM = Math.max(zoomFloor, Math.min(ZOOM_MAX, baseZoom*userZoom));
}
/* Zooming out past the floor asks whether this plot, in this layout, needs to go
   further to be seen whole. Only then: a wheel is a stream of ticks, and the
   answer is a cached rectangle and four projections. From the floor itself: the
   phone's base zoom used to leave userZoom a dead band (0.4 to 0.53) in which a
   pinch moved a number and not the view. */
function clampUserZoom(z){
  if (z*baseZoom<zoomFloor && game.inGarden) lowerZoomFloor(plotFitZoom());
  return Math.max(zoomFloor/baseZoom, Math.min(USER_ZOOM_MAX, z));
}
/* The direct route: a wheel tick, a pinch. It takes the camera from an eased
   change still under way (viewTween), so the gardener's own gesture always wins. */
function setUserZoom(z){
  cancelViewTween();
  userZoom = clampUserZoom(z);
  calcZoom();   // no snapCam: the designer's camera is free and stays where it is
  updateZoomPill();
  tourNote('look');   // the tour camera step: every zoom route funnels here
}
function zoomBy(f){ setUserZoom(userZoom*f); }
/* ---------- eased view changes ----------
   Fit and the zoom pill's +/- (and the +/- keys) used to jump the camera in one
   frame, which loses the gardener's place: a Fit from 200% on a corner of the
   plot cut straight to the whole plot with nothing to say where the corner went.
   Now they ease over VIEW_TWEEN_MS: the camera point at the zoom anchor moves in
   a straight line and the zoom goes in equal RATIOS (a 2x change is the same
   speed in and out), both on an ease-out, advanced from the frame loop
   (stepViewTween, frame() in screens.js).
   To the renderer an eased change is simply a short zoom gesture: ZOOM moves
   frame to frame, so the ground blits its stale bake scaled until
   GROUND_ZOOM_SETTLE after the last step and the sprites wait out
   SPRITE_ZOOM_SETTLE, exactly as after a wheel. Anything the gardener does to
   the camera takes it: a wheel tick or a pinch (setUserZoom), any press on the
   canvas (input.js), a rotation, a resize, and a new eased change, which starts
   from wherever this one had got to. Opening a garden is not eased: a saved view
   is restored and an opening is fitted in one frame, behind the cover. */
const VIEW_TWEEN_MS=240;
let viewTween=null;
function viewTweenActive(){ return !!viewTween; }
function cancelViewTween(){ viewTween=null; }
function viewTweenNow(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
function easeOutCubic(f){ return 1-Math.pow(1-f,3); }
/* Land on the target now (a save, a quit): the eased change becomes the instant one. */
function finishViewTween(){ const w=viewTween; if (w) stepViewTween(w.t0+w.ms); }
/* x, y: the camera to end on; z: the userZoom to end on, already clamped. */
function startViewTween(x,y,z){
  if (reducedMotion() || !game.inGarden){
    viewTween=null; userZoom=z; calcZoom(); cam.x=x; cam.y=y;
    compassKey=''; updateCompass(); updateZoomPill();
    return false;
  }
  viewTween={x0:cam.x, y0:cam.y, z0:userZoom, x1:x, y1:y, z1:z, t0:viewTweenNow(), ms:VIEW_TWEEN_MS};
  return true;
}
function stepViewTween(t){
  const w=viewTween; if (!w) return;
  const f=Math.max(0,Math.min(1,(t-w.t0)/w.ms)), e=easeOutCubic(f);
  if (f>=1){
    // exactly the target, not the curve's last sample: a Fit must end where an instant Fit does
    viewTween=null; userZoom=w.z1; calcZoom(); cam.x=w.x1; cam.y=w.y1;
    compassKey='';
  } else {
    userZoom = w.z0>0 && w.z1>0 ? w.z0*Math.pow(w.z1/w.z0,e) : w.z0+(w.z1-w.z0)*e;
    calcZoom();
    cam.x=w.x0+(w.x1-w.x0)*e; cam.y=w.y0+(w.y1-w.y0)*e;
  }
  updateZoomPill();
}
/* An eased Fit that zooms OUT bakes the ground once, at where it is going.
   Treated as a wheel gesture it baked again every time the shrinking old bake
   stopped covering the plot on screen (groundZoomDriftDue), and with a pan
   beyond the margin (panDev): measured, 4 full bakes inside one 240ms Fit at
   1440x900 and 6 at a phone viewport, where an instant Fit costs 1. A Fit's
   destination shows the whole plot, so a bake THERE (plus its margin) holds all
   the ground any frame on the way can show; those frames blit it magnified
   (soft for the first few, while it moves fastest) and the last frame is that
   bake exactly, so nothing settles afterwards. The renderer asks
   viewTweenGroundTarget once per tween, when it must bake; while
   viewTweenGroundHeld it trusts the coverage test alone, the margin and
   magnification triggers being for a gesture whose end nobody knows. A zoom
   step, or a Fit zooming IN, bakes as a wheel does. */
function viewTweenTargetZOOM(w){ return Math.max(zoomFloor, Math.min(ZOOM_MAX, baseZoom*w.z1)); }
function viewTweenGroundTarget(){
  const w=viewTween;
  if (!w || !w.fit || w.groundAhead) return null;
  const z=viewTweenTargetZOOM(w);
  if (!(z<ZOOM)) return null;
  w.groundAhead=true;                // once: if it does not cover, the next bake is an ordinary one
  return {z, x:w.x1, y:w.y1};
}
function viewTweenGroundHeld(groundZoomNow,gx,gy){
  const w=viewTween;
  return !!(w && w.groundAhead && groundZoomNow===viewTweenTargetZOOM(w) && gx===w.x1 && gy===w.y1);
}
/* The zoom pill and the +/- keys: one step of the wheel's size, eased. A second
   press while the first is still easing goes on from where the first was GOING,
   so three quick presses are three steps, as they were. */
function zoomStep(f){
  if (reducedMotion() || !game.inGarden) return zoomBy(f);
  const from = viewTween && viewTween.zoomOnly ? viewTween.z1 : userZoom;
  const x=cam.x, y=cam.y;
  startViewTween(x,y,clampUserZoom(from*f));
  if (viewTween) viewTween.zoomOnly=true;
  tourNote('look');
}
/* Change-guarded, like every other per-frame HUD write (hudText/hudDisplay).
   Every zoom route lands here, and a wheel is a stream of ~6% ticks — so this
   wrote textContent on a node inside the backdrop-filtered #hud several times a
   second while the canvas underneath was animating, which is a style
   invalidation and a re-blur for a string that is usually the same string.
   Measured on a wheel zoom over the demo garden: 50.9 -> 58.6fps with the write
   removed entirely, and most zoom ticks do not move the rounded percentage. */
let zoomPillPct=-1;
function updateZoomPill(){
  const pct=Math.round(ZOOM*100);
  if (pct===zoomPillPct) return;
  const lab=document.getElementById('zoomLabel');
  if (lab){ lab.textContent=pct+'%'; zoomPillPct=pct; }
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
/* Moves whenever the chrome might have, which a per-frame caller can compare
   without measuring anything (positionSelectionActions). */
let usableRectRev=0;
function invalidateUsableRect(){ usableRectCache=null; usableRectRev++; }
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
  let handleTop=null;
  if (sheet && getComputedStyle(sheet).visibility!=='hidden'){
    const r=sheet.getBoundingClientRect();
    if (r.width && r.height){
      const sideDocked=r.left>VW*.45 && r.top<VH*.3 && r.height>VH*.45;
      if (sheet.classList.contains('sheet-collapsed')){ if (!sideDocked) handleTop=r.top; }
      else if (sideDocked) out.right=Math.min(out.right,Math.max(8,r.left-8));
      else out.bottom=Math.min(out.bottom,Math.max(8,r.top-8));
    }
  }
  take(document.getElementById('sitePhotoEditor'),'bottom');
  /* What is genuinely free of chrome, BEFORE the two fallbacks below. Those are
     right for framing the plot, which has to get some answer even with a full
     sheet up, and wrong for a control: with the sheet at full they hand back
     nearly the whole screen, top bar included. It also leaves out a collapsed
     sheet's handle, which framing ignores on purpose and a control must not
     cover. It may have no height at all, which is the honest answer then. */
  out.clear={left:out.left, top:out.top, right:out.right,
    bottom:handleTop===null ? out.bottom : Math.min(out.bottom,Math.max(8,handleTop-8))};
  if (out.right-out.left<120){ out.left=8; out.right=Math.max(8,VW-8); }
  if (out.bottom-out.top<120){ out.top=8; out.bottom=Math.max(8,VH-8); }
  return out;
}
/* The plot's box in draw units at this rotation, with a tile of margin (two
   below, for what stands on the front row). */
function plotFitBox(){
  const corners=[[0,0],[GW-1,0],[0,GH-1],[GW-1,GH-1]].map(([x,y])=>worldToView(x,y));
  const xs=corners.map(p=>isoX(p[0],p[1])), ys=corners.map(p=>isoY(p[0],p[1]));
  return {minX:Math.min(...xs)-TILE_W, maxX:Math.max(...xs)+TILE_W,
    minY:Math.min(...ys)-TILE_H, maxY:Math.max(...ys)+TILE_H*2};
}
/* The zoom at which that box stands inside the canvas the chrome leaves clear. */
function plotFitZoom(box=plotFitBox(),safe=usableCanvasRect()){
  const availW=Math.max(180,safe.right-safe.left), availH=Math.max(180,safe.bottom-safe.top);
  return Math.min(availW/Math.max(1,box.maxX-box.minX), availH/Math.max(1,box.maxY-box.minY));
}
/* Where a Fit puts the camera and the zoom, worked out without moving either. */
function fitPlotTarget(){
  calcZoom();
  const box=plotFitBox(), {minX,maxX,minY,maxY}=box;
  const safe=usableCanvasRect();
  /* It clamped the answer at 42%, so "Fit" fitted only what fitted anyway. */
  const fit=plotFitZoom(box,safe);
  lowerZoomFloor(fit);
  const targetZoom=Math.max(zoomFloor,Math.min(1.45,fit));
  const z=Math.max(zoomFloor/baseZoom,Math.min(USER_ZOOM_MAX,targetZoom/baseZoom));
  const Z=Math.max(zoomFloor, Math.min(ZOOM_MAX, baseZoom*z));   // calcZoom's answer for z
  const W=VW/Z, H=VH/Z;
  const wantX=(safe.left+safe.right)/(2*Z), wantY=(safe.top+safe.bottom)/(2*Z);
  return {x:W/2+(minX+maxX)/2-wantX, y:H*0.24+(minY+maxY)/2-wantY, z};
}
/* {ease:true} from the Fit buttons; an opening (enterGarden, settleOpeningFit)
   and every other caller fits in one frame. */
function fitPlot(opts){
  if (!game.inGarden) return;
  const tg=fitPlotTarget();
  if (opts && opts.ease && startViewTween(tg.x,tg.y,tg.z)){ viewTween.fit=true; return; }
  cancelViewTween();
  userZoom=tg.z;
  calcZoom();
  cam.x=tg.x; cam.y=tg.y;
  compassKey='';
  updateCompass();
  updateZoomPill();
}
/* A garden that opens fitted is fitted to the chrome as it stands at that
   moment, which is not where it comes to rest: the tray and the rail are built
   after the fit, and a phone's sheet travels to its height over a fifth of a
   second. While 42% was the floor the difference could not show, since the fit
   was clamped anyway; with a true fit, a quarter acre opened with one corner
   under the library on a desktop and two under the sheet on a phone. So the
   fit is taken again two frames on, and again once the sheet has landed,
   unless the gardener has moved the view in the meantime (then it is theirs). */
let openingFit=null;
function settleOpeningFit(){
  const mark=()=>{ openingFit={x:cam.x,y:cam.y,z:userZoom,id:game.worldId}; };
  const again=()=>{
    const f=openingFit;
    if (!f || !game.inGarden || f.id!==game.worldId || cam.x!==f.x || cam.y!==f.y || userZoom!==f.z) return;
    invalidateUsableRect(); fitPlot(); mark();
  };
  mark();
  requestAnimationFrame(()=>requestAnimationFrame(again));
  setTimeout(again,320);
  setTimeout(()=>{ again(); openingFit=null; },700);
}
/* ---------- where the garden was being looked at ----------
   A garden used to open at 100% on the plot's centre every time: a new one
   with its corners cropped off (the tour then told you "Fit frames the whole
   plot"), a reopened one wherever you had NOT been working. So a new garden
   opens fitted, and a reopened one where it was left.
   The view is stored as the WORLD point at the centre of the clear canvas plus
   the gardener's own zoom (userZoom, not ZOOM), which is what survives a
   different screen: camera pixels mean nothing on a phone that saved on a
   desktop, and baseZoom already differs between the two. Rotation is saved on
   its own (game.rot) and is applied before this runs. Saved with the garden,
   so a shared or duplicated garden opens framed the way its author left it. */
function gardenViewNow(){
  if (!game.inGarden || !VW || !VH || typeof usableCanvasRect!=='function') return null;
  const safe=usableCanvasRect(), W=VW/ZOOM, H=VH/ZOOM;
  const [x,y]=worldPointAt((safe.left+safe.right)/2/ZOOM,(safe.top+safe.bottom)/2/ZOOM,W,H,0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {x:Math.round(x*100)/100, y:Math.round(y*100)/100, z:Math.round(userZoom*1000)/1000};
}
function normalizeGardenView(v){
  if (!v || typeof v!=='object' || Array.isArray(v)) return null;
  const x=+v.x, y=+v.y, z=+v.z;
  if (![x,y,z].every(Number.isFinite)) return null;
  // down to the absolute floor: a garden left fitted is saved below 40% now
  return {x, y, z:Math.max(ZOOM_FLOOR,Math.min(USER_ZOOM_MAX,z))};
}
/* Put a saved view back: the saved point at the centre of the clear canvas.
   worldPointAt measures to the tile's CENTRE, half a tile below the point
   screenOfFlat returns, hence the TILE_H/2. A view somewhere well off the plot
   is refused rather than restored — a camera aimed at empty sky is worse than
   the fitted default. */
function restoreGardenView(v){
  v=normalizeGardenView(v);
  if (!v || !game.inGarden) return false;
  if (v.x<-4 || v.y<-4 || v.x>GW+4 || v.y>GH+4) return false;
  cancelViewTween();
  /* A reopened garden can be zoomed out as far as a new one, and a view saved
     that far out comes back that far out. */
  lowerZoomFloor(plotFitZoom());
  userZoom=Math.max(zoomFloor/baseZoom,v.z); calcZoom();
  const safe=usableCanvasRect(), W=VW/ZOOM, H=VH/ZOOM;
  const [sx,sy]=screenOfFlat(v.x,v.y,W,H);
  cam.x+=sx-(safe.left+safe.right)/2/ZOOM;
  cam.y+=sy+TILE_H/2-(safe.top+safe.bottom)/2/ZOOM;
  compassKey='';
  updateCompass();
  updateZoomPill();
  return true;
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
/* Memoised for the rest of the current TASK. Each probe appends a div to the
   body and removes it, which dirties layout, so the next geometry read lays the
   page out again; one settleViewportChange asked eight times (syncRailBottom
   three times, sizeCanvas once per canvas). The viewport cannot change size in
   the middle of a task, so the first answer holds until the microtask
   checkpoint. It is deliberately NOT kept until the next resize event: the
   rAF re-settles in setActiveCanvas exist because iOS reports the new height a
   frame or two after rotating, and each of those is a task of its own, so each
   still probes fresh. */
let viewHMemo=null;
function trueViewH(){
  if (viewHMemo!==null) return viewHMemo;
  viewHMemo=Math.round(Math.max(innerHeight, probeUnitH('100vh'), probeUnitH('100lvh')));
  Promise.resolve().then(()=>{ viewHMemo=null; });
  return viewHMemo;
}
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
    // an eased Fit aimed at the old canvas would land off target: the view stops where it is
    if ((d.dx||d.dy) && typeof game!=='undefined' && game.inGarden){ cancelViewTween(); cam.x+=d.dx; cam.y+=d.dy; }
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
  // the canvas area it was placed against has just changed shape
  if (typeof placePlantCard==='function') placePlantCard();
  if (typeof tourRender==='function') tourRender();
}
function settleViewportChange(){
  const oldWidth=cnv.width, oldHeight=cnv.height, oldZoom=ZOOM;
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
      && !cnv.classList.contains('hidden') && typeof render==='function'
      && (cnv.width!==oldWidth || cnv.height!==oldHeight || ZOOM!==oldZoom)){
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
/* Built on EVERY frame, before updateCompass's own early-out can fire, because
   it is part of the key that early-out compares. Measured at 3.05us of the
   3.55us a fully-cached updateCompass cost — the whole call was this string.
   Two things made it expensive and neither was necessary: twelve
   getElementById lookups for elements that never move, and a map/join that
   built thirteen intermediate strings and two arrays. The elements are cached
   (re-resolved only when one is missing or has been detached, which is the
   case for the ones built on demand) and the key is concatenated in place. */
const COMPASS_CHROME_IDS=['hud','canvasTools','zoomPill','sheetHandle','btnAct','cvRow',
  'brushBar','trayTabs','toolTray','plantCard','selectionActions','sitePhotoEditor','startHere'];
let compassChromeEls=null;
function compassChromeStateKey(){
  if (!compassChromeEls) compassChromeEls=new Array(COMPASS_CHROME_IDS.length).fill(null);
  let out=VW+'|'+VH+'|'+((document.body&&document.body.className)||'')+'|'+
    (game.sheetState||'')+'|'+(game.toolMenu||'')+'|'+(game.trayCat||'')+'|'+(game.drill||'')+'|'+
    (game.searchOpen?1:0);
  for (let i=0;i<COMPASS_CHROME_IDS.length;i++){
    let el=compassChromeEls[i];
    if (!el || !el.isConnected) el=compassChromeEls[i]=document.getElementById(COMPASS_CHROME_IDS[i]);
    out += el ? '|'+(el.className||'')+':'+((el.style&&el.style.display)||'')
              : '|x';
  }
  return out;
}
function compassChromeRects(stateKey){
  if (compassChrome.key===stateKey) return compassChrome.rects;
  const sels=['.hud-top','#canvasTools','.hud-bottom','#zoomPill','#plantCard','.tool-popover','.selection-actions','#startHere'];
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
/* Where each cardinal mark sits at the current rotation and camera, in CSS px:
   its point on the plot edge (x, y), the angle its arrow points out at, and the
   plot's centre on screen, which a turn of the view orbits the marks around. */
function compassPlacements(){
  const W=VW/ZOOM, H=VH/ZOOM;
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
  const dirs=siteDirections(), out={centre:project(center[0],center[1])};
  Object.keys(dirs).forEach(d=>{
    const m=ray(dirs[d],.26), tipW=ray(dirs[d],1.08);
    const p=project(m[0],m[1]), tip=project(tipW[0],tipW[1]);
    out[d]={x:p[0], y:p[1], ang:Math.atan2(tip[1]-p[1],tip[0]-p[0])*180/Math.PI};
  });
  return out;
}
/* A turn of the view moves every mark to another edge. Jumping there in one
   frame, while the picture under it dissolves (requestViewFade), told the
   gardener nothing about which way the garden had gone round; so for the length
   of the fade each mark orbits from where it was to where it is going, around
   the plot's centre (which itself slides from where it was on screen to where
   snapCam puts it), by the shorter way round, which on a quarter turn is the
   same way for all four. beginCompassTurn records where they were and must run
   BEFORE the rotation changes. */
let compassTurn=null;
function beginCompassTurn(ms){
  if (!game.inGarden || !compassElements()) { compassTurn=null; return; }
  let from=compassPlacements();
  // a second turn pressed while the first is still going starts from where the marks ARE
  if (compassTurn){
    const f=(viewTweenNow()-compassTurn.t0)/compassTurn.ms;
    if (f<1) from=compassTurnLerp(compassTurn.from,from,easeOutCubic(Math.max(0,f)));
  }
  compassTurn={from, t0:viewTweenNow(), ms};
}
function compassTurnLerp(a,b,e){
  const ca=a.centre, cb=b.centre;
  const c=[ca[0]+(cb[0]-ca[0])*e, ca[1]+(cb[1]-ca[1])*e];
  const out={centre:c};
  for (const d of Object.keys(b)){
    if (d==='centre') continue;
    const p0=a[d], p1=b[d]; if (!p1) continue;
    if (!p0){ out[d]=p1; continue; }
    const v0=[p0.x-ca[0],p0.y-ca[1]], v1=[p1.x-cb[0],p1.y-cb[1]];
    const r0=Math.hypot(v0[0],v0[1]), r1=Math.hypot(v1[0],v1[1]);
    const a0=Math.atan2(v0[1],v0[0]), a1=Math.atan2(v1[1],v1[0]);
    const da=((a1-a0)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;   // the shorter way round
    const r=r0+(r1-r0)*e, ang=a0+da*e;
    const dArrow=((p1.ang-p0.ang)%360+540)%360-180;
    out[d]={x:c[0]+Math.cos(ang)*r, y:c[1]+Math.sin(ang)*r, ang:p0.ang+dArrow*e};
  }
  return out;
}
function updateCompass(){
  const dom=compassElements(); if (!dom) return;
  let turnE=1;
  if (compassTurn){
    const f=(viewTweenNow()-compassTurn.t0)/compassTurn.ms;
    if (f>=1 || !game.inGarden) compassTurn=null;
    else turnE=easeOutCubic(Math.max(0,f));
  }
  const chromeKey=compassChromeStateKey();
  const key=[game.inGarden?1:0,game.rot,effectiveSiteNorthDeg(),VW,VH,ZOOM.toFixed(3),cam.x.toFixed(2),cam.y.toFixed(2),GW,GH,game.plotRev,chromeKey,turnE.toFixed(3)].join('|');
  if (key===compassKey) return;
  compassKey=key;
  if (!game.inGarden){ dom.labels.forEach(el=>el.classList.add('off')); return; }
  const pad=42;
  const chromeRects=compassChromeRects(chromeKey);
  let place=compassPlacements();
  if (compassTurn) place=compassTurnLerp(compassTurn.from,place,turnE);
  dom.labels.forEach(el=>{
    const d=el.dataset.dir, p=place[d]; if (!p) return;
    if (p.x<-pad || p.x>VW+pad || p.y<-pad || p.y>VH+pad || compassBlockedByChrome([p.x,p.y],chromeRects)){
      el.classList.add('off'); return;
    }
    el.classList.remove('off');
    el.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-50%)`;
    el.style.setProperty('--compass-arrow',`${p.ang.toFixed(1)}deg`);
  });
}

/* Rendering, command mutations, and canvas input are split into renderer.js, commands.js, and input.js. */
