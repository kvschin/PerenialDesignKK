'use strict';

/* ---------- placement policy ---------- */
const PLANT_PLACEMENT_POLICY={
  occupancy:{mode:'hard'},
  shrubCore:{mode:'hard'},
  woodyTrunk:{mode:'hard'},
  water:{mode:'hard'},
  activeCanopySun:{mode:'soft',toast:'warn'},
  treeSpacing:{mode:'soft',toast:'warn'},
};
function placementPolicy(rule){ return PLANT_PLACEMENT_POLICY[rule] || {mode:'hard'}; }
function canopyShadePolicyCheck(def,x,y){
  if (!def || def.sun==='part') return null;
  const shadeTree=shadeInfoAt(x,y,false,true);   // rules read true establishment
  return shadeTree ? {rule:'activeCanopySun',policy:placementPolicy('activeCanopySun'),shade:shadeTree} : null;
}
function canopyShadeHardBlock(def,x,y){
  const check=canopyShadePolicyCheck(def,x,y);
  return check && check.policy.mode==='hard' ? check : null;
}
function canopyShadeSoftWarning(def,x,y){
  const check=canopyShadePolicyCheck(def,x,y);
  return check && check.policy.mode==='soft' ? check : null;
}
function canopyShadeTreeName(check){
  return PLANTS[check.shade.p.s].name.toLowerCase();
}
function canopyShadeHardMessage(def,check){
  return `Active canopy shade from the ${canopyShadeTreeName(check)} — ${def.type==='water'?'part-shade water plants':'shade-tolerant plants'} only.`;
}
function canopyShadeWarningText(check){
  return `active canopy shade from the ${canopyShadeTreeName(check)}; it will struggle here`;
}
function appendPlacementWarning(base,text){
  const clean=base.replace(/\.$/,'');
  return `${clean}${clean.includes(' — ')?';':' —'} ${text}.`;
}
function plantPlacedMessage(def,x,y,k,shadeWarn,water){
  const base=water ? `Planted ${def.name} in the water.`
    : isTreeDef(def) ? treePlacedMessage(def,x,y,k)
    : `Planted ${def.name}.${!shadeWarn && (def.type==='forb'||def.type==='grass')?' Drifts of 3+ read better — try the Drift toggle.':''}`;
  return shadeWarn ? appendPlacementWarning(base,canopyShadeWarningText(shadeWarn)) : base;
}
function plantPlacementToastKind(def,x,y,k,shadeWarn){
  if (shadeWarn) return shadeWarn.policy.toast;
  if (isTreeDef(def) && nearestTreeCrowder(x,y,def,k)) return placementPolicy('treeSpacing').toast;
  return null;
}
function rejectPlacement(msg){ hapticFeedback('invalid'); toast(msg); }

/* ---------- actions ----------
   The tile a tap or the E key addresses. There is no avatar: game.actX/actY is
   simply the last tile the canvas pointed at. */
function actHere(opts){
  const x=Math.round(game.actX), y=Math.round(game.actY), k=`${x},${y}`;
  if (isPlacementTool(game.tool)){
    const layer=toolTargetLayer(game.tool);
    if (blockIfWrongEditLayer(layer)) return;
    if (layer && !layerShown(layer)){ promptRevealLayer(layer,x,y); return; }
  }
  if (isDoor(x,y)){ toast('The doorstep is just scenery for now.'); return; }
  if (game.tool==='house'){ toast('Tap the spot where the house should stand.'); return; }
  if (game.tool==='building'){ toast('Tap exterior corners, then close the outline.'); return; }
  if (game.tool==='fence'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fence needs clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ hapticFeedback('place'); toast(`${fenceLabel()} placed.`); }
    else rejectPlacement('Fence needs clear dry ground.');
    return;
  }
  if (game.tool==='light'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Lighting needs clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ hapticFeedback('place'); toast(`${lightLabel()} placed.`); }
    else rejectPlacement('Lighting needs a clear dry tile.');
    return;
  }
  if (game.tool==='firepit'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Fire pits need clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ hapticFeedback('place'); toast(`${firepitLabel()} placed.`); }
    else rejectPlacement('Fire pit needs clear dry ground.');
    return;
  }
  if (game.tool==='boulder'){
    const sh=shrubAt(x,y);
    if (sh){ pulseShrubFootprint(sh); toast('Boulders need clear ground outside the shrub spread.'); return; }
    const r=applyToolAt(x,y,opts);
    if (r){ hapticFeedback('place'); toast(`${boulderLabel()} placed.`); }
    else rejectPlacement('Boulder needs clear dry ground.');
    return;
  }
  if (game.tool==='pet'){
    const r=applyToolAt(x,y,opts);
    if (r){ hapticFeedback('place'); toast(`A ${petLabel()} settles in.`); }
    else rejectPlacement('Not a spot a pet would settle — try clear ground.');
    return;
  }
  if (isElevationTool(game.tool)){
    const before=elevationAt(x,y);
    if (stampBrushAt(x,y)){
      hapticFeedback('place');
      const after=elevationAt(x,y);
      toast(game.tool==='level' ? 'Leveled ground.' : `Elevation ${after>before?'raised':'lowered'} to ${after}.`);
    } else {
      rejectPlacement(game.tool==='raise' ? 'Already at the highest elevation.'
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
    const counts={plants:0,bulbs:0,terr:0,elev:0,house:0,building:0,fence:0,light:0,firepit:0,boulder:0,pet:0};
    eraseBrush(x,y,counts);
    const parts=[];
    if (counts.plants) parts.push(`${counts.plants} plant${counts.plants>1?'s':''}`);
    if (counts.bulbs) parts.push(`${counts.bulbs} bulb${counts.bulbs>1?'s':''}`);
    if (counts.terr) parts.push(`${counts.terr} terrain tile${counts.terr>1?'s':''}`);
    if (counts.elev) parts.push(`${counts.elev} elevation tile${counts.elev>1?'s':''}`);
    if (counts.fence) parts.push(`${counts.fence} fence${counts.fence>1?'s':''}`);
    if (counts.light) parts.push(`${counts.light} light${counts.light>1?'s':''}`);
    if (counts.firepit) parts.push(`${counts.firepit} fire pit${counts.firepit>1?'s':''}`);
    if (counts.boulder) parts.push(`${counts.boulder} boulder${counts.boulder>1?'s':''}`);
    if (counts.pet) parts.push(counts.pet>1?`${counts.pet} pets`:'a pet');
    if (counts.house) parts.push(`${counts.house} house${counts.house>1?'s':''}`);
    if (counts.building) parts.push(`${counts.building} building footprint${counts.building>1?'s':''}`);
    if (parts.length){
      toast(`Erased ${parts.join(' and ')}.`);
    } else toast('Nothing to erase here.');
    return;
  }
  if (toolMeta(game.tool).material){
    if (hasPlant){ toast('Lift the plant first.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Lift the shrub first — its mature spread claims this ground.'); return; }
    if (hasBulb && game.tool==='water'){ toast('Dig the bulb first.'); return; }
    if (game.tool==='water' && fenceAt(x,y)){ toast('Move the fence before making water.'); return; }
    if (game.tool==='water' && lightAt(x,y)){ toast('Move the light before making water.'); return; }
    if (game.tool==='water' && petAt(x,y)){ toast('Move your pet before making water.'); return; }
    if (firepitAt(x,y)){ toast('Move the fire pit before changing the ground.'); return; }
    if (boulderAt(x,y)){ toast('Move the boulder before changing the ground.'); return; }
    const wasSame=terr===game.tool;
    const r=stampBrushAt(x,y,opts);
    if (r){
      hapticFeedback('place');
      toast(game.tool==='path'
        ? (wasSame?`${pathColor(game.pathColor).label} path color applied.`:`${pathColor(game.pathColor).label} path laid.`)
        : game.tool==='water'
        ? (wasSame?`${waterStyle(game.waterStyle).label} water applied.`:`${waterStyle(game.waterStyle).label} water laid.`)
        : (wasSame?`${bedStyle(game.bedStyle).label} bed applied.`:`${bedStyle(game.bedStyle).label} bed dug. Ready for planting.`));
      return;
    }
    rejectPlacement(terr===game.tool
      ? (terr==='path'?'Already a path.':terr==='water'?'Already water.':'Already a bed.')
      : 'Needs clear ground.');
    return;
  }
  if (fenceAt(x,y)){ toast('Fence is in the way.'); return; }
  if (lightAt(x,y)){ toast('A light is in the way.'); return; }
  if (firepitAt(x,y)){ toast('A fire pit is in the way.'); return; }
  if (boulderAt(x,y)){ toast('A boulder is in the way.'); return; }
  const def=PLANTS[game.tool] ? plantDef(game.tool,game.toolVar) : null;
  if (!def) return;
  if (def.type==='water'){
    if (terr!=='water'){ toast('Water plants need a pond, river, or lake tile.'); return; }
    if (hasPlant){ showPlantCard(existing,x,y); return; }
    if (hasBulb){ toast('Lift the bulb before planting in water.'); return; }
    if (shrubHit){ pulseShrubFootprint(shrubHit); toast('Water plants need open water outside the shrub spread.'); return; }
    const shadeBlock=canopyShadeHardBlock(def,x,y);
    if (shadeBlock){
      toast(canopyShadeHardMessage(def,shadeBlock));
      return;
    }
    const shadeWarn=canopyShadeSoftWarning(def,x,y);
    const n=game.drift?driftCount(def):1;
    if (n>1){ stampDrift(x,y,n,opts); return; }
    if (applyToolAt(x,y,opts)){ hapticFeedback('place'); toast(plantPlacedMessage(def,x,y,k,shadeWarn,true),plantPlacementToastKind(def,x,y,k,shadeWarn)); }
    else rejectPlacement('No open water here.');
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
    if (applyToolAt(x,y,opts)){ hapticFeedback('place');
      toast(`Tucked in ${def.name} — it shows at first thaw.`); }
    else rejectPlacement('No spot for a bulb here.');
    return;
  }
  if (terr==='path'||terr==='water'){ toast(terr==='water'?'Dry land first — land plants and ponds disagree.':'Dig the path up first — plants and gravel disagree.'); return; }
  if (shrubHit && !isShrubDef(def) && (!hasPlant || shrubHit.key!==k)){
    pulseShrubFootprint(shrubHit);
    showPlantCard(shrubHit.p,shrubHit.x,shrubHit.y);
    toast(`${plantDef(shrubHit.p.s,shrubHit.p.v).name} needs this mature spread.`);
    return;
  }
  if (hasPlant){ showPlantCard(existing,x,y); return; }
  const shadeBlock=canopyShadeHardBlock(def,x,y);
  if (shadeBlock){
    toast(canopyShadeHardMessage(def,shadeBlock));
    return;
  }
  const shadeWarn=canopyShadeSoftWarning(def,x,y);
  const n=game.drift?driftCount(def):1;
  if (n>1){ stampDrift(x,y,n,opts); return; }
  if (applyToolAt(x,y,opts)){ hapticFeedback('place');
    toast(plantPlacedMessage(def,x,y,k,shadeWarn,false),plantPlacementToastKind(def,x,y,k,shadeWarn)); }
  else rejectPlacement('No room here.');
}
/* soft tree-spacing feedback (T3): the trunk placed fine (occupancy guaranteed
   its tile was clear); if it landed inside a nearby tree's spacing, say so in
   real feet — advice, not a block, so the design still stands. */
function treePlacedMessage(def,x,y,k){
  const crowd=nearestTreeCrowder(x,y,def,k);
  if (!crowd) return `Planted ${def.name}.`;
  const wantFt=Math.max(1,Math.round(crowd.wantTiles*TILE_IN/12));
  const other=plantDef(crowd.p.s,crowd.p.v);
  return crowd.p.s===game.tool
    ? `Planted ${def.name} — but it crowds another ${def.name}. They want about ${wantFt} ft apart at maturity.`
    : `Planted ${def.name} — it will crowd the nearby ${other.name.toLowerCase()}. Give large trees about ${wantFt} ft of room.`;
}
/* Fires once per successfully placed plant or bulb, and only there — undo,
   paste and loading a garden never call it. That makes it the one honest place
   to count what the gardener has actually planted, which the coach beats
   (ui.js) thread their timing off. */
function plantFx(x,y,p){ const o=plantOffset(p); game.fx.push({x,y,ox:o.ox,oy:o.oy,t0:performance.now()});
  coachNotePlanting();
  /* Counted here rather than per gesture, so the number is plants and not taps.
     This runs once per placed TILE — a fat drag is dozens inside one frame — so
     funnel() only bumps a counter; funnelFlush does the serialising, later. */
  funnel(FUNNEL_EVENTS.plantPlaced); }
function freePlantable(def){ return !!(game.freePlanting && def && def.type!=='bulb' && !isWoodyDef(def)); }
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
  if (isWoodyDef(def)) return 1;
  return def.space<=6?9 : def.space<=12?7 : def.space<=18?5 : def.space<=30?3 : 1;
}
/* the one silent placer behind drifts, drags, and single planting: puts the
   armed tool on a tile if it fits, no toasts. Dispatches through the tool's
   apply hook (see the TOOLS table in tray.js); returns what it placed
   ('plant'|'bulb'|'path'|'bed'|'water'|'fence'|'gate'|'light'|'elevation') or
   null. The universal guards (off-plot, house/door) live here so every hook
   inherits them; tools without a hook (hand/select/pick/erase/house) no-op. */
