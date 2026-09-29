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

/* ---------- #1: the sheet lays itself out only when its geometry changes ---------- */

// Run fn at a viewport size, then put the size and the sheet back.
function atViewport(w, h, fn){
  const w0 = innerWidth, h0 = innerHeight;
  innerWidth = w; innerHeight = h;
  try { return fn(); }
  finally { innerWidth = w0; innerHeight = h0; game.sheetState = 'half'; sheetLaidOut = ''; }
}

test('on the dock, a tool change does not re-run the viewport settle', () => {
  /* Every tool press on the desktop ran settleViewportChange: both canvases
     re-measured, the compass, the chrome menus and eight throwaway measuring
     divs, 29-31 getBoundingClientRect calls per click, for a library that had
     not moved. */
  uiSetup();
  atViewport(1440, 900, () => {
    assert(!mobileSheetUi(), 'this is the dock tier');
    sheetLaidOut = '';
    setSheetState('full');                       // lay it out once, as opening a garden does
    const herb = fittingKey(P => P.type === 'forb');
    const n = counting(['settleViewportChange', 'sizeCanvas', 'syncRailBottom'], () => {
      setTool('select'); setTool('ruler'); setTool('hand'); setTool(herb, null);
      renderCvRow(); applySheetState();
    });
    assertEqual(n.settleViewportChange, 0, 'no settle for an unchanged library');
    assertEqual(n.sizeCanvas, 0, 'no canvas re-measure');
    assertEqual(n.syncRailBottom, 0, 'no rail re-measure');
  });
});

test('on the dock, opening or closing the library still settles the viewport', () => {
  uiSetup();
  atViewport(1440, 900, () => {
    sheetLaidOut = '';
    setSheetState('full');
    const n = counting(['settleViewportChange'], () => { setSheetState('collapsed'); setSheetState('full'); });
    assertEqual(n.settleViewportChange, 2, 'one settle per real change, as before');
  });
});

test('on a phone, a tool change does not re-measure the sheet', () => {
  /* The phone branch swapped measuring classes across the whole catalog and
     read its height twice on every tool tap: 6-7ms, even Hand to Ruler. */
  uiSetup();
  atViewport(375, 812, () => {
    assert(mobileSheetUi(), 'this is the sheet tier');
    sheetLaidOut = '';
    setSheetState('half');
    const n = counting(['sheetTargetHeight', 'syncRailBottom', 'settleViewportChange'], () => {
      setTool('select'); setTool('ruler'); setTool('hand'); renderCvRow(); applySheetState();
    });
    assertEqual(n.sheetTargetHeight, 0, 'no height measurement');
    assertEqual(n.syncRailBottom, 0, 'no rail re-measure');
    assertEqual(n.settleViewportChange, 0, 'and no settle either');
    const m = counting(['sheetTargetHeight'], () => { setSheetState('full'); setSheetState('collapsed'); });
    assertEqual(m.sheetTargetHeight, 2, 'a real change still measures its FLIP target');
  });
});

test('the sheet lays out again when the tier or the photo editor changes it, not only its state', () => {
  uiSetup();
  const hb = document.querySelector('.hud-bottom');
  try {
    // dock 'full', then the same 'full' on a phone: the tier changed, so the phone layout must run
    atViewport(1440, 900, () => { sheetLaidOut = ''; setSheetState('full'); });
    atViewport(1440, 900, () => {
      sheetLaidOut = ''; setSheetState('full');
      innerWidth = 375; innerHeight = 812;
      const n = counting(['sheetTargetHeight'], () => applySheetState());
      assertEqual(n.sheetTargetHeight, 1, 'crossing into the sheet tier lays the sheet out');
    });
    // the photo editor hides the sheet (visibility), which the rail reservation reads
    atViewport(375, 812, () => {
      sheetLaidOut = ''; setSheetState('half');
      hb.classList.add('photo-editing');
      // (the rail re-sync that follows is not countable here: the stub's zero
      // rects send the sheet down the animated branch, which waits on a
      // transitionend the sandbox never fires)
      const n = counting(['sheetTargetHeight'], () => setSheetState('half'));
      assertEqual(n.sheetTargetHeight, 1, 'photo editing is a layout change even at the same state');
    });
  } finally { hb.classList.remove('photo-editing'); sheetLaidOut = ''; }
});

