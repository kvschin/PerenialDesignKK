# Pocket Prairie Garden Design

A 2.5D perennial-gardening designer in the spirit of Piet Oudolf's
naturalistic planting style. The app is part garden planner, part gentle
isometric garden game: cat/dog avatars walk a prairie plot where plants change
by season, and the designer can export planting lists and plan-map views.

The project is still deliberately simple: plain HTML/CSS/JS, no framework, no
bundler, no build step. Markup lives in `index.html`, styling in `styles.css`,
plant/species data in `js/plants.js`, and game logic is split across `js/`
modules. Fonts load from Google Fonts; everything else should stay local unless
explicitly requested.

`index.html` script order matters. Keep `js/plants.js` before the app modules,
then preserve this order unless you are intentionally refactoring dependencies:

```html
<script src="js/plants.js"></script>
<script src="js/core.js"></script>
<script src="js/draw.js"></script>
<script src="js/world.js"></script>
<script src="js/view.js"></script>
<script src="js/renderer.js"></script>
<script src="js/commands.js"></script>
<script src="js/input.js"></script>
<script src="js/io.js"></script>
<script src="js/ui.js"></script>
<script src="js/tray.js"></script>
<script src="js/library.js"></script>
<script src="js/screens.js"></script>
```

## Run / test

- Open `index.html` in a browser, or serve the folder to avoid `file://`
  quirks: `npx http-server -p 8642 -c-1`.
- Live deployment: GitHub Pages serves `master` as-is at
  <https://kvschin.github.io/PerenialDesignKK/>. Every push to `master`
  redeploys automatically.
- For syntax checks, run `node --check` on touched modules, for example:
  `node --check js/view.js`.
- For regression coverage, run `node tests/run.js`. The current test harness is
  plain Node and covers plant data plus core game behavior.
- `package.json` still contains some legacy script paths. Prefer the direct
  commands above unless that file has been updated.

## Known constraints

- Storage is `localStorage`. `sGet`/`sSet` keep async signatures but read/write
  local browser storage. The shared flag is accepted for compatibility; true
  cross-device multiplayer still needs a backend.
- Mobile is first-class. Keep `touch-action: none` on canvases and do not
  assume mouse-only input.
- iOS home-screen/PWA viewport behavior is tricky. The app has explicit canvas
  sizing logic for standalone Safari quirks; test changes on a phone before
  declaring viewport fixes done.
- The world rotates in 90-degree view steps. World logic stays unrotated;
  `worldToView`, `viewToWorld`, and `viewDirToWorld` handle mapping.
- Canvas rendering is 2D and procedural. Keep visuals deterministic with seeded
  RNG when the result must be stable across frames or saves.

## Module map

- `js/core.js`: constants, shared helpers, app-level configuration, cultivar
  merging, structure/light/firepit metadata, palette helpers.
- `js/plants.js`: plant species data, cultivars, and plant-library
  notes. This is the source of truth for botany-facing behavior.
- `js/draw.js`: all canvas drawing primitives, including plants, avatars,
  houses, fences, firepits, lights, terrain details, plan-map symbols, and
  seasonal visual treatment.
- `js/world.js`: the mutable `game` object, layer definitions, state mutation
  helpers, time/season helpers, phenology, shade/canopy math, house and
  collision helpers, terrain lookup, iso/view math, safe spawning, and world
  sizing.
- `js/view.js`: garden canvas glue: active canvas sizing, viewport/PWA sizing
  probes, zoom state, active canvas switching, resize handling, and compass
  updates.
- `js/renderer.js`: garden rendering: `render(t)`, visible-window gathering,
  ground and plant sprite caches, entity sorting, overlays, selection metrics,
  shade/night/season passes, and snow/photo effects.
- `js/commands.js`: state-changing garden commands: movement steps,
  `actHere`, `applyToolAt`, placement hooks, drift stamping, erase, selection
  mutation, saved-area paste/fill, house/fence/light/firepit placement, undo,
  and toasts.
