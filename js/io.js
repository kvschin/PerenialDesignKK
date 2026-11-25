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
/* A delete REPORTS whether it happened. It used to swallow an IndexedDB error
   and return true, so deleteWorld removed the row, the blob survived, and the
   orphan scan quietly brought the "deleted" garden back on the next visit. */
async function sDel(key){
  const db=await openDB();
  if (db){ try{ await idbRun(db,'readwrite',s=>s.delete(key)); }
    catch(e){ console.warn('storage delete',key,e); return false; } }
  return lsDrop(key);                  // clear both homes
}
function lsDrop(key){
  try{ localStorage.removeItem(key); return localStorage.getItem(key)==null; }
  catch(_){ return false; }
}
/* Several writes as ONE transaction: all of them land or none do. Only
   updateWorldsIndex uses it, for a mutation that must remove a garden's blob
   in the same breath as its row. Without IndexedDB it is best effort in the
   order that fails safe — the deletes first, then the puts, and the deleted
   values put back if a put fails — so a failure leaves the old row pointing at
   the old garden rather than an orphan or a row with nothing behind it. */
async function sWriteBatch(puts,dels){
  const db=await openDB();
  if (db){
    try{ await idbRun(db,'readwrite',s=>{ let r;
      for (const k of dels) r=s.delete(k);
      for (const k in puts) r=s.put(puts[k],k);
      return r; }); }
    catch(e){ console.error('storage batch',e); return false; }
    for (const k of dels) lsDrop(k);   // a pre-migration copy must not resurrect it
    return true;
  }
  const kept={};
  for (const k of dels){
    kept[k]=lsGet(k);
    if (!lsDrop(k)){ for (const j in kept) if (kept[j]!=null) lsSet(j,kept[j]); return false; }
  }
  for (const k in puts) if (!lsSet(k,puts[k])){
    for (const j in kept) if (kept[j]!=null) lsSet(j,kept[j]);
    return false;
  }
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
        gw:blob.gw||blob.grid||31, gh:blob.gh||blob.grid||31, mode:'design', sum:worldRowSummary(blob)});
      adopted.push(blob.name||'Recovered garden');
    }
    return adopted.length?out:null;
  });
  return adopted;
}

/* ---------- every tab on this device, not just this one ----------
   The chain below orders writers inside ONE page. Two tabs of the app are two
   pages with two chains, and they share the same storage: both could read the
   index, each write back only its own change, and the later one erased the
   other's row (audit F02, reproduced in a real browser). A Web Lock is held by
   the browser across every page of the origin, so taking one around the critical
   section makes "a fresh read inside the section" true across tabs as well.

   It must never be the reason a garden does not save. A browser without Web
   Locks (or an opaque origin, where requesting one throws) runs the section
   unlocked, which is exactly what it did before. So does a wait longer than
   WORLDS_LOCK_WAIT: the section holds the lock for a few milliseconds, so a wait
   that long means a holder that has stopped (a frozen tab), and saving without
   the lock is better than not saving. Once the section has started, its own
   failure is reported as it always was, and it is never run twice. */
const WORLDS_LOCK='hortus:worlds', WORLDS_LOCK_WAIT=5000;
function withWorldsLock(fn){
  const locks=typeof navigator!=='undefined' && navigator ? navigator.locks : null;
  if (!locks || typeof locks.request!=='function') return fn();
  let started=false, timer=0;
  const ac=typeof AbortController==='function' ? new AbortController() : null;
  if (ac) timer=setTimeout(()=>ac.abort(),WORLDS_LOCK_WAIT);
  const body=()=>{ started=true; clearTimeout(timer); return fn(); };
  let req;
  try{ req=locks.request(WORLDS_LOCK, ac?{signal:ac.signal}:{}, body); }
  catch(e){ clearTimeout(timer); console.warn('worlds lock',e); return fn(); }
  return Promise.resolve(req).catch(e=>{
    if (started) throw e;
    clearTimeout(timer); console.warn('worlds lock',e);
    return fn();
  });
}
let worldsIndexChain=Promise.resolve();
function updateWorldsIndex(mutate){
  const run=worldsIndexChain.then(()=>withWorldsLock(async()=>{
    const idx=await worldsIndex();
    const out=await mutate(idx.slice());
    if (!out) return null;
    // {index, del:[keys]} also removes those keys in the same transaction
    if (!Array.isArray(out)) return (await sWriteBatch({'hortus:worlds':out.index},out.del||[]))
      ? out.index : null;
    return (await sSet('hortus:worlds',out)) ? out : null;
  }));
  // A throwing mutation must not wedge every later write behind a rejection.
  worldsIndexChain=run.then(()=>{},()=>{});
  return run;
}
/* ---------- a garden open in two tabs (audit F01) ----------
   Each save wrote the tab's whole garden, unconditionally, and a tab saves when
   it is merely put in the background. So a tab opened yesterday and left behind
   wrote yesterday's garden over everything done since in another tab, the moment
   the gardener switched away from it.

   Every garden's ROW carries a `stamp`, and a tab remembers the stamp of the
   version it last loaded or wrote (saveSession.syncId/stamp/syncRev). Inside the
   locked section a save compares the two. A different stamp, or no row at all,
   means another tab has written (or deleted) this garden since, and nothing this
   tab holds is newer than that.

   Only a save that carries EDITS takes a new stamp. A tab with nothing new still
   saves its clock and view, under the stamp it already had, so an idle tab left
   open beside the one being worked in never makes that one's next save look like
   a conflict. And a tab with nothing new that finds itself behind simply stops
   writing: storage already holds a newer version of everything it has.

   When a tab WITH edits is behind, its edits are never written over the other
   version and never thrown away. In the garden, on screen, the gardener chooses
   (screens.js, the stale bar). Anywhere else -- quitting, put in the background,
   the page going away -- nobody can be asked, so they are saved as a copy.

   The stamp lives on the row and not in the garden blob because the row is what
   the locked section already reads; reading the whole blob (a site photo is
   about 1MB) to compare would make every save pay for it. A row without a stamp
   is a garden saved before stamps existed and compares as null. */
const GARDEN_CHANNEL='hortus:gardens';
let gardenChannel=null;
try{ if (typeof BroadcastChannel==='function') gardenChannel=new BroadcastChannel(GARDEN_CHANNEL); }catch(_){ gardenChannel=null; }
/* Tell the other tabs that a garden's stored version moved. The message is only
   a nudge: a tab that hears it re-reads the row and decides from that. */
function announceGardenChange(id){
  if (!gardenChannel || !id) return;
  try{ gardenChannel.postMessage({id}); }catch(_){ }
}
if (gardenChannel) gardenChannel.onmessage=e=>{
  const d=e&&e.data;
  if (!d || typeof d.id!=='string' || !game.inGarden || d.id!==game.worldId) return;
  checkGardenFresh().then(r=>{ if (r && typeof onGardenStale==='function') onGardenStale(r,false); });
};
function pageHidden(){ return typeof document!=='undefined' && !!document.hidden; }
/* Has this tab changed the garden since it last read or wrote it? A session that
   never synced with its garden (a new one, before its first save) counts as
   changed. game.rev moves on every model edit and on nothing else. */
function gardenEditedSinceSync(session,id,rev){
  session=session||saveSession;
  if (id===undefined) id=game.worldId;
  if (rev===undefined) rev=game.rev;
  return !id || session.syncId!==id || rev!==session.syncRev;
}
/* 'changed', 'deleted' or null, for a session that knows this garden. A session
   that never loaded or saved it has nothing to be behind. */
function gardenConflict(session,id,rows){
  if (!id || session.syncId!==id) return null;
  const row=rows.find(w=>w.id===id);
  if (!row) return 'deleted';
  return (row.stamp||null)===(session.stamp||null) ? null : 'changed';
}
function noteGardenStale(reason,session){
  session=session||saveSession;
  session.stale=reason;
}
/* Is the garden open here still the newest stored version? Returns the reason
   it is not, or null. Reads the row inside the locked section, after this tab's
   own saves, so it can never mistake this tab's write for someone else's. */
async function checkGardenFresh(){
  const session=saveSession, id=game.worldId;
  if (!game.inGarden || !hasStorage || !id || session.syncId!==id) return null;
  if (session.stale) return session.stale;
  await pendingSaves();
  let rows=null;
  await updateWorldsIndex(fresh=>{ rows=fresh; return null; });
  if (!rows || session!==saveSession || game.worldId!==id || saveTail) return null;
  const reason=gardenConflict(session,id,rows);
  if (reason) noteGardenStale(reason,session);
  return reason;
}
/* ---------- what the lists need, on the row (audit P01/P02) ----------
   Your gardens and the daily challenge both read EVERY garden in full to draw
   their lists: the whole planting, every scheme, a site photo of about 1MB. With
   100 gardens that was 100 full reads on each opening of either screen (measured
   in Chrome: Your gardens took 400ms to finish reading, the daily screen 280ms),
   and the work grew with the collection rather than with what was on screen.

   So the row carries `sum`, the few facts a list shows: plant count, season,
   schemes, and for a daily attempt its date, whether it is finished and its
   title. Every writer of a row writes it from the garden in hand, so it costs no
   extra write. Your gardens then reads a garden only for its PICTURE, and only as
   its card nears the screen; the daily screen reads only the designs it shows.
   A row from before this has no `sum` and is read once, by
   backfillWorldSummaries, which writes the summaries back. */
const WORLD_SUMMARY_VERSION=1;
function worldRowSummary(blob){
  if (!blob || typeof blob!=='object') return null;
  const m=worldSaveMeta(blob), c=normalizeDailyChallenge(blob.challenge);
  const sum={v:WORLD_SUMMARY_VERSION, plants:m.plants, season:m.season, schemes:m.schemes};
  if (c) sum.daily={date:c.date, done:!!c.completedAt, title:c.title};
  return sum;
}
function worldSummaryCurrent(sum){ return !!sum && sum.v===WORLD_SUMMARY_VERSION; }
/* Rows without a current summary: read their gardens (all at once, as the lists
   used to on every opening) and write the summaries back in one index write. A
   row a save has summarised in the meantime keeps the save's. Returns the index. */
async function backfillWorldSummaries(rows){
  const missing=(rows||[]).filter(r=>r && !worldSummaryCurrent(r.sum));
  if (!missing.length) return rows;
  const found=new Map();
  await Promise.all(missing.map(async r=>{
    const s=worldRowSummary(await sGet(WORLD_KEY_PREFIX+r.id));
    if (s) found.set(r.id,s);
  }));
  if (!found.size) return rows;
  const out=await updateWorldsIndex(fresh=>{
    let n=0;
    for (const r of fresh) if (!worldSummaryCurrent(r.sum) && found.has(r.id)){ r.sum=found.get(r.id); n++; }
    return n?fresh:null;
  });
  return out || await worldsIndex();
}
/* "<name> copy", "<name> copy 2"... against the names already listed. */
function copyGardenName(name,rows){
  const base=(name||'My garden').replace(/ copy(?: \d+)?$/i,'');
  const taken=new Set(rows.map(w=>(w.name||'').toLowerCase()));
  let out=base+' copy';
  for (let n=2; taken.has(out.toLowerCase()); n++) out=`${base} copy ${n}`;
  return out;
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
      gw:legacy.gw||legacy.grid||31, gh:legacy.gh||legacy.grid||31, sum:worldRowSummary(legacy)};
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
      plants:canonicalizePlantMap(compactSoloMap(shiftKeys(e.plants||{},shift))),
      bulbs:canonicalizePlantMap(compactSoloMap(shiftKeys(e.bulbs||{},shift)))}));
    if (game.schemes.some(x=>x.id===sc.active)) game.schemeActive=sc.active;
  }
  ensureSchemes();   // materializes a lone default and nulls the active entry's maps
}
// Covers are optional, bounded JPEGs. Reject arbitrary URLs on load/import;
// a missing, old or undecodable cover simply leaves the map preview in place.
const GARDEN_PORTRAIT_LIMIT=120000;
let gardenPortrait=null;
function normalizeGardenPortrait(p){
  if (!p || p.v!==1 || !Number.isSafeInteger(p.day) || p.day<0 ||
      typeof p.image!=='string' || p.image.length>GARDEN_PORTRAIT_LIMIT ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image)) return null;
  return {v:1,day:p.day,image:p.image};
}
function gardenPortraitKey(){
  return [game.rev,game.groundRev,game.sceneRev,absDay(),game.schemeActive,game.edgeStyle,game.siteNorthDeg].join('|');
}
function rememberGardenPortrait(p){
  const value=normalizeGardenPortrait(p);
  gardenPortrait=value?{key:gardenPortraitKey(),value}:null;
}
/* The original starting site is a small, immutable snapshot, independent of
   the edited garden. Only the layers a daily starter actually uses belong here. */
function normalizeDailySitePlan(p){
  if(!p||p.v!==1||!gardenRecord(p))return null;
  const txt=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
  if(!txt(p.kind,40)||!/^[a-z-]+$/.test(p.kind)||!txt(p.label,80)||!txt(p.description,400)||!txt(p.conditions,400))return null;
  if(![p.gw,p.gh].every(n=>Number.isInteger(n)&&n>=2&&n<=32))return null;
  let shape=null;
  if(p.shape!=null){
    const vs=p.shape;
    if(!Array.isArray(vs)||vs.length!==4||!vs.every(q=>Array.isArray(q)&&q.length===2&&
      q.every(Number.isInteger)&&q[0]>=0&&q[1]>=0&&q[0]<=p.gw&&q[1]<=p.gh)||
      plotEdgesCross(vs[0],vs[1],vs[2],vs[3])||plotEdgesCross(vs[1],vs[2],vs[3],vs[0]))return null;
    shape=vs.map(q=>q.slice());
  }
  const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<p.gw&&y<p.gh&&
    (!shape||polygonContains(x+.5,y+.5,shape));
  let area=0;for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++)if(inside(x,y))area++;
  if(area<9)return null;
  const terrain={},elevation={};
  for(const [name,target] of [['terrain',terrain],['elevation',elevation]]){
    if(!gardenRecord(p[name])||Object.keys(p[name]).length>p.gw*p.gh)return null;
    for(const [key,r] of Object.entries(p[name])){
      const xy=key.split(',').map(Number);
      if(!/^\d+,\d+$/.test(key)||xy.join(',')!==key||!inside(...xy)||!gardenRecord(r))return null;
      if(name==='terrain'){
        /* Water, a meadow and a footbridge joined the bed and the path in
           0.9.165. Mown lawn is never a record (it is bare ground), and a
           crossing is laid only on water, as the Crossing tool lays it. */
        const styles=r.k==='bed'?BED_STYLES:r.k==='path'?PATH_COLORS:r.k==='water'?WATER_STYLES:
          r.k==='lawn'?LAWN_STYLES.filter(s=>!s.none):[];
        if(!styles.some(s=>s.id===r.c))return null;
        if(r.x!==undefined&&(r.k!=='water'||!CROSSING_TYPES.some(s=>s.id===r.x&&s.id!=='none')))return null;
        target[key]=r.x?{k:r.k,c:r.c,x:r.x}:{k:r.k,c:r.c};
      }else{
        if(!Number.isInteger(r.h)||r.h<ELEV_MIN||r.h>ELEV_MAX||!WALL_STYLES.some(s=>s.id===r.w))return null;
        // a step points the way it goes down; soft earth carries the height its profile drew
        if(r.s!==undefined&&!(Number.isInteger(r.s)&&r.s>=1&&r.s<=4))return null;
        if(r.m!==undefined&&(r.m!==true||!Number.isFinite(r.z)||Math.abs(r.z-r.h)>1||r.s!==undefined))return null;
        if(r.m===undefined&&r.z!==undefined)return null;
        target[key]={h:r.h,w:r.w};
        if(r.s)target[key].s=r.s;
        if(r.m){target[key].m=true;target[key].z=r.z;}
      }
    }
  }
  if(!Array.isArray(p.context)||p.context.length>2)return null;
  const context=[];
  for(const q of p.context){
    if(!q||!txt(q.id,40)||!/^[a-z0-9-]+$/.test(q.id)||!inside(q.x,q.y)||typeof q.s!=='string'||
        (q.v!=null&&typeof q.v!=='string'))return null;
    const ref=canonicalPlantRef(q.s,q.v||null), P=Object.prototype.hasOwnProperty.call(PLANTS,ref.s)&&PLANTS[ref.s];
    if(!P||!isTreeDef(P)||(ref.v&&!Object.prototype.hasOwnProperty.call(P.cv||{},ref.v))||
        terrain[q.x+','+q.y]?.k!=='bed'||context.some(a=>a.id===q.id||(a.x===q.x&&a.y===q.y)))return null;
    context.push({id:q.id,s:ref.s,v:ref.v||null,x:q.x,y:q.y});
  }
  return {v:1,kind:p.kind,label:p.label,description:p.description,conditions:p.conditions,gw:p.gw,gh:p.gh,shape,terrain,elevation,context};
}
function normalizeDailyShareOptions(value){
  return {format:['portrait','square','story'].includes(value?.format)?value.format:'portrait',
    season:['current',...SEASONS].includes(value?.season)?value.season:'current'};
}
/* A bounded, self-contained brief. Never reconstruct an old challenge from
   today's catalog: wording, goals and plant choices belong to that attempt.
   Retired rules/strict fields are intentionally dropped, including old saves. */
