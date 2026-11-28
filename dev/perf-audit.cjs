'use strict';
/* Whole-app performance audit. Drives the REAL app in a real browser window at a
   real size. Two halves, deliberately:

     LIVE  — the app's own rAF loop drives the frames; the probe only supplies
             input (camera moves, zoom ticks, brush stamps). This is the honest
             end-to-end number: it includes shouldRenderGarden, updateHUD, the
             compositor and the backdrop-filter recomposite, none of which a
             hand-called render() can see.
     PINNED— the app's loop is stopped (`crashed=true`) and the probe calls
             render()/drawProfile()/perfBench() itself. Two renders per vsync
             makes every number a queue-pressure artifact, so the loop MUST be
             off for these.

   Usage:
     node perf-audit.cjs --profile phone --engine chrome --out r.json
     node perf-audit.cjs --only view     (a turn of the view, a Fit, a zoom step, the lights)
     node perf-audit.cjs --only compare --ab-old <old renderer.js>
                                         (Today/Established, a layer, a scheme switch, a fill,
                                          against an eased Fit; and an idle frame against the old build)
     --repo <dir> serves another checkout (an export of HEAD, for a before/after)
     --garden <file.json>  any exported garden in the repo, of any size

   IT FINISHES ON ANY GARDEN. It used to do everything and report once, under a
   flat 420 s, and several sections cost by the plant: a dozen micro-probes ran
   30 warm and 30 timed calls each whatever one cost, the live scenarios ran a
   fixed number of frames at whatever rate the garden drew, and the sprites-off
   draw profile redraws every plant procedurally some eighty times (minutes on
   16,000 plants). The shrub border outran it at the phone profile and a
   16,000-plant garden at any, with nothing to show for the run. Now:
   - every section says when it is done (stderr, `--quiet` to silence) and
     hands over the results so far;
   - the limit is a STALL, not a total: `--stall <s>` (300) with no section
     finishing, under a generous `--timeout <s>` (3600). A run that stalls
     still writes what it had, marked `partial`, naming the section it was in,
     and exits 1;
   - every section is bounded by TIME as well as by count: a micro-probe stops
     at 400 ms, a live scenario at 10 s (20 frames at least), an event at 6 s,
     the draw profiles take the frames and rounds that fit 45 s, and the
     sprites-off one is skipped, with a note, where a single procedural frame
     costs over 3 s. A section cut short says so (`cutShort`, `followed`).
   `--headless` runs Chrome without a window, to check the tool itself; its
   numbers are a software raster's and not a real window's.
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');
const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = path.resolve(opt('repo', path.join(__dirname, '..')));
const SOFT = flag('soft');
const OUTFILE = opt('out', null);
const GARDEN = opt('garden', 'demo');          // demo | stress | a garden file
const QUIET = flag('quiet'), HEADLESS = flag('headless');
const STALL_MS = Math.max(30, +opt('stall', 300)) * 1000, TOTAL_MS = Math.max(60, +opt('timeout', 3600)) * 1000;

const PROFILES = {
  phone: { w: 390, h: 844, dpr: 3, frame: 1 },
  'phone-landscape': { w: 844, h: 390, dpr: 3, frame: 1 },
  tablet: { w: 820, h: 1180, dpr: 2, frame: 1 },
  'tablet-landscape': { w: 1180, h: 820, dpr: 2, frame: 1 },
  desktop: { w: 1440, h: 900, dpr: 1 },
  large: { w: 2360, h: 1330, dpr: 2 },
};
const PROFILE = opt('profile', 'desktop');
const P = PROFILES[PROFILE];
if (!P) { console.error('unknown profile ' + PROFILE); process.exit(1); }

const ENGINES = {
  chrome: {
    exe: ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
    args: (prof, url) => ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--window-size=' + (P.frame ? P.w + 40 : P.w) + ',' + (P.frame ? P.h + 130 : P.h), '--window-position=0,0',
      '--force-device-scale-factor=' + P.dpr,
      ...(SOFT ? ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization', '--disable-gpu-compositing'] : []),
      ...(HEADLESS ? ['--headless=new'] : []),
      '--new-window', url]
  },
  firefox: {
    exe: ['C:/Program Files/Mozilla Firefox/firefox.exe'],
    args: (prof, url) => ['-profile', prof, '-no-remote', '-new-instance',
      '-width', String(P.frame ? P.w + 40 : P.w), '-height', String(P.frame ? P.h + 130 : P.h), url],
    profilePrefs: 'user_pref("layout.css.devPixelsPerPx", "' + P.dpr + '");\n'
      + 'user_pref("browser.shell.checkDefaultBrowser", false);\n'
      + 'user_pref("datareporting.policy.dataSubmissionEnabled", false);\n'
      + 'user_pref("toolkit.telemetry.enabled", false);\n'
      + 'user_pref("browser.aboutwelcome.enabled", false);\n'
      + 'user_pref("browser.startup.homepage_override.mstone", "ignore");\n'
      + 'user_pref("browser.tabs.warnOnClose", false);\n'
  }
};
const FRAMED = !!P.frame;
const ENGNAME = opt('engine', 'chrome');
const ENG = ENGINES[ENGNAME];

/* ------------------------------------------------------------------ in page */
function inPage(env) {
  const out = { probe: {}, notes: [] };
  /* Flushed through a 1x1 CPU canvas, never by reading `cnv` itself. Chrome
     moves a 2D canvas that is read back to the CPU, for good after about a
     hundred reads, and from then on every sprite blit is a readback of its own:
     a few ms a frame becomes a couple of hundred. This probe read `cnv` in its
     pinned loops, so the numbers after the first hundred flushes described a
     canvas no gardener has. dev/ff-bench.cjs has the full record. Drawing the
     garden into the scratch canvas still waits for its queued raster, which is
     all a flush is for. */
  const probeCv = document.createElement('canvas');
  probeCv.width = probeCv.height = 1;
  const probeCx = probeCv.getContext('2d', { willReadFrequently: true });
  const flush = () => { try { probeCx.drawImage(cnv, 0, 0, 1, 1); probeCx.getImageData(0, 0, 1, 1); } catch (e) { } };
  const st = a => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return { n, min: +s[0].toFixed(2), p50: +s[n >> 1].toFixed(2),
      p95: +s[Math.min(n - 1, Math.floor(n * .95))].toFixed(2), max: +s[n - 1].toFixed(2),
      mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2) };
  };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  /* A section is done: say so, and hand over what there is so far. The run is
     timed out by how long it has been SILENT, and a run that stalls still
     reports everything up to there. */
  const tRun = performance.now();
  out.sections = [];
  const progress = async name => {
    const at = Math.round(performance.now() - tRun);
    out.sections.push([name, at]);
    try { await fetch('/__progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, at, out }) }); } catch (e) { }
  };
  // every loop below stops on the clock as well as on its count, so a garden that draws at 3fps takes minutes and not an hour
  const LIVE_MAX_MS = 10000, EVENT_MAX_MS = 6000, MICRO_MS = 400, PROFILE_MAX_MS = 45000, PROC_FRAME_MAX_MS = 3000;
  const snapPhases = frames => {
    const ph = {}; let sum = 0;
    for (const k in dbg.acc) { if (k === 'frame') continue; ph[k] = +(dbg.acc[k] / frames).toFixed(3); sum += dbg.acc[k]; }
    ph._frameMark = +((dbg.acc.frame || 0) / frames).toFixed(3);
    ph._phaseSum = +(sum / frames).toFixed(3);
    return ph;
  };
  const snapEvents = () => {
    const e = {};
    for (const k in dbg.ev) { const v = dbg.ev[k]; e[k] = { n: v.n, max: +v.max.toFixed(2), total: +v.total.toFixed(1) }; }
    return e;
  };

  /* LIVE: the app's own loop renders. We only feed input and watch the clock. */
  async function live(name, step, frames) {
    frames = frames || 60;
    for (let i = 0; i < 10; i++) { await raf(); step(i, performance.now()); }
    dbg.on = true; dbgReset(); devReset();
    dbg.fpsAt = 1e12;                 // stop frame()'s own 500ms dbgReset from eating the window
    dbg.n = 0;
    const gaps = []; let prev = null, cut = false;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const t = await raf();
      if (prev !== null) gaps.push(t - prev);
      prev = t;
      step(i, t);
      if (i >= 19 && performance.now() - t0 > LIVE_MAX_MS) { frames = i + 1; cut = true; break; }
    }
    const wall = performance.now() - t0;
    const drawn = dbg.n || 1;
    const res = {
      rafGapMs: st(gaps), framesRendered: dbg.n, framesTotal: frames, cutShort: cut || undefined,
      fps: +(frames * 1000 / wall).toFixed(1),
      phasesPerRenderedFrame: snapPhases(drawn), events: snapEvents(),
      gapMax: +dbg.gapMax.toFixed(1), gapOver: dbg.gapOver,
      ents: scene && scene.ents ? scene.ents.length : null,
      sprites: { on: PSPRITE.active, n: PSPRITE.map.size, MiB: +(PSPRITE.bytes / 1048576).toFixed(2),
        sn: typeof SSPRITE !== 'undefined' ? SSPRITE.map.size : null,
        sMiB: typeof SSPRITE !== 'undefined' ? +(SSPRITE.bytes / 1048576).toFixed(2) : null }
    };
    dbg.on = false; dbg.fpsAt = 0;
    out[name] = res;
    await progress(name);
    return res;
  }

  /* PINNED: our own render(), app loop stopped. */
  async function pinned(name, step, frames) {
    frames = frames || 40;
    for (let i = 0; i < 8; i++) { await raf(); step(i, performance.now()); render(performance.now()); }
    flush();
    dbg.on = true; dbgReset(); devReset();
    const js = [], gaps = []; let prev = null, cut = false;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const t = await raf();
      if (prev !== null) gaps.push(t - prev);
      prev = t;
      step(i, t);
      const a = performance.now(); render(t); js.push(performance.now() - a);
      if (i >= 7 && performance.now() - t0 > LIVE_MAX_MS) { frames = i + 1; cut = true; break; }
    }
    flush();
    const res = { jsMs: st(js), rafGapMs: st(gaps), phases: snapPhases(frames), events: snapEvents(),
      ents: scene && scene.ents ? scene.ents.length : null, frames, cutShort: cut || undefined };
    dbg.on = false;
    out[name] = res;
    await progress(name);
    return res;
  }

  /* `n` calls, or as many as fit MICRO_MS (three at least). The clock is read
     between BATCHES that grow while a batch is under a millisecond, so a probe
     of a 1us function is not timing performance.now(). It ran n warm and n
     timed calls whatever one cost: 30 + 30 of a 50ms buildScene, a dozen probes
     over. */
  const micro = (name, fn, n) => {
    n = n || 1500;
    try {
      let t0 = performance.now(), done = 0, batch = 1;
      const warm = Math.min(n, 150);
      while (done < warm) { const m = Math.min(batch, warm - done); for (let k = 0; k < m; k++) fn(); done += m;
        const el = performance.now() - t0; if (el >= MICRO_MS / 3) break; if (el < 1) batch *= 4; }
      t0 = performance.now(); done = 0; batch = 1;
      while (done < n) { const m = Math.min(batch, n - done); for (let k = 0; k < m; k++) fn(); done += m;
        const el = performance.now() - t0; if (done >= 3 && el >= MICRO_MS) break; if (el < 1) batch *= 4; }
      out.probe[name] = +((performance.now() - t0) * 1000 / done).toFixed(3);
    } catch (e) { out.probe[name] = 'ERR ' + (e && e.message); }
  };

  return (async () => {
    out.ua = navigator.userAgent;
    out.viewport = [innerWidth, innerHeight];
    out.dpr = devicePixelRatio; out.appDPR = DPR; out.zoom = ZOOM; out.baseZoom = baseZoom;
    out.canvas = [cnv.width, cnv.height];
    out.hidden = document.hidden;
    out.tier = typeof mobileSheetUi === 'function' ? (mobileSheetUi() ? 'SHEET' : 'DOCK') : '?';
    out.glassOff = document.body.classList.contains('no-glass');
    out.domNodes = document.getElementsByTagName('*').length;
    out.plants = Object.keys(game.plants || {}).length;
    out.plotTiles = GW * GH;
    out.startup = env.startup;
    out.resources = performance.getEntriesByType('resource')
      .filter(r => /\.(js|css|woff2|json)(\?|$)/.test(r.name))
      .map(r => ({ n: r.name.replace(location.origin, ''), ms: +r.duration.toFixed(1), kb: Math.round((r.decodedBodySize || r.transferSize || 0) / 1024) }))
      .sort((a, b) => b.kb - a.kb).slice(0, 20);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) out.nav = { domInteractive: +nav.domInteractive.toFixed(1), dcl: +nav.domContentLoadedEventEnd.toFixed(1), load: +nav.loadEventEnd.toFixed(1) };
    out.paint = {}; for (const p of performance.getEntriesByType('paint')) out.paint[p.name] = +p.startTime.toFixed(1);

    /* VIEW CHANGES: a turn of the view, a Fit, the lights. Each is ONE event
       fired into the running loop and followed for `n` frames; what matters is
       the frames right after it (the worst gap, how many were over a 60Hz
       frame), and how many full ground bakes it asked for. Run on any build:
       one without eased changes takes the same calls instantly, which is the
       "before". `--only view` runs these alone. */
    const settle = ms => new Promise(r => setTimeout(r, ms));
    // warm: that many reps first, not recorded (a first event pays for what the page has not done yet)
    async function liveEvent(name, prep, fire, reps, n, settleMs, warm) {
      const per = [];
      for (let k = 0; k < reps + (warm || 0); k++) {
        prep(k);
        await settle(settleMs || 900);     // the crisp settles land, and a rotation's pre-bake (GROUND_IDLE_MS)
        for (let i = 0; i < 3; i++) await raf();
        dbg.on = true; dbgReset(); devReset(); dbg.fpsAt = 1e12; dbg.n = 0;
        const gaps = []; let prev = await raf();
        const a = performance.now(); fire(k); const fireMs = performance.now() - a;
        for (let i = 0; i < n; i++) { const t = await raf(); gaps.push(t - prev); prev = t;
          if (i >= 9 && performance.now() - a > EVENT_MAX_MS) break; }
        const ev = snapEvents();
        if (k >= (warm || 0)) per.push({ fireMs: +fireMs.toFixed(2), gaps, drawn: dbg.n,
          bakes: (ev.bake ? ev.bake.n : 0), bakeMax: ev.bake ? ev.bake.max : 0, sceneMax: ev.scene ? ev.scene.max : 0 });
        dbg.on = false; dbg.fpsAt = 0;
      }
      const all = per.flatMap(p => p.gaps), worst = per.map(p => Math.max(...p.gaps));
      const res = {
        reps, framesFollowed: n, followed: per.map(p => p.gaps.length),
        rafGapMs: st(all), worstGapPerEvent: worst.map(v => +v.toFixed(1)),
        over16: per.map(p => p.gaps.filter(g => g > 16.7).length),
        fireMs: per.map(p => p.fireMs), drawn: per.map(p => p.drawn),
        fullBakes: per.map(p => p.bakes), bakeMaxMs: per.map(p => p.bakeMax), sceneMaxMs: per.map(p => p.sceneMax)
      };
      out[name] = res;
      await progress(name);
      return res;
    }
    async function viewScenarios() {
      const camA = { x: cam.x, y: cam.y }, zA = userZoom;
      await liveEvent('view-rotate', () => { }, () => rotateView(1), 4, 45);
      // a Fit from 200% on a corner of the plot, as a gardener presses it
      await liveEvent('view-fit', () => {
        setUserZoom(2); const c = screenOfFlat(GW * 0.15, GH * 0.2, VW / ZOOM, VH / ZOOM);
        cam.x += c[0] - VW / ZOOM / 2; cam.y += c[1] - VH / ZOOM * 0.24;
      }, () => (document.getElementById('btnZoomFit') || {}).onclick(), 4, 45);
      await liveEvent('view-zoom-step', () => { fitPlot(); }, k => (document.getElementById(k % 2 ? 'btnZoomOut' : 'btnZoomIn') || {}).onclick(), 4, 45);
      await liveEvent('view-night', () => { }, () => document.getElementById('btnDayNight').onclick(), 4, 60);
      setLayerVis('night', false, false); cam.x = camA.x; cam.y = camA.y; setUserZoom(zA);
      if (typeof updateDayNightBtn === 'function') updateDayNightBtn();
    }
    if (env.only === 'view') { await viewScenarios(); return out; }

    /* COMPARING: the lens switch, a layer, a scheme switch, a fill. `--only
       compare` runs these against the eased Fit, which is the bar a lens
       switch's frames are held to (LENS.CAP, renderer.js): the lens grows the
       plants on screen, the "-cut" arms take the same change with that motion
       off (no plant grows, a fill lands at once), so the difference is the
       motion's own cost. A lens switch re-bakes every plant on screen whichever
       arm, so each rep waits 2.5s for that to finish before the next. Then, with
       the loop stopped, an in-page A/B of a frame with NOTHING running against
       the previous build's entity-pass functions (`--ab-old <renderer.js>`),
       interleaved, which is the check that the effects cost an idle frame
       nothing. */
    async function compareScenarios() {
      const camA = { x: cam.x, y: cam.y }, zA = userZoom;
      fitPlot();
      out.compareView = { zoom: +ZOOM.toFixed(3), plants: Object.keys(game.plants).length };
      await liveEvent('compare-fit', () => {
        setUserZoom(2); const c = screenOfFlat(GW * 0.15, GH * 0.2, VW / ZOOM, VH / ZOOM);
        cam.x += c[0] - VW / ZOOM / 2; cam.y += c[1] - VH / ZOOM * 0.24;
      }, () => (document.getElementById('btnZoomFit') || {}).onclick(), 4, 45);
      fitPlot();
      const lens = k => setPreviewMode(game.previewMode === 'established' ? 'today' : 'established');
      const cap0 = LENS.CAP;
      await liveEvent('compare-lens-cut', () => { LENS.CAP = 0; }, lens, 4, 45, 2500, 2);
      await liveEvent('compare-lens', () => { LENS.CAP = cap0; }, lens, 4, 45, 2500);
      LENS.CAP = cap0;
      // how many plants a switch here grows, and what lensBegin costs on its first frame
      { const W = VW / ZOOM, H = VH / ZOOM; lensSwitch(); game.previewMode = game.previewMode === 'established' ? 'today' : 'established';
        buildScene(W, H); const a = performance.now(); lensBegin(W, H, performance.now()); out.compareLensBeginMs = +(performance.now() - a).toFixed(2);
        out.compareLensGrows = LENS.grow.size;
        { const a = performance.now(); lensSwitch(); out.compareLensSwitchMs = +(performance.now() - a).toFixed(2); LENS.armed = false; LENS.from = null; } LENS.grow.clear(); plantFxCount(); game.previewMode = 'established'; }
      const layerFlip = fade => () => { if (fade) requestViewFade('layer'); setLayerVis('perennials', !layerShown('perennials')); refreshCanvasTools(); };
      await liveEvent('compare-layer-cut', () => { }, layerFlip(false), 4, 30, 1500, 2);
      await liveEvent('compare-layer', () => { }, layerFlip(true), 4, 30, 1500);
      setLayerVis('perennials', true);
      // a second scheme, a copy with sixty plants swapped, then flick between them
      try {
        if (schemeCount() < 2){
          createScheme(true);
          const keys = Object.keys(game.plants).filter(k => !game.plants[k].removed).slice(0, 60);
          for (const k of keys) setTile('plants', k, Object.assign({}, game.plants[k], { s: game.plants[k].s === 'bluestem' ? 'karl' : 'bluestem', v: null }));
        }
        let flashed = 0;
        await liveEvent('compare-scheme', () => { }, () => { cycleScheme(1); flashed = EDIT_FX.flash ? EDIT_FX.flash.tiles.length : 0; }, 4, 45, 2500);
        out['compare-scheme'].flashTiles = flashed;
        { const was = {}; for (const k of SCHEME_LAYERS) was[k] = game[k];
          const other = schemeList().find(s => s.id !== game.schemeActive), a = performance.now(), t = new Set();
          for (const k of SCHEME_LAYERS) schemeDiffTiles(was[k], other[k], t, Infinity);
          out.compareSchemeDiffMs = +(performance.now() - a).toFixed(2); out.compareSchemeDiffTiles = t.size; }
      } catch (e) { out.notes.push('scheme: ' + e.message); }
      // a fill: the largest open lawn region of a sampled few, filled and undone
      try {
        const seeds = [];
        for (let i = 0; i < 400 && seeds.length < 60; i++){
          const x = (Math.random() * GW) | 0, y = (Math.random() * GH) | 0;
          if (onPlot(x, y) && !tileTerrain(x, y) && !game.plants[x + ',' + y] && !siteStructureAt(x, y)) seeds.push([x, y]);
        }
        const regionSize = (sx, sy) => { const seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
          for (let i = 0; i < q.length && q.length < 3000; i++){ const [x, y] = q[i];
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
              if (seen.has(k) || !onPlot(nx, ny) || tileTerrain(nx, ny) || siteStructureAt(nx, ny) || elevationAt(nx, ny) !== elevationAt(sx, sy)) continue;
              seen.add(k); q.push([nx, ny]); } }
          return q.length; };
        let best = null, bestN = 0;
        for (const [x, y] of seeds){ const n = regionSize(x, y); if (n > bestN && n <= 2500){ best = [x, y]; bestN = n; } }
        out.compareFillRegion = bestN;
        if (best){
          const tool0 = game.tool, fill0 = game.fillMode, sp0 = EDIT_FX.FILL_SPREAD_MS;
          game.tool = 'bluestem'; game.toolVar = null; game.fillMode = true;
          const fill = () => { doFloodFill(best[0], best[1]); };
          const undoPrev = k => { if (k) doUndo(); };
          await liveEvent('compare-fill-cut', k => { EDIT_FX.FILL_SPREAD_MS = 0; undoPrev(k); }, fill, 4, 45, 1500, 1);
          doUndo();
          await liveEvent('compare-fill', k => { EDIT_FX.FILL_SPREAD_MS = sp0; undoPrev(k); }, fill, 4, 45, 1500);
          doUndo(); EDIT_FX.FILL_SPREAD_MS = sp0; game.tool = tool0; game.fillMode = fill0;
        }
      } catch (e) { out.notes.push('fill: ' + e.message); }
      cam.x = camA.x; cam.y = camA.y; setUserZoom(zA);
      // the idle A/B, loop stopped
      try {
        const res = await fetch('/__old.js');
        if (!res.ok) { out.notes.push('idle A/B: no --ab-old given'); return; }
        /* Both arms are fresh copies of the functions, compiled from source the
           same way, so neither carries the other's history in the JIT (the live
           functions have been through every scenario above, the old ones none). */
        const texts = { old: await res.text(), now: await (await fetch('/js/renderer.js')).text() };
        const fnSrc = (text, name) => {
          const i = text.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('no ' + name);
          let d = 0, j = text.indexOf('{', i);
          for (; j < text.length; j++){ const c = text[j]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
          return text.slice(i + 1, j + 1);
        };
        const names = ['drawSceneEnt', 'drawPlantMaybeCached', 'blitPlantSprite', 'editFxFrame'];
        const arms = { now: {}, old: {}, live: {} };
        for (const n of names){ arms.live[n] = globalThis[n];
          arms.now[n] = (0, eval)('(' + fnSrc(texts.now, n) + ')'); arms.old[n] = (0, eval)('(' + fnSrc(texts.old, n) + ')'); }
        const use = a => { for (const n of names) globalThis[n] = arms[a][n]; };
        crashed = true; await settle(300);
        fitPlot(); for (let i = 0; i < 30; i++) render(performance.now());
        const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
        // frames a run, by what one costs here: both arms of an A/B take the same, so the comparison holds
        const f0 = performance.now(); render(f0); flush(); const oneMs = performance.now() - f0;
        const abFrames = n => oneMs > 40 ? Math.max(4, Math.round(n / 3)) : n;
        /* The growth's own cost, with the bakes out of it: every plant on screen
           held half way through a growth (its sprites are all baked by now), against
           the same frames with nothing growing, interleaved. */
        { const W = VW / ZOOM, H = VH / ZOOM, ms0 = LENS.MS, offX = W / 2 - cam.x, offY = H * 0.24 - cam.y, hold = new Map();
          // each held at half its own drawn height, its end worked out as lensBegin does
          for (const e of scene.ents) if ((e.kind === SCENE_K.PLANT || e.kind === SCENE_K.BULB) && lensOnScreen(e, offX, offY, W, H)){
            const g = sceneEntGrowth(e) * (e.kind === SCENE_K.PLANT && e.stunt ? STUNT_GROWTH : 1);
            const hE = lensDrawnH(plantDef(e.p.s, e.p.v), g, lensSprites());
            hold.set(e.p, [hE * 0.5, hE, lensSprites()]);
          }
          const grow = on => { LENS.grow = on ? new Map(hold) : new Map(); LENS.t0 = performance.now() - 1e6; LENS.MS = 2e6; plantFxCount(); };
          const runsG = { on: [], off: [] };
          try {
            for (let r = 0; r < 10; r++) for (const a of (r % 2 ? ['off', 'on'] : ['on', 'off'])){
              grow(a === 'on'); const js = [];
              for (let i = 0; i < abFrames(16); i++){ await raf(); const t0 = performance.now(); render(t0); js.push(performance.now() - t0); }
              flush(); runsG[a].push(med(js));
            }
          } finally { LENS.MS = ms0; LENS.grow = new Map(); plantFxCount(); }
          out.lensHeldAB = { plants: hold.size,
            growingMs: { min: +Math.min(...runsG.on).toFixed(3), p50: +med(runsG.on).toFixed(3) },
            stillMs: { min: +Math.min(...runsG.off).toFixed(3), p50: +med(runsG.off).toFixed(3) } };
          await progress('lensHeldAB');
        }
        const runs = { now: [], old: [] };
        for (let r = 0; r < 16; r++){
          for (const a of (r % 2 ? ['old', 'now'] : ['now', 'old'])){
            use(a); const js = [];
            for (let i = 0; i < abFrames(24); i++){ await raf(); const t0 = performance.now(); render(t0); js.push(performance.now() - t0); }
            flush(); runs[a].push(med(js));
          }
        }
        use('live');
        out.idleAB = { idle: !sproutLive && !LENS.armed && !seasonFadeActive(),
          nowMs: { min: +Math.min(...runs.now).toFixed(3), p50: +med(runs.now).toFixed(3) },
          oldMs: { min: +Math.min(...runs.old).toFixed(3), p50: +med(runs.old).toFixed(3) } };
        await progress('idleAB');
        crashed = false;
      } catch (e) { out.notes.push('idle A/B: ' + e.message); }
    }
    if (env.only === 'compare') { await compareScenarios(); return out; }

    // ============ LIVE half (app loop running) ============
    const cam0 = { x: cam.x, y: cam.y };
    await live('live-idle', () => { }, 60);
    await live('live-pan', i => { cam.x = cam0.x + Math.sin(i / 30 * Math.PI * 2) * 420; cam.y = cam0.y + Math.cos(i / 30 * Math.PI * 2) * 120; }, 90);
    cam.x = cam0.x; cam.y = cam0.y;
    const z0 = userZoom;
    // a mouse wheel is a stream of discrete ~6% ticks in ONE direction
    await live('live-zoom-wheel', i => { setUserZoom(z0 * Math.pow(1.06, (i < 24 ? i : 48 - i) % 25)); }, 60);
    setUserZoom(z0);
    await live('live-hover', i => { game.hoverTile = [(i * 3) % GW, (i * 5) % GH]; }, 60);
    game.hoverTile = null;

    // paint drag: the app's commonest interaction
    const tool0 = game.tool;
    try {
      game.tool = 'bed'; game.bedStyle = 'gravel'; game.brushSize = 5;
      await live('live-paint-bed-drag', i => {
        const x = 3 + (i % Math.max(1, GW - 8)), y = 4 + ((i * 2) % Math.max(1, GH - 10));
        game.hoverTile = [x, y];
        if (typeof stampBrushAt === 'function') stampBrushAt(x, y);
      }, 60);
    } catch (e) { out.notes.push('paint drag: ' + e.message); }
    game.tool = tool0; game.hoverTile = null;

    // selection drag: every selected plant is re-drawn procedurally each frame
    try {
      game.tool = 'select';
      game.sel = { x0: 4, y0: 4, x1: Math.min(GW - 2, 24), y1: Math.min(GH - 2, 20) };
      game.selItems = selectionPayload(game.sel);
      out.selItems = game.selItems.length;
      out.selPlants = game.selItems.filter(c => c.plant || c.bulb).length;
      await live('live-selection-rest', () => { }, 45);
      selMove = { curX: 6, curY: 6, grabX: 5, grabY: 5, copy: false };
      await live('live-selection-drag', i => { selMove.curX = 6 + (i % 6); selMove.curY = 6 + ((i >> 1) % 4); }, 60);
      selMove = null;
    } catch (e) { out.notes.push('selection: ' + e.message); }
    game.sel = null; game.selItems = null; game.tool = tool0;

    // fast-forward hold
    const wasPaused = game.pausedAt;
    try {
      game.pausedAt = 0; game.ffActive = true;
      await live('live-fast-forward', () => { }, 90);
    } catch (e) { out.notes.push('ff: ' + e.message); }
    game.ffActive = false; game.pausedAt = wasPaused;

    await viewScenarios();

    // ============ PINNED half ============
    crashed = true;                  // stop the app's loop: two renders a vsync is queue pressure, not a measurement

    await new Promise(r => setTimeout(r, 200));

    micro('renderStateSig_us', () => renderStateSig());
    micro('shouldRenderGarden_us', () => shouldRenderGarden(performance.now()));
    micro('updateHUD_us', () => updateHUD(), 400);
    micro('updateCompass_us', () => updateCompass(), 400);
    micro('usableCanvasRect_us', () => usableCanvasRect(), 400);
    micro('trayStateSig_us', () => trayStateSig(), 400);
    micro('screenOf_us', () => screenOf(10.5, 12.5));
    micro('shrubIndex_us', () => shrubIndex(), 400);
    micro('buildScene_us', () => { game.sceneRev++; buildScene(VW / ZOOM, VH / ZOOM); }, 30);
    micro('ensureShadeMap_us', () => { game.shadeRev++; ensureShadeMap(); }, 15);
    micro('snapshotState_us', () => snapshotState(), 30);
    micro('buildSaveBlob_us', () => buildSaveBlob(), 15);
    micro('buildToolTray_us', () => buildToolTray(true), 8);
    await progress('micro');

    await pinned('pin-stationary', () => { }, 40);
    /* The draw profile renders the whole scene, and then each class of it alone,
       rounds x (frames + 1) times apiece. So it takes the frames and rounds that
       fit PROFILE_MAX_MS at what a frame costs HERE, down to its own floor of 4
       and 3; counted as three heavy runs (the full scene and its two big classes). */
    const profileFit = (ms, frames, rounds) => {
      const cost = () => 3 * rounds * (frames + 1) * ms;
      while (cost() > PROFILE_MAX_MS && rounds > 3) rounds--;
      while (cost() > PROFILE_MAX_MS && frames > 4) frames--;
      return { frames, rounds };
    };
    /* What a frame of the PASS costs, which is what the profile renders: on a
       garden drawn from its kept picture (FAR) a stationary frame is one blit,
       0.3ms where the pass is 35. Older builds have no FAR and need none of this. */
    let passMs = out['pin-stationary'].jsMs.p50;
    if (typeof FAR !== 'undefined') { const on = FAR.on;
      try { FAR.on = false; render(performance.now()); flush(); const a = performance.now(); render(performance.now()); flush(); passMs = Math.max(passMs, performance.now() - a); }
      finally { FAR.on = on; } }
    out.passFrameMs = +passMs.toFixed(2);
    const frameMs = passMs;
    try { out.drawProfile = drawProfile(profileFit(frameMs, 14, 4)); } catch (e) { out.drawProfile = 'ERR ' + e.message; }
    await progress('drawProfile');
    /* Sprites off, every plant is drawn procedurally on every frame. One such
       frame is timed first: past PROC_FRAME_MAX_MS the profile is left out,
       with what that frame cost, where it used to be what ran the clock out. */
    try {
      const off = PSPRITE.off, act = PSPRITE.active; let procMs = 0;
      try { PSPRITE.off = true; PSPRITE.active = false; render(performance.now()); flush();
        const a = performance.now(); render(performance.now()); flush(); procMs = performance.now() - a; }
      finally { PSPRITE.off = off; PSPRITE.active = act; }
      out.proceduralFrameMs = +procMs.toFixed(1);
      if (procMs > PROC_FRAME_MAX_MS) { out.drawProfileNoSprites = null;
        out.notes.push('drawProfileNoSprites skipped: one procedural frame costs ' + Math.round(procMs) + 'ms here'); }
      else out.drawProfileNoSprites = drawProfile(Object.assign(profileFit(procMs, 10, 3), { sprites: 'off' }));
    } catch (e) { out.notes.push('drawProfileNoSprites: ' + e.message); }
    await progress('drawProfileNoSprites');

    // the season wash arms, on this engine
    try {
      const m0 = SEASON_WASH.mode;
      // fewer frames where a frame is dear: three modes of 4 + 4x10 renders was 132 of them
      const wn = frameMs > 80 ? 3 : 10, wr = frameMs > 80 ? 2 : 4;
      const tw = mode => { SEASON_WASH.mode = mode; if (typeof washSurf !== 'undefined') washSurf.key = '';
        for (let i = 0; i < Math.min(4, wn); i++) render(1e6); flush();
        let best = Infinity;
        for (let r = 0; r < wr; r++) { const a = performance.now(); for (let i = 0; i < wn; i++) render(1e6); flush(); const v = (performance.now() - a) / wn; if (v < best) best = v; }
        return +best.toFixed(2); };
      out.washFrameMs = { live: tw('live'), cached: tw('cached'), surface: tw('surface') };
      SEASON_WASH.mode = m0; if (typeof washSurf !== 'undefined') washSurf.key = '';
    } catch (e) { out.notes.push('wash: ' + e.message); }
    await progress('wash');

    try { dbg.on = true; devReset(); out.groundBench = perfBench({ gw: 46, gh: 46, rounds: 7, edit: true }); dbg.on = false; } catch (e) { out.groundBench = 'ERR ' + e.message; }
    await progress('groundBench');
    return out;
  })();
}