test('with nothing to lay out, the sheet label still follows the armed tool', () => {
  uiSetup();
  atViewport(1440, 900, () => {
    sheetLaidOut = ''; setSheetState('full');
    const herb = fittingKey(P => P.type === 'forb');
    const ctx = document.getElementById('sheetCtx');
    game.tool = 'select'; applySheetState();
    assertEqual(ctx.textContent, 'Select', 'label for Select');
    game.tool = herb; game.toolVar = null; applySheetState();
    assertEqual(ctx.textContent, plantDef(herb, null).name, 'label for the armed plant');
  });
});

test('the true viewport height is probed once per task, not once per caller', async () => {
  /* Each probe inserts and removes a div, dirtying layout for the next read;
     one settle used to probe eight times. */
  let n = 0;
  const probe = probeUnitH;
  probeUnitH = function(){ n++; return probe.apply(this, arguments); };
  try {
    await Promise.resolve();                     // start from a clean task boundary
    n = 0;
    const a = trueViewH(), b = trueViewH(), c = trueViewH();
    assertEqual(n, 2, 'one 100vh and one 100lvh probe for three callers');
    assertEqual(a, b, 'the same answer'); assertEqual(b, c, 'the same answer');
    await Promise.resolve(); await Promise.resolve();
    trueViewH();
    assertEqual(n, 4, 'a later task probes fresh, which the post-rotation re-settles rely on');
  } finally { probeUnitH = probe; }
});

/* ---------- #2: the catalog rebuilds only for what the catalog shows ---------- */

test('the catalog signature ignores the brush bar, the selection and the rail menu', () => {
  /* Each of these moved the signature and so rebuilt ~950 nodes (8-11ms in
     Chrome) to redraw nothing: the brush bar is its own element, repainted by
     the control that changed it, and the selection pill and rail menus are not
     in the catalog at all. */
  uiSetup();
  const flips = [
    ['fillMode', true, false], ['matrix', true, false], ['drift', true, false],
    ['freePlanting', true, false], ['brushSize', 7, 1], ['eraseMode', 'bulb', 'all'],
    ['woodyAge', 'new', 'mature'], ['selMode', 'copy', 'move'], ['toolMenu', 'layers', null],
    ['sel', { x0: 1, y0: 1, x1: 3, y1: 3 }, null], ['selItems', [{ x: 1, y: 1 }], null],
  ];
  for (const [k, a, b] of flips){
    const was = game[k];
    game[k] = a; const one = trayStateSig();
    game[k] = b; const two = trayStateSig();
    game[k] = was;
    assertEqual(one, two, k + ' must not move the catalog signature');
  }
});

test('to the catalog, a rail tool is the same as nothing armed', () => {
  uiSetup();
  game.tool = 'hand'; game.toolVar = null;
  const base = trayStateSig();
  for (const t of ['select', 'ruler', 'pick', 'shovel']){
    game.tool = t;
    assertEqual(trayStateSig(), base, t + ' reads as nothing armed');
  }
  // ...but everything the catalog does show still moves it
  const herb = fittingKey(P => P.type === 'forb');
  for (const t of [herb, 'path', 'bed', 'fence', 'pot', 'building', 'building-edit']){
    game.tool = t; game.toolVar = null;
    assert(trayStateSig() !== base, t + ' moves the signature');
  }
  game.tool = herb; const plain = trayStateSig();
  game.toolVar = 'somecultivar';
  assert(trayStateSig() !== plain, 'the armed cultivar moves it too');
  game.tool = 'hand'; game.toolVar = null;
});

