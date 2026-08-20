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
   generator so both load the app the same way. */

const { read, gameSources, runTier } = require('./sandbox');

// ---------- result collection (lives in Node scope, shared with the sandbox) ----------
const results = [];
const queue = [];
let currentFile = '';
/* Storage is genuinely asynchronous now that gardens live in IndexedDB, so a
   test that saves and reads it back has to await.

   That forces the runner to QUEUE rather than run on declaration. Tests share
   one mutable `game`, and every test starts by resetting it through setup() —
   so an async test that ran on declaration would suspend at its first await,
   let the next declaration reset the world out from under it, and then resume
   against someone else's garden. Two tests failed exactly that way. Collect
   here, run one at a time in drain(); sync tests are unaffected either way. */
function test(name, fn){ queue.push({ file: currentFile, name, fn }); }
async function drain(){
  for (const t of queue){
    try { await t.fn(); results.push({ file: t.file, name: t.name, ok: true }); }
    catch (e){ results.push({ file: t.file, name: t.name, ok: false, err: (e && e.message) || String(e) }); }
  }
}
function assert(cond, msg){ if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg){ if (a !== b) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }


/* readRepoFile hands a test the real bytes of a repo file. Everything else in
   the sandbox is a stub, and a stub can lie; this cannot, which is the point —
   it exists so the version/PRECACHE test reads sw.js and package.json as they
   will actually ship rather than as the sandbox imagines them. */
const inject = { test, assert, assertEqual, readRepoFile: read };

// ---------- Tier 1: plants.js data contract (no DOM needed) ----------
currentFile = 'plants.test.js';
let r = runTier('plants', [read('js/plants.js'), read('tests/plants.test.js')], false, inject);
if (!r.ok) results.push({ file: 'plants.test.js', name: 'load plants.js', ok: false, err: r.err });

// ---------- Tier 2: game logic + render smoke test (DOM-stubbed) ----------
// Game logic is split into ordered modules (under js/); gameSources() loads them
// in the same order the browser does (they share one global scope here).
currentFile = 'game.test.js';
r = runTier('game', [...gameSources(), read('tests/game.test.js')], true, inject);
if (!r.ok) results.push({ file: 'game.test.js', name: 'load game modules (DOM-stubbed)', ok: false, err: r.err });

// ---------- report ----------
(async () => {
  await drain();                       // run the queued tests, one at a time
  const passed = results.filter(x => x.ok).length;
  const failed = results.filter(x => !x.ok);
  let lastFile = '';
  for (const x of results){
    if (!x.ok) continue;
    if (x.file !== lastFile){ console.log(`\n${x.file}`); lastFile = x.file; }
    console.log(`  ✓ ${x.name}`);
  }
  if (failed.length){
    console.log('\nFAILURES');
    for (const x of failed)
      console.log(`  ✗ [${x.file}] ${x.name}\n      ${String(x.err).split('\n').slice(0, 3).join('\n      ')}`);
  }
  console.log(`\n${passed} passed, ${failed.length} failed, ${results.length} total`);
  process.exit(failed.length ? 1 : 0);
})();
