'use strict';
/* Browser integration checks, separate from the stubbed Node suite.
   Uses an existing Playwright installation and browser; never downloads either.
   Only the local HTTP responses get synthetic build labels. Repo files and the
   user's browser profile are untouched. See docs/browser-release-checks.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const beforeVersion = version + '-release-check-before';
const output = process.env.PP_BROWSER_RESULTS
  ? path.resolve(process.env.PP_BROWSER_RESULTS)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-prairie-release-'));
fs.mkdirSync(output, {recursive:true});
const results = {started:new Date().toISOString(), version, checks:[]};

function playwright(){
  const candidates = process.env.PLAYWRIGHT_MODULE_PATH ? [process.env.PLAYWRIGHT_MODULE_PATH] : [
    'playwright', 'playwright-core',
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
  ];
  for (const candidate of candidates){
    try { return require(candidate); }
    catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Error('An existing Playwright installation is required. Set PLAYWRIGHT_MODULE_PATH to its package directory. Nothing was downloaded. See docs/browser-release-checks.md.');
}
function browserExecutable(){
  if (process.env.PP_BROWSER_PATH) return process.env.PP_BROWSER_PATH;
  const candidates = process.platform === 'win32' ? [
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ] : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  return candidates.find(file=>fs.existsSync(file));
}

/* Serve a snapshot of shipped files, excluding repository metadata and tools.
   Stopping this server, not a mocked fetch response, proves offline boot. */
function releaseServer(prefix){
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert(sw.includes(`const VERSION = '${version}';`), 'worker and package versions agree before preparing the fixture');
  assert(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8').includes(`const APP_VERSION = '${version}';`), 'app and package versions agree before preparing the fixture');
  const precache = [...sw.match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].matchAll(/^\s*'\.\/([^']*)',?\s*$/gm)].map(m=>m[1] || 'index.html');
  const files = new Map([...new Set(['index.html', 'sw.js', ...precache])].map(file=>
    [file, fs.readFileSync(path.join(root, file))]));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  assert(scripts.length > 10, 'read the actual separate-script application');
  for (const file of scripts) assert(files.has(file), file + ' must be precached');
  const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
    '.webmanifest':'application/manifest+json', '.woff2':'font/woff2', '.png':'image/png', '.svg':'image/svg+xml'};
  let build = beforeVersion, port = 0;
  const server = http.createServer((req, res)=>{
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith(prefix) ? pathname.slice(prefix.length) || 'index.html' : null;
    if (!files.has(file)) { res.writeHead(404); return res.end('Not found'); }
    let body = files.get(file);
    if (file === 'js/core.js') body = body.toString().replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${build}';`);
    if (file === 'sw.js') body = body.toString().replace(/const VERSION = '[^']+';/, `const VERSION = '${build}';`);
    if (file === 'index.html') body = body.toString().replace('<html lang="en">', `<html lang="en" data-release-check-build="${build}">`);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(body);
  });
  return {
    scripts,
    setBuild(next){ build = next; },
    async start(){
      await new Promise((resolve, reject)=>{
        server.once('error', reject);
        server.listen(port, '127.0.0.1', ()=>{ server.removeListener('error', reject); resolve(); });
      });
      port = server.address().port;
      return `http://127.0.0.1:${port}${prefix}`;
    },
    async stop(){
      if (!server.listening) return;
      const closed = new Promise((resolve, reject)=>server.close(e=>e ? reject(e) : resolve()));
      server.closeAllConnections();
      await closed;
    }
  };
}

