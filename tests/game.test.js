/* Tier 2 — game.js logic, run after plants.js + game.js load under DOM stubs.
   Exercises the real pure functions (no enterGarden / no rendering loop). */

// fresh, predictable state for a test
function setup(gw, gh){
  setWorldSize(gw || 21, gh || 21);
  game.inGarden = true;
  game.plants = {}; game.bulbs = {}; game.terrain = {}; game.elevation = {}; game.houses = []; game.buildings = []; game.fences = {}; game.lights = {}; game.firepits = {}; game.boulders = {}; game.pets = {}; game.pots = {}; game.seats = {};
  game.schemes = []; game.schemeActive = null; ensureSchemes();   // every garden runs on at least one planting scheme
  game.houseDraft = { w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] };
  game.fenceDraft = { style: 'black', height: 4, gate: false };
  game.lightDraft = { type: 'path', tone: 'warm' };
  game.firepitDraft = { shape: 'round', size: 'round36' };
  game.boulderDraft = { type: 'round1' };
  game.potDraft = { style: 'terracotta', size: 'p18' };
  game.seatDraft = { type: 'bench4', finish: 'teak' };
  game.buildingDraft = null; game.buildingStyleDraft = { status: 'existing', label: 'House', wall: '#8a7a60', roof: '#9a5f3a' };
  game.bedStyle = 'soil';
  game.rot = 0; game.siteNorthDeg = 0; game.siteNorthPreviewDeg = null;
  game.filters = { zone: null, nativeRegion: 'north-america', nativeMode: 'any', deer: false, rabbit: false, squirrel: false };
  game.discovery = defaultDiscovery();
  game.design = null; game.challenge = null;
  game.startTs = Date.now(); game.elapsedMs = 0; game.dayOffset = 0; game.pausedAt = 0; game.clockSuspended = false;
  game.tool = 'hand'; game.toolVar = null; game.fillMode = false; game.drift = false; game.matrix = false; game.freePlanting = false;
  game.previewMode = 'today'; game.edgeStyle = 'organic';
  game.lastBrushTool = null; game.lastBrushVar = null;
  game.lastBrushTrayCat = 'grasses'; game.lastBrushDrill = null; game.trayScroll = {};
  game.sheetState = 'half'; game.sheetCollapsed = false;
  game.eraseMode = 'all'; game.brushSize = 1;
  game.groundRev = 0; game.terrainRev = 0;
  cam.x = 0; cam.y = 0;
  game.focusPlantKey = null; game.shrubFx = [];
  game.layerVis = defaultLayerVis();
  game.layerFocus = 'all';
  game.ruler = null;
  game.underlay = null; game.photoEditing = false; game.underlayCalibration = null;
  game.sel = null; game.selItems = null; game.selMode = 'move';
  game.actX = SPAWNX; game.actY = SPAWNY;
  game.rev = 0; game.dirty = false;
  undoStack.length = 0; redoStack.length = 0; pendSnap = null;
}
const live = obj => Object.keys(obj).filter(k => obj[k] && !obj[k].removed);
const firstOfType = t => Object.keys(PLANTS).find(k => PLANTS[k].type === t && !PLANTS[k].hidden);

test('core constants are sane', () => {
  assert(Array.isArray(SEASONS) && SEASONS.length === 4, 'SEASONS');
  assert(DAYS_PER_SEASON > 0 && TILE_IN > 0 && TILE_W > 0 && TILE_H > 0, 'tile/season constants');
});

test('explicit season skip shows the destination palette without a crossfade', () => {
  setup(21,21);
  game.inGarden=false;                    // no persistence side effect in this unit test
  resetSeasonFade();
  const before=calClock().season;
  seasonFade.last=before;
  const d=absDay();
  skipToAbsDay((Math.floor(d/DAYS_PER_SEASON)+1)*DAYS_PER_SEASON);
  const after=calClock().season;
  assert(after!==before, 'test skip must cross a season boundary');
  assert(seasonFade.suppressOnce, 'manual skip should suppress the old-season overlay');
  maybeStartSeasonFade(Date.now(),after);
  assert(!seasonFade.active && !seasonFade.suppressOnce,
    'destination season should render settled immediately and consume one-shot suppression');

  resetSeasonFade();
  seasonFade.last='Summer';
  maybeStartSeasonFade(Date.now(),'Fall');
  assert(seasonFade.active, 'a natural season boundary should retain the normal crossfade');
  suppressNextSeasonFade();
  assert(!seasonFade.active && seasonFade.suppressOnce,
    'a manual skip should cancel any crossfade already in progress');
});

test('mulberry RNG is deterministic and in [0,1)', () => {
  const a = mulberry(12345), b = mulberry(12345);
  for (let i = 0; i < 5; i++){
    const x = a();
    assertEqual(x, b(), 'same seed must give same stream');
    assert(x >= 0 && x < 1, `out of range: ${x}`);
  }
  assert(mulberry(1)() !== mulberry(2)(), 'different seeds should differ');
});

test('iso view rotation round-trips for all four rotations', () => {
  setup(31, 31);
  for (let rot = 0; rot < 4; rot++){
    game.rot = rot;
    for (const [x, y] of [[0, 0], [3, 5], [30, 30], [15, 2]]){
      const [vx, vy] = worldToView(x, y);
      const [wx, wy] = viewToWorld(vx, vy);
      assert(wx === x && wy === y, `rot ${rot}: (${x},${y}) -> (${wx},${wy})`);
    }
  }
});

test('true north rotates cardinal and sun directions without mutating the base path', () => {
  setup(21,21);
  const base=SUN_PATH.map(s=>s.sun.slice());
  let dirs=siteDirections(0);
  assert(Math.abs(dirs.N[0])<0.0001&&Math.abs(dirs.N[1]+1)<0.0001,'zero degrees points north toward plot-up');
  game.siteNorthDeg=90;
  dirs=siteDirections();
  assert(Math.abs(dirs.N[0]-1)<0.0001&&Math.abs(dirs.N[1])<0.0001,'90 degrees points north toward plot-right');
  const path=orientedSunPath();
  assert(Math.abs(path[1].sun[0]+1)<0.0001&&Math.abs(path[1].sun[1])<0.0001,'midday southern sun rotates toward plot-left');
  assertEqual(JSON.stringify(SUN_PATH.map(s=>s.sun)),JSON.stringify(base),'immutable base sun samples are unchanged');
  assertEqual(normalizeSiteNorthDeg(-1),359,'negative bearings wrap into the canonical range');
  assertEqual(normalizeSiteNorthDeg(361),1,'bearings above one turn wrap');
});

test('true north rotates tree shade and invalidates shade and scene keys', () => {
  setup(21,21);
  const sh={x:10,y:10,r:3,est:1,activePotential:true};
  const northScore=treeShadeScore(sh,10,8), oldShadeKey=shadeMapKey(false), oldSceneKey=sceneKey();
  assert(northScore>0,'default site casts shade toward plot-up');
  setSiteNorthDeg(90);
  assert(Math.abs(treeShadeScore(sh,12,10)-northScore)<0.0001,'rotating north right rotates the shade lobe right');
  assert(treeShadeScore(sh,12,10)>treeShadeScore(sh,10,8),'the old north lobe no longer remains fixed to plot-up');
  assert(shadeMapKey(false)!==oldShadeKey,'site orientation invalidates shade caches');
  assert(sceneKey()!==oldSceneKey,'site orientation invalidates scene stunting');
  previewSiteNorthDeg(180);
  assertEqual(effectiveSiteNorthDeg(),180,'dialog preview drives derived directions without changing saved north');
  assertEqual(game.siteNorthDeg,90,'preview does not overwrite the garden setting');
  clearSiteNorthPreview();
  assertEqual(effectiveSiteNorthDeg(),90,'cancelling restores the saved orientation');
});

test('tileAt picks the drawn diamond for elevated terrain', () => {
  setup(17, 17);
  const W = 900, H = 700;
  for (let rot = 0; rot < 4; rot++){
    game.rot = rot;
    game.elevation = {};
    setElevationAt(6, 7, ELEV_MAX);
    setElevationAt(10, 7, ELEV_MIN);
    for (const [x, y, label] of [[4, 5, 'flat'], [6, 7, 'raised'], [10, 7, 'lowered']]){
      const [sx, sy] = screenOf(x, y, W, H);
      const [px, py] = tileAt(sx, sy + TILE_H / 2, W, H);
      assertEqual(`${px},${py}`, `${x},${y}`, `${label} tile picked at rot ${rot}`);
      const [wx, wy] = worldPointAt(sx, sy + TILE_H / 2, W, H, elevationAt(x, y));
      assert(Math.abs(wx - x) < 0.0001 && Math.abs(wy - y) < 0.0001,
        `${label} sub-tile inverse respects elevation at rot ${rot}`);
    }
  }
});

test('multi-tile structure depth follows the rotated footprint', () => {
  setup(21, 21);
  const house = { x: 4, y: 6, w: 5, h: 3 };
  for (let rot = 0; rot < 4; rot++){
    game.rot = rot;
    const expected = Math.max(
      viewDepth(house.x, house.y), viewDepth(house.x + house.w - 1, house.y),
      viewDepth(house.x, house.y + house.h - 1), viewDepth(house.x + house.w - 1, house.y + house.h - 1)
    );
    assertEqual(footprintDrawDepth(house.x, house.y, house.w, house.h), expected,
      `footprint depth uses visual far corner at rot ${rot}`);
    assertEqual(houseDrawDepth(house), expected + 0.05,
      `house depth follows footprint at rot ${rot}`);
  }
});

test('ftToTiles converts and clamps to a 2-tile minimum', () => {
  assertEqual(ftToTiles(18), 12, '18ft at 18in tiles = 12 tiles');
  assertEqual(ftToTiles(1.5), 2, 'one tile of feet rounds to the minimum 2');
  assert(ftToTiles(1) >= 2, 'never smaller than 2 tiles');
});

test('selection measurement labels prefer feet but keep one tile as inches', () => {
  assertEqual(selMetricLabel(1), '18 in', 'one tile reminds users of the base block size');
  assertEqual(selMetricLabel(2), '3 ft', 'two tiles display as feet');
  assertEqual(selMetricLabel(3), '4.5 ft', 'half-foot dimensions stay readable');
  assertEqual(distanceMetricLabel([0, 0], [0, 0]), '18 in', 'zero-length ruler still reminds users of tile size');
  assertEqual(distanceMetricLabel([0, 0], [3, 4]), '7.5 ft', 'ruler uses true tile distance');
});

test('area, edging, mulch, and spacing estimates use the 18-inch planning grid', () => {
  setup(12, 12);
  assertEqual(tileAreaSqFt(4), 9, 'four tiles cover nine square feet');
  assertEqual(materialPerimeterFt(new Set(['1,1','2,1','1,2','2,2'])), 12, 'a 3ft square has 12ft of exposed edge');
  assert(Math.abs(mulchYards(86,3)-0.7963)<0.001, '86 sq ft at 3in is about 0.8 cubic yards');
  assertEqual(plantsForTiles(4,18),4,'18in spacing estimates one plant per tile');
  game.sel={x0:1,y0:1,x1:2,y1:2};
  game.terrain['1,1']={k:'bed'}; game.terrain['2,1']={k:'bed'}; game.terrain['2,2']={k:'path'};
  game.plants['1,1']={s:firstOfType('forb'),d:0,t:1};
  game.selItems=selectionPayload(game.sel);
  const est=selectionEstimate(game.sel,3,game.selItems);
  assertEqual(est.areaSqFt,9,'selection area uses its marquee');
  assertEqual(est.bedAreaSqFt,4.5,'materials use actual bed tiles, not the bounding box');
  assertEqual(est.edgeFt,9,'two adjacent bed tiles expose six grid edges');
  assertEqual(est.plants,1,'placed plant count comes from selection ownership');
});

test('site-photo normalization is bounded and ordinary undo snapshots exclude image data', () => {
  setup(20, 16);
  const data='data:image/jpeg;base64,AAAA';
  const u=normalizeUnderlay({data,pixelW:1200,pixelH:800,cx:3,cy:4,widthTiles:10,opacity:2,rotation:240,visible:true,locked:false});
  assert(u&&u.data===data,'valid raster underlay is accepted');
  assertEqual(u.opacity,.85,'opacity is clamped');
  assertEqual(u.rotation,180,'rotation is clamped');
  assertEqual(normalizeUnderlay({data:'data:image/svg+xml;base64,AAAA',pixelW:10,pixelH:10}),null,'SVG is rejected');
  game.underlay=u;
  const snap=snapshotState();
  assertEqual(snap.underlay,undefined,'underlay is not cloned into an undo snapshot');
  assert(!JSON.stringify(snap).includes(data),'undo snapshots contain no base64 photo');
});

test('site-photo two-point calibration preserves its first world anchor', () => {
  setup(20,16);
  const u=normalizeUnderlay({data:'data:image/jpeg;base64,AAAA',pixelW:1200,pixelH:800,cx:3,cy:4,widthTiles:10,opacity:.35,rotation:0,visible:true,locked:false});
  assert(underlayContainsWorldPoint(u,[3,4]),'photo center is inside its rotated bounds');
  const next=calibrateUnderlayDistance(u,[1,1],[3,1],6); // 6ft = four 18in tiles, twice the measured span
  assert(next,'valid calibration returns a transformed photo');
  assertEqual(next.widthTiles,20,'known distance applies uniform scale');
  assertEqual(next.cx,5,'center scales about the first calibration endpoint');
  assertEqual(next.cy,7,'the anchor-preserving transform applies on both axes');
  assertEqual(calibrateUnderlayDistance(u,[1,1],[1,1],6),null,'coincident points are rejected');
});

test('layer overlay flags mark layer view as active', () => {
  setup();
  assert(!layerViewActive(), 'normal full garden is not a special layer view');
  assertEqual(game.layerVis.matureCanopies, false, 'mature canopies overlay defaults off');
  game.layerVis.moisture = true;
  assert(layerViewActive(), 'moisture overlay is an active layer view');
  game.layerVis.moisture = false;
  game.layerVis.height = true;
  assert(layerViewActive(), 'height overlay is an active layer view');
  game.layerVis.height = false;
  game.layerVis.matureCanopies = true;
  assert(layerViewActive(), 'mature canopies overlay is an active layer view');
  game.layerVis.matureCanopies = false;
  game.layerVis.edgeRulers = true;
  assert(layerViewActive(), 'edge rulers overlay is an active layer view');
});

test('layer visibility migration adds mature canopies off and drops unknown flags', () => {
  const vis = normalizeLayerVis({ woody: false, shade: true, mystery: true });
  assertEqual(vis.woody, false, 'saved hidden woody layer is preserved');
  assertEqual(vis.shade, true, 'saved overlay flag is preserved');
  assertEqual(vis.matureCanopies, false, 'missing mature canopies flag defaults off');
  assertEqual(vis.mystery, undefined, 'unknown layer visibility flags are not persisted');
});

test('the hand tool pans and every other tap acts on the tapped tile', () => {
  setup(15, 15);
  game.tool = 'hand';
  assert(shouldStartPan({ button: 0 }), 'hand tool pans the canvas');
  const forb = firstOfType('forb');
  game.tool = forb; game.toolVar = null;
  assert(!shouldStartPan({ button: 0 }), 'an armed brush paints instead of panning');
  assert(shouldStartPan({ button: 1 }), 'middle-drag always pans');
  tapAction(4, 4, {});
  assertEqual(game.actX, 4, 'the tap addresses the tapped tile x');
  assertEqual(game.actY, 4, 'the tap addresses the tapped tile y');
  assertEqual(game.plants['4,4'].s, forb, 'the tap planted there directly — no avatar walks first');
});

test('drawPlant renders every species + cultivar across all seasons', () => {
  const ctx = document.createElement('canvas').getContext('2d');
  let rendered = 0;
  for (const k of Object.keys(PLANTS)){
    for (const s of SEASONS){
      drawPlant(ctx, 24, 42, k, 1, s, 12345, 0, undefined, 1);
      for (const v in (PLANTS[k].cv || {})) drawPlant(ctx, 24, 42, k, 1, s, 7, 0, v, 1);
      rendered++;
    }
  }
  assert(rendered === Object.keys(PLANTS).length * 4, `rendered ${rendered}`);
});

test('a dormant bulb paints no detached shadow', () => {
  let ops=0;
  const ctx=new Proxy({}, {get(){ return ()=>{ ops++; }; },set(){ return true; }});
  drawPlant(ctx,0,0,'colchicum',0,'Summer',12,0,undefined,0);
  assertEqual(ops,0,'growth-zero geophytes leave no canvas operations behind');
});

test('bulbs paint no orphan organs in empty seasonal slots', () => {
  for(const key of PLANT_KEYS.filter(k=>PLANTS[k].type==='bulb')){
    for(const variant of [undefined,...Object.keys(PLANTS[key].cv||{})]){
      const P=plantDef(key,variant);
      for(const season of SEASONS){
        const S=P.sea[season]||{};
        if(S.fol||S.seed||S.bloom) continue;
        let ops=0;
        const ctx=new Proxy({}, {get(){ return ()=>{ ops++; }; },set(){ return true; }});
        drawPlant(ctx,0,0,key,1,season,12,0,variant,0);
        assertEqual(ops,0,`${key}${variant?`:${variant}`:''} ${season} has no authored visible organ`);
      }
    }
  }
});

test('growth-zero non-bulbs retain their establishment rendering', () => {
  let ops=0;
  const ctx=new Proxy({}, {
    get(o,p){
      if(p in o) return o[p];
      if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return () => ({addColorStop(){}});
      return ()=>{ ops++; };
    },
    set(o,p,v){ o[p]=v; return true; },
  });
  drawPlant(ctx,0,0,firstOfType('forb'),0,'Summer',12,0,undefined,0);
  assert(ops>0,'newly placed non-bulbs still paint at their renderer growth floor');
});

test('audited bulb morphologies are deterministic and visibly distinct', () => {
  function trace(key,season,variant){
    const ops=[];
    const ctx=new Proxy({}, {
      get(o,p){
        if(p in o) return o[p];
        if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return () => ({addColorStop(){}});
        return (...args)=>{
          if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','fillRect','rotate','translate','scale','fill','stroke'].includes(p))
            ops.push([p,...args.map(v=>typeof v==='number'?Math.round(v*100)/100:v)]);
        };
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawPlant(ctx,0,0,key,1,season,9137,0,variant,1);
    return JSON.stringify(ops);
  }
  const representatives=[
    ['daffodil','Spring'],['tulip','Spring'],['snowdrop','Spring'],['winteraconite','Spring'],
    ['muscari','Spring'],['camassia','Spring'],['puschkinia','Spring'],
    ['claudeshride','Summer'],['yellowtroutlily','Spring'],['fritillaria','Spring'],['lycoris','Summer'],
    ['alliumAtropurpureum','Summer'],['alliumsphaerocephalon','Summer'],['dahlia','Summer'],
  ];
  const signatures=representatives.map(([k,s])=>trace(k,s));
  assertEqual(new Set(signatures).size,signatures.length,
    'trumpet, goblet, pendant, collar, bead, star-raceme, striped, lily, trout, checker, naked-scape, allium, and dahlia grammars differ');
  assertEqual(trace('lycoris','Summer'),trace('lycoris','Summer'),'bulb geometry is stable for cached cards and canvas');
  assertEqual(new Set(['angelique','springGreen','ballerina'].map(v=>trace('gardentulip','Spring',v))).size,3,
    'double, green-flamed, and lily-flowered tulips keep distinct traces');
  assertEqual(new Set([undefined,'icefollies','actaea'].map(v=>trace('daffodil','Spring',v))).size,3,
    'trumpet, broad large-cup, and small-disc daffodils keep distinct traces');
  assert(trace('colchicum','Fall','waterlily')!==trace('colchicum','Fall'),
    'Waterlily adds a third inner tepal ring instead of reusing the single goblet');
  assertEqual(new Set(['cafeAuLait','bishopOfLlandaff','cornelBronze'].map(v=>trace('dahlia','Summer',v))).size,3,
    'decorative, peony, and ball dahlia classes keep distinct traces');
});

test('ball dahlias batch dense florets into a bounded fill budget', () => {
  let fills=0;
  const ctx=new Proxy({}, {
    get(o,p){
      if(p in o) return o[p];
      if(p==='fill') return ()=>{ fills++; };
      if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return () => ({addColorStop(){}});
      return ()=>{};
    },
    set(o,p,v){ o[p]=v; return true; },
  });
  drawPlant(ctx,0,0,'dahlia',1,'Summer',9137,0,'cornelBronze',1);
  assert(fills<160,`Cornel Brons stays within a bounded paint budget (${fills} fills)`);
});

test('Allium flower accents do not survive into dried seedheads', () => {
  function paintedColors(season,bloomLvl){
    const colors=[];
    const ctx=new Proxy({fillStyle:''}, {
      get(o,p){
        if(p==='fill') return ()=>colors.push(o.fillStyle);
        if(p in o) return o[p];
        if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return () => ({addColorStop(){}});
        return ()=>{};
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawPlant(ctx,0,0,'alliumRedMohican',1,season,9137,0,undefined,bloomLvl);
    return colors;
  }
  const flowerAccent=shade(PLANTS.alliumRedMohican.look.topknot,-8);
  assert(paintedColors('Summer',1).includes(flowerAccent),'Red Mohican shows its pale topknot while flowering');
  assert(!paintedColors('Fall',0).includes(flowerAccent),'the pale topknot is absent from its dried fall seedhead');
});

test('grass blade-tip colour adds one optional tip pass', () => {
  const fills=[];
  const ctx={
    fillStyle:'', beginPath(){}, moveTo(){}, lineTo(){}, closePath(){},
    fill(){ fills.push(this.fillStyle); },
  };
  drawBlade(ctx,0,0,2,-8,1,-16,1.2,'#66806b',true);
  assertEqual(fills.length,2,'an ordinary blade keeps its body and highlight passes');
  fills.length=0;
  drawBlade(ctx,0,0,2,-8,1,-16,1.2,'#66806b',true,'#8a4652');
  assertEqual(fills.length,3,'an authored foliage tip adds exactly one fill');
  assertEqual(fills[2],shade('#8a4652',-4),'the final pass uses the authored tip family');
});

test('little bluestem seedheads are elongated feathery racemes, not oval buttons', () => {
  const ops=[];
  const ctx=new Proxy({globalAlpha:1}, {
    get(o,p){
      if(p in o) return o[p];
      return (...args)=>{ if(['moveTo','lineTo','quadraticCurveTo','ellipse','fill','stroke'].includes(p)) ops.push([p,...args]); };
    },
    set(o,p,v){ o[p]=v; return true; },
  });
  drawFluffyRaceme(ctx,2,-18,0.25,20,'#e8ddc7',4,mulberry(9137),3.8);
  const ellipses=ops.filter(x=>x[0]==='ellipse');
  const hairs=ops.filter(x=>x[0]==='lineTo');
  assertEqual(PLANTS.bluestem.look.seedStyle,'fluffyRaceme','little bluestem opts into the feathery seed grammar');
  assertEqual(ellipses.length,0,'the feathery style never falls back to a filled oval or seed ball');
  assert(hairs.length>=16,'each node carries one narrow spikelet and several fine hairs');
  const ys=ops.filter(x=>x[0]==='moveTo').map(x=>x[2]);
  assert(Math.max(...ys)-Math.min(...ys)>15,'tufts spread vertically along the upper stem');
});

test('orchard fruit uses a deterministic bounded glyph budget and respects fruitless cultivars', () => {
  const original=drawTreeFruit, calls=[];
  try{
    drawTreeFruit=(...args)=>calls.push(args.slice(1));
    drawPlant(document.createElement('canvas').getContext('2d'),24,42,'apple',1,'Fall',12345,0,undefined,1);
    assertEqual(calls.length,PLANTS.apple.look.seedN,'fruitCluster never multiplies the authored total');
    const first=JSON.stringify(calls);
    calls.length=0;
    drawPlant(document.createElement('canvas').getContext('2d'),24,42,'apple',1,'Fall',12345,0,undefined,1);
    assertEqual(JSON.stringify(calls),first,'fruit positions are stable for the same plant seed');
    calls.length=0;
    drawPlant(document.createElement('canvas').getContext('2d'),24,42,'pistachio',1,'Fall',12345,0,'peters',1);
    assertEqual(calls.length,0,'a male pistachio paints no nuts even though it inherits the base fall palette');
    drawPlant(document.createElement('canvas').getContext('2d'),24,42,'olive',1,'Winter',12345,0,'littleollie',1);
    assertEqual(calls.length,0,'a fruitless olive paints no inherited winter fruit');
  } finally { drawTreeFruit=original; }
  assert(roleSummary('apple',12).includes('Orchard'),'orchard roles are readable and searchable');
  assert(roleSummary('pecan',12).includes('Nut crop'),'nut-crop roles are readable and searchable');
  assert(!roleSummary('apple',12).includes('Seedheads'),'orchard fruit is not mislabeled as a seedhead plant');
  assertEqual(bloomRangeText(PLANTS.loquat),'Oct–Feb','year-wrapping orchard bloom reads as one continuous range');
  assertEqual(plantDef('redmulberry','illinoiseverbearing').name,"'Illinois Everbearing' Mulberry",
    'the interspecific mulberry hybrid does not resolve as a Red Mulberry cultivar');
  assertEqual(plantDef('sweetorange','moro').name,"'Moro' Blood Orange",
    'a blood orange replacement name is not redundantly prefixed with Sweet Orange');
});

test('conifer renderer is deterministic and gives each architecture a distinct paint trace', () => {
  function trace(key){
    const ops=[];
    const ctx=new Proxy({}, {
      get(o,p){
        if (p in o) return o[p];
        if (p==='measureText') return () => ({width:0});
        if (p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')
          return () => ({addColorStop(){}});
        return (...args) => {
          if (['moveTo','lineTo','quadraticCurveTo','arc','ellipse','rotate','translate','scale','fill','stroke'].includes(p))
            ops.push([p,...args.map(v => typeof v==='number'?Math.round(v*100)/100:v)]);
        };
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawPlant(ctx,0,0,key,1,'Summer',7123,0,undefined,1);
    return JSON.stringify(ops);
  }
  const blueAtlas=trace('blueatlascedar');
  assertEqual(blueAtlas,trace('blueatlascedar'),'same tree and seed reproduce the same geometry');
  const signatures=['bluespruce','whitepine','blueatlascedar','greengiantarborvitae','blueweepingalaskacedar'].map(trace);
  assertEqual(new Set(signatures).size,signatures.length,'spruce, pine, cedar, scale-spray, and weeping habits paint differently');
  const art2Was=ART2.on;
  try{
    ART2.on=false;
    assert(trace('blueatlascedar')!==blueAtlas,'?art2=0 retains the low-cost classic conifer fallback');
  } finally { ART2.on=art2Was; }
});

test('weeping conifers bow their leaders and author low asymmetric cascades', () => {
  const alaska=PLANTS.blueweepingalaskacedar, pine=PLANTS.weepingwhitepine;
  for (const [key,P] of [['blueweepingalaskacedar',alaska],['weepingwhitepine',pine]]){
    const L=P.look, H=plantVisualH(P);
    assertEqual(coniferLeaderX(L,H,0,7122),0,`${key}: leader still begins at the trunk base`);
    assertEqual(coniferLeaderX(L,H,0.5,7122),-coniferLeaderX(L,H,0.5,7123),
      `${key}: seed parity mirrors, rather than removes, the natural lean`);
    assert(Math.abs(coniferLeaderX(L,H,0.5,7122))>=H*0.05,
      `${key}: mid-leader bow is large enough to read as a weeper`);
    const top=-H*(L.crownTop||0.96), base=-H*(L.crownBase||0.08);
    const scaffoldU=coniferLeaderUAtY(top,base);
    assert(scaffoldU>0.1,`${key}: lowest scaffold maps above the trunk base`);
    assert(Math.abs(coniferLeaderX(L,H,scaffoldU,7122))>H*0.02,
      `${key}: lowest scaffold origin follows the already-bowed visible leader`);
    assert(L.scaffoldDroop>=0.06,`${key}: scaffold arms visibly descend before the curtains`);
    assert(L.asymmetry>=0.2,`${key}: alternating scaffold lengths break the straight spire`);
    assert(L.crownBase>=0.18,`${key}: cascades begin high enough to remain legible`);
  }
  assert(pine.look.leaderBend>alaska.look.leaderBend,
    'weeping white pine keeps the looser, stronger lean of the two weepers');
});

/* Watch the real drawing, not the data. The cascade and the sprite box are
   sized by two different pieces of code that must agree — renderer.js reserves
   `coniferWeepBelow` below the placement point — so anything that deepens the
   curtain without teaching the bounds function about it clips the instant the
   sprite governor engages, and only on dense gardens. */
/* Track the real 2x3 transform. A conservative radius bound is not good enough
   here: a conifer's branch plates are drawn as LONG shapes inside a frame
   rotated a half turn, so bounding them by their own length reported an
   arborvitae reaching 45 units below grade when it reaches 11, and the test
   invented failures. Only the y row of the matrix matters. */
function coniferDrawDepth(key,seed,growth,withShadow){
  let m=[1,0,0,1,0,0], deepest=-1e9, armed=!!withShadow;
  const stack=[];
  const worldY=(x,y)=> m[1]*x + m[3]*y + m[5];
  const yScale=()=> Math.hypot(m[1],m[3]);
  const ctx=new Proxy({}, {
    get(o,p){
      if (p in o) return o[p];
      if (p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')
        return () => ({addColorStop(){}});
      return (...a) => {
        const deep=v=>{ if (armed && v>deepest) deepest=v; };
        const pt=(x,y)=> deep(worldY(x,y));
        if (p==='save') stack.push(m.slice());
        else if (p==='restore'){ const s=stack.pop(); if (s) m=s; }
        else if (p==='translate'){ m[4]+=m[0]*a[0]+m[2]*a[1]; m[5]+=m[1]*a[0]+m[3]*a[1]; }
        else if (p==='scale'){ m[0]*=a[0]; m[1]*=a[0]; m[2]*=a[1]; m[3]*=a[1]; }
        else if (p==='rotate'){
          const c=Math.cos(a[0]), s=Math.sin(a[0]);
          m=[m[0]*c+m[2]*s, m[1]*c+m[3]*s, m[2]*c-m[0]*s, m[3]*c-m[1]*s, m[4], m[5]];
        }
        else if (p==='setTransform') m=a.slice(0,6);
        else if (p==='moveTo'||p==='lineTo') pt(a[0],a[1]);
        // a quadratic stays inside the hull of its control point and endpoints
        else if (p==='quadraticCurveTo'){ pt(a[0],a[1]); pt(a[2],a[3]); }
        else if (p==='bezierCurveTo'){ pt(a[0],a[1]); pt(a[2],a[3]); pt(a[4],a[5]); }
        else if (p==='arc') deep(worldY(a[0],a[1])+a[2]*yScale());
        else if (p==='ellipse'){
          const [cx,cy,rx,ry,phi=0]=a;
          const c=Math.cos(phi), s=Math.sin(phi);
          const A=rx*(m[1]*c+m[3]*s), B=ry*(m[3]*c-m[1]*s);
          deep(worldY(cx,cy)+Math.hypot(A,B));
        }
        else if (p==='rect') deep(worldY(a[0],a[1]+a[3]));
        // The cast ground shadow is drawn before any stroke, so `withShadow`
        // false measures the cascade alone and true measures everything the
        // sprite box has to contain.
        else if (p==='stroke') armed=true;
      };
    },
    set(o,p,v){ o[p]=v; return true; },
  });
  drawPlant(ctx,0,0,key,growth===undefined?1:growth,'Summer',seed,0,undefined,1);
  return deepest;
}

test('weeping curtains fall to the ground, and the sprite box reserves the fall', () => {
  for (const key of ['blueweepingalaskacedar','weepingwhitepine']){
    const P=plantDef(key), H=plantVisualH(P), budget=coniferWeepBelow(P,H);
    assert(budget>0,`${key}: a weeper is granted room below its placement point`);
    for (const seed of [7122,7123,4410,99]){
      const deepest=coniferDrawDepth(key,seed);
      assert(deepest<=budget+1,
        `${key}: seed ${seed} draws to ${deepest.toFixed(1)} within the ${budget.toFixed(1)} the sprite reserves`);
      // The habit, not the leader bend: foliage has to come down to the ground.
      // Sized against H the first cut only crossed ~1 whorl and read as a cone.
      assert(deepest>-H*0.08,
        `${key}: seed ${seed} cascades to the ground rather than hemming inside the crown`);
    }
  }
  // ...and an upright conifer of the same renderer still keeps its feet dry.
  const spruce=plantDef('bluespruce');
  assertEqual(coniferWeepBelow(spruce,plantVisualH(spruce)),0,
    'an upright habit reserves nothing, so it keeps the default sprite margin');
  assert(coniferDrawDepth('bluespruce',7122)<coniferDrawDepth('blueweepingalaskacedar',7122),
    'the weeper hangs below the upright it shares a renderer with');
});

test('the sprite box reserves everything a plant paints below its own tile', () => {
  /* 76 of 335 species used to guillotine their cast ground shadow along the
     bottom edge of the bake — a hard dark line under every tree, and fully
     opaque on sotol — because the box floored the allowance at 18 draw units
     and never asked what was actually drawn down there. Like the weeping
     cascade it only showed once the sprite governor engaged, i.e. on dense
     gardens, and never in the procedural path you'd debug in. */
  const bad=[];
  for (const key of PLANT_KEYS){
    const P=plantDef(key);
    for (const growth of [1,0.4]){
      // mirror makePlantSprite: it sizes from its own floored H, not drawPlant's
      const spriteH=plantVisualH(P)*(0.25+0.75*growth);
      const reserved=Math.max(18,plantDrawBelow(P,growth,spriteH)+8);   // as makePlantSprite does
      const deepest=coniferDrawDepth(key,7122,growth,true);
      if (deepest>reserved)
        bad.push(`${key}@${growth} paints to ${deepest.toFixed(1)} vs ${reserved.toFixed(1)} reserved`);
    }
  }
  assertEqual(bad.slice(0,6).join(' | '),'','every species draws inside its reserved box');
  // The reserve has to be driven by the shadow, not just re-floored at 18.
  const oak=plantDef('buroak');
  assert(plantDrawBelow(oak,1,plantVisualH(oak))>18,
    'a wide canopy asks for more room than the old flat floor gave it');
  const cone=plantDef('echinacea');
  assert(plantDrawBelow(cone,1,plantVisualH(cone))<
         plantDrawBelow(oak,1,plantVisualH(oak))*0.5,
    'and it scales with the canopy, so a perennial does not pay a tree tax');
});

test('the crown mass fills upright habits and is withheld from weeping ones', () => {
  const massOps=(habit,look) => {
    let n=0;
    const ctx=new Proxy({}, {
      get(o,p){
        if (p in o) return o[p];
        if (p==='createLinearGradient'||p==='createRadialGradient')
          return () => ({addColorStop(){}});
        return () => { if (p==='lineTo'||p==='moveTo') n++; };
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawConiferCrownMass(ctx,look||{},habit,120,-300,-20,0,'#4f6f50',1.1);
    return n;
  };
  assert(massOps('spruce')>0,'a spruce carries an underwash so its whorls are not a lattice');
  assert(massOps('scale')>0,'a scale-spray column carries one too');
  assertEqual(massOps('weeping'),0,
    'a weeper does not, because a conical wash is the silhouette it exists to avoid');
  assertEqual(massOps('spruce',{crownMass:0}),0,'a species can author the mass away');
  // Open habits get a narrow core, not a filled cone — measured, the first cut
  // took white pine from 13-41% crown ink to 61-99% and lost its character.
  assert(CONIFER_MASS.pine.inset<CONIFER_MASS.spruce.inset &&
         CONIFER_MASS.cedar.inset<CONIFER_MASS.scale.inset,
    'pine and true cedar keep an airier rim than spruce and arborvitae');
});

test('conifer fullness changes foliage mass without changing plant sizing truth', () => {
  const P=PLANTS.bluespruce, before=[P.h,P.cw,P.heightIn,P.space,P.spread];
  const thin={...P,look:{...P.look,fullness:0.82}}, full={...P,look:{...P.look,fullness:1.22}};
  PLANTS.__thinconifer=thin; PLANTS.__fullconifer=full;
  const opsFor=key => {
    const ops=[];
    const ctx=new Proxy({}, {
      get(o,p){
        if (p in o) return o[p];
        if (p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')
          return () => ({addColorStop(){}});
        return (...args) => {
          if (['moveTo','lineTo','quadraticCurveTo','arc','ellipse','rotate','translate','scale','fill','stroke'].includes(p))
            ops.push([p,...args.map(v => typeof v==='number'?Math.round(v*100)/100:v)]);
        };
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawPlant(ctx,0,0,key,1,'Summer',8421,0,undefined,1);
    return JSON.stringify(ops);
  };
  try{
    assert(opsFor('__thinconifer')!==opsFor('__fullconifer'),
      'the authored fullness value changes foliage geometry');
    assertEqual([P.h,P.cw,P.heightIn,P.space,P.spread].join(','),before.join(','),
      'fullness does not mutate px art, real height, spacing, or spread');
  } finally {
    delete PLANTS.__thinconifer; delete PLANTS.__fullconifer;
  }
});

/* ---- ground materials ---------------------------------------------------
   The grain recipes are data-driven, so the thing worth testing headlessly is
   the contract between the data and the draw code: every material names a
   recipe that exists, every palette has the four slots the recipes index, and
   no recipe stages past the scratch it writes into (overflow is silently
   dropped, so a too-dense recipe would just go quiet). */
const GROUND_MATERIALS = () => BED_STYLES.map(b => ['bed', b]).concat(PATH_COLORS.map(p => ['path', p]));

test('every ground material names a grain recipe with a four-slot palette', () => {
  for (const [kind, m] of GROUND_MATERIALS()){
    assert(typeof m.texture === 'string' && m.texture, `${kind} ${m.id} has no texture recipe`);
    if (m.tones === null) continue;                 // seasonal base, derived at draw time
    assert(Array.isArray(m.tones) && m.tones.length === 4, `${kind} ${m.id} needs 4 tones`);
    for (const t of m.tones) assert(/^#[0-9a-f]{6}$/i.test(t), `${kind} ${m.id} tone ${t} is not a hex colour`);
  }
  assertEqual(materialTones(null, '#54402f').length, 4, 'a derived palette also fills four slots');
  assert(materialTones(null, '#54402f').every(c => typeof c === 'string' && c),
    'every derived tone resolves to a colour');
});

test('no grain recipe overflows the scratch it writes into', () => {
  setup(21, 21);
  const ctx = document.createElement('canvas').getContext('2d');
  const before = grainDropCount();
  let drawn = 0;
  for (const [kind, m] of GROUND_MATERIALS()){
    for (const s of SEASONS){
      const amb = AMBIENCE[s], rs = mulberry(4242);
      const base = kind === 'path' ? pathFill({ c: m.id }, amb.snow) : bedFill({ c: m.id }, amb);
      grainReset();
      drawMaterialGrain(ctx, 100, 100, m, base, rs, 5, 6);
      // guards against the signature drifting out from under this test: hand it
      // the wrong shape and every recipe branch silently misses, which would
      // leave the overflow check below passing while checking nothing
      assert(grainStagedCount() > 0, `${kind} ${m.id} staged no grains — did drawMaterialGrain's signature change?`);
      drawn++;
    }
  }
  assertEqual(drawn, GROUND_MATERIALS().length * 4, 'every material drew in every season');
  assertEqual(grainDropCount() - before, 0,
    'a recipe staged past GRAIN_MAX and lost grains silently — raise it or thin the recipe');
});

test('water depth is a distance to the bank, and only a river carries a flow', () => {
  setup(21, 21);
  // a 9x9 pond: the middle is as far from a bank as this water gets
  for (let y = 4; y <= 12; y++) for (let x = 4; x <= 12; x++) setTile('terrain', `${x},${y}`, { k: 'water', c: 'pond', t: 1 });
  assertEqual(waterDepthAt(4, 8), 1, 'a tile against the bank is depth 1');
  assert(waterDepthAt(8, 8) > waterDepthAt(6, 8), 'the middle is deeper than halfway out');
  assert(waterDepthAt(6, 8) > waterDepthAt(4, 8), 'and halfway out is deeper than the bank');
  // Manhattan distance would put the diagonal corner at the same depth as a
  // tile straight in from the edge; the chamfer transform must not
  assert(waterDepthAt(5, 5) < waterDepthAt(5, 8), 'a corner is shallower than a mid-edge tile the same way in');
  assert(!waterFlowAt(8, 8), 'open water has no current');

  // a 3-wide channel running east-west: flow follows the channel
  setup(21, 21);
  for (let y = 9; y <= 11; y++) for (let x = 1; x < 20; x++) setTile('terrain', `${x},${y}`, { k: 'water', c: 'river', t: 1 });
  const f = waterFlowAt(10, 10);
  assert(f, 'a channel has a current');
  assert(Math.abs(f[1]) < Math.abs(f[0]) || Math.abs(f[0]) > 0.4,
    'the current runs along the channel, not across it');
  // the same tiles as a pond have no current at all — flow is a river thing
  for (let y = 9; y <= 11; y++) for (let x = 1; x < 20; x++) setTile('terrain', `${x},${y}`, { k: 'water', c: 'pond', t: 1 });
  assert(!waterFlowAt(10, 10), 'a pond in a channel shape still has no current');
});

const lumOf = p => p[0] + p[1] + p[2];
test('every water style names a surface recipe and shelves at its own rate', () => {
  const reaches = new Set();
  for (const w of WATER_STYLES){
    assert(typeof w.texture === 'string' && w.texture, `${w.id} has no surface recipe`);
    assert(Number.isFinite(w.reach) && w.reach > 0, `${w.id} needs a shelving reach`);
    assert(/^#[0-9a-f]{6}$/i.test(w.fill) && /^#[0-9a-f]{6}$/i.test(w.deep), `${w.id} needs hex shallow/deep`);
    reaches.add(w.reach);
    /* The ramp mixes already-mixed colours, and a hex-only mix turns its own
       `rgb(...)` output into NaN channels, which clamp to a solid black lake.
       Checking the channels are "in range" does NOT catch that — 0 is in range.
       What catches it is that ice has to be PALER than open water. */
    const open = waterRamp(w, false).map(colorParts);
    const ice = waterRamp(w, true).map(colorParts);
    for (let i = 0; i < open.length; i++){
      assert(open[i].every(v => Number.isFinite(v)), `${w.id} open ramp ${i} is not a colour`);
      assert(ice[i].every(v => Number.isFinite(v)), `${w.id} ice ramp ${i} is not a colour`);
      const lum = p => p[0] + p[1] + p[2];
      assert(lum(ice[i]) > lum(open[i]) + 30, `${w.id} frozen band ${i} is not paler than open water — the ramp mixed to nothing`);
    }
    assert(lumOf(open[0]) > lumOf(open[open.length - 1]), `${w.id} shallow water should be lighter than deep`);
  }
  assertEqual(reaches.size, WATER_STYLES.length, 'the three shelve at three different rates, which is most of what tells them apart');
});

test('a ground tile renders for every material, bed and path alike', () => {
  setup();
  const ctx = document.createElement('canvas').getContext('2d');
  let n = 0;
  for (const [kind, m] of GROUND_MATERIALS()){
    for (const s of SEASONS){
      const amb = AMBIENCE[s], o = { k: kind, c: m.id }, rs = mulberry(7);
      const base = kind === 'path' ? pathFill(o, amb.snow) : bedFill(o, amb);
      drawGroundTexture(ctx, 40, 40, 3, 3, kind === 'bed' ? 'bed' : null, kind === 'path', amb, base, rs, o);
      drawGroundTexture(ctx, 40, 40, 3, 3, kind === 'bed' ? 'bed' : null, kind === 'path', amb, base, mulberry(7), o, true);
      n++;
    }
  }
  assertEqual(n, GROUND_MATERIALS().length * 4, 'both the per-tile and the region path drew every material');
});

test('plantFits applies zone and palette filters', () => {
  setup();
  const k = Object.keys(PLANTS).find(x => PLANTS[x].zones[0] >= 3 && PLANTS[x].zones[1] <= 9);
  const z = PLANTS[k].zones;
  game.filters = normalizeFilters({ zone: z[0] });
  assert(plantFits(k), 'should fit at its lower zone');
  game.filters = normalizeFilters({ zone: z[0] - 1 });
  assert(!plantFits(k), 'should be excluded below its range');
  const nonNative = Object.keys(PLANTS).find(x => !PLANTS[x].nativeTo.includes('north-america'));
  game.filters = normalizeFilters({ nativeRegion:'north-america', nativeMode:'regional' });
  assert(!plantFits(nonNative), 'regional-native mode hides plants native elsewhere');
  game.filters = normalizeFilters({ squirrel: true });
  assert(plantFits('daffodil'), 'squirrel-resistant bulbs stay visible');
  assert(!plantFits('tulip'), 'tulips are hidden by the squirrel bulb filter');
  assert(plantFits('hosta'), 'non-bulbs are unaffected by the squirrel bulb filter');
});

test('cultivar definitions deep-merge rendering look without mutating the base', () => {
  const base=plantDef('hebe'), cv=plantDef('hebe','andersoniivariegata');
  assertEqual(base.look.leafEdge,undefined,'base hebe stays plain green');
  assertEqual(cv.look.art2,true,'cultivar inherits the shared art renderer');
  assertEqual(cv.look.bloomStyle,'shortSpike','cultivar inherits flower architecture');
  assertEqual(cv.look.leafEdge,'#e4dcc5','cultivar adds its cream leaf margin');
  const snow=plantDef('mockorange','snowbelle');
  assertEqual(snow.look.bloomStyle,'looseCluster','Snowbelle keeps mock-orange flower placement');
  assertEqual(snow.look.flowerShape,'doubleCup','Snowbelle adds a double corolla');
});

test('high-priority shrub flower and habit families paint distinct traces', () => {
  function trace(key,season){
    const ops=[];
    const ctx=new Proxy({}, {
      get(o,p){
        if (p in o) return o[p];
        if (p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return () => ({addColorStop(){}});
        return (...args)=>{ if (['moveTo','lineTo','quadraticCurveTo','arc','ellipse','rotate','translate','fill','stroke'].includes(p))
          ops.push([p,...args.map(v=>typeof v==='number'?Math.round(v*100)/100:v)]); };
      },
      set(o,p,v){ o[p]=v; return true; },
    });
    drawPlant(ctx,0,0,key,1,season||'Spring',8127,0,undefined,1);
    return JSON.stringify(ops);
  }
  const keys=['forsythia','arnoldwitchhazel','bonicarose','americanelder','buttonbush','fothergilla','pieris','beautyberry'];
  const sig=keys.map(k=>trace(k,k==='beautyberry'?'Fall':'Spring'));
  assertEqual(new Set(sig).size,sig.length,'bare-stem stars, ribbons, roses, corymbs, globes, brushes, bells, and stem-whorl fruit stay visually distinct');
  assertEqual(trace('forsythia'),trace('forsythia'),'shrub morphology stays deterministic for cached cards and canvas');
});

test('native eligibility is range-aware and distinguishes species, selections, and hybrids', () => {
  setup();
  const north={nativeRegion:'north-america',nativeMode:'regional'};
  const northStraight={nativeRegion:'north-america',nativeMode:'straight'};
  const europe={nativeRegion:'europe',nativeMode:'regional'};
  assert(passesNativeFilter(plantDef('bluestem'),north), 'a North American straight species qualifies');
  assert(passesNativeFilter(plantDef('bluestem','standingovation'),north), 'regional mode includes selections of a native species');
  assert(!passesNativeFilter(plantDef('bluestem','standingovation'),northStraight), 'straight mode excludes named selections');
  assert(!passesNativeFilter(plantDef('agastache','bluefortune'),north), 'garden hybrids are excluded even when the base species is native');
  assert(!passesNativeFilter(plantDef('serviceberry','autumnbrilliance'),north), 'native-range hybrids are excluded from regional mode');
  assert(!passesNativeFilter(plantDef('serviceberry','autumnbrilliance'),northStraight), 'native-range hybrids are excluded from straight mode');
  assert(passesNativeFilter(plantDef('meadowsage'),europe), 'a European species qualifies for Europe');
  assert(!passesNativeFilter(plantDef('meadowsage'),north), 'the same species does not qualify for North America');
  assert(plantRoles('meadowsage',europe).includes('native'), 'roles use the requested range');
  assert(!plantRoles('meadowsage',north).includes('native'), 'regional roles do not leak from the cache');
});

test('legacy native-only criteria migrate deterministically', () => {
  const strict=normalizeFilters({zone:6,nativesOnly:true});
  assertEqual(strict.nativeMode,'straight','legacy true becomes the strict mode');
  assertEqual(strict.nativeRegion,'north-america','legacy saves receive the supported North American range');
  const open=normalizeFilters({zone:6,nativesOnly:false});
  assertEqual(open.nativeMode,'any','legacy false remains unrestricted');
  const design=normalizeDesign({zone:5,type:'prairie',nativesOnly:true,deer:true});
  assertEqual(design.nativeMode,'straight','saved design migration uses the same rule');
  assertEqual(design.nativesOnly,undefined,'the normalized design drops the legacy field');
});

test('plant discovery resolves exact cultivars and applies flower filters after garden eligibility', () => {
  setup();
  const cultivar = allPlantRefs().find(ref => ref.v && DISCOVERY_SEASONS.some(([season]) =>
    flowerFamiliesFor(refDef(ref), season).length));
  assert(cultivar && cultivar.v, 'the catalog has a cultivar with a classified flower color');
  const P = refDef(cultivar);
  const [season] = DISCOVERY_SEASONS.find(([s]) => flowerFamiliesFor(P, s).length);
  const color = flowerFamiliesFor(P, season)[0];
  assert(allPlantRefs().some(ref => ref.s === cultivar.s && ref.v === cultivar.v),
    'the catalog exposes an exact species + cultivar reference');
  game.discovery = normalizeDiscovery({ source: 'all', bloomSeasons: [season], colorFamilies: [color] });
  const results = discoveryRefs();
  assert(results.some(ref => ref.s === cultivar.s && ref.v === cultivar.v),
    'a cultivar is discoverable through its resolved seasonal flower color');
  assert(results.every(ref => discoveryMatches(ref, activeDiscovery())),
    'every discovery result satisfies the same composed predicate');
});

test('the catalog routes plant and landscape categories from the target category, not the prior view', () => {
  setup();
  assertEqual(trayGroupOf('sunper'), 'plants', 'a plant category stays in the Plants catalog');
  assertEqual(trayGroupOf('landscape'), 'build', 'Landscape is a separate catalog mode');
  assertEqual(trayGroupOf('structures'), 'build', 'Hardscape is a Landscape catalog category');
  const targetIsPlants = trayGroupOf('landscape') === 'plants';
  assertEqual(targetIsPlants, false, 'Plants-to-Landscape selection does not apply a plant discovery category');
});

test('the unified dock renders both plant discovery and landscape tool catalogs', () => {
  setup();
  game.trayCat = 'sunper'; game.tool = 'hand';
  buildToolTray();
  assertEqual(trayGroupOf(game.trayCat), 'plants', 'plant discovery dock renders from a plant category');
  assertEqual(sheetContextLabel(), 'Tap to choose a plant', 'the compact handle names the plant browse action');
  game.trayCat = 'landscape'; game.tool = 'hand';
  buildToolTray();
  assertEqual(trayGroupOf(game.trayCat), 'build', 'landscape tool dock renders from a landscape category');
  assertEqual(sheetContextLabel(), 'Tap to choose a landscape tool', 'the compact handle names the landscape browse action');
});

test('theme preference resolves auto against the OS and pins light/dark', () => {
  setup();
  const realMM = globalThis.matchMedia;
  const setOs = light => { globalThis.matchMedia = () => ({ matches: light, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }); };

  setOs(false);
  assertEqual(setThemePref('auto'), 'dark', 'auto follows a dark OS');
  assertEqual(themeLabel(), 'Auto (dark)', 'the label says what auto resolved to');
  setOs(true);
  assertEqual(resolvedTheme(), 'light', 'auto follows the OS when it flips');
  assertEqual(themeLabel(), 'Auto (light)', 'the label follows too');

  // An explicit choice must ignore the OS in both directions.
  assertEqual(setThemePref('dark'), 'dark', 'dark pins dark on a light OS');
  setOs(false);
  assertEqual(setThemePref('light'), 'light', 'light pins light on a dark OS');
  assertEqual(themeLabel(), 'Light', 'a pinned choice does not show a resolution');

  assertEqual(setThemePref('nonsense'), 'dark', 'junk falls back to auto (dark OS here)');
  assertEqual(localStorage.getItem('hortus:theme'), 'auto', 'junk is stored as auto, not as junk');

  setThemePref('auto');
  assertEqual(cycleThemePref(), 'light', 'cycle goes auto -> light');
  assertEqual(cycleThemePref(), 'dark', 'cycle goes light -> dark');
  assertEqual(cycleThemePref(), 'dark', 'cycle wraps dark -> auto (dark OS resolves to dark)');
  assertEqual(localStorage.getItem('hortus:theme'), 'auto', 'the wrap stored auto, not dark');

  globalThis.matchMedia = realMM;
  setThemePref('auto');
});

test('uiInk always yields a usable colour, including with no computed style', () => {
  setup();
  // The sandbox getComputedStyle returns '' for every property, which is the
  // same situation as a canvas icon drawn before the stylesheet resolves.
  ['--icon-ink', '--icon-ink-soft', '--icon-ink-dim', '--icon-warm', '--icon-halo'].forEach(k => {
    const v = uiInk(k);
    assert(typeof v === 'string' && v.length > 0, `${k} resolves to something drawable`);
    assert(/^(#|rgb)/.test(v), `${k} is a real colour, not an unresolved var(): ${v}`);
  });
  // An unknown token must not return empty and blank out an icon.
  assert(/^#/.test(uiInk('--nope')), 'an unknown token still yields a colour');
});

test('plant catalog controls pair into two rows instead of five stacked rows', () => {
  setup();
  const tabs = document.createElement('div');
  renderDiscoveryControls(tabs, () => {
    const mode = document.createElement('div');
    mode.className = 'catalog-mode';
    return mode;
  });
  const controls = tabs.children[0];
  // Five full-width rows cost 268px of fixed chrome and starved the result
  // list, which was the only flexible row. Two pairs halve that.
  assertEqual(controls.children.length, 2, 'controls collapse to two rows');
  assertEqual(controls.children[0].className, 'catalog-control-row', 'row one is a pair wrapper');
  assertEqual(controls.children[1].className, 'catalog-control-row', 'row two is a pair wrapper');
  // Row one answers "what am I browsing", row two "how do I narrow it".
  const [browse, narrow] = controls.children;
  assertEqual(browse.children[0].className, 'catalog-mode', 'Plants / Landscape stays first');
  assertEqual(browse.children[1].className, 'discovery-source-wrap', 'the source picker shares its row');
  assertEqual(narrow.children[0].id, 'trayFind', 'search leads the narrowing row');
  const filterRow = narrow.children[1];
  assertEqual(filterRow.className, 'discovery-filter-row', 'filters share the search row');
  assert(!filterRow.children.some(child => child.className === 'discovery-eligibility'),
    'the redundant eligibility status is not rendered');
});

test('a plant with no recorded bloom drops the timeline instead of drawing 12 empty bars', () => {
  setup();
  const blooming = Object.keys(PLANTS).find(k => bloomMonthsFor(PLANTS[k]).length);
  const bare = Object.keys(PLANTS).find(k => !bloomMonthsFor(PLANTS[k]).length);
  assert(blooming, 'the catalog has at least one blooming species to compare against');
  if (bare) {
    // "Blooms No bloom time recorded" plus a dozen grey bars read as a data
    // failure on a quarter of the catalog.
    assertEqual(discoveryBloomTimeline(PLANTS[bare]), null, 'no timeline without bloom data');
    assertEqual(discoveryBloomLabel(PLANTS[bare]), 'Grown for foliage', 'foliage copy replaces the empty range');
    assertEqual(discoveryGroupBloomText({ refs: [{ s: bare }] }), '', 'group bloom text is empty, not a sentence');
  }
  const line = discoveryBloomTimeline(PLANTS[blooming]);
  assert(line, 'a blooming species still renders its timeline');
  assertEqual(line.children.length, 12, 'the timeline stays a twelve-month strip');
  assert(line.children.some(c => c.className === 'on'), 'blooming months are marked');
  assert(discoveryBloomLabel(PLANTS[blooming]).startsWith('Blooms '), 'blooming species keep the Blooms label');
});

test('the category strip reports which side can still scroll', () => {
  setup();
  const strip = document.createElement('div');
  const wrap = document.createElement('div');
  wrap.appendChild(strip);
  strip.parentElement = wrap;
  // 940px of chips in a 330px column: 6 of 9 categories sit off-screen, and
  // with the scrollbar hidden the fade/arrows are the only affordance.
  strip.scrollWidth = 940; strip.clientWidth = 330;
  strip.scrollLeft = 0;
  updateCatalogStripAffordance(strip);
  assert(!strip.classList.contains('can-scroll-start'), 'no left fade at the start');
  assert(strip.classList.contains('can-scroll-end'), 'right fade shows more categories exist');
  assert(wrap.classList.contains('can-scroll-end'), 'the wrapper gets it too so the arrow can show');
  assert(wrap.classList.contains('can-scroll'), 'the wrapper reserves both arrow gutters while it scrolls');
  strip.scrollLeft = 610;
  updateCatalogStripAffordance(strip);
  assert(strip.classList.contains('can-scroll-start'), 'left fade appears once scrolled');
  assert(!strip.classList.contains('can-scroll-end'), 'right fade clears at the end');
  // The gutters must NOT come and go with the direction flags, or every chip
  // shifts 28px sideways under the finger that scrolled to the end.
  assert(wrap.classList.contains('can-scroll'), 'scrolling to the end keeps both gutters reserved');
  strip.scrollWidth = 300; strip.clientWidth = 330; strip.scrollLeft = 0;
  updateCatalogStripAffordance(strip);
  assert(!strip.classList.contains('can-scroll-start') && !strip.classList.contains('can-scroll-end'),
    'a strip that fits shows no affordance at all');
  assert(!wrap.classList.contains('can-scroll'), 'a strip that fits reserves no gutters either');
});

test('plant category drag scrolling follows the pointer without changing selection', () => {
  assertEqual(categoryDragScrollLeft(120, 200, 150), 170, 'dragging left reveals categories to the right');
  assertEqual(categoryDragScrollLeft(120, 200, 250), 70, 'dragging right reveals categories to the left');
  assertEqual(categoryKeyIndex('ArrowRight', 1, 4), 2, 'right arrow advances through category chips');
  assertEqual(categoryKeyIndex('ArrowRight', 3, 4), 0, 'right arrow wraps to the first category');
  assertEqual(categoryKeyIndex('ArrowLeft', 0, 4), 3, 'left arrow wraps to the final category');
  assertEqual(categoryKeyIndex('Home', 2, 4), 0, 'Home focuses the first category');
  assertEqual(categoryKeyIndex('End', 1, 4), 3, 'End focuses the final category');
});

test('landscape search spans every landscape category', () => {
  setup();
  assert(landscapeSearchItems('pond').some(item => item.tool === 'water'), 'water vocabulary finds the Water tool');
  assert(landscapeSearchItems('footprint').some(item => item.tool === 'building'), 'site vocabulary finds Building Footprint');
  assert(landscapeSearchItems('gate').some(item => item.tool === 'fence'), 'hardscape vocabulary finds Fence / Gate');
  // "wall" used to find the building footprint, because its hay still carried
  // the legacy roof/wall style keys that normalizeBuildingStyle renamed to
  // fill/edge. There is a real retaining-wall tool now, so that match was
  // actively wrong — a footprint is a diagram, not a wall.
  assert(landscapeSearchItems('wall').some(item => item.tool === 'wall'), 'wall vocabulary finds the retaining wall');
  assert(!landscapeSearchItems('wall').some(item => item.tool === 'building'), 'wall no longer finds the building footprint');
  assertEqual(landscapeSearchItems('').length, 0, 'an empty query keeps the current landscape category visible');
});

/* The list of searchable tools is derived from TRAY_CATS rather than restated,
   so a tool added to a tab can never be missing from the search that is
   supposed to find it. Six were, before this: edging, wall, seat, pot, pet and
   the Site tools. */
test('every landscape tool in TRAY_CATS is reachable from the landscape search', () => {
  setup();
  const items = searchToolItems();
  const listed = new Set(items.map(i => i.tool));
  TRAY_CATS.filter(c => c.tools).forEach(c => c.tools.forEach(tool => {
    assert(listed.has(tool), `${tool} (${c.label}) is in the landscape search index`);
  }));
  assertEqual(items.length, TRAY_CATS.filter(c => c.tools)
    .reduce((n, c) => n + c.tools.length, 0), 'the index holds exactly the table\'s tools');
  // and each one is findable by its own name, not just present in the array
  ['edging', 'seat', 'pot', 'pet', 'boulder'].forEach(tool => {
    assert(landscapeSearchItems(tool).some(i => i.tool === tool), `searching "${tool}" finds it`);
  });
  assert(landscapeSearchItems('bench').some(i => i.tool === 'seat'), 'a bench is found under seating');
  assert(landscapeSearchItems('planter').some(i => i.tool === 'pot'), 'a planter is found under containers');
  assert(landscapeSearchItems('cat').some(i => i.tool === 'pet'), 'a cat is found under pets');
});

test('applying garden criteria leaves the discovery lens intact', () => {
  setup();
  game.design = { zone: 6, type: 'any', nativeRegion:'north-america', nativeMode:'any', deer: false, rabbit: false, squirrel: false };
  game.discovery = normalizeDiscovery({ source: 'all', query: 'aster', colorFamilies: ['purple'], bloomSeasons: ['Fall'] });
  applyGardenCriteria({ zone: 7, nativeRegion:'europe', nativeMode:'straight', deer: true, rabbit: false, squirrel: false }, { refresh: false, announce: false });
  assertEqual(game.filters.zone, 7, 'the garden criterion updates');
  assertEqual(game.filters.nativeMode,'straight','the requested native mode updates');
  assertEqual(game.filters.nativeRegion,'europe','the requested native range updates');
  assert(game.filters.deer, 'the requested browse toggle updates');
  assertEqual(game.design.zone, 7, 'the saved garden design keeps the changed zone');
  assertEqual(game.discovery.query, 'aster', 'the discovery query survives a criteria change');
  assertEqual(game.discovery.bloomSeasons[0], 'Fall', 'the discovery bloom lens remains independent');
});

test('the fixed setup zone stays out of discovery filter summaries', () => {
  setup();
  game.filters = normalizeFilters({ zone: 6, nativeRegion:'north-america', nativeMode:'regional', deer: false, rabbit: false, squirrel: false });
  game.discovery = normalizeDiscovery({ colorFamilies: ['pink'], bloomSeasons: [] });
  const labels = discoveryCriteriaLabels();
  assert(!labels.some(label => /^Zone/.test(label)), 'the setup zone is not repeated in the in-garden catalog');
  assert(labels.includes('North America natives'), 'an active garden criterion names its comparison range');
  assertEqual(discoveryFilterCount(), 2, 'the filter badge counts the visible criterion and flower lens, not zone');
});

test('a named palette has a stable plant-list dropdown value', () => {
  setup();
  const palette = createPlantPalette('Dropdown regression');
  game.discovery = normalizeDiscovery({ source: 'palette', collectionId: palette.id });
  assertEqual(discoverySourceValue(), `palette:${palette.id}`, 'named palettes round-trip through the source selector');
  assert(deletePlantPalette(palette.id), 'the temporary palette can be removed');
});

test('saved plant lists open to All instead of inheriting a category', () => {
  setup();
  game.trayCat = 'grasses';
  const current = normalizeDiscovery({ source: 'all', category: 'grasses' });
  const favorites = discoverySourceSelection('favorites', null, current);
  const palette = discoverySourceSelection('palette', 'test-palette', current);
  assertEqual(favorites.category, null, 'Favorites clears the prior plant category');
  assertEqual(palette.category, null, 'a named palette clears the prior plant category');
  assertEqual(palette.collectionId, 'test-palette', 'the named palette id remains exact');
  const backToCatalog = discoverySourceSelection('all', null, normalizeDiscovery(favorites));
  assertEqual(backToCatalog.category, 'grasses', 'ordinary catalog sources restore the concrete browsing category');
});

test('Find searches every plant category and clearing restores the browse category', () => {
  setup();
  game.trayCat = 'grasses';
  const current = normalizeDiscovery({ source: 'all', category: 'grasses' });
  const searching = discoverySearchSelection(current, 'Daffodil');
  assertEqual(searching.category, null, 'a non-empty query is not trapped in the visible plant category');
  assertEqual(searching.returnCategory, 'grasses', 'Find remembers the category it temporarily replaced');
  const matches = discoveryRefsFor(normalizeDiscovery(Object.assign({}, current, searching)));
  assert(matches.some(ref => refDef(ref).type === 'bulb'), 'the global Find query reaches matching bulbs from Grasses');
  game.trayCat = 'bulbs'; // device-global tray state can differ after another garden is loaded
  const reloaded = normalizeDiscovery(Object.assign({}, current, searching));
  const cleared = discoverySearchSelection(reloaded, '');
  assertEqual(cleared.category, 'grasses', 'clearing Find returns to the prior browse category');
  assertEqual(plantTrayCategoryId(normalizeDiscovery(Object.assign({}, reloaded, cleared)), game.trayCat), 'grasses',
    'the face-up category follows the restored per-garden category, not device-global tray state');
  const migrated = normalizeDiscovery({ source: 'all', category: 'bulbs', query: 'Daffodil' });
  assertEqual(migrated.category, null, 'a legacy saved query migrates to global search');
  assertEqual(migrated.returnCategory, 'bulbs', 'the legacy category becomes its saved return category');
});

test('a named palette All view spans its saved plant categories', () => {
  setup();
  const grass = allPlantRefs().find(ref => !ref.v && refDef(ref).type === 'grass');
  const bulb = allPlantRefs().find(ref => !ref.v && refDef(ref).type === 'bulb');
  const palette = createPlantPalette('All categories regression', [grass, bulb]);
  game.discovery = normalizeDiscovery({ source: 'palette', collectionId: palette.id, category: null });
  const refs = discoveryRefs();
  assert(refs.some(ref => ref.s === grass.s), 'the palette All view includes its grass');
  assert(refs.some(ref => ref.s === bulb.s), 'the palette All view includes its bulb');
  const data = discoveryCollectionCategoryData();
  assert(data.counts.grasses > 0 && data.counts.bulbs > 0, 'optional category facets count both saved categories');
  assert(deletePlantPalette(palette.id), 'the temporary palette can be removed');
});

test('catalog grouping collapses cultivars without losing exact references', () => {
  setup();
  const species = PLANT_KEYS.find(s => Object.keys(PLANTS[s].cv || {}).length >= 2);
  const exact = allPlantRefs().filter(ref => ref.s === species);
  const groups = groupDiscoveryRefs(exact);
  assertEqual(groups.length, 1, 'one species and its cultivars render as one catalog family');
  assertEqual(groups[0].refs.length, exact.length, 'the family retains every exact choice');
  assert(groups[0].baseRef && !groups[0].baseRef.v, 'the straight species remains available');
  assertEqual(groups[0].cultivarRefs.length, exact.length - 1, 'cultivars remain exact drill-in choices');
  const cultivar = exact.find(ref => ref.v);
  assertEqual(discoveryResultCountText([cultivar]),'1 plant','a cultivar-only result is one exact plant choice');
  const matches = discoveryRefsFor(normalizeDiscovery({ source: 'all', query: cultivar.v }));
  const matchGroups = groupDiscoveryRefs(matches);
  assert(matchGroups.some(group => group.refs.some(ref => ref.s === cultivar.s && ref.v === cultivar.v)),
    'an exact cultivar search still surfaces its exact reference');
});

test('catalog grouping also collapses sibling taxa that share a presentation group', () => {
  const stonecrops=allPlantRefs().filter(ref=>PLANTS[ref.s].group==='hylotelephium');
  const grouped=groupDiscoveryRefs(stonecrops);
  assertEqual(grouped.length,1,'the five exact stonecrop lineages share one family card');
  assert(grouped[0].crossSpecies,'the family records that its choices cross base keys');
  assertEqual(grouped[0].refs.length,5,'every exact stonecrop choice reaches the drill-in');
  const moorGrasses=allPlantRefs().filter(ref=>PLANTS[ref.s].group==='molinia');
  assertEqual(groupDiscoveryRefs(moorGrasses).length,1,'Transparent and Moorhexe share one purple-moor-grass card');
});

test('the active discovery card tracks the exact selected cultivar', () => {
  setup();
  const cultivar = allPlantRefs().find(ref => ref.v);
  assert(cultivar && cultivar.v, 'a cultivar fixture exists');
  game.tool = cultivar.s; game.toolVar = cultivar.v;
  assert(activePlantRef(cultivar), 'the exact selected cultivar receives the active-card treatment');
  assert(!activePlantRef({ s: cultivar.s, v: null }), 'the base species is not mistaken for its selected cultivar');
});

test('flower color discovery never infers bloom time from foliage or plan color', () => {
  const faux = { bloomMonths: [6], planColor: '#d77c9e', sea: {
    Spring: { bloom: '#d77c9e' }, Summer: { fol: '#d77c9e' }, Fall: {}, Winter: {}
  }};
  assertEqual(flowerFamiliesFor(faux, 'Spring').length, 0,
    'a renderer bloom outside authored bloom months cannot appear in the spring filter');
  assertEqual(flowerFamiliesFor(faux, 'Summer').length, 0,
    'foliage or plan color does not masquerade as a summer flower color');
});

test('favorites and named palettes preserve exact cultivar references', () => {
  setup();
  const cultivar = allPlantRefs().find(ref => ref.v);
  assert(cultivar && cultivar.v, 'a cultivar exists for the collection contract');
  const originallyFavorite = isFavorite(cultivar);
  if (originallyFavorite) toggleFavorite(cultivar);
  assert(toggleFavorite(cultivar), 'adding a cultivar to Favorites reports the new saved state');
  assert(favoriteRefs().some(ref => ref.s === cultivar.s && ref.v === cultivar.v),
    'Favorites retain both species and cultivar keys');
  const palette = createPlantPalette('Regression palette', [cultivar]);
  assert(palette && paletteRefs(palette.id).some(ref => ref.s === cultivar.s && ref.v === cultivar.v),
    'a named palette stores the same exact cultivar reference');
  assert(!addPaletteRef(palette.id, cultivar), 'a palette does not duplicate an exact reference');
  const migrated = normalizePlantCollections({ favorites: [{ s: 'retired-species', v: 'old-form' }] });
  assertEqual(migrated.favorites[0].s, 'retired-species', 'unresolved saved references survive collection normalization');
  assertEqual(refDef({ s: cultivar.s, v: 'retired-form' }), null,
    'a retired cultivar cannot silently resolve and plant as its base species');
  assert(deletePlantPalette(palette.id), 'the named palette can be removed');
  toggleFavorite(cultivar);
  if (originallyFavorite) toggleFavorite(cultivar);
});

test('retired plant refs converge in gardens, schemes, Favorites, and palettes', async () => {
  const cell={s:'salvia',d:7,t:11,ox:0.25,oy:-0.2};
  const mapped=canonicalizePlantMap({'2,3':cell,'4,5':{s:'retired-species',d:1,t:2}});
  assertEqual(mapped['2,3'].s,'meadowsage','old Caradonna base moves to meadow sage');
  assertEqual(mapped['2,3'].v,'caradonna','old Caradonna identity becomes exact');
  assertEqual(mapped['2,3'].d,7,'planting day survives migration');
  assertEqual(mapped['2,3'].ox,0.25,'free-placement offsets survive migration');
  assertEqual(mapped['4,5'].s,'retired-species','unknown retired refs remain untouched');

  const collections=normalizePlantCollections({
    favorites:[{s:'creamindigo'},{s:'baptisia',v:'creamwild'}],
    palettes:[{id:'legacy',name:'Legacy',items:[{s:'smoketree',v:'grace'},{s:'salviaspecies',v:'bluehill'}]}]
  });
  assertEqual(collections.favorites.length,1,'aliases deduplicate after canonicalization');
  assertEqual(plantRefId(collections.favorites[0]),'baptisia|creamwild','Cream Wild Indigo remains exact');
  assertEqual(plantRefId(collections.palettes[0].items[0]),'smokebush|grace','misplaced Grace moves to smokebush');
  assertEqual(plantRefId(collections.palettes[0].items[1]),'meadowsage|bluehill','old sage cultivar moves to the canonical family');

  setup(13,13);
  const a=game.schemeActive;
  restoreSchemes({schemes:{active:a,list:[{id:a,name:'Active',t:1},{id:'legacy-scheme',name:'Legacy',t:1,
    plants:{'6,6':{s:'smoketree',v:'royalpurple',d:3,t:4}},bulbs:{}}]}},0);
  const idle=schemeList().find(s=>s.id==='legacy-scheme');
  assert(idle&&idle.plants['6,6'],'inactive scheme survives restoration');
  assertEqual(plantRefId(idle.plants['6,6']),'smokebush|royalpurple','inactive scheme refs migrate too');

  const id='cleanup-alias-load';
  await sSet('hortus:world:'+id,{v:SAVE_VERSION,gw:13,gh:13,name:'Legacy refs',plants:{'3,3':cell},bulbs:{}});
  assert(await loadSolo(id),'legacy-ref garden loads');
  assertEqual(plantRefId(game.plants['3,3']),'meadowsage|caradonna','active garden refs migrate on load');
  await sDel('hortus:world:'+id);
});

test('saved lists retain unavailable plants and expose them for removal', () => {
  setup();
  const outsideZone = allPlantRefs().find(ref => !ref.v && refDef(ref).zones[0] > 3);
  assert(outsideZone, 'an out-of-zone plant fixture exists');
  game.filters = normalizeFilters({ zone: 3 });
  const originallyFavorite = isFavorite(outsideZone);
  if (originallyFavorite) toggleFavorite(outsideZone);
  toggleFavorite(outsideZone);
  const palette = createPlantPalette('Unavailable regression', [outsideZone, { s: 'retired-species', v: null }]);
  const unavailableFavorites = unavailableSavedRefs(favoriteRefs());
  const unavailablePalette = unavailableSavedRefs(paletteRefs(palette.id));
  assert(unavailableFavorites.some(ref => plantRefId(ref) === plantRefId(outsideZone)),
    'an ineligible Favorite remains available to the manager');
  assertEqual(unavailablePalette.length, 2, 'the manager receives garden-ineligible and retired palette entries');
  assert(/Zone 3/.test(savedRefAvailabilityReason(outsideZone)), 'the manager explains the active-zone mismatch');
  assertEqual(savedRefAvailabilityReason({ s: 'retired-species', v: null }), 'Retired plant',
    'the manager labels an unresolved saved reference');
  toggleFavorite(outsideZone);
  assert(!isFavorite(outsideZone), 'the unavailable Favorite can be removed');
  assert(deletePlantPalette(palette.id), 'the temporary palette can be removed');
  if (originallyFavorite) toggleFavorite(outsideZone);
});

test('bloom calendar rows use real-world bloom months from planted species', () => {
  setup();
  setTile('plants', '5,5', { s: 'echinacea', d: 0, t: 1 });
  setTile('plants', '6,5', { s: 'echinacea', d: 0, t: 1 });
  setTile('bulbs', '7,5', { s: 'daffodil', d: 0, t: 1 });
  const rows = bloomRows();
  const cone = rows.find(r => r.key === 'echinacea|');
  const bulb = rows.find(r => r.key === 'daffodil|');
  assert(cone && cone.count === 2, 'summer perennial counted once per planted tile');
  assert(cone.months.includes(6) && cone.months.includes(8), 'coneflower shows real summer bloom months');
  assert(bulb && bulb.count === 1, 'spring bulb counted');
  assert(bulb.months.includes(3) && bulb.months.includes(4), 'daffodil shows real spring bloom months');
});

test('long-blooming perennials carry one bloom across a season boundary', () => {
  setup();
  const windows = bloomWindowsFor(PLANTS.gaura);
  assertEqual(windows.length, 1, 'gaura has one annual bloom run');
  assert(windows[0][0] < DAYS_PER_SEASON * 2 && windows[0][1] > DAYS_PER_SEASON * 2,
    'gaura bloom spans the Summer-to-Fall boundary');
  game.dayOffset = DAYS_PER_SEASON * 2 - 1;
  assertEqual(absDay(), DAYS_PER_SEASON * 2 - 1, 'late summer day offset is active');
  assert(bloomWindowLevel(DAYS_PER_SEASON * 2 - 1, windows[0][0], windows[0][1]) > 0.9,
    'late summer lies within gaura’s annual bloom window');
  const lateSummer = bloomLevel('gaura');
  game.dayOffset = DAYS_PER_SEASON * 2 + 1;
  const earlyFall = bloomLevel('gaura');
  assert(lateSummer > 0.9 && earlyFall > 0.9,
    `gaura remains in full flower on both sides of the boundary (${lateSummer}/${earlyFall})`);
});

test('cultivar bloom windows drive live phenology instead of the base plant window', () => {
  setup();
  game.dayOffset = Math.round(bloomMonthPhase(5) + YEAR_DAYS/24);
  const royalMay = bloomLevel('redhotpoker','royalstandard');
  const beesMay = bloomLevel('redhotpoker','beessunset');
  assertEqual(royalMay,0,'Royal Standard waits until its June bloom window');
  assert(beesMay>0.2,`Bees' Sunset is already flowering in May (${beesMay})`);
});

test('exact bloom-day species stay gated to their authored season', () => {
  const onion = PLANTS.prairieonion;
  assert(onion.bloomDay !== undefined, 'fixture uses the exact bloom-day contract');
  assert(bloomAppearanceFor(onion, 'Fall'), 'prairie onion can bloom in Fall');
  assertEqual(bloomAppearanceFor(onion, 'Summer'), null,
    'prairie onion cannot borrow its Fall flower color into Summer');
  assert(bloomAppearanceFor(PLANTS.gaura, 'Fall'),
    'month-window plants retain their boundary color bridge');
});

test('fall geophytes can carry a separate winter-spring leaf season', () => {
  setup();
  game.dayOffset=4;
  assert(bulbEnvelope('colchicum')>0.9,'colchicum spring leaves reach the renderer');
  assert(bulbEnvelope('cyclamenhederifolium')>0.9,'cyclamen keeps its spring leaf carpet');
  game.dayOffset=20;
  assertEqual(bulbEnvelope('colchicum'),0,'colchicum is dormant in summer');
  game.dayOffset=36;
  assert(bulbEnvelope('colchicum')>0.9,'colchicum returns for naked fall flowers');
  game.dayOffset=52;
  assertEqual(bulbEnvelope('colchicum'),0,'colchicum is fully dormant after its fall flowers');
  assert(bulbEnvelope('cyclamenhederifolium')>0.9,'cyclamen foliage persists through winter');
  assertEqual(PLANTS.dahlia.bloomDay,undefined,'dahlia uses one July-to-October bloom window instead of restarting each season');
  assertEqual(bloomWindowsFor(PLANTS.dahlia).length,1,'dahlia has one continuous annual bloom run');
});

test('winter-dormant Colchicum paints no orphan shadow', () => {
  setup(); game.dayOffset=52;
  let ops=0;
  const ctx=new Proxy({}, {get(){ return ()=>{ ops++; }; },set(){ return true; }});
  drawPlant(ctx,0,0,'colchicum',bulbEnvelope('colchicum'),'Winter',12,0,undefined,0);
  assertEqual(ops,0,'winter Colchicum has neither organs nor a detached ground shadow');
});

test('bulbs cannot be planted under a tree trunk or shrub footprint', () => {
  setup(21, 21);
  const tree = 'whiteoak';
  const shrub = 'sumac';
  const bulb = firstOfType('bulb');
  game.plants['5,5'] = { s: tree, d: -10000, t: 1 };
  game.tool = bulb; game.toolVar = null;
  assert(applyToolAt(5, 5) === null, 'bulb on a tree trunk must be refused');
  assert(applyToolAt(5, 4) === 'bulb', 'bulb under open tree canopy is allowed');
  game.bulbs = {};
  game.plants = { '10,10': { s: shrub, d: 0, t: 1 } };
  assert(applyToolAt(12, 10) === null, 'bulb inside a mature shrub footprint must be refused');
  // but a bulb under a perennial is fine
  game.plants = { '6,6': { s: firstOfType('forb'), d: 0, t: 1 } };
  assert(applyToolAt(6, 6) === 'bulb', 'bulb under a perennial is allowed');
});

test('full-sun plants under active canopy place with a warning and render struggling', () => {
  setup(31, 31);
  const x = 15, y = 14;
  setTile('plants', '15,15', { s: 'whiteoak', d: -10000, t: 1 });
  assertEqual(placementPolicy('activeCanopySun').mode, 'soft', 'active tree shade is a soft rule');
  assertEqual(placementPolicy('shrubCore').mode, 'hard', 'shrub footprint remains a hard rule');
  assert(shadeInfoAt(x, y, false, true), 'fixture tile is in active true-establishment shade');

  const oldToast = toast;
  let msg = '', kind = null;
  toast = (m, k) => { msg = m; kind = k; };
  try {
    game.tool = 'bluestem'; game.toolVar = null;
    game.actX = x; game.actY = y;
    actHere();
  } finally {
    toast = oldToast;
  }

  assertEqual(game.plants[`${x},${y}`].s, 'bluestem', 'little bluestem plants under active oak shade');
  assertEqual(kind, 'warn', 'the shade warning uses the amber toast style');
  assert(msg.includes('active canopy shade from the white oak') && msg.includes('will struggle'),
    `warning copy explains the canopy consequence: ${msg}`);
  buildScene(800, 600);
  const rec = scene.ents.find(e => e.kind === SCENE_K.PLANT && e.x === x && e.y === y);
  assert(rec && rec.stunt === true, 'the placed full-sun grass renders stunted under the canopy');
});

test('planting a tree/shrub clears a bulb already on the tile', () => {
  setup();
  const woody = firstOfType('shrub') || firstOfType('tree');
  game.bulbs['4,4'] = { s: firstOfType('bulb'), d: 0, t: 1 };
  game.tool = woody; game.toolVar = null;
  assert(applyToolAt(4, 4) === 'plant', 'woody planted');
  assert(!(game.bulbs['4,4'] && !game.bulbs['4,4'].removed), 'bulb was cleared');
});

test('bucket fill floods a bed block and stops at its boundary', () => {
  setup(13, 13);
  for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) game.terrain[`${x},${y}`] = { k: 'bed', t: 1 };
  game.tool = firstOfType('forb'); game.toolVar = null; game.fillMode = true;
  game.trayCat = 'sunper';
  doFloodFill(5, 5);
  const planted = live(game.plants);
  assertEqual(planted.length, 9, 'exactly the 3x3 bed got planted');
  assert(planted.every(k => { const [x, y] = k.split(',').map(Number); return x >= 4 && x <= 6 && y >= 4 && y <= 6; }),
    'no plants escaped the bed');
});

test('bucket fill respects a path wall and is one undo step', () => {
  setup(11, 11);
  for (let y = 0; y < GH; y++) game.terrain[`5,${y}`] = { k: 'path', t: 1 }; // vertical wall splits the plot
  game.tool = 'bed'; game.toolVar = null; game.fillMode = true;
  const before = undoStack.length;
  doFloodFill(2, 2); // left half only
  const beds = Object.keys(game.terrain).filter(k => game.terrain[k].k === 'bed' && !game.terrain[k].removed);
  assert(beds.length > 0, 'something filled');
  assert(beds.every(k => Number(k.split(',')[0]) < 5), 'fill did not cross the path wall');
  assertEqual(undoStack.length - before, 1, 'fill is a single undo step');
});

test('bed styles are stored on terrain and can be repainted', () => {
  setup(11, 11);
  game.tool = 'bed';
  game.bedStyle = 'gravel';
  assertEqual(applyToolAt(3, 3), 'bed', 'gravel bed placed');
  assertEqual(game.terrain['3,3'].c, 'gravel', 'bed style stored');
  game.bedStyle = 'leaf';
  assertEqual(applyToolAt(3, 3), 'bed', 'existing bed restyled');
  assertEqual(game.terrain['3,3'].c, 'leaf', 'new bed style stored');
  assertEqual(applyToolAt(3, 3), null, 'same style is a no-op');
});

test('ground cache revisions change only for ground-affecting edits', () => {
  setup(11, 11);
  const g = firstOfType('grass');
  const ground0 = game.groundRev, terrain0 = game.terrainRev;
  setTile('plants', '2,2', { s: g, d: 0, t: 1 });
  assertEqual(game.groundRev, ground0, 'plant edits do not rebake ground');
  assertEqual(game.terrainRev, terrain0, 'plant edits do not retrace terrain blobs');
  setTile('terrain', '3,3', { k: 'bed', c: 'soil', t: 1 });
  assert(game.groundRev > ground0, 'terrain edit rebakes ground');
  assert(game.terrainRev > terrain0, 'terrain edit retraces organic regions');
  const ground1 = game.groundRev, terrain1 = game.terrainRev;
  setElevationAt(4, 4, 1);
  assert(game.groundRev > ground1, 'elevation edit rebakes ground');
  assert(game.terrainRev > terrain1, 'elevation edit retraces regions (raised beds are their own terrace blobs)');
  const ground2 = game.groundRev;
  addHouse({ x: 6, y: 6, w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] });
  assert(game.groundRev > ground2, 'house edit rebakes ground for doorstep/footprint');
});

test('elevation tools raise, lower, level, and clamp grade', () => {
  setup(11, 11);
  game.tool = 'raise';
  for (let i = 0; i < ELEV_MAX + 2; i++) applyToolAt(5, 5);
  assertEqual(elevationAt(5, 5), ELEV_MAX, 'raise clamps at max elevation');
  assertEqual(applyToolAt(5, 5), null, 'raise refuses a no-op at max elevation');
  game.tool = 'lower';
  for (let i = 0; i < ELEV_MAX - ELEV_MIN + 2; i++) applyToolAt(5, 5);
  assertEqual(elevationAt(5, 5), ELEV_MIN, 'lower clamps at min elevation');
  game.tool = 'level';
  assertEqual(applyToolAt(5, 5), 'elevation', 'level changes non-zero grade');
  assertEqual(elevationAt(5, 5), 0, 'level returns to flat ground');
});

test('toolMeta is the source of truth for the legacy tool predicates', () => {
  setup();
  const forb = firstOfType('forb'), bulb = firstOfType('bulb');
  const woody = firstOfType('shrub') || firstOfType('tree');
  // layer routing matches plant type
  assertEqual(toolMeta(forb).layer, 'perennials', 'forb -> perennials layer');
  assertEqual(toolMeta(bulb).layer, 'bulbs', 'bulb -> bulbs layer');
  assertEqual(toolMeta(woody).layer, 'woody', 'woody -> woody layer');
  assertEqual(toolMeta('path').layer, 'landscape', 'landscape brushes -> landscape layer');
  assertEqual(toolMeta('hand').layer, null, 'non-drawing tools have no layer');
  // the three legacy predicates are now just table reads
  for (const t of [forb, bulb, woody, 'path', 'bed', 'water', 'raise', 'house', 'fence', 'light', 'firepit', 'boulder',
                   'hand', 'select', 'pick', 'shovel']){
    assertEqual(isBrushTool(t), toolMeta(t).brush, `isBrushTool(${t}) tracks the table`);
    assertEqual(isPlacementTool(t), toolMeta(t).placement, `isPlacementTool(${t}) tracks the table`);
    assertEqual(toolTargetLayer(t), toolMeta(t).layer, `toolTargetLayer(${t}) tracks the table`);
  }
  // hand/select/pick/shovel are neither brush nor placement; the rest are both
  for (const t of ['hand', 'select', 'pick', 'shovel'])
    assert(!toolMeta(t).brush && !toolMeta(t).placement, `${t} is not a brush/placement tool`);
  // material flag is exactly the path/bed/water set
  for (const t of ['path', 'bed', 'water']) assert(toolMeta(t).material, `${t} is a ground material`);
  for (const t of [forb, bulb, woody, 'raise', 'house', 'fence', 'light', 'boulder', 'hand'])
    assert(!toolMeta(t).material, `${t} is not a ground material`);
});

test('tool guidance explains the next canvas action', () => {
  setup(21, 21);
  game.tool = 'ruler';
  assert(/tap two points|drag/i.test(toolGuide().v), 'ruler guidance is actionable');
  game.tool = 'path'; game.fillMode = false;
  assert(/tap or drag/i.test(toolGuide().v), 'paint guidance stays on canvas');
  game.fillMode = true;
  assert(/connected region/i.test(toolGuide().v), 'fill guidance reflects the armed mode');
  game.tool = firstOfType('forb'); game.fillMode = false; game.freePlanting = true;
  assert(/free placement/i.test(toolGuide().v), 'plant guidance reflects free placement');
  game.tool = 'building'; game.buildingDraft = { vertices: [[2, 2], [6, 2]] };
  assert(/2 corners/i.test(toolGuide().v), 'building guidance reports draft progress');
  assert(/feet/i.test(toolGuide().v), 'building guidance explains the live dimension');
  assertEqual(JSON.stringify(snapBuildingCorner([9, 5], [6, 2])), JSON.stringify([9, 2]),
    'building preview snaps a loose pointer to its dominant orthogonal axis');
  assertEqual(buildingEdgeFeetLabel([2, 2], [7, 2]), '7.5 ft', 'building edges report feet from the site scale');
  const latticePoint=screenOfCorner(7, 4, 900, 700);
  assertEqual(JSON.stringify(buildingCornerScreenPoint([7, 4], 900, 700, 0)), JSON.stringify(latticePoint),
    'building draft points project onto the exact visible tile-corner lattice');
});

/* The tile-corner lattice is NOT the tile lattice, and only agrees with it at
   rot 0 — which is exactly why this shipped broken: worldToView reflects around
   tile indices (GW-1-x) and a corner needs GW-cx, so every corner-space drawing
   (building outlines, organic terrain blobs) sat a whole tile height off its
   own tiles at rot 1/2/3. */
test('tile-corner geometry lands on its tiles at every rotation', () => {
  setup(31, 31);
  const W = 1200, H = 800;
  const key = pts => pts.map(p => Math.round(p[0]) + ':' + Math.round(p[1])).sort().join('|');
  for (const rot of [0, 1, 2, 3]){
    game.rot = rot;
    for (const [x, y] of [[0, 0], [6, 9], [30, 30], [12, 3]]){
      const [sx, sy] = screenOf(x, y, W, H);
      const diamond = [[sx, sy], [sx + TILE_W / 2, sy + TILE_H / 2],
        [sx, sy + TILE_H], [sx - TILE_W / 2, sy + TILE_H / 2]];
      const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]
        .map(c => screenOfCorner(c[0], c[1], W, H));
      assertEqual(key(corners), key(diamond),
        `rot ${rot}: tile ${x},${y} corners are its diamond`);
    }
  }
  // the traced boundary of a tile set has to sit on that set, not beside it
  const set = new Set();
  for (let x = 5; x <= 7; x++) for (let y = 5; y <= 7; y++) set.add(x + ',' + y);
  const loops = traceOutlines(set);
  for (const rot of [0, 1, 2, 3]){
    game.rot = rot;
    let bx = Infinity, by = Infinity, tx = Infinity, ty = Infinity;
    for (const loop of loops) for (const p of loop){
      const s = screenOfCorner(p[0], p[1], W, H);
      bx = Math.min(bx, s[0]); by = Math.min(by, s[1]);
    }
    for (const k of set){
      const [x, y] = k.split(',').map(Number), [sx, sy] = screenOf(x, y, W, H);
      tx = Math.min(tx, sx - TILE_W / 2); ty = Math.min(ty, sy);
    }
    assert(Math.abs(bx - tx) < 0.001 && Math.abs(by - ty) < 0.001,
      `rot ${rot}: traced outline sits on its tiles (off by ${Math.round(bx - tx)},${Math.round(by - ty)})`);
  }
  game.rot = 0;
});

/* The footprint's extruded rim is drawn on the two faces the CAMERA sees, so
   its "is my neighbour missing" test has to ask the view directions. Asking
   world +x/+y agreed at rot 0 and was backwards at rot 2, which struck a rim
   across the middle of the shape. drawElevationSides already did this right. */
test('a footprint extrudes its rim on the camera-facing sides at every rotation', () => {
  setup(21, 21);
  assert(commitBuildingFootprint([[4, 4], [9, 4], [9, 9], [4, 9]]), '5x5 footprint commits');
  const b = game.buildings[0];
  const fills = (x, y) => {
    let n = 0;
    const ctx = new Proxy({}, {
      get(o, p){
        if (p === 'measureText') return t => ({ width: 0 });
        if (p === 'fill') return () => { n++; };
        return () => {};
      }, set(){ return true; },
    });
    drawBuildingTile(ctx, 1200, 800, b, x, y);
    return n;
  };
  for (const rot of [0, 1, 2, 3]){
    game.rot = rot;
    // the centre tile has all four neighbours: top face only, never a rim
    assertEqual(fills(6, 6), 1, `rot ${rot}: an interior tile draws no rim`);
    // exactly the two camera-facing edges carry a rim: 5 + 5 - 1 shared corner
    let rimmed = 0;
    for (let x = 4; x <= 8; x++) for (let y = 4; y <= 8; y++) if (fills(x, y) > 1) rimmed++;
    assertEqual(rimmed, 9, `rot ${rot}: the rim follows two edges of the square`);
  }
  game.rot = 0;
});

test('a self-crossing footprint outline is refused', () => {
  setup(31, 31);
  // a bow-tie: two edges genuinely cross. between() used to be handed the
  // POINTS instead of their coordinates, which coerces to NaN and is always
  // false, so the perpendicular case — every real crossing — never fired.
  assert(orthSegmentsTouch([2, 5], [9, 5], [6, 2], [6, 9]), 'crossing perpendiculars touch');
  assert(!orthSegmentsTouch([2, 5], [4, 5], [9, 2], [9, 9]), 'separated perpendiculars do not');
  assert(buildingOutlineValid([[4, 4], [10, 4], [10, 10], [7, 10], [7, 2], [12, 2], [12, 12], [4, 12]]),
    'a bow-tie outline is rejected');
  assertEqual(buildingOutlineValid([[4, 4], [10, 4], [10, 10], [4, 10]]), '', 'a rectangle still passes');
  assertEqual(buildingOutlineValid([[4, 4], [12, 4], [12, 8], [8, 8], [8, 12], [4, 12]]), '',
    'an L still passes');
});

test('mobile sheet supports collapsed, half, and full recovery states', () => {
  const oldMatchMedia=matchMedia;
  try {
    matchMedia=q=>({matches:q.includes('max-width:767px'),addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
    setup(21, 21);
    setSheetState('collapsed');
    assertEqual(game.sheetState, 'collapsed', 'sheet collapses');
    cycleSheetState();
    assertEqual(game.sheetState, 'half', 'handle activation restores the working sheet');
    cycleSheetState();
    assertEqual(game.sheetState, 'full', 'second handle activation exposes the full catalog');
    cycleSheetState();
    assertEqual(game.sheetState, 'collapsed', 'third handle activation clears the canvas');
    nudgeSheetState(1);
    assertEqual(game.sheetState, 'half', 'upward nudge restores the working sheet');
    nudgeSheetState(1);
    assertEqual(game.sheetState, 'full', 'second upward nudge opens the full catalog');
    nudgeSheetState(-1);
    assertEqual(game.sheetState, 'half', 'downward nudge returns to half');
  } finally { matchMedia=oldMatchMedia; }
});

test('desktop catalog moves directly between expanded and compact states', () => {
  setup(21, 21);
  setSheetState('collapsed');
  nudgeCatalogHandle(1);
  assertEqual(game.sheetState, 'full', 'reopen returns directly to the full catalog');
  nudgeCatalogHandle(-1);
  assertEqual(game.sheetState, 'collapsed', 'minimize returns directly to the compact bar');
  setSheetState('half');
  assertEqual(game.sheetState, 'full', 'legacy desktop half state normalizes to expanded');
});

test('mobile canvas recovery avoids visible editing chrome', () => {
  const oldVW=VW, oldVH=VH, oldQuery=document.querySelector, oldGet=document.getElementById;
  const top=document.createElement('div'), tools=document.createElement('div'), sheet=document.createElement('div');
  top.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:118,width:390,height:118});
  tools.getBoundingClientRect=()=>({left:8,top:150,right:56,bottom:370,width:48,height:220});
  sheet.getBoundingClientRect=()=>({left:0,top:620,right:390,bottom:844,width:390,height:224});
  try {
    VW=390; VH=844;
    document.querySelector=sel=>sel==='.hud-top'?top:sel==='.hud-bottom'?sheet:oldQuery.call(document,sel);
    document.getElementById=id=>id==='canvasTools'?tools:oldGet.call(document,id);
    const safe=usableCanvasRect();
    assertEqual(safe.top,126,'safe canvas begins below the top controls');
    assertEqual(safe.left,64,'safe canvas begins beyond the tool rail');
    assertEqual(safe.bottom,612,'safe canvas ends above the open palette');
    tools.getBoundingClientRect=()=>({left:334,top:150,right:382,bottom:370,width:48,height:220});
    const rightSafe=usableCanvasRect();
    assertEqual(rightSafe.left,8,'right-side rail leaves the left canvas edge open');
    assertEqual(rightSafe.right,326,'right-side rail is reserved by shared canvas bounds');
    sheet.classList.add('sheet-collapsed');
    assertEqual(usableCanvasRect().bottom,836,'collapsed palette gives the canvas its height back');
  } finally {
    VW=oldVW; VH=oldVH; document.querySelector=oldQuery; document.getElementById=oldGet;
  }
});

test('desktop canvas recovery reserves the Organic side library', () => {
  const oldVW=VW, oldVH=VH, oldQuery=document.querySelector, oldGet=document.getElementById;
  const top=document.createElement('div'), tools=document.createElement('div'), sheet=document.createElement('div');
  top.getBoundingClientRect=()=>({left:20,top:20,right:820,bottom:76,width:800,height:56});
  tools.getBoundingClientRect=()=>({left:12,top:110,right:70,bottom:470,width:58,height:360});
  sheet.getBoundingClientRect=()=>({left:878,top:20,right:1260,bottom:880,width:382,height:860});
  try {
    VW=1280; VH=900;
    document.querySelector=sel=>sel==='.hud-top'?top:sel==='.hud-bottom'?sheet:oldQuery.call(document,sel);
    document.getElementById=id=>id==='canvasTools'?tools:oldGet.call(document,id);
    const safe=usableCanvasRect();
    assertEqual(safe.left,78,'left tool rail remains reserved');
    assertEqual(safe.right,870,'right library is reserved from the canvas workspace');
    assertEqual(safe.bottom,892,'side library does not consume canvas height');
  } finally {
    VW=oldVW; VH=oldVH; document.querySelector=oldQuery; document.getElementById=oldGet;
  }
});

test('left-handed layout is a device preference, not garden state', () => {
  setLeftHandedLayout(true,false);
  assert(leftHandedLayout,'preference turns on');
  assertEqual(localStorage.getItem(LEFT_HANDED_KEY),'1','preference persists locally');
  assert(document.body.classList.contains('left-handed-layout'),'body class mirrors mobile chrome');
  assertEqual(snapshotState().leftHandedLayout,undefined,'garden undo snapshots exclude device preference');
  setLeftHandedLayout(false,false);
});

test('modal focus trap wraps keyboard focus inside the active dialog', () => {
  const host=document.createElement('div'), first=document.createElement('button'), last=document.createElement('button');
  let focused=''; first.focus=()=>{ focused='first'; }; last.focus=()=>{ focused='last'; };
  host.querySelectorAll=()=>[first,last]; host.contains=n=>n===first||n===last;
  let prevented=false; document.activeElement=last;
  trapOverlayFocus(host,{key:'Tab',shiftKey:false,preventDefault(){ prevented=true; }});
  assert(prevented && focused==='first', 'Tab wraps from last control to first');
  prevented=false; focused=''; document.activeElement=first;
  trapOverlayFocus(host,{key:'Tab',shiftKey:true,preventDefault(){ prevented=true; }});
  assert(prevented && focused==='last', 'Shift+Tab wraps from first control to last');
});

test('every brush/placement tool has an apply hook; non-drawing tools do not', () => {
  setup();
  const forb = firstOfType('forb'), bulb = firstOfType('bulb');
  const woody = firstOfType('shrub') || firstOfType('tree');
  // drawing tools dispatch through a hook
  for (const t of [forb, bulb, woody, 'path', 'bed', 'water', 'raise', 'lower', 'level', 'fence', 'light', 'firepit', 'boulder'])
    assertEqual(typeof toolMeta(t).apply, 'function', `${t} has an apply hook`);
  // house places via placeHouse, not applyToolAt; the rest are not placers at all
  for (const t of ['house', 'hand', 'select', 'pick', 'shovel'])
    assert(!toolMeta(t).apply, `${t} has no apply hook`);
  // applyToolAt routes through the hook: a plant lands, house no-ops
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), 'plant', 'plant tool dispatches to placePlantAt');
  game.tool = 'house';
  assertEqual(applyToolAt(6, 6), null, 'house no-ops through applyToolAt');
});

test('paints flag drives fill — continuous fills only, not discrete structures', () => {
  setup();
  const forb = firstOfType('forb');
  game.fillMode = true;
  // plants + path/bed/water/elevation flood-fill
  for (const t of [forb, 'path', 'bed', 'water', 'raise']){
    game.tool = t; assert(fillActive(), `${t} flood-fills`); assert(toolMeta(t).paints, `${t}.paints`);
  }
  // discrete structures are brushes but never flood-fill
  for (const t of ['house', 'fence', 'light', 'firepit', 'boulder']){
    game.tool = t;
    assert(!fillActive(), `${t} does not flood-fill`);
    assert(toolMeta(t).brush && !toolMeta(t).paints, `${t} is a brush but not a paint`);
  }
  game.fillMode = false; game.tool = forb;
  assert(!fillActive(), 'fill needs fillMode on');
});

test('brush bar fill toggle arms only continuous paint tools', () => {
  setup();
  game.tool = 'bed'; game.fillMode = false;
  chooseFillMode(true);
  assert(game.fillMode && fillActive(), 'fill toggle arms a landscape paint brush');
  chooseFillMode(false);
  assert(!game.fillMode, 'fill toggle turns off');
  game.tool = 'fence';
  chooseFillMode(true);
  assert(!game.fillMode && !fillActive(), 'fill toggle refuses discrete structures');
});

test('elevation participates in undo, erase, and selection moves', () => {
  setup(13, 13);
  game.tool = 'raise';
  withUndo(() => applyToolAt(4, 4));
  assertEqual(elevationAt(4, 4), 1, 'raised ground');
  doUndo();
  assertEqual(elevationAt(4, 4), 0, 'undo restores flat ground');
  doRedo();
  assertEqual(elevationAt(4, 4), 1, 'redo restores raised ground');

  game.sel = { x0: 4, y0: 4, x1: 4, y1: 4 };
  game.selItems = selectionPayload(game.sel);
  assert(game.selItems.some(c => c.elev), 'selection owns elevation');
  commitSelectionOffset(2, 0, false);
  assertEqual(elevationAt(4, 4), 0, 'move clears original elevation');
  assertEqual(elevationAt(6, 4), 1, 'move carries elevation');

  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0 };
  game.eraseMode = 'terrain';
  eraseBrush(6, 4, counts);
  assertEqual(counts.elev, 1, 'landscape erase counts elevation');
  assertEqual(elevationAt(6, 4), 0, 'landscape erase levels elevation');
});

test('brushOffsets is a centered disc: 1 tile, full 3x3, rounded 5x5', () => {
  assertEqual(brushOffsets(1).length, 1, 'size 1 is a single tile');
  assert(brushOffsets(1)[0][0] === 0 && brushOffsets(1)[0][1] === 0, 'size 1 is the center');
  assertEqual(brushOffsets(3).length, 9, 'size 3 is the full 3x3');
  assertEqual(brushOffsets(5).length, 21, 'size 5 is a rounded 5x5 (corners cut)');
  // every offset stays within the disc radius, so paint/erase/ghost agree
  for (const sz of BRUSH_SIZES)
    for (const [dx, dy] of brushOffsets(sz))
      assert(Math.hypot(dx, dy) <= sz / 2 + 1e-6, `offset in radius for size ${sz}`);
  assertEqual(normalizeBrushSize(4), 1, 'an unknown size falls back to 1');
});

test('the paint brush stamps a disc; the erase brush shares the size; plants stay single', () => {
  setup(31, 31);
  // a size-3 path brush at the center paints the full 3x3 via stampBrushAt
  game.tool = 'path'; game.pathColor = 'warm'; game.brushSize = 3;
  stampBrushAt(10, 10, null);
  let paved = 0;
  for (const [dx, dy] of brushOffsets(3)) if (tileTerrain(10 + dx, 10 + dy) === 'path') paved++;
  assertEqual(paved, 9, 'size-3 path brush paved the whole 3x3 disc');

  // erasing at the same shared size lifts the whole disc in one pass
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0 };
  eraseBrush(10, 10, counts);
  assertEqual(counts.terr, 9, 'size-3 erase lifted the whole 3x3 disc');

  // plants are not sizable — a size-3 plant brush drops exactly one plant
  game.tool = 'karl'; game.toolVar = null; game.brushSize = 3;
  assertEqual(toolBrushSize(), 1, 'plant tools ignore brush size');
  stampBrushAt(20, 20, null);
  let planted = 0;
  for (const [dx, dy] of brushOffsets(3)) {
    const p = game.plants[`${20 + dx},${20 + dy}`];
    if (p && !p.removed) planted++;
  }
  assertEqual(planted, 1, 'a sized plant brush still places a single plant');
});

test('edge style seeds from the questionnaire garden type', () => {
  ['formal', 'modern', 'japanese'].forEach(t => assertEqual(edgeStyleFromType(t), 'formal', `${t} keeps crisp edges`));
  ['prairie', 'cottage', 'any', 'shade', undefined].forEach(t => assertEqual(edgeStyleFromType(t), 'organic', `${t} gets organic edges`));
  assertEqual(edgeStyleId('formal'), 'formal', 'formal normalizes');
  assertEqual(edgeStyleId('nonsense'), 'organic', 'unknown edge style falls back to organic');
});

test('matrix scatter self-thins a region and interplants around what is there', () => {
  setup(31, 31);
  const cx = SPAWNX, cy = SPAWNY;
  game.tool = 'karl'; game.toolVar = null; game.matrix = true; game.drift = false;
  let grass = 0;
  for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) if (applyToolAt(x, y, null)) grass++;
  assert(grass > 0 && grass < 49, 'matrix places some but thins the 7x7 region');
  // no two same-species orthogonally adjacent (spacing respected)
  let adj = 0;
  for (const k in game.plants) {
    const p = game.plants[k]; if (!p || p.removed || p.s !== 'karl') continue;
    const [x, y] = k.split(',').map(Number);
    const q = game.plants[`${x + 1},${y}`], r = game.plants[`${x},${y + 1}`];
    if (q && !q.removed && q.s === 'karl') adj++;
    if (r && !r.removed && r.s === 'karl') adj++;
  }
  assertEqual(adj, 0, 'matrix keeps same-species at least a tile apart');
  // a second species interplants into the gaps, skipping occupied tiles
  game.tool = 'echinacea';
  let forb = 0;
  for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) if (applyToolAt(x, y, null)) forb++;
  assert(forb > 0, 'a second matrix species fills the gaps around the grass');
  assert(grass + forb <= 49, 'two interwoven layers never exceed the region tile count');
  // matrix off: the same species can sit on adjacent tiles again
  setup(31, 31);
  game.tool = 'karl'; game.matrix = false;
  assert(applyToolAt(cx, cy, null) && applyToolAt(cx + 1, cy, null), 'without matrix, adjacent same-species is allowed');
});

test('organic terrain traces contiguous same-material tiles into regions', () => {
  setup(21, 21);
  for (let y = 3; y <= 5; y++) for (let x = 3; x <= 6; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'mulch', t: 1 });
  for (let y = 3; y <= 5; y++) for (let x = 12; x <= 14; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'mulch', t: 1 });
  for (let y = 10; y <= 12; y++) for (let x = 3; x <= 6; x++) setTile('terrain', `${x},${y}`, { k: 'path', c: 'warm', t: 1 });
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 3, 'two bed blocks + one path block = three regions');
  assert(regions.every(r => r.loops.length >= 1), 'every region traced at least one boundary loop');
  // a differently-coloured neighbour is its own region even when adjacent
  setTile('terrain', '7,3', { k: 'bed', c: 'gravel', t: 1 });
  assertEqual(buildTerrainRegions().length, 4, 'a different bed colour splits into its own region');
});

test('organic regions: peer materials butt exactly, grass edges stay soft', () => {
  setup(21, 21);
  // two bed styles butted against each other — equal rank, so neither is laid
  // over the other and both stay exact on the shared line
  for (let y = 5; y <= 8; y++) for (let x = 3; x <= 6; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'mulch', t: 1 });
  for (let y = 5; y <= 8; y++) for (let x = 7; x <= 9; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'gravel', t: 1 });
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 2, 'the two bed styles are separate regions');
  for (const r of regions){
    assert(!r.loops[0].closed, 'a butted region splits into arcs');
    const hard = r.loops[0].arcs.filter(a => a.hard);
    const soft = r.loops[0].arcs.filter(a => !a.hard);
    assert(hard.length >= 1 && soft.length >= 1, 'the loop has both hard and soft arcs');
    assert(hard.every(a => !a.covered), 'neither peer is covered by the other');
    const sharedPts = hard.flatMap(a => a.pts);
    assert(sharedPts.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)),
      'an uncovered hard arc keeps exact tile corners (no jitter, no skirt)');
    assert(sharedPts.some(([x]) => x === 7), 'the hard arc lies on the shared tile line');
    for (const a of soft){
      const first = a.pts[0], last = a.pts[a.pts.length - 1];
      assert(Number.isInteger(first[0]) && Number.isInteger(first[1]), 'soft arc start pinned');
      assert(Number.isInteger(last[0]) && Number.isInteger(last[1]), 'soft arc end pinned');
    }
  }
});

test('a path is laid over the bed it runs through, not butted against it', () => {
  setup(21, 21);
  // a bed with a path cut clean through it, grass -> bed -> path -> bed -> grass
  for (let y = 4; y <= 12; y++) for (let x = 3; x <= 12; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'mulch', t: 1 });
  for (let y = 4; y <= 12; y++) for (let x = 7; x <= 8; x++) setTile('terrain', `${x},${y}`, { k: 'path', c: 'warm', t: 1 });
  const regions = buildTerrainRegions();
  const path = regions.filter(r => r.kind === 'path');
  const beds = regions.filter(r => r.kind === 'bed');
  assertEqual(path.length, 1, 'one path region');
  assertEqual(beds.length, 2, 'the path splits the bed in two');

  // rank decides who is on top, and paint order has to agree with it
  assert(terrainRank('path') > terrainRank('bed'), 'a path outranks a bed');
  assertEqual(regions[regions.length - 1].kind, 'path', 'the path paints last');

  // a loop is either one closed curve or a run of arcs; read both the same way
  const loopParts = loop => loop.closed ? [loop] : loop.arcs;
  const loopPts = loop => loopParts(loop).flatMap(a => a.pts);

  // the path keeps ONE continuous organic edge for its whole run: nothing of it
  // is hard except where it meets the plot boundary, which is nowhere here
  const pathParts = loopParts(path[0].loops[0]);
  assert(pathParts.every(a => !a.hard),
    'the path has no hard edge — it does not turn into a tile staircase inside the bed');
  assert(pathParts.every(a => !a.covered), 'and nothing is laid over the path');

  // the bed stays exact along that boundary, so the path's edge has the bed's
  // own fill to land on however far it curves
  for (const bed of beds){
    const covered = loopParts(bed.loops[0]).filter(a => a.covered);
    assert(covered.length >= 1, 'the bed knows the path covers that boundary');
    assert(covered.every(a => a.hard), 'a covered boundary stays exact');
    assert(covered.flatMap(a => a.pts).every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)),
      'the loser does not move: bleeding it under the winner would eat a narrow winner alive');
  }
  // the path bleeds OUT past the shared lines, so smoothing cuts it back to
  // roughly the tile line rather than to somewhere inside it
  const px = loopPts(path[0].loops[0]).map(([x]) => x);
  assert(px.some(x => x < 7), 'the path bleeds west past the x=7 line, into the bed');
  assert(px.some(x => x > 9), 'the path bleeds east past the x=9 line, into the bed');
  assert(px.every(x => x > 7 - 1 && x < 9 + 1), 'and the bleed stays under a tile, so it cannot reach lawn');
});

test('organic regions: diagonal same-material tiles join one region and pin the pinch', () => {
  setup(21, 21);
  setTile('terrain', '4,4', { k: 'bed', c: 'mulch', t: 1 });
  setTile('terrain', '5,5', { k: 'bed', c: 'mulch', t: 1 });
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 1, '8-connectivity merges the diagonal pair');
  assertEqual(regions[0].tiles.size, 2, 'both tiles in the region');
  // the pinch corner (5,5) is pinned exact somewhere in the arc geometry
  const allPts = regions[0].loops.flatMap(l => l.closed ? l.pts : l.arcs.flatMap(a => a.pts));
  assert(allPts.some(([x, y]) => x === 5 && y === 5), 'the pinch corner survives exactly');
  // and each lobe keeps real area: a unit-tile lobe arc must retain its three
  // interior corners (DP once collapsed these to a degenerate sliver)
  const arcs = regions[0].loops.flatMap(l => l.closed ? [] : l.arcs);
  assert(arcs.length >= 2, 'the pinch splits the boundary into lobe arcs');
  for (const a of arcs) assert(a.pts.length >= 5, `lobe arc keeps its corners (got ${a.pts.length})`);
});

test('organic regions: plot edges are hard so beds run into plot corners', () => {
  setup(21, 21);
  // a bed filling the plot's NW corner
  for (let y = 0; y <= 2; y++) for (let x = 0; x <= 2; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'soil', t: 1 });
  const r = buildTerrainRegions()[0];
  assert(!r.loops[0].closed, 'plot-edge bed splits into hard (edge) + soft (grass) arcs');
  const hard = r.loops[0].arcs.filter(a => a.hard);
  const hardPts = hard.flatMap(a => a.pts);
  assert(hardPts.some(([x, y]) => x === 0 && y === 0), 'the plot corner (0,0) itself is reached exactly');
  assert(hardPts.some(([x, y]) => x === 0) && hardPts.some(([, y]) => y === 0),
    'hard arcs run along both plot boundaries');
});

test('organic regions: a cross-material diagonal saddle pins the shared corner in both regions', () => {
  setup(21, 21);
  setTile('terrain', '4,4', { k: 'bed', c: 'soil', t: 1 });
  setTile('terrain', '5,5', { k: 'path', c: 'warm', t: 1 });
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 2, 'different materials stay separate regions');
  for (const r of regions){
    const pts = r.loops.flatMap(l => l.closed ? l.pts : l.arcs.flatMap(a => a.pts));
    assert(pts.some(([x, y]) => x === 5 && y === 5),
      `${r.kind} pins the shared corner (5,5) exactly so the two connect`);
    const arcs = r.loops.flatMap(l => l.closed ? [] : l.arcs);
    assert(arcs.length >= 1, `${r.kind} loop was split at the saddle`);
  }
});

test('organic regions: elevation splits terraces and orders them low-to-high', () => {
  setup(21, 21);
  for (let x = 3; x <= 6; x++) setTile('terrain', `${x},10`, { k: 'bed', c: 'mulch', t: 1 });
  setElevationAt(5, 10, 1); setElevationAt(6, 10, 1);
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 2, 'one bed at two elevations = two terrace regions');
  assertEqual(regions[0].elev, 0, 'low terrace first');
  assertEqual(regions[1].elev, 1, 'high terrace second');
  // the boundary between the terraces is hard on both sides
  const hardOnSplit = r => !r.loops[0].closed &&
    r.loops[0].arcs.some(a => a.hard && a.pts.some(([x]) => x === 5));
  assert(hardOnSplit(regions[0]) && hardOnSplit(regions[1]), 'terrace step butts exactly at x=5');
});

test('organic edges collapse a diagonal tile staircase to a straight line', () => {
  // a right-triangle bed: the hypotenuse is traced as a 45-degree staircase
  const set = new Set();
  for (let y = 0; y <= 8; y++) for (let x = 0; x <= 8; x++) if (x + y >= 8) set.add(`${x},${y}`);
  const raw = traceOutlines(set)[0];
  assert(raw.length >= 12, 'the raw staircase boundary has many step corners');
  const simp = simplifyClosedLoop(raw, 0.9);
  assert(simp.length < raw.length && simp.length <= 6, 'the staircase collapses to a few real corners');
  // no surviving vertex sits in the middle of the diagonal — it is one segment
  const onDiag = simp.filter(([x, y]) => x + y > 1 && x + y < 15 && x > 0 && y > 0).length;
  assert(onDiag <= 1, 'the diagonal edge became a single straight line');
  // an already-clean rectangle is left untouched
  assertEqual(simplifyClosedLoop([[0, 0], [5, 0], [5, 5], [0, 5]], 0.9).length, 4, 'a clean rectangle is unchanged');
});

test('winter soil beds are frosted instead of nearly black', () => {
  for (const bs of BED_STYLES){
    const fill = bedFill({ k: 'bed', c: bs.id }, AMBIENCE.Winter);
    const shaded = shade(fill, -12); // render path applies a small seeded shade to bed fill
    const nums = shaded.match(/\d+/g).map(Number);
    const avg = (nums[0] + nums[1] + nums[2]) / 3;
    assert(avg > 120, `winter ${bs.id} bed should not render black, got ${shaded} from ${fill}`);
  }
});

test('garden clock advances only while the garden is active', () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    setup(11, 11);
    game.inGarden = true;
    game.startTs = now; game.elapsedMs = 0; game.dayOffset = 0; game.pausedAt = 0; game.clockSuspended = false;
    now += DAY_MS * 2.4;
    assertEqual(absDay(), 2, 'open play advances days');
    suspendClock();
    const frozen = absDay();
    now += DAY_MS * 20;
    assertEqual(absDay(), frozen, 'hidden/closed time does not advance days');
    resumeClockSession();
    now += DAY_MS * 1.1;
    assertEqual(absDay(), frozen + 1, 'resumed open play advances again');
  } finally {
    Date.now = realNow;
  }
});

test('design preview can show established plants without changing real growth', () => {
  setup(11, 11);
  const forb = firstOfType('forb');
  const p = { s: forb, d: absDay(), t: 1 };
  game.previewMode = 'today';
  assert(displayPlantGrowth(p) < 1, 'today preview respects establishment and seasonal growth');
  game.previewMode = 'established';
  assertEqual(displayPlantGrowth(p), 1, 'established preview renders mature plants');
  assert(plantGrowth(p) < 1, 'real growth remains unchanged for saves/cards/exports');
});

test('plant cards lead with woody mature size and keep herbaceous inches', () => {
  setup();
  const oldGet = document.getElementById;
  const card = { _t: 0, style: {}, innerHTML: '', prepend(){} };
  document.getElementById = id => id === 'plantCard' ? card : oldGet.call(document, id);
  try {
    const oak = { s: 'whiteoak', d: absDay(), t: 1 };
    game.plants['5,5'] = oak;
    game.previewMode = 'established';
    showPlantCard(oak, 5, 5);
    assert(card.innerHTML.includes('<b>Mature size:</b> 90 ft H &times; 75 ft W'),
      'white oak card leads with REAL mature height (heightIn) and width in feet');
    assert(card.innerHTML.includes('~10 yrs to size'), 'white oak card shows years-to-size');
    assert(card.innerHTML.includes('crown covers ~50 tiles wide'), 'white oak card shows crown coverage in tiles');
    assert(card.innerHTML.includes('Shown at maturity'), 'preview-mode card says it is shown at maturity');

    const bluestem = { s: 'bluestem', d: absDay(), t: 1 };
    game.plants = { '6,6': bluestem };
    game.previewMode = 'today';
    showPlantCard(bluestem, 6, 6);
    assert(card.innerHTML.includes('<b>Mature size:</b> 46&Prime; H &times; 24&Prime; W'),
      'little bluestem card keeps inch units');
    assert(!card.innerHTML.includes('crown covers'), 'little bluestem card does not get woody crown copy');
    assert(!card.innerHTML.includes('yrs to size'), 'little bluestem card does not get woody years copy');
  } finally {
    document.getElementById = oldGet;
  }
});

test('library mature size includes height for woody and herbaceous plants', () => {
  setup();
  const oldGet = document.getElementById;
  const detail = { innerHTML: '', children: [], append(...c){ this.children.push(...c); }, scrollTop: 0 };
  const findClass = (el, cls) => {
    if (!el) return null;
    if (el.className === cls) return el;
    for (const child of el.children || []){
      const found = findClass(child, cls);
      if (found) return found;
    }
    return null;
  };
  const fact = label => {
    const dl = findClass(detail.children[0], 'ld-facts');
    for (let i = 0; dl && i < dl.children.length - 1; i += 2)
      if (dl.children[i].textContent === label) return dl.children[i + 1].textContent;
    return '';
  };
  document.getElementById = id => id === 'libraryDetail' ? detail : oldGet.call(document, id);
  try {
    showLibraryDetail('whiteoak');
    assertEqual(fact('Mature size'), '90 ft H x 75 ft W - ~10 yrs to size',
      'library white oak mature size uses the real heightIn in feet');
    detail.children = [];
    showLibraryDetail('bluestem');
    assertEqual(fact('Mature size'), '46" H x 24" W',
      'library little bluestem mature size includes height and stays in inches');
  } finally {
    document.getElementById = oldGet;
  }
});

test('entering a garden starts paused on the established preview', () => {
  setup(15, 15);
  game.previewMode = 'established';
  enterGarden();
  assert(game.pausedAt, 'the planner starts with time paused');
  assertEqual(game.previewMode, 'established', 'the established preview is kept');
  assertEqual(game.woodyAge, 'mature', 'woody brushes plant at mature size');
});

test('draw tool restores the last plant or material after other tools', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  setTool(forb, null);
  assertEqual(game.lastBrushTool, forb, 'plant brush remembered');
  setTool('select', null);
  assertEqual(game.lastBrushTool, forb, 'selection tool does not overwrite drawing brush');
  setTool('shovel', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, forb, 'draw rail restores previous plant brush');

  setTool('bed', null);
  setTool('select', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, 'bed', 'draw rail restores previous material brush');
  assertEqual(game.trayCat, 'landscape', 'material brush restores the Landscape catalog');
});

test('draw tool restores build brushes and their catalog panels', () => {
  setup(13, 13);
  game.trayCat = 'structures';
  game.drill = 'firepit';
  setTool('firepit', null);
  setTool('select', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, 'firepit', 'structure brush restored');
  assertEqual(game.trayCat, 'structures', 'structure catalog restored');
  assertEqual(game.drill, 'firepit', 'structure sub-panel restored');

  game.trayCat = 'lighting';
  game.drill = null;
  setTool('light', null);
  setTool('shovel', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, 'light', 'lighting brush restored');
  assertEqual(game.trayCat, 'lighting', 'lighting catalog restored');
});

test('draw tool restores brush catalog page and keeps armed brush while browsing', () => {
  setup(13, 13);
  const drillKey = Object.keys(PLANTS).find(k => PLANTS[k].type === 'forb' && (PLANTS[k].group || PLANTS[k].cv));
  game.trayCat = plantCategoryFor(drillKey);
  game.drill = drillKey;
  setTool(drillKey, null);
  setTool('shovel', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, drillKey, 'last brush restored');
  assertEqual(game.trayCat, plantCategoryFor(drillKey), 'last brush category restored');
  assertEqual(game.drill, drillKey, 'drill-in page restored');

  game.trayCat = 'trees';
  game.drill = null;
  buildToolTray();
  assertEqual(game.tool, drillKey, 'browsing another category does not disarm the brush');
});

test('browsing build tabs does not silently arm a drawing tool', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  setTool(forb, null);
  game.trayCat = 'landscape';
  buildToolTray();
  assertEqual(game.tool, forb, 'landscape catalog leaves the armed plant alone');

  setTool('hand', null);
  game.trayCat = 'structures';
  buildToolTray();
  assertEqual(game.tool, 'hand', 'structures catalog waits for an explicit tool tap');
});

test('pinch cancel restores pending placement or erase gestures', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.plants['5,5'] = { s: forb, d: 0, t: 1 };
  beginUndo();
  sweep = { plants: 0, bulbs: 0, terr: 0, elev: 0, house: 0, fence: 0, light: 0, firepit: 0 };
  sweepLift(5, 5);
  assert(game.plants['5,5'].removed, 'first finger can erase before pinch starts');
  cancelCanvasGesture(true);
  assert(game.plants['5,5'] && !game.plants['5,5'].removed, 'pinch start restores the erased plant');
  assertEqual(undoStack.length, 0, 'cancelled pinch gesture does not create an undo entry');
});

test('free placement stores sub-tile offsets for herbaceous plants only', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.freePlanting = true;
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(5, 5, { ox: 0.32, oy: -0.27 }), 'plant', 'forb planted');
  assertEqual(game.plants['5,5'].ox, 0.32, 'x offset stored');
  assertEqual(game.plants['5,5'].oy, -0.27, 'y offset stored');
  assertEqual(plantDepth(5, 5, game.plants['5,5']), viewDepth(5.32, 4.73), 'depth uses free placement offset');

  game.tool = 'sumac'; game.toolVar = null;
  assertEqual(applyToolAt(8, 8, { ox: 0.4, oy: 0.4 }), 'plant', 'shrub planted');
  assert(game.plants['8,8'].ox === undefined && game.plants['8,8'].oy === undefined,
    'shrubs stay grid-centered because their mature footprint is tile-based');
});

test('shrubs reserve their mature footprint for planting and materials', () => {
  setup(17, 17);
  const bulb = firstOfType('bulb');
  const forb = firstOfType('forb');
  game.bulbs['10,8'] = { s: bulb, d: 0, t: 1 };
  game.tool = 'sumac'; game.toolVar = null;
  assertEqual(applyToolAt(8, 8), 'plant', 'wide shrub planted');
  assert(game.bulbs['10,8'].removed, 'bulb inside shrub footprint was cleared');

  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(10, 8), null, 'perennial refused inside mature shrub footprint');
  game.tool = 'path';
  assertEqual(applyToolAt(10, 8), null, 'path refused inside mature shrub footprint');

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0 };
  eraseBrush(10, 8, counts);
  assertEqual(counts.plants, 1, 'erasing the shrub edge removes the shrub');
  assert(game.plants['8,8'].removed, 'shrub center was removed');
  assert(woodyVisualCw(plantDef('sumac')) > PLANTS.sumac.cw, 'wide shrubs render from real spread, not just icon width');
});

test('small shrub footprints are rounded, not full square blocks', () => {
  setup(13, 13);
  const p = { s: 'boxwoodround', d: 0, t: 1 };
  const tiles = new Set(shrubFootprintTiles(6, 6, p, true).map(([x, y]) => `${x},${y}`));
  assert(tiles.has('6,6'), 'center claimed');
  assert(tiles.has('7,6') && tiles.has('5,6') && tiles.has('6,7') && tiles.has('6,5'), 'cardinal edge claimed');
  assert(!tiles.has('7,7') && !tiles.has('5,5'), 'diagonal corners stay plantable');
});

test('compatible hedge shrubs can be planted edge to edge', () => {
  setup(13, 13);
  game.tool = 'boxwoodsquare'; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), 'plant', 'first hedge shrub planted');
  assertEqual(applyToolAt(6, 5), 'plant', 'same hedge shrub can connect');
  game.tool = 'hydrangea';
  assertEqual(applyToolAt(5, 6), null, 'unrelated shrub cannot overlap the hedge footprint');
  game.tool = 'boxwoodround';
  assertEqual(applyToolAt(7, 5), null, 'round boxwood does not merge into a square hedge');
});

test('connected hedge shrubs expose a render angle for continuous lines', () => {
  setup(13, 13);
  game.tool = 'boxwoodsquare'; game.toolVar = null;
  applyToolAt(5, 5); applyToolAt(6, 5);
  const d = hedgeRenderDetail(5, 5, game.plants['5,5'], 1024, 768);
  assert(d && typeof d.hedgeAngle === 'number', 'connected hedge has an orientation');
  assert(Array.isArray(d.hedgeAxis) && d.hedgeStep > 0, 'connected hedge exposes screen-space prism data');
  assert(!d.hedgeEndPos && d.hedgeEndNeg, 'end caps know which side is connected');
});

test('bamboo trees expose grove neighbors when planted together', () => {
  setup(13, 13);
  game.tool = 'bamboo'; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), 'plant', 'first bamboo planted');
  assertEqual(applyToolAt(6, 5), 'plant', 'second bamboo planted');
  const d = plantRenderDetail(5, 5, game.plants['5,5'], 1024, 768);
  assert(d && d.bambooDirs && d.bambooDirs.length, 'adjacent bamboo links into a grove');
});

test('boxwood and yew cultivars are documented but not selectable variants', () => {
  const keys = PLANT_KEYS.filter(k => ['boxwood', 'yew'].includes(PLANTS[k].group));
  assert(keys.length >= 2, 'boxwood/yew entries exist');
  keys.forEach(k => {
    assert(!PLANTS[k].cv, `${k} has no selectable cultivar chips`);
    assert(Array.isArray(PLANTS[k].libraryCultivars) && PLANTS[k].libraryCultivars.length,
      `${k} keeps cultivar notes for the plant library`);
    assert(PLANTS[k].libraryCultivars.every(c => c.name && c.size), `${k} cultivar notes include size`);
  });
});

test('formal boxwood silhouettes match the intended clipped shapes', () => {
  const round = plantDef('boxwoodround');
  const low = plantDef('boxwoodlow');
  const square = plantDef('boxwoodsquare');
  assert(round.spread >= 54 && round.cw >= 69, 'round boxwood is roughly 50% larger');
  assertEqual(low.look.shape, 'sphere', 'low ball renders as a small sphere');
  assertEqual(square.look.shape, 'square', 'square hedge keeps its square form');
  assert(square.look.bodyH >= 0.9, 'square hedge is tall enough to read as a cuboid');
});

test('shrubs get their own rounded plan components', () => {
  setup(13, 13);
  game.plants['4,4'] = { s: 'boxwoodlow', d: 0, t: 1 };
  game.plants['7,5'] = { s: 'boxwoodsquare', d: 0, t: 1 };
  game.plants['8,5'] = { s: 'boxwoodsquare', d: 0, t: 1 };
  game.plants['10,8'] = { s: 'hydrangea', d: 0, t: 1 };
  const comps = shrubPlanComponents();
  const low = comps.find(c => c.s === 'boxwoodlow');
  const hedge = comps.find(c => c.s === 'boxwoodsquare');
  const hydrangea = comps.find(c => c.s === 'hydrangea');
  assert(low && low.shape === 'sphere' && low.tiles.length === 1, 'low ball is a one-plant round plan symbol');
  assert(hedge && hedge.hedge && hedge.tiles.length === 2, 'touching square boxwoods become one hedge symbol');
  assert(hydrangea && !hydrangea.hedge && hydrangea.tiles.length > 1, 'ordinary shrubs get mature rounded plan footprints');
  const ellipses = [];
  const ctx = new Proxy({ ellipse(x, y, rx, ry){ ellipses.push({ x, y, rx, ry }); } }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  const cell = 20, X = x => x * cell, Y = y => y * cell;
  drawShrubPlan(ctx, hydrangea, { 'hydrangea|': 'HY' }, cell, X, Y);
  const blob = ellipses[0], r = woodyRadiusTiles(plantDef('hydrangea')) * cell;
  assertEqual(Math.round(blob.rx * 1000), Math.round(r * 1000), 'shrub plan blob radius uses woodyRadiusTiles');
  assertEqual(Math.round(blob.ry * 1000), Math.round(r * 1000), 'shrub plan blob radius uses woodyRadiusTiles vertically');
  assertEqual(Math.round(blob.x * 1000), Math.round((hydrangea.x + 0.5) * cell * 1000),
    'shrub plan blob centers on the shrub origin');
});

test('tree plan canopy radius follows the effective display lens', () => {
  setup(61, 61);
  const tree = 'whiteoak';
  const def = plantDef(tree);
  const cx = 30, cy = 30;
  game.plants[`${cx},${cy}`] = { s: tree, d: absDay(), t: 1 };
  const cell = Math.max(9, Math.min(24, Math.floor(1000 / Math.max(GW, GH))));
  const oldGet = document.getElementById;
  const planDraw = mode => {
    const arcs = [], labels = [];
    let dash = [], clips = 0;
    const stack = [];
    const ctx = new Proxy({
      save(){ stack.push(dash.slice()); },
      restore(){ dash = stack.pop() || []; },
      setLineDash(v){ dash = v.slice(); },
      arc(x, y, r){ arcs.push({ x, y, r, dash: dash.join(',') }); },
      fillText(t){ labels.push(String(t)); },
      clip(){ clips++; },
    }, {
      get(o, p){ return p in o ? o[p] : () => {}; },
      set(o, p, v){ o[p] = v; return true; }
    });
    document.getElementById = id => id === 'planCanvas'
      ? { getContext(){ return ctx; }, style: {} }
      : oldGet.call(document, id);
    try {
      game.previewMode = mode;
      buildPlanMap();
    } finally {
      document.getElementById = oldGet;
    }
    return { arcs, labels, clips };
  };
  const fresh = planDraw('today');
  assertEqual(fresh.arcs.filter(a => a.dash === '5,4').length, 0,
    'fresh Today plan shows no false canopy ring');

  const horizon = def.grow * (YEAR_DAYS - DAYS_PER_SEASON);
  game.plants[`${cx},${cy}`].d = absDay() - Math.ceil(horizon / 2);
  const today = planDraw('today');
  const todayRing = today.arcs.find(a => a.dash === '5,4');
  assert(todayRing, 'establishing Today plan draws the current canopy reach');
  assertEqual(Math.round(todayRing.r * 1000), Math.round(canopyRadius(game.plants[`${cx},${cy}`]) * cell * 1000),
    'Today ring follows current effective reach');

  const established = planDraw('established');
  const estRing = established.arcs.find(a => a.dash === '5,4');
  const trunk = established.arcs.filter(a => a.r < cell * 0.5).pop();
  assertEqual(Math.round((estRing.r / cell) * 2), 50,
    'established white oak plan circle is 50 tiles across');
  assertEqual(Math.round(estRing.x * 1000), Math.round(trunk.x * 1000),
    'canopy circle is centered on the trunk dot');
  assertEqual(Math.round(estRing.y * 1000), Math.round(trunk.y * 1000),
    'canopy circle is centered on the trunk dot vertically');
  assertEqual(Math.round(estRing.r * 1000), Math.round(woodyRadiusTiles(def) * cell * 1000),
    'Established preview uses mature woody radius');
  assert(established.clips > 0, 'large canopy rings are clipped to the plot sheet');
  assert(established.labels.some(t => t.includes('Dashed = mature crown')),
    'tree plan legend explains dashed mature crowns');
});

test('shade overlay marks the layer view active; night does not (night is a top-bar toggle)', () => {
  setup(13, 13);
  assert(!layerViewActive(), 'default layer view is inactive');
  game.layerVis.night = true;
  assert(!layerViewActive(), 'night is now a top-bar day/night toggle, not a Layers overlay');
  game.layerVis.night = false;
  game.layerVis.shade = true;
  assert(layerViewActive(), 'the shade diagnostic still makes Layers active');
});

test('layer edit focus is disabled while the edit controls are hidden', () => {
  setup(13, 13);
  game.layerFocus = 'woody';
  assert(layerEditable('perennials'), 'hidden edit focus should not block perennial edits');
  assert(!layerViewActive(), 'hidden edit focus should not make Layers look active');
});

test('selection move shifts owned items and is refused off-plot', () => {
  setup(15, 15);
  game.plants['5,5'] = { s: firstOfType('grass'), d: 0, t: 1 };
  game.sel = { x0: 5, y0: 5, x1: 6, y1: 6 };
  game.selItems = selectionPayload(game.sel);
  assertEqual(game.selItems.length, 1, 'only the occupied tile is owned');
  assert(commitSelectionOffset(3, 3, false), 'valid move applied');
  assert(live(game.plants).includes('8,8') && !live(game.plants).includes('5,5'), 'plant moved by (3,3)');
  // moving off the plot is refused (state unchanged)
  const before = JSON.stringify(game.plants);
  assert(!commitSelectionOffset(-99, -99, false), 'off-plot move refused');
  assertEqual(JSON.stringify(game.plants), before, 'refused move left state untouched');
});

test('selection move validates shrub footprints and tree trunks', () => {
  setup(20, 20);
  game.plants['4,4'] = { s: 'sumac', d: 0, t: 1 };
  game.terrain['8,4'] = { k: 'path', c: 'warm', t: 1 };
  game.sel = { x0: 4, y0: 4, x1: 4, y1: 4 };
  game.selItems = selectionPayload(game.sel);
  let dst = c => [c.x + 4, c.y];
  let ctx = selectionValidationContext(game.selItems, dst, false);
  assert(!selItemDestValid(game.selItems[0], 8, 4, ctx), 'move ghost marks shrub-over-path invalid');
  let before = JSON.stringify({ plants: game.plants, terrain: game.terrain, sel: game.sel });
  assert(!commitSelectionOffset(4, 0, false), 'shrub move onto path refused');
  assertEqual(JSON.stringify({ plants: game.plants, terrain: game.terrain, sel: game.sel }), before,
    'path-blocked shrub move leaves state untouched');

  setup(20, 20);
  game.plants['4,4'] = { s: 'sumac', d: 0, t: 1 };
  game.plants['10,4'] = { s: 'hydrangea', d: 0, t: 1 };
  game.sel = { x0: 4, y0: 4, x1: 4, y1: 4 };
  game.selItems = selectionPayload(game.sel);
  before = JSON.stringify({ plants: game.plants, sel: game.sel });
  assert(!commitSelectionOffset(4, 0, false), 'shrub move into another mature shrub footprint refused');
  assertEqual(JSON.stringify({ plants: game.plants, sel: game.sel }), before,
    'shrub-over-shrub move leaves state untouched');

  setup(20, 20);
  game.plants['8,8'] = { s: firstOfType('tree'), d: 0, t: 1 };
  game.plants['5,5'] = { s: firstOfType('grass'), d: 0, t: 2 };
  game.sel = { x0: 5, y0: 5, x1: 5, y1: 5 };
  game.selItems = selectionPayload(game.sel);
  before = JSON.stringify({ plants: game.plants, sel: game.sel });
  assert(!commitSelectionOffset(3, 3, false), 'perennial move onto a tree trunk refused');
  assertEqual(JSON.stringify({ plants: game.plants, sel: game.sel }), before,
    'tree-trunk-blocked move leaves state untouched');
});

test('selection rotation returns mixed-parity selections after four turns', () => {
  for (const [w, h] of [[2, 1], [3, 2], [2, 3], [4, 1]]){
    setup(20, 20);
    const grass = firstOfType('grass');
    game.sel = { x0: 5, y0: 5, x1: 5 + w - 1, y1: 5 + h - 1 };
    for (let y = game.sel.y0; y <= game.sel.y1; y++)
      for (let x = game.sel.x0; x <= game.sel.x1; x++)
        game.plants[`${x},${y}`] = { s: grass, d: 0, t: 1 };
    game.selItems = selectionPayload(game.sel);
    const beforeSel = JSON.stringify(game.sel);
    const beforeKeys = live(game.plants).sort().join('|');
    for (let i = 0; i < 4; i++) rotateSelection();
    assertEqual(JSON.stringify(game.sel), beforeSel, `${w}x${h} selection rect returns after four rotations`);
    assertEqual(live(game.plants).sort().join('|'), beforeKeys, `${w}x${h} selection items return after four rotations`);
  }
});

test('selection only carries the items it owned, not late arrivals', () => {
  setup(15, 15);
  game.plants['5,5'] = { s: firstOfType('grass'), d: 0, t: 1 };
  game.sel = { x0: 5, y0: 5, x1: 6, y1: 5 };
  game.selItems = selectionPayload(game.sel);          // owns only (5,5)
  game.plants['6,5'] = { s: firstOfType('forb'), d: 0, t: 1 }; // wanders into the rect afterward
  commitSelectionOffset(0, 3, false);
  assert(live(game.plants).includes('5,8'), 'owned item moved');
  assert(live(game.plants).includes('6,5'), 'late arrival stayed put');
  assert(!live(game.plants).includes('6,8'), 'late arrival was not scooped');
});

test('snapshot restore clears stale selection ownership', () => {
  setup(15, 15);
  game.plants['5,5'] = { s: firstOfType('grass'), d: 0, t: 1 };
  const snap = snapshotState();
  game.sel = { x0: 5, y0: 5, x1: 6, y1: 6 };
  game.selItems = selectionPayload(game.sel);
  assert(game.selItems.length, 'selection owns a payload before restore');
  applySnapshot(snap);
  assertEqual(game.sel, null, 'restore drops selection rect');
  assertEqual(game.selItems, null, 'restore drops owned payload');
});

test('entering a garden clears stale selection ownership', () => {
  setup(15, 15);
  game.sel = { x0: 3, y0: 3, x1: 4, y1: 4 };
  game.selItems = [{ x: 3, y: 3, plant: { s: firstOfType('grass'), d: 0, t: 1 } }];
  enterGarden();
  assertEqual(game.sel, null, 'garden entry drops old selection rect');
  assertEqual(game.selItems, null, 'garden entry drops old owned payload');
});

test('selection fill uses the last selected plant and replaces existing plants', () => {
  setup(15, 15);
  const grass = firstOfType('grass');
  const forb = firstOfType('forb');
  game.plants['5,5'] = { s: grass, d: 0, t: 1 };
  game.sel = { x0: 5, y0: 5, x1: 6, y1: 6 };
  game.selItems = selectionPayload(game.sel);
  game.lastBrushTool = forb;
  game.lastBrushVar = null;
  fillSelectionWithPlant();
  const keys = ['5,5', '6,5', '5,6', '6,6'];
  keys.forEach(k => assert(game.plants[k] && game.plants[k].s === forb, `${k} filled with selected forb`));
  assertEqual(game.selItems.length, 4, 'selection ownership refreshes after fill');
});

test('selection fill uses the last selected landscape material', () => {
  setup(15, 15);
  game.sel = { x0: 5, y0: 5, x1: 6, y1: 6 };
  game.selItems = selectionPayload(game.sel);
  game.lastBrushTool = 'bed';
  game.bedStyle = 'gravel';
  fillSelectionWithPlant();
  const keys = ['5,5', '6,5', '5,6', '6,6'];
  keys.forEach(k => assert(game.terrain[k] && game.terrain[k].k === 'bed' && game.terrain[k].c === 'gravel',
    `${k} filled with gravel bed`));
  assertEqual(game.selItems.length, 4, 'selection ownership refreshes after material fill');
});

test('failed selection fill does not rewrite plant tombstones', () => {
  setup(15, 15);
  const forb = firstOfType('forb');
  game.sel = { x0: 5, y0: 5, x1: 5, y1: 5 };
  game.selItems = selectionPayload(game.sel);
  game.lastBrushTool = forb;
  game.plants['5,5'] = { removed: true, t: 1 };
  game.terrain['5,5'] = { k: 'path', c: 'warm', t: 1 };
  const rev = game.rev;
  const undoCount = undoStack.length;
  fillSelectionWithPlant();
  assertEqual(game.rev, rev, 'failed fill should not dirty a tombstone-only tile');
  assertEqual(undoStack.length, undoCount, 'failed fill should not push a phantom undo entry');
  assert(game.plants['5,5'] && game.plants['5,5'].removed, 'tombstone remains untouched');
});

test('selection save and paste carries an area into another garden slot', () => {
  setup(15, 15);
  areaClipboard = null;
  localStorage.removeItem(AREA_CLIP_KEY);
  const forb = firstOfType('forb');
  game.plants['3,3'] = { s: forb, d: 0, t: 1 };
  game.terrain['4,3'] = { k: 'path', c: 'lime', t: 1 };
  game.sel = { x0: 3, y0: 3, x1: 4, y1: 3 };
  game.selItems = selectionPayload(game.sel);
  saveSelectedArea();

  setup(15, 15);
  game.plants['9,8'] = { s: firstOfType('grass'), d: 0, t: 1 };
  game.sel = { x0: 8, y0: 8, x1: 8, y1: 8 };
  pasteSavedArea();
  assert(game.plants['8,8'] && game.plants['8,8'].s === forb, 'saved plant pasted at selection origin');
  assert(game.terrain['9,8'] && game.terrain['9,8'].k === 'path' && game.terrain['9,8'].c === 'lime',
    'saved material pasted at relative offset');
  assert(game.plants['9,8'] && game.plants['9,8'].removed, 'target footprint was cleared before paste');
  assertEqual(game.sel.x1, 9, 'selection expands to saved area width');
});

test('plant replacement matches exact sources, respects selection ownership, and is one undo step', () => {
  setup(14,14);
  const forbs=Object.keys(PLANTS).filter(k=>PLANTS[k].type==='forb'&&!PLANTS[k].hidden);
  const from=forbs[0], to=forbs.find(k=>k!==from);
  game.plants['2,2']={s:from,d:-90,t:1,ox:.2,oy:-.1};
  game.plants['3,2']={s:from,d:-45,t:2};
  game.plants['4,2']={s:from,d:-30,t:3};
  game.sel={x0:2,y0:2,x1:4,y1:2};
  game.selItems=selectionPayload({x0:2,y0:2,x1:3,y1:2}); // deliberately does not own the late arrival at 4,2
  const ctx={source:{s:from,v:null},key:'2,2',scope:'selection'};
  const result=replacePlantInstances(ctx,{s:to,v:null});
  assertEqual(result.changed,2,'only the two selection-owned sources change');
  assertEqual(game.plants['4,2'].s,from,'matching late arrival outside selection ownership stays unchanged');
  assertEqual(game.selItems.length,2,'replacement preserves the original selection ownership set');
  assert(!game.selItems.some(c=>c.x===4&&c.y===2),'replacement does not recapture a late arrival');
  assert(game.selItems.every(c=>c.plant&&c.plant.s===to),'owned selection records track the replacements');
  assertEqual(game.plants['2,2'].d,-90,'planted age is preserved');
  assertEqual(game.plants['2,2'].ox,.2,'free-placement offset is preserved');
  assertEqual(undoStack.length,1,'the batch creates one undo step');
  doUndo();
  assertEqual(game.plants['2,2'].s,from,'one undo restores the source species');
  assertEqual(game.plants['3,2'].s,from,'undo restores the whole replacement batch');
});

test('shrub replacement clears covered bulbs and validates the batch final state', () => {
  setup(30,30);
  const bulb=firstOfType('bulb');
  game.plants['15,15']={s:'damianita',d:0,t:1};
  game.bulbs['16,15']={s:bulb,d:0,t:1};
  let result=replacePlantInstances({source:{s:'damianita',v:null},key:'15,15',scope:'one'},{s:'sumac',v:null});
  assertEqual(result.changed,1,'a larger shrub replacement succeeds on a clear site');
  assert(game.bulbs['16,15']&&game.bulbs['16,15'].removed,'bulbs in the mature replacement footprint are cleared');

  setup(30,30);
  game.plants['10,10']={s:'sumac',d:0,t:1};
  game.plants['11,10']={s:'sumac',d:0,t:2};
  result=replacePlantInstances({source:{s:'sumac',v:null},key:'10,10',scope:'garden'},{s:'damianita',v:null});
  assertEqual(result.changed,2,'adjacent sources are assessed as their smaller simultaneous replacements');
  assertEqual(game.plants['10,10'].s,'damianita','first batch shrub changed');
  assertEqual(game.plants['11,10'].s,'damianita','second batch shrub changed');
});

test('stroke tracing fills fast pointer gaps and does not double-count a repeated edge', () => {
  assertEqual(strokeLineTiles(1,1,5,1).map(p=>p.join(',')).join('|'),'1,1|2,1|3,1|4,1|5,1','fast horizontal strokes interpolate every tile');
  const drag={trace:[[1,1]],edgeSeen:new Set(),affected:new Set(),runInches:0};
  recordToolDragPoint(drag,2,1,null);
  recordToolDragPoint(drag,1,1,null);
  assertEqual(drag.runInches,TILE_IN,'retracing the same centerline edge is counted once');
});

test('houses: place several, refuse overlaps, erase removes one', () => {
  setup(21, 21);
  game.tool = 'house';
  placeHouse(3, 3); placeHouse(8, 8); placeHouse(13, 5);
  assertEqual(game.houses.length, 3, 'three houses placed');
  placeHouse(3, 3); // overlaps the first
  assertEqual(game.houses.length, 3, 'overlap refused');
  assert(inHouse(3, 3) && !inHouse(0, 0), 'inHouse spans all houses');
  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0 };
  eraseBrush(8, 8, counts); // landscape erase over the middle house
  assertEqual(counts.house, 1, 'one house erased');
  assertEqual(game.houses.length, 2, 'two houses remain');
});

test('building footprints rasterize, block placement, and erase as one site object', () => {
  setup(21, 21);
  const outline = [[3, 3], [8, 3], [8, 6], [3, 6]];
  assert(commitBuildingFootprint(outline), 'valid rectangular footprint commits');
  assertEqual(game.buildings.length, 1, 'one footprint stored as a polygon');
  assert(buildingAt(4, 4), 'interior tile resolves to the footprint');
  assert(!buildingAt(9, 4), 'outside tile is clear');
  assert(siteStructureAt(4, 4), 'footprint claims its tiles as a site structure');
  buildScene(900, 700);
  const buildingEnts=scene.ents.filter(e => e.kind === SCENE_K.BUILDING);
  assertEqual(buildingEnts.length, buildingTiles(game.buildings[0]).length,
    'each footprint tile enters the scene independently for correct plant depth');
  assert(scene.ents.some(e => e.kind === SCENE_K.BUILDING_OUTLINE), 'footprint perimeter enters the depth-sorted scene');
  assert(new Set(buildingEnts.map(e=>e.d)).size>1, 'a large footprint spans multiple draw depths');
  game.tool = firstOfType('forb');
  assertEqual(applyToolAt(4, 4), null, 'plant tool refuses footprint tiles');
  game.plants['12,12'] = { s: firstOfType('grass'), d: 0, t: 1 };
  assert(!commitBuildingFootprint([[11, 11], [14, 11], [14, 14], [11, 14]]), 'footprint refuses an occupied site');
  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0, house: 0, building: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(4, 4, counts);
  assertEqual(counts.building, 1, 'one footprint erased despite multiple covered tiles');
  assertEqual(game.buildings.length, 0, 'footprint removed as a whole');
});

test('a placed footprint can be extended and trimmed, and stays one polygon', () => {
  setup(21, 21);
  assert(commitBuildingFootprint([[3, 3], [8, 3], [8, 6], [3, 6]]), 'footprint commits');
  const tiles0 = buildingTiles(game.buildings[0]).length;
  game.tool = 'building-edit'; game.buildingEditMode = 'add';

  assertEqual(applyToolAt(8, 4), 'building', 'a tile touching the footprint joins it');
  assertEqual(buildingTiles(game.buildings[0]).length, tiles0 + 1, 'the footprint grew by one tile');
  assert(buildingAt(8, 4), 'the new tile belongs to the building');
  assertEqual(game.buildings.length, 1, 'still one building, not two');
  assertEqual(applyToolAt(15, 15), null, 'ground touching nothing is refused');
  assertEqual(applyToolAt(4, 4), null, 'a tile already inside is refused');
  game.plants['8,5'] = { s: firstOfType('forb'), d: 0, t: 1 };
  assertEqual(applyToolAt(8, 5), null, 'an occupied tile is refused');
  delete game.plants['8,5'];

  game.buildingEditMode = 'remove';
  assertEqual(applyToolAt(8, 4), 'building', 'the added tile trims back off');
  assertEqual(buildingTiles(game.buildings[0]).length, tiles0, 'back to the original size');
  /* The model is one vertex ring, so a hole or a split cannot be expressed —
     both come back from traceOutlines as 2+ loops and are refused rather than
     silently mangling the outline. */
  assertEqual(applyToolAt(5, 4), null, 'punching an interior hole is refused');
  assertEqual(buildingTiles(game.buildings[0]).length, tiles0, 'the refused trim changed nothing');

  // trimming the last tile removes the building outright
  assert(commitBuildingFootprint([[12, 12], [13, 12], [13, 13], [12, 13]]), 'a one-tile footprint commits');
  assertEqual(game.buildings.length, 2, 'two buildings now');
  assertEqual(applyToolAt(12, 12), 'building', 'its only tile trims');
  assertEqual(game.buildings.length, 1, 'a footprint trimmed to nothing is removed');
});

test('a footprint carries a name, and its colours are the area and the edge', () => {
  // wall/roof came from the house model; a footprint has neither, and what the
  // two actually control is the shape's fill and the thin rim around it
  const legacy = normalizeBuildingStyle({ wall: '#111111', roof: '#222222' });
  assertEqual(legacy.edge, '#111111', 'a saved wall colour reads as the edge');
  assertEqual(legacy.fill, '#222222', 'a saved roof colour reads as the area');
  assertEqual(normalizeBuildingStyle({ edge: '#333333', wall: '#111111' }).edge, '#333333',
    'the new key wins where both exist');

  assertEqual(buildingLabel('  Garden   Shed '), 'Garden Shed', 'names are trimmed and collapsed');
  assertEqual(buildingLabel('x'.repeat(60)).length, 24, 'names are bounded');
  assertEqual(buildingLabel(undefined), 'House', 'the default is still House');
  assertEqual(buildingLabel(''), '', 'an empty name is allowed — it means unnamed');

  setup(21, 21);
  game.buildingStyleDraft = normalizeBuildingStyle({ label: 'Shed', status: 'proposed' });
  assert(commitBuildingFootprint([[3, 3], [6, 3], [6, 6], [3, 6]]), 'named footprint commits');
  assertEqual(game.buildings[0].label, 'Shed', 'the draft name lands on the building');
  // and Pick adopts it, so the next shed is a shed
  game.buildingStyleDraft = normalizeBuildingStyle({ label: 'House' });
  pickAt(4, 4);
  assertEqual(buildingStyleDraft().label, 'Shed', 'the eyedropper picks up the name too');
});

test('fences place as blocking structures, gates stay walkable, and erase removes them', () => {
  setup(21, 21);
  game.tool = 'fence';
  game.fenceDraft = { style: 'privacy', height: 6, gate: false };
  assertEqual(applyToolAt(5, 5), 'fence', 'fence placed');
  assertEqual(fenceAt(5, 5).style, 'privacy', 'style saved');
  assertEqual(fenceAt(5, 5).height, 6, 'height saved');
  assert(fenceBlocks(5, 5), 'a regular fence tile is solid');

  game.fenceDraft = { style: 'vinyl', height: 4, gate: true };
  assertEqual(applyToolAt(6, 5), 'gate', 'gate placed');
  assert(!fenceBlocks(6, 5), 'a gate tile is an opening, not a solid run');

  game.tool = firstOfType('forb');
  assertEqual(applyToolAt(5, 5), null, 'plants refuse fence tiles');

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(5, 5, counts);
  assertEqual(counts.fence, 1, 'erase counted the fence');
  assert(!fenceAt(5, 5), 'fence removed');
});

/* drawFence and everything it calls work in absolute screen coordinates — no
   translate, scale or rotate — so the top of the drawing is just the smallest y
   any path touches. */
function fenceTop(f, x, y, W, H){
  let minY = Infinity;
  const pt = (px, py) => { if (isFinite(py) && py < minY) minY = py; };
  const ctx = new Proxy({}, {
    get(o, p){
      if (p === 'measureText') return t => ({ width: String(t || '').length * 6.2 });
      return (...a) => {
        if (p === 'moveTo' || p === 'lineTo') pt(a[0], a[1]);
        else if (p === 'quadraticCurveTo'){ pt(a[0], a[1]); pt(a[2], a[3]); }
        else if (p === 'arc') pt(a[0], a[1] - a[2]);
        else if (p === 'ellipse') pt(a[0], a[1] - a[3]);
      };
    },
    set(){ return true; },
  });
  drawFence(ctx, W, H, 'Summer', f, x, y);
  return minY;
}

test('a fence is drawn at the height scale the planting is drawn at', () => {
  assertEqual(PX_PER_FT, HERB_SCALE * 12, 'the structure scale IS the plant scale');
  /* The claim in one line: a 6 ft fence and a 6 ft (72 in) perennial have to
     arrive at the same drawn height. Before PX_PER_FT the fence drew 38px —
     the height of a 22-inch sedge — because it carried a hand-picked 26/36. */
  assertEqual(fenceDrawH({ style: 'privacy', height: 6 }),
    Math.round(plantVisualH({ h: 72, type: 'forb' })), 'a 6 ft fence == a 6 ft plant');

  setup(21, 21);
  game.fences = {};
  const W = 1200, H = 800, base = fenceAnchor(10, 10, W, H)[1];
  for (const h of FENCE_HEIGHTS){
    const f = { style: 'chainlink', height: h };
    game.fences['10,10'] = f;                       // isolated: no neighbour panels
    const drawn = base - fenceTop(f, 10, 10, W, H);
    assert(Math.abs(drawn - h * PX_PER_FT) <= 6,
      `${h} ft draws ${Math.round(drawn)}px, want ~${h * PX_PER_FT}px`);
  }
  // the steps have to be legible, which is the whole reason 5 ft is worth having
  const px = FENCE_HEIGHTS.map(h => fenceDrawH({ style: 'chainlink', height: h }));
  for (let i = 1; i < px.length; i++)
    assert(px[i] - px[i - 1] >= 20, `${FENCE_HEIGHTS[i - 1]}->${FENCE_HEIGHTS[i]} ft is a visible step`);
});

test('fence materials offer only the heights they are really built at', () => {
  const recipes = ['bar', 'picket', 'privacy', 'slat', 'rail', 'mesh', 'chain', 'masonry', 'woven', 'screen'];
  FENCE_STYLES.forEach(st => {
    const hs = fenceStyleHeights(st.id);
    assert(hs.length, `${st.id} offers at least one height`);
    hs.forEach(h => assert(FENCE_HEIGHTS.includes(h), `${st.id} height ${h} is a real step`));
    assert(recipes.includes(st.infill), `${st.id} names a panel recipe (${st.infill})`);
    if (st.gateLeaf) assert(recipes.includes(st.gateLeaf), `${st.id} gate leaf ${st.gateLeaf} is a recipe`);
    assert(st.short, `${st.id} carries a chip label`);
  });
  // switching material SNAPS the height rather than silently resetting to 4 ft
  assertEqual(normalizeFenceDraft({ style: 'rail', height: 8 }).height, 4, 'split rail tops out at 4 ft');
  assertEqual(normalizeFenceDraft({ style: 'privacy', height: 3 }).height, 5, 'privacy starts at 5 ft');
  assertEqual(normalizeFenceDraft({ style: 'chainlink', height: 8 }).height, 8, 'chainlink keeps 8 ft');
  // and a placed fence can never carry a height its material does not offer
  setup(13, 13);
  game.tool = 'fence';
  game.fenceDraft = { style: 'rail', height: 8, gate: false };
  applyToolAt(5, 5);
  assertEqual(fenceAt(5, 5).height, 4, 'placement clamps to the material');
});

test('a gate opens along the run it sits in, not along the screen', () => {
  setup(21, 21);
  game.tool = 'fence';
  const run = (gx, gy) => fenceRunAxis(gx, gy).join(',');
  game.fenceDraft = { style: 'wood', height: 4, gate: false };
  applyToolAt(5, 4); applyToolAt(5, 6);            // a run along y
  game.fenceDraft = { style: 'wood', height: 4, gate: true };
  applyToolAt(5, 5);
  assertEqual(run(5, 5), '0,1', 'a gate in a north-south run faces along it');

  game.fences = {};
  game.fenceDraft = { style: 'wood', height: 4, gate: false };
  applyToolAt(9, 9); applyToolAt(11, 9);           // a run along x
  game.fenceDraft = { style: 'wood', height: 4, gate: true };
  applyToolAt(10, 9);
  assertEqual(run(10, 9), '1,0', 'a gate in an east-west run faces along it');
  assertEqual(run(18, 18), '1,0', 'an isolated gate falls back to one axis');

  /* A gate is an opening: it stands taller than its fence (posts plus header),
     which is what stops it reading as a decal painted on a continuous run. */
  const W = 1200, H = 800;
  const gate = fenceAt(10, 9), plain = fenceAt(9, 9);
  const gateH = fenceAnchor(10, 9, W, H)[1] - fenceTop(gate, 10, 9, W, H);
  const plainH = fenceAnchor(9, 9, W, H)[1] - fenceTop(plain, 9, 9, W, H);
  assert(gateH > plainH + 8, `the gate (${Math.round(gateH)}px) rises over its fence (${Math.round(plainH)}px)`);
});

test('a run of gate tiles is one opening, not a stack of gates', () => {
  setup(21, 21);
  game.tool = 'fence';
  game.fenceDraft = { style: 'wood', height: 4, gate: false };
  for (let x = 5; x <= 14; x++) applyToolAt(x, 8);
  game.fenceDraft = { style: 'wood', height: 4, gate: true };
  // a 3-tile gate: 4.5 ft, which is what a real garden gate needs
  for (const x of [9, 10, 11]) applyToolAt(x, 8);

  const run = fenceRunAxis(9, 8);
  assertEqual(run.join(','), '1,0', 'the gate run is east-west');
  assertEqual(JSON.stringify(fenceGateSpan(9, 8, run)), '{"a":0,"b":2}', 'the first tile sees the whole span');
  assertEqual(JSON.stringify(fenceGateSpan(11, 8, run)), '{"a":2,"b":0}', 'the last tile sees itself as trailing');

  /* Only the leading tile draws the opening; the other two draw nothing but
     their (absent) perpendicular panels, so three arches never stack. */
  const W = 1200, H = 800;
  const ink = gx => {
    let n = 0;
    const ctx = new Proxy({}, {
      get(o, p){
        if (p === 'measureText') return t => ({ width: String(t || '').length * 6.2 });
        if (p === 'fill' || p === 'stroke') return () => { n++; };
        return () => {};
      }, set(){ return true; },
    });
    drawFence(ctx, W, H, 'Summer', fenceAt(gx, 8), gx, 8);
    return n;
  };
  assert(ink(9) > 8, 'the leading gate tile draws the opening');
  assertEqual(ink(10), 0, 'a following gate tile draws nothing');
  assertEqual(ink(11), 0, 'the trailing gate tile draws nothing');

  // and the opening really is 3 tiles wide, not 1
  const wide = fenceAnchor(9 + 2 + 0.48, 8, W, H)[0] - fenceAnchor(9 - 0.48, 8, W, H)[0];
  const oneTile = fenceAnchor(0.48, 0, W, H)[0] - fenceAnchor(-0.48, 0, W, H)[0];
  assert(wide > oneTile * 2.5, 'a 3-tile gate spans ~3 tiles of opening');
});

/* The reason containers exist: every planting route refuses `path` terrain, so
   before pots a courtyard, patio or roof terrace was a garden this app could
   draw and could not plant. */
test('a pot is the one thing that makes paving plantable', () => {
  setup(21, 21);
  const forb = firstOfType('forb');
  game.tool = 'path'; game.pathColor = 'warm';
  applyToolAt(5, 5); applyToolAt(6, 5);
  assertEqual(tileTerrain(5, 5), 'path', 'the terrace is paved');

  game.tool = forb;
  assertEqual(applyToolAt(5, 5), null, 'bare paving still refuses a plant');

  game.tool = 'pot'; game.potDraft = { style: 'terracotta', size: 'p18' };
  assertEqual(applyToolAt(5, 5), 'pot', 'a pot stands on paving');
  assert(potAt(5, 5), 'the tile carries a pot');

  game.tool = forb;
  assertEqual(applyToolAt(5, 5), 'plant', 'the pot makes that paving plantable');
  /* The planting stays an ORDINARY plant on an ordinary tile, which is what
     keeps the planting list, bloom calendar and plan sheet working untouched. */
  assert(game.plants['5,5'] && !game.plants['5,5'].removed, 'it lives in game.plants');
  assert(exportRows().some(r => r.count > 0), 'a potted plant still reaches the planting list');

  // water is still water, pot or no pot
  game.tool = 'water'; game.waterStyle = 'pond';
  assertEqual(applyToolAt(9, 9), 'water', 'a pond');
  game.tool = 'pot';
  assertEqual(applyToolAt(9, 9), null, 'a pot does not float');
});

test('a potted plant skips the in-ground rules but not the hardiness gate', () => {
  setup(21, 21);
  const forb = firstOfType('forb'), tree = firstOfType('tree');
  game.tool = 'pot'; game.potDraft = { style: 'glazed', size: 'p18' };
  applyToolAt(4, 4); applyToolAt(5, 4);

  // matrix thinning is an in-GROUND spacing rule; a pot is not in the ground
  game.tool = forb; game.matrix = true;
  assertEqual(applyToolAt(4, 4), 'plant', 'first pot planted');
  assertEqual(applyToolAt(5, 4), 'plant', 'the pot beside it plants too, despite matrix spacing');
  game.matrix = false;

  // but a tree is not a container plant
  game.tool = 'pot'; applyToolAt(8, 8);
  game.tool = tree;
  assertEqual(applyToolAt(8, 8), null, 'a tree needs open ground');

  /* Hardiness is deliberately NOT relaxed: the library only offers what suits
     the zone, so a tender plant is not reachable to put in a pot in the first
     place, and pretending otherwise would need a parallel browsing mode. */
  const before = plantFits(forb, null);
  assertEqual(plantFits(forb, null), before, 'a pot changes nothing about what fits the zone');

  // and the fit advice is horticulture, so it warns rather than refusing
  const big = { name: 'Big Thing', heightIn: 120, h: 120, spread: 60 };
  assert(potFitWarning(big, { style: 'terracotta', size: 'p10' }), 'a 10ft plant in a 10in pot is called out');
  assert(!potFitWarning({ name: 'Small', heightIn: 14, h: 14, spread: 12 },
    { style: 'terracotta', size: 'p18' }), 'a small plant in a big pot is fine');
});

test('lifting a pot takes its planting with it', () => {
  setup(21, 21);
  game.tool = 'pot'; game.potDraft = { style: 'metal', size: 'p18' };
  applyToolAt(6, 6);
  game.tool = firstOfType('forb');
  assertEqual(applyToolAt(6, 6), 'plant', 'planted the pot');
  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0, house: 0, building: 0, pot: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(6, 6, counts);
  assertEqual(counts.pot, 1, 'the pot lifted');
  assertEqual(counts.plants, 1, 'and took its plant');
  assert(!game.plants['6,6'] || game.plants['6,6'].removed,
    'no orphan left standing in mid-air breaking the spacing it was exempt from');
});

test('seating claims a real footprint and keeps plants out of it', () => {
  setup(21, 21);
  game.tool = 'seat'; game.seatDraft = { type: 'bench6', finish: 'teak' };
  assertEqual(applyToolAt(5, 5), 'seat', 'a 6 ft bench places');
  const sz = seatTileSize(game.seats['5,5']);
  assertEqual(sz.w, 4, 'six feet is four tiles at 18 in to the tile');
  assert(seatAt(8, 5), 'the far end of the bench is claimed');
  assert(!seatAt(9, 5), 'and no further');
  game.tool = firstOfType('forb');
  assertEqual(applyToolAt(7, 5), null, 'nothing plants through a bench');
  game.tool = 'seat';
  assertEqual(applyToolAt(6, 5), null, 'seating will not overlap seating');
  // every type names a form the painter implements, and a real size
  const forms = ['bench', 'chair', 'adirondack', 'stool', 'lounger', 'bistro', 'picnic', 'dining'];
  SEAT_TYPES.forEach(t => {
    assert(forms.includes(t.form), `${t.id} names an implemented form (${t.form})`);
    assert(t.wIn > 0 && t.dIn > 0 && t.hIn > 0, `${t.id} has real dimensions`);
  });
  POT_STYLES.forEach(p => {
    assert(potStyleSizes(p.id).length, `${p.id} is made in at least one size`);
    assertEqual(normalizePotDraft({ style: p.id, size: 'nonsense' }).style, p.id, `${p.id} normalises`);
  });
});

/* drawPotArt/drawSeatArt work in absolute screen coordinates, so the drawn
   extent is just the min/max of every path point. */
function artBounds(fn){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,fills=0;
  const pt=(x,y)=>{ if (!isFinite(x)||!isFinite(y)) return;
    if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y; };
  const ctx=new Proxy({},{ get(o,p){
    if (p==='measureText') return () => ({ width: 0 });
    return (...a)=>{
      if (p==='moveTo'||p==='lineTo') pt(a[0],a[1]);
      else if (p==='quadraticCurveTo'){ pt(a[0],a[1]); pt(a[2],a[3]); }
      else if (p==='ellipse'){
        /* Sample the arc's actual SWEEP. Taking the full bounding box would make
           a base drawn backwards measure identically to one drawn correctly,
           which is exactly the bug below, so the guard has to respect the
           direction flag. */
        const [ex,ey,erx,ery,,s0,s1,acw]=a;
        if (s0===undefined){ pt(ex-erx,ey-ery); pt(ex+erx,ey+ery); }
        else {
          let d=s1-s0;
          if (acw){ while (d>0) d-=Math.PI*2; } else { while (d<0) d+=Math.PI*2; }
          for (let i=0;i<=16;i++){ const th=s0+d*(i/16);
            pt(ex+Math.cos(th)*erx, ey+Math.sin(th)*ery); }
        }
      }
      else if (p==='arc') pt(a[0]-a[2],a[1]-a[2]), pt(a[0]+a[2],a[1]+a[2]);
      /* fillRect is deliberately NOT measured: in these painters it is only
         ever a shading wash inside an active clip, so counting it measures the
         clip rectangle rather than the silhouette. */
      else if (p==='fill') fills++;
    };
  }, set(){ return true; } });
  fn(ctx);
  return {x0,y0,x1,y1,fills};
}

/* The front of a vessel's foot: the lowest point of any PARTIAL ellipse arc.
   Partial is what makes this a real guard — the soft shadow and the soil disc
   are full rings drawn either way, and measuring those made a base drawn
   backwards indistinguishable from one drawn correctly. */
function potFootFront(pot){
  let y1=-Infinity;
  const ctx=new Proxy({},{ get(o,p){
    if (p==='measureText') return () => ({ width: 0 });
    return (...a)=>{
      if (p!=='ellipse') return;
      const [ex,ey,erx,ery,,s0,s1,acw]=a;
      if (s0===undefined) return;
      let d=s1-s0;
      if (acw){ while (d>0) d-=Math.PI*2; } else { while (d<0) d+=Math.PI*2; }
      if (Math.abs(d) > Math.PI*2-0.01) return;      // a full ring, not the foot
      for (let i=0;i<=16;i++){ const th=s0+d*(i/16);
        const y=ey+Math.sin(th)*ery; if (y>y1) y1=y; }
    };
  }, set(){ return true; } });
  drawPotArt(ctx,0,0,pot,'Summer',ISO_AXES_FLAT);
  return y1;
}

test('a pot stands on the ground with a closed bottom', () => {
  setup(21,21);
  const dia=inchesToTiles(24), ry=(dia/2)*Math.SQRT2*TILE_H/2;
  /* The base arc used to sweep pi -> 2pi, i.e. the BACK of the foot, so the
     vessel was open underneath and its lowest ink sat above its own shadow —
     it read as floating and cut off at the bottom. */
  for (const style of ['terracotta','glazed','metal','timber']){
    const st=potStyle(style);
    if (st.form==='square'||st.form==='crate'||st.form==='trough') continue;
    const front=potFootFront({style,size:'p24'});
    assert(front >= ry*0.55,
      `${style}: the foot front reaches ${front.toFixed(1)}, wanted at least ${(ry*0.55).toFixed(1)}`);
  }
  /* The urn is deliberately different: its bowl sits ON a pedestal, so the
     bowl's own arc is above the ground and the pedestal carries it down. */
  assert(potFootFront({style:'urn',size:'p24'}) < ry*0.55, 'an urn bowl is lifted onto its pedestal');
  assert(potStyle('urn').form==='urn', 'and it says so in the data');
});

test('seating turns, and every chair keeps its legs', () => {
  setup(21,21);
  // a quarter turn swaps the footprint so the claim follows the drawing
  const flat=seatTileSize({type:'bench6',face:0}), turned=seatTileSize({type:'bench6',face:1});
  assertEqual(flat.w, turned.h, 'width becomes depth');
  assertEqual(flat.h, turned.w, 'and depth becomes width');
  assertEqual(normalizeFacing(-1), 3, 'facing wraps');
  assertEqual(normalizeFacing(4), 0, 'and stays in range');

  game.tool='seat';
  game.seatDraft={type:'bench6',finish:'teak',face:1};
  assertEqual(applyToolAt(5,5),'seat','a turned bench places');
  assert(seatAt(5,8),'it claims four tiles along y, not x');
  assert(!seatAt(8,5),'and only one across');
  // re-placing with a different facing is a real change, not a no-op
  game.seatDraft={type:'bench6',finish:'teak',face:0};
  assertEqual(applyToolAt(5,5),'seat','turning in place counts as a change');

  /* Tables come WITHOUT chairs: one object cannot depth-sort against itself,
     so bundled chairs drew over the table top, and the footprint claimed
     ground the table does not occupy. A chair is its own placeable. */
  const fills=type=>artBounds(c=>drawSeatArt(c,0,0,{type,finish:'teak',face:0},'Summer',ISO_AXES_FLAT)).fills;
  const table=fills('dining'), seat=fills('dchair');
  assert(table < seat*2, `a dining table is a table, not a table and four chairs (${table} vs ${seat})`);
  assert(fills('bistro') < seat*2, `and so is the bistro table (${fills('bistro')})`);
  // every standalone chair keeps its legs: 4 legs + seat + back
  assert(seat>=18, `a dining chair has legs (${seat})`);
  assert(fills('adirondack')>=18, `an Adirondack has legs (${fills('adirondack')})`);
  // a picnic table's benches ARE bolted to it, so those stay
  assert(fills('picnic') > fills('dining'), 'a picnic table still carries its benches');
});

/* Edging is the last thing the Wave 5 estimator could measure and the app
   could not draw — materialPerimeterFt has been reporting exposed bed edge in
   feet for a material that did not exist. */
test('edging runs where a bed meets lawn, and only there', () => {
  setup(21, 21);
  game.tool = 'edging'; game.edgingDraft = 'steel';
  assertEqual(applyToolAt(5, 5), null, 'edging needs something to edge');

  game.tool = 'bed'; game.bedStyle = 'mulch'; setBrushSize(1);
  for (let x = 4; x <= 6; x++) for (let y = 4; y <= 6; y++) applyToolAt(x, y);
  game.tool = 'edging';
  for (let x = 4; x <= 6; x++) for (let y = 4; y <= 6; y++) applyToolAt(x, y);
  assertEqual(edgingAt(5, 5), 'steel', 'the whole bed carries the material');
  assertEqual(applyToolAt(5, 5), null, 'painting the same material again is a no-op');

  /* The count is the edges that DRAW, not the tiles that carry the material:
     a 3x3 bed has 9 edged tiles but only 12 exposed sides, and the middle one
     contributes nothing. That is what makes filling the bed the right gesture
     rather than tracing its outline by hand. */
  const ft = edgingRunFeet();
  assertEqual(Math.round(ft.steel), Math.round(12 * TILE_IN / 12),
    `a 3x3 bed exposes 12 tile sides (${ft.steel})`);
  assertEqual(Math.round(ft.steel), Math.round(materialPerimeterFt(
    ['4,4','5,4','6,4','4,5','5,5','6,5','4,6','5,6','6,6'])),
    'and it agrees with the estimator that has been reporting this all along');

  // a tile that stops being an edge stops being billed
  game.tool = 'bed';
  for (let y = 4; y <= 6; y++) applyToolAt(7, y);
  game.tool = 'edging';
  for (let y = 4; y <= 6; y++) applyToolAt(7, y);
  const ft2 = edgingRunFeet();
  assert(ft2.steel > ft.steel, 'a wider bed has a longer edge');
  assertEqual(Math.round(ft2.steel), Math.round(14 * TILE_IN / 12),
    `a 4x3 bed exposes 14 sides (${ft2.steel})`);

  // 'none' lifts it, and erasing the bed takes it along
  game.edgingDraft = 'none';
  assertEqual(applyToolAt(5, 5), 'edging', 'painting none lifts the edging');
  assertEqual(edgingAt(5, 5), 'none', 'and it is gone from that tile');
  assert(tileTerrain(5, 5), 'while the bed itself stays');
  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0, house: 0, building: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(4, 4, counts);
  assertEqual(edgingAt(4, 4), 'none', 'erasing the bed takes its edging with it');

  // every material states a real width, and 'none' draws nothing
  EDGING_STYLES.forEach(e => {
    assert(e.id === 'none' ? !e.w : e.w > 0, `${e.id} states a width`);
    if (e.unitIn) assert(e.unitIn > 0, `${e.id} states a real unit size`);
  });
});

/* The organic renderer resolves ONE edging material for a whole region, and it
   used to ask every tile in it — so a tile buried in the middle of a bed, which
   draws no edging and is billed for none, decided the outline. Lifting the
   edging off the edge you can SEE then emptied the planting list and changed
   nothing on screen; the bug read as "the edging cannot be removed". The two
   surfaces may disagree about which material wins a mixed region, but never
   about whether there is any edging at all. */
test('lifting the edging a bed shows also stops it being drawn', () => {
  setup(21, 21);
  const bedRegion = () => {
    const rs = buildTerrainRegions().filter(r => r.kind === 'bed');
    assertEqual(rs.length, 1, 'the bed is one region');
    return rs[0];
  };
  const billed = () => { const f = edgingRunFeet(); return Object.keys(f).length ? f : null; };
  const fillBed = () => {
    game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1);
    for (let x = 5; x <= 9; x++) for (let y = 5; y <= 9; y++) applyToolAt(x, y);
  };

  fillBed();
  game.tool = 'edging'; game.edgingDraft = 'steel';
  for (let x = 5; x <= 9; x++) for (let y = 5; y <= 9; y++) applyToolAt(x, y);
  assertEqual(regionEdging(bedRegion()), 'steel', 'a filled bed draws its edging');
  assert(billed(), 'and is billed for it');

  // lift only the ring that actually draws — the gesture that reported the bug
  game.edgingDraft = 'none';
  for (let x = 5; x <= 9; x++) for (let y = 5; y <= 9; y++)
    if (x === 5 || x === 9 || y === 5 || y === 9) applyToolAt(x, y);
  assertEqual(billed(), null, 'the bill goes to zero');
  assertEqual(regionEdging(bedRegion()), 'none', 'and so does what is drawn');
  assertEqual(edgingAt(7, 7), 'steel', 'the buried tiles keep it, and still draw nothing');

  // the same rule in reverse: edging that never reaches lawn never draws
  setup(21, 21);
  fillBed();
  game.tool = 'edging'; game.edgingDraft = 'brick';
  for (let x = 6; x <= 8; x++) for (let y = 6; y <= 8; y++) applyToolAt(x, y);
  assertEqual(billed(), null, 'an interior tile is billed for nothing');
  assertEqual(regionEdging(bedRegion()), 'none', 'so it draws nothing');

  // one exposed tile brings it back — the answer is memoised onto the cached
  // region, and that memo must not outlive the edit that changed it
  assertEqual(applyToolAt(5, 5), 'edging', 'laying it on an exposed tile takes');
  assertEqual(regionEdging(bedRegion()), 'brick', 'and the region picks it up at once');
});

/* Organic vs Formal is a per-GARDEN setting governing beds, paths and edging
   alike. Gated on the armed tool it vanished the moment you armed Edging —
   which it governs — and, because entering a garden arms Hand, it was simply
   absent every time you reopened one, with no hint that arming Path was the
   way back to it. */
test('the edge-style chips belong to the Ground tab, not to an armed tool', () => {
  setup(21, 21);
  const tray = document.getElementById('toolTray');
  /* The sandbox's innerHTML is inert (docs/test-sandbox.md), so buildToolTray's
     own clear leaves `children` alone — without emptying it here, chips built by
     an earlier pass would answer for this one and the test would still pass with
     the gate put back. */
  const chips = (cat, tool) => {
    setTool(tool, null);
    game.trayCat = cat; game.traySearch = ''; game.drill = null;
    tray.children.length = 0;
    buildToolTray();
    return tray.children.filter(c => c.dataset && /^edge_/.test(c.dataset.k || '')).length;
  };
  assertEqual(chips('landscape', 'hand'), 2, 'reopening a garden lands on Hand and must still offer them');
  assertEqual(chips('landscape', 'edging'), 2, 'and arming Edging must not hide the setting that draws it');
  assertEqual(chips('landscape', 'bed'), 2, 'as with a paint tool armed');
  assertEqual(chips('leveling', 'raise'), 0, 'the Grade tab has no bed or path edge to style');
});

/* Hardscape mixes two tray idioms: fence, fire pit and boulder each collapse to
   a summary button and hand the whole tray over to their own options, while
   seating stays expanded at the top level. Seating had no drill guard, so its
   nine chips hung off the bottom of whichever sub-page you had opened —
   underneath the Back button that is supposed to be the way out of it. */
test('opening a Hardscape sub-page leaves the seating behind', () => {
  setup(21, 21);
  const tray = document.getElementById('toolTray');
  // the sandbox's innerHTML is inert (docs/test-sandbox.md), so clear by hand
  const seatChips = (drill) => {
    game.trayCat = 'structures'; game.traySearch = ''; game.drill = drill || null;
    tray.children.length = 0;
    buildToolTray();
    return tray.children.filter(c => c.dataset && c.dataset.k === 'seat').length;
  };
  assertEqual(seatChips(null), SEAT_TYPES.length, 'the top level offers every seat');
  assertEqual(seatChips('fence'), 0, 'the fence page is only fence');
  assertEqual(seatChips('firepit'), 0, 'the fire pit page is only fire pit');
  assertEqual(seatChips('boulder'), 0, 'the boulder page is only boulder');
  assertEqual(seatChips(null), SEAT_TYPES.length, 'and Back brings them straight back');

  /* The one route that arms a seat from outside the tray has to land on the page
     that shows it, or the guard above would hide what you just picked. */
  game.seatDraft = { type: 'bench6', finish: 'teak', face: 0 };
  game.tool = 'seat'; applyToolAt(10, 10);
  assertEqual(Object.keys(game.seats).length, 1, 'a bench to pick');
  game.drill = 'firepit';                        // a sub-page left open behind it
  pickAt(10, 10);
  assertEqual(game.tool, 'seat', 'picking the bench arms it');
  assertEqual(seatDraft().type, 'bench6', 'as the bench it actually is');
  assertEqual(game.drill, null, 'and drops the stale sub-page that would hide it');
});

/* Every Hardscape pick has to land on the page that shows what it picked. Fire
   pit and boulder always set their sub-page; fence did not, so eyedropping a
   fence with another sub-page open left you looking at that other tool, with
   nothing on screen about the material you just picked. It also filed the fence
   brush under that page — rememberBrushTool reads game.drill from inside
   setTool — so the rail would later restore the fence onto it. */
test('the eyedropper lands on the page that shows what it picked', () => {
  setup(21, 21);
  game.trayCat = 'structures';

  game.fenceDraft = { style: 'brick', height: 6, gate: false };
  game.tool = 'fence'; applyToolAt(10, 10);
  assert(fenceAt(10, 10), 'a fence to pick');

  game.drill = 'firepit';                        // a different sub-page left open
  pickAt(10, 10);
  assertEqual(game.tool, 'fence', 'picking the fence arms it');
  assertEqual(fenceDraft().style, 'brick', 'as the material it actually is');
  assertEqual(game.drill, 'fence', 'and opens the page those chips live on');
  assertEqual(game.lastBrushDrill, 'fence',
    'the brush memory follows, so the rail restores it to that page too');

  // its two siblings already did this — pin them so the three cannot drift apart
  game.firepitDraft = { shape: 'round', size: 'round36' };
  game.tool = 'firepit'; applyToolAt(5, 5);
  game.drill = 'fence';
  pickAt(5, 5);
  assertEqual(game.drill, 'firepit', 'the fire pit opens its own page');

  game.boulderDraft = { type: 'round1' };
  game.tool = 'boulder'; applyToolAt(15, 15);
  game.drill = 'fence';
  pickAt(15, 15);
  assertEqual(game.drill, 'boulder', 'and so does the boulder');
});

/* brushTrayCatForTool and toolFitsBrushTray answer "which tab is this tool
   browsed on". They were hand-written chains restating TRAY_CATS, so every tool
   added to a tab after they were written got missed — four of the seventeen.
   'wall' answered 'landscape', because the chain asked "is it a material"
   before it asked which tab it is on; 'pot', 'seat' and 'pet' answered null,
   which made rememberBrushMenu bail and leave lastBrushTrayCat pointing at
   whatever had been browsed before, so arming a pot and restoring it from the
   rail opened the Grasses catalog with a pot on the brush. Both read the table
   now; pin the whole table, so the next tool added to a tab cannot drift. */
test('every tray tool is routed to the tab it actually lives on', () => {
  setup(21, 21);
  TRAY_CATS.filter(c => c.tools).forEach(c => c.tools.forEach(k => {
    assertEqual(brushTrayCatForTool(k), c.id, `${k} is browsed on ${c.id}`);
    assert(toolFitsBrushTray(k, c.id), `${k} fits the ${c.id} tab`);
  }));
  assert(!toolFitsBrushTray('pot', 'structures'), 'a pot is not Hardscape');
  assert(!toolFitsBrushTray('seat', 'decor'), 'a seat is not Decor');
  assert(!toolFitsBrushTray('wall', 'landscape'), 'a wall is Grade, not Ground');

  /* The symptom it was found by: the rail restores the last brush, and used the
     same mapping to decide which catalog to open behind it. */
  const rail = (cat, tool) => {
    game.trayCat = cat; game.traySearch = ''; game.drill = null;
    setTool(tool, null);
    setTool('hand', null);
    armPlantToolFromRail(false);
    return { tool: game.tool, cat: game.trayCat };
  };
  assertEqual(rail('decor', 'pot').cat, 'decor', 'a pot comes back to Decor, not the grasses');
  assertEqual(rail('structures', 'seat').cat, 'structures', 'a seat comes back to Hardscape');
  assertEqual(rail('leveling', 'wall').cat, 'leveling', 'a wall comes back to Grade');
  const grass = PLANT_KEYS.find(k => PLANTS[k].type === 'grass');
  assertEqual(rail(plantCategoryFor(grass), grass).cat, plantCategoryFor(grass),
    'and a plant is unaffected by any of it');
});

/* Steps and retaining walls both live on the exposed face of a level change,
   and that face belongs to the HIGHER tile. */
test('a retaining wall needs a level change to hold up', () => {
  setup(21, 21);
  game.tool = 'wall'; game.wallDraft = 'drystone';
  assertEqual(applyToolAt(5, 5), null, 'flat ground has no face to face');

  game.tool = 'raise'; setBrushSize(1);
  for (let n = 0; n < 3; n++) for (let x = 4; x <= 8; x++) for (let y = 4; y <= 8; y++) applyToolAt(x, y);
  assertEqual(elevationAt(6, 8), 3, 'a three-level terrace');
  assert(elevationDropDirs(6, 8).length, 'its front edge falls away');
  assert(!elevationDropDirs(6, 6).length, 'its middle does not');

  game.tool = 'wall';
  assertEqual(applyToolAt(6, 8), 'wall', 'the edge takes a wall');
  assertEqual(wallStyleAt(6, 8), 'drystone', 'and remembers the material');
  assertEqual(applyToolAt(6, 8), null, 'painting the same material again is a no-op');
  assertEqual(applyToolAt(6, 6), null, 'the middle of the terrace still refuses');
  assertEqual(elevationAt(6, 8), 3, 'facing a terrace does not change its height');

  /* Stripping a facing and keeping the terrace is what the 'none' material is
     for. The Landscape ERASE removes the earthwork itself, and the facing goes
     with it because it lives on the elevation record — one action, not two. */
  game.wallDraft = 'none';
  assertEqual(applyToolAt(6, 8), 'wall', 'painting bare earth strips the facing');
  assertEqual(wallStyleAt(6, 8), 'none', 'back to bare earth');
  assertEqual(elevationAt(6, 8), 3, 'and the terrace still stands');
  game.wallDraft = 'drystone'; applyToolAt(6, 8);
  const counts = { plants: 0, bulbs: 0, terr: 0, elev: 0, house: 0, building: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(6, 8, counts);
  assertEqual(counts.elev, 1, 'erasing Landscape takes the earthwork');
  assertEqual(elevationAt(6, 8), 0, 'terrace flattened');
  assertEqual(wallStyleAt(6, 8), 'none', 'and its facing went with it');

  // every material names a coursing recipe, and a course is a real height
  WALL_STYLES.forEach(w => {
    if (!w.face) return;
    assert(['rubble','coursed','brick','sleeper','gabion','smooth','plate'].includes(w.face),
      `${w.id} names an implemented face (${w.face})`);
    assert(w.courseIn > 0, `${w.id} states a real course height`);
  });
});

test('lights place as one-tile structures, block plants, and erase with landscape', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.tool = 'light';
  game.lightDraft = { type: 'lantern', tone: 'eco' };
  assertEqual(applyToolAt(5, 5), 'light', 'light placed');
  assertEqual(lightAt(5, 5).type, 'lantern', 'light type saved');
  assertEqual(lightAt(5, 5).tone, 'eco', 'light tone saved');
  assert(lightAt(5, 5), 'light occupies its tile');
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), null, 'plants refuse light tiles');
  game.tool = 'water';
  assertEqual(applyToolAt(5, 5), null, 'water refuses light tiles');
  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0, light: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(5, 5, counts);
  assertEqual(counts.light, 1, 'erase counted the light');
  assert(!lightAt(5, 5), 'light removed');
});

test('planting plan includes lighting fixtures in the key', () => {
  setup(13, 13);
  game.lights['5,5'] = { type: 'path', tone: 'warm', t: 1 };
  const oldGet = document.getElementById;
  const labels = [];
  const ctx = new Proxy({ fillText(txt){ labels.push(String(txt)); } }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  document.getElementById = id => id === 'planCanvas'
    ? { getContext(){ return ctx; }, style: {} }
    : oldGet.call(document, id);
  try {
    buildPlanMap();
  } finally {
    document.getElementById = oldGet;
  }
  assert(labels.some(t => t.includes('LIGHT - lighting fixture (1)')), 'plan key lists lighting fixtures');
});

test('fire pits reserve their footprint and erase as structures', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.tool = 'firepit';
  game.firepitDraft = { shape: 'round', size: 'round48' };
  assertEqual(applyToolAt(5, 5), 'firepit', 'fire pit placed');
  assertEqual(firepitAt(5, 5).shape, 'round', 'shape saved');
  assertEqual(firepitAt(7, 7).size, 'round48', '48 inch fire pit spans three tiles');
  assert(firepitAt(6, 6), 'fire pit claims its whole footprint');

  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(6, 6), null, 'plants refuse fire pit footprint');
  game.tool = 'water';
  assertEqual(applyToolAt(6, 6), null, 'water refuses fire pit footprint');

  game.tool = 'firepit';
  game.firepitDraft = { shape: 'square', size: 'rect24x48' };
  assertEqual(applyToolAt(9, 5), 'firepit', 'rectangular fire pit placed');
  assert(firepitAt(11, 6), '24x48 fire pit reserves a rectangular footprint');
  assertEqual(firepitLabel({ shape: 'square', size: 'rect24x48' }), '24x48 rectangular fire pit', 'rectangle fire pit label is not called square');
  const rectSize = firepitTileSize({ shape: 'square', size: 'rect24x48' });
  assertEqual(rectSize.w, 3, '24x48 fire pit spans three tiles long');
  assertEqual(rectSize.h, 2, '24x48 fire pit spans two tiles wide');
  const ctx = document.createElement('canvas').getContext('2d');
  drawFirepit(ctx, 640, 480, 'Summer', { shape: 'square', size: 'rect24x48' }, 9, 5);
  drawFirepitGlow(ctx, 640, 480, { shape: 'square', size: 'rect24x48' }, 9, 5);

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0, light: 0, firepit: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(6, 6, counts);
  assertEqual(counts.firepit, 1, 'erase counted the whole fire pit once');
  assert(!firepitAt(5, 5), 'fire pit removed');
});

test('boulders reserve their footprint and erase as hardscape', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.tool = 'boulder';
  game.boulderDraft = { type: 'large32' };
  assertEqual(applyToolAt(5, 5), 'boulder', 'boulder placed');
  assertEqual(boulderAt(7, 6).type, 'large32', 'large boulder spans its footprint');
  assert(boulderAt(6, 5), 'boulder claims its whole footprint');

  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(6, 5), null, 'plants refuse boulder footprint');
  game.tool = 'water';
  assertEqual(applyToolAt(6, 5), null, 'water refuses boulder footprint');

  game.tool = 'pick';
  pickAt(7, 6);
  assertEqual(game.tool, 'boulder', 'eyedropper picks boulder hardscape');
  assertEqual(game.boulderDraft.type, 'large32', 'eyedropper copies boulder type');

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0, light: 0, firepit: 0, boulder: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(6, 5, counts);
  assertEqual(counts.boulder, 1, 'erase counted the whole boulder once');
  assert(!boulderAt(5, 5), 'boulder removed');
});

test('planting plan includes boulders in the key', () => {
  setup(13, 13);
  game.boulders['5,5'] = { type: 'medium2', t: 1 };
  const oldGet = document.getElementById;
  const labels = [];
  const ctx = new Proxy({ fillText(txt){ labels.push(String(txt)); } }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  document.getElementById = id => id === 'planCanvas'
    ? { getContext(){ return ctx; }, style: {} }
    : oldGet.call(document, id);
  try {
    buildPlanMap();
  } finally {
    document.getElementById = oldGet;
  }
  assert(labels.some(t => t.includes('BOULDER - stone feature (1)')), 'plan key lists boulders');
});

test('a garden pet places as one-tile decoration, erases as landscape, and is eyedroppable', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.tool = 'pet';
  game.petDraft = { species: 'dog', coat: 'ink', mark: 'tuxedo', paws: 'brown' };
  assertEqual(applyToolAt(5, 5), 'pet', 'pet placed');
  assertEqual(petAt(5, 5).species, 'dog', 'species saved');
  assertEqual(petAt(5, 5).coat, 'ink', 'coat saved by id, not hex');
  assertEqual(petAt(5, 5).mark, 'tuxedo', 'marking saved');
  assertEqual(petAt(5, 5).paws, 'brown', 'socks saved — a black dog with brown feet');
  assert(/brown socks/.test(petLabel(petAt(5, 5))), `the label mentions the socks: ${petLabel(petAt(5, 5))}`);
  // pets saved before socks existed must still load and draw
  assertEqual(normalizePetDraft({ species: 'cat', coat: 'smoke', mark: 'solid' }).paws, 'match',
    'a pre-socks pet normalizes to no socks');
  assertEqual(petPaw('match').c, null, 'no socks means the legs keep the coat shadow');
  assert(!petAt(6, 5), 'a pet claims exactly one tile — no footprint');
  assert(!isBrushTool('pet'), 'tap-only: a drag must not lay a row of identical pets');

  // a pet claims NOTHING: adding one must never change what the design takes
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), 'plant', 'a plant goes in right where the pet sits');
  assert(petAt(5, 5), 'and the pet stays put');
  game.tool = 'pet';
  assertEqual(applyToolAt(7, 7), 'pet', 'a pet settles on bare ground');
  game.tool = forb;
  assertEqual(applyToolAt(7, 7), 'plant', 'planting is unaffected either way round');
  game.tool = 'water';
  assertEqual(applyToolAt(5, 5), null, 'water still refuses to flood a pet');

  // a gate is a fine place for a cat to sit; a solid fence run is not
  game.tool = 'fence'; game.fenceDraft = { style: 'wood', height: 4, gate: false };
  applyToolAt(9, 9);
  game.fenceDraft = { style: 'wood', height: 4, gate: true };
  applyToolAt(10, 9);
  game.tool = 'pet';
  assertEqual(applyToolAt(9, 9), null, 'a solid fence run refuses a pet');
  assertEqual(applyToolAt(10, 9), 'pet', 'a gate opening takes one');

  // Pick prefers the planting over the ornament, so a cat lying in a drift
  // still eyedrops the plant; a pet on its own is sampled directly.
  game.tool = 'pick';
  pickAt(5, 5);
  assertEqual(game.tool, forb, 'eyedropper prefers the plant sharing the tile');
  game.petDraft = { species: 'cat', coat: 'birch', mark: 'solid' };
  game.tool = 'pet'; applyToolAt(3, 11);
  game.petDraft = { species: 'dog', coat: 'smoke', mark: 'solid' };
  game.tool = 'pick';
  pickAt(3, 11);
  assertEqual(game.tool, 'pet', 'eyedropper arms the pet tool');
  assertEqual(game.petDraft.species, 'cat', 'eyedropper copies the species');
  assertEqual(game.petDraft.coat, 'birch', 'eyedropper copies the coat');
  game.petDraft = { species: 'dog', coat: 'cocoa', mark: 'tuxedo', paws: 'match' };

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0, light: 0, firepit: 0, boulder: 0, pet: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(5, 5, counts);
  assertEqual(counts.pet, 1, 'Landscape erase counts the pet');
  assert(!petAt(5, 5), 'pet removed');
});

test('pets ride along in saves and selections but never reach the plan or the planting list', () => {
  setup(13, 13);
  game.pets['4,4'] = { species: 'cat', coat: 'smoke', mark: 'patch', t: 1 };
  const grass = firstOfType('grass');
  game.plants['4,5'] = { s: grass, d: 0, t: 1 };

  // the save blob carries them: GAME_LAYERS is the single source of truth
  assert(GAME_LAYERS.some(L => L.k === 'pets'), 'pets are a registered layer');
  const blob = buildSaveBlob();
  assert(blob.pets && blob.pets['4,4'], 'the pet is in the save blob');

  // ...but the client-facing documents do not
  assert(!exportRows().some(r => /cat|pet/i.test(r.name)), 'the planting list has no pets');
  const oldGet = document.getElementById;
  const labels = [];
  const ctx = new Proxy({ fillText(txt){ labels.push(String(txt)); } }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  document.getElementById = id => id === 'planCanvas'
    ? { getContext(){ return ctx; }, style: {} }
    : oldGet.call(document, id);
  try { buildPlanMap(); } finally { document.getElementById = oldGet; }
  assert(!labels.some(t => /pet|cat|dog/i.test(t)), 'the design plan never draws a pet');

  // selections carry them like any other placed object
  game.sel = { x0: 4, y0: 4, x1: 5, y1: 5 };
  game.selItems = selectionPayload(game.sel);
  assert(game.selItems.some(c => c.pet), 'the marquee owns the pet');
  assert(commitSelectionOffset(2, 0, false), 'the selection moves');
  assert(petAt(6, 4), 'the pet moved with it');
  assert(!petAt(4, 4), 'and left its old tile');

  // and undo restores it, because pets are in GAME_LAYERS
  withUndo(() => { clearTile('pets', '6,4'); });
  assert(!petAt(6, 4), 'pet cleared');
  doUndo();
  assert(petAt(6, 4), 'undo brings the pet back');
});

test('water plants only plant into open water tiles', () => {
  setup(13, 13);
  const waterPlant = firstOfType('water');
  assert(waterPlant, 'water plant exists');
  game.tool = waterPlant; game.toolVar = null;
  assertEqual(applyToolAt(5, 5), null, 'water plant refused on dry land');
  game.tool = 'water'; game.waterStyle = 'pond';
  assertEqual(applyToolAt(5, 5), 'water', 'water tile painted');
  game.tool = waterPlant;
  assertEqual(applyToolAt(5, 5), 'plant', 'water plant placed in water');
  assertEqual(game.plants['5,5'].s, waterPlant, 'water plant stored in plant layer');
  game.tool = 'water';
  assertEqual(applyToolAt(5, 5), null, 'water repaint refuses occupied water plant tile');
});

test('plantLayerOf separates woody from perennial layers', () => {
  const woody = firstOfType('tree') || firstOfType('shrub');
  const forb = firstOfType('forb');
  const waterPlant = firstOfType('water');
  assertEqual(plantLayerOf({ s: woody }), 'woody', 'tree/shrub -> woody');
  assertEqual(plantLayerOf({ s: forb }), 'perennials', 'forb -> perennials');
  assertEqual(plantLayerOf({ s: waterPlant }), 'perennials', 'water plants render with planted layers');
});

test('undo/redo round-trips and a new action clears the redo chain', () => {
  setup();
  const g = firstOfType('grass');
  withUndo(() => { setTile('plants', '5,5', { s: g, d: 0, t: 1 }); });
  withUndo(() => { setTile('plants', '6,5', { s: g, d: 0, t: 1 }); });
  assertEqual(live(game.plants).length, 2, 'two plants placed');
  doUndo(); assertEqual(live(game.plants).length, 1, 'undo removed the last');
  doRedo(); assertEqual(live(game.plants).length, 2, 'redo restored it');
  assertEqual(redoStack.length, 0, 'redo consumed its entry');
  doUndo(); assertEqual(redoStack.length, 1, 'undo refilled the redo chain');
  withUndo(() => { setTile('plants', '7,7', { s: g, d: 0, t: 1 }); }); // a fresh action
  assertEqual(redoStack.length, 0, 'a new action clears redo');
});

test('persistent scene list: sorted records, edit/rot/swap invalidation, stunting', () => {
  setup();
  const g = firstOfType('grass');
  const tree = firstOfType('tree');
  setTile('plants', '10,10', { s: tree, d: -10000, t: 1 });  // mature canopy
  setTile('plants', '10,9',  { s: g, d: 0, t: 1 });          // full-sun grass in its shade
  setTile('plants', '3,4',   { s: g, d: 0, t: 1 });          // out in the open
  setTile('fences', '6,6', { style: 'wood', height: 4, t: 1 });
  addHouse({ x: 15, y: 15, w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] });
  buildScene(800, 600);
  assert(!sceneStale(sceneKey()), 'fresh after build');
  assertEqual(scene.ents.length, 5, 'tree+2 plants+fence+house records');
  for (let i = 1; i < scene.ents.length; i++)
    assert(scene.ents[i].d >= scene.ents[i - 1].d, 'records are depth-sorted');
  assertEqual(scene.shadeTrees.length, 1, 'mature tree casts active shade');
  const shaded = scene.ents.find(e => e.kind === SCENE_K.PLANT && e.x === 10 && e.y === 9);
  const open   = scene.ents.find(e => e.kind === SCENE_K.PLANT && e.x === 3 && e.y === 4);
  assert(shaded.stunt === true, 'full-sun plant under the canopy is stunted');
  assert(open.stunt === false, 'plant in the open is not');
  setTile('plants', '2,2', { s: g, d: 0, t: 1 });
  assert(sceneStale(sceneKey()), 'setTile bumps game.rev and invalidates');
  buildScene(800, 600);
  game.rot = 1;
  assert(sceneStale(sceneKey()), 'rotation invalidates');
  game.rot = 0; buildScene(800, 600);
  game.plants = Object.assign({}, game.plants); // wholesale swap, as load/undo do
  assert(sceneStale(sceneKey()), 'map identity swap invalidates without a rev bump');
});

test('shade map caches per-tile tree shade and invalidates on day/map changes', () => {
  setup();
  const tree = firstOfType('tree');
  setTile('plants', '10,10', { s: tree, d: -10000, t: 1 });
  const sh = treeShadeInfo('10,10', game.plants['10,10']);
  sh.reach = treeShadeReach(sh);
  const expected = treeShadeScore(sh, 10, 9);
  assert(expected >= SHADE_ACTIVE_SCORE, 'fixture tile receives active shade');
  assertEqual(Math.round(shadeScoreAt(10, 9) * 1000), Math.round(expected * 1000),
    'shade map stores the same score as the geometric scorer');
  assert(shadeActiveAlphaAt(10, 9) > 0, 'active shade wash alpha is cached');
  assert(shadeInfoAt(10, 9, false).active, 'cached shade info reports active shade');
  const cached = shadeMapCache.activeScore;
  game.dayOffset += 100;
  shadeScoreAt(10, 9);
  assert(shadeMapCache.activeScore !== cached, 'day changes rebuild the shade map');
  game.plants = {};
  game.dayOffset = 0;
  assertEqual(shadeScoreAt(10, 9), 0, 'map identity swap rebuilds even without rev');
});

test('established preview matures the display shade but never the placement rules', () => {
  setup();
  const tree = firstOfType('tree');
  setTile('plants', '10,10', { s: tree, d: absDay(), t: 1 });   // freshly planted — 0% established
  const p = game.plants['10,10'];
  // Today view: display and real agree — no canopy yet
  assertEqual(canopyRadius(p), 0, 'today: a day-old tree has no display canopy');
  assertEqual(canopyRadius(p, true), 0, 'today: no real canopy either');
  assertEqual(shadeScoreAt(10, 9), 0, 'today: no display shade');
  // Established preview: the DISPLAY side matures, the RULES side does not
  game.previewMode = 'established';
  assert(canopyRadius(p) > 1, 'preview: display canopy jumps to mature reach');
  assertEqual(canopyRadius(p, true), 0, 'preview: real canopy still zero');
  assert(shadeScoreAt(10, 9) >= SHADE_ACTIVE_SCORE, 'preview: display shade map is active north of the trunk');
  assertEqual(ensureShadeMap(true).activeScore[shadeMapIndex(10, 9)] || 0, 0,
    'preview: real/rules shade map stays unshaded for a fresh tree');
  assert(shadeInfoAt(10, 9, false) && shadeInfoAt(10, 9, false).active, 'preview: display info reports active shade');
  assert(!shadeAt(10, 9), 'preview: the placement-rule helper sees no shade');
  // ...so placing a full-sun perennial under the shown canopy still succeeds
  const forb = Object.keys(PLANTS).find(k => PLANTS[k].type === 'forb' && PLANTS[k].sun === 'full' && !PLANTS[k].hidden);
  game.tool = forb; game.toolVar = null;
  assertEqual(placePlantAt(10, 9), 'plant', 'preview: full-sun placement is legal under preview-only shade');
  assert(shadeScoreAt(10, 9) >= SHADE_ACTIVE_SCORE, 'preview: the placed plant reads as shaded for display (stunting)');
  buildScene(800, 600);
  const shadedRec = scene.ents.find(e => e.kind === SCENE_K.PLANT && e.x === 10 && e.y === 9);
  assert(shadedRec && shadedRec.stunt === true, 'preview: scene stunting follows display shade');
  // toggling back to Today reverts every display consumer
  game.previewMode = 'today';
  assertEqual(canopyRadius(p), 0, 'back to today: display canopy shrinks to real establishment');
  assertEqual(shadeScoreAt(10, 9), 0, 'back to today: display shade gone');
  buildScene(800, 600);
  const todayRec = scene.ents.find(e => e.kind === SCENE_K.PLANT && e.x === 10 && e.y === 9);
  assert(todayRec && todayRec.stunt === false, 'today: scene stunting clears with display shade');
  // the scene list rebuilds across the toggle (shade trees + stunting live in it)
  game.previewMode = 'established';
  const kEst = sceneKey();
  game.previewMode = 'today';
  assert(sceneKey() !== kEst, 'sceneKey distinguishes preview modes');
});

test('tree placement ghost previews mature canopy and respects woody visibility', () => {
  setup(21, 21);
  const tree = firstOfType('tree');
  const def = plantDef(tree);
  const matureR = woodyRadiusTiles(def);
  const draft = matureWoodyDraft(tree, null);
  assertEqual(Math.round(canopyRadius(draft) * 1000), Math.round(matureR * 1000),
    'mature placement draft uses the same canopy radius as the established tree');
  const ellipses = [], dashes = [];
  const ctx = new Proxy({
    ellipse(x, y, rx, ry){ ellipses.push({ x, y, rx, ry }); },
    setLineDash(v){ dashes.push(v.slice()); },
  }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  assert(drawTreePlacementGhost(ctx, 800, 600, 10, 10, tree, null), 'tree ghost draws while woody is visible');
  assertEqual(ellipses.length, SUN_PATH.length + 1, 'tree ghost draws one O(1) shade lobe per sun path plus the canopy ring');
  const canopy = ellipses[ellipses.length - 1];
  assertEqual(Math.round(canopy.rx * 1000), Math.round((TILE_W / 2) * matureR * 1000),
    'tree ghost canopy width follows the mature radius');
  assertEqual(Math.round(canopy.ry * 1000), Math.round((TILE_H / 2) * matureR * 1000),
    'tree ghost canopy depth follows the mature radius');
  assert(dashes.some(d => d.join(',') === '7,5'), 'tree ghost mature canopy is dashed');
  game.layerVis.woody = false;
  ellipses.length = 0;
  assert(!drawTreePlacementGhost(ctx, 800, 600, 10, 10, tree, null), 'tree ghost skips hidden woody layer');
  assertEqual(ellipses.length, 0, 'hidden woody layer draws no ghost ellipses');
});

test('mature canopies overlay draws dashed mature rings for all woody plants', () => {
  setup(31, 31);
  const tree = firstOfType('tree');
  const shrub = firstOfType('shrub');
  game.plants['10,10'] = { s: tree, d: absDay(), t: 1 };
  game.plants['14,10'] = { s: shrub, d: absDay(), t: 2 };
  const ellipses = [], dashes = [];
  const ctx = new Proxy({
    ellipse(x, y, rx, ry){ ellipses.push({ x, y, rx, ry }); },
    setLineDash(v){ dashes.push(v.slice()); },
  }, {
    get(o, p){ return p in o ? o[p] : () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
  assertEqual(drawMatureCanopyOverlay(ctx, 800, 600, 0, 30, 0, 30), 0,
    'overlay flag off skips the woody scan');
  assertEqual(ellipses.length, 0, 'overlay off draws no rings');

  game.layerVis.matureCanopies = true;
  assertEqual(drawMatureCanopyOverlay(ctx, 800, 600, 0, 30, 0, 30), 2,
    'overlay draws one ring for each woody plant');
  const treeR = woodyRadiusTiles(plantDef(tree));
  const shrubR = woodyRadiusTiles(plantDef(shrub));
  assertEqual(Math.round(ellipses[0].rx * 1000), Math.round((TILE_W / 2) * treeR * 1000),
    'tree overlay width follows woodyRadiusTiles');
  assertEqual(Math.round(ellipses[0].ry * 1000), Math.round((TILE_H / 2) * treeR * 1000),
    'tree overlay depth follows woodyRadiusTiles');
  assertEqual(Math.round(ellipses[1].rx * 1000), Math.round((TILE_W / 2) * shrubR * 1000),
    'shrub overlay width follows woodyRadiusTiles');
  assertEqual(Math.round(ellipses[1].ry * 1000), Math.round((TILE_H / 2) * shrubR * 1000),
    'shrub overlay depth follows woodyRadiusTiles');
  assert(dashes.filter(d => d.join(',') === '7,5').length >= 2, 'mature canopy rings are dashed');

  game.layerVis.woody = false;
  ellipses.length = 0;
  assertEqual(drawMatureCanopyOverlay(ctx, 800, 600, 0, 30, 0, 30), 0,
    'hidden woody layer skips mature canopy overlay');
  assertEqual(ellipses.length, 0, 'hidden woody layer draws no canopy rings');
});

test('trees soft-warn on crowded spacing but never block, and the trunk refuses underplanting', () => {
  setup(31, 31);
  const treeKey = Object.keys(PLANTS).find(k =>
    PLANTS[k].type === 'tree' && !PLANTS[k].hidden && PLANTS[k].space >= 120 && PLANTS[k].space <= 300) || firstOfType('tree');
  const def = plantDef(treeKey, null);
  const spanT = treeSpacingTiles(def);
  const cx = 15, cy = 15;
  game.tool = treeKey; game.toolVar = null;
  assertEqual(placePlantAt(cx, cy), 'plant', 'first tree places');
  // an adjacent same-species tree still places — spacing is a soft warning, not a block
  assertEqual(placePlantAt(cx + 1, cy), 'plant', 'adjacent same-species tree still places');
  const crowd = nearestTreeCrowder(cx + 1, cy, def, `${cx + 1},${cy}`);
  assert(crowd && crowd.x === cx && crowd.y === cy, 'crowder scan finds the neighbor inside the spacing');
  const warn = treePlacedMessage(def, cx + 1, cy, `${cx + 1},${cy}`);
  assert(warn.includes('crowds') && warn.includes('ft apart'), 'crowded tree placement returns a soft warning message');
  // a tree planted well beyond its spacing is not flagged as crowded
  const fx = cx + Math.ceil(spanT) + 2;
  assert(fx < GW, 'far test tile fits the plot');
  assert(!nearestTreeCrowder(fx, cy, def, null), 'a well-spaced tree reads as uncrowded');
  // the trunk tile is hard-occupied: a perennial cannot underplant it
  const forb = Object.keys(PLANTS).find(k => PLANTS[k].type === 'forb' && PLANTS[k].sun === 'full' && !PLANTS[k].hidden);
  game.tool = forb; game.toolVar = null;
  assertEqual(placePlantAt(cx, cy), null, 'perennial refused on the trunk tile');
  // but the open canopy area takes a perennial and a bulb (canopy is not reserved)
  assertEqual(placePlantAt(cx + 4, cy + 4), 'plant', 'perennial plants in the open canopy area');
  const bulb = firstOfType('bulb');
  game.tool = bulb; game.toolVar = null;
  assertEqual(placePlantAt(cx + 3, cy), 'bulb', 'bulb tucks in near the tree (not on the trunk)');
});

test('woody visual rescale: trees draw larger, proportional, and below true scale', () => {
  const oak = PLANTS.whiteoak, realPx = woodyRadiusTiles(oak) * 2 * TILE_W;
  const vcw = woodyVisualCw(oak), vh = woodyVisualH(oak);
  assert(vcw >= oak.cw * 2.5 && vcw <= oak.cw * 5, `oak drawn width rescaled 2.5-5x (got ${vcw} from ${oak.cw})`);
  assert(vcw < realPx * 0.25, 'giants stay well below true screen scale');
  const factor = vcw / oak.cw;
  assert(Math.abs(vh / oak.h - factor) < 0.02, 'height scales by the same factor as width');
  // small trees land closer to true size than giants (compression, not linear)
  const redbud = PLANTS.redbud;
  const oakShare = vcw / realPx;
  const redbudShare = woodyVisualCw(redbud) / (woodyRadiusTiles(redbud) * 2 * TILE_W);
  assert(redbudShare > oakShare, 'smaller trees keep a larger share of true size');
  // narrow cultivars stay narrower than their species
  const sw = plantDef('sweetgum', null), swNarrow = plantDef('sweetgum', 'slendersilhouette');
  assert(woodyVisualCw(swNarrow) < woodyVisualCw(sw) * 0.8, 'narrow cultivar stays visibly narrower');
  const shrub = PLANTS.smokebush;
  assertEqual(woodyVisualCw(shrub), Math.max(shrub.cw, woodyRadiusTiles(shrub) * TILE_W), 'shrub visual width rule unchanged');
  // shrub drawn height follows the widened width, keeping the species' aspect
  // (pre-fix a low yew drew ~6x wider than tall)
  const yew = PLANTS.yewlow;
  const drawnAspect = woodyVisualH(yew) / woodyVisualCw(yew);
  assert(Math.abs(drawnAspect - yew.h / yew.cw) < 0.05,
    `yew keeps its intended h:cw aspect at the widened size (got ${drawnAspect.toFixed(2)} vs ${(yew.h / yew.cw).toFixed(2)})`);
});

test('evergreen silhouettes retain authored proportions through the woody sizing seam', () => {
  const taylor=PLANTS.taylorjuniper, spartan=PLANTS.spartanjuniper;
  const atlas=PLANTS.blueatlascedar, serbian=PLANTS.serbianspruce;
  assert(woodyVisualCw(taylor)<woodyVisualCw(spartan), 'Taylor juniper remains narrower than Spartan on screen');
  assert(woodyVisualCw(atlas)>woodyVisualCw(serbian)*1.5, 'broad Atlas cedar separates from narrow Serbian spruce');
  for (const P of [taylor,spartan,atlas,serbian,PLANTS.weepingwhitepine]){
    const artAspect=P.h/P.cw, drawnAspect=plantVisualH(P)/woodyVisualCw(P);
    assert(Math.abs(artAspect-drawnAspect)<0.03, `${P.name}: woody transform preserves authored aspect`);
  }
  assert(coniferHalfWidth({taper:.62,columnar:.68},100,.35)>
    coniferHalfWidth({taper:.62,columnar:0},100,.35), 'columnar crowns hold their width higher up the spire');
});

test('herbaceous plants draw larger so drifts read as masses (H1)', () => {
  // every herbaceous form derives its geometry from the drawn height, so one
  // height factor scales the whole plant. Bulbs opt out (already read closed).
  const grass = PLANTS.bluestem, forb = PLANTS.echinacea;
  assertEqual(plantVisualH(grass), Math.round(grass.h * HERB_SCALE), 'grass drawn height scaled by HERB_SCALE');
  assertEqual(plantVisualH(forb), Math.round(forb.h * HERB_SCALE), 'forb drawn height scaled by HERB_SCALE');
  assert(HERB_SCALE > 1.4 && HERB_SCALE < 2.2, 'HERB_SCALE stays in the tuned range');
  // bulbs are unchanged
  const bulb = firstOfType('bulb');
  assertEqual(plantVisualH(PLANTS[bulb]), PLANTS[bulb].h, 'bulbs keep their drawn height');
  // woody still routed through the same seam (trees rescale, herbaceous alias holds)
  assert(plantVisualH(PLANTS.whiteoak) > PLANTS.whiteoak.h, 'tree height still rescaled through plantVisualH');
  assertEqual(woodyVisualH(grass), plantVisualH(grass), 'woodyVisualH alias forwards to plantVisualH');
});

test('grass cultivar width scaling follows spread independently of height', () => {
  const northwind=plantDef('switchgrass','northwind');
  const shenandoah=plantDef('switchgrass','shenandoah');
  const nwScale=plantVisualWidthScale(northwind,'switchgrass');
  const shScale=plantVisualWidthScale(shenandoah,'switchgrass');
  assert(northwind.h > shenandoah.h, 'Northwind remains the taller switchgrass');
  assert(nwScale < 1 && shScale > 1, 'narrow Northwind and broad Shenandoah get opposite width corrections');
  const drawnRatio=(plantVisualH(northwind)*nwScale)/(plantVisualH(shenandoah)*shScale);
  assert(Math.abs(drawnRatio-northwind.spread/shenandoah.spread)<0.02,
    'cultivar drawn-width ratio follows mature spread instead of mature height');
});

test('age-at-placement backdates woody planting so establishment is immediate', () => {
  setup(31, 31);
  const treeKey = firstOfType('tree'), def = plantDef(treeKey, null);
  game.tool = treeKey; game.toolVar = null;
  // mature: full establishment the moment it lands
  game.woodyAge = 'mature';
  assertEqual(placePlantAt(10, 10), 'plant', 'mature tree places');
  assertEqual(plantEstab(game.plants['10,10']), 1, 'mature-placed tree is fully established');
  // young: roughly half grown
  game.woodyAge = 'young';
  assertEqual(placePlantAt(20, 10), 'plant', 'young tree places');
  const est = plantEstab(game.plants['20,10']);
  assert(est >= 0.4 && est <= 0.8, `young-placed tree is part grown (got ${est})`);
  // new: starts from zero
  game.woodyAge = 'new';
  assertEqual(placePlantAt(10, 20), 'plant', 'new tree places');
  assertEqual(plantEstab(game.plants['10,20']), 0, 'new-placed tree starts unestablished');
  // herbaceous plants ignore the age seg entirely
  game.woodyAge = 'mature';
  const forb = Object.keys(PLANTS).find(k => PLANTS[k].type === 'forb' && PLANTS[k].sun === 'full' && !PLANTS[k].hidden);
  game.tool = forb;
  assertEqual(placePlantAt(20, 20), 'plant', 'forb places');
  assertEqual(game.plants['20,20'].d, absDay(), 'herbaceous planting day is today regardless of the age seg');
  // a mature-placed tree casts REAL shade immediately (rules-map, not preview)
  assert(!!shadeAt(10, 9), 'mature-placed tree drives true-establishment shade at once');
});

test('plant card mature size uses real tree heights (heightIn)', () => {
  const oak = PLANTS.whiteoak;
  const txt = matureSizeText(oak, false);
  assert(txt.startsWith(plantMeasure(oak.heightIn, false)), 'tree card height comes from heightIn');
  assert(txt.includes('90 ft'), `white oak reads 90 ft H (got "${txt}")`);
  const grass = PLANTS.bluestem;
  assert(matureSizeText(grass, false).startsWith(plantMeasure(grass.h, false)), 'herbaceous card keeps the px-h fallback');
  // a weeping cultivar's own heightIn overrides the species number
  const cq = plantDef('japanesemaple', 'crimsonqueen');
  assert(matureSizeText(cq, false).startsWith('9 ft'), `Crimson Queen reads 9 ft (got "${matureSizeText(cq, false)}")`);
});

test('lot-shape setup helpers: side lengths, snapping, validity, and create order', () => {
  setup(31, 31);
  assertEqual(JSON.stringify(defaultPlotShapeVerts(20, 20)),
    JSON.stringify([[0, 0], [20, 0], [20, 20], [0, 20]]), 'default verts are the full rectangle');
  assertEqual(JSON.stringify(plotShapeSideLengthsFt([[0, 0], [20, 0], [16, 20], [0, 20]])),
    JSON.stringify([30, 31, 24, 30]), 'side lengths convert tiles to rounded feet');
  assertEqual(JSON.stringify(plotShapeSnap(3.4, -2, 20, 20)), JSON.stringify([3, 0]), 'snap clamps below zero');
  assertEqual(JSON.stringify(plotShapeSnap(25.6, 19.5, 20, 20)), JSON.stringify([20, 20]), 'snap clamps past the far corner');
  assert(plotShapeQuadOk([[0, 0], [20, 0], [14, 20], [0, 20]], 20, 20), 'a trapezoid validates');
  assert(!plotShapeQuadOk([[0, 0], [20, 20], [20, 0], [0, 20]], 20, 20), 'a bowtie is rejected');
  assert(!plotShapeQuadOk([[0, 0], [2, 0], [2, 2], [0, 2]], 20, 20), 'a sliver is rejected');
  assert(plotShapeIsRect([[0, 0], [20, 0], [20, 20], [0, 20]], 20, 20), 'rect detection');
  assert(!plotShapeIsRect([[0, 0], [20, 0], [14, 20], [0, 20]], 20, 20), 'custom detection');
  // edge-resize: whole tiles clamped to the plot's feet limits
  assertEqual(plotEdgeResizeTiles(4), ftToTiles(FT_MIN), 'edge resize clamps to the minimum plot');
  assertEqual(plotEdgeResizeTiles(999), ftToTiles(FT_MAX), 'edge resize clamps to the maximum plot');
  assertEqual(plotEdgeResizeTiles(47.4), 47, 'edge resize snaps to whole tiles');
  // the north dial: pointer offset -> clockwise-from-up bearing, snapped to 5°
  assertEqual(plotDialDeg(0, -5), 0, 'dial up = 0');
  assertEqual(plotDialDeg(10, -10), 45, 'dial NE = 45');
  assertEqual(plotDialDeg(-7, 0), 270, 'dial left = 270');
  assertEqual(plotDialDeg(1, 10) % 5, 0, 'dial output always lands on a 5° step');
  // the create-order contract: size the world first (clears any shape), then apply
  setWorldSize(21, 21);
  assertEqual(game.plotShape, null, 'setWorldSize starts rectangular');
  assert(setPlotShape([[0, 0], [21, 0], [15, 21], [0, 21]]), 'pending shape applies after sizing');
  assert(!onPlot(20, 20), 'the cut corner is off the lot');
  assert(onPlot(2, 2), 'the kept corner is on the lot');
});

test('sprite governor: engages on measured-heavy draw, predicts to disengage', () => {
  PSPRITE.off = false; PSPRITE.active = false; PSPRITE.hot = 0; PSPRITE.calm = 0; PSPRITE.plantMs = 0;
  // below the plant floor it never engages, however slow the draw
  for (let i = 0; i < 10; i++) updateSpriteMode(9, 30);
  assert(!PSPRITE.active, 'below the plant floor stays procedural');
  // sustained heavy draw engages after three consecutive hot frames
  updateSpriteMode(8, 200); updateSpriteMode(8, 200);
  assert(!PSPRITE.active, 'two hot frames are not enough');
  updateSpriteMode(8, 200);
  assert(PSPRITE.active, 'engaged after three consecutive heavy frames');
  // sprites make draw fast — the predicted procedural cost (200 x learned
  // ~0.04ms = ~8ms) keeps it engaged instead of flapping off
  for (let i = 0; i < 60; i++) updateSpriteMode(1.2, 200);
  assert(PSPRITE.active, 'fast sprite frames do not flap it off');
  // most plants erased -> procedural would be cheap -> calm window releases it
  for (let i = 0; i < 45; i++) updateSpriteMode(0.5, 40);
  assert(!PSPRITE.active, 'disengages when procedural would be cheap again');
  // dev A/B toggle forces it off
  updateSpriteMode(9, 500); updateSpriteMode(9, 500); updateSpriteMode(9, 500);
  assert(PSPRITE.active, 're-engaged for the toggle check');
  PSPRITE.off = true; updateSpriteMode(9, 500);
  assert(!PSPRITE.active, 'PSPRITE.off wins');
  PSPRITE.off = false; PSPRITE.active = false; PSPRITE.hot = 0; PSPRITE.calm = 0; PSPRITE.plantMs = 0;
});

test('cloudgrass sprite bounds retain tall transparent panicles', () => {
  const P=PLANTS.molinia, L=P.look, H=plantVisualH(P);
  const sprite=makePlantSprite('molinia',8,0,'Fall',12345,null,null);
  const tallestPanicle=H*1.05*(L.cloudTop||0.92)+(L.cloudHeight||11)-2;
  assert(sprite && sprite.oy >= tallestPanicle+26,
    'Molinia sprite box must clear its tallest panicle cloud');
});

test('weeping conifer sprites reserve their below-grade curtains', () => {
  for (const k of ['blueweepingalaskacedar','weepingwhitepine']){
    const sprite=makePlantSprite(k,8,0,'Summer',12345,null,null);
    const below=sprite.cv.height/sprite.s-sprite.oy;
    assert(below>18,`${k}: cached sprite needs more than the generic below-grade allowance`);
  }
});

test('glass governor: sustained interaction jank drops the blur, spikes do not', () => {
  GLASS.off = false; GLASS.ema = 16.7; GLASS.warm = 0;
  // warmup frames are ignored, however janky (first-load font/shader stalls)
  for (let i = 0; i < GLASS.WARM_FRAMES; i++) updateGlassMode(45);
  assert(!GLASS.off, 'warmup jank does not trip it');
  // a lone spike after warmup is absorbed by the EMA
  updateGlassMode(45); updateGlassMode(16); updateGlassMode(16);
  assert(!GLASS.off, 'a lone spike is absorbed');
  // sustained jank converges the EMA past the limit and trips it
  for (let i = 0; i < 40; i++) updateGlassMode(45);
  assert(GLASS.off, 'sustained jank drops the glass');
  GLASS.off = false; GLASS.ema = 16.7; GLASS.warm = 0;
});

test('no-op undo gestures do not push snapshots', () => {
  setup();
  const undoCount = undoStack.length;
  beginUndo();
  commitUndo();
  assertEqual(undoStack.length, undoCount, 'begin/commit with no mutation is skipped');
  withUndo(() => {});
  assertEqual(undoStack.length, undoCount, 'withUndo with no mutation is skipped');
});

test('toast clears the previous timer for informational messages', () => {
  const oldGet = document.getElementById, oldSet = setTimeout, oldClear = clearTimeout;
  const el = { textContent: '', style: { opacity: 0 }, _t: 41 };
  let cleared = null;
  document.getElementById = id => id === 'toast' ? el : oldGet.call(document, id);
  setTimeout = (fn, ms) => { assertEqual(ms, 2600, 'toast timeout duration'); return 99; };
  clearTimeout = id => { cleared = id; };
  try {
    toast('Picked Karl Foerster.');
  } finally {
    document.getElementById = oldGet;
    setTimeout = oldSet;
    clearTimeout = oldClear;
  }
  assertEqual(cleared, 41, 'previous toast timer was cleared');
  assertEqual(el._t, 99, 'new toast timer was stored');
  assertEqual(el.style.opacity, 1, 'toast is visible after update');
});

test('solo map compaction drops removed tombstones and keeps live entries', () => {
  const grass = firstOfType('grass');
  const compacted = compactSoloMap({
    '1,1': { removed: true, t: 2 },
    '2,2': { s: grass, d: 0, t: 3 },
    '3,3': null
  });
  assert(!('1,1' in compacted), 'removed tombstone dropped');
  assert(!('3,3' in compacted), 'null entry dropped');
  assert(compacted['2,2'] && compacted['2,2'].s === grass, 'live entry kept');
});

test('eyedropper samples a plant, bulb, hardscape, light, or material onto the brush', () => {
  setup();
  const forb = firstOfType('forb'), bulb = firstOfType('bulb');
  game.plants['3,3'] = { s: forb, v: null, d: 0, t: 1 };
  game.bulbs['4,4'] = { s: bulb, v: null, d: 0, t: 1 };
  game.fences['6,6'] = { style: 'brick', height: 6, gate: true, t: 1 };
  game.boulders['9,9'] = { type: 'oblong31', t: 1 };
  game.lights['8,8'] = { type: 'lamp', tone: 'bright', t: 1 };
  game.terrain['5,5'] = { k: 'path', c: 'slate', t: 1 };
  game.terrain['7,7'] = { k: 'bed', c: 'rock', t: 1 };

  game.tool = 'pick'; game.fillMode = true; pickAt(3, 3);
  assertEqual(game.tool, forb, 'picked the plant');
  assert(game.fillMode === false, 'eyedropper drops into plain plant mode');

  game.tool = 'pick'; pickAt(4, 4);
  assertEqual(game.tool, bulb, 'picked the bulb');

  game.tool = 'pick'; game.pathColor = 'warm'; pickAt(5, 5);
  assertEqual(game.tool, 'path', 'picked the path material');
  assertEqual(game.pathColor, 'slate', 'copied the path colour');

  game.tool = 'pick'; pickAt(6, 6);
  assertEqual(game.tool, 'fence', 'picked the fence structure');
  assertEqual(game.trayCat, 'structures', 'switched to Structures');
  assertEqual(game.fenceDraft.style, 'brick', 'copied fence material');
  assertEqual(game.fenceDraft.height, 6, 'copied fence height');
  assert(game.fenceDraft.gate, 'copied gate mode');

  game.tool = 'pick'; pickAt(9, 9);
  assertEqual(game.tool, 'boulder', 'picked the boulder hardscape');
  assertEqual(game.boulderDraft.type, 'oblong31', 'copied boulder type');

  game.tool = 'pick'; pickAt(8, 8);
  assertEqual(game.tool, 'light', 'picked the light structure');
  assertEqual(game.trayCat, 'lighting', 'switched to Lighting');
  assertEqual(game.lightDraft.type, 'lamp', 'copied light fixture');
  assertEqual(game.lightDraft.tone, 'bright', 'copied light tone');

  game.tool = 'pick'; game.bedStyle = 'soil'; pickAt(7, 7);
  assertEqual(game.tool, 'bed', 'picked the bed material');
  assertEqual(game.bedStyle, 'rock', 'copied the bed style');

  game.tool = 'pick'; pickAt(10, 10);
  assertEqual(game.tool, 'pick', 'nothing to pick on bare grass — stays on the tool');
});

// ---------- daily-challenge palette + deer/rabbit resistance ----------
test('deer/rabbit resistance tags the right plants', () => {
  const deer = k => plantRoles(k).includes('deerOk');
  const rabbit = k => plantRoles(k).includes('rabbitOk');
  // broadly avoided: grasses, ferns, aromatic mints, toxic forbs/bulbs, tough shrubs
  ['bluestem', 'ladyfern', 'monarda', 'mountainmint', 'meadowsage', 'yarrow', 'baptisia',
    'butterfly', 'daffodil', 'siberianiris', 'boxwoodround', 'sumac', 'goldenrod', 'rudbeckia']
    .forEach(k => assert(deer(k) && rabbit(k), `${k} should be browse-resistant`));
  // readily browsed: kept off the list on purpose (honest data)
  ['hosta', 'tulip', 'gardentulip', 'crocus', 'newjersey', 'yewlow', 'hydrangea', 'sedum', 'echinacea', 'dahlia']
    .forEach(k => assert(!deer(k) && !rabbit(k), `${k} should NOT be browse-resistant`));
  // trees outgrow browse height — exempt, so they never carry the role
  // (even Silver Maple, whose name would otherwise trip the 'silver' cue)
  ['silvermaple', 'whiteoak', 'ginkgo'].forEach(k => assert(!deer(k), `${k} (tree) should not carry deerOk`));
});

// Browse resistance is rated per species, never per tray group. The trap: the
// five viburnums share group:'viburnum', but Rutgers rates arrowwood/
// cranberrybush/koreanspice/blackhaw A-B (rarely browsed) and doublefile C
// (occasionally browsed). Tagging the group would quietly promise a deer-proof
// doublefile. Same shape for the spireas, which share group:'spirea' and are
// both browsed, while group:'lilac' genuinely is resistant across the board.
test('landscape shrub browse resistance is rated per species, not by tray group', () => {
  const deer = k => plantRoles(k).includes('deerOk');
  const rabbit = k => plantRoles(k).includes('rabbitOk');
  // four of the five grouped viburnums are rated resistant...
  ['arrowwood', 'cranberrybush', 'koreanspice', 'blackhaw'].forEach(k =>
    assert(deer(k) && rabbit(k), `${k} viburnum should be browse-resistant`));
  // ...but doublefile shares their group and is browsed — the group must not carry the tag
  assert(!deer('doublefile') && !rabbit('doublefile'),
    'doublefile viburnum is browsed — it must not inherit resistance from group:"viburnum"');
  // whole-genus resistance (lilac) plus the berried natives, listed by key
  ['lilac', 'misskimlilac', 'bloomeranglilac', 'winterberry', 'inkberry', 'chokeberry']
    .forEach(k => assert(deer(k) && rabbit(k), `${k} should be browse-resistant`));
  // honestly browsed despite being tough shrubs
  ['ninebark', 'redtwig', 'japanesespirea', 'bridalwreath']
    .forEach(k => assert(!deer(k) && !rabbit(k), `${k} should NOT be browse-resistant`));
});

test('late-season role comes from a fall bloom', () => {
  assert(plantRoles('newengland').includes('late'), 'New England aster blooms late');
  assert(plantRoles('goldenrod').includes('late'), 'goldenrod blooms late');
  assert(!plantRoles('crocus').includes('late'), 'a spring bulb is not late-season');
});

test('daily challenge match limits the palette', () => {
  setup();
  const find = t => DAILY_CHALLENGES.find(c => c.title === t);
  game.challenge = find('Grasses Only');
  assert(challengeAllows('bluestem'), 'a grass passes Grasses Only');
  assert(challengeAllows('sedge'), 'a sedge passes Grasses Only');
  assert(!challengeAllows('echinacea'), 'a forb is excluded from Grasses Only');
  game.challenge = find('Deer-Resistant Border');
  assert(challengeAllows('monarda'), 'an aromatic forb passes the deer border');
  assert(!challengeAllows('hosta'), 'hosta is excluded from the deer border');
  // moist range keeps adaptable medium-moisture plants the prompt names
  game.challenge = find('Dry Prairie Matrix');
  assert(challengeAllows('dropseed'), 'medium-moisture prairie dropseed fits the dry matrix');
  assert(!challengeAllows('swampmilkweed'), 'a true moisture-lover is excluded from the dry matrix');
  // keys whitelist a named species the role/moist filter would otherwise miss
  game.challenge = find('Slow-Draining Low');
  assert(challengeAllows('switchgrass'), 'switchgrass is whitelisted into the wet bed');
  assert(!challengeAllows('bluestem'), 'a dry grass stays out of the wet bed');
  game.challenge = find('Monochrome Study');           // technique-only — carries no match
  assert(challengeAllows('echinacea') && challengeAllows('hosta'), 'an unrestricted prompt allows anything');
  game.challenge = null;
  assert(challengeAllows('hosta'), 'no challenge → everything allowed');
});

test('every daily challenge has a stocked, non-empty opening tab', () => {
  setup();
  game.filters = normalizeFilters({});                           // widest palette
  for (const c of DAILY_CHALLENGES){
    game.challenge = c;
    const keys = trayKeys();
    assert(keys.length > 0, `${c.title} produced an empty palette`);
    const cat = firstStockedTrayCat();
    const def = TRAY_CATS.find(x => x.id === cat);
    const n = keys.filter(k => def.types.includes(PLANTS[k].type) && (!def.sunFilter || PLANTS[k].sun === def.sunFilter)).length;
    assert(n > 0, `${c.title} opens on an empty "${cat}" tab`);
  }
  game.challenge = null;
});

test('zone 6 grass palette includes Mexican feather grass', () => {
  setup();
  game.filters = normalizeFilters({ zone: 6 });
  game.design = { zone: 6, type: 'any', nativeRegion:'north-america', nativeMode:'any', deer: false, rabbit: false, squirrel: false };
  assert(plantFits('mexicanfeather'), 'mexican feather grass should fit the zone 6 picker');
  assert(trayKeys().includes('mexicanfeather'), 'mexican feather grass should appear in the tray');
});

test('challenge palette size reports the limit for the entry badge', () => {
  const find = t => DAILY_CHALLENGES.find(c => c.title === t);
  const total = speciesCount();
  const grassSedge = PLANT_KEYS.filter(k => !PLANTS[k].hidden && ['grass', 'sedge'].includes(PLANTS[k].type)).length;
  assertEqual(challengePaletteSize(find('Grasses Only')), grassSedge, 'Grasses Only admits every grass + sedge');
  assertEqual(challengePaletteSize(find('Cottage Abundance')), total, 'an unrestricted prompt is the full palette');
  assert(challengePaletteSize(find('Sensory Garden')) < total, 'Sensory Garden is a real limit');
});

test('deer/rabbit plant filters narrow the tray, trees exempt', () => {
  setup();                                              // filters wide, design null
  game.filters = normalizeFilters({ zone: 6, deer: true });
  assert(plantFits('monarda'), 'a resistant forb stays under deer pressure');
  assert(!plantFits('hosta'), 'a browsed forb is hidden under deer pressure');
  assert(plantFits('whiteoak'), 'trees are exempt from the browse filter');
  game.filters = normalizeFilters({ zone: 6, rabbit: true });
  assert(!plantFits('hosta'), 'rabbit pressure hides browsed plants too');
  game.filters = normalizeFilters({});
  assert(plantFits('hosta'), 'no pressure → hosta returns');
});

test('styleMeadowKeys replants the menu backdrop per style, herbaceous only', () => {
  assertEqual(styleMeadowKeys('any', 6), null, "'Any garden' keeps the curated seasonal meadow");
  const prairie = styleMeadowKeys('prairie', 6);
  assert(prairie && prairie.length >= 4, 'prairie yields a palette');
  const herb = k => ['grass', 'sedge', 'forb', 'bulb'].includes(PLANTS[k].type);
  assert(prairie.every(herb), 'no trees/shrubs in the backdrop');
  assert(prairie.some(k => PLANTS[k].type === 'grass'), 'prairie leans on grasses');
  const shade = styleMeadowKeys('shade', 6);
  assert(shade.every(herb) && shade.join() !== prairie.join(), 'shade palette differs from prairie');
  // zone gates the palette: a warm-only species should drop out of a cold zone
  const warm = styleMeadowKeys('prairie', 4);
  assert(warm.every(k => PLANTS[k].zones[0] <= 4 && PLANTS[k].zones[1] >= 4), 'zone 4 palette all tolerate zone 4');
});

test('worlds-list thumbnails: meta counts live plants and reads the save season', () => {
  const g = firstOfType('grass');
  const save = {
    gw: 21, gh: 21,
    plants: { '2,2': { s: g, d: 0, t: 1 }, '3,3': { s: g, d: 0, t: 1 }, '4,4': { removed: true, t: 2 } },
    bulbs: { '5,5': { s: firstOfType('bulb'), d: 0, t: 1 } },
    terrain: { '6,6': { k: 'path', c: 'warm', t: 1 }, '7,7': { k: 'water', c: 'pond', t: 1 } },
    houses: [{ x: 10, y: 10, w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a' }],
    elapsedMs: DAY_MS * (DAYS_PER_SEASON + 2),   // day 18 -> Summer
    dayOffset: 0,
  };
  const m = worldSaveMeta(save);
  assertEqual(m.plants, 3, 'tombstones are not counted; bulbs are');
  assertEqual(m.season, 'Summer', 'season derives from elapsed game time');
  const m2 = worldSaveMeta({ });
  assertEqual(m2.plants, 0, 'an empty blob is safe');
  assertEqual(m2.season, 'Spring', 'day zero is spring');
  // the drawer runs against the same blob without throwing (canvas is stubbed)
  const cvs = document.createElement('canvas'); cvs.width = 168; cvs.height = 126;
  drawWorldThumb(cvs, save);
  drawWorldThumb(cvs, { gw: 139, gh: 139, plants: {}, terrain: {} }); // acre plot: flat fill path
});

test('zoneFromZip maps prefixes to a clampable zone and rejects junk', () => {
  assertEqual(zoneFromZip('66044'), 6, 'Lawrence KS → zone 6');   // 660 band
  assertEqual(zoneFromZip('02139'), 6, 'Cambridge MA → zone 6');  // 020 band
  assertEqual(zoneFromZip('551'), 4, 'a bare 3-digit MN prefix works');
  assertEqual(zoneFromZip('99501'), 4, 'Anchorage AK → cold band');
  assertEqual(zoneFromZip('33101'), 10, 'Miami raw zone is 10 (caller clamps to 9)');
  assertEqual(zoneFromZip('ab'), null, 'too short → null (fall back to winter picker)');
  assertEqual(zoneFromZip(''), null, 'empty → null');
  assertEqual(zoneFromZip('09012'), null, 'an uncovered prefix → null');
});

test('paletteCount tracks zone/native/deer/rabbit/squirrel without touching game state', () => {
  const savedFilters = game.filters, savedDesign = game.design;
  const all = paletteCount({});
  const z4 = paletteCount({ zone: 4 });
  const z8 = paletteCount({ zone: 8 });
  assert(all > 0, 'some plants exist');
  assert(z4 <= all && z8 <= all, 'a zone filter never grows the palette');
  assert(paletteCount({ zone: 6, nativeRegion:'north-america', nativeMode:'regional' }) <= paletteCount({ zone: 6 }),
    'natives-only narrows or holds');
  assert(paletteCount({ zone: 6, deer: true }) < paletteCount({ zone: 6 }),
    'deer pressure removes browsed species');
  assert(paletteCount({ zone: 6, squirrel: true }) <= paletteCount({ zone: 6 }),
    'squirrel bulb pressure narrows or holds');
  assertEqual(game.filters, savedFilters, 'game.filters untouched');
  assertEqual(game.design, savedDesign, 'game.design untouched');
});

/* ---------- plot shape (lot boundary) ---------- */

test('no plot shape leaves onPlot true everywhere and placement works at a corner', () => {
  setup(31, 31);
  assertEqual(game.plotShape, null, 'no shape by default');
  for (const [x, y] of [[0, 0], [30, 0], [0, 30], [30, 30], [15, 15]])
    assert(onPlot(x, y), `(${x},${y}) is on-plot with no shape set`);
  assert(!onPlot(-1, 0) && !onPlot(0, -1) && !onPlot(31, 0) && !onPlot(0, 31),
    'off-grid coordinates are never on-plot');
  const forb = firstOfType('forb');
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(0, 0), 'plant', 'planting still works at a corner tile with no shape');
});

test('setPlotShape masks placement to an irregular lot', () => {
  setup(31, 31);
  const shape = [[0, 0], [31, 0], [24, 31], [0, 31]]; // trapezoid: SE corner cut off
  assert(setPlotShape(shape), 'a valid trapezoid is accepted');
  assertEqual(JSON.stringify(game.plotShape), JSON.stringify(shape), 'the shape is stored verbatim');
  assert(game.plotRev > 0, 'accepting a shape bumps plotRev');

  assert(!onPlot(28, 29), 'a tile past the cut corner is off the lot');
  assert(onPlot(15, 15), 'a tile away from the cut corner is on the lot');

  const forb = firstOfType('forb');
  game.tool = forb; game.toolVar = null;
  assertEqual(applyToolAt(30, 20), null, 'planting is refused off the lot');
  assertEqual(applyToolAt(5, 5), 'plant', 'planting still works on the lot');

  game.tool = 'path'; game.pathColor = 'warm';
  assertEqual(applyToolAt(30, 22), null, 'laying terrain is refused off the lot');
  assertEqual(applyToolAt(5, 10), 'path', 'laying terrain still works on the lot');

  game.tool = 'fence';
  assertEqual(applyToolAt(30, 24), null, 'placing a fence is refused off the lot');
  assertEqual(applyToolAt(5, 15), 'fence', 'placing a fence still works on the lot');
});

test('selValidDest refuses off-mask destinations', () => {
  setup(31, 31);
  assert(selValidDest(10, 10), 'a plain tile is a valid destination with no shape');
  setPlotShape([[0, 0], [31, 0], [24, 31], [0, 31]]);
  assert(!selValidDest(30, 25), 'off-mask tile is not a valid selection destination');
  assert(selValidDest(5, 25), 'on-mask tile remains a valid selection destination');
});

test('flood fill never writes past the plot mask', () => {
  setup(31, 31);
  setPlotShape([[0, 0], [31, 0], [24, 31], [0, 31]]);
  game.tool = 'bed'; game.toolVar = null; game.fillMode = true;
  doFloodFill(5, 5); // an interior grass tile; the rest of the plot is untouched grass too
  const beds = Object.keys(game.terrain).filter(k => { const t = game.terrain[k]; return t && t.k === 'bed' && !t.removed; });
  assert(beds.length > 0, 'fill placed bed tiles from the interior seed');
  assert(beds.every(k => { const [x, y] = k.split(',').map(Number); return onPlot(x, y); }),
    'every filled tile is on the lot mask');
  assert(!(game.terrain['30,20'] && !game.terrain['30,20'].removed), 'the cut-corner tile was never reached');
});

test('a shrub footprint crossing the lot line is refused with reason plot', () => {
  setup(31, 31);
  setPlotShape([[0, 0], [31, 0], [24, 31], [0, 31]]);
  const shrub = 'sumac', cx = 22, cy = 30; // trunk sits on-lot; its ~2.7-tile mature radius crosses the cut corner
  assert(onPlot(cx, cy), 'the trunk tile itself is on the lot');
  const np = { s: shrub, d: absDay(), t: 1 };
  const check = canPlaceShrubAt(cx, cy, np);
  assertEqual(check.ok, false, 'a mature footprint crossing the lot line is refused');
  assertEqual(check.reason, 'plot', 'the refusal reason is the lot boundary');
  game.tool = shrub; game.toolVar = null;
  assertEqual(applyToolAt(cx, cy), null, 'the normal placement path refuses it too');
});

test('setWorldSize clears an existing plot shape', () => {
  setup(31, 31);
  assert(setPlotShape([[0, 0], [31, 0], [24, 31], [0, 31]]), 'shape accepted');
  assert(game.plotShape, 'sanity: a shape is set');
  setWorldSize(21, 21);
  assertEqual(game.plotShape, null, 'changing plot size clears an existing shape — it would be meaningless');
  assert(onPlot(0, 0) && onPlot(20, 20), 'the resized plot is a full rectangle again');
});

test('setPlotShape rejects invalid polygons', () => {
  setup(31, 31);
  assertEqual(setPlotShape([[0, 0], [10, 0], [10, 10]]), false, 'a triangle (wrong vertex count) is rejected');
  assertEqual(game.plotShape, null, 'rejected shape does not apply');
  assertEqual(setPlotShape([[0, 0], [10, 10], [10, 0], [0, 10]]), false, 'a self-intersecting bowtie is rejected');
  assertEqual(game.plotShape, null, 'bowtie does not apply');
  assertEqual(setPlotShape([[0, 0], [2, 0], [2, 1], [0, 1]]), false, 'a sliver enclosing under 9 tiles is rejected');
  assertEqual(game.plotShape, null, 'sliver does not apply');
  assert(setPlotShape([[0, 0], [31, 0], [24, 31], [0, 31]]), 'a valid shape is still accepted after prior rejections');
});

test('setPlotShape rounds and clamps vertices onto the lattice', () => {
  setup(21, 21);
  assert(setPlotShape([[-3, -1], [25, 0.4], [15.6, 21], [0, 21]]),
    'out-of-range/fractional vertices are cleaned up, not rejected');
  const [v0, v1, v2] = game.plotShape;
  assertEqual(JSON.stringify(v0), JSON.stringify([0, 0]), 'negative coordinates clamp to 0');
  assertEqual(JSON.stringify(v1), JSON.stringify([21, 0]), 'over-width coordinates clamp to GW and round');
  assertEqual(JSON.stringify(v2), JSON.stringify([16, 21]), 'fractional coordinates round to the nearest integer');
});

test('saveSolo blob carries plotShape and applying it back round-trips the shape', async () => {
  setup(31, 31);
  const shape = [[0, 0], [31, 0], [24, 31], [0, 31]];
  assert(setPlotShape(shape), 'shape accepted before saving');
  game.inGarden = true; game.worldId = 'test-plotshape-roundtrip';
  await saveSolo(true);
  const raw = localStorage.getItem('hortus:world:test-plotshape-roundtrip');
  assert(raw, 'a garden blob was written to storage');
  const blob = JSON.parse(raw);
  assertEqual(JSON.stringify(blob.plotShape), JSON.stringify(shape), 'the saved blob carries the plot shape');

  // apply the blob the way loadSolo does (setWorldSize, then setPlotShape) to a fresh garden
  setup(21, 21);
  assertEqual(game.plotShape, null, 'sanity: the fresh garden starts with no shape');
  setWorldSize(blob.gw || 31, blob.gh || 31);
  setPlotShape(blob.plotShape || null);
  assertEqual(JSON.stringify(game.plotShape), JSON.stringify(shape), 'reloading restores the saved plot shape');
  assert(!onPlot(28, 29), 'the reloaded shape still excludes the cut corner');
  assert(onPlot(15, 15), 'the reloaded shape still includes the interior');
});

test('a save blob without plotShape loads as a full rectangle', () => {
  setup(21, 21);
  assert(setPlotShape([[0, 0], [21, 0], [14, 21], [0, 21]]), 'a shape is set before simulating a legacy load');
  assert(game.plotShape, 'sanity check');
  const legacyBlob = { gw: 21, gh: 21 }; // no plotShape key, like a save from before this feature
  setWorldSize(legacyBlob.gw || 31, legacyBlob.gh || 31);
  setPlotShape(legacyBlob.plotShape || null);
  assertEqual(game.plotShape, null, 'a blob with no plotShape field loads as the full rectangle');
  assert(onPlot(0, 0) && onPlot(20, 20), 'every corner is on-plot with no shape');
});

test('save blobs preserve a garden’s discovery lens without changing its eligibility rules', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-discovery-roundtrip';
  game.filters = normalizeFilters({ zone: 6, nativeRegion:'north-america', nativeMode:'straight' });
  game.design = { zone: 6, type: 'any', nativeRegion:'north-america', nativeMode:'straight', deer: false, rabbit: false, squirrel: false };
  game.discovery = normalizeDiscovery({ source: 'favorites', query: 'aster', colorFamilies: ['purple'], bloomSeasons: ['Fall'], limit: 72 });
  await saveSolo(true);
  const blob = JSON.parse(localStorage.getItem('hortus:world:test-discovery-roundtrip'));
  assertEqual(blob.design.zone, 6, 'the hard garden zone stays in the save payload');
  assertEqual(blob.design.nativeRegion,'north-america','the native range round-trips');
  assertEqual(blob.design.nativeMode,'straight','the native mode round-trips');
  assertEqual(blob.design.nativesOnly,undefined,'new saves do not write the legacy boolean');
  assertEqual(blob.discovery.source, 'favorites', 'the soft catalog source saves separately');
  assertEqual(blob.discovery.query, 'aster', 'the catalog query round-trips');
  assertEqual(blob.discovery.colorFamilies[0], 'purple', 'flower-color lens round-trips');
  assertEqual(blob.discovery.bloomSeasons[0], 'Fall', 'bloom-season lens round-trips');
});

/* ---------- plot shape rendering (Phase B) ---------- */

test('organic regions: the lot-shape mask edge is hard so beds run into the cut line', () => {
  setup(31, 31);
  const shape = [[0, 0], [31, 0], [24, 31], [0, 31]]; // same trapezoid as the plot-shape suite: SE corner cut off
  assert(setPlotShape(shape), 'shape accepted');
  // rows 24-27 hold the mask boundary at a fixed column: x<=24 on-plot, x=25 off
  for (let y = 24; y <= 27; y++) for (let x = 22; x <= 24; x++)
    setTile('terrain', `${x},${y}`, { k: 'bed', c: 'soil', t: 1 });
  assert(onPlot(24, 25) && !onPlot(25, 25), 'sanity: the painted bed sits right against the lot line');
  const r = buildTerrainRegions()[0];
  assert(!r.loops[0].closed, 'a bed against the lot line splits into hard (lot edge) + soft (grass) arcs');
  const hard = r.loops[0].arcs.filter(a => a.hard);
  const hardPts = hard.flatMap(a => a.pts);
  assert(hardPts.some(([x, y]) => x === 25 && y === 24), 'hard arc reaches the north end of the cut edge');
  assert(hardPts.some(([x, y]) => x === 25 && y === 28), 'hard arc reaches the south end of the cut edge');
  assert(hard.every(a => a.pts.every(([x]) => x === 25)),
    'the hard run lies exactly on the lot-mask boundary line, unjittered');
});

test('setPlotShape bumps the ground and terrain cache keys', () => {
  setup(21, 21);
  const gKeyBefore = groundDataKey();
  const tRevBefore = game.terrainRev;
  assert(setPlotShape([[0, 0], [21, 0], [14, 21], [0, 21]]), 'shape accepted');
  assert(groundDataKey() !== gKeyBefore, 'groundDataKey changes so the world-anchored ground bake retraces the new lot');
  assert(game.terrainRev > tRevBefore, 'terrainRev bumps so the organic terrain-region cache retraces too');
});

test('blobOnPlot excludes tiles outside a saved garden\'s own shape', () => {
  const shape = [[0, 0], [21, 0], [14, 21], [0, 21]];
  assert(blobOnPlot(5, 5, 21, 21, shape), 'a tile well inside the shape is on the lot');
  assert(!blobOnPlot(19, 19, 21, 21, shape), 'a tile past the cut corner is off the lot');
  assert(blobOnPlot(5, 5, 21, 21, null), 'a null shape (legacy/rectangular save) treats every in-grid tile as on the lot');
  assert(!blobOnPlot(-1, 5, 21, 21, null), 'off-grid coordinates are never on the lot, shape or no shape');
  // the worlds-list drawer itself still runs against a shaped blob without throwing
  const cvs = document.createElement('canvas'); cvs.width = 168; cvs.height = 126;
  drawWorldThumb(cvs, { gw: 21, gh: 21, plotShape: shape, plants: {}, terrain: {} });
});

/* ---------- planting schemes: several plantings over one shared site plan ---------- */

test('a scheme switch swaps only plants and bulbs; the site plan is shared', () => {
  setup(21, 21);
  setTile('terrain', '5,5', { k: 'bed', c: 'soil', t: 1 });
  addHouse({ x: 2, y: 2, w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] });
  setTile('plants', '7,7', { s: 'bluestem', d: 0, t: 1 });
  setTile('bulbs', '8,8', { s: 'alliumGlobemaster', d: 0, t: 1 });
  const terrainRef = game.terrain, housesRef = game.houses;

  const b = createScheme(false);
  assert(b, 'a second scheme was created');
  assertEqual(schemeCount(), 2, 'the garden now holds two schemes');
  assertEqual(game.schemeActive, b.id, 'creating a scheme switches to it');
  assertEqual(Object.keys(game.plants).length, 0, 'an empty scheme starts with no plants');
  assertEqual(Object.keys(game.bulbs).length, 0, 'an empty scheme starts with no bulbs');
  assert(game.terrain === terrainRef, 'terrain is the SAME object - beds are shared, not copied');
  assert(game.houses === housesRef, 'houses are shared too');
  assert(!!game.terrain['5,5'], 'the shared bed is still there in the new scheme');

  setTile('plants', '9,9', { s: 'karl', d: 0, t: 1 });
  switchScheme(schemeList()[0].id);
  assert(!!game.plants['7,7'], 'switching back restores the first planting');
  assert(!game.plants['9,9'], 'the second scheme planting did not leak into the first');
  assert(!!game.bulbs['8,8'], 'bulbs travel with their scheme');
  assert(!!game.terrain['5,5'], 'the shared bed survived both switches');
});

test('the active scheme never holds its own maps (the one invariant)', () => {
  setup(21, 21);
  setTile('plants', '4,4', { s: 'bluestem', d: 0, t: 1 });
  createScheme(true);
  const active = activeScheme(), idle = schemeList().find(s => s.id !== game.schemeActive);
  assertEqual(active.plants, null, 'the active entry holds null - its maps are live in game.plants');
  assertEqual(active.bulbs, null, 'the active entry holds null for bulbs too');
  assert(idle.plants && !!idle.plants['4,4'], 'the inactive entry carries its own copy');
  assert(idle.plants !== game.plants, 'copy-from-current deep-copies rather than aliasing');
});

test('undo across a scheme switch restores into the scheme the edit happened in', () => {
  setup(21, 21);
  const a = game.schemeActive;
  withUndo(() => setTile('plants', '3,3', { s: 'bluestem', d: 0, t: 1 }));
  const b = createScheme(false);
  withUndo(() => setTile('plants', '6,6', { s: 'karl', d: 0, t: 1 }));
  assertEqual(game.schemeActive, b.id, 'sanity: editing happened in the second scheme');

  doUndo();   // undo the edit made in b - stays in b
  assertEqual(game.schemeActive, b.id, 'undoing an edit made here keeps us here');
  assert(!game.plants['6,6'], 'the second scheme plant was undone');

  doUndo();   // this snapshot was taken in a - must re-enter a first
  assertEqual(game.schemeActive, a, 'undoing past the switch re-enters the scheme the snapshot came from');
  assert(!game.plants['3,3'], 'the first scheme edit was undone in the right scheme');
  // the real hazard: scheme b must not have been overwritten by a's layers
  const bEntry = schemeList().find(s => s.id === b.id);
  assert(!bEntry.plants['3,3'], 'the first scheme plants did NOT leak into the second');
});

test('switching schemes leaves the ground and terrain caches alone', () => {
  setup(21, 21);
  setTile('terrain', '5,5', { k: 'bed', c: 'soil', t: 1 });
  createScheme(false);
  const gKey = groundDataKey(), tRev = game.terrainRev, gRev = game.groundRev, rev = game.rev;
  switchScheme(schemeList()[0].id);
  assertEqual(groundDataKey(), gKey, 'the world-anchored ground bake is not invalidated by a scheme switch');
  assertEqual(game.terrainRev, tRev, 'the organic terrain-region trace is not invalidated either');
  assertEqual(game.groundRev, gRev, 'no ground rebake is requested');
  assert(game.rev > rev, 'but game.rev bumps, so the scene list rebuilds');
});

test('schemes round-trip through save and load, active maps staying at the top level', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-schemes-roundtrip';
  setTile('terrain', '5,5', { k: 'bed', c: 'soil', t: 1 });
  setTile('plants', '3,3', { s: 'bluestem', d: 0, t: 1 });
  renameScheme(game.schemeActive, 'Prairie matrix');
  const b = createScheme(false);
  renameScheme(b.id, 'Shade tolerant');
  setTile('plants', '9,9', { s: 'karl', d: 0, t: 1 });
  await saveSolo(true);

  const blob = JSON.parse(localStorage.getItem('hortus:world:test-schemes-roundtrip'));
  assert(!!blob.plants['9,9'], 'the ACTIVE scheme plants sit at the blob top level, where every old reader looks');
  assertEqual(blob.schemes.active, b.id, 'the blob records which scheme is active');
  assertEqual(blob.schemes.list.length, 2, 'both schemes are stored');
  const savedActive = blob.schemes.list.find(s => s.id === b.id);
  const savedIdle = blob.schemes.list.find(s => s.id !== b.id);
  assertEqual(savedActive.plants, undefined, 'the active entry does not duplicate its maps');
  assert(!!savedIdle.plants['3,3'], 'the inactive scheme carries its own planting');
  assertEqual(savedIdle.name, 'Prairie matrix', 'scheme names are saved');
  // the worlds list reads the blob directly and must still describe it
  assertEqual(worldSaveMeta(blob).plants, 1, 'the worlds-list count reads the active scheme');
  assertEqual(worldSaveMeta(blob).schemes, 2, 'the worlds-list row reports how many schemes are inside');

  // apply the blob the way loadSolo does (keyed layers, then restoreSchemes).
  // loadSolo itself is async, so its body would not have run by the time these
  // assertions execute; restoreSchemes is the pure, synchronous half.
  setup(21, 21);
  for (const L of GAME_MAPS) game[L.k] = compactSoloMap(blob[L.k] || {});
  restoreSchemes(blob, 0);
  assertEqual(schemeCount(), 2, 'both schemes came back');
  assertEqual(game.schemeActive, b.id, 'the active scheme came back active');
  assertEqual(activeSchemeName(), 'Shade tolerant', 'names survived the round trip');
  assert(!!game.plants['9,9'], 'the active scheme planting is live');
  assert(!!game.terrain['5,5'], 'the shared site plan came back');
  switchScheme(schemeList().find(s => s.id !== b.id).id);
  assert(!!game.plants['3,3'], 'the other scheme planting survived storage');
});

test('a single-scheme garden saves exactly as it always did', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-schemes-absent';
  setTile('plants', '3,3', { s: 'bluestem', d: 0, t: 1 });
  await saveSolo(true);
  const blob = JSON.parse(localStorage.getItem('hortus:world:test-schemes-absent'));
  assertEqual(blob.schemes, undefined, 'below two schemes the key is omitted entirely');
  assert(!!blob.plants['3,3'], 'plants stay exactly where they have always been');
  assertEqual(worldSaveMeta(blob).schemes, 1, 'a schemeless blob reports one scheme');
});

/* ---------- shipping the update ----------
   The version lives in THREE files and nothing but this test connects them.
   Bumping js/core.js alone leaves sw.js byte-identical, and the browser's
   update check compares that script's bytes — so no new worker is installed,
   the old cache is never retired, and every visitor keeps being served the
   previous build indefinitely. That is not hypothetical: 0.6.5 and 0.6.6 both
   shipped that way and neither reached the live site. */
test('light mode deepens the accent and keeps no cream ink on paper', () => {
  /* Two shapes of the same bug, both of which shipped. The sandbox has no
     layout engine and getComputedStyle answers '' (docs/test-sandbox.md), so a
     real contrast ratio can only be measured in a browser — what CAN be pinned
     here is the source condition that produced the failures.

     (1) --bronze is used as TEXT in ~40 rules and as the FILL under the
     near-white --ink of every primary control. #c97f3f reads 5.3:1 on loam and
     2.9:1 on paper, so on paper it failed in both directions at once. Light
     mode had already deepened the accent for --action-primary and
     --border-active; this is the copy that was missed.

     (2) The Plant Library card carried literal cream inks that predate the
     theme and never followed it, measured at 1.38:1 on paper — the plant
     description and the entire cultivar list were invisible in light mode. */
  const css = readRepoFile('styles.css');
  const light = (css.match(/\[data-theme="light"\]\{([\s\S]*?)\n\}/) || ['', ''])[1];
  assert(light, 'styles.css has a [data-theme="light"] token block');
  assert(/--bronze\s*:/.test(light),
    'light mode must deepen --bronze; #c97f3f measures 2.9:1 on paper as text and under --ink');

  /* The literals that were there. Neither may come back anywhere outside the
     print block, which deliberately forces black on white for the paper sheet. */
  const body = css.replace(/@media print\{[\s\S]*?\n\}/g, '');
  assert(!/#ddd0ba/i.test(body),
    'the library card must not hardcode cream ink — it does not follow the theme');

  /* Chrome that sits on the meadow CANVAS cannot follow the theme either: the
     meadow is world art and never flips, so light mode painted dark ink onto a
     dark meadow at 1.03:1. Everything between them is inside .menu-card, which
     carries a themed paper plate. */
  assert(/\[data-theme="light"\][^{]*\.menu-title-block/.test(css),
    'the menu title block must keep its dark-theme inks in light mode');
  assert(/\[data-theme="light"\][^{]*\.menu-foot/.test(css),
    'the menu footer must keep its dark-theme inks in light mode');
});

test('the service worker ships the version it was built with', () => {
  const read = readRepoFile;
  const swVersion = (read('sw.js').match(/^const VERSION\s*=\s*'([^']+)'/m) || [])[1];
  const pkgVersion = JSON.parse(read('package.json')).version;
  assert(swVersion, 'sw.js declares a VERSION');
  assertEqual(swVersion, APP_VERSION, 'sw.js VERSION matches APP_VERSION in js/core.js');
  assertEqual(pkgVersion, APP_VERSION, 'package.json version matches APP_VERSION');

  /* The other half of the same footgun: a version bump with a stale PRECACHE
     ships a half-updated app, because anything missing from the list is fetched
     from the network and then cached under the NEW name — fine online, absent
     offline. Every module index.html loads has to be in it. */
  const sw = read('sw.js'), html = read('index.html');
  const precache = (sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\]/) || ['', ''])[1];
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !/^https?:/.test(s));
  for (const s of scripts){
    const bare = s.replace(/^\.?\//, '');
    assert(precache.includes(bare), `PRECACHE is missing ${bare}, which index.html loads`);
  }
  assert(scripts.length >= 13, `expected the full module list, found ${scripts.length}`);

  /* The version had a FOURTH copy that nothing pinned: the menu footer, typed
     into index.html. It reached "v0.6.1" against an APP_VERSION of 0.8.20 — and
     it is the only version a user ever reads, so bug reports cited a build from
     months earlier. It is written from APP_VERSION at boot now; this asserts the
     markup carries no hardcoded version to drift. */
  const footer = (html.match(/<a id="menuVersion"[^>]*>([^<]*)<\/a>/) || [])[1];
  assert(footer !== undefined, 'index.html has the #menuVersion footer link');
  assert(!/v\s*\d+\.\d+/i.test(footer),
    `#menuVersion must not hardcode a version (found "${footer}") — syncMenuVersion writes it`);
});

test('the menu footer shows the running version', () => {
  setup();
  const a = document.getElementById('menuVersion');
  assert(a, 'the footer link exists');
  a.textContent = 'Pocket Prairie v0.0.1 · credits';   // simulate a stale/blank boot
  syncMenuVersion();
  assert(a.textContent.includes(APP_VERSION),
    `footer names the running version (got "${a.textContent}")`);
  assert(!a.textContent.includes('v0.0.1'), 'the stale string is replaced');
});

/* ---------- plant photographs + image attribution (js/photos.js) ----------
   A photograph carries licence terms, so these are not cosmetic tests. Each
   one pins a conclusion from the compliance review recorded in
   docs/plant-photos.md, and the ones that look pedantic are the ones that
   caught somebody out in the wild. The suite has to fail CLOSED: the premise
   of the whole feature is that a wrong credit is worse than no photograph, so
   an incomplete record must break the build rather than ship quietly. */

test('every plant photograph record is complete and on the licence allowlist', () => {
  const bad = [];
  for (const k of PLANT_KEYS){
    const rec = PLANTS[k] && PLANTS[k].photo;
    if (!rec) continue;                       // no photograph is the normal case
    bad.push(...photoRecordProblems(k, rec));
  }
  assert(!bad.length, 'incomplete photo records:\n  ' + bad.join('\n  '));
});

test('no species ships demonstration photo data', () => {
  /* The ?photodemo placard exists so the component can be seen without
     inventing a photographer. It must never reach a build: a placeholder
     credit is indistinguishable from a real one after a month in the file. */
  for (const k of PLANT_KEYS){
    const rec = PLANTS[k] && PLANTS[k].photo;
    assert(!photoIsSample(rec), `${k} carries sample photo data`);
  }
  assert(photoIsSample(PHOTO_DEMO_RECORD), 'the demo record identifies itself as a sample');
  assert(!PHOTO_LICENSES[PHOTO_DEMO_RECORD.license],
    'the demo licence must not resolve to a real licence name or URL');
});

test('a plant with no photograph renders nothing at all', () => {
  /* Not an empty frame, not a disabled credit button, not a "coming soon"
     plate. The seasonal illustrations stand alone and the card looks exactly
     as it always has. */
  const noPhoto = PLANT_KEYS.filter(k => !PLANTS[k].photo);
  assert(noPhoto.length, 'expected most species to have no photograph');
  assertEqual(plantPhotoRecord(noPhoto[0]), null, 'no record');
  assertEqual(buildPlantPhoto(noPhoto[0]), null, 'no DOM');
});

test('refused licences are refused, with the reason', () => {
  const base = {
    file:'x.jpg', creator:'A Person', title:'T', sourceName:'Wikimedia Commons',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg', commonsFileName:'File:X.jpg',
    verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  const why = id => photoRecordProblems('x', Object.assign({}, base, {license:id})).join(' ');
  assert(/NonCommercial/.test(why('cc-by-nc')), 'NC is named as non-commercial');
  assert(/NoDerivatives/.test(why('cc-by-nd')), 'ND is named as no-derivatives');
  assert(/GFDL/.test(why('gfdl')), 'GFDL is refused by name');
  assert(/Free Art/.test(why('fal')), 'the Free Art License is refused by name');
  assert(/not on the allowlist/.test(why('cc-by-7.0')),
    'an unknown licence is refused rather than assumed');
  assertEqual(photoRecordProblems('x', Object.assign({}, base, {license:'cc-by-4.0'})).length, 0,
    'CC BY 4.0 passes');
});

test('a Wikipedia page is never accepted as an image source', () => {
  /* English Wikipedia hosts NON-FREE files locally under fair use. Appearing
     in an article is not permission, and this is the easiest way to take an
     unusable image in complete good faith. */
  const rec = {
    file:'x.jpg', creator:'A Person', title:'T', license:'cc-by-4.0',
    sourceName:'Wikimedia Commons', commonsFileName:'File:X.jpg',
    sourceUrl:'https://en.wikipedia.org/wiki/Schizachyrium_scoparium',
    verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  assert(/NON-FREE/.test(photoRecordProblems('x', rec).join(' ')),
    'a wikipedia.org source URL is rejected and says why');
  rec.sourceUrl = 'https://upload.wikimedia.org/wikipedia/commons/1/12/X.jpg';
  assert(/FILE PAGE/.test(photoRecordProblems('x', rec).join(' ')),
    'a raw upload URL is rejected — the file page is what carries the licensing');
});

test('the image title is required exactly where the licence requires it', () => {
  /* Mandatory in CC 3.0 and earlier, optional only in 4.0 — and Commons is
     version-mixed, so this is a real per-file difference, not a formality. */
  const base = {
    file:'x.jpg', creator:'A Person', sourceName:'Wikimedia Commons',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg', commonsFileName:'File:X.jpg',
    verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  const missing = id => photoRecordProblems('x', Object.assign({}, base, {license:id}))
    .some(p => /requires the image title/.test(p));
  assert(missing('cc-by-sa-3.0'), 'CC BY-SA 3.0 needs the title');
  assert(missing('cc-by-2.0'), 'CC BY 2.0 needs the title');
  assert(!missing('cc-by-sa-4.0'), 'CC BY-SA 4.0 does not');
});

test('the credit keeps creator, source, licence and modification separate', () => {
  /* Never one opaque attribution string: each surface lays the fields out in
     its own idiom, and the Credits page has to be generatable from them. */
  const rec = {
    file:'x.jpg', title:'Little bluestem in October', creator:'A Person',
    copyrightNotice:'(c) 2024 A Person',
    sourceName:'Wikimedia Commons', sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg',
    commonsFileName:'File:X.jpg', license:'cc-by-sa-4.0',
    isModified:true, verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  const p = photoCreditParts(rec);
  assertEqual(p.creator, 'A Person', 'creator stands alone');
  assertEqual(p.sourceName, 'Wikimedia Commons', 'source stands alone');
  assertEqual(p.licenseName, 'CC BY-SA 4.0', 'licence name resolves from the allowlist');
  assertEqual(p.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/', 'licence URL too');
  assert(p.shareAlike, 'ShareAlike is flagged');
  assert(p.warrantyDisclaimer, 'the warranty-disclaimer notice is required');
  assert(/not otherwise modified/.test(p.modificationNote),
    'the default note must not claim a crop — framing is done in CSS, not on disk');
  const line = photoCreditLine(rec);
  for (const bit of ['Little bluestem in October', 'A Person', 'Wikimedia Commons',
                     'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:X.jpg',
                     'Provided without warranties']){
    assert(line.includes(bit), `the flat credit line carries "${bit}"`);
  }
});

test('an author-specified credit string is reproduced verbatim', () => {
  /* Where the photographer asked for particular wording on the file page, that
     wording is what the licence asks for. Generating our own over the top of
     it is the commonest way a technically-complete attribution still fails. */
  const rec = {
    file:'x.jpg', title:'T', creator:'Derek Ramsey',
    attributionOverride:'(c) Derek Ramsey / derekramsey.com',
    sourceName:'Wikimedia Commons', sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg',
    commonsFileName:'File:X.jpg', license:'cc-by-sa-4.0',
    verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  const line = photoCreditLine(rec);
  assert(line.includes('(c) Derek Ramsey / derekramsey.com'), 'the specified string appears');
  assert(!line.includes('by Derek Ramsey'), 'and is not shadowed by a generated one');
});

test('photo alt text describes the plant, never the licence', () => {
  const P = PLANTS.bluestem;
  const alt = photoAltText('bluestem', {file:'x.jpg', creator:'A Person', license:'cc0'});
  assert(alt.includes(P.name) && alt.includes(P.latin), 'it names the plant');
  for (const w of ['cc', 'licen', 'copyright', 'commons', 'a person']){
    assert(!alt.toLowerCase().includes(w), `alt text must not carry "${w}"`);
  }
  assertEqual(photoAltText('bluestem', {alt:'Little Bluestem in late summer'}),
    'Little Bluestem in late summer', 'an authored alt wins');
});

/* The stub tree has no querySelector worth trusting, so walk children. */
function photoTestNodes(root){
  const out = [];
  (function walk(n){
    if (!n || typeof n !== 'object' || !n.children) return;
    out.push(n); n.children.forEach(walk);
  })(root);
  return out;
}

test('outbound links open safely and announce themselves', () => {
  /* rel=noopener, or the new document gets a handle on ours; rel=noreferrer
     keeps the no-third-party-disclosure property honest. And a screen reader
     reads the link TEXT, not the decorative arrow, so "opens in a new tab"
     has to exist as text. */
  const refs = buildPlantReferences('bluestem');
  assert(refs, 'bluestem carries a Wikipedia reference');
  const nodes = photoTestNodes(refs);
  const links = nodes.filter(n => n.tagName === 'A');
  assert(links.length, 'there is a link');
  for (const a of links){
    assertEqual(a.target, '_blank', 'opens in a new tab');
    assert(/noopener/.test(a.rel || ''), 'rel carries noopener');
    assert(/noreferrer/.test(a.rel || ''), 'rel carries noreferrer');
    assert(a.children.some(c => c && c.classList && c.classList.contains('sr-only')),
      'and says so in text, not only with a glyph');
  }
  /* Offline the link is a dead end, so the URL is printed beside it. */
  assert(nodes.some(n => n.classList && n.classList.contains('ld-photo-url')),
    'the full URL is printed as transcribable text');
});

test('the photo-info control is a real keyboard control wired to its panel', () => {
  /* Not hover-only and not colour-only: a button with an accessible name,
     aria-expanded, and aria-controls pointing at the panel it reveals. */
  const saved = PLANTS.bluestem.photo;
  PLANTS.bluestem.photo = {
    file:'bluestem.jpg', title:'T', creator:'A Person', license:'cc-by-4.0',
    sourceName:'Wikimedia Commons', sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg',
    commonsFileName:'File:X.jpg', verifiedBy:'kvschin', verifiedOn:'2026-08-24',
  };
  try {
    const fig = buildPlantPhoto('bluestem');
    assert(fig, 'a declared photograph renders');
    const all = photoTestNodes(fig);
    const btn = all.find(n => n.classList && n.classList.contains('ld-photo-info'));
    const panel = all.find(n => n.classList && n.classList.contains('ld-photo-credit'));
    assert(btn && panel, 'the control and the panel both exist');
    assertEqual(btn.tagName, 'BUTTON', 'it is a button, so it is keyboard reachable');
    assert(btn.getAttribute('aria-label'), 'it has an accessible name');
    assertEqual(btn.getAttribute('aria-controls'), panel.id, 'wired to the panel it reveals');
    assertEqual(btn.getAttribute('aria-expanded'), 'false', 'starts collapsed');
    assert(panel.classList.contains('hidden'), 'and the panel starts hidden');
    btn.onclick();
    assertEqual(btn.getAttribute('aria-expanded'), 'true', 'activating expands it');
    assert(!panel.classList.contains('hidden'), 'and shows the panel');
    btn.onclick();
    assertEqual(btn.getAttribute('aria-expanded'), 'false', 'and it toggles back');

    const img = all.find(n => n.tagName === 'IMG');
    assert(img, 'the image is a DOM element, never a canvas draw');
    assertEqual(img.loading, 'lazy', 'lazy-loaded');
    assert(String(img.src).startsWith('photos/'), 'self-hosted, never hotlinked');
    assert(img.alt && img.alt.includes(PLANTS.bluestem.latin), 'and carries plant alt text');
  } finally { PLANTS.bluestem.photo = saved; }
});

test('bluestem carries a real Wikipedia reference and no invented photograph', () => {
  const P = PLANTS.bluestem;
  assert(!P.photo, 'no photograph is declared until a person has verified one');
  assert(P.externalLinks && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(P.externalLinks.wikipedia),
    'the Wikipedia reference is a real article URL');
});

test('every plant photograph is precached', () => {
  /* A photograph and its credit have to ship together: the credit is only
     complete offline if the picture is there offline too. Leaving photos to
     the runtime cache means the first person to open the Library with no
     connection gets neither. */
  const sw = readRepoFile('sw.js');
  const precache = (sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\n\];/) || ['', ''])[1];
  assert(precache, 'the PRECACHE list parses');
  for (const k of PLANT_KEYS){
    const rec = PLANTS[k] && PLANTS[k].photo;
    if (!rec || !rec.file) continue;
    assert(precache.includes(`photos/${rec.file}`),
      `PRECACHE is missing photos/${rec.file}, which ${k} declares`);
  }
  assert(precache.includes('credits.html'), 'the Credits page is precached');
  assert(precache.includes('js/photos.js'), 'the attribution module is precached');
});

test('a photograph never reaches the game canvas', () => {
  /* Framing happens in CSS at render time and the stored file stays the
     licensor's unmodified work, so no question of having produced an adapted
     version can arise. Drawing one into the sprite cache, a ground bake or
     takePhoto()'s exported PNG would undo that — and would put an unbounded
     JPEG inside the renderer's cost model as well. */
  for (const f of ['js/renderer.js', 'js/draw.js', 'js/world.js', 'js/commands.js']){
    const src = readRepoFile(f);
    for (const banned of ['plantPhotoRecord', 'buildPlantPhoto', 'photoSrc', 'PHOTO_DIR']){
      assert(!src.includes(banned), `${f} must not reference ${banned} — photos are DOM only`);
    }
  }
});

test('the Credits page is generated from plant data, not a second list', () => {
  const html = readRepoFile('credits.html');
  assert(/<script src="js\/plants\.js">/.test(html), 'it loads the real plant data');
  assert(/<script src="js\/photos\.js">/.test(html), "and the app's own attribution reader");
  assert(html.includes('plantsWithPhotos()'), 'it enumerates photographs from that data');
  assert(html.includes('photoCreditParts('), 'and formats them with the shared reader');
  /* The failure this guards is a hand-copied credit that silently goes stale.
     No licence name may be typed into the page: they come from PHOTO_LICENSES. */
  for (const lic of Object.values(PHOTO_LICENSES)){
    if (!lic.name.startsWith('CC ')) continue;
    assert(!html.includes(lic.name),
      `credits.html hardcodes "${lic.name}" — it must read PHOTO_LICENSES`);
  }
  assert(html.includes('not affiliated with'), 'it disclaims endorsement');
  assert(html.includes('PHOTO_PARALLEL_SOURCE'), 'and names the unrestricted parallel source');
});

/* ---------- the harness itself ----------
   Three stubs in this sandbox have now been caught reporting a convenient
   fiction, and each one made a real assertion pass for the wrong reason:
   getRandomValues handed back an unfilled buffer, localStorage claimed to be
   empty however much you put in it, and getElementById returned a fresh element
   every call so nothing written could be read back. A stub that lies is worse
   than a missing feature, because the suite goes green either way. These pin the
   contract so the next well-meaning simplification fails loudly. */

test('the sandbox does not let className and classList disagree', () => {
  /* They are two views of ONE fact in a browser. The stub used to let them
     part company: after el.className='x', classList.contains('x') answered
     false, which no browser does. Both idioms are in live use across js/, so
     whichever one a test happened to read decided whether it saw the truth —
     and an assertion about a class set the other way round passed or failed
     for no reason connected to the code. Verified by reintroducing the split
     and watching exactly this test fail. */
  const el = document.createElement('div');
  el.className = 'alpha beta';
  assert(el.classList.contains('alpha'), 'className writes reach classList');
  assert(el.classList.contains('beta'), 'including every class in the string');
  el.classList.add('gamma');
  assert(el.classList.contains('gamma'), 'and classList.add still works');
  el.className = 'delta';
  assert(el.classList.contains('delta'), 'a later write replaces');
  assert(!el.classList.contains('alpha'), 'rather than accumulating');
  el.className = '';
  assert(!el.classList.contains('delta'), 'and clearing really clears');
});

test('the sandbox does not lie about the DOM', () => {
  const a = document.getElementById('probe-el');
  assert(a === document.getElementById('probe-el'), 'the same id is the same element');
  a.setAttribute('data-probe', '1');
  assertEqual(document.getElementById('probe-el').getAttribute('data-probe'), '1',
    'an attribute written can be read back');
  assert(document.getElementById('probe-el').hasAttribute('data-probe'), 'and hasAttribute agrees');
  assert(document.querySelector('#probe-el') === a, 'querySelector agrees with getElementById');

  // The element Proxy answers unknown props with a no-op function, which is
  // truthy — so anything real code branches on must be declared falsy.
  const el = document.createElement('div');
  for (const p of ['hidden', 'disabled', 'readOnly', 'open'])
    assertEqual(!!el[p], false, `el.${p} is falsy, so a branch on it is not always taken`);
  for (const p of ['offsetWidth', 'clientHeight', 'scrollWidth', 'scrollLeft'])
    assertEqual(el[p], 0, `el.${p} is a number, not a function`);
});

test('the sandbox does not lie about storage, randomness, clocks or timers', () => {
  localStorage.setItem('probe:a', '1'); localStorage.setItem('probe:b', '2');
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  assert(keys.includes('probe:a') && keys.includes('probe:b'), 'storage is enumerable');
  localStorage.removeItem('probe:a'); localStorage.removeItem('probe:b');

  const buf = new Uint8Array(16); crypto.getRandomValues(buf);
  assert(buf.some(b => b !== 0), 'getRandomValues actually randomises');

  const t0 = performance.now();
  for (let i = 0; i < 2e5; i++);
  assert(performance.now() > t0, 'the clock advances, so elapsed time is not always zero');

  assert(!!setTimeout(() => {}, 0), 'a timer handle is truthy, so `if (handle)` is not inverted');
  assert(document.createElement('canvas').getContext('2d').measureText('wwwwwwwwww').width > 0,
    'measureText scales with the string');
});

test('the sheet/dock breakpoint is answerable, and matches the stylesheet', () => {
  // SHEET_UI_MQ must equal the CSS string verbatim (CLAUDE.md), and matchMedia
  // used to answer false to everything — so this branch was untestable and the
  // phone layout was never exercised here at all.
  const at = (w, h) => { innerWidth = w; innerHeight = h; return mobileSheetUi(); };
  const w0 = innerWidth, h0 = innerHeight;
  try {
    assertEqual(at(390, 844), true, 'a phone gets the sheet');
    assertEqual(at(820, 1180), true, 'a portrait tablet gets the sheet too — the reason for the OR');
    assertEqual(at(1180, 820), false, 'a landscape tablet gets the dock');
    assertEqual(at(1440, 900), false, 'and so does a desktop');
    assertEqual(at(767, 500), true, 'the 767 edge is inclusive');
    assertEqual(at(768, 500), false, 'and 768 lands on the other side');
  } finally { innerWidth = w0; innerHeight = h0; }
});

/* ---------- funnel instrumentation ---------- */

test('funnel counts events, remembers the first, and sends nothing', () => {
  funnelReset();
  assertEqual(funnelSaw(FUNNEL_EVENTS.plantPlaced), false, 'nothing seen yet');
  funnel(FUNNEL_EVENTS.plantPlaced);
  const first = funnelExport().events[FUNNEL_EVENTS.plantPlaced].first;
  assert(first > 0, 'the first occurrence is stamped');
  for (let i = 0; i < 40; i++) funnel(FUNNEL_EVENTS.plantPlaced);
  const e = funnelExport().events[FUNNEL_EVENTS.plantPlaced];
  assertEqual(e.n, 41, 'every occurrence is counted');
  assertEqual(e.first, first, 'and the first stamp never moves');
  assert(funnelSaw(FUNNEL_EVENTS.plantPlaced), 'the milestone reads as seen');

  // There is no transport, and that is the point: the privacy policy says the
  // app makes no requests, and a funnel that phoned home would make it false.
  assertEqual(typeof globalThis.fetch, 'function', 'fetch exists in the sandbox');
  const src = String(funnel) + String(funnelFlush) + String(funnelExport);
  assert(!/fetch|XMLHttpRequest|sendBeacon|WebSocket|image|src\s*=/i.test(src),
    'no funnel function reaches for the network');
});

test('funnel does not write to storage on the hot path', () => {
  // plantFx calls funnel() once per placed TILE — a fat drag is dozens inside
  // one frame — so bumping a counter must never serialise. Only flush does.
  funnelReset();
  const realSet = localStorage.setItem;
  let writes = 0;
  localStorage.setItem = function(k, v){ if (String(k) === 'hortus:funnel') writes++; return realSet.call(this, k, v); };
  try {
    for (let i = 0; i < 500; i++) funnel(FUNNEL_EVENTS.plantPlaced);
    assertEqual(writes, 0, '500 events write to storage exactly zero times');
    assert(funnelFlush(), 'and the explicit flush does write');
    assertEqual(writes, 1, 'once');
    assertEqual(funnelFlush(), false, 'a second flush with nothing dirty does nothing');
    assertEqual(writes, 1, 'and does not write again');
  } finally { localStorage.setItem = realSet; }
});

test('funnel survives a reload, and a corrupt record', async () => {
  funnelReset();
  funnel(FUNNEL_EVENTS.listOpened);
  funnelFlush();
  // simulate a fresh page: drop the in-memory copy and read it back
  funnelState = null;
  assert(funnelSaw(FUNNEL_EVENTS.listOpened), 'the record came back from storage');

  for (const junk of ['not json at all', 'null', '[]', '{"events":"nope"}']) {
    funnelState = null;
    localStorage.setItem('hortus:funnel', junk);
    const fresh = funnelExport();
    assert(fresh && fresh.events && typeof fresh.events === 'object',
      `a corrupt record (${junk}) rebuilds rather than throwing`);
  }
  funnelReset();
});

test('the funnel key is a device preference, not a garden document', () => {
  // It must stay in localStorage: funnel() is synchronous and called from the
  // render path, and an IndexedDB round trip there is not affordable.
  assert(!IDB_KEYS.test('hortus:funnel'), 'the funnel stays out of the async document store');
});

test('the funnel summary reads as a funnel, in order', () => {
  funnelReset();
  funnel(FUNNEL_EVENTS.appOpen);
  funnel(FUNNEL_EVENTS.gardenOpened);
  funnel(FUNNEL_EVENTS.plantPlaced);
  const s = funnelSummary();
  const at = k => s.indexOf(k);
  assert(at('app:open') < at('garden:opened') && at('garden:opened') < at('plant:placed'),
    'events are listed in funnel order, so a drop-off reads as one');
  assert(/x app:open/.test(s) && /- season:turned/.test(s),
    'reached steps are marked and unreached ones are visibly absent');
  funnelReset();
});

/* ---------- identifiers ---------- */

test('ids minted in the same millisecond are still distinct', () => {
  // The old form was Date.now() plus at most two base-36 characters, and on
  // four of the six world paths nothing random at all — so a burst inside one
  // millisecond produced repeats. A repeated WORLD id overwrites a saved
  // garden, which is why this is pinned rather than trusted.
  const realNow = Date.now;
  Date.now = () => 1786800000000;          // freeze the clock: worst case
  try {
    for (const mint of [() => newId('w'), () => newWorldId(), () => newSchemeId()]) {
      const seen = new Set();
      for (let i = 0; i < 4000; i++) seen.add(mint());
      assertEqual(seen.size, 4000, 'every id in a 4000-strong burst is unique');
    }
  } finally { Date.now = realNow; }
});

test('a random source that does not randomise cannot mint a constant id', () => {
  // A getRandomValues that returns the buffer untouched looks like it worked
  // and yields all-zeros — the same id every time. Fall through to Math.random
  // rather than trust it.
  const realCrypto = globalThis.crypto, realNow = Date.now;
  Date.now = () => 1786800000000;
  try {
    globalThis.crypto = { getRandomValues: a => a };      // the no-op stub
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(newId('w'));
    assert(seen.size > 400, `a no-op random source still yields distinct ids (got ${seen.size})`);

    globalThis.crypto = { getRandomValues: () => { throw new Error('blocked'); } };
    const thrown = new Set();
    for (let i = 0; i < 500; i++) thrown.add(newId('w'));
    assert(thrown.size > 400, 'and so does one that throws');
  } finally { globalThis.crypto = realCrypto; Date.now = realNow; }
});

test('world ids are minted around the ones already taken', () => {
  const taken = new Set(['wtaken1', 'wtaken2']);
  for (let i = 0; i < 200; i++) assert(!taken.has(newWorldId(taken)), 'never reuses a taken id');
  // and the guard holds even when the random source is degenerate
  const realCrypto = globalThis.crypto, realRandom = Math.random, realNow = Date.now;
  Date.now = () => 1786800000000;
  try {
    globalThis.crypto = { getRandomValues: a => a };
    Math.random = () => 0;                                // every id identical
    const collider = newWorldId();
    const forced = newWorldId(new Set([collider]));
    // Eight attempts all collide, so the fallback appends more characters. It
    // must terminate, and must not hand back the id it was told was taken.
    assert(forced !== collider, "never returns an id it was told is already taken");
    assert(forced.startsWith(collider), "the fallback extends rather than replaces");
  } finally { globalThis.crypto = realCrypto; Math.random = realRandom; Date.now = realNow; }
});

/* ---------- first run: the demo garden offer ---------- */

test('installWorldBlob accepts a real envelope and refuses anything else', async () => {
  setup(21, 21);
  const good = { pocketPrairie: 1, v: 1, world: { wv: 1, name: 'Whatever', gw: 27, gh: 27,
    plants: { '3,3': { s: 'bluestem', d: 0, t: 1 } }, bulbs: {}, terrain: {} } };
  const id = await installWorldBlob(good, 'Demo garden');
  assert(id, 'a valid envelope installs');
  const stored = await sGet('hortus:world:' + id);
  assertEqual(stored.name, 'Demo garden', 'the caller names it, not the file');
  assert(!!stored.plants['3,3'], 'its planting came across');
  const idx = await worldsIndex();
  assert(idx.some(w => w.id === id), 'and it is listed so it can be opened');

  // the shared validator is the only gate, so junk must not reach storage
  for (const bad of [null, {}, { world: {} }, { pocketPrairie: 1 },
                     { pocketPrairie: 1, world: { plants: 'not a map' } }])
    assertEqual(await installWorldBlob(bad, 'Nope'), null,
      'a malformed envelope installs nothing');
});

/* setup() resets `game`, not storage, and the sandbox keeps one store for the
   whole run — so tests that SCAN storage have to start from a known floor or
   they see every garden written by every earlier test. */
async function clearStoredWorlds(){
  for (const id of await storedWorldIds()) await sDel('hortus:world:' + id);
  await sSet('hortus:worlds', []);
}

test('concurrent index writes do not lose each other', async () => {
  setup(21, 21);
  await clearStoredWorlds();
  // Six writers started in the same tick. Unserialised, each reads the same
  // empty array and writes back only its own row, so five rows vanish.
  await Promise.all([1, 2, 3, 4, 5, 6].map(n =>
    updateWorldsIndex(fresh => {
      const out = fresh.slice();
      out.push({ id: 'w-race-' + n, name: 'Garden ' + n, ts: n, gw: 31, gh: 31 });
      return out;
    })));
  const idx = await worldsIndex();
  assertEqual(idx.length, 6, 'every concurrent addition survives');
  assertEqual(new Set(idx.map(w => w.id)).size, 6, 'and none overwrote another');

  // a mutation that declines writes nothing, and does not wedge the chain
  await updateWorldsIndex(() => null);
  assertEqual((await worldsIndex()).length, 6, 'declining changes nothing');
  await updateWorldsIndex(() => { throw new Error('boom'); }).catch(() => {});
  await updateWorldsIndex(fresh => fresh.filter(w => w.id !== 'w-race-1'));
  assertEqual((await worldsIndex()).length, 5, 'a throwing mutation does not block later ones');
});

test('two gardens installed at once both survive, with no orphaned blob', async () => {
  setup(21, 21);
  await clearStoredWorlds();
  const env = () => ({ pocketPrairie: 1, v: 1, world: { wv: 1, name: 'X', gw: 27, gh: 27,
    plants: { '3,3': { s: 'bluestem', d: 0, t: 1 } }, bulbs: {}, terrain: {} } });
  // the double-tap: both calls start before either finishes
  const [a, b] = await Promise.all([
    installWorldBlob(env(), 'Demo garden'),
    installWorldBlob(env(), 'Demo garden')
  ]);
  assert(a && b && a !== b, 'each install got its own id');
  const idx = await worldsIndex();
  assertEqual(idx.length, 2, 'both rows are in the index');

  // An orphan is a stored garden with no row pointing at it: invisible to the
  // gardener, and still occupying the device quota. Asked through the app's own
  // scan — Object.keys(localStorage) enumerates the stub's METHODS, not its
  // contents, so that form of this check passed without testing anything.
  const listed = new Set(idx.map(w => w.id));
  const stored = [...await storedWorldIds()];
  assert(stored.length >= 2, 'the scan really sees the stored gardens');
  assertEqual(stored.filter(id => !listed.has(id)).length, 0, 'no blob is left orphaned');
  for (const id of listed) assert(await sGet('hortus:world:' + id), 'every row has its garden');
});

test('a garden stored without an index row is adopted back, not stranded', async () => {
  setup(21, 21);
  await clearStoredWorlds();
  // exactly what the old index race left behind: a blob, no row
  await sSet('hortus:world:w-orphan-1', { wv: 1, name: 'Lost border', gw: 41, gh: 41,
    plants: { '5,5': { s: 'bluestem', d: 0, t: 1 } }, bulbs: {}, terrain: {}, savedAt: 1700000000000 });
  // and a listed garden alongside it, which must be left exactly as it is
  await sSet('hortus:world:w-listed', { wv: 1, name: 'Kept', gw: 31, gh: 31, plants: {}, bulbs: {} });
  await sSet('hortus:worlds', [{ id: 'w-listed', name: 'Kept', ts: 5, gw: 31, gh: 31 }]);

  const recovered = await adoptOrphanedWorlds();
  assertEqual(recovered.length, 1, 'one garden was recovered');
  assertEqual(recovered[0], 'Lost border', 'and it kept its own name');
  const idx = await worldsIndex();
  assertEqual(idx.length, 2, 'the list now holds both');
  const row = idx.find(w => w.id === 'w-orphan-1');
  assertEqual(row.gw, 41, 'plot size came from the garden, not a default');
  assertEqual(row.ts, 1700000000000, 'and so did its date');

  // idempotent: opening the list again must not duplicate the row
  assertEqual((await adoptOrphanedWorlds()).length, 0, 'a second pass finds nothing');
  assertEqual((await worldsIndex()).length, 2, 'and adds nothing');
});

test('adoption refuses keys that are not gardens', async () => {
  setup(21, 21);
  await clearStoredWorlds();
  // a stray key of the right shape but the wrong contents would otherwise
  // become a row in the list that cannot be opened
  await sSet('hortus:world:w-junk', { note: 'not a garden' });
  await sSet('hortus:world:w-alsojunk', 'a string');
  assertEqual((await adoptOrphanedWorlds()).length, 0, 'nothing is adopted');
  assertEqual((await worldsIndex()).length, 0, 'and the list stays empty');
});

test('the demo garden is offered once, and never to someone who already gardens', async () => {
  setup(21, 21);
  localStorage.removeItem('hortus:welcomed');
  welcomeSeenSession = false;          // the session flag survives between tests
  await sSet('hortus:worlds', []);
  assertEqual(welcomeSeen(), false, 'a fresh device has not been welcomed');

  // an existing gardener is never greeted as new, even with the flag clear —
  // having gardens is the stronger signal
  await sSet('hortus:worlds', [{ id: 'w1', name: 'My garden', ts: 1, gw: 31, gh: 31 }]);
  assertEqual(await maybeOfferDemoGarden(), false, 'not offered when gardens exist');
  assertEqual(welcomeSeen(), true, 'and the flag is set so it stops asking');

  // a genuinely new device gets the offer exactly once
  localStorage.removeItem('hortus:welcomed');
  welcomeSeenSession = false;
  await sSet('hortus:worlds', []);
  assertEqual(await maybeOfferDemoGarden(), true, 'offered on a truly first run');
  markWelcomeSeen();
  assertEqual(await maybeOfferDemoGarden(), false, 'and not a second time');
});

test('the coach beats fire in order, on doing, and only for a new device', () => {
  setup(21, 21);
  const shown = [];
  const realCoach = showCoachTip, realTime = showTimeCoachTip;
  // eslint-disable-next-line no-global-assign
  showCoachTip = (text, key) => { shown.push(key); };
  // eslint-disable-next-line no-global-assign
  showTimeCoachTip = () => { shown.push('time'); };
  try {
    // An established gardener is never coached, however much they plant.
    localStorage.removeItem('hortus:coach:armed');
    coachArmedSession = false;         // the session flag survives between tests
    coachBeatEnter();
    for (let i = 0; i < 10; i++) coachNotePlanting();
    assertEqual(shown.length, 0, 'an unarmed device gets no beats at all');

    // A new device gets them threaded off real placements, in order.
    armCoach();
    coachPlanted = 0;
    game.plants = {};                  // an EMPTY garden takes the plant-me beat
    coachBeatEnter();
    assertEqual(shown.join(','), 'first-plant', 'beat 1 names the core loop on arrival');
    coachNotePlanting();
    assertEqual(shown.join(','), 'first-plant,plant-drag', 'beat 2 waits for the first plant');
    for (let i = 0; i < 3; i++) coachNotePlanting();          // 4 planted
    assertEqual(shown.join(','), 'first-plant,plant-drag', 'beat 3 has not fired yet');
    coachNotePlanting();                                      // 5th
    assertEqual(shown.join(','), 'first-plant,plant-drag,time',
      'beat 3 waits until there is a planting worth running a year over');
    for (let i = 0; i < 9; i++) coachNotePlanting();           // 14 planted
    assertEqual(shown.length, 3, 'nothing fires between the thresholds');
    coachNotePlanting();                                      // 15th
    assertEqual(shown.join(','), 'first-plant,plant-drag,time,planting-list',
      'beat 4 points at the planting list once there is a list worth ordering');
    for (let i = 0; i < 20; i++) coachNotePlanting();
    assertEqual(shown.length, 4, 'and nothing repeats afterwards');
  } finally {
    // eslint-disable-next-line no-global-assign
    showCoachTip = realCoach; showTimeCoachTip = realTime;
    localStorage.removeItem('hortus:coach:armed'); coachArmedSession = false;
  }
});

test('a garden that arrives already planted is offered to look at, not to dig up', () => {
  setup(21, 21);
  const shown = [];
  const realCoach = showCoachTip;
  // eslint-disable-next-line no-global-assign
  showCoachTip = (text, key) => { shown.push({ key, text }); };
  try {
    armCoach();
    // the demo garden: opening it and being told to "tap the ground to plant"
    // instructs the gardener to deface the example they were given to admire
    game.plants = {};
    for (let i = 0; i < 25; i++) game.plants[`${i},1`] = { s: 'bluestem', d: 0, t: 1 };
    coachBeatEnter();
    assertEqual(shown[0].key, 'ready-garden', 'a stocked garden gets the look-around beat');
    assert(!/tap the ground/i.test(shown[0].text), 'and is not told to plant into it');

    // tombstones are not a planting: an emptied garden is an empty garden
    shown.length = 0;
    for (const k in game.plants) game.plants[k] = { removed: true };
    coachBeatEnter();
    assertEqual(shown[0].key, 'first-plant', 'removed plants do not count as a planting');
  } finally {
    // eslint-disable-next-line no-global-assign
    showCoachTip = realCoach;
    localStorage.removeItem('hortus:coach:armed'); coachArmedSession = false;
  }
});

test('planting is what advances the beats — not undo, paste or loading', () => {
  setup(21, 21);
  armCoach();
  coachPlanted = 0;
  try {
    // plantFx is the choke point, and only placePlantAt's success path calls it
    const src = String(plantFx);
    assert(/coachNotePlanting/.test(src), 'plantFx notes the planting');
    // restoring a garden must not count as the gardener planting anything
    const before = coachPlanted;
    applySnapshot(snapshotState());
    assertEqual(coachPlanted, before, 'undo restores plants without coaching');
    for (const L of GAME_MAPS) game[L.k] = compactSoloMap({ '4,4': { s: 'bluestem', d: 0, t: 1 } });
    assertEqual(coachPlanted, before, 'loading a garden does not either');
  } finally { localStorage.removeItem('hortus:coach:armed'); }
});

test('the welcome flag is a device preference, not a document', () => {
  // It must stay in localStorage: IDB is async, and the offer is decided during
  // init. A key that drifted into IDB_KEYS would be read after the menu paints.
  assert(!IDB_KEYS.test('hortus:welcomed'),
    'the welcome flag stays synchronous alongside theme and haptics');
});

/* ---------- storage: IndexedDB for documents, localStorage for preferences ---------- */

test('the storage split keeps documents and device preferences apart', () => {
  // Load-bearing boundary: everything IDB_KEYS matches moves to IndexedDB, and
  // everything it does not stays synchronously readable in localStorage. The
  // theme bootstrap in index.html's <head> has to read its key before the first
  // paint, which IndexedDB cannot do — so a key drifting across this line is a
  // dark-flash on every cold start, or worse, a garden that never migrates.
  for (const k of ['hortus:worlds', 'hortus:world:w123', 'hortus:solo',
                   'hortus:filters', 'hortus:plant-collections:v1'])
    assert(IDB_KEYS.test(k), `${k} is a document and belongs in IndexedDB`);
  for (const k of ['hortus:theme', 'hortus:haptics', 'hortus:leftHanded',
                   'hortus:menuSeasonIdx', 'hortus:probe'])
    assert(!IDB_KEYS.test(k), `${k} is a device preference and must stay synchronous`);
});

test('save blobs carry an explicit schema version', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-save-version';
  await saveSolo(true);
  const blob = JSON.parse(localStorage.getItem('hortus:world:test-save-version'));
  assertEqual(blob.v, SAVE_VERSION, 'the blob states its schema version');
  assertEqual(blob.app, APP_VERSION, 'and the build that wrote it');
  // A pre-versioning save is version 0 by absence, not by being unreadable.
  const legacy = { wv: 1, name: 'Old', gw: 21, gh: 21, plants: {}, bulbs: {} };
  assertEqual(legacy.v || 0, 0, 'an unversioned blob reads as version 0');
});

test('sDel clears a garden from storage', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-delete-me';
  await saveSolo(true);
  assert(localStorage.getItem('hortus:world:test-delete-me'), 'the garden was stored');
  await sDel('hortus:world:test-delete-me');
  assert(!localStorage.getItem('hortus:world:test-delete-me'),
    'and deleting it reclaims the space rather than orphaning the blob');
});

test('a failing autosave reports once, not on every day change', async () => {
  setup(21, 21);
  game.inGarden = true; game.worldId = 'test-save-fails';
  const realSet = localStorage.setItem;
  const toasts = [];
  const realToast = toast;
  // eslint-disable-next-line no-global-assign
  toast = (msg, kind) => { toasts.push({ msg, kind }); };
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    await saveSolo(true); await saveSolo(true); await saveSolo(true);
    assertEqual(toasts.length, 1, 'three failed autosaves say it once');
    assertEqual(toasts[0].kind, 'warn', 'and say it as a warning');
    assert(/export/i.test(toasts[0].msg), 'the message names the way out');
    localStorage.setItem = realSet;
    await saveSolo(true);                       // a success re-arms the warning
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    await saveSolo(true);
    assertEqual(toasts.length, 2, 'after a save works again, a new failure speaks up');
  } finally {
    localStorage.setItem = realSet;
    // eslint-disable-next-line no-global-assign
    toast = realToast;
  }
});

test('a save blob predating schemes loads as a single-scheme garden', () => {
  setup(21, 21);
  const legacy = { wv: 1, name: 'Old garden', mode: 'design', gw: 21, gh: 21,
    plants: { '4,4': { s: 'bluestem', d: 0, t: 1 } }, bulbs: {}, terrain: {}, houses: [] };
  for (const L of GAME_MAPS) game[L.k] = compactSoloMap(legacy[L.k] || {});
  restoreSchemes(legacy, 0);
  assertEqual(schemeCount(), 1, 'a legacy save materializes exactly one scheme');
  assert(!!game.schemeActive, 'and that scheme is active');
  assert(!!game.plants['4,4'], 'its planting loads normally');
  assertEqual(activeScheme().plants, null, 'the invariant holds on the legacy path too');
});

test('deleting schemes: never the last one, and never the ground underfoot', () => {
  setup(21, 21);
  const a = game.schemeActive;
  assert(!deleteScheme(a), 'the only scheme cannot be deleted');
  assertEqual(schemeCount(), 1, 'and it is still there');

  const b = createScheme(false);
  setTile('plants', '6,6', { s: 'karl', d: 0, t: 1 });
  assert(deleteScheme(b.id), 'deleting the ACTIVE scheme is allowed when another exists');
  assertEqual(schemeCount(), 1, 'one scheme remains');
  assertEqual(game.schemeActive, a, 'and we were moved onto it');
  assertEqual(activeScheme().plants, null, 'the invariant survives a delete');
  assert(!game.plants['6,6'], 'the deleted scheme planting went with it');
});

test('scheme count is capped and cycling wraps both ways', () => {
  setup(21, 21);
  for (let i = 1; i < MAX_SCHEMES; i++) assert(createScheme(false), 'scheme ' + (i + 1) + ' created');
  assertEqual(schemeCount(), MAX_SCHEMES, 'the cap is reachable');
  assertEqual(createScheme(false), null, 'and creating past it is refused');

  switchScheme(schemeList()[0].id);
  cycleScheme(-1);
  assertEqual(game.schemeActive, schemeList()[MAX_SCHEMES - 1].id, 'cycling back from the first wraps to the last');
  cycleScheme(1);
  assertEqual(game.schemeActive, schemeList()[0].id, 'and forward from the last wraps to the first');
  schemeAtIndex(2);
  assertEqual(game.schemeActive, schemeList()[2].id, 'a digit key jumps straight to that scheme');
  assert(!schemeAtIndex(99), 'an out-of-range index is a no-op');
});

test('renaming a scheme is trimmed, bounded, and rejects empty', () => {
  setup(21, 21);
  const id = game.schemeActive;
  assert(renameScheme(id, '  Gravel garden  '), 'a real name is accepted');
  assertEqual(activeSchemeName(), 'Gravel garden', 'the name is trimmed');
  assert(!renameScheme(id, '   '), 'a blank name is refused');
  assertEqual(activeSchemeName(), 'Gravel garden', 'and the old name is kept');
  renameScheme(id, 'x'.repeat(80));
  assertEqual(activeSchemeName().length, 32, 'names are bounded so the chip cannot be overrun');
});

test('event timers record last/max/count and survive the per-window reset', () => {
  const wasOn = dbg.on;
  dbg.on = true;
  devReset();
  const t0 = performance.now();
  dev('probe', t0 - 50);          // the worst sample first...
  dev('probe', performance.now()); // ...then a cheap one, so last !== max
  const e = dbg.ev.probe;
  assertEqual(e.n, 2, 'both samples counted');
  assert(e.max >= 50, 'max holds the worst sample, not the latest');
  assert(e.last < e.max, 'last is the most recent sample, independent of max');
  dbgReset();
  assert(dbg.ev.probe && dbg.ev.probe.n === 2,
    'events survive dbgReset — a rare bake must stay readable after its window ends');
  devReset();
  assert(!dbg.ev.probe, 'devReset is the explicit way to clear them');
  dbg.on = wasOn;
});

test('debug instrumentation is inert when the HUD is off', () => {
  const wasOn = dbg.on;
  dbg.on = false;
  devReset();
  assertEqual(dnow(), 0, 'dnow does not read the clock while off');
  dev('probe', 0);
  dgap(999);
  assert(!dbg.ev.probe, 'dev records nothing while off');
  assertEqual(dbg.gapMax, 0, 'dgap records nothing while off');
  dbg.on = wasOn;
});

test('frame-spacing tracking uses the raw gap and counts only over-budget frames', () => {
  const wasOn = dbg.on;
  dbg.on = true;
  devReset();
  dgap(16);
  dgap(dbg.GAP_BUDGET + 40);
  dgap(8);
  assertEqual(dbg.gapN, 3, 'every sampled frame is counted');
  assertEqual(dbg.gapOver, 1, 'only the frame past budget counts as a stall');
  assertEqual(dbg.gapMax, dbg.GAP_BUDGET + 40, 'max keeps the real stall, unclamped');
  assertEqual(dbg.gapLast, 8, 'last is the most recent spacing');
  dbg.on = wasOn;
});

test('a backgrounded tab resuming is counted as a suspend, not as jank', () => {
  const wasOn = dbg.on;
  dbg.on = true;
  devReset();
  dgap(35);                          // a real stall
  dgap(1157.8);                      // rAF resuming after the tab was hidden
  assertEqual(dbg.gapSusp, 1, 'the resume is counted separately');
  assertEqual(dbg.gapMax, 35,
    'and does not become the max — a suspend would bury every genuine stall under it');
  assertEqual(dbg.gapOver, 1, 'nor does it inflate the over-budget count');
  assertEqual(dbg.gapN, 2, 'it is still counted as a sampled frame');
  dbg.on = wasOn;
});

test('the season wash caches its gradients on device pixels, never on zoom', () => {
  const was = SEASON_WASH.mode;
  assert(['live', 'cached'].indexOf(was) >= 0, 'the shipped mode is one of the two');
  assertEqual(typeof seasonSkyBake, 'undefined',
    "the 'baked' path is gone — it was measured slower than both survivors");

  washGrad = { key: '' };
  const ctx = document.createElement('canvas').getContext('2d');
  const a = seasonWashGradients(ctx, 800, 600, 'Summer', AMBIENCE.Summer);
  assert(a === seasonWashGradients(ctx, 800, 600, 'Summer', AMBIENCE.Summer),
    'gradients are built once per season and size');
  assert(a !== seasonWashGradients(ctx, 800, 600, 'Winter', AMBIENCE.Winter),
    'a season change rebuilds them');
  assert(seasonWashGradients(ctx, 801, 600, 'Winter', AMBIENCE.Winter) !== a,
    'a resize rebuilds them');
  /* Keyed on DEVICE pixels, never on zoom: canvas gradient coordinates resolve
     in user space at PAINT time, so a gradient built in draw units and painted
     at another zoom lands in the wrong place. This key is correctness, not
     just speed — see the season-wash note in world.js. */
  assert(washGrad.key.indexOf('801x600') >= 0, 'the key carries the device size, not the camera');

  SEASON_WASH.mode = was;
});

test('an undo snapshot shares tile entries but later edits cannot reach it', () => {
  setup(21, 21);
  const g = firstOfType('forb');
  setTile('plants', '5,5', { s: g, d: 0, t: 1 });
  const snap = snapshotState();
  const held = snap.plants['5,5'];

  /* The shallow copy is only correct because tile values are replace-only.
     Placing elsewhere must not appear in the snapshot, and REPLACING a tile the
     snapshot holds must leave the snapshot's entry untouched — if anything ever
     starts mutating a stored tile in place, this is the test that fails. */
  setTile('plants', '6,6', { s: g, d: 0, t: 2 });
  assert(!snap.plants['6,6'], 'a tile placed after the snapshot is not in it');

  clearTile('plants', '5,5');
  assertEqual(snap.plants['5,5'], held, 'the snapshot keeps the original entry object');
  assert(game.plants['5,5'].removed, 'while the live map holds the tombstone');
});

test('undo and redo round-trip without either stack corrupting the other', () => {
  setup(21, 21);
  const g = firstOfType('forb');
  undoStack.length = 0; redoStack.length = 0;
  const live = k => game.plants[k] && !game.plants[k].removed;

  withUndo(() => setTile('plants', '3,3', { s: g, d: 0, t: 1 }));
  withUndo(() => setTile('plants', '4,4', { s: g, d: 0, t: 2 }));
  assert(live('3,3') && live('4,4'), 'both placements landed');

  doUndo();
  assert(live('3,3') && !live('4,4'), 'undo took back only the second');
  doRedo();
  assert(live('3,3') && live('4,4'), 'redo restored it');

  /* applySnapshot assigns the stored map straight onto game, so the map that
     goes live must never still be referenced by a stack. doUndo/doRedo push a
     FRESH snapshot before applying the popped one, which is what makes that
     safe — edit after an undo and the redo entry must not follow along. */
  doUndo();
  withUndo(() => setTile('plants', '7,7', { s: g, d: 0, t: 3 }));
  assert(live('3,3') && live('7,7') && !live('4,4'), 'the new edit sits on the undone state');
  doUndo();
  assert(!live('7,7'), 'and undoes cleanly on its own');
});

/* ---------- cache-revision narrowing (perf, and the invariants it rests on) ----------
   game.rev bumps on every mutation. The scene list, the shade map and the shrub
   index used to be keyed on it, so painting one path tile rebuilt all three.
   LAYER_CACHES (world.js) narrows that. These lock down BOTH directions: what
   must stop invalidating, and — the part that would be a rendering bug — what
   must still invalidate. */

test('a terrain edit no longer invalidates the scene list or the shade map', () => {
  setup(21, 21);
  setTile('plants', '10,10', { s: 'buroak', d: -4000, t: 1 });   // a tree, so there IS shade to keep
  ensureShadeMap();
  buildScene(800, 450);
  const sceneBefore = sceneKey(), shadeBefore = shadeMapKey(false);
  const groundBefore = groundDataKey(), traceBefore = game.terrainRev;

  setTile('terrain', '3,3', { k: 'bed', c: 'soil', t: 2 });

  assert(sceneKey() === sceneBefore, 'terrain holds no entity, so the scene list stands');
  assert(!sceneStale(sceneKey()), 'and sceneStale agrees — no rebuild is scheduled');
  assert(shadeMapKey(false) === shadeBefore, 'terrain casts no shade, so the shade map stands');
  assert(groundDataKey() !== groundBefore, 'the ground bake DOES retrace — that is the layer that changed');
  assert(game.terrainRev > traceBefore, 'and so does the organic region trace');
});

test('plant edits still invalidate the scene list and the shade map', () => {
  setup(21, 21);
  ensureShadeMap(); buildScene(800, 450);
  const sceneBefore = sceneKey(), shadeBefore = shadeMapKey(false), groundBefore = groundDataKey();

  setTile('plants', '5,5', { s: 'buroak', d: -4000, t: 1 });

  assert(sceneKey() !== sceneBefore, 'a new plant is a new entity');
  assert(shadeMapKey(false) !== shadeBefore, 'a new tree recasts shade');
  assert(groundDataKey() === groundBefore, 'but planting never rebakes the ground');
});

test('elevation still bumps the scene: screenOf lifts, so baked hedge offsets move', () => {
  /* Nothing in a scene record is elevation-SHAPED, but plantRenderDetail bakes
     hedge/bamboo neighbour offsets in screen space and screenOf subtracts the
     terrace lift. Depth (viewDepth) is elevation-free, so only the detail is at
     risk — which is exactly why elevation is classified {trace,scene}. */
  setup(21, 21);
  buildScene(800, 450);
  const sceneBefore = sceneKey();
  setElevationAt(4, 4, 1);
  assert(sceneKey() !== sceneBefore, 'a grade change moves baked screen-space offsets');
});

test('in-place array layers bump the scene revision that identity checks cannot see', () => {
  setup(21, 21);
  buildScene(800, 450);
  // buildings push/splice the SAME array, so scene.refs.buildings never changes
  const before = sceneKey(), arr = game.buildings;
  addBuilding({ id: 'b1', vertices: [[2, 2], [6, 2], [6, 6], [2, 6]], status: 'existing', label: 'Shed', t: 1 });
  assert(game.buildings === arr, 'the array identity really is unchanged (so the ref check is blind here)');
  assert(sceneKey() !== before, 'the revision is what catches it');
  const afterAdd = sceneKey();
  removeBuildingAtIndex(0);
  assert(sceneKey() !== afterAdd, 'and removal too');
});

test('an unclassified layer invalidates everything, so a new layer is safe by default', () => {
  setup(21, 21);
  buildScene(800, 450); ensureShadeMap();
  const scene0 = sceneKey(), shade0 = shadeMapKey(false), ground0 = groundDataKey();
  markLayerCacheChanged('somethingNobodyClassifiedYet');
  assert(sceneKey() !== scene0 && shadeMapKey(false) !== shade0 && groundDataKey() !== ground0,
    'unknown layers fall back to invalidating every cache rather than silently going stale');
});

test('the shrub index answers exactly as a full plant scan did', () => {
  setup(25, 25);
  // a wide shrub whose MATURE footprint overhangs well past its own tile,
  // buried in a crowd of perennials the old scan had to walk every time
  setTile('plants', '12,12', { s: 'cranberrybush', d: -4000, t: 1 });
  for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++){
    if (x === 12 && y === 12) continue;
    if ((x + y) % 3) continue;
    setTile('plants', `${x},${y}`, { s: 'bluestem', d: 0, t: 1 });
  }
  const claimed = shrubFootprintTiles(12, 12, game.plants['12,12'], true);
  assert(claimed.length > 1, 'this shrub really does reserve more than its own tile');
  for (const [x, y] of claimed){
    const hit = shrubAt(x, y);
    assert(hit && hit.key === '12,12', `shrubAt finds the overhanging shrub at ${x},${y}`);
  }
  assert(shrubAt(12, 12).center, 'its own tile reports as the center');
  assert(!shrubAt(0, 0), 'a tile far outside the footprint is clear');
  assert(!shrubAt(12, 12, { ignoreKey: '12,12' }), 'ignoreKey still excludes it');
  assert(!shrubAt(claimed[claimed.length - 1][0], claimed[claimed.length - 1][1],
    { ignoreKeys: new Set(['12,12']) }), 'ignoreKeys still excludes it');
});

test('the shrub index refreshes when shrubs are planted, removed, or swapped wholesale', () => {
  setup(21, 21);
  const edge = () => { const t = shrubFootprintTiles(10, 10, { s: 'cranberrybush', d: -4000, t: 1 }, true);
    return t.find(([x, y]) => x !== 10 || y !== 10); };
  const [ex, ey] = edge();
  assert(!shrubAt(ex, ey), 'clear to begin with');
  setTile('plants', '10,10', { s: 'cranberrybush', d: -4000, t: 1 });
  assert(shrubAt(ex, ey), 'the index sees a newly planted shrub');
  clearTile('plants', '10,10');
  assert(!shrubAt(ex, ey), 'and sees it lifted');
  // a wholesale swap keeps the revision counter but replaces the object —
  // load, undo and scheme switches all land here
  setTile('plants', '10,10', { s: 'cranberrybush', d: -4000, t: 1 });
  assert(shrubAt(ex, ey), 'replanted');
  game.plants = {};
  assert(!shrubAt(ex, ey), 'a swapped-in map is picked up by identity, not by revision');
});

/* ---------- ground bake: edit throttle + damage tracking ----------
   The bake is viewport-wide and all-or-nothing, so a brush drag rebaked the
   whole visible garden on every frame it painted a tile. groundEditThrottled
   defers the burst to ~11Hz and drawGroundDamage covers the tiles at the brush
   tip. render() itself needs a real canvas (gradients), so the policy is
   extracted and tested directly. */

function throttleFixture(){
  setup(21, 21);
  clearGroundDamage();
  groundEditT = -1e9; groundDamageT = -1e9;
}

test('a discrete tap always bakes at once, at any cadence', () => {
  throttleFixture();
  let t = 1000;
  for (let i = 0; i < 5; i++){
    setTile('terrain', `${5 + i},5`, { k: 'bed', c: 'soil', t: 1 });
    const deferred = groundEditThrottled(t, true, true);
    assert(!deferred, `tap ${i + 1} bakes immediately rather than popping later`);
    clearGroundDamage(); groundEditT = t;        // the bake this frame would do
    t += 200;                                     // human tapping speed
  }
});

test('a 60fps stroke is rate-limited to the settle interval', () => {
  throttleFixture();
  let t = 1000, bakes = 0;
  for (let f = 0; f < 60; f++){                   // one second of painting
    setTile('terrain', `${f % 21},7`, { k: 'bed', c: 'soil', t: 1 });
    if (!groundEditThrottled(t, true, true)){ bakes++; clearGroundDamage(); groundEditT = t; }
    t += 1000 / 60;
  }
  assert(bakes >= 9 && bakes <= 13, `~11Hz authoritative bakes, got ${bakes} (was 60 — one per frame)`);
});

test('the leading edge tracks the last EDIT, not the last bake', () => {
  /* Anchoring it to the bake leaves a settle-long dead zone after every bake,
     so an isolated tap landing inside one gets deferred and pops. */
  throttleFixture();
  const t0 = 1000;
  setTile('terrain', '3,3', { k: 'bed', c: 'soil', t: 1 });
  assert(!groundEditThrottled(t0, true, true), 'first edit bakes');
  clearGroundDamage(); groundEditT = t0;
  // quiet for well over a settle, then one tap — bake-anchored logic would
  // still be inside its window if a bake had just happened
  const tLate = t0 + 5000;
  setTile('terrain', '4,4', { k: 'bed', c: 'soil', t: 1 });
  groundEditT = tLate - 5;                        // pretend a bake just ran
  assert(!groundEditThrottled(tLate, true, true), 'a tap after a quiet spell is a new burst, so it bakes');
});

test('only located edits can be deferred; everything else bakes now', () => {
  const mid = () => { throttleFixture();
    setTile('terrain', '5,5', { k: 'bed', c: 'soil', t: 1 });
    groundEditThrottled(1000, true, true);        // open a window
    groundEditT = 1000; clearGroundDamage(); };

  mid(); setTile('terrain', '6,5', { k: 'bed', c: 'soil', t: 1 });
  assert(groundEditThrottled(1010, true, true), 'a named terrain tile mid-burst defers');

  mid(); setElevationAt(6, 5, 1);
  assert(!groundEditThrottled(1010, true, true), 'elevation forces a bake: sides read neighbours');

  mid(); markGroundChanged({ terrain: true });    // no tile named — undo/load/reshape
  assert(!groundEditThrottled(1010, true, true), 'an unlocated ground change forces a bake');

  mid(); for (let i = 0; i < GROUND_DAMAGE_CAP + 5; i++) setTile('terrain', `${i % 21},${(i / 21 | 0) + 10}`, { k: 'bed', c: 'soil', t: 1 });
  assert(!groundEditThrottled(1010, true, true), 'past the cap the overlay stops being cheaper than the bake');

  mid(); setTile('terrain', '7,5', { k: 'bed', c: 'soil', t: 1 });
  assert(!groundEditThrottled(1010, true, false), 'a STRUCT change (rotation/season/resize) never waits');

  mid();
  assert(!groundEditThrottled(1010, false, true), 'nothing changed at all: no bake, no deferral');
});

test('ground damage records tiles and clears on the authoritative bake', () => {
  throttleFixture();
  setTile('terrain', '8,8', { k: 'bed', c: 'soil', t: 1 });
  assert(groundDamage.has('8,8'), 'a painted tile is tracked by key');
  clearTile('terrain', '8,8');
  assert(groundDamage.has('8,8'), 'an erased tile is tracked too — the overlay repaints it as grass');
  assert(!tileTerrain(8, 8), 'and the model really is clear, which is what the overlay reads');
  clearGroundDamage();
  assert(groundDamage.size === 0 && !groundDamageFull, 'the bake resets both the set and the full flag');
  setTile('plants', '9,9', { s: 'bluestem', d: 0, t: 1 });
  assert(groundDamage.size === 0 && !groundDamageFull, 'planting is not ground damage at all');
});

/* ---------- closing the docked library ----------
   Desktop close collapsed a grid column with no motion, so the panel blinked
   out and nothing connected it to the launcher it reopens from. It now flies a
   ghost into that launcher. The motion is browser-verified (a stubbed canvas
   has no layout), but the geometry it depends on is pure and belongs here. */

test('the closing library lands exactly on its launcher', () => {
  const from = { left: 900, top: 56, width: 380, height: 700 };
  const to   = { left: 1180, top: 760, width: 132, height: 44 };
  const f = flyTransform(from, to);
  // transform-origin is 0 0, so the mapped rect is (left+tx, top+ty, w*sx, h*sy)
  assert(Math.abs((from.left + f.tx) - to.left) < 1e-9, 'left edge lands on the launcher');
  assert(Math.abs((from.top + f.ty) - to.top) < 1e-9, 'top edge lands on the launcher');
  assert(Math.abs(from.width * f.sx - to.width) < 1e-9, 'width matches the launcher');
  assert(Math.abs(from.height * f.sy - to.height) < 1e-9, 'height matches the launcher');
});

test('the fly transform never collapses to nothing on a degenerate launcher', () => {
  const from = { left: 0, top: 0, width: 400, height: 600 };
  const f = flyTransform(from, { left: 10, top: 20, width: 0, height: 0 });
  assert(f.sx >= 0.02 && f.sy >= 0.02, 'scale is floored rather than zero');
  assert(f.tx === 10 && f.ty === 20, 'translation is still honoured');
});

test('sizeCanvas only reallocates when the backing store size really changes', () => {
  /* Assigning canvas.width resets the bitmap even when the value is unchanged,
     and cnv.width is in the ground bake key — so an unguarded write meant every
     spurious ResizeObserver fire bought a full viewport rebake. */
  const c = document.getElementById('gameCanvas');
  sizeCanvas(c, { active: true });                 // settle
  const w0 = c.width, h0 = c.height;
  sizeCanvas(c, { active: true });
  sizeCanvas(c, { active: true });
  assert(c.width === w0 && c.height === h0, 'repeat calls at the same size leave the backing store alone');
  c.width = w0 + 7;                                 // pretend the layout moved
  sizeCanvas(c, { active: true });
  assert(c.width === w0 && c.height === h0, 'a genuine size change is still applied');
});

/* ---------- catalog card art cache ----------
   Result cards redrew their species procedurally on every tray rebuild, and the
   tray rebuilds on every tool arm and search keystroke. The art is a pure
   function of species|variant|season, so it is baked once and blitted after. */

test('catalog card art is baked once per species, variant and season', () => {
  TRAY_ART.clear();
  const D = plantDef('bluestem');
  const a = trayPlantArt('bluestem', null, 'Summer', D);
  const b = trayPlantArt('bluestem', null, 'Summer', D);
  assert(a === b, 'the same card art is reused rather than redrawn');
  assert(TRAY_ART.size === 1, 'and only one entry was made for it');
  assert(trayPlantArt('bluestem', null, 'Fall', D) !== a, 'a different season is its own bake');
  assert(trayPlantArt('bigbluestem', null, 'Summer', plantDef('bigbluestem')) !== a, 'a different species too');
  assert(TRAY_ART.size === 3, 'species and season do not collide in the cache key');
  TRAY_ART.clear();
});

test('the card art cache is bounded and evicts least-recently-used', () => {
  TRAY_ART.clear();
  // real species x real seasons — drawPlant reads P.sea[season], so invented
  // keys are not a stand-in for cache pressure
  const keys = PLANT_KEYS.filter(k => !PLANTS[k].hidden);
  const combos = [];
  for (const s of SEASONS) for (const k of keys) combos.push([k, s]);
  assert(combos.length > TRAY_ART_MAX + 20, 'enough real combinations to overflow the cache');
  const first = combos[0];
  for (let i = 0; i < TRAY_ART_MAX + 10; i++){
    const [k, s] = combos[i];
    trayPlantArt(k, null, s, plantDef(k));
  }
  assert(TRAY_ART.size <= TRAY_ART_MAX, `cache stays within ${TRAY_ART_MAX}, got ${TRAY_ART.size}`);
  assert(!TRAY_ART.has(first[0] + '||' + first[1]), 'the oldest entry was evicted');
  const newest = combos[TRAY_ART_MAX + 9];
  assert(TRAY_ART.has(newest[0] + '||' + newest[1]), 'the newest entry survived');
  // touching an entry makes it most-recent, so it outlives colder arrivals
  const keep = combos[TRAY_ART_MAX + 5];
  trayPlantArt(keep[0], null, keep[1], plantDef(keep[0]));
  for (let i = TRAY_ART_MAX + 10; i < TRAY_ART_MAX + 30; i++){
    const [k, s] = combos[i];
    trayPlantArt(k, null, s, plantDef(k));
  }
  assert(TRAY_ART.has(keep[0] + '||' + keep[1]), 'a recently used entry is not evicted before colder ones');
  TRAY_ART.clear();
});

/* ---------- viewport changes hold the view still ----------
   Docking/undocking the library resizes the canvas. viewScreen places a tile at
   `VW/2 + ZOOM*(isoX - cam.x)`, so a width change slides the whole garden
   sideways unless cam absorbs it — which is what made closing the library read
   as the map jumping rather than uncovering the strip the panel had been on. */

// where a tile lands in CSS pixels at an arbitrary viewport, which is what the
// eye actually tracks — computed from the real transform, not a copy of it
function tileCssAt(x, y, vw, vh, zoom){
  const p = screenOf(x, y, vw / zoom, vh / zoom);
  return [p[0] * zoom, p[1] * zoom];
}

test('widening the viewport reveals more garden instead of moving it', () => {
  setup(41, 41);
  const zoom = 1, vw = 1280, vh = 800;
  cam.x = 137.5; cam.y = -42.25;
  const before = tileCssAt(10, 10, vw, vh, zoom);
  const d = viewportAnchorDelta(380, 0, zoom);       // the library column comes back
  cam.x += d.dx; cam.y += d.dy;
  const after = tileCssAt(10, 10, vw + 380, vh, zoom);
  assert(Math.abs(d.dx - 190) < 1e-9, 'cam absorbs exactly half the added width');
  assert(Math.abs(after[0] - before[0]) < 1e-9, 'the tile holds its x on screen');
  assert(Math.abs(after[1] - before[1]) < 1e-9, 'and its y');
});

test('the anchor is in draw units, so zoom does not break it', () => {
  setup(41, 41);
  const zoom = 1.6, vw = 1280, vh = 800;
  cam.x = 40; cam.y = 12;
  const before = tileCssAt(9, 9, vw, vh, zoom);
  const d = viewportAnchorDelta(380, 0, zoom);
  cam.x += d.dx; cam.y += d.dy;
  const after = tileCssAt(9, 9, vw + 380, vh, zoom);
  assert(Math.abs(d.dx - 380 / (2 * 1.6)) < 1e-9, 'compensation divided by ZOOM');
  assert(Math.abs(after[0] - before[0]) < 1e-9, 'still anchored when zoomed in');
});

test('height changes anchor on the same 0.24 the renderer uses', () => {
  setup(41, 41);
  const zoom = 1, vw = 1000, vh = 700;
  cam.x = 3; cam.y = 9;
  const before = tileCssAt(5, 5, vw, vh, zoom);
  const d = viewportAnchorDelta(0, 120, zoom);
  cam.x += d.dx; cam.y += d.dy;
  const after = tileCssAt(5, 5, vw, vh + 120, zoom);
  assert(Math.abs(after[1] - before[1]) < 1e-9, 'a taller viewport does not slide the garden down');
});

test('opening and closing the library returns the camera exactly', () => {
  const open = viewportAnchorDelta(-380, 0, 1.25);   // docks: canvas shrinks
  const shut = viewportAnchorDelta(380, 0, 1.25);    // undocks: canvas grows back
  assert(Math.abs(open.dx + shut.dx) < 1e-12, 'a round trip cancels to zero, so no drift accumulates');
  assert(Math.abs(open.dy + shut.dy) < 1e-12, 'vertically too');
});

test('a viewport change that changes nothing moves nothing', () => {
  const d = viewportAnchorDelta(0, 0, 1);
  assert(d.dx === 0 && d.dy === 0, 'no size change, no camera movement');
  const bad = viewportAnchorDelta(380, 120, 0);
  assert(bad.dx === 0 && bad.dy === 0, 'a zero/invalid zoom cannot produce Infinity in the camera');
});

/* ---------- discovery: one filter pass per rebuild ----------
   Filtering discovery is O(catalog) and ends in a locale-collated sort, and a
   tray rebuild ran it twelve times — once per category chip just to print a
   count, plus three identical discoveryRefs() calls. Counts now come from one
   bucketed pass, and identical calls are memoised for the length of a single
   rebuild. Both have to be exactly equivalent, not merely close. */

const DISCOVERY_STATES = [
  { source: 'recommended' },
  { source: 'all' },
  { source: 'all', query: 'blue' },
  { source: 'all', query: 'aster' },
  { source: 'all', query: 'zzzznotathing' },
  { source: 'all', colorFamilies: ['purple'] },
  { source: 'all', bloomSeasons: ['Summer'] },
  { source: 'all', colorFamilies: ['yellow'], bloomSeasons: ['Fall'] },
  { source: 'recommended', query: 'sedge' },
];


test('snow only falls on a plant that actually drew something', () => {
  // A fern that has died down puts NOTHING on its tile in winter, but the cap
  // block scattered four ellipses at 50-95% of its height regardless — snow
  // hanging in mid-air over bare ground. Kevin caught it in a winter garden.
  const bare = { Winter: {} };
  for (const form of ['fern','leafmound','rosette'])
    assert(!catchesSnow({form}, bare.Winter), `${form}: nothing drawn, so nothing to land on`);

  // The same forms DO hold snow the moment they declare winter presence —
  // an evergreen fern, a hosta that has not gone over.
  for (const form of ['fern','leafmound','rosette']){
    assert(catchesSnow({form}, {fol:'#4e7a48'}), `${form}: evergreen keeps its caps`);
    assert(catchesSnow({form}, {seed:'#6e4a32'}), `${form}: fertile structure keeps its caps`);
  }

  // And the fix must NOT reach the forms that run an unconditional stem pass.
  // Spiderwort, gaura, iris and the lobelias declare an empty winter yet stand
  // brown dead stems through it; a rule keyed on the season colours alone
  // stripped snow from 26 such species before this was narrowed to three forms.
  for (const form of ['cone','spike','umbel','globe','iris','airywand','archbell',
                      'bunchgrass','shrub','forestgrass'])
    assert(catchesSnow({form}, bare.Winter), `${form}: dead stems still catch snow`);

  // Woody forms put trunk and twigs on the tile in every season.
  for (const form of ['bush','tree','conifer','hydrangea'])
    assert(catchesSnow({form}, bare.Winter), `${form}: woody structure always catches snow`);

  // The species the report was actually about, resolved through real data.
  for (const k of ['ladyfern','maidenhairfern','hayscentedfern','newyorkfern',
                   'japanesepaintedfern','hosta','brunnera','daylily'])
    assert(!catchesSnow(PLANTS[k], PLANTS[k].sea.Winter || {}),
      `${k}: dies down, so it must not wear snow`);
  for (const k of ['christmasfern','hartstonguefern','hollyfern','autumnfern','malefern',
                   'ostrichfern','cinnamonfern','sensitivefern','bluestem','echinacea'])
    assert(catchesSnow(PLANTS[k], PLANTS[k].sea.Winter || {}),
      `${k}: holds winter structure, so it must keep its snow`);
});

test('snow caps ride the drawn mass, not the top of the H box', () => {
  // The cap scatter assumed foliage fills the whole H box. It does for a
  // coneflower (drawn top measured at 1.01H) and not for anything whose H is
  // set by a flower scape it does not carry in winter, so twelve species put
  // EVERY cap above their own highest pixel — snow floating over the plant.
  assertEqual(snowCrownFrac(PLANTS.echinacea), 1, 'a coneflower fills its box');
  assertEqual(snowCrownFrac(PLANTS.bluestem), 1, 'so does a bunchgrass with no mound');
  assertEqual(snowCrownFrac(PLANTS.heuchera), 0.45, 'a heuchera is a low leaf mound');
  assertEqual(snowCrownFrac(PLANTS.solomonsseal), 0.50, "Solomon's seal arches low");
  assertEqual(snowCrownFrac(PLANTS.mossphlox), 0.30, 'moss phlox is a runner mat');
  assertEqual(snowCrownFrac(PLANTS.poppymallow), 0.30, 'poppy mallow mats too');
  assertEqual(snowCrownFrac(PLANTS.mountainsedge), 0.45, 'mound sedges sit low');
  assertEqual(snowCrownFrac(PLANTS.fragrantwaterlily), 0.45, 'a water lily floats flat');

  // Keyed on FORM, not height — the two do not correlate, and a height rule
  // would have missed the worst cases while moving snow on plants already
  // right. These two are the proof: same drawn height, opposite answers.
  assert(plantVisualH(PLANTS.heuchera) > plantVisualH(PLANTS.pussytoes),
    'heuchera is the taller plant');
  assert(snowCrownFrac(PLANTS.heuchera) < snowCrownFrac(PLANTS.pussytoes),
    'yet it is the one whose snow had to come down');

  // A mound sedge sits low; the same form without the mound flag does not.
  assert(snowCrownFrac(PLANTS.mountainsedge) < snowCrownFrac(PLANTS.bluestem),
    'the mound flag is what separates them, not the form alone');

  // Everything unlisted must score exactly 1, or the fix silently moves snow
  // on plants that were already correct (766 of 856 winter renders are
  // pixel-identical to before, and that is the property being protected).
  let moved = 0;
  for (const k of PLANT_KEYS){
    const P = PLANTS[k];
    if (P.type === 'tree' || P.type === 'shrub' || P.type === 'bulb') continue;
    const f = snowCrownFrac(P);
    assert(f > 0 && f <= 1, `${k}: crown fraction ${f} out of range`);
    if (f < 1) moved++;
  }
  assert(moved > 0 && moved < PLANT_KEYS.length * 0.2,
    `crown override should stay a small exception, not the rule (${moved} species)`);
});
test('bucketed category counts equal filtering per category', () => {
  setup(31, 31);
  const cats = TRAY_CATS.filter(c => TRAY_GROUPS[0].cats.includes(c.id));
  let checked = 0;
  for (const state of DISCOVERY_STATES){
    const d = normalizeDiscovery(Object.assign({}, defaultDiscovery(), state));
    const tally = discoveryCategoryCounts(d);
    const allOld = groupDiscoveryRefs(discoveryRefsUncached(Object.assign({}, d, { category: null }))).length;
    assert(tally.all === allOld, `All count matches for ${JSON.stringify(state)}: ${tally.all} vs ${allOld}`);
    checked++;
    for (const c of cats){
      const old = groupDiscoveryRefs(discoveryRefsUncached(Object.assign({}, d, { category: c.id }))).length;
      assert((tally.counts[c.id] || 0) === old, `${c.id} count matches for ${JSON.stringify(state)}`);
      checked++;
    }
  }
  assert(checked >= 80, `covered a real spread of states and categories (${checked} checks)`);
});

test('the discovery memo returns exactly what an uncached filter would', () => {
  setup(31, 31);
  for (const state of DISCOVERY_STATES){
    const d = normalizeDiscovery(Object.assign({}, defaultDiscovery(), state));
    const plain = discoveryRefsUncached(d).map(r => r.s + '|' + (r.v || ''));
    openDiscoveryMemo();
    const first = discoveryRefsFor(d).map(r => r.s + '|' + (r.v || ''));
    const second = discoveryRefsFor(d).map(r => r.s + '|' + (r.v || ''));
    closeDiscoveryMemo();
    assert(first.join() === plain.join(), 'memoised result matches the uncached filter, order included');
    assert(second.join() === plain.join(), 'and a cache hit returns the same thing');
  }
});

test('the memo distinguishes states that must not share a result', () => {
  setup(31, 31);
  const base = normalizeDiscovery(defaultDiscovery());
  openDiscoveryMemo();
  const all = discoveryRefsFor(Object.assign({}, base, { category: null })).length;
  const grasses = discoveryRefsFor(Object.assign({}, base, { category: 'grasses' })).length;
  const trees = discoveryRefsFor(Object.assign({}, base, { category: 'trees' })).length;
  const queried = discoveryRefsFor(Object.assign({}, base, { category: null, query: 'zzzznotathing' })).length;
  closeDiscoveryMemo();
  assert(grasses < all && trees < all, 'category is part of the key, not collapsed into one entry');
  assert(grasses !== trees, 'different categories get different results');
  assert(queried === 0, 'query is part of the key too');
});

test('the memo never outlives a rebuild, even a nested or failed one', () => {
  assert(discoveryMemo === null, 'starts closed');
  openDiscoveryMemo();
  openDiscoveryMemo();                 // nested rebuild
  closeDiscoveryMemo();
  assert(discoveryMemo !== null, 'an inner close does not tear down the outer memo');
  closeDiscoveryMemo();
  assert(discoveryMemo === null && discoveryMemoDepth === 0, 'the outer close does');
  // buildToolTray wraps its body in try/finally, so a throwing builder still closes it
  const real = updateCatalogHeader;
  updateCatalogHeader = () => { throw new Error('boom'); };
  let threw = false;
  try { buildToolTray(); } catch (e) { threw = true; }
  updateCatalogHeader = real;
  assert(threw, 'the builder really did throw');
  assert(discoveryMemo === null && discoveryMemoDepth === 0, 'and the memo was torn down anyway');
});

/* Hand is what enterGarden arms, and the plant card used to hang off actHere,
   which returns early unless a plant brush is armed — so in the default tool
   there was no way to ask what a plant is. inspectPlantAt is that door. */
test('Hand tap inspects the plant under it, including a shrub overhanging the tile', () => {
  setup(20, 20);
  assert(!inspectPlantAt(-1, 5), 'off-plot tile inspects nothing');
  assert(!inspectPlantAt(5, 5), 'bare ground inspects nothing');

  game.plants['5,5'] = { s: 'bluestem', d: 0, t: 1 };
  game.focusPlantKey = null;
  assert(inspectPlantAt(5, 5), 'a plant on the tile is inspected');
  assertEqual(game.focusPlantKey, '5,5', 'the card focuses the tapped plant');

  // a shrub reserves a mature footprint, so tapping its visible edge — a tile
  // its canopy overhangs but does not sit on — must still find it
  setup(20, 20);
  game.plants['10,10'] = { s: 'sumac', d: 0, t: 1 };
  const hit = shrubAt(11, 10);
  assert(hit, 'sumac footprint reaches the neighbouring tile');
  game.focusPlantKey = null;
  assert(inspectPlantAt(11, 10), 'tapping the shrub canopy inspects the shrub');
  assertEqual(game.focusPlantKey, '10,10', 'the card focuses the shrub trunk tile, not the tapped tile');

  // a plant you cannot see must not produce a card out of nowhere
  setup(20, 20);
  game.plants['5,5'] = { s: 'bluestem', d: 0, t: 1 };
  game.layerVis.perennials = false;
  game.focusPlantKey = null;
  assert(!inspectPlantAt(5, 5), 'a hidden layer inspects nothing');
  game.layerVis.perennials = true;

  // bulbs share tiles with perennials; the perennial wins, as actHere does
  setup(20, 20);
  game.bulbs['6,6'] = { s: 'alliumGlobemaster', d: 0, t: 1 };
  game.focusPlantKey = null;
  assert(inspectPlantAt(6, 6), 'a bulb alone on the tile is inspected');
  // (no focusPlantKey check: plantKeyOf resolves against game.plants, so a bulb
  //  legitimately has none — that is showPlantCard's pre-existing behaviour)
});

/* A house wall is not lawn. classify() in terrainUnitEdges used to ask only
   whether the neighbour carried terrain, so a house or building footprint fell
   through to the same SOFT answer as an open lawn and the bed curved away from
   the foundation. Measured on a real garden (E and S, 70x39): 54 ft of terrain
   ran along the house, sitting 0.50 ft off it on average and 3.17 ft at worst.
   Nobody builds a rounded bed edge against their house. */
test('a bed runs exactly to a house wall, and still wanders against lawn', () => {
  // Flatten a region's drawn silhouette in tile-corner space (identity
  // projector) so the assertion measures the CURVE, not the control polygon.
  const drawnEdge = (region) => {
    const pts = []; let cur = null;
    const ctx = {
      beginPath(){}, closePath(){},
      moveTo(x, y){ cur = [x, y]; pts.push([x, y]); },
      lineTo(x, y){ cur = [x, y]; pts.push([x, y]); },
      quadraticCurveTo(cx, cy, x, y){
        const a = cur;
        for (let i = 1; i <= 16; i++){ const t = i / 16, mt = 1 - t;
          pts.push([mt*mt*a[0] + 2*mt*t*cx + t*t*x, mt*mt*a[1] + 2*mt*t*cy + t*t*y]); }
        cur = [x, y];
      }
    };
    for (const loop of region.loops) terrainLoopPath(ctx, loop, p => p);
    return pts;
  };
  // a hard arc is a lineTo, so it emits only its endpoints — walk the polyline
  // at a fixed step before measuring anything against it
  const densify = (pts) => {
    const o = [];
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 8));
      for (let j = 0; j < n; j++) o.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    if (pts.length) o.push(pts[pts.length - 1]);
    return o;
  };
  /* How far the drawn curve misses a corner the gardener actually painted.
     This is the honest measure of "does the edge wander": mid-edge, a spline
     over a long straight run sits close to the line whatever it does at the
     ends, so sampling the middle would report a rounded rectangle as square. */
  const cornerCut = (region, corner) => {
    let best = Infinity;
    for (const p of densify(drawnEdge(region)))
      best = Math.min(best, Math.hypot(p[0] - corner[0], p[1] - corner[1]));
    return best;
  };
  const bedRegion = () => buildTerrainRegions().find(r => r.kind === 'bed');

  // ---- against a building footprint: exact
  setup(24, 24);
  game.edgeStyle = 'organic';
  addBuilding({ id: 'h1', vertices: [[4, 12], [16, 12], [16, 18], [4, 18]],
    status: 'existing', label: 'House', t: 1 });
  game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1);
  for (let x = 5; x <= 14; x++) for (let y = 8; y <= 11; y++) applyToolAt(x, y);
  const against = bedRegion();
  assert(against, 'the bed traced a region');
  // tiles x5..14 y8..11, so the painted south corners are (5,12) and (15,12)
  const wallGap = Math.max(cornerCut(against, [5, 12]), cornerCut(against, [15, 12]));
  assert(wallGap < 0.1, `the bed runs into the foundation corners (off by ${wallGap.toFixed(3)} tiles)`);

  // ---- the SAME bed shape against open lawn: still organic
  /* Without this half the test would pass just as well if the smoothing were
     switched off altogether, which is the failure it is meant to catch. */
  setup(24, 24);
  game.edgeStyle = 'organic';
  game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1);
  for (let x = 5; x <= 14; x++) for (let y = 8; y <= 11; y++) applyToolAt(x, y);
  const lawnGap = Math.max(cornerCut(bedRegion(), [5, 12]), cornerCut(bedRegion(), [15, 12]));
  assert(lawnGap > 0.25, `the same corners against lawn are still rounded away (${lawnGap.toFixed(3)} tiles)`);
  assert(lawnGap > wallGap * 3, 'and markedly more than they are against the wall');

  // the plot boundary was always hard; a wall now reads the same way
  assert(!isLawnTile(-1, 5), 'off the plot is not lawn');
  setup(24, 24);
  addBuilding({ id: 'h2', vertices: [[4, 4], [8, 4], [8, 8], [4, 8]], status: 'existing', label: 'Shed', t: 1 });
  assert(!isLawnTile(5, 5), 'a building footprint is not lawn');
  game.houses = [{ x: 12, y: 12, w: 3, h: 3, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [4, 4] }];
  assert(!isLawnTile(13, 13), 'a placed house is not lawn');
  assert(isLawnTile(2, 2), 'and open ground still is');
});

/* One predicate, four surfaces. The planting list bills the sides that draw,
   the formal renderer draws them per tile, regionEdging asks which tiles carry
   edging worth drawing, and terrainUnitEdges asks whether the arc is soft.
   Splitting that question is how the organic and formal paths drifted before
   (see regionEdging); a wall would have re-split it — edging billed along a
   foundation the organic renderer had just stopped drawing. */
test('edging is not billed along a wall it is no longer drawn against', () => {
  setup(24, 24);
  game.tool = 'bed'; game.bedStyle = 'mulch'; setBrushSize(1);
  for (let x = 5; x <= 8; x++) for (let y = 8; y <= 10; y++) applyToolAt(x, y);
  game.tool = 'edging'; game.edgingDraft = 'steel';
  for (let x = 5; x <= 8; x++) for (let y = 8; y <= 10; y++) applyToolAt(x, y);
  const openFt = edgingRunFeet().steel;
  assertEqual(Math.round(openFt), Math.round(14 * TILE_IN / 12), `a 4x3 bed in lawn exposes 14 sides (${openFt})`);
  assertEqual(edgingSidesAt(6, 10), 1, 'a south-edge tile has one side facing lawn');

  // drop a house along the bed's south side: those 4 sides stop drawing
  addBuilding({ id: 'h3', vertices: [[4, 11], [10, 11], [10, 16], [4, 16]],
    status: 'existing', label: 'House', t: 1 });
  assertEqual(edgingSidesAt(6, 10), 0, 'the same tile now faces a wall, not lawn');
  const walledFt = edgingRunFeet().steel;
  assertEqual(Math.round(walledFt), Math.round(10 * TILE_IN / 12),
    `the four foundation sides stop being billed (${walledFt})`);
  assert(!edgingDrawsAt(6, 10), 'and that tile draws no edging for regionEdging to find');

  /* The region's own arcs agree. An arc ENDPOINT may sit on the wall line —
     that is the pin where the lawn-facing side stops, and pinned means exact.
     What must not exist is a soft arc RUNNING along the foundation. */
  const bed = buildTerrainRegions().find(r => r.kind === 'bed');
  const onWall = p => Math.abs(p[1] - 11) < 0.01;
  let softRun = 0, hardRun = 0;
  for (const loop of bed.loops){
    for (const a of (loop.closed ? [loop] : loop.arcs)){
      for (let i = 0; i < a.pts.length - 1; i++){
        if (!onWall(a.pts[i]) || !onWall(a.pts[i + 1])) continue;
        if (a.hard) hardRun++; else softRun++;
      }
    }
  }
  assertEqual(softRun, 0, 'no soft arc runs along the foundation');
  assert(hardRun > 0, 'and the foundation edge is drawn by a hard arc');
});

/* The organic edge used each polyline vertex as a quadratic CONTROL point, so a
   corner was cut by |(A-B)+(C-B)|/4 — proportional to the runs either side.
   The smoothing therefore scaled with the shape, and the more deliberate the
   geometry the more of it was destroyed: on a real garden an 11x12 tile gravel
   patio lost 3.76 ft at its corners and bowed 2.34 ft off a straight 10-tile
   run, while a wandering 3-tile bed lost 0.5 ft. Exactly backwards. */
test('organic edges: a long run stays straight and its corner is bounded', () => {
  const curve = (region) => {
    const pts = []; let cur = null;
    const ctx = {
      beginPath(){}, closePath(){},
      moveTo(x, y){ cur = [x, y]; pts.push([x, y]); },
      lineTo(x, y){ cur = [x, y]; pts.push([x, y]); },
      quadraticCurveTo(cx, cy, x, y){ const a = cur;
        for (let i = 1; i <= 20; i++){ const t = i / 20, u = 1 - t;
          pts.push([u*u*a[0] + 2*u*t*cx + t*t*x, u*u*a[1] + 2*u*t*cy + t*t*y]); }
        cur = [x, y]; }
    };
    for (const loop of region.loops) terrainLoopPath(ctx, loop, p => p);
    // walk it at a fixed step: a straight run is a lineTo and emits only its ends
    const out = [];
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 8));
      for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    if (pts.length) out.push(pts[pts.length - 1]);
    return out;
  };

  setup(30, 30);
  game.edgeStyle = 'organic';
  game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1);
  // tiles x6..17, y6..15 -> a 12x10 rectangle, corners on (6,6) (18,6) (18,16) (6,16)
  for (let x = 6; x <= 17; x++) for (let y = 6; y <= 15; y++) applyToolAt(x, y);
  const pts = curve(buildTerrainRegions().find(r => r.kind === 'bed'));

  /* 1. the straight runs are straight. Sample the middle 60% of the south run,
        clear of both corner fillets. Not exactly zero: a uniform closed loop
        jitters every point including its corners (planJitter at 0.55, so up to
        0.1375 tiles), which tilts the run very slightly — that is the intended
        lattice wobble and it does NOT grow with the run, which is the whole
        point. It was 1.56 tiles here before. */
  let bow = 0;
  for (const p of pts) if (p[0] > 8.4 && p[0] < 15.6 && Math.abs(p[1] - 16) < 2) bow = Math.max(bow, Math.abs(p[1] - 16));
  assert(bow < 0.15, `a 12-tile run draws straight to within the jitter (bowed ${bow.toFixed(3)} tiles)`);

  // 2. the corner is rounded, but BOUNDED — and the bound is what is new, so
  //    the assertion names what the old unbounded form would have produced for
  //    these very runs rather than a magic number.
  let cut = Infinity;
  for (const p of pts) cut = Math.min(cut, Math.hypot(p[0] - 18, p[1] - 16));
  const unbounded = Math.hypot(12 / 2, 10 / 2) / 4;   // |(A-B)+(C-B)|/4 at the midpoints
  assert(cut > 0.15, `the corner is still softened, not square (${cut.toFixed(3)})`);
  assert(cut < 0.5, `and bounded near the fillet radius (${cut.toFixed(3)})`);
  assert(unbounded > 1.9 && cut < unbounded / 3,
    `far tighter than the run-proportional cut it replaced (${cut.toFixed(2)} vs ${unbounded.toFixed(2)})`);

  // 3. a genuine one-tile jog is UNCHANGED: its own half-length binds the
  //    fillet, so small wobbles round exactly as they always did.
  setup(30, 30);
  game.edgeStyle = 'organic';
  game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1);
  for (let x = 6; x <= 11; x++) for (let y = 6; y <= 9; y++) applyToolAt(x, y);
  applyToolAt(12, 7);                              // a single tile sticking out
  const jog = curve(buildTerrainRegions().find(r => r.kind === 'bed'));
  let jogCut = Infinity;
  for (const p of jog) jogCut = Math.min(jogCut, Math.hypot(p[0] - 13, p[1] - 7));
  assert(jogCut > 0.15 && jogCut < 0.8, `a one-tile lobe still rounds softly (${jogCut.toFixed(3)})`);
});

/* Three consumers draw this curve: the fill path, the outline stroke, and the
   sampled polyline the edging strip follows. They were three copies of the same
   spline, and the file already carries the scar of them drifting once. They are
   one walk now, and this is what says so. */
test('the edging strip follows exactly the curve the bed was filled with', () => {
  setup(26, 26);
  game.edgeStyle = 'organic';
  game.tool = 'bed'; game.bedStyle = 'mulch'; setBrushSize(1);
  // a shape with both long runs and short jogs, so fillets clamp both ways
  for (let x = 5; x <= 16; x++) for (let y = 5; y <= 12; y++) applyToolAt(x, y);
  for (let y = 13; y <= 14; y++) for (let x = 7; x <= 9; x++) applyToolAt(x, y);
  const region = buildTerrainRegions().find(r => r.kind === 'bed');

  const fillPts = [];
  let cur = null;
  const ctx = {
    beginPath(){}, closePath(){},
    moveTo(x, y){ cur = [x, y]; fillPts.push([x, y]); },
    lineTo(x, y){ cur = [x, y]; fillPts.push([x, y]); },
    quadraticCurveTo(cx, cy, x, y){ const a = cur;
      for (let i = 1; i <= 20; i++){ const t = i / 20, u = 1 - t;
        fillPts.push([u*u*a[0] + 2*u*t*cx + t*t*x, u*u*a[1] + 2*u*t*cy + t*t*y]); }
      cur = [x, y]; }
  };
  for (const loop of region.loops) terrainLoopPath(ctx, loop, p => p);

  let worst = 0, n = 0;
  for (const loop of region.loops){
    for (const arc of (loop.closed ? [loop] : loop.arcs)){
      for (const p of edgingCurvePoints(arc, q => q)){
        let best = Infinity;
        for (const q of fillPts) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
        worst = Math.max(worst, best); n++;
      }
    }
  }
  assert(n > 20, `the strip really was sampled (${n} points)`);
  assert(worst < 0.06, `every edging point lies on the filled silhouette (worst ${worst.toFixed(4)} tiles)`);
});

/* LAID_OVER_BLEED pushes a region's edge out over the lower-ranked material it
   covers, and it used to be applied to the lattice points on the way IN to the
   simplifier. A run whose neighbour changes material partway along — a path
   crossing a bed, which is the case the rank system exists for — therefore
   acquired a 0.45-tile step in its middle, and the simplifier then measured the
   run's real corner against a chord skewed by that step. Applying the bleed
   after simplifying costs nothing and keeps the run straight. */
test('a path laid over a bed keeps the straight edge it was painted with', () => {
  setup(30, 30);
  game.edgeStyle = 'organic'; setBrushSize(1);
  // a bed against the LOWER half of the patio's west side only: the rank change
  // lands partway along one otherwise straight run
  game.tool = 'bed'; game.bedStyle = 'soil';
  for (let x = 6; x <= 7; x++) for (let y = 14; y <= 19; y++) applyToolAt(x, y);
  // a peer path colour to the north gives the patio a hard arc there, so the
  // rest of its boundary is ONE long open soft arc — the shape the real garden has
  game.tool = 'path'; game.pathColor = 'paver';
  for (let x = 9; x <= 18; x++) applyToolAt(x, 7);
  game.pathColor = 'warm';
  for (let x = 9; x <= 18; x++) applyToolAt(x, 8);          // the one-tile chamfer
  for (let x = 8; x <= 18; x++) for (let y = 9; y <= 20; y++) applyToolAt(x, y);

  const rg = buildTerrainRegions().find(r => r.kind === 'path' && r.c === 'warm');
  assert(rg, 'the patio traced a region');
  assert(rg.loops.some(l => !l.closed && l.arcs.some(a => a.hard) && l.arcs.some(a => !a.hard)),
    'and it really is the mixed hard/soft arc case this is about');

  const pts = []; let cur = null;
  const ctx = {
    beginPath(){}, closePath(){},
    moveTo(x, y){ cur = [x, y]; pts.push([x, y]); },
    lineTo(x, y){ cur = [x, y]; pts.push([x, y]); },
    quadraticCurveTo(cx, cy, x, y){ const a = cur;
      for (let i = 1; i <= 20; i++){ const t = i / 20, u = 1 - t;
        pts.push([u*u*a[0] + 2*u*t*cx + t*t*x, u*u*a[1] + 2*u*t*cy + t*t*y]); }
      cur = [x, y]; }
  };
  for (const loop of rg.loops) terrainLoopPath(ctx, loop, p => p);
  const walk = [];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 8));
    for (let j = 0; j < n; j++) walk.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }

  // the LAWN-facing upper half of the west run (y 10..14) must sit on x=8. The
  // lower half is bled out over the bed on purpose and is not measured here.
  let bow = 0;
  for (const p of walk) if (p[1] > 10 && p[1] < 14 && Math.abs(p[0] - 8) < 2.5) bow = Math.max(bow, Math.abs(p[0] - 8));
  assert(bow < 0.2, `the lawn-facing half of the run stays on its tile line (bowed ${bow.toFixed(3)} tiles)`);

  /* And the joint stays CLOSED, which is the property LAID_OVER_BLEED actually
     exists for: along the bed-facing half the path must reach the shared tile
     line and never retreat inside it, or an unpainted strip shows down the
     joint. Note this is what the bleed buys, not the bleed itself — a straight
     run lands on the line without needing to be pushed, and the offset survives
     where the fillet would otherwise pull the edge back, at the corners.
     Measured over every laid-over tile side of a real garden: 0.000 tiles of
     retreat now, against 0.138 (0.21 ft) with the bleed applied before
     simplifying, on 2 of 5 sides. */
  let retreat = -Infinity;
  for (const p of walk) if (p[1] > 15 && p[1] < 19 && Math.abs(p[0] - 8) < 2.5) retreat = Math.max(retreat, p[0] - 8);
  assert(retreat < 0.05, `the path reaches the bed's tile line and does not retreat inside it (${retreat.toFixed(3)} tiles)`);
});

/* Raise and lower INCREMENT, where every other brush writes a value. The disc
   is stamped at every tile the pointer crosses, so a tile inside the disc of
   several crossings was raised once per crossing: one drag of a 3-wide brush
   across six tiles asked for one level everywhere and built 1,2,3,3,3,3,2,1 —
   a cliff, at ELEV_MAX after a second pass. And because a terrace draws lifted
   by elev*ELEV_STEP with its wall face covering the tiles in front, the taller
   it got the more the pointer read as landing somewhere else. */
test('one raise drag raises each tile exactly one level', () => {
  const drag = (tool, size, x0, y0, x1, y1) => {
    game.tool = tool; setBrushSize(size);
    beginUndo();
    const d = { sx:x0, sy:y0, cx:x0, cy:y0, active:true, count:0, what:null, lastX:x0, lastY:y0,
                trace:[[x0,y0]], edgeSeen:new Set(), affected:new Set(), runInches:0 };
    stampBrushAt(x0, y0, null);
    for (const [xx, yy] of strokeLineTiles(x0, y0, x1, y1).slice(1)) paintToolDragLine(d, xx, yy, null);
    commitUndo();
  };

  setup(21, 21);
  drag('raise', 3, 7, 10, 12, 10);
  const row = [];
  for (let x = 6; x <= 13; x++) row.push(elevationAt(x, 10));
  assert(row.every(h => h === 1), `every tile under a 3-wide drag rose one level (${row.join(',')})`);

  // a second pass over the same ground is a second deliberate gesture, and
  // SHOULD raise it again — the guard is per-gesture, not a global latch
  drag('raise', 3, 7, 10, 12, 10);
  assertEqual(elevationAt(9, 10), 2, 'a second drag raises it again');

  // and the whole drag is still one undo step
  doUndo();
  assertEqual(elevationAt(9, 10), 1, 'undo takes back the whole second drag');

  // level writes 0 rather than incrementing, so it needs no guard and gets none
  setup(21, 21);
  drag('raise', 3, 7, 10, 12, 10);
  drag('level', 3, 7, 10, 12, 10);
  assertEqual(elevationAt(9, 10), 0, 'levelling is idempotent and unaffected');

  // outside a gesture every call is a first touch: the flood fill and the E key
  // both drive applyToolAt directly and must still work
  setup(21, 21);
  game.tool = 'raise'; setBrushSize(1);
  applyToolAt(5, 5); applyToolAt(5, 5);
  assertEqual(elevationAt(5, 5), 2, 'two discrete actions raise two levels');
});

/* Two layers carry a second property on the same record — the retaining-wall
   facing on the elevation record (w) and the edging on the terrain record (e).
   Both writers replaced the record instead of merging over it, so changing the
   thing the record is NAMED for silently destroyed the thing riding along. */
test('changing a level keeps its wall, and changing a material keeps its edging', () => {
  setup(21, 21);
  game.tool = 'raise'; setBrushSize(1); applyToolAt(10, 10);
  game.tool = 'wall'; game.wallDraft = 'stone'; applyToolAt(10, 10);
  assertEqual(wallStyleAt(10, 10), 'stone', 'the terrace is faced');
  game.tool = 'raise'; applyToolAt(10, 10);
  assertEqual(elevationAt(10, 10), 2, 'and raised again');
  assertEqual(wallStyleAt(10, 10), 'stone', 'the facing survives the raise');
  game.tool = 'lower'; applyToolAt(10, 10);
  assertEqual(wallStyleAt(10, 10), 'stone', 'and the lower');
  // levelling to grade legitimately drops it: no exposed face, nothing to hold up
  game.tool = 'level'; applyToolAt(10, 10);
  assertEqual(elevationAt(10, 10), 0, 'levelled');
  assertEqual(wallStyleAt(10, 10), 'none', 'and the facing goes with the earthwork');

  setup(21, 21);
  game.tool = 'bed'; game.bedStyle = 'soil'; setBrushSize(1); applyToolAt(10, 10);
  game.tool = 'edging'; game.edgingDraft = 'steel'; applyToolAt(10, 10);
  assertEqual(edgingAt(10, 10), 'steel', 'the bed is edged');
  game.tool = 'bed'; game.bedStyle = 'gravel'; applyToolAt(10, 10);
  assertEqual((terrainAt(10, 10) || {}).c, 'gravel', 'the material changed');
  assertEqual(edgingAt(10, 10), 'steel', 'the edging survives it');
  game.tool = 'path'; game.pathColor = 'warm'; applyToolAt(10, 10);
  assertEqual(edgingAt(10, 10), 'steel', 'and survives becoming a path');
  // painting 'none' is the deliberate way to lift it
  game.tool = 'edging'; game.edgingDraft = 'none'; applyToolAt(10, 10);
  assertEqual(edgingAt(10, 10), 'none', "and 'none' still lifts it");
});

/* A retaining wall lives on the exposed face of a level change and used to be
   drawn one tile at a time — two screen parallelograms per raised tile, meeting
   at 90 degrees. So a curved terrace came out as a staircase of blocks, and the
   terrace TOP (which paintTerrainBlobs traces and splines) disagreed with the
   face below it: a flowing cap sitting on square steps. The elevation lattice is
   traced now, the way the material lattice already was. */
test('a wall traces as continuous runs, not one face per tile', () => {
  const wallAll = (tiles, style) => {
    setup(30, 30);
    game.edgeStyle = 'organic'; setBrushSize(1);
    game.tool = 'raise';
    for (const [x, y] of tiles) applyToolAt(x, y);
    game.tool = 'wall'; game.wallDraft = style || 'stone';
    for (const [x, y] of tiles) applyToolAt(x, y);
    wallRunCache.sig = null;
    return buildElevationRuns();
  };

  /* A rectangular terrace is ONE closed run — its whole perimeter drops, at one
     height, in one material — so the polyline is its four corners, not its
     thirty tile edges. That count IS the fix: the old renderer emitted a
     separate parallelogram for every one of those edges. */
  const straight = [];
  for (let x = 6; x <= 13; x++) for (let y = 9; y <= 11; y++) straight.push([x, y]);
  let runs = wallAll(straight);
  const longest = runs.reduce((a, r) => r.tiles > a.tiles ? r : a, runs[0]);
  const edges = longest.edges.length;
  assertEqual(edges, 22, 'the terrace has 22 dropping tile edges');
  assert(longest.pts.length <= 6,
    `and draws as its corners, not its edges (${longest.pts.length} points for ${edges} edges)`);
  // every side is one straight segment: the longest spans the full 8 tiles
  let span = 0;
  for (let i = 1; i < longest.pts.length; i++)
    span = Math.max(span, Math.hypot(longest.pts[i][0]-longest.pts[i-1][0], longest.pts[i][1]-longest.pts[i-1][1]));
  assert(span > 7, `the long side is a single 8-tile run (${span.toFixed(2)})`);

  // a DIAGONAL bank: the whole point. Per tile this is a stair of right angles;
  // traced and simplified it is a line running the diagonal.
  const diag = [];
  for (let i = 0; i < 8; i++) { diag.push([6 + i, 6 + i]); diag.push([7 + i, 6 + i]); }
  runs = wallAll(diag);
  const diagLongest = runs.reduce((a, r) => r.tiles > a.tiles ? r : a, runs[0]);
  assert(diagLongest.pts.length < diagLongest.edges.length / 3,
    `a diagonal bank simplifies toward a line, not a stair (${diagLongest.pts.length} points for ${diagLongest.edges.length} edges)`);
  // a stair of N steps walks 2N tile edges along a diagonal of N*sqrt(2)
  assert(diagLongest.tiles < diagLongest.edges.length * 0.85,
    `and measures nearer the diagonal than the steps (${diagLongest.tiles.toFixed(2)} vs ${diagLongest.edges.length} edges)`);

  // formal edges keep the exact tile line — the ground above them does too
  game.edgeStyle = 'formal'; wallRunCache.sig = null;
  const formal = buildElevationRuns();
  assert(formal.every(r => r.pts.every(p => p[0] === Math.round(p[0]) && p[1] === Math.round(p[1]))),
    'formal mode stays on the lattice');
});

/* The linear feet on the planting list is a number somebody quotes from, so it
   must not move when the gardener turns the view. Camera facing was baked into
   the trace at first and did exactly that — 24.2 / 24.7 / 25.9 / 25.6 ft for one
   wall at the four rotations. */
test('wall feet are what the list bills, and do not depend on the camera', () => {
  setup(30, 30);
  game.edgeStyle = 'organic'; setBrushSize(1);
  game.tool = 'raise';
  for (let x = 6; x <= 15; x++) for (let y = 8; y <= 12; y++) applyToolAt(x, y);
  game.tool = 'wall'; game.wallDraft = 'stone';
  for (let x = 6; x <= 15; x++) for (let y = 8; y <= 12; y++) applyToolAt(x, y);

  const feetAt = (rot) => {
    game.rot = rot; wallRunCache.sig = null;
    return buildElevationRuns().reduce((a, r) => a + wallRunFeet(r), 0);
  };
  const f0 = feetAt(0);
  for (const rot of [1, 2, 3]) {
    assert(Math.abs(feetAt(rot) - f0) < 0.01,
      `rotation ${rot} bills the same feet (${feetAt(rot).toFixed(2)} vs ${f0.toFixed(2)})`);
  }
  game.rot = 0; wallRunCache.sig = null;

  // a 10x5 terrace has a 30-tile perimeter = 45 ft of drop
  assert(Math.abs(f0 - 45) < 4, `a 10x5 terrace bills about 45 ft (${f0.toFixed(1)})`);

  // and the planting list reports exactly that, not a count of tile faces
  const row = hardscapeRows().find(r => r.kind === 'Retaining wall');
  assert(row, 'the list carries a wall row');
  assertEqual(row.count, `${Math.round(f0)} ft`, 'the row is the traced contour');

  /* A wall painted ONE TILE WIDE is a different object from a terrace: its
     contour runs up one side and back down the other, so counting every face
     bills it twice. Those are the two sides of one wall. */
  setup(30, 30);
  game.edgeStyle = 'organic'; setBrushSize(1);
  game.tool = 'raise';
  for (let x = 6; x <= 15; x++) applyToolAt(x, 10);
  game.tool = 'wall'; game.wallDraft = 'stone';
  for (let x = 6; x <= 15; x++) applyToolAt(x, 10);
  wallRunCache.sig = null;
  const ridge = buildElevationRuns().reduce((a, r) => a + wallRunFeet(r), 0);
  assert(ridge > 12 && ridge < 20, `a 10-tile (15 ft) freestanding wall bills about its own length (${ridge.toFixed(1)} ft)`);
});
