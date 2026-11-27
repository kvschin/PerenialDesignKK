'use strict';
/* ---------- plant library: browse every species ---------- */
/* The catalog's plant categories, in the catalog's order. This was a copy of that
   table, and when Climbers joined the catalog the copy did not, so the library
   could not show a single climber. */
const LIB_CATS=TRAY_GROUPS.find(g=>g.id==='plants').cats.map(id=>TRAY_CATS.find(c=>c.id===id));
const LIB_OPEN_KEY='pocketprairie:libraryOpen';   // a stored key from the old name: renaming it would forget the setting
let libCollapsed=loadLibraryCollapsed();
function loadLibraryCollapsed(){
  try { return JSON.parse(localStorage.getItem(LIB_OPEN_KEY)||'{}')||{}; }
  catch(e){ return {}; }
}
function saveLibraryCollapsed(){
  try { localStorage.setItem(LIB_OPEN_KEY, JSON.stringify(libCollapsed)); }
  catch(e){}
}
function libraryCatKeys(cat){
  return PLANT_KEYS.filter(k=>{
    const P=PLANTS[k];
    return P && !P.hidden && cat.types.includes(P.type) && (!cat.sunFilter || P.sun===cat.sunFilter);
  });
}
function libraryCatById(id){ return LIB_CATS.find(c=>c.id===id)||null; }
function libraryCatFor(key){
  const P=PLANTS[key]; if (!P) return null;
  return LIB_CATS.find(c=>c.types.includes(P.type) && (!c.sunFilter || P.sun===c.sunFilter))||null;
}
/* Every key the library can show, in category order. The search result set is
   built from THIS rather than from PLANT_KEYS, so a species belonging to no
   category cannot surface in the results and then be unreachable by browsing. */
function libraryAllKeys(){
  const out=[], seen=new Set();
  LIB_CATS.forEach(c=>libraryCatKeys(c).forEach(k=>{ if (!seen.has(k)){ seen.add(k); out.push(k); } }));
  return out;
}
function libSeed(key){ let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0; return h||7; }
function libraryBloomText(P){
  const months=bloomMonthsFor(P);
  if (!months.length) return 'Not recorded';
  const runs=[];
  for(let i=0;i<months.length;){
    let j=i;
    while(j+1<months.length && months[j+1]===months[j]+1) j++;
    runs.push(i===j ? CAL_MONTH_LABELS[months[i]-1] : `${CAL_MONTH_LABELS[months[i]-1]}–${CAL_MONTH_LABELS[months[j]-1]}`);
    i=j+1;
  }
  return runs.join(', ');
}
function libraryPreviewSeason(P){ return SEASONS.find(s=>P.sea&&P.sea[s]&&P.sea[s].bloom)||'Summer'; }
/* maxScale is how far a small plant may be enlarged to fill its tile. 1.15 is
   right for the authored 80x104 tile and the list's thumbnails; the wide
   detail's tiles are up to twice that size and pass a cap to match, or a
   12-inch sedge would sit as a speck at the foot of each one. */
function libCanvasBlank(w,h){
  const c=document.createElement('canvas'); c.width=w*2; c.height=h*2;
  c.style.width=w+'px'; c.style.height=h+'px';
  return c;
}
function paintLibCanvas(c,key,variant,season,w,h,maxScale=1.15){
  const ctx=c.getContext('2d'); if (!ctx) return c;
  ctx.setTransform(2,0,0,2,0,0);
  const P=plantDef(key,variant), L=P.look||{}, drawH=(plantArtTop(P)||40)*1.3+12;
  const authoredW=(plantVisualH(P)||40)*Math.max(0,L.sideScale||0)*2+8;
  /* A tree or shrub is fitted to the tile's WIDTH as well. Only plants that
     author a sideScale were, and a crown is often wider than the plant is tall:
     a white oak was cut off on both sides of its tile, at every size. Its width
     is the sprite box's, less that box's own padding. */
  const woodyW=isWoodyDef(P) ? (plantDrawBox(P,key,1).halfW-18)*2+6 : 0;
  const fitW=Math.max(authoredW>8?authoredW:0,woodyW);
  const sc=Math.min(maxScale,h/drawH,fitW>0?w/fitW:maxScale);
  ctx.save(); ctx.translate(w/2,h-5); ctx.scale(sc,sc);
  drawPlant(ctx,0,0,key,1,season,libSeed(key),0,variant,1);
  ctx.restore();
  return c;
}
function libCanvas(key,variant,season,w,h,maxScale=1.15){
  return paintLibCanvas(libCanvasBlank(w,h),key,variant,season,w,h,maxScale);
}
/* ---------- row thumbnails, drawn as they come into view ----------
   A row's picture is a drawPlant into its own canvas, and the list drew every
   one of them before the library appeared. That was 156ms when it was measured
   at 473 plants. At 811, with trees and shrubs drawn in far more detail, the
   same loop measured 450-680ms on a desktop, in the task of the click that
   opened the library, and again on every open. A row costs the same at any
   thumbnail size: it is the plant's paths, not its pixels.

   So a row is built with an empty canvas of the right size and the picture is
   drawn when the row nears the list's viewport, a few ms of them per frame, so
   a fast scroll through the trees does not stall either. Where there is no
   IntersectionObserver (the test sandbox) every row is drawn as it is built,
   which is what it always did. A canvas that has left the list by the time its
   turn comes is skipped. */