function normalizeDailyChallenge(c){
  if(!c || typeof c!=='object' || Array.isArray(c) || ![1,2,3].includes(c.v))return null;
  const txt=(s,n)=>typeof s==='string' && s.trim().length>0 && s.length<=n;
  if(!txt(c.id,60)||!/^[a-z0-9-]+$/.test(c.id)||!txt(c.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(c.date))return null;
  const date=new Date(c.date+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==c.date)return null;
  if(!txt(c.title,100)||!txt(c.brief,600)||!txt(c.plants,600)||!SEASONS.includes(c.season))return null;
  const sitePlan=c.v===3?normalizeDailySitePlan(c.sitePlan):null;
  if(c.v===3?(!sitePlan||c.site!==sitePlan.kind):!['border','split','island'].includes(c.site))return null;
  if(!Array.isArray(c.goals)||c.goals.length<1||c.goals.length>6||!c.goals.every(s=>txt(s,240)))return null;
  let match;
  if(c.match!=null){
    if(typeof c.match!=='object'||Array.isArray(c.match))return null;
    match={};
    for(const k of Object.keys(c.match)){
      if(!['keys','types','moist','roles'].includes(k)||!Array.isArray(c.match[k])||!c.match[k].length||c.match[k].length>100||!c.match[k].every(s=>txt(s,80)))return null;
      match[k]=c.match[k].slice();
    }
  }
  let extra={};
  if(c.v>=2){
    const refs=c.palette;
    if(!Array.isArray(refs)||refs.length<1||refs.length>12)return null;
    const palette=[];
    for(const p of refs){
      if(!p||!txt(p.s,80)||(p.v!=null&&!txt(p.v,80)))return null;
      const ref=canonicalPlantRef(p.s,p.v||null);
      if(!Object.prototype.hasOwnProperty.call(PLANTS,ref.s)||
          (ref.v&&!Object.prototype.hasOwnProperty.call(PLANTS[ref.s].cv||{},ref.v)))return null;
      if(palette.some(q=>q.s===ref.s&&(q.v||null)===(ref.v||null)))return null;
      palette.push({s:ref.s,v:ref.v||null});
    }
    extra={palette};
  }
  return {v:c.v,id:c.id,date:c.date,title:c.title,brief:c.brief,plants:c.plants,site:c.site,season:c.season,
    goals:c.goals.slice(),checked:[...new Set((Array.isArray(c.checked)?c.checked:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<c.goals.length))],
    ...(match?{match}:{}),...extra,...(sitePlan?{sitePlan}:{}),share:normalizeDailyShareOptions(c.share),paletteFree:c.paletteFree===true,
    completedAt:Number.isSafeInteger(c.completedAt)&&c.completedAt>0?c.completedAt:null};
}
function buildSaveBlob(){
  const t0=dnow();   // 'blob' in the debug HUD measures snapshot construction
  /* `v` is the schema number, `app` the build that wrote it. Migrations used to
     be feature detection ("if the blob has a `house` key it is old"), which was
     fine while every save in existence was one of ours. An explicit version is
     what lets loadSolo make decisions rather than guesses once strangers own the
     data. Absent `v` means a pre-versioning save, which is version 0. */
  const blob={v:SAVE_VERSION,app:APP_VERSION,
    wv:1,name:game.worldName,
    mode:'design',design:typeof normalizeDesign==='function'?normalizeDesign(game.design):game.design, // design is the only mode
    discovery:typeof normalizeDiscovery==='function' ? normalizeDiscovery(game.discovery) : game.discovery,
    gw:GW,gh:GH,rot:game.rot,siteNorthDeg:normalizeSiteNorthDeg(game.siteNorthDeg),plotShape:game.plotShape,freePlanting:game.freePlanting,previewMode:game.previewMode,
    edgeStyle:game.edgeStyle,
    layerVis:normalizeLayerVis(game.layerVis),
    pathColor:game.pathColor,bedStyle:game.bedStyle,waterStyle:game.waterStyle,lawnStyle:game.lawnStyle,
    fenceDraft:game.fenceDraft,pergolaDraft:game.pergolaDraft,lightDraft:game.lightDraft,firepitDraft:game.firepitDraft,boulderDraft:game.boulderDraft,waterFeatureDraft:game.waterFeatureDraft,supportDraft:game.supportDraft,petDraft:game.petDraft,potDraft:game.potDraft,seatDraft:game.seatDraft,ornamentDraft:game.ornamentDraft,wallDraft:game.wallDraft,terraceDraft:game.terraceDraft,bermDraft:game.bermDraft,edgingDraft:game.edgingDraft,
    buildingStyleDraft:game.buildingStyleDraft,
    underlay:game.underlay?normalizeUnderlay(game.underlay):null,
    startTs:saveStartTs(),elapsedMs:elapsedGameMs(),savedAt:Date.now(),dayOffset:game.dayOffset};
  /* Keyed layers go out WITHOUT tombstones. clearTile leaves {removed:true,t}
     on every erased tile, and loadSolo's GAME_MAPS loop drops them on the way
     back in (compactSoloMap), so nothing that reads a save ever sees one -- yet
     every autosave was structuredCloning and writing all of them, and a session
     of painting and erasing only grows the pile. Compacting here is the same
     filter load applies, one step earlier; the live maps keep their tombstones
     and their identity (undo snapshots and sceneStale read those). */
  for (const L of GAME_LAYERS) blob[L.k]=L.array ? game[L.k] : compactSoloMap(game[L.k]);   // plants/bulbs/terrain/elevation/fences/lights/firepits/boulders/houses
  const challenge=normalizeDailyChallenge(game.challenge); if(challenge)blob.challenge=challenge;
  // where the garden was being looked at (view.js): reopened there, not re-centred
  const view=typeof gardenViewNow==='function' ? gardenViewNow() : null; if (view) blob.view=view;
  const start=normalizeStartProgress(game.startHere); if (start) blob.start=start;   // the start-here checklist (ui.js)
  const schemes=serializeSchemes(); if (schemes) blob.schemes=schemes;
  // Changed gardens/day/scheme use the current map until the next exit makes
  // a fresh portrait. Ordinary autosaves never render or encode an image.
  if (gardenPortrait && gardenPortrait.key===gardenPortraitKey() && gardenPortrait.value.day===absDay())
    blob.portrait=gardenPortrait.value;
  dev('blob',t0);
  return blob;
}
/* game.worldId is the key a save writes under, so a garden being loaded must
   not be saveable until its contents have actually arrived: opening garden B
   used to adopt B's id first and await the read second, and any autosave in
   that window (a day change is 20s, and backgrounding the app fires one)
   wrote garden A's still-loaded layers under B's id. The guard lives in
   saveSolo because there are eighteen call sites and one of them is a render-
   adjacent helper; guarding the callers is how the next one gets missed. */
let loadingWorld=false;
function beginWorldLoad(){ resetGardenAutosave(); loadingWorld=true; }
function endWorldLoad(){ loadingWorld=false; if (game.dirty) requestGardenAutosave(); }
/* Edits save independently of garden time. One timer coalesces an entire
   stroke; tile mutations only move its deadline, never clone the garden.
   A held/cancelable gesture and a photo draft must settle before it writes. */
const AUTOSAVE_DELAY=750, AUTOSAVE_RETRY_DELAY=5000;
let autosaveTimer=0, autosaveDue=0, saveSession={}, saveRequest=0;
function cancelGardenAutosave(){
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer=0;
}
function resetGardenAutosave(){ cancelGardenAutosave(); saveSession={}; gardenPortrait=null; }
function requestGardenAutosave(delay=AUTOSAVE_DELAY){
  if (!game.inGarden || !hasStorage || loadingWorld) return;
  autosaveDue=Date.now()+delay;
  if (autosaveTimer) return;
  const session=saveSession, id=game.worldId;
  const run=()=>{
    if (session!==saveSession) return;
    autosaveTimer=0;
    // The first queued save can mint this session's id after an edit armed us.
    if ((id||session.id||null)!==(game.worldId||null) || !game.inGarden || !game.dirty || loadingWorld) return;
    const wait=autosaveDue-Date.now();
    if (wait>0 || pendSnap || game.photoEditing){
      autosaveTimer=setTimeout(run,Math.max(wait,AUTOSAVE_DELAY)); return;
    }
    return saveSolo(true);
  };
  autosaveTimer=setTimeout(run,delay);
}
/* A silent autosave that fails silently is exactly how a session's work
   disappears with nobody noticing — autosave fires on every day change, so the
   old code could fail two hundred times without a word. It now speaks once and
   then stays quiet until a save succeeds again; a toast per day change would be
   its own bug. The message names the way out (export) rather than the cause. */
let saveFailureReported=false;
/* Saves COALESCE: one in flight, at most one more queued behind it.
   A save is a whole-garden clone plus two IndexedDB writes on the serialized
   index chain, and it used to be fire-and-forget from every call site — with
   the day change among them. Under a held fast-forward the calendar ticks
   every DAY_MS/FF_RATE = 500ms, so that was a full save twice a second,
   indefinitely, with nothing to stop a second starting behind the first.
   Stacking them cannot help anyone: a later save writes a strictly newer blob
   over the earlier one, so every queued save is waste that still pins its own
   clone of the garden and its own pair of writes. Once they arrive faster than
   they land the backlog only grows, and it outlives the gesture — the reload
   afterwards waits on all of it, which is what turned a refresh into twenty
   seconds of nothing. Reproduced at queue depth 7 by making writes slower than
   the tick; with this guard the depth is 1 and the trailing save carries the
   newest state. */
let saveTail=null, saveQueued=null, saveQueuedSilent=true;
/* Everything a reopen has to wait for: the save running now, plus the one
   coalesced behind it. A queued save has NOT reached worldsIndexChain yet, so
   awaiting that chain alone would let loadSolo read a blob older than the edit
   the gardener just made — the exact staleness the chain was added to prevent. */
function pendingSaves(){ return saveQueued || saveTail || Promise.resolve(); }
function saveSolo(silent){
  if (!saveTail){
    const run=saveSoloNow(silent);
    saveTail=run.then(()=>{},()=>{}).then(()=>{ saveTail=null; });
    return run;                            // callers see this save's own result
  }
  if (!silent) saveQueuedSilent=false;     // a manual save still reports when it lands
  if (!saveQueued){
    saveQueued=saveTail.then(()=>{
      saveQueued=null;
      const s=saveQueuedSilent; saveQueuedSilent=true;
      return saveSolo(s);                  // one trailing save, carrying the newest state
    });
  }
  return saveQueued;                       // everyone who arrived meanwhile awaits it
}
async function saveSoloNow(silent){
  if (!hasStorage){ toast('No save storage here — garden lives this session only.'); return; }
  // A load is in flight: game.* still holds the OUTGOING garden. Silent by
  // design — nothing has gone wrong, and the load will save when it lands.
  if (loadingWorld) return false;
  const session=saveSession;
  // The gardener chose to leave this garden without saving it (the stale bar).
  if (session.discard) return true;
  cancelGardenAutosave();
  const id=game.worldId, rev=game.rev, request=++saveRequest;
  const edited=gardenEditedSinceSync(session,id||session.id,rev);
  game.dirty=true;
  let stored=null, written=null, outcome=null;
  try{
    // Capture before ANY await: a queued save must not acquire a later
    // garden's name/layers, nor share mutable maps with subsequent edits.
    const live=buildSaveBlob();
    const blob=typeof structuredClone==='function' ? structuredClone(live) : JSON.parse(JSON.stringify(live));
    stored=await updateWorldsIndex(async fresh=>{
      const target=id || session.id || (session.id=newWorldId(new Set(fresh.map(w=>w.id))));
      if (session===saveSession && !game.worldId) game.worldId=target;
      if (session.discard){ outcome={discarded:true}; return null; }
      // Behind another tab? See "a garden open in two tabs" above.
      const conflict=gardenConflict(session,target,fresh);
      let slot=target;
      if (conflict){
        if (!edited && !session.fork){ outcome={stale:conflict}; return null; }
        // On screen, in the garden: leave the choice to the gardener.
        if (!session.fork && session===saveSession && game.inGarden && !pageHidden()){
          outcome={stale:conflict}; return null;
        }
        slot=newWorldId(new Set(fresh.map(w=>w.id)));
        const from=blob.name||'My garden';
        blob.name=copyGardenName(from,fresh);
        outcome={copy:slot,name:blob.name,from,reason:conflict};
      }
      let saved=await sSet('hortus:world:'+slot,blob);
      if (!saved && blob.portrait){
        // An optional picture must never be what prevents saving the garden.
        delete blob.portrait; saved=await sSet('hortus:world:'+slot,blob);
      }
      if (!saved){ outcome=null; return null; }
      // Only edits move the stamp; a new row, or a session that never read this
      // one, starts one of its own.
      const stamp=(edited || conflict || session.syncId!==slot) ? newId('s') : (session.stamp||null);
      const out=fresh.filter(w=>w.id!==slot);
      const row={id:slot,name:blob.name||'My garden',ts:blob.savedAt,gw:blob.gw,gh:blob.gh,mode:'design',sum:worldRowSummary(blob)};
      if (stamp) row.stamp=stamp;
      out.push(row);
      written={slot,stamp,moved:stamp!==(session.stamp||null)};
      return out;
    });
  }catch(e){ console.error('garden save',e); }
  const current=session===saveSession && game.worldId===(id||session.id) && request===saveRequest;
  if (outcome && outcome.discarded) return true;
  if (outcome && outcome.stale){
    noteGardenStale(outcome.stale,session);
    if (!edited){
      // Storage already holds a newer version of everything this tab has.
      if (current && game.rev===rev) game.dirty=false;
    }
    if (session===saveSession && typeof onGardenStale==='function') onGardenStale(outcome.stale,false);
    return !edited;
  }
  if (stored && written){
    session.syncId=written.slot; session.stamp=written.stamp; session.syncRev=rev;
    session.fork=false;              // a request to copy applies to one conflict, not every later one
    if (written.moved) announceGardenChange(written.slot);
  }
  if (stored && outcome && outcome.copy){
    session.stale=null; session.fork=false;
    // Carry on in the copy, unless this tab has already moved on to another garden.
    const adopt=current;
    if (adopt){ game.worldId=outcome.copy; game.worldName=outcome.name; }
    if (current && game.rev===rev) game.dirty=false;
    saveFailureReported=false;
    if (typeof onGardenForked==='function') onGardenForked(outcome,adopt);
    return true;
  }
  if (!stored){
    if (!silent || !saveFailureReported){
      saveFailureReported=true;
      toast('This garden could not be saved — device storage may be full. Export it from the menu to keep it.','warn');
    }
    if (current) requestGardenAutosave(AUTOSAVE_RETRY_DELAY);
    return false;
  }
  // An older write finishing is not evidence that a newer edit has saved.
  if (current && game.rev===rev) game.dirty=false;
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
/* Files are untrusted data, including files written by a newer app. Validate
   without changing game/GW/GH or silently dropping part of someone's garden.
   Missing optional fields and pre-versioning saves keep their load defaults. */
const GARDEN_FILE_MAX_BYTES=16*1024*1024;
const GARDEN_FILE_MAX_SIDE=256; // above the UI's 133 tiles; leaves room for older plots
function gardenRecord(v){ return v!==null && typeof v==='object' && !Array.isArray(v); }
function gardenFileProblem(env){
  /* `pocketPrairie:1` is the garden FILE FORMAT's marker, from when the app was
     called Pocket Prairie (renamed SeedHead in 0.9.173). It is not a name anyone
     reads, and every garden file shared before the rename carries it, as do the
     older builds that will open a file shared after it, so it stays as it is. */
  if (!gardenRecord(env) || env.pocketPrairie!==1 || !gardenRecord(env.world))
    return 'That does not look like a SeedHead garden.';
  if (env.v!==undefined && env.v!==1)
    return 'This garden file uses an unsupported format. Update SeedHead or export it again from the original app.';
  const w=env.world;
  if (w.v!==undefined && (!Number.isInteger(w.v) || w.v<0 || w.v>SAVE_VERSION))
    return 'This garden uses an unsupported save version. Update SeedHead before importing it.';
  // Bound recursive data and forbid keys that can change a map's prototype.
  // This also catches JSON numbers such as 1e999 before they reach geometry.
  let nodes=0;
  const jsonOk=(v,depth=0)=>{
    if (++nodes>500000 || depth>24) return false;
    if (v===null || typeof v==='boolean' || typeof v==='string') return true;
    if (typeof v==='number') return Number.isFinite(v) && Math.abs(v)<=Number.MAX_SAFE_INTEGER;
    if (typeof v!=='object') return false;
    return Object.keys(v).every(k=>!['__proto__','prototype','constructor'].includes(k) && jsonOk(v[k],depth+1));
  };
  if (!jsonOk(env)) return 'This garden contains invalid data. Export a fresh copy from the original garden.';
  if (JSON.stringify(env).length>GARDEN_FILE_MAX_BYTES) return 'This garden file is too large to import (maximum 16 MB).';
  const has=k=>Object.prototype.hasOwnProperty.call(w,k);
  const side=n=>Number.isInteger(n) && n>=2 && n<=GARDEN_FILE_MAX_SIDE;
  if (['gw','gh','grid'].some(k=>has(k) && !side(w[k])) || has('gw')!==has('gh'))
    return 'This garden has invalid plot dimensions.';
  const string=(o,k)=>o[k]===undefined || typeof o[k]==='string';
  const number=(o,k)=>o[k]===undefined || (typeof o[k]==='number' && Number.isFinite(o[k]));
  if (!string(w,'name') || !string(w,'app') || !string(w,'mode')) return 'This garden has invalid name or version data.';
  if (['rot','siteNorthDeg','startTs','elapsedMs','savedAt','dayOffset','wv'].some(k=>!number(w,k)) ||
      (has('rot') && (!Number.isInteger(w.rot) || w.rot<0 || w.rot>3))) return 'This garden has invalid view or time data.';
  // Off-plot integer records are retained for legacy saves; enormous or
  // fractional map keys are never valid tile addresses.
  const coord=n=>Number.isInteger(n) && Math.abs(n)<=GARDEN_FILE_MAX_SIDE*2;
  const point=p=>Array.isArray(p) && p.length===2 && p.every(coord);
  const tileKey=k=>/^-?\d+,-?\d+$/.test(k) && k.split(',').every(n=>coord(Number(n)));
  const mapProblem=(map,layer)=>{
    if (!gardenRecord(map)) return `This garden has an invalid ${layer} layer.`;
    if (Object.keys(map).length>GARDEN_FILE_MAX_SIDE*GARDEN_FILE_MAX_SIDE)
      return `This garden's ${layer} layer is too large.`;
    for (const [key,p] of Object.entries(map)){
      if (!tileKey(key) || !gardenRecord(p) || !number(p,'t') ||
          (p.removed!==undefined && typeof p.removed!=='boolean')) return `This garden has an invalid ${layer} record.`;
      if (p.removed) continue;
      if (p.ex!==undefined && typeof p.ex!=='boolean') return 'This garden contains invalid existing-site data.';
      if (layer==='plants' || layer==='bulbs'){
        if (typeof p.s!=='string' || (p.v!=null && typeof p.v!=='string') ||
            (p.dailySiteId!=null&&(typeof p.dailySiteId!=='string'||!/^[a-z0-9-]{1,40}$/.test(p.dailySiteId))) ||
            !Number.isFinite(p.d) || ['ox','oy'].some(k=>!number(p,k))) return 'This garden contains an invalid plant record.';
        const ref=canonicalPlantRef(p.s,p.v), P=Object.prototype.hasOwnProperty.call(PLANTS,ref.s)&&PLANTS[ref.s];
        if (!P || (ref.v && (!P.cv || !Object.prototype.hasOwnProperty.call(P.cv,ref.v))))
          return 'This garden contains a plant or variety this version cannot read. Update SeedHead before importing it.';
      } else if (layer==='terrain'){
        if (!isTerrainKind(p.k) || !string(p,'c') || !string(p,'e') || !string(p,'x')) return 'This garden contains invalid ground material data.';
      } else if (layer==='elevation'){
        if (!Number.isInteger(p.h) || p.h<ELEV_MIN || p.h>ELEV_MAX || !string(p,'w') ||
            (p.s!==undefined && !(Number.isInteger(p.s) && p.s>=1 && p.s<=4)) ||
            // a berm (0.9.156): mounded, and the exact height its profile drew, within a level of its own
            (p.m!==undefined && typeof p.m!=='boolean') ||
            (p.z!==undefined && !(Number.isFinite(p.z) && Math.abs(p.z-p.h)<=1))) return 'This garden contains invalid elevation data.';
      } else {
        // Material IDs can have legacy aliases; their existing normalizers own
        // that migration. Their types must still be safe for the renderers.
        if (['style','type','tone','shape','size','species','coat','mark','paws','finish'].some(k=>!string(p,k)) ||
            ['height','face'].some(k=>!number(p,k)) || (p.gate!==undefined && typeof p.gate!=='boolean'))
          return `This garden contains invalid ${layer} data.`;
      }
    }
    return null;
  };
  for (const L of GAME_MAPS){
    if (L.k!=='plants' && !has(L.k)) continue;
    const issue=mapProblem(w[L.k],L.k); if (issue) return issue;
  }
  const polygon=vs=>Array.isArray(vs) && vs.length>=4 && vs.length<=4096 && vs.every(point) &&
    Math.abs(vs.reduce((area,p,i)=>{ const q=vs[(i+1)%vs.length]; return area+p[0]*q[1]-q[0]*p[1]; },0))>0;
  if (w.plotShape!=null){
    const gw=w.gw||w.grid||31, gh=w.gh||w.grid||31, vs=w.plotShape;
    if (!polygon(vs) || vs.length!==4 || vs.some(p=>p[0]<0||p[1]<0||p[0]>gw||p[1]>gh) ||
        plotEdgesCross(vs[0],vs[1],vs[2],vs[3]) || plotEdgesCross(vs[1],vs[2],vs[3],vs[0]))
      return 'This garden has an invalid plot outline.';
    let enclosed=0;
    for (let y=0;y<gh && enclosed<9;y++) for (let x=0;x<gw && enclosed<9;x++)
      if (polygonContains(x+.5,y+.5,vs)) enclosed++;
    if (enclosed<9) return 'This garden has an invalid plot outline.';
  }
  const extent=n=>Number.isInteger(n) && n>=1 && n<=GARDEN_FILE_MAX_SIDE;
  const house=h=>gardenRecord(h) && coord(h.x) && coord(h.y) && extent(h.w) && extent(h.h) &&
    string(h,'wall') && string(h,'roof') && (h.sizeFt===undefined ||
      (Array.isArray(h.sizeFt) && h.sizeFt.length===2 && h.sizeFt.every(n=>Number.isFinite(n)&&n>0)));
  if ((has('houses') && (!Array.isArray(w.houses) || w.houses.length>4096 || !w.houses.every(house))) ||
      (w.house!=null && !house(w.house))) return 'This garden contains invalid house data.';
  if (has('buildings') && (!Array.isArray(w.buildings) || w.buildings.length>4096 ||
      w.buildings.some(b=>!gardenRecord(b) || !polygon(b.vertices) ||
        ['id','label','status','fill','edge','wall','roof'].some(k=>!string(b,k))))) return 'This garden contains an invalid building outline.';
  if (w.schemes!==undefined){
    const sc=w.schemes;
    if (!gardenRecord(sc) || !Array.isArray(sc.list) || !sc.list.length || sc.list.length>MAX_SCHEMES ||
        typeof sc.active!=='string') return 'This garden contains invalid planting schemes.';
    const ids=new Set();
    for (const s of sc.list){
      if (!gardenRecord(s) || typeof s.id!=='string' || !s.id || ids.has(s.id) || !string(s,'name') || !number(s,'t'))
        return 'This garden contains invalid planting scheme names or IDs.';
      ids.add(s.id);
      for (const layer of SCHEME_LAYERS){
        if (s.id===sc.active && s[layer]==null) continue; // active maps live at the top level
        if (s.id!==sc.active && layer==='bulbs' && s[layer]===undefined) continue;
        const issue=mapProblem(s[layer],layer); if (issue) return issue;
        if (s.id===sc.active && Object.keys(s[layer]).length) return 'This garden has conflicting active planting scheme data.';
      }
    }
    if (!ids.has(sc.active)) return 'This garden is missing its active planting scheme.';
  }
  if (w.underlay!=null && (!gardenRecord(w.underlay) || !normalizeUnderlay(w.underlay))) return 'This garden contains an invalid site photo.';
  if (w.challenge!=null && !normalizeDailyChallenge(w.challenge)) return 'This garden contains an invalid daily design brief.';
  if (w.view!=null && !normalizeGardenView(w.view)) return 'This garden contains an invalid saved view.';
  for (const k of ['start','design','discovery','layerVis','fenceDraft','pergolaDraft','lightDraft','firepitDraft','waterFeatureDraft','supportDraft','boulderDraft','petDraft','potDraft','seatDraft','ornamentDraft','buildingStyleDraft'])
    if (w[k]!=null && !gardenRecord(w[k])) return `This garden contains invalid ${k} settings.`;
  return null;
}
async function loadSolo(id){
  await pendingSaves();             // a coalesced save is not on the chain yet
  await worldsIndexChain;           // reopening after Quit must see its queued save
  /* The garden and its row are read together inside the locked section, so the
     stamp this tab remembers is the stamp of the version it actually read. Read
     apart, another tab's save could land between them: this tab would hold the
     old garden under the new stamp, and its next save would go over the newer
     one unnoticed -- the very thing the stamp is for. */
  let s=null, row=null;
  await updateWorldsIndex(async fresh=>{
    s=await sGet('hortus:world:'+id); row=fresh.find(w=>w.id===id)||null;
    return null;
  });
  if (!s) return false;
  // plot size: gw/gh (current), grid (square-era), or neither (13x13 era,
  // laid out around tile (6,6) — recenter on the classic plot)
  setWorldSize(s.gw||s.grid||31, s.gh||s.grid||31);
  setPlotShape(s.plotShape||null);   // tolerates absence: legacy saves load as full rectangles
  const shift = (s.gw||s.grid) ? 0 : SPAWNX-6;
  // `mode` is vestigial: story gardens were retired with the avatar, so an old
  // story save simply opens in the planner (its house and plants come along).
  game.design = typeof normalizeDesign==='function' ? normalizeDesign(s.design) : (s.design||null);
  game.challenge=normalizeDailyChallenge(s.challenge);
  game.savedView=normalizeGardenView(s.view);   // applied by enterGarden, then dropped
  game.startHere=normalizeStartProgress(s.start);
  // Old saves predate discovery lenses.  Garden criteria is still the source
  // of truth; the global filters value only supplies compatibility/defaults.
  if (game.design && typeof normalizeFilters==='function') game.filters=normalizeFilters(game.design);
  game.discovery=typeof normalizeDiscovery==='function' ? normalizeDiscovery(s.discovery) : (s.discovery||game.discovery);
  game.previewMode = s.previewMode==='today' ? 'today' : 'established';
  game.edgeStyle = (s.edgeStyle==='formal'||s.edgeStyle==='organic') ? s.edgeStyle : edgeStyleFromType(s.design&&s.design.type);
  game.layerVis = normalizeLayerVis(s.layerVis);
  game.underlay=normalizeUnderlay(s.underlay); game.photoEditing=false;
  game.siteNorthDeg=normalizeSiteNorthDeg(s.siteNorthDeg); game.siteNorthPreviewDeg=null;
  for (const L of GAME_MAPS){
    const compact=compactSoloMap(shiftKeys(s[L.k]||{},shift));
    game[L.k]=(L.k==='plants'||L.k==='bulbs') ? canonicalizePlantMap(compact) : compact;
  }   // keyed layers, without solo tombstones; retired plant refs converge here
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
  // Older saves have no lawn brush; lawnStyleId falls back to the 'mown' none
  // row, which would silently arm the eraser, so name the default explicitly.
  game.lawnStyle=lawnStyleId(s.lawnStyle||'meadow');
  game.freePlanting=!!s.freePlanting;
  game.fenceDraft=normalizeFenceDraft(s.fenceDraft);
  game.lightDraft=normalizeLightDraft(s.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(s.firepitDraft);
  game.waterFeatureDraft=normalizeWaterFeatureDraft(s.waterFeatureDraft);
  game.supportDraft=normalizeSupportDraft(s.supportDraft);
  game.boulderDraft=normalizeBoulderDraft(s.boulderDraft);
  game.petDraft=normalizePetDraft(s.petDraft);
  game.potDraft=normalizePotDraft(s.potDraft);
  game.seatDraft=normalizeSeatDraft(s.seatDraft);
  game.ornamentDraft=normalizeOrnamentDraft(s.ornamentDraft);
  game.wallDraft=wallStyleId(s.wallDraft);
  game.terraceDraft=normalizeTerraceDraft(s.terraceDraft);
  game.bermDraft=normalizeBermDraft(s.bermDraft);
  game.edgingDraft=edgingStyleId(s.edgingDraft);
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
  rememberGardenPortrait(s.portrait);
  // What this tab now holds (enterWorld moves syncRev past the opening's own
  // tidying, which is not an edit). A garden is known through its ROW: a blob
  // with no row yet (adopted or written by hand) is unknown until this tab's
  // first save lists it, rather than "deleted in another tab".
  saveSession.syncId=row?id:null; saveSession.stamp=(row&&row.stamp)||null; saveSession.syncRev=game.rev;
  saveSession.stale=null;
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
  const order=plantingQuantities();   // the plan's own numbers, summed per stand
  [game.plants,game.bulbs].forEach(layer=>{
    for (const k in layer){ const p=layer[k];
      if (!p.removed && p.s && !p.ex){ const ck=p.s+'|'+(p.v||'');        // existing plants are not ordered
        counts[ck]=(counts[ck]||0)+1; } }
  });
  return Object.keys(counts).map(ck=>{
    const [s,v]=ck.split('|'), P=plantDef(s,v||null), n=counts[ck];
    const region=activeFilters().nativeRegion;
    return {name:P.name, latin:P.latin, origin:nativeOriginText(P),
      nativeStatus:nativeStatusText(P,region), provenance:provenanceLabel(P), count:n,
      localNative:LOCAL_NATIVE_UNKNOWN,
      areaFt:Math.round(n*(TILE_IN/12)*(TILE_IN/12)*10)/10,
      space:P.space,
      // one definition of "how many plants does this planting take", shared
      // with the plan's per-stand labels and its schedule
      order:order[ck]||0};
  }).sort((a,b)=>b.count-a.count);
}
/* Containers and seating are real things to buy, and a pot is a different line
   from a bed: one plant, one vessel, a bag of compost — not an area at a
   spacing. The plants inside pots still count as plants (they are ordinary
   plants on ordinary tiles), so this is a SUMMARY beside the species table
   rather than a change to it. */
/* Everything the garden is MADE of, as order lines. The table is headed
   "Surfaces & hardscape" and for a long time it billed lawn, edging, retaining
   wall, containers, seating and water features -- while the FENCE, usually the
   biggest single line in a build, the PAVING, which nobody can order without a
   square footage, and every fixture you buy one of were simply absent. Lawn area
   went in because a garden that is two thirds grass came out of here with no
   mention of the surface it is mostly made of. The gravel path beside that lawn
   had exactly the same problem, one material over.
   Three units, and which one a thing takes is a fact about the thing:
     area   a surface you measure   (lawn, paving, bed, water)
     feet   a run you measure       (edging, retaining wall, fence)
     count  a thing you buy         (containers, seats, fixtures, gates, boulders)
   A loose surface also carries its VOLUME on the sub-line, because a cubic yard
   of gravel is what a supplier actually sells; `depth` in the material table is
   what says a surface is loose (see the note over PATH_COLORS). */
/* An ornament on the plan sheet, TO SCALE in its own plan outline -- a sphere a
   circle its real diameter, a compost bay a 3 ft square -- turned the way it
   stands and tinted by its finish, with the one mark that says what it is. It
   is drawn rather than keyed, which is the convention for an object on a
   planting plan; it is there at all because, unlike a pet, it is bought and
   set out. */
/* A placed piece in its OWN frame on the sheet: (u,v) in real inches about the
   middle of its footprint, turned a quarter per `face` exactly as turnAxes turns
   it in the garden (face 1 carries u onto world +y and v onto world -x), so a
   bench's back, a spout's wall and an arch's legs land where the garden draws
   them. Every to-scale symbol on the plan draws through this one frame. */
function planPieceFrame(ctx,cx,cy,ppi,f){
  const Q=(u,v)=>{ const r=f===1?[-v,u]:f===2?[-u,-v]:f===3?[v,-u]:[u,v]; return [cx+r[0]*ppi, cy+r[1]*ppi]; };
  const poly=pts=>{ ctx.beginPath(); pts.forEach((p,i)=>{ const q=Q(p[0],p[1]); if (i) ctx.lineTo(q[0],q[1]); else ctx.moveTo(q[0],q[1]); }); ctx.closePath(); };
  return {Q, poly,
    box:(u0,u1,v0,v1)=>poly([[u0,v0],[u1,v0],[u1,v1],[u0,v1]]),
    ring:(u,v,r)=>{ const q=Q(u,v); ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(0.8,r*ppi),0,7); },
    line:(a,b)=>{ const p=Q(a[0],a[1]), q=Q(b[0],b[1]); ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); }};
}
function drawPlanOrnament(ctx,x0,y0,cell,d){
  const sp=ornamentKind(d.kind), fin=ornamentFinish(d.finish), sz=ornamentTileSize(d);
  const ppi=cell/TILE_IN, cx=x0+sz.w*cell/2, cy=y0+sz.h*cell/2;
  const {box,ring,line}=planPieceFrame(ctx,cx,cy,ppi,d.face);
  const body=mixHex(fin.body,'#f7f3e8',0.4), mark='rgba(79,71,59,0.8)';
  ctx.save();
  ctx.fillStyle=body; ctx.strokeStyle='#4f473b'; ctx.lineWidth=1.1;
  const solid=()=>{ ctx.fill(); ctx.stroke(); ctx.strokeStyle=mark; ctx.lineWidth=0.8; };
  switch(sp.form){
    case 'sphere':
      ring(0,0,sp.wIn/2); solid();
      ctx.fillStyle='rgba(255,255,255,0.8)'; ring(-sp.wIn*0.17,-sp.wIn*0.17,sp.wIn*0.09); ctx.fill(); break;
    case 'gazing':
      ring(0,0,4.8); solid(); ctx.fillStyle=mixHex(fin.body,'#202020',0.25); ring(0,0,2.8); ctx.fill(); break;
    case 'armillary':
      box(-6,6,-6,6); solid(); ring(0,0,8.2); ctx.stroke(); line([-8.2,0],[8.2,0]); line([0,-8.2],[0,8.2]); break;
    case 'sundial':
      box(-7,7,-7,7); solid(); ring(0,0,5.6); ctx.stroke(); line([0,-3.6],[0,3.4]); break;
    case 'lantern':
      box(-10.2,10.2,-10.2,10.2); solid();
      line([-10.2,-10.2],[10.2,10.2]); line([10.2,-10.2],[-10.2,10.2]); box(-2.4,2.4,-2.4,2.4); ctx.stroke(); break;
    case 'feeder':
      ring(5.2,0,2.9); solid();
      ctx.setLineDash([2,2]); line([-5.2,0],[2.3,0]); ctx.setLineDash([]);
      ctx.fillStyle='#2a2a2a'; ring(-5.2,0,1); ctx.fill(); break;
    case 'nestbox':
      box(-4.7,4.7,-4.9,5.9); solid(); line([-2.2,5.9],[2.2,5.9]); line([0,4.4],[0,5.9]); break;
    case 'hotel':
      box(-12,12,-5.5,5.5); solid(); line([-12,0],[12,0]); break;
    case 'barrel':
      ring(0,0,11.4); solid(); ring(0,0,3.9); ctx.stroke(); break;
    case 'compost':
      box(-18,18,-18,18); solid();
      ctx.save(); box(-16.4,16.4,-16.4,16.4); ctx.clip();
      for (let t=-36;t<=36;t+=4) line([t-18,-18],[t+18,18]);
      ctx.restore(); break;
  }
  ctx.restore();
}
/* A container TO SCALE: a round pot a circle its real diameter, a square or
   timber box a square, a trough a 14 in deep rectangle along its length and
   turned the way it stands, tinted by its colour, with the soil line inside the
   rim. A trough used to be a circle as wide as the trough is long. */
function drawPlanPot(ctx,x0,y0,cell,p){
  const d=normalizePotDraft(p), st=potStyle(d.style), sz=potTileSize(d), r=potSizeDef(d.size).wIn/2;
  const ppi=cell/TILE_IN, {box,ring}=planPieceFrame(ctx,x0+sz.w*cell/2,y0+sz.h*cell/2,ppi,d.face);
  const hd=st.form==='trough' ? 7 : r;          // drawPotArt's trough is 14 in across
  const boxy=st.form==='square'||st.form==='crate'||st.form==='trough';
  const shape=k=>boxy ? box(-r+k,r-k,-hd+k,hd-k) : ring(0,0,r-k);
  ctx.save();
  ctx.fillStyle=mixHex(potColors(d).body,'#f7f3e8',0.55); ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.2;
  shape(0); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(92,84,69,0.55)'; ctx.lineWidth=0.9;
  shape(Math.min(r,hd)*0.38); ctx.stroke();
  ctx.restore();
}
/* A water feature TO SCALE in its own outline, the vessel tinted by its finish
   and the water blue with the concentric rings a drawn plan gives water. A
   bubbler's gravel reservoir is the dotted ring round it; a wall spout's wall is
   the heavy bar on its back side. They were all one ellipse 84% of the tiles
   they claim, so a 26 in birdbath and a 34 in millstone drew the same. */
function drawPlanWaterFeature(ctx,x0,y0,cell,d){
  d=normalizeWaterFeatureDraft(d);
  const sp=waterFeature(d.form), fin=waterFinish(d.finish), sz=waterFeatureTileSize(d);
  const ppi=cell/TILE_IN, {box,ring,line}=planPieceFrame(ctx,x0+sz.w*cell/2,y0+sz.h*cell/2,ppi,d.face);
  const R=sp.wIn/2, hu=sp.wIn/2, hv=sp.dIn/2, ink='#4f473b';
  ctx.save(); ctx.lineWidth=1.1; ctx.strokeStyle=ink;
  const vessel=()=>{ ctx.fillStyle=mixHex(fin.body,'#f7f3e8',0.4); ctx.fill(); ctx.stroke(); };
  const pool=()=>{ ctx.fillStyle='#a9d2df'; ctx.fill(); ctx.strokeStyle='#3f5f6b'; ctx.lineWidth=0.9; ctx.stroke();
    ctx.strokeStyle=ink; ctx.lineWidth=1.1; };
  const rings=r=>{ ctx.save(); ctx.strokeStyle='rgba(63,95,107,0.55)'; ctx.lineWidth=0.8;
    for (const f of [0.62,0.32]){ ring(0,0,r*f); ctx.stroke(); } ctx.restore(); };
  const gravel=()=>{ ctx.save(); ctx.setLineDash([1.5,2.5]); ctx.strokeStyle='rgba(92,84,69,0.7)';
    ring(0,0,R*1.32); ctx.stroke(); ctx.restore(); };
  switch (sp.form){
    case 'pedestal': ring(0,0,R); vessel(); ring(0,0,R*0.8); pool(); rings(R*0.8); break;
    case 'urn':      gravel(); ring(0,0,R); vessel(); ring(0,0,R*0.3); pool(); break;
    case 'millstone':gravel(); ring(0,0,R); vessel(); ring(0,0,R*0.14); pool(); break;
    case 'tiered':   ring(0,0,R); vessel(); ring(0,0,R*0.88); pool(); rings(R*0.88);
                     ring(0,0,R*0.44); vessel(); ring(0,0,R*0.22); vessel(); break;
    case 'tsukubai': box(-hu,hu,-hv,hv); vessel(); ring(0,0,R*0.5); pool(); break;
    case 'spout':
      box(-hu*0.94,hu*0.94,-hv*0.6,hv*0.6); vessel();
      box(-hu*0.94+2,hu*0.94-2,-hv*0.6+2,hv*0.6-2); pool();
      ctx.fillStyle=mixHex(fin.dark||fin.body,'#3b3226',0.3);
      box(-hu*0.88,hu*0.88,-hv*0.72-1.5,-hv*0.72+1.5); ctx.fill();         // the wall it spouts from
      break;
    case 'tank':     ring(0,0,R); vessel(); ring(0,0,R-2.5); pool(); rings(R-2.5); break;
    case 'basin':
      box(-hu,hu,-hv,hv); vessel(); box(-hu+3,hu-3,-hv+3,hv-3); pool();
      ctx.save(); ctx.strokeStyle='rgba(63,95,107,0.55)'; ctx.lineWidth=0.8;
      box(-hu*0.6,hu*0.6,-hv*0.45,hv*0.45); ctx.stroke(); ctx.restore(); break;
    default:         ring(0,0,R); vessel(); ring(0,0,R*0.7); pool();
  }
  ctx.restore();
}
/* Seating TO SCALE, each piece in its own outline: a bench with its back on the
   back side (-v, where seatSolids puts it), an Adirondack between its two wide
   arms, a stool or a bistro table round, a picnic table with a bench either
   side, a lounger with its raised head end. Slats mark timber; stone is plain.
   It was a hatched rectangle the size of the tiles it claims, so a stool, a
   dining table and a lounger were the same drawing, each larger than itself. */
function drawPlanSeat(ctx,x0,y0,cell,s){
  const d=normalizeSeatDraft(s), t=seatType(d.type), fin=seatFinish(d.finish), sz=seatTileSize(d);
  const ppi=cell/TILE_IN, {box,ring,line}=planPieceFrame(ctx,x0+sz.w*cell/2,y0+sz.h*cell/2,ppi,d.face);
  const hu=t.wIn/2, hv=t.dIn/2, ink='#5c5445', back=mixHex(fin.tones[0],'#3b3226',0.45);
  ctx.save(); ctx.strokeStyle=ink; ctx.lineWidth=1.1;
  const solid=()=>{ ctx.fillStyle=mixHex(fin.tones[0],'#f7f3e8',0.45); ctx.fill(); ctx.stroke(); };
  const dark=()=>{ ctx.fillStyle=back; ctx.fill(); ctx.stroke(); };
  const slats=(u0,u1,v0,v1,n)=>{ if (fin.mat==='stone') return;
    ctx.save(); ctx.strokeStyle='rgba(92,84,69,0.5)'; ctx.lineWidth=0.6;
    for (let i=1;i<n;i++){ const v=v0+(v1-v0)*i/n; line([u0,v],[u1,v]); } ctx.restore(); };
  switch (t.form){
    case 'bench':
      box(-hu,hu,-hv,hv); solid(); slats(-hu,hu,-hv+4,hv,4);
      if (fin.mat!=='stone'){ box(-hu,hu,-hv,-hv+4); dark(); }      // a stone bench is a slab, backless
      break;
    case 'adirondack':
      box(-hu+6,hu-6,-hv,hv); solid(); slats(-hu+6,hu-6,-hv+6,hv,4);
      box(-hu,-hu+6,-hv+6,hv-2); solid(); box(hu-6,hu,-hv+6,hv-2); solid();   // the wide arms
      box(-hu+6,hu-6,-hv,-hv+6); dark(); break;                                 // the fan
    case 'chair':
      box(-hu,hu,-hv,hv); solid(); slats(-hu,hu,-hv+3,hv,3); box(-hu,hu,-hv,-hv+3); dark(); break;
    case 'stool':
      if (fin.mat==='stone'){ ring(0,0,hu); solid(); } else { box(-hu,hu,-hv,hv); solid(); slats(-hu,hu,-hv,hv,3); }
      break;
    case 'bistro':
      ring(0,0,hu); solid(); ctx.fillStyle=ink; ring(0,0,1.6); ctx.fill(); break;
    case 'dining':
      box(-hu,hu,-hv,hv); solid(); slats(-hu,hu,-hv,hv,5); break;
    case 'picnic':
      box(-hu,hu,-14.2,14.2); solid(); slats(-hu,hu,-14.2,14.2,5);
      box(-hu,hu,-hv,-hv+10); solid(); box(-hu,hu,hv-10,hv); solid(); break;
    case 'lounger':
      box(-hu,hu,-hv,hv); solid(); slats(-hu,hu,-hv+26,hv,6); box(-hu,hu,-hv,-hv+26); dark(); break;
    default:
      box(-hu,hu,-hv,hv); solid();
  }
  ctx.restore();
}
/* A climbing frame TO SCALE, drawn over the planting the way the pergola is,
   because the climber is planted on it and its blob would hide it: an obelisk a
   square with its four legs and its ridges to the top, a trellis panel a run
   between two posts, an arch its four legs with the overhead span dashed. They
   were on the planting list and missing from the plan altogether. */
function drawPlanSupport(ctx,x0,y0,cell,s){
  const d=normalizeSupportDraft(s), sp=supportStyle(d.style), m=supportMaterial(d.mat), sz=supportTileSize(d);
  const ppi=cell/TILE_IN, {Q,box,line}=planPieceFrame(ctx,x0+sz.w*cell/2,y0+sz.h*cell/2,ppi,d.face);
  const hu=sp.wIn/2, hv=sp.dIn/2, ink=mixHex(m.dark,'#3b3226',0.3), ps=Math.max(2,2*ppi);
  const post=(u,v)=>{ const q=Q(u,v); ctx.beginPath(); ctx.arc(q[0],q[1],ps/2+0.5,0,7); ctx.fill(); };
  ctx.save(); ctx.strokeStyle=ink; ctx.fillStyle=ink; ctx.lineWidth=1.1;
  if (sp.form==='panel'){
    line([-hu,0],[hu,0]);
    ctx.lineWidth=0.7; for (let u=-hu+5;u<hu-1;u+=5) line([u,-hv],[u,hv]);
    post(-hu,0); post(hu,0);
  } else if (sp.form==='wire'){
    // a wire is drawn as one, dashed: the posts and their braces are what is built
    ctx.save(); ctx.setLineDash([2,2]); ctx.lineWidth=0.8; line([-hu,0],[hu,0]); ctx.restore();
    ctx.lineWidth=0.9; line([-hu,0],[-hu+15,0]); line([hu,0],[hu-15,0]);
    post(-hu,0); post(hu,0);
  } else if (sp.form==='fan'){
    // seen from above a fan is a line as wide as its top, standing on one stake
    line([-hu,0],[hu,0]);
    ctx.lineWidth=0.7; for (const u of [-hu,hu]) line([u,-hv],[u,hv]);
    post(0,0);
  } else if (sp.form==='wigwam'){
    // its canes round a circle, leaning in to the tie at the middle
    ctx.lineWidth=0.7;
    for (let i=0;i<sp.poles;i++){ const a=6.2832*i/sp.poles+0.4, q=[hu*Math.cos(a),hv*Math.sin(a)];
      line(q,[0,0]); post(q[0],q[1]); }
    const c=Q(0,0); ctx.beginPath(); ctx.arc(c[0],c[1],Math.max(1.2,ppi*1.6),0,7); ctx.stroke();
  } else if (sp.form==='pillar'){
    box(-hu,hu,-hv,hv); ctx.fill();
  } else if (sp.form==='arch'){
    line([-hu,-hv],[-hu,hv]); line([hu,-hv],[hu,hv]);
    ctx.save(); ctx.setLineDash([3,2]); ctx.lineWidth=0.9; box(-hu,hu,-hv,hv); ctx.stroke(); ctx.restore();
    for (const u of [-hu,hu]) for (const v of [-hv,hv]) post(u,v);
  } else {
    box(-hu,hu,-hv,hv); ctx.stroke();
    ctx.lineWidth=0.7; line([-hu,-hv],[hu,hv]); line([hu,-hv],[-hu,hv]);
    for (const u of [-hu,hu]) for (const v of [-hv,hv]) post(u,v);
  }
  ctx.restore();
}
/* Contours for berms and swales (0.9.156), the way a grading plan draws them: a
   line round the ground standing at or above each level (at or below, in a
   swale), one level (ELEV_RISER_IN) apart, on the heights as drawn, smoothed
   as a bed outline is. Brown up, blue-grey down; the outermost is the toe. */
/* Traced by marching squares over the heights as drawn at the tile centres, the
   ground round a berm counting as grade, so the lines nest the way the ground
   does; the outermost (L 0, dashed) is the toe. A tile outline per level, the
   first cut, smoothed each one on its own and two of them crossed. */
function planContourLoops(){
  const out=[], E=game.elevation ? elevationGrid() : null;
  for (const c of softComponents()){
    const sign=c.swale?-1:1, top=Math.abs(c.swale?c.down:c.up);
    let x0=GW, y0=GH, x1=0, y1=0;
    for (const [x,y] of c.tiles){ if (x<x0) x0=x; if (y<y0) y0=y; if (x>x1) x1=x; if (y>y1) y1=y; }
    x0--; y0--; x1++; y1++;
    const own=new Set(c.tiles.map(([x,y])=>x+','+y));
    const val=(x,y)=>own.has(x+','+y) ? sign*E.sc[y*GW+x] : 0;
    for (let L=0;L<=top;L++){
      const lv=L ? L-0.02 : 0.08;
      for (const pts of marchContours(val,x0,y0,x1,y1,lv)) out.push({L, sign, pts});
    }
  }
  return out;
}
/* The closed contour lines at `lv` of a field sampled at tile centres over
   [x0,x1] x [y0,y1], in tile-corner space (a centre is at +0.5), each a ring of
   points with the field higher on its inside. The box's border is outside. */
function marchContours(val,x0,y0,x1,y1,lv){
  const segs=new Map(), key=p=>p[0].toFixed(3)+','+p[1].toFixed(3);
  const at=(x,y)=>(x<x0||y<y0||x>x1||y>y1) ? -Infinity : val(x,y);
  const lerp=(xa,ya,va,xb,yb,vb)=>{ const t=(lv-va)/(vb-va); return [xa+(xb-xa)*t+0.5, ya+(yb-ya)*t+0.5]; };
  const add=(a,b)=>{ const ka=key(a); (segs.get(ka)||segs.set(ka,[]).get(ka)).push({a,b}); };
  for (let y=y0-1;y<=y1;y++) for (let x=x0-1;x<=x1;x++){
    const v00=at(x,y), v10=at(x+1,y), v11=at(x+1,y+1), v01=at(x,y+1);
    const c=(v00>=lv?8:0)|(v10>=lv?4:0)|(v11>=lv?2:0)|(v01>=lv?1:0);
    if (!c || c===15) continue;
    const fin=v=>Number.isFinite(v) ? v : lv-1;
    const e={t:lerp(x,y,fin(v00),x+1,y,fin(v10)), r:lerp(x+1,y,fin(v10),x+1,y+1,fin(v11)),
             b:lerp(x,y+1,fin(v01),x+1,y+1,fin(v11)), l:lerp(x,y,fin(v00),x,y+1,fin(v01))};
    // each case as the segment(s) with the high side on the left of a->b
    const C={1:[['l','b']],2:[['b','r']],3:[['l','r']],4:[['r','t']],5:[['l','t'],['r','b']],6:[['b','t']],7:[['l','t']],
             8:[['t','l']],9:[['t','b']],10:[['t','r'],['b','l']],11:[['t','r']],12:[['r','l']],13:[['r','b']],14:[['b','l']]}[c];
    for (const [p,q] of C) add(e[p],e[q]);
  }
  // chain the segments into rings
  const rings=[];
  for (const [k0,list] of segs){
    while (list.length){
      let {a,b}=list.pop(); const ring=[a];
      for (let guard=0; guard<100000; guard++){
        ring.push(b);
        const next=segs.get(key(b));
        if (!next || !next.length) break;
        ({a,b}=next.pop());
        if (key(b)===key(ring[0])){ ring.push(b); break; }
      }
      if (ring.length>3) rings.push(ring.slice(0,-1));
    }
  }
  return rings;
}
function drawPlanContours(ctx,X,Y){
  const loops=planContourLoops(); if (!loops.length) return;
  ctx.save(); ctx.lineWidth=0.9; ctx.setLineDash([]);
  for (const c of loops){
    if (c.pts.length<3) continue;
    let pts=c.pts;
    for (let it=0;it<2;it++){                      // Chaikin: corners cut, twice
      const n=pts.length, nx=[];
      for (let i=0;i<n;i++){ const a=pts[i], b=pts[(i+1)%n];
        nx.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]); }
      pts=nx;
    }
    ctx.beginPath();
    pts.forEach(([gx,gy],i)=>i?ctx.lineTo(X(gx),Y(gy)):ctx.moveTo(X(gx),Y(gy)));
    ctx.closePath();
    ctx.strokeStyle = c.sign>0 ? 'rgba(122,90,44,0.7)' : 'rgba(63,100,120,0.75)';
    ctx.setLineDash(c.L ? [] : [4,3]); ctx.stroke();
  }
  ctx.restore();
}
/* One spot height per terrace or sunken patio, in inches above or below grade,
   at the tile nearest its middle, biggest first. The sheet printed the elevation
   STEP on every raised tile ("+3" forty times over a bed), a unit nothing else in
   the app uses and a texture rather than a reading. */
