'use strict';

/* ---------- movement & actions ---------- */
function tryMove(nx,ny){
  if (!canStand(nx,ny)||game.moving) return;
  game.fromX=game.px; game.fromY=game.py;
  game.tx=nx; game.ty=ny; game.moving=true; game.moveT=0;
  // diagonal grid steps cover more screen, so they take a bit longer
  game.moveDur = (Math.abs(nx-game.fromX)+Math.abs(ny-game.fromY)>1)?255:170;
}
function stepMove(dt){
  if (!game.moving) return;
  game.moveT += dt/game.moveDur;
  if (game.moveT>=1){ game.px=game.tx; game.py=game.ty; game.moving=false; pushPresence(); }
  else { game.px=game.fromX+(game.tx-game.fromX)*game.moveT;
         game.py=game.fromY+(game.ty-game.fromY)*game.moveT; }
}
function actHere(opts){
  const x=Math.round(game.tx), y=Math.round(game.ty), k=`${x},${y}`;
  if (isPlacementTool(game.tool)){
    const layer=toolTargetLayer(game.tool);
    if (blockIfWrongEditLayer(layer)) return;
    if (layer && !layerShown(layer)){ promptRevealLayer(layer,x,y); return; }
  }
  if (isDoor(x,y)){
    if (ENABLE_HOUSE_SLEEP) doSleep();
    else toast('The doorstep is just scenery for now.');
    return;
  }
  if (game.tool==='house'){ toast('Tap the spot where the house should stand.'); return; }
  if (game.tool==='fence'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fence needs clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ syncToolLayer(r); toast(`${fenceLabel()} placed.`); }
    else toast('Fence needs clear dry ground.');
    return;
  }
  if (game.tool==='light'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Lighting needs clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ syncToolLayer(r); toast(`${lightLabel()} placed.`); }
    else toast('Lighting needs a clear dry tile.');
    return;
  }
  if (game.tool==='firepit'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fire pits need clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ syncToolLayer(r); toast(`${firepitLabel()} placed.`); }
    else toast('Fire pit needs clear dry ground.');
    return;
  }
  if (isElevationTool(game.tool)){
    const before=elevationAt(x,y);
    if (applyToolAt(x,y)){
      syncElevationOut();
      const after=elevationAt(x,y);
      toast(game.tool==='level' ? 'Leveled ground.' : `Elevation ${after>before?'raised':'lowered'} to ${after}.`);
    } else {
      toast(game.tool==='raise' ? 'Already at the highest elevation.'
        : game.tool==='lower' ? 'Already at the lowest elevation.'
        : 'Already level.');
    }
    return;
  }
  const existing = game.plants[k], hasPlant = existing && !existing.removed;
  const shrubHit = shrubAt(x,y);
  const terrObj = terrainAt(x,y), terr = terrObj&&terrObj.k;
  const bulbHere=game.bulbs[k], hasBulb=bulbHere && !bulbHere.removed;
  if (game.tool==='shovel'){
    const counts={plants:0,bulbs:0,terr:0,elev:0,house:0,fence:0,light:0,firepit:0};
    eraseBrush(x,y,counts);
    const parts=[];
    if (counts.plants) parts.push(`${counts.plants} plant${counts.plants>1?'s':''}`);
    if (counts.bulbs) parts.push(`${counts.bulbs} bulb${counts.bulbs>1?'s':''}`);
    if (counts.terr) parts.push(`${counts.terr} terrain tile${counts.terr>1?'s':''}`);
    if (counts.elev) parts.push(`${counts.elev} elevation tile${counts.elev>1?'s':''}`);
    if (counts.fence) parts.push(`${counts.fence} fence${counts.fence>1?'s':''}`);
    if (counts.light) parts.push(`${counts.light} light${counts.light>1?'s':''}`);
    if (counts.firepit) parts.push(`${counts.firepit} fire pit${counts.firepit>1?'s':''}`);
    if (counts.house) parts.push(`${counts.house} house${counts.house>1?'s':''}`);
    if (parts.length){
      toast(`Erased ${parts.join(' and ')}.`);
      if (counts.plants) syncPlantsOut();
      if (counts.bulbs) syncBulbsOut();
      if (counts.terr) syncTerrainOut();
      if (counts.elev) syncElevationOut();
      if (counts.fence) syncFencesOut();
      if (counts.light) syncLightsOut();
      if (counts.firepit) syncFirepitsOut();
      if (counts.house) pushHouse();
    } else toast('Nothing to erase here.');
    return;
  }
  if (toolMeta(game.tool).material){
    if (hasPlant){ toast('Lift the plant first.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Lift the shrub first — its mature spread claims this ground.'); return; }
    if (hasBulb && game.tool==='water'){ toast('Dig the bulb first.'); return; }
    if (game.tool==='water' && fenceAt(x,y)){ toast('Move the fence before making water.'); return; }
    if (game.tool==='water' && lightAt(x,y)){ toast('Move the light before making water.'); return; }
    if (firepitAt(x,y)){ toast('Move the fire pit before changing the ground.'); return; }
    if (game.tool==='water' && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)){
      toast('Step aside before making water.'); return;
    }
    const wasSame=terr===game.tool;
    const r=applyToolAt(x,y,opts);
    if (r){
      syncToolLayer(r);
      toast(game.tool==='path'
        ? (wasSame?`${pathColor(game.pathColor).label} path color applied.`:`${pathColor(game.pathColor).label} path laid.`)
        : game.tool==='water'
        ? (wasSame?`${waterStyle(game.waterStyle).label} water applied.`:`${waterStyle(game.waterStyle).label} water laid.`)
        : (wasSame?`${bedStyle(game.bedStyle).label} bed applied.`:`${bedStyle(game.bedStyle).label} bed dug. Ready for planting.`));
      return;
    }
    toast(terr===game.tool
      ? (terr==='path'?'Already a path.':terr==='water'?'Already water.':'Already a bed.')
      : 'Needs clear ground.');
    return;
  }
  if (fenceAt(x,y)){ toast('Fence is in the way.'); return; }
  if (lightAt(x,y)){ toast('A light is in the way.'); return; }
  if (firepitAt(x,y)){ toast('A fire pit is in the way.'); return; }
  const def=PLANTS[game.tool] ? plantDef(game.tool,game.toolVar) : null;
  if (!def) return;
  if (def.type==='water'){
    if (terr!=='water'){ toast('Water plants need a pond, river, or lake tile.'); return; }
    if (hasPlant){ showPlantCard(existing,x,y); return; }
    if (hasBulb){ toast('Lift the bulb before planting in water.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Water plants need open water outside the shrub spread.'); return; }
    const shadeTree=shadeInfoAt(x,y,false);
    if (shadeTree && def.sun!=='part'){
      toast(`Active canopy shade from the ${PLANTS[shadeTree.p.s].name.toLowerCase()} — part-shade water plants only.`);
      return;
    }
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n,opts); return; }
    if (applyToolAt(x,y,opts)){ syncPlantsOut(); toast(`Planted ${def.name} in the water.`); }
    else toast('No open water here.');
    return;
  }
  if (def.type==='bulb'){ // bulbs go UNDER perennials — but not under trees or shrubs
    if (hasBulb){ showPlantCard(bulbHere,x,y); return; }
    if (terr==='path'||terr==='water'){ toast(terr==='water'?'Not in the water.':'Not in the gravel — lift the path first.'); return; }
    if (shrubHit){
      pulseShrubFootprint(shrubHit);
      toast(`No bulbs under ${plantDef(shrubHit.p.s,shrubHit.p.v).name.toLowerCase()} — the shrub claims that ground.`);
      return;
    }
    if (hasPlant && plantLayerOf(existing)==='woody'){
      toast('No bulbs under trees or shrubs — their roots claim that ground.'); return; }
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n,opts); return; }
    if (applyToolAt(x,y,opts)){ syncBulbsOut();
      toast(`Tucked in ${def.name} — it shows at first thaw.`); }
    else toast('No spot for a bulb here.');
    return;
  }
  if (terr==='path'||terr==='water'){ toast(terr==='water'?'Dry land first — land plants and ponds disagree.':'Dig the path up first — plants and gravel disagree.'); return; }
  if (shrubHit && def.type!=='shrub' && (!hasPlant || shrubHit.key!==k)){
    pulseShrubFootprint(shrubHit);
    showPlantCard(shrubHit.p,shrubHit.x,shrubHit.y);
    toast(`${plantDef(shrubHit.p.s,shrubHit.p.v).name} needs this mature spread.`);
    return;
  }
  if (hasPlant){ showPlantCard(existing,x,y); return; }
  const shadeTree=shadeInfoAt(x,y,false);
  if (shadeTree && def.sun!=='part'){
    toast(`Active canopy shade from the ${PLANTS[shadeTree.p.s].name.toLowerCase()} — shade-tolerant plants only.`);
    return;
  }
  const n=game.drift?driftCount(def):1;
  if (n>1){ stampDrift(x,y,n,opts); return; }
  if (applyToolAt(x,y,opts)){ syncPlantsOut();
    toast(`Planted ${def.name}.${def.type==='forb'||def.type==='grass'?' Drifts of 3+ read better — try the Drift toggle.':''}`); }
  else toast('No room here.');
}
function plantFx(x,y,p){ const o=plantOffset(p); game.fx.push({x,y,ox:o.ox,oy:o.oy,t0:performance.now()}); }
function freePlantable(def){ return !!(game.freePlanting && def && !['bulb','shrub','tree'].includes(def.type)); }
function clampPlantOffset(v){ return Math.max(-0.44,Math.min(0.44,Number.isFinite(+v)?+v:0)); }
function roundedOffset(v){ return Math.round(clampPlantOffset(v)*100)/100; }
function naturalPlantOffset(x,y,opts){
  if (opts && Number.isFinite(+opts.ox) && Number.isFinite(+opts.oy))
    return {ox:roundedOffset(opts.ox), oy:roundedOffset(opts.oy)};
  const rs=mulberry((tileSeed(x,y) ^ Date.now())>>>0);
  return {ox:roundedOffset((rs()-0.5)*0.78), oy:roundedOffset((rs()-0.5)*0.78)};
}
/* drift planting: one action stamps a loose, natural cluster. Tighter
   spacers come in bigger drifts; woody plants always plant singly. */