function applyToolAt(x,y,opts){
  if (!onPlot(x,y)) return null;
  if (siteStructureAt(x,y) || isDoor(x,y)) return null;
  const meta=toolMeta(game.tool);
  return meta.apply ? meta.apply(x,y,opts) : null;
}
/* stamp the armed brush across its disc footprint (game.brushSize) for the
   sizable tools — path/bed/water and the raise/lower/level brushes. Plants
   aren't sizable (a solid disc would violate spacing; that's the Matrix
   brush's job), so they fall through to a single applyToolAt. Returns the
   last non-null 'what', matching applyToolAt's contract, so the tap/drag
   toast + sync paths are unchanged. Fill and drift keep calling applyToolAt
   directly — they already cover an area, so the brush disc doesn't apply. */
function toolBrushSize(){ return toolMeta(game.tool).sizable ? normalizeBrushSize(game.brushSize) : 1; }
function stampBrushAt(x,y,opts){
  const size=toolBrushSize();
  if (size===1) return applyToolAt(x,y,opts);
  let what=null;
  for (const [dx,dy] of brushOffsets(size)){
    const r=applyToolAt(x+dx,y+dy,(dx===0&&dy===0)?opts:null);
    if (r) what=r;
  }
  return what;
}
// path/bed/water: lay or repaint a ground material on a tile
function placeTerrainAt(x,y){
  const k=`${x},${y}`, terrObj=terrainAt(x,y), terr=terrObj&&terrObj.k;
  const ex=game.plants[k], eb=game.bulbs[k];
  if (ex && !ex.removed) return null;
  if (shrubAt(x,y)) return null;
  if (game.tool==='water' && fenceAt(x,y)) return null;
  if (game.tool==='water' && lightAt(x,y)) return null;
  if (game.tool==='water' && petAt(x,y)) return null;
  if (firepitAt(x,y)) return null;
  if (boulderAt(x,y)) return null;
  if (game.tool==='water' && eb && !eb.removed) return null;
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
// Matrix scatter: keep new plantings of the SAME species at least their real
// spacing apart, so a dragged/filled region self-thins to a natural stand and
// flows around whatever's already there — plant the feature forbs first, then
// fill the grass matrix into the gaps (two-layer interplanting). Woody/bulb/
// water types opt out (they place normally even with Matrix armed).
function matrixSpacingBlocks(x,y,def){
  if (isWoodyDef(def)||def.type==='bulb'||def.type==='water') return false;
  const spaceT=Math.max(1,Math.round((def.space||TILE_IN)/TILE_IN));
  for (let dy=-spaceT;dy<=spaceT;dy++) for (let dx=-spaceT;dx<=spaceT;dx++){
    if ((!dx&&!dy) || Math.hypot(dx,dy)>spaceT+1e-6) continue;
    const q=game.plants[`${x+dx},${y+dy}`];
    if (q && !q.removed && q.s===game.tool) return true;
  }
  return false;
}
// plant/bulb/water-plant: drop the armed species on a tile if it fits
function placePlantAt(x,y,opts){
  const k=`${x},${y}`, terrObj=terrainAt(x,y), terr=terrObj&&terrObj.k;
  const def=plantDef(game.tool,game.toolVar);
  if (fenceAt(x,y)) return null;
  if (lightAt(x,y)) return null;
  if (firepitAt(x,y)) return null;
  if (boulderAt(x,y)) return null;
  const np={s:game.tool,d:woodyPlantedDay(def,game.woodyAge),t:Date.now()};   // woody: age-at-placement (T10)
  if (game.toolVar) np.v=game.toolVar;
  if (def.type==='water'){
    const ex=game.plants[k], eb=game.bulbs[k];
    if (terr!=='water') return null;
    if ((ex && !ex.removed) || (eb && !eb.removed)) return null;
    if (shrubAt(x,y)) return null;
    if (canopyShadeHardBlock(def,x,y)) return null;
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
  if (game.matrix && matrixSpacingBlocks(x,y,def)) return null;   // scatter at real spacing
  if (!isShrubDef(def) && shrubAt(x,y)) return null;
  if (isShrubDef(def) && !canPlaceShrubAt(x,y,np).ok) return null;
  if (canopyShadeHardBlock(def,x,y)) return null;
  if (freePlantable(def)) Object.assign(np,naturalPlantOffset(x,y,opts));
  setTile('plants',k,np); plantFx(x,y,np);
  // a tree or shrub claims the ground — any bulb tucked under it is lost
  if (isShrubDef(def)) clearBulbsUnderShrub(x,y,np);
  else if (isTreeDef(def)){ const eb=game.bulbs[k];
    if (eb && !eb.removed) clearTile('bulbs',k); }
  return 'plant';
}
function stampDrift(cx0,cy0,n,opts){
  const offs=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
              [2,0],[0,2],[-2,0],[0,-2],[2,1],[1,2],[-1,2],[-2,1]];
  const rest=offs.slice(1); // keep the clicked tile first, shuffle the rest
  for (let i=rest.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0;
    [rest[i],rest[j]]=[rest[j],rest[i]]; }
  const def=plantDef(game.tool,game.toolVar);
  let placed=0;
  for (const [ox,oy] of [offs[0],...rest]){
    if (placed>=n) break;
    if (applyToolAt(cx0+ox,cy0+oy,(!ox&&!oy)?opts:null)) placed++;
  }
  if (placed){ hapticFeedback('place');
    toast(placed>1?`A drift of ${placed} — ${def.name}.`:`Planted ${def.name} — no room for more here.`); }
  else toast('No room for a drift here.');
}
/* ---------- fence / structure placement ---------- */
function fenceDraft(){ return game.fenceDraft=normalizeFenceDraft(game.fenceDraft); }
function fenceLabel(f){
  const d=f||fenceDraft();
  return `${d.height}' ${fenceStyle(d.style).label}${d.gate?' gate':' fence'}`;
}
function canPlaceFence(x,y){
  if (!onPlot(x,y)) return false;
  if (siteStructureAt(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water' || lightAt(x,y) || firepitAt(x,y) || boulderAt(x,y)) return false;
  if (shrubAt(x,y)) return false;
  const d=fenceDraft();
  const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
  return !(p&&!p.removed) && !(b&&!b.removed);
}
function placeFenceAt(x,y){
  if (!canPlaceFence(x,y)) return null;
  const d=normalizeFenceDraft(fenceDraft()), k=`${x},${y}`, now=Date.now();
  const next={style:d.style,height:d.height,gate:!!d.gate,t:now};
  const cur=fenceAt(x,y);
  if (cur && cur.style===next.style && cur.height===next.height && !!cur.gate===next.gate) return null;
  setTile('fences',k,next);
  return next.gate?'gate':'fence';
}
function canPlaceLight(x,y){
  if (!onPlot(x,y)) return false;
  if (siteStructureAt(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water') return false;
  if (fenceAt(x,y) || firepitAt(x,y) || boulderAt(x,y) || shrubAt(x,y)) return false;
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
function lightAt(x,y){ const l=game.lights&&game.lights[`${x},${y}`]; return (l&&!l.removed)?l:null; }
function lightDraft(){ return game.lightDraft=normalizeLightDraft(game.lightDraft); }
function lightLabel(l){
  const d=l||lightDraft();
  return `${lightTone(d.tone).label} ${lightType(d.type).label}`;
}
/* Garden pets. A pet is pure ornament and the one placeable thing that claims
   NOTHING: no footprint, no shade, no spacing, no line on the plan or the
   planting list, and — deliberately — no hold on its own tile. Planting is
   unaffected by where the cat is sitting, which is the whole point: adding a
   pet can never change what the design will take. The rule is only "somewhere
   it could plausibly sit" — on the lot, out of the water, off the hardscape.
   It refuses a solid fence run but is happy in a gate opening, hence
   `fenceBlocks` rather than `fenceAt`, and it may curl up under a shrub or in
   the middle of a drift. */
function canPlacePet(x,y){
  if (!onPlot(x,y)) return false;
  if (siteStructureAt(x,y) || isDoor(x,y) || tileTerrain(x,y)==='water') return false;
  return !fenceBlocks(x,y) && !lightAt(x,y) && !firepitAt(x,y) && !boulderAt(x,y);
}
function placePetAt(x,y){
  if (!canPlacePet(x,y)) return null;
  const d=normalizePetDraft(petDraft()), k=`${x},${y}`;
  const cur=petAt(x,y);
  if (cur && cur.species===d.species && cur.coat===d.coat && cur.mark===d.mark) return null;
  setTile('pets',k,Object.assign({},d,{t:Date.now()}));
  return 'pet';
}
function petAt(x,y){ const p=game.pets&&game.pets[`${x},${y}`]; return (p&&!p.removed)?p:null; }
function petDraft(){ return game.petDraft=normalizePetDraft(game.petDraft); }
function petLabel(p){
  const d=normalizePetDraft(p||petDraft());
  const mark=d.mark==='solid' ? '' : `${petMark(d.mark).label.toLowerCase()} `;
  const paw=petPaw(d.paws);
  const socks=paw.c ? ` with ${paw.label.toLowerCase()} socks` : '';
  return `${petCoat(d.coat).label.toLowerCase()} ${mark}${petSpecies(d.species).label.toLowerCase()}${socks}`;
}
function firepitShapeName(f){
  const d=normalizeFirepitDraft(f||firepitDraft()), s=firepitSize(d.size,d.shape);
  return d.shape==='round' ? 'round' : (s.wIn===s.hIn ? 'square' : 'rectangular');
}
function firepitDraft(){ return game.firepitDraft=normalizeFirepitDraft(game.firepitDraft); }
function firepitLabel(f){
  const d=normalizeFirepitDraft(f||firepitDraft()), s=firepitSize(d.size,d.shape);
  return `${s.plan} ${firepitShapeName(d)} fire pit`;
}
function firepitAt(x,y){
  if (!game.firepits) return null;
  for (const k in game.firepits){
    const f=game.firepits[k]; if (!f || f.removed) continue;
    const [fx,fy]=k.split(',').map(Number), sz=firepitTileSize(f);
    if (x>=fx && x<fx+sz.w && y>=fy && y<fy+sz.h)
      return Object.assign({key:k,x:fx,y:fy},f);
  }
  return null;
}
function firepitFootprint(x,y,f){
  const sz=firepitTileSize(f), tiles=[];
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++) tiles.push([xx,yy]);
  return tiles;
}
function canPlaceFirepit(x,y,ignoreKey){
  const d=firepitDraft(), sz=firepitTileSize(d);
  if (x<0||y<0||x+sz.w>GW||y+sz.h>GH) return false;
  for (const [xx,yy] of firepitFootprint(x,y,d)){
    if (!onPlot(xx,yy)) return false;
    const k=`${xx},${yy}`;
    if (siteStructureAt(xx,yy) || isDoor(xx,yy) || tileTerrain(xx,yy)==='water') return false;
    if (fenceAt(xx,yy) || lightAt(xx,yy) || boulderAt(xx,yy) || shrubAt(xx,yy)) return false;
    const fp=firepitAt(xx,yy); if (fp && fp.key!==ignoreKey) return false;
    const p=game.plants[k], b=game.bulbs[k];
    if ((p&&!p.removed) || (b&&!b.removed)) return false;
  }
  return true;
}
function placeFirepitAt(x,y){
  if (!game.firepits) game.firepits={};
  const d=normalizeFirepitDraft(firepitDraft()), k=`${x},${y}`;
  const cur=game.firepits[k];
  if (cur && !cur.removed && cur.shape===d.shape && cur.size===d.size) return null;
  if (!canPlaceFirepit(x,y,k)) return null;
  setTile('firepits',k,Object.assign({},d,{t:Date.now()}));
  return 'firepit';
}
function boulderDraft(){ return game.boulderDraft=normalizeBoulderDraft(game.boulderDraft); }
function boulderLabel(b){
  const d=normalizeBoulderDraft(b||boulderDraft()), spec=boulderType(d.type);
  return `${spec.label} (${spec.plan})`;
}
function boulderAt(x,y){
  if (!game.boulders) return null;
  for (const k in game.boulders){
    const b=game.boulders[k]; if (!b || b.removed) continue;
    const [bx,by]=k.split(',').map(Number), sz=boulderTileSize(b);
    if (x>=bx && x<bx+sz.w && y>=by && y<by+sz.h)
      return Object.assign({key:k,x:bx,y:by},b);
  }
  return null;
}
function boulderFootprint(x,y,b){
  const sz=boulderTileSize(b), tiles=[];
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++) tiles.push([xx,yy]);
  return tiles;
}
function canPlaceBoulder(x,y,ignoreKey){
  const d=boulderDraft(), sz=boulderTileSize(d);
  if (x<0||y<0||x+sz.w>GW||y+sz.h>GH) return false;
  for (const [xx,yy] of boulderFootprint(x,y,d)){
    if (!onPlot(xx,yy)) return false;
    const k=`${xx},${yy}`;
    if (siteStructureAt(xx,yy) || isDoor(xx,yy) || tileTerrain(xx,yy)==='water') return false;
    if (fenceAt(xx,yy) || lightAt(xx,yy) || firepitAt(xx,yy) || shrubAt(xx,yy)) return false;
    const bo=boulderAt(xx,yy); if (bo && bo.key!==ignoreKey) return false;
    const p=game.plants[k], b=game.bulbs[k];
    if ((p&&!p.removed) || (b&&!b.removed)) return false;
  }
  return true;
}
function placeBoulderAt(x,y){
  if (!game.boulders) game.boulders={};
  const d=normalizeBoulderDraft(boulderDraft()), k=`${x},${y}`;
  const cur=game.boulders[k];
  if (cur && !cur.removed && cur.type===d.type) return null;
  if (!canPlaceBoulder(x,y,k)) return null;
  setTile('boulders',k,Object.assign({},d,{t:Date.now()}));
  return 'boulder';
}

/* ---------- house placement / sizing / paint ---------- */
function normalizeBuildingStyle(d){
  d=d&&typeof d==='object'?d:{};
  return {status:d.status==='proposed'?'proposed':'existing',label:String(d.label||'House').slice(0,32),
    wall:d.wall||'#8a7a60',roof:d.roof||'#9a5f3a'};
}
function buildingStyleDraft(){ return game.buildingStyleDraft=normalizeBuildingStyle(game.buildingStyleDraft); }
function buildingSignedArea(vs){
  let a=0; for (let i=0;i<vs.length;i++){ const p=vs[i],q=vs[(i+1)%vs.length]; a+=p[0]*q[1]-q[0]*p[1]; }
  return a/2;
}
function samePoint(a,b){ return a[0]===b[0]&&a[1]===b[1]; }
function between(v,a,b){ return v>=Math.min(a,b)&&v<=Math.max(a,b); }
function orthSegmentsTouch(a,b,c,d){
  const abH=a[1]===b[1], cdH=c[1]===d[1];
  if (abH===cdH){
    if (abH && a[1]===c[1]) return Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]));
    if (!abH && a[0]===c[0]) return Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));
    return false;
  }
  const h=abH?[a,b]:[c,d], v=abH?[c,d]:[a,b];
  return between(v[0],h[0][0],h[1][0])&&between(h[0],v[0][1],v[1][1]);
}
function buildingOutlineValid(vs){
  if (!Array.isArray(vs)||vs.length<3) return 'Use at least three corners.';
  for (let i=0;i<vs.length;i++){
    const a=vs[i],b=vs[(i+1)%vs.length];
    if (!Number.isInteger(a[0])||!Number.isInteger(a[1])||a[0]<0||a[1]<0||a[0]>GW||a[1]>GH) return 'Keep every corner on the plot.';
    if (samePoint(a,b) || (a[0]!==b[0]&&a[1]!==b[1])) return 'Footprints use straight north/south or east/west edges.';
  }
  if (Math.abs(buildingSignedArea(vs))<1) return 'That outline has no usable area.';
  for (let i=0;i<vs.length;i++) for (let j=i+1;j<vs.length;j++){
    if (j===i+1 || (i===0&&j===vs.length-1)) continue;
    if (orthSegmentsTouch(vs[i],vs[(i+1)%vs.length],vs[j],vs[(j+1)%vs.length])) return 'The outline crosses itself.';
  }
  return '';
}
function validateBuildingFootprint(vs,ignoreId){
  const outline=buildingOutlineValid(vs); if (outline) return {ok:false,msg:outline};
  const draft={vertices:vs}, tiles=buildingTiles(draft);
  if (!tiles.length) return {ok:false,msg:'That outline does not cover a full tile.'};
  for (const [x,y] of tiles){
    if (!onPlot(x,y)) return {ok:false,msg:'The lot line cuts through there.'};
    const k=`${x},${y}`, p=game.plants[k], b=game.bulbs[k];
    if (siteStructureAt(x,y) || buildingAt(x,y,ignoreId)) return {ok:false,msg:'A building cannot overlap another structure.'};
    if ((p&&!p.removed)||(b&&!b.removed)||terrainAt(x,y)||elevationAt(x,y)||fenceAt(x,y)||lightAt(x,y)||firepitAt(x,y)||boulderAt(x,y)||shrubAt(x,y))
      return {ok:false,msg:'Lift plants, paths, and hardscape before drawing a building here.'};
  }
  return {ok:true,tiles};
}
function commitBuildingFootprint(vertices){
  const vs=vertices.map(p=>[p[0],p[1]]), check=validateBuildingFootprint(vs);
  if (!check.ok){ hapticFeedback('invalid'); toast(check.msg,'warn'); return false; }
  const style=buildingStyleDraft();
  addBuilding(Object.assign({id:newId('b'),vertices:vs,t:Date.now()},style));
  hapticFeedback('success');
  toast(`${style.status==='existing'?'Existing':'Proposed'} building footprint added.`);
  return true;
}
function removeBuildingAt(x,y){
  const b=buildingAt(x,y); if (!b) return false;
  const i=game.buildings.indexOf(b); return removeBuildingAtIndex(i);
}
function displacePlants(x,y,w,h){ // a house can't share ground with plants
  let n=0;
  for (const k in game.plants){ const p=game.plants[k];
    if (!p || p.removed) continue;
    const [px2,py2]=k.split(',').map(Number);
    const inside=px2>=x&&px2<x+w&&py2>=y&&py2<y+h;
    const overlaps=isShrubDef(plantDef(p.s,p.v)) && shrubFootprintOverlapsRect(px2,py2,p,x,y,w,h);
    if (inside || overlaps){ clearTile('plants',k); n++; }
  }
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
    const bo=boulderAt(xx,yy);
    if (bo){ clearTile('boulders',bo.key); n++; }
    if (petAt(xx,yy)){ clearTile('pets',k); n++; }
  };
  for (let yy=y;yy<y+h;yy++) for (let xx=x;xx<x+w;xx++) clear(xx,yy);
  clear(x+((w-1)>>1),y+h); // keep the doorstep standable
  return n;
}
// every footprint tile plus the doorstep must sit on the lot — mirrors the
// fence/light/firepit/boulder placers, which each refuse per occupied tile
function houseFootprintOnPlot(x,y,w,h){
  for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++)
    if (!onPlot(xx,yy)) return false;
  return onPlot(x+((w-1)>>1), y+h);
}
function placeHouse(x,y){
  const d=game.houseDraft || (game.houseDraft=defaultDraft());
  const nx=Math.max(0,Math.min(GW-d.w,x)), ny=Math.max(0,Math.min(GH-d.h-1,y));
  if (!houseFootprintOnPlot(nx,ny,d.w,d.h)){ rejectPlacement('The lot line cuts through there.'); return; }
  if (game.houses.some(o=>nx<o.x+o.w&&nx+d.w>o.x&&ny<o.y+o.h&&ny+d.h>o.y)
    || game.buildings.some(b=>buildingTiles(b).some(([bx,by])=>bx>=nx&&bx<nx+d.w&&by>=ny&&by<ny+d.h))){
    rejectPlacement('That overlaps another building.'); return; }
  addHouse({x:nx,y:ny,w:d.w,h:d.h,wall:d.wall,roof:d.roof,sizeFt:d.sizeFt});
  const n=displacePlants(nx,ny,d.w,d.h);
  clearTerrainForHouse(nx,ny,d.w,d.h);
  hapticFeedback('success');
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
function plantMeasure(v,html){
  v=Number(v)||0;
  if (v>=96) return `${Math.max(1,Math.round(v/12))} ft`;
  return `${Math.max(1,Math.round(v))}${html?'&Prime;':'"'}`;
}
function matureSizeText(P,html){
  // heightIn is real inches (trees declare it — px h under-reads them ~8x);
  // herbaceous/shrub px h sits near 1:1 with inches, so it stays the fallback
  return `${plantMeasure(P.heightIn||P.h,html)} H ${html?'&times;':'x'} ${plantMeasure(P.spread,html)} W`;
}
function yearsToSizeText(P){ return P.grow ? `~${P.grow} yrs to size` : ''; }
function crownTilesText(P){
  if (!isWoodyDef(P)) return '';
  const n=Math.max(1,Math.round(woodyRadiusTiles(P)*2));
  return `crown covers ~${n} tile${n===1?'':'s'} wide`;
}
function showPlantCard(p,px2,py2){
  const P=plantDef(p.s,p.v), g=Math.round(plantEstab(p)*100), el=document.getElementById('plantCard');
  clearTimeout(el._t);
  const focusKey=plantKeyOf(p);
  game.focusPlantKey=focusKey;
  const shaded = px2!==undefined && P.sun!=='part' && !isTreeDef(P) && shadeInfoAt(px2,py2,false);
  const detailBits=[
    `<b>Mature size:</b> ${matureSizeText(P,true)}`,
    `${plantMeasure(P.space,true)} apart`,
    `zones ${P.zones[0]}-${P.zones[1]}`,
    `${P.sun} sun`,
    `${P.moist} soil`,
  ];
  const yrs=yearsToSizeText(P), crown=crownTilesText(P);
  if (yrs) detailBits.push(yrs);
  if (crown) detailBits.push(crown);
  const bloomInfo=typeof bloomRangeText==='function' ? bloomRangeText(P) : '';
  const bloomFamily=typeof resultFlowerFamily==='function' ? resultFlowerFamily({s:p.s,v:p.v||null},activeDiscovery()) : null;
  const status=establishedPreviewActive()
    ? (g>=100?'Shown at maturity.':`Shown at maturity - ${g}% established today.`)
    : (g>=100?'Fully established':`Establishing - ${g}% grown`);
  const nativeRelationHere=nativeRelation(P,activeFilters().nativeRegion);
  const nativeText=nativeStatusText(P,activeFilters().nativeRegion);
  el.innerHTML=`<h3>${P.name}</h3><div class="latin">${P.latin}</div>
    <p>${P.blurb}</p>
    <p style="margin-top:6px;color:var(--text-secondary)">${detailBits.join(' - ')}</p>
    <p style="color:${nativeRelationHere.regional?'var(--color-accent-2-700)':'var(--icon-warm)'}">${nativeText} · ${provenanceLabel(P)}</p>
    <p style="color:var(--text-muted)">Roles: ${roleSummary(p.s,6,p.v||null)}</p>
    ${bloomInfo&&bloomInfo!=='No bloom time recorded'?`<p style="color:var(--text-secondary)">Blooms ${bloomInfo}${bloomFamily?` \u00b7 ${bloomFamily}`:''}</p>`:''}
    ${shaded?`<p style="color:var(--icon-warm)">Struggling — active canopy shade from ${PLANTS[shaded.p.s].name} and it wants full sun.</p>`:''}
    <p style="margin-top:6px;color:var(--text-primary)">${status}</p>`;
  const xb=document.createElement('button'); xb.className='card-x'; xb.title='Close plant details';
  xb.setAttribute('aria-label','Close plant details'); setUiIcon(xb,'close');
  const close=()=>{ el.style.display='none'; clearTimeout(el._t);
    if (game.focusPlantKey===focusKey) game.focusPlantKey=null; };
  xb.onclick=close;
  el.prepend(xb);
  if (typeof isFavorite==='function' && typeof el.appendChild==='function'){
    const fb=document.createElement('button'); fb.type='button'; fb.className='card-action';
    const ref={s:p.s,v:p.v||null}; fb.textContent=isFavorite(ref)?'Remove from Favorites':'Add to Favorites';
    fb.onclick=()=>{ toggleFavorite(ref); fb.textContent=isFavorite(ref)?'Remove from Favorites':'Add to Favorites'; };
    el.appendChild(fb);
  }
  if (px2!==undefined && py2!==undefined){
    const rb=document.createElement('button'); rb.type='button'; rb.className='card-action'; rb.textContent='Replace\u2026';
    rb.title=`Replace ${P.name} here or across the garden`;
    rb.onclick=()=>{ close(); openReplacePlant(p,px2,py2); };
    if (el.appendChild) el.appendChild(rb); else el.prepend(rb);
  }
  el.style.display='block';
  el._t=setTimeout(close,8000);
}
function toast(msg,kind){
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity=1;
  if (el.classList) el.classList.toggle('warn',kind==='warn');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.style.opacity=0,2600);
}



