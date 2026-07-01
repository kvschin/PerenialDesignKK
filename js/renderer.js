'use strict';

let snowFlakes = [];
/* The ground (961 tiles, each a pile of fills/strokes/blades) is identical
   every frame unless the camera, season, window, or terrain changes — yet it
   was the entire frame cost (~12ms). So render it once to an offscreen layer
   and blit it; rebuild only when the cache key changes. groundDataSig captures
   the terrain/elevation/house data cheaply (it's sparse — usually empty), and
   camera/season/size go straight in the key. Trade-off: water ripples freeze
   while the view is perfectly still; any pan or edit resumes them. */
let groundCanvas=null, groundCtx=null, groundKey='';
function groundDataSig(){
  let s='';
  for (const k in game.terrain){ const o=game.terrain[k]; if (o&&!o.removed) s+=k+o.k+(o.c||'')+';'; }
  for (const k in game.elevation){ const o=game.elevation[k]; if (o&&!o.removed) s+='e'+k+o.h+';'; }
  const hs=game.houses||[]; for (let i=0;i<hs.length;i++){ const h=hs[i]; s+='H'+h.x+','+h.y+','+h.w+','+h.h+';'; }
  return s;
}
function paintGround(ctx,x0,x1,y0,y1,W,H,amb,t){
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const [sx,sy]=screenOf(x,y,W,H);
    if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
    const showLand=layerShown('landscape');
    const terrObj=showLand?terrainAt(x,y):null, terr=terrObj&&terrObj.k;
    const path=terr==='path';
    const water=terr==='water';
    const rs=mulberry(tileSeed(x,y));
    let col;
    if (water) col = waterFill(terrObj,amb.snow);
    else if (path) col = pathFill(terrObj,amb.snow);
    else if (showLand && isDoor(x,y)) col = amb.snow?'#aaa49a':'#a89a80';   // flagstone doorstep
    else if (terr==='bed') col = shade(bedFill(terrObj,amb),(rs()-0.5)*12);
    else col = shade(amb.grass[(x+y)%2], (rs()-0.5)*14);
    drawElevationSides(ctx,W,H,x,y,col);
    if (water) drawWaterTexture(ctx,sx,sy,x,y,terrObj,amb,t);
    else drawGroundTexture(ctx,sx,sy,x,y,terr,path,amb,col,rs,terrObj);
    drawElevationRim(ctx,sx,sy,elevationAt(x,y));
    if (amb.snow && !path && !water && rs()>0.4){ ctx.fillStyle='rgba(238,242,248,0.7)';
      ctx.beginPath(); ctx.ellipse(sx+(rs()-0.5)*30, sy+TILE_H/2+(rs()-0.5)*10, 9,3.5,0,0,7); ctx.fill(); }
  }
}
/* ---------- plant sprite cache (perf) ----------
   drawPlant re-runs a plant's whole procedural recipe every frame, which is
   ~88% of a heavy frame. A plant tile looks identical frame to frame apart
   from a global wind sway, so render it once to a small offscreen canvas —
   keyed by its own seed, so every clump stays unique (no shared variants) —
   and blit it on later frames, shearing the blit for sway. Growth and bloom
   are bucketed so the key is stable across frames; the cache clears on a zoom
   change (sprites bake the current device scale, so a 1:1 blit stays crisp)
   and is evicted LRU under a memory budget. It only kicks in once a frame is
   heavy enough that the bucketing is imperceptible — light gardens keep the
   pristine, smoothly-growing procedural path. Toggle PSPRITE.off to A/B it. */
const PSPRITE={ map:new Map(), scale:-1, frame:0, rendered:0, bytes:0,
  MEM:48*1024*1024, BUDGET:160, MIN:300, off:false, active:false };
