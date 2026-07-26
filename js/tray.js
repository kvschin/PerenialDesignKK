'use strict';
/* ---------- tool tray: tabs, brush bar, drill-in, search, layer menu ---------- */
/* tray categories: the bottom main menu. Shrubs and Trees are honest
   placeholders until woody plants exist (type 'shrub' / 'tree'). */
const TRAY_CATS=[
  {id:'grasses',  label:'Grasses',          types:['grass']},
  {id:'sedges',   label:'Sedges',           types:['sedge'], sedgeSections:true},
  {id:'sunper',   label:'Sun Perennials',   types:['forb'], sunFilter:'full'},
  {id:'shadeper', label:'Shade Perennials', types:['forb'], sunFilter:'part'},
  {id:'bulbs',    label:'Bulbs',            types:['bulb']},
  {id:'waterplants',label:'Water Plants',   types:['water']},
  {id:'shrubs',   label:'Shrubs',           types:['shrub']},
  {id:'trees',    label:'Trees',            types:['tree']},
  {id:'landscape',label:'Ground',           tools:['path','bed','water']},
  {id:'leveling', label:'Grade',            tools:['raise','lower','level']},
  {id:'structures',label:'Hardscape',       tools:['fence','firepit','boulder']},
  {id:'lighting', label:'Lighting',         tools:['light']},
  {id:'house',    label:'Site',             tools:['building','house']},
];
// two-tier tab grouping: a top-level Plants / Build toggle decides which set
// of category sub-tabs shows, so the bar never spills all twelve at once.
const TRAY_GROUPS=[
  {id:'plants', label:'Plants', cats:['grasses','sedges','sunper','shadeper','bulbs','waterplants','shrubs','trees']},
  {id:'build',  label:'Landscape',  cats:['landscape','leveling','structures','lighting','house']},
];
function trayGroupOf(catId){ const g=TRAY_GROUPS.find(g=>g.cats.includes(catId)); return g?g.id:'plants'; }
let lastCatByGroup={plants:'grasses', build:'landscape'}; // remember the sub-tab per group
let catalogCategoryScroll={plants:0,build:0};
// A catalogue icon should show the plant at its representative flower moment,
// not silently force a spring or fall species into a flowerless Summer frame.
function plantIconSeason(P){
  return SEASONS.find(s=>P&&P.sea&&(P.sea[s]||{}).bloom) || (P&&P.type==='bulb'?'Spring':'Summer');
}
// which garden layer a planted tile belongs to (perennials vs woody)
function plantLayerOf(p){ const P=p&&PLANTS[p.s];
  return isWoodyDef(P) ? 'woody' : 'perennials'; }
// is a layer currently visible? hidden layers don't render and can't be edited
function layerShown(name){ return game.layerVis[name]!==false; }
const ENABLE_LAYER_EDIT_FOCUS = false; // kept for later; hidden now because visibility is the useful layer control
// does the active edit focus permit touching this layer? (focus is 'all' for now)
function layerEditable(name){ return !ENABLE_LAYER_EDIT_FOCUS || game.layerFocus==='all' || game.layerFocus===name; }
const LAYER_LABELS={all:'All',perennials:'Perennials',bulbs:'Bulbs',woody:'Woody Plants',landscape:'Landscape/Hardscape'};
const LAYER_DEFS=[['perennials'],['bulbs'],['woody'],['landscape']]; // editable layers, in menu order
/* ---------- tool metadata ----------
   game.tool is either a fixed tool id (below) or a plant key (PLANTS[t]). One table
   is the source of truth for each tool's behavior, so callers ask toolMeta() instead
   of re-deriving "==='house'||==='fence'||..." chains across the input handlers:
     layer     — the garden layer it draws onto (null for non-drawing tools)
     brush     — arms a repeatable brush (vs. one-shot hand/select/pick/erase)
     placement — puts something on a tile (we warn when its layer is hidden)
     paints    — flood-fills / drag-paints a continuous fill; false for the discrete
                 hardscape structures (house/fence/light/firepit/boulder) that place one at a time.
     material  — a ground-material brush (path/bed/water); folds the old
                 tool==='path'||==='bed'||==='water' guards.
     apply     — the silent placement hook applyToolAt dispatches to; returns what
                 it placed ('plant'|'bulb'|'path'|… ) or null. House has none (it's
                 placed via placeHouse from pointerdown); non-drawing tools have none.
   The apply hooks are arrow wrappers (like the GAME_LAYERS sync hooks) so the
   placement functions — defined later in view.js — resolve at call time. */
const TOOLS={
  hand:    {layer:null,        brush:false, placement:false, paints:false, material:false},
  select:  {layer:null,        brush:false, placement:false, paints:false, material:false},
  ruler:   {layer:null,        brush:false, placement:false, paints:false, material:false},
  pick:    {layer:null,        brush:false, placement:false, paints:false, material:false},
  shovel:  {layer:null,        brush:false, placement:false, paints:false, material:false}, // Erase
  path:    {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, apply:(x,y,o)=>placeTerrainAt(x,y)},
  bed:     {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, apply:(x,y,o)=>placeTerrainAt(x,y)},
  water:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, apply:(x,y,o)=>placeTerrainAt(x,y)},
  raise:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  lower:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  level:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  house:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false}, // no apply — placed via placeHouse
  building:{layer:'landscape', brush:false, placement:true,  paints:false, material:false}, // corner-by-corner polygon input
  fence:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeFenceAt(x,y)},
  light:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeLightAt(x,y)},
  firepit: {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeFirepitAt(x,y)},
  boulder: {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeBoulderAt(x,y)},
};
// plant tools are keyed by species id; their layer + placer follow the plant type
const TOOL_PLANT={
  perennials:{layer:'perennials',brush:true,placement:true,paints:true,material:false,apply:(x,y,o)=>placePlantAt(x,y,o)},
  bulbs:     {layer:'bulbs',     brush:true,placement:true,paints:true,material:false,apply:(x,y,o)=>placePlantAt(x,y,o)},
  woody:     {layer:'woody',     brush:true,placement:true,paints:true,material:false,apply:(x,y,o)=>placePlantAt(x,y,o)},
};
const TOOL_NONE={layer:null, brush:false, placement:false, paints:false, material:false};
function toolMeta(t){ t=t||game.tool;
  if (TOOLS[t]) return TOOLS[t];
  const P=PLANTS[t];
  if (P) return TOOL_PLANT[P.type==='bulb'?'bulbs':isWoodyDef(P)?'woody':'perennials'];
  return TOOL_NONE;
}
// the legacy predicates now just read the one table (kept for their many call sites)
function isPlacementTool(t){ return toolMeta(t).placement; }
function toolTargetLayer(t){ return toolMeta(t).layer; }
function isBrushTool(k){ return toolMeta(k).brush; }
function brushTrayCatForTool(k){
  if (PLANTS[k]) return plantCategoryFor(k);
  if (isElevationTool(k)) return 'leveling';
  if (toolMeta(k).material) return 'landscape';
  if (k==='fence'||k==='firepit'||k==='boulder') return 'structures';
  if (k==='light') return 'lighting';
  if (k==='house'||k==='building') return 'house';
  return null;
}
function isBrushTrayCat(id){
  const c=TRAY_CATS.find(c=>c.id===id);
  return !!(c && (c.types || (c.tools && c.tools.some(t=>isBrushTool(t)))));
}
function toolFitsBrushTray(k,catId){
  const c=TRAY_CATS.find(c=>c.id===catId);
  if (!c) return false;
  if (PLANTS[k]) return !!(c.types && c.types.includes(PLANTS[k].type) && (!c.sunFilter || PLANTS[k].sun===c.sunFilter));
  if (isElevationTool(k)) return catId==='leveling';
  if (toolMeta(k).material) return catId==='landscape';
  if (k==='fence'||k==='firepit'||k==='boulder') return catId==='structures';
  if (k==='light') return catId==='lighting';
  if (k==='house'||k==='building') return catId==='house';
  return false;
}
function drillFitsTray(drill,catId){
  const P=PLANTS[drill], c=TRAY_CATS.find(c=>c.id===catId);
  return !!(P && c && c.types && c.types.includes(P.type) && (!c.sunFilter || P.sun===c.sunFilter));
}
function brushDrillFitsTray(drill,catId){
  if (drillFitsTray(drill,catId)) return true;
  const c=TRAY_CATS.find(c=>c.id===catId);
  return !!(c && c.id==='structures' && c.tools && c.tools.includes(drill));
}
function rememberBrushMenu(cat=game.trayCat,drill=game.drill){
  if (!isBrushTrayCat(cat)) return;
  game.lastBrushTrayCat=cat;
  game.lastBrushDrill=brushDrillFitsTray(drill,cat) ? drill : null;
}
function rememberBrushTool(){
  if (isBrushTool(game.tool)){
    game.lastBrushTool=game.tool; game.lastBrushVar=game.toolVar||null;
    const cat=toolFitsBrushTray(game.tool,game.trayCat) ? game.trayCat : brushTrayCatForTool(game.tool);
    rememberBrushMenu(cat,game.drill);
  }
}
function setTool(k,v){
  if (game.tool==='building' && k!=='building' && typeof cancelBuildingDraft==='function') cancelBuildingDraft();
  game.toolMenu=null;
  game.catMenuOpen=false;
  if (k!=='select') resetSelectionState(); // leaving select drops its marquee
  if (k==='fence'||k==='light'||k==='firepit'||k==='boulder'||k==='house'||k==='building'||k==='shovel'||k==='hand'||k==='select'||k==='ruler'||k==='pick') game.fillMode=false;
  game.tool=k; game.toolVar=v||null;
  rememberBrushTool();
  refreshTray(); renderCvRow(); refreshCanvasTools(); updateCanvasCursor(); updateActiveToolStatus();
}
function roundedIconRect(tc,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  tc.moveTo(x+r,y);
  tc.lineTo(x+w-r,y);
  tc.quadraticCurveTo(x+w,y,x+w,y+r);
  tc.lineTo(x+w,y+h-r);
  tc.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  tc.lineTo(x+r,y+h);
  tc.quadraticCurveTo(x,y+h,x,y+h-r);
  tc.lineTo(x,y+r);
  tc.quadraticCurveTo(x,y,x+r,y);
}
function drawCanvasIcon(tc,kind){
  tc.clearRect(0,0,42,32);
  const cream='#40382f', seed='#6d665a', bronze='#c67139', sage='#7a8a5e',
    leaf='#8fa36f', soil='#6e5a48', rose='#d9a1a3', water='#6a9ba5';
  tc.strokeStyle=seed; tc.fillStyle=seed; tc.lineWidth=2;
  tc.lineCap='round'; tc.lineJoin='round';
  if (kind==='hand'){
    tc.strokeStyle=cream; tc.lineWidth=2.05;
    tc.beginPath(); tc.moveTo(11,19); tc.lineTo(11,11); tc.moveTo(16,19); tc.lineTo(16,7);
    tc.moveTo(21,19); tc.lineTo(21,9); tc.moveTo(26,20); tc.lineTo(26,13);
    tc.moveTo(11,19); tc.quadraticCurveTo(12,27,20,29); tc.quadraticCurveTo(30,29,31,22);
    tc.quadraticCurveTo(30,19,26,20); tc.stroke();
    tc.fillStyle=sage; tc.beginPath();
    tc.ellipse(21,23,4.2,2.1,-0.45,0,7); tc.fill();
    tc.strokeStyle=shade(sage,-28); tc.lineWidth=1;
    tc.beginPath(); tc.moveTo(18,24); tc.quadraticCurveTo(21,21,25,22); tc.stroke();
  } else if (kind==='select'){
    tc.setLineDash([4,3]); tc.strokeRect(8,7,24,18); tc.setLineDash([]);
    tc.beginPath(); tc.moveTo(26,22); tc.lineTo(34,29); tc.moveTo(30,29); tc.lineTo(34,29); tc.lineTo(34,25); tc.stroke();
  } else if (kind==='brush'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.62);
    tc.fillStyle=bronze; tc.strokeStyle=shade(bronze,-34); tc.lineWidth=1.2;
    tc.beginPath(); roundedIconRect(tc,-3.3,-14,6.6,17,2); tc.fill(); tc.stroke();
    tc.fillStyle=cream; tc.strokeStyle=soil; tc.beginPath(); roundedIconRect(tc,-5,1.5,10,6.2,1.5); tc.fill(); tc.stroke();
    tc.strokeStyle=shade(leaf,-30); tc.lineWidth=1.25;
    tc.beginPath(); tc.moveTo(0,7); tc.lineTo(0,14); tc.stroke();
    tc.fillStyle=leaf;
    tc.beginPath(); tc.ellipse(-3.5,11.4,3.5,1.7,-0.65,0,7); tc.fill();
    tc.beginPath(); tc.ellipse(3.7,10.4,3.9,1.9,0.45,0,7); tc.fill();
    tc.restore();
  } else if (kind==='erase'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.48);
    tc.fillStyle=rose; tc.strokeStyle=soil; tc.lineWidth=1.6;
    tc.beginPath(); roundedIconRect(tc,-11,-7,22,14,2); tc.fill(); tc.stroke();
    tc.fillStyle=cream; tc.beginPath(); roundedIconRect(tc,-11,-7,7.5,14,2); tc.fill(); tc.stroke();
    tc.strokeStyle='rgba(110,90,72,.5)'; tc.lineWidth=1;
    tc.beginPath(); tc.moveTo(-1,-4); tc.lineTo(8,2); tc.moveTo(1,3); tc.lineTo(9,6); tc.stroke();
    tc.restore();
    tc.fillStyle=shade(leaf,-24);
    tc.beginPath(); tc.ellipse(12,25,3.4,1.5,0.2,0,7); tc.fill();
    tc.fillStyle='rgba(239,230,211,.72)';
    tc.beginPath(); tc.arc(28,8,1.2,0,7); tc.arc(32,11,0.9,0,7); tc.fill();
  } else if (kind==='fill'){
    tc.save(); tc.translate(20,16); tc.rotate(-0.72);
    tc.strokeRect(-8,-7,16,14); tc.beginPath(); tc.moveTo(8,3); tc.lineTo(15,9); tc.stroke();
    tc.fillStyle='#5d93a8'; tc.beginPath(); tc.ellipse(14,12,4,2,0,0,7); tc.fill(); tc.restore();
  } else if (kind==='save'){
    tc.strokeRect(10,7,22,18);
    tc.beginPath(); tc.moveTo(15,7); tc.lineTo(15,14); tc.lineTo(27,14); tc.lineTo(27,7); tc.stroke();
    tc.beginPath(); tc.moveTo(15,25); tc.lineTo(15,19); tc.lineTo(27,19); tc.lineTo(27,25); tc.stroke();
  } else if (kind==='paste'){
    tc.strokeRect(12,10,18,16);
    tc.beginPath(); tc.moveTo(17,10); tc.lineTo(17,6); tc.lineTo(25,6); tc.lineTo(25,10); tc.stroke();
    tc.setLineDash([3,2]); tc.strokeRect(7,15,18,12); tc.setLineDash([]);
  } else if (kind==='dropper'){
    tc.save(); tc.translate(21,16); tc.rotate(-0.75);
    tc.strokeStyle=cream; tc.lineWidth=2;
    tc.beginPath(); tc.moveTo(-8,0); tc.lineTo(8,0); tc.stroke();
    tc.fillStyle=bronze; tc.strokeStyle=soil; tc.lineWidth=1.2;
    tc.beginPath(); roundedIconRect(tc,5,-4,8,8,2); tc.fill(); tc.stroke();
    tc.fillStyle=water; tc.beginPath(); tc.moveTo(-11,2); tc.quadraticCurveTo(-15,7,-9,9);
    tc.quadraticCurveTo(-4,7,-8,2); tc.fill();
    tc.restore();
    tc.strokeStyle=shade(sage,-28); tc.lineWidth=1.3;
    tc.beginPath(); tc.moveTo(11,25); tc.quadraticCurveTo(16,22,21,24); tc.stroke();
    tc.fillStyle=sage; tc.beginPath(); tc.ellipse(23,24,3,1.5,-0.2,0,7); tc.fill();
  } else if (kind==='undo'||kind==='redo'){
    const flip=kind==='redo'?-1:1; tc.save(); tc.translate(kind==='redo'?42:0,0); tc.scale(flip,1);
    tc.strokeStyle=cream; tc.lineWidth=2.2;
    tc.beginPath(); tc.arc(23,17,9.5,0.20*Math.PI,1.62*Math.PI,true); tc.stroke();
    tc.fillStyle=sage; tc.beginPath();
    tc.moveTo(11,9); tc.lineTo(9,19); tc.lineTo(19,17); tc.closePath(); tc.fill();
    tc.strokeStyle=shade(sage,-32); tc.lineWidth=1;
    tc.beginPath(); tc.moveTo(11,16); tc.quadraticCurveTo(14,13,18,12); tc.stroke();
    tc.fillStyle=bronze; tc.beginPath(); tc.arc(29,24,1.4,0,7); tc.fill();
    tc.restore();
  } else if (kind==='rotate'){
    tc.beginPath(); tc.arc(21,16,10,0.15*Math.PI,1.72*Math.PI,false); tc.stroke();
    tc.beginPath(); tc.moveTo(30,8); tc.lineTo(35,8); tc.lineTo(34,13); tc.stroke();
    tc.fillStyle='rgba(201,127,63,.28)'; tc.beginPath();
    tc.moveTo(21,7); tc.lineTo(32,16); tc.lineTo(21,25); tc.lineTo(10,16); tc.closePath(); tc.fill();
  } else if (kind==='layers'){
    for (let i=0;i<3;i++){ tc.beginPath(); tc.moveTo(21,8+i*7); tc.lineTo(33,14+i*7);
      tc.lineTo(21,20+i*7); tc.lineTo(9,14+i*7); tc.closePath(); tc.stroke(); }
  } else if (kind==='building'){
    tc.fillStyle='rgba(154,95,58,.32)'; tc.strokeStyle=cream; tc.lineWidth=2;
    tc.beginPath(); tc.moveTo(8,9); tc.lineTo(31,9); tc.lineTo(31,17); tc.lineTo(37,17);
    tc.lineTo(37,27); tc.lineTo(17,27); tc.lineTo(17,20); tc.lineTo(8,20); tc.closePath(); tc.fill(); tc.stroke();
    tc.fillStyle=bronze; [[8,9],[31,9],[31,17],[37,17],[37,27],[17,27],[17,20],[8,20]].forEach(p=>{
      tc.beginPath(); tc.arc(p[0],p[1],1.8,0,7); tc.fill();
    });
  } else if (kind==='viewtools'){
    tc.fillStyle=cream;
    [13,21,29].forEach(x=>{ tc.beginPath(); tc.arc(x,16,2.1,0,7); tc.fill(); });
    tc.strokeStyle='rgba(201,127,63,.55)'; tc.lineWidth=1.3;
    tc.beginPath(); tc.moveTo(9,8); tc.lineTo(33,8); tc.moveTo(9,24); tc.lineTo(33,24); tc.stroke();
  } else if (kind==='ruler'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.55);
    tc.fillStyle='rgba(201,127,63,.25)'; tc.strokeStyle=cream; tc.lineWidth=1.6;
    tc.beginPath(); roundedIconRect(tc,-14,-5,28,10,2); tc.fill(); tc.stroke();
    tc.strokeStyle=seed; tc.lineWidth=1;
    for (let x=-9;x<=9;x+=6){ tc.beginPath(); tc.moveTo(x,-5); tc.lineTo(x,-1); tc.stroke(); }
    tc.restore();
  } else if (kind==='move'){
    // four-way arrows
    tc.beginPath(); tc.moveTo(21,6); tc.lineTo(21,28); tc.moveTo(10,17); tc.lineTo(32,17); tc.stroke();
    const tip=(x,y,dx,dy)=>{ tc.beginPath(); tc.moveTo(x,y);
      tc.lineTo(x+dx-dy*0.6,y+dy+dx*0.6); tc.moveTo(x,y); tc.lineTo(x+dx+dy*0.6,y+dy-dx*0.6); tc.stroke(); };
    tip(21,6,0,4); tip(21,28,0,-4); tip(10,17,4,0); tip(32,17,-4,0);
  } else if (kind==='copy'){
    // two overlapping marquees
    tc.setLineDash([3,2]);
    tc.strokeRect(9,8,16,13); tc.strokeRect(17,14,16,13);
    tc.setLineDash([]);
  }
}
function makeCanvasTool(label,kind,opts){
  const b=document.createElement('button');
  b.className='canvas-tool'+(opts&&opts.active?' sel':'')+(opts&&opts.danger?' danger':'')+(opts&&opts.disabled?' disabled':'')+(opts&&opts.todo?' todo':'');
  b.title=opts&&opts.title || label;
  b.setAttribute('aria-pressed',opts&&opts.active?'true':'false');
  const c=document.createElement('canvas'); c.width=42; c.height=32;
  drawCanvasIcon(c.getContext('2d'),kind);
  const s=document.createElement('span'); s.textContent=label;
  b.append(c,s);
  if (opts&&opts.swatch){
    const sw=document.createElement('canvas');
    sw.className='rail-swatch'; sw.width=30; sw.height=24;
    drawBrushSwatchCanvas(sw,true);
    b.appendChild(sw);
  }
  if (opts&&opts.onClick) b.onclick=opts.onClick;
  return b;
}
function brushSwatchChoice(includeLast){
  if (isBrushTool(game.tool)) return [game.tool,game.toolVar||null];
  if (includeLast && isBrushTool(game.lastBrushTool)) return [game.lastBrushTool,game.lastBrushVar||null];
  return [null,null];
}
function drawBrushSwatchCanvas(c,includeLast){
  if (!c) return false;
  const [k,v]=brushSwatchChoice(includeLast);
  const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height);
  if (!k){ c.style.display='none'; return false; }
  c.style.display='';
  if (PLANTS[k]){
    const R=plantDef(k,v);
    const sc=Math.min(0.45, (c.height-5)/(plantArtTop(R)||40));
    g.save(); g.scale(sc,sc);
    const iconSeason=plantIconSeason(R);
    drawPlant(g,(c.width/2)/sc,(c.height-2)/sc,k,1,iconSeason,tileSeed(3,7),0,v||undefined,1);
    g.restore();
    return true;
  }
  const diamond=(fill,stroke)=>{
    const cx0=c.width/2, cy0=c.height/2+1, w=c.width*.72, h=c.height*.48;
    g.fillStyle=fill; g.beginPath();
    g.moveTo(cx0,cy0-h/2); g.lineTo(cx0+w/2,cy0); g.lineTo(cx0,cy0+h/2); g.lineTo(cx0-w/2,cy0);
    g.closePath(); g.fill();
    if (stroke){ g.strokeStyle=stroke; g.lineWidth=1.2; g.stroke(); }
  };
  if (k==='path'){ diamond(pathColor(game.pathColor).fill,'rgba(239,230,211,.55)'); return true; }
  if (k==='bed'){ diamond(bedStyle(game.bedStyle).fill||'#54402f','rgba(239,230,211,.42)'); return true; }
  if (k==='water'){ const ws=waterStyle(game.waterStyle); diamond(ws.fill,'rgba(232,248,244,.55)');
    g.strokeStyle='rgba(232,248,244,.8)'; g.lineWidth=1; g.beginPath();
    g.ellipse(c.width/2,c.height/2+1,c.width*.22,2.2,0,0,7); g.stroke(); return true; }
  if (isElevationTool(k)){ diamond(k==='lower'?'#6f7f83':'#8ba263','rgba(239,230,211,.45)');
    g.fillStyle='#efe6d3'; g.font='700 12px IBM Plex Sans'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(k==='level'?'0':(k==='raise'?'+':'-'),c.width/2,c.height/2+1); return true; }
  if (k==='fence'){ const st=fenceStyle(fenceDraft().style);
    g.strokeStyle=st.rail; g.lineWidth=2; g.lineCap='round';
    g.beginPath(); g.moveTo(5,16); g.lineTo(25,16); g.moveTo(5,10); g.lineTo(25,10);
    for (let x=7;x<=23;x+=8){ g.moveTo(x,19); g.lineTo(x,6); } g.stroke(); return true; }
  if (k==='light'){ const ld=lightDraft(), tone=lightTone(ld.tone);
    g.fillStyle=tone.col; g.beginPath(); g.ellipse(15,9,6,3,0,0,7); g.fill();
    g.strokeStyle='#d8c7ac'; g.lineWidth=1.7; g.beginPath(); g.moveTo(15,10); g.lineTo(15,22); g.stroke(); return true; }
  if (k==='firepit'){ diamond('#74695d','rgba(239,230,211,.35)');
    g.fillStyle='#30261f'; g.beginPath(); g.ellipse(c.width/2,c.height/2+1,6,3,0,0,7); g.fill();
    g.strokeStyle='#ef7f37'; g.lineWidth=1.3; g.beginPath();
    g.moveTo(12,12); g.quadraticCurveTo(13,7,15,10); g.moveTo(18,13); g.quadraticCurveTo(20,8,17,6); g.stroke(); return true; }
  if (k==='house'){ g.fillStyle=(game.houseDraft||defaultDraft()).wall; g.fillRect(9,11,12,9);
    g.fillStyle=(game.houseDraft||defaultDraft()).roof; g.beginPath(); g.moveTo(7,11); g.lineTo(15,5); g.lineTo(23,11); g.closePath(); g.fill(); return true; }
  c.style.display='none';
  return false;
}
function drawPlantModeIcon(tc,drift){
  tc.clearRect(0,0,28,24);
  tc.strokeStyle='#d8c7ac'; tc.fillStyle='#d8c7ac'; tc.lineWidth=1.6;
  if (!drift){
    tc.save(); tc.translate(14,12); tc.rotate(-0.72);
    tc.fillStyle='#c97f3f'; tc.fillRect(-2,-10,4,13);
    tc.fillStyle='#efe6d3'; tc.fillRect(-4,3,8,4);
    tc.fillStyle='#6f8f5a'; tc.beginPath(); tc.moveTo(-5,7); tc.quadraticCurveTo(0,13,5,7); tc.closePath(); tc.fill();
    tc.restore();
    return;
  }
  tc.strokeStyle='#efe6d3';
  for (let i=0;i<5;i++){
    const x=7+(i%3)*7, y=7+Math.floor(i/3)*7;
    tc.beginPath(); tc.ellipse(x,y,4,2.5,0,0,7); tc.stroke();
    tc.beginPath(); tc.moveTo(x,y-4); tc.lineTo(x,y-10); tc.stroke();
  }
}
// matrix scatter: evenly-spaced dots of two kinds (grass + forb) interwoven
function drawMatrixModeIcon(tc){
  tc.clearRect(0,0,28,24);
  // grass matrix on a lattice
  tc.strokeStyle='#8ead67'; tc.lineWidth=1.4; tc.lineCap='round';
  [[5,18],[13,14],[21,18],[9,8],[17,8]].forEach(([x,y])=>{
    tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x,y-5); tc.stroke(); });
  // forbs scattered through the gaps
  tc.fillStyle='#c97f3f';
  [[9,15],[18,13],[13,7]].forEach(([x,y])=>{ tc.beginPath(); tc.arc(x,y,2,0,7); tc.fill(); });
}
function drawPlacementIcon(tc,free){
  tc.clearRect(0,0,28,24);
  tc.strokeStyle='rgba(216,199,172,.55)'; tc.lineWidth=1;
  for (let i=0;i<2;i++) for (let j=0;j<2;j++){
    const x=6+i*10, y=5+j*8;
    tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x+5,y+3); tc.lineTo(x,y+6); tc.lineTo(x-5,y+3); tc.closePath(); tc.stroke();
  }
  const pts=free ? [[9,11],[19,8],[15,18]] : [[8,8],[18,8],[13,16]];
  tc.fillStyle=free?'#c97f3f':'#efe6d3';
  pts.forEach(([x,y])=>{ tc.beginPath(); tc.ellipse(x,y,3.2,2.2,0,0,7); tc.fill(); });
}
function drawFillModeIcon(tc,on){
  tc.clearRect(0,0,28,24);
  tc.lineCap='round'; tc.lineJoin='round';
  tc.strokeStyle='rgba(216,199,172,.55)'; tc.lineWidth=1;
  for (let i=0;i<2;i++) for (let j=0;j<2;j++){
    const x=7+i*9, y=4+j*7;
    tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x+5,y+3); tc.lineTo(x,y+6); tc.lineTo(x-5,y+3); tc.closePath(); tc.stroke();
  }
  tc.save(); tc.translate(16,10); tc.rotate(-0.72);
  tc.strokeStyle=on?'#efe6d3':'#d8c7ac'; tc.lineWidth=1.7;
  tc.strokeRect(-6,-5,12,10);
  tc.beginPath(); tc.moveTo(6,2); tc.lineTo(11,7); tc.stroke();
  tc.restore();
  tc.fillStyle=on?'#c97f3f':'#7d93a8';
  tc.beginPath(); tc.ellipse(22,19,4.4,2.2,0,0,7); tc.fill();
}
// a filled disc scaled by brush size, for the brush-bar + erase size dots
function drawBrushSizeIcon(tc,size,cx0,cy0,maxR){
  cx0=cx0||14; cy0=cy0||12; maxR=maxR||9;
  const i=Math.max(0,BRUSH_SIZES.indexOf(normalizeBrushSize(size)));
  const r=Math.max(2, maxR*(0.34+0.66*i/(BRUSH_SIZES.length-1)));
  tc.clearRect(0,0,tc.canvas.width,tc.canvas.height);
  tc.fillStyle='rgba(216,199,172,0.92)';
  tc.beginPath(); tc.arc(cx0,cy0,r,0,7); tc.fill();
  tc.strokeStyle='rgba(46,36,28,0.5)'; tc.lineWidth=1;
  tc.beginPath(); tc.arc(cx0,cy0,r,0,7); tc.stroke();
}
function setBrushSize(sz){ game.brushSize=normalizeBrushSize(sz); }
// a bed edge drawn crisp (formal) vs curved (organic), for the edge-style chips
function drawEdgeStyleIcon(tc,style){
  const w=tc.canvas.width, midY=tc.canvas.height/2;
  tc.clearRect(0,0,w,tc.canvas.height);
  tc.fillStyle='#6e5a48';
  tc.beginPath();
  if (style==='formal'){
    tc.moveTo(8,midY-8); tc.lineTo(w-8,midY-8); tc.lineTo(w-8,midY+9); tc.lineTo(8,midY+9); tc.closePath();
  } else {
    tc.moveTo(8,midY-1);
    tc.quadraticCurveTo(w*0.30,midY-10,w*0.5,midY-3);
    tc.quadraticCurveTo(w*0.72,midY+5,w-8,midY-4);
    tc.lineTo(w-8,midY+9); tc.lineTo(8,midY+9); tc.closePath();
  }
  tc.fill();
  tc.strokeStyle='#c9a07f'; tc.lineWidth=1.5; tc.stroke();
}
function drawSearchIcon(tc,close){
  tc.clearRect(0,0,24,24);
  tc.lineCap='round'; tc.lineJoin='round';
  if (close){
    tc.strokeStyle='#efe6d3'; tc.lineWidth=2.4;
    tc.beginPath(); tc.moveTo(7,7); tc.lineTo(17,17); tc.moveTo(17,7); tc.lineTo(7,17); tc.stroke();
    return;
  }
  tc.strokeStyle='#efe6d3'; tc.lineWidth=2;
  tc.beginPath(); tc.arc(10.5,10.5,5.5,0,Math.PI*2); tc.stroke();
  tc.strokeStyle='#c97f3f'; tc.lineWidth=2.4;
  tc.beginPath(); tc.moveTo(15,15); tc.lineTo(19,19); tc.stroke();
  tc.fillStyle='rgba(111,143,90,.35)';
  tc.beginPath(); tc.ellipse(9,11,3.1,1.7,-0.45,0,7); tc.fill();
}
function plantCategoryFor(k){
  const P=PLANTS[k]; if (!P) return 'grasses';
  const cat=TRAY_CATS.find(c=>c.types && c.types.includes(P.type) &&
    (!c.sunFilter || P.sun===c.sunFilter));
  return cat ? cat.id : 'grasses';
}
function visiblePlantChoice(){
  const visible=trayKeys();
  if (isBrushTool(game.lastBrushTool) && !PLANTS[game.lastBrushTool])
    return [game.lastBrushTool,null];
  if (PLANTS[game.lastBrushTool] && visible.includes(game.lastBrushTool))
    return [game.lastBrushTool,game.lastBrushVar||null];
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat && c.types);
  let keys=[];
  if (cat){
    keys=visible.filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
  }
  const k=keys[0] || visible.find(k=>PLANTS[k].type==='grass') || visible[0] ||
    PLANT_KEYS.find(k=>!PLANTS[k].hidden);
  return k ? [k,null] : null;
}
function armPlantToolFromRail(openMenu){
  const nextMenu=openMenu ? (game.toolMenu==='plant'?null:'plant') : null;
  const choice=visiblePlantChoice();
  game.fillMode=false;                  // plain planting, not bucket-fill
  if (choice){
    game.tool=choice[0]; game.toolVar=choice[1];
    const fallbackCat=brushTrayCatForTool(choice[0]) || 'grasses';
    game.trayCat=toolFitsBrushTray(choice[0],game.lastBrushTrayCat) ? game.lastBrushTrayCat : fallbackCat;
    game.drill=brushDrillFitsTray(game.lastBrushDrill,game.trayCat) ? game.lastBrushDrill : null;
    rememberBrushTool();
  } else {
    game.tool='hand'; game.toolVar=null; game.drill=null;
  }
  game.toolMenu=nextMenu;
  buildToolTray();
  renderCvRow();
  refreshCanvasTools();
  updateCanvasCursor();
  if (!choice) toast('Pick a plant from the catalog first.');
  return !!choice;
}
/* bucket fill: a tap floods the connected region of the tapped tile's
   GROUND material (grass / path / bed / water) and applies the armed brush
   to every tile in it — fill a bed block with a plant, recolour a path run,
   turn a lawn into beds, etc. Fill is a mode layered over the armed brush,
   so the bottom catalog still picks what you fill WITH. */
