'use strict';
/* Zero-dependency test runner for Pocket Prairie.
   The game is plain browser JS with no module exports, so we load the real
   source files inside a `vm` sandbox:
     - plants.js is pure data -> runs with no stubs (Tier 1: data contract).
     - the ordered js/ modules load with light browser stubs; then we call the
       real pure functions (Tier 2: logic + a render smoke test).
   Each *.test.js file is concatenated after the source it exercises and uses
   the injected `test()` / `assert()` globals.  Run: `node tests/run.js`. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// ---------- result collection (lives in Node scope, shared with the sandbox) ----------
const results = [];
let currentFile = '';
function test(name, fn){
  try { fn(); results.push({ file: currentFile, name, ok: true }); }
  catch (e){ results.push({ file: currentFile, name, ok: false, err: (e && e.message) || String(e) }); }
}
function assert(cond, msg){ if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg){ if (a !== b) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// ---------- minimal browser stubs (only what loading the browser modules needs) ----------
function makeCtx(){
  return new Proxy({}, {
    get(o, p){
      if (p === 'measureText') return () => ({ width: 0 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern')
        return () => ({ addColorStop(){} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p in o) return o[p];
      return () => {};               // any unknown canvas method is a no-op
    },
    set(o, p, v){ o[p] = v; return true; }
  });
}
const CTX = makeCtx();
function makeEl(tag){
  const el = {
    tagName: (tag || 'div').toUpperCase(), nodeType: 1,
    classList: { _s: new Set(),
      add(...c){ c.forEach(x => this._s.add(x)); },
      remove(...c){ c.forEach(x => this._s.delete(x)); },
      toggle(c, f){ const on = f === undefined ? !this._s.has(c) : !!f; on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c){ return this._s.has(c); } },
    style: { setProperty(){}, removeProperty(){} }, dataset: {}, children: [],
    appendChild(c){ this.children.push(c); return c; }, append(...c){ this.children.push(...c); },
    prepend(){}, remove(){}, removeChild(c){ return c; }, insertBefore(c){ return c; },
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, removeAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    getContext(){ return CTX; }, getBoundingClientRect(){ return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    focus(){}, click(){}, setPointerCapture(){}, releasePointerCapture(){}, scrollIntoView(){},
    width: 300, height: 150, value: '', textContent: '', innerHTML: '', placeholder: '', id: '', checked: false,
  };
  return new Proxy(el, {
    get(o, p){ if (p in o) return o[p]; if (typeof p === 'symbol') return undefined; return () => {}; },
    set(o, p, v){ o[p] = v; return true; }
  });
}
const documentStub = {
  getElementById(){ return makeEl(); }, querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
  createElement(t){ return makeEl(t); }, createElementNS(){ return makeEl(); },
  body: makeEl(), documentElement: makeEl(), head: makeEl(),
  addEventListener(){}, removeEventListener(){}, hidden: false,
  fonts: { ready: Promise.resolve(), add(){}, load(){ return Promise.resolve(); } },
};
const storage = (() => { const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
           removeItem: k => m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }; })();

function makeSandbox(withDom){
  const sb = {
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, Symbol,
    parseInt, parseFloat, isNaN, isFinite, Promise, Error, TypeError,
    Uint8ClampedArray, Float32Array, Uint32Array,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    test, assert, assertEqual,
  };
  if (withDom){
    Object.assign(sb, {
      document: documentStub, localStorage: storage,
      addEventListener(){}, removeEventListener(){},
      requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
      performance: { now: () => 0 },
      matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
      location: { href: '', search: '', hash: '' }, navigator: { userAgent: 'node', language: 'en' },
      crypto: { randomUUID: () => 'test-uuid-0000', getRandomValues: a => a },
      Image: function(){ return makeEl('img'); }, Audio: function(){ return { play(){}, pause(){} }; },
      fetch: () => Promise.reject(new Error('no network in tests')),
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
      alert(){}, confirm(){ return false; }, prompt(){ return null; },
    });
    sb.window = sb; sb.self = sb; sb.globalThis = sb;
  }
  return sb;
}

function runTier(label, sources, withDom){
  const sandbox = makeSandbox(withDom);
  vm.createContext(sandbox);
  try {
    vm.runInContext(sources.join('\n;\n'), sandbox, { filename: label });
    return { ok: true };
  } catch (e){
    return { ok: false, err: (e && e.stack) || String(e) };
  }
}

// ---------- Tier 1: plants.js data contract (no DOM needed) ----------
currentFile = 'plants.test.js';
let r = runTier('plants', [read('js/plants.js'), read('tests/plants.test.js')], false);
if (!r.ok) results.push({ file: 'plants.test.js', name: 'load plants.js', ok: false, err: r.err });

// ---------- Tier 2: game logic + render smoke test (DOM-stubbed) ----------
// Game logic is split into ordered modules (under js/); load them in the same
// order the browser does (they share one global scope when concatenated here).
currentFile = 'game.test.js';
const GAME_MODULES = [
  'core.js','draw.js','world.js','view.js','renderer.js','commands.js','input.js',
  'io.js','ui.js','tray.js','library.js','screens.js'
];
r = runTier('game', [read('js/plants.js'), ...GAME_MODULES.map(f => read('js/' + f)), read('tests/game.test.js')], true);
if (!r.ok) results.push({ file: 'game.test.js', name: 'load game modules (DOM-stubbed)', ok: false, err: r.err });

// ---------- report ----------
const passed = results.filter(x => x.ok).length;
const failed = results.filter(x => !x.ok);
let lastFile = '';
for (const x of results){
  if (!x.ok) continue;
  if (x.file !== lastFile){ console.log(`\n${x.file}`); lastFile = x.file; }
  console.log(`  ✓ ${x.name}`);
}
if (failed.length){
  console.log('\nFAILURES');
  for (const x of failed)
    console.log(`  ✗ [${x.file}] ${x.name}\n      ${String(x.err).split('\n').slice(0, 3).join('\n      ')}`);
}
console.log(`\n${passed} passed, ${failed.length} failed, ${results.length} total`);
process.exit(failed.length ? 1 : 0);
