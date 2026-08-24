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
  'io.js','collections.js','ui.js','tray.js','photos.js','library.js','screens.js'
];
const gameSources = () => [read('js/plants.js'), ...GAME_MODULES.map(f => read('js/' + f))];

function makeCtx(){
  return new Proxy({}, {
    get(o, p){
      /* Scales with the string. A flat 0 meant any layout that fits text into a
         box "fit" whatever you gave it, so a wrapping or truncation assertion
         passed without measuring anything. ~6.2px/char is a rough Plex Sans
         average — wrong in the way an approximation is, not in the way zero is. */
      if (p === 'measureText') return t => ({ width: String(t == null ? '' : t).length * 6.2 });
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
    addEventListener(){}, removeEventListener(){},
    /* Attributes are really STORED. setAttribute used to be a no-op against a
       getAttribute that always returned null, so nothing written could ever be
       read back — which made memoising getElementById pointless and left
       showCoachTip's hasAttribute fallback (its behaviour when localStorage
       throws) permanently dead in tests. */
    _attrs: new Map(),
    setAttribute(k, v){ this._attrs.set(String(k), String(v)); },
    getAttribute(k){ const m = this._attrs; return m.has(String(k)) ? m.get(String(k)) : null; },
    hasAttribute(k){ return this._attrs.has(String(k)); },
    removeAttribute(k){ this._attrs.delete(String(k)); },
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    getContext(){ return CTX; }, getBoundingClientRect(){ return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    focus(){}, click(){}, setPointerCapture(){}, releasePointerCapture(){}, scrollIntoView(){},
    width: 300, height: 150, value: '', textContent: '', innerHTML: '', placeholder: '', id: '', checked: false,
    /* Declared FALSY on purpose. The Proxy below answers anything it does not
       recognise with a no-op function, which is truthy — so before these
       existed, `if (el.hidden)` and `if (el.disabled)` were always TAKEN in
       tests, silently inverting branches. Any data property real code branches
       on has to be listed here rather than left to the Proxy. */
    hidden: false, disabled: false, readOnly: false, open: false, className: '',
    offsetWidth: 0, offsetHeight: 0, offsetTop: 0, offsetLeft: 0,
    clientWidth: 0, clientHeight: 0, scrollWidth: 0, scrollHeight: 0,
    scrollLeft: 0, scrollTop: 0, selectedIndex: -1, files: null,
    parentNode: null, parentElement: null, firstChild: null, lastChild: null, nextSibling: null,
    // Explicitly non-answering rather than accidentally so: there is no tree
    // here to walk, and a caller should be able to read that from the stub.
    contains(){ return false; }, closest(){ return null; },
  };
  return new Proxy(el, {
    get(o, p){ if (p in o) return o[p]; if (typeof p === 'symbol') return undefined; return () => {}; },
    /* className and classList are two views of ONE fact in a browser, and the
       stub used to let them disagree: after el.className='x',
       classList.contains('x') answered false, which no browser does. Both
       idioms are in use across js/, so whichever a test happened to read
       decided whether it saw the truth — a stub reporting a convenient
       fiction, which is the failure this file keeps being caught by. Write
       through so the two views agree. */
    set(o, p, v){
      if (p === 'className'){
        o.classList._s = new Set(String(v || '').split(' ').filter(Boolean));
      }
      o[p] = v; return true;
    }
  });
}
/* getElementById MEMOISES. It used to hand back a brand-new element on every
   call, so the same id was never the same object: state written through one
   lookup was invisible to the next. That made a whole class of assertion pass
   for the wrong reason ("the button is not disabled" — of course, it is a fresh
   element), and it silently disabled showCoachTip's DOM-attribute fallback,
   which is the path taken when localStorage throws.

   querySelector shares the cache so '#coachTip' and getElementById('coachTip')
   agree, which they did not before either. */
const elCache = new Map();
const documentStub = {
  getElementById(id){
    const k = 'id:' + id;
    if (!elCache.has(k)){ const el = makeEl(); el.id = id; elCache.set(k, el); }
    return elCache.get(k);
  },
  querySelector(sel){
    if (typeof sel === 'string' && sel.startsWith('#')) return documentStub.getElementById(sel.slice(1));
    const k = 'sel:' + sel;
    if (!elCache.has(k)) elCache.set(k, makeEl());
    return elCache.get(k);
  },
  /* No selector engine, so this cannot answer honestly and returns nothing.
     A test that needs to count rendered nodes belongs in the browser — an
     assertion like "no invalid rows exist" would pass here without testing
     anything. Same applies to getBoundingClientRect (no layout engine) and
     getImageData (no rasteriser): the tests that care about geometry inject
     their own rects, which is the pattern to follow. */
  querySelectorAll(){ return []; },
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

let timerSerial = 0;

/* A real monotonic clock. performance.now() used to return a constant 0, so
   every elapsed-time computation in the app evaluated to zero here: throttles
   never elapsed, animation progress never advanced, and any assertion of the
   form "this took under N ms" passed without measuring. */
const CLOCK_START = process.hrtime.bigint();
function nowMs(){ return Number(process.hrtime.bigint() - CLOCK_START) / 1e6; }

/* Answers min-width / max-width / orientation against the sandbox viewport
   instead of saying `false` to everything. A blanket false put every responsive
   branch on the desktop path, which meant the phone sheet logic — and
   SHEET_UI_MQ, which CLAUDE.md requires to match the CSS verbatim — could not be
   exercised at all. Unrecognised features still answer false, and pointer:coarse
   stays false because there is no input device to speak for. */
function makeMatchMedia(sb){
  /* One alternative: width and orientation clauses ANDed. An alternative in
     which nothing was recognised declines, rather than reporting a vacuous
     true. */
  const one = alt => {
    let matches = true, saw = false;
    for (const m of alt.matchAll(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g)){
      saw = true;
      matches = matches && (m[1] === 'min' ? sb.innerWidth >= +m[2] : sb.innerWidth <= +m[2]);
    }
    for (const m of alt.matchAll(/\(orientation:\s*(portrait|landscape)\)/g)){
      saw = true;
      const portrait = sb.innerHeight >= sb.innerWidth;
      matches = matches && (m[1] === 'portrait' ? portrait : !portrait);
    }
    return saw && matches;
  };
  return q => {
    const query = String(q || '');
    /* A comma is a media-query OR, and SHEET_UI_MQ — the string CLAUDE.md
       requires to match the stylesheet verbatim — is exactly that shape. This
       grammar has no commas inside the parens, so splitting is safe. */
    const matches = query.split(',').some(alt => one(alt));
    return { matches, media: query,
      addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} };
  };
}

/* `extras` is whatever the consumer wants visible inside the sandbox — the test
   runner injects test/assert, the generator injects nothing. */
function makeSandbox(withDom, extras){
  const sb = {
    console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, Symbol,
    parseInt, parseFloat, isNaN, isFinite, Promise, Error, TypeError,
    Uint8ClampedArray, Float32Array, Uint32Array,
    /* Handles are TRUTHY and unique. They used to be 0, so `if (myTimer)` read
       false for a timer that had just been armed — the opposite of the truth,
       and exactly the kind of inverted branch a test would then confirm.
       Callbacks still never fire: the app arms timers during load (coach beats,
       ground-bake settle, the glass governor) and running them here would let
       one test's deferred work land in the middle of another. Deferred behaviour
       is therefore browser-verified, and a test that needs it replaces
       setTimeout itself — several already do. */
    setTimeout: () => ++timerSerial, clearTimeout: () => {},
    setInterval: () => ++timerSerial, clearInterval: () => {},
  };
  Object.assign(sb, extras || {});
  if (withDom){
    Object.assign(sb, {
      document: documentStub, localStorage: makeStorage(),
      addEventListener(){}, removeEventListener(){},
      requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
      performance: { now: nowMs },
      /* rAF stays inert deliberately, unlike setTimeout's handle fix: `loop`
         re-arms itself, so a firing rAF would spin forever. The render loop is
         browser-verified. */
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
    sb.matchMedia = makeMatchMedia(sb);   // needs sb for innerWidth/innerHeight
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
