'use strict';
/* ---------- storage: save / load / multiplayer ---------- */
async function sGet(key,shared){ try{ const r=localStorage.getItem(key);
  return r?JSON.parse(r):null; }catch(e){ return null; } }
async function sSet(key,val,shared){ try{ localStorage.setItem(key,JSON.stringify(val)); }
  catch(e){ console.error('storage',e); } }

async function ensurePlayerId(){
  if (!hasStorage){ game.playerId='p'+Math.random().toString(36).slice(2,8); return; }
  let id=await sGet('hortus:pid');
  if (!id){ id='p'+Math.random().toString(36).slice(2,10); await sSet('hortus:pid',id); }
  game.playerId=id;
}
/* solo worlds live in named slots: 'hortus:worlds' is the index
   [{id,name,ts,gw,gh}], each save under 'hortus:world:<id>'. The old
   single 'hortus:solo' key migrates into the first slot once. */
async function worldsIndex(){ return (await sGet('hortus:worlds'))||[]; }
async function migrateLegacyWorld(){
  let idx=await worldsIndex();
  if (idx.length) return idx;
  const legacy=await sGet('hortus:solo');
  if (!legacy) return idx;
  const entry={id:'w'+Date.now().toString(36), name:'My garden', ts:Date.now(),
    gw:legacy.gw||legacy.grid||31, gh:legacy.gh||legacy.grid||31};
  await sSet('hortus:world:'+entry.id, legacy);
  await sSet('hortus:worlds',[entry]);
  try{ localStorage.removeItem('hortus:solo'); }catch(e){}
  return [entry];
}
async function saveSolo(silent){
  if (game.visiting) return;                          // Visit Gardens is read-only — never overwrite the garden
  if (!hasStorage){ toast('No save storage here — garden lives this session only.'); return; }
  if (!game.worldId) game.worldId='w'+Date.now().toString(36);
  const blob={wv:1,name:game.worldName,
    mode:game.gameMode,design:game.design,
    gw:GW,gh:GH,rot:game.rot,freePlanting:game.freePlanting,previewMode:game.previewMode,
    edgeStyle:game.edgeStyle,
    pathColor:game.pathColor,bedStyle:game.bedStyle,waterStyle:game.waterStyle,
    fenceDraft:game.fenceDraft,lightDraft:game.lightDraft,firepitDraft:game.firepitDraft,
    startTs:saveStartTs(),elapsedMs:elapsedGameMs(),savedAt:Date.now(),dayOffset:game.dayOffset,char:game.char};
  for (const L of GAME_LAYERS) blob[L.k]=game[L.k];   // plants/bulbs/terrain/elevation/fences/lights/firepits/houses
  await sSet('hortus:world:'+game.worldId,blob);
  const idx=(await worldsIndex()).filter(w=>w.id!==game.worldId);
  idx.push({id:game.worldId, name:game.worldName||'My garden', ts:Date.now(), gw:GW, gh:GH, mode:game.gameMode});
  await sSet('hortus:worlds',idx);
  if (!silent) toast('Garden saved.');
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
  const shift = (s.gw||s.grid) ? 0 : SPAWNX-6;
  game.gameMode = s.mode==='design' ? 'design' : 'story';
  game.design = s.design || null;
  game.previewMode = s.previewMode || (game.gameMode==='design' ? 'established' : 'today');
  game.edgeStyle = (s.edgeStyle==='formal'||s.edgeStyle==='organic') ? s.edgeStyle : edgeStyleFromType(s.design&&s.design.type);
  for (const L of GAME_MAPS) game[L.k]=compactSoloMap(shiftKeys(s[L.k]||{},shift));   // keyed layers, without solo tombstones
  // houses: new saves store an array; migrate old single-house saves, and
  // give story gardens a starter house when the save predates houses entirely
  game.houses = s.houses ? s.houses
    : (s.house ? [s.house] : (game.gameMode==='design' ? [] : [defaultHouse()]));
  if (shift) game.houses.forEach(h=>{ h.x+=shift; h.y+=shift; });
  markGroundChanged({terrain:true});
  game.houseDraft = draftFromHouses();
  game.pathColor=pathColorId(s.pathColor||game.pathColor);
  game.bedStyle=bedStyleId(s.bedStyle||'soil');
  game.waterStyle=waterStyleId(s.waterStyle||game.waterStyle);
  game.freePlanting=!!s.freePlanting;
  game.fenceDraft=normalizeFenceDraft(s.fenceDraft);
  game.lightDraft=normalizeLightDraft(s.lightDraft);
  game.firepitDraft=normalizeFirepitDraft(s.firepitDraft);
  game.rot=s.rot||0;
  const migratedElapsed = s.elapsedMs!==undefined
    ? Math.max(0,+s.elapsedMs||0)
    : Math.max(0,((s.savedAt||Date.now())-(s.startTs||Date.now())));
  game.elapsedMs=migratedElapsed;
  game.startTs=Date.now();
  game.clockSuspended=false; game.pausedAt=0;
  game.dayOffset=s.dayOffset||0; if (s.char) game.char=s.char;
  game.worldName=s.name||'My garden';
  // saves from before the walkway became terrain get it seeded once,
  // so the old built-in path is finally shovel-able
  if (!s.wv) seedWalkway();
  return true;
}
async function saveChar(){ if (hasStorage) await sSet('hortus:char',game.char); }

