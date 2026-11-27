'use strict';
/* Does the kept picture of the planting (FAR, renderer.js) show what the entity pass would draw?

   The picture stands in for the pass on frames where nothing in it is moving, so a stale one is a
   garden that looks wrong until something happens to rebake it. This walks a real garden through
   the things that change the planting (edits, undo, the lights, season skips, the lens, a hidden
   layer, a turn of the view, zooms) and after each renders ONE frame twice, with the picture and
   with the pass, and compares the garden canvas.

   The bar is a CONTROL, not zero: the picture is set down on whole device pixels, so it sits up to
   half a pixel from where the pass draws each sprite. The control is the pass against itself with
   the camera half a pixel over each way; the picture has to differ from the pass by less than that.
   A stale picture is nowhere near it (a wrong season moves most of the planting's pixels).

   The frame is drawn at an instant when the wind is level (render derives the sway from its
   timestamp, and the picture is baked with none), and until two draws in a row match, since sprite
   bakes land over a few frames.

     node dev/far-verify.cjs [--garden file] [--soft] [--headed]
   Without --garden it uses the demo garden. The picture is made to engage whatever the pass costs
   (HI_MS 0) and never to let go, since the demo garden is not dear enough to keep one on its own.
   Checked against two deliberate breaks (an edit that does not rebake, the lights that do not):
   both fail here. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');
const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const GARDEN = opt('garden');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];

function inPage() {
  return (async () => {
    const frames = n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const idle = async () => { for (let i = 0; i < 600; i++) { await wait(100);
      if (!gardenOpening && !(typeof pendingSkip !== 'undefined' && pendingSkip) && !viewTweenActive()) break; } await frames(3); await wait(500); };
    try { endTour(false); } catch (e) { }
    // the picture is kept from here on, as it is on a garden dear enough to engage it: the app's own frames
    // between the steps hold it, so a step that should have rebaked it and did not shows the old one
    FAR.HI_MS = 0; FAR.LO_MS = -1;
    await idle(); fitPlot(); await idle();
    const T0 = Math.PI / 0.0012 * 1e6;                      // sin(t*0.0012) is 0: the wind is level
    const grab = () => { const c = document.createElement('canvas'); c.width = cnv.width; c.height = cnv.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cnv, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const diff = (a, b) => { let n = 0, big = 0, mx = 0;
      for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d > 8) n++; if (d > 48) big++; if (d > mx) mx = d; }
      return { over8: +(n / (a.length / 4) * 100).toFixed(3), over48: +(big / (a.length / 4) * 100).toFixed(3), max: mx }; };
    const settle = () => { let prev = null;
      for (let i = 0; i < 60; i++) { render(T0); const now = grab();
        if (prev) { let same = true; for (let k = 0; k < now.length; k += 97) if (now[k] !== prev[k]) { same = false; break; } if (same && !spritesPending()) return now; }
        prev = now; }
      return prev; };
    // the mean difference inside the screen box of some tiles and what stands on them: one stale plant is a
    // handful of pixels of a whole frame, and all of the pixels here
    const tileBox = tiles => { const s = DPR * ZOOM; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y] of tiles) { const p = screenOf(x, y, VW / ZOOM, VH / ZOOM);
        x0 = Math.min(x0, p[0] - TILE_W / 2 - 6); x1 = Math.max(x1, p[0] + TILE_W / 2 + 6); y0 = Math.min(y0, p[1] - 110); y1 = Math.max(y1, p[1] + TILE_H + 6); }
      return [Math.max(0, Math.floor(x0 * s)), Math.max(0, Math.floor(y0 * s)), Math.min(cnv.width, Math.ceil(x1 * s)), Math.min(cnv.height, Math.ceil(y1 * s))]; };
    const madIn = (a, b, bx) => { let sum = 0, n = 0;
      for (let y = bx[1]; y < bx[3]; y++) for (let x = bx[0]; x < bx[2]; x++) { const i = (y * cnv.width + x) * 4;
        sum += Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); n++; }
      return n ? +(sum / n).toFixed(2) : 0; };
    const rows = [];
    const compare = (label, tiles) => {
      const half = 0.5 / (DPR * ZOOM);
      // first the frame as the app has it (the picture it is holding, rebaked only if the app says so)
      const blits0 = FAR.blits; const a = settle(); const used = FAR.blits > blits0;
      FAR.on = false; const b = settle();
      cam.x += half; cam.y += half; const c = settle(); cam.x -= half; cam.y -= half;
      FAR.on = true; settle();                              // and the picture back, of the garden as it is now
      const bx = tiles && tiles.length ? tileBox(tiles) : null;
      rows.push({ label, used, z: +ZOOM.toFixed(4), own: farOwnSprites(), fits: farLayerFits(), picture: diff(a, b), control: diff(b, c),
        at: bx && bx[2] > bx[0] && bx[3] > bx[1] ? { picture: madIn(a, b, bx), control: madIn(b, c, bx), px: (bx[2] - bx[0]) * (bx[3] - bx[1]) } : null });
    };
    const step = async (label, fn, ms, tiles) => { if (fn) { fn(); await wait(ms || 900); await idle(); } compare(label, tiles); };
    const free = (x, y) => { const k = x + ',' + y; return onPlot(x, y) && !terrainAt(x, y) && !(game.plants[k] && !game.plants[k].removed) && !(game.bulbs[k] && !game.bulbs[k].removed) && !game.fences[k] && !siteStructureAt(x, y); };
    let spot0 = null;
    for (let y = 2; y < GH - 2 && !spot0; y++) for (let x = 2; x < GW - 8 && !spot0; x++) { let ok = true; for (let d = 0; d < 6 && ok; d++) ok = free(x + d, y); if (ok) spot0 = { x, y }; }
    // a tall forb that is up this season, so one of them is as many pixels as a plant gets
    const seasonNow = calClock().season;
    const plantKey = PLANT_KEYS.filter(k => PLANTS[k].type === 'forb' && !PLANTS[k].hidden && plantFits(k) && PLANTS[k].sea[seasonNow] && PLANTS[k].sea[seasonNow].fol)
      .sort((a, b) => PLANTS[b].h - PLANTS[a].h)[0];
    const spot = spot0, rowTiles = spot ? [0, 1, 2, 3, 4, 5].map(d => [spot.x + d, spot.y]) : null;
    await step('fitted');
    await step('panned', () => { cam.x += 160 / ZOOM; cam.y -= 70 / ZOOM; });
    if (spot) {
      await step('six plants planted', () => { game.tool = plantKey; game.toolVar = null; withUndo(() => { for (let d = 0; d < 6; d++) applyToolAt(spot.x + d, spot.y); }); }, 0, rowTiles);
      await step('one erased', () => { game.eraseMode = 'all'; game.brushSize = 1; withUndo(() => eraseBrush(spot.x + 2, spot.y, { plants: 0, bulbs: 0, terrain: 0, shrubs: 0 })); }, 0, [[spot.x + 2, spot.y]]);
      await step('undo', () => doUndo(), 0, [[spot.x + 2, spot.y]]);
      await step('undo again', () => doUndo(), 0, rowTiles);
      await step('a path laid', () => { game.tool = 'path'; withUndo(() => { for (let d = 0; d < 6; d++) applyToolAt(spot.x + d, spot.y); }); }, 0, rowTiles);
    }
    await step('lights on', () => document.getElementById('btnDayNight').click(), 1500);
    await step('lights off', () => document.getElementById('btnDayNight').click(), 1500);
    await step('a season skipped', () => skipNextSeason(), 2500);
    await step('and another', () => skipNextSeason(), 2500);
    await step('Today view', () => setPreviewMode('today'), 1500);
    await step('Established view', () => setPreviewMode('established'), 1500);
    await step('the perennials hidden', () => { game.layerVis.perennials = false; markModelChanged(); }, 1200);
    await step('and shown', () => { game.layerVis.perennials = true; markModelChanged(); }, 1200);
    await step('turned a quarter', () => rotateView(1), 2000);
    await step('fitted again', () => fitPlot(), 1500);
    await step('zoomed in a little', () => setUserZoom(userZoom * 1.3), 1500);
    await step('half a garden day later', () => { game.elapsedMs += DAY_MS * 0.5; }, 800);
    await step('zoomed in a long way', () => setUserZoom(userZoom * 4), 2500);
    await step('and back out', () => fitPlot(), 2000);
    return { rows, plants: Object.keys(game.plants).length, canvas: cnv.width + 'x' + cnv.height, version: APP_VERSION,
      errors: typeof errLog !== 'undefined' ? errLog.slice(-4) : [] };
  })();
}

const driver = `
(async function(){
  const post = o => fetch('/__result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); localStorage.setItem('hortus:coach:tour','1'); }catch(e){}
    let guard=0;
    while ((typeof enterWorld!=='function' || typeof FAR==='undefined') && guard++<400) await new Promise(r=>setTimeout(r,25));
    const envb = await (await fetch('${GARDEN ? '/__garden.json' : '/demo-garden.json'}')).json();
    await enterWorld(await installWorldBlob(envb));
    const out = await (${String(inPage)})();
    await post(out);
  }catch(e){ await post({error:String(e&&e.stack||e)}); }
})();`;

function server() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
  let resolveResult; const ready = new Promise(r => resolveResult = r);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(b)); } catch (e) { resolveResult({ error: String(b).slice(0, 3000) }); } });
      return;
    }
    if (req.url.startsWith('/__driver.js')) { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); res.end(driver); return; }
    if (GARDEN && req.url === '/__garden.json') { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(GARDEN)); return; }
    const bare = req.url.split('?')[0];
    const rel = bare === '/' ? 'index.html' : decodeURIComponent(bare).replace(/^\/+/, '');
    const abs = path.resolve(REPO, rel);
    if (!abs.startsWith(path.resolve(REPO) + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (e, buf) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
      if (path.basename(abs) === 'index.html')
        buf = Buffer.from(String(buf).replace("if ('serviceWorker' in navigator)", 'if (false)').replace('</body>', '<script src="/__driver.js"></script></body>'));
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, ready })));
}

(async () => {
  const exe = EXE.find(p => fs.existsSync(p));
  if (!exe) { console.log('ERROR no Chrome or Edge found'); process.exit(1); }
  const { srv, port, ready } = await server();
  sweepStaleTestBrowsers('ppfar-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppfar-'));
  const args = ['--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', '--window-position=0,0',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    ...(argv.includes('--soft') ? ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization', '--disable-gpu-compositing'] : []),
    ...(argv.includes('--headed') ? [] : ['--headless=new']), 'http://127.0.0.1:' + port + '/'];
  const child = spawn(exe, args, { stdio: 'ignore' });
  const res = await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 600000))]).catch(e => ({ error: e.message }));
  closeTestBrowser(child, profile);
  srv.close();
  if (res.error) { console.log('ERROR ' + res.error); process.exit(1); }
  console.log(`${GARDEN ? path.basename(GARDEN) : 'demo garden'}, ${res.plants} plants, canvas ${res.canvas}, v${res.version}`);
  console.log('step'.padEnd(26) + 'picture'.padEnd(9) + 'zoom'.padEnd(8) + 'picture against the pass'.padEnd(34) + 'the pass, half a pixel over (the bar)');
  let bad = 0, used = 0;
  for (const o of res.rows) {
    const whole = o.picture.over48 <= o.control.over48 + 0.02 && o.picture.over8 <= o.control.over8 + 0.5;
    const there = !o.at || o.at.picture <= o.at.control * 1.25 + 1.5;
    const ok = !o.used || (whole && there);
    if (!ok) bad++; if (o.used) used++;
    const f = d => ('>8 ' + d.over8 + '%  >48 ' + d.over48 + '%  max ' + d.max);
    console.log((ok ? '  ' : '! ') + o.label.padEnd(24) + (o.used ? 'used' : 'not').padEnd(9) + String(o.z).padEnd(8) + f(o.picture).padEnd(34) + f(o.control).padEnd(34)
      + (o.at ? 'at the edit: ' + o.at.picture + ' against ' + o.at.control + ' (' + o.at.px + 'px)' : ''));
  }
  if (res.errors && res.errors.length) { console.log('errors logged: ' + JSON.stringify(res.errors)); bad++; }
  if (!used) { console.log('\nFAIL: the picture was never used, so nothing was compared'); process.exit(1); }
  console.log(bad ? `\nFAIL: ${bad} step(s) where the kept picture is not what the pass draws`
    : `\nPASS: the kept picture is within half a pixel of the pass at all ${used} steps that used it`);
  process.exit(bad ? 1 : 0);
})();