- `js/input.js`: canvas and keyboard input wiring: held movement keys,
  pointer/touch/wheel handlers, pinch protection, panning, brush drags,
  shovel sweeps, tap-to-act/walk, and `followPath()`.
- `js/io.js`: save/load, import/export, localStorage persistence, autosave,
  planting-list export, design-plan export, bloom calendar, and shared-world
  compatibility hooks.
- `js/ui.js`: HUD and in-game DOM updates, time controls, action button,
  top-bar state, menu/status copy, plant cards, and overlay wiring.
- `js/tray.js`: tool metadata (`TOOLS`, `toolMeta()`), bottom catalog, category
  tabs, cultivar/group chips, brush memory, search, layers menu, build tools,
  and tray rendering.
- `js/library.js`: the plant library screen. Category sections are collapsible
  and search opens sections containing matches.
- `js/screens.js`: screen transitions, title meadow, new-world flow, saved
  worlds, settings, daily challenge, and the main `loop(t)`.

## State and tool architecture

`game` is the single mutable model. Layer maps include plants, bulbs, terrain,
elevation, fences, lights, and firepits; houses are stored in `game.houses`.
Layer names live in `GAME_LAYERS` and should be used for save/load, sync, undo,
and generic layer operations.

Use the centralized mutation helpers for model edits:

```js
markModelChanged();
setTile(layer, key, val);
clearTile(layer, key);
addHouse(house);
removeHouseAtIndex(index);
```

These helpers set `game.dirty` and increment `game.rev`. Do not add new direct
edit paths that write to `game.plants`, `game.terrain`, `game.fences`,
`game.lights`, `game.firepits`, or `game.houses` without going through these
helpers or a clearly named wrapper. Direct writes make autosave, undo, render
cache invalidation, and future sync harder to reason about.

`toolMeta()` in `js/tray.js` is the source of truth for active tools. It should
describe which layer a tool edits, whether it is a brush, what it paints, and
any special apply behavior. Add new tool behavior there first instead of
scattering category checks through input handlers.

`applyToolAt(x, y, opts)` in `js/commands.js` is the silent dispatcher for brush
placement and material application. Gesture handlers, selection fill, drift
planting, and tap actions should funnel through it. User-facing wrappers like
`actHere()` can add toasts, movement intent, or one-off affordances, but should
not duplicate placement rules.

Call `syncToolLayer(what)` after a batched gesture or selection operation, not
after every tile in a drag/fill. That keeps interaction responsive and makes
shared/local persistence behavior predictable.

## Input and gestures

Pointer input flows through `js/input.js`: pointer down decides whether the app
is panning, pinching, selecting, erasing, dragging a brush, or tapping. Pinch
gestures must cancel pending placement with `cancelCanvasGesture(true)` so
two-finger zoom cannot accidentally plant or erase.

Selection owns its selected payload at selection time. Move, copy, erase, fill,
and saved-area operations should use selection helpers plus undo snapshots, and
then mutate layers through `setTile`/`clearTile`.

The Plant brush remembers the last chosen plant/category/options. When adding
new build tools or plant categories, preserve that "return to where I was"
behavior; it is important on mobile.

Keyboard movement maps to screen directions, then converts to world steps via
view helpers. Do not mix screen-space movement and world-space movement without
checking rotated views.

## Rendering

`render(t)` draws every frame from the main loop. Dirty flags do not gate
rendering; they mark state changes for saves, revisions, and cache invalidation.
The renderer uses a camera-windowed tile pass plus depth-sorted entities. Keep
expensive work outside the inner frame loop when possible.

Ground, plant, and structure visuals should stay deterministic. Use
`tileSeed(x, y)` or another stable seed with `mulberry(seed)` when variation
must not flicker. `Math.random()` is fine only for transient UI effects that
are not saved and do not need to be stable.

Colors should generally flow from `AMBIENCE`, `PLANTS`, terrain/material data,
or tool metadata rather than one-off literals inside draw branches.

