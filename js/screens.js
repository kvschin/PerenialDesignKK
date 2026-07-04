'use strict';
let pendingMode=null;

/* ---------- daily design challenge ----------
   A prompt-only design brief that rotates once a day. Date-seeded so everyone
   gets the same one (the Wordle trick) — no backend, nothing scored. It just
   suggests a style + a few plant types to design toward. */
// `match` pins the plant palette to what fits the prompt (any-of roles /
// any-of types, checked in challengeAllows). Technique-only prompts carry no
// match and leave the full palette open.
const DAILY_CHALLENGES = [
  { title:'Dry Prairie Matrix',   brief:'A sunny, low-water bed in the tallgrass spirit.',
    plants:'Lead with native grasses — little bluestem, prairie dropseed — and scatter three forbs through them.',
    match:{moist:['dry','medium'], roles:['prairie','matrix','dry']} },
  { title:'Shade Woodland Floor', brief:'A cool, layered planting for part to full shade.',
    plants:'Ferns, woodland sedges, and a hosta or two. Keep it green and textural.',
    match:{roles:['shade','woodland','fern']} },
  { title:'Pollinator Patch',     brief:'A bed built to pull in bees and butterflies.',
    plants:'At least four summer-blooming natives — coneflower, wild bergamot, milkweed, mountain mint.',
    match:{roles:['pollinator','nectar','host']} },
  { title:'Four-Season Interest', brief:'A garden that earns its keep in every season.',
    plants:'Include winter structure: grasses and seedheads that still stand after a hard frost.',
    match:{roles:['seedhead','winter']} },
  { title:'Cottage Abundance',    brief:'Romantic, full, and a little wild.',
    plants:'Layered self-seeders — yarrow, salvia, coneflower — with a froth of fine grass between.' },
  { title:'Hot, Dry Gravel',      brief:'A sun-baked, fast-draining bed.',
    plants:'Drought-tough natives — rattlesnake master, blazing star, little bluestem, yucca.',
    match:{moist:['dry','medium'], roles:['dry','gravel','silver']} },
  { title:'Slow-Draining Low',    brief:'A planting for a wet spot that holds water.',
    plants:'Moisture-lovers — swamp milkweed, switchgrass, and a stand of sedges.',
    match:{roles:['wet','water'], keys:['switchgrass']} },
  { title:'Monochrome Study',     brief:'A garden in shades of a single colour.',
    plants:'Pick one bloom colour and repeat it; let foliage and seedheads carry the rest.' },
  { title:'Grasses Only',         brief:'Texture and movement, no flowers required.',
    plants:'A pure matrix of grasses and sedges at varied heights — bluestem, dropseed, switchgrass, moor grass.',
    match:{types:['grass','sedge']} },
  { title:'Late-Season Glow',     brief:'A bed that peaks in September and October.',
    plants:'Asters, goldenrod, big bluestem, and switchgrass for autumn colour and seed.',
    match:{roles:['late','seedhead']} },
  { title:'Deer-Resistant Border',brief:'A border the deer will mostly walk past.',
    plants:'Aromatic and tough — wild bergamot, mountain mint, salvia, yarrow, and grasses.',
    match:{roles:['deerOk']} },
  { title:'Repetition & Rhythm',  brief:'One idea, repeated, for a calm planting.',
    plants:'Choose three or four species and repeat them in drifts across the whole bed.' },
  { title:'Matrix & Scatter',     brief:'A grass matrix with perennials threaded through it.',
    plants:'A base layer of fine grasses, then single perennials scattered through like seed on the wind.',
    match:{roles:['matrix','prairie']} },
  { title:'Hummingbird Garden',   brief:'Tubular reds and pinks they can’t resist.',
    plants:'Cardinal flower, bee balm, penstemon, and salvia — repeated in bold patches.',
    match:{roles:['nectar','pollinator']} },
  { title:'Spring Ephemerals',    brief:'An early show that fades before summer’s heat.',
    plants:'Bulbs underplanting woodland ephemerals — bluebells, shooting star, prairie smoke.',
    match:{roles:['bulbLayer','early'], keys:['bluebells','woodlandphlox','shootingstar','prairiesmoke','pasqueflower','columbine','wildgeranium','dwarfcrestediris','solomonsseal']} },
  { title:'Foliage First',        brief:'A planting that works on leaf, not flower.',
    plants:'Lean on shape and colour — ferns, fine grasses, silver mounds, a bold hosta.',
    match:{roles:['fern','silver','groundcover','architectural','matrix','structure']} },
  { title:'Evergreen Bones',      brief:'Year-round structure that never goes bare.',
    plants:'Clipped evergreens and woody form — boxwood, yew, and a small tree for height.',
    match:{roles:['evergreen','structure']} },
  { title:'Sensory Garden',       brief:'Scents to brush past and textures to touch.',
    plants:'Aromatic mints and soft, silvery leaves — mountain mint, calamint, lamb’s ear, fine grass.',
    match:{roles:['aromatic','silver','movement']} },
];
function todaysChallenge(){ return DAILY_CHALLENGES[Math.floor(Date.now()/864e5) % DAILY_CHALLENGES.length]; }
function openDaily(){
  const c=todaysChallenge();
  $('dailyDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'});
  $('dailyTitle').textContent=c.title;
  $('dailyBrief').textContent=c.brief;
  $('dailyPlants').textContent=c.plants;
  const n=challengePaletteSize(c), total=speciesCount();
  $('dailyPalette').textContent = n<total
    ? `Palette · ${n} of ${total} plants fit this challenge`
    : 'Palette · full — design freely';
  show('dailyScreen');
}
// Drop straight into a design garden for today's challenge — no questionnaire,
// no plot screen (the prompt is the constraint). Name is Daily: "<title>", the
// plot is a random 40–100 ft rectangle (width/length independent), and the
// palette is left broad so any prompt can be met.
function startDailyChallenge(){
  const c=todaysChallenge(); game.challenge=c; pendingMode='design';
  const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  setWorldSize(ftToTiles(rnd(40,100)), ftToTiles(rnd(40,100)));
  game.worldId='w'+Date.now().toString(36);
  game.worldName=`Daily: "${c.title}"`;
  game.mode='solo'; game.gameMode='design'; game.visiting=false;
  game.previewMode='established';
  game.rot=0; game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.freePlanting=false;
  game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'};
  game.houses=[]; game.houseDraft=defaultDraft();
  markGroundChanged({terrain:true});
  game.edgeStyle='organic';                               // daily challenges default to naturalistic edges
  const zone=(game.region&&game.region.zone)||6;          // keep the user's zone, drop style/native filters
  game.design={zone,type:'any',nativesOnly:false,deer:false,rabbit:false};
  game.region={eco:null,zone,nativesOnly:false}; updateRegionBtn();
  enterGarden();
  game.trayCat=firstStockedTrayCat(); buildToolTray();   // open on a populated sub-tab for this prompt
  saveSolo(true);
}