/* tap / click: the tapped tile is acted on directly */
let sweep=null; // shovel drag-lift in progress: {plants, terr}
/* the eraser: clears a disc brush (game.brushSize, shared with the paint
   brushes) centered on the tile, removing the layers selected by
   game.eraseMode. 'all' wipes plant + bulb + terrain on every tile in one
   pass; the others touch only their layer. Counts tally into `counts`. */
function eraseBrush(cx,cy,counts){
  const m=game.eraseMode;
  // a layer is erasable only if it's visible, in edit focus, and in eraseMode
  const can=(name,mode)=>layerShown(name) && layerEditable(name) && (m==='all'||m===mode);
  const peren=can('perennials','plant'), woody=can('woody','plant');
  const bulbOK=can('bulbs','bulb'), terrOK=can('landscape','terrain');
  for (const [dx,dy] of brushOffsets(game.brushSize)){
    const x=cx+dx, y=cy+dy;
    if (!onPlot(x,y)) continue;
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
      const bo=boulderAt(x,y);
      if (bo){ clearTile('boulders',bo.key); counts.boulder=(counts.boulder||0)+1; }
      if (petAt(x,y)){ clearTile('pets',k); counts.pet=(counts.pet||0)+1; }
    }
    if (terrOK){ const hh=houseAt(x,y);     // landscape erase also lifts a whole house
      if (hh){ const i=game.houses.indexOf(hh);
        if (removeHouseAtIndex(i)) counts.house=(counts.house||0)+1; } }
    if (terrOK){ const bb=buildingAt(x,y);
      if (bb){ const i=game.buildings.indexOf(bb);
        if (removeBuildingAtIndex(i)) counts.building=(counts.building||0)+1; } }
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
function selValidDest(x,y){ return onPlot(x,y) && !siteStructureAt(x,y) && !isDoor(x,y); }
// Selection moves validate against the post-move world: selected source tiles
// are empty for moves, while selected destination shrubs/terrain already count.
function liveSelectionValue(v){ return v && !v.removed ? v : null; }
function selectionEmptySets(){
  return {plants:new Set(),bulbs:new Set(),terrain:new Set(),elevation:new Set(),
    fences:new Set(),lights:new Set(),firepits:new Set(),boulders:new Set(),pets:new Set()};
}
function selectionSourceSets(items,copy){
  const out=selectionEmptySets();
  if (copy) return out;
  items.forEach(c=>{
    const k=`${c.x},${c.y}`;
    if (c.plant) out.plants.add(k);
    if (c.bulb) out.bulbs.add(k);
    if (c.terr) out.terrain.add(k);
    if (c.elev) out.elevation.add(k);
    if (c.fence) out.fences.add(k);
    if (c.light) out.lights.add(k);
    if (c.firepit) out.firepits.add(k);
    if (c.boulder) out.boulders.add(k);
    if (c.pet) out.pets.add(k);
  });
  return out;
}
function selectionDestMaps(items,dst){
  const out={plants:new Map(),bulbs:new Map(),terrain:new Map(),elevation:new Map(),
    fences:new Map(),lights:new Map(),firepits:new Map(),boulders:new Map(),pets:new Map()};
  items.forEach(c=>{
    const [x,y]=dst(c), k=`${x},${y}`;
    if (c.plant) out.plants.set(k,Object.assign({x,y},c.plant));
    if (c.bulb) out.bulbs.set(k,Object.assign({x,y},c.bulb));
    if (c.terr) out.terrain.set(k,c.terr);
    if (c.elev) out.elevation.set(k,c.elev);
    if (c.fence) out.fences.set(k,c.fence);
    if (c.light) out.lights.set(k,c.light);
    if (c.firepit) out.firepits.set(k,Object.assign({x,y},c.firepit));
    if (c.boulder) out.boulders.set(k,Object.assign({x,y},c.boulder));
    if (c.pet) out.pets.set(k,c.pet);
  });
  return out;
}
function selectionValidationContext(items,dst,copy){
  return {ignore:selectionSourceSets(items,copy), dest:selectionDestMaps(items,dst)};
}
function selectionIgnored(ctx,layer,k){ return !!(ctx && ctx.ignore[layer] && ctx.ignore[layer].has(k)); }
function selectionDest(ctx,layer,k){ return ctx && ctx.dest[layer] && ctx.dest[layer].get(k); }
function selectionTerrainKindAt(x,y,ctx){
  const k=`${x},${y}`, d=selectionDest(ctx,'terrain',k);
  if (liveSelectionValue(d)) return d.k;
  if (selectionIgnored(ctx,'terrain',k)) return null;
  return tileTerrain(x,y);
}
function selectionPlantAt(x,y,ctx,ownDestKey){
  const k=`${x},${y}`, d=selectionDest(ctx,'plants',k);
  if (liveSelectionValue(d) && k!==ownDestKey) return d;
  if (selectionIgnored(ctx,'plants',k)) return null;
  const cur=liveSelectionValue(game.plants[k]);
  if (cur) return cur;
  return null;
}
function selectionFenceAt(x,y,ctx){
  const k=`${x},${y}`, d=selectionDest(ctx,'fences',k);
  if (liveSelectionValue(d)) return d;
  if (selectionIgnored(ctx,'fences',k)) return null;
  return fenceAt(x,y);
}
function selectionLightAt(x,y,ctx){
  const k=`${x},${y}`, d=selectionDest(ctx,'lights',k);
  if (liveSelectionValue(d)) return d;
  if (selectionIgnored(ctx,'lights',k)) return null;
  return lightAt(x,y);
}
function selectionFirepitAt(x,y,ctx){
  if (ctx) for (const [key,f] of ctx.dest.firepits){
    if (!liveSelectionValue(f)) continue;
    const sz=firepitTileSize(f);
    if (x>=f.x && x<f.x+sz.w && y>=f.y && y<f.y+sz.h) return Object.assign({key},f);
  }
  const fp=firepitAt(x,y);
  return fp && selectionIgnored(ctx,'firepits',fp.key) ? null : fp;
}
function selectionBoulderAt(x,y,ctx){
  if (ctx) for (const [key,b] of ctx.dest.boulders){
    if (!liveSelectionValue(b)) continue;
    const sz=boulderTileSize(b);
    if (x>=b.x && x<b.x+sz.w && y>=b.y && y<b.y+sz.h) return Object.assign({key},b);
  }
  const bo=boulderAt(x,y);
  return bo && selectionIgnored(ctx,'boulders',bo.key) ? null : bo;
}
function selectionShrubAt(x,y,ctx,ownDestKey){
  if (ctx) for (const [key,p] of ctx.dest.plants){
    if (key===ownDestKey || !liveSelectionValue(p) || !isShrubDef(plantDef(p.s,p.v))) continue;
    if (shrubClaimsTile(p.x,p.y,p,x,y,true)) return {key,p,x:p.x,y:p.y,center:key===`${x},${y}`};
  }
  return shrubAt(x,y,{ignoreKeys:ctx&&ctx.ignore.plants});
}
function selectionShrubDestValid(c,x,y,ctx){
  const ownKey=`${x},${y}`, np=Object.assign({},c.plant);
  for (const [xx,yy] of shrubFootprintTiles(x,y,np,true)){
    if (!selValidDest(xx,yy)) return false;
    if (selectionFenceAt(xx,yy,ctx) || selectionLightAt(xx,yy,ctx) ||
        selectionFirepitAt(xx,yy,ctx) || selectionBoulderAt(xx,yy,ctx)) return false;
    const terr=selectionTerrainKindAt(xx,yy,ctx);
    if (terr==='path'||terr==='water') return false;
    const p=selectionPlantAt(xx,yy,ctx,ownKey);
    if (p){
      if (shrubHedgeCompatible(np,p) && Math.hypot(xx-x,yy-y)>=0.95) continue;
      return false;
    }
    const other=selectionShrubAt(xx,yy,ctx,ownKey);
    if (other){
      if (shrubHedgeCompatible(np,other.p) && Math.hypot(other.x-x,other.y-y)>=0.95) continue;
      return false;
    }
  }
  return true;
}
function selectionTreeTrunkDestValid(c,x,y,ctx){
  const k=`${x},${y}`;
  if (!selValidDest(x,y)) return false;
  if (selectionFenceAt(x,y,ctx) || selectionLightAt(x,y,ctx) ||
      selectionFirepitAt(x,y,ctx) || selectionBoulderAt(x,y,ctx)) return false;
  const terr=selectionTerrainKindAt(x,y,ctx);
  if (terr==='path'||terr==='water') return false;
  if (selectionPlantAt(x,y,ctx,k)) return false;
  if (selectionShrubAt(x,y,ctx,k)) return false;
  return true;
}
function selectionUnderplantDestValid(c,x,y,ctx){
  const k=`${x},${y}`, p=selectionPlantAt(x,y,ctx,c.plant?k:null);
  if (p && isWoodyDef(plantDef(p.s,p.v))) return false;
  if (selectionShrubAt(x,y,ctx,c.plant?k:null)) return false;
  return true;
}
function selItemValidDest(c,x,y){
  const sz=c.firepit ? firepitTileSize(c.firepit) : c.boulder ? boulderTileSize(c.boulder) : null;
  if (!sz) return selValidDest(x,y);
  for (let yy=y;yy<y+sz.h;yy++) for (let xx=x;xx<x+sz.w;xx++)
    if (!selValidDest(xx,yy)) return false;
  return true;
}
function selItemDestValid(c,x,y,ctx){
  if (!selItemValidDest(c,x,y)) return false;
  if (c.plant){
    const P=plantDef(c.plant.s,c.plant.v);
    if (isShrubDef(P)) return selectionShrubDestValid(c,x,y,ctx);
    if (isTreeDef(P)) return selectionTreeTrunkDestValid(c,x,y,ctx);
    return selectionUnderplantDestValid(c,x,y,ctx);
  }
  if (c.bulb) return selectionUnderplantDestValid(c,x,y,ctx);
  return true;
}
function selectionDestinationsValid(items,dst,copy){
  const ctx=selectionValidationContext(items,dst,copy);
  return items.every(c=>{ const [x,y]=dst(c); return selItemDestValid(c,x,y,ctx); });
}
function cloneCell(c){ return JSON.parse(JSON.stringify(c)); }
// snapshot every occupied tile in the rect across plants, bulbs, terrain, elevation, fences, lights, and hardscape
function selectionPayload(r){
  const items=[];
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    const k=`${x},${y}`;
    const p=game.plants[k], b=game.bulbs[k], t=game.terrain[k], e=game.elevation[k], f=game.fences[k], l=game.lights[k], fp=game.firepits[k], bo=game.boulders[k], pet=game.pets[k];
    const cell={x,y};
    if (p && !p.removed) cell.plant=JSON.parse(JSON.stringify(p));
    if (b && !b.removed) cell.bulb=JSON.parse(JSON.stringify(b));
    if (t && !t.removed) cell.terr=JSON.parse(JSON.stringify(t));
    if (e && !e.removed) cell.elev=JSON.parse(JSON.stringify(e));
    if (f && !f.removed) cell.fence=JSON.parse(JSON.stringify(f));
    if (l && !l.removed) cell.light=JSON.parse(JSON.stringify(l));
    if (fp && !fp.removed) cell.firepit=JSON.parse(JSON.stringify(fp));
    if (bo && !bo.removed) cell.boulder=JSON.parse(JSON.stringify(bo));
    if (pet && !pet.removed) cell.pet=JSON.parse(JSON.stringify(pet));
    if (cell.plant||cell.bulb||cell.terr||cell.elev||cell.fence||cell.light||cell.firepit||cell.boulder||cell.pet) items.push(cell);
  }
  return items;
}
function selectionEstimate(r=game.sel,depthIn=3,items=game.selItems){
  if (!r) return null;
  const w=r.x1-r.x0+1, h=r.y1-r.y0+1, owned=items||selectionPayload(r);
  const bedKeys=new Set(); let plants=0, bulbs=0;
  for (const c of owned){
    if (c.terr && c.terr.k==='bed') bedKeys.add(`${c.x},${c.y}`);
    if (c.plant) plants++;
    if (c.bulb) bulbs++;
  }
  const bedArea=tileAreaSqFt(bedKeys.size), armed=PLANTS[game.lastBrushTool]?plantDef(game.lastBrushTool,game.lastBrushVar):null;
  return {
    w,h,widthFt:w*TILE_IN/12,heightFt:h*TILE_IN/12,areaSqFt:tileAreaSqFt(w*h),
    bedTiles:bedKeys.size,bedAreaSqFt:bedArea,edgeFt:materialPerimeterFt(bedKeys),
    mulchCuYd:mulchYards(bedArea,depthIn),plants,bulbs,
    armedName:armed&&armed.name,approxPlants:armed&&bedKeys.size?plantsForTiles(bedKeys.size,armed.space):null,
  };
}
function replacementGroup(D){
  if (!D) return null;
  if (D.type==='bulb'||D.type==='water'||D.type==='shrub'||D.type==='tree') return D.type;
  return ['grass','sedge','forb'].includes(D.type)?'perennial':null;
}
function exactPlantMatch(p,s,v){ return !!(p&&!p.removed&&p.s===s&&(p.v||null)===(v||null)); }
function replacementScopeTargets(ctx){
  if (!ctx) return [];
  const D=plantDef(ctx.source.s,ctx.source.v), layer=D.type==='bulb'?'bulbs':'plants';
  const out=[], seen=new Set(), add=k=>{
    if (seen.has(k)) return; const p=game[layer][k];
    if (exactPlantMatch(p,ctx.source.s,ctx.source.v)){ seen.add(k); out.push({layer,key:k,p}); }
  };
  if (ctx.scope==='one') add(ctx.key);
  else if (ctx.scope==='selection'){
    for (const c of (game.selItems||[])) add(`${c.x},${c.y}`);
  } else for (const k in game[layer]) add(k);
  return out;
}
function replacementPreflight(ctx,target){
  const from=plantDef(ctx.source.s,ctx.source.v), to=plantDef(target.s,target.v);
  const targets=replacementScopeTargets(ctx);
  if (!from||!to||replacementGroup(from)!==replacementGroup(to)) return {valid:[],blocked:targets,reason:'Choose a compatible plant type.'};
  if (!plantRefFitsCriteria({s:target.s,v:target.v||null},activeFilters()))
    return {valid:[],blocked:targets,reason:'That plant does not fit this garden\'s active criteria.'};
  const candidates=[], ignoredShrubs=isShrubDef(to)?new Set(targets.map(item=>item.key)):null;
  for (const item of targets){
    const [x,y]=item.key.split(',').map(Number), np=Object.assign({},item.p,{s:target.s,t:Date.now()});
    if (target.v) np.v=target.v; else delete np.v;
    let ok=!siteStructureAt(x,y)&&!isDoor(x,y);
    if (ok && to.type==='water') ok=tileTerrain(x,y)==='water';
    if (ok && to.type==='bulb'){
      const sh=shrubAt(x,y), above=game.plants[item.key];
      ok=!sh && !(above&&!above.removed&&plantLayerOf(above)==='woody');
    }
    if (ok && isShrubDef(to)) ok=canPlaceShrubAt(x,y,np,{ignoreKeys:ignoredShrubs}).ok;
    if (ok && !isShrubDef(to) && to.type!=='bulb' && to.type!=='water'){
      const terr=tileTerrain(x,y); ok=terr!=='path'&&terr!=='water'&&!shrubAt(x,y,{ignoreKey:item.key});
    }
    candidates.push(Object.assign({},item,{next:np,x,y,ok}));
  }
  // Validate a shrub batch against its virtual final state. Source shrubs that
  // cannot change remain obstacles; successful candidates are compared as the
  // replacement species so adjacent batch members do not block one another
  // merely because their old footprints still exist in game.plants.
  if (isShrubDef(to) && candidates.length>1){
    const blocked=new Set(candidates.map((c,i)=>c.ok?null:i).filter(i=>i!==null));
    const overlaps=(a,ap,b,bp)=>{
      if (shrubHedgeCompatible(ap,bp) && Math.hypot(a.x-b.x,a.y-b.y)>=0.95) return false;
      const tiles=new Set(shrubFootprintTiles(a.x,a.y,ap,true).map(p=>p.join(',')));
      return shrubFootprintTiles(b.x,b.y,bp,true).some(p=>tiles.has(p.join(',')));
    };
    let changed=true;
    while (changed){
      changed=false;
      for (let i=0;i<candidates.length;i++){
        if (blocked.has(i)) continue;
        for (let j=0;j<candidates.length;j++){
          if (i===j) continue;
          const other=blocked.has(j)?candidates[j].p:candidates[j].next;
          if (overlaps(candidates[i],candidates[i].next,candidates[j],other)){
            blocked.add(i); candidates[i].ok=false; changed=true; break;
          }
        }
      }
    }
  }
  const valid=candidates.filter(c=>c.ok), blocked=candidates.filter(c=>!c.ok);
  return {valid,blocked,reason:blocked.length?'Some positions are blocked or too small for the replacement.':''};
}
function updateReplacementSelection(valid,clearedBulbs){
  if (!game.selItems) return;
  const changed=new Map(valid.map(item=>[item.key,item]));
  game.selItems.forEach(cell=>{
    const key=`${cell.x},${cell.y}`, item=changed.get(key);
    if (item) cell[item.layer==='bulbs'?'bulb':'plant']=JSON.parse(JSON.stringify(item.next));
    if (clearedBulbs&&clearedBulbs.has(key)) delete cell.bulb;
  });
}
function replacePlantInstances(ctx,target){
  const check=replacementPreflight(ctx,target);
  if (!check.valid.length) return Object.assign(check,{changed:0});
  const clearedBulbs=new Set();
  withUndo(()=>{ check.valid.forEach(item=>{
    if (item.layer==='plants'&&isShrubDef(plantDef(item.next.s,item.next.v)))
      clearBulbsUnderShrub(item.x,item.y,item.next,clearedBulbs);
    setTile(item.layer,item.key,item.next);
  }); });
  updateReplacementSelection(check.valid,clearedBulbs);
  hapticFeedback('success');
  return Object.assign(check,{changed:check.valid.length});
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
    const bo=boulderAt(x,y);
    if (bo) clearTile('boulders',bo.key);
    if (petAt(x,y)) clearTile('pets',k);
  }
}
function pasteSavedArea(){
  const area=storedArea();
  if (!area || !area.items || !area.items.length){ toast('No saved area yet.'); return; }
  if (!game.sel){ toast('Select where to paste the saved area.'); return; }
  const target=rectForSavedArea(area,game.sel.x0,game.sel.y0);
  if (!rectFits(target)){ toast('Saved area would run off the plot or into a house.'); return; }
  const items=area.items.map(c=>{ const out=cloneCell(c); out.x=target.x0+c.x; out.y=target.y0+c.y; return out; });
  withUndo(()=>{ clearRectLayers(target); selWrite(items,c=>[c.x,c.y],false); });
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
      let clearedPlant=false, clearedBulb=false;
      if (def && def.type==='bulb'){
        if (oldBulb && !oldBulb.removed){ clearTile('bulbs',k); clearedBulb=true; }
      } else if (def) {
        if (oldPlant && !oldPlant.removed){ clearTile('plants',k); clearedPlant=true; }
      }
      if (applyToolAt(x,y)) placed++;
      else if (def) {
        if (clearedPlant) setTile('plants',k,oldPlant);
        if (clearedBulb) setTile('bulbs',k,oldBulb);
      }
    }
    game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  });
  game.tool=oldTool; game.toolVar=oldVar; game.drift=oldDrift;
  if (placed){
    hapticFeedback('place');
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
      if (c.boulder) clearTile('boulders',k);
      if (c.pet)   clearTile('pets',k);
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
    if (c.boulder) setTile('boulders',k,Object.assign({},c.boulder,{t:now}));
    if (c.pet)   setTile('pets',k,Object.assign({},c.pet,{t:now}));
  }
}
// commit a move or copy by tile offset; returns true if applied. Operates on
// the selection's OWNED items (game.selItems), not whatever is in the rect now
function commitSelectionOffset(dx,dy,copy){
  if (!game.sel || (dx===0&&dy===0 && !copy)) return false;
  const items=game.selItems||[];
  if (!items.length) return false;
  const dst=c=>[c.x+dx,c.y+dy];
  if (!selectionDestinationsValid(items,dst,copy)){
    toast('That spot is blocked for the selected plants or hardscape.'); return false;
  }
  withUndo(()=>selWrite(items, dst, !copy));
  items.forEach(c=>{ c.x+=dx; c.y+=dy; });   // the selection now owns the moved/copied tiles
  game.sel={x0:game.sel.x0+dx,y0:game.sel.y0+dy,x1:game.sel.x1+dx,y1:game.sel.y1+dy};
  toast(copy?`Duplicated ${items.length} tile${items.length>1?'s':''}.`
            :`Moved ${items.length} tile${items.length>1?'s':''}.`);
  return true;
}
// rotate the selection's owned contents 90° clockwise in integer tile space.
// Anchoring at the rect origin avoids half-tile rounding drift for mixed parity
// selections, so four rotations return exactly to the starting footprint.
function rotateSelection(){
  if (!game.sel) return;
  const r=game.sel, items=game.selItems||[];
  if (!items.length){ toast('Nothing in the selection to rotate.'); return; }
  const w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  const nr={x0:r.x0,y0:r.y0,x1:r.x0+h-1,y1:r.y0+w-1};
  const rot=(x,y)=>[nr.x0+(r.y1-y), nr.y0+(x-r.x0)];
  if (nr.x1>=GW || nr.y1>=GH || !selectionDestinationsValid(items,c=>rot(c.x,c.y),false)){
    toast('Rotated selection would be blocked.'); return;
  }
  withUndo(()=>selWrite(items, c=>rot(c.x,c.y), true));
  items.forEach(c=>{ const [nx,ny]=rot(c.x,c.y); c.x=nx; c.y=ny; });
  game.sel=nr;
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
      if (c.boulder) clearTile('boulders',k);
      if (c.pet)   clearTile('pets',k);
    } });
  toast(`Erased ${items.length} tile${items.length>1?'s':''}.`);
  clearSelection();
}
function resetSelectionState(){ game.sel=null; game.selItems=null; selDrag=null; selMove=null; }
function clearSelection(){ resetSelectionState(); buildToolTray(); refreshCanvasTools(); }
function selPointerDown(x,y,e){
  try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
  if (inRect(game.sel,x,y)){            // grab the selection to move/copy it
    selMove={grabX:x,grabY:y,curX:x,curY:y,copy:game.selMode==='copy'};
  } else {                              // start a fresh marquee
    selDrag={x0:x,y0:y,x1:x,y1:y};
    if (game.sel){ game.sel=null; game.selItems=null; buildToolTray(); refreshCanvasTools(); }
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
    selDrag=null; buildToolTray(); refreshCanvasTools();
    return;
  }
  if (selMove){
    const dx=selMove.curX-selMove.grabX, dy=selMove.curY-selMove.grabY;
    const copy=selMove.copy; selMove=null;
    if (dx||dy) commitSelectionOffset(dx,dy,copy);
    buildToolTray(); refreshCanvasTools();
  }
}
function evPlacement(e){ // pointer position -> owning world tile + sub-tile offset
  const W=VW/ZOOM, H=VH/ZOOM;
  const pt=canvasClientPoint(e), sx=pt.x/ZOOM, sy=pt.y/ZOOM;
  const [x,y]=tileAt(sx, sy, W, H);
  const [wx,wy]=worldPointAt(sx, sy, W, H, elevationAt(x,y));
  return {x,y,wx,wy,ox:wx-x,oy:wy-y};
}
/* ---------- undo: a stack of layer snapshots ----------
   A gesture snapshots state on pointerdown and commits it only if a mutation
   helper bumped game.rev by pointerup, so no-op taps don't pile up. */
