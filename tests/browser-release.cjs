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
    isMobile:profile.touch, serviceWorkers:'allow'});
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