async function refreshMenuCards(){
  const dc=$('btnDaily'); if (dc) dc.querySelector('small').textContent='Today · '+todaysChallenge().title;
  const g=$('btnGardens'); if (!g) return;
  const idx=hasStorage ? await migrateLegacyWorld() : [];
  g.querySelector('small').textContent=idx.length
    ? `${idx.length} saved garden${idx.length>1?'s':''}`
    : 'Open, visit, and manage saved gardens';
}

$('btnDesign').onclick=()=>{ pendingMode='design'; openWorlds('design'); };
$('btnDaily').onclick=openDaily;
$('btnDailyStart').onclick=startDailyChallenge;
$('btnLibrary').onclick=openLibrary;
$('btnLibraryClose').onclick=()=>show('menuScreen');
$('librarySearch').oninput=applyLibrarySearch;
$('btnGardens').onclick=()=>{ pendingMode=null; openWorlds('all'); };

/* the worlds screen — filtered by game mode. Legacy saves with no
   `mode` are Story gardens (they had an avatar). */
let worldsFilter='all';
function worldMode(w){ return w.mode==='design'?'design':'story'; }
function startNewGarden(mode){
  if (mode==='design'){ pendingMode='design'; openDesignSetup(); }
  else { pendingMode='story'; openCreator(); }
}
async function openWorlds(filter){
  worldsFilter=filter||'all';
  const all=await migrateLegacyWorld();
  const idx=worldsFilter==='all' ? all : all.filter(w=>worldMode(w)===worldsFilter);
  if (!idx.length && worldsFilter!=='all'){ startNewGarden(worldsFilter); return; } // none yet → create
  const titles={design:'Design gardens', story:'Story gardens', all:'View gardens'};
  const subs={
    design:'Continue a planting plan, or start a new one.',
    story:'Continue tending, or start a new garden.',
    all:'Every garden saved on this device.'};
  $('worldsTitle').textContent=titles[worldsFilter];
  $('worldsSub').textContent=subs[worldsFilter];
  $('btnNewWorld').textContent = worldsFilter==='story' ? 'Start a new garden' : 'Design a new garden';
  const list=$('worldList'); list.innerHTML='';
  if (!idx.length){ const e=document.createElement('p'); e.className='note';
    e.textContent='No gardens yet — start one below.'; list.appendChild(e); }
  idx.sort((a,b)=>b.ts-a.ts).forEach(w=>{
    const row=document.createElement('button'); row.className='world-row';
    const info=document.createElement('span'); info.style.flex='1';
    const nm=document.createElement('span'); nm.className='wname'; nm.textContent=w.name||'My garden';
    const badge=worldMode(w)==='design'?' · Design':' · Story';
    const meta=document.createElement('span'); meta.className='meta';
    meta.textContent=`${Math.round((w.gw||31)*1.5)} × ${Math.round((w.gh||31)*1.5)} ft${badge} · ${new Date(w.ts).toLocaleDateString()}`;
    info.append(nm,document.createElement('br'),meta);
    const dup=document.createElement('button'); dup.className='world-dup'; dup.textContent='Duplicate';
    dup.title='Make a separate copy of this garden';
    dup.onclick=e=>{ e.stopPropagation(); duplicateWorld(w.id); };
    const del=document.createElement('button'); del.className='world-del'; del.textContent='✕';
    del.title='Delete this garden';
    del.onclick=e=>{ e.stopPropagation();
      if (del.dataset.arm){ deleteWorld(w.id); }
      else { del.dataset.arm='1'; del.textContent='Sure?'; } };
    // Visit (read-only stroll) lives in View Gardens, not the Design-a-Garden flow
    if (worldsFilter!=='design'){
      const visit=document.createElement('button'); visit.className='world-visit'; visit.textContent='Visit';
      visit.title='Walk this garden as your avatar (read-only)';
      visit.onclick=e=>{ e.stopPropagation(); visitWorld(w.id); };
      row.append(info,dup,visit,del);
    } else {
      row.append(info,dup,del);
    }
    row.onclick=()=>enterWorld(w.id);
    list.appendChild(row);
  });
  show('worldsScreen');
}
async function enterWorld(id){
  game.worldId=id; game.mode='solo'; game.visiting=false;
  if (!(await loadSolo(id))){ toast('That garden failed to load.'); game.mode=null; return; }
  enterGarden();
}
// Visit Gardens: load any saved garden and walk it as a read-only avatar. We
// force story mode (so the avatar/movement/camera all work, even on a Design
// garden) and set game.visiting, which hides the editing chrome, makes taps
// walk-only, and turns saveSolo into a no-op so the garden is never altered.
async function visitWorld(id){
  game.worldId=id; game.mode='solo';
  if (!(await loadSolo(id))){ toast('That garden failed to load.'); game.mode=null; return; }
  game.gameMode='story'; game.visiting=true;
  enterGarden();
}
/* share-a-file: a garden is just a JSON blob, so export it to a file a friend
   can import (no backend). Export wraps the stored world in a small envelope;
   import validates the envelope, writes it as a fresh local world, and lists
   it so it can be Opened or Visited. */
async function shareCurrentGarden(){
  closeOverlay('gardenMenu');
  if (game.mode!=='solo' || !game.worldId){ toast('Save the garden first, then share it.'); return; }
  if (!game.visiting) await saveSolo(true);            // store the latest (no-op while visiting)
  const w=await sGet('hortus:world:'+game.worldId);
  if (!w){ toast('That garden could not be read.'); return; }
  const env=JSON.stringify({ pocketPrairie:1, v:1, exported:Date.now(), world:w });
  const fname=((game.worldName||w.name||'garden').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase())||'garden';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([env],{type:'application/json'}));
  a.download=fname+'.prairie.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Garden file downloaded — send it to a friend to share.');
}
function importWorldFile(file){
  if (!file) return;
  const reader=new FileReader();
  reader.onload=async()=>{
    let env; try{ env=JSON.parse(reader.result); }catch(e){ toast('That file is not a garden.'); return; }
    const w=env && env.pocketPrairie && env.world;
    if (!w || typeof w!=='object' || typeof w.plants!=='object'){ toast('That does not look like a Pocket Prairie garden.'); return; }
    const id='w'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);
    w.name=(w.name||'Shared garden').replace(/ \(shared\)$/,'')+' (shared)';
    await sSet('hortus:world:'+id, w);
    const idx=(await worldsIndex()).filter(x=>x.id!==id);
    idx.push({ id, name:w.name, ts:Date.now(), gw:w.gw||31, gh:w.gh||31, mode:w.mode==='design'?'design':'story' });
    await sSet('hortus:worlds', idx);
    toast(`Imported "${w.name}". Open or Visit it below.`);
    openWorlds(worldsFilter);
  };
  reader.readAsText(file);
}
async function deleteWorld(id){
  const idx=(await worldsIndex()).filter(w=>w.id!==id);
  await sSet('hortus:worlds',idx);
  try{ localStorage.removeItem('hortus:world:'+id); }catch(e){}
  openWorlds(worldsFilter);
}
async function duplicateWorld(id){
  const src=await sGet('hortus:world:'+id);
  if (!src){ toast('That garden could not be duplicated.'); return; }
  const copy=JSON.parse(JSON.stringify(src));
  const base=(copy.name||'My garden').replace(/ copy(?: \d+)?$/i,'');
  const idx=await worldsIndex();
  const siblingNames=new Set(idx.map(w=>(w.name||'').toLowerCase()));
  let name=base+' copy', n=2;
  while (siblingNames.has(name.toLowerCase())) name=`${base} copy ${n++}`;
  const newId='w'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);
  copy.name=name;
  copy.savedAt=Date.now();
  await sSet('hortus:world:'+newId,copy);
  const next=idx.filter(w=>w.id!==newId);
  next.push({id:newId,name,ts:Date.now(),gw:copy.gw||copy.grid||31,gh:copy.gh||copy.grid||31,
    mode:copy.mode==='design'?'design':'story'});
  await sSet('hortus:worlds',next);
  toast(`Duplicated "${base}".`);
  openWorlds(worldsFilter);
}
$('btnNewWorld').onclick=()=>startNewGarden(worldsFilter==='story'?'story':'design');
if ($('btnImport')) $('btnImport').onclick=()=>$('importFile').click();
if ($('importFile')) $('importFile').onchange=e=>{ importWorldFile(e.target.files&&e.target.files[0]); e.target.value=''; };
$('btnHost').onclick=async()=>{ pendingMode='multi-host'; await hostWorld();
  $('codeDisplay').textContent=game.code; show('codeScreen'); };
