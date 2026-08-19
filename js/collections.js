'use strict';
/* ---------- device-local plant collections ----------
   Favorites and named palettes are intentionally separate from a garden's
   saved design filters. They store exact species/cultivar references, but
   never require those references to be present in today's catalog: a retired
   plant must remain visible in a saved palette so the user can decide what to
   do with it rather than losing it silently. */

const PLANT_COLLECTIONS_KEY='hortus:plant-collections:v1';
const PLANT_COLLECTIONS_VERSION=1;
let _plantCollections={version:PLANT_COLLECTIONS_VERSION,favorites:[],palettes:[]};
let _plantCollectionsLoaded=false;
let _plantCollectionsLoading=null;
let _plantCollectionsRevision=0;
let _plantPaletteSerial=0;

function emptyPlantCollections(){
  return {version:PLANT_COLLECTIONS_VERSION,favorites:[],palettes:[]};
}
function plantCollectionText(value){ return typeof value==='string' ? value.trim() : ''; }
function plantCollectionTime(value,fallback){
  const n=Number(value);
  return Number.isFinite(n) && n>0 ? Math.round(n) : fallback;
}
function plantCollectionName(value){
  const name=plantCollectionText(value).replace(/\s+/g,' ');
  return name||'Untitled palette';
}

/* A ref remains valid as data even when PLANTS[ref.s] or its cultivar has
   since disappeared. Resolution/eligibility is the UI's job; collections are
   just durable references. Accepting the pipe form also makes imported data
   and debugging less brittle while all output stays in the {s,v} contract. */
function normalizePlantRef(ref){
  let s='', v='';
  if (typeof ref==='string'){
    const bar=ref.indexOf('|');
    s=bar<0 ? ref : ref.slice(0,bar);
    v=bar<0 ? '' : ref.slice(bar+1);
  } else if (ref && typeof ref==='object'){
    s=ref.s==null ? '' : String(ref.s);
    v=ref.v==null ? '' : String(ref.v);
  }
  s=s.trim(); v=v.trim();
  if (s){ const canonical=canonicalPlantRef(s,v); s=canonical.s; v=canonical.v||''; }
  return s ? {s,v:v||null} : null;
}
function plantRefId(ref){
  const normalized=normalizePlantRef(ref);
  return normalized ? normalized.s+'|'+(normalized.v||'') : null;
}
function copyPlantRef(ref){ return {s:ref.s,v:ref.v||null}; }
function normalizePlantRefs(refs){
  const out=[], seen=new Set();
  if (!Array.isArray(refs)) return out;
  refs.forEach(ref=>{
    const normalized=normalizePlantRef(ref), id=plantRefId(normalized);
    if (!normalized || seen.has(id)) return;
    seen.add(id); out.push(normalized);
  });
  return out;
}
function makePlantPaletteId(taken){
  let id;
  do {
    _plantPaletteSerial=(_plantPaletteSerial+1)%1679616;
    id='palette-'+Date.now().toString(36)+'-'+_plantPaletteSerial.toString(36);
  } while (taken && taken.has(id));
  return id;
}

function normalizePlantCollections(raw){
  const source=raw && typeof raw==='object' ? raw : {};
  const now=Date.now(), seenIds=new Set();
  const sourcePalettes=Array.isArray(source.palettes) ? source.palettes : [];
  const palettes=[];
  sourcePalettes.forEach((palette,index)=>{
    if (!palette || typeof palette!=='object') return;
    let id=plantCollectionText(palette.id);
    if (!id || seenIds.has(id)) id=makePlantPaletteId(seenIds);
    seenIds.add(id);
    const createdAt=plantCollectionTime(palette.createdAt,now);
    const updatedAt=Math.max(createdAt,plantCollectionTime(palette.updatedAt,createdAt));
    palettes.push({
      id,
      name:plantCollectionName(palette.name || (index===0 && sourcePalettes.length===1 ? 'My palette' : '')),
      items:normalizePlantRefs(palette.items),
      createdAt,
      updatedAt
    });
  });
  return {
    version:PLANT_COLLECTIONS_VERSION,
    favorites:normalizePlantRefs(source.favorites),
    palettes
  };
}
function copyPlantPalette(palette){
  if (!palette) return null;
  return {
    id:palette.id,
    name:palette.name,
    items:palette.items.map(copyPlantRef),
    createdAt:palette.createdAt,
    updatedAt:palette.updatedAt
  };
}
function plantCollectionsData(){
  return {
    version:PLANT_COLLECTIONS_VERSION,
    favorites:_plantCollections.favorites.map(copyPlantRef),
    palettes:_plantCollections.palettes.map(copyPlantPalette)
  };
}
function persistPlantCollections(){
  const snapshot=plantCollectionsData();
  try {
    const pending=sSet(PLANT_COLLECTIONS_KEY,snapshot);
    // sSet handles normal localStorage failures itself. This extra catch keeps
    // an alternate async storage adapter from producing an unhandled rejection;
    // the in-memory collection remains usable either way.
    if (pending && typeof pending.catch==='function') pending.catch(()=>{});
  } catch(e){}
  return snapshot;
}