/* ------------- second probe: UI/chrome/startup costs on a fresh page ------------- */
function inPageUI() {
  const out = { probe: {} };
  const st = a => { const s = a.slice().sort((x, y) => x - y); return { n: s.length, min: +s[0].toFixed(2), p50: +s[s.length >> 1].toFixed(2), max: +s[s.length - 1].toFixed(2) }; };
  const time = (name, fn, n) => {
    n = n || 6; const t = [];
    try { fn(); for (let i = 0; i < n; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); } out.probe[name] = st(t); }
    catch (e) { out.probe[name] = 'ERR ' + (e && e.message); }
  };
  const raf = () => new Promise(r => requestAnimationFrame(r));
  return (async () => {
    out.ua = navigator.userAgent; out.viewport = [innerWidth, innerHeight];
    out.tier = mobileSheetUi() ? 'SHEET' : 'DOCK';
    out.startupMarks = window.__marks || [];
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) out.nav = { domInteractive: +nav.domInteractive.toFixed(1), dcl: +nav.domContentLoadedEventEnd.toFixed(1), load: +nav.loadEventEnd.toFixed(1) };
    out.paint = {}; for (const p of performance.getEntriesByType('paint')) out.paint[p.name] = +p.startTime.toFixed(1);
    out.menuDomNodes = document.getElementsByTagName('*').length;
    // menu meadow, as the app's own loop runs it
    let prev = null; const gaps = [];
    for (let i = 0; i < 60; i++) { const t = await raf(); if (prev !== null) gaps.push(t - prev); prev = t; }
    out.menuRafGap = st(gaps);
    crashed = true;
    const mjs = [];
    for (let i = 0; i < 25; i++) { await raf(); const a = performance.now(); menuRender(performance.now()); mjs.push(performance.now() - a); }
    out.menuRenderMs = st(mjs);
    time('openLibrary_ms', () => { openLibrary(); }, 4);
    out.libraryRows = document.querySelectorAll('.lib-item').length;
    out.libraryDomNodes = document.getElementsByTagName('*').length;
    if (typeof buildLibraryList === 'function') time('buildLibraryList_ms', () => buildLibraryList(), 4);
    const f = document.getElementById('librarySearch');
    if (f && typeof applyLibrarySearch === 'function') { f.value = 'a'; time('librarySearch_a_ms', () => applyLibrarySearch(), 4); f.value = ''; applyLibrarySearch(); }
    show('menuScreen');
    if (typeof openGuide === 'function') { time('openGuide_ms', () => openGuide(), 3); out.guideDomNodes = document.getElementsByTagName('*').length; show('menuScreen'); }
    if (typeof openWorlds === 'function') { time('openWorlds_ms', () => openWorlds(), 3); show('menuScreen'); }
    return out;
  })();
}

