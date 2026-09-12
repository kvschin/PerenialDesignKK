'use strict';
/* ---------- the tool guidebook ----------
   A reference for every tool, opened from the main menu, in which each tool is
   shown DOING ITS JOB rather than described. Drift is the example that makes
   the case: "a loose cluster sized by spacing" is three abstractions deep, and
   one tap dropping nine coneflowers in a scatter is immediately obvious.

   It is the deliberate complement of the in-garden controls tour (tourSteps,
   ui.js), not a replacement. The tour is CONTEXTUAL — seven anchored callouts
   over the real garden, each completed by the gardener performing the gesture,
   and it runs once. This is a REFERENCE: it stands still, it covers tools the
   tour never reaches (edging, grade, water features, schemes), and it is
   re-openable forever from the title screen. Neither can do the other's job.

   ---------- how the demos are drawn ----------
   Every demo runs on a GUIDE STAGE: a small scratch garden with its own
   isometric projection that TOUCHES NO GAME STATE. That is the whole safety
   property of this module — the guidebook opens from the main menu, where the
   app may still be holding the layers of the last garden, and a reference
   screen that could disturb them would be a data-loss bug wearing a tutorial's
   clothes. A stage owns its own terrain/plants/props maps and its own camera,
   so nothing here can reach `game`, `cam`, `GW`/`GH`, the ground bake, the
   terrain trace, or either sprite cache.

   What it does NOT do is redraw the garden. Every mark on a stage comes from
   the app's OWN painters — drawPlant, drawGroundTexture, drawWaterTexture,
   drawEdgingRun, fencePanel, drawPotArt, drawSeatArt, drawSupportArt,
   drawWaterFeatureArt, drawPet — all of which already take a context and a
   screen point and read no game state, because the tray chips and the plant
   library needed exactly that first (drawMaterialIcon, libCanvas). So a
   guidebook demo cannot advertise a plant, a material or a fence the canvas
   does not draw: it is the fencePanel lesson applied to documentation.

   Two painters are camera-coupled (drawBoulder and drawFirepit position
   themselves through footprintScreenPoly -> screenOf, which reads `cam`,
   `game.rot` and the elevation map). Those two run inside gsBorrowCamera,
   which overrides exactly four fields and restores them in a `finally` — the
   captureGardenPortrait pattern, narrowed to the smallest possible bracket.

   ---------- the rules are the real rules ----------
   Where a demo asserts a NUMBER it asks the app rather than restating it:
   driftCount() decides how many plants a drift lays, brushOffsets() decides
   which tiles a disc brush covers, DRIFT_OFFSETS is the very table stampDrift
   walks, and plantDef/bloomLevel decide what a plant looks like this season.
   A guidebook that quietly disagreed with the app would be worse than none, so
   the numbers have one definition and the tests pin the shared ones.

   ---------- cost ----------
   One rAF, owned here, running ONLY while the guidebook is open AND a demo is
   on screen (the chapter list animates nothing). It is stopped on close, on
   navigating back to the list, and while the tab is hidden. Under
   reducedMotion() nothing loops at all: the demo is drawn at its resting frame
   and a Play button steps it once on request, which is the same bargain the
   season crossfade makes. */

/* ---------- the stage ---------- */

/* Fields are deliberately plain: `terrain`, `plants` and `elev` are keyed maps
   in exactly the shape game.terrain / game.plants / game.elevation use, so a
   demo can be written by reading the placement code it documents. `props` is
   one flat array because a stage has a handful of objects and a depth sort
   over a list is cheaper to read than five parallel maps. */
function guideStage(opts){
  opts=opts||{};
  return {
    cols:opts.cols||7, rows:opts.rows||7,
    season:opts.season||'Summer',
    rot:opts.rot||0,
    zoom:opts.zoom||1,
    pan:opts.pan||[0,0],          // extra screen offset, in draw units
    terrain:Object.create(null),  // "x,y" -> {k,c,e}
    elev:Object.create(null),     // "x,y" -> integer level
    plants:Object.create(null),   // "x,y" -> {s,v,g}  (g = growth 0..1)
    props:[],                     // {kind,x,y,...}
    cursor:null,                  // {x,y,down,press,drag,label}
    notes:[],                     // floating text over the stage
    chrome:null                   // a mocked control drawn in the corner
  };
}
const gsKey=(x,y)=>x+','+y;
function gsSet(map,x,y,v){ const k=gsKey(x,y); if (v===null) delete map[k]; else map[k]=v; }
function gsGet(map,x,y){ return map[gsKey(x,y)]||null; }
function gsTerrain(st,x,y){ const t=gsGet(st.terrain,x,y); return t?t.k:null; }
function gsElev(st,x,y){ return gsGet(st.elev,x,y)||0; }
function gsOnStage(st,x,y){ return x>=0&&y>=0&&x<st.cols&&y<st.rows; }
/* Lawn as isLawnTile means it: bare ground, or a painted lawn material. A
   demo's edging must answer this the same way the garden does or the strip
   would draw on the wrong sides. */
function gsIsLawn(st,x,y){
  if (!gsOnStage(st,x,y)) return false;
  const t=gsTerrain(st,x,y);
  return !t || t==='lawn';
}

/* The view transform, mirrored from worldToView on the stage's own extent. A
   stage rotates for exactly one demo (Turn the view) and is identity for every
   other, but writing it out is what lets that demo be the real gesture rather
   than a picture of it. */
function gsView(st,x,y){
  switch(st.rot&3){
    case 1:  return [y, st.cols-1-x];
    case 2:  return [st.cols-1-x, st.rows-1-y];
    case 3:  return [st.rows-1-y, x];
    default: return [x,y];
  }
}
/* Screen point of a tile's TOP CORNER, which is what every ground painter
   wants; a plant stands at [sx, sy+TILE_H/2], the tile centre, exactly as
   drawSceneEnt places it. */
function gsProject(st,x,y){
  const [vx,vy]=gsView(st,x,y);
  return [isoX(vx,vy)+st.pan[0], isoY(vx,vy)+st.pan[1]-gsElev(st,x,y)*ELEV_STEP];
}
// Sub-tile points (a cursor between two tiles) take the same path, unrotated
// elevation — a fractional coordinate has no record to look up.
function gsProjectAt(st,x,y){
  const [vx,vy]=gsView(st,Math.round(x),Math.round(y));
  const fx=x-Math.round(x), fy=y-Math.round(y);
  const [dx,dy]=gsViewDir(st,fx,fy);
  return [isoX(vx+dx,vy+dy)+st.pan[0], isoY(vx+dx,vy+dy)+st.pan[1]-gsElev(st,Math.round(x),Math.round(y))*ELEV_STEP];
}
function gsViewDir(st,dx,dy){
  switch(st.rot&3){
    case 1:  return [dy,-dx];
    case 2:  return [-dx,-dy];
    case 3:  return [-dy,dx];
    default: return [dx,dy];
  }
}
// Depth key: the view-space sum, exactly viewDepth's ordering at any rotation.
function gsDepth(st,x,y){ const [vx,vy]=gsView(st,x,y); return vx+vy; }

/* The extent of the whole stage in draw units, used to fit it to the canvas.
   Measured from the four plot corners through the live transform rather than
   assumed, so a rotated stage still fits. */
function gsExtent(st){
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for (let y=0;y<st.rows;y++) for (let x=0;x<st.cols;x++){
    const [sx,sy]=gsProject(st,x,y);
    x0=Math.min(x0,sx-TILE_W/2); x1=Math.max(x1,sx+TILE_W/2);
    y0=Math.min(y0,sy-90);       y1=Math.max(y1,sy+TILE_H+16);
  }
  return {x0,x1,y0,y1};
}

/* ---------- painters ----------
   Each of these is the garden's own painter with the stage standing in for the
   world. The per-tile branches below are paintGroundTile's, minus the parts
   that only a real garden has (doors, the underlay, the snow flecks). */

function gsGroundColour(st,x,y,amb){
  const o=gsGet(st.terrain,x,y), k=o&&o.k;
  const rs=mulberry(tileSeed(x,y));
  if (k==='water') return {col:waterFill(o,amb.snow),o,k,rs};
  if (k==='path')  return {col:pathFill(o,amb.snow),o,k,rs};
  if (k==='bed'){ rs(); return {col:bedFill(o,amb),o,k,rs}; }   // the stream draw paintGroundTile keeps
  if (k==='lawn')  return {col:lawnFill(o,amb),o,k,rs};
  return {col:shade(amb.grass[(x+y)%2],(rs()-0.5)*14),o,k:null,rs};
}
/* A terrace's exposed faces. drawElevationSides itself reads the elevation map
   and the wall material through screenOf, so this is the same drawing against
   the stage — including the wall facing, which goes through the real
   drawWallSurface so a dry-stone wall in the guidebook is the dry-stone wall. */
function gsElevationSides(ctx,st,x,y,base){
  const h=gsElev(st,x,y); if (h<=0) return;
  const [sx,sy]=gsProject(st,x,y), cy=sy+TILE_H/2;
  const o=gsGet(st.terrain,x,y), wall=wallStyle(o&&o.w);
  const right=[sx+TILE_W/2,cy], bottom=[sx,sy+TILE_H], left=[sx-TILE_W/2,cy];
  /* Which neighbour each visible face looks at has to be asked in VIEW space —
     drawBuildingTile's bug, one system over: at rot 2 the screen-right face is
     the world-left neighbour, and striking the face anyway paints it across
     the terrace's own interior. */
  const faces=[[[1,0],right,bottom],[[0,1],bottom,left]];
  faces.forEach(([[dvx,dvy],a,b])=>{
    const [dx,dy]=gsViewDir(st,dvx,dvy);
    const drop=(h-gsElev(st,x+dx,y+dy))*ELEV_STEP;
    if (drop<=0) return;
    if (wall.face){
      const mid=[];
      drawWallSurface(ctx,{at:t=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t],
        between:()=>mid, units:1}, drop, wall, tileSeed(x,y));
    } else {
      ctx.fillStyle=shade(base,-26);
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
      ctx.lineTo(b[0],b[1]+drop); ctx.lineTo(a[0],a[1]+drop); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(35,28,20,0.16)'; ctx.lineWidth=1; ctx.stroke();
    }
  });
}
/* Edging draws only where a material tile meets LAWN — the rule that makes
   filling a bed the natural gesture rather than tracing its outline, and the
   reason an edge that becomes interior stops drawing on its own. This is
   drawTileEdging against the stage. */
function gsEdging(ctx,st,x,y){
  const o=gsGet(st.terrain,x,y); if (!o) return;
  const t=edgingStyle(o.e); if (!t.w) return;
  const [sx,sy]=gsProject(st,x,y), cy=sy+TILE_H/2;
  const N=[sx,sy], E=[sx+TILE_W/2,cy], S=[sx,sy+TILE_H], Wp=[sx-TILE_W/2,cy];
  [[[1,0],E,S],[[0,1],S,Wp],[[-1,0],Wp,N],[[0,-1],N,E]].forEach(([[dvx,dvy],a,b])=>{
    const [dx,dy]=gsViewDir(st,dvx,dvy);
    if (!gsIsLawn(st,x+dx,y+dy)) return;
    drawEdgingRun(ctx,[a,b],t,tileSeed(x,y));
  });
}
function gsPaintGround(ctx,st,amb){
  const tiles=[];
  for (let y=0;y<st.rows;y++) for (let x=0;x<st.cols;x++) tiles.push([x,y]);
  tiles.sort((a,b)=>(gsDepth(st,a[0],a[1])-gsDepth(st,b[0],b[1]))
    || (gsElev(st,a[0],a[1])-gsElev(st,b[0],b[1])));
  tiles.forEach(([x,y])=>{
    const {col,o,k,rs}=gsGroundColour(st,x,y,amb);
    const [sx,sy]=gsProject(st,x,y);
    gsElevationSides(ctx,st,x,y,col);
    if (k==='water') drawWaterTexture(ctx,sx,sy,x,y,o,amb,false,gsWaterDepth(st,x,y));
    else drawGroundTexture(ctx,sx,sy,x,y,k,k==='path',amb,col,rs,o);
    gsEdging(ctx,st,x,y);
  });
}
/* The real waterField derives depth from distance to the bank and caches it on
   terrainRev; on a stage that is a handful of tiles, the same chamfer answer
   comes out of counting how far the water reaches, and drawWaterTexture takes
   a depth hint for exactly this reason (drawMaterialIcon passes one too). */