const LIB_THUMB_W=40, LIB_THUMB_H=48, LIB_THUMB_SCALE=1.5, LIB_THUMB_MS=4;
const libThumbQueue=[];
let libThumbObserver=null, libThumbFrame=0;
function libraryThumbPaint(c){
  if (c.dataset.drawn) return;
  c.dataset.drawn='1';
  const k=c.dataset.k, P=PLANTS[k]; if (!P) return;
  paintLibCanvas(c,k,null,libraryPreviewSeason(P),LIB_THUMB_W,LIB_THUMB_H,LIB_THUMB_SCALE);
}
function libraryThumbStep(){
  libThumbFrame=0;
  const t0=performance.now();
  while (libThumbQueue.length && performance.now()-t0<LIB_THUMB_MS){
    const c=libThumbQueue.shift();
    if (c.isConnected) libraryThumbPaint(c);
  }
  if (libThumbQueue.length) libThumbFrame=requestAnimationFrame(libraryThumbStep);
}
function libraryThumbObserver(){
  if (libThumbObserver===null){
    libThumbObserver=typeof IntersectionObserver!=='function' ? false : new IntersectionObserver(entries=>{
      for (const e of entries){
        if (!e.isIntersecting) continue;
        libThumbObserver.unobserve(e.target); libThumbQueue.push(e.target);
      }
      if (libThumbQueue.length && !libThumbFrame) libThumbFrame=requestAnimationFrame(libraryThumbStep);
    },{root:$('libraryList'),rootMargin:'260px 0px'});
  }
  return libThumbObserver;
}
function libraryThumb(k){
  const c=libCanvasBlank(LIB_THUMB_W,LIB_THUMB_H); c.dataset.k=k;
  const io=libraryThumbObserver();
  if (io) io.observe(c); else libraryThumbPaint(c);
  return c;
}
/* Emptying the list also lets go of the rows the observer was watching and of
   any still waiting their turn. */
function clearLibraryList(){
  if (libThumbObserver) libThumbObserver.disconnect();
  libThumbQueue.length=0;
  const list=$('libraryList');
  if (list) list.innerHTML='';
  return list;
}
/* The real photograph, its credit, and the outbound references all live in
   js/photos.js — buildPlantPhoto / buildPlantReferences. They used to be a
   filename guess here: try photos/<key>.jpg, then .jpeg, then .png, and
   delete the element when the third one 404s. That worked while a photo was
   just a picture, and stopped working the moment a photo carried licence
   terms, because a guessed file has no creator, no source and no licence to
   display beside it. It also cost up to three failed requests per plant
   viewed. A photograph is now declared in the data or it does not exist. */

/* ---------- phone navigation ----------
   The DOCK layout is a master-detail split, whose premise is that the list is
   cheap peripheral context you keep while reading. That holds at 1200px. At
   375x812 the same premise measured: a 135px two-row header, a 34vh (276px)
   list and a 401px detail pane — 51% of the screen is navigation. And the list
   still did not fit: eight category headers COLLAPSED are 371px inside that
   276px box, so Shrubs and Trees sat below the fold of a box whose whole job
   is to fit. The detail pane then held a 1086px card whose four seasonal
   canvases wrapped 2x2 and pushed the plant's own NAME to y=723.

   So on SHEET the three surfaces become three VIEWS of one screen —
   cats -> list -> detail, back walking it in reverse. Nothing is co-visible,
   so nothing has to be budgeted against anything else and each view gets the
   whole screen.

   It is also what makes opening the library cheap. buildLibraryList builds a
   row per species, each running drawPlant into its own canvas: measured 156ms
   (median of 5) for all 473 on a desktop, paid on every single open. One
   category is 24-151 rows (Sun Perennials, the largest, is 42ms of canvas)
   and the cats view builds none at all.

   libView is a string because it is genuinely three-valued, and it is read
   ONLY through the [data-libview] attribute selectors inside the SHEET query,
   so DOCK can never reach a state that hides one of its own panes. */
