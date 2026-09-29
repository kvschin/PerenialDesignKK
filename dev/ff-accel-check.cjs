'use strict';
/* Does Firefox keep the garden canvas on the GPU?

   Every other browser test here runs in Chromium, and the failure this checks
   for does not exist there. Firefox's accelerated canvas scores each frame:
   one where texture uploads + readbacks + layers exceed 66% of its draw
   requests FAILS, and once failed frames pass 30% of a canvas's frames (after
   the first 10; the counts never reset) the canvas is dropped to software in
   the content process for the rest of the page. Nothing reports it. The frame
   goes from ~6ms to ~80ms at 2130x1259 and stays there.

   It happened to every sprite-cached garden until 0.9.38, because each sprite
   was its own small <canvas>, and blitting a small canvas re-uploads it every
   frame — so the tenth frame after a garden opened was the last one on the
   GPU (see spriteBitmapsSupported in js/renderer.js). A sprite-cache change
   that brings canvases back, or anything else that makes most of a frame's
   draws uploads, brings it back silently. This is the guard.

   The probe: the JS cost of drawSeasonSky, one full-canvas gradient fill and
   a blit. On a remote (GPU-process) canvas that is only recorded, ~0.0ms; on
   the local software canvas Firefox demotes to, it is rasterised on the spot,
   several ms at this size. A frame's `sky` above 1.5ms means demoted.

   Usage:
     node dev/ff-accel-check.cjs [--garden file.json] [--w 2560 --h 1400]
   Runs the garden (default demo-garden.json) through open, pan, fast-forward,
   a season Skip, pan, night pan, and prints fps and the probe per phase. Exits
   1 if the canvas was demoted, naming the frame it happened on. Needs Firefox;
   PP_FIREFOX_PATH points elsewhere. Throwaway profile, service worker disabled
   in the served markup, no personal storage touched. Use a garden big enough
   to sprite-cache (the governor must engage), and a window the size you
   actually use: the demotion measured here was at 2130x1259. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { closeTestBrowser, sweepStaleTestBrowsers } = require('./close-test-browser.cjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const REPO = path.resolve(__dirname, '..');
const GARDEN = fs.readFileSync(path.resolve(opt('garden', path.join(REPO, 'demo-garden.json'))));
const W = +opt('w', 2560), H = +opt('h', 1400);
const FF = [process.env.PP_FIREFOX_PATH, 'C:/Program Files/Mozilla Firefox/firefox.exe',
  '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'].filter(Boolean).find(p => fs.existsSync(p));
if (!FF) { console.error('Firefox not found. Set PP_FIREFOX_PATH.'); process.exit(1); }

const DRIVER = `
(async function(){
  const say = o => fetch('/__result',{method:'POST',body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); }catch(e){}
    while (typeof enterWorld!=='function' || typeof cnv==='undefined') await new Promise(r=>setTimeout(r,50));
    const frames=[]; let cur=null, phase='open';
    const oSky=window.drawSeasonSky;
    window.drawSeasonSky=function(){ const a=performance.now(); const r=oSky.apply(this,arguments); if(cur) cur.sky=performance.now()-a; return r; };
    const oR=window.render;
    window.render=function(t){ cur={t:performance.now(),phase,sky:-1}; const r=oR.apply(this,arguments); if(cur.sky>=0) frames.push(cur); cur=null; return r; };
    await enterWorld(await installWorldBlob(await (await fetch('/__garden.json')).json()));
    while (gardenOpening) await new Promise(r=>setTimeout(r,50));
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    let pan=false, t0=0; const c0={x:cam.x,y:cam.y};
    (function loop(){ if(pan){ const u=(performance.now()-t0)/1000; cam.x=c0.x+Math.sin(u*1.3)*60; cam.y=c0.y+Math.sin(u*0.9)*25; } requestAnimationFrame(loop); })();
    const run=async(name,ms,fn)=>{ phase=name; if(fn) fn(); await sleep(ms); };
    await run('settle',1500);
    await run('pan',5000,()=>{pan=true;t0=performance.now();});
    await run('fast-forward',10000,()=>{pan=false;game.ffActive=true;});
    game.ffActive=false;
    await run('skip',2000,()=>skipNextSeason());
    await run('pan after',4000,()=>{pan=true;t0=performance.now();});
    await run('night pan',5000,()=>{game.layerVis.night=true;});
    pan=false;
    await say({canvas:cnv.width+'x'+cnv.height, sprites:PSPRITE.active, bitmaps:typeof spriteBitmaps!=='undefined'&&spriteBitmaps,
      frames:frames.map(f=>[Math.round(f.t),f.phase,+f.sky.toFixed(2)])});
  }catch(e){ await say({error:String(e&&e.stack||e)}); }
})();
`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
let done; const ready = new Promise(r => done = r);
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/__result') {
    let b = ''; req.on('data', d => b += d);
    req.on('end', () => { res.end('ok'); try { done(JSON.parse(b)); } catch (e) { done({ error: String(b).slice(0, 400) }); } });
    return;
  }
  if (req.url === '/__garden.json') { res.setHeader('Content-Type', 'application/json'); res.end(GARDEN); return; }
  if (req.url.startsWith('/__driver.js')) { res.setHeader('Content-Type', 'text/javascript'); res.end(DRIVER); return; }
  const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const abs = path.resolve(REPO, rel);
  if (!abs.startsWith(REPO + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(abs, (e, buf) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', mime[path.extname(abs)] || 'application/octet-stream');
    if (path.basename(abs) === 'index.html')
      buf = Buffer.from(String(buf).replace("if ('serviceWorker' in navigator)", 'if (false)')
        .replace('</body>', '<script src="/__driver.js"></script></body>'));
    res.end(buf);
  });
});
server.listen(0, '127.0.0.1', async () => {
  sweepStaleTestBrowsers('ffaccel-');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ffaccel-'));
  fs.writeFileSync(path.join(profile, 'user.js'),
    'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\n'
    + 'user_pref("toolkit.telemetry.enabled", false);\nuser_pref("browser.aboutwelcome.enabled", false);\n'
    + 'user_pref("browser.startup.homepage_override.mstone", "ignore");\n');
  const child = spawn(FF, ['-profile', profile, '-no-remote', '-new-instance', '-width', String(W), '-height', String(H),
    'http://127.0.0.1:' + server.address().port + '/'], { stdio: 'ignore' });
  const r = await Promise.race([ready, new Promise((_, j) => setTimeout(() => j(new Error('timed out')), 240000))])
    .catch(e => ({ error: e.message }));
  closeTestBrowser(child, profile); server.close();
  if (r.error) { console.error(r.error); process.exit(1); }
  console.log('canvas ' + r.canvas + '  sprite cache ' + (r.sprites ? 'on' : 'OFF (a lighter garden will not exercise this)')
    + '  sprite bitmaps ' + (r.bitmaps ? 'on' : 'off'));
  const phases = [...new Set(r.frames.map(f => f[1]))];
  let firstSoft = -1;
  r.frames.forEach((f, i) => { if (firstSoft < 0 && f[2] > 1.5) firstSoft = i; });
  for (const p of phases) {
    const fr = r.frames.filter(f => f[1] === p), sky = fr.map(f => f[2]).sort((a, b) => a - b);
    const span = fr.length > 1 ? fr[fr.length - 1][0] - fr[0][0] : 0;
    console.log('  ' + p.padEnd(13) + String(span ? (1000 * (fr.length - 1) / span).toFixed(1) : '-').padStart(7) + ' fps'
      + '   probe median ' + sky[sky.length >> 1] + 'ms');
  }
  if (firstSoft >= 0) {
    console.log('\nDEMOTED: frame #' + firstSoft + ' (' + r.frames[firstSoft][1] + ') is the first drawn on a software canvas.');
    process.exit(1);
  }
  console.log('\nstayed accelerated for all ' + r.frames.length + ' frames');
  process.exit(0);
});
