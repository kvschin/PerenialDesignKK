'use strict';
/* ---------- canvas / viewport glue ---------- */
const cnv = document.getElementById('gameCanvas');
const cx = cnv.getContext('2d');
/* Cap the canvas backing scale at 1.5x: past that the extra pixels are
   invisible in a painterly isometric scene but every full-screen pass (sky,
   ground blit, season tint) pays for them — a 4K@2x buffer is 16.6M px.
   1.5 matches the sprite cache's cap (pspriteScale), so sprite blits stay 1:1. */
let DPR = Math.min(1.5, window.devicePixelRatio||1);
/* view zoom: a small-screen base (phones start at 0.75x for ~1.3x more
   garden) times the player's own zoom - pinch, wheel, +/- keys, or the
   zoom pill. All drawing and input math runs through ZOOM. */
let ZOOM = 1, baseZoom = 1, userZoom = 1;
function calcZoom(){
  baseZoom = Math.min(innerWidth,innerHeight)<760 ? 0.75 : 1;
  ZOOM = Math.max(0.4, Math.min(1.8, baseZoom*userZoom));
}
function setUserZoom(z){
  userZoom = Math.max(0.4, Math.min(2.2, z));
  calcZoom(); if (game.mode && game.gameMode!=='design') snapCam(); // design keeps a free camera
  updateZoomPill();
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
function usableCanvasRect(){
  const out={left:8,top:8,right:Math.max(8,VW-8),bottom:Math.max(8,VH-8)};
  const take=(el,edge)=>{
    if (!el || el.classList.contains('hidden')) return;
    const cs=getComputedStyle(el);
    if (cs.display==='none' || cs.visibility==='hidden') return;
    const r=el.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (edge==='top') out.top=Math.max(out.top,Math.min(VH-8,r.bottom+8));
    if (edge==='bottom') out.bottom=Math.min(out.bottom,Math.max(8,r.top-8));
    if (edge==='left') out.left=Math.max(out.left,Math.min(VW-8,r.right+8));
    if (edge==='right') out.right=Math.min(out.right,Math.max(8,r.left-8));
  };
  take(document.querySelector('.hud-top'),'top');
  const rail=document.getElementById('canvasTools');
  if (rail){ const rr=rail.getBoundingClientRect(); take(rail,rr.left+rr.width/2>VW/2?'right':'left'); }
  const sheet=document.querySelector('.hud-bottom');
  if (sheet && !sheet.classList.contains('sheet-collapsed') && getComputedStyle(sheet).visibility!=='hidden'){
    const r=sheet.getBoundingClientRect();
    if (r.width && r.height) out.bottom=Math.min(out.bottom,Math.max(8,r.top-8));
  }
  take(document.getElementById('sitePhotoEditor'),'bottom');
  if (out.right-out.left<120){ out.left=8; out.right=Math.max(8,VW-8); }
  if (out.bottom-out.top<120){ out.top=8; out.bottom=Math.max(8,VH-8); }
  return out;
}
function fitPlot(){
  if (!game.mode) return;
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
  userZoom=Math.max(0.4,Math.min(2.2,targetZoom/baseZoom));
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
function sizeCanvas(c, opts){
  if (!c) return;
  const active=!!(opts&&opts.active);
  const h=trueViewH();
  // Clear the inline width we set last time before measuring: it wins over the
  // CSS width:100%, so leaving it on makes getBoundingClientRect() read back the
  // OLD pixel width — freezing width across resize/rotation (height escaped only
  // because it comes from trueViewH()'s fresh probe, not the rect). Cleared, the
  // rect re-resolves width:100% against the current viewport.
  c.style.width='';
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
function repositionOpenChrome(){
  if (typeof syncTopTools==='function') syncTopTools();
  const shown=id=>{ const el=document.getElementById(id);
    return el && !el.classList.contains('hidden'); };
  if (shown('pauseScreen') && typeof openPause==='function') openPause();
  if (shown('gardenMenu') && typeof openGardenMenu==='function') openGardenMenu();
}
function settleViewportChange(){
  setActiveCanvas(activeCanvas());
  calcZoom();
  if (game.mode && game.gameMode==='design') snapCam();
  updateZoomPill();
  compassKey='';
  updateCompass();
  repositionOpenChrome();
}
function resizeCanvases(){
  settleViewportChange();
  requestAnimationFrame(settleViewportChange);
}
addEventListener('resize', resizeCanvases);
addEventListener('orientationchange', resizeCanvases);

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
  const rects=[];
  for (const sel of sels){
    document.querySelectorAll(sel).forEach(el=>{
      if (!el || (el.classList&&el.classList.contains('hidden'))) return;
      const cs=typeof getComputedStyle==='function' ? getComputedStyle(el) : null;
      if (cs && (cs.display==='none' || cs.visibility==='hidden')) return;
      const r=el.getBoundingClientRect&&el.getBoundingClientRect();
      if (!r || r.width<=0 || r.height<=0) return;
      const pad=sel==='.hud-top'||sel==='.hud-bottom' ? 22 : 18;
      rects.push({left:r.left-pad,top:r.top-pad,right:r.right+pad,bottom:r.bottom+pad});
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
  const key=[game.mode?1:0,game.rot,effectiveSiteNorthDeg(),VW,VH,ZOOM.toFixed(3),cam.x.toFixed(2),cam.y.toFixed(2),GW,GH,game.plotRev,chromeKey].join('|');
  if (key===compassKey) return;
  compassKey=key;
  if (!game.mode){ dom.labels.forEach(el=>el.classList.add('off')); return; }
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
