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
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');
const REPO = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SOFT = flag('soft');
const OUTFILE = opt('out', null);
const GARDEN = opt('garden', 'demo');          // demo | stress

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
  const cx2 = cnv.getContext('2d');
  const flush = () => { try { cx2.getImageData(0, 0, 1, 1); } catch (e) { } };
  const st = a => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return { n, min: +s[0].toFixed(2), p50: +s[n >> 1].toFixed(2),
      p95: +s[Math.min(n - 1, Math.floor(n * .95))].toFixed(2), max: +s[n - 1].toFixed(2),
      mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2) };
  };
  const raf = () => new Promise(r => requestAnimationFrame(r));
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
    const gaps = []; let prev = null;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const t = await raf();
      if (prev !== null) gaps.push(t - prev);
      prev = t;
      step(i, t);
    }
    const wall = performance.now() - t0;
    const drawn = dbg.n || 1;
    const res = {
      rafGapMs: st(gaps), framesRendered: dbg.n, framesTotal: frames,
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
    return res;
  }

  /* PINNED: our own render(), app loop stopped. */
  async function pinned(name, step, frames) {
    frames = frames || 40;
    for (let i = 0; i < 8; i++) { await raf(); step(i, performance.now()); render(performance.now()); }
    flush();
    dbg.on = true; dbgReset(); devReset();
    const js = [], gaps = []; let prev = null;
    for (let i = 0; i < frames; i++) {
      const t = await raf();
      if (prev !== null) gaps.push(t - prev);
      prev = t;
      step(i, t);
      const a = performance.now(); render(t); js.push(performance.now() - a);
    }
    flush();
    const res = { jsMs: st(js), rafGapMs: st(gaps), phases: snapPhases(frames), events: snapEvents(),
      ents: scene && scene.ents ? scene.ents.length : null };
    dbg.on = false;
    out[name] = res;
    return res;
  }

  const micro = (name, fn, n) => {
    n = n || 1500;
    try {
      for (let i = 0; i < Math.min(n, 150); i++) fn();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      out.probe[name] = +((performance.now() - t0) * 1000 / n).toFixed(3);
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

    await pinned('pin-stationary', () => { }, 40);
    try { out.drawProfile = drawProfile({ frames: 14, rounds: 4 }); } catch (e) { out.drawProfile = 'ERR ' + e.message; }
    try { out.drawProfileNoSprites = drawProfile({ frames: 10, rounds: 3, sprites: 'off' }); } catch (e) { }

    // the season wash arms, on this engine
    try {
      const m0 = SEASON_WASH.mode;
      const tw = mode => { SEASON_WASH.mode = mode; if (typeof washSurf !== 'undefined') washSurf.key = '';
        for (let i = 0; i < 4; i++) render(1e6); flush();
        let best = Infinity;
        for (let r = 0; r < 4; r++) { const a = performance.now(); for (let i = 0; i < 10; i++) render(1e6); flush(); const v = (performance.now() - a) / 10; if (v < best) best = v; }
        return +best.toFixed(2); };
      out.washFrameMs = { live: tw('live'), cached: tw('cached'), surface: tw('surface') };
      SEASON_WASH.mode = m0; if (typeof washSurf !== 'undefined') washSurf.key = '';
    } catch (e) { out.notes.push('wash: ' + e.message); }

    try { dbg.on = true; devReset(); out.groundBench = perfBench({ gw: 46, gh: 46, rounds: 7, edit: true }); dbg.on = false; } catch (e) { out.groundBench = 'ERR ' + e.message; }
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
function server(driverBody) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  let resolveResult; const ready = new Promise(r => resolveResult = r);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(b)); } catch (e) { resolveResult({ error: String(b).slice(0, 3000) }); } });
      return;
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
    const fn = (${String(probeFn)});
    const out = await fn({startup});
    out.profileName = ${JSON.stringify(PROFILE)};
    out.engine = ${JSON.stringify(ENGNAME)};
    out.soft = ${JSON.stringify(SOFT)};
    await post(out);
  }catch(e){ await post({error:String(e&&e.stack||e)}); }
})();`;

const BOOT_DEMO = `
    const envb = await (await fetch('/demo-garden.json')).json();
    await enterWorld(await installWorldBlob(envb));
    game.pausedAt = game.pausedAt || Date.now();
    game.ffActive = false;
    await new Promise(r=>setTimeout(r,1200));`;

const BOOT_STRESS = BOOT_DEMO + `
    stressGarden();
    await new Promise(r=>setTimeout(r,1200));`;

async function run(probeFn, boot) {
  const exe = ENG.exe.find(p => fs.existsSync(p));
  if (!exe) throw new Error('browser not installed');
  const { srv, port, ready } = await server(driverFor(probeFn, boot));
  sweepStaleTestBrowsers('ppaudit-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppaudit-'));
  if (ENG.profilePrefs) fs.writeFileSync(path.join(profile, 'user.js'), ENG.profilePrefs);
  const child = spawn(exe, ENG.args(profile, 'http://127.0.0.1:' + port + '/'), { stdio: 'ignore' });
  const result = await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 420000))])
    .catch(e => ({ error: e.message }));
  closeTestBrowser(child, profile);
  srv.close();
  await new Promise(r => setTimeout(r, 800));
  return result;
}

(async () => {
  const which = opt('probe', 'garden');
  const res = which === 'ui' ? await run(inPageUI, '')
    : await run(inPage, GARDEN === 'stress' ? BOOT_STRESS : BOOT_DEMO);
  const text = JSON.stringify(res, null, 1);
  if (OUTFILE) fs.writeFileSync(OUTFILE, text);
  console.log(OUTFILE ? ('wrote ' + OUTFILE + (res.error ? ('  ERROR: ' + res.error) : '')) : text);
})().catch(e => { console.error(e); process.exit(1); });
