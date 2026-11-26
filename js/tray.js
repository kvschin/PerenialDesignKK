'use strict';
/* ---------- tool tray: tabs, brush bar, drill-in, search, layer menu ---------- */
/* tray categories: the bottom main menu. Shrubs and Trees are honest
   placeholders until woody plants exist (type 'shrub' / 'tree'). */
const TRAY_CATS=[
  {id:'grasses',  label:'Grasses',          types:['grass'], sites:'grass'},
  {id:'sedges',   label:'Sedges',           types:['sedge'], sites:'sedge'},
  // `short` is what a cell of the category grid says; the label is its title
  {id:'sunper',   label:'Sun Perennials',   short:'Sun',   types:['forb'], sunFilter:'full'},
  {id:'shadeper', label:'Shade Perennials', short:'Shade', types:['forb'], sunFilter:'part', sites:'shade'},
  {id:'bulbs',    label:'Bulbs',            types:['bulb']},
  {id:'waterplants',label:'Water Plants',   short:'Water', types:['water']},
  {id:'climbers', label:'Climbers',         types:['vine']},
  {id:'shrubs',   label:'Shrubs',           types:['shrub']},
  {id:'trees',    label:'Trees',            types:['tree']},
  /* Site FIRST: a real design starts from the site — north, a photo to trace,
     the house — and it sat last in the strip, scrolled out of view, so the
     step that should come first was the one found last. */
  {id:'house',    label:'Site',             tools:['building','house','survey']},
  {id:'landscape',label:'Ground',           tools:['lawn','path','bed','water','crossing','edging']},
  // Terrace leads: it is what most people opening this tab came to build
  {id:'leveling', label:'Grade',            tools:['terrace','steps','berm','raise','lower','level','wall']},
  /* What stands, what you look at, and what you use (0.9.153). These were
     Hardscape, Lighting and Decor, which split things no gardener would: a
     birdbath under Hardscape and a bird feeder under Decor, boulders under one
     and stone spheres under the other, and a whole tab for one tool. `cards`
     opens a tab on a picture card per tool (renderCardTabHome); `hay` is what
     the old names still find in the search. */
  {id:'structures',label:'Structures',      tools:['fence','pergola','support'], cards:true, hay:'hardscape built'},
  {id:'features', label:'Features',         tools:['waterfeature','firepit','boulder','ornament'], cards:true,
   hay:'hardscape decor focal point'},
  {id:'furnishings',label:'Furnishings',    tools:['seat','pot','light','pet'], cards:true,
   hay:'hardscape decor lighting furniture'},
];
// two-tier tab grouping: a top-level Plants / Build toggle decides which set
// of category sub-tabs shows, so the bar never spills all twelve at once.
const TRAY_GROUPS=[
  {id:'plants', label:'Plants', cats:['grasses','sedges','sunper','shadeper','bulbs','waterplants','climbers','shrubs','trees']},
  {id:'build',  label:'Landscape',  cats:['house','landscape','leveling','structures','features','furnishings']},
];
function trayGroupOf(catId){ const g=TRAY_GROUPS.find(g=>g.cats.includes(catId)); return g?g.id:'plants'; }
let lastCatByGroup={plants:'grasses', build:'landscape'}; // remember the sub-tab per group
let catalogCategoryFocus=null;
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
     measure   — what the live paint-drag readout reports (toolDragMetricLabel):
                 'area' for a surface you spread, 'run' for a thing laid along a
                 line. ABSENT means no readout, which is the safe default for a new
                 tool — the readout used to gate on a hand-written list, written
                 before lawn and the pergola existed, so both drew nothing. Edging
                 and the wall face carry none on purpose: what they bill is the
                 sides that face lawn or fall away, not the line the pointer drew.
   The apply hooks are arrow wrappers (like the GAME_LAYERS sync hooks) so the
   placement functions — defined later in view.js — resolve at call time. */
const TOOLS={
  hand:    {layer:null,        brush:false, placement:false, paints:false, material:false},
  select:  {layer:null,        brush:false, placement:false, paints:false, material:false},
  ruler:   {layer:null,        brush:false, placement:false, paints:false, material:false},
  pick:    {layer:null,        brush:false, placement:false, paints:false, material:false},
  shovel:  {layer:null,        brush:false, placement:false, paints:false, material:false}, // Erase
  // a path is paving and is billed by area, but it is LAID as a run, and how
  // long it is is the question while you are drawing one
  path:    {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, measure:'run',  apply:(x,y,o)=>placeTerrainAt(x,y)},
  bed:     {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, measure:'area', apply:(x,y,o)=>placeTerrainAt(x,y)},
  water:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, measure:'area', apply:(x,y,o)=>placeTerrainAt(x,y)},
  // Lawn shares placeTerrainAt with the three above; its 'mown' style is the
  // one material in the app that removes a record rather than writing one.
  lawn:    {layer:'landscape', brush:true,  placement:true,  paints:true,  material:true,  sizable:true, measure:'area', apply:(x,y,o)=>placeTerrainAt(x,y)},
  // once: raise/lower INCREMENT, so a disc re-stamping a tile mid-drag would
  // move it several levels — see applyToolAt. level writes 0 and is exempt.
  raise:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, once:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  lower:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, once:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  level:   {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true, apply:(x,y,o)=>applyElevationTool(x,y)?'elevation':null},
  // the wall brush paints a face that already exists, so it may sit on a tile
  // the universal guard would otherwise refuse nothing about — it is sizable
  // because a terrace edge is a run, not a spot
  /* A tap faces a whole terrace or sunken patio (faceTerraceAt); a drag faces each
     one it crosses. No disc and nothing for Fill to add, as with Edging. */
  wall:    {layer:'landscape', brush:true,  placement:true,  paints:false, material:true, apply:(x,y,o)=>faceTerraceAt(x,y)},
  /* A terrace drags corner to corner like the pergola (`rect`) and a tap lays
     or rebuilds one (tapTerraceAt). `paints` is true because Fill is the way to
     raise a shape no rectangle makes: lay the bed, then fill it with Terrace.
     `apply` sets a tile to an ABSOLUTE height, so unlike raise/lower it needs
     no `once`. */
  terrace: {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, measure:'rect',
    apply:(x,y,o)=>buildTerraceTile(x,y,terraceDraft()), rect:(x0,y0,x1,y1)=>finishTerraceDrag(x0,y0,x1,y1)},
  /* A berm (or a swale) is laid whole: an oval in the box a drag makes, or the
     box a tap lays (bermPlan, commands.js). Nothing for Fill to add. */
  berm:    {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, measure:'rect',
    apply:(x,y,o)=>{ const d=bermDraft(), p=bermPlan(bermTapRect(x,y,d.h),d.h); return buildBerm(p)?'berm':null; },
    rect:(x0,y0,x1,y1)=>finishBermDrag(x0,y0,x1,y1)},
  /* Steps are laid a whole flight per tap, on the edge where they go (tapStepsAt),
     so there is nothing to drag and nothing for Fill to add. */
  steps:   {layer:'landscape', brush:false, placement:true,  paints:false, material:false,
    apply:(x,y,o)=>{ const a=stepsAim(x,y,o), p=a&&!a.flight?stepFlightPlan(a,stepDraft()):null; return p&&buildStepFlight(p,stepDraft())?'steps':null; }},
  /* Edging acts on a whole bed per tap (paintEdgingAt), so it has no disc size
     and nothing for Fill to add; a drag still edges every bed it crosses. */
  edging:  {layer:'landscape', brush:true,  placement:true,  paints:false, material:true, apply:(x,y,o)=>paintEdgingAt(x,y)},
  /* marks what is already there (0.9.155): the shared brush size, a drag, and
     Fill for a whole patio. The disc goes to it at once, so a tap can say how
     many things it marked (surveyStamp). */
  survey:  {layer:'landscape', brush:true,  placement:true,  paints:true,  material:false, sizable:true,
            stamp:(tiles,o)=>surveyStamp(tiles), apply:(x,y,o)=>markExistingAt(x,y)?'survey':null},
  // laid over water a tile at a time (0.9.154), so a tap or a drag; nothing to fill
  crossing:{layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeCrossingAt(x,y)},
  house:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false}, // no apply — placed via placeHouse
  building:{layer:'landscape', brush:false, placement:true,  paints:false, material:false}, // corner-by-corner polygon input
  // add/remove tiles on an already-placed footprint. sizable so a whole wing
  // comes on in one drag; Rename is tap-only and handled in tapAction.
  'building-edit':{layer:'landscape', brush:true, placement:true, paints:false, material:false,
    sizable:true, overSite:true, apply:(x,y,o)=>applyBuildingEdit(x,y),
    stamp:(tiles,o)=>applyBuildingEditTiles(tiles)},
  fence:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, measure:'run', apply:(x,y,o)=>placeFenceAt(x,y)},
  light:   {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeLightAt(x,y)},
  firepit: {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeFirepitAt(x,y)},
  // brush:true like the fire pit — each refuses to overlap the last, so a drag
  // lays a row along a path rather than 24 copies on one spot
  waterfeature:{layer:'landscape', brush:true, placement:true, paints:false, material:false, apply:(x,y,o)=>placeWaterFeatureAt(x,y)},
  // a run of obelisks down a border is a real thing, so it drags like a pot
  support: {layer:'landscape', brush:true, placement:true, paints:false, material:false, apply:(x,y,o)=>placeSupportAt(x,y)},
  /* A ROOF FOOTPRINT, so it drags corner to corner like the selection marquee
     (`rect`, input.js) rather than painting tile by tile -- and a tap lays a
     whole one about 10 ft square (tapPergolaAt). `apply` stays the one-tile
     placer that both of those lay every bay through. */
  pergola: {layer:'landscape', brush:true, placement:true, paints:false, material:false, measure:'rect',
    apply:(x,y,o)=>placePergolaAt(x,y), rect:(x0,y0,x1,y1)=>finishPergolaDrag(x0,y0,x1,y1)},
  boulder: {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeBoulderAt(x,y)},
  // brush:false — tap-only on purpose. Every other placer drags out a run,
  // but a drag laid 24 identical cats across the plot, which nobody wants and
  // which is the only way to reach a measurable frame cost (a pet is not
  // sprite-cached, so it redraws procedurally every frame at ~37us each).
  pet:     {layer:'landscape', brush:false, placement:true,  paints:false, material:false, apply:(x,y,o)=>placePetAt(x,y)},
  /* Pots and seats DO drag: unlike a pet, a run of them along a wall or a path
     is a thing people actually want, and each refuses to overlap the last, so a
     drag lays a neat row rather than 24 copies on one spot. */
  pot:     {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placePotAt(x,y)},
  seat:    {layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeSeatAt(x,y)},
  // a row of nest boxes along a hedge or feeders down a border drags like a pot
  ornament:{layer:'landscape', brush:true,  placement:true,  paints:false, material:false, apply:(x,y,o)=>placeOrnamentAt(x,y)},
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
/* The material a terrain tool will lay next: the id its chip is armed with.
   Every surface that draws a terrain tool as its real tile asks this, and asks
   isTerrainKind whether it IS one, rather than listing path/bed/water again —
   the landscape search's icon did, written before lawn, so a meadow result drew
   the generic brush beside three real material tiles. One field per
   TERRAIN_RANK kind; a test holds the two tables together. */
const TERRAIN_DRAFT_FIELD={path:'pathColor', bed:'bedStyle', water:'waterStyle', lawn:'lawnStyle'};
function terrainDraftId(kind){
  return isTerrainKind(kind) ? game[TERRAIN_DRAFT_FIELD[kind]] : null;
}
/* Which tab a tool is browsed on. Read it off TRAY_CATS rather than restating
   it: this was a hand-written chain duplicating the table, and every tool added
   to a tab after it was written got missed. All four of them — 'wall' answered
   'landscape' because it is a material and the chain tested that before it
   tested which tab it is actually on, and 'pot', 'seat' and 'pet' answered null,
   which made rememberBrushMenu bail and leave lastBrushTrayCat pointing at
   whatever was browsed before. Arming a pot and then restoring it from the rail
   opened the Grasses catalog with a pot on the brush. The table is the fact;
   asking it means a tool added to a tab is routed right without touching this. */
function brushTrayCatForTool(k){
  if (PLANTS[k]) return plantCategoryFor(k);
  const c=TRAY_CATS.find(c=>c.tools && c.tools.includes(k));
  return c ? c.id : null;
}
function isBrushTrayCat(id){
  const c=TRAY_CATS.find(c=>c.id===id);
  return !!(c && (c.types || (c.tools && c.tools.some(t=>isBrushTool(t)))));
}
// the same question the other way round, off the same table
function toolFitsBrushTray(k,catId){
  const c=TRAY_CATS.find(c=>c.id===catId);
  if (!c) return false;
  if (PLANTS[k]) return !!(c.types && c.types.includes(PLANTS[k].type) && (!c.sunFilter || PLANTS[k].sun===c.sunFilter));
  return !!(c.tools && c.tools.includes(k));
}
function drillFitsTray(drill,catId){
  const P=PLANTS[drill], c=TRAY_CATS.find(c=>c.id===catId);
  return !!(P && c && c.types && c.types.includes(P.type) && (!c.sunFilter || P.sun===c.sunFilter));
}
function brushDrillFitsTray(drill,catId){
  if (drillFitsTray(drill,catId)) return true;
  const c=TRAY_CATS.find(c=>c.id===catId);
  return !!(c && c.cards && c.tools && c.tools.includes(drill));
}
/* The eyedropper lands a picked piece on its own page, on whichever tab holds
   it: that is where its material, size and facing are selected chips. Set
   BEFORE setTool, which files the brush under game.drill (rememberBrushTool). */
function openToolPage(k){
  const cat=brushTrayCatForTool(k), c=TRAY_CATS.find(c=>c.id===cat);
  game.fillMode=false; game.trayCat=cat; game.drill=(c&&c.cards) ? k : null;
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
  if (k!=='select') resetSelectionState(); // leaving select drops its marquee
  if (k!==game.tool || (v||null)!==(game.toolVar||null)) hidePlantCard();   // moving on from what it described
  // asked of the tool, not a list of them: the list had none of the pieces added since it was written
  if (!toolMeta(k).paints) game.fillMode=false;
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
  tc.save();
  tc.clearRect(0,0,42,32);
  // Shared 42x32 artwork for the rail, search and guidebook. Neutral outlines
  // and restrained warm details follow the theme, including when selected.
  const cream=uiInk('--icon-ink'), seed=uiInk('--icon-ink-soft'),
    warm=uiInk('--icon-warm'), bronze='#c97f3f';
  tc.strokeStyle=cream; tc.fillStyle=cream; tc.lineWidth=1.8;
  tc.lineCap='round'; tc.lineJoin='round';
  if (kind==='hand'){
    tc.beginPath(); tc.moveTo(18,28);
    tc.quadraticCurveTo(14,25,10,20); tc.quadraticCurveTo(8,17,10,16);
    tc.quadraticCurveTo(11,15,13,17); tc.lineTo(15,19); tc.lineTo(15,9);
    tc.bezierCurveTo(15,5,19,5,19,9); tc.lineTo(19,15); tc.lineTo(19,6);
    tc.bezierCurveTo(19,2,23,2,23,6); tc.lineTo(23,15); tc.lineTo(23,8);
    tc.bezierCurveTo(23,4,27,4,27,8); tc.lineTo(27,16); tc.lineTo(27,12);
    tc.bezierCurveTo(27,8,31,8,31,12); tc.lineTo(31,20);
    tc.quadraticCurveTo(31,25,27,28); tc.closePath(); tc.stroke();
    tc.strokeStyle=warm;
    tc.beginPath(); tc.moveTo(19,24.5); tc.lineTo(26,24.5); tc.stroke();
  } else if (kind==='select'){
    tc.beginPath();
    tc.moveTo(9,13); tc.lineTo(9,7); tc.lineTo(15,7);
    tc.moveTo(27,7); tc.lineTo(33,7); tc.lineTo(33,13);
    tc.moveTo(9,19); tc.lineTo(9,25); tc.lineTo(15,25);
    tc.moveTo(21,7); tc.lineTo(21,7.1); tc.moveTo(9,16); tc.lineTo(9,16.1);
    tc.stroke();
    tc.strokeStyle=warm;
    tc.beginPath(); tc.moveTo(22,15); tc.lineTo(24,28); tc.lineTo(27,24);
    tc.lineTo(32,23); tc.closePath(); tc.stroke();
  } else if (kind==='brush'){
    tc.save(); tc.translate(21,16); tc.rotate(-0.55);
    tc.strokeStyle=warm;
    tc.beginPath(); roundedIconRect(tc,-2.5,-12,5,14,2.5); tc.stroke();
    tc.strokeStyle=cream;
    tc.beginPath(); roundedIconRect(tc,-4.5,2,9,5,1.5); tc.stroke();
    tc.beginPath(); tc.moveTo(0,7); tc.lineTo(0,14); tc.stroke();
    tc.fillStyle=warm;
    tc.beginPath(); tc.moveTo(0,12); tc.bezierCurveTo(-6,13,-7,9,-7,8);
    tc.bezierCurveTo(-3,7,0,9,0,12); tc.fill();
    tc.beginPath(); tc.moveTo(0,13); tc.bezierCurveTo(6,14,7,10,7,9);
    tc.bezierCurveTo(3,8,0,10,0,13); tc.fill(); tc.restore();
  } else if (kind==='erase'){
    tc.save(); tc.translate(21,15); tc.rotate(-0.55);
    tc.beginPath(); roundedIconRect(tc,-11,-6,22,12,2); tc.stroke();
    tc.strokeStyle=warm;
    tc.beginPath(); tc.moveTo(0,-6); tc.lineTo(0,6); tc.stroke(); tc.restore();
    tc.strokeStyle=seed;
    tc.beginPath(); tc.moveTo(15,27); tc.lineTo(32,27); tc.stroke();
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
    tc.beginPath(); tc.moveTo(25,12); tc.lineTo(13,24); tc.lineTo(12,28);
    tc.lineTo(16,27); tc.lineTo(28,15); tc.stroke();
    tc.strokeStyle=warm;
    tc.beginPath(); tc.moveTo(23,10); tc.lineTo(30,17); tc.stroke();
    tc.beginPath(); tc.moveTo(25,12); tc.lineTo(29,8);
    tc.bezierCurveTo(33,4,37,8,33,12); tc.lineTo(29,16); tc.stroke();
  } else if (kind==='undo'||kind==='redo'){
    tc.save(); tc.translate(kind==='redo'?42:0,0); tc.scale(kind==='redo'?-1:1,1);
    tc.beginPath(); tc.moveTo(11,12); tc.lineTo(23,12);
    tc.bezierCurveTo(34,12,34,25,23,25); tc.lineTo(20,25); tc.stroke();
    tc.beginPath(); tc.moveTo(16,7); tc.lineTo(11,12); tc.lineTo(16,17); tc.stroke();
    tc.restore();
  } else if (kind==='rotate'){
    /* The garden plot, as the iso tile it is on screen, with an orbit arrow
       travelling round it: the view turns about the plot. A plain circular
       arrow (what this was) reads as "reload", which is the one thing a
       rotate-view button must not be mistaken for. Tint and outline come off
       the warm ink so light mode follows. */
    tc.save(); tc.strokeStyle=warm; tc.fillStyle=warm;
    tc.beginPath(); tc.moveTo(21,12.5); tc.lineTo(31,17.5); tc.lineTo(21,22.5); tc.lineTo(11,17.5); tc.closePath();
    tc.globalAlpha=0.22; tc.fill(); tc.globalAlpha=1; tc.stroke(); tc.restore();
    // clockwise orbit, open across the top where the arrowhead chases its tail
    const a0=1.68*Math.PI, a1=3.32*Math.PI, rx=16, ry=9.5, ox=21, oy=16.5;
    tc.beginPath(); tc.ellipse(ox,oy,rx,ry,0,a0,a1,false); tc.stroke();
    const tx=ox+rx*Math.cos(a1), ty=oy+ry*Math.sin(a1),
      back=Math.atan2(-ry*Math.cos(a1),rx*Math.sin(a1));
    tc.beginPath(); tc.moveTo(tx+5.5*Math.cos(back+0.62),ty+5.5*Math.sin(back+0.62));
    tc.lineTo(tx,ty); tc.lineTo(tx+5.5*Math.cos(back-0.62),ty+5.5*Math.sin(back-0.62)); tc.stroke();
  } else if (kind==='layers'){
    /* Stacked sheets: one whole sheet on top, the two beneath showing only
       their near edges. Three full outlines overlapped into a lattice (and
       the lowest ran off the bottom of the canvas); this is the layers glyph
       people already know. The bottom edge is warm — the ground layer. */
    tc.beginPath(); tc.moveTo(21,4); tc.lineTo(33,10); tc.lineTo(21,16); tc.lineTo(9,10); tc.closePath();
    tc.save(); tc.fillStyle=warm; tc.globalAlpha=0.22; tc.fill(); tc.restore(); tc.stroke();
    tc.beginPath(); tc.moveTo(9,15.5); tc.lineTo(21,21.5); tc.lineTo(33,15.5); tc.stroke();
    tc.strokeStyle=warm;
    tc.beginPath(); tc.moveTo(9,21); tc.lineTo(21,27); tc.lineTo(33,21); tc.stroke();
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
    tc.save(); tc.translate(21,16); tc.rotate(-0.55);
    tc.beginPath(); roundedIconRect(tc,-13,-5,26,10,2); tc.stroke();
    tc.strokeStyle=warm; tc.lineWidth=1.5;
    for (let x=-8;x<=8;x+=4){
      tc.beginPath(); tc.moveTo(x,-5); tc.lineTo(x,x%8===0?-1:1); tc.stroke();
    }
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
  tc.restore();
}
/* Paint drawCanvasIcon's 42x32 artwork into a canvas at whatever backing
   resolution the canvas carries. Chrome icons are 3x (126x96) so they stay
   crisp at every displayed size; the top bar's used to be 1x, drawn 42x32 and
   shown at 32x24, which blurred them beside the rail's 3x icons. setTransform
   rather than scale(): the top-bar icons repaint on every syncTopTools, and a
   scale would compound. */
function paintIconCanvas(c,kind){
  const tc=c && c.getContext('2d');
  if (!tc) return;
  tc.setTransform(c.width/42,0,0,c.height/32,0,0);
  drawCanvasIcon(tc,kind);
}
function makeCanvasTool(label,kind,opts){
  const b=document.createElement('button');
  b.className=canvasToolClass(opts);
  b.title=opts&&opts.title || label;
  b.setAttribute('aria-pressed',opts&&opts.active?'true':'false');
  // a stable hook for the controls tour, which has to point at a real element
  if (opts&&opts.tour) b.dataset.tour=opts.tour;
  // Small fixed 3x backing stays crisp across the rail's responsive sizes.
  // Keep drawCanvasIcon's logical coordinates intact for its other callers.
  const c=document.createElement('canvas'); c.width=126; c.height=96;
  c.setAttribute('aria-hidden','true');
  paintIconCanvas(c,kind);
  const s=document.createElement('span'); s.textContent=label;
  b.append(c,s);
  if (opts&&opts.swatch){
    const sw=document.createElement('canvas');
    sw.className='rail-swatch'; sw.width=30; sw.height=24;
    drawBrushSwatchCanvas(sw,true);
    const [k,v]=brushSwatchChoice(true);
    sw._swatchKey=PLANTS[k] ? k+'|'+(v||'') : null;   // see syncCanvasTool
    b.appendChild(sw);
  }
  if (opts&&opts.onClick) b.onclick=opts.onClick;
  return b;
}
function canvasToolClass(opts){
  return 'canvas-tool'+(opts&&opts.active?' sel':'')+(opts&&opts.danger?' danger':'')+(opts&&opts.disabled?' disabled':'')+(opts&&opts.todo?' todo':'');
}
/* Bring an existing rail button up to date without rebuilding it: its state
   classes, title, pressed state and handler, and the Plant swatch. The swatch
   of a PLANT is a procedural drawPlant, so it is redrawn only when the plant
   on it changes; every other swatch is a few shapes or a cached bitmap and is
   simply redrawn, which is cheaper than keeping a key that has to name every
   draft it reads. */
function syncCanvasTool(b,label,opts){
  const cls=canvasToolClass(opts);
  if (b.className!==cls) b.className=cls;
  const title=opts&&opts.title || label;
  if (b.title!==title) b.title=title;
  b.setAttribute('aria-pressed',opts&&opts.active?'true':'false');
  if (opts&&opts.onClick) b.onclick=opts.onClick;
  const sw=opts&&opts.swatch && b.querySelector && b.querySelector('.rail-swatch');
  if (sw){
    const [k,v]=brushSwatchChoice(true), key=PLANTS[k] ? k+'|'+(v||'') : null;
    if (!key || sw._swatchKey!==key){ drawBrushSwatchCanvas(sw,true); sw._swatchKey=key; }
  }
}
/* A chrome icon depends on its kind and, through uiInk, on the theme and
   nothing else, so paint it when either changes and not on every refresh. The
   top-bar icons were repainted at 3x on every syncTopTools, which runs on every
   tool change, undo and planted tap. */
function paintIconCanvasOnce(c,kind){
  if (!c) return;
  const key=kind+'|'+((document.documentElement&&document.documentElement.getAttribute('data-theme'))||'');
  if (c._iconKey===key) return;
  paintIconCanvas(c,kind); c._iconKey=key;
}
function brushSwatchChoice(includeLast){
  if (isBrushTool(game.tool)) return [game.tool,game.toolVar||null];
  if (includeLast && isBrushTool(game.lastBrushTool)) return [game.lastBrushTool,game.lastBrushVar||null];
  return [null,null];
}
/* A fire pit fitted to a small canvas, through the garden's own drawFirepitArt,
   so a chip cannot advertise a pit the canvas does not draw — it used to be a
   second, hand-drawn copy of the old flat ellipses, in the tray and here in the
   brush swatch both. One scale CAP, each pit shrinking below it to fit, the
   miniWater rule. The bitmap is KEPT per draft and size: a pit is a few hundred
   shapes, the fire pit page shows fifteen of them, and redrawing each on every
   click made it the slowest page in the tray. The drawing is a pure function of
   the draft (a fixed seed, Summer, daylight), so the cache cannot go stale. */
const FIREPIT_CHIP_CACHE=new Map();
function drawFirepitChip(tc,d,w,h,capK){
  if (!tc) return;
  d=normalizeFirepitDraft(d);
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(capK||0.42);
  let bmp=FIREPIT_CHIP_CACHE.get(key);
  if (!bmp){
    if (FIREPIT_CHIP_CACHE.size>96) FIREPIT_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      const e=firepitArtExtent(d);
      const k=Math.min(capK||0.42,(w-4)/(2*e.halfW),(h-4)/(e.up+e.down));
      c.save(); c.translate(w/2,h/2+(e.up-e.down)*k/2); c.scale(k,k);
      drawFirepitArt(c,0,0,d,'Summer',ISO_AXES_FLAT,0x3f1e,false);
      c.restore();
    }
    FIREPIT_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
}
/* A boulder fitted to a small canvas through drawBoulderArt, the fire pit's
   chip one stone over: one painter for the garden, the tray and the brush
   swatch, kept per draft and size because the drawing is a pure function of the
   draft (a fixed seed, Summer, rot 0). The cap is higher than the fire pit's so
   a 12 in stone still reads as a stone; past it, a big rock shrinks to fit and
   the chip's label carries its size. */
const BOULDER_CHIP_CACHE=new Map();
function drawBoulderChip(tc,d,w,h,capK){
  if (!tc) return;
  d=normalizeBoulderDraft(d);
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(capK||0.6);
  let bmp=BOULDER_CHIP_CACHE.get(key);
  if (!bmp){
    if (BOULDER_CHIP_CACHE.size>96) BOULDER_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      const e=boulderArtExtent(d,0x3f1e);
      const k=Math.min(capK||0.6,(w-4)/(e.x1-e.x0),(h-4)/(e.y1-e.y0));
      c.save(); c.translate(w/2-(e.x0+e.x1)/2*k,h/2-(e.y0+e.y1)/2*k); c.scale(k,k);
      drawBoulderArt(c,0,0,d,'Summer',ISO_AXES_FLAT,0x3f1e);
      c.restore();
    }
    BOULDER_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
}
/* A seat fitted to a small canvas the same way, through drawSeatArt and fitted
   to seatArtExtent — the drawing's real reach, not its size in inches. The old
   chip scaled by inches (34/the longer side), which is not how big a piece
   draws, so every seat chip was cropped and the lounger lost both ends. One
   cap, each piece shrinking below it to fit: a stool and a chair sit at the
   cap and still read small beside a bench, the miniWater rule. */
const SEAT_CHIP_CACHE=new Map();
function drawSeatChip(tc,d,w,h,capK){
  if (!tc) return;
  d=normalizeSeatDraft(d);
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(capK||0.42);
  let bmp=SEAT_CHIP_CACHE.get(key);
  if (!bmp){
    if (SEAT_CHIP_CACHE.size>96) SEAT_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      const e=seatArtExtent(d);
      const k=Math.min(capK||0.42,(w-4)/(e.x1-e.x0),(h-4)/(e.y1-e.y0));
      c.save(); c.translate(w/2-(e.x0+e.x1)/2*k,h/2-(e.y0+e.y1)/2*k); c.scale(k,k);
      drawSeatArt(c,0,0,d,'Summer',ISO_AXES_FLAT);
      c.restore();
    }
    SEAT_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
}
/* An ornament fitted the seat chip's way, through drawOrnamentArt and its own
   extent. A tall piece (the feeder pole) and a squat one (a sphere) are fitted
   separately, so each fills its chip; the true height is in the chip's title. */
const ORNAMENT_CHIP_CACHE=new Map();
function drawOrnamentChip(tc,d,w,h,capK){
  if (!tc) return;
  d=normalizeOrnamentDraft(d);
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(capK||0.5);
  let bmp=ORNAMENT_CHIP_CACHE.get(key);
  if (!bmp){
    if (ORNAMENT_CHIP_CACHE.size>96) ORNAMENT_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      const e=ornamentArtExtent(d), top=ornamentKind(d.kind).chipTop;
      // a tall piece shows its top, where what it is lives; the pole runs off the chip
      if (top) e.y1=e.y0+(e.y1-e.y0)*top;
      const k=Math.min(capK||0.5,(w-4)/(e.x1-e.x0),(h-4)/(e.y1-e.y0));
      c.save(); c.translate(w/2-(e.x0+e.x1)/2*k,h/2-(e.y0+e.y1)/2*k); c.scale(k,k);
      drawOrnamentArt(c,0,0,d,'Summer',ISO_AXES_FLAT);
      c.restore();
    }
    ORNAMENT_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
}
/* A climbing frame fitted to a small canvas the same way, through
   drawSupportArt and supportArtExtent: one painter for the garden, the chip, the
   card and the brush swatch, and a fit to the frame's real reach. */
const SUPPORT_CHIP_CACHE=new Map();
function drawSupportChip(tc,d,w,h,capK){
  if (!tc) return;
  d=Object.assign(normalizeSupportDraft(d),{face:0});
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(capK||0.5);
  let bmp=SUPPORT_CHIP_CACHE.get(key);
  if (!bmp){
    if (SUPPORT_CHIP_CACHE.size>96) SUPPORT_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      /* Fitted twice: the scale decides how heavy the members must be drawn to
         read at it, and that weight widens the reach a little. */
      const fit=e=>Math.min(capK||0.5,(w-4)/(e.x1-e.x0),(h-4)/(e.y1-e.y0));
      const thick=Math.max(1,Math.min(2.4,0.75/fit(supportArtExtent(d))));
      const e=supportArtExtent(d,thick), k=fit(e);
      c.save(); c.translate(w/2-(e.x0+e.x1)/2*k,h/2-(e.y0+e.y1)/2*k); c.scale(k,k);
      drawSupportArt(c,0,0,d,'Summer',ISO_AXES_FLAT,0x3c1d,thick);
      c.restore();
    }
    SUPPORT_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
}
/* A pergola fitted to a small canvas the same way, through drawPergolaArt --
   a whole little pergola built by the garden's own frame rules, so the chip
   shows posts, beams and rafters where the canvas would put them. It used to
   be three hand-drawn sticks: two posts and a beam, which read as a doorway. */
const PERGOLA_CHIP_CACHE=new Map();
function drawPergolaChip(tc,d,w,h,lit){
  if (!tc) return;
  d=normalizePergolaDraft(d);
  // lit, like a light's chip, while the garden is at night: a festoon is lit then
  lit=!!(lit===undefined ? game.layerVis && game.layerVis.night : lit);
  const key=JSON.stringify(d)+'|'+w+'x'+h+'|'+(lit?1:0);
  let bmp=PERGOLA_CHIP_CACHE.get(key);
  if (!bmp){
    if (PERGOLA_CHIP_CACHE.size>64) PERGOLA_CHIP_CACHE.clear();
    bmp=document.createElement('canvas'); bmp.width=w; bmp.height=h;
    const c=bmp.getContext('2d');
    if (c){
      /* ONE scale for every height, fitted to the tallest: a 7 ft pergola
         should read lower than a 9 ft one side by side, not fill the same box. */
      const e=pergolaArtExtent({mat:d.mat,height:PERGOLA_HEIGHTS[PERGOLA_HEIGHTS.length-1]});
      const k=Math.min((w-2)/(e.x1-e.x0),(h-2)/(e.y1-e.y0));
      c.save(); c.translate(w/2-(e.x0+e.x1)/2*k,h-1-e.y1*k); c.scale(k,k);
      drawPergolaArt(c,0,0,d,'Summer',ISO_AXES_FLAT,undefined,undefined,lit);
      c.restore();
    }
    PERGOLA_CHIP_CACHE.set(key,bmp);
  }
  tc.drawImage(bmp,0,0);
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
  const matIcon=(kind,id)=>{ drawMaterialIcon(g,c.width/2,c.height/2+1,c.width*.36,c.height*.24,kind,id); return true; };
  if (isTerrainKind(k)) return matIcon(k,terrainDraftId(k));
  if (k==='crossing') return matIcon('crossing',crossingDraft());
  if (isElevationTool(k)){ diamond(k==='lower'?'#6f7f83':'#8ba263','rgba(239,230,211,.45)');
    g.fillStyle=uiInk('--icon-ink'); g.font='700 12px IBM Plex Sans'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(k==='level'?'0':(k==='raise'?'+':'-'),c.width/2,c.height/2+1); return true; }
  if (k==='fence'){ const st=fenceStyle(fenceDraft().style);
    g.strokeStyle=st.rail; g.lineWidth=2; g.lineCap='round';
    g.beginPath(); g.moveTo(5,16); g.lineTo(25,16); g.moveTo(5,10); g.lineTo(25,10);
    for (let x=7;x<=23;x+=8){ g.moveTo(x,19); g.lineTo(x,6); } g.stroke(); return true; }
  if (k==='light'){ const ld=lightDraft();
    // through the garden's own painter, so the swatch follows the finish
    const overall=feetToPx(lightHeightFt(ld)), k2=Math.min(0.85, 20/Math.max(1,overall));
    drawLightArt(g,c.width/2,c.height-5,ld,true,null,k2); return true; }
  if (k==='firepit'){ drawFirepitChip(g,firepitDraft(),c.width,c.height,0.34); return true; }
  if (k==='seat'){ drawSeatChip(g,seatDraft(),c.width,c.height,0.34); return true; }
  if (k==='ornament'){ drawOrnamentChip(g,ornamentDraft(),c.width,c.height,0.34); return true; }
  if (k==='boulder'){ drawBoulderChip(g,boulderDraft(),c.width,c.height,0.4); return true; }
  if (k==='pergola'){ drawPergolaChip(g,pergolaDraft(),c.width,c.height); return true; }
  if (k==='support'){ drawSupportChip(g,supportDraft(),c.width,c.height,0.3); return true; }
  // both chip artworks are 48x44; the swatch is whatever size this canvas is
  if (k==='terrace'||k==='wall'||k==='steps'||k==='berm'){ const s=Math.min(c.width/48,c.height/44);
    g.save(); g.translate((c.width-48*s)/2,(c.height-44*s)/2); g.scale(s,s);
    if (k==='terrace') drawTerraceIcon(g,terraceDraft()); else if (k==='steps') drawStepsIcon(g,stepDraft());
    else if (k==='berm') drawBermIcon(g,bermDraft()); else drawWallIcon(g,wallDraft());
    g.restore(); return true; }
  if (k==='pet'){ drawPet(g,c.width/2,c.height-3,petDraft(),0.62); return true; }
  if (k==='edging'){ drawEdgingIcon(g,edgingDraft(),c.width,c.height); return true; }
  if (k==='house'){ g.fillStyle=(game.houseDraft||defaultDraft()).wall; g.fillRect(9,11,12,9);
    g.fillStyle=(game.houseDraft||defaultDraft()).roof; g.beginPath(); g.moveTo(7,11); g.lineTo(15,5); g.lineTo(23,11); g.closePath(); g.fill(); return true; }
  /* Generic fallback for the placement tools with no bespoke swatch — pot,
     building. Hiding the canvas (what used to happen
     here) left the brush bar with a name and no mark, so the armed tool had no
     visual at all. A tinted tile with the tool's initial is not art, but it is
     an unmistakable "this is armed", which is the job. */
  if (isPlacementTool(k)){
    diamond('#6d6154','rgba(239,230,211,.38)');
    g.fillStyle=uiInk('--icon-ink'); g.font='700 12px IBM Plex Sans';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText(cap(k)[0],c.width/2,c.height/2+1);
    return true;
  }
  c.style.display='none';
  return false;
}
/* ---------- material icons ----------
   Every swatch of a ground material — library grid, search result, brush swatch,
   sheet swatch — renders the REAL tile through drawGroundTexture, clipped to the
   icon's diamond. The tray used to keep its own copy of the texture recipes, so
   when the garden's materials were rebuilt the library went on showing the old
   flat speckle; worse, every path COLOUR was drawn as 'gravel' whatever it
   actually was, so slate, clay and bark differed only by tint in the picker.
   One source of truth: a new material now needs no icon code at all.

   Drawn at true tile scale and cropped, rather than scaling a whole tile down to
   fit. A two-pixel grain shrunk by half is mud, and the grain is the thing the
   gardener is trying to judge. Icons are fixed to Summer so a bed does not read
   as snow while you are picking it. */
function materialIconSeed(id){
  let h=2166136261; const s=String(id||'');
  for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function materialIconPath(tc,cx,cy,hw,hh){
  tc.beginPath(); tc.moveTo(cx,cy-hh); tc.lineTo(cx+hw,cy);
  tc.lineTo(cx,cy+hh); tc.lineTo(cx-hw,cy); tc.closePath();
}
/* Grade chips. Both paint through the garden's own face painters at a fixed
   little terrace, so a chip cannot advertise a wall the canvas does not draw
   (the fencePanel lesson). */
function gradeChipFace(){
  return {a:[9,17], b:[27,27], drop:15};            // a terrace corner, in chip space
}
/* A little bed in a lawn with the edging all the way round it, through the
   garden's own painter. The old chip edged the far side of a lawn diamond
   with the bed below it, so the strip sat against the sky and its face, which
   is most of what tells one edging from another, never showed. Round a whole
   bed both faces show: the far strip's inside and the near strip's outside. */
function drawEdgingIcon(tc,id,W,H){
  W=W||48; H=H||44;
  const st=edgingStyle(id), cx=W/2, cy=H/2+1, hw=W*0.47, hh=H*0.4, rx=hw*0.66, ry=hh*0.6;
  // the same diamond of ground every other Ground chip shows, here lawn
  tc.save(); materialIconPath(tc,cx,H/2,hw,hh); tc.fillStyle='#7d9358'; tc.fill(); tc.clip();
  const pts=[];
  for (let i=0;i<=40;i++){ const a=i/40*Math.PI*2;
    pts.push([cx+Math.cos(a)*rx*(1+0.06*Math.sin(a*3)), cy+Math.sin(a)*ry]); }
  tc.beginPath(); tc.moveTo(pts[0][0],pts[0][1]); pts.forEach(p=>tc.lineTo(p[0],p[1])); tc.closePath();
  tc.fillStyle='#5c4a36'; tc.fill();                  // the bed it edges
  if (!st.w){ tc.strokeStyle='rgba(48,36,24,0.45)'; tc.lineWidth=1; tc.stroke(); }
  else drawEdgingRun(tc,pts,st,7,TILE_EDGE_PX*0.8*Math.min(1,W/72));
  tc.restore();
}
/* A chip's wall top, through the garden's own drawWallCap. A chip's terrace is
   a whole terrace drawn about one tile across, so its top is drawn at 40% of
   its real width, or a raised bed chip would be half coping. Chip space is a
   unit square of tile corners: (0,0) the top of the diamond, (1,0) its right. */
function drawChipWallCap(tc,st,pts,sgn,closed,cx,cy,hw,hh){
  if (!st.cap) return;
  const s=Object.assign({},st,{topIn:st.topIn*0.4,copeIn:st.copeIn*0.4,capIn:(st.capIn||0)*0.7,overIn:(st.overIn||0)*0.6});
  drawWallCap(tc,pts,sgn,closed,s,(x,y,z)=>[cx+(x-y)*hw, cy-hh+(x+y)*hh-z*0.9],7,false,null);
}
function drawWallIcon(tc,id){
  const f=gradeChipFace(), st=wallStyle(id);
  tc.fillStyle='#7d9358';                            // the turf on top
  tc.beginPath(); tc.moveTo(9,17); tc.lineTo(27,27); tc.lineTo(45,17); tc.lineTo(27,7);
  tc.closePath(); tc.fill();
  if (st.face) drawWallFace(tc,f.a,f.b,f.drop,st,7);
  else {
    tc.fillStyle='#6b5a44';
    tc.beginPath(); tc.moveTo(9,17); tc.lineTo(27,27); tc.lineTo(27,42); tc.lineTo(9,32);
    tc.closePath(); tc.fill();
  }
  tc.fillStyle='#6f8a50';
  tc.beginPath(); tc.moveTo(27,27); tc.lineTo(45,17); tc.lineTo(45,32); tc.lineTo(27,42);
  tc.closePath(); tc.fill();
  drawChipWallCap(tc,st,[[0,1],[1,1]],-1,false,27,17,18,10);   // along the faced side
}
/* A terrace chip: a block standing as tall as the chip's height, faced in the
   chip's wall — or, sunk, a hollow seen from above with its two far walls
   showing. The faces go through drawWallFace, the garden's own painter. The
   drop is a chip scale, not the garden's (5 in would be a sliver), but it
   grows with the height so the four chips read as a ladder. */
function drawTerraceIcon(tc,d){
  d=normalizeTerraceDraft(d);
  // 2.6 a level, so a 36 in terrace (7) still fits the 48x44 chip
  const st=wallStyle(d.w), drop=4+Math.abs(d.h)*2.6, seed=7;
  /* The top in the material it will be laid with (the one last chosen under
     Ground), drawn by the Ground chips' own painter; Keep is the lawn with a
     dashed edge, since what is there is not known to a chip. */
  const top=(cx,cy,hw,hh)=>{
    const k=d.top==='bed'?'bed':d.top==='path'?'path':(d.top==='lawn'&&!lawnIsNone(game.lawnStyle))?'lawn':null;
    if (k) drawMaterialIcon(tc,cx,cy,hw,hh,k,k==='bed'?game.bedStyle:k==='path'?game.pathColor:game.lawnStyle);
    else diamond(cx,cy,hw,hh,'#7d9358');
    if (d.top==='keep'){ tc.save(); tc.setLineDash([3,2]); tc.strokeStyle='rgba(243,236,221,0.85)'; tc.lineWidth=1.2;
      materialIconPath(tc,cx,cy,hw-1,hh-0.5); tc.stroke(); tc.restore(); }
  };
  const face=(a,b,shadeCol)=>{
    if (st.face) drawWallFace(tc,a,b,drop,st,seed);
    else { tc.fillStyle=shadeCol; tc.beginPath(); tc.moveTo(a[0],a[1]); tc.lineTo(b[0],b[1]);
      tc.lineTo(b[0],b[1]+drop); tc.lineTo(a[0],a[1]+drop); tc.closePath(); tc.fill(); }
  };
  const diamond=(cx,cy,hw,hh,fill)=>{ tc.fillStyle=fill; tc.beginPath();
    tc.moveTo(cx,cy-hh); tc.lineTo(cx+hw,cy); tc.lineTo(cx,cy+hh); tc.lineTo(cx-hw,cy); tc.closePath(); tc.fill(); };
  if (d.h>0){
    const cy=22-drop/2, hw=17, hh=8.5;
    const W=[24-hw,cy], S=[24,cy+hh], E=[24+hw,cy];
    face(W,S,'#6b5a44'); face(S,E,'#5d4e3b');
    top(24,cy,hw,hh);
    drawChipWallCap(tc,st,[[0,0],[1,0],[1,1],[0,1]],1,true,24,cy,hw,hh);
    return;
  }
  // a hollow: lawn round it, then inside the opening its floor and far walls
  const cy=21, hw=21, hh=10.5, ihw=13, ihh=6.5;
  diamond(24,cy,hw,hh,'#7d9358');
  const N=[24,cy-ihh], E=[24+ihw,cy], S=[24,cy+ihh], W=[24-ihw,cy];
  tc.save(); tc.beginPath(); tc.moveTo(N[0],N[1]); tc.lineTo(E[0],E[1]); tc.lineTo(S[0],S[1]); tc.lineTo(W[0],W[1]);
  tc.closePath(); tc.clip();
  top(24,cy+drop,ihw,ihh);
  face(W,N,'#5d4e3b'); face(N,E,'#6b5a44');
  tc.restore();
  drawChipWallCap(tc,st,[[0,0],[1,0],[1,1],[0,1]],-1,true,24,cy,ihw,ihh);   // round the rim
}
/* A berm chip: a lawn diamond with a mound on it, lit from the upper left and
   shaded away from it, taller the higher the berm; a swale is a hollow in it. */
function drawBermIcon(tc,d){
  d=normalizeBermDraft(d);
  const k=Math.abs(d.h)/7, cx=24, cy=24, hw=21, hh=10.5;
  tc.fillStyle='#7d9358'; tc.beginPath();
  tc.moveTo(cx,cy-hh); tc.lineTo(cx+hw,cy); tc.lineTo(cx,cy+hh); tc.lineTo(cx-hw,cy); tc.closePath(); tc.fill();
  const rx=15, ry=7.5;
  if (d.h>0){
    const top=cy-(5+15*k);
    // the mound: the base ellipse's near half, and a dome over the far one
    tc.beginPath(); tc.moveTo(cx-rx,cy);
    tc.bezierCurveTo(cx-rx*0.55,top,cx+rx*0.55,top,cx+rx,cy);
    tc.ellipse(cx,cy,rx,ry,0,0,Math.PI);
    tc.closePath(); tc.fillStyle='#8aa363'; tc.fill();
    tc.save(); tc.clip();
    // shade on the right, light on the left
    tc.fillStyle='rgba(18,24,14,0.28)'; tc.beginPath(); tc.ellipse(cx+rx*0.55,cy-1,rx*0.75,ry+10,0,0,Math.PI*2); tc.fill();
    tc.fillStyle='rgba(255,246,222,0.22)'; tc.beginPath(); tc.ellipse(cx-rx*0.45,(cy+top)/2,rx*0.5,(cy-top)*0.55+2,0,0,Math.PI*2); tc.fill();
    tc.restore();
    tc.strokeStyle='rgba(239,230,211,0.5)'; tc.lineWidth=1; tc.beginPath();
    tc.moveTo(cx-rx,cy); tc.bezierCurveTo(cx-rx*0.55,top,cx+rx*0.55,top,cx+rx,cy); tc.stroke();
    return;
  }
  // the hollow: its far side catches the light, its near side is in shade
  const dep=3+5*k;
  tc.save(); tc.beginPath(); tc.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); tc.clip();
  tc.fillStyle='#66804a'; tc.fillRect(cx-rx,cy-ry,rx*2,ry*2);
  tc.fillStyle='rgba(255,246,222,0.16)'; tc.beginPath(); tc.ellipse(cx-2,cy+dep*0.6,rx*0.9,ry*0.75,0,0,Math.PI*2); tc.fill();
  tc.fillStyle='rgba(18,24,14,0.32)'; tc.beginPath(); tc.ellipse(cx,cy-ry*0.55,rx,ry*0.6,0,0,Math.PI*2); tc.fill();
  tc.restore();
  tc.strokeStyle='rgba(239,230,211,0.45)'; tc.lineWidth=1; tc.beginPath(); tc.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); tc.stroke();
}
/* A steps chip: three steps of a flight two tiles wide, coming down toward the
   left, each a block with its tread on top and its riser and side in the riser's
   material through the garden's own face painter. A slab tread has a lit
   nosing; a loose one is held by a strip of the riser's top, as in the garden. */
function drawStepsIcon(tc,d){
  d=normalizeStepDraft(d);
  const st=wallStyle(d.w), pc=pathColor(d.tread), tones=pc.tones||[pc.fill,pc.fill,pc.fill,pc.fill];
  const wide=0.6+d.width*0.45, hw=6.5, hh=3.25, rz=4.6, n=3;
  const cx=24-(wide-n)*hw/2, cy=22-((wide+n)*hh-n*rz)/2;            // centred in the 48x44 chip
  const P=(x,y,z)=>[cx+(x-y)*hw, cy+(x+y)*hh-z];
  const quad=(a,b,c,e,fill)=>{ tc.fillStyle=fill; tc.beginPath(); tc.moveTo(a[0],a[1]); tc.lineTo(b[0],b[1]);
    tc.lineTo(c[0],c[1]); tc.lineTo(e[0],e[1]); tc.closePath(); tc.fill(); };
  for (let k=0;k<n;k++){
    const z=(n-k)*rz, y0=k, y1=k+1;
    // the side and the riser, down to the ground
    drawWallFace(tc,P(wide,y0,z),P(wide,y1,z),z,st,7+k);
    drawWallFace(tc,P(0,y1,z),P(wide,y1,z),z,st,11+k);
    quad(P(0,y0,z),P(wide,y0,z),P(wide,y1,z),P(0,y1,z),tones[1]);         // the tread
    if (pc.depth){ quad(P(0,y1-0.22,z),P(wide,y1-0.22,z),P(wide,y1,z),P(0,y1,z),st.capTone||st.tone); }
    else { tc.strokeStyle='rgba(255,250,236,0.6)'; tc.lineWidth=1; tc.beginPath();
      const a=P(0,y1,z), b=P(wide,y1,z), c=P(wide,y0,z); tc.moveTo(a[0],a[1]); tc.lineTo(b[0],b[1]); tc.lineTo(c[0],c[1]); tc.stroke(); }
  }
}
function drawMaterialIcon(tc,cx,cy,hw,hh,kind,id,stroke){
  const amb=AMBIENCE.Summer, o={k:kind,c:id};
  tc.save();
  materialIconPath(tc,cx,cy,hw,hh); tc.clip();
  const sx=cx, sy=cy-TILE_H/2;                 // drawGroundTexture takes the top corner
  if (kind==='water') drawWaterTexture(tc,sx,sy,3,7,o,amb,false,3.4);
  else if (kind==='crossing'){
    drawWaterTexture(tc,sx,sy,3,7,{k:'water',c:'pond'},amb,false,3.4);
    if (crossingTypeId(id)!=='none'){
      // tile (3,7) on the swatch: the deck carries on past it both ways along x
      const proj=(gx,gy,z)=>[cx+((gx-3.5)-(gy-7.5))*TILE_W/2, cy+((gx-3.5)+(gy-7.5))*TILE_H/2-z*EDGE_RISE_PX];
      drawCrossingTile(tc,3,7,crossingTypeId(id),'x',proj,(a,b)=>b===7,()=>false,false,0x51ab);
    }
  } else {
    const rs=mulberry(materialIconSeed(id));
    if (kind==='bed') rs();                    // paintGround spends one draw before the texture
    const base = kind==='path' ? pathFill(o,0) : kind==='lawn' ? lawnFill(o,amb) : bedFill(o,amb);
    // 'path' is signalled by its own argument, so it passes null as the kind;
    // every other material names itself. The Mown chip resolves no grain and
    // falls through to the plain grass branch, which is exactly what it means.
    drawGroundTexture(tc,sx,sy,3,7,kind==='path'?null:kind,kind==='path',amb,base,rs,o);
  }
  tc.restore();
  if (stroke!==false){
    materialIconPath(tc,cx,cy,hw,hh);
    tc.strokeStyle=(kind==='water'||kind==='crossing')?'rgba(232,248,244,.55)':'rgba(239,230,211,.45)';
    tc.lineWidth=1.2; tc.stroke();
  }
}
function drawPlantModeIcon(tc,drift){
  tc.clearRect(0,0,28,24);
  tc.strokeStyle=uiInk('--icon-ink-soft'); tc.fillStyle=uiInk('--icon-ink-soft'); tc.lineWidth=1.6;
  if (!drift){
    tc.save(); tc.translate(14,12); tc.rotate(-0.72);
    tc.fillStyle='#c97f3f'; tc.fillRect(-2,-10,4,13);
    tc.fillStyle=uiInk('--icon-ink'); tc.fillRect(-4,3,8,4);
    tc.fillStyle='#6f8f5a'; tc.beginPath(); tc.moveTo(-5,7); tc.quadraticCurveTo(0,13,5,7); tc.closePath(); tc.fill();
    tc.restore();
    return;
  }
  tc.strokeStyle=uiInk('--icon-ink');
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
  tc.fillStyle=free?'#c97f3f':uiInk('--icon-ink');
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
  tc.strokeStyle=on?uiInk('--icon-ink'):uiInk('--icon-ink-soft'); tc.lineWidth=1.7;
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
  tc.strokeStyle=uiInk('--icon-warm'); tc.lineWidth=1.5; tc.stroke();
}
function drawSearchIcon(tc,close){
  tc.clearRect(0,0,24,24);
  tc.lineCap='round'; tc.lineJoin='round';
  if (close){
    tc.strokeStyle=uiInk('--icon-ink'); tc.lineWidth=2.4;
    tc.beginPath(); tc.moveTo(7,7); tc.lineTo(17,17); tc.moveTo(17,7); tc.lineTo(7,17); tc.stroke();
    return;
  }
  tc.strokeStyle=uiInk('--icon-ink'); tc.lineWidth=2;
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
/* The brush the Plant rail button brings back: the last one the gardener
   actually chose, or nothing. It used to fall back to the first species in the
   open category, so pressing Plant before choosing anything — or after the
   remembered plant had been filtered out — armed whatever sorted first (blue
   grama, in a fresh garden) with nothing on screen to say so, and the next tap
   planted a species nobody picked. */
function visiblePlantChoice(){
  if (isBrushTool(game.lastBrushTool) && !PLANTS[game.lastBrushTool])
    return [game.lastBrushTool,null];
  /* Membership only. This was `trayKeys().includes(k)`, and trayKeys() is this
     same filter followed by a SORT of the whole catalog by style score and
     name: 7.4ms to ask whether one plant is in it, paid on every Plant press
     and, through armPlantToolFromRail, every Draw/Drift/Matrix/Grid/Age tap.
     plantFits() alone gives the identical answer (a test compares the two for
     every species) in well under a microsecond. */
  const k=game.lastBrushTool, P=PLANTS[k];
  if (P && !P.hidden && plantFits(k)) return [k,game.lastBrushVar||null];
  return null;
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
    // nothing chosen yet: show the plants to choose from instead of guessing
    game.tool='hand'; game.toolVar=null; game.drill=null;
    if (trayGroupOf(game.trayCat)!=='plants') game.trayCat=lastCatByGroup.plants||'grasses';
  }
  game.toolMenu=nextMenu;
  buildToolTray();
  renderCvRow();
  refreshCanvasTools();
  updateCanvasCursor();
  if (!choice){
    if (!libraryOpen()) setSheetState(mobileSheetUi() ? 'half' : 'full');
    toast('Pick a plant from the library, then tap the ground.');
  }
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
  const tFill=dnow();   // one tap, unbounded region: 'fill' in the debug HUD
  const seed=groundMat(sx,sy), lvl=elevationAt(sx,sy);
  /* BFS the 4-connected region sharing that ground material AND that level. It
     ignored height, so filling the lawn on top of a raised bed with soil flooded
     every lawn tile in the garden. A fill stops at a terrace's edge now, which
     is also what lets a terrace be refilled at a new height on its own. */
  const region=[], seen=new Set([sx+','+sy]), q=[[sx,sy]];
  while (q.length){
    const [x,y]=q.shift(); region.push([x,y]);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy, key=nx+','+ny;
      if (!onPlot(nx,ny) || seen.has(key)) continue;
      if (siteStructureAt(nx,ny) || isDoor(nx,ny)) continue;
      if (groundMat(nx,ny)!==seed || elevationAt(nx,ny)!==lvl) continue;
      seen.add(key); q.push([nx,ny]);
    }
  }
  let placed=0; const tiles=[];
  // a fill of shrubs spaces them, as a drag does (shrubAutoSpacing, commands.js)
  withUndo(()=>withShrubAutoSpacing(()=>{ region.forEach(([x,y])=>{ if (applyToolAt(x,y)){ placed++; tiles.push([x,y]); } }); }));
  if (placed){
    hapticFeedback('place');
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    const label = def ? def.name : game.tool==='path'?`${pathColor(game.pathColor).label} path`
      : game.tool==='water'?`${waterStyle(game.waterStyle).label} water`
      : isElevationTool(game.tool)?(game.tool==='raise'?'raised grade':game.tool==='lower'?'lowered grade':'level grade')
      : game.tool==='terrace' ? `a ${terraceHeightText(terraceDraft().h).toLowerCase()} terrace ${terraceFacingText(terraceDraft().w)}`
      : game.tool==='wall' ? wallLabel().toLowerCase()
      : game.tool==='edging' ? edgingLabel().toLowerCase()
      : game.tool==='lawn' ? lawnLabelFor(game.lawnStyle).toLowerCase()
      : `${bedStyle(game.bedStyle).label} bed`;
    const crowd=def ? gestureCrowdingNote(tiles) : '';
    toast(`Filled ${placed} tile${placed>1?'s':''} with ${label}.`+(crowd?' '+crowd:''),
      crowd?placementPolicy('shrubSpacing').toast:null);
  } else toast('Nothing here that fill can change.');
  dev('fill',tFill);
}
/* eyedropper: sample whatever is on the tapped tile (plant > bulb > fence/light/firepit/boulder > terrain)
   and arm it as the brush, dropping straight into Plant mode so the next tap
   paints with it. A shrub whose spread covers an otherwise EMPTY tile is
   picked too, so its visible edge samples it — but only once nothing on the
   tile itself answers, since bulbs, perennials and hardscape can all stand
   inside a shrub's spread (0.9.61). Terrain still ranks below it, as before. */
function pickAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return;
  const k=`${x},${y}`;
  const direct=game.plants[k];
  const b=game.bulbs[k], f=fenceAt(x,y), l=lightAt(x,y), fp=firepitAt(x,y), bo=boulderAt(x,y), pet=petAt(x,y), po=potAt(x,y), se=seatAt(x,y), orn=ornamentAt(x,y), wf=waterFeatureAt(x,y), sp=structureSupportAt(x,y), pgk=pergolaAt(x,y), building=buildingAt(x,y), terr=terrainAt(x,y);
  const onTile=(b&&!b.removed)||f||l||fp||bo||pet||po||se||orn||wf||sp||pgk||building;
  const sh=onTile ? null : shrubAt(x,y);
  const p=(direct&&!direct.removed)?direct:(sh&&sh.p);
  if (p && !p.removed){
    game.fillMode=false; game.trayCat=plantCategoryFor(p.s);
    setTool(p.s, p.v||null); buildToolTray();
    toast(`Picked ${plantDef(p.s,p.v).name}.`);
  } else if (b && !b.removed){
    game.fillMode=false; game.trayCat='bulbs';
    setTool(b.s, b.v||null); buildToolTray();
    toast(`Picked ${plantDef(b.s,b.v).name}.`);
  } else if (po){
    openToolPage('pot');
    game.potDraft=normalizePotDraft(po);
    setTool('pot', null); buildToolTray();
    toast(`Picked the ${potLabel(po)}.`);
  } else if (se){
    // its own sub-page, set BEFORE setTool like the fence's below: that is where
    // the picked piece, finish and facing are selected chips
    openToolPage('seat');
    game.seatDraft=normalizeSeatDraft(se);
    setTool('seat', null); buildToolTray();
    toast(`Picked the ${seatLabel(se)}.`);
  } else if (orn){
    openToolPage('ornament');
    game.ornamentDraft=normalizeOrnamentDraft(orn);
    setTool('ornament', null); buildToolTray();
    toast(`Picked the ${ornamentLabel(orn).toLowerCase()}.`);
  } else if (pet){
    openToolPage('pet');
    game.petDraft=normalizePetDraft(pet);
    setTool('pet', null); buildToolTray();
    toast(`Picked the ${petLabel(pet)}.`);
  } else if (f){
    /* Its own sub-page, like the fire pit and the boulder below: the picked
       material, height and gate are chips on that page, so landing anywhere
       else shows you nothing about what you just picked. Set BEFORE setTool --
       rememberBrushTool reads game.drill from inside it, and leaving a stale
       one there filed the fence brush under another tool's page, so the rail
       would restore it onto the wrong sub-page later. */
    openToolPage('fence');
    game.fenceDraft=normalizeFenceDraft(f);
    setTool('fence', null); buildToolTray();
    toast(`Picked ${fenceLabel(f)}.`);
  } else if (pgk){
    openToolPage('pergola');
    // the lights belong to the whole roof (pergolaRegions), so ask the roof
    game.pergolaDraft=normalizePergolaDraft(Object.assign({},pgk,{lights:pergolaLitAt(x,y)?'festoon':'none'}));
    setTool('pergola', null); buildToolTray();
    toast(`Picked ${pergolaLabel(pgk)}.`);
  } else if (l){
    openToolPage('light');
    game.lightDraft=normalizeLightDraft(l);
    setTool('light', null); buildToolTray();
    toast(`Picked ${lightLabel(l)}.`);
  } else if (sp){
    openToolPage('support');
    game.supportDraft=normalizeSupportDraft(sp);
    setTool('support', null); buildToolTray();
    toast(`Picked the ${supportLabel(sp).toLowerCase()}.`);
  } else if (wf){
    openToolPage('waterfeature');
    game.waterFeatureDraft=normalizeWaterFeatureDraft(wf);
    setTool('waterfeature', null); buildToolTray();
    toast(`Picked the ${waterFeatureLabel(wf).toLowerCase()}.`);
  } else if (fp){
    openToolPage('firepit');
    game.firepitDraft=normalizeFirepitDraft(fp);
    setTool('firepit', null); buildToolTray();
    toast(`Picked ${firepitLabel(fp)}.`);
  } else if (bo){
    openToolPage('boulder');
    game.boulderDraft=normalizeBoulderDraft(bo);
    setTool('boulder', null); buildToolTray();
    toast(`Picked ${boulderLabel(bo)}.`);
  } else if (building){
    game.fillMode=false; game.trayCat='house'; game.buildingStyleDraft=normalizeBuildingStyle(building);
    setTool('building',null); buildToolTray();
    toast(`Picked ${building.status==='proposed'?'proposed':'existing'} building footprint style.`);
  } else if (isSoftTile(x,y) && softComponentAt(x,y)){
    /* A berm or a swale: its height at the crown, the nearest the Berm tool lays,
       so another can be shaped to match; what is laid on it goes into that
       material's own choice, as a terrace's top does. */
    const c=softComponentAt(x,y), v=c.swale ? c.down : c.up;
    const h=BERM_LEVELS.reduce((b,l)=>Math.abs(l-v)<Math.abs(b-v)?l:b, BERM_LEVELS[0]);
    if (terr){
      if (terr.k==='path') game.pathColor=pathColorId(terr.c||game.pathColor);
      if (terr.k==='bed') game.bedStyle=bedStyleId(terr.c||game.bedStyle);
      if (terr.k==='lawn') game.lawnStyle=lawnStyleId(terr.c||game.lawnStyle);
    }
    game.bermDraft=normalizeBermDraft({h}); game.fillMode=false; game.trayCat='leveling';
    setTool('berm', null); buildToolTray();
    toast(`Picked ${bermLabel()}.`);
  } else if (isStepTile(x,y)){
    // a step: its riser, tread and the flight's width, into the Steps tool
    const f=stepFlightAt(x,y), h=elevationAt(x,y), t=terr&&terr.k==='path'?pathColorId(terr.c):null;
    const width=f.tiles.filter(([tx,ty])=>elevationAt(tx,ty)===h).length;
    game.stepDraft=normalizeStepDraft({w:wallStyleAt(x,y),tread:t||stepDraft().tread,width});
    game.fillMode=false; game.trayCat='leveling';
    setTool('steps', null); buildToolTray();
    toast(`Picked ${stepsLabel()}.`);
  } else if (TERRACE_LEVELS.includes(elevationAt(x,y))){
    /* A terrace or sunken patio: its height and its wall, into the Terrace tool,
       so a second one can be built to match. The eyedropper answered "Nothing
       here to pick" on one. A hollow's walls are on the ground round it. What
       the top is laid with goes into that material's own choice as well, so
       switching to it paints the same, though the terrace is what is armed. */
    const h=elevationAt(x,y), t=wallTargetAt(x,y);
    const w=h>0 ? wallStyleAt(x,y) : (t&&t.owners.length ? wallStyleAt(t.owners[0][0],t.owners[0][1]) : 'none');
    if (terr){
      if (terr.k==='path') game.pathColor=pathColorId(terr.c||game.pathColor);
      if (terr.k==='bed') game.bedStyle=bedStyleId(terr.c||game.bedStyle);
      if (terr.k==='lawn') game.lawnStyle=lawnStyleId(terr.c||game.lawnStyle);
    }
    // its top too, so a second one comes out the same; bare lawn is left as Keep
    // rather than changing the lawn choice under Ground to plain mown lawn
    const top=terr && (terr.k==='bed'||terr.k==='path'||terr.k==='lawn') ? terr.k : 'keep';
    game.terraceDraft=normalizeTerraceDraft({h,w,top}); game.wallDraft=wallStyleId(w);
    resetTerraceTouched();   // the panel now says what this terrace is: nothing is picked to change yet
    game.fillMode=false; game.trayCat='leveling';
    setTool('terrace', null); buildToolTray();
    toast(`Picked ${terraceLabel()}.`);
  } else if (crossingAt(x,y)){
    game.crossingDraft=crossingAt(x,y); game.waterStyle=waterStyleId(terr.c||game.waterStyle);
    game.fillMode=false; game.trayCat='landscape'; game.drill=null;
    setTool('crossing', null); buildToolTray();
    toast(`Picked ${lowerFirst(crossingLabel())}.`);
  } else if (terr){
    if (terr.k==='path') game.pathColor=pathColorId(terr.c||game.pathColor);
    if (terr.k==='water') game.waterStyle=waterStyleId(terr.c||game.waterStyle);
    if (terr.k==='bed') game.bedStyle=bedStyleId(terr.c||game.bedStyle);
    if (terr.k==='lawn') game.lawnStyle=lawnStyleId(terr.c||game.lawnStyle);
    game.fillMode=false; game.trayCat='landscape';
    setTool(terr.k, null); buildToolTray();
    toast(terr.k==='path'?`Picked ${pathColor(game.pathColor).label} path.`
      : terr.k==='water'?`Picked ${waterStyle(game.waterStyle).label} water.`
      : terr.k==='lawn'?`Picked ${lawnStyle(game.lawnStyle).label}.`
      : `Picked ${bedStyle(game.bedStyle).label} bed.`);
  } else toast('Nothing here to pick — tap a plant or material.');
}
/* The brush bar's pattern, placement and age toggles change what the NEXT tap
   does, not what is armed. With a plant already on the brush, which is the only
   time the bar shows them, they repaint the bar and the sheet's label ("· drift")
   and stop. They used to re-arm through armPlantToolFromRail, which rebuilt the
   whole catalog (drift, matrix and the rest are in trayStateSig), the sheet and
   the tool rail for a change only the brush bar shows: 24ms a tap on a desktop,
   34ms in the phone layout.
   Kept from the old path: a pattern choice means plain planting, so Fill goes
   off, and an open Layers/View menu closes. Dropped: re-selecting the armed
   plant's catalog category, which pulled the catalog away from wherever the
   gardener was browsing. With nothing armed they still go the long way,
   because then arming is the point. */
function applyBrushOption(){
  if (!PLANTS[game.tool]){ armPlantToolFromRail(false); return; }
  game.fillMode=false;
  renderCvRow();                       // brush bar + sheet label and swatch
  if (game.toolMenu){ game.toolMenu=null; refreshCanvasTools(); }
  updateCanvasCursor();
  tourRender();                        // the drift step anchors to a brush-bar chip renderCvRow just replaced
}
function choosePlantMode(drift){
  game.drift=!!drift; game.matrix=false;   // Draw/Drift and Matrix are exclusive patterns
  applyBrushOption();
  updateActiveToolStatus();
}
function chooseMatrixMode(){
  game.matrix=true; game.drift=false;
  applyBrushOption();
  updateActiveToolStatus();
}
function choosePlacementMode(free){
  game.freePlanting=!!free;
  applyBrushOption();
  updateActiveToolStatus();
}
function chooseWoodyAge(age){
  game.woodyAge=normalizeWoodyAge(age);
  applyBrushOption();
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
  // Select moved to the canvas rail (see buildCanvasTools) — it sets game.tool,
  // so it belongs with the other modal tools rather than beside Rotate and Layers.
  const rot=document.getElementById('btnRotateTool');
  if (rot){ rot.onclick=()=>rotateView(1);
    paintIconCanvasOnce(document.getElementById('btnRotateIcon'),'rotate'); }
  const lay=document.getElementById('btnLayersTool');
  if (lay){ lay.classList.toggle('sel',game.toolMenu==='layers'||layerViewActive());
    lay.setAttribute('aria-expanded',game.toolMenu==='layers'?'true':'false');
    lay.onclick=()=>toggleLayerMenu();
    paintIconCanvasOnce(document.getElementById('btnLayersIcon'),'layers'); }
  const view=document.getElementById('btnViewTools');
  if (view){ view.classList.toggle('sel',game.toolMenu==='view'||game.toolMenu==='layers'||game.tool==='select'||layerViewActive());
    // the menu test FIRST: visibleEl is a getComputedStyle, i.e. a style
    // recalc, and this runs on every refresh with the menu shut
    view.setAttribute('aria-expanded',(game.toolMenu==='view'||(game.toolMenu==='layers'&&!visibleEl(lay)))?'true':'false');
    view.onclick=()=>toggleViewToolsMenu();
    paintIconCanvasOnce(document.getElementById('btnViewToolsIcon'),'viewtools'); }
  syncSchemeChip();
  renderViewToolsMenu();
  renderLayerMenu();
  renderSchemeMenu();
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
/* The rail is BUILT ONCE and then kept in step. It was rebuilt wholesale on
   every refresh, and a refresh follows every tool change, every undo and redo,
   every Day/Night press and the end of every planting gesture (pushUndo ->
   updateUndoBtn): eight new 126x96 icon canvases (~390KB of backing store)
   and a dozen 3x icon repaints each time, for a column whose buttons never
   change, only their state does. The buttons now keep their identity, so a
   refresh is a handful of class and attribute writes. It is rebuilt when the
   theme changes (the icons are painted in its inks) or when the rail has been
   emptied under it. */
let railDom=null;
function railIntact(rail){
  if (!railDom || railDom.rail!==rail) return false;
  const h=railDom.byKind.hand;
  // an element that cannot say (no boolean isConnected: a test stub) is taken
  // at its word; a real one must still be connected, and in this rail
  return !!h && (typeof h.isConnected!=='boolean' || (h.isConnected && h.parentNode===rail));
}
function buildCanvasTools(){
  const rail=document.getElementById('canvasTools'); if (!rail) return;
  syncTopTools();
  const theme=(document.documentElement&&document.documentElement.getAttribute('data-theme'))||'';
  const fresh=!railIntact(rail) || railDom.theme!==theme;
  if (fresh){ rail.innerHTML=''; railDom={rail,theme,byKind:{}}; }
  const add=(label,kind,opts)=>{
    opts=opts||{};
    let b=railDom.byKind[kind];
    if (!b){ b=makeCanvasTool(label,kind,opts); railDom.byKind[kind]=b; rail.appendChild(b); }
    else syncCanvasTool(b,label,opts);
    return b;
  };
  const sep=()=>{ if (!fresh) return; const s=document.createElement('div'); s.className='canvas-sep'; rail.appendChild(s); };
  add('Hand','hand',{active:game.tool==='hand',tour:'hand',title:'Hand / safe select: drag the map to pan',
    onClick:()=>setTool('hand')});
  /* Select lives HERE, not in the top bar, because it is a tool in the only
     sense that matters to the canvas: it sets game.tool, and arming it disarms
     Plant/Erase/Pick. Up in the top bar it sat beside Rotate (a one-shot
     action) and Layers (a menu) — neither of which touches game.tool — so the
     one genuinely modal control in that group was the odd one out, and arming
     it silently un-highlighted the rail across the screen, which is the classic
     "why did my tool change" confusion. Every canvas editor this app is
     measured against puts select at the top of the one tool column.
     It sits after Hand rather than before it: entering a garden arms Hand
     deliberately, and Hand -> Select is least-destructive first. */
  add('Select','select',{active:game.tool==='select',title:'Select an area to move, copy, rotate or fill',
    onClick:()=>{ setTool('select'); game.toolMenu=null; buildToolTray(); }});
  /* Ruler is modal too (game.tool==='ruler'), so it followed Select down here.
     It sits next to Select rather than at the end: Hand/Select/Ruler are the
     three tools that never change the planting, and the adjacency says so
     without spending another 18px divider on a rail that already scrolls at
     390px tall. */
  add('Ruler','ruler',{active:game.tool==='ruler',title:'Tape measure: drag, or tap two points',
    onClick:()=>{ setTool('ruler'); game.toolMenu=null; }});
  add('Plant','brush',{active:isBrushTool(game.tool),tour:'plant',
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
  // (The view and layer menus are rendered by syncTopTools above; they were
  // rendered here a second time on every refresh.)
  renderSelectionActions();
  // re-pin a callout anchored into the rail: after a rebuild it points at a
  // detached node, and a state change can move what it rings
  tourRender();
}
function popButton(label,kind,sel,fn,title,extra){
  const b=document.createElement('button');
  b.setAttribute('role','menuitem');
  b.className=(sel?' sel':'')+(extra||'');
  b.title=title||label;
  if (kind){
    const c=document.createElement('canvas'); c.width=126; c.height=96;
    c.setAttribute('aria-hidden','true');
    paintIconCanvas(c,kind);
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
    fitPlot({ease:true}); game.toolMenu=null; refreshCanvasTools(); toast('Plot fitted to the available canvas.');
  },'Fit the whole plot in the clear canvas area'));
  pop.appendChild(popButton('Zoom out',null,false,()=>{ zoomStep(0.89); },'Zoom out'));
  pop.appendChild(popButton('Zoom in',null,false,()=>{ zoomStep(1.12); },'Zoom in'));
  // Select is not listed here: it moved to the canvas rail, which exists at
  // every breakpoint, and offering it in two places would make the rail's
  // armed state look wrong from the popover.
  pop.appendChild(popButton('Rotate','rotate',false,()=>{
    rotateView(1); game.toolMenu=null; refreshCanvasTools();
  },'Rotate view 90 degrees'));
  pop.appendChild(popButton('Layers','layers',layerViewActive(),()=>{
    game.toolMenu='layers'; refreshCanvasTools(); focusToolMenu('layerPop');
  },'Show or hide garden layers'));
  // Ruler, like Select, is a modal tool and lives on the canvas rail now.
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
  /* The buttons sit in a row of their own, so the pill's natural width is that
     row's. With the summary as a flex item beside them it was the two laid end to
     end, ~130px wider than anything it ever draws. */
  const row=document.createElement('div'); row.className='selection-buttons';
  const btn=(label,sel,fn,title,cls)=>{
    const b=document.createElement('button');
    b.className=(sel?'sel ':'')+(cls||'');
    b.textContent=label; b.title=title||label;
    b.onclick=e=>{ e.stopPropagation(); fn&&fn(); };
    row.appendChild(b);
    return b;
  };
  const est=selectionEstimate(game.sel,3,game.selItems);
  const summary=document.createElement('span'); summary.className='selection-summary';
  /* widthFt/heightFt are FEET on the estimate — the model side — so the pill
     formats them rather than the estimator pre-baking a unit into its result. */
  summary.textContent=`${fmtFeet(est.widthFt,1)} x ${fmtFeet(est.heightFt,1)} - ${fmtAreaSqFt(est.areaSqFt,0)}`;
  el.appendChild(summary);
  el.appendChild(row);
  /* The summary is the only text here that changes, so its width is the only
     thing a rebuild can do to the pill's size. refreshCanvasTools lands here on
     every tool change and undo, and none of those should force a layout to find
     that out. */
  if (el._summary!==summary.textContent){ el._summary=summary.textContent; el._size=null; el._sig=null; }
  /* Move and Duplicate are a MODE — what dragging the selection does — so they
     are one pressed/unpressed pair, set apart from the one-shot actions after
     them. They were styled like the actions beside them, and the second was
     called "Copy" while the real copy (to reuse an area elsewhere) sat under
     More as "Save area": two copies, neither named for what it does. */
  const mode=document.createElement('span'); mode.className='selection-mode';
  mode.setAttribute('role','group'); mode.setAttribute('aria-label','Dragging the selection will');
  row.appendChild(mode);
  const modeBtn=(label,id,title)=>{ const b=btn(label,game.selMode===id,()=>{ game.selMode=id; renderSelectionActions(); updateActiveToolStatus(); },title);
    b.setAttribute('aria-pressed',game.selMode===id?'true':'false'); mode.appendChild(b); };
  modeBtn('Move','move','Drag the selection to move it');
  modeBtn('Duplicate','copy','Drag the selection to place a duplicate; the original stays');
  btn('Fill',false,()=>fillSelectionWithPlant(),'Fill the selection with the last selected plant or landscape material');
  // Erase was the last row of More; it is the commonest thing done to a selection
  btn('Erase',false,()=>{ eraseSelection(); refreshCanvasTools(); },'Erase everything in the selection (Delete)','danger');
  const more=btn('More',false,null,'More selection actions');
  more.setAttribute('aria-haspopup','menu');
  more.onclick=e=>{ e.stopPropagation(); showSelectionMore(more); };
  el.classList.remove('hidden');
  positionSelectionActions();
}
function showSelectionMore(anchor){
  const old=document.getElementById('selectionMore'); if (old){ old.remove(); return; }
  const pop=document.createElement('div'); pop.id='selectionMore'; pop.className='selection-more'; pop.setAttribute('role','menu');
  const add=(label,fn,cls,disabled,title)=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=label; b.setAttribute('role','menuitem');
    if (cls) b.className=cls; b.disabled=!!disabled; if (title) b.title=title;
    b.onclick=e=>{ e.stopPropagation(); pop.remove(); fn&&fn(); };
    pop.appendChild(b);
  };
  add('Estimate materials\u2026',()=>openSelectionEstimate());
  add('Replace plants\u2026',()=>openSelectionReplace());
  add('Rotate 90 degrees',()=>{ rotateSelection(); renderSelectionActions(); refreshCanvasTools(); });
  add('Mark existing',()=>markSelection('existing'),null,false,'Mark everything in the selection as already there: hatched on the plan, left off the orders');
  add('Mark proposed',()=>markSelection('proposed'),null,false,'Mark everything in the selection as new work');
  // the clipboard, named as one (and on Ctrl/Cmd+C and V)
  add('Copy area',()=>saveSelectedArea(),null,false,'Copy everything in the selection to paste elsewhere (Ctrl+C)');
  add('Paste area',()=>pasteSavedArea(),null,!storedArea(),'Paste the copied area here (Ctrl+V)');
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), w=pop.offsetWidth||190, h=pop.offsetHeight;
  pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
  /* Above the button, unless that would run up over the top bar; a pill at the
     top of the canvas opens its menu downward instead. This is a fixed element
     measured in client px, and the clear rect is the canvas's, hence the frame. */
  const safe=usableCanvasRect(), barEdge=canvasViewportRect().top+(safe.clear||safe).top, above=r.top-h-6;
  pop.style.top=(above>=barEdge ? above : Math.max(barEdge,Math.min(innerHeight-h-8,r.bottom+6)))+'px';
  const dismiss=e=>{ if (!pop.contains(e.target)){ pop.remove(); document.removeEventListener('pointerdown',dismiss,true); } };
  setTimeout(()=>document.addEventListener('pointerdown',dismiss,true),0);
  const first=pop.querySelector('button:not(:disabled)'); if (first) first.focus();
}
function renderSelectionEstimate(){
  const depth=+(document.getElementById('estimateDepth')||{}).value||3;
  const est=selectionEstimate(game.sel,depth,game.selItems), body=document.getElementById('estimateBody');
  if (!est||!body) return;
  const row=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
  let html=row('Selected area',`Approx. ${fmtAreaSqFt(est.areaSqFt,0)}`);
  if (est.bedTiles){
    html+=row('Bed area',`Approx. ${fmtAreaSqFt(est.bedAreaSqFt,0)}`);
    html+=row('Exposed bed edge',`Approx. ${fmtFeet(est.edgeFt,1)}`);
    html+=row(`Mulch at ${fmtLengthIn(depth)}`,`Approx. ${fmtVolumeFit(est.mulchCuYd)}`);
    if (est.raisedTiles) html+=row('Raised bed soil',
      `Approx. ${est.soilCuYd<2 ? fmtVolumeBagCuYd(est.soilCuYd) : fmtVolumeCuYd(est.soilCuYd)}`);
    if (est.approxPlants) html+=row(`${est.armedName} at spacing`,`Approx. ${est.approxPlants} plants`);
  }
  if (est.plants||est.bulbs) html+=row('Already placed',`${est.plants} plants${est.bulbs?` + ${est.bulbs} bulbs`:''}`);
  if (!est.bedTiles) html+=row('Bed materials','No bed tiles in this selection');
  body.innerHTML=html;
  const v=document.getElementById('estimateDepthValue'); if (v) v.textContent=fmtLengthIn(depth);
}
function openSelectionEstimate(){
  if (!game.sel){ toast('Select an area first.'); return; }
  renderSelectionEstimate(); openOverlay('estimateScreen','#estimateDepth');
}
/* Where the selection pill goes: its top-left corner, in canvas px. Pure, so the
   rule can be tested without a layout engine.
   Above the marquee by choice, and flipped below it when that would leave the
   clear canvas. Where neither fits (a marquee taller than the room, or one panned
   away) it takes whichever end of the canvas hides less, or the nearer end if both
   hide nothing. It never leaves the top of the clear rect: a pill too tall for the
   room runs out over the sheet, where it costs a sliver of handle, rather than
   over the top bar, where it takes Menu. Null means no room to be a control at
   all: a full sheet, which is hiding the selection anyway. */
const SEL_PILL_GAP=12;        // clears the marquee's corner handle (radius ~7)
const SEL_PILL_MIN_ROOM=44;   // one row of touch targets
function selectionPillSpot(box,w,h,clear){
  if (!(clear.bottom-clear.top>=SEL_PILL_MIN_ROOM)) return null;
  const x=Math.max(clear.left,Math.min(clear.right-w,(box.left+box.right-w)/2));
  const top=clear.top, low=Math.max(top,clear.bottom-h);
  const above=box.top-SEL_PILL_GAP-h, below=box.bottom+SEL_PILL_GAP;
  let y;
  if (above>=top && above<=low) y=above;
  else if (below>=top && below<=low) y=below;
  else {
    const hides=t=>Math.max(0,Math.min(t+h,box.bottom)-Math.max(t,box.top));
    const atTop=hides(top), atLow=hides(low);
    y=atTop!==atLow ? (atTop<atLow?top:low)
      : box.top+box.bottom<top+low+h ? top : low;
  }
  return {x:Math.round(x), y:Math.round(y)};
}
function positionSelectionActions(){
  const el=document.getElementById('selectionActions');
  if (!el || el.classList.contains('hidden') || !game.sel) return;
  const r=game.sel, W=VW/ZOOM, H=VH/ZOOM;
  /* Called once per frame from render(). Nothing below can have moved unless the
     selection, the camera, the viewport or the chrome did, so answer that first —
     the write was already change-guarded, but the WORK to decide it was not.
     usableRectRev is the chrome: without it the pill stayed where it was when the
     sheet moved, right up to the next pan. */
  const sig=r.x0+','+r.y0+','+r.x1+','+r.y1+'|'+cam.x+','+cam.y+'|'+ZOOM+'|'+VW+'x'+VH+'|'+usableRectRev;
  if (el._sig===sig) return;
  el._sig=sig;
  const safe=usableCanvasRect(), clear=safe.clear||safe;
  /* Its size is read only when the chrome has moved or its text changed, never
     for a camera move: updateCompass has just dirtied the layout on those frames,
     and this runs for every one of them. The width is capped at the clear rect,
     so it wraps rather than sliding under the rail. */
  if (el._rev!==usableRectRev){ el._rev=usableRectRev; el._size=null; }
  if (!el._size){
    el.style.maxWidth=Math.max(0,Math.round(clear.right-clear.left))+'px';
    el._size={w:el.offsetWidth, h:el.offsetHeight};
  }
  /* The marquee as drawn, from the handles that sit on it: they ride the terraces
     and turn with the view, where the one edge midpoint this used to read was the
     far side of the selection at half the rotations. */
  let left=Infinity, right=-Infinity, up=Infinity, down=-Infinity;
  for (const p of selHandlePoints(r,W,H)){
    const px=p.x*ZOOM, py=p.y*ZOOM;
    if (px<left) left=px; if (px>right) right=px;
    if (py<up) up=py; if (py>down) down=py;
  }
  const spot=selectionPillSpot({left,right,top:up,bottom:down},el._size.w,el._size.h,clear);
  const vis=spot?'':'hidden';
  if (el._vis!==vis){ el._vis=vis; el.style.visibility=vis; }
  if (!spot || (el._px===spot.x && el._py===spot.y)) return;   // called per frame — write only on change
  el._px=spot.x; el._py=spot.y;
  el.style.left=spot.x+'px';
  el.style.top=spot.y+'px';
}
/* a small themed yes/no modal, built on the fly (matches the .screen panels).
   Returns nothing; calls onOk only if the user confirms. */
/* cancelLabel/onCancel are optional and default to the old behaviour ("Cancel",
   dismiss and do nothing), so every existing call site is untouched. The first-run
   welcome needs them because there declining is a real choice with its own words,
   not an escape hatch. */
function showConfirm(title, body, okLabel, onOk, cancelLabel, onCancel){
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
  scr.querySelector('[data-x]').textContent=cancelLabel||'Cancel';
  scr.querySelector('[data-ok]').textContent=okLabel||'OK';
  const close=()=>{ closeOverlay('confirmPop'); scr.remove(); };
  const cancel=()=>{ close(); onCancel&&onCancel(); };
  scr.querySelector('[data-x]').onclick=cancel;
  scr.querySelector('[data-ok]').onclick=()=>{ close(); onOk&&onOk(); };
  scr.addEventListener('click',e=>{ if (e.target===scr) cancel(); });
  document.body.appendChild(scr);
  openOverlay('confirmPop','[data-x]');
}
/* showConfirm with a text field. Same panel, same overlay/focus path, so a
   name prompt behaves like every other stop in the app rather than falling
   back to window.prompt (which the DOM stubs decline and iOS styles itself). */
function showPrompt(title, body, value, okLabel, onOk){
  const old=document.getElementById('confirmPop'); if (old) old.remove();
  const scr=document.createElement('div');
  scr.id='confirmPop'; scr.className='screen modal-screen hidden'; scr.setAttribute('role','dialog');
  scr.setAttribute('aria-modal','true'); scr.setAttribute('aria-labelledby','confirmPopTitle');
  scr.style.zIndex='60';
  scr.innerHTML='<div class="panel pause-panel" tabindex="-1"><h2 id="confirmPopTitle"></h2><p class="sub"></p>'+
    '<input id="promptPopField" type="text" maxlength="24" autocomplete="off" spellcheck="false">'+
    '<div class="row" style="margin-top:14px">'+
    '<button class="btn" data-x>Cancel</button><button class="btn primary" data-ok></button></div></div>';
  scr.querySelector('h2').textContent=title;
  scr.querySelector('p').textContent=body||'';
  const field=scr.querySelector('#promptPopField');
  field.value=value==null?'':String(value);
  scr.querySelector('[data-ok]').textContent=okLabel||'Save';
  const close=()=>{ closeOverlay('confirmPop'); scr.remove(); };
  const ok=()=>{ const v=field.value; close(); onOk&&onOk(v); };
  scr.querySelector('[data-x]').onclick=close;
  scr.querySelector('[data-ok]').onclick=ok;
  field.addEventListener('keydown',e=>{ if (e.key==='Enter'){ e.preventDefault(); ok(); } });
  scr.addEventListener('click',e=>{ if (e.target===scr) close(); });
  document.body.appendChild(scr);
  openOverlay('confirmPop','#promptPopField');
  if (field.select) field.select();
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
        else { game.actX=x; game.actY=y; actHere(); }
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
  syncUnitLabels();
  if (width && document.activeElement!==width) width.value=ftToDisplay(u.widthTiles*TILE_IN/12);
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
    input.placeholder=String(ftToDisplay(Math.hypot(point[0]-c.points[0][0],point[1]-c.points[0][1])*TILE_IN/12));
  }
  openOverlay('sitePhotoCalibrateScreen','#sitePhotoKnownDistance');
  return true;
}
function applySitePhotoCalibration(){
  const c=game.underlayCalibration, input=document.getElementById('sitePhotoKnownDistance');
  /* The field is in the gardener's unit; calibrateUnderlayDistance takes feet,
     and world.js stays free of any unit question. */
  const knownFt=input?displayToFt(input.value):NaN;
  const next=c&&c.points.length===2?calibrateUnderlayDistance(game.underlay,c.points[0],c.points[1],knownFt):null;
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
  if (game.inGarden) saveSolo(true).then(ok=>{ if (commit&&ok===false) toast('The site photo could not be saved - device storage is full.','warn'); });
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
    game.layerVis.moisture || game.layerVis.height || game.layerVis.matureCanopies || game.layerVis.edgeRulers || game.layerVis.existing ||
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
// a fixed dropdown (same idea as the garden/time menus) and re-render it whenever
// the rail refreshes — its rows call refreshCanvasTools() to re-render.
/* The re-render keeps the ELEMENT and swaps its rows. It used to remove the
   popover and append a fresh one, and every row click goes through here, so
   toggling an overlay near the bottom of the list threw the reader back to the
   top of it (a new element has scrollTop 0), dropped keyboard focus onto the
   body, and replayed the popoverEnter animation as a flicker on every click.
   Now the scroll offset carries over and focus returns to the row it was on,
   found by its label rather than its index so a row appearing or disappearing
   (Add/Edit site photo) cannot move it onto a neighbour. */
function renderLayerMenu(){
  const old=document.getElementById('layerPop');
  // shut: nothing to measure (visibleEl is a getComputedStyle, and this runs on
  // every refresh of the chrome)
  if (game.toolMenu!=='layers'){ if (old) old.remove(); return; }
  const btn = visibleEl(document.getElementById('btnLayersTool'))
    ? document.getElementById('btnLayersTool')
    : document.getElementById('btnViewTools');
  if (!btn){ if (old) old.remove(); return; }
  const viewPop=document.getElementById('viewToolsPop'); if (viewPop) viewPop.remove();
  const fresh=buildLayerPopover();
  if (old && old.isConnected!==false){
    const scroll=old.scrollTop;
    const active=document.activeElement;
    const focusKey=active && old.contains(active) && active.dataset ? active.dataset.layerRow : null;
    old.replaceChildren(...fresh.childNodes);
    placeLayerMenu(old,btn);
    old.scrollTop=scroll;
    if (focusKey){
      const again=[...old.querySelectorAll('button')].find(b=>b.dataset && b.dataset.layerRow===focusKey);
      if (again) again.focus({preventScroll:true});
    }
    return;
  }
  if (old) old.remove();
  const pop=fresh; pop.id='layerPop';
  pop.setAttribute('aria-label','Garden layers and overlays');
  pop.style.position='fixed'; pop.style.zIndex='40';
  pop.style.bottom='auto'; pop.style.right='auto';
  document.body.appendChild(pop);
  placeLayerMenu(pop,btn);
}
/* Pinned under its button and allowed the whole height below it. The CSS cap
   (min(54vh,330px)) was sized for a phone and applied everywhere, so at
   1440x900 a thirteen-row menu scrolled inside a 330px box with most of the
   screen empty beneath it — and the scrollbar that forced then took enough
   width to push "Landscape/Hardscape" into a horizontal scroll as well. */
function placeLayerMenu(pop,btn){
  const r=btn.getBoundingClientRect(), w=pop.offsetWidth||214;
  let left=Math.min(Math.round(r.left), innerWidth-w-8); left=Math.max(8,left);
  const top=Math.round(r.bottom+6);
  pop.style.top=top+'px';
  pop.style.left=left+'px';
  pop.style.maxHeight=Math.max(160,innerHeight-top-12)+'px';
}
/* ---------- the planting-scheme chip ----------
   Comparison is the whole point, so the switch has to be one tap while you are
   looking at the garden — but .hud-top is already tight enough that the season
   box flex-shrinks to fit a 360px phone. So the chip does not exist at all
   until a garden has a second scheme: single-scheme gardens (every existing
   one) keep the top bar unchanged. */
function syncSchemeChip(){
  const chip=document.getElementById('schemeChip'); if (!chip) return;
  const show=multiScheme();
  chip.classList.toggle('hidden',!show);
  if (!show){ if (game.toolMenu==='schemes') game.toolMenu=null; return; }
  hudText('schemeChipName',activeSchemeName());
  hudText('schemeChipCount',(activeSchemeIndex()+1)+'/'+schemeCount());
  chip.classList.toggle('sel',game.toolMenu==='schemes');
  chip.setAttribute('aria-expanded',game.toolMenu==='schemes'?'true':'false');
  chip.title=`Planting scheme: ${activeSchemeName()} — tap to switch ([ and ])`;
  chip.onclick=()=>toggleSchemeMenu();
}
function toggleSchemeMenu(){
  const opening=game.toolMenu!=='schemes';
  game.toolMenu = opening ? 'schemes' : null;
  refreshCanvasTools();
  if (opening) focusToolMenu('schemePop');
}
function renderSchemeMenu(){
  const old=document.getElementById('schemePop'); if (old) old.remove();
  const btn=document.getElementById('schemeChip');
  if (game.toolMenu!=='schemes' || !visibleEl(btn)) return;
  const pop=document.createElement('div');
  pop.id='schemePop'; pop.className='tool-popover scheme-popover';
  pop.setAttribute('role','menu'); pop.setAttribute('aria-label','Planting schemes');
  schemeList().forEach((s,i)=>{
    const on=s.id===game.schemeActive;
    const b=document.createElement('button');
    b.setAttribute('role','menuitemradio'); b.setAttribute('aria-checked',on?'true':'false');
    b.className='layer-row'+(on?' sel':'');
    b.title=on?`${s.name} is showing`:`Switch to ${s.name}`;
    const mark=document.createElement('span'); mark.className='scheme-mark'; mark.textContent=String(i+1);
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=s.name;
    b.append(mark,nm);
    b.onclick=ev=>{ ev.stopPropagation(); game.toolMenu=null; switchScheme(s.id); refreshCanvasTools(); };
    pop.appendChild(b);
  });
  const sep=document.createElement('div'); sep.className='layer-section'; sep.setAttribute('role','presentation');
  sep.textContent='Manage'; pop.appendChild(sep);
  const man=document.createElement('button');
  man.setAttribute('role','menuitem'); man.className='layer-row';
  man.textContent='Planting schemes…'; man.title='Add, rename, or delete planting schemes';
  man.onclick=ev=>{ ev.stopPropagation(); game.toolMenu=null; refreshCanvasTools(); openSchemeManager(); };
  pop.appendChild(man);
  pop.style.position='fixed'; pop.style.zIndex='40';
  pop.style.bottom='auto'; pop.style.right='auto';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(), w=pop.offsetWidth||186;
  let left=Math.min(Math.round(r.left), innerWidth-w-8); left=Math.max(8,left);
  pop.style.top=Math.round(r.bottom+6)+'px';
  pop.style.left=left+'px';
}
function layerDefsAllShown(){ return LAYER_DEFS.every(([key])=>layerShown(key)); }
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
    tc.strokeStyle=on?uiInk('--icon-ink'):uiInk('--icon-ink-dim');
    tc.fillStyle=on?'rgba(201,127,63,.34)':'rgba(239,230,211,.05)';
    tc.lineWidth=1.7; tc.lineCap='round'; tc.lineJoin='round';
    tc.beginPath();
    tc.moveTo(3,9); tc.quadraticCurveTo(12,2.5,21,9); tc.quadraticCurveTo(12,15.5,3,9);
    tc.fill(); tc.stroke();
    tc.beginPath(); tc.arc(12,9,on?3.1:2.2,0,7); tc.fillStyle=on?'#c97f3f':uiInk('--icon-ink-dim'); tc.fill();
    if (!on){ tc.strokeStyle=uiInk('--icon-ink-dim'); tc.lineWidth=2; tc.beginPath(); tc.moveTo(5,15); tc.lineTo(19,3); tc.stroke(); }
    return c;
  };
  // one row = a visibility toggle. The whole row (eye + label) flips it;
  // the row mutes when off and stays put so it can be turned back on.
  // No toast: the row itself changes under the pointer and the garden changes
  // beside it, so "Shade Overlay shown." was a third copy of the same news.
  const row=(get,set,label)=>{
    const on=get();
    const b=document.createElement('button');
    b.setAttribute('role','menuitemcheckbox'); b.setAttribute('aria-checked',on?'true':'false');
    b.className='layer-row'+(on?'':' off');
    b.dataset.layerRow=label;
    b.title=(on?'Hide ':'Show ')+label;
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eyeIcon(on),nm);
    b.onclick=ev=>{ ev.stopPropagation(); set(!on); refreshCanvasTools(); };
    pop.appendChild(b);
  };
  const focusRow=(key,label)=>{
    const on=game.layerFocus===key;
    const b=document.createElement('button');
    b.setAttribute('role','menuitemradio'); b.setAttribute('aria-checked',on?'true':'false');
    b.className='layer-row'+(on?' sel':'');
    b.dataset.layerRow='edit:'+key;
    b.title=`Edit ${label}`;
    const eye=document.createElement('span'); eye.className='layer-eye'; eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); game.layerFocus=key; refreshCanvasTools();
      toast(key==='all'?'Editing all visible layers.':`Editing ${label} only.`); };
    pop.appendChild(b);
  };
  section('Visible');
  /* "All" answers for the section it sits in: every LAYER drawn. It used to
     also require every overlay to be off, and switched them off when pressed,
     so turning on the shade map un-selected "All" while every layer was still
     showing — the row said something was hidden when nothing was — and pressing
     it to get a layer back took the overlay you were reading away with it.
     Overlays have their own rows below and are left alone. */
  const allVisible=()=>layerDefsAllShown();
  const allRow=document.createElement('button');
  allRow.setAttribute('role','menuitemradio'); allRow.setAttribute('aria-checked',allVisible()?'true':'false');
  allRow.className='layer-row'+(allVisible()?' sel':'');
  allRow.dataset.layerRow='All';
  allRow.title='Show every layer';
  const allName=document.createElement('span'); allName.className='layer-name'; allName.textContent='All';
  allRow.append(eyeIcon(allVisible()),allName);
  allRow.onclick=ev=>{ ev.stopPropagation();
    LAYER_DEFS.forEach(([key])=>{ setLayerVis(key,true,false); });
    persistLayerVis();
    refreshCanvasTools(); };
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
  row(()=>!!game.layerVis.existing, v=>{ setLayerVis('existing',v); }, 'Existing (hatched)');
  section('Reference');
  if (game.underlay){
    row(()=>!!game.underlay.visible, v=>{ game.underlay.visible=v; markUnderlayChanged(); if (game.inGarden) saveSolo(true); }, 'Site Photo');
    const edit=document.createElement('button'); edit.className='layer-row'; edit.setAttribute('role','menuitem'); edit.dataset.layerRow='editPhoto';
    const mark=document.createElement('span'); mark.className='layer-eye'; mark.textContent='+';
    const label=document.createElement('span'); label.className='layer-name'; label.textContent='Edit site photo\u2026'; edit.append(mark,label);
    edit.onclick=ev=>{ ev.stopPropagation(); game.toolMenu=null; beginSitePhotoEdit(); refreshCanvasTools(); }; pop.appendChild(edit);
  } else {
    const add=document.createElement('button'); add.className='layer-row'; add.setAttribute('role','menuitem'); add.dataset.layerRow='addPhoto';
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
  let hay=[k,P.name,P.latin,(P.synonyms||[]).join(' '),P.group||'',P.chip||'',roleSummary(k,12),trayCatLabel(plantCategoryFor(k))].join(' ');
  for (const v in (P.cv||{})){
    const C=P.cv[v];
    hay+=' '+v+' '+(C.name||'')+' '+(C.latin||'');
  }
  if (P.group) PLANT_KEYS.forEach(k2=>{ const G=PLANTS[k2];
    if (G && G.group===P.group) hay+=' '+G.name+' '+G.latin+' '+(G.chip||'')+' '+roleSummary(k2,12);
  });
  return hay.toLowerCase();
}
/* Per-tool search metadata. The LIST of tools is NOT written here — it is
   derived from TRAY_CATS below, which is the same lesson brushTrayCatForTool
   was already rewritten for (see its comment): the table is the fact, and a
   hand-kept restatement of it silently misses whatever is added next. This one
   had missed six — edging, wall, seat, pot, pet and building-edit — so typing
   "bench", "planter", "edging", "retaining wall" or "cat" into the Landscape
   search, the one control that promises to find things, answered "No landscape
   tools match" for tools that were sitting two taps away. */
const TOOL_SEARCH={
  lawn:   {label:'Lawn',kind:'fill',   hay:'lawn grass turf mown mow meadow long grass rough wildflower clover eco no-mow fescue moss thyme chamomile tapestry artificial synthetic astroturf ground landscape'},
  path:   {label:'Path',kind:'fill',   hay:'path paths walkway gravel limestone slate charcoal red clay hardscape landscape'},
  bed:    {label:'Bed',kind:'fill',    hay:'bed beds soil gravel rock river rock leaf litter mulch bark pine straw pea gravel planting area landscape'},
  water:  {label:'Water',kind:'fill',  hay:'water pond river lake stream creek wet formal pool reflecting canal rill landscape'},
  survey: {label:'Existing or proposed',kind:'brush',drill:null,hay:'existing proposed survey site keep keeping retain remain already there mark hatch'},
  crossing:{label:'Crossing',kind:'fill',hay:'crossing cross bridge footbridge plank boardwalk slab stepping stones over water pond stream creek ground'},
  edging: {label:'Edging',kind:'fill', hay:'edging edge restraint mowing strip mow strip lawn border spade cut steel corten aluminium brick setts soldier course sawtooth dogtooth rope-top victorian tile fieldstone stone concrete timber log roll willow wattle ground'},
  berm:   {label:'Berm or swale',kind:'layers',hay:'berm berms mound mounds hill hillock knoll earth soil swale swales rain garden bioswale ditch hollow dip depression soft slope bank grade leveling'},
  raise:  {label:'Raise',kind:'layers',hay:'raise elevation grade berm mound terrace hill leveling'},
  lower:  {label:'Lower',kind:'layers',hay:'lower elevation grade swale basin depression leveling'},
  level:  {label:'Level',kind:'layers',hay:'level elevation grade flatten reset leveling'},
  terrace:{label:'Terrace / raised bed',kind:'layers',
           hay:'terrace raised bed planter retaining wall sunken patio hollow step level change sleeper timber brick stone dry stone gabion corten concrete bank grade leveling'},
  steps:  {label:'Steps',kind:'layers',
           hay:'steps step stairs stair staircase flight tread treads riser risers nosing access terrace patio sunken raised bed grade leveling'},
  wall:   {label:'Retaining wall',kind:'layers',
           hay:'wall retaining wall terrace bank sleeper gabion drystone dry stone facing grade leveling'},
  fence:  {label:'Fence / Gate',kind:'layers',drill:'fence',
           hay:'fence gate door arbor screen privacy deer hardscape structures black aluminum wood vinyl chainlink brick stone 4 foot 6 foot'},
  firepit:{label:'Fire pit',kind:'fill',drill:'firepit',
           hay:'fire pit firepit fire ring fire bowl hardscape structure round square rectangle 24 36 48 patio '+
               'stacked stone brick block concrete steel metal corten stainless cast iron copper'},
  pergola:{label:'Pergola',kind:'fill',drill:'pergola',
           hay:'pergola arbor arbour overhead roof shade structure rafters beams posts patio hardscape climber festoon string lights bistro lights fairy lights café lights'},
  support:{label:'Support / Trellis',kind:'fill',drill:'support',
           hay:'support trellis lattice obelisk tuteur arch arbor fan wire espalier wigwam teepee tepee pillar post climber vine frame vertical hardscape structures willow timber metal bamboo painted corten'},
  waterfeature:{label:'Water feature',kind:'fill',drill:'waterfeature',
           hay:'water feature fountain birdbath bird bath bubbler bubbling urn millstone tiered tsukubai stone basin wall spout trough stock tank reflecting pool rill hardscape focal point'},
  boulder:{label:'Boulder',kind:'fill',drill:'boulder',
           hay:'boulder rock stone rocks hardscape rockery outcrop round rounded small medium large rectangular oblong long angular ledge slab sitting standing stone monolith grouping cluster basalt columns dressed block granite limestone sandstone slate fieldstone moss rock river rock'},
  seat:   {label:'Seating',kind:'fill',drill:'seat',
           hay:'seat seating bench chair table stool dining bistro picnic adirondack lounger sun lounger sit hardscape furniture teak weathered white painted green forest black metal stone concrete'},
  light:  {label:'Lighting',kind:'dropper',drill:'light',
           hay:'lighting lights path light lantern post outdoor lamp eco amber wildlife warm white cool bright night bollard shepherd hook torch tiki flame uplight step'},
  pot:    {label:'Container',kind:'fill',drill:'pot',
           hay:'pot pots container containers planter urn trough terracotta glazed cast stone timber galvanised patio courtyard balcony terrace decor colour color charcoal black white cream blue green teal cobalt copper corten'},
  ornament:{label:'Garden ornament',kind:'fill',drill:'ornament',
           hay:'ornament ornaments decor sculpture statue focal point sphere ball orb armillary sundial gazing ball stone lantern japanese toro wildlife bird feeder birdhouse nest box bee hotel insect hotel bug hotel pollinator rain barrel water butt compost bin bay'},
  pet:    {label:'Garden pet',kind:'fill',drill:'pet',
           hay:'pet pets cat dog animal ornament decor coat marking socks paws'},
  building:{label:'Building footprint',kind:'building',
           hay:'building footprint house site exterior outline existing proposed shed garage area edge'},
  house:  {label:'House',kind:'brush',hay:'house home building wall roof size color site'}
};
function searchToolItems(){
  const out=[];
  // TRAY_CATS holds the plant categories too; those carry `types`, not `tools`
  TRAY_CATS.filter(c=>c.tools).forEach(c=>c.tools.forEach(tool=>{
    const m=TOOL_SEARCH[tool]||{};
    out.push({cat:c.id, tool,
      label:m.label||cap(tool), kind:m.kind||'fill', drill:m.drill,
      // the category label rides along so "grade"/"features" find their tools, and
      // its `hay` so the old names ("hardscape", "decor") still do
      hay:((m.hay||tool)+' '+tool+' '+c.label+' '+(c.hay||'')+' '+(m.label||'')).toLowerCase()});
  }));
  return out;
}
/* Per-OPTION results: every material and fixture row is findable by its own
   name, derived from the tables that define it (U01). TOOL_SEARCH above finds a
   tool by its vocabulary; it cannot find "deck", "composite", "stepping",
   "uplight" or "step light", because those are rows in PATH_COLORS,
   LAWN_STYLES and LIGHT_TYPES rather than tools, and a hand-kept word list
   misses every row added after it was written. A source names the tool, the
   table, the draft the row is armed into and how — so a new row is searchable
   the moment it exists, and clicking the result arms THAT material or fixture
   rather than only opening its tool. `field` null means the draft is the bare
   id (the terrain kinds, edging, wall); otherwise it is a key on a draft object
   that `norm` normalises, the same normaliser the eyedropper uses. */
function searchFinishLabels(table,ids){
  return (ids||[]).map(id=>(table.find(f=>f.id===id)||{}).label||'').join(' ');
}
const SEARCH_OPTION_SOURCES=[
  {tool:'lawn',  rows:()=>LAWN_STYLES,  draft:'lawnStyle',  norm:id=>lawnStyleId(id)},
  {tool:'path',  rows:()=>PATH_COLORS,  draft:'pathColor',  norm:id=>pathColorId(id), groups:()=>PATH_GROUPS},
  {tool:'bed',   rows:()=>BED_STYLES,   draft:'bedStyle',   norm:id=>bedStyleId(id),  groups:()=>BED_GROUPS},
  {tool:'water', rows:()=>WATER_STYLES, draft:'waterStyle', norm:id=>waterStyleId(id)},
  {tool:'crossing',rows:()=>CROSSING_TYPES.filter(c=>c.id!=='none'),draft:'crossingDraft',norm:id=>crossingTypeId(id),
   extra:()=>'bridge over water', icon:(tc,d)=>drawMaterialIcon(tc,24,22,18,13,'crossing',d)},
  {tool:'edging',rows:()=>EDGING_STYLES,draft:'edgingDraft',norm:id=>edgingStyleId(id)},
  {tool:'wall',  rows:()=>WALL_STYLES,  draft:'wallDraft',  norm:id=>wallStyleId(id)},
  {tool:'fence', rows:()=>FENCE_STYLES, draft:'fenceDraft', field:'style', norm:d=>normalizeFenceDraft(d)},
  {tool:'pergola',rows:()=>PERGOLA_MATERIALS,draft:'pergolaDraft',field:'mat',norm:d=>normalizePergolaDraft(d),
   label:r=>r.label+' pergola', icon:(tc,d)=>drawPergolaChip(tc,d,48,44)},
  {tool:'support',rows:()=>SUPPORT_STYLES,draft:'supportDraft',field:'style',norm:d=>normalizeSupportDraft(d),
   label:r=>cap(r.family ? supportSizeText(r)+' '+lowerFirst(r.label) : r.label),
   extra:r=>searchFinishLabels(SUPPORT_MATERIALS,r.materials)+' climbing frame', icon:(tc,d)=>drawSupportChip(tc,d,48,44)},
  {tool:'firepit',rows:()=>FIREPIT_STYLES,draft:'firepitDraft',field:'style',norm:d=>normalizeFirepitDraft(d),
   label:r=>r.label+' fire pit', extra:r=>searchFinishLabels(FIREPIT_FINISHES,r.finishes),
   icon:(tc,d)=>drawFirepitChip(tc,d,48,44)},
  {tool:'waterfeature',rows:()=>WATER_FEATURES,draft:'waterFeatureDraft',field:'form',norm:d=>normalizeWaterFeatureDraft(d),
   extra:r=>searchFinishLabels(WATER_FINISHES,r.finishes)},
  // a boulder's FORM is what a gardener names; arming one takes its first size
  {tool:'boulder',rows:()=>BOULDER_FORMS,draft:'boulderDraft',field:'type',norm:d=>normalizeBoulderDraft(d),
   value:r=>(boulderFormTypes(r.id)[0]||BOULDER_TYPES[0]).id,
   on:(d,r)=>boulderType(d.type).form===r.id,
   label:r=>r.label+' boulder', extra:r=>searchFinishLabels(BOULDER_STONES,r.stones)+' rock stone',
   icon:(tc,d)=>drawBoulderChip(tc,d,48,44)},
  // "4 ft garden bench": the two benches share a label and differ by their size
  {tool:'seat', rows:()=>SEAT_TYPES,  draft:'seatDraft', field:'type', norm:d=>normalizeSeatDraft(d),
   label:r=>cap(seatTypeName(r.id)),
   extra:r=>searchFinishLabels(SEAT_FINISHES,r.finishes), icon:(tc,d)=>drawSeatChip(tc,d,48,44)},
  {tool:'light',rows:()=>LIGHT_TYPES, draft:'lightDraft',field:'type', norm:d=>normalizeLightDraft(d),
   extra:r=>searchFinishLabels(LIGHT_FINISHES,r.finishes)},
  {tool:'pot',  rows:()=>POT_STYLES,  draft:'potDraft',  field:'style',norm:d=>normalizePotDraft(d),
   extra:r=>(r.natural||'')+' '+searchFinishLabels(POT_FINISHES,r.finishes)+' pot container planter'},
  {tool:'ornament',rows:()=>ORNAMENTS,draft:'ornamentDraft',field:'kind',norm:d=>normalizeOrnamentDraft(d),
   extra:r=>searchFinishLabels(ORNAMENT_FINISHES,r.finishes)+' ornament decor '+ornamentGroup(r.group).label,
   icon:(tc,d)=>drawOrnamentChip(tc,d,48,44)},
  {tool:'pet',  rows:()=>PET_SPECIES, draft:'petDraft',  field:'species',norm:d=>normalizePetDraft(d)}
];
/* Tools no tab lists, so neither TRAY_CATS nor the index above can reach them.
   Edit footprint is armed from the Site tab's own button. */
const SEARCH_EXTRA_TOOLS=[
  {cat:'house', tool:'building-edit', label:'Edit footprint', kind:'building',
   hay:'edit footprint reshape trim add remove rename building house shed garage outline site'}
];
function searchOptionItems(){
  const out=[];
  SEARCH_OPTION_SOURCES.forEach(src=>{
    const cat=brushTrayCatForTool(src.tool), meta=TOOL_SEARCH[src.tool]||{};
    const groups=src.groups ? new Map(src.groups()) : null;
    src.rows().forEach(r=>{
      const value=src.value ? src.value(r) : r.id;
      const draftFor=()=>src.field
        ? src.norm(Object.assign({},game[src.draft]||{},{[src.field]:value}))
        : src.norm(value);
      const label=src.label ? src.label(r) : r.label;
      out.push({cat, tool:src.tool, option:r.id, label, kind:meta.kind||'fill', drill:meta.drill,
        hay:[label,r.label,r.short||'',r.id,groups&&groups.get(r.group)||'',src.extra?src.extra(r):'',
          meta.label||src.tool].join(' ').toLowerCase(),
        draftFor,
        arm:()=>{ game[src.draft]=draftFor(); },
        on:()=>{ if (game.tool!==src.tool) return false;
          const d=src.norm(game[src.draft]);
          return src.on ? src.on(d,r) : (src.field ? d[src.field]===value : d===value); },
        icon:isTerrainKind(src.tool) ? (tc=>drawMaterialIcon(tc,24,22,18,13,src.tool,r.id))
          : src.icon ? (tc=>src.icon(tc,draftFor())) : null});
    });
  });
  return out;
}
/* A query matches when every word in it is somewhere in the item's text, so
   "corten fire" and "grey gravel" find their rows without the words having to
   sit next to each other in the hay. */
function searchHayMatches(hay,label,q){
  if (hay.includes(q)||label.toLowerCase().includes(q)) return true;
  const words=q.split(/\s+/).filter(Boolean);
  return words.length>1 && words.every(w=>hay.includes(w)||label.toLowerCase().includes(w));
}
function landscapeSearchItems(query){
  const q=String(query||'').toLowerCase().trim();
  if (!q) return [];
  const extras=SEARCH_EXTRA_TOOLS.map(e=>Object.assign({},e,{hay:(e.hay+' '+e.label).toLowerCase()}));
  const opts=searchOptionItems();
  const out=[];
  // each tool, then the rows of it that match, so a result list reads by tool
  searchToolItems().concat(extras).forEach(item=>{
    if (searchHayMatches(item.hay,item.label,q)) out.push(item);
    opts.forEach(o=>{ if (o.tool===item.tool && searchHayMatches(o.hay,o.label,q)) out.push(o); });
  });
  return out;
}
function drawSearchToolIcon(tc,item){
  tc.clearRect(0,0,48,44);
  if (item.icon){ item.icon(tc); return; }      // an option draws as the material or piece it arms
  if (isTerrainKind(item.tool)){
    drawMaterialIcon(tc,24,22,18,13,item.tool,terrainDraftId(item.tool));
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
    game.trayCat=catId; game.searchOpen=false; game.traySearch='';
    game.drill=(P.group||P.cv) ? k : null;
    setTool(k,null);
    buildToolTray();
  };
  tray.appendChild(b);
}
function renderSearchToolButton(tray,item){
  const b=document.createElement('button');
  const sel=item.on ? item.on() : game.tool===item.tool;
  b.className='tool'+(sel?' sel':'')+(item.drill?' has-sub':'');
  b.dataset.k=item.tool;
  if (item.option) b.dataset.option=item.option;
  const toolLabel=(TOOL_SEARCH[item.tool]||{}).label;
  b.title=item.option&&toolLabel ? `${item.label} - ${toolLabel}, ${trayCatLabel(item.cat)}` : `${item.label} - ${trayCatLabel(item.cat)}`;
  const c=document.createElement('canvas'); c.width=48; c.height=44;
  drawSearchToolIcon(c.getContext('2d'),item);
  const sp=document.createElement('span'); sp.textContent=item.label;
  b.append(c,sp);
  b.onclick=()=>{
    saveTrayScroll();
    game.trayCat=item.cat; game.searchOpen=false; game.traySearch='';
    game.drill=item.drill||null;
    if (item.arm) item.arm();                  // the row itself, not just its tool
    setTool(item.tool,null);
    buildToolTray();
  };
  tray.appendChild(b);
}
function renderLandscapeSearchTray(tray,query){
  const items=landscapeSearchItems(query), status=document.createElement('div');
  status.className='landscape-search-summary'; status.setAttribute('role','status');
  status.textContent=`${items.length} landscape result${items.length===1?'':'s'} found`;
  tray.appendChild(status);
  if (!items.length){
    const empty=document.createElement('div'); empty.className='tray-empty landscape-search-empty';
    empty.textContent=`Nothing in the landscape library matches "${String(query||'').trim()}".`;
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
let discoverySearchTimer=0, landscapeSearchTimer=0, discoveryCriteriaDraft=null, palettePendingRef=null, paletteRenameId=null, sourceMenuOpen=false, sourceMenuCloseListener=null;
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
// '' when nothing in the group blooms; the caller swaps in the foliage copy.
function discoveryGroupBloomText(group){
  const months=[...new Set(group.refs.flatMap(ref=>{ const P=refDef(ref); return P?bloomMonthsFor(P):[]; }))].sort((a,b)=>a-b);
  if (!months.length) return '';
  const labels=CAL_MONTH_LABELS||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months.length===1?labels[months[0]-1]:`${labels[months[0]-1]}\u2013${labels[months[months.length-1]-1]}`;
}
function discoveryGroupFamilies(group,d){
  const out=[];
  group.refs.forEach(ref=>{ const family=resultFlowerFamily(ref,d); if (family&&!out.includes(family)) out.push(family); });
  return out.slice(0,3);
}
/* A plant with no recorded bloom used to render "Blooms No bloom time recorded"
   plus twelve empty bars — a quarter of the catalog looked like a data failure.
   Return null instead and let the caller skip the row entirely. */
function discoveryBloomTimeline(P){
  const active=new Set(bloomMonthsFor(P));
  if (!active.size) return null;
  const line=document.createElement('span'); line.className='plant-bloom-timeline'; line.setAttribute('aria-hidden','true');
  for (let month=1;month<=12;month++){
    const tick=document.createElement('i'); if (active.has(month)) tick.className='on'; line.appendChild(tick);
  }
  return line;
}
// "Blooms Jun–Aug" when there is a bloom, "Grown for foliage" when there isn't.
function discoveryBloomLabel(P){
  return bloomMonthsFor(P).length ? `Blooms ${bloomRangeText(P)}` : 'Grown for foliage';
}
function discoverySiteMeta(P){
  const meta=document.createElement('span'); meta.className='plant-site-meta';
  const sun=P.sun==='full'?'Full sun':P.sun==='part'?'Part shade':'Shade';
  const moisture=P.wades?'Pond margin':P.type==='water'?(P.marginal?'Pond margin':'Open water')
    :P.moist==='dry'?'Low water':P.moist==='moist'?'Moist':'Average water';
  const size=typeof matureSizeText==='function'?matureSizeText(P):'';
  meta.textContent=[sun,moisture].filter(Boolean).join(' \u00b7 ');
  /* The size gets its own span so a card that lets this line WRAP (the variant
     card does) breaks before it rather than inside it — "10 ft H x / 15 ft W"
     is not a measurement anyone can read. */
  if (size){ const s=document.createElement('span'); s.className='plant-site-size'; s.textContent=size;
    meta.append(meta.textContent?' \u00b7 ':'',s); }
  return meta;
}
/* A press inside the catalog rebuilds it, so an animation keyed on a class the
   rebuild re-applies would replay on every later rebuild. The press leaves a
   marker instead and the rebuild it causes consumes it: one heart pops, one
   badge drops in, and an unrelated rebuild moves nothing. */
let catalogPulse=null;
/* A chosen card's detail panel, handed from the card builder to the list that
   mounts it. A WeakMap rather than a property on the card: the test sandbox's
   stub element answers any unknown property with a function, so `card._detail`
   read as true for every card there. */
const cardDetails=new WeakMap();
function catalogPulsed(ref,kind){
  const p=catalogPulse;
  return !!(p && ref && p.kind===kind && p.s===ref.s && (p.v||null)===(ref.v||null) && performance.now()-p.t<600);
}
function discoveryPlacingBadge(row,selected,ref){
  if (!selected) return;
  const badge=document.createElement('span'); badge.className='placing-badge'+(catalogPulsed(ref,'placing')?' enter':'');
  badge.textContent='Placing'; row.appendChild(badge);
}
/* ---------- the catalog's two views ----------
   Pictures (a grid of tiles: the plant, its name, when it flowers) or a list of
   compact rows. Either way a card says only what you choose a plant BY; the
   rest opens under the one you choose (plantCardDetail). A card used to carry
   eight runs of text, six of them under 12px, beside a picture whose plant
   measured a median 22x34px: on a 375x812 phone three plants fitted, and one
   at half height. A device preference, like the theme: it is how this person
   browses, not a fact about a garden. */
const CATALOG_VIEW_KEY='hortus:catalogView';
let catalogViewPref=null;   // null: not read yet; '': no choice made, so the default
function catalogView(){
  if (catalogViewPref===null){
    try{ const v=localStorage.getItem(CATALOG_VIEW_KEY); catalogViewPref=(v==='grid'||v==='list')?v:''; }
    catch(_){ catalogViewPref=''; }
  }
  return catalogViewPref||'grid';
}
function setCatalogView(v){
  catalogViewPref=v==='list'?'list':'grid';
  try{ localStorage.setItem(CATALOG_VIEW_KEY,catalogViewPref); }catch(_){ }
  buildToolTray();
}
function catalogViewToggle(){
  const view=catalogView(), seg=document.createElement('span'); seg.className='catalog-view';
  seg.setAttribute('role','group'); seg.setAttribute('aria-label','How the plants are shown');
  [['grid','Pictures'],['list','List']].forEach(([id,label])=>{
    const b=document.createElement('button'); b.type='button'; b.className=view===id?'sel':''; b.dataset.view=id;
    b.title=label; b.setAttribute('aria-label',label+' view'); b.setAttribute('aria-pressed',view===id?'true':'false');
    b.appendChild(uiIcon(id)); b.onclick=()=>{ if (catalogView()!==id) setCatalogView(id); };
    seg.appendChild(b);
  });
  return seg;
}
/* ---------- catalog card art cache (perf) ----------
   Every result card redrew its species from scratch on every tray rebuild, and
   the tray rebuilds on every tool arm, search keystroke, source change and
   category switch. Measured on a 36-card list: 36 drawPlant calls, 11.1ms —
   33% of a 34ms rebuild — for art that is byte-identical every time (growth 1,
   bloom 1, a fixed preview season, the fixed seed tileSeed(3,7)). Bake once and
   blit after, the same trick PSPRITE plays for the garden.

   The bitmap is a pure function of species|variant|season, so it never needs
   invalidating: plant colour lives in PLANTS and is deliberately world art, not
   themed, so a light/dark flip cannot change it (unlike the uiInk chrome icons,
   which are rebuilt by applyTheme). Discovery shows each exact reference in
   only one card at a time, so the cached canvas itself can be mounted there.
   Detach mounted art when retiring a view so the cache never retains old card
   parents. Offscreen cards reserve their space without allocating a bitmap. */
/* Two sizes, in CSS px: a list row's picture and a tile's. The plant is FITTED
   to its box (paintLibCanvas, the Plant Library's own fit) and may be enlarged
   to fill it, up to `max`: at the old fixed 1.15 a 24in forb was 27px of a
   124px canvas. Relative size is lost that way, so a tile states the height.
   A tile is 161KB against a row's 55KB, so the cache is bounded by bytes as
   well as by count: about 74 tiles, or the 128 rows it always held. */
const TRAY_ART=new Map(), TRAY_ART_MAX=128, TRAY_ART_BYTES=12*1024*1024;
const TRAY_ART_KINDS={ row:{w:56,h:62,max:1.7}, tile:{w:112,h:90,max:2.6} };
function trayPlantArt(species,variant,season,D,kind){
  const spec=TRAY_ART_KINDS[kind]||TRAY_ART_KINDS.row;
  const k=species+'|'+(variant||'')+'|'+season+(spec===TRAY_ART_KINDS.row?'':'|'+kind);
  let cv=TRAY_ART.get(k);
  if (cv){ TRAY_ART.delete(k); TRAY_ART.set(k,cv); return cv; }   // LRU: re-insert at the end
  cv=libCanvasBlank(spec.w,spec.h);
  if (cv.style) cv.style.width=cv.style.height='';               // the card's CSS sizes it
  paintLibCanvas(cv,species,variant||null,season,spec.w,spec.h,spec.max);
  TRAY_ART.set(k,cv);
  let bytes=0; for (const c of TRAY_ART.values()) bytes+=(c.width|0)*(c.height|0)*4;
  while (TRAY_ART.size>1 && (TRAY_ART.size>TRAY_ART_MAX || bytes>TRAY_ART_BYTES)){
    const [k0,c0]=TRAY_ART.entries().next().value;
    TRAY_ART.delete(k0); bytes-=(c0.width|0)*(c0.height|0)*4;
  }
  return cv;
}
let discoveryArtView=null;
function resetDiscoveryArt(){
  if (!discoveryArtView) return;
  if (discoveryArtView.observer) discoveryArtView.observer.disconnect();
  discoveryArtView.canvases.forEach(canvas=>canvas.remove());
  discoveryArtView.canvases.clear(); discoveryArtView.pending.clear();
  discoveryArtView=null;
}
function paintDiscoveryArt(view,slot){
  const spec=view.pending.get(slot); if (!spec) return;
  const art=trayPlantArt(...spec);
  art.className='plant-result-art'; art.dataset.artKey=slot.dataset.artKey;
  art.setAttribute('aria-hidden','true');
  slot.replaceWith(art); view.canvases.add(art); view.pending.delete(slot);
  if (view.observer) view.observer.unobserve(slot);
}
function observeDiscoveryArt(view){
  if (!view.pending.size || normalizedSheetState(game.sheetState)==='collapsed') return;
  if (typeof IntersectionObserver!=='function'){
    // Old browsers retain the synchronous art behavior.
    [...view.pending.keys()].forEach(slot=>paintDiscoveryArt(view,slot)); return;
  }
  view.observer=new IntersectionObserver(entries=>{
    if (discoveryArtView!==view || game.sheetCollapsed || !game.inGarden) return;
    entries.forEach(entry=>{
      if (entry.isIntersecting&&entry.target.isConnected) paintDiscoveryArt(view,entry.target);
    });
  },{root:view.tray,rootMargin:'120px 0px'});
  view.pending.forEach((_,slot)=>view.observer.observe(slot));
}
function syncDiscoveryArtVisibility(){
  const view=discoveryArtView; if (!view) return;
  if (game.sheetCollapsed){
    if (view.observer) view.observer.disconnect();
    view.observer=null;
  } else if (!view.observer) observeDiscoveryArt(view);
}
function plantArtCanvas(species,variant,season,D,kind){
  const slot=document.createElement('span'); slot.className='plant-result-art';
  slot.dataset.artKey=species+'|'+(variant||'')+'|'+season; slot.setAttribute('aria-hidden','true');
  if (discoveryArtView){ discoveryArtView.pending.set(slot,[species,variant,season,D,kind]); return slot; }
  const art=trayPlantArt(species,variant,season,D,kind); art.className='plant-result-art'; return art;
}
function plantHeartButton(ref,P,labelled){
  const on=isFavorite(ref), heart=document.createElement('button'); heart.type='button';
  heart.className='plant-result-heart'+(on?' on':'')+(on&&catalogPulsed(ref,'heart')?' pop':'');
  heart.title=on?`Remove ${P.name} from Favorites`:`Add ${P.name} to Favorites`;
  heart.setAttribute('aria-label',heart.title); heart.setAttribute('aria-pressed',on?'true':'false');
  heart.appendChild(uiIcon('heart'));
  if (labelled){ const t=document.createElement('span'); t.textContent='Favorite'; heart.appendChild(t); }
  heart.onclick=()=>{ catalogPulse={s:ref.s,v:ref.v||null,kind:'heart',t:performance.now()}; toggleFavorite(ref); buildToolTray(); };
  return heart;
}
// "Little Bluestem 'Carousel'" under a Little Bluestem heading is 'Carousel'
function plantVariantLabel(P,groupLabel){
  const name=P.name||'', g=groupLabel||'';
  if (g && name.length>g.length+1 && name.toLowerCase().startsWith(g.toLowerCase()+' ')) return name.slice(g.length+1);
  return name;
}
/* The one line under a card's name: what you choose a plant by. A tile says
   when it flowers (its height is on the picture); a row adds the size and the
   light; a variety states its size, the fact you are choosing between. The
   size sits alone in .plant-site-size so a wrap cannot split it. */
function plantCardLine(P,o){
  const line=document.createElement('span'); line.className='pc-line';
  (o.families||[]).forEach(family=>{ const dot=document.createElement('i'); dot.className='plant-result-dot';
    dot.style.background=discoverySwatch(family); dot.setAttribute('aria-hidden','true'); line.appendChild(dot); });
  const parts=[];
  if (o.bloom!==null) parts.push(o.bloom||'Foliage');
  if (o.size){ const s=document.createElement('span'); s.className='plant-site-size'; s.textContent=o.size; parts.push(s); }
  if (o.light) parts.push(o.light);
  (o.tags||[]).forEach(t=>parts.push(t));
  parts.forEach((part,i)=>{
    if (i) line.appendChild(document.createTextNode(' \u00b7 '));
    if (typeof part==='string'){ const t=document.createElement('span'); t.textContent=part; line.appendChild(t); }
    else line.appendChild(part);
  });
  return line;
}
function discoveryResultCard(ref,d,opts={}){
  const P=refDef(ref), row=document.createElement('article'), selected=activePlantRef(ref), grid=catalogView()==='grid';
  row.className='plant-result-card '+(grid?'pc-tile':'pc-row')+(selected?' sel':'');
  if (opts.variant) row.classList.add('plant-variant-card');
  const main=document.createElement('button'); main.type='button'; main.className='pc-main';
  main.title=`Choose ${P.name}`; main.setAttribute('aria-label',`Choose ${P.name}`); main.setAttribute('aria-pressed',selected?'true':'false');
  const art=plantArtCanvas(ref.s,ref.v,previewSeasonForRef(ref,d),P,grid?'tile':'row');
  const copy=document.createElement('span'); copy.className='pc-copy';
  const name=document.createElement('b'); name.textContent=opts.variant?plantVariantLabel(P,opts.groupLabel):P.name;
  copy.appendChild(name);
  if (!grid){ const latin=document.createElement('em'); latin.textContent=P.latin||''; copy.appendChild(latin); }
  const family=resultFlowerFamily(ref,d), blooms=bloomMonthsFor(P).length?bloomRangeText(P):'';
  const size=typeof matureSizeText==='function'?matureSizeText(P):'';
  copy.appendChild(plantCardLine(P,{
    families:family?[family]:[],
    bloom:grid&&opts.variant?null:blooms,
    size:(!grid||opts.variant)?size:'',
    light:!grid&&!opts.variant?(P.sun==='full'?'Full sun':P.sun==='part'?'Part shade':'Shade'):'',
    tags:P.spreadHabit==='colony'?['Spreads']:[]}));
  /* The note is what tells two varieties apart, so it stays on a variety's card. */
  if (opts.variant&&P.note){ const details=document.createElement('span'); details.className='plant-variant-details'; details.textContent=P.note; copy.appendChild(details); }
  const artBox=document.createElement('span'); artBox.className='pc-art'; artBox.appendChild(art);
  if (grid&&!opts.variant){ const chip=document.createElement('span'); chip.className='pc-chip';
    chip.textContent=plantMeasure(P.heightIn||P.h); chip.title='Mature height'; artBox.appendChild(chip); }
  main.append(artBox,copy);
  main.onclick=()=>{ game.drill=null; catalogPulse={s:ref.s,v:ref.v||null,kind:'placing',t:performance.now()};
    setTool(ref.s,ref.v||null); buildToolTray(); toast(`${P.name} selected.`); };
  row.appendChild(main);
  if (!grid) row.appendChild(plantHeartButton(ref,P,false));
  discoveryPlacingBadge(row,selected,ref);
  if (selected) cardDetails.set(row,plantCardDetail(ref,d,opts));
  return row;
}
/* Everything else about the chosen plant, in a panel under its card: the Latin
   name, what kind of plant it is, the twelve-month bloom strip, where it grows
   and how big it gets, the site notes, and the two things you do WITH a plant
   besides placing it. It is a sibling of the card, not a child, so in the
   picture grid it can take a whole row (grid-column:1/-1). */
function plantCardDetail(ref,d,opts={}){
  const P=refDef(ref), box=document.createElement('div'); box.className='plant-card-detail'+(catalogPulsed(ref,'placing')?' enter':'');
  box.setAttribute('role','group'); box.setAttribute('aria-label',`${P.name}: details`);
  const title=document.createElement('div'); title.className='pcd-title';
  const name=document.createElement('b'); name.textContent=P.name;
  const latin=document.createElement('em'); latin.textContent=P.latin||''; title.append(name,latin);
  box.appendChild(title);
  const meta=document.createElement('span'); meta.className='plant-result-meta';
  const family=resultFlowerFamily(ref,d);
  if (family){ const dot=document.createElement('i'); dot.className='plant-result-dot'; dot.style.background=discoverySwatch(family); dot.setAttribute('aria-hidden','true'); meta.appendChild(dot); }
  const bloom=document.createElement('span'); bloom.textContent=discoveryBloomLabel(P); meta.appendChild(bloom);
  const kind=document.createElement('small'); kind.textContent=provenanceLabel(P); meta.appendChild(kind);
  if (P.spreadHabit==='colony'){ const runs=document.createElement('small'); runs.textContent='Spreads'; meta.appendChild(runs); }
  const relation=nativeRelation(P,activeFilters().nativeRegion);
  if (activeFilters().nativeMode==='any' && relation.regional){
    const nativeTag=document.createElement('small'); nativeTag.textContent=nativeRegionLabel(activeFilters().nativeRegion)+' origin'; meta.appendChild(nativeTag);
  }
  box.appendChild(meta);
  const timeline=discoveryBloomTimeline(P); if (timeline) box.appendChild(timeline);
  box.appendChild(discoverySiteMeta(P));
  const guidance=plantGuidanceButton(ref);
  if (guidance) box.appendChild(guidance);
  const actions=document.createElement('div'); actions.className='pcd-actions';
  const inPalette=d.source==='palette' && d.collectionId;
  const add=document.createElement('button'); add.type='button'; add.className='plant-result-add';
  add.title=inPalette?`Remove ${P.name} from this palette`:`Add ${P.name} to a palette`;
  add.setAttribute('aria-label',add.title); add.appendChild(uiIcon(inPalette?'minus':'plus'));
  const addText=document.createElement('span'); addText.textContent=inPalette?'Remove from palette':'Add to palette'; add.appendChild(addText);
  add.onclick=()=>{ if (inPalette){ removePaletteRef(d.collectionId,ref); buildToolTray(); } else openPaletteManager(ref); };
  actions.append(plantHeartButton(ref,P,true),add); box.appendChild(actions);
  return box;
}
function discoveryFamilyCard(group,d){
  if (group.refs.length===1) return discoveryResultCard(group.refs[0],d);
  const base=PLANTS[group.s], active=group.refs.find(activePlantRef), rep=active||group.representativeRef;
  const R=refDef(rep)||base, row=document.createElement('article'), grid=catalogView()==='grid';
  row.className='plant-result-card plant-family-card '+(grid?'pc-tile':'pc-row')+(active?' sel':''); row.id=`plant-family-${group.domId}`;
  const main=document.createElement('button'); main.type='button'; main.className='pc-main';
  main.title=`View ${group.label} choices`; main.setAttribute('aria-label',`View ${group.label}: ${group.refs.length} choices`);
  main.setAttribute('aria-expanded','false'); main.setAttribute('aria-controls',`plant-varieties-${group.domId}`);
  const art=plantArtCanvas(rep.s,rep.v,previewSeasonForRef(rep,d),R,grid?'tile':'row');
  const copy=document.createElement('span'); copy.className='pc-copy';
  const name=document.createElement('b'); name.textContent=group.label;
  copy.appendChild(name);
  if (!grid){ const latin=document.createElement('em'); latin.textContent=group.crossSpecies?'Grouped species and cultivars':base.latin||''; copy.appendChild(latin); }
  const choices=`${group.refs.length} choice${group.refs.length===1?'':'s'}`, tags=[];
  if (!grid) tags.push(choices);
  // on a mixed card the tag would be true of only some of its choices
  if (group.refs.every(ref=>{ const D=refDef(ref); return D&&D.spreadHabit==='colony'; })) tags.push('Spreads');
  copy.appendChild(plantCardLine(R,{families:discoveryGroupFamilies(group,d),bloom:discoveryGroupBloomText(group),tags}));
  const artBox=document.createElement('span'); artBox.className='pc-art'; artBox.appendChild(art);
  if (grid){ const chip=document.createElement('span'); chip.className='pc-chip pc-choices'; chip.textContent=choices; artBox.appendChild(chip); }
  main.append(artBox,copy);
  if (!grid){ const open=document.createElement('span'); open.className='pc-open'; open.appendChild(uiIcon('chevron-right')); main.appendChild(open); }
  main.onclick=()=>{
    const tray=document.getElementById('toolTray'); discoveryReturnScroll=tray?tray.scrollTop:0;
    discoveryOpenSpecies=group.id; setSheetState('full'); buildToolTray();
    setTimeout(()=>{ const head=document.querySelector('.cultivar-drill-back'); if (head) head.focus({preventScroll:true}); },0);
  };
  row.appendChild(main); discoveryPlacingBadge(row,!!active,active); return row;
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
/* FILTERS ARE A TRAY IN THE CATALOG (0.9.116). They were a dialog 1.5 to 3.3
   screens long whose Apply sat below the fold, opened to change one chip and
   closed again to see what it did. The four browsing filters (light, water,
   flower colour, bloom season) now sit in a tray the Filters button opens, and
   each applies as it is pressed, with the list changing under it. Closed, the
   ones that are on show as pills, each removed by its own press. What the
   GARDEN asks of a plant (zone, style, origin, browsing animals)
   is a different kind of thing and keeps a dialog, reached from the tray's
   foot and from the garden menu.
   pulseIs: the one-shot marker of catalogPulse, for things that are not a plant. */
function pulseIs(kind,key){
  const p=catalogPulse;
  return !!(p && p.kind===kind && (key===undefined||p.key===key) && performance.now()-p.t<600);
}
function toggleDiscoveryLens(field,id){
  const d=activeDiscovery(), cur=d[field]||[];
  discoveryOpenSpecies=null;
  setDiscovery({[field]:cur.includes(id)?cur.filter(x=>x!==id):[...cur,id],limit:36},true);
  buildToolTray();
}
function clearDiscoveryLens(){
  discoveryOpenSpecies=null;
  setDiscovery({colorFamilies:[],bloomSeasons:[],light:[],moisture:[],limit:36},true); buildToolTray();
}
function setFilterTrayOpen(open){
  open=!!open;
  setDiscovery({filterOpen:open},true);
  // on the sheet the tray heads the list, and the list is one tap up from half
  if (open&&mobileSheetUi()&&normalizedSheetState(game.sheetState)!=='full') setSheetState('full');
  catalogPulse=open?{kind:'filters',t:performance.now()}:null;
  buildToolTray();
  const tray=document.getElementById('toolTray');
  if (open&&mobileSheetUi()&&tray) tray.scrollTop=0;
  const next=document.querySelector(open?'.qf-tray .qf-chip':'.discovery-filter-trigger');
  if (next&&next.focus) next.focus({preventScroll:true});
}
/* The tray when it is open, the pills when it is shut and something is on,
   nothing otherwise. The dock mounts it under the control rows; the sheet at
   the head of the list, where it scrolls away with the plants instead of
   taking a third of a phone for as long as it is open. */
function discoveryFilterRegion(d){
  const n=discoveryLensCount(d);
  const el=(tag,cls,text)=>{ const e=document.createElement(tag); if (cls) e.className=cls; if (text!=null) e.textContent=text; return e; };
  const link=(text,fn)=>{ const b=el('button','qf-link',text); b.type='button'; b.onclick=fn; return b; };
  const refocus=sel=>{ const next=document.querySelector(sel); if (next&&next.focus) next.focus({preventScroll:true}); };
  if (d.filterOpen){
    const tray=el('div','qf-tray'+(pulseIs('filters')?' enter':'')); tray.id='qfTray';
    tray.setAttribute('role','group'); tray.setAttribute('aria-label','Filters');
    const row=(label,field,rows,dots)=>{
      const r=el('div','qf-row'+(field==='bloomSeasons'?' keep-lab':'')); r.appendChild(el('span','qf-lab',label));
      const chips=el('div','qf-chips'+(dots?' qf-dots':'')); chips.setAttribute('role','group'); chips.setAttribute('aria-label',label);
      rows.forEach(([id,text,color])=>{
        const on=d[field].includes(id), key=field+':'+id;
        const b=el('button','qf-chip'+(dots?' qf-dot':'')+(on&&pulseIs('chip',key)?' pop':''));
        b.type='button'; b.dataset.qf=key; b.setAttribute('aria-pressed',on?'true':'false');
        if (dots){ const dot=el('i'); dot.style.background=color; b.appendChild(dot); b.title=text; b.setAttribute('aria-label',text); }
        else b.appendChild(el('span',null,text));
        b.onclick=()=>{ catalogPulse={kind:'chip',key,t:performance.now()}; toggleDiscoveryLens(field,id); refocus(`[data-qf="${key}"]`); };
        chips.appendChild(b);
      });
      r.appendChild(chips); tray.appendChild(r);
    };
    row('Light','light',DISCOVERY_LIGHT);
    // "Low water" names the row where the sheet drops the row labels
    row('Water','moisture',DISCOVERY_MOISTURE.map(([id,label],i)=>[id,i?label.replace(/ water$/,''):label]));
    row('Color','colorFamilies',DISCOVERY_COLOR_FAMILIES,true);
    row('Blooms','bloomSeasons',DISCOVERY_SEASONS.map(([id])=>[id,id]));
    const foot=el('div','qf-foot'), line=el('span','qf-garden',discoveryGardenLine());
    line.title='This garden: '+line.textContent;
    const clear=link(n?`Clear ${n}`:'Clear',()=>{ clearDiscoveryLens(); refocus('.qf-tray .qf-chip'); }); clear.disabled=!n;
    const garden=link('Garden criteria',()=>openDiscoveryFilters(garden)); garden.title='Zone, style, native planting and browsing animals';
    foot.append(line,clear,garden); tray.appendChild(foot);
    return tray;
  }
  if (!n) return null;
  const act=el('div','qf-active'); act.setAttribute('role','group'); act.setAttribute('aria-label','Filters that are on');
  discoveryLensPills(d).forEach(p=>{
    const b=el('button','qf-pill'); b.type='button'; b.title=`Remove ${p.label}`; b.setAttribute('aria-label',`Remove filter: ${p.label}`);
    if (p.color){ const sw=el('i','sw'); sw.style.background=p.color; b.appendChild(sw); }
    b.appendChild(el('span',null,p.label)); const x=el('span','x'); x.appendChild(uiIcon('close')); b.appendChild(x);
    b.onclick=()=>{ toggleDiscoveryLens(p.field,p.id); refocus(discoveryLensCount()?'.qf-pill':'.discovery-filter-trigger'); };
    act.appendChild(b);
  });
  if (n>1) act.appendChild(link('Clear all',()=>{ clearDiscoveryLens(); refocus('.discovery-filter-trigger'); }));
  return act;
}
function catalogMinimizeButton(){
  const b=document.createElement('button'); b.type='button'; b.className='catalog-minimize';
  b.title='Minimize the catalog'; b.setAttribute('aria-label','Minimize the catalog and show more of the plan');
  b.setAttribute('aria-expanded','true'); b.setAttribute('aria-controls','sheetCatalog'); setUiIcon(b,'chevron-down');
  // Collapse FIRST so the flight starts on this click's frame; the catalog
  // rebuild behind it is main-thread work the compositor-driven ghost ignores.
  b.onclick=()=>{ closeDiscoverySourceMenu(); setSheetState('collapsed'); buildToolTray(); };
  return b;
}
function discoveryResultCountText(refs){
  const groups=groupDiscoveryRefs(refs), choices=groups.reduce((n,group)=>n+Math.max(0,group.refs.length-1),0);
  return `${groups.length} plant${groups.length===1?'':'s'}${choices?` \u00b7 ${choices} additional choice${choices===1?'':'s'}`:''}`;
}
function discoverySearchSelection(d,query){
  const q=String(query||'');
  const searching=!!q.trim();
  const prior=d.query&&d.query.trim() ? (d.category||d.returnCategory) : d.category;
  const fallback=prior||d.returnCategory||(discoveryCollectionView(d)?null:game.trayCat);
  return {query:q,category:searching?null:fallback,returnCategory:searching?fallback:null,limit:36};
}
/* The category control is a GRID (0.9.115): every category in one place, one
   tap away. It was one scrolling row of pills, and on every phone and every
   dock width only 3 of the 10 fitted: reaching Trees was a 700px swipe on a
   phone or four chevron presses on a desktop, the wheel did nothing over it,
   and a category with nothing in it was REMOVED, so the cells moved whenever
   the source or a search changed. Now the cells never move: an empty one is
   dimmed in place. The fades, the chevron gutters and the drag scroll went
   with the row; arrow keys still rove, and Up and Down move a row. */
function categoryKeyIndex(key,current,length,cols){
  if (!length) return -1;
  if (key==='Home') return 0;
  if (key==='End') return length-1;
  if (key==='ArrowRight') return current<0?0:(current+1)%length;
  if (key==='ArrowLeft') return (current<=0?length:current)-1;
  if ((key==='ArrowDown'||key==='ArrowUp') && cols>0){
    if (current<0) return 0;
    const next=current+(key==='ArrowDown'?cols:-cols);
    return next>=0&&next<length ? next : current;   // no cell that way: stay put
  }
  return -1;
}
function wrapCategoryStrip(strip){
  const wrap=document.createElement('div'); wrap.className='catalog-category-nav';
  wrap.appendChild(strip); return wrap;
}
// how many cells the first row holds, read off the laid-out grid
function categoryGridColumns(strip){
  const kids=[...strip.children]; if (!kids.length) return 0;
  const top=kids[0].offsetTop; let n=0;
  for (const k of kids){ if (k.offsetTop!==top) break; n++; }
  return n;
}
function enableCategoryKeys(strip){
  strip.addEventListener('keydown',e=>{
    const buttons=[...strip.querySelectorAll('button')], current=buttons.indexOf(document.activeElement);
    const next=categoryKeyIndex(e.key,current,buttons.length,categoryGridColumns(strip));
    if (next<0) return;
    e.preventDefault();
    buttons[next].focus({preventScroll:true});
  });
}
/* The five discovery controls used to stack as five full-width rows — 268px of
   fixed, non-scrolling chrome above the results on every screen. Because the
   result region was the only flexible row it absorbed all vertical pressure
   (1.5 cards at 1366x768, 0.2 at phone-landscape). Pairing them into two rows
   halves that; .catalog-control-row is the flex pair wrapper. */
function catalogControlRow(...kids){
  const row=document.createElement('div'); row.className='catalog-control-row';
  kids.forEach(k=>{ if (k) row.appendChild(k); }); return row;
}
function renderDiscoveryControls(tabs,modeControl){
  const d=activeDiscovery(), bar=document.createElement('div'); bar.className='discovery-controls';
  const find=document.createElement('input'); find.id='trayFind'; find.type='search'; find.autocomplete='off';
  find.placeholder=!modeControl&&typeof innerWidth==='number'&&innerWidth<360?'Find':'Find a plant';
  find.value=d.query; find.setAttribute('aria-label','Find a plant');
  find.maxLength=120;
  let composing=false;
  const search=(immediate=false)=>{
    clearTimeout(discoverySearchTimer);
    discoveryOpenSpecies=null;
    // This input survives many queries. Read the current lens, including the
    // category to restore, rather than the one captured when it was created.
    setDiscovery(discoverySearchSelection(activeDiscovery(),find.value));
    if (immediate) refreshDiscoverySearch(find);
    else discoverySearchTimer=setTimeout(()=>refreshDiscoverySearch(find),120);
  };
  find.oninput=e=>{ if (!composing&&!e.isComposing) search(); };
  find.addEventListener('compositionstart',()=>{ composing=true; clearTimeout(discoverySearchTimer); });
  find.addEventListener('compositionend',()=>{ composing=false; search(); });
  find.onkeydown=e=>{
    // Let the IME handle its keys without the garden's Escape shortcut
    // collapsing the sheet (and replacing the composing input).
    if (composing||e.isComposing){ e.stopPropagation(); return; }
    if (e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); find.value=''; search(true); }
  };
  const filterRow=document.createElement('div'); filterRow.className='discovery-filter-row';
  const filters=document.createElement('button'); filters.type='button'; filters.className='discovery-filter-trigger';
  // An icon, the word and how many are on. The sheet hides the word: its one
  // control row has no room for it, and the count is what changes.
  const n=discoveryFilterCount(), filterLabel=document.createElement('span'); filterLabel.className='filter-label'; filterLabel.textContent='Filters';
  filters.append(uiIcon('filter'),filterLabel);
  if (n){ const badge=document.createElement('b'); badge.className='filter-count'; badge.textContent=String(n); filters.appendChild(badge); }
  filters.title=n?`Filters · ${n} on`:'Filters'; filters.setAttribute('aria-label',n?`Filters, ${n} on`:'Filters');
  filters.setAttribute('aria-expanded',d.filterOpen?'true':'false'); filters.setAttribute('aria-controls','qfTray');
  filters.onclick=()=>setFilterTrayOpen(!activeDiscovery().filterOpen); filterRow.appendChild(filters);
  const count=document.createElement('span'); count.className='discovery-result-count'; count.setAttribute('role','status');
  count.textContent=discoveryResultCountText(discoveryRefs()); filterRow.appendChild(count);
  // Row 1: what you're browsing (mode + source). Row 2: how you narrow it
  // (search + filters). Both pairs read left-to-right as one decision.
  if (modeControl){
    bar.appendChild(catalogControlRow(modeControl(),discoverySourceMenu(d)));
    bar.appendChild(catalogControlRow(find,filterRow));
  } else {
    /* The sheet: the Plants/Landscape switch is in the handle (see
       buildToolTrayInner), so the three that are left share ONE row. */
    bar.appendChild(catalogControlRow(discoverySourceMenu(d),find,filterRow));
  }
  // the dock keeps the filter tray (or the pills) under its control rows
  const region=mobileSheetUi()?null:discoveryFilterRegion(d);
  if (region) bar.appendChild(region);
  tabs.appendChild(bar);
  return {find,count};
}
function renderLandscapeControls(tabs,modeControl){
  const bar=document.createElement('div'); bar.className='landscape-controls';
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
  bar.appendChild(catalogControlRow(modeControl?modeControl():null,find));
  tabs.appendChild(bar);
}
function renderDiscoveryTray(tray){
  resetDiscoveryArt();
  const view=discoveryArtView={tray,pending:new Map(),canvases:new Set(),observer:null};
  renderDiscoveryTrayInner(tray);
  observeDiscoveryArt(view);
}
function renderDiscoveryTrayInner(tray){
  const d=activeDiscovery(), refs=discoveryRefs(), groups=discoveryGroupsInOrder(groupDiscoveryRefs(refs),d);
  const grid=catalogView()==='grid';
  tray.classList.add('discovery-results'); tray.classList.toggle('view-grid',grid); tray.classList.toggle('view-list',!grid);
  // a chosen card brings its detail panel with it, as the next item of its list
  const addCard=(list,card)=>{ list.appendChild(card); const detail=cardDetails.get(card); if (detail) list.appendChild(detail); };
  const summary=document.createElement('div'); summary.className='discovery-summary';
  /* Only a saved collection reports "N eligible of M saved", so only a saved
     collection needs the source list. It was resolved up front for every
     rebuild and thrown away on the two sources that never read it -- free
     before, and no longer free now that `recommended` filters. */
  /* One line: what is listed, how many, and how to see them. The sheet's title
     block said the source and the count, and this line said them again. */
  const what=document.createElement('span'); what.className='ds-text';
  const cat=d.category&&TRAY_CATS.find(c=>c.id===d.category), collection=d.source==='favorites'||d.source==='palette';
  const head=document.createElement('b');
  head.textContent=d.query.trim()?'Matching plants':cat?cat.label:collection?discoverySourceLabel(d):'All plants';
  const count=document.createElement('span'); count.className='ds-count';
  const shown=groups.length, extra=groups.reduce((n,group)=>n+Math.max(0,group.refs.length-1),0);
  if (collection){
    const a=collectionAvailability(discoverySourceRefs(d));
    count.textContent=` \u00b7 ${discoveryResultCountText(refs)} shown · ${a.available} eligible / ${a.total} saved`; count.classList.add('keep');
  } else {
    count.textContent=` \u00b7 ${shown} plant${shown===1?'':'s'}`;
    if (extra){ const more=document.createElement('span'); more.className='ds-more'; more.textContent=` \u00b7 ${extra} more choice${extra===1?'':'s'}`; count.appendChild(more); }
  }
  what.append(head,count);
  /* At half height the sheet shows neither the Filters button nor the pills,
     so the line that counts the plants says a filter is why, and is the way in. */
  const lens=discoveryLensCount(d);
  if (lens){ const on=document.createElement('button'); on.type='button'; on.className='ds-filters';
    on.textContent=`${lens} filter${lens===1?'':'s'}`; on.title='Show the filters that are on';
    on.onclick=()=>setFilterTrayOpen(true); what.appendChild(on); }
  summary.append(what,catalogViewToggle());
  summary.title=`${discoverySourceLabel(d)} \u00b7 ${discoveryResultCountText(refs)}`;
  /* A daily challenge narrows the catalog from inside plantFits, so species
     simply vanish. The only notice was a toast that cleared after 2.6s: open
     Plant filters and nothing looks unusual, clear every filter and the plant
     is still missing, and the app reads as broken. The restriction is real and
     wanted — it is the challenge — so it is announced where the narrowing is
     already reported, with the way out beside it. Quitting to the menu was
     previously the only exit. */
  // a family's own page says what it holds: the list's line over it was stale
  const sites=discoverySiteSections(groups,d);
  const openGroup=refs.length&&discoveryOpenSpecies&&(groups.find(group=>group.id===discoveryOpenSpecies)
    ||(sites&&sites.flatMap(site=>site.groups).find(group=>group.id===discoveryOpenSpecies)));
  if (!openGroup){
    const region=mobileSheetUi()?discoveryFilterRegion(d):null;
    if (region) tray.appendChild(region);
    tray.appendChild(summary);
  }
  if (game.challenge){
    const ch=document.createElement('div'); ch.className='discovery-challenge';
    const txt=document.createElement('button'); txt.type='button'; txt.className='discovery-challenge-clear';
    txt.textContent='View brief';txt.title=game.challenge.title||"Today's prompt";
    txt.onclick=openChallengeBrief;
    const free=document.createElement('button'); free.type='button'; free.className='discovery-challenge-clear';
    free.textContent=game.challenge.paletteFree?'Use suggested plants':'Use all plants';
    free.title='Change plant selection; your hardiness filter and brief stay the same';
    free.onclick=()=>{ game.challenge.paletteFree=!game.challenge.paletteFree; markModelChanged(); buildToolTray(); updateFilterBtn&&updateFilterBtn();
      toast(game.challenge.paletteFree?'All plants — current filters still apply.':'Suggested plants selected.'); };
    free.classList.toggle('hidden',!game.challenge.match&&!game.challenge.palette);
    const finish=document.createElement('button');finish.type='button';finish.className='discovery-challenge-clear discovery-challenge-finish';
    finish.textContent=game.challenge.completedAt?'Save & share design':'Finish design';
    finish.onclick=finishDailyDesign;
    ch.append(txt,finish,free); tray.appendChild(ch);
  }
  if (!refs.length){
    discoveryOpenSpecies=null;
    const empty=document.createElement('div'); empty.className='discovery-empty';
    /* Recommended is a real list now, so "the style does not ask for this" is a
       new way to arrive here with nothing on screen -- search an oak in a
       Mediterranean garden and every plant is gone.  Name the lens and widen
       only the SOURCE, keeping the query, category and colours the gardener
       typed: sweeping those away as well answers a question they did not ask
       and loses the search they came here with.  Everything else still falls
       through to the general reset. */
    const styled=activeDesignType(), lensOnly=d.source==='recommended'&&styled, lens=discoveryLensCount(d);
    const button=(text,fn)=>{ const b=document.createElement('button'); b.type='button'; b.className='btn'; b.textContent=text; b.onclick=fn; return b; };
    const widen=()=>button('Browse all eligible plants',()=>{ setDiscovery({source:'all',collectionId:null},true); buildToolTray(); });
    if (lens){
      /* With filters on, the filters are the likelier reason, and the way out
         is to drop them and keep the list, the category and the search. Blaming
         the garden style here sent a gardener who pressed Part shade and Purple
         off to a different list with both still on. */
      empty.textContent=lensOnly
        ? `Nothing recommended for a ${designTypeName(styled)} garden matches ${lens===1?'this filter':'these filters'}.`
        : `Nothing matches ${lens===1?'this filter':'these filters'}.`;
      empty.appendChild(button(lens===1?'Clear the filter':'Clear filters',clearDiscoveryLens));
      if (lensOnly) empty.appendChild(widen());
    } else if (lensOnly){
      // the label as authored: lowercasing gave "a mediterranean garden" and
      // "a japanese garden", and it is the chip the gardener just chose anyway
      empty.textContent=`Nothing here is recommended for a ${designTypeName(styled)} garden.`;
      empty.appendChild(widen());
    } else {
      empty.textContent='Nothing matches this view.';
      empty.appendChild(button('Show all plants',()=>{ setDiscovery({source:'all',collectionId:null,category:null,query:'',limit:36},true); buildToolTray(); }));
    }
    tray.appendChild(empty); return;
  }
  // a family filed under two sites is two cards, and each opens on its own choices
  if (openGroup){
    tray.classList.add('cultivar-drill');
    const base=PLANTS[openGroup.s], head=document.createElement('div'); head.className='cultivar-drill-head'; head.id=`plant-varieties-${openGroup.domId}`;
    const back=document.createElement('button'); back.type='button'; back.className='cultivar-drill-back'; setUiIcon(back,'chevron-right');
    /* The sprite has no chevron-left and the SHEET tier hides this button's
       label, so 'chevron-left' drew nothing at all and the back button came out
       blank on a phone. Rotated right chevron + a real label, the way
       .library-back already does it. */
    back.title='Back to plants'; back.setAttribute('aria-label','Back to plants');
    const backText=document.createElement('span'); backText.textContent='Back to plants'; back.appendChild(backText);
    back.onclick=()=>{ const species=discoveryOpenSpecies; discoveryOpenSpecies=null; buildToolTray();
      setTimeout(()=>{ const next=document.getElementById(`plant-family-${openGroup.domId}`), nextTray=document.getElementById('toolTray');
        if (nextTray) nextTray.scrollTop=discoveryReturnScroll;
        const focus=next&&next.querySelector('.pc-main'); if (focus) focus.focus({preventScroll:true}); },0); };
    const title=document.createElement('div'); title.className='cultivar-drill-title';
    const strong=document.createElement('strong'); strong.textContent=openGroup.label;
    const small=document.createElement('small'); small.textContent=`${openGroup.refs.length} matching choice${openGroup.refs.length===1?'':'s'} · ${openGroup.crossSpecies?'grouped taxa':base.latin||''}`;
    title.append(strong,small); head.append(back,title,catalogViewToggle()); tray.appendChild(head);
    const variants=document.createElement('div'); variants.className='plant-variant-grid';
    openGroup.refs.forEach(ref=>addCard(variants,discoveryResultCard(ref,d,{variant:true,groupLabel:openGroup.label}))); tray.appendChild(variants);
    return;
  }
  discoveryOpenSpecies=null;
  if (sites){
    // Every section is drawn: the card art is painted as it scrolls into view, and
    // a Load more button would land in the middle of one site.
    sites.forEach(site=>{
      const head=document.createElement('h3'); head.className='discovery-site-head';
      head.textContent=`${site.label} \u00b7 ${site.groups.length}`;
      const list=document.createElement('div'); list.className='plant-result-grid';
      site.groups.forEach(group=>addCard(list,discoveryFamilyCard(group,d)));
      tray.append(head,list);
    });
    return;
  }
  const list=document.createElement('div'); list.className='plant-result-grid';
  groups.slice(0,d.limit).forEach(group=>addCard(list,discoveryFamilyCard(group,d))); tray.appendChild(list);
  if (groups.length>d.limit){ const more=document.createElement('button'); more.type='button'; more.className='discovery-load-more';
    more.textContent=`Load more plants (${groups.length-d.limit} left)`; more.onclick=()=>{ setDiscovery({limit:d.limit+36}); buildToolTray(); };
    tray.appendChild(more); }
}
/* Recommended keeps the garden style's own ranking. Every other list reads by
   the name ON THE CARD: it was ordered by the first member's species name, so
   Trees read Red Mulberry, Arborvitae, American Basswood, Beech, and Oak came
   22nd, and nobody could find anything by eye. */
function discoveryGroupsInOrder(groups,d){
  if (d.source==='recommended'&&activeDesignType()) return groups;
  return groups.slice().sort((a,b)=>String(a.label).localeCompare(String(b.label)));
}
function openDiscoveryFilters(opener){
  discoveryCriteriaDraft=activeFilters();
  discoveryStyleDraft=gardenStyleId();
  renderDiscoveryFilterScreen();
  const screen=openOverlay('discoveryFilterScreen','#discoveryZone'); if (screen) screen._returnFocus=opener||screen._returnFocus;
}
/* The garden's style lives on game.design, not in the filters: it ranks the
   catalog and decides what `recommended` holds, but it is not an eligibility
   gate. 'any' when a garden predates the questionnaire. */
let discoveryStyleDraft=null;
function gardenStyleId(){ return activeDesignType()||'any'; }
/* The draft IS the criteria being edited: the segments and the resist chips
   press straight into it. Only the two selects are read back off the DOM. */
function patchDiscoveryCriteria(patch){
  discoveryCriteriaDraft=normalizeFilters(Object.assign({},discoveryCriteriaDraft||activeFilters(),patch||{}));
  renderDiscoveryFilterScreen();
}
function readDiscoveryCriteria(){
  const zoneEl=$('discoveryZone'), regionEl=$('discoveryNativeRegion'), cur=discoveryCriteriaDraft||activeFilters();
  return normalizeFilters(Object.assign({},cur,{
    /* Zone is chosen when a garden begins and, since 0.9.29, can be corrected
       here. It used to be carried through untouched ("intentionally not
       editable") while the questionnaire promised "you can change any of this
       later", so a gardener who picked the wrong zone had to start again. It
       only gates what the library OFFERS: nothing planted is ever removed. */
    zone:zoneEl && zoneEl.value ? +zoneEl.value : cur.zone,
    nativeRegion:regionEl && typeof regionEl.value==='string' && regionEl.value ? regionEl.value : cur.nativeRegion
  }));
}
/* A short either/or as one row of buttons: a 3-way and a 2-way choice were two
   44px selects, each a tap to open and a tap to choose. Arrow keys move it. */
const GARDEN_NATIVE_MODES=[['any','Any origin','Plants of any origin'],
  ['regional','Natives + selections','Native to the region, and named selections of those'],
  ['straight','Straight species','Only the wild species native to the region']];
const GARDEN_RESIST=[['deer','Deer'],['rabbit','Rabbits'],['squirrel','Squirrels (bulbs)']];
/* `field` names the criterion a press patches in the dialog's draft; a function
   there is told the id instead, which is how the New garden page uses the same
   control on its own answers. --i/--n place the thumb that slides under the
   chosen option: it is the host's ::before, so it outlives the rebuild of the
   buttons and travels from the old option to the new one. */
function criteriaSegment(host,rows,value,field){
  if (!host) return; host.innerHTML='';
  if (host.style && host.style.setProperty){
    host.style.setProperty('--n',String(rows.length));
    host.style.setProperty('--i',String(Math.max(0,rows.findIndex(r=>r[0]===value))));
  }
  const pick=id=>{ if (typeof field==='function') field(id); else patchDiscoveryCriteria({[field]:id});
    const on=host.querySelector('[aria-checked="true"]'); if (on&&on.focus) on.focus({preventScroll:true}); };
  rows.forEach(([id,label,title])=>{
    const on=id===value, b=document.createElement('button'); b.type='button'; b.textContent=label; b.dataset.v=id;
    b.setAttribute('role','radio'); b.setAttribute('aria-checked',on?'true':'false'); b.tabIndex=on?0:-1; if (title) b.title=title;
    b.onclick=()=>pick(id); host.appendChild(b);
  });
  host.onkeydown=e=>{
    const step=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0; if (!step) return;
    e.preventDefault(); const at=Math.max(0,rows.findIndex(r=>r[0]===value));
    pick(rows[(at+step+rows.length)%rows.length][0]);
  };
}
function renderGardenCriteria(f){
  const zone=$('discoveryZone'), style=$('discoveryStyle');
  if (zone){
    zone.innerHTML='';
    const r=zoneRange(), cur=f.zone ? clampZone(f.zone) : null;
    if (!cur){ const o=document.createElement('option'); o.value=''; o.textContent='Not set — every zone'; o.selected=true; zone.appendChild(o); }
    for (let z=r.lo;z<=r.hi;z++){
      const o=document.createElement('option'); o.value=String(z);
      const t=zoneTemperatureText(z); o.textContent=t?`Zone ${z} · ${t}`:`Zone ${z}`;
      o.selected=z===cur; zone.appendChild(o);
    }
    zone.onchange=()=>{ discoveryCriteriaDraft=readDiscoveryCriteria(); renderDiscoveryFilterScreen(); };
  }
  if (style){
    style.innerHTML='';
    const want=discoveryStyleDraft||gardenStyleId();
    GARDEN_TYPES.forEach(([id,label])=>{
      const o=document.createElement('option'); o.value=id; o.textContent=label; o.selected=id===want; style.appendChild(o);
    });
    style.onchange=()=>{ discoveryStyleDraft=style.value; renderDiscoveryFilterScreen(); };
  }
}
function renderDiscoveryCriteria(){
  const f=discoveryCriteriaDraft||activeFilters();
  renderGardenCriteria(f);
  const region=$('discoveryNativeRegion');
  criteriaSegment($('discoveryNativeMode'),GARDEN_NATIVE_MODES,f.nativeMode,'nativeMode');
  region.innerHTML=''; NATIVE_REGIONS.filter(r=>r.selectable!==false).forEach(r=>{
    const o=document.createElement('option'); o.value=r.id; o.textContent=r.label; o.selected=r.id===f.nativeRegion; region.appendChild(o);
  });
  region.onchange=()=>{ discoveryCriteriaDraft=readDiscoveryCriteria(); renderDiscoveryFilterScreen(); };
  /* The region stays up in Any mode, where it still says where the garden is:
     it decides which plants count as native for the style recommendations.
     Its WORD changes -- origin is what a native mode restricts, place is what
     the garden is. */
  $('discoveryNativeRegionLabel').textContent=f.nativeMode==='any'?'Garden region':'Continent of origin';
  $('discoveryNativeHint').textContent=nativeCriteriaText(f);
  const resist=$('discoveryResist');
  if (resist){
    resist.innerHTML='';
    GARDEN_RESIST.forEach(([id,label])=>{
      const on=!!f[id], b=document.createElement('button'); b.type='button'; b.className='gc-check'; b.dataset.v=id;
      b.setAttribute('aria-pressed',on?'true':'false');
      const box=document.createElement('i'); box.className='gc-box'; const text=document.createElement('span'); text.textContent=label;
      b.append(box,text);
      b.onclick=()=>{ patchDiscoveryCriteria({[id]:!on});
        const again=resist.querySelector(`[data-v="${id}"]`); if (again&&again.focus) again.focus({preventScroll:true}); };
      resist.appendChild(b);
    });
  }
}
function renderDiscoveryFilterScreen(){
  if (!$('discoveryZone')||!$('btnDiscoveryApply')) return;
  renderDiscoveryCriteria();
  // count against the DRAFT, style included: `recommended` is the style's list
  const savedCriteria=game.filters, savedDesign=game.design;
  game.filters=normalizeFilters(discoveryCriteriaDraft||savedCriteria);
  if (discoveryStyleDraft) game.design=Object.assign({},savedDesign||{},{type:discoveryStyleDraft});
  let shown=0, extra=0;
  try { const groups=groupDiscoveryRefs(discoveryRefs()); shown=groups.length;
    extra=groups.reduce((n,group)=>n+Math.max(0,group.refs.length-1),0); }
  finally { game.filters=savedCriteria; game.design=savedDesign; }
  /* The button says what pressing it gives. With nothing to show it still
     applies -- a gardener may be setting the zone before choosing a list. */
  $('btnDiscoveryApply').textContent=shown?`Show ${shown} plant${shown===1?'':'s'}`:'Apply anyway';
  $('discoveryFilterCount').textContent=shown
    ? (extra?`${extra} more choice${extra===1?'':'s'} inside them`:'')
    : `No plants match in ${discoverySourceLabel(activeDiscovery())}.`;
}
/* The style is not a filter, so it rides game.design alone; a garden older
   than the questionnaire has no design and gets one, built from its filters. */
function applyGardenStyle(type){
  const next=GARDEN_TYPES.some(([id])=>id===type) ? type : 'any';
  if (next===gardenStyleId()) return false;
  game.design=Object.assign(normalizeDesign(game.design||activeFilters())||{},{type:next});
  return true;
}
function applyDiscoveryFilters(){
  applyGardenCriteria(discoveryCriteriaDraft||activeFilters(),{refresh:false,announce:false});
  if (discoveryStyleDraft) applyGardenStyle(discoveryStyleDraft);
  discoveryStyleDraft=null;
  // zone and style live in the garden's own save (game.design), not only in the
  // device-wide hortus:filters, so an apply has to reach the autosave
  if (game.inGarden) markModelChanged();
  discoveryOpenSpecies=null;
  setDiscovery({limit:36},true); discoveryCriteriaDraft=null;
  closeOverlay('discoveryFilterScreen'); buildToolTray();
  // the rebuild replaced the link that opened this: hand focus to what stands in its place
  if (!document.activeElement||document.activeElement===document.body){
    const back=document.querySelector('.qf-foot .qf-link:last-child')||document.querySelector('.discovery-filter-trigger');
    if (back&&back.focus) back.focus({preventScroll:true});
  }
  toast(`${discoveryResultCountText(discoveryRefs())} match this garden's criteria.`);
}
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
  discoveryOpenSpecies=null;
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
  if (!challengeAllows(ref.s,ref.v||null)) return 'Unavailable in this challenge';
  if (f.zone && (P.zones[0]>f.zone || P.zones[1]<f.zone)) return `Outside Zone ${f.zone}`;
  if (!passesNativeFilter(P,f)) return `Excluded by ${f.nativeMode==='straight'?'straight-species':'regional-native'} criteria`;
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
    const del=document.createElement('button'); del.type='button'; del.className='palette-row-action danger'; del.textContent='Delete'; /* showConfirm, not the native confirm() this used to call — it was the last
   browser dialog left in the app, and every other destructive stop (site photo
   removal, scheme deletion, deleting a garden) uses the themed panel with the
   shared openOverlay focus path. Inside an installed PWA a native alert reads
   as a stray piece of browser chrome. The copy says what is NOT lost, because
   "cannot be undone" on its own overstates it: the plants stay in the catalog,
   only the saved list goes. */
    del.onclick=()=>{ showConfirm(`Delete the "${p.name}" palette?`,
      'The plants stay in the catalog — only this saved list goes.',
      'Delete palette', ()=>{
        deletePlantPalette(p.id);
        if (d.source==='palette'&&d.collectionId===p.id) setDiscovery({source:'recommended',collectionId:null},true);
        paletteRenameId=null; renderPaletteManager(); buildToolTray();
      }); }; row.appendChild(del); list.appendChild(row);
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
/* Everything the source plant could be replaced WITH, sorted, each carrying its
   search text. Built once and kept while nothing it depends on moves (the
   source, the garden's filters, the challenge palette), so a keystroke in the
   search is a filter over this list rather than a rebuild of it. It used to be
   rebuilt per keystroke, starting with trayKeys(), which SORTS the whole catalog
   by style score only for this to sort again by name: 11-13ms a letter in
   Chrome on the demo garden, before any result was drawn.
   Species-level plantFits() stands in for trayKeys()'s membership, which is all
   that was read of it. Equal names now break ties by key, so the order is the
   same on every call rather than whatever the catalog sort left. */
let replaceCandidateMemo={key:'',list:null};
function replaceCandidates(source){
  const c=game.challenge;
  const key=[source.s,source.v||'',JSON.stringify(activeFilters()),
    c?JSON.stringify([c.id,c.match,c.palette,c.paletteFree]):'-'].join('|');
  if (replaceCandidateMemo.key===key && replaceCandidateMemo.list) return replaceCandidateMemo.list;
  const from=plantDef(source.s,source.v), group=replacementGroup(from), out=[];
  for (const k of PLANT_KEYS){
    const P=PLANTS[k]; if (P.hidden || !plantFits(k)) continue;
    const add=v=>{
      v=v||null;
      if (k===source.s && v===(source.v||null)) return;
      const D=plantDef(k,v);
      if (replacementGroup(D)!==group || !plantRefFits({s:k,v})) return;
      out.push({s:k,v,D,hay:`${P.name} ${P.latin} ${D.name||''} ${D.note||''}`.toLowerCase()});
    };
    add(null); Object.keys(P.cv||{}).forEach(add);
  }
  out.sort((a,b)=>a.D.name.localeCompare(b.D.name) || (a.s<b.s?-1:a.s>b.s?1:0) || String(a.v||'').localeCompare(String(b.v||'')));
  replaceCandidateMemo={key,list:out};
  return out;
}
function replaceOptionList(source,q){
  const list=replaceCandidates(source);
  return q ? list.filter(o=>o.hay.includes(q)) : list.slice();
}
/* The dialog's result thumbnails, drawn once per plant and reused: each was a
   procedural drawPlant, up to eighty of them, on every keystroke. A cached node
   is simply re-appended, since the results list is emptied before it is
   refilled and a plant appears in it once. */
const REPLACE_ART=new Map(), REPLACE_ART_MAX=160;
function replaceThumb(o){
  const season=plantIconSeason(o.D), key=o.s+'|'+(o.v||'')+'|'+season;
  let c=REPLACE_ART.get(key);
  if (c){ REPLACE_ART.delete(key); REPLACE_ART.set(key,c); return c; }   // LRU order
  c=document.createElement('canvas'); c.width=48; c.height=44;
  const sc=Math.min(.62,36/(plantArtTop(o.D)||40)), tc=c.getContext('2d'); tc.scale(sc,sc);
  drawPlant(tc,24/sc,42/sc,o.s,1,season,tileSeed(3,7),0,o.v||undefined,1);
  REPLACE_ART.set(key,c);
  if (REPLACE_ART.size>REPLACE_ART_MAX) REPLACE_ART.delete(REPLACE_ART.keys().next().value);
  return c;
}
/* How many plants each scope would change. Counted once per dialog: the garden
   cannot change while it is open, and 'garden' walks every plant in it. */
function replaceScopeCount(scope){
  const ctx=replacePlantContext;
  if (!ctx||!ctx.source) return 0;
  if (!ctx.scopeCounts) ctx.scopeCounts={};
  if (!(scope in ctx.scopeCounts))
    ctx.scopeCounts[scope]=replacementScopeTargets(Object.assign({},ctx,{scope})).length;
  return ctx.scopeCounts[scope];
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
    const c=replaceThumb(o);
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
function updateCatalogHeader(isPlantGroup){
  const title=document.getElementById('catalogTitle'), meta=document.getElementById('catalogMeta');
  if (title) title.textContent=isPlantGroup?'Plant library':'Landscape library';
  if (!meta) return;
  if (!isPlantGroup){ meta.textContent='The site, its ground and grade, and what stands on it'; return; }
  const d=activeDiscovery(), refs=discoveryRefs();
  meta.textContent=`${discoverySourceLabel(d)} \u00b7 ${discoveryResultCountText(refs)}`;
}
function plantTrayCategoryId(d=activeDiscovery(),currentId=game.trayCat){
  return trayGroupOf(currentId)==='plants'&&d.category ? d.category : currentId;
}
/* One rebuild asks discovery the same questions over and over — the header, the
   filter row, the result list and every category chip. The memo makes those
   identical calls free, and try/finally guarantees it is torn down even if a
   builder throws, so nothing can leak into a later rebuild and go stale. */
/* ---------- the tray rebuild guard ----------
   buildToolTray rebuilds the entire catalog from scratch — measured 948 DOM
   nodes and 36 card canvases, 38ms on the plant tab of a real 105ft garden
   (6ms on Landscape, 24ms with the sheet collapsed) — and it is called from
   about ninety places, most of which cannot change a pixel of what it renders.
   Undo was the worst of them: applySnapshot rebuilds the tray, so an undo cost
   ~120ms before the frame it triggered had even started.

   So skip the rebuild when nothing the tray reads has moved.

   WHAT MAKES THIS TRACTABLE: the tray renders from UI and tool state ONLY. It
   touches no garden layer — the single `game.plants` read in this file is
   pickAt's, which is the eyedropper, not rendering — so planting, erasing,
   painting terrain, undo and a scheme switch legitimately change nothing here.
   (The scheme CHIP is not part of this: it lives in syncTopTools, which
   switchScheme reaches through refreshCanvasTools.) That is also why the
   signature can be a list of scalars rather than a hash of the model.

   THE FAILURE MODE IS A STALE CATALOG, so the signature has to be complete, and
   `verifyTrayCache()` is the guard: it permutes each input, asks whether the
   rendered DOM changed, and reports any input that moved the DOM without moving
   the signature. Add an input to the tray, add it here.

   AND ONLY WHAT THE CATALOG READS. An input it does not read costs a full
   rebuild (8-11ms, measured in Chrome on the demo garden) every time it moves,
   and the signature used to carry nine of them: the brush bar's own state
   (fill, drift, matrix, free planting, brush size, erase mode, woody age), the
   selection, and the rail's open menu. So Draw/Drift, a brush size and a first
   switch to Select, Pick or Erase each rebuilt ~950 nodes to redraw nothing.
   The brush bar is not in #trayTabs/#toolTray: renderBrushBar redraws it, and
   every control that changes its state calls that itself. */
let trayCacheSig=null, discoverySearchView=null;
/* The tools the canvas rail arms and the catalog never lists. The catalog reads
   game.tool only by comparing it with what it shows (an armed plant's card, a
   landscape tool's chip and its contextual options), so one of these is, to the
   catalog, the same as nothing armed. Named rather than derived from TRAY_CATS
   because that table is not the whole list the catalog compares against:
   Edit footprint ('building-edit') is shown on the Site tab and is not in it. A
   test holds the catalog's renderers to never comparing against these. */
const RAIL_ONLY_TOOLS=new Set(['hand','select','ruler','pick','shovel']);
function catalogToolKey(){
  return (RAIL_ONLY_TOOLS.has(game.tool) ? '' : (game.tool||''))+'|'+(game.toolVar||'');
}
function trayStateSig(ignoreDiscoverySearch=false){
  const g=game;
  const j=v=>{ try{ return JSON.stringify(v===undefined?null:v); }catch(_){ return '?'; } };
  // A query changes only these discovery fields and the results drill-in.
  // Share the full guard's inputs so new panel dependencies also invalidate
  // the narrow search refresh; do not maintain a second dependency list.
  const discovery=ignoreDiscoverySearch ? Object.assign({},g.discovery,
    {query:'',category:null,returnCategory:null,limit:36}) : g.discovery;
  return [
    g.inGarden?1:0, g.trayCat, g.drill||'', catalogToolKey(),
    g.searchOpen?1:0, g.traySearch||'',
    g.sheetState||'', g.sheetCollapsed?1:0,
    g.edgeStyle||'',
    g.pathColor||'', g.bedStyle||'', g.waterStyle||'', g.lawnStyle||'',
    g.layerFocus||'', typeof layerVisibilitySig==='function'?layerVisibilitySig():'',
    g.photoEditing?1:0, g.buildingEditMode||'',
    normalizeSiteNorthDeg?normalizeSiteNorthDeg(g.siteNorthDeg):g.siteNorthDeg,
    // the site photo: identity by length + the knobs the Site tab shows
    g.underlay?[g.underlay.visible?1:0,g.underlay.opacity,g.underlay.rotation,
      g.underlay.data?g.underlay.data.length:0].join(',') : '-',
    j(g.underlayCalibration),
    j(discovery), j(g.filters),
    /* The garden style. It ranked the catalog before and now also decides what
       `recommended` holds at all, so it is squarely a tray input. Nothing
       writes game.design after enterGarden today -- all three writers run
       before it -- which is why its absence never showed; an in-garden style
       picker would have opened on a stale catalog. */
    activeDesignType()||'-',
    g.challenge?j([g.challenge.id,g.challenge.title,g.challenge.match,g.challenge.palette,g.challenge.paletteFree]):'-',
    // every draft the tray paints a chip from
    j([g.fenceDraft,g.lightDraft,g.firepitDraft,g.waterFeatureDraft,g.supportDraft,g.boulderDraft,g.petDraft,g.potDraft,
       g.seatDraft,g.ornamentDraft,g.edgingDraft,g.crossingDraft,g.surveyDraft,g.surveyLayer,g.wallDraft,g.terraceDraft,g.bermDraft,g.stepDraft,g.buildingStyleDraft,g.buildingDraft,
       g.houseDraft]),
    g.lastBrushTool||'', g.lastBrushVar||'', g.lastBrushTrayCat||'', g.lastBrushDrill||'',
    // tray-module state that changes what is drawn
    ignoreDiscoverySearch?'':discoveryOpenSpecies||'', sourceMenuOpen?1:0, paletteRenameId||'',
    j(palettePendingRef), j(ignoreDiscoverySearch?null:catalogCategoryFocus), j(lastCatByGroup),
    replacePlantContext?1:0, sitePhotoEditState?1:0,
    j(discoveryCriteriaDraft), landscapeShelfOpen||'',
    // Favorites and palettes live outside `game`, and the heart on every card
    // reads them.
    typeof plantCollectionsRevision==='function'?plantCollectionsRevision():0,
    // Theme repaints every canvas icon in the tray (uiInk is theme-cached), and
    // the layout changes across the sheet/dock breakpoint.
    (document.documentElement&&document.documentElement.getAttribute('data-theme'))||'',
    typeof mobileSheetUi==='function'?(mobileSheetUi()?1:0):0,
    catalogView(),
    VW, VH,
  ].join('|');
}
/* The DOM can be emptied under us — a screen change, a crash panel — and the
   signature would happily say "unchanged". Cheap insurance. */
function trayDomIntact(){
  const tabs=document.getElementById('trayTabs');
  return !!(tabs && tabs.firstChild);
}
function buildToolTray(force){
  if (!force && trayCacheSig!==null && trayDomIntact() && trayStateSig()===trayCacheSig) return false;
  openDiscoveryMemo();
  try { buildToolTrayInner(); }
  finally { closeDiscoveryMemo(); }
  // AFTER, not before: buildToolTrayInner normalises game.trayCat and writes
  // lastCatByGroup, so the signature it settles on is the one to remember.
  trayCacheSig=trayStateSig();
  tourRender();   // the tray was replaced; re-pin any callout anchored into it
  return true;
}
/* Keep the input, source/filter controls, category scroller and placement
   footer alive while typing. Only counts, category facets and results depend
   on the query. A full rebuild retires this view and cancels its pending work. */
function refreshDiscoverySearch(find){
  const view=discoverySearchView;
  if (!view || view.find!==find || !find.isConnected) return false;
  if (view.sig!==trayStateSig(true)){
    // An unrelated state change still requires the full renderer. Preserve
    // editing state only if this input still owns focus; never steal it back.
    const focused=document.activeElement===find;
    const selection=[find.selectionStart,find.selectionEnd,find.selectionDirection];
    buildToolTray();
    const next=document.getElementById('trayFind');
    if (focused&&next){ next.focus({preventScroll:true}); next.setSelectionRange(...selection); }
    return true;
  }
  if (trayStateSig()===trayCacheSig) return false;
  openDiscoveryMemo();
  try {
    saveTrayScroll();
    game.trayCat=plantTrayCategoryId(); lastCatByGroup.plants=game.trayCat;
    const refs=discoveryRefs(), count=discoveryResultCountText(refs);
    view.count.textContent=count;
    const meta=document.getElementById('catalogMeta');
    if (meta) meta.textContent=`${discoverySourceLabel(activeDiscovery())} \u00b7 ${count}`;
    renderDiscoveryCategories(view.categoryStrip,view.selectCat);
    const tray=document.getElementById('toolTray'); tray.innerHTML='';
    tray.classList.remove('cultivar-drill');
    renderDiscoveryTray(tray);
    restoreTrayScroll();
  } finally { closeDiscoveryMemo(); }
  view.sig=trayStateSig(true); trayCacheSig=trayStateSig();
  tourRender();
  return true;
}
/* One cell of the category grid: a name and, for plants, a count under it.
   Built once and updated in place, because the search refresh keeps the cells
   mounted (a rebuilt cell would drop keyboard focus on every keystroke). */
const categoryCells=new WeakMap();   // button -> {name,count}; see cardDetails for why not a property
function categoryCell(id,onPick){
  const b=document.createElement('button'); b.type='button'; b.dataset.categoryId=id;
  const name=document.createElement('span'); name.className='cat-name';
  const count=document.createElement('span'); count.className='cat-count';
  b.append(name,count); categoryCells.set(b,{name,count});
  b.onclick=()=>{ if (b.getAttribute('aria-disabled')!=='true') onPick(); };
  return b;
}
function renderDiscoveryCategories(strip,selectCat){
  const d=activeDiscovery(), tally=discoveryCategoryCounts(d);
  const categories=[{id:'all',label:'All'},...TRAY_CATS.filter(c=>TRAY_GROUPS[0].cats.includes(c.id))];
  const existing=new Map([...strip.children].map(b=>[b.dataset.categoryId,b]));
  for (const c of categories){
    const count=c.id==='all'?tally.all:tally.counts[c.id]||0;
    let b=existing.get(c.id);
    if (!b||!categoryCells.has(b)){
      if (b) b.remove();
      b=categoryCell(c.id,()=>{ catalogCategoryFocus={groupId:'plants',id:c.id}; selectCat(c.id==='all'?null:c.id); });
      strip.appendChild(b);
    }
    const selected=c.id==='all'?!d.category:d.category===c.id;
    /* A category with nothing in it keeps its PLACE, dimmed. Removing it moved
       every cell after it whenever the source or a search changed. The one
       that is open stays live even at nothing, so it can still be left. */
    const empty=!count&&!selected;
    b.className=(selected?'sel':'')+(empty?(selected?' ':'')+'empty':'');
    const cell=categoryCells.get(b);
    cell.name.textContent=c.short||c.label; cell.count.textContent=String(count);
    b.title=`${c.label} · ${count} plant${count===1?'':'s'}`;
    b.setAttribute('aria-label',`${c.label}, ${count} plant${count===1?'':'s'}`);
    b.setAttribute('aria-pressed',selected?'true':'false');
    if (empty) b.setAttribute('aria-disabled','true'); else b.removeAttribute('aria-disabled');
  }
}
/* ---- dev-only: prove the signature is complete ----
   A missed input shows up as a catalog that does not update, which is the kind
   of bug that survives a long time because it looks like "I must have mis-clicked".
   So drive it: for each input, change it, ask whether the DOM moved, and report
   any input that moved the DOM without moving the signature.

     verifyTrayCache()

   Each case is {set, restore}. Anything that changes what the tray draws
   belongs here as well as in trayStateSig. */
function verifyTrayCache(){
  if (!document.getElementById('trayTabs')){ console.warn('verifyTrayCache: no tray in the DOM.'); return null; }
  const dom=()=>{ const t=document.getElementById('trayTabs'), b=document.getElementById('toolTray');
    return (t?t.innerHTML:'')+'\0'+(b?b.innerHTML:''); };
  const g=game;
  const cases=[
    /* Arm a species that is actually IN the open category. 'shovel' looked like
       a fine probe and was a no-op: entering a garden arms Hand, so no card was
       selected before or after and the DOM never moved — the case passed while
       testing nothing. */
    ['tool',        ()=>{ const o=g.tool, ov=g.toolVar;
                          const cat=TRAY_CATS.find(c=>c.id===g.trayCat), keys=trayKeys();
                          const inCat=keys.filter(k=>cat&&cat.types&&cat.types.includes(PLANTS[k].type)
                            &&(!cat.sunFilter||PLANTS[k].sun===cat.sunFilter));
                          g.tool=inCat[0]||keys[0]||'shovel'; g.toolVar=null;
                          return ()=>{ g.tool=o; g.toolVar=ov; }; }],
    ['toolVar',     ()=>{ const o=g.toolVar; g.toolVar='zzz'; return ()=>{ g.toolVar=o; }; }],
    /* The rail's own tools are folded out of the signature (RAIL_ONLY_TOOLS), so
       each is probed from Hand: any of them moving the catalog is a stale tray. */
    ...['select','ruler','pick','shovel'].map(t=>['tool: rail '+t,
                          ()=>{ g.tool=t; return ()=>{}; },
                          ()=>{ const o=g.tool, ov=g.toolVar; g.tool='hand'; g.toolVar=null;
                                return ()=>{ g.tool=o; g.toolVar=ov; }; }]),
    ['toolMenu',    ()=>{ const o=g.toolMenu; g.toolMenu=(o==='layers'?null:'layers'); return ()=>{ g.toolMenu=o; }; }],
    ['freePlanting',()=>{ const o=g.freePlanting; g.freePlanting=!o; return ()=>{ g.freePlanting=o; }; }],
    ['trayCat',     ()=>{ const o=g.trayCat; g.trayCat='landscape'; return ()=>{ g.trayCat=o; }; }],
    ['drill',       ()=>{ const o=g.drill; g.drill='fence'; return ()=>{ g.drill=o; }; }],
    ['traySearch',  ()=>{ const o=g.traySearch; g.traySearch='sedge'; return ()=>{ g.traySearch=o; }; }],
    ['fillMode',    ()=>{ const o=g.fillMode; g.fillMode=!o; return ()=>{ g.fillMode=o; }; }],
    ['matrix',      ()=>{ const o=g.matrix; g.matrix=!o; return ()=>{ g.matrix=o; }; }],
    ['drift',       ()=>{ const o=g.drift; g.drift=!o; return ()=>{ g.drift=o; }; }],
    ['brushSize',   ()=>{ const o=g.brushSize; g.brushSize=(o===5?3:5); return ()=>{ g.brushSize=o; }; }],
    ['eraseMode',   ()=>{ const o=g.eraseMode; g.eraseMode=(o==='all'?'plant':'all'); return ()=>{ g.eraseMode=o; }; }],
    ['woodyAge',    ()=>{ const o=g.woodyAge; g.woodyAge=(o==='mature'?'new':'mature'); return ()=>{ g.woodyAge=o; }; }],
    ['edgeStyle',   ()=>{ const o=g.edgeStyle; g.edgeStyle=(o==='organic'?'formal':'organic'); return ()=>{ g.edgeStyle=o; }; }],
    ['pathColor',   ()=>{ const o=g.pathColor; g.pathColor=(o==='warm'?'lime':'warm'); return ()=>{ g.pathColor=o; }; }],
    ['bedStyle',    ()=>{ const o=g.bedStyle; g.bedStyle=(o==='soil'?'gravel':'soil'); return ()=>{ g.bedStyle=o; }; }],
    ['waterStyle',  ()=>{ const o=g.waterStyle; g.waterStyle=(o==='pond'?'lake':'pond'); return ()=>{ g.waterStyle=o; }; }],
    ['lawnStyle',   ()=>{ const o=g.lawnStyle; g.lawnStyle=(o==='meadow'?'moss':'meadow'); return ()=>{ g.lawnStyle=o; }; }],
    ['landscapeShelf',()=>{ const o=landscapeShelfOpen; landscapeShelfOpen=(o==='path'?'bed':'path'); return ()=>{ landscapeShelfOpen=o; }; }],
    ['edgingDraft', ()=>{ const o=g.edgingDraft; g.edgingDraft=(edgingDraft()==='steel'?'brick':'steel'); return ()=>{ g.edgingDraft=o; }; }],
    ['sel',         ()=>{ const o=g.sel; g.sel=o?null:{x0:1,y0:1,x1:3,y1:3}; return ()=>{ g.sel=o; }; }],
    ['selMode',     ()=>{ const o=g.selMode; g.selMode=(o==='copy'?'move':'copy'); return ()=>{ g.selMode=o; }; }],
    ['layerFocus',  ()=>{ const o=g.layerFocus; g.layerFocus=(o==='bulbs'?'all':'bulbs'); return ()=>{ g.layerFocus=o; }; }],
    ['layerVis',    ()=>{ const o=g.layerVis.bulbs; g.layerVis.bulbs=!o; return ()=>{ g.layerVis.bulbs=o; }; }],
    ['photoEditing',()=>{ const o=g.photoEditing; g.photoEditing=!o; return ()=>{ g.photoEditing=o; }; }],
    ['siteNorthDeg',()=>{ const o=g.siteNorthDeg; g.siteNorthDeg=((+o||0)+37)%360; return ()=>{ g.siteNorthDeg=o; }; }],
    ['discovery',   ()=>{ const o=JSON.parse(JSON.stringify(g.discovery||{}));
                          setDiscovery({limit:(g.discovery&&g.discovery.limit||36)+36});
                          return ()=>{ g.discovery=o; }; }],
    ['challenge',   ()=>{ const o=g.challenge; g.challenge=o?null:{id:'probe',title:'Probe'}; return ()=>{ g.challenge=o; }; }],
    ['design.type', ()=>{ const o=g.design;
                          g.design=Object.assign({},o||{},{type:(o&&o.type)==='formal'?'cottage':'formal'});
                          return ()=>{ g.design=o; }; }],
    ['fenceDraft',  ()=>{ const o=g.fenceDraft; g.fenceDraft=Object.assign({},o,{height:(o&&o.height)===6?4:6}); return ()=>{ g.fenceDraft=o; }; }],
    ['waterFeatureDraft', ()=>{ const o=g.waterFeatureDraft; g.waterFeatureDraft={form:'tiered',finish:'slate',face:0}; return ()=>{ g.waterFeatureDraft=o; }; }],
    ['supportDraft',  ()=>{ const o=g.supportDraft; g.supportDraft={style:'arch',mat:'black',face:0}; return ()=>{ g.supportDraft=o; }; }],
    ['potDraft',    ()=>{ const o=g.potDraft; g.potDraft=Object.assign({},o,{style:(o&&o.style)==='urn'?'timber':'urn'}); return ()=>{ g.potDraft=o; }; }],
    ['ornamentDraft',()=>{ const o=g.ornamentDraft; g.ornamentDraft=Object.assign({},o,{kind:(o&&o.kind)==='sundial'?'lantern':'sundial'}); return ()=>{ g.ornamentDraft=o; }; }],
    ['seatDraft',   ()=>{ const o=g.seatDraft; g.seatDraft=Object.assign({},o,{face:(((o&&o.face)|0)+1)%4}); return ()=>{ g.seatDraft=o; }; }],
    ['petDraft',    ()=>{ const o=g.petDraft; g.petDraft=Object.assign({},o,{species:(o&&o.species)==='cat'?'dog':'cat'}); return ()=>{ g.petDraft=o; }; }],
    ['edgingDraft', ()=>{ const o=g.edgingDraft; g.edgingDraft=(o==='steel'?'timber':'steel'); return ()=>{ g.edgingDraft=o; }; }],
    ['wallDraft',   ()=>{ const o=g.wallDraft; g.wallDraft=(o==='stone'?'brick':'stone'); return ()=>{ g.wallDraft=o; }; }],
    ['stepDraft',   ()=>{ const o=g.stepDraft; g.stepDraft={w:(o&&o.w)==='brick'?'sleeper':'brick',tread:'slate',width:(o&&o.width)===2?4:2}; return ()=>{ g.stepDraft=o; }; }],
    ['terraceDraft',()=>{ const o=g.terraceDraft; g.terraceDraft={h:(o&&o.h)===1?4:1,w:(o&&o.w)==='brick'?'gabion':'brick'}; return ()=>{ g.terraceDraft=o; }; }],
    ['bermDraft',   ()=>{ const o=g.bermDraft; g.bermDraft={h:(o&&o.h)===5?-2:5}; return ()=>{ g.bermDraft=o; }; }],
    ['discoveryOpenSpecies',()=>{ const o=discoveryOpenSpecies; discoveryOpenSpecies=o?null:'coneflower'; return ()=>{ discoveryOpenSpecies=o; }; }],
    ['sourceMenuOpen',()=>{ const o=sourceMenuOpen; sourceMenuOpen=!o; return ()=>{ sourceMenuOpen=o; }; }],
    ['catalogView', ()=>{ const o=catalogViewPref; catalogViewPref=catalogView()==='grid'?'list':'grid'; return ()=>{ catalogViewPref=o; }; }],
    ['collections', ()=>{ const ref=allPlantRefs&&allPlantRefs()[0];
                          if (!ref) return ()=>{};
                          toggleFavorite(ref); return ()=>{ toggleFavorite(ref); }; }],
  ];
  buildToolTray(true);
  const misses=[], inert=[];
  // A case may bring a `prep`, run BEFORE the baseline is taken: the rail-tool
  // cases have to be measured from Hand, whatever is armed when this is called.
  for (const [name,mutate,prep] of cases){
    let unprep=null;
    if (prep){ try{ unprep=prep(); }catch(_){ } buildToolTray(true); }
    const sigBefore=trayStateSig(), domBefore=dom();
    let restore;
    try{ restore=mutate(); }catch(e){ misses.push({input:name, error:String(e&&e.message||e)}); if (unprep) unprep(); buildToolTray(true); continue; }
    const sigAfter=trayStateSig();
    buildToolTray(true);                       // force: what the tray SHOULD look like
    const domAfter=dom();
    const domMoved=domAfter!==domBefore, sigMoved=sigAfter!==sigBefore;
    if (domMoved && !sigMoved) misses.push({input:name, why:'DOM changed but the signature did not — STALE TRAY'});
    else if (!domMoved && sigMoved) inert.push(name);   // harmless: an extra rebuild, never a stale one
    try{ restore(); }catch(_){ }
    if (unprep){ try{ unprep(); }catch(_){ } }
    buildToolTray(true);
  }
  console.log('verifyTrayCache — '+cases.length+' inputs permuted\n'+
    (misses.length
      ? '  MISSING FROM THE SIGNATURE (stale tray):\n'+misses.map(m=>'    '+m.input+' — '+(m.why||m.error)).join('\n')
      : '  no input moved the DOM without moving the signature')+
    (inert.length ? '\n  in the signature but did not move the DOM here: '+inert.join(', ')+
                    '\n    (safe — costs an extra rebuild, never a stale one)' : ''));
  return {misses, inert, checked:cases.length};
}
/* ---- The Landscape library's opening pages (0.9.116) -----------------------
   Ground, Grade and Hardscape each opened on a row of five to seven small
   icons over an empty panel: measured, 53 to 72% of it unused on a phone and on
   the dock alike. What a tool does was in a tooltip, which a finger never sees,
   and every material was an arm-then-scroll away (a bluestone path: three taps
   and a scroll). Now Ground is a SHELF per tool with its surfaces face up,
   Grade a described row per tool, and Hardscape a picture card per tool under
   four things people place most. Every picture is painted by the app's own
   painters, as the chips always were. The sub-pages are unchanged. */
let landscapeShelfOpen=null;   // the Ground shelf showing every surface; in trayStateSig
function trayEl(tag,cls,text){ const e=document.createElement(tag); if (cls) e.className=cls; if (text!=null) e.textContent=text; return e; }
/* A canvas w x h CSS px at the device's scale (capped at 2). scaled: the context
   is pre-scaled, for vector painters; the chip painters take real pixels. */
function trayCanvas(w,h,scaled){
  const dpr=Math.min(2,(typeof devicePixelRatio==='number'&&devicePixelRatio)||1);
  const c=document.createElement('canvas'); c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
  const x=c.getContext('2d'); if (scaled&&x&&x.scale) x.scale(dpr,dpr);
  return {c,x,dpr,pw:c.width,ph:c.height};
}
// always in the chip, shown by .sel: refreshTray moves the class without a rebuild
function trayTick(){ const t=trayEl('i','lg-tick'); t.appendChild(uiIcon('check')); return t; }

const GROUND_SHELVES=[
  {k:'lawn',  name:'Lawn',  desc:'Long grass, clover or moss, or mow a path back', pop:['mown','meadow','clover']},
  {k:'path',  name:'Path',  desc:'Gravel, stone, paving and decking',              pop:['warm','bluestone','brick']},
  {k:'bed',   name:'Bed',   desc:'Soil, mulch, gravel or a bog to plant into',     pop:['soil','mulch','pea']},
  {k:'water', name:'Water', desc:'Paint a pond, a river, a lake or a formal pool', pop:['pond','formal','river']},
  {k:'crossing',name:'Crossing',desc:'Stepping stones or a bridge, laid over water', pop:['stepping','slab','plank']},
  {k:'edging',name:'Edging',desc:'Tap a bed to edge all of it against the lawn',   pop:['steel','brick','timber']}
];
function groundShelf(k){
  if (k==='lawn')   return {table:LAWN_STYLES,  cur:lawnStyle(game.lawnStyle).id,   data:'lawnStyle',  set:id=>{ game.lawnStyle=id; }};
  if (k==='path')   return {table:PATH_COLORS,  groups:PATH_GROUPS, cur:pathColor(game.pathColor).id, data:'pathColor', set:id=>{ game.pathColor=id; }};
  if (k==='bed')    return {table:BED_STYLES,   groups:BED_GROUPS,  cur:bedStyle(game.bedStyle).id,   data:'bedStyle',  set:id=>{ game.bedStyle=id; }};
  if (k==='water')  return {table:WATER_STYLES, cur:waterStyle(game.waterStyle).id, data:'waterStyle', set:id=>{ game.waterStyle=id; }};
  if (k==='edging') return {table:EDGING_STYLES,groups:EDGING_GROUPS,cur:edgingDraft(), data:'edging', set:id=>{ game.edgingDraft=edgingStyleId(id); }};
  if (k==='crossing') return {table:CROSSING_TYPES,cur:crossingDraft(), data:'crossing', set:id=>{ game.crossingDraft=crossingTypeId(id); }};
  return null;
}
/* What a shut shelf shows: the surface in hand first, then the common ones. */
function groundShelfFace(shelf,spec,n){
  const ids=[spec.cur,...shelf.pop,...spec.table.map(m=>m.id)];
  return ids.filter((id,i)=>ids.indexOf(id)===i&&spec.table.some(m=>m.id===id)).slice(0,n);
}
function renderGroundShelves(tray,cat){
  tray.classList.add('lg-page');
  GROUND_SHELVES.filter(s=>cat.tools.includes(s.k)).forEach(shelf=>{
    const spec=groundShelf(shelf.k), armed=game.tool===shelf.k, open=landscapeShelfOpen===shelf.k, more=spec.table.length>4;
    const head=trayEl('div','lg-head'); head.append(trayEl('b',null,shelf.name),trayEl('span',null,shelf.desc)); tray.appendChild(head);
    const chip=m=>{
      const on=armed&&spec.cur===m.id, b=trayEl('button','lg-chip'+(on?' sel':'')); b.type='button';
      b.dataset.k=shelf.k; b.dataset[spec.data]=m.id; b.setAttribute('aria-pressed',on?'true':'false');
      b.title=shelf.k==='lawn'&&m.none?'Mow back to plain lawn: lifts a meadow, and turfs over a bed or a path'
        :shelf.k==='edging'&&m.id==='none'?'Lift the edging back off'
        :shelf.k==='crossing'&&m.id==='none'?'Lift a crossing off the water, leaving the water':m.label;
      const {c,x}=trayCanvas(72,42,true);
      // nearly the whole tile at true scale, where the old chip showed a 36x22 crop
      if (shelf.k==='edging') drawEdgingIcon(x,m.id,72,42);
      else drawMaterialIcon(x,36,21,34,17,shelf.k,m.id);
      b.append(c,trayEl('span',null,m.short||m.label),trayTick());
      b.onclick=()=>{ spec.set(m.id); setTool(shelf.k,null); buildToolTray(); };
      tray.appendChild(b);
    };
    const toggle=(text,icon,title)=>{
      const b=trayEl('button','lg-chip lg-all'); b.type='button'; b.dataset.shelf=shelf.k; b.title=title;
      b.setAttribute('aria-expanded',open?'true':'false');
      b.append(trayEl('b',null,text),uiIcon(icon));
      b.onclick=()=>{ landscapeShelfOpen=open?null:shelf.k; buildToolTray();
        const again=document.querySelector('.lg-all[data-shelf="'+shelf.k+'"]'); if (again&&again.focus) again.focus({preventScroll:true}); };
      tray.appendChild(b);
    };
    if (open){
      /* Path and bed surfaces sit under a heading per GROUP (PATH_GROUPS,
         BED_GROUPS): twenty-odd chips in one run was a wall to read, and the
         heading says what kind of surface a chip is before its swatch does. */
      (spec.groups||[[null,null]]).forEach(([gid,gname])=>{
        if (gname) tray.appendChild(trayEl('p','lg-group',gname));
        spec.table.filter(m=>!gid||m.group===gid).forEach(chip);
      });
      toggle('Fewer','chevron-up','Show the common ones only');
    } else {
      groundShelfFace(shelf,spec,more?3:4).forEach(id=>chip(spec.table.find(m=>m.id===id)));
      if (more) toggle(`All ${spec.table.length}`,'chevron-down',`Every ${shelf.name.toLowerCase()} ${shelf.k==='edging'||shelf.k==='crossing'?'style':'surface'}`);
    }
  });
  /* Edge look for the whole garden — organic curves vs crisp tile edges
     (per-garden, defaulted from the questionnaire style, and it governs how
     edging draws as much as beds and paths). Rebuilds the ground cache so the
     change shows immediately.
     It hangs off the Ground TAB, not off an armed tool. Gated on
     game.tool==='path'||'bed'||'water' it vanished the moment you armed
     Edging — and, because entering a garden arms Hand, it was simply absent
     every time you reopened one, with no hint that arming Path was the way
     back to a garden-wide setting. */
  if (cat.tools.includes('path')||cat.tools.includes('bed')||cat.tools.includes('water')||cat.tools.includes('edging')){
    const edge=trayEl('div','lg-edge'), text=trayEl('div');
    text.append(trayEl('b',null,'Edges'),trayEl('small',null,game.edgeStyle==='organic'?'Beds and paths curve':'Crisp, straight tile edges'));
    const seg=trayEl('div','lg-seg'); seg.setAttribute('role','group'); seg.setAttribute('aria-label','Edge style for the whole garden');
    [['organic','Organic','Curved, naturalistic bed and path edges'],['formal','Formal','Crisp, straight tile edges']].forEach(([id,label,tip])=>{
      const on=game.edgeStyle===id, b=trayEl('button',on?'sel':'',label); b.type='button'; b.dataset.k='edge_'+id; b.title=tip;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.onclick=()=>{ game.edgeStyle=id; if (typeof groundKey!=='undefined') groundKey='';
        buildToolTray(); toast(id==='organic'?'Organic edges — beds and paths curve.':'Formal edges — crisp tile edges.');
        const again=document.querySelector('.lg-seg [data-k="edge_'+id+'"]'); if (again&&again.focus) again.focus({preventScroll:true}); };
      seg.appendChild(b);
    });
    edge.append(text,seg); tray.appendChild(edge);
  }
}

/* Grade: a row per tool that says what it does. Those sentences were the
   buttons' tooltips, so on a phone nobody had read them. The armed tool's
   options open under its own row. */
/* Terrace leads and is the tool: it builds a raised bed, a terrace or a sunken
   patio with its wall and its top, and a tap on one changes just what the panel
   was set to. Raise, Lower and Level sit under their own heading, as the tools
   for berms and swales, so they no longer read as four more ways to build a
   terrace. Wall has no row of its own (0.9.145): Terrace refaces a terrace
   without touching its height, which was all Wall added. The tool stays, for
   search and for a brush the rail remembers, and shows its row while armed. */
const GRADE_TOOLS=[
  {k:'terrace',name:'Terrace',desc:'A raised bed, terrace or sunken patio, with its wall and its top. Drag corner to corner, or tap. Tap one to change it.'},
  // a function, for the riser in the reader's units
  {k:'steps',  name:'Steps',  desc:()=>`A flight down from a terrace or into a sunken patio, a step for every ${fmtLengthIn(ELEV_RISER_IN)}. Tap the edge where it goes.`},
  {k:'wall',   name:'Wall',   desc:'Face a whole terrace or sunken patio with stone, brick or timber. Tap it.', armedOnly:true},
  {k:'berm',   name:'Berm',   desc:'A soft mound of earth, or a swale dug to catch rain. Drag out its size, or tap.', shape:true},
  {k:'raise',  name:'Raise',  desc:'Lift the ground a step by hand, as soft earth.', shape:true},
  {k:'lower',  name:'Lower',  desc:'Dig the ground down a step by hand.', shape:true},
  {k:'level',  name:'Level',  desc:'Put the ground back to grade.', shape:true}
];
function drawGradeIcon(tc,kind){
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
  tc.fillStyle=uiInk('--icon-ink'); tc.font='700 18px IBM Plex Sans'; tc.textAlign='center';
  tc.fillText(kind==='level'?'0':(high?'+':'-'),24,26+(low?8:0));
}
function renderGradeTools(tray,cat){
  tray.classList.add('lg-page');
  const sep=t=>tray.appendChild(trayEl('span','tray-sep',t));
  const optionBtn=(k,label,sel,draw,fn,tip)=>{
    const b=trayEl('button','tool'+(sel?' sel':'')); b.dataset.k=k;
    const c=document.createElement('canvas'); c.width=48; c.height=44; draw(c.getContext('2d'));
    b.append(c,trayEl('span',null,label)); b.title=tip||label; b.onclick=fn;
    tray.appendChild(b); return b;
  };
  let shaped=false;
  GRADE_TOOLS.filter(t=>cat.tools.includes(t.k) && (!t.armedOnly || game.tool===t.k)).forEach(t=>{
    if (t.shape && !shaped){ shaped=true;
      const head=trayEl('div','lg-head'); head.append(trayEl('b',null,'Shape the ground'),trayEl('span',null,'Berms and swales, as soft earth with no walls'));
      tray.appendChild(head); }
    const on=game.tool===t.k, b=trayEl('button','lt-row'+(on?' sel':'')); b.type='button'; b.dataset.k=t.k;
    b.setAttribute('aria-pressed',on?'true':'false');
    const {c,x}=trayCanvas(48,44,true);
    if (t.k==='terrace') drawTerraceIcon(x,terraceDraft()); else if (t.k==='steps') drawStepsIcon(x,stepDraft());
    else if (t.k==='wall') drawWallIcon(x,wallDraft()); else if (t.k==='berm') drawBermIcon(x,bermDraft()); else drawGradeIcon(x,t.k);
    const text=trayEl('span','lt-text'); text.append(trayEl('b',null,t.name),trayEl('small',null,typeof t.desc==='function'?t.desc():t.desc));
    const cur=t.k==='terrace'?terraceLabel():t.k==='steps'?stepsLabel():t.k==='wall'?wallLabel():t.k==='berm'?bermLabel():'';
    if (cur) text.appendChild(trayEl('em',null,cur));
    b.append(c,text); b.onclick=()=>{ setTool(t.k,null); buildToolTray(); };
    tray.appendChild(b);
    if (on&&t.k==='terrace'){
      const td=terraceDraft();
      // a choice made here is one a tap on an existing terrace will change (terraceTouched)
      const arm=(next,field)=>{ game.terraceDraft=normalizeTerraceDraft(Object.assign({},terraceDraft(),next));
        touchTerrace(field); setTool('terrace',null); buildToolTray(); };
      sep('Height');
      TERRACE_LEVELS.forEach(h=>optionBtn('terrace',terraceHeightText(h),td.h===h,
        tc=>drawTerraceIcon(tc,{h,w:td.w,top:td.top}),()=>arm({h},'h'),
        h<0?`Sink it ${terraceInches(h)} below the ground around it`
           :`Raise it ${terraceInches(h)}`).dataset.terraceH=String(h));
      sep('Wall');
      WALL_STYLES.forEach(ws=>optionBtn('terrace',ws.face?(ws.short||ws.label):'Bank',td.w===ws.id,
        tc=>drawTerraceIcon(tc,{h:td.h,w:ws.id,top:td.top}),()=>arm({w:ws.id},'w'),
        ws.face?ws.label:'A grass bank — no wall').dataset.terraceW=ws.id);
      sep('Top');
      // named by kind; the picture shows the material ("Bluestone" alone did not say paving)
      TERRACE_TOPS.forEach(tp=>optionBtn('terrace',tp.label,td.top===tp.id,
        tc=>drawTerraceIcon(tc,{h:td.h,w:td.w,top:tp.id}),()=>arm({top:tp.id},'top'),
        tp.id==='keep' ? 'Leave the top as it is'
          : `Lay the top with ${terraceTopText(tp.id).replace(/^a |^paved in |^laid to /,'')}: the ${tp.label.toLowerCase()} you last chose under Ground`).dataset.terraceTop=tp.id);
      tray.appendChild(trayEl('p','lg-note','Tap a terrace to change it to what you pick here. What you have not picked stays as it is.'));
    }
    if (on&&t.k==='berm'){
      const bd=bermDraft(), arm=h=>{ game.bermDraft=normalizeBermDraft({h}); setTool('berm',null); buildToolTray(); };
      sep('Height');
      BERM_LEVELS.filter(h=>h>0).forEach(h=>optionBtn('berm',terraceInches(h),bd.h===h,tc=>drawBermIcon(tc,{h}),()=>arm(h),
        `A berm ${bermHeightText(h)} at its crown`).dataset.bermH=String(h));
      sep('Swale');
      BERM_LEVELS.filter(h=>h<0).forEach(h=>optionBtn('berm',terraceInches(h),bd.h===h,tc=>drawBermIcon(tc,{h}),()=>arm(h),
        `A swale ${bermHeightText(h)} in the middle`).dataset.bermH=String(h));
      tray.appendChild(trayEl('p','lg-note',`Drag out the box it fills, corner to corner: the berm is the oval inside it, with a broad top and sides that fall away gently. A small box keeps it lower. Beds, paths and plants on the ground ride up with it.`));
    }
    if (on&&t.k==='steps'){
      const sd=stepDraft(), arm=next=>{ game.stepDraft=normalizeStepDraft(Object.assign({},sd,next)); setTool('steps',null); buildToolTray(); };
      sep('Riser');
      STEP_RISERS.forEach(id=>{ const ws=wallStyle(id);
        optionBtn('steps',ws.short||ws.label,sd.w===id,tc=>drawStepsIcon(tc,Object.assign({},sd,{w:id})),()=>arm({w:id}),
          `Risers and sides in ${lowerFirst(ws.label)}`).dataset.stepW=id; });
      sep('Tread');
      STEP_TREADS.forEach(id=>{ const pc=pathColor(id);
        optionBtn('steps',pc.short||pc.label,sd.tread===id,tc=>drawStepsIcon(tc,Object.assign({},sd,{tread:id})),()=>arm({tread:id}),
          `Treads of ${lowerFirst(pc.label)}`).dataset.stepTread=id; });
      sep('Width');
      STEP_WIDTHS.forEach(w=>optionBtn('steps',fmtFeet(w*TILE_IN/12,1),sd.width===w,tc=>drawStepsIcon(tc,Object.assign({},sd,{width:w})),
        ()=>arm({width:w}),`A flight ${fmtFeet(w*TILE_IN/12,1)} wide`).dataset.stepWidth=String(w));
      tray.appendChild(trayEl('p','lg-note','Tap the edge of a terrace or sunken patio where the steps go, and the flight runs straight down from it. Tap a flight to change its riser and tread.'));
    }
    if (on&&t.k==='wall'){
      sep('Wall material');
      WALL_STYLES.forEach(ws=>optionBtn('wall',ws.short||ws.label,
        wallDraft()===ws.id, tc=>drawWallIcon(tc,ws.id),
        ()=>{ game.wallDraft=wallStyleId(ws.id); setTool('wall',null); buildToolTray(); },
        ws.id==='none'?'Strip the facing back to bare earth':ws.label).dataset.wallStyle=ws.id);
    }
  });
}

/* The Structures, Features and Furnishings tabs (0.9.153): what people place
   most, armed in one tap, then a card per tool that opens its page. This was
   the Hardscape tab's layout; Lighting and Decor were bare rows of chips. A
   card's art is the tool's own draft drawn by the painter the garden uses. */
const TOOL_CARDS=[
  // a function where it carries a size, so it follows the units preference
  {k:'fence',       name:'Fence',        desc:()=>`Fences, walls and gates, ${fmtFeet(FENCE_HEIGHTS[0])} to ${fmtFeet(FENCE_HEIGHTS[FENCE_HEIGHTS.length-1])}`},
  {k:'pergola',     name:'Pergola',      desc:'A roof over a patio, for climbers and string lights'},
  {k:'support',     name:'Support',      desc:'A trellis, obelisk, arch, wires or a wigwam for a climber'},
  {k:'waterfeature',name:'Water feature',desc:'A birdbath, urn, fountain or basin'},
  {k:'firepit',     name:'Fire pit',     desc:'Stone, brick, steel or a fire bowl'},
  {k:'boulder',     name:'Boulder',      desc:'Rocks, ledges and standing stones'},
  {k:'ornament',    name:'Ornament',     desc:'Spheres, sundials and lanterns, and homes for birds and bees'},
  {k:'seat',        name:'Seating',      desc:'Benches, chairs, tables and loungers'},
  {k:'pot',         name:'Container',    desc:'Pots and troughs, which can be planted on paving'},
  {k:'light',       name:'Lighting',     desc:'Path lights, lanterns, uplights and torches'},
  {k:'pet',         name:'Pet',          desc:'A cat or a dog. It takes up no ground.'}
];
const TOOL_PICKS=[
  {k:'fence',  label:'Cedar fence',   d:{style:'privacy',height:6,gate:false}},
  {k:'fence',  label:'Stone wall',    d:{style:'stone',height:3,gate:false}},
  {k:'pergola',label:'Pergola',d:{mat:'timber',height:8,lights:'none'}},
  {k:'support',label:'Trellis',d:{style:'trellis',mat:'timber',face:0,pat:'diamond'}},
  {k:'waterfeature',label:'Birdbath', d:{form:'birdbath'}},
  {k:'firepit',label:'Brick fire pit',d:{style:'brick',finish:'tumbled',shape:'round',size:'round36',face:0}},
  {k:'ornament',label:'Sphere', d:{kind:'sphere'}},
  {k:'seat',   label:'Teak bench',    d:{type:'bench6',finish:'teak',face:0}},
  {k:'pot',    label:'Terracotta',d:{style:'terracotta',size:'p18'}},
  {k:'light',  label:'Path light',    d:{type:'path'}}
];
/* Each tool's draft: where it lives on game, the normaliser the eyedropper
   uses, the one in hand, and what that one is called. */
const TOOL_DRAFTS={
  fence:['fenceDraft',d=>normalizeFenceDraft(d),()=>fenceDraft(),()=>fenceLabel()],
  pergola:['pergolaDraft',d=>normalizePergolaDraft(d),()=>pergolaDraft(),()=>pergolaLabel()],
  support:['supportDraft',d=>normalizeSupportDraft(d),()=>supportDraft(),()=>supportLabel()],
  waterfeature:['waterFeatureDraft',d=>normalizeWaterFeatureDraft(d),()=>waterFeatureDraft(),()=>waterFeatureLabel()],
  firepit:['firepitDraft',d=>normalizeFirepitDraft(d),()=>firepitDraft(),()=>firepitLabel()],
  boulder:['boulderDraft',d=>normalizeBoulderDraft(d),()=>boulderDraft(),()=>boulderLabel()],
  ornament:['ornamentDraft',d=>normalizeOrnamentDraft(d),()=>ornamentDraft(),()=>ornamentLabel()],
  seat:['seatDraft',d=>normalizeSeatDraft(d),()=>seatDraft(),()=>seatLabel()],
  pot:['potDraft',d=>normalizePotDraft(d),()=>potDraft(),()=>potLabel()],
  light:['lightDraft',d=>normalizeLightDraft(d),()=>lightDraft(),()=>lightLabel()],
  pet:['petDraft',d=>normalizePetDraft(d),()=>petDraft(),()=>petLabel()]
};
// tool k's draft, normalised: the one in hand, or d
function toolCardDraft(k,d){ const t=TOOL_DRAFTS[k]; return t ? t[1](d||t[2]()) : (d||null); }
function toolCardLabel(k){ const t=TOOL_DRAFTS[k]; return t ? cap(t[3]()) : ''; }
// which way a piece is turned is not which piece it is
function toolPickOn(i){
  const p=TOOL_PICKS[i]; if (!p||game.tool!==p.k) return false;
  const same=d=>JSON.stringify(Object.assign({},d,{face:0}));
  return same(toolCardDraft(p.k))===same(toolCardDraft(p.k,p.d));
}
function armToolPick(i){
  const p=TOOL_PICKS[i], t=p&&TOOL_DRAFTS[p.k]; if (!t) return;
  game[t[0]]=toolCardDraft(p.k,p.d);
  game.drill=null; setTool(p.k,null); rememberBrushMenu(game.trayCat,null); buildToolTray();
}
/* The tool's draft, drawn w x h by the painter the garden uses for it. */
function toolCardArt(k,w,h,d){
  d=toolCardDraft(k,d);
  if (k==='firepit'||k==='pergola'||k==='boulder'||k==='seat'||k==='ornament'||k==='support'){
    const {c,x,dpr,pw,ph}=trayCanvas(w,h,false);
    if (k==='firepit') drawFirepitChip(x,d,pw,ph,0.62*dpr);
    else if (k==='pergola') drawPergolaChip(x,d,pw,ph);
    else if (k==='boulder') drawBoulderChip(x,d,pw,ph,0.95*dpr);
    else if (k==='ornament') drawOrnamentChip(x,d,pw,ph,0.8*dpr);
    else if (k==='support') drawSupportChip(x,d,pw,ph,0.62*dpr);
    else drawSeatChip(x,d,pw,ph,0.7*dpr);
    return c;
  }
  const {c,x}=trayCanvas(w,h,true);
  if (!x) return c;
  if (k==='fence'){
    // three panels at the draft's real height, posts between them
    const st=fenceStyle(d.style), y=h-9, ph=Math.round(Math.min(h-16,7*d.height)), n=3, x0=12, seg=(w-24)/n;
    x.lineCap='round'; x.lineJoin='round';
    for (let i=0;i<n;i++) fencePanel(x,x0+i*seg,y,x0+(i+1)*seg,y,ph,st,st.infill,7+i);
    x.strokeStyle=st.post; x.lineWidth=st.infill==='masonry'?6:3.4;
    for (let i=0;i<=n;i++){ x.beginPath(); x.moveTo(x0+i*seg,y); x.lineTo(x0+i*seg,y-ph); x.stroke(); }
  } else if (k==='waterfeature'){
    const sp=waterFeature(d.form);
    const wPx=inchesToTiles(sp.wIn)*Math.SQRT2*TILE_W*(sp.bed?1.32:1.06), hPx=feetToPx(sp.hIn/12)+inchesToTiles(sp.dIn)*Math.SQRT2*TILE_H*0.62;
    const s=Math.min(0.5,(w-10)/wPx,(h-8)/hPx);
    x.save(); x.translate(w/2,h*0.8); x.scale(s,s);
    drawWaterFeatureArt(x,0,0,Object.assign({},d,{face:0}),'Summer',ISO_AXES_FLAT,0x5eed); x.restore();
  } else if (k==='pot'){
    // the pot page's own chip scale, grown with the card
    const s=Math.min(0.66,0.44*h/44);
    x.save(); x.translate(w/2,h*0.78); x.scale(s,s);
    drawPotArt(x,0,0,d,'Summer',ISO_AXES_FLAT); x.restore();
  } else if (k==='light'){
    const k2=Math.min(0.9,(h-12)/Math.max(1,feetToPx(lightHeightFt(d))));
    drawLightArt(x,w/2,h-6,d,!!game.layerVis.night,null,k2);
  } else if (k==='pet'){
    drawPet(x,w/2,h-5,d,Math.min(1.2,h/44*0.8));
  }
  return c;
}
function renderCardTabHome(tray,cat){
  tray.classList.add('lg-page');
  const picks=trayEl('div','lg-picks');
  TOOL_PICKS.forEach((p,i)=>{
    if (!cat.tools.includes(p.k)) return;
    const on=toolPickOn(i), b=trayEl('button','lg-chip lg-pick'+(on?' sel':'')); b.type='button'; b.dataset.pick=String(i);
    b.setAttribute('aria-pressed',on?'true':'false'); b.title=`${p.label}: armed in one tap`;
    b.append(toolCardArt(p.k,72,42,p.d),trayEl('span',null,p.label),trayTick());
    b.onclick=()=>armToolPick(i); picks.appendChild(b);
  });
  if (picks.children.length){ tray.appendChild(trayEl('p','lh-label','Popular')); tray.appendChild(picks); tray.appendChild(trayEl('p','lh-label',`All ${cat.label.toLowerCase()}`)); }
  TOOL_CARDS.filter(t=>cat.tools.includes(t.k)).forEach(t=>{
    const on=game.tool===t.k, label=toolCardLabel(t.k), b=trayEl('button','lh-card has-sub'+(on?' sel':'')); b.type='button'; b.dataset.k=t.k;
    const title=trayEl('span','lh-t'); title.append(trayEl('b',null,t.name),uiIcon('chevron-right'));
    b.append(toolCardArt(t.k,150,62),title,trayEl('small',null,typeof t.desc==='function'?t.desc():t.desc),trayEl('em',null,label));
    b.title=`${t.name}: ${label}. Open to choose.`;
    b.onclick=()=>{ setTool(t.k,null); game.drill=t.k; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); };
    tray.appendChild(b);
  });
}
function buildToolTrayInner(){
  clearTimeout(discoverySearchTimer); discoverySearchView=null;
  saveTrayScroll();
  resetDiscoveryArt();
  const tabs=document.getElementById('trayTabs'); tabs.innerHTML='';
  const syncedCategory=plantTrayCategoryId(); if (syncedCategory!==game.trayCat) game.trayCat=syncedCategory;
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat)||TRAY_CATS[0];
  const activeGroup=trayGroupOf(cat.id);
  const isPlantGroup=activeGroup==='plants';
  tabs.classList.toggle('has-discovery',isPlantGroup);
  lastCatByGroup[activeGroup]=game.trayCat;
  const selectCat=(id)=>{ saveTrayScroll(); game.toolMenu=null; game.drill=null; discoveryOpenSpecies=null; landscapeShelfOpen=null; closeDiscoverySourceMenu();
    const currentDiscovery=activeDiscovery(), searchActive=!!currentDiscovery.query.trim();
    /* The strip offers its All row in the plants branch ONLY, so this is only
       ever reached from a plant tab, and there it just clears the category. */
    if (id===null){ setDiscovery({category:null,returnCategory:searchActive?currentDiscovery.returnCategory:null,limit:36}); buildToolTray(); return; }
    game.trayCat=id;
    const targetIsPlants=trayGroupOf(id)==='plants';
    setDiscovery({category:targetIsPlants?id:null,returnCategory:targetIsPlants&&searchActive?id:null,limit:36});
    game.searchOpen=false; game.traySearch='';
    rememberBrushMenu(id,null);
    if (game.tool==='pick' || targetIsPlants!==isPlantGroup) setTool('hand');
    else refreshCanvasTools();
    buildToolTray(); };
  const switchGroup=(groupId)=>{
    if (groupId===activeGroup) return;
    const group=TRAY_GROUPS.find(g=>g.id===groupId); if (!group) return;
    if (groupId==='build') tourNote('landscape');
    saveTrayScroll(); game.trayCat=lastCatByGroup[groupId]||group.cats[0]; game.drill=null; closeDiscoverySourceMenu();
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
  /* On the sheet the Plants/Landscape switch lives in the HANDLE, which had
     nothing in it at half and full but "Tap to choose a plant". That gives its
     52px row back to the plants at both heights, and it stays reachable at
     half, where the control stack is hidden. The dock keeps it in the first
     control row. mobileSheetUi() is in the signature, so crossing the tiers
     rebuilds and moves it. */
  const handleMode=document.getElementById('sheetMode'), inHandle=!!(handleMode&&mobileSheetUi());
  if (handleMode&&handleMode.replaceChildren){ if (inHandle) handleMode.replaceChildren(modeControl()); else handleMode.replaceChildren(); }
  const controls=isPlantGroup?renderDiscoveryControls(tabs,inHandle?null:modeControl):renderLandscapeControls(tabs,inHandle?null:modeControl);
  const categoryStrip=document.createElement('div');
  categoryStrip.className='catalog-category-strip '+(isPlantGroup?'cats-plants':'cats-build');
  categoryStrip.setAttribute('role','group');
  categoryStrip.setAttribute('aria-label',isPlantGroup?'Plant categories':'Landscape categories');
  if (isPlantGroup){
    renderDiscoveryCategories(categoryStrip,selectCat);
  } else {
    TRAY_CATS.filter(c=>TRAY_GROUPS[1].cats.includes(c.id)).forEach(c=>{
      const selected=game.trayCat===c.id;
      const b=categoryCell(c.id,()=>{ catalogCategoryFocus={groupId:activeGroup,id:c.id}; selectCat(c.id); });
      const cell=categoryCells.get(b); cell.count.remove(); cell.name.textContent=c.label;
      b.className=selected?'sel':''; b.setAttribute('aria-pressed',selected?'true':'false');
      categoryStrip.appendChild(b);
    });
  }
  enableCategoryKeys(categoryStrip);
  tabs.appendChild(wrapCategoryStrip(categoryStrip));
  requestAnimationFrame(()=>{
    if (catalogCategoryFocus&&catalogCategoryFocus.groupId===activeGroup){
      const target=[...categoryStrip.querySelectorAll('button')].find(button=>button.dataset.categoryId===catalogCategoryFocus.id);
      catalogCategoryFocus=null;
      if (target) target.focus({preventScroll:true});
    }
  });
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  tray.classList.remove('discovery-results','cultivar-drill','landscape-results','view-grid','view-list');
  if (isPlantGroup){
    if (PLANTS[game.tool] && !plantRefFits(plantRef(game.tool,game.toolVar))){ game.tool='hand'; game.toolVar=null; }
    renderDiscoveryTray(tray); renderCvRow(); finishToolTrayRender();
    discoverySearchView={...controls,categoryStrip,selectCat,sig:trayStateSig(true)};
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
    if (designType){
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
  /* The opening page of a Landscape tab says what its tools are and shows
     what they lay (see renderGroundShelves). The sub-pages are as they were. */
  if (cat.id==='landscape'){ renderGroundShelves(tray,cat); finishToolTrayRender(); return; }
  if (cat.cards && !game.drill){ renderCardTabHome(tray,cat); finishToolTrayRender(); return; }
  if (cat.tools.some(isElevationTool)) renderGradeTools(tray,cat);
  /* One Back button for all four Hardscape sub-pages. It was three
     byte-identical closures, and adding the water feature would have made it
     four — the restated-table smell this file has been bitten by before. */
  const backBtn=()=>{
    const b=document.createElement('button');
    b.className='tool tool-back'; b.title=`Back to ${cat.label}`;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const bx=c.getContext('2d'); bx.strokeStyle=uiInk('--icon-ink-soft'); bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
    bx.beginPath(); bx.moveTo(28,13); bx.lineTo(17,22); bx.lineTo(28,31); bx.stroke();
    const sp=document.createElement('span'); sp.textContent='Back';
    b.append(c,sp);
    b.onclick=()=>{ game.drill=null; rememberBrushMenu(game.trayCat,null); buildToolTray(); };
    tray.appendChild(b);
  };
  if (cat.tools.includes('fence')){
    const fd=fenceDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    /* The chip paints through the garden's own fencePanel, so a material can
       never advertise a fence the canvas does not draw — and, because the chip
       height tracks the real feet, 3 ft and 8 ft are visibly different
       pictures rather than the same icon with a different caption. */
    const miniFence=(tc,d)=>{
      d=normalizeFenceDraft(d);
      const st=fenceStyle(d.style), y=36;
      const h=Math.round(Math.min(d.gate?21:30, (d.gate?2.5:3.4)*d.height));
      const pw=st.infill==='masonry'?5:3;
      tc.lineCap='round'; tc.lineJoin='round';
      const post=(px,ph)=>{ tc.strokeStyle=st.post; tc.lineWidth=pw;
        tc.beginPath(); tc.moveTo(px,y); tc.lineTo(px,y-ph); tc.stroke(); };
      if (d.gate){
        const ph=h*1.14, arch=(st.header||'arch')==='arch';
        post(10,ph); post(38,ph);
        tc.strokeStyle=st.rail; tc.lineWidth=arch?2.4:3;
        tc.beginPath(); tc.moveTo(10,y-ph);
        if (arch) tc.quadraticCurveTo(24,y-ph-h*0.5,38,y-ph); else tc.lineTo(38,y-ph);
        tc.stroke();
        fencePanel(tc,10,y,25,y+4,h*0.84,st,st.gateLeaf||st.infill,7);   // leaf standing open
        tc.strokeStyle=shade(st.post,14); tc.lineWidth=1.8;
        tc.beginPath();
        tc.moveTo(25,y+4); tc.lineTo(25,y+4-h*0.84);
        tc.moveTo(10,y-h*0.84); tc.lineTo(25,y+4-h*0.84);
        tc.moveTo(10,y); tc.lineTo(25,y+4-h*0.84);
        tc.stroke();
      } else {
        fencePanel(tc,9,y,39,y,h,st,st.infill,7);
        post(9,h); post(39,h);
      }
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
    /* What it is, what it is made of, how big: the order every Hardscape page
       keeps. The fence asked its height before its material, the other way round
       from the pergola, the fire pit and the rest. */
    if (game.drill==='fence'){
      backBtn();
      sep('Place');
      toolBtn('Fence', game.tool==='fence'&&!fd.gate, {gate:false}, 'Draw connected fence tiles');
      toolBtn('Gate', game.tool==='fence'&&!!fd.gate, {gate:true}, 'Draw walkable fence doors / gates');
      sep('Material');
      FENCE_STYLES.forEach(st=>toolBtn(st.short||st.label, fd.style===st.id, {style:st.id},
        `${st.label} — built at ${fenceStyleHeights(st.id).map(h=>fmtFeet(h)).join(', ')}`));
      sep('Height');
      // only the spans this material is really built at (see FENCE_STYLES.heights)
      fenceStyleHeights(fd.style).forEach(h=>
        toolBtn(fmtFeet(h), fd.height===h, {height:h}, cap(fenceLabel(Object.assign({},fd,{height:h,gate:false})))));
    }
  }
  if (cat.tools.includes('firepit')){
    const fd=firepitDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const choose=(patch)=>{
      const cur=firepitDraft(), next=Object.assign({},cur,patch);
      /* Switching shape lands on that shape's classic 36 in rather than its
         smallest; switching style keeps whatever finish, shape and size the new
         style is also made in (normalizeFirepitDraft snaps the rest). */
      if (patch.shape && !patch.size && patch.shape!==cur.shape){
        const s36=firepitStyleSizes(cur.style,patch.shape).find(s=>s.wIn===36&&s.dIn===36);
        if (s36) next.size=s36.id;
      }
      game.firepitDraft=normalizeFirepitDraft(next);
      setTool('firepit',null); game.drill='firepit'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizeFirepitDraft(Object.assign({},fd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='firepit';
      if (patch.style!==undefined) b.dataset.firepitStyle=patch.style;
      if (patch.finish!==undefined) b.dataset.firepitFinish=patch.finish;
      if (patch.shape!==undefined) b.dataset.firepitShape=patch.shape;
      if (patch.size!==undefined) b.dataset.firepitSize=patch.size;
      if (patch.face!==undefined) b.dataset.firepitTurn='1';
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      drawFirepitChip(c.getContext('2d'),d,48,44);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='firepit'){
      backBtn();
      /* Style is how it is built, material what it is built in — each chip is
         the pit itself, so choosing is looking, the pots' and pets' rule. */
      sep('Style');
      FIREPIT_STYLES.forEach(s=>toolBtn(s.short||s.label, fd.style===s.id, {style:s.id},
        `${s.label}: ${firepitStyleFinishes(s.id).map(f=>f.label.toLowerCase()).join(', ')}`));
      sep('Material');
      firepitStyleFinishes(fd.style).forEach(f=>toolBtn(f.label, fd.finish===f.id, {finish:f.id},
        cap(firepitMaterialName({style:fd.style,finish:f.id}))));
      if (firepitStyleShapes(fd.style).length>1){
        sep('Shape');
        toolBtn('Round', fd.shape==='round', {shape:'round'}, 'Round fire pit');
        toolBtn('Square', fd.shape==='square', {shape:'square'}, 'Square or rectangular fire pit');
      }
      sep('Size');
      firepitStyleSizes(fd.style,fd.shape).forEach(s=>toolBtn(firepitSizeChip(s), fd.size===s.id, {size:s.id},
        cap(firepitLabelFor(Object.assign({},fd,{size:s.id})))));
      // only an oblong pit has a way round to turn
      const cur=firepitSize(fd.size,fd.shape);
      if (cur.wIn!==cur.dIn){
        sep('Facing');
        toolBtn('Turn', false, {face:fd.face?0:1}, 'Turn it a quarter');
      }
    }
  }
  if (cat.tools.includes('pergola')){
    const gd=pergolaDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    // through drawPergolaChip, never drawPergola: the latter positions itself
    // from screenOf and would land the frame off a 48x44 chip entirely
    const miniPergola=(tc,d)=>drawPergolaChip(tc,d,48,44);
    const choose=patch=>{
      game.pergolaDraft=normalizePergolaDraft(Object.assign({},pergolaDraft(),patch));
      setTool('pergola',null); game.drill='pergola';
      rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizePergolaDraft(Object.assign({},gd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='pergola';
      if (patch.mat!==undefined) b.dataset.pergolaMat=patch.mat;
      if (patch.height!==undefined) b.dataset.pergolaHeight=String(patch.height);
      if (patch.lights!==undefined) b.dataset.pergolaLights=patch.lights;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniPergola(c.getContext('2d'),d);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='pergola'){
      backBtn();
      sep('Material');
      PERGOLA_MATERIALS.forEach(m=>toolBtn(m.short||m.label, gd.mat===m.id, {mat:m.id}, m.label));
      sep('Height');
      // to the top of the rafters, in the reader's units
      PERGOLA_HEIGHTS.forEach(h=>toolBtn(fmtFeet(h), gd.height===h, {height:h},
        fmtFeet(h)+(h===7?' — a walk-under arbour':h===9?' — room for a wisteria to hang':' — the standard')));
      /* String lights belong to the roof: a tap on a pergola with these armed
         lights or unlights all of it (restylePergolaAt). Turn on Night to see them lit. */
      sep('Lights');
      PERGOLA_LIGHTS.forEach(L=>toolBtn(L.short, gd.lights===L.id, {lights:L.id},
        L.id==='festoon' ? 'Festoon string lights, hung across the rafters' : 'No string lights'));
    }
  }
  if (cat.tools.includes('support')){
    const sd=supportDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    /* Through drawSupportChip -- drawSupportART fitted to its reach -- so a chip
       cannot advertise a frame the canvas does not draw, and never drawSupport,
       which positions itself from screenOf and would land the piece off a 48x44
       chip entirely. One cap for every chip, each shrinking below it to fit. */
    const miniSupport=(tc,d)=>drawSupportChip(tc,d,48,44,0.36);
    const choose=patch=>{
      const cur=supportDraft(), next=Object.assign({},cur,patch);
      // a style may not be made in the armed material — snap, do not reset
      if (patch.style && patch.style!==cur.style) next.mat=supportMaterialFor(patch.style,cur.mat);
      game.supportDraft=normalizeSupportDraft(next);
      setTool('support',null); game.drill='support';
      rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizeSupportDraft(Object.assign({},sd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='support';
      if (patch.style!==undefined) b.dataset.supportStyle=patch.style;
      if (patch.mat!==undefined) b.dataset.supportMat=patch.mat;
      if (patch.face!==undefined) b.dataset.supportFace=String(patch.face);
      if (patch.pat!==undefined) b.dataset.supportPat=patch.pat;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniSupport(c.getContext('2d'),d);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='support'){
      backBtn();
      sep('Support');
      /* One chip per frame: the 3 ft and 6 ft trellis panels are ONE panel with a
         Size row below, the bench's idiom. A family chip keeps the size in hand. */
      const fam=supportFamily(sd.style), cur=supportStyle(sd.style);
      SUPPORT_STYLES.filter((s,i)=>!s.family || SUPPORT_STYLES.findIndex(t=>t.family===s.family)===i).forEach(s=>{
        const mine=s.family && s.family===cur.family;
        toolBtn(s.short||s.label, mine||sd.style===s.id, {style:mine?sd.style:s.id},
          `${s.label} — ${fmtFeet(s.ft)} for a climber`);
      });
      sep('Material');
      supportMaterials(sd.style).forEach(m=>toolBtn(m.label, sd.mat===m.id, {mat:m.id}, cap(supportLabelFor(Object.assign({},sd,{mat:m.id})))));
      if (fam.length>1){
        sep('Size');
        fam.forEach(s=>toolBtn(supportSizeText(s), sd.style===s.id, {style:s.id}, cap(supportLabelFor(Object.assign({},sd,{style:s.id})))));
      }
      if (cur.pattern){
        sep('Lattice');
        SUPPORT_PATTERNS.forEach(p=>toolBtn(p.label, sd.pat===p.id, {pat:p.id}, cap(supportLabelFor(Object.assign({},sd,{pat:p.id})))));
      }
      if (cur.face){
        sep('Facing');
        toolBtn('Turn', false, {face:(sd.face+1)%4}, 'Turn it a quarter');
      }
    }
  }
  if (cat.tools.includes('waterfeature')){
    const wd=waterFeatureDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    /* Through drawWaterFeatureART, not drawWaterFeature: the latter positions
       itself with screenOf, which reads the live camera, so on a 48x44 chip
       every piece drew hundreds of pixels off the canvas. Same seam and same
       reason as miniPot — one painter for the garden and the chip, so a chip
       cannot advertise a basin the canvas does not draw.
       ONE cap for every chip, so a 34in birdbath and a 9in millstone are not
       normalised into the same picture — miniPot's rule, and here height and
       width are most of what tells these apart. But the cap ALONE clipped the
       two big ground pieces badly: measured against the 48x44 chip, the stock
       tank ran 9px off the left and 8px off the right and the basin pool 12 and
       11, with both 6-7px below the floor. So the cap is a MAXIMUM and each
       piece shrinks below it if it would not fit. The six small and medium
       pieces all sit at the cap and so still read relatively; only the two that
       cannot fit give that up, which is the right thing to trade for a chip you
       can recognise. The seed is fixed so a chip does not reshuffle its gravel
       on every rebuild. */
    const wfChipScale=spec=>{
      const wPx=inchesToTiles(spec.wIn)*Math.SQRT2*TILE_W*(spec.bed?1.32:1.06);
      const hPx=feetToPx(spec.hIn/12)+inchesToTiles(spec.dIn)*Math.SQRT2*TILE_H*0.62;
      return Math.min(0.31, 44/wPx, 38/hPx);
    };
    const miniWater=(tc,d)=>{
      d=normalizeWaterFeatureDraft(d);
      const k=wfChipScale(waterFeature(d.form));
      tc.save(); tc.translate(24,33); tc.scale(k,k);
      drawWaterFeatureArt(tc,0,0,Object.assign({},d,{face:0}),'Summer',ISO_AXES_FLAT,0x5eed);
      tc.restore();
    };
    const choose=patch=>{
      const cur=waterFeatureDraft(), next=Object.assign({},cur,patch);
      // a form may not be made in the finish that was armed — snap, don't reset
      if (patch.form && patch.form!==cur.form) next.finish=waterFinishFor(patch.form,cur.finish);
      game.waterFeatureDraft=normalizeWaterFeatureDraft(next);
      setTool('waterfeature',null); game.drill='waterfeature';
      rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const d=normalizeWaterFeatureDraft(Object.assign({},wd,patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='waterfeature';
      if (patch.form!==undefined) b.dataset.waterForm=patch.form;
      if (patch.finish!==undefined) b.dataset.waterFinish=patch.finish;
      if (patch.face!==undefined) b.dataset.waterFace=String(patch.face);
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniWater(c.getContext('2d'),d);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='waterfeature'){
      backBtn();
      sep('Water feature');
      WATER_FEATURES.forEach(w=>toolBtn(w.short||w.label, wd.form===w.id, {form:w.id},
        `${w.label} — ${fmtLengthIn(w.hIn)} tall`));
      sep('Finish');
      waterFeatureFinishes(wd.form).forEach(f=>toolBtn(f.label, wd.finish===f.id, {finish:f.id}, f.label));
      // only the two rectilinear pieces read differently when turned
      if (waterFeature(wd.form).form==='basin' || waterFeature(wd.form).form==='spout'){
        sep('Facing');
        toolBtn('Turn', false, {face:(wd.face+1)%4}, 'Turn it a quarter');
      }
    }
  }
  if (cat.tools.includes('boulder')){
    const bd=boulderDraft(), spec=boulderType(bd.type);
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    // a form chip lands on that form's stone nearest the current size
    const nearest=form=>{ const list=boulderFormTypes(form);
      return list.reduce((a,t)=>Math.abs(t.wIn-spec.wIn)<Math.abs(a.wIn-spec.wIn)?t:a,list[0]); };
    const choose=patch=>{
      const next=Object.assign({},boulderDraft(),patch);
      if (patch.form){ next.type=nearest(patch.form).id; delete next.form; }
      // the stone snaps to one the new type is made in (normalizeBoulderDraft)
      game.boulderDraft=normalizeBoulderDraft(next);
      setTool('boulder',null); game.drill='boulder'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    /* Every chip is the stone itself, so choosing is looking — the pots' and
       the fire pit's rule. `data` names the axis a chip sets, which is what
       refreshTray reads to mark the armed one. */
    const toolBtn=(label,sel,patch,tip,data)=>{
      const d=normalizeBoulderDraft(Object.assign({},bd,patch.form?{type:nearest(patch.form).id}:patch));
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='boulder'; Object.assign(b.dataset,data||{});
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      drawBoulderChip(c.getContext('2d'),d,48,44);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='boulder'){
      backBtn();
      sep('Form');
      BOULDER_FORMS.forEach(f=>toolBtn(f.label, spec.form===f.id, {form:f.id},
        `${f.label}: ${f.stones.map(id=>boulderStone(id).label.toLowerCase()).join(', ')}`, {boulderForm:f.id}));
      // the stone, then the size: what it is made of before how big, as every page orders it
      const stones=boulderTypeStones(bd.type);
      if (stones.length>1){
        sep('Stone');
        stones.forEach(st=>toolBtn(st.label, bd.stone===st.id, {stone:st.id},
          boulderLabelFor(Object.assign({},bd,{stone:st.id})), {boulderStone:st.id}));
      }
      sep('Size');
      boulderFormTypes(spec.form).forEach(t=>toolBtn(boulderSizeChip(t), bd.type===t.id, {type:t.id},
        `${boulderLabelFor(Object.assign({},bd,{type:t.id}))}, about ${fmtWeightLb(boulderWeightLb(Object.assign({},bd,{type:t.id})))}`,
        {boulderType:t.id}));
      // a stone has a better side: turning it is how you choose which one shows
      sep('Facing');
      toolBtn('Turn', false, {face:(bd.face+1)%4}, 'Turn it a quarter, to show another side of the stone', {boulderTurn:'1'});
    }
  }
  if (cat.tools.includes('light') && game.drill==='light'){
    const ld=lightDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    /* The chip paints through the garden's own drawLightArt. It used to be a
       second, hand-written copy of all three fixture branches, with its own
       heights and its own hardcoded metal -- so it could advertise a fixture the
       canvas does not draw, which is the one thing every other chip in this file
       is built not to do (see the fence, pot, seat and water-feature chips).
       Scale is a CAP each fixture shrinks below to fit, the water-feature rule.
       At one SHARED scale the honest ratio does fit a 48x44 chip and is useless:
       a 1.2 ft path light beside a 7 ft lantern post is seven pixels tall. So
       the true height goes in the title instead, where it costs no ink. */
    // base/room leave the soft shadow its own pixels: measured, a 39px base put
    // the path light's shadow at y=44 in a 44px chip and clipped it.
    const CHIP_BASE=37, CHIP_ROOM=32, CHIP_CAP=0.9;
    const chipScale=d=>Math.min(CHIP_CAP, CHIP_ROOM/Math.max(1,feetToPx(lightHeightFt(d))));
    const miniLight=(tc,d,lit)=>{
      const k=chipScale(d);
      if (lit){
        const tone=lightTone(d.tone), hy=CHIP_BASE-feetToPx(lightType(d.type).ft)*k;
        const g=tc.createRadialGradient(24,hy,0,24,hy,20);
        g.addColorStop(0,tone.glow+'0.42)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        tc.fillStyle=g; tc.fillRect(4,hy-20,40,40);
      }
      drawLightArt(tc,24,CHIP_BASE,d,lit,null,k);
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='light';
      if (draftPatch.type!==undefined) b.dataset.lightType=draftPatch.type;
      if (draftPatch.tone!==undefined) b.dataset.lightTone=draftPatch.tone;
      if (draftPatch.finish!==undefined) b.dataset.lightFinish=draftPatch.finish;
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniLight(c.getContext('2d'),Object.assign({},ld,draftPatch),game.layerVis.night);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.lightDraft=normalizeLightDraft(Object.assign({},lightDraft(),draftPatch));
        setTool('light',null); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    backBtn();
    sep('Fixture');
    LIGHT_TYPES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.type===t2.id, {type:t2.id},
      `${t2.label} · ${fmtLengthIn(lightHeightFt({type:t2.id})*12)} tall`));
    sep('Finish');
    lightTypeFinishes(ld.type).forEach(f=>toolBtn(f.short||f.label,
      game.tool==='light'&&ld.finish===f.id, {finish:f.id}, f.label));
    // a torch burns: there is no lamp colour to choose
    if (!lightIsFlame(ld)){
      sep('Light');
      LIGHT_TONES.forEach(t2=>toolBtn(t2.short, game.tool==='light'&&ld.tone===t2.id, {tone:t2.id}, t2.tip||t2.label));
    }
  }
  if (cat.tools.includes('pot') && game.drill==='pot'){
    /* Contextual like the Ground tab: the vessels are always up and the size
       row unfolds once one is armed. Every chip paints through the garden's own
       drawPot, so a chip cannot advertise a pot the canvas does not draw. */
    const cd=potDraft(), armed=game.tool==='pot';
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    /* One scale for every chip, sized so the biggest vessel fits: the sizes
       then differ on screen the way they differ in the garden. Normalising per
       size made all five size chips the same picture. */
    const miniPot=(tc,d)=>{
      tc.save(); tc.translate(24,33); tc.scale(0.44,0.44);
      drawPotArt(tc,0,0,d,'Summer',ISO_AXES_FLAT);
      tc.restore();
    };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='pot';
      if (draftPatch.style!==undefined) b.dataset.potStyle=draftPatch.style;
      if (draftPatch.size!==undefined) b.dataset.potSize=draftPatch.size;
      if (draftPatch.finish!==undefined) b.dataset.potFinish=draftPatch.finish;
      if (draftPatch.face!==undefined) b.dataset.potFace=String(draftPatch.face);
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      miniPot(c.getContext('2d'),normalizePotDraft(Object.assign({},cd,draftPatch)));
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.potDraft=normalizePotDraft(Object.assign({},potDraft(),draftPatch));
        setTool('pot',null); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    // the tab's two kinds of thing each say what they are, as the Ground shelves do
    backBtn();
    sep('Container');
    POT_STYLES.forEach(st=>toolBtn(st.short||st.label, armed&&cd.style===st.id, {style:st.id},
      `${st.label} — plant it anywhere, including paving`));
    if (armed){
      /* Only the colours this vessel is really made in, its own natural finish
         first — the water feature's rule (§12d), and the reason a terracotta
         pot is not offered in cobalt. Every chip paints the real thing, so the
         swatch IS the colour rather than a label for it. "Finish", as every
         bought piece calls it, and before the size, as every page orders it. */
      sep('Finish');
      potStyleFinishes(cd.style).forEach(f=>toolBtn(f.label, cd.finish===f.id, {finish:f.id},
        `${f.label} ${(potStyle(cd.style).short||'').toLowerCase()}`.trim()));
      sep('Size');
      potStyleSizes(cd.style).forEach(sz=>toolBtn(potSizeText(sz), cd.size===sz.id, {size:sz.id},
        `${potSizeText(sz)} across, ${fmtLengthIn(sz.hIn)} tall`));
      // only a trough has a long axis to point
      if (potTileSize(cd).w!==potTileSize(cd).h){
        sep('Facing');
        toolBtn('Turn',false,{face:(cd.face+1)%4},'Turn the trough a quarter');
      }
    }
  }
  /* Ornaments: the pots' idiom. Every piece on its page is always
     up under its group's heading, and the finish and facing rows unfold once
     one is armed. Every chip is drawOrnamentChip, the piece itself through the
     painter the garden uses, so a chip cannot advertise one the canvas does not
     draw. The dataset names the axis a chip sets, which refreshTray reads. */
  if (cat.tools.includes('ornament') && game.drill==='ornament'){
    const od=ornamentDraft(), armed=game.tool==='ornament';
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const toolBtn=(label,sel,patch,tip,data)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='ornament'; Object.assign(b.dataset,data||{});
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      const next=Object.assign({},od,patch);
      if (patch.kind) next.finish=ornamentFinishFor(patch.kind,od.finish);
      drawOrnamentChip(c.getContext('2d'),next,48,44);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{
        const cur=ornamentDraft(), n2=Object.assign({},cur,patch);
        // a finish the new piece is not made in snaps to its first (ornamentFinishFor)
        if (patch.kind && patch.kind!==cur.kind) n2.finish=ornamentFinishFor(patch.kind,cur.finish);
        game.ornamentDraft=normalizeOrnamentDraft(n2);
        setTool('ornament',null); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    backBtn();
    /* One chip per piece: the two stone spheres are one sphere with a Size row,
       as the benches are. A family chip keeps the size in hand if it is already
       a sphere, else takes the first. */
    const curFam=ornamentKind(od.kind).family;
    for (const g of ORNAMENT_GROUPS){
      sep(g.label);
      ORNAMENTS.filter((o,i)=>o.group===g.id && (!o.family || ORNAMENTS.findIndex(x=>x.family===o.family)===i)).forEach(o=>{
        const mine=!!o.family && o.family===curFam, kind=mine?od.kind:o.id;
        toolBtn(o.family?cap(o.family):(o.short||o.label), armed&&od.kind===kind, {kind},
          o.family ? `${cap(o.family)}, ${ornamentFamily(o.id).map(x=>fmtLengthIn(x.wIn,{ftAt:Infinity})).join(' or ')} across`
            : `${o.label}, ${fmtLengthIn(o.hIn)} tall`, {ornamentKind:kind});
      });
    }
    if (armed){
      const fins=ornamentFinishes(od.kind);
      if (fins.length>1){
        sep('Finish');
        fins.forEach(f=>toolBtn(f.label, od.finish===f.id, {finish:f.id},
          ornamentLabelFor({kind:od.kind,finish:f.id}), {ornamentFinish:f.id}));
      }
      const fam=ornamentFamily(od.kind);
      if (fam.length>1){
        sep('Size');
        fam.forEach(o=>toolBtn(fmtLengthIn(o.wIn,{ftAt:Infinity}), od.kind===o.id, {kind:o.id},
          `${ornamentLabelFor({kind:o.id,finish:od.finish})}, ${fmtLengthIn(o.wIn,{ftAt:Infinity})} across`, {ornamentKind:o.id}));
      }
      // only a piece with a front reads differently turned (`turns`)
      if (ornamentKind(od.kind).turns){
        sep('Facing');
        toolBtn('Turn', false, {face:(od.face+1)%4}, 'Turn it a quarter', {ornamentTurn:'1'});
      }
    }
  }
  /* Seating collapses to one summary button and opens its own page, like every
     other Hardscape tool. It used to be the one section on this tab laid out
     flat — nine chips and a "Seating" heading under the summary buttons — which
     made it look like a different kind of thing from the fence and the fire pit
     beside it, and needed a guard to keep those nine chips off every other
     tool's sub-page. Every chip paints through drawSeatChip, so it is the piece
     itself in the finish and facing you would place. */
  if (cat.tools.includes('seat')){
    const sd=seatDraft();
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const choose=patch=>{
      game.seatDraft=normalizeSeatDraft(Object.assign({},seatDraft(),patch));
      setTool('seat',null); game.drill='seat'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
    };
    const toolBtn=(label,sel,patch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='seat';
      if (patch.type!==undefined) b.dataset.seatType=patch.type;
      if (patch.finish!==undefined) b.dataset.seatFinish=patch.finish;
      if (patch.face!==undefined) b.dataset.seatFace=String(patch.face);
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      drawSeatChip(c.getContext('2d'),Object.assign({},sd,patch),48,44);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label; b.onclick=()=>choose(patch);
      tray.appendChild(b); return b;
    };
    if (game.drill==='seat'){
      backBtn();
      sep('Seating');
      /* One chip per piece: the 4 ft and 6 ft benches are ONE bench with a Size
         row below, as a pot or a fire pit has. A family chip keeps the size in
         hand if it is already a bench, else takes the first. */
      const fam=seatFamily(sd.type);
      SEAT_TYPES.filter((t,i)=>!t.family || SEAT_TYPES.findIndex(s=>s.family===t.family)===i).forEach(t=>{
        const mine=t.family && t.family===seatType(sd.type).family;
        toolBtn(t.short||t.label, mine||sd.type===t.id, {type:mine?sd.type:t.id},
          t.family ? `${t.label} — ${seatFamily(t.id).map(s=>seatSizeText(s)).join(' or ')} long`
            : `${t.label} — ${fmtLengthIn(t.wIn)} wide`);
      });
      /* Only the finishes this piece is really made in, in its own order — the
         fire pit's rule. A stone bench is a slab on plinths; nobody makes a stone
         Adirondack. */
      sep('Finish');
      seatTypeFinishes(sd.type).forEach(f=>toolBtn(f.label, sd.finish===f.id, {finish:f.id},
        cap(seatLabelFor({type:sd.type,finish:f.id}))));
      if (fam.length>1){
        sep('Size');
        fam.forEach(t=>toolBtn(seatSizeText(t), sd.type===t.id, {type:t.id}, cap(seatLabelFor({type:t.id,finish:sd.finish}))));
      }
      /* One Turn chip rather than four compass chips: the preview shows the
         result, so tapping until it points the right way needs no legend, and
         the plot has no fixed "north" on screen once the view is rotated. */
      sep('Facing');
      toolBtn('Turn',false,{face:(sd.face+1)%4},'Turn it a quarter');
    }
  }
  if (cat.tools.includes('pet') && game.drill==='pet'){
    // Contextual like the Ground tab: Cat / Dog are always up, and the coat,
    // marking and sock rows only unfold once a pet is armed — the same shape
    // as picking Bed and then getting bed materials. Every chip previews the
    // pet you would actually place (the button art is the real drawPet), so
    // you choose by looking rather than by reading a label.
    const pd=petDraft(), armed=game.tool==='pet';
    const sep=t2=>{ const s=document.createElement('span'); s.className='tray-sep';
      s.textContent=t2; tray.appendChild(s); };
    const toolBtn=(label,sel,draftPatch,tip)=>{
      const b=document.createElement('button'); b.className='tool'+(sel?' sel':'');
      b.dataset.k='pet';
      Object.keys(draftPatch).forEach(key=>{ b.dataset['pet'+key[0].toUpperCase()+key.slice(1)]=draftPatch[key]; });
      const c=document.createElement('canvas'); c.width=48; c.height=44;
      drawPet(c.getContext('2d'),24,41,Object.assign({},pd,draftPatch),0.92);
      const sp=document.createElement('span'); sp.textContent=label;
      b.append(c,sp); b.title=tip||label;
      b.onclick=()=>{ game.petDraft=normalizePetDraft(Object.assign({},petDraft(),draftPatch));
        setTool('pet',null); buildToolTray(); };
      tray.appendChild(b); return b;
    };
    backBtn();
    sep('Pet');
    PET_SPECIES.forEach(s2=>toolBtn(s2.label, armed&&pd.species===s2.id, {species:s2.id},
      `Place a ${s2.label.toLowerCase()} in the garden`));
    if (armed){
      sep('Coat');
      PET_COATS.forEach(c2=>toolBtn(c2.label, pd.coat===c2.id, {coat:c2.id}, `${c2.label} coat`));
      sep('Marking');
      PET_MARKS.forEach(m2=>toolBtn(m2.label, pd.mark===m2.id, {mark:m2.id}, m2.label));
      sep('Socks');
      PET_PAWS.forEach(p2=>toolBtn(p2.label, pd.paws===p2.id, {paws:p2.id},
        p2.c?`${p2.label} feet`:'Feet the same colour as the coat'));
    }
  }
  if (cat.tools.includes('house')){
    /* The Site tab (0.9.153) is laid out as Grade is: a row per thing a site is
       set up with, saying what it is for and what it is set to, and the next
       footprint's name, status and colours opening under Draw footprint once it
       is chosen. It was a row of bare chips ("North 0°", "Name: House"), with
       the status and colour rows always up beneath them. */
    tray.classList.add('lg-page');
    const sep=t2=>tray.appendChild(trayEl('span','tray-sep',t2));
    const bd=buildingStyleDraft();
    const footprintPath=tc=>{
      tc.beginPath(); tc.moveTo(7,10); tc.lineTo(31,10); tc.lineTo(31,18); tc.lineTo(40,18);
      tc.lineTo(40,33); tc.lineTo(17,33); tc.lineTo(17,25); tc.lineTo(7,25); tc.closePath();
    };
    const miniFootprint=(tc,style,edgeOnly)=>{
      tc.fillStyle=style.status==='proposed'?'rgba(201,127,63,.34)':(style.fill||style.roof);
      tc.strokeStyle=edgeOnly ? (style.edge||style.wall)
        : (style.status==='proposed'?'#e5b36e':uiInk('--icon-ink'));
      tc.lineWidth=edgeOnly?4:1.8;
      tc.setLineDash(style.status==='proposed'&&!edgeOnly?[3,2]:[]);
      footprintPath(tc);
      if (edgeOnly){ tc.fillStyle='rgba(239,230,211,.16)'; }
      tc.fill(); tc.stroke();
      tc.setLineDash([]);
    };
    // a row: a tool (pressed while armed) or an action (no pressed state)
    const row=(k,name,desc,cur,draw,fn,tool)=>{
      const on=!!tool && game.tool===k, b=trayEl('button','lt-row'+(on?' sel':'')); b.type='button'; b.dataset.k=k;
      if (tool) b.setAttribute('aria-pressed',on?'true':'false');
      const {c,x}=trayCanvas(48,44,true); if (x) draw(x);
      const text=trayEl('span','lt-text'); text.append(trayEl('b',null,name),trayEl('small',null,desc));
      if (cur) text.appendChild(trayEl('em',null,cur));
      b.append(c,text); b.title=`${name}: ${desc}`; b.onclick=fn; tray.appendChild(b); return b;
    };
    const optionBtn=(label,sel,draw,fn,tip,data)=>{
      const b=trayEl('button','tool'+(sel?' sel':'')); b.type='button'; b.dataset.k='building';
      Object.assign(b.dataset,data||{});
      b.setAttribute('aria-pressed',sel?'true':'false');
      const c=document.createElement('canvas'); c.width=48; c.height=44; draw(c.getContext('2d'));
      b.append(c,trayEl('span',null,label)); b.title=tip||label; b.onclick=fn; tray.appendChild(b); return b;
    };
    const setStyle=patch=>{ game.buildingStyleDraft=normalizeBuildingStyle(Object.assign({},buildingStyleDraft(),patch)); setTool('building',null); buildToolTray(); };
    row('site-photo','Site photo','Trace the plot from an aerial view or a drawn survey, scaled to a distance you know.',
      game.underlay?'A photo is in place':'None yet',tc=>{
        tc.fillStyle='#8ca39a'; tc.fillRect(7,9,34,26);
        tc.fillStyle='#d8c98c'; tc.beginPath(); tc.arc(32,16,4,0,7); tc.fill();
        tc.fillStyle='#526d55'; tc.beginPath(); tc.moveTo(8,34); tc.lineTo(18,22); tc.lineTo(24,28); tc.lineTo(31,20); tc.lineTo(41,34); tc.closePath(); tc.fill();
        tc.strokeStyle=uiInk('--icon-ink'); tc.lineWidth=1.4; tc.strokeRect(7,9,34,26);
      },()=>{ if (game.underlay) beginSitePhotoEdit(); else chooseSitePhoto(); });
    const northDeg=normalizeSiteNorthDeg(game.siteNorthDeg);
    row('site-north','North','Which way north lies, for the sun, the shade, the compass and the plan.',
      northDeg ? `${northDeg}° clockwise from the top of the plot` : 'Straight up the plot',tc=>{
        tc.strokeStyle='rgba(239,230,211,.42)'; tc.lineWidth=1.3; tc.beginPath(); tc.arc(24,23,16,0,Math.PI*2); tc.stroke();
        tc.save(); tc.translate(24,23); tc.rotate(northDeg*Math.PI/180);
        tc.strokeStyle='#c97f3f'; tc.fillStyle='#c97f3f'; tc.lineWidth=2.5;
        tc.beginPath(); tc.moveTo(0,12); tc.lineTo(0,-11); tc.stroke();
        tc.beginPath(); tc.moveTo(0,-15); tc.lineTo(-5,-7); tc.lineTo(5,-7); tc.closePath(); tc.fill(); tc.restore();
      },()=>openSiteNorthEditor('garden'));
    row('building','Draw footprint','A house, shed or garage the garden is built around. Tap each corner and close on the first.',
      `${bd.status==='proposed'?'Proposed':'Existing'}${bd.label?`: ${bd.label}`:''}`,
      tc=>miniFootprint(tc,bd),()=>{ setTool('building',null); buildToolTray(); },true);
    if (game.tool==='building'){
      /* The name a new footprint gets. A garden has sheds and garages, not just
         houses, and the model has carried `label` all along. */
      sep('Name');
      optionBtn(bd.label||'None',false,tc=>{
        tc.strokeStyle=uiInk('--icon-ink-soft'); tc.lineWidth=1.5;
        footprintPath(tc); tc.stroke();
        tc.fillStyle=uiInk('--icon-ink'); tc.font='700 11px IBM Plex Sans, sans-serif'; tc.textAlign='center';
        tc.fillText('Aa',24,26);
      },()=>{
        showPrompt('Name new footprints','Sheds, garages, a greenhouse — whatever you are drawing next.',
          bd.label||'','Save',v=>setStyle({label:v}));
      },'Name the next footprint you draw',{siteName:'1'});
      sep('Status');
      ['existing','proposed'].forEach(status=>optionBtn(status==='existing'?'Existing':'Proposed',bd.status===status,
        tc=>miniFootprint(tc,Object.assign({},bd,{status})),()=>setStyle({status}),
        status==='existing'?'A building already there':'A building you are planning',{siteStatus:status}));
      // "Area"/"Edge", not "Roof"/"Wall": a footprint has no roof, and what these
      // two actually control is the shape's fill and the thin rim around it.
      sep('Area colour');
      ROOF_COLS.forEach(([n,c2])=>optionBtn(n,bd.fill===c2,
        tc=>miniFootprint(tc,Object.assign({},bd,{status:'existing',fill:c2})),()=>setStyle({fill:c2}),`${n} area`,{siteFill:c2}));
      sep('Edge colour');
      WALL_COLS.forEach(([n,c2])=>optionBtn(n,bd.edge===c2,
        tc=>miniFootprint(tc,Object.assign({},bd,{status:'existing',edge:c2}),true),()=>setStyle({edge:c2}),`${n} edge`,{siteEdge:c2}));
      tray.appendChild(trayEl('p','lg-note','Existing or proposed changes how a footprint is drawn, not what it blocks.'));
    }
    // Edit an already-placed footprint: the shape is rarely right first time,
    // and redrawing the whole outline to fix one bay is why people don't bother.
    row('building-edit','Edit footprint','Add to, trim or rename a footprint you have drawn.','',tc=>{
      tc.strokeStyle=uiInk('--icon-ink'); tc.lineWidth=1.6; tc.setLineDash([3,2]);
      footprintPath(tc); tc.stroke(); tc.setLineDash([]);
      tc.strokeStyle='#c97f3f'; tc.lineWidth=2.4;
      tc.beginPath(); tc.moveTo(24,15); tc.lineTo(24,29); tc.moveTo(17,22); tc.lineTo(31,22); tc.stroke();
    },()=>{ setTool('building-edit',null); buildToolTray(); },true);
    /* Existing or proposed (0.9.155): what is already on the site, so the plan
       hatches it and the planting list leaves it off the orders. */
    row('survey','Existing or proposed','Mark what is already there, the trees, the patio, the fence you are keeping. The plan hatches it and the planting list leaves it off the orders.',
      game.tool==='survey' ? surveyLabel() : '',tc=>{
        tc.fillStyle='rgba(239,230,211,.14)'; tc.strokeStyle=uiInk('--icon-ink-soft'); tc.lineWidth=1.4;
        tc.beginPath(); tc.moveTo(24,9); tc.lineTo(41,22); tc.lineTo(24,35); tc.lineTo(7,22); tc.closePath(); tc.fill(); tc.stroke();
        tc.save(); tc.clip(); tc.strokeStyle=uiInk('--icon-ink'); tc.lineWidth=1.2; tc.beginPath();
        for (let d=-30;d<40;d+=6){ tc.moveTo(d,40); tc.lineTo(d+30,8); } tc.stroke(); tc.restore();
        tc.fillStyle='#c97f3f'; tc.font='700 12px IBM Plex Sans, sans-serif'; tc.textAlign='center'; tc.fillText('E',24,27);
      },()=>{ setTool('survey',null); buildToolTray(); },true);
    if (game.tool==='survey'){
      const seg=(head,rows,cur,set,data)=>{
        sep(head);
        rows.forEach(([id,label])=>{
          const b=trayEl('button','tool'+(cur===id?' sel':'')); b.type='button'; b.dataset.k='survey'; b.dataset[data]=id;
          b.setAttribute('aria-pressed',cur===id?'true':'false');
          const c=document.createElement('canvas'); c.width=48; c.height=44; const tc=c.getContext('2d');
          tc.strokeStyle=uiInk('--icon-ink-soft'); tc.lineWidth=1.4; tc.beginPath(); tc.moveTo(24,10); tc.lineTo(40,22); tc.lineTo(24,34); tc.lineTo(8,22); tc.closePath(); tc.stroke();
          if (id==='existing'){ tc.save(); tc.clip(); tc.strokeStyle=uiInk('--icon-ink'); tc.beginPath(); for (let d=-30;d<40;d+=6){ tc.moveTo(d,40); tc.lineTo(d+30,8); } tc.stroke(); tc.restore(); }
          if (id==='proposed'){ tc.fillStyle='#c97f3f'; tc.beginPath(); tc.moveTo(24,14); tc.lineTo(34,22); tc.lineTo(24,30); tc.lineTo(14,22); tc.closePath(); tc.fill(); }
          if (id==='plants'||id==='all'){ tc.strokeStyle='#8ead67'; tc.lineWidth=2; tc.beginPath(); tc.moveTo(20,26); tc.lineTo(20,14); tc.moveTo(24,27); tc.lineTo(26,12); tc.moveTo(28,26); tc.lineTo(31,15); tc.stroke(); }
          if (id==='land'||id==='all'){ tc.fillStyle='#9e998e'; tc.fillRect(id==='all'?28:17,24,id==='all'?9:14,5); }
          b.append(c,trayEl('span',null,label)); b.onclick=()=>{ set(id); setTool('survey',null); buildToolTray(); };
          tray.appendChild(b);
        });
      };
      seg('Mark',[['existing','Existing'],['proposed','Proposed']],surveyDraft(),id=>{ game.surveyDraft=id; },'surveyMode');
      seg('What',SURVEY_LAYERS,surveyLayer(),id=>{ game.surveyLayer=id; },'surveyLayer');
      tray.appendChild(trayEl('p','lg-note','Tap or drag; the brush size sets how much. Fill marks a whole patio or bed. Buildings are marked as you draw them, above.'));
    }
  }
  finishToolTrayRender();
}
function applyTraySearch(){ // hide tray buttons that don't match the query
  const q=(game.traySearch||'').toLowerCase().trim();
  document.querySelectorAll('#toolTray .tool').forEach(b=>{
    const k=b.dataset.k, P=k&&PLANTS[k];
    let hay=k||'';
    if (b.dataset.pathColor) hay+=' '+pathColor(b.dataset.pathColor).label;
    if (b.dataset.bedStyle) hay+=' '+bedStyle(b.dataset.bedStyle).label+' bed gravel rock leaf litter mulch soil';
    if (b.dataset.waterStyle) hay+=' '+waterStyle(b.dataset.waterStyle).label+' pond river lake water';
    if (b.dataset.lawnStyle) hay+=' '+lawnStyle(b.dataset.lawnStyle).label+' lawn grass turf mown meadow clover moss thyme fescue artificial';
    if (isElevationTool(k)) hay+=' elevation grade grading raised lowered berm swale terrace level';
    if (k==='wall') hay+=' grade retaining wall terrace bank sleeper gabion drystone dry stone facing '+WALL_STYLES.map(w=>w.label).join(' ');
    if (k==='terrace') hay+=' grade terrace raised bed planter sunken patio retaining wall bank '+WALL_STYLES.map(w=>w.label).join(' ');
    if (k==='berm') hay+=' grade berm mound hill earth swale rain garden hollow soft slope';
    if (k==='steps') hay+=' grade stairs flight treads risers '+STEP_RISERS.map(w=>wallStyle(w).label).join(' ')+' '+STEP_TREADS.map(t=>pathColor(t).label).join(' ');
    if (k==='edging') hay+=' ground edging edge restraint mowing strip lawn border spade steel corten setts soldier course '+EDGING_STYLES.map(e=>e.label).join(' ');
    if (k==='fence') hay+=' hardscape structures fence gate door arbor wall screen deer privacy '
      +FENCE_STYLES.map(f=>f.label+' '+(f.short||'')).join(' ');
    if (k==='firepit') hay+=' hardscape structures fire pit ring bowl round square metal '+FIREPIT_SIZES.map(f=>f.label+' '+f.plan).join(' ')
      +' '+FIREPIT_STYLES.map(s=>s.label).join(' ')+' '+FIREPIT_FINISHES.map(f=>f.label).join(' ');
    if (k==='support') hay+=' hardscape support trellis lattice obelisk arch arbor fan wire espalier wigwam teepee pillar climber vine frame '+SUPPORT_STYLES.map(s=>s.label).join(' ')+' '+SUPPORT_MATERIALS.map(m=>m.label).join(' ');
    if (k==='waterfeature') hay+=' hardscape water feature fountain birdbath bubbler urn millstone basin spout tank pool '+WATER_FEATURES.map(w=>w.label+' '+(w.short||'')).join(' ')+' '+WATER_FINISHES.map(f=>f.label).join(' ');
    if (k==='boulder') hay+=' hardscape structures boulder rock stone rockery outcrop slab ledge monolith '
      +BOULDER_FORMS.map(f=>f.label).join(' ')+' '+BOULDER_STONES.map(st=>st.label).join(' ');
    if (k==='pot') hay+=' decor container pot planter urn trough patio courtyard balcony terrace colour color '+POT_STYLES.map(p=>p.label+' '+p.short).join(' ')+' '+POT_FINISHES.map(f=>f.label).join(' ');
    if (k==='seat') hay+=' hardscape seating seat bench chair table stool dining bistro picnic lounger sit '+SEAT_TYPES.map(t=>t.label+' '+t.short).join(' ')+' '+SEAT_FINISHES.map(f=>f.label).join(' ');
    if (k==='light') hay+=' lighting lights path lantern post outdoor lamp '+LIGHT_TYPES.map(l=>l.label).join(' ')+' '+LIGHT_TONES.map(l=>l.label).join(' ');
    if (k==='pet') hay+=' decor pet cat dog animal ornament socks paws feet '+PET_COATS.map(c2=>c2.label).join(' ')+' '+PET_MARKS.map(m2=>m2.label).join(' ')+' '+PET_PAWS.map(p2=>p2.label).join(' ');
    if (P){ hay=P.name+' '+P.latin+' '+(P.group||'')+' '+roleSummary(k,12);
      if (P.group) PLANT_KEYS.forEach(k2=>{ if (PLANTS[k2].group===P.group)
        hay+=' '+PLANTS[k2].name+' '+PLANTS[k2].latin+' '+roleSummary(k2,12); }); }
    b.style.display=(!q||hay.toLowerCase().includes(q))?'':'none';
  });
}
function refreshTray(){
  const cur=PLANTS[game.tool];
  document.querySelectorAll('.tool,.lg-chip,.lh-card,.lt-row').forEach(el=>{
    if (el.dataset.shelf) return;                      // "All 20" / "Fewer": a toggle, not a choice
    const sel=el.dataset.pick!==undefined
      ? toolPickOn(+el.dataset.pick)
      : el.dataset.edging
      ? game.tool==='edging' && edgingDraft()===el.dataset.edging
      : el.dataset.crossing
      ? game.tool==='crossing' && crossingDraft()===el.dataset.crossing
      : el.dataset.surveyMode
      ? game.tool==='survey' && surveyDraft()===el.dataset.surveyMode
      : el.dataset.surveyLayer
      ? game.tool==='survey' && surveyLayer()===el.dataset.surveyLayer
      : el.dataset.pathColor
      ? game.tool==='path' && game.pathColor===el.dataset.pathColor
      : el.dataset.bedStyle
      ? game.tool==='bed' && game.bedStyle===el.dataset.bedStyle
      : el.dataset.waterStyle
      ? game.tool==='water' && game.waterStyle===el.dataset.waterStyle
      : el.dataset.lawnStyle
      ? game.tool==='lawn' && game.lawnStyle===el.dataset.lawnStyle
      : el.dataset.fenceStyle
      ? game.tool==='fence' && fenceDraft().style===el.dataset.fenceStyle
      : el.dataset.fenceHeight
      ? game.tool==='fence' && String(fenceDraft().height)===el.dataset.fenceHeight
      : el.dataset.fenceGate
      ? game.tool==='fence' && String(!!fenceDraft().gate)===el.dataset.fenceGate
      : el.dataset.firepitStyle
      ? game.tool==='firepit' && firepitDraft().style===el.dataset.firepitStyle
      : el.dataset.firepitFinish
      ? game.tool==='firepit' && firepitDraft().finish===el.dataset.firepitFinish
      : el.dataset.firepitTurn
      ? false
      : el.dataset.firepitShape
      ? game.tool==='firepit' && firepitDraft().shape===el.dataset.firepitShape
      : el.dataset.firepitSize
      ? game.tool==='firepit' && firepitDraft().size===el.dataset.firepitSize
      : el.dataset.boulderType
      ? game.tool==='boulder' && boulderDraft().type===el.dataset.boulderType
      : el.dataset.boulderForm
      ? game.tool==='boulder' && boulderType(boulderDraft().type).form===el.dataset.boulderForm
      : el.dataset.boulderStone
      ? game.tool==='boulder' && boulderDraft().stone===el.dataset.boulderStone
      : el.dataset.boulderTurn
      ? false
      : el.dataset.lightType
      ? game.tool==='light' && lightDraft().type===el.dataset.lightType
      : el.dataset.lightTone
      ? game.tool==='light' && lightDraft().tone===el.dataset.lightTone
      : el.dataset.lightFinish
      ? game.tool==='light' && lightDraft().finish===el.dataset.lightFinish
      : el.dataset.ornamentKind
      ? game.tool==='ornament' && ornamentDraft().kind===el.dataset.ornamentKind
      : el.dataset.ornamentFinish
      ? game.tool==='ornament' && ornamentDraft().finish===el.dataset.ornamentFinish
      : el.dataset.ornamentTurn
      ? false
      /* Every Hardscape and Decor page names the axis a chip sets, so a refresh
         without a rebuild marks the armed one. These five had no branch and fell
         to the tool test below, which lit EVERY chip on their pages at once. */
      : el.dataset.seatType
      ? game.tool==='seat' && seatDraft().type===el.dataset.seatType
      : el.dataset.seatFinish
      ? game.tool==='seat' && seatDraft().finish===el.dataset.seatFinish
      : el.dataset.potStyle
      ? game.tool==='pot' && potDraft().style===el.dataset.potStyle
      : el.dataset.potSize
      ? game.tool==='pot' && potDraft().size===el.dataset.potSize
      : el.dataset.potFinish!==undefined
      ? game.tool==='pot' && potDraft().finish===el.dataset.potFinish
      : el.dataset.supportStyle
      ? game.tool==='support' && supportDraft().style===el.dataset.supportStyle
      : el.dataset.supportMat
      ? game.tool==='support' && supportDraft().mat===el.dataset.supportMat
      : el.dataset.supportPat
      ? game.tool==='support' && supportDraft().pat===el.dataset.supportPat
      : el.dataset.waterForm
      ? game.tool==='waterfeature' && waterFeatureDraft().form===el.dataset.waterForm
      : el.dataset.waterFinish
      ? game.tool==='waterfeature' && waterFeatureDraft().finish===el.dataset.waterFinish
      : el.dataset.pergolaMat
      ? game.tool==='pergola' && pergolaDraft().mat===el.dataset.pergolaMat
      : el.dataset.pergolaHeight
      ? game.tool==='pergola' && String(pergolaDraft().height)===el.dataset.pergolaHeight
      : el.dataset.pergolaLights
      ? game.tool==='pergola' && pergolaDraft().lights===el.dataset.pergolaLights
      : (el.dataset.seatFace||el.dataset.potFace||el.dataset.supportFace||el.dataset.waterFace)
      ? false
      : el.dataset.petSpecies
      ? game.tool==='pet' && petDraft().species===el.dataset.petSpecies
      : el.dataset.petCoat
      ? game.tool==='pet' && petDraft().coat===el.dataset.petCoat
      : el.dataset.petMark
      ? game.tool==='pet' && petDraft().mark===el.dataset.petMark
      : el.dataset.petPaws
      ? game.tool==='pet' && petDraft().paws===el.dataset.petPaws
      : el.dataset.siteStatus
      ? buildingStyleDraft().status===el.dataset.siteStatus
      : el.dataset.siteFill
      ? buildingStyleDraft().fill===el.dataset.siteFill
      : el.dataset.siteEdge
      ? buildingStyleDraft().edge===el.dataset.siteEdge
      : el.dataset.siteName
      ? false
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
  const bx=bc.getContext('2d'); bx.strokeStyle=uiInk('--icon-ink-soft'); bx.lineWidth=3.2; bx.lineCap='round'; bx.lineJoin='round';
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
    if (plantRefFits({s:k,v:null})) mk(k, null, M.group ? (M.chip||M.name.split(' ').slice(0,2).join(' '))
                        : M.name.split(' ').slice(0,2).join(' '));
    for (const v in (M.cv||{})) if (plantRefFits({s:k,v})) mk(k, v, M.cv[v].name);
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
  const erasing = game.tool==='shovel', editingBuilding = game.tool==='building-edit';
  // Erase is "just another brush": its layer + size options ride the brush bar
  // exactly where path/bed options do, so the erase size dots ARE the paint size
  // dots (one control, can't drift). No rail popover, and on a collapsed phone
  // sheet the width/layer stay visible because the brush bar persists.
  /* Gated on `placement`, not `paints`. `paints` is false for fence, light,
     firepit, boulder, pot, seat, pet, house and building — nine of the
     seventeen placement tools — so for exactly those the brush bar, which
     carries the swatch and the "Now placing" name, was hidden. Arm a bench,
     look away, and nothing on screen said what a tap would do: the rail swatch
     has no branch for several of them, the sheet handle that carries the same
     label is display:none on the dock tier, and the status line fades at 4s.
     The seg blocks below are individually conditional and simply no-op when a
     tool has nothing contextual to offer, so the bar degrades to swatch + name
     — which is the part that was missing. */
  if (!meta.placement && !erasing && !editingBuilding){
    bar.classList.add('hidden'); return;
  }
  bar.classList.remove('hidden');
  const seg=(opts)=>{
    const s=document.createElement('div'); s.className='seg';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='seg-opt'+(o.on?' on':''); b.title=o.title||o.label;
      b.setAttribute('aria-pressed',o.on?'true':'false');
      if (o.tour) b.dataset.tour=o.tour;
      if (o.draw){ const c=document.createElement('canvas'); c.width=28; c.height=24;
        o.draw(c.getContext('2d')); b.appendChild(c); }   // layer chips are text-only
      const sp=document.createElement('span'); sp.textContent=o.label;
      b.appendChild(sp); b.onclick=o.click; s.appendChild(b);
    });
    return s;
  };
  const lab=document.createElement('span');
  lab.className='brush-lab'+(erasing?' danger':''); lab.textContent=erasing?'Erase':editingBuilding?'Footprint':'Brush';
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
  if (editingBuilding){
    /* Same shape as Erase: what the tool does, then the shared disc size —
       and Rename borrows the mode seg rather than becoming a third tool,
       because all three answer "what does a tap on a footprint do". */
    const mode=buildingEditMode();
    parts.push(seg([['add','Add'],['remove','Remove'],['rename','Rename']]
      .map(([m,lbl])=>({label:lbl, on:mode===m,
        title:m==='add'?'Extend a footprint onto ground it touches'
          :m==='remove'?'Trim tiles off a footprint'
          :'Tap a footprint to name it',
        click:()=>{ game.buildingEditMode=m; renderBrushBar(); updateActiveToolStatus(); }}))));
    if (mode!=='rename'){
      const curB=normalizeBrushSize(game.brushSize);
      parts.push(seg(BRUSH_SIZES.map(sz=>({label:String(sz), on:curB===sz,
        title:`${sz} tile${sz>1?'s':''} wide`, draw:tc=>drawBrushSizeIcon(tc,sz),
        click:()=>{ setBrushSize(sz); renderBrushBar(); updateActiveToolStatus(); }}))));
    }
    appendFooter();
    return;
  }
  const woody = isWoodyDef(P);
  // Draw vs Drift is a no-op for woody plants (they always plant singly), so
  // only herbaceous plants get that toggle.
  if (P && !woody) parts.push(seg([
    {label:'Draw', on:!game.drift&&!game.matrix, title:'Paint one plant at a time',
      draw:tc=>drawPlantModeIcon(tc,false), click:()=>choosePlantMode(false)},
    {label:'Drift',on:game.drift, tour:'drift', title:'Paint natural clusters',
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
  /* Fill only belongs to the tools that can actually flood one — the same
     `paints` predicate fillActive() gates on. The bar itself is now shown for
     every PLACEMENT tool so a bench or a pot can say what it is placing, and
     without this guard that also handed a bench a Fill chip that would have
     done nothing (chooseFillMode sets a flag fillActive() then refuses). */
  if (!meta.paints && !erasing){ appendFooter(); return; }
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
  if (game.tool==='pergola') return pergolaLabel();
  if (game.tool==='support') return cap(supportLabel());
  if (game.tool==='waterfeature') return cap(waterFeatureLabel());
  if (game.tool==='boulder') return boulderLabel();
  if (game.tool==='edging') return edgingLabel();
  if (game.tool==='crossing') return crossingLabel();
  if (game.tool==='survey') return surveyLabel();
  if (game.tool==='wall') return wallLabel();
  if (game.tool==='terrace') return terraceLabel();
  if (game.tool==='berm') return bermLabel();
  if (game.tool==='steps') return stepsLabel();
  if (game.tool==='pot') return potLabel();
  if (game.tool==='seat') return seatLabel();
  if (game.tool==='ornament') return ornamentLabel();
  if (game.tool==='house') return 'House';
  if (game.tool==='building') return 'Building footprint';
  if (game.tool==='building-edit') return 'Footprint · '+buildingEditMode();
  if (game.tool==='building-edit') return 'Footprint · '+buildingEditMode();
  if (game.tool==='shovel') return 'Erase';
  if (game.tool==='select') return 'Select';
  if (game.tool==='pick') return 'Eyedropper';
  if (trayGroupOf(game.trayCat)==='build') return 'Tap to choose a landscape tool';
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
  if (game.tool==='building-edit'){
    const m=buildingEditMode();
    return {k:'Edit footprint', v:m==='rename'
      ? 'Tap a footprint to name it'
      : m==='remove'
      ? `Tap or drag to trim tiles off a footprint — ${game.brushSize}-tile brush`
      : `Tap or drag ground touching a footprint to extend it — ${game.brushSize}-tile brush`};
  }
  if (P){
    const D=plantDef(game.tool,game.toolVar), mode=game.matrix?'Matrix':game.drift?'Drift':'Draw';
    const action=game.fillMode?'Tap a connected region to fill it':game.matrix?'Drag across the planting region':game.drift?'Tap or drag to form a natural cluster':'Tap once or drag to paint';
    const placement=isWoodyDef(P)?` — ${cap(game.woodyAge)} size`:` — ${game.freePlanting?'Free':'Grid'} placement`;
    return {k:D.name,v:`${mode} — ${action}${placement}`};
  }
  const guides={
    hand:{k:'Hand',v:'Drag to pan — pinch, wheel, or View Tools to zoom'},
    select:{k:'Select',v:game.sel?`${game.selMode==='copy'?'Duplicate':'Move'} — drag the selection to ${game.selMode==='copy'?'place a duplicate':'move it'}; Delete erases it`:'Drag a box around an area, then use the actions that appear'},
    ruler:{k:'Tape measure',v:'Tap two points or drag between them'},
    pick:{k:'Eyedropper',v:'Tap an existing plant, material, or structure to copy it'},
    shovel:{k:'Erase',v:`${cap(game.eraseMode)} layer — tap or drag — ${game.brushSize}-tile brush`},
    path:{k:`${pathColor(game.pathColor).label} path`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    bed:{k:`${bedStyle(game.bedStyle).label} bed`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    water:{k:`${waterStyle(game.waterStyle).label} water`,v:game.fillMode?'Tap a connected region to fill it':'Tap or drag to paint; use Fill for a connected region'},
    edging:{k:edgingLabel(),v:edgingDraft()==='none'?'Tap a bed to lift its edging':'Tap a bed or path to edge all of it; tap again in another style to change it'},
    survey:{k:surveyLabel(),v:surveyDraft()==='existing'?'Tap or drag over what is already there':'Tap or drag over something to make it proposed again'},
    crossing:{k:crossingLabel(),v:crossingDraft()==='none'?'Tap or drag over a crossing to lift it':'Tap or drag across water to lay it'},
    wall:{k:wallLabel(),v:wallDraft()==='none'?'Tap a terrace to strip its wall back to earth':'Tap a terrace or sunken patio to face all of it'},
    terrace:{k:terraceLabel(),v:game.fillMode?'Tap a bed or area to build all of it to this height'
      :`Drag corner to corner, or tap for a ${pergolaSizeText(TERRACE_TAP_W,TERRACE_TAP_H)} raised bed — tap a terrace to change what you picked`},
    steps:{k:stepsLabel(),v:'Tap the edge of a terrace or sunken patio where the steps go — tap a flight to change it'},
    berm:{k:bermLabel(),v:`Drag out the box it fills, or tap for a ${(()=>{ const r=bermTapRect(0,0,bermDraft().h); return pergolaSizeText(r.x1-r.x0+1,r.y1-r.y0+1); })()} ${bermDraft().h<0?'swale':'berm'}`},
    raise:{k:'Raise grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    lower:{k:'Lower grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    level:{k:'Level grade',v:`Tap or drag — ${game.brushSize}-tile brush`},
    fence:{k:fenceLabel(),v:'Tap or drag to draw a connected run'},
    light:{k:lightLabel(),v:'Tap or drag on clear, dry ground'},
    firepit:{k:firepitLabel(),v:'Tap clear, dry ground to place'},
    pergola:{k:pergolaLabel(),v:`Tap for one ${pergolaSizeText(PERGOLA_TAP_TILES,PERGOLA_TAP_TILES)}, or drag corner to corner`},
    support:{k:cap(supportLabel()),v:'Tap or drag to place, then plant a climber on it'},
    waterfeature:{k:cap(waterFeatureLabel()),v:'Tap clear ground, or stand it in a pond'},
    boulder:{k:boulderLabel(),v:'Tap clear, dry ground to place'},
    pot:{k:cap(potLabel()),v:'Tap or drag to set it down — paving is fine, then plant it'},
    seat:{k:cap(seatLabel()),v:'Tap or drag to place seating on clear, dry ground'},
    ornament:{k:ornamentLabel(),v:'Tap or drag to set it on lawn, a bed or paving'},
    pet:{k:cap(petLabel()),v:'Tap a clear spot — decoration only, never on the plan'},
    house:{k:'Legacy house',v:'Tap the map to place the current size and finish'}
  };
  return guides[game.tool]||{k:'Choose a tool',v:'Select a plant or build tool from the palette'};
}
/* Park the status clear of the tool rail.
   Its left was a hardcoded 70px (8px on the sheet tier) chosen for a rail of a
   different width, and the rail is z-index 10 against the status's 9 — so at
   375px the rail sat at x 8-62 and buried 54px of the panel, taking the start
   of the sentence with it. Measure the rail instead, and mirror to the right
   edge when the left-handed layout moves it, so the two can never disagree
   again. `usableCanvasRect()` caps the width so a long line cannot run under
   the docked library either. */
function placeStatusByRail(el){
  const rail=document.getElementById('canvasTools');
  if (!rail || !rail.getBoundingClientRect || !el.style) return;   // headless: no geometry
  const host=el.offsetParent||document.body;
  if (!host || !host.getBoundingClientRect) return;
  if (getComputedStyle(rail).display==='none'){ el.style.left=''; el.style.right=''; el.style.maxWidth=''; return; }
  const hr=host.getBoundingClientRect();
  const safe=typeof usableCanvasRect==='function' ? usableCanvasRect() : null;
  const lefty=document.body.classList.contains('left-handed-layout');
  const rr=rail.getBoundingClientRect(), gap=8;
  if (lefty){
    el.style.left='auto';
    el.style.right=Math.round(hr.right-rr.left+gap)+'px';
    if (safe) el.style.maxWidth=Math.round(rr.left-gap-safe.left)+'px';
  } else {
    el.style.right='auto';
    el.style.left=Math.round(rr.right-hr.left+gap)+'px';
    if (safe) el.style.maxWidth=Math.round(safe.right-(rr.right+gap))+'px';
  }
}
/* Step round the Start here list. Both want the strip under the top bar, and the
   list's top came from measuring while the hint's was a fixed CSS value, 7px
   apart on a phone, so in a new garden the hint printed straight over "Start here
   0 of 5" and neither could be read. The list is what stays, so the hint gives
   way: narrower, into the gap beside the list (docked, where the list sits across
   the canvas); else under it (a phone, where it fills the strip); and only where
   the open list leaves no room at all, where it was, on a plate the list cannot
   show through. Pure, on layout boxes in the stage's coordinates: offset*, not a
   rect, because the hint's reveal and the list's entrance both move a rect.
   Returns null to stay home. */
const STATUS_MIN_W=120, STATUS_LIST_GAP=8;
function statusAroundStartHere(hint,list,floor){
  const meets=hint.left<list.left+list.width && list.left<hint.left+hint.width
    && hint.top<list.top+list.height && list.top<hint.top+hint.height;
  if (!meets) return null;
  const room=list.left-STATUS_LIST_GAP-hint.left;
  if (room>=STATUS_MIN_W) return {maxWidth:room};
  const below=list.top+list.height+STATUS_LIST_GAP;
  if (below+hint.height<=floor) return {top:below};
  return {plate:true};
}
function placeStatusByStartHere(el){
  if (!el.style) return;
  el.style.top='';   // home, the CSS value, before measuring anything against it
  el.classList.remove('over-list');
  const list=document.getElementById('startHere');
  if (!list || list.classList.contains('hidden')) return;
  const box=e=>({left:e.offsetLeft,top:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight});
  const at=statusAroundStartHere(box(el),box(list),usableCanvasRect().bottom);
  if (!at) return;
  if (at.maxWidth) el.style.maxWidth=Math.round(at.maxWidth)+'px';
  else if (at.top) el.style.top=Math.round(at.top)+'px';
  else el.classList.add('over-list');
}
function placeActiveToolStatus(el){
  placeStatusByRail(el);
  placeStatusByStartHere(el);
}
/* The list moves on its own (opens, shuts, goes with the first plant, follows a
   resize) and the hint can be up when it does: for four seconds usually, and for
   the whole of a footprint draft, which the list's own step starts. */
function reseatActiveToolStatus(){
  const el=document.getElementById('activeToolStatus');
  if (el && el.classList.contains('show')) placeActiveToolStatus(el);
}
function updateActiveToolStatus(){
  const el=document.getElementById('activeToolStatus'); if (!el) return;
  const info=toolGuide();
  el.innerHTML=`<b>${info.k}</b>${info.v?`<span>${info.v}</span>`:''}`;
  placeActiveToolStatus(el);
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
  /* The tour's opening step asks for the garden back, and ANY state but full
     gives it back — the half sheet is capped at 55dvh. Testing for 'collapsed'
     made one tap of the chevron (full -> half) not count, so the step sat there
     asking again for something the gardener had just done.
     The tour's own steps also drive the sheet, but every one of those is a LATER
     step than this, and tourNote ignores an event it has already passed, so a
     driven change can never rewind anyone. */
  if (game.sheetState!=='full') tourNote('sheet');
}
function cycleSheetState(){
  const s=normalizedSheetState(game.sheetState);
  setSheetState(s==='collapsed'?'half':s==='half'?'full':'collapsed');
}
function nudgeSheetState(dir){
  const i=SHEET_STATES.indexOf(normalizedSheetState(game.sheetState));
  setSheetState(SHEET_STATES[Math.max(0,Math.min(SHEET_STATES.length-1,i+dir))]);
}
/* Must stay verbatim-identical to the SHEET tier in styles.css (see the
   "Responsive tiers" comment there). Portrait tablets get the bottom sheet, not
   the side dock, so orientation decides rather than width alone. If these two
   ever disagree the tri-state logic and the layout argue about which UI is up. */
const SHEET_UI_MQ='(max-width:767px), (max-width:1024px) and (orientation:portrait)';
function mobileSheetUi(){ return typeof matchMedia==='function' && matchMedia(SHEET_UI_MQ).matches; }
function nudgeCatalogHandle(dir){
  if (mobileSheetUi()){ nudgeSheetState(dir); return; }
  // Desktop/tablet have one unambiguous destination in each direction.
  setSheetState(dir<0?'collapsed':'full');
}
/* The height the sheet will REST at once the inline height is cleared — which
   is the only legal FLIP target, because `finish()` below drops that inline
   height the moment the transition ends. Answer it by MEASURING the CSS, never
   by re-deriving it from viewport rulers: all three resting heights are
   CSS-governed (`100dvh - --sheet-safe-top` at full, `min(55dvh,480px)` at
   half, content at collapsed) and no ruler JS can read reproduces all three.

   Full used to be `min(trueViewH(), visualViewport.height) - safe top`, and the
   visualViewport arm is exactly what a soft keyboard moves. Measured at
   375x812: the sheet rests at 751px, while that expression returned 451px for
   as long as the keyboard was up — within 5px of the half state's 447px. And
   renderCvRow calls applySheetState on EVERY buildToolTray, so the debounced
   Find rebuild ran one per keystroke: the full sheet animated down to
   half-height and then snapped back to full when the inline height was
   dropped, once per letter typed. The clamp never bought the keyboard
   clearance it looks like it is buying — it only ever held for the 200ms of
   the transition. It also never agreed with the CSS on iOS Safari with the URL
   bar expanded, where trueViewH() is the largest ruler (100lvh) and the CSS is
   100dvh; measuring is right in that case too.

   Runs under `.sheet-measuring`, which kills transitions, so the temporary
   height cannot itself animate — the trick half and collapsed already relied
   on. 'auto' for collapsed, which has no CSS height and must size to its
   content; '' for the two that do, so their own rule wins. */
function sheetTargetHeight(hb,state){
  const old=hb.style.height; hb.style.height=state==='collapsed'?'auto':'';
  const h=Math.ceil(hb.getBoundingClientRect().height); hb.style.height=old;
  return Math.max(48,h);   // floor: a sheet that is not laid out must not animate to nothing
}
/* The FLIP for the closing library: with transform-origin at 0 0, map the
   panel's rect exactly onto the launcher's. Pure, because "does the ghost
   actually land on the launcher" is the one thing here that can be silently
   wrong and is invisible in a still screenshot. Scale is floored so a
   zero-height launcher cannot collapse the ghost to nothing mid-flight. */
function flyTransform(from,to){
  return {
    tx: to.left-from.left,
    ty: to.top-from.top,
    sx: Math.max(0.02, to.width/from.width),
    sy: Math.max(0.02, to.height/from.height),
  };
}
/* Desktop close: the library is a grid COLUMN, so collapsing it re-lays out the
   canvas and the panel simply blinks out — nothing connects it to the control
   it can be reopened from. Fly a ghost of the panel up into that control, the
   top-bar Library toggle, so the destination is legible. (It flew DOWN to a
   launcher in the canvas corner until that launcher was retired for the toggle;
   the name stayed, the destination moved.)

   A ghost rather than the panel itself, because `.sheet-collapsed` is
   `display:none` and the panel has to leave the grid immediately — that is what
   keeps the canvas resize to ONE. And transform/opacity only, never width: see
   the `.sheet-fly` note in styles.css for why animating the column would cost a
   full ground rebake per frame. Being compositor-driven also means a catalog
   rebuild on the same click cannot stutter it. */
function flyLibraryToLauncher(from){
  const launcher=document.getElementById('btnLibraryToggle');
  if (!launcher || typeof launcher.getBoundingClientRect!=='function') return;
  const to=launcher.getBoundingClientRect();
  if (!to.width || !to.height) return;                     // launcher not laid out — skip rather than fly to 0,0
  const ghost=document.createElement('div');
  ghost.className='sheet-fly';
  ghost.setAttribute('aria-hidden','true');                // decoration; screen readers already heard the state change
  ghost.style.left=from.left+'px';  ghost.style.top=from.top+'px';
  ghost.style.width=from.width+'px'; ghost.style.height=from.height+'px';
  (document.body||document.documentElement).appendChild(ghost);
  const f=flyTransform(from,to);
  // Force the start style to be computed, then set the end state SYNCHRONOUSLY.
  // Deliberately not deferred to requestAnimationFrame: rAF does not fire in a
  // backgrounded or non-compositing tab, and a ghost that never gets its end
  // state would sit over the garden as a static slab until the cleanup timer.
  // The reflow below is all a transition needs to have something to run from.
  ghost.getBoundingClientRect();
  ghost.style.transform=`translate(${f.tx}px,${f.ty}px) scale(${f.sx},${f.sy})`;
  ghost.style.opacity='0.05';
  const done=()=>{ if (ghost.parentNode) ghost.remove(); };
  ghost.addEventListener('transitionend',done,{once:true});
  setTimeout(done,600);   // a swallowed transitionend must never strand the ghost over the garden
}
/* What the sheet was last LAID OUT as: its state, the tier, and whether the
   site-photo editor has hidden it (visibility, which the rail reservation and
   usableCanvasRect both read). Empty until the first layout. */
let sheetLaidOut='';
function applySheetState(){
  const hb=document.querySelector('.hud-bottom'); if (!hb) return;
  const phone=mobileSheetUi();
  let s=normalizedSheetState(game.sheetState);
  // The middle state belongs only to the phone bottom sheet. Larger screens
  // move directly between the browser and the compact current-tool bar.
  if (!phone&&s==='half') s='full';
  game.sheetState=s; game.sheetCollapsed=s==='collapsed';
  syncDiscoveryArtVisibility();
  /* Nothing about the sheet's GEOMETRY has changed, so there is nothing to lay
     out: only its label, swatch and chip, which follow the armed tool.
     This runs on every tool change and every catalog rebuild (renderCvRow),
     and the layout below is not cheap. On a phone it swaps measuring classes
     across the whole ~950-node catalog and reads its height twice, 6-7ms of
     every tool tap even going Hand to Ruler; on the dock it ran
     settleViewportChange, the whole resize routine (both canvases, the
     compass, the chrome menus, eight throwaway measuring divs) for a library
     that had not moved. Measured in Chrome on the demo garden.
     A FLIP already in flight to this same state is left alone to finish,
     which is what restarting it from mid-flight used to amount to anyway. */
  const laidOut=s+'|'+(phone?1:0)+'|'+(hb.classList.contains('photo-editing')?1:0);
  if (laidOut===sheetLaidOut && hb.classList.contains('sheet-'+s)){ syncSheetChrome(s,phone); return; }
  sheetLaidOut=laidOut;
  // the sheet is one of the four things usableCanvasRect measures, and the
  // ResizeObserver behind it only fires a frame later
  if (typeof invalidateUsableRect==='function') invalidateUsableRect();
  const priorFocus=document.activeElement;
  const catalog=document.getElementById('sheetCatalog');
  const focusWasInCatalog=!!(priorFocus&&catalog&&catalog.contains(priorFocus));
  const focusWasExpand=!!(priorFocus&&(priorFocus.id==='btnSheetUp'||priorFocus.id==='btnLibraryPlacing'));
  const reduced=reducedMotion();
  const start=phone?hb.getBoundingClientRect().height:0;
  // Desktop collapse flies a ghost of the panel into its toggle, so measure
  // where the panel IS before the class swap takes it out of the grid.
  const wasCollapsed=hb.classList.contains('sheet-collapsed');
  const deskFrom=(!phone && !reduced && s==='collapsed' && !wasCollapsed)
    ? hb.getBoundingClientRect() : null;
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
      if (typeof syncRailBottom==='function') syncRailBottom();
      if (typeof placePlantCard==='function') placePlantCard();
    } else {
      hb.style.height=`${start}px`; hb.getBoundingClientRect();
      hb.classList.remove('sheet-measuring'); hb.classList.add('sheet-animating');
      const token=(hb._sheetToken||0)+1; hb._sheetToken=token;
      hb._sheetFrame=requestAnimationFrame(()=>{ hb._sheetFrame=null; if (hb._sheetToken===token) hb.style.height=`${target}px`; });
      const finish=()=>{ if (hb._sheetToken!==token) return;
        if (hb._sheetEnd) hb.removeEventListener('transitionend',hb._sheetEnd);
        hb._sheetEnd=null; if (hb._sheetTimer) clearTimeout(hb._sheetTimer); hb._sheetTimer=null;
        hb.classList.remove('sheet-animating'); hb.style.height='';
        /* The sheet has finished moving, so the rail can be re-bounded
           against where it actually came to rest. During the ~200ms flight
           the rail is briefly over-long, behind a sheet that is animating
           over it — invisible, and cheaper than measuring every frame. */
        if (typeof syncRailBottom==='function') syncRailBottom();
        if (typeof placePlantCard==='function') placePlantCard(); };
      hb._sheetEnd=ev=>{ if (ev.target!==hb||ev.propertyName!=='height') return; finish(); };
      hb.addEventListener('transitionend',hb._sheetEnd);
      hb._sheetTimer=setTimeout(finish,700); // cleanup even if rotation/display changes swallow transitionend
    }
  } else {
    hb.style.height=''; hb.dataset.sheetReady=''; hb.classList.remove('sheet-measuring','sheet-animating');
    // The destination is the top-bar toggle, laid out whatever the library
    // is doing. One resize has been scheduled; the flight itself adds no
    // further layout.
    if (deskFrom && deskFrom.width>1 && deskFrom.height>1) flyLibraryToLauncher(deskFrom);
    /* Resize the canvas NOW, in the same task as the class swap. The grid
       column collapses the moment the class lands, but the backing store only
       follows on the ResizeObserver's rAF a frame later — and in between the
       browser stretches the old bitmap across the wider box. That one upscaled
       frame is the soft grey smear you see as the library closes. Settling
       synchronously means the layout change and the repaint are the same frame.
       The observer still fires afterwards; sizeCanvas no-ops when the size
       already matches, so that costs an ordinary frame, not a rebake. */
    if (typeof settleViewportChange==='function') settleViewportChange();
  }
  syncSheetChrome(s,phone);
  const up=document.getElementById('btnSheetUp'), libBtn=document.getElementById('btnLibraryToggle');
  const moveFocus=target=>{ if (!target) return; try{ target.focus({preventScroll:true}); }catch(_){ target.focus(); } };
  // Focus that was inside the library cannot stay there once it is display:none,
  // and the chip that opened it has just hidden itself: both land on the
  // top-bar toggle, the control that reverses what just happened.
  if (s==='collapsed'&&focusWasInCatalog) moveFocus(phone?up:libBtn);
  else if (!phone&&s==='full'&&focusWasExpand) moveFocus(libBtn);
}
/* The sheet's words and pictures, as opposed to its geometry: the "Now placing"
   label, the handle and chevrons, the swatch, the library chip. They follow the
   armed tool, so they refresh on every applySheetState, including the ones
   that have nothing to lay out. */
function syncSheetChrome(s,phone){
  const label=sheetContextLabel();
  // compared against the node itself, not hudText's cache: updateActiveToolStatus writes it too
  const ctx=document.getElementById('sheetCtx'); if (ctx && ctx.textContent!==label) ctx.textContent=label;
  const handle=document.getElementById('sheetHandle'); if (handle){
    handle.setAttribute('data-state',s);
    handle.setAttribute('aria-label',phone
      ? `${cap(s)} plant palette. Swipe or use the show less and show more buttons.`
      : `${s==='collapsed'?'Collapsed':'Expanded'} catalog. ${label} is selected. Use the Library button in the top bar to ${s==='collapsed'?'browse plants':'show more of the plan'}.`);
  }
  const down=document.getElementById('btnSheetDown'), up=document.getElementById('btnSheetUp');
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
  drawSheetSwatch();
  syncLibraryChrome(s,phone);
  renderBuildingDraftActions();
}
/* a mini render of the armed brush in the collapse handle, so you always see
   what you're about to paint. */
function drawSheetSwatch(){
  const c=document.getElementById('sheetSwatch'); if (!c) return;
  drawBrushSwatchCanvas(c,false);
}
/* The docked library's two pieces of chrome outside the library itself.

   The top-bar toggle is the one door, open or shut. It replaced a round ✕ in
   the library's header (which read as "close", and minimised) and a launcher in
   the canvas corner that wore the same hamburger icon as Menu and said "Plant
   library" even on the Landscape tab. Its pressed state is the library's state.

   The chip answers what the old launcher never did: what is on the brush. The
   brush bar and its "Now placing" row live in the library's footer, so shutting
   the library took them with it and left nothing on screen saying what a tap
   would plant. It shows only while a placement tool is armed; with Hand, Select
   and the rest the rail already says what the pointer does. */
function libraryOpen(){ return normalizedSheetState(game.sheetState)!=='collapsed'; }
/* Open the library on one category with one tool armed (or Hand), from outside
   the library — the start-here steps. A plant category opens the whole plant
   catalog (All) rather than one shelf of it: "choose plants" is a browse. */
function openLibraryAt(cat,tool){
  const plants=trayGroupOf(cat)==='plants';
  game.toolMenu=null; game.drill=null; game.searchOpen=false; game.traySearch='';
  game.trayCat=cat; lastCatByGroup[trayGroupOf(cat)]=cat;
  discoveryOpenSpecies=null;
  setDiscovery({category:null,returnCategory:null,query:plants?'':activeDiscovery().query,limit:36});
  setTool(tool||'hand');
  if (!libraryOpen()) setSheetState(mobileSheetUi() ? 'half' : 'full');
  buildToolTray();
}
function toggleLibrary(){
  setSheetState(libraryOpen() ? 'collapsed' : (mobileSheetUi() ? 'half' : 'full'));
}
function syncLibraryChrome(s=normalizedSheetState(game.sheetState),phone=mobileSheetUi()){
  const open=s!=='collapsed';
  const btn=document.getElementById('btnLibraryToggle');
  if (btn){
    btn.setAttribute('aria-expanded',open?'true':'false');
    btn.title=open ? 'Hide the library (L)' : 'Show the library (L)';
  }
  const chip=document.getElementById('btnLibraryPlacing');
  if (!chip) return;
  const armed=!phone && !open && isPlacementTool(game.tool);
  chip.classList.toggle('hidden',!armed);
  if (!armed) return;
  const name=sheetContextLabel();
  hudText('libraryPlacingName',name);
  chip.setAttribute('aria-label',`Now placing ${name}. Open the library to change it.`);
  chip.title='Open the library to change what you are placing';
  drawBrushSwatchCanvas(document.getElementById('libraryPlacingSwatch'),false);
}

const replaceSearch=document.getElementById('replacePlantSearch');
/* Debounced like the catalog's Find and the Library search (120ms), and held
   while an IME is composing. Clearing the chosen replacement belongs with the
   render it feeds, so until the list redraws, the plant still highlighted is
   the one Apply would use. A render after the dialog has closed finds no
   context and returns. */
let replaceSearchTimer=0, replaceComposing=false;
function scheduleReplaceSearch(){
  clearTimeout(replaceSearchTimer);
  replaceSearchTimer=setTimeout(()=>{
    if (replacePlantContext&&!replacePlantContext.choosingSource) replacePlantContext.target=null;
    renderReplacePlantUi();
  },120);
}
if (replaceSearch){
  replaceSearch.addEventListener('input',e=>{ if (!replaceComposing&&!e.isComposing) scheduleReplaceSearch(); });
  replaceSearch.addEventListener('compositionstart',()=>{ replaceComposing=true; clearTimeout(replaceSearchTimer); });
  replaceSearch.addEventListener('compositionend',()=>{ replaceComposing=false; scheduleReplaceSearch(); });
}
const replaceApply=document.getElementById('btnReplacePlantApply'); if (replaceApply) replaceApply.onclick=applyPlantReplacement;
const replaceCancel=document.getElementById('btnReplacePlantCancel'); if (replaceCancel) replaceCancel.onclick=()=>{ closeOverlay('replacePlantScreen'); replacePlantContext=null; };
const replaceScreen=document.getElementById('replacePlantScreen'); if (replaceScreen) replaceScreen.onclick=e=>{ if (e.target===replaceScreen){ closeOverlay('replacePlantScreen'); replacePlantContext=null; } };
const estimateDepth=document.getElementById('estimateDepth'); if (estimateDepth) estimateDepth.addEventListener('input',renderSelectionEstimate);
const estimateClose=document.getElementById('btnEstimateClose'); if (estimateClose) estimateClose.onclick=()=>closeOverlay('estimateScreen');
const estimateScreen=document.getElementById('estimateScreen'); if (estimateScreen) estimateScreen.onclick=e=>{ if (e.target===estimateScreen) closeOverlay('estimateScreen'); };
const siteFile=document.getElementById('sitePhotoFile'); if (siteFile) siteFile.onchange=()=>{ const f=siteFile.files&&siteFile.files[0]; if (f) importSitePhoto(f); };
const siteWidth=document.getElementById('sitePhotoWidth'); if (siteWidth) siteWidth.onchange=()=>{ if (!game.underlay) return;
  const feet=displayToFt(siteWidth.value); if (!Number.isFinite(feet)||feet<=0){ syncSitePhotoEditor(); return; }
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
