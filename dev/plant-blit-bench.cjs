'use strict';
/* Where the plant sprite pass actually spends its time, in a real browser, on a
   real garden — and what the candidate savings would cost you to look at.

   Why it exists. A Gecko profile of a heavy garden put ~53% of the content
   process's sampled CPU beneath drawPlantMaybeCached, and the debug HUD's
   `draw` phase agreed (30.13ms of a 67.88ms frame). But `draw` is one number
   over a pass that both BAKES sprites and BLITS them, and those want opposite
   fixes: baking is driven by how fast the growth/bloom buckets churn (so by
   previewMode and by fast-forward), blitting by how many pixels are composited.
   Nothing separated them, so this does.

   It also refuses to let you optimise a number you cannot trust:

     - A browser window that is occluded does not really rasterise. One run of an
       earlier version of this reported 2.0us per blit where three careful runs
       of the SAME build report 76us; the fast one was a hidden window. The
       backend probe below is the guard — a full-screen fill that costs ~1ns a
       pixel is doing real work, and one that costs nothing is not.
     - Firefox falls back to software rasterising for canvas operations its
       accelerated backend cannot do. The probe times a radial gradient fill
       against a linear one for that reason: a large ratio means the radial is
       falling back. It is a hint, not a verdict — do not read it as an
       authoritative backend query, because there isn't one from script.

   Findings on the reported 326-plant garden, Firefox 155, 1700x959, dpr 1
   (three runs, consistent to a few percent):

     still, established   frame 37.3ms   plants 25.5ms   blit 24.9ms   76us/blit
     still, today         frame 21.9ms   plants 11.1ms   blit 10.9ms   33us/blit
     sway forced to 0     frame 18.5ms   plants  7.9ms   blit  7.7ms   24us/blit
     imageSmoothing off   frame 15.3ms   plants  4.8ms   blit  4.6ms   14us/blit

   Read three things off that. Blitting dominates and baking is nearly free
   (0.2-0.7ms), so bake frequency is not the lever it looks like. The Established
   preview costs 2.3x Today, because mature plants are simply bigger sprites
   (18.8MB of cache against 5.9MB) — that is the DEFAULT for every garden. And
   the wind is about 30% of the blit: the shear makes every blit a resampling
   blit.

   THREE SAVINGS WERE MEASURED AND ALL THREE REJECTED. Kept here so nobody
   re-derives them:

     - Trim the transparent padding out of each sprite. The ink audit says only
       7-11% of a sprite's pixels are drawn at all, which looks like a 10x win
       and is not one: the transparency is INTERSTITIAL — the gaps between grass
       blades — not a border. The ink's bounding box is very nearly the sprite's
       own box, so there is nothing to crop.
     - Drop the wind shear. Worth ~30% of the blit, and it is the wind.
     - imageSmoothingEnabled=false. The biggest lever by far, 2.3x off the blit
       and 27% off the whole frame, because a sheared drawImage is the only
       resampling in the pass. Measured against a frozen wind with a clean 0%
       control, it changes 6.14% of the frame's pixels at a mean of 6.76/255 and
       a max of 59. That is visible, and it is worse than the static figure
       suggests: nearest-neighbour snaps each row of a sheared sprite to a whole
       pixel, so the stair-steps crawl as the wind moves.

   Usage:
     node dev/plant-blit-bench.cjs [repoDir]
     node dev/plant-blit-bench.cjs --json
   Needs Firefox installed; set PP_FIREFOX_PATH to point elsewhere. Runs in a
   throwaway profile, serves the working tree unchanged except for disabling the
   service worker and first-run onboarding, and touches no personal storage.
*/
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const GARDEN_ARG = (() => { const i = argv.indexOf('--garden'); return i >= 0 ? argv[i + 1] : null; })();
// the positional repo dir must not swallow --garden's VALUE, which is not a flag
const REPO = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--garden')[0]
  || path.resolve(__dirname, '..');
const GARDEN_PATH = GARDEN_ARG || path.join(REPO, 'demo-garden.json');
const FF = [process.env.PP_FIREFOX_PATH, 'C:/Program Files/Mozilla Firefox/firefox.exe',
  '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'].filter(Boolean).find(p => fs.existsSync(p));
if (!FF) { console.error('Firefox not found. Set PP_FIREFOX_PATH.'); process.exit(1); }
if (!fs.existsSync(GARDEN_PATH)) { console.error('no garden at ' + GARDEN_PATH); process.exit(1); }
const GARDEN = fs.readFileSync(GARDEN_PATH);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