function gsWaterDepth(st,x,y){
  let d=6;
  for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++){
    if (gsTerrain(st,x+dx,y+dy)!=='water') d=Math.min(d,Math.max(Math.abs(dx),Math.abs(dy)));
  }
  return Math.max(0.6,Math.min(6,d*1.6));
}

/* ---------- props ----------
   Everything that stands on the ground. Each kind is drawn by the app's own
   painter; the two that position themselves through the live camera borrow it
   for the length of one call. */

/* drawBoulder and drawFirepit find their footprint through footprintScreenPoly
   -> screenOf, which reads cam, game.rot and the elevation map. Rather than
   reimplementing two silhouettes (which would then be free to drift from the
   garden's), the stage lends them a camera that lands the footprint exactly
   where the stage wants it and takes it back in a `finally`. Four fields, one
   synchronous call, no allocation of game state and no cache touched — the
   captureGardenPortrait pattern at its smallest. */
function gsBorrowCamera(sx,sy,fn){
  const prior={x:cam.x,y:cam.y,rot:game.rot,elev:game.elevation};
  try{
    /* viewScreen is W/2 + isoX(0,0) - cam.x, so a camera of -(sx) puts world
       tile (0,0) at screen sx with W=H=0. Elevation is emptied for the same
       reason rot is pinned: screenOf must answer about the stage, not about
       whatever garden the app last held. */
    game.rot=0; game.elevation=Object.create(null);
    cam.x=-sx; cam.y=-sy;
    fn(0,0);
  } finally {
    cam.x=prior.x; cam.y=prior.y; game.rot=prior.rot; game.elevation=prior.elev;
  }
}
/* Half-segments out to the neighbouring fence tiles, which is what drawFence
   lays down: each tile paints from its own centre to 0.48 of the way to each
   fence neighbour, so two tiles meet at a shared joint with no seam, and a
   post goes in wherever fencePostHere would put one. */
function gsDrawFence(ctx,st,p){
  const st2=fenceStyle(p.style), h=Math.round(fenceHeightFor(fenceStyleId(p.style),p.height)*PX_PER_FT);
  const here=gsProjectAt(st,p.x,p.y), seed=tileSeed(p.x,p.y);
  const foot=[here[0],here[1]+TILE_H/2];
  const isFence=(x,y)=>st.props.some(q=>q.kind==='fence'&&q.x===x&&q.y===y);
  let ends=0;
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    if (!isFence(p.x+dx,p.y+dy)) return;
    ends++;
    const to=gsProjectAt(st,p.x+dx*0.48,p.y+dy*0.48);
    fencePanel(ctx,foot[0],foot[1],to[0],to[1]+TILE_H/2,h,st2,st2.infill,seed);
  });
  if (!ends) fencePanel(ctx,foot[0]-TILE_W*0.24,foot[1]-TILE_H*0.24,
    foot[0]+TILE_W*0.24,foot[1]+TILE_H*0.24,h,st2,st2.infill,seed);
  // a run end, a corner or a tee always gets a post; a straight run gets one
  // every FENCE_POST_TILES, which at 18in a tile is 6ft on centre
  const straight=ends===2 && (isFence(p.x+1,p.y)===isFence(p.x-1,p.y));
  if (ends!==2 || !straight || (p.x+p.y)%FENCE_POST_TILES===0){
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=5.6;
    ctx.beginPath(); ctx.moveTo(foot[0],foot[1]+1); ctx.lineTo(foot[0],foot[1]-h-2); ctx.stroke();
    ctx.strokeStyle=st2.post; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(foot[0],foot[1]); ctx.lineTo(foot[0],foot[1]-h); ctx.stroke();
  }
}
/* The centre of a multi-tile footprint, which is the one thing a piece
   standing on more than one tile has to get right — groundCenterRot's job in
   the garden, and the bug that put a stock tank 152px off its own tiles. The
   two EXTREME tile centres averaged is correct at every rotation; the four
   footprint CORNERS are not, because that lattice rotates differently. */
function gsFootCentre(st,x,y,sz){
  const a=gsProject(st,x,y), b=gsProject(st,x+sz.w-1,y+sz.h-1);
  return [(a[0]+b[0])/2,(a[1]+b[1])/2+TILE_H/2];
}
function gsDrawProp(ctx,st,p){
  const season=st.season, axes=ISO_AXES_FLAT;
  switch(p.kind){
    case 'fence': return gsDrawFence(ctx,st,p);
    case 'pot':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawPotArt(ctx,cx,cy,{style:p.style,size:p.size,face:p.face|0},season,axes);
    }
    case 'seat':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawSeatArt(ctx,cx,cy,{type:p.type,finish:p.finish,face:p.face|0},season,axes);
    }
    case 'support':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawSupportArt(ctx,cx,cy,normalizeSupportDraft(p),season,axes,tileSeed(p.x,p.y));
    }
    case 'waterfeature':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawWaterFeatureArt(ctx,cx,cy,normalizeWaterFeatureDraft(p),season,axes,
        tileSeed(p.x,p.y));
    }
    case 'pet':{
      const d=normalizePetDraft({species:p.species,coat:p.coat,mark:p.mark,paws:p.paws});
      const [sx,sy]=gsProject(st,p.x,p.y);
      return drawPet(ctx,sx,sy+TILE_H/2,d,1);
    }
    case 'boulder':{
      const [sx,sy]=gsProject(st,p.x,p.y);
      return gsBorrowCamera(sx,sy,(x,y)=>drawBoulder(ctx,0,0,season,{type:p.type},x,y));
    }
    case 'firepit':{
      const [sx,sy]=gsProject(st,p.x,p.y);
      return gsBorrowCamera(sx,sy,(x,y)=>drawFirepit(ctx,0,0,season,{shape:p.shape,size:p.size},x,y));
    }
  }
}
/* How many tiles a prop stands on, asked of the app's own size functions
   rather than typed into the demo. It decides both where a multi-tile piece is
   CENTRED and how it sorts, and a hand-written number is exactly the drift this
   module exists to avoid — a wrong one puts a climber a whole tile behind the
   trellis it climbs. */
function gsPropSize(p){
  switch(p.kind){
    case 'pot':    return potTileSize({style:p.style,size:p.size,face:p.face|0});
    case 'seat':   return seatTileSize({type:p.type,finish:p.finish,face:p.face|0});
    case 'support':return supportTileSize(normalizeSupportDraft(p));
    case 'waterfeature': return waterFeatureTileSize(normalizeWaterFeatureDraft(p));
    case 'boulder':return boulderTileSize({type:p.type});
    case 'firepit':return firepitTileSize({shape:p.shape,size:p.size});
    default:       return {w:1,h:1};
  }
}
/* Entity depths mirror the garden's, value for value (see buildScene): a plant
   and a POT both sort at +0.30 and the plant is pushed first, which is what
   lets a potted plant draw over the rim it stands on; a fence is +0.34 so a
   climber on it comes in front; a pet is +0.42, in front of everything sharing
   its tile. A piece standing on more than one tile sorts on the FAR corner of
   its footprint. */
function gsPropDepth(st,p){
  if (p.kind==='pet') return gsDepth(st,p.x,p.y)+0.42;
  if (p.kind==='fence') return gsDepth(st,p.x,p.y)+0.34;
  const sz=gsPropSize(p);
  const far=Math.max(gsDepth(st,p.x,p.y),gsDepth(st,p.x+sz.w-1,p.y),
                     gsDepth(st,p.x,p.y+sz.h-1),gsDepth(st,p.x+sz.w-1,p.y+sz.h-1));
  return far+(p.kind==='pot'?0.30:p.kind==='support'?0.30:0.375);
}
function gsPaintEntities(ctx,st,sway){
  const ents=[];
  Object.keys(st.plants).forEach(k=>{
    const p=st.plants[k]; if (!p||p.g<=0.02) return;
    const [x,y]=k.split(',').map(Number);
    ents.push({d:gsDepth(st,x,y)+0.30, draw:()=>{
      const [sx,sy]=gsProject(st,x+(p.ox||0),y+(p.oy||0));
      /* A plant standing in a container starts at the RIM, not the ground —
         plantScreenOf's one lift, and what keeps a pot of tulips and a pot of
         sedge agreeing about where soil level is. */
      const pot=st.props.find(q=>q.kind==='pot'&&q.x===x&&q.y===y);
      const lift=pot?potLiftPx({size:potSizeFor(pot.style,pot.size)}):0;
      ctx.save(); if (p.alpha!==undefined) ctx.globalAlpha=p.alpha;
      /* bloomLvl 1, the way tray icons and library previews force it. Left
         undefined, drawPlant falls through to bloomLevel(), which resolves
         against absDay() — the LIVE clock — so a demo would show a different
         flower depending on when the session started, and this module would be
         reading game state after all. The season still decides WHETHER there is
         a flower, because that comes from the species' own `sea` block. */
      drawPlant(ctx,sx,sy+TILE_H/2-lift,p.s,p.g,st.season,tileSeed(x,y),sway,p.v,
        p.bloom===undefined?1:p.bloom);
      ctx.restore();
    }});
  });
  st.props.forEach(p=>ents.push({d:gsPropDepth(st,p),draw:()=>gsDrawProp(ctx,st,p)}));
  ents.sort((a,b)=>a.d-b.d);
  ents.forEach(e=>e.draw());
}

/* ---------- the overlay ----------
   A pointer, whatever it is about to affect, and a caption. This is the layer
   that turns a still garden into an instruction: without a visible cursor a
   demo is just a picture that changes, and the gardener cannot tell which of
   the two things on screen was the gesture and which was the result. */

function gsBrushGhost(ctx,st,x,y,size,tone){
  brushOffsets(size).forEach(([dx,dy])=>{
    const tx=x+dx, ty=y+dy; if (!gsOnStage(st,tx,ty)) return;
    const [sx,sy]=gsProject(st,tx,ty);
    isoDiamondPath(ctx,sx,sy,1.5);
    ctx.fillStyle=tone||'rgba(239,230,211,0.20)'; ctx.fill();
    ctx.strokeStyle=tone?'rgba(217,100,90,0.55)':'rgba(239,230,211,0.42)';
    ctx.lineWidth=1.2; ctx.stroke();
  });
}
function gsTileMark(ctx,st,x,y,fill,stroke){
  const [sx,sy]=gsProject(st,x,y);
  isoDiamondPath(ctx,sx,sy,1.5);
  if (fill){ ctx.fillStyle=fill; ctx.fill(); }
  if (stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=1.6; ctx.stroke(); }
}
/* The pointer. Drawn as a ring rather than a mouse arrow because both pointers
   this app supports are touches as often as they are mice, and a ring reads as
   "here" on either. `press` is 0..1 and drives the contact ripple, so a tap
   and a held drag are visibly different gestures. */