let spaceHeld=false, panDrag=null, undoStack=[], redoStack=[], pendSnap=null, pendRev=0;
function updateCanvasCursor(){
  if (!cnv) return;
  cnv.style.cursor = game.underlayCalibration ? 'crosshair' : panDrag ? 'grabbing'
    : (game.tool==='hand'||spaceHeld) ? 'grab'
    : (game.tool==='select'||game.tool==='ruler'||game.tool==='pick'||game.tool==='building') ? 'crosshair' : '';
}
/* Fires on EVERY pointerdown and is O(all plants) — see 'snap' in the debug HUD.
   A JSON round-trip here measured 9.5ms on a fully planted quarter acre, which
   is a visible hitch at the START of a gesture, before anything has been drawn.

   It does not need a deep copy. Tile VALUES are replace-only by construction:
   setTile assigns a new object, clearTile assigns a fresh tombstone, and
   nothing anywhere mutates a stored tile in place (the only property writes on
   tile-shaped objects are to local drafts — matureWoodyDraft, houseDraft). So a
   shallow copy of a keyed layer is a correct snapshot: the entries it shares
   can never change underneath it, only be replaced in the live map.

   Nor is there an aliasing hazard from applySnapshot assigning the stored map
   straight onto `game`. doUndo/doRedo push a FRESH snapshot before applying the
   popped one, so the map that goes live is never still referenced by a stack.

   Arrays (houses, buildings) keep the deep clone: their members ARE edited in
   place on some paths, and there are only ever a handful of them. */
