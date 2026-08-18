'use strict';
/* ---------- storage: save / load ----------
   sGet/sSet kept their async signatures from the artifact era even while they
   read localStorage synchronously. That foresight is what makes this change
   cheap: the seam was already the right shape, so the call sites barely move.

   Gardens now live in IndexedDB. Three measured reasons, in order of how much
   they hurt: localStorage is capped near 5MB per origin on iOS Safari and a
   site-photo garden is ~1MB of it (roughly four gardens before the wall, against
   ~21 on desktop Chrome — a platform asymmetry the app could neither see nor
   report); it is synchronous, so every autosave serialised a whole garden on the
   main thread; and it is evicted first under storage pressure. IndexedDB gets
   the device quota instead of a fixed 5MB, stores structured clones so there is
   no JSON round-trip, and can be marked persistent.

   DEVICE PREFERENCES DELIBERATELY STAY IN localStorage — theme, haptics,
   handedness, coach flags, the menu season. They are bytes rather than
   documents, and the theme bootstrap in index.html's <head> must read one
   synchronously before the first paint, which IndexedDB cannot do at any price.
   IDB_KEYS is the exact list that moves; anything else keeps working through
   the localStorage fallback below without being touched. */
const DB_NAME='hortus', DB_STORE='kv', DB_VERSION=1;
const IDB_KEYS=/^hortus:(worlds$|world:|solo$|filters$|plant-collections)/;
const DB_OPEN_TIMEOUT=3000;
let dbPromise=null, dbBroken=false;

function lsGet(key){ try{ const r=localStorage.getItem(key);
  return r?JSON.parse(r):null; }catch(e){ return null; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); return true; }
  catch(e){ console.error('storage',e); return false; } }

/* One transaction per call, resolved on tx.oncomplete rather than
   request.onsuccess: a put's request succeeds while the transaction is still
   in flight, so reporting success there would tell the gardener their garden
   was saved before it durably was. */
function idbRun(db,mode,fn){
  return new Promise((resolve,reject)=>{
    let tx;
    try{ tx=db.transaction(DB_STORE,mode); }catch(e){ return reject(e); }
    let req; try{ req=fn(tx.objectStore(DB_STORE)); }catch(e){ return reject(e); }
    tx.oncomplete=()=>resolve(req?req.result:undefined);
    tx.onerror=()=>reject(tx.error||new Error('indexeddb'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb aborted'));
  });
}
function openDB(){
  if (dbBroken) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  /* A hung open (private modes, corrupt profiles, a blocked upgrade) must not
     hang the app at boot, so the race degrades to localStorage instead of
     waiting forever. If the real open lands after the timeout it is simply
     unused for the session. */
  dbPromise=Promise.race([
    new Promise(resolve=>{
      let req;
      try{ req=indexedDB.open(DB_NAME,DB_VERSION); }catch(e){ return resolve(null); }
      req.onupgradeneeded=()=>{ const db=req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE); };
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
      req.onblocked=()=>resolve(null);
    }),
    new Promise(resolve=>setTimeout(()=>resolve(null),DB_OPEN_TIMEOUT))
  ]).then(async db=>{
    if (!db){ dbBroken=true; return null; }
    try{ await migrateLocalToIdb(db); }catch(e){ console.warn('storage migration',e); }
    return db;
  /* openDB must never REJECT. Every read and write awaits it, so a rejected
     dbPromise is cached forever and poisons all storage for the session — the
     one failure mode worse than having no IndexedDB at all. Anything unexpected
     degrades to the localStorage path instead. */
  }).catch(e=>{ console.warn('storage open',e); dbBroken=true; return null; });
  return dbPromise;
}
/* Copy the document keys across once, then free the localStorage cap. The
   removal is what actually buys back the 5MB on iOS — a copy that leaves the
   original in place doubles the footprint instead of relieving it — so it runs
   only after the value is confirmed in IndexedDB. An existing IDB value always
   wins: a half-finished earlier migration must not be overwritten by the stale
   localStorage copy it already superseded. */
async function migrateLocalToIdb(db){
  let moved=0, keys=[];
  try{ for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
    if (k&&IDB_KEYS.test(k)) keys.push(k); } }
  catch(e){ return 0; }
  for (const k of keys){
    let val; try{ val=JSON.parse(localStorage.getItem(k)); }catch(_){ continue; }
    if (val==null) continue;
    try{
      const existing=await idbRun(db,'readonly',s=>s.get(k));
      if (existing===undefined) await idbRun(db,'readwrite',s=>s.put(val,k));
      try{ localStorage.removeItem(k); }catch(_){ }
      moved++;
    }catch(e){ console.warn('storage migration',k,e); }
  }
  return moved;
}
async function sGet(key){
  const db=await openDB();
  if (db){
    try{ const v=await idbRun(db,'readonly',s=>s.get(key));
      if (v!==undefined) return v; }
    catch(e){ console.warn('storage read',key,e); }
  }
  return lsGet(key);                 // fallback, and the pre-migration path
}
async function sSet(key,val){
  const db=await openDB();
  if (db){
    try{ await idbRun(db,'readwrite',s=>s.put(val,key)); return true; }
    catch(e){ console.error('storage write',key,e); return false; }
  }
  return lsSet(key,val);
}
async function sDel(key){
  const db=await openDB();
  if (db){ try{ await idbRun(db,'readwrite',s=>s.delete(key)); }
    catch(e){ console.warn('storage delete',key,e); } }
  try{ localStorage.removeItem(key); }catch(_){ }   // clear both homes
  return true;
}
/* Persistence is granted on engagement heuristics, so asking at boot on a
   first visit is the request most likely to be refused. Called instead after
   the first garden actually saves — the point at which the browser has a real
   signal and the gardener has something worth keeping. */
let persistenceAsked=false;
async function requestPersistence(){
  if (persistenceAsked) return null;
  persistenceAsked=true;
  try{
    if (!navigator.storage||!navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  }catch(_){ return null; }
}

async function prepareUnderlayFile(file){
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP site photo.');
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{ const el=new Image();
      el.onload=()=>resolve(el); el.onerror=()=>reject(new Error('That image could not be opened.')); el.src=url; });
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if (!w||!h) throw new Error('That image has no readable dimensions.');
    const max=1600, fit=Math.min(1,max/Math.max(w,h)); w=Math.max(1,Math.round(w*fit)); h=Math.max(1,Math.round(h*fit));
    let quality=.8, data='';
    for (let pass=0;pass<7;pass++){
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const tc=cv.getContext('2d'); tc.fillStyle='#d7d2c8'; tc.fillRect(0,0,w,h); tc.drawImage(img,0,0,w,h);
      data=cv.toDataURL('image/jpeg',quality);
      if (data.length<=UNDERLAY_DATA_LIMIT) return {data,pixelW:w,pixelH:h};
      if (quality>.56) quality-=.08; else { w=Math.max(1,Math.round(w*.82)); h=Math.max(1,Math.round(h*.82)); }
    }
    throw new Error('That photo is still too large after compression. Try a smaller image.');
  } finally { URL.revokeObjectURL(url); }
}

/* worlds live in named slots: 'hortus:worlds' is the index
   [{id,name,ts,gw,gh}], each save under 'hortus:world:<id>'. The old
   single 'hortus:solo' key migrates into the first slot once. */
async function worldsIndex(){ return (await sGet('hortus:worlds'))||[]; }

