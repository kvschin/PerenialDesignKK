'use strict';

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
  const c=todaysChallenge(); game.challenge=c;
  const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  setWorldSize(ftToTiles(rnd(40,100)), ftToTiles(rnd(40,100)));
  game.worldId=newWorldId();
  game.worldName=`Daily: "${c.title}"`;
  game.inGarden=true;
  game.previewMode='established';
  game.layerVis=defaultLayerVis(); game.underlay=null; game.photoEditing=false;
  game.rot=0; game.siteNorthDeg=0; game.siteNorthPreviewDeg=null;
  game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.boulders={}; game.pets={}; game.pots={}; game.seats={}; game.freePlanting=false;
  game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'}; game.boulderDraft={type:'round1'}; game.petDraft=normalizePetDraft();
  game.houses=[]; game.houseDraft=defaultDraft();
  markGroundChanged({terrain:true});
  game.edgeStyle='organic';                               // daily challenges default to naturalistic edges
  const prior=normalizeFilters(game.filters), zone=prior.zone||6; // keep zone/region, drop eligibility limits
  game.design={zone,type:'any',nativeRegion:prior.nativeRegion,nativeMode:'any',deer:false,rabbit:false,squirrel:false};
  game.filters=normalizeFilters(game.design); updateFilterBtn();
  enterGarden();
  game.trayCat=firstStockedTrayCat(); buildToolTray();   // open on a populated sub-tab for this prompt
  saveSolo(true);
}

async function refreshMenuCards(){
  const dc=$('btnDaily'); if (dc) dc.querySelector('small').textContent='Today · '+todaysChallenge().title;
  const g=$('btnDesign'); if (!g) return;
  const idx=hasStorage ? await migrateLegacyWorld() : [];
  g.querySelector('small').textContent=idx.length
    ? `${idx.length} saved garden${idx.length>1?'s':''} — continue or start another`
    : 'Design your first planting';
}

$('btnDesign').onclick=openWorlds;
$('btnDaily').onclick=openDaily;
$('btnDailyStart').onclick=startDailyChallenge;
$('btnLibrary').onclick=openLibrary;
// btnGardens is gone: it ran this same handler, so each label was wrong in one
// of the two states the shared screen has.
$('btnLibraryClose').onclick=()=>show('menuScreen');
$('librarySearch').oninput=applyLibrarySearch;

/* Worlds-list thumbnails: a tiny top-down map drawn straight from the save
   blob — always current (no stored screenshot to go stale), zero localStorage,
   and it works retroactively for every existing save. Grass checker + terrain
   fills reuse the real color tables; plants are foliage-colored dots (woody
   bigger), houses are wall/roof blocks. Cheap: one pass at list-open time. */
// Point-in-polygon test against a SAVED garden's OWN shape — never the live
// mask (game.plotShape/onPlot), since a worlds-list row's blob may not be the
// currently loaded garden. Mirrors rebuildPlotMask/onPlot exactly, just
// parameterized off the blob instead of the live globals.
function blobOnPlot(x,y,gw,gh,shape){
  if (x<0||y<0||x>=gw||y>=gh) return false;
  return shape ? polygonContains(x+0.5,y+0.5,shape) : true;
}
function drawWorldThumb(cvs, s){
  const g=cvs.getContext('2d'); if (!g) return;
  const gw=s.gw||s.grid||31, gh=s.gh||s.grid||31;
  const shape=Array.isArray(s.plotShape)?s.plotShape:null;
  const W=cvs.width, H=cvs.height;
  const sc=Math.min(W/gw, H/gh), ox=(W-gw*sc)/2, oy=(H-gh*sc)/2;
  const amb=AMBIENCE.Summer;
  g.clearRect(0,0,W,H);   // odd-aspect plots show the .world-thumb css mat
  if (sc>=1.6){                                   // checker reads only when tiles have pixels
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
      if (!blobOnPlot(x,y,gw,gh,shape)) continue;
      g.fillStyle=amb.grass[(x+y)%2];
      g.fillRect(ox+x*sc, oy+y*sc, sc+0.5, sc+0.5);
    }
  } else { g.fillStyle=amb.grass[0]; g.fillRect(ox,oy,gw*sc,gh*sc); }
  const terr=s.terrain||{};
  for (const k in terr){ const t=terr[k]; if (!t || t.removed) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (x<0||y<0||x>=gw||y>=gh) continue;
    g.fillStyle = t.k==='water' ? waterFill(t,false)
      : t.k==='path' ? pathFill(t,false) : bedFill(t,amb);
    g.fillRect(ox+x*sc, oy+y*sc, sc+0.5, sc+0.5);
  }
  const houses=Array.isArray(s.houses)?s.houses:(s.house?[s.house]:[]);
  const buildings=Array.isArray(s.buildings)?s.buildings:[];
  for (const b of buildings){
    if (!b || !Array.isArray(b.vertices) || b.vertices.length<3) continue;
    g.save(); g.fillStyle=(b.roof||'#9a5f3a')+(b.status==='proposed'?'88':'cc');
    g.strokeStyle=b.status==='proposed'?'#d79b55':'#3f3329'; g.lineWidth=Math.max(1,sc*.35);
    if (b.status==='proposed') g.setLineDash([2,1]);
    g.beginPath(); b.vertices.forEach(([x,y],i)=>{ if (i) g.lineTo(ox+x*sc,oy+y*sc); else g.moveTo(ox+x*sc,oy+y*sc); }); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  for (const hh of houses){ if (!hh) continue;
    g.fillStyle=hh.wall||'#8a7a60';
    g.fillRect(ox+hh.x*sc, oy+hh.y*sc, (hh.w||2)*sc, (hh.h||2)*sc);
    g.fillStyle=hh.roof||'#9a5f3a';
    g.fillRect(ox+hh.x*sc, oy+hh.y*sc, (hh.w||2)*sc, (hh.h||2)*sc*0.45);
  }
  const dots=(map,woodyBoost)=>{
    for (const k in (map||{})){ const p=map[k]; if (!p || p.removed || !p.s) continue;
      const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
      if (x<0||y<0||x>=gw||y>=gh) continue;
      let P=null; try{ P=plantDef(p.s,p.v); }catch(e){}
      if (!P || !P.sea) continue;
      const S=P.sea.Summer||P.sea.Spring||P.sea.Fall||P.sea.Winter||{};
      const woody=isWoodyDef(P);
      g.fillStyle=S.fol||S.bloom||S.seed||'#6f8f5a';
      const r=Math.max(woody?2:1, sc*(woody?(woodyBoost||1.3):0.5));
      g.beginPath(); g.arc(ox+(x+0.5)*sc, oy+(y+0.5)*sc, r, 0, 7); g.fill();
    }
  };
  dots(s.plants,1.3); dots(s.bulbs,0.5);
  g.strokeStyle='rgba(239,230,211,0.25)'; g.lineWidth=1;
  g.strokeRect(ox+0.5,oy+0.5,gw*sc-1,gh*sc-1);
}
// live plant count + the garden's own season, from a save blob (pure — the
// worlds list shows it so a row answers "which garden was this?" unopened).
// The counts read the top-level maps, which are the ACTIVE planting scheme —
// so a row describes the scheme you left the garden in, and `schemes` just
// says how many others are waiting inside.
function worldSaveMeta(s){
  let plants=0;
  for (const k in (s.plants||{})) if (s.plants[k] && !s.plants[k].removed) plants++;
  for (const k in (s.bulbs||{}))  if (s.bulbs[k]  && !s.bulbs[k].removed)  plants++;
  const day=Math.floor((s.elapsedMs||0)/DAY_MS)+(s.dayOffset||0);
  const yearDays=DAYS_PER_SEASON*4;
  const season=SEASONS[Math.floor((((day%yearDays)+yearDays)%yearDays)/DAYS_PER_SEASON)];
  const schemes=(s.schemes && Array.isArray(s.schemes.list)) ? s.schemes.list.length : 1;
  return {plants, season, schemes};
}
function startNewGarden(){
  game.discovery=defaultDiscovery(); openDesignSetup();
}
async function openWorlds(){
  await migrateLegacyWorld();
  /* Reconcile before listing: a garden stored without an index row is invisible
     here and still eating the device's quota, and this screen is the only place
     that can hand it back. Normally finds nothing and costs one key scan. */
  const recovered=await adoptOrphanedWorlds();
  const idx=await worldsIndex();
  $('worldsTitle').textContent='Your gardens';
  /* An empty list SHOWS this screen rather than skipping it. Bouncing straight
     into the questionnaire hid "Import a garden" — the only import control in
     the app — behind a screen a fresh device never reached, so a garden a
     friend shared could not be opened by the person it was sent to. */
  $('worldsSub').textContent=idx.length
    ? 'Continue a planting plan, or start a new one.'
    : 'Nothing planted yet. Start a garden, or import one someone shared with you.';
  $('btnNewWorld').textContent='Design a new garden';
  const list=$('worldList'); list.innerHTML='';
  idx.sort((a,b)=>b.ts-a.ts).forEach(w=>{
    const row=document.createElement('button'); row.className='world-row';
    const thumb=document.createElement('canvas'); thumb.className='world-thumb';
    thumb.width=168; thumb.height=126;   // 2x the CSS box, crisp on retina
    const info=document.createElement('span'); info.style.flex='1'; info.style.minWidth='0';
    const nm=document.createElement('span'); nm.className='wname'; nm.textContent=w.name||'My garden';
    const meta=document.createElement('span'); meta.className='meta';
    meta.textContent=`${Math.round((w.gw||31)*1.5)} × ${Math.round((w.gh||31)*1.5)} ft · ${new Date(w.ts).toLocaleDateString()}`;
    info.append(nm,document.createElement('br'),meta);
    // the save blob fills in the picture + living details (async, per row)
    sGet('hortus:world:'+w.id).then(s=>{
      if (!s) return;
      drawWorldThumb(thumb,s);
      const m=worldSaveMeta(s);
      meta.textContent+=` · ${m.plants} plant${m.plants===1?'':'s'} · ${m.season}`;
      if (m.schemes>1) meta.textContent+=` · ${m.schemes} schemes`;
    });
    const dup=document.createElement('button'); dup.className='world-dup'; dup.textContent='Duplicate';
    dup.title='Make a separate copy of this garden';
    dup.onclick=e=>{ e.stopPropagation(); duplicateWorld(w.id); };
    const del=document.createElement('button'); del.className='world-del'; setUiIcon(del,'trash');
    del.title='Delete this garden'; del.setAttribute('aria-label',`Delete ${w.name||'this garden'}`);
    del.onclick=e=>{ e.stopPropagation();
      if (del.dataset.arm){ deleteWorld(w.id); }
      else { del.dataset.arm='1'; del.textContent='Sure?'; } };
    row.append(thumb,info,dup,del);
    row.onclick=()=>enterWorld(w.id);
    list.appendChild(row);
  });
  show('worldsScreen');
  // Say so, rather than silently growing the list by one.
  if (recovered.length) toast(recovered.length===1
    ? `Recovered "${recovered[0]}" — it had lost its place in this list.`
    : `Recovered ${recovered.length} gardens that had lost their place in this list.`);
}
async function enterWorld(id){
  game.worldId=id; game.inGarden=true;
  if (!(await loadSolo(id))){ toast('That garden failed to load.'); game.inGarden=false; return; }
  funnel(FUNNEL_EVENTS.gardenOpened);
  enterGarden();
}
/* share-a-file: a garden is just a JSON blob, so export it to a file a friend
   can import (no backend). Export wraps the stored world in a small envelope;
   import validates the envelope, writes it as a fresh local world, and lists
   it so it can be opened. */
