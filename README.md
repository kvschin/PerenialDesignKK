# Pocket Prairie Garden Design

A 2.5D perennial-gardening game and planner in the spirit of Piet Oudolf's
naturalistic planting style. More than 200 real species — grasses, sedges,
coneflowers and other forbs, ornamental bulbs, shrubs, and trees — grow, bloom,
stand through winter, and get cut back each spring on their true phenology, all
rendered procedurally on an isometric prairie plot.

**Play it: <https://kvschin.github.io/PerenialDesignKK/>**

## Four ways in

The menu opens onto four entries:

- **Design a Garden** — a serious planner for your actual yard: a free
  pan / pinch / twist camera and direct tap-to-place,
  drag-to-paint editing à la Procreate. Size the plot in feet or acres, set it
  up from a short questionnaire (zone, style, natives-only, deer/rabbit), then
  build with the full tool set below.
- **Daily design challenge** — a fresh date-seeded planting prompt each day
  (a dry gravel garden, a pollinator border, a monochrome study, …). It drops
  you straight into Design mode with a fitting plant palette — no scoring, just
  a new brief.
- **Plant Library** — browse every species with seasonal images, facts, and
  cultivars (you can drop in your own photos).
- **View Gardens** — open and manage your saved gardens, duplicate one, or share
  one to a file for a friend to import.

## Design tools

A left-hand toolbar drives the planner:

- **Hand** — pan the map (also Space-drag or middle-mouse on a PC).
- **Select** — marquee a region, then **move, duplicate, rotate, or erase**
  everything in it, with a live ghost preview and a single undo per action.
- **Plant** — draw single plants or natural **drifts**; the catalog filters to
  your zone and ecoregion, grouped by grasses / sun & shade perennials / bulbs /
  shrubs / trees.
- **Erase** — a sized brush (1 / 3×3 / 5×5) that clears all layers or just
  plants, bulbs, or landscape.
- **Fill** — bucket-fill a connected area of one material: carpet a bed with one
  species, recolor a path run, or turn a lawn into beds in a single tap.
- **Undo**, **Rotate** the view, and **Layers** — show/hide perennials, bulbs,
  trees & shrubs, or landscape independently, plus a sun-vs-shade overlay.

Place one or several **houses** at real proportions, lay **paths, beds, and
water**, then **export a printable planting list** (real quantities by species)
and an **Oudolf-style drift map**.

## Run it

Plain HTML/CSS/JS — no build step, no runtime dependencies, no framework. Just
open `index.html`, or serve the folder to avoid `file://` quirks:

```sh
npx http-server -p 8642 -c-1      # or: npm run serve
```

`index.html` (markup) and `styles.css` sit at the repo root; the JavaScript
lives in `js/` — `plants.js` (species data) plus the game logic, split for
navigability across nine small modules (no bundler; load order matters).
GitHub Pages serves `master` as-is, so every push redeploys.

## Tests

A zero-dependency test runner loads the real source under a `vm` sandbox and
checks the species data contract, smoke-renders every plant, and unit-tests the
core logic:

```sh
node tests/run.js                 # or: npm test
```

Don't cut back the seedheads.