async function loadPlantCollections(){
  if (_plantCollectionsLoaded) return plantCollectionsData();
  if (_plantCollectionsLoading) return _plantCollectionsLoading;
  const revisionAtStart=_plantCollectionsRevision;
  _plantCollectionsLoading=(async()=>{
    let raw=null;
    try { raw=await sGet(PLANT_COLLECTIONS_KEY); } catch(e){}
    const loaded=normalizePlantCollections(raw);
    // A UI action can arrive before an async storage adapter has answered.
    // Keep that in-memory change rather than replacing it with stale storage.
    if (_plantCollectionsRevision===revisionAtStart) _plantCollections=loaded;
    _plantCollectionsLoaded=true;
    _plantCollectionsLoading=null;
    if (_plantCollectionsRevision!==revisionAtStart) persistPlantCollections();
    return plantCollectionsData();
  })();
  return _plantCollectionsLoading;
}

function favoriteRefs(){ return _plantCollections.favorites.map(copyPlantRef); }
function isFavorite(ref){
  const id=plantRefId(ref);
  return !!id && _plantCollections.favorites.some(item=>plantRefId(item)===id);
}
function toggleFavorite(ref){
  const normalized=normalizePlantRef(ref), id=plantRefId(normalized);
  if (!normalized || !id) return null;
  const index=_plantCollections.favorites.findIndex(item=>plantRefId(item)===id);
  let favorite;
  if (index>=0){ _plantCollections.favorites.splice(index,1); favorite=false; }
  else { _plantCollections.favorites.push(normalized); favorite=true; }
  _plantCollectionsRevision++;
  persistPlantCollections();
  return favorite;
}

function paletteIndexById(id){
  const target=plantCollectionText(id);
  return target ? _plantCollections.palettes.findIndex(palette=>palette.id===target) : -1;
}
function paletteById(id){
  const index=paletteIndexById(id);
  return index<0 ? null : copyPlantPalette(_plantCollections.palettes[index]);
}
function paletteRefs(id){
  const palette=paletteById(id);
  return palette ? palette.items : [];
}
function createPlantPalette(name,refs){
  const taken=new Set(_plantCollections.palettes.map(palette=>palette.id));
  const now=Date.now();
  const palette={
    id:makePlantPaletteId(taken),
    name:plantCollectionName(name),
    items:normalizePlantRefs(refs),
    createdAt:now,
    updatedAt:now
  };
  _plantCollections.palettes.push(palette);
  _plantCollectionsRevision++;
  persistPlantCollections();
  return copyPlantPalette(palette);
}
function renamePlantPalette(id,name){
  const index=paletteIndexById(id);
  if (index<0) return null;
  const palette=_plantCollections.palettes[index], nextName=plantCollectionName(name);
  if (palette.name!==nextName){
    palette.name=nextName; palette.updatedAt=Date.now();
    _plantCollectionsRevision++;
    persistPlantCollections();
  }
  return copyPlantPalette(palette);
}
function deletePlantPalette(id){
  const index=paletteIndexById(id);
  if (index<0) return false;
  _plantCollections.palettes.splice(index,1);
  _plantCollectionsRevision++;
  persistPlantCollections();
  return true;
}
function addPaletteRef(id,ref){
  const index=paletteIndexById(id), normalized=normalizePlantRef(ref), refId=plantRefId(normalized);
  if (index<0 || !normalized || !refId) return false;
  const palette=_plantCollections.palettes[index];
  if (palette.items.some(item=>plantRefId(item)===refId)) return false;
  palette.items.push(normalized); palette.updatedAt=Date.now();
  _plantCollectionsRevision++;
  persistPlantCollections();
  return true;
}
function removePaletteRef(id,ref){
  const index=paletteIndexById(id), refId=plantRefId(ref);
  if (index<0 || !refId) return false;
  const palette=_plantCollections.palettes[index];
  const itemIndex=palette.items.findIndex(item=>plantRefId(item)===refId);
  if (itemIndex<0) return false;
  palette.items.splice(itemIndex,1); palette.updatedAt=Date.now();
  _plantCollectionsRevision++;
  persistPlantCollections();
  return true;
}