async function shareCurrentGarden(){
  closeOverlay('gardenMenu');
  if (!game.inGarden || !game.worldId){ toast('Save the garden first, then share it.'); return; }
  await saveSolo(true);                               // store the latest
  const w=await sGet('hortus:world:'+game.worldId);
  if (!w){ toast('That garden could not be read.'); return; }
  const env=JSON.stringify({ pocketPrairie:1, v:1, exported:Date.now(), world:w });
  const fname=((game.worldName||w.name||'garden').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase())||'garden';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([env],{type:'application/json'}));
  a.download=fname+'.prairie.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  funnel(FUNNEL_EVENTS.gardenShared);
  toast('Garden file downloaded — send it to a friend to share.');
}
/* One validator and one writer for every garden that arrives from outside this
   device — a friend's exported file and the bundled demo garden are the same
   envelope, so they should not be able to disagree about what a valid garden is.
   Returns the new slot id, or null if the envelope is not one of ours. */
async function installWorldBlob(env, name){
  const w = env && env.pocketPrairie && env.world;
  if (!w || typeof w!=='object' || typeof w.plants!=='object') return null;
  /* Mint, store the blob, and add the row as ONE critical section. The id is
     minted against a fresh index (this writes a whole garden to
     hortus:world:<id>, so a repeat would overwrite one), and the row cannot be
     lost to a concurrent write. */
  let id=null;
  await updateWorldsIndex(async fresh=>{
    id=newWorldId(new Set(fresh.map(x=>x.id)));
    w.name=name;
    if (!(await sSet('hortus:world:'+id, w))){ id=null; return null; }
    const out=fresh.filter(x=>x.id!==id);
    out.push({ id, name:w.name, ts:Date.now(), gw:w.gw||31, gh:w.gh||31, mode:'design' });
    return out;
  });
  return id;
}
function importWorldFile(file){
  if (!file) return;
  const reader=new FileReader();
  reader.onload=async()=>{
    let env; try{ env=JSON.parse(reader.result); }catch(e){ toast('That file is not a garden.'); return; }
    const raw=(env && env.world && env.world.name)||'Shared garden';
    const id=await installWorldBlob(env, raw.replace(/ \(shared\)$/,'')+' (shared)');
    if (!id){ toast('That does not look like a Pocket Prairie garden.'); return; }
    toast(`Imported "${raw.replace(/ \(shared\)$/,'')} (shared)". Open it below.`);
    openWorlds();
  };
  reader.readAsText(file);
}
/* The demo garden ships as an ordinary exported garden file. That is the whole
   trick: it needs no bundled format, no separate loader and no seeding code —
   it is authored IN the app, exported, and committed, so replacing it is a
   design job rather than a programming one. See docs/demo-garden.md. */
async function openDemoGarden(){
  let env;
  try{
    const res=await fetch('demo-garden.json',{cache:'no-cache'});
    if (!res.ok) throw new Error('HTTP '+res.status);
    env=await res.json();
  }catch(e){
    noteError(e,'demo-garden');
    toast('The demo garden could not be opened. Start a garden from the menu instead.');
    return false;
  }
  const id=await installWorldBlob(env,'Demo garden');
  if (!id){
    toast('The demo garden could not be opened. Start a garden from the menu instead.');
    return false;
  }
  await enterWorld(id);                 // same path the worlds list uses
  return true;
}
async function deleteWorld(id){
  await updateWorldsIndex(fresh=>fresh.filter(w=>w.id!==id));
  await sDel('hortus:world:'+id);       // reclaims the quota in whichever home it sits
  openWorlds();
}
async function duplicateWorld(id){
  const src=await sGet('hortus:world:'+id);
  if (!src){ toast('That garden could not be duplicated.'); return; }
  const copy=JSON.parse(JSON.stringify(src));
  const base=(copy.name||'My garden').replace(/ copy(?: \d+)?$/i,'');
  /* Duplicate is the one control a gardener can realistically double-tap, so
     the whole operation — the sibling-name count, the id, the blob and the row
     — runs against a single fresh read. Reading names outside this section is
     what made two rapid duplicates come out identically titled. */
  let name=null;
  await updateWorldsIndex(async fresh=>{
    const siblingNames=new Set(fresh.map(w=>(w.name||'').toLowerCase()));
    name=base+' copy';
    for (let n=2; siblingNames.has(name.toLowerCase()); n++) name=`${base} copy ${n}`;
    const newIdv=newWorldId(new Set(fresh.map(w=>w.id)));
    copy.name=name;
    copy.savedAt=Date.now();
    if (!(await sSet('hortus:world:'+newIdv,copy))){ name=null; return null; }
    const next=fresh.filter(w=>w.id!==newIdv);
    next.push({id:newIdv,name,ts:Date.now(),gw:copy.gw||copy.grid||31,gh:copy.gh||copy.grid||31,
      mode:'design'});
    return next;
  });
  if (!name){ toast('That garden could not be duplicated.'); return; }
  toast(`Duplicated "${base}".`);
  openWorlds();
}
$('btnNewWorld').onclick=startNewGarden;
if ($('btnImport')) $('btnImport').onclick=()=>$('importFile').click();
if ($('importFile')) $('importFile').onchange=e=>{ importWorldFile(e.target.files&&e.target.files[0]); e.target.value=''; };
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ show('menuScreen'); });

