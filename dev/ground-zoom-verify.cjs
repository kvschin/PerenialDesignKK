'use strict';
/* Are the ground pictures a zoom gesture swaps in what a full bake would paint?

   On a plot whose ground is dear to bake (GROUND_SYNC_TILES, renderer.js) a zoom
   in progress no longer bakes on its own frames: a zoom out falls back on a kept
   picture of the whole plot (groundWide), and a zoom in is baked behind the
   picture on screen in chunks (a `chase` job) at a zoom and camera of its own.
   Each of those leaves the ground canvas claiming to be a bake at
   (groundZoom, groundCamX, groundCamY). So this bakes there for real and diffs,
   which is dev/ground-verify.cjs's invariant, asked of the paths that tool does
   not reach (it runs at 100% on a small plot, where none of this engages).

     kept     the whole-plot ground kept as the zoom in replaced it, and swapped
              back in as the zoom out uncovered ground
     chased   the picture a chase job baked behind a zoom in
     idle     the whole-plot picture baked while the view was idle
     started  the one started as a zoom out began (finished at the gap if need be)

   It also holds every frame of each zoom out to the coverage test's own answer
   (no ground missing on screen), and counts the full bakes inside the gestures.

   The bar is a CONTROL, two full bakes half a device pixel apart, as in
   ground-verify. A picture baked in chunks differs from a full bake along the
   chunk seams by antialiasing only; an arm fails on more than 8 pixels over the
   bar. The reference is the app's own full bake, made as a kept frame is
   (game.photo), where nothing stands in.

   It rasterises in SOFTWARE unless told --gpu. The three ground canvases change
   places here, and reading an accelerated canvas back moves it to the CPU on its
   second read (the ff-bench note in CLAUDE.md), so on the GPU one picture would
   be compared with another drawn by a different rasteriser: the same bake twice
   read 20% of pixels apart. In software a difference is a difference.

     node dev/ground-zoom-verify.cjs [--garden file] [--gpu] [--headed]
   Default garden: dev/test-gardens/estate.prairie.json (93x93 tiles). */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');
const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const GARDEN = path.resolve(opt('garden', path.join(REPO, 'dev/test-gardens/estate.prairie.json')));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];

