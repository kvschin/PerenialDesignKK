'use strict';
/* ---------- plant roles ----------
   Designer mode uses roles to push the right plants forward for the
   chosen garden style. Roles are computed from the plant data so the
   species file stays focused on botany; explicit PLANTS[k].roles can be
   added later for finer curation. */
const DESIGN_STYLE_LABELS={
  any:'Any garden',
  cottage:'Cottage',
  prairie:'Prairie / Meadow',
  butterfly:'Pollinator',
  shade:'Shade / Woodland',
  japanese:'Japanese',
  mediterranean:'Mediterranean',
  modern:'Modern',
  gravel:'Gravel / Rock',
  formal:'Formal',
  coastal:'Coastal',
};
const ROLE_LABELS={
  architectural:'Architectural',
  aromatic:'Aromatic',
  block:'Block planting',
  bulbLayer:'Bulb layer',
  canopy:'Canopy',
  coastal:'Coastal',
  cottage:'Cottage',
  deerOk:'Deer-resistant',
  dry:'Dry garden',
  early:'Early season',
  evergreen:'Evergreen',
  late:'Late season',
  fern:'Fern layer',
  flower:'Flower color',
  formal:'Formal',
  gravel:'Gravel garden',
  groundcover:'Groundcover',
  hedge:'Hedge',
  host:'Host plant',
  hydrangea:'Hydrangea',
  japanese:'Japanese',
  matrix:'Matrix',
  mediterranean:'Mediterranean',
  modern:'Modern',
  movement:'Movement',
  native:'Native',
  naturalistic:'Naturalistic',
  nectar:'Nectar',
  pollinator:'Pollinator',
  prairie:'Prairie',
  rabbitOk:'Rabbit-resistant',
  romantic:'Romantic',
  seasonal:'Seasonal color',
  seedhead:'Seedheads',
  shade:'Shade',
  silver:'Silver foliage',
  structure:'Structure',
  water:'Water plants',
  wet:'Moist soil',
  wind:'Wind tolerant',
  winter:'Winter interest',
  woodland:'Woodland',
};
const ROLE_DISPLAY_ORDER=[
  'prairie','matrix','pollinator','nectar','host','shade','woodland','groundcover',
  'structure','hedge','evergreen','architectural','modern','formal','japanese',
  'cottage','romantic','bulbLayer','early','dry','gravel','mediterranean',
  'coastal','wind','winter','seedhead','native','flower','seasonal','water','wet',
  'fern','hydrangea','aromatic','silver','movement','canopy','block',
  'late','deerOk','rabbitOk'
];
const STYLE_ROLE_WEIGHTS={
  cottage:{cottage:9,romantic:5,flower:4,pollinator:3,bulbLayer:3,hydrangea:4,seasonal:2,shade:1},
  prairie:{prairie:9,native:4,matrix:5,naturalistic:4,pollinator:3,winter:3,seedhead:3,dry:1,movement:1},
  butterfly:{pollinator:9,nectar:6,host:6,flower:4,native:3,early:2,seasonal:1},
  shade:{shade:9,woodland:7,groundcover:4,fern:5,early:2,wet:2,structure:1,canopy:1},
  japanese:{japanese:10,structure:5,evergreen:4,shade:3,formal:2,canopy:2,groundcover:1},
  mediterranean:{mediterranean:9,dry:6,aromatic:4,silver:4,architectural:3,gravel:2},
  modern:{modern:9,architectural:6,structure:5,block:5,matrix:3,winter:3,formal:2,seedhead:2},
  gravel:{gravel:9,dry:6,architectural:4,silver:3,matrix:2,mediterranean:2},
  formal:{formal:10,hedge:8,evergreen:5,structure:5,block:3,bulbLayer:2,architectural:1},
  coastal:{coastal:9,wind:6,matrix:3,dry:2,groundcover:1,movement:1},
};
const STYLE_RECOMMEND_MIN={
  cottage:9,
  prairie:12,
  butterfly:14,
  shade:10,
  japanese:10,
  mediterranean:10,
  modern:10,
  gravel:10,
  formal:10,
  coastal:10,
};
const ROLE_CACHE={};
function hasSeasonProp(P,prop){
  return Object.values(P.sea||{}).some(s=>s && s[prop]);
}
function roleMatches(text,terms){
  return terms.some(t=>text.includes(t));
}
/* ---------- deer & rabbit browse resistance ----------
   Curated from Rutgers / Missouri Botanical browse ratings for this palette.
   The texture rules in plantRoles already cover the broadly-avoided groups
   (grasses, sedges, ferns, aromatic mints, fuzzy/silver foliage). These sets
   add the toxic or bitter forbs, the resistant minor bulbs, and the few tough
   shrubs those rules miss. Whole genera that are uniformly left alone go in
   GROUPS; one-off species go in KEYS. Deer and rabbits track each other
   closely on this native/prairie palette, so one list drives both roles. */
const BROWSE_RESIST_GROUPS=new Set([
  'allium','alliumbulb','milkweed','iris','baptisia','amsonia','liatris',
  'coreopsis','burnet','blueeyedgrass','boxwood','rudbeckia','camassia',
]);
const BROWSE_RESIST_KEYS=new Set([
  // toxic or bitter forbs
  'creamindigo','helenium','culvers','penstemon','columbine','wildgeranium',
  'bluebells','heuchera','astilbe','solomonsseal','shootingstar',
  'greatstjohnswort','filipendula','goldenrod','joepye','gaura','poppymallow',
  'pasqueflower','prairiesmoke','goldenalexander','heartleafalexander',
  // resistant minor bulbs (toxic alkaloids or onion scent)
  'daffodil','snowdrop','winteraconite','fritillaria','colchicum','lycoris',
  'muscari','scillaperuviana','puschkinia','ipheion','leucojum','anemoneblanda',
  // tough shrubs
  'sumac','coralberry','smokebush',
]);
// readily browsed despite a broad cue (hosta, tulips, crocus, sedum, lilies,
// New Jersey tea) — left off the resistant list on purpose.
function plantRoles(k){
  if (ROLE_CACHE[k]) return ROLE_CACHE[k];
  const P=PLANTS[k]; if (!P) return [];
  const roles=new Set(P.roles||[]);
  const text=`${P.name} ${P.latin} ${P.group||''} ${P.form||''}`.toLowerCase();
  const group=P.group||'';
  roles.add(P.type);
  if (P.native) roles.add('native');
  if (P.sun==='part') roles.add('shade'), roles.add('woodland');
  if (P.moist==='dry') roles.add('dry');
  if (P.moist==='moist') roles.add('wet');
  if (hasSeasonProp(P,'bloom')) roles.add('flower'), roles.add('pollinator'), roles.add('seasonal');
  if (hasSeasonProp(P,'seed')) roles.add('winter'), roles.add('seedhead');
  if (P.native && ['grass','sedge','forb','bulb','water'].includes(P.type))
    roles.add('prairie'), roles.add('naturalistic');
  if (P.native && ['shrub','tree'].includes(P.type)) roles.add('naturalistic');
  if (P.type==='grass') roles.add('matrix'), roles.add('movement'), roles.add('wind');
  if (P.type==='sedge') roles.add('matrix'), roles.add('groundcover'), roles.add('woodland');
  if (P.type==='bulb') roles.add('bulbLayer'), roles.add('early'), roles.add('seasonal');
  if (P.type==='water') roles.add('wet'), roles.add('water'), roles.add('naturalistic');
  if (P.type==='shrub') roles.add('structure');
  if (P.type==='tree') roles.add('structure'), roles.add('canopy');
  if (P.form==='fern') roles.add('fern'), roles.add('shade'), roles.add('woodland');
  if (P.form==='leafmound') roles.add('groundcover'), roles.add('shade'), roles.add('woodland');
  if (['globe','spike','drumstick','rosette','vertgrass','fountaingrass','cloudgrass','conifer'].includes(P.form))
    roles.add('architectural');
  if (['umbel','cone','pincushion','bractstack'].includes(P.form)) roles.add('flower');
  if (P.form==='hydrangea') roles.add('hydrangea'), roles.add('cottage'), roles.add('romantic'), roles.add('shade');

  if (group==='boxwood' || group==='yew'){
    roles.add('evergreen'); roles.add('formal'); roles.add('hedge');
    roles.add('structure'); roles.add('japanese'); roles.add('block');
  }
  if (group==='allium' || text.includes('allium')){
    if (P.type==='bulb') roles.add('bulbLayer');
    roles.add('architectural'); roles.add('formal');
    roles.add('modern'); roles.add('pollinator'); roles.add('nectar');
  }
  if (roleMatches(text,['hydrangea','phlox','yarrow','stachys','scabiosa','sedum','sanguisorba','salvia','catmint','aster','monarda','iris','filipendula','lobelia','poppy mallow','poppymallow','gaura']))
    roles.add('cottage'), roles.add('romantic');
  if (roleMatches(text,['monarda','bee balm','asclepias','milkweed','butterfly weed','zizia','golden alexander','aster','goldenrod','liatris','mountain mint','agastache','coneflower','echinacea','rudbeckia','coreopsis','helenium','helianthus','sunflower','silphium','prairie dock','burnet','sanguisorba','scabiosa','phlox','penstemon','columbine','heuchera','lobelia','hypericum','st. johnswort','callirhoe','poppy mallow','gaura','oenothera','shooting star','primula','pasque','pulsatilla','filipendula','geum','prairie smoke','tradescantia','spiderwort','sisyrinchium','blue-eyed grass','iris','salvia','calamint','catmint','allium']))
    roles.add('pollinator'), roles.add('nectar');
  if (roleMatches(text,['asclepias','milkweed','butterfly weed'])) roles.add('host');
  if (roleMatches(text,['antennaria','pussytoes','zizia','golden alexander'])) roles.add('host');
  if (roleMatches(text,['monarda','mountain mint','calamint','agastache','catmint','salvia','yarrow']))
    roles.add('aromatic');
  if (roleMatches(text,['yucca','eryngium','rattlesnake','echinops','stipa','fescue','mexican feather','calamint','catmint','salvia','yarrow','agastache','allium','baptisia','leadplant','pussytoes','antennaria','pasque','pulsatilla','prairie smoke','geum','poppy mallow','callirhoe','gaura','blue-eyed grass','sisyrinchium']))
    roles.add('dry'), roles.add('gravel'), roles.add('mediterranean');
  if (roleMatches(text,['silver','blue fescue','yucca','eryngium','echinops','yarrow','stachys','rattlesnake','pussytoes','antennaria']))
    roles.add('silver');
  if (roleMatches(text,['japanese maple','flowering cherry','hakone','hosta','fern','astilbe','heuchera','hydrangea','ginkgo','birch','yew','boxwood']))
    roles.add('japanese');
  if (roleMatches(text,['fountain grass','miscanthus','feather reed','calamagrostis','fescue','hakone','boxwood','yew','hydrangea','allium','ginkgo','maple','cherry','birch','rattlesnake','eryngium','echinops']))
    roles.add('modern'), roles.add('block');
  if (roleMatches(text,['boxwood','yew','hydrangea','allium','japanese maple','flowering cherry','ginkgo','serviceberry']))
    roles.add('formal'), roles.add('structure');
  if (roleMatches(text,['muhly','fescue','stipa','sedge','carex','panicum','switchgrass','dropseed','sideoats','yucca','bald cypress','birch']))
    roles.add('coastal'), roles.add('wind');
  // late-season bloom — drives the "Late-Season Glow" prompt
  if (P.sea && P.sea.Fall && P.sea.Fall.bloom) roles.add('late');
  // deer & rabbit resistance: broad texture cues + the curated lists above.
  // Trees outgrow browse height, so the questionnaire exempts them and they
  // never carry the role here.
  if (P.type!=='tree' && (
        roles.has('grass') || roles.has('sedge') || roles.has('fern') ||
        roles.has('aromatic') || roles.has('silver') ||
        BROWSE_RESIST_GROUPS.has(group) || BROWSE_RESIST_KEYS.has(k))){
    roles.add('deerOk'); roles.add('rabbitOk');
  }
  return ROLE_CACHE[k]=[...roles].sort();
}
function roleLabel(role){ return ROLE_LABELS[role] || cap(role); }
function roleSummary(k,max=6){
  const roles=plantRoles(k).filter(r=>ROLE_LABELS[r]);
  roles.sort((a,b)=>{
    const ai=ROLE_DISPLAY_ORDER.indexOf(a), bi=ROLE_DISPLAY_ORDER.indexOf(b);
    return (ai<0?999:ai)-(bi<0?999:bi) || roleLabel(a).localeCompare(roleLabel(b));
  });
  return roles.slice(0,max).map(roleLabel).join(', ');
}
function activeDesignType(){
  const d=game.design && game.design.type;
  return (game.gameMode==='design' && d && STYLE_ROLE_WEIGHTS[d]) ? d : null;
}
function designTypeName(type){ return DESIGN_STYLE_LABELS[type] || cap(type||'design'); }
function plantStyleScore(k,type=activeDesignType()){
  const weights=STYLE_ROLE_WEIGHTS[type]; if (!weights) return 0;
  return plantRoles(k).reduce((n,r)=>n+(weights[r]||0),0);
}
function plantStyleRecommended(k,type=activeDesignType()){
  return plantStyleScore(k,type)>=(STYLE_RECOMMEND_MIN[type]||1);
}