function enterGarden(){
  show(''); $('hud').classList.remove('hidden');
  cnv.classList.remove('hidden'); mcnv.classList.add('hidden');
  setActiveCanvas(cnv);
  setViewportFill('#4b5044');
  resetSelectionState();
  game.ruler=null;
  resetSeasonFade();   // never crossfade from a previous garden's last frame
  game.tool='hand'; game.toolVar=null; game.clockSuspended=false; game.startTs=Date.now();
  game.previewMode=game.previewMode||'established';
  game.woodyAge='mature';                       // designers plan around existing/mature trees
  game.pausedAt=Date.now();                     // a planner opens with the clock held
  document.body.classList.add('design-mode');
  userZoom=1; calcZoom();
  let groundReset=false;
  if (!Array.isArray(game.houses)){ game.houses=[]; groundReset=true; }
  if (!game.elevation){ game.elevation={}; groundReset=true; }
  if (!game.fences) game.fences={};
  if (!game.lights) game.lights={};
  if (!game.firepits) game.firepits={};
  if (!game.boulders) game.boulders={};
  if (!game.pets) game.pets={};
  if (!game.pots) game.pots={};
  if (!game.seats) game.seats={};
  if (!game.buildings) game.buildings=[];
  ensureSchemes();   // every garden runs on at least one planting scheme
  if (!game.houseDraft) game.houseDraft=draftFromHouses();
  game.buildingDraft=null;
  game.buildingStyleDraft=normalizeBuildingStyle(game.buildingStyleDraft);
  game.fenceDraft=normalizeFenceDraft(game.fenceDraft);
  game.lightDraft=normalizeLightDraft(game.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(game.firepitDraft);
  game.boulderDraft=normalizeBoulderDraft(game.boulderDraft);
  game.petDraft=normalizePetDraft(game.petDraft);
  game.edgeStyle=edgeStyleId(game.edgeStyle);
  game.bedStyle=bedStyleId(game.bedStyle);
  game.actX=SPAWNX; game.actY=SPAWNY;   // free camera centred on the plot
  snapCam();
  if (groundReset) markGroundChanged();
  game.lastDay=absDay();
  undoStack=[]; redoStack=[]; updateUndoBtn();
  buildToolTray();
  buildCanvasTools();
  updateCompass();
  syncHapticsButton(); syncHandednessButton(); syncThemeButton();
  $('worldLabel').textContent = game.worldName||'My garden';
  if (game.challenge)
    setTimeout(()=>{ if (game.challenge){
      const n=challengePaletteSize(game.challenge), total=speciesCount();
      const pal = n<total ? `${n} of ${total} plants fit this challenge` : 'full palette — design freely';
      toast(`${game.challenge.title} — ${pal}.`);
    } }, 450);
  // Beat 1. The time coach used to fire here too, 900ms in; it is beat 3 now
  // and waits until there is a planting worth running a year over.
  setTimeout(coachBeatEnter,900);
}
/* the plot screen: size a brand-new solo garden in real feet */
const PLOT_PRESETS=[['Classic',46,46],['1/10 acre',66,66],['1/5 acre',93,93],['1/4 acre',104,104]];
const FT_MIN=24, FT_MAX=200; // 16..134 tiles per side
let plotNorthDraft=0, siteNorthEditorContext=null, siteNorthEditorDraft=0;
function siteNorthEdgeName(value){
  const deg=normalizeSiteNorthDeg(value), names={0:'top',90:'right',180:'bottom',270:'left'};
  return names[deg]||null;
}
function siteNorthSummary(value){
  const deg=normalizeSiteNorthDeg(value), edge=siteNorthEdgeName(deg);
  return edge ? `North at ${edge} · ${deg}°` : `North · ${deg}° clockwise from top`;
}
function updatePlotNorthSummary(){
  const label=$('plotNorthLabel'), arrow=$('btnPlotNorth')&&$('btnPlotNorth').querySelector('.north-summary-arrow');
  if (label) label.textContent=siteNorthSummary(plotNorthDraft);
  if (arrow) arrow.style.setProperty('--north-deg',`${normalizeSiteNorthDeg(plotNorthDraft)}deg`);
}
function updateSiteNorthEditor(){
  const deg=normalizeSiteNorthDeg(siteNorthEditorDraft), edge=siteNorthEdgeName(deg);
  $('siteNorthRange').value=deg; $('siteNorthNumber').value=deg;
  $('siteNorthPreview').style.setProperty('--north-deg',`${deg}deg`);
  $('siteNorthReadout').textContent=edge
    ? `North points toward the ${edge} edge · ${deg}°.`
    : `North points ${deg} degrees clockwise from the top edge.`;
  document.querySelectorAll('[data-north-deg]').forEach(b=>{
    const on=+b.dataset.northDeg===deg; b.classList.toggle('sel',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function setSiteNorthEditorDraft(value){
  siteNorthEditorDraft=normalizeSiteNorthDeg(value);
  if (siteNorthEditorContext==='garden') previewSiteNorthDeg(siteNorthEditorDraft);
  updateSiteNorthEditor();
}
function openSiteNorthEditor(context){
  siteNorthEditorContext=context==='plot'?'plot':'garden';
  if (siteNorthEditorContext==='garden') clearSiteNorthPreview();
  siteNorthEditorDraft=siteNorthEditorContext==='plot'?plotNorthDraft:normalizeSiteNorthDeg(game.siteNorthDeg);
  updateSiteNorthEditor(); openOverlay('siteNorthScreen','#siteNorthRange');
}
function cancelSiteNorthEditor(){
  if (siteNorthEditorContext==='garden') clearSiteNorthPreview();
  siteNorthEditorContext=null; closeOverlay('siteNorthScreen');
}
function applySiteNorthEditor(){
  const context=siteNorthEditorContext;
  if (context==='plot'){
    plotNorthDraft=normalizeSiteNorthDeg(siteNorthEditorDraft); updatePlotNorthSummary();
    drawPlotShapeEditor();                    // the diagram's dial mirrors the applied bearing
  } else if (context==='garden'){
    const changed=setSiteNorthDeg(siteNorthEditorDraft);
    buildToolTray(); refreshCanvasTools();
    if (changed && game.inGarden) saveSolo(true);
    toast('North set. Sun and shade directions updated.');
  }
  siteNorthEditorContext=null; closeOverlay('siteNorthScreen');
}
function plotFt(id){ return Math.max(FT_MIN,Math.min(FT_MAX,+$(id).value||46)); }
/* ---------- lot-shape editor (plot setup) ----------
   A pending 4-corner shape drafted BEFORE the world exists — btnPlotStart
   applies it via setPlotShape only after setWorldSize (which always clears
   any shape). Pure helpers are top-level for the headless tests; validation
   mirrors setPlotShape's rules against the PENDING gw/gh, reusing the same
   plotEdgesCross/polygonContains the world-side validator uses. */
let pendingPlotShape=null, plotShapeDrag=null;
function defaultPlotShapeVerts(gw,gh){ return [[0,0],[gw,0],[gw,gh],[0,gh]]; }
function plotShapeSideLengthsFt(verts){
  return verts.map((v,i)=>{ const w=verts[(i+1)%verts.length];
    return Math.round(Math.hypot(w[0]-v[0],w[1]-v[1])*TILE_IN/12); });
}
function plotShapeSnap(px,py,gw,gh){
  return [Math.max(0,Math.min(gw,Math.round(px))), Math.max(0,Math.min(gh,Math.round(py)))];
}
function plotShapeQuadOk(verts,gw,gh){
  if (!Array.isArray(verts)||verts.length!==4) return false;
  if (verts.some(([x,y])=>x<0||y<0||x>gw||y>gh)) return false;
  if (plotEdgesCross(verts[0],verts[1],verts[2],verts[3])) return false;
  if (plotEdgesCross(verts[1],verts[2],verts[3],verts[0])) return false;
  let n=0;
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) if (polygonContains(x+0.5,y+0.5,verts)) n++;
  return n>=9;
}
function plotShapeIsRect(verts,gw,gh){
  const d=defaultPlotShapeVerts(gw,gh);
  return verts.every((v,i)=>v[0]===d[i][0]&&v[1]===d[i][1]);
}
function plotEdgeResizeTiles(axisVal){ // one axis of an edge-resize drag -> clamped whole tiles
  return Math.max(ftToTiles(FT_MIN), Math.min(ftToTiles(FT_MAX), Math.round(axisVal)));
}
function plotDialDeg(dx,dy){ // pointer offset from the dial center -> bearing, snapped to 5°
  const deg=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  return Math.round(deg/5)*5%360;
}
function plotShapeMetrics(){
  // asymmetric right pad keeps a gutter for the north dial so a wide plot's
  // corner handle never sits under it
  const cvs=$('plotShapeCanvas'), gw=ftToTiles(plotFt('plotW')), gh=ftToTiles(plotFt('plotL'));
  const cssW=cvs.clientWidth||300, cssH=cvs.clientHeight||236;
  const padL=30,padR=60,padT=30,padB=34;
  const sc=Math.min((cssW-padL-padR)/gw,(cssH-padT-padB)/gh);
  return {cvs,gw,gh,cssW,cssH,sc,
    ox:padL+((cssW-padL-padR)-gw*sc)/2, oy:padT+((cssH-padT-padB)-gh*sc)/2,
    dial:[cssW-28,30]};
}
function drawPlotShapeEditor(){
  const cvs=$('plotShapeCanvas');
  if (!cvs || !cvs.clientWidth) return;                  // plot screen not laid out
  // during a drag, draw with the metrics frozen at pointerdown so the fit
  // doesn't re-scale under the cursor while an edge resize changes the plot
  const m=(plotShapeDrag&&plotShapeDrag.m)||plotShapeMetrics();
  const {cssW,cssH,sc,ox,oy}=m;
  const gw=ftToTiles(plotFt('plotW')), gh=ftToTiles(plotFt('plotL'));
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if (cvs.width!==Math.round(cssW*dpr)||cvs.height!==Math.round(cssH*dpr)){
    cvs.width=Math.round(cssW*dpr); cvs.height=Math.round(cssH*dpr); }
  const g=cvs.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,cssW,cssH);
  const P=(v)=>[ox+v[0]*sc, oy+v[1]*sc];
  const verts=(plotShapeDrag&&plotShapeDrag.verts)||pendingPlotShape||defaultPlotShapeVerts(gw,gh);
  const invalid=!!(plotShapeDrag&&plotShapeDrag.type==='corner'&&!plotShapeDrag.valid);
  // bounding rectangle + a light tile grid every 4 tiles for scale
  g.strokeStyle='rgba(239,230,211,0.18)'; g.setLineDash([4,4]); g.lineWidth=1;
  g.strokeRect(ox,oy,gw*sc,gh*sc); g.setLineDash([]);
  g.strokeStyle='rgba(239,230,211,0.07)';
  for (let x=4;x<gw;x+=4){ g.beginPath(); g.moveTo(ox+x*sc,oy); g.lineTo(ox+x*sc,oy+gh*sc); g.stroke(); }
  for (let y=4;y<gh;y+=4){ g.beginPath(); g.moveTo(ox,oy+y*sc); g.lineTo(ox+gw*sc,oy+y*sc); g.stroke(); }
  // the lot itself
  g.beginPath(); verts.forEach((v,i)=>{ const [x,y]=P(v); i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath();
  g.fillStyle=invalid?'rgba(166,64,48,0.16)':'rgba(111,143,90,0.28)'; g.fill();
  g.strokeStyle=invalid?'rgba(236,118,92,0.9)':'rgba(239,230,211,0.75)'; g.lineWidth=1.6; g.stroke();
  // per-side lengths in feet, held just outside each edge's midpoint
  const fts=plotShapeSideLengthsFt(verts);
  g.font='11px IBM Plex Sans, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  for (let i=0;i<4;i++){
    const a=P(verts[i]), b=P(verts[(i+1)%4]);
    const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1;
    const nx=dy/len, ny=-dx/len;               // outward for clockwise winding
    const lx=mx+nx*13, ly=my+ny*13;
    g.strokeStyle=uiInk('--icon-halo'); g.lineWidth=3; g.strokeText(fts[i]+' ft',lx,ly);
    g.fillStyle=uiInk('--icon-ink'); g.fillText(fts[i]+' ft',lx,ly);
  }
  // edge-resize handles: small squares at the right/bottom box midpoints —
  // squares resize the plot, circles shape it
  [[gw,gh/2],[gw/2,gh]].forEach((v,i)=>{ const [x,y]=P(v);
    const hot=plotShapeDrag&&plotShapeDrag.type==='edge'&&plotShapeDrag.edge===i;
    g.fillStyle=hot?'#e9c07a':'rgba(218,165,74,0.85)';
    g.strokeStyle='rgba(20,14,11,0.8)'; g.lineWidth=1.5;
    g.beginPath(); g.rect(x-5.5,y-5.5,11,11); g.fill(); g.stroke(); });
  // corner handles (shape)
  verts.forEach((v,i)=>{ const [x,y]=P(v);
    const hot=plotShapeDrag&&plotShapeDrag.type==='corner'&&plotShapeDrag.i===i;
    g.beginPath(); g.arc(x,y,7,0,7);
    g.fillStyle=hot?'#e9c07a':'#daa54a'; g.fill();
    g.strokeStyle='rgba(20,14,11,0.8)'; g.lineWidth=1.5; g.stroke(); });
  // the north DIAL: drag to rotate the site bearing, tap for the fine dialog
  const deg=(typeof normalizeSiteNorthDeg==='function'?normalizeSiteNorthDeg(plotNorthDraft):0);
  const [dcx,dcy]=m.dial, hotDial=plotShapeDrag&&plotShapeDrag.type==='dial';
  g.beginPath(); g.arc(dcx,dcy,14,0,7);
  g.fillStyle='rgba(20,14,11,0.55)';
  g.strokeStyle=hotDial?'#e9c07a':uiInk('--icon-ink-dim'); g.lineWidth=hotDial?2:1.2;
  g.fill(); g.stroke();
  g.save(); g.translate(dcx,dcy); g.rotate(deg*Math.PI/180);
  g.strokeStyle='#efe6d3'; g.lineWidth=1.7; g.lineCap='round';
  g.beginPath(); g.moveTo(0,8); g.lineTo(0,-6); g.stroke();
  g.beginPath(); g.moveTo(-3.5,-2); g.lineTo(0,-8); g.lineTo(3.5,-2); g.stroke();
  g.restore();
  g.fillStyle='rgba(239,230,211,0.85)'; g.font='9px IBM Plex Sans, sans-serif';
  g.textAlign='center';
  g.fillText('N',dcx,dcy+22);
  g.fillText(deg+'°',dcx,dcy+33);
}
function setPlotShapeHint(text){
  const hint=$('plotShapeHint');
  if (hint) hint.textContent=text||'Drag a corner. Side lengths are real feet.';
}
function resetPendingPlotShape(fromResize){
  const had=!!pendingPlotShape;
  pendingPlotShape=null; plotShapeDrag=null;
  if (had && fromResize) setPlotShapeHint('Plot resized — shape reset.');
  drawPlotShapeEditor();
}
function wirePlotShapeEditor(){
  const cvs=$('plotShapeCanvas'); if (!cvs) return;
  $('btnPlotShapeReset').onclick=()=>{ resetPendingPlotShape(false); setPlotShapeHint('Back to a full rectangle.'); };
  const pos=(e)=>{ const r=cvs.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; };
  cvs.addEventListener('pointerdown',e=>{
    const m=plotShapeMetrics(), [px,py]=pos(e);
    const verts=pendingPlotShape||defaultPlotShapeVerts(m.gw,m.gh);
    // hit priority: shape corners, then edge-resize squares, then the dial
    let best=-1, bestD=24;                     // generous touch targets throughout
    verts.forEach((v,i)=>{ const d=Math.hypot(px-(m.ox+v[0]*m.sc), py-(m.oy+v[1]*m.sc));
      if (d<bestD){ bestD=d; best=i; } });
    if (best>=0){
      plotShapeDrag={type:'corner', i:best, m, verts:verts.map(v=>v.slice()), last:verts.map(v=>v.slice()), valid:true};
    } else {
      let eBest=-1, eD=22;
      [[m.gw,m.gh/2],[m.gw/2,m.gh]].forEach((v,i)=>{
        const d=Math.hypot(px-(m.ox+v[0]*m.sc), py-(m.oy+v[1]*m.sc));
        if (d<eD){ eD=d; eBest=i; } });
      if (eBest>=0){
        if (pendingPlotShape){ pendingPlotShape=null; setPlotShapeHint('Plot resized — shape reset.'); }
        plotShapeDrag={type:'edge', edge:eBest, m};
      } else if (Math.hypot(px-m.dial[0],py-m.dial[1])<=22){
        plotShapeDrag={type:'dial', m, moved:false};
      } else return;
    }
    e.preventDefault();
    cvs.setPointerCapture(e.pointerId);
    drawPlotShapeEditor();
  });
  cvs.addEventListener('pointermove',e=>{
    const d=plotShapeDrag; if (!d) return;
    e.preventDefault();
    const m=d.m, [px,py]=pos(e);
    if (d.type==='corner'){
      d.verts[d.i]=plotShapeSnap((px-m.ox)/m.sc,(py-m.oy)/m.sc,m.gw,m.gh);
      d.valid=plotShapeQuadOk(d.verts,m.gw,m.gh);
      if (d.valid){ d.last=d.verts.map(v=>v.slice()); setPlotShapeHint(); }
      else {
        const bow=plotEdgesCross(d.verts[0],d.verts[1],d.verts[2],d.verts[3])
          || plotEdgesCross(d.verts[1],d.verts[2],d.verts[3],d.verts[0]);
        setPlotShapeHint(bow?"Corners can't cross.":'Too small to garden.');
      }
    } else if (d.type==='edge'){
      // live-resize the plot: write the inputs (tile-snapped), keep the frozen
      // scale so the geometry doesn't chase the cursor; refit happens on release
      if (d.edge===0){
        const maxT=Math.floor((m.cssW-44-m.ox)/m.sc);
        const t=Math.min(plotEdgeResizeTiles((px-m.ox)/m.sc), Math.max(ftToTiles(FT_MIN),maxT));
        $('plotW').value=Math.round(t*TILE_IN/12);
      } else {
        const maxT=Math.floor((m.cssH-18-m.oy)/m.sc);
        const t=Math.min(plotEdgeResizeTiles((py-m.oy)/m.sc), Math.max(ftToTiles(FT_MIN),maxT));
        $('plotL').value=Math.round(t*TILE_IN/12);
      }
      updatePlotNote();
      document.querySelectorAll('#plotPresets .chip').forEach(c=>c.classList.remove('sel'));
    } else if (d.type==='dial'){
      const dx=px-m.dial[0], dy=py-m.dial[1];
      if (Math.hypot(dx,dy)>4){ d.moved=true; plotNorthDraft=plotDialDeg(dx,dy); }
    }
    drawPlotShapeEditor();
  });
  const finish=()=>{
    const d=plotShapeDrag; if (!d) return;
    plotShapeDrag=null;
    if (d.type==='corner'){
      const verts=d.valid?d.verts:d.last;
      pendingPlotShape=plotShapeIsRect(verts,d.m.gw,d.m.gh)?null:verts.map(v=>v.slice());
      setPlotShapeHint();
    } else if (d.type==='dial' && !d.moved){
      openSiteNorthEditor('plot');             // a plain tap opens the fine-tune dialog
    }
    drawPlotShapeEditor();                     // refits to any new size
  };
  cvs.addEventListener('pointerup',finish);
  cvs.addEventListener('pointercancel',finish);
}
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
      b.onclick=()=>{ $('plotW').value=w; $('plotL').value=l; updatePlotNote(); resetPendingPlotShape(true);
        row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('sel',c===b)); };
      row.appendChild(b);
    });
    $('plotW').oninput=$('plotL').oninput=()=>{ updatePlotNote(); resetPendingPlotShape(true);
      row.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel')); };
    wirePlotShapeEditor();
    $('btnPlotStart').onclick=()=>{
      setWorldSize(ftToTiles(plotFt('plotW')), ftToTiles(plotFt('plotL')));
      if (pendingPlotShape && !setPlotShape(pendingPlotShape))     // sized first — setWorldSize clears any shape
        toast('That lot shape was too tight — starting rectangular.');
      game.worldId=newWorldId();
      funnel(FUNNEL_EVENTS.gardenCreated);   // cleared the whole setup flow
      game.worldName=$('plotName').value.trim()||'My garden';
      game.rot=0; game.siteNorthDeg=normalizeSiteNorthDeg(plotNorthDraft); game.siteNorthPreviewDeg=null;
      game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
      game.layerVis=defaultLayerVis(); game.underlay=null; game.photoEditing=false;
      game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.boulders={}; game.pets={}; game.pots={}; game.seats={}; game.freePlanting=false;
      game.schemes=[]; game.schemeActive=null;   // a new plot starts with one (unnamed-by-default) planting scheme
      game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'}; game.boulderDraft={type:'round1'}; game.petDraft=normalizePetDraft();
      // naturalistic styles get smoothed bed/path edges; structured styles stay crisp
      game.edgeStyle=edgeStyleFromType(game.design&&game.design.type);
      // a blank plot: no house, nothing planted, the whole site yours to draw
      game.inGarden=true; game.previewMode='established';
      game.houses=[]; game.buildings=[]; game.buildingDraft=null;
      game.buildingStyleDraft=normalizeBuildingStyle();
      markGroundChanged({terrain:true}); game.houseDraft=defaultDraft();
      enterGarden();
      saveSolo(true); // claim the slot right away
    };
    $('btnPlotBack').onclick=openDesignSetup;
  }
  $('plotW').value=46; $('plotL').value=46; $('plotName').value=''; plotNorthDraft=0; updatePlotNorthSummary(); updatePlotNote();
  pendingPlotShape=null; plotShapeDrag=null;               // every new plot starts rectangular
  setPlotShapeHint();
  show('plotScreen');
  drawPlotShapeEditor();                                   // canvas is measurable once shown
}

