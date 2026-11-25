'use strict';
/* Builds the large test gardens: designed plots with many more trees and shrubs
 * than the demo garden, for performance work.
 *
 *   node dev/make-test-gardens.cjs            writes dev/test-gardens/*.prairie.json
 *   node dev/make-test-gardens.cjs <outdir>   somewhere else
 *   node dev/make-test-gardens.cjs --only woodland
 *
 * Each file is an ordinary exported garden (the app's own buildSaveBlob(), as
 * dev/make-demo-garden.js does it), so it imports through Your gardens > Import
 * like a friend's file, and the bench tools take it with --garden.
 *
 * Why these exist. stressGarden() and perfBench() scatter the catalog at random,
 * which is a fair worst case and nothing like a garden: no drifts, no hedges, no
 * canopy over shade planting, and a tree on four tiles in a hundred. A designed
 * garden repeats species (so sprites of one kind share a look-up but not a
 * picture), layers shrubs under trees, and puts the expensive drawings, a mature
 * oak, a ninebark in flower, where a camera looks. Those are the gardens the
 * sprite cache, the opening preparation and fast-forward have to hold up on.
 *
 * Planting goes through the app's own placePlantAt, so every rule a gardener
 * meets applies: nothing on paving or water, a shrub spaced from its neighbours
 * the way a drag spaces them, a climber only on a frame. Seeded, so a rebuild
 * that changes no code changes no file.
 */
const fs = require('fs');
const path = require('path');
const { root, gameSources, runTier } = require('../tests/sandbox');

