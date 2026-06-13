# Hortus Perennis

A 2.5D perennial-gardening game in the spirit of Piet Oudolf's naturalistic
planting style, playing loosely like Animal Crossing. Cat/dog avatars tend an
isometric prairie plot where plants change appearance by season. Solo play plus
shared gardens for up to 4 people.

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
- There is no test suite. After edits, run `node --check game.js` to catch
  syntax errors before reloading the browser.

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
   woody shrub, `tree` deciduous, `conifer`). Reads the season's `fol`/`bloom`/`seed`/`eye` colors; woody
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
   tool, multiplayer presence, timing).
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
    it seeded once on load). The house lives in `game.house`
    (`{x,y,w,h,wall,roof}`, sized in real feet via `HOUSE_SIZES`);
    `inHouse`/`doorPos`/`isDoor`/`canStand` derive from it (door tile
    centered on the south side; standing there and acting sleeps to the
    next day). `defaultHouse()` picks a shed on small plots, a cottage on
    big ones. `tileTerrain()` reads player-laid terrain from `game.terrain`.
11. **`render(t)`** — sky, then a camera-windowed pass: the four screen
    corners invert (via `tileAt`) to a padded world-tile bounding box, and
    only those tiles/entities draw. Ground tiles (grass / walkway / laid path
    / bed / flagstone doorstep) back-to-front, a single depth-sorted entity
    pass for the cottage + plants + critters (sorted by `x+y`), planting
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
    the door tile; chips resize/repaint), shovel **drag-sweep**
    (pointerdown with shovel starts a sweep; dragging lifts every plant
    crossed, and clears laid path/bed on tiles with no living plant —
    plants take priority, so a planted bed needs two passes; one toast +
    sync at pointerup), tap and keyboard input. All placement funnels
    through `applyToolAt(x,y)` (silent; handles plant/bulb/path/bed rules —
    bulbs ignore plant occupancy and shade, plants check `shadeAt`, paths
    refuse planted tiles). **Drag-to-plant**: pointerdown with a
    plant/bulb/path/bed armed defers; crossing a tile line turns the
    gesture into a paint-drag that applies the tool to every tile crossed
    (one toast + sync at pointerup via `finishToolDrag`), while a plain
    tap resolves at pointerup to the classic walk/act (`tapAction`). With
    the Drift toggle on, single planting calls `stampDrift()` — a loose
    shuffled cluster sized by spacing (`driftCount`: ≤6" → 9, ≤12" → 7,
    ≤18" → 5, ≤30" → 3); woody plants always plant singly. The shovel
    lifts plants, then bulbs, then terrain. **Keys map to SCREEN directions**
    regardless of rotation: one key is a screen-cardinal step (a view
    diagonal); two keys combine into view axes; `viewDirToWorld` converts to
    world steps. Tapping the house walks to the door and sleeps on arrival.
13. **Storage / multiplayer** — `sGet`/`sSet` over localStorage. Solo worlds
    are named slots: `hortus:worlds` is the index `[{id,name,ts,gw,gh}]`,
    each save lives at `hortus:world:<id>` (plants + bulbs + terrain +
    gw/gh + rot + house + name + `wv` walkway flag). The old single `hortus:solo` key
    migrates into the first slot once. Older saves with only `grid` load
    square; 13x13-era saves recenter from (6,6). Autosave on day change is
    silent; the Save button toasts. Host/join shared worlds via shared keys
    (meta carries gw/gh; the house syncs via its own key, last-write-wins
    by timestamp), presence polling, `mergeMap` for plants and terrain.
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
    bulbs → scatter rings; house, paths/beds, title block, north arrow,
    legend with `planCodes` (unique genus/epithet abbreviations + cultivar
    tag), and a 10-ft scale bar. `downloadPlan()` saves a 2× PNG; the plan
    also prints (own page). Empty gardens render an empty sheet, no crash.
15. **Region filter + HUD** — `plantFits()` (zone range, natives-only,
    ecoregion membership for natives; cultivars have `eco:[]` so only the
    natives-only switch hides them), `trayKeys()` (filtered, grasses → sedges
    → forbs), the region-picker overlay wiring, and the tool tray:
    `TRAY_CATS` category tabs (Grasses / Sun Perennials / Shade Perennials
    (`sunFilter` splits forbs+sedges by `sun`) / Bulbs / Shrubs / Trees /
    Dig / Landscape / House — a tool tab arms its first tool on click, and
    browsing a plant tab disarms house/shovel so taps go back to walking),
    species buttons in the active category (species sharing a
    `group` collapse to one button), and `renderCvRow()` chips: group
    members and/or cultivars of the selected species (the planted tile
    stores `v`; tool state is `game.tool` + `game.toolVar`). The House tab
    is its own icon tray: Place tool + size/wall/roof buttons in labeled
    sections (`.tray-sep`). A search input in the tabs row filters the open
    category by name/latin/group (`applyTraySearch`, display:none — no
    rebuild, so typing keeps focus; inputs are excluded from game keys).
    Plus season dial, sleep button, plant-list, region, rotate, photo, and
    plan buttons (a compact icon bar; labels hide on small screens, the
    region label shows the active filter), contextual action hint. There is no
    Save button — autosave fires on day change, quit, and
    visibilitychange/pagehide. Zoom: `ZOOM = baseZoom (0.75 on phones) ×
    userZoom`, driven by pinch (two-pointer tracking in the canvas
    handlers), mouse wheel, +/- keys, and the fixed right-side zoom pill;
    `setUserZoom` clamps and snaps the camera. On phones (`baseZoom<1`) a
    big contextual action button (`setActButton`: Plant here / Plant a
    drift / Dig here / Lay path / Dig bed / Sleep; hidden for the House
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
- **Undo** — snapshot plants+terrain before sweeps/placements; one level is enough.
