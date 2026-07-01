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
  calcZoom(); if (game.mode && game.gameMode!=='design' && game.tool!=='hand') snapCam(); // design/hand keep a free camera
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

/* Cardinal edge labels replace the old round compass badge. The function name
   stays updateCompass() because rotate/load code already calls it. Labels are
   projected from world N/E/S/W edges and clamped into the visible garden area. */
function compassSafeRect(){
  const topbar=document.querySelector('.hud-top');
  const tools=document.getElementById('canvasTools');
  const bottom=document.querySelector('.hud-bottom');
  const visible=el=>el && getComputedStyle(el).display!=='none';
  const tr=visible(topbar)?topbar.getBoundingClientRect():null;
  const lr=visible(tools)?tools.getBoundingClientRect():null;
  const br=visible(bottom)?bottom.getBoundingClientRect():null;
  return {
    left:Math.max(14,(lr&&lr.right>0)?lr.right+10:14),
    right:Math.max(40,VW-18),
    top:Math.max(70,(tr&&tr.bottom>0)?tr.bottom+14:70),
    bottom:Math.max(120,(br&&br.top>0)?br.top-16:VH-18),
  };
}
function clampCompassPoint(p,c,r){
  const inside=p[0]>=r.left&&p[0]<=r.right&&p[1]>=r.top&&p[1]<=r.bottom;
  if (inside) return p;
  const dx=p[0]-c[0], dy=p[1]-c[1], hits=[];
  const add=(t,x,y)=>{ if (t>=0 && x>=r.left-0.5 && x<=r.right+0.5 && y>=r.top-0.5 && y<=r.bottom+0.5) hits.push([t,x,y]); };
  if (Math.abs(dx)>0.001){
    let t=(r.left-c[0])/dx; add(t,r.left,c[1]+dy*t);
    t=(r.right-c[0])/dx; add(t,r.right,c[1]+dy*t);
  }
  if (Math.abs(dy)>0.001){
    let t=(r.top-c[1])/dy; add(t,c[0]+dx*t,r.top);
    t=(r.bottom-c[1])/dy; add(t,c[0]+dx*t,r.bottom);
  }
  hits.sort((a,b)=>a[0]-b[0]);
  const h=hits.find(v=>v[0]>0.02);
  if (h) return [h[1],h[2]];
  return [Math.max(r.left,Math.min(r.right,p[0])),Math.max(r.top,Math.min(r.bottom,p[1]))];
}
function updateCompass(){
  const root=document.getElementById('compassEdges'); if (!root) return;
  const labels=root.querySelectorAll('.compass-edge-label');
  if (!game.mode){ labels.forEach(el=>el.classList.add('off')); return; }
  const W=VW/ZOOM, H=VH/ZOOM, r=compassSafeRect();
  const project=(x,y)=>{ const [sx,sy]=screenOfFlat(x,y,W,H); return [sx*ZOOM,sy*ZOOM]; };
  const center=project((GW-1)/2,(GH-1)/2);
  const edges={
    N:{m:[(GW-1)/2,-0.62], a:[-0.5,-0.5], b:[GW-0.5,-0.5]},
    E:{m:[GW-0.38,(GH-1)/2], a:[GW-0.5,-0.5], b:[GW-0.5,GH-0.5]},
    S:{m:[(GW-1)/2,GH-0.38], a:[-0.5,GH-0.5], b:[GW-0.5,GH-0.5]},
    W:{m:[-0.62,(GH-1)/2], a:[-0.5,-0.5], b:[-0.5,GH-0.5]},
  };
  labels.forEach(el=>{
    const d=el.dataset.dir, def=edges[d]; if (!def) return;
    const p=clampCompassPoint(project(def.m[0],def.m[1]),center,r);
    const a=project(def.a[0],def.a[1]), b=project(def.b[0],def.b[1]);
    let ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    if (ang>90) ang-=180; else if (ang<-90) ang+=180;
    el.classList.remove('off');
    el.style.transform=`translate(${Math.round(p[0])}px,${Math.round(p[1])}px) translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)`;
  });
}

/* Rendering, command mutations, and canvas input are split into renderer.js, commands.js, and input.js. */
