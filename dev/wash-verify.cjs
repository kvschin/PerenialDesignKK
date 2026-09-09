'use strict';
/* Season-wash verifier — does SEASON_WASH.mode change any PIXEL, and what does
   it cost, on each engine that matters.

   Why it exists. The two full-screen RADIAL washes (the sun in drawSeasonSky,
   the vignette in applySeasonLighting) are cheap on a GPU canvas and brutal on a
   software one. Measured in Firefox 155 at 2130x973: one radial fill is 12ms,
   against 2ms for a linear gradient, 2ms for a flat fill, and 2ms for 330 sprite
   blits. A profile of a real session put 57.6% of the content process's CPU in
   Skia's software raster pipeline, 46% of it under those two functions — they
   fill exactly two radials a frame, which is why that HUD read `sky 9.18ms` and
   `light 9.18ms`, identical to two decimals.

   `surface` mode pre-renders those two radials to bitmaps and blits them. This
   tool answers the only two questions that matter: is the frame still the same
   frame, and is it actually faster HERE. It runs the REAL app — not a
   reconstruction of the wash — because a paraphrase of six composited fills
   proves nothing about the six that ship.

   Three things it has to get right, each of which cost a wrong answer somewhere
   in this codebase before:

     - A CONTROL. Rendering the same mode twice must differ by zero bytes, or the
       diff against another mode is unreadable. The sprite cache bakes on a
       per-frame budget, so an arm is rendered to a fixed point (two consecutive
       identical frames) before it is photographed.
     - The clock PAUSED. sceneKey carries absDay(), so a running clock rebuilds
       the scene underneath the harness mid-comparison.
     - Both engines. The `baked` mode this replaces was deleted on Chrome
       evidence alone, and Firefox inverts the trade: there, a blit is cheap and
       the gradient is not.

   The bake is exact — full canvas size, no resampling — so on a deterministic
   rasteriser it is byte-identical, and that is what this reports. A downscaled
   variant was measured here too and rejected: 0.1ms a frame for a real 2/255
   error over 2.5% of the picture.

   Usage:
     node dev/wash-verify.cjs                    both engines
     node dev/wash-verify.cjs --engine firefox   just one
     node dev/wash-verify.cjs --json
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = flag('json');
const ONLY = opt('engine', null);

const ENGINES = [
  {
    name: 'firefox', exe: ['C:/Program Files/Mozilla Firefox/firefox.exe',
      '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'],
    args: (prof, url) => ['-profile', prof, '-no-remote', '-new-instance', url]
  },
  {
    name: 'chrome', exe: [
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
      path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'],
    args: (prof, url) => ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
      '--new-window', '--disable-background-timer-throttling', url]
  }
].filter(e => !ONLY || e.name === ONLY);

/* Runs INSIDE the page. One function so every arm shares a session: split up,
   the arms would re-JIT and re-warm between them and stop comparing anything. */