function gsDrawCursor(ctx,st,cur){
  if (!cur) return;
  const [sx,sy]=gsProjectAt(st,cur.x,cur.y);
  const cy=sy+TILE_H/2;
  if (cur.press>0){
    const r=10+cur.press*26;
    ctx.strokeStyle=`rgba(201,127,63,${0.55*(1-cur.press)})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(sx,cy,r,r*0.5,0,0,Math.PI*2); ctx.stroke();
  }
  ctx.save();
  ctx.fillStyle=cur.down?'rgba(201,127,63,0.42)':'rgba(239,230,211,0.20)';
  ctx.strokeStyle=cur.down?'#c97f3f':'rgba(239,230,211,0.85)';
  ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.ellipse(sx,cy,13,6.5,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(sx,cy-2,2.6,0,Math.PI*2); ctx.fillStyle='#efe6d3'; ctx.fill();
  ctx.restore();
}
/* A caption pinned to a tile — "×9", "refused", "18 in". Plated, because it
   sits over an arbitrary garden and the chrome follows the theme while the
   ground follows the season, so neither theme is safe over bare canvas. */
function gsDrawNote(ctx,st,n,box){
  const p=n.at ? gsProjectAt(st,n.at[0],n.at[1]) : [0,-40];
  ctx.save();
  ctx.font="600 13px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const w=ctx.measureText(n.text).width+18, h=24;
  /* Kept inside the plate. A note hangs off a TILE, so one pinned above a tile
     near the top edge draws off the canvas — the drift demo's own count label
     was half cut off, which is the single sentence that demo exists to say. */
  let x=p[0]+(n.dx||0), y=p[1]+(n.dy||0);
  if (box){
    x=Math.max(box.x0+w/2+4,Math.min(box.x1-w/2-4,x));
    y=Math.max(box.y0+h/2+4,Math.min(box.y1-h/2-4,y));
  }
  ctx.globalAlpha=n.alpha===undefined?1:n.alpha;
  ctx.fillStyle=n.tone==='warn'?'rgba(126,42,35,0.92)'
    : n.tone==='good'?'rgba(58,74,48,0.92)':'rgba(26,21,17,0.88)';
  const r=7;
  ctx.beginPath(); ctx.moveTo(x-w/2+r,y-h/2);
  ctx.arcTo(x+w/2,y-h/2,x+w/2,y+h/2,r); ctx.arcTo(x+w/2,y+h/2,x-w/2,y+h/2,r);
  ctx.arcTo(x-w/2,y+h/2,x-w/2,y-h/2,r); ctx.arcTo(x-w/2,y-h/2,x+w/2,y-h/2,r);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=n.tone==='warn'?'#f3c9c4':'#efe6d3';
  ctx.fillText(n.text,x,y);
  ctx.restore();
}
/* A mocked control, drawn in the corner of the stage. Several tools are armed
   from a chip rather than from the canvas — Drift, the brush sizes, Age,
   Layers — and a demo that showed only the canvas would be teaching the second
   half of a two-part instruction. Drawn rather than built from real DOM
   because the real controls live inside the planner's HUD, which does not
   exist on the title screen. */
function gsDrawChrome(ctx,st,box,ch){
  if (!ch) return;
  const pad=10, gap=6, hgt=34;
  ctx.save();
  ctx.font="600 12.5px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textBaseline='middle';
  const widths=ch.options.map(o=>ctx.measureText(o).width+22);
  const total=widths.reduce((a,b)=>a+b,0)+gap*(widths.length-1)+pad*2;
  let x=box.x0+16, y=box.y0+16;
  if (ch.align==='bottom') y=box.y1-hgt-16;
  ctx.fillStyle='rgba(26,21,17,0.86)';
  const r=9;
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+total,y,x+total,y+hgt,r); ctx.arcTo(x+total,y+hgt,x,y+hgt,r);
  ctx.arcTo(x,y+hgt,x,y,r); ctx.arcTo(x,y,x+total,y,r);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(239,230,211,0.18)'; ctx.lineWidth=1; ctx.stroke();
  let cx2=x+pad;
  ch.options.forEach((o,i)=>{
    const w=widths[i], on=i===ch.on;
    if (on){
      ctx.fillStyle='#c97f3f';
      ctx.beginPath(); ctx.moveTo(cx2+5,y+5);
      ctx.arcTo(cx2+w,y+5,cx2+w,y+hgt-5,5); ctx.arcTo(cx2+w,y+hgt-5,cx2,y+hgt-5,5);
      ctx.arcTo(cx2,y+hgt-5,cx2,y+5,5); ctx.arcTo(cx2,y+5,cx2+w,y+5,5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle=on?'#1a1511':'rgba(239,230,211,0.72)';
    ctx.textAlign='center'; ctx.fillText(o,cx2+w/2,y+hgt/2);
    cx2+=w+gap;
  });
  if (ch.tapping!==undefined && ch.tapping>0){
    const w=widths[ch.on], cxT=x+pad+widths.slice(0,ch.on).reduce((a,b)=>a+b+gap,0)+w/2;
    ctx.strokeStyle=`rgba(201,127,63,${0.6*(1-ch.tapping)})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cxT,y+hgt/2,10+ch.tapping*20,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- one frame ----------
   Fit the stage to the canvas, paint sky, ground, entities, overlay. The fit is
   measured from the stage's real extent rather than assumed, so a demo can be
   any size and a rotating one still stays on screen. */
function gsRender(ctx,st,w,h,sway){
  const amb=AMBIENCE[st.season];
  ctx.save();
  ctx.clearRect(0,0,w,h);
  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,amb.sky[0]); sky.addColorStop(1,amb.sky[1]);
  ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);

  const e=gsExtent(st);
  const pad=14;
  const s=Math.min((w-pad*2)/Math.max(1,e.x1-e.x0),(h-pad*2)/Math.max(1,e.y1-e.y0))*st.zoom;
  ctx.translate(w/2,h/2); ctx.scale(s,s);
  ctx.translate(-(e.x0+e.x1)/2,-(e.y0+e.y1)/2);

  gsPaintGround(ctx,st,amb);
  gsPaintEntities(ctx,st,sway);
  (st.marks||[]).forEach(m=>gsTileMark(ctx,st,m.x,m.y,m.fill,m.stroke));
  if (st.ghost) gsBrushGhost(ctx,st,st.ghost.x,st.ghost.y,st.ghost.size,st.ghost.tone);
  gsDrawCursor(ctx,st,st.cursor);
  /* Captions are clamped to the PLATE, which in stage units is the canvas
     mapped back through the fit — so the bounds have to be computed here,
     where the scale is known, rather than from the stage's own extent. */
  const mx=(e.x0+e.x1)/2, my=(e.y0+e.y1)/2;
  const nb={x0:mx-w/2/s, x1:mx+w/2/s, y0:my-h/2/s, y1:my+h/2/s};
  st.notes.forEach(n=>gsDrawNote(ctx,st,n,nb));
  ctx.restore();

  // The season's light wash, painted in SCREEN space so the vignette follows
  // the frame rather than the stage.
  const L=SEASON_LIGHT[st.season];
  ctx.save();
  ctx.fillStyle=amb.tint; ctx.fillRect(0,0,w,h);
  const vg=ctx.createRadialGradient(w/2,h*0.45,Math.min(w,h)*0.25,w/2,h*0.5,Math.max(w,h)*0.72);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,L.vignette);
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);
  ctx.restore();
  if (st.chrome) gsDrawChrome(ctx,st,{x0:0,y0:0,x1:w,y1:h},st.chrome);
}

/* ---------- the timeline ----------
   A demo is a pure function of one number: `u`, the loop position in 0..1. It
   rebuilds the stage from scratch every frame rather than accumulating state,
   which costs nothing at this size and buys two things worth more — a demo can
   be scrubbed to any point (which is what reduced motion needs, since it draws
   one still frame), and a dropped frame cannot leave it in a state its script
   never described. */
const gClamp=v=>v<0?0:v>1?1:v;
const gAt=(u,a,b)=>gClamp((u-a)/(b-a||1));          // 0..1 across a window of the loop
const gEase=v=>v*v*(3-2*v);                          // smoothstep
const gHold=(u,a,b)=>u>=a&&u<b;
/* A tap: 90ms of contact at `at`, then a ripple that fades over ~0.14 of the
   loop. Returns what the cursor needs, so a tap looks the same everywhere. */
function gTap(u,at,len){
  len=len||0.10;
  const p=gAt(u,at,at+len);
  return {down:u>=at&&u<at+len*0.45, press:u<at?0:p};
}
// Position along a polyline of [x,y] stage points, eased.
function gPath(u,pts){
  if (u<=0) return pts[0].slice();
  if (u>=1) return pts[pts.length-1].slice();
  const seg=(pts.length-1)*gEase(u), i=Math.min(pts.length-2,Math.floor(seg)), f=seg-i;
  return [pts[i][0]+(pts[i+1][0]-pts[i][0])*f, pts[i][1]+(pts[i+1][1]-pts[i][1])*f];
}

/* ---------- stage fixtures ----------
   Small builders, so a demo says what it is about rather than what it is made
   of. Every species named here is a real catalogue key and is drawn by
   drawPlant at its real season colours. */
function gsFill(st,k,c,x0,y0,x1,y1,extra){
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    if (!gsOnStage(st,x,y)) continue;
    gsSet(st.terrain,x,y,Object.assign({k,c},extra||{}));
  }
}
function gsPlant(st,x,y,s,g,v){
  if (!gsOnStage(st,x,y)) return;
  gsSet(st.plants,x,y,{s,v,g:g===undefined?1:g});
}
/* A few plants scattered so a stage reads as a garden rather than a test grid.
   Seeded from the tile, so the same demo comes back identical every open. */
function gsScatter(st,keys,tiles,g){
  tiles.forEach(([x,y],i)=>gsPlant(st,x,y,keys[i%keys.length],g===undefined?1:g));
}

/* ---------- the demos ----------
   One entry per tool, keyed by id. `build` makes the resting scene, `run`
   plays the gesture over it, `rest` is where reduced motion parks. Keeping
   them in one table rather than in the markup is the settingsSections /
   tourSteps split, and for the same reason: the sandbox has no layout engine,
   so a test over rendered DOM would pass without testing anything, while a
   table and its pure functions run headless.

   `run` is handed a freshly built stage every frame and may only mutate THAT.
   Nothing in here may touch game state; the tests assert it. */

