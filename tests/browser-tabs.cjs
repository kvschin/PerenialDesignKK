'use strict';
/* One garden open in two tabs of the same browser (audit F01/F02).
   Two real pages in one browser context share one IndexedDB, exactly as two tabs
   do. Uses installed Playwright/Chromium with an isolated profile; never downloads
   anything. Visibility is played by redefining document.hidden and firing the real
   visibilitychange event, because a headless browser reports every page visible.

   The last part runs the list race TWICE: with Web Locks, where it must keep every
   garden, and with them taken away, as a control. The control is expected to lose
   rows; if it ever stops doing so on some machine the check still passes, and says
   the race did not show, since then it is no longer evidence of anything. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const output=process.env.PP_BROWSER_RESULTS?path.resolve(process.env.PP_BROWSER_RESULTS):fs.mkdtempSync(path.join(os.tmpdir(),'pp-tabs-results-'));
fs.mkdirSync(output,{recursive:true});
const precache=[...fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].matchAll(/^\s*'\.\/([^']*)',?\s*$/gm)].map(m=>m[1]||'index.html');
const files=new Map([...new Set(['index.html',...precache])].map(f=>[f,fs.readFileSync(path.join(root,f))]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
// No service worker: this is about storage, and two tabs with a worker each would
// only add a cache to reason about.
const server=http.createServer((req,res)=>{
  const f=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(f==='sw.js'||!files.has(f)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(files.get(f));
});
function playwright(){
  for(const candidate of [process.env.PLAYWRIGHT_MODULE_PATH,'playwright','playwright-core',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]){
    if(!candidate)continue;
    try{return require(candidate);}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
  }
  throw new Error('Set PLAYWRIGHT_MODULE_PATH to an existing installation. Nothing was downloaded.');
}
function executable(){
  const found=process.env.PP_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>fs.existsSync(p));
  if(!found)throw new Error('An installed Chromium browser is required (PP_BROWSER_PATH).');
  return found;
}

const results=[];let failed=0;
function check(name,ok,detail){
  results.push({name,passed:!!ok,detail});if(!ok)failed++;
  console.log((ok?'PASS ':'FAIL ')+name+(detail!==undefined&&!ok?'  '+JSON.stringify(detail):''));
}
async function openApp(context,url,errors){
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>typeof enterWorld==='function'&&typeof game==='object');
  return page;
}
const setHidden=(page,hidden)=>page.evaluate(h=>{
  Object.defineProperty(document,'hidden',{value:h,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:h?'hidden':'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange',{bubbles:true}));
},hidden);
const plantAt=(page,key)=>page.evaluate(k=>!!(game.plants[k]&&!game.plants[k].removed),key);
const stored=(page,id,key)=>page.evaluate(async([i,k])=>{const b=await sGet('hortus:world:'+i);return !!(b&&b.plants[k]);},[id,key]);
const edit=(page,key)=>page.evaluate(k=>{setTile('plants',k,{s:'bluestem',d:0,t:Date.now()});},key);
const save=page=>page.evaluate(()=>saveSolo(true));
const rows=page=>page.evaluate(async()=>(await worldsIndex()).map(w=>({id:w.id,name:w.name})));
const barShown=page=>page.evaluate(()=>!document.getElementById('staleBar').hidden);

async function scenario(browser,url,withLocks){
  const errors=[];
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
  await context.addInitScript(locks=>{
    try{localStorage.setItem('hortus:welcomed','1');}catch(_){}
    if(!locks)try{Object.defineProperty(Navigator.prototype,'locks',{get(){return undefined;},configurable:true});}catch(_){}
  },withLocks);
  const A=await openApp(context,url,errors);
  const tag=withLocks?'':' (control, no Web Locks)';
  if(withLocks){
    await A.evaluate(()=>openDemoGarden());
    await A.waitForFunction(()=>game.inGarden&&game.worldId);
    const id=await A.evaluate(()=>game.worldId);
    const B=await openApp(context,url,errors);
    await B.evaluate(i=>enterWorld(i),id);
    await B.waitForFunction(()=>game.inGarden);

    // The audit's reproduction: B opened earlier, A edits, B goes into the background.
    await A.bringToFront();
    await edit(A,'1,1');await save(A);
    await setHidden(B,true);await B.evaluate(()=>pendingSaves());
    check('a stale tab put in the background does not undo the other tab\'s edit',await stored(A,id,'1,1'));
    await setHidden(B,false);
    await B.waitForFunction(()=>game.inGarden&&!!game.plants['1,1'],null,{timeout:8000}).catch(()=>{});
    check('a stale tab with no edits shows the latest version when it comes back',await plantAt(B,'1,1')&&!(await barShown(B)));

    // Both tabs edit: B, behind, must not write and must not lose its edit.
    await edit(A,'1,2');await save(A);
    await B.bringToFront();await edit(B,'1,3');await save(B);
    check('a stale tab with edits shows the bar and writes nothing',await barShown(B)
      &&await stored(A,id,'1,2')&&!(await stored(A,id,'1,3')));
    await B.waitForFunction(()=>gardenOpening===null,null,{timeout:15000}).catch(()=>{});
    await B.screenshot({path:path.join(output,'stale-bar.png')});
    const before=(await rows(B)).length;
    await B.click('#btnStaleSecondary');await B.evaluate(()=>pendingSaves());
    const after=await rows(B), copy=after.find(w=>w.id!==id&&/ copy$/.test(w.name));
    check('Keep mine as a copy saves this tab beside the other, and carries on in it',after.length===before+1&&copy
      &&await stored(B,copy.id,'1,3')&&!(await stored(B,copy.id,'1,2'))
      &&await B.evaluate(c=>game.worldId===c&&document.getElementById('worldLabel').textContent.endsWith(' copy'),copy.id)
      &&!(await barShown(B)),after.map(w=>w.name));
    check('and the other tab\'s version is untouched',await stored(A,id,'1,2')&&!(await stored(A,id,'1,3')));

    // Load latest with edits asks, drops them, and makes no copy.
    await B.evaluate(i=>enterWorld(i),id);await B.waitForFunction(()=>game.inGarden);
    await edit(A,'2,1');await save(A);
    await edit(B,'2,2');await save(B);
    await B.click('#btnStalePrimary');
    await B.waitForSelector('#confirmPop [data-ok]',{timeout:4000});
    await B.click('#confirmPop [data-ok]');
    await B.waitForFunction(()=>game.inGarden&&!!game.plants['2,1'],null,{timeout:8000}).catch(()=>{});
    check('Load latest asks first, then shows the other tab\'s garden without copying the dropped edits',
      await plantAt(B,'2,1')&&!(await plantAt(B,'2,2'))&&(await rows(B)).length===after.length);
    await edit(B,'2,3');await save(B);
    check('after which it saves normally',await stored(A,id,'2,3')&&await stored(A,id,'2,1'));
    await A.waitForFunction(()=>!document.getElementById('staleBar').hidden,null,{timeout:4000}).catch(()=>{});
    check('a tab on screen beside the one being worked in is told, and does not reload',await barShown(A)&&!(await plantAt(A,'2,3')));
    await B.close();
    await A.evaluate(async()=>{quitToMenu();await pendingSaves();});
  } else {
    await A.evaluate(()=>openDemoGarden());
    await A.waitForFunction(()=>game.inGarden);
    await A.evaluate(async()=>{quitToMenu();await pendingSaves();});
  }

  // The list itself (F02): five duplicates from each of two tabs, all at once.
  const C=await openApp(context,url,errors);
  const src=(await rows(A))[0].id, n0=(await rows(A)).length;
  await Promise.all([A,C].map(p=>p.evaluate(async s=>{await Promise.all([0,1,2,3,4].map(()=>duplicateWorld(s)));},src)));
  const list=await rows(A), blobs=await A.evaluate(async()=>(await storedWorldIds()).size);
  const kept=list.length===n0+10&&blobs===list.length&&new Set(list.map(w=>w.name)).size===list.length;
  if(withLocks){
    check('ten duplicates from two tabs at once: every row kept, no orphan, no shared name',kept,{rows:list.length,blobs,expected:n0+10});
    check('no page errors',errors.length===0,errors);
  } else {
    console.log((kept?'NOTE the control did not show the race this run':'NOTE the control lost rows without the lock, as expected')
      +` (${list.length} rows, ${blobs} gardens stored, ${n0+10} made)`);
  }
  await context.close();
}

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/`;
  let browser;
  try{
    browser=await playwright().chromium.launch({headless:true,executablePath:executable()});
    await scenario(browser,url,true);
    await scenario(browser,url,false);
  }finally{ if(browser)await browser.close(); server.close(); }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks:results},null,1));
  console.log(`${results.length-failed} passed, ${failed} failed. Results in ${output}`);
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
