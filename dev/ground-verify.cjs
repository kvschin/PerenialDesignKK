'use strict';
/* Does the scrolled ground bake draw the same ground as a full one?

   Diffed on the GROUND CANVAS, not the frame: the plant sprite cache bakes on a
   per-frame budget, so two frames of the same scene legitimately differ while
   the ground underneath them does not, and that noise would swamp this.

   Two arms, because they fail differently:
     STEP  — one scroll from a fresh full bake, at many camera offsets. Catches a
             band painted in the wrong place, a seam, a double-painted overlap.
     CHAIN — N scrolls in a row, then one full bake at the same camera. Catches
             DRIFT, which is the failure a per-step test cannot see.
   And a CONTROL, because the bar is not zero: a scroll rounds the shift to whole
   device pixels and carries the remainder on the camera it records, so its
   picture is a full bake at a camera up to half a device pixel away. The control
   is exactly that — two full bakes half a device pixel apart.
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');
const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ENGNAME = opt('engine', 'chrome');
const GARDEN = opt('garden');   // an exported garden file; the demo garden when absent
const ENGINES = {
  chrome: { exe: ['C:/Program Files/Google/Chrome/Application/chrome.exe'],
    args: (prof, url) => ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
      // --soft: a software canvas is bit-exact from draw to draw, so a difference is a real one
      ...(argv.includes('--soft') ? ['--disable-accelerated-2d-canvas', '--disable-gpu-rasterization', '--disable-gpu-compositing'] : []),
      '--window-size=1440,900', '--window-position=0,0', '--new-window', url] },
  firefox: { exe: ['C:/Program Files/Mozilla Firefox/firefox.exe'],
    args: (prof, url) => ['-profile', prof, '-no-remote', '-new-instance', '-width', '1440', '-height', '900', url],
    profilePrefs: 'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\nuser_pref("toolkit.telemetry.enabled", false);\nuser_pref("browser.aboutwelcome.enabled", false);\n' }
};
const ENG = ENGINES[ENGNAME];

function inPage() {
  const T = 1e7;
  const out = { arms: [] };
  const w = () => groundCanvas.width, h = () => groundCanvas.height;
  const shot = () => groundCtx.getImageData(0, 0, w(), h()).data;
  /* Premultiplied. getImageData returns colour divided by alpha, so a pixel of
     alpha 3 and one of alpha 4, both invisible, read as tens of levels apart. */
  const pxDiff = (a, b, i) => {
    const aa = a[i + 3], ba = b[i + 3]; let d = Math.abs(aa - ba);
    for (let c = 0; c < 3; c++) { const e = Math.abs(a[i + c] * aa - b[i + c] * ba) / 255; if (e > d) d = e; }
    return Math.round(d);
  };
  const diff = (a, b) => {
    let px = 0, sum = 0, max = 0, aBlank = 0, bBlank = 0, over = 0;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const W0 = w(), bar = out.control ? Math.max(out.control.max, 8) : 255;
    for (let i = 0; i < a.length; i += 4) {
      const d = pxDiff(a, b, i);
      if (d) {
        px++; sum += d; if (d > max) max = d; if (d > bar) over++;
        if (a[i + 3] === 0 && b[i + 3] > 0) aBlank++;
        if (b[i + 3] === 0 && a[i + 3] > 0) bBlank++;
        const q = i >> 2, x = q % W0, y = (q / W0) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { pct: +(100 * px / (a.length / 4)).toFixed(3), mean: px ? +(sum / px).toFixed(2) : 0, max, over,
      bbox: px ? [x0, y0, x1, y1] : null, scrollBlank: aBlank, fullBlank: bBlank };
  };
  const fullBake = () => { groundKey = ''; render(T); };
  const scrollsSeen = () => (dbg.ev.bakePan ? dbg.ev.bakePan.n : 0);
  const fullsSeen = () => (dbg.ev.bake ? dbg.ev.bake.n : 0);

  return (async () => {
    // a heavier garden is still preparing its first picture after the driver's wait
    for (let i = 0; gardenOpening && i < 4000; i++) await new Promise(r => setTimeout(r, 5));
    crashed = true;
    await new Promise(r => setTimeout(r, 250));
    game.pausedAt = game.pausedAt || Date.now();
    /* A garden opens fitted to the plot (0.9.29), where the arms' pans mostly stay
       inside the bake's margin: nothing scrolls, and every arm "passes" by comparing
       a bake with itself. At 100% they cross it. The summary refuses a run that did not. */
    setUserZoom(1); render(T);
    dbg.on = true; devReset();
    const s = DPR * ZOOM;
    out.env = { canvas: [cnv.width, cnv.height], ground: [w(), h()], dpr: DPR, zoom: ZOOM, s,
      plants: Object.keys(game.plants).length, gw: GW, gh: GH, edge: game.edgeStyle, ua: navigator.userAgent };
    const cam0 = { x: cam.x, y: cam.y };

    // ---- CONTROL: two full bakes half a device pixel apart ----
    cam.x = cam0.x; cam.y = cam0.y; fullBake(); const c1 = shot();
    cam.x = cam0.x + 0.49 / s; fullBake(); const c2 = shot();
    out.control = diff(c1, c2);
    // and a true control: the same full bake twice, no move at all
    cam.x = cam0.x; fullBake(); const z1 = shot(); fullBake(); const z2 = shot();
    out.controlSame = diff(z1, z2);

    /* The invariant: the canvas claims to be a bake at (groundCamX, groundCamY).
       So bake there for real and compare. Comparing against a bake at the LIVE
       camera instead tests the stale-blit margin, which is deliberate behaviour
       and not what is under test — that was reading as a failure of everything. */
    const against = (a) => { cam.x = groundCamX; cam.y = groundCamY; fullBake(); return diff(a, shot()); };

    // ---- STEP arm ----
    const steps = [[37, 0], [0, 41], [29, 23], [-53, 0], [0, -31], [-17, -19], [120, 90], [-200, 160], [-420, -260]];
    for (const [dx, dy] of steps) {
      cam.x = cam0.x; cam.y = cam0.y; fullBake();
      const before = scrollsSeen();
      cam.x = cam0.x + dx; cam.y = cam0.y + dy;
      render(T);
      const used = scrollsSeen() > before;
      out.arms.push(Object.assign({ arm: "step", dx, dy, scrolled: used }, against(shot())));
    }

    // ---- CHAIN arm: many scrolls in a row ----
    for (const n of [12, 40]) {
      cam.x = cam0.x; cam.y = cam0.y; fullBake();
      const before = scrollsSeen(), beforeFull = fullsSeen();
      for (let i = 1; i <= n; i++) { cam.x = cam0.x + i * 17.3; cam.y = cam0.y + i * 9.7; render(T); }
      const a = shot();
      out.arms.push(Object.assign({ arm: "chain", n, scrolled: scrollsSeen() - before, fullBakesInChain: fullsSeen() - beforeFull }, against(a)));
    }

    // ---- back and forth, which is what a real drag does ----
    cam.x = cam0.x; cam.y = cam0.y; fullBake();
    const b0 = scrollsSeen(), bf0 = fullsSeen();
    for (let i = 0; i < 60; i++) {
      cam.x = cam0.x + Math.sin(i / 30 * Math.PI * 2) * 420;
      cam.y = cam0.y + Math.cos(i / 30 * Math.PI * 2) * 120;
      render(T);
    }
    const a3 = shot();
    out.arms.push(Object.assign({ arm: "sine-drag", n: 60, scrolled: scrollsSeen() - b0, fullBakesInChain: fullsSeen() - bf0 }, against(a3)));

    // ---- a long one-way drag: the case that exercises drift hardest ----
    cam.x = cam0.x; cam.y = cam0.y; fullBake();
    const b1 = scrollsSeen(), bf1 = fullsSeen();
    for (let i = 1; i <= 200; i++) { cam.x = cam0.x + i * 6.37; cam.y = cam0.y - i * 3.11; render(T); }
    const a4 = shot();
    out.arms.push(Object.assign({ arm: "long-drag", n: 200, scrolled: scrollsSeen() - b1, fullBakesInChain: fullsSeen() - bf1 }, against(a4)));

    /* EDIT arms. An edit bake deliberately leaves the MARGIN stale, so the
       viewport is what has to match; and the first camera move afterwards must
       fall back to a full bake, which the whole-canvas arm below checks. */
    const MDpx = Math.round(GROUND_MARGIN_CSS * DPR);
    const diffRect = (a, b, rx, ry, rw, rh) => {
      let px = 0, sum = 0, max = 0, over = 0; const W0 = w(), bar = Math.max(out.control.max, 8);
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        const i = (y * W0 + x) * 4, d = pxDiff(a, b, i);
        if (d) { px++; sum += d; if (d > max) max = d; if (d > bar) over++; }
      }
      return { pct: +(100 * px / (rw * rh)).toFixed(3), mean: px ? +(sum / px).toFixed(2) : 0, max, over, bbox: null, scrollBlank: 0, fullBlank: 0 };
    };
    let TE = T;
    const paintSome = (mat, n) => {
      game.tool = "bed"; game.bedStyle = mat; game.brushSize = 5;
      for (let i = 0; i < n; i++) stampBrushAt(4 + (i * 3) % Math.max(1, GW - 8), 5 + (i * 2) % Math.max(1, GH - 10));
    };
    for (const mat of ["gravel", "mulch"]) {
      cam.x = cam0.x; cam.y = cam0.y; TE += 20000; groundKey = ""; render(TE);
      paintSome(mat, 6);
      TE += 20000; render(TE);                       // the viewport-only bake
      const a = shot();
      TE += 20000; groundKey = ""; render(TE);        // full bake, same camera
      out.arms.push(Object.assign({ arm: "edit " + mat + " (viewport)" }, diffRect(a, shot(), MDpx, MDpx, cnv.width, cnv.height)));
    }
    // after an edit, the first camera move must bake in FULL: whole canvas must match
    cam.x = cam0.x; cam.y = cam0.y; TE += 20000; groundKey = ""; render(TE);
    paintSome("rock", 6);
    TE += 20000; render(TE);                          // viewport-only, margin now stale
    cam.x = cam0.x + 30; cam.y = cam0.y - 20; TE += 20000; render(TE);
    out.arms.push(Object.assign({ arm: "edit then pan (whole canvas)" }, against(shot())));
    game.tool = "hand";

    /* EDIT WALK. An edit now repaints only what it changed (groundEditRect), so the
       question is whether anything it did NOT repaint should have been. Each step
       makes one edit, bakes it, and compares the WHOLE canvas with a full bake at
       the same camera; a rectangle clip on whole pixels leaves nothing to excuse a
       real difference, so the bar is far tighter than the sub-pixel control. An
       outline left behind is a line of pixels off by the whole material contrast.
       A viewport fallback leaves its margin stale on purpose, and is compared over
       the viewport only. Half the walk runs with the view turned. */
    {
      const WALK_BAR = 32;
      const diffWalk = (a, b, rect, painted) => {
        let over = 0, outside = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const W0 = w();
        const rx0 = rect ? rect[0] : 0, ry0 = rect ? rect[1] : 0, rx1 = rect ? rect[0] + rect[2] : W0, ry1 = rect ? rect[1] + rect[3] : h();
        for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
          const i = (y * W0 + x) * 4, d = pxDiff(a, b, i);
          if (d > max) max = d;
          if (d > WALK_BAR) { over++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            if (painted && (x < painted[0] || y < painted[1] || x >= painted[0] + painted[2] || y >= painted[1] + painted[3])) outside++; }
        }
        return { over, outside, max, bbox: over ? [x0, y0, x1, y1] : null };
      };
      const rects = [], brc = bakeGroundRect;
      bakeGroundRect = function (px, py, pw, ph) { rects.push([px, py, pw, ph]); return brc.apply(this, arguments); };
      const edits = () => (dbg.ev.bakeEdit ? dbg.ev.bakeEdit.n : 0);
      const rng = mulberry(90210), pick = a => a[(rng() * a.length) | 0];
      const MATS = [{ k: 'bed', c: 'gravel' }, { k: 'bed', c: 'mulch' }, { k: 'bed', c: 'soil' }, { k: 'path', c: 'slate' }, { k: 'path', c: 'gravel' }, { k: 'lawn', c: 'meadow' }];
      const key = (x, y) => x + ',' + y;
      const plain = (x, y) => onPlot(x, y) && !buildingAt(x, y) && !houseAt(x, y);
      /* Tiles on an outline, which is where a change can travel along a run, and
         lawn beside them, listed fresh for each step since the last one was undone. */
      const edge = () => { const on = [], off = [];
        for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
          if (!plain(x, y)) continue;
          const t = terrainAt(x, y), lawnBeside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !terrainAt(x + a, y + b));
          const laidBeside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !!terrainAt(x + a, y + b));
          if (t && lawnBeside) on.push([x, y]); else if (!t && laidBeside) off.push([x, y]);
        }
        return { on, off }; };
      const OPS = {
        'add beside an outline': () => { const { off } = edge(); if (!off.length) return false; const [x, y] = pick(off), m = pick(MATS); setTile('terrain', key(x, y), { k: m.k, c: m.c, t: 1 }); },
        'erase on an outline': () => { const { on } = edge(); if (!on.length) return false; const [x, y] = pick(on); clearTile('terrain', key(x, y)); },
        'repaint on an outline': () => { const { on } = edge(); if (!on.length) return false; const [x, y] = pick(on), m = pick(MATS); setTile('terrain', key(x, y), { k: m.k, c: m.c, t: 1 }); },
        'dig a hole': () => { const all = Object.keys(game.terrain).filter(k => { const t = game.terrain[k]; return t && !t.removed; }); if (!all.length) return false; clearTile('terrain', pick(all)); },
        'a 5-wide stamp': () => { const { off } = edge(); if (!off.length) return false; const [x, y] = pick(off), m = pick(MATS);
          for (const [a, b] of brushOffsets(5)) if (plain(x + a, y + b)) setTile('terrain', key(x + a, y + b), { k: m.k, c: m.c, t: 1 }); },
        'edge a bed': () => { const beds = edge().on.filter(([x, y]) => terrainAt(x, y).k === 'bed'); if (!beds.length) return false; const [x, y] = pick(beds), t = terrainAt(x, y); setTile('terrain', key(x, y), Object.assign({}, t, { e: 'steel' })); },
        'water beside an outline': () => { const { off } = edge(); if (!off.length) return false; const [x, y] = pick(off); setTile('terrain', key(x, y), { k: 'water', c: 'pond', t: 1 }); },
      };
      out.walk = [];
      const shotFull = () => { TE += 20000; groundKey = ''; groundJob = null; render(TE); return shot(); };
      const step = (name, op) => {
        const snap = snapshotState();
        if (op() === false) return null;
        const e0 = edits(); TE += 20000; render(TE);
        const stale = groundMarginStale, a = shot(), rect = edits() > e0, painted = rect && rects.length ? rects[0].slice() : null;
        const r = diffWalk(a, shotFull(), stale ? [MDpx, MDpx, cnv.width, cnv.height] : null, painted);
        applySnapshot(snap); shotFull();
        return Object.assign(r, { rect, painted });
      };
      const walk = (label, perOp) => {
        for (const name in OPS) {
          const row = { arm: label + ' ' + name, n: 0, rect: 0, over: 0, outside: 0, max: 0, bbox: null, share: [] };
          for (let i = 0; i < perOp; i++) {
            rects.length = 0;
            const r = step(name, OPS[name]); if (!r) continue;
            row.n++; if (r.rect) { row.rect++; if (r.painted) row.share.push(r.painted[2] * r.painted[3] / (w() * h())); }
            if (r.max > row.max) row.max = r.max;
            if (r.outside > row.outside) row.outside = r.outside;
            if (r.over > row.over) { row.over = r.over; row.bbox = r.bbox; row.worst = r.painted; }
          }
          row.share.sort((a, b) => a - b);
          row.shareMed = row.share.length ? +row.share[row.share.length >> 1].toFixed(3) : null;
          row.shareMax = row.share.length ? +row.share[row.share.length - 1].toFixed(3) : null;
          delete row.share;
          out.walk.push(row);
        }
      };
      cam.x = cam0.x; cam.y = cam0.y; shotFull();
      /* A lake, which shelves slowly, big enough that one bank tile moves its colour
         well past any tile's pad: why a change to water is not bounded at all. */
      {
        const snap0 = snapshotState(), n = 18, x0 = Math.max(1, (GW - n) >> 1), y0 = Math.max(1, (GH - n) >> 1);
        for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) setTile('terrain', key(x, y), { k: 'water', c: 'lake', t: 1 });
        shotFull();
        const row = { arm: 'a bank tile of a big lake', n: 0, rect: 0, over: 0, outside: 0, max: 0, bbox: null, shareMed: null, shareMax: null };
        for (let i = 0; i < 6; i++) {
          rects.length = 0;
          const r = step('pond', () => { const t = i * 3; clearTile('terrain', i % 2 ? key(x0, y0 + t) : key(x0 + t, y0)); });
          row.n++; if (r.rect) row.rect++; if (r.max > row.max) row.max = r.max;
          if (r.outside > row.outside) row.outside = r.outside;
          if (r.over > row.over) { row.over = r.over; row.bbox = r.bbox; row.worst = r.painted; }
        }
        out.walk.push(row);
        applySnapshot(snap0); shotFull();
      }
      walk('rot0', 10);
      rotateView(1); const c1 = { x: cam.x, y: cam.y }; shotFull();
      walk('rot1', 6);
      /* A chain, with no full bake between: rectangles laid over rectangles. */
      {
        const snap = snapshotState(); let n = 0;
        for (let i = 0; i < 30; i++) { if (OPS[pick(['add beside an outline', 'erase on an outline', 'repaint on an outline'])]() !== false) { n++; TE += 20000; render(TE); } }
        const a = shot(), stale = groundMarginStale;
        const r = diffWalk(a, shotFull(), stale ? [MDpx, MDpx, cnv.width, cnv.height] : null, null);
        out.walk.push(Object.assign({ arm: 'chain of ' + n + ' edits', n: 1, rect: edits() ? 1 : 0, shareMed: null, shareMax: null }, r));
        applySnapshot(snap); shotFull();
      }
      rotateView(-1); cam.x = cam0.x; cam.y = cam0.y;
      game.edgeStyle = 'formal'; markGroundChanged(); shotFull();
      walk('formal', 4);
      game.edgeStyle = 'organic'; markGroundChanged();
      bakeGroundRect = brc;
      cam.x = cam0.x; cam.y = cam0.y; shotFull();
    }

    /* Variants, because the bake is not one picture: formal edges take the
       per-tile path instead of the traced blobs, and a furnished garden adds
       terraces, faced retaining walls and edging — all of which paintGround
       draws across the WHOLE plot rather than tile by tile, so a clipped
       repaint of them is the thing most likely to disagree. */
    const variants = [
      ["formal edges", () => { game.edgeStyle = "formal"; markGroundChanged(); }],
      ["furnished + terraces", () => { game.edgeStyle = "organic"; furnishGarden({}); markGroundChanged(); }],
      ["furnished, formal", () => { game.edgeStyle = "formal"; markGroundChanged(); }],
    ];
    for (const [name, setup] of variants) {
      setup();
      cam.x = cam0.x; cam.y = cam0.y; fullBake();
      for (const [dx, dy] of [[-200, 160], [120, 90], [-420, -260]]) {
        cam.x = cam0.x; cam.y = cam0.y; fullBake();
        const before = scrollsSeen();
        cam.x = cam0.x + dx; cam.y = cam0.y + dy; render(T);
        out.arms.push(Object.assign({ arm: name, dx, dy, scrolled: scrollsSeen() > before }, against(shot())));
      }
      cam.x = cam0.x; cam.y = cam0.y; fullBake();
      const b = scrollsSeen();
      for (let i = 0; i < 60; i++) { cam.x = cam0.x + Math.sin(i / 30 * Math.PI * 2) * 420; cam.y = cam0.y + Math.cos(i / 30 * Math.PI * 2) * 120; render(T); }
      out.arms.push(Object.assign({ arm: name + " drag", n: 60, scrolled: scrollsSeen() - b }, against(shot())));
    }

    cam.x = cam0.x; cam.y = cam0.y; fullBake();
    dbg.on = false;
    return out;
  })();
}

