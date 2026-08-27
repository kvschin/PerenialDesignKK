'use strict';

/* keyboard */
addEventListener('keydown',e=>{
  const northScreen=document.getElementById('siteNorthScreen');
  if (northScreen&&!northScreen.classList.contains('hidden')){
    if (e.key==='Escape'){ e.preventDefault(); cancelSiteNorthEditor(); }
    else trapOverlayFocus(northScreen,e);
    return;
  }
  /* The library opens from the MENU, where the HUD is hidden — so the guard
     on the next line returned before any Escape branch could run, and Escape
     did nothing at all on this screen. It has to be handled ABOVE that line. */
  const libraryScreen=document.getElementById('libraryScreen');
  if (libraryScreen&&!libraryScreen.classList.contains('hidden')){
    if (e.key==='Escape'){
      e.preventDefault();
      const search=document.getElementById('librarySearch');
      if (e.target===search && search.value){ search.value=''; applyLibrarySearch(); }
      else libraryBack();
    }
    return;
  }
  if (document.getElementById('hud').classList.contains('hidden')) return;
  if (game.photoEditing && e.key==='Escape'){ e.preventDefault();
    if (game.underlayCalibration) cancelSitePhotoCalibration(); else closeSitePhotoEdit(false); return; }
  if (e.target && (e.target.tagName==='INPUT'||e.target.tagName==='SELECT') && e.key!=='Escape' && e.key!=='Tab') return;
  const selectionMore=document.getElementById('selectionMore');
  if (selectionMore && e.key==='Escape'){ e.preventDefault(); selectionMore.remove();
    const more=document.querySelector('#selectionActions button[aria-haspopup="menu"]'); if (more) more.focus(); return; }
  if (e.key==='`'){ toggleDebug(); return; }
  const confirmPop=document.getElementById('confirmPop');
  if (confirmPop){
    if (e.key==='Escape'){ closeOverlay('confirmPop'); confirmPop.remove(); }
    else trapOverlayFocus(confirmPop,e);
    return;
  }
  const overlay=['siteNorthScreen','sitePhotoCalibrateScreen','replacePlantScreen','estimateScreen','gardenMenu','schemeScreen','exportScreen','discoveryFilterScreen','paletteScreen','planScreen','bloomScreen']
    .map(id=>document.getElementById(id)).find(el=>el && !el.classList.contains('hidden'));
  if (overlay){ // an overlay is open: only Escape closes, game keys ignored
    if (e.key==='Escape'){
      if (overlay.id==='siteNorthScreen') cancelSiteNorthEditor();
      else { closeOverlay(overlay.id); if (overlay.id==='replacePlantScreen') replacePlantContext=null; }
    }
    else trapOverlayFocus(overlay,e);
    return;
  }
  const k=e.key.toLowerCase();
  if ((e.ctrlKey||e.metaKey) && k==='z'){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); return; }
  if ((e.ctrlKey||e.metaKey) && k==='y'){ e.preventDefault(); doRedo(); return; }
  const pauseOpen=!document.getElementById('pauseScreen').classList.contains('hidden');
  if (pauseOpen){ if (e.key==='Escape') closePause(); else trapOverlayFocus(document.getElementById('pauseScreen'),e); return; }
  const toolMenu=(game.toolMenu==='view'&&document.getElementById('viewToolsPop')) ||
    (game.toolMenu==='layers'&&document.getElementById('layerPop')) ||
    (game.toolMenu==='schemes'&&document.getElementById('schemePop'));
  if (toolMenu){
    const opener=game.toolMenu==='schemes' ? document.getElementById('schemeChip')
      : (game.toolMenu==='layers' && visibleEl(document.getElementById('btnLayersTool')))
      ? document.getElementById('btnLayersTool') : document.getElementById('btnViewTools');
    if (e.key==='Escape' || e.key==='Tab'){
      e.preventDefault(); game.toolMenu=null; refreshCanvasTools();
      if (opener) opener.focus({preventScroll:true});
      return;
    }
    const items=Array.from(toolMenu.querySelectorAll('button:not([disabled])'));
    if (items.length && ['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();
      const at=items.indexOf(document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?items.length-1:
        e.key==='ArrowDown'?(at<0?0:(at+1)%items.length):(at<0?items.length-1:(at-1+items.length)%items.length);
      items[next].focus({preventScroll:true});
      return;
    }
    // Keep canvas shortcuts from firing while focus is in a menu. Enter and
    // Space retain their native button activation.
    return;
  }
  if (e.key==='Escape' && document.querySelector('.discovery-source-menu')){
    e.preventDefault(); closeDiscoverySourceMenu(true); return;
  }
  if (e.key==='Escape' && game.catMenuOpen){
    e.preventDefault(); game.catMenuOpen=false; buildToolTray(); return;
  }
  if (e.key==='Escape' && game.tool==='select'){  // back out of a move, then the selection
    if (selMove){ selMove=null; toast('Move cancelled.'); }
    else if (game.sel){ clearSelection(); toast('Selection cleared.'); }
    return;
  }
  if (e.key==='Escape' && game.tool==='building' && game.buildingDraft){
    cancelBuildingDraft(); toast('Building outline cancelled.'); return;
  }
  if (e.key==='Escape' && normalizedSheetState(game.sheetState)!=='collapsed'){
    e.preventDefault(); setSheetState('collapsed'); return;
  }
  if (k===' '){ // hold space to pan the canvas (PC)
    e.preventDefault(); spaceHeld=true; updateCanvasCursor(); return;
  }
  if (k==='e'||k===' '){ e.preventDefault(); withUndo(actHere); return; }
  if (k==='r'){ e.preventDefault(); rotateView(); return; }
  // planting schemes: [ and ] cycle, 1-6 jump straight to one. This is the
  // desktop A/B — flicking between schemes with the camera, zoom, rotation and
  // season all held constant is the whole point of the feature.
  if ((k==='['||k===']') && multiScheme()){ e.preventDefault(); cycleScheme(k===']'?1:-1); return; }
  if (k>='1' && k<='6' && multiScheme() && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault(); schemeAtIndex(+k-1); return;
  }
  if (k==='+'||k==='='){ e.preventDefault(); zoomBy(1.12); return; }
  if (k==='-'){ e.preventDefault(); zoomBy(0.89); return; }
});
addEventListener('keyup',e=>{
  if (e.key===' '){ spaceHeld=false; updateCanvasCursor(); } });



/* two fingers pinch the zoom; everything else is one-finger business */
const activePtrs=new Map(); let pinch=null, multiTouch=null, toolDrag=null, fillTap=null, rulerDrag=null, buildingHover=null, photoDrag=null, photoPinch=null;
function buildingCornerForPlacement(place){
  return [Math.max(0,Math.min(GW,Math.round(place.wx+0.5))),
    Math.max(0,Math.min(GH,Math.round(place.wy+0.5)))];
}
function snapBuildingCorner(raw,prev){
  if (!prev || samePoint(prev,raw) || prev[0]===raw[0] || prev[1]===raw[1]) return raw;
  // Let a loose mouse/finger motion resolve to the dominant orthogonal axis.
  return Math.abs(raw[0]-prev[0])>=Math.abs(raw[1]-prev[1])
    ? [raw[0],prev[1]] : [prev[0],raw[1]];
}
function previewBuildingCorner(place){
  const raw=buildingCornerForPlacement(place), vs=game.buildingDraft&&game.buildingDraft.vertices||[];
  if (vs.length>=3 && samePoint(raw,vs[0])) return raw;
  return snapBuildingCorner(raw,vs[vs.length-1]);
}
function updateBuildingUi(){
  if (typeof renderBuildingDraftActions==='function') renderBuildingDraftActions();
  if (typeof updateActiveToolStatus==='function') updateActiveToolStatus();
}
function cancelBuildingDraft(){
  game.buildingDraft=null; buildingHover=null;
  const actions=document.getElementById('buildingActions'); if (actions) actions.remove();
  updateBuildingUi();
}
function addBuildingCorner(place){
  const raw=buildingCornerForPlacement(place);
  const draft=game.buildingDraft || (game.buildingDraft={vertices:[]});
  const vs=draft.vertices;
  if (vs.length>=3 && samePoint(raw,vs[0])){ commitBuildingDraft(); return; }
  const prev=vs[vs.length-1], next=snapBuildingCorner(raw,prev);
  if (prev && samePoint(prev,next)){ toast('Choose a different corner.'); return; }
  if (vs.some(p=>samePoint(p,next))){ toast('That corner is already in this outline.'); return; }
  vs.push(next); buildingHover=null;
  updateBuildingUi();
  toast(vs.length<3 ? 'Add another corner, then tap the first corner or Close.' : 'Corner added. Tap the first corner or Close to finish.');
}
function commitBuildingDraft(){
  const draft=game.buildingDraft;
  if (!draft || !draft.vertices || draft.vertices.length<3){ toast('Add at least three corners first.'); return false; }
  let committed=false;
  withUndo(()=>{ committed=commitBuildingFootprint(draft.vertices); });
  if (committed){ cancelBuildingDraft(); refreshCanvasTools(); }
  return committed;
}
function buildingPointerDown(place){
  if (!layerShown('landscape')){ toast('Show Landscape/Hardscape to draw a building footprint.'); return; }
  addBuildingCorner(place);
}
function shouldStartPan(e){
  return game.tool==='hand' || e.button===1 || spaceHeld;
}
/* How far a Hand press may travel and still count as a tap rather than a pan.
   Generous enough for a finger on glass, tight enough that a deliberate drag
   never opens a plant card behind the panned view. */
const TAP_SLOP_PX=6;
function showGestureCancel(msg){
  const el=document.getElementById('gestureCancel'); if (!el) return;
  el.textContent=msg||'Placement cancelled';
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(()=>{ el.classList.remove('show'); el.classList.add('hidden'); },900);
}
/* Would cancelling right now actually LOSE the gardener something?
   A second finger landing cancels whatever gesture was running, and that used
   to announce itself unconditionally — so an ordinary pinch-zoom, by far the
   most common two-finger gesture and usually made with nothing in progress at
   all, reported the cancellation of something that never started.
   Excluded on purpose:
   - panDrag: the Hand tool sets it on the FIRST finger, so counting it would
     make every single pinch announce, which is the bug.
   - toolDrag unless `active`: it is created on pointerdown but paints nothing
     until the pointer crosses a tile line.
   - fillTap: a flood fill commits on pointerup, so nothing has happened yet.
   - rulerDrag unless `moved`: an unmoved ruler has no measurement to lose.
   sweep counts because sweepLift runs on contact — a shovel touch has already
   erased something by the time the second finger lands. */
function canvasGestureWouldLoseWork(){
  if (sweep || selDrag || selMove) return true;
  if (toolDrag && toolDrag.active) return true;
  if (rulerDrag && rulerDrag.moved) return true;
  if (game.tool==='building' && game.buildingDraft) return true;
  return false;
}
function cancelCanvasGesture(restore,notice){
  cancelPendingUndo(restore);
  sweep=null; toolDrag=null; fillTap=null; rulerDrag=null; panDrag=null; selDrag=null; selMove=null; photoDrag=null; photoPinch=null;
  game.hoverTile=null;
  if (game.tool==='building' && game.buildingDraft) cancelBuildingDraft();
  if (notice) showGestureCancel(notice);
  updateCanvasCursor();
}
function startMultiTouch(count){
  multiTouch={count,start:Date.now(),moved:false,pts:new Map(activePtrs)};
}
function markMultiMoved(){
  if (!multiTouch || multiTouch.moved) return;
  for (const [id,p] of activePtrs){
    const s=multiTouch.pts.get(id);
    if (s && Math.hypot(p[0]-s[0],p[1]-s[1])>10){ multiTouch.moved=true; return; }
  }
}
function screenDeltaToWorld(dx,dy){
  const W=VW/ZOOM,H=VH/ZOOM, o=screenOfFlat(0,0,W,H), px=screenOfFlat(1,0,W,H), py=screenOfFlat(0,1,W,H);
  const ax=px[0]-o[0], ay=px[1]-o[1], bx=py[0]-o[0], by=py[1]-o[1], det=ax*by-ay*bx||1;
  dx/=ZOOM; dy/=ZOOM;
  return [(dx*by-dy*bx)/det,(ax*dy-ay*dx)/det];
}
function photoWorldPoint(e){ const p=canvasClientPoint(e); return worldPointAt(p.x/ZOOM,p.y/ZOOM,VW/ZOOM,VH/ZOOM,0); }
function beginPhotoPointer(e){
  e.preventDefault();
  const pts=[...activePtrs.values()];
  if (pts.length>=2){
    const a=pts[0],b=pts[1], u=game.underlay;
    photoPinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,angle:Math.atan2(b[1]-a[1],b[0]-a[0]),
      mid:[(a[0]+b[0])/2,(a[1]+b[1])/2],width:u.widthTiles,rotation:u.rotation,cx:u.cx,cy:u.cy};
    photoDrag=null;
  } else photoDrag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:game.underlay.cx,cy:game.underlay.cy};
  try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
}
function movePhotoPointer(e){
  if (!activePtrs.has(e.pointerId)||!game.underlay) return;
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]); e.preventDefault();
  const pts=[...activePtrs.values()], u=game.underlay;
  if (pts.length>=2){
    if (!photoPinch) beginPhotoPointer(e);
    const a=pts[0],b=pts[1], d=Math.hypot(a[0]-b[0],a[1]-b[1])||1, ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2], move=screenDeltaToWorld(mid[0]-photoPinch.mid[0],mid[1]-photoPinch.mid[1]);
    u.widthTiles=Math.max(.5,Math.min(Math.max(GW,GH)*8,photoPinch.width*d/photoPinch.d));
    u.rotation=Math.max(-180,Math.min(180,photoPinch.rotation+(ang-photoPinch.angle)*180/Math.PI));
    u.cx=photoPinch.cx+move[0]; u.cy=photoPinch.cy+move[1];
  } else if (photoDrag){
    const move=screenDeltaToWorld(e.clientX-photoDrag.x,e.clientY-photoDrag.y);
    u.cx=photoDrag.cx+move[0]; u.cy=photoDrag.cy+move[1];
  }
  markUnderlayChanged(); if (typeof syncSitePhotoEditor==='function') syncSitePhotoEditor();
}
function finishMultiTouch(){
  if (!multiTouch || activePtrs.size) return;
  const quick=Date.now()-multiTouch.start<320;
  if (quick && !multiTouch.moved){
    if (multiTouch.count>=3){ doRedo(); showGestureCancel('Redo'); }
    else if (multiTouch.count===2){ doUndo(); showGestureCancel('Undo'); }
  }
  multiTouch=null;
}
cnv.addEventListener('pointerdown',e=>{
  activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  if (game.photoEditing && game.underlayCalibration){ e.preventDefault(); recordSitePhotoCalibrationPoint(photoWorldPoint(e)); return; }
  if (game.photoEditing && game.underlay){ beginPhotoPointer(e); return; }
  if (activePtrs.size>=3){
    startMultiTouch(3);
    pinch=null;
    cancelCanvasGesture(true,canvasGestureWouldLoseWork()?'Placement cancelled':null);
    return;
  }
  if (activePtrs.size===2){
    const [a,b2]=[...activePtrs.values()];
    pinch={d0:Math.hypot(a[0]-b2[0],a[1]-b2[1])||1, z0:userZoom,
           cx0:(a[0]+b2[0])/2, cy0:(a[1]+b2[1])/2,   // centroid, for two-finger pan
           camx0:cam.x, camy0:cam.y};
    startMultiTouch(2);
    // silent unless the pinch really interrupted something (see the helper)
    cancelCanvasGesture(true,canvasGestureWouldLoseWork()?'Placement cancelled':null);
    return;
  }
  if (activePtrs.size>1) return;
  // Hand tool pans the map; design mode also supports middle mouse / Space-drag.
  if (shouldStartPan(e)){
    e.preventDefault();
    /* A Hand press is ambiguous until it ends: drag pans, but a plain tap is
       how you ask what a plant is (inspectPlantAt, resolved at pointerup).
       Middle-mouse and Space-drag are unambiguously panning, so they opt out
       and keep behaving exactly as before. */
    const handTap = game.tool==='hand' && e.button!==1 && !spaceHeld;
    const pl = handTap ? evPlacement(e) : null;
    panDrag={sx:e.clientX, sy:e.clientY, camx0:cam.x, camy0:cam.y,
             tap:handTap, tx:pl?pl.x:0, ty:pl?pl.y:0};
    updateCanvasCursor();
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  game.hoverTile=(x>=0&&y>=0&&x<GW&&y<GH)?[x,y]:null;
  if (x<0||y<0||x>=GW||y>=GH) return;
  if (game.tool==='building'){ buildingPointerDown(place); return; }
  if (game.tool==='select'){ selPointerDown(x,y,e); return; }
  if (game.tool==='ruler'){
    const pending=game.ruler && game.ruler.a && !game.ruler.b ? game.ruler.a.slice() : null;
    rulerDrag={sx:x, sy:y, cx:x, cy:y, moved:false, pending};
    game.ruler=pending ? {a:pending,b:[x,y],active:true} : {a:[x,y],b:null,active:true};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    updateCanvasCursor();
    return;
  }
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
    sweep={plants:0, bulbs:0, terr:0, elev:0, house:0, building:0, fence:0, light:0, firepit:0, boulder:0, pet:0, pot:0, seat:0};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    sweepLift(x,y); return;
  }
  // plant/bulb/path/bed/water/elevation/fence/light/firepit: press-and-drag paints tiles like the shovel
  // sweeps them; a plain tap (resolved at pointerup) acts. (house already returned above.)
  if (isBrushTool(game.tool)){
    toolDrag={sx:x, sy:y, cx:x, cy:y, ox:place.ox, oy:place.oy, active:false, count:0, what:null,
      lastX:x,lastY:y,trace:[[x,y]],edgeSeen:new Set(),affected:new Set(),runInches:0};
    try{ cnv.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  tapAction(x,y,place);
});
function tapAction(x,y,opts){ // a plain tap acts directly on the tapped tile
  if (x<0||y<0||x>=GW||y>=GH) return;
  game.actX=x; game.actY=y; actHere(opts);
}
function finishToolDrag(){
  if (!toolDrag || !toolDrag.active) return;
  if (toolDrag.count){
    hapticFeedback('place');
    const changed=toolDrag.affected&&toolDrag.affected.size?toolDrag.affected.size:toolDrag.count;
    const def=PLANTS[game.tool] && plantDef(game.tool,game.toolVar);
    let msg;
    if (toolDrag.what==='path') msg=`Updated ${changed} path tile${changed>1?'s':''}.`;
    else if (toolDrag.what==='bed') msg=`Dug ${changed} bed tile${changed>1?'s':''}.`;
    else if (toolDrag.what==='water') msg=`Laid ${changed} water tile${changed>1?'s':''}.`;
    else if (toolDrag.what==='elevation') msg=`Adjusted ${changed} elevation tile${changed>1?'s':''}.`;
    else if (toolDrag.what==='fence'||toolDrag.what==='gate') msg=`Placed ${changed} ${fenceLabel().toLowerCase()} tile${changed>1?'s':''}.`;
    else if (toolDrag.what==='light') msg=`Placed ${changed} ${lightLabel().toLowerCase()}${changed>1?'s':''}.`;
    else if (toolDrag.what==='firepit') msg=`Placed ${changed} ${firepitLabel().toLowerCase()}${changed>1?'s':''}.`;
    else if (toolDrag.what==='boulder') msg=`Placed ${changed} ${boulderLabel().toLowerCase()}${changed>1?'s':''}.`;
    else if (toolDrag.what==='building') msg=`${buildingEditMode()==='remove'?'Trimmed':'Added'} ${changed} tile${changed>1?'s':''}.`;
    else msg=`Planted ${changed} - ${def.name}.`;
    toast(msg);
  } else if (!(game.tool==='building-edit' && buildingEditMode()==='rename')){
    // Rename acts on a tap, so a stray drag in that mode changed nothing on
    // purpose — "nothing would take along that line" would be a lie about it.
    toast('Nothing would take along that line.');
  }
}
function strokeLineTiles(x0,y0,x1,y1){
  const out=[], dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
  let err=dx+dy, x=x0, y=y0;
  while (true){ out.push([x,y]); if (x===x1&&y===y1) break;
    const e2=2*err; if (e2>=dy){ err+=dy; x+=sx; } if (e2<=dx){ err+=dx; y+=sy; }
  }
  return out;
}
function recordToolDragPoint(drag,x,y,what){
  const prev=drag.trace[drag.trace.length-1];
  if (!prev || prev[0]!==x || prev[1]!==y){
    const a=prev?`${prev[0]},${prev[1]}`:'', b=`${x},${y}`, edge=a<b?`${a}|${b}`:`${b}|${a}`;
    if (prev && !drag.edgeSeen.has(edge)){ drag.edgeSeen.add(edge); drag.runInches+=Math.hypot(x-prev[0],y-prev[1])*TILE_IN; }
    drag.trace.push([x,y]);
  }
  if (!what) return;
  const size=toolBrushSize();
  if (what==='bed'||what==='water'||what==='path'){
    for (const [dx,dy] of brushOffsets(size)){
      const xx=x+dx, yy=y+dy; if (xx<0||yy<0||xx>=GW||yy>=GH) continue;
      const terr=terrainAt(xx,yy); if (terr&&terr.k===what) drag.affected.add(`${xx},${yy}`);
    }
  } else drag.affected.add(`${x},${y}`);
}
function paintToolDragLine(drag,x,y,place){
  const pts=strokeLineTiles(drag.lastX,drag.lastY,x,y).slice(1);
  for (const [xx,yy] of pts){
    const opts=(xx===x&&yy===y)?place:null, r=stampBrushAt(xx,yy,opts);
    recordToolDragPoint(drag,xx,yy,r);
    if (r){ drag.count++; drag.what=r; }
  }
  drag.lastX=x; drag.lastY=y;
}
cnv.addEventListener('pointermove',e=>{
  if (game.photoEditing && game.underlayCalibration){
    if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId,[e.clientX,e.clientY]); return;
  }
  if (game.photoEditing && game.underlay){ movePhotoPointer(e); return; }
  if (panDrag){ // PC space/middle-drag pan
    cam.x=panDrag.camx0-(e.clientX-panDrag.sx)/ZOOM;
    cam.y=panDrag.camy0-(e.clientY-panDrag.sy)/ZOOM;
    return;
  }
  if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId,[e.clientX,e.clientY]);
  markMultiMoved();
  if (pinch && activePtrs.size>=2){
    const [a,b2]=[...activePtrs.values()];
    const d=Math.hypot(a[0]-b2[0],a[1]-b2[1])||1;
    if (Math.abs(d-pinch.d0)>8) multiTouch && (multiTouch.moved=true);
    setUserZoom(pinch.z0*d/pinch.d0);
    // two-finger drag pans the canvas (the camera is free)
    const cx=(a[0]+b2[0])/2, cy=(a[1]+b2[1])/2;
    cam.x=pinch.camx0-(cx-pinch.cx0)/ZOOM;
    cam.y=pinch.camy0-(cy-pinch.cy0)/ZOOM;
    // (two-finger twist-to-rotate removed — rotate via the ⟳ button or R key)
    return;
  }
  const place=evPlacement(e), x=place.x, y=place.y;
  // keep the brush/erase footprint ghost under the cursor even mid-drag
  game.hoverTile=(x>=0&&y>=0&&x<GW&&y<GH)?[x,y]:null;
  buildingHover=game.tool==='building' ? previewBuildingCorner(place) : null;
  if (game.tool==='select'){ if (selPointerMove(x,y)) return; }
  if (rulerDrag){
    if (x>=0&&y>=0&&x<GW&&y<GH){
      if (x!==rulerDrag.sx || y!==rulerDrag.sy) rulerDrag.moved=true;
      rulerDrag.cx=x; rulerDrag.cy=y;
      const a=rulerDrag.pending || [rulerDrag.sx,rulerDrag.sy];
      game.ruler={a:a,b:[x,y],active:true};
    }
    return;
  }
  if (sweep){ sweepLift(x,y); return; }
  if (toolDrag){
    if (x<0||y<0||x>=GW||y>=GH) return;
    toolDrag.cx=x; toolDrag.cy=y;
    if (!toolDrag.active && (x!==toolDrag.sx||y!==toolDrag.sy)){
      toolDrag.active=true; // crossed a tile line: it's a paint-drag now
      const r0=stampBrushAt(toolDrag.sx,toolDrag.sy,toolDrag);
      recordToolDragPoint(toolDrag,toolDrag.sx,toolDrag.sy,r0);
      if (r0){ toolDrag.count++; toolDrag.what=r0; }
    }
    if (toolDrag.active){
      paintToolDragLine(toolDrag,x,y,place);
    }
    return;
  }
});
cnv.addEventListener('wheel',e=>{
  if (!game.inGarden) return;
  if (game.photoEditing&&game.underlayCalibration){ e.preventDefault(); return; }
  if (game.photoEditing&&game.underlay){ e.preventDefault(); game.underlay.widthTiles=Math.max(.5,Math.min(Math.max(GW,GH)*8,game.underlay.widthTiles*(e.deltaY<0?1.06:.94)));
    markUnderlayChanged(); if (typeof syncSitePhotoEditor==='function') syncSitePhotoEditor(); return; }
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
  if (sweep.boulder) parts.push(`${sweep.boulder} boulder${sweep.boulder>1?'s':''}`);
  if (sweep.house) parts.push(`${sweep.house} house${sweep.house>1?'s':''}`);
  if (sweep.building) parts.push(`${sweep.building} building footprint${sweep.building>1?'s':''}`);
  if (parts.length){
    toast(`Erased ${parts.join(' and ')}.`);
  }
  else toast('Nothing to erase there.');
  sweep=null;
}
cnv.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if (game.photoEditing){
    photoPinch=null; photoDrag=null;
    if (activePtrs.size===1){ const [id,p]=[...activePtrs.entries()][0]; photoDrag={id,x:p[0],y:p[1],cx:game.underlay.cx,cy:game.underlay.cy}; }
    return;
  }
  if (activePtrs.size<2) pinch=null;
  finishMultiTouch();
  if (panDrag){
    const pd=panDrag; panDrag=null; updateCanvasCursor();
    /* Did the Hand press turn out to be a tap? A pinch can't reach here — the
       second pointer runs cancelCanvasGesture, which nulls panDrag — and
       activePtrs.size guards a finger still being down. */
    if (pd.tap && activePtrs.size===0 &&
        Math.abs(e.clientX-pd.sx)<=TAP_SLOP_PX && Math.abs(e.clientY-pd.sy)<=TAP_SLOP_PX){
      game.actX=pd.tx; game.actY=pd.ty;   // move the cursor diamond to the tapped tile
      inspectPlantAt(pd.tx,pd.ty);
    }
    return;
  }
  if (game.tool==='select' && (selDrag||selMove)){ selPointerUp(); return; }
  if (rulerDrag){
    const r=rulerDrag; rulerDrag=null;
    if (r.pending) game.ruler={a:r.pending,b:[r.cx,r.cy],active:false};
    else if (r.moved) game.ruler={a:[r.sx,r.sy],b:[r.cx,r.cy],active:false};
    else game.ruler={a:[r.sx,r.sy],b:null,active:false};
    updateCanvasCursor();
    return;
  }
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
  if (game.photoEditing){ photoPinch=null; photoDrag=null; return; }
  if (activePtrs.size<2) pinch=null;
  finishMultiTouch();
  cancelCanvasGesture(true);
});
cnv.addEventListener('auxclick',e=>{ if (e.button===1) e.preventDefault(); }); // no middle-click autoscroll
cnv.addEventListener('pointerleave',()=>{ game.hoverTile=null; buildingHover=null; });
