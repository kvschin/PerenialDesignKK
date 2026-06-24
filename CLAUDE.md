# Pocket Prairie Garden Design

A 2.5D perennial-gardening game in the spirit of Piet Oudolf's naturalistic
planting style. The menu offers four modes: **Design a Garden** (a serious
planner — no avatar, no movement, a free pan/pinch/twist camera and direct
tap-to-place/drag-to-paint à la Procreate; no house at start; created via a
questionnaire of zone/style/natives/deer/rabbit), **Story Mode** (the
Animal-Crossing-ish original — a cat/dog avatar walks the plot, a house spawns),
**Plant Library** (browse every species: list + seasonal images + facts +
cultivars), and **My Gardens** (open/manage saved gardens).

`game.gameMode` is `'design'` | `'story'`, saved per garden and on the world
index entry (legacy saves with no `mode` are Story). Design vs Story branches
live in `enterGarden`, `render` (avatar + camera easing skipped for design),
the loop (movement skipped), `tapAction` (design taps route straight to
`actHere` on the tapped tile), the two-finger pointer handler (adds camera pan
in design), `setUserZoom`/snapCam (design keeps its free camera), and the
`btnPlotStart`/save/load plumbing (design = blank plot, `houses:[]`).
Design panning: two fingers on touch; on PC, middle-mouse drag or
hold Space + drag (`panDrag`). Rotate is the R key or the ⟳ button
(two-finger twist was removed — it fought the pan/zoom gesture). **Undo/redo**
(`undoStack`/`redoStack`, buttons + Ctrl/Cmd-Z, redo via Ctrl/Cmd-Shift-Z
or Ctrl/Cmd-Y): a gesture snapshots plants+bulbs+terrain+houses+fences on
pointerdown (`beginUndo`) and commits it on pointerup only if state
changed (`commitUndo`); discrete actions use `withUndo`. `pushUndo` records
the pre-action snapshot and clears the redo chain; `doUndo`/`doRedo` shuttle
snapshots between the two stacks via `applySnapshot`. Both reset per garden,
capped at 30.

Public app name: **Pocket Prairie Garden Design**. iPhone home-screen label:
**Pocket Prairie**.

The game is plain HTML/CSS/JS in four files — `index.html` (markup),
`styles.css`, `plants.js` (species data), and `game.js` (all logic) — with no
build step, no npm dependencies, no framework. Fonts load from Google Fonts
over the network; everything else is local. `index.html` loads `plants.js`
before `game.js`; keep that order.

## Run / test

- Open `index.html` in a browser, or serve the folder to avoid file:// quirks:
  `npx http-server -p 8642 -c-1` (this machine has Node but no Python; the same
  command is wired into `.claude/launch.json` for the preview panel).
- Live deployment: GitHub Pages serves `master` as-is at
  <https://kvschin.github.io/PerenialDesignKK/> — every push to `master`
  redeploys automatically (no build step, nothing to configure).
- After edits, run `node --check game.js` to catch syntax errors before
  reloading the browser.
- Tests: `node tests/run.js` (or `npm test`) — a zero-dependency runner that
  loads the real `plants.js` and `game.js` inside a `vm` sandbox with light
  DOM stubs. `tests/plants.test.js` checks the species data contract;
  `tests/game.test.js` smoke-renders every species and unit-tests the pure
  logic (iso math, flood fill, selection ownership, bulb/woody rules, the
  house array). All of game.js's testable logic lives above the first DOM
  access (~line 1578), so it loads and runs headless. Add a `test(name,fn)`
  with `assert(...)` to the matching file when you add a feature; the runner
  exits non-zero on any failure.

## Known constraints (read before touching save/multiplayer)

- **Storage is `localStorage` now.** `sGet`/`sSet` kept their original async
  signatures from the artifact era but read/write `localStorage`, so solo saves
  persist. The `shared` flag is accepted and ignored — "shared" gardens only
  sync between tabs **on the same device**. For real cross-device multiplayer,
  stand up a tiny backend (e.g. a WebSocket server or a hosted key-value store)
  and reimplement `sGet`/`sSet` against it; keep the signatures so the rest of
  the code is unchanged.
- Mobile is a first-class target: tap-to-walk, tap-own-tile-to-act. Keep
  `touch-action: none` on the canvases and don't assume a mouse.

## Architecture

Markup (screens, HUD) is in `index.html`; all styling in `styles.css`; all
game logic in `game.js`. Rough order of `game.js`, top to bottom:

1. **Constants** — `SEASONS`, `DAYS_PER_SEASON` (16), `DAY_MS` (20s real time
   per garden day), `GW`/`GH` (plot size in tiles — per-garden, set by
   `setWorldSize()` from the plot screen or save; 31x31 classic default),
   `SPAWNX`/`SPAWNY` (plot center, where players start), tile dimensions,
   `TILE_IN` (18 — real-world inches per tile side; `ftToTiles()` converts,
   so 1 tile = 1.5 ft), `HOUSE_SIZES`/`WALL_COLS`/`ROOF_COLS` (house chips).
