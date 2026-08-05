# Pocket Prairie Garden Design

A 2.5D perennial-gardening game in the spirit of Piet Oudolf's naturalistic
planting style. **Design a Garden** is the core: a serious planner — no avatar,
no movement, a free pan/pinch/twist camera and direct tap-to-place/drag-to-paint
à la Procreate; no house at start; created via a chip-based questionnaire of
climate (zone chips, or a ZIP→zone / plain-language winter-cold picker behind a
"don't know your zone?" flip)/style/natives/deer/rabbit, with a live palette
count. The menu has four entries: Design a Garden,
**Daily design challenge** (a date-seeded planting prompt — prompt-only, no
scoring — that drops you into Design mode; `DAILY_CHALLENGES` /
`todaysChallenge` / `openDaily`, shown via the `#dailyScreen` panel, carried in
as `game.challenge` and toasted on entry, cleared whenever the main menu shows),
**Plant Library** (browse every species: list + seasonal images + facts +
cultivars), and **View Gardens** (open/manage saved gardens; each row also
offers a read-only **Visit** that strolls the garden as a cat/dog avatar — Visit
is shown only here, not in the Design-a-Garden flow). A dev-only
**Plant Creator** (`plant-creator.html`, opened directly, not linked from the
game) loads the real `plants.js` + game modules to author `PLANTS` entries with
a live `drawPlant` preview.

`game.gameMode` is `'design'` | `'story'`, saved per garden and on the world
index entry. **Design is the only mode you can start** — the old avatar **Story
Mode** was retired from the menu, and the story-creation / character-creator
paths (`startNewGarden('story')` / `openCreator`) are now unreachable from the
UI. The `'story'` value survives for exactly two things: the read-only **Visit**
feature (`visitWorld` forces `gameMode='story'` + `game.visiting`, so the
avatar/movement/camera all work while editing chrome is hidden and saves are
no-ops) and **legacy story saves** (older saves with no `mode` load as story).
Design vs story branches live in `enterGarden`, `render` (avatar + camera easing
skipped for design), the loop (movement skipped), `tapAction` (design taps route
straight to `actHere` on the tapped tile), the two-finger pointer handler (adds
camera pan in design), `setUserZoom`/snapCam (design keeps its free camera), and
the `btnPlotStart`/save/load plumbing (design = blank plot, `houses:[]`,
`buildings:[]`).
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