async function boot(page, url, build, scripts){
  await page.goto(url, {waitUntil:'load'});
  await page.waitForFunction(()=>typeof game === 'object' && typeof enterWorld === 'function' && typeof buildToolTray === 'function');
  assert.equal(await page.evaluate(()=>APP_VERSION), build);
  assert.equal(await page.locator('html').getAttribute('data-release-check-build'), build, 'HTML and scripts use the same cache generation');
  assert.deepEqual(await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))), scripts);
  await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>[...document.fonts].filter(f=>f.status === 'loaded').length >= 2), 'self-hosted fonts load');
}
async function reopenGarden(page, id){
  await page.locator('#btnDesign').click();
  await page.locator('#worldList .world-row').filter({hasText:'Release check garden'}).click();
  await page.waitForFunction(id=>game.inGarden && game.worldId === id, id);
  assert(await page.evaluate(()=>!!game.plants['4,4'] && !!game.pausedAt), 'saved planting opens with the planner clock paused');
}
async function storedGarden(page, id){
  // Read the browser's store directly; sGet's localStorage fallback cannot pass.
  return page.evaluate(id=>new Promise((resolve, reject)=>{
    const open = indexedDB.open('hortus');
    open.onerror = ()=>reject(open.error);
    open.onsuccess = ()=>{
      const db = open.result, tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('hortus:world:' + id);
      tx.oncomplete = ()=>{ db.close(); resolve(req.result); };
      tx.onerror = ()=>{ db.close(); reject(tx.error); };
    };
  }), id);
}
async function check(name, fn){
  const started = Date.now();
  try { await fn(); results.checks.push({name, passed:true, ms:Date.now()-started}); console.log('PASS ' + name); }
  catch (e) { results.checks.push({name, passed:false, error:e.stack, ms:Date.now()-started}); throw e; }
}