function snapshotState(){
  const t0=dnow();
  const s={};
  for (const L of GAME_LAYERS){
    const src=game[L.k]||(L.array?[]:{});
    s[L.k]= L.array ? JSON.parse(JSON.stringify(src)) : Object.assign({},src);
  }
  // Which planting scheme these layers belong to. A string, so tagging costs
  // nothing measurable — and it is what keeps one shared stack correct across
  // schemes. Cloning every scheme into each snapshot was measured at 4x the
  // per-pointerdown cost, and per-scheme stacks at ~73MB of heap on a quarter
  // acre, so neither is affordable.
  s.scheme=game.schemeActive;
  dev('snap',t0);
  return s;
}
// a new action invalidates the redo chain (standard undo/redo semantics)
function pushUndo(snap){ undoStack.push(snap); if (undoStack.length>30) undoStack.shift();
  redoStack.length=0; updateUndoBtn(); }
// Model mutations go through helpers that bump game.rev, so undo change
// detection is an O(1) revision comparison instead of a full-layer hash.
function changedSince(rev){ return game.rev!==rev; }
function beginUndo(){ pendRev=game.rev; pendSnap=snapshotState(); }
function commitUndo(){ if (pendSnap && changedSince(pendRev)) pushUndo(pendSnap); pendSnap=null; }
function cancelPendingUndo(restore){
  if (restore && pendSnap && changedSince(pendRev)) applySnapshot(pendSnap);
  pendSnap=null;
}
function withUndo(fn){ const rev=game.rev, snap=snapshotState(); fn();
  if (changedSince(rev)) pushUndo(snap); }
