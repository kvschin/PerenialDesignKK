'use strict';
const SVG_NS='http://www.w3.org/2000/svg';
function uiIcon(name,className){
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('class','ui-icon'+(className?' '+className:''));
  svg.setAttribute('aria-hidden','true');
  const use=document.createElementNS(SVG_NS,'use');
  use.setAttribute('href',`#ui-${name}`);
  svg.appendChild(use);
  return svg;
}
function setUiIcon(el,name){ if (el) el.replaceChildren(uiIcon(name)); }

const TIME_COACH_KEY='hortus:coach:time-v1';
function dismissCoachTip(){
  const tip=document.getElementById('coachTip'); if (!tip) return;
  tip.classList.add('hidden'); clearTimeout(tip._timer);
}
/* `action` makes the tip itself tappable — a tip that names a thing the
   gardener has never found should be able to take them there, rather than
   asking them to go hunting through a menu from memory. */
function showCoachTip(text,key,action){
  const tip=document.getElementById('coachTip'), txt=document.getElementById('coachTipText');
  if (!tip||!txt||!text) return;
  const storeKey=key?`hortus:coach:${key}-v1`:null;
  const seenAttr=key?`data-coach-${String(key).toLowerCase().replace(/[^a-z0-9-]/g,'-')}`:null;
  try{ if (storeKey&&localStorage.getItem(storeKey)) return; if (storeKey) localStorage.setItem(storeKey,'1'); }
  catch(_){ if (seenAttr&&tip.hasAttribute(seenAttr)) return; }
  if (seenAttr) tip.setAttribute(seenAttr,'1'); txt.textContent=text; tip.classList.remove('hidden');
  tip._action=action||null;
  tip.classList.toggle('actionable',!!action);
  clearTimeout(tip._timer); tip._timer=setTimeout(dismissCoachTip,7500);
}
/* Wired once. The close button lives inside the tip, so it has to be excluded
   or dismissing would also fire the action. */
(function wireCoachTipAction(){
  const tip=document.getElementById('coachTip'); if (!tip) return;
  tip.addEventListener('click',e=>{
    if (e.target.closest('#coachTipClose')) return;
    const act=tip._action; if (!act) return;
    dismissCoachTip(); tip._action=null;
    try{ act(); }catch(err){ if (typeof noteError==='function') noteError(err,'coach-action'); }
  });
})();
function showTimeCoachTip(){
  const tip=document.getElementById('coachTip'), txt=document.getElementById('coachTipText');
  if (!tip || !txt || !game.inGarden) return;
  try{ if (localStorage.getItem(TIME_COACH_KEY)) return;
    localStorage.setItem(TIME_COACH_KEY,'1'); }catch(_){ if (tip.dataset.shown) return; }
  tip.dataset.shown='1';
  const touch=typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches;
  /* Leads with the payoff rather than the control. This used to fire 900ms
     after entering a garden, where "hold to fast-forward" named a button
     attached to nothing the gardener cared about yet; it is now the third coach
     beat and waits until there is a planting worth watching change. */
  txt.textContent=touch
    ? 'Hold the season box to run the year — your planting will bloom, seed and stand through winter. Pinch to zoom.'
    : 'Hold the season box to run the year — your planting will bloom, seed and stand through winter.';
  tip.classList.remove('hidden');
  clearTimeout(tip._timer); tip._timer=setTimeout(dismissCoachTip,7500);
}

/* ---------- the three coach beats ----------
   Onboarding is three tips fired by DOING, not a tour with a step counter: name
   the core loop on arrival, name the gesture that makes it feel like this app
   once one plant is in, and only then point at the season box — which is the
   whole pitch, and meaningless before there is a planting to watch.

   Each beat is one-shot forever via showCoachTip's own localStorage key. On top
   of that they are ARMED only for a device that saw the first-run offer, so a
   gardener who has been using this for months is not told how to plant. The
   arming is deliberately not "has no gardens": someone who declines the demo
   and starts from scratch is still new and still wants the beats. */
const COACH_ARMED_KEY='hortus:coach:armed';
/* Storage can be unavailable (private mode, blocked cookies) — a real iOS
   cohort. The session fallback keeps the beats working there instead of
   silently disabling onboarding for exactly the users least likely to have
   seen the app before. It also has to match welcomeSeen()'s degraded
   behaviour, or a device gets the first-run prompt and then no beats at all. */
let coachArmedSession=false;
function armCoach(){
  coachArmedSession=true;
  try{ localStorage.setItem(COACH_ARMED_KEY,'1'); }catch(_){ }
}
function coachArmed(){
  if (coachArmedSession) return true;
  try{ return localStorage.getItem(COACH_ARMED_KEY)==='1'; }catch(_){ return false; }
}
const COACH_DRIFT_AT=1, COACH_TIME_AT=5, COACH_LIST_AT=15;
/* A garden that arrives already planted — the demo, or a shared file — is
   something to look at before it is something to edit. */
const COACH_READY_GARDEN=20, COACH_LOOK_MS=45000;
let coachPlanted=0, coachLookTimer=null;