const argv = process.argv.slice(2);
const onlyAt = argv.indexOf('--only');
const ONLY = onlyAt >= 0 ? argv[onlyAt + 1] : null;
const outDir = path.resolve(argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only') || path.join(root, 'dev', 'test-gardens'));

/* Plant lists. 'key' or 'key:cultivar'. A name the catalog no longer has is
   skipped with a warning rather than failing the build. */
const CANOPY = ['whiteoak', 'redoak', 'sugarmaple', 'redmaple:octoberglory', 'americanbeech', 'tuliptree', 'blackgum', 'shagbarkhickory',
  'sweetgum', 'americanelm:princeton', 'honeylocust:skyline', 'ginkgo', 'riverbirch:heritage', 'basswood', 'swampwhiteoak'];
const CONIFERS = ['whitepine', 'easternhemlock', 'norwayspruce', 'bluespruce', 'arborvitae:smaragd', 'greengiantarborvitae', 'redcedar',
  'whitefir', 'serbianspruce', 'baldcypress', 'dawnredwood', 'douglasfir', 'scotspine', 'hinokicypress', 'blueatlascedar'];
const UNDERSTORY = ['floweringdogwood', 'redbud', 'redbud:forestpansy', 'serviceberry:autumnbrilliance', 'crabapple:prairifire', 'japanesemaple:bloodgood',
  'japanesemaple:sangokaku', 'magnolia:royalstar', 'saucermagnolia', 'floweringcherry:yoshino', 'floweringcherry:kanzan', 'fringetree',
  'americanhornbeam', 'sourwood', 'pawpaw', 'treelilac:ivorysilk', 'hawthorn', 'riverbirchmulti', 'sweetbaymagnolia', 'yellowwood'];
const SUN_SHRUBS = ['ninebark', 'ninebark:diabolo', 'ninebark:summerwine', 'ninebark:amberjubilee', 'ninebark:tinywine', 'ninebark:dartsgold', 'ninebark:gingerwine',
  'lilac', 'misskimlilac', 'bloomeranglilac', 'japanesespirea:goldflame', 'japanesespirea:magiccarpet', 'bridalwreath', 'weigela', 'weigela:alexandra',
  'mockorange', 'forsythia', 'smokebush:royalpurple', 'smokebush:grace', 'coppicedsmokebush', 'panniclehydrangea:limelight', 'panniclehydrangea:littlelime',
  'panniclehydrangea:quickfire', 'bonicarose', 'cinquefoil', 'highbushblueberry', 'staghornsumac:bailtiger', 'sumac:growlow', 'americanelder',
  'buttonbush', 'mugopine', 'birdsnestspruce', 'chokeberry', 'newjersey', 'leadplant'];
const SHADE_SHRUBS = ['oakleafhydrangea', 'oakleafhydrangea:rubyslippers', 'smoothhydrangea:annabelle', 'hydrangea:endlesssummer', 'bigleaflace', 'arrowwood', 'arrowwood:bluemuffin',
  'cranberrybush', 'koreanspice', 'doublefile', 'blackhaw', 'redtwig:arcticfire', 'redtwig', 'winterberry', 'winterberry:redsprite', 'inkberry', 'catawbarhododendron',
  'swampazalea', 'mountainlaurel', 'fothergilla', 'summersweet', 'virginiasweetspire', 'commonwitchhazel', 'arnoldwitchhazel', 'spicebush', 'pieris', 'coralberry',
  'chokeberry:autumnmagic', 'blueholly', 'yewmedium'];
const SUN_FORBS = ['echinacea', 'echinacea:whiteswan', 'pallida', 'liatris', 'liatrispycnostachya', 'monarda', 'scarletbeebalm', 'amsonia', 'amsonia:stringtheory',
  'newengland', 'phlox', 'rattlesnake', 'baptisia', 'goldenrod', 'sedum', 'purpleemperor', 'culvers', 'stachys', 'yarrow:moonshine', 'mountainmint', 'penstemon:huskersred',
  'butterfly', 'showymilkweed', 'joepye', 'greatburnet', 'meadowsage', 'eryngiumbourgatii', 'prairiesmoke', 'rustyfoxglove', 'lavender'];
const SUN_GRASS = ['bluestem', 'bluestem:standingovation', 'dropseed', 'moorhexe', 'pinkmuhly', 'overdam', 'mexicanfeather', 'switchgrass', 'karl'];
const SHADE_FORBS = ['hosta', 'heuchera', 'solomonsseal', 'wildgeranium', 'whitewoodaster', 'bluestemmedgoldenrod', 'goatsbeard', 'astilbe', 'astilbe:fanal',
  'lentenrose', 'foxglove', 'whiteturtlehead', 'creepingphlox', 'persicaria', 'christmasfern', 'ostrichfern', 'ladyfern:ladyinred', 'japanesepaintedfern',
  'hayscentedfern', 'cinnamonfern', 'goldiefern', 'royalfern', 'hollyfern'];
const SHADE_MATRIX = ['pennsedge', 'christmasfern', 'hayscentedfern', 'wildgeranium', 'whitewoodaster', 'creepingphlox'];
const BULBS = ['daffodil:dutchmaster', 'alliumsphaerocephalon', 'alliumChristophii', 'alliumGladiator', 'crocus', 'camassia', 'tulip'];
const WATER = ['commoncattail', 'softstembulrush', 'waterlotus', 'waterblueflag', 'pickerelweed', 'arrowhead'];

const RECIPES = [
  { id: 'woodland', name: 'Test: woodland 69 ft', n: 46, seed: 0x51ED01, day: 26, style: 'woodland',
    border: 5, lobes: 3, phase: 0.6, woods: [[0.30, 0.30, 0.34, 0.33], [0.72, 0.36, 0.26, 0.30], [0.50, 0.72, 0.40, 0.22]], islands: [],
    glade: [0.52, 0.48, 0.14, 0.11], pond: [0.30, 0.66, 0.06, 0.05], patio: null, trail: true, pathC: 'bark',
    canopy: 20, conifers: 9, understory: 16, shrubGroups: 34, drifts: 60, matrix: 0.5, bulbs: 0.10 },
  { id: 'shrub-border', name: 'Test: shrub border 93 ft', n: 62, seed: 0x51ED02, day: 22, style: 'cottage',
    border: 9, lobes: 5, phase: 1.9, woods: [[0.16, 0.18, 0.15, 0.16]], islands: [[0.36, 0.42, 0.10, 0.07], [0.66, 0.34, 0.08, 0.10], [0.50, 0.62, 0.07, 0.05]],
    glade: null, pond: [0.74, 0.66, 0.07, 0.05], patio: [0.40, 0.76, 0.60, 0.86],
    canopy: 9, conifers: 14, understory: 22, shrubGroups: 120, drifts: 120, matrix: 0.55, bulbs: 0.12 },
  { id: 'arboretum', name: 'Test: arboretum quarter acre', n: 69, seed: 0x51ED03, day: 40, style: 'prairie',
    border: 6, lobes: 4, phase: 0.2, woods: [[0.22, 0.24, 0.20, 0.20], [0.78, 0.74, 0.18, 0.20]],
    islands: [[0.50, 0.30, 0.09, 0.07], [0.30, 0.62, 0.08, 0.09], [0.66, 0.50, 0.07, 0.07], [0.48, 0.80, 0.10, 0.05], [0.80, 0.26, 0.07, 0.08]],
    glade: null, pond: [0.50, 0.52, 0.06, 0.05], patio: null, meadow: [0.40, 0.44, 0.30, 0.26],
    canopy: 40, conifers: 34, understory: 40, shrubGroups: 90, drifts: 130, matrix: 0.5, bulbs: 0.10 },
  { id: 'estate', name: 'Test: estate 140 ft', n: 93, seed: 0x51ED04, day: 24, style: 'any',
    border: 10, lobes: 6, phase: 2.6, woods: [[0.18, 0.20, 0.17, 0.18], [0.82, 0.22, 0.15, 0.17], [0.20, 0.80, 0.16, 0.15]],
    islands: [[0.40, 0.36, 0.08, 0.06], [0.62, 0.40, 0.07, 0.07], [0.50, 0.56, 0.09, 0.05], [0.34, 0.58, 0.06, 0.07], [0.70, 0.60, 0.07, 0.06], [0.52, 0.24, 0.08, 0.05]],
    glade: null, pond: [0.76, 0.76, 0.07, 0.06], patio: [0.42, 0.78, 0.58, 0.88], meadow: [0.56, 0.46, 0.14, 0.10],
    canopy: 58, conifers: 46, understory: 62, shrubGroups: 240, drifts: 330, matrix: 0.55, bulbs: 0.12 },
];

const AUTHOR = `
globalThis.__makeGarden=function(R,L){
  const N=R.n, warn=[];
  setWorldSize(N,N);
  for (const Ly of GAME_LAYERS)
    if (game[Ly.k] && typeof game[Ly.k]==='object' && !Array.isArray(game[Ly.k])) game[Ly.k]={};
  game.houses=[]; game.buildings=[]; game.underlay=null; game.schemes=[]; game.schemeActive=null;
  game.edgeStyle='organic'; game.siteNorthDeg=0; game.freePlanting=true;
  game.design={zone:6,type:R.style,nativeRegion:'north-america',nativeMode:'any',deer:false,rabbit:false,squirrel:false};
  game.filters=normalizeFilters(game.design);
  game.worldName=R.name; game.dayOffset=R.day;
  game.previewMode='today';                  // the view a clock is watched in, and the costlier one

  const rnd=mulberry(R.seed), K=(x,y)=>x+','+y;
  const inPlot=(x,y)=>x>=1&&y>=1&&x<N-1&&y<N-1;      // the outer ring is the fence line
  const edgeD=(x,y)=>Math.min(x,y,N-1-x,N-1-y);
  const wav=(x,y)=>{ const a=Math.atan2(y-N/2,x-N/2);
    return 1+0.30*Math.sin(a*R.lobes+R.phase)+0.12*Math.sin(a*(R.lobes*2+1)+R.phase*0.5); };
  const bDepth=(x,y)=>R.border*wav(x,y);
  const ell=(x,y,e)=>{ const dx=(x-e[0]*N)/(e[2]*N), dy=(y-e[1]*N)/(e[3]*N); return dx*dx+dy*dy; };
  const inAny=(x,y,list)=>!!list && list.some(e=>ell(x,y,e)<=1);
  const inRect=(x,y,r)=>!!r && x>=Math.round(r[0]*N) && x<=Math.round(r[2]*N) && y>=Math.round(r[1]*N) && y<=Math.round(r[3]*N);
  const zone=(x,y)=>{
    if (!inPlot(x,y)) return 'fence';
    if (inRect(x,y,R.patio)) return 'patio';
    if (R.pond && ell(x,y,R.pond)<=1) return 'pond';
    if (R.glade && ell(x,y,R.glade)<=1) return 'lawn';
    const d=edgeD(x,y), bd=bDepth(x,y);
    if (Math.abs(d-(bd+1.2))<0.85 && !inAny(x,y,R.woods)) return 'path';
    if (Math.abs(x-N/2)<1 && y>N/2 && d<bd+1.2) return 'path';      // the way in from the gate
    // a trail winding through the trees, so a woodland has somewhere to walk and to light
    if (R.trail && y>2 && y<N-2 && Math.abs(x-(N/2+N*0.17*Math.sin(y*0.2)))<1) return 'path';
    if (inAny(x,y,R.woods)) return 'woods';
    if (d<bd) return 'border';
    if (inAny(x,y,R.islands)) return 'island';
    if (R.meadow && ell(x,y,R.meadow)<=1) return 'meadow';
    return 'lawn';
  };
  const Z=new Array(N*N);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) Z[y*N+x]=zone(x,y);
  const zoneAt=(x,y)=>(x<0||y<0||x>=N||y>=N)?'off':Z[y*N+x];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const z=Z[y*N+x], k=K(x,y);
    if (z==='patio') setTile('terrain',k,{k:'path',c:'bluestone',t:1});
    else if (z==='pond') setTile('terrain',k,{k:'water',c:'pond',t:1});
    else if (z==='path') setTile('terrain',k,{k:'path',c:R.pathC||'warm',t:1});
    else if (z==='woods') setTile('terrain',k,{k:'bed',c:'leaf',t:1});
    else if (z==='border') setTile('terrain',k,{k:'bed',c:'mulch',e:'steel',t:1});
    else if (z==='island') setTile('terrain',k,{k:'bed',c:'mulch',e:'spade',t:1});
    else if (z==='meadow') setTile('terrain',k,{k:'lawn',c:'meadow',t:1});
  }
  // the fence, with a two-tile gate where the path arrives
  const gx=Math.round(N/2);
  for (let i=0;i<N;i++) for (const [x,y] of [[i,0],[i,N-1],[0,i],[N-1,i]]){
    if (game.fences[K(x,y)]) continue;
    const gate=y===N-1 && (x===gx||x===gx-1);
    setTile('fences',K(x,y),{style:R.id==='woodland'?'rail':'privacy',height:R.id==='woodland'?4:6,gate,t:1});
  }
  markGroundChanged(); markModelChanged();

  const ok=ref=>{ const p=ref.split(':'); const P=PLANTS[p[0]];
    if (!P || (p[1] && !(P.cv&&P.cv[p[1]]))){ if (warn.indexOf(ref)<0) warn.push(ref); return false; } return true; };
  const list=name=>(L[name]||[]).filter(ok);
  /* placePlantAt asks the tree and shrub indexes on every call, and each rescans
     the whole planting after any plant edit: fine for a gardener's stroke, minutes
     for ten thousand placements. A plant that is neither cannot change either
     list, so its edit is marked as seen (the estate: over five minutes to seconds). */
  const put=(ref,x,y,age)=>{ const p=ref.split(':'); game.tool=p[0]; game.toolVar=p[1]||null; game.woodyAge=age||'mature';
    const P=PLANTS[p[0]], tree=isTreeDef(P), shrub=isShrubDef(P);
    if (!tree){ treeIndex(); if (!shrub) shrubIndex(); }
    const r=placePlantAt(x,y,{});
    if (!tree){ treeIndexCache.rev=game.plantsRev; if (!shrub) shrubIndexCache.rev=game.plantsRev; }
    return r; };
  const pick=a=>a[(rnd()*a.length)|0];
  const counts={tree:0,shrub:0,herb:0,bulb:0,water:0,vine:0};

  // ---- trees: farthest apart first, then the understory between them ----
  const trees=[];
  const treeAt=(ref,x,y,scale)=>{
    const p=ref.split(':'), P=plantDef(p[0],p[1]||null), sep=Math.max(2.4,((P.spread||160)/TILE_IN)*scale);
    for (const t of trees){ const dx=t.x-x, dy=t.y-y, m=(sep+t.sep)/2; if (dx*dx+dy*dy<m*m) return false; }
    /* The one planting written directly. Each tree planted changes the shade
       map, which the next placePlantAt would rebuild in full to ask a question
       a tree is never refused on: a hundred and sixty rebuilds on the estate.
       The checks here are the ones that apply to a trunk: open ground, a free tile. */
    const k=K(x,y), tz=zoneAt(x,y);
    if (tz==='path'||tz==='pond'||tz==='patio'||tz==='fence'||game.plants[k]) return false;
    const rec={s:p[0],d:woodyPlantedDay(P,'mature'),t:1}; if (p[1]) rec.v=p[1];
    setTile('plants',k,rec);
    trees.push({x,y,sep,ref}); counts.tree++; return true;
  };
  const scatterTrees=(refs,n,want,scale)=>{ let placed=0, guard=0;
    if (!refs.length) return 0;
    while (placed<n && guard++<n*500){
      const x=1+((rnd()*(N-2))|0), y=1+((rnd()*(N-2))|0);
      if (!want(zoneAt(x,y),x,y)) continue;
      if (treeAt(pick(refs),x,y,scale)) placed++;
    }
    return placed; };
  const back=(z,x,y)=>z==='woods' || (z==='border' && edgeD(x,y)<bDepth(x,y)*0.55);
  scatterTrees(list('CANOPY'),R.canopy,(z,x,y)=>back(z,x,y)||(z==='lawn'&&rnd()<0.25)||z==='meadow',0.34);
  scatterTrees(list('CONIFERS'),R.conifers,(z,x,y)=>z==='border'&&edgeD(x,y)<bDepth(x,y)*0.5 || (z==='woods'&&rnd()<0.4) || (z==='lawn'&&rnd()<0.12),0.5);
  scatterTrees(list('UNDERSTORY'),R.understory,(z,x,y)=>z==='woods'||z==='border'||z==='island'||(z==='lawn'&&rnd()<0.1),0.42);

  // ---- shrubs, in groups of one kind, spaced as a drag spaces them ----
  const shaded=(x,y)=>!!shadeInfoAt(x,y,false,true);
  const bedZone=z=>z==='woods'||z==='border'||z==='island';
  const sunShrubs=list('SUN_SHRUBS'), shadeShrubs=list('SHADE_SHRUBS');
  withShrubAutoSpacing(()=>{
    let groups=0, guard=0;
    while (groups<R.shrubGroups && guard++<R.shrubGroups*14){
      const cx=1+((rnd()*(N-2))|0), cy=1+((rnd()*(N-2))|0), z=zoneAt(cx,cy);
      if (!bedZone(z)) continue;
      const pool=(z==='woods'||shaded(cx,cy)) ? shadeShrubs : sunShrubs;
      if (!pool.length) continue;
      const ref=pick(pool), want=2+((rnd()*5)|0);
      let placed=0;
      for (let r=0;r<=3&&placed<want;r++) for (let dy=-r;dy<=r&&placed<want;dy++) for (let dx=-r;dx<=r&&placed<want;dx++){
        if (Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
        const x=cx+dx, y=cy+dy;
        if (!inPlot(x,y) || !bedZone(zoneAt(x,y)) || game.plants[K(x,y)]) continue;
        if (put(ref,x,y,'mature')==='plant'){ placed++; counts.shrub++; }
      }
      if (placed) groups++;
    }
  });
  // a clipped hedge round the patio, the one place a design asks for a straight line
  if (R.patio && PLANTS.boxwoodsquare){
    const x0=Math.round(R.patio[0]*N)-1, x1=Math.round(R.patio[2]*N)+1, y0=Math.round(R.patio[1]*N)-1;
    for (let x=x0;x<=x1;x++) if (Math.abs(x-N/2)>1.5){
      if (!game.terrain[K(x,y0)]) setTile('terrain',K(x,y0),{k:'bed',c:'mulch',t:1});
      if (put('boxwoodsquare',x,y0,'mature')==='plant') counts.shrub++;
    }
  }

  // ---- perennials: drifts, then a matrix through what is left ----
  const sunForbs=list('SUN_FORBS'), shadeForbs=list('SHADE_FORBS'), sunGrass=list('SUN_GRASS'), shadeMatrix=list('SHADE_MATRIX');
  let drifts=0, dguard=0;
  while (drifts<R.drifts && dguard++<R.drifts*40){
    const cx=1+((rnd()*(N-2))|0), cy=1+((rnd()*(N-2))|0), z=zoneAt(cx,cy);
    if (!bedZone(z)) continue;
    const pool=(z==='woods'||shaded(cx,cy)) ? shadeForbs : (rnd()<0.22 ? sunGrass : sunForbs);
    if (!pool.length) continue;
    const ref=pick(pool), r=1.5+rnd()*1.9;
    let n=0;
    for (let yy=Math.floor(cy-r);yy<=Math.ceil(cy+r);yy++) for (let xx=Math.floor(cx-r);xx<=Math.ceil(cx+r);xx++){
      if (!inPlot(xx,yy) || !bedZone(zoneAt(xx,yy))) continue;
      const d=Math.hypot(xx-cx,yy-cy);
      if (d<=r-0.5 || (d<=r+0.4 && rnd()<0.5)){ if (put(ref,xx,yy)==='plant'){ n++; counts.herb++; } }
    }
    if (n) drifts++;
  }
  for (let y=1;y<N-1;y++) for (let x=1;x<N-1;x++){
    const z=zoneAt(x,y);
    if (!bedZone(z) || rnd()>R.matrix) continue;
    const pool=(z==='woods'||shaded(x,y)) ? shadeMatrix : sunGrass;
    if (pool.length && put(pick(pool),x,y)==='plant') counts.herb++;
  }
  const bulbs=list('BULBS');
  if (bulbs.length) for (let y=1;y<N-1;y++) for (let x=1;x<N-1;x++){
    if (!bedZone(zoneAt(x,y)) || rnd()>R.bulbs) continue;
    // bulbs come in handfuls of one kind
    const ref=bulbs[((x*0.31+y*0.17)|0)%bulbs.length];
    if (put(ref,x,y)==='bulb') counts.bulb++;
  }
  // the pond's margin and a few floating leaves
  const water=list('WATER');
  if (R.pond && water.length) for (let y=1;y<N-1;y++) for (let x=1;x<N-1;x++){
    if (zoneAt(x,y)!=='pond') continue;
    const e=ell(x,y,R.pond);
    if ((e>0.55 && rnd()<0.5) || (e<0.3 && rnd()<0.16)){
      if (put(e>0.55?pick(water.filter(w=>w!=='waterlotus')):'waterlotus',x,y)==='plant') counts.water++;
    }
  }

  // ---- the patio: a pergola, a table, a fire, lights along the path ----
  if (R.patio){
    const x0=Math.round(R.patio[0]*N), x1=Math.round(R.patio[2]*N), y0=Math.round(R.patio[1]*N), y1=Math.round(R.patio[3]*N);
    const px1=x0+Math.min(8,Math.floor((x1-x0)*0.55)), py1=y0+Math.min(7,y1-y0);
    for (let y=y0;y<=py1;y++) for (let x=x0;x<=px1;x++) setTile('pergolas',K(x,y),{mat:'timber',height:8,lights:'festoon',t:1});
    setTile('seats',K(x0+2,y0+2),{type:'dining',finish:'teak',face:0,t:1});
    setTile('seats',K(x0+1,y0+2),{type:'dchair',finish:'teak',face:1,t:1});
    setTile('seats',K(x0+5,y0+2),{type:'dchair',finish:'teak',face:3,t:1});
    setTile('firepits',K(x1-4,y0+2),{style:'stone',finish:'fieldstone',shape:'round',size:'round36',face:0,t:1});
    setTile('seats',K(x1-6,y0+3),{type:'chair',finish:'forest',face:1,t:1});
    setTile('seats',K(x1-1,y0+3),{type:'chair',finish:'forest',face:3,t:1});
    setTile('pots',K(x1,y1),{style:'terracotta',size:'p24',finish:'',face:0,t:1});
    if (PLANTS.americanwisteria && put('americanwisteria',x0,y0,'mature')==='plant') counts.vine++;
  }
  let lights=0;
  for (let y=2;y<N-2;y++) for (let x=2;x<N-2;x++){
    if (zoneAt(x,y)!=='path' || ((x*7+y*13)%11)!==0) continue;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const k=K(x+dx,y+dy), z=zoneAt(x+dx,y+dy);
      if ((z==='border'||z==='lawn'||z==='island'||z==='woods') && !game.plants[k] && !game.lights[k]){
        setTile('lights',k,{type:'path',tone:'warm',finish:'black',t:1}); lights++; break; }
    }
  }
  // an uplight under every fifth tree
  trees.forEach((t,i)=>{ if (i%5) return; const k=K(t.x+1,t.y);
    if (inPlot(t.x+1,t.y) && !game.plants[k] && !game.lights[k] && zoneAt(t.x+1,t.y)!=='path' && zoneAt(t.x+1,t.y)!=='pond'){
      setTile('lights',k,{type:'uplight',tone:'warm',finish:'black',t:1}); lights++; } });
  const rocks=['large3','medium2','group3','ledge32','standing1'];
  let boulders=0;
  for (let i=0;i<Math.round(N/8);i++){
    const x=2+((rnd()*(N-6))|0), y=2+((rnd()*(N-6))|0), k=K(x,y);
    if (zoneAt(x,y)!=='lawn' || game.plants[k]) continue;
    game.tool='boulder'; game.boulderDraft=normalizeBoulderDraft({type:rocks[i%rocks.length]});
    if (applyToolAt(x,y)) boulders++;
  }
  game.tool='hand'; game.toolVar=null;
  markModelChanged(); markGroundChanged();
  return { env:{ pocketPrairie:1, v:1, exported:0, world:buildSaveBlob() }, counts, lights, boulders, warn };
};
`;

fs.mkdirSync(outDir, { recursive: true });
const LISTS = { CANOPY, CONIFERS, UNDERSTORY, SUN_SHRUBS, SHADE_SHRUBS, SUN_FORBS, SUN_GRASS, SHADE_FORBS, SHADE_MATRIX, BULBS, WATER };
let failed = false;
for (const R of RECIPES) {
  if (ONLY && R.id !== ONLY) continue;
  // a sandbox apiece: one garden's revisions and caches are no business of the next
  const call = `globalThis.__RESULT=globalThis.__makeGarden(${JSON.stringify(R)},${JSON.stringify(LISTS)});`;
  const r = runTier('test-garden-' + R.id, [...gameSources(), AUTHOR, call], true);
  if (!r.ok) { console.error('Failed to build ' + R.id + ':\n' + r.err); failed = true; continue; }
  const res = r.sandbox.__RESULT, env = res.env;
  env.exported = 0; env.world.startTs = 0; env.world.savedAt = 0;      // a rebuild that changes nothing changes no file
  for (const layer of Object.keys(env.world))
    if (env.world[layer] && typeof env.world[layer] === 'object' && !Array.isArray(env.world[layer]))
      for (const k in env.world[layer]) { const rec = env.world[layer][k]; if (rec && typeof rec === 'object' && typeof rec.t === 'number') rec.t = 1; }
  const file = path.join(outDir, R.id + '.prairie.json');
  fs.writeFileSync(file, JSON.stringify(env) + '\n');
  const c = res.counts, ft = Math.round(R.n * 18 / 12);
  console.log(`${path.basename(file).padEnd(30)} ${String((fs.statSync(file).size / 1024).toFixed(0)).padStart(5)} KB  ${R.n}x${R.n} tiles (${ft} ft)  `
    + `${c.tree} trees, ${c.shrub} shrubs, ${c.herb} perennials and grasses, ${c.bulb} bulbs, ${c.water} water plants, ${res.lights} lights`);
  if (res.warn.length) console.log('  not in the catalog, skipped: ' + res.warn.join(', '));
}
process.exit(failed ? 1 : 0);