function driftCount(def){
  if (def.type==='shrub'||def.type==='tree') return 1;
  return def.space<=6?9 : def.space<=12?7 : def.space<=18?5 : def.space<=30?3 : 1;
}
/* the one silent placer behind drifts, drags, and single planting: puts the
   armed tool on a tile if it fits, no toasts. Dispatches through the tool's
   apply hook (see the TOOLS table in tray.js); returns what it placed
   ('plant'|'bulb'|'path'|'bed'|'water'|'fence'|'gate'|'light'|'elevation') or
   null. The universal guards (off-plot, house/door) live here so every hook
   inherits them; tools without a hook (hand/select/pick/erase/house) no-op. */
function applyToolAt(x,y,opts){
  if (x<0||y<0||x>=GW||y>=GH) return null;
  if (inHouse(x,y) || isDoor(x,y)) return null;
  const meta=toolMeta(game.tool);
  return meta.apply ? meta.apply(x,y,opts) : null;
}
// path/bed/water: lay or repaint a ground material on a tile
function placeTerrainAt(x,y){
  const k=`${x},${y}`, terrObj=terrainAt(x,y), terr=terrObj&&terrObj.k;
  const ex=game.plants[k], eb=game.bulbs[k];
  if (ex && !ex.removed) return null;
  if (shrubAt(x,y)) return null;
  if (game.tool==='water' && fenceAt(x,y)) return null;
  if (game.tool==='water' && lightAt(x,y)) return null;
  if (firepitAt(x,y)) return null;
  if (game.tool==='water' && eb && !eb.removed) return null;
  if (game.tool==='water' && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return null;
  if (terr===game.tool){
    if (game.tool==='water' && waterStyleId(terrObj.c)!==game.waterStyle){
      setTile('terrain',k,{k:'water',c:game.waterStyle,t:Date.now()});
      return 'water';
    }
    if (game.tool==='path' && pathColorId(terrObj.c)!==game.pathColor){
      setTile('terrain',k,{k:'path',c:game.pathColor,t:Date.now()});
      return 'path';
    }
    if (game.tool==='bed' && bedStyleId(terrObj.c)!==game.bedStyle){
      setTile('terrain',k,{k:'bed',c:game.bedStyle,t:Date.now()});
      return 'bed';
    }
    return null;
  }
  setTile('terrain',k, game.tool==='path'
    ? {k:'path',c:game.pathColor,t:Date.now()}
    : game.tool==='water'
    ? {k:'water',c:game.waterStyle,t:Date.now()}
    : {k:'bed',c:game.bedStyle,t:Date.now()});
  return game.tool;
}
// plant/bulb/water-plant: drop the armed species on a tile if it fits
function placePlantAt(x,y,opts){
  const k=`${x},${y}`, terrObj=terrainAt(x,y), terr=terrObj&&terrObj.k;
  const def=plantDef(game.tool,game.toolVar);
  if (fenceAt(x,y)) return null;
  if (lightAt(x,y)) return null;
  if (firepitAt(x,y)) return null;
  const np={s:game.tool,d:absDay(),t:Date.now()};
  if (game.toolVar) np.v=game.toolVar;
  if (def.type==='water'){
    const ex=game.plants[k], eb=game.bulbs[k];
    if (terr!=='water') return null;
    if ((ex && !ex.removed) || (eb && !eb.removed)) return null;
    if (shrubAt(x,y)) return null;
    const sh=shadeAt(x,y);
    if (sh && def.sun!=='part') return null;
    if (freePlantable(def)) Object.assign(np,naturalPlantOffset(x,y,opts));
    setTile('plants',k,np); plantFx(x,y,np);
    return 'plant';
  }
  if (terr==='path'||terr==='water') return null;
  if (def.type==='bulb'){ // bulbs tuck in under perennials — but not under trees/shrubs
    const eb=game.bulbs[k];
    if (eb && !eb.removed) return null;
    if (shrubAt(x,y)) return null;
    const above=game.plants[k];
    if (above && !above.removed && plantLayerOf(above)==='woody') return null;
    setTile('bulbs',k,np); plantFx(x,y,np);
    return 'bulb';
  }
  const ex=game.plants[k];
  if (ex && !ex.removed) return null;
  if (def.type!=='shrub' && shrubAt(x,y)) return null;
  if (def.type==='shrub' && !canPlaceShrubAt(x,y,np).ok) return null;
  const sh=shadeAt(x,y);
  if (sh && def.sun!=='part') return null;
  if (freePlantable(def)) Object.assign(np,naturalPlantOffset(x,y,opts));
  setTile('plants',k,np); plantFx(x,y,np);
  // a tree or shrub claims the ground — any bulb tucked under it is lost
  if (def.type==='shrub') clearBulbsUnderShrub(x,y,np);
  else if (def.type==='tree'){ const eb=game.bulbs[k];
    if (eb && !eb.removed){ clearTile('bulbs',k); syncBulbsOut(); } }
  return 'plant';
}
function syncToolLayer(what){
  if (what==='path'||what==='bed'||what==='water') syncTerrainOut();
  else if (what==='elevation') syncElevationOut();
  else if (what==='fence'||what==='gate') syncFencesOut();
  else if (what==='light') syncLightsOut();
  else if (what==='firepit') syncFirepitsOut();
  else if (what==='bulb') syncBulbsOut();
  else syncPlantsOut();
}
function stampDrift(cx0,cy0,n,opts){
  const offs=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
              [2,0],[0,2],[-2,0],[0,-2],[2,1],[1,2],[-1,2],[-2,1]];
  const rest=offs.slice(1); // keep the clicked tile first, shuffle the rest
  for (let i=rest.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0;
    [rest[i],rest[j]]=[rest[j],rest[i]]; }
  const def=plantDef(game.tool,game.toolVar);
  let placed=0, what=null;
  for (const [ox,oy] of [offs[0],...rest]){
    if (placed>=n) break;
    const r=applyToolAt(cx0+ox,cy0+oy,(!ox&&!oy)?opts:null);
    if (r){ placed++; what=r; }
  }
  if (placed){ syncToolLayer(what);
    toast(placed>1?`A drift of ${placed} — ${def.name}.`:`Planted ${def.name} — no room for more here.`); }
  else toast('No room for a drift here.');
}
function doSleep(){
  if (!ENABLE_HUD_SLEEP_BUTTON && !ENABLE_HOUSE_SLEEP){ toast('End Day is tucked away for now.'); return; }
  game.dayOffset++; game.dirty=true;
  if (game.mode==='multi') toast('Day advanced here — a shared garden keeps its own clock.');
  else toast('A new garden day begins.');
}