The game is plain HTML/CSS/JS — `index.html` (markup) and `styles.css` at the
repo root, and all the JavaScript under `js/`: `plants.js` (species data) plus
the game logic, split for navigability across ordered app modules: `core.js`,
`draw.js`, `world.js`, `view.js`, `renderer.js`, `commands.js`, `input.js`,
`io.js`, `collections.js`, `ui.js`, `tray.js`, `library.js`, `screens.js` — with no build step,
no npm dependencies, no framework. Fonts load from Google Fonts over the
network; everything else is local. The modules share one global scope (plain
`<script>` tags, no bundler), so **load order matters**: `index.html` loads
`js/plants.js` first, then the modules in the order above — keep that order. Function declarations hoist only *within* a
file, so the bottom-of-file button wiring and `init` live in `screens.js` (last,
after everything is defined), and no earlier module may *call* a later module's
function at load time (cross-file calls inside function bodies are fine — they
run after every script has loaded). Each module begins with `'use strict';`
(it's per-script). `git`-blame note: these were one `game.js` until the
mid-2026 split — a clean cut, no logic moved.

**Planting schemes** (`SCHEME_LAYERS`, world.js) let one garden hold several
plantings over a single shared site plan. A scheme owns only `plants` + `bulbs`;
every other layer in `GAME_LAYERS` — terrain, elevation, fences, lights,
firepits, boulders, houses, buildings — plus `game.underlay` is shared and
stored once. Terrain is deliberately NOT per-scheme: it would invalidate the
ground bake and `terrainLoopCache` on every comparison, and keeping it shared is
what makes a switch cost one `buildScene()` (measured 8.6ms vs 9.1ms for a
single plant edit on a 549-plant stress garden; a terrain edit is 101ms).
See §13a.

## Run / test

- Open `index.html` in a browser, or serve the folder to avoid file:// quirks:
  `npx http-server -c-1` (this machine has Node but no Python). The preview panel
  runs the same server via `.claude/launch.json`, which uses `autoPort` (the
  harness assigns a free port) rather than a hard-coded `-p`, so it doesn't
  collide with anything already holding 8642.
- Live deployment: GitHub Pages serves `master` as-is at
  <https://kvschin.github.io/PerenialDesignKK/> — every push to `master`
  redeploys automatically (no build step, nothing to configure).
- After edits, run `node --check <module>.js` on the file(s) you touched to
  catch syntax errors before reloading the browser.
- Tests: `node tests/run.js` (or `npm test`) — a zero-dependency runner that
  loads `plants.js` and the app modules (in load order) inside a `vm`
  sandbox with light DOM stubs. `tests/plants.test.js` checks the species data
  contract; `tests/game.test.js` smoke-renders every species and unit-tests the
  pure logic (iso math, flood fill, selection ownership, bulb/woody rules, the
  house array). The modules concatenate into one sandbox script and the DOM
  stubs let them load fully (including the bottom-of-file `init`), so the pure
  functions run headless. The runner concatenates, so it won't catch cross-file
  load-order/hoisting bugs — only the browser will. Add a `test(name,fn)` with
  `assert(...)` to the matching file when you add a feature; the runner exits
  non-zero on any failure.

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

Markup (screens, HUD) is in `index.html`; all styling in `styles.css`; game
logic is split across ordered modules. They map onto the section list below
(which is also the load order, top to bottom):

- **`core.js`** — constants, `AMBIENCE`, `COATS`, device preferences (haptics
  and left-handed mobile layout), shared color helpers such as `mixHex`, the
  path/bed/water/fence/light/firepit/house data tables (each ground material
  carrying its own `texture` grain recipe + `tones` palette, §11a, and its
  `TERRAIN_RANK` — which material is laid on which, §11), and
  `plantDef` (cultivar merge cache, including optional per-season
  `flowerColorFamilies` overrides for catalog discovery).
- **`draw.js`** — §5 `mulberry`, §6 `drawPlant` (+ every form branch), §7
  `drawCritter`, and canvas drawing primitives for houses, fences, lights,
  firepits, plan symbols, and other rendered objects.
- **`world.js`** — §8 the `game` state object, the `GAME_LAYERS` registry +
  `setTile`/`clearTile` mutation helpers, §9 time helpers + phenology, shade
  constants, immutable `DIRS`/`SUN_PATH` plus the per-garden true-north
  transform, house/world data, `cam`, terrain/elevation lookup, collision
  helpers, iso/view math, depth helpers, §11a the ground-material grain
  primitives + `drawGroundTexture`, and §11b the water depth/flow field +
  `drawWaterTexture`.
- **`view.js`** — active canvas sizing, viewport/PWA sizing probes, zoom state,
  active canvas switching, resize handling, and compass/map-edge direction
  updates.
- **`renderer.js`** — `render(t)`, visible-window gathering, ground and plant
  sprite caches, entity sorting, overlays, selection metrics, shade/night/
  season passes, snow, and photo effects.
- **`commands.js`** — movement steps, `actHere`, `applyToolAt`, drift stamping,
  erase, selection mutation, saved-area paste/fill, house/fence/light/firepit
  placement, undo/redo, and toasts.
- **`input.js`** — keyboard and canvas input wiring: pointer/touch/wheel
  handlers, pinch protection, panning, brush drags, shovel sweeps, tap-to-act/
  walk, and `followPath()`.
- **`io.js`** — §13 storage `sGet`/`sSet` + save/load + multiplayer sync,
  §14 export sheet (`exportRows`), §14b design plan (`openPlan`), §14c bloom
  calendar (`openBloomCalendar`).
- **`collections.js`** — versioned device-local Favorites and named plant
  palettes. Collections preserve exact `{s,v}` species/cultivar references and
  remain independent of an individual garden's eligibility rules.
- **`ui.js`** — §15 roles/style scoring, hard garden eligibility
  (`plantFits`/`trayKeys`), discovery predicates over exact references, and the
  HUD readouts.
- **`tray.js`** — the tool tray: category tabs, plant discovery cards,
  palettes, brush bar, drill-in, search,
  and the layer menu (`buildToolTray`). Also the `TOOLS` metadata table +
  `toolMeta(t)` resolver — the source of truth for each tool's
  `{layer,brush,placement,paints,material,apply}` (plant tools resolve by
  `PLANTS[t].type`); `isBrushTool`/`isPlacementTool`/`toolTargetLayer`/
  `fillActive` and the path/bed/water guards all read it instead of re-deriving
  `==='house'||==='fence'||…` chains, and `applyToolAt` dispatches through its
  `apply` hook.
- **`library.js`** — the Plant Library browser (`openLibrary`).
- **`screens.js`** — §16 screens (menu, worlds, creator, plot, design setup),
  the daily challenge, all the button wiring, §17 menu meadow + `loop` + the
  `init` IIFE.

Rough order of the logic, top to bottom (the numbering predates the split):

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
   `spike`, `agave` (symmetric succulent rosette), `ocotillo` (fan of
   red-tipped canes), `shrub` herbaceous mound, `fern`, `leafmound` hosta, `bush`
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
   `terrain`, `houses`, `buildings`, `fences`, tool, multiplayer presence, timing).
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
   (crocus 1 → camassia 9) and overrides the phen center in `bloomLevel`. `canopyRadius()`/`shadeAt()`: trees shade `woodyRadiusTiles(P)`
   tiles, derived from real `spread` inches and scaled by establishment; never
   use `cw` for shade or footprint radius. Planting in active true-establishment
   shade is refused unless the plant is `sun:'part'` (T9 may soften that into a
   warning, but the radius source stays the same). **Display vs rules (woody T1)**: `effectiveEstab(p)`
   is the display lens — real establishment normally, 1 under the design
   "Established" preview — and every establishment-derived *visual* reads it
   (shade washes + stunting, the plan sheet's canopy circles, shrub-footprint
   styling, the card's "Shown at mature size — N% established today" line).
   Placement RULES always read true establishment: `shadeAt` /
   `shadeInfoAt(x,y,future,real=true)` hit a second rules-map slot
   (`ensureShadeMap(real)`; outside the preview the maps coincide and the
   real slot is never built), so toggling the preview never changes what's
   legal — full-sun plants CAN be placed under a preview-mature canopy; they
   render stunted, their card says Struggling, and the hover diamond warns
   amber (red only where placement will actually refuse). `sceneKey` and
   `shadeMapKey` carry the preview flag so shade trees/stunting rebuild on
   toggle. The plant card reports establishment, not seasonal size.
10. **Iso math + view rotation + world layout** — `isoX/isoY`; the camera
    looks at VIEW space: `worldToView`/`viewToWorld`/`viewDirToWorld` rotate
    world<->view per `game.rot` (90° steps, R key / ⟳ button; `rotateView()`
    snaps the camera). `screenOf` (world->screen via view), `viewScreen`
    (view->screen), `viewDepth` (depth-sort key), `tileAt` (screen->world).
    World logic never rotates — only the mapping. `rotateView(dir)` also
    fires from a two-finger twist (~40° per 90° step, alongside pinch-zoom).
    `safeSpawn()` returns a standable tile near plot center (door, else a
    spiral search) so re-entering a garden never drops the player stuck
    inside the house. **Irregular lots**: `game.plotShape` (optional, saved;
    null = full rectangle) is a 4-vertex polygon on the tile-corner lattice
    masking the GW×GH rectangle into the player's real lot. `setPlotShape`
    validates (4 clamped integer verts, non-self-intersecting, ≥9 enclosed
    tiles) and rebuilds the derived `plotMask`; `onPlot(x,y)` is the ONE
    legality predicate every placement/collision/walkability guard funnels
    through (`applyToolAt`, shrub/house/fence/firepit/boulder/building
    placement, `selValidDest`, flood fill, erase, `canStand`). `setWorldSize`
    always clears the shape. Rendering agrees with the mask: `paintGround`
    skips off-lot tiles (void draws nothing — styling deliberately deferred),
    organic terrain edges treat the lot line as HARD (beds butt exactly into
    it), the compass ray-casts the polygon (`rayPolygonExitT`), the plan
    sheet strokes the deeded boundary, and worlds-list thumbnails
    point-in-polygon test the saved blob's own shape (`blobOnPlot`). Cache
    keys ride `plotRev`/`groundRev`/`terrainRev` — nothing new per frame.
    `seedWalkway()` lays the
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
    **Design-site footprints are separate from houses.** `game.buildings` is
    an array of `{id,vertices,status,label,wall,roof,t}` polygons whose
    vertices sit on the tile-corner lattice. `buildingTiles()` derives (and
    WeakMap-caches) their occupied tiles; `buildingAt`/`siteStructureAt` make
    them non-walkable and non-plantable without adding an interior model.
    The Site tray's **Draw footprint** tool collects orthogonal corners, closes
    at the first corner or the on-canvas action, and validates a clear, flat
    site before `commitBuildingFootprint` stores it. Drafts are transient;
    only committed polygons save/sync/undo. Existing vs Proposed changes the
    visual treatment, not collision behavior. The live draft edge uses the
    same dominant-axis orthogonal snap as placement, projects directly onto
    the visible tile-corner lattice, and labels its length in feet. Committed
    footprints render as translucent, per-tile depth slices
    with a strong polygon perimeter: nearby plants can sort in front and plants
    behind remain legible, while the building still clearly defines bed edges.
    Erase removes a whole footprint.
    `tileTerrain()` reads player-laid terrain from `game.terrain`.
    Fences live in `game.fences` as tile structures (`{style,height,gate}`):
    normal fence tiles block movement, gate tiles are walkable, and adjacent
    fence/gate tiles visually connect.
11. **`render(t)`** — sky, then a camera-windowed pass: the four screen
    corners invert (via `tileAt`) to a padded world-tile bounding box, and
    only those tiles/entities draw. The ground (grass / walkway / laid path /
    bed / flagstone doorstep) was the whole frame cost — 961 tiles of
    fills/strokes/blades redrawn every frame — so it's **cached in a
    world-anchored layer**: `paintGround` bakes viewport + a 200-CSS-px margin
    into `groundCanvas`, keyed **without** cam/zoom (season / rot /
    `game.edgeStyle` / canvas size / landscape-layer vis + `groundDataSig()`, a
    cheap signature of the sparse terrain/elevation/house data). The camera is
    a pure screen translation (`viewScreen` subtracts `cam`), so a pan frame is
    one integer-offset `drawImage` — measured 5.6ms → 0.08ms (65% → 2% of a
    panning frame on a 570-plant stress garden at 1600×900). Rebakes happen on
    key change, on leaving the baked margin, ~140ms after the last zoom tick
    (mid-gesture frames scale-blit the stale bake — briefly soft, never slow),
    and ~180ms after a pan ends (resting frames are freshly rasterized, never
    resampled). Water ripples freeze except at rebakes. The canvas backing
    scale is capped at `DPR = min(1.5, devicePixelRatio)` (view.js) — matching
    the sprite cache's cap, so sprite blits stay 1:1 and 4K/retina full-screen
    passes don't quadruple the pixel budget.
    **Organic terrain edges (Wave 3 + Tier 1)**: when `game.edgeStyle==='organic'`,
    `paintGround` draws terrain tiles' *grass* base and overlays the material as
    a **smoothed blob** — `buildTerrainRegions()` floods same-material tiles
    (kind+colour, **8-connected**, and **split by elevation level** — a raised
    bed is its own terrace region drawn lifted by `elev*ELEV_STEP`, regions
    painted low-to-high), `traceOutlines` (reused from the plan sheet) walks
    each boundary, and the geometry is cached in world tile-corner space in
    `terrainLoopCache` keyed by `terrainRev` (elevation edits bump it too), so
    tracing runs only on edit, **never per pan frame**. Each boundary is
    classified into **arcs** (`terrainUnitEdges`/`terrainLoopArcs`), and what
    decides the classification is **`TERRAIN_RANK`** (core.js) — which material
    is laid ON which, `water:0 < bed:1 < path:2`:
    **soft** arcs — facing grass, *or* facing a material this region outranks —
    are Douglas-Peucker'd (`dpOpen`, eps ≈ 0.9: staircases collapse to straight
    diagonals; unit-tile lobes are exempt so they can't collapse to slivers),
    pre-jittered inward (`planJitter`) on interiors only, and drawn as
    midpoint-quadratic splines **pinned to their endpoints**;
    **hard** arcs — facing a peer (another bed style, another path colour) or the
    **plot boundary** — draw as exact tile lines with no jitter, so peers **butt
    seamlessly** and painted corners stay corners (a bed painted to the plot edge
    runs exactly into the plot corner; leave a grass tile for a margin);
    **covered** arcs are hard arcs facing a material that outranks this one —
    exact, and **not stroked** (`terrainLoopStroke`), because the region above is
    painted after and its curve lands on this fill.
    Rank is why **a path crossing a bed stays one flowing ribbon**. Judging an
    edge merely by "is the neighbour solid" made a path smooth over lawn and a
    raw tile staircase the instant it entered a bed — one run flipping treatment
    four times, which is the tilemap showing through exactly where the design is
    most deliberate. Regions sort by `elev` then `rank`, so the winner paints
    last, and the winner's laid-over edges bleed outward by `LAID_OVER_BLEED`
    (≈0.45 tile, roughly what DP then cuts back) so its curve lands *on* the
    tile line rather than inside it. Bleeding the LOSER under the winner closes
    the same gap and was tried first: it eats the winner from both sides, and a
    one-tile path crossing a bed broke into disconnected lozenges. The bleed is
    applied per **point**, not per arc, so the corner where a laid-over arc meets
    a lawn-facing one moves with both and no step opens between them.
    **Pinch corners** are pinned exact so lobes kiss instead of gapping — both
    same-region 8-connected diagonal touches (`useCount>=2`) and
    **cross-material saddles** (a soil bed corner touching a path corner
    diagonally pins the shared corner in BOTH regions).
    `terrainLoopPath(ctx, loop, proj)` renders the
    cached arcs through an arbitrary projector — the garden uses
    `screenOfFlat` + terrace lift, and **`openPlan` uses the same function**
    projected to paper, so the plan sheet finally matches the garden (formal
    gardens keep crisp per-tile cells in both); `terrainLoopStroke` is the same
    geometry minus covered arcs, and both surfaces stroke through it. Known
    limitation, pre-dating all of this: a **one-tile-wide diagonal** region necks
    into lozenges under the smoothing, on lawn as much as in a bed. The per-tile texture pass runs
    **clipped** to the blob (grain/ripples preserved) with one
    continuous edge stroke — grass still shows in soft cut corners; it passes
    `skipBase` (§11a) because the region silhouette already filled the base.
    Perf: organic tracks formal even on a pathological
    573-terrain-tile / 48-region stress rebuild; a still view just blits. **Dense gardens draw
    plants from a sprite cache** (`PSPRITE`, `drawPlantMaybeCached`): `drawPlant`
    was ~88% of a heavy frame, re-running each plant's procedural recipe every
    frame, so each plant renders once to a small offscreen canvas — keyed by its
    own `tileSeed` so every clump stays unique (no shared variant pool) — and is
    blitted after, with sway applied as a cheap skew on the blit and growth/bloom
    bucketed so the key is frame-stable. A **governor** (`updateSpriteMode`)
    engages it when the measured draw phase stays heavy (>6ms for 3 straight
    frames, 40-plant floor) rather than at a fixed plant count — so a mid-size
    garden gets sprites on a weak GPU or huge window while the same garden on a
    fast desktop keeps the pristine, smoothly-growing procedural path. Because
    sprites make draw fast, disengaging reads the *predicted* procedural cost
    (plant count × a per-plant ms learned while procedural) rather than the live
    number, and releases only when that stays under ~2.5ms for ~45 frames.
    Eviction runs once per frame and only on off-screen sprites
    (never the visible set, so the cache can't thrash/flicker), sprite scale is
    capped at 1.5× DPR (retina memory), and a zoom change re-bakes crisp over a
    few frames rather than wiping (the blit auto-scales). ~2.7–3.4× on dense
    frames; `PSPRITE.off` A/Bs it, dev-only `stressGarden()` packs the plot. A
    perf **debug HUD** (`dbg`, toggled by backtick or `?debug`, zero-cost off;
    `dnow`/`dmark`/`dtime` are the phase timers) shows FPS + a per-phase
    frame-time breakdown — ground / shade / cursor / gather / sort / draw / fx,
    plus move / hud — sorted by cost. **Phase averages are the wrong instrument
    for this app's expensive work**, which is invalidation-triggered rather than
    per-frame: folded into a bucket that is averaged over a ~500ms window and
    then `dbgReset()`, a 70ms ground bake either smears into +2ms across 35
    frames or misses the window and reads 0.00 — the HUD showing `ground 0.00ms`
    while the bake was the thing under investigation is what motivated the split.
    So rare work is timed as **events** instead (`dev(label,t0)`, which returns
    its own ms; `devTime` wraps a call): `dbg.ev` holds `{last,max,n,total}` per
    label, reported as last/max/×count, and it deliberately **survives
    `dbgReset`** — `devReset()` is the explicit clear, also fired by
    `toggleDebug`. Instrumented events: `bake` (ground bake), `trace`
    (`buildTerrainRegions`), `scene` (`buildScene`), `shadeM`/`shadeR` (the two
    `ensureShadeMap` slots), `snap` (`snapshotState`, every pointerdown),
    `fill` (`doFloodFill`), `blob` (`buildSaveBlob`). The `ground` PHASE now
    charges the per-frame blit alone (~0.02ms) — `dmark('ground',tG0+bakeMs)`
    subtracts the bake back out — and `buildScene` no longer shares the `gather`
    bucket with the cheap per-frame dynamic gather. `dgap(rawGap)` tracks real
    rAF spacing (max + over-budget count), fed the UNCLAMPED delta and gated to
    interaction frames exactly like `updateGlassMode`, because JS phases can sum
    to 3ms while frames land 30ms apart — GPU composite, blur recomposite, GC
    and layout are all outside every phase timer. Dev-only **`perfBench(opts)`**
    (beside `stressGarden`) is the repeatable comparison: it builds a
    mulberry-seeded deterministic garden in NORMALIZED plot coords (same real
    layout at any grid size, so two plot sizes are comparable), forces `rounds`
    bakes and reports min/median/max for `bake` and `trace` —
    `perfBench({gw:46,edge:'formal',rounds:25,edit:false})`; `edit:true`
    (default) also invalidates `terrainRev` so the trace is included, which is
    what a brush stroke really costs. **Canvas timings taken in a hidden or
    backgrounded tab are worthless** — it does not rasterize, readings swing 3x
    and can show strictly less work costing more — so `perfBench` warns on
    `document.hidden` and returns `compositing`. Ground drawn back-to-front, a single
    depth-sorted entity
    pass for the cottage + plants + critters (`houseDrawDepth()` uses the
    current-rotation max view depth over the footprint, so large houses sort
    consistently from every side). That pass reads a **persistent scene list**
    (`scene` / `buildScene` / `sceneStale`): plain depth-sorted records built
    once per edit / rotation / layer toggle / game day — invalidated by
    `game.rev` (bumped by `markModelChanged` in `setTile`/`clearTile`/
    `addHouse`/`applySnapshot`/`mergeMap`) plus map object identity for
    wholesale swaps (load / new garden) — so a frame only culls (numeric
    bounds compares) and draws, merging in the few per-frame dynamic entities
    (house ghost, avatar, other gardeners) by depth. The old gather allocated
    a `{depth, draw:closure}` per visible entity and re-sorted EVERY frame —
    thousands of objects/frame of pure GC churn (stutter). Growth/sway/bloom
    are computed at draw time from live plant refs so nothing visual goes
    stale; day-granular facts (tree shade reach, canopy stunting — `plantEstab`
    is integer-day) live in the records, and stunting is now computed against
    the FULL tree list (the old per-frame pass used the viewport-culled list,
    so an off-screen tree stopped stunting a visible plant). Planting
    pulse fx (`game.fx`), season tint, snowfall, and — when `game.photo` is
    set — a golden-hour wash for `takePhoto()` (renders one washed frame,
    downloads the canvas PNG; the DOM HUD is excluded automatically).
    Full-sun plants under a tree canopy render stunted (growth × 0.45,
    `shadeTrees` precomputed per frame); the plant card says "Struggling".
    Woody visual rings are separate from legality: placement ghosts,
    plan circles, and the Mature Canopies overlay all draw dashed mature crowns
    from `woodyRadiusTiles(P)` (`spread` inches), while `drawPlant` keeps using
    `h`/`cw` as px-art. `drawMatureCanopyOverlay` is flag-gated by
    `game.layerVis.matureCanopies` and `layerShown('woody')`, so the off path
    costs only that boolean check.
    Small screens render at `ZOOM` 0.75 (~1.3x more world); all pointer
    math divides by it (`evPlacement`). Cost scales with screen size, not `GRID`.
11a. **Ground material grain** (`drawMaterialGrain` + the `grain*` primitives,
    world.js) — what makes gravel look like gravel and mulch like mulch rather
    than like one speckle in different tints. Each material names a `texture`
    recipe and a four-slot `tones` palette **in its data entry**
    (`BED_STYLES` / `PATH_COLORS`, core.js); the draw code hardcodes no colour.
    `tones:null` means "derive from the tile's base" and is for materials whose
    base is seasonal (soil follows `AMBIENCE`). A `texture` is shared, so the
    **Bark mulch path and the bark-mulch bed are the same material**, and the
    path colours — which used to differ only by tint — now get crushed gravel,
    limestone fines, shredded bark, cut flagstone, crazed clay, dark chip,
    brick and concrete paver respectively. Beds are soil / gravel / river rock /
    leaf litter / bark mulch / **pine straw** / **pea gravel** — the aggregate
    ones deliberately span three sizes (crushed fines, 3/8in rounded pea,
    2–4in cobble) because that is the distinction a designer is actually making.
    A recipe stages its grains once into module-level scratch (`grainSite` /
    `grainPush`, the fcPush/fcDraw pattern from draw.js) and paints them in
    several tones with a **stride**. Painters: `grainGrit` (3-gon fines),
    `grainChips` (5-gon crushed stone / leaves / flagstone), `grainPebble`
    (6-gon water-worn cobble), `grainShreds` (tapered quad — bark shreds, pine
    needles), `grainUnits` (laid brick/paver). Silhouettes are baked at load;
    there is deliberately **no ellipse painter**.
    **Laid units** (`texture:'brick'`) read their size from `unit` in real
    inches and are set out in **view space**, not tile-local, so the bond runs
    continuously across tiles and turns with the garden rather than the screen.
    A unit overhanging onto the next tile is exactly where that tile would draw
    it, so the bond needs no per-tile clip to be seamless — but big units get one
    anyway, because a 16in paver is larger than the tile it is drawn for and
    unclipped it measured ~19x the tile area in overdraw (59ms vs 38ms). Brick
    is small enough that the clip is pure overhead, so `bl>0.5||bw>0.5` gates it.
    The mortar joint is the base colour showing between units, which is why a
    laid material's `fill` is the JOINT tone rather than the unit tone.
    **The cost model is measured and counter-intuitive — read the block comment
    before changing a recipe.** `fill()` is free (961 fills = 0.17ms), so tone
    groups cost nothing; the currency is **shape instances** at ~0.4–1.8us each,
    and polygon cost does not grow with radius while ellipse cost does. So
    batching grains into one fill buys nothing on its own — what it buys is free
    hue variety. Repainting a staged set a second time as a shadow or sheen
    doubles the instance count and is the trap that put a first cut 2–3x over
    (soil at 12.8x); where a material needs dark between its grains that is the
    base colour showing through. Budget ~21us of grain per tile. Do not batch
    across tiles — one path holding a 961-tile region measured 199ms vs 35ms.
    Two artifacts this fixes and must not regress: a material tile draws a
    **flat base with no bevel and no seam stroke** (that per-tile bevel was a
    grid stamped across every bed; grass and the doorstep keep theirs, and so
    does everything under snow, where the bevel is the only relief), and that
    base is **bled 0.6px past the tile** so neighbouring antialiased fills
    overlap instead of leaving a hairline of the layer beneath along every
    shared edge. Grains are placed uniformly over the WHOLE tile diamond, inset
    by `GRAIN_INSET` of their own radius — the old texture scattered inside a
    box a quarter of the tile, which left a bare ring on every boundary.
    Bed base tone no longer jitters per tile; the grain carries the unevenness.
    **Material swatches render the real tile.** `drawMaterialIcon` (tray.js)
    clips to the icon's diamond and calls `drawGroundTexture` at TRUE tile scale,
    cropped rather than scaled down — a 2px grain shrunk to fit is mud. The
    library grid, the landscape search results, the brush swatch and the sheet
    swatch all go through it, so a new material needs no icon code. They used to
    keep a private copy of the texture recipes, which is how the library ended up
    still drawing the pre-grain speckle, and every path COLOUR was drawn as
    `gravel` whatever it actually was. Icons are pinned to Summer so a bed does
    not read as snow while you are picking it.
    Measured on the ground bake (the texture lands on REBAKE, never per frame):
    a 62ft designed garden went 76.5ms → 58.7ms organic (the default — the
    skipped per-tile base fill more than pays for the richer grain) and
    28.0ms → 34.3ms formal; the all-terrain worst case 185ms → 159ms; lawn
    unchanged. No new cache key: `texture`/`tones` are static data and the
    material id is already in `groundDataSig()`.
11b. **Water** (`waterField` + `drawWaterTexture`, world.js) — pond, river and
    lake used to be three tints of one thing: the same bevelled tile, the same
    two ripple ellipses, and a `t` term that looked like an animation but could
    not be one, because the ground is BAKED. All it did was make each rebake
    differ slightly from the last. It is gone.
    What separates them is **depth and flow**, and neither is a property of a
    tile — depth is how far the tile is from the bank, a river's flow runs along
    its channel. Both are derived into a field cached on `terrainRev`
    (`waterField`), never per frame, and read by `waterDepthAt` / `waterFlowAt`.
    Depth is a **two-pass chamfer** transform, not a 4-connected flood: a flood
    measures Manhattan distance, whose contours are diamonds, and banded into
    colours that renders a pond as a stepped pyramid with the tile grid running
    through it. Flow is the axis along which water runs FURTHEST, probed a few
    tiles each way — on a channel that is the channel, on open water no axis
    wins, which is the right answer for a pond. (Deriving flow from the gradient
    of the depth field is tempting and wrong: the gradient vanishes along the
    centreline, exactly where the flow matters.) Only a river is probed; that
    test alone took the field build on a solid-water quarter acre from 15ms
    to 0.7ms.
    Each style names a `texture` (still / flowing / wind chop) and a **`reach`**
    — how many tiles it takes to shelve from `fill` to `deep` — and reach is
    most of what tells them apart: a pond drops away at once, a lake barely
    shelves inside a garden. Reach is deliberately more generous than reality
    because a tile holds one flat colour, so the ramp is only as smooth as the
    number of TILES it spreads across. Rasterising the field one pixel per tile
    and blitting it through the isometric matrix looks marginally better and was
    rejected on measurement: a `drawImage` that is both SHEARED and upscaled
    ~76x is a slow path, 74ms a bake for one pond against 0.6ms for the per-tile
    fill, and bounding the source rect changed nothing.
    Water keeps the same two fixes as the materials — flat base, no bevel, and
    a shoreline stroked only on the sides that face a bank (`inRegion` says the
    region outline already drew it). Measured 31x31 all-water, same session:
    pond 102ms → 39ms, lake 102ms → 43ms.
    Note `mixHex` parses HEX ONLY, so feeding it its own `rgb(...)` output
    yields NaN channels that clamp to black — that is what made the first frozen
    lake solid black. `mixCol` goes through `colorParts` and takes either form.
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
    `refreshCanvasTools`. **True north** is `game.siteNorthDeg`, an arbitrary
    clockwise bearing from plot-up that is independent of `game.rot`.
    `updateCompass` ray-intersects its rotated N/E/S/W vectors with the plot
    boundary, then projects those geographic edge markers through the current
    camera rotation. The same bearing rotates the cached derived sun path and
    exported plan arrow; Rotate View never changes site orientation. The
    non-painting view/select tools — **Select**,
    Rotate, **Layers** — live in the top bar beside the season dial instead
    (`syncTopTools` keeps their icons/state in sync; Fill moved into the Select
    tray). `game.tool` uses `'hand'` for safe panning and keeps `'shovel'` for
    Erase back-compat; the mobile rail shrinks the icons/rows so all clear the
    bottom tray). The device-local **Left-handed layout** preference in the
    Garden Menu mirrors only this rail to the right, moves dependent transient
    chrome away from it, and makes `usableCanvasRect()` reserve the actual rail
    side without changing the top bar, bottom palette, camera, or garden save.
    The rail's Erase **drag-sweep**
    (pointerdown starts a sweep; tap or drag both run `eraseBrush(cx,cy)`,
    a centered **disc brush** of `game.brushSize` tiles (the shared
    paint/erase size — `brushOffsets`, see the disc-brush note below) that clears
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
    (`game.selMode` 'move'|'copy') is set by the marquee action pill
    (`renderSelectionActions`, anchored to the selection) which
    shows **Move / Duplicate** (mode toggles) and **Fill / Rotate / Erase /
    Save / Paste** (one-shot actions). On commit the marquee snapshots its contents once
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
    through `applyToolAt(x,y)` — now a thin dispatcher: it applies the universal
    guards (off-plot, house/door) then calls the armed tool's `apply` hook from
    the `TOOLS` table (`placePlantAt` for species, `placeTerrainAt` for
    path/bed/water, `placeFenceAt`/`placeLightAt`/`placeFirepitAt`/
    `applyElevationTool` for the rest; house has no hook — it places via
    `placeHouse` from pointerdown). The hooks are silent and handle the rules —
    bulbs tuck under perennials but are refused under trees/shrubs (and a
    newly planted tree/shrub clears any bulb already there), plants check
    `shadeAt`; shrubs reserve a mature spread footprint from `spread`/`TILE_IN`
    (paths, water, fences, bulbs, and perennials refuse that ground; compatible
    clipped hedge shrubs can still connect edge-to-edge). The reserved shrub
    footprint is also a visual affordance: a faint base under each shrub, a
    stronger outline when hovered or when its plant card is open, and a brief
    red pulse when it blocks placement. Paths refuse planted tiles, beds store
    a material `c` (`soil`/`gravel`/`rock`/`leaf`/`mulch`) and can be repainted
    like path colors, and fences refuse planted/water/house tiles).
    **Disc-brush engine (Wave 2)**: one shared `game.brushSize` (diameter in
    `BRUSH_SIZES` = 1/2/3/5/7) drives paint and erase alike. `brushOffsets(size)`
    (world.js) returns the tile offsets of a *rounded disc* centered on the
    cursor — size 3 is the full 3×3, size 5 a rounded 5×5 (21 of 25, corners
    cut), so a fat dragged stroke reads as a curved ribbon (the base of Wave 3
    curves) and erase clips its corners instead of a hard square. The tap/drag
    paint paths funnel through `stampBrushAt(x,y,opts)` (commands.js), which
    stamps the disc for the `sizable` tools (path/bed/water + raise/lower/level,
    flagged in the `TOOLS` table) and falls through to a single `applyToolAt`
    for everything else — **plants are deliberately not sizable** (a solid disc
    would break spacing; that's the Wave 3 Matrix brush's job). Fill and
    `stampDrift` still call `applyToolAt` directly (they already cover an area).
    Size dots live in the brush bar (`renderBrushBar`, sizable tools only) and,
    reusing the same `setBrushSize`, in the Erase tray. A **cursor footprint
    ghost** (`drawBrushGhost`, renderer.js) tints the disc under `game.hoverTile`
    before commit — cream for paint, red for erase — reusing the same
    `brushOffsets` so the preview can't disagree with the stamp (desktop hover;
    touch paints on contact). `pointermove` updates `game.hoverTile` up front,
    before the sweep/toolDrag early-returns, so the footprint tracks the cursor
    mid-drag instead of freezing where the gesture began. **Drag-to-plant**: pointerdown with a
    plant/bulb/path/bed/water/fence armed defers; crossing a tile line turns the
    gesture into a paint-drag that applies the tool to every tile crossed
    (one toast + sync at pointerup via `finishToolDrag`), while a plain
    tap resolves at pointerup to the classic walk/act (`tapAction`). With
    the Drift toggle on, single planting calls `stampDrift()` — a loose
    shuffled cluster sized by spacing (`driftCount`: ≤6" → 9, ≤12" → 7,
    ≤18" → 5, ≤30" → 3); woody plants always plant singly.
    **Matrix scatter (Wave 3)**: a third plant-pattern mode (`game.matrix`,
    exclusive with Drift, the `Matrix` chip beside Draw/Drift in the brush bar).
    When on, `placePlantAt` runs the tile through `matrixSpacingBlocks(x,y,def)` —
    it refuses if a *same-species* plant sits within the species' real spacing
    (`round(space/TILE_IN)` tiles, Euclidean), so a dragged/filled region
    self-thins to a natural stand (~a checkerboard at 18" spacing) and *flows
    around whatever is already there*. Occupancy still blocks any species, so the
    workflow is: scatter the feature forbs first, then flow the grass matrix into
    the gaps — authentic two-layer interplanting. Woody/bulb/water types opt out
    (they place normally even with Matrix armed). The **Fill** tool
    (`game.fillMode`, a mode layered over the armed brush — the bottom
    catalog still picks what you fill WITH) bucket-fills: a tap runs
    `doFloodFill`, which BFS-floods the 4-connected region sharing the
    tapped tile's ground material (`groundMat`: grass/path/bed/water) and
    applies the armed brush to every tile via `applyToolAt`, wrapped in one
    `withUndo`. The Fill toggle sets the `fillMode` flag; `fillActive()`
    gates it (`fillMode && toolMeta(tool).paints` — `paints` is true for the
    continuous fills (plants + path/bed/water/elevation) and false for the
    discrete hardscape/structure tools house/fence/light/firepit/boulder); the Plant rail
    button clears the flag. The **Pick** and **Erase** tools see the mature
    shrub footprint, so sampling or erasing the visible edge of a large shrub
    acts on the shrub's center tile. The **Pick** tool (`game.tool==='pick'`,
    eyedropper) samples the tapped tile via `pickAt` — plant > bulb > fence >
    terrain priority — arms that species/material/structure as the brush
    (copying path colour, bed material, water style, or fence material/height/gate mode and
    switching `trayCat`), then drops into plain Plant/Hardscape mode so the
    next tap paints with it. **Erase is just another brush**: arming it
    (`armEraseTool`) shows its options in the `#brushBar` itself, right where
    the path/bed options sit — a **layer** seg (All/Plants/Bulbs/Land →
    `eraseMode`; Land includes terrain, houses, and fences) and the **size**
    seg (the shared `game.brushSize` disc, 1/2/3/5/7 → `setBrushSize`), which is
    literally the same `seg()` builder and icons as the paint size dots, so the
    two can't drift. `renderBrushBar` branches on `game.tool==='shovel'` (a red
    "Erase" `brush-lab`, no Draw/Grid/Fill segs); the bar's `paints` gate lets
    shovel through. There is no erase rail popover (the old `renderErasePopover`
    /`renderEraseTray` were removed) — so on a collapsed phone sheet the erase
    width/layer stay visible because the brush bar persists. **Keys map to SCREEN directions**
    regardless of rotation: one key is a screen-cardinal step (a view
    diagonal); two keys combine into view axes; `viewDirToWorld` converts to
    world steps. Tapping the house walks to the door and sleeps on arrival.
