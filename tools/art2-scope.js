#!/usr/bin/env node
/* ART2 scope proof + perf harness (catalog-wide).
 *
 *   node tools/art2-scope.js scope        which refs move when ART2 flips on
 *   node tools/art2-scope.js base         which refs moved vs the BASE build
 *   node tools/art2-scope.js echinacea    per-season movement in the five
 *                                         species that shipped pre-calibrated
 *   node tools/art2-scope.js ops          paint-op counts, ART2 off vs on
 *   node tools/art2-scope.js perf [keys]  ms/plant, ART2 off vs on
 *   node tools/art2-scope.js diff K V S   first differing ops for one ref
 *
 * The spec's proof hashes canvas PIXELS in a browser. That answers "does the
 * flag change this species", which is the question for `scope`. It does NOT
 * answer "did my edits change the classic path for someone else" — a
 * regression there moves the off and on renders together and hashes clean.
 * So `base` loads a pre-change build in a second sandbox and diffs the
 * recorded draw-op STREAM (method + rounded args) with the flag OFF. Any
 * species that differs is a classic-path regression.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE_REF = process.env.ART2_BASE_REF || '7719093';
const MODULES = ['core.js','draw.js','world.js','view.js','renderer.js','commands.js','input.js',
                 'io.js','collections.js','ui.js','tray.js','library.js','screens.js'];
const WAVE_A = new Set(['cone','spike','umbel','globe','shrub','drumstick','pincushion','bractstack','airywand']);
const SEASONS = ['Spring','Summer','Fall','Winter'];

/* ---- a canvas context that RECORDS instead of painting -------------------- */
function recorder(){
  const log = [];
  const r = x => (typeof x === 'number' ? (Math.round(x * 100) / 100) : x);
  const grad = () => ({ addColorStop(a, c){ log.push('gstop|' + r(a) + '|' + c); } });
  const target = {
    measureText: () => ({ width: 0 }),
    createLinearGradient: (...a) => { log.push('lgrad|' + a.map(r)); return grad(); },
    createRadialGradient: (...a) => { log.push('rgrad|' + a.map(r)); return grad(); },
    createPattern: () => grad(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    __log: log,
  };
  return new Proxy(target, {
    get(o, p){
      if (p in o) return o[p];
      if (typeof p === 'symbol') return undefined;
      return (...a) => { log.push(String(p) + '|' + a.map(r).join(',')); };
    },
    set(o, p, v){ if (typeof p === 'string' && p !== '__log') log.push('SET ' + p + '=' + r(v)); o[p] = v; return true; },
  });
}
function fnv(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/* ---- load a build (working tree, or a git ref) into a sandbox ------------- */
function build(ref){
  const src = f => ref ? cp.execSync('git show ' + ref + ':' + f, {cwd: ROOT, maxBuffer: 1 << 28}).toString('utf8')
                       : fs.readFileSync(path.join(ROOT, f), 'utf8');
  const CTX = recorder();
  const el = () => new Proxy({
    classList:{add(){},remove(){},toggle(){return false;},contains(){return false;}},
    style:{setProperty(){},removeProperty(){}}, dataset:{}, children:[],
    appendChild(c){return c;}, append(){}, prepend(){}, remove(){}, removeChild(c){return c;},
    insertBefore(c){return c;}, addEventListener(){}, removeEventListener(){},
    setAttribute(){}, removeAttribute(){}, getAttribute(){return null;},
    querySelector(){return el();}, querySelectorAll(){return [];},
    getContext(){return CTX;}, getBoundingClientRect(){return {top:0,left:0,right:0,bottom:0,width:0,height:0};},
    focus(){}, click(){}, setPointerCapture(){}, releasePointerCapture(){}, scrollIntoView(){},
    width:300, height:150, value:'', textContent:'', innerHTML:'', id:'', checked:false, nodeType:1, tagName:'DIV',
  }, { get(o,p){ if(p in o) return o[p]; if(typeof p==='symbol') return undefined; return ()=>{}; },
       set(o,p,v){ o[p]=v; return true; } });
  const store = (()=>{ const m=new Map(); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),
    removeItem:k=>m.delete(k),clear:()=>m.clear(),key:()=>null,length:0}; })();
  const sb = {
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, Symbol, WeakMap,
    parseInt, parseFloat, isNaN, isFinite, Promise, Error, TypeError,
    Uint8ClampedArray, Float32Array, Float64Array, Uint32Array, Int32Array,
    setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{},
    document:{ getElementById:()=>el(), querySelector:()=>el(), querySelectorAll:()=>[],
      createElement:()=>el(), createElementNS:()=>el(), body:el(), documentElement:el(), head:el(),
      addEventListener(){}, removeEventListener(){}, hidden:false,
      fonts:{ready:Promise.resolve(),add(){},load(){return Promise.resolve();}} },
    localStorage: store, addEventListener(){}, removeEventListener(){},
    requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
    innerWidth:1024, innerHeight:768, devicePixelRatio:1,
    performance:{ now:()=>0 },
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}),
    location:{href:'',search:'',hash:''}, navigator:{userAgent:'node',language:'en'},
    crypto:{randomUUID:()=>'u',getRandomValues:a=>a},
    Image:function(){return el();}, Audio:function(){return {play(){},pause(){}};},
    fetch:()=>Promise.reject(new Error('no net')),
    getComputedStyle:()=>({getPropertyValue:()=>''}),
    alert(){}, confirm(){return false;}, prompt(){return null;},
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.createContext(sb);
  // PLANTS/drawPlant/ART2 are `const` at script top level, so they live in the
  // context's LEXICAL scope and never appear as properties of the sandbox
  // object. Bare assignments in an epilogue hand them out.
  const epilogue = ';globalThis.__PLANTS = PLANTS; globalThis.__drawPlant = drawPlant; globalThis.__ART2 = ART2; globalThis.__plantDef = plantDef;';
  vm.runInContext([src('js/plants.js'), ...MODULES.map(f => src('js/' + f))].join('\n;\n') + epilogue,
                  sb, {filename: ref || 'work'});
  return { sb, CTX, PLANTS: sb.__PLANTS, drawPlant: sb.__drawPlant, ART2: sb.__ART2, plantDef: sb.__plantDef };
}

