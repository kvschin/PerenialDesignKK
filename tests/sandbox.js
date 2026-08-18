'use strict';
/* The `vm` sandbox that lets the real browser modules load under Node.

   Extracted from run.js so it has two consumers rather than one: the test
   runner, and dev/make-demo-garden.js, which authors the bundled demo garden by
   calling the app's OWN buildSaveBlob() instead of hand-rolling the save format.
   A generator that reimplemented the format would drift from it silently, and
   the demo garden is the first thing a new gardener ever opens.

   The stubs are deliberately minimal — only what loading js/*.js touches. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/* Load order matters in the browser and is mirrored here. The runner
   concatenates, so this will NOT catch cross-file hoisting bugs — only the
   browser will. */
const GAME_MODULES = [
  'core.js','draw.js','world.js','view.js','renderer.js','commands.js','input.js',
  'io.js','collections.js','ui.js','tray.js','library.js','screens.js'
];
const gameSources = () => [read('js/plants.js'), ...GAME_MODULES.map(f => read('js/' + f))];

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
/* key() and length are REAL. They used to be `() => null` and `0`, which is a
   harness that lies: any code enumerating storage saw an empty store, so the
   localStorage->IndexedDB migration and the orphaned-garden scan were both
   untestable, and an assertion written against them passed vacuously. */
function makeStorage(){
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => { const keys = [...m.keys()]; return (i >= 0 && i < keys.length) ? keys[i] : null; },
    get length(){ return m.size; }
  };
}

/* `extras` is whatever the consumer wants visible inside the sandbox — the test
   runner injects test/assert, the generator injects nothing. */
function makeSandbox(withDom, extras){
  const sb = {
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, Symbol,
    parseInt, parseFloat, isNaN, isFinite, Promise, Error, TypeError,
    Uint8ClampedArray, Float32Array, Uint32Array,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  };
  Object.assign(sb, extras || {});
  if (withDom){
    Object.assign(sb, {
      document: documentStub, localStorage: makeStorage(),
      addEventListener(){}, removeEventListener(){},
      requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
      performance: { now: () => 0 },
      matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
      location: { href: '', search: '', hash: '' }, navigator: { userAgent: 'node', language: 'en' },
      /* getRandomValues must actually RANDOMISE. The old stub returned the
         buffer untouched, which is a harness that lies: any id built from it
         came out all-zeros and identical, so the suite would have reported
         collisions that the real browser never has — and, worse, could have
         passed code that silently depended on the buffer being filled. */
      crypto: {
        randomUUID: () => 'test-uuid-0000',
        getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; }
      },
      Image: function(){ return makeEl('img'); }, Audio: function(){ return { play(){}, pause(){} }; },
      fetch: () => Promise.reject(new Error('no network here')),
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
      alert(){}, confirm(){ return false; }, prompt(){ return null; },
    });
    sb.window = sb; sb.self = sb; sb.globalThis = sb;
  }
  return sb;
}

/* Run a set of sources in one fresh sandbox. Returns {ok} or {ok:false,err}. */
function runTier(label, sources, withDom, extras){
  const sandbox = makeSandbox(withDom, extras);
  vm.createContext(sandbox);
  try {
    vm.runInContext(sources.join('\n;\n'), sandbox, { filename: label });
    return { ok: true, sandbox };
  } catch (e){
    return { ok: false, err: (e && e.stack) || String(e), sandbox };
  }
}

module.exports = { root, read, GAME_MODULES, gameSources, makeSandbox, runTier, makeEl };
