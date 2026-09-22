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
   drawWaterFeatureArt, drawFirepitArt, drawPet — all of which already take a
   context and a screen point and read no game state, because the tray chips
   and the plant library needed exactly that first (drawMaterialIcon,
   libCanvas). So a guidebook demo cannot advertise a plant, a material or a
   fence the canvas does not draw: it is the fencePanel lesson applied to
   documentation.

   One painter is still camera-coupled (drawBoulder positions itself through
   footprintScreenPoly -> screenOf, which reads `cam`, `game.rot` and the
   elevation map; drawFirepit was the other until it was rebuilt on a ground
   point). It runs inside gsBorrowCamera, which overrides exactly four fields
   and restores them in a `finally` — the captureGardenPortrait pattern,
   narrowed to the smallest possible bracket.

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
    /* A second layer sharing the same tiles, exactly as game.bulbs does — a
       bulb tucks UNDER a perennial rather than displacing it, and a demo that
       could not show two things on one tile could not show that. */
    bulbs:Object.create(null),
    props:[],                     // {kind,x,y,...}
    cursor:null,                  // {x,y,down,press,drag,label}
    notes:[],                     // floating text over the stage
    chrome:null,                  // one segmented row, or a stack of them
    rail:null,                    // {on,tapping} — the tool rail, left edge
    top:null,                     // {label,kind,tapping} — a top-bar control
    seasonBox:null,               // {season,phase,fill,hold,press,ff} — the real one
    ruler:null,                   // {a,b} in stage tiles — drawn by the app's own
    menu:null,                    // {items,on,open} — a mocked dropdown
    /* The reader's OWN photograph, which the guidebook by definition does not
       have — see gsDrawUnderlay for why this one mark is a stand-in.
       {x,y,w,h,opacity,frame,calib} in stage tiles. */
    underlay:null,
    shade:null,                   // {north} — the overlay, scored by treeShadeScore
    compass:null,                 // {deg} — the north dial
    panel:null                    // {title,sub,find,rows} — a readout or a result list
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
/* The drawing basis, which rotates with the stage exactly as isoAxes() rotates
   with game.rot. Pinned to ISO_AXES_FLAT it was the rot-0 basis forever: in the
   Turn the view demo the bench and the pot kept their original facing while the
   plot turned underneath them, so the two pieces of furniture stayed put while
   the garden rotated around them. Position was already right — gsFootCentre
   averages two projected tile centres — which is why it read as the objects
   refusing to turn rather than as them being in the wrong place. */
function gsAxes(st){
  switch((st.rot||0)&3){
    case 1:  return [[-TILE_W/2,TILE_H/2],[TILE_W/2,TILE_H/2]];
    case 2:  return [[-TILE_W/2,-TILE_H/2],[TILE_W/2,-TILE_H/2]];
    case 3:  return [[TILE_W/2,-TILE_H/2],[-TILE_W/2,-TILE_H/2]];
    default: return [[TILE_W/2,TILE_H/2],[-TILE_W/2,TILE_H/2]];
  }
}

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
  /* The PAN comes back out. gsProject adds st.pan to every point, so an extent
     measured through it moves with the pan — and gsRender then centres the fit
     on that extent, which subtracts exactly what the pan added. The camera
     demo was panning 70px and being recentred 70px every frame, so "Move and
     zoom" showed a garden that never moved. The extent is the stage's own
     geometry; the pan is where the camera is looking at it from. */
  const px=st.pan[0], py=st.pan[1];
  return {x0:x0-px, x1:x1-px, y0:y0-py, y1:y1-py};
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


/* ---------- the site: a photograph underneath, and the sun overhead ----------

   These two are the setup a real design starts from, and they are the only
   part of the app the stage could not already draw: the reference photograph
   is a file the reader supplies, and the shade map is keyed on where the
   reader's north is. */

/* North and the season, borrowed the way the camera is. treeShadeScore reaches
   orientedSunPath() for the sun's bearing and shadeSeasonScale() for how far a
   shadow runs — game.siteNorthDeg and the LIVE CLOCK. Left alone, the shade
   demo would swing with whatever north the last garden happened to be set to,
   and lengthen in the reader's own winter: the bloomLvl trap in a second
   costume, a demo whose picture depends on when the session started.
   Four fields, one synchronous call, all four put back in a finally. */
function gsBorrowSite(st,deg,fn){
  const prior={deg:game.siteNorthDeg, preview:game.siteNorthPreviewDeg,
               cache:siteDirectionCache, off:game.dayOffset};
  try{
    game.siteNorthDeg=normalizeSiteNorthDeg(deg);
    game.siteNorthPreviewDeg=null;
    siteDirectionCache={deg:null,dirs:null,path:null};
    /* absDay() is floor(elapsed/DAY_MS)+dayOffset, so nudging the offset by the
       difference lands the clock in the middle of the stage's OWN season
       without this module having to know how the clock is kept. */
    const want=SEASONS.indexOf(st.season)*DAYS_PER_SEASON+(DAYS_PER_SEASON>>1);
    game.dayOffset=prior.off+(want-absDay());
    return fn();
  } finally {
    game.siteNorthDeg=prior.deg; game.siteNorthPreviewDeg=prior.preview;
    siteDirectionCache=prior.cache; game.dayOffset=prior.off;
  }
}

/* The shade overlay, scored by the app's own treeShadeScore over the stage's
   own trees, banded and coloured off the renderer's own overlay pass — amber
   full sun, teal part shade, cool blue shade.
   A TREE is the only thing in this app that casts shade: ensureShadeMap walks
   treeIndex() and nothing else, so a wall does not. The building in that demo
   is therefore what you design AROUND rather than a second caster, and the
   demo says so rather than implying a feature that is not there. */
function gsDrawShade(ctx,st){
  if (!st.shade) return;
  gsBorrowSite(st,st.shade.north||0,function(){
    const trees=[];
    Object.keys(st.plants).forEach(function(k){
      const p=st.plants[k]; if (!p) return;
      const P=plantDef(p.s,p.v); if (!isTreeDef(P)) return;
      const c=k.split(',').map(Number);
      const est=p.g===undefined?1:p.g;
      /* The reach is woodyRadiusTiles — the real mature crown off the species'
         own spread — never the drawn width. That is the T2 rule the whole
         woody system rests on, and shadeAt's radius comes from it too. */
      const r=woodyRadiusTiles(P)*est;
      trees.push({x:c[0],y:c[1],r:r,est:est,
        activePotential:est>=SHADE_ACTIVE_ESTAB && r>=SHADE_MIN_RADIUS});
    });
    if (!trees.length) return;
    for (let y=0;y<st.rows;y++) for (let x=0;x<st.cols;x++){
      let score=0;
      trees.forEach(function(sh){ score=Math.max(score,treeShadeScore(sh,x,y)); });
      gsTileMark(ctx,st,x,y,
        score>=SHADE_ACTIVE_SCORE ? 'rgba(38,84,112,0.52)'
        : score>0 ? 'rgba(70,132,128,0.44)'
        : 'rgba(232,180,78,0.40)', null);
    }
  });
}

/* The site photograph, and the ONE mark in this module that is not the app's
   own painter — it cannot be. drawSiteUnderlay is a drawImage of the reader's
   own photograph, and the guidebook does not have one: shipping a stock aerial
   would cost the precache budget and a licence, for a picture of nobody's
   garden. So the image is a deliberately crude stand-in, and everything AROUND
   it is drawSiteUnderlay's real editing chrome — the dashed cyan frame, the
   corner dots, the gold calibration line with its numbered ends — because that
   is what the reader is looking for on their own screen. */
function gsUnderlayQuad(st,u){
  return [[u.x-u.w/2,u.y-u.h/2],[u.x+u.w/2,u.y-u.h/2],
          [u.x+u.w/2,u.y+u.h/2],[u.x-u.w/2,u.y+u.h/2]]
    .map(function(p){ return gsProjectAt(st,p[0],p[1]); });
}
function gsPaintPhotoStandIn(ctx,st,u){
  const q=gsUnderlayQuad(st,u);
  // bilinear inside the quad, so the sketch shears with the ground plane
  const P=function(a,b){
    const tx=q[0][0]+(q[1][0]-q[0][0])*a, ty=q[0][1]+(q[1][1]-q[0][1])*a;
    const bx=q[3][0]+(q[2][0]-q[3][0])*a, by=q[3][1]+(q[2][1]-q[3][1])*a;
    return [tx+(bx-tx)*b, ty+(by-ty)*b];
  };
  const poly=function(pts,fill){
    ctx.beginPath();
    pts.forEach(function(p,i){ const s=P(p[0],p[1]);
      if (i) ctx.lineTo(s[0],s[1]); else ctx.moveTo(s[0],s[1]); });
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  };
  /* Deliberately DESATURATED and a stop darker than the garden under it: a
     photograph laid over a drawing has to read as a photograph, and a
     grass-green rectangle over grass reads as nothing at all. Measured on
     the plate, the first cut was invisible at the 35% opacity the tool
     actually defaults to. */
  poly([[0,0],[1,0],[1,1],[0,1]],'#67724f');                          // rough grass
  poly([[0.04,0],[0.22,0],[0.28,1],[0.10,1]],'#cfcac0');              // the drive
  poly([[0.33,0.05],[0.90,0.05],[0.90,0.43],[0.33,0.43]],'#3f362f');  // a roof
  poly([[0.33,0.20],[0.90,0.20],[0.90,0.24],[0.33,0.24]],'#6a5c4e');  // its ridge
  poly([[0.36,0.43],[0.90,0.43],[0.90,0.51],[0.36,0.51]],'#231d19');  // its shadow
  poly([[0.40,0.58],[0.65,0.54],[0.73,0.78],[0.44,0.84]],'#27351f');  // planting
  poly([[0.77,0.59],[0.96,0.63],[0.94,0.91],[0.73,0.86]],'#2f3d26');
  poly([[0.33,0.88],[0.66,0.84],[0.68,1],[0.33,1]],'#8b9463');        // mown lawn
}
function gsDrawUnderlay(ctx,st,scale){
  const u=st.underlay; if (!u) return;
  const q=gsUnderlayQuad(st,u);
  /* The quad is walked TWICE on purpose. clip() does not consume the path,
     but the stand-in's own fills each begin one — so a single beginPath at
     the top left the frame stroking whatever shape the sketch happened to
     finish on, which came out as a small dashed lozenge in one corner of a
     photo whose outline is the thing the reader is dragging. */
  const edge=function(){
    ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]);
    q.slice(1).forEach(function(p){ ctx.lineTo(p[0],p[1]); });
    ctx.closePath();
  };
  ctx.save();
  edge();
  ctx.save(); ctx.clip();
  ctx.globalAlpha=u.opacity===undefined?0.35:u.opacity;
  gsPaintPhotoStandIn(ctx,st,u);
  ctx.restore();
  /* The editing chrome is inside the stage transform, because it has to
     follow the photo's own quad — so every width it names is multiplied by
     the fit scale on the way to the screen, and on a phone plate that scale
     is about 0.42. A 7px handle would land at 3px and read as a speck. The
     factor divides the scale back out, bounded so a large plate does not get
     a hairline, which is the same trick GUIDE_SEASON_BOX's 1.5 performs by
     hand for a control whose size is fixed. */
  const K=Math.max(1.2,Math.min(3.4,1.15/(scale||1)));
  if (u.frame){
    edge();
    ctx.strokeStyle='#72c9ff'; ctx.lineWidth=2.5*K; ctx.setLineDash([7*K,5*K]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#172733';
    q.forEach(function(p){ ctx.beginPath(); ctx.arc(p[0],p[1],4.5*K,0,Math.PI*2); ctx.fill(); });
  }
  if (u.calib && u.calib.length){
    const ps=u.calib.map(function(p){ return gsProjectAt(st,p[0],p[1]); });
    ctx.strokeStyle='#f4c66a'; ctx.lineWidth=3*K;
    if (ps.length>1){ ctx.beginPath(); ctx.moveTo(ps[0][0],ps[0][1]);
      ctx.lineTo(ps[1][0],ps[1][1]); ctx.stroke(); }
    ps.forEach(function(p,i){
      ctx.fillStyle='#172733';
      ctx.beginPath(); ctx.arc(p[0],p[1],7*K,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#f4c66a'; ctx.font='700 '+(10*K)+"px 'IBM Plex Sans', sans-serif";
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(i+1),p[0],p[1]);
    });
  }
  ctx.restore();
}
/* ---------- props ----------
   Everything that stands on the ground. Each kind is drawn by the app's own
   painter; the ones that position themselves through the live camera borrow it
   for the length of one call. */

/* drawBoulder finds its footprint through footprintScreenPoly -> screenOf,
   which reads cam, game.rot and the elevation map (and so, until it was rebuilt,
   did drawFirepit). Rather than reimplementing a silhouette (which would then be
   free to drift from the garden's), the stage lends it a camera that lands the
   footprint exactly where the stage wants it and takes it back in a `finally`.
   Four fields, one synchronous call, no allocation of game state and no cache
   touched — the captureGardenPortrait pattern at its smallest. */