function allRefs(b0){
  const out = [];
  for (const k of Object.keys(b0.PLANTS)){
    out.push([k, undefined]);
    const c = b0.PLANTS[k].cv;
    if (c) for (const v of Object.keys(c)) out.push([k, v]);
  }
  return out;
}
/* One ref's full draw-op stream: 4 seasons x 2 growth stages. */
function stream(b, k, v, on, seasons){
  b.ART2.on = on;
  const log = b.CTX.__log; log.length = 0;
  for (const s of (seasons || SEASONS)) for (const g of [0.45, 1]) b.drawPlant(b.CTX, 0, 0, k, g, s, 101, 0, v, 1);
  const out = log.join('\n');
  b.ART2.on = true;
  return out;
}

const mode = process.argv[2] || 'scope';

if (mode === 'scope'){
  const b = build(null);
  const refs = allRefs(b);
  const changed = refs.filter(([k, v]) => fnv(stream(b, k, v, false)) !== fnv(stream(b, k, v, true)))
                      .map(([k, v]) => k + (v ? '|' + v : ''));
  // The invariant is CHANGED == OPTED IN, not membership of any one wave.
  // (This started as a Wave A harness and hardcoded that wave's forms, which
  // reported every later wave as a stray once they landed.) A ref that moves
  // without look.art2 means a wave leaked outside its own branches; a ref that
  // carries look.art2 and does not move means the flag is claiming coverage
  // the code does not deliver.
  const opted = refs.filter(([k, v]) => ((b.plantDef(k, v) || {}).look || {}).art2)
                    .map(([k, v]) => k + (v ? '|' + v : ''));
  const optedSet = new Set(opted);
  const strays = changed.filter(x => !optedSet.has(x));
  const inert  = opted.filter(x => !changed.includes(x));
  console.log('total refs in catalog :', refs.length);
  console.log('opted in (look.art2)  :', opted.length);
  console.log('refs changed by flag  :', changed.length);
  console.log('STRAYS (moved, not opted in):', strays.length, strays.join(', ') || '(none)');
  console.log('INERT  (opted in, no move) :', inert.length, inert.join(', ') || '(none)');
  process.exit(strays.length ? 1 : 0);
}

if (mode === 'base'){
  const cur = build(null), old = build(BASE_REF);
  const refs = allRefs(old);                       // the base build's catalog
  const moved = [];
  for (const [k, v] of refs){
    if (fnv(stream(cur, k, v, false)) !== fnv(stream(old, k, v, false))) moved.push(k + (v ? '|' + v : ''));
  }
  console.log('base ref              :', BASE_REF);
  console.log('refs compared         :', refs.length);
  console.log('CLASSIC render moved  :', moved.length, moved.join(', ') || '(none)');
  // and, with ART2 ON, which refs differ from base — should be exactly wave A
  const onMoved = [];
  for (const [k, v] of refs){
    if (fnv(stream(cur, k, v, true)) !== fnv(stream(old, k, v, true))) onMoved.push(k + (v ? '|' + v : ''));
  }
  const inWave = new Set(refs.filter(([k]) => WAVE_A.has(old.PLANTS[k].form)).map(([k, v]) => k + (v ? '|' + v : '')));
  console.log('ART2-ON render moved  :', onMoved.length, ' of which outside wave A:',
              onMoved.filter(x => !inWave.has(x)).join(', ') || '(none)');
  process.exit(moved.length ? 1 : 0);
}

