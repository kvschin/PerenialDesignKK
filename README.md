# Pocket Prairie Garden Design

A 2.5D garden planner in the spirit of Piet Oudolf's naturalistic planting
style. Hundreds of species and cultivars — grasses, sedges, perennials, bulbs,
shrubs, and trees — are rendered procedurally on an isometric plot. Seasonal
views and a bloom calendar help compare a design through the year; timing is
representative and varies with climate and site.

**Play it: <https://kvschin.github.io/PerenialDesignKK/>**

## Start here

The menu has three entries:

- **Your gardens** — create, reopen, rename, duplicate, delete, or import a
  garden. A new design starts with a questionnaire for zone, style, continental
  native origin, and wildlife preferences, followed by plot size, shape, and
  north. The planner uses direct tap-to-place and drag-to-paint editing, a free
  pan/pinch camera, and a Rotate button or R key.
- **Plant Library** — browse species, seasonal illustrations, facts, and
  cultivars. Reviewed regional cautions and site notes appear where available;
  continental origin does not establish local nativity or suitability.
- **Daily design challenge** — a fresh date-seeded planting prompt each day
  (a dry gravel garden, a pollinator border, a monochrome study, …). It opens
  the planner with a fitting plant palette — no scoring, just a new brief.

## Design tools

A tool rail drives the planner (with a left-handed layout option on mobile):

- **Hand** — pan the map (also Space-drag or middle-mouse on a PC).
- **Select** — marquee a region, then **move, duplicate, rotate, or erase**
  everything in it, with a live ghost preview and a single undo per action.
- **Ruler** — measure a distance by dragging or tapping two points.
- **Plant** — draw single plants, natural **drifts**, or a spaced **Matrix**.
  Search and filter the catalog by garden criteria, plant category, bloom, and
  flower color; save Favorites and reusable palettes. Native filtering is
  continental; state/ecoregion matching is not implemented.
- **Erase** — a sized disc brush that clears all layers or just
  plants, bulbs, or landscape.
- **Pick** — sample a plant or material onto the brush. **Fill** in the brush
  controls floods a connected region with the armed plant or material.
- **Undo/Redo** — buttons, keyboard shortcuts, or two-/three-finger taps.
  View controls provide Rotate, Layers, and analysis overlays.

Draw and edit building footprints, lay paths, beds, and water, and add fences,
seating, containers, lighting, or decorative pets from the Landscape catalog.
Calibrate a site-photo reference and compare alternative planting schemes over
the same site. Export a garden backup, planting-list CSV, printable list, or
PNG design plan. Plant quantities are spacing-based estimates; check them
against the intended planting before ordering.

## Run it

Plain HTML/CSS/JS — no build step, no runtime dependencies, no framework. Just
open `index.html`, or serve the folder to avoid `file://` quirks:

```sh
npx http-server -p 8642 -c-1      # or: npm run serve
```

`index.html` (markup) and `styles.css` sit at the repo root; the JavaScript
lives in `js/` — `plants.js` (species data) plus the game logic, split for
navigability across ordered app modules (no bundler; load order matters).
GitHub Pages serves `master` as-is, so every push redeploys.

The app's assets load from its own host. The typefaces are self-hosted in `fonts/`
(Fraunces and IBM Plex Sans, both SIL OFL 1.1), and `sw.js` precaches the whole
shell for offline reopening after a successful first load. It makes no automatic
third-party requests; external source links open on user action. Gardens are
kept in IndexedDB on your own device; preferences in
localStorage. Note that the service worker caches hard — while editing, turn on
your browser's "Update on reload" or unregister it, or your changes will seem
not to land.

## Tests

A zero-dependency test runner loads the real source under a `vm` sandbox and
checks the species data contract, smoke-renders every plant, and unit-tests the
core logic:

```sh
node tests/run.js                 # or: npm test
npm run check                    # module syntax
npm run test:browser              # real storage, offline boot, and updates
```

The browser suite uses an existing Playwright installation and Chromium browser;
it downloads nothing. See [browser release checks](docs/browser-release-checks.md)
for setup, reports, and the remaining device checklist.

Use [application readiness](docs/readiness.md) for the current numbered backlog,
[CLAUDE.md](CLAUDE.md) for the authoritative implementation specification, and
[the direction record](docs/direction.md) for product scope. Native packaging and
store work have a separate [launch proposal](docs/app-store-launch-plan.md).