/* ---------- the one writer of hortus:worlds ----------
   Every mutation of the index is read-modify-write, and nothing kept two of
   them from interleaving. Both read the same array, each wrote back only its
   own change, and the later write erased the earlier one's row — while the
   garden BLOB it pointed at had already been stored. The result was an orphan:
   a garden invisible in the list and still occupying the device's quota, which
   on iOS is about 5MB. Two duplicates started in the same tick also both read
   the same names, so they came out identically titled.

   Reproduced with two duplicateWorld calls back to back: three index rows
   against five stored blobs.

   Every writer now goes through here. The chain serialises them, and the
   callback is handed a FRESH read taken inside the critical section, so a
   mutation can never act on an index that has already moved underneath it.
   Reads stay unqueued — only writers need ordering.

   The callback may be async, and returns the array to store, or null to
   decline (a failed blob write, nothing to do). It must not call back into
   updateWorldsIndex: the chain is not re-entrant and would deadlock. */
const WORLD_KEY_PREFIX='hortus:world:';
/* The only key enumeration in the app. sGet/sSet are a key-value API on
   purpose, but reconciling the index against reality means asking what is
   actually stored rather than what the index claims. Scans both homes: a garden
   written before the IndexedDB move may still be sitting in localStorage. */
async function storedWorldIds(){
  const out=new Set();
  const db=await openDB();
  if (db){
    try{
      for (const k of await idbRun(db,'readonly',s=>s.getAllKeys()))
        if (typeof k==='string' && k.startsWith(WORLD_KEY_PREFIX)) out.add(k.slice(WORLD_KEY_PREFIX.length));
    }catch(e){ console.warn('storage scan',e); }
  }
  try{
    for (let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if (k && k.startsWith(WORLD_KEY_PREFIX)) out.add(k.slice(WORLD_KEY_PREFIX.length));
    }
  }catch(_){ }
  return out;
}
/* An orphan is a stored garden with no row pointing at it: absent from the list
   and still occupying quota, with no way for the gardener to see or reclaim it.
   The index race that produced them is fixed, so none can be created now — but
   a device that already has some would carry them forever, and on iOS's ~5MB
   ceiling a lost site-photo garden is a fifth of the budget. Adopt them back.

   Runs from openWorlds, so it is self-healing rather than a one-shot migration:
   whatever put a garden in storage without a row, the list will find it. */
async function adoptOrphanedWorlds(){
  let adopted=[];
  const stored=await storedWorldIds();
  if (!stored.size) return adopted;
  await updateWorldsIndex(async fresh=>{
    const listed=new Set(fresh.map(w=>w.id));
    const orphans=[...stored].filter(id=>!listed.has(id));
    if (!orphans.length) return null;
    const out=fresh.slice();
    for (const id of orphans){
      const blob=await sGet(WORLD_KEY_PREFIX+id);
      // Only adopt something that really is a garden — a stray key of another
      // shape would otherwise become an un-openable row in the list.
      if (!blob || typeof blob!=='object' || !blob.plants || typeof blob.plants!=='object') continue;
      out.push({id, name:blob.name||'Recovered garden', ts:blob.savedAt||Date.now(),
        gw:blob.gw||blob.grid||31, gh:blob.gh||blob.grid||31, mode:'design'});
      adopted.push(blob.name||'Recovered garden');
    }
    return adopted.length?out:null;
  });
  return adopted;
}

let worldsIndexChain=Promise.resolve();
function updateWorldsIndex(mutate){
  const run=worldsIndexChain.then(async()=>{
    const idx=await worldsIndex();
    const next=await mutate(idx.slice());
    if (!next) return null;
    return (await sSet('hortus:worlds',next)) ? next : null;
  });
  // A throwing mutation must not wedge every later write behind a rejection.
  worldsIndexChain=run.then(()=>{},()=>{});
  return run;
}
async function migrateLegacyWorld(){
  let idx=await worldsIndex();
  if (idx.length) return idx;
  const legacy=await sGet('hortus:solo');
  if (!legacy) return idx;
  let entry=null;
  await updateWorldsIndex(async fresh=>{
    if (fresh.length) return null;                 // someone migrated first
    entry={id:newWorldId(new Set(fresh.map(w=>w.id))), name:'My garden', ts:Date.now(),
      gw:legacy.gw||legacy.grid||31, gh:legacy.gh||legacy.grid||31};
    if (!(await sSet('hortus:world:'+entry.id, legacy))){ entry=null; return null; }
    return [entry];
  });
  if (!entry) return await worldsIndex();
  await sDel('hortus:solo');            // may live in either home after migration
  return [entry];
}
/* Planting schemes ride along as an OPTIONAL `schemes` key. The active
   scheme's maps stay at the blob's top level (blob.plants/blob.bulbs) exactly
   where they have always been, so drawWorldThumb, worldSaveMeta, the import
   validator, loadSolo's GAME_MAPS loop, duplicateWorld and shareCurrentGarden
   all keep working untouched — and an older build opening a new save just sees
   the active scheme. Below two schemes the key is omitted entirely, so ordinary
   gardens save byte-for-byte as before. */
function serializeSchemes(){
  const list=schemeList();
  if (list.length<2) return null;
  return {active:game.schemeActive,
    list:list.map(s=> s.id===game.schemeActive
      ? {id:s.id,name:s.name,t:s.t}                   // active: maps are at the top level
      // inactive maps are never re-loaded-and-compacted while they sit here, so
      // strip tombstones on the way out or {removed:true} accumulates forever
      : {id:s.id,name:s.name,t:s.t,plants:compactSoloMap(s.plants),bulbs:compactSoloMap(s.bulbs)})};
}
/* iOS Safari caps localStorage near 5MB per origin and is the tightest target
   this app ships to (Chromium measured ~50M chars). Quotas are counted in
   UTF-16 code units there, so budget characters at half of 5MB with headroom. */
const SAVE_BUDGET_CHARS=2400000;
function saveHasRoomForScheme(copyCurrent){
  try{
    const base=JSON.stringify(buildSaveBlob()).length;
    const added=copyCurrent
      ? JSON.stringify(game.plants||{}).length+JSON.stringify(game.bulbs||{}).length
      : 0;
    return base+added < SAVE_BUDGET_CHARS;
  }catch(e){ return true; }   // never block the gardener on a measurement failure
}
/* The load-side counterpart of serializeSchemes. Pure and synchronous — the
   ACTIVE scheme's maps arrive separately, through loadSolo's GAME_MAPS loop,
   because they live at the blob's top level; this only rebuilds the list around
   them. shiftKeys is a no-op in practice (13x13-era saves predate schemes) but
   applying it keeps the two paths honest if that ever stops being true. */
