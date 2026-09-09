'use strict';
/* Fast-forward sprite bench — what the plant sprite cache costs while time is
   HELD forward, which is the gesture that stresses it hardest and the one
   nothing else measures.

   Why this exists. perfBench measures the ground bake and the region trace on an
   edit; drawProfile splits the draw phase by entity class. Neither moves the
   CLOCK, and the plant cache is keyed on a growth bucket and a bloom bucket read
   off the clock — so a clump's sprite is retired the moment either moves. Under
   fast-forward the calendar advances FF_RATE (40) times normal, a game day every
   500ms, so buckets churn ~40x faster than in play and every visible clump
   re-bakes far more often. That is the case worth watching, and nothing saw it.

   READ THIS BEFORE TRUSTING A CANVAS NUMBER TAKEN ANYWHERE ELSE. A measurement
   is only as good as the surface it is drawn on, and two environments lie:

     - A hidden or backgrounded tab does not rasterize. CLAUDE.md's perfBench
       note already warns that readings swing 3x there.
     - Worse, an editor's embedded browser pane can collapse the viewport to
       ZERO while hidden. Measured in one: innerWidth 0 and a 1x1 canvas, so the
       entity cull rejected all but 7 of 326 plants, and the cache "reported"
       43MB and 31ms/frame. Both figures are pure artifact. The same garden in a
       real 1280x900 viewport is 1.65ms/frame with the cache 7x ahead of the
       procedural path. A wrong number that looks plausible is worse than none.

   So this drives a real Playwright viewport, refuses to report if the canvas is
   degenerate, freezes the clock so a run is deterministic, and forces a readback
   each chunk so it times execution rather than command submission.

   Isolation: a fresh Playwright context, its own disposable server, and the
   service worker switched off in the served index.html (the rewrite
   dev/perf-audit-server.cjs uses). Nothing is downloaded, no application file is
   modified, and personal browser storage is untouched.

   Usage:
     node dev/ff-bench.cjs                     demo garden, desktop + phone, 3 game years
     node dev/ff-bench.cjs --years 6           longer hold (drift check)
     node dev/ff-bench.cjs --stress            quarter-acre packed garden instead
     node dev/ff-bench.cjs --profile desktop   one viewport (desktop|phone)
     node dev/ff-bench.cjs --garden my.json    an exported garden of your own
     node dev/ff-bench.cjs --json              machine-readable, for diffing runs
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const root = path.resolve(__dirname, '..');
const SEASON_ORDER = ['Spring', 'Summer', 'Fall', 'Winter'];

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const YEARS = Math.max(1, Number(opt('years', 3)) || 3);
const STRESS = flag('stress'), JSON_OUT = flag('json');
const GARDEN = opt('garden', null), ONLY = opt('profile', null);

const PROFILES = [
  { name: 'desktop', viewport: { width: 1280, height: 900 }, dpr: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, dpr: 1.5, touch: true },
].filter(p => !ONLY || p.name === ONLY);
if (!PROFILES.length) { console.error('unknown --profile; use desktop or phone'); process.exit(1); }

function playwright() {
  const candidates = process.env.PLAYWRIGHT_MODULE_PATH ? [process.env.PLAYWRIGHT_MODULE_PATH] : [
    'playwright', 'playwright-core',
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')];
  for (const c of candidates) {
    try { return require(c); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Error('An existing Playwright installation is required. Set PLAYWRIGHT_MODULE_PATH to its package directory. Nothing is downloaded. See docs/browser-release-checks.md.');
}
function browserExecutable() {
  if (process.env.PP_BROWSER_PATH) return process.env.PP_BROWSER_PATH;
  const candidates = process.platform === 'win32' ? [
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ] : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  return candidates.find(file => fs.existsSync(file));
}

/* Disposable static server over the working tree. The service worker is switched
   off in the served markup rather than unregistered from the page: it is
   cache-first, so a bench that boots under one is liable to measure the PREVIOUS
   build's modules without ever saying so. */