function gsBorrowCamera(st,x,y,sx,sy,fn){
  const prior={x:cam.x,y:cam.y,rot:game.rot,elev:game.elevation};
  try{
    /* The stage's own rotation is borrowed along with the camera, so a piece
       drawn by one of these painters turns with the plot like everything else.
       worldToView's CONSTANT depends on the live GW/GH and its linear part does
       not, so anchoring the camera on one tile makes every offset inside the
       footprint correct whatever size garden the app happens to be holding:
       viewScreen is isoX(v) - cam at W=H=0, so cam = isoX(anchor) - sx puts
       that tile exactly where the stage wants it.
       Elevation is emptied for the same reason the rotation is set rather than
       left: screenOf must answer about the stage, not about the last garden. */
    game.rot=(st.rot||0)&3; game.elevation=Object.create(null);
    const [vx,vy]=worldToView(x,y);
    cam.x=isoX(vx,vy)-sx; cam.y=isoY(vx,vy)-sy;
    fn(x,y);
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
  const season=st.season, axes=gsAxes(st);
  switch(p.kind){
    case 'fence': return gsDrawFence(ctx,st,p);
    case 'pot':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawPotArt(ctx,cx,cy,{style:p.style,size:p.size,finish:p.finish,face:p.face|0},season,axes);
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
      return gsBorrowCamera(st,p.x,p.y,sx,sy,(x,y)=>drawBoulder(ctx,0,0,season,{type:p.type},x,y));
    }
    case 'firepit':{
      const [cx,cy]=gsFootCentre(st,p.x,p.y,gsPropSize(p));
      return drawFirepitArt(ctx,cx,cy,normalizeFirepitDraft(p),season,axes,tileSeed(p.x,p.y),!!p.lit);
    }
    /* A light and a building footprint reach their painters the same way.
       Both read the camera — the fixture through screenOf, the footprint
       through screenOf AND the corner lattice — and both are otherwise pure
       functions of their own record, so the borrow is all they need and no
       silhouette had to be reinvented here. */
    case 'light':{
      const [sx,sy]=gsProject(st,p.x,p.y);
      return gsBorrowCamera(st,p.x,p.y,sx,sy,(x,y)=>{
        const l={type:p.type,tone:p.tone};
        if (p.lit) drawLightGlow(ctx,0,0,l,x,y);
        drawLightFixture(ctx,0,0,season,l,x,y,!!p.lit);
      });
    }
    case 'building':{
      const [sx,sy]=gsProject(st,0,0);
      return gsBorrowCamera(st,0,0,sx,sy,()=>{
        const b=Object.assign({id:'guide',vertices:p.vertices},
          normalizeBuildingStyle({status:p.status,label:p.label}));
        for (const t of buildingTiles(b)) drawBuildingTile(ctx,0,0,b,t[0],t[1]);
        drawBuildingOutline(ctx,0,0,b);
      });
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
    case 'firepit':return firepitTileSize(normalizeFirepitDraft(p));
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
  if (p.kind==='light') return gsDepth(st,p.x,p.y)+0.36;
  if (p.kind==='building'){
    let d=-Infinity;
    (p.vertices||[]).forEach(v=>{ d=Math.max(d,gsDepth(st,v[0],v[1])); });
    return d+0.345;
  }
  const sz=gsPropSize(p);
  const far=Math.max(gsDepth(st,p.x,p.y),gsDepth(st,p.x+sz.w-1,p.y),
                     gsDepth(st,p.x,p.y+sz.h-1),gsDepth(st,p.x+sz.w-1,p.y+sz.h-1));
  return far+(p.kind==='pot'?0.24:p.kind==='support'?0.30:0.375);
}
function gsPaintEntities(ctx,st,sway){
  const ents=[];
  Object.keys(st.plants).forEach(k=>{
    const p=st.plants[k]; if (!p||p.g<=0.02) return;
    const [x,y]=k.split(',').map(Number);
    /* A plant standing in a container stands on the COMPOST, in the middle of
       the vessel — plantScreenOf's own two moves, and what keeps a pot of
       tulips and a pot of sedge agreeing about where soil level is. The vessel
       sorts behind it (gsPropDepth), so the foliage draws over its own rim. */
    const pot=st.props.find(q=>q.kind==='pot'&&q.x===x&&q.y===y);
    ents.push({d:(pot?gsPropDepth(st,pot)-0.24:gsDepth(st,x,y))+0.30, draw:()=>{
      let px=x+(p.ox||0), py=y+(p.oy||0), lift=0;
      if (pot){ const sz=gsPropSize(pot);
        px=pot.x+(sz.w-1)/2; py=pot.y+(sz.h-1)/2;
        lift=potSoilLiftPx({style:pot.style,size:pot.size}); }
      const [sx,sy]=gsProject(st,px,py);
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
  Object.keys(st.bulbs||{}).forEach(k=>{
    const p=st.bulbs[k]; if (!p||p.g<=0.02) return;
    const [x,y]=k.split(',').map(Number);
    ents.push({d:gsDepth(st,x,y)+0.25, draw:()=>{
      const [sx,sy]=gsProject(st,x,y);
      drawPlant(ctx,sx,sy+TILE_H/2,p.s,p.g,st.season,(tileSeed(x,y)^0x9e37)>>>0,sway,p.v,
        p.bloom===undefined?1:p.bloom);
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
/* Drawn in SCREEN space, outside the stage transform, which is why it takes a
   projector rather than reading gsProjectAt itself. Inside the transform the
   13px type was multiplied by the fit scale, and on a phone that scale is well
   under 1 — measured, a 343x257 plate with a rail fits a 7x7 stage at 0.42, so
   every caption in the guidebook rendered at about 5.5px. The ANCHOR stays in
   stage units (and so does dx/dy, a relationship to a tile); only the type and
   the plate are pinned to the screen. */
function gsDrawNote(ctx,st,n,box,toScreen){
  const p=n.at ? gsProjectAt(st,n.at[0],n.at[1]) : [0,-40];
  ctx.save();
  /* Sized against the PLATE, not the stage scale. Flat 13px is right on a
     phone and reads small against a 616px desktop plate; tracking the stage
     scale is what put it at 5.5px in the first place. A short ramp between
     the two plate sizes the layout actually produces keeps one caption
     legible at both ends. */
  const fs=Math.max(12,Math.min(17,(box?box.y1-box.y0:260)/22));
  ctx.font='600 '+fs.toFixed(1)+"px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const w=ctx.measureText(n.text).width+fs*1.4, h=fs*1.85;
  /* Kept inside the plate, and clear of the chrome. A note hangs off a TILE,
     so one pinned above a tile near the top edge draws off the canvas — and
     the drift demo's count label, the single sentence that demo exists to say,
     was landing under the Draw/Drift/Matrix row. The box the caller passes is
     the plate LESS the rail's column and the chrome band. */
  const q=toScreen ? toScreen(p[0]+(n.dx||0), p[1]+(n.dy||0))
                   : [p[0]+(n.dx||0), p[1]+(n.dy||0)];
  let x=q[0], y=q[1];
  if (box){
    x=Math.max(box.x0+w/2+4,Math.min(box.x1-w/2-4,x));
    y=Math.max(box.y0+h/2+4,Math.min(box.y1-h/2-4,y));
  }
  ctx.globalAlpha=n.alpha===undefined?1:n.alpha;
  ctx.fillStyle=n.tone==='warn'?'rgba(126,42,35,0.92)'
    : n.tone==='good'?'rgba(58,74,48,0.92)':'rgba(26,21,17,0.88)';
  const r=h*0.29;
  ctx.beginPath(); ctx.moveTo(x-w/2+r,y-h/2);
  ctx.arcTo(x+w/2,y-h/2,x+w/2,y+h/2,r); ctx.arcTo(x+w/2,y+h/2,x-w/2,y+h/2,r);
  ctx.arcTo(x-w/2,y+h/2,x-w/2,y-h/2,r); ctx.arcTo(x-w/2,y-h/2,x+w/2,y-h/2,r);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=n.tone==='warn'?'#f3c9c4':'#efe6d3';
  ctx.fillText(n.text,x,y);
  ctx.restore();
}
/* ---------- where the tool lives ----------
   A demo that shows only the RESULT teaches the second half of the lesson. The
   first half is "which button, and where is it" — and for most of these tools
   that is the harder half: the rail is a column of 42x32 icons under 8px
   labels, and a landscape material is three taps down a catalog.

   So a demo also draws the control it is using — the tool rail down the left
   edge where it really sits, and the catalog path as a stack of segmented rows
   across the top — with the relevant button armed and a tap ripple on it. Both
   are painted by the app's OWN icon function (drawCanvasIcon, the same 42x32
   painter makeCanvasTool hands every rail button), so the guidebook cannot
   show a button the rail does not have. The fencePanel rule, applied to chrome.

   `where` lives on the DEMO rather than on the chapter entry, so the animated
   affordance on the canvas and the written breadcrumb under the title are one
   piece of data and cannot drift apart. */

/* The rail, in its real order. It is built by literal add() calls inside
   buildCanvasTools and so cannot be imported; a test pins this list against
   that function's source instead — the same move the tour's step test makes
   when it stringifies the real function to find its fire site. Undo and Redo
   are deliberately absent: they sit below a divider as one-shot actions and no
   demo arms them. */
const GUIDE_RAIL=[
  {label:'Hand',   kind:'hand'},
  {label:'Select', kind:'select'},
  {label:'Ruler',  kind:'ruler'},
  {label:'Plant',  kind:'brush'},
  {label:'Erase',  kind:'erase', danger:true},
  {label:'Pick',   kind:'dropper'},
  // below the divider: one-shot history actions, not modes
  {label:'Undo',   kind:'undo', sep:true},
  {label:'Redo',   kind:'redo'},
];
function guideRailButton(label){ return GUIDE_RAIL.find(b=>b.label===label)||null; }
const GUIDE_RAIL_STEP=54;      // a 50px button and its 4px gap
/* Which slice of the rail a plate can hold at full size, always containing the
   armed button. The real rail scrolls on a short viewport for exactly this
   reason, so showing four of eight on a phone is the honest picture rather
   than a compromise. */
function gsRailWindow(box,rail){
  const n=GUIDE_RAIL.length;
  const fit=Math.floor((box.y1-box.y0-20)/GUIDE_RAIL_STEP);
  if (fit<3) return null;
  const show=Math.min(n,fit);
  let i=GUIDE_RAIL.findIndex(b=>b.label===rail.on);
  if (i<0) i=0;
  let from=Math.max(0,Math.min(n-show,i-((show/2)|0)));
  return {from, to:from+show, show};
}

/* A mini rail pinned to the left edge, which is where the real one is — the
   position is half the message, so this is drawn ON the plate rather than in a
   caption beside it. It auto-scales rather than assuming a height: the demo
   canvas is min(46vh,340px) on DOCK and min(38vh,280px) on SHEET with a 220px
   floor, and six buttons at the rail's real 50px are 320px, taller than the
   smallest plate it has to fit inside. */
/* How much of the left edge a rail wants, asked WITHOUT drawing — gsRender
   needs the answer before it fits the stage, and one definition means the
   reservation and the drawing cannot disagree about where the rail ends.
   A plate too short for a legible rail gets none: below about 0.45 the 8px
   labels are unreadable and the icons are a smear, and the written trail under
   the title carries the same information anyway, so this degrades to the words
   rather than to a blur. The floor is also the GUARD — on a resize the canvas
   can report a height of a few pixels for one frame, and a negative scale
   reached arcTo, which throws outright. */
function gsRailScale(box,rail){
  if (!rail || !rail.on) return 0;
  const w=gsRailWindow(box,rail); if (!w) return 0;
  const s=Math.min(1,(box.y1-box.y0-20)/(w.show*GUIDE_RAIL_STEP));
  return s>0.45 ? s : 0;
}
function gsRailWidth(box,rail){ const s=gsRailScale(box,rail); return s?48*s+20:0; }
function gsDrawRail(ctx,box,rail){
  const s=gsRailScale(box,rail); if (!s) return 0;
  const win=gsRailWindow(box,rail);
  const full=50, gap=4;
  const bw=48*s, bh=full*s, step=(full+gap)*s;
  const x=box.x0+10, y0=(box.y0+box.y1)/2-(win.show*step-gap*s)/2;
  ctx.save();
  for (let k=0;k<win.show;k++){
    const i=win.from+k;
    const b=GUIDE_RAIL[i], on=b.label===rail.on, y=y0+k*step, r=9*s;
    /* The divider Undo and Redo sit below. It is hidden on the SHEET tier in
       the real rail, so it is only drawn where there is room for it here. */
    if (b.sep && k>0){
      ctx.strokeStyle='rgba(239,230,211,0.16)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+6,y-gap*s/2); ctx.lineTo(x+bw-6,y-gap*s/2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+bw,y,x+bw,y+bh,r); ctx.arcTo(x+bw,y+bh,x,y+bh,r);
    ctx.arcTo(x,y+bh,x,y,r); ctx.arcTo(x,y,x+bw,y,r); ctx.closePath();
    /* Armed is the accent border over a lifted fill, as .canvas-tool.sel
       paints it — and .danger.sel is a different colour, because Erase is the
       one rail button that says so about itself. */
    ctx.fillStyle=on ? (b.danger?'rgba(126,42,35,0.66)':'rgba(201,127,63,0.28)')
                     : 'rgba(26,21,17,0.74)';
    ctx.fill();
    ctx.lineWidth=Math.max(1,1.5*s);
    ctx.strokeStyle=on ? (b.danger?'#d9645a':'#c97f3f') : 'rgba(239,230,211,0.13)';
    ctx.stroke();
    ctx.save();                       // the REAL icon, at its own 42x32
    ctx.translate(x+bw/2-21*s, y+3*s); ctx.scale(s,s);
    ctx.globalAlpha=on?1:0.55;
    drawCanvasIcon(ctx,b.kind);
    ctx.restore();
    ctx.globalAlpha=1;
    ctx.font='700 '+(8.5*s).toFixed(1)+"px 'IBM Plex Sans', system-ui, sans-serif";
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle=on ? (b.danger?'#f3c9c4':'#efe6d3') : 'rgba(239,230,211,0.46)';
    ctx.fillText(b.label,x+bw/2,y+bh-5*s);
    if (on && rail.tapping>0 && rail.tapping<1){
      ctx.strokeStyle='rgba(201,127,63,'+(0.7*(1-rail.tapping)).toFixed(3)+')';
      ctx.lineWidth=2.5;
      ctx.beginPath();
      ctx.ellipse(x+bw/2,y+bh/2,bw*0.62+rail.tapping*24,bh*0.52+rail.tapping*16,0,0,Math.PI*2);
      ctx.stroke();
    }
  }
  ctx.restore();
  return bw+20;                       // how much of the left edge the rail took
}


/* A mocked control, drawn in the corner of the stage. Several tools are armed
   from a chip rather than from the canvas — Drift, the brush sizes, Age,
   Layers — and a demo that showed only the canvas would be teaching the second
   half of a two-part instruction. Drawn rather than built from real DOM
   because the real controls live inside the planner's HUD, which does not
   exist on the title screen. */
/* One segmented row. The catalog path is two or three of these stacked
   (Landscape -> Ground -> Bed) and a brush option row is another, so
   gsDrawChrome walks a LIST and this draws one member of it; a demo that sets
   a bare object is normalised to a stack of one, which is why none of them had
   to change when the path rows arrived. */
/* Below this the row is DROPPED rather than drawn illegibly, the way the rail
   drops out below its own floor: 12.5px scaled to 0.62 is 7.8px, and a
   breadcrumb nobody can read is worse than the written one underneath the
   plate, which says the same thing in full. */
const GUIDE_CHROME_MIN_K=0.66;
function gsDrawChromeRow(ctx,box,ch,left,top){
  if (!ch) return 0;
  const pad=10, gap=6, hgt=34;
  ctx.save();
  ctx.font="600 12.5px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textBaseline='middle';
  const widths=ch.options.map(o=>ctx.measureText(o).width+(ch.trail?12:22));
  const sep=ch.trail?14:gap;
  const total=widths.reduce((a,b)=>a+b,0)+sep*(widths.length-1)+pad*2;
  /* Scaled to fit rather than clipped: at the narrowest plate the erase layer
     seg and the Layers lens both ran past the right edge, and a clipped
     segmented control loses an option with nothing to say it did. Drawn from a
     local origin inside the scale, so nothing below has to know. */
  const k=Math.min(1,(box.x1-left-12)/total);
  if (k<GUIDE_CHROME_MIN_K){ ctx.restore(); return 0; }
  ctx.translate(left,top); ctx.scale(k,k);
  const x=0, y=0, r=9;
  /* A TRAIL reads left to right with chevrons and only its last step armed —
     "Landscape > Hardscape > Fence" — because that is a path through the
     catalog rather than a set of alternatives. A plain row is the segmented
     control it looks like: Draw / Drift / Matrix, where every option is a
     peer. Same painter, because they are the same pill. */
  const trail=!!ch.trail;
  ctx.fillStyle='rgba(26,21,17,0.86)';
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
    cx2+=w;
    if (trail && i<ch.options.length-1){
      ctx.strokeStyle='rgba(239,230,211,0.42)'; ctx.lineWidth=1.6;
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(cx2+4,y+hgt/2-3.5); ctx.lineTo(cx2+8,y+hgt/2); ctx.lineTo(cx2+4,y+hgt/2+3.5);
      ctx.stroke();
    }
    cx2+=sep;
  });
  if (ch.tapping>0 && ch.tapping<1){
    const w=widths[ch.on], cxT=x+pad+widths.slice(0,ch.on).reduce((a,b)=>a+b+sep,0)+w/2;
    ctx.strokeStyle=`rgba(201,127,63,${0.6*(1-ch.tapping)})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cxT,y+hgt/2,10+ch.tapping*20,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
  return hgt*k;
}
/* The stack. Rows read top to bottom as a path — the tab, then the category,
   then the material — with the tool's own options last, which is the order the
   taps happen in. It starts to the RIGHT of whatever the rail claimed, so the
   two affordances never sit on top of each other. */
function gsDrawChrome(ctx,st,box,chrome,left,top){
  if (!chrome) return 0;
  const rows=Array.isArray(chrome)?chrome:[chrome];
  let y=box.y0+14+(top||0);
  rows.forEach(row=>{ y+=gsDrawChromeRow(ctx,box,row,box.x0+left+14,y)+7; });
  return y-(box.y0+14);
}

/* The season box, which is a CONTROL and not a set of four buttons. The demo
   used to draw "Spring | Summer | Fall | Winter" as a segmented row, and that
   was the one demo in the guidebook teaching a control the app does not have:
   there is no season picker. There is one compact readout you press and HOLD
   to run the year, and a short tap opens the time menu. Showing four tabs
   taught a gesture that does not exist and hid the one that does.

   Drawn from the real thing's own numbers — 150x34, the SEASON_FILL tint at
   .58 with its 2px leading edge, the 15.5px Fraunces name over an 8.7px
   uppercase phase — scaled up, because at its true size it is 34px tall in a
   plate six times that. */
const GUIDE_SEASON_BOX={w:150,h:34,scale:1.5};
function gsDrawSeasonBox(ctx,box,sb,left){
  if (!sb) return 0;
  const S=GUIDE_SEASON_BOX, k=S.scale, w=S.w*k, h=S.h*k;
  const x=box.x0+left+14, y=box.y0+14, r=9*k;
  const path=()=>{ ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); };
  ctx.save();
  path(); ctx.fillStyle='rgba(26,21,17,0.88)'; ctx.fill();
  /* The fill is the season's progress, left to right, under the text — the
     thing that makes "how far through am I" legible rather than a guess. */
  ctx.save(); path(); ctx.clip();
  const fw=w*Math.max(0,Math.min(1,sb.fill||0));
  ctx.globalAlpha=0.58; ctx.fillStyle=SEASON_FILL[sb.season]||'#7fc24e';
  ctx.fillRect(x,y,fw,h);
  ctx.globalAlpha=1;
  if (fw>1){ ctx.fillStyle='rgba(239,230,211,0.85)'; ctx.fillRect(x+fw-2,y,2,h); }
  ctx.restore();
  ctx.strokeStyle=sb.press?'#c97f3f':'rgba(239,230,211,0.22)';
  ctx.lineWidth=sb.press?2.2:1.4; path(); ctx.stroke();

  ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  ctx.fillStyle='#efe6d3';
  ctx.font='600 '+(15.5*k).toFixed(1)+"px 'Fraunces', Georgia, serif";
  ctx.fillText(sb.season, x+11*k, y+h*0.52);
  ctx.fillStyle=sb.ff?'#f4c66a':'#ece1cb';
  ctx.font='600 '+(8.7*k).toFixed(1)+"px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.fillText((sb.ff?'FAST-FORWARDING':sb.phase||'').toUpperCase(), x+11*k, y+h*0.82);

  /* The hold sweep. The real one is a masked conic ring on .season-box::after,
     animated through a registered --hold-sweep property; a dashed stroke of the
     box's own outline is the same reading — how far through the 360ms you are
     — without a second path to keep in step with the box's corners. */
  if (sb.hold>0 && sb.hold<1){
    const per=2*(w+h);
    ctx.strokeStyle='#c97f3f'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.setLineDash([per*sb.hold, per]); ctx.lineDashOffset=0;
    path(); ctx.stroke();
    ctx.setLineDash([]);
  }
  // the finger, held on the box rather than tapping it
  if (sb.press){
    const cx=x+w*0.5, cy=y+h+16*k;
    ctx.fillStyle='rgba(201,127,63,0.42)'; ctx.strokeStyle='#c97f3f'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.ellipse(cx,cy,13,6.5,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#efe6d3';
    ctx.beginPath(); ctx.arc(cx,cy-2,2.6,0,Math.PI*2); ctx.fill();
    if (sb.hold>=1){
      const p=(sb.pulse||0);
      ctx.strokeStyle='rgba(201,127,63,'+(0.5*(1-p)).toFixed(3)+')'; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.ellipse(cx,cy,13+p*22,6.5+p*11,0,0,Math.PI*2); ctx.stroke();
    }
  }
  ctx.restore();
  // what it claimed of the top edge, so a chrome row lands under it
  return h+(sb.press?26*k:8);
}

/* A single top-bar control — Rotate, Layers — as a chip at the top right,
   which is the half of the chrome that is not the rail and not the catalog.
   Same rule as the rail: the glyph is drawCanvasIcon's, so the guidebook
   cannot invent a button. */
function gsDrawTopChip(ctx,box,chip){
  if (!chip) return;
  ctx.save();
  ctx.font="600 12.5px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textBaseline='middle';
  /* A chip with no icon is not a gap: the scheme chip really is text in the
     top bar, so a label-only pill is the accurate picture rather than a
     placeholder waiting for a glyph. */
  const ic=chip.kind?34:0;
  const tw=ctx.measureText(chip.label).width, w=tw+22+ic, h=38, r=10;
  const x=box.x1-w-14, y=box.y0+14;
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  ctx.fillStyle='rgba(201,127,63,0.30)'; ctx.fill();
  ctx.strokeStyle='#c97f3f'; ctx.lineWidth=1.5; ctx.stroke();
  if (chip.kind){
    ctx.save(); ctx.translate(x+8,y+3); ctx.scale(0.78,0.78);
    drawCanvasIcon(ctx,chip.kind);
    ctx.restore();
  }
  ctx.fillStyle='#efe6d3'; ctx.textAlign='left';
  ctx.fillText(chip.label,x+11+ic,y+h/2);
  if (chip.tapping>0 && chip.tapping<1){
    ctx.strokeStyle='rgba(201,127,63,'+(0.7*(1-chip.tapping)).toFixed(3)+')';
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.ellipse(x+w/2,y+h/2,w*0.56+chip.tapping*24,h*0.6+chip.tapping*16,0,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}

/* Apply a demo's `where` to the stage it just built. Done HERE rather than in
   each run() so all 25 demos got the affordance without 25 edits, and so the
   canvas and the written breadcrumb under the title read one piece of data.

   The path rows come FIRST in the chrome stack and ripple first, because that
   is the order the taps really happen in: pick the tab, then the category,
   then the material, and only then the tool's own options (Drift, a brush
   size, an Age) which the demo set for itself.

   The rail is shown only where the rail is genuinely the route. A landscape
   material DOES light the rail's Plant button — isBrushTool is true for bed,
   path, fence and the rest — but showing "Plant" lit beside a demo about
   gravel answers a question nobody asked and raises one they now have. Those
   demos show the catalog path instead, which is how you actually get there. */
function gsApplyWhere(st,where,u){
  if (!where) return;
  const arm=(a,b)=>gAt(u,a,b);
  if (where.rail) st.rail={on:where.rail, tapping:arm(0.01,0.15)};
  /* A drawn:true flag means the demo paints that control itself, in its own real place
     — the season box does. It still earns its line in the written trail, which
     is the point of keeping one where per demo. */
  if (where.top && !where.top.drawn)
    st.top={label:where.top.label, kind:where.top.kind, tapping:arm(0.01,0.15)};
  if (where.path && where.path.length){
    /* One trail row, not one row per step. The ripple sits on the LAST step,
       which is the thing actually being armed; the steps before it are how you
       got there. It lands before 0.3, where every demo's own gesture begins. */
    const row={options:where.path, on:where.path.length-1, trail:true,
      tapping:arm(0.02,0.18)};
    const own=st.chrome ? (Array.isArray(st.chrome)?st.chrome:[st.chrome]) : [];
    st.chrome=[row].concat(own);
  }
}
/* The same data as a readable trail, for the copy under the title. A reader
   who has the app open in another window wants the words; a reader looking at
   the plate wants the picture. One source. */
function guideWhereTrail(where){
  if (!where) return null;
  const groups=[];
  if (where.rail) groups.push({label:'Tool rail', steps:[where.rail]});
  if (where.top)  groups.push({label:'Top bar', steps:[where.top.label]});
  if (where.path && where.path.length)
    groups.push({label:'Library', steps:where.path.slice()});
  return groups.length ? groups : null;
}

/* The tape measure, drawn by the garden's own dimension line and labelled by
   its own formatter — so the feet in the guidebook are the feet in the app,
   and they follow the units preference like everything else. */
function gsDrawRuler(ctx,st,r){
  if (!r || !r.a || !r.b) return;
  const a=gsProjectAt(st,r.a[0],r.a[1]), b=gsProjectAt(st,r.b[0],r.b[1]);
  const n=Math.hypot(r.b[0]-r.a[0], r.b[1]-r.a[1]);
  drawSelDimLine(ctx,[a[0],a[1]+TILE_H/2],[b[0],b[1]+TILE_H/2],selMetricLabel(n),1);
}
/* The garden menu, which is where every document lives and the hardest thing
   in the app to find. A mocked dropdown rather than the real DOM, for the
   reason the seg rows are mocked: the planner's HUD does not exist on the
   title screen. The ROWS are the real ones. */
function gsDrawMenu(ctx,box,m){
  if (!m || !(m.open>0)) return;
  const rowH=34, pad=10, w=210;
  const h=m.items.length*rowH+pad*2;
  const x=box.x1-w-14, y=box.y0+56;
  ctx.save();
  ctx.globalAlpha=Math.min(1,m.open);
  ctx.translate(0,(1-Math.min(1,m.open))*-10);
  const r=12;
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  ctx.fillStyle='rgba(26,21,17,0.94)'; ctx.fill();
  ctx.strokeStyle='rgba(239,230,211,0.20)'; ctx.lineWidth=1; ctx.stroke();
  ctx.font="600 13px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textBaseline='middle'; ctx.textAlign='left';
  m.items.forEach((t,i)=>{
    const ry=y+pad+i*rowH, on=i===m.on;
    if (on){
      ctx.fillStyle='rgba(201,127,63,0.30)';
      ctx.beginPath(); ctx.moveTo(x+pad-2,ry+2);
      ctx.arcTo(x+w-pad+2,ry+2,x+w-pad+2,ry+rowH-2,7);
      ctx.arcTo(x+w-pad+2,ry+rowH-2,x+pad-2,ry+rowH-2,7);
      ctx.arcTo(x+pad-2,ry+rowH-2,x+pad-2,ry+2,7);
      ctx.arcTo(x+pad-2,ry+2,x+w-pad+2,ry+2,7);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle=on?'#efe6d3':'rgba(239,230,211,0.70)';
    ctx.fillText(t,x+pad+6,ry+rowH/2);
  });
  ctx.restore();
}
/* The north dial. It is a CONTROL in two places — the Site tab's own "North N°"
   button and the Set north dialog's preview — and both draw the same thing: a
   ring with a bronze needle, rotated clockwise from plot-up. Drawn here at the
   ring's own proportions rather than the button's 48x44, because a dial is the
   one piece of chrome whose entire meaning is its angle.
   It drops out on a plate too small to hold it, the way gsRailWindow does. */
const GUIDE_COMPASS_R=30;
function gsDrawCompass(ctx,box,c){
  if (!c) return 0;
  const w=box.x1-box.x0, h=box.y1-box.y0;
  if (w<220 || h<150) return 0;                 // no room: the caption carries it
  const r=GUIDE_COMPASS_R, x=box.x1-r-22, y=box.y1-r-30;
  ctx.save();
  ctx.fillStyle='rgba(26,21,17,0.86)';
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(239,230,211,0.20)'; ctx.lineWidth=1; ctx.stroke();
  ctx.strokeStyle='rgba(239,230,211,0.42)'; ctx.lineWidth=1.3;
  ctx.beginPath(); ctx.arc(x,y,r-6,0,Math.PI*2); ctx.stroke();
  ctx.save(); ctx.translate(x,y); ctx.rotate((c.deg||0)*Math.PI/180);
  ctx.strokeStyle='#c97f3f'; ctx.fillStyle='#c97f3f'; ctx.lineWidth=2.8;
  ctx.beginPath(); ctx.moveTo(0,r-10); ctx.lineTo(0,-(r-12)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-(r-3)); ctx.lineTo(-6,-(r-13)); ctx.lineTo(6,-(r-13));
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle='#efe6d3'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font="600 12px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.fillText('N '+Math.round(c.deg||0)+'°',x,y+r+13);
  ctx.restore();
  return r*2+22;
}

/* A panel down the right edge. The catalog's result list, the Replace dialog's
   result list and the materials estimate are all a titled box of rows, so they
   are ONE painter here for the reason gsDrawChromeRow serves both a segmented
   control and a breadcrumb: they are the same box.
   A row carrying `s` is a plant and is drawn through drawPlant, so a result row
   cannot advertise a species the canvas does not draw. A row carrying `value`
   is a readout line. Returns the width it claimed, so a caption can be kept
   clear of it exactly as the rail's column is. */
/* 252, on a measurement rather than a round number: at 228 the estimate's
   longest row truncated to "Purple Coneflower at sp…" — losing the word
   `spacing`, which is the whole distinction that row exists to draw — and the
   catalog lost a cultivar epithet, the half a nursery order turns on. */
const GUIDE_PANEL_W=252;
/* Below GUIDE_PANEL_GARDEN of stage left over, the panel is SCALED rather
   than clipped — gsDrawChromeRow's rule, and for its reason: a clipped panel
   loses a row with nothing to say it did, and the rows here are the whole
   lesson. Below GUIDE_PANEL_MIN_K it drops out altogether and the caption
   carries the beat, which is what the rail and the compass do at their own
   floors. 0.8 is the floor because the rows are 11.5px and 9px is the size
   this guidebook has already shipped a bug about once. */
const GUIDE_PANEL_GARDEN=96;          // stage left beside it, at minimum
const GUIDE_PANEL_MIN_K=0.8;
const GUIDE_PANEL_CAPTION=160;        // a caption needs about this much room
const GUIDE_PANEL_BAND=38;            // …or a strip under the panel instead
function gsPanelRowH(r){ return r.seg?34:r.s?42:26; }
function gsPanelHeight(p){
  let h=26+(p.title?24:0)+(p.sub?17:0)+(p.find===undefined?0:36);
  (p.rows||[]).forEach(function(r){ h+=gsPanelRowH(r); });
  return h;
}
/* BOTH dimensions bound it, and the CAPTION is one of the things it has to
   leave room for. A tall panel on a short plate would otherwise start at the
   top margin and run off the bottom — losing the estimate's last row, the one
   that answers "how many have I actually planted". And on a phone plate the
   rail and a full-width panel between them leave 6px of caption box, so the
   caption's own clamp pushed it out over the panel it was describing. Where
   there is no room BESIDE, the panel goes to the top and hands the caption a
   strip underneath — which is the reading order anyway. */
function gsPanelSide(box,p,left){
  return (box.x1-box.x0)-(left||0)-GUIDE_PANEL_W-24 >= GUIDE_PANEL_CAPTION;
}
function gsPanelScale(box,p,left){
  if (!p) return 0;
  const room=(box.x1-box.x0)-Math.max(GUIDE_PANEL_GARDEN,left||0)-14;
  const vert=(box.y1-box.y0)-28-(gsPanelSide(box,p,left)?0:GUIDE_PANEL_BAND);
  const k=Math.min(1, room/GUIDE_PANEL_W, vert/gsPanelHeight(p));
  return k<GUIDE_PANEL_MIN_K ? 0 : k;
}
function gsDrawPanel(ctx,box,p,left){
  const k=gsPanelScale(box,p,left); if (!k) return {w:0,bottom:0,side:true};
  const pw=GUIDE_PANEL_W;
  const rows=p.rows||[];
  const rowH=gsPanelRowH;
  const hgt=gsPanelHeight(p);
  /* Laid out from a local origin inside the scale, so nothing below has to
     know it was scaled — the same shape gsDrawChromeRow uses. */
  const x=0, y=0;
  const sh=hgt*k, side=gsPanelSide(box,p,left);
  const top=side ? Math.max(box.y0+14,Math.min(box.y1-14-sh,(box.y0+box.y1-sh)/2))
                 : box.y0+12;
  ctx.save();
  ctx.translate(box.x1-GUIDE_PANEL_W*k-14,top);
  ctx.scale(k,k);
  const rr=12;
  ctx.beginPath(); ctx.moveTo(x+rr,y);
  ctx.arcTo(x+pw,y,x+pw,y+hgt,rr); ctx.arcTo(x+pw,y+hgt,x,y+hgt,rr);
  ctx.arcTo(x,y+hgt,x,y,rr); ctx.arcTo(x,y,x+pw,y,rr); ctx.closePath();
  ctx.fillStyle='rgba(26,21,17,0.94)'; ctx.fill();
  ctx.strokeStyle='rgba(239,230,211,0.20)'; ctx.lineWidth=1; ctx.stroke();
  ctx.save();
  ctx.clip();
  let cy=y+12;
  ctx.textBaseline='middle'; ctx.textAlign='left';
  if (p.title){
    ctx.fillStyle='#efe6d3';
    ctx.font="600 14.5px 'Fraunces', Georgia, serif";
    ctx.fillText(planFitText(ctx,p.title,pw-24),x+12,cy+10); cy+=24;
  }
  if (p.sub){
    ctx.fillStyle='rgba(239,230,211,0.62)';
    ctx.font="500 10.5px 'IBM Plex Sans', system-ui, sans-serif";
    ctx.fillText(planFitText(ctx,p.sub,pw-24),x+12,cy+8); cy+=17;
  }
  if (p.find!==undefined){
    /* The catalog's Find field, which is where every plant search starts and
       the control a reader is most likely to have walked straight past. */
    const fh=26;
    ctx.beginPath(); ctx.moveTo(x+19,cy);
    ctx.arcTo(x+pw-12,cy,x+pw-12,cy+fh,7); ctx.arcTo(x+pw-12,cy+fh,x+12,cy+fh,7);
    ctx.arcTo(x+12,cy+fh,x+12,cy,7); ctx.arcTo(x+12,cy,x+pw-12,cy,7);
    ctx.closePath();
    ctx.fillStyle='rgba(8,5,4,0.42)'; ctx.fill();
    ctx.strokeStyle='rgba(239,230,211,0.24)'; ctx.lineWidth=1; ctx.stroke();
    ctx.strokeStyle='rgba(239,230,211,0.62)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(x+24,cy+fh/2-1,4,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+27,cy+fh/2+2); ctx.lineTo(x+31,cy+fh/2+6); ctx.stroke();
    ctx.font="500 12px 'IBM Plex Sans', system-ui, sans-serif";
    ctx.fillStyle=p.find?'#efe6d3':'rgba(239,230,211,0.45)';
    ctx.fillText(p.find||'Find a plant',x+38,cy+fh/2);
    if (p.caret){
      const tw=ctx.measureText(p.find||'').width;
      ctx.strokeStyle='#c97f3f'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(x+40+tw,cy+6); ctx.lineTo(x+40+tw,cy+fh-6); ctx.stroke();
    }
    cy+=36;
  }
  rows.forEach(function(r){
    const h=rowH(r);
    if (r.seg){
      /* The dialog's own segmented control, drawn through gsDrawChromeRow so
         a seg inside a panel and a seg in the top bar cannot come out as two
         different controls. */
      gsDrawChromeRow(ctx,{x0:x,y0:cy,x1:x+pw-12,y1:cy+h},
        {options:r.seg,on:r.on||0,tapping:r.tapping},x+12,cy+1);
      cy+=h; return;
    }
    if (r.on){
      ctx.fillStyle='rgba(201,127,63,0.30)';
      ctx.beginPath(); ctx.moveTo(x+16,cy);
      ctx.arcTo(x+pw-9,cy,x+pw-9,cy+h-2,7); ctx.arcTo(x+pw-9,cy+h-2,x+9,cy+h-2,7);
      ctx.arcTo(x+9,cy+h-2,x+9,cy,7); ctx.arcTo(x+9,cy,x+pw-9,cy,7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#c97f3f'; ctx.lineWidth=1.4; ctx.stroke();
    }
    if (r.s){
      const D=plantDef(r.s,r.v);
      ctx.save();
      /* The real result card's own preview call, scaled to the row: full
         bloom, the species' representative flowering season, one fixed seed. */
      const sc=Math.min(0.62,32/(plantArtTop(D)||40));
      ctx.translate(x+17,cy+h-6); ctx.scale(sc,sc);
      drawPlant(ctx,0,0,r.s,1,plantIconSeason(D),tileSeed(3,7),0,r.v||undefined,1);
      ctx.restore();
      ctx.fillStyle='#efe6d3';
      ctx.font="600 12px 'IBM Plex Sans', system-ui, sans-serif";
      /* A FAMILY card is one preview standing for several choices, so it
         carries the group's label and its choice count where an exact card
         carries the plant's own name and botanical name. */
      /* Through the plan sheet's own fitter. A name that runs under the
         heart beside it is the schedule's ellipsis bug one surface over —
         and a cultivar epithet is exactly the half that gets eaten. */
      const tw=pw-38-(r.fav===undefined?14:34);
      ctx.fillText(planFitText(ctx,r.name||D.name,tw),x+38,cy+h/2-7);
      ctx.fillStyle='rgba(239,230,211,0.58)';
      ctx.font="400 10px 'IBM Plex Sans', system-ui, sans-serif";
      ctx.fillText(planFitText(ctx,r.sub||PLANTS[r.s].latin,tw),x+38,cy+h/2+8);
      if (r.fav!==undefined) gsDrawHeart(ctx,x+pw-24,cy+h/2,r.fav);
    } else {
      /* The VALUE is measured first and keeps its room: on a readout the
         number is the thing being read, so it is the label that gives way.
         "Purple Coneflower at spacing" ran straight into "26 plants". */
      let vw=0;
      if (r.value!==undefined){
        ctx.font="600 11.5px 'IBM Plex Sans', system-ui, sans-serif";
        vw=ctx.measureText(String(r.value)).width+10;
        ctx.textAlign='right'; ctx.fillStyle='#efe6d3';
        ctx.fillText(String(r.value),x+pw-14,cy+h/2);
        ctx.textAlign='left';
      }
      ctx.fillStyle='rgba(239,230,211,0.70)';
      ctx.font="500 11.5px 'IBM Plex Sans', system-ui, sans-serif";
      ctx.fillText(planFitText(ctx,r.label||'',pw-28-vw),x+14,cy+h/2);
    }
    cy+=h;
  });
  ctx.restore();
  ctx.restore();
  return {w:Math.round(pw*k)+14, bottom:top+sh, side:side};
}
/* The Favorites heart, filled or hollow. Colour alone never signals a state in
   this app, so on and off are the same glyph filled and not filled rather than
   two tints of one. */
function gsDrawHeart(ctx,x,y,on){
  ctx.save();
  ctx.translate(x,y); ctx.scale(0.78,0.78);
  ctx.beginPath();
  ctx.moveTo(0,7);
  ctx.bezierCurveTo(-9,0,-8,-7,-4,-7);
  ctx.bezierCurveTo(-1.5,-7,0,-4.6,0,-4.6);
  ctx.bezierCurveTo(0,-4.6,1.5,-7,4,-7);
  ctx.bezierCurveTo(8,-7,9,0,0,7);
  ctx.closePath();
  if (on){ ctx.fillStyle='#c97f3f'; ctx.fill(); }
  ctx.strokeStyle=on?'#c97f3f':'rgba(239,230,211,0.70)'; ctx.lineWidth=1.6; ctx.stroke();
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
  /* The rail's column comes off the plate before the stage is fitted, so the
     garden is drawn into what is left rather than underneath it. */
  const reserve=gsRailWidth({x0:0,y0:0,x1:w,y1:h},st.rail);
  const fitW=Math.max(40,w-reserve);
  const s=Math.min((fitW-pad*2)/Math.max(1,e.x1-e.x0),(h-pad*2)/Math.max(1,e.y1-e.y0))*st.zoom;
  ctx.translate(reserve+fitW/2,h/2); ctx.scale(s,s);
  ctx.translate(-(e.x0+e.x1)/2,-(e.y0+e.y1)/2);

  gsPaintGround(ctx,st,amb);
  /* The reference photograph sits above the opaque ground and below every
     plant and structure, which is exactly where drawSiteUnderlay puts it —
     traceable without hiding what you have already designed. The shade wash
     goes next, for the same reason the renderer's `shade` phase runs before
     the entity pass: it describes the GROUND, not what is standing on it. */
  gsDrawUnderlay(ctx,st,s);
  gsDrawShade(ctx,st);
  gsPaintEntities(ctx,st,sway);
  (st.marks||[]).forEach(m=>gsTileMark(ctx,st,m.x,m.y,m.fill,m.stroke));
  if (st.ghost) gsBrushGhost(ctx,st,st.ghost.x,st.ghost.y,st.ghost.size,st.ghost.tone);
  gsDrawRuler(ctx,st,st.ruler);
  gsDrawCursor(ctx,st,st.cursor);
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
  const box={x0:0,y0:0,x1:w,y1:h};
  const railW=gsDrawRail(ctx,box,st.rail);
  /* The panel's placement is decided BEFORE the chrome is drawn, because a
     panel with no room beside it sits at the top of the plate and the top is
     where the breadcrumb and the chip go. They are given the box that is left,
     and drop out rather than shrink into it — the written trail under the
     plate says the same thing at full size. */
  const pk=gsPanelScale(box,st.panel,railW), pSide=gsPanelSide(box,st.panel,railW);
  const pTop=pk&&!pSide;
  const chromeBox=pTop ? {x0:box.x0,y0:box.y0,x1:box.x1-Math.round(GUIDE_PANEL_W*pk)-14,y1:box.y1}
                       : box;
  const boxH=gsDrawSeasonBox(ctx,chromeBox,st.seasonBox,railW);
  const chromeH=gsDrawChrome(ctx,st,chromeBox,st.chrome,railW,boxH);
  if (!pTop) gsDrawTopChip(ctx,box,st.top);
  gsDrawMenu(ctx,box,st.menu);
  const panel=gsDrawPanel(ctx,box,st.panel,railW);
  const dialW=gsDrawCompass(ctx,box,st.compass);

  /* Captions LAST, in screen space, and clear of everything already drawn.
     They were inside the stage transform and drawn before the chrome, which
     cost them twice: the type was scaled down with the garden, and the row of
     option chips was then painted over the top of them. */
  const mx=(e.x0+e.x1)/2, my=(e.y0+e.y1)/2;
  const toScreen=(px,py)=>[reserve+fitW/2+(px-mx)*s, h/2+(py-my)*s];
  const band=Math.max(boxH||0, chromeH||0);
  const nb={
    x0:reserve+6,
    /* the menu is a 210px panel down the right edge; nothing else on that side
       is tall enough to reach a caption */
    x1:w-6-Math.max(st.menu&&st.menu.open>0 ? 224 : 0, panel.side?panel.w:0, dialW),
    /* Under the chrome, and under a panel that took the whole width. */
    y0:Math.max(6+(band?band+18:0), panel.side?0:panel.bottom+6),
    y1:h-6
  };
  st.notes.forEach(n=>gsDrawNote(ctx,st,n,nb,toScreen));
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
/* selectionEstimate names the ARMED species on its last row — "Purple
   Coneflower at spacing" — and finds it through game.lastBrushTool, so a demo
   calling it would otherwise print whatever the reader last painted with in
   some other garden, or nothing at all. Borrowed and put back, exactly as the
   camera and the site are, which is what lets the estimate demo show the
   dialog's OWN rows rather than a hand-typed copy of them. */
function gsBorrowArmed(key,fn){
  const prior={t:game.lastBrushTool, v:game.lastBrushVar};
  try { game.lastBrushTool=key; game.lastBrushVar=null; return fn(); }
  finally { game.lastBrushTool=prior.t; game.lastBrushVar=prior.v; }
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
  where:{rail:'Hand'},
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
  where:{top:{label:'Rotate',kind:'rotate'}},
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
  where:{rail:'Hand'},
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

season:{ loop:14000, rest:0.62,
  where:{top:{label:'Season box', drawn:true}},
  build(){ const st=guideStage({cols:7,rows:7});
    gsFill(st,'bed','soil',0,0,6,6);
    gsScatter(st,['bluestem','echinacea','dropseed','monarda','sedge','pallida','switchgrass'],
      [[1,1],[3,1],[5,1],[2,2],[4,2],[1,3],[3,3],[5,3],[2,4],[4,4],[1,5],[3,5],[5,5]]);
    gsPlant(st,6,0,'serviceberry',1);
    return st; },
  run(st,u){
    /* The pitch, and the one thing this app does that nothing else does: the
       same planting blooms, seeds and stands through winter without a plant
       being moved. Every colour is the species' own authored season.

       The GESTURE is the other half, and the first cut got it wrong: it drew
       four season tabs, which is a control the app does not have. There is one
       season box, and you press and HOLD it — so the demo now reaches for that
       box, arms the 360ms hold, and then runs the year while it is held down.

       Three beats: reach (to 0.10), arm (to 0.22), run (the rest). */
    const reach=gAt(u,0.02,0.10), arm=gAt(u,0.10,0.22), run=gAt(u,0.22,1);
    // the year runs across the whole of the third beat: four seasons, in order
    const year=run*4, i=Math.min(3,Math.floor(year));
    st.season=SEASONS[i];
    st.seasonBox={
      season:st.season,
      phase:['early season','mid season','late season'][Math.min(2,Math.floor((year%1)*3))],
      fill:run>0 ? year%1 : 0,
      hold:arm,
      press:reach>=1,
      ff:arm>=1,
      pulse:(u*3)%1
    };
    st.notes=[{text:arm<1 ? 'Press and HOLD it' : 'the same planting, all four seasons',
      at:[3,6.4],dy:30}];
  }},

/* ----- planting ----- */

plantone:{ loop:6500, rest:0.72,
  where:{rail:'Plant', path:['Plants','Sun Perennials']},
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
  where:{rail:'Plant', path:['Plants','Sun Perennials']},
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
  where:{rail:'Plant', path:['Plants','Grasses']},
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
  where:{rail:'Plant', path:['Plants','Grasses']},
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
  where:{rail:'Plant', path:['Plants','Trees']},
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
  where:{rail:'Plant', path:['Plants','Shrubs']},
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
  where:{path:['Landscape','Ground','Path']},
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
  where:{path:['Landscape','Ground','Lawn']},
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
  where:{path:['Landscape','Ground','Water']},
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
  where:{path:['Landscape','Ground','Edging']},
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
  where:{path:['Landscape','Grade']},
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
  where:{path:['Landscape','Hardscape','Fence']},
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
  where:{path:['Landscape','Decor','Pot']},
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
  where:{path:['Landscape','Hardscape','Seating']},
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
  where:{path:['Landscape','Hardscape','Fire pit']},
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
    if (u>0.42) st.props.push({kind:'firepit',x:3,y:5,style:'brick',finish:'tumbled',
      shape:'round',size:'round36'});
    if (u>0.66) st.props.push({kind:'boulder',x:7,y:4,type:'medium2'});
    const tap=gTap(u,u<0.36?0.12:u<0.6?0.38:0.62);
    const c=gPath(gAt(u,0,0.72),[[7,7],[4,1],[3,5],[7,4]]);
    st.cursor=u<0.76?{x:c[0],y:c[1],down:tap.down,press:tap.press}:null;
    st.notes=[{text:'Fire pits, water features, boulders',at:[4,7.4],dy:28}];
  }},

climbers:{ loop:10500, rest:0.94,
  where:{path:['Landscape','Hardscape','Support']},
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
  where:{path:['Landscape','Decor','Pet']},
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
  where:{rail:'Select'},
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
    /* Move | Copy | Fill | More, which is the pill the app really draws —
       renderSelectionActions' second button is Copy. Everything else lives
       under More, and saying otherwise sends a reader looking along a row
       that has four buttons on it for a fifth that is not there. */
    st.chrome={options:['Move','Copy','Fill','More'],on:1,tapping:gAt(u,0.32,0.44)};
    if (u<0.48){ st.cursor=null;
      st.notes=[{text:'Move or Copy it; the rest is under More',at:[4,6.4],dy:28}]; return; }
    // duplicate: the same six plants, offset, as a live ghost then committed
    const f2=gEase(gAt(u,0.5,0.86));
    const dx=Math.round(4*f2), dy=Math.round(2*f2);
    [[1,1],[2,1],[1,2],[2,2],[3,2],[2,3]].forEach(function(p){
      gsSet(st.plants,p[0]+dx,p[1]+dy,{s:'echinacea',g:1,alpha:u<0.88?0.55:1});
    });
    for (let y=1;y<=3;y++) for (let x=1;x<=3;x++)
      st.marks.push({x:x+dx,y:y+dy,stroke:'rgba(122,176,122,0.8)'});
    st.cursor={x:2+dx,y:2+dy,down:u<0.88,press:0};
    st.notes=[{text:'Copy carries the planting with it',at:[4,6.4],dy:28}];
  }},

pick:{ loop:9000, rest:0.92,
  where:{rail:'Pick'},
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
  where:{rail:'Erase'},
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
  where:{top:{label:'Layers',kind:'layers'}},
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

/* ----- the tools the first cut left out ----- */

/* The preview lens, and the pair to `season`: that demo teaches the HOLD, this
   one the short TAP that opens the time menu the lens lives in. Worth its own
   entry because gardens OPEN in Established, so what a new gardener sees first
   is the design ten years on — and nothing on screen says so until they find
   this. */
preview:{ loop:11000, rest:0.7,
  where:{top:{label:'Season box', drawn:true}},
  build(){ const st=guideStage({cols:7,rows:6});
    gsFill(st,'bed','mulch',0,0,6,5);
    return st; },
  run(st,u){
    const tap=gTap(u,0.06,0.12);
    const est=u>=0.28 ? Math.floor(u*2.4)%2===1 : false;
    st.seasonBox={season:st.season, phase:'mid season', fill:0.5,
      hold:0, press:u>0.04&&u<0.16, ff:false};
    if (u>0.2) st.chrome={options:['Today','Established'],on:est?1:0,
      tapping:gAt((u*2.4)%1,0,0.22)};
    /* The SAME planting at two ages. Established is not a bigger garden, it is
       this garden grown up — which is why the demo plants one and changes only
       the growth. */
    const g=est?1:0.22;
    [[1,1],[3,1],[5,2],[2,3],[4,4],[1,4]].forEach(p=>gsPlant(st,p[0],p[1],'echinacea',g));
    [[2,2],[4,2],[3,4],[5,4]].forEach(p=>gsPlant(st,p[0],p[1],'dropseed',g));
    gsPlant(st,6,0,'serviceberry',est?1:0.12);
    st.notes=[{text:u<0.24 ? 'A short TAP opens the time menu'
      : est ? 'Established — the design grown up' : 'Today — what is actually in the ground',
      at:[3,5.4],dy:28}];
  }},

/* Bulbs share a tile with the perennials above them, which is the whole reason
   they are a separate layer and not just more plants. Spring, because a bulb
   in summer is underground and draws nothing. */
bulbs:{ loop:9500, rest:0.9,
  where:{rail:'Plant', path:['Plants','Bulbs']},
  build(){ const st=guideStage({cols:7,rows:6,season:'Spring'});
    gsFill(st,'bed','soil',0,0,6,5);
    [[1,1],[3,2],[5,1],[2,4],[4,3],[6,4]].forEach(p=>gsPlant(st,p[0],p[1],'dropseed',1));
    return st; },
  run(st,u){
    const lane=[[0.6,3],[2,2],[4,2],[6,3]];
    const f=gAt(u,0.14,0.86);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:u>0.12&&u<0.88,press:0};
    const steps=Math.round(f*12);
    for (let i=0;i<=steps;i++){
      const p=gPath(i/12,lane), px=Math.round(p[0]), py=Math.round(p[1]);
      /* Deliberately laid straight over the grasses: a bulb tucks UNDER a
         perennial rather than displacing it. It is refused under a tree or a
         shrub, which is the one place the layer does not overlap. */
      if (!gsGet(st.plants,px,py)) gsPlant(st,px,py,'crocus',1);
      else gsSet(st.bulbs,px,py,{s:'crocus',g:1});
    }
    st.notes=[{text:'Bulbs tuck under what is already planted',at:[3,5.4],dy:28}];
  }},

freeplant:{ loop:10000, rest:0.75,
  where:{rail:'Plant', path:['Plants','Grasses']},
  build(){ const st=guideStage({cols:7,rows:6});
    gsFill(st,'bed','soil',0,0,6,5);
    return st; },
  run(st,u){
    const free=Math.floor(u*2)%2===1;
    st.chrome={options:['Grid','Free'],on:free?1:0,tapping:gAt((u*2)%1,0,0.22)};
    /* The same tiles either way — only the sub-tile offset changes, which is
       exactly what the real toggle does. Seeded off the tile so the scatter is
       the same every time the demo comes round. */
    for (let y=1;y<=4;y++) for (let x=1;x<=5;x++){
      const r=mulberry(tileSeed(x,y));
      const o=free ? {ox:(r()-0.5)*0.66, oy:(r()-0.5)*0.66} : {ox:0,oy:0};
      gsSet(st.plants,x,y,{s:'sesleria',g:1,ox:o.ox,oy:o.oy});
    }
    st.notes=[{text:free ? 'Free — nudged off the lattice, so a drift stops reading as a grid'
      : 'Grid — every plant on its tile centre', at:[3,5.4],dy:28}];
  }},

fill:{ loop:9000, rest:0.85,
  where:{path:['Landscape','Ground','Bed']},
  build(){ const st=guideStage({cols:8,rows:7});
    gsFill(st,'lawn','fescue',0,0,7,6);
    gsFill(st,'path','slate',0,3,7,3);      // the fill stops at the path
    gsScatter(st,['dropseed','echinacea'],[[1,1],[6,1],[2,5],[6,5]]);
    return st; },
  run(st,u){
    st.chrome={options:['Draw','Fill'],on:u<0.2?0:1,tapping:gAt(u,0.06,0.22)};
    if (u<0.3){
      st.notes=[{text:'Turn Fill on',at:[3.5,6.4],dy:28}];
      return;
    }
    const tap=gTap(u,0.42);
    const c=gPath(gAt(u,0.3,0.4),[[5,5],[3,1]]);
    st.cursor=u<0.6?{x:c[0],y:c[1],down:tap.down,press:tap.press}:null;
    if (u>0.46){
      /* It floods the CONNECTED region sharing the tapped tile's material and
         stops where that changes — so the path across the middle is a wall and
         the lawn below it is untouched. That is the whole behaviour. */
      const f=gEase(gAt(u,0.46,0.84));
      for (let y=0;y<=2;y++) for (let x=0;x<8;x++)
        if ((Math.abs(x-3)+Math.abs(y-1))/9 <= f) gsSet(st.terrain,x,y,{k:'bed',c:'mulch'});
    }
    st.notes=[{text:'One tap fills the whole connected area',at:[3.5,6.4],dy:28,
      alpha:gAt(u,0.5,0.6)}];
  }},

ruler:{ loop:9500, rest:0.85,
  where:{rail:'Ruler'},
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'lawn','fescue',0,0,8,6);
    gsFill(st,'bed','mulch',1,1,6,2);
    gsScatter(st,['echinacea','dropseed','monarda'],[[2,1],[4,2],[6,1],[3,2],[5,1]]);
    return st; },
  run(st,u){
    const a=[1,4], b=[7,4];
    const f=gEase(gAt(u,0.14,0.7));
    const to=[a[0]+(b[0]-a[0])*f, a[1]];
    st.cursor={x:to[0],y:to[1],down:u>0.12&&u<0.76,press:0};
    st.ruler=f>0.02 ? {a,b:to} : null;
    st.notes=[{text:'Drag, or tap two points',at:[4,6.4],dy:28}];
  }},

undo:{ loop:9500, rest:0.9,
  where:{rail:'Undo'},
  build(){ const st=guideStage({cols:7,rows:6});
    gsFill(st,'bed','soil',0,0,6,5);
    gsScatter(st,['dropseed'],[[0,4],[6,1]]);
    return st; },
  run(st,u){
    const put=[[2,1],[3,2],[4,1],[2,3],[4,3]];
    // plant five, then take them all back one press at a time
    const n = u<0.46 ? Math.round(gEase(gAt(u,0.06,0.44))*put.length)
                     : put.length-Math.round(gEase(gAt(u,0.52,0.92))*put.length);
    put.slice(0,n).forEach(p=>gsPlant(st,p[0],p[1],'monarda',1));
    st.rail={on:u<0.5?'Plant':'Undo', tapping:u<0.5?gAt(u,0.01,0.15):gAt((u*6)%1,0,0.4)};
    st.notes=[{text:u<0.5 ? 'Plant a few…' : 'Undo takes back anything — Ctrl/Cmd-Z',
      at:[3,5.4],dy:28}];
  }},

lighting:{ loop:10000, rest:0.9,
  where:{path:['Landscape','Lighting','Path light']},
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'lawn','fescue',0,0,8,6);
    gsFill(st,'path','warm',0,3,8,3);
    gsScatter(st,['dropseed','bluestem','echinacea'],
      [[1,1],[4,1],[7,1],[2,5],[5,5],[7,5]]);
    return st; },
  run(st,u){
    const at=[[1,2],[4,2],[7,2]];
    const n=Math.round(gEase(gAt(u,0.12,0.7))*at.length);
    at.slice(0,n).forEach(p=>st.props.push({kind:'light',x:p[0],y:p[1],
      type:'path',tone:'warm',lit:u>0.74}));
    const tap=gTap(u,0.1+Math.min(2,n)*0.2);
    const c=gPath(gAt(u,0.04,0.68),[[6,5.6],[1,2],[4,2],[7,2]]);
    st.cursor=u<0.74?{x:c[0],y:c[1],down:tap.down,press:tap.press}:null;
    /* The sun/moon button in the TOP BAR, not Layers. Night was promoted out
       of the Layers overlay menu into its own top-bar toggle, and the written
       instruction under this demo already said so — the caption on the canvas
       was the copy nobody updated, which is the worse of the two to get wrong
       because it is the one being read while looking at the picture. */
    st.notes=[{text:u<0.74 ? 'Set them out along the path'
      : 'The sun/moon button in the top bar lights them', at:[4,6.4],dy:28}];
  }},

site:{ loop:11000, rest:0.92,
  where:{path:['Landscape','Site','Draw footprint']},
  build(){ const st=guideStage({cols:9,rows:8});
    gsFill(st,'lawn','fescue',0,0,8,7);
    gsScatter(st,['dropseed','bluestem'],[[0,6],[8,6],[1,7],[7,7]]);
    return st; },
  run(st,u){
    /* Corner by corner, orthogonally, closing on the first corner — which is
       the real gesture. The vertices are on the tile-CORNER lattice, a
       different space from the tiles (see the note in world.js), so they are
       given as corners and the app's own painters project them. */
    const corners=[[2,1],[7,1],[7,4],[2,4]];
    const laid=Math.min(corners.length,Math.floor(gAt(u,0.08,0.62)*(corners.length+1)));
    if (u<0.66){
      st.marks=corners.slice(0,laid).map(c=>({x:Math.min(8,c[0]),y:Math.min(7,c[1]),
        stroke:'rgba(246,190,103,0.95)'}));
      const c=gPath(gAt(u,0.08,0.62),corners.map(p=>[p[0],p[1]]));
      st.cursor={x:c[0],y:c[1],down:true,press:gTap(u,0.08+laid*0.12).press};
      st.notes=[{text:'Tap each corner; close on the first',at:[4,7.4],dy:28}];
      return;
    }
    st.props.push({kind:'building',vertices:corners,
      status:u<0.82?'proposed':'existing',label:'Garage'});
    st.notes=[{text:u<0.82 ? 'Proposed — dashed until you commit it'
      : 'Existing — beds butt up against it', at:[4,7.4],dy:28}];
  }},

schemes:{ loop:11000, rest:0.6,
  where:{top:{label:'Scheme chip'}},
  build(){ const st=guideStage({cols:8,rows:7});
    /* ONE site plan. The terrain, the path and the bench are shared and stored
       once; only the planting belongs to the scheme. */
    gsFill(st,'lawn','fescue',0,0,7,6);
    gsFill(st,'bed','mulch',1,1,6,4);
    gsFill(st,'path','warm',0,6,7,6);
    st.props.push({kind:'seat',x:5,y:6,type:'bench4',finish:'teak',face:0});
    return st; },
  run(st,u){
    const b=Math.floor(u*2)%2===1;
    st.chrome={options:['Prairie','Woodland'],on:b?1:0,tapping:gAt((u*2)%1,0,0.22)};
    const keys=b ? ['sedge','snowywoodrush','palmsedge'] : ['bluestem','echinacea','dropseed'];
    let i=0;
    for (let y=1;y<=4;y++) for (let x=1;x<=6;x++)
      if ((x+y)%2===0) gsPlant(st,x,y,keys[(i++)%keys.length],1);
    st.notes=[{text:'Two plantings, one site plan',at:[3.5,6.4],dy:28}];
  }},

outputs:{ loop:10000, rest:0.8,
  where:{top:{label:'Menu'}},
  build(){ const st=guideStage({cols:8,rows:7});
    gsFill(st,'bed','soil',0,0,7,6);
    gsScatter(st,['echinacea','bluestem','dropseed','monarda','sedge','pallida'],
      [[1,1],[3,1],[5,1],[2,2],[4,2],[6,2],[1,3],[3,3],[5,3],[2,4],[4,4],[6,4],[3,5],[5,5]]);
    gsPlant(st,7,0,'serviceberry',1);
    return st; },
  run(st,u){
    /* The payoff, and the hardest thing in the app to find: three documents,
       all of them behind one Menu button. The rows are the real ones. */
    st.menu={items:['Planting list','Design plan','Bloom calendar','Share this garden'],
      on:Math.min(3,Math.floor(gAt(u,0.24,0.96)*4)), open:gAt(u,0.12,0.24)};
    st.notes=[{text:'Menu — every document the design turns into',at:[3.5,6.4],dy:28}];
  }},
/* ----- the site you are actually designing ----- */

/* The one demo that does not start from an empty plot, because a real design
   does not. Four beats, in the order the tool asks for them: get the picture
   in, put it where the plot is, tell it how big one thing on it really is, and
   turn it down far enough to draw over. */
underlay:{ loop:17000, rest:0.88,
  where:{path:['Landscape','Site','Add site photo']},
  build(){ return guideStage({cols:9,rows:8}); },
  run(st,u){
    const from=[5.6,2.3], home=[4,3.5];
    const drag=gEase(gAt(u,0.14,0.34));
    /* Calibrating does not move the photo, it RESIZES it: you name the real
       distance between two points on it and the whole reference is scaled so
       they are that far apart. The two points therefore stay put and the
       picture grows around them. */
    const scaled=gEase(gAt(u,0.52,0.62));
    const w=6.3+1.9*scaled;
    st.underlay={
      x:from[0]+(home[0]-from[0])*drag,
      y:from[1]+(home[1]-from[1])*drag,
      w:w, h:w*0.62,
      opacity:(0.64-0.34*gEase(gAt(u,0.64,0.74)))*gAt(u,0.01,0.09),
      /* The frame and the calibration marks are BOTH photoEditing chrome and
         both go the moment you press Done — leaving the gold line lying over
         the finished trace would show a state the app never holds. */
      frame:u<0.80,
      calib:(u<0.36||u>=0.80)?null:[[2.5,4.6],[5.6,4.6]].slice(0,u<0.44?1:2)
    };
    if (u<0.12){
      st.cursor=null;
      st.notes=[{text:'Landscape → Site → Add site photo',at:[4,7.2],dy:26}];
      return;
    }
    if (u<0.36){
      const c=gPath(gAt(u,0.14,0.34),[[from[0],from[1]],[home[0],home[1]]]);
      st.cursor={x:c[0],y:c[1],down:true,press:0};
      st.notes=[{text:'Drag it over the plot; pinch to scale and rotate',at:[4,7.2],dy:26}];
      return;
    }
    if (u<0.64){
      const tap=gTap(u,u<0.44?0.38:0.46);
      st.cursor={x:u<0.44?2.5:5.6,y:4.6,down:tap.down,press:tap.press};
      st.notes=[{text:u<0.52 ? 'Tap two points a known distance apart'
        : 'Now the photo is to scale — 24 ft between those two',at:[4,7.2],dy:26}];
      return;
    }
    if (u<0.80){
      st.cursor=null;
      st.notes=[{text:'Turn the opacity down until you can draw over it',at:[4,7.2],dy:26}];
      return;
    }
    /* And then it is just an ordinary brush over an ordinary plot: the photo
       is a reference, never geometry. Nothing here is snapped to it. */
    const f=gEase(gAt(u,0.80,0.98));
    const lane=[[1,1],[2,3],[2,6]];
    const steps=Math.round(f*10);
    for (let i=0;i<=steps;i++){
      const p=gPath(i/10,lane);
      brushOffsets(3).forEach(function(o){
        gsFill(st,'path','slate',Math.round(p[0])+o[0],Math.round(p[1])+o[1],
          Math.round(p[0])+o[0],Math.round(p[1])+o[1]);
      });
    }
    if (f>0.3) gsFill(st,'bed','mulch',4,3,7,6);
    const c=gPath(f,lane);
    st.cursor={x:c[0],y:c[1],down:u<0.98,press:0};
    st.notes=[{text:'Trace the drive and the beds straight off it',at:[4,7.2],dy:26}];
  }},

/* North is a property of the SITE. The camera turns; the sun does not follow
   it. That distinction is the whole demo, and it is the one people get wrong
   because both controls look like rotation. */
north:{ loop:16000, rest:0.6,
  where:{path:['Landscape','Site','North'], top:{label:'Layers',kind:'layers'}},
  build(){ const st=guideStage({cols:9,rows:9});
    gsFill(st,'lawn','fescue',0,0,8,8);
    gsFill(st,'path','slate',0,8,8,8);
    /* One mature tree, because a tree is the ONLY thing in this app that casts
       shade — ensureShadeMap walks the tree index and nothing else. The house
       is what you design around, not a second caster, and the caption says so
       rather than implying a feature that is not there. */
    gsPlant(st,6,3,'serviceberry',1);
    gsScatter(st,['dropseed','sedge'],[[1,7],[4,7],[7,7]]);
    st.props.push({kind:'building',vertices:[[0,0],[4,0],[4,3],[0,3]],
      status:'existing',label:'House'});
    return st; },
  run(st,u){
    const deg=Math.round(40*gEase(gAt(u,0.06,0.30))+110*gEase(gAt(u,0.48,0.72)));
    st.compass={deg:deg};
    if (u>=0.34) st.shade={north:deg};
    // the last beat turns the CAMERA while north holds still
    st.rot = u<0.80 ? 0 : Math.min(3,1+Math.floor((u-0.80)/0.07));
    st.notes=[{text:
        u<0.32 ? 'Set north once, for the site'
      : u<0.46 ? 'Layers → Shade overlay: amber sun, teal part, blue shade'
      : u<0.78 ? 'Move north and the shade swings with the sun'
      : 'Turning the VIEW moves you, not the shade',
      at:[4,8.4],dy:28}];
  }},

/* ----- finding a plant, and keeping it ----- */

/* The catalog is most of the app and had no demo at all. Four things happen
   here that are each a separate control: narrowing by search, opening a family
   to reach an exact cultivar, hearting one, and collecting a few into a named
   palette that every garden can then browse. */
findplants:{ loop:17000, rest:0.72,
  where:{path:['Plants','Sun Perennials']},
  build(){ const st=guideStage({cols:6,rows:5});
    gsFill(st,'bed','soil',0,0,5,4);
    gsScatter(st,['dropseed','bluestem'],[[0,3],[5,1],[1,4]]);
    return st; },
  run(st,u){
    const typed='coneflower'.slice(0,Math.round(gAt(u,0.04,0.22)*10));
    /* The family and its size are read off PLANTS rather than typed in. The
       coneflowers are FIVE species and four cultivars under one `group`, so a
       hand-written "4 varieties" would have been wrong about the one thing
       this beat exists to explain — that a family card is not a species. */
    const fam=Object.keys(PLANTS).filter(function(k){ return PLANTS[k].group==='coneflower'; });
    const choices=fam.reduce(function(n,k){ return n+1+Object.keys(PLANTS[k].cv||{}).length; },0);
    const tag=choices+' choices';
    if (u<0.26){
      st.panel={title:'Plant library', sub:'Search every category at once',
        find:typed, caret:u<0.24,
        rows:typed.length<4
          ? [{s:'monarda'},{s:'dropseed'},{s:'echinacea',name:'Coneflower',sub:tag}]
          : [{s:'echinacea',name:'Coneflower',sub:tag}]};
      st.notes=[{text:'Find searches common name, botanical name and cultivar',
        at:[2.5,4.4],dy:26}];
      return;
    }
    if (u<0.44){
      st.panel={title:'Plant library', sub:'1 family matches', find:'coneflower',
        rows:[{s:'echinacea',name:'Coneflower',sub:tag,on:u>0.32}]};
      st.notes=[{text:'One card, every coneflower — open it to choose',
        at:[2.5,4.4],dy:26}];
      return;
    }
    if (u<0.72){
      /* Inside the family: the exact choices, sibling SPECIES and cultivars
         alike, each of which stays an exact reference everywhere afterwards —
         on the card, in a palette, on the tile, in the planting list. */
      const fav=u>0.60;
      st.panel={title:'Coneflower', sub:tag, find:undefined,
        rows:[{s:'echinacea',v:'magnus',on:u>0.52,fav:fav},
              {s:'echinacea',v:'whiteswan',fav:false},
              {s:'pallida',fav:false}]};
      st.notes=[{text:fav ? 'The heart saves it to Favorites'
        : 'Sibling species and cultivars, in one place', at:[2.5,4.4],dy:26}];
      return;
    }
    st.panel={title:'Add to a palette', sub:'Device-local, and usable in every garden',
      rows:[{seg:['Recommended','Favorites'],on:1,tapping:gAt(u,0.72,0.84)},
            {label:'Front border',on:u>0.84},{label:'Dry bank'},{label:'New palette…'}]};
    st.notes=[{text:'A named palette follows you from garden to garden',
      at:[2.5,4.4],dy:26}];
  }},

/* ----- changing a planting that is already in ----- */

/* Swapping a species everywhere it appears, which is the edit a design goes
   through most and the one that is hardest by hand: the positions are the
   work, and retyping them is how a planting loses its rhythm. */
replace:{ loop:15000, rest:0.9,
  where:{rail:'Select'},
  build(){ const st=guideStage({cols:9,rows:7});
    gsFill(st,'bed','mulch',0,0,8,6);
    for (let y=1;y<=5;y++) for (let x=1;x<=7;x++)
      if ((x+y)%2===0) gsPlant(st,x,y,'echinacea',1);
    gsScatter(st,['dropseed'],[[2,3],[6,3],[4,1],[4,5]]);
    return st; },
  run(st,u){
    const rect=[1,1,5,5];
    st.marks=[];
    for (let y=rect[1];y<=rect[3];y++) for (let x=rect[0];x<=rect[2];x++)
      st.marks.push({x:x,y:y,fill:'rgba(124,168,196,0.22)',stroke:'rgba(124,168,196,0.70)'});
    if (u<0.2){
      st.menu={items:['Estimate materials…','Replace plants…','Rotate 90 degrees',
        'Save area','Paste saved area','Erase selection'],on:1,open:gAt(u,0.04,0.14)};
      st.notes=[{text:'Selection pill → More → Replace plants…',at:[4,6.4],dy:28}];
      return;
    }
    /* The three scopes, with their real labels, INSIDE the dialog — which is
       where they really are. Drawn as top chrome they sat behind the mocked
       panel on a phone, and told the reader to look in the top bar for a
       control that lives in the modal in front of them. */
    const scope={seg:['This plant','Selection','Garden'],on:1,
      tapping:gAt(u,0.20,0.32)};
    if (u<0.46){
      st.panel={title:'Replace Purple Coneflower',
        sub:'Positions and planted age stay the same',
        rows:[scope,{s:'monarda',on:u>0.36},{s:'pallida'},{s:'bluestem'}]};
      st.notes=[{text:'Only compatible plants are offered',at:[4,6.4],dy:28}];
      return;
    }
    /* The swap itself: the same tiles, a different species. One inside the
       marquee is left alone, because a replacement that cannot fit its new
       ground is refused per PLANT rather than refusing the whole edit — which
       is why the dialog's summary counts them separately. Both numbers are
       taken off the same list the swap walks, so the sentence and the picture
       cannot disagree about how many there were. */
    const targets=[];
    for (let y=rect[1];y<=rect[3];y++) for (let x=rect[0];x<=rect[2];x++){
      const p=gsGet(st.plants,x,y);
      if (p && p.s==='echinacea') targets.push([x,y]);
    }
    const blocked=function(t){ return t[0]===5 && t[1]===5; };
    const fit=targets.filter(function(t){ return !blocked(t); });
    st.panel={title:'Replace Purple Coneflower',
      sub:fit.length+' of '+targets.length+' can change to '+plantDef('monarda').name,
      rows:[scope,{s:'monarda',on:true}]};
    const f=gEase(gAt(u,0.48,0.86));
    const done=Math.round(f*fit.length);
    fit.slice(0,done).forEach(function(t){ gsPlant(st,t[0],t[1],'monarda',1); });
    targets.filter(blocked).forEach(function(t){
      st.marks.push({x:t[0],y:t[1],stroke:'rgba(217,100,90,0.85)'}); });
    st.notes=[{text:u<0.88 ? 'Every match inside the selection, in place'
      : 'Any that cannot fit are left alone', at:[4,6.4],dy:28,
      tone:u<0.88?undefined:'warn'}];
  }},

/* A grouping that works is worth keeping. Save puts the whole marquee — plants,
   bulbs, terrain, fences and all — on a clipboard that survives until you
   paste it, and Rotate turns it about its own centre so a corner planting can
   serve the opposite corner. */
savearea:{ loop:16000, rest:0.9,
  where:{rail:'Select'},
  build(){ const st=guideStage({cols:10,rows:8});
    gsFill(st,'lawn','fescue',0,0,9,7);
    gsFill(st,'bed','mulch',1,1,3,3);
    [[1,1],[2,1],[3,2],[2,2],[1,3],[3,3],[2,3]].forEach(function(p){
      gsPlant(st,p[0],p[1],'echinacea',1); });
    gsPlant(st,3,1,'dropseed',1); gsPlant(st,1,2,'dropseed',1);
    return st; },
  run(st,u){
    const r={x0:1,y0:1,x1:3,y1:3};
    const group=[[1,1,'echinacea'],[2,1,'echinacea'],[3,1,'dropseed'],
                 [1,2,'dropseed'],[2,2,'echinacea'],[3,2,'echinacea'],
                 [1,3,'echinacea'],[2,3,'echinacea'],[3,3,'echinacea']];
    st.marks=[];
    for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++)
      st.marks.push({x:x,y:y,fill:'rgba(124,168,196,0.16)',stroke:'rgba(124,168,196,0.45)'});
    if (u<0.22){
      st.menu={items:['Estimate materials…','Replace plants…','Rotate 90 degrees',
        'Save area','Paste saved area','Erase selection'],on:3,open:gAt(u,0.04,0.14)};
      st.notes=[{text:'More → Save area keeps the whole grouping',at:[4.5,7.4],dy:28}];
      return;
    }
    if (u<0.40){
      st.menu={items:['Estimate materials…','Replace plants…','Rotate 90 degrees',
        'Save area','Paste saved area','Erase selection'],on:4,open:1};
      st.notes=[{text:'…and Paste saved area drops it wherever you are',
        at:[4.5,7.4],dy:28}];
      return;
    }
    /* Pasted at the cursor. The bed comes with it: a saved area is every layer
       inside the marquee, not just the planting. */
    const dx=5, dy=3;
    const f=gEase(gAt(u,0.42,0.62));
    if (f>0.02){
      gsFill(st,'bed','mulch',r.x0+dx,r.y0+dy,r.x1+dx,r.y1+dy);
      const spun=u>0.72;
      const h=r.y1-r.y0+1;
      group.forEach(function(g){
        const lx=g[0]-r.x0, ly=g[1]-r.y0;
        /* The app's own rotation, value for value: (x,y) -> (h-1-y, x) about
           the rectangle's top-left, which is what rotateSelection does. */
        const rx=spun ? (h-1-ly) : lx, ry=spun ? lx : ly;
        gsSet(st.plants,r.x0+dx+rx,r.y0+dy+ry,
          {s:g[2],g:1,alpha:f<1?0.55+0.45*f:1});
      });
      for (let y=0;y<3;y++) for (let x=0;x<3;x++)
        st.marks.push({x:r.x0+dx+x,y:r.y0+dy+y,stroke:'rgba(122,176,122,0.7)'});
    }
    st.cursor=u<0.66?{x:r.x0+dx+1,y:r.y0+dy+1,down:u<0.6,press:0}:null;
    st.notes=[{text:u<0.72 ? 'The bed comes with the planting'
      : 'Rotate 90 degrees turns it about its own centre', at:[4.5,7.4],dy:28}];
  }},

/* ----- what it will take to build ----- */

/* The materials estimate, which is the one document that answers "what do I
   buy" for the ground rather than for the planting — and the one place the
   difference between a plant PLACED and a plant the spacing would need is put
   side by side, because they are different numbers and both are true. */
estimate:{ loop:14000, rest:0.78,
  where:{rail:'Select'},
  build(){ const st=guideStage({cols:10,rows:8});
    gsFill(st,'lawn','fescue',0,0,9,7);
    /* The bed is deliberately NOT the rectangle. That is the whole point of
       the estimate: it reads the live bed tiles inside the marquee, so a
       selected area of 79 sq ft can hold 54 sq ft of bed, and it is the
       second number you order mulch against. */
    gsFill(st,'bed','mulch',1,1,7,3,{e:'steel'});
    gsFill(st,'bed','mulch',2,4,6,4,{e:'steel'});
    [[1,1],[3,1],[5,1],[7,1],[2,2],[4,2],[6,2],[1,3],[3,3],[5,3],[7,3],[3,4],[5,4]]
      .forEach(function(p){ gsPlant(st,p[0],p[1],'echinacea',1); });
    return st; },
  run(st,u){
    const r={x0:1,y0:1,x1:7,y1:5};
    st.marks=[];
    for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++)
      st.marks.push({x:x,y:y,fill:'rgba(124,168,196,0.22)',stroke:'rgba(124,168,196,0.70)'});
    if (u<0.26){
      st.menu={items:['Estimate materials…','Replace plants…','Rotate 90 degrees',
        'Save area','Paste saved area','Erase selection'],on:0,open:gAt(u,0.06,0.18)};
      st.notes=[{text:'Marquee a bed, then More → Estimate materials…',
        at:[4.5,7.4],dy:28}];
      return;
    }
    /* The rows are the dialog's own, in its own order, built by its own
       function over the tiles this stage is carrying — so a number here cannot
       drift from the number the app would print. The mulch depth really is
       2, 3 or 4 inches; the slider offers nothing else. */
    const depth=Math.min(4,2+Math.floor(gAt(u,0.34,1)*3.0));
    const items=[];
    for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
      const c={x:x,y:y};
      const t=gsGet(st.terrain,x,y); if (t) c.terr=t;
      const p=gsGet(st.plants,x,y); if (p) c.plant=p;
      items.push(c);
    }
    const est=gsBorrowArmed('echinacea',function(){
      return selectionEstimate(r,depth,items);
    });
    st.panel={title:'Approximate materials',
      sub:'From the live bed tiles in your selection',
      rows:[
        {label:'Selected area', value:fmtAreaSqFt(est.areaSqFt,0)},
        {label:'Bed area', value:fmtAreaSqFt(est.bedAreaSqFt,0)},
        {label:'Exposed bed edge', value:fmtFeet(est.edgeFt,1)},
        {label:'Mulch at '+fmtLengthIn(depth), value:fmtVolumeCuYd(est.mulchCuYd), on:true},
        {label:est.armedName+' at spacing', value:est.approxPlants+' plants'},
        {label:'Already placed', value:est.plants+' plants'}
      ]};
    st.notes=[{text:u<0.5 ? 'It reads the BED inside the marquee, not the rectangle'
      : 'Change the depth and the mulch follows', at:[4.5,7.4],dy:28}];
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
      {id:'preview', demo:'preview', title:'Today vs Established',
       lead:'Gardens open showing the planting grown up. This is the switch back to what is actually in the ground.',
       how:['A short tap on the season box opens the time menu; the lens is in there.',
            'Established shows mature sizes, tree canopies and their shade — without advancing time.',
            'What you SEE follows this. What is LEGAL never does: the rules always plan for maturity.',
            'It is saved per garden, so a garden left on Today stays on Today.']},
      {id:'season', demo:'season', title:'Run the year',
       lead:'The reason to design a planting rather than arrange one. The same plants bloom, seed, and stand through winter.',
       how:['Press and HOLD the season box to fast-forward.',
            'A short tap opens the time menu: pause, resume, or skip to the next season.',
            'Winter is the test. Good planting still has structure in it.']},
     ]},

    {id:'site', title:'Your own garden',
     blurb:'Start from a photograph of the real place, and get the sun right.',
     entries:[
      {id:'underlay', demo:'underlay', title:'Trace a site photo',
       lead:'Bring in a photograph or a survey drawing, scale it to something you have measured, and draw the real garden over it.',
       how:['Landscape → Site → Add site photo. An aerial screenshot or a phone photo taken from an upstairs window both work.',
            'Drag to move it, pinch to scale and rotate, or use Fit plot and the nudge arrows.',
            'Calibrate a known distance — tap two points you have measured, then type the real distance. That is what makes everything you draw over it true.',
            'Turn the opacity down until you can see your own lines. It sits under the planting and over the ground.',
            'It is a reference, not geometry: nothing snaps to it, and Layers can hide it once you are done.']},
      {id:'north', demo:'north', title:'North, sun and shade',
       lead:'Which way the garden faces is the one site fact the app cannot guess, and almost everything about light follows from it.',
       how:['Landscape → Site → North, or the dial on the plot screen. Drag it, or type a bearing.',
            'North belongs to the SITE. Turning the view moves you around the garden and never moves the sun.',
            'Layers → Shade overlay washes every tile: amber full sun, teal part shade, blue shade.',
            'Shade is cast by TREES, at their mature spread — so the Established preview shows the shade the garden will have, not the shade it has today.',
            'Buildings and fences block planting, not light. Read a wall as a site constraint, not a shadow.',
            'The same bearing turns the compass markers and the north arrow on the printed plan.']},
     ]},

    {id:'planting', title:'Putting plants in',
     blurb:'One at a time, by the drift, by the drag, or as a matrix.',
     entries:[
      {id:'findplants', demo:'findplants', title:'Find a plant, and keep it',
       lead:'Five hundred species is too many to scroll. Search narrows them, a family card holds the cultivars, and a palette keeps the ones you like.',
       how:['Find searches common name, botanical name, synonyms and cultivar, across every category at once.',
            'Filters narrows by flower colour and bloom season. The garden’s own zone and native settings are already applied and are not repeated there.',
            'A card with a variety count opens into its exact cultivars — the app plants the exact one you chose and keeps it that way everywhere.',
            'The heart saves a plant to Favorites; the button beside it adds one to a named palette.',
            'Favorites and palettes live on this device, not in a garden, so they follow you into the next one.']},
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
      {id:'bulbs', demo:'bulbs', title:'Bulbs',
       lead:'A second layer under the planting, up before anything else and gone by midsummer.',
       how:['Plants → Bulbs, then plant as usual. They tuck under whatever is already there.',
            'They are refused under a tree trunk or a shrub’s reserved ground, and nowhere else.',
            'Spring, summer and fall bulbs each have their own window — the bloom calendar shows them.']},
      {id:'freeplant', demo:'freeplant', title:'Grid or free placement',
       lead:'Whether a plant sits dead on its tile centre or a little off it.',
       how:['The Grid / Free chip is in the brush bar with Draw and Drift.',
            'Free nudges each plant off the lattice, so a drift stops reading as a grid.',
            'It changes the drawing only. Spacing, quantities and the plan are unaffected.']},
      {id:'fill', demo:'fill', title:'Fill an area',
       lead:'One tap covers a whole connected area with whatever is on the brush.',
       how:['Turn Fill on in the brush bar, then tap inside the area.',
            'It floods the region sharing the tapped tile’s material and stops where that changes.',
            'It works with a plant on the brush too, not only a material.',
            'The whole fill is one undo step.']},
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
      {id:'lighting', demo:'lighting', title:'Lighting',
       lead:'Path lights, lantern posts and lamps, in a warm, cool or eco tone.',
       how:['Landscape → Lighting. Set them out along a path or a bed edge.',
            'Turn night on with the sun/moon button in the top bar to see them lit.',
            'They reach the planting list and the plan, because somebody has to install them.']},
      {id:'site', demo:'site', title:'Draw a building',
       lead:'The house, the shed, the garage — the things a garden has to be designed around.',
       how:['Landscape → Site → Draw footprint, then tap each corner. Close on the first corner.',
            'Corners snap square, and the live edge tells you its length in feet.',
            'Existing or Proposed changes how it is drawn, not what it blocks.',
            'Edit footprint adds or removes tiles later; a footprint stays one unbroken shape.']},
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
            'The pill is Move, Copy, Fill and More; Rotate, Save, Paste, Erase, Replace and Estimate are under More.',
            'The selection owns what was inside it when you drew it, so a plant that lands there later is never scooped up.',
            'A move onto ground that refuses it is refused whole — nothing lands half-placed.']},
      {id:'savearea', demo:'savearea', title:'Save and reuse a grouping',
       lead:'A planting that works once will work again. Save the marquee and paste it wherever you need it.',
       how:['Select the grouping, then More → Save area. One area is held at a time.',
            'More → Paste saved area drops it at the selection, in any garden you have open.',
            'It carries every layer inside the rectangle — planting, bulbs, bed, edging, fences — not just the plants.',
            'Rotate 90 degrees turns it about its own centre, so a corner planting serves the opposite corner.',
            'A paste onto ground that refuses it is refused whole. Nothing lands half-placed.']},
      {id:'replace', demo:'replace', title:'Replace a plant everywhere',
       lead:'Change your mind about a species without losing the positions, which are the part that took the work.',
       how:['From a plant’s card, or from More → Replace plants… on a selection.',
            'Three scopes, each with its count: this plant, everything matching inside the selection, or everything matching in the garden.',
            'Only compatible plants are offered — a perennial swaps for a perennial, a shrub for a shrub.',
            'Positions and planted age are kept, so a mature tree stays mature.',
            'Anything that cannot fit its new ground is reported and left alone. The rest still changes, in one undo step.']},
      {id:'ruler', demo:'ruler', title:'Measure something',
       lead:'A tape measure, for when you need to know whether the bed is really wide enough.',
       how:['Ruler is on the tool rail. Drag between two points, or tap one then the other.',
            'It reads in feet or metres, following your units setting.',
            'A selection reports its own size, and More → Estimate materials prices it up.']},
      {id:'undo', demo:'undo', title:'Undo and redo',
       lead:'Nothing you do here is permanent, which is the point of designing on a screen.',
       how:['The arrows sit at the bottom of the tool rail, below a divider.',
            'Ctrl/Cmd-Z and Ctrl/Cmd-Shift-Z, or two fingers to undo and three to redo.',
            'A whole drag, a whole fill and a whole selection move are each ONE step.',
            'Thirty steps are kept, and they reset when you open a different garden.']},
      {id:'schemes', demo:'schemes', title:'Two plantings, one plan',
       lead:'Try a different planting over the same beds, paths and structures without forking the garden.',
       how:['Garden menu → Planting schemes to make one; the chip in the top bar switches.',
            '[ and ] cycle, 1–6 jump straight to one.',
            'Only the planting belongs to a scheme. The site plan is shared and stored once.',
            'Switching is navigation, not an edit — it takes no undo step.']},
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

    {id:'out', title:'Taking it out',
     blurb:'The documents a finished design turns into.',
     entries:[
      {id:'outputs', demo:'outputs', title:'Planting list, plan and calendar',
       lead:'Everything the design becomes on paper, all of it behind the Menu button.',
       how:['Planting list — every species counted into real nursery quantities, plus surfaces and hardscape. It exports as CSV.',
            'Design plan — a drawn sheet at a stated scale, with a schedule, a north arrow and a scale bar. It prints, and saves as a PNG.',
            'Bloom calendar — what is in flower, month by month, across the whole planting.',
            'Share this garden writes a file a friend can import into their own planner.']},
      {id:'estimate', demo:'estimate', title:'Estimate materials',
       lead:'What the ground will take: area, edging, and how much mulch to order.',
       how:['Select an area, then More → Estimate materials…',
            'It reads the live bed tiles inside the marquee, so it follows the bed rather than the rectangle.',
            'Mulch depth is 2, 3 or 4 inches, and the volume follows it.',
            'Plants already placed and plants the spacing would need are shown separately, because they are different numbers and both are true.',
            'For the whole garden rather than one bed, the planting list does the same job under Surfaces & hardscape.']},
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
  /* syncGuideView FIRST, always. It is what sets data-guideview, and on SHEET
     the detail pane is display:none until it does — so a draw before it
     measures a 0x0 canvas, sizeGuideCanvas returns null, and nothing is
     painted. With motion on the loop covered that up on the next frame; with
     reduced motion the loop never runs, so the reader got a solid-colour
     rectangle until they scrubbed or pressed Play. */
  syncGuideView();
  buildGuideList();
  renderGuideDetail();
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
  /* Captured FIRST: syncGuideView can hide the list, and a browser blurs an
     element the moment it becomes display:none, so asking afterwards always
     answers "no". Only restored when focus was really in the list — a mouse
     user pressing a row should not have focus yanked around. */
  const list=$('guideList');
  const hadFocus=!!(list && document.activeElement && list.contains(document.activeElement));
  /* Before the draw, for the reason openGuide gives: on SHEET the detail pane
     is hidden until this runs, and a canvas measured while hidden is 0x0. */
  syncGuideView();
  buildGuideList();          // the selected row moves
  renderGuideDetail();
  if (hadFocus) guideRestoreFocus();
  startGuideLoop();
}
/* Where the keyboard goes after the list is rebuilt under it. Both panes throw
   away every node they own, so focus fell to the body and the next Tab started
   again at the first tool.

   The destination differs by TIER and it has to: on DOCK the list stays beside
   the detail, so the keyboard belongs back on the row it was on. On SHEET the
   list has just been REPLACED by the detail view — measured, that row computes
   to a 0x0 box inside a display:none pane and cannot take focus at all — so
   focus follows the reader onto the screen they actually moved to. */
function guideRestoreFocus(){
  const target = guideSheetUi()
    ? ($('btnGuideBack') || document.querySelector('.guide-detail-back'))
    : (($('guideList')||{querySelector:()=>null}).querySelector('.guide-item.sel'));
  if (target && target.focus) target.focus({preventScroll:true});
}
function buildGuideList(){
  const list=$('guideList'); if (!list) return;
  const frag=document.createDocumentFragment();
  guideChapters().forEach(function(c){
    const sec=document.createElement('div'); sec.className='guide-section';
    sec.setAttribute('role','group');
    sec.setAttribute('aria-label',c.title+'. '+c.blurb);
    const h=document.createElement('h3'); h.className='guide-cat';
    h.textContent=c.title;
    h.title=c.blurb;
    sec.appendChild(h);
    c.entries.forEach(function(e){
      const b=document.createElement('button'); b.type='button';
      b.className='guide-item'+(e.id===guideSel?' sel':'');
      b.setAttribute('aria-current',e.id===guideSel?'true':'false');
      /* The NAME, and nothing else. Each row used to carry its lead clamped to
         two lines, on the theory that 24 bare titles would read as a menu of
         jargon — but the lead is the very next thing the detail pane says, so
         the list was a wall of text you had to read twice, and the one job of a
         contents list is to be scanned. The lead stays as the row's accessible
         description, where it costs no ink. */
      const n=document.createElement('span'); n.className='gi-name'; n.textContent=e.title;
      b.appendChild(n);
      b.title=e.lead;
      b.setAttribute('aria-label',e.title+'. '+e.lead);
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
  /* ONE measured column, rather than a max-width and auto margins on every
     child. That form looked equivalent and was not: .guide-transport,
     .guide-where and .guide-how each declare their own `margin` shorthand,
     which resets margin-left to 0 at equal specificity and later in the file —
     so the figure and the headings centred while the transport and the copy
     stayed hard left, and on a wide monitor they sat 600px apart. */
  const frag=document.createElement('div');
  frag.className='guide-doc';

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
    if (guidePlaying){
      /* Park on the frame that is on screen, rather than leaving the position
         implicit — otherwise the next redraw falls through to demo.rest and
         the demo jumps somewhere the reader did not stop it. */
      guideScrub=guideCurrentU();
      guidePlaying=false;
    } else {
      guideScrub=null; guideT0=0; guidePlaying=true; startGuideLoop();
    }
    syncGuidePlay();
    drawGuideFrame();
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
  const trail=guideWhereTrail((GUIDE_DEMOS[e.demo]||{}).where);
  if (trail){
    const w=document.createElement('p'); w.className='guide-where';
    trail.forEach((g,gi)=>{
      const lab=document.createElement('span'); lab.className='guide-where-label';
      lab.textContent=g.label; w.appendChild(lab);
      g.steps.forEach((step,i)=>{
        if (i){ const sep=document.createElement('span'); sep.className='guide-where-sep';
          sep.setAttribute('aria-hidden','true'); sep.textContent='›'; w.appendChild(sep); }
        const s=document.createElement('span');
        /* Only the END of each trail is armed, because that is the control you
           are left holding; the steps before it are how you got there. */
        s.className='guide-where-step'+(i===g.steps.length-1?' last':'');
        s.textContent=step; w.appendChild(s);
      });
      if (gi<trail.length-1){
        const gap=document.createElement('span'); gap.className='guide-where-gap';
        gap.setAttribute('aria-hidden','true'); gap.textContent='·'; w.appendChild(gap);
      }
    });
    frag.appendChild(w);
  }
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
  /* One retry on the next frame if the canvas had no box yet. The ordering
     above is the real fix; this is the guard that keeps a blank plate from
     ever being the resting state again, because under reduced motion there is
     no loop coming along behind to paint it. */
  if (!drawGuideFrame()) requestAnimationFrame(function(){
    if (guideOpen()) drawGuideFrame();
  });
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
/* Where the demo is now, without drawing it — so pausing can park on the frame
   that is actually on screen. Left to drawGuideFrame's own fallback, a pause
   through the Play button left guideScrub null, and the next redraw (a resize,
   a rotation) jumped to demo.rest: the reader stopped it on the frame they
   wanted and the window changing size moved it. */
function guideCurrentU(t){
  const e=guideEntry(guideSel), demo=e&&GUIDE_DEMOS[e.demo];
  if (!demo) return 0;
  if (guideScrub!==null) return guideScrub;
  if (!guidePlaying || !guideT0) return demo.rest===undefined?0.8:demo.rest;
  return (((t||performance.now())-guideT0)%demo.loop)/demo.loop;
}
function drawGuideFrame(t){
  const box=sizeGuideCanvas(); if (!box) return false;
  const e=guideEntry(guideSel); if (!e) return false;
  const demo=GUIDE_DEMOS[e.demo]; if (!demo) return false;
  const ctx=box.cv.getContext('2d'); if (!ctx) return false;

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
  /* After run(), so a demo's own option row lands BELOW the catalog path it
     was reached through, and so adding the affordance cost no demo an edit. */
  gsApplyWhere(st,demo.where,u);
  guideStageCache=st;
  ctx.setTransform(box.dpr,0,0,box.dpr,0,0);
  /* No sway. Every demo is about a gesture, and a breathing planting behind it
     is motion competing with the thing being explained — and under reduced
     motion there must be none at all. */
  gsRender(ctx,st,box.w,box.h,0);
  return true;
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
/* A resize crosses TIERS. Rotating a tablet from the SHEET contents list into
   DOCK landscape makes the detail pane visible for the first time, and the old
   handler redrew without restarting the loop — so the demo sat frozen under a
   button that said "Pause", which is the one label that cannot be true of a
   still picture. syncGuidePlay goes with it, because guideCanAnimate can now
   answer differently than it did when the button was last written. */
addEventListener('resize',function(){
  if (!guideOpen()) return;
  syncGuideView();
  syncGuidePlay();
  drawGuideFrame();
  startGuideLoop();
});

if ($('btnGuide')) $('btnGuide').onclick=openGuide;
if ($('btnGuideClose')) $('btnGuideClose').onclick=closeGuide;
if ($('btnGuideBack')) $('btnGuideBack').onclick=guideBack;
