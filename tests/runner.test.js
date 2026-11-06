'use strict';
/* The runner's own contract. These run in Node scope rather than in the sandbox,
   because what they check is how a whole process ends: a suite is only worth
   believing if a run that went wrong cannot exit 0. */

const { spawnSync } = require('child_process');
const path = require('path');

const RUNNER = path.join(__dirname, 'runner.js');

/* Run a throwaway suite through the real runner in a process of its own. */
function runSuite(body){
  const script = `const { test, assert, finish } = require(${JSON.stringify(RUNNER)}).createRunner();
    ${body}
    finish();`;
  const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30000 });
  return { code: run.status, out: run.stdout + run.stderr };
}

module.exports = ({ test, assert, assertEqual }) => {
  test('a clean run exits 0', () => {
    const run = runSuite(`
      test('sync', () => {});
      test('async', async () => { await null; });`);
    assertEqual(run.code, 0, run.out);
    assert(run.out.includes('2 passed, 0 failed, 2 total'), run.out);
  });

  test('a failed assertion, a throw and a rejection each fail the run, by name', () => {
    const run = runSuite(`
      test('fine', () => {});
      test('bad assert', () => { assert(false, 'wrong answer'); });
      test('bad throw', () => { throw new Error('thrown'); });
      test('bad reject', async () => { throw new Error('rejected'); });`);
    assertEqual(run.code, 1, run.out);
    assert(run.out.includes('1 passed, 3 failed, 4 total'), run.out);
    for (const text of ['bad assert', 'wrong answer', 'bad throw', 'bad reject', 'rejected'])
      assert(run.out.includes(text), `the report says "${text}": ${run.out}`);
  });

  test('a test that never settles fails the run, by name, and the rest still run', () => {
    const run = runSuite(`
      test('before', () => {});
      test('stuck on a promise', () => new Promise(() => {}));
      test('after', () => {});
      test('also fails', () => { assert(false, 'seen after the stuck test'); });`);
    assertEqual(run.code, 1, run.out);
    assert(run.out.includes('2 passed, 2 failed, 4 total'), run.out);
    assert(/✗ .*stuck on a promise\s+never settled/.test(run.out), run.out);
    assert(run.out.includes('seen after the stuck test'), run.out);
  });

  test('every test that never settles is reported, the last one included', () => {
    const run = runSuite(`
      test('stuck first', () => new Promise(() => {}));
      test('stuck second', async () => { await new Promise(() => {}); });
      test('fine', () => {});
      test('stuck last', () => new Promise(() => {}));`);
    assertEqual(run.code, 1, run.out);
    assert(run.out.includes('1 passed, 3 failed, 4 total'), run.out);
    for (const name of ['stuck first', 'stuck second', 'stuck last'])
      assert(new RegExp(`✗ .*${name}\\s+never settled`).test(run.out), `${name}: ${run.out}`);
  });

  test('a slow test that does finish is not called stuck', () => {
    const run = runSuite(`
      test('slow', () => new Promise(resolve => setTimeout(resolve, 60)));
      test('next', () => {});`);
    assertEqual(run.code, 0, run.out);
    assert(run.out.includes('2 passed, 0 failed, 2 total'), run.out);
  });
};