function server(driverBody) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  let resolveResult; const ready = new Promise(r => resolveResult = r);
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__result') {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(b)); } catch (e) { resolveResult({ error: String(b).slice(0, 3000) }); } });
      return;
    }
    if (req.url.startsWith('/__driver.js')) { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); res.end(driverBody); return; }
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

const driver = `
(async function(){
  const post = o => fetch('/__result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); }catch(e){}
    let guard=0;
    while ((typeof enterWorld!=='function' || typeof PSPRITE==='undefined') && guard++<400) await new Promise(r=>setTimeout(r,25));
    const envb = await (await fetch('${GARDEN ? '/__garden.json' : '/demo-garden.json'}')).json();
    await enterWorld(await installWorldBlob(envb));
    await new Promise(r=>setTimeout(r,1200));
    const out = await (${String(inPage)})();
    await post(out);
  }catch(e){ await post({error:String(e&&e.stack||e)}); }
})();`;

(async () => {
  const exe = ENG.exe.find(p => fs.existsSync(p));
  const { srv, port, ready } = await server(driver);
  sweepStaleTestBrowsers('ppgv-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppgv-'));
  if (ENG.profilePrefs) fs.writeFileSync(path.join(profile, 'user.js'), ENG.profilePrefs);
  const child = spawn(exe, ENG.args(profile, 'http://127.0.0.1:' + port + '/'), { stdio: 'ignore' });
  const res = await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 300000))]).catch(e => ({ error: e.message }));
  closeTestBrowser(child, profile);
  srv.close();
  if (res.error) { console.log('ERROR ' + res.error); process.exit(1); }
  console.log(JSON.stringify(res.env));
  console.log('\nCONTROL  same bake twice          : ' + JSON.stringify(res.controlSame));
  console.log('CONTROL  full bakes 0.49 device px apart: ' + JSON.stringify(res.control) + '   <- the bar');
  const pad = (s, n) => String(s).padEnd(n), r = (s, n) => String(s).padStart(n);
  console.log('\n' + pad('arm', 30) + r('scrolled', 9) + r('%px', 9) + r('mean', 7) + r('max', 6));
  for (const a of res.arms) {
    const label = a.dx !== undefined ? `${a.arm} ${a.dx},${a.dy}` : a.n ? `${a.arm} x${a.n}` : a.arm;
    console.log(pad(label, 30) + r(a.scrolled, 9) + r(a.pct, 9) + r(a.mean, 7) + r(a.max, 6)
      + '  over ' + a.over + '  bbox ' + JSON.stringify(a.bbox) + '  blankInScroll ' + a.scrollBlank + '  blankInFull ' + a.fullBlank
      + (a.fullBakesInChain ? ' (' + a.fullBakesInChain + ' full inside)' : ''));
  }
  const bar = res.control.max;
  /* Counted, not the max alone: a band painted in the wrong place is thousands of
     pixels, and a stray antialiased one is not a failure. */
  const STRAY_PX = 8;
  const bad = res.arms.filter(a => a.over > STRAY_PX);
  for (const a of bad) console.log('  over the bar: ' + a.arm + (a.dx !== undefined ? ' ' + a.dx + ',' + a.dy : '') + ' ' + a.over + 'px');
  console.log('\n' + pad('edit walk', 38) + r('n', 4) + r('rect', 6) + r('over32', 8) + r('outside', 8) + r('max', 6) + r('med%', 7) + r('max%', 7));
  for (const a of res.walk) console.log(pad(a.arm, 38) + r(a.n, 4) + r(a.rect, 6) + r(a.over, 8) + r(a.outside || 0, 8) + r(a.max, 6)
    + r(a.shareMed === null ? '-' : (100 * a.shareMed).toFixed(1), 7) + r(a.shareMax === null ? '-' : (100 * a.shareMax).toFixed(1), 7) + (a.bbox ? '  worst ' + JSON.stringify(a.bbox) + ' in ' + JSON.stringify(a.worst || null) : ''));
  const badWalk = res.walk.filter(a => a.over > STRAY_PX || (a.outside || 0) > STRAY_PX);
  const rectsUsed = res.walk.reduce((n, a) => n + a.rect, 0);
  console.log('\nedits repainted by rectangle: ' + rectsUsed);
  if (badWalk.length) { console.log('FAIL: ' + badWalk.length + ' edit walk row(s) left pixels behind'); process.exit(1); }
  const lake = res.walk.find(a => a.arm.includes('lake'));
  if (lake && lake.rect) { console.log('FAIL: a change to water was repainted by rectangle'); process.exit(1); }
  if (rectsUsed < 40) { console.log('FAIL: too few edits took the rectangle for this to test it'); process.exit(1); }
  const scrolled = res.arms.reduce((n, a) => n + (a.scrolled === true ? 1 : +a.scrolled || 0), 0);
  console.log('\nscrolls exercised across the arms: ' + scrolled);
  if (scrolled < 20) { console.log('FAIL: too few pans crossed the margin for this to test the scrolled bake'); process.exit(1); }
  console.log('\n' + (bad.length ? 'FAIL: ' + bad.length + ' arm(s) exceed the sub-pixel control' : 'PASS: no arm has more than ' + STRAY_PX + ' pixels over the sub-pixel control (' + bar + '/255)'));
  if (bad.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