/* A daily challenge can pin the palette to plants that fit its prompt. A
   plant must satisfy every criterion the match specifies:
     types — plant.type is one of these
     moist — plant.moist is one of these (e.g. dry/medium for a dry bed, so
             adaptable medium-moisture plants the prompt names aren't lost)
     roles — shares at least one role from plantRoles
   plus an escape hatch:
     keys  — explicit species the prompt names, always allowed
   No match → everything fits (mood/technique prompts like Monochrome,
   Repetition, Cottage Abundance leave the palette open). */
function matchAllows(m,k){
  if (!m) return true;
  if (m.keys && m.keys.includes(k)) return true;
  const P=PLANTS[k];
  if (m.types && !m.types.includes(P.type)) return false;
  if (m.moist && !m.moist.includes(P.moist)) return false;
  if (m.roles){ const rs=plantRoles(k); if (!m.roles.some(r=>rs.includes(r))) return false; }
  return true;
}
function challengeAllows(k){ return matchAllows(game.challenge && game.challenge.match, k); }
// Total selectable species, and how many a given challenge admits (ignoring
// zone — that's a separate axis). 0 of total is the "full palette" case.
function speciesCount(){ return PLANT_KEYS.filter(k=>!PLANTS[k].hidden).length; }
function challengePaletteSize(c){
  if (!c || !c.match) return speciesCount();
  return PLANT_KEYS.filter(k=>!PLANTS[k].hidden && matchAllows(c.match,k)).length;
}
/* ---------- region filter ----------
   A plant fits if it survives the chosen zone, and (for natives) calls
   the chosen ecoregion home. Cultivars aren't native anywhere, so the
   eco filter can't exclude them — the natives-only switch is how. */
function plantFits(k){
  const P=PLANTS[k], r=game.region;
  if (r.zone && (P.zones[0]>r.zone || P.zones[1]<r.zone)) return false;
  if (r.nativesOnly && !P.native) return false;
  if (r.eco && P.native && !P.eco.includes(r.eco)) return false;
  if (!challengeAllows(k)) return false;                 // daily challenge limits the palette
  // deer / rabbit pressure from the design questionnaire: hide plants they
  // readily browse. Trees outgrow browse height, so they're exempt.
  const d=game.design;
  if (d && P.type!=='tree'){
    if (d.deer && !plantRoles(k).includes('deerOk')) return false;
    if (d.rabbit && !plantRoles(k).includes('rabbitOk')) return false;
  }
  return true;
}
function trayKeys(){ // grasses first (the matrix), then sedges, forbs, bulbs/water, woody
  const ord={grass:0, sedge:1, forb:2, bulb:3, water:4, shrub:5, tree:6};
  const d=activeDesignType();
  return PLANT_KEYS.filter(k=>!PLANTS[k].hidden).filter(plantFits).sort((a,b)=>{
    if (d){
      const ds=plantStyleScore(b,d)-plantStyleScore(a,d);
      if (ds) return ds;
    }
    return (ord[PLANTS[a].type]-ord[PLANTS[b].type]) || PLANTS[a].name.localeCompare(PLANTS[b].name);
  });
}
// First plant sub-tab (in tab order) that actually has stock under the current
// filter — so a daily challenge whose palette skips grasses (bulbs, ephemerals,
// woody) opens on a populated tab instead of an empty one.
function firstStockedTrayCat(){
  const keys=trayKeys();
  for (const c of TRAY_CATS){
    if (!c.types) continue;                              // skip Build tool tabs
    if (keys.some(k=>c.types.includes(PLANTS[k].type) && (!c.sunFilter || PLANTS[k].sun===c.sunFilter)))
      return c.id;
  }
  return 'grasses';
}
function openRegion(){
  const rs=$('regionSel'), zs=$('zoneSel');
  if (!rs.options.length){
    rs.innerHTML='<option value="">Anywhere</option>'+
      REGIONS.map(r=>`<option>${r.name}</option>`).join('');
    zs.innerHTML='<option value="">Any zone</option>'+
      [3,4,5,6,7,8,9].map(z=>`<option>${z}</option>`).join('');
    rs.onchange=()=>{ const r=REGIONS.find(x=>x.name===rs.value);
      $('regionBlurb').textContent=r?r.blurb:'';
      if (r) zs.value=String(r.zone); };
  }
  rs.value=game.region.eco||'';
  zs.value=game.region.zone?String(game.region.zone):'';
  const cur=REGIONS.find(x=>x.name===rs.value);
  $('regionBlurb').textContent=cur?cur.blurb:'';
  $('nativesOnly').checked=!!game.region.nativesOnly;
  $('regionScreen').classList.remove('hidden');
}
function applyRegion(){
  game.region={eco:$('regionSel').value||null,
    zone:$('zoneSel').value?+$('zoneSel').value:null,
    nativesOnly:$('nativesOnly').checked};
  sSet('hortus:region',game.region);
  updateRegionBtn();
  if (game.mode) buildToolTray();
  const visibleKeys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const n=visibleKeys.filter(plantFits).length;
  toast(`${n} of ${visibleKeys.length} species fit${game.region.eco?' the '+game.region.eco:''}${game.region.zone?', zone '+game.region.zone:''}.`);
  closeOverlay('regionScreen');
}
function updateRegionBtn(){
  const r=game.region;
  $('regionLbl').textContent=(r.eco||r.zone||r.nativesOnly)
    ? `${r.eco||'Any region'}${r.zone?' · z'+r.zone:''}` : 'Region';
}