function pspriteScale(){ return Math.min(DPR,1.5)*ZOOM; } // cap DPR so retina sprites don't 4x the budget
function pspriteFrame(){                        // once per render: age the cache
  PSPRITE.frame++; PSPRITE.rendered=0; PSPRITE.scale=pspriteScale();
  // Evict only sprites NOT drawn last frame (off-screen), oldest first, down to
  // budget — never the visible set. This is what stops the cache thrashing and
  // flickering when the working set is large (e.g. a dense garden on retina):
  // memory may overshoot to hold everything on screen, but it never re-renders
  // a visible plant it just discarded.
  if (PSPRITE.bytes>PSPRITE.MEM) for (const [k,e] of PSPRITE.map){
    if (PSPRITE.bytes<=PSPRITE.MEM || e.used>=PSPRITE.frame-1) break;
    PSPRITE.bytes-=e.bytes; PSPRITE.map.delete(k);
  }
}
function gbucket(v,n){ v=v<0?0:v>1?1:v; return Math.round(v*(n-1)); }
function makePlantSprite(key,gB,bB,season,seed,variant,detail){
  const P=plantDef(key,variant), growth=gB/8;
  const H=P.h*(0.25+0.75*growth);
  // the box must cover the whole drawing — woody canopies reach well above P.h
  // and wide of P.cw, so trees clip if we size from P.h alone.
  const woody=P.type==='tree'||P.type==='shrub';
  const canopy=(isShrubDef(P)?(shrubVisualCw(P)||50):(P.cw||80))*(0.3+0.7*growth);
  const halfW=(woody?Math.max(canopy*0.62,H*0.5):H*0.62)+18;
  const top=(woody?Math.max(H,0.75*H+canopy*0.7):H*1.12)+26;
  const bot=18, s=pspriteScale();
  const pw=Math.max(1,Math.ceil(halfW*2*s)), ph=Math.max(1,Math.ceil((top+bot)*s));
  if (pw>2600||ph>2600) return null;           // absurd size — don't cache, fall back
  const cv=document.createElement('canvas'); cv.width=pw; cv.height=ph;
  const c2=cv.getContext('2d'); c2.setTransform(s,0,0,s,halfW*s,top*s);
  drawPlant(c2,0,0,key,growth,season,seed,0,variant,bB/3,detail); // still (sway 0), bucketed bloom
  return { cv, ox:halfW, oy:top, s, bytes:pw*ph*4 };
}
// blit a cached plant if we can, else fall back to a live procedural draw.
function drawPlantMaybeCached(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites){
  if (!useSprites || PSPRITE.off){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  const P=plantDef(key,variant), S=P.sea[season];
  const gB=gbucket(growth,9), bB=(S&&S.bloom)?gbucket(bloomLevel(key),4):0;
  const kk=seed+'|'+key+'|'+(variant||'')+'|'+season+'|'+gB+'|'+bB+'|'+(detail?JSON.stringify(detail):'');
  let e=PSPRITE.map.get(kk);
  // A sprite baked at a very different zoom blits soft, so re-render it (budget
  // permitting) at the current scale. But to keep zooming smooth, reuse the old
  // one for this frame rather than dropping a visible plant to a slow procedural
  // draw — the cache converges back to crisp within a few frames after a zoom.
  if (!e || Math.abs(e.s-PSPRITE.scale) > PSPRITE.scale*0.12){
    if (PSPRITE.rendered<PSPRITE.BUDGET){
      const ne=makePlantSprite(key,gB,bB,season,seed,variant,detail);
      if (ne){ if (e) PSPRITE.bytes-=e.bytes; e=ne; PSPRITE.rendered++; PSPRITE.bytes+=e.bytes; }
    }
    if (!e){ drawPlant(ctx,bx,by,key,growth,season,seed,sway,variant,undefined,detail); return; }
  }
  if (PSPRITE.map.has(kk)) PSPRITE.map.delete(kk);   // LRU: re-insert at the end
  e.used=PSPRITE.frame;
  PSPRITE.map.set(kk,e);
  const dw=e.cv.width/e.s, dh=e.cv.height/e.s, lx=bx-e.ox, ly=by-e.oy;
  if (sway){
    ctx.save(); ctx.translate(bx,by); ctx.transform(1,0,sway*0.05,1,0,0); ctx.translate(-bx,-by);
    ctx.drawImage(e.cv,lx,ly,dw,dh); ctx.restore();
  } else ctx.drawImage(e.cv,lx,ly,dw,dh);
}
function render(t){
  const W=VW/ZOOM, H=VH/ZOOM, cal=calClock(), amb=AMBIENCE[cal.season];
  cx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
  // sky
  const g = cx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,amb.sky[0]); g.addColorStop(1,amb.sky[1]);
  cx.fillStyle=g; cx.fillRect(0,0,W,H);
  drawSeasonSky(cx,W,H,cal.season);

  // camera eases toward the player (story + visiting; design and Hand tool pan
  // freely — but a visit always follows the avatar, since its tool stays 'hand')
  if (game.visiting || (game.gameMode!=='design' && game.tool!=='hand')){
    const [ptx,pty]=screenOf(game.px,game.py,W,H);
    cam.x += (ptx-W/2)*0.06; cam.y += (pty-H*0.45)*0.06;
  }
  const tCompass=dnow(); updateCompass(); dmark('compass',tCompass);

  const sway = Math.sin(t*0.0012);
  pspriteFrame();

  // visible tile window: invert the four screen corners to world tiles
  // and take the padded bounding box, so we only walk what's on screen
  // (the padding covers plant/cottage heights overhanging tile bounds)
  const crn=[tileAt(0,0,W,H),tileAt(W,0,W,H),tileAt(0,H,W,H),tileAt(W,H,W,H)];
  const pad=5; // large shrubs can overhang several tile centers
  const x0=Math.max(0,Math.min(crn[0][0],crn[1][0],crn[2][0],crn[3][0])-pad);
  const x1=Math.min(GW-1,Math.max(crn[0][0],crn[1][0],crn[2][0],crn[3][0])+pad);
  const y0=Math.max(0,Math.min(crn[0][1],crn[1][1],crn[2][1],crn[3][1])-pad);
  const y1=Math.min(GH-1,Math.max(crn[0][1],crn[1][1],crn[2][1],crn[3][1])+pad);
  const shadeTrees=[], futureShadeTrees=[], visibleShrubs=[], visibleLights=[], visibleFirepits=[];
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    const shrub=shrubInfoFromKey(k);
    if (shrub && layerShown('woody')){
      const r=Math.ceil(shrubRadiusTiles(plantDef(p.s,p.v)))+1;
      if (!(shrub.x+r<x0 || shrub.x-r>x1 || shrub.y+r<y0 || shrub.y-r>y1)) visibleShrubs.push(shrub);
    }
    const sh=treeShadeInfo(k,p);
    if (!sh || sh.r<1) continue;
    const reach=treeShadeReach(sh);
    if (sh.x+reach<x0 || sh.x-reach>x1 || sh.y+reach<y0 || sh.y-reach>y1) continue;
    (sh.activePotential?shadeTrees:futureShadeTrees).push(sh);
  }
  if (layerShown('landscape')) for (const k in game.lights){ const l=game.lights[k];
    if (!l || l.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    visibleLights.push({l,x,y});
  }

  const tG0=dnow();
  // ground tiles: static per camera/terrain/season, so render once to an
  // offscreen layer and blit it; rebuild only when the cache key changes.
  const gkey=cal.season+'|'+game.rot+'|'+ZOOM+'|'+cam.x+'|'+cam.y+'|'+
    (layerShown('landscape')?1:0)+'|'+cnv.width+'x'+cnv.height+'|'+groundDataSig();
  if (!groundCanvas){ groundCanvas=document.createElement('canvas'); groundCtx=groundCanvas.getContext('2d'); }
  if (groundCanvas.width!==cnv.width||groundCanvas.height!==cnv.height){
    groundCanvas.width=cnv.width; groundCanvas.height=cnv.height; groundKey=''; }
  if (gkey!==groundKey){
    groundCtx.setTransform(1,0,0,1,0,0); groundCtx.clearRect(0,0,groundCanvas.width,groundCanvas.height);
    groundCtx.setTransform(DPR*ZOOM,0,0,DPR*ZOOM,0,0);
    paintGround(groundCtx,x0,x1,y0,y1,W,H,amb,t);
    groundKey=gkey;
  }
  cx.save(); cx.setTransform(1,0,0,1,0,0); cx.drawImage(groundCanvas,0,0); cx.restore();
  dmark('ground',tG0);
  const tShade=dnow();
  if (layerShown('woody')) visibleShrubs.forEach(sh=>drawShrubFootprint(cx,W,H,sh,'base'));
  // active shade is a cool wash; young trees get only a faint future-canopy edge.
  shadeTrees.forEach(sh=>{
    const rr=treeShadeReach(sh);
    for (let yy=Math.max(y0,sh.y-rr); yy<=Math.min(y1,sh.y+rr); yy++)
      for (let xx=Math.max(x0,sh.x-rr); xx<=Math.min(x1,sh.x+rr); xx++){
        const score=treeShadeScore(sh,xx,yy);
        if (score<SHADE_ACTIVE_SCORE) continue;
        const [sx,sy]=screenOf(xx,yy,W,H);
        const a=(0.06+0.18*score)*(0.65+0.35*sh.est);
        tileDiamond(cx,sx,sy,`rgba(32,52,42,${Math.max(0.035,a)})`,null);
      }
  });
  futureShadeTrees.forEach(sh=>{
    const rr=treeShadeReach(sh);
    for (let yy=Math.max(y0,sh.y-rr); yy<=Math.min(y1,sh.y+rr); yy++)
      for (let xx=Math.max(x0,sh.x-rr); xx<=Math.min(x1,sh.x+rr); xx++){
        const score=treeShadeScore(sh,xx,yy);
        if (score>=SHADE_FUTURE_SCORE && score<SHADE_ACTIVE_SCORE){
          const [sx,sy]=screenOf(xx,yy,W,H);
          tileDiamond(cx,sx,sy,null,'rgba(210,168,92,0.34)',[5,5]);
        }
      }
  });
  // Shade-suitability overlay (Layers view): wash every tile by how much
  // canopy reaches it — amber = full sun, teal = shade, between = part shade
  if (game.layerVis.shade){
    for (let yy=y0; yy<=y1; yy++) for (let xx=x0; xx<=x1; xx++){
      let score=0;
      shadeTrees.forEach(sh=>{ const s=treeShadeScore(sh,xx,yy); if (s>score) score=s; });
      const [sx,sy]=screenOf(xx,yy,W,H);
      if (sx<-TILE_W||sx>W+TILE_W||sy<-TILE_H*2||sy>H+TILE_H*2) continue;
      const col = score>=SHADE_ACTIVE_SCORE ? 'rgba(38,84,112,0.52)'      // shade — cool blue
        : score>0 ? 'rgba(70,132,128,0.44)'                              // part shade — teal
        : 'rgba(232,180,78,0.40)';                                       // full sun — amber
      tileDiamond(cx,sx,sy,col,null);
    }
  }
  dmark('shade',tShade);
  const tCursor=dnow();
  const focusedShrub=layerShown('woody') && game.focusPlantKey ? shrubInfoFromKey(game.focusPlantKey) : null;
  if (focusedShrub) drawShrubFootprint(cx,W,H,focusedShrub,'focus');
  const hoverShrub=layerShown('woody') && game.hoverTile ? shrubAt(game.hoverTile[0],game.hoverTile[1]) : null;
  if (hoverShrub){
    let mode='hover';
    if (isPlacementTool(game.tool) && game.tool!=='house'){  // placement tools are blocked by a shrub here; house ghosts instead
      mode='blocked';
      if (PLANTS[game.tool] && plantDef(game.tool,game.toolVar).type==='shrub'){
        const [txh,tyh]=game.hoverTile, draft={s:game.tool,v:game.toolVar||null,d:absDay()};
        if (canPlaceShrubAt(txh,tyh,draft).ok) mode='hover';
      }
    }
    drawShrubFootprint(cx,W,H,hoverShrub,mode);
  }
  game.shrubFx=game.shrubFx.filter(f=>t-f.t0<760);
  game.shrubFx.forEach(f=>{
    const sh=shrubInfoFromKey(f.key);
    if (sh && layerShown('woody')) drawShrubFootprint(cx,W,H,sh,'pulse',t-f.t0);
  });
  // hover/selection cursor on player's tile
  const [hx,hy]=screenOf(game.tx,game.ty,W,H);
  cx.strokeStyle='rgba(243,236,221,0.85)'; cx.lineWidth=2;
  cx.beginPath(); cx.moveTo(hx,hy+2); cx.lineTo(hx+TILE_W/2-3,hy+TILE_H/2);
  cx.lineTo(hx,hy+TILE_H-2); cx.lineTo(hx-TILE_W/2+3,hy+TILE_H/2); cx.closePath(); cx.stroke();
  if (game.hoverTile && PLANTS[game.tool]){
    const def=plantDef(game.tool,game.toolVar);
    if (def && def.type==='shrub'){
      const [txh,tyh]=game.hoverTile, draft={s:game.tool,v:game.toolVar||null,d:absDay()};
      const ok=canPlaceShrubAt(txh,tyh,draft).ok;
      drawShrubFootprint(cx,W,H,{x:txh,y:tyh,p:draft},ok?'hover':'blocked');
    }
    if (def && def.sun!=='part' && def.type!=='tree' && def.type!=='bulb'){
      const [txh,tyh]=game.hoverTile, sh=shadeInfoAt(txh,tyh,true);
      if (sh){ const [sx,sy]=screenOf(txh,tyh,W,H);
        tileDiamond(cx,sx,sy,sh.active?'rgba(150,42,32,0.16)':'rgba(210,168,92,0.13)',
          sh.active?'rgba(230,118,92,0.88)':'rgba(234,188,102,0.78)',sh.active?null:[5,4]); }
    }
  }

  // RTS-style placement ghost while the House tool is armed: tinted
  // footprint (red when you're standing in it) under a translucent house
  let ghost=null;
  if (game.tool==='house' && game.hoverTile && game.houseDraft){
    const h=game.houseDraft;
    const gx=Math.max(0,Math.min(GW-h.w,game.hoverTile[0]));
    const gy=Math.max(0,Math.min(GH-h.h-1,game.hoverTile[1]));
    const ppx=Math.round(game.px), ppy=Math.round(game.py);
    const onAvatar = game.gameMode!=='design' && ppx>=gx&&ppx<gx+h.w&&ppy>=gy&&ppy<gy+h.h;
    const onHouse = game.houses.some(o=>gx<o.x+o.w&&gx+h.w>o.x&&gy<o.y+o.h&&gy+h.h>o.y);
    const blocked = onAvatar || onHouse;
    ghost=Object.assign({},h,{x:gx,y:gy,blocked});
    cx.fillStyle = blocked ? 'rgba(220,90,70,0.34)' : 'rgba(140,205,125,0.30)';
    for (let yy=gy; yy<gy+h.h; yy++) for (let xx=gx; xx<gx+h.w; xx++){
      const [sx,sy]=screenOf(xx,yy,W,H);
      cx.beginPath(); cx.moveTo(sx,sy); cx.lineTo(sx+TILE_W/2,sy+TILE_H/2);
      cx.lineTo(sx,sy+TILE_H); cx.lineTo(sx-TILE_W/2,sy+TILE_H/2); cx.closePath(); cx.fill();
    }
    const [dgx,dgy]=doorPos(ghost), [dsx,dsy]=screenOf(dgx,dgy,W,H);
    cx.fillStyle='rgba(243,236,221,0.45)';  // the doorstep-to-be
    cx.beginPath(); cx.moveTo(dsx,dsy); cx.lineTo(dsx+TILE_W/2,dsy+TILE_H/2);
    cx.lineTo(dsx,dsy+TILE_H); cx.lineTo(dsx-TILE_W/2,dsy+TILE_H/2); cx.closePath(); cx.fill();
  }

  // depth-sorted entities: plants + critters + the cottage,
  // culled to the same visible window as the ground
  dmark('cursor',tCursor);
  const tGather=dnow();
  const ents=[];
  let plantCount=0, useSprites=false;          // sprite cache kicks in only when dense (set after gather)
  if (layerShown('landscape')) for (const k in game.fences){
    const f=game.fences[k]; if (f.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    ents.push({depth:viewDepth(x,y)+0.34, draw:()=>drawFence(cx,W,H,cal.season,f,x,y)});
  }
  visibleLights.forEach(({l,x,y})=>{
    ents.push({depth:viewDepth(x,y)+0.36, draw:()=>drawLightFixture(cx,W,H,cal.season,l,x,y,game.layerVis.night)});
  });
  if (layerShown('landscape')) for (const k in game.firepits){
    const f=game.firepits[k]; if (!f || f.removed) continue;
    const [x,y]=k.split(',').map(Number), sz=firepitTileSize(f);
    if (x+sz.w-1<x0||x>x1||y+sz.h-1<y0||y>y1) continue;
    visibleFirepits.push({f,x,y});
    ents.push({depth:viewDepth(x+sz.w-1,y+sz.h-1)+0.37, draw:()=>drawFirepit(cx,W,H,cal.season,f,x,y)});
  }
  if (layerShown('landscape')) for (const hh of game.houses){
    if (hh.x+hh.w-1>=x0 && hh.x<=x1 && hh.y+hh.h-1>=y0 && hh.y<=y1)
      ents.push({depth:houseDrawDepth(hh), draw:()=>drawHouse(cx,W,H,cal.season,hh)});
  }
  if (ghost)
    ents.push({depth:houseDrawDepth(ghost)+0.01,
      draw:()=>{ cx.globalAlpha=0.55; drawHouse(cx,W,H,cal.season,ghost); cx.globalAlpha=1; }});
  // active canopies stunt full-sun plants beneath them (they persist, smaller)
  // the bulb layer: invisible most of the year, so cull hard
  if (layerShown('bulbs'))
  for (const k in game.bulbs){ const p=game.bulbs[k];
    if (p.removed) continue;
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    const gB=plantGrowth(p); if (gB<=0.02) continue;
    plantCount++;
    ents.push({depth:plantDepth(x,y,p)+0.25, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,p.s,gB,cal.season,(tileSeed(x,y)^0x9e37)>>>0,sway,p.v,undefined,useSprites);}});
  }
  for (const k in game.plants){ const p=game.plants[k];
    if (p.removed) continue;
    if (!layerShown(plantLayerOf(p))) continue;       // perennials/woody view toggle
    const [x,y]=k.split(',').map(Number);
    if (x<x0||x>x1||y<y0||y>y1) continue;
    let g2v=plantGrowth(p);
    const P2=PLANTS[p.s];
    if (P2 && P2.sun!=='part' && P2.type!=='tree' &&
        shadeTrees.some(sh=>sh.p!==p && treeShadeScore(sh,x,y)>=SHADE_ACTIVE_SCORE))
      g2v*=0.45; // struggling under the canopy
    const detail=plantRenderDetail(x,y,p,W,H);
    plantCount++;
    ents.push({depth:plantDepth(x,y,p)+0.3, draw:()=>{ const [sx,sy]=plantScreenOf(x,y,p,W,H);
      drawPlantMaybeCached(cx,sx,sy+TILE_H/2,p.s,g2v,cal.season,tileSeed(x,y),sway,p.v,detail,useSprites);}});
  }
  // local player (smooth move) — story mode only; design has no avatar
  let dx=game.px, dy=game.py;
  if (game.gameMode!=='design')
  ents.push({depth:viewDepth(dx,dy)+0.5, draw:()=>{ const [sx,sy]=screenOf(dx,dy,W,H);
    drawCritter(cx,sx,sy+TILE_H/2,game.char,t,game.moving,1);
    cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
    const nm=game.char.name||'You', wN=cx.measureText(nm).width;
    cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
    cx.fillStyle='#f3ecdd'; cx.textAlign='center'; cx.fillText(nm,sx,sy-31); }});
  // other gardeners
  for (const id in game.others){ const o=game.others[id];
    if (Date.now()-o.ts > 30000) continue;
    ents.push({depth:viewDepth(o.x,o.y)+0.5, draw:()=>{ const [sx,sy]=screenOf(o.x,o.y,W,H);
      drawCritter(cx,sx,sy+TILE_H/2,{species:o.sp,coat:o.c,coatD:o.cd,mark:o.m},t,false,1);
      cx.fillStyle='rgba(25,18,15,0.6)'; cx.font='11px IBM Plex Sans';
      const wN=cx.measureText(o.n).width;
      cx.fillRect(sx-wN/2-5,sy-42,wN+10,15);
      cx.fillStyle='#cfe3c2'; cx.textAlign='center'; cx.fillText(o.n,sx,sy-31); }});
  }
  // dense gardens only — keeps light ones pristine. Hysteresis (on >MIN, off
  // <0.7·MIN) stops a flicker between procedural/cached while panning the edge.
  PSPRITE.active = !PSPRITE.off && plantCount > (PSPRITE.active ? PSPRITE.MIN*0.7 : PSPRITE.MIN);
  useSprites = PSPRITE.active;
  dmark('gather',tGather);
  const tSort=dnow(); ents.sort((a,b)=>a.depth-b.depth); dmark('sort',tSort);
  const tDraw=dnow(); ents.forEach(e=>e.draw()); dmark('draw',tDraw);
  if (dbg.on){ dbg.ents=ents.length; dbg.tiles=(x1-x0+1)*(y1-y0+1); }
  const tFx=dnow();

  // planting pulses: an expanding diamond so a tap visibly took
  game.fx=game.fx.filter(f=>t-f.t0<550);
  game.fx.forEach(f=>{
    const a=(t-f.t0)/550, e2=0.55+a*0.85;
    const [sx,sy]=screenOf(f.x+(f.ox||0),f.y+(f.oy||0),W,H), cyx=sy+TILE_H/2;
    cx.strokeStyle=`rgba(243,236,221,${0.95*(1-a)})`; cx.lineWidth=2.5;
    cx.beginPath();
    cx.moveTo(sx, cyx-(TILE_H/2)*e2); cx.lineTo(sx+(TILE_W/2)*e2, cyx);
    cx.lineTo(sx, cyx+(TILE_H/2)*e2); cx.lineTo(sx-(TILE_W/2)*e2, cyx);
    cx.closePath(); cx.stroke();
  });

  // selection tool: marquee, committed selection, and move/copy ghost
  if (game.tool==='select') drawSelectionOverlay(cx,W,H,t,cal.season,sway);

  // season light tint + falling snow
  applySeasonLighting(cx,W,H,amb,cal.season);
  if (amb.snow){
    if (snowFlakes.length<70 && Math.random()<0.5)
      snowFlakes.push({x:Math.random()*W,y:-5,v:0.4+Math.random()*0.7,r:1+Math.random()*1.6,w:Math.random()*7});
    cx.fillStyle='rgba(245,248,252,0.85)';
    snowFlakes.forEach(f=>{ f.y+=f.v; f.x+=Math.sin((t*0.001)+f.w)*0.3;
      cx.beginPath(); cx.arc(f.x,f.y,f.r,0,7); cx.fill(); });
    snowFlakes=snowFlakes.filter(f=>f.y<H+5);
  } else snowFlakes.length=0;
  if (game.layerVis.night){
    applyDuskLighting(cx,W,H,cal.season);
    visibleFirepits.forEach(({f,x,y})=>drawFirepitGlow(cx,W,H,f,x,y));
    visibleLights.forEach(({l,x,y})=>drawLightGlow(cx,W,H,l,x,y));
  }

  if (game.photo){ // golden-hour wash, only on the captured frame
    const g2=cx.createRadialGradient(W*0.72,H*0.22,30, W*0.72,H*0.22,H*0.95);
    g2.addColorStop(0,'rgba(255,212,140,0.38)');
    g2.addColorStop(0.5,'rgba(228,160,90,0.10)');
    g2.addColorStop(1,'rgba(50,35,55,0.24)');
    cx.fillStyle=g2; cx.fillRect(0,0,W,H);
  }
  dmark('fx',tFx);
}