function restoreSchemes(s,shift){
  game.schemes=[]; game.schemeActive=null;
  const sc=s&&s.schemes;
  if (sc && Array.isArray(sc.list) && sc.list.length){
    game.schemes=sc.list.map(e=>({
      id:String(e.id||newSchemeId()), name:String(e.name||'Planting').slice(0,32), t:+e.t||Date.now(),
      plants:compactSoloMap(shiftKeys(e.plants||{},shift)),
      bulbs:compactSoloMap(shiftKeys(e.bulbs||{},shift))}));
    if (game.schemes.some(x=>x.id===sc.active)) game.schemeActive=sc.active;
  }
  ensureSchemes();   // materializes a lone default and nulls the active entry's maps
}
function buildSaveBlob(){
  const t0=dnow();   // autosave fires on day change / quit / pagehide: 'blob' in the debug HUD
  /* `v` is the schema number, `app` the build that wrote it. Migrations used to
     be feature detection ("if the blob has a `house` key it is old"), which was
     fine while every save in existence was one of ours. An explicit version is
     what lets loadSolo make decisions rather than guesses once strangers own the
     data. Absent `v` means a pre-versioning save, which is version 0. */
  const blob={v:SAVE_VERSION,app:APP_VERSION,
    wv:1,name:game.worldName,
    mode:'design',design:game.design,   // design is the only mode; kept so older builds read the save sanely
    discovery:typeof normalizeDiscovery==='function' ? normalizeDiscovery(game.discovery) : game.discovery,
    gw:GW,gh:GH,rot:game.rot,siteNorthDeg:normalizeSiteNorthDeg(game.siteNorthDeg),plotShape:game.plotShape,freePlanting:game.freePlanting,previewMode:game.previewMode,
    edgeStyle:game.edgeStyle,
    layerVis:normalizeLayerVis(game.layerVis),
    pathColor:game.pathColor,bedStyle:game.bedStyle,waterStyle:game.waterStyle,
    fenceDraft:game.fenceDraft,lightDraft:game.lightDraft,firepitDraft:game.firepitDraft,boulderDraft:game.boulderDraft,petDraft:game.petDraft,
    buildingStyleDraft:game.buildingStyleDraft,
    underlay:game.underlay?normalizeUnderlay(game.underlay):null,
    startTs:saveStartTs(),elapsedMs:elapsedGameMs(),savedAt:Date.now(),dayOffset:game.dayOffset};
  for (const L of GAME_LAYERS) blob[L.k]=game[L.k];   // plants/bulbs/terrain/elevation/fences/lights/firepits/boulders/houses
  const schemes=serializeSchemes(); if (schemes) blob.schemes=schemes;
  dev('blob',t0);
  return blob;
}
/* A silent autosave that fails silently is exactly how a session's work
   disappears with nobody noticing — autosave fires on every day change, so the
   old code could fail two hundred times without a word. It now speaks once and
   then stays quiet until a save succeeds again; a toast per day change would be
   its own bug. The message names the way out (export) rather than the cause. */