let libSel=null;
let libView='cats';      // cats | list | detail — SHEET only
let libCat=null;         // the category the gardener chose, or null
let libListMode='none';  // what #libraryList currently HOLDS: none|sections|results
let libListCat=null;     // if sections: one category id, or null for all of them
let libTierSheet=null;   // the tier the open library was last built for
let libHay=null;
let librarySearchTimer=null;
let libTotal=0;          // every plant the library can show, counted once per open
let libMatches=null;     // how many the current search found, or null with no search
let libDetailWide=false; // whether the open detail card was built for the two-column layout

/* One predicate, both tiers. DOCK hides non-matching rows in a list that
   already exists; SHEET builds a result list from scratch, because it has no
   full list to hide and building one in order to hide it would cost the 156ms
   this whole thing exists to avoid. Different presentation, same answer — a
   test pins the two sets equal. The haystack is rebuilt per open rather than
   cached for the session because roleSummary resolves native roles against the
   active range, which a garden can change. */
function libraryHay(key){
  if (!libHay){
    libHay=Object.create(null);
    libraryAllKeys().forEach(k=>{
      const P=PLANTS[k];
      const cvHay=[...Object.values(P.cv||{}),...(P.libraryCultivars||[])]
        .map(c=>(c.name||'')+' '+(c.latin||'')+' '+(c.synonyms||[]).join(' ')+' '+(c.size||'')+' '+(c.note||'')).join(' ');
      libHay[k]=(P.name+' '+P.latin+' '+(P.synonyms||[]).join(' ')+' '+roleSummary(k,12)+' '+cvHay).toLowerCase();
    });
  }
  return libHay[key]||'';
}
function libraryMatches(key,q){ return !q || libraryHay(key).includes(q); }
function libraryQuery(){ const s=$('librarySearch'); return ((s&&s.value)||'').toLowerCase().trim(); }

/* `slide` marks a NAVIGATION (a card, a row, Back, a search starting or
   clearing), which on a phone moves the views in the direction it went
   (viewSlide, ui.js): deeper comes in from the right, Back goes off to it.
   Every other caller (opening, a tier crossing, the search refreshing the list
   it is already on) swaps them as before. Returns whether a slide started. */
const LIB_VIEW_PANE={cats:'libraryCats', list:'libraryList', detail:'libraryDetail'};
const LIB_VIEW_RANK={cats:0, list:1, detail:2};
function libStopSlides(){ for (const v in LIB_VIEW_PANE) viewSlideStop($(LIB_VIEW_PANE[v])); }
function setLibView(v,slide,onLeft){
  const was=libView;
  libView=v;
  const s=$('libraryScreen'); if (s) s.dataset.libview=v;
  let slid=false;
  if (was!==v){
    /* one change of view at a time: a third pane still going from the last one
       is put away before this one starts */
    for (const k in LIB_VIEW_PANE) if (k!==v && k!==was) viewSlideStop($(LIB_VIEW_PANE[k]));
    if (slide && s && !s.classList.contains('hidden') && mobileSheetUi())
      slid=viewSlide($(LIB_VIEW_PANE[v]),$(LIB_VIEW_PANE[was]),LIB_VIEW_RANK[v]<LIB_VIEW_RANK[was],onLeft);
    else libStopSlides();
  }
  renderLibraryHead();
  return slid;
}
/* Leaving a list for the categories. The list goes off to the right with its
   rows still on it, and is emptied once it has gone; anything that builds it
   again in the meantime (a category, a search) empties it first anyway, which
   is why the emptying asks whether the list is still meant to be empty. */
function libraryLeaveList(){
  libListMode='none'; libListCat=null;
  if (!setLibView('cats',true,()=>{ if (libListMode==='none') clearLibraryList(); })) clearLibraryList();
}
/* The header says where the reader is. On a wide screen that is always the
   library, and the line under the title counts what a search has found. On a
   phone it follows the three views: the library, then a category (or the
   search), then a plant. PURE, so the wording can be tested without a DOM. */
