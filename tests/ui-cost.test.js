/* What a button press COSTS: which rebuilds and measurements a UI action
   triggers, rather than what it shows. Loaded after game.test.js in the same
   sandbox (see run.js for why it cannot have its own), so it resets through
   that file's setup().

   Timing cannot be asserted here — the sandbox has no layout engine and no
   rasteriser — so these pin the WORK instead: a toggle that only changes the
   brush bar must not rebuild the catalog or the rail. The costs these guard
   were measured in Chrome on the demo garden and are quoted beside each test. */
testFile('ui-cost.test.js');

function uiSetup(){
  setup(21, 21);
  game.toolMenu = null;
}
/* Count calls to a global app function for the length of fn, then put it back.
   Every module shares one global scope, so reassigning the binding is what the
   callers see; the finally is not optional — a counter left behind would
   change every later test in this tier. */
function counting(names, fn){
  const saved = {}, n = {};
  for (const k of names){
    saved[k] = globalThis[k]; n[k] = 0;
    globalThis[k] = function(){ n[k]++; return saved[k].apply(this, arguments); };
  }
  try { fn(); } finally { for (const k of names) globalThis[k] = saved[k]; }
  return n;
}
function fittingKey(pred){
  return PLANT_KEYS.find(k => !PLANTS[k].hidden && pred(PLANTS[k]) && plantFits(k));
}

/* ---------- #3: the Plant rail and the brush-bar toggles ---------- */

test('the Plant rail\'s remembered-plant check agrees with the sorted catalog, species by species', () => {
  uiSetup();
  const configs = [
    { zone: null, nativeRegion: 'north-america', nativeMode: 'any', deer: false, rabbit: false, squirrel: false },
    { zone: 5, nativeRegion: 'north-america', nativeMode: 'straight', deer: true, rabbit: false, squirrel: true },
    { zone: 8, nativeRegion: 'europe', nativeMode: 'regional', deer: false, rabbit: true, squirrel: false },
  ];
  for (const f of configs){
    game.filters = f;
    const inCatalog = new Set(trayKeys());
    let yes = 0;
    for (const k of PLANT_KEYS){
      game.lastBrushTool = k; game.lastBrushVar = null;
      const got = !!visiblePlantChoice();
      assertEqual(got, inCatalog.has(k), `${k} under ${JSON.stringify(f)}`);
      if (got) yes++;
    }
    assert(yes > 0 && yes < PLANT_KEYS.length, 'each configuration admits some species and refuses others');
  }
});

test('the Plant rail does not sort the catalog to ask about one plant', () => {
  /* trayKeys() sorts every eligible species by style score and name — measured
     7.4ms in Chrome — and the question here is membership. */
  // comments stripped: the function's own note explains why it no longer calls it
  const code = String(visiblePlantChoice).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/trayKeys\s*\(/.test(code), 'visiblePlantChoice must not call trayKeys()');
});

test('a brush-bar toggle with a plant armed repaints the bar, not the catalog or the rail', () => {
  /* Draw/Drift measured 24ms a tap on a desktop and 34ms in the phone layout
     when it re-armed through armPlantToolFromRail: a full catalog rebuild,
     two sheet passes and a rail rebuild, for a change only the brush bar shows. */
  uiSetup();
  const herb = fittingKey(P => P.type === 'forb');
  const woody = fittingKey(P => P.type === 'shrub');
  assert(herb && woody, 'a forb and a shrub that fit the default filters');
  setTool(herb, null);
  buildToolTray(true);                   // prime the catalog cache, as a real session has
  const n = counting(['buildToolTrayInner', 'buildCanvasTools', 'renderBrushBar'], () => {
    choosePlantMode(true);
    chooseMatrixMode();
    choosePlantMode(false);
    choosePlacementMode(true);
    choosePlacementMode(false);
  });
  assertEqual(n.buildToolTrayInner, 0, 'the catalog is not rebuilt');
  assertEqual(n.buildCanvasTools, 0, 'the tool rail is not rebuilt');
  assert(n.renderBrushBar >= 5, 'the brush bar is repainted each time');
  assertEqual(game.tool, herb, 'the armed plant is unchanged');

  setTool(woody, null);
  buildToolTray(true);
  const w = counting(['buildToolTrayInner', 'buildCanvasTools'], () => { chooseWoodyAge('young'); });
  assertEqual(w.buildToolTrayInner, 0, 'Age: no catalog rebuild');
  assertEqual(w.buildCanvasTools, 0, 'Age: no rail rebuild');
  assertEqual(game.woodyAge, 'young', 'the age took');
});

test('a brush-bar toggle keeps what re-arming used to do: Fill off, menus shut, label current', () => {
  uiSetup();
  const herb = fittingKey(P => P.type === 'forb');
  setTool(herb, null);
  game.fillMode = true;
  // 'view' rather than 'layers': the layer menu re-renders through replaceChildren
  // over childNodes, which the stub elements do not carry
  game.toolMenu = 'view';
  choosePlantMode(true);
  assertEqual(game.drift, true, 'Drift on');
  assertEqual(game.matrix, false, 'Drift and Matrix are exclusive');
  assertEqual(game.fillMode, false, 'a pattern choice means plain planting, so Fill goes off');
  assertEqual(game.toolMenu, null, 'an open tool menu closes, as it did when this re-armed');
  assert(/· drift$/.test(document.getElementById('sheetCtx').textContent),
    'the sheet label says drift: ' + document.getElementById('sheetCtx').textContent);
  chooseMatrixMode();
  assert(/· matrix$/.test(document.getElementById('sheetCtx').textContent), 'and then matrix');
});

test('with nothing armed, a brush-bar toggle still arms the remembered plant', () => {
  uiSetup();
  const herb = fittingKey(P => P.type === 'forb');
  game.lastBrushTool = herb; game.lastBrushVar = null;
  game.tool = 'hand';
  choosePlantMode(true);
  assertEqual(game.tool, herb, 'arming is the point when nothing is on the brush');
  assertEqual(game.drift, true, 'and the pattern took');
});
