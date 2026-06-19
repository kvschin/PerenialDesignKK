/* Tier 2 — game.js logic, run after plants.js + game.js load under DOM stubs.
   Exercises the real pure functions (no enterGarden / no rendering loop). */

// fresh, predictable state for a test
function setup(gw, gh){
  setWorldSize(gw || 21, gh || 21);
  game.mode = 'solo'; game.gameMode = 'design';
  game.plants = {}; game.bulbs = {}; game.terrain = {}; game.houses = []; game.fences = {};
  game.houseDraft = { w: 2, h: 2, wall: '#8a7a60', roof: '#9a5f3a', sizeFt: [3, 3] };
  game.fenceDraft = { style: 'black', height: 4, gate: false };
  game.bedStyle = 'soil';
  game.rot = 0; game.region = { eco: null, zone: null, nativesOnly: false };
  game.startTs = Date.now(); game.elapsedMs = 0; game.dayOffset = 0; game.pausedAt = 0; game.clockSuspended = false;
  game.tool = 'hand'; game.toolVar = null; game.fillMode = false; game.drift = false; game.freePlanting = false;
  game.lastBrushTool = null; game.lastBrushVar = null;
  game.eraseMode = 'all'; game.eraseSize = 1;
  game.focusPlantKey = null; game.shrubFx = [];
  game.layerVis = { perennials: true, bulbs: true, woody: true, landscape: true, shade: false, night: false };
  game.layerFocus = 'all';
  game.sel = null; game.selItems = null; game.selMode = 'move';
  game.px = SPAWNX; game.py = SPAWNY; game.tx = SPAWNX; game.ty = SPAWNY;
  undoStack.length = 0;
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

test('ftToTiles converts and clamps to a 2-tile minimum', () => {
  assertEqual(ftToTiles(18), 12, '18ft at 18in tiles = 12 tiles');
  assertEqual(ftToTiles(1.5), 2, 'one tile of feet rounds to the minimum 2');
  assert(ftToTiles(1) >= 2, 'never smaller than 2 tiles');
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

test('plantFits applies zone, natives-only, and ecoregion filters', () => {
  setup();
  const k = Object.keys(PLANTS).find(x => PLANTS[x].zones[0] >= 3 && PLANTS[x].zones[1] <= 9);
  const z = PLANTS[k].zones;
  game.region = { zone: z[0], nativesOnly: false, eco: null };
  assert(plantFits(k), 'should fit at its lower zone');
  game.region = { zone: z[0] - 1, nativesOnly: false, eco: null };
  assert(!plantFits(k), 'should be excluded below its range');
  const nonNative = Object.keys(PLANTS).find(x => !PLANTS[x].native);
  game.region = { zone: null, nativesOnly: true, eco: null };
  assert(!plantFits(nonNative), 'natives-only hides cultivars/non-natives');
});

test('bulbs cannot be planted under a tree or shrub', () => {
  setup();
  const woody = firstOfType('shrub') || firstOfType('tree');
  const bulb = firstOfType('bulb');
  game.plants['5,5'] = { s: woody, d: 0, t: 1 };
  game.tool = bulb; game.toolVar = null;
  assert(applyToolAt(5, 5) === null, 'bulb under woody must be refused');
  // but a bulb under a perennial is fine
  game.plants = { '6,6': { s: firstOfType('forb'), d: 0, t: 1 } };
  assert(applyToolAt(6, 6) === 'bulb', 'bulb under a perennial is allowed');
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

test('draw tool restores the last plant or material after other tools', () => {
  setup(13, 13);
  const forb = firstOfType('forb');
  setTool(forb, null);
  assertEqual(game.lastBrushTool, forb, 'plant brush remembered');
  setTool('fence', null);
  assertEqual(game.lastBrushTool, forb, 'structure tool does not overwrite drawing brush');
  setTool('shovel', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, forb, 'draw rail restores previous plant brush');

  setTool('bed', null);
  setTool('house', null);
  armPlantToolFromRail(false);
  assertEqual(game.tool, 'bed', 'draw rail restores previous material brush');
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
  assert(shrubVisualCw(plantDef('sumac')) > PLANTS.sumac.cw, 'wide shrubs render from real spread, not just icon width');
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

test('clipped shrubs get their own rounded plan components', () => {
  setup(13, 13);
  game.plants['4,4'] = { s: 'boxwoodlow', d: 0, t: 1 };
  game.plants['7,5'] = { s: 'boxwoodsquare', d: 0, t: 1 };
  game.plants['8,5'] = { s: 'boxwoodsquare', d: 0, t: 1 };
  const comps = clippedShrubPlanComponents();
  const low = comps.find(c => c.s === 'boxwoodlow');
  const hedge = comps.find(c => c.s === 'boxwoodsquare');
  assert(low && low.shape === 'sphere' && low.tiles.length === 1, 'low ball is a one-plant round plan symbol');
  assert(hedge && hedge.hedge && hedge.tiles.length === 2, 'touching square boxwoods become one hedge symbol');
});

test('dusk overlay marks the layer view active', () => {
  setup(13, 13);
  assert(!layerViewActive(), 'default layer view is inactive');
  game.layerVis.night = true;
  assert(layerViewActive(), 'dusk/night overlay makes Layers active');
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
  assertEqual(plantLayerOf({ s: woody }), 'woody', 'tree/shrub -> woody');
  assertEqual(plantLayerOf({ s: forb }), 'perennials', 'forb -> perennials');
});

test('undo/redo round-trips and a new action clears the redo chain', () => {
  setup();
  const g = firstOfType('grass');
  withUndo(() => { game.plants['5,5'] = { s: g, d: 0, t: 1 }; });
  withUndo(() => { game.plants['6,5'] = { s: g, d: 0, t: 1 }; });
  assertEqual(live(game.plants).length, 2, 'two plants placed');
  doUndo(); assertEqual(live(game.plants).length, 1, 'undo removed the last');
  doRedo(); assertEqual(live(game.plants).length, 2, 'redo restored it');
  assertEqual(redoStack.length, 0, 'redo consumed its entry');
  doUndo(); assertEqual(redoStack.length, 1, 'undo refilled the redo chain');
  withUndo(() => { game.plants['7,7'] = { s: g, d: 0, t: 1 }; }); // a fresh action
  assertEqual(redoStack.length, 0, 'a new action clears redo');
});

test('eyedropper samples a plant, a bulb, a fence, or a material onto the brush', () => {
  setup();
  const forb = firstOfType('forb'), bulb = firstOfType('bulb');
  game.plants['3,3'] = { s: forb, v: null, d: 0, t: 1 };
  game.bulbs['4,4'] = { s: bulb, v: null, d: 0, t: 1 };
  game.fences['6,6'] = { style: 'brick', height: 6, gate: true, t: 1 };
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

  game.tool = 'pick'; game.bedStyle = 'soil'; pickAt(7, 7);
  assertEqual(game.tool, 'bed', 'picked the bed material');
  assertEqual(game.bedStyle, 'rock', 'copied the bed style');

  game.tool = 'pick'; pickAt(10, 10);
  assertEqual(game.tool, 'pick', 'nothing to pick on bare grass — stays on the tool');
});