function livePlantCount(){
  let n=0; for (const k in game.plants){ const p=game.plants[k]; if (p && !p.removed) n++; }
  return n;
}
function coachBeatEnter(){
  clearTimeout(coachLookTimer); coachLookTimer=null;
  if (!coachArmed()) return;
  if (livePlantCount()>=COACH_READY_GARDEN){
    /* Beat 1 used to tell someone who had just opened a finished 323-plant
       garden to "pick a plant and tap the ground" — i.e. to deface the example
       they were given to admire. Orient them instead, and let the season beat
       arrive on its own once they have had a look. */
    showCoachTip('This planting is already done — have a look around. Anything here can be moved, replaced or added to.','ready-garden');
    /* And beat 3 is keyed to PLANTING, so a gardener who opens the demo purely
       to look would never meet the seasonal loop — the one thing this app does
       that nothing else does. Time gets them there instead. */
    coachLookTimer=setTimeout(()=>{ coachLookTimer=null; showTimeCoachTip(); }, COACH_LOOK_MS);
  } else {
    showCoachTip('Pick a plant from the library, then tap the ground to plant it.','first-plant');
  }
}
/* Called once per successfully placed plant or bulb, from plantFx — the one
   choke point every route funnels through (tap, drag, drift, fill, matrix), and
   one that undo and loading a garden deliberately do not touch. */
function coachNotePlanting(){
  if (!coachArmed()) return;
  const was=coachPlanted; coachPlanted++;
  if (was<COACH_DRIFT_AT && coachPlanted>=COACH_DRIFT_AT)
    showCoachTip('Drag across the ground to plant several at once. The Drift chip scatters them naturally.','plant-drag');
  else if (was<COACH_TIME_AT && coachPlanted>=COACH_TIME_AT)
    showTimeCoachTip();
  else if (was<COACH_LIST_AT && coachPlanted>=COACH_LIST_AT)
    /* The planting list is the thing this app is worth money for — it turns a
       drawing into a nursery order with real quantities — and nothing anywhere
       told anyone it existed. Tapping the tip opens it, because a tip naming a
       buried menu row and then leaving is barely better than silence. */
    showCoachTip('Your planting list turns this into a nursery order with real quantities. Tap to see it.',
      'planting-list', ()=>{ if (typeof openExport==='function') openExport(); });
}
function syncHapticsButton(){
  const b=document.getElementById('btnHaptics'); if (!b) return;
  const supported=supportsHaptics();
  b.classList.toggle('hidden',!supported);
  if (!supported) return;
  b.textContent=`Haptic feedback · ${hapticsOn?'On':'Off'}`;
  b.setAttribute('aria-pressed',hapticsOn?'true':'false');
}
function syncHandednessButton(){
  const b=document.getElementById('btnHandedness'); if (!b) return;
  b.textContent=`Left-handed layout · ${leftHandedLayout?'On':'Off'}`;
  b.setAttribute('aria-pressed',leftHandedLayout?'true':'false');
  b.title='Moves the mobile canvas tool rail to the right edge';
}
/* Cycles Auto -> Light -> Dark. Auto shows what it resolved to, so the label
   always answers "what am I looking at" as well as "what did I pick". */
