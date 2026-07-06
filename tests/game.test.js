/* Tier 2 — game.js logic, run after plants.js + game.js load under DOM stubs.
   Exercises the real pure functions (no enterGarden / no rendering loop). */

// fresh, predictable state for a test
function setup(gw, gh){
  setWorldSize(gw || 21, gh || 21);
  game.mode = 'solo'; game.gameMode = 'design'; game.visiting = false;
  game.plants = {}; game.bulbs = {}; game.terrain = {}; game.elevation = {}; game.houses = []; game.fences = {}; game.lights = {}; game.firepits = {}; game.boulders = {};
  game.houseDraft = { w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] };
  game.fenceDraft = { style: 'black', height: 4, gate: false };
  game.lightDraft = { type: 'path', tone: 'warm' };
  game.firepitDraft = { shape: 'round', size: 'round36' };
  game.boulderDraft = { type: 'round1' };
  game.bedStyle = 'soil';
  game.rot = 0; game.filters = { zone: null, nativesOnly: false, deer: false, rabbit: false, squirrel: false };
  game.design = null; game.challenge = null;
  game.startTs = Date.now(); game.elapsedMs = 0; game.dayOffset = 0; game.pausedAt = 0; game.clockSuspended = false;
  game.tool = 'hand'; game.toolVar = null; game.fillMode = false; game.drift = false; game.matrix = false; game.freePlanting = false;
  game.previewMode = 'today'; game.edgeStyle = 'organic';
  game.lastBrushTool = null; game.lastBrushVar = null;
  game.lastBrushTrayCat = 'grasses'; game.lastBrushDrill = null; game.trayScroll = {};
  game.eraseMode = 'all'; game.brushSize = 1;
  game.groundRev = 0; game.terrainRev = 0;
  cam.x = 0; cam.y = 0;
  game.focusPlantKey = null; game.shrubFx = [];
  game.layerVis = defaultLayerVis();
  game.layerFocus = 'all';
  game.ruler = null;
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

test('organic regions: material boundaries are hard, grass edges stay soft', () => {
  setup(21, 21);
  // a bed with a path butted against its east side
  for (let y = 5; y <= 8; y++) for (let x = 3; x <= 6; x++) setTile('terrain', `${x},${y}`, { k: 'bed', c: 'mulch', t: 1 });
  for (let y = 5; y <= 8; y++) for (let x = 7; x <= 9; x++) setTile('terrain', `${x},${y}`, { k: 'path', c: 'warm', t: 1 });
  const regions = buildTerrainRegions();
  assertEqual(regions.length, 2, 'bed and path are separate regions');
  const bed = regions.find(r => r.kind === 'bed');
  assert(!bed.loops[0].closed, 'a butted region splits into arcs');
  const hard = bed.loops[0].arcs.filter(a => a.hard);
  const soft = bed.loops[0].arcs.filter(a => !a.hard);
  assert(hard.length >= 1 && soft.length >= 1, 'the loop has both hard and soft arcs');
  // the shared boundary is the x=7 tile line, exact and unjittered
  const sharedPts = hard.flatMap(a => a.pts);
  assert(sharedPts.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)),
    'hard arc points are exact tile corners (no jitter)');
  assert(sharedPts.some(([x]) => x === 7), 'the hard arc lies on the shared tile line');
  // soft arc endpoints stay pinned on the lattice so curves land on real corners
  for (const a of soft){
    const first = a.pts[0], last = a.pts[a.pts.length - 1];
    assert(Number.isInteger(first[0]) && Number.isInteger(first[1]), 'soft arc start pinned');
    assert(Number.isInteger(last[0]) && Number.isInteger(last[1]), 'soft arc end pinned');
  }
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
  // never wider than an art cw that already exceeds real width, and non-trees untouched
  const grass = PLANTS.bluestem;
  assertEqual(woodyVisualH(grass), grass.h, 'herbaceous height untouched');
  const shrub = PLANTS.smokebush;
  assertEqual(woodyVisualCw(shrub), Math.max(shrub.cw, woodyRadiusTiles(shrub) * TILE_W), 'shrub visual width rule unchanged');
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