test('switching between the rail tools does not rebuild the catalog', () => {
  /* The first press of Select, Pick or Erase after another rail tool rebuilt
     the catalog: 15-25ms in Chrome, for a catalog that shows none of them. */
  uiSetup();
  /* buildToolTray also rebuilds when #trayTabs has been emptied, which it asks
     through firstChild — and the stub element's firstChild is always null, so
     here every unforced call would rebuild. Answer as a browser does once the
     catalog has been drawn, so this measures the signature and only that. */
  const intact = trayDomIntact;
  trayDomIntact = () => true;
  try {
    setTool('hand'); buildToolTray(true);
    const n = counting(['buildToolTrayInner'], () => {
      // exactly what the rail buttons run
      setTool('select'); game.toolMenu = null; buildToolTray();
      setTool('ruler'); game.toolMenu = null;
      setTool('pick'); buildToolTray();
      armEraseTool();
      setTool('hand');
      setTool('select'); game.toolMenu = null; buildToolTray();
    });
    assertEqual(n.buildToolTrayInner, 0, 'no catalog rebuild among Hand, Select, Ruler, Pick and Erase');
    const herb = fittingKey(P => P.type === 'forb');
    const m = counting(['buildToolTrayInner'], () => { setTool(herb, null); buildToolTray(); });
    assertEqual(m.buildToolTrayInner, 1, 'arming a plant still rebuilds: its card changes');
  } finally { trayDomIntact = intact; }
});

test('the catalog renderers never tell one rail tool from another', () => {
  /* RAIL_ONLY_TOOLS folds these out of the signature, which is only safe while
     nothing the catalog DRAWS depends on which of them is armed. The one
     comparison allowed is read at click time, not render time: the category
     strip's handler sends the eyedropper back to Hand. */
  const renderers = [buildToolTrayInner, renderDiscoveryTray, renderDiscoveryTrayInner, renderDiscoveryControls,
    renderLandscapeControls, renderLandscapeSearchTray, renderSearchPlantButton, renderSearchToolButton,
    discoveryResultCard, discoveryFamilyCard, renderDiscoveryCategories, renderDrillIn, updateCatalogHeader];
  const rail = [...RAIL_ONLY_TOOLS].join('|');
  const re = new RegExp("game\\.tool\\s*[!=]==?\\s*['\"](" + rail + ")['\"]", 'g');
  const found = renderers.flatMap(f => (String(f).match(re) || []).map(m => f.name + ': ' + m));
  assertEqual(found.length, 1, 'rail-tool comparisons in the catalog: ' + JSON.stringify(found));
  assert(/buildToolTrayInner: game\.tool\s*===\s*'pick'/.test(found[0]), 'and it is the click-time eyedropper check: ' + found[0]);
  // the set names what the rail arms, and nothing the catalog lists
  for (const t of RAIL_ONLY_TOOLS){
    assert(!PLANTS[t], t + ' is not a plant');
    assert(!TRAY_CATS.some(c => c.tools && c.tools.includes(t)), t + ' is not a catalog tool');
  }
});

/* ---------- #4: the Replace dialog's search filters a list it built once ---------- */

// The candidate list as it was computed before, per keystroke, off trayKeys().
function replaceOptionsAsBefore(source, q){
  const from = plantDef(source.s, source.v), group = replacementGroup(from), out = [];
  trayKeys().forEach(k => {
    const P = PLANTS[k], add = v => {
      const D = plantDef(k, v), hay = `${P.name} ${P.latin} ${D.name || ''} ${D.note || ''}`.toLowerCase();
      if (plantRefFits({ s: k, v: v || null }) && replacementGroup(D) === group && (!q || hay.includes(q))) out.push(k + '|' + (v || ''));
    };
    add(null); Object.keys(P.cv || {}).forEach(add);
  });
  return out.filter(id => id !== source.s + '|' + (source.v || '')).sort();
}