const DRIVER = `
(async function(){
  const say = o => fetch('/__result',{method:'POST',body:JSON.stringify(o)});
  try{
    try{ localStorage.setItem('hortus:welcomed','1'); }catch(e){}
    while (typeof enterWorld!=='function' || typeof PSPRITE==='undefined') await new Promise(r=>setTimeout(r,50));
    const env = await (await fetch('/__garden.json')).json();
    await enterWorld(await installWorldBlob(env));
    game.pausedAt = game.pausedAt || Date.now();   // sceneKey carries absDay(): freeze it
    game.ffActive = false;
    await new Promise(r=>setTimeout(r,900));

    const cx = cnv.getContext('2d');
    const flush = () => cx.getImageData(0,0,1,1);
    const FFSTEP = FF_RATE*16.7;
    const origMake = window.makePlantSprite, origDraw = window.drawPlantMaybeCached;
    let bakeMs=0,bakes=0,drawMs=0,draws=0,swayForced=null;
    window.makePlantSprite=function(){ const a=performance.now();
      const r=origMake.apply(this,arguments); bakeMs+=performance.now()-a; bakes++; return r; };
    window.drawPlantMaybeCached=function(ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites,rec){
      if (swayForced!==null) sway=swayForced;
      const a=performance.now();
      const r=origDraw.call(this,ctx,bx,by,key,growth,season,seed,sway,variant,detail,useSprites,rec);
      drawMs+=performance.now()-a; draws++; return r; };

    /* Is this window really rasterising, and is the radial falling back? */
    function backendProbe(){
      const W=cnv.width,H=cnv.height;
      const lin=cx.createLinearGradient(0,0,0,H); lin.addColorStop(0,'#123'); lin.addColorStop(1,'#456');
      const rad=cx.createRadialGradient(W*0.5,H*0.4,0,W*0.5,H*0.4,H*0.8);
      rad.addColorStop(0,'rgba(0,0,0,0)'); rad.addColorStop(1,'rgba(0,0,0,0.2)');
      const t=s=>{ const a=performance.now(); for(let i=0;i<3;i++){ cx.fillStyle=s; cx.fillRect(0,0,W,H); } flush(); return (performance.now()-a)/3; };
      t(lin); t(rad);
      const L=Math.min(t(lin),t(lin)), R=Math.min(t(rad),t(rad));
      return {linearMs:+L.toFixed(2), radialMs:+R.toFixed(2), ratio:+(R/Math.max(0.01,L)).toFixed(1),
        nsPerPixel:+(1e6*L/(W*H)).toFixed(2),
        radialFallsBack:(R/Math.max(0.01,L))>3};
    }
    function arm(label, preview, forceSway, advance, smoothing){
      game.previewMode=preview; swayForced=forceSway;
      cx.imageSmoothingEnabled = smoothing!==false;
      PSPRITE.map.clear(); PSPRITE.slot.clear(); PSPRITE.bytes=0;
      PSPRITE.active=true; PSPRITE.off=false;
      const day0=absDay();
      render(performance.now()); flush();
      bakeMs=0;bakes=0;drawMs=0;draws=0;
      const N=50, t0=performance.now();
      for(let i=0;i<N;i++){ if(advance) game.elapsedMs+=FFSTEP; render(performance.now()); }
      flush();
      const wall=performance.now()-t0;
      game.elapsedMs=(day0-game.dayOffset)*DAY_MS;
      cx.imageSmoothingEnabled=true;
      return {label, frameMs:+(wall/N).toFixed(2), plantMs:+(drawMs/N).toFixed(2),
        bakeMs:+(bakeMs/N).toFixed(2), blitMs:+((drawMs-bakeMs)/N).toFixed(2),
        bakesPerFrame:+(bakes/N).toFixed(1), blitsPerFrame:Math.round(draws/N),
        usPerBlit:+(1000*(drawMs-bakeMs)/Math.max(1,draws)).toFixed(1),
        cacheMB:+(PSPRITE.bytes/1048576).toFixed(1)};
    }
    /* How much of what we composite is actually drawn? Sampled: a full alpha
       scan of every sprite times the run out. */
    function inkAudit(){
      let n=0,px=0,ink=0,boxes=[],budget=50;
      for (const e of PSPRITE.map.values()){
        if(budget--<=0) break;
        const w=e.cv.width,h=e.cv.height; px+=w*h; n++;
        const d=e.cv.getContext('2d').getImageData(0,0,w,h).data;
        let a=0,seen=0; for(let i=3;i<d.length;i+=16){ seen++; if(d[i]>8) a++; }
        a=Math.round(a*(w*h)/Math.max(1,seen)); ink+=a;
        boxes.push([w*h, w+'x'+h+' '+(100*a/(w*h)).toFixed(0)+'% ink']);
      }
      boxes.sort((x,y)=>y[0]-x[0]);
      return {sampled:n, megapixels:+(px/1e6).toFixed(2),
        inkPct:+(100*ink/Math.max(1,px)).toFixed(1), largest:boxes.slice(0,4).map(b=>b[1])};
    }
    /* What nearest-neighbour would cost you to look at. Frozen t so the wind is
       identical in both arms; control first, or the diff is unreadable. */
    function smoothingDiff(){
      const shot=()=>cx.getImageData(0,0,cnv.width,cnv.height).data;
      const at=s=>{ cx.imageSmoothingEnabled=s; for(let i=0;i<4;i++) render(1000000); return shot(); };
      const d=(a,b)=>{ let px=0,sum=0,max=0;
        for(let i=0;i<a.length;i+=4){ let m=0;
          for(let c=0;c<4;c++){ const e=Math.abs(a[i+c]-b[i+c]); if(e>m)m=e; }
          if(m){px++;sum+=m;if(m>max)max=m;} }
        return {pctPixels:+(100*px/(a.length/4)).toFixed(3), mean:px?+(sum/px).toFixed(2):0, max}; };
      PSPRITE.map.clear();PSPRITE.slot.clear();PSPRITE.bytes=0;PSPRITE.active=true;
      const A=at(true), B=at(true), C=at(false);
      cx.imageSmoothingEnabled=true;
      return {control:d(A,B), nearestNeighbour:d(A,C)};
    }

    const backend = backendProbe();
    game.previewMode='today';
    const sdiff = smoothingDiff();
    PSPRITE.map.clear();PSPRITE.slot.clear();PSPRITE.bytes=0;PSPRITE.active=true;
    game.previewMode='established'; for(let i=0;i<8;i++) render(performance.now());
    const inkEstablished = inkAudit();
    PSPRITE.map.clear();PSPRITE.slot.clear();PSPRITE.bytes=0;
    game.previewMode='today'; for(let i=0;i<8;i++) render(performance.now());
    const inkToday = inkAudit();

    const rows=[
      arm('still, established','established',null,false),
      arm('still, today','today',null,false),
      arm('fast-forward, established','established',null,true),
      arm('fast-forward, today','today',null,true),
      arm('today, sway forced 0','today',0,false),
      arm('today, smoothing OFF','today',null,false,false)
    ];
    window.makePlantSprite=origMake; window.drawPlantMaybeCached=origDraw;
    game.previewMode='today';
    await say({ua:navigator.userAgent, canvas:cnv.width+'x'+cnv.height,
      dpr:typeof DPR!=='undefined'?DPR:null, zoom:typeof ZOOM!=='undefined'?+ZOOM.toFixed(2):null,
      ents:scene&&scene.ents?scene.ents.length:null, plants:Object.keys(game.plants).length,
      backend, rows, inkEstablished, inkToday, smoothing:sdiff});
  }catch(e){ await say({error:String(e&&e.stack||e)}); }
})();
`;

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
  if (!abs.startsWith(path.resolve(REPO) + path.sep)) { res.writeHead(403); res.end(); return; }
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
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'plantblit-'));
  const child = spawn(FF, ['-profile', profile, '-no-remote', '-new-instance',
    'http://127.0.0.1:' + port + '/'], { stdio: 'ignore' });
  const r = await Promise.race([ready,
    new Promise((_, j) => setTimeout(() => j(new Error('timed out')), 300000))]).catch(e => ({ error: e.message }));
  try { child.kill(); } catch (e) { } server.close();

  if (r.error) { console.error(r.error); process.exit(1); }
  if (JSON_OUT) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
  const pad = (s, n) => String(s).padStart(n);
  console.log('\n' + r.ua);
  console.log('canvas ' + r.canvas + '  dpr ' + r.dpr + '  zoom ' + r.zoom
    + '  ' + r.plants + ' plants, ' + r.ents + ' entities  (' + path.basename(GARDEN_PATH) + ')');
  console.log('backend: full-screen fill ' + r.backend.nsPerPixel + ' ns/px'
    + (r.backend.nsPerPixel < 0.05 ? '  <- TOO CHEAP: the window is not really rasterising, ignore everything below' : '')
    + ';  radial/linear ' + r.backend.ratio + 'x'
    + (r.backend.radialFallsBack ? '  <- the radial is falling back to software' : ''));
  console.log('\n  arm                        frame   plants    bake    blit  bakes/f  blits/f  us/blit  cacheMB');
  for (const x of r.rows)
    console.log('  ' + String(x.label).padEnd(25) + pad(x.frameMs, 7) + pad(x.plantMs, 9) + pad(x.bakeMs, 8)
      + pad(x.blitMs, 8) + pad(x.bakesPerFrame, 9) + pad(x.blitsPerFrame, 9) + pad(x.usPerBlit, 9) + pad(x.cacheMB, 9));
  console.log('\n  ink (sampled): established ' + r.inkEstablished.inkPct + '% of '
    + r.inkEstablished.megapixels + 'MP   today ' + r.inkToday.inkPct + '% of ' + r.inkToday.megapixels + 'MP');
  console.log('    largest sprites: ' + r.inkEstablished.largest.join(', '));
  console.log('    (interstitial, not a border — the ink box is the sprite box, so there is nothing to crop)');
  console.log('\n  nearest-neighbour blits would change: ' + r.smoothing.nearestNeighbour.pctPixels
    + '% of pixels, mean ' + r.smoothing.nearestNeighbour.mean + '/255, max ' + r.smoothing.nearestNeighbour.max
    + '   (control ' + r.smoothing.control.pctPixels + '%)');
  console.log('');
  process.exit(0);
});