13. **Storage / multiplayer** — `sGet`/`sSet` over localStorage. Solo worlds
    are named slots: `hortus:worlds` is the index `[{id,name,ts,gw,gh}]`,
    each save lives at `hortus:world:<id>` (built by `buildSaveBlob()`; layer maps from `GAME_LAYERS` +
    the optional `schemes` block of §13a +
    gw/gh + rot + `siteNorthDeg` + houses + building polygons + name + `wv` walkway flag + current path/bed/water
    material choices, hardscape/light drafts, and the per-garden `discovery`
    lens). `hortus:plant-collections:v1` holds device-local Favorites and named
    palettes separately, so they can be used in every garden without changing a
    garden's plant criteria. The old single `hortus:solo` key
    migrates into the first slot once. Older saves with only `grid` load
    square; 13x13-era saves recenter from (6,6). Autosave on day change is
    silent; the Save button toasts. Host/join shared worlds via shared keys
    (meta carries gw/gh; houses and building polygons sync via their own keys, last-write-wins
    by timestamp), presence polling, and `mergeMap` for keyed layer maps.
13a. **Planting schemes** — several plantings over one shared site plan, so a
    designer compares schemes instead of forking gardens. `SCHEME_LAYERS`
    (`['plants','bulbs']`, world.js) is the per-scheme subset of `GAME_LAYERS`;
    everything else is shared. `game.schemes` is `[{id,name,t,plants,bulbs}]`
    and `game.schemeActive` names the live one. **One invariant, mirrored in the
    save blob: the ACTIVE scheme's maps live in `game.plants`/`game.bulbs` and
    never in its list entry** (which holds `null`); `stashActiveScheme()` is the
    only writer of a scheme's stored maps. `ensureSchemes()` keeps runtime at
    ≥1 scheme; `activateScheme(id)` stashes the outgoing scheme, adopts the
    incoming one, and calls `markModelChanged()` **but deliberately not
    `markGroundChanged()`** — shared layers did not move, so the ground bake and
    terrain region trace stay valid and `sceneStale`'s map-identity check
    (renderer.js) does the invalidation for free, with no new cache key.
    Commands live in commands.js: `switchScheme` (resets the selection, which
    owns the outgoing scheme's plants), `cycleScheme`, `schemeAtIndex`,
    `createScheme(copyCurrent)`, `renameScheme`, `deleteScheme`. Switching is
    navigation, not an edit, so it pushes no undo snapshot.
    **Storage** is additive: `blob.schemes` is `{active, list}` where the active
    entry omits its maps because they are already at `blob.plants`/`blob.bulbs`,
    exactly where they have always been — so `drawWorldThumb`, `worldSaveMeta`,
    the import validator, `loadSolo`'s `GAME_MAPS` loop, `duplicateWorld` and
    `shareCurrentGarden` all work untouched, and an older build just sees the
    active scheme. Below two schemes the key is omitted entirely, so ordinary
    gardens save byte-for-byte as before. `serializeSchemes`/`restoreSchemes`
    (io.js) are the pure two halves — `restoreSchemes` is synchronous precisely
    so it is testable without awaiting `loadSolo`. Inactive maps get
    `compactSoloMap` on write, since they are never re-loaded-and-compacted
    while idle and would otherwise accumulate tombstones forever.
    **Undo** is one shared stack; `snapshotState()` tags each snapshot with
    `scheme`, and `applySnapshot` re-enters that scheme before restoring layers.
    Without the tag, editing in A, switching to B and undoing silently
    overwrites B with A's plants. Per-scheme stacks were measured at ~73MB heap
    on a quarter acre (and ~491MB at max plot), and cloning every scheme into
    each snapshot would multiply an already-2.5ms per-pointerdown cost, so
    neither is affordable — the tag is a string.
    **Storage budget**: a planted tile is ~53 bytes; per-scheme cost is 21.9KB
    (classic 46ft) to 108KB (quarter acre, realistic) of JSON, against 50.4KB of
    shared layers and a 928KB `UNDERLAY_DATA_LIMIT` site photo that N schemes
    share rather than multiply. `MAX_SCHEMES` is 6 and `saveHasRoomForScheme`
    preflights `SAVE_BUDGET_CHARS` (2.4M, half of iOS Safari's ~5MB counted in
    UTF-16) so creation is refused before the work, not after. This is where
    schemes differ from **Duplicate garden**, which stays useful for forking
    into a genuinely separate project: duplicates copy the whole blob including
    the photo (3 duplicates of a photo-calibrated quarter acre = 3,259KB vs
    1,303KB for 3 schemes), fork the site plan so moving a patio means moving it
    three times, and can only be compared by quitting to the worlds list, which
    loses camera, zoom, rotation and season.
    **UI**: creation lives in the Garden Menu (`#btnSchemes` → `#schemeScreen`,
    beside Plant filters); switching lives on `#schemeChip` in the top bar,
    which is `hidden` until a garden has a second scheme — `.hud-top` is tight
    enough that the season box already `flex-shrink`s to fit 360px, so a
    permanent chip would cost every single-scheme garden width it does not have.
    Below 360px the chip drops its name and keeps the index. `syncSchemeChip` /
    `renderSchemeMenu` (tray.js) hang off `syncTopTools` and follow
    `renderLayerMenu`'s fixed-dropdown pinning; `game.toolMenu==='schemes'`.
    Desktop A/B is `[` / `]` to cycle and `1`–`6` to jump (input.js).
14. **Export / planting list** — `exportRows()` tallies planted tiles per
    species (plants + bulbs) and converts to real quantities
    (`ceil(tiles × TILE_IN² / space²)`) plus bed area; `openExport()` renders
    the overlay table, `exportCsv()` downloads it. Print CSS in `styles.css`
    strips everything but the sheet.
14b. **Design plan** — `openPlan()` draws an Oudolf-style top-down drift
    map to `#planCanvas`. `planComponents()` flood-fills contiguous
    same-species/cultivar tiles (8-connectivity) into drifts;
    `traceOutlines()` walks each drift's 4-connectivity boundary into loops
    (collinear runs merged), `buildPlanMap()` smooths them into organic
    blobs (quadratic midpoint spline + `planJitter` lattice wobble) tinted
    from `planColor`. A faint tile grid underlays the whole plot so bare ground
    reads as blank tiles. Trees → dashed canopy circles + trunk dot, the circle
    sized to `canopyRadius()` through the display lens: Today shows current
    reach, Established preview shows mature reach, and the legend says
    "Dashed = mature crown". Shrub plan blobs use `woodyRadiusTiles(P)` from
    `spread`; bulbs -> scatter rings; building footprints, house, fences/gates, paths/beds, title block,
    true-north arrow (rotated within the fixed plan), legend with `planCodes` (short genus/epithet abbreviations,
    unique per species|cv — a lone genus collapses to 2 letters, e.g. a single
    Amsonia → `AM`, growing to 3+ only on collision — plus a cultivar tag), and
    a 10-ft scale bar. `downloadPlan()` saves a 2× PNG; the plan
    also prints (own page). Empty gardens render an empty sheet, no crash.
14c. **Bloom calendar + live phenology** - `bloomRows()` reads planted plants +
    bulbs, groups them by species/cultivar, and maps `bloomMonths` to
    real-world Jan-Dec columns; missing month data falls back to conservative
    season-to-month estimates. The renderer also turns each consecutive
    `bloomMonths` run into one continuous year-relative window, so a bloom
    does not restart at a visual season boundary. `bloomDay` remains the
    exact within-season override for deliberately staggered bulbs and onions.
    `openBloomCalendar()` renders the in-game `#bloomScreen` table. The catalog
    reuses the same `bloomMonths` timing for discovery; renderer bloom color is
    considered only in an authored bloom season, so foliage or plan colors never
    create false flower-color matches.
15. **Plant eligibility, discovery + HUD** - `plantFits()` is the hard garden
    gate (zone range, native-only, deer/rabbit-resistant plants, and
    squirrel-resistant bulbs). `game.discovery` is a reversible saved browsing
    lens over that gate: source (`recommended`, all eligible, Favorites, or one
    named palette), category, common/Latin/cultivar search, flower-color family,
    bloom season, and progressive result limit. `allPlantRefs()` expands every
    selectable species and cultivar to an exact `{s,v}` reference; card
    selection, Favorite status, named palettes, bloom metadata, and planting all
    preserve that exact reference. Discovery filters exact references first,
    then groups each matching base species and its cultivars into one family
    card. Opening a family pushes an in-catalog variety view whose exact rows
    retain their own heart, palette membership, bloom/size metadata, and bronze
    selected state; an exact cultivar search can still surface that cultivar
    directly. Progressive result limits count family groups, not raw cultivars.
    The design questionnaire's **Start with**
    choice picks the initial source only; it never narrows what can be planted.
    `trayKeys()` remains the filtered species helper for legacy/build surfaces.
    The catalog is one connected docked shell: Plant library/Landscape
    library heading and count, then the controls **paired two-to-a-row** by
    `catalogControlRow()` — row 1 is *what you're browsing* (the compact
    **Plants / Landscape** segmented switch + source picker), row 2 is *how you
    narrow it* (Find + Filters) — then pointer-draggable counted category
    facets with native touch scrolling, one independently scrolling result
    region, and a fixed contextual placing/brush footer. The pairing is
    load-bearing, not cosmetic: as five stacked full-width rows the controls
    were 268px of fixed, non-scrolling chrome, and because the result list is
    the only flexible row it absorbed every pixel of vertical pressure (1.5
    cards at 1366x768, 0.2 at phone-landscape). Two rows plus a 104px card put
    it at 4.3 / 3.1 / 2.1 cards at 1440x900 / 1366x768 / 1280x620.
    Switching catalog modes selects
    Hand so browsing cannot paint; it preserves the last brush for restoration.
    The docked grid shell is a 56px full-width header,
    canvas in the lower-left cell, and a flush dark-loam right-side library
    separated only by a 1px divider (370-430px desktop and 340-390px tablet).
    Closing the library collapses its grid column; the `ResizeObserver` on
    `#canvasStage` (view.js) then re-runs `settleViewportChange()` so the canvas,
    `VW`/`VH`, the design camera clamp, and any open dropdown all follow.
    Phone **and portrait tablet**
    keep the tri-state bottom sheet with the same internal hierarchy.
    Every breakpoint shows a one-line, horizontally scrolling counted category
    strip; touch uses native scrolling, mouse/pen can drag, arrow/Home/End keys
    move focus, and selection restores focus after the controls rebuild. The
    strip carries its own scroll affordance (`updateCatalogStripAffordance`,
    called after it is appended — `scrollWidth` is 0 while detached — and kept
    honest by a `ResizeObserver`): `can-scroll-start`/`can-scroll-end` land on
    both the strip (mask-image edge fade) and its `.catalog-category-nav`
    wrapper (chevron buttons, pointer-only). Without it 6 of 9 categories sat
    off-screen behind a hidden scrollbar with only `cursor:grab` to hint at it. The
    plant categories are Grasses, Sedges, Sun Perennials,
    Shade Perennials, Bulbs, Water Plants, Shrubs, and Trees; Landscape categories
    are Ground, Grade, Hardscape, Lighting, and Site. `#toolTray` is the primary
    scroller so the header, discovery controls, and footer stay visible; below
    `max-height:700px` the control stack becomes a scroller too, because
    `#sheetCatalog` is `overflow:hidden` and used to simply swallow the overflow
    (at 932x430 the category strip and the Filters button were 0% visible with
    no scrollbar to recover them).
    `usableCanvasRect()` detects the side-docked library and reserves its right
    edge for Fit Plot, selection/build actions, and camera recovery. The
    dropdown includes Recommended, All eligible, Favorites, and every named
    palette; a separate **Manage plant palettes** action creates, renames, and
    deletes named palettes. Favorites and named palettes always open to a real
    **All** view across every saved plant category; category choices become
    optional counted facets and never inherit the previous catalog category.
    The garden-start zone remains a fixed eligibility
    gate and is deliberately not repeated in the in-garden filter sheet or
    active-filter summary. Cards show a Fraunces common name, IBM Plex Sans Latin
    name, bloom range plus a 12-month timeline driven by the same `bloomMonths`
    data, sun, moisture, mature size, flower-color swatch, and a sage
    variety-count tag. The selected card has a terracotta ring plus a visible
    **Placing** badge, never color alone. A heart toggles Favorites and the
    adjacent action adds to or
    removes from a named palette. Adding a card opens a separate assignment
    view that lists only named palettes with green **Add** / red **Remove**
    actions and create-and-add; the normal source picker is never mixed into
    that action. Saved retired or garden-ineligible references remain visible
    with a reason and removable from Favorites or named palettes in the palette
    manager rather than falling back to their base species. The
    planted tile stores `v`; tool state is `game.tool` + `game.toolVar`. The Landscape
    tab is contextual: select Path to reveal path colors, Bed to reveal bed
    materials (soil, gravel, river rock, leaf litter, bark mulch, pine straw,
    pea gravel — see §11a), or Water
    to reveal pond/river/lake styles. Its dedicated debounced search spans all
    Landscape categories and routes a result into the correct tool/category;
    its result region is a responsive, vertically scrolling tool grid rather
    than the legacy horizontal strip. The Hardscape tab draws fences and
    gates from `game.fenceDraft` with 4 ft/6 ft heights
    and Black Aluminum/Wood/Vinyl/Chainlink/Brick materials, plus **fire
    pits** from `game.firepitDraft` (Round/Square shape + size — round
    24/36/48 in, square 36 in or 24x48 in — `FIREPIT_SIZES`/`firepitTileSize`;
    drill in for shape/size like a grouped species). Fire pits live in
    `game.firepits` keyed by origin tile (`{shape,size,t}` or `{removed:true}`),
    reserve a mature footprint via `firepitFootprint`/`canPlaceFirepit`
    (refused under house/door/water/plants/bulbs/fences/lights/shrubs and the
    avatar when one is present), block movement (`canStand`/`firepitAt`), and render
    through `drawFirepit` (stone rim + coals + flames, snow cap in winter).
    Boulders live in `game.boulders` keyed by origin tile (`{type,t}` or
    `{removed:true}`), use `BOULDER_TYPES`/`boulderTileSize` for round,
    rectangular, and oblong footprints, block movement/planting, render through
    `drawBoulder`, export to the design plan, and sync via `syncBouldersOut`.
    Fire pits and boulders erase as Landscape, move/rotate/copy in selections,
    eyedrop with Pick, and sync through their layer-specific sync helpers. The House tab
    is its own icon tray: Place tool + size/wall/roof buttons in labeled
    sections (`.tray-sep`, now a horizontal small-caps label, not rotated).
    The left canvas toolbar owns the paint/edit tools (Hand/Plant/Erase/Pick)
    plus Undo/Redo below a divider; the view/select tools (Select/Rotate/Layers)
    sit in the top bar beside the season dial, and Fill lives in the Select
    tray. Plant
    arms the last drawable brush (plant, path, bed, or water; house/fence do
    not overwrite that memory); its style toggles — Draw/Drift/Matrix and
    Grid/Free for herbaceous plants, an **Age** seg (New/Young/Mature →
    `game.woodyAge`/`chooseWoodyAge`, T10) in their place for woody brushes,
    plus the shared disc **size** dots for the sizable
    material/elevation brushes, and the **Fill** chip — dock in the palette as
    the `#brushBar` segmented controls (`renderBrushBar`), not a floating flyout.
    In the docked library this is the fixed final row: a selected swatch,
    **Now placing** name, contextual **Grid/Free** placement toggle for
    herbaceous plants, and the remaining tool-contract controls below. It is a
    real layout row rather than an overlay, so the last result card stays visible.
    (The Landscape tab adds an **Edge** Organic/Formal chip pair — `game.edgeStyle`
    — next to the path/bed/water swatches.) New garden entries start on
    Hand so accidental painting is harder. The single **Plant filters** modal
    contains garden eligibility toggles (native/browse) and flower discovery
    (color/bloom season); it is opened from either the garden menu or the tray.
    The dedicated Plants Find field is debounced and searches common name,
    Latin name, cultivar name, roles, and category across every plant category;
    typing temporarily replaces the category facet with **All matching plants**
    and persists that prior category as `returnCategory`, while clearing or
    escaping returns to the correct per-garden browse category without
    disturbing the active garden criteria or palette source.
    The planner top chrome is one connected dark loam bar: the season/day-night
    cluster stays top-left, view tools remain centered on desktop, tablet/phone use
    the compact view-tools menu, and Menu stays at the far right within the same
    surface. `.hud-top` spans `grid-column:1/-1` as a grid row in the docked
    shell, so it does not need to dodge the library and never has since the grid
    landed (an old `right:calc(--organic-library-width …)` on it was dead code —
    `position:relative` + `inset:auto` meant `right` only ever resolved to 0).
    The glass
    performance fallback removes blur without changing the loam/seedhead/bronze
    palette. Safe-area padding keeps phone controls
    below a notch; `viewport-fit=cover` remains required for those insets. Left = the
    **season dial**: a local stroke-icon sun/moon day/night toggle (`#btnDayNight`/
    `updateDayNightBtn`, promoted out of the Layers menu — it flips
    `layerVis.night` to relight the world and switch lighting on) next to the
    **season box** (`#btnSeasonBox`): a compact readout (season name + early/mid/late
    phase in design, season + Year/Day on the avatar path) whose interior `#seasonFill`
    fills left-to-right with the season's progress, tinted by `SEASON_FILL`
    (Spring easter green, Summer dark green, Fall the bronze, Winter a darker
    blue) — this replaced the old thin progress line and the Advance/Pause
    buttons. The fill runs at `.44` opacity with a crisp 2px ink-channel
    leading edge (`.season-fill::after`): at the old `.18` it washed out to
    grey and the season's end was invisible, and the edge is what makes "how
    far through am I" legible rather than a soft gradient guess. Text stays
    ≥4.7:1 over every season band in both themes. **Hold** the box for 360ms to
    fast-forward (`game.ffActive`; the loop adds `FF_RATE` game-ms per real-ms,
    ~2 garden days/sec): a **masked conic ring** (`.season-box::after`, animated
    through the registered `--hold-sweep` property) traces the hold and the
    calendar line changes to **Fast-forwarding** while it is active. The ring
    takes `border-radius:inherit`, so it always matches the box — it replaced
    an SVG `<rect rx="5">` in a fixed `150x34` viewBox with
    `preserveAspectRatio="none"`, which drew 5px corners inside a 10px box and
    distorted to a 4.4×6.5px ellipse on a phone: visibly a square sitting
    inside the rounded box. Do not reintroduce fixed-viewBox chrome geometry
    over a box whose size changes per breakpoint. A short **tap**
    TOGGLES the time menu (`openPause`/`closePause` → `#pauseScreen`), a
    **dropdown** that `openPause` pins just under the season box
    (`position:fixed`, JS-set `top`/`left`), whose primary button is a
    Pause/Resume toggle. The dropdown's backdrop is **pointer-transparent**
    (`#pauseScreen{pointer-events:none}`, panel `auto`) so the season box
    keeps working while the menu is open — a hold still fast-forwards (and
    dismisses the dropdown); dismissal is a document-level capture
    `pointerdown` outside the panel (`pauseOutsidePress`), not a backdrop
    click, so the press also acts on whatever it hit. Crossing a season
    boundary — naturally, mid-fast-forward, or via the menu's Skip — runs a
    **season crossfade** (renderer.js `seasonFade`): the last frame of the
    old season is snapshotted once and dissolves over the new season's live
    frames for ~1.1s (one `drawImage`/frame; the season-keyed ground bake
    and sprite caches are untouched; skipped under `prefers-reduced-motion`
    and reset by `enterGarden`; `hasTransientGardenWork` keeps frames live
    while it runs). After the
    box sit the three **view tools** — Select, Rotate, Layers
    (`#btnSelectTool`/`#btnRotateTool`/`#btnLayersTool`, the non-painting tools,
    kept in sync by `syncTopTools`); the season box `flex-shrink`s (explicit
    `width` + lower `min-width`, not `flex-basis` — a content-sized parent
    ignores the basis) so the box + tools + Menu all fit a 360px phone, with a
    `≤359px` query tightening gaps/buttons for legacy widths. Right =
    the **action bar**
    (`#actionBar`): just a stroke-icon Menu now (Undo/Redo moved down to the canvas
    rail). The Menu opens `#gardenMenu` — the planting list,
    plant filters (shows the active filter), photo, planting plan, opt-in
    haptics when the device supports them, and Save & quit — so the infrequent
    outputs sit one tap behind Menu rather than a
    permanent row. `#gardenMenu` is a compact **dropdown**, not a centered
    modal: `openGardenMenu()` measures the action bar's rect and pins the panel
    just under the Menu icon, right-aligned to it (`position:fixed`, JS-set
    `top`/`right`); clicking the transparent backdrop dismisses it. So it drops
    from the corner over the still-visible garden instead of covering the
    screen. In **design** mode the readout drops the meaningless
    Year/Day (a day is 20s real time) for the season + early/mid/late phase
    (`clockMeta`/`seasonPhase`); the avatar path
    (Visit / legacy saves) keeps the full calendar + End Day. At 767px and below
    the library has collapsed/half/full states: `#sheetHandle` moves among them
    while you paint (`applySheetState`, `game.sheetCollapsed`). The half state is
    capped at 55dvh (480px maximum) and gives its remaining height to the result
    scroller so it cannot quietly become a nearly full-screen sheet. On phone
    viewports 640px tall or shorter, half state omits its redundant catalog title,
    mode switch, and search field; source/filter/category controls and results stay
    usable there, while full state retains the complete hierarchy. Collapsed leaves
    only a compact context label + swatch of the armed plant
    (`drawSheetSwatch`); the brush bar returns in half/full. The mobile palette is full-bleed
    (edge-to-edge, 28px top corners, docked to `bottom:0` with
    `padding-bottom:calc(6px + env(safe-area-inset-bottom))` so the catalog
    clears the home indicator while the tray background runs to the screen
    edge behind it). `#sheetCatalog` remains mounted across those states, so
    its scroll position survives. `applySheetState` performs a measured-height
    FLIP on the parent (px start/target, then clears the inline height), because
    transitions still need concrete start/target pixels even though the half and
    full resting heights are CSS-governed;
    this makes all six directed collapsed/half/full transitions reversible,
    including rapid interruptions. Reduced motion skips the interpolation.
    Only the collapsed state clips its content
    (half/full must let the category popover escape above the sheet). In phone
    half/full states the handle spans and visually joins the full-width sheet;
    collapsed returns it to a compact inset bar. At 768px and above `.hud-bottom`
    is the right-docked dark library; desktop/tablet deliberately have only
    two levels: the expanded browser and a compact **Plant library** launcher on
    the lower-right edge. The round close control in the library header minimizes
    directly; the launcher reopens directly to the browser, and Escape also
    minimizes. Zoom/Fit sits in a dark loam pill at the bottom-left on these sizes.
    The active plant result card uses the same terracotta selected treatment independently of
    its Favorite heart. **Canvas full-bleed under
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
    the garden fills the screen and clicks stay true. **Width** is *not* forced:
    `sizeCanvas` clears its own inline `style.width` before measuring, then reads
    the CSS `width:100%` back off `getBoundingClientRect()` — otherwise the inline
    width it set last time wins over the CSS and freezes width across resize /
    rotation (only height escaped, via the fresh `trueViewH()` probe), stranding
    a dead body-bg strip. `resizeCanvases` (on `resize`/`orientationchange`) then
    re-`snapCam`s and re-pins open chrome. `setViewportFill()` still
    matches the root bg to the season as a belt-and-suspenders. A `?debug`/`?vp`
    URL or a **3-finger tap** shows a viewport diagnostics panel. The chrome
    panels are glassy (`backdrop-filter` blur). There is no Save
    button — autosave fires on day change, quit, and visibilitychange/pagehide.
    Pausing/resuming (now the time menu's primary toggle) freezes or resumes day
    progression without blocking editing; the menu (opened by tapping the season
    box) also offers Skip to next season/year; season skip shows a confirmation
    using the real next season. Zoom: `ZOOM = baseZoom (0.75 on phones) ×
    userZoom`, driven by pinch (two-pointer tracking in the canvas
    handlers), mouse wheel, and +/- keys. The phone zoom pill stays hidden to
    protect canvas space; the one-time Time coach also teaches pinch zoom.
    `setUserZoom` clamps and snaps the camera. On phones (`baseZoom<1`) a
    big contextual action button (`setActButton`: Plant here / Plant a
    drift / Erase here / Lay path / Dig bed / End Day; hidden for the House
    tool) calls `actHere()` and replaces the instructional hint. The plant
    card sits top-right with a local close icon (`showPlantCard(p,x,y)` adds a shade
    warning when coords are given). Plant filters persist as `hortus:filters`.
16. **Screens** — menu, worlds list (`#worldsScreen`: continue/delete saved
    gardens or start a new one; reached via Design a Garden and View Gardens —
    the Design entry hides the per-row Visit button, View Gardens shows it.
    Each row carries a **mini-map thumbnail** (`drawWorldThumb` — a top-down
    map drawn from the save blob at list-open time: grass checker, real
    terrain fills via `pathFill`/`bedFill`/`waterFill`, foliage-colored plant
    dots, house blocks — always current, no stored screenshot) plus a meta
    line with live plant count + the garden's own season (`worldSaveMeta`).
    The panel is **locked to the viewport and only `#worldList` scrolls**, so
    the heading and the New/Import/Back actions stay put however many gardens
    you have; previously the whole `.screen` scrolled and at a dozen gardens
    the panel ran 2604px on an 844px phone, putting the title above the
    viewport and every action below the fold. Row buttons align to
    `--thumb-w` on `.world-row` (which also sizes the mini-map) rather than a
    hardcoded indent — the old 94px was sized for the 84px desktop thumbnail
    and overflowed the 64px phone row, wrapping Delete onto a third line and
    costing 46px per row),
    plot setup (`#plotScreen`, new solo gardens: name + acre presets + ONE
    always-visible plot diagram that owns size, shape, and orientation
    together. The width/length inputs sit inside the diagram card; the canvas
    draws the plot to scale with two handle kinds — **squares** at the
    right/bottom edge midpoints drag-resize width/length (writing the inputs
    live, tile-snapped, frozen scale during the drag, refit on release) and
    **circles** at the corners shape the lot (snapping to the tile-corner
    lattice, live per-side lengths in feet). A **north dial** in the canvas
    gutter rotates `plotNorthDraft` on drag (5° snaps) and opens the shared
    fine-tune bearing dialog (`openSiteNorthEditor('plot')`, also reached from
    Build → Site) on a plain tap. The shape draft lives in `pendingPlotShape`
    (never on `game` while editing; invalid drags — crossed corners,
    sub-9-tile slivers — show danger styling + a hint and revert on release).
    Any resize (inputs, presets, or edge drag) resets the shape;
    `btnPlotStart` applies it AFTER `setWorldSize` via `setPlotShape` since
    sizing always clears any shape), the design questionnaire (`#designScreen` /
    `openDesignSetup`), and the daily-challenge panel (`#dailyScreen`). The
    questionnaire is all chips, not native selects/checkboxes (which read as a
    stray HTML form inside the drawn world): **climate** shows the 3–9 zone
    chips face up, with a "Don't know your zone?" link that flips
    (`sel.zoneHelp`) to a ZIP field (`zoneFromZip`, a 3-digit-prefix→zone band
    table in core.js, clamped to the palette's 3–9, device-local) plus a
    plain-language "how cold does winter get?" chip fallback (`WINTER_BANDS`) —
    every path writes one `sel.zone`, echoed by a teaching readout (`ZONE_LOWS`)
    that stays visible in both views; **style** is a chip grid; **constraints**
    are toggle chips.
    A live **palette count** (`paletteCount` in ui.js — a pure mirror of
    `plantFits`' zone/native/deer/rabbit/squirrel gates that never touches game state)
    updates under every knob so each choice visibly does something. Selections
    commit to `game.design`/`game.filters` on Next, unchanged. Setup panels
    rise-fade in (`.panel-enter`) and sit more translucent over the meadow, which
    **replants live** to the chosen style + zone (`styleMeadowKeys`/
    `applyMeadowPalette`, called on every style/zone change): the tray's own
    `plantStyleScore` ranks a herbaceous, zone-filtered palette and the species
    are reassigned in place over the existing meadow slots — same positions, so
    the backdrop reads as being replanted, not teleporting (Prairie → grasses,
    Cottage → forbs, Shade → ferns/sedges; 'Any garden' keeps the curated
    seasonal meadow). Going Back to the menu re-seeds the season default. Still in
    the markup but no longer reached from the menu (legacy, tied to the retired
    story / multiplayer paths): the multiplayer lobby, character creator (with
    live preview), and code display. Plain DOM, toggled by `show()`. The planting-list
    (`#exportScreen`), plant filters (`#filterScreen`), design plan
    (`#planScreen`), and bloom calendar (`#bloomScreen`) overlays sit outside
    `show()` — in-game overlays toggled directly; the
    keyboard handler ignores game keys while one is open (Escape closes).
17. **Menu meadow + main loop** — animated title background, then `loop(t)`.
    The loop throttles itself: garden frames render full-rate only while
    something is happening (`shouldRenderGarden` — a state signature +
    gesture/fx checks + a 700ms activity grace), else at a 30fps idle cadence;
    render is skipped entirely under the full-screen Library/Plan/Bloom/Export
    overlays, and the menu meadow runs at 30fps. A **glass governor**
    (`updateGlassMode`, `GLASS`) watches frame *spacing* on interaction frames
    only — the backdrop-blur recomposite is GPU cost the JS phase timers can't
    see — and on sustained jank adds `body.no-glass` for the session (blur off
    everywhere, near-solid chrome fills; force with `?noglass`; state shown in
    the debug HUD). Per-frame HUD DOM writes are change-guarded (`hudText`/
    `hudDisplay` in ui.js) so identical values never touch the DOM.
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
  type: 'grass',               // grass | sedge | forb | bulb | water | shrub | tree
  h: 46,                       // px-art: mature render height, not real height
  space: 18,                   // inches-truth: on-center planting distance
  spread: 18,                  // inches-truth: mature clump/crown width
  zones: [3,9],                // USDA hardiness range
  native: true,                // straight species native to the central US?
  sun: 'full',                 // full | part
  moist: 'dry',                // dry | medium | moist
  phen: 'warm',                // cool | mid | warm — spring wake order
  bloomMonths: [7,8,9],        // calendar + continuous live bloom months
  grow: 10,                    // woody only: years to mature size
  cw: 150,                     // px-art: woody canopy/twig drawing width
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

`drawPlant` uses `form`/`h`/`cw`/`sea`/`stem`; planner/rules features use
`type`/`space`/`spread`/`grow` plus the site data. Valid `type` values are
`grass`, `sedge`, `forb`, `bulb`, `water`, `shrub`, and `tree`. Per-season keys:
`fol` (foliage),
`bloom` (flower this season, omit for none), `seed` (seedhead/structure —
present in fall/winter is what makes it Oudolf), `eye` (cone center,
coneflowers only), `twig` (bare-stem colour for the `bush` form — the winter
red/yellow of the dogwoods, ninebark's cinnamon bark; defaults to a neutral
brown when absent, so only declare it where the stem IS the show). A winter
that declares only `twig` draws bare coloured stems and nothing else, which is
exactly the red-twig dogwood effect. `bloomMonths` drives the real-world Bloom Calendar and,
unless a precise `bloomDay` is set, the continuous live bloom window. Keep
`bloomDay` for intentionally staggered within-season animation.

### Units and footprint policy

The plant model deliberately separates **inches-truth** from **px-art**. If a
rule, export, plan, or footprint needs real size, it must read inches fields and
convert through the shared helpers. If a renderer needs a pleasing sprite, it
may read px-art fields. Do not let those two paths drift together again.

| Field | Unit | Policy |
| --- | --- | --- |
| `space` | real inches | On-center planting distance. Used for export quantities, matrix spacing, spacing copy, and tree soft-spacing warnings. |
| `spread` | real inches | Mature width. The source for woody crown/footprint radius through `woodyRadiusTiles(P)`; also used in cards/library/plan labels. |
| `h` | pixels | Mature render height, a drawing hint for `drawPlant` and sprite sizing — displayed through **`plantVisualH(P)`** (the universal drawn-height transform: trees/shrubs rescale by the woody compression factor, herbaceous grass/sedge/forb/water scale by `HERB_SCALE` ≈1.75 so drifts read as masses (H1), bulbs pass through). Every herbaceous form derives its whole geometry from the drawn height, so this one factor scales width and height together and preserves each species' proportions. `h` is not a footprint, shade, order, or spacing unit. Cards/library report `heightIn||h`; herbaceous px h sits near 1:1 with inches. (`woodyVisualH` is a back-compat alias for `plantVisualH`.) |
| `heightIn` | real inches | True mature height. Required on every `type:'tree'` species (px `h` under-reads trees ~8×) and set on cultivars that mature meaningfully shorter (weeping maples, Snow Fountains cherry). `matureSizeText` (card + Library) prefers it; the height overlay reads `heightIn||height||h`. |
| `cw` | pixels | Woody canopy/twig drawing width, via `woodyVisualCw(P)` (T10: trees blend `cw` toward true screen width in log space, so the stored value is the shape signal, not the on-screen size). It must not define shade reach, shrub reservations, plan circles, or mature canopy overlays. |
| `look.topScale` | display multiplier | Optional extra sprite/canvas headroom for a plant whose flowering structure rises materially above its foliage mass (for example sotol). `plantArtTop(P)` applies it only to bounds and icon scaling; it must not change physical dimensions or placement footprint. |
| `grow` | years | Woody establishment horizon. `plantEstab(p)` scales real age; `effectiveEstab(p)` is the visual lens described below. |

Footprint rules are intentionally asymmetric:

| Plant/object | Hard footprint | Soft or visual reach |
| --- | --- | --- |
| Herbaceous grasses/sedges/forbs/water plants | One plant tile, or a stored sub-tile art offset when free planting is on. They do not reserve `spread`. | `space` drives matrix/export spacing; `spread` is mature-width metadata. |
| Bulbs | One bulb-layer tile. They may share with non-woody plants, but not a woody trunk or mature shrub reservation. | Seasonal bulb art comes from `bulbEnvelope()` and `bloomDay`. |
| Shrubs | Mature rounded footprint from `shrubFootprintTiles(..., true)`, using `woodyRadiusTiles(P)` from `spread`. Paths, water, structures, bulbs, and perennials refuse it; compatible hedges may connect edge-to-edge. | Faint base/hover/focus/pulse/ghost rings reuse the same mature footprint. |
| Trees | One hard trunk tile. Canopy area is deliberately open for underplanting except for the separate shade-suitability rule. | Shade, plan circles, placement ghosts, and the Mature Canopies overlay use `woodyRadiusTiles(P)` from `spread`; spacing is a soft warning from `space`. |

`effectiveEstab(p)` is **display-only**: it equals true `plantEstab(p)` in
normal views and `1` in Design mode's Established preview. Direct consumers
include shade washes/stunting, tree plan circles, and shrub footprint styling;
related mature ghosts/cards must match the same mature radius/copy contract
without changing placement rules. Placement legality reads true establishment
(or the explicit shrub mature-reservation policy above), so changing the preview
never changes what can be planted.

**To add a species:** add an entry in `plants.js`, reuse an existing `form` or
add a new branch in `drawPlant`. It automatically appears in the tool tray
(built from `PLANT_KEYS`). Match real botany — Kevin grows these; accuracy
matters more than prettiness, and that includes spacing/zone/native/resistance data.
Winter must show *structure*, not bare ground; that's the whole point.

**Sedge catalog:** keep one Sedge tab rather than adding habitat tabs. The tray
sorts it into data-driven Sun & meadow, Shade & woodland, and Wet & rain garden
headings; `moist:'moist'` is the rain-garden classification (the schema has no
`'wet'` value).

**Sedge visuals:** retain `bunchgrass` as the shared renderer. Use `look` values
(`mound`, `leaves`, `fan`, `leafLen`, `leafW`, `spread`, `dome`, `edgeDrop`) to
separate carpet, meadow, broad woodland, wet upright, and arching sedges. Palm
Sedge alone uses `sedgeHabit:'palm'`; shared `seedStyle` values (`mace`, `brush`,
`pendant`) communicate distinctive fruit without bespoke image assets.

## Conventions

- Vanilla JS, no framework, no bundler. Keep it that way unless explicitly asked.
- All rendering is canvas 2D. Colors flow from `AMBIENCE`, `PLANTS`, and the
  material tables' `tones` (§11a), not hardcoded in draw functions — change the
  palette in data, not in code.
- Stable visuals use `mulberry(seed)`, never `Math.random()`. Tile seed is
  `tileSeed(x,y)`.
- Respect `prefers-reduced-motion` (already handled in CSS).
- **Responsive tiers.** Two complementary media conditions decide the planner's
  shape, defined once at the top of the "Responsive tiers" comment in
  `styles.css`:
  - SHEET — `(max-width:767px), (max-width:1024px) and (orientation:portrait)`
  - DOCK — `(min-width:1025px), (min-width:768px) and (orientation:landscape)`

  They are exact complements. `SHEET_UI_MQ` / `mobileSheetUi()` in `tray.js`
  must match the SHEET string **verbatim** — if CSS and JS disagree, the
  tri-state sheet logic and the layout argue about which UI is on screen.
  Orientation is in there because a width-only 767/768 split handed portrait
  tablets the landscape layout: at 820x1180 the side dock took 44% of the width
  and left the garden — the actual product — a 459px slot.

  A third, orthogonal tier handles **short** viewports (`max-height:700px`, with
  a tighter `520px` step). Height was almost entirely unmodelled before, which
  is why phone-landscape and short desktop windows clipped navigation out of
  reach. When you add planner chrome, ask what it does at 430px tall, not just
  at 390px wide.
- **Light mode themes the CHROME, never the world.** `hortus:theme` is a
  device-local preference (`auto`|`light`|`dark`, like haptics and the rail
  side), cycled from **Appearance** in the Garden Menu. `auto` is resolved in
  JS, not CSS: a tiny inline bootstrap in `index.html`'s `<head>` stamps
  `data-theme="light|dark"` on `<html>` before first paint (no dark-flash, and
  `styles.css` needs one `[data-theme="light"]` block instead of a duplicate
  inside `@media (prefers-color-scheme)`). `applyTheme()` in core.js owns it
  afterwards and keeps following the OS while the pref is `auto`.
  - The garden is deliberately **not** themed — `AMBIENCE` drives sky/grass/soil
    and `PLANTS` drives foliage, and a meadow at midday is not "dark mode". The
    colour literals in `plants.js`, `draw.js`, and `world.js` are world art and
    must stay out of the theme.
  - Most surfaces are expressed as `rgba(var(--ink-rgb),X)` — "a little ink over
    the current surface" — so one channel flip inverts ~39 of them correctly
    instead of maintaining two parallel colour lists. Prefer that form over a
    new hardcoded rgba.
  - **Canvas cannot resolve CSS variables**, so the ~40 chrome icon literals go
    through `uiInk('--icon-ink' | '--icon-ink-soft' | '--icon-ink-dim' |
    '--icon-warm' | '--icon-halo')` in core.js, which caches the computed values
    and is invalidated by `applyTheme()` (which then rebuilds the icons). A new
    canvas icon that hardcodes a light neutral will be invisible in light mode.
  - Accents move between themes: bronze `#c97f3f` reads 5.3:1 on loam but only
    3.2:1 on paper, so light mode uses a deeper `--color-accent` and
    `--color-accent-700` is "the higher-contrast step against the surface" in
    *both* directions (lighter on loam, darker on paper) — reach for it on small
    caps rather than plain accent.
  - The HUD's `color-mix(--color-text N%, transparent)` text ramp is **not**
    symmetric (52% seedhead over loam is bright; 52% loam over paper is washed
    to 3.25:1), so `[data-theme="light"] #hud` overrides it with solid inks.
    Both themes are verified at 0 contrast failures across 23 sampled elements.
- **Forced colors.** `@media (forced-colors: active)` is load-bearing here, not
  a nicety: ~54 buttons draw their icons to `<canvas>`, and forced-colors does
  not recolour canvas bitmaps, so without it the whole tool system renders as
  blank boxes in Windows High Contrast. Selection also signals with background
  colour alone, which forced-colors discards — armed/selected states re-signal
  with `Highlight`/`HighlightText` and an explicit border. Any new canvas icon
  or background-only selected state needs a line in that block.
- Interface icons use the hidden local SVG symbol set in `index.html` plus
  `uiIcon` / `setUiIcon`; do not reintroduce emoji or mixed Unicode glyphs for
  navigation, state, close, delete, or menu actions. Botanical previews and
  editing-tool illustrations remain canvas-drawn.
- UI motion uses `--motion-control` (110ms), `--motion-menu` (160ms), and
  `--motion-panel` (200ms) with the shared easing tokens. Controls may move
  down 1px on press; panels rise/fade by 8px; menus use a short directional
  reveal. Keep motion out of the garden renderer and preserve the global
  reduced-motion override.
- Keep application chrome on the semantic design tokens in `styles.css`.
  `--surface-overlay`, `--surface-workspace`, and `--surface-dialog` express
  information over the canvas, persistent editing controls, and deliberate
  stops respectively. Neutral controls use the shared control/border/text
  tokens; bronze is reserved for the primary action or armed state, the cool
  selection tokens identify selection geometry, and danger tokens identify
  destructive state. Controls use `--radius-control`, containers use
  `--radius-panel`, and true capsules alone use `--radius-pill`. Reuse the
  spacing, shadow, focus, and disabled-state tokens instead of adding close
  one-off values. `#hud` softens the radius scale slightly (10px/20px vs the
  root's 5px/9px) but must **not** redefine it into pill territory: it used to
  set `--radius-control:999px`, which gave the planner and the modals launched
  from it two different visual languages one tap apart, forced a growing list
  of per-component re-overrides, and lozenged everything that was not a capsule
  (`.active-tool-status` is a three-line text block). Controls that genuinely
  are capsules declare `--radius-pill` for themselves.
- Treat canvas guidance as contextual workspace help, not permanent chrome:
  `#activeToolStatus` briefly names the armed tool and its next canvas action;
  multi-step building-footprint progress remains visible until the outline is
  completed or cancelled. Dialogs
  use the shared `openOverlay` / `closeOverlay` focus path, trap keyboard focus,
  restore the opener on close, and use the dialog surface/scrim tokens. Compact
  view and layer flyouts expose menu state through ARIA. The mobile palette has
  collapsed, half, and full states reachable by swipe and explicit down/up
  controls; its full height stays below the top safe area and scrolls the
  catalog internally.
  Gesture-only affordances get a one-time contextual coach rather than a
  permanent help wall. Haptics are capability-gated, default off, stored as
  `hortus:haptics`, and fire once per completed placement/success or throttled
  invalid action — never for every tile in a continuous paint gesture. The
  left-handed rail preference is likewise device-local (`hortus:leftHanded`).
- Copy style: plain, gardener-facing, a little dry. Errors/empty states give
  direction, not mood. (e.g. "Nothing here to lift." not "Oops!")

## Direction & backlog

**Scope pivot (current direction).** The project is **Design-first**: the
planner plus the **Daily design challenge**. The avatar **Story Mode** — the
cozy Animal-Crossing-ish original — had a heavy build-out (seed propagation,
NPCs, a town/shop, an economy, a multi-location world) that was explored and
**cut** as too big for a no-framework canvas app (the propagation feature was
built, then reverted in "Remove Story-mode seed propagation"); the mode itself
is now **retired from the menu** — you can't start one, and the
creation/character-creator paths are unreachable. Its avatar/movement code lives
on for the two lightweight, **backend-free** features that replaced it, both now
**built**: **Visit Gardens** (stroll your saved or imported gardens as the
cat/dog avatar, read-only — the `Visit` button on each **View Gardens** row;
the Design-a-Garden list omits it) and
**share-a-file** garden export/import (`btnShare` / `btnImport`). Live
cross-device multiplayer stays deferred. (Fuller record: `docs/direction.md`.)

Still open: woody follow-up — tree canopies rendering across tile boundaries
with their own depth slices. A real multiplayer backend (reimplement
`sGet`/`sSet` against a small server — see Known constraints) is only needed if
live cross-device visiting is ever built.

- **Matrix/scatter mode** — interplant a grass matrix with scattered perennials.
- **Plant health / water** — establishment can fail; watering during dry spells.
- **More species** — two native-gap passes and a focused European/Oudolf pass are
  landed (purple and white prairie clovers, blue grama, northern sea oats,
  ironweed, woodland-edge goldenrod/aster, turtlehead, golden ragwort, trout
  lily, Michigan lily, large beardtongue, rough-stemmed goldenrod, moss phlox,
  false sunflower, Molinia 'Transparent', Macedonian scabious, great masterwort,
  Pyrenean sea holly, stonecrop 'Matrona', and mountain fleece 'Firetail').
  A **landscape-shrub pass** is landed — the ordinary flowering backbone the
  catalog was missing between prairie forbs and clipped boxwood: ninebark,
  red-twig dogwood, a five-species Viburnum group (arrowwood, cranberrybush,
  Koreanspice, doublefile, blackhaw), a Lilac group (common, Miss Kim,
  Bloomerang), a Spirea group (Japanese, bridal wreath), winterberry holly,
  black chokeberry, and inkberry holly. It added five shared `bush` `look`
  knobs rather than per-species branches — `bloomStyle` (`cluster` corymbs,
  `panicle` lilac trusses, `spray` arching canes), `twigN`, `berryN`, the
  per-season `twig` colour, and `broadleaf` (an informal evergreen leafy mound
  in the `clip` family, used by inkberry — NOT a smooth clipped topiary ball;
  distinct from boxwood's smooth dome and yew's needle sprays). Still open: forsythia and witch hazel (both want a
  bloom-along-bare-stem style), elderberry, buttonbush, shrub roses,
  summersweet, Virginia sweetspire, fothergilla, beautyberry (`seedAlong`),
  and a dwarf-conifer set (spreading juniper, bird's nest spruce, mugo,
  arborvitae column) that should reuse the yew `needles` spray with new
  colours and shapes. Further regional bulb expansion remains open.
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

### UX + design-feature roadmap (waves)

The agreed build order, from a UX/UI audit + a curves/brushes/features
consultation (mid-2026). Ordered by **what unblocks what**, not raw priority.
Four sequencing calls drive it: (1) **WYSIWYG comes early** — every visual
feature is judged through it, so it precedes the feature work; (2) **stabilize
mobile cheaply now, do the full sheet redesign last** — the bottom sheet's final
contents (Fill + brush-size + Matrix) must be frozen before it's redesigned, or
it gets built twice; (3) the **cursor footprint ghost** and the **disc-brush
engine** are shared primitives (brush size, erase, curves, plant-spacing ghost
all consume them) so they're built once, before their consumers; (4) **brush
size precedes curves** — a big disc brush dragged in an S *is* the curved path,
so shipping the brush is half of curves. Anything touching the render loop
(preview toggle, ghost, curves, overlays) lands behind the debug-HUD phase
timers and, if it feeds a cache, becomes part of that cache key — A/B on a
stress garden before merge (see the perf notes in §11).

- **Wave 0 — Stop the bleeding** (small; nothing built on top until fixed):
  re-wire flood fill (Fill chip → `game.fillMode` in the brush bar; rename the
  Select tray's button to "Fill area" in the same edit — the flood-fill UI entry
  was lost when Fill moved to the Select tray, and `nothing sets fillMode=true`);
  de-compress the phone tray (`min-height` on tab rows + handle, vertical scroll
  in the catalog — this cheap stabilization is what lets the real sheet redesign
  wait for Wave 4); re-pin popovers + re-`snapCam` on resize/orientation; fix the
  search glyph to a drawn canvas icon.
- **Wave 1 — A planner you can trust your eyes in** (the lens for all later
  visual work; cheap): pause the clock by default in design mode (season box
  shows the paused state it already supports); "Today / Established" preview
  toggle (renders `plantGrowth` clamped to 1 — the sprite key already buckets
  growth), defaulting new design gardens to Established; armed-brush visibility
  (rail swatch reusing `drawSheetSwatch` + stop the silent auto-arm on tab open);
  Duplicate garden (copy the localStorage blob + index row — one-afternoon
  freebie).
- **Wave 2 — Shared interaction primitives** *(done — `brushOffsets` disc
  predicate + `game.brushSize` + `stampBrushAt`; `sizable` flag on
  path/bed/water/raise/lower/level; erase unified onto the shared size;
  size dots in the brush bar + Erase tray via `setBrushSize`; cursor footprint
  ghost `drawBrushGhost`, cream for paint / red for erase, hover-only)*:
  cursor footprint ghost (generalize `drawShrubFootprint` — previews disc area,
  erase area, and plant spacing before commit); disc-brush engine (shared
  `game.brushSize`, a disc predicate generalizing `eraseBrush`'s box loop; unify
  erase sizing onto it; `sizable` flag in `TOOLS`; size dots in the brush bar,
  reused in the erase control).
- **Wave 3 — "Curves & Brushes"** *(done — smoothed terrain via
  `buildTerrainRegions`/`paintTerrainBlobs` with the `terrainLoopCache` keyed by
  `groundDataSig()`; `game.edgeStyle` organic/formal, seeded by
  `edgeStyleFromType`, Edge chips in the Landscape tray; `game.matrix` scatter
  gated by `matrixSpacingBlocks` in `placePlantAt`, Matrix beside Draw/Drift)*:
  smoothed terrain rendering — reuse the plan sheet's `traceOutlines`/`smoothLoop`/
  `planJitter` pipeline in `paintGround`, **caching traced loops in world space
  keyed by `groundDataSig()`** so tracing runs only on edit, not per pan frame
  (data model unchanged — tile-truth for rules; the spline is inward-bounded);
  Organic/Formal edge style on Path/Bed chips, defaulted from the questionnaire
  style (`prairie`/`cottage` → organic, `formal`/`modern`/`japanese` → crisp);
  Matrix/scatter brush ("Matrix" beside Draw/Drift — places a species at its real
  `space` within the painted region, skipping occupied tiles, enabling two-layer
  interplanting).
- **Wave 4 — Definitive mobile redesign** (now that the sheet's contents are
  frozen): tri-state bottom sheet (collapsed/half/full via drag on the handle —
  `applySheetState` has the seam), chip-dropdown category nav, `[⋯]` view-tools
  consolidation (Select/Rotate/Layers/Ruler), 44px rail, Erase → popover on the
  rail button (stops evicting the catalog); zoom pill + fit-plot (also heals the
  resize-stranding); two-finger-tap undo / three-finger redo; visible move-cancel
  on touch; selection actions in a pill anchored to the marquee (desktop/tablet).
- **Wave 5 — Measure & analyze** *(built)* (the ruler + the overlay family, shared render
  pattern): tape-measure mode (tap-tap or drag, reusing `drawSelDimLine`/
  `selMetricLabel`; entry via top bar / view-tools popover) + a free
  cumulative running-length label during path/fence drags (fast pointer gaps
  are filled and visited edges are counted once), plus unique painted-area
  feedback for bed/water. Selection actions show dimensions/area and More →
  Estimate materials computes actual selected bed area, exposed edging, 2/3/4in
  mulch volume, placed counts, and armed-species spacing estimates. Overlay
  family clustered (touching the Layers overlay section once):
  edge-rulers overlay (desktop/tablet only), hydrozone/moisture overlay (`moist`
  data), `heightIn` data pass + height overlay, real eye icons in the Layers
  menu; global plant search scope with jump-to-category.
- **Wave 6 — Site-accuracy & polish** *(built)*: true north at plot setup and
  Build → Site (an arbitrary clockwise bearing rotates the derived sun path,
  compass markers, plan arrow, shade maps, and tree-placement shade preview);
  exact species+cultivar replacement from plant details
  or selection More, scoped to one/selection/garden with preflighted blocked
  positions and one undo step; *(built)* one calibrated site-photo reference
  under Build → Site (drag/pinch transform, two-point known-distance
  calibration plus a full-photo-width fallback, opacity, fit/rotate/nudge,
  Cancel/locked Done, visibility in Layers). The photo is
  resized to a bounded JPEG data-URL and stored as `game.underlay` outside
  `GAME_LAYERS`, so ordinary undo snapshots never clone its base64 payload. It
  composites above the opaque ground cache but below plants, structures, and
  analysis overlays. A device-local left-handed preference mirrors the mobile
  tool rail and its dependent transient chrome while preserving the user's
  camera and the rest of the HUD.
- **Floaters** (no hard dependency, pull forward on appetite): **bloom/interest
  calendar** (rows = species, columns = seasons early/mid/late, cells tinted by
  actual bloom color — pure presentation over existing `bloomLevel` data, a
  quick credibility win, natural alongside plan-sheet work); **replace-species**
  (the natural companion to the Matrix brush — promote out of Wave 6 if
  palette-iteration friction bites during Wave 3).

### Trees & Shrubs roadmap (T1–T12, from the mid-2026 woody audit)

An architecture/UX audit of the woody-plant system produced twelve tickets in
three phases. Core findings it addresses: the Established preview was
visual-only (mature-looking trees cast no shade, drew dot-sized plan circles);
trees have no footprint or spacing while shrubs hard-reserve mature spread;
tree visuals are ~24× compressed vs near-1:1 perennials (white oak `cw:160`px
≈ 2 tiles drawn vs `spread:900`″ = 50 tiles real); spread→radius conversion is
written four ways before T2 centralized it in `woodyRadiusTiles`/
`woodyVisualCw`; everything woody hard-blocks (no soft warnings); placement
previews are shrub-only and desktop-hover-only; selection moves bypass
footprint invariants. Guiding principle (T1, now load-bearing): **what you SEE
follows the preview; what's LEGAL never does** — rules plan for maturity the
way shrub reservations always have (`shrubFootprintTiles(..., mature=true)`).

- **Phase 1 — model coherence (before any new woody features):**
  - *(built)* **T1 `effectiveEstab`** — one establishment lens for visuals
    (shade washes/stunting, plan circles, footprint styling, card) vs true
    establishment for placement rules; dual shade-map slots
    (`ensureShadeMap(real)`); preview flag in `sceneKey`/`shadeMapKey`;
    hover shade diamond red only where placement actually refuses, amber for
    preview/future canopy. See the §9 note.
  - *(built)* **T2 unify spread→radius** — one `woodyRadiusTiles`/
    `woodyVisualCw` + `isTreeDef`/`isWoodyDef`; swept the stringly
    `type==='shrub'||type==='tree'` runtime sites. Zero behavior change.
  - *(built)* **T3 tree placement rules** — the trunk stays a hard one-tile
    footprint (occupancy already stops two trees, or a tree and a
    perennial/bulb, from sharing a tile); the canopy area is deliberately
    left open for underplanting, and bulbs-under-canopy is allowed (only the
    same trunk tile refuses, via the existing woody check). The new behavior
    is a **soft same-/mixed-species spacing warning**: `nearestTreeCrowder`
    (world.js) finds the closest tree the just-placed one lands inside the
    spacing of — judged by the AVERAGE of the two species' `space`, so a big
    oak beside a small redbud is rated by their real needs — and
    `treePlacedMessage` (commands.js) toasts it in real feet on placement. It
    never blocks (previews T9's soft-warning direction). Trunk multi-tile
    footprints for giants were scoped out (a real trunk is ~1 tile; visual
    mass is T10's job, not a rules footprint). Test: "trees soft-warn on
    crowded spacing but never block, and the trunk refuses underplanting".
  - *(built)* **T4 selection ops respect woody footprints** — `selValidDest`/
    `commitSelectionOffset`/`rotateSelection` validate moved shrubs (and T3
    trunks) like house placement already does (`shrubFootprintOverlapsRect`).
    Test: "selection move validates shrub footprints and tree trunks".
  - *(built/current)* **T11 QA** — woody tests now cover the landed rules:
    T1's display/rules shade-map split plus scene stunting, T3's trunk refusal
    and soft spacing warning message, T4's selection-move refusal, T5's
    placement ghosts, T6's plan radius/legend path, and T8's mature canopy
    overlay. T9-specific assertions should be added with that behavior.
- **Phase 2 — make the model visible:**
  - *(built)* **T5 placement ghost for trees/shrubs** — trunk diamond + dashed mature
    canopy + shade sweep before drop; on touch, anchored to the armed state
    (no hover exists). Ghost must reuse the same radius function as placement.
  - *(built)* **T6 honest plan sheet** - canopy circles use the display lens
    (Today = current reach, Established = mature reach); the legend explains
    dashed mature crowns, and shrub blobs use the T2 radius function.
  - *(built)* **T7 woody plant card + Library sizing** — lead with mature H×W in feet
    (`plantMeasure()`/`matureSizeText()`), years-to-size, "crown covers ~N tiles"; Library's
    Mature size line gains height.
  - *(built)* **T8 "Mature canopies" overlay toggle** — Layers→Overlays, dashed rings
    for all woody at mature size; off by default, flag-gated like Shade.
  - *(built)* **T12 docs** — plants.js/CLAUDE.md document per-field units
    (inches-truth: `space`/`spread`; px-art: `h`/`cw`) and footprint policy.
- **Phase 3 — behavior changes and the big lifts:**
  - *(built)* **T9 soft-warning policy** — `PLANT_PLACEMENT_POLICY`
    (commands.js) states each placement rule's mode in one table: occupancy,
    shrub core, woody trunk, and water stay HARD; active-canopy-sun and tree
    spacing are SOFT. Full-sun plants place under an active canopy with an
    amber warning toast (`toast(msg,'warn')`, `#toast.warn`) — the stunted
    render and Struggling card already show the consequence.
  - *(built)* **T10 woody visual rescale + age-at-placement** — TREES only
    (shrubs already drew at ~half true width): `woodyVisualCw` blends art
    `cw` toward true screen width in log space (`exp(0.58·ln cw +
    0.42·ln realPx)`, capped below real) — white oak 160→605px (~3.8×, ~16%
    of true 3800px), redbud ~3×, small trees nearer real; narrow cultivars
    stay narrow because `cw` remains the shape signal. `woodyVisualH` scales
    `h` by the same factor; inside the tree/conifer/bamboo branches a `vs`
    factor scales trunk/branch strokes, flower/seed sizes, and leaf blobs
    trade size for count (`leafMul`, coverage constant) so giants read as
    foliage, not balloons. Icon/preview fits (tray ×3, sheet swatch,
    library) measure `woodyVisualH` so big trees aren't clipped. **Age seg**
    (New/Young/Mature) replaces the no-op Grid/Free for woody brushes:
    `game.woodyAge` + `chooseWoodyAge` + `woodyPlantedDay(def,age)` backdate
    `d` by whole `YEAR_DAYS` (growing-day exact: Mature = full `grow` years
    → estab 1, Young ≈ half); design mode defaults Mature, story New. A
    mature-placed tree drives TRUE-establishment shade at once, and (per T9)
    full-sun underplanting still places with the amber warn. **Sprite
    safety**: `makePlantSprite` clamps giant bakes to ≤1024px instead of
    bailing (blit upscales slightly soft at high zoom); entries carry
    `want`/`capped` so resolution-capped giants never rebake while zooming
    in. Stress A/B (562 plants, 35 mature trees + 59 mature shrubs):
    75ms procedural / 11.7ms sprites — statistically identical to the same
    garden un-aged (77/12.6), i.e. no stress regression; realistic mature
    design garden (200 perennials + 6 mature trees) runs 1.8ms/frame.
    Follow-ups landed with it: **`heightIn`** (real mature inches, required
    on all trees + shorter cultivars — see the units table) so the plant
    card/Library report a white oak as 90 ft, not the px-art 11 ft; and a
    lower **tree sapling floor** (0.12 vs the classic 0.25/0.3 in draw.js —
    the sprite box keeps the bigger floors as safe margin) so a day-one
    tree draws as a whip (~12% of mature height, pixel-verified 61px vs
    521px) instead of a 20-ft "sapling".
  - Then: tree canopies rendering across tile boundaries with their own depth
    slices (the long-standing woody follow-up above), seasonal canopy,
    growth-timeline scrub.
