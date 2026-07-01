'use strict';
/* ---------- canvas / viewport glue ---------- */
const cnv = document.getElementById('gameCanvas');
const cx = cnv.getContext('2d');
let DPR = Math.min(2, window.devicePixelRatio||1);
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
}
function zoomBy(f){ setUserZoom(userZoom*f); }
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

/* Cardinal direction markers sit just past the plot edge. They are not clamped
   to the viewport; when that part of the garden edge leaves the screen, the
   marker leaves too. This keeps the directions spatial instead of HUD-like. */
let compassDom=null, compassKey='';
function compassElements(){
  if (compassDom && compassDom.root && compassDom.root.isConnected) return compassDom;
  const root=document.getElementById('compassEdges');
  if (!root) return null;
  compassDom={ root, labels:Array.from(root.querySelectorAll('.compass-edge-label')) };
  return compassDom;
}
function updateCompass(){
  const dom=compassElements(); if (!dom) return;
  const key=[game.mode?1:0,game.rot,VW,VH,ZOOM.toFixed(3),cam.x.toFixed(2),cam.y.toFixed(2),GW,GH].join('|');
  if (key===compassKey) return;
  compassKey=key;
  if (!game.mode){ dom.labels.forEach(el=>el.classList.add('off')); return; }
  const W=VW/ZOOM, H=VH/ZOOM, pad=42;
  const project=(x,y)=>{ const [sx,sy]=screenOfFlat(x,y,W,H); return [sx*ZOOM,sy*ZOOM]; };
  const edges={
    N:{m:[(GW-1)/2,-0.76], tip:[(GW-1)/2,-1.58]},
    E:{m:[GW-0.24,(GH-1)/2], tip:[GW+0.58,(GH-1)/2]},
    S:{m:[(GW-1)/2,GH-0.24], tip:[(GW-1)/2,GH+0.58]},
    W:{m:[-0.76,(GH-1)/2], tip:[-1.58,(GH-1)/2]},
  };
  dom.labels.forEach(el=>{
    const d=el.dataset.dir, def=edges[d]; if (!def) return;
    const p=project(def.m[0],def.m[1]);
    if (p[0]<-pad || p[0]>VW+pad || p[1]<-pad || p[1]>VH+pad){ el.classList.add('off'); return; }
    const tip=project(def.tip[0],def.tip[1]);
    const ang=Math.atan2(tip[1]-p[1],tip[0]-p[0])*180/Math.PI;
    el.classList.remove('off');
    el.style.transform=`translate(${Math.round(p[0])}px,${Math.round(p[1])}px) translate(-50%,-50%)`;
    el.style.setProperty('--compass-arrow',`${ang.toFixed(1)}deg`);
  });
}

/* Rendering, command mutations, and canvas input are split into renderer.js, commands.js, and input.js. */