/* multiplayer: shared keys w:CODE:meta / :plants / :players (visible to all artifact users with the code) */
function wkey(part){ return `hortus:w:${game.code}:${part}`; }
let syncTimer=null, presenceThrottle=0;
async function hostWorld(){
  game.code=Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join('');
  game.startTs=Date.now(); game.elapsedMs=0; game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  game.plants={}; game.bulbs={}; game.terrain={}; game.elevation={}; game.fences={}; game.lights={}; game.firepits={}; game.freePlanting=false;
  game.pathColor='warm'; game.bedStyle='soil'; game.waterStyle='pond'; game.fenceDraft={style:'black',height:4,gate:false}; game.lightDraft={type:'path',tone:'warm'}; game.firepitDraft={shape:'round',size:'round36'};
  setWorldSize(31,31); game.houses=[defaultHouse()]; markGroundChanged({terrain:true}); game.houseDraft=draftFromHouses(); game.rot=0; game.houseT=Date.now();
  seedWalkway();
  await sSet(wkey('meta'),{startTs:game.startTs,elapsedMs:game.elapsedMs,gw:GW,gh:GH},true);
  await sSet(wkey('plants'),{},true);
  await sSet(wkey('bulbs'),{},true);
  await sSet(wkey('terrain'),game.terrain,true);
  await sSet(wkey('elevation'),game.elevation,true);
  await sSet(wkey('fences'),game.fences,true);
  await sSet(wkey('lights'),game.lights,true);
  await sSet(wkey('firepits'),game.firepits,true);
  await sSet(wkey('house'),{h:game.houses,t:game.houseT},true);
}
async function joinWorld(code){
  game.code=code;
  const meta=await sGet(wkey('meta'),true);
  if (!meta){ toast('No garden found with that code.'); game.code=null; return false; }
  game.elapsedMs=meta.elapsedMs!==undefined ? Math.max(0,+meta.elapsedMs||0)
    : Math.max(0,Date.now()-(meta.startTs||Date.now()));
  game.startTs=Date.now(); game.dayOffset=0; game.clockSuspended=false; game.pausedAt=0;
  setWorldSize(meta.gw||31, meta.gh||31); game.rot=0;
  const pl=await sGet(wkey('plants'),true); game.plants=pl||{};
  const bl=await sGet(wkey('bulbs'),true); game.bulbs=bl||{};
  const tr=await sGet(wkey('terrain'),true); game.terrain=tr||{};
  const el=await sGet(wkey('elevation'),true); game.elevation=el||{};
  const fn=await sGet(wkey('fences'),true); game.fences=fn||{};
  const li=await sGet(wkey('lights'),true); game.lights=li||{};
  const fp=await sGet(wkey('firepits'),true); game.firepits=fp||{};
  const ho=await sGet(wkey('house'),true);
  const hh=ho&&ho.h;
  game.houses = Array.isArray(hh) ? hh : (hh ? [hh] : [defaultHouse()]);
  markGroundChanged({terrain:true});
  game.houseDraft=draftFromHouses(); game.houseT=(ho&&ho.t)||0;
  return true;
}
async function syncPlantsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('plants'),true)||{};
  mergeMap(game.plants,remote);
  await sSet(wkey('plants'),game.plants,true);
}
async function syncTerrainOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('terrain'),true)||{};
  mergeMap(game.terrain,remote);
  await sSet(wkey('terrain'),game.terrain,true);
}
async function syncElevationOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('elevation'),true)||{};
  mergeMap(game.elevation,remote);
  await sSet(wkey('elevation'),game.elevation,true);
}
async function syncBulbsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('bulbs'),true)||{};
  mergeMap(game.bulbs,remote);
  await sSet(wkey('bulbs'),game.bulbs,true);
}
async function syncFencesOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('fences'),true)||{};
  mergeMap(game.fences,remote);
  await sSet(wkey('fences'),game.fences,true);
}
async function syncLightsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('lights'),true)||{};
  mergeMap(game.lights,remote);
  await sSet(wkey('lights'),game.lights,true);
}
async function syncFirepitsOut(){
  if (game.mode!=='multi') { return; }
  const remote=await sGet(wkey('firepits'),true)||{};
  mergeMap(game.firepits,remote);
  await sSet(wkey('firepits'),game.firepits,true);
}
function mergeMap(target,remote){ // last write wins, per tile
  let changed=false;
  for (const k in remote){ const r=remote[k], l=target[k];
    if (!l || (r.t||0)>(l.t||0)){ target[k]=r; changed=true; } }
  if (changed){
    markModelChanged();
    if (target===game.terrain) markLayerCacheChanged('terrain');
    else if (target===game.elevation) markLayerCacheChanged('elevation');
  }
}
async function pushPresence(){
  if (game.mode!=='multi') return;
  const now=Date.now(); if (now-presenceThrottle<1500) return; presenceThrottle=now;
  const players=await sGet(wkey('players'),true)||{};
  players[game.playerId]={n:game.char.name||'Gardener',sp:game.char.species,c:game.char.coat,
    cd:game.char.coatD,m:game.char.mark,x:Math.round(game.px),y:Math.round(game.py),ts:now};
  await sSet(wkey('players'),players,true);
}
async function pollWorld(){
  if (game.mode!=='multi') return;
  const remote=await sGet(wkey('plants'),true);
  if (remote) mergeMap(game.plants,remote);
  const remoteT=await sGet(wkey('terrain'),true);
  if (remoteT) mergeMap(game.terrain,remoteT);
  const remoteE=await sGet(wkey('elevation'),true);
  if (remoteE) mergeMap(game.elevation,remoteE);
  const remoteB=await sGet(wkey('bulbs'),true);
  if (remoteB) mergeMap(game.bulbs,remoteB);
  const remoteF=await sGet(wkey('fences'),true);
  if (remoteF) mergeMap(game.fences,remoteF);
  const remoteL=await sGet(wkey('lights'),true);
  if (remoteL) mergeMap(game.lights,remoteL);
  const remoteFP=await sGet(wkey('firepits'),true);
  if (remoteFP) mergeMap(game.firepits,remoteFP);
  const ho=await sGet(wkey('house'),true);
  if (ho && ho.h && (ho.t||0)>game.houseT){
    game.houses = Array.isArray(ho.h) ? ho.h : [ho.h]; game.houseT=ho.t; markLayerCacheChanged('houses'); }
  const players=await sGet(wkey('players'),true)||{};
  game.others={};
  let live=0;
  for (const id in players){ if (id===game.playerId) continue;
    if (Date.now()-players[id].ts<30000){ game.others[id]=players[id]; live++; } }
  const list=document.getElementById('playerList');
  const names=[game.char.name||'You',...Object.values(game.others).map(o=>o.n)];
  list.innerHTML='🌿 '+names.slice(0,4).join('<br>🌿 ');
  if (live>=4) toast('This bed is full — 4 gardeners max.');
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
  const where=game.mode==='multi'?`Garden ${game.code}`:'Solo garden';
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
  $('exportScreen').classList.remove('hidden');
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
   A planted-only calendar: reads the same placed plant/bulb layers as the
   planting list, then maps seasonal bloom colors to approximate day ranges
   within each 16-day season. It is a design aid, not a strict horticultural
   prediction. */
function bloomWindowFor(def){
  const centers={cool:5, mid:8, warm:11};
  const peak0=def.bloomDay!==undefined ? def.bloomDay : (centers[def.phen]||8);
  const peak=Math.max(1,Math.min(DAYS_PER_SEASON,Math.round(peak0)+1));
  return {start:Math.max(1,peak-3), end:Math.min(DAYS_PER_SEASON,peak+3)};
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
    const [s,v]=ck.split('|'), def=plantDef(s,v||null), win=bloomWindowFor(def);
    const windows=SEASONS.map((season,idx)=>{
      const sea=(def.sea&&def.sea[season])||{};
      return sea.bloom ? {season,seasonIndex:idx,start:win.start,end:win.end,color:sea.bloom} : null;
    }).filter(Boolean);
    if (!windows.length) return null;
    return {key:ck,name:def.name,latin:def.latin||'',count:counts[ck],
      color:planColor(def),windows,
      first:windows[0].seasonIndex*DAYS_PER_SEASON+windows[0].start};
  }).filter(Boolean).sort((a,b)=>a.first-b.first || a.name.localeCompare(b.name));
}
function bloomRangeHtml(win){
  const left=((win.start-1)/DAYS_PER_SEASON)*100;
  const width=((win.end-win.start+1)/DAYS_PER_SEASON)*100;
  const label=win.start===win.end ? `Day ${win.start}` : `Days ${win.start}-${win.end}`;
  return `<span class="bloom-range" style="left:${left}%;width:${width}%;background:${win.color}" title="${htmlEscape(win.season)} ${htmlEscape(label)}"><span>${htmlEscape(label)}</span></span>`;
}
function openBloomCalendar(){
  const rows=bloomRows(), body=$('bloomBody');
  const where=game.mode==='multi'?`Garden ${game.code}`:(game.worldName||'My garden');
  $('bloomMeta').textContent=`${where} · ${new Date().toLocaleDateString()} · one season = ${DAYS_PER_SEASON} garden days`;
  if (!rows.length){
    body.innerHTML='<p class="note">Nothing blooming is planted yet. Add flowering perennials or bulbs, then come back for the calendar.</p>';
  } else {
    const head=`<div class="bloom-head">Species</div>${SEASONS.map(s=>`<div class="bloom-head">${s}</div>`).join('')}`;
    const lines=rows.map(r=>{
      const bySeason={};
      r.windows.forEach(w=>{ bySeason[w.season]=w; });
      const cells=SEASONS.map(s=>{
        const win=bySeason[s];
        return `<div class="bloom-cell"><div class="bloom-track">${win?bloomRangeHtml(win):''}</div></div>`;
      }).join('');
      return `<div class="bloom-name"><b>${htmlEscape(r.name)}</b><small>${htmlEscape(r.latin)}</small><em>${r.count} planted</em></div>${cells}`;
    }).join('');
    body.innerHTML=`<div class="bloom-wrap"><div class="bloom-grid">${head}${lines}</div></div>
      <p class="note">Bloom timing is approximate and uses the garden's 16-day season rhythm. Weather, establishment, and cultivar differences can shift real-world timing.</p>`;
  }
  $('bloomScreen').classList.remove('hidden');
}

