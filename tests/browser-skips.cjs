'use strict';
/* Exact first-frame skip checks in disposable browser contexts. Timings are
   diagnostic JS work, not physical-device FPS. No dependencies are installed. */
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), http=require('node:http');
const root=path.resolve(__dirname,'..');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-prairie-skips-'));
function playwright(){
  const candidates=process.env.PLAYWRIGHT_MODULE_PATH?[process.env.PLAYWRIGHT_MODULE_PATH]:[
    'playwright','playwright-core',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')];
  for (const p of candidates){try{return require(p);}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}}
  throw Error('An existing Playwright installation is required; see docs/browser-release-checks.md.');
}
function executable(){
  if(process.env.PP_BROWSER_PATH)return process.env.PP_BROWSER_PATH;
  const candidates=process.platform==='win32'?[
    path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe')
  ]:process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:
    ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'];
  return candidates.find(p=>fs.existsSync(p));
}
async function serve(){
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
    '.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,name==='/'?'index.html':name.replace(/^\//,''));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,bytes)=>{
      if(error){res.writeHead(404);res.end();return;}
      if(file===path.join(root,'index.html'))bytes=Buffer.from(String(bytes).replace("if ('serviceWorker' in navigator)",'if (false)'));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(bytes);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port+'/'};
}
async function exercise(scenario){
  const check=(ok,message)=>{if(!ok)throw Error(scenario+': '+message);};
  await enterWorld(await installWorldBlob(await(await fetch('/demo-garden.json')).json()));
  crashed=true; finishGardenOpen(); cancelPendingSkip();
  game.pausedAt=Date.now(); game.clockSuspended=true; game.ffActive=false;
  const stress=scenario==='clock-boundary'||scenario==='day-reuse';
  if(stress){
    setWorldSize(69,69); snapCam(); const random=Math.random; Math.random=mulberry(4729);
    try{stressGarden();}finally{Math.random=random;}
    markModelChanged();
  }
  game.previewMode=['today-year','four-seasons','photo-year'].includes(scenario)?'today':'established';
  game.dayOffset=0; game.elapsedMs=(game.previewMode==='today'?14:24)*DAY_MS;
  // Pin the sprite path being checked; browser heuristics must not hide a miss.
  updateSpriteMode=()=>{}; PSPRITE.active=true; PSPRITE.off=false;
  const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  for(let i=0;i<90;i++)render(await raf());
  check(cnv.width>200&&cnv.height>200,'a real viewport is required');
  check(getComputedStyle(cnv).visibility==='visible'&&cnv.getBoundingClientRect().width>200,
    'the opening screen must not leave the measured canvas hidden');
  if(scenario==='day-reuse'){
    const oldScene=scene, oldShade=ensureShadeMap(); game.elapsedMs=25*DAY_MS;
    const t=await raf(), start=performance.now(); render(t); const js=performance.now()-start;
    check(scene===oldScene,'an unchanged Established day rebuilt the scene');
    check(ensureShadeMap()===oldShade,'an unchanged Established day rebuilt shade');
    return {scenario,plants:Object.keys(game.plants).length,dayFrameJs:js,sceneReused:true,shadeReused:true};
  }
  let wanted=null, stale=0, draws=0, doneCalls=0;
  const draw=drawPlantMaybeCached, blit=blitPlantSprite, request=requestSkipTo;
  drawPlantMaybeCached=function(ctx,bx,by,key,growth,season,seed,sway,v,detail,use,rec){
    wanted=rec.kSlot+'|'+gbucket(growth,9)+'|'+(rec.hasBloom?gbucket(bloomLevel(key,v),4):0)+rec.kTail;
    draws++; try{return draw.apply(this,arguments);}finally{wanted=null;}
  };
  blitPlantSprite=function(ctx,e){if(wanted&&PSPRITE.map.get(wanted)!==e)stale++;return blit.apply(this,arguments);};
  requestSkipTo=function(day,done){return request(day,()=>{doneCalls++;done();});};
  const running=scenario==='clock-boundary';
  if(running){
    game.elapsedMs=32*DAY_MS-200; game.startTs=Date.now(); game.pausedAt=0;
    game.clockSuspended=false; game.ffActive=true;
  }
  let target=game.previewMode==='today'?64:32;
  if(scenario==='four-seasons')for(let i=0;i<4;i++)skipNextSeason();
  else requestSkipTo(target,()=>{});
  const originalDay=absDay(), originalPaused=game.pausedAt;
  check(skipPending(),'every visible destination must prepare');
  const budget=AHEAD.SKIP_MS; AHEAD.SKIP_MS=0;
  const heldPixels=cnv.toDataURL(); render(await raf());
  check(cnv.toDataURL()===heldPixels,'a partial preparation changed the held image');
  const held=skipPreparation.cv;
  if(running)await new Promise(resolve=>setTimeout(resolve,250)); // cross the old clock's boundary
  if(scenario==='retarget-edit'){
    skipNextSeason(); target=48;
    check(held.width===0,'retargeting did not release the abandoned snapshot');
    ZOOM*=1.2; cam.x+=70; game.rot=(game.rot+1)%4; game.layerVis.night=true;
    game.previewMode='today'; cnv.width+=31; cnv.height+=19;
    setTile('plants','15,15',{s:'bluestem',d:-400,t:1});
  }
  AHEAD.SKIP_MS=budget;
  const prep=[], sceneBatches=[]; let landing=null;
  for(let i=0;i<600&&skipPending();i++){
    const t=await raf();
    if(scenario==='photo-year'&&i===2){
      game.photo=true; try{render(t);}finally{game.photo=false;}
    }
    stale=0; draws=0;
    const sceneWork=!!(skipPreparation&&skipPreparation.build), start=performance.now();
    if(running)frame(t);else render(t);
    const js=performance.now()-start;
    if(skipPending()){
      check(absDay()===originalDay,'the clock overtook its pending destination');
      check(draws===0,'unfinished artwork was drawn onto the held view');
      prep.push(js); if(sceneWork)sceneBatches.push(js);
    }else{
      check(absDay()===target,'the skip landed on the wrong day');
      check(stale===0,'the destination revealed '+stale+' outdated sprites');
      check(PSPRITE.bakeMs===0,'landing had to repair missing plant artwork');
      check(SSPRITE.rendered===0,'landing had to repair missing structure artwork');
      landing={js,draws,stale};
    }
  }
  check(landing&&doneCalls===1,'the final destination must finish exactly once');
  check(!skipPreparation&&!game.skipClockHeld,'temporary preparation state was not released');
  check(game.pausedAt===originalPaused,'preparation changed the user pause control');
  if(running)check(clockActive()&&game.ffActive,'the running/fast-forward controls were not preserved');
  game.elapsedMs=elapsedGameMs(); game.startTs=Date.now(); game.pausedAt=Date.now();
  game.clockSuspended=true; game.ffActive=false;
  for(let i=0;i<3;i++){stale=0;render(await raf());check(stale===0,'the frame after landing used outdated artwork');}
  check(groundKeyStruct===groundStructKey(calClock().season,game.rot),'ground and planting disagree on the destination');
  // Compare the adopted scene/shade with a fresh synchronous calculation.
  const sceneRecord=(k,v)=>k==='aheadFor'||k==='_spec'?undefined:v;
  const sceneJson=JSON.stringify(scene.ents,sceneRecord);
  const shadeJson=JSON.stringify(shadeMapCache); resetShadeMapCache(); buildScene(VW/ZOOM,VH/ZOOM);
  check(JSON.stringify(scene.ents,sceneRecord)===sceneJson,'prepared scene differs from a fresh build');
  check(JSON.stringify(shadeMapCache)===shadeJson,'prepared shade differs from a fresh build');
  return {scenario,plants:Object.keys(game.plants).length,prepFrames:prep.length,
    maxPrepJs:Math.max(0,...prep),sceneBatchFrames:sceneBatches.length,maxSceneBatchJs:Math.max(0,...sceneBatches),landing};
}
(async()=>{
  const {server,url}=await serve(); let browser;
  const report={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,checks:[]};
  try{
    browser=await playwright().chromium.launch({headless:true,executablePath:executable()});
    for(const profile of [
      {name:'desktop',viewport:{width:1280,height:900},deviceScaleFactor:1},
      {name:'phone',viewport:{width:390,height:844},deviceScaleFactor:1.5,hasTouch:true}
    ])for(const scenario of ['today-year','four-seasons','photo-year','clock-boundary','day-reuse','retarget-edit']){
      const {name,...options}=profile, context=await browser.newContext(options), page=await context.newPage();
      await context.addInitScript(()=>localStorage.setItem('hortus:welcomed','1'));
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.goto(url,{waitUntil:'load'}); await page.evaluate(()=>document.fonts.ready);
        const result=await page.evaluate(exercise,scenario);
        if(errors.length)throw Error(errors.join('\n'));
        if(scenario==='today-year'||scenario==='clock-boundary')
          await page.screenshot({path:path.join(output,name+'-'+scenario+'.png')});
        report.checks.push({profile:name,...result}); console.log(JSON.stringify(report.checks.at(-1)));
      }catch(e){
        await page.screenshot({path:path.join(output,name+'-'+scenario+'.png')}).catch(()=>{});
        throw e;
      }finally{await context.close();}
    }
  }finally{
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
    if(browser)await browser.close(); await new Promise(resolve=>server.close(resolve));
    console.log('Skip check results: '+output);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