function libraryHeadText(sheet){
  const total=libTotal||libraryAllKeys().length, plants=n=>`${n} plant${n===1?'':'s'}`;
  const found=libMatches==null ? '' : `${libMatches} of ${plants(total)} match`;
  if (!sheet) return {title:'Plant Library', sub:found||`${plants(total)}, drawn in four seasons`};
  if (libView==='detail' && libSel && PLANTS[libSel]){
    const cat=libraryCatFor(libSel);
    return {title:PLANTS[libSel].name, sub:cat?cat.label:''};
  }
  if (libView==='list'){
    if (libListMode==='results') return {title:'Search', sub:found};
    const cat=libListCat?libraryCatById(libListCat):null;
    if (cat) return {title:cat.label, sub:plants(libraryCatKeys(cat).length)};
  }
  return {title:'Plant Library', sub:`${plants(total)}, drawn in four seasons`};
}
function renderLibraryHead(){
  const back=$('btnLibraryBack'), title=$('libraryHeadTitle'), sub=$('libraryHeadSub');
  const sheet=mobileSheetUi(), text=libraryHeadText(sheet);
  if (title) title.textContent=text.title;
  if (sub) sub.textContent=text.sub;
  if (back) back.setAttribute('aria-label',
    !sheet ? 'Back to the menu'
    : libView==='detail' ? 'Back to the list'
    : libView==='list' ? 'Back to the categories'
    : 'Back to the menu');
}
function libraryBack(){
  /* On DOCK both panes are visible, so there is nowhere to go back TO — back
     is close. Keeping the tier check here means Escape, the header chevron and
     the card's trailing link all agree without each restating it. */
  if (!mobileSheetUi()){ show('menuScreen'); return; }
  if (libView==='detail'){ setLibView(libListMode==='none'?'cats':'list',true); return; }
  if (libView==='list'){
    const s=$('librarySearch'); if (s) s.value='';
    libCat=null; libMatches=null;
    libraryEmptyState(false,'');
    libraryLeaveList();
    return;
  }
  show('menuScreen');
}

/* Each category card shows three of its plants, the way each menu entry shows
   what it opens. Named here where a category has plants worth leading with;
   any name that has left the catalog, and any category not named, falls back to
   three spread through its own list, so a card is never empty. */
