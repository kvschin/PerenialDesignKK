'use strict';
(async()=>{
  const profile=new URLSearchParams(location.search).get('profile');
  const out={profile,viewport:[innerWidth,innerHeight],reportedDpr:devicePixelRatio,userAgent:navigator.userAgent,hidden:document.hidden,measurements:{}};
  const raf=()=>new Promise(window.__auditRaf);
  const status=s=>parent.postMessage({status:profile+': '+s},location.origin);
  const stats=a=>{const s=a.slice().sort((a,b)=>a-b);return {n:s.length,mean:+(s.reduce((a,b)=>a+b,0)/s.length).toFixed(2),p50:+s[Math.floor(s.length*.5)].toFixed(2),p95:+s[Math.min(s.length-1,Math.floor(s.length*.95))].toFixed(2),max:+s[s.length-1].toFixed(2)}};
  const sync=(name,fn,n=7)=>{const times=[];for(let i=0;i<n;i++){const t=performance.now();fn();times.push(performance.now()-t)}out.measurements[name]=stats(times)};
  const frames=async(name,fn,n=36)=>{status(name);for(let i=0;i<5;i++){await raf();fn(performance.now(),i)}const times=[],gaps=[];let prev=null;for(let i=0;i<n;i++){const t=await raf();if(prev!==null)gaps.push(t-prev);prev=t;const start=performance.now();fn(t,i);times.push(performance.now()-start)}out.measurements[name]={jsMs:stats(times),rafGapMs:stats(gaps),sprites:PSPRITE.active,plantSprites:PSPRITE.map.size,plantMiB:+(PSPRITE.bytes/1048576).toFixed(2)}};
  const resetSprites=()=>{PSPRITE.map.clear();PSPRITE.slot.clear();PSPRITE.bytes=0;PSPRITE.active=false;PSPRITE.hot=0;PSPRITE.calm=0;PSPRITE.plantMs=0;PSPRITE.off=false;};
  const empty=()=>{for(const k of ['plants','bulbs','terrain','elevation','fences','lights','firepits','boulders','pets','pots','seats'])game[k]={};game.houses=[];game.buildings=[];game.schemes=[];game.schemeActive=null;game.underlay=null;game.sel=null;game.selItems=null;selMove=null;game.layerVis={};game.previewMode='established';game.inGarden=true;game.ffActive=false;game.fx=[];game.shrubFx=[];setWorldSize(31,31);markModelChanged();markGroundChanged({terrain:true});game.sceneRev++;game.plantsRev++;resetSprites();};
  try{
    await new Promise(r=>setTimeout(r,600));crashed=true;hasStorage=false;
    status('menu and library');
    await frames('menu-render',t=>menuRender(t),24);
    sync('library-open',()=>openLibrary(),5);
    out.libraryRowsOnOpen=document.querySelectorAll('.lib-item').length;
    sync('library-sun-category',()=>openLibraryCategory('sunper'),5);
    sync('library-broad-search',()=>buildLibraryResults('a'),5);
    out.libraryBroadRows=document.querySelectorAll('.lib-item').length;
    out.menuCanvasStyle={display:getComputedStyle(mcnv).display,visibility:getComputedStyle(mcnv).visibility};
    let draws=0;const origMenu=menuRender;menuRender=function(t){draws++;return origMenu(t)};
    game.inGarden=false;lastMenuRender=-Infinity;for(let i=0;i<60;i++)frame(100000+i*1000/60);menuRender=origMenu;out.menuFramesBehindLibraryPer60Calls=draws;
    empty();enterGarden();
    status('furnished garden');
    out.groundBench=perfBench({gw:46,gh:46,rounds:7,edit:true});dbg.on=false;game.dirty=false;
    await frames('furnished-stationary',t=>render(t));
    const origX=cam.x;
    await frames('furnished-pan', (t,i)=>{cam.x=origX+Math.sin(i/35*Math.PI*2)*350;render(t)},48);
    cam.x=origX;
    empty();enterGarden();fitPlot();
    const herbs=PLANT_KEYS.filter(k=>!PLANTS[k].hidden&&PLANTS[k].type==='forb'&&PLANTS[k].sun==='full');
    for(let i=0;i<500;i++)setTile('plants',(i%25)+','+Math.floor(i/25),{s:herbs[i%herbs.length],d:absDay()-100,t:i});
    await frames('500-plants-normal',t=>render(t));
    game.sel={x0:0,y0:0,x1:24,y1:19};game.selItems=selectionPayload(game.sel);
    await frames('500-plants-selected',t=>render(t),24);
    selMove={curX:1,curY:1,grabX:0,grabY:0,copy:false};
    await frames('500-plants-moving',t=>render(t),24);
    selMove=null;game.sel=null;game.selItems=null;
    empty();enterGarden();fitPlot();
    const trees=PLANT_KEYS.filter(k=>!PLANTS[k].hidden&&PLANTS[k].type==='tree');
    for(let i=0;i<36;i++)setTile('plants',(3+(i%6)*4)+','+(3+Math.floor(i/6)*4),{s:trees[i%trees.length],d:absDay()-20000,t:i});
    await frames('36-mature-trees-default',t=>render(t));
    const origGovernor=updateSpriteMode;updateSpriteMode=()=>{PSPRITE.active=true};PSPRITE.active=true;
    await frames('36-mature-trees-forced-cache',t=>render(t));
    updateSpriteMode=origGovernor;
    if(profile==='desktop'){
      status('regional catalog draw recipes');
      const c=document.createElement('canvas');c.width=1600;c.height=1600;const ctx=c.getContext('2d');ctx.translate(800,1450);ctx.scale(.7,.7);
      const per=[];for(const k of PLANT_KEYS){if(PLANTS[k].hidden)continue;const times=[];for(let j=0;j<4;j++){const t=performance.now();drawPlant(ctx,0,0,k,1,'Summer',libSeed(k),0,null,1);times.push(performance.now()-t)}per.push({key:k,type:PLANTS[k].type,nativeTo:PLANTS[k].nativeTo,jsMs:stats(times).mean});if(per.length%40===0)await raf()}
      out.catalogDraw=per;out.visibleSpecies=per.length;
    }
    out.canvas={width:cnv.width,height:cnv.height,dpr:DPR,zoom:ZOOM};out.hiddenEnd=document.hidden;
  }catch(e){out.error=e.stack||String(e)}
  status('saving results');await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(out)});parent.postMessage('done',location.origin);
})();
