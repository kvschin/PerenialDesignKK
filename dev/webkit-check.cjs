'use strict';
/* A whole session in WEBKIT, asking one thing: does anything throw?
 *
 *   node dev/webkit-check.cjs                      demo garden
 *   node dev/webkit-check.cjs --garden my.json     an exported garden
 *   node dev/webkit-check.cjs --query atlas=1      with a query on the app's address
 *   node dev/webkit-check.cjs --headless
 *
 * Every other browser test here runs Chromium, and one tool runs Firefox. Safari
 * and every browser on an iPad or iPhone are WebKit, where the app takes paths
 * the others never do: a sprite is a <canvas> there, not an ImageBitmap
 * (spriteBitmapsSupported), so baking, retiring and emptying canvases, the
 * season-fade snapshot, the wash surfaces and what quitting to the menu hands
 * back are all exercised only here. This opens a garden, turns night on,
 * rotates, zooms, looks at the bees and a pet's flick by day, holds
 * fast-forward, skips four seasons, plants shrubs and a row of perennials,
 * undoes and redoes, erases a sweep, switches Today and Established, hides
 * and shows a layer, switches planting schemes, fills a region, quits to the
 * menu, opens the garden
 * again and quits, and fails on a page error, an entry in the app's error log,
 * the crash panel, a clump shown without its own sprite at a reveal, or
 * anything the garden still holds at the menu.
 *
 * WHAT IT CANNOT TELL YOU. This is Playwright's WebKit build for the desktop,
 * which rasterises canvases in software. It is not an iPad: its frame times are
 * several times a real device's and say nothing about one (a 350-plant garden
 * pans at 9 frames a second here), it has no canvas-memory ceiling to run into,
 * and it will not reproduce an out-of-memory reload. It finds exceptions and
 * wrong behaviour in WebKit's JavaScript and canvas engine. Only a device finds
 * the rest.
 *
 * It needs Playwright's WebKit build, which is not installed with Playwright's
 * Chromium: `npx playwright install webkit`, or unpack the build's zip into
 * %LOCALAPPDATA%/ms-playwright/webkit-<revision> with an empty file named
 * INSTALLATION_COMPLETE beside it (the revision and address are printed by
 * `npx playwright install --dry-run webkit`). Nothing is downloaded by this
 * script. Playwright's check of the host's libraries wants a second download on
 * Windows, so it is switched off for the launch.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const root = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = n => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const gardenPath = path.resolve(opt('garden', path.join(root, 'demo-garden.json')));
const QUERY = opt('query', '');

function playwright() {
  const candidates = process.env.PLAYWRIGHT_MODULE_PATH ? [process.env.PLAYWRIGHT_MODULE_PATH] : [
    'playwright', 'playwright-core',
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')];
  for (const c of candidates) {
    try { return require(c); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Error('An existing Playwright installation is required. Set PLAYWRIGHT_MODULE_PATH to its package directory.');
}

function server(gardenJson) {
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp'
  };
  const s = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__garden.json') {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      res.end(gardenJson); return;
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
      // the service worker is cache-first: a check that boots under one may run the previous build
      if (path.basename(abs) === 'index.html')
        buf = Buffer.from(String(buf).replace("if ('serviceWorker' in navigator)", 'if (false)'));
      res.end(buf);
    });
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ server: s, port: s.address().port })));
}

/* Runs INSIDE the page. */
async function session() {
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) throw new Error('timed out waiting'); await raf(); } };
  const mb = n => +(n / 1048576).toFixed(1);
  const steps = [], problems = [];
  const missing = () => {
    if (!PSPRITE.active) return 0;
    const W = VW / ZOOM, H = VH / ZOOM, ox = W / 2 - cam.x, oy = H * 0.24 - cam.y; let n = 0;
    for (const e of scene.ents) {
      if (e.kSlot === undefined || e.ox1 + ox < 0 || e.ox0 + ox > W || e.oy1 + oy < 0 || e.oy0 + oy > H) continue;
      if (e.kind === SCENE_K.BULB && sceneEntGrowth(e) <= 0.02) continue;
      if (!PSPRITE.slot.has(clumpSpriteSlot(e))) n++;
    }
    return n;
  };
  const note = (what, extra) => {
    steps.push(Object.assign({ what, sprites: PSPRITE.map.size, spriteMB: mb(PSPRITE.bytes), atlasPages: ATLAS.pages.length }, extra || {}));
    if (crashed) problems.push(what + ': the crash panel is up');
  };
  const env = await (await fetch('/__garden.json')).json();
  const id = await installWorldBlob(env);
  await enterWorld(id);
  await until(() => !gardenOpening, 90000);
  const m0 = missing();
  note('opened', { plants: Object.keys(game.plants).length, withoutOwnSprite: m0 });
  if (m0) problems.push('opened: ' + m0 + ' clumps on screen had no sprite of their own at the reveal');
  await sleep(700);
  document.getElementById('btnDayNight').click(); await sleep(900); note('night');
  document.getElementById('btnDayNight').click(); await sleep(400);
  for (let i = 0; i < 4; i++) { rotateView(1); await sleep(600); }
  note('rotated four times');
  setUserZoom(1.4 / baseZoom); await sleep(900); setUserZoom(0.5 / baseZoom); await sleep(900);
  note('zoomed in and out');
  /* By day, zoomed in over the flowers: bees and butterflies (drawPollinators),
     and a pet flicking its tail, drawn live beside its cached sprite (petFlickPose). */
  if (typeof drawPollinators === 'function') {
    setUserZoom(1.4 / baseZoom); await sleep(800);
    const W = VW / ZOOM, H = VH / ZOOM, pe = scene.ents.find(r => r.kind === SCENE_K.PET), b = pollenField.bugs[0];
    const e = b ? b.stops[0].e : pe;
    if (e) { cam.x = e.px; cam.y = e.py + H * 0.24 - H / 2; }
    await sleep(1200);
    const drawn = pollenField.bugs.length;
    const pe2 = scene.ents.find(r => r.kind === SCENE_K.PET);
    if (pe2) {
      cam.x = pe2.px; cam.y = pe2.py + H * 0.24 - H / 2; await sleep(300);
      const R = petFlickRhythm(pe2); R.off = ((R.per - (performance.now() + 300) % R.per) % R.per);
      await sleep(1000);
    }
    note('visitors by day', { season: calClock().season, visitors: drawn, petFlicked: PET_FLICK.until > 0 });
  }
  const d0 = absDay();
  game.ffActive = true; await sleep(8000); game.ffActive = false; await sleep(500);
  note('fast-forward held', { gardenDays: absDay() - d0 });
  for (let i = 0; i < 4; i++) {
    skipNextSeason();
    const t0 = performance.now();
    while (skipPending() && performance.now() - t0 < 30000) await raf();
    if (skipPending()) problems.push('a Skip never landed');
    await sleep(400);
  }
  note('skipped four seasons', { season: calClock().season });
  const shrub = PLANTS.ninebark ? 'ninebark' : PLANT_KEYS.find(k => PLANTS[k].type === 'shrub');
  const forb = PLANTS.echinacea ? 'echinacea' : PLANT_KEYS.find(k => PLANTS[k].type === 'forb');
  // open ground the garden really has: a bed or lawn tile with nothing on it
  const free = [];
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const k = x + ',' + y, t = game.terrain[k], p = game.plants[k];
    if ((p && !p.removed) || (t && !t.removed && t.k !== 'bed' && t.k !== 'lawn')) continue;
    free.push([x, y]);
  }
  const live = k => { const p = game.plants[k]; return !!p && !p.removed; };
  let shrubs = 0, forbs = 0;
  setTool(shrub, null);
  for (let i = 0; i < free.length && shrubs < 5; i += 7) {
    const [x, y] = free[i];
    beginUndo(); tapAction(x, y, {}); commitUndo();
    if (live(x + ',' + y)) shrubs++;
    await raf(); await raf();
  }
  setTool(forb, null);
  beginUndo();
  for (let i = 3; i < free.length && forbs < 12; i += 5) {
    const [x, y] = free[i];
    if (live(x + ',' + y)) continue;
    applyToolAt(x, y, {});
    if (live(x + ',' + y)) forbs++;
    await raf();
  }
  commitUndo();
  await sleep(500);
  note('planted', { shrubs, perennials: forbs });
  if (!shrubs || !forbs) problems.push('planting: nothing went in (' + shrubs + ' shrubs, ' + forbs + ' perennials of ' + free.length + ' open tiles)');
  doUndo(); await sleep(300); doRedo(); await sleep(300);
  note('undo and redo');
  /* An erase sweep: what it lifts shrinks away, drawn from these very sprites
     (EDIT_FX), which in WebKit are canvases emptied a frame after they retire. */
  game.eraseMode = 'all'; game.brushSize = 3;
  const swept = { plants: 0, bulbs: 0, terr: 0 };
  beginUndo();
  for (let i = 3; i < free.length && i < 80; i += 5) { const [x, y] = free[i]; eraseBrush(x, y, swept); await raf(); }
  commitUndo();
  await sleep(400);
  note('erased', { plants: swept.plants, bulbs: swept.bulbs });
  doUndo(); await sleep(400);
  note('erase undone');
  /* The comparison controls: Today/Established grows the plants on screen to
     their other size, blitted from the new lens's sprites under a scale (LENS);
     a layer crossfades; a scheme switch outlines what differs; a fill comes in
     as a wave and must reach every plant. */
  const lensFlip = () => setPreviewMode(game.previewMode === 'established' ? 'today' : 'established');
  lensFlip(); await raf(); await raf();
  const grew = LENS.grow.size; await sleep(900);
  lensFlip(); await sleep(900);
  note('lens there and back', { grew });
  for (const v of [false, true]) { requestViewFade('layer'); setLayerVis('perennials', v); refreshCanvasTools(); await sleep(400); }
  note('perennials off, on');
  const sch = createScheme(true);
  let flashed = 0;
  if (sch) {
    for (const k of Object.keys(game.plants).filter(live).slice(0, 30)) setTile('plants', k, Object.assign({}, game.plants[k], { s: forb, v: null }));
    cycleScheme(1); flashed = EDIT_FX.flash ? EDIT_FX.flash.tiles.length : 0; await sleep(800);
    cycleScheme(1); await sleep(400);
  }
  note('scheme switched', { flashed });
  setTool(forb, null); game.fillMode = true;
  const [fx, fy] = free[free.length >> 1];
  doFloodFill(fx, fy);
  const waiting = EDIT_FX.wait.size; await sleep(1200);
  note('filled', { waiting });
  if (EDIT_FX.wait.size) problems.push('fill: the wave never reached ' + EDIT_FX.wait.size + ' plants');
  game.fillMode = false; doUndo(); await sleep(400);
  const gid = game.worldId;
  quitToMenu(); await sleep(2500);
  const held = { sprites: PSPRITE.map.size, structures: SSPRITE.map.size, atlasPages: ATLAS.pages.length, ground: !!groundCanvas, spare: !!groundSpare, wash: washSurf.key };
  note('at the menu', held);
  if (held.sprites || held.structures || held.atlasPages || held.ground || held.spare || held.wash)
    problems.push('the menu still holds the garden: ' + JSON.stringify(held));
  await enterWorld(gid);
  await until(() => !gardenOpening, 90000);
  const m1 = missing();
  note('opened again', { withoutOwnSprite: m1 });
  if (m1) problems.push('opened again: ' + m1 + ' clumps had no sprite of their own');
  game.ffActive = true; await sleep(4000); game.ffActive = false; await sleep(300);
  quitToMenu(); await sleep(600);
  note('quit');
  // leave the page's storage as it was found
  try { await pendingSaves(); await updateWorldsIndex(idx => ({ index: idx.filter(w => w.id !== gid), del: ['hortus:world:' + gid] })); } catch (_) { }
  for (const e of errLog) problems.push('error log: ' + JSON.stringify(e).slice(0, 300));
  return { steps, problems, canvasSprites: !spriteBitmaps, atlas: ATLAS.on, ua: navigator.userAgent };
}