if ($('siteNorthRange')) $('siteNorthRange').oninput=e=>setSiteNorthEditorDraft(e.target.value);
if ($('siteNorthNumber')) $('siteNorthNumber').onchange=e=>setSiteNorthEditorDraft(e.target.value);
document.querySelectorAll('[data-north-deg]').forEach(b=>b.onclick=()=>setSiteNorthEditorDraft(b.dataset.northDeg));
if ($('btnSiteNorthCancel')) $('btnSiteNorthCancel').onclick=cancelSiteNorthEditor;
if ($('btnSiteNorthApply')) $('btnSiteNorthApply').onclick=applySiteNorthEditor;
if ($('siteNorthScreen')) $('siteNorthScreen').onclick=e=>{ if (e.target===$('siteNorthScreen')) cancelSiteNorthEditor(); };

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
  const nativeDefaults=normalizeFilters(Object.keys(d).length?d:game.filters);
  const sel={zone:d.zone||6, type:d.type||'any',
    nativeRegion:nativeDefaults.nativeRegion, nativeMode:nativeDefaults.nativeMode,
    deer:!!d.deer, rabbit:!!d.rabbit, squirrel:!!d.squirrel, zoneHelp:false,
    startSource:activeDiscovery().source, startPaletteId:activeDiscovery().collectionId};
  const mkChip=(label,on,fn,extra)=>{ const b=document.createElement('button');
    b.type='button'; b.className='chip'+(extra?' '+extra:'')+(on?' sel':'');
    b.textContent=label; b.onclick=fn; return b; };
  const winterEl=$('dgnWinter'), zoneChipsEl=$('dgnZoneChips'), typeEl=$('dgnTypeChips'),
    consEl=$('dgnConstraints'), helpEl=$('dgnZoneHelp'), zoneToggle=$('dgnZoneToggle'), startEl=$('dgnStartPalette'),
    nativeModeEl=$('dgnNativeMode'), nativeRegionEl=$('dgnNativeRegion'), nativeRegionWrap=$('dgnNativeRegionWrap');
  const syncMeadow=()=>applyMeadowPalette(sel.type, sel.zone, sel);  // replant the backdrop to match
  function updateReadout(){
    $('dgnZoneOut').innerHTML=`<b>Zone ${sel.zone}</b> — winters bottom out near ${ZONE_LOWS[sel.zone]||'—'}. `+
      `We'll only offer plants that can take that.`;
  }
  function updateCount(){
    const n=paletteCount(sel);
    $('dgnCount').innerHTML=`<b>${n}</b> plant${n===1?'':'s'} fit this garden so far.`;
    renderStartPalette();
  }
  function setZone(z){
    sel.zone=Math.max(3,Math.min(9,z));
    renderZoneChips(); renderWinter(); updateReadout(); updateCount(); syncMeadow();
  }
  function renderWinter(){ winterEl.innerHTML='';
    WINTER_BANDS.forEach(([label,,z])=>winterEl.appendChild(mkChip(label,sel.zone===z,()=>setZone(z)))); }
  // zone chips are face up by default; "Don't know your zone?" flips to the ZIP
  // + winter-cold helper (which sets the same sel.zone, echoed by the readout).
  function renderZoneChips(){ zoneChipsEl.innerHTML='';
    for (let z=3;z<=9;z++) zoneChipsEl.appendChild(mkChip('Zone '+z,sel.zone===z,()=>setZone(z))); }
  function renderZoneMode(){
    zoneChipsEl.classList.toggle('hidden',sel.zoneHelp);
    helpEl.classList.toggle('hidden',!sel.zoneHelp);
    zoneToggle.textContent=sel.zoneHelp?'Back to zones':"Don't know your zone?";
  }
  function renderType(){ typeEl.innerHTML='';
    GARDEN_TYPES.forEach(([id,label])=>typeEl.appendChild(mkChip(label,sel.type===id,()=>{
      sel.type=id; renderType(); syncMeadow();
      renderStartPalette();
      $('dgnTypeNote').textContent=(GARDEN_TYPES.find(g=>g[0]===id)||[])[2]||''; })));
    $('dgnTypeNote').textContent=(GARDEN_TYPES.find(g=>g[0]===sel.type)||[])[2]||'';
  }
  function renderNative(){
    nativeModeEl.innerHTML='';
    NATIVE_MODES.forEach(mode=>{
      const on=sel.nativeMode===mode.id, b=mkChip(mode.id==='any'?'Any':mode.id==='regional'?'Regional':'Straight',on,()=>{
        sel.nativeMode=mode.id; renderNative(); updateCount(); syncMeadow();
      });
      b.setAttribute('role','radio'); b.setAttribute('aria-checked',on?'true':'false'); nativeModeEl.appendChild(b);
    });
    nativeRegionWrap.classList.toggle('hidden',sel.nativeMode==='any');
    nativeRegionEl.innerHTML='';
    NATIVE_REGIONS.filter(r=>r.selectable!==false).forEach(r=>{
      const o=document.createElement('option'); o.value=r.id; o.textContent=r.label; o.selected=r.id===sel.nativeRegion; nativeRegionEl.appendChild(o);
    });
    nativeRegionEl.onchange=()=>{ sel.nativeRegion=normalizeNativeRegion(nativeRegionEl.value); $('dgnNativeHint').textContent=nativeCriteriaText(sel); updateCount(); syncMeadow(); };
    $('dgnNativeHint').textContent=nativeCriteriaText(sel);
  }
  function renderConstraints(){ consEl.innerHTML='';
    const t=(label,key)=>consEl.appendChild(mkChip(label,sel[key],()=>{
      sel[key]=!sel[key]; renderConstraints(); updateCount(); },'toggle'));
    t('Deer resistant','deer'); t('Rabbit resistant','rabbit');
    t('Squirrel resistant bulbs','squirrel');
  }
  function selectionCount(refs){ return (refs||[]).filter(ref=>plantRefFitsCriteria(ref,sel)).length; }
  function startChoice(label,source,id,meta){ const b=document.createElement('button'); b.type='button';
    b.className='design-start-choice'+(sel.startSource===source&&sel.startPaletteId===(id||null)?' sel':'');
    const title=document.createElement('b'); title.textContent=label; const small=document.createElement('small'); small.textContent=meta; b.append(title,small);
    b.onclick=()=>{ sel.startSource=source; sel.startPaletteId=source==='palette'?id:null; renderStartPalette(); }; startEl.appendChild(b); }
  function renderStartPalette(){ if (!startEl) return; startEl.innerHTML='';
    startChoice('Recommended for '+designTypeName(sel.type),'recommended',null,`${paletteCount(sel)} plants available`);
    const favs=favoriteRefs(), available=selectionCount(favs); startChoice('Favorites','favorites',null,`${available} available / ${favs.length} saved`);
    const data=plantCollectionsData(); (data.palettes||[]).forEach(p=>{ const available=selectionCount(p.items); startChoice(p.name,'palette',p.id,`${available} available / ${p.items.length} saved`); }); }
  const zipEl=$('dgnZip'); zipEl.value='';
  zipEl.oninput=()=>{ const z=zoneFromZip(zipEl.value); if (z) setZone(z); };
  zoneToggle.onclick=()=>{ sel.zoneHelp=!sel.zoneHelp; renderZoneMode(); };
  renderWinter(); renderZoneChips(); renderZoneMode(); renderType(); renderNative(); renderConstraints(); renderStartPalette();
  updateReadout(); updateCount();
  syncMeadow();   // replant the backdrop for the initial style/zone
  $('btnDesignNext').onclick=()=>{
    game.design={zone:sel.zone, type:sel.type, nativeRegion:sel.nativeRegion, nativeMode:sel.nativeMode,
      deer:sel.deer, rabbit:sel.rabbit, squirrel:sel.squirrel};
    // tune the live palette: filters apply, style ranks the tray
    game.filters=normalizeFilters({zone:sel.zone, nativeRegion:sel.nativeRegion, nativeMode:sel.nativeMode,
      deer:sel.deer, rabbit:sel.rabbit, squirrel:sel.squirrel});
    game.discovery=normalizeDiscovery({source:sel.startSource,collectionId:sel.startPaletteId,category:null,query:'',colorFamilies:[],bloomSeasons:[],limit:36});
    sSet('hortus:filters',game.filters); updateFilterBtn();
    openPlotScreen();
  };
  $('btnDesignBack').onclick=()=>{ game.inGarden=false; show('menuScreen'); };
  show('designScreen');
}
function quitToMenu(){
  if (game.photoEditing) closeSitePhotoEdit(false);
  suspendClock();
  if (game.inGarden&&hasStorage) saveSolo();
  game.inGarden=false; game.pausedAt=0; game.clockSuspended=false;
  document.body.classList.remove('design-mode');
  closeOverlay('exportScreen',false); closeOverlay('discoveryFilterScreen',false); closeOverlay('paletteScreen',false);
  closeOverlay('planScreen',false); closeOverlay('bloomScreen',false);
  closeOverlay('pauseScreen',false);
  closeOverlay('gardenMenu',false);
  dismissCoachTip();
  $('hud').classList.add('hidden'); cnv.classList.add('hidden');
  mcnv.classList.remove('hidden');
  setActiveCanvas(mcnv);
  setMenuViewportFill();
  show('menuScreen');
}
function openGardenMenu(){
  syncHapticsButton(); syncHandednessButton(); syncThemeButton(); syncSchemeLabel();
  const gm=openOverlay('gardenMenu','#btnFilters');
  // anchor the dropdown right under the menu button, right-aligned to the action
  // bar — robust to the bar's height/width at any breakpoint
  const bar=$('actionBar').getBoundingClientRect(), p=gm.querySelector('.panel');
  if (p && bar.width){ p.style.top=(bar.bottom+6)+'px';
    p.style.right=Math.max(8,Math.round(innerWidth-bar.right))+'px'; }
}
$('btnMenu').onclick=openGardenMenu;
if ($('coachTipClose')) $('coachTipClose').onclick=dismissCoachTip;
// click the backdrop (anywhere off the panel) to dismiss, like any dropdown
$('gardenMenu').onclick=(e)=>{ if (e.target===$('gardenMenu')) closeOverlay('gardenMenu'); };
$('btnQuit').onclick=quitToMenu;
if ($('btnShare')) $('btnShare').onclick=shareCurrentGarden;
if ($('btnHaptics')) $('btnHaptics').onclick=()=>{
  const on=setHapticsEnabled(!hapticsOn); syncHapticsButton();
  if (on) hapticFeedback('success');
  toast(`Haptic feedback ${on?'on':'off'}.`);
};
if ($('btnHandedness')) $('btnHandedness').onclick=()=>{
  const on=setLeftHandedLayout(!leftHandedLayout,true); syncHandednessButton();
  toast(`Left-handed layout ${on?'on':'off'}.`);
};
if ($('btnTheme')) $('btnTheme').onclick=()=>{
  cycleThemePref(); syncThemeButton();
  toast(`Appearance: ${themeLabel()}.`);
};
$('btnGmClose').onclick=()=>closeOverlay('gardenMenu');
/* ---------- planting schemes: several plantings over one shared site plan ----------
   Creation lives here in the Garden Menu (an infrequent, garden-scoped action,
   beside Plant filters and Design plan); switching lives on the top-bar chip,
   which only exists once there is something to switch between. */