$('btnCodeContinue').onclick=()=>openCreator();
$('btnJoin').onclick=async()=>{
  const code=$('joinCode').value.trim().toUpperCase();
  if (code.length<4){ toast('Enter the 5-character garden code.'); return; }
  if (await joinWorld(code)){ pendingMode='multi-join'; openCreator(); }
};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ show('menuScreen'); });

/* creator */
function openCreator(){
  // coat swatches
  const row=$('coatRow'); row.innerHTML='';
  COATS.forEach((c,i)=>{ const b=document.createElement('button');
    b.className='swatch'+(i===game.char.coatIdx?' sel':''); b.style.background=c.c; b.title=c.n;
    b.onclick=()=>{ game.char.coatIdx=i; game.char.coat=c.c; game.char.coatD=c.d;
      document.querySelectorAll('.swatch').forEach((s,j)=>s.classList.toggle('sel',j===i)); };
    row.appendChild(b); });
  $('petName').value=game.char.name||'';
  show('creatorScreen');
}
$('speciesRow').onclick=e=>{ const b=e.target.closest('[data-species]'); if(!b)return;
  game.char.species=b.dataset.species;
  $('speciesRow').querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };
$('markRow').onclick=e=>{ const b=e.target.closest('[data-mark]'); if(!b)return;
  game.char.mark=b.dataset.mark;
  $('markRow').querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };

/* live preview */
const pcv=$('previewCanvas'), pcx=pcv.getContext('2d');
function previewLoop(t){
  if (!$('creatorScreen').classList.contains('hidden')){
    pcx.clearRect(0,0,340,380);
    pcx.save(); pcx.scale(2,2);
    drawPlant(pcx,40,168,'karl',1,'Fall',7,Math.sin(t*0.001),undefined,1);
    drawPlant(pcx,132,172,'echinacea',1,'Summer',13,Math.sin(t*0.001),undefined,1);
    drawCritter(pcx,86,168,game.char,t,false,2.1);
    pcx.restore();
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

$('btnStartGame').onclick=async()=>{
  game.char.name=$('petName').value.trim()||'Bramble';
  await saveChar();
  if (pendingMode==='story'){ game.mode='solo'; game.gameMode='story'; game.worldId=null;
    openPlotScreen(); return;  // always a new garden: lay out the plot first
  } else {
    game.mode='multi';
    $('playersPill').classList.remove('hidden');
    syncTimer=setInterval(pollWorld,4000); pollWorld(); pushPresence();
  }
  enterGarden();
};
function starterDrift(){ // a welcoming drift near spawn so the world isn't empty
  const SX=SPAWNX, SY=SPAWNY;
  const picks=[['karl',SX-3,SY-3],['karl',SX-2,SY-3],['bluestem',SX-3,SY-2],
               ['echinacea',SX+3,SY+3],['echinacea',SX+4,SY+3],['dropseed',SX+3,SY+4]];
  // backdated 26 days = 10 growing days last fall + the winter between,
  // so the drift arrives established and wakes with the player's first spring
  picks.forEach(([s,x,y])=>{ if(tileTerrain(x,y)!=='path'&&!inHouse(x,y))
    setTile('plants',`${x},${y}`,{s,d:absDay()-26,t:Date.now()}); });
}
function enterGarden(){
  show(''); $('hud').classList.remove('hidden');
  cnv.classList.remove('hidden'); mcnv.classList.add('hidden');
  setActiveCanvas(cnv);
  setViewportFill('#4b5044');
  resetSelectionState();
  game.ruler=null;
  game.tool='hand'; game.toolVar=null; game.clockSuspended=false; game.startTs=Date.now();
  if (game.gameMode==='design' && !game.visiting){
    game.previewMode=game.previewMode||'established';
    game.pausedAt=Date.now();
  } else {
    game.previewMode='today';
    game.pausedAt=0;
  }
  document.body.classList.toggle('design-mode', game.gameMode==='design');
  document.body.classList.toggle('visiting', !!game.visiting);
  userZoom = game.visiting ? 1.7 : 1; calcZoom(); // visits zoom in on the avatar (closer view + fewer tiles → smoother)
  let groundReset=false;
  if (!Array.isArray(game.houses)){ game.houses=[]; groundReset=true; }
  if (!game.elevation){ game.elevation={}; groundReset=true; }
  if (!game.fences) game.fences={};
  if (!game.lights) game.lights={};
  if (!game.firepits) game.firepits={};
  if (!game.houseDraft) game.houseDraft=draftFromHouses();
  game.fenceDraft=normalizeFenceDraft(game.fenceDraft);
  game.lightDraft=normalizeLightDraft(game.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(game.firepitDraft);
  game.edgeStyle=edgeStyleId(game.edgeStyle);
  game.bedStyle=bedStyleId(game.bedStyle);
  if (game.gameMode==='design'){
    // free camera centered on the plot; no avatar, no forced house
    game.px=game.tx=SPAWNX; game.py=game.ty=SPAWNY; game.moving=false;
    snapCam();
  } else {
    if (!game.houses.length && !game.visiting){ game.houses=[defaultHouse()]; groundReset=true; }
    const [spx,spy]=safeSpawn();   // never start stuck inside the house
    game.px=game.tx=spx; game.py=game.ty=spy;
    snapCam();
  }
  if (groundReset) markGroundChanged();
  game.lastDay=absDay();
  undoStack=[]; redoStack=[]; updateUndoBtn();
  buildToolTray();
  buildCanvasTools();
  updateCompass();
  $('worldLabel').textContent = game.mode==='multi'
    ? `Garden ${game.code}` : (game.worldName||'Solo garden');
  if (game.challenge && game.gameMode==='design')
    setTimeout(()=>{ if (game.challenge){
      const n=challengePaletteSize(game.challenge), total=speciesCount();
      const pal = n<total ? `${n} of ${total} plants fit this challenge` : 'full palette — design freely';
      toast(`${game.challenge.title} — ${pal}.`);
    } }, 450);
  if (game.visiting)
    setTimeout(()=>{ if (game.visiting) toast(`Visiting ${game.worldName||'this garden'} — read-only. Tap to walk around.`); }, 450);
}
/* the plot screen: size a brand-new solo garden in real feet */
const PLOT_PRESETS=[['Classic',46,46],['1/10 acre',66,66],['1/5 acre',93,93],['1/4 acre',104,104]];
const FT_MIN=24, FT_MAX=200; // 16..134 tiles per side
function plotFt(id){ return Math.max(FT_MIN,Math.min(FT_MAX,+$(id).value||46)); }
function updatePlotNote(){
  const w=plotFt('plotW'), l=plotFt('plotL');
  $('plotNote').textContent=
    `${ftToTiles(w)} × ${ftToTiles(l)} tiles · ${(w*l).toLocaleString()} sq ft · ${(w*l/43560).toFixed(2)} acres`;
}
function openPlotScreen(){
  const row=$('plotPresets');
  if (!row.children.length){
    PLOT_PRESETS.forEach(([n,w,l],i)=>{
      const b=document.createElement('button');
      b.className='chip'+(i===0?' sel':''); b.textContent=n;
      b.onclick=()=>{ $('plotW').value=w; $('plotL').value=l; updatePlotNote();
        row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };
      row.appendChild(b);
    });
    $('plotW').oninput=$('plotL').oninput=()=>{ updatePlotNote();
      row.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel')); };
    $('btnPlotStart').onclick=()=>{
      setWorldSize(ftToTiles(plotFt('plotW')), ftToTiles(plotFt('plotL')));
      game.worldId='w'+Date.now().toString(36);
      game.worldName=$('plotName').value.trim()||'My garden';
      game.rot=0; game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
      game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.freePlanting=false;
      game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'};
      // naturalistic styles get smoothed bed/path edges; structured styles stay crisp
      game.edgeStyle=edgeStyleFromType(game.design&&game.design.type);
      if (pendingMode==='design'){            // serious design: blank plot, no avatar, no house
        game.mode='solo'; game.gameMode='design'; game.previewMode='established'; game.houses=[]; markGroundChanged({terrain:true}); game.houseDraft=defaultDraft();
      } else {                                // story: avatar garden with a house + welcome drift
        game.gameMode='story'; game.previewMode='today'; game.houses=[defaultHouse()]; markGroundChanged({terrain:true}); game.houseDraft=draftFromHouses();
        seedWalkway(); starterDrift();
      }
      enterGarden();
      saveSolo(true); // claim the slot right away
    };
    $('btnPlotBack').onclick=()=>{ if (pendingMode==='design'){ openDesignSetup(); } else { game.mode=null; show('menuScreen'); } };
  }
  $('plotW').value=46; $('plotL').value=46; $('plotName').value=''; updatePlotNote();
  show('plotScreen');
}

/* design setup: a questionnaire that tunes the palette before sizing */
const GARDEN_TYPES=[
  ['any','Any garden','Use every plant that matches your zone and native-plant filters.'],
  ['cottage','Cottage','Romantic and abundant — layered perennials and self-seeders.'],
  ['prairie','Prairie / Meadow','Native grasses and forbs in naturalistic drifts.'],
  ['butterfly','Pollinator','Nectar and host plants for butterflies and bees.'],
  ['shade','Shade / Woodland','Understory calm — hostas, ferns, sedges, woodland bulbs.'],
  ['japanese','Japanese','Restraint and structure — evergreens, moss, stone.'],
  ['mediterranean','Mediterranean','Silver foliage and herbs that love dry heat.'],
  ['modern','Modern','Bold blocks and clean structure, a tight palette.'],
  ['gravel','Gravel / Rock','Drought-tough plants in lean, sharp drainage.'],
  ['formal','Formal','Symmetry and clipped lines — axial beds and hedges.'],
  ['coastal','Coastal','Salt- and wind-tolerant grasses and dune plants.'],
];
// Plain-language winter bands for people who don't know their zone: each maps
// to a representative zone (6 and 7 are the most-populated US zones, so the two
// middle bands hit them). The ZIP field is the precise path; this is the
// "won't type a ZIP / not in the US" fallback.
const WINTER_BANDS=[
  ['Deep freeze','well below 0°F',4],
  ['Cold winters','below 0°F most years',6],
  ['Light frost','freezes, rarely below 20°F',7],
  ['Barely freezes','mild winters',9],
];
const ZONE_LOWS={3:'−40°F',4:'−25°F',5:'−15°F',6:'−5°F',7:'5°F',8:'15°F',9:'25°F'};
function openDesignSetup(){
  const d=game.design||{};
  const sel={zone:d.zone||6, type:d.type||'any',
    nativesOnly:!!d.nativesOnly, deer:!!d.deer, rabbit:!!d.rabbit, zoneManual:false};
  const mkChip=(label,on,fn,extra)=>{ const b=document.createElement('button');
    b.type='button'; b.className='chip'+(extra?' '+extra:'')+(on?' sel':'');
    b.textContent=label; b.onclick=fn; return b; };
  const winterEl=$('dgnWinter'), zoneChipsEl=$('dgnZoneChips'), typeEl=$('dgnTypeChips'),
    consEl=$('dgnConstraints');
  const syncMeadow=()=>applyMeadowPalette(sel.type, sel.zone);  // replant the backdrop to match
  function updateReadout(){
    $('dgnZoneOut').innerHTML=`<b>Zone ${sel.zone}</b> — winters bottom out near ${ZONE_LOWS[sel.zone]||'—'}. `+
      `We'll only offer plants that can take that.`;
  }
  function updateCount(){
    const n=paletteCount(sel);
    $('dgnCount').innerHTML=`<b>${n}</b> plant${n===1?'':'s'} fit this garden so far.`;
  }
  function setZone(z){
    sel.zone=Math.max(3,Math.min(9,z));
    renderWinter(); renderZoneChips(); updateReadout(); updateCount(); syncMeadow();
  }
  function renderWinter(){ winterEl.innerHTML='';
    WINTER_BANDS.forEach(([label,,z])=>winterEl.appendChild(mkChip(label,sel.zone===z,()=>setZone(z)))); }
  function renderZoneChips(){
    zoneChipsEl.classList.toggle('hidden',!sel.zoneManual);
    zoneChipsEl.innerHTML=''; if (!sel.zoneManual) return;
    for (let z=3;z<=9;z++) zoneChipsEl.appendChild(mkChip('Zone '+z,sel.zone===z,()=>setZone(z)));
  }
  function renderType(){ typeEl.innerHTML='';
    GARDEN_TYPES.forEach(([id,label])=>typeEl.appendChild(mkChip(label,sel.type===id,()=>{
      sel.type=id; renderType(); syncMeadow();
      $('dgnTypeNote').textContent=(GARDEN_TYPES.find(g=>g[0]===id)||[])[2]||''; })));
    $('dgnTypeNote').textContent=(GARDEN_TYPES.find(g=>g[0]===sel.type)||[])[2]||'';
  }
  function renderConstraints(){ consEl.innerHTML='';
    const t=(label,key)=>consEl.appendChild(mkChip(label,sel[key],()=>{
      sel[key]=!sel[key]; renderConstraints(); updateCount(); },'toggle'));
    t('Natives only','nativesOnly'); t('Deer resistant','deer'); t('Rabbit resistant','rabbit');
  }
  const zipEl=$('dgnZip'); zipEl.value='';
  zipEl.oninput=()=>{ const z=zoneFromZip(zipEl.value); if (z) setZone(z); };
  const manualBtn=$('dgnZoneManual'); manualBtn.textContent='I know my zone ›';
  manualBtn.onclick=()=>{ sel.zoneManual=!sel.zoneManual;
    manualBtn.textContent=sel.zoneManual?'Hide zone list ‹':'I know my zone ›'; renderZoneChips(); };
  renderWinter(); renderZoneChips(); renderType(); renderConstraints(); updateReadout(); updateCount();
  syncMeadow();   // replant the backdrop for the initial style/zone
  $('btnDesignNext').onclick=()=>{
    game.design={zone:sel.zone, type:sel.type, nativesOnly:sel.nativesOnly, deer:sel.deer, rabbit:sel.rabbit};
    // tune the live palette: zone/native filters apply, style ranks the tray
    game.region={eco:null, zone:sel.zone, nativesOnly:sel.nativesOnly};
    sSet('hortus:region',game.region); updateRegionBtn();
    openPlotScreen();
  };
  $('btnDesignBack').onclick=()=>{ game.mode=null; show('menuScreen'); };
  show('designScreen');
}
function quitToMenu(){
  suspendClock();
  if (game.mode==='solo'&&hasStorage) saveSolo();
  if (syncTimer){ clearInterval(syncTimer); syncTimer=null; }
  game.mode=null; game.pausedAt=0; game.clockSuspended=false;
  game.others={}; game.pathTarget=null; game.sleepOnArrive=false;
  document.body.classList.remove('design-mode');
  $('exportScreen').classList.add('hidden'); $('regionScreen').classList.add('hidden');
  $('planScreen').classList.add('hidden'); $('pauseScreen').classList.add('hidden');
  $('gardenMenu').classList.add('hidden'); $('confirmSeasonScreen').classList.add('hidden');
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden'); $('playersPill').classList.add('hidden');
  setActiveCanvas(mcnv);
  setMenuViewportFill();
  show('menuScreen');
}
function openGardenMenu(){
  const gm=$('gardenMenu'); gm.classList.remove('hidden');
  // anchor the dropdown right under the ☰ button, right-aligned to the action
  // bar — robust to the bar's height/width at any breakpoint
  const bar=$('actionBar').getBoundingClientRect(), p=gm.querySelector('.panel');
  if (p && bar.width){ p.style.top=(bar.bottom+6)+'px';
    p.style.right=Math.max(8,Math.round(innerWidth-bar.right))+'px'; }
}
$('btnMenu').onclick=openGardenMenu;
// click the backdrop (anywhere off the panel) to dismiss, like any dropdown
$('gardenMenu').onclick=(e)=>{ if (e.target===$('gardenMenu')) closeOverlay('gardenMenu'); };
$('btnQuit').onclick=quitToMenu;
if ($('btnShare')) $('btnShare').onclick=shareCurrentGarden;
$('btnGmClose').onclick=()=>closeOverlay('gardenMenu');
/* no Save button: autosave covers day changes, quitting, and the tab
   being hidden or closed mid-session */
function autosaveNow(){ if (game.mode==='solo'&&hasStorage){ saveSolo(true); game.dirty=false; } }
addEventListener('visibilitychange',()=>{
  if (document.hidden){ suspendClock(); autosaveNow(); }
  else { resumeClockSession(); updateHUD(); }
});
addEventListener('pagehide',()=>{ suspendClock(); autosaveNow(); });
if ($('btnSleep')){ $('btnSleep').classList.toggle('hidden',!ENABLE_HUD_SLEEP_BUTTON); $('btnSleep').onclick=doSleep; }
if ($('btnDayNight')) $('btnDayNight').onclick=()=>{ game.layerVis.night=!game.layerVis.night;
  updateDayNightBtn(); refreshCanvasTools();
  toast(game.layerVis.night?'Night — your garden lighting switches on.':'Back to daylight.'); };
if ($('btnPause')) $('btnPause').onclick=toggleClock;
// the season box: hold to fast-forward time, tap to open the time menu
(function wireSeasonBox(){
  const box=$('btnSeasonBox'); if (!box) return;
  let holdTimer=null, ffStarted=false;
  const cancelFF=()=>{ if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    if (ffStarted){ game.ffActive=false; ffStarted=false; } };
  box.addEventListener('pointerdown',e=>{ e.preventDefault(); ffStarted=false;
    holdTimer=setTimeout(()=>{ game.ffActive=true; ffStarted=true; },200); });
  box.addEventListener('pointerup',()=>{ if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    if (ffStarted){ game.ffActive=false; ffStarted=false; } else openPause(); });
  box.addEventListener('pointerleave',cancelFF);
  box.addEventListener('pointercancel',cancelFF);
})();
// the menu's primary button now pauses or resumes, since the dial's Pause button is gone
$('btnPauseResume').onclick=()=>{ if (game.pausedAt) resumeClock(); else pauseClock(); closePause(); updateHUD(); };
// the time menu is a dropdown — click the backdrop (off the panel) to dismiss
$('pauseScreen').onclick=(e)=>{ if (e.target===$('pauseScreen')) closePause(); };
$('btnSkipSeason').onclick=openSeasonConfirm;
$('btnSkipYear').onclick=skipNextYear;
$('btnCancelSeasonSkip').onclick=closeSeasonConfirm;
$('btnConfirmSeasonSkip').onclick=confirmSkipSeason;
if ($('btnPreviewToday')) $('btnPreviewToday').onclick=()=>setPreviewMode('today');
if ($('btnPreviewEstablished')) $('btnPreviewEstablished').onclick=()=>setPreviewMode('established');
$('btnExport').onclick=()=>{ closeOverlay('gardenMenu'); openExport(); };
$('btnExportClose').onclick=()=>closeOverlay('exportScreen');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;
$('btnRegion').onclick=()=>{ closeOverlay('gardenMenu'); openRegion(); };
$('btnRegionApply').onclick=applyRegion;
$('btnRegionClose').onclick=()=>closeOverlay('regionScreen');
if ($('btnRotate')) $('btnRotate').onclick=()=>rotateView(1);
$('btnPhoto').onclick=()=>{ closeOverlay('gardenMenu'); takePhoto(); };
$('btnPlan').onclick=()=>{ closeOverlay('gardenMenu'); openPlan(); };
$('btnPlanClose').onclick=()=>closeOverlay('planScreen');
$('btnPlanPng').onclick=downloadPlan;
$('btnPlanList').onclick=()=>{ closeOverlay('planScreen'); openExport(); };
$('btnAct').onclick=()=>{ if (ENABLE_MOBILE_ACT_BUTTON) actHere(); };
if ($('btnZoomOut')) $('btnZoomOut').onclick=()=>zoomBy(0.89);
if ($('btnZoomIn')) $('btnZoomIn').onclick=()=>zoomBy(1.12);
if ($('btnZoomFit')) $('btnZoomFit').onclick=()=>fitPlot();
(function wireSheetHandle(){
  const h=$('sheetHandle'); if (!h) return;
  let drag=null;
  h.addEventListener('pointerdown',e=>{
    drag={y:e.clientY,moved:false};
    try{ h.setPointerCapture(e.pointerId); }catch(_){}
  });
  h.addEventListener('pointermove',e=>{
    if (!drag) return;
    if (Math.abs(e.clientY-drag.y)>10) drag.moved=true;
  });
  const finish=e=>{
    if (!drag) return;
    const dy=e.clientY-drag.y, moved=drag.moved;
    drag=null;
    if (moved && Math.abs(dy)>28) nudgeSheetState(dy<0?1:-1);
    else cycleSheetState();
  };
  h.addEventListener('pointerup',finish);
  h.addEventListener('pointercancel',()=>{ drag=null; });
})();

/* ---------- menu background: a living meadow ---------- */
const mcnv=$('menuCanvas'), mcx=mcnv.getContext('2d');
setActiveCanvas(mcnv);
const MENU_SCENES={
  Spring:{
    sky:['#6f8795','#cfdac3','#1c1813'],
    glow:['rgba(202,213,132,.30)','rgba(96,132,78,.18)'],
    ground:'rgba(30,46,29,.30)', pageBg:'#1d1f16', alpha:.72, bloom:1,
    keys:['crocus','daffodil','muscari','camassia','baptisia','creamindigo','amsonia','sedge','karl']
  },
  Summer:{
    sky:['#627d83','#9ebd91','#1d1812'],
    glow:['rgba(218,184,96,.28)','rgba(80,112,70,.18)'],
    ground:'rgba(31,55,29,.34)', pageBg:'#1e2216', alpha:.66, bloom:1,
    keys:['echinacea','pallida','rattlesnake','allium','yarrow','monarda','culvers','switchgrass','dropseed']
  },
  Fall:{
    sky:['#211610','#3b2a22','#17100d'],
    glow:['rgba(166,91,44,.28)','rgba(92,58,36,.16)'],
    ground:'rgba(16,10,8,.34)', pageBg:'#150e0b', alpha:.58, bloom:1,
    keys:['aster','newengland','goldenrod','liatris','sedum','bluestem','switchgrass','indiangrass','sanguisorba','helenium']
  },
  Winter:{
    sky:['#26303a','#6d746f','#171613'],
    glow:['rgba(211,221,226,.20)','rgba(112,116,108,.12)'],
    ground:'rgba(235,238,232,.11)', pageBg:'#2e2e2a', alpha:.64, bloom:undefined, snow:true,
    keys:['bluestem','bigbluestem','switchgrass','rattlesnake','allium','culvers','sanguisorba','goldenrod','karl','sideoats']
  }
};
const meadow=[], menuSnow=[];
let menuSeason='Fall';
function rgbaWithAlpha(color, alpha){
  const m=String(color).match(/^rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)$/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${alpha})` : color;
}
function setMenuViewportFill(){
  const sc=MENU_SCENES[menuSeason]||MENU_SCENES.Fall;
  setViewportFill(sc.pageBg||sc.sky[2]||'#241a16');
}
function seedMenuMeadow(){
  const sc=MENU_SCENES[menuSeason], keys=sc.keys;
  meadow.length=0; menuSnow.length=0;
  for (let i=0;i<54;i++) meadow.push({k:keys[i%keys.length], x:Math.random(),
    y:0.76+Math.random()*0.22, s:0.45+Math.random()*1.05, seed:(Math.random()*1e9)|0});
  meadow.sort((a,b)=>a.y-b.y);
}
/* The design questionnaire replants the menu meadow behind it to match the
   chosen style + zone, so a choice visibly changes the world, not just a form.
   Reuses the tray's own plantStyleScore ranking (herbaceous only — no trees in
   the backdrop) filtered to the zone; 'Any garden' (no style weights) keeps the
   curated seasonal meadow. applyMeadowPalette reassigns species IN PLACE over
   the existing slots — same positions/seeds, so it reads as the meadow being
   replanted rather than teleporting. */
function styleMeadowKeys(type, zone){
  if (!type || !STYLE_ROLE_WEIGHTS[type]) return null;
  const herb=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge'||t==='forb'||t==='bulb'; };
  const fits=k=>!PLANTS[k].hidden && herb(k) &&
    (!zone || (PLANTS[k].zones[0]<=zone && PLANTS[k].zones[1]>=zone));
  const ranked=PLANT_KEYS.filter(fits)
    .map(k=>[k,plantStyleScore(k,type)]).filter(e=>e[1]>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>e[0]);
  return ranked.length>=4 ? ranked : null;
}
function applyMeadowPalette(type, zone){
  const keys=styleMeadowKeys(type,zone) || (MENU_SCENES[menuSeason]||MENU_SCENES.Fall).keys;
  if (!meadow.length) seedMenuMeadow();
  for (let i=0;i<meadow.length;i++) meadow[i].k=keys[i%keys.length];
}
function advanceMenuSeason(){
  let next=0;
  if (hasStorage){
    const raw=localStorage.getItem('hortus:menuSeasonIdx');
    next=((raw===null?-1:(parseInt(raw,10)||0))+1)%SEASONS.length;
    try{ localStorage.setItem('hortus:menuSeasonIdx',String(next)); }catch(_){}
  } else {
    next=(SEASONS.indexOf(menuSeason)+1)%SEASONS.length;
  }
  menuSeason=SEASONS[next];
  seedMenuMeadow();
  setMenuViewportFill();
}
function menuRender(t){
  const W=VW,H=VH;
  const sc=MENU_SCENES[menuSeason]||MENU_SCENES.Fall;
  const g=mcx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,sc.sky[0]); g.addColorStop(0.52,sc.sky[1]); g.addColorStop(1,sc.sky[2]);
  mcx.fillStyle=g; mcx.fillRect(0,0,W,H);
  const glow=mcx.createRadialGradient(W*.5,H*.7,10,W*.5,H*.72,Math.max(W,H)*.58);
  glow.addColorStop(0,sc.glow[0]);
  glow.addColorStop(0.42,sc.glow[1]);
  glow.addColorStop(1,'rgba(23,16,13,0)');
  mcx.fillStyle=glow; mcx.fillRect(0,0,W,H);
  const ground=mcx.createLinearGradient(0,H*.68,0,H);
  ground.addColorStop(0,rgbaWithAlpha(sc.ground,0));
  ground.addColorStop(.55,rgbaWithAlpha(sc.ground,.14));
  ground.addColorStop(1,sc.ground);
  mcx.fillStyle=ground;
  mcx.fillRect(0,H*.68,W,H*.32);
  const sway=Math.sin(t*0.0011);
  mcx.save(); mcx.globalAlpha=sc.alpha;
  meadow.forEach(m=>{ mcx.save(); mcx.translate(m.x*W,m.y*H); mcx.scale(m.s,m.s);
    drawPlant(mcx,0,0,m.k,1,menuSeason,m.seed,sway+Math.sin(t*0.0014+m.seed)*0.42,undefined,sc.bloom); mcx.restore(); });
  mcx.restore();
  if (sc.snow){
    if (menuSnow.length<48 && Math.random()<0.42)
      menuSnow.push({x:Math.random()*W,y:-5,v:0.25+Math.random()*0.45,r:1+Math.random()*1.4,w:Math.random()*7});
    mcx.fillStyle='rgba(245,248,252,0.72)';
    menuSnow.forEach(f=>{ f.y+=f.v; f.x+=Math.sin((t*0.001)+f.w)*0.22;
      mcx.beginPath(); mcx.arc(f.x,f.y,f.r,0,7); mcx.fill(); });
    for (let i=menuSnow.length-1;i>=0;i--) if (menuSnow[i].y>H+5) menuSnow.splice(i,1);
  }
}

/* ---------- main loop ---------- */
const MENU_FRAME_MS=1000/30;
const IDLE_FRAME_MS=1000/30;
const IDLE_GRACE_MS=700;
const HUD_IDLE_MS=500;
let prev=performance.now(), keyCooldown=0, lastMenuRender=-Infinity, lastGardenRender=-Infinity, lastHudUpdate=0;
let lastMeaningfulChange=performance.now(), lastRenderSig='';

function markLoopActivity(){ lastMeaningfulChange=performance.now(); }
['pointerdown','pointermove','pointerup','wheel','keydown','keyup','touchstart','touchmove'].forEach(type=>
  addEventListener(type,markLoopActivity,{passive:true}));
function screenOpen(id){
  const el=document.getElementById(id);
  return !!el && !el.classList.contains('hidden');
}
function fullScreenRenderBlocked(){
  return screenOpen('libraryScreen') || screenOpen('planScreen') || screenOpen('exportScreen');
}
function layerVisibilitySig(){
  const vis=game.layerVis||{};
  return Object.keys(vis).sort().map(k=>k+':'+(vis[k]?1:0)).join(',');
}
function selectionSig(){
  const s=game.sel;
  return s ? `${s.x0},${s.y0},${s.x1},${s.y1}` : '';
}
function rulerSig(){
  const r=game.ruler;
  return r ? `${r.a?r.a.join(','):''}>${r.b?r.b.join(','):''}` : '';
}
function renderStateSig(){
  return [
    game.rev, game.groundRev, game.terrainRev, game.rot, absDay(),
    GW, GH, VW, VH, ZOOM.toFixed(3), cam.x.toFixed(1), cam.y.toFixed(1),
    game.tool, game.toolVar||'', game.eraseMode, game.brushSize,
    game.previewMode, game.edgeStyle, layerVisibilitySig(),
    game.hoverTile?game.hoverTile.join(','):'', selectionSig(), rulerSig()
  ].join('|');
}
function hasHeldMovement(){
  return typeof heldKeys!=='undefined' && Object.keys(heldKeys).length>0;
}
function hasActiveGesture(){
  return (typeof activePtrs!=='undefined' && activePtrs.size>0)
    || (typeof pinch!=='undefined' && !!pinch)
    || (typeof toolDrag!=='undefined' && !!toolDrag)
    || (typeof fillTap!=='undefined' && !!fillTap)
    || (typeof rulerDrag!=='undefined' && !!rulerDrag)
    || (typeof panDrag!=='undefined' && !!panDrag)
    || (typeof selDrag!=='undefined' && !!selDrag)
    || (typeof selMove!=='undefined' && !!selMove)
    || (typeof sweep!=='undefined' && !!sweep);
}
function hasTransientGardenWork(){
  return !!(game.ffActive || game.moving || game.pathTarget || hasHeldMovement() || hasActiveGesture()
    || (game.fx&&game.fx.length) || (game.shrubFx&&game.shrubFx.length));
}
function shouldRenderGarden(t){
  if (fullScreenRenderBlocked()) return false;
  const sig=renderStateSig();
  if (sig!==lastRenderSig){
    lastRenderSig=sig;
    lastMeaningfulChange=t;
    return true;
  }
  if (hasTransientGardenWork()) return true;
  if (t-lastMeaningfulChange<IDLE_GRACE_MS) return true;
  return t-lastGardenRender>=IDLE_FRAME_MS;
}
/* ---- glass governor ----
   The chrome's backdrop-filter blur is recomposited by the GPU every frame the
   canvas animates under it — a cost the JS phase timers can't see. If frame
   SPACING stays janky while the user is actively interacting (idle frames are
   deliberately 30fps, so they don't count), drop the blur for the session via
   body.no-glass (solid fills keep the look). Warmup skips the first ~90 hot
   frames so first-load font/shader jank can't trip it. Session-only: a fast
   machine is never punished twice, a slow one re-trips in a few seconds.
   Force it off yourself with ?noglass. */
const GLASS={ema:16.7, off:false, warm:0, LIMIT_MS:30, WARM_FRAMES:90};
function updateGlassMode(dt){
  if (GLASS.off) return;
  if (GLASS.warm<GLASS.WARM_FRAMES){ GLASS.warm++; return; }
  GLASS.ema=GLASS.ema*0.9+dt*0.1;
  if (GLASS.ema>GLASS.LIMIT_MS){
    GLASS.off=true;
    if (document.body && document.body.classList) document.body.classList.add('no-glass');
  }
}
/* ---- debug HUD: perf diagnostics, off by default ----
   Toggle with the backtick key (`) or add ?debug to the URL. Costs nothing
   when off (every measurement is guarded by dbg.on). Shows FPS + a per-frame
   time breakdown — ground pass vs entity/plant pass vs the rest — so we can
   see where the frame actually goes, plus entity/tile counts and the canvas
   pixel budget. Works identically on desktop and tablet for side-by-side. */
const dbg={on:false, el:null, fps:0, fpsAt:0, n:0, acc:{}, ents:0, tiles:0};
// Labelled phase timing with ~zero cost when off: dnow() reads the clock only
// while on; dmark folds the elapsed delta into a named accumulator; dtime wraps
// an ad-hoc call so any function can be timed (e.g. dtime('flood',()=>doFloodFill())).
function dnow(){ return dbg.on?performance.now():0; }
function dmark(label,t0){ if (dbg.on) dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t0); }
function dtime(label,fn){ if (!dbg.on) return fn(); const t=performance.now();
  try{ return fn(); } finally{ dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t); } }
function dbgReset(){ dbg.n=0; dbg.acc={}; }
function toggleDebug(){
  dbg.on=!dbg.on;
  if (dbg.on && !dbg.el){
    dbg.el=document.createElement('div'); dbg.el.id='debugHud';
    dbg.el.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99;'+
      'background:rgba(10,7,5,.82);color:#cfe3c2;font:11px/1.5 ui-monospace,Menlo,monospace;'+
      'padding:6px 11px;border-radius:6px;white-space:pre;pointer-events:none;letter-spacing:.02em';
    document.body.appendChild(dbg.el);
  }
  if (dbg.el) dbg.el.style.display=dbg.on?'block':'none';
  dbg.fpsAt=performance.now(); dbgReset();
}
function updateDebugHud(){
  if (!dbg.el) return;
  const c=document.getElementById('gameCanvas'), n=dbg.n||1, avg=ms=>ms/n;
  const mp=c?(c.width*c.height/1e6).toFixed(2):'?';
  const total=dbg.acc.frame||0;
  // every measured phase, biggest first, with its share of the frame
  const rows=Object.keys(dbg.acc).filter(k=>k!=='frame')
    .sort((a,b)=>dbg.acc[b]-dbg.acc[a])
    .map(k=>`  ${k.padEnd(7)}${avg(dbg.acc[k]).toFixed(2).padStart(6)}ms ${(total?Math.round(dbg.acc[k]/total*100):0).toString().padStart(3)}%`)
    .join('\n');
  dbg.el.textContent=
    `FPS ${(dbg.fps||0).toFixed(0)}   frame ${avg(total).toFixed(2)}ms  (${dbg.ents} ents, ${dbg.tiles} tiles)\n`+
    rows+'\n'+
    `canvas ${c?c.width+'×'+c.height:'?'} (${mp}MP)  dpr ${devicePixelRatio}  zoom ${ZOOM.toFixed(2)}`+
    `  glass ${GLASS.off?'OFF':'on'} (${GLASS.ema.toFixed(1)}ms)`;
}
// debug-only: pack the plot with a dense mix so the profiler sees worst-case.
function stressGarden(){
  const keys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const byType={}; for (const k of keys){ (byType[PLANTS[k].type]||(byType[PLANTS[k].type]=[])).push(k); }
  const pick=t=>{ const a=byType[t]; return a&&a[(Math.random()*a.length)|0]; };
  game.plants={}; game.bulbs={};
  const now=Date.now(), d=absDay();
  for (let y=0;y<GH;y++) for (let x=0;x<GW;x++){
    if (inHouse(x,y)||isDoor(x,y)) continue;
    const r=Math.random(); let s=null;
    if (r<0.04) s=pick('tree');
    else if (r<0.11) s=pick('shrub');
    else if (r<0.58) s=pick(Math.random()<0.5?'grass':'forb');
    else if (r<0.70){ const b=pick('bulb'); if (b) setTile('bulbs',x+','+y,{s:b,d,t:now}); continue; }
    else continue;
    if (s) setTile('plants',x+','+y,{s,d,t:now});
  }
  groundKey='';
  toast('Stress garden: '+Object.keys(game.plants).length+' plants, '+Object.keys(game.bulbs).length+' bulbs');
}
function loop(t){
  const dt=Math.min(50,t-prev); prev=t;
  if (game.mode){
    const tFrame=dnow();
    if (game.ffActive){ game.elapsedMs=(game.elapsedMs||0)+FF_RATE*dt; game.dirty=true; }
    const tMove=dnow();
    if (game.gameMode!=='design'){ // story mode: avatar movement
      keyCooldown-=dt;
      if (keyCooldown<=0 && !game.moving){
        const vecs=Object.values(heldKeys);
        if (vecs.length){
          let mx=0,my=0; vecs.forEach(v=>{mx+=v[0];my+=v[1];});
          mx=Math.sign(mx); my=Math.sign(my);
          if (mx||my){ const [wx,wy]=viewDirToWorld(mx,my);
            tryMove(Math.round(game.px)+wx,Math.round(game.py)+wy); keyCooldown=40; }
        }
      }
      followPath(); stepMove(dt);
    }
    const moveMs=dbg.on ? performance.now()-tMove : 0;
    const shouldDraw=shouldRenderGarden(t);
    if (shouldDraw){
      // glass governor samples frame SPACING, but only while the user is
      // actively interacting — idle frames run at a deliberate 30fps cadence
      // and would read as jank.
      if (hasTransientGardenWork() || t-lastMeaningfulChange<IDLE_GRACE_MS) updateGlassMode(dt);
      if (dbg.on) dbg.acc.move=(dbg.acc.move||0)+moveMs;
      render(t);                                   // render adds its own phase marks
      lastGardenRender=t;
      const tHud=dnow(); updateHUD(); lastHudUpdate=t; dmark('hud',tHud);
      dmark('frame',tFrame);
      if (dbg.on){ dbg.n++;
        if (t-dbg.fpsAt>=500){ dbg.fps=dbg.n*1000/(t-dbg.fpsAt); updateDebugHud(); dbg.fpsAt=t; dbgReset(); } }
    } else if (t-lastHudUpdate>=HUD_IDLE_MS){
      updateHUD(); lastHudUpdate=t;
    }
  } else if (t-lastMenuRender>=MENU_FRAME_MS){
    menuRender(t);
    lastMenuRender=t;
  }
  requestAnimationFrame(loop);
}
(async function init(){
  await ensurePlayerId();
  if (hasStorage){
    const c=await sGet('hortus:char'); if (c) game.char=c;
    const r=await sGet('hortus:region'); if (r) game.region=r;
  }
  updateRegionBtn();
  advanceMenuSeason();
  refreshMenuCards();
  if (location.search.includes('debug')) toggleDebug();
  if (location.search.includes('noglass')){ GLASS.off=true; document.body.classList.add('no-glass'); }
  requestAnimationFrame(loop);
})();