/* ---------- HUD / tool tray ---------- */
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
  {id:'landscape',label:'Landscape',        tools:['path','bed','water']},
  {id:'leveling', label:'Leveling',         tools:['raise','lower','level']},
  {id:'structures',label:'Structures',      tools:['fence','firepit']},
  {id:'lighting', label:'Lighting',         tools:['light']},
  {id:'house',    label:'House',            tools:['house']},
];
// two-tier tab grouping: a top-level Plants / Build toggle decides which set
// of category sub-tabs shows, so the bar never spills all twelve at once.
const TRAY_GROUPS=[
  {id:'plants', label:'Plants', cats:['grasses','sedges','sunper','shadeper','bulbs','waterplants','shrubs','trees']},
  {id:'build',  label:'Build',  cats:['landscape','leveling','structures','lighting','house']},
];
function trayGroupOf(catId){ const g=TRAY_GROUPS.find(g=>g.cats.includes(catId)); return g?g.id:'plants'; }
let lastCatByGroup={plants:'grasses', build:'landscape'}; // remember the sub-tab per group
// which garden layer a planted tile belongs to (perennials vs woody)
function plantLayerOf(p){ const P=p&&PLANTS[p.s];
  return (P && (P.type==='shrub'||P.type==='tree')) ? 'woody' : 'perennials'; }
