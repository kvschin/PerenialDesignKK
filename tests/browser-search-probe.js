/* Real DOM checks shared by Chromium and stock Firefox. This file is served
   only by browser-search.cjs; it is not loaded by the application. */
async function runSearchChecks(garden){
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(ok,message)=>{ if (!ok) throw new Error(message); };
  const checks=[], errors=[], artStats={};
  window.addEventListener('error',e=>errors.push(e.message));
  const check=async(name,fn)=>{ await fn(); checks.push(name); };
  if (garden) await enterWorld(await installWorldBlob(garden));
  else {
    document.getElementById('btnDesign').click(); await sleep(100);
    document.getElementById('btnNewWorld').click();
    document.getElementById('btnDesignNext').click();
    document.getElementById('plotName').value='Search regression check';
    document.getElementById('btnPlotStart').click();
  }
  for (let i=0;i<300&&(!game.inGarden||gardenOpening);i++) await sleep(100);
  assert(game.inGarden&&!gardenOpening,'garden opened');
  game.trayCat='grasses'; game.tool='hand';
  setSheetState('full'); setDiscovery({source:'all',category:'grasses',query:'',returnCategory:null});
  buildToolTray(true); await sleep(300);
  let fullBuilds=0, footerBuilds=0, sheetApplications=0, refreshTimes=[];
  const originalBuild=buildToolTrayInner, originalFooter=renderCvRow, originalSheet=applySheetState;
  const originalRefresh=refreshDiscoverySearch;
  buildToolTrayInner=function(...args){ fullBuilds++; return originalBuild(...args); };
  renderCvRow=function(...args){ footerBuilds++; return originalFooter(...args); };
  applySheetState=function(...args){ sheetApplications++; return originalSheet(...args); };
  refreshDiscoverySearch=function(...args){
    const start=performance.now();
    try { return originalRefresh(...args); } finally { refreshTimes.push(performance.now()-start); }
  };
  const input=()=>document.getElementById('trayFind');
  const type=(value,el=input())=>{ el.value=value; el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'})); return el; };
  const resultMarkup=()=>{
    const copy=document.getElementById('toolTray').cloneNode(true);
    // Painting is asynchronous. Compare the requested exact art identity here;
    // dedicated checks below cover visibility, pixels and retained canvases.
    copy.querySelectorAll('.plant-result-art').forEach(art=>{
      const slot=document.createElement('span');slot.dataset.artKey=art.dataset.artKey;art.replaceWith(slot);
    });
    return copy.innerHTML;
  };
  const snapshot=()=>({
    results:resultMarkup(),
    counts:document.querySelector('.discovery-result-count').textContent,
    meta:document.getElementById('catalogMeta').textContent,
    categories:[...document.querySelectorAll('.catalog-category-strip button')].map(b=>[b.dataset.categoryId,b.textContent,b.getAttribute('aria-pressed')])
  });
  const oracle=()=>{
    const actual=JSON.stringify(snapshot()); buildToolTray(true);
    assert(JSON.stringify(snapshot())===actual,'partial results/counts/categories equal a fresh full render');
  };
  try {
    await check('repeated searches retain input, selection, controls and footer',async()=>{
      const find=input(), controls=document.querySelector('.discovery-controls'), source=document.querySelector('.discovery-source');
      const filters=document.querySelector('.discovery-filter-trigger'), strip=document.querySelector('.catalog-category-strip');
      const footer=[...document.getElementById('brushBar').childNodes];
      const height=document.querySelector('.hud-bottom').getBoundingClientRect().height;
      find.focus();
      for (const query of ['cone','coneflower','grass','carex','a','zzzz-no-plant','oak','']){
        type(query,find); const end=Math.min(3,query.length), start=Math.min(1,end);
        find.setSelectionRange(start,end,'backward'); await sleep(220);
        assert(input()===find,'query must retain the original input');
        assert(document.activeElement===find,'input focus is retained');
        assert(find.selectionStart===start&&find.selectionEnd===end,'caret/selected range is retained');
        if (start!==end) assert(find.selectionDirection==='backward','backward selection is retained');
        assert(document.querySelector('.discovery-controls')===controls&&document.querySelector('.discovery-source')===source&&document.querySelector('.discovery-filter-trigger')===filters,'controls remain mounted');
        assert(document.querySelector('.catalog-category-strip')===strip,'category scroller remains mounted');
        assert(footer.every((node,i)=>document.getElementById('brushBar').childNodes[i]===node),'placement footer nodes remain mounted');
        assert(Math.abs(document.querySelector('.hud-bottom').getBoundingClientRect().height-height)<1,'sheet height stays fixed');
      }
      assert(fullBuilds===0&&footerBuilds===0&&sheetApplications===0,'typing never rebuilds the panel/footer or reapplies the sheet');
      assert(activeDiscovery().category==='grasses','clearing returns to the original category');
      assert(buildToolTray()===false,'partial render updates the normal rebuild guard');
      oracle();
    });
    await check('query counts, empty states and categories match full renders',async()=>{
      for (const query of ['a','coneflower','zzzz-no-plant','daffodil','']){
        type(query); await sleep(220); oracle();
      }
    });
    await check('Escape and native clear retain input and restore browsing',async()=>{
      let find=type('carex'); find.focus(); await sleep(220);
      find.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      assert(input()===find&&find.value===''&&document.activeElement===find,'Escape clears in place');
      assert(activeDiscovery().category==='grasses','Escape restores browse category');
      type('oak',find); await sleep(220); type('',find); await sleep(220);
      assert(input()===find&&activeDiscovery().category==='grasses','clearing the search control restores browsing');
    });
    await check('delayed search never steals focus',async()=>{
      const find=type('carex'); find.focus();
      const filters=document.querySelector('.discovery-filter-trigger'); filters.focus();
      await sleep(220);
      assert(document.activeElement===filters&&input()===find,'debounce must not refocus the input');
    });
    await check('IME waits for completed composition',async()=>{
      const find=input(); find.focus(); const before=refreshTimes.length;
      find.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      find.value='hosta'; find.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
      await sleep(220); assert(refreshTimes.length===before,'no refresh during composition');
      find.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,isComposing:true}));
      assert(find.value==='hosta','IME Escape is left to the composition');
      find.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'hosta'}));
      await sleep(220); assert(input()===find&&activeDiscovery().query==='hosta','completed composition searches in place');
      oracle();
    });
    await check('palette and bloom filters survive typing and clearing',async()=>{
      const palette=createPlantPalette('Search check',allPlantRefs().filter(ref=>!ref.v).slice(0,30));
      setDiscovery({source:'palette',collectionId:palette.id,query:'',category:null,returnCategory:null,colorFamilies:['purple'],bloomSeasons:['Summer']});
      buildToolTray(true); await sleep(30);
      const find=input();
      assert(document.querySelectorAll('.qf-pill').length===2,'the two filters show as pills');
      for (const query of ['a','zzzz-no-plant','']){
        type(query,find); await sleep(220);
        assert(input()===find&&document.querySelectorAll('.qf-pill').length===2,'palette filter controls persist');
        assert(activeDiscovery().collectionId===palette.id&&activeDiscovery().bloomSeasons[0]==='Summer','query leaves palette and bloom filters alone');
      }
      oracle(); deletePlantPalette(palette.id);
      setDiscovery({source:'all',collectionId:null,query:'',category:'grasses',returnCategory:null,colorFamilies:[],bloomSeasons:[]}); buildToolTray(true);
    });
    await check('the Filters tray applies each chip as it is pressed, and the garden criteria keep a dialog',async()=>{
      setDiscovery({source:'all',collectionId:null,query:'',category:null,returnCategory:null,colorFamilies:[],bloomSeasons:[],light:[],moisture:[],filterOpen:false});
      if (mobileSheetUi()) setSheetState('full');
      buildToolTray(true); await sleep(60);
      const trigger=()=>document.querySelector('.discovery-filter-trigger'), chip=key=>document.querySelector('[data-qf="'+key+'"]'), box=el=>el.getBoundingClientRect();
      assert(!document.querySelector('.qf-tray')&&!document.querySelector('.qf-active'),'with nothing on and the tray shut it takes no room');
      trigger().click(); await sleep(80);
      assert(document.querySelector('.qf-tray')&&trigger().getAttribute('aria-expanded')==='true','the button opens the tray, and says so');
      assert(document.activeElement===chip('light:full'),'focus lands on its first chip');
      const whole=box(document.querySelector('.qf-tray'));
      assert(whole.width>0&&whole.top>=0&&whole.bottom<=innerHeight+1,'and the whole tray is on screen');
      assert(document.querySelectorAll('.qf-chip[data-qf^="light:"]').length===2,'two light chips');
      assert(document.querySelectorAll('.qf-chip[data-qf^="moisture:"]').length===3,'three water chips');
      const dot=box(chip('colorFamilies:pink').querySelector('i'));
      assert(dot.width>=10&&dot.height>=10,'a flower colour is a dot, on a mouse as well as a finger');
      const before=discoveryRefs().length;
      chip('light:part').click(); await sleep(80);
      assert(chip('light:part').getAttribute('aria-pressed')==='true','the chip reports it is on');
      assert(document.activeElement===chip('light:part'),'and keeps focus through the rebuild its press caused');
      assert(activeDiscovery().light[0]==='part'&&discoveryRefs().length<before,'it applies at once: the list is already shorter');
      chip('moisture:dry').click(); await sleep(80);
      assert(document.querySelector('.qf-tray'),'the tray stays open between presses');
      assert(document.querySelector('.discovery-filter-trigger .filter-count').textContent==='2','the button counts them');
      // a card no longer spells out its site (that is in the chosen plant's detail), so ask the plants
      const left=discoveryRefs().map(refDef);
      assert(document.querySelectorAll('#toolTray .plant-result-card').length>0&&left.length>0
        &&left.every(P=>P.sun==='part'&&P.moist==='dry'&&!P.wades&&P.type!=='water'),'every plant it leaves is for part shade and low water');
      trigger().click(); await sleep(80);
      assert(!document.querySelector('.qf-tray')&&document.querySelectorAll('.qf-pill').length===2,'shut, the two show as pills');
      assert(document.activeElement===trigger(),'and focus is back on the button');
      document.querySelector('.qf-pill').click(); await sleep(80);
      assert(activeDiscovery().light.length===0&&activeDiscovery().moisture[0]==='dry','a pill removes its own filter and no other');
      // nothing left to show: the way out drops the filters and keeps the search
      setDiscovery({source:'all',collectionId:null,category:null,query:'zzzznotathing',light:['part'],moisture:['dry']}); buildToolTray(true); await sleep(30);
      const reset=[...document.querySelectorAll('#toolTray button')].find(b=>b.textContent==='Clear filters');
      assert(reset,'an empty catalog offers to clear them');
      reset.click(); await sleep(60);
      assert(activeDiscovery().light.length===0&&activeDiscovery().moisture.length===0,'and that clears them');
      assert(activeDiscovery().query==='zzzznotathing','leaving the search that was typed');
      // what the garden asks is a dialog of its own, with its action on screen
      setDiscovery({query:'',filterOpen:true}); buildToolTray(true); await sleep(30);
      document.querySelector('.qf-foot .qf-link:last-child').click(); await sleep(260);
      const screen=document.getElementById('discoveryFilterScreen'), apply=document.getElementById('btnDiscoveryApply');
      assert(!screen.classList.contains('hidden'),'the foot of the tray opens the garden criteria');
      assert(box(apply).height>0&&box(document.querySelector('.gc-foot')).bottom<=innerHeight+1,'its one action is on screen, not below a scroll');
      assert(/^Show \d+ plants?$/.test(apply.textContent),'and says what it will show: '+apply.textContent);
      const was=activeFilters().nativeMode, next=was==='straight'?'any':'straight', said=apply.textContent;
      document.querySelector('#discoveryNativeMode [data-v="'+next+'"]').click(); await sleep(40);
      assert(document.querySelector('#discoveryNativeMode [data-v="'+next+'"]').getAttribute('aria-checked')==='true','a choice is taken');
      assert(apply.textContent!==said,'and the count moves before anything is applied');
      assert(activeFilters().nativeMode===was,'while the garden is unchanged');
      document.getElementById('btnDiscoveryClose').click(); await sleep(40);
      assert(screen.classList.contains('hidden')&&activeFilters().nativeMode===was,'closing changes nothing');
      setDiscovery({source:'all',collectionId:null,query:'',category:'grasses',returnCategory:null,filterOpen:false}); buildToolTray(true); await sleep(30);
    });
    await check('Sedges, grasses and shade perennials list by site, and a search flattens the list in place',async()=>{
      setDiscovery({source:'all',collectionId:null,query:'',category:'sedges',returnCategory:null,colorFamilies:[],bloomSeasons:[]});
      buildToolTray(true); await sleep(30);
      const heads=()=>document.querySelectorAll('#toolTray .discovery-site-head').length;
      assert(heads()===SEDGE_SITES.length,'every site has its heading');
      const find=type('carex'); await sleep(220);
      assert(heads()===0&&input()===find,'a search draws one list and keeps the input');
      type('',find); await sleep(220);
      assert(heads()===SEDGE_SITES.length&&activeDiscovery().category==='sedges','clearing returns to the sites');
      oracle();
      setDiscovery({source:'all',collectionId:null,query:'',category:'grasses',returnCategory:null});
      buildToolTray(true); await sleep(30);
      assert(heads()===GRASS_SITES.length,'grasses list by site too');
      setDiscovery({source:'all',collectionId:null,query:'',category:'shadeper',returnCategory:null});
      buildToolTray(true); await sleep(30);
      assert(heads()===SHADE_SITES.length,'and the shade perennials');
      setDiscovery({source:'all',collectionId:null,query:'',category:'sunper',returnCategory:null});
      buildToolTray(true); await sleep(30);
      assert(heads()===0,'other tabs draw one list');
      setDiscovery({source:'all',collectionId:null,query:'',category:'grasses',returnCategory:null});
      buildToolTray(true); await sleep(30);
    });
    await check('starting a query exits cultivar drill-in and resets paging',async()=>{
      setDiscovery({category:null,query:'',limit:72}); buildToolTray(true);
      const family=document.querySelector('.plant-family-card .pc-main'); assert(family,'a family is available'); family.click();
      await sleep(50); assert(document.querySelector('.cultivar-drill-back'),'family drill-in opens');
      const find=type('a'); await sleep(220);
      assert(input()===find&&!document.querySelector('.cultivar-drill-back'),'query returns to matching families');
      assert(activeDiscovery().limit===36,'a new query resets paging'); oracle();
    });
    await check('unrelated state changes still receive a full render',async()=>{
      const find=type('carex'); find.focus(); find.setSelectionRange(1,3,'backward');
      const before=fullBuilds; game.filters={...game.filters,deer:!game.filters.deer};
      await sleep(220);
      assert(fullBuilds===before+1,'an eligibility change invalidates the narrow refresh');
      assert(input().selectionStart===1&&input().selectionEnd===3&&input().selectionDirection==='backward','fallback preserves selection'); oracle();
    });
    await check('mode changes cancel searches from retired inputs',async()=>{
      const old=type('oak');
      [...document.querySelectorAll('.catalog-mode button')].find(b=>b.textContent==='Landscape').click();
      const landscape=document.getElementById('landscapeFind'); landscape.focus();
      const before=fullBuilds; await sleep(250);
      assert(!old.isConnected&&document.activeElement===landscape,'retired input cannot reclaim focus');
      assert(fullBuilds===before,'retired input cannot rebuild the new mode');
    });
    const visibleArtwork=()=>{
      const tray=document.getElementById('toolTray'), box=tray.getBoundingClientRect();
      return [...tray.querySelectorAll('.plant-result-art')].filter(art=>{
        const rect=art.getBoundingClientRect();
        return rect.bottom>Math.max(box.top,0)&&rect.top<Math.min(box.bottom,innerHeight)&&rect.right>box.left&&rect.left<box.right;
      });
    };
    const waitForArt=async()=>{
      for(let i=0;i<80;i++){
        const visible=visibleArtwork();
        if(visible.length&&visible.every(art=>art.tagName==='CANVAS'))return;
        await sleep(25);
      }
      assert(false,'visible cards receive their artwork');
    };
    await check('cold thumbnails are deferred and warm searches retain visible canvases',async()=>{
      game.trayCat='sunper';game.tool='hand';game.filters=normalizeFilters({zone:6});
      setDiscovery({source:'all',collectionId:null,query:'a',category:null,returnCategory:null,colorFamilies:[],bloomSeasons:[],limit:72});
      TRAY_ART.clear();buildToolTray(true);await waitForArt();
      const tray=document.getElementById('toolTray');
      const total=tray.querySelectorAll('.plant-result-art').length, cold=tray.querySelectorAll('canvas.plant-result-art').length;
      assert(cold>0&&cold<total,'cold view paints only visible/nearby cards');
      assert(tray.querySelectorAll('span.plant-result-art').length>0,'offscreen cards allocate no canvas');
      Object.assign(artStats,{total,coldCanvases:cold});
      const original=new Map([...tray.querySelectorAll('canvas.plant-result-art')].map(canvas=>[canvas.dataset.artKey,{canvas,pixels:canvas.toDataURL()}]));
      const baked=TRAY_ART.size;
      type(' a ');await sleep(220);await waitForArt();
      assert(TRAY_ART.size===baked,'equivalent warm query bakes no artwork');
      visibleArtwork().forEach(canvas=>{
        const before=original.get(canvas.dataset.artKey);
        assert(before&&before.canvas===canvas,'matching visible card retains its actual canvas');
        assert(before.pixels===canvas.toDataURL(),'retained canvas keeps the same pixels');
      });
      artStats.warmNewCanvases=TRAY_ART.size-baked;
      tray.scrollTop=tray.scrollHeight;await waitForArt();
      assert(TRAY_ART.size>baked,'scrolling paints newly exposed cards');
      artStats.afterScrollCanvases=TRAY_ART.size;
      const retired=[...discoveryArtView.canvases];
      type('zzzz-no-plant');await sleep(220);
      assert(retired.every(canvas=>canvas.parentNode===null),'cached canvases do not retain old detached card trees');
      assert(TRAY_ART.size<=TRAY_ART_MAX,'bitmap cache stays bounded');
    });
    await check('collapsed catalogs defer artwork and reopen without blank visible cards',async()=>{
      setDiscovery({query:'a',category:null});setSheetState('collapsed');TRAY_ART.clear();buildToolTray(true);await sleep(300);
      assert(discoveryArtView.canvases.size===0&&TRAY_ART.size===0,'hidden catalog does not bake thumbnails');
      // The handle expands without rebuilding the catalog.
      const find=input();setSheetState('full');await sleep(300);await waitForArt();
      assert(input()===find,'expanding resumes pending thumbnails without a rebuild');
    });
    await check('thumbnail fallback paints correctly without IntersectionObserver',async()=>{
      const observer=window.IntersectionObserver;
      try {
        window.IntersectionObserver=undefined;buildToolTray(true);
        const tray=document.getElementById('toolTray');
        assert(tray.querySelectorAll('canvas.plant-result-art').length>0,'fallback paints cards immediately');
        assert(!tray.querySelector('span.plant-result-art'),'fallback leaves no blank art placeholders');
      } finally {window.IntersectionObserver=observer;buildToolTray(true);}
      await waitForArt();
    });
    assert(!errors.length,'no browser errors: '+errors.join('; '));
    return {passed:true,checks,ua:navigator.userAgent,viewport:[innerWidth,innerHeight],refreshTimes,artStats,errors};
  } finally {
    buildToolTrayInner=originalBuild; renderCvRow=originalFooter; applySheetState=originalSheet; refreshDiscoverySearch=originalRefresh;
  }
}
