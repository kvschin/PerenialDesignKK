'use strict';
/* The queue, the drain and the report, apart from what gets run, so that
   tests/runner.test.js can run them in a process of their own and watch it exit. */

const STALLED = Symbol('stalled');
const STALL_MESSAGE = 'never settled: nothing left in the event loop could finish it. '
  + 'Timers and rAF never fire in the sandbox, so awaiting one hangs (docs/test-sandbox.md).';

function createRunner(){
  const results = [];
  const queue = [];
  let currentFile = '';
  let wake = null;       // ends the wait on the test now running, once it can never finish

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
      const stalled = new Promise(resolve => { wake = () => resolve(STALLED); });
      try {
        if (await Promise.race([t.fn(), stalled]) === STALLED) throw new Error(STALL_MESSAGE);
        results.push({ file: t.file, name: t.name, ok: true });
      }
      catch (e){ results.push({ file: t.file, name: t.name, ok: false, err: (e && e.message) || String(e) }); }
    }
    wake = null;
  }

  function assert(cond, msg){ if (!cond) throw new Error(msg || 'assertion failed'); }
  function assertEqual(a, b, msg){ if (a !== b) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

  async function finish(){
    /* A test awaiting a promise nothing will ever settle leaves the event loop
       empty, and Node then exits, code 0, with this function still suspended: no
       report, nothing printed, and every test behind it silently never run. An
       empty loop is the exact condition, so no timeout is needed, and a slow test
       can never be mistaken for a stuck one.

       setImmediate rather than calling wake() here: resolving a promise is not
       work the loop can see, so if the next test also hung, the loop would still
       be empty when this listener returned and Node would not ask again. */
    process.on('beforeExit', () => { if (wake) setImmediate(wake); });
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
  }

  return { test, assert, assertEqual, results, finish, setFile(name){ currentFile = name; } };
}

module.exports = { createRunner };
