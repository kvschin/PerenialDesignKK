'use strict';
/* Zero-dependency test runner for Pocket Prairie.
   The game is plain browser JS with no module exports, so we load the real
   source files inside a `vm` sandbox:
     - plants.js is pure data -> runs with no stubs (Tier 1: data contract).
     - the ordered js/ modules load with light browser stubs; then we call the
       real pure functions (Tier 2: logic + a render smoke test).
   Each *.test.js file is concatenated after the source it exercises and uses
   the injected `test()` / `assert()` globals.  Run: `node tests/run.js`.

   The sandbox itself lives in tests/sandbox.js, shared with the demo-garden
   generator so both load the app the same way. The queue and the report live in
   tests/runner.js, so a test can run them in a process of its own. */

const { read, gameSources, runTier } = require('./sandbox');
const { createRunner } = require('./runner');

const runner = createRunner();
const { test, assert, assertEqual, results, setFile, finish } = runner;


/* readRepoFile hands a test the real bytes of a repo file. Everything else in
   the sandbox is a stub, and a stub can lie; this cannot, which is the point —
   it exists so the version/PRECACHE test reads sw.js and package.json as they
   will actually ship rather than as the sandbox imagines them. */
const inject = { test, assert, assertEqual, readRepoFile: read };

// ---------- Tier 0: the runner's own contract (Node scope, no sandbox) ----------
setFile('runner.test.js');
require('./runner.test')(runner);

// ---------- Tier 1: plants.js data contract (no DOM needed) ----------
setFile('plants.test.js');
let r = runTier('plants', [read('js/plants.js'), read('tests/plants.test.js')], false, inject);
if (!r.ok) results.push({ file: 'plants.test.js', name: 'load plants.js', ok: false, err: r.err });

// ---------- Tier 2: game logic + render smoke test (DOM-stubbed) ----------
// Game logic is split into ordered modules (under js/); gameSources() loads them
// in the same order the browser does (they share one global scope here).
/* More than one test file shares this tier, and must: every sandbox is handed
   the same document stub, so loading the modules into a second one would re-run
   init and re-wire the shared elements' handlers into the other sandbox's
   `game`. A later file names itself with testFile() so its results say where
   they came from. */
setFile('game.test.js');
r = runTier('game', [...gameSources(), read('tests/game.test.js'), read('tests/ui-cost.test.js')], true,
  Object.assign({ testFile: setFile }, inject));
if (!r.ok) results.push({ file: 'game.test.js', name: 'load game modules (DOM-stubbed)', ok: false, err: r.err });

// ---------- run + report ----------
finish();