/* ---------- fence / structure placement ---------- */
function fenceDraft(){ return game.fenceDraft=normalizeFenceDraft(game.fenceDraft); }
function fenceLabel(f){
  const d=f||fenceDraft();
  return `${d.height}' ${fenceStyle(d.style).label}${d.gate?' gate':' fence'}`;
}
function canPlaceFence(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return false;
  if (inHouse(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water' || lightAt(x,y) || firepitAt(x,y)) return false;
  if (shrubAt(x,y)) return false;
  const d=fenceDraft();
  if (!d.gate && game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return false;
  const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
  return !(p&&!p.removed) && !(b&&!b.removed);
}
function placeFenceAt(x,y){
  if (!canPlaceFence(x,y)) return null;
  const d=normalizeFenceDraft(fenceDraft()), k=`${x},${y}`, now=Date.now();
  const next={style:fenceStyleId(d.style),height:FENCE_HEIGHTS.includes(d.height)?d.height:4,gate:!!d.gate,t:now};
  const cur=fenceAt(x,y);
  if (cur && cur.style===next.style && cur.height===next.height && !!cur.gate===next.gate) return null;
  setTile('fences',k,next);
  return next.gate?'gate':'fence';
}
function canPlaceLight(x,y){
  if (x<0||y<0||x>=GW||y>=GH) return false;
  if (inHouse(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water') return false;
  if (fenceAt(x,y) || firepitAt(x,y) || shrubAt(x,y)) return false;
  if (game.gameMode!=='design' && x===Math.round(game.px) && y===Math.round(game.py)) return false;
  const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
  return !(p&&!p.removed) && !(b&&!b.removed);
}
function placeLightAt(x,y){
  if (!canPlaceLight(x,y)) return null;
  const d=normalizeLightDraft(lightDraft()), k=`${x},${y}`, now=Date.now();
  const next={type:lightTypeId(d.type),tone:lightToneId(d.tone),t:now};
  const cur=lightAt(x,y);
  if (cur && cur.type===next.type && cur.tone===next.tone) return null;
  setTile('lights',k,next);
  return 'light';
}

/* ---------- house placement / sizing / paint ---------- */
function pushHouse(){ game.houseT=Date.now();
  if (game.mode==='multi') sSet(wkey('house'),{h:game.houses,t:game.houseT},true); }
function displacePlants(x,y,w,h){ // a house can't share ground with plants
  let n=0;
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const [px2,py2]=k.split(',').map(Number);
    const inside=px2>=x&&px2<x+w&&py2>=y&&py2<y+h;
    const overlaps=isShrubDef(plantDef(p.s,p.v)) && shrubFootprintOverlapsRect(px2,py2,p,x,y,w,h);
    if (inside || overlaps){ clearTile('plants',k); n++; }
  }
  if (n) syncPlantsOut();
  return n;
}
function clearTerrainForHouse(x,y,w,h){
  let n=0;
  const clear=(xx,yy)=>{
    if (xx<0||yy<0||xx>=GW||yy>=GH) return;
    const k=`${xx},${yy}`;
    if (terrainAt(xx,yy)){ clearTile('terrain',k); n++; }
    if (fenceAt(xx,yy)){ clearTile('fences',k); n++; }
    if (lightAt(xx,yy)){ clearTile('lights',k); n++; }
    const fp=firepitAt(xx,yy);
    if (fp){ clearTile('firepits',fp.key); n++; }
  };
  for (let yy=y;yy<y+h;yy++) for (let xx=x;xx<x+w;xx++) clear(xx,yy);
  clear(x+((w-1)>>1),y+h); // keep the doorstep standable
  if (n){ syncTerrainOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut(); }
  return n;
}
function placeHouse(x,y){
  const d=game.houseDraft || (game.houseDraft=defaultDraft());
  const nx=Math.max(0,Math.min(GW-d.w,x)), ny=Math.max(0,Math.min(GH-d.h-1,y));
  const ppx=Math.round(game.px), ppy=Math.round(game.py);
  if (game.gameMode!=='design' && ppx>=nx&&ppx<nx+d.w&&ppy>=ny&&ppy<ny+d.h){
    toast("You're standing in the way."); return; }
  if (game.houses.some(o=>nx<o.x+o.w&&nx+d.w>o.x&&ny<o.y+o.h&&ny+d.h>o.y)){
    toast('That overlaps another house.'); return; }
  addHouse({x:nx,y:ny,w:d.w,h:d.h,wall:d.wall,roof:d.roof,sizeFt:d.sizeFt});
  pushHouse();
  const n=displacePlants(nx,ny,d.w,d.h);
  clearTerrainForHouse(nx,ny,d.w,d.h);
  toast('House placed.'+(n?` ${n} plant${n>1?'s':''} lifted from under it.`:''));
}
// the House tab's size/colour chips edit the draft — the settings the next
// placed house uses (existing houses are changed by erasing + re-placing)
function applyHouseSize(wFt,dFt,label){
  const w=ftToTiles(wFt), d=ftToTiles(dFt);
  if (w>GW-2 || d>GH-3){ toast('The plot is too small for that house.'); return; }
  const dr=game.houseDraft || (game.houseDraft=defaultDraft());
  dr.w=w; dr.h=d; dr.sizeFt=[wFt,dFt];
  toast(`${label} — ${wFt}' × ${dFt}'. Tap the map to place it.`);
}
function paintHouse(part,col,label){
  const dr=game.houseDraft || (game.houseDraft=defaultDraft());
  dr[part]=col;
  toast(part==='wall'?`Walls set ${label.toLowerCase()}. Tap to place.`
                     :`Roof set ${label.toLowerCase()}. Tap to place.`);
}
function showPlantCard(p,px2,py2){
  const P=plantDef(p.s,p.v), g=Math.round(plantEstab(p)*100), el=document.getElementById('plantCard');
  clearTimeout(el._t);
  const focusKey=plantKeyOf(p);
  game.focusPlantKey=focusKey;
  const dim=v=>v>=96?`${Math.round(v/12)}&prime;`:`${v}&Prime;`; // feet for tree-scale numbers
  const shaded = px2!==undefined && P.sun!=='part' && P.type!=='tree' && shadeInfoAt(px2,py2,false);
  const shrubFoot = P.type==='shrub' ? ` · reserves about ${Math.max(1,Math.round((P.spread||P.space||TILE_IN)/TILE_IN))} tiles wide` : '';
  el.innerHTML=`<h3>${P.name}</h3><div class="latin">${P.latin}</div>
    <p>${P.blurb}</p>
    <p style="margin-top:6px;color:#cdbfa9">${dim(P.space)} apart · ${dim(P.spread)} spread ·
      zones ${P.zones[0]}–${P.zones[1]} · ${P.sun} sun · ${P.moist} soil${
      P.grow?` · ~${P.grow} yrs to size`:''}${shrubFoot}</p>
    <p style="color:${P.native?'#9ab87a':'#c9a07f'}">${P.native
      ? 'Native — '+P.eco.slice(0,2).join(', ')+(P.eco.length>2?` +${P.eco.length-2} more`:'')
      : 'Garden cultivar (non-native)'}</p>
    <p style="color:#b9a88f">Roles: ${roleSummary(p.s)}</p>
    ${shaded?`<p style="color:#c9a07f">Struggling — active canopy shade from ${PLANTS[shaded.p.s].name} and it wants full sun.</p>`:''}
    <p style="margin-top:6px;color:#efe6d3">${g<100?`Establishing — ${g}% grown`:'Fully established'}</p>`;
  const xb=document.createElement('button'); xb.className='card-x'; xb.textContent='✕';
  const close=()=>{ el.style.display='none'; clearTimeout(el._t);
    if (game.focusPlantKey===focusKey) game.focusPlantKey=null; };
  xb.onclick=close;
  el.prepend(xb);
  el.style.display='block';
  el._t=setTimeout(close,8000);
}
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity=1;
  if (/nothing|no room|already|first|failed|coming soon|only|lift the plant|dig the path|not in|no spot|shade-tolerant|standing in the way|just scenery|enter the/i.test(msg))
  clearTimeout(el._t); el._t=setTimeout(()=>el.style.opacity=0,2600);
}



/* tap / click: first tap walks, tap on own tile acts */
let sweep=null; // shovel drag-lift in progress: {plants, terr}
/* the eraser: clears a square brush (game.eraseSize) centered on the
   tile, removing the layers selected by game.eraseMode. 'all' wipes
   plant + bulb + terrain on every tile in one pass; the others touch
   only their layer. Counts tally into `counts`. */
function eraseBrush(cx,cy,counts){
  const r=((game.eraseSize|0)-1)/2, m=game.eraseMode, now=Date.now();
  // a layer is erasable only if it's visible, in edit focus, and in eraseMode
  const can=(name,mode)=>layerShown(name) && layerEditable(name) && (m==='all'||m===mode);
  const peren=can('perennials','plant'), woody=can('woody','plant');
  const bulbOK=can('bulbs','bulb'), terrOK=can('landscape','terrain');
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
    const x=cx+dx, y=cy+dy;
    if (x<0||y<0||x>=GW||y>=GH) continue;
    const k=`${x},${y}`;
    let pk=k, p=game.plants[k];
    if (!(p && !p.removed)){
      const sh=shrubAt(x,y);
      if (sh){ pk=sh.key; p=sh.p; }
    }
    if (p && !p.removed && (plantLayerOf(p)==='woody'?woody:peren)){
      clearTile('plants',pk); counts.plants++; }
    const b=game.bulbs[k];
    if (bulbOK && b && !b.removed){
      clearTile('bulbs',k); counts.bulbs++; }
    if (terrOK && tileTerrain(x,y)){
      clearTile('terrain',k); counts.terr++; }
    if (terrOK && elevationAt(x,y)){
      clearTile('elevation',k); counts.elev=(counts.elev||0)+1; }
    if (terrOK && fenceAt(x,y)){
      clearTile('fences',k); counts.fence=(counts.fence||0)+1; }
    if (terrOK && lightAt(x,y)){
      clearTile('lights',k); counts.light=(counts.light||0)+1; }
    if (terrOK){
      const fp=firepitAt(x,y);
      if (fp){ clearTile('firepits',fp.key); counts.firepit=(counts.firepit||0)+1; }
    }
    if (terrOK){ const hh=houseAt(x,y);     // landscape erase also lifts a whole house
      if (hh){ const i=game.houses.indexOf(hh);
        if (removeHouseAtIndex(i)) counts.house=(counts.house||0)+1; } }
  }
}
function sweepLift(x,y){ eraseBrush(x,y,sweep); }

/* ---------- selection tool: marquee a region, then move/copy/rotate/erase ----------
   game.sel is the committed rect; selDrag is an in-progress marquee; selMove
   is an in-progress move/copy drag. All edits go through withUndo so each is
   a single undo step. */
let selDrag=null, selMove=null;
const AREA_CLIP_KEY='hortus:areaClipboard';
let areaClipboard=null;
function normRect(a,b){ return {x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),
  x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)}; }