function syncSchemeLabel(){ hudText('schemeLbl',String(schemeCount())); }
function renderSchemeManager(){
  const list=$('schemeList'); if (!list) return;
  list.innerHTML='';
  const only=schemeCount()<2;
  schemeList().forEach(s=>{
    const on=s.id===game.schemeActive;
    const row=document.createElement('div'); row.className='scheme-row'+(on?' sel':'');
    const copy=document.createElement('span'); copy.className='scheme-row-copy';
    // rename in place: a text field inside a panel, like the plot and character
    // screens — a native prompt() would read as a stray browser dialog
    const nm=document.createElement('input'); nm.className='scheme-name'; nm.type='text';
    nm.value=s.name; nm.maxLength=32; nm.setAttribute('aria-label',`Name of ${s.name}`);
    nm.onchange=()=>{ if (renameScheme(s.id,nm.value)) syncSchemeLabel(); else nm.value=s.name; refreshCanvasTools(); };
    const meta=document.createElement('span'); meta.className='scheme-row-meta';
    // the active scheme's plants are live in game.plants; the others hold their own
    const maps=on?[game.plants,game.bulbs]:[s.plants,s.bulbs];
    let n=0; for (const m of maps) for (const k in (m||{})) if (m[k] && !m[k].removed) n++;
    meta.textContent=`${n} plant${n===1?'':'s'}${on?' · showing':''}`;
    copy.append(nm,meta);
    const pick=document.createElement('button'); pick.className='scheme-pick'; pick.type='button';
    pick.textContent=on?'Showing':'Show'; pick.disabled=on;
    pick.title=on?`${s.name} is showing`:`Show ${s.name}`;
    // close on the way out: you asked to look at this scheme, and the panel
    // (with its scrim) sits over the garden you are trying to look at. Repeated
    // A/B lives on the chip and the [ ] keys, so the manager is for setup.
    pick.onclick=()=>{ switchScheme(s.id); closeOverlay('schemeScreen'); };
    const del=document.createElement('button'); del.className='scheme-act danger'; del.type='button';
    del.textContent='Delete'; del.title=only?'A garden keeps at least one scheme':`Delete ${s.name}`;
    del.disabled=only;
    del.onclick=()=>showConfirm(`Delete "${s.name}"?`,
      'The plants in this scheme go with it. Your beds, paths and buildings are shared, so they stay.',
      'Delete scheme',
      ()=>{ if (deleteScheme(s.id)){ renderSchemeManager(); syncSchemeLabel(); } });
    row.append(copy,pick,del);
    list.appendChild(row);
  });
  const full=schemeCount()>=MAX_SCHEMES;
  $('btnSchemeNewEmpty').disabled=full;
  $('btnSchemeNewCopy').disabled=full;
  // "Duplicate from existing" copies the ACTIVE scheme; on a list of six that is
  // not obvious from the label, so name the source rather than rename the button
  $('btnSchemeNewCopy').title=`Copy "${activeSchemeName()}" into a new scheme`;
  $('schemeNote').textContent = full
    ? `A garden holds up to ${MAX_SCHEMES} planting schemes.`
    : `Duplicating copies "${activeSchemeName()}". Switch schemes from the chip beside the season box, or with [ and ].`;
  syncSchemeLabel();
}
function openSchemeManager(){
  closeOverlay('gardenMenu');
  ensureSchemes(); renderSchemeManager();
  openOverlay('schemeScreen','.scheme-pick');
}
if ($('btnSchemes')) $('btnSchemes').onclick=openSchemeManager;
if ($('btnSchemeClose')) $('btnSchemeClose').onclick=()=>closeOverlay('schemeScreen');
if ($('btnSchemeNewEmpty')) $('btnSchemeNewEmpty').onclick=()=>{ if (createScheme(false)) renderSchemeManager(); };
if ($('btnSchemeNewCopy')) $('btnSchemeNewCopy').onclick=()=>{ if (createScheme(true)) renderSchemeManager(); };
$('schemeScreen').onclick=(e)=>{ if (e.target===$('schemeScreen')) closeOverlay('schemeScreen'); };
/* no Save button: autosave covers day changes, quitting, and the tab
   being hidden or closed mid-session */