const GUIDE_DEMOS={

/* ----- finding your way ----- */

move:{ loop:9000, rest:0.55,
  build(){ const st=guideStage({cols:9,rows:9});
    gsFill(st,'lawn','meadow',0,0,8,8);
    gsFill(st,'path','warm',0,4,8,4);
    gsScatter(st,['bluestem','echinacea','dropseed','monarda','sedge'],
      [[1,1],[2,2],[3,1],[6,2],[7,3],[1,6],[3,7],[5,6],[7,7],[2,5],[6,6]]);
    st.props.push({kind:'seat',x:5,y:1,type:'bench6',finish:'teak',face:0});
    return st; },
  run(st,u){
    // The camera has exactly two gestures, so the demo has two halves.
    if (u<0.5){
      const f=gEase(gAt(u,0.08,0.44));
      st.pan=[-70*f,-26*f];
      const c=gPath(gAt(u,0.08,0.44),[[5,6],[3,4.4]]);
      st.cursor={x:c[0],y:c[1],down:u>0.06&&u<0.46,press:0};
      st.notes=[{text:'Drag anywhere to move',at:[4,7.6],dy:26,
        alpha:gAt(u,0,0.1)*(1-gAt(u,0.42,0.5))}];
    } else {
      const f=gEase(gAt(u,0.56,0.86));
      st.pan=[-70,-26]; st.zoom=1+0.55*f;
      st.cursor={x:4,y:4,down:u>0.55&&u<0.88,press:0};
      st.notes=[{text:'Two fingers, or the wheel, to zoom',at:[4,7.6],dy:26,
        alpha:gAt(u,0.5,0.58)*(1-gAt(u,0.9,1))}];
    }
  }},

turn:{ loop:9600, rest:0.3,
  build(){ const st=guideStage({cols:7,rows:7});
    gsFill(st,'bed','mulch',1,1,3,3);
    gsFill(st,'path','slate',0,5,6,5);
    gsScatter(st,['echinacea','bluestem','monarda','dropseed'],
      [[1,1],[2,1],[3,2],[2,3],[1,2],[3,1]]);
    st.props.push({kind:'seat',x:5,y:2,type:'chair',finish:'painted',face:1});
    st.props.push({kind:'pot',x:5,y:6,style:'terracotta',size:'p18',face:0});
    return st; },
  run(st,u){
    // Four quarters, one per rotation. The view turns; nothing in the garden
    // moves, which is the whole point — world logic never rotates.
    st.rot=Math.floor(u*4)%4;
    st.zoom=1-0.05*Math.sin(gEase(gAt((u*4)%1,0,0.35))*Math.PI);
    st.notes=[{text:'R, or the turn button — a quarter at a time',at:[3,6.4],dy:30}];
  }},

identify:{ loop:7000, rest:0.62,
  build(){ const st=guideStage({cols:6,rows:6});
    gsFill(st,'bed','soil',0,0,5,5);
    gsScatter(st,['echinacea','bluestem','monarda','dropseed','sedge','pallida'],
      [[1,1],[3,1],[2,2],[4,3],[1,4],[3,4],[4,1],[2,4]]);
    return st; },
  run(st,u){
    const c=gPath(gAt(u,0.05,0.38),[[4.6,4.6],[2,2]]);
    const tap=gTap(u,0.42);
    st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
    if (u>0.5){
      const P=plantDef('monarda');
      const a=gAt(u,0.5,0.62)*(1-gAt(u,0.94,1));
      st.marks=[{x:2,y:2,stroke:'rgba(201,127,63,0.9)'}];
      st.notes=[{text:P.name,at:[2,2],dy:-104,alpha:a},
                {text:P.latin,at:[2,2],dy:-78,alpha:a}];
    }
  }},

season:{ loop:13000, rest:0.62,
  build(){ const st=guideStage({cols:7,rows:7});
    gsFill(st,'bed','soil',0,0,6,6);
    gsScatter(st,['bluestem','echinacea','dropseed','monarda','sedge','pallida','switchgrass'],
      [[1,1],[3,1],[5,1],[2,2],[4,2],[1,3],[3,3],[5,3],[2,4],[4,4],[1,5],[3,5],[5,5]]);
    gsPlant(st,6,0,'serviceberry',1);
    return st; },
  run(st,u){
    /* The pitch, and the one thing this app does that nothing else does: the
       same planting blooms, seeds and stands through winter without a plant
       being moved. Every colour here is the species' own authored season. */
    const i=Math.floor(u*4)%4;
    st.season=SEASONS[i];
    st.chrome={options:SEASONS,on:i,tapping:gAt((u*4)%1,0,0.25)};
    st.notes=[{text:'Press and hold the season box',at:[3,6.4],dy:30}];
  }},

/* ----- planting ----- */

plantone:{ loop:6500, rest:0.72,
  build(){ const st=guideStage({cols:6,rows:6});
    gsFill(st,'bed','soil',0,0,5,5);
    gsScatter(st,['bluestem','dropseed'],[[0,2],[5,4],[1,5],[4,0]]);
    return st; },
  run(st,u){
    const c=gPath(gAt(u,0.05,0.34),[[4.4,4.6],[2,2]]);
    const tap=gTap(u,0.38);
    st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
    if (u<0.42) st.ghost={x:2,y:2,size:1};
    else gsPlant(st,2,2,'echinacea',Math.max(0.1,gEase(gAt(u,0.42,0.72))));
    st.notes=[{text:'Pick a plant, then tap the ground',at:[2.5,5.4],dy:28}];
  }},

/* Drift is the demo this guidebook exists for. "A loose cluster sized by
   spacing" is three abstractions deep; one tap dropping nine coneflowers in a
   scatter explains itself. Both numbers come from the app — driftCount decides
   how many, DRIFT_OFFSETS is the very table stampDrift walks, in its order —
   so the picture cannot show a drift the tool would not lay. */
drift:{ loop:9000, rest:0.86,
  build(){ const st=guideStage({cols:7,rows:7});
    gsFill(st,'bed','soil',0,0,6,6);
    gsScatter(st,['bluestem','dropseed','sedge'],[[0,5],[6,1],[5,6],[1,0],[6,4]]);
    return st; },
  run(st,u){
    const def=plantDef('echinacea'), n=driftCount(def);
    st.chrome={options:['Draw','Drift','Matrix'],on:u<0.18?0:1,tapping:gAt(u,0.10,0.26)};
    if (u<0.26){
      st.notes=[{text:'Turn Drift on…',at:[3,6.4],dy:30}];
      return;
    }
    const c=gPath(gAt(u,0.26,0.48),[[5.4,5.4],[3,3]]);
    const tap=gTap(u,0.5);
    st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
    if (u<0.52){
      st.ghost={x:3,y:3,size:1};
      st.notes=[{text:'…then ONE tap on open ground',at:[3,6.4],dy:30}];
      return;
    }
    /* The cluster lands one plant at a time over about a third of the loop, so
       what is seen is a scatter ARRIVING rather than a shape appearing. */
    const landed=Math.round(gEase(gAt(u,0.52,0.8))*n);
    DRIFT_OFFSETS.slice(0,landed).forEach(function(off,i){
      const g=gEase(gAt(u,0.52+i*0.28/n,0.52+(i+1.6)*0.28/n));
      gsPlant(st,3+off[0],3+off[1],'echinacea',Math.max(0.12,g));
    });
    st.notes=[{text:'×'+n+' in one tap',at:[3,3],dy:-108,tone:'good',
      alpha:gAt(u,0.78,0.86)},
      {text:def.name+' sits '+def.space+' in apart',at:[3,6.4],dy:30,
       alpha:gAt(u,0.82,0.9)}];
  }},

dragplant:{ loop:8000, rest:0.9,
  build(){ const st=guideStage({cols:8,rows:6});
    gsFill(st,'bed','mulch',0,0,7,5);
    return st; },
  run(st,u){
    const lane=[[0.6,4],[2,3],[4,2.4],[6,2],[7.4,3]];
    const f=gAt(u,0.12,0.82);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:u>0.1&&u<0.84,press:0};
    // Every tile the pointer crosses takes one plant. That IS the gesture.
    const steps=Math.round(f*(lane.length-1)*3);
    for (let i=0;i<=steps;i++){
      const p=gPath(i/Math.max(1,(lane.length-1)*3),lane);
      gsPlant(st,Math.round(p[0]),Math.round(p[1]),'dropseed',
        Math.min(1,0.3+(steps-i)*0.35));
    }
    st.notes=[{text:'Drag to plant a whole sweep',at:[3.5,5.4],dy:28}];
  }},

matrix:{ loop:10000, rest:0.92,
  build(){ const st=guideStage({cols:8,rows:8});
    gsFill(st,'bed','soil',0,0,7,7);
    // The feature forbs go in first; the matrix then flows around them. That
    // order is the workflow, not a detail of the demo.
    [[2,1],[5,2],[1,5],[6,5],[3,6]].forEach(function(p){ gsPlant(st,p[0],p[1],'echinacea',1); });
    return st; },
  run(st,u){
    st.chrome={options:['Draw','Drift','Matrix'],on:u<0.16?0:2,tapping:gAt(u,0.08,0.24)};
    if (u<0.26){
      st.notes=[{text:'Feature plants first, then the matrix',at:[3.5,7.4],dy:28}];
      return;
    }
    const def=plantDef('sesleria');
    const gap=Math.max(1,Math.round(def.space/TILE_IN));   // the real spacing rule
    const f=gAt(u,0.28,0.86), reach=f*16;
    const c=gPath(f,[[0.4,0.4],[7,1],[0.6,4],[7.4,7.4]]);
    st.cursor={x:c[0],y:c[1],down:u>0.27&&u<0.88,press:0};
    /* Matrix refuses a tile within the species' own spacing of the SAME
       species, so a dragged region self-thins to a stand and flows around
       whatever is already standing there. */
    for (let y=0;y<8;y++) for (let x=0;x<8;x++){
      if (x+y>reach || gsGet(st.plants,x,y)) continue;
      let blocked=false;
      for (let dy=-gap;dy<=gap&&!blocked;dy++) for (let dx=-gap;dx<=gap;dx++){
        const q=gsGet(st.plants,x+dx,y+dy);
        if (q&&q.s==='sesleria'&&Math.hypot(dx,dy)<=gap+1e-6){ blocked=true; break; }
      }
      if (!blocked) gsPlant(st,x,y,'sesleria',1);
    }
    st.notes=[{text:'thins itself to '+def.space+' in apart',at:[3.5,7.4],dy:28,
      alpha:gAt(u,0.4,0.5)}];
  }},

woodyage:{ loop:10500, rest:0.88,
  build(){ const st=guideStage({cols:7,rows:7});
    gsFill(st,'lawn','fescue',0,0,6,6);
    gsScatter(st,['dropseed','sedge'],[[0,5],[6,5],[1,0],[5,0]]);
    return st; },
  run(st,u){
    const i=Math.min(2,Math.floor(u*3)), f=gEase(gAt((u*3)%1,0.05,0.5));
    st.chrome={options:['New','Young','Mature'],on:i,tapping:gAt((u*3)%1,0,0.22)};
    const to=[0.06,0.5,1][i], from=[0.06,0.06,0.5][i];
    const g=from+(to-from)*f;
    gsPlant(st,3,3,'serviceberry',g);
    // The dashed mature crown is the ring every woody rule really measures,
    // and it comes from `spread` through the app's own converter.
    const P=plantDef('serviceberry'), r=woodyRadiusTiles(P);
    st.marks=[];
    for (let y=0;y<7;y++) for (let x=0;x<7;x++)
      if (Math.hypot(x-3,y-3)<=r) st.marks.push({x:x,y:y,stroke:'rgba(239,230,211,0.20)'});
    st.notes=[{text:matureSizeText(P)+' when grown',at:[3,6.4],dy:28}];
  }},