test('the Replace search offers exactly what it offered before, in name order', () => {
  uiSetup();
  const pick = pred => PLANT_KEYS.find(k => !PLANTS[k].hidden && pred(PLANTS[k]) && plantFits(k));
  const sources = [
    { s: pick(P => P.type === 'forb'), v: null },
    { s: pick(P => P.type === 'grass' && P.cv && Object.keys(P.cv).length), v: null },
    { s: pick(P => P.type === 'shrub'), v: null },
    { s: pick(P => P.type === 'bulb'), v: null },
  ];
  const cvSrc = sources[1];
  sources.push({ s: cvSrc.s, v: Object.keys(PLANTS[cvSrc.s].cv)[0] });
  let checked = 0;
  for (const src of sources){
    assert(src.s, 'a source plant for each kind');
    for (const q of ['', 'a', 'blue', 'prairie', 'zzzz']){
      const now = replaceOptionList(src, q);
      assertEqual(JSON.stringify(now.map(o => o.s + '|' + (o.v || '')).sort()),
        JSON.stringify(replaceOptionsAsBefore(src, q)), `${src.s}/${src.v || ''} for "${q}"`);
      for (let i = 1; i < now.length; i++)
        assert(now[i - 1].D.name.localeCompare(now[i].D.name) <= 0, 'sorted by name at ' + now[i].D.name);
      checked += now.length;
    }
  }
  assert(checked > 50, 'the comparison covered real result lists: ' + checked);
});

test('typing in the Replace search does not rebuild or re-sort the candidates', () => {
  /* Measured 11-13ms a keystroke in Chrome: trayKeys() sorted the whole
     catalog and every cultivar's search text was rebuilt, for each letter. */
  uiSetup();
  const src = { s: PLANT_KEYS.find(k => !PLANTS[k].hidden && PLANTS[k].type === 'forb' && plantFits(k)), v: null };
  replaceOptionList(src, '');                      // the dialog opening builds it once
  const n = counting(['trayKeys', 'plantFits', 'replacementGroup'], () => {
    for (const q of ['p', 'pr', 'pra', 'prai', 'prair', 'prairi', 'prairie']) replaceOptionList(src, q);
  });
  assertEqual(n.trayKeys, 0, 'no catalog sort per keystroke');
  assertEqual(n.plantFits, 0, 'no eligibility pass per keystroke');
  assertEqual(n.replacementGroup, 0, 'no grouping pass per keystroke');
  const code = String(replaceCandidates).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/trayKeys\s*\(/.test(code), 'replaceCandidates does not sort the catalog');
});

test('the Replace candidates follow the garden\'s filters', () => {
  uiSetup();
  const src = { s: PLANT_KEYS.find(k => !PLANTS[k].hidden && PLANTS[k].type === 'forb' && plantFits(k)), v: null };
  const all = replaceOptionList(src, '').length;
  game.filters = Object.assign({}, game.filters, { zone: 3, deer: true });
  const narrowed = replaceOptionList(src, '');
  assert(narrowed.length < all, `a stricter filter narrows the list (${all} -> ${narrowed.length})`);
  assertEqual(JSON.stringify(narrowed.map(o => o.s + '|' + (o.v || '')).sort()),
    JSON.stringify(replaceOptionsAsBefore(src, '')), 'and matches the old answer under the new filter');
});

test('a Replace thumbnail is drawn once per plant, and the scope counts once per dialog', () => {
  uiSetup();
  const k = PLANT_KEYS.find(x => !PLANTS[x].hidden && PLANTS[x].type === 'forb' && plantFits(x));
  const o = { s: k, v: null, D: plantDef(k, null) };
  REPLACE_ART.clear();
  let a, b;
  const n = counting(['drawPlant'], () => { a = replaceThumb(o); b = replaceThumb(o); });
  assertEqual(n.drawPlant, 1, 'one procedural draw for two renders');
  assert(a === b, 'the same node is reused');

  for (let i = 0; i < 6; i++) setTile('plants', `${3 + i},4`, { s: k, d: absDay() - 40, t: Date.now() + i });
  replacePlantContext = { source: { s: k, v: null }, key: '3,4', scope: 'one', target: null, choosingSource: false };
  try {
    const m = counting(['replacementScopeTargets'], () => {
      for (let i = 0; i < 3; i++) for (const s of ['one', 'selection', 'garden']) replaceScopeCount(s);
    });
    assertEqual(m.replacementScopeTargets, 3, 'each scope counted once, not per render');
    assertEqual(replaceScopeCount('garden'), 6, 'and the garden count is right');
  } finally { replacePlantContext = null; }
});