function inRect(r,x,y){ return r && x>=r.x0 && x<=r.x1 && y>=r.y0 && y<=r.y1; }
function selValidDest(x,y){ return x>=0&&y>=0&&x<GW&&y<GH && !inHouse(x,y) && !isDoor(x,y); }
function selItemValidDest(c,x,y){
  if (!c.firepit) return selValidDest(x,y);
  const sz=firepitTileSize(c.firepit);
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++)
    if (!selValidDest(xx,yy)) return false;
  return true;
}
function cloneCell(c){ return JSON.parse(JSON.stringify(c)); }
// snapshot every occupied tile in the rect across plants, bulbs, terrain, elevation, fences, and lights
function selectionPayload(r){
  const items=[];
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    const k=`${x},${y}`;
    const p=game.plants[k], b=game.bulbs[k], t=game.terrain[k], e=game.elevation[k], f=game.fences[k], l=game.lights[k], fp=game.firepits[k];
    const cell={x,y};
    if (p && !p.removed) cell.plant=JSON.parse(JSON.stringify(p));
    if (b && !b.removed) cell.bulb=JSON.parse(JSON.stringify(b));
    if (t && !t.removed) cell.terr=JSON.parse(JSON.stringify(t));
    if (e && !e.removed) cell.elev=JSON.parse(JSON.stringify(e));
    if (f && !f.removed) cell.fence=JSON.parse(JSON.stringify(f));
    if (l && !l.removed) cell.light=JSON.parse(JSON.stringify(l));
    if (fp && !fp.removed) cell.firepit=JSON.parse(JSON.stringify(fp));
    if (cell.plant||cell.bulb||cell.terr||cell.elev||cell.fence||cell.light||cell.firepit) items.push(cell);
  }
  return items;
}
function selectedFillBrush(){
  const k=game.lastBrushTool;
  if (PLANTS[k]){
    const v=game.lastBrushVar||null, def=plantDef(k,v);
    return {tool:k, toolVar:v, label:def.name, plantDef:def};
  }
  if (k==='path') return {tool:k, toolVar:null, label:`${pathColor(game.pathColor).label} path`};
  if (k==='bed') return {tool:k, toolVar:null, label:`${bedStyle(game.bedStyle).label} bed`};
  if (k==='water') return {tool:k, toolVar:null, label:`${waterStyle(game.waterStyle).label} water`};
  return null;
}
function selectionAreaPayload(r){
  return {v:1,w:r.x1-r.x0+1,h:r.y1-r.y0+1,items:selectionPayload(r).map(c=>{
    const out=cloneCell(c); out.x-=r.x0; out.y-=r.y0; return out;
  })};
}
function storedArea(){
  if (areaClipboard) return areaClipboard;
  if (!hasStorage) return null;
  try{
    const raw=localStorage.getItem(AREA_CLIP_KEY);
    areaClipboard=raw?JSON.parse(raw):null;
  }catch(_){ areaClipboard=null; }
  return areaClipboard;
}
function saveSelectedArea(){
  if (!game.sel){ toast('Select an area first.'); return; }
  const area=selectionAreaPayload(game.sel);
  if (!area.items.length){ toast('Nothing in the selection to save.'); return; }
  area.savedAt=Date.now();
  areaClipboard=area;
  if (hasStorage){
    try{ localStorage.setItem(AREA_CLIP_KEY,JSON.stringify(area)); }
    catch(_){ toast('That selection is too large to save here.'); return; }
  }
  buildToolTray();
  toast(`Saved ${area.items.length} occupied tile${area.items.length>1?'s':''} as an area.`);
}
function rectForSavedArea(area,x0,y0){ return {x0,y0,x1:x0+area.w-1,y1:y0+area.h-1}; }
function rectFits(r){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++)
    if (!selValidDest(x,y)) return false;
  return true;
}
function clearRectLayers(r){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    const k=`${x},${y}`;
    if (game.plants[k] && !game.plants[k].removed) clearTile('plants',k);
    if (game.bulbs[k] && !game.bulbs[k].removed) clearTile('bulbs',k);
    if (game.terrain[k] && !game.terrain[k].removed) clearTile('terrain',k);
    if (game.elevation[k] && !game.elevation[k].removed) clearTile('elevation',k);
    if (game.fences[k] && !game.fences[k].removed) clearTile('fences',k);
    if (game.lights[k] && !game.lights[k].removed) clearTile('lights',k);
    const fp=firepitAt(x,y);
    if (fp) clearTile('firepits',fp.key);
  }
}
function syncSelectionLayers(){
  syncPlantsOut(); syncBulbsOut(); syncTerrainOut(); syncElevationOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut();
}
function pasteSavedArea(){
  const area=storedArea();
  if (!area || !area.items || !area.items.length){ toast('No saved area yet.'); return; }
  if (!game.sel){ toast('Select where to paste the saved area.'); return; }
  const target=rectForSavedArea(area,game.sel.x0,game.sel.y0);
  if (!rectFits(target)){ toast('Saved area would run off the plot or into a house.'); return; }
  const items=area.items.map(c=>{ const out=cloneCell(c); out.x=target.x0+c.x; out.y=target.y0+c.y; return out; });
  withUndo(()=>{ clearRectLayers(target); selWrite(items,c=>[c.x,c.y],false); });
  syncSelectionLayers();
  game.sel=target;
  game.selItems=selectionPayload(game.sel);
  buildToolTray();
  toast(`Pasted saved area: ${items.length} occupied tile${items.length>1?'s':''}.`);
}
function fillSelectionWithPlant(){
  if (!game.sel){ toast('Select an area first.'); return; }
  const brush=selectedFillBrush();
  if (!brush){ toast('Pick a plant or landscape material first, then return to Select.'); return; }
  const {tool,toolVar,plantDef:def}=brush;
  const oldTool=game.tool, oldVar=game.toolVar, oldDrift=game.drift;
  let placed=0, what=null;
  withUndo(()=>{
    game.tool=tool; game.toolVar=toolVar; game.drift=false;
    for (let y=game.sel.y0;y<=game.sel.y1;y++) for (let x=game.sel.x0;x<=game.sel.x1;x++){
      const k=`${x},${y}`;
      const oldPlant=def&&game.plants[k]?cloneCell(game.plants[k]):null;
      const oldBulb=def&&game.bulbs[k]?cloneCell(game.bulbs[k]):null;
      if (def && def.type==='bulb'){
        if (oldBulb && !oldBulb.removed) clearTile('bulbs',k);
      } else if (def) {
        if (oldPlant && !oldPlant.removed) clearTile('plants',k);
      }
      const r=applyToolAt(x,y);
      if (r){ placed++; what=r; }
      else if (def) {
        if (oldPlant) setTile('plants',k,oldPlant);
        if (oldBulb) setTile('bulbs',k,oldBulb);
      }
    }
    game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  });
  game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  if (placed){
    syncToolLayer(what);
    game.selItems=selectionPayload(game.sel);
    toast(`Filled ${placed} tile${placed>1?'s':''} with ${brush.label}.`);
  } else toast(`No open spots for ${brush.label} in that selection.`);
  buildToolTray(); refreshCanvasTools();
}
// write items to their destination tiles (getDst(cell)->[x,y]); clearSource
// first wipes the originals (move) — skipped for copy
function selWrite(items, getDst, clearSource){
  if (clearSource){
    for (const c of items){ const k=`${c.x},${c.y}`;
      if (c.plant) clearTile('plants',k);
      if (c.bulb)  clearTile('bulbs',k);
      if (c.terr)  clearTile('terrain',k);
      if (c.elev)  clearTile('elevation',k);
      if (c.fence) clearTile('fences',k);
      if (c.light) clearTile('lights',k);
      if (c.firepit) clearTile('firepits',k);
    }
  }
  const now=Date.now();
  for (const c of items){ const [nx,ny]=getDst(c); const k=`${nx},${ny}`;
    if (c.plant) setTile('plants',k,Object.assign({},c.plant,{t:now}));
    if (c.bulb)  setTile('bulbs',k,Object.assign({},c.bulb,{t:now}));
    if (c.terr)  setTile('terrain',k,Object.assign({},c.terr,{t:now}));
    if (c.elev)  setTile('elevation',k,Object.assign({},c.elev,{t:now}));
    if (c.fence) setTile('fences',k,Object.assign({},c.fence,{t:now}));
    if (c.light) setTile('lights',k,Object.assign({},c.light,{t:now}));
    if (c.firepit) setTile('firepits',k,Object.assign({},c.firepit,{t:now}));
  }
  const layers=items.reduce((a,c)=>{ if(c.plant)a.p=1; if(c.bulb)a.b=1; if(c.terr)a.t=1; if(c.elev)a.e=1; if(c.fence)a.f=1; if(c.light)a.l=1; if(c.firepit)a.fp=1; return a;},{});
  if (layers.p) syncPlantsOut();
  if (layers.b) syncBulbsOut();
  if (layers.t) syncTerrainOut();
  if (layers.e) syncElevationOut();
  if (layers.f) syncFencesOut();
  if (layers.l) syncLightsOut();
  if (layers.fp) syncFirepitsOut();
}
// commit a move or copy by tile offset; returns true if applied. Operates on
// the selection's OWNED items (game.selItems), not whatever is in the rect now
function commitSelectionOffset(dx,dy,copy){
  if (!game.sel || (dx===0&&dy===0 && !copy)) return false;
  const items=game.selItems||[];
  if (!items.length) return false;
  const dst=c=>[c.x+dx,c.y+dy];
  if (items.some(c=>{ const [x,y]=dst(c); return !selItemValidDest(c,x,y); })){
    toast('That spot runs off the plot or into the house.'); return false;
  }
  withUndo(()=>selWrite(items, dst, !copy));
  items.forEach(c=>{ c.x+=dx; c.y+=dy; });   // the selection now owns the moved/copied tiles
  game.sel={x0:game.sel.x0+dx,y0:game.sel.y0+dy,x1:game.sel.x1+dx,y1:game.sel.y1+dy};
  toast(copy?`Duplicated ${items.length} tile${items.length>1?'s':''}.`
            :`Moved ${items.length} tile${items.length>1?'s':''}.`);
  return true;
}
// rotate the selection's owned contents 90° clockwise about the rect center
function rotateSelection(){
  if (!game.sel) return;
  const r=game.sel, items=game.selItems||[];
  if (!items.length){ toast('Nothing in the selection to rotate.'); return; }
  const cx2=(r.x0+r.x1)/2, cy2=(r.y0+r.y1)/2;
  const rot=(x,y)=>[Math.round(cx2-(y-cy2)), Math.round(cy2+(x-cx2))];
  if (items.some(c=>{ const [x,y]=rot(c.x,c.y); return !selItemValidDest(c,x,y); })){
    toast('Rotated selection would leave the plot.'); return;
  }
  withUndo(()=>selWrite(items, c=>rot(c.x,c.y), true));
  items.forEach(c=>{ const [nx,ny]=rot(c.x,c.y); c.x=nx; c.y=ny; });
  // new bounding box: width/height swap about the center
  const hw=(r.x1-r.x0)/2, hh=(r.y1-r.y0)/2;
  game.sel={x0:Math.round(cx2-hh),y0:Math.round(cy2-hw),
            x1:Math.round(cx2+hh),y1:Math.round(cy2+hw)};
  toast(`Rotated ${items.length} tile${items.length>1?'s':''}.`);
}
function eraseSelection(){
  if (!game.sel) return;
  const items=game.selItems||[];
  if (!items.length){ toast('Nothing in the selection to erase.'); clearSelection(); return; }
  withUndo(()=>{
    for (const c of items){ const k=`${c.x},${c.y}`;
      if (c.plant) clearTile('plants',k);
      if (c.bulb)  clearTile('bulbs',k);
      if (c.terr)  clearTile('terrain',k);
      if (c.elev)  clearTile('elevation',k);
      if (c.fence) clearTile('fences',k);
      if (c.light) clearTile('lights',k);
      if (c.firepit) clearTile('firepits',k);
    }
    syncPlantsOut(); syncBulbsOut(); syncTerrainOut(); syncElevationOut(); syncFencesOut(); syncLightsOut(); syncFirepitsOut(); });
  toast(`Erased ${items.length} tile${items.length>1?'s':''}.`);
  clearSelection();
}
function clearSelection(){ game.sel=null; game.selItems=null; selDrag=null; selMove=null; buildToolTray(); }
function selPointerDown(x,y,e){
  try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
  if (inRect(game.sel,x,y)){            // grab the selection to move/copy it
    selMove={grabX:x,grabY:y,curX:x,curY:y,copy:game.selMode==='copy'};
  } else {                              // start a fresh marquee
    selDrag={x0:x,y0:y,x1:x,y1:y};
    if (game.sel){ game.sel=null; game.selItems=null; buildToolTray(); }
  }
}
function selPointerMove(x,y){
  if (selDrag){ selDrag.x1=x; selDrag.y1=y; return true; }
  if (selMove){ selMove.curX=x; selMove.curY=y; return true; }
  return false;
}
function selPointerUp(){
  if (selDrag){
    game.sel=normRect({x:selDrag.x0,y:selDrag.y0},{x:selDrag.x1,y:selDrag.y1});
    // the selection OWNS exactly what was in the box when it was drawn — it
    // won't scoop up items that later end up inside the rect
    game.selItems=selectionPayload(game.sel);
    selDrag=null; buildToolTray();
    return;
  }
  if (selMove){
    const dx=selMove.curX-selMove.grabX, dy=selMove.curY-selMove.grabY;
    const copy=selMove.copy; selMove=null;
    if (dx||dy) commitSelectionOffset(dx,dy,copy);
    buildToolTray();
  }
}
function evPlacement(e){ // pointer position -> owning world tile + sub-tile offset
  const W=VW/ZOOM, H=VH/ZOOM;
  const sx=e.clientX/ZOOM, sy=e.clientY/ZOOM;
  const [wx,wy]=worldPointAt(sx, sy, W, H);
  const [x,y]=tileAt(sx, sy, W, H);
  return {x,y,ox:wx-x,oy:wy-y};
}
/* ---------- undo: a stack of plants+bulbs+terrain+house snapshots ----------
   A gesture snapshots state on pointerdown and commits it only if the
   state actually changed by pointerup, so no-op taps don't pile up. */
