'use strict';
/* Real storage, PNG output and keyboard/touch-layout checks. Uses installed
   Playwright/Chromium with isolated profiles; never downloads dependencies. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=process.env.PP_BROWSER_RESULTS?path.resolve(process.env.PP_BROWSER_RESULTS):fs.mkdtempSync(path.join(os.tmpdir(),'pp-daily-results-'));
fs.mkdirSync(output,{recursive:true});
const precache=[...fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const PRECACHE = \[([\s\S]*?)\n\];/)[1].matchAll(/^\s*'\.\/([^']*)',?\s*$/gm)].map(m=>m[1]||'index.html');
const files=new Map([...new Set(['index.html',...precache])].map(f=>[f,fs.readFileSync(path.join(root,f))]));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const f=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!files.has(f)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(files.get(f));
});
function playwright(){
  for(const candidate of [process.env.PLAYWRIGHT_MODULE_PATH,'playwright','playwright-core',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){
    try{return require(candidate);}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
  }
  throw new Error('Set PLAYWRIGHT_MODULE_PATH to an existing installation. Nothing was downloaded.');
}
async function checkShareOptions(page,name){
  const ready=()=>page.waitForFunction(()=>dailyShareImage&&document.getElementById('challengeShare').getAttribute('aria-busy')==='false');
  const state=()=>page.evaluate(()=>JSON.stringify({cam,rot:game.rot,preview:game.previewMode,vis:game.layerVis,
    north:game.siteNorthPreviewDeg,elapsed:game.elapsedMs,offset:game.dayOffset,paused:game.pausedAt,
    suspended:game.clockSuspended,layers:GAME_LAYERS.map(L=>game[L.k])}));
  const before=await state(),seasons=new Set();
  for(const [format,season,height] of [['square','Summer',1080],['portrait','Fall',1350],['story','Winter',1920],['portrait','Spring',1350]]){
    await page.locator('#challengeShareFormat').selectOption(format);await ready();
    await page.locator('#challengeShareSeason').selectOption(season);await ready();
    const info=await page.evaluate(async()=>{
      const image=dailyShareImage,bitmap=await createImageBitmap(image.blob);
      // Compare the garden itself at one size, so a changed label or crop cannot
      // make a broken seasonal renderer pass this assertion.
      const garden=renderGardenPortrait(420,315,dailyShareMoment({season:image.season}).atDay).toDataURL();
      const bytes=new TextEncoder().encode(garden);
      const out={width:bitmap.width,height:bitmap.height,name:image.name,season:image.season,
        hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',')};bitmap.close();return out;
    });
    assert.equal(info.width,1080);assert.equal(info.height,height);assert.equal(info.season,season);
    assert(info.name.endsWith('-'+format+'-'+season.toLowerCase()+'.png'));
    assert.match(await page.locator('#challengeCaption').inputValue(),new RegExp(season.toLowerCase()));
    assert.equal(await state(),before,'sharing preserves editing camera, clock, layers and planting');
    seasons.add(info.hash);
    const event=page.waitForEvent('download');await page.locator('#btnChallengeDownload').click();
    const download=await event;await download.saveAs(path.join(output,name+'-'+format+'-'+season+'.png'));
    await page.locator('#challengeShareFormat').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,name+'-'+format+'-'+season+'-controls.png')});
    const geometry=await page.locator('#challengeScreen .panel').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
    assert(geometry.scroll<=geometry.width+1,'sharing options fit the phone panel');
  }
  assert.equal(seasons.size,4,'four distinct seasonal images');
  // A real click reaches share synchronously with an already-prepared file.
  // The OS picker is mocked; this does not claim device or Instagram acceptance.
  await page.evaluate(()=>{
    window.__shareMode='hold';window.__shareCalls=0;
    Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
      window.__shareCalls++;window.__shareActivated=navigator.userActivation.isActive;
      window.__sharedFile={name:data.files[0].name,size:data.files[0].size};
      if(window.__shareMode==='hold')return new Promise(resolve=>window.__releaseShare=resolve);
      if(window.__shareMode==='fail')return Promise.reject(new DOMException('Test denied','NotAllowedError'));
      return Promise.resolve();
    }});
  });
  await page.locator('#btnChallengeShare').click();
  assert(await page.locator('#btnChallengeShare').isDisabled());assert(await page.locator('#challengeShareFormat').isDisabled());
  await page.evaluate(()=>document.getElementById('btnChallengeShare').onclick());
  assert.equal(await page.evaluate(()=>window.__shareCalls),1,'duplicate native requests are blocked');
  assert(await page.evaluate(()=>window.__shareActivated),'native sharing retains the click activation');
  await page.evaluate(()=>window.__releaseShare());await page.waitForFunction(()=>!dailySharing);
  assert.match(await page.locator('#challengeShareStatus').textContent(),/Share menu opened/);
  await page.evaluate(()=>window.__shareMode='fail');await page.locator('#btnChallengeShare').click();
  assert.match(await page.locator('#challengeShareStatus').textContent(),/Download the image/);
  assert(await page.locator('#btnChallengeDownload').isEnabled());
  // Capability absent, false, or throwing all keep a usable download fallback.
  for(const mode of ['absent','false','throws']){
    await page.evaluate(async mode=>{
      Object.defineProperty(navigator,'canShare',{configurable:true,value:mode==='absent'?undefined:()=>{
        if(mode==='throws')throw new Error('Test unsupported');return false;
      }});await prepareDailyShare();
    },mode);
    assert(await page.locator('#btnChallengeShare').isHidden());assert(await page.locator('#btnChallengeDownload').isEnabled());
  }
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Test clipboard unavailable');}}}));
  await page.locator('#btnChallengeCaption').click();
  assert(await page.locator('#challengeCaption').evaluate(el=>document.activeElement===el&&el.selectionEnd===el.value.length),'copy fallback selects the caption');
  // Failed encoding offers retry and never leaves an old downloadable image.
  await page.evaluate(async()=>{
    const encode=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(cb){cb(null);};
    try{await prepareDailyShare();}finally{HTMLCanvasElement.prototype.toBlob=encode;}
  });
  assert(await page.locator('#btnChallengeDownload').isDisabled());assert(await page.locator('#btnChallengeShareRetry').isVisible());
  await page.locator('#btnChallengeShareRetry').click();await ready();
  // Encode out of order, then dismiss during encoding; neither can restore stale output.
  await page.evaluate(()=>{
    window.__realEncode=HTMLCanvasElement.prototype.toBlob;window.__encoders=[];
    window.__liveShareURLs=new Set([dailyShareImage.url]);window.__makeURL=URL.createObjectURL;window.__dropURL=URL.revokeObjectURL;
    URL.createObjectURL=blob=>{const url=window.__makeURL(blob);window.__liveShareURLs.add(url);return url;};
    URL.revokeObjectURL=url=>{window.__liveShareURLs.delete(url);window.__dropURL(url);};
    HTMLCanvasElement.prototype.toBlob=function(cb){window.__encoders.push(()=>new Promise(resolve=>window.__realEncode.call(this,blob=>{cb(blob);resolve();},'image/png')));};
  });
  await page.locator('#challengeShareFormat').selectOption('square');
  assert(await page.locator('#btnChallengeDownload').isDisabled());
  await page.locator('#challengeShareSeason').selectOption('Winter');
  await page.evaluate(async()=>{const jobs=window.__encoders.splice(0);await jobs[1]();await jobs[0]();});
  await ready();assert.equal(await page.evaluate(()=>dailyShareImage.season),'Winter');
  assert.equal(await page.evaluate(()=>window.__liveShareURLs.size),1,'only the newest result has a live URL');
  await page.locator('#challengeShareFormat').selectOption('story');await page.locator('#btnChallengeClose').click();
  await page.evaluate(async()=>{
    await window.__encoders.shift()();HTMLCanvasElement.prototype.toBlob=window.__realEncode;
  });
  assert.equal(await page.evaluate(()=>dailyShareImage),null);assert.equal(await page.evaluate(()=>window.__liveShareURLs.size),0);
  await page.evaluate(()=>{URL.createObjectURL=window.__makeURL;URL.revokeObjectURL=window.__dropURL;openChallengeBrief();});await ready();
  assert.equal(await page.locator('#challengeShareFormat').inputValue(),'story');assert.equal(await page.locator('#challengeShareSeason').inputValue(),'Winter');
  assert.equal(await state(),before,'all error and cancellation paths preserve the garden');
  console.log(name+' sharing formats, seasons, capabilities, cancellation, retry and stale-result cleanup PASS');
}
async function check(browser,url,name,viewport,isMobile){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile,serviceWorkers:'block',acceptDownloads:true,timezoneId:'America/Chicago'});
  try{
    await context.addInitScript(()=>localStorage.setItem('hortus:welcomed','1'));
    await context.addInitScript(()=>{
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
        window.__sharedFile={name:data.files[0].name,size:data.files[0].size};
        throw new DOMException('User cancelled','AbortError');
      }});
    });
    const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>{game.filters=normalizeFilters({zone:13,nativeRegion:'north-america'});});
    await page.locator('#btnDaily').click();
    await page.waitForFunction(()=>dailyReady);
    assert(await page.locator('#btnDailyStart').isDisabled(),'empty climate palette explains why start is unavailable');
    assert.match(await page.locator('#dailyAvailability').textContent(),/cannot meet/);
    await page.locator('#btnDailyStudy').click();
    await page.waitForFunction(()=>!document.getElementById('btnDailyStart').disabled);
    assert.equal(await page.locator('#dailyPlantList li').count(),10);
    await page.locator('#dailyRulesOptions summary').click();await page.locator('#dailyStrict').check();
    assert.equal(await page.locator('#dailyGoals li').count(),3);
    const brief=await page.locator('#dailyTitle').textContent();
    await page.screenshot({path:path.join(output,name+'-brief.png')});
    // Crossing midnight after reading the prompt must not swap the brief.
    await page.evaluate(()=>{window.__today=todaysChallenge;todaysChallenge=()=>dailyChallengeFor(new Date(Date.now()+864e5));});
    await page.locator('#btnDailyStart').click();
    await page.locator('#gardenOpening').waitFor({state:'hidden'});
    await page.evaluate(()=>{todaysChallenge=window.__today;});
    const initial=await page.evaluate(async()=>{
      await pendingSaves();
      return {id:game.worldId,challenge:game.challenge,terrain:Object.values(game.terrain).map(p=>p.k),plants:Object.keys(game.plants).length,houses:game.houses.length,gw:GW,gh:GH};
    });
    assert.equal(initial.challenge.title,brief); assert.equal(initial.plants,initial.challenge.sitePlan.context.length); assert.equal(initial.houses,0);
    assert(initial.challenge.strict&&initial.challenge.palette.length===10);
    assert.equal(await page.evaluate(()=>discoveryRefsFor({source:'all'}).length),10,'only ten exact plant choices enter the catalog');
    assert(initial.terrain.includes('bed')&&initial.terrain.includes('path')); assert(initial.gw<=20&&initial.gh<=16);
    await page.locator('#btnMenu').click(); await page.locator('#btnChallenge').click();
    await page.locator('#btnChallengeFinish').click();
    assert.match(await page.locator('#challengeStatus').textContent(),/Add some plants/);
    await page.locator('#challengeGoals input').first().check();
    await page.keyboard.press('Escape');
    assert(await page.locator('#challengeScreen').evaluate(el=>el.classList.contains('hidden')));
    assert.equal(await page.evaluate(()=>document.activeElement.id),'btnMenu');
    // One species is insufficient when the gardener opts into constraints.
    await page.evaluate(()=>{
      const ref=game.challenge.palette[0];setTile(PLANTS[ref.s].type==='bulb'?'bulbs':'plants','2,2',{...ref,d:0,t:Date.now()});
    });
    await page.locator('#btnMenu').click();await page.locator('#btnChallenge').click();
    await page.locator('#btnChallengeFinish').click();
    assert.match(await page.locator('#challengeStatus').textContent(),/constraints still need attention/);
    assert.equal(await page.evaluate(()=>game.challenge.completedAt),null);
    await page.locator('#btnChallengeReturn').click();
    // A fixture built from eligible exact references must meet every rule.
    await page.evaluate(()=>{
      for(const layer of ['plants','bulbs'])for(const key of Object.keys(game[layer]))if(!game[layer][key].dailySiteId)clearTile(layer,key);
      const c=game.challenge, refs=dailyEligiblePalette(c,activeFilters()), group=c.rules.find(r=>r.kind==='group');
      const count=c.rules.find(r=>r.kind==='species').min, chosen=new Map();
      const add=ref=>{if(chosen.size<count)chosen.set(dailySpeciesId(ref),ref);};
      refs.filter(ref=>group.keys.includes(ref.s)).slice(0,group.min).forEach(add);refs.forEach(add);
      const beds=Object.keys(game.terrain).filter(k=>game.terrain[k].k==='bed'&&!game.plants[k]?.dailySiteId);
      let i=0;
      for(const ref of chosen.values())for(let n=0;n<3;n++){
        setTile(PLANTS[ref.s].type==='bulb'?'bulbs':'plants',beds[i++],{...ref,d:0,t:Date.now()});
      }
    });
    await page.screenshot({path:path.join(output,name+'-garden.png')});
    await page.locator('#btnMenu').click(); await page.locator('#btnChallenge').click();
    assert(await page.locator('#challengeGoals input').first().isChecked());
    assert.equal(await page.locator('#challengeRules .daily-rule-met').count(),4,'live placement data meets every tracked rule');
    await page.locator('#btnChallengeFinish').click();
    await page.locator('#challengeShare').waitFor({state:'visible'});
    assert.match(await page.locator('#challengeStatus').textContent(),/Finished and saved/);
    const geometry=await page.locator('#challengeScreen .panel').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
    assert(geometry.scroll<=geometry.width+1,'no horizontal overflow'); assert(geometry.top>=0&&geometry.bottom<=viewport.height,'dialog fits viewport');
    await page.locator('#challengeImage').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,name+'-finish.png')});
    const downloaded=page.waitForEvent('download'); await page.locator('#btnChallengeDownload').click();
    const download=await downloaded, file=path.join(output,name+'-share.png'); await download.saveAs(file);
    const png=fs.readFileSync(file); assert.equal(png.readUInt32BE(16),1080); assert.equal(png.readUInt32BE(20),1350);
    await page.locator('#btnChallengeShare').click();
    const shared=await page.evaluate(()=>window.__sharedFile); assert.equal(shared.name,download.suggestedFilename()); assert(shared.size>1000);
    assert.match(await page.locator('#challengeStatus').textContent(),/Finished and saved/,'cancelling the native share dialog is harmless');
    await checkShareOptions(page,name);
    await page.locator('#btnChallengeClose').click(); await page.locator('#btnMenu').click(); await page.locator('#btnQuit').click();
    await page.locator('#btnDaily').click(); await page.waitForFunction(()=>!document.getElementById('btnDailyStart').disabled);
    assert.match(await page.locator('#btnDailyStart').textContent(),/Continue/);
    await page.locator('#btnDailyStart').click(); await page.waitForFunction(id=>game.inGarden&&game.worldId===id,initial.id); await page.locator('#gardenOpening').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>game.worldId),initial.id);
    const saved=await page.evaluate(async()=>{await pendingSaves();return sGet('hortus:world:'+game.worldId);});
    assert.equal(saved.challenge.title,brief); assert(saved.challenge.completedAt); assert.deepEqual(saved.challenge.checked,[0]);
    assert(saved.challenge.strict&&saved.challenge.v===3);assert.deepEqual(saved.challenge.palette,initial.challenge.palette);
    assert.deepEqual(saved.challenge.share,{format:'story',season:'Winter'});
    assert(Object.keys(saved.plants).length>0);
    // A full reload exercises the actual IndexedDB resume path.
    await page.reload({waitUntil:'load'}); await page.locator('#btnDaily').click();
    await page.waitForFunction(()=>!document.getElementById('btnDailyStart').disabled);
    assert.match(await page.locator('#btnDailyStart').textContent(),/Continue/);
    await page.locator('#btnDailyStart').click(); await page.waitForFunction(id=>game.inGarden&&game.worldId===id,initial.id); await page.locator('#gardenOpening').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>game.worldId),initial.id);
    assert.deepEqual(await page.evaluate(()=>game.challenge.share),{format:'story',season:'Winter'});
    assert.equal(await page.evaluate(async()=>{const rows=await migrateLegacyWorld();return rows.filter(r=>r.id===game.worldId).length;}),1,'continue does not duplicate the garden');
    const cache=await page.evaluate(()=>verifyTrayCache()); assert.equal(cache.misses.length,0);
    // A snapshot from the first release keeps its original ID/brief on this
    // same date, rather than becoming a second attempt after a template update.
    await page.evaluate(()=>{
      game.challenge=normalizeDailyChallenge({...game.challenge,v:1,site:'border',id:'old-template',title:'Original saved brief'});
      markModelChanged();
    });
    await page.locator('#btnMenu').click();await page.locator('#btnQuit').click();
    await page.locator('#btnDaily').click();await page.waitForFunction(()=>dailyReady);
    assert.equal(await page.locator('#dailyTitle').textContent(),'Original saved brief');
    assert.match(await page.locator('#btnDailyStart').textContent(),/Continue/);
    assert(await page.locator('#dailyRulesOptions').evaluate(el=>el.classList.contains('hidden')));
    await page.locator('#btnDailyStart').click();await page.waitForFunction(id=>game.inGarden&&game.worldId===id,initial.id);
    assert.equal(await page.evaluate(()=>game.challenge.v),1);
    assert.deepEqual(errors,[]); console.log(name+' curated palette, climate fallback, strict progress, finish, PNG and reload PASS');
  }finally{await context.close();}
}
async function checkSites(browser,url,viewport,isMobile){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile,serviceWorkers:'block'});
  try{
    await context.addInitScript(()=>localStorage.setItem('hortus:welcomed','1'));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    for(const kind of ['woodland','narrow','patio','slope','hollow','gravel','corner']){
      const frozen=await page.evaluate(kind=>{
        dailySelection=Array.from({length:54},(_,i)=>dailyChallengeFor(new Date(2026,8,1+i))).find(c=>c.site===kind);
        dailyResumeId=null;dailyReady=true;dailyCriteria=normalizeFilters({zone:null});renderDailyEntry();show('dailyScreen');
        document.querySelector('#dailyScreen .panel').scrollTop=0;
        return JSON.stringify(dailySelection.sitePlan);
      },kind);
      const prefix=(isMobile?'mobile':'desktop')+'-'+kind;
      await page.locator('#dailySiteCanvas').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,prefix+'-preview.png')});
      const geometry=await page.locator('#dailyScreen .panel').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
      assert(geometry.scroll<=geometry.width+1,kind+' preview fits the panel');
      const alt=await page.locator('#dailySiteCanvas').getAttribute('aria-label');assert(alt.length>50,'site has an accessible explanation');
      if(isMobile)continue;
      await page.locator('#btnDailyStart').click();await page.locator('#gardenOpening').waitFor({state:'hidden'});
      const initial=await page.evaluate(async()=>{
        await pendingSaves();const p=game.challenge.sitePlan;
        return {id:game.worldId,plan:JSON.stringify(p),count:dailyPlantCount(),shape:game.plotShape,
          beds:Object.values(game.terrain).filter(t=>t.k==='bed').length,
          heights:Object.values(game.elevation).map(e=>e.h),trees:Object.values(game.plants).map(p=>plantEstab(p)),
          saved:(await sGet('hortus:world:'+game.worldId)).challenge.sitePlan};
      });
      assert.equal(initial.plan,frozen);assert.equal(JSON.stringify(initial.saved),frozen);
      assert.equal(initial.count,0,'starter alone cannot finish');assert(initial.beds>=80);
      if(kind==='woodland')assert.deepEqual(initial.trees,[1]);
      if(kind==='slope')assert(initial.heights.includes(1)&&initial.heights.includes(2));
      if(kind==='hollow')assert(initial.heights.every(h=>h===-1));
      if(kind==='corner')assert(initial.shape&&initial.shape.length===4);
      await page.screenshot({path:path.join(output,prefix+'-garden.png')});
      await page.locator('#btnMenu').click();await page.locator('#btnChallenge').click();
      await page.locator('#btnChallengeFinish').click();assert.match(await page.locator('#challengeStatus').textContent(),/Add some plants/);
      await page.locator('#btnChallengeReturn').click();
      // Edits travel through real tools, storage and reopening, never the generator.
      const edited=await page.evaluate(async()=>{
        const key=Object.keys(game.terrain).find(k=>game.terrain[k].k==='bed'&&!game.plants[k]),[x,y]=key.split(',').map(Number);
        game.tool='path';applyToolAt(x,y);
        const c=game.challenge;if(c.site==='woodland'){
          selWrite([{x:7,y:9,plant:game.plants['7,9']}],()=>[8,9],true);
        }
        await saveSolo(true);return {key,id:game.worldId,plan:JSON.stringify(c.sitePlan)};
      });
      await page.locator('#btnMenu').click();await page.locator('#btnQuit').click();
      await page.evaluate(id=>enterWorld(id),edited.id);await page.locator('#gardenOpening').waitFor({state:'hidden'});
      const reopened=await page.evaluate(key=>({kind:game.terrain[key].k,plan:JSON.stringify(game.challenge.sitePlan),count:dailyPlantCount()}),edited.key);
      assert.equal(reopened.kind,'path');assert.equal(reopened.plan,edited.plan);assert.equal(reopened.count,0);
      await page.locator('#btnMenu').click();await page.locator('#btnQuit').click();
      console.log(kind+' preview, real starter, edits and saved reopen PASS');
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}
(async()=>{
  let browser;
  try{
    const executablePath=process.env.PP_BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>fs.existsSync(p));
    assert(executablePath,'An installed Chromium browser is required');
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await playwright().chromium.launch({executablePath,headless:true});
    const url='http://127.0.0.1:'+server.address().port;
    await check(browser,url,'desktop',{width:1440,height:900},false);
    await check(browser,url,'phone',{width:390,height:844},true);
    await check(browser,url,'small-phone',{width:320,height:640},true);
    await checkSites(browser,url,{width:1440,height:900},false);
    await checkSites(browser,url,{width:320,height:640},true);
    console.log('Artifacts: '+output);
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