function selDrawRect(cx,W,H,r,fill,stroke){
  for (let y=r.y0;y<=r.y1;y++) for (let x=r.x0;x<=r.x1;x++){
    if (x<0||y<0||x>=GW||y>=GH) continue;
    const [sx,sy]=screenOf(x,y,W,H);
    tileDiamond(cx,sx,sy,fill,stroke);
  }
}
function selMetricLabel(n){
  const inches=n*TILE_IN;
  if (inches<24) return `${inches} in`;
  const feet=inches/12;
  return `${Number.isInteger(feet)?feet:feet.toFixed(1)} ft`;
}
function drawSelMetricLabel(cx,x,y,label){
  cx.font='700 11px "IBM Plex Sans", sans-serif';
  cx.textAlign='center';
  cx.textBaseline='middle';
  cx.lineWidth=4;
  cx.strokeStyle='rgba(243,236,221,0.9)';
  cx.fillStyle='#172733';
  cx.strokeText(label,x,y);
  cx.fillText(label,x,y);
}
function drawSelDimLine(cx,a,b,label,side){
  const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
  if (len<4) return;
  const ux=dx/len, uy=dy/len, nx=-dy/len, ny=dx/len;
  const off=20*side, tick=7, labelOff=13*side;
  const ax=a[0]+nx*off, ay=a[1]+ny*off;
  const bx=b[0]+nx*off, by=b[1]+ny*off;
  cx.save();
  cx.strokeStyle='#72c9ff';
  cx.lineWidth=3;
  cx.lineCap='round';
  cx.lineJoin='round';
  cx.beginPath();
  cx.moveTo(a[0]+nx*4*side,a[1]+ny*4*side); cx.lineTo(ax,ay);
  cx.moveTo(b[0]+nx*4*side,b[1]+ny*4*side); cx.lineTo(bx,by);
  cx.moveTo(ax,ay); cx.lineTo(bx,by);
  cx.moveTo(ax-nx*tick,ay-ny*tick); cx.lineTo(ax+nx*tick,ay+ny*tick);
  cx.moveTo(bx-nx*tick,by-ny*tick); cx.lineTo(bx+nx*tick,by+ny*tick);
  cx.stroke();

  if (label){
    const tx=(ax+bx)/2+nx*labelOff, ty=(ay+by)/2+ny*labelOff;
    drawSelMetricLabel(cx,tx,ty,label);
  }
  cx.restore();
}
function drawSelectionMetrics(cx,W,H,r){
  const w=r.x1-r.x0+1, h=r.y1-r.y0+1;
  if (w<=0||h<=0) return;
  const a=screenOf(r.x0-0.5,r.y0-0.5,W,H);
  const b=screenOf(r.x1+0.5,r.y0-0.5,W,H);
  const c=screenOf(r.x1+0.5,r.y1+0.5,W,H);
  const d=screenOf(r.x0-0.5,r.y1+0.5,W,H);
  const wLabel=selMetricLabel(w), hLabel=selMetricLabel(h);
  const wLen=Math.hypot(c[0]-d[0],c[1]-d[1]);
  const hLen=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const compact=Math.min(wLen,hLen)<120;
  drawSelDimLine(cx,d,c,compact?null:wLabel,1);
  drawSelDimLine(cx,b,c,compact?null:hLabel,-1);
  if (compact){
    const cx0=(a[0]+b[0]+c[0]+d[0])/4, cy0=(a[1]+b[1]+c[1]+d[1])/4;
    drawSelMetricLabel(cx,cx0,cy0-18,w===h?`${wLabel} each side`:`${wLabel} x ${hLabel}`);
  }
}
function drawSelectionOverlay(cx,W,H,t,season,sway){
  if (selDrag){                                    // dragging out a marquee
    const r=normRect({x:selDrag.x0,y:selDrag.y0},{x:selDrag.x1,y:selDrag.y1});
    selDrawRect(cx,W,H,r,'rgba(120,195,255,0.22)','rgba(150,210,255,0.95)');
    drawSelectionMetrics(cx,W,H,r);
    return;
  }
  if (!game.sel) return;
  if (selMove){                                    // moving/copying: ghost + valid/invalid tiles
    const dx=selMove.curX-selMove.grabX, dy=selMove.curY-selMove.grabY;
    const items=game.selItems||[];
    selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.12)','rgba(150,210,255,0.45)');
    for (const c of items){
      const nx=c.x+dx, ny=c.y+dy, ok=selItemValidDest(c,nx,ny);
      const [sx,sy]=screenOf(nx,ny,W,H);
      tileDiamond(cx,sx,sy, ok?'rgba(120,210,130,0.28)':'rgba(220,90,70,0.42)',
        ok?'rgba(150,235,150,0.7)':'rgba(240,120,100,0.85)');
    }
    cx.save(); cx.globalAlpha=0.55;
    for (const c of items){
      const nx=c.x+dx, ny=c.y+dy; if (!selValidDest(nx,ny)) continue;
      const [sx,sy]=screenOf(nx,ny,W,H);
      if (c.fence) drawFence(cx,W,H,season,c.fence,nx,ny);
      if (c.light) drawLightFixture(cx,W,H,season,c.light,nx,ny,game.layerVis.night);
      if (c.firepit) drawFirepit(cx,W,H,season,c.firepit,nx,ny);
      if (c.bulb) drawPlant(cx,sx,sy+TILE_H/2,c.bulb.s,plantGrowth(c.bulb),season,(tileSeed(nx,ny)^0x9e37)>>>0,sway,c.bulb.v);
      if (c.plant) drawPlant(cx,sx,sy+TILE_H/2,c.plant.s,plantGrowth(c.plant),season,tileSeed(nx,ny),sway,c.plant.v);
    }
    cx.restore();
    return;
  }
  selDrawRect(cx,W,H,game.sel,'rgba(120,195,255,0.20)','rgba(150,210,255,0.95)'); // resting selection
  drawSelectionMetrics(cx,W,H,game.sel);
}