let spaceHeld=false, panDrag=null, undoStack=[], redoStack=[], pendSnap=null, pendSig=null, pendRev=0;
function updateCanvasCursor(){
  if (!cnv) return;
  cnv.style.cursor = panDrag ? 'grabbing'
    : (game.tool==='hand'||spaceHeld) ? 'grab'
    : (game.tool==='select'||game.tool==='pick') ? 'crosshair' : '';
}
// Cheap structural hash of every layer for undo change-detection — folds keys
// and values into one number, so begin/commit no longer JSON-serialize (and
// allocate + string-compare) the whole garden twice per gesture. A true
// revision counter would be cleaner, but reliably bumping it needs a single
// mutation chokepoint (the deferred refactor #3); this gets the same win
// centrally, without scattering rev++ across every write site.
function stateSig(){
  let h=2166136261;
  const mix=n=>{ h^=n|0; h=Math.imul(h,16777619); };
  const fold=v=>{
    if (v==null){ mix(1); return; }
    const t=typeof v;
    if (t==='number'){ mix(v|0); mix((v*4096)|0); }
    else if (t==='boolean'){ mix(v?3:2); }
    else if (t==='string'){ for (let i=0;i<v.length;i++) mix(v.charCodeAt(i)); mix(v.length); }
    else if (Array.isArray(v)){ for (let i=0;i<v.length;i++) fold(v[i]); mix(v.length); }
    else for (const k in v){ for (let i=0;i<k.length;i++) mix(k.charCodeAt(i)); fold(v[k]); }
  };
  for (const L of GAME_LAYERS) fold(game[L.k]);
  return h>>>0;
}
function snapshotState(){
  const s={};
  for (const L of GAME_LAYERS) s[L.k]=JSON.parse(JSON.stringify(game[L.k]||(L.array?[]:{})));
  return s;
}
// a new action invalidates the redo chain (standard undo/redo semantics)
function pushUndo(snap){ undoStack.push(snap); if (undoStack.length>30) undoStack.shift();
  redoStack.length=0; updateUndoBtn(); }