2. **`AMBIENCE`** — per-season sky gradient, grass/soil tones, light tint, snow
   flag. This is what makes the world *look* like each season.
3. **`PLANTS`** — in `plants.js`, the data model for every species (see
   below). The heart of the game's Oudolf character.
4. **`COATS`** — cat/dog coat color pairs (base + shadow).
5. **`mulberry(seed)`** — tiny seeded RNG. Used so each plant clump looks unique
   but renders identically every frame. Never use `Math.random()` for anything
   that must be stable across frames — derive a seed and use `mulberry`.
6. **`drawPlant(ctx, x, y, key, growth, season, seed, sway, variant,
   bloomLvl)`** — procedural renderer. Resolves `plantDef(key, variant)`
   (cultivar overrides merged over the species, cached) and branches on its
   `form` (`bunchgrass`,
   `vertgrass`, `turkeyfoot`, `cloudgrass`, `oatgrass`, `cone`, `globe`,
   `spike`, `shrub` herbaceous mound, `fern`, `leafmound` hosta, `bush`
   woody shrub, `hydrangea` (`look.bloomShape` 'mop'|'lacecap'|'panicle';
   grouped in the tray by flower type — mophead/lacecap/panicle/oakleaf —
   not by species), `tree` deciduous, `conifer`). Reads the season's `fol`/`bloom`/`seed`/`eye` colors; woody
   forms draw trunk/twigs every season and leaf out only when `fol` is
   present (redbud blooms on bare branches: `bloom` without `fol`). Bloom
   staggering: `bloomLevel(key)` rises/peaks/fades across the 16-day season
   (cool species peak ~day 5, mid ~8, warm ~11, per-species jitter); the
   flower pass thins to that fraction of stems. Tray icons/previews pass
   `bloomLvl=1` to force full bloom. Adds snow caps when
   `AMBIENCE[season].snow`.
7. **`drawCritter(...)`** — round-bodied cat/dog avatar, with walk bob, tail,
   ears that differ by species, and tuxedo/patch markings.
8. **`game`** — the single mutable state object (mode, player position,
   plants map, `bulbs` map — a second layer sharing tiles with plants —
   `terrain`, `houses`, `fences`, tool, multiplayer presence, timing).
9. **Time helpers + phenology** — `absDay()`, `calClock()`
   (day/season/year/frac). Drawn plant size = `plantGrowth(p)` =
   `plantEstab(p)` (0..1 over 10 *growing* days — `growingDays()` skips
   winter, so winter planting waits for spring) × `seasonEnvelope(key)`
   (the perennial year: cut back to 0.12 at spring day 1, regrow on the
   species' `phen` schedule — cool wakes day 0/full day 14, mid 4/24,
   warm 7/28 — full through fall, winter holds full-size dead structure).
   Woody plants (`type` shrub/tree) skip the envelope entirely — no spring
   cutback — and establish over `grow` *years* of growing days instead of
   10 days. Bulbs (`type` bulb) use `bulbEnvelope()`: up at spring day 0,
   full by day 1.5, yellowing away by day 15, underground (growth 0,
   render-culled) the rest of the year; `bloomDay` sequences their bloom
   (crocus 1 → camassia 9) and overrides the phen center in `bloomLevel`. `canopyRadius()`/`shadeAt()`: trees shade `spread/TILE_IN/2`
   tiles (scaled by establishment); planting there is refused unless the
   plant is `sun:'part'`. The plant card reports establishment, not
   seasonal size.
9b. **Propagation (Story-mode only)** — the seed→plant loop, built on the
    same day clock. State: `game.seeds`/`game.stock` (species→count maps of
    held seed and grown plugs), `game.flats` (sown trays `{s,sown,strat,grow}`),
    `game.plantFromStock` (a plug is armed; the next placement spends one).
    Pure, headless-testable timing (take an explicit `now`): `germDay()`
    (cold-strat seed crosses one Winter→Spring boundary — `nextSpringStart` —
    before it sprouts; `double` needs two; `none` germinates at sow),
    `growthDayAfter()` (grow out `growOut` *growing* days, winter skipped),
    `flatStage()` → `stratifying`|`growing`|`ready`. Inventory wrappers
    (`sowSeed`/`harvestReadyFlats`/`useStock`/`giveStarterSeeds`) read
    `absDay()`/`game`. New optional `PLANTS` fields drive it: `strat`
    (none|cold|double, default warm-grass→none else cold), `growOut`,
    `spreads` (clump|seed|run — for later tending), `seedSeason`, `wild`.
    The **Potting bench** UI (`#pottingScreen`, `openPotting`/`renderPotting`/
    `pottingClick`; ☰ menu, Story only) is the view over this state: sow,
    watch flats stratify/grow, collect plugs, arm one to plant. Planting from
    stock is **additive** — `applyToolAt` only gates on `stockCount` when
    `plantFromStock` is set, so normal free-planting is untouched; `setTool`
    clears the flag. A starter seed packet is auto-granted once per story
    garden (`propSeeded`), the stub for the eventual NPC giver. Seeds/flats/
    stock persist in the solo save blob. Full design: `docs/story-mode-design.md`.