function inPage() {
  return (async () => {
    for (let i = 0; gardenOpening && i < 8000; i++) await new Promise(r => setTimeout(r, 5));
    try { endTour(false); } catch (e) { }
    crashed = true;                                    // the app's own loop stops; every frame below is drawn here
    await new Promise(r => setTimeout(r, 300));
    game.pausedAt = game.pausedAt || Date.now();
    let T = 1e7;
    const MD = Math.round(GROUND_MARGIN_CSS * DPR);
    const busy = () => { lastInputAt = T; lastMeaningfulChange = T; };          // somebody is steering
    const frame = (n = 1) => { for (let i = 0; i < n; i++) { T += 16.7; render(T); } };
    const settle = () => { for (let i = 0; i < 60; i++) { busy(); frame(); } };  // past the zoom settle and its job
    const out = { rows: [], notes: [], gaps: 0, gestureBakes: 0 };
    // full bakes (a paintGround with no rectangle) and what jobs were adopted, while counting
    const p0 = paintGround, a0 = adoptGroundJob, e0 = ensureGroundJob; let counting = false, fulls = 0, adopted = [], started = [];
    paintGround = function () { if (counting && !arguments[10]) fulls++; return p0.apply(this, arguments); };
    adoptGroundJob = function () { if (groundJob) adopted.push(groundJob.why); return a0.apply(this, arguments); };
    ensureGroundJob = function (why) { const j = groundJob; const v = e0.apply(this, arguments); if (groundJob !== j) started.push(why); return v; };
    const data = (ctx, cv) => ctx.getImageData(0, 0, cv.width, cv.height).data;
    const pxDiff = (a, b, i) => { const aa = a[i + 3], ba = b[i + 3]; let d = Math.abs(aa - ba);
      for (let c = 0; c < 3; c++) { const e = Math.abs(a[i + c] * aa - b[i + c] * ba) / 255; if (e > d) d = e; } return Math.round(d); };
    const diff = (a, b, bar) => { let px = 0, sum = 0, max = 0, over = 0, aBlank = 0, bBlank = 0;
      for (let i = 0; i < a.length; i += 4) { const d = pxDiff(a, b, i);
        if (d) { px++; sum += d; if (d > max) max = d; if (d > bar) over++; if (a[i + 3] === 0 && b[i + 3] > 0) aBlank++; if (b[i + 3] === 0 && a[i + 3] > 0) bBlank++; } }
      return { pct: +(100 * px / (a.length / 4)).toFixed(3), mean: px ? +(sum / px).toFixed(2) : 0, max, over, missing: aBlank, extra: bBlank }; };
    // the app's own full bake at a zoom and camera, as a kept frame makes it: nothing stands in, no job, no whole-plot picture
    const real = (z, cx, cy) => {
      const u0 = userZoom, x0 = cam.x, y0 = cam.y, ph = game.photo;
      userZoom = z / baseZoom; calcZoom(); if (Math.abs(ZOOM - z) > 1e-12) ZOOM = z;
      cam.x = cx; cam.y = cy; game.photo = true; groundKey = ''; groundJob = null;
      try { render(T); return data(groundCtx, groundCanvas); }
      finally { game.photo = ph; userZoom = u0; calcZoom(); cam.x = x0; cam.y = y0; groundKey = ''; }
    };
    const fitNow = () => { fitPlot(); groundKey = ''; settle(); };
    // a wheel: a tick of `f`, then `n` frames with the gardener still at it (a job behind the gesture needs frames to land)
    const zoomTo = (z, each, n = 8, f = 1.12) => {
      for (let i = 0; i < 400 && Math.abs(Math.log(z / ZOOM)) > Math.log(f) / 2; i++) {
        const before = ZOOM; setUserZoom(userZoom * (z > ZOOM ? f : 1 / f));
        for (let k = 0; k < n; k++) { busy(); groundZoomT = T; frame(); if (each && each()) return true; }
        if (ZOOM === before) break;
      }
      setUserZoom(userZoom * z / ZOOM); busy(); frame(2); return !!(each && each());
    };
    const noGap = () => { if (ZOOM !== groundZoom && (groundZoomNeed(MD) & 2)) out.gaps++; return false; };

    out.env = { canvas: [cnv.width, cnv.height], gw: GW, gh: GH, dpr: DPR, dearPlot: groundPlotDear(), limit: GROUND_SYNC_TILES, version: APP_VERSION, ua: navigator.userAgent };
    if (!groundPlotDear()) return out;
    fitNow();
    const fit = ZOOM, wt = groundWideTarget(MD);
    out.env.fit = +fit.toFixed(4); out.env.whole = wt && +wt.z.toFixed(4);
    // ---- the bar: two full bakes half a device pixel apart, at the whole-plot zoom, and one bake twice
    const c1 = real(wt.z, wt.x, wt.y), c2 = real(wt.z, wt.x + 0.49 / (DPR * wt.z), wt.y), c3 = real(wt.z, wt.x, wt.y);
    out.control = diff(c1, c2, 255); out.same = diff(c1, c3, 255);
    const bar = Math.max(out.control.max, 8);
    const check = (label, a, z, cx, cy) => { const d = diff(a, real(z, cx, cy), bar); d.label = label; d.zoom = +z.toFixed(4); out.rows.push(d); };

    // ---- kept: the whole-plot ground kept on the way in, swapped back in on the way out
    fitNow(); releaseGroundWide(); adopted = []; started = [];
    counting = true; fulls = 0;
    zoomTo(1);
    out.notes.push('zoom in: ' + fulls + ' full bake(s); jobs started: ' + (started.join(' ') || 'none') + '; adopted: ' + (adopted.join(' ') || 'none')); out.gestureBakes += fulls;
    counting = false; settle();
    const keptOK = groundWideValid(groundKeyStruct, MD);
    if (!keptOK) out.rows.push({ label: 'kept', fail: 'the whole-plot ground was not kept when the zoom in replaced it' });
    else {
      const wz = groundWide.zoom; counting = true; fulls = 0;
      out.trace = []; let lastF = -1; const swapped = zoomTo(fit, () => { noGap(); if (fulls !== lastF || out.trace.length < 3) { lastF = fulls; out.trace.push([+ZOOM.toFixed(3), +groundZoom.toFixed(3), fulls, groundWide ? 'wide' : '-', groundJob ? groundJob.why : '-', groundWindowTiles(VW / ZOOM, VH / ZOOM, MD, 5), groundZoomNeed(MD), +cam.x.toFixed(0), +groundCamX.toFixed(0)].join('/')); } return !groundWide && groundZoom === wz; });
      out.gestureBakes += fulls; counting = false;
      if (!swapped) out.rows.push({ label: 'kept', fail: 'it was never swapped back in on the way out' });
      else { out.notes.push('zoom out, kept picture: ' + fulls + ' full bake(s) before the swap at ' + ZOOM.toFixed(3));
        check('kept', data(groundCtx, groundCanvas), groundZoom, groundCamX, groundCamY); }
    }

    // ---- chased: the picture a chase job baked behind a zoom in
    fitNow(); adopted = [];
    const chased = zoomTo(1, () => adopted.includes('chase'), 12, 1.04);
    if (!chased) out.rows.push({ label: 'chased', fail: 'no chase job was adopted during the zoom in' });
    else check('chased', data(groundCtx, groundCanvas), groundZoom, groundCamX, groundCamY);

    // ---- idle: the whole-plot picture baked while nobody is doing anything
    fitNow(); zoomTo(1); settle(); releaseGroundWide(); groundJob = null;
    for (let i = 0; i < 400 && !groundWideValid(groundKeyStruct, MD); i++) frame();   // no busy(): the view goes idle
    if (!groundWideValid(groundKeyStruct, MD)) out.rows.push({ label: 'idle', fail: 'no whole-plot picture was baked while idle' });
    else check('idle', data(groundWide.ctx, groundWide.cv), groundWide.zoom, groundWide.camX, groundWide.camY);

    // ---- started: none in hand, so one is started as the zoom out begins, and finished at the gap if it must be
    fitNow(); zoomTo(1); settle(); releaseGroundWide(); groundJob = null; busy(); frame(); started = [];
    counting = true; fulls = 0;
    const got = zoomTo(fit, () => { noGap(); return groundHoldsPlot(groundZoom, groundCamX, groundCamY, MD) && ZOOM !== groundZoom; }, 5);
    out.gestureBakes += fulls; counting = false;
    out.notes.push('zoom out, none in hand: ' + fulls + ' full bake(s); jobs started: ' + (started.join(' ') || 'none'));
    if (!got) out.rows.push({ label: 'started', fail: 'the ground on screen never became the whole plot during the zoom out' });
    else check('started', data(groundCtx, groundCanvas), groundZoom, groundCamX, groundCamY);

    paintGround = p0; adoptGroundJob = a0; ensureGroundJob = e0;
    out.errors = typeof errLog !== 'undefined' ? errLog.slice(-4) : [];
    return out;
  })();
}

