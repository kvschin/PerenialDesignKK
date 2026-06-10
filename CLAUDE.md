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
   per garden day), `GRID` (31x31), `SPAWN` (plot center, where players start),
   tile dimensions, `TILE_IN` (18 — real-world inches per tile side, the scale
   the export sheet converts through).
2. **`AMBIENCE`** — per-season sky gradient, grass/soil tones, light tint, snow
   flag. This is what makes the world *look* like each season.
3. **`PLANTS`** — in `plants.js`, the data model for every species (see
   below). The heart of the game's Oudolf character.
4. **`COATS`** — cat/dog coat color pairs (base + shadow).
5. **`mulberry(seed)`** — tiny seeded RNG. Used so each plant clump looks unique
   but renders identically every frame. Never use `Math.random()` for anything
   that must be stable across frames — derive a seed and use `mulberry`.
6. **`drawPlant(ctx, x, y, key, growth, season, seed, sway, variant)`** —
   procedural renderer. Resolves `plantDef(key, variant)` (cultivar overrides
   merged over the species, cached) and branches on its `form` (`bunchgrass`,
   `vertgrass`, `turkeyfoot`, `cloudgrass`, `oatgrass`, `cone`, `globe`,
   `spike`, `shrub`). Reads the season's `fol`/`bloom`/`seed`/`eye` colors.
   Adds snow caps when `AMBIENCE[season].snow`.
7. **`drawCritter(...)`** — round-bodied cat/dog avatar, with walk bob, tail,
   ears that differ by species, and tuxedo/patch markings.
8. **`game`** — the single mutable state object (mode, player position, plants
   map, tool, multiplayer presence, timing).
9. **Time helpers + phenology** — `absDay()`, `calClock()`
   (day/season/year/frac). Drawn plant size = `plantGrowth(p)` =
   `plantEstab(p)` (0..1 over 10 *growing* days — `growingDays()` skips
   winter, so winter planting waits for spring) × `seasonEnvelope(key)`
   (the perennial year: cut back to 0.12 at spring day 1, regrow on the
   species' `phen` schedule — cool wakes day 0/full day 14, mid 4/24,
   warm 7/28 — full through fall, winter holds full-size dead structure).
   The plant card reports establishment, not seasonal size.
10. **Iso math + world layout** — `isoX/isoY`, `screenOf` (world->screen),
    `tileAt` (screen->world). `isPath()` defines the built-in curved walkway.
    `HOUSE`/`inHouse`/`isDoor`/`canStand` define the cottage (2x2 footprint at
    the plot's east corner, door tile on its south side; standing on the door
    and acting sleeps to the next day). `tileTerrain()` reads player-laid
    terrain from `game.terrain` ("x,y" -> `{k:'path'|'bed', t}`).
11. **`render(t)`** — sky, then a camera-windowed pass: the four screen
    corners invert (via `tileAt`) to a padded world-tile bounding box, and
    only those tiles/entities draw. Ground tiles (grass / walkway / laid path
    / bed / flagstone doorstep) back-to-front, a single depth-sorted entity
    pass for the cottage + plants + critters (sorted by `x+y`), season tint,
    snowfall. Cost scales with screen size, not `GRID` — grow the world freely.
12. **Movement / actions** — `tryMove`/`stepMove` (tile-to-tile lerp; diagonal
    steps take longer), `actHere` (sleep at door, lay/lift terrain, plant or
    lift on current tile), tap and keyboard input. **Keys map to SCREEN
    directions**: one key is a screen-cardinal step (a world diagonal, e.g.
    D = world `+x,-y`); holding two keys combines into a world-axis step.
    Tapping the cottage walks to the door and sleeps on arrival.
13. **Storage / multiplayer** — `sGet`/`sSet` over localStorage, solo save/load
    (plants + terrain + `grid` size; saves without `grid` predate the world
    expansion and get recentered from (6,6) to `SPAWN` on load), host/join
    shared worlds via shared keys, presence polling, `mergeMap`
    (last-write-wins by timestamp) for both plants and terrain.
14. **Export / planting list** — `exportRows()` tallies planted tiles per
    species and converts to real quantities (`ceil(tiles × TILE_IN² / space²)`)
    plus bed area; `openExport()` renders the overlay table, `exportCsv()`
    downloads it. Print CSS in `styles.css` strips everything but the sheet.
15. **Region filter + HUD** — `plantFits()` (zone range, natives-only,
    ecoregion membership for natives; cultivars have `eco:[]` so only the
    natives-only switch hides them), `trayKeys()` (filtered, grasses → sedges
    → forbs), the region-picker overlay wiring, and the tool tray:
    `TRAY_CATS` category tabs (Grasses / Perennials / Shrubs / Trees / Dig /
    Landscape — shrubs and trees are empty placeholders until woody types
    exist), species buttons in the active category (species sharing a
    `group` collapse to one button), and `renderCvRow()` chips: group
    members and/or cultivars of the selected species (the planted tile
    stores `v`; tool state is `game.tool` + `game.toolVar`). Plus season
    dial, sleep button, plant-list and region buttons, contextual action
    hint. The region choice persists as `hortus:region`.
16. **Screens** — menu, multiplayer lobby, character creator (with live
    preview), code display. Plain DOM, toggled by `show()`. The planting-list
    (`#exportScreen`) and region (`#regionScreen`) overlays sit outside
    `show()` — in-game overlays toggled directly; the keyboard handler
    ignores game keys while one is open (Escape closes).
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

Next in the "design tool" direction: search within tray categories if any
category outgrows its row; woody plants (types `shrub`/`tree`) to fill the
placeholder tabs.

- **Drift planting** — stamp 3–5 of the selected species in a natural cluster in
  one action. The most Oudolf-true addition; planting in drifts is core to the style.
- **Matrix/scatter mode** — interplant a grass matrix with scattered perennials.
- **Plant health / water** — establishment can fail; watering during dry spells.
- **More species** — switchgrass (Panicum virgatum) and big bluestem for the
  tall matrix; penstemon (P. digitalis), prairie clover (Dalea purpurea),
  golden alexanders (Zizia aurea — needs an umbel form in `drawPlant`).
- **Photo mode** — capture the backlit winter seedhead shots that justify the
  whole aesthetic.
- **Bloom timing within a season** — stagger flowering across the 16 days so a
  bed peaks and fades rather than switching all at once.