/* ------------------------------------------------------------------- server */
function server(driverBody, onProgress) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  let resolveResult; const ready = new Promise(r => resolveResult = r);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(b)); } catch (e) { resolveResult({ error: String(b).slice(0, 3000) }); } });
      return;
    }
    if (req.method === 'POST' && req.url === '/__progress') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { const p = JSON.parse(b); if (onProgress) onProgress(p.name, p.at, p.out); } catch (e) { } });
      return;
    }
    if (req.url === '/__old.js') {
      const f = opt('ab-old', null);
      if (!f || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store');
      res.end(fs.readFileSync(f)); return;
    }
    if (req.url.startsWith('/__driver.js')) {
      res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store');
      res.end(driverBody); return;
    }
    if (FRAMED && (req.url === '/' || req.url === '/__host')) {
      res.setHeader('Content-Type', 'text/html'); res.setHeader('Cache-Control', 'no-store');
      res.end('<!doctype html><meta charset=utf8><title>audit host</title>'
        + '<style>html,body{margin:0;background:#222;overflow:hidden}'
        + 'iframe{border:0;display:block;width:' + P.w + 'px;height:' + P.h + 'px}</style>'
        + '<iframe src="/__app"></iframe>');
      return;
    }
    const rel = (req.url === '/' || req.url === '/__app') ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const abs = path.resolve(REPO, rel);
    if (!abs.startsWith(path.resolve(REPO) + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (e, buf) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
      if (path.basename(abs) === 'index.html') {
        let s = String(buf)
          .replace("if ('serviceWorker' in navigator)", 'if (false)')
          .replace('<head>', '<head><script>window.__t0=performance.now();window.__marks=[];window.__mark=n=>window.__marks.push([n,+(performance.now()).toFixed(1)]);</script>');
        // measurement-only: stamp the time each module finishes evaluating
        s = s.replace(/<script src="(js\/[a-z0-9-]+\.js)"><\/script>/g,
          (m, p1) => m + '<script>window.__mark(' + JSON.stringify(p1) + ')</script>');
        s = s.replace('</body>', '<script src="/__driver.js"></script></body>');
        buf = Buffer.from(s);
      }
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, ready })));
}