function syncThemeButton(){
  const b=document.getElementById('btnTheme'); if (!b) return;
  b.textContent=`Appearance · ${themeLabel()}`;
  b.title='Switches the interface between light and dark. The garden keeps its own seasonal colours.';
}
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
  squirrelOk:'Squirrel-resistant bulb',
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
  'late','deerOk','rabbitOk','squirrelOk'
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
  'coreopsis','burnet','blueeyedgrass','boxwood','rudbeckia','camassia','lilac',
]);
const BROWSE_RESIST_KEYS=new Set([
  // toxic or bitter forbs
  'helenium','culvers','penstemon','largebeardtongue','columbine','wildgeranium',
  'bluebells','heuchera','astilbe','solomonsseal','shootingstar',
  'greatstjohnswort','filipendula','goldenrod','joepye','gaura','poppymallow',
  'pasqueflower','prairiesmoke','goldenalexander','heartleafalexander',
  // resistant minor bulbs (toxic alkaloids or onion scent)
  'daffodil','snowdrop','winteraconite','fritillaria','colchicum','lycoris',
  'muscari','scillaperuviana','puschkinia','ipheion','leucojum','anemoneblanda',
  // tough shrubs — berried natives and the resistant viburnums, listed by key
  // rather than by group because doublefile shares group:'viburnum' and is browsed
  'sumac','coralberry','smokebush','winterberry','inkberry','chokeberry',
  'arrowwood','cranberrybush','koreanspice','blackhaw',
]);
const SQUIRREL_RESIST_GROUPS=new Set(['allium','alliumbulb']);
const SQUIRREL_RESIST_KEYS=new Set([
  'daffodil','snowdrop','winteraconite','fritillaria','colchicum','lycoris',
  'muscari','leucojum','scillaperuviana','puschkinia','ipheion'
]);
// readily browsed despite a broad cue (hosta, tulips, crocus, sedum, lilies,
// New Jersey tea, doublefile viburnum, ninebark, red-twig dogwood, both
// spireas) — left off the resistant list on purpose.
function staticPlantRoles(k){
  if (ROLE_CACHE[k]) return ROLE_CACHE[k];
  const P=PLANTS[k]; if (!P) return [];
  const roles=new Set(P.roles||[]);
  const text=`${P.name} ${P.latin} ${P.group||''} ${P.form||''}`.toLowerCase();
  const group=P.group||'';
  roles.add(P.type);
  if (P.sun==='part') roles.add('shade'), roles.add('woodland');
  if (P.moist==='dry') roles.add('dry');
  if (P.moist==='moist') roles.add('wet');
  if (hasSeasonProp(P,'bloom')) roles.add('flower'), roles.add('pollinator'), roles.add('seasonal');
  if (hasSeasonProp(P,'seed')) roles.add('winter'), roles.add('seedhead');
  if (P.type==='grass') roles.add('matrix'), roles.add('movement'), roles.add('wind');
  if (P.type==='sedge') roles.add('matrix'), roles.add('groundcover'), roles.add('woodland');
  if (P.type==='bulb') roles.add('bulbLayer'), roles.add('early'), roles.add('seasonal');
  if (P.type==='water') roles.add('wet'), roles.add('water'), roles.add('naturalistic');
  if (isShrubDef(P)) roles.add('structure');
  if (isTreeDef(P)) roles.add('structure'), roles.add('canopy');
  if (P.form==='fern') roles.add('fern'), roles.add('shade'), roles.add('woodland');
  if (P.form==='leafmound') roles.add('groundcover'), roles.add('shade'), roles.add('woodland');
  if (['globe','spike','drumstick','rosette','agave','ocotillo','vertgrass','fountaingrass','cloudgrass','conifer'].includes(P.form))
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
  if (!isTreeDef(P) && (
        roles.has('grass') || roles.has('sedge') || roles.has('fern') ||
        roles.has('aromatic') || roles.has('silver') ||
        BROWSE_RESIST_GROUPS.has(group) || BROWSE_RESIST_KEYS.has(k))){
    roles.add('deerOk'); roles.add('rabbitOk');
  }
  if (P.type==='bulb' && (SQUIRREL_RESIST_GROUPS.has(group) || SQUIRREL_RESIST_KEYS.has(k)))
    roles.add('squirrelOk');
  return ROLE_CACHE[k]=[...roles].sort();
}
function plantRoles(k,criteria,v){
  const P=plantDef(k,v||null); if (!P) return [];
  const roles=new Set(staticPlantRoles(k));
  const source=criteria || (typeof game!=='undefined'&&game.filters) || {};
  const relation=nativeRelation(P,normalizeFilters(source).nativeRegion);
  if (relation.regional){
    roles.add('native'); roles.add('naturalistic');
    if (['grass','sedge','forb','bulb','water'].includes(P.type)) roles.add('prairie');
  }
  return [...roles].sort();
}
function roleLabel(role){ return ROLE_LABELS[role] || cap(role); }
function roleSummary(k,max=6,v=null,criteria=null){
  const roles=plantRoles(k,criteria,v).filter(r=>ROLE_LABELS[r]);
  roles.sort((a,b)=>{
    const ai=ROLE_DISPLAY_ORDER.indexOf(a), bi=ROLE_DISPLAY_ORDER.indexOf(b);
    return (ai<0?999:ai)-(bi<0?999:bi) || roleLabel(a).localeCompare(roleLabel(b));
  });
  return roles.slice(0,max).map(roleLabel).join(', ');
}
function activeDesignType(){
  const d=game.design && game.design.type;
  return (d && STYLE_ROLE_WEIGHTS[d]) ? d : null;
}
function designTypeName(type){ return DESIGN_STYLE_LABELS[type] || cap(type||'design'); }
function plantStyleScore(k,type=activeDesignType(),v=null,criteria=null){
  const weights=STYLE_ROLE_WEIGHTS[type]; if (!weights) return 0;
  return plantRoles(k,criteria,v).reduce((n,r)=>n+(weights[r]||0),0);
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
/* ---------- plant filters ----------
   A plant fits if it survives the chosen zone and passes the optional
   native / browse-resistance gates. Squirrel resistance is bulb-focused:
   squirrels mostly affect planted bulbs, not established perennials. */
function normalizeFilters(src){
  src=src||{};
  const nativeMode=NATIVE_MODE_IDS.has(src.nativeMode)
    ? src.nativeMode
    : (src.nativesOnly?'straight':'any');
  return {
    zone:src.zone?+src.zone:null,
    nativeRegion:normalizeNativeRegion(src.nativeRegion),
    nativeMode,
    deer:!!src.deer,
    rabbit:!!src.rabbit,
    squirrel:!!src.squirrel
  };
}
function normalizeDesign(src){
  if (!src || typeof src!=='object') return null;
  const f=normalizeFilters(src);
  return {zone:f.zone,type:typeof src.type==='string'?src.type:'any',
    nativeRegion:f.nativeRegion,nativeMode:f.nativeMode,
    deer:f.deer,rabbit:f.rabbit,squirrel:f.squirrel};
}
function activeFilters(){ return normalizeFilters(game.filters); }

/* ---------- plant discovery ----------
   Garden criteria decide eligibility.  Discovery is a separate, reversible
   lens over that eligible catalog: palette source, query, flower color, and
   bloom timing.  Keeping the predicates here makes every tray entry point
   (categories, Find, Favorites, and saved palettes) agree. */
const DISCOVERY_COLOR_FAMILIES=[
  ['pink','Pink','#d77c9e'], ['purple','Purple','#9470c9'], ['blue','Blue','#6f93cb'],
  ['white','White','#eee9df'], ['yellow','Yellow','#e1bb42'], ['orange','Orange','#d98642'], ['red','Red','#c9554d']
];
const DISCOVERY_SEASONS=[['Spring',[3,4,5]],['Summer',[6,7,8]],['Fall',[9,10,11]]];
function defaultDiscovery(){ return {source:'recommended',collectionId:null,category:null,returnCategory:null,query:'',colorFamilies:[],bloomSeasons:[],limit:36,filterOpen:false}; }
function normalizeDiscovery(src){
  src=src||{};
  const source=['recommended','all','favorites','palette'].includes(src.source) ? src.source : 'recommended';
  const colors=(src.colorFamilies||[]).filter(c=>DISCOVERY_COLOR_FAMILIES.some(x=>x[0]===c));
  const seasons=(src.bloomSeasons||[]).filter(s=>DISCOVERY_SEASONS.some(x=>x[0]===s));
  let category=TRAY_CATS.some(c=>c.id===src.category && c.types) ? src.category : null;
  let returnCategory=TRAY_CATS.some(c=>c.id===src.returnCategory && c.types) ? src.returnCategory : null;
  const query=String(src.query||'').slice(0,120);
  // Older saves could retain a concrete category beside a non-empty query.
  // Migrate that category into the return slot so Find becomes global without
  // forgetting where clearing the query should go back to.
  if (query.trim() && category && !returnCategory){ returnCategory=category; category=null; }
  return {source,collectionId:source==='palette' && src.collectionId ? String(src.collectionId) : null,category,returnCategory,
    query,colorFamilies:[...new Set(colors)],bloomSeasons:[...new Set(seasons)],
    limit:Math.max(24,Math.min(240,Number(src.limit)||36)),filterOpen:!!src.filterOpen};
}
function activeDiscovery(){
  const d=normalizeDiscovery(game.discovery); game.discovery=d; return d;
}
function setDiscovery(patch,save){
  game.discovery=normalizeDiscovery(Object.assign({},activeDiscovery(),patch||{}));
  if (save && game.inGarden && typeof saveSolo==='function') saveSolo(true);
  return game.discovery;
}
function plantRef(s,v){ return canonicalPlantRef(s,v); }
function refDef(ref){
  if (!ref) return null;
  ref=canonicalPlantRef(ref.s,ref.v);
  if (!PLANTS[ref.s]) return null;
  // `plantDef` intentionally falls back to a species for ordinary renderer
  // callers. Discovery must be stricter: a saved retired cultivar is not its
  // parent species, and must never appear selectable as that parent by mistake.
  if (ref.v && !(PLANTS[ref.s].cv && PLANTS[ref.s].cv[ref.v])) return null;
  return plantDef(ref.s,ref.v||null);
}
function plantRefDisplayName(ref){ const P=refDef(ref); return P ? P.name : 'Retired plant'; }
function bloomSeasonForMonth(m){ return m>=3&&m<=5?'Spring':m>=6&&m<=8?'Summer':m>=9&&m<=11?'Fall':'Winter'; }
function bloomMonthsInSeason(P,season){ return bloomMonthsFor(P).filter(m=>bloomSeasonForMonth(m)===season); }
function hexHsl(hex){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||'')); if (!m) return null;
  const n=parseInt(m[1],16), r=((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
  const hi=Math.max(r,g,b), lo=Math.min(r,g,b), d=hi-lo, l=(hi+lo)/2;
  if (!d) return {h:0,s:0,l};
  const s=d/(1-Math.abs(2*l-1));
  let h=hi===r?((g-b)/d)%6:hi===g?(b-r)/d+2:(r-g)/d+4; h=(h*60+360)%360;
  return {h,s,l};
}
function colorFamilyFromHex(hex){
  const hsl=hexHsl(hex); if (!hsl) return null;
  const {h,s,l}=hsl;
  if (s<0.18 && l>0.72) return 'white';
  if (s<0.22 || l<0.16) return null;
  if (h>=315&&h<350&&l>=0.42) return 'pink';
  if (h>=250&&h<315) return 'purple';
  if (h>=190&&h<250) return 'blue';
  if (h>=42&&h<72) return 'yellow';
  if (h>=18&&h<42) return 'orange';
  if (h<18||h>=350) return 'red';
  return null;
}
/* Catalog fields may later override the conservative hue mapping with
   `flowerColorFamilies:{Spring:['pink']}` on a species or cultivar. */
function flowerFamiliesFor(P,season){
  const declared=P&&P.flowerColorFamilies&&P.flowerColorFamilies[season];
  if (Array.isArray(declared)) return declared.filter(c=>DISCOVERY_COLOR_FAMILIES.some(x=>x[0]===c));
  // `bloomMonths` is authoritative for timing.  Do not fall back to planColor
  // here: foliage and seedheads are useful in a plan, but never prove a flower
  // is this color.  Cultivars arrive already resolved through plantDef().
  if (!bloomMonthsInSeason(P,season).length) return [];
  const hex=P&&P.sea&&P.sea[season]&&P.sea[season].bloom;
  const family=colorFamilyFromHex(hex);
  return family?[family]:[];
}
function bloomRangeText(P){
  const months=bloomMonthsFor(P); if (!months.length) return 'No bloom time recorded';
  const labels=CAL_MONTH_LABELS||['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const first=months[0], last=months[months.length-1];
  return first===last ? labels[first-1] : `${labels[first-1]}\u2013${labels[last-1]}`;
}
function plantRefFitsCriteria(ref,criteria){
  const P=refDef(ref), f=normalizeFilters(criteria); if (!P) return false;
  if (f.zone && (P.zones[0]>f.zone || P.zones[1]<f.zone)) return false;
  if (!passesNativeFilter(P,f)) return false;
  if (!challengeAllows(ref.s)) return false;
  const roles=plantRoles(ref.s);
  if (!isTreeDef(P)){
    if (f.deer && !roles.includes('deerOk')) return false;
    if (f.rabbit && !roles.includes('rabbitOk')) return false;
  }
  if (f.squirrel && P.type==='bulb' && !roles.includes('squirrelOk')) return false;
  return true;
}
function plantRefFits(ref){ return plantRefFitsCriteria(ref,activeFilters()) && challengeAllows(ref.s); }
function allPlantRefs(){
  const out=[];
  PLANT_KEYS.forEach(s=>{ const P=PLANTS[s]; if (!P||P.hidden) return;
    out.push(plantRef(s)); Object.keys(P.cv||{}).forEach(v=>out.push(plantRef(s,v))); });
  return out;
}
let discoverySearchIndex=null;
function discoverySearchText(ref){
  const P=refDef(ref); if (!P) return '';
  return [ref.s,ref.v||'',P.name,P.latin,(P.synonyms||[]).join(' '),PLANTS[ref.s].group||'',PLANTS[ref.s].chip||'',staticPlantRoles(ref.s).map(roleLabel).join(' '),trayCatLabel(plantCategoryFor(ref.s))]
    .join(' ').toLowerCase();
}
function ensureDiscoverySearchIndex(){
  if (discoverySearchIndex) return discoverySearchIndex;
  return discoverySearchIndex=allPlantRefs().map(ref=>({ref,hay:discoverySearchText(ref)}));
}
function discoverySourceRefs(d){
  if (d.source==='favorites' && typeof favoriteRefs==='function') return favoriteRefs();
  if (d.source==='palette' && typeof paletteRefs==='function') return paletteRefs(d.collectionId);
  return ensureDiscoverySearchIndex().map(x=>x.ref);
}
function discoveryMatches(ref,d){
  const P=refDef(ref); if (!P || !plantRefFits(ref)) return false;
  if (d.category){ const cat=TRAY_CATS.find(c=>c.id===d.category);
    if (!cat || !cat.types.includes(P.type) || (cat.sunFilter&&P.sun!==cat.sunFilter)) return false; }
  const q=(d.query||'').trim().toLowerCase();
  if (q && !discoverySearchText(ref).includes(q)) return false;
  const selectedSeasons=d.bloomSeasons.length ? d.bloomSeasons : DISCOVERY_SEASONS.map(x=>x[0]);
  const wantsColor=d.colorFamilies.length;
  if (!wantsColor && !d.bloomSeasons.length) return true;
  return selectedSeasons.some(season=>{
    if (!bloomMonthsInSeason(P,season).length) return false;
    const families=flowerFamiliesFor(P,season);
    return !wantsColor || families.some(c=>d.colorFamilies.includes(c));
  });
}
function discoveryRefsUncached(d){
  const seen=new Set();
  const refs=discoverySourceRefs(d).filter(ref=>{
    const id=typeof plantRefId==='function' ? plantRefId(ref) : `${ref.s}|${ref.v||''}`;
    if (seen.has(id)||!discoveryMatches(ref,d)) return false; seen.add(id); return true;
  });
  const design=activeDesignType();
  refs.sort((a,b)=>{
    if (d.source==='recommended' && design){ const score=plantStyleScore(b.s,design,b.v)-plantStyleScore(a.s,design,a.v); if (score) return score; }
    return plantRefDisplayName(a).localeCompare(plantRefDisplayName(b));
  });
  return refs;
}
/* ---------- per-rebuild memo (perf) ----------
   Filtering discovery is O(catalog) and ends in a locale-collated sort, and one
   tray rebuild ran it TWELVE times: once per category chip purely to print a
   count, plus three identical discoveryRefs() calls for the header, the filter
   row and the result list. Measured 6.2ms of a 21.5ms rebuild — 29% — and every
   millisecond of it was the same work repeated.

   The memo is deliberately scoped to ONE synchronous rebuild: buildToolTray
   opens it on entry and closes it on exit, so identical calls inside a rebuild
   are free and nothing survives to go stale afterwards. That sidesteps the
   whole invalidation surface a persistent cache would have — garden filters,
   favourites, palettes, the design style and the zone all feed this, and a
   catalog showing yesterday's plants is a worse bug than a slow one. */
let discoveryMemo=null, discoveryMemoDepth=0;   // depth-counted, so a nested rebuild cannot close it early
function openDiscoveryMemo(){ if (!discoveryMemoDepth++) discoveryMemo=new Map(); }
function closeDiscoveryMemo(){ if (discoveryMemoDepth>0 && !--discoveryMemoDepth) discoveryMemo=null; }
function discoveryMemoKey(d){
  return [d.source, d.collectionId||'', d.category||'', (d.query||'').trim().toLowerCase(),
    (d.colorFamilies||[]).join(','), (d.bloomSeasons||[]).join(',')].join('|');
}
function discoveryRefsFor(discovery){
  const d=normalizeDiscovery(discovery);
  if (!discoveryMemo) return discoveryRefsUncached(d);
  const k=discoveryMemoKey(d);
  let v=discoveryMemo.get(k);
  if (!v){ v=discoveryRefsUncached(d); discoveryMemo.set(k,v); }
  return v;
}
/* Every plant category's count from ONE pass instead of one pass each.
   Legitimate because the category test in discoveryMatches is independent of
   every other predicate AND of the sort, so filtering the uncategorised result
   by category is identical to re-running the whole filter per category — just
   without paying for eligibility, search and bloom matching eight more times.
   Counts are distinct presentation groups, matching the family cards. The
   expensive eligibility/search pass is still shared; only the cheap grouping
   step runs once per category bucket. */
function discoveryCategoryCounts(discovery){
  const d=normalizeDiscovery(discovery);
  const refs=discoveryRefsFor(Object.assign({},d,{category:null}));
  const cats=TRAY_CATS.filter(c=>TRAY_GROUPS[0].cats.includes(c.id));
  const buckets=new Map(cats.map(c=>[c.id,[]]));
  for (const ref of refs){
    const P=refDef(ref); if (!P) continue;
    for (const c of cats){
      if (!c.types.includes(P.type)) continue;
      if (c.sunFilter && P.sun!==c.sunFilter) continue;
      buckets.get(c.id).push(ref);
    }
  }
  const counts={};
  cats.forEach(c=>{ counts[c.id]=groupDiscoveryRefs(buckets.get(c.id)).length; });
  return {refs, all:groupDiscoveryRefs(refs).length, counts};
}
function discoveryRefs(){ return discoveryRefsFor(activeDiscovery()); }
/* Discovery remains exact-reference based for filtering, collections, and
   planting. Grouping is a presentation-only view model built after that
   pipeline, so a cultivar never loses its `{s,v}` identity. */
function groupDiscoveryRefs(refs){
  const groups=[], byPresentationGroup=new Map();
  (refs||[]).forEach(ref=>{
    if (!ref||!ref.s) return;
    const exact=plantRef(ref.s,ref.v||null), P=PLANTS[exact.s]; if (!P) return;
    const id=P.group ? `group:${P.group}` : `species:${exact.s}`;
    let group=byPresentationGroup.get(id);
    if (!group){
      group={id,domId:id.replace(/[^a-z0-9_-]+/gi,'-'),s:exact.s,label:P.groupLabel||P.name,
        refs:[],baseRefs:[],baseRef:null,cultivarRefs:[],crossSpecies:false};
      byPresentationGroup.set(id,group); groups.push(group);
    }
    group.refs.push(exact);
    if (exact.v) group.cultivarRefs.push(exact); else group.baseRefs.push(exact);
  });
  groups.forEach(group=>{
    group.baseRef=group.baseRefs[0]||null;
    group.representativeRef=group.baseRef||group.refs[0]||null;
    group.s=group.representativeRef?group.representativeRef.s:group.s;
    group.crossSpecies=new Set(group.refs.map(ref=>ref.s)).size>1;
  });
  return groups;
}
function discoveryCriteriaLabels(f=activeFilters()){
  const out=[];
  if (f.nativeMode!=='any') out.push(f.nativeMode==='straight'
    ? `Straight ${nativeRegionLabel(f.nativeRegion)} natives`
    : `${nativeRegionLabel(f.nativeRegion)} natives`);
  if (f.deer) out.push('Deer');
  if (f.rabbit) out.push('Rabbit');
  if (f.squirrel) out.push('Squirrel');
  return out;
}
function discoveryFilterCount(){ const d=activeDiscovery(); return d.colorFamilies.length+d.bloomSeasons.length+discoveryCriteriaLabels().length; }
function discoverySourceLabel(d=activeDiscovery()){
  if (d.source==='favorites') return 'Favorites';
  if (d.source==='palette' && typeof paletteById==='function'){ const p=paletteById(d.collectionId); return p?p.name:'Saved palette'; }
  return d.source==='all'?'All eligible':'Recommended';
}
function collectionAvailability(refs){ const total=(refs||[]).length, available=(refs||[]).filter(plantRefFits).length; return {total,available}; }
function plantFits(k){
  const P=PLANTS[k], f=activeFilters();
  if (f.zone && (P.zones[0]>f.zone || P.zones[1]<f.zone)) return false;
  if (!passesNativeFilter(P,f)) return false;
  if (!challengeAllows(k)) return false;                 // daily challenge limits the palette
  const roles=plantRoles(k);
  if (!isTreeDef(P)){
    if (f.deer && !roles.includes('deerOk')) return false;
    if (f.rabbit && !roles.includes('rabbitOk')) return false;
  }
  if (f.squirrel && P.type==='bulb' && !roles.includes('squirrelOk')) return false;
  return true;
}
/* How many species a hypothetical questionnaire selection leaves in the palette,
   computed without touching live game state - drives the live tally on the
   design-setup panel so each knob visibly does something. Mirrors plantFits'
   zone/native/deer/rabbit/squirrel gates. Style only ranks the tray, so it
   does not change this count. */
function paletteCount(sel){
  sel=normalizeFilters(sel);
  let n=0;
  for (const k of PLANT_KEYS){
    const P=PLANTS[k]; if (P.hidden) continue;
    if (sel.zone && (P.zones[0]>sel.zone || P.zones[1]<sel.zone)) continue;
    if (!passesNativeFilter(P,sel)) continue;
    const roles=plantRoles(k);
    if (!isTreeDef(P)){
      if (sel.deer && !roles.includes('deerOk')) continue;
      if (sel.rabbit && !roles.includes('rabbitOk')) continue;
    }
    if (sel.squirrel && P.type==='bulb' && !roles.includes('squirrelOk')) continue;
    n++;
  }
  return n;
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
// filter - so a daily challenge whose palette skips grasses (bulbs, ephemerals,
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
function openFilters(){
  // The shared Plant filters modal owns both eligibility and flower discovery.
  // `openDiscoveryFilters` lives in tray.js but is safe to call after startup.
  if (typeof openDiscoveryFilters==='function') openDiscoveryFilters();
}
function applyGardenCriteria(next,{refresh=true,announce=true}={}){
  game.filters=normalizeFilters(next);
  if (game.design){
    game.design.zone=game.filters.zone;
    game.design.nativeRegion=game.filters.nativeRegion;
    game.design.nativeMode=game.filters.nativeMode;
    delete game.design.nativesOnly;
    game.design.deer=game.filters.deer;
    game.design.rabbit=game.filters.rabbit;
    game.design.squirrel=game.filters.squirrel;
  }
  sSet('hortus:filters',game.filters);
  updateFilterBtn();
  if (refresh && game.inGarden) buildToolTray();
  const visibleKeys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const n=visibleKeys.filter(plantFits).length;
  if (announce) toast(`${n} of ${visibleKeys.length} species fit these filters.`);
  return n;
}
function applyFilters(){
  // Kept as a narrow programmatic entry point for callers outside the modal.
  return applyGardenCriteria(activeFilters());
}
function updateFilterBtn(){
  const f=activeFilters(), bits=[];
  if (f.zone) bits.push('z'+f.zone);
  if (f.nativeMode!=='any') bits.push((f.nativeMode==='straight'?'Straight':'Regional')+' · '+nativeRegionLabel(f.nativeRegion,true));
  if (f.deer) bits.push('Deer');
  if (f.rabbit) bits.push('Rabbit');
  if (f.squirrel) bits.push('Squirrel');
  $('filterLbl').textContent=bits.length?bits.join(' / '):'Any';
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
  let label=null;
  if (game.tool==='hand') label=null;
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
  else if (game.tool==='pet') label='Place pet';
  else if (game.tool==='building-edit') label=buildingEditMode()==='remove'?'Trim footprint'
    :buildingEditMode()==='rename'?'Name footprint':'Extend footprint';
  else if (game.tool==='building-edit') label=buildingEditMode()==='remove'?'Trim footprint'
    :buildingEditMode()==='rename'?'Name footprint':'Extend footprint';
  else if (game.tool==='house'||game.tool==='building') label=null; // site objects place by direct canvas tap
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
/* the time readout string. This is a planner — real days are meaningless (a
   garden day is 20s), so it shows the season and how far through it we are. */
/* the season box fill colour — Kevin's palette: easter green, dark green, the
   existing fall bronze, a darker winter blue. Spring is 5.5% deeper than the
   original #7fc24e: it is the lightest band, so in DARK theme it is the one
   that decides how far .season-fill's opacity can be pushed, and this is what
   buys the current .55 while the season name still clears WCAG AA (4.52:1).
   See the .season-fill note in styles.css before changing either. */
const SEASON_FILL = { Spring:'#78b74a', Summer:'#2f7d3a', Fall:'#c97f3f', Winter:'#3f6190' };
// game-ms added per real-ms while holding the season box (~2 garden days/sec)
const FF_RATE = 40;
function clockMeta(){
  const cal=calClock(), sf=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
  return `${cal.season} · ${sf<0.34?'early':sf<0.67?'mid':'late'} season`;
}
/* the top-bar day/night toggle: promoted out of the Layers overlay menu, it
   flips game.layerVis.night (which relights the world and switches lighting on).
   Shows the current state — sun by day, moon by night. */
function updateDayNightBtn(){
  const b=document.getElementById('btnDayNight'); if (!b) return;
  const night=!!game.layerVis.night;
  if (b._night===night) return;   // runs per frame — write only on change
  b._night=night;
  setUiIcon(b,night?'moon':'sun');
  b.classList.toggle('on',night);
  b.title=night?'Switch to day':'Switch to night (preview lighting)';
}
function updatePreviewToggle(){
  const wrap=document.getElementById('previewToggle'); if (!wrap) return;
  wrap.classList.remove('hidden');
  const today=document.getElementById('btnPreviewToday');
  const est=document.getElementById('btnPreviewEstablished');
  if (today) today.classList.toggle('on',game.previewMode!=='established');
  if (est) est.classList.toggle('on',game.previewMode==='established');
  const note=document.getElementById('previewModeNote');
  if (note && note._mode!==game.previewMode){   // per-frame: write only on change
    note._mode=game.previewMode;
    note.textContent=game.previewMode==='established'
      ? 'Shows the mature design — full sizes, tree canopies, and shade — without advancing garden time.'
      : 'Shows current growth, bloom timing, and establishment.';
  }
}
function setPreviewMode(mode){
  mode = mode==='established' ? 'established' : 'today';
  if (game.previewMode===mode){ updatePreviewToggle(); return; }
  game.previewMode=mode;
  game.dirty=true;
  updatePreviewToggle();
  if (game.inGarden&&hasStorage) saveSolo(true);
  toast(mode==='established'?'Previewing established plants.':'Previewing today.');
}
// updateHUD runs every rendered frame; assigning textContent replaces the text
// node even when the string is identical (a real DOM mutation + style recalc
// 60x/s), so every write here is guarded by a last-written cache on the
// element — the same pattern the season fill below has always used.
function hudText(id,txt){ const el=document.getElementById(id);
  if (el && el._t!==txt){ el._t=txt; el.textContent=txt; } }
function updateHUD(){
  const cal=calClock();
  hudText('seasonName',cal.season);
  // A planner: real days are meaningless (a day is 20s), so the readout shows
  // the season + how far through it. The internal clock is unchanged.
  const seasonFrac=((cal.day-1)+cal.frac)/DAYS_PER_SEASON;
  const phase=seasonFrac<0.34?'Early season':seasonFrac<0.67?'Mid-season':'Late season';
  hudText('seasonPhase',phase);
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
  setHint(game.tool==='building'
    ? 'Tap exterior corners, then tap the first corner or Close to finish'
    : game.tool==='house'
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
    : game.tool==='building-edit'
    ? (buildingEditMode()==='rename' ? 'Tap a footprint to name it'
      : buildingEditMode()==='remove' ? `Tap or drag to trim tiles off a footprint (${game.brushSize}-wide)`
      : `Tap or drag ground touching a footprint to extend it (${game.brushSize}-wide)`)
    : game.tool==='pet'
    ? `Tap a clear spot to settle your ${petLabel()}`
    : 'Tap a tile to place · drag to paint a run');
  setActButton();
  const sd=absDay();
  if (sd!==game.lastDay){
    if (game.lastDay>=0 && sd%DAYS_PER_SEASON===0)
      toast(cal.season==='Spring'
        ? 'Spring. Last year is cut back — everything starts small and grows again.'
        : `${cal.season} begins. Watch the garden change.`);
    game.lastDay=sd;
    if (game.inGarden&&hasStorage){ saveSolo(true); game.dirty=false; }
  }
}

/* ---------- screens ---------- */
const $=id=>document.getElementById(id);
function show(id){ ['menuScreen','plotScreen','worldsScreen','designScreen','libraryScreen','dailyScreen'].forEach(s=>
  $(s).classList.toggle('hidden',s!==id));
  if (id==='menuScreen'){ game.challenge=null; advanceMenuSeason(); refreshMenuCards(); }
}
function overlayController(id){ return document.querySelector(`[aria-controls="${id}"]`); }
function overlayFocusables(el){
  if (!el) return [];
  return Array.from(el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(n=>!n.classList.contains('hidden') && n.getAttribute('aria-hidden')!=='true');
}
function openOverlay(id,focusSelector){
  const el=$(id); if (!el) return null;
  el._returnFocus=document.activeElement && document.activeElement.focus ? document.activeElement : null;
  el.classList.remove('hidden');
  const ctl=overlayController(id); if (ctl) ctl.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>{
    if (el.classList.contains('hidden')) return;
    const target=(focusSelector&&el.querySelector(focusSelector)) || overlayFocusables(el)[0] || el.querySelector('.panel') || el;
    if (target && target.focus) target.focus({preventScroll:true});
  });
  return el;
}
function closeOverlay(id,restoreFocus=true){
  const el=$(id); if (!el) return;
  el.classList.add('hidden');
  const ctl=overlayController(id); if (ctl) ctl.setAttribute('aria-expanded','false');
  const back=el._returnFocus; el._returnFocus=null;
  if (restoreFocus && back && back.isConnected!==false && back.focus) back.focus({preventScroll:true});
}
function trapOverlayFocus(el,e){
  if (!el || e.key!=='Tab') return false;
  const nodes=overlayFocusables(el); if (!nodes.length){ e.preventDefault(); return true; }
  const first=nodes[0], last=nodes[nodes.length-1], active=document.activeElement;
  const outside=!el.contains || !el.contains(active);
  if (e.shiftKey && (active===first || outside)){ e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && (active===last || outside)){ e.preventDefault(); first.focus(); return true; }
  return false;
}
function suspendClock(){
  if (!game.inGarden || game.pausedAt || game.clockSuspended) return;
  game.elapsedMs=elapsedGameMs();
  game.clockSuspended=true;
  game.startTs=Date.now();
}
function resumeClockSession(){
  if (!game.inGarden || !game.clockSuspended) return;
  game.clockSuspended=false;
  game.startTs=Date.now();
}
function pauseClock(){
  if (!game.inGarden || game.pausedAt) return;
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
/* the time dropdown's backdrop is pointer-transparent (see styles.css), so
   the season box keeps working while it's open — dismissal is this capture
   listener: any press outside the panel (and off the box, whose own handler
   toggles) closes the menu, and the press still acts on what it hit. */
function pauseOutsidePress(e){
  const ps=$('pauseScreen');
  if (ps.classList.contains('hidden')) return;
  const panel=ps.querySelector('.panel'), box=$('btnSeasonBox');
  if ((panel && panel.contains(e.target)) || (box && box.contains(e.target))) return;
  closePause();
}
function openPause(){
  const ps=$('pauseScreen');
  $('pauseMeta').textContent=clockMeta();
  $('btnPauseResume').textContent=game.pausedAt?'Resume':'Pause day';
  updatePreviewToggle();
  openOverlay('pauseScreen');
  document.addEventListener('pointerdown',pauseOutsidePress,true);
  // drop the panel down under the season box, left-aligned to it
  const box=$('btnSeasonBox'), p=ps.querySelector('.panel');
  if (box && p){ const r=box.getBoundingClientRect();
    p.style.top=(r.bottom+10)+'px';
    p.style.left=Math.max(8,Math.round(r.left))+'px'; }
}
function closePause(){
  closeOverlay('pauseScreen');
  document.removeEventListener('pointerdown',pauseOutsidePress,true);
}
function toggleClock(){
  if (game.pausedAt){ resumeClock(); toast('Day started.'); }
  else { pauseClock(); toast('Day paused.'); }
  updateHUD();
}
function skipToAbsDay(targetDay){
  const d=absDay();
  if (targetDay<=d) return;
  game.dayOffset += targetDay-d;
  // Land exactly on the new season/year start, not partway through its first
  // day. A garden day is only 20s, so the sub-day remainder the clock carried
  // would otherwise burn off the instant you arrive (skip while 90% through a
  // day and the new season's day 1 is already almost over). Bank whole days and
  // restart the running segment from zero — correct whether paused or running.
  const egm=elapsedGameMs(), rem=egm%DAY_MS;
  if (rem){ game.elapsedMs=egm-rem; game.startTs=Date.now(); }
  game.dirty=true;
  if (game.inGarden&&hasStorage) saveSolo(true);
}
function skipNextSeason(){
  const d=absDay();
  skipToAbsDay((Math.floor(d/DAYS_PER_SEASON)+1)*DAYS_PER_SEASON);
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

