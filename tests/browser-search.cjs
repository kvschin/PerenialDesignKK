'use strict';
/* Real-browser search checks, using installed browsers and temporary profiles.
   Run `node tests/browser-search.cjs` for Chromium desktop + phone layouts.
   Set PP_FIREFOX_PATH to an installed stock Firefox for the same DOM checks.
   Optional PP_SEARCH_GARDEN imports a local .prairie JSON fixture read-only.
   PP_BROWSER_RESULTS selects the output directory; no dependencies download. */
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), http=require('node:http');
const {spawn}=require('node:child_process');
const {closeTestBrowser}=require('../dev/close-test-browser.cjs');
const root=path.resolve(__dirname,'..');
const output=process.env.PP_BROWSER_RESULTS?path.resolve(process.env.PP_BROWSER_RESULTS):fs.mkdtempSync(path.join(os.tmpdir(),'pp-search-results-'));
fs.mkdirSync(output,{recursive:true});
const garden=process.env.PP_SEARCH_GARDEN?JSON.parse(fs.readFileSync(process.env.PP_SEARCH_GARDEN,'utf8')):null;
const probe=fs.readFileSync(path.join(__dirname,'browser-search-probe.js'),'utf8');
const precache=[...fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].matchAll(/^\s*'\.\/([^']*)',?\s*$/gm)].map(m=>m[1]||'index.html');
const files=new Map([...new Set(['index.html',...precache])].map(file=>[file,fs.readFileSync(path.join(root,file))]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
let finish;
const received=new Promise(resolve=>{finish=resolve;});
const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if (file==='__result'&&req.method==='POST'){
    let body=''; req.on('data',data=>{body+=data;}); req.on('end',()=>{res.end('ok');finish(JSON.parse(body));}); return;
  }
  if (file==='__garden'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(garden));return;}
  if (!files.has(file)){res.writeHead(404);res.end();return;}
  let data=files.get(file);
  if (file==='index.html'){
    const launch=process.env.PP_FIREFOX_PATH?`${probe}\nrunSearchChecks(await (await fetch('/__garden')).json())
      .then(result=>fetch('/__result',{method:'POST',body:JSON.stringify(result)}))
      .catch(error=>fetch('/__result',{method:'POST',body:JSON.stringify({passed:false,error:error.stack})}));`:'';
    data=data.toString().replace("if ('serviceWorker' in navigator)",'if (false)')
      .replace('<head>','<head><script>localStorage.setItem("hortus:welcomed","1");</script>')
      .replace('</body>',`<script type="module">${launch}</script></body>`);
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
});
function save(name,result){
  fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(result,null,2));
  console.log(name,JSON.stringify(result));
  if (!result.passed) throw new Error(result.error||'Search checks failed');
}
async function firefox(url){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pp-search-check-'));
  if (!path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'pp-search-check-')) throw new Error('Invalid temporary profile');
  fs.writeFileSync(path.join(profile,'user.js'),[
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);'
  ].join('\n'));
  const child=spawn(process.env.PP_FIREFOX_PATH,['-profile',profile,'-no-remote','-new-instance','-width','1440','-height','960',url],{stdio:'ignore'});
  let timer;
  try {save('firefox',await Promise.race([received,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Firefox search checks timed out')),90000);child.once('error',reject);})]));}
  finally {clearTimeout(timer);closeTestBrowser(child,profile);}
}
async function chromium(url){
  let playwright;
  for (const candidate of [process.env.PLAYWRIGHT_MODULE_PATH,'playwright','playwright-core',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){
    try {playwright=require(candidate);break;} catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
  }
  if (!playwright) throw new Error('Use an existing Playwright installation via PLAYWRIGHT_MODULE_PATH. Nothing was downloaded.');
  const executablePath=process.env.PP_BROWSER_PATH||[
    'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].find(file=>fs.existsSync(file));
  if (!executablePath) throw new Error('Set PP_BROWSER_PATH to an installed Chromium browser.');
  const browser=await playwright.chromium.launch({executablePath,headless:true});
  try {
    for (const [name,viewport,touch] of [['desktop',{width:1440,height:900},false],['phone',{width:390,height:844},true]]){
      const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
      try {
        const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(url,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
        await page.addScriptTag({content:probe});
        save(name,await page.evaluate(garden=>runSearchChecks(garden).catch(e=>({passed:false,error:e.stack})),garden));
        await page.getByRole('button',{name:'Plants',exact:true}).click();
        const find=page.locator('#trayFind');await find.fill('cone');await page.waitForTimeout(220);
        await find.press('Home');await find.press('ArrowRight');await find.press('Delete');await page.waitForTimeout(220);
        const state=await find.evaluate(el=>({value:el.value,start:el.selectionStart,end:el.selectionEnd}));
        if (state.value!=='cne'||state.start!==1||state.end!==1) throw new Error('Real keyboard editing moved the caret: '+JSON.stringify(state));
        const cache=await page.evaluate(()=>verifyTrayCache());
        if (cache.misses.length) throw new Error('Tray invalidation missed state changes: '+JSON.stringify(cache.misses));
        if (errors.length) throw new Error(errors.join('; '));
        await page.screenshot({path:path.join(output,name+'.png')});
        console.log(name+' real keyboard editing and '+cache.checked+' cache cases PASS');
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {if(process.env.PP_FIREFOX_PATH)await firefox(url);else await chromium(url);}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