const driverFor = (probeFn, boot) => `
(async function(){
  const post = o => fetch('/__result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); }catch(e){}
    let guard=0;
    while ((typeof enterWorld!=='function' || typeof PSPRITE==='undefined') && guard++<400) await new Promise(r=>setTimeout(r,25));
    const startup = { marks: window.__marks||[] };
    ${boot}
    try{ await fetch('/__progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'opened'})}); }catch(e){}
    const fn = (${String(probeFn)});
    const out = await fn({startup, only:${JSON.stringify(opt('only', null))}});
    out.profileName = ${JSON.stringify(PROFILE)};
    out.engine = ${JSON.stringify(ENGNAME)};
    out.soft = ${JSON.stringify(SOFT)};
    await post(out);
  }catch(e){ await post({error:String(e&&e.stack||e)}); }
})();`;

/* The garden has to be OPEN before anything is timed. enterWorld returns with
   the garden still being prepared behind its cover (prepareGardenOpen), which is
   0.3 s for the demo garden and several seconds for a big one, and render()
   draws nothing until it is done: on a 16,000-plant garden the first scenarios
   ran at 160 fps because they were timing an empty frame. */
const BOOT_DEMO = `
    const envb = await (await fetch('/demo-garden.json')).json();
    await enterWorld(await installWorldBlob(envb));
    game.pausedAt = game.pausedAt || Date.now();
    game.ffActive = false;
    { const t0=performance.now();
      while (typeof gardenOpening!=='undefined' && gardenOpening && performance.now()-t0<240000) await new Promise(r=>setTimeout(r,50));
      startup.openMs=Math.round(performance.now()-t0); startup.opened=!(typeof gardenOpening!=='undefined' && gardenOpening); }
    await new Promise(r=>setTimeout(r,1200));`;