10. **Iso math + view rotation + world layout** — `isoX/isoY`; the camera
    looks at VIEW space: `worldToView`/`viewToWorld`/`viewDirToWorld` rotate
    world<->view per `game.rot` (90° steps, R key / ⟳ button; `rotateView()`
    snaps the camera). `screenOf` (world->screen via view), `viewScreen`
    (view->screen), `viewDepth` (depth-sort key), `tileAt` (screen->world).
    World logic never rotates — only the mapping. `rotateView(dir)` also
    fires from a two-finger twist (~40° per 90° step, alongside pinch-zoom).
    `safeSpawn()` returns a standable tile near plot center (door, else a
    spiral search) so re-entering a garden never drops the player stuck
    inside the house. `seedWalkway()` lays the
    starter walkway as ordinary path terrain at world creation (so the
    shovel can remove it like anything player-laid; saves without `wv` get
    it seeded once on load). Houses live in `game.houses` — an array, so a
    garden can hold any number (each `{x,y,w,h,wall,roof,sizeFt}`, sized in
    real feet via `HOUSE_SIZES`). `houseAt(x,y)` finds the house on a tile;
    `inHouse`/`isDoor`/`canStand` iterate the array; `doorPos(h)` takes a
    specific house (door tile centered on its south side). The House tab's
    size/wall/roof chips edit `game.houseDraft` — the settings the **Place**
    tool stamps the next house with; placing adds a house (overlaps with
    another house or the avatar are refused), and the **Erase** tool on the
    *landscape* layer removes any house it sweeps (`eraseBrush`). Existing
    houses are recoloured/resized by erasing and re-placing.
    `defaultHouse()`/`defaultDraft()` pick a shed on small plots, a cottage
    on big ones; legacy single-house saves (`house`) migrate to the array.
    `tileTerrain()` reads player-laid terrain from `game.terrain`.
    Fences live in `game.fences` as tile structures (`{style,height,gate}`):
    normal fence tiles block movement, gate tiles are walkable, and adjacent
    fence/gate tiles visually connect.
11. **`render(t)`** — sky, then a camera-windowed pass: the four screen
    corners invert (via `tileAt`) to a padded world-tile bounding box, and
    only those tiles/entities draw. The ground (grass / walkway / laid path /
    bed / flagstone doorstep) was the whole frame cost — 961 tiles of
    fills/strokes/blades redrawn every frame — so it's now **cached**:
    `paintGround` renders it once to an offscreen `groundCanvas`, blitted each
    frame, rebuilt only when the cache key changes (season / rot / zoom / cam /
    canvas size / landscape-layer vis + `groundDataSig()`, a cheap signature of
    the sparse terrain/elevation/house data). Empty-garden ground dropped
    ~12ms → ~0.35ms. Water ripples freeze only while the view is perfectly
    still (no `t` in the key); any pan/edit resumes them. A perf **debug HUD**
    (`dbg`, toggled by backtick or `?debug`, zero-cost off) shows FPS + a
    ground/plants frame-time breakdown. Ground drawn back-to-front, a single
    depth-sorted entity
    pass for the cottage + plants + critters (`houseDrawDepth()` anchors the
    cottage at the doorstep/front center, not the far corner, so nearby
    players/plants draw in front of large houses), planting
    pulse fx (`game.fx`), season tint, snowfall, and — when `game.photo` is
    set — a golden-hour wash for `takePhoto()` (renders one washed frame,
    downloads the canvas PNG; the DOM HUD is excluded automatically).
    Full-sun plants under a tree canopy render stunted (growth × 0.45,
    `shadeTrees` precomputed per frame); the plant card says "Struggling".
    Small screens render at `ZOOM` 0.75 (~1.3x more world); all pointer
    math divides by it (`evTile`). Cost scales with screen size, not `GRID`.