let saveFailureReported=false;
async function saveSolo(silent){
  if (!hasStorage){ toast('No save storage here — garden lives this session only.'); return; }
  // First save of a garden that has never had an id. The index is read below
  // anyway, so minting against it costs nothing and closes the one path where a
  // fresh garden could land on top of an existing one.
  if (!game.worldId) game.worldId=newWorldId(new Set((await worldsIndex()).map(w=>w.id)));
  const blob=buildSaveBlob();
  const stored=await sSet('hortus:world:'+game.worldId,blob);
  if (!stored){
    if (!silent || !saveFailureReported){
      saveFailureReported=true;
      toast('This garden could not be saved — device storage may be full. Export it from the menu to keep it.','warn');
    }
    return false;
  }
  await updateWorldsIndex(fresh=>{
    const out=fresh.filter(w=>w.id!==game.worldId);
    out.push({id:game.worldId, name:game.worldName||'My garden', ts:Date.now(), gw:GW, gh:GH, mode:'design'});
    return out;
  });
  saveFailureReported=false;
  requestPersistence();               // first real save is the strongest signal
  if (!silent) toast('Garden saved.');
  return true;
}
function shiftKeys(m,d){ // translate every "x,y" key by +d on both axes
  if (!d) return m;
  const out={};
  for (const k in m){ const [x,y]=k.split(',').map(Number); out[`${x+d},${y+d}`]=m[k]; }
  return out;
}
function compactSoloMap(m){
  const out={};
  for (const k in (m||{})){
    const v=m[k];
    if (v && !v.removed) out[k]=v;
  }
  return out;
}
async function loadSolo(id){
  const s=await sGet('hortus:world:'+id);
  if (!s) return false;
  // plot size: gw/gh (current), grid (square-era), or neither (13x13 era,
  // laid out around tile (6,6) — recenter on the classic plot)
  setWorldSize(s.gw||s.grid||31, s.gh||s.grid||31);
  setPlotShape(s.plotShape||null);   // tolerates absence: legacy saves load as full rectangles
  const shift = (s.gw||s.grid) ? 0 : SPAWNX-6;
  // `mode` is vestigial: story gardens were retired with the avatar, so an old
  // story save simply opens in the planner (its house and plants come along).
  game.design = s.design || null;
  // Old saves predate discovery lenses.  Garden criteria is still the source
  // of truth; the global filters value only supplies compatibility/defaults.
  if (game.design && typeof normalizeFilters==='function') game.filters=normalizeFilters(game.design);
  game.discovery=typeof normalizeDiscovery==='function' ? normalizeDiscovery(s.discovery) : (s.discovery||game.discovery);
  game.previewMode = s.previewMode==='today' ? 'today' : 'established';
  game.edgeStyle = (s.edgeStyle==='formal'||s.edgeStyle==='organic') ? s.edgeStyle : edgeStyleFromType(s.design&&s.design.type);
  game.layerVis = normalizeLayerVis(s.layerVis);
  game.underlay=normalizeUnderlay(s.underlay); game.photoEditing=false;
  game.siteNorthDeg=normalizeSiteNorthDeg(s.siteNorthDeg); game.siteNorthPreviewDeg=null;
  for (const L of GAME_MAPS) game[L.k]=compactSoloMap(shiftKeys(s[L.k]||{},shift));   // keyed layers, without solo tombstones
  restoreSchemes(s,shift);
  // houses: new saves store an array; migrate old single-house saves
  game.houses = s.houses ? s.houses : (s.house ? [s.house] : []);
  if (shift) game.houses.forEach(h=>{ h.x+=shift; h.y+=shift; });
  game.buildings=Array.isArray(s.buildings) ? s.buildings.map(b=>{
    const out=Object.assign({},b,{vertices:Array.isArray(b.vertices)?b.vertices.map(p=>[+p[0]||0,+p[1]||0]):[]});
    if (shift) out.vertices.forEach(p=>{ p[0]+=shift; p[1]+=shift; });
    return out;
  }) : [];
  markGroundChanged({terrain:true});
  game.houseDraft = draftFromHouses();
  game.buildingDraft=null; game.buildingStyleDraft=normalizeBuildingStyle(s.buildingStyleDraft);
  game.pathColor=pathColorId(s.pathColor||game.pathColor);
  game.bedStyle=bedStyleId(s.bedStyle||'soil');
  game.waterStyle=waterStyleId(s.waterStyle||game.waterStyle);
  game.freePlanting=!!s.freePlanting;
  game.fenceDraft=normalizeFenceDraft(s.fenceDraft);
  game.lightDraft=normalizeLightDraft(s.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(s.firepitDraft);
  game.boulderDraft=normalizeBoulderDraft(s.boulderDraft);
  game.petDraft=normalizePetDraft(s.petDraft);
  game.rot=s.rot||0;
  const migratedElapsed = s.elapsedMs!==undefined
    ? Math.max(0,+s.elapsedMs||0)
    : Math.max(0,((s.savedAt||Date.now())-(s.startTs||Date.now())));
  game.elapsedMs=migratedElapsed;
  game.startTs=Date.now();
  game.clockSuspended=false; game.pausedAt=0;
  game.dayOffset=s.dayOffset||0;
  game.worldName=s.name||'My garden';
  // saves from before the walkway became terrain get it seeded once,
  // so the old built-in path is finally shovel-able
  if (!s.wv) seedWalkway();
  return true;
}

/* ---------- export: the planting list ----------
   Tallies what's planted and converts game tiles to real quantities:
   one tile is TILE_IN inches square, so a species at tighter spacing
   needs more plants than tiles to fill the same ground, and a big
   clumper like baptisia needs fewer. */
function htmlEscape(v){
  return String(v==null?'':v).replace(/[&<>"']/g,ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function exportRows(){
  const counts={}; // keyed species|cultivar — cultivars order separately
  [game.plants,game.bulbs].forEach(layer=>{
    for (const k in layer){ const p=layer[k];
      if (!p.removed && p.s){ const ck=p.s+'|'+(p.v||'');
        counts[ck]=(counts[ck]||0)+1; } }
  });
  return Object.keys(counts).map(ck=>{
    const [s,v]=ck.split('|'), P=plantDef(s,v||null), n=counts[ck];
    return {name:P.name, latin:P.latin, native:P.native, count:n,
      areaFt:Math.round(n*(TILE_IN/12)*(TILE_IN/12)*10)/10,
      space:P.space,
      order:Math.ceil(n*TILE_IN*TILE_IN/(P.space*P.space))};
  }).sort((a,b)=>b.count-a.count);
}
function openExport(){
  const rows=exportRows(), body=$('exportBody');
  const where=game.worldName||'My garden';
  $('exportMeta').textContent=`${where} · ${new Date().toLocaleDateString()} · one tile = ${TILE_IN}" × ${TILE_IN}"`;
  if (!rows.length){
    body.innerHTML='<p class="note">Nothing planted yet. Plant a few drifts, then come back for the list.</p>';
  } else {
    const tr=rows.map(r=>`<tr><td>${r.name}${r.native?'':' *'}<div class="latin">${r.latin}</div></td>
      <td>${r.count}</td><td>${r.areaFt}</td><td>${r.space}"</td><td><b>${r.order}</b></td></tr>`).join('');
    const tot=rows.reduce((a,r)=>({c:a.c+r.count,f:a.f+r.areaFt,o:a.o+r.order}),{c:0,f:0,o:0});
    body.innerHTML=`<div class="export-wrap"><table class="export-table"><thead><tr>
      <th>Species</th><th>Planted</th><th>Sq ft</th><th>Spacing</th><th>To order</th></tr></thead>
      <tbody>${tr}</tbody>
      <tfoot><tr><td>Total</td><td>${tot.c}</td><td>${Math.round(tot.f*10)/10}</td><td></td><td>${tot.o}</td></tr></tfoot></table></div>
      <p class="note">"To order" converts planted ground to plants at each species' recommended
      spacing — buy that many to fill the same area. * marks garden cultivars of non-native origin.</p>`;
  }
  openOverlay('exportScreen','#btnPrint');
}
function exportCsv(){
  const rows=exportRows();
  if (!rows.length){ toast('Nothing planted yet.'); return; }
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  const lines=[['Common name','Latin name','Native','Tiles planted','Bed area (sq ft)','Spacing (in)','Plants to order'].map(esc).join(',')];
  rows.forEach(r=>lines.push([r.name,r.latin,r.native?'yes':'no',r.count,r.areaFt,r.space,r.order].map(esc).join(',')));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));
  a.download='hortus-planting-list.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ---------- bloom calendar ----------
   A planted-only real-world bloom calendar. `bloomMonths` is the preferred
   data source; the season fallback keeps older/unrefined species visible until
   their month ranges are curated. Game animation still uses bloomDay. */
const CAL_MONTHS=[1,2,3,4,5,6,7,8,9,10,11,12];
const CAL_MONTH_LABELS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function normalizeBloomMonths(months){
  const out=[];
  (months||[]).forEach(m=>{ m=Number(m); if (m>=1 && m<=12 && !out.includes(m)) out.push(m); });
  return out.sort((a,b)=>a-b);
}
function bloomMonthsFromRange(start,end){
  start=Number(start); end=Number(end);
  if (!(start>=1 && start<=12 && end>=1 && end<=12)) return [];
  const out=[];
  if (start<=end){ for (let m=start;m<=end;m++) out.push(m); }
  else { for (let m=start;m<=12;m++) out.push(m); for (let m=1;m<=end;m++) out.push(m); }
  return normalizeBloomMonths(out);
}
function fallbackBloomMonths(def){
  const seasons=SEASONS.filter(s=>def.sea && def.sea[s] && def.sea[s].bloom);
  if (!seasons.length) return [];
  const out=[];
  if (def.type==='bulb' && seasons.includes('Spring')){
    const d=def.bloomDay!==undefined ? def.bloomDay : 4;
    if (d<=1) out.push(2,3);
    else if (d<=4) out.push(3,4);
    else if (d<=7) out.push(4,5);
    else out.push(5,6);
  }
  seasons.forEach(s=>{
    if (s==='Spring') out.push(def.type==='bulb' ? 3 : 4,5);
    else if (s==='Summer') out.push(6,7,8);
    else if (s==='Fall') out.push(9,10);
    else if (s==='Winter') out.push(12,1,2);
  });
  return normalizeBloomMonths(out);
}
function bloomMonthsFor(def){
  if (Array.isArray(def.bloomMonths)) return normalizeBloomMonths(def.bloomMonths);
  const ranged=bloomMonthsFromRange(def.bloomStart,def.bloomEnd);
  return ranged.length ? ranged : fallbackBloomMonths(def);
}
/* Falls back to the season's SEEDHEAD before the generic plan colour, because a
   grass that flowers in August is showing seed by September — its own data says
   so — and the month it crosses into fall should read as bronze rather than as
   whatever colour the plan sheet happens to use for it. Northern sea oats,
   molinia and the fountain grasses all span that boundary. */
function bloomMonthColor(def,month){
  const season = (month>=3 && month<=5) ? 'Spring' :
    (month>=6 && month<=8) ? 'Summer' :
    (month>=9 && month<=11) ? 'Fall' : 'Winter';
  const s = def.sea && def.sea[season];
  return (s && (s.bloom || s.seed)) || planColor(def);
}
function bloomMonthSeasonClass(month){
  return (month>=3 && month<=5) ? 'spring' :
    (month>=6 && month<=8) ? 'summer' :
    (month>=9 && month<=11) ? 'fall' : 'winter';
}
function bloomRows(){
  const counts={};
  [game.plants,game.bulbs].forEach(layer=>{
    for (const k in layer){ const p=layer[k];
      if (p && !p.removed && p.s){
        const ck=p.s+'|'+(p.v||'');
        counts[ck]=(counts[ck]||0)+1;
      }
    }
  });
  return Object.keys(counts).map(ck=>{
    const [s,v]=ck.split('|'), def=plantDef(s,v||null), months=bloomMonthsFor(def);
    if (!months.length) return null;
    const colors={};
    months.forEach(m=>{ colors[m]=bloomMonthColor(def,m); });
    return {key:ck,name:def.name,latin:def.latin||'',count:counts[ck],
      color:planColor(def),months,colors,first:months[0]};
  }).filter(Boolean).sort((a,b)=>a.first-b.first || a.name.localeCompare(b.name));
}
function bloomMonthCellHtml(row,month){
  const seasonClass=bloomMonthSeasonClass(month);
  if (!row.months.includes(month)) return `<div class="bloom-cell ${seasonClass}"></div>`;
  const label=CAL_MONTH_LABELS[month-1];
  const color=row.colors[month]||row.color;
  return `<div class="bloom-cell ${seasonClass} active" title="${htmlEscape(row.name)} blooms in ${label}">
    <span class="bloom-dot" style="background:${color}"></span></div>`;
}
function openBloomCalendar(){
  const rows=bloomRows(), body=$('bloomBody');
  const where=game.worldName||'My garden';
  $('bloomMeta').textContent=`${where} · ${new Date().toLocaleDateString()} · approximate real-world bloom months`;
  if (!rows.length){
    body.innerHTML='<p class="note">Nothing blooming is planted yet. Add flowering perennials or bulbs, then come back for the calendar.</p>';
  } else {
    const head=`<div class="bloom-head">Species</div>${CAL_MONTHS.map(m=>`<div class="bloom-head month">${CAL_MONTH_LABELS[m-1]}</div>`).join('')}`;
    const lines=rows.map(r=>{
      const cells=CAL_MONTHS.map(m=>bloomMonthCellHtml(r,m)).join('');
      return `<div class="bloom-name"><b>${htmlEscape(r.name)}</b><small>${htmlEscape(r.latin)}</small><em>${r.count} planted</em></div>${cells}`;
    }).join('');
    body.innerHTML=`<div class="bloom-wrap"><div class="bloom-grid">${head}${lines}</div></div>
      <p class="note">Bloom timing is approximate and region-dependent. Use it as a planning guide; zone, weather, microclimate, and cultivar differences can shift bloom windows earlier or later.</p>`;
  }
  openOverlay('bloomScreen','#btnBloomClose');
}

/* ---------- the planting plan: an Oudolf-style drift map ----------
   Top-down 2D. Contiguous same-species tiles flood-fill into drifts,
   each drift's boundary is traced and smoothed into an organic blob,
   labeled with a short code. Trees draw as dashed effective-canopy
   circles (mature under Established preview), bulbs as scatter dots over the drifts. */
function planComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k]; if (!p.removed){
    const [x,y]=k.split(',').map(Number), def=plantDef(p.s,p.v);
    if (isShrubDef(def)) shrubFootprintTiles(x,y,p,true).forEach(([xx,yy])=>{ if (!live[`${xx},${yy}`]) live[`${xx},${yy}`]=p; });
    else live[k]=p;
  } }
  const seen={}, comps=[];
  for (const k in live){
    if (seen[k]) continue;
    const p=live[k], stack=[k], tiles=[];
    seen[k]=true;
    while (stack.length){
      const cur=stack.pop(); tiles.push(cur);
      const [cx2,cy2]=cur.split(',').map(Number);
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
        if (!dx&&!dy) continue;
        const nk=`${cx2+dx},${cy2+dy}`;
        if (seen[nk]) continue;
        const np=live[nk];
        if (np && np.s===p.s && (np.v||'')===(p.v||'')){ seen[nk]=true; stack.push(nk); }
      }
    }
    comps.push({s:p.s, v:p.v||null, tiles});
  }
  return comps;
}
function traceOutlines(tileSet){ // rectilinear boundary loops of a tile set
  const has=(x,y)=>tileSet.has(`${x},${y}`);
  const edges=new Map(); // "x,y" start -> [end points]
  const add=(x1,y1,x2,y2)=>{ const k=`${x1},${y1}`;
    (edges.get(k)||edges.set(k,[]).get(k)).push([x2,y2]); };
  for (const k of tileSet){ const [x,y]=k.split(',').map(Number);
    if (!has(x,y-1)) add(x,y, x+1,y);
    if (!has(x+1,y)) add(x+1,y, x+1,y+1);
    if (!has(x,y+1)) add(x+1,y+1, x,y+1);
    if (!has(x-1,y)) add(x,y+1, x,y);
  }
  const loops=[];
  for (const [start] of edges){
    if (!edges.get(start).length) continue;
    const pts=[start.split(',').map(Number)];
    let cur=start;
    while (true){
      const outs=edges.get(cur);
      if (!outs || !outs.length) break;
      const [nx,ny]=outs.pop();
      const nk=`${nx},${ny}`;
      if (nk===start) break;
      pts.push([nx,ny]); cur=nk;
    }
    if (pts.length>2){
      // merge collinear runs so the smoothing gets long, sweeping curves
      const out=[];
      for (let i=0;i<pts.length;i++){
        const a=pts[(i+pts.length-1)%pts.length], b2=pts[i], c=pts[(i+1)%pts.length];
        if ((b2[0]-a[0])*(c[1]-b2[1])!==(b2[1]-a[1])*(c[0]-b2[0])) out.push(b2);
      }
      if (out.length>2) loops.push(out);
    }
  }
  return loops;
}
function planJitter(x,y){ // shared lattice wobble: neighboring blobs nest
  const r=mulberry((x*73856093 ^ y*83492791)>>>0);
  return [(r()-0.5)*0.5, (r()-0.5)*0.5];
}
function planColor(def){
  const s=def.sea.Summer||{}, f=def.sea.Fall||{}, sp=def.sea.Spring||{};
  return s.bloom||sp.bloom||f.bloom||f.seed||s.fol||sp.fol||'#8a8a70';
}
function roundedRectPath(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function isShrubPlanDef(def){
  return isShrubDef(def);
}
function shrubPlanComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const def=plantDef(p.s,p.v);
    if (!isShrubPlanDef(def)) continue;
    const [x,y]=k.split(',').map(Number);
    live[k]={p,def,x,y};
  }
  const seen={}, comps=[];
  for (const k in live){
    if (seen[k]) continue;
    const root=live[k], hedge=!!(root.def.look&&root.def.look.hedge);
    const id=root.p.s+'|'+(root.p.v||''), stack=[k], tiles=[];
    seen[k]=true;
    if (hedge){
      while (stack.length){
        const cur=stack.pop();
        tiles.push(cur);
        const [cx2,cy2]=cur.split(',').map(Number);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
          const nk=`${cx2+dx},${cy2+dy}`, nb=live[nk];
          if (!nb || seen[nk]) return;
          if ((nb.p.s+'|'+(nb.p.v||''))!==id) return;
          if (!(nb.def.look&&nb.def.look.hedge)) return;
          seen[nk]=true; stack.push(nk);
        });
      }
    } else {
      shrubFootprintTiles(root.x,root.y,root.p,true).forEach(([xx,yy])=>tiles.push(`${xx},${yy}`));
    }
    comps.push({s:root.p.s,v:root.p.v||null,x:root.x,y:root.y,tiles,shape:(root.def.look&&root.def.look.shape)||'round',hedge});
  }
  return comps;
}
function drawPlanCode(ctx,code,lx,ly,fs){
  ctx.textAlign='center';
  ctx.font=`600 ${fs}px IBM Plex Sans`;
  ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
  ctx.strokeText(code,lx,ly); ctx.fillStyle='#2c241c'; ctx.fillText(code,lx,ly);
}
function drawShrubPlan(ctx,c,codes,cell,X,Y){
  const def=plantDef(c.s,c.v), col=planColor(def), fill=mixHex(col,'#f7f3e8',0.62);
  const stroke=mixHex(col,'#2c241c',0.18);
  const pts=c.tiles.map(k=>k.split(',').map(Number));
  const code=codes[c.s+'|'+(c.v||'')];
  const shape=(def.look&&def.look.shape)||'round';
  const r=Math.max(cell*0.42,woodyRadiusTiles(def)*cell);
  ctx.save();
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=1.25;
  if (!c.hedge){
    const cx2=X((Number.isFinite(c.x)?c.x:pts[0][0])+0.5);
    const cy2=Y((Number.isFinite(c.y)?c.y:pts[0][1])+0.5);
    const rx=r, ry=r;
    ctx.beginPath();
    ctx.ellipse(cx2,cy2,rx,ry,0,0,7);
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle='#f7f3e8';
    ctx.beginPath(); ctx.ellipse(cx2-rx*0.22,cy2-ry*0.28,rx*0.38,ry*0.20,-0.08,0,7); ctx.fill(); ctx.restore();
    drawPlanCode(ctx,code,cx2,cy2+3,Math.max(8,Math.min(13,Math.min(rx,ry)*0.42)));
    ctx.restore();
    return;
  }
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const sameRow=minY===maxY, sameCol=minX===maxX;
  let rx,ry,rw,rh,rad;
  if (sameRow){
    const c1=X(minX)+cell/2, c2=X(maxX)+cell/2, cy2=Y(minY)+cell/2;
    rx=c1-r; ry=cy2-r*0.70; rw=(c2-c1)+r*2; rh=r*1.40; rad=Math.min(rh*0.18,cell*0.24);
  } else if (sameCol){
    const cx2=X(minX)+cell/2, c1=Y(minY)+cell/2, c2=Y(maxY)+cell/2;
    rx=cx2-r*0.70; ry=c1-r; rw=r*1.40; rh=(c2-c1)+r*2; rad=Math.min(rw*0.18,cell*0.24);
  } else {
    rx=X(minX)+cell/2-r; ry=Y(minY)+cell/2-r;
    rw=(X(maxX)-X(minX))+r*2; rh=(Y(maxY)-Y(minY))+r*2; rad=Math.min(cell*0.28,r*0.28);
  }
  roundedRectPath(ctx,rx,ry,rw,rh,rad);
  ctx.fill(); ctx.stroke();
  ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#f7f3e8';
  roundedRectPath(ctx,rx+rw*0.08,ry+rh*0.10,rw*0.58,rh*0.26,Math.min(rad,rh*0.13));
  ctx.fill(); ctx.restore();
  drawPlanCode(ctx,code,rx+rw/2,ry+rh/2+3,Math.max(8,Math.min(13,5+Math.sqrt(c.tiles.length)*2)));
  ctx.restore();
}
function drawTreePlan(ctx,p,x,y,cell,X,Y){
  const def=plantDef(p.s,p.v), reach=canopyRadius(p);
  const cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
  if (reach>0){
    const r=reach*cell;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0),Y(0),GW*cell,GH*cell);
    ctx.clip();
    ctx.globalAlpha=0.12;
    ctx.fillStyle=mixHex(planColor(def),'#f7f3e8',0.56);
    ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.fill();
    ctx.globalAlpha=1;
    ctx.strokeStyle=mixHex(planColor(def),'#2c241c',0.18);
    ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle='#4a3a28';
  ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2.5,cell*0.18),0,7); ctx.fill();
}
function planCodes(ids){ // short Oudolf-style codes, unique per species|cv
  const used={}, codes={};
  // parse genus/epithet once; count 2-letter genus prefixes so a lone genus can
  // use a short 2-letter code (a single Amsonia -> "AM"), growing only on collision
  const info=ids.map(id=>{ const [s,v]=id.split('|'), P=plantDef(s,v||null);
    const parts=(P.latin||'').split(' ');
    return {id, v, gen:(parts[0]||s).toUpperCase(), ep:(parts[1]||'').toUpperCase()}; });
  const gen2={}; info.forEach(o=>{ const g=o.gen.slice(0,2); gen2[g]=(gen2[g]||0)+1; });
  info.forEach(o=>{
    const g2=o.gen.slice(0,2), g3=o.gen.slice(0,3);
    let code=null;
    if (gen2[g2]===1 && !used[g2]) code=g2;               // only genus with this prefix → 2 letters
    else {                                                // else 3 letters, then grow into the epithet
      for (let n=0;n<=o.ep.length;n++){ const c=g3+(n?o.ep.slice(0,n):''); if (!used[c]){ code=c; break; } }
      if (!code){ let i=2; while (used[g3+i]) i++; code=g3+i; }
    }
    if (o.v) code+="'"+o.v.slice(0,2).toUpperCase();
    used[code]=1; codes[o.id]=code;
  });
  return codes;
}

