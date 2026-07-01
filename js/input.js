'use strict';

/* keyboard */
const heldKeys={};
addEventListener('keydown',e=>{
  if (document.getElementById('hud').classList.contains('hidden')) return;
  if (e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT')) return;
  if (e.key==='`'){ toggleDebug(); return; }
  const confirmPop=document.getElementById('confirmPop');
  if (confirmPop){ if (e.key==='Escape') confirmPop.remove(); return; }
  const overlay=['gardenMenu','exportScreen','regionScreen','planScreen']
    .map(id=>document.getElementById(id)).find(el=>el && !el.classList.contains('hidden'));
  if (overlay){ // an overlay is open: only Escape closes, game keys ignored
    if (e.key==='Escape'){ overlay.classList.add('hidden'); }
    return;
  }
  const k=e.key.toLowerCase();
  if ((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); return; }
  if ((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); doRedo(); return; }
  const confirmOpen=!document.getElementById('confirmSeasonScreen').classList.contains('hidden');
  if (confirmOpen){ if (e.key==='Escape') closeSeasonConfirm(); return; }
  const pauseOpen=!document.getElementById('pauseScreen').classList.contains('hidden');
  if (pauseOpen){ if (e.key==='Escape') closePause(); return; }
  if (e.key==='Escape' && game.tool==='select'){  // back out of a move, then the selection
    if (selMove){ selMove=null; toast('Move cancelled.'); }
    else if (game.sel){ clearSelection(); toast('Selection cleared.'); }
    return;
  }
  if (k===' ' && game.gameMode==='design'){ // hold space to pan the design canvas (PC)
    e.preventDefault(); spaceHeld=true; updateCanvasCursor(); return;
  }
  if (k==='e'||k===' '){ e.preventDefault(); withUndo(actHere); return; }
  if (k==='r'){ e.preventDefault(); rotateView(); return; }
  if (k==='+'||k==='='){ e.preventDefault(); zoomBy(1.12); return; }
  if (k==='-'){ e.preventDefault(); zoomBy(0.89); return; }
  /* keys move in SCREEN directions: D is right on screen, W is up, etc.
     One key = a screen-cardinal step (a view diagonal); holding two keys
     combines into the view axes. The loop converts view direction to
     world direction per the current rotation. */
  const map={w:[-1,-1],arrowup:[-1,-1],s:[1,1],arrowdown:[1,1],
             a:[-1,1],arrowleft:[-1,1],d:[1,-1],arrowright:[1,-1]};
  if (map[k]){ e.preventDefault(); heldKeys[k]=map[k]; }
});
addEventListener('keyup',e=>{ delete heldKeys[e.key.toLowerCase()];
  if (e.key===' '){ spaceHeld=false; updateCanvasCursor(); } });



/* two fingers pinch the zoom; everything else is one-finger business */
const activePtrs=new Map(); let pinch=null, toolDrag=null, fillTap=null;
function cancelCanvasGesture(restore){
  cancelPendingUndo(restore);
  sweep=null; toolDrag=null; fillTap=null; panDrag=null; selDrag=null; selMove=null;
  game.pathTarget=null; game.sleepOnArrive=false;
  updateCanvasCursor();
}
cnv.addEventListener('pointerdown',e=>{
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (activePtrs.size===2){
    const [a,b2]=[...activePtrs.values()];
    pinch={d0:Math.hypot(a[0]-b2[0],a[1]-b2[1])||1, z0:userZoom,
           cx0:(a[0]+b2[0])/2, cy0:(a[1]+b2[1])/2,   // centroid, for two-finger pan
           camx0:cam.x, camy0:cam.y};
    cancelCanvasGesture(true);
    return;
  }
  if (activePtrs.size>1) return;
  // Hand tool pans the map; design mode also supports middle mouse / Space-drag.
  if (game.tool==='hand' || (game.gameMode==='design' && (e.button===1 || spaceHeld))){
    e.preventDefault();
    panDrag={sx:e.clientX, sy:e.clientY, camx0:cam.x, camy0:cam.y};
    updateCanvasCursor();
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  if (x<0||y<0||x>=GW||y>=GH) return;
  if (game.tool==='select'){ selPointerDown(x,y,e); return; }
  if (game.tool==='pick'){ pickAt(x,y); return; }   // eyedropper: sample, then become that brush
  // drawing onto a hidden layer? warn and offer to reveal it before placing
  if (isPlacementTool(game.tool)){
    const layer=toolTargetLayer(game.tool);
    if (blockIfWrongEditLayer(layer)) return;
    if (layer && !layerShown(layer)){ promptRevealLayer(layer,x,y); return; }
  }
  if (fillActive()){ // bucket fill commits on pointerup so a pinch can still cancel it
    fillTap={x,y};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  beginUndo();   // snapshot before any placement gesture; committed at pointerup if it changed anything
  if (game.tool==='house'){ placeHouse(x,y); return; }
  if (game.tool==='shovel'){ // drag across the bed to lift plant after plant
    sweep={plants:0, bulbs:0, terr:0, elev:0, house:0, fence:0, light:0, firepit:0};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    sweepLift(x,y); return;
  }
  // plant/bulb/path/bed/water/elevation/fence/light/firepit: press-and-drag paints tiles like the shovel
  // sweeps them; a plain tap (resolved at pointerup) walks or acts. (house already returned above.)
  if (isBrushTool(game.tool)){
    toolDrag={sx:x, sy:y, ox:place.ox, oy:place.oy, active:false, count:0, what:null};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  tapAction(x,y,place);
});
function tapAction(x,y,opts){ // the classic tap: walk there, act on your own tile
  if (game.visiting){ // read-only stroll: walk to walkable tiles, never edit
    if (x<0||y<0||x>=GW||y>=GH) return;
    if (inHouse(x,y)||tileTerrain(x,y)==='water'||fenceBlocks(x,y)||lightAt(x,y)||firepitAt(x,y)) return;
    game.sleepOnArrive=false; game.pathTarget=[x,y]; return;
  }
  if (game.gameMode==='design'){ // no avatar — act directly on the tapped tile
    if (x<0||y<0||x>=GW||y>=GH) return;
    game.tx=x; game.ty=y; actHere(opts); return;
  }
  if (inHouse(x,y)){
    if (ENABLE_HOUSE_SLEEP){ // old flow: tapping the house walked to the door, then slept
      const [dx2,dy2]=doorPos(houseAt(x,y));
      game.pathTarget=[dx2,dy2]; game.sleepOnArrive=true;
    } else {
      game.sleepOnArrive=false;
      toast('The house is just scenery for now.');
    }
    return;
  }
  game.sleepOnArrive=false;
  if (tileTerrain(x,y)==='water'){ toast('Water blocks the way.'); return; }
  if (fenceBlocks(x,y)){ toast('The fence blocks the way. Use a gate.'); return; }
  if (lightAt(x,y)){ toast('The light blocks the way.'); return; }
  if (firepitAt(x,y)){ toast('The fire pit blocks the way.'); return; }
  if (x===Math.round(game.px)&&y===Math.round(game.py)&&!game.moving){ actHere(opts); return; }
  game.pathTarget=[x,y];
}
function finishToolDrag(){
  if (!toolDrag || !toolDrag.active) return;
  if (toolDrag.count){
    syncToolLayer(toolDrag.what);
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    let msg;
    if (toolDrag.what==='path') msg=`Updated ${toolDrag.count} path tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='bed') msg=`Dug ${toolDrag.count} bed tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='water') msg=`Laid ${toolDrag.count} water tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='elevation') msg=`Adjusted ${toolDrag.count} elevation tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='fence'||toolDrag.what==='gate') msg=`Placed ${toolDrag.count} ${fenceLabel().toLowerCase()} tile${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='light') msg=`Placed ${toolDrag.count} ${lightLabel().toLowerCase()}${toolDrag.count>1?'s':''}.`;
    else if (toolDrag.what==='firepit') msg=`Placed ${toolDrag.count} ${firepitLabel().toLowerCase()}${toolDrag.count>1?'s':''}.`;
    else msg=`Planted ${toolDrag.count} - ${def.name}.`;
    toast(msg);
  } else toast('Nothing would take along that line.');
}
cnv.addEventListener('pointermove',e=>{
  if (panDrag){ // PC space/middle-drag pan
    cam.x=panDrag.camx0-(e.clientX-panDrag.sx)/ZOOM;
    cam.y=panDrag.camy0-(e.clientY-panDrag.sy)/ZOOM;
    return;
  }
  if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (pinch && activePtrs.size>=2){
    const [a,b2]=[...activePtrs.values()];
    setUserZoom(pinch.z0*(Math.hypot(a[0]-b2[0],a[1]-b2[1])||1)/pinch.d0);
    // two-finger drag pans the canvas (design mode has a free camera)
    if (game.gameMode==='design'){
      const cx=(a[0]+b2[0])/2, cy=(a[1]+b2[1])/2;
      cam.x=pinch.camx0-(cx-pinch.cx0)/ZOOM;
      cam.y=pinch.camy0-(cy-pinch.cy0)/ZOOM;
    }
    // (two-finger twist-to-rotate removed — rotate via the ⟳ button or R key)
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  if (game.tool==='select'){ if (selPointerMove(x,y)) return; }
  if (sweep){ sweepLift(x,y); return; }
  if (toolDrag){
    if (!toolDrag.active && (x!==toolDrag.sx||y!==toolDrag.sy)){
      toolDrag.active=true; // crossed a tile line: it's a paint-drag now
      const r0=applyToolAt(toolDrag.sx,toolDrag.sy,toolDrag);
      if (r0){ toolDrag.count++; toolDrag.what=r0; }
    }
    if (toolDrag.active){
      const r=applyToolAt(x,y,place);
      if (r){ toolDrag.count++; toolDrag.what=r; }
    }
    return;
  }
  game.hoverTile=(x>=0&&y>=0&&x<GW&&y<GH)?[x,y]:null;
});
cnv.addEventListener('wheel',e=>{
  if (!game.mode) return;
  e.preventDefault(); zoomBy(e.deltaY<0?1.12:0.89);
},{passive:false});
function endSweep(){
  if (!sweep) return;
  const parts=[];
  if (sweep.plants) parts.push(`${sweep.plants} plant${sweep.plants>1?'s':''}`);
  if (sweep.bulbs) parts.push(`${sweep.bulbs} bulb${sweep.bulbs>1?'s':''}`);
  if (sweep.terr) parts.push(`${sweep.terr} terrain tile${sweep.terr>1?'s':''}`);
  if (sweep.elev) parts.push(`${sweep.elev} elevation tile${sweep.elev>1?'s':''}`);
  if (sweep.fence) parts.push(`${sweep.fence} fence${sweep.fence>1?'s':''}`);
  if (sweep.light) parts.push(`${sweep.light} light${sweep.light>1?'s':''}`);
  if (sweep.firepit) parts.push(`${sweep.firepit} fire pit${sweep.firepit>1?'s':''}`);
  if (sweep.house) parts.push(`${sweep.house} house${sweep.house>1?'s':''}`);
  if (parts.length){
    toast(`Erased ${parts.join(' and ')}.`);
    if (sweep.plants) syncPlantsOut();
    if (sweep.bulbs) syncBulbsOut();
    if (sweep.terr) syncTerrainOut();
    if (sweep.elev) syncElevationOut();
    if (sweep.fence) syncFencesOut();
    if (sweep.light) syncLightsOut();
    if (sweep.firepit) syncFirepitsOut();
    if (sweep.house) pushHouse();
  }
  else toast('Nothing to erase there.');
  sweep=null;
}
cnv.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  if (panDrag){ panDrag=null; updateCanvasCursor(); return; }
  if (game.tool==='select' && (selDrag||selMove)){ selPointerUp(); return; }
  if (fillTap){ const f=fillTap; fillTap=null; doFloodFill(f.x,f.y); return; }
  if (toolDrag){
    if (toolDrag.active) finishToolDrag();
    else tapAction(toolDrag.sx,toolDrag.sy,toolDrag);
    toolDrag=null;
  }
  endSweep();
  commitUndo();   // push the pre-gesture snapshot only if something changed
});
cnv.addEventListener('pointercancel',e=>{
  activePtrs.delete(e.pointerId);
  if (activePtrs.size<2) pinch=null;
  cancelCanvasGesture(true);
});
cnv.addEventListener('auxclick',e=>{ if (e.button===1) e.preventDefault(); }); // no middle-click autoscroll
cnv.addEventListener('pointerleave',()=>{ game.hoverTile=null; });
function followPath(){
  if (!game.pathTarget||game.moving) return;
  const [gx,gy]=game.pathTarget;
  const cxp=Math.round(game.px), cyp=Math.round(game.py);
  if (cxp===gx&&cyp===gy){
    game.pathTarget=null;
    if (ENABLE_HOUSE_SLEEP && game.sleepOnArrive&&isDoor(gx,gy)) doSleep();
    game.sleepOnArrive=false; return; }
  const sx=Math.sign(gx-cxp), sy=Math.sign(gy-cyp);
  // prefer a diagonal step when both axes differ; slide along one axis
  // when the diagonal is blocked (e.g. by the cottage)
  const opts = (sx&&sy) ? [[sx,sy],[sx,0],[0,sy]] : (sx?[[sx,0]]:[[0,sy]]);
  for (const [ox,oy] of opts){
    if (canStand(cxp+ox,cyp+oy)){ tryMove(cxp+ox,cyp+oy); return; }
  }
  game.pathTarget=null; // boxed in — give up rather than spin
}