12. **Movement / actions** — `tryMove`/`stepMove` (tile-to-tile lerp; diagonal
    steps take longer), `actHere` (sleep at door, lay/lift terrain, plant or
    lift on current tile), `placeHouse`/`applyHouseSize`/`paintHouse` (the
    House tool: hover draws an RTS-style ghost — tinted footprint, red when
    the player stands in it, translucent house via `drawHouse` override —
    and click/tap places; placing or resizing onto planted tiles
    `displacePlants()` them with a count in the toast; drifts also skip
    the door tile; chips resize/repaint), the left **canvas toolbar**
    (`buildCanvasTools`, the paint/edit tools only: Hand / Plant / Erase /
    **Pick**, a divider, then **Undo** / **Redo** as one-shot actions —
    `makeCanvasTool` greys each via `disabled:!undoStack.length` when its stack
    is empty, recomputed every rebuild; `updateUndoBtn` just calls
    `refreshCanvasTools`. The non-painting view/select tools — **Select**,
    Rotate, **Layers** — live in the top bar beside the season dial instead
    (`syncTopTools` keeps their icons/state in sync; Fill moved into the Select
    tray). `game.tool` uses `'hand'` for safe panning and keeps `'shovel'` for
    Erase back-compat; the mobile rail shrinks the icons/rows so all clear the
    bottom tray) and
    Erase **drag-sweep**
    (pointerdown starts a sweep; tap or drag both run `eraseBrush(cx,cy)`,
    a centered square brush of `game.eraseSize` tiles — 1/3/5 — that clears
    the layers `game.eraseMode` selects: `all` wipes plant+bulb+landscape on
    each tile in one pass, or `plant`/`bulb`/`terrain` (Landscape) only; one toast +
    per-layer sync at pointerup via `endSweep`), tap and keyboard input.
    The top-bar **Layers** button opens a flyout (`buildLayerPopover` builds
    it, `renderLayerMenu` pins it as a `position:fixed` dropdown under the
    button — measured from its rect like the garden/time menus — and rebuilds
    it in place on `refreshCanvasTools`; `toggleLayerMenu` flips
    `game.toolMenu`) over
    `game.layerVis` and `game.layerFocus` — a *Visible* section (All,
    Perennials, Bulbs, Woody Plants, Landscape/Hardscape), an *Edit* section
    (which layer is currently editable, or All), and an *Overlays* section
    (Shade Overlay, stored as the `shade` flag). Each whole visible row
    toggles its layer; the row mutes (`.off`) when hidden and stays put so it
    can be turned back on. `render` skips hidden layers (`layerShown`:
    landscape gates terrain+doorstep+houses+fences, bulbs gate the bulb pass,
    perennials/woody split plants via `plantLayerOf`); the shade overlay
    washes every tile by canopy reach (amber full sun → teal part → blue
    shade). `eraseBrush` only clears layers that are visible and allowed by
    edit focus (`layerEditable`/`layerShown`), so hidden and unfocused layers
    are protected. **Drawing onto a hidden layer is intercepted**: the
    pointerdown placement guard checks `toolTargetLayer(game.tool)` and, if
    that layer is hidden, calls `promptRevealLayer` — a `showConfirm` modal
    ("Show the *Bulbs* layer?") that, on confirm, reveals the layer and
    plants the held tile via `withUndo`; Cancel places nothing.
    `showConfirm(title,body,okLabel,onOk)` builds a themed `.screen` panel
    (`#confirmPop`) on the fly; the key handler treats it like the other
    overlays (Escape closes, game keys ignored).
    The **Select** tool (`game.tool==='select'`) marquee-selects a tile
    region: pointerdown outside the current selection starts a `selDrag`
    rectangle; release commits it to `game.sel` ({x0,y0,x1,y1}, inclusive).
    Pointerdown *inside* the selection starts a `selMove` drag whose intent
    (`game.selMode` 'move'|'copy') is set by the bottom tray. The bottom
    contextual tray (`renderSelectTray`, same slot as the Erase options)
    shows **Move / Duplicate** (mode toggles) and **Rotate / Erase**
    (one-shot actions). On commit the marquee snapshots its contents once
    into `game.selItems` (via `selectionPayload`, plants/bulbs/terrain/fences); every
    op then works on those **owned** items — so a plant that later lands
    inside the rect is never scooped up. `commitSelectionOffset(dx,dy,copy)`
    moves/copies (read-all → clear-source → write-dest, so overlaps are
    safe) and updates the items' coords; `rotateSelection` spins them 90° CW
    about the rect center, `eraseSelection` deletes them — each wrapped in
    `withUndo` for a single undo step. Moves/rotations
    are refused if any destination fails `selValidDest` (off-plot or into the
    house/door). `drawSelectionOverlay` (called near the end of `render`)
    draws the marquee, the resting selection (blue fill + outline), and the
    move/copy ghost (destination diamonds tinted green/red for valid/invalid
    plus translucent plant ghosts via `drawPlant`). Escape cancels an
    in-progress move, then the selection; switching tools drops it.
    All placement funnels
    through `applyToolAt(x,y)` (silent; handles plant/bulb/path/bed/water/fence rules —
    bulbs tuck under perennials but are refused under trees/shrubs (and a
    newly planted tree/shrub clears any bulb already there), plants check
    `shadeAt`; shrubs reserve a mature spread footprint from `spread`/`TILE_IN`
    (paths, water, fences, bulbs, and perennials refuse that ground; compatible
    clipped hedge shrubs can still connect edge-to-edge). The reserved shrub
    footprint is also a visual affordance: a faint base under each shrub, a
    stronger outline when hovered or when its plant card is open, and a brief
    red pulse when it blocks placement. Paths refuse planted tiles, beds store
    a material `c` (`soil`/`gravel`/`rock`/`leaf`/`mulch`) and can be repainted
    like path colors, and fences refuse planted/water/house tiles). **Drag-to-plant**: pointerdown with a
    plant/bulb/path/bed/water/fence armed defers; crossing a tile line turns the
    gesture into a paint-drag that applies the tool to every tile crossed
    (one toast + sync at pointerup via `finishToolDrag`), while a plain
    tap resolves at pointerup to the classic walk/act (`tapAction`). With
    the Drift toggle on, single planting calls `stampDrift()` — a loose
    shuffled cluster sized by spacing (`driftCount`: ≤6" → 9, ≤12" → 7,
    ≤18" → 5, ≤30" → 3); woody plants always plant singly. The **Fill** tool
    (`game.fillMode`, a mode layered over the armed brush — the bottom
    catalog still picks what you fill WITH) bucket-fills: a tap runs
    `doFloodFill`, which BFS-floods the 4-connected region sharing the
    tapped tile's ground material (`groundMat`: grass/path/bed/water) and
    applies the armed brush to every tile via `applyToolAt`, wrapped in one
    `withUndo`. `armFillTool` arms a brush + sets the flag; `fillActive()`
    gates it (`fillMode && isBrushTool && tool!=='house' && tool!=='fence'`);
    the Plant rail
    button clears the flag. The **Pick** and **Erase** tools see the mature
    shrub footprint, so sampling or erasing the visible edge of a large shrub
    acts on the shrub's center tile. The **Pick** tool (`game.tool==='pick'`,
    eyedropper) samples the tapped tile via `pickAt` — plant > bulb > fence >
    terrain priority — arms that species/material/structure as the brush
    (copying path colour, bed material, water style, or fence material/height/gate mode and
    switching `trayCat`), then drops into plain Plant/Structures mode so the
    next tap paints with it. The Erase tool's
    options live in the bottom contextual toolbar when Erase is active:
    layer (All/Plants/Bulbs/Landscape → `eraseMode`; Landscape includes
    terrain, houses, and fences) and size
    (1/3×3/5×5 → `eraseSize`). **Keys map to SCREEN directions**
    regardless of rotation: one key is a screen-cardinal step (a view
    diagonal); two keys combine into view axes; `viewDirToWorld` converts to
    world steps. Tapping the house walks to the door and sleeps on arrival.
