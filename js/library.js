'use strict';
/* ---------- plant library: browse every species ---------- */
const LIB_CATS=[
  {id:'grasses',    label:'Grasses',          types:['grass']},
  {id:'sedges',     label:'Sedges',           types:['sedge']},
  {id:'sunper',     label:'Sun Perennials',   types:['forb'], sunFilter:'full'},
  {id:'shadeper',   label:'Shade Perennials', types:['forb'], sunFilter:'part'},
  {id:'bulbs',      label:'Bulbs',            types:['bulb']},
  {id:'waterplants',label:'Water Plants',     types:['water']},
  {id:'shrubs',     label:'Shrubs',           types:['shrub']},
  {id:'trees',      label:'Trees',            types:['tree']},
];
const LIB_OPEN_KEY='pocketprairie:libraryOpen';
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
function libCanvas(key,variant,season,w,h){
  const c=document.createElement('canvas'); c.width=w*2; c.height=h*2;
  c.style.width=w+'px'; c.style.height=h+'px';
  const ctx=c.getContext('2d'); ctx.scale(2,2);
  const P=plantDef(key,variant), drawH=(plantArtTop(P)||40)*1.3+12, sc=Math.min(1.15,h/drawH);
  ctx.save(); ctx.translate(w/2,h-5); ctx.scale(sc,sc);
  drawPlant(ctx,0,0,key,1,season,libSeed(key),0,variant,1);
  ctx.restore();
  return c;
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
        .map(c=>(c.name||'')+' '+(c.latin||'')+' '+(c.size||'')+' '+(c.note||'')).join(' ');
      libHay[k]=(P.name+' '+P.latin+' '+roleSummary(k,12)+' '+cvHay).toLowerCase();
    });
  }
  return libHay[key]||'';
}
function libraryMatches(key,q){ return !q || libraryHay(key).includes(q); }
function libraryQuery(){ const s=$('librarySearch'); return ((s&&s.value)||'').toLowerCase().trim(); }

function setLibView(v){
  libView=v;
  const s=$('libraryScreen'); if (s) s.dataset.libview=v;
  renderLibraryHead();
}
function renderLibraryHead(){
  const back=$('btnLibraryBack'), title=$('libraryHeadTitle');
  if (title) title.textContent=(libView==='detail'&&libSel&&PLANTS[libSel])?PLANTS[libSel].name:'';
  if (back) back.setAttribute('aria-label',
    libView==='detail' ? 'Back to the list'
    : libView==='list' ? 'Back to the categories'
    : 'Back to the menu');
}
function libraryBack(){
  /* On DOCK both panes are visible, so there is nowhere to go back TO — back
     is close. Keeping the tier check here means Escape, the header chevron and
     the card's trailing link all agree without each restating it. */
  if (!mobileSheetUi()){ show('menuScreen'); return; }
  if (libView==='detail'){ setLibView(libListMode==='none'?'cats':'list'); return; }
  if (libView==='list'){
    const s=$('librarySearch'); if (s) s.value='';
    libCat=null; libListMode='none'; libListCat=null;
    const list=$('libraryList'); if (list) list.innerHTML='';
    libraryEmptyState(false,'');
    setLibView('cats');
    return;
  }
  show('menuScreen');
}

function buildLibraryCats(){
  const wrap=$('libraryCats'); if (!wrap) return;
  wrap.innerHTML='';
  LIB_CATS.forEach(cat=>{
    const n=libraryCatKeys(cat).length; if (!n) return;
    const b=document.createElement('button'); b.type='button'; b.className='lib-catcard';
    b.dataset.cat=cat.id;
    const label=document.createElement('span'); label.className='lib-catcard-name'; label.textContent=cat.label;
    const count=document.createElement('small'); count.textContent=n;
    b.append(label,count);
    b.onclick=()=>openLibraryCategory(cat.id);
    wrap.appendChild(b);
  });
}
function openLibraryCategory(id){
  libCat=id;
  const s=$('librarySearch'); if (s) s.value='';
  buildLibraryList(id);
  libraryEmptyState(false,'');
  setLibView('list');
  const list=$('libraryList'); if (list) list.scrollTop=0;
}
function libItemButton(k,showCat){
  const P=PLANTS[k];
  const b=document.createElement('button'); b.className='lib-item'+(libSel===k?' sel':''); b.dataset.k=k;
  b.dataset.hay=libraryHay(k);
  b.append(libCanvas(k,null,libraryPreviewSeason(P),30,36));
  const t=document.createElement('span');
  t.innerHTML=`${P.name}<span class="li-latin">${P.latin}</span>`;
  b.append(t);
  if (showCat){
    const cat=libraryCatFor(k);
    if (cat){ const c=document.createElement('small'); c.className='li-cat'; c.textContent=cat.label; b.append(c); }
  }
  b.onclick=()=>showLibraryDetail(k);
  return b;
}
/* catId null builds every section — the DOCK accordion, behaving exactly as it
   always has, libCollapsed included. A catId builds that one category under a
   plain sticky heading instead of a collapse control: there is nothing to
   collapse it against when it is the only thing on the screen. */