(async () => {
  if (!fs.existsSync(gardenPath)) { console.error('no garden at ' + gardenPath); process.exit(1); }
  const pw = playwright();
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
  const { server: srv, port } = await server(fs.readFileSync(gardenPath, 'utf8'));
  let browser, code = 0;
  try {
    browser = await pw.webkit.launch({ headless: flag('headless') });
  } catch (e) {
    console.error('WebKit did not launch. Playwright\'s WebKit build is needed (see the top of this file).\n' + String(e && e.message || e).split('\n')[0]);
    srv.close(); process.exit(1);
  }
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e && e.message || e).slice(0, 300)));
    await page.addInitScript(() => { try { localStorage.setItem('hortus:welcomed', '1'); } catch (_) { } });
    await page.goto('http://127.0.0.1:' + port + '/' + (QUERY ? '?' + QUERY : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => typeof enterWorld === 'function' && typeof PSPRITE !== 'undefined');
    const r = await page.evaluate(session);
    console.log(r.ua);
    console.log('sprites are ' + (r.canvasSprites ? 'canvases' : 'bitmaps') + ', atlas ' + (r.atlas ? 'on' : 'off') + ', garden ' + path.basename(gardenPath));
    for (const s of r.steps) { const what = s.what; delete s.what; console.log('  ' + what.padEnd(22) + JSON.stringify(s)); }
    const problems = r.problems.concat(pageErrors.map(e => 'page error: ' + e));
    if (problems.length) { code = 1; console.log('\nFAILED'); for (const p of problems) console.log('  ' + p); }
    else console.log('\nno errors: nothing thrown, nothing in the error log, every clump its own sprite at each reveal, nothing held at the menu');
  } catch (e) { console.error('the session did not finish: ' + (e && e.message || e)); code = 1; }
  finally { await browser.close(); srv.close(); }
  process.exit(code);
})();