function inPage() {
  const cx = cnv.getContext('2d', { willReadFrequently: true });
  const W = cnv.width, H = cnv.height;
  const shot = () => cx.getImageData(0, 0, W, H).data;
  const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

  /* The frame has to be reproducible before any diff means anything, and the
     WIND is the thing that stops it: render() computes `sway = Math.sin(t*0.0012)`
     from its timestamp and shears every plant blit by it, so two frames a
     millisecond apart are legitimately different pictures. Passing
     performance.now() put the control — the same mode photographed twice — at
     26% of pixels differing, which makes every comparison below it unreadable.
     One frozen timestamp for every arm.

     Settling on top of that: the sprite cache bakes on a per-frame budget, so an
     arm's first frames are not the frame the next arm gets compared against.
     Two consecutive identical frames means the caches have stopped moving. */
  const T0 = 1000000;
  function settle(limit) {
    let prev = null;
    for (let i = 0; i < (limit || 40); i++) {
      render(T0);
      const now = shot();
      if (prev && same(prev, now)) return { data: now, frames: i + 1 };
      prev = now;
    }
    return { data: prev, frames: limit || 40, unsettled: true };
  }
  function diff(a, b) {
    let px = 0, sum = 0, max = 0;
    for (let i = 0; i < a.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) { const e = Math.abs(a[i + c] - b[i + c]); if (e > d) d = e; }
      if (d) { px++; sum += d; if (d > max) max = d; }
    }
    return {
      pctPixels: +(100 * px / (a.length / 4)).toFixed(4),
      meanErrOnDiffering: px ? +(sum / px).toFixed(2) : 0, maxChannelErr: max
    };
  }
  /* Time the two wash passes themselves — that is what the debug HUD calls
     `sky` and `light`, and it is the only thing this change touches. The
     readback makes the backend finish the queue before the clock is read; on a
     GPU canvas it also kills pipelining, so read a column, never a budget. */
  function timePass(rounds) {
    const cal = calClock(), amb = AMBIENCE[cal.season] || AMBIENCE.Summer;
    const t = { sky: [], light: [] };
    for (let r = 0; r < (rounds || 9); r++) {
      let a = performance.now();
      drawSeasonSky(cx, VW, VH, cal.season, amb); cx.getImageData(0, 0, 1, 1);
      t.sky.push(performance.now() - a);
      a = performance.now();
      applySeasonLighting(cx, VW, VH, amb, cal.season); cx.getImageData(0, 0, 1, 1);
      t.light.push(performance.now() - a);
    }
    const min = z => +Math.min.apply(null, z).toFixed(2);
    return { skyMs: min(t.sky), lightMs: min(t.light) };
  }
  /* Whole frames, ONE readback at the end. The per-pass timing above flushes
     between every fill, which is nearly free on a software canvas and stalls the
     pipeline on a GPU one — so it flatters Firefox and punishes Chrome, and the
     two columns cannot be compared with each other. This one bills both engines
     the same way and is the number to decide on. */
  function timeFrames(rounds, per) {
    const t = [];
    for (let r = 0; r < (rounds || 5); r++) {
      const a = performance.now();
      for (let i = 0; i < (per || 12); i++) render(T0);
      cx.getImageData(0, 0, 1, 1);
      t.push((performance.now() - a) / (per || 12));
    }
    return +Math.min.apply(null, t).toFixed(2);
  }

  function arm(mode) {
    SEASON_WASH.mode = mode;
    if (typeof washSurf !== 'undefined') washSurf.key = '';
    const s = settle();
    return { data: s.data, frames: s.frames, time: timePass(), frameMs: timeFrames() };
  }

  const out = { canvas: [W, H], dpr: typeof DPR !== 'undefined' ? DPR : null, season: calClock().season, arms: [] };

  // CONTROL first: the same mode twice. Anything but zero and the rest is noise.
  const base = arm('cached');
  const control = arm('cached');
  out.control = diff(base.data, control.data);
  out.cached = base.time; out.cachedFrameMs = base.frameMs;

  const a = arm('surface');
  out.arms.push(Object.assign({ mode: 'surface', settleFrames: a.frames, frameMs: a.frameMs },
    diff(base.data, a.data), a.time));
  SEASON_WASH.mode = 'surface';
  if (typeof washSurf !== 'undefined') washSurf.key = '';
  return out;
}

function server(port0) {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml'
  };
  let resolveResult;
  const ready = new Promise(r => resolveResult = r);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(b)); } catch (e) { resolveResult({ error: String(b).slice(0, 400) }); } });
      return;
    }
    if (req.url.startsWith('/__driver.js')) {
      const driver = `
(async function(){
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); }catch(e){}
    while (typeof enterWorld!=='function' || typeof PSPRITE==='undefined') await new Promise(r=>setTimeout(r,50));
    const env = await (await fetch('/demo-garden.json')).json();
    await enterWorld(await installWorldBlob(env));
    game.pausedAt = game.pausedAt || Date.now();   // freeze: sceneKey carries absDay()
    game.ffActive = false;
    await new Promise(r=>setTimeout(r,400));
    const fn = (${String(inPage)});
    const out = fn();
    out.ua = navigator.userAgent;
    await fetch('/__result',{method:'POST',body:JSON.stringify(out)});
  }catch(e){
    await fetch('/__result',{method:'POST',body:JSON.stringify({error:String(e&&e.stack||e)})});
  }
})();`;
      res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store');
      res.end(driver); return;
    }
    const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (e, buf) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
      if (path.basename(abs) === 'index.html') {
        // the worker is cache-first: a verifier booting under one is liable to
        // photograph the PREVIOUS build without ever saying so.
        buf = Buffer.from(String(buf)
          .replace("if ('serviceWorker' in navigator)", 'if (false)')
          .replace('</body>', '<script src="/__driver.js"></script></body>'));
      }
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, ready })));
}