// is a layer currently visible? hidden layers don't render and can't be edited
function layerShown(name){ return game.layerVis[name]!==false; }
const ENABLE_LAYER_EDIT_FOCUS = false; // kept for later; hidden now because visibility is the useful layer control
// does the active edit focus permit touching this layer? (focus is 'all' for now)
function layerEditable(name){ return !ENABLE_LAYER_EDIT_FOCUS || game.layerFocus==='all' || game.layerFocus===name; }
const LAYER_LABELS={all:'All',perennials:'Perennials',bulbs:'Bulbs',woody:'Woody Plants',landscape:'Landscape/Hardscape'};
const LAYER_DEFS=[['perennials'],['bulbs'],['woody'],['landscape']]; // editable layers, in menu order
// the layer a placement tool draws onto (so we can warn when it's hidden)
function isPlacementTool(t){ return t==='house'||t==='fence'||t==='light'||t==='firepit'||t==='path'||t==='bed'||t==='water'||isElevationTool(t)||!!PLANTS[t]; }
function toolTargetLayer(t){ t=t||game.tool;
  if (t==='house'||t==='fence'||t==='light'||t==='firepit'||t==='path'||t==='bed'||t==='water'||isElevationTool(t)) return 'landscape';
  const P=PLANTS[t]; if (!P) return null;
  if (P.type==='bulb') return 'bulbs';
  if (P.type==='shrub'||P.type==='tree') return 'woody';
  return 'perennials';
}
function isBrushTool(k){ return !!PLANTS[k] || k==='path' || k==='bed' || k==='water' || isElevationTool(k) || k==='house' || k==='fence' || k==='light' || k==='firepit'; }
function brushTrayCatForTool(k){
  if (PLANTS[k]) return plantCategoryFor(k);
  if (isElevationTool(k)) return 'leveling';
  if (k==='path'||k==='bed'||k==='water') return 'landscape';
  if (k==='fence'||k==='firepit') return 'structures';
  if (k==='light') return 'lighting';
  if (k==='house') return 'house';
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
  if (k==='path'||k==='bed'||k==='water') return catId==='landscape';
  if (k==='fence'||k==='firepit') return catId==='structures';
  if (k==='light') return catId==='lighting';
  if (k==='house') return catId==='house';
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
  game.toolMenu=null;
  if (k!=='select'){ game.sel=null; game.selItems=null; selDrag=null; selMove=null; } // leaving select drops its marquee
  if (k==='fence'||k==='light'||k==='firepit'||k==='house'||k==='shovel'||k==='hand'||k==='select'||k==='pick') game.fillMode=false;
  game.tool=k; game.toolVar=v||null;
  rememberBrushTool();
  refreshTray(); renderCvRow(); refreshCanvasTools(); updateCanvasCursor();
}
function drawCanvasIcon(tc,kind){
  tc.clearRect(0,0,42,32);
  tc.strokeStyle='#d8c7ac'; tc.fillStyle='#d8c7ac'; tc.lineWidth=2;
  tc.lineCap='round'; tc.lineJoin='round';
  if (kind==='hand'){
    tc.beginPath(); tc.moveTo(11,20); tc.lineTo(11,11); tc.moveTo(17,20); tc.lineTo(17,8);
    tc.moveTo(23,20); tc.lineTo(23,10); tc.moveTo(29,21); tc.lineTo(29,14);
    tc.moveTo(11,20); tc.quadraticCurveTo(13,29,21,30); tc.quadraticCurveTo(30,30,31,23); tc.stroke();
  } else if (kind==='select'){
    tc.setLineDash([4,3]); tc.strokeRect(8,7,24,18); tc.setLineDash([]);
    tc.beginPath(); tc.moveTo(26,22); tc.lineTo(34,29); tc.moveTo(30,29); tc.lineTo(34,29); tc.lineTo(34,25); tc.stroke();
  } else if (kind==='brush'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.72);
    tc.fillStyle='#c97f3f'; tc.fillRect(-3,-13,6,19);
    tc.fillStyle='#efe6d3'; tc.fillRect(-5,4,10,6);
    tc.fillStyle='#6f8f5a'; tc.beginPath(); tc.moveTo(-6,10); tc.quadraticCurveTo(0,17,6,10); tc.closePath(); tc.fill();
    tc.restore();
  } else if (kind==='erase'){
    tc.save(); tc.translate(21,17); tc.rotate(-0.5);
    tc.fillStyle='#e8b8c2'; tc.strokeStyle='#6e5a48'; tc.lineWidth=1.6;
    tc.fillRect(-11,-7,22,14); tc.strokeRect(-11,-7,22,14);
    tc.fillStyle='#cdbfa9'; tc.fillRect(-11,-7,8,14); tc.strokeRect(-11,-7,8,14);
    tc.restore();
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
    tc.beginPath(); tc.moveTo(13,23); tc.lineTo(27,9); tc.stroke();
    tc.strokeRect(24,6,6,6); tc.beginPath(); tc.moveTo(11,25); tc.lineTo(18,25); tc.stroke();
  } else if (kind==='undo'||kind==='redo'){
    const flip=kind==='redo'?-1:1; tc.save(); tc.translate(kind==='redo'?42:0,0); tc.scale(flip,1);
    tc.beginPath(); tc.arc(22,17,9,0.25*Math.PI,1.65*Math.PI,true); tc.stroke();
    tc.beginPath(); tc.moveTo(12,10); tc.lineTo(10,20); tc.lineTo(20,18); tc.stroke(); tc.restore();
  } else if (kind==='rotate'){
    tc.beginPath(); tc.arc(21,16,10,0.15*Math.PI,1.72*Math.PI,false); tc.stroke();
    tc.beginPath(); tc.moveTo(30,8); tc.lineTo(35,8); tc.lineTo(34,13); tc.stroke();
    tc.fillStyle='rgba(201,127,63,.28)'; tc.beginPath();
    tc.moveTo(21,7); tc.lineTo(32,16); tc.lineTo(21,25); tc.lineTo(10,16); tc.closePath(); tc.fill();
  } else if (kind==='layers'){
    for (let i=0;i<3;i++){ tc.beginPath(); tc.moveTo(21,8+i*7); tc.lineTo(33,14+i*7);
      tc.lineTo(21,20+i*7); tc.lineTo(9,14+i*7); tc.closePath(); tc.stroke(); }
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
  const c=document.createElement('canvas'); c.width=42; c.height=32;
  drawCanvasIcon(c.getContext('2d'),kind);
  const s=document.createElement('span'); s.textContent=label;
  b.append(c,s);
  if (opts&&opts.onClick) b.onclick=opts.onClick;
  return b;
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
function fillActive(){ return game.fillMode && isBrushTool(game.tool) && game.tool!=='house' && game.tool!=='fence' && game.tool!=='light' && game.tool!=='firepit'; }
function groundMat(x,y){ return tileTerrain(x,y) || 'grass'; }
function doFloodFill(sx,sy){
  if (sx<0||sy<0||sx>=GW||sy>=GH || inHouse(sx,sy) || isDoor(sx,sy)) return;
  const seed=groundMat(sx,sy);
  // BFS the 4-connected region sharing that ground material
  const region=[], seen=new Set([sx+','+sy]), q=[[sx,sy]];
  while (q.length){
    const [x,y]=q.shift(); region.push([x,y]);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy, key=nx+','+ny;
      if (nx<0||ny<0||nx>=GW||ny>=GH || seen.has(key)) continue;
      if (inHouse(nx,ny) || isDoor(nx,ny)) continue;
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
/* eyedropper: sample whatever is on the tapped tile (plant > bulb > fence/light/firepit > terrain)
   and arm it as the brush, dropping straight into Plant mode so the next tap
   paints with it. */
function pickAt(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return;
  const k=`${x},${y}`;
  const direct=game.plants[k], sh=shrubAt(x,y);
  const p=(direct&&!direct.removed)?direct:(sh&&sh.p), b=game.bulbs[k], f=fenceAt(x,y), l=lightAt(x,y), fp=firepitAt(x,y), terr=terrainAt(x,y);
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
  game.drift=!!drift;
  armPlantToolFromRail(false);
  toast(game.drift
    ? 'Drift planting on. Pick a plant, then paint natural clusters.'
    : 'Draw mode. Pick a plant, then paint single placements.');
}
function choosePlacementMode(free){
  game.freePlanting=!!free;
  armPlantToolFromRail(false);
  toast(game.freePlanting
    ? 'Free placement on. Herbaceous plants land where you click, not just tile centers.'
    : 'Grid placement on. Plants sit neatly at tile centers.');
}
function renderEraseTray(tray){
  renderCvRow();
  const sep=t=>{ const s=document.createElement('span'); s.className='tray-sep';
    s.textContent=t; tray.appendChild(s); };
  const toolBtn=(label,kind,sel,fn,title)=>{
    const b=document.createElement('button');
    b.className='tool danger'+(sel?' sel':'');
    b.title=title||label;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const ctx2=c.getContext('2d'); ctx2.save(); ctx2.translate(3,6);
    drawCanvasIcon(ctx2,kind); ctx2.restore();
    const sp=document.createElement('span'); sp.textContent=label;
    b.append(c,sp); b.onclick=fn; tray.appendChild(b);
    return b;
  };
  sep('Erase');
  [['all','All'],['plant','Plants'],['bulb','Bulbs'],['terrain','Land']]
    .forEach(([m,lbl])=>toolBtn(lbl,'erase',game.eraseMode===m,()=>{
      game.eraseMode=m;
      buildToolTray(); refreshCanvasTools();
      toast(m==='all'?'Erasing everything.':`Erasing ${lbl.toLowerCase()} only.`);
    },`Erase ${lbl.toLowerCase()}`));
  sep('Size');
  [1,3,5].forEach(sz=>toolBtn(sz===1?'1 tile':`${sz}x${sz}`,'layers',game.eraseSize===sz,()=>{
    game.eraseSize=sz;
    buildToolTray(); refreshCanvasTools();
    toast(`Erase size: ${sz}x${sz}.`);
  },`Erase size ${sz}x${sz}`));
}
function renderSelectTray(tray){
  renderCvRow();
  const sep=t=>{ const s=document.createElement('span'); s.className='tray-sep';
    s.textContent=t; tray.appendChild(s); };
  const btn=(label,kind,sel,fn,title,dim)=>{
    const b=document.createElement('button');
    b.className='tool'+(sel?' sel':'')+(dim?' disabled':'');
    b.title=title||label;
    const c=document.createElement('canvas'); c.width=48; c.height=44;
    const ctx2=c.getContext('2d'); ctx2.save(); ctx2.translate(3,6);
    drawCanvasIcon(ctx2,kind); ctx2.restore();
    const sp=document.createElement('span'); sp.textContent=label;
    b.append(c,sp); if (!dim) b.onclick=fn; tray.appendChild(b);
    return b;
  };
  if (!game.sel){
    const hint=document.createElement('span'); hint.className='tray-empty';
    hint.textContent='Drag a box on the garden to select an area.';
    tray.appendChild(hint);
    return;
  }
  // mode toggles: how a drag on the selection behaves
  sep('Drag to');
  btn('Move','move',game.selMode==='move',()=>{ game.selMode='move'; buildToolTray();
    toast('Drag the selection to move it.'); },'Drag the selection to a new spot');
  btn('Duplicate','copy',game.selMode==='copy',()=>{ game.selMode='copy'; buildToolTray();
    toast('Drag the selection to drop a copy.'); },'Drag to drop a copy, leaving the original');
  // one-shot actions
  sep('Actions');
  btn('Fill','fill',false,()=>{ fillSelectionWithPlant(); },
    'Fill the selection with the last selected plant or landscape material');
  btn('Rotate','rotate',false,()=>{ rotateSelection(); buildToolTray(); refreshCanvasTools(); },
    'Rotate the selection 90°');
  btn('Erase','erase',false,()=>{ eraseSelection(); refreshCanvasTools(); },
    'Delete everything in the selection');
  sep('Area');
  btn('Save','save',false,()=>{ saveSelectedArea(); },
    'Save this selected area for later pasting');
  btn('Paste','paste',false,()=>{ pasteSavedArea(); },
    'Paste the saved area starting at this selection',!storedArea());
}
function refreshCanvasTools(){ buildCanvasTools(); }
// The top bar carries the view/select controls — Select · Rotate · Layers, the
// non-painting tools — beside the season dial. Keep their icons + state in sync,
// and (re)render the Layers flyout pinned under its button.
function syncTopTools(){
  const sel=document.getElementById('btnSelectTool');
  if (sel){ sel.classList.toggle('sel',game.tool==='select');
    sel.onclick=()=>{ setTool('select'); buildToolTray(); };
    const c=document.getElementById('btnSelectIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'select'); }
  const rot=document.getElementById('btnRotateTool');
  if (rot){ rot.onclick=()=>rotateView(1);
    const c=document.getElementById('btnRotateIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'rotate'); }
  const lay=document.getElementById('btnLayersTool');
  if (lay){ lay.classList.toggle('sel',game.toolMenu==='layers'||layerViewActive());
    lay.onclick=()=>toggleLayerMenu();
    const c=document.getElementById('btnLayersIcon'); if (c) drawCanvasIcon(c.getContext('2d'),'layers'); }
  renderLayerMenu();
}
function buildCanvasTools(){
  const rail=document.getElementById('canvasTools'); if (!rail) return;
  syncTopTools();
  rail.innerHTML='';
  const add=(label,kind,opts)=>rail.appendChild(makeCanvasTool(label,kind,opts||{}));
  const sep=()=>{ const s=document.createElement('div'); s.className='canvas-sep'; rail.appendChild(s); };
  add('Hand','hand',{active:game.tool==='hand',title:'Hand / safe select: drag the map to pan',
    onClick:()=>setTool('hand')});
  add('Plant','brush',{active:!!PLANTS[game.tool]&&!game.fillMode,
    title:'Plant: pick a species below; set Draw/Drift and Grid/Free in the brush bar',
    onClick:()=>armPlantToolFromRail(false)});
  add('Erase','erase',{active:game.tool==='shovel',danger:true,title:'Erase plants, bulbs, or landscape',
    onClick:()=>{ setTool('shovel'); buildToolTray(); }});
  add('Pick','dropper',{active:game.tool==='pick',
    title:'Eyedropper: tap a tile to copy its plant or material onto the brush',
    onClick:()=>{ setTool('pick'); buildToolTray(); }});
  // Undo/Redo are one-shot history actions, not modes — docked below a divider
  // so they read apart from the paint tools; greyed when their stack is empty.
  sep();
  add('Undo','undo',{disabled:!undoStack.length,title:'Undo (Ctrl+Z)',onClick:doUndo});
  add('Redo','redo',{disabled:!redoStack.length,title:'Redo (Ctrl+Shift+Z)',onClick:doRedo});
}
/* a small themed yes/no modal, built on the fly (matches the .screen panels).
   Returns nothing; calls onOk only if the user confirms. */
function showConfirm(title, body, okLabel, onOk){
  const old=document.getElementById('confirmPop'); if (old) old.remove();
  const scr=document.createElement('div');
  scr.id='confirmPop'; scr.className='screen';
  scr.style.cssText='z-index:60;background:rgba(0,0,0,.55)';
  scr.innerHTML='<div class="panel pause-panel"><h2></h2><p class="sub"></p>'+
    '<div class="row" style="margin-top:14px">'+
    '<button class="btn" data-x></button><button class="btn primary" data-ok></button></div></div>';
  scr.querySelector('h2').textContent=title;
  scr.querySelector('p').textContent=body||'';
  scr.querySelector('[data-x]').textContent='Cancel';
  scr.querySelector('[data-ok]').textContent=okLabel||'OK';
  const close=()=>scr.remove();
  scr.querySelector('[data-x]').onclick=close;
  scr.querySelector('[data-ok]').onclick=()=>{ close(); onOk&&onOk(); };
  scr.addEventListener('click',e=>{ if (e.target===scr) close(); });
  document.body.appendChild(scr);
}
/* the layer is hidden but the gardener is trying to draw on it: offer to
   reveal it, and honor their click by placing once they say yes. */
function promptRevealLayer(layer,x,y){
  const label=LAYER_LABELS[layer];
  showConfirm(`Show the ${label} layer?`,
    `The ${label} layer is hidden right now, so you can't see what you place there. Show it and plant?`,
    'Show layer',
    ()=>{
      game.layerVis[layer]=true; refreshCanvasTools();
      withUndo(()=>{
        if (game.tool==='house'){ placeHouse(x,y); }
        else { game.tx=x; game.ty=y; actHere(); }
      });
    });
}
// true when the view is anything other than "everything visible, no overlay"
function layerViewActive(){
  return (ENABLE_LAYER_EDIT_FOCUS && game.layerFocus!=='all') || game.layerVis.shade || LAYER_DEFS.some(([k])=>!layerShown(k));
}
function blockIfWrongEditLayer(layer){
  if (!layer || layerEditable(layer)) return false;
  toast(`Edit focus is ${LAYER_LABELS[game.layerFocus]||game.layerFocus}. Switch to All or ${LAYER_LABELS[layer]} to edit here.`);
  return true;
}
function toggleLayerMenu(){
  game.toolMenu = game.toolMenu==='layers' ? null : 'layers';
  refreshCanvasTools();
}
// The Layers flyout hangs off the top-bar Layers button now, so pin it there as
// a fixed dropdown (same idea as the garden/time menus) and rebuild it in place
// whenever the rail refreshes — its rows call refreshCanvasTools() to re-render.
function renderLayerMenu(){
  const old=document.getElementById('layerPop'); if (old) old.remove();
  const btn=document.getElementById('btnLayersTool');
  if (game.toolMenu!=='layers' || !btn) return;
  const pop=buildLayerPopover(); pop.id='layerPop';
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
  pop.className='tool-popover layer-popover';
  const section=title=>{ const h=document.createElement('div');
    h.className='layer-section'; h.textContent=title; pop.appendChild(h); };
  // one row = a visibility toggle. The whole row (eye + label) flips it;
  // the row mutes when off and stays put so it can be turned back on.
  const row=(get,set,label)=>{
    const on=get();
    const b=document.createElement('button');
    b.className='layer-row'+(on?'':' off');
    b.title=(on?'Hide ':'Show ')+label;
    const eye=document.createElement('span'); eye.className='layer-eye';
    eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); set(!on); refreshCanvasTools();
      toast(`${label} ${!on?'shown':'hidden'}.`); };
    pop.appendChild(b);
  };
  const focusRow=(key,label)=>{
    const on=game.layerFocus===key;
    const b=document.createElement('button');
    b.className='layer-row'+(on?' sel':'');
    b.title=`Edit ${label}`;
    const eye=document.createElement('span'); eye.className='layer-eye';
    eye.textContent=on?'*':'-';
    const nm=document.createElement('span'); nm.className='layer-name'; nm.textContent=label;
    b.append(eye,nm);
    b.onclick=ev=>{ ev.stopPropagation(); game.layerFocus=key; refreshCanvasTools();
      toast(key==='all'?'Editing all visible layers.':`Editing ${label} only.`); };
    pop.appendChild(b);
  };
  section('Visible');
  const allVisible=()=>LAYER_DEFS.every(([key])=>layerShown(key)) && !game.layerVis.shade;
  const allRow=document.createElement('button');
  allRow.className='layer-row'+(allVisible()?' sel':'');
  allRow.title='Show the normal full garden';
  const allEye=document.createElement('span'); allEye.className='layer-eye'; allEye.textContent=allVisible()?'*':'-';
  const allName=document.createElement('span'); allName.className='layer-name'; allName.textContent='All';
  allRow.append(allEye,allName);
  allRow.onclick=ev=>{ ev.stopPropagation();
    LAYER_DEFS.forEach(([key])=>{ game.layerVis[key]=true; });
    game.layerVis.shade=false; refreshCanvasTools(); toast('All layers shown.'); };
  pop.appendChild(allRow);
  LAYER_DEFS.forEach(([key])=>row(
    ()=>layerShown(key), v=>{ game.layerVis[key]=v; }, LAYER_LABELS[key]));
  if (ENABLE_LAYER_EDIT_FOCUS){
    section('Edit');
    focusRow('all','All');
    LAYER_DEFS.forEach(([key])=>focusRow(key,LAYER_LABELS[key]));
  }
  section('Overlays');
  row(()=>!!game.layerVis.shade, v=>{ game.layerVis.shade=v; }, 'Shade Overlay');
  return pop;
}
function trayViewKey(cat=game.trayCat,drill=game.drill){
  return `${cat}|${drill||''}|${game.searchOpen?'search':'grid'}`;
}
function saveTrayScroll(){
  const tray=document.getElementById('toolTray');
  if (!tray || !tray.dataset || !tray.dataset.viewKey) return;
  game.trayScroll[tray.dataset.viewKey]=tray.scrollLeft||0;
}
function restoreTrayScroll(){
  const tray=document.getElementById('toolTray');
  if (!tray || !tray.dataset) return;
  const key=trayViewKey();
  tray.dataset.viewKey=key;
  const left=game.trayScroll[key];
  tray.scrollLeft=Number.isFinite(left) ? left : 0;
}
function finishToolTrayRender(){
  restoreTrayScroll();
  updateCanvasCursor();
}
function buildToolTray(){
  saveTrayScroll();
  const tabs=document.getElementById('trayTabs'); tabs.innerHTML='';
  const activeGroup=trayGroupOf(game.trayCat);
  lastCatByGroup[activeGroup]=game.trayCat;
  const selectCat=(id)=>{ saveTrayScroll(); game.trayCat=id; game.toolMenu=null; game.drill=null;
    rememberBrushMenu(id,null);
    if (game.tool==='shovel'||game.tool==='select'||game.tool==='pick') setTool('hand');
    else refreshCanvasTools();
    buildToolTray(); };
  // tier 1: Plants / Build
  TRAY_GROUPS.forEach(g=>{
    const b=document.createElement('button');
    b.className='tab grp'+(activeGroup===g.id?' sel':''); b.textContent=g.label;
    b.onclick=()=>selectCat(lastCatByGroup[g.id]||g.cats[0]);
    tabs.appendChild(b);
  });
  // search is a toggle (a magnifier), not a permanent input row. When open it
  // takes the sub-tabs' place, so it never adds a wrapping row.
  const canSearch = game.tool!=='shovel' && game.tool!=='select';
  if (canSearch){
    const sb=document.createElement('button');
    // when open, the glyph flips to ✕ so it's obvious how to get the
    // categories back (it took their place); 🔍 when closed
    sb.className='tab tab-search'+(game.searchOpen?' sel close':'');
    sb.textContent=game.searchOpen?'✕':'\u{1F50D}';
    sb.title=game.searchOpen?'Close search — back to categories':'Search the open category';
    sb.onclick=()=>{ game.searchOpen=!game.searchOpen; if (!game.searchOpen) game.traySearch='';
      buildToolTray(); const i=document.getElementById('traySearch'); if (i) i.focus(); };
    tabs.appendChild(sb);
  }
  const div=document.createElement('span'); div.className='tab-div'; tabs.appendChild(div);
  if (canSearch && game.searchOpen){
    const si=document.createElement('input'); // search within the open category
    si.id='traySearch'; si.type='search'; si.placeholder='search plants…';
    si.value=game.traySearch||'';
    si.oninput=()=>{ game.traySearch=si.value; applyTraySearch(); };
    si.onkeydown=(e)=>{ if (e.key==='Escape'){ e.stopPropagation();
      game.searchOpen=false; game.traySearch=''; buildToolTray(); } };
    tabs.appendChild(si);
  } else {
    // tier 2: the active group's category sub-tabs
    const groupCats=TRAY_GROUPS.find(g=>g.id===activeGroup).cats;
    TRAY_CATS.filter(c=>groupCats.includes(c.id)).forEach(c=>{
      const b=document.createElement('button');
      b.className='tab'+(game.trayCat===c.id?' sel':''); b.textContent=c.label;
      b.onclick=()=>selectCat(c.id);
      tabs.appendChild(b);
    });
  }
  const tray=document.getElementById('toolTray'); tray.innerHTML='';
  const cat=TRAY_CATS.find(c=>c.id===game.trayCat)||TRAY_CATS[0];
  if (game.tool==='select'){
    renderSelectTray(tray);
    finishToolTrayRender();
    return;
  }
  if (game.tool==='shovel'){
    renderEraseTray(tray);
    finishToolTrayRender();
    return;
  }
  if (cat.types){
    let keys=trayKeys().filter(k=>cat.types.includes(PLANTS[k].type));
    if (cat.sunFilter) keys=keys.filter(k=>PLANTS[k].sun===cat.sunFilter);
    // if the filter took the selected species away, fall back sensibly
    const all=trayKeys();
    if (PLANTS[game.tool] && !all.includes(game.tool)){ game.tool='hand'; game.toolVar=null; }
    if (!keys.length){
      const sp=document.createElement('span'); sp.className='tray-empty';
      sp.textContent='Nothing fits the region filter here.';
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
      sections=[['Sun sedges',keys.filter(k=>PLANTS[k].sun==='full')],
        ['Shade sedges',keys.filter(k=>PLANTS[k].sun!=='full')]];
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
      const sc=Math.min(0.62, 36/(R.h||40));   // tall plants shrink to fit
      const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
      const iconSeason=R.type==='bulb' ? (SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring') : 'Summer';
      drawPlant(ctx2,24/sc,42/sc,rep,1,iconSeason,tileSeed(3,7),0,undefined,1);
      const sp=document.createElement('span');
      const label=P.group ? (R.groupLabel||P.group[0].toUpperCase()+P.group.slice(1))
                          : P.name.split(' ').slice(0,2).join(' ');
      sp.textContent=label;
      b.append(c,sp);
      b.onclick=()=>{
        if (drillable){ game.drill=k; rememberBrushMenu(game.trayCat,game.drill); buildToolTray(); }   // open its sub-species
        else { setTool(k,null); toast(`${P.name} — ${P.latin}`); }
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
  // material categories: Landscape and House.
  // A tool tab arms its first tool right away — RTS style.
  if (!cat.tools.includes(game.tool)){ game.tool=cat.tools[0]; game.toolVar=null; rememberBrushTool(); }
  renderCvRow();
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
      materialBtn(k,label,game.tool===k,draw,()=>{ setTool(k,null); buildToolTray(); toast(hint); },hint);
    });
    if (game.tool==='path' && cat.tools.includes('path')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Path color'; tray.appendChild(sep);
      PATH_COLORS.forEach((pc,i)=>materialBtn('path',pc.label.split(' ')[0],
        game.tool==='path'&&game.pathColor===pc.id,
        tc=>drawMat(tc,{fill:pc.fill,texture:'gravel',seed:100+i}),
        ()=>{ game.pathColor=pc.id; setTool('path',null); buildToolTray(); toast(`${pc.label} path selected.`); },
        pc.label).dataset.pathColor=pc.id);
    }
    if (game.tool==='bed' && cat.tools.includes('bed')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Bed type'; tray.appendChild(sep);
      BED_STYLES.forEach((bs,i)=>materialBtn('bed',bs.short||bs.label,
        game.tool==='bed'&&game.bedStyle===bs.id,
        tc=>drawMat(tc,{fill:bs.fill||'#54402f',texture:bs.texture,seed:150+i}),
        ()=>{ game.bedStyle=bs.id; setTool('bed',null); buildToolTray(); toast(`${bs.label} bed selected.`); },
        bs.label).dataset.bedStyle=bs.id);
    }
    if (game.tool==='water' && cat.tools.includes('water')){
      const sep=document.createElement('span'); sep.className='tray-sep';
      sep.textContent='Water'; tray.appendChild(sep);
      WATER_STYLES.forEach((ws,i)=>materialBtn('water',ws.label,
        game.tool==='water'&&game.waterStyle===ws.id,
        tc=>drawMat(tc,{fill:ws.fill,deep:ws.deep,texture:'water',seed:200+i}),
        ()=>{ game.waterStyle=ws.id; setTool('water',null); buildToolTray(); toast(`${ws.label} water selected.`); },
        ws.label).dataset.waterStyle=ws.id);
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
      b.className='tool tool-back'; b.title='Back to Structures';
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
      b.onclick=()=>{ setTool('fence',null); game.drill='fence'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
        toast(`${fenceLabel()} selected. Choose height/material or drag to draw connected runs.`); };
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
        setTool('fence',null); rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
        toast(`${fenceLabel()} selected. Drag to draw connected runs.`); };
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
      const sz=firepitTileSize(d), rx=d.shape==='round'?14+sz.w*3:13+sz.w*4, ry=d.shape==='round'?7+sz.h*2.2:8+sz.h*2.4;
      const cx2=24, cy2=27;
      tc.fillStyle='rgba(0,0,0,.24)'; tc.beginPath(); tc.ellipse(cx2,cy2+5,rx,4,0,0,7); tc.fill();
      if (d.shape==='round'){
        tc.fillStyle='#74695d'; tc.beginPath(); tc.ellipse(cx2,cy2,rx,ry,0,0,7); tc.fill();
        tc.fillStyle='#9a8f81'; tc.beginPath(); tc.ellipse(cx2,cy2-2,rx*.82,ry*.68,0,0,7); tc.fill();
        tc.fillStyle='#30261f'; tc.beginPath(); tc.ellipse(cx2,cy2-1,rx*.5,ry*.38,0,0,7); tc.fill();
      } else {
        const diamond=(rxx,ryy,yoff,fill)=>{ tc.fillStyle=fill; tc.beginPath();
          tc.moveTo(cx2,cy2-ryy+yoff); tc.lineTo(cx2+rxx,cy2+yoff);
          tc.lineTo(cx2,cy2+ryy+yoff); tc.lineTo(cx2-rxx,cy2+yoff); tc.closePath(); tc.fill(); };
        diamond(rx,ry,0,'#74695d'); diamond(rx*.82,ry*.68,-2,'#9a8f81'); diamond(rx*.48,ry*.36,-1,'#30261f');
      }
      tc.strokeStyle='#ef7f37'; tc.lineWidth=1.5; tc.lineCap='round';
      tc.beginPath(); tc.moveTo(cx2-4,cy2-2); tc.quadraticCurveTo(cx2-2,cy2-9,cx2,cy2-5);
      tc.moveTo(cx2+3,cy2-1); tc.quadraticCurveTo(cx2+5,cy2-8,cx2+2,cy2-11); tc.stroke();
    };
    const backBtn=()=>{
      const b=document.createElement('button');
      b.className='tool tool-back'; b.title='Back to Structures';
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
      toast(`${firepitLabel()} selected. Tap clear dry ground to place.`);
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
      b.onclick=()=>{ setTool('firepit',null); game.drill='firepit'; rememberBrushMenu(game.trayCat,game.drill); buildToolTray();
        toast(`${firepitLabel()} selected. Choose shape/size or tap to place.`); };
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
        setTool('light',null); buildToolTray();
        toast(`${lightLabel()} selected. Drag to place lighting.`); };
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
    const pb=toolBtn('Place', game.tool==='house',
      tc=>{ miniHouse(tc,24,18,hc.wall,hc.roof);
        tc.strokeStyle='#efe6d3'; tc.setLineDash([3,3]); tc.lineWidth=1.2;
        tc.strokeRect(3,8,42,32); },
      ()=>{ setTool('house',null); buildToolTray();
        toast('Tap the map to set a house down — hover shows where. Place as many as you like.'); });
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
    if (k==='fence') hay+=' structures fence gate door '+FENCE_STYLES.map(f=>f.label).join(' ');
    if (k==='firepit') hay+=' structures fire pit round square '+FIREPIT_SIZES.map(f=>f.label+' '+f.plan).join(' ');
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
      : el.dataset.lightType
      ? game.tool==='light' && lightDraft().type===el.dataset.lightType
      : el.dataset.lightTone
      ? game.tool==='light' && lightDraft().tone===el.dataset.lightTone
      : el.dataset.group
      ? !!(cur && cur.group===el.dataset.group)
      : el.dataset.k===game.tool;
    el.classList.toggle('sel', sel);
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
    const sc=Math.min(0.62, 36/(R.h||40));
    const ctx2=c.getContext('2d'); ctx2.scale(sc,sc);
    const iconSeason=R.type==='bulb' ? (SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring') : 'Summer';
    drawPlant(ctx2,24/sc,42/sc,k,1,iconSeason,tileSeed(3,7),0,v||undefined,1);
    const sp=document.createElement('span'); sp.textContent=label; b.append(c,sp);
    b.onclick=()=>{ setTool(k,v||null); buildToolTray();
      const D=plantDef(k,v); toast(`${D.name} — ${D.latin}`); };
    tray.appendChild(b);
  };
  members.forEach(k=>{
    const M=PLANTS[k];
    mk(k, null, M.group ? (M.chip||M.name.split(' ').slice(0,2).join(' '))
                        : M.name.split(' ').slice(0,2).join(' '));
    for (const v in (M.cv||{})) mk(k, v, M.cv[v].name);
  });
}
/* the Plant tool's brush styles, docked in the palette instead of a floating
   flyout: two segmented toggles — pattern (Draw/Drift) and placement
   (Grid/Free). Visible only when a plant species is the armed brush. */
function renderBrushBar(){
  const bar=document.getElementById('brushBar'); if (!bar) return;
  bar.innerHTML='';
  if (!PLANTS[game.tool] || game.tool==='shovel' || game.tool==='select'){
    bar.classList.add('hidden'); return;
  }
  bar.classList.remove('hidden');
  const seg=(opts)=>{
    const s=document.createElement('div'); s.className='seg';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='seg-opt'+(o.on?' on':''); b.title=o.title||o.label;
      const c=document.createElement('canvas'); c.width=28; c.height=24;
      o.draw(c.getContext('2d'));
      const sp=document.createElement('span'); sp.textContent=o.label;
      b.append(c,sp); b.onclick=o.click; s.appendChild(b);
    });
    return s;
  };
  const lab=document.createElement('span'); lab.className='brush-lab'; lab.textContent='Brush';
  const woody = PLANTS[game.tool].type==='shrub' || PLANTS[game.tool].type==='tree';
  const parts=[lab];
  // Draw vs Drift is a no-op for woody plants (they always plant singly), so
  // only herbaceous plants get that toggle; everyone gets Grid/Free placement.
  if (!woody) parts.push(seg([
    {label:'Draw', on:!game.drift, title:'Paint one plant at a time',
      draw:tc=>drawPlantModeIcon(tc,false), click:()=>choosePlantMode(false)},
    {label:'Drift',on:game.drift,  title:'Paint natural clusters',
      draw:tc=>drawPlantModeIcon(tc,true),  click:()=>choosePlantMode(true)},
  ]));
  parts.push(seg([
    {label:'Grid', on:!game.freePlanting, title:'Snap to tile centers',
      draw:tc=>drawPlacementIcon(tc,false), click:()=>choosePlacementMode(false)},
    {label:'Free', on:game.freePlanting,   title:'Land where you tap, not just centers',
      draw:tc=>drawPlacementIcon(tc,true),  click:()=>choosePlacementMode(true)},
  ]));
  bar.append(...parts);
}
/* the collapsible palette (phones only): the handle folds the catalog away so
   the garden gets the room while you paint; the brush bar + act button stay.
   sheetContextLabel names whatever brush is armed, for the collapsed strip. */
function sheetContextLabel(){
  const P=PLANTS[game.tool];
  if (P) return plantDef(game.tool,game.toolVar).name+(game.drift?' · drift':'');
  if (game.tool==='path')  return pathColor(game.pathColor).label+' path';
  if (game.tool==='water') return waterStyle(game.waterStyle).label+' water';
  if (game.tool==='bed')   return bedStyle(game.bedStyle).label+' bed';
  if (isElevationTool(game.tool)) return game.tool[0].toUpperCase()+game.tool.slice(1)+' grade';
  if (game.tool==='fence') return fenceLabel();
  if (game.tool==='light') return 'Lighting';
  if (game.tool==='firepit') return firepitLabel();
  if (game.tool==='house') return 'House';
  if (game.tool==='shovel') return 'Erase';
  if (game.tool==='select') return 'Select';
  if (game.tool==='pick') return 'Eyedropper';
  return 'Tap to choose a plant';
}
function applySheetState(){
  const hb=document.querySelector('.hud-bottom'); if (!hb) return;
  hb.classList.toggle('collapsed', !!game.sheetCollapsed);
  const ctx=document.getElementById('sheetCtx'); if (ctx) ctx.textContent=sheetContextLabel();
  const chev=document.querySelector('#sheetHandle .chev'); if (chev) chev.textContent=game.sheetCollapsed?'▴':'▾';
  drawSheetSwatch();
}
/* a mini render of the armed plant in the collapse handle, so you always see
   what you're about to paint. Materials/tools show no swatch (the label says it). */
function drawSheetSwatch(){
  const c=document.getElementById('sheetSwatch'); if (!c) return;
  const P=PLANTS[game.tool];
  if (!P){ c.style.display='none'; return; }
  c.style.display='';
  const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height);
  const R=plantDef(game.tool,game.toolVar);
  const sc=Math.min(0.5, 18/(R.h||40));
  g.save(); g.scale(sc,sc);
  const iconSeason=R.type==='bulb'?(SEASONS.find(s=>(R.sea[s]||{}).bloom)||'Spring'):'Summer';
  drawPlant(g,(c.width/2)/sc,(c.height-2)/sc,game.tool,1,iconSeason,tileSeed(3,7),0,game.toolVar||undefined,1);
  g.restore();
}
let lastHint='', lastAct='';
function setHint(txt){
  const el=document.getElementById('actionHint');
  if (!ENABLE_ACTION_HINT){
    el.classList.add('hidden');
    if (lastHint!==''){ lastHint=''; el.textContent=''; }
    return;
  }
  el.classList.remove('hidden');
  if (txt!==lastHint){ lastHint=txt; el.textContent=txt; }
}
function setActButton(){ // the big mobile do-it button, labeled by context
  if (!ENABLE_MOBILE_ACT_BUTTON){
    document.getElementById('btnAct').classList.add('hidden');
    document.getElementById('actionHint').classList.toggle('hidden',!ENABLE_ACTION_HINT);
    lastAct='';
    return;
  }
  const px3=Math.round(game.px), py3=Math.round(game.py);
  let label=null;
  if (ENABLE_HOUSE_SLEEP && isDoor(px3,py3)) label='Sleep';
  else if (game.tool==='hand') label=null;
  else if (game.tool==='shovel') label=game.eraseSize>1?`Erase ${game.eraseSize}×${game.eraseSize}`:'Erase here';
  else if (game.tool==='path') label='Lay path';
  else if (game.tool==='bed') label='Dig bed';
  else if (game.tool==='water') label='Add water';
  else if (game.tool==='raise') label='Raise grade';
  else if (game.tool==='lower') label='Lower grade';
  else if (game.tool==='level') label='Level grade';
  else if (game.tool==='fence') label=fenceDraft().gate?'Place gate':'Place fence';
  else if (game.tool==='light') label='Place light';
  else if (game.tool==='firepit') label='Place fire pit';
  else if (game.tool==='house') label=null;           // house places by tap
  else if (PLANTS[game.tool]) label=game.drift?'Plant a drift':'Plant here';
  const state=(baseZoom<1 && label) ? label : '';
  if (state!==lastAct){ lastAct=state;
    const b=document.getElementById('btnAct');
    b.classList.toggle('hidden',!state);
    if (state) b.textContent=state;
    // the big button replaces the instructional hint on phones
    document.getElementById('actionHint').classList.toggle('hidden',!!state||!ENABLE_ACTION_HINT);
  }
}
/* the time readout string. Design is a planner — real days are meaningless, so
   it shows season + how far through it; Story keeps the life-sim calendar. */
// the season box fill colour — Kevin's palette: easter green, dark green,
// the existing fall bronze, a darker winter blue
const SEASON_FILL = { Spring:'#7fc24e', Summer:'#2f7d3a', Fall:'#c97f3f', Winter:'#3f6190' };
// game-ms added per real-ms while holding the season box (~2 garden days/sec)
const FF_RATE = 40;
function clockMeta(){
  const cal=calClock();
  if (game.gameMode==='design'){
    const sf=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
    return `${cal.season} · ${sf<0.34?'early':sf<0.67?'mid':'late'} season`;
  }
  return `${cal.season} · Year ${cal.year} · Day ${cal.day}`;
}
/* the top-bar day/night toggle: promoted out of the Layers overlay menu, it
   flips game.layerVis.night (which relights the world and switches lighting on).
   Shows the current state — sun by day, moon by night. */
function updateDayNightBtn(){
  const b=document.getElementById('btnDayNight'); if (!b) return;
  const night=!!game.layerVis.night;
  b.textContent=night?'☾':'☀';
  b.classList.toggle('on',night);
  b.title=night?'Switch to day':'Switch to night (preview lighting)';
}
function updateHUD(){
  const cal=calClock();
  document.getElementById('seasonName').textContent=cal.season;
  document.getElementById('seasonYear').textContent=`Year ${cal.year}`;
  document.getElementById('seasonDay').textContent=`Day ${cal.day}`;
  // Design is a planner: real days are meaningless (a day is 20s), so show the
  // season + how far through it instead of a Year/Day count. Story keeps the
  // life-sim calendar. The internal clock is unchanged either way.
  const design=game.gameMode==='design';
  const seasonFrac=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
  const phase=seasonFrac<0.34?'Early season':seasonFrac<0.67?'Mid-season':'Late season';
  document.getElementById('seasonPhase').textContent=phase;
  document.getElementById('seasonClkCal').style.display=design?'none':'';
  document.getElementById('seasonPhase').style.display=design?'':'none';
  // the season box fills across the whole season, tinted by the season colour
  const fill=document.getElementById('seasonFill');
  if (fill){
    const w=Math.round(seasonFrac*1000)/10;
    if (w!==game._fillW){ fill.style.width=w+'%'; game._fillW=w; }
    const fillBg=game.pausedAt ? '#8c867c' : (SEASON_FILL[cal.season]||'#7fc24e');
    if (fillBg!==game._fillBg){ fill.style.background=fillBg; game._fillBg=fillBg; }
  }
  updateDayNightBtn();
  setHint(game.tool==='house'
    ? 'Hover shows where the house lands — click to set it down'
    : game.tool==='hand'
    ? 'Hand: drag the map to pan'
    : game.tool==='shovel'
    ? `Erase (${game.eraseMode==='all'?'everything':game.eraseMode+' only'}, ${game.eraseSize}×${game.eraseSize}) — tap or drag`
    : game.tool==='water'
    ? 'Drag to paint ponds, rivers, and lakes'
    : game.tool==='fence'
    ? `Drag to draw ${fenceLabel().toLowerCase()} runs`
    : game.tool==='light'
    ? `Drag to place ${lightLabel().toLowerCase()}`
    : game.tool==='firepit'
    ? `Tap clear ground to place a ${firepitLabel().toLowerCase()}`
    : ENABLE_HOUSE_SLEEP && isDoor(Math.round(game.px),Math.round(game.py))
    ? 'At the door — press E or tap here to sleep'
    : 'Tap a tile to walk · drag selected plants or tools to place them — or WASD + E');
  setActButton();
  const sd=absDay();
  if (sd!==game.lastDay){
    if (game.lastDay>=0 && sd%DAYS_PER_SEASON===0)
      toast(cal.season==='Spring'
        ? 'Spring. Last year is cut back — everything starts small and grows again.'
        : `${cal.season} begins. Watch the garden change.`);
    game.lastDay=sd;
    if (game.mode==='solo'&&hasStorage){ saveSolo(true); game.dirty=false; }
  }
}

/* ---------- screens ---------- */
const $=id=>document.getElementById(id);
function show(id){ ['menuScreen','multiScreen','creatorScreen','codeScreen','plotScreen','worldsScreen','designScreen','libraryScreen','dailyScreen'].forEach(s=>
  $(s).classList.toggle('hidden',s!==id));
  if (id==='menuScreen'){ game.challenge=null; game.visiting=false; advanceMenuSeason(); refreshMenuCards(); }
}
function closeOverlay(id){ $(id).classList.add('hidden'); }
function suspendClock(){
  if (!game.mode || game.pausedAt || game.clockSuspended) return;
  game.elapsedMs=elapsedGameMs();
  game.clockSuspended=true;
  game.startTs=Date.now();
}
function resumeClockSession(){
  if (!game.mode || !game.clockSuspended) return;
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function pauseClock(){
  if (!game.mode || game.pausedAt) return;
  game.elapsedMs=elapsedGameMs();
  game.pausedAt=Date.now();
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function resumeClock(){
  if (!game.pausedAt) return;
  game.pausedAt=0;
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function nextSeasonName(){
  const cal=calClock();
  return SEASONS[(SEASONS.indexOf(cal.season)+1)%SEASONS.length];
}
function openPause(){
  const ps=$('pauseScreen');
  $('pauseMeta').textContent=clockMeta();
  $('btnPauseResume').textContent=game.pausedAt?'Resume':'Pause day';
  ps.classList.remove('hidden');
  // drop the panel down under the season box, left-aligned to it
  const box=$('btnSeasonBox'), p=ps.querySelector('.panel');
  if (box && p){ const r=box.getBoundingClientRect();
    p.style.top=(r.bottom+6)+'px';
    p.style.left=Math.max(8,Math.round(r.left))+'px'; }
}
function closePause(){
  $('confirmSeasonScreen').classList.add('hidden');
  $('pauseScreen').classList.add('hidden');
}
function toggleClock(){
  if (game.pausedAt){ resumeClock(); toast('Day started.'); }
  else { pauseClock(); toast('Day paused.'); }
  updateHUD();
}
function closeSeasonConfirm(){ $('confirmSeasonScreen').classList.add('hidden'); }
function skipToAbsDay(targetDay){
  const d=absDay();
  if (targetDay<=d) return;
  game.dayOffset += targetDay-d;
  game.dirty=true;
  if (game.mode==='solo'&&hasStorage) saveSolo(true);
}
function openSeasonConfirm(){
  $('confirmSeasonTitle').textContent=`Skip to ${nextSeasonName()}?`;
  $('confirmSeasonScreen').classList.remove('hidden');
}
function confirmSkipSeason(){
  const d=absDay();
  skipToAbsDay((Math.floor(d/DAYS_PER_SEASON)+1)*DAYS_PER_SEASON);
  closeSeasonConfirm();
  const cal=calClock();
  $('pauseMeta').textContent=clockMeta();
  toast(`${cal.season} begins.`);
}
function skipNextYear(){
  const d=absDay(), yearLen=DAYS_PER_SEASON*SEASONS.length;
  skipToAbsDay((Math.floor(d/yearLen)+1)*yearLen);
  const cal=calClock();
  $('pauseMeta').textContent=clockMeta();
  toast(`Year ${cal.year} begins.`);
}

/* ---------- plant library: browse every species ---------- */
const LIB_CATS=[
  {label:'Grasses & Sedges', types:['grass','sedge']},
  {label:'Perennials',       types:['forb']},
  {label:'Bulbs',            types:['bulb']},
  {label:'Water Plants',     types:['water']},
  {label:'Shrubs',           types:['shrub']},
  {label:'Trees',            types:['tree']},
];
function libSeed(key){ let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0; return h||7; }
function libCanvas(key,variant,season,w,h){
  const c=document.createElement('canvas'); c.width=w*2; c.height=h*2;
  c.style.width=w+'px'; c.style.height=h+'px';
  const ctx=c.getContext('2d'); ctx.scale(2,2);
  const P=plantDef(key,variant), drawH=(P.h||40)*1.3+12, sc=Math.min(1.15,h/drawH);
  ctx.save(); ctx.translate(w/2,h-5); ctx.scale(sc,sc);
  drawPlant(ctx,0,0,key,1,season,libSeed(key),0,variant,1);
  ctx.restore();
  return c;
}
/* a real photo for the species, if one has been added to photos/.
   Tries .jpg → .jpeg → .png, then quietly removes itself (renders
   below remain the fallback). Drop a file at photos/<key>.jpg. */
function plantPhoto(key){
  const wrap=document.createElement('div'); wrap.className='ld-photo';
  const img=document.createElement('img'); img.alt='';
  const exts=['jpg','jpeg','png']; let i=0;
  img.onerror=()=>{ i++; if (i<exts.length) img.src=`photos/${key}.${exts[i]}`; else wrap.remove(); };
  img.onload=()=>{ wrap.classList.add('has'); };
  img.src=`photos/${key}.${exts[0]}`;
  wrap.appendChild(img);
  return wrap;
}
let libSel=null;
function openLibrary(){ buildLibraryList(''); show('libraryScreen');
  if (!libSel) showLibraryDetail(PLANT_KEYS[0]);
  applyLibrarySearch(); }
function buildLibraryList(q){
  const list=$('libraryList'); list.innerHTML='';
  LIB_CATS.forEach(cat=>{
    const keys=PLANT_KEYS.filter(k=>cat.types.includes(PLANTS[k].type));
    if (!keys.length) return;
    const head=document.createElement('div'); head.className='lib-cat'; head.textContent=cat.label;
    head.dataset.cat='1'; list.appendChild(head);
    keys.forEach(k=>{
      const P=PLANTS[k];
      const b=document.createElement('button'); b.className='lib-item'+(libSel===k?' sel':''); b.dataset.k=k;
      const cvHay=(P.libraryCultivars||[]).map(c=>(c.name||'')+' '+(c.size||'')+' '+(c.note||'')).join(' ');
      b.dataset.hay=(P.name+' '+P.latin+' '+roleSummary(k,12)+' '+cvHay).toLowerCase();
      b.append(libCanvas(k,null,'Summer',30,36));
      const t=document.createElement('span');
      t.innerHTML=`${P.name}<span class="li-latin">${P.latin}</span>`;
      b.append(t);
      b.onclick=()=>showLibraryDetail(k);
      list.appendChild(b);
    });
  });
}
function showLibraryDetail(key){
  libSel=key;
  document.querySelectorAll('.lib-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===key));
  const P=PLANTS[key], d=$('libraryDetail');
  const dim=v=>v>=96?`${Math.round(v/12)} ft`:`${v}"`;
  const seasons=['Spring','Summer','Fall','Winter'];
  const imgs=document.createElement('div'); imgs.className='ld-img';
  seasons.forEach(s=>{ const fig=document.createElement('figure');
    fig.append(libCanvas(key,null,s,80,104));
    const cap=document.createElement('figcaption'); cap.textContent=s; fig.append(cap);
    imgs.append(fig); });
  const facts=[
    ['Type', P.type[0].toUpperCase()+P.type.slice(1)],
    ['Mature size', `${dim(P.spread)} wide`+(P.grow?` · ~${P.grow} yrs`:'')],
    ['Spacing', `${dim(P.space)} on center`],
    ['Hardiness', `USDA zones ${P.zones[0]}–${P.zones[1]}`],
    ['Light', P.sun==='full'?'Full sun':'Part shade'],
    ['Soil', P.moist[0].toUpperCase()+P.moist.slice(1)+' moisture'],
    ['Origin', P.native?('Native — '+(P.eco.join(', ')||'central US')):'Garden plant (non-native)'],
    ['Roles', roleSummary(key)],
  ];
  const cvKeys=Object.keys(P.cv||{}), libraryCultivars=P.libraryCultivars||[];
  d.innerHTML='';
  const card=document.createElement('div'); card.className='ld-card';
  card.append(plantPhoto(key));   // real photo if photos/<key>.jpg exists, else nothing
  card.append(imgs);
  const nm=document.createElement('div'); nm.className='ld-name'; nm.textContent=P.name; card.append(nm);
  const la=document.createElement('div'); la.className='ld-latin'; la.textContent=P.latin; card.append(la);
  const bl=document.createElement('p'); bl.className='ld-blurb'; bl.textContent=P.blurb; card.append(bl);
  const dl=document.createElement('dl'); dl.className='ld-facts';
  facts.forEach(([k,v])=>{ const dt=document.createElement('dt'); dt.textContent=k;
    const dd=document.createElement('dd'); dd.textContent=v; dl.append(dt,dd); });
  card.append(dl);
  if (cvKeys.length || libraryCultivars.length){
    const cvs=document.createElement('div'); cvs.className='ld-cvs';
    const n=cvKeys.length+libraryCultivars.length;
    const h4=document.createElement('h4'); h4.textContent=`${n} cultivar${n>1?'s':''}`;
    cvs.append(h4);
    cvKeys.forEach(v=>{ const row=document.createElement('div'); row.className='ld-cv';
      row.innerHTML=`<b>${P.cv[v].name}</b> — ${P.cv[v].note||''}`; cvs.append(row); });
    libraryCultivars.forEach(c=>{ const row=document.createElement('div'); row.className='ld-cv';
      const size=c.size ? ` <span>${c.size}</span>` : '';
      row.innerHTML=`<b>${c.name}</b>${size} - ${c.note||''}`; cvs.append(row); });
    card.append(cvs);
  }
  d.append(card); d.scrollTop=0;
}
function applyLibrarySearch(){
  const q=($('librarySearch').value||'').toLowerCase().trim();
  document.querySelectorAll('.lib-item').forEach(b=>{
    b.style.display=(!q||b.dataset.hay.includes(q))?'':'none'; });
  document.querySelectorAll('.lib-cat').forEach(h=>{
    let n=h.nextElementSibling, any=false;
    while(n && !n.dataset.cat){ if(n.style.display!=='none') any=true; n=n.nextElementSibling; }
    h.style.display=any?'':'none'; });
}