const driver = `
(async function(){
  const post = o => fetch('/__result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); localStorage.setItem('hortus:coach:tour','1'); }catch(e){}
    let guard=0;
    while ((typeof enterWorld!=='function' || typeof groundZoomNeed!=='function') && guard++<400) await new Promise(r=>setTimeout(r,25));
    const envb = await (await fetch('/__garden.json')).json();
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
    if (req.url === '/__garden.json') { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(GARDEN)); return; }
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
  sweepStaleTestBrowsers('ppgzoom-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppgzoom-'));
  const args = ['--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', '--window-position=0,0',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    ...(argv.includes('--gpu') ? [] : ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization', '--disable-gpu-compositing']),
    ...(argv.includes('--headed') ? [] : ['--headless=new']), 'http://127.0.0.1:' + port + '/'];
  const child = spawn(exe, args, { stdio: 'ignore' });
  const res = await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 900000))]).catch(e => ({ error: e.message }));
  closeTestBrowser(child, profile);
  srv.close();
  if (res.error) { console.log('ERROR ' + res.error); process.exit(1); }
  const e = res.env;
  console.log(`${path.basename(GARDEN)}, ${e.gw}x${e.gh} tiles, canvas ${e.canvas.join('x')}, v${e.version}`);
  if (!e.dearPlot) { console.log(`FAIL: this plot is not over the limit (${e.limit} tiles), so nothing here engages; use a larger garden`); process.exit(1); }
  console.log(`fitted at ${e.fit}, whole plot in the bake at ${e.whole}`);
  const f = d => `${d.pct}% of pixels, mean ${d.mean}, max ${d.max}`;
  console.log(`bar (two full bakes half a pixel apart): ${f(res.control)}; one bake twice: ${f(res.same)}`);
  for (const n of res.notes) console.log('  ' + n);
  if (argv.includes('--trace') && res.trace) console.log('  trace (zoom/groundZoom/fulls/wide/job/tiles/need/cam/groundCam): ' + res.trace.join('  '));
  let bad = 0;
  for (const r of res.rows) {
    if (r.fail) { bad++; console.log('! ' + r.label.padEnd(9) + r.fail); continue; }
    const ok = r.over <= 8 && r.missing <= 8 && r.extra <= 8;
    if (!ok) bad++;
    console.log((ok ? '  ' : '! ') + r.label.padEnd(9) + `at zoom ${String(r.zoom).padEnd(7)} ${f(r)}; over the bar ${r.over}, missing ${r.missing}, extra ${r.extra}`);
  }
  if (res.rows.length < 4) { bad++; console.log('! fewer than four arms ran'); }
  if (res.gaps) { bad++; console.log(`! ${res.gaps} frame(s) of a zoom out with ground missing on screen`); }
  if (res.errors && res.errors.length) { bad++; console.log('errors logged: ' + JSON.stringify(res.errors)); }
  console.log(bad ? `\nFAIL: ${bad} problem(s)` : `\nPASS: every picture a zoom swapped in is what a full bake paints there; no frame of a zoom out had ground missing; ${res.gestureBakes} full bake(s) inside the gestures`);
  process.exit(bad ? 1 : 0);
})();
