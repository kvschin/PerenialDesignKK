# Hortus Perennis

A 2.5D perennial-gardening game in the spirit of Piet Oudolf's naturalistic
planting style, playing loosely like Animal Crossing. Cat/dog avatars tend an
isometric prairie plot where plants change appearance by season. Solo play plus
shared gardens for up to 4 people.

The whole game is **one self-contained HTML file** — no build step, no npm
dependencies, no framework. Open it in a browser to run it. Fonts load from
Google Fonts over the network; everything else is inline.

## Run / test

- Just open the HTML file in a browser. No server needed.
- For a quick local server (avoids any file:// quirks): `python3 -m http.server`
  then visit the printed localhost URL.
- There is no test suite. To sanity-check JS after edits, extract the `<script>`
  block and run it through `node --check` or `new Function(src)` to catch syntax
  errors before reloading the browser.

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

## Architecture (single file, top to bottom)

Everything lives in `hortus-perennis.html`. Rough order of the `<script>`:

1. **Constants** — `SEASONS`, `DAYS_PER_SEASON` (16), `DAY_MS` (20s real time
   per garden day), `GRID` (13x13), tile dimensions.
2. **`AMBIENCE`** — per-season sky gradient, grass/soil tones, light tint, snow
   flag. This is what makes the world *look* like each season.
3. **`PLANTS`** — the data model for every species (see below). The heart of the
   game's Oudolf character.
4. **`COATS`** — cat/dog coat color pairs (base + shadow).
5. **`mulberry(seed)`** — tiny seeded RNG. Used so each plant clump looks unique
   but renders identically every frame. Never use `Math.random()` for anything
   that must be stable across frames — derive a seed and use `mulberry`.
6. **`drawPlant(ctx, x, y, key, growth, season, seed, sway)`** — procedural
   renderer. Branches on `PLANTS[key].form` (`bunchgrass`, `vertgrass`, `cone`,
   `globe`, `spike`, `shrub`). Reads the season's `fol`/`bloom`/`seed`/`eye`
   colors. Adds snow caps when `AMBIENCE[season].snow`.
7. **`drawCritter(...)`** — round-bodied cat/dog avatar, with walk bob, tail,
   ears that differ by species, and tuxedo/patch markings.
8. **`game`** — the single mutable state object (mode, player position, plants
   map, tool, multiplayer presence, timing).
9. **Time helpers** — `absDay()`, `calClock()` (day/season/year/frac),
   `plantGrowth()` (0..1 over 10 garden days).
10. **Iso math + world layout** — `isoX/isoY`, `screenOf` (world->screen),
    `tileAt` (screen->world). `isPath()` defines the built-in curved walkway.
    `HOUSE`/`inHouse`/`isDoor`/`canStand` define the cottage (2x2 footprint at
    the plot's east corner, door tile on its south side; standing on the door
    and acting sleeps to the next day). `tileTerrain()` reads player-laid
    terrain from `game.terrain` ("x,y" -> `{k:'path'|'bed', t}`).
11. **`render(t)`** — sky, depth-sorted ground tiles (grass / walkway / laid
    path / bed / flagstone doorstep), a single depth-sorted entity pass for the
    cottage + plants + critters (sorted by `x+y`), season tint, snowfall.
12. **Movement / actions** — `tryMove`/`stepMove` (tile-to-tile lerp; diagonal
    steps take longer), `actHere` (sleep at door, lay/lift terrain, plant or
    lift on current tile), tap and keyboard input. **Keys map to SCREEN
    directions**: one key is a screen-cardinal step (a world diagonal, e.g.
    D = world `+x,-y`); holding two keys combines into a world-axis step.
    Tapping the cottage walks to the door and sleeps on arrival.
13. **Storage / multiplayer** — `sGet`/`sSet` over localStorage, solo save/load
    (plants + terrain), host/join shared worlds via shared keys, presence
    polling, `mergeMap` (last-write-wins by timestamp) for both plants and
    terrain.
14. **HUD** — tool tray (built from `PLANT_KEYS` + path/bed tools + shovel),
    season dial, sleep button, contextual action hint.
15. **Screens** — menu, multiplayer lobby, character creator (with live
    preview), code display. Plain DOM, toggled by `show()`.
16. **Menu meadow + main loop** — animated title background, then `loop(t)`.

## The plant data model

Each entry in `PLANTS` is the contract `drawPlant` renders against:

```js
key: {
  name: 'Little Bluestem',
  latin: 'Schizachyrium scoparium',
  form: 'bunchgrass',          // drives the drawing branch
  h: 46,                       // mature height in px
  blurb: '...',                // shown on the plant info card
  sea: {                       // per-season appearance
    Spring: { fol:'#7fa07a' },                 // foliage color
    Summer: { fol:'#6e8f9b' },
    Fall:   { fol:'#c0623b', seed:'#efe6d3' },  // seed = persistent seedhead
    Winter: { fol:'#a35a35', seed:'#f3ecdd' },
  }
}
```

Per-season keys: `fol` (foliage), `bloom` (flower this season, omit for none),
`seed` (seedhead/structure — present in fall/winter is what makes it Oudolf),
`eye` (cone center, echinacea only).

**To add a species:** add an entry to `PLANTS`, reuse an existing `form` or add a
new branch in `drawPlant`. It automatically appears in the tool tray (built from
`PLANT_KEYS`). Match real botany — Kevin grows these; accuracy matters more than
prettiness. Winter must show *structure*, not bare ground; that's the whole point.

## Conventions

- Vanilla JS, no framework, no bundler. Keep it that way unless explicitly asked.
- All rendering is canvas 2D. Colors flow from `AMBIENCE` and `PLANTS`, not
  hardcoded in draw functions — change the palette in data, not in code.
- Stable visuals use `mulberry(seed)`, never `Math.random()`. Tile seed is
  `tileSeed(x,y)`.
- Respect `prefers-reduced-motion` (already handled in CSS).
- Copy style: plain, gardener-facing, a little dry. Errors/empty states give
  direction, not mood. (e.g. "Nothing here to lift." not "Oops!")

## Suggested first refactor

Before adding features, split the single file into `index.html`, `styles.css`,
and `game.js`, and `git init`. At ~900+ lines the single-file form is getting
hard to navigate. Keep behavior identical; this is purely structural.

## Feature backlog (v2 ideas, not yet built)

- **Drift planting** — stamp 3–5 of the selected species in a natural cluster in
  one action. The most Oudolf-true addition; planting in drifts is core to the style.
- **Matrix/scatter mode** — interplant a grass matrix with scattered perennials.
- **Plant health / water** — establishment can fail; watering during dry spells.
- **More species** — Topeka coneflower (Echinacea atrorubens) as a rattlesnake
  master companion; baptisia variants; sedges for the region.
- **Photo mode** — capture the backlit winter seedhead shots that justify the
  whole aesthetic.
- **Bloom timing within a season** — stagger flowering across the 16 days so a
  bed peaks and fades rather than switching all at once.