13. **Storage / multiplayer** — `sGet`/`sSet` over localStorage. Solo worlds
    are named slots: `hortus:worlds` is the index `[{id,name,ts,gw,gh}]`,
    each save lives at `hortus:world:<id>` (plants + bulbs + terrain + fences +
    gw/gh + rot + houses + name + `wv` walkway flag + current path/bed/water
    material choices and fence draft + Story propagation seeds/flats/stock/
    propSeeded). The old single `hortus:solo` key
    migrates into the first slot once. Older saves with only `grid` load
    square; 13x13-era saves recenter from (6,6). Autosave on day change is
    silent; the Save button toasts. Host/join shared worlds via shared keys
    (meta carries gw/gh; the house syncs via its own key, last-write-wins
    by timestamp), presence polling, `mergeMap` for plants, bulbs, terrain,
    and fences.
14. **Export / planting list** — `exportRows()` tallies planted tiles per
    species (plants + bulbs) and converts to real quantities
    (`ceil(tiles × TILE_IN² / space²)`) plus bed area; `openExport()` renders
    the overlay table, `exportCsv()` downloads it. Print CSS in `styles.css`
    strips everything but the sheet.
14b. **Planting plan** — `openPlan()` draws an Oudolf-style top-down drift
    map to `#planCanvas`. `planComponents()` flood-fills contiguous
    same-species/cultivar tiles (8-connectivity) into drifts;
    `traceOutlines()` walks each drift's 4-connectivity boundary into loops
    (collinear runs merged), `buildPlanMap()` smooths them into organic
    blobs (quadratic midpoint spline + `planJitter` lattice wobble) tinted
    from `planColor`. Trees → dashed mature-canopy circles + trunk dot;
    bulbs → scatter rings; house, fences/gates, paths/beds, title block, north arrow,
    legend with `planCodes` (unique genus/epithet abbreviations + cultivar
    tag), and a 10-ft scale bar. `downloadPlan()` saves a 2× PNG; the plan
    also prints (own page). Empty gardens render an empty sheet, no crash.