function applySnapshot(s){ // restore every layer + refresh UI
  resetSelectionState();
  // A snapshot belongs to the scheme it was taken in. Undoing across a switch
  // has to re-enter that scheme FIRST, or the restored plants land in whatever
  // scheme happens to be active and silently overwrite it.
  if (s.scheme && s.scheme!==game.schemeActive && schemeById(s.scheme)) activateScheme(s.scheme);
  for (const L of GAME_LAYERS) game[L.k]=s[L.k]||(L.array?[]:{});
  markGroundChanged({terrain:true});
  markModelChanged(); updateUndoBtn();
  buildToolTray();
}
// undo/redo can walk across a scheme boundary; say so rather than silently
// swapping the garden under the gardener
function historyNote(verb,before){
  if (!multiScheme() || game.schemeActive===before) return verb+'.';
  return `${verb} — now in "${activeSchemeName()}".`;
}
function doUndo(){
  if (!undoStack.length){ toast('Nothing to undo.'); return; }
  redoStack.push(snapshotState()); if (redoStack.length>30) redoStack.shift();
  const before=game.schemeActive;
  applySnapshot(undoStack.pop()); toast(historyNote('Undone',before));
}
function doRedo(){
  if (!redoStack.length){ toast('Nothing to redo.'); return; }
  undoStack.push(snapshotState()); if (undoStack.length>30) undoStack.shift();
  const before=game.schemeActive;
  applySnapshot(redoStack.pop()); toast(historyNote('Redone',before));
}
/* ---------- scheme commands (switching is navigation, not an edit) ----------
   A switch does not push an undo snapshot: it is the same class of action as
   rotating the view or changing season. Undo still crosses schemes safely via
   the snapshot tag above. */