function fillActive(){ return game.fillMode && toolMeta(game.tool).paints; }
function groundMat(x,y){ return tileTerrain(x,y) || 'grass'; }
function doFloodFill(sx,sy){
  if (!onPlot(sx,sy) || siteStructureAt(sx,sy) || isDoor(sx,sy)) return;
  const seed=groundMat(sx,sy);
  // BFS the 4-connected region sharing that ground material
  const region=[], seen=new Set([sx+','+sy]), q=[[sx,sy]];
  while (q.length){
    const [x,y]=q.shift(); region.push([x,y]);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy, key=nx+','+ny;
      if (!onPlot(nx,ny) || seen.has(key)) continue;
      if (siteStructureAt(nx,ny) || isDoor(nx,ny)) continue;
      if (groundMat(nx,ny)!==seed) continue;
      seen.add(key); q.push([nx,ny]);
    }
  }
  let placed=0, what=null;
  withUndo(()=>{ region.forEach(([x,y])=>{ const r=applyToolAt(x,y); if (r){ placed++; what=r; } }); });
  if (placed){
    syncToolLayer(what);
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    const label = def ? def.name : game.tool==='path'?`${pathColor(game.pathColor).label} path`
      : game.tool==='water'?`${waterStyle(game.waterStyle).label} water`
      : isElevationTool(game.tool)?(game.tool==='raise'?'raised grade':game.tool==='lower'?'lowered grade':'level grade')
      : `${bedStyle(game.bedStyle).label} bed`;
    toast(`Filled ${placed} tile${placed>1?'s':''} with ${label}.`);
  } else toast('Nothing here that fill can change.');
}
/* eyedropper: sample whatever is on the tapped tile (plant > bulb > fence/light/firepit/boulder > terrain)
   and arm it as the brush, dropping straight into Plant mode so the next tap
   paints with it. */
function pickAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return;
  const k=`${x},${y}`;
  const direct=game.plants[k], sh=shrubAt(x,y);
  const p=(direct&&!direct.removed)?direct:(sh&&sh.p), b=game.bulbs[k], f=fenceAt(x,y), l=lightAt(x,y), fp=firepitAt(x,y), bo=boulderAt(x,y), building=buildingAt(x,y), terr=terrainAt(x,y);
  if (p && !p.removed){
    game.fillMode=false; game.trayCat=plantCategoryFor(p.s);
    setTool(p.s, p.v||null); buildToolTray();
    toast(`Picked ${plantDef(p.s,p.v).name}.`);
  } else if (b && !b.removed){
    game.fillMode=false; game.trayCat='bulbs';
    setTool(b.s, b.v||null); buildToolTray();
    toast(`Picked ${plantDef(b.s,b.v).name}.`);
  } else if (f){
    game.fillMode=false; game.trayCat='structures';
    game.fenceDraft=normalizeFenceDraft(f);
    setTool('fence', null); buildToolTray();
    toast(`Picked ${fenceLabel(f)}.`);
  } else if (l){
    game.fillMode=false; game.trayCat='lighting';
    game.lightDraft=normalizeLightDraft(l);
    setTool('light', null); buildToolTray();
    toast(`Picked ${lightLabel(l)}.`);
  } else if (fp){
    game.fillMode=false; game.trayCat='structures'; game.drill='firepit';
    game.firepitDraft=normalizeFirepitDraft(fp);
    setTool('firepit', null); buildToolTray();
    toast(`Picked ${firepitLabel(fp)}.`);
  } else if (bo){
    game.fillMode=false; game.trayCat='structures'; game.drill='boulder';
    game.boulderDraft=normalizeBoulderDraft(bo);
    setTool('boulder', null); buildToolTray();
    toast(`Picked ${boulderLabel(bo)}.`);
  } else if (building){
    game.fillMode=false; game.trayCat='house'; game.buildingStyleDraft=normalizeBuildingStyle(building);
    setTool('building',null); buildToolTray();
    toast(`Picked ${building.status==='proposed'?'proposed':'existing'} building footprint style.`);
  } else if (terr){
    if (terr.k==='path') game.pathColor=pathColorId(terr.c||game.pathColor);
    if (terr.k==='water') game.waterStyle=waterStyleId(terr.c||game.waterStyle);
    if (terr.k==='bed') game.bedStyle=bedStyleId(terr.c||game.bedStyle);
    game.fillMode=false; game.trayCat='landscape';
    setTool(terr.k, null); buildToolTray();
    toast(terr.k==='path'?`Picked ${pathColor(game.pathColor).label} path.`
      : terr.k==='water'?`Picked ${waterStyle(game.waterStyle).label} water.`
      : `Picked ${bedStyle(game.bedStyle).label} bed.`);
  } else toast('Nothing here to pick — tap a plant or material.');
}
function choosePlantMode(drift){
  game.drift=!!drift; game.matrix=false;   // Draw/Drift and Matrix are exclusive patterns
  armPlantToolFromRail(false);
  updateActiveToolStatus();
}
function chooseMatrixMode(){
  game.matrix=true; game.drift=false;
  armPlantToolFromRail(false);
  updateActiveToolStatus();
}
function choosePlacementMode(free){
  game.freePlanting=!!free;
  armPlantToolFromRail(false);
  updateActiveToolStatus();
}
function chooseWoodyAge(age){
  game.woodyAge=normalizeWoodyAge(age);
  armPlantToolFromRail(false);
  renderBrushBar();
  updateActiveToolStatus();
}
function chooseFillMode(on){
  if (on && !toolMeta(game.tool).paints){
    game.fillMode=false;
    toast('Pick a plant, landscape material, or leveling brush to use Fill.');
    renderBrushBar(); refreshCanvasTools();
    return;
  }
  game.fillMode=!!on;
  renderBrushBar(); refreshCanvasTools(); updateCanvasCursor();
  updateActiveToolStatus();
}
// (renderEraseTray / renderSelectTray were retired in Wave 4 — the Erase and
// Select tool options moved to the brush bar and the marquee action pill.)
function refreshCanvasTools(){ buildCanvasTools(); }
// The top bar carries the view/select controls. Desktop/tablet show the full
// buttons; phones collapse them into the compact View Tools menu.
function visibleEl(el){ return !!(el && getComputedStyle(el).display!=='none'); }
function syncTopTools(){
  const sel=document.getElementById('btnSelectTool');
  if (sel){ sel.classList.toggle('sel',game.tool==='select');
    sel.onclick=()=>{ setTool('select'); game.toolMenu=null; buildToolTray(); refreshCanvasTools(); };
    const c=document.getElementById('btnSelectIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'select'); }
  const rot=document.getElementById('btnRotateTool');
  if (rot){ rot.onclick=()=>rotateView(1);
    const c=document.getElementById('btnRotateIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'rotate'); }
  const lay=document.getElementById('btnLayersTool');
  if (lay){ lay.classList.toggle('sel',game.toolMenu==='layers'||layerViewActive());
    lay.setAttribute('aria-expanded',game.toolMenu==='layers'?'true':'false');
    lay.onclick=()=>toggleLayerMenu();
    const c=document.getElementById('btnLayersIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'layers'); }
  const rul=document.getElementById('btnRulerTool');
  if (rul){ rul.classList.toggle('sel',game.tool==='ruler');
    rul.onclick=()=>setTool('ruler');
    const c=document.getElementById('btnRulerIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'ruler'); }
  const view=document.getElementById('btnViewTools');
  if (view){ view.classList.toggle('sel',game.toolMenu==='view'||game.toolMenu==='layers'||game.tool==='select'||layerViewActive());
    view.setAttribute('aria-expanded',(game.toolMenu==='view'||(!visibleEl(lay)&&game.toolMenu==='layers'))?'true':'false');
    view.onclick=()=>toggleViewToolsMenu();
    const c=document.getElementById('btnViewToolsIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'viewtools'); }
  renderViewToolsMenu();
  renderLayerMenu();
}
function toggleViewToolsMenu(){
  const opening=game.toolMenu!=='view';
  game.toolMenu = opening ? 'view' : null;
  refreshCanvasTools();
  if (opening) focusToolMenu('viewToolsPop');
}
function focusToolMenu(id){
  requestAnimationFrame(()=>{
    const pop=document.getElementById(id), first=pop&&pop.querySelector('button:not([disabled])');
    if (first) first.focus({preventScroll:true});
  });
}
function buildCanvasTools(){
  const rail=document.getElementById('canvasTools'); if (!rail) return;
  syncTopTools();
  rail.innerHTML='';
  const add=(label,kind,opts)=>{ const b=makeCanvasTool(label,kind,opts||{}); rail.appendChild(b); return b; };
  const sep=()=>{ const s=document.createElement('div'); s.className='canvas-sep'; rail.appendChild(s); };
  add('Hand','hand',{active:game.tool==='hand',title:'Hand / safe select: drag the map to pan',
    onClick:()=>setTool('hand')});
  add('Plant','brush',{active:isBrushTool(game.tool),
    swatch:true,
    title:'Plant: pick a species below; set Draw/Drift and Grid/Free in the brush bar',
    onClick:()=>armPlantToolFromRail(false)});
  add('Erase','erase',{active:game.tool==='shovel',danger:true,title:'Erase plants, bulbs, or landscape',
    onClick:()=>armEraseTool()});
  add('Pick','dropper',{active:game.tool==='pick',
    title:'Eyedropper: tap a tile to copy its plant or material onto the brush',
    onClick:()=>{ setTool('pick'); buildToolTray(); }});
  // Undo/Redo are one-shot history actions, not modes — docked below a divider
  // so they read apart from the paint tools; greyed when their stack is empty.
  sep();
  add('Undo','undo',{disabled:!undoStack.length,title:'Undo (Ctrl+Z)',onClick:doUndo});
  add('Redo','redo',{disabled:!redoStack.length,title:'Redo (Ctrl+Shift+Z)',onClick:doRedo});
  renderViewToolsMenu();
  renderLayerMenu();
  renderSelectionActions();
}
function popButton(label,kind,sel,fn,title,extra){
  const b=document.createElement('button');
  b.setAttribute('role','menuitem');
  b.className=(sel?' sel':'')+(extra||'');
  b.title=title||label;
  if (kind){
    const c=document.createElement('canvas'); c.width=42; c.height=32;
    drawCanvasIcon(c.getContext('2d'),kind);
    b.appendChild(c);
  }
  const sp=document.createElement('span'); sp.textContent=label; b.appendChild(sp);
  b.onclick=ev=>{ ev.stopPropagation(); fn&&fn(); };
  return b;
}
function anchorPopover(pop,anchor){
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), w=pop.offsetWidth||170, h=pop.offsetHeight||160;
  const safe=typeof usableCanvasRect==='function' ? usableCanvasRect() : {left:8,top:8,right:innerWidth-8,bottom:innerHeight-8};
  let left=Math.min(Math.round(r.left),safe.right-w);
  left=Math.max(safe.left,left);
  let top=r.bottom+6;
  if (top+h>safe.bottom && r.top-h-6>=safe.top) top=r.top-h-6;
  top=Math.max(safe.top,Math.min(safe.bottom-h,top));
  pop.style.position='fixed'; pop.style.zIndex='40';
  pop.style.maxHeight=Math.max(80,safe.bottom-safe.top-8)+'px';
  pop.style.overflowY='auto';
  pop.style.top=Math.round(top)+'px';
  pop.style.left=left+'px';
  pop.style.right='auto'; pop.style.bottom='auto';
}
function renderViewToolsMenu(){
  const old=document.getElementById('viewToolsPop'); if (old) old.remove();
  const btn=document.getElementById('btnViewTools');
  if (game.toolMenu!=='view' || !visibleEl(btn)) return;
  const pop=document.createElement('div');
  pop.id='viewToolsPop'; pop.className='tool-popover view-tools-popover';
  pop.setAttribute('role','menu'); pop.setAttribute('aria-label','View tools');
  pop.appendChild(popButton('Fit plot',null,false,()=>{
    fitPlot(); game.toolMenu=null; refreshCanvasTools(); toast('Plot fitted to the available canvas.');
  },'Fit the whole plot in the clear canvas area'));
  pop.appendChild(popButton('Zoom out',null,false,()=>{ zoomBy(0.89); },'Zoom out'));
  pop.appendChild(popButton('Zoom in',null,false,()=>{ zoomBy(1.12); },'Zoom in'));
  if (!game.visiting){
    pop.appendChild(popButton('Select','select',game.tool==='select',()=>{
      setTool('select'); game.toolMenu=null; buildToolTray(); refreshCanvasTools();
    },'Select an area'));
  }
  pop.appendChild(popButton('Rotate','rotate',false,()=>{
    rotateView(1); game.toolMenu=null; refreshCanvasTools();
  },'Rotate view 90 degrees'));
  pop.appendChild(popButton('Layers','layers',layerViewActive(),()=>{
    game.toolMenu='layers'; refreshCanvasTools(); focusToolMenu('layerPop');
  },'Show or hide garden layers'));
  if (!game.visiting){
    pop.appendChild(popButton('Ruler','ruler',game.tool==='ruler',()=>{
      setTool('ruler'); game.toolMenu=null; refreshCanvasTools();
    },'Tape measure'));
  }
  anchorPopover(pop,btn);
}
// Arm Erase. Its layer + size options live in the brush bar (renderBrushBar),
// alongside the paint brush controls, so there's no separate menu to toggle.
function armEraseTool(){
  setTool('shovel',null);   // setTool clears game.toolMenu
  buildToolTray();
  refreshCanvasTools();
}
function renderSelectionActions(){
  const el=document.getElementById('selectionActions'); if (!el) return;
  el.innerHTML='';
  const oldMore=document.getElementById('selectionMore'); if (oldMore) oldMore.remove();
  if (game.tool!=='select' || !game.sel){ el.classList.add('hidden'); return; }
  const btn=(label,sel,fn,title,cls)=>{
    const b=document.createElement('button');
    b.className=(sel?'sel ':'')+(cls||'');
    b.textContent=label; b.title=title||label;
    b.onclick=e=>{ e.stopPropagation(); fn&&fn(); };
    el.appendChild(b);
    return b;
  };
  const est=selectionEstimate(game.sel,3,game.selItems);
  const summary=document.createElement('span'); summary.className='selection-summary';
  const feet=n=>Number.isInteger(n)?String(n):n.toFixed(1);
  summary.textContent=`${feet(est.widthFt)} x ${feet(est.heightFt)} ft - ${Math.round(est.areaSqFt)} sq ft`;
  el.appendChild(summary);
  btn('Move',game.selMode==='move',()=>{ game.selMode='move'; renderSelectionActions(); updateActiveToolStatus(); });
  btn('Copy',game.selMode==='copy',()=>{ game.selMode='copy'; renderSelectionActions(); updateActiveToolStatus(); });
  btn('Fill',false,()=>fillSelectionWithPlant(),'Fill the selection with the last selected plant or landscape material');
  const more=btn('More',false,null,'More selection actions');
  more.setAttribute('aria-haspopup','menu');
  more.onclick=e=>{ e.stopPropagation(); showSelectionMore(more); };
  el.classList.remove('hidden');
  positionSelectionActions();
}
function showSelectionMore(anchor){
  const old=document.getElementById('selectionMore'); if (old){ old.remove(); return; }
  const pop=document.createElement('div'); pop.id='selectionMore'; pop.className='selection-more'; pop.setAttribute('role','menu');
  const add=(label,fn,cls,disabled)=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=label; b.setAttribute('role','menuitem');
    if (cls) b.className=cls; b.disabled=!!disabled;
    b.onclick=e=>{ e.stopPropagation(); pop.remove(); fn&&fn(); };
    pop.appendChild(b);
  };
  add('Estimate materials\u2026',()=>openSelectionEstimate());
  add('Replace plants\u2026',()=>openSelectionReplace());
  add('Rotate 90 degrees',()=>{ rotateSelection(); renderSelectionActions(); refreshCanvasTools(); });
  add('Save area',()=>saveSelectedArea());
  add('Paste saved area',()=>pasteSavedArea(),null,!storedArea());
  add('Erase selection',()=>{ eraseSelection(); refreshCanvasTools(); },'danger');
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), w=pop.offsetWidth||190;
  pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
  pop.style.top=Math.max(8,r.top-pop.offsetHeight-6)+'px';
  const dismiss=e=>{ if (!pop.contains(e.target)){ pop.remove(); document.removeEventListener('pointerdown',dismiss,true); } };
  setTimeout(()=>document.addEventListener('pointerdown',dismiss,true),0);
  const first=pop.querySelector('button:not(:disabled)'); if (first) first.focus();
}
function renderSelectionEstimate(){
  const depth=+(document.getElementById('estimateDepth')||{}).value||3;
  const est=selectionEstimate(game.sel,depth,game.selItems), body=document.getElementById('estimateBody');
  if (!est||!body) return;
  const row=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
  let html=row('Selected area',`Approx. ${Math.round(est.areaSqFt)} sq ft`);
  if (est.bedTiles){
    html+=row('Bed area',`Approx. ${Math.round(est.bedAreaSqFt)} sq ft`);
    html+=row('Exposed bed edge',`Approx. ${est.edgeFt.toFixed(1)} ft`);
    html+=row(`Mulch at ${depth} in`,`Approx. ${est.mulchCuYd.toFixed(1)} cu yd`);
    if (est.approxPlants) html+=row(`${est.armedName} at spacing`,`Approx. ${est.approxPlants} plants`);
  }
  if (est.plants||est.bulbs) html+=row('Already placed',`${est.plants} plants${est.bulbs?` + ${est.bulbs} bulbs`:''}`);
  if (!est.bedTiles) html+=row('Bed materials','No bed tiles in this selection');
  body.innerHTML=html;
  const v=document.getElementById('estimateDepthValue'); if (v) v.textContent=`${depth} in`;
}
function openSelectionEstimate(){
  if (!game.sel){ toast('Select an area first.'); return; }
  renderSelectionEstimate(); openOverlay('estimateScreen','#estimateDepth');
}
function positionSelectionActions(){
  const el=document.getElementById('selectionActions');
  if (!el || el.classList.contains('hidden') || !game.sel) return;
  const r=game.sel, W=VW/ZOOM, H=VH/ZOOM;
  const top=screenOf((r.x0+r.x1)/2, r.y0-0.7, W, H);
  let x=Math.round(top[0]*ZOOM), y=Math.round(top[1]*ZOOM);
  const safe=typeof usableCanvasRect==='function' ? usableCanvasRect() : {left:86,top:118,right:VW-86,bottom:VH-120};
  x=Math.max(safe.left+78,Math.min(safe.right-78,x));
  y=Math.max(safe.top+26,Math.min(safe.bottom-12,y));
  if (el._px===x && el._py===y) return;   // called per frame — write only on change
  el._px=x; el._py=y;
  el.style.left=x+'px';
  el.style.top=y+'px';
}
/* a small themed yes/no modal, built on the fly (matches the .screen panels).
   Returns nothing; calls onOk only if the user confirms. */
function showConfirm(title, body, okLabel, onOk){
  const old=document.getElementById('confirmPop'); if (old) old.remove();
  const scr=document.createElement('div');
  scr.id='confirmPop'; scr.className='screen modal-screen hidden'; scr.setAttribute('role','alertdialog');
  scr.setAttribute('aria-modal','true'); scr.setAttribute('aria-labelledby','confirmPopTitle');
  scr.style.zIndex='60';
  scr.innerHTML='<div class="panel pause-panel" tabindex="-1"><h2 id="confirmPopTitle"></h2><p class="sub"></p>'+
    '<div class="row" style="margin-top:14px">'+
    '<button class="btn" data-x></button><button class="btn primary" data-ok></button></div></div>';
  scr.querySelector('h2').textContent=title;
  scr.querySelector('p').textContent=body||'';
  scr.querySelector('[data-x]').textContent='Cancel';
  scr.querySelector('[data-ok]').textContent=okLabel||'OK';
  const close=()=>{ closeOverlay('confirmPop'); scr.remove(); };
  scr.querySelector('[data-x]').onclick=close;
  scr.querySelector('[data-ok]').onclick=()=>{ close(); onOk&&onOk(); };
  scr.addEventListener('click',e=>{ if (e.target===scr) close(); });
  document.body.appendChild(scr);
  openOverlay('confirmPop','[data-x]');
}
/* the layer is hidden but the gardener is trying to draw on it: offer to
   reveal it, and honor their click by placing once they say yes. */
function promptRevealLayer(layer,x,y){
  const label=LAYER_LABELS[layer];
  showConfirm(`Show the ${label} layer?`,
    `The ${label} layer is hidden right now, so you can't see what you place there. Show it and plant?`,
    'Show layer',
    ()=>{
      setLayerVis(layer,true); refreshCanvasTools();
      withUndo(()=>{
        if (game.tool==='house'){ placeHouse(x,y); }
        else { game.tx=x; game.ty=y; actHere(); }
      });
    });
}
let sitePhotoEditState=null;
function fittedUnderlay(prepared,base){
  if (base){
    return normalizeUnderlay(Object.assign({},base,prepared,{visible:true,locked:false}));
  }
  const ratio=prepared.pixelW/prepared.pixelH, maxW=GW*.86, maxH=GH*.86;
  const widthTiles=Math.max(1,Math.min(maxW,maxH*ratio));
  return normalizeUnderlay(Object.assign({},prepared,{cx:(GW-1)/2,cy:(GH-1)/2,widthTiles,rotation:0,opacity:.35,visible:true,locked:false}));
}
function chooseSitePhoto(){
  const input=document.getElementById('sitePhotoFile'); if (!input) return;
  input.value=''; input.click();
}
function syncSitePhotoEditor(){
  const u=game.underlay; if (!u) return;
  const width=document.getElementById('sitePhotoWidth'), opacity=document.getElementById('sitePhotoOpacity'), rotation=document.getElementById('sitePhotoRotation');
  if (width && document.activeElement!==width) width.value=(u.widthTiles*TILE_IN/12).toFixed(1);
  if (opacity) opacity.value=Math.round(u.opacity*100);
  if (rotation) rotation.value=Math.round(u.rotation);
  const ov=document.getElementById('sitePhotoOpacityValue'); if (ov) ov.textContent=`${Math.round(u.opacity*100)}%`;
  const rv=document.getElementById('sitePhotoRotationValue'); if (rv) rv.textContent=`${Math.round(u.rotation)} deg`;
}
function sitePhotoCalibrationUi(message){
  const help=document.getElementById('sitePhotoHelp'), button=document.getElementById('btnSitePhotoCalibrate');
  if (help) help.textContent=message||'Drag the photo to move it. Pinch to scale and rotate, or use the controls below.';
  if (button) button.setAttribute('aria-pressed',game.underlayCalibration?'true':'false');
  if (typeof updateCanvasCursor==='function') updateCanvasCursor();
}
function startSitePhotoCalibration(){
  if (!game.photoEditing||!game.underlay) return;
  closeOverlay('sitePhotoCalibrateScreen',false);
  game.underlayCalibration={points:[]};
  sitePhotoCalibrationUi('Tap the first endpoint of a distance you know.');
  showCoachTip('Tap two points on the photo, then enter the real distance between them.','site-photo-calibrate');
}
function cancelSitePhotoCalibration(restoreFocus=true){
  game.underlayCalibration=null;
  closeOverlay('sitePhotoCalibrateScreen',restoreFocus);
  sitePhotoCalibrationUi();
}
function recordSitePhotoCalibrationPoint(point){
  const c=game.underlayCalibration;
  if (!c||!game.underlay) return false;
  if (!underlayContainsWorldPoint(game.underlay,point)){
    toast('Place the calibration point inside the photo.','warn'); return true;
  }
  if (c.points.length>=2) return true;
  c.points.push(point.slice());
  if (c.points.length===1){ sitePhotoCalibrationUi('Now tap the second endpoint of that known distance.'); return true; }
  sitePhotoCalibrationUi('Enter the real distance between your two points.');
  const input=document.getElementById('sitePhotoKnownDistance');
  if (input){
    input.value='';
    input.placeholder=(Math.hypot(point[0]-c.points[0][0],point[1]-c.points[0][1])*TILE_IN/12).toFixed(1);
  }
  openOverlay('sitePhotoCalibrateScreen','#sitePhotoKnownDistance');
  return true;
}
function applySitePhotoCalibration(){
  const c=game.underlayCalibration, input=document.getElementById('sitePhotoKnownDistance');
  const next=c&&c.points.length===2?calibrateUnderlayDistance(game.underlay,c.points[0],c.points[1],input&&input.value):null;
  if (!next){ toast('Enter a distance greater than zero.','warn'); if (input) input.focus(); return; }
  game.underlay=next; markUnderlayChanged(); cancelSitePhotoCalibration(); syncSitePhotoEditor();
  toast('Photo scale calibrated.');
}
function beginSitePhotoEdit(){
  if (!game.underlay){ chooseSitePhoto(); return; }
  if (!sitePhotoEditState) sitePhotoEditState={underlay:JSON.parse(JSON.stringify(game.underlay)),sheet:normalizedSheetState(game.sheetState)};
  game.photoEditing=true; game.underlay.visible=true; game.underlay.locked=false; markUnderlayChanged();
  const editor=document.getElementById('sitePhotoEditor'), hb=document.querySelector('.hud-bottom');
  if (editor) editor.classList.remove('hidden'); if (hb) hb.classList.add('photo-editing');
  setSheetState('half'); syncSitePhotoEditor();
  showCoachTip('Drag the photo to move it. Pinch to scale or rotate; use the controls for precise changes.','site-photo-edit');
}
function closeSitePhotoEdit(commit){
  const prior=sitePhotoEditState;
  cancelSitePhotoCalibration(false);
  if (!commit && prior) game.underlay=prior.underlay;
  if (commit && game.underlay) game.underlay.locked=true;
  game.photoEditing=false; markUnderlayChanged();
  const editor=document.getElementById('sitePhotoEditor'), hb=document.querySelector('.hud-bottom');
  if (editor) editor.classList.add('hidden'); if (hb) hb.classList.remove('photo-editing');
  const restore=prior&&prior.sheet; sitePhotoEditState=null;
  if (restore) setSheetState(restore); else applySheetState();
  refreshCanvasTools(); buildToolTray();
  if (game.mode==='solo') saveSolo(true).then(ok=>{ if (commit&&ok===false) toast('The site photo could not be saved - device storage is full.','warn'); });
}
function fitSitePhotoToPlot(){
  const u=game.underlay; if (!u) return;
  const ratio=u.pixelW/u.pixelH, maxW=GW*.86, maxH=GH*.86;
  u.widthTiles=Math.max(1,Math.min(maxW,maxH*ratio)); u.cx=(GW-1)/2; u.cy=(GH-1)/2; u.rotation=0;
  markUnderlayChanged(); syncSitePhotoEditor();
}
async function importSitePhoto(file){
  try{
    const prepared=await prepareUnderlayFile(file), had=game.underlay;
    if (!sitePhotoEditState) sitePhotoEditState={underlay:had?JSON.parse(JSON.stringify(had)):null,sheet:normalizedSheetState(game.sheetState)};
    game.underlay=fittedUnderlay(prepared,had); markUnderlayChanged(); beginSitePhotoEdit(); buildToolTray(); refreshCanvasTools();
  }catch(err){ toast(err&&err.message?err.message:'That site photo could not be added.','warn'); }
}
// true when the view is anything other than "everything visible, no overlay"
function layerViewActive(){
  return (ENABLE_LAYER_EDIT_FOCUS && game.layerFocus!=='all') || game.layerVis.shade ||
    game.layerVis.moisture || game.layerVis.height || game.layerVis.matureCanopies || game.layerVis.edgeRulers ||
    !!(game.underlay&&game.underlay.visible) || LAYER_DEFS.some(([k])=>!layerShown(k));
}
function blockIfWrongEditLayer(layer){
  if (!layer || layerEditable(layer)) return false;
  toast(`Edit focus is ${LAYER_LABELS[game.layerFocus]||game.layerFocus}. Switch to All or ${LAYER_LABELS[layer]} to edit here.`);
  return true;
}
function toggleLayerMenu(){
  const opening=game.toolMenu!=='layers';
  game.toolMenu = opening ? 'layers' : null;
  refreshCanvasTools();
  if (opening) focusToolMenu('layerPop');
}
// The Layers flyout hangs off the top-bar Layers button now, so pin it there as
// a fixed dropdown (same idea as the garden/time menus) and rebuild it in place
// whenever the rail refreshes — its rows call refreshCanvasTools() to re-render.
function renderLayerMenu(){
  const old=document.getElementById('layerPop'); if (old) old.remove();
  const btn = visibleEl(document.getElementById('btnLayersTool'))
    ? document.getElementById('btnLayersTool')
    : document.getElementById('btnViewTools');
  if (game.toolMenu!=='layers' || !btn) return;
  const viewPop=document.getElementById('viewToolsPop'); if (viewPop) viewPop.remove();
  const pop=buildLayerPopover(); pop.id='layerPop';
  pop.setAttribute('aria-label','Garden layers and overlays');
  pop.style.position='fixed'; pop.style.zIndex='40';
  pop.style.bottom='auto'; pop.style.right='auto';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(), w=pop.offsetWidth||172;
  let left=Math.min(Math.round(r.left), innerWidth-w-8); left=Math.max(8,left);
  pop.style.top=Math.round(r.bottom+6)+'px';
  pop.style.left=left+'px';
}
function buildLayerPopover(){
  if (!ENABLE_LAYER_EDIT_FOCUS) game.layerFocus='all';
  const pop=document.createElement('div');
  pop.className='tool-popover layer-popover'; pop.setAttribute('role','menu');
  const section=title=>{ const h=document.createElement('div');
    h.className='layer-section'; h.setAttribute('role','presentation'); h.textContent=title; pop.appendChild(h); };
  const eyeIcon=(on)=>{
    const c=document.createElement('canvas');
    c.className='layer-eye';
    c.width=24; c.height=18;
    const tc=c.getContext('2d');
    tc.clearRect(0,0,24,18);
    tc.strokeStyle=on?'#efe6d3':'#7d7164';
    tc.fillStyle=on?'rgba(201,127,63,.34)':'rgba(239,230,211,.05)';
    tc.lineWidth=1.7; tc.lineCap='round'; tc.lineJoin='round';
    tc.beginPath();
    tc.moveTo(3,9); tc.quadraticCurveTo(12,2.5,21,9); tc.quadraticCurveTo(12,15.5,3,9);
    tc.fill(); tc.stroke();
    tc.beginPath(); tc.arc(12,9,on?3.1:2.2,0,7); tc.fillStyle=on?'#c97f3f':'#7d7164'; tc.fill();
    if (!on){ tc.strokeStyle='#7d7164'; tc.lineWidth=2; tc.beginPath(); tc.moveTo(5,15); tc.lineTo(19,3); tc.stroke(); }
    return c;
  };
  // one row = a visibility toggle. The whole row (eye + label) flips it;
  // the row mutes when off and stays put so it can be turned back on.
  const row=(get,set,label)=>{
    const on=get();
    const b=document.createElement('button');
    b.setAttribute('role','menuitemcheckbox'); b.setAttribute('aria-checked',on?'true':'false');
    b.className='layer-row'+(on?'':' off');
    b.title=(on?'Hide ':'Show ')+label;
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eyeIcon(on),nm);
    b.onclick=ev=>{ ev.stopPropagation(); set(!on); refreshCanvasTools();
      toast(`${label} ${!on?'shown':'hidden'}.`); };
    pop.appendChild(b);
  };
  const focusRow=(key,label)=>{
    const on=game.layerFocus===key;
    const b=document.createElement('button');
    b.setAttribute('role','menuitemradio'); b.setAttribute('aria-checked',on?'true':'false');
    b.className='layer-row'+(on?' sel':'');
    b.title=`Edit ${label}`;
    const eye=document.createElement('span'); eye.className='layer-eye'; eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); game.layerFocus=key; refreshCanvasTools();
      toast(key==='all'?'Editing all visible layers.':`Editing ${label} only.`); };
    pop.appendChild(b);
  };
  section('Visible');
  const allVisible=()=>LAYER_DEFS.every(([key])=>layerShown(key)) &&
    !game.layerVis.shade && !game.layerVis.moisture && !game.layerVis.height &&
    !game.layerVis.matureCanopies && !game.layerVis.edgeRulers;
  const allRow=document.createElement('button');
  allRow.setAttribute('role','menuitemradio'); allRow.setAttribute('aria-checked',allVisible()?'true':'false');
  allRow.className='layer-row'+(allVisible()?' sel':'');
  allRow.title='Show the normal full garden';
  const allName=document.createElement('span'); allName.className='layer-name'; allName.textContent='All';
  allRow.append(eyeIcon(allVisible()),allName);
  allRow.onclick=ev=>{ ev.stopPropagation();
    LAYER_DEFS.forEach(([key])=>{ setLayerVis(key,true,false); });
    ['shade','moisture','height','matureCanopies','edgeRulers'].forEach(key=>setLayerVis(key,false,false));
    persistLayerVis();
    refreshCanvasTools(); toast('All layers shown.'); };
  pop.appendChild(allRow);
  LAYER_DEFS.forEach(([key])=>row(
    ()=>layerShown(key), v=>{ setLayerVis(key,v); }, LAYER_LABELS[key]));
  if (ENABLE_LAYER_EDIT_FOCUS){
    section('Edit');
    focusRow('all','All');
    LAYER_DEFS.forEach(([key])=>focusRow(key,LAYER_LABELS[key]));
  }
  section('Overlays');
  row(()=>!!game.layerVis.shade, v=>{ setLayerVis('shade',v); }, 'Shade Overlay');
  row(()=>!!game.layerVis.moisture, v=>{ setLayerVis('moisture',v); }, 'Moisture Overlay');
  row(()=>!!game.layerVis.height, v=>{ setLayerVis('height',v); }, 'Height Overlay');
  row(()=>!!game.layerVis.matureCanopies, v=>{ setLayerVis('matureCanopies',v); }, 'Mature Canopies');
  row(()=>!!game.layerVis.edgeRulers, v=>{ setLayerVis('edgeRulers',v); }, 'Edge Rulers');
  section('Reference');
  if (game.underlay){
    row(()=>!!game.underlay.visible, v=>{ game.underlay.visible=v; markUnderlayChanged(); if (game.mode==='solo') saveSolo(true); }, 'Site Photo');
    const edit=document.createElement('button'); edit.className='layer-row'; edit.setAttribute('role','menuitem');
    const mark=document.createElement('span'); mark.className='layer-eye'; mark.textContent='+';
    const label=document.createElement('span'); label.className='layer-name'; label.textContent='Edit site photo\u2026'; edit.append(mark,label);
    edit.onclick=ev=>{ ev.stopPropagation(); game.toolMenu=null; beginSitePhotoEdit(); refreshCanvasTools(); }; pop.appendChild(edit);
  } else {
    const add=document.createElement('button'); add.className='layer-row'; add.setAttribute('role','menuitem');
    const mark=document.createElement('span'); mark.className='layer-eye'; mark.textContent='+';
    const label=document.createElement('span'); label.className='layer-name'; label.textContent='Add site photo\u2026'; add.append(mark,label);
    add.onclick=ev=>{ ev.stopPropagation(); chooseSitePhoto(); }; pop.appendChild(add);
  }
  return pop;
}
function trayViewKey(cat=game.trayCat,drill=game.drill){
  const d=typeof activeDiscovery==='function' ? activeDiscovery() : {};
  const lens=[d.source||'recommended',d.collectionId||'',d.category||'',(d.query||'').trim().toLocaleLowerCase()].join(':');
  return `${cat}|${drill||''}|${game.searchOpen?'search':'grid'}|${lens}`;
}
function saveTrayScroll(){
  const tray=document.getElementById('toolTray');
  if (!tray || !tray.dataset || !tray.dataset.viewKey) return;
  game.trayScroll[tray.dataset.viewKey]={left:tray.scrollLeft||0,top:tray.scrollTop||0};
}
function restoreTrayScroll(){
  const tray=document.getElementById('toolTray');
  if (!tray || !tray.dataset) return;
  const key=trayViewKey();
  tray.dataset.viewKey=key;
  const saved=game.trayScroll[key], left=typeof saved==='object'?saved.left:saved, top=typeof saved==='object'?saved.top:0;
  tray.scrollLeft=Number.isFinite(left) ? left : 0;
  tray.scrollTop=Number.isFinite(top) ? top : 0;
}
function finishToolTrayRender(){
  restoreTrayScroll();
  updateCanvasCursor();
}
function trayCatLabel(id){ const c=TRAY_CATS.find(c=>c.id===id); return c?c.label:cap(id||'catalog'); }
function traySep(tray,label,title){
  const sep=document.createElement('span');
  sep.className='tray-sep';
  sep.textContent=label;
  if (title) sep.title=title;
  tray.appendChild(sep);
  return sep;
}
function plantSearchHay(k){
  const P=PLANTS[k];
  if (!P) return '';
  let hay=[k,P.name,P.latin,P.group||'',P.chip||'',roleSummary(k,12),trayCatLabel(plantCategoryFor(k))].join(' ');
  for (const v in (P.cv||{})){
    const C=P.cv[v];
    hay+=' '+v+' '+(C.name||'')+' '+(C.latin||'');
  }
  if (P.group) PLANT_KEYS.forEach(k2=>{ const G=PLANTS[k2];
    if (G && G.group===P.group) hay+=' '+G.name+' '+G.latin+' '+(G.chip||'')+' '+roleSummary(k2,12);
  });
  return hay.toLowerCase();
}
function searchToolItems(){
  return [
    {cat:'landscape',tool:'path',label:'Path',kind:'fill',
      hay:'path paths walkway gravel limestone slate charcoal red clay hardscape landscape'},
    {cat:'landscape',tool:'bed',label:'Bed',kind:'fill',
      hay:'bed beds soil gravel rock river rock leaf litter mulch bark planting area landscape'},
    {cat:'landscape',tool:'water',label:'Water',kind:'fill',
      hay:'water pond river lake stream creek wet landscape'},
    {cat:'leveling',tool:'raise',label:'Raise',kind:'layers',
      hay:'raise elevation grade berm terrace hill leveling'},
    {cat:'leveling',tool:'lower',label:'Lower',kind:'layers',
      hay:'lower elevation grade swale basin depression leveling'},
    {cat:'leveling',tool:'level',label:'Level',kind:'layers',
      hay:'level elevation grade flatten reset leveling'},
    {cat:'structures',tool:'fence',drill:'fence',label:'Fence / Gate',kind:'layers',
      hay:'fence gate door hardscape structures black aluminum wood vinyl chainlink brick 4 foot 6 foot'},
    {cat:'structures',tool:'firepit',drill:'firepit',label:'Fire Pit',kind:'fill',
      hay:'fire pit firepit hardscape structure round square rectangle 24 36 48 patio'},
    {cat:'structures',tool:'boulder',drill:'boulder',label:'Boulder',kind:'fill',
      hay:'boulder rock stone hardscape round small medium large rectangular oblong'},
    {cat:'lighting',tool:'light',label:'Lighting',kind:'dropper',
      hay:'lighting lights path light lantern post outdoor lamp eco warm bright night'},
    {cat:'house',tool:'building',label:'Building Footprint',kind:'building',
      hay:'building footprint house site exterior outline existing proposed wall roof bed area'},
    {cat:'house',tool:'house',label:'House',kind:'brush',
      hay:'house home building wall roof size color'}
  ];
}
function landscapeSearchItems(query){
  const q=String(query||'').toLowerCase().trim();
  return q ? searchToolItems().filter(item=>item.hay.includes(q)||item.label.toLowerCase().includes(q)) : [];
}
function drawSearchToolIcon(tc,item){
  tc.clearRect(0,0,48,44);
  if (item.tool==='path'||item.tool==='bed'||item.tool==='water'){
    const fill=item.tool==='path'?pathColor(game.pathColor).fill
      : item.tool==='bed'?(bedStyle(game.bedStyle).fill||'#54402f')
      : waterStyle(game.waterStyle).fill;
    tc.fillStyle=fill;
    tc.beginPath(); tc.moveTo(24,9); tc.lineTo(42,22); tc.lineTo(24,35); tc.lineTo(6,22); tc.closePath(); tc.fill();
    tc.strokeStyle='rgba(239,230,211,.48)'; tc.lineWidth=1.4; tc.stroke();
    return;
  }
  tc.save(); tc.translate(3,6); drawCanvasIcon(tc,item.kind||'brush'); tc.restore();
}
function renderSearchPlantButton(tray,k){
  const P=PLANTS[k], catId=plantCategoryFor(k), R=plantDef(k,null);
  const b=document.createElement('button');
  b.className='tool'+(game.tool===k?' sel':'')+((P.group||P.cv)?' has-sub':'');
  b.dataset.k=k; if (P.group) b.dataset.group=P.group;
  b.title=`${P.name} - ${P.latin} (${trayCatLabel(catId)})`;
  const c=document.createElement('canvas'); c.width=48; c.height=44;
  const sc=Math.min(0.62,36/(plantArtTop(R)||40));
  const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
  const iconSeason=plantIconSeason(R);
  drawPlant(ctx2,24/sc,42/sc,k,1,iconSeason,tileSeed(3,7),0,undefined,1);
  const sp=document.createElement('span');
  sp.textContent=(P.chip||P.name).split(' ').slice(0,2).join(' ');
  b.append(c,sp);
  b.onclick=()=>{
    saveTrayScroll();
    game.trayCat=catId; game.searchOpen=false; game.traySearch=''; game.catMenuOpen=false;
    game.drill=(P.group||P.cv) ? k : null;
    setTool(k,null);
    buildToolTray();
  };
  tray.appendChild(b);
}
function renderSearchToolButton(tray,item){
  const b=document.createElement('button');
  b.className='tool'+(game.tool===item.tool?' sel':'')+(item.drill?' has-sub':'');
  b.dataset.k=item.tool;
  b.title=`${item.label} - ${trayCatLabel(item.cat)}`;
  const c=document.createElement('canvas'); c.width=48; c.height=44;
  drawSearchToolIcon(c.getContext('2d'),item);
  const sp=document.createElement('span'); sp.textContent=item.label;
  b.append(c,sp);
  b.onclick=()=>{
    saveTrayScroll();
    game.trayCat=item.cat; game.searchOpen=false; game.traySearch=''; game.catMenuOpen=false;
    game.drill=item.drill||null;
    setTool(item.tool,null);
    buildToolTray();
  };
  tray.appendChild(b);
}
function renderLandscapeSearchTray(tray,query){
  const items=landscapeSearchItems(query), status=document.createElement('div');
  status.className='landscape-search-summary'; status.setAttribute('role','status');
  status.textContent=`${items.length} landscape tool${items.length===1?'':'s'} found`;
  tray.appendChild(status);
  if (!items.length){
    const empty=document.createElement('div'); empty.className='tray-empty landscape-search-empty';
    empty.textContent=`No landscape tools match "${String(query||'').trim()}".`;
    tray.appendChild(empty); return;
  }
  items.forEach(item=>renderSearchToolButton(tray,item));
}
function renderGlobalSearchTray(tray,q){
  q=(q||'').toLowerCase().trim();
  const groups=[];
  TRAY_CATS.forEach(cat=>{
    const plants=cat.types ? trayKeys().filter(k=>
      cat.types.includes(PLANTS[k].type) && (!cat.sunFilter || PLANTS[k].sun===cat.sunFilter) &&
      plantSearchHay(k).includes(q)) : [];
    if (plants.length) groups.push({cat,plants});
  });
  const total=groups.reduce((n,g)=>n+g.plants.length,0), status=document.createElement('span');
  status.className='search-count'; status.setAttribute('role','status'); status.textContent=`${total} plant${total===1?'':'s'} found`;
  tray.appendChild(status);
  if (!groups.length){
    const sp=document.createElement('span');
    sp.className='tray-empty';
    sp.textContent=`No catalog results for "${q}".`;
    tray.appendChild(sp);
    return;
  }
  groups.forEach(({cat,plants})=>{
    traySep(tray,cat.label,'Search result category');
    plants.slice(0,36).forEach(k=>renderSearchPlantButton(tray,k));
  });
}

/* ---------- plant discovery: palettes, Find, and result cards ---------- */
let discoverySearchTimer=0, landscapeSearchTimer=0, discoveryFilterDraft=null, discoveryCriteriaDraft=null, palettePendingRef=null, paletteRenameId=null, sourceMenuOpen=false, sourceMenuCloseListener=null;
let discoveryOpenSpecies=null, discoveryReturnScroll=0;
function focusDiscoverySourceTrigger(){
  setTimeout(()=>{ const trigger=document.querySelector('.discovery-source'); if (trigger) trigger.focus({preventScroll:true}); },0);
}
function focusDiscoverySourceItem(position='selected'){
  setTimeout(()=>{
    if (!sourceMenuOpen) return;
    const menu=document.querySelector('.discovery-source-menu'); if (!menu) return;
    const items=[...menu.querySelectorAll('[role="menuitemradio"]')]; if (!items.length) return;
    let target=position==='last' ? items[items.length-1] : position==='first' ? items[0] : menu.querySelector('[aria-checked="true"]')||items[0];
    items.forEach(item=>item.tabIndex=item===target?0:-1); target.focus({preventScroll:true});
  },0);
}
function openDiscoverySourceMenu(position='selected'){
  sourceMenuOpen=true; buildToolTray(); focusDiscoverySourceItem(position);
}
function dismissDiscoverySourceMenu(restoreFocus=false){
  closeDiscoverySourceMenu();
  const menu=document.querySelector('.discovery-source-menu'); if (menu) menu.remove();
  const trigger=document.querySelector('.discovery-source');
  if (trigger){
    trigger.setAttribute('aria-expanded','false');
    const arrow=trigger.querySelector('i'); if (arrow) setUiIcon(arrow,'chevron-down');
    if (restoreFocus) trigger.focus({preventScroll:true});
  }
}
function closeDiscoverySourceMenu(rebuild=false,restoreFocus=false){
  sourceMenuOpen=false;
  if (sourceMenuCloseListener){ document.removeEventListener('click',sourceMenuCloseListener); sourceMenuCloseListener=null; }
  if (rebuild){ buildToolTray(); if (restoreFocus) focusDiscoverySourceTrigger(); }
}
function discoverySwatch(family){ return (DISCOVERY_COLOR_FAMILIES.find(x=>x[0]===family)||[])[2]||'#b8a994'; }
function previewSeasonForRef(ref,d){
  const P=refDef(ref), seasons=(d.bloomSeasons||[]).length?d.bloomSeasons:DISCOVERY_SEASONS.map(x=>x[0]);
  return seasons.find(s=>bloomMonthsInSeason(P,s).length && P.sea&&P.sea[s]&&P.sea[s].bloom)
    || plantIconSeason(P);
}
function resultFlowerFamily(ref,d){
  const P=refDef(ref), seasons=(d.bloomSeasons||[]).length?d.bloomSeasons:DISCOVERY_SEASONS.map(x=>x[0]);
  for (const s of seasons){ const f=flowerFamiliesFor(P,s); if (f.length) return f[0]; }
  return null;
}
function activePlantRef(ref){ return !!ref && game.tool===ref.s && (game.toolVar||null)===(ref.v||null); }
function discoveryGroupBloomText(group){
  const months=[...new Set(group.refs.flatMap(ref=>{ const P=refDef(ref); return P?bloomMonthsFor(P):[]; }))].sort((a,b)=>a-b);
  if (!months.length) return 'No bloom time recorded';
  const labels=CAL_MONTH_LABELS||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months.length===1?labels[months[0]-1]:`${labels[months[0]-1]}\u2013${labels[months[months.length-1]-1]}`;
}
function discoveryGroupFamilies(group,d){
  const out=[];
  group.refs.forEach(ref=>{ const family=resultFlowerFamily(ref,d); if (family&&!out.includes(family)) out.push(family); });
  return out.slice(0,3);
}
function discoveryBloomTimeline(P){
  const line=document.createElement('span'); line.className='plant-bloom-timeline'; line.setAttribute('aria-hidden','true');
  const active=new Set(bloomMonthsFor(P));
  for (let month=1;month<=12;month++){
    const tick=document.createElement('i'); if (active.has(month)) tick.className='on'; line.appendChild(tick);
  }
  return line;
}
function discoverySiteMeta(P){
  const meta=document.createElement('span'); meta.className='plant-site-meta';
  const sun=P.sun==='full'?'Full sun':P.sun==='part'?'Part shade':'Shade';
  const moisture=P.moist==='dry'?'Low water':P.moist==='moist'?'Moist':'Average water';
  const size=typeof matureSizeText==='function'?matureSizeText(P):'';
  meta.textContent=[sun,moisture,size].filter(Boolean).join(' \u00b7 ');
  return meta;
}
function discoveryPlacingBadge(row,selected){
  if (!selected) return;
  const badge=document.createElement('span'); badge.className='placing-badge'; badge.textContent='Placing'; row.appendChild(badge);
}
function discoveryResultCard(ref,d,opts={}){
  const P=refDef(ref), row=document.createElement('article'), selected=activePlantRef(ref); row.className='plant-result-card'+(selected?' sel':'');
  if (opts.variant) row.classList.add('plant-variant-card');
  const main=document.createElement('button'); main.type='button'; main.className='plant-result-main';
  main.title=`Choose ${P.name}`; main.setAttribute('aria-label',`Choose ${P.name}`); main.setAttribute('aria-pressed',selected?'true':'false');
  const art=document.createElement('canvas'); art.className='plant-result-art'; art.width=112; art.height=124;
  const tc=art.getContext('2d'), scale=Math.min(1.15,88/(plantArtTop(P)||40)); tc.scale(scale,scale);
  drawPlant(tc,56/scale,110/scale,ref.s,1,previewSeasonForRef(ref,d),tileSeed(3,7),0,ref.v||undefined,1);
  const copy=document.createElement('span'); copy.className='plant-result-copy';
  const name=document.createElement('b'); name.textContent=P.name;
  const latin=document.createElement('em'); latin.textContent=P.latin||'';
  const meta=document.createElement('span'); meta.className='plant-result-meta';
  const family=resultFlowerFamily(ref,d);
  if (family){ const dot=document.createElement('i'); dot.className='plant-result-dot'; dot.style.background=discoverySwatch(family); dot.setAttribute('aria-hidden','true'); meta.appendChild(dot); }
  const bloom=document.createElement('span'); bloom.textContent=`Blooms ${bloomRangeText(P)}`; meta.appendChild(bloom);
  const kind=document.createElement('small'); kind.textContent=ref.v?'Cultivar':(opts.variant?'Straight species':''); if (kind.textContent) meta.appendChild(kind);
  copy.append(name,latin,meta,discoveryBloomTimeline(P),discoverySiteMeta(P)); main.append(art,copy);
  if (opts.variant){
    const details=document.createElement('span'); details.className='plant-variant-details';
    const size=typeof matureSizeText==='function'?matureSizeText(P):'';
    details.textContent=[size,P.note||''].filter(Boolean).join(' \u00b7 ');
    if (details.textContent) copy.appendChild(details);
  }
  main.onclick=()=>{ game.drill=null; setTool(ref.s,ref.v||null); buildToolTray(); toast(`${P.name} selected.`); };
  const actions=document.createElement('span'); actions.className='plant-result-actions';
  const heart=document.createElement('button'); heart.type='button'; heart.className='plant-result-heart'+(isFavorite(ref)?' on':'');
  heart.title=isFavorite(ref)?`Remove ${P.name} from Favorites`:`Add ${P.name} to Favorites`;
  heart.setAttribute('aria-label',heart.title); setUiIcon(heart,'heart');
  heart.onclick=()=>{ toggleFavorite(ref); buildToolTray(); };
  const inPalette=d.source==='palette' && d.collectionId;
  const add=document.createElement('button'); add.type='button'; add.className='plant-result-add';
  add.title=inPalette?`Remove ${P.name} from this palette`:`Add ${P.name} to a palette`;
  add.setAttribute('aria-label',add.title); setUiIcon(add,inPalette?'minus':'plus');
  add.onclick=()=>{ if (inPalette){ removePaletteRef(d.collectionId,ref); buildToolTray(); } else openPaletteManager(ref); };
  actions.append(heart,add); row.append(main,actions); discoveryPlacingBadge(row,selected); return row;
}
function discoveryFamilyCard(group,d){
  if (group.refs.length===1) return discoveryResultCard(group.refs[0],d);
  const base=PLANTS[group.s], active=group.refs.find(activePlantRef), rep=active||group.representativeRef;
  const R=refDef(rep)||base, row=document.createElement('article');
  row.className='plant-result-card plant-family-card'+(active?' sel':''); row.id=`plant-family-${group.s}`;
  const main=document.createElement('button'); main.type='button'; main.className='plant-result-main plant-family-main';
  main.title=`View ${base.name} varieties`; main.setAttribute('aria-label',`View ${base.name} varieties`);
  main.setAttribute('aria-expanded','false'); main.setAttribute('aria-controls',`plant-varieties-${group.s}`);
  const art=document.createElement('canvas'); art.className='plant-result-art'; art.width=112; art.height=124;
  const tc=art.getContext('2d'), scale=Math.min(1.15,88/(plantArtTop(R)||40)); tc.scale(scale,scale);
  drawPlant(tc,56/scale,110/scale,group.s,1,previewSeasonForRef(rep,d),tileSeed(3,7),0,rep.v||undefined,1);
  const copy=document.createElement('span'); copy.className='plant-result-copy';
  const name=document.createElement('b'); name.textContent=base.name;
  const latin=document.createElement('em'); latin.textContent=base.latin||'';
  const meta=document.createElement('span'); meta.className='plant-result-meta';
  discoveryGroupFamilies(group,d).forEach(family=>{ const dot=document.createElement('i'); dot.className='plant-result-dot'; dot.style.background=discoverySwatch(family); dot.setAttribute('aria-hidden','true'); meta.appendChild(dot); });
  const varieties=document.createElement('span'); varieties.textContent=`${group.cultivarRefs.length} variet${group.cultivarRefs.length===1?'y':'ies'}`;
  const bloom=document.createElement('span'); bloom.textContent=`Blooms ${discoveryGroupBloomText(group)}`;
  varieties.className='plant-variety-tag';
  meta.append(bloom,varieties); copy.append(name,latin,meta,discoveryBloomTimeline(R),discoverySiteMeta(R)); main.append(art,copy);
  const open=document.createElement('span'); open.className='plant-family-open'; open.textContent='View'; const arrow=document.createElement('i'); setUiIcon(arrow,'chevron-right'); open.appendChild(arrow);
  main.appendChild(open);
  main.onclick=()=>{
    const tray=document.getElementById('toolTray'); discoveryReturnScroll=tray?tray.scrollTop:0;
    discoveryOpenSpecies=group.s; setSheetState('full'); buildToolTray();
    setTimeout(()=>{ const head=document.querySelector('.cultivar-drill-back'); if (head) head.focus({preventScroll:true}); },0);
  };
  row.appendChild(main); discoveryPlacingBadge(row,!!active); return row;
}
function discoverySourceValue(d=activeDiscovery()){
  return d.source==='palette'&&d.collectionId ? `palette:${d.collectionId}` : d.source;
}
function discoverySourceMenu(d){
  const selected=discoverySourceValue(d), wrap=document.createElement('div'); wrap.className='discovery-source-wrap';
  const trigger=document.createElement('button'); trigger.type='button'; trigger.className='discovery-source';
  trigger.title='Choose the plants to browse'; trigger.setAttribute('aria-label','Choose plants to browse');
  trigger.setAttribute('aria-haspopup','menu'); trigger.setAttribute('aria-expanded',sourceMenuOpen?'true':'false');
  const label=document.createElement('span'); label.textContent=discoverySourceLabel(d);
  const arrow=document.createElement('i'); setUiIcon(arrow,sourceMenuOpen?'chevron-up':'chevron-down'); trigger.append(label,arrow);
  trigger.onclick=()=>{ if (sourceMenuOpen) dismissDiscoverySourceMenu(true); else openDiscoverySourceMenu(); };
  trigger.onkeydown=e=>{
    if (e.key==='Escape'&&sourceMenuOpen){ e.preventDefault(); e.stopPropagation(); dismissDiscoverySourceMenu(true); }
    else if (!sourceMenuOpen&&(e.key==='ArrowDown'||e.key==='ArrowUp')){ e.preventDefault(); openDiscoverySourceMenu(e.key==='ArrowUp'?'last':'selected'); }
  };
  wrap.appendChild(trigger);
  if (!sourceMenuOpen) return wrap;
  const menu=document.createElement('div'); menu.className='discovery-source-menu'; menu.setAttribute('role','menu');
  const section=labelText=>{ const label=document.createElement('p'); label.className='discovery-source-label'; label.textContent=labelText; menu.appendChild(label); };
  const item=(labelText,value,active=false)=>{ const b=document.createElement('button'); b.type='button'; b.className='discovery-source-item'+(active?' sel':'');
    b.textContent=labelText; b.setAttribute('role','menuitemradio'); b.setAttribute('aria-checked',active?'true':'false');
    b.tabIndex=active?0:-1;
    b.onclick=()=>{ closeDiscoverySourceMenu();
      if (value==='manage'){ buildToolTray(); openPaletteManager(); return; }
      if (value.indexOf('palette:')===0) chooseDiscoverySource('palette',value.slice('palette:'.length));
      else chooseDiscoverySource(value,null);
    }; menu.appendChild(b); };
  section('Plant lists');
  item('Recommended','recommended',selected==='recommended');
  item('All eligible','all',selected==='all');
  const favs=favoriteRefs(), fa=collectionAvailability(favs);
  item(`Favorites · ${fa.available}/${fa.total}`,'favorites',selected==='favorites');
  const palettes=(plantCollectionsData().palettes||[]);
  if (palettes.length){ section('My palettes'); palettes.forEach(p=>{ const a=collectionAvailability(p.items||[]); item(`${p.name} · ${a.available}/${a.total}`,`palette:${p.id}`,selected===`palette:${p.id}`); }); }
  section('Palette actions'); item('Manage plant palettes…','manage');
  menu.onkeydown=e=>{
    const items=[...menu.querySelectorAll('[role="menuitemradio"]')], current=items.indexOf(document.activeElement);
    if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); dismissDiscoverySourceMenu(true); return; }
    if (e.key==='Tab'){
      e.preventDefault(); dismissDiscoverySourceMenu();
      const next=e.shiftKey?document.querySelector('.discovery-source'):document.querySelector('.discovery-filter-trigger');
      if (next) next.focus({preventScroll:true});
      return;
    }
    let next=null;
    if (e.key==='ArrowDown') next=(Math.max(current,0)+1)%items.length;
    else if (e.key==='ArrowUp') next=(current<=0?items.length:current)-1;
    else if (e.key==='Home') next=0;
    else if (e.key==='End') next=items.length-1;
    if (next!==null){ e.preventDefault(); items.forEach((entry,index)=>entry.tabIndex=index===next?0:-1); items[next].focus(); }
  };
  wrap.onfocusout=()=>setTimeout(()=>{ if (sourceMenuOpen&&!wrap.contains(document.activeElement)) dismissDiscoverySourceMenu(); },0);
  wrap.appendChild(menu);
  setTimeout(()=>{ if (!sourceMenuOpen) return; const close=e=>{ if (!wrap.contains(e.target)) dismissDiscoverySourceMenu(); };
    sourceMenuCloseListener=close; document.addEventListener('click',close); },0);
  return wrap;
}
function discoveryFilterSummary(d){
  const colors=d.colorFamilies.map(id=>(DISCOVERY_COLOR_FAMILIES.find(x=>x[0]===id)||[])[1]||id);
  const labels=[...discoveryCriteriaLabels(),...colors,...d.bloomSeasons];
  if (!labels.length) return null;
  const summary=document.createElement('button'); summary.type='button'; summary.className='discovery-filter-summary';
  const shown=labels.slice(0,2).join(' · '), extra=labels.length>2?` +${labels.length-2}`:'';
  summary.textContent=`Filters: ${shown}${extra}`; summary.title=`Active filters: ${labels.join(', ')}. Change filters.`;
  summary.onclick=()=>openDiscoveryFilters(summary); return summary;
}
function catalogMinimizeButton(){
  const b=document.createElement('button'); b.type='button'; b.className='catalog-minimize';
  b.title='Minimize the catalog'; b.setAttribute('aria-label','Minimize the catalog and show more of the plan');
  b.setAttribute('aria-expanded','true'); b.setAttribute('aria-controls','sheetCatalog'); setUiIcon(b,'chevron-down');
  b.onclick=()=>{ game.catMenuOpen=false; closeDiscoverySourceMenu(); buildToolTray(); setSheetState('collapsed'); };
  return b;
}
function discoveryResultCountText(refs){
  const groups=groupDiscoveryRefs(refs), varieties=groups.reduce((n,group)=>n+group.cultivarRefs.length,0);
  return `${groups.length} plant${groups.length===1?'':'s'}${varieties?` \u00b7 ${varieties} variet${varieties===1?'y':'ies'}`:''}`;
}
function discoverySearchSelection(d,query){
  const q=String(query||'');
  const searching=!!q.trim();
  const prior=d.query&&d.query.trim() ? (d.category||d.returnCategory) : d.category;
  const fallback=prior||d.returnCategory||(discoveryCollectionView(d)?null:game.trayCat);
  return {query:q,category:searching?null:fallback,returnCategory:searching?fallback:null,limit:36};
}
function categoryDragScrollLeft(startScroll,startX,currentX){
  return startScroll+startX-currentX;
}
function enableCatalogDragScroll(strip,groupId){
  let drag=null, suppressClick=false;
  strip.scrollLeft=catalogCategoryScroll[groupId]||0;
  strip.addEventListener('scroll',()=>{ catalogCategoryScroll[groupId]=strip.scrollLeft; },{passive:true});
  strip.addEventListener('pointerdown',e=>{
    if (e.pointerType==='touch'||e.button!==0||strip.scrollWidth<=strip.clientWidth) return;
    drag={id:e.pointerId,startX:e.clientX,startScroll:strip.scrollLeft,moved:false,captured:false};
  });
  strip.addEventListener('pointermove',e=>{
    if (!drag||e.pointerId!==drag.id) return;
    if (!drag.moved&&Math.abs(e.clientX-drag.startX)>8){
      drag.moved=true;
      if (strip.setPointerCapture){ strip.setPointerCapture(e.pointerId); drag.captured=true; }
      strip.classList.add('dragging');
    }
    if (!drag.moved) return;
    strip.scrollLeft=categoryDragScrollLeft(drag.startScroll,drag.startX,e.clientX);
    e.preventDefault();
  });
  const finish=(e,cancelled=false)=>{
    if (!drag||e.pointerId!==drag.id) return;
    const moved=drag.moved, captured=drag.captured, id=drag.id;
    drag=null; strip.classList.remove('dragging');
    if (captured&&strip.hasPointerCapture&&strip.hasPointerCapture(id)) strip.releasePointerCapture(id);
    if (moved&&!cancelled){
      suppressClick=true;
      setTimeout(()=>{ suppressClick=false; },0);
    }
  };
  strip.addEventListener('pointerup',e=>finish(e));
  strip.addEventListener('pointercancel',e=>finish(e,true));
  strip.addEventListener('lostpointercapture',e=>finish(e,true));
  strip.addEventListener('click',e=>{
    if (!suppressClick) return;
    e.preventDefault(); e.stopImmediatePropagation(); suppressClick=false;
  },true);
}
function renderDiscoveryControls(tabs,modeControl){
  const d=activeDiscovery(), bar=document.createElement('div'); bar.className='discovery-controls';
  if (modeControl) bar.appendChild(modeControl());
  const find=document.createElement('input'); find.id='trayFind'; find.type='search'; find.autocomplete='off';
  find.placeholder='Find a plant'; find.value=d.query; find.setAttribute('aria-label','Find a plant');
  find.oninput=()=>{ discoveryOpenSpecies=null; setDiscovery(discoverySearchSelection(d,find.value)); clearTimeout(discoverySearchTimer);
    discoverySearchTimer=setTimeout(()=>{ buildToolTray(); const next=document.getElementById('trayFind');
      if (next){ next.focus(); try{ next.setSelectionRange(next.value.length,next.value.length); }catch(_){} } },120); };
  find.onkeydown=e=>{ if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); discoveryOpenSpecies=null; setDiscovery(discoverySearchSelection(d,'')); buildToolTray(); } };
  bar.appendChild(find);
  bar.appendChild(discoverySourceMenu(d));
  const filterRow=document.createElement('div'); filterRow.className='discovery-filter-row';
  const filters=document.createElement('button'); filters.type='button'; filters.className='discovery-filter-trigger';
  const n=discoveryFilterCount(); filters.textContent=n?`Filters · ${n}`:'Filters'; filters.setAttribute('aria-expanded','false');
  filters.onclick=()=>openDiscoveryFilters(filters); filterRow.appendChild(filters);
  const count=document.createElement('span'); count.className='discovery-result-count'; count.setAttribute('role','status');
  count.textContent=discoveryResultCountText(discoveryRefs()); filterRow.appendChild(count); bar.appendChild(filterRow);
  tabs.appendChild(bar);
}
function renderLandscapeControls(tabs,modeControl){
  const bar=document.createElement('div'); bar.className='landscape-controls';
  if (modeControl) bar.appendChild(modeControl());
  const find=document.createElement('input'); find.id='landscapeFind'; find.className='catalog-search';
  find.type='search'; find.autocomplete='off'; find.placeholder='Find landscape tools';
  find.value=game.traySearch||''; find.setAttribute('aria-label','Find landscape tools');
  find.oninput=()=>{
    game.traySearch=find.value; game.searchOpen=!!find.value.trim(); clearTimeout(landscapeSearchTimer);
    landscapeSearchTimer=setTimeout(()=>{
      buildToolTray();
      const next=document.getElementById('landscapeFind');
      if (next){ next.focus(); try{ next.setSelectionRange(next.value.length,next.value.length); }catch(_){} }
    },120);
  };
  find.onkeydown=e=>{ if (e.key==='Escape'&&game.traySearch){
    e.preventDefault(); e.stopPropagation(); game.traySearch=''; game.searchOpen=false; buildToolTray();
  } };
  bar.appendChild(find); tabs.appendChild(bar);
}
function renderDiscoveryTray(tray){
  const d=activeDiscovery(), refs=discoveryRefs(), groups=groupDiscoveryRefs(refs), sourceRefs=discoverySourceRefs(d);
  tray.classList.add('discovery-results');
  const summary=document.createElement('div'); summary.className='discovery-summary';
  if (d.source==='favorites'||d.source==='palette'){
    const a=collectionAvailability(sourceRefs); summary.textContent=`${discoveryResultCountText(refs)} shown · ${a.available} eligible / ${a.total} saved`;
  } else summary.textContent=`${discoverySourceLabel(d)} · ${discoveryResultCountText(refs)}`;
  tray.appendChild(summary);
  if (!refs.length){
    discoveryOpenSpecies=null;
    const empty=document.createElement('div'); empty.className='discovery-empty';
    empty.textContent='Nothing matches this view.';
    const reset=document.createElement('button'); reset.type='button'; reset.className='btn'; reset.textContent='Clear filters';
    reset.onclick=()=>{ setDiscovery({source:'all',collectionId:null,category:null,query:'',colorFamilies:[],bloomSeasons:[],limit:36},true); buildToolTray(); };
    empty.appendChild(reset); tray.appendChild(empty); return;
  }
  const openGroup=discoveryOpenSpecies&&groups.find(group=>group.s===discoveryOpenSpecies);
  if (openGroup){
    tray.classList.add('cultivar-drill');
    const base=PLANTS[openGroup.s], head=document.createElement('div'); head.className='cultivar-drill-head'; head.id=`plant-varieties-${openGroup.s}`;
    const back=document.createElement('button'); back.type='button'; back.className='cultivar-drill-back'; setUiIcon(back,'chevron-left');
    const backText=document.createElement('span'); backText.textContent='Back to plants'; back.appendChild(backText);
    back.onclick=()=>{ const species=discoveryOpenSpecies; discoveryOpenSpecies=null; buildToolTray();
      setTimeout(()=>{ const next=document.getElementById(`plant-family-${species}`), nextTray=document.getElementById('toolTray');
        if (nextTray) nextTray.scrollTop=discoveryReturnScroll;
        const focus=next&&next.querySelector('.plant-family-main'); if (focus) focus.focus({preventScroll:true}); },0); };
    const title=document.createElement('div'); title.className='cultivar-drill-title';
    const strong=document.createElement('strong'); strong.textContent=base.name;
    const small=document.createElement('small'); small.textContent=`${openGroup.refs.length} matching choice${openGroup.refs.length===1?'':'s'} · ${base.latin||''}`;
    title.append(strong,small); head.append(back,title); tray.appendChild(head);
    const variants=document.createElement('div'); variants.className='plant-variant-grid';
    openGroup.refs.forEach(ref=>variants.appendChild(discoveryResultCard(ref,d,{variant:true}))); tray.appendChild(variants);
    return;
  }
  discoveryOpenSpecies=null;
  const grid=document.createElement('div'); grid.className='plant-result-grid';
  groups.slice(0,d.limit).forEach(group=>grid.appendChild(discoveryFamilyCard(group,d))); tray.appendChild(grid);
  if (groups.length>d.limit){ const more=document.createElement('button'); more.type='button'; more.className='discovery-load-more';
    more.textContent=`Load more plants (${groups.length-d.limit} left)`; more.onclick=()=>{ setDiscovery({limit:d.limit+36}); buildToolTray(); };
    tray.appendChild(more); }
}
function openDiscoveryFilters(opener){
  discoveryFilterDraft=normalizeDiscovery(activeDiscovery());
  discoveryCriteriaDraft=activeFilters();
  renderDiscoveryFilterScreen();
  const screen=openOverlay('discoveryFilterScreen','#discoveryNative'); if (screen) screen._returnFocus=opener||screen._returnFocus;
}
function readDiscoveryCriteria(){
  const current=discoveryCriteriaDraft||activeFilters();
  return normalizeFilters({
    // Zone is selected when a garden begins. It remains an eligibility gate,
    // but is intentionally not editable from the in-garden discovery lens.
    zone:current.zone,
    nativesOnly:$('discoveryNative').checked,
    deer:$('discoveryDeer').checked,
    rabbit:$('discoveryRabbit').checked,
    squirrel:$('discoverySquirrel').checked
  });
}
function renderDiscoveryCriteria(){
  const f=discoveryCriteriaDraft||activeFilters();
  $('discoveryNative').checked=!!f.nativesOnly;
  $('discoveryDeer').checked=!!f.deer;
  $('discoveryRabbit').checked=!!f.rabbit;
  $('discoverySquirrel').checked=!!f.squirrel;
  [$('discoveryNative'),$('discoveryDeer'),$('discoveryRabbit'),$('discoverySquirrel')].forEach(el=>el.onchange=()=>{
    discoveryCriteriaDraft=readDiscoveryCriteria(); renderDiscoveryFilterScreen();
  });
}
function renderDiscoveryFilterScreen(){
  const d=discoveryFilterDraft||normalizeDiscovery(activeDiscovery()), colors=document.getElementById('discoveryColorChips'), seasons=document.getElementById('discoverySeasonChips');
  if (!colors||!seasons) return; colors.innerHTML=''; seasons.innerHTML='';
  renderDiscoveryCriteria();
  DISCOVERY_COLOR_FAMILIES.forEach(([id,label,color])=>{ const b=document.createElement('button'); b.type='button'; b.className='chip discovery-color-chip'+(d.colorFamilies.includes(id)?' sel':'');
    b.setAttribute('aria-pressed',d.colorFamilies.includes(id)?'true':'false'); const dot=document.createElement('i'); dot.className='chip-swatch'; dot.style.background=color;
    b.append(dot,document.createTextNode(label)); b.onclick=()=>{ const next=d.colorFamilies.includes(id)?d.colorFamilies.filter(x=>x!==id):[...d.colorFamilies,id]; discoveryFilterDraft=normalizeDiscovery(Object.assign({},d,{colorFamilies:next})); renderDiscoveryFilterScreen(); }; colors.appendChild(b); });
  DISCOVERY_SEASONS.forEach(([id])=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'+(d.bloomSeasons.includes(id)?' sel':''); b.textContent=id;
    b.setAttribute('aria-pressed',d.bloomSeasons.includes(id)?'true':'false'); b.onclick=()=>{ const next=d.bloomSeasons.includes(id)?d.bloomSeasons.filter(x=>x!==id):[...d.bloomSeasons,id]; discoveryFilterDraft=normalizeDiscovery(Object.assign({},d,{bloomSeasons:next})); renderDiscoveryFilterScreen(); }; seasons.appendChild(b); });
  const savedDiscovery=game.discovery, savedCriteria=game.filters;
  game.discovery=normalizeDiscovery(d); game.filters=normalizeFilters(discoveryCriteriaDraft||savedCriteria);
  const refs=discoveryRefs(), countText=discoveryResultCountText(refs); game.discovery=savedDiscovery; game.filters=savedCriteria;
  document.getElementById('discoveryFilterCount').textContent=`${countText} match these filters.`;
}
function applyDiscoveryFilters(){
  const n=applyGardenCriteria(discoveryCriteriaDraft||activeFilters(),{refresh:false,announce:false});
  discoveryOpenSpecies=null;
  setDiscovery(Object.assign({},discoveryFilterDraft||{}, {limit:36}),true); discoveryFilterDraft=null; discoveryCriteriaDraft=null;
  closeOverlay('discoveryFilterScreen'); buildToolTray();
  toast(`${n} eligible plant${n===1?'':'s'}; flower filters updated.`);
}
function clearDiscoveryFilters(){ discoveryFilterDraft=normalizeDiscovery(Object.assign({},activeDiscovery(),{colorFamilies:[],bloomSeasons:[]})); renderDiscoveryFilterScreen(); }
function openPaletteManager(ref){
  palettePendingRef=ref||null; paletteRenameId=null; renderPaletteManager();
  openOverlay('paletteScreen','#paletteName');
}
function discoverySourceSelection(source,collectionId,current=activeDiscovery()){
  const collection=source==='favorites'||source==='palette';
  const searching=!!(current.query||'').trim(), fallback=current.category||current.returnCategory||game.trayCat;
  return {source,collectionId:source==='palette'?collectionId:null,
    category:collection||searching?null:fallback,returnCategory:collection?null:(searching?fallback:null),limit:36};
}
function chooseDiscoverySource(source,collectionId){
  // A saved collection is a complete plant list. It opens to All rather than
  // inheriting a hidden category from the prior catalog view.
  discoveryOpenSpecies=null; game.catMenuOpen=false;
  setDiscovery(discoverySourceSelection(source,collectionId),true);
  palettePendingRef=null; paletteRenameId=null; closeOverlay('paletteScreen'); buildToolTray();
}
function savedRefLabel(ref){
  const base=ref&&PLANTS[ref.s];
  if (!base) return `Retired species: ${ref&&ref.s||'unknown'}`;
  return ref.v ? `${base.name} (${ref.v})` : base.name;
}
function savedRefAvailabilityReason(ref){
  const P=refDef(ref), f=activeFilters();
  if (!P) return 'Retired plant';
  if (!challengeAllows(ref.s)) return 'Unavailable in this challenge';
  if (f.zone && (P.zones[0]>f.zone || P.zones[1]<f.zone)) return `Outside Zone ${f.zone}`;
  if (f.nativesOnly && !P.native) return 'Excluded by natives-only criteria';
  const roles=plantRoles(ref.s);
  if (!isTreeDef(P) && f.deer && !roles.includes('deerOk')) return 'Not deer resistant';
  if (!isTreeDef(P) && f.rabbit && !roles.includes('rabbitOk')) return 'Not rabbit resistant';
  if (f.squirrel && P.type==='bulb' && !roles.includes('squirrelOk')) return 'Not squirrel resistant';
  return 'Not eligible for this garden';
}
function unavailableSavedRefs(refs){ return (refs||[]).filter(ref=>!plantRefFits(ref)); }
function appendUnavailableRefs(host,label,refs,onRemove){
  if (!refs.length) return;
  const section=document.createElement('div'); section.className='palette-unavailable';
  const head=document.createElement('p'); head.textContent=label; section.appendChild(head);
  refs.forEach(ref=>{ const row=document.createElement('div'); row.className='palette-unavailable-row';
    const info=document.createElement('span'); info.className='palette-unavailable-info';
    const name=document.createElement('span'); name.textContent=savedRefLabel(ref);
    const reason=document.createElement('small'); reason.textContent=savedRefAvailabilityReason(ref); info.append(name,reason);
    const remove=document.createElement('button'); remove.type='button'; remove.textContent='Remove';
    remove.onclick=()=>{ onRemove(ref); renderPaletteManager(); buildToolTray(); };
    row.append(info,remove); section.appendChild(row); });
  host.appendChild(section);
}
function renderPaletteManager(){
  const list=document.getElementById('paletteList'), title=$('paletteTitle'), subtitle=$('paletteSubtitle'), createLabel=document.querySelector('.palette-create>label');
  if (!list) return;
  list.innerHTML=''; const d=activeDiscovery(), assigning=!!palettePendingRef, data=plantCollectionsData();
  const pending=assigning?refDef(palettePendingRef):null;
  if (title) title.textContent=assigning?'Add to a palette':'Manage plant palettes';
  if (subtitle) subtitle.textContent=assigning
    ? `${pending?pending.name:'This plant'} can be added to any named palette on this device.`
    : 'Your palettes appear in the plant-list menu and work in every garden.';
  if (createLabel) createLabel.textContent=assigning?'Create a new palette and add this plant':'New palette';
  if (assigning){
    (data.palettes||[]).forEach(p=>{ const row=document.createElement('div'); row.className='palette-manager-row';
      const info=document.createElement('div'); info.className='palette-assignment-name';
      const strong=document.createElement('b'); strong.textContent=p.name; const small=document.createElement('small'); small.textContent=`${p.items.length} saved`;
      info.append(strong,small); row.appendChild(info);
      const included=(p.items||[]).some(item=>plantRefId(item)===plantRefId(palettePendingRef));
      const action=document.createElement('button'); action.type='button'; action.className='palette-row-action '+(included?'remove':'add'); action.textContent=included?'Remove':'Add';
      action.onclick=()=>{ if (included) removePaletteRef(p.id,palettePendingRef); else addPaletteRef(p.id,palettePendingRef); renderPaletteManager(); buildToolTray(); };
      row.appendChild(action); list.appendChild(row);
    });
    if (!data.palettes.length){ const empty=document.createElement('p'); empty.className='note'; empty.textContent='Create your first named palette below; this plant will be added immediately.'; list.appendChild(empty); }
    return;
  }
  appendUnavailableRefs(list,'Favorites: unavailable saved plants',unavailableSavedRefs(data.favorites),ref=>{ if (isFavorite(ref)) toggleFavorite(ref); });
  (data.palettes||[]).forEach(p=>{ const a=collectionAvailability(p.items||[]), row=document.createElement('div'); row.className='palette-manager-row';
    const info=document.createElement('div'); info.className='palette-assignment-name';
    const strong=document.createElement('b'); strong.textContent=p.name; const small=document.createElement('small'); small.textContent=`${a.available} eligible / ${a.total} saved`; info.append(strong,small); row.appendChild(info);
    const rename=document.createElement('button'); rename.type='button'; rename.className='palette-row-action'; rename.textContent='Rename'; rename.onclick=()=>{ paletteRenameId=p.id; renderPaletteManager(); }; row.appendChild(rename);
    const del=document.createElement('button'); del.type='button'; del.className='palette-row-action danger'; del.textContent='Delete'; del.onclick=()=>{ if (!confirm(`Delete the "${p.name}" palette? This cannot be undone.`)) return; deletePlantPalette(p.id); if (d.source==='palette'&&d.collectionId===p.id) setDiscovery({source:'recommended',collectionId:null},true); paletteRenameId=null; renderPaletteManager(); buildToolTray(); }; row.appendChild(del); list.appendChild(row);
    if (paletteRenameId===p.id){ const edit=document.createElement('div'); edit.className='palette-rename';
      const input=document.createElement('input'); input.type='text'; input.maxLength=30; input.value=p.name; input.setAttribute('aria-label',`Rename ${p.name}`);
      const save=document.createElement('button'); save.type='button'; save.textContent='Save'; save.onclick=()=>{ if ((input.value||'').trim()) renamePlantPalette(p.id,input.value); paletteRenameId=null; renderPaletteManager(); buildToolTray(); };
      const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel'; cancel.onclick=()=>{ paletteRenameId=null; renderPaletteManager(); };
      edit.append(input,save,cancel); list.appendChild(edit); }
    appendUnavailableRefs(list,`${p.name}: unavailable saved plants`,unavailableSavedRefs(p.items),ref=>removePaletteRef(p.id,ref));
  });
  if (!data.palettes.length){ const empty=document.createElement('p'); empty.className='note'; empty.textContent='No named palettes yet. Create one below, then add plants from the catalog.'; list.appendChild(empty); }
}
function createPaletteFromInput(){
  const input=document.getElementById('paletteName'), name=(input&&input.value||'').trim(); if (!name) return;
  const added=palettePendingRef, p=createPlantPalette(name,added?[added]:[]); if (input) input.value='';
  if (!p) return;
  if (added){ palettePendingRef=null; closeOverlay('paletteScreen'); buildToolTray(); toast(`Created ${p.name} and added ${plantRefDisplayName(added)}.`); }
  else { renderPaletteManager(); buildToolTray(); toast(`Created ${p.name}.`); }
}
let replacePlantContext=null;
function selectionReplaceSources(){
  const map=new Map();
  for (const c of (game.selItems||[])) for (const p of [c.plant,c.bulb]){
    if (!p||p.removed) continue;
    const id=`${p.s}|${p.v||''}`, old=map.get(id)||{p:{s:p.s,v:p.v||null},count:0,key:`${c.x},${c.y}`};
    old.count++; map.set(id,old);
  }
  return [...map.values()].sort((a,b)=>b.count-a.count||plantDef(a.p.s,a.p.v).name.localeCompare(plantDef(b.p.s,b.p.v).name));
}
function replaceOptionList(source,q){
  const from=plantDef(source.s,source.v), group=replacementGroup(from), out=[];
  trayKeys().forEach(k=>{
    const P=PLANTS[k], add=v=>{
      const D=plantDef(k,v), hay=`${P.name} ${P.latin} ${D.name||''} ${D.note||''}`.toLowerCase();
      if (replacementGroup(D)===group && (!q||hay.includes(q))) out.push({s:k,v:v||null,D});
    };
    add(null); Object.keys(P.cv||{}).forEach(add);
  });
  return out.filter(o=>!(o.s===source.s&&(o.v||null)===(source.v||null)))
    .sort((a,b)=>a.D.name.localeCompare(b.D.name));
}
function replaceScopeCount(scope){
  if (!replacePlantContext||!replacePlantContext.source) return 0;
  return replacementScopeTargets(Object.assign({},replacePlantContext,{scope})).length;
}
function startReplacePlant(source,key,scope){
  replacePlantContext={source:{s:source.s,v:source.v||null},key,scope:scope||'one',target:null,choosingSource:false};
  const search=document.getElementById('replacePlantSearch'); if (search) search.value='';
  renderReplacePlantUi();
}
function openReplacePlant(p,x,y,scope){
  if (!p||!PLANTS[p.s]) return;
  startReplacePlant(p,`${x},${y}`,scope||'one');
  openOverlay('replacePlantScreen','#replacePlantSearch');
}
function openSelectionReplace(){
  if (!game.sel){ toast('Select an area first.'); return; }
  const sources=selectionReplaceSources();
  if (!sources.length){ toast('There are no plants in this selection.'); return; }
  if (sources.length===1){
    startReplacePlant(sources[0].p,sources[0].key,'selection');
  } else {
    replacePlantContext={choosingSource:true,sources,source:null,target:null,scope:'selection'};
    const search=document.getElementById('replacePlantSearch'); if (search) search.value='';
    renderReplacePlantUi();
  }
  openOverlay('replacePlantScreen','#replacePlantSearch');
}
function renderReplacePlantUi(){
  const ctx=replacePlantContext, title=document.getElementById('replacePlantTitle'), meta=document.getElementById('replacePlantMeta');
  const scopeEl=document.getElementById('replacePlantScope'), results=document.getElementById('replacePlantResults');
  const search=document.getElementById('replacePlantSearch'), count=document.getElementById('replacePlantCount');
  const summary=document.getElementById('replacePlantSummary'), apply=document.getElementById('btnReplacePlantApply');
  if (!ctx||!title||!results) return;
  results.innerHTML=''; scopeEl.innerHTML=''; apply.disabled=true;
  if (ctx.choosingSource){
    title.textContent='Choose a plant to replace'; meta.textContent='This selection contains several plants. Choose the exact species or cultivar first.';
    scopeEl.closest('.field').classList.add('hidden');
    search.placeholder='Filter selected plants';
    const q=(search.value||'').toLowerCase().trim();
    const shown=ctx.sources.filter(({p})=>{ const D=plantDef(p.s,p.v); return `${D.name} ${PLANTS[p.s].latin}`.toLowerCase().includes(q); });
    shown.forEach(({p,count:n,key})=>{
      const D=plantDef(p.s,p.v), b=document.createElement('button'); b.type='button'; b.className='replace-plant-result source';
      b.innerHTML=`<span><strong>${D.name}</strong><small>${PLANTS[p.s].latin}</small></span><em>${n}</em>`;
      b.onclick=()=>startReplacePlant(p,key,'selection'); results.appendChild(b);
    });
    count.textContent=`${shown.length} of ${ctx.sources.length} plant types in selection`;
    summary.textContent='Choose the source plant before choosing its replacement.';
    return;
  }
  const from=plantDef(ctx.source.s,ctx.source.v), one=replaceScopeCount('one'), sel=replaceScopeCount('selection'), all=replaceScopeCount('garden');
  title.textContent=`Replace ${from.name}`; meta.textContent='Positions and planted age stay the same. Only the exact selected species and cultivar will change.';
  scopeEl.closest('.field').classList.remove('hidden');
  [['one','This plant',one],['selection','Selection',sel],['garden','Garden',all]].forEach(([id,label,n])=>{
    const b=document.createElement('button'); b.type='button'; b.className='seg-opt'+(ctx.scope===id?' on':'');
    b.textContent=`${label} (${n})`; b.disabled=!n; b.onclick=()=>{ ctx.scope=id; ctx.target=null; renderReplacePlantUi(); };
    scopeEl.appendChild(b);
  });
  search.placeholder='Search compatible plants';
  const q=(search.value||'').toLowerCase().trim(), opts=replaceOptionList(ctx.source,q);
  count.textContent=`${opts.length} compatible plant${opts.length===1?'':'s'} found`;
  opts.slice(0,80).forEach(o=>{
    const b=document.createElement('button'); b.type='button'; b.className='replace-plant-result'+(ctx.target&&ctx.target.s===o.s&&(ctx.target.v||null)===(o.v||null)?' sel':'');
    b.setAttribute('role','option'); b.setAttribute('aria-selected',b.classList.contains('sel')?'true':'false');
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const sc=Math.min(.62,36/(plantArtTop(o.D)||40)), tc=c.getContext('2d'); tc.scale(sc,sc);
    drawPlant(tc,24/sc,42/sc,o.s,1,plantIconSeason(o.D),tileSeed(3,7),0,o.v||undefined,1);
    const copy=document.createElement('span'), cat=document.createElement('small');
    copy.innerHTML=`<strong>${o.D.name}</strong><small>${PLANTS[o.s].latin}</small>`;
    cat.textContent=trayCatLabel(plantCategoryFor(o.s)); b.append(c,copy,cat);
    b.onclick=()=>{ ctx.target={s:o.s,v:o.v}; renderReplacePlantUi(); };
    results.appendChild(b);
  });
  if (!opts.length){ const empty=document.createElement('p'); empty.className='tray-empty'; empty.textContent='No compatible plants match this search.'; results.appendChild(empty); }
  if (!ctx.target){ summary.textContent='Choose a replacement plant.'; return; }
  const target=plantDef(ctx.target.s,ctx.target.v), check=replacementPreflight(ctx,ctx.target), total=check.valid.length+check.blocked.length;
  summary.textContent=check.blocked.length
    ? `${check.valid.length} of ${total} can change to ${target.name}; ${check.blocked.length} cannot fit.`
    : `${check.valid.length} ${from.name} -> ${target.name}`;
  apply.textContent=`Replace ${check.valid.length} plant${check.valid.length===1?'':'s'}`;
  apply.disabled=!check.valid.length;
}
function applyPlantReplacement(){
  const ctx=replacePlantContext; if (!ctx||!ctx.target) return;
  const from=plantDef(ctx.source.s,ctx.source.v), to=plantDef(ctx.target.s,ctx.target.v), result=replacePlantInstances(ctx,ctx.target);
  if (!result.changed){ toast(result.reason||'Those plants cannot be replaced there.','warn'); return; }
  closeOverlay('replacePlantScreen'); replacePlantContext=null;
  toast(`Replaced ${result.changed} ${from.name}${result.blocked.length?`; ${result.blocked.length} blocked`:''} with ${to.name}.`);
  renderSelectionActions();
}
function discoveryCollectionView(d=activeDiscovery()){
  return d.source==='favorites'||d.source==='palette';
}
function discoveryCollectionCategoryData(d=activeDiscovery()){
  const refs=discoveryRefsFor(Object.assign({},d,{category:null})), counts={};
  refs.forEach(ref=>{ const id=plantCategoryFor(ref.s); counts[id]=(counts[id]||0)+1; });
  return {refs,counts};
}
function discoveryAllCategoryLabel(d=activeDiscovery()){
  return d.source==='favorites'?'All favorites':`All in ${discoverySourceLabel(d)}`;
}
function updateCatalogHeader(isPlantGroup){
  const title=document.getElementById('catalogTitle'), meta=document.getElementById('catalogMeta');
  if (title) title.textContent=isPlantGroup?'Plant library':'Landscape library';
  if (!meta) return;
  if (!isPlantGroup){ meta.textContent='Ground, grade, hardscape, lighting, and site tools'; return; }
  const d=activeDiscovery(), refs=discoveryRefs();
  meta.textContent=`${discoverySourceLabel(d)} \u00b7 ${discoveryResultCountText(refs)}`;
}
function plantTrayCategoryId(d=activeDiscovery(),currentId=game.trayCat){
  return trayGroupOf(currentId)==='plants'&&d.category ? d.category : currentId;
}
function buildToolTray(){
  saveTrayScroll();
  const tabs=document.getElementById('trayTabs'); tabs.innerHTML='';
  const syncedCategory=plantTrayCategoryId(); if (syncedCategory!==game.trayCat) game.trayCat=syncedCategory;
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat)||TRAY_CATS[0];
  const activeGroup=trayGroupOf(cat.id);
  const isPlantGroup=activeGroup==='plants';
  tabs.classList.toggle('has-discovery',isPlantGroup);
  lastCatByGroup[activeGroup]=game.trayCat;
  const selectCat=(id)=>{ saveTrayScroll(); game.toolMenu=null; game.drill=null; discoveryOpenSpecies=null; closeDiscoverySourceMenu();
    const currentDiscovery=activeDiscovery(), searchActive=!!currentDiscovery.query.trim();
    if (id===null){ setDiscovery({category:null,returnCategory:searchActive?currentDiscovery.returnCategory:null,limit:36}); game.catMenuOpen=false; buildToolTray(); return; }
    game.trayCat=id;
    const targetIsPlants=trayGroupOf(id)==='plants';
    setDiscovery({category:targetIsPlants?id:null,returnCategory:targetIsPlants&&searchActive?id:null,limit:36});
    game.searchOpen=false; game.traySearch='';
    game.catMenuOpen=false;
    rememberBrushMenu(id,null);
    if (game.tool==='pick' || targetIsPlants!==isPlantGroup) setTool('hand');
    else refreshCanvasTools();
    buildToolTray(); };
  const switchGroup=(groupId)=>{
    if (groupId===activeGroup) return;
    const group=TRAY_GROUPS.find(g=>g.id===groupId); if (!group) return;
    saveTrayScroll(); game.trayCat=lastCatByGroup[groupId]||group.cats[0]; game.drill=null; game.catMenuOpen=false; closeDiscoverySourceMenu();
    const d=activeDiscovery();
    setDiscovery({category:groupId==='plants'?(discoveryCollectionView(d)||d.query.trim()?null:game.trayCat):null,limit:36});
    // Changing catalog modes never paints. The last brush stays remembered for
    // the canvas Plant tool, but Landscape now clearly asks for its own tool.
    setTool('hand'); refreshCanvasTools(); buildToolTray();
  };
  const modeControl=()=>{ const seg=document.createElement('div'); seg.className='catalog-mode';
    TRAY_GROUPS.forEach(group=>{ const b=document.createElement('button'); b.type='button';
      b.className=activeGroup===group.id?'sel':''; b.textContent=group.label;
      b.setAttribute('aria-pressed',activeGroup===group.id?'true':'false'); b.onclick=()=>switchGroup(group.id); seg.appendChild(b); });
    return seg; };
  updateCatalogHeader(isPlantGroup);
  if (isPlantGroup) renderDiscoveryControls(tabs,modeControl);
  else renderLandscapeControls(tabs,modeControl);
  const discovery=isPlantGroup?activeDiscovery():null, collectionView=!!(discovery&&discoveryCollectionView(discovery));
  const collectionData=collectionView?discoveryCollectionCategoryData(discovery):null;
  const cur=document.createElement('button'); cur.type='button'; cur.className='cat-current';
  const lab=document.createElement('span');
  lab.textContent=collectionView&&!discovery.category?discoveryAllCategoryLabel(discovery)
    : isPlantGroup&&discovery&&!discovery.category?'All matching plants':cat.label;
  const arrow=document.createElement('i'); setUiIcon(arrow,game.catMenuOpen?'chevron-up':'chevron-down');
  cur.replaceChildren(lab,arrow); cur.setAttribute('aria-haspopup','menu'); cur.setAttribute('aria-expanded',game.catMenuOpen?'true':'false'); cur.setAttribute('aria-controls','catalogCategoryMenu');
  cur.onclick=()=>{ game.catMenuOpen=!game.catMenuOpen; buildToolTray(); };
  tabs.appendChild(cur);
  const categoryStrip=document.createElement('div'); categoryStrip.className='catalog-category-strip';
  categoryStrip.setAttribute('role','group');
  categoryStrip.setAttribute('aria-label',isPlantGroup?'Plant categories':'Landscape categories');
  if (isPlantGroup){
    const allRefs=discoveryRefsFor(Object.assign({},discovery,{category:null}));
    const all=document.createElement('button'); all.type='button'; all.className=discovery.category?'':'sel';
    all.dataset.categoryId='all';
    all.textContent=`All ${groupDiscoveryRefs(allRefs).length}`; all.setAttribute('aria-pressed',discovery.category?'false':'true');
    all.onclick=()=>selectCat(null); categoryStrip.appendChild(all);
    TRAY_CATS.filter(c=>TRAY_GROUPS[0].cats.includes(c.id)).forEach(c=>{
      const refs=discoveryRefsFor(Object.assign({},discovery,{category:c.id})); if (!refs.length) return;
      const b=document.createElement('button'); b.type='button'; const selected=discovery.category===c.id;
      b.dataset.categoryId=c.id;
      b.className=selected?'sel':''; b.textContent=`${c.label} ${groupDiscoveryRefs(refs).length}`;
      b.setAttribute('aria-pressed',selected?'true':'false'); b.onclick=()=>selectCat(c.id); categoryStrip.appendChild(b);
    });
  } else {
    TRAY_CATS.filter(c=>TRAY_GROUPS[1].cats.includes(c.id)).forEach(c=>{
      const b=document.createElement('button'); b.type='button'; const selected=game.trayCat===c.id;
      b.dataset.categoryId=c.id;
      b.className=selected?'sel':''; b.textContent=c.label; b.setAttribute('aria-pressed',selected?'true':'false');
      b.onclick=()=>selectCat(c.id); categoryStrip.appendChild(b);
    });
  }
  enableCatalogDragScroll(categoryStrip,activeGroup);
  tabs.appendChild(categoryStrip);
  requestAnimationFrame(()=>{
    const selected=categoryStrip.querySelector('.sel');
    if (selected&&selected.scrollIntoView) selected.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  if (isPlantGroup){ const summary=discoveryFilterSummary(activeDiscovery()); if (summary) tabs.appendChild(summary); }
  if (game.catMenuOpen){
    const pop=document.createElement('div'); pop.className='cat-pop'; pop.id='catalogCategoryMenu'; pop.setAttribute('role','menu');
    TRAY_GROUPS.forEach(group=>{ const section=document.createElement('div'); section.className='cat-pop-group';
      const head=document.createElement('p'); head.textContent=group.label; section.appendChild(head);
      const grid=document.createElement('div'); grid.className='cat-pop-grid';
      if (group.id==='plants'){
        const all=document.createElement('button'); all.type='button'; all.className=discovery.category?'':'sel';
        all.textContent=collectionView?`${discoveryAllCategoryLabel(discovery)} · ${collectionData.refs.length}`:'All matching plants';
        all.setAttribute('role','menuitemradio'); all.setAttribute('aria-checked',discovery.category?'false':'true'); all.onclick=()=>selectCat(null); grid.appendChild(all);
      }
      TRAY_CATS.filter(c=>group.cats.includes(c.id)).forEach(c=>{ if (collectionView&&group.id==='plants'&&!collectionData.counts[c.id]) return;
        const b=document.createElement('button'); b.type='button';
        const selected=isPlantGroup?(discovery&&discovery.category===c.id):game.trayCat===c.id;
        b.className=selected?'sel':''; b.textContent=c.label+(collectionView&&group.id==='plants'?` · ${collectionData.counts[c.id]||0}`:'');
        b.setAttribute('role','menuitemradio'); b.setAttribute('aria-checked',selected?'true':'false'); b.onclick=()=>selectCat(c.id); grid.appendChild(b); });
      section.appendChild(grid); pop.appendChild(section); });
    tabs.appendChild(pop);
  }
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  tray.classList.remove('discovery-results','cultivar-drill','landscape-results');
  if (isPlantGroup){
    if (PLANTS[game.tool] && !plantRefFits(plantRef(game.tool,game.toolVar))){ game.tool='hand'; game.toolVar=null; }
    renderDiscoveryTray(tray); renderCvRow(); finishToolTrayRender();
    return;
  }
  tray.classList.add('landscape-results');
  if (cat.types){
    let keys=trayKeys().filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
    // if the filter took the selected species away, fall back sensibly
    const all=trayKeys();
    if (PLANTS[game.tool] && !all.includes(game.tool)){ game.tool='hand'; game.toolVar=null; }
    if (!keys.length){
      const sp=document.createElement('span'); sp.className='tray-empty';
      sp.textContent='Nothing fits the plant filters here.';
      tray.appendChild(sp);
    }
    // drilled into a species' sub-species? show those (+ Back) instead of the grid.
    if (game.drill && !PLANTS[game.drill]) game.drill=null;
    if (game.drill){
      const D=PLANTS[game.drill];
      const members=D.group ? keys.filter(k=>PLANTS[k].group===D.group)
                            : (keys.includes(game.drill)?[game.drill]:[]);
      if (members.length){
        renderDrillIn(tray, game.drill, members);
        renderCvRow(); applyTraySearch(); finishToolTrayRender();
        return;
      }
      game.drill=null; // the drilled species fell outside this filter/category
    }
    const grouped={};
    const designType=activeDesignType();
    let sections;
    if (cat.sedgeSections){
      const wet=keys.filter(k=>PLANTS[k].moist==='moist');
      sections=[
        ['Sun & meadow',keys.filter(k=>PLANTS[k].sun==='full' && PLANTS[k].moist!=='moist'),
          'Sunny, average-to-dry meadow sedges'],
        ['Shade & woodland',keys.filter(k=>PLANTS[k].sun!=='full' && PLANTS[k].moist!=='moist'),
          'Part-shade sedges for woodland and path edges'],
        ['Wet & rain garden',wet,'Sedges for swales, pond margins, and reliably moist ground'],
      ];
    } else if (designType){
      const best=keys.filter(k=>plantStyleRecommended(k,designType));
      const other=keys.filter(k=>!plantStyleRecommended(k,designType));
      sections=[
        best.length ? ['Best fit',best,`Recommended for ${designTypeName(designType)}`] : null,
        other.length ? ['Other fits',other,`Still matches zone/native filters, but is less tied to ${designTypeName(designType)}`] : null,
      ].filter(Boolean);
    } else {
      sections=[[null,keys]];
    }
    const addPlantButton=(k)=>{
      const P=PLANTS[k];
      // species sharing a group collapse into one button; the chip row
      // (renderCvRow) picks the species inside it
      if (P.group){
        if (grouped[P.group]) return false;
        grouped[P.group]=true;
      }
      const activeGroup = P.group && keys.includes(game.tool) &&
        PLANTS[game.tool] && PLANTS[game.tool].group===P.group;
      const rep = activeGroup ? game.tool : k;
      const R=PLANTS[rep];
      const drillable=!!(P.group || P.cv);
      const b=document.createElement('button');
      b.className='tool'+((P.group ? activeGroup : game.tool===k)?' sel':'')+(drillable?' has-sub':'');
      b.dataset.k=k; if (P.group) b.dataset.group=P.group;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const sc=Math.min(0.62, 36/(plantArtTop(R)||40));   // tall plants shrink to fit
      const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
      const iconSeason=plantIconSeason(R);
      drawPlant(ctx2,24/sc,42/sc,rep,1,iconSeason,tileSeed(3,7),0,undefined,1);
      const sp=document.createElement('span');
      const label=P.group ? (R.groupLabel||P.group[0].toUpperCase()+P.group.slice(1))
                          : P.name.split(' ').slice(0,2).join(' ');
      sp.textContent=label;
      b.append(c,sp);
      b.onclick=()=>{
        if (drillable){ game.drill=k; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); }   // open its sub-species
        else setTool(k,null);
      };
      tray.appendChild(b);
      return true;
    };
    sections.forEach(([label,sectionKeys,title])=>{
      if (!sectionKeys.length) return;
      if (label){
        const sep=document.createElement('span');
        sep.className='tray-sep';
        sep.textContent=label;
        if (title) sep.title=title;
        tray.appendChild(sep);
      }
      sectionKeys.forEach(addPlantButton);
    });
    renderCvRow(); applyTraySearch(); finishToolTrayRender();
    return;
  }
  // Material/build categories are catalogs, not hidden mode switches: opening a
  // tab should not silently arm the first tool inside it.
  renderCvRow();
  if ((game.traySearch||'').trim()){
    renderLandscapeSearchTray(tray,game.traySearch); finishToolTrayRender(); return;
  }
  if (cat.tools.includes('path')||cat.tools.includes('bed')||cat.tools.includes('water')||cat.tools.some(isElevationTool)){
    const pathCol=pathColor(game.pathColor);
    const bedCol=bedStyle(game.bedStyle);
    const waterCol=waterStyle(game.waterStyle);
    const drawMat=(tc,opt)=>{
      const seed=opt.seed||1, rs=mulberry(seed);
      tc.fillStyle=opt.fill;
      tc.beginPath(); tc.moveTo(24,12); tc.lineTo(42,23); tc.lineTo(24,34); tc.lineTo(6,23);
      tc.closePath(); tc.fill();
      if (opt.deep){
        tc.fillStyle=opt.deep;
        tc.beginPath(); tc.moveTo(24,23); tc.lineTo(42,23); tc.lineTo(24,34); tc.lineTo(6,23);
        tc.closePath(); tc.fill();
      }
      tc.strokeStyle='rgba(239,230,211,.45)'; tc.lineWidth=1.2; tc.stroke();
      if (opt.texture==='water'){
        tc.strokeStyle='rgba(232,248,244,.78)'; tc.lineWidth=1;
        for (let r=0;r<2;r++){ tc.beginPath(); tc.ellipse(24,21+r*6,12-r*3,2.2,0,0,7); tc.stroke(); }
      } else if (opt.texture==='leaf'){
        const cols=['rgba(181,111,52,.75)','rgba(83,50,28,.72)','rgba(211,153,77,.55)'];
        for (let i=0;i<6;i++){ tc.fillStyle=cols[i%cols.length]; tc.beginPath();
          tc.ellipse(24+(rs()-0.5)*24,23+(rs()-0.5)*10,3.4,1.1,rs()*3,0,7); tc.fill(); }
      } else if (opt.texture==='mulch'){
        tc.strokeStyle='rgba(30,16,10,.55)'; tc.lineWidth=2;
        for (let i=0;i<6;i++){ const ox=24+(rs()-0.5)*24, oy=23+(rs()-0.5)*10;
          tc.beginPath(); tc.moveTo(ox-4,oy); tc.lineTo(ox+5,oy+(rs()-0.5)*3); tc.stroke(); }
      } else {
        tc.fillStyle=opt.texture==='rock'?'rgba(255,255,255,.20)':'rgba(0,0,0,.18)';
        const n=opt.texture==='rock'?5:6;
        for (let i=0;i<n;i++){ tc.beginPath();
          tc.ellipse(24+(rs()-0.5)*22,23+(rs()-0.5)*10,opt.texture==='rock'?2.8:2,opt.texture==='rock'?1.6:1.2,rs()*3,0,7); tc.fill(); }
      }
    };
    const drawElev=(tc,kind)=>{
      const high=kind==='raise', low=kind==='lower';
      tc.fillStyle=low?'#6f7f83':'#8ba263';
      tc.beginPath(); tc.moveTo(24,10+(low?9:0)); tc.lineTo(42,21+(low?9:0)); tc.lineTo(24,32+(low?9:0)); tc.lineTo(6,21+(low?9:0));
      tc.closePath(); tc.fill();
      if (high){
        tc.fillStyle='#5c6f46';
        tc.beginPath(); tc.moveTo(6,21); tc.lineTo(24,32); tc.lineTo(24,40); tc.lineTo(6,29); tc.closePath(); tc.fill();
        tc.fillStyle='#42563e';
        tc.beginPath(); tc.moveTo(42,21); tc.lineTo(24,32); tc.lineTo(24,40); tc.lineTo(42,29); tc.closePath(); tc.fill();
      }
      tc.strokeStyle='rgba(239,230,211,.55)'; tc.lineWidth=1.3; tc.stroke();
      tc.fillStyle='#efe6d3'; tc.font='700 18px IBM Plex Sans'; tc.textAlign='center';
      tc.fillText(kind==='level'?'0':(high?'+':'-'),24,26+(low?8:0));
    };
    const materialBtn=(k,label,sel,draw,fn,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(game.tool===k?' sel':''); b.dataset.k=k;
      if (sel!==undefined) b.className='tool'+(sel?' sel':'');
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=fn;
      tray.appendChild(b);
      return b;
    };
    [
      ['path','Path',tc=>drawMat(tc,{fill:pathCol.fill,texture:'gravel',seed:11}),`${pathCol.label} path: drag or act to lay paths.`],
      ['bed','Bed',tc=>drawMat(tc,{fill:bedCol.fill||'#54402f',texture:bedCol.texture,seed:23}),`${bedCol.label} bed: drag or act to prepare planting beds.`],
      ['water','Water',tc=>drawMat(tc,{fill:waterCol.fill,deep:waterCol.deep,texture:'water',seed:37}),`${waterCol.label}: drag to paint ponds, rivers, or lakes.`],
      ['raise','Raise',tc=>drawElev(tc,'raise'),'Raise ground one step. Drag to build a berm or terrace.'],
      ['lower','Lower',tc=>drawElev(tc,'lower'),'Lower ground one step. Drag to shape a swale or basin.'],
      ['level','Level',tc=>drawElev(tc,'level'),'Return ground to level grade.'],
    ].filter(([k])=>cat.tools.includes(k))
    .forEach(([k,label,draw,hint])=>{
      materialBtn(k,label,game.tool===k,draw,()=>{ setTool(k,null); buildToolTray(); },hint);
    });
    if (game.tool==='path' && cat.tools.includes('path')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Path color'; tray.appendChild(sep);
      PATH_COLORS.forEach((pc,i)=>materialBtn('path',pc.label.split(' ')[0],
        game.tool==='path'&&game.pathColor===pc.id,
        tc=>drawMat(tc,{fill:pc.fill,texture:'gravel',seed:100+i}),
        ()=>{ game.pathColor=pc.id; setTool('path',null); buildToolTray(); },
        pc.label).dataset.pathColor=pc.id);
    }
    if (game.tool==='bed' && cat.tools.includes('bed')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Bed type'; tray.appendChild(sep);
      BED_STYLES.forEach((bs,i)=>materialBtn('bed',bs.short||bs.label,
        game.tool==='bed'&&game.bedStyle===bs.id,
        tc=>drawMat(tc,{fill:bs.fill||'#54402f',texture:bs.texture,seed:150+i}),
        ()=>{ game.bedStyle=bs.id; setTool('bed',null); buildToolTray(); },
        bs.label).dataset.bedStyle=bs.id);
    }
    if (game.tool==='water' && cat.tools.includes('water')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Water'; tray.appendChild(sep);
      WATER_STYLES.forEach((ws,i)=>materialBtn('water',ws.label,
        game.tool==='water'&&game.waterStyle===ws.id,
        tc=>drawMat(tc,{fill:ws.fill,deep:ws.deep,texture:'water',seed:200+i}),
        ()=>{ game.waterStyle=ws.id; setTool('water',null); buildToolTray(); },
        ws.label).dataset.waterStyle=ws.id);
    }
    // edge look for beds/paths/water — organic curves vs crisp tile edges
    // (per-garden, defaulted from the questionnaire style). Rebuilds the ground
    // cache so the change shows immediately.
    if (game.tool==='path'||game.tool==='bed'||game.tool==='water'){
      const sep=document.createElement('span'); sep.className='tray-sep'; sep.textContent='Edge'; tray.appendChild(sep);
      [['organic','Organic'],['formal','Formal']].forEach(([id,label])=>{
        materialBtn('edge_'+id, label, game.edgeStyle===id,
          tc=>drawEdgeStyleIcon(tc,id),
          ()=>{ game.edgeStyle=id; if (typeof groundKey!=='undefined') groundKey='';
            buildToolTray(); toast(id==='organic'?'Organic edges — beds and paths curve.':'Formal edges — crisp tile edges.'); },
          id==='organic'?'Curved, naturalistic bed and path edges':'Crisp, straight tile edges');
      });
    }
  }
  if (cat.tools.includes('fence')){
    const fd=fenceDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniFence=(tc,d)=>{
      const st=fenceStyle(d.style), h=d.height>=6?25:18, y=34;
      tc.lineCap='round'; tc.lineJoin='round';
      if (d.style==='black'){
        tc.strokeStyle='rgba(239,230,211,.34)'; tc.lineWidth=5;
        [12,24,36].forEach(x=>{ tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x,y-h); tc.stroke(); });
        [h*.35,h*.72].forEach(off=>{ tc.beginPath(); tc.moveTo(10,y-off); tc.lineTo(38,y-off); tc.stroke(); });
      }
      tc.strokeStyle=st.post; tc.lineWidth=d.style==='brick'?5:3;
      [12,24,36].forEach(x=>{ tc.beginPath(); tc.moveTo(x,y); tc.lineTo(x,y-h); tc.stroke(); });
      tc.strokeStyle=st.rail; tc.lineWidth=d.style==='brick'?7:2;
      [h*.35,h*.72].forEach(off=>{ tc.beginPath(); tc.moveTo(10,y-off); tc.lineTo(38,y-off); tc.stroke(); });
      if (d.style==='chainlink'){
        tc.strokeStyle=st.fill; tc.lineWidth=0.8;
        for (let x=14;x<=34;x+=6){ tc.beginPath(); tc.moveTo(x-4,y-h*.22); tc.lineTo(x+4,y-h*.72); tc.stroke(); }
      }
      if (d.gate){ tc.strokeStyle=st.fill; tc.lineWidth=1.5;
        tc.beginPath(); tc.moveTo(15,y-h*.25); tc.lineTo(33,y-h*.72);
        tc.moveTo(15,y-h*.72); tc.lineTo(33,y-h*.25); tc.stroke();
        const gateCol=d.style==='black'?'#efe6d3':(d.style==='vinyl'?'#6f6458':shade(st.fill,30));
        tc.strokeStyle=gateCol; tc.lineWidth=2;
        tc.beginPath(); tc.moveTo(13,y-h*.1); tc.lineTo(13,y-h*.82);
        tc.moveTo(35,y-h*.1); tc.lineTo(35,y-h*.82);
        tc.moveTo(13,y-h*.82); tc.lineTo(35,y-h*.82);
        tc.moveTo(13,y-h*.48); tc.lineTo(35,y-h*.48);
        tc.moveTo(13,y-h*.1); tc.lineTo(35,y-h*.82);
        tc.stroke();
        tc.strokeStyle='rgba(239,230,211,.55)'; tc.lineWidth=1;
        tc.beginPath(); tc.arc(14,y-h*.14,16,-1.2,-0.08); tc.stroke();
        tc.fillStyle=d.style==='black'?'#c97f3f':'#efe6d3';
        tc.beginPath(); tc.arc(31,y-h*.48,1.8,0,7); tc.fill();
      }
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Hardscape';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const bx=c.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
      bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
      const sp=document.createElement('span'); sp.textContent='Back';
      b.append(c,sp);
      b.onclick=()=>{ game.drill=null; rememberBrushMenu(game.trayCat,null); buildToolTray(); };
      tray.appendChild(b);
    };
    const mainFenceBtn=()=>{
      const b=document.createElement('button');
      b.className='tool has-sub'+(game.tool==='fence'?' sel':'');
      b.dataset.k='fence';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFence(c.getContext('2d'),fd);
      const sp=document.createElement('span'); sp.textContent='Fence';
      b.append(c,sp);
      b.title=`Fence: ${fenceLabel()}. Open to choose gate, height, and material.`;
      b.onclick=()=>{ setTool('fence',null); game.drill='fence'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); };
      tray.appendChild(b);
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='fence';
      if (draftPatch.gate!==undefined) b.dataset.fenceGate=String(!!draftPatch.gate);
      if (draftPatch.height!==undefined) b.dataset.fenceHeight=String(draftPatch.height);
      if (draftPatch.style!==undefined) b.dataset.fenceStyle=draftPatch.style;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFence(c.getContext('2d'),Object.assign({},fd,draftPatch));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.fenceDraft=normalizeFenceDraft(Object.assign({},fenceDraft(),draftPatch));
        setTool('fence',null); rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    if (!game.drill){
      mainFenceBtn();
    } else if (game.drill==='fence'){
      backBtn();
      sep('Place');
      toolBtn('Fence', game.tool==='fence'&&!fd.gate, {gate:false}, 'Draw connected fence tiles');
      toolBtn('Gate', game.tool==='fence'&&!!fd.gate, {gate:true}, 'Draw walkable fence doors / gates');
      sep('Height');
      FENCE_HEIGHTS.forEach(h=>toolBtn(`${h} ft`, fd.height===h, {height:h}, `${h} foot tall fence`));
      sep('Material');
      FENCE_STYLES.forEach(st=>toolBtn(st.label.split(' ')[0], fd.style===st.id, {style:st.id}, st.label));
    }
  }
  if (cat.tools.includes('firepit')){
    const fd=firepitDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniFirepit=(tc,d)=>{
      d=normalizeFirepitDraft(d);
      const sz=firepitTileSize(d), cx2=24, cy2=25, tw=9.5, th=4.8;
      const pts=[
        [-sz.w/2,-sz.h/2],
        [ sz.w/2,-sz.h/2],
        [ sz.w/2, sz.h/2],
        [-sz.w/2, sz.h/2]
      ].map(([x2,y2])=>[cx2+(x2-y2)*tw,cy2+(x2+y2)*th]);
      const center=pts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]).map(v=>v/4);
      const scalePts=s=>pts.map(p=>[center[0]+(p[0]-center[0])*s,center[1]+(p[1]-center[1])*s]);
      const poly=(pa,fill,yoff)=>{ tc.fillStyle=fill; tc.beginPath(); tc.moveTo(pa[0][0],pa[0][1]+(yoff||0));
        for (let i=1;i<pa.length;i++) tc.lineTo(pa[i][0],pa[i][1]+(yoff||0));
        tc.closePath(); tc.fill(); };
      const b=scalePts(0.92), rx=(Math.max(...b.map(p=>p[0]))-Math.min(...b.map(p=>p[0])))/2;
      const ry=(Math.max(...b.map(p=>p[1]))-Math.min(...b.map(p=>p[1])))/2;
      tc.fillStyle='rgba(0,0,0,.24)'; tc.beginPath(); tc.ellipse(center[0],center[1]+6,rx*.9,4,0,0,7); tc.fill();
      if (d.shape==='round'){
        tc.fillStyle='#74695d'; tc.beginPath(); tc.ellipse(center[0],center[1],rx*.9,Math.max(6,ry*.9),0,0,7); tc.fill();
        tc.fillStyle='#9a8f81'; tc.beginPath(); tc.ellipse(center[0],center[1]-2,rx*.74,Math.max(4,ry*.62),0,0,7); tc.fill();
        tc.fillStyle='#30261f'; tc.beginPath(); tc.ellipse(center[0],center[1]-1,rx*.45,Math.max(3,ry*.38),0,0,7); tc.fill();
      } else {
        poly(scalePts(0.88),'#74695d',0);
        poly(scalePts(0.68),'#9a8f81',-2);
        poly(scalePts(0.36),'#30261f',-1);
      }
      tc.strokeStyle='#ef7f37'; tc.lineWidth=1.5; tc.lineCap='round';
      tc.beginPath(); tc.moveTo(center[0]-4,center[1]-2); tc.quadraticCurveTo(center[0]-2,center[1]-9,center[0],center[1]-5);
      tc.moveTo(center[0]+3,center[1]-1); tc.quadraticCurveTo(center[0]+5,center[1]-8,center[0]+2,center[1]-11); tc.stroke();
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Hardscape';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const bx=c.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
      bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
      const sp=document.createElement('span'); sp.textContent='Back';
      b.append(c,sp);
      b.onclick=()=>{ game.drill=null; rememberBrushMenu(game.trayCat,null); buildToolTray(); };
      tray.appendChild(b);
    };
    const choose=(patch)=>{
      const cur=firepitDraft(), next=Object.assign({},cur,patch);
      if (patch.shape && !patch.size && patch.shape!==cur.shape) next.size=firepitSize(null,patch.shape).id;
      game.firepitDraft=normalizeFirepitDraft(next);
      setTool('firepit',null); game.drill='firepit'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizeFirepitDraft(Object.assign({},fd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='firepit';
      if (patch.shape!==undefined) b.dataset.firepitShape=patch.shape;
      if (patch.size!==undefined) b.dataset.firepitSize=patch.size;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFirepit(c.getContext('2d'),d);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (!game.drill){
      const b=document.createElement('button');
      b.className='tool has-sub'+(game.tool==='firepit'?' sel':'');
      b.dataset.k='firepit';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniFirepit(c.getContext('2d'),fd);
      const sp=document.createElement('span'); sp.textContent='Fire Pit';
      b.append(c,sp);
      b.title=`Fire Pit: ${firepitLabel()}. Open to choose shape and size.`;
      b.onclick=()=>{ setTool('firepit',null); game.drill='firepit'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); };
      tray.appendChild(b);
    } else if (game.drill==='firepit'){
      backBtn();
      sep('Shape');
      toolBtn('Round', fd.shape==='round', {shape:'round'}, 'Round fire pit');
      toolBtn('Square', fd.shape==='square', {shape:'square'}, 'Square or rectangular fire pit');
      sep('Size');
      FIREPIT_SIZES.filter(s=>s.shape===fd.shape).forEach(s=>
        toolBtn(s.label, fd.size===s.id, {size:s.id}, `${s.plan} ${fd.shape} fire pit`));
    }
  }
  if (cat.tools.includes('boulder')){
    const bd=boulderDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniBoulder=(tc,d)=>{
      d=normalizeBoulderDraft(d);
      const spec=boulderType(d.type), cx2=24, cy2=25;
      const rx=Math.max(10,8*spec.w), ry=Math.max(5,5*spec.h*(spec.shape==='oblong'?0.72:1));
      tc.fillStyle='rgba(0,0,0,.22)';
      tc.beginPath(); tc.ellipse(cx2,cy2+7,rx*.92,4,0,0,7); tc.fill();
      if (spec.shape==='rect'){
        tc.fillStyle=shade(spec.tone,-18); tc.fillRect(cx2-rx*.72,cy2-2,rx*1.44,ry*.92);
        tc.fillStyle=shade(spec.tone,16); tc.fillRect(cx2-rx*.64,cy2-9,rx*1.28,ry*.8);
        tc.strokeStyle='rgba(40,36,30,.28)'; tc.lineWidth=1;
        tc.strokeRect(cx2-rx*.64,cy2-9,rx*1.28,ry*.8);
      } else {
        tc.fillStyle=shade(spec.tone,-18);
        tc.beginPath(); tc.ellipse(cx2,cy2+1,rx,ry,0,0,7); tc.fill();
        tc.fillStyle=shade(spec.tone,18);
        tc.beginPath(); tc.ellipse(cx2,cy2-4,rx*.88,ry*.84,0,0,7); tc.fill();
        tc.fillStyle='rgba(239,230,211,.23)';
        tc.beginPath(); tc.ellipse(cx2-rx*.18,cy2-ry*.55,rx*.24,Math.max(2,ry*.12),-0.1,0,7); tc.fill();
      }
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Hardscape';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const bx=c.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
      bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
      const sp=document.createElement('span'); sp.textContent='Back';
      b.append(c,sp);
      b.onclick=()=>{ game.drill=null; rememberBrushMenu(game.trayCat,null); buildToolTray(); };
      tray.appendChild(b);
    };
    const choose=(type)=>{
      game.boulderDraft=normalizeBoulderDraft({type});
      setTool('boulder',null); game.drill='boulder'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(spec)=>{
      const b=document.createElement('button');
      b.className='tool'+(bd.type===spec.id?' sel':'');
      b.dataset.k='boulder'; b.dataset.boulderType=spec.id;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniBoulder(c.getContext('2d'),{type:spec.id});
      const sp=document.createElement('span'); sp.textContent=spec.short;
      b.append(c,sp);
      b.title=`${spec.label} (${spec.plan})`;
      b.onclick=()=>choose(spec.id);
      tray.appendChild(b);
    };
    if (!game.drill){
      const b=document.createElement('button');
      b.className='tool has-sub'+(game.tool==='boulder'?' sel':'');
      b.dataset.k='boulder';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniBoulder(c.getContext('2d'),bd);
      const sp=document.createElement('span'); sp.textContent='Boulder';
      b.append(c,sp);
      b.title=`Boulder: ${boulderLabel()}. Open to choose size and shape.`;
      b.onclick=()=>{ setTool('boulder',null); game.drill='boulder'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); };
      tray.appendChild(b);
    } else if (game.drill==='boulder'){
      backBtn();
      sep('Round');
      BOULDER_TYPES.filter(b=>b.shape==='round').forEach(toolBtn);
      sep('Oblong');
      BOULDER_TYPES.filter(b=>b.shape==='oblong'||b.shape==='rect').forEach(toolBtn);
    }
  }
  if (cat.tools.includes('light')){
    const ld=lightDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const miniLight=(tc,d,lit)=>{
      const typ=lightType(d.type), tone=lightTone(d.tone), base=35, h=typ.id==='lantern'?31:typ.id==='lamp'?23:16;
      tc.lineCap='round'; tc.lineJoin='round';
      tc.strokeStyle='rgba(0,0,0,.22)'; tc.lineWidth=4;
      tc.beginPath(); tc.moveTo(24,base); tc.lineTo(24,base-h); tc.stroke();
      tc.strokeStyle='#3f4038'; tc.lineWidth=2.4;
      tc.beginPath(); tc.moveTo(24,base); tc.lineTo(24,base-h); tc.stroke();
      if (lit){
        const g=tc.createRadialGradient(24,base-h,0,24,base-h,20);
        g.addColorStop(0,tone.glow+'0.42)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        tc.fillStyle=g; tc.fillRect(4,base-h-20,40,40);
      }
      if (typ.id==='lantern'){
        tc.fillStyle='#3f4038'; tc.fillRect(15,base-h-2,18,13);
        tc.fillStyle=lit?tone.col:'#706a5d'; tc.fillRect(19,base-h+1,10,7);
        tc.strokeStyle='#3f4038'; tc.lineWidth=1.2; tc.strokeRect(15,base-h-2,18,13);
        tc.beginPath(); tc.moveTo(19,base-h-2); tc.lineTo(24,base-h-9); tc.lineTo(29,base-h-2); tc.stroke();
      } else if (typ.id==='lamp'){
        tc.fillStyle='#3f4038'; tc.beginPath(); tc.ellipse(24,base-h,11,5,0,0,7); tc.fill();
        tc.fillStyle=lit?tone.col:'#777066'; tc.beginPath(); tc.ellipse(24,base-h+2,7,3,0,0,7); tc.fill();
      } else {
        tc.fillStyle='#3f4038'; tc.beginPath();
        tc.moveTo(16,base-h); tc.lineTo(32,base-h); tc.lineTo(29,base-h-5); tc.lineTo(19,base-h-5); tc.closePath(); tc.fill();
        tc.fillStyle=lit?tone.col:'#958f7f'; tc.beginPath(); tc.ellipse(24,base-h+1,5,2.2,0,0,7); tc.fill();
      }
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='light';
      if (draftPatch.type!==undefined) b.dataset.lightType=draftPatch.type;
      if (draftPatch.tone!==undefined) b.dataset.lightTone=draftPatch.tone;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniLight(c.getContext('2d'),Object.assign({},ld,draftPatch),game.layerVis.night);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.lightDraft=normalizeLightDraft(Object.assign({},lightDraft(),draftPatch));
        setTool('light',null); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    sep('Fixture');
    LIGHT_TYPES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.type===t2.id, {type:t2.id}, t2.label));
    sep('Light');
    LIGHT_TONES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.tone===t2.id, {tone:t2.id}, t2.label));
  }
  if (cat.tools.includes('house')){
    // the House tab works like the plant tray: icon buttons in labeled
    // sections — Place, House size, Wall color, Roof color
    const hc=game.houseDraft||(game.houseDraft=defaultDraft());
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const toolBtn=(label,sel,draw,fn)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.setAttribute('aria-pressed',sel?'true':'false');
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.onclick=fn; tray.appendChild(b); return b;
    };
    const miniHouse=(tc,wf,df,wall,roof)=>{
      const w2=Math.min(40,13+wf*0.55), h2=Math.min(20,7+df*0.3);
      const x0=24-w2/2, y0=36-h2;
      tc.fillStyle=wall; tc.fillRect(x0,y0,w2,h2);
      tc.fillStyle=roof; tc.beginPath();
      tc.moveTo(x0-3,y0); tc.lineTo(24,y0-6-wf*0.14); tc.lineTo(x0+w2+3,y0);
      tc.closePath(); tc.fill();
      tc.fillStyle=HOUSE_TRIM.door; tc.fillRect(22,36-Math.min(9,h2-1),4,Math.min(9,h2-1));
    };
    if (game.gameMode==='design'){
      const bd=buildingStyleDraft();
      const miniFootprint=(tc,style)=>{
        tc.fillStyle=style.status==='proposed'?'rgba(201,127,63,.34)':style.roof;
        tc.strokeStyle=style.status==='proposed'?'#e5b36e':'#efe6d3'; tc.lineWidth=1.8;
        tc.setLineDash(style.status==='proposed'?[3,2]:[]);
        tc.beginPath(); tc.moveTo(7,10); tc.lineTo(31,10); tc.lineTo(31,18); tc.lineTo(40,18);
        tc.lineTo(40,33); tc.lineTo(17,33); tc.lineTo(17,25); tc.lineTo(7,25); tc.closePath(); tc.fill(); tc.stroke();
        tc.setLineDash([]);
      };
      const photo=toolBtn(game.underlay?'Edit site photo':'Add site photo',false,tc=>{
        tc.fillStyle='#8ca39a'; tc.fillRect(7,9,34,26);
        tc.fillStyle='#d8c98c'; tc.beginPath(); tc.arc(32,16,4,0,7); tc.fill();
        tc.fillStyle='#526d55'; tc.beginPath(); tc.moveTo(8,34); tc.lineTo(18,22); tc.lineTo(24,28); tc.lineTo(31,20); tc.lineTo(41,34); tc.closePath(); tc.fill();
        tc.strokeStyle='#efe6d3'; tc.lineWidth=1.4; tc.strokeRect(7,9,34,26);
      },()=>{ if (game.underlay) beginSitePhotoEdit(); else chooseSitePhoto(); });
      photo.dataset.k='site-photo'; photo.title=game.underlay?'Edit the calibrated site-photo reference':'Add a calibrated site-photo reference';
      const northDeg=normalizeSiteNorthDeg(game.siteNorthDeg);
      const north=toolBtn(`North ${northDeg}°`,false,tc=>{
        tc.strokeStyle='rgba(239,230,211,.42)'; tc.lineWidth=1.3; tc.beginPath(); tc.arc(24,23,16,0,Math.PI*2); tc.stroke();
        tc.save(); tc.translate(24,23); tc.rotate(northDeg*Math.PI/180);
        tc.strokeStyle='#c97f3f'; tc.fillStyle='#c97f3f'; tc.lineWidth=2.5;
        tc.beginPath(); tc.moveTo(0,12); tc.lineTo(0,-11); tc.stroke();
        tc.beginPath(); tc.moveTo(0,-15); tc.lineTo(-5,-7); tc.lineTo(5,-7); tc.closePath(); tc.fill(); tc.restore();
      },()=>openSiteNorthEditor('garden'));
      north.dataset.k='site-north'; north.title='Set true north for sun, shade, compass markers, and the design plan';
      const place=toolBtn('Draw footprint',game.tool==='building',tc=>miniFootprint(tc,bd),()=>{
        setTool('building',null); buildToolTray();
      });
      place.dataset.k='building'; place.title='Draw an orthogonal exterior building footprint';
      sep('Status');
      ['existing','proposed'].forEach(status=>toolBtn(status==='existing'?'Existing':'Proposed',bd.status===status,
        tc=>miniFootprint(tc,Object.assign({},bd,{status})),()=>{
          game.buildingStyleDraft=normalizeBuildingStyle(Object.assign({},bd,{status}));
          setTool('building',null); buildToolTray();
        }));
      sep('Wall color');
      WALL_COLS.forEach(([n,c2])=>toolBtn(n,bd.wall===c2,
        tc=>{ tc.fillStyle=c2; tc.fillRect(12,12,24,21); tc.strokeStyle='rgba(0,0,0,.3)'; tc.strokeRect(12,12,24,21); },()=>{
          game.buildingStyleDraft=normalizeBuildingStyle(Object.assign({},bd,{wall:c2})); setTool('building',null); buildToolTray();
        }));
      sep('Roof color');
      ROOF_COLS.forEach(([n,c2])=>toolBtn(n,bd.roof===c2,
        tc=>{ tc.fillStyle=c2; tc.beginPath(); tc.moveTo(7,31); tc.lineTo(24,12); tc.lineTo(41,31); tc.closePath(); tc.fill(); },()=>{
          game.buildingStyleDraft=normalizeBuildingStyle(Object.assign({},bd,{roof:c2})); setTool('building',null); buildToolTray();
        }));
    } else {
    const pb=toolBtn('Place', game.tool==='house',
      tc=>{ miniHouse(tc,24,18,hc.wall,hc.roof);
        tc.strokeStyle='#efe6d3'; tc.setLineDash([3,3]); tc.lineWidth=1.2;
        tc.strokeRect(3,8,42,32); },
      ()=>{ setTool('house',null); buildToolTray();
      });
    pb.dataset.k='house';
    sep('House size');
    HOUSE_SIZES.forEach(([label,wf,df])=>{
      const sel=hc.w===ftToTiles(wf) && hc.h===ftToTiles(df);
      toolBtn(`${label} ${wf}'×${df}'`, sel,
        tc=>miniHouse(tc,wf,df,hc.wall,hc.roof),
        ()=>{ applyHouseSize(wf,df,label); setTool('house',null); buildToolTray(); });
    });
    sep('Wall color');
    WALL_COLS.forEach(([n,c2])=>{
      toolBtn(n, hc.wall===c2,
        tc=>{ tc.fillStyle=c2; tc.fillRect(13,11,22,22);
          tc.strokeStyle='rgba(0,0,0,.3)'; tc.strokeRect(13,11,22,22); },
        ()=>{ paintHouse('wall',c2,n); setTool('house',null); buildToolTray(); });
    });
    sep('Roof color');
    ROOF_COLS.forEach(([n,c2])=>{
      toolBtn(n, hc.roof===c2,
        tc=>{ tc.fillStyle=c2; tc.beginPath();
          tc.moveTo(8,32); tc.lineTo(24,12); tc.lineTo(40,32);
          tc.closePath(); tc.fill(); },
        ()=>{ paintHouse('roof',c2,n); setTool('house',null); buildToolTray(); });
    });
    }
  }
  finishToolTrayRender();
}
function cap(s){ return s[0].toUpperCase()+s.slice(1); }
function applyTraySearch(){ // hide tray buttons that don't match the query
  const q=(game.traySearch||'').toLowerCase().trim();
  document.querySelectorAll('#toolTray .tool').forEach(b=>{
    const k=b.dataset.k, P=k&&PLANTS[k];
    let hay=k||'';
    if (b.dataset.pathColor) hay+=' '+pathColor(b.dataset.pathColor).label;
    if (b.dataset.bedStyle) hay+=' '+bedStyle(b.dataset.bedStyle).label+' bed gravel rock leaf litter mulch soil';
    if (b.dataset.waterStyle) hay+=' '+waterStyle(b.dataset.waterStyle).label+' pond river lake water';
    if (isElevationTool(k)) hay+=' elevation grade grading raised lowered berm swale terrace level';
    if (k==='fence') hay+=' hardscape structures fence gate door '+FENCE_STYLES.map(f=>f.label).join(' ');
    if (k==='firepit') hay+=' hardscape structures fire pit round square '+FIREPIT_SIZES.map(f=>f.label+' '+f.plan).join(' ');
    if (k==='boulder') hay+=' hardscape structures boulder rock stone '+BOULDER_TYPES.map(b=>b.label+' '+b.short+' '+b.plan).join(' ');
    if (k==='light') hay+=' lighting lights path lantern post outdoor lamp '+LIGHT_TYPES.map(l=>l.label).join(' ')+' '+LIGHT_TONES.map(l=>l.label).join(' ');
    if (P){ hay=P.name+' '+P.latin+' '+(P.group||'')+' '+roleSummary(k,12);
      if (P.group) PLANT_KEYS.forEach(k2=>{ if (PLANTS[k2].group===P.group)
        hay+=' '+PLANTS[k2].name+' '+PLANTS[k2].latin+' '+roleSummary(k2,12); }); }
    b.style.display=(!q||hay.toLowerCase().includes(q))?'':'none';
  });
}
function refreshTray(){
  const cur=PLANTS[game.tool];
  document.querySelectorAll('.tool').forEach(el=>{
    const sel=el.dataset.pathColor
      ? game.tool==='path' && game.pathColor===el.dataset.pathColor
      : el.dataset.bedStyle
      ? game.tool==='bed' && game.bedStyle===el.dataset.bedStyle
      : el.dataset.waterStyle
      ? game.tool==='water' && game.waterStyle===el.dataset.waterStyle
      : el.dataset.fenceStyle
      ? game.tool==='fence' && fenceDraft().style===el.dataset.fenceStyle
      : el.dataset.fenceHeight
      ? game.tool==='fence' && String(fenceDraft().height)===el.dataset.fenceHeight
      : el.dataset.fenceGate
      ? game.tool==='fence' && String(!!fenceDraft().gate)===el.dataset.fenceGate
      : el.dataset.firepitShape
      ? game.tool==='firepit' && firepitDraft().shape===el.dataset.firepitShape
      : el.dataset.firepitSize
      ? game.tool==='firepit' && firepitDraft().size===el.dataset.firepitSize
      : el.dataset.boulderType
      ? game.tool==='boulder' && boulderDraft().type===el.dataset.boulderType
      : el.dataset.lightType
      ? game.tool==='light' && lightDraft().type===el.dataset.lightType
      : el.dataset.lightTone
      ? game.tool==='light' && lightDraft().tone===el.dataset.lightTone
      : el.dataset.group
      ? !!(cur && cur.group===el.dataset.group)
      : el.dataset.k===game.tool;
    el.classList.toggle('sel', sel);
    if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed',sel?'true':'false');
  });
  updateCanvasCursor();
}
/* variant chips: species inside a group, and/or cultivars of the
   selected species. A chip is a (species, cultivar|null) pair. */