function planTerraceSpots(){
  const seen=new Set(), out=[];
  for (const k in game.elevation){
    const e=game.elevation[k]; if (!e || e.removed || !e.h || seen.has(k)) continue;
    const [x,y]=k.split(',').map(Number);
    if (isStepTile(x,y)){ seen.add(k); continue; }      // a flight carries an UP arrow, not a height a step
    const r=terraceRegionAt(x,y);
    if (!r){ seen.add(k); continue; }
    r.has.forEach(t=>seen.add(t));
    let sx=0, sy=0; for (const [tx,ty] of r.tiles){ sx+=tx; sy+=ty; }
    const mx=sx/r.tiles.length, my=sy/r.tiles.length;
    let at=r.tiles[0], best=Infinity;
    for (const t of r.tiles){ const dd=(t[0]-mx)**2+(t[1]-my)**2; if (dd<best){ best=dd; at=t; } }
    out.push({h:r.h, at, n:r.tiles.length});
  }
  return out.sort((a,b)=>b.n-a.n);
}
function planTerraceSpotText(h){ return `${h>0?'+':'−'}${terraceInches(h)}`; }
/* Every flight of steps, for the plan's UP arrow: the centre of its lowest and
   its highest row of treads (in tile coordinates, a tile's centre at +0.5) and
   the way it goes down. */
