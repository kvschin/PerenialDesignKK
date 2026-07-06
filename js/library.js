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
function libSeed(key){ let h=0; for(let i=0;i<key.length;i++) h=(h*31+key.charCodeAt(i))>>>0; return h||7; }
function libCanvas(key,variant,season,w,h){
  const c=document.createElement('canvas'); c.width=w*2; c.height=h*2;
  c.style.width=w+'px'; c.style.height=h+'px';
  const ctx=c.getContext('2d'); ctx.scale(2,2);
  const P=plantDef(key,variant), drawH=(P.h||40)*1.3+12, sc=Math.min(1.15,h/drawH);
  ctx.save(); ctx.translate(w/2,h-5); ctx.scale(sc,sc);
  drawPlant(ctx,0,0,key,1,season,libSeed(key),0,variant,1);
  ctx.restore();
  return c;
}
/* a real photo for the species, if one has been added to photos/.
   Tries .jpg → .jpeg → .png, then quietly removes itself (renders
   below remain the fallback). Drop a file at photos/<key>.jpg. */
function plantPhoto(key){
  const wrap=document.createElement('div'); wrap.className='ld-photo';
  const img=document.createElement('img'); img.alt='';
  const exts=['jpg','jpeg','png']; let i=0;
  img.onerror=()=>{ i++; if (i<exts.length) img.src=`photos/${key}.${exts[i]}`; else wrap.remove(); };
  img.onload=()=>{ wrap.classList.add('has'); };
  img.src=`photos/${key}.${exts[0]}`;
  wrap.appendChild(img);
  return wrap;
}
let libSel=null;
function openLibrary(){ buildLibraryList(''); show('libraryScreen');
  if (!libSel) showLibraryDetail(PLANT_KEYS[0]);
  applyLibrarySearch(); }
function buildLibraryList(q){
  const list=$('libraryList'); list.innerHTML='';
  LIB_CATS.forEach(cat=>{
    const keys=libraryCatKeys(cat);
    if (!keys.length) return;
    const section=document.createElement('section'); section.className='lib-section';
    section.dataset.catId=cat.id;
    const head=document.createElement('button'); head.type='button'; head.className='lib-cat';
    head.dataset.cat='1'; head.setAttribute('aria-expanded', libCollapsed[cat.id]?'false':'true');
    const title=document.createElement('span'); title.textContent=cat.label;
    const count=document.createElement('small'); count.textContent=keys.length;
    head.append(title,count);
    const items=document.createElement('div'); items.className='lib-cat-items';
    items.id=`lib-cat-${cat.id}`;
    head.setAttribute('aria-controls', items.id);
    if (libCollapsed[cat.id]) section.classList.add('collapsed');
    head.onclick=()=>{
      libCollapsed[cat.id]=!libCollapsed[cat.id];
      saveLibraryCollapsed();
      section.classList.toggle('collapsed', !!libCollapsed[cat.id]);
      head.setAttribute('aria-expanded', libCollapsed[cat.id]?'false':'true');
    };
    section.append(head,items);
    keys.forEach(k=>{
      const P=PLANTS[k];
      const b=document.createElement('button'); b.className='lib-item'+(libSel===k?' sel':''); b.dataset.k=k;
      const cvHay=(P.libraryCultivars||[]).map(c=>(c.name||'')+' '+(c.size||'')+' '+(c.note||'')).join(' ');
      b.dataset.hay=(P.name+' '+P.latin+' '+roleSummary(k,12)+' '+cvHay).toLowerCase();
      b.append(libCanvas(k,null,'Summer',30,36));
      const t=document.createElement('span');
      t.innerHTML=`${P.name}<span class="li-latin">${P.latin}</span>`;
      b.append(t);
      b.onclick=()=>showLibraryDetail(k);
      items.appendChild(b);
    });
    list.appendChild(section);
  });
}
function showLibraryDetail(key){
  libSel=key;
  document.querySelectorAll('.lib-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===key));
  const P=PLANTS[key], d=$('libraryDetail');
  const seasons=['Spring','Summer','Fall','Winter'];
  const imgs=document.createElement('div'); imgs.className='ld-img';
  seasons.forEach(s=>{ const fig=document.createElement('figure');
    fig.append(libCanvas(key,null,s,80,104));
    const cap=document.createElement('figcaption'); cap.textContent=s; fig.append(cap);
    imgs.append(fig); });
  const facts=[
    ['Type', P.type[0].toUpperCase()+P.type.slice(1)],
    ['Mature size', matureSizeText(P,false)+(P.grow?` - ${yearsToSizeText(P)}`:'')],
    ['Spacing', `${plantMeasure(P.space,false)} on center`],
    ['Hardiness', `USDA zones ${P.zones[0]}–${P.zones[1]}`],
    ['Light', P.sun==='full'?'Full sun':'Part shade'],
    ['Soil', P.moist[0].toUpperCase()+P.moist.slice(1)+' moisture'],
    ['Origin', P.native?'Native':'Garden plant (non-native)'],
    ['Roles', roleSummary(key)],
  ];
  const cvKeys=Object.keys(P.cv||{}), libraryCultivars=P.libraryCultivars||[];
  d.innerHTML='';
  const card=document.createElement('div'); card.className='ld-card';
  card.append(plantPhoto(key));   // real photo if photos/<key>.jpg exists, else nothing
  card.append(imgs);
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
  d.append(card); d.scrollTop=0;
}
function applyLibrarySearch(){
  const q=($('librarySearch').value||'').toLowerCase().trim();
  let total=0;
  document.querySelectorAll('.lib-section').forEach(section=>{
    let any=false;
    section.querySelectorAll('.lib-item').forEach(b=>{
      const show=!q || b.dataset.hay.includes(q);
      b.style.display=show?'':'none';
      if (show){ any=true; total++; }
    });
    const head=section.querySelector('.lib-cat');
    section.style.display=any?'':'none';
    section.classList.toggle('search-open', !!q && any);
    if (head) head.setAttribute('aria-expanded', (!libCollapsed[section.dataset.catId] || (!!q && any))?'true':'false');
  });
  let empty=document.querySelector('.library-empty');
  if (!total){
    if (!empty){
      empty=document.createElement('div');
      empty.className='library-empty';
      $('libraryList').appendChild(empty);
    }
    empty.textContent=q ? 'No plants match that search.' : 'No plants in the library yet.';
  } else if (empty) empty.remove();
}