function renderCvRow(){
  // Sub-species now drill into the catalog row (see renderDrillIn), so this
  // legacy chip row stays hidden. The two calls below are the live hooks that
  // ride along on every tool change: the brush bar and the collapsible sheet.
  renderBrushBar();
  applySheetState();
  const row=document.getElementById('cvRow');
  if (row){ row.innerHTML=''; row.classList.add('hidden'); }
}
/* drill-in catalog: a grouped species (or one with cultivars) expands here into
   its members + cultivars, fronted by a Back chip — so sub-species never need a
   separate always-on row. Each button arms (species, cultivar) and stays in the
   drill so you can compare; Back returns to the species grid. */
function renderDrillIn(tray, drillKey, members){
  const back=document.createElement('button');
  back.className='tool tool-back'; back.title='Back to the catalog';
  const bc=document.createElement('canvas'); bc.width=48; bc.height=44;
  const bx=bc.getContext('2d'); bx.strokeStyle='#e0c9a8'; bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
  bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
  const bs=document.createElement('span'); bs.textContent='Back'; back.append(bc,bs);
  back.onclick=()=>{ game.drill=null; rememberBrushMenu(game.trayCat,null); buildToolTray(); };
  tray.appendChild(back);
  const mk=(k,v,label)=>{
    const R=plantDef(k,v);
    const b=document.createElement('button');
    b.className='tool'+((game.tool===k && (game.toolVar||null)===(v||null))?' sel':'');
    b.dataset.k=k; if (v) b.dataset.v=v;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const sc=Math.min(0.62, 36/(plantArtTop(R)||40));
    const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
    const iconSeason=plantIconSeason(R);
    drawPlant(ctx2,24/sc,42/sc,k,1,iconSeason,tileSeed(3,7),0,v||undefined,1);
    const sp=document.createElement('span'); sp.textContent=label; b.append(c,sp);
    b.onclick=()=>{ setTool(k,v||null); buildToolTray(); };
    tray.appendChild(b);
  };
  members.forEach(k=>{
    const M=PLANTS[k];
    mk(k, null, M.group ? (M.chip||M.name.split(' ').slice(0,2).join(' '))
                        : M.name.split(' ').slice(0,2).join(' '));
    for (const v in (M.cv||{})) mk(k, v, M.cv[v].name);
  });
}
/* Brush styles dock in the palette instead of a floating flyout. Plant brushes
   get Draw/Drift, while Grid/Free sits beside the active plant summary; every
   continuous paint brush also gets Fill, which flood-fills the connected ground
   region with the armed brush. */