const LIB_CAT_SHOW={
  grasses:['bluestem','switchgrass','karl'],
  sedges:['pennsedge','palmsedge','tussocksedge'],
  sunper:['echinacea','liatrisspicata','rudbeckia'],
  shadeper:['hosta','ostrichfern','astilbe'],
  bulbs:['gardentulip','daffodil','crocus'],
  waterplants:['sacredlotus','commoncattail','pickerelweed'],
  climbers:['clematisviticella','climbingrose','americanwisteria'],
  shrubs:['panniclehydrangea','redtwig','lilac'],
  trees:['redbud','whiteoak','bluespruce'],
};
function libraryCatArtKeys(cat){
  const keys=libraryCatKeys(cat), out=(LIB_CAT_SHOW[cat.id]||[]).filter(k=>keys.includes(k)).slice(0,3);
  for (let i=0; out.length<Math.min(3,keys.length) && i<keys.length*3; i++){
    const k=keys[(Math.floor(((i%3)+.5)/3*keys.length)+Math.floor(i/3))%keys.length];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
/* Drawn once a session and kept, since the picture does not change. A cached
   canvas can only stand in one place, which is all a card needs: rebuilding
   the cards moves it into the new one.

   The drawing is one card per animation frame, after the screen is up. All
   nine at once measured 32ms on a desktop (27 plants, three of them trees),
   in the same task as the tap that opened the library; a frame apiece is
   3-4ms and the cards fill in over a sixth of a second. */
const LIB_CAT_ART=new Map(), LIB_CAT_ART_W=168, LIB_CAT_ART_H=74, libCatArtQueue=[];
let libCatArtFrame=0;
function paintLibraryCatArt(c,cat){
  const g=c.getContext && c.getContext('2d'); if (!g) return;
  const W=LIB_CAT_ART_W, H=LIB_CAT_ART_H;
  g.setTransform(2,0,0,2,0,0); g.clearRect(0,0,W,H);
  const keys=libraryCatArtKeys(cat), n=keys.length, slot=W/Math.max(1,n);
  keys.forEach((k,i)=>{
    const P=PLANTS[k], box=plantDrawBox(P,k,1);
    // the box is a sprite's, padded for wind and snow; the drawing is inside it.
    // A bulb may be drawn at twice its size, or it is a dot on the plate.
    const sc=Math.min(2,(H-8)/Math.max(1,box.top-22),(slot*1.25)/Math.max(1,(box.halfW-16)*2));
    g.save(); g.translate(slot*(i+.5),H-5); g.scale(sc,sc);
    drawPlant(g,0,0,k,1,libraryPreviewSeason(P),libSeed(k),0,null,1);
    g.restore();
  });
}
function libraryCatArtStep(){
  libCatArtFrame=0;
  const cat=libCatArtQueue.shift(); if (!cat) return;
  paintLibraryCatArt(LIB_CAT_ART.get(cat.id),cat);
  if (libCatArtQueue.length) libCatArtFrame=requestAnimationFrame(libraryCatArtStep);
}
function libraryCatArt(cat){
  let c=LIB_CAT_ART.get(cat.id); if (c) return c;
  c=document.createElement('canvas'); c.width=LIB_CAT_ART_W*2; c.height=LIB_CAT_ART_H*2; c.setAttribute('aria-hidden','true');
  LIB_CAT_ART.set(cat.id,c);
  libCatArtQueue.push(cat);
  if (!libCatArtFrame) libCatArtFrame=requestAnimationFrame(libraryCatArtStep);
  return c;
}
function buildLibraryCats(){
  const wrap=$('libraryCats'); if (!wrap) return;
  wrap.innerHTML='';
  LIB_CATS.forEach(cat=>{
    const n=libraryCatKeys(cat).length; if (!n) return;
    const b=document.createElement('button'); b.type='button'; b.className='lib-catcard';
    b.dataset.cat=cat.id;
    const art=document.createElement('span'); art.className='lib-catcard-art'; art.appendChild(libraryCatArt(cat));
    const label=document.createElement('span'); label.className='lib-catcard-name'; label.textContent=cat.label;
    const count=document.createElement('small'); count.textContent=n;
    b.append(art,label,count);
    b.onclick=()=>openLibraryCategory(cat.id);
    wrap.appendChild(b);
  });
}
function openLibraryCategory(id){
  libCat=id; libMatches=null;
  const s=$('librarySearch'); if (s) s.value='';
  buildLibraryList(id);
  libraryEmptyState(false,'');
  setLibView('list',true);
  const list=$('libraryList'); if (list) list.scrollTop=0;
}
/* What a row says under the name: how tall, how much sun, how wet. They are the
   three things a list is scanned for, and each used to be a tap away. */
function libraryRowFacts(P){
  const water=P.type==='water'||P.wades;
  return [`${plantMeasure(P.heightIn||P.h,false)} tall`, P.sun==='full'?'Full sun':'Part shade',
    water ? (P.marginal||P.wades?'Pond margin':'Open water') : P.moist[0].toUpperCase()+P.moist.slice(1)].join(' · ');
}
function libItemButton(k,showCat){
  const P=PLANTS[k];
  const b=document.createElement('button'); b.className='lib-item'+(libSel===k?' sel':''); b.dataset.k=k;
  b.dataset.hay=libraryHay(k);
  b.append(libraryThumb(k));
  const t=document.createElement('span'); t.className='li-copy';
  const nm=document.createElement('span'); nm.className='li-name'; nm.textContent=P.name;
  const la=document.createElement('span'); la.className='li-latin'; la.textContent=P.latin;
  const fa=document.createElement('span'); fa.className='li-facts'; fa.textContent=libraryRowFacts(P);
  t.append(nm,la,fa);
  b.append(t);
  if (showCat){
    const cat=libraryCatFor(k);
    if (cat){ const c=document.createElement('small'); c.className='li-cat'; c.textContent=cat.label; b.append(c); }
  }
  b.onclick=()=>showLibraryDetail(k,true);
  return b;
}
/* catId null builds every section — the DOCK accordion, behaving exactly as it
   always has, libCollapsed included. A catId builds that one category under a
   plain sticky heading instead of a collapse control: there is nothing to
   collapse it against when it is the only thing on the screen. */
function buildLibraryList(catId){
  const list=clearLibraryList(); if (!list) return;
  libListCat=catId==null?null:catId;
  libListMode='sections';
  const solo=libListCat!=null;
  const cats=solo?LIB_CATS.filter(c=>c.id===libListCat):LIB_CATS;
  cats.forEach(cat=>{
    const keys=libraryCatKeys(cat);
    if (!keys.length) return;
    const section=document.createElement('section'); section.className='lib-section'+(solo?' solo':'');
    section.dataset.catId=cat.id;
    const title=document.createElement('span'); title.textContent=cat.label;
    const count=document.createElement('small'); count.textContent=keys.length;
    const items=document.createElement('div'); items.className='lib-cat-items';
    items.id=`lib-cat-${cat.id}`;
    let head;
    if (solo){
      head=document.createElement('h3'); head.className='lib-cat lib-cat-static';
      head.append(title,count);
    } else {
      head=document.createElement('button'); head.type='button'; head.className='lib-cat';
      head.dataset.cat='1'; head.setAttribute('aria-expanded', libCollapsed[cat.id]?'false':'true');
      head.append(title,count);
      head.setAttribute('aria-controls', items.id);
      if (libCollapsed[cat.id]) section.classList.add('collapsed');
      head.onclick=()=>{
        libCollapsed[cat.id]=!libCollapsed[cat.id];
        saveLibraryCollapsed();
        section.classList.toggle('collapsed', !!libCollapsed[cat.id]);
        head.setAttribute('aria-expanded', libCollapsed[cat.id]?'false':'true');
      };
    }
    section.append(head,items);
    keys.forEach(k=>items.appendChild(libItemButton(k,false)));
    list.appendChild(section);
  });
}
function buildLibraryResults(q){
  const list=clearLibraryList(); if (!list) return 0;
  libListMode='results'; libListCat=null;
  const keys=libraryAllKeys().filter(k=>libraryMatches(k,q));
  const wrap=document.createElement('div'); wrap.className='lib-cat-items lib-results';
  keys.forEach(k=>wrap.appendChild(libItemButton(k,true)));
  list.appendChild(wrap);
  libMatches=keys.length;
  return keys.length;
}
function libraryEmptyState(show,q){
  let empty=document.querySelector('.library-empty');
  if (show){
    if (!empty){
      empty=document.createElement('div');
      empty.className='library-empty';
      $('libraryList').appendChild(empty);
    }
    empty.textContent=q ? 'No plants match that search.' : 'No plants in the library yet.';
  } else if (empty) empty.remove();
}

/* On SHEET the four seasonal canvases have to fit ONE row — four seasons side
   by side IS the comparison, and a 2x2 block breaks the temporal read. Derived
   from the column rather than hardcoded, so it holds from 320px up to a
   portrait tablet. Falls back to the authored 80x104 wherever there is no
   layout to measure: DOCK, and the test sandbox, which reports no clientWidth. */
/* A detail pane this wide gives the card two columns: the four seasons large
   in a 2x2 block on the left, the name and the facts on the right. Below it the
   card is one column, as it always was. Measured off the pane rather than the
   window, because the pane is what the card has to fit. */
const LIB_WIDE_PANE=860;
function libraryDetailWide(d){ return !mobileSheetUi() && ((d&&d.clientWidth)||0)>=LIB_WIDE_PANE; }
function librarySeasonTile(d){
  const W=(d&&d.clientWidth)||0;
  if (!W) return {w:80,h:104};
  if (!mobileSheetUi()){
    if (W<LIB_WIDE_PANE) return {w:80,h:104};
    const card=Math.min(1040,W-52);                   // .ld-card.wide inside the pane's padding
    const art=(card-32)*.38;                          // its first column
    const w=Math.max(110,Math.min(176,Math.floor((art-28-10)/2)));   // plate padding and one gap
    return {w,h:Math.round(w*104/80)};
  }
  const card=Math.min(560,W-32);        // .library-detail padding
  const inner=card-16-24;               // .ld-img padding + three 8px gaps
  const w=Math.max(56,Math.min(80,Math.floor(inner/4)));
  return {w,h:Math.round(w*104/80)};
}

function openLibrary(){
  libHay=null; libMatches=null;
  libTotal=libraryAllKeys().length;
  const search=$('librarySearch');
  if (search){
    /* Reset the query. openLibrary called applyLibrarySearch() without ever
       clearing the field, so a query survived a menu round-trip: type "oak",
       go to Menu, reopen the Library, and you are looking at 7 of 473 plants
       with nothing on screen saying why. */
    search.value='';
    search.placeholder=`Search ${libTotal} plants…`;
  }
  show('libraryScreen');
  libStopSlides();          // a view still going from the last visit
  libTierSheet=mobileSheetUi();
  if (libTierSheet){
    buildLibraryCats();     // the dock has no category view, so it draws none of their pictures
    libCat=null; libListMode='none'; libListCat=null;
    clearLibraryList();
    libraryEmptyState(false,'');
    setLibView('cats');
  } else {
    buildLibraryList(null);
    setLibView('cats');
    /* Always redrawn, not only when nothing is selected: the card is built for
       the width of its pane, and the window may have changed since it was. */
    showLibraryDetail(libSel||PLANT_KEYS[0]);
    applyLibrarySearch();
  }
}
/* Crossing the tier with the library open — a rotation — has to rebuild the
   body for the layout that is now on screen: the DOCK split needs every
   section AND a filled detail pane, SHEET needs a view state. Only act on an
   actual crossing; a resize within one tier changes nothing here. */
function syncLibraryTier(){
  const s=$('libraryScreen');
  if (!s || s.classList.contains('hidden')) return;
  const sheet=mobileSheetUi();
  if (sheet===libTierSheet){
    /* Within the dock, a window dragged across the two-column width has a card
       built for the other layout: its season tiles are the wrong size for the
       column they now stand in. */
    if (!sheet && libSel && libraryDetailWide($('libraryDetail'))!==libDetailWide) showLibraryDetail(libSel);
    return;
  }
  libTierSheet=sheet;
  libStopSlides();
  if (sheet){
    buildLibraryCats();
    if (libCat){ buildLibraryList(libCat); setLibView('list'); }
    else {
      libListMode='none'; libListCat=null;
      clearLibraryList();
      libraryEmptyState(false,'');
      setLibView('cats');
    }
  } else {
    buildLibraryList(null);
    setLibView('cats');
    showLibraryDetail(libSel||PLANT_KEYS[0]);
    applyLibrarySearch();
  }
}
function showLibraryDetail(key,slide){
  libSel=key;
  document.querySelectorAll('.lib-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===key));
  const sheet=mobileSheetUi();
  /* Set the view BEFORE measuring: in the list view .library-detail is
     display:none and reports a clientWidth of 0. */
  if (sheet) setLibView('detail',slide);
  const P=PLANTS[key], d=$('libraryDetail');
  const seasons=['Spring','Summer','Fall','Winter'];
  const tile=librarySeasonTile(d), wide=libraryDetailWide(d);
  libDetailWide=wide;
  const imgs=document.createElement('div'); imgs.className='ld-img';
  seasons.forEach(s=>{ const fig=document.createElement('figure');
    fig.append(libCanvas(key,null,s,tile.w,tile.h,1.15*tile.w/80));
    const cap=document.createElement('figcaption'); cap.textContent=s; fig.append(cap);
    imgs.append(fig); });
  const facts=[
    ['Type', P.type[0].toUpperCase()+P.type.slice(1)],
    ['Mature size', matureSizeText(P,false)+(P.grow?` - ${yearsToSizeText(P)}`:'')],
    ['Spacing', `${plantMeasure(P.space,false)} on center`],
    ['Hardiness', `USDA zones ${P.zones[0]}–${P.zones[1]}`],
    ['Bloom', libraryBloomText(P)],
    ['Light', P.sun==='full'?'Full sun':'Part shade'],
    ['Moisture', P.type==='water'||P.wades
      ? (P.marginal||P.wades?'Pond margin: shallow water or wet ground':'Open water: floats on a pond, river or lake')
      : P.moist[0].toUpperCase()+P.moist.slice(1)],
    ...(P.spreadHabit?[['Habit', P.spreadHabit==='colony'?'Spreads into a colony':'Forms a clump']]:[]),
    ['Broad origin', nativeOriginText(P)],
    ['Plant status', provenanceLabel(P)],
    ['Roles', roleSummary(key)],
  ];
  const cvKeys=Object.keys(P.cv||{}), libraryCultivars=P.libraryCultivars||[];
  d.innerHTML='';
  /* Two blocks: the pictures and the words. One column, they simply follow one
     another; in a wide pane they stand side by side (.ld-card.wide).
     Order is deliberate: the four seasonal illustrations are what this app
     knows that a photograph cannot say, so they lead. The photograph follows
     as corroboration — what it looks like in a real garden — and is absent
     for most species, which is a normal state and renders as nothing. */
  const shell=document.createElement('div'); shell.className='ld-card'+(wide?' wide':'');
  const artCol=document.createElement('div'); artCol.className='ld-art';
  const card=document.createElement('div'); card.className='ld-text';
  artCol.append(imgs);
  const photo=buildPlantPhoto(key); if (photo) artCol.append(photo);
  const nm=document.createElement('div'); nm.className='ld-name'; nm.textContent=P.name; card.append(nm);
  const la=document.createElement('div'); la.className='ld-latin'; la.textContent=P.latin; card.append(la);
  const bl=document.createElement('p'); bl.className='ld-blurb'; bl.textContent=P.blurb; card.append(bl);
  const dl=document.createElement('dl'); dl.className='ld-facts';
  facts.forEach(([k,v])=>{ const dt=document.createElement('dt'); dt.textContent=k;
    const dd=document.createElement('dd'); dd.textContent=v;
    /* the year at a glance, under the months it names: the catalog card's own strip */
    if (k==='Bloom'){ const strip=discoveryBloomTimeline(P); if (strip) dd.appendChild(strip); }
    dl.append(dt,dd); });
  card.append(dl,buildPlantGuidance({s:key,v:null}));
  if (cvKeys.length || libraryCultivars.length){
    const cvs=document.createElement('div'); cvs.className='ld-cvs';
    const n=cvKeys.length+libraryCultivars.length;
    const h4=document.createElement('h4'); h4.textContent=`${n} cultivar${n>1?'s':''}`;
    cvs.append(h4);
    cvKeys.forEach(v=>{ const row=document.createElement('div'); row.className='ld-cv';
      row.innerHTML=`<b>${P.cv[v].name}</b> — ${P.cv[v].note||''}`; cvs.append(row); });
    libraryCultivars.forEach(c=>{ const row=document.createElement('div'); row.className='ld-cv';
      const size=c.size ? ` <span>${c.size}</span>` : '';
      row.innerHTML=`<b>${c.name}</b>${size} - ${c.note||''}`; cvs.append(row); });
    card.append(cvs);
  }
  const refs=buildPlantReferences(key); if (refs) card.append(refs);
  /* A trailing exit, because after ~1100px of card the next action belongs
     where the thumb already is rather than back at the top of the screen. The
     header chevron stays for the platform convention; both call one function,
     and between them the card's exit is reachable in either hand — which is
     why this screen does not need the planner's left-handed mirror. */
  if (sheet){
    const cat=libCat?libraryCatById(libCat):null;
    const back=document.createElement('button'); back.type='button'; back.className='back-link ld-back';
    back.textContent=cat?`Back to ${cat.label}`:'Back to the list';
    back.onclick=libraryBack;
    card.append(back);
  }
  shell.append(artCol,card);
  d.append(shell); d.scrollTop=0;
  renderLibraryHead();
}
function libraryQueryInput(){
  /* Debounced to match the tray's Find (120ms). SHEET builds a row per match,
     so an undebounced first keystroke would build a canvas for most of the
     catalog before the second character landed. */
  clearTimeout(librarySearchTimer);
  librarySearchTimer=setTimeout(applyLibrarySearch,120);
}
function applyLibrarySearch(){
  const q=libraryQuery();
  if (mobileSheetUi()) applyLibrarySearchSheet(q);
  else applyLibrarySearchDock(q);
}
function applyLibrarySearchSheet(q){
  if (q){
    const n=buildLibraryResults(q);
    libraryEmptyState(!n,q);
    if (libView!=='detail') setLibView('list',true);
    const list=$('libraryList'); if (list) list.scrollTop=0;
    return;
  }
  libraryEmptyState(false,'');
  libMatches=null;
  if (libCat){ buildLibraryList(libCat); setLibView('list'); }
  else libraryLeaveList();
}
function applyLibrarySearchDock(q){
  let total=0;
  document.querySelectorAll('.lib-section').forEach(section=>{
    let any=false;
    section.querySelectorAll('.lib-item').forEach(b=>{
      const show=libraryMatches(b.dataset.k,q);
      b.style.display=show?'':'none';
      if (show){ any=true; total++; }
    });
    const head=section.querySelector('.lib-cat');
    section.style.display=any?'':'none';
    section.classList.toggle('search-open', !!q && any);
    if (head && head.tagName==='BUTTON')
      head.setAttribute('aria-expanded', (!libCollapsed[section.dataset.catId] || (!!q && any))?'true':'false');
  });
  libraryEmptyState(!total,q);
  libMatches=q?total:null;
  renderLibraryHead();
}