15. **Region filter + HUD** — `plantFits()` (zone range, natives-only,
    ecoregion membership for natives; cultivars have `eco:[]` so only the
    natives-only switch hides them), `trayKeys()` (filtered, grasses → sedges
    → forbs), the region-picker overlay wiring, and the tool tray:
    a two-tier `TRAY_CATS`/`TRAY_GROUPS` tab row — a top-level **Plants** /
    **Build** toggle picks which category sub-tabs show (Plants → Grasses /
    Sedges / Sun Perennials / Shade Perennials (`sunFilter`) / Bulbs / Water
    Plants / Shrubs / Trees; Build → Landscape / Structures / Lighting /
    House); `lastCatByGroup` remembers the sub-tab per group. Then species
    buttons in the active category (species sharing a `group` collapse to one
    button, marked with a `›`). Sub-species **drill in**: tapping a grouped
    species or one with cultivars opens its members/cultivars in the catalog
    row behind a ‹ Back chip (`renderDrillIn`, `game.drill`); the old
    always-on cultivar row is retired — `renderCvRow` now just hides `#cvRow`
    and is the hook that refreshes the brush bar + collapse sheet. The planted
    tile stores `v`; tool state is `game.tool` + `game.toolVar`. The Landscape
    tab is contextual: select Path to reveal path colors, Bed to reveal bed
    materials (soil, gravel, river rock, leaf litter, bark mulch), or Water
    to reveal pond/river/lake styles. The Structures tab draws fences and
    gates from `game.fenceDraft` with 4 ft/6 ft heights
    and Black Aluminum/Wood/Vinyl/Chainlink/Brick materials, plus **fire
    pits** from `game.firepitDraft` (Round/Square shape + size — round
    24/36/48 in, square 36 in or 24x48 in — `FIREPIT_SIZES`/`firepitTileSize`;
    drill in for shape/size like a grouped species). Fire pits live in
    `game.firepits` keyed by origin tile (`{shape,size,t}` or `{removed:true}`),
    reserve a mature footprint via `firepitFootprint`/`canPlaceFirepit`
    (refused under house/door/water/plants/bulbs/fences/lights/shrubs and the
    Story-mode avatar), block movement (`canStand`/`firepitAt`), and render
    through `drawFirepit` (stone rim + coals + flames, snow cap in winter).
    They erase as Landscape, move/rotate/copy in selections, eyedrop with
    Pick, and sync via `syncFirepitsOut` — all parallel to lights. The House tab
    is its own icon tray: Place tool + size/wall/roof buttons in labeled
    sections (`.tray-sep`, now a horizontal small-caps label, not rotated).
    The left canvas toolbar owns the paint/edit tools (Hand/Plant/Erase/Pick)
    plus Undo/Redo below a divider; the view/select tools (Select/Rotate/Layers)
    sit in the top bar beside the season dial, and Fill lives in the Select
    tray. Plant
    arms the last drawable brush (plant, path, bed, or water; house/fence do
    not overwrite that memory); its two style toggles — Draw/Drift and
    Grid/Free — dock in the palette as the `#brushBar` segmented controls
    (`renderBrushBar`), not a floating flyout. New garden entries start on
    Hand so accidental painting is harder. Search is a magnifier **toggle** in
    the tabs row (`game.searchOpen`): tapping it swaps the sub-tabs for a search
    field (so it never adds a wrapping row) that filters the open category by
    name/latin/group (`applyTraySearch`, display:none — no rebuild, so typing
    keeps focus; inputs are excluded from game keys). Because the field *takes
    the categories' place*, the toggle glyph flips from `🔍` to a bold **✕**
    while open (`.tab-search.close`, title "Close search — back to categories")
    so the way back is obvious; tapping it or pressing **Escape** in the field
    restores the sub-tabs.
    The top bar is **one connected glassy bar** (`.hud-top` carries the glass;
    the clusters sit transparent on it), **flush to the top edge, full-width**
    (`top:0;left:0;right:0`, square, `border-bottom` only). It pads with
    `max(6px,env(safe-area-inset-top))` so on a notched phone the glass bleeds
    up *behind* the iOS status bar (`apple-mobile-web-app-status-bar-style`
    is `black-translucent`) while the content ducks below the notch — this is
    why the viewport meta carries `viewport-fit=cover` (without it the insets
    resolve to 0 and nothing bleeds/clears). Left = the
    **season dial**: a `☀`/`☾` day/night toggle (`#btnDayNight`/
    `updateDayNightBtn`, promoted out of the Layers menu — it flips
    `layerVis.night` to relight the world and switch lighting on) next to the
    **season box** (`#btnSeasonBox`): a label (season name + early/mid/late
    phase in design, season + Year/Day in story) whose interior `#seasonFill`
    fills left-to-right with the season's progress, tinted by `SEASON_FILL`
    (Spring easter green, Summer dark green, Fall the bronze, Winter a darker
    blue) — this replaced the old thin progress line and the Advance/Pause
    buttons. **Hold** the box to fast-forward time (`game.ffActive`; the loop
    adds `FF_RATE` game-ms per real-ms, ~2 garden days/sec); a short **tap**
    opens the time menu (`openPause` → `#pauseScreen`), now a **dropdown** that
    `openPause` pins just under the season box (`position:fixed`, JS-set
    `top`/`left`; click the backdrop to dismiss — same mechanism as
    `#gardenMenu`), whose primary button is now a Pause/Resume toggle. After the
    box sit the three **view tools** — Select, Rotate, Layers
    (`#btnSelectTool`/`#btnRotateTool`/`#btnLayersTool`, the non-painting tools,
    kept in sync by `syncTopTools`); the season box `flex-shrink`s (explicit
    `width` + lower `min-width`, not `flex-basis` — a content-sized parent
    ignores the basis) so the box + tools + ☰ all fit a 360px phone, with a
    `≤359px` query tightening gaps/buttons for legacy widths. Right =
    the **action bar**
    (`#actionBar`): just a `☰` Menu now (Undo/Redo moved down to the canvas
    rail). The Menu opens `#gardenMenu` — the planting list,
    region filter (shows the active filter), photo, planting plan, and Save &
    quit — so the infrequent outputs sit one tap behind `☰` rather than a
    permanent row. `#gardenMenu` is a compact **dropdown**, not a centered
    modal: `openGardenMenu()` measures the action bar's rect and pins the panel
    just under the `☰`, right-aligned to it (`position:fixed`, JS-set
    `top`/`right`); clicking the transparent backdrop dismisses it. So it drops
    from the corner over the still-visible garden instead of covering the
    screen. In **design** mode the readout drops the meaningless
    Year/Day (a day is 20s real time) for the season + early/mid/late phase
    (`clockMeta`/`seasonPhase`) and an **Advance** button; **story** mode keeps
    the full calendar + End Day. On phones the whole palette collapses: a
    `#sheetHandle` folds the catalog away while you paint (`applySheetState`,
    `game.sheetCollapsed`), leaving the brush bar + a context label + a swatch
    of the armed plant (`drawSheetSwatch`); the mobile palette is full-bleed
    (edge-to-edge, square corners, docked to `bottom:0` with
    `padding-bottom:calc(6px + env(safe-area-inset-bottom))` so the catalog
    clears the home indicator while the tray background runs to the screen
    edge behind it). On desktop/iPad `.hud-bottom` stays a
    **floating centered tray** (`bottom:max(10px,env(safe-area-inset-bottom))`,
    so it lifts above an iPad's home bar too). **Canvas full-bleed under
    `viewport-fit=cover`:** an iOS standalone PWA with `black-translucent` has a
    short *fixed* layout viewport (e.g. 812 on a 874 screen, screen minus the
    top inset), and iOS clips every `position:fixed` layer to it — so a
    full-height fixed canvas still left the bottom safe-area strip showing the
    propagated root `--viewport-fill` background. The root bg *does* paint the
    whole screen, so the fix is to paint the canvas + HUD as **document
    content, not fixed layers**: `html,body` get `min-height:100lvh`
    (the full screen) + `position:relative`, and `#gameCanvas`/`#menuCanvas`/
    `#hud` are `position:absolute` inside that full-height body. `sizeCanvas()`
    still forces the canvas box to `trueViewH()` = `max(innerHeight,100vh,100lvh)`
    (the largest ruler; `innerHeight`/`100%`/`100dvh` report the short height)
    and derives the buffer + `VW`/`VH` (used by `render`, `evPlacement`,
    `snapCam`, `menuRender` in place of `innerWidth/innerHeight`) from it — so
    the garden fills the screen and clicks stay true. `setViewportFill()` still
    matches the root bg to the season as a belt-and-suspenders. A `?debug`/`?vp`
    URL or a **3-finger tap** shows a viewport diagnostics panel. The chrome
    panels are glassy (`backdrop-filter` blur). There is no Save
    button — autosave fires on day change, quit, and visibilitychange/pagehide.
    Pausing/resuming (now the time menu's primary toggle) freezes or resumes day
    progression without blocking editing; the menu (opened by tapping the season
    box) also offers Skip to next season/year; season skip shows a confirmation
    using the real next season. Zoom: `ZOOM = baseZoom (0.75 on phones) ×
    userZoom`, driven by pinch (two-pointer tracking in the canvas
    handlers), mouse wheel, and +/- keys;
    `setUserZoom` clamps and snaps the camera. On phones (`baseZoom<1`) a
    big contextual action button (`setActButton`: Plant here / Plant a
    drift / Erase here / Lay path / Dig bed / End Day; hidden for the House
    tool) calls `actHere()` and replaces the instructional hint. The plant
    card sits top-right with an ✕ (`showPlantCard(p,x,y)` adds a shade
    warning when coords are given). The region choice persists as
    `hortus:region`.
16. **Screens** — menu, worlds list (`#worldsScreen`: continue/delete saved
    gardens or start new; Solo goes here when saves exist), multiplayer
    lobby, character creator (with live preview), code display, plot setup
    (`#plotScreen`, new solo gardens: name + acre presets or width x length
    in feet). Plain DOM, toggled by `show()`. The planting-list
    (`#exportScreen`), region (`#regionScreen`), and plan (`#planScreen`)
    overlays sit outside `show()` — in-game overlays toggled directly; the
    keyboard handler ignores game keys while one is open (Escape closes).
17. **Menu meadow + main loop** — animated title background, then `loop(t)`.
    Garden time uses accumulated open-play milliseconds (`elapsedMs`) instead
    of raw wall-clock time since creation. `suspendClock()` banks elapsed time
    before hidden/pagehide saves, and `resumeClockSession()` restarts the session
    timer when the app is visible again, so days/years do not advance while the
    app is closed.

## The plant data model

Each entry in `PLANTS` (in `plants.js`) is the contract the game renders and
plans against:

```js
key: {
  name: 'Little Bluestem',
  latin: 'Schizachyrium scoparium',
  form: 'bunchgrass',          // drives the drawing branch
  type: 'grass',               // grass | sedge | forb — tray grouping
  h: 46,                       // mature height in px
  space: 18,                   // on-center planting distance, inches
  spread: 18,                  // mature clump width, inches
  zones: [3,9],                // USDA hardiness range
  native: true,                // straight species native to the central US?
  eco: ['Flint Hills', ...],   // EPA Level III ecoregions; [] for non-natives
  sun: 'full',                 // full | part
  moist: 'dry',                // dry | medium | moist
  phen: 'warm',                // cool | mid | warm — spring wake order
  strat: 'cold',               // Story seed-start: none | cold | double (opt)
  spreads: 'clump',            // Story spread: clump | seed | run (opt)
  grow: 10,                    // woody only: years to mature size
  cw: 150,                     // woody only: canopy/twig width in px
  cv: { theblues: {...} },     // optional cultivars (see plants.js header)
  group: 'coneflower',         // optional: species sharing a group collapse
  chip: 'Pale Purple',         //   to one tray button; chips pick the species
  look: { rays:7, droop:6 },   // optional cone-form carriage (see plants.js)
  stem: '#3a3038',             // optional stem color override (salvia)
  blurb: '...',                // shown on the plant info card
  sea: {                       // per-season appearance
    Spring: { fol:'#7fa07a' },                 // foliage color
    Summer: { fol:'#6e8f9b' },
    Fall:   { fol:'#c0623b', seed:'#efe6d3' },  // seed = persistent seedhead
    Winter: { fol:'#a35a35', seed:'#f3ecdd' },
  }
}
```

`drawPlant` uses `form`/`h`/`sea`/`stem`; the rest feeds the planner features
(export sheet, region filter, plant card). Per-season keys: `fol` (foliage),
`bloom` (flower this season, omit for none), `seed` (seedhead/structure —
present in fall/winter is what makes it Oudolf), `eye` (cone center,
coneflowers only). `plants.js` also holds `REGIONS`, the curated ecoregion
list the region picker offers (name + default zone + blurb).

**To add a species:** add an entry in `plants.js`, reuse an existing `form` or
add a new branch in `drawPlant`. It automatically appears in the tool tray
(built from `PLANT_KEYS`). Match real botany — Kevin grows these; accuracy
matters more than prettiness, and that includes spacing/zone/ecoregion data.
Winter must show *structure*, not bare ground; that's the whole point.

## Conventions

- Vanilla JS, no framework, no bundler. Keep it that way unless explicitly asked.
- All rendering is canvas 2D. Colors flow from `AMBIENCE` and `PLANTS`, not
  hardcoded in draw functions — change the palette in data, not in code.
- Stable visuals use `mulberry(seed)`, never `Math.random()`. Tile seed is
  `tileSeed(x,y)`.
- Respect `prefers-reduced-motion` (already handled in CSS).
- Copy style: plain, gardener-facing, a little dry. Errors/empty states give
  direction, not mood. (e.g. "Nothing here to lift." not "Oops!")

## Feature backlog (v2 ideas, not yet built)

Woody follow-up still open: tree canopies rendering across tile boundaries
with their own depth slices. The big one: a real multiplayer backend
(reimplement `sGet`/`sSet` against a small server — see Known constraints).

- **Matrix/scatter mode** — interplant a grass matrix with scattered perennials.
- **Plant health / water** — establishment can fail; watering during dry spells.
- **More species** — prairie clover (Dalea purpurea), golden alexanders
  (Zizia aurea — can reuse the `umbel` form now), more bulbs.
- **Procreate-style editing tools** (planned, not yet built — design mode):
  - **Pencil** — freehand draw a single layer (already mostly covered by
    drag-to-paint; the idea is a dedicated stroke tool).
  - *(Built)* **Bucket fill** — the **Fill** tool floods the connected
    region of one ground material with the armed brush (plant or landscape);
    see `doFloodFill` in the canvas-toolbar notes above.
  - *(Built)* **Eyedropper** — the **Pick** tool samples a tile's plant or
    material onto the brush (`pickAt`); see the canvas-toolbar notes above.
  - *(Built)* **Selection tool** — marquee a region to move, duplicate,
    rotate, or erase the plants/terrain inside it (see the Select tool in the
    canvas-toolbar notes above). Resize-in-place is still open.