if (mode === 'ops'){
  const b = build(null);
  const PAINT = /^(fill|stroke|fillRect|strokeRect|drawImage|fillText)\|/;
  const byForm = {};
  for (const [k, v] of allRefs(b)){
    const f = b.PLANTS[k].form;
    if (!WAVE_A.has(f) || v) continue;
    const count = on => stream(b, k, v, on).split('\n').filter(l => PAINT.test(l)).length;
    const off = count(false), onn = count(true);
    (byForm[f] = byForm[f] || []).push([k, off, onn]);
  }
  console.log('form         species   classic ops   ART2 ops   ratio');
  let to = 0, tn = 0;
  for (const f of Object.keys(byForm).sort()){
    const rows = byForm[f];
    const o = rows.reduce((a, x) => a + x[1], 0), n = rows.reduce((a, x) => a + x[2], 0);
    to += o; tn += n;
    console.log(f.padEnd(13) + String(rows.length).padStart(5) + String(o).padStart(13) +
                String(n).padStart(11) + '   ' + (n / o).toFixed(2) + 'x');
    rows.sort((a, b2) => (b2[2] / b2[1]) - (a[2] / a[1]));
    console.log('   worst: ' + rows.slice(0, 3).map(x => x[0] + ' ' + x[1] + '->' + x[2] + ' (' + (x[2] / x[1]).toFixed(2) + 'x)').join(', '));
  }
  console.log('TOTAL'.padEnd(18) + String(to).padStart(13) + String(tn).padStart(11) + '   ' + (tn / to).toFixed(2) + 'x');
  process.exit(0);
}

if (mode === 'echinacea'){
  /* The five Echinacea shipped already calibrated with the primitives, so any
     movement in them from Wave A has to be deliberate and stated outright. */
  const cur = build(null), old = build(BASE_REF);
  const KEYS = [['echinacea'],['echinacea','magnus'],['echinacea','whiteswan'],
                ['pallida'],['topeka'],['angustifolia'],['paradoxa']];
  console.log('ref                      Spring  Summer    Fall  Winter');
  for (const [k, v] of KEYS){
    const cells = SEASONS.map(s =>
      (fnv(stream(cur, k, v, true, [s])) !== fnv(stream(old, k, v, true, [s]))) ? '  MOVED' : '   same');
    console.log((k + (v ? '|' + v : '')).padEnd(23) + cells.join(''));
  }
  process.exit(0);
}

if (mode === 'diff'){
  const k=process.argv[3], v=process.argv[4]==='-'?undefined:process.argv[4], sea=process.argv[5]||'Spring';
  const cur = build(null), old = build(BASE_REF);
  const a = stream(old, k, v, true, [sea]).split('\n');
  const b = stream(cur, k, v, true, [sea]).split('\n');
  console.log('base ops', a.length, ' current ops', b.length);
  let shown=0;
  for (let i=0;i<Math.max(a.length,b.length) && shown<14;i++){
    if (a[i]!==b[i]){ console.log(i+'  base: '+a[i]+'  |  curr: '+b[i]); shown++; }
  }
  process.exit(0);
}

