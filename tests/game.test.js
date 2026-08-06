/* Tier 2 — game.js logic, run after plants.js + game.js load under DOM stubs.
   Exercises the real pure functions (no enterGarden / no rendering loop). */

// fresh, predictable state for a test
function setup(gw, gh){
  setWorldSize(gw || 21, gh || 21);
  game.mode = 'solo'; game.gameMode = 'design'; game.visiting = false;
  game.plants = {}; game.bulbs = {}; game.terrain = {}; game.elevation = {}; game.houses = []; game.buildings = []; game.fences = {}; game.lights = {}; game.firepits = {}; game.boulders = {};
  game.schemes = []; game.schemeActive = null; ensureSchemes();   // every garden runs on at least one planting scheme
  game.houseDraft = { w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] };
  game.fenceDraft = { style: 'black', height: 4, gate: false };
  game.lightDraft = { type: 'path', tone: 'warm' };
  game.firepitDraft = { shape: 'round', size: 'round36' };
  game.boulderDraft = { type: 'round1' };
  game.buildingDraft = null; game.buildingStyleDraft = { status: 'existing', label: 'House', wall: '#8a7a60', roof: '#9a5f3a' };
  game.bedStyle = 'soil';
  game.rot = 0; game.siteNorthDeg = 0; game.siteNorthPreviewDeg = null;
  game.filters = { zone: null, nativesOnly: false, deer: false, rabbit: false, squirrel: false };
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
  game.px = SPAWNX; game.py = SPAWNY; game.tx = SPAWNX; game.ty = SPAWNY;
  game.pathTarget = null; game.sleepOnArrive = false;
  game.rev = 0; game.dirty = false;
  undoStack.length = 0; redoStack.length = 0; pendSnap = null;
}
const live = obj => Object.keys(obj).filter(k => obj[k] && !obj[k].removed);
const firstOfType = t => Object.keys(PLANTS).find(k => PLANTS[k].type === t && !PLANTS[k].hidden);