/* ---------- the planting plan: an Oudolf-style drift map ----------
   Top-down 2D. Contiguous same-species tiles flood-fill into drifts,
   each drift's boundary is traced and smoothed into an organic blob,
   labeled with a short code. Trees draw as dashed mature-canopy
   circles, bulbs as scatter dots over the drifts. */
function planComponents(){
  const live={};
  for (const k in game.plants){ const p=game.plants[k]; if (!p.removed){
    const [x,y]=k.split(',').map(Number), def=plantDef(p.s,p.v);
    if (def.type==='shrub') shrubFootprintTiles(x,y,p,true).forEach(([xx,yy])=>{ if (!live[`${xx},${yy}`]) live[`${xx},${yy}`]=p; });
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
    comps.push({s:root.p.s,v:root.p.v||null,tiles,shape:(root.def.look&&root.def.look.shape)||'round',hedge});
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
  const r=Math.max(cell*0.42,(def.spread/TILE_IN/2)*cell);
  ctx.save();
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=1.25;
  if (!c.hedge){
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cx2=(X(minX)+X(maxX+1))/2, cy2=(Y(minY)+Y(maxY+1))/2;
    const rx=Math.max(r*0.62, (maxX-minX+1)*cell*0.48);
    const ry=Math.max(r*0.48, (maxY-minY+1)*cell*0.48);
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
  const lightsLive=Object.keys(game.lights||{}).filter(k=>game.lights[k]&&!game.lights[k].removed);
  const ids=[...new Set([
    ...comps.map(c=>c.s+'|'+(c.v||'')),
    ...shrubComps.map(c=>c.s+'|'+(c.v||'')),
    ...bulbsLive.map(k=>{ const b2=game.bulbs[k]; return b2.s+'|'+(b2.v||''); })
  ])];
  const codes=planCodes(ids);
  const legCols=3, legRows=Math.ceil(ids.length/legCols);
  const fixtureRows=lightsLive.length?1:0;
  const W2=padL*2+GW*cell, H2=padT+GH*cell+34+(legRows+fixtureRows)*15+26;
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
  // north arrow (world y points up-page on plans; our y+ is south)
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(W2-40,62); ctx.lineTo(W2-40,34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W2-40,30); ctx.lineTo(W2-45,42); ctx.lineTo(W2-35,42); ctx.closePath();
  ctx.fillStyle='#2c241c'; ctx.fill();
  ctx.font='10px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillText('N',W2-40,80);
  // faint tile grid so bare ground still reads as a plot of blank tiles
  ctx.strokeStyle='rgba(120,108,86,0.16)'; ctx.lineWidth=0.5;
  for (let gx=0;gx<=GW;gx++){ ctx.beginPath(); ctx.moveTo(X(gx),Y(0)); ctx.lineTo(X(gx),Y(GH)); ctx.stroke(); }
  for (let gy=0;gy<=GH;gy++){ ctx.beginPath(); ctx.moveTo(X(0),Y(gy)); ctx.lineTo(X(GW),Y(gy)); ctx.stroke(); }
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
    if (def.type==='tree') return; // trees become canopy circles below
    const col=planColor(def);
    const loops=traceOutlines(new Set(c.tiles));
    loops.forEach(loop=>{
      smoothLoop(loop);
      ctx.fillStyle=mixHex(col,'#f7f3e8',0.66); ctx.fill();
      ctx.strokeStyle=mixHex(col,'#2c241c',0.25); ctx.lineWidth=1.3; ctx.stroke();
    });
  });
  shrubComps.forEach(c=>drawShrubPlan(ctx,c,codes,cell,X,Y));
  // trees: mature canopy circles, trunk dot
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const def=plantDef(p.s,p.v);
    if (def.type!=='tree') continue;
    const [x,y]=k.split(',').map(Number);
    // canopy sized to the tree's actual (establishment-scaled) reach, not full
    // mature spread — a young tree draws a small circle, growing as it ages
    const r=Math.max(cell*0.5, canopyRadius(p)*cell);
    ctx.strokeStyle='#6e5a40'; ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,r,0,7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#4a3a28';
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,Math.max(2.5,cell*0.18),0,7); ctx.fill();
  }
  // bulbs: scatter rings over everything
  bulbsLive.forEach(k=>{
    const b2=game.bulbs[k], [x,y]=k.split(',').map(Number);
    ctx.strokeStyle=planColor(plantDef(b2.s,b2.v)); ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(X(x)+cell/2,Y(y)+cell/2,Math.max(2,cell*0.2),0,7); ctx.stroke();
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
  // labels at drift centroids, white halo for legibility
  ctx.textAlign='center';
  comps.forEach(c=>{
    const def=plantDef(c.s,c.v);
    if (def.type==='tree'){ var lt=c.tiles[0].split(',').map(Number);
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
  // scale bar: 10 ft
  const ftPx=cell/1.5, bx2=W2-padL-ftPx*10, by2=H2-18;
  ctx.strokeStyle='#2c241c'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(bx2,by2); ctx.lineTo(bx2+ftPx*10,by2); ctx.stroke();
  for (let f=0;f<=10;f+=5){ ctx.beginPath();
    ctx.moveTo(bx2+ftPx*f,by2-4); ctx.lineTo(bx2+ftPx*f,by2+4); ctx.stroke(); }
  ctx.font='9px IBM Plex Sans'; ctx.textAlign='center'; ctx.fillStyle='#2c241c';
  ctx.fillText('10 ft', bx2+ftPx*5, by2-8);
}
function openPlan(){ buildPlanMap(); $('planScreen').classList.remove('hidden'); }
function downloadPlan(){
  $('planCanvas').toBlob(b2=>{
    if (!b2) return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b2);
    a.download=`${(game.worldName||'garden').replace(/\s+/g,'-').toLowerCase()}-plan.png`;
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
}