function benchServer(gardenJson) {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp'
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__bench-garden.json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(gardenJson);
      return;
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
      if (path.basename(abs) === 'index.html')
        buf = Buffer.from(String(buf).replace("if ('serviceWorker' in navigator)", 'if (false)'));
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

/* Everything in here runs INSIDE the page. It is one function on purpose so the
   whole measurement shares a session: split across page.evaluate calls the arms
   would re-JIT and re-warm between them, which is how an A/B quietly stops
   comparing anything. */
function measure(opts) {
  const years = opts.years;
  const origMake = window.makePlantSprite, origDraw = window.drawPlantMaybeCached;
  let bakes = 0, draws = 0;
  window.makePlantSprite = function () { bakes++; return origMake.apply(this, arguments); };
  window.drawPlantMaybeCached = function () { draws++; return origDraw.apply(this, arguments); };

  const cx = cnv.getContext('2d');
  /* Time EXECUTION, not submission. A canvas 2D call queues work the backend
     rasterizes later, outside any performance.now() pair; one 1px readback makes
     the queue land first. Per CHUNK rather than per frame — a readback also
     kills pipelining, so billing every frame for one would overstate everything
     (the dbg.flush "shares only" note in CLAUDE.md is the same trap). */
  const flush = () => cx.getImageData(0, 0, 1, 1);
  const FF_STEP = FF_RATE * 16.7;          // game-ms a fast-forward frame advances at 60fps
  const framesPerDay = DAY_MS / FF_STEP;   // ~30

  const mb = n => +(n / 1048576).toFixed(1);
  const heapMB = () => performance.memory ? mb(performance.memory.usedJSHeapSize) : null;
  const evictableBytes = () => {
    let b = 0;
    for (const e of PSPRITE.map.values()) if (e.used !== PSPRITE.frame) b += e.bytes;
    return b;
  };
  /* The governor is deliberately bypassed. It engages the cache on measured
     frame cost, so leaving it in charge would make the two arms differ by
     whether it had happened to engage yet rather than by the cache itself. */
  const reset = sprites => {
    PSPRITE.map.clear(); PSPRITE.slot.clear(); PSPRITE.bytes = 0;
    PSPRITE.off = !sprites; PSPRITE.active = !!sprites;
  };
  const parkAt = day => { game.elapsedMs = (day - game.dayOffset) * DAY_MS; };
  const warm = () => { render(performance.now()); flush(); };

  function runFF(frames) {
    bakes = 0; draws = 0;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) { game.elapsedMs += FF_STEP; render(performance.now()); }
    flush();
    const ms = performance.now() - t0;
    return {
      frames, msPerFrame: +(ms / frames).toFixed(2), bakes, draws,
      bakesPerFrame: +(bakes / frames).toFixed(1),
      drawsPerFrame: Math.round(draws / frames),
      reusePerBake: +((draws - bakes) / Math.max(1, bakes)).toFixed(1)
    };
  }

  const day0 = absDay();
  const out = {
    canvas: [cnv.width, cnv.height], dpr: typeof DPR !== 'undefined' ? DPR : null,
    zoom: typeof ZOOM !== 'undefined' ? +ZOOM.toFixed(2) : null,
    plants: Object.keys(game.plants).length,
    visibleEnts: scene && scene.ents ? scene.ents.length : null,
    budgetMB: mb(PSPRITE.MEM), framesPerGameDay: +framesPerDay.toFixed(1)
  };

  /* 1. Is the cache still worth having while the clock runs? Interleaved and
     min-of-rounds: run-to-run drift on this app exceeds the effect being
     measured, and a naive sequential reading has been wrong here before (see
     the SSPRITE.SS supersampling note in CLAUDE.md). */
  const on = [], off = [];
  for (let r = 0; r < 4; r++) {
    parkAt(day0); reset(true); warm(); on.push(runFF(60).msPerFrame);
    parkAt(day0); reset(false); warm(); off.push(runFF(60).msPerFrame);
  }
  const bestOn = Math.min.apply(null, on), bestOff = Math.min.apply(null, off);
  out.ab = {
    spritesOnMs: bestOn, spritesOffMs: bestOff,
    speedup: +(bestOff / bestOn).toFixed(1), onRounds: on, offRounds: off
  };

  /* 2. Per-season churn. Spring is the worst of it — everything regrows at once,
     so every clump crosses growth buckets together — and Winter the cheapest,
     where dead structure stands still. */
  out.seasons = {};
  for (let i = 0; i < 4; i++) {
    const yr = Math.floor(absDay() / (DAYS_PER_SEASON * 4)) + 1;
    parkAt(yr * DAYS_PER_SEASON * 4 + i * DAYS_PER_SEASON);
    reset(true); warm();
    const r = runFF(Math.round(framesPerDay * 2));      // two game days inside the season
    r.season = SEASONS[i]; r.cacheMB = mb(PSPRITE.bytes); r.sprites = PSPRITE.map.size;
    out.seasons[SEASONS[i]] = r;
  }

  /* 3. The sustained hold. The question is whether anything DRIFTS: frame cost,
     cache bytes, or the share of the cache eviction is allowed to touch.
     Eviction only ever discards sprites that were not drawn last frame, so
     evictable going to zero while bytes sit over budget is the documented
     failure shape — the whole working set on screen, eviction unable to act in
     the one situation it exists for. */
  parkAt(day0); reset(true); warm();
  const CHUNK = 60;
  const chunks = Math.max(1, Math.round((64 * years * DAY_MS) / FF_STEP / CHUNK));
  const every = Math.max(1, Math.round(chunks / 8));
  let peak = 0; const samples = [];
  for (let c = 0; c < chunks; c++) {
    const r = runFF(CHUNK);
    if (PSPRITE.bytes > peak) peak = PSPRITE.bytes;
    if (c % every === 0 || c === chunks - 1)
      samples.push({
        gameDay: absDay(), season: calClock().season, msPerFrame: r.msPerFrame,
        bakesPerFrame: r.bakesPerFrame, cacheMB: mb(PSPRITE.bytes), sprites: PSPRITE.map.size,
        evictableMB: mb(evictableBytes()), heapMB: heapMB()
      });
  }
  out.sustained = { gameYears: years, chunks, peakCacheMB: mb(peak), samples };

  window.makePlantSprite = origMake; window.drawPlantMaybeCached = origDraw;
  PSPRITE.off = false;
  return out;
}