function planStepFlights(){
  const seen=new Set(), out=[];
  for (const k in game.elevation||{}){
    if (seen.has(k)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (!isStepTile(x,y)) continue;
    const f=stepFlightAt(x,y); f.has.forEach(t=>seen.add(t));
    let lo=Infinity, hi=-Infinity;
    for (const [tx,ty] of f.tiles){ const h=elevationAt(tx,ty); if (h<lo) lo=h; if (h>hi) hi=h; }
    const mid=h=>{ const row=f.tiles.filter(([tx,ty])=>elevationAt(tx,ty)===h);
      return [row.reduce((s,t)=>s+t[0],0)/row.length+0.5, row.reduce((s,t)=>s+t[1],0)/row.length+0.5]; };
    out.push({dir:f.dir, lo:mid(lo), hi:mid(hi), risers:stepFlightRisers(f)});
  }
  return out;
}
function hardscapeRows(opts){
  /* Proposed work by default; `opts.existing` asks for what is already there
     (0.9.155), which the list shows apart and orders nothing of. Walls and steps
     are always proposed: grade is not marked. */
  const want=!!(opts&&opts.existing), keepRec=r=>!!(r&&r.ex)===want;
  const rows=[];
  /* `n` is the magnitude the sort reads. Most counts here are formatted
     strings, and the comparator used to subtract them -- NaN, so rows within one
     kind came out in whatever order the object happened to enumerate. */
  const add=(kind,name,count,n,detail)=>rows.push({kind,name,count,n:+n||0,detail:detail||''});
  const bump=(m,k)=>{ m[k]=(m[k]||0)+1; };
  const volumeNote=(areaSqFt,depthIn)=>
    `${fmtVolumeFit(mulchYards(areaSqFt,depthIn))} at ${fmtLengthIn(depthIn)} deep`;

  /* ---- surfaces ---- one pass over the terrain map, split by kind.
     Mown lawn is STILL an absence (see LAWN_STYLES), so it is the one tally here
     counted by walking the plot rather than the map -- O(GW*GH), affordable
     because this runs when the list is opened and never in a frame -- and it
     asks isLawnTile, so the two cannot disagree about what counts as lawn. */
  /* Every surface is measured INSIDE its walls (surfaceSqInAt, 0.9.152): a
     wall's top stands on its own tile, so a raised bed's mulch, a terrace's
     paving and its turf stop at the coping. Square inches, kept per material. */
  const lawnSqIn={}, pathSqIn={}, bedSqIn={}, waterSqIn={};
  const put=(m,id,x,y)=>{ m[id]=(m[id]||0)+surfaceSqInAt(x,y); };
  for (const k in game.terrain){
    const t=game.terrain[k]; if (!t||t.removed||!keepRec(t)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (t.k==='lawn') put(lawnSqIn,lawnStyleId(t.c),x,y);
    else if (t.k==='path') put(pathSqIn,pathColorId(t.c),x,y);
    else if (t.k==='bed') put(bedSqIn,bedStyleId(t.c),x,y);
    else if (t.k==='water') put(waterSqIn,waterStyleId(t.c),x,y);
  }
  if (!want) for (let y=0;y<GH;y++) for (let x=0;x<GW;x++)
    if (isLawnTile(x,y) && !terrainAt(x,y)) put(lawnSqIn,'mown',x,y);

  for (const id in lawnSqIn){
    const area=lawnSqIn[id]/144;
    add('Lawn', lawnLabelFor(id), fmtAreaSqFt(area), area);
  }
  for (const id in pathSqIn){
    const c=pathColor(id), area=pathSqIn[id]/144;
    add('Paving', c.label, fmtAreaSqFt(area), area, c.depth ? volumeNote(area,c.depth) : '');
  }
  for (const id in bedSqIn){
    const area=bedSqIn[id]/144;
    /* A bog is dug out and lined, then filled with soil (BOG_DEPTH_IN), so what
       it is ordered by is that soil, not a mulch over the top. */
    add('Bed', bedStyle(id).label, fmtAreaSqFt(area), area, bedStyle(id).wet
      ? `${fmtVolumeFit(mulchYards(area,BOG_DEPTH_IN))} of soil to fill it ${fmtLengthIn(BOG_DEPTH_IN)} deep, over a liner`
      : volumeNote(area,BED_DEPTH_IN));
  }
  /* The soil to fill raised beds (0.9.152; raisedBedSoil, world.js), one line
     because it comes in one delivery: from the ground to the underside of the
     bed's surface, which the Bed row above already bills, less what the walls
     stand on. A small bed is bought by the bag, so under 2 cu yd the sub-line
     says it in cubic feet or litres as well. */
  const soil=raisedBedSoil(null,BED_DEPTH_IN);
  if (soil.tiles && !want){
    const d=v=>fmtLengthIn(v,{ftAt:48});
    const deep=Math.round(soil.lo)===Math.round(soil.hi) ? d(soil.hi) : `${d(soil.lo)} to ${d(soil.hi)}`;
    const top=soil.surfaces.size===1
      ? `${fmtLengthIn(BED_DEPTH_IN)} of ${lowerFirst(bedStyle([...soil.surfaces][0]).label)}`
      : `the ${fmtLengthIn(BED_DEPTH_IN)} surface`;
    const count=fmtVolumeFit(soil.cuYd), bag=fmtVolumeBagCuYd(soil.cuYd);
    add('Soil', 'Raised bed soil', count, soil.cuYd,
      `${soil.beds>1?`${soil.beds} beds, `:''}${fmtAreaSqFt(soil.sqFt)}${soil.walled?' inside the walls':''}, `+
      `${deep} deep under ${top}`+(count!==bag && soil.cuYd<2 ? ` (${bag})` : ''));
  }
  /* Berms and swales (0.9.156): the earth a berm is built of, measured under its
     surface as drawn (softComponents), and what a swale takes out, which is the
     earth a berm next to it is usually made of. */
  if (!want){
    const comps=softComponents(), berms=comps.filter(c=>!c.swale), swales=comps.filter(c=>c.swale);
    const cuYd=cuIn=>cuIn/46656;
    if (berms.length){
      const fill=cuYd(berms.reduce((t,c)=>t+c.fillCuIn,0)), hi=Math.max(...berms.map(c=>c.up));
      const count=fmtVolumeFit(fill), bag=fmtVolumeBagCuYd(fill);
      add('Soil','Berm fill',count,fill,
        `${berms.length>1?`${berms.length} berms, `:''}up to ${terraceInches(hi)} high, firmed in layers`+(count!==bag && fill<2 ? ` (${bag})` : ''));
    }
    if (swales.length){
      const cut=cuYd(swales.reduce((t,c)=>t+c.cutCuIn,0)), lo=Math.max(...swales.map(c=>-c.down));
      add('Soil','Swale dug out',fmtVolumeFit(cut),cut,
        `${swales.length>1?`${swales.length} swales, `:''}up to ${terraceInches(lo)} deep: earth to move${berms.length?', or to build the berm with':''}`);
    }
  }
  // a formal pool's coping is ordered by the foot, round every pool
  let copeFt=0;
  for (const L of poolOutlines()) if (L.ex===want) for (let i=0;i<L.pts.length;i++){
    const a=L.pts[i], b=L.pts[(i+1)%L.pts.length]; copeFt+=Math.hypot(b[0]-a[0],b[1]-a[1])*TILE_IN/12; }
  for (const id in waterSqIn){
    const area=waterSqIn[id]/144;
    add('Water', waterStyle(id).label, fmtAreaSqFt(area), area, waterStyle(id).crisp && copeFt
      ? `${fmtFeet(copeFt,1)} of ${lowerFirst(POOL_COPING.label)}, ${fmtLengthIn(POOL_COPING.topIn)} wide`
      : 'surface area');
  }
  /* Crossings (0.9.154): stepping stones by the stone, a bridge by the bridge
     with its deck's size, the length running the way it spans and including
     where it lands on the banks. */
  const cross={};
  for (const reg of crossingRegions().list){
    if (reg.ex!==want) continue;
    const c=cross[reg.type]||(cross[reg.type]={n:0,stones:0,sizes:[]});
    if (reg.type==='stepping'){ c.stones+=reg.tiles.length; continue; }
    c.n++;
    const ax=reg.axis==='x', dry=(a,b)=>onPlot(a,b) && tileTerrain(a,b)!=='water';
    let land=0;
    for (const [x,y] of reg.tiles){
      if (ax){ if (!reg.has.has((x-1)+','+y) && dry(x-1,y)) land+=1; if (!reg.has.has((x+1)+','+y) && dry(x+1,y)) land+=1; }
      else { if (!reg.has.has(x+','+(y-1)) && dry(x,y-1)) land+=1; if (!reg.has.has(x+','+(y+1)) && dry(x,y+1)) land+=1; }
    }
    const across=ax?reg.y1-reg.y0+1:reg.x1-reg.x0+1, along=(ax?reg.x1-reg.x0+1:reg.y1-reg.y0+1)+CROSSING_LAND*land/Math.max(1,across);
    c.sizes.push(`${fmtFeet(across*TILE_IN/12,1)} wide, ${fmtFeet(along*TILE_IN/12,1)} long`);
  }
  for (const id in cross){
    const c=cross[id];
    if (id==='stepping') add('Crossing', crossingLabelFor(id), `${c.stones} stone${c.stones>1?'s':''}`, c.stones,
      `about ${fmtLengthIn(13)} across, set in the water`);
    else add('Crossing', crossingLabelFor(id), `${c.n} bridge${c.n>1?'s':''}`, c.n, c.sizes.join('; '));
  }

  /* ---- runs ---- */
  const edgingFt=edgingRunFeet(want);
  for (const id in edgingFt) add('Edging', edgingLabelFor(id), fmtFeet(edgingFt[id]), edgingFt[id]);

  /* A wall is billed by its FACE AREA (0.9.146): block, stone and brick are
     ordered by the square foot of face, and a length alone cannot say how much
     wall a 36 in terrace is against a 10 in one. The length is measured along the
     TRACED CONTOUR rather than by counting exposed tile faces, which
     double-count a diagonal and count the far side of a wall you build once (the
     wall that prompted that was billed at 54 ft for a run of 24). The sub-line
     says how long and how high, and, for a wall with a separate coping course,
     how many feet of coping: that is ordered by the foot, round every faced
     side. A wall's own proud top (sleeper, concrete, steel) is part of its face. */
  const wallBy={};
  if (!want) for (const run of buildElevationRuns()){
    // a riser is part of its step and billed with it, below; a flight's sides are walls
    const st=wallStyle(run.wall); if (!st.face || run.riser) continue;
    const ft=wallRunFeet(run), hIn=wallRunFaceIn(run,st);
    const w=wallBy[st.id]||(wallBy[st.id]={ft:0,area:0,lo:Infinity,hi:0,cope:0});
    w.ft+=ft; w.area+=ft*hIn/12; w.lo=Math.min(w.lo,hIn); w.hi=Math.max(w.hi,hIn);
    if (!run.step) w.cope+=ft;                    // a step's side wears its tread, not a coping
  }
  for (const id in wallBy){
    const w=wallBy[id], st=wallStyle(id), h=v=>fmtLengthIn(v,{ftAt:48});
    const high=Math.round(w.lo)===Math.round(w.hi) ? h(w.hi) : `${h(w.lo)} to ${h(w.hi)}`;
    add('Retaining wall', wallLabelFor(id), fmtAreaSqFt(w.area), w.area,
      `${fmtFeet(w.ft)} long, ${high} high${st.cope&&w.cope?`, with ${fmtFeet(w.cope)} of ${st.cope}`:''}`);
  }

  /* STEPS (0.9.151), counted by the step -- a riser and its tread are what a
     builder prices -- one line per riser and tread material, with the width, the
     rise and the feet of tread (slab or nosing, ordered by the foot) under it. A
     flight's risers are not billed as wall; its sides are, being walls. */
  const stepsBy={}, seenStep=new Set();
  if (!want) for (const k in game.elevation||{}){
    if (seenStep.has(k)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1);
    if (!isStepTile(x,y)) continue;
    const f=stepFlightAt(x,y); f.has.forEach(t=>seenStep.add(t));
    const t=terrainAt(x,y), tread=t&&t.k==='path'?pathColorId(t.c):'';
    const byLv={}; for (const [tx,ty] of f.tiles){ const h=elevationAt(tx,ty); byLv[h]=(byLv[h]||0)+1; }
    const s=stepsBy[wallStyleAt(x,y)+'|'+tread]||(stepsBy[wallStyleAt(x,y)+'|'+tread]={flights:0,risers:0,widths:new Set(),treadFt:0});
    s.flights++; s.risers+=stepFlightRisers(f); s.widths.add(Math.max(...Object.values(byLv)));
    s.treadFt+=f.tiles.length*TILE_IN/12;
  }
  for (const key in stepsBy){
    const [w,tread]=key.split('|'), s=stepsBy[key];
    const widths=[...s.widths].sort((a,b)=>a-b).map(n=>fmtFeet(n*TILE_IN/12,1));
    add('Steps', stepsName(w,tread||null), `${s.risers} step${s.risers>1?'s':''}`, s.risers,
      `${s.flights>1?`${s.flights} flights, `:''}${widths.join(' and ')} wide, ${fmtLengthIn(ELEV_RISER_IN)} risers, ${fmtFeet(s.treadFt,1)} of tread`);
  }

  const fenceFt=fenceRunFeet(want);
  for (const id in fenceFt){
    const [st,h]=id.split('|');
    // named as the toast and the tray name it: one label builder for one fence
    add('Fence', cap(fenceLabel({style:st,height:+h})), fmtFeet(fenceFt[id]), fenceFt[id]);
  }
  /* A pergola is a thing you BUY, by its size -- "a 10 x 12 timber pergola" is
     how a kit or a carpenter's quote is written -- so it is counted, one per
     roof, and the sub-line says its footprint and how many posts go in the
     ground. It was billed by the foot like a fence while it was modelled as
     one, which quoted a 10 ft square pergola as 74 ft of something. Two of one
     size and material share a line. */
  const pergolas={};
  for (const reg of pergolaRegions().list){
    if (!!reg.ex!==want) continue;
    const inf=reg.info, w=inf.x1-inf.x0+1, h=inf.y1-inf.y0+1, rect=reg.tiles.length===w*h;
    let posts=0;
    for (const [x,y] of reg.tiles) posts+=pergolaFrameAt(x,y).posts.length;
    const id=[reg.mat,reg.height,rect?Math.min(w,h)+'x'+Math.max(w,h):'a'+reg.tiles.length,posts].join('|');
    if (!pergolas[id]) pergolas[id]={n:0,reg,w,h,rect,posts};
    pergolas[id].n++;
  }
  for (const id in pergolas){
    const g=pergolas[id], area=tileAreaSqFt(g.reg.tiles.length);
    add('Pergola', pergolaLabelFor({mat:g.reg.mat,height:g.reg.height}), g.n, g.n,
      (g.rect ? pergolaSizeText(g.w,g.h) : `${fmtAreaSqFt(area)} covered`)+`, ${g.posts} posts`);
  }
  const gates=fenceGateOpenings(want);
  for (const id in gates){
    const [st,h,span]=id.split('|');
    add('Gate', `${fenceStyle(st).label} gate`, gates[id], gates[id],
      `${fmtFeet(+span*TILE_IN/12,1)} opening, ${fmtFeet(+h)} high`);
  }

  /* ---- things you buy one of ---- */
  const pots={}, seats={}, waters={}, pits={}, rocks={}, props={}, lamps={}, orns={};
  for (const k in game.pots||{}){ const p2=game.pots[k]; if (!p2||p2.removed||!keepRec(p2)) continue;
    // colour is part of what you order, so it splits the line
    bump(pots, potStyleId(p2.style)+'|'+potSizeFor(p2.style,p2.size)+'|'+potFinishFor(p2.style,p2.finish)); }
  for (const k in game.seats||{}){ const s2=game.seats[k]; if (!s2||s2.removed||!keepRec(s2)) continue;
    // snapped, so the list bills the finish the garden actually draws
    const d=normalizeSeatDraft(s2); bump(seats, d.type+'|'+d.finish); }
  for (const k in game.waterFeatures||{}){ const w=game.waterFeatures[k]; if (!w||w.removed||!keepRec(w)) continue;
    const d=normalizeWaterFeatureDraft(w); bump(waters, d.form+'|'+d.finish); }
  for (const k in game.ornaments||{}){ const o=game.ornaments[k]; if (!o||o.removed||!keepRec(o)) continue;
    // which way it is turned is not something you order
    const d=normalizeOrnamentDraft(o); bump(orns, d.kind+'|'+d.finish); }
  for (const k in game.firepits||{}){ const f=game.firepits[k]; if (!f||f.removed||!keepRec(f)) continue;
    // the material is what you order; `face` is only which way it is turned
    const d=normalizeFirepitDraft(f); bump(pits, [d.style,d.finish,d.shape,d.size].join('|')); }
  for (const k in game.boulders||{}){ const b2=game.boulders[k]; if (!b2||b2.removed||!keepRec(b2)) continue;
    // the stone is what you order; `face` is only which side shows
    const d=normalizeBoulderDraft(b2); bump(rocks, d.type+'|'+d.stone); }
  for (const k in game.supports||{}){ const sp=game.supports[k]; if (!sp||sp.removed||!keepRec(sp)) continue;
    // `face` is which way it is turned, which is not something you order
    // the lattice is what you order too: a diamond and a square panel are two lines
    const d=normalizeSupportDraft(sp); bump(props, d.style+'|'+d.mat+'|'+(d.pat||'')); }
  for (const k in game.lights||{}){ const l=game.lights[k]; if (!l||l.removed||!keepRec(l)) continue;
    // the FINISH splits the line the way a pot's colour does: it is what you buy
    // a torch has no lamp colour, so two torches never split on one
    const d=normalizeLightDraft(l); bump(lamps, d.type+'|'+(lightIsFlame(d)?'':d.tone)+'|'+d.finish); }

  for (const id in pots){ const [st,sz,fi]=id.split('|');
    add('Container', cap(potLabelFor({style:st,size:sz,finish:fi})), pots[id], pots[id]); }
  for (const id in seats){ const [ty,fi]=id.split('|');
    add('Seating', cap(seatLabelFor({type:ty,finish:fi})), seats[id], seats[id]); }
  for (const id in waters){ const [fo,fi]=id.split('|');
    add('Water feature', waterFeatureLabelFor({form:fo,finish:fi}), waters[id], waters[id]); }
  for (const id in orns){ const [kind,finish]=id.split('|'), d={kind,finish};
    add('Ornament', ornamentLabelFor(d), orns[id], orns[id], ornamentTakeoffText(d,orns[id])); }
  for (const id in pits){ const [style,finish,shape,size]=id.split('|'), d={style,finish,shape,size};
    add('Fire pit', firepitLabel(d), pits[id], pits[id], firepitTakeoffText(d,pits[id])); }
  /* A boulder is ordered by the ton, so its sub-line is what it weighs — the
     buried third included, since that is delivered too (boulderWeightLb). */
  for (const id in rocks){ const [type,stone]=id.split('|'), d={type,stone};
    add('Boulder', boulderLabelFor(d), rocks[id], rocks[id], boulderTakeoffText(d,rocks[id])); }
  for (const id in props){ const [style,mat,pat]=id.split('|'), d={style,mat,pat:pat||undefined};
    add('Support', supportLabel(d), props[id], props[id], supportTakeoffText(d,props[id])); }
  for (const id in lamps){ const [type,tone,finish]=id.split('|');
    /* The NAME is the fixture you order -- its metal and its model. The lamp
       colour is a setup choice rather than a different product, so it rides the
       sub-line with the height. */
    add('Lighting', `${lightFinish(type,finish).label} ${lowerFirst(lightType(type).label)}`, lamps[id], lamps[id],
      (tone ? `${lightTone(tone).label} light, ` : '')+`${fmtLengthIn(lightHeightFt({type})*12)} tall`); }
  /* Festoon string lights are bought by the length and the bulb, so they are
     billed as one line: how much string, in how many runs (one per lit rafter,
     edge beam to edge beam), and how many bulbs. festoonLine is the one
     definition of a run, which the drawing also reads. */
  let fFt=0, fRuns=0, fBulbs=0;
  for (const reg of pergolaRegions().list){
    if (reg.lights!=='festoon' || !!reg.ex!==want) continue;
    for (const [x,y] of reg.tiles){
      const run=festoonRunIn(reg.has,reg.info,x,y);
      if (!run || run[0]!==0) continue;          // count each run once, at its first tile
      const L=festoonLine(run[1]); fFt+=L.lenIn/12; fRuns++; fBulbs+=L.bulbs;
    }
  }
  if (fRuns) add('Lighting', 'Festoon string lights', fmtFeet(fFt,1), fFt,
    `${fRuns} run${fRuns===1?'':'s'} across the rafters, ${fBulbs} bulbs`);

  return rows.sort((p2,q2)=>p2.kind===q2.kind ? q2.n-p2.n : (p2.kind<q2.kind?-1:1));
}
/* What is already there (0.9.155): the plants by species, then everything else
   in the hardscape table's own words and units. None of it is ordered, so it
   has no sub-lines. */
function existingRows(){
  const rows=[], plants={};
  [game.plants,game.bulbs].forEach(layer=>{ for (const k in layer){ const p=layer[k];
    if (p && !p.removed && p.s && p.ex){ const id=p.s+'|'+(p.v||''); plants[id]=(plants[id]||0)+1; } } });
  for (const id in plants){
    const [sp,v]=id.split('|'), P=plantDef(sp,v||null), n=plants[id];
    const q=isIndividualDef(P) ? n : Math.max(1,plantsForTiles(n,P.space));
    rows.push({kind:'Plant', name:P.name, count:`${q} plant${q>1?'s':''}`, n:q, detail:''});
  }
  rows.sort((a,b)=>b.n-a.n);
  return rows.concat(hardscapeRows({existing:true}).map(r=>Object.assign({},r,{detail:''})));
}
function openExport(){
  tourNote('list');   // the tour ends on the payoff, and this is its only opener
  funnel(FUNNEL_EVENTS.listOpened);     // the conversion moment, if the paywall lands here
  const rows=exportRows(), body=$('exportBody'), hard=hardscapeRows(), there=existingRows();
  const where=game.worldName||'My garden';
  $('exportMeta').textContent=`${where} · ${new Date().toLocaleDateString()} · one tile = ${tileSizeText()}`;
  // The heading names the whole table, which has carried edging and retaining
  // wall since Wave 5 and now carries turf area too.
  /* "Quantity", not "Count": the column has held an area since lawn joined the
     table and now holds feet and counts beside it. The sub-line carries what you
     ORDER where that differs from what you measure -- a gravel path is laid by
     the square foot and sold by the cubic yard. */
  const hardHtml = hard.length ? `<h3 class="export-sub">Surfaces &amp; hardscape</h3>`+
    `<div class="export-wrap"><table class="export-table"><thead><tr>`+
    `<th>Item</th><th>Type</th><th>Quantity</th></tr></thead><tbody>`+
    hard.map(r=>`<tr><td>${r.name}${r.detail?`<small class="hard-note">${r.detail}</small>`:''}</td>`+
      `<td>${r.kind}</td><td><b>${r.count}</b></td></tr>`).join('')+
    `</tbody></table></div>` : '';
  /* What was marked existing on the Site tab: listed, so the survey is on the
     sheet too, and left out of every order above. */
  const exHtml = there.length ? `<h3 class="export-sub">Already there</h3>`+
    `<p class="note">Marked existing: hatched on the plan, and not in the orders above.</p>`+
    `<div class="export-wrap"><table class="export-table"><thead><tr>`+
    `<th>Item</th><th>Type</th><th>Quantity</th></tr></thead><tbody>`+
    there.map(r=>`<tr><td>${r.name}</td><td>${r.kind}</td><td>${r.count}</td></tr>`).join('')+
    `</tbody></table></div>` : '';
  if (!rows.length){
    body.innerHTML=hardHtml+'<p class="note">Nothing planted yet. Plant a few drifts, then come back for the list.</p>'+exHtml;
  } else {
    /* areaFt stays SQUARE FEET on the row — it is what the CSV writes and
       what the total is summed from — and only the cell is converted. Summing
       formatted strings is how a total stops matching its own column. */
    const tr=rows.map(r=>`<tr><td>${r.name}<div class="latin">${r.latin}</div><small>${r.nativeStatus} · ${r.provenance}</small></td>
      <td>${r.count}</td><td>${areaNumberText(r.areaFt)}</td><td>${plantMeasure(r.space,true)}</td><td><b>${r.order}</b></td></tr>`).join('');
    const tot=rows.reduce((a,r)=>({c:a.c+r.count,f:a.f+r.areaFt,o:a.o+r.order}),{c:0,f:0,o:0});
    body.innerHTML=`<div class="export-wrap"><table class="export-table"><thead><tr>
      <th>Species</th><th>Planted</th><th>${areaUnit()}</th><th>Spacing</th><th>To order</th></tr></thead>
      <tbody>${tr}</tbody>
      <tfoot><tr><td>Total</td><td>${tot.c}</td><td>${areaNumberText(tot.f)}</td><td></td><td>${tot.o}</td></tr></tfoot></table></div>
      <p class="note">"To order" converts planted ground to plants at each species' recommended
      spacing. Native status is compared with ${nativeRegionLabel(activeFilters().nativeRegion)}; origin and horticultural provenance remain separate facts.</p>${hardHtml}${exHtml}`;
  }
  openOverlay('exportScreen','#btnPrint');
}
function exportCsv(){
  /* A garden can be all hardscape -- a courtyard drawn before a single plant is
     chosen is a normal state, and this used to refuse to export one. */
  const rows=exportRows(), hard=hardscapeRows(), there=existingRows();
  if (!rows.length && !hard.length && !there.length){ toast('Nothing planted or built yet.'); return; }
  funnel(FUNNEL_EVENTS.listExported);   // took the order away — the deepest step
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  /* The header NAMES the unit and the values follow it, so a bare number in a
     spreadsheet is never ambiguous. Deliberately "sq m" rather than m²: this
     CSV carries no BOM, Excel reads such a file in the system codepage, and a
     superscript is exactly the character that comes back as mojibake in
     somebody's nursery order. */
  const areaHdr=`Bed area (${areaUnit()})`, spaceHdr=`Spacing (${smallLengthUnit()})`;
  const areaVal=v=>metricUnits()?+(v*SQM_PER_SQFT).toFixed(1):v;
  const spaceVal=v=>metricUnits()?Math.round(v*CM_PER_IN):v;
  const lines=[];
  if (rows.length){
    lines.push(['Common name','Latin name','Broad origin','Continental native relationship','Provenance','Tiles planted',areaHdr,spaceHdr,'Plants to order','Local native status'].map(esc).join(','));
    rows.forEach(r=>lines.push([r.name,r.latin,r.origin,r.nativeStatus,r.provenance,r.count,areaVal(r.areaFt),spaceVal(r.space),r.order,r.localNative].map(esc).join(',')));
  }
  /* The hardscape rides in the SAME file, after a blank line and its own header
     row. Two programmatic downloads from one gesture raise Chrome's "Download
     multiple files?" prompt -- the plan sheet documents that trap and answers it
     with a toggle, which a CSV has nowhere to put. And a take-off that leaves out
     the fence and the paving is exactly the gap the on-screen table was widened
     to close; it should not reopen the moment somebody exports it. */
  if (hard.length){
    if (lines.length) lines.push('');
    lines.push(['Item','Type','Quantity','Notes'].map(esc).join(','));
    hard.forEach(r=>lines.push([r.name,r.kind,r.count,r.detail].map(esc).join(',')));
  }
  if (there.length){
    if (lines.length) lines.push('');
    lines.push(['Already there (not ordered)','Type','Quantity'].map(esc).join(','));
    there.forEach(r=>lines.push([r.name,r.kind,r.count].map(esc).join(',')));
  }
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
// `layer` defaults to the perennial planting; the bulb sheet passes game.bulbs
function planComponents(layer){
  const src=layer||game.plants;
  const live={};
  for (const k in src){ const p=src[k]; if (p && !p.removed && !p.ex){   // existing: drawn apart (drawPlanExisting)
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
/* A DRIFT is whatever the brush left 8-connected; a STAND is the planting a
   reader sees, and they are not the same thing.  The Matrix brush — the app's
   own signature gesture, and correct naturalistic practice — lays a
   CHECKERBOARD, which 8-connects into dozens of one-tile components, so
   labelling per component put a code on every one of them: the 326-tile garden
   that prompted this drew over a hundred labels at an average drift of 2.7
   tiles.  Components of one species/cultivar within PLAN_STAND_GAP tiles are
   therefore grouped, transitively, into a stand whose blobs still draw
   separately (the shapes were never the problem) and which is labelled ONCE.

   Joined by probing each tile's (2*GAP+1)^2 neighbourhood in a tile->component
   map: exact for Chebyshev distance and O(tiles * 25), where the naive
   pairwise form is O(tiles^2) and would matter on a stress garden.  All of it
   runs once on open, never in a frame. */
const PLAN_STAND_GAP=2;
function planStands(comps,gap){
  const of=new Map();
  comps.forEach((c,i)=>c.tiles.forEach(k=>of.set(k,i)));
  const par=comps.map((_,i)=>i);
  const find=i=>{ while (par[i]!==i) i=par[i]=par[par[i]]; return i; };
  const join=(a,b)=>{ a=find(a); b=find(b); if (a!==b) par[b]=a; };
  const G=gap||PLAN_STAND_GAP;
  comps.forEach((c,i)=>{
    c.tiles.forEach(k=>{
      const [x,y]=k.split(',').map(Number);
      for (let dy=-G;dy<=G;dy++) for (let dx=-G;dx<=G;dx++){
        if (!dx&&!dy) continue;
        const j=of.get(`${x+dx},${y+dy}`);
        if (j===undefined || j===i) continue;
        const o=comps[j];
        if (o.s===c.s && (o.v||'')===(c.v||'')) join(i,j);
      }
    });
  });
  const byRoot=new Map();
  comps.forEach((c,i)=>{
    const r=find(i);
    let st=byRoot.get(r);
    if (!st){ st={s:c.s, v:c.v||null, tiles:[], sx:0, sy:0}; byRoot.set(r,st); }
    c.tiles.forEach(k=>{ const [x,y]=k.split(',').map(Number);
      st.tiles.push([x,y]); st.sx+=x; st.sy+=y; });
  });
  /* The label sits on the stand tile CLOSEST to the centroid, not on the
     centroid itself: a scattered or L-shaped stand has a centroid outside its
     own planting, and a label floating on bare ground reads as a different
     drift. */
  return [...byRoot.values()].map(st=>{
    const n=st.tiles.length, cx=st.sx/n, cy=st.sy/n;
    let best=st.tiles[0], bd=Infinity;
    for (const [x,y] of st.tiles){
      const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
      if (d<bd){ bd=d; best=[x,y]; }
    }
    return {s:st.s, v:st.v, n, at:best, tiles:st.tiles};
  }).sort((a,b)=>b.n-a.n);
}
/* How many plants to order, keyed species|cultivar — and it is the SUM OF THE
   NUMBERS THE DRAWING ALREADY CARRIES, which is the whole point.  Three
   documents quote this (the stand labels, the plan's schedule, the planting
   list), an installer adds the labels up, and it has to come to the same
   number or the set contradicts itself.  It did, twice over:

   - Every placed plant was billed by AREA at its spacing, so three redbuds
     came out as one redbud (see isIndividualDef). Someone following the
     drawing buys a third of the trees on it.
   - Each stand rounds UP to a whole plant and the schedule rounded the total
     ONCE, so twelve stands of moor grass labelled 52 plants and scheduled 48.
     Rounding has to happen per stand, because that is how you plant.

   O(tiles) with a union-find inside planStands, run when a document is opened
   and never in a frame. */
function plantingQuantities(){
  const qty={}, bump=(s,v,n)=>{ const id=s+'|'+(v||''); qty[id]=(qty[id]||0)+n; };
  // specimens: counted, because the record IS the plant
  for (const k in game.plants){ const p=game.plants[k];
    if (p && !p.removed && p.s && !p.ex && !isPlanStandDef(plantDef(p.s,p.v))) bump(p.s,p.v,1); }
  // everything grouped into stands, at the density its own label states
  [[game.plants,PLAN_STAND_GAP],[game.bulbs,BULB_STAND_GAP]].forEach(([layer,gap])=>{
    const comps=planComponents(layer).filter(c=>isPlanStandDef(plantDef(c.s,c.v)));
    planStands(comps,gap).forEach(st=>bump(st.s,st.v,plantsForStand(plantDef(st.s,st.v),st.n)));
  });
  return qty;
}
/* The three drawing weights the sheet reads as a hierarchy.  Oudolf plans are
   legible because the groundcover matrix recedes and the structure advances —
   the fruitcake, where the matrix is the cake — and ours gave a 53-tile grass
   matrix and a single climber the same fill, outline and label.  On the review
   garden the grasses and sedges were 141 of 326 tiles, so nearly half the
   noise on the sheet was the layer that should be quietest.

   This asks the ROLE table rather than restating a type chain:
   `staticPlantRoles` already tags every grass and sedge `matrix` and every
   woody `structure`, so a species classified there is classified here and the
   two cannot drift apart.  `groundcover` is deliberately NOT folded into
   matrix — it would demote hosta and fern drifts, which read as feature
   plants, and that is a taste call the data does not make. */
function planLayerOf(s){
  const roles=staticPlantRoles(s);
  if (roles.includes('structure')) return 'structure';
  if (roles.includes('matrix')) return 'matrix';
  return 'drift';
}
/* ---------- plan tints ----------
   A layer used to set a FRACTION to mix the species colour toward paper, which
   preserved whatever lightness the species happened to have — so the layer
   weight was only advisory and a light species stayed light wherever it sat.
   Measured across all 554 species, that put **114 of them (21%) within 0.03
   OKLab of the paper itself**: Culver's Root, Snowy Woodrush and White Wood
   Aster all drew at 0.006, which is a drift you cannot see at all. It was
   spread through every type — 39 shrubs, 30 forbs, 27 trees — because a white
   bloom, a cream seedhead and a pale grey foliage all resolve light and the
   mix then pushed them onto the page. Structure was the worst offender in
   principle: its band claimed to be the darkest and its lower quartile sat
   0.015 from paper.

   A layer now names a TARGET lightness instead, and the tint keeps the
   species' hue and a banded chroma. That makes the layer weight mean
   something, and no fill can land on the paper: the lightest band is 0.059 of
   L clear of it before chroma is counted. `edgeDrop` is how much darker the
   outline is than its own fill, so the two can never disagree. */
/* `edgeDrop` is checked against what the old strokes actually resolved to,
   which is the only way to keep the sheet in its own register: the old drift
   stroke landed near OKLab L 0.56 and 0.30 reproduces that at 0.555. The old
   structure stroke landed at 0.50; 0.40 takes it to 0.405 — deliberately a
   little heavier, since structure is meant to advance, but not the 0.355 that
   a 0.45 drop gave, which read as ink rather than as a plant. The thickness
   (`lw`) is already carrying part of that job and both together double-count. */
const PLAN_LAYER_STYLE={
  matrix:   {order:0, L:0.905, edgeDrop:0.10, lw:0.8, label:'#6e5f48'},
  drift:    {order:1, L:0.855, edgeDrop:0.30, lw:1.3, label:'#2c241c'},
  structure:{order:2, L:0.805, edgeDrop:0.40, lw:1.9, label:'#2c241c'},
  // a bulb zone is marked by its stipple and must not shout, so it sits
  // between the matrix and the drifts (§ bulb zones)
  zone:     {order:1, L:0.885, edgeDrop:0.34, lw:1.2, label:'#2c241c'},
};
const PLAN_PAPER='#f7f3e8';
const PLAN_TINT_C_MIN=0.020, PLAN_TINT_C_MAX=0.075, PLAN_TINT_C_SCALE=0.55;
/* Below this a bloom's HUE is not worth keeping.  This was 0.004 first and
   that was the wrong number for the wrong reason: a white or cream bloom has
   *just enough* chroma to clear a near-zero threshold while carrying no usable
   hue at all — every cream in the catalog points the same yellowish direction
   — so twelve white-flowered forbs passed the test, all landed on one hue at
   the chroma floor, and the separation pass had nothing to turn.  Measured, it
   left 45 of 66 pairs under 0.02 with the closest at exactly ZERO.  At 0.045
   those blooms fall through to foliage instead. */
const PLAN_TINT_C_USEFUL=0.045;
const PLAN_TINT_C_DEAD=0.004;      // and below THIS there is no hue to read at all
/* Where a tint's HUE comes from, and how much that hue MEANS — which is what
   decides how far the separation pass may rotate it.  Foliage is the honest
   fallback for a colourless bloom: it is always a real green, blue-green or
   grey-green and it varies between species, where a cream does not. */
function planTintSource(def){
  const src=planColor(def);
  if (oklabChroma(oklabOf(src))>=PLAN_TINT_C_USEFUL) return {col:src, fromBloom:true};
  const sea=def.sea||{};
  for (const s of ['Summer','Spring','Fall','Winter']){
    const fol=sea[s]&&sea[s].fol;
    if (fol && oklabChroma(oklabOf(fol))>=PLAN_TINT_C_DEAD) return {col:fol, fromBloom:false};
  }
  return {col:src, fromBloom:false};
}
/* One tint: the species' hue, a banded chroma, the layer's lightness. `nudge`
   is what the separation pass below turns to pull two collided species apart. */
function planTintAt(def,layer,nudge){
  const st=PLAN_LAYER_STYLE[layer]||PLAN_LAYER_STYLE.drift;
  const n=nudge||{};
  const src=planTintSource(def);
  const lab=oklabOf(src.col);
  const c0=oklabChroma(lab);
  const L=Math.max(0.55, Math.min(0.94, st.L+(n.dL||0)));
  const C=Math.max(PLAN_TINT_C_MIN, Math.min(PLAN_TINT_C_MAX, c0*PLAN_TINT_C_SCALE+(n.dC||0)));
  const H=Math.atan2(lab[2],lab[1])+(n.dH||0);
  const a=Math.cos(H)*C, b=Math.sin(H)*C;
  return {lab:[L,a,b], fromBloom:src.fromBloom, fill:oklabToRgb(L,a,b),
    edge:oklabToRgb(Math.max(0.20,L-st.edgeDrop),a,b)};
}
/* Two species one reader cannot tell apart is the other half of the problem:
   the three biggest forbs on the review garden — Salvia, Allium and Agastache
   — all resolved the same lavender, and across the catalog 74 pairs of forbs
   sit under 0.02 OKLab, Culver's Root and Common Yarrow at exactly ZERO.

   So the sheet's species are tinted TOGETHER: in the order the schedule lists
   them (biggest planting first, so the largest keeps its natural colour), each
   is pushed off any tint already assigned.  Hue rotation alone cannot do it —
   at these chromas a full 60 degrees moves only ~0.03 — so lightness and
   chroma are candidates too, lightness bounded to ±0.015 so a nudged species
   cannot invert the layer ladder whose bands are 0.05 apart.

   **How far a hue may be rotated depends on how much it MEANS.** A hue read
   off a real bloom is information and stays within 60 degrees, so a blue aster
   never comes out green.  A hue that fell through to foliage because the bloom
   was cream carries much less, so it may go to 110 — which is what gives a
   sheet of white-flowered forbs anywhere to go.

   Past what colour can carry it accepts a collision, which is the honest end
   of it: colour is indicative on a planting plan and the CODE is what
   identifies.  Better most of them separated than a pass that pretends to be a
   categorical palette. */
const PLAN_TINT_SEP=0.035;
function planTintNudges(wideHue){
  const out=[];
  const cap=wideHue?110:60, hues=[0];
  for (let d=12;d<=cap;d+=12) hues.push(d,-d);
  for (const dC of [0,0.02,0.04]) for (const dL of [0,0.015,-0.015]) for (const dH of hues)
    out.push({dH:dH*Math.PI/180,dL,dC});
  return out;
}
function planSheetTints(ids,layerFor){
  const taken=[], tints={};
  ids.forEach(id=>{
    const [s,v]=id.split('|'), def=plantDef(s,v||null), layer=layerFor(s);
    const base=planTintAt(def,layer,null);
    let best=null, nextBest=null, nextGap=-1;
    for (const n of planTintNudges(!base.fromBloom)){
      const t=planTintAt(def,layer,n);
      let gap=Infinity;
      for (const p of taken){ const d=oklabDist(p,t.lab); if (d<gap) gap=d; }
      if (gap>=PLAN_TINT_SEP){ best=t; break; }
      if (gap>nextGap){ nextGap=gap; nextBest=t; }
    }
    /* Nowhere clears the target, so the code carries it — but take the candidate
       that sits FURTHEST from its nearest neighbour rather than the untouched
       base.  Falling back to `base` threw away nudges that were measurably
       better and put the pair closer than it needed to be: measured over 800
       random palettes, that give-up path was most of the sheets landing under a
       just-noticeable 0.02, and choosing the best near-miss instead takes them
       from 13.1% to 0.0%, leaving 84.8% of sheets byte-identical. */
    if (!best) best=nextBest||base;
    taken.push(best.lab);
    tints[id]=best;
  });
  return tints;
}
/* The tint for one reference.  `layer` OVERRIDES the species' own only where
   the same plant is drawn in a different register on a different sheet — a
   bulb in its zone, a swatch keying that zone — so the sheet-wide separation
   is still what decides the hue and only the lightness band moves. */
function planTintOf(tints,s,v,layer){
  const id=s+'|'+(v||'');
  const t=tints&&tints[id];
  if (!t) return planTintAt(plantDef(s,v||null),layer||planLayerOf(s),null);
  if (!layer || layer===planLayerOf(s)) return t;
  const st=PLAN_LAYER_STYLE[layer]||PLAN_LAYER_STYLE.drift;
  const [,a,b]=t.lab;
  return {lab:[st.L,a,b], fill:oklabToRgb(st.L,a,b),
    edge:oklabToRgb(Math.max(0.20,st.L-st.edgeDrop),a,b)};
}
/* The ghost is the same tint seen through: the perennial planting has to say
   WHERE it is on the bulb sheet without being read as a second planting, so it
   keeps its hue and goes most of the way to the paper in LIGHTNESS. Measured
   at 24 RGB distance from paper against bare bed's 37 — fainter than the
   ground it sits on, which is what makes it read as underneath. */
const PLAN_GHOST_L=0.945, PLAN_GHOST_C=0.35;
function planGhostFill(t){
  const [,a,b]=t.lab;
  return oklabToRgb(PLAN_GHOST_L,a*PLAN_GHOST_C,b*PLAN_GHOST_C);
}
/* Truncate by MEASUREMENT, not by a character count, so a schedule column is
   filled rather than guessed at — the old legend cut every name at 26 chars,
   which is exactly where a cultivar epithet lives. */
function planFitText(ctx,str,maxW){
  str=String(str==null?'':str);
  if (maxW<=0) return '';
  if (ctx.measureText(str).width<=maxW) return str;
  let lo=0, hi=str.length;
  while (lo<hi){ const mid=(lo+hi+1)>>1;
    if (ctx.measureText(str.slice(0,mid)+'…').width<=maxW) lo=mid; else hi=mid-1; }
  return lo?str.slice(0,lo)+'…':'';
}
/* Botanical name WITH the cultivar epithet, which is the half a nursery order
   turns on. A nested exact-species choice is left alone: `fullName` replaces
   the common name outright, and a cultivar carrying its own `latin` has
   already said what it is. */
function planBotanicalName(s,v){
  const P=plantDef(s,v||null), base=PLANTS[s];
  const cv=v&&base&&base.cv&&base.cv[v];
  const latin=(P&&P.latin)||'';
  if (!cv || cv.latin || cv.fullName || !cv.name) return latin;
  return latin+' '+cv.name;
}
// the common name WITHOUT the cultivar — the botanical column carries that
function planCommonName(s,v){
  const P=plantDef(s,v||null), base=PLANTS[s];
  const cv=v&&base&&base.cv&&base.cv[v];
  return (cv && !cv.fullName && base) ? base.name : ((P&&P.name)||'');
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
/* Which components a sheet labels as STANDS.  A tree keeps a code per trunk
   and a shrub a blob per planting — both are specimens, marked and counted one
   at a time — so everything else, climbers included, is what gets grouped into
   stands.  ONE predicate, because the drawing and `plantingQuantities` have to
   partition the planting the same way or the sheet bills a plant twice or not
   at all. */
function isPlanStandDef(def){ return !isShrubPlanDef(def) && !isTreeDef(def); }
function shrubPlanComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed || p.ex) continue;
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
function drawPlanCode(ctx,code,lx,ly,fs,ink){
  ctx.textAlign='center';
  ctx.font=`600 ${fs}px IBM Plex Sans`;
  ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
  ctx.strokeText(code,lx,ly); ctx.fillStyle=ink||'#2c241c'; ctx.fillText(code,lx,ly);
}
/* One label per STAND, over two lines.  Line two is the plant count at the
   species' recommended spacing — the number an installer reads — and is
   dropped when it would say "x1", where the code alone is the whole story.
   Stacking is cheaper than running wide inside a roundish blob. */
function standLabelSub(qty){ return qty>1?`×${qty}`:''; }
function drawStandLabel(ctx,code,qty,lx,ly,fs,ink){
  const sub=standLabelSub(qty);
  const rise=sub?fs*0.42:0;
  drawPlanCode(ctx,code,lx,ly-rise,fs,ink);
  if (!sub) return;
  const ss=Math.max(7,Math.round(fs*0.74));
  ctx.font=`600 ${ss}px IBM Plex Sans`; ctx.textAlign='center';
  ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=3;
  ctx.strokeText(sub,lx,ly-rise+ss+1);
  ctx.fillStyle='rgba(110,95,72,0.95)'; ctx.fillText(sub,lx,ly-rise+ss+1);
}

/* ---------- label placement ----------
   Labels used to be placed and drawn in one pass, with no idea of each other.
   On the review garden that cost exactly ONE overlapping pair, which is why
   this ranked below the work that came first — the symptom was crowding, and
   grouping stands into one label per population fixed most of it.  It still
   has to be right on a garden denser than that one, and on the bulb sheet,
   where a zone's label sits over a stipple rather than over open tint.

   So a label is now PLACED: measured, tried at its anchor, and if that box
   overlaps one already down, moved outward to the nearest free spot with a
   LEADER LINE back to the anchor — the standing convention for a label that
   will not fit inside its own shape.  Candidates step vertically first: a
   drift is wider than it is tall on this projection, so there is more clear
   paper above and below a shape than beside it.

   When nothing is free the label stays at its anchor and overlaps.  That is
   deliberate: a label a long way from the thing it names is worse than two
   labels touching, because the reader cannot tell which shape it belongs to.
   `PLAN_LABEL_RING` bounds how far it will ever wander for the same reason. */
const PLAN_LABEL_PAD=2;            // clear paper demanded between two labels
const PLAN_LABEL_RING=3;           // how many steps outward it will try
const PLAN_LEADER_MIN=7;           // displacement past which a leader is drawn
function planLabelBox(ctx,code,qty,fs){
  ctx.font=`600 ${fs}px IBM Plex Sans`;
  let w=ctx.measureText(code).width, top=fs*0.78, bot=2;
  const sub=standLabelSub(qty);
  if (sub){
    const ss=Math.max(7,Math.round(fs*0.74));
    ctx.font=`600 ${ss}px IBM Plex Sans`;
    w=Math.max(w,ctx.measureText(sub).width);
    const rise=fs*0.42;
    top=rise+fs*0.78; bot=ss+1+ss*0.28-rise;
  }
  return {w,top,bot};
}
function planLabelPlacer(seed){
  const placed=(seed||[]).slice();
  const hit=(a,b)=>a.x0<b.x1 && b.x0<a.x1 && a.y0<b.y1 && b.y0<a.y1;
  return {
    boxes:placed,
    /* (lx,ly) is where drawStandLabel/drawPlanCode want their baseline; m is
       planLabelBox's extents around it. Returns the position to draw at, plus
       the anchor to run a leader back to when it moved far enough to need one. */
    place(lx,ly,m,bounds){
      const P=PLAN_LABEL_PAD;
      const box=(dx,dy)=>({x0:lx+dx-m.w/2-P, x1:lx+dx+m.w/2+P,
                           y0:ly+dy-m.top-P, y1:ly+dy+m.bot+P});
      const h=m.top+m.bot;
      const cands=[[0,0]];
      for (let r=1;r<=PLAN_LABEL_RING;r++){
        const dy=(h+P*2)*r, dx=(m.w*0.75+P*2)*r;
        cands.push([0,-dy],[0,dy],[dx,0],[-dx,0],
                   [dx*0.7,-dy*0.8],[-dx*0.7,-dy*0.8],[dx*0.7,dy*0.8],[-dx*0.7,dy*0.8]);
      }
      for (const [dx,dy] of cands){
        const b=box(dx,dy);
        if (bounds && (b.x0<bounds.x0 || b.x1>bounds.x1 || b.y0<bounds.y0 || b.y1>bounds.y1)) continue;
        if (placed.some(p=>hit(p,b))) continue;
        placed.push(b);
        const moved=Math.hypot(dx,dy);
        return {x:lx+dx, y:ly+dy, leader:moved>=PLAN_LEADER_MIN?[lx,ly]:null};
      }
      placed.push(box(0,0));
      return {x:lx, y:ly, leader:null};
    }
  };
}
// thin line back to what the label names, with a dot on the thing itself
function drawPlanLeader(ctx,from,to,ink){
  ctx.save();
  ctx.strokeStyle='rgba(247,243,232,0.85)'; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(from[0],from[1]); ctx.lineTo(to[0],to[1]); ctx.stroke();
  ctx.strokeStyle=ink||'#6e5f48'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.moveTo(from[0],from[1]); ctx.lineTo(to[0],to[1]); ctx.stroke();
  ctx.fillStyle=ink||'#6e5f48';
  ctx.beginPath(); ctx.arc(to[0],to[1],1.5,0,7); ctx.fill();
  ctx.restore();
}
// `label` is false on the bulb sheet, where structure is context and the only
// thing carrying a code is the bulb planting the sheet exists to show
/* A shrub code goes down in the DRAWING pass, before any stand label is
   placed, so it cannot move out of the way — it records its box instead and
   the placer treats it as ground already taken. */
/* How many shrubs a plan blob stands for.  A clipped hedge groups its whole
   run into one component, one tile per plant, so the run's length IS the
   count; every other shrub is its own component and its tiles are the mature
   footprint (nine of them for one viburnum), which is why that branch cannot
   count tiles. */
function shrubPlanQty(c){ return c.hedge ? c.tiles.length : 1; }
/* A hedge blob carries its count the way a drift does.  Without it the
   schedule said 5 and the drawing showed one shape with a code on it, and a
   reader had no way to tell whether that was five plants or one. */
function drawShrubPlanCode(ctx,code,qty,lx,ly,fs,boxes){
  if (boxes){ const m=planLabelBox(ctx,code,qty,fs);
    boxes.push({x0:lx-m.w/2-PLAN_LABEL_PAD, x1:lx+m.w/2+PLAN_LABEL_PAD,
                y0:ly-m.top-PLAN_LABEL_PAD, y1:ly+m.bot+PLAN_LABEL_PAD}); }
  drawStandLabel(ctx,code,qty,lx,ly,fs);
}
function drawShrubPlan(ctx,c,codes,cell,X,Y,label,boxes,tints){
  const def=plantDef(c.s,c.v), t=planTintOf(tints,c.s,c.v);
  const fill=t.fill, stroke=t.edge;
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
    if (label!==false) drawShrubPlanCode(ctx,code,shrubPlanQty(c),cx2,cy2+3,Math.max(8,Math.min(13,Math.min(rx,ry)*0.42)),boxes);
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
  if (label!==false) drawShrubPlanCode(ctx,code,shrubPlanQty(c),rx+rw/2,ry+rh/2+3,Math.max(8,Math.min(13,5+Math.sqrt(c.tiles.length)*2)),boxes);
  ctx.restore();
}
/* What is already there (0.9.155), drawn the way a survey is drawn on a plan:
   hatched. Every tile carrying something marked existing is hatched over what
   the sheet drew there, and an existing tree or shrub is drawn in grey, its
   crown dotted where a proposed one is dashed, and named, since it is on no
   schedule. */
function drawPlanExisting(ctx,g){
  const {cell,X,Y}=g, tiles=existingTiles();
  if (!tiles.length) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(X(0),Y(0),GW*cell,GH*cell); ctx.clip();
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed || !p.ex) continue;
    const def=plantDef(p.s,p.v); if (!isWoodyDef(def)) continue;
    const ci=k.indexOf(','), x=+k.slice(0,ci), y=+k.slice(ci+1), cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
    const r=Math.max(0.5,isTreeDef(def)?canopyRadius(p):woodyRadiusTiles(def))*cell;
    ctx.fillStyle='rgba(120,112,98,0.06)'; ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.fill();
    ctx.strokeStyle='#7d7466'; ctx.lineWidth=1.1; ctx.setLineDash([1.5,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#6b6356'; ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2.2,cell*0.16),0,7); ctx.fill();
    ctx.font='italic 9px IBM Plex Sans'; ctx.textAlign='center';
    ctx.fillText('ex. '+def.name,cx2,cy2+Math.max(11,cell*0.5));
  }
  ctx.beginPath();
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for (const [x,y] of tiles){ ctx.rect(X(x),Y(y),cell,cell);
    if (X(x)<x0) x0=X(x); if (X(x)+cell>x1) x1=X(x)+cell; if (Y(y)<y0) y0=Y(y); if (Y(y)+cell>y1) y1=Y(y)+cell; }
  ctx.clip();
  ctx.strokeStyle='rgba(70,62,52,0.42)'; ctx.lineWidth=0.6; ctx.beginPath();
  const step=Math.max(3.5,cell*0.22);
  for (let d=x0-(y1-y0);d<x1;d+=step){ ctx.moveTo(d,y1); ctx.lineTo(d+(y1-y0),y0); }
  ctx.stroke();
  ctx.restore();
}
function drawTreePlan(ctx,p,x,y,cell,X,Y,tints){
  const def=plantDef(p.s,p.v), reach=canopyRadius(p);
  const tt=planTintOf(tints,p.s,p.v);
  const cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
  if (reach>0){
    const r=reach*cell;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0),Y(0),GW*cell,GH*cell);
    ctx.clip();
    ctx.globalAlpha=0.12;
    ctx.fillStyle=tt.fill;
    ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.fill();
    ctx.globalAlpha=1;
    ctx.strokeStyle=tt.edge;
    ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(cx2,cy2,r,0,7); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle='#4a3a28';
  ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2.5,cell*0.18),0,7); ctx.fill();
}
/* Short plan tags, unique per species|cv.  The code's job ON THE DRAWING is to
   DISTINGUISH; the schedule identifies.  So it is genus-derived — a hint, not a
   cipher: SCH tells a gardener it is a Schizachyrium without the key — and
   capped at three letters plus a digit.

   Two defects this fixes.  The cultivar suffix used to be the first two letters
   of the internal KEY slug, so 'theblues' rendered as SC'TH and nobody could
   read it back.  And a lone genus collapsed to two letters, which made
   Nassella "NA" — indistinguishable from N/A on a sheet.  A cultivar is now
   numbered, and only when the garden holds more than one selection of that
   species, because a suffix is only information when there is something to
   tell apart: on the review garden every tag became exactly three characters.

   Letters were kept over numbers deliberately; switching to 1..n is a change
   to this function alone, since nothing else reads the code's shape. */
function planCodes(ids){
  const used={}, codes={};
  const info=ids.map(id=>{ const [s,v]=id.split('|'), P=plantDef(s,v||null);
    const parts=((P&&P.latin)||'').split(' ');
    return {id, s, v:v||'', gen:(parts[0]||s).toUpperCase(), ep:(parts[1]||'').toUpperCase()}; });
  // how many selections of each SPECIES the garden holds, in a stable order so
  // the same garden prints the same tags however it was planted
  const perSpecies={};
  info.forEach(o=>{ (perSpecies[o.s]=perSpecies[o.s]||[]).push(o.v); });
  for (const s in perSpecies) perSpecies[s].sort();
  const stems={};
  info.forEach(o=>{
    const g3=o.gen.slice(0,3);
    let stem=stems[o.s];
    if (!stem){                                     // 3 letters, then grow into the epithet on collision
      for (let n=0;n<=o.ep.length;n++){ const c=g3+(n?o.ep.slice(0,n):''); if (!used[c]){ stem=c; break; } }
      if (!stem){ let i=2; while (used[g3+i]) i++; stem=g3+i; }
      stems[o.s]=stem; used[stem]=1;                // reserve the stem itself either way
    }
    const sel=perSpecies[o.s];
    const code=sel.length>1 ? stem+(sel.indexOf(o.v)+1) : stem;
    used[code]=1; codes[o.id]=code;
  });
  return codes;
}

/* ---------- the sheet set ----------
   A garden's bulbs are an OVERLAY of its perennial planting, not part of it:
   two independent designs on the same ground, which is how Oudolf draws them
   and the only honest way to draw two plantings that occupy the same tiles.
   Before this they were one stroked ring per tile over the top of everything,
   with no code and no drift — two bulb species were told apart by hue alone,
   landing on drifts already carrying their own fill, outline and label.

   So a garden with bulbs is a SHEET SET: the planting plan, then the bulb
   plan, which repeats the whole site base and drops the perennials to an
   unlabelled ghost.  A garden WITHOUT bulbs is one sheet and is byte-for-byte
   what it was.  See docs/plan-sheet.md. */
// every species|cultivar with something planted, in no particular order
function planPlantedRefIds(){
  const ids=new Set();
  [game.plants,game.bulbs].forEach(l=>{ for (const k in l){ const p=l[k];
    if (p && !p.removed && p.s && !p.ex) ids.add(p.s+'|'+(p.v||'')); } });
  return [...ids];
}
// rows a full schedule takes: one per species|cultivar, plus its header
function planScheduleRowCount(){
  const n=planPlantedRefIds().length;
  return n ? n+1 : 0;
}
/* A private 1x1 canvas, used only to MEASURE.  The sheet set depends on where
   the schedule's names wrap, and planSheets is called from places that have no
   sheet canvas in hand - the toggle, syncPlanSheets, the download.  Its own
   measurer keeps the answer identical at every call site, and that stability
   matters more than anything else here: a sheet set that came out differently
   depending on who asked would have the toggle and the drawing disagree about
   which sheets exist. */
let planMeasureCanvas=null;
function planMeasurer(){
  if (planMeasureCanvas) return planMeasureCanvas;
  try { planMeasureCanvas=document.createElement('canvas').getContext('2d'); } catch(e){}
  return planMeasureCanvas;
}
/* A second sheet is a real cost to whoever carries it, so a schedule short
   enough to read at a glance stays where it is even when moving it would buy a
   rung. Seven species is about where a key stops being a caption. */
const PLAN_SCHEDULE_PAGE_MIN=8;
/* Does the schedule go on its OWN page, with the drawing keeping a compact key?
   It is a MEASUREMENT, not a threshold: the table sits inside the same page the
   drawing has to fit, so it moves off exactly when keeping it would cost the
   drawing a rung of the scale ladder - and stays put when moving it would buy
   nothing, because one sheet beats two for nothing.  A fixed species count
   cannot answer this, because the marginal cost of a row depends on the plot:
   the demo garden's 21 species cost it two rungs (1:192 against 1:96, a
   quarter of the drawn area), while the same 21 species on a quarter acre cost
   nothing at all, since a plot that size is already at the coarse end.
   Counted in UNWRAPPED rows so planSheets stays pure and cheap - the toggle,
   the download and syncPlanSheets all call it and none of them has a canvas to
   measure wrapped names with. The geometry then uses the real measured height
   either way. */
function planScheduleSplits(){
  const ids=planPlantedRefIds(), rows=ids.length?ids.length+1:0;
  if (rows<PLAN_SCHEDULE_PAGE_MIN) return false;
  const fixed=planSiteRows(planSite())*PLAN_ROW_H;
  const ctx=planMeasurer();
  /* The table as it would really be SET, wrapped names included - the row
     count alone underestimates it and so is biased against splitting, which is
     the direction that leaves a sheet overflowing.  One refinement pass off the
     row estimate is enough: the column widths barely move between two rungs,
     and the decision has to be consistent rather than optimal. */
  let full=planGeometry(rows*PLAN_ROW_H+fixed);
  full=planGeometry(planScheduleLayout(ctx,full,ids).h+fixed);
  const keyRows=Math.ceil((rows-1)/PLAN_KEY_COLS)+2;   // heading, rows, the pointer line
  const key=planGeometry(keyRows*PLAN_ROW_H+fixed);
  if (key.scale.denom<full.scale.denom) return true;   // it is costing a rung
  /* And at the BOTTOM of the ladder there is no rung left to lose, so the table
     stops costing scale and starts costing the page itself: nothing can be
     drawn coarser, PLAN_CELL_MIN having ruled the rest illegible, so moving the
     table off is the only thing that makes the sheet fit at all. */
  return full.H2/PLAN_DPI>PLAN_PAGE_H_IN && key.H2/PLAN_DPI<=PLAN_PAGE_H_IN;
}
function planSheets(){
  const sheets=[{id:'planting', layer:'plants', name:'Planting plan'}];
  const bulbs=game.bulbs||{};
  if (Object.keys(bulbs).some(k=>bulbs[k]&&!bulbs[k].removed&&!bulbs[k].ex))
    sheets.push({id:'bulbs', layer:'bulbs', name:'Bulb plan'});
  if (planScheduleSplits())
    sheets.push({id:'schedule', layer:'all', name:'Plant schedule'});
  return sheets;
}
const PLAN_SHEET_CANVAS={planting:'planCanvas', bulbs:'planBulbCanvas', schedule:'planSchedCanvas'};
function planSheetCanvasId(id){ return PLAN_SHEET_CANVAS[id]||'planCanvas'; }
function activePlanSheet(){
  const sheets=planSheets();
  return sheets.find(s=>s.id===game.planSheet) || sheets[0];
}
function layerRefIds(layer){
  const set=new Set();
  for (const k in layer||{}){ const p=layer[k];
    if (p && !p.removed && p.s) set.add(p.s+'|'+(p.v||'')); }
  return set;
}
// which sheet is on screen; the other is built and hidden, so it still prints
function setPlanSheet(id){
  if (game.planSheet===id) return;
  game.planSheet=id;
  syncPlanSheets();
}
function syncPlanSheets(){
  const sheets=planSheets(), active=activePlanSheet(), many=sheets.length>1;
  const tog=$('planSheetToggle'); if (tog) tog.hidden=!many;
  const byCanvas={}; sheets.forEach(s=>{ byCanvas[planSheetCanvasId(s.id)]=s.id; });
  Object.keys(PLAN_SHEET_CANVAS).map(k=>PLAN_SHEET_CANVAS[k]).forEach(cid=>{ const c=$(cid); if (!c) return;
    const sid=byCanvas[cid];
    /* `has-sheet` marks a canvas this garden actually HAS, so the print rules
       can emit the whole set without also emitting the undrawn 300x150 default
       canvas as a blank second page. */
    if (c.classList) c.classList.toggle('has-sheet', !!sid);
    c.hidden=!sid || sid!==active.id;
  });
  const tabs=[['planting','btnPlanSheetPlanting'],['bulbs','btnPlanSheetBulbs'],['schedule','btnPlanSheetSchedule']];
  tabs.forEach(([id,bid])=>{
    const b=$(bid); if (!b) return;
    b.hidden=!sheets.some(s=>s.id===id);
    const on=active.id===id;
    b.classList.toggle('on',on);
    b.setAttribute('aria-selected',on?'true':'false');
  });
}
/* Everything the SET shares, resolved once: what is planted, the codes, the
   tints, the quantities, the site, and the one geometry every sheet is drawn
   to.  Separate from buildPlanMap so the set's own decisions can be asked
   about without rendering it - a measuring context is all it needs. */
function planSharedState(sheets,measureCtx){
  /* Planted RECORDS per species|cultivar - what the codes and the schedule's
     ORDER are built from.  NOT plan tiles: `shrubPlanComponents` tiles are the
     mature FOOTPRINT, so counting those would bill one viburnum as nine.  (The
     quantity itself comes from plantingQuantities, which is stricter still.)
     Codes are assigned ACROSS the whole set, never per sheet: a tag has to
     mean the same plant on the planting plan, on the bulb plan and in the
     planting list, or the set contradicts itself. */
  const planted={};
  [game.plants,game.bulbs].forEach(layer=>{ for (const k in layer){ const p=layer[k];
    if (p && !p.removed && p.s && !p.ex){ const id=p.s+'|'+(p.v||''); planted[id]=(planted[id]||0)+1; } } });
  const ids=Object.keys(planted).sort((a,b)=>planted[b]-planted[a]||a.localeCompare(b));
  const shared={planted, qty:plantingQuantities(), codes:planCodes(ids), ids, sheets,
    tints:planSheetTints(ids,planLayerOf), site:planSite(),
    plantIds:layerRefIds(game.plants), bulbIds:layerRefIds(game.bulbs)};
  shared.split=sheets.some(s=>s.layer==='all');
  /* The geometry is the SET'S, not each sheet's: same scale, same paper, same
     origin, so the sheets can be compared and overlaid (see planSetGeometry).
     It needs a context up front because the schedule's height depends on where
     its names wrap, and the scale depends on that height. */
  shared.g=planSetGeometry(measureCtx,shared);
  return shared;
}
function buildPlanMap(){
  const sheets=planSheets();
  if (!sheets.some(s=>s.id===game.planSheet)) game.planSheet=sheets[0].id;
  const canvases=sheets.map(s=>$(planSheetCanvasId(s.id)));
  const measure=canvases.find(Boolean);
  const shared=planSharedState(sheets, measure?measure.getContext('2d'):planMeasurer());
  sheets.forEach((s,i)=>{ const pc=canvases[i]; if (!pc) return;
    if (s.layer==='all') drawPlanScheduleSheet(pc,s,i,shared);
    else drawPlanSheet(pc,s,i,shared); });
  syncPlanSheets();
}
/* The smoothed blob every drift, ghost and bulb zone is drawn as: a quadratic
   midpoint spline through the traced lattice loop, wobbled by planJitter so
   neighbouring blobs nest.  `Subpath` omits beginPath so several loops can be
   accumulated into one path — which a clip needs and a per-loop fill does not. */
function planBlobSubpath(ctx,loop,X,Y){
  const pts=loop.map(([x,y])=>{ const [jx,jy]=planJitter(x,y);
    return [X(x+jx*0.6), Y(y+jy*0.6)]; });
  const mid=(a,b2)=>[(a[0]+b2[0])/2,(a[1]+b2[1])/2];
  let m=mid(pts[pts.length-1],pts[0]);
  ctx.moveTo(m[0],m[1]);
  for (let i=0;i<pts.length;i++){
    const nxt=mid(pts[i],pts[(i+1)%pts.length]);
    ctx.quadraticCurveTo(pts[i][0],pts[i][1],nxt[0],nxt[1]);
  }
  ctx.closePath();
}
function planBlobPath(ctx,loop,X,Y){ ctx.beginPath(); planBlobSubpath(ctx,loop,X,Y); }

/* ---------- bulb zones ----------
   Bulbs are NATURALISED, not set out.  What a bulb sheet says is "scatter this
   many through here" — a density over an AREA — where a perennial drift says
   "this plant, on this ground".  Drawn as drifts they said the wrong thing
   twice over: a scatter at the spacing bulbs are actually planted at came out
   as forty separate one-tile shapes, and the per-tile ring of 0.8.81 was a
   per-tile symbol, which is precisely the claim this convention exists to
   avoid making.

   So a bulb stand draws as a ZONE: its planting grown by a tile, so a scatter
   reads as one flowing area; a DASHED boundary, because the boundary is
   indicative; a stipple at the real planting density; and the count on the
   label.  The number is the authoritative part and the shape is not, which is
   exactly what a dashed line means on a drawing.

   The count still comes from the PLANTED tiles (`plantsForTiles`), never from
   the grown zone, so the label, the schedule and the planting list cannot
   disagree — the zone is bigger than the planting on purpose. */
const BULB_ZONE_GROW=1;
/* The stand gap the ZONES imply, rather than a second number to keep in step
   with them: two planted tiles at Chebyshev distance d have grown zones that
   touch exactly when d <= 2*GROW+1, and two zones that touch trace as ONE
   loop.  Grouped at the perennial gap of 2 instead, a scatter three tiles
   apart stayed 42 separate stands whose zones abutted — 42 dashed shapes with
   seams between them, which is the opposite of the one flowing area the zone
   exists to draw.  At 4 tiles apart they are genuinely two plantings and stay
   two. */
const BULB_STAND_GAP=2*BULB_ZONE_GROW+1;
const BULB_DOT_MAX=10, BULB_DOT_K=1.4;
function bulbZoneTiles(tiles){
  const out=new Set();
  const G=BULB_ZONE_GROW;
  for (const [x,y] of tiles){
    for (let dy=-G;dy<=G;dy++) for (let dx=-G;dx<=G;dx++){
      const nx=x+dx, ny=y+dy;
      if (!onPlot(nx,ny)) continue;
      /* A zone may spread through planting and lawn and never across paving,
         water or a building: you do not naturalise bulbs into a gravel path,
         and a zone that ran over one would be claiming ground the design has
         already spent. */
      const t=tileTerrain(nx,ny);
      if (t==='path' || t==='water') continue;
      if (houseAt(nx,ny)) continue;
      if (buildingAt(nx,ny)) continue;
      out.add(`${nx},${ny}`);
    }
  }
  for (const [x,y] of tiles) out.add(`${x},${y}`);   // the planting is always in its own zone
  return out;
}
/* Stipple density from real bulbs per zone tile, square-root compressed: the
   linear figure spans 36:1 across the catalog (crocus at 3in against allium at
   12in) and would go from unreadably solid to a single dot.  Compressed it
   still separates a crocus carpet from a thin camassia scatter — measured 6
   dots a tile against 2 on the same ground — while a sparse scatter of a dense
   bulb and a tight drift of a sparser one land in the same place, which is the
   truth about them. */
function bulbDotsPerTile(bulbs,zoneTiles){
  const per=Math.max(0,bulbs)/Math.max(1,zoneTiles);
  return Math.max(1, Math.min(BULB_DOT_MAX, Math.round(Math.sqrt(per)*BULB_DOT_K)));
}
function drawBulbZones(ctx,g,stands,tints){
  const {cell,X,Y}=g;
  stands.forEach(st=>{
    const def=plantDef(st.s,st.v), t=planTintOf(tints,st.s,st.v,'zone');
    const zone=bulbZoneTiles(st.tiles);
    const loops=traceOutlines(zone);
    if (!loops.length) return;
    const dots=bulbDotsPerTile(plantsForStand(def,st.n), zone.size);
    /* One path, filled EVEN-ODD, because a zone can have a hole: it never
       spreads across paving, so a path running through a naturalised area
       comes back from the trace as an inner loop.  Filled loop by loop that
       hole paints solid and the tint covers the path — undoing the exclusion
       that put the hole there.

       The tint's job is NOT to mark the zone — the stipple and the dashed edge
       do that, which is the whole point of the convention. Its job is only to
       let two bulb species in one bed read apart by hue, and to not read as a
       HOLE: at 0.80 it measured 27 (RGB distance from paper) against the bed's
       own 37, so the zone came out paler than the ground it sits on and looked
       like a patch cut out of the planting. 0.72 lands level with the bed and
       fights it for nothing. Note the distance is linear in (1-t) and scales
       with how far the species' own colour is from paper, so a pale bulb will
       always tint more weakly than a saturated one — which is exactly why the
       marking cannot rest on the tint. Measured on the marking instead: the
       darkest ink in a zone tile is 118 against 226 for bare bed and for the
       perennial ghost, on paper at 243. */
    ctx.fillStyle=t.fill;
    ctx.beginPath();
    loops.forEach(loop=>planBlobSubpath(ctx,loop,X,Y));
    ctx.fill('evenodd');
    // stipple, clipped to the zone: the smoothing insets and outsets the
    // lattice, so an unclipped dot lands outside its own boundary
    ctx.save();
    ctx.beginPath();
    loops.forEach(loop=>planBlobSubpath(ctx,loop,X,Y));
    ctx.clip('evenodd');
    ctx.fillStyle=t.edge;
    const r=Math.max(0.7, cell*0.055);
    for (const k of zone){
      const [x,y]=k.split(',').map(Number);
      const rnd=mulberry(tileSeed(x,y));       // seeded: a sheet reprints the same
      for (let i=0;i<dots;i++){
        ctx.beginPath();
        ctx.arc(X(x)+rnd()*cell, Y(y)+rnd()*cell, r, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
    // dashed, because the boundary is indicative and the count is not
    ctx.save();
    ctx.setLineDash([4,3]);
    ctx.strokeStyle=t.edge; ctx.lineWidth=1.2;
    loops.forEach(loop=>{ planBlobPath(ctx,loop,X,Y); ctx.stroke(); });
    ctx.restore();
  });
}

/* ---------- the site base ----------
   Every sheet in a set draws the same site: the same paper, the same north
   arrow, the same ground, the same buildings, the same lot line.  What
   differs is only which planting is the subject and which is context.  Those
   ~300 lines used to sit inline in drawPlanSheet, so the two sheets shared
   them only by being one body called twice — which worked, and hid the seam.
   Naming them is what makes a third sheet (hardscape) or a per-sheet
   variation of the base a small change rather than surgery on a 480-line
   function.

   NOTE they deliberately do NOT wrap themselves in save/restore.  Canvas
   state leaks from block to block today and later blocks rely on it — the
   grid inherits the north arrow's textAlign, the schedule sets its own.
   Isolating them would be a behaviour change wearing a tidy-up's clothes. */
/* ---------- drawing scale ----------
   A plan is measurable only if it is drawn to a RATIO somebody can name and
   check against a rule.  `cell` used to be max(9,min(24,floor(1000/side))) —
   an arbitrary fit that gave a 31-tile plot 24px a tile and a quarter acre 9,
   so the sheet was a picture rather than a drawing and nothing on it could be
   measured except through the graphic bar.

   The sheet now picks the most detailed standard scale at which the plot still
   fits a portrait page, states it in the title block, and prints at exactly
   that size: PLAN_DPI units to the paper inch, with the print CSS sizing the
   canvas in real inches so a rule laid on the paper agrees.

   Two honesties this has to keep.  The scale is always TRUE and it is the
   PAPER that grows: a plot too big for the page at every legible scale keeps
   the coarsest legible one and produces a wider sheet, exactly as a real site
   goes onto a bigger sheet rather than being drawn at a scale nobody can read.
   And a browser's "fit to page" rescales the print, which no stated ratio
   survives — so the title block says "at full size" and the graphic bar stays
   the thing that is true either way, which is why a real drawing prints its
   paper size beside its scale. */
const PLAN_DPI=96;                 // drawing units to the paper inch
/* The page the sheet is sized for: Letter and A4 portrait, less margins AND
   less the header/footer a browser prints by default.  9.4in is deliberately
   pessimistic about the height — a sheet that overflows loses the bottom of
   the schedule, and the reader cannot tell that anything is missing. */
const PLAN_PAGE_W_IN=7.2, PLAN_PAGE_H_IN=9.4;
const PLAN_CELL_MIN=8;             // below this a tile carries no readable label
/* The bands above and below the drawing. The scale bar sits in the FIRST gap,
   with the drawing it measures, rather than at the foot of the sheet under the
   whole schedule — where it was both wrong (a graphic scale belongs beside its
   drawing) and the first thing a short page cut off. */
const PLAN_PAD_T=92, PLAN_PAD_L=34;
/* The row drawPlanPaper puts the over-page warning on, below the title block.
   Named because the schedule page has to keep its own heading clear of it. */
const PLAN_WARN_Y=84;
const PLAN_SCALEBAR_GAP=16, PLAN_SCHEDULE_GAP=44, PLAN_FOOT=12;
/* A sheet narrow enough to fit a small plot cannot fit the schedule, so the
   paper has a floor and the drawing centres inside it. */
const PLAN_SHEET_MIN_W=660;
const PLAN_ROW_H=15;               // one schedule row, and one key row
const PLAN_ROW_LINE=12;            // each wrapped line past a row's first
/* Denominator of the ratio, most detailed first. Real feet to the paper inch
   is denom/12, so 1:48 is the quarter-inch scale and 1:96 the eighth.
   The two sixteenth-family rungs are here because the LADDER'S GRANULARITY is
   what a budget change costs: with only 48 and 96 in the small range, a 27 ft
   plot that misses the quarter-inch scale by a quarter inch of paper falls all
   the way to an eighth and loses three quarters of its drawn area. Both are
   standard architectural scales, so nothing is invented to soften a
   constraint - the rungs were simply missing. */
const PLAN_SCALES_IMPERIAL=Object.freeze([
  {denom:48,  label:'1/4" = 1 ft'},
  {denom:64,  label:'3/16" = 1 ft'},
  {denom:96,  label:'1/8" = 1 ft'},
  {denom:120, label:'1" = 10 ft'},
  {denom:128, label:'3/32" = 1 ft'},
  {denom:192, label:'1" = 16 ft'},
  {denom:240, label:'1" = 20 ft'},
  {denom:480, label:'1" = 40 ft'},
]);
const PLAN_SCALES_METRIC=Object.freeze([
  {denom:50}, {denom:100}, {denom:200}, {denom:500},
]);
function planScaleCell(s){ return (TILE_IN/12)/(s.denom/12)*PLAN_DPI; }
/* The finished PAPER's width for a drawing this wide, and the only place it
   is computed - because `planScale` has to test the same number
   `planGeometry` will produce, or the fit test is measuring something the
   sheet is not.  It tested the DRAWING alone, so the side margins were spent
   off-budget: a 27 ft plot claimed to fit a 7.2in page and printed 7.46in,
   and a 69 ft one printed 7.61in. */
function planSheetWidth(drawW){ return Math.max(PLAN_PAD_L*2+drawW, PLAN_SHEET_MIN_W); }
/* The sheet's own chrome, in paper inches: the title block above the drawing,
   and the scale bar plus everything tabled below it.  The scale has to be
   chosen against what is LEFT of the page after that, not against the page -
   sizing to the width alone printed a sheet 9.9in tall on a ~9.5in printable
   area and cut the last two schedule rows and the scale bar off the bottom,
   which is exactly the part a reader needs.  `bodyPx` is that table's real
   height in drawing units rather than a row count, because a wrapped
   botanical name makes a row two lines tall. */
function planChromeIn(bodyPx){
  return (PLAN_PAD_T+PLAN_SCHEDULE_GAP+Math.max(0,bodyPx||0)+PLAN_FOOT)/PLAN_DPI;
}
function planScale(bodyPx){
  const list=metricUnits()?PLAN_SCALES_METRIC:PLAN_SCALES_IMPERIAL;
  const legible=list.filter(s=>planScaleCell(s)>=PLAN_CELL_MIN);
  const usable=legible.length?legible:[list[0]];
  const hBudget=Math.max(2, PLAN_PAGE_H_IN-planChromeIn(bodyPx));
  // both sides in paper inches, off the same cell, so neither can drift
  const fits=s=>{ const cell=planScaleCell(s);
    return planSheetWidth(GW*cell)/PLAN_DPI<=PLAN_PAGE_W_IN
        && GH*cell/PLAN_DPI<=hBudget; };
  return usable.find(fits) || usable[usable.length-1];
}
// does the finished sheet still exceed the page it was sized for?
function planOverPage(g){
  return g.W2/PLAN_DPI>PLAN_PAGE_W_IN+0.05 || g.H2/PLAN_DPI>PLAN_PAGE_H_IN+0.05;
}
function planScaleText(s){
  const ratio=`1:${s.denom}`;
  return s.label ? `${s.label} (${ratio})` : ratio;
}
function planGeometry(bodyPx){
  /* NOTE the scale depends on bodyPx, because the table below the drawing eats
     the page the drawing has to fit in - so a probe that passes 0 gets a
     different cell from the real sheet. Use planSetGeometry, or pass what it
     passes. */
  const body=Math.max(0,bodyPx||0);
  const scale=planScale(body);
  const cell=planScaleCell(scale);
  const padL=PLAN_PAD_L, padT=PLAN_PAD_T;
  const drawW=GW*cell;
  const W2=planSheetWidth(drawW);   // at the classic plot size this is the floor
  const originX=Math.round((W2-drawW)/2);
  const H2=padT+GH*cell+PLAN_SCHEDULE_GAP+body+PLAN_FOOT;
  return {cell,padL,padT,drawW,W2,originX,H2,scale,body,
    X:x=>originX+x*cell, Y:y=>padT+y*cell};
}
/* ---------- the schedule's own layout ----------
   Measured and drawn through ONE description, because the sheet's height is
   chosen from the measurement and the rows are then drawn from it: two
   descriptions and the band reserved stops matching the table put in it. */
function planScheduleCols(g){
  const tblW=g.W2-g.padL*2, gapC=10, wCode=54, wQty=44, wSpace=80;
  const wRest=Math.max(80, tblW-wCode-wQty-wSpace-gapC*3);
  const wLatin=Math.round(wRest*0.56), wCommon=wRest-wLatin;
  const xCode=g.padL, xLatin=xCode+wCode, xCommon=xLatin+wLatin+gapC;
  const xQty=xCommon+wCommon+gapC, xSpace=xQty+wQty+gapC;
  return {tblW,gapC,wCode,wQty,wSpace,wLatin,wCommon,xCode,xLatin,xCommon,xQty,xSpace};
}
/* A name WRAPS rather than truncating.  `Hylotelephium (Herbstfreude Group)
   'Herbstfreude'` came out as `Hylotelephium (Herbstfreude Grou...`, so the
   one thing a reader needs in order to buy the right plant - the cultivar
   epithet - was the one thing the ellipsis ate.  A schedule is an ordering
   document and can be two lines tall.  The cap is there so a pathological name
   cannot push the drawing off the page, and a single word wider than its own
   column is the one case still cut, because it has nowhere to break. */
const PLAN_WRAP_LINES=3;
function planWrapText(ctx,str,maxW,maxLines){
  const cap=Math.max(1,maxLines||PLAN_WRAP_LINES);
  const words=String(str==null?'':str).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const out=[];
  let line=words[0];
  for (let i=1;i<words.length;i++){
    const t=line+' '+words[i];
    if (ctx.measureText(t).width<=maxW){ line=t; continue; }
    if (out.length+1>=cap){ line=[t].concat(words.slice(i+1)).join(' '); break; }
    out.push(line); line=words[i];
  }
  out.push(line);
  return out.map(l=>ctx.measureText(l).width>maxW?planFitText(ctx,l,maxW):l);
}
function planScheduleLayout(ctx,g,ids){
  const col=planScheduleCols(g), rows=[];
  let h=ids.length?PLAN_ROW_H:0;          // the column header
  if (ctx) ctx.font='10px IBM Plex Sans'; // the weight the names are drawn at
  ids.forEach(id=>{
    const [s,v]=id.split('|');
    const latin=ctx?planWrapText(ctx,planBotanicalName(s,v||null),col.wLatin-col.gapC):[''];
    const common=ctx?planWrapText(ctx,planCommonName(s,v||null),col.wCommon-col.gapC):[''];
    const rh=PLAN_ROW_H+(Math.max(latin.length,common.length)-1)*PLAN_ROW_LINE;
    rows.push({id,latin,common,h:rh});
    h+=rh;
  });
  return {col,rows,h};
}
/* The non-planting key rows take the same 15px band and are counted with the
   schedule, so the page budget sees the whole table. */
function planSite(){
  const live=m=>Object.keys(m||{}).filter(k=>m[k]&&!m[k].removed);
  return {lightsLive:live(game.lights), bouldersLive:live(game.boulders),
    treesLive:Object.keys(game.plants).filter(k=>{ const p=game.plants[k];
      return p && !p.removed && !p.ex && isTreeDef(plantDef(p.s,p.v)); }),
    existingCount:existingTiles().length, softCount:softComponents().length};
}
/* Where the schedule page's table starts. One row below the drawing sheets'
   padT, because a drawing has nothing at the top of its field while this table
   has its heading 8px ABOVE its first row - which is exactly the row
   drawPlanPaper puts the over-page warning on. */
const PLAN_SCHED_TOP=PLAN_PAD_T+PLAN_ROW_H;
function planSiteRows(site){
  return (site.lightsLive.length?1:0)+(site.bouldersLive.length?1:0)+(site.treesLive.length?1:0)+(site.existingCount?1:0)+(site.softCount?1:0);
}
function planSheetIds(shared,sheet){
  if (sheet.layer==='all') return shared.ids;   // the schedule page holds the set
  const on=sheet.layer==='bulbs'?shared.bulbIds:shared.plantIds;
  return shared.ids.filter(id=>on.has(id));
}
/* The compact key a drawing sheet keeps when the schedule moves to its own
   page: swatch, code and COMMON name, in two columns.  Common rather than
   botanical because this is the sheet somebody carries into the garden, and
   because a half-width column cannot hold `Molinia caerulea subsp. caerulea
   'Moorhexe'` without wrapping every row of the very band the split exists to
   shorten.  The botanical name, the quantity and the spacing are one page
   over, and the band says so rather than leaving the reader to wonder. */
const PLAN_KEY_COLS=2;
function planKeyBandLayout(g,ids){
  const tblW=g.W2-g.padL*2, gap=14, cols=Math.max(1,PLAN_KEY_COLS);
  const colW=(tblW-gap*(cols-1))/cols;
  const rows=Math.ceil(ids.length/cols);
  // heading, the rows themselves, and the line pointing at the schedule sheet
  return {cols,colW,gap,rows,ids,tblW,h:ids.length?PLAN_ROW_H*(rows+2):0};
}
/* ONE scale and ONE drawing position for the whole SET, sized for the LONGEST
   schedule in it.  Each sheet used to compute its own geometry from its own
   row count, so a garden with bulbs drew its planting at 1:120 and its bulbs
   at 1:96 with the origin 49px further left: the garden visibly grew when you
   switched tabs, and the two prints could not be laid over one another - which
   is the one thing a bulb OVERLAY exists to be.

   The schedule's height feeds the scale (a longer table leaves less page for
   the drawing) and the scale feeds the schedule's width (the paper is as wide
   as the drawing), so the two are mutually dependent: a coarser scale narrows
   the columns, which wraps another name, which lengthens the table.  Resolve
   it by iterating rather than by guessing.  Growth is monotone and the ladder
   is short, so it settles in a pass or two; the cap is there so a pathological
   palette cannot spin, and overshooting it merely trips planOverPage, which is
   the sheet's existing way of saying it does not fit. */
const PLAN_FIT_PASSES=4;
function planSetGeometry(ctx,shared){
  const fixed=planSiteRows(shared.site)*PLAN_ROW_H;
  const drawn=shared.sheets.filter(s=>s.layer!=='all');
  const band=g=>{
    let want=0;
    drawn.forEach(s=>{ const ids=planSheetIds(shared,s);
      want=Math.max(want, shared.split?planKeyBandLayout(g,ids).h:planScheduleLayout(ctx,g,ids).h); });
    return want;
  };
  let body=0, g=planGeometry(fixed);
  for (let i=0;i<PLAN_FIT_PASSES;i++){
    const want=band(g);
    if (want<=body) break;
    body=want; g=planGeometry(body+fixed);
  }
  /* The paper belongs to the SET, so it also has to be tall enough for the
     schedule page's own table - and where it is not, the PAPER grows, which is
     the same honesty the scale keeps (a real site goes onto a bigger sheet
     rather than being drawn at a ratio nobody can read).  planOverPage then
     says so on every sheet. */
  if (shared.split){
    const page=shared.sheets.find(s=>s.layer==='all');
    const need=PLAN_SCHED_TOP+planScheduleLayout(ctx,g,planSheetIds(shared,page)).h+PLAN_FOOT;
    if (need>g.H2) g.H2=need;
  }
  return g;
}
// paper, border, title block and the true-north arrow
function drawPlanPaper(ctx,g,sheetName){
  const {padL,W2,H2}=g;
  // paper
  ctx.fillStyle='#f7f3e8'; ctx.fillRect(0,0,W2,H2);
  ctx.strokeStyle='#b8ad95'; ctx.lineWidth=1;
  ctx.strokeRect(8,8,W2-16,H2-16);
  // title block
  ctx.fillStyle='#2c241c'; ctx.textAlign='left';
  ctx.font='600 22px Fraunces, serif';
  ctx.fillText(game.worldName||'Design plan', padL, 38);
  ctx.font='11px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText(`${sheetName} · SeedHead Garden Design · ${new Date().toLocaleDateString()}`, padL, 56);
  const ftPerTile=TILE_IN/12;
  /* "at full size" is not hedging: a browser's fit-to-page rescales the sheet
     and no stated ratio survives that, so the sheet says when its ratio holds
     and leaves the graphic bar as the thing that is true either way. */
  ctx.fillText(`1 tile = ${tileSizeText()} · plot ${fmtFeet(GW*ftPerTile)} × ${fmtFeet(GH*ftPerTile)}`
    + ` · scale ${planScaleText(g.scale)} at full size`, padL, 70);
  /* Only when it genuinely does not fit — a big plot with a long schedule
     cannot be drawn on one portrait page at any legible scale, and a reader
     who prints it needs to know that BEFORE the bottom goes missing rather
     than after. Its own short line, so the line above never overflows. */
  if (planOverPage(g)){
    ctx.font='9px IBM Plex Sans'; ctx.fillStyle='#a2581f';
    ctx.fillText(`Larger than one portrait page (${(g.W2/PLAN_DPI).toFixed(1)}″ × ${(g.H2/PLAN_DPI).toFixed(1)}″)`
      + ' — print to a bigger sheet, or scale to fit and read the bar', padL, PLAN_WARN_Y);
    ctx.font='11px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  }
}
/* True north rotates inside the plan; the garden drawing itself stays in the
   user's plot coordinates so labels and saved tile positions never move.  It is
   its own block because the schedule page takes the same paper and title block
   and has no orientation to state - a table does not face north. */
function drawPlanNorth(ctx,g){
  const {W2}=g;
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
}
// the site UNDER the planting: grid, grade, terrain, hardscape, fixtures
function drawPlanGround(ctx,g,site){
  const {cell,padL,padT,W2,H2,X,Y}=g;
  const {lightsLive,bouldersLive}=site;
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
  /* elevation grade: subtle plan cue under materials/plants. The height itself
     is ONE spot label per terrace, placed with the plant labels (planTerraceSpots,
     drawPlanSheet), not a step count printed on every tile. */
  for (const k in game.elevation){ const e=game.elevation[k];
    if (!e || e.removed || !e.h) continue;
    const [x,y]=k.split(',').map(Number);
    if (isSoftTile(x,y)) continue;                       // a berm is drawn in contours
    ctx.fillStyle=e.h>0?'rgba(145,119,70,0.16)':'rgba(73,112,140,0.18)';
    ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
  }
  // terrain — organic gardens draw the SAME smoothed region geometry the
  // garden renderer uses (terrainLoopPath over the cached arcs, projected to
  // paper), so the plan finally matches what the gardener sees; formal
  // gardens keep the crisp per-tile cells.
  if (game.edgeStyle==='organic'){
    const planProj=([gx,gy])=>[X(gx),Y(gy)];
    for (const region of buildTerrainRegions()){
      const o={k:region.kind,c:region.c};
      ctx.fillStyle=region.kind==='path'?pathPlanFill(o):region.kind==='water'?waterPlanFill(o)
        :region.kind==='lawn'?lawnPlanFill(o):bedPlanFill(o);
      ctx.beginPath();
      for (const loop of region.loops) terrainLoopPath(ctx,loop,planProj);
      ctx.fill('evenodd');
      // the same skirt the garden lays under a path's smoothed edge, or the
      // sheet shows the paper through every joint the path's curve falls short of
      if (region.skirts) for (const s of region.skirts){ terrainSkirtPath(ctx,s,planProj); ctx.fill('evenodd'); }
      // outline separately: the silhouette fills, but a boundary a higher-ranked
      // region covers must not be drawn as an edge on the sheet either
      ctx.beginPath();
      for (const loop of region.loops) terrainLoopStroke(ctx,loop,planProj);
      ctx.strokeStyle='rgba(88,70,52,0.5)'; ctx.lineWidth=1.1;
      ctx.stroke();
      /* Edging on the sheet follows the same soft arcs the garden strokes,
         through the paper projector — drawn per tile it came out as a
         staircase running alongside a smooth bed, which is exactly the
         mismatch terrainLoopPath exists to prevent. */
      const es=edgingStyle(regionEdging(region));
      if (es.w){
        for (const loop of region.loops){
          if (loop.closed){ if (!loop.covered && !loop.hard) strokeEdgingArc(ctx,loop,planProj,es,cell); continue; }
          for (const arc of loop.arcs) if (!arc.covered && !arc.hard) strokeEdgingArc(ctx,arc,planProj,es,cell);
        }
      }
    }
  } else {
    for (const k in game.terrain){ const t2=game.terrain[k];
      if (t2.removed) continue;
      const [x,y]=k.split(',').map(Number);
      ctx.fillStyle=t2.k==='path'?pathPlanFill(t2):t2.k==='water'?waterPlanFill(t2)
        :t2.k==='lawn'?lawnPlanFill(t2):bedPlanFill(t2);
      ctx.fillRect(X(x)+0.5,Y(y)+0.5,cell-1,cell-1);
    }
  }
  /* Fire pits, TO SCALE: the outside at its real size and the opening inside
     it, the wall tinted by what it is built in. They were drawn as a fraction
     of the tiles they claim, which made a 24 in and a 36 in pit the same circle
     (both claim 2x2) — on a sheet somebody lays a rule on. */
  for (const k in game.firepits){ const f=game.firepits[k];
    if (!f || f.removed) continue;
    const [x,y]=k.split(',').map(Number), d=normalizeFirepitDraft(f), sz=firepitTileSize(d), g=firepitDims(d);
    const ppi=cell/TILE_IN, cxp=X(x)+sz.w*cell/2, cyp=Y(y)+sz.h*cell/2;
    const fin=firepitFinish(d.style,d.finish), tone=fin.tones?fin.tones[0]:fin.tone;
    // a turned oblong pit runs the other way on the sheet too
    const hw=(d.face?g.hv:g.hu)*ppi, hd=(d.face?g.hu:g.hv)*ppi, t=g.thick*ppi;
    ctx.fillStyle=mixHex(tone,'#f7f3e8',0.45); ctx.strokeStyle='#3b3028'; ctx.lineWidth=1.3;
    if (d.shape==='round'){
      ctx.beginPath(); ctx.ellipse(cxp,cyp,hw,hw,0,0,7); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2f261f'; ctx.beginPath(); ctx.ellipse(cxp,cyp,Math.max(1,hw-t),Math.max(1,hw-t),0,0,7); ctx.fill();
    } else {
      ctx.fillRect(cxp-hw,cyp-hd,hw*2,hd*2); ctx.strokeRect(cxp-hw,cyp-hd,hw*2,hd*2);
      ctx.fillStyle='#2f261f'; ctx.fillRect(cxp-hw+t,cyp-hd+t,Math.max(1,hw*2-t*2),Math.max(1,hd*2-t*2));
    }
  }
  // water features, to scale in their own outlines (drawPlanWaterFeature)
  for (const k in game.waterFeatures||{}){ const w=game.waterFeatures[k];
    if (!w || w.removed) continue;
    const [x,y]=k.split(',').map(Number);
    drawPlanWaterFeature(ctx,X(x),Y(y),cell,w);
  }
  // boulders
  /* Each rock TO SCALE in its real outline: the widest ring of the very shell
     the garden draws on that tile, turned the way the stone is turned, so the
     plan and the garden show the same stone and a 34 in boulder measures 34 in
     off the sheet. It drew a tile-fraction ellipse, the same for every stone. */
  bouldersLive.forEach(k=>{
    const b=normalizeBoulderDraft(game.boulders[k]), st=boulderStone(b.stone), sz=boulderTileSize(b);
    const [x,y]=k.split(',').map(Number), px=X(x), py=Y(y), w=sz.w*cell, h=sz.h*cell;
    const ppi=cell/TILE_IN, f=b.face;
    // the rock's own (u,v) onto the sheet's world axes, a quarter turn per face
    const W2=(u,v)=>{ const r=f===1?[-v,u]:f===2?[-u,-v]:f===3?[v,-u]:[u,v];
      return [px+w/2+r[0]*ppi, py+h/2+r[1]*ppi]; };
    ctx.save();
    ctx.fillStyle=mixHex(st.tone,'#f7f3e8',0.3);
    ctx.strokeStyle=mixHex(st.lo,'#2c241c',0.3);
    ctx.lineWidth=1.1; ctx.lineJoin='round';
    for (const m of boulderMeshes(b,boulderSeedAt(game.boulders[k],x,y))){
      // the widest ring is the one the stone stands on: ring 1, or a prism's base
      const ring=m.V.slice(m.R>2?m.n:0,(m.R>2?2:1)*m.n);
      ctx.beginPath();
      ring.forEach((p2,i)=>{ const q=W2(p2[0],p2[1]); if (!i) ctx.moveTo(q[0],q[1]); else ctx.lineTo(q[0],q[1]); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  });
  // fences and gates
  for (const k in game.fences){ const f=game.fences[k];
    if (f.removed) continue;
    const [x,y]=k.split(',').map(Number), st=fenceStyle(f.style);
    const cx2=X(x)+cell/2, cy2=Y(y)+cell/2;
    const run=f.gate?fenceRunAxis(x,y):null;
    ctx.strokeStyle=st.post; ctx.lineWidth=st.infill==='masonry'?3:1.6;
    [[1,0],[0,1]].forEach(([dx,dy])=>{
      if (!fenceAt(x+dx,y+dy)) return;
      // a gate is a break in the wall on the plan too: the run stops at its posts
      if (run && dx===run[0] && dy===run[1]) return;
      ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(X(x+dx)+cell/2,Y(y+dy)+cell/2); ctx.stroke();
    });
    if (f.gate){
      // one symbol per contiguous gate run, matching the garden (see fenceGateSpan)
      const span=fenceGateSpan(x,y,run);
      if (span.a) continue;
      // standard plan gate: leaf plus swing arc, drawn across the actual run
      const r=Math.max(4,cell*0.42), a0=Math.atan2(run[1],run[0]);
      const len=r*2*0.94+span.b*cell, hx=cx2-Math.cos(a0)*r, hy=cy2-Math.sin(a0)*r;
      ctx.strokeStyle=st.post; ctx.lineWidth=1.6;
      ctx.beginPath();
      ctx.moveTo(hx,hy);
      ctx.lineTo(hx+Math.cos(a0+Math.PI/2)*len, hy+Math.sin(a0+Math.PI/2)*len);
      ctx.stroke();
      ctx.strokeStyle='rgba(92,84,69,0.5)'; ctx.lineWidth=0.8;
      ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.arc(hx,hy,len,a0,a0+Math.PI/2);
      ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.fillStyle=st.post;
      ctx.beginPath(); ctx.arc(cx2,cy2,Math.max(2,cell*0.16),0,7); ctx.fill();
    }
  }
  /* Containers and seating are site objects a contractor sets out, so unlike
     the pets they DO belong on the plan, each to scale in its own outline
     (drawPlanPot, drawPlanSeat). */
  for (const k in game.pots||{}){
    const p=game.pots[k]; if (!p||p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    drawPlanPot(ctx,X(x),Y(y),cell,p);
  }
  for (const k in game.seats||{}){
    const s2=game.seats[k]; if (!s2||s2.removed) continue;
    const [x,y]=k.split(',').map(Number);
    drawPlanSeat(ctx,X(x),Y(y),cell,s2);
  }
  for (const k in game.ornaments||{}){
    const o=game.ornaments[k]; if (!o||o.removed) continue;
    const [x,y]=k.split(',').map(Number);
    drawPlanOrnament(ctx,X(x),Y(y),cell,normalizeOrnamentDraft(o));
  }
  /* A formal pool's coping, a foot of stone inside its outline, drawn as a
     band with the pool's edge the heavy line (0.9.154). */
  for (const L of poolOutlines()){
    const {mit}=wallCapMiters(L.pts,1,true), t=POOL_COPING.topIn/TILE_IN;
    const face=L.pts.map(([gx,gy])=>[X(gx),Y(gy)]), back=L.pts.map(([gx,gy],i)=>[X(gx+mit[i][0]*t),Y(gy+mit[i][1]*t)]);
    const line=ps=>{ ctx.moveTo(ps[0][0],ps[0][1]); for (let i=1;i<ps.length;i++) ctx.lineTo(ps[i][0],ps[i][1]); ctx.closePath(); };
    ctx.fillStyle=mixHex(POOL_COPING.capTone,'#f4efe3',0.4); ctx.beginPath(); line(face); line(back); ctx.fill('evenodd');
    ctx.strokeStyle='#4a423a'; ctx.lineWidth=1.4; ctx.beginPath(); line(face); ctx.stroke();
    ctx.strokeStyle='rgba(74,66,58,0.6)'; ctx.lineWidth=0.8; ctx.beginPath(); line(back); ctx.stroke();
  }
  /* Crossings: a deck in its own colour with its boards or slab joints across
     the span, as the garden draws it, and a stepping stone in its own outline. */
  { const dry=(a,b)=>onPlot(a,b) && tileTerrain(a,b)!=='water';
    for (const reg of crossingRegions().list){
      const ct=crossingType(reg.type);
      ctx.fillStyle=ct.plan; ctx.strokeStyle='#4a423a';
      if (reg.type==='stepping'){
        for (const [x,y] of reg.tiles){
          const {cx,cy,rad}=steppingStoneShape(x,y);
          ctx.beginPath();
          rad.forEach((r,i)=>{ const a=i/rad.length*6.2832, px=X(cx+Math.cos(a)*r), py=Y(cy+Math.sin(a)*r); i?ctx.lineTo(px,py):ctx.moveTo(px,py); });
          ctx.closePath(); ctx.fill(); ctx.lineWidth=0.8; ctx.stroke();
        }
        continue;
      }
      const has=(a,b)=>reg.has.has(a+','+b), u=ct.unitIn/TILE_IN, ax=reg.axis==='x';
      for (const [x,y] of reg.tiles){
        const {rect,outer}=crossingDeckRect(x,y,reg.axis,has,dry), [gx0,gx1,gy0,gy1]=rect;
        ctx.fillRect(X(gx0),Y(gy0),X(gx1)-X(gx0),Y(gy1)-Y(gy0));
        ctx.lineWidth=0.4; ctx.strokeStyle='rgba(74,66,58,0.55)'; ctx.beginPath();
        const a0=ax?gx0:gy0, a1=ax?gx1:gy1;
        for (let k=Math.floor(a0/u)+1;k*u<a1;k++){
          if (ax){ ctx.moveTo(X(k*u),Y(gy0)); ctx.lineTo(X(k*u),Y(gy1)); } else { ctx.moveTo(X(gx0),Y(k*u)); ctx.lineTo(X(gx1),Y(k*u)); } }
        ctx.stroke();
        ctx.lineWidth=1.1; ctx.strokeStyle='#4a423a'; ctx.beginPath();
        if (outer[0]){ ctx.moveTo(X(gx0),Y(gy0)); ctx.lineTo(X(gx0),Y(gy1)); }
        if (outer[1]){ ctx.moveTo(X(gx1),Y(gy0)); ctx.lineTo(X(gx1),Y(gy1)); }
        if (outer[2]){ ctx.moveTo(X(gx0),Y(gy0)); ctx.lineTo(X(gx1),Y(gy0)); }
        if (outer[3]){ ctx.moveTo(X(gx0),Y(gy1)); ctx.lineTo(X(gx1),Y(gy1)); }
        ctx.stroke();
      }
    }
  }
  /* Formal gardens keep crisp per-tile cells on the sheet, so their edging is
     per-tile too. The organic branch above strokes the smoothed arcs instead. */
  if (game.edgeStyle!=='organic') for (const k in game.terrain){
    const t=game.terrain[k]; if (!t||t.removed) continue;
    const es=edgingStyle(t.e); if (!es.w) continue;
    const [x,y]=k.split(',').map(Number);
    ELEV_DIRS.forEach(([dx,dy])=>{
      // the garden's own rule (isLawnTile): a painted meadow is lawn here too
      if (!isLawnTile(x+dx,y+dy)) return;
      const cx2=X(x)+cell/2+dx*cell/2, cy2=Y(y)+cell/2+dy*cell/2;
      drawEdgingRun(ctx,[[cx2-dy*cell/2,cy2-dx*cell/2],[cx2+dy*cell/2,cy2+dx*cell/2]],es,tileSeed(x,y),cell,true);
    });
  }
  /* Retaining walls: the SAME traced contours the garden draws, projected to
     paper through the sheet's own projector. Drawn per tile here they came out
     as a staircase running alongside a bed the sheet had already drawn as a
     smooth curve — the exact mismatch terrainLoopPath exists to prevent, one
     system over. Unlike the garden this shows every face, front and back: a
     plan is read from above and has no camera to hide behind.
     Since 0.9.146 a wall is drawn at its THICKNESS (the material's topIn), the
     way a plan draws a wall: the face as the heavy line, the back as a light
     one, and the band between tinted by what it is built of. It was one heavy
     line whatever the wall was, so a gabion and a steel edge looked the same. */
  {
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    const band=(wp,sgn,closed,st,ends)=>{
      if (closed && wp.length>2 && Math.hypot(wp[0][0]-wp[wp.length-1][0],wp[0][1]-wp[wp.length-1][1])<1e-6) wp=wp.slice(0,-1);
      if (wp.length<2) return;
      const {mit}=wallCapMiters(wp,sgn,closed,ends), t=(st.topIn||6)/TILE_IN;
      const face=wp.map(([gx,gy])=>[X(gx),Y(gy)]);        // the sheet projector the blobs use
      const back=wp.map(([gx,gy],i)=>[X(gx+mit[i][0]*t),Y(gy+mit[i][1]*t)]);
      const line=(ps,close)=>{ ctx.moveTo(ps[0][0],ps[0][1]); for (let i=1;i<ps.length;i++) ctx.lineTo(ps[i][0],ps[i][1]); if (close) ctx.closePath(); };
      ctx.fillStyle=mixHex(st.capTone||st.tone,'#f4efe3',0.45); ctx.beginPath();
      if (closed){ line(face,true); line(back,true); ctx.fill('evenodd'); }
      else { line(face.concat(back.slice().reverse()),true); ctx.fill(); }
      ctx.strokeStyle='#4a423a'; ctx.lineWidth=2.2; ctx.beginPath(); line(face,closed); ctx.stroke();
      ctx.strokeStyle='rgba(74,66,58,0.7)'; ctx.lineWidth=0.9; ctx.beginPath(); line(back,closed); ctx.stroke();
    };
    /* On the tile edges, as the garden draws them since 0.9.144 (the smoothed
       contour, jittered, skewed a rectangular terrace on paper), with a raised
       bed's wall along its bed's curve, and a sunken patio's corners mitred. */
    const runs=buildElevationRuns(), endsFor=wallRunEndsFor(runs), rbt=raisedBedTiles();
    for (const run of runs){
      const st=wallStyle(run.wall);
      /* A flight is drawn the way a plan draws stairs: a line at each riser and
         along its sides, and an UP arrow (below), not as walls with a coping. */
      if (run.step || run.riser){
        const p=wallRunDrawPoints(run.edges);
        ctx.strokeStyle='#4a423a'; ctx.lineWidth=1.1; ctx.beginPath();
        p.forEach(([gx,gy],i)=>i?ctx.lineTo(X(gx),Y(gy)):ctx.moveTo(X(gx),Y(gy))); ctx.stroke();
        continue;
      }
      if (!st.face || (rbt && run.edges.every(e=>rbt.has(e.tile)))) continue;
      const g=wallRunCapGeom(run);
      band(g.pts,g.sgn,g.closed,st,g.closed?null:endsFor(run));
    }
    if (rbt) for (const r of buildTerrainRegions()) if (r.raised){
      const st=wallStyle(r.raised.wall); if (!st.face) continue;
      for (const loop of r.loops) for (const arc of (loop.closed?[loop]:loop.arcs))
        if (!arc.hard && !arc.covered) band(edgingCurvePoints(arc,p=>p),-(loop.side||1),!!loop.closed,st,null);
    }
    // each flight's arrow, from its foot up to its top tread; the UP is a label (drawPlanSheet)
    for (const f of planStepFlights()){
      const [dx,dy]=f.dir, t=[X(f.lo[0]+dx*0.2),Y(f.lo[1]+dy*0.2)], h=[X(f.hi[0]-dx*0.3),Y(f.hi[1]-dy*0.3)];
      const ux=(t[0]-h[0])/(Math.hypot(t[0]-h[0],t[1]-h[1])||1), uy=(t[1]-h[1])/(Math.hypot(t[0]-h[0],t[1]-h[1])||1), a=Math.max(3,cell*0.22);
      ctx.strokeStyle='#4a423a'; ctx.fillStyle='#4a423a'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(t[0],t[1]); ctx.lineTo(h[0],h[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(h[0],h[1]); ctx.lineTo(h[0]+ux*a-uy*a*0.55,h[1]+uy*a+ux*a*0.55);
      ctx.lineTo(h[0]+ux*a+uy*a*0.55,h[1]+uy*a-ux*a*0.55); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
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
  // berms and swales over the ground they shape, as a grading plan draws them
  drawPlanContours(ctx,X,Y);
}
// the site OVER the planting: pergolas, footprints, houses, and the deeded lot line
function drawPlanStructures(ctx,g){
  const {cell,X,Y}=g;
  /* Pergolas, the way an overhead structure is drawn on a plan: the roof's
     edge DASHED (it is above the planting, not on the ground), the rafters as
     fine lines across it, the beams heavier, the posts solid -- read off the
     same pergolaFrameAt the garden draws, so the sheet puts the posts where the
     garden does. Drawn over the planting and light enough to read it through. */
  for (const reg of pergolaRegions().list){
    const m=pergolaMaterial(reg.mat), ink=mixHex(m.post,'#3b3226',0.45);
    ctx.save();
    ctx.strokeStyle=ink; ctx.lineCap='butt';
    const pt=(x,y,b,r,a)=>[X(x)+cell/2+(a?r:b)*cell, Y(y)+cell/2+(a?b:r)*cell];
    const line=(p,q)=>{ ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); };
    for (const [x,y] of reg.tiles){
      const fr=pergolaFrameAt(x,y), a=fr.a;
      ctx.globalAlpha=0.5; ctx.lineWidth=Math.max(0.6,cell*0.05);
      line(pt(x,y,0,-0.5,a),pt(x,y,0,0.5,a));                      // the rafter
      ctx.globalAlpha=0.8; ctx.lineWidth=Math.max(1,cell*0.09);
      for (const [r] of fr.beams) line(pt(x,y,-0.5,r,a),pt(x,y,0.5,r,a));
      ctx.globalAlpha=1; ctx.fillStyle=ink;
      const ps=Math.max(2.5,cell*pergolaSpec(reg.mat).postIn/TILE_IN);
      for (const [b,r] of fr.posts){ const p=pt(x,y,b,r,a); ctx.fillRect(p[0]-ps/2,p[1]-ps/2,ps,ps); }
    }
    ctx.globalAlpha=1; ctx.lineWidth=1.2; ctx.setLineDash([5,3]);
    for (const loop of traceOutlines(new Set(reg.tiles.map(([x,y])=>`${x},${y}`)))){
      ctx.beginPath();
      loop.forEach(([lx,ly],i)=>{ const px=X(lx), py=Y(ly); i?ctx.lineTo(px,py):ctx.moveTo(px,py); });
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  // climbing frames, over the climber planted on them (drawPlanSupport)
  for (const k in game.supports||{}){
    const s=game.supports[k]; if (!s||s.removed) continue;
    const [x,y]=k.split(',').map(Number);
    drawPlanSupport(ctx,X(x),Y(y),cell,s);
  }
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
}
/* The non-planting key rows that sit under the schedule.  They take the y
   they START at rather than the schedule's row count: the rows above them are
   no longer a fixed height, and the count-and-multiply form is what produced
   the `fixtureRows is not defined` crash when this block was first split out. */
function drawPlanKeyRows(ctx,g,y0,site){
  const {padL}=g;
  const {lightsLive,bouldersLive,treesLive}=site;
  let row=0;
  if (lightsLive.length){
    const cy2=y0+row++*PLAN_ROW_H, cx2=padL;
    ctx.fillStyle=mixHex(lightTone('warm').col,'#f7f3e8',0.22);
    ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.arc(cx2+4.5,cy2-3,4,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    ctx.fillText(`LIGHT - lighting fixture (${lightsLive.length})`, cx2+14, cy2);
  }
  if (bouldersLive.length){
    const cy2=y0+row++*PLAN_ROW_H, cx2=padL;
    ctx.fillStyle=mixHex('#7f8178','#f7f3e8',0.2);
    ctx.strokeStyle='#5c5445'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.ellipse(cx2+5,cy2-3,5,3.2,0,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#2c241c'; ctx.font='10px IBM Plex Sans';
    ctx.fillText(`BOULDER - stone feature (${bouldersLive.length})`, cx2+14, cy2);
  }
  if (site.softCount){
    const cy2=y0+row++*PLAN_ROW_H, cx2=padL;
    ctx.save(); ctx.strokeStyle='rgba(122,90,44,0.75)'; ctx.lineWidth=0.9;
    for (const r of [3,6,9]){ ctx.beginPath(); ctx.ellipse(cx2+11,cy2-3.5,r*1.2,r*0.5,0,0,7); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle='#6e5f48'; ctx.font='10px IBM Plex Sans'; ctx.textAlign='left';
    ctx.fillText(`Berms and swales in contours every ${fmtLengthIn(ELEV_RISER_IN)}; the height is at the crown.`, cx2+28, cy2);
  }
  if (site.existingCount){
    const cy2=y0+row++*PLAN_ROW_H, cx2=padL;
    ctx.save(); ctx.beginPath(); ctx.rect(cx2,cy2-8,22,9); ctx.clip();
    ctx.strokeStyle='rgba(70,62,52,0.6)'; ctx.lineWidth=0.7; ctx.beginPath();
    for (let d=-10;d<26;d+=4){ ctx.moveTo(cx2+d,cy2+1); ctx.lineTo(cx2+d+9,cy2-8); } ctx.stroke(); ctx.restore();
    ctx.strokeStyle='#7d7466'; ctx.lineWidth=0.8; ctx.strokeRect(cx2,cy2-8,22,9);
    ctx.fillStyle='#6e5f48'; ctx.font='10px IBM Plex Sans'; ctx.textAlign='left';
    ctx.fillText('Hatched = existing, to remain; not on the plant schedule or the orders.', cx2+28, cy2);
  }
  if (treesLive.length){
    const cy2=y0+row++*PLAN_ROW_H, cx2=padL;
    ctx.save();
    ctx.strokeStyle='#6e5f48'; ctx.lineWidth=1.1; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(cx2,cy2-3); ctx.lineTo(cx2+22,cy2-3); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='#6e5f48'; ctx.font='10px IBM Plex Sans'; ctx.textAlign='left';
    ctx.fillText('Dashed = mature crown in Established preview; Today shows current reach.', cx2+28, cy2);
  }
}
function drawPlanScaleBar(ctx,g){
  const {cell,padL,padT,W2}=g;
  /* Scale bar. 10 ft imperial, 3 m metric — a round number in the reader's
     own units, because a bar labelled "3.05 m" is a bar nobody trusts. The
     pixels-per-foot came from a hardcoded 1.5 (feet per tile); it reads TILE_IN
     now, so the bar cannot drift from the drawing it measures. */
  const barFt=metricUnits()?3/M_PER_FT:10;
  const ftPx=cell/(TILE_IN/12), barPx=ftPx*barFt, bx2=W2-padL-barPx;
  const by2=padT+GH*cell+PLAN_SCALEBAR_GAP;   // with its drawing, not at the foot
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(bx2,by2); ctx.lineTo(bx2+barPx,by2); ctx.stroke();
  for (const f of [0,0.5,1]){ ctx.beginPath();
    ctx.moveTo(bx2+barPx*f,by2-4); ctx.lineTo(bx2+barPx*f,by2+4); ctx.stroke(); }
  ctx.font='9px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillStyle='#2c241c';
  ctx.fillText(fmtFeet(barFt), bx2+barPx/2, by2-8);
}

/* ---------- the plant schedule ----------
   Code, botanical name, common name, quantity and spacing o.c. is the
   convention the naturalistic and the landscape-architecture traditions agree
   on (docs/plan-sheet.md); the old three-column legend gave a common name
   truncated at 26 characters - exactly where a cultivar epithet lives - and a
   count of game TILES.
   ONE renderer, because the table is drawn in two places now: under the
   drawing on a small garden's single sheet, and filling its own page on a set
   where it would otherwise eat the drawing's scale. */
function drawPlanSchedule(ctx,g,y0,sched,shared){
  const {padL}=g;
  const {wQty,wSpace,xCode,xLatin,xCommon,xQty,xSpace,tblW}=sched.col;
  if (!sched.rows.length) return;   // an empty garden gets an empty sheet
  ctx.textAlign='left';
  ctx.font='600 10px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText('PLANT SCHEDULE', padL, y0-8);
  ctx.font='600 9px IBM Plex Sans';
  ctx.fillText('KEY',xCode,y0);
  ctx.fillText('BOTANICAL NAME',xLatin,y0);
  ctx.fillText('COMMON NAME',xCommon,y0);
  ctx.textAlign='right'; ctx.fillText('QTY',xQty+wQty,y0); ctx.textAlign='left';
  ctx.fillText('SPACING',xSpace,y0);
  ctx.strokeStyle='rgba(120,108,86,0.45)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(xCode,y0+4); ctx.lineTo(padL+tblW,y0+4); ctx.stroke();
  /* Rows are variable height, because a long botanical name WRAPS rather than
     losing its cultivar epithet to an ellipsis.  The swatch, code, quantity and
     spacing all sit on the row's first line and a second line of name hangs
     below them, which is how a schedule is set. */
  let cy=y0;
  sched.rows.forEach(row=>{
    const id=row.id, s=id.split('|')[0], v=id.split('|')[1]||null, def=plantDef(s,v);
    cy+=PLAN_ROW_H;
    const swatch=planTintOf(shared.tints,s,v,shared.bulbIds.has(id)?'zone':null);
    ctx.fillStyle=swatch.fill;
    ctx.fillRect(xCode,cy-7,9,9);
    ctx.strokeStyle=swatch.edge; ctx.lineWidth=1;
    ctx.strokeRect(xCode,cy-7,9,9);
    ctx.textAlign='left'; ctx.fillStyle='#2c241c'; ctx.font='600 10px IBM Plex Sans';
    ctx.fillText(shared.codes[id],xCode+13,cy);
    ctx.font='10px IBM Plex Sans';
    row.latin.forEach((ln,j)=>{ ctx.fillStyle='#2c241c';
      ctx.fillText(ln,xLatin,cy+j*PLAN_ROW_LINE); });
    row.common.forEach((ln,j)=>{ ctx.fillStyle='#6e5f48';
      ctx.fillText(ln,xCommon,cy+j*PLAN_ROW_LINE); });
    ctx.fillStyle='#2c241c'; ctx.textAlign='right';
    ctx.fillText(String(shared.qty[id]||0),xQty+wQty,cy);
    ctx.textAlign='left'; ctx.fillStyle='#6e5f48';
    ctx.fillText(planFitText(ctx,`${plantMeasure(def.space)} o.c.`,wSpace),xSpace,cy);
    cy+=row.h-PLAN_ROW_H;
  });
}
function drawPlanKeyBand(ctx,g,y0,band,shared){
  const {padL}=g, {colW,gap,rows,ids,tblW}=band;
  if (!ids.length) return;
  ctx.textAlign='left';
  ctx.font='600 10px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText('KEY', padL, y0-8);
  ctx.strokeStyle='rgba(120,108,86,0.45)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(padL,y0+4); ctx.lineTo(padL+tblW,y0+4); ctx.stroke();
  ids.forEach((id,i)=>{
    const col=Math.floor(i/rows), row=i%rows;      // each column filled downward
    const x=padL+col*(colW+gap), y=y0+(row+1)*PLAN_ROW_H;
    const s=id.split('|')[0], v=id.split('|')[1]||null;
    const swatch=planTintOf(shared.tints,s,v,shared.bulbIds.has(id)?'zone':null);
    ctx.fillStyle=swatch.fill; ctx.fillRect(x,y-7,9,9);
    ctx.strokeStyle=swatch.edge; ctx.lineWidth=1; ctx.strokeRect(x,y-7,9,9);
    ctx.fillStyle='#2c241c'; ctx.font='600 10px IBM Plex Sans';
    ctx.fillText(shared.codes[id],x+13,y);
    ctx.font='10px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
    ctx.fillText(planFitText(ctx,planCommonName(s,v),colW-46),x+42,y);
  });
  ctx.font='9px IBM Plex Sans'; ctx.fillStyle='#6e5f48';
  ctx.fillText('Botanical names, quantities and spacing: see the plant schedule sheet.',
    padL, y0+(rows+1)*PLAN_ROW_H+4);
}
/* A one-sheet garden still says "Design plan" - it is not a set, and naming it
   "Sheet 1 of 1" would be drawing-office cosplay. */
function planSheetTitle(shared,sheet,sheetIndex){
  const setSize=shared.sheets.length;
  return setSize>1?`${sheet.name} · Sheet ${sheetIndex+1} of ${setSize}`:'Design plan';
}
function planSizeCanvas(pc,g){
  pc.width=g.W2*2; pc.height=g.H2*2; pc.style.aspectRatio=`${g.W2}/${g.H2}`;
  /* The sheet's real width, for print only: PLAN_DPI units to the inch, so a
     rule laid on the printed page agrees with the stated scale. On screen the
     canvas stays width:100% and responsive. (Guarded because the test
     sandbox's element stubs carry a plain object for `style`.) */
  if (pc.style && typeof pc.style.setProperty==='function')
    pc.style.setProperty('--plan-in', (g.W2/PLAN_DPI).toFixed(3)+'in');
  const ctx=pc.getContext('2d');
  ctx.setTransform(2,0,0,2,0,0);
  return ctx;
}
/* The schedule on its own page: the same paper as the rest of the set, because
   a set is one size, and no north arrow, because a table has no orientation.
   This is what gives the drawing its page back - see PLAN_SCHEDULE_MAX_ROWS. */
function drawPlanScheduleSheet(pc,sheet,sheetIndex,shared){
  const g=shared.g, ctx=planSizeCanvas(pc,g);
  drawPlanPaper(ctx,g,planSheetTitle(shared,sheet,sheetIndex));
  const sched=planScheduleLayout(ctx,g,planSheetIds(shared,sheet));
  drawPlanSchedule(ctx,g,PLAN_SCHED_TOP,sched,shared);
  drawPlanKeyRows(ctx,g,PLAN_SCHED_TOP+sched.h,shared.site);
}
function drawPlanSheet(pc,sheet,sheetIndex,shared){
  const onBulbSheet=sheet.layer==='bulbs';
  const shrubComps=shrubPlanComponents().sort((a,b2)=>b2.tiles.length-a.tiles.length);
  // the perennial planting: the SUBJECT of the planting sheet, the GHOST of
  // the bulb sheet — you have to see where the bulbs sit relative to it
  const plantComps=planComponents(game.plants).filter(c=>!isShrubPlanDef(plantDef(c.s,c.v)));
  const plantHerb=plantComps.filter(c=>isPlanStandDef(plantDef(c.s,c.v)));
  const subjectComps=onBulbSheet?planComponents(game.bulbs):plantHerb;
  const ghostComps=onBulbSheet?plantHerb:[];
  /* Trees are excluded from stand merging and keep a label per component over
     the trunk: a tree is a specimen placed individually, not a population.
     On the bulb sheet they still DRAW — you plant bulbs around a tree — but
     unlabelled, like every other piece of context there. */
  const treeComps=onBulbSheet?[]:plantComps.filter(c=>isTreeDef(plantDef(c.s,c.v)));
  const stands=planStands(subjectComps, onBulbSheet?BULB_STAND_GAP:PLAN_STAND_GAP);
  const site=shared.site, codes=shared.codes, tints=shared.tints;
  const {lightsLive,bouldersLive,treesLive}=site;
  // each sheet schedules the planting it draws, in the set's shared code order
  const ids=planSheetIds(shared,sheet);
  const g=shared.g;                 // the SET's geometry: see planSetGeometry
  const {cell,padL,padT,W2,H2,X,Y}=g;
  const ctx=planSizeCanvas(pc,g);   // resizing resets the context, so size first
  /* Under the drawing goes either the whole schedule or, when it has moved to
     its own page, the compact key that stands in for it (planScheduleSplits). */
  const below=shared.split?planKeyBandLayout(g,ids):planScheduleLayout(ctx,g,ids);
  drawPlanPaper(ctx,g,planSheetTitle(shared,sheet,sheetIndex));
  drawPlanNorth(ctx,g);
  drawPlanGround(ctx,g,site);
  // drifts as smoothed blobs (largest first so small ones read on top)
  const smoothLoop=(loop)=>planBlobPath(ctx,loop,X,Y);
  /* The ghost: the perennial planting seen through, so the bulb sheet can say
     WHERE its bulbs sit without asking anyone to read a second planting.
     Fill only — no stroke, no label, no layer weight. */
  ghostComps.forEach(c=>{
    const gt=planTintOf(tints,c.s,c.v);
    traceOutlines(new Set(c.tiles)).forEach(loop=>{
      smoothLoop(loop);
      ctx.fillStyle=planGhostFill(gt); ctx.fill();
    });
  });
  /* The subject. On the planting sheet that is drifts under the layer
     weights; on the bulb sheet it is zones, because a bulb sheet states a
     density over an area rather than a plant on a tile (see drawBulbZones). */
  if (onBulbSheet) drawBulbZones(ctx,g,stands,tints);
  else subjectComps.slice().sort((a,b2)=>{
    const la=PLAN_LAYER_STYLE[planLayerOf(a.s)].order;
    const lb=PLAN_LAYER_STYLE[planLayerOf(b2.s)].order;
    return la!==lb ? la-lb : b2.tiles.length-a.tiles.length;
  }).forEach(c=>{
    const st=PLAN_LAYER_STYLE[planLayerOf(c.s)], t=planTintOf(tints,c.s,c.v);
    const loops=traceOutlines(new Set(c.tiles));
    loops.forEach(loop=>{
      smoothLoop(loop);
      ctx.fillStyle=t.fill; ctx.fill();
      if (st.lw){ ctx.strokeStyle=t.edge; ctx.lineWidth=st.lw; ctx.stroke(); }
    });
  });
  const shrubLabelBoxes=[];
  shrubComps.forEach(c=>drawShrubPlan(ctx,c,codes,cell,X,Y,!onBulbSheet,shrubLabelBoxes,tints));
  // trees: effective canopy circles, clipped to the plot, plus trunk dot
  treesLive.forEach(k=>{ const p=game.plants[k];
    const [x,y]=k.split(',').map(Number);
    drawTreePlan(ctx,p,x,y,cell,X,Y,tints);
  });
  drawPlanStructures(ctx,g);
  drawPlanExisting(ctx,g);            // over every piece it marks, as a survey hatch is
  /* One label per STAND, white halo for legibility.  The size range is wider
     than the old per-component 8-13px — which was five pixels across a whole
     sheet, a uniform texture rather than a hierarchy — and it is affordable
     precisely because there are now far fewer labels to place. */
  ctx.textAlign='center';
  /* Placed, not just drawn (see planLabelPlacer).  The shrub labels went down
     in the drawing pass and are seeded in as obstacles, so a stand label moves
     out of a shrub's way rather than landing on its code.  Stands come in
     size order, so the biggest planting keeps the spot it wants and the small
     ones do the moving. */
  const place=planLabelPlacer(shrubLabelBoxes);
  const bounds={x0:X(0)-cell, x1:X(GW)+cell, y0:padT-18, y1:Y(GH)+cell*0.6};
  const queued=[];
  stands.forEach(st=>{
    const def=plantDef(st.s,st.v), id=st.s+'|'+(st.v||'');
    const lx=X(st.at[0]+0.5), ly=Y(st.at[1]+0.5)+3;
    const fs=Math.max(9,Math.min(15,6+Math.sqrt(st.n)*1.6));
    const qty=plantsForStand(def,st.n);
    const ink=PLAN_LAYER_STYLE[planLayerOf(st.s)].label;
    const at=place.place(lx,ly,planLabelBox(ctx,codes[id],qty,fs),bounds);
    queued.push({kind:'stand',code:codes[id],qty,fs,ink,at});
  });
  treeComps.forEach(c=>{
    const lt=c.tiles[0].split(',').map(Number);
    const lx=X(lt[0])+cell/2, ly=Y(lt[1])-cell*0.4;
    const fs=Math.max(9,Math.min(13,5+Math.sqrt(c.tiles.length)*2));
    const code=codes[c.s+'|'+(c.v||'')];
    const at=place.place(lx,ly,planLabelBox(ctx,code,0,fs),bounds);
    queued.push({kind:'tree',code,qty:0,fs,ink:'#2c241c',at});
  });
  /* A spot height per terrace or sunken patio, after the planting so a plant
     code keeps the place it wants and the height moves out of its way. */
  planTerraceSpots().forEach(sp=>{
    const text=planTerraceSpotText(sp.h), fs=9;
    const at=place.place(X(sp.at[0]+0.5),Y(sp.at[1]+0.5)+3,planLabelBox(ctx,text,0,fs),bounds);
    queued.push({kind:'tree',code:text,qty:0,fs,ink:sp.h>0?'#7a5a2c':'#3f6478',at});
  });
  // one per berm or swale, at its crown
  softComponents().forEach(c=>{
    const v=c.swale?c.down:c.up; if (!v) return;
    const text=planTerraceSpotText(v), fs=9;
    const at=place.place(X(c.crown[0]+0.5),Y(c.crown[1]+0.5)+3,planLabelBox(ctx,text,0,fs),bounds);
    queued.push({kind:'tree',code:text,qty:0,fs,ink:v>0?'#7a5a2c':'#3f6478',at});
  });
  // UP at the foot of every flight, where its arrow starts
  planStepFlights().forEach(f=>{
    const fs=9, [dx,dy]=f.dir;
    // on the ground at its foot, or on its bottom tread where the foot is the plot's edge
    let px=f.lo[0]+dx*0.85, py=f.lo[1]+dy*0.85;
    if (px<0.3 || py<0.3 || px>GW-0.3 || py>GH-0.3){ px=f.lo[0]; py=f.lo[1]; }
    const at=place.place(X(px),Y(py)+3,planLabelBox(ctx,'UP',0,fs),bounds);
    queued.push({kind:'tree',code:'UP',qty:0,fs,ink:'#4a423a',at});
  });
  // every leader first, so no label's halo is cut by a line drawn after it
  queued.forEach(q=>{ if (q.at.leader) drawPlanLeader(ctx,[q.at.x,q.at.y],q.at.leader,q.ink); });
  queued.forEach(q=>{
    if (q.kind==='tree') drawPlanCode(ctx,q.code,q.at.x,q.at.y,q.fs,q.ink);
    else drawStandLabel(ctx,q.code,q.qty,q.at.x,q.at.y,q.fs,q.ink);
  });
  /* Plant schedule + scale bar.  Code, botanical name, common name, quantity
     and spacing o.c. is the convention the naturalistic and the
     landscape-architecture traditions agree on (docs/plan-sheet.md); the old
     three-column legend gave a common name truncated at 26 chars — exactly
     where a cultivar epithet lives — and a count of game TILES. */
  const ly2=padT+GH*cell+PLAN_SCHEDULE_GAP;
  if (shared.split) drawPlanKeyBand(ctx,g,ly2,below,shared);
  else drawPlanSchedule(ctx,g,ly2,below,shared);
  drawPlanKeyRows(ctx,g,ly2+below.h,site);
  drawPlanScaleBar(ctx,g);
}
function openPlan(){ funnel(FUNNEL_EVENTS.planOpened); buildPlanMap(); openOverlay('planScreen','#btnPlanPng'); }
/* Downloads the sheet you are LOOKING AT, named for it.  Exporting the whole
   set at once was the obvious reading of "two sheets" and is worse in a
   browser: two programmatic downloads from one gesture raises Chrome's
   "Download multiple files?" prompt, which is a worse experience than one tap
   on a toggle that is right there.  Print still gives the set as two pages. */
function downloadPlan(){
  funnel(FUNNEL_EVENTS.planDownloaded);
  const sheet=activePlanSheet(), pc=$(planSheetCanvasId(sheet.id));
  if (!pc || !pc.toBlob) return;
  pc.toBlob(b2=>{
    if (!b2) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b2);
    const stem=(game.worldName||'garden').replace(/\s+/g,'-').toLowerCase();
    const part={bulbs:'bulb-plan', schedule:'plant-schedule'}[sheet.id]||'plan';
    a.download=`${stem}-${part}.png`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
}