function renderBrushBar(){
  const bar=document.getElementById('brushBar'); if (!bar) return;
  bar.innerHTML='';
  const meta=toolMeta(game.tool), P=PLANTS[game.tool];
  const erasing = game.tool==='shovel';
  // Erase is "just another brush": its layer + size options ride the brush bar
  // exactly where path/bed options do, so the erase size dots ARE the paint size
  // dots (one control, can't drift). No rail popover, and on a collapsed phone
  // sheet the width/layer stay visible because the brush bar persists.
  if (!meta.paints && !erasing){
    bar.classList.add('hidden'); return;
  }
  bar.classList.remove('hidden');
  const seg=(opts)=>{
    const s=document.createElement('div'); s.className='seg';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='seg-opt'+(o.on?' on':''); b.title=o.title||o.label;
      b.setAttribute('aria-pressed',o.on?'true':'false');
      if (o.draw){ const c=document.createElement('canvas'); c.width=28; c.height=24;
        o.draw(c.getContext('2d')); b.appendChild(c); }   // layer chips are text-only
      const sp=document.createElement('span'); sp.textContent=o.label;
      b.appendChild(sp); b.onclick=o.click; s.appendChild(b);
    });
    return s;
  };
  const lab=document.createElement('span');
  lab.className='brush-lab'+(erasing?' danger':''); lab.textContent=erasing?'Erase':'Brush';
  const parts=[lab];
  const placing=document.createElement('div'); placing.className='placing-summary';
  const placingSwatch=document.createElement('canvas'); placingSwatch.width=48; placingSwatch.height=44; placingSwatch.setAttribute('aria-hidden','true');
  drawBrushSwatchCanvas(placingSwatch,false);
  const placingCopy=document.createElement('span'); placingCopy.className='placing-copy';
  const placingLabel=document.createElement('small'); placingLabel.textContent=P?'Now placing':'Active tool';
  const placingName=document.createElement('b'); placingName.textContent=sheetContextLabel(); placingCopy.append(placingLabel,placingName);
  placing.append(placingSwatch,placingCopy);
  let placingAction=null;
  const controls=document.createElement('div'); controls.className='placing-controls';
  const appendFooter=()=>{
    if (placingAction) placing.appendChild(placingAction);
    controls.replaceChildren(...parts);
    bar.append(placing,controls);
  };
  if (erasing){
    // which layers a sweep clears, then the shared disc size — no Draw/Grid/Fill.
    parts.push(seg([['all','All'],['plant','Plants'],['bulb','Bulbs'],['terrain','Land']]
      .map(([m,lbl])=>({label:lbl, on:game.eraseMode===m, title:`Erase ${lbl.toLowerCase()}`,
        click:()=>{ game.eraseMode=m; renderBrushBar();
          updateActiveToolStatus(); }}))));
    const curE=normalizeBrushSize(game.brushSize);
    parts.push(seg(BRUSH_SIZES.map(sz=>({label:String(sz), on:curE===sz,
      title:`Erase ${sz} tile${sz>1?'s':''} wide`, draw:tc=>drawBrushSizeIcon(tc,sz),
      click:()=>{ setBrushSize(sz); renderBrushBar();
        updateActiveToolStatus(); }}))));
    appendFooter();
    return;
  }
  const woody = isWoodyDef(P);
  // Draw vs Drift is a no-op for woody plants (they always plant singly), so
  // only herbaceous plants get that toggle.
  if (P && !woody) parts.push(seg([
    {label:'Draw', on:!game.drift&&!game.matrix, title:'Paint one plant at a time',
      draw:tc=>drawPlantModeIcon(tc,false), click:()=>choosePlantMode(false)},
    {label:'Drift',on:game.drift,  title:'Paint natural clusters',
      draw:tc=>drawPlantModeIcon(tc,true),  click:()=>choosePlantMode(true)},
    {label:'Matrix',on:game.matrix, title:'Scatter across a painted region at real spacing (flows around what’s there)',
      draw:tc=>drawMatrixModeIcon(tc),  click:()=>chooseMatrixMode()},
  ]));
  // Grid/Free only moves herbaceous plants (freePlantable excludes woody), so
  // it occupies the contextual action at the right of the plant summary. Woody
  // brushes keep Age with the remaining brush controls below.
  if (P && !woody){
    placingAction=seg([
    {label:'Grid', on:!game.freePlanting, title:'Snap to tile centers',
      draw:tc=>drawPlacementIcon(tc,false), click:()=>choosePlacementMode(false)},
    {label:'Free', on:game.freePlanting,   title:'Land where you tap, not just centers',
      draw:tc=>drawPlacementIcon(tc,true),  click:()=>choosePlacementMode(true)},
    ]);
    placingAction.classList.add('placing-placement');
  }
  if (P && woody){
    const age=normalizeWoodyAge(game.woodyAge);
    parts.push(seg([
      {label:'New',    on:age==='new',    title:'Plant a young start — it grows in over the years', click:()=>chooseWoodyAge('new')},
      {label:'Young',  on:age==='young',  title:'Plant about half grown', click:()=>chooseWoodyAge('young')},
      {label:'Mature', on:age==='mature', title:'Plant at mature size — for trees and shrubs already in the yard', click:()=>chooseWoodyAge('mature')},
    ]));
  }
  // brush size (disc): materials + elevation only — plants keep their spacing
  if (meta.sizable){
    const cur=normalizeBrushSize(game.brushSize);
    parts.push(seg(BRUSH_SIZES.map(sz=>({
      label:String(sz), on:cur===sz, title:`Brush ${sz} tile${sz>1?'s':''} wide`,
      draw:tc=>drawBrushSizeIcon(tc,sz),
      click:()=>{ setBrushSize(sz); renderBrushBar(); updateActiveToolStatus(); }
    }))));
  }
  const fillSeg=document.createElement('div'); fillSeg.className='seg';
  const fillBtn=document.createElement('button');
  fillBtn.className='seg-opt'+(game.fillMode?' on':'');
  fillBtn.setAttribute('aria-pressed',game.fillMode?'true':'false');
  fillBtn.title=game.fillMode?'Turn Fill off and paint normally':'Fill a connected area with this brush';
  const fillIcon=document.createElement('canvas'); fillIcon.width=28; fillIcon.height=24;
  drawFillModeIcon(fillIcon.getContext('2d'), game.fillMode);
  const fillText=document.createElement('span'); fillText.textContent='Fill';
  fillBtn.append(fillIcon,fillText);
  fillBtn.onclick=()=>chooseFillMode(!game.fillMode);
  fillSeg.appendChild(fillBtn);
  parts.push(fillSeg);
  appendFooter();
}
/* The collapsible palette handle folds the catalog away to a compact current-
   selection bar. Phones retain their three-height sheet; desktop/tablet use
   the same bar as a simple collapse/expand control. */