function buildLibraryList(catId){
  const list=$('libraryList'); if (!list) return;
  list.innerHTML='';
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
  const list=$('libraryList'); if (!list) return 0;
  list.innerHTML='';
  libListMode='results'; libListCat=null;
  const keys=libraryAllKeys().filter(k=>libraryMatches(k,q));
  const wrap=document.createElement('div'); wrap.className='lib-cat-items lib-results';
  keys.forEach(k=>wrap.appendChild(libItemButton(k,true)));
  list.appendChild(wrap);
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
function librarySeasonTile(d){
  const W=(d&&d.clientWidth)||0;
  if (!W || !mobileSheetUi()) return {w:80,h:104};
  const card=Math.min(560,W-32);        // .library-detail padding
  const inner=card-16-24;               // .ld-img padding + three 8px gaps
  const w=Math.max(56,Math.min(80,Math.floor(inner/4)));
  return {w,h:Math.round(w*104/80)};
}

function openLibrary(){
  libHay=null;
  const search=$('librarySearch');
  if (search){
    /* Reset the query. openLibrary called applyLibrarySearch() without ever
       clearing the field, so a query survived a menu round-trip: type "oak",
       go to Menu, reopen the Library, and you are looking at 7 of 473 plants
       with nothing on screen saying why. */
    search.value='';
    search.placeholder=`Search ${libraryAllKeys().length} plants…`;
  }
  show('libraryScreen');
  libTierSheet=mobileSheetUi();
  buildLibraryCats();
  if (libTierSheet){
    libCat=null; libListMode='none'; libListCat=null;
    const list=$('libraryList'); if (list) list.innerHTML='';
    libraryEmptyState(false,'');
    setLibView('cats');
  } else {
    buildLibraryList(null);
    setLibView('cats');
    if (!libSel) showLibraryDetail(PLANT_KEYS[0]);
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
  if (sheet===libTierSheet) return;
  libTierSheet=sheet;
  if (sheet){
    if (libCat){ buildLibraryList(libCat); setLibView('list'); }
    else {
      libListMode='none'; libListCat=null;
      const list=$('libraryList'); if (list) list.innerHTML='';
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
function showLibraryDetail(key){
  libSel=key;
  document.querySelectorAll('.lib-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===key));
  const sheet=mobileSheetUi();
  /* Set the view BEFORE measuring: in the list view .library-detail is
     display:none and reports a clientWidth of 0. */
  if (sheet) setLibView('detail');
  const P=PLANTS[key], d=$('libraryDetail');
  const seasons=['Spring','Summer','Fall','Winter'];
  const tile=librarySeasonTile(d);
  const imgs=document.createElement('div'); imgs.className='ld-img';
  seasons.forEach(s=>{ const fig=document.createElement('figure');
    fig.append(libCanvas(key,null,s,tile.w,tile.h));
    const cap=document.createElement('figcaption'); cap.textContent=s; fig.append(cap);
    imgs.append(fig); });
  const facts=[
    ['Type', P.type[0].toUpperCase()+P.type.slice(1)],
    ['Mature size', matureSizeText(P,false)+(P.grow?` - ${yearsToSizeText(P)}`:'')],
    ['Spacing', `${plantMeasure(P.space,false)} on center`],
    ['Hardiness', `USDA zones ${P.zones[0]}–${P.zones[1]}`],
    ['Bloom', libraryBloomText(P)],
    ['Light', P.sun==='full'?'Full sun':'Part shade'],
    ['Soil', P.moist[0].toUpperCase()+P.moist.slice(1)+' moisture'],
    ['Origin', nativeOriginText(P)],
    ['Plant status', provenanceLabel(P)],
    ['Roles', roleSummary(key)],
  ];
  const cvKeys=Object.keys(P.cv||{}), libraryCultivars=P.libraryCultivars||[];
  d.innerHTML='';
  const card=document.createElement('div'); card.className='ld-card';
  /* Order is deliberate: the four seasonal illustrations are what this app
     knows that a photograph cannot say, so they lead. The photograph follows
     as corroboration — what it looks like in a real garden — and is absent
     for most species, which is a normal state and renders as nothing. */
  card.append(imgs);
  const photo=buildPlantPhoto(key); if (photo) card.append(photo);
  const nm=document.createElement('div'); nm.className='ld-name'; nm.textContent=P.name; card.append(nm);
  const la=document.createElement('div'); la.className='ld-latin'; la.textContent=P.latin; card.append(la);
  const bl=document.createElement('p'); bl.className='ld-blurb'; bl.textContent=P.blurb; card.append(bl);
  const dl=document.createElement('dl'); dl.className='ld-facts';
  facts.forEach(([k,v])=>{ const dt=document.createElement('dt'); dt.textContent=k;
    const dd=document.createElement('dd'); dd.textContent=v; dl.append(dt,dd); });
  card.append(dl);
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
  d.append(card); d.scrollTop=0;
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
    if (libView!=='detail') setLibView('list');
    const list=$('libraryList'); if (list) list.scrollTop=0;
    return;
  }
  libraryEmptyState(false,'');
  if (libCat){ buildLibraryList(libCat); setLibView('list'); }
  else {
    libListMode='none'; libListCat=null;
    const list=$('libraryList'); if (list) list.innerHTML='';
    setLibView('cats');
  }
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
}