footprint:{ loop:9500, rest:0.9,
  build(){ const st=guideStage({cols:6,rows:5});
    gsFill(st,'bed','mulch',0,0,5,4);
    gsScatter(st,['dropseed','sedge'],[[0,0],[5,4],[0,4],[5,0]]);
    return st; },
  run(st,u){
    const P=plantDef('koreanspice'), r=woodyRadiusTiles(P);
    if (u<0.3){
      const tap=gTap(u,0.24);
      const c=gPath(gAt(u,0.03,0.22),[[4.6,3.8],[2,2]]);
      st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
      st.ghost={x:2,y:2,size:1};
      st.notes=[{text:'A shrub reserves the ground it will need',at:[2.5,4.4],dy:28}];
      return;
    }
    const grow=gEase(gAt(u,0.3,0.58));
    gsPlant(st,2,2,'koreanspice',Math.max(0.12,grow));
    /* Drawn strongly, because the reserved ground IS the subject here. At the
       faint tint every other overlay uses it came out as a few pale diamonds
       under the plant, which is the one thing this demo must not be vague
       about — the disc is only about a tile and a half across to begin with. */
    st.marks=[];
    for (let y=0;y<5;y++) for (let x=0;x<6;x++)
      if (Math.hypot(x-2,y-2)<=r*grow)
        st.marks.push({x:x,y:y,fill:'rgba(239,230,211,0.14)',stroke:'rgba(239,230,211,0.38)'});
    if (u<0.62){
      st.notes=[{text:P.spread+' in across when grown',at:[2.5,4.4],dy:28}];
      return;
    }
    // A second planting inside that circle is refused, and says why.
    const tap2=gTap(u,0.78);
    const c2=gPath(gAt(u,0.62,0.76),[[2,2],[3,3]]);
    st.cursor={x:c2[0],y:c2[1],down:tap2.down,press:tap2.press};
    if (u>0.8){
      st.marks.push({x:3,y:3,fill:'rgba(217,100,90,0.34)',stroke:'rgba(217,100,90,0.9)'});
      /* BELOW its tile, not above it. A plant grows up from its tile centre,
         so a caption hung above the refused tile lands squarely on the shrub
         that is refusing — measured, the viburnum was drawing its full 2312
         pixels and none of them were visible. */
      st.notes=[{text:'No room — that is its mature spread',at:[3,3],dy:34,tone:'warn',
        alpha:gAt(u,0.8,0.88)}];
    }
  }},

/* ----- the ground ----- */

paths:{ loop:11000, rest:0.9,
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'lawn','fescue',0,0,8,6);
    gsScatter(st,['dropseed','bluestem','sedge'],[[0,0],[8,0],[0,6],[8,6],[1,3],[7,3]]);
    return st; },
  run(st,u){
    const sizes=BRUSH_SIZES.slice(0,3);
    const i=u<0.34?0:u<0.67?1:2, size=sizes[i];
    st.chrome={options:sizes.map(function(s){ return s+' wide'; }),on:i,
      tapping:gAt((u*3)%1,0,0.2)};
    const lane=[[0.6,5],[2.4,4],[4.4,3.2],[6.4,2.4],[8.2,2]];
    const f=gAt((u*3)%1,0.24,0.94);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:f>0&&f<1,press:0};
    // One shared disc brush drives paint and erase alike; brushOffsets IS the
    // footprint, so the preview and the stamp cannot disagree.
    const steps=Math.round(f*24);
    for (let k=0;k<=steps;k++){
      const p=gPath(k/24,lane), px=Math.round(p[0]), py=Math.round(p[1]);
      brushOffsets(size).forEach(function(o){
        gsSet(st.terrain,px+o[0],py+o[1],gsOnStage(st,px+o[0],py+o[1])?{k:'path',c:'warm'}:null);
      });
    }
    st.ghost={x:Math.round(c[0]),y:Math.round(c[1]),size:size};
    st.notes=[{text:'The same size dots drive every brush',at:[4,6.6],dy:28}];
  }},

mow:{ loop:9500, rest:0.9,
  build(){ const st=guideStage({cols:9,rows:8});
    gsFill(st,'lawn','flower',0,0,8,7);
    gsScatter(st,['echinacea','monarda','bluestem'],
      [[1,1],[7,1],[2,6],[7,6],[0,4],[8,4]]);
    return st; },
  run(st,u){
    /* The signature move of the whole planting style: a mown path through
       rough grass. Painting `Mown` REMOVES the terrain record, which is why
       mowing a path is the same gesture as laying one rather than an erase
       that would take the planting with it. */
    const lane=[[0.4,6],[2.2,5],[4,4],[5.8,2.6],[8.4,2]];
    const f=gAt(u,0.16,0.9);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:u>0.14&&u<0.92,press:0};
    st.chrome={options:['Meadow','Mown'],on:u<0.12?0:1,tapping:gAt(u,0.04,0.18)};
    const steps=Math.round(f*24);
    for (let k=0;k<=steps;k++){
      const p=gPath(k/24,lane), px=Math.round(p[0]), py=Math.round(p[1]);
      brushOffsets(3).forEach(function(o){ gsSet(st.terrain,px+o[0],py+o[1],null); });
    }
    st.ghost={x:Math.round(c[0]),y:Math.round(c[1]),size:3};
    st.notes=[{text:'Mown lifts the meadow back off',at:[4,7.4],dy:28}];
  }},

water:{ loop:9500, rest:0.92,
  build(){ const st=guideStage({cols:9,rows:8});
    gsFill(st,'lawn','fescue',0,0,8,7);
    gsFill(st,'bed','soil',0,0,8,1);
    gsScatter(st,['sedge','foxsedge','dropseed'],[[0,0],[8,0],[1,1],[7,1]]);
    return st; },
  run(st,u){
    const pond=[[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[5,4],[6,4],[3,5],[4,5],[5,5],[4,6]];
    const f=gAt(u,0.14,0.8);
    const n=Math.round(f*pond.length);
    pond.slice(0,n).forEach(function(p){ gsSet(st.terrain,p[0],p[1],{k:'water',c:'pond'}); });
    const c=gPath(f,[[2.6,3],[5.4,4],[4,6]]);
    st.cursor={x:c[0],y:c[1],down:u>0.12&&u<0.82,press:0};
    st.ghost={x:Math.round(c[0]),y:Math.round(c[1]),size:1};
    if (u>0.84){
      gsPlant(st,2,3,'pickerelweed',gEase(gAt(u,0.84,0.96)));
      gsPlant(st,6,5,'waterblueflag',gEase(gAt(u,0.86,0.98)));
      st.cursor=null;
    }
    st.notes=[{text:'Water shelves away from its own bank',at:[4,7.4],dy:28}];
  }},

edging:{ loop:10000, rest:0.92,
  build(){ const st=guideStage({cols:8,rows:7});
    gsFill(st,'lawn','fescue',0,0,7,6);
    gsScatter(st,['echinacea','dropseed','monarda'],[[2,2],[4,2],[3,3],[5,4],[2,4]]);
    return st; },
  run(st,u){
    const bed=[];
    for (let y=2;y<=4;y++) for (let x=2;x<=5;x++) bed.push([x,y]);
    const f=gAt(u,0.1,0.5), n=Math.round(f*bed.length);
    /* Brick rather than steel, on measurement: a 2px steel strip came to 746
       differing pixels against no edging at all — drawn, and invisible at demo
       scale against a dark bed. A brick soldier course is 5 in and measures
       1571. This demo's whole subject is the strip. */
    const edge=u>0.58?'brick':null;
    bed.slice(0,n).forEach(function(p){
      gsSet(st.terrain,p[0],p[1],{k:'bed',c:'mulch',e:edge});
    });
    if (u<0.55){
      const c=gPath(f,[[2,2],[5,2],[2,4],[5,4]]);
      st.cursor={x:c[0],y:c[1],down:u>0.08&&u<0.52,press:0};
      st.notes=[{text:'Fill the bed first',at:[3.5,6.4],dy:28}];
    } else {
      const c2=gPath(gAt(u,0.58,0.92),[[1.6,3],[6,3]]);
      st.cursor={x:c2[0],y:c2[1],down:u<0.94,press:0};
      /* Edging draws ONLY where a tile meets lawn, which is what makes
         filling the bed the gesture rather than tracing its outline: the
         interior joints never draw and are never billed. */
      st.notes=[{text:'Edging draws only where it meets the lawn',at:[3.5,6.4],dy:28,
        alpha:gAt(u,0.6,0.7)}];
    }
  }},

grade:{ loop:11000, rest:0.92,
  build(){ const st=guideStage({cols:8,rows:7});
    gsFill(st,'lawn','fescue',0,0,7,6);
    gsScatter(st,['dropseed','sedge'],[[0,0],[7,0],[0,6],[7,6]]);
    return st; },
  run(st,u){
    const terrace=[];
    for (let y=0;y<=3;y++) for (let x=0;x<8;x++) terrace.push([x,y]);
    st.chrome={options:['Raise','Lower','Level','Wall'],on:u<0.5?0:3,
      tapping:gAt(u,0.46,0.6)};
    const lift=Math.round(gEase(gAt(u,0.08,0.42))*3);
    terrace.forEach(function(p){ gsSet(st.elev,p[0],p[1],lift); });
    if (u>0.56){
      // Painting a facing is what turns bare earth into built retaining; both
      // are real answers to the same terrace, so it is painted rather than
      // automatic.
      const reach=gAt(u,0.58,0.9)*8;
      for (let x=0;x<8;x++) if (x<reach)
        gsSet(st.terrain,x,3,{k:'lawn',c:'fescue',w:'drystone'});
    }
    if (u<0.5){
      const c=gPath(gAt(u,0.06,0.44),[[0.6,1],[7,1]]);
      st.cursor={x:c[0],y:c[1],down:u<0.46,press:0};
      st.ghost={x:Math.round(c[0]),y:Math.round(c[1]),size:3};
      st.notes=[{text:'Raise the ground into a terrace',at:[3.5,6.4],dy:28}];
    } else {
      const c=gPath(gAt(u,0.58,0.9),[[0.4,3],[7.4,3]]);
      st.cursor={x:c[0],y:c[1],down:u<0.92,press:0};
      st.notes=[{text:'…then paint the face that holds it back',at:[3.5,6.4],dy:28}];
    }
  }},

/* ----- hardscape and decor ----- */

fence:{ loop:10500, rest:0.92,
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'lawn','fescue',0,0,8,6);
    gsFill(st,'bed','mulch',0,3,8,5);
    gsScatter(st,['echinacea','bluestem','monarda','dropseed'],
      [[1,4],[3,4],[5,4],[7,4],[2,5],[6,5]]);
    return st; },
  run(st,u){
    const heights=[4,6,8], i=u<0.62?1:u<0.82?0:2, h=heights[i];
    st.chrome={options:heights.map(function(f){ return f+" ft"; }),on:i,
      tapping:u>0.6?gAt(u,0.6,0.72):0};
    const f=gAt(u,0.12,0.58), n=Math.round(f*9);
    for (let x=0;x<n&&x<9;x++) st.props.push({kind:'fence',x:x,y:2,style:'privacy',height:h});
    if (u<0.6){
      const c=gPath(f,[[0,2],[8,2]]);
      st.cursor={x:c[0],y:c[1],down:u>0.1&&u<0.6,press:0};
      st.notes=[{text:'Drag along the line you want fenced',at:[4,6.4],dy:28}];
    } else {
      st.notes=[{text:'Heights are real feet — a 6 ft fence is 6 ft',at:[4,6.4],dy:28,
        alpha:gAt(u,0.62,0.72)}];
    }
  }},

