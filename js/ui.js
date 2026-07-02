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

/* ---------- HUD readouts (hint, mobile action button, top/bottom bars) ---------- */
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
  else if (game.tool==='shovel') label=game.brushSize>1?`Erase ${game.brushSize}-wide`:'Erase here';
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
function updatePreviewToggle(){
  const wrap=document.getElementById('previewToggle'); if (!wrap) return;
  const show=game.gameMode==='design';
  wrap.classList.toggle('hidden',!show);
  if (!show) return;
  const today=document.getElementById('btnPreviewToday');
  const est=document.getElementById('btnPreviewEstablished');
  if (today) today.classList.toggle('on',game.previewMode!=='established');
  if (est) est.classList.toggle('on',game.previewMode==='established');
  const note=document.getElementById('previewModeNote');
  if (note) note.textContent=game.previewMode==='established'
    ? 'Shows the mature design without advancing garden time.'
    : 'Shows current growth, bloom timing, and establishment.';
}
function setPreviewMode(mode){
  mode = mode==='established' ? 'established' : 'today';
  if (game.previewMode===mode){ updatePreviewToggle(); return; }
  game.previewMode=mode;
  game.dirty=true;
  updatePreviewToggle();
  if (game.mode==='solo'&&hasStorage) saveSolo(true);
  toast(mode==='established'?'Previewing established plants.':'Previewing today.');
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
  updatePreviewToggle();
  setHint(game.tool==='house'
    ? 'Hover shows where the house lands — click to set it down'
    : game.tool==='hand'
    ? 'Hand: drag the map to pan'
    : game.tool==='shovel'
    ? `Erase (${game.eraseMode==='all'?'everything':game.eraseMode+' only'}, ${game.brushSize}-wide) — tap or drag`
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
  updatePreviewToggle();
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