async function scenario(browser, profile){
  const server = releaseServer(profile.prefix);
  const url = await server.start();
  const context = await browser.newContext({viewport:profile.viewport, hasTouch:profile.touch,
    isMobile:profile.touch, colorScheme:profile.touch?'dark':'light', serviceWorkers:'allow'});
  const errors = [], external = [], responses = [];
  context.on('page', page=>{
    page.on('pageerror', e=>errors.push(e.message));
    page.on('response', r=>{ if (r.status() >= 400) responses.push(r.status() + ' ' + r.url()); });
  });
  context.on('request', req=>{
    if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== new URL(url).origin) external.push(req.url());
  });
  let page = await context.newPage(), id, saved;
  page.setDefaultTimeout(15000);
  const label = name=>profile.name + ': ' + name;
  try {
    await check(label('separate-script boot and first service-worker install'), async()=>{
      await boot(page, url, beforeVersion, server.scripts);
      await page.getByRole('button', {name:'Start from scratch', exact:true}).click();
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      const reg = await page.evaluate(async()=>{
        const r = await navigator.serviceWorker.ready;
        return {scope:r.scope, waiting:!!r.waiting, caches:await caches.keys()};
      });
      assert.equal(reg.scope, url);
      assert.equal(reg.waiting, false);
      assert.deepEqual(reg.caches, ['pocket-prairie-v' + beforeVersion]);
      assert.equal(await page.locator('#updateBar').isVisible(), false, 'first installation is not an update');
    });
    await check(label('published ZIP lookup, unsupported zones, and official map link'), async()=>{
      await page.locator('#btnDesign').click(); await page.locator('#btnNewWorld').click();
      const map=page.locator('#dgnZoneMap');
      assert.equal(await map.getAttribute('href'),'https://planthardiness.ars.usda.gov/');
      assert.equal(await map.getAttribute('target'),'_blank');
      assert.equal(await map.getAttribute('rel'),'noopener noreferrer');
      assert(await map.isVisible(),'official map is also reachable without the ZIP helper');
      const readout=await page.locator('#dgnZoneOut').innerText();
      await page.locator('#dgnZoneToggle').click();
      await page.locator('#dgnZip').fill('785');
      assert.equal(await page.locator('#dgnZoneOut').innerText(),readout,'partial ZIP does not guess a zone');
      for(const [zip,half,blocked] of [['78520','10a',false],['96813','12b',true],['90210','10b',false]]){
        await page.locator('#dgnZip').fill(zip);
        await page.waitForFunction(half=>document.getElementById('dgnZipStatus').textContent.includes('Zone '+half),half);
        assert.equal(await page.locator('#btnDesignNext').isDisabled(),blocked);
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'ZIP setup fits the viewport');
      await page.screenshot({path:path.join(output,profile.name+'-zone-setup.png')});
      await page.locator('#dgnZip').fill('00000');
      await page.waitForFunction(()=>document.getElementById('dgnZipStatus').textContent.includes('not in the bundled'));
      assert(await page.locator('#btnDesignNext').isDisabled());
      await page.locator('#dgnZoneToggle').click();
      await page.locator('#dgnZoneChips').getByRole('button',{name:'Zone 6',exact:true}).click();
      assert.equal(await page.locator('#btnDesignNext').isDisabled(),false);
      assert.equal(await page.locator('#dgnZip').inputValue(),'');
      await page.locator('#btnDesignBack').click();
    });
    await check(label('paused edits persist in real IndexedDB and reopen in a new tab'), async()=>{
      await page.locator('#btnDesign').click();
      await page.locator('#btnNewWorld').click();
      await page.locator('#btnDesignNext').click();
      await page.locator('#plotName').fill('Release check garden');
      await page.locator('#btnPlotStart').click();
      await page.waitForFunction(()=>game.inGarden && !!game.worldId && !game.dirty);
      id = await page.evaluate(()=>{
        // Seed a deterministic edit through the production mutation pathway.
        // Physical placement gestures belong to the companion device checklist.
        withUndo(()=>setTile('plants', '4,4', {s:'bluestem',d:0,t:Date.now()}));
        return game.worldId;
      });
      await page.waitForFunction(()=>!game.dirty && !autosaveTimer);
      saved = await storedGarden(page, id);
      assert.equal(saved.plants['4,4'].s, 'bluestem');
      assert.equal(await page.evaluate(id=>localStorage.getItem('hortus:world:' + id), id), null, 'saving did not silently fall back to localStorage');
      await page.close(); page = await context.newPage(); page.setDefaultTimeout(15000);
      await boot(page, url, beforeVersion, server.scripts);
      await reopenGarden(page, id);
      assert.deepEqual(await page.evaluate(()=>game.plants['4,4']), saved.plants['4,4']);
    });
    /* The sandbox pins the placement rule. Only a browser has the pill's real size,
       its real stacking over the bar, and a press that lands on what is really there. */
    await check(label('a selection near the top leaves the top bar tappable, at every sheet state'), async()=>{
      // reopening reports inGarden while the opening cover is still over the canvas
      await page.locator('#gardenOpening').waitFor({state:'hidden'});
      const cdp = profile.touch ? await context.newCDPSession(page) : null;
      const quiet = ms=>page.waitForTimeout(ms);
      const tap = async p=>{ if (profile.touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y); };
      const drag = async (a,b)=>{
        if (!profile.touch){ await page.mouse.move(a[0],a[1]); await page.mouse.down(); await page.mouse.move(b[0],b[1],{steps:8}); await page.mouse.up(); return; }
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a[0],y:a[1]}]});
        for (let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a[0]+(b[0]-a[0])*i/8,y:a[1]+(b[1]-a[1])*i/8}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      };
      // Chrome swallows a tap that lands within a moment of a fast synthetic drag.
      const settleDrag = ()=>quiet(800);
      const sheet = async s=>{ await page.evaluate(s=>setSheetState(s),s); await quiet(400); };
      const look = ()=>page.evaluate(()=>{
        const answers = id=>{
          const el=document.getElementById(id), r=el.getBoundingClientRect();
          const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {x:r.left+r.width/2, y:r.top+r.height/2, ok:!!hit&&(hit===el||el.contains(hit))};
        };
        const pill=document.getElementById('selectionActions'), box=pill.getBoundingClientRect();
        const bar=document.querySelector('.hud-top').getBoundingClientRect();
        return {menu:answers('btnMenu'), season:answers('btnSeasonBox'), barBottom:bar.bottom,
          shown:!pill.classList.contains('hidden')&&getComputedStyle(pill).visibility!=='hidden',
          pill:{top:box.top,left:box.left,right:box.right,bottom:box.bottom,height:box.height}, width:innerWidth};
      });
      const rail = await page.evaluate(()=>{ const b=[...document.querySelectorAll('#canvasTools button')].find(x=>x.textContent.trim()==='Select');
        const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
      await tap(rail);
      if (profile.touch) await sheet('half');
      // The highest 9x8 marquee both of whose corners a finger could really press.
      const corners = await page.evaluate(()=>{
        const f=canvasViewportRect(), W=VW/ZOOM, H=VH/ZOOM;
        const at=(x,y)=>{ const p=screenOf(x,y,W,H); return [p[0]*ZOOM+f.left, p[1]*ZOOM+f.top+TILE_H/2*ZOOM]; };
        // around the point as well: Chrome's touch adjustment snaps a press to anything nearby
        const open=p=>[[0,0],[12,0],[-12,0],[0,12],[0,-12]].every(([dx,dy])=>{
          const e=document.elementFromPoint(p[0]+dx,p[1]+dy); return e&&e.id==='gameCanvas'; });
        let best=null;
        for (let y=0;y<GH-7;y++) for (let x=0;x<GW-8;x++){
          const a=at(x,y), b=at(x+8,y+7);
          if (open(a)&&open(b)&&(!best||a[1]<best.a[1])) best={a,b};
        }
        return best;
      });
      assert(corners,'a 9x8 selection fits on open canvas at the opening zoom');
      await drag(corners.a,corners.b); await settleDrag();
      assert(await page.evaluate(()=>!!game.sel),'a real drag made the selection');
      for (const s of profile.touch ? ['half','collapsed','full','half'] : ['full']){
        if (profile.touch) await sheet(s);
        const now = await look();
        assert(now.menu.ok && now.season.ok, `${s}: Menu and the season box answer a press at their centres`);
        if (profile.touch && s==='full') assert(!now.shown,'a full sheet is hiding the selection, and the pill stands down');
        else {
          assert(now.shown,`${s}: the pill is up`);
          assert(now.pill.top>=now.barBottom,`${s}: the pill stays below the bar (${now.pill.top} against ${now.barBottom})`);
          assert(now.pill.left>=0 && now.pill.right<=now.width,`${s}: the pill stays on screen`);
          assert(now.pill.height<=130,`${s}: it wraps to its content, not to where it happens to sit (${now.pill.height}px)`);
        }
      }
      // And the press itself, with the selection up.
      const open = await look();
      await tap(open.menu);
      await page.waitForFunction(()=>!document.getElementById('gardenMenu').classList.contains('hidden'));
      await page.evaluate(()=>closeOverlay('gardenMenu'));
      await page.evaluate(()=>{ setTool('hand',null); game.sel=null; game.selItems=null; refreshCanvasTools(); });
    });
    /* The sandbox pins the rule on given boxes. Only a browser has the real boxes,
       the real stacking, and the list moving with the hint already up. It takes a
       context of its own because a planted garden has no list to step round, and the
       saved gardens the later checks read should not gain a row. */
    await check(label('the tool hint steps round Start here rather than printing over it'), async()=>{
      const own = await browser.newContext({viewport:profile.viewport, hasTouch:profile.touch,
        isMobile:profile.touch, colorScheme:profile.touch?'dark':'light', serviceWorkers:'block'});
      const p = await own.newPage(), pageErrors = [];
      p.setDefaultTimeout(15000);
      p.on('pageerror', e=>pageErrors.push(e.message));
      try {
        await boot(p, url, beforeVersion, server.scripts);
        await p.getByRole('button', {name:'Start from scratch', exact:true}).click();
        await p.locator('#btnDesign').click(); await p.locator('#btnNewWorld').click();
        await p.locator('#btnDesignNext').click();
        await p.locator('#plotName').fill('Hint check');
        await p.locator('#btnPlotStart').click();
        await p.waitForFunction(()=>game.inGarden && !!game.worldId);
        await p.locator('#gardenOpening').waitFor({state:'hidden'});
        const press = async name=>{
          const at = await p.evaluate(n=>{ const b=[...document.querySelectorAll('#canvasTools button')].find(x=>x.textContent.trim()===n);
            const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }, name);
          if (profile.touch) await p.touchscreen.tap(at.x,at.y); else await p.mouse.click(at.x,at.y);
          await p.waitForFunction(n=>document.getElementById('activeToolStatus').classList.contains('show')
            && game.tool===n, name==='Select'?'select':'ruler');
          await p.waitForTimeout(260);   // the reveal's 160ms, which moves the rect
        };
        const look = ()=>p.evaluate(()=>{
          const box = el=>{ const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}; };
          const hint=document.getElementById('activeToolStatus'), list=document.getElementById('startHere');
          const a=box(hint), b=box(list), rail=box(document.getElementById('canvasTools'));
          return {hint:a, list:b, rail, width:innerWidth, styleTop:hint.style.top, plate:hint.classList.contains('over-list'),
            shown:hint.classList.contains('show'), listUp:!list.classList.contains('hidden'),
            overlap:Math.min(a.right,b.right)>Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)};
        });
        const clear = (now,what)=>{
          assert(now.shown && now.listUp, what+': both are up');
          assert(!now.overlap, `${what}: they do not overlap (hint ${JSON.stringify(now.hint)}, list ${JSON.stringify(now.list)})`);
          assert(!now.plate, what+': and so it needs no plate');
          assert(now.hint.left>=0 && now.hint.right<=now.width, what+': on screen');
          assert(now.hint.right<=now.rail.left || now.hint.left>=now.rail.right, what+': and clear of the rail');
        };
        await press('Select');
        const first = await look();
        clear(first,'a tool armed in a new garden');
        await p.screenshot({path:path.join(output,profile.name+'-hint-and-start-here.png')});
        if (profile.touch) assert(first.hint.top>=first.list.bottom,'on a phone the list fills the strip and the hint goes under it');
        else assert.equal(first.styleTop,'','a wide dock has room and leaves the hint at home');

        // The list moves on its own, with the hint up.
        await p.locator('#btnStartHereToggle').click();
        await p.waitForTimeout(100);
        const flipped = await look();
        assert(!flipped.overlap || flipped.plate,'the list changing size moves the hint, or gives it a plate');
        await p.locator('#btnStartHereToggle').click();
        await p.waitForTimeout(100);
        const back = await look();
        assert(!back.overlap && !back.plate,'and back again');

        if (profile.touch){
          await p.evaluate(()=>setLeftHandedLayout(true));
          await p.waitForTimeout(260);   // the rail's 180ms move, which moves its rect
          await press('Ruler');
          clear(await look(),'left-handed');
          await p.screenshot({path:path.join(output,profile.name+'-hint-and-start-here-left-handed.png')});
          await p.evaluate(()=>setLeftHandedLayout(false));
          await p.waitForTimeout(260);
          await press('Select');
        }

        // The first plant retires the list, and the hint is exactly where it always was.
        await p.evaluate(()=>withUndo(()=>setTile('plants','4,4',{s:'bluestem',d:0,t:Date.now()})));
        await p.waitForFunction(()=>document.getElementById('startHere').classList.contains('hidden'));
        const planted = await look();
        assert.equal(planted.styleTop,'','a planted garden has the hint at its CSS home');
        assert(!planted.plate,'with no plate');
        assert.deepEqual(pageErrors,[]);
      } finally { await own.close(); }
    });
    await check(label('automatic portraits, unchanged editing views, and legacy fallbacks'), async()=>{
      const demo=JSON.parse(fs.readFileSync(path.join(root,'demo-garden.json'),'utf8'));
      const portraitResult=await page.evaluate(async demo=>{
        const portraitId=await installWorldBlob(demo,'Prairie paths');
        await enterWorld(portraitId);
        game.dayOffset=0; game.elapsedMs=DAY_MS*(DAYS_PER_SEASON+8); game.pausedAt=Date.now();
        game.rot=3; cam.x=1500; cam.y=-800; game.previewMode='today';
        game.layerVis={...defaultLayerVis(),perennials:false,landscape:false,night:true,shade:true,height:true};
        game.tool='select'; game.sel={x0:2,y0:2,x1:8,y1:8};
        game.ruler={a:[1,1],b:[5,5]}; game.hoverTile=[3,3]; game.siteNorthPreviewDeg=180;
        const view=()=>JSON.stringify({cam,rot:game.rot,preview:game.previewMode,vis:game.layerVis,
          tool:game.tool,sel:game.sel,ruler:game.ruler,hover:game.hoverTile,north:game.siteNorthPreviewDeg,
          elapsed:game.elapsedMs,suspended:game.clockSuspended,rev:game.rev});
        const before=view(), sceneBefore=scene, canvasBefore=cnv.toDataURL(), layers=JSON.stringify(GAME_LAYERS.map(L=>game[L.k]));
        const plantSprites=PSPRITE.map.size, structSprites=SSPRITE.map.size;
        const started=performance.now(), first=captureGardenPortrait(), ms=performance.now()-started;
        if (view()!==before || scene!==sceneBefore || cnv.toDataURL()!==canvasBefore ||
            JSON.stringify(GAME_LAYERS.map(L=>game[L.k]))!==layers ||
            PSPRITE.map.size!==plantSprites || SSPRITE.map.size!==structSprites)
          throw new Error('Portrait changed the editing view, canvas, layers or sprite caches');
        game.rot=1; cam.x=-300; cam.y=500; game.previewMode='established'; game.layerVis=defaultLayerVis();
        const second=captureGardenPortrait();
        if (second.image!==first.image) throw new Error('Portrait depends on editing camera, preview or hidden layers');
        const seasons=[];
        for (let n=0;n<4;n++){
          game.elapsedMs=DAY_MS*(n*DAYS_PER_SEASON+8);
          seasons.push(captureGardenPortrait().image);
        }
        if (new Set(seasons).size!==4) throw new Error('Seasonal portraits did not change');
        game.elapsedMs=DAY_MS*(DAYS_PER_SEASON+8);
        const stable=view(), encoder=HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL=function(){ throw new Error('portrait encoder test'); };
        let failed=false;
        try{ captureGardenPortrait(); }catch(e){ failed=e.message==='portrait encoder test'; }
        finally{ HTMLCanvasElement.prototype.toDataURL=encoder; }
        if (!failed || view()!==stable) throw new Error('Capture failure did not restore the editing view');
        markModelChanged();
        quitToMenu(); await openWorlds();
        const stored=await sGet('hortus:world:'+portraitId);
        if (!stored.portrait || stored.portrait.image!==first.image || stored.rot!==1)
          throw new Error('Save & quit did not store the portrait with the original view');
        await installWorldBlob({pocketPrairie:1,v:1,world:{name:'Unplanted garden',gw:31,gh:31,wv:1,plants:{}}});
        await installWorldBlob({pocketPrairie:1,v:1,world:{name:'Older garden with a damaged picture',gw:21,gh:31,wv:1,
          plants:{'4,4':{s:'bluestem',d:0,t:1}},portrait:{v:1,day:0,image:'data:image/jpeg;base64,YmFk'}}});
        await updateWorldsIndex(rows=>{ rows.find(w=>w.id===portraitId).ts=Date.now()+1000; return rows; });
        await openWorlds();
        return {id:portraitId,ms,chars:first.image.length,seasons};
      },demo);
      assert(portraitResult.chars>1000 && portraitResult.chars<=120000,'bounded real JPEG');
      const cover=page.locator('#worldList .world-row').filter({hasText:'Prairie paths'}).locator('img.world-thumb');
      await cover.waitFor({state:'visible'});
      assert(await cover.evaluate(img=>img.complete && img.naturalWidth===420 && img.naturalHeight===315));
      for(const name of ['Unplanted garden','Older garden with a damaged picture'])
        assert(await page.locator('#worldList .world-row').filter({hasText:name}).locator('canvas.world-thumb').count(),'fallback for '+name);
      assert(await page.evaluate(()=>[...document.querySelectorAll('#worldList .world-row')].every(row=>
        row.scrollWidth<=row.clientWidth+1)),'garden cards fit narrow viewports');
      assert(await page.locator('#worldList .wname').evaluateAll(names=>names.every(n=>n.getBoundingClientRect().width>=90)),
        'larger portraits still leave readable garden names at the narrowest width');
      assert(await page.locator('#btnNewWorld').isVisible()); assert(await page.locator('#btnImport').isVisible());
      await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
      await page.screenshot({path:path.join(output,profile.name+'-garden-portraits.png')});
      for(let n=0;n<4;n++) fs.writeFileSync(path.join(output,profile.name+'-portrait-'+n+'.jpg'),
        Buffer.from(portraitResult.seasons[n].split(',')[1],'base64'));
      results.checks.push({name:label('portrait measurement'),ms:portraitResult.ms,chars:portraitResult.chars,passed:true});
      await page.locator('#worldsScreen [data-back]').click();
      await reopenGarden(page,id);
    });
    await check(label('offline reopening with the HTTP server stopped'), async()=>{
      await server.stop();
      await page.close(); page = await context.newPage(); page.setDefaultTimeout(15000);
      // Legal pages must keep their own cache entries, never replace the shell.
      for (const file of ['privacy.html', 'terms.html', 'credits.html']){
        await page.goto(url + file);
        assert(await page.locator('h1').count(), file + ' has its own content');
        assert.equal(await page.locator('#menuScreen').count(), 0, file + ' must not return the application shell');
      }
      await boot(page, url + '?offline-check=1', beforeVersion, server.scripts);
      const probe = await page.evaluate(async()=>{
        let networkReachable = false;
        try { await fetch('./__uncached_network_probe__', {cache:'no-store'}); networkReachable = true; } catch (_) {}
        return {networkReachable, cachedScript:(await fetch('./js/core.js')).ok};
      });
      assert.equal(probe.networkReachable, false, 'uncached request proves the origin is unavailable');
      assert.equal(probe.cachedScript, true);
      await page.locator('#btnDesign').click(); await page.locator('#btnNewWorld').click();
      await page.locator('#dgnZoneToggle').click(); await page.locator('#dgnZip').fill('78520');
      await page.waitForFunction(()=>document.getElementById('dgnZipStatus').textContent.includes('Zone 10a'));
      assert.equal(await page.locator('#btnDesignNext').isDisabled(),false,'ZIP data works on a fresh page with the server stopped');
      await page.locator('#btnDesignBack').click();
      await reopenGarden(page, id);
      assert.deepEqual((await storedGarden(page, id)).plants['4,4'], saved.plants['4,4']);
    });
    await check(label('waiting update stays on the old build until accepted'), async()=>{
      server.setBuild(version); await server.start();
      await page.evaluate(async()=>{ const r = await navigator.serviceWorker.ready; await r.update(); });
      await page.locator('#updateBar').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>APP_VERSION), beforeVersion);
      const pending = await page.evaluate(async()=>({
        waiting:!!(await navigator.serviceWorker.ready).waiting,
        caches:(await caches.keys()).sort(),
        html:await (await fetch('./index.html')).text(),
        core:await (await fetch('./js/core.js')).text()
      }));
      assert(pending.waiting);
      assert.deepEqual(pending.caches, ['pocket-prairie-v' + version, 'pocket-prairie-v' + beforeVersion].sort());
      assert(pending.html.includes(`data-release-check-build="${beforeVersion}"`));
      assert(pending.core.includes(`const APP_VERSION = '${beforeVersion}';`));
      await page.locator('#btnUpdateLater').click();
      assert.equal(await page.locator('#updateBar').isVisible(), false);
      assert.equal(await page.evaluate(()=>APP_VERSION), beforeVersion);
      assert(await page.evaluate(async()=>!!(await navigator.serviceWorker.ready).waiting));
    });
    await check(label('accepted update saves the latest edit, reloads, and retires the old cache'), async()=>{
      // A new launch re-offers a dismissed update via the real startup watcher.
      await boot(page, url, beforeVersion, server.scripts);
      await page.locator('#updateBar').waitFor({state:'visible'});
      await reopenGarden(page, id);
      await page.evaluate(()=>withUndo(()=>setTile('plants','5,5',{s:'switchgrass',d:0,t:Date.now()})));
      await page.locator('#btnUpdateNow').click();
      await page.waitForFunction(expected=>typeof APP_VERSION !== 'undefined' && APP_VERSION === expected, version);
      assert.equal(await page.locator('html').getAttribute('data-release-check-build'), version);
      assert.deepEqual(await page.evaluate(async()=>await caches.keys()), ['pocket-prairie-v' + version], 'activation retires the old cache before claiming clients');
      const updated = await storedGarden(page, id);
      assert.equal(updated.plants['4,4'].s, 'bluestem');
      assert.equal(updated.plants['5,5'].s, 'switchgrass');
      await reopenGarden(page, id);
      assert.equal(await page.evaluate(()=>game.plants['5,5'].s), 'switchgrass');
      await server.stop();
      await boot(page, url, version, server.scripts);
      await reopenGarden(page, id);
      assert.equal(await page.evaluate(()=>game.plants['5,5'].s), 'switchgrass', 'updated installation also reopens offline');
    });
    await check(label('no page errors, HTTP failures, or automatic third-party requests'), async()=>{
      assert.deepEqual(errors, []); assert.deepEqual(responses, []); assert.deepEqual(external, []);
    });
  } catch (e) {
    await page.screenshot({path:path.join(output, profile.name + '-failure.png'), fullPage:true}).catch(()=>{});
    fs.writeFileSync(path.join(output, profile.name + '-diagnostics.json'), JSON.stringify({errors, external, responses}, null, 2));
    throw e;
  } finally { await context.close(); await server.stop(); }
}

(async()=>{
  const pw = playwright();
  const browser = await pw.chromium.launch({headless:true, executablePath:browserExecutable()});
  results.browser = browser.version();
  try {
    for (const profile of [
      {name:'desktop-root', prefix:'/', viewport:{width:1280,height:900}, touch:false},
      {name:'phone-subpath', prefix:'/PerenialDesignKK/', viewport:{width:390,height:844}, touch:true},
      {name:'small-phone', prefix:'/PerenialDesignKK/', viewport:{width:320,height:568}, touch:true}
    ]) await scenario(browser, profile);
  } finally { await browser.close(); }
})().catch(e=>{ results.error = e.stack; console.error(e.stack); process.exitCode = 1; }).finally(()=>{
  results.finished = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log('Browser release results: ' + output);
});