function buildPlanMap(){
  const pc=$('planCanvas'), ctx=pc.getContext('2d');
  const cell=Math.max(9, Math.min(24, Math.floor(1000/Math.max(GW,GH))));
  const padL=34, padT=92;
  const allComps=planComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  const shrubComps=shrubPlanComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  const comps=allComps.filter(c=>!isShrubPlanDef(plantDef(c.s,c.v)));
  const bulbsLive=Object.keys(game.bulbs).filter(k=>!game.bulbs[k].removed);
  const treesLive=Object.keys(game.plants).filter(k=>{
    const p=game.plants[k];
    return p && !p.removed && isTreeDef(plantDef(p.s,p.v));
  });
  const lightsLive=Object.keys(game.lights||{}).filter(k=>game.lights[k]&&!game.lights[k].removed);
  const bouldersLive=Object.keys(game.boulders||{}).filter(k=>game.boulders[k]&&!game.boulders[k].removed);
  const ids=[...new Set([
    ...comps.map(c=>c.s+'|'+(c.v||'')),
    ...shrubComps.map(c=>c.s+'|'+(c.v||'')),
    ...bulbsLive.map(k=>{ const b2=game.bulbs[k]; return b2.s+'|'+(b2.v||''); })
  ])];
  const codes=planCodes(ids);
  const legCols=3, legRows=Math.ceil(ids.length/legCols);
  const fixtureRows=(lightsLive.length?1:0)+(bouldersLive.length?1:0);
  const noteRows=treesLive.length?1:0;
  const W2=padL*2+GW*cell, H2=padT+GH*cell+34+(legRows+fixtureRows+noteRows)*15+26;
  pc.width=W2*2; pc.height=H2*2; pc.style.aspectRatio=`${W2}/${H2}`;
  ctx.setTransform(2,0,0,2,0,0);
  const X=x=>padL+x*cell, Y=y=>padT+y*cell;
  // paper
  ctx.fillStyle='#f7f3e8'; ctx.fillRect(0,0,W2,H2);
  ctx.strokeStyle='#b8ad95'; ctx.lineWidth=1;
  ctx.strokeRect(8,8,W2-16,H2-16);
  // title block
  ctx.fillStyle='#2c241c'; ctx.textAlign='left';
  ctx.font='600 22px Fraunces, serif';
  ctx.fillText(game.worldName||'Design plan', padL, 38);
  ctx.font='11px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText(`Design plan · Pocket Prairie Garden Design · ${new Date().toLocaleDateString()}`, padL, 56);
  ctx.fillText(`1 tile = ${TILE_IN}" · plot ${Math.round(GW*1.5)} × ${Math.round(GH*1.5)} ft`, padL, 70);
  // True north rotates inside the plan; the garden drawing itself stays in
  // the user's plot coordinates so labels and saved tile positions never move.
  const nd=siteDirections(game.siteNorthDeg).N, nc=[W2-48,52], perp=[-nd[1],nd[0]];
  const nt=[nc[0]+nd[0]*17,nc[1]+nd[1]*17], tail=[nc[0]-nd[0]*13,nc[1]-nd[1]*13];
  const hb=[nt[0]-nd[0]*9,nt[1]-nd[1]*9];
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(nc[0],nc[1],24,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail[0],tail[1]); ctx.lineTo(nt[0],nt[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(nt[0],nt[1]); ctx.lineTo(hb[0]+perp[0]*5,hb[1]+perp[1]*5);
  ctx.lineTo(hb[0]-perp[0]*5,hb[1]-perp[1]*5); ctx.closePath();
  ctx.fillStyle='#2c241c'; ctx.fill();
  ctx.font='10px IBM Plex Sans'; ctx.textAlign='center';
  ctx.fillText('N',nc[0]+nd[0]*34,nc[1]+nd[1]*34+3);
  // faint tile grid so bare ground still reads as a plot of blank tiles —
  // clipped to the lot shape so an irregular plot doesn't grid past its edge
  ctx.strokeStyle='rgba(120,108,86,0.16)'; ctx.lineWidth=0.5;
  ctx.save();
  if (game.plotShape){
    ctx.beginPath();
    game.plotShape.forEach(([vx,vy],i)=>{ const px=X(vx), py=Y(vy); i?ctx.lineTo(px,py):ctx.moveTo(px,py); });
    ctx.closePath(); ctx.clip();
  }
  for (let gx=0;gx<=GW;gx++){ ctx.beginPath(); ctx.moveTo(X(gx),Y(0)); ctx.lineTo(X(gx),Y(GH)); ctx.stroke(); }
  for (let gy=0;gy<=GH;gy++){ ctx.beginPath(); ctx.moveTo(X(0),Y(gy)); ctx.lineTo(X(GW),Y(gy)); ctx.stroke(); }
  ctx.restore();
  // elevation grade: subtle plan cue under materials/plants
  for (const k in game.elevation){ const e=game.elevation[k];
    if (!e || e.removed || !e.h) continue;
    const [x,y]=k.split(',').map(Number);
    ctx.fillStyle=e.h>0?'rgba(145,119,70,0.16)':'rgba(73,112,140,0.18)';
    ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
    ctx.fillStyle=e.h>0?'#8a6735':'#4f7388';
    ctx.font=`600 ${Math.max(7,Math.min(10,cell*0.42))}px IBM Plex Sans`;
    ctx.textAlign='center';
    ctx.fillText(`${e.h>0?'+':''}${e.h}`,X(x)+cell/2,Y(y)+cell/2+3);
  }
  // terrain — organic gardens draw the SAME smoothed region geometry the
  // garden renderer uses (terrainLoopPath over the cached arcs, projected to
  // paper), so the plan finally matches what the gardener sees; formal
  // gardens keep the crisp per-tile cells.
  if (game.edgeStyle==='organic'){
    const planProj=([gx,gy])=>[X(gx),Y(gy)];
    for (const region of buildTerrainRegions()){
      const o={k:region.kind,c:region.c};
      ctx.fillStyle=region.kind==='path'?pathPlanFill(o):region.kind==='water'?waterPlanFill(o):bedPlanFill(o);
      ctx.beginPath();
      for (const loop of region.loops) terrainLoopPath(ctx,loop,planProj);
      ctx.fill('evenodd');
      // outline separately: the silhouette fills, but a boundary a higher-ranked
      // region covers must not be drawn as an edge on the sheet either
      ctx.beginPath();
      for (const loop of region.loops) terrainLoopStroke(ctx,loop,planProj);
      ctx.strokeStyle='rgba(88,70,52,0.5)'; ctx.lineWidth=1.1;
      ctx.stroke();
    }
  } else {
    for (const k in game.terrain){ const t2=game.terrain[k];
      if (t2.removed) continue;
      const [x,y]=k.split(',').map(Number);
      ctx.fillStyle=t2.k==='path'?pathPlanFill(t2):t2.k==='water'?waterPlanFill(t2):bedPlanFill(t2);
      ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
    }
  }
  // fire pits
  for (const k in game.firepits){ const f=game.firepits[k];
    if (!f || f.removed) continue;
    const [x,y]=k.split(',').map(Number), d=normalizeFirepitDraft(f), sz=firepitTileSize(d);
    const px=X(x), py=Y(y), w=sz.w*cell, h=sz.h*cell;
    ctx.fillStyle='#766b60'; ctx.strokeStyle='#3b3028'; ctx.lineWidth=1.3;
    if (d.shape==='round'){
      ctx.beginPath(); ctx.ellipse(px+w/2,py+h/2,w*0.42,h*0.42,0,0,7); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2f261f'; ctx.beginPath(); ctx.ellipse(px+w/2,py+h/2,w*0.24,h*0.24,0,0,7); ctx.fill();
    } else {
      ctx.fillRect(px+cell*0.1,py+cell*0.1,w-cell*0.2,h-cell*0.2);
      ctx.strokeRect(px+cell*0.1,py+cell*0.1,w-cell*0.2,h-cell*0.2);
      ctx.fillStyle='#2f261f'; ctx.fillRect(px+w*0.32,py+h*0.32,w*0.36,h*0.36);
    }
  }
  // boulders
  bouldersLive.forEach(k=>{
    const b=normalizeBoulderDraft(game.boulders[k]), spec=boulderType(b.type), sz=boulderTileSize(b);
    const [x,y]=k.split(',').map(Number), px=X(x), py=Y(y), w=sz.w*cell, h=sz.h*cell;
    ctx.save();
    ctx.fillStyle=mixHex(spec.tone||'#7f8178','#f7f3e8',0.2);
    ctx.strokeStyle=mixHex(spec.tone||'#7f8178','#2c241c',0.25);
    ctx.lineWidth=1.2;
    if (spec.shape==='rect'){
      ctx.fillRect(px+cell*0.08,py+cell*0.18,w-cell*0.16,h-cell*0.28);
      ctx.strokeRect(px+cell*0.08,py+cell*0.18,w-cell*0.16,h-cell*0.28);
    } else {
      ctx.beginPath();
      ctx.ellipse(px+w/2,py+h/2,w*0.42,h*(spec.shape==='oblong'?0.28:0.38),0,0,7);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  });
  // fences and gates
  for (const k in game.fences){ const f=game.fences[k];
    if (f.removed) continue;
    const [x,y]=k.split(',').map(Number), st=fenceStyle(f.style);
    const cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
    ctx.strokeStyle=st.post; ctx.lineWidth=f.style==='brick'?3:1.6;
    [[1,0],[0,1]].forEach(([dx,dy])=>{
      if (!fenceAt(x+dx,y+dy)) return;
      ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(X(x+dx)+cell/2,Y(y+dy)+cell/2); ctx.stroke();
    });
    ctx.fillStyle=f.gate?'#f7f3e8':st.post;
    ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2,cell*0.16),0,7); ctx.fill();
    if (f.gate){ ctx.strokeStyle=st.post; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(3,cell*0.24),0.2,Math.PI*1.3); ctx.stroke(); }
  }
  // lighting fixtures
  lightsLive.forEach(k=>{
    const l=game.lights[k], [x,y]=k.split(',').map(Number), tone=lightTone(l.tone);
    const cx2=X(x)+cell/2, cy2=Y(y)+cell/2, r=Math.max(2.5,cell*0.18);
    ctx.save();
    ctx.fillStyle=mixHex(tone.col,'#f7f3e8',0.22);
    ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(92,84,69,0.42)'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(cx2-r*1.8,cy2); ctx.lineTo(cx2+r*1.8,cy2);
    ctx.moveTo(cx2,cy2-r*1.8); ctx.lineTo(cx2,cy2+r*1.8); ctx.stroke();
    ctx.restore();
  });
  // drifts as smoothed blobs (largest first so small ones read on top)
  const smoothLoop=(loop)=>{
    const pts=loop.map(([x,y])=>{ const [jx,jy]=planJitter(x,y);
      return [X(x+jx*0.6), Y(y+jy*0.6)]; });
    const mid=(a,b2)=>[(a[0]+b2[0])/2,(a[1]+b2[1])/2];
    ctx.beginPath();
    let m=mid(pts[pts.length-1],pts[0]);
    ctx.moveTo(m[0],m[1]);
    for (let i=0;i<pts.length;i++){
      const nxt=mid(pts[i],pts[(i+1)%pts.length]);
      ctx.quadraticCurveTo(pts[i][0],pts[i][1],nxt[0],nxt[1]);
    }
    ctx.closePath();
  };
  comps.forEach(c=>{
    const def=plantDef(c.s,c.v);
    if (isTreeDef(def)) return; // trees become canopy circles below
    const col=planColor(def);
    const loops=traceOutlines(new Set(c.tiles));
    loops.forEach(loop=>{
      smoothLoop(loop);
      ctx.fillStyle=mixHex(col,'#f7f3e8',0.66); ctx.fill();
      ctx.strokeStyle=mixHex(col,'#2c241c',0.25); ctx.lineWidth=1.3; ctx.stroke();
    });
  });
  shrubComps.forEach(c=>drawShrubPlan(ctx,c,codes,cell,X,Y));
  // trees: effective canopy circles, clipped to the plot, plus trunk dot
  treesLive.forEach(k=>{ const p=game.plants[k];
    const [x,y]=k.split(',').map(Number);
    drawTreePlan(ctx,p,x,y,cell,X,Y);
  });
  // bulbs: scatter rings over everything
  bulbsLive.forEach(k=>{
    const b2=game.bulbs[k], [x,y]=k.split(',').map(Number);
    ctx.strokeStyle=planColor(plantDef(b2.s,b2.v)); ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,Math.max(2,cell*0.2),0,7); ctx.stroke();
  });
  // building footprints: exterior site context, deliberately distinct from legacy houses
  (game.buildings||[]).forEach(b=>{
    if (!b || !Array.isArray(b.vertices) || b.vertices.length<3) return;
    ctx.save();
    ctx.fillStyle=b.status==='proposed'?'rgba(201,127,63,.26)':(b.roof||'#9a5f3a')+'88';
    ctx.strokeStyle=b.status==='proposed'?'#b87835':'#4a4238'; ctx.lineWidth=1.5;
    if (b.status==='proposed') ctx.setLineDash([4,3]);
    ctx.beginPath(); b.vertices.forEach(([x,y],i)=>{ if (i) ctx.lineTo(X(x),Y(y)); else ctx.moveTo(X(x),Y(y)); }); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    const r=buildingBounds(b);
    if (r){ ctx.fillStyle='#2c241c'; ctx.font='600 9px IBM Plex Sans'; ctx.textAlign='center';
      ctx.fillText(b.status==='proposed'?'PROPOSED':(b.label||'EXISTING').toUpperCase(),X((r.x0+r.x1+1)/2),Y((r.y0+r.y1+1)/2)+3); }
    ctx.restore();
  });
  // houses
  game.houses.forEach(hh=>{
    ctx.fillStyle='#e3ddd2'; ctx.strokeStyle='#4a4238'; ctx.lineWidth=1.6;
    ctx.fillRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    ctx.strokeRect(X(hh.x),Y(hh.y),hh.w*cell,hh.h*cell);
    const [dX,dY]=doorPos(hh);
    ctx.fillStyle='#4a4238';
    ctx.fillRect(X(dX)+cell*0.3,Y(dY)-2,cell*0.4,3);
    if (hh.w*cell>40){ ctx.font='10px IBM Plex Sans'; ctx.textAlign='center';
      ctx.fillText('HOUSE', X(hh.x)+hh.w*cell/2, Y(hh.y)+hh.h*cell/2+3); }
  });
  // lot boundary: the shape the garden sits on, or the full rectangle when
  // no shape is set — drawn over fills/fixtures so the line reads on top
  ctx.save();
  ctx.strokeStyle='#b8ad95'; ctx.lineWidth=1.4;
  if (game.plotShape){
    ctx.beginPath();
    game.plotShape.forEach(([vx,vy],i)=>{ const px=X(vx), py=Y(vy); i?ctx.lineTo(px,py):ctx.moveTo(px,py); });
    ctx.closePath(); ctx.stroke();
  } else {
    ctx.strokeRect(X(0),Y(0),GW*cell,GH*cell);
  }
  ctx.restore();
  // labels at drift centroids, white halo for legibility
  ctx.textAlign='center';
  comps.forEach(c=>{
    const def=plantDef(c.s,c.v);
    if (isTreeDef(def)){ var lt=c.tiles[0].split(',').map(Number);
      var lx=X(lt[0])+cell/2, ly=Y(lt[1])-cell*0.4; }
    else {
      let sx=0,sy=0;
      c.tiles.forEach(k=>{ const [x,y]=k.split(',').map(Number); sx+=x; sy+=y; });
      var lx=X(sx/c.tiles.length+0.5), ly=Y(sy/c.tiles.length+0.5)+3;
    }
    const fs=Math.max(8,Math.min(13,5+Math.sqrt(c.tiles.length)*2));
    ctx.font=`600 ${fs}px IBM Plex Sans`;
    ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
    const code=codes[c.s+'|'+(c.v||'')];
    ctx.strokeText(code,lx,ly); ctx.fillStyle='#2c241c'; ctx.fillText(code,lx,ly);
  });
  // legend + scale bar
  let ly2=padT+GH*cell+26;
  ctx.textAlign='left'; ctx.font='600 10px IBM Plex Sans';
  ctx.fillStyle='#6e5f48'; ctx.fillText('KEY', padL, ly2-8);
  const colW=(W2-padL*2)/legCols;
  const counts={};
  comps.forEach(c=>{ const id=c.s+'|'+(c.v||''); counts[id]=(counts[id]||0)+c.tiles.length; });
  shrubComps.forEach(c=>{ const id=c.s+'|'+(c.v||''); counts[id]=(counts[id]||0)+c.tiles.length; });
  bulbsLive.forEach(k=>{ const b2=game.bulbs[k], id=b2.s+'|'+(b2.v||'');
    counts[id]=(counts[id]||0)+1; });
  ids.forEach((id,i)=>{
    const [s,v]=id.split('|'), def=plantDef(s,v||null);
    const cx2=padL+(i%legCols)*colW, cy2=ly2+Math.floor(i/legCols)*15;
    ctx.fillStyle=mixHex(planColor(def),'#f7f3e8',0.5);
    ctx.fillRect(cx2,cy2-7,9,9);
    ctx.strokeStyle=mixHex(planColor(def),'#2c241c',0.25); ctx.lineWidth=1;
    ctx.strokeRect(cx2,cy2-7,9,9);
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    const nm=def.name.length>26?def.name.slice(0,25)+'…':def.name;
    ctx.fillText(`${codes[id]} — ${nm} (${counts[id]||0})`, cx2+14, cy2);
  });
  if (lightsLive.length){
    const cy2=ly2+legRows*15, cx2=padL;
    ctx.fillStyle=mixHex(lightTone('warm').col,'#f7f3e8',0.22);
    ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.arc(cx2+4.5,cy2-3,4,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    ctx.fillText(`LIGHT - lighting fixture (${lightsLive.length})`, cx2+14, cy2);
  }
  if (bouldersLive.length){
    const cy2=ly2+(legRows+(lightsLive.length?1:0))*15, cx2=padL;
    ctx.fillStyle=mixHex('#7f8178','#f7f3e8',0.2);
    ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.ellipse(cx2+5,cy2-3,5,3.2,0,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    ctx.fillText(`BOULDER - stone feature (${bouldersLive.length})`, cx2+14, cy2);
  }
  if (treesLive.length){
    const cy2=ly2+(legRows+fixtureRows)*15, cx2=padL;
    ctx.save();
    ctx.strokeStyle='#6e5f48'; ctx.lineWidth=1.1; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(cx2,cy2-3); ctx.lineTo(cx2+22,cy2-3); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='#6e5f48'; ctx.font='10px IBM Plex Sans'; ctx.textAlign='left';
    ctx.fillText('Dashed = mature crown in Established preview; Today shows current reach.', cx2+28, cy2);
  }
  // scale bar: 10 ft
  const ftPx=cell/1.5, bx2=W2-padL-ftPx*10, by2=H2-18;
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(bx2,by2); ctx.lineTo(bx2+ftPx*10,by2); ctx.stroke();
  for (let f=0;f<=10;f+=5){ ctx.beginPath();
    ctx.moveTo(bx2+ftPx*f,by2-4); ctx.lineTo(bx2+ftPx*f,by2+4); ctx.stroke(); }
  ctx.font='9px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillStyle='#2c241c';
  ctx.fillText('10 ft', bx2+ftPx*5, by2-8);
}
function openPlan(){ buildPlanMap(); openOverlay('planScreen','#btnPlanPng'); }
function downloadPlan(){
  $('planCanvas').toBlob(b2=>{
    if (!b2) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b2);
    a.download=`${(game.worldName||'garden').replace(/\s+/g,'-').toLowerCase()}-plan.png`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
}