containers:{ loop:10000, rest:0.92,
  build(){ const st=guideStage({cols:5,rows:4});
    gsFill(st,'path','paver',0,0,4,3);
    gsFill(st,'lawn','fescue',0,3,4,3);
    return st; },
  run(st,u){
    /* A pot is the one thing that makes PAVING plantable: every planting route
       refuses `path` terrain, so before containers a courtyard was a garden
       this app could draw and not plant. */
    if (u>0.2) st.props.push({kind:'pot',x:1,y:1,style:'terracotta',size:'p24',face:0});
    if (u>0.28) st.props.push({kind:'pot',x:3,y:2,style:'glazed',size:'p24',face:0});
    if (u<0.42){
      const tap=gTap(u,0.16);
      const c=gPath(gAt(u,0.02,0.14),[[3.6,3],[1,1]]);
      st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
      st.notes=[{text:'A pot goes straight onto paving',at:[2,3.4],dy:28}];
      return;
    }
    const tap2=gTap(u,0.5);
    st.cursor=u<0.62?{x:1,y:1,down:tap2.down,press:tap2.press}:null;
    /* Both plants have to be UP in this demo's season, which is the trap the
       first cut fell into: it potted a crocus in Summer, when a crocus is
       underground and drawPlant correctly draws nothing — so the demo's own
       claim was made over two empty pots. */
    if (u>0.52) gsPlant(st,1,1,'echinacea',Math.max(0.15,gEase(gAt(u,0.52,0.8))));
    if (u>0.6) gsPlant(st,3,2,'dropseed',Math.max(0.15,gEase(gAt(u,0.6,0.86))));
    st.notes=[{text:'…and now the paving can be planted',at:[2,3.4],dy:28,
      alpha:gAt(u,0.55,0.66)}];
  }},

seating:{ loop:10000, rest:0.94,
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'lawn','fescue',0,0,8,6);
    gsFill(st,'path','slate',2,3,6,4);
    gsScatter(st,['dropseed','bluestem','echinacea'],[[0,1],[8,1],[0,5],[8,5],[1,6],[7,6]]);
    return st; },
  run(st,u){
    const face=Math.floor(gAt(u,0.6,0.96)*4)%4;
    if (u>0.14) st.props.push({kind:'seat',x:2,y:3,type:'bench6',finish:'teak',
      face:u>0.6?face:0});
    if (u>0.34) st.props.push({kind:'seat',x:6,y:4,type:'chair',finish:'painted',face:1});
    if (u>0.44) st.props.push({kind:'seat',x:6,y:2,type:'stool',finish:'stone',face:0});
    if (u<0.56){
      const tap=gTap(u,u<0.3?0.1:0.3);
      const c=gPath(gAt(u,0,0.5),[[7,5.6],[2,3],[6,4]]);
      st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
      st.notes=[{text:'Every piece claims its real footprint',at:[4,6.4],dy:28}];
    } else {
      st.chrome={options:['Turn'],on:0,tapping:gAt((u*4)%1,0,0.3)};
      st.notes=[{text:'Turn faces it wherever the view is',at:[4,6.4],dy:28,
        alpha:gAt(u,0.58,0.68)}];
    }
  }},

focal:{ loop:10500, rest:0.94,
  build(){ const st=guideStage({cols:9,rows:8});
    gsFill(st,'lawn','fescue',0,0,8,7);
    gsFill(st,'path','lime',4,0,4,7);
    gsScatter(st,['bluestem','echinacea','dropseed','monarda'],
      [[1,2],[2,4],[1,6],[7,2],[6,4],[7,6]]);
    return st; },
  run(st,u){
    // A path leads TO something. These are the built focal points, and they
    // refuse each other's ground exactly the way the fire pit always has.
    if (u>0.16) st.props.push({kind:'waterfeature',x:4,y:1,form:'birdbath',
      finish:'stone',face:0});
    if (u>0.42) st.props.push({kind:'firepit',x:3,y:5,shape:'round',size:36});
    if (u>0.66) st.props.push({kind:'boulder',x:7,y:4,type:'medium2'});
    const tap=gTap(u,u<0.36?0.12:u<0.6?0.38:0.62);
    const c=gPath(gAt(u,0,0.72),[[7,7],[4,1],[3,5],[7,4]]);
    st.cursor=u<0.76?{x:c[0],y:c[1],down:tap.down,press:tap.press}:null;
    st.notes=[{text:'Fire pits, water features, boulders',at:[4,7.4],dy:28}];
  }},

climbers:{ loop:10500, rest:0.94,
  build(){ const st=guideStage({cols:8,rows:7});
    gsFill(st,'bed','mulch',0,2,7,5);
    gsFill(st,'lawn','fescue',0,6,7,6);
    gsScatter(st,['echinacea','dropseed','bluestem'],[[1,4],[3,5],[6,4],[0,3],[7,3]]);
    return st; },
  run(st,u){
    /* Vertical is the one dimension a small garden has spare, and a climber is
       the one plant that may not be planted without a frame — the rule is
       symmetric, so the frame refuses everything that is not a climber. */
    if (u>0.18) st.props.push({kind:'support',x:2,y:3,style:'obelisk',mat:'timber',face:0});
    if (u>0.34) st.props.push({kind:'support',x:5,y:3,style:'trellis',mat:'black',face:0});
    if (u<0.5){
      const tap=gTap(u,u<0.3?0.14:0.3);
      const c=gPath(gAt(u,0,0.44),[[6.6,5.6],[2,3],[5,3]]);
      st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
      st.notes=[{text:'Stand a frame first',at:[3.5,6.4],dy:28}];
      return;
    }
    gsPlant(st,2,3,'clematisviticella',Math.max(0.12,gEase(gAt(u,0.52,0.8))));
    gsPlant(st,5,3,'climbingrose',Math.max(0.12,gEase(gAt(u,0.6,0.9))));
    const tap2=gTap(u,0.54);
    st.cursor=u<0.7?{x:2,y:3,down:tap2.down,press:tap2.press}:null;
    st.notes=[{text:'…then the climber takes its shape',at:[3.5,6.4],dy:28,
      alpha:gAt(u,0.56,0.66)}];
  }},

decor:{ loop:8500, rest:0.9,
  build(){ const st=guideStage({cols:7,rows:6});
    gsFill(st,'lawn','fescue',0,0,6,5);
    gsFill(st,'bed','mulch',0,0,6,1);
    gsScatter(st,['echinacea','dropseed','monarda','bluestem'],
      [[1,0],[3,1],[5,0],[0,4],[6,4]]);
    return st; },
  run(st,u){
    // A pet claims nothing: it may sit in the middle of a drift, and adding
    // one can never change what the design will take.
    if (u>0.28) st.props.push({kind:'pet',x:3,y:3,species:'cat',coat:'marmalade',
      mark:'tabby',paws:'none'});
    if (u>0.56) st.props.push({kind:'pet',x:5,y:2,species:'dog',coat:'cocoa',
      mark:'solid',paws:'socks'});
    const tap=gTap(u,u<0.45?0.24:0.52);
    const c=gPath(gAt(u,0,0.6),[[6,4.6],[3,3],[5,2]]);
    st.cursor=u<0.72?{x:c[0],y:c[1],down:tap.down,press:tap.press}:null;
    st.notes=[{text:'Decoration only — it reserves no ground',at:[3,5.4],dy:28}];
  }},

/* ----- editing and finishing ----- */

select:{ loop:11000, rest:0.94,
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'bed','soil',0,0,8,6);
    [[1,1],[2,1],[1,2],[2,2],[3,2],[2,3]].forEach(function(p){
      gsPlant(st,p[0],p[1],'echinacea',1); });
    gsScatter(st,['dropseed','sedge'],[[6,5],[8,1],[0,5],[7,0]]);
    return st; },
  run(st,u){
    const rect=[1,1,3,3];
    if (u<0.3){
      // drag the marquee out
      const f=gEase(gAt(u,0.06,0.28));
      const x1=1+ (rect[2]-1)*f, y1=1+(rect[3]-1)*f;
      st.marks=[];
      for (let y=1;y<=Math.round(y1);y++) for (let x=1;x<=Math.round(x1);x++)
        st.marks.push({x:x,y:y,fill:'rgba(124,168,196,0.22)',stroke:'rgba(124,168,196,0.75)'});
      st.cursor={x:x1,y:y1,down:true,press:0};
      st.notes=[{text:'Marquee what you want to move',at:[4,6.4],dy:28}];
      return;
    }
    st.marks=[];
    for (let y=1;y<=3;y++) for (let x=1;x<=3;x++)
      st.marks.push({x:x,y:y,fill:'rgba(124,168,196,0.16)',stroke:'rgba(124,168,196,0.45)'});
    st.chrome={options:['Move','Duplicate'],on:1,tapping:gAt(u,0.32,0.44)};
    if (u<0.48){ st.cursor=null;
      st.notes=[{text:'Move, Duplicate, Rotate or Erase it',at:[4,6.4],dy:28}]; return; }
    // duplicate: the same six plants, offset, as a live ghost then committed
    const f2=gEase(gAt(u,0.5,0.86));
    const dx=Math.round(4*f2), dy=Math.round(2*f2);
    [[1,1],[2,1],[1,2],[2,2],[3,2],[2,3]].forEach(function(p){
      gsSet(st.plants,p[0]+dx,p[1]+dy,{s:'echinacea',g:1,alpha:u<0.88?0.55:1});
    });
    for (let y=1;y<=3;y++) for (let x=1;x<=3;x++)
      st.marks.push({x:x+dx,y:y+dy,stroke:'rgba(122,176,122,0.8)'});
    st.cursor={x:2+dx,y:2+dy,down:u<0.88,press:0};
    st.notes=[{text:'Duplicate carries the planting with it',at:[4,6.4],dy:28}];
  }},

pick:{ loop:9000, rest:0.92,
  build(){ const st=guideStage({cols:8,rows:6});
    gsFill(st,'lawn','fescue',0,0,7,5);
    gsFill(st,'path','brick',0,0,7,0);
    gsPlant(st,1,3,'monarda',1);
    gsScatter(st,['dropseed','sedge'],[[6,1],[7,4],[0,5]]);
    return st; },
  run(st,u){
    if (u<0.34){
      const tap=gTap(u,0.26);
      const c=gPath(gAt(u,0.04,0.24),[[5,4.6],[1,3]]);
      st.cursor={x:c[0],y:c[1],down:tap.down,press:tap.press};
      if (u>0.28) st.marks=[{x:1,y:3,stroke:'rgba(201,127,63,0.9)'}];
      st.notes=[{text:'Tap anything with Pick…',at:[3.5,5.4],dy:28}];
      return;
    }
    st.chrome={options:[plantDef('monarda').name],on:0,tapping:gAt(u,0.34,0.46)};
    const lane=[[1,3],[3,3],[4,4],[6,4]];
    const f=gAt(u,0.44,0.9);
    const c2=gPath(f,lane);
    st.cursor={x:c2[0],y:c2[1],down:u<0.92,press:0};
    const steps=Math.round(f*9);
    for (let k=0;k<=steps;k++){
      const p=gPath(k/9,lane);
      gsPlant(st,Math.round(p[0]),Math.round(p[1]),'monarda',1);
    }
    st.notes=[{text:'…and it is on the brush',at:[3.5,5.4],dy:28,alpha:gAt(u,0.38,0.48)}];
  }},

erase:{ loop:10000, rest:0.92,
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'bed','mulch',1,1,7,5);
    gsFill(st,'path','warm',0,6,8,6);
    for (let y=1;y<=5;y++) for (let x=1;x<=7;x++)
      if ((x+y)%2===0) gsPlant(st,x,y,'echinacea',1);
    return st; },
  run(st,u){
    /* The erase layer seg is the whole feature: sweeping with Plants selected
       lifts the planting and leaves the bed, which is the edit somebody
       actually wants and the one a single undifferentiated erase cannot make. */
    st.chrome={options:['All','Plants','Bulbs','Land'],on:u<0.2?0:1,
      tapping:gAt(u,0.06,0.2)};
    if (u<0.28){
      st.notes=[{text:'Choose what the sweep is allowed to lift',at:[4,6.6],dy:28}];
      return;
    }
    const lane=[[0.6,4],[3,3],[5,2.4],[8,2]];
    const f=gAt(u,0.3,0.9);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:u<0.92,press:0};
    const steps=Math.round(f*18);
    for (let k=0;k<=steps;k++){
      const p=gPath(k/18,lane), px=Math.round(p[0]), py=Math.round(p[1]);
      brushOffsets(5).forEach(function(o){ gsSet(st.plants,px+o[0],py+o[1],null); });
    }
    st.ghost={x:Math.round(c[0]),y:Math.round(c[1]),size:5,tone:'rgba(217,100,90,0.22)'};
    st.notes=[{text:'Plants only — the bed stays',at:[4,6.6],dy:28,alpha:gAt(u,0.4,0.5)}];
  }},