function autosaveNow(){ if (game.inGarden&&hasStorage){ saveSolo(true); game.dirty=false; } }
addEventListener('visibilitychange',()=>{
  if (document.hidden){ suspendClock(); autosaveNow(); }
  else { resumeClockSession(); updateHUD(); }
});
addEventListener('pagehide',()=>{ suspendClock(); autosaveNow(); });
if ($('btnDayNight')) $('btnDayNight').onclick=()=>{ setLayerVis('night',!game.layerVis.night);
  updateDayNightBtn(); refreshCanvasTools();
  toast(game.layerVis.night?'Night — your garden lighting switches on.':'Back to daylight.'); };
if ($('btnPause')) $('btnPause').onclick=toggleClock;
// the season box: hold to fast-forward time, tap to toggle the time menu.
// The box stays pressable while the menu is open (see openPause's z-lift),
// so a hold always fast-forwards — starting one dismisses the dropdown so
// the garden underneath is visible while time runs.
(function wireSeasonBox(){
  const box=$('btnSeasonBox'); if (!box) return;
  const HOLD_MS=360;
  let holdTimer=null, ffStarted=false, pressActive=false;
  const resetFF=()=>{
    const wasFast=ffStarted;
    if (holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
    game.ffActive=false; ffStarted=false;
    box.classList.remove('hold-arming','fast-forwarding');
    box.setAttribute('aria-label','Time — tap for controls, hold to fast-forward');
    return wasFast;
  };
  const cancelFF=()=>{ pressActive=false; resetFF(); };
  box.addEventListener('pointerdown',e=>{
    e.preventDefault(); dismissCoachTip(); resetFF(); pressActive=true;
    box.classList.add('hold-arming');
    try{ box.setPointerCapture(e.pointerId); }catch(_){ }
    holdTimer=setTimeout(()=>{
      holdTimer=null; game.ffActive=true; ffStarted=true; closePause();
      box.classList.remove('hold-arming'); box.classList.add('fast-forwarding');
      box.setAttribute('aria-label','Time — fast-forwarding while held');
      hapticFeedback('success');
    },HOLD_MS);
  });
  box.addEventListener('pointerup',()=>{
    if (!pressActive) return;
    pressActive=false;
    const wasFast=resetFF();
    if (!wasFast){
      if (!$('pauseScreen').classList.contains('hidden')) closePause();
      else openPause();
    }
  });
  box.addEventListener('pointerleave',cancelFF);
  box.addEventListener('pointercancel',cancelFF);
  box.addEventListener('lostpointercapture',()=>{ if (pressActive) cancelFF(); });
})();
// the menu's primary button now pauses or resumes, since the dial's Pause button is gone
$('btnPauseResume').onclick=()=>{ if (game.pausedAt) resumeClock(); else pauseClock(); closePause(); updateHUD(); };
// the time menu dismisses via a document-level outside-press listener
// (openPause/closePause in ui.js) — its backdrop is pointer-transparent so
// the season box keeps working while the menu is open
$('btnSkipSeason').onclick=skipNextSeason;   // skip straight away — no confirm
$('btnSkipYear').onclick=skipNextYear;
if ($('btnPreviewToday')) $('btnPreviewToday').onclick=()=>setPreviewMode('today');
if ($('btnPreviewEstablished')) $('btnPreviewEstablished').onclick=()=>setPreviewMode('established');
$('btnExport').onclick=()=>{ closeOverlay('gardenMenu'); openExport(); };
$('btnExportClose').onclick=()=>closeOverlay('exportScreen');
$('btnPrint').onclick=()=>window.print();
$('btnCsv').onclick=exportCsv;
$('btnFilters').onclick=()=>{ closeOverlay('gardenMenu'); openFilters(); };
if ($('btnDiscoveryApply')) $('btnDiscoveryApply').onclick=applyDiscoveryFilters;
if ($('btnDiscoveryClear')) $('btnDiscoveryClear').onclick=clearDiscoveryFilters;
if ($('btnDiscoveryClose')) $('btnDiscoveryClose').onclick=()=>{ discoveryFilterDraft=null; discoveryCriteriaDraft=null; closeOverlay('discoveryFilterScreen'); };
if ($('btnPaletteClose')) $('btnPaletteClose').onclick=()=>{ palettePendingRef=null; paletteRenameId=null; closeOverlay('paletteScreen'); };
if ($('btnPaletteCreate')) $('btnPaletteCreate').onclick=createPaletteFromInput;
if ($('paletteName')) $('paletteName').onkeydown=e=>{ if (e.key==='Enter'){ e.preventDefault(); createPaletteFromInput(); } };
if ($('btnRotate')) $('btnRotate').onclick=()=>rotateView(1);
$('btnPhoto').onclick=()=>{ closeOverlay('gardenMenu'); takePhoto(); };
$('btnPlan').onclick=()=>{ closeOverlay('gardenMenu'); openPlan(); };
$('btnPlanClose').onclick=()=>closeOverlay('planScreen');
$('btnPlanPng').onclick=downloadPlan;
$('btnPlanList').onclick=()=>{ closeOverlay('planScreen'); openExport(); };
$('btnBloom').onclick=()=>{ closeOverlay('gardenMenu'); openBloomCalendar(); };
$('btnBloomClose').onclick=()=>closeOverlay('bloomScreen');
$('btnAct').onclick=()=>{ if (ENABLE_MOBILE_ACT_BUTTON) actHere(); };
if ($('btnZoomOut')) $('btnZoomOut').onclick=()=>zoomBy(0.89);
if ($('btnZoomIn')) $('btnZoomIn').onclick=()=>zoomBy(1.12);
if ($('btnZoomFit')) $('btnZoomFit').onclick=()=>fitPlot();
if ($('btnCatalogClose')) $('btnCatalogClose').onclick=()=>setSheetState('collapsed');
(function wireSheetHandle(){
  const h=$('sheetHandle'); if (!h) return;
  const down=$('btnSheetDown'), up=$('btnSheetUp');
  let drag=null;
  h.addEventListener('pointerdown',e=>{
    if (e.target.closest && e.target.closest('.sheet-actions')) return;
    drag={y:e.clientY,moved:false};
    h.classList.add('dragging');
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
    h.classList.remove('dragging');
    if (moved && Math.abs(dy)>28) nudgeCatalogHandle(dy<0?1:-1);
    else nudgeCatalogHandle(normalizedSheetState(game.sheetState)==='collapsed'?1:-1);
  };
  h.addEventListener('pointerup',finish);
  h.addEventListener('pointercancel',()=>{ drag=null; h.classList.remove('dragging'); });
  if (down) down.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(-1); };
  if (up) up.onclick=e=>{ e.stopPropagation(); nudgeCatalogHandle(1); };
})();

/* ---------- menu background: a living meadow ---------- */
const mcnv=$('menuCanvas'), mcx=mcnv.getContext('2d');
setActiveCanvas(mcnv);
const MENU_SCENES={
  Spring:{
    sky:['#6f8795','#cfdac3','#1c1813'],
    glow:['rgba(202,213,132,.30)','rgba(96,132,78,.18)'],
    ground:'rgba(30,46,29,.30)', pageBg:'#1d1f16', alpha:.72, bloom:1,
    keys:['crocus','daffodil','muscari','camassia','baptisia','amsonia','sedge','karl']
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
function styleMeadowKeys(type, zone, criteria){
  if (!type || !STYLE_ROLE_WEIGHTS[type]) return null;
  const herb=k=>{ const t=PLANTS[k].type; return t==='grass'||t==='sedge'||t==='forb'||t==='bulb'; };
  const f=normalizeFilters(Object.assign({},criteria||{},{zone}));
  const fits=k=>!PLANTS[k].hidden && herb(k) && passesNativeFilter(PLANTS[k],f) &&
    (!zone || (PLANTS[k].zones[0]<=zone && PLANTS[k].zones[1]>=zone));
  const ranked=PLANT_KEYS.filter(fits)
    .map(k=>[k,plantStyleScore(k,type,null,f)]).filter(e=>e[1]>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>e[0]);
  return ranked.length>=4 ? ranked : null;
}
function applyMeadowPalette(type, zone, criteria){
  const keys=styleMeadowKeys(type,zone,criteria) || (MENU_SCENES[menuSeason]||MENU_SCENES.Fall).keys;
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
let prev=performance.now(), lastMenuRender=-Infinity, lastGardenRender=-Infinity, lastHudUpdate=0;
let lastMeaningfulChange=performance.now(), lastRenderSig='';

function markLoopActivity(){ lastMeaningfulChange=performance.now(); }
['pointerdown','pointermove','pointerup','wheel','keydown','keyup','touchstart','touchmove'].forEach(type=>
  addEventListener(type,markLoopActivity,{passive:true}));
function screenOpen(id){
  const el=document.getElementById(id);
  return !!el && !el.classList.contains('hidden');
}
function fullScreenRenderBlocked(){
  return screenOpen('libraryScreen') || screenOpen('planScreen') ||
    screenOpen('bloomScreen') || screenOpen('exportScreen');
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
    game.rev, game.groundRev, game.terrainRev, game.rot, effectiveSiteNorthDeg(), absDay(),
    GW, GH, VW, VH, ZOOM.toFixed(3), cam.x.toFixed(1), cam.y.toFixed(1),
    game.tool, game.toolVar||'', game.eraseMode, game.brushSize,
    game.previewMode, game.edgeStyle, layerVisibilitySig(),
    game.hoverTile?game.hoverTile.join(','):'', selectionSig(), rulerSig()
  ].join('|');
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
  return !!(game.ffActive || hasActiveGesture()
    || (game.fx&&game.fx.length) || (game.shrubFx&&game.shrubFx.length)
    || seasonFadeActive());   // the season crossfade needs live frames for ~1s
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
const dbg={on:false, el:null, fps:0, fpsAt:0, n:0, acc:{}, ents:0, tiles:0,
  ev:Object.create(null), gapLast:0, gapMax:0, gapOver:0, gapN:0, gapSusp:0,
  GAP_BUDGET:20, GAP_SUSPEND:250};
// Labelled phase timing with ~zero cost when off: dnow() reads the clock only
// while on; dmark folds the elapsed delta into a named accumulator; dtime wraps
// an ad-hoc call so any function can be timed (e.g. dtime('flood',()=>doFloodFill())).
function dnow(){ return dbg.on?performance.now():0; }
function dmark(label,t0){ if (dbg.on) dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t0); }
function dtime(label,fn){ if (!dbg.on) return fn(); const t=performance.now();
  try{ return fn(); } finally{ dbg.acc[label]=(dbg.acc[label]||0)+(performance.now()-t); } }
/* ---- EVENT timers: the costs a per-frame average cannot show ----
   The expensive work in this app is invalidation-triggered, not per-frame: a
   ground bake, a region trace, a scene rebuild, an undo snapshot. Folded into
   dbg.acc they are averaged over the ~500ms window and then reset, so a 70ms
   bake either smears into +2ms across 35 frames or misses the window entirely
   and reads 0.00 — which is exactly what the HUD showed while we were trying to
   find it. Events are therefore reported as last/max/count and deliberately
   SURVIVE dbgReset: the whole point is to catch something that happened once.
   dev allocates one record per LABEL, never per call. */
function dev(label,t0){
  if (!dbg.on) return 0;
  const ms=performance.now()-t0;
  let e=dbg.ev[label];
  if (!e) e=dbg.ev[label]={last:0,max:0,n:0,total:0};
  e.last=ms; e.n++; e.total+=ms;
  if (ms>e.max) e.max=ms;
  return ms;   // callers subtract a rare event out of the phase it sits inside
}
function devTime(label,fn){ if (!dbg.on) return fn(); const t=performance.now();
  try{ return fn(); } finally{ dev(label,t); } }
/* Real rAF spacing. The phase timers can sum to 3ms while frames land 30ms
   apart — GPU composite, backdrop-blur recomposite, GC and layout are all
   outside them. That gap is what the glass governor trips on and what nothing
   else could see. Fed the UNCLAMPED delta (loop's dt is capped at 50ms so a
   long stall would read as 50) and only on interaction frames, since the idle
   cadence is a deliberate 30fps and would otherwise read as constant jank. */
function dgap(raw){
  if (!dbg.on) return;
  dbg.gapLast=raw; dbg.gapN++;
  /* A backgrounded tab stops rAF entirely and the first frame back reports the
     whole hidden period as one gap — measured at 709ms and 1158ms in a session
     where the worst REAL stall was under 40ms. That is a suspend, not jank, and
     letting it set gapMax buries every genuine stall beneath it. Count them
     separately so the resume is still visible but cannot pollute the signal. */
  if (raw>dbg.GAP_SUSPEND){ dbg.gapSusp++; return; }
  if (raw>dbg.gapMax) dbg.gapMax=raw;
  if (raw>dbg.GAP_BUDGET) dbg.gapOver++;
}
function dbgReset(){ dbg.n=0; dbg.acc={}; }              // per-window phase averages
function devReset(){ dbg.ev=Object.create(null); dbg.gapMax=0; dbg.gapOver=0; dbg.gapN=0; dbg.gapSusp=0; }
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
  dbg.fpsAt=performance.now(); dbgReset(); devReset();   // each session starts on clean event stats
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
  // events: last/max/count, worst-max first. These persist across windows, so a
  // bake that happened three seconds ago is still on screen to be read.
  const evKeys=Object.keys(dbg.ev).sort((a,b)=>dbg.ev[b].max-dbg.ev[a].max);
  const evRows=evKeys.length
    ? '\nevents (last/max ×n)\n'+evKeys.map(k=>{ const e=dbg.ev[k];
        return `  ${k.padEnd(7)}${e.last.toFixed(1).padStart(6)}/${e.max.toFixed(1).padStart(6)}ms ×${e.n}`;
      }).join('\n')
    : '';
  const gap=dbg.gapN
    ? `\nspacing  last ${dbg.gapLast.toFixed(1)}ms  max ${dbg.gapMax.toFixed(1)}ms`+
      `  over-${dbg.GAP_BUDGET}ms ${dbg.gapOver}/${dbg.gapN}`+
      (dbg.gapSusp?`  (+${dbg.gapSusp} suspend)`:'')
    : '';
  dbg.el.textContent=
    `FPS ${(dbg.fps||0).toFixed(0)}   frame ${avg(total).toFixed(2)}ms  (${dbg.ents} ents, ${dbg.tiles} tiles)\n`+
    rows+evRows+gap+'\n'+
    `canvas ${c?c.width+'×'+c.height:'?'} (${mp}MP)  dpr ${devicePixelRatio}  zoom ${ZOOM.toFixed(2)}`+
    `  glass ${GLASS.off?'OFF':'on'} (${GLASS.ema.toFixed(1)}ms)`;
}
/* ---- debug-only: repeatable ground-bake benchmark ----
   Eyeballing the HUD cannot compare two builds: the bake fires on edit, the
   numbers move with window size and zoom, and a single sample on a machine that
   is doing anything else is noise. perfBench builds a DETERMINISTIC garden
   (mulberry-seeded, so the same call gives the same layout every time), forces
   `rounds` bakes, and reports min/median/max — min being the honest one, since
   noise only ever adds time.

     perfBench()                                  // 46ft plot, organic, 15 rounds
     perfBench({gw:46, edge:'formal'})            // same real garden on a 12in grid
     perfBench({gw:69, rounds:25, edit:false})    // settle-rebake only, no re-trace

   `edit:true` (default) also invalidates terrainRev each round, so the region
   trace is included — that is what a brush stroke actually costs. `edit:false`
   measures a pan/zoom settle rebake, where the trace is cached.

   Two things this cannot do for you: it needs a COMPOSITING window (a hidden or
   backgrounded tab does not rasterize, and canvas timings taken there swing by
   3x and can even show less work costing more), and it replaces whatever garden
   is open. It parks itself on a scratch world id so autosave cannot overwrite a
   real garden, but save your work first. */
function perfBench(opts){
  opts=opts||{};
  const gw=Math.max(8,opts.gw||31), gh=Math.max(8,opts.gh||gw);
  const edge=opts.edge==='formal'?'formal':'organic';
  const rounds=Math.max(3,opts.rounds||15), edit=opts.edit!==false;
  if (!game.inGarden){ console.warn('perfBench: open a garden first (it needs a live canvas).'); return null; }
  const wasOn=dbg.on; dbg.on=true; devReset();
  const rnd=mulberry(0x9E3779B9);
  // --- deterministic garden: beds/path in NORMALIZED plot coords, so the same
  // real layout lands on any grid size and two grids stay comparable ---
  game.previewMode='established';
  setWorldSize(gw,gh);
  game.worldId='perfbench'; game.worldName='perfBench scratch';
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={};
  game.fences={}; game.lights={}; game.firepits={}; game.boulders={}; game.pets={}; game.pots={}; game.seats={};
  game.houses=[]; game.buildings=[]; game.schemes=[]; game.schemeActive=null;
  game.rot=0; game.edgeStyle=edge; game.bedStyle='soil'; game.pathColor='warm';
  const keys=PLANT_KEYS.filter(k=>!PLANTS[k].hidden);
  const pool=t=>keys.filter(k=>PLANTS[k].type===t);
  const herb=pool('grass').concat(pool('forb')), trees=pool('tree'), shrubs=pool('shrub');
  const now=Date.now(), day=absDay();
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
    const u=(x+0.5)/gw, v=(y+0.5)/gh;
    if (Math.abs(v-0.5-0.14*Math.sin(u*6))<0.045) setTile('terrain',x+','+y,{k:'path',c:'warm',t:now});
    else if (Math.sin(u*5.1+1.3)*0.5+Math.cos(v*4.4)*0.5+u*0.3 > 0.0825)
      setTile('terrain',x+','+y,{k:'bed',c:'soil',t:now});
  }
  const drop=(list,n,age)=>{ let placed=0,guard=0;
    while (placed<n && guard++<n*400){
      const x=(rnd()*gw)|0, y=(rnd()*gh)|0, k=x+','+y;
      if (game.plants[k]) continue;
      setTile('plants',k,{s:list[(rnd()*list.length)|0],d:day-age,t:now}); placed++; } };
  if (trees.length) drop(trees,8,3650);
  if (shrubs.length) drop(shrubs,22,1825);
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++){
    const k=x+','+y, tt=game.terrain[k];
    if (!tt || tt.k!=='bed' || game.plants[k]) continue;
    if (rnd()>0.8) continue;
    setTile('plants',k,{s:herb[(rnd()*herb.length)|0],d:day-40,t:now});
  }
  enterGarden(); fitPlot();
  game.edgeStyle=edge;                       // enterGarden re-normalizes it
  const samples=[], traces=[];
  buildTerrainRegions();                     // warm the region cache before the warmup bakes
  for (let i=0;i<4;i++){ groundKey=''; render(performance.now()); }
  devReset();                                // discard warmup
  for (let i=0;i<rounds;i++){
    if (edit) markGroundChanged({terrain:true});
    groundKey='';
    render(performance.now());
    if (dbg.ev.bake) samples.push(dbg.ev.bake.last);
    if (dbg.ev.trace) traces.push(dbg.ev.trace.last);
  }
  dbg.on=wasOn;
  /* performance.now() is clamped to 1ms without cross-origin isolation, which
     is what this app ships as — every individual sample comes back a whole
     number, so min/med/max are quantized and a sub-3ms cost is unreadable. The
     MEAN is the way through: quantization error is roughly uniform, so it
     cancels at ~quantum/sqrt(12N) — about 0.08ms over 15 rounds. Read `mean`
     when comparing two builds; read min/max for the spread. */
  const stat=a=>{ if (!a.length) return null; const s=a.slice().sort((x,y)=>x-y);
    let sum=0; for (const v of a) sum+=v;
    return {mean:+(sum/a.length).toFixed(2), min:+s[0].toFixed(1),
      med:+s[(s.length/2)|0].toFixed(1), max:+s[s.length-1].toFixed(1)}; };
  const out={plot:`${gw}x${gh}`, feet:`${Math.round(gw*TILE_IN/12)}x${Math.round(gh*TILE_IN/12)}ft`,
    edge, edit, rounds, tileIn:TILE_IN,
    terrainTiles:Object.keys(game.terrain).length, plants:Object.keys(game.plants).length,
    bakeMs:stat(samples), traceMs:stat(traces),
    canvas:cnv?`${cnv.width}x${cnv.height}`:'?', dpr:DPR, zoom:+ZOOM.toFixed(2),
    compositing:!document.hidden};
  if (document.hidden) console.warn('perfBench: tab is HIDDEN — canvas timings here are not trustworthy.');
  const line=(k,s)=>s?`mean ${s.mean}  (min ${s.min} med ${s.med} max ${s.max})`:'n/a';
  console.log(`perfBench ${out.plot} (${out.feet}) ${edge}${edit?' +edit':''}  `+
    `${out.terrainTiles} terrain tiles, ${out.plants} plants\n`+
    `  bake  ${line('bake',out.bakeMs)} ms\n`+
    `  trace ${out.traceMs?line('trace',out.traceMs):'cached'} ms\n`+
    `  canvas ${out.canvas} dpr ${out.dpr} zoom ${out.zoom}`+
    `   — compare on MEAN (the clock quantizes each sample to 1ms)`);
  return out;
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
/* ---------- crash recovery ----------
   rAF swallows nothing, so an uncaught throw inside render() used to leave a
   black canvas with no way back, no save, and no report — the app was simply
   dead until the tab was closed, taking the session's work with it.

   Two different failures get two different responses, deliberately. A throw in
   the render loop IS fatal (the frame never completes, the garden is frozen),
   so it banks the work and shows a way out. A throw anywhere else — a click
   handler, a rejected promise — leaves a working app, so it is recorded for the
   report and otherwise left alone; panelling the screen over a stray rejection
   would be worse than the bug.

   The panel builds its own DOM with inline styles and calls no app function
   beyond the save: whatever broke the frame may equally break showConfirm or a
   token lookup, and a recovery screen that needs a working app is not one. */
let crashed=false;
const errLog=[];                                   // ring buffer, joins the report
function noteError(err,where){
  errLog.push({where, msg:(err&&err.message)||String(err),
    stack:(err&&err.stack)||'', t:Date.now()});
  if (errLog.length>12) errLog.shift();
  try{ console.error('[pocket-prairie]',where,err); }catch(_){ }
}
function reportCrash(err,where){
  if (crashed) return;                             // a throwing frame would
  crashed=true;                                    // otherwise storm the report
  noteError(err,where);
  const panel=buildCrashPanel(err,where);
  // Bank the garden before anything else can go wrong. saveSolo is async, so
  // the panel says "saving" and tells the truth once the write actually lands.
  let p=null;
  try{ if (game.inGarden&&hasStorage) p=saveSolo(true); }catch(e){ noteError(e,'crash-save'); }
  if (p&&p.then) p.then(ok=>panel.setSave(ok?'saved':'failed'),()=>panel.setSave('failed'));
  else panel.setSave(game.inGarden?'failed':'none');
}
function buildCrashPanel(err,where){
  const wrap=document.createElement('div');
  wrap.setAttribute('role','alertdialog');
  wrap.setAttribute('aria-label','Pocket Prairie stopped');
  wrap.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;'+
    'align-items:center;justify-content:center;padding:24px;'+
    'background:rgba(20,14,11,.88);color:#ece3d4;'+
    "font-family:'IBM Plex Sans',system-ui,sans-serif";
  const card=document.createElement('div');
  card.style.cssText='max-width:440px;width:100%;background:#2f231d;'+
    'border:1px solid #40312a;border-radius:9px;padding:22px 24px;'+
    'box-shadow:0 12px 40px rgba(0,0,0,.5)';
  const h=document.createElement('h2');
  h.textContent='Pocket Prairie stopped';
  h.style.cssText="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;"+
    'font-size:24px;font-weight:600;color:#ece3d4';
  const body=document.createElement('p');
  body.textContent='Something went wrong while drawing the garden. This is a bug, not something you did.';
  body.style.cssText='margin:0 0 14px;font-size:15px;line-height:1.5;color:#b3a692';
  const save=document.createElement('p');
  save.textContent='Saving your garden…';
  save.style.cssText='margin:0 0 18px;font-size:14px;line-height:1.5;color:#c97f3f';
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
  const mk=(label,primary)=>{ const b=document.createElement('button');
    b.type='button'; b.textContent=label;
    b.style.cssText='flex:1 1 auto;min-width:120px;padding:11px 14px;font:inherit;'+
      'font-size:14px;font-weight:500;border-radius:5px;cursor:pointer;'+
      (primary?'background:#c97f3f;color:#1b1310;border:1px solid #c97f3f'
             :'background:transparent;color:#ece3d4;border:1px solid #5a4a40');
    row.appendChild(b); return b; };
  mk('Reload',true).onclick=()=>location.reload();
  const copy=mk('Copy error details',false);
  copy.onclick=()=>{
    /* The funnel rides along. A stack alone says what broke; the counters say
       what the gardener had actually done by then, which is usually the
       difference between a reproducible report and a guess. It is device-local
       either way — this is the gardener choosing to paste it. */
    let fn=''; try{ fn='\n\n'+funnelSummary(); }catch(_){ }
    const txt=['Pocket Prairie '+(APP_VERSION||'?')+' — '+where,
      navigator.userAgent, '',
      ...errLog.map(e=>e.where+': '+e.msg+'\n'+e.stack)].join('\n')+fn;
    try{ navigator.clipboard.writeText(txt).then(
      ()=>{ copy.textContent='Copied'; },
      ()=>{ copy.textContent='Press Ctrl+C'; window.prompt('Copy this:',txt); }); }
    catch(_){ window.prompt('Copy this:',txt); }
  };
  card.append(h,body,save,row); wrap.appendChild(card);
  document.body.appendChild(wrap);
  return { setSave(state){
    save.textContent = state==='saved' ? 'Your garden was saved. Reloading is safe.'
      : state==='none' ? 'No garden was open, so nothing was lost.'
      : 'Your garden could not be saved automatically. Reloading may lose recent changes.';
    save.style.color = state==='failed' ? '#d9645a' : '#c97f3f';
  } };
}
window.addEventListener('error', e=>noteError(e.error||e.message,'window'));
window.addEventListener('unhandledrejection', e=>noteError(e.reason,'promise'));

function loop(t){
  if (crashed) return;                             // the frame that threw is not
  try{ frame(t); }                                 // going to succeed on a retry
  catch(err){ reportCrash(err,'render-loop'); return; }
  requestAnimationFrame(loop);
}
function frame(t){
  const rawGap=t-prev;                                // unclamped: stall detection needs the real spacing
  const dt=Math.min(50,Math.max(0,rawGap)); prev=t;   // floor 0: a backward t must never rewind FF time
  if (game.inGarden){
    const tFrame=dnow();
    if (game.ffActive){ game.elapsedMs=(game.elapsedMs||0)+FF_RATE*dt; game.dirty=true; }
    const shouldDraw=shouldRenderGarden(t);
    if (shouldDraw){
      // glass governor samples frame SPACING, but only while the user is
      // actively interacting — idle frames run at a deliberate 30fps cadence
      // and would read as jank.
      if (hasTransientGardenWork() || t-lastMeaningfulChange<IDLE_GRACE_MS){ updateGlassMode(dt); dgap(rawGap); }
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
}
/* ---------- first run ----------
   A stranger's first path through this app was the questionnaire: zone, style,
   natives, deer, rabbit, then a plot to name, size and shape — about eleven
   decisions before a single plant existed, opening on "what is your USDA
   hardiness zone?", a question the app already ships two fallbacks for because
   most people cannot answer it cold.

   So offer the finished garden first. Somebody who says yes is planting inside
   ten seconds; somebody who says no has spent one tap and is on the menu, which
   is where they were headed anyway. The key is device-local (it is a
   preference, not a document, so it stays out of IDB_KEYS and reads
   synchronously). */
const WELCOME_KEY='hortus:welcomed';
/* Storage can be unavailable — private mode, blocked cookies — and this used to
   read that as "already seen", which suppressed the offer AND (because
   coachArmed degraded the other way) every coach beat with it. A whole cohort
   got no onboarding at all. The session flag keeps both working: they are asked
   once per launch rather than never, which is the same way showCoachTip's own
   one-shot already degrades. */
let welcomeSeenSession=false;
function welcomeSeen(){
  if (welcomeSeenSession) return true;
  try{ return localStorage.getItem(WELCOME_KEY)==='1'; }catch(_){ return false; }
}
function markWelcomeSeen(){
  welcomeSeenSession=true;
  try{ localStorage.setItem(WELCOME_KEY,'1'); }catch(_){ }
}
async function maybeOfferDemoGarden(){
  if (welcomeSeen()) return false;
  /* Having gardens is the stronger signal of a returning gardener than the flag
     is of a new one — someone who cleared their preferences, or arrived from a
     build that predates this, should not be greeted as though they were new. */
  let idx=[]; try{ idx=await worldsIndex(); }catch(_){ }
  if (idx.length){ markWelcomeSeen(); return false; }
  /* Arm the coach beats here, not on the answer: someone who declines the demo
     and starts from scratch is exactly as new as someone who accepts it. */
  armCoach();
  funnel(FUNNEL_EVENTS.demoOffered);
  showConfirm(
    'First time here?',
    'There is a small finished garden you can open and play with — plant into it, wind it through a year, and watch what the planting does. It is a copy, so nothing you do to it can spoil anything.',
    'Open the demo garden',
    ()=>{ markWelcomeSeen(); funnel(FUNNEL_EVENTS.demoAccepted); openDemoGarden(); },
    'Start from scratch',
    ()=>{ markWelcomeSeen(); funnel(FUNNEL_EVENTS.demoDeclined); show('menuScreen'); }
  );
  return true;
}

(async function init(){
  /* Count the session, and arrange for the counters to reach storage. funnel()
     only bumps memory — it is called from plantFx, once per placed tile — so the
     serialising happens here: on the way out, and on the same visibility change
     the garden autosaves on, which is the one event a closing tab reliably gets. */
  funnelLoad().sessions++;
  funnel(FUNNEL_EVENTS.appOpen);
  addEventListener('visibilitychange',()=>{ if (document.hidden) funnelFlush(); });
  addEventListener('pagehide',funnelFlush);
  if (hasStorage){
    const f=await sGet('hortus:filters'); if (f) game.filters=normalizeFilters(f);
    await loadPlantCollections();
  }
  updateFilterBtn();
  advanceMenuSeason();
  refreshMenuCards();
  if (location.search.includes('debug')) toggleDebug();
  if (location.search.includes('noglass')){ GLASS.off=true; document.body.classList.add('no-glass'); }
  requestAnimationFrame(loop);
  // after the loop, so the meadow is already drawing behind the dialog
  maybeOfferDemoGarden();
})();