(async () => {
  const gardenPath = GARDEN ? path.resolve(GARDEN) : path.join(root, 'demo-garden.json');
  if (!fs.existsSync(gardenPath)) { console.error('no garden at ' + gardenPath); process.exit(1); }
  const gardenJson = fs.readFileSync(gardenPath, 'utf8');
  const exe = browserExecutable();
  if (!exe) { console.error('No Chromium/Chrome/Edge found. Set PP_BROWSER_PATH.'); process.exit(1); }
  const pw = playwright();
  const { server, port } = await benchServer(gardenJson);
  const browser = await pw.chromium.launch({ headless: true, executablePath: exe });
  const report = { garden: path.basename(gardenPath), stress: STRESS, years: YEARS, profiles: {} };
  try {
    for (const prof of PROFILES) {
      const ctx = await browser.newContext({
        viewport: prof.viewport, deviceScaleFactor: prof.dpr, hasTouch: !!prof.touch
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof enterWorld === 'function' && typeof PSPRITE !== 'undefined');
      await page.evaluate(async stress => {
        const env = await (await fetch('/__bench-garden.json')).json();
        await enterWorld(await installWorldBlob(env));
        if (stress) { setWorldSize(69, 69); snapCam(); stressGarden(); markModelChanged(); }
        /* Freeze the clock. A garden opens paused, so elapsedGameMs() is exactly
           game.elapsedMs and every step below is deterministic; otherwise the
           wall clock ticks days underneath the run and rebuilds the scene in the
           middle of a measurement. */
        game.pausedAt = game.pausedAt || Date.now();
        game.ffActive = false;              // time is stepped by hand, not by the loop
        /* Build the scene here rather than waiting for the loop to do it. With
           the clock paused shouldRenderGarden legitimately skips frames, so the
           entity count below is otherwise a race — probed too early it reads 0
           and the viewport guard fails a perfectly good run. */
        render(performance.now());
      }, STRESS);

      /* The trap this tool exists to refuse. Without it a collapsed viewport
         still prints confident numbers that describe almost nothing. */
      const shape = await page.evaluate(() => ({
        w: cnv.width, h: cnv.height, iw: innerWidth,
        ents: scene && scene.ents ? scene.ents.length : 0
      }));
      if (shape.w < 200 || shape.h < 200 || shape.iw < 200 || shape.ents < 10)
        throw new Error('degenerate viewport for ' + prof.name + ': canvas ' + shape.w + 'x' + shape.h
          + ', innerWidth ' + shape.iw + ', ' + shape.ents + ' entities — measurements here are meaningless');

      const r = await page.evaluate(measure, { years: YEARS });
      r.pageErrors = errors;
      report.profiles[prof.name] = r;
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }

  if (JSON_OUT) { console.log(JSON.stringify(report, null, 1)); return; }
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\nfast-forward sprite bench — ' + report.garden
    + (STRESS ? ' + stressGarden(69x69)' : '') + ', ' + YEARS + ' game year(s) held\n');
  for (const name of Object.keys(report.profiles)) {
    const r = report.profiles[name];
    console.log('=== ' + name + '  ' + r.canvas[0] + 'x' + r.canvas[1] + ' canvas · dpr ' + r.dpr
      + ' · zoom ' + r.zoom + ' · ' + r.plants + ' plants, ' + r.visibleEnts + ' entities visible');
    console.log('  cache vs procedural   sprites ' + r.ab.spritesOnMs + 'ms/frame   procedural '
      + r.ab.spritesOffMs + 'ms/frame   (' + r.ab.speedup + 'x)');
    console.log('  season   ms/frame  bakes/frame  reuse/bake  cacheMB');
    for (const s of SEASON_ORDER) {
      const v = r.seasons[s];
      if (!v) continue;
      console.log('  ' + pad(s, 8) + ' ' + pad(v.msPerFrame, 9) + ' ' + pad(v.bakesPerFrame, 12)
        + ' ' + pad(v.reusePerBake, 11) + ' ' + v.cacheMB);
    }
    console.log('  sustained hold (peak ' + r.sustained.peakCacheMB + 'MB of ' + r.budgetMB + 'MB budget)');
    console.log('    day    season   ms/frame  bakes/f  cacheMB  evictMB  heapMB');
    for (const s of r.sustained.samples)
      console.log('    ' + pad(s.gameDay, 6) + ' ' + pad(s.season, 8) + ' ' + pad(s.msPerFrame, 9)
        + ' ' + pad(s.bakesPerFrame, 8) + ' ' + pad(s.cacheMB, 8) + ' ' + pad(s.evictableMB, 8) + ' ' + s.heapMB);
    if (r.pageErrors.length) console.log('  PAGE ERRORS: ' + r.pageErrors.join(' | '));
    console.log('');
  }
  console.log('evictMB is the part of the cache eviction may touch (not drawn last frame).');
  console.log('It reaching 0 while cacheMB sits over budget is the shape to watch for.\n');
})().catch(e => { console.error(e.message || e); process.exit(1); });
