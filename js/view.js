'use strict';
/* ---------- canvas / viewport glue ---------- */
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

/* North compass: point the badge's arrow at world-north on screen. North is
   world y-1; we project the plot centre and one tile north of it, and the
   screen delta is north's on-screen direction (cam/size/zoom cancel out, so it
   depends only on game.rot). Updated on rotate + on entering a garden, not per
   frame. The angle is unwrapped toward the last value so the needle takes the
   short way round instead of spinning 270°. */
let compassAngle=0;
function updateCompass(){
  const el=document.getElementById('compass'); if (!el || !game.mode) return;
  const rotor=el.querySelector('.compass-rotor'); if (!rotor) return;
  const [ax,ay]=screenOfFlat(GW/2,GH/2,VW,VH), [bx,by]=screenOfFlat(GW/2,GH/2-1,VW,VH);
  let target=Math.atan2(by-ay,bx-ax)*180/Math.PI + 90;   // +90: the arrow's default points up
  while (target-compassAngle> 180) target-=360;
  while (target-compassAngle<-180) target+=360;
  compassAngle=target;
  rotor.style.transform=`rotate(${target}deg)`;
}

/* Rendering, command mutations, and canvas input are split into renderer.js, commands.js, and input.js. */