function sheetContextLabel(){
  const P=PLANTS[game.tool];
  if (P) return plantDef(game.tool,game.toolVar).name+(game.matrix?' · matrix':game.drift?' · drift':'');
  if (game.tool==='path')  return pathColor(game.pathColor).label+' path';
  if (game.tool==='water') return waterStyle(game.waterStyle).label+' water';
  if (game.tool==='bed')   return bedStyle(game.bedStyle).label+' bed';
  if (isElevationTool(game.tool)) return game.tool[0].toUpperCase()+game.tool.slice(1)+' grade';
  if (game.tool==='fence') return fenceLabel();
  if (game.tool==='light') return 'Lighting';
  if (game.tool==='firepit') return firepitLabel();
  if (game.tool==='boulder') return boulderLabel();
  if (game.tool==='house') return 'House';
  if (game.tool==='building') return 'Building footprint';
  if (game.tool==='shovel') return 'Erase';
  if (game.tool==='select') return 'Select';
  if (game.tool==='pick') return 'Eyedropper';
  return 'Tap to choose a plant';
}
function toolGuide(){
  const P=PLANTS[game.tool];
  if (game.tool==='building'){
    const n=(game.buildingDraft&&game.buildingDraft.vertices||[]).length;
    return {k:'Building footprint',v:n
      ? `${n} corner${n===1?'':'s'} set — move or drag to preview the next wall in feet, then tap to place it`
      : 'Tap the first corner, then move or drag to preview each wall in feet'};
  }
  if (P){
    const D=plantDef(game.tool,game.toolVar), mode=game.matrix?'Matrix':game.drift?'Drift':'Draw';
    const action=game.fillMode?'Tap a connected region to fill it':game.matrix?'Drag across the planting region':game.drift?'Tap or drag to form a natural cluster':'Tap once or drag to paint';
    const placement=isWoodyDef(P)?` — ${cap(game.woodyAge)} size`:` — ${game.freePlanting?'Free':'Grid'} placement`;
    return {k:D.name,v:`${mode} — ${action}${placement}`};
  }
  const guides={
    hand:{k:'Hand',v:'Drag to pan — pinch, wheel, or View Tools to zoom'},
    select:{k:'Select',v:game.sel?`${cap(game.selMode)} mode — drag the selected area to ${game.selMode==='copy'?'place a copy':'move it'}`:'Drag a box around an area, then use the actions above it'},
    ruler:{k:'Tape measure',v:'Tap two points or drag between them'},
    pick:{k:'Eyedropper',v:'Tap an existing plant, material, or structure to copy it'},
    shovel:{k:'Erase',v:`${cap(game.eraseMode)} layer — tap or drag — ${game.brushSize}-tile brush`},
    path:{k:`${pathColor(game.pathColor).label} path`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    bed:{k:`${bedStyle(game.bedStyle).label} bed`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    water:{k:`${waterStyle(game.waterStyle).label} water`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    raise:{k:'Raise grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    lower:{k:'Lower grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    level:{k:'Level grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    fence:{k:fenceLabel(),v:'Tap or drag to draw a connected run'},
    light:{k:lightLabel(),v:'Tap or drag on clear, dry ground'},
    firepit:{k:firepitLabel(),v:'Tap clear, dry ground to place'},
    boulder:{k:boulderLabel(),v:'Tap clear, dry ground to place'},
    house:{k:'Legacy house',v:'Tap the map to place the current size and finish'}
  };
  return guides[game.tool]||{k:'Choose a tool',v:'Select a plant or build tool from the palette'};
}
function updateActiveToolStatus(){
  const el=document.getElementById('activeToolStatus'); if (!el) return;
  const info=toolGuide();
  el.innerHTML=`<b>${info.k}</b>${info.v?`<span>${info.v}</span>`:''}`;
  const ctx=document.getElementById('sheetCtx'); if (ctx) ctx.textContent=sheetContextLabel();
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  // Multi-step footprint drawing needs live progress. Ordinary tool guidance
  // is a brief confirmation, not permanent canvas chrome.
  if (!(game.tool==='building' && game.buildingDraft)){
    el._hideTimer=setTimeout(()=>el.classList.remove('show'),4000);
  }
}
function renderBuildingDraftActions(){
  const draft=game.tool==='building' && game.buildingDraft;
  let el=document.getElementById('buildingActions');
  if (!draft){ if (el) el.remove(); return; }
  if (!el){ el=document.createElement('div'); el.id='buildingActions'; el.setAttribute('role','group');
    el.setAttribute('aria-label','Building footprint actions'); document.body.appendChild(el); }
  el.innerHTML='';
  const add=(label,fn,primary,disabled)=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    if (primary) b.classList.add('primary'); b.disabled=!!disabled; b.onclick=fn; el.appendChild(b);
  };
  add('Close outline',()=>commitBuildingDraft(),true,draft.vertices.length<3);
  add('Undo corner',()=>{ draft.vertices.pop(); if (!draft.vertices.length) cancelBuildingDraft(); else updateBuildingUi(); });
  add('Cancel',()=>{ cancelBuildingDraft(); toast('Building outline cancelled.'); });
  const safe=typeof usableCanvasRect==='function' ? usableCanvasRect() : {left:8,right:VW-8,top:8,bottom:VH-8};
  el.style.left=Math.round((safe.left+safe.right)/2)+'px';
  el.style.top=Math.round(safe.bottom-8)+'px';
}
const SHEET_STATES=['collapsed','half','full'];
function normalizedSheetState(s){
  if (SHEET_STATES.includes(s)) return s;
  return game.sheetCollapsed ? 'collapsed' : 'half';
}
function setSheetState(s){
  game.sheetState=normalizedSheetState(s);
  game.sheetCollapsed=game.sheetState==='collapsed';
  applySheetState();
}
function cycleSheetState(){
  const s=normalizedSheetState(game.sheetState);
  setSheetState(s==='collapsed'?'half':s==='half'?'full':'collapsed');
}
function nudgeSheetState(dir){
  const i=SHEET_STATES.indexOf(normalizedSheetState(game.sheetState));
  setSheetState(SHEET_STATES[Math.max(0,Math.min(SHEET_STATES.length-1,i+dir))]);
}
function mobileSheetUi(){ return typeof matchMedia==='function' && matchMedia('(max-width:767px)').matches; }
function nudgeCatalogHandle(dir){
  if (mobileSheetUi()){ nudgeSheetState(dir); return; }
  // Desktop/tablet have one unambiguous destination in each direction.
  setSheetState(dir<0?'collapsed':'full');
}
function sheetSafeTopPx(hb){
  const p=document.createElement('i'); p.setAttribute('aria-hidden','true');
  p.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:var(--sheet-safe-top);width:0';
  hb.appendChild(p); const h=p.getBoundingClientRect().height||12; p.remove(); return h;
}
function sheetTargetHeight(hb,state){
  if (state==='full'){
    const full=typeof trueViewH==='function'?trueViewH():innerHeight;
    const visible=window.visualViewport&&window.visualViewport.height?window.visualViewport.height:full;
    return Math.max(180,Math.min(full,visible)-sheetSafeTopPx(hb));
  }
  const old=hb.style.height; hb.style.height='auto';
  const h=Math.ceil(hb.getBoundingClientRect().height); hb.style.height=old; return h;
}
function applySheetState(){
  const hb=document.querySelector('.hud-bottom'); if (!hb) return;
  const priorFocus=document.activeElement;
  const catalog=document.getElementById('sheetCatalog');
  const focusWasInCatalog=!!(priorFocus&&catalog&&catalog.contains(priorFocus));
  const focusWasExpand=!!(priorFocus&&(priorFocus.id==='btnSheetUp'||priorFocus.id==='btnLibraryLauncher'));
  const phone=mobileSheetUi();
  let s=normalizedSheetState(game.sheetState);
  // The middle state belongs only to the phone bottom sheet. Larger screens
  // move directly between the browser and the compact current-tool bar.
  if (!phone&&s==='half') s='full';
  game.sheetState=s; game.sheetCollapsed=s==='collapsed';
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start=phone?hb.getBoundingClientRect().height:0;
  if (hb._sheetEnd){ hb.removeEventListener('transitionend',hb._sheetEnd); hb._sheetEnd=null; }
  if (hb._sheetFrame) cancelAnimationFrame(hb._sheetFrame);
  if (hb._sheetTimer){ clearTimeout(hb._sheetTimer); hb._sheetTimer=null; }
  hb.classList.add('sheet-measuring'); hb.classList.remove('sheet-animating');
  hb.classList.remove('collapsed','sheet-collapsed','sheet-half','sheet-full');
  hb.classList.add('sheet-'+s);
  hb.classList.toggle('collapsed', s==='collapsed');
  if (phone){
    const target=sheetTargetHeight(hb,s), ready=hb.dataset.sheetReady==='1';
    hb.dataset.sheetReady='1';
    if (!ready||reduced||Math.abs(start-target)<1){
      hb.style.height=''; hb.classList.remove('sheet-measuring');
    } else {
      hb.style.height=`${start}px`; hb.getBoundingClientRect();
      hb.classList.remove('sheet-measuring'); hb.classList.add('sheet-animating');
      const token=(hb._sheetToken||0)+1; hb._sheetToken=token;
      hb._sheetFrame=requestAnimationFrame(()=>{ hb._sheetFrame=null; if (hb._sheetToken===token) hb.style.height=`${target}px`; });
      const finish=()=>{ if (hb._sheetToken!==token) return;
        if (hb._sheetEnd) hb.removeEventListener('transitionend',hb._sheetEnd);
        hb._sheetEnd=null; if (hb._sheetTimer) clearTimeout(hb._sheetTimer); hb._sheetTimer=null;
        hb.classList.remove('sheet-animating'); hb.style.height=''; };
      hb._sheetEnd=ev=>{ if (ev.target!==hb||ev.propertyName!=='height') return; finish(); };
      hb.addEventListener('transitionend',hb._sheetEnd);
      hb._sheetTimer=setTimeout(finish,700); // cleanup even if rotation/display changes swallow transitionend
    }
  } else {
    hb.style.height=''; hb.dataset.sheetReady=''; hb.classList.remove('sheet-measuring','sheet-animating');
  }
  const ctx=document.getElementById('sheetCtx'); if (ctx) ctx.textContent=sheetContextLabel();
  const handle=document.getElementById('sheetHandle'); if (handle){
    handle.setAttribute('data-state',s);
    handle.setAttribute('aria-label',phone
      ? `${cap(s)} plant palette. Swipe or use the show less and show more buttons.`
      : `${s==='collapsed'?'Collapsed':'Expanded'} catalog. ${sheetContextLabel()} is selected. ${s==='collapsed'?'Use the up button to browse plants.':'Use the in-catalog minimize button to show more of the plan.'}`);
  }
  const down=document.getElementById('btnSheetDown'), up=document.getElementById('btnSheetUp');
  const close=document.getElementById('btnCatalogClose');
  const launcher=document.getElementById('btnLibraryLauncher');
  if (close) close.onclick=()=>setSheetState('collapsed');
  if (down){
    down.disabled=s==='collapsed';
    down.setAttribute('aria-label',phone
      ? (s==='full'?'Reduce plant palette to half height':'Collapse plant palette')
      : 'Collapse plant catalog');
  }
  if (up){
    up.disabled=s==='full';
    up.setAttribute('aria-label',phone
      ? (s==='collapsed'?'Expand plant palette to half height':'Expand plant palette to full height')
      : 'Browse full plant catalog');
    up.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(1); };
  }
  if (down) down.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(-1); };
  const moveFocus=target=>{ if (!target) return; try{ target.focus({preventScroll:true}); }catch(_){ target.focus(); } };
  if (s==='collapsed'&&focusWasInCatalog) moveFocus(phone?up:launcher);
  else if (!phone&&s==='full'&&focusWasExpand) moveFocus(close);
  drawSheetSwatch();
  renderBuildingDraftActions();
}
/* a mini render of the armed brush in the collapse handle, so you always see
   what you're about to paint. */
function drawSheetSwatch(){
  const c=document.getElementById('sheetSwatch'); if (!c) return;
  drawBrushSwatchCanvas(c,false);
}

const replaceSearch=document.getElementById('replacePlantSearch');
if (replaceSearch) replaceSearch.addEventListener('input',()=>{ if (replacePlantContext&&!replacePlantContext.choosingSource) replacePlantContext.target=null; renderReplacePlantUi(); });
const replaceApply=document.getElementById('btnReplacePlantApply'); if (replaceApply) replaceApply.onclick=applyPlantReplacement;
const replaceCancel=document.getElementById('btnReplacePlantCancel'); if (replaceCancel) replaceCancel.onclick=()=>{ closeOverlay('replacePlantScreen'); replacePlantContext=null; };
const replaceScreen=document.getElementById('replacePlantScreen'); if (replaceScreen) replaceScreen.onclick=e=>{ if (e.target===replaceScreen){ closeOverlay('replacePlantScreen'); replacePlantContext=null; } };
const estimateDepth=document.getElementById('estimateDepth'); if (estimateDepth) estimateDepth.addEventListener('input',renderSelectionEstimate);
const estimateClose=document.getElementById('btnEstimateClose'); if (estimateClose) estimateClose.onclick=()=>closeOverlay('estimateScreen');
const estimateScreen=document.getElementById('estimateScreen'); if (estimateScreen) estimateScreen.onclick=e=>{ if (e.target===estimateScreen) closeOverlay('estimateScreen'); };
const siteFile=document.getElementById('sitePhotoFile'); if (siteFile) siteFile.onchange=()=>{ const f=siteFile.files&&siteFile.files[0]; if (f) importSitePhoto(f); };
const siteWidth=document.getElementById('sitePhotoWidth'); if (siteWidth) siteWidth.onchange=()=>{ if (!game.underlay) return;
  const feet=+siteWidth.value; if (!Number.isFinite(feet)||feet<=0){ syncSitePhotoEditor(); return; }
  game.underlay.widthTiles=Math.max(.5,Math.min(Math.max(GW,GH)*8,feet*12/TILE_IN)); markUnderlayChanged(); syncSitePhotoEditor(); };
const siteOpacity=document.getElementById('sitePhotoOpacity'); if (siteOpacity) siteOpacity.oninput=()=>{ if (!game.underlay) return;
  game.underlay.opacity=Math.max(.1,Math.min(.85,+siteOpacity.value/100)); markUnderlayChanged(); syncSitePhotoEditor(); };
const siteRotation=document.getElementById('sitePhotoRotation'); if (siteRotation) siteRotation.oninput=()=>{ if (!game.underlay) return;
  game.underlay.rotation=+siteRotation.value||0; markUnderlayChanged(); syncSitePhotoEditor(); };
document.querySelectorAll('[data-photo-nudge]').forEach(b=>b.onclick=()=>{ if (!game.underlay) return;
  const [dx,dy]=b.dataset.photoNudge.split(',').map(Number); game.underlay.cx+=dx; game.underlay.cy+=dy; markUnderlayChanged(); });
const photoRotate=delta=>{ if (!game.underlay) return; game.underlay.rotation=Math.max(-180,Math.min(180,game.underlay.rotation+delta)); markUnderlayChanged(); syncSitePhotoEditor(); };
const photoRL=document.getElementById('btnSitePhotoRotateLeft'); if (photoRL) photoRL.onclick=()=>photoRotate(-15);
const photoRR=document.getElementById('btnSitePhotoRotateRight'); if (photoRR) photoRR.onclick=()=>photoRotate(15);
const photoFit=document.getElementById('btnSitePhotoFit'); if (photoFit) photoFit.onclick=fitSitePhotoToPlot;
const photoCalibrate=document.getElementById('btnSitePhotoCalibrate'); if (photoCalibrate) photoCalibrate.onclick=startSitePhotoCalibration;
const photoCalibrateApply=document.getElementById('btnSitePhotoCalibrateApply'); if (photoCalibrateApply) photoCalibrateApply.onclick=applySitePhotoCalibration;
const photoCalibrateCancel=document.getElementById('btnSitePhotoCalibrateCancel'); if (photoCalibrateCancel) photoCalibrateCancel.onclick=startSitePhotoCalibration;
const photoCalibrateScreen=document.getElementById('sitePhotoCalibrateScreen'); if (photoCalibrateScreen) photoCalibrateScreen.onclick=e=>{ if (e.target===photoCalibrateScreen) cancelSitePhotoCalibration(); };
const photoReplace=document.getElementById('btnSitePhotoReplace'); if (photoReplace) photoReplace.onclick=chooseSitePhoto;
const photoCancel=document.getElementById('btnSitePhotoCancel'); if (photoCancel) photoCancel.onclick=()=>closeSitePhotoEdit(false);
const photoCancelX=document.getElementById('btnSitePhotoCancelX'); if (photoCancelX) photoCancelX.onclick=()=>closeSitePhotoEdit(false);
const photoDone=document.getElementById('btnSitePhotoDone'); if (photoDone) photoDone.onclick=()=>closeSitePhotoEdit(true);
const photoRemove=document.getElementById('btnSitePhotoRemove'); if (photoRemove) photoRemove.onclick=()=>showConfirm('Remove site photo?',
  'The design stays in place, but this reference image will be removed from the garden.','Remove photo',()=>{
    game.underlay=null; closeSitePhotoEdit(true); toast('Site photo removed.'); });