const BOOT_STRESS = BOOT_DEMO + `
    stressGarden();
    await new Promise(r=>setTimeout(r,1200));`;

// --garden dev/test-gardens/woodland.prairie.json: any exported garden file in the repo
const BOOT_FILE = f => BOOT_DEMO.replace("'/demo-garden.json'",
  JSON.stringify('/' + path.relative(REPO, path.resolve(f)).split(path.sep).join('/')));
const bootFor = g => g === 'stress' ? BOOT_STRESS : /\.json$/i.test(g) ? BOOT_FILE(g) : BOOT_DEMO;

async function run(probeFn, boot) {
  const exe = ENG.exe.find(p => fs.existsSync(p));
  if (!exe) throw new Error('browser not installed');
  /* The limit is how long the page has been SILENT. A big garden's run is long
     and keeps reporting; a hung page stops. Either way what it had is kept. */
  const t0 = Date.now(); let last = t0, lastName = 'page load', partial = null;
  const { srv, port, ready } = await server(driverFor(probeFn, boot), (name, at, o) => {
    last = Date.now(); lastName = name; if (o) partial = o;
    if (!QUIET) process.stderr.write('  ' + ((last - t0) / 1000).toFixed(1).padStart(7) + 's  ' + name + '\n');
  });
  sweepStaleTestBrowsers('ppaudit-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppaudit-'));
  if (ENG.profilePrefs) fs.writeFileSync(path.join(profile, 'user.js'), ENG.profilePrefs);
  const child = spawn(exe, ENG.args(profile, 'http://127.0.0.1:' + port + '/'), { stdio: 'ignore' });
  let iv = null;
  const watchdog = new Promise(res => { iv = setInterval(() => {
    const now = Date.now();
    if (now - last > STALL_MS) res({ __stalled: 'nothing finished for ' + Math.round((now - last) / 1000) + 's after "' + lastName + '"' });
    else if (now - t0 > TOTAL_MS) res({ __stalled: 'over the ' + Math.round(TOTAL_MS / 1000) + 's limit, after "' + lastName + '"' });
  }, 1000); });
  const r = await Promise.race([ready, watchdog]);
  clearInterval(iv);
  const result = r && r.__stalled ? Object.assign({}, partial || {}, { error: 'timed out: ' + r.__stalled, partial: true }) : r;
  closeTestBrowser(child, profile);
  srv.close();
  await new Promise(r => setTimeout(r, 800));
  return result;
}

(async () => {
  const which = opt('probe', 'garden');
  const res = which === 'ui' ? await run(inPageUI, '')
    : await run(inPage, bootFor(GARDEN));
  const text = JSON.stringify(res, null, 1);
  if (OUTFILE) fs.writeFileSync(OUTFILE, text);
  console.log(OUTFILE ? ('wrote ' + OUTFILE + (res.error ? ('  ERROR: ' + res.error) : '')) : text);
  if (res.error) { if (!OUTFILE) console.error('ERROR: ' + res.error); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exit(1); });