if (mode === 'perf'){
  /* Wall-clock ms for the PROCEDURAL JS phase. The spec's risk was never
     painting, it was per-frame allocation, and that is exactly what this
     measures. A plain no-op context (not a Proxy — a get-trap returning a
     fresh closure per call would dominate the sample) keeps harness overhead
     constant across both sides, so the ratio is honest even though the
     absolute number excludes rasterisation. */
  const NOOP = {};
  for (const m of ['save','restore','beginPath','closePath','moveTo','lineTo','quadraticCurveTo',
    'bezierCurveTo','arc','arcTo','ellipse','rect','fill','stroke','clip','translate','scale',
    'rotate','transform','setTransform','resetTransform','drawImage','fillRect','strokeRect',
    'clearRect','fillText','strokeText','setLineDash','createImageData','putImageData'])
    NOOP[m] = function(){};
  NOOP.measureText = () => ({width:0});
  const GRAD = { addColorStop(){} };
  NOOP.createLinearGradient = () => GRAD;
  NOOP.createRadialGradient = () => GRAD;
  NOOP.createPattern = () => GRAD;
  NOOP.getImageData = () => ({data:new Uint8ClampedArray(4)});

  const b = build(null);
  const pick = process.argv.slice(3);
  const keys = pick.length ? pick
    : Object.keys(b.PLANTS).filter(k => WAVE_A.has(b.PLANTS[k].form));
  const med = a => { a = a.slice().sort((x,y)=>x-y); return a[a.length>>1]; };
  const REPS = 300, ROUNDS = 9;
  const time = (k,on) => {
    b.ART2.on = on;
    const t0 = process.hrtime.bigint();
    for (let i=0;i<REPS;i++) b.drawPlant(NOOP,0,0,k,1,'Summer',101+(i&7),0,undefined,1);
    return Number(process.hrtime.bigint()-t0)/1e6/REPS;
  };
  const rows = [];
  for (const k of keys){
    time(k,false); time(k,true);                        // warm
    const off=[], on=[];
    for (let r=0;r<ROUNDS;r++){ off.push(time(k,false)); on.push(time(k,true)); }
    rows.push({k, form:b.PLANTS[k].form, off:med(off), on:med(on)});
  }
  b.ART2.on = true;
  const byForm = {};
  for (const r of rows) (byForm[r.form] = byForm[r.form] || []).push(r);
  console.log('form          n   classic ms/plant   ART2 ms/plant   ratio   worst species');
  for (const f of Object.keys(byForm).sort()){
    const rs = byForm[f];
    const o = rs.reduce((a,x)=>a+x.off,0)/rs.length, n = rs.reduce((a,x)=>a+x.on,0)/rs.length;
    const w = rs.slice().sort((a,c)=>c.on-a.on)[0];
    console.log(f.padEnd(12)+String(rs.length).padStart(3)+o.toFixed(4).padStart(17)+
      n.toFixed(4).padStart(16)+(n/o).toFixed(2).padStart(8)+'x   '+
      w.k+' '+w.on.toFixed(4)+'ms ('+(w.on/w.off).toFixed(2)+'x)');
  }
  const O = rows.reduce((a,x)=>a+x.off,0)/rows.length, N = rows.reduce((a,x)=>a+x.on,0)/rows.length;
  console.log('ALL'.padEnd(12)+String(rows.length).padStart(3)+O.toFixed(4).padStart(17)+
    N.toFixed(4).padStart(16)+(N/O).toFixed(2).padStart(8)+'x');
  const over = rows.filter(r => r.on > 0.20).sort((a,c)=>c.on-a.on);
  console.log('over the 0.20ms/plant budget:', over.length,
    over.slice(0,8).map(r=>r.k+' '+r.on.toFixed(3)).join(', '));
  const ratioOver = rows.filter(r => r.on/r.off > 5).sort((a,c)=>(c.on/c.off)-(a.on/a.off));
  console.log('over the 5x ratio budget   :', ratioOver.length,
    ratioOver.slice(0,8).map(r=>r.k+' '+(r.on/r.off).toFixed(2)+'x').join(', '));
  /* Anchor. The ART2 commit published ONE real-canvas number: E. purpurea at
     0.19 ms/plant and 5.0x classic. This harness reads that same species
     high (no rasterisation, different machine/JIT), so scaling everything by
     that one known point puts the whole table in the units the budget is
     written in. Reported alongside the raw numbers, never instead of them. */
  const anchor = rows.find(r => r.k === 'echinacea');
  if (anchor){
    const kMs = 0.19 / anchor.on, kRatio = 5.0 / (anchor.on / anchor.off);
    const sc = rows.map(r => ({k:r.k, form:r.form, ms:r.on*kMs, ratio:(r.on/r.off)*kRatio}));
    const M = sc.reduce((a,x)=>a+x.ms,0)/sc.length, R = sc.reduce((a,x)=>a+x.ratio,0)/sc.length;
    console.log('');
    console.log('--- scaled to the published Echinacea anchor (0.19ms / 5.0x) ---');
    console.log('mean ms/plant '+M.toFixed(3)+'   mean ratio '+R.toFixed(2)+'x');
    const bad = sc.filter(x => x.ms > 0.20).sort((a,b)=>b.ms-a.ms);
    console.log('over 0.20ms  : '+bad.length+'  '+bad.slice(0,10).map(x=>x.k+' '+x.ms.toFixed(3)).join(', '));
    const badR = sc.filter(x => x.ratio > 5).sort((a,b)=>b.ratio-a.ratio);
    console.log('over 5x ratio: '+badR.length+'  '+badR.slice(0,10).map(x=>x.k+' '+x.ratio.toFixed(2)+'x').join(', '));
    const both = sc.filter(x => x.ms > 0.20 && x.ratio > 5).sort((a,b)=>b.ms-a.ms);
    console.log('BOTH         : '+both.length+'  '+both.map(x=>x.k+' '+x.ms.toFixed(3)+'/'+x.ratio.toFixed(1)+'x').join(', '));
  }
  process.exit(0);
}
