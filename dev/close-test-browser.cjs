'use strict';
/* Closing a browser a dev tool launched, for real.

   `child.kill()` is not enough on Windows: firefox.exe starts through a
   launcher stub that hands off to the real browser and exits at once, so the
   PID a tool spawned is not the browser, and killing it leaves the window open
   with the app still rendering in it. A soak harness built the same way as
   these tools left ten-plus Firefox windows running, several of them in
   Firefox's software fallback pinning a CPU core each, and every measurement
   after the first was taken on a loaded machine. That load invented a finding:
   a sprite-cache "cliff" that a clean re-run showed did not exist.

   So a test browser is found by its throwaway PROFILE path on the command
   line — Chrome's --user-data-dir, Firefox's -profile — and its whole process
   tree is killed. Matching on that path is also what keeps this from ever
   touching a browser the gardener is using: nothing else carries it. */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function matchingPids(fragment) {
  if (process.platform === 'win32') {
    // -like treats * ? [ ] as wildcards; escape them, and double quotes for the literal
    const pat = fragment.replace(/[[\]*?`]/g, m => '`' + m).replace(/'/g, "''");
    const script = "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and "
      + "$_.CommandLine -and $_.CommandLine -like '*" + pat + "*' } | ForEach-Object { $_.ProcessId }";
    try {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
      return out.split(/\s+/).map(Number).filter(n => n > 0);
    } catch (e) { return []; }
  }
  try {
    return execFileSync('pgrep', ['-f', fragment], { encoding: 'utf8' })
      .split(/\s+/).map(Number).filter(n => n > 0 && n !== process.pid);
  } catch (e) { return []; }                 // pgrep exits 1 when nothing matches
}

function killMatching(fragment) {
  for (let i = 0; i < 10; i++) {
    const pids = matchingPids(fragment);
    if (!pids.length) return true;
    for (const pid of pids) {
      try {
        if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        else process.kill(pid, 'SIGKILL');
      } catch (e) { }                        // it went on its own, or its parent took it
    }
    pause(300);
  }
  return !matchingPids(fragment).length;
}

/* Before a launch: anything still running on an earlier run's profile, left
   by a run that crashed or was interrupted. Scoped to this tool's own prefix. */
function sweepStaleTestBrowsers(prefix) {
  const fragment = path.join(os.tmpdir(), prefix);
  const n = matchingPids(fragment).length;
  if (!n) return;
  console.log('closing ' + n + ' process(es) left running by an earlier run (' + prefix + '*)');
  if (!killMatching(fragment)) console.log('WARNING: some are still running; measurements will share the machine');
}

/* After a run: this run's browser, then its profile folder. */
function closeTestBrowser(child, profileDir) {
  try { if (child) child.kill(); } catch (e) { }
  const gone = killMatching(profileDir);
  if (!gone) console.log('WARNING: the test browser is still running on ' + profileDir);
  else { try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { } }
  return gone;
}

module.exports = { closeTestBrowser, sweepStaleTestBrowsers };