layers:{ loop:11000, rest:0.5,
  build(){ const st=guideStage({cols:8,rows:7,season:'Spring'});
    gsFill(st,'bed','soil',0,0,7,6);
    gsFill(st,'path','slate',0,6,7,6);
    gsScatter(st,['echinacea','bluestem','dropseed','monarda','sedge'],
      [[1,1],[3,1],[5,2],[1,3],[3,3],[6,4],[2,5],[4,5]]);
    gsPlant(st,6,1,'serviceberry',1);
    gsPlant(st,2,4,'koreanspice',1);
    gsPlant(st,4,2,'crocus',1);
    return st; },
  run(st,u){
    const steps=['All','Perennials','Bulbs','Woody','Land'];
    const i=Math.floor(u*5)%5;
    st.chrome={options:steps,on:i,tapping:gAt((u*5)%1,0,0.2)};
    // hide everything the chosen lens is not about
    if (i>0){
      Object.keys(st.plants).forEach(function(k){
        const p=st.plants[k], P=plantDef(p.s);
        const woody=isWoodyDef(P), bulb=P.type==='bulb';
        const keep=(i===1&&!woody&&!bulb)||(i===2&&bulb)||(i===3&&woody);
        if (i===4||!keep) delete st.plants[k];
      });
      if (i!==4) st.terrain=Object.create(null);
    }
    st.notes=[{text:'Show one layer at a time, or edit just that one',
      at:[3.5,6.6],dy:28}];
  }},

};

/* ---------- the chapters ----------
   A PURE table, for the reason GUIDE_DEMOS is one: the sandbox has no selector
   engine, so a test that counted rendered rows would pass without testing
   anything, while this and its demo ids are checkable headless. Every `demo`
   must name a key in GUIDE_DEMOS and a test pins that both ways — an entry
   with no demo is a dead row, and a demo with no entry is unreachable.

   Order is the order somebody learns in: read the garden, then change it, then
   get the change out of the app. It is the tour's own order (read → run →
   edit → payoff) carried across a reference that is four times as long. */
function guideChapters(){
  return [
    {id:'around', title:'Finding your way',
     blurb:'The camera, the calendar, and how to ask what something is.',
     entries:[
      {id:'move', demo:'move', title:'Move and zoom',
       lead:'The garden sits still; you move over it. There is no character to walk.',
       how:['Drag anywhere with the Hand to move.',
            'Two fingers, the scroll wheel, or + and - to zoom.',
            'On a mouse, hold Space or the middle button to drag while a brush is armed.',
            'Fit frames the whole plot again when you lose it.']},
      {id:'turn', demo:'turn', title:'Turn the view',
       lead:'A quarter turn at a time, so you can see a bed from the path you will actually stand on.',
       how:['R, or the turn button in the top bar.',
            'Only the view turns. Nothing in the garden moves, and north stays where you set it.']},
      {id:'identify', demo:'identify', title:'Ask what a plant is',
       lead:'Every clump in the garden will tell you its name, its size at maturity and how it is doing.',
       how:['Arm the Hand, then tap any plant.',
            'Large shrubs answer from anywhere under their spread, not just the middle.',
            'The card is also where Replace lives, if you want a different species in that spot.']},
      {id:'season', demo:'season', title:'Run the year',
       lead:'The reason to design a planting rather than arrange one. The same plants bloom, seed, and stand through winter.',
       how:['Press and HOLD the season box to fast-forward.',
            'A short tap opens the time menu: pause, resume, or skip to the next season.',
            'Winter is the test. Good planting still has structure in it.']},
     ]},

    {id:'planting', title:'Putting plants in',
     blurb:'One at a time, by the drift, by the drag, or as a matrix.',
     entries:[
      {id:'plantone', demo:'plantone', title:'Plant one',
       lead:'Pick a species in the library, then tap the ground. That is the whole gesture.',
       how:['The footprint ghost shows where it will land before you commit.',
            'Undo takes back anything — Ctrl/Cmd-Z, or the arrow on the tool rail.',
            'Free placement nudges each plant off its tile centre so a drift stops reading as a grid.']},
      {id:'drift', demo:'drift', title:'Plant a drift',
       lead:'One tap puts in a whole scattered cluster, sized by how far apart that species wants to be.',
       how:['Turn Drift on in the brush bar, then tap ONCE on open ground.',
            'Close-spaced plants come in nines, wide-spaced ones in threes. Trees and shrubs always go in singly.',
            'Drag with Drift on for a bigger sweep of the same thing.']},
      {id:'dragplant', demo:'dragplant', title:'Drag to plant',
       lead:'Hold and draw. Every tile the pointer crosses takes a plant.',
       how:['Good for a river of one grass through a border.',
            'The whole drag is one undo step, not fifty.']},
      {id:'matrix', demo:'matrix', title:'Matrix planting',
       lead:'A ground layer that thins itself. Drag over a whole area and the species lands only where it has room.',
       how:['Put the feature plants in first, then flow the matrix around them.',
            'Matrix refuses a tile within that species’ own spacing of itself, so a solid drag comes out as a stand.',
            'It never displaces what is already there — that is what makes the two-layer planting work.']},
      {id:'woodyage', demo:'woodyage', title:'Trees and shrubs, at an age',
       lead:'A woody plant takes years, so you choose which year you are looking at.',
       how:['The Age chips — New, Young, Mature — set how old the plant is when you place it.',
            'Gardens open in the Established preview, showing everything grown. Switch to Today in the time menu.',
            'What you SEE follows the preview. What is LEGAL never does: the rules always plan for maturity.']},
      {id:'footprint', demo:'footprint', title:'Mature spread',
       lead:'A shrub reserves the ground it will eventually need, so the bed you draw today still works in ten years.',
       how:['The faint disc under a shrub is its spread at maturity.',
            'Paths, water, fences, bulbs and perennials all refuse that ground.',
            'A tree is different: only its trunk tile is reserved, so you can underplant right through the canopy.']},
     ]},

    {id:'ground', title:'Shaping the ground',
     blurb:'Lawn, paths, beds, water, edges and levels.',
     entries:[
      {id:'paths', demo:'paths', title:'Paths and beds',
       lead:'Paint them on. One shared brush size drives every material and the eraser too.',
       how:['Pick Path or Bed in the Landscape library, then choose a material.',
            'The size dots set the brush: 1, 2, 3, 5 or 7 tiles across.',
            'Organic edges smooth a bed into a curve; Formal keeps the tile line. The Edge chips are on the Ground tab.']},
      {id:'mow', demo:'mow', title:'Mow a path through a meadow',
       lead:'Long grass with a mown route through it is the signature move of this whole style, and it is one brush.',
       how:['Lawn is a material like any other: meadow, fescue, clover, thyme, moss, or wildflower.',
            'Mown is the row that lifts one back off — the same gesture as laying one, not an erase.',
            'It leaves the planting standing, which is why it is not the shovel.']},
      {id:'water', demo:'water', title:'Water',
       lead:'Pond, river and lake are not three tints. Each shelves away from its bank at its own rate.',
       how:['Paint it like any other material; the depth comes from how far a tile is from dry land.',
            'Water plants go in the shallows. Everything else refuses water.',
            'For a birdbath or a bubbling urn, look under Hardscape instead — those are objects, not areas.']},
      {id:'edging', demo:'edging', title:'Edging',
       lead:'The strip that separates a bed from the lawn — steel, corten, timber, brick, setts, or a cut spade edge.',
       how:['Fill the bed first, then run the edging over it.',
            'It draws only where the bed meets lawn, so an edge that later becomes interior stops drawing on its own.',
            'The planting list bills exactly the feet you can see.']},
      {id:'grade', demo:'grade', title:'Levels and retaining walls',
       lead:'Raise or lower the ground into terraces, then paint the face that holds each one back.',
       how:['Raise, Lower and Level are on the Grade tab, and take the same disc brush.',
            'Wall paints a facing onto the exposed face: dry stone, brick, sleepers, gabion, corten.',
            'A grass bank is a real answer too. Paint None to strip a facing and keep the terrace.']},
     ]},

    {id:'hardscape', title:'Everything else that stands there',
     blurb:'Fences, containers, seating, focal points, climbers and the cat.',
     entries:[
      {id:'fence', demo:'fence', title:'Fences and gates',
       lead:'Twelve materials at real heights, so a 6 ft privacy fence is drawn 6 ft tall next to a 6 ft viburnum.',
       how:['Drag along the line you want fenced.',
            'Each material offers only the heights it is really built at.',
            'Turn Gate on for an opening. Paint two or three tiles of it for a gate you can push a barrow through.',
            'A fence is also a support: climbers will grow on it.']},
      {id:'containers', demo:'containers', title:'Containers',
       lead:'A pot is the one thing that makes paving plantable.',
       how:['Drop the vessel first, then plant into it as you would plant anything.',
            'Inside a pot, bed spacing, matrix thinning and mature shrub reservations all stand aside.',
            'Lifting the pot takes its planting with it.']},
      {id:'seating', demo:'seating', title:'Seating',
       lead:'Benches, chairs, a bistro set, a dining table, a lounger — each claiming the ground it really occupies.',
       how:['Seating lives on the Hardscape tab and drags out in a row along a wall or a path.',
            'Turn faces a piece toward whatever you want to look at.',
            'Tables come without chairs on purpose, so you can seat three people or turn one chair to the view.']},
      {id:'focal', demo:'focal', title:'Fire pits, water features, boulders',
       lead:'The things a path leads to.',
       how:['Each opens its own page on the Hardscape tab; Back returns to the list.',
            'They reserve their whole footprint and refuse each other’s ground.',
            'All three reach the planting list and the plan — somebody has to buy and install them.']},
      {id:'climbers', demo:'climbers', title:'Supports and climbers',
       lead:'Vertical is the one dimension a small garden has spare.',
       how:['Stand an obelisk, a trellis panel or an arch first — or use a fence you already have.',
            'A climber cannot be planted in open ground, and a frame will not take anything but a climber.',
            'Lift the frame and the climber comes with it.']},
      {id:'decor', demo:'decor', title:'The cat and the dog',
       lead:'Pure ornament, and the only placeable thing that claims no ground at all.',
       how:['Decor tab. Pick the animal, then its coat, markings and socks.',
            'A pet may sit in the middle of a drift; adding one can never change what the design will take.',
            'Tap to place — there is deliberately no drag, because nobody wants twenty-four identical cats.',
            'It never appears on the planting list or the plan. Those are documents somebody builds from.']},
     ]},

    {id:'working', title:'Changing your mind',
     blurb:'Select, sample, erase, and see one layer at a time.',
     entries:[
      {id:'select', demo:'select', title:'Select, move, duplicate',
       lead:'Marquee a region and take its whole contents somewhere else.',
       how:['Select is on the tool rail. Drag a rectangle, then use the pill that appears.',
            'Move, Duplicate, Rotate, Fill, Erase, Save, Paste.',
            'The selection owns what was inside it when you drew it, so a plant that lands there later is never scooped up.',
            'A move onto ground that refuses it is refused whole — nothing lands half-placed.']},
      {id:'pick', demo:'pick', title:'Pick (the eyedropper)',
       lead:'Point at something already in the garden and it becomes the brush.',
       how:['Pick is on the tool rail. Tap a plant, a fence, a path or a bed.',
            'It copies the exact cultivar, colour, height or material — not just the kind of thing.',
            'It then drops you into normal painting, so the next tap uses it.']},
      {id:'erase', demo:'erase', title:'Erase by layer',
       lead:'The shovel asks what it is allowed to lift before it lifts anything.',
       how:['Arm Erase and the brush bar offers All, Plants, Bulbs, or Land.',
            'Sweeping with Plants selected takes the planting and leaves the bed.',
            'It takes the same disc size as the paint brushes, and one sweep is one undo step.',
            'Hidden layers are protected — the shovel will not reach through a layer you cannot see.']},
      {id:'layers', demo:'layers', title:'Layers',
       lead:'Show one layer at a time, or lock editing to it, so a fat brush cannot touch what you are not working on.',
       how:['Layers is in the top bar. Visible controls what draws; Edit controls what a tool may touch.',
            'Overlays live there too: the shade map and the mature canopies.',
            'Drawing onto a hidden layer asks first, rather than silently doing nothing.']},
     ]},
  ];
}
function guideEntries(){
  const out=[];
  guideChapters().forEach(function(c){
    c.entries.forEach(function(e){ out.push(Object.assign({chapter:c.id,chapterTitle:c.title},e)); });
  });
  return out;
}
function guideEntry(id){ return guideEntries().find(function(e){ return e.id===id; })||null; }