## Plant data model

Each entry in `PLANTS` is the contract the game renders, filters, plans, and
exports against:

```js
key: {
  name: 'Little Bluestem',
  latin: 'Schizachyrium scoparium',
  form: 'bunchgrass',
  type: 'grass',              // grass | sedge | forb | bulb | water | shrub | tree
  h: 46,                      // mature render height in px
  space: 18,                  // on-center spacing in inches
  spread: 18,                 // mature width in inches
  zones: [3, 9],
  native: true,
  sun: 'full',                // full | part
  moist: 'dry',               // dry | medium | moist | wet
  phen: 'warm',               // cool | mid | warm
  bloomMonths: [7, 8, 9],     // real-world bloom calendar months, 1-12
  grow: 10,                   // woody only: years to mature size
  cw: 150,                    // woody only: canopy/twig width in px
  cv: { theblues: {} },       // selectable cultivars
  libraryCultivars: [],       // library-only cultivar notes, not tray choices
  group: 'coneflower',        // optional group collapse in the tray
  chip: 'Pale Purple',        // label for grouped species/cultivar chips
  look: {},                   // form-specific drawing hints
  blurb: '...',
  sea: {
    Spring: { fol: '#7fa07a' },
    Summer: { fol: '#6e8f9b', bloom: '#efe6d3' },
    Fall: { fol: '#c0623b', seed: '#efe6d3' },
    Winter: { fol: '#a35a35', seed: '#f3ecdd' },
  }
}
```

`drawPlant` uses `form`, `h`, seasonal appearance, and optional look/stem
properties. Filters, export counts, plan maps, suitability warnings, and the
plant library use the rest.

To add a species, update `js/plants.js`, reuse an existing `form` when possible,
or add a focused drawing branch in `js/draw.js`. Match real botany: mature
height, spread, spacing, shade/water needs, seasonality, and winter structure
matter more than making every plant equally flashy.

Water plants use `type: 'water'` and should only place on water terrain.
Woody shrubs/trees establish over years and can occupy more than one tile.
Bulbs share space with plants and have their own seasonal envelope. Keep
`bloomDay` for in-game bloom timing and `bloomMonths` for real-world calendar
exports; if `bloomMonths` is missing, the calendar falls back to conservative
season-to-month estimates.

## UI conventions

- Keep the current dark, tactile, isometric UI style unless the user asks for a
  new visual direction.
- Left toolbar is for canvas actions. Bottom tray is for plants, materials,
  build categories, search, and placement options.
- Avoid duplicating the same action in both toolbar and tray. If a tool needs
  options, expose the options contextually in the bottom tray.
- Mobile layouts should favor large touch targets and avoid requiring precise
  taps while panning or zooming.
- Copy style: plain, gardener-facing, and useful. Errors should tell the player
  what to do next.

## Refactoring priorities

Keep changes small and local. Do not rewrite the app unless the user explicitly
asks for that scope.

The current top priorities are:

1. Keep all placement/state changes flowing through `toolMeta()`,
   `applyToolAt()`, and the mutation helpers.
2. Continue separating input gesture state in `js/input.js` from placement
   rules in `js/commands.js`.
3. Split renderer internals only when a change needs it; avoid giant cosmetic
   renderer refactors.
4. Keep plant/category/library additions data-driven in `js/plants.js`.
5. When adding a new layer, update `GAME_LAYERS`, save/load, undo, erase/pick,
   export/plan behavior if applicable, and the tray/tool metadata together.

## Feature backlog

- Real multiplayer backend for cross-device shared gardens.
- Smooth/free map rotation would be a larger renderer/input change than the
  current 90-degree view rotation.
- Matrix/scatter planting mode for Oudolf-style interplanting.
- Plant health, water, establishment risk, and maintenance.
- More plan/export polish, including saved reusable planting areas.
- More botanical refinement: species-specific foliage silhouettes, mature
  shrub/tree footprints, and better winter structure.