test('core constants are sane', () => {
  assert(Array.isArray(SEASONS) && SEASONS.length === 4, 'SEASONS');
  assert(DAYS_PER_SEASON > 0 && TILE_IN > 0 && TILE_W > 0 && TILE_H > 0, 'tile/season constants');
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

test('hand tool pans only in design mode so visit taps can walk', () => {
  setup(15, 15);
  game.tool = 'hand';
  game.gameMode = 'design'; game.visiting = false;
  assert(shouldStartPan({ button: 0 }), 'design hand tool still pans the canvas');
  game.gameMode = 'story'; game.visiting = false;
  assert(!shouldStartPan({ button: 0 }), 'legacy story hand tool should not swallow taps');
  game.visiting = true;
  assert(!shouldStartPan({ button: 0 }), 'visit hand tool should not swallow taps');
  tapAction(4, 4, {});
  assertEqual(game.pathTarget[0], 4, 'visit tap chooses a walk target x');
  assertEqual(game.pathTarget[1], 4, 'visit tap chooses a walk target y');
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
  const nonNative = Object.keys(PLANTS).find(x => !PLANTS[x].native);
  game.filters = normalizeFilters({ nativesOnly: true });
  assert(!plantFits(nonNative), 'natives-only hides cultivars/non-natives');
  game.filters = normalizeFilters({ squirrel: true });
  assert(plantFits('daffodil'), 'squirrel-resistant bulbs stay visible');
  assert(!plantFits('tulip'), 'tulips are hidden by the squirrel bulb filter');
  assert(plantFits('hosta'), 'non-bulbs are unaffected by the squirrel bulb filter');
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
  strip.scrollLeft = 610;
  updateCatalogStripAffordance(strip);
  assert(strip.classList.contains('can-scroll-start'), 'left fade appears once scrolled');
  assert(!strip.classList.contains('can-scroll-end'), 'right fade clears at the end');
  strip.scrollWidth = 300; strip.clientWidth = 330; strip.scrollLeft = 0;
  updateCatalogStripAffordance(strip);
  assert(!strip.classList.contains('can-scroll-start') && !strip.classList.contains('can-scroll-end'),
    'a strip that fits shows no affordance at all');
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
  assert(landscapeSearchItems('wall').some(item => item.tool === 'building'), 'site vocabulary finds Building Footprint');
  assert(landscapeSearchItems('gate').some(item => item.tool === 'fence'), 'hardscape vocabulary finds Fence / Gate');
  assertEqual(landscapeSearchItems('').length, 0, 'an empty query keeps the current landscape category visible');
});

test('applying garden criteria leaves the discovery lens intact', () => {
  setup();
  game.design = { zone: 6, type: 'any', nativesOnly: false, deer: false, rabbit: false, squirrel: false };
  game.discovery = normalizeDiscovery({ source: 'all', query: 'aster', colorFamilies: ['purple'], bloomSeasons: ['Fall'] });
  applyGardenCriteria({ zone: 7, nativesOnly: true, deer: true, rabbit: false, squirrel: false }, { refresh: false, announce: false });
  assertEqual(game.filters.zone, 7, 'the garden criterion updates');
  assert(game.filters.nativesOnly && game.filters.deer, 'the requested eligibility toggles update');
  assertEqual(game.design.zone, 7, 'the saved garden design keeps the changed zone');
  assertEqual(game.discovery.query, 'aster', 'the discovery query survives a criteria change');
  assertEqual(game.discovery.bloomSeasons[0], 'Fall', 'the discovery bloom lens remains independent');
});

test('the fixed setup zone stays out of discovery filter summaries', () => {
  setup();
  game.filters = normalizeFilters({ zone: 6, nativesOnly: true, deer: false, rabbit: false, squirrel: false });
  game.discovery = normalizeDiscovery({ colorFamilies: ['pink'], bloomSeasons: [] });
  const labels = discoveryCriteriaLabels();
  assert(!labels.some(label => /^Zone/.test(label)), 'the setup zone is not repeated in the in-garden catalog');
  assert(labels.includes('Native'), 'an active garden criterion still has a concise summary label');
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
  assert(/1 variety/.test(discoveryResultCountText([cultivar])), 'a cultivar-only result still reports one variety');
  const matches = discoveryRefsFor(normalizeDiscovery({ source: 'all', query: cultivar.v }));
  const matchGroups = groupDiscoveryRefs(matches);
  assert(matchGroups.some(group => group.refs.some(ref => ref.s === cultivar.s && ref.v === cultivar.v)),
    'an exact cultivar search still surfaces its exact reference');
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

test('exact bloom-day species stay gated to their authored season', () => {
  const onion = PLANTS.prairieonion;
  assert(onion.bloomDay !== undefined, 'fixture uses the exact bloom-day contract');
  assert(bloomAppearanceFor(onion, 'Fall'), 'prairie onion can bloom in Fall');
  assertEqual(bloomAppearanceFor(onion, 'Summer'), null,
    'prairie onion cannot borrow its Fall flower color into Summer');
  assert(bloomAppearanceFor(PLANTS.gaura, 'Fall'),
    'month-window plants retain their boundary color bridge');
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
    game.tx = x; game.ty = y;
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
  const latticePoint=screenOfFlat(7, 4, 900, 700);
  assertEqual(JSON.stringify(buildingCornerScreenPoint([7, 4], 900, 700, 0)), JSON.stringify(latticePoint),
    'building draft points project onto the exact visible tile-corner lattice');
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
    game.mode = 'solo';
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
    assert(card.innerHTML.includes('<b>Mature size:</b> 46&Prime; H &times; 18&Prime; W'),
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
    assertEqual(fact('Mature size'), '46" H x 18" W',
      'library little bluestem mature size includes height and stays in inches');
  } finally {
    document.getElementById = oldGet;
  }
});

test('entering design mode starts paused while visits keep time running', () => {
  setup(15, 15);
  game.gameMode = 'design'; game.visiting = false; game.previewMode = 'established';
  enterGarden();
  assert(game.pausedAt, 'design mode starts with time paused');
  assertEqual(game.previewMode, 'established', 'design keeps the established preview');

  setup(15, 15);
  game.gameMode = 'story'; game.visiting = true; game.previewMode = 'established';
  enterGarden();
  assert(!game.pausedAt, 'visit/story mode does not start paused');
  assertEqual(game.previewMode, 'today', 'visit/story mode uses today preview');
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
  assert(!canStand(4, 4), 'footprint blocks movement');
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

test('fences place as blocking structures, gates stay walkable, and erase removes them', () => {
  setup(21, 21);
  game.tool = 'fence';
  game.fenceDraft = { style: 'wood', height: 6, gate: false };
  assertEqual(applyToolAt(5, 5), 'fence', 'fence placed');
  assertEqual(fenceAt(5, 5).style, 'wood', 'style saved');
  assertEqual(fenceAt(5, 5).height, 6, 'height saved');
  assert(!canStand(5, 5), 'regular fence blocks movement');

  game.fenceDraft = { style: 'vinyl', height: 4, gate: true };
  assertEqual(applyToolAt(6, 5), 'gate', 'gate placed');
  assert(canStand(6, 5), 'gate is walkable');

  game.tool = firstOfType('forb');
  assertEqual(applyToolAt(5, 5), null, 'plants refuse fence tiles');

  const counts = { plants: 0, bulbs: 0, terr: 0, house: 0, fence: 0 };
  game.tool = 'shovel'; game.eraseMode = 'terrain';
  eraseBrush(5, 5, counts);
  assertEqual(counts.fence, 1, 'erase counted the fence');
  assert(!fenceAt(5, 5), 'fence removed');
});

test('lights place as one-tile structures, block plants, and erase with landscape', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  game.tool = 'light';
  game.lightDraft = { type: 'lantern', tone: 'eco' };
  assertEqual(applyToolAt(5, 5), 'light', 'light placed');
  assertEqual(lightAt(5, 5).type, 'lantern', 'light type saved');
  assertEqual(lightAt(5, 5).tone, 'eco', 'light tone saved');
  assert(!canStand(5, 5), 'light occupies its tile');
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
  assert(!canStand(6, 6), 'fire pit footprint blocks movement');

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
  assert(!canStand(6, 5), 'boulder blocks movement');

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

test('story mode refuses to place a blocking fence under the player', () => {
  setup(21, 21);
  game.gameMode = 'story';
  game.px = game.tx = 7; game.py = game.ty = 7;
  game.tool = 'fence';
  game.fenceDraft = { style: 'black', height: 4, gate: false };
  assertEqual(applyToolAt(7, 7), null, 'blocking fence under player refused');
  game.fenceDraft.gate = true;
  assertEqual(applyToolAt(7, 7), 'gate', 'gate under player is allowed');
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

test('remote map merge bumps revision only when it applies newer data', () => {
  setup();
  const grass = firstOfType('grass');
  const rev = game.rev;
  mergeMap(game.plants, { '2,2': { s: grass, d: 0, t: 2 } });
  assert(game.rev > rev, 'accepted remote entry marks the model changed');
  const revAfter = game.rev;
  mergeMap(game.plants, { '2,2': { s: firstOfType('forb'), d: 0, t: 1 } });
  assertEqual(game.rev, revAfter, 'older remote entry is ignored without dirtying');
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
  ['bluestem', 'ladyfern', 'monarda', 'mountainmint', 'salvia', 'yarrow', 'baptisia',
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
  game.design = { zone: 6, type: 'any', nativesOnly: false, deer: false, rabbit: false, squirrel: false };
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
  assert(paletteCount({ zone: 6, nativesOnly: true }) <= paletteCount({ zone: 6 }),
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

test('saveSolo blob carries plotShape and applying it back round-trips the shape', () => {
  setup(31, 31);
  const shape = [[0, 0], [31, 0], [24, 31], [0, 31]];
  assert(setPlotShape(shape), 'shape accepted before saving');
  game.mode = 'solo'; game.worldId = 'test-plotshape-roundtrip';
  saveSolo(true); // sSet's localStorage.setItem runs synchronously, before saveSolo's own first await
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

test('save blobs preserve a garden’s discovery lens without changing its eligibility rules', () => {
  setup(21, 21);
  game.mode = 'solo'; game.worldId = 'test-discovery-roundtrip';
  game.filters = normalizeFilters({ zone: 6, nativesOnly: true });
  game.design = { zone: 6, type: 'any', nativesOnly: true, deer: false, rabbit: false, squirrel: false };
  game.discovery = normalizeDiscovery({ source: 'favorites', query: 'aster', colorFamilies: ['purple'], bloomSeasons: ['Fall'], limit: 72 });
  saveSolo(true);
  const blob = JSON.parse(localStorage.getItem('hortus:world:test-discovery-roundtrip'));
  assertEqual(blob.design.zone, 6, 'the hard garden zone stays in the save payload');
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
  setTile('bulbs', '8,8', { s: 'crocus', d: 0, t: 1 });
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

test('schemes round-trip through save and load, active maps staying at the top level', () => {
  setup(21, 21);
  game.mode = 'solo'; game.worldId = 'test-schemes-roundtrip';
  setTile('terrain', '5,5', { k: 'bed', c: 'soil', t: 1 });
  setTile('plants', '3,3', { s: 'bluestem', d: 0, t: 1 });
  renameScheme(game.schemeActive, 'Prairie matrix');
  const b = createScheme(false);
  renameScheme(b.id, 'Shade tolerant');
  setTile('plants', '9,9', { s: 'karl', d: 0, t: 1 });
  saveSolo(true);

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

test('a single-scheme garden saves exactly as it always did', () => {
  setup(21, 21);
  game.mode = 'solo'; game.worldId = 'test-schemes-absent';
  setTile('plants', '3,3', { s: 'bluestem', d: 0, t: 1 });
  saveSolo(true);
  const blob = JSON.parse(localStorage.getItem('hortus:world:test-schemes-absent'));
  assertEqual(blob.schemes, undefined, 'below two schemes the key is omitted entirely');
  assert(!!blob.plants['3,3'], 'plants stay exactly where they have always been');
  assertEqual(worldSaveMeta(blob).schemes, 1, 'a schemeless blob reports one scheme');
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
    setTile('plants', `${x},${y}`, { s: 'littlebluestem', d: 0, t: 1 });
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
  setTile('plants', '9,9', { s: 'littlebluestem', d: 0, t: 1 });
  assert(groundDamage.size === 0 && !groundDamageFull, 'planting is not ground damage at all');
});