/* ---------- the screen ----------
   DOCK is a master-detail split: the whole contents list stays beside the demo,
   which at 24 entries is cheap peripheral context you keep while reading. On
   SHEET it becomes two VIEWS of one screen — list, then detail — read only
   through [data-guideview] selectors inside the SHEET query, so DOCK can never
   reach a state that hides one of its own panes. That is the plant library's
   arrangement, and it is here for the library's reason: at 375px a split pane
   spends half the screen on navigation.

   Unlike the library there are no thumbnails in the list. A guide thumbnail
   would be a whole stage — ground pass, plants, props — and twenty-four of them
   on every open is the 156ms mistake buildLibraryList was restructured to
   avoid. One demo runs at a time, and it is the one being read. */
let guideSel=null;          // entry id
let guideView='list';       // list | detail  — SHEET only
let guideRaf=0;
let guideT0=0;              // the loop's own start, so scrubbing can rebase it
let guidePlaying=true;
let guideScrub=null;        // a u the reader parked on, or null to follow the clock
let guideStageCache=null;   // the built stage for the current frame, rebuilt each tick

function guideOpen(){ return !!$('guideScreen') && !$('guideScreen').classList.contains('hidden'); }
function guideSheetUi(){ return typeof mobileSheetUi==='function' && mobileSheetUi(); }

function openGuide(){
  funnel(FUNNEL_EVENTS.guideOpened);
  guideSel=guideSel||guideEntries()[0].id;
  guideView=guideSheetUi()?'list':'detail';
  guidePlaying=!reducedMotion();
  guideScrub=null;
  show('guideScreen');
  buildGuideList();
  renderGuideDetail();
  syncGuideView();
  startGuideLoop();
}
function closeGuide(){ stopGuideLoop(); show('menuScreen'); }
/* SHEET walks back through the views; DOCK has nowhere to go but out. */
function guideBack(){
  if (guideSheetUi() && guideView==='detail'){ guideView='list'; syncGuideView(); stopGuideLoop(); return; }
  closeGuide();
}
function syncGuideView(){
  const el=$('guideScreen'); if (!el) return;
  const sheet=guideSheetUi();
  el.setAttribute('data-guideview',sheet?guideView:'detail');
  /* On SHEET the h2 is clipped to the screen reader, so this line IS the
     header: the screen's own name on the list, the tool's name once you are
     reading one. Left to the h2 alone the list header held nothing but a
     "Menu" link floating against the left edge. */
  const e=guideEntry(guideSel);
  hudText('guideHeadTitle', sheet&&guideView==='list' ? 'How the tools work' : (e?e.title:''));
}
function selectGuideEntry(id){
  if (guideSel===id && guideView==='detail') return;
  guideSel=id;
  guideView='detail';
  guideScrub=null; guidePlaying=!reducedMotion(); guideT0=0;
  buildGuideList();          // the selected row moves
  renderGuideDetail();
  syncGuideView();
  startGuideLoop();
}
function buildGuideList(){
  const list=$('guideList'); if (!list) return;
  const frag=document.createDocumentFragment();
  guideChapters().forEach(function(c){
    const sec=document.createElement('div'); sec.className='guide-section';
    const h=document.createElement('h3'); h.className='guide-cat';
    h.appendChild(document.createTextNode(c.title));
    const sm=document.createElement('small'); sm.textContent=c.blurb;
    h.appendChild(sm);
    sec.appendChild(h);
    c.entries.forEach(function(e){
      const b=document.createElement('button'); b.type='button';
      b.className='guide-item'+(e.id===guideSel?' sel':'');
      b.setAttribute('aria-current',e.id===guideSel?'true':'false');
      const n=document.createElement('span'); n.className='gi-name'; n.textContent=e.title;
      const l=document.createElement('span'); l.className='gi-lead'; l.textContent=e.lead;
      b.append(n,l);
      b.onclick=function(){ selectGuideEntry(e.id); };
      sec.appendChild(b);
    });
    frag.appendChild(sec);
  });
  list.replaceChildren(frag);
}
function renderGuideDetail(){
  const host=$('guideDetail'); if (!host) return;
  const e=guideEntry(guideSel); if (!e){ host.replaceChildren(); return; }
  const frag=document.createDocumentFragment();

  const stage=document.createElement('div'); stage.className='guide-stage';
  const cv=document.createElement('canvas'); cv.id='guideCanvas';
  cv.setAttribute('role','img');
  cv.setAttribute('aria-label',e.title+'. '+e.lead+' '+e.how.join(' '));
  stage.appendChild(cv);
  frag.appendChild(stage);

  /* Transport. A how-to that only loops is hard to study, so the reader can
     stop it on the frame that matters — and under reduced motion that is the
     only way the demo moves at all. */
  const bar=document.createElement('div'); bar.className='guide-transport';
  const play=document.createElement('button'); play.type='button';
  play.className='guide-play'; play.id='guidePlay';
  play.onclick=function(){
    guidePlaying=!guidePlaying;
    if (guidePlaying){ guideScrub=null; guideT0=0; startGuideLoop(); }
    syncGuidePlay();
  };
  const scrub=document.createElement('input'); scrub.type='range';
  scrub.className='guide-scrub'; scrub.id='guideScrub';
  scrub.min='0'; scrub.max='1000'; scrub.step='1'; scrub.value='0';
  scrub.setAttribute('aria-label','Step through the demonstration');
  scrub.oninput=function(){
    guidePlaying=false; guideScrub=+scrub.value/1000;
    syncGuidePlay(); drawGuideFrame();
  };
  bar.append(play,scrub);
  frag.appendChild(bar);

  const h=document.createElement('h2'); h.className='guide-title'; h.textContent=e.title;
  const lead=document.createElement('p'); lead.className='guide-lead'; lead.textContent=e.lead;
  frag.append(h,lead);
  const ul=document.createElement('ul'); ul.className='guide-how';
  e.how.forEach(function(t){ const li=document.createElement('li'); li.textContent=t; ul.appendChild(li); });
  frag.appendChild(ul);

  const back=document.createElement('button'); back.type='button';
  back.className='back-link guide-detail-back'; back.textContent='All tools';
  back.onclick=guideBack;
  frag.appendChild(back);

  host.replaceChildren(frag);
  host.scrollTop=0;
  syncGuidePlay();
  sizeGuideCanvas();
  drawGuideFrame();
}
function syncGuidePlay(){
  const b=$('guidePlay'); if (!b) return;
  b.textContent=guidePlaying?'Pause':'Play';
  b.setAttribute('aria-pressed',guidePlaying?'true':'false');
}
/* Backing scale is capped exactly as the garden's is (view.js), so a retina
   phone does not quadruple a pixel budget for a 260px illustration. */
function sizeGuideCanvas(){
  const cv=$('guideCanvas'); if (!cv) return null;
  const r=cv.getBoundingClientRect();
  const w=Math.max(1,Math.round(r.width)), h=Math.max(1,Math.round(r.height));
  if (!w||!h) return null;
  const dpr=Math.min(1.5,window.devicePixelRatio||1);
  if (cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){
    cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  }
  return {cv,w,h,dpr};
}
function drawGuideFrame(t){
  const box=sizeGuideCanvas(); if (!box) return;
  const e=guideEntry(guideSel); if (!e) return;
  const demo=GUIDE_DEMOS[e.demo]; if (!demo) return;
  const ctx=box.cv.getContext('2d'); if (!ctx) return;

  let u;
  if (guideScrub!==null) u=guideScrub;
  else if (!guidePlaying) u=demo.rest===undefined?0.8:demo.rest;
  else {
    if (!guideT0) guideT0=t||performance.now();
    u=(((t||performance.now())-guideT0)%demo.loop)/demo.loop;
  }
  const sc=$('guideScrub');
  if (sc && guideScrub===null) sc.value=String(Math.round(u*1000));

  /* Rebuilt every frame rather than accumulated: at this size it costs nothing
     and it means a demo can be scrubbed to any point, and that a dropped frame
     cannot strand it in a state its script never described. */
  const st=demo.build();
  demo.run(st,u);
  guideStageCache=st;
  ctx.setTransform(box.dpr,0,0,box.dpr,0,0);
  /* No sway. Every demo is about a gesture, and a breathing planting behind it
     is motion competing with the thing being explained — and under reduced
     motion there must be none at all. */
  gsRender(ctx,st,box.w,box.h,0);
}
/* The loop STOPS rather than spinning on a frame it will not draw. The first
   cut re-armed unconditionally and only skipped the draw, which left a rAF
   running forever behind a paused demo, a list view and — worst — a
   reduced-motion reader, who has asked for no animation and would have got a
   60Hz wake-up anyway. Every path back in calls startGuideLoop: the Play
   button, selecting an entry, and visibilitychange. */
function guideTick(t){
  guideRaf=0;
  if (!guideCanAnimate()) return;
  drawGuideFrame(t);
  guideRaf=requestAnimationFrame(guideTick);
}
function guideCanAnimate(){
  return guideOpen() && guidePlaying && !document.hidden
    && !(guideSheetUi() && guideView!=='detail');
}
function startGuideLoop(){
  if (guideRaf || !guideCanAnimate()) return;
  guideT0=0;
  guideRaf=requestAnimationFrame(guideTick);
}
function stopGuideLoop(){ if (guideRaf) cancelAnimationFrame(guideRaf); guideRaf=0; }
/* A hidden tab does not rasterise, so the loop is stopped rather than left to
   burn battery behind a lock screen. */
document.addEventListener('visibilitychange',function(){
  if (document.hidden) stopGuideLoop(); else if (guideOpen()) startGuideLoop();
});
addEventListener('resize',function(){ if (guideOpen()){ syncGuideView(); drawGuideFrame(); } });

if ($('btnGuide')) $('btnGuide').onclick=openGuide;
if ($('btnGuideClose')) $('btnGuideClose').onclick=closeGuide;
if ($('btnGuideBack')) $('btnGuideBack').onclick=guideBack;