(async () => {
  const report = { engines: {} };
  for (const eng of ENGINES) {
    const exe = eng.exe.find(p => fs.existsSync(p));
    if (!exe) { console.error('skip ' + eng.name + ': not installed'); continue; }
    const { srv, port, ready } = await server();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'washverify-'));
    const child = spawn(exe, eng.args(profile, 'http://127.0.0.1:' + port + '/'), { stdio: 'ignore' });
    const result = await Promise.race([ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 180000))])
      .catch(e => ({ error: e.message }));
    try { child.kill(); } catch (e) { }
    srv.close();
    report.engines[eng.name] = result;
    await new Promise(r => setTimeout(r, 400));
  }

  if (JSON_OUT) { console.log(JSON.stringify(report, null, 1)); return; }
  let bad = false;
  for (const [name, r] of Object.entries(report.engines)) {
    console.log('\n=== ' + name + ' ===');
    if (r.error) { console.log('  ERROR: ' + r.error); continue; }
    console.log('  ' + (r.ua || ''));
    console.log('  canvas ' + r.canvas[0] + 'x' + r.canvas[1] + '  dpr ' + r.dpr + '  season ' + r.season);
    /* The bar is the CONTROL, not zero. On a GPU canvas the same scene drawn
       twice is not bit-identical — rasteriser batching differs between two draw
       sequences and leaves a scatter of +/-1 — which is the same noise floor
       verifySceneCull reports. An arm at or under the control is indistinguishable
       from redrawing the picture unchanged; what a REAL difference looks like is a
       max channel error well clear of it. */
    const c = r.control;
    console.log('  CONTROL (cached vs cached): ' + c.pctPixels + '% px, mean '
      + c.meanErrOnDiffering + '/255, max ' + c.maxChannelErr + '/255   <- the noise floor');
    if (c.maxChannelErr > 8) { bad = true; console.log('    control is too loud to read anything against'); }
    console.log('  cached           sky ' + String(r.cached.skyMs).padStart(6) + 'ms  light '
      + String(r.cached.lightMs).padStart(6) + 'ms   FRAME ' + String(r.cachedFrameMs).padStart(6) + 'ms');
    for (const a of r.arms) {
      const within = a.maxChannelErr <= Math.max(1, c.maxChannelErr);
      console.log('  surface        sky ' + String(a.skyMs).padStart(6) + 'ms  light ' + String(a.lightMs).padStart(6) + 'ms'
        + '   ' + String(a.pctPixels).padStart(8) + '% px'
        + '  mean ' + String(a.meanErrOnDiffering).padStart(5) + '/255'
        + '  max ' + String(a.maxChannelErr).padStart(3) + '/255'
        + '   FRAME ' + String(a.frameMs).padStart(6) + 'ms'
        + (within ? '   = within the noise floor' : '   <- visible difference'));
    }
  }
  console.log('\n"diff" is against the cached frame, and the bar is the CONTROL, not zero: a GPU');
  console.log('canvas is not bit-deterministic, so an arm at or under the control is the same');
  console.log('picture drawn a second time. Decide on the FRAME column — the per-pass one');
  console.log('flushes between fills, which is free in software and stalls a GPU pipeline.\n');
})().catch(e => { console.error(e); process.exit(1); });