function switchScheme(id){
  if (!schemeById(id) || id===game.schemeActive) return false;
  resetSelectionState(); game.focusPlantKey=null;   // the selection owns the outgoing scheme's plants
  if (!activateScheme(id)) return false;
  buildToolTray(); refreshCanvasTools(); updateHUD();
  toast(`Now showing "${activeSchemeName()}".`);
  if (game.inGarden&&hasStorage) saveSolo(true);
  return true;
}
function cycleScheme(dir){
  const list=schemeList(); if (list.length<2) return false;
  const i=activeSchemeIndex(), n=list.length;
  return switchScheme(list[((i+dir)%n+n)%n].id);
}
function schemeAtIndex(i){
  const list=schemeList();
  return (i>=0 && i<list.length) ? switchScheme(list[i].id) : false;
}
function createScheme(copyCurrent){
  const list=schemeList();
  if (list.length>=MAX_SCHEMES){ toast(`A garden holds up to ${MAX_SCHEMES} planting schemes.`,'warn'); return null; }
  // refuse before the work, rather than letting the save fail after it
  if (!saveHasRoomForScheme(copyCurrent)){
    toast('This garden is too large to hold another planting scheme.','warn'); return null;
  }
  const s={id:newSchemeId(), name:nextSchemeName(), t:Date.now(),
    plants: copyCurrent?JSON.parse(JSON.stringify(game.plants||{})):{},
    bulbs:  copyCurrent?JSON.parse(JSON.stringify(game.bulbs||{})):{}};
  list.push(s);
  resetSelectionState(); game.focusPlantKey=null;
  activateScheme(s.id);                       // stashes the outgoing scheme on the way out
  buildToolTray(); refreshCanvasTools(); updateHUD();
  toast(copyCurrent?`"${s.name}" started from a copy.`:`"${s.name}" started empty.`);
  if (game.inGarden&&hasStorage) saveSolo(true);
  return s;
}
function renameScheme(id,name){
  const s=schemeById(id); if (!s) return false;
  const clean=String(name||'').trim().slice(0,32);
  if (!clean || clean===s.name) return false;
  s.name=clean; s.t=Date.now();
  refreshCanvasTools();
  if (game.inGarden&&hasStorage) saveSolo(true);
  return true;
}
function deleteScheme(id){
  const list=schemeList();
  if (list.length<2){ toast('A garden keeps at least one planting scheme.','warn'); return false; }
  const i=list.findIndex(s=>s.id===id); if (i<0) return false;
  const name=list[i].name;
  if (id===game.schemeActive){        // leave before deleting the ground under us
    resetSelectionState(); game.focusPlantKey=null;
    activateScheme(list[(i+1)%list.length].id);
  }
  list.splice(list.findIndex(s=>s.id===id),1);
  markModelChanged();
  buildToolTray(); refreshCanvasTools(); updateHUD();
  toast(`Deleted "${name}".`);
  if (game.inGarden&&hasStorage) saveSolo(true);
  return true;
}
function updateUndoBtn(){
  // Undo/Redo live in the canvas rail now; their greyed state is recomputed from
  // undoStack/redoStack each time the rail is (re)built.
  refreshCanvasTools();
}