// Did the model change since the marker? game.rev (bumped by setTile/clearTile)
// is the O(1) fast path; the structural hash is the fallback for the few sites
// not yet routed through those helpers (the selection subsystem), so undo stays
// correct everywhere while common edits skip the hash via || short-circuit.
function changedSince(rev,sig){ return game.rev!==rev || stateSig()!==sig; }
function beginUndo(){ pendRev=game.rev; pendSig=stateSig(); pendSnap=snapshotState(); }
function commitUndo(){ if (pendSig!==null && changedSince(pendRev,pendSig)) pushUndo(pendSnap); pendSig=null; pendSnap=null; }
function cancelPendingUndo(restore){
  if (restore && pendSnap && pendSig!==null && changedSince(pendRev,pendSig)) applySnapshot(pendSnap);
  pendSig=null; pendSnap=null;
}
function withUndo(fn){ const rev=game.rev, sig=stateSig(), snap=snapshotState(); fn();
  if (changedSince(rev,sig)) pushUndo(snap); }
function applySnapshot(s){ // restore every layer + refresh UI
  for (const L of GAME_LAYERS) game[L.k]=s[L.k]||(L.array?[]:{});
  markModelChanged(); updateUndoBtn();
  if (game.mode==='multi') for (const L of GAME_LAYERS) L.sync();
  buildToolTray();
}
function doUndo(){
  if (!undoStack.length){ toast('Nothing to undo.'); return; }
  redoStack.push(snapshotState()); if (redoStack.length>30) redoStack.shift();
  applySnapshot(undoStack.pop()); toast('Undone.');
}
function doRedo(){
  if (!redoStack.length){ toast('Nothing to redo.'); return; }
  undoStack.push(snapshotState()); if (undoStack.length>30) undoStack.shift();
  applySnapshot(redoStack.pop()); toast('Redone.');
}
function updateUndoBtn(){
  // Undo/Redo live in the canvas rail now; their greyed state is recomputed from
  // undoStack/redoStack each time the rail is (re)built.
  refreshCanvasTools();
}
