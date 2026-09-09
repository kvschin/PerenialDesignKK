/* =====================================================
   HORTUS PERENNIS — an Oudolf-style 2.5D gardening game
   ===================================================== */
'use strict';

/* ---------- core constants ---------- */
/* One version string, three consumers: the crash report (so a stack from a
   stranger names the build it came from), the service worker's cache name (a
   bump is what retires the old precache), and SAVE_VERSION's provenance stamp.
   Keep it in step with package.json. */
const APP_VERSION = '0.8.79';
/* Save blob schema. Migrations used to be feature detection — "if the blob has
   a `house` key it is old" — which worked only while every save in existence
   was one of ours. An explicit number is what lets a save written today be
   read confidently by a build shipped in two years. */
const SAVE_VERSION = 2;

/* ---------- identifiers ----------
   Ids used to be `Date.now().toString(36)` plus, on a good day, two base-36
   characters of Math.random — and on four of the six world paths, plus nothing
   at all. Two ids minted in the same millisecond were then simply equal.

   For a scheme that means switching to the wrong planting. For a WORLD it means
   `sSet('hortus:world:'+id)` writing over somebody's saved garden, which makes
   this a data-loss bug rather than an untidiness. A double-tap on "Start a new
   garden" is enough to reach it by hand, and any loop reaches it instantly.

   Eight random base-36 characters is 36^8 ≈ 2.8e12 within a single millisecond,
   which puts collision below the level worth reasoning about. crypto is used
   where it exists and Math.random is the fallback, because an id must never
   depend on an API being present.

   EXISTING ids are untouched — they are the key a saved garden is stored under,
   so rewriting them would lose exactly the data this protects. */
const ID_ALPHABET='0123456789abcdefghijklmnopqrstuvwxyz';
function randomIdPart(n){
  let out='';
  try{
    const buf=new Uint8Array(n);
    (globalThis.crypto||globalThis.msCrypto).getRandomValues(buf);
    /* A getRandomValues that hands the buffer back untouched is indistinguish-
       able from one that filled it with zeros, and would mint the SAME id every
       time — the exact failure this function exists to prevent, hidden behind an
       API that looked like it worked. All-zero is a legitimate random draw at
       odds of 256^-n, so rejecting it costs nothing and catches a no-op stub.
       The test sandbox shipped precisely that stub, and these ids collided. */
    let filled=false;
    for (let i=0;i<n;i++) if (buf[i]!==0){ filled=true; break; }
    if (filled){
      for (let i=0;i<n;i++) out+=ID_ALPHABET[buf[i]%36];
      return out;
    }
    out='';
  }catch(_){ out=''; }
  for (let i=0;i<n;i++) out+=ID_ALPHABET[Math.floor(Math.random()*36)];
  return out;
}
function newId(prefix){ return prefix+Date.now().toString(36)+randomIdPart(8); }
/* `taken` is optional and only passed where the index is already in hand. The
   entropy alone is sufficient; this is the guard for a browser whose random
   source turns out to be neither random nor available. */
function newWorldId(taken){
  for (let i=0;i<8;i++){ const id=newId('w'); if (!taken || !taken.has(id)) return id; }
  return newId('w')+randomIdPart(6);
}

/* ---------- funnel instrumentation ----------
   You cannot fix a conversion rate you cannot see. The four moments that matter
   commercially are: someone opened the app, they placed a plant, they watched a
   season turn (the thing no competitor does), and they reached the planting list
   (the thing worth paying for). Anything that goes wrong between those is
   invisible without counting them.

   THIS SENDS NOTHING. No network, no third party, no identifier. Counts live on
   the device and go nowhere, which is what keeps the privacy policy literally
   true and the app's zero-external-request property intact — both of which are
   selling points, and neither of which survives a tracking pixel.

   Understand what that means: this shows YOUR funnel on YOUR device (and rides
   along in a crash report, where it says what the gardener was doing). It cannot
   show a stranger's. Answering "why is conversion bad" across a user base needs
   a transport, a policy change and a store-label disclosure — a deliberate
   decision, not something to smuggle in behind an instrumentation commit.
   `funnelExport()` is the seam if that decision is ever made.

   The key is a device preference, so it stays out of IDB_KEYS and reads
   synchronously. */
const FUNNEL_KEY='hortus:funnel';
const FUNNEL_EVENTS={
  appOpen:'app:open',                 // a session started
  demoOffered:'demo:offered',         // the first-run prompt was shown
  demoAccepted:'demo:accepted',
  demoDeclined:'demo:declined',
  gardenCreated:'garden:created',     // finished the plot screen
  gardenOpened:'garden:opened',
  plantPlaced:'plant:placed',         // counted, so the first is the milestone
  seasonTurned:'season:turned',       // saw the differentiator
  listOpened:'list:opened',           // reached the planting list
  listExported:'list:exported',       // took the CSV away
  planOpened:'plan:opened',
  planDownloaded:'plan:downloaded',
  gardenShared:'garden:shared',
  /* Settings and the paid tier, when it exists. Kept in the same record as the
     rest of the funnel so 'reached the planting list, then looked at premium,
     then did not buy' reads as one sequence rather than two systems to
     reconcile. */
  settingsOpened:'settings:opened',
  premiumViewed:'premium:viewed',
  premiumStarted:'premium:started',
  premiumRestored:'premium:restored',
};
let funnelState=null, funnelDirty=false;
function funnelLoad(){
  if (funnelState) return funnelState;
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(FUNNEL_KEY)); }catch(_){ }
  funnelState = (raw && typeof raw==='object' && raw.events && typeof raw.events==='object')
    ? raw : {v:1, installed:Date.now(), sessions:0, events:{}};
  if (typeof funnelState.sessions!=='number') funnelState.sessions=0;
  return funnelState;
}
/* Deliberately cheap: one property bump and a flag. plantPlaced fires from
   plantFx, which runs once per placed TILE — a fat drag is dozens in a frame —
   so this must never serialise. funnelFlush does that, debounced. */
function funnel(name,n){
  if (!name) return;
  const s=funnelLoad(), e=s.events[name] || (s.events[name]={n:0, first:0, last:0});
  e.n+=(n||1);
  const now=Date.now();
  if (!e.first) e.first=now;
  e.last=now;
  funnelDirty=true;
}
function funnelFlush(){
  if (!funnelDirty || !funnelState) return false;
  funnelDirty=false;
  try{ localStorage.setItem(FUNNEL_KEY,JSON.stringify(funnelState)); return true; }
  catch(_){ return false; }
}
/* Whether a milestone has ever happened, and when — the shape a funnel question
   actually takes ("did they ever reach the list?"). */
function funnelSaw(name){ return !!(funnelLoad().events[name]||{}).n; }
/* One line per event, for the crash report and the console. Ordered by the
   funnel rather than alphabetically, so a drop-off reads as a drop-off. */
function funnelSummary(){
  const s=funnelLoad(), order=Object.values(FUNNEL_EVENTS);
  const days=Math.max(1,Math.round((Date.now()-(s.installed||Date.now()))/86400000));
  const lines=[`sessions ${s.sessions} over ${days}d`];
  for (const k of order){
    const e=s.events[k];
    lines.push(`  ${e?'x':'-'} ${k}${e?' n='+e.n:''}`);
  }
  return lines.join('\n');
}
function funnelReport(){ console.log(funnelSummary()); return funnelLoad(); }
/* The seam. Returns the whole record so it can be inspected, attached to a bug
   report by hand, or one day posted somewhere — which would be a policy
   decision, and would need privacy.html changed in the same commit. */
function funnelExport(){ return JSON.parse(JSON.stringify(funnelLoad())); }
function funnelReset(){
  funnelState={v:1, installed:Date.now(), sessions:0, events:{}};
  funnelDirty=true; funnelFlush();
}

const SEASONS = ['Spring','Summer','Fall','Winter'];
const DAYS_PER_SEASON = 16;
const DAY_MS = 20000;                 // 20 real seconds per garden day
/* The plot is sized per garden (plot screen / save): GW x GH tiles.
   31x31 (~46ft square at 18-inch tiles) is the classic default. */
let GW = 31, GH = 31;
let SPAWNX = 15, SPAWNY = 15;         // players start at the plot's center
function setWorldSize(gw,gh){ GW=gw; GH=gh;
  SPAWNX=Math.floor(gw/2); SPAWNY=Math.floor(gh/2);
  game.plotShape=null; game.plotRev++; rebuildPlotMask();   // a shape from another plot size is meaningless
}
const TILE_W = 76, TILE_H = 38;
const TILE_IN = 18;                   // real-world inches per tile side (export + plot math)
/* Screen px per real FOOT of drawn HEIGHT. Ground distance and height are
   separate scales in this projection, so this is the one place a built
   structure's real height leaves real units.

   It is HERB_SCALE * 12 by construction, and a test pins the two together.
   Herbaceous `h` is px≈inches and is drawn at h*HERB_SCALE, so 21px/ft is
   exactly the scale the planting is drawn at — which is the whole point: a
   6 ft fence and a 6 ft viburnum have to arrive at the same height or the
   garden is lying about the one thing a planner is for. Measured before this
   existed, a 6 ft fence drew 38px, the same as a 22-inch sedge, because the
   fence carried a hand-picked 26/36px and never followed the H1 rescale.
   Houses are deliberately NOT on this scale — like a mature oak they are big
   enough to need the log compression trees get (see woodyVisualCw); a fence at
   3-8 ft is inside the range that draws true. */
const PX_PER_FT = 21;
const ELEV_STEP = 9;                   // pixels per elevation step in the isometric view
const ELEV_MIN = -2, ELEV_MAX = 4;     // first-pass earthwork range: shallow swales to low berms
/* A level change is ELEV_STEP px, and PX_PER_FT turns that into a real
   height: 9/21*12 = 5.14 inches. That is a genuine step riser (real ones run
   4-7in) and about one course of walling, so steps and the wall beside them
   are derived from the same number and cannot disagree. */
const ELEV_RISER_IN = ELEV_STEP/PX_PER_FT*12;
/* Retaining walls hold a level change up. They are painted rather than
   automatic: a grass bank and a dry-stone wall are both legitimate answers to
   the same terrace, and the app should not decide which one you meant. The
   material rides the elevation record (`{h, w}`), so a repaint invalidates the
   ground bake through machinery that already exists.
   `face` names the coursing recipe the way a fence names its `infill`, and
   `courseIn` is the real height of one course — a brick course is 3 inches
   whatever the wall is holding back. */
const WALL_STYLES = [
  {id:'none',     label:'Bare earth',      short:'None',     face:null},
  {id:'drystone', label:'Dry-stone Wall',  short:'Dry stone',face:'rubble',  courseIn:6,  tone:'#918d83', line:'rgba(48,44,38,0.34)'},
  {id:'stone',    label:'Mortared Stone',  short:'Stone',    face:'coursed', courseIn:7,  tone:'#9d998e', line:'rgba(52,48,42,0.30)'},
  {id:'brick',    label:'Brick',           short:'Brick',    face:'brick',   courseIn:3,  tone:'#a35c43', line:'rgba(60,32,24,0.34)'},
  {id:'sleeper',  label:'Timber Sleeper',  short:'Sleeper',  face:'sleeper', courseIn:9,  tone:'#7f6343', line:'rgba(40,28,16,0.40)'},
  {id:'gabion',   label:'Gabion Basket',   short:'Gabion',   face:'gabion',  courseIn:12, tone:'#8d8e86', line:'rgba(38,40,36,0.46)'},
  {id:'concrete', label:'Poured Concrete', short:'Concrete', face:'smooth',  courseIn:24, tone:'#aaa79e', line:'rgba(60,58,52,0.20)'},
  {id:'corten',   label:'Corten Steel',    short:'Corten',   face:'plate',   courseIn:36, tone:'#8d5134', line:'rgba(56,28,16,0.34)'},
];
function wallStyle(id){ return WALL_STYLES.find(w=>w.id===id)||WALL_STYLES[0]; }
function wallStyleId(id){ return wallStyle(id).id; }
function wallLabelFor(id){ return wallStyle(id).label; }
function ftToTiles(ft){ return Math.max(2, Math.round(ft*12/TILE_IN)); }

/* Which hardiness zones the app can offer, DERIVED FROM THE CATALOG rather
   than typed in. The questionnaire hardcoded 3-9 while ZIP_ZONE_BANDS already
   returned 10 (south Florida) and 11 (Hawaii), so those gardeners were told
   they were zone 9 -- and 79 species top out at 10 or 11, one of which
   (Simpson's Stopper, z10-11) shipped in a state where NO selectable zone
   could ever place it. Deriving the range is what stops the chips drifting
   from the data again: add a zone 12 species and the chip appears.
   It is the zones that actually HAVE a plant, not min(floor)..max(top) -- an
   empty palette is a worse answer than a rounded one. Interior gaps cannot
   really happen, because species carry zone RANGES and a span covers what it
   crosses, but asking the honest question costs one pass. Memoised; PLANTS is
   static and loads before this module. */
const USDA_ZONES=[1,13];          // the scale; the offered span is derived from it
let zoneRangeCache=null;
function zoneRange(){
  if (zoneRangeCache) return zoneRangeCache;
  let lo=null, hi=null;
  for (let z=USDA_ZONES[0]; z<=USDA_ZONES[1]; z++){
    let any=false;
    for (const k in PLANTS){
      const P=PLANTS[k];
      if (!P.hidden && P.zones && P.zones[0]<=z && P.zones[1]>=z){ any=true; break; }
    }
    if (any){ if (lo===null) lo=z; hi=z; }
  }
  if (lo===null){ lo=3; hi=9; }   // no catalog (a bare harness): keep the old span
  return (zoneRangeCache={lo,hi});
}
function clampZone(z){ const r=zoneRange(); const n=+z; return Math.max(r.lo,Math.min(r.hi,isFinite(n)?n:r.lo)); }

/* OSU/PRISM's 2023 five-digit ZIP listing, bundled for offline use. No prefix
   guessing and no ZIP sent to a server. Source half-zones are kept verbatim;
   the planner explicitly uses whole zones. See docs/zone-lookup.md. */
const ZIP_ZONE_DATA_URL='./data/zip-zones-2023.json';
let zipZoneData=null, zipZonePromise=null;
function validateZipZoneData(data){
  if (!data || data.format!==1 || data.edition!==2023 || !data.zones ||
      !Number.isInteger(data.count) || data.count<1) throw new Error('Invalid ZIP zone data');
  const seen=new Set();
  for (const [half,packed] of Object.entries(data.zones)){
    if (!/^(?:[1-9]|1[0-3])[ab]$/.test(half) || typeof packed!=='string' ||
        !/^\d+$/.test(packed) || packed.length%5) throw new Error('Invalid ZIP zone group');
    let previous='';
    for(let i=0;i<packed.length;i+=5){
      const zip=packed.slice(i,i+5);
      if (zip<=previous || seen.has(zip)) throw new Error('Duplicate or unordered ZIP');
      seen.add(zip); previous=zip;
    }
  }
  if (seen.size!==data.count) throw new Error('Incomplete ZIP zone data');
  return data;
}
function loadZipZones(){
  if (zipZoneData) return Promise.resolve(zipZoneData);
  if (!zipZonePromise) zipZonePromise=fetch(ZIP_ZONE_DATA_URL).then(r=>{
    if (!r.ok) throw new Error('ZIP lookup unavailable');
    return r.json();
  }).then(data=>{ zipZoneData=validateZipZoneData(data); return zipZoneData; })
    .catch(e=>{ zipZonePromise=null; throw e; }); // another attempt can recover
  return zipZonePromise;
}
function halfZoneFromZip(zip,data=zipZoneData){
  const digits=String(zip==null?'':zip).trim();
  if (!/^\d{5}$/.test(digits) || !data) return null;
  for (const [half,packed] of Object.entries(data.zones)){
    let lo=0,hi=packed.length/5-1;
    while(lo<=hi){
      const mid=(lo+hi)>>1, candidate=packed.slice(mid*5,mid*5+5);
      if (candidate===digits) return half;
      if (candidate<digits) lo=mid+1; else hi=mid-1;
    }
  }
  return null;
}
function zoneFromZip(zip,data=zipZoneData){
  const half=halfZoneFromZip(zip,data); return half?parseInt(half,10):null;
}
function hardinessTemperatureRange(zone){
  const match=String(zone).match(/^([1-9]|1[0-3])([ab])?$/);
  if (!match) return null;
  const low=+match[1]*10-70+(match[2]==='b'?5:0);
  return {low,high:low+(match[2]?5:10)};
}
function zoneTemperatureText(zone){
  const range=hardinessTemperatureRange(zone); if (!range) return '';
  const metric=metricUnits(), fmt=f=>String(metric?Math.round((f-32)*5/9*10)/10:f).replace('-','−');
  return `${fmt(range.low)} to ${fmt(range.high)}°${metric?'C':'F'}`;
}
function mixHex(a,b2,t){
  const pa=parseInt(a.slice(1),16), pb=parseInt(b2.slice(1),16);
  const ch=(sh)=>Math.round(((pa>>sh)&255)*(1-t)+((pb>>sh)&255)*t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/* UX feature flags for retired / optional interactions.
   The mobile action button is hidden because drag-to-place made a large
   "Plant here" CTA redundant. The movement hint is hidden because the toolbar
   already carries the current task well enough on small screens. */
const ENABLE_MOBILE_ACT_BUTTON = false;
const ENABLE_ACTION_HINT = false;

/* Haptics are an explicit, device-local preference and default off. Feedback
   stays short and gesture-level: one pulse after a completed placement or
   success, never a buzz for every tile in a paint drag. */
const HAPTIC_KEY='hortus:haptics';
let hapticsOn=false, lastHapticAt=0;
try{ hapticsOn=localStorage.getItem(HAPTIC_KEY)==='1'; }catch(_){ }
function supportsHaptics(){
  if (typeof navigator==='undefined' || typeof navigator.vibrate!=='function') return false;
  return (navigator.maxTouchPoints||0)>0 || (typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches);
}
function setHapticsEnabled(on){
  hapticsOn=!!on && supportsHaptics();
  try{ localStorage.setItem(HAPTIC_KEY,hapticsOn?'1':'0'); }catch(_){ }
  return hapticsOn;
}
function hapticFeedback(kind){
  if (!hapticsOn || !supportsHaptics()) return;
  const now=Date.now(), gap=kind==='invalid'?240:70;
  if (now-lastHapticAt<gap) return;
  lastHapticAt=now;
  const pattern=kind==='invalid' ? [8,28,8] : kind==='success' ? 16 : 8;
  try{ navigator.vibrate(pattern); }catch(_){ }
}

/* The mobile rail side is a device preference, not garden data. Apply the
   class while scripts load so opening the HUD never flashes on the wrong side. */
const LEFT_HANDED_KEY='hortus:leftHanded';
let leftHandedLayout=false;
try{ leftHandedLayout=localStorage.getItem(LEFT_HANDED_KEY)==='1'; }catch(_){ }
function applyLeftHandedLayout(animate){
  if (typeof document==='undefined'||!document.body) return;
  document.body.classList.toggle('left-handed-layout',leftHandedLayout);
  if (animate){
    document.body.classList.add('handedness-changing');
    setTimeout(()=>document.body&&document.body.classList.remove('handedness-changing'),220);
  }
  if (typeof globalThis!=='undefined' && globalThis.__compassReady && typeof invalidateCompass==='function') invalidateCompass();
}
function setLeftHandedLayout(on,animate=true){
  leftHandedLayout=!!on;
  try{ localStorage.setItem(LEFT_HANDED_KEY,leftHandedLayout?'1':'0'); }catch(_){ }
  applyLeftHandedLayout(animate);
  /* The rail changes SIDE without changing size, which a ResizeObserver cannot
     see — so drop the cached usable rect here. It belongs on the setter rather
     than on applyLeftHandedLayout because that also runs at core.js LOAD time,
     where view.js's `let` is still in its temporal dead zone: the function
     declaration hoists across the shared scope and the variable does not, so
     the typeof guard passes and the read throws. */
  if (typeof invalidateUsableRect==='function') invalidateUsableRect();
  return leftHandedLayout;
}
applyLeftHandedLayout(false);

/* ---------- Theme (device preference, like haptics and the rail side) ----------
   'auto' follows the OS; 'light'/'dark' pin it. Only the CHROME themes — the
   garden keeps its seasonal AMBIENCE palette in both, because a meadow at
   midday is not "dark mode". An inline bootstrap in index.html stamps the
   resolved value on <html> before first paint so there is no flash; this code
   owns it from then on, including following the OS while set to 'auto'. */
const THEME_KEY='hortus:theme';
const THEME_CHOICES=['auto','light','dark'];
let themePref='auto';
try{ const v=localStorage.getItem(THEME_KEY); if (THEME_CHOICES.includes(v)) themePref=v; }catch(_){ }
function systemPrefersLight(){
  return typeof matchMedia==='function' && matchMedia('(prefers-color-scheme: light)').matches;
}
function resolvedTheme(pref=themePref){
  return pref==='auto' ? (systemPrefersLight()?'light':'dark') : pref;
}
/* Canvas icons cannot resolve CSS variables, so they read the resolved colours
   through here. Cached because icon builders call it many times per rebuild;
   the cache is dropped whenever the theme changes. */
let uiInkCache=null;
function uiInk(name){
  if (!uiInkCache){
    uiInkCache={};
    if (typeof getComputedStyle==='function' && typeof document!=='undefined' && document.documentElement){
      const cs=getComputedStyle(document.documentElement);
      ['--icon-ink','--icon-ink-soft','--icon-ink-dim','--icon-warm','--icon-halo'].forEach(k=>{
        const v=(cs.getPropertyValue(k)||'').trim(); if (v) uiInkCache[k]=v;
      });
    }
  }
  // Fall back to the dark values so a headless/stubbed DOM still draws.
  const fallback={'--icon-ink':'#efe6d3','--icon-ink-soft':'#d8c7ac','--icon-ink-dim':'#7d7164',
    '--icon-warm':'#c9a07f','--icon-halo':'rgba(20,14,11,0.75)'};
  return uiInkCache[name]||fallback[name]||'#efe6d3';
}
function applyTheme(){
  if (typeof document==='undefined'||!document.documentElement) return resolvedTheme();
  const t=resolvedTheme();
  document.documentElement.setAttribute('data-theme',t);
  uiInkCache=null;
  // Sprite/ground caches key off season and zoom, not theme, so only the DOM
  // chrome and the canvas-drawn ICONS need rebuilding.
  if (typeof refreshCanvasTools==='function') refreshCanvasTools();
  // force: the icons are canvas bitmaps repainted from the theme's uiInk cache,
  // and the tray guard cannot see a colour that is baked into a canvas
  if (typeof buildToolTray==='function' && typeof game!=='undefined' && game.inGarden) buildToolTray(true);
  if (typeof syncTopTools==='function') syncTopTools();
  if (typeof drawSheetSwatch==='function') drawSheetSwatch();
  return t;
}
function setThemePref(pref){
  themePref=THEME_CHOICES.includes(pref)?pref:'auto';
  try{ localStorage.setItem(THEME_KEY,themePref); }catch(_){ }
  return applyTheme();
}
/* cycleThemePref used to live here, for the garden menu's one-button
   "Appearance · Auto" row. Settings shows all three choices at once, so there
   is nothing left to cycle and a wrap-around order nobody can see is a rule
   waiting to disagree with the UI. setThemePref is the whole API. */
function themeLabel(){ return themePref==='auto'?`Auto (${resolvedTheme()})`:themePref==='light'?'Light':'Dark'; }
if (typeof matchMedia==='function'){
  const mq=matchMedia('(prefers-color-scheme: light)');
  const onChange=()=>{ if (themePref==='auto') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change',onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/* ---------- Motion (device preference, like the theme) ----------
   'auto' follows prefers-reduced-motion; 'reduce'/'full' pin it. An OS-level
   setting is the wrong granularity for this app on its own: someone who turns
   the system switch on for a phone full of bouncing chat apps still wants the
   season crossfade, which is the one animation here carrying information rather
   than decoration — and the reverse case (a shared or managed device where the
   OS switch cannot be reached) had no route at all.

   The resolved value is stamped on <html> as data-motion by the bootstrap in
   index.html's <head>, and styles.css keys its reduce block on that attribute
   ALONE. So the attribute must always be present: it is the only thing that
   turns motion down, and losing it silently un-reduces motion for someone who
   asked for less. This code owns it from load onward, including following the
   OS while set to 'auto'. */
const MOTION_KEY='hortus:motion';
const MOTION_CHOICES=['auto','reduce','full'];
let motionPref='auto';
try{ const v=localStorage.getItem(MOTION_KEY); if (MOTION_CHOICES.includes(v)) motionPref=v; }catch(_){ }
function systemReducedMotion(){
  return typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/* The one predicate every motion decision reads — CSS through data-motion, and
   the three JS sites (season crossfade, catalog strip scroll, sheet flight)
   that used to call matchMedia directly and so could not see the pref. */
function reducedMotion(){
  return motionPref==='auto' ? systemReducedMotion() : motionPref==='reduce';
}
function applyMotionPref(){
  if (typeof document==='undefined'||!document.documentElement) return reducedMotion();
  document.documentElement.setAttribute('data-motion',reducedMotion()?'reduce':'full');
  return reducedMotion();
}
function setMotionPref(pref){
  motionPref=MOTION_CHOICES.includes(pref)?pref:'auto';
  try{ localStorage.setItem(MOTION_KEY,motionPref); }catch(_){ }
  applyMotionPref();
  return motionPref;
}
function motionLabel(){
  return motionPref==='auto' ? `Auto (${reducedMotion()?'reduced':'full'})` : motionPref==='reduce'?'Reduced':'Full';
}
applyMotionPref();
if (typeof matchMedia==='function'){
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  const onChange=()=>{ if (motionPref==='auto') applyMotionPref(); };
  if (mq.addEventListener) mq.addEventListener('change',onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/* ---------- Language ----------
   Nothing is translated yet, and this is deliberately the whole seam rather
   than a dead dropdown: LANGUAGES is the list, the preference is stored, and
   <html lang> follows it — which is what a screen reader and the browser's own
   hyphenation read, so the one entry already does real work. The settings
   screen renders a picker only when there is more than one row here, so adding
   a translation is a data change plus a string table, not a UI change. */
const LANG_KEY='hortus:lang';
const LANGUAGES=[{id:'en', label:'English', native:'English'}];
let langPref='en';
try{ const v=localStorage.getItem(LANG_KEY); if (LANGUAGES.some(l=>l.id===v)) langPref=v; }catch(_){ }
function languageDef(id=langPref){ return LANGUAGES.find(l=>l.id===id)||LANGUAGES[0]; }
function languageLabel(){ return languageDef().native; }
function applyLangPref(){
  if (typeof document!=='undefined'&&document.documentElement)
    document.documentElement.setAttribute('lang',langPref);
  return langPref;
}
function setLangPref(id){
  if (LANGUAGES.some(l=>l.id===id)) langPref=id;
  try{ localStorage.setItem(LANG_KEY,langPref); }catch(_){ }
  return applyLangPref();
}
applyLangPref();
/* ---------- Units (device preference) ----------
   Imperial or metric, and it is a DISPLAY preference only. Nothing in the
   model moves: `space` and `spread` stay inches, `TILE_IN` stays 18, every
   tile/footprint/spacing derivation is untouched. That separation is the
   inches-truth / px-art split doing its job — see the units table in
   CLAUDE.md — and it is why this is a formatter pass rather than a migration.
   The rule for a new measurement: compute in inches, feet, square feet or
   cubic yards as the app always has, and format it through one of the fmt*
   helpers below. Never build a unit string inline.

   The default is seeded from the LOCALE, but only on a device that has never
   run the app. Three countries do not use metric; everywhere else a garden
   planner opening in feet is wrong on first sight, and hunting for a setting
   to fix it is a poor first minute. But an existing gardener has been reading
   feet since they started, and flipping their planting list under them on an
   update is worse than making them choose — so any `hortus:` key at all means
   "this device has run before" and the historical default stands. The derived
   value is written, or the same device would answer differently on its second
   visit (it now has keys) and silently change units. */
const UNITS_KEY='hortus:units';
const UNIT_CHOICES=['imperial','metric'];
/* One place for the factors. Exact by definition: 1 in = 2.54 cm. */
const CM_PER_IN=2.54, M_PER_FT=0.3048, SQM_PER_SQFT=0.09290304, CUM_PER_CUYD=0.764554857984;
function localeUsesImperial(){
  try{
    const langs=(typeof navigator!=='undefined' && navigator.languages && navigator.languages.length)
      ? navigator.languages : [(typeof navigator!=='undefined' && navigator.language)||''];
    for (const l of langs){
      const m=/[-_]([A-Za-z]{2})\b/.exec(l||'');
      if (m) return ['US','LR','MM'].includes(m[1].toUpperCase());
    }
  }catch(_){ }
  return true;    // no region to read: keep the app's historical behaviour
}
function deviceHasRunBefore(){
  try{
    for (let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if (k && k.indexOf('hortus:')===0) return true;
    }
  }catch(_){ }
  return false;
}
let unitsPref=null;
try{ const v=localStorage.getItem(UNITS_KEY); if (UNIT_CHOICES.includes(v)) unitsPref=v; }catch(_){ }
if (!unitsPref){
  unitsPref=(!deviceHasRunBefore() && !localeUsesImperial()) ? 'metric' : 'imperial';
  try{ localStorage.setItem(UNITS_KEY,unitsPref); }catch(_){ }
}
function metricUnits(){ return unitsPref==='metric'; }
function setUnitsPref(id){
  unitsPref=UNIT_CHOICES.includes(id)?id:'imperial';
  try{ localStorage.setItem(UNITS_KEY,unitsPref); }catch(_){ }
  /* Units reach the plan sheet, the planting list, the tray's plant cards, the
     marquee pill and three input fields, so a change has to reach whatever is
     open NOW — nothing here re-reads the preference on its own. Each call
     no-ops when its surface is closed.

     The three input fields are the ones that could go stale, because their
     value is a NUMBER in the old unit rather than a re-derived string. The plot
     screen is safe by construction (settings is reachable only from the menu
     and from inside a garden, so it can never be open over the plot setup, and
     openPlotScreen writes both fields fresh anyway); the site photo's width and
     its calibration field are re-derived from the model here. */
  if (typeof syncUnitLabels==='function') syncUnitLabels();
  if (typeof buildToolTray==='function' && typeof game!=='undefined' && game.inGarden) buildToolTray(true);
  if (typeof syncSitePhotoEditor==='function') syncSitePhotoEditor();
  if (typeof renderSelectionActions==='function') renderSelectionActions();
  if (typeof renderSelectionEstimate==='function') renderSelectionEstimate();
  if (typeof updatePlotNote==='function') updatePlotNote();
  if (typeof drawPlotShapeEditor==='function') drawPlotShapeEditor();
  return unitsPref;
}
function unitsLabel(){ return metricUnits()?'Metric':'Imperial'; }
/* Unit words, so a label never hardcodes one. `word` forms go in field labels
   ("Width, metres"); `short` forms go beside a number. */
function lengthUnit(){ return metricUnits()?'m':'ft'; }
function lengthUnitWord(){ return metricUnits()?'metres':'feet'; }
function smallLengthUnit(){ return metricUnits()?'cm':'in'; }
function areaUnit(){ return metricUnits()?'sq m':'sq ft'; }
function volumeUnit(){ return metricUnits()?'cu m':'cu yd'; }

/* "1.5" not "1.5000"; "2" not "2.0". dp is the maximum, not a fixed width —
   a planting list reading "24.0 ft" looks like a measurement error. */
function trimNum(n,dp){
  const s=(+n||0).toFixed(Math.max(0,dp|0));
  return dp>0 ? s.replace(/\.?0+$/,'') : s;
}

/* THE length formatter. Everything that has a distance in inches goes through
   here — it replaced four near-identical functions (the plant card's
   measurement, the selection's, the ruler's and the drag readout's) that
   differed only in where they switched from inches to feet and whether they
   used the ″ glyph. Four copies of one rule is how the plant card and the
   ruler end up disagreeing about what 30 inches is called.
     ftAt  imperial only: switch to feet at this many inches (metric always
           switches at 1 m, which is the metric idiom for both height and
           spacing — nobody says "150 cm apart")
     ftDp  decimals on the imperial feet value
     glyph render inches as ″ rather than " in" (the plant card's idiom)
     html  with glyph, use the HTML entity */
function fmtLengthIn(inches,opts){
  opts=opts||{};
  const v=Math.max(0,+inches||0), min=opts.min||0;
  if (metricUnits()){
    const cm=v*CM_PER_IN;
    return cm<100 ? `${Math.max(min,Math.round(cm))} cm` : `${trimNum(cm/100,1)} m`;
  }
  const ftAt=opts.ftAt===undefined?24:opts.ftAt;
  if (v>=ftAt) return `${trimNum(v/12,opts.ftDp===undefined?1:opts.ftDp)} ft`;
  const n=Math.max(min,Math.round(v));
  return opts.glyph ? `${n}${opts.html?'&Prime;':'"'}` : `${n} in`;
}
/* A length the app already holds in FEET — edging runs, wall runs, spacing
   advice. dp is the imperial precision; metric drops to whole metres past 10,
   where a decimetre is noise on a garden dimension. */
function fmtFeet(ft,dp){
  const v=Math.max(0,+ft||0);
  if (metricUnits()){ const m=v*M_PER_FT; return `${trimNum(m,m<10?1:0)} m`; }
  return `${trimNum(v,dp===undefined?0:dp)} ft`;
}
function fmtAreaSqFt(sqFt,dp){
  const v=Math.max(0,+sqFt||0);
  const n=metricUnits()?v*SQM_PER_SQFT:v;
  return `${trimNum(n,dp===undefined?(n<10?1:0):dp)} ${areaUnit()}`;
}
function fmtVolumeCuYd(cuYd){
  const v=Math.max(0,+cuYd||0);
  return `${trimNum(metricUnits()?v*CUM_PER_CUYD:v,1)} ${volumeUnit()}`;
}
/* A bare NUMBER in the display unit, for a table cell whose column header
   already carries the unit — repeating "sq ft" down forty rows is noise. */
function areaNumberText(sqFt){
  const v=Math.max(0,+sqFt||0), n=metricUnits()?v*SQM_PER_SQFT:v;
  return trimNum(n, n<10?1:0);
}
/* One tile, stated in the reader's units. It appears on the planting list and
   the plan sheet, which are the two documents somebody scales off, so it reads
   from TILE_IN rather than restating 18 — the plan carried a hardcoded 1.5
   (feet per tile) in two places and would have started lying the day the tile
   size became a setting. */
function tileSizeText(){
  return metricUnits()
    ? `${Math.round(TILE_IN*CM_PER_IN)} × ${Math.round(TILE_IN*CM_PER_IN)} cm`
    : `${TILE_IN}" × ${TILE_IN}"`;
}
/* The bidirectional pair, for the three fields that take a real dimension from
   the gardener: the plot's width/length, the site photo's true width, and the
   calibration distance. The MODEL side of all three is feet, so these are the
   only conversion either direction needs. */
function ftToDisplay(ft,dp){ return +trimNum(metricUnits()?(+ft||0)*M_PER_FT:(+ft||0), dp===undefined?1:dp); }
/* An EMPTY field is not zero feet. `+''` is 0, which is finite, so a naive
   conversion made plotFt clamp a half-typed field to FT_MIN and snap the plot
   diagram to its smallest size mid-keystroke — the old `+value||46` fell back
   to the default instead. Blank is NaN here so every caller takes its own
   not-a-number branch: plotFt returns 46, the site-photo width bails, and the
   calibration says "enter a distance greater than zero". */
function displayToFt(v){
  if (v===null||v===undefined) return NaN;
  if (typeof v==='string' && !v.trim()) return NaN;
  const n=+v;
  return Number.isFinite(n) ? (metricUnits()?n/M_PER_FT:n) : NaN;
}

/* ---------- Premium ----------
   The placement is decided and built; the storefront is not, because there is
   no store to talk to yet and a button that cannot take money is worse than no
   button. PREMIUM_ENABLED is the single switch — off, the settings screen
   renders no premium section at all and the app is exactly as it was.

   isPremium() is the gate every future paid surface should read, so entitlement
   has ONE definition from the start. It is device-local, like every other
   preference here: a real purchase eventually replaces the body of this
   function with a receipt check, and nothing else has to move. Deliberately not
   wired to anything that hides existing behaviour — everything the app does
   today stays free, or the first release after this one takes features away
   from people who already have them. */
const PREMIUM_ENABLED=false;
const PREMIUM_KEY='hortus:premium';
function isPremium(){
  if (!PREMIUM_ENABLED) return true;   // nothing is gated while the tier is off
  try{ return localStorage.getItem(PREMIUM_KEY)==='1'; }catch(_){ return false; }
}

/* Season ambience: sky gradient, grass tone, soil tone, light tint */
const AMBIENCE = {
  Spring:{sky:['#8aa4b8','#cfd8c2'], grass:['#7fa05e','#6f8f5a'], soil:'#5b4332', tint:'rgba(190,220,170,0.06)', snow:0, bloom:1},
  Summer:{sky:['#7d93a8','#b8c9a8'], grass:['#6f8f5a','#5d7a4c'], soil:'#54402f', tint:'rgba(255,240,180,0.05)', snow:0, bloom:1},
  Fall:  {sky:['#9a7d6e','#d9b98a'], grass:['#a78a4f','#8f7544'], soil:'#4e3a2b', tint:'rgba(255,170,90,0.08)', snow:0, bloom:0},
  Winter:{sky:['#6e7787','#cdd3d8'], grass:['#9b9484','#857f70'], soil:'#5a5048', tint:'rgba(200,215,235,0.10)', snow:1, bloom:0},
};
const SEASON_LIGHT = {
  Spring:{sun:'rgba(255,235,180,0.20)', haze:'rgba(229,238,210,0.20)', beam:'rgba(255,246,190,0.08)', vignette:'rgba(42,55,42,0.13)'},
  Summer:{sun:'rgba(255,225,135,0.18)', haze:'rgba(210,226,188,0.13)', beam:'rgba(255,240,165,0.10)', vignette:'rgba(32,46,36,0.14)'},
  Fall:  {sun:'rgba(255,184,105,0.23)', haze:'rgba(224,174,112,0.18)', beam:'rgba(255,176,92,0.12)', vignette:'rgba(58,35,28,0.16)'},
  Winter:{sun:'rgba(228,236,246,0.18)', haze:'rgba(231,238,245,0.18)', beam:'rgba(210,228,245,0.08)', vignette:'rgba(35,42,54,0.18)'},
};

/* Ground materials carry their own GRAIN PALETTE, next to their base colour,
   because a material's colour is data — `drawGroundTexture` reads these and
   hardcodes none of them. `texture` names the grain recipe (the shape of the
   stuff: angular chip, rounded cobble, shred, leaf…) and `tones` are the grain
   colours painted over the base, listed dark-to-light.
   The tones are what stopped every material reading as the same speckle: a
   real aggregate varies in HUE, not just in value, and `shade()` — which adds
   a constant to r/g/b — cannot produce that. Warm gravel really is buff stone
   with grey and rust in it; limestone screenings really are one pale tone.
   `null` tones mean "derive from the tile's own base" and are for materials
   whose base is seasonal (soil follows AMBIENCE). */
const PATH_COLORS = [
  {id:'warm', label:'Warm gravel', fill:'#bba98c', plan:'#dccdaa',
   texture:'gravel', tones:['#8a7a5d','#ae9d80','#c4b596','#9a8765']},
  {id:'lime', label:'Limestone', fill:'#d0c6ad', plan:'#e5dcc6',
   texture:'fines', tones:['#aba189','#c3b99f','#ded5bd','#b9ad92']},
  {id:'bark', label:'Bark mulch', fill:'#6b4a34', plan:'#b08a68',
   texture:'mulch', tones:['#4a3122','#7a5539','#96775a','#61402a']},
  {id:'slate', label:'Slate', fill:'#7a8386', plan:'#b8c0c2',
   texture:'flag', tones:['#5c6567','#7f888a','#98a1a2','#6d7678']},
  {id:'clay', label:'Red clay', fill:'#a76543', plan:'#d3a184',
   texture:'clay', tones:['#8a4f33','#b2704c','#c48a63','#96593a']},
  {id:'charcoal', label:'Charcoal', fill:'#4c4942', plan:'#8f8a7e',
   texture:'gravel', tones:['#35332e','#5a574f','#726e64','#454239']},
  /* Laid units. `unit` is the paver size in INCHES and the recipe lays them in
     running bond; `fill` is the MORTAR, because the joint is the base showing
     between units, so it stays a shade that still reads as paving from the
     world thumbnail. */
  {id:'brick', label:'Brick', fill:'#7a5a4e', plan:'#c98d72',
   texture:'brick', unit:[8,4], tones:['#8a4633','#a85f45','#bd7358','#94503a']},
  {id:'paver', label:'Concrete paver', short:'Paver', fill:'#7e7b74', plan:'#c7c4bc',
   texture:'brick', unit:[16,16], tones:['#918e86','#a5a29a','#b5b2aa','#8a877f']},
  // Slate covers the cool greys; a warm flagstone is a different design choice,
  // not a tint of the same one.
  {id:'sandstone', label:'Sandstone', fill:'#a58e6a', plan:'#dcc7a4',
   texture:'flag', tones:['#8a7150','#b89c74','#cbb189','#a3855c']},
];
function pathColor(id){ return PATH_COLORS.find(c=>c.id===id)||PATH_COLORS[0]; }
function pathColorId(id){ return pathColor(id).id; }
function pathFill(t,snow){ const p=pathColor(t&&t.c);
  return snow ? mixHex(p.fill,'#eef2f8',0.42) : p.fill; }
function pathPlanFill(t){ return pathColor(t&&t.c).plan; }
const BED_STYLES = [
  // soil follows the season (fill:null -> AMBIENCE.soil), so its grains are
  // derived from whatever that is rather than pinned to one brown
  {id:'soil', label:'Soil', fill:null, plan:'#ebe2c9', texture:'soil', tones:null},
  {id:'gravel', label:'Gravel', fill:'#a99f86', plan:'#d6ceb8', texture:'gravel',
   tones:['#7d7461','#a89d84','#bdb296','#93856c']},
  // A river bar is grey AND tan AND rust, never one grey — the fourth tone is
  // doing real work here, and the light one stays close to the body tone
  // because where two pale cobbles overlap they merge into one pale blob.
  {id:'rock', label:'River rock', short:'Rock', fill:'#87877f', plan:'#c5c5bb', texture:'rock',
   tones:['#4e4e4a','#82827a','#97968a','#8a7a63']},
  {id:'leaf', label:'Leaf litter', short:'Leaf', fill:'#6d4d32', plan:'#b88c60', texture:'leaf',
   tones:['#4a3524','#7d5836','#96784c','#66502f']},
  {id:'mulch', label:'Bark mulch', short:'Bark', fill:'#5b3526', plan:'#9d7558', texture:'mulch',
   tones:['#3a2016','#6d4028','#8a6446','#4e2c1d']},
  // The default bed mulch across the whole Southeast, and nothing else in the
  // list looks remotely like it — long rusty needles rather than chips.
  {id:'pine', label:'Pine straw', short:'Pine', fill:'#5e3c22', plan:'#c9a173', texture:'needle',
   tones:['#8a5a30','#a8703c','#c39257','#7a4a26']},
  // The size between crushed gravel and river cobble, and the one most people
  // actually mean by "gravel" in a bed or a patio.
  {id:'pea', label:'Pea gravel', short:'Pea', fill:'#6f6a5c', plan:'#d4cfc0', texture:'pebble',
   tones:['#9c9482','#bdb5a0','#cfc8b4','#a08a68']},
];
function bedStyle(id){ return BED_STYLES.find(c=>c.id===id)||BED_STYLES[0]; }
function bedStyleId(id){ return bedStyle(id).id; }
function bedFill(t,amb){
  const b=bedStyle(t&&t.c), fill=b.fill||amb.soil;
  if (!amb.snow) return fill;
  const snowMix=b.id==='soil' ? 0.76
    : (b.id==='leaf'||b.id==='mulch') ? 0.64
    : 0.52;
  return mixHex(fill,'#eef2f8',snowMix);
}
function bedPlanFill(t){ return bedStyle(t&&t.c).plan; }
/* Water. `fill` is the SHALLOW colour at the bank and `deep` the colour at full
   depth; `reach` is how many tiles it takes to shelve from one to the other, and
   is most of what tells the three apart at a glance — a pond drops away almost
   at once, a lake barely shelves inside a garden. `texture` picks the surface:
   still (pond), flowing (river), wind chop (lake). See the water block in
   world.js — depth and flow are read from a cached shore-distance field, not
   from the tile. */
const WATER_STYLES = [
  {id:'pond', label:'Pond', fill:'#5f9099', deep:'#33636f', edge:'#7da7a3', plan:'#9fc8d0',
   texture:'pond', reach:6},
  {id:'river', label:'River', fill:'#6f9fb0', deep:'#417d97', edge:'#8ab4b9', plan:'#a9d2df',
   texture:'river', reach:4},
  {id:'lake', label:'Lake', fill:'#4c7c96', deep:'#22506f', edge:'#789cae', plan:'#8fb7cf',
   texture:'lake', reach:12},
];
function waterStyle(id){ return WATER_STYLES.find(c=>c.id===id)||WATER_STYLES[0]; }
function waterStyleId(id){ return waterStyle(id).id; }
/* Which material is laid ON which, when two of them meet. A path is laid over a
   bed — you cut a path THROUGH planting, the bed does not stop and restart — so
   a path outranks a bed, and a bed outranks the water it runs down to.
   The organic renderer needs this because smoothing a boundary means pulling
   the edge in off the tile line, and if BOTH sides do that a sliver of lawn
   opens between them. Only one side has to stay exact, though: rank decides
   which, the higher rank is painted last, and its curve lands on the other's
   fill rather than on grass. Materials of equal rank (two bed styles, two path
   colours) both stay exact and butt, which is what they should do. */
/* Lawn is the MATRIX the other three are cut into — you cut a bed out of it,
   you lay a path across it, you dig a pond in it — so it sits below all of
   them and never bleeds over anything. It needs no rank of its own WITHIN the
   kind, because the mown lawn a meadow meets along a mown path is the absence
   of a record rather than a second region (see LAWN_STYLES). */
const TERRAIN_RANK = { lawn:0, water:1, bed:2, path:3 };
function terrainRank(kind){ const r=TERRAIN_RANK[kind]; return r===undefined?2:r; }
/* How far a material's edge may be rounded at a corner, in TILES. This is one
   number per material because the two kinds of edge want opposite things and a
   single global value cannot serve both.
   A BED or a POND edge is a sweeping curve, and the amount it sweeps IS the
   look: left unbounded, a corner is cut by |(A-B)+(C-B)|/4, which grows with
   the runs either side, so a long lazy bed edge rounds three times as hard as a
   one-tile wobble (measured on a real garden: 1.38 ft against 0.54 ft). That
   gradient is what reads as naturalistic, and clamping it to a constant ~0.4 ft
   everywhere made beds look cut out with scissors.
   PAVING is the opposite. A patio is set out with straight runs and real
   corners, and letting the rounding grow with the shape is exactly what took
   3.76 ft off the corners of an 11x12 tile gravel patio and bowed 2.34 ft out of
   a straight 10-tile run. One tile — 18 inches — is a real edge radius and, more
   to the point, a bound. */
const TERRAIN_FILLET = { lawn:Infinity, bed:Infinity, water:Infinity, path:1.0 };
function terrainFillet(kind){ const r=TERRAIN_FILLET[kind]; return r===undefined?1.0:r; }
// terrain edge look: crisp tiles for the structured styles, smoothed curves
// for the naturalistic ones. Seeds game.edgeStyle from the questionnaire.
const FORMAL_EDGE_STYLES=['formal','modern','japanese'];
function edgeStyleFromType(type){ return FORMAL_EDGE_STYLES.includes(type)?'formal':'organic'; }
function edgeStyleId(s){ return s==='formal'?'formal':'organic'; }
function waterFill(t,snow){ const w=waterStyle(t&&t.c);
  return snow ? mixHex(w.fill,'#e8f0f5',0.58) : w.fill; }
function waterPlanFill(t){ return waterStyle(t&&t.c).plan; }
/* ---------- lawn ----------
   Grass was the ABSENCE of terrain: nine paving materials, seven bed
   materials, and no way to say what the green was. So the one surface most
   gardens are mostly made of could not be drawn, only left behind — no long
   meadow, no clover, no moss, and above all no MOWN PATH THROUGH ROUGH GRASS,
   which is the signature move of the planting style this whole app argues for.
   It could not be billed either: the estimator has always reported bed area
   and edging feet and had no idea how much turf it was looking at.

   `mown` is the "none" row, exactly as EDGING_STYLES and WALL_STYLES carry
   one: painting it REMOVES the record, because a tile with no terrain already
   draws as mown lawn and always has. That is what makes mowing a path a paint
   gesture with a brush size rather than an erase, and it is why lawn needs no
   per-material rank — the two things that meet along a mown path are a region
   and the bare ground, not two regions.

   `tint`/`mix` are mixed over the SEASON's grass (AMBIENCE.grass), so a meadow
   browns off in fall with the rest of the garden instead of being pinned to
   one green; `fill` overrides that outright and is for the one surface that
   does not care what month it is.
   `follow` is how far the season drags it, and it is not decoration: grass
   goes over in autumn and clover, thyme and moss do not — moss is at its best
   in November. Mixed at a flat 1 the whole list collapsed to one tan in fall
   (measured: five of six surfaces inside rgb(148-167,140-149,81-91)), which
   is both wrong about the plants and throws away the distinction the
   materials exist to draw. `tones` are the grain colours, dark to
   light, read by drawMaterialGrain exactly like a bed's. `cut` is the standing
   height in inches — display only, and the reason a lawn and a meadow are one
   tool rather than two. */
const LAWN_STYLES = [
  {id:'mown',   label:'Mown Lawn',        short:'Mown',   texture:null, none:true, cut:2.5,
   plan:'#d7e2c0'},
  {id:'fescue', label:'No-Mow Fescue',    short:'No-mow', texture:'tussock', cut:8,
   tint:'#8fa563', mix:0.30, plan:'#cbdcae',
   tones:['#5c7040','#7d9455','#9aae6f','#6d8449']},
  {id:'meadow', label:'Long Meadow',      short:'Meadow', texture:'meadow', cut:24,
   tint:'#a8a468', mix:0.42, plan:'#ccc99a',
   tones:['#6b7442','#93975a','#b6b47c','#7f8b4c']},
  {id:'flower', label:'Wildflower Meadow',short:'Flower', texture:'flowermeadow', cut:20,
   tint:'#a3a76a', mix:0.38, plan:'#d2cf9f',
   tones:['#6b7442','#8f9557','#b2b178','#7a8749']},
  {id:'clover', label:'Clover Lawn',      short:'Clover', texture:'clover', cut:4,
   tint:'#6f9a55', mix:0.34, follow:0.35, plan:'#c3dcae',
   tones:['#41603a','#5d7f47','#7c9c5c','#94ad6a']},
  {id:'thyme',  label:'Thyme Lawn',       short:'Thyme',  texture:'tapestry', cut:3,
   tint:'#7d8f6a', mix:0.44, follow:0.30, plan:'#c8cfb2',
   tones:['#4a5a44','#6a7a58','#8a9670','#9b7f9a']},
  {id:'moss',   label:'Moss Lawn',        short:'Moss',   texture:'moss', cut:1,
   tint:'#4f7346', mix:0.58, follow:0.15, plan:'#b6cdaa',
   tones:['#33512f','#456b3c','#5a824c','#6f9459']},
  // The one surface that does not follow the season: a fixed fill, and a grain
  // that is deliberately too even. That evenness IS the tell.
  {id:'turf',   label:'Artificial Turf',  short:'Turf',   texture:'synthetic', cut:1.5,
   fill:'#5a8a4e', plan:'#a8c9a0',
   tones:['#456f3d','#578646','#699a54','#4e7a44']},
];
function lawnStyle(id){ return LAWN_STYLES.find(l=>l.id===id)||LAWN_STYLES[0]; }
function lawnStyleId(id){ return lawnStyle(id).id; }
function lawnLabelFor(id){ return lawnStyle(id).label; }
// the row that means "no record" — painting it lifts the lawn back to default
function lawnIsNone(id){ return !!lawnStyle(id).none; }
/* A lawn's base. Unlike a bed it is mixed over the SEASON's grass rather than
   laid on top of it, so a meadow is the same garden's autumn as the lawn
   beside it.
   mixCol, NOT mixHex, and the difference is not cosmetic: this is a CHAINED
   mix — the tint goes on the grass, then the season drags the result — so the
   second call is handed the first one's output. mixHex parses hex only and
   silently reads its own `rgb(...)` string as NaN, which clamps to black; the
   first cut of this did exactly that and rendered clover, thyme and moss as
   black tiles. mixCol goes through colorParts and takes either form. */
function lawnFill(t,amb){
  const L=lawnStyle(t&&t.c);
  const over=g=>L.tint ? mixCol(g,L.tint,L.mix==null?0.35:L.mix) : g;
  const follow=L.follow==null?1:L.follow;
  const seasonal=over((amb&&amb.grass&&amb.grass[0])||'#6f8f5a');
  // Summer is the anchor a reluctant surface is held back toward: it is the
  // month every one of these is doing what it was chosen for.
  const base = L.fill || (follow>=1 ? seasonal
    : mixCol(over(AMBIENCE.Summer.grass[0]), seasonal, follow));
  // Long grass stands up through a light fall, so it takes less of the snow
  // than a surface lying flat under it does.
  return (amb&&amb.snow) ? mixCol(base,'#eef2f8', L.cut>=12?0.5:0.68) : base;
}
function lawnPlanFill(t){ return lawnStyle(t&&t.c).plan; }
/* The GRAIN a lawn tile draws with — null for the 'mown' row. That row should
   never reach a record, because painting it removes one, but a hand-edited or
   shared file could carry it and it has to fall back to bare ground rather
   than to a flat green tile with no texture and no bevel. */
function lawnMaterial(c){ const L=lawnStyle(c); return L.texture ? L : null; }
/* Edging is the strip that separates a bed or a path from the LAWN. It is
   the last thing the Wave 5 estimator could measure and the app could not
   draw — `materialPerimeterFt` has been reporting exposed bed edge in feet
   for a material that did not exist.
   It rides the terrain record (`{k, c, e}`) exactly as a retaining wall rides
   the elevation record, so it inherits the ground-bake and region-trace
   invalidation that terrain edits already trigger. Widths are the real thing
   seen from above: a steel strip is a line, a brick soldier course is 4in.
   `unitIn` marks the laid materials, whose units are counted along the run. */
const EDGING_STYLES = [
  {id:'none',   label:'No edging',      short:'None',   w:0},
  {id:'spade',  label:'Cut Spade Edge', short:'Spade',  w:2.6, col:'#3f3222', soil:true},
  {id:'steel',  label:'Steel Edging',   short:'Steel',  w:2.0, col:'#43443f'},
  {id:'alu',    label:'Aluminium Edge', short:'Alu',    w:1.9, col:'#9ba1a3'},
  {id:'corten', label:'Corten Strip',   short:'Corten', w:2.3, col:'#8d5134'},
  {id:'timber', label:'Timber Board',   short:'Timber', w:3.6, col:'#7d6142'},
  {id:'brick',  label:'Brick Soldier',  short:'Brick',  w:5.0, col:'#a35c43', unitIn:8},
  {id:'setts',  label:'Stone Setts',    short:'Setts',  w:5.0, col:'#96928a', unitIn:5},
];
function edgingStyle(id){ return EDGING_STYLES.find(e=>e.id===id)||EDGING_STYLES[0]; }
function edgingStyleId(id){ return edgingStyle(id).id; }
function edgingLabelFor(id){ return edgingStyle(id).label; }
const ELEV_TOOLS = ['raise','lower','level'];
function isElevationTool(t){ return ELEV_TOOLS.includes(t); }
/* Fence materials. `infill` names the panel recipe drawFence paints between
   posts, exactly as a plant's `form` names its drawing branch — one
   data-driven painter, no per-style `f.style==='brick'` chains, so a new
   material is a data row. `post`/`rail`/`fill` are structure / horizontal
   member / panel; `cap` is the post top; `gateLeaf` overrides the infill for a
   gate's swinging leaf (a brick wall's gate is an iron gate, not a brick slab);
   `header` is what spans a gate opening; `heights` limits the material to the
   spans it is really built at — a split rail fence is not 8 ft tall and a
   privacy fence is not 3 ft. Omit `heights` to allow all of FENCE_HEIGHTS. */
const FENCE_STYLES = [
  {id:'black', label:'Black Aluminum', short:'Black', infill:'bar', cap:'spear',
   header:'lintel', post:'#1e1d1b', rail:'#2f312f', fill:'#151514', heights:[3,4,5,6]},
  {id:'wood', label:'Wood Picket', short:'Picket', infill:'picket', cap:'point',
   post:'#7b5636', rail:'#9a7148', fill:'#6a4529', heights:[3,4,5]},
  {id:'privacy', label:'Cedar Privacy', short:'Privacy', infill:'privacy', cap:'flat',
   post:'#6b4a2f', rail:'#8a6440', fill:'#9d7247', heights:[5,6,8]},
  {id:'slat', label:'Horizontal Slat', short:'Slat', infill:'slat', cap:'flat',
   post:'#4a423a', rail:'#7d6b55', fill:'#6a5b49', heights:[4,5,6,8]},
  {id:'rail', label:'Split Rail', short:'Split rail', infill:'rail', cap:'flat',
   post:'#8a7355', rail:'#9c8465', fill:'#7d674c', heights:[3,4]},
  {id:'vinyl', label:'Vinyl', short:'Vinyl', infill:'picket', cap:'ball',
   post:'#eee8dc', rail:'#f8f3e8', fill:'#d8d0c2', heights:[3,4,5,6]},
  {id:'chainlink', label:'Chainlink', short:'Chainlink', infill:'chain', cap:'flat',
   header:'lintel', gateLeaf:'chain', post:'#68757a', rail:'#aab5b5', fill:'#d5dddd'},
  {id:'mesh', label:'Garden Wire', short:'Wire', infill:'mesh', cap:'flat',
   header:'lintel', post:'#6b5a44', rail:'#8a7a62', fill:'#b9bfb8'},
  {id:'brick', label:'Brick', short:'Brick', infill:'masonry', cap:'coping', coursed:true,
   gateLeaf:'bar', post:'#8f4e3a', rail:'#a85f45', fill:'#6f382d', heights:[3,4,5,6]},
  {id:'stone', label:'Stone Wall', short:'Stone', infill:'masonry', cap:'coping', coursed:false,
   gateLeaf:'bar', post:'#8d8a80', rail:'#9d9a90', fill:'#7c7a72', heights:[3,4,5,6]},
  {id:'woven', label:'Woven Hurdle', short:'Hurdle', infill:'woven', cap:'flat',
   post:'#8a7550', rail:'#a08a5f', fill:'#b39a6b', heights:[3,4,5]},
  {id:'screen', label:'Bamboo Screen', short:'Bamboo', infill:'screen', cap:'flat',
   post:'#7a6a4a', rail:'#8f7c56', fill:'#c2a86a', heights:[4,5,6,8]},
];
/* 3 ft low boundary, 4 ft the common yard/pool minimum, 5 ft semi-privacy (and
   the pool-barrier height a lot of municipalities actually require), 6 ft
   privacy, 8 ft deer. The 5 ft step is only worth having because the fence
   now draws at PX_PER_FT: at the old 26/36px hand-picked heights the whole
   4->6 ft range was 10px, so a 5 ft option would have differed from its
   neighbours by five pixels. It is a ~21px step now. */
const FENCE_HEIGHTS = [3,4,5,6,8];
function fenceStyle(id){ return FENCE_STYLES.find(f=>f.id===id)||FENCE_STYLES[0]; }
function fenceStyleId(id){ return fenceStyle(id).id; }
// the heights this material is really built at, in FENCE_HEIGHTS order
function fenceStyleHeights(id){
  const st=fenceStyle(id);
  return st.heights ? FENCE_HEIGHTS.filter(h=>st.heights.includes(h)) : FENCE_HEIGHTS.slice();
}
/* Snap a height onto what the material offers, nearest wins — so switching
   from a 3 ft split rail to Cedar Privacy lands on its shortest real height
   rather than silently resetting to the default. */
function fenceHeightFor(styleId,h){
  const opts=fenceStyleHeights(styleId);
  if (opts.includes(h)) return h;
  const want=FENCE_HEIGHTS.includes(h)?h:4;
  return opts.reduce((a,b)=>Math.abs(b-want)<Math.abs(a-want)?b:a, opts[0]);
}
function normalizeFenceDraft(d){
  d=d||{};
  const style=fenceStyleId(d.style);
  return {
    style,
    height:fenceHeightFor(style,d.height),
    gate:!!d.gate
  };
}
// drawn height of a placed fence, in screen px above its tile
function fenceDrawH(f){ return Math.round(fenceHeightFor(fenceStyleId(f&&f.style), f&&f.height)*PX_PER_FT); }
const LIGHT_TYPES = [
  {id:'path', label:'Path light', short:'Path', h:18, kind:'path'},
  {id:'lantern', label:'Lantern post', short:'Lantern', h:42, kind:'post'},
  {id:'lamp', label:'Outdoor lamp', short:'Lamp', h:30, kind:'lamp'},
];
const LIGHT_TONES = [
  {id:'eco', label:'Eco friendly', short:'Eco', col:'#b9d483', glow:'rgba(190,224,130,'},
  {id:'warm', label:'Warm', short:'Warm', col:'#ffd28a', glow:'rgba(255,194,112,'},
  {id:'bright', label:'Bright', short:'Bright', col:'#f1f7ff', glow:'rgba(218,234,255,'},
];
function lightType(id){ return LIGHT_TYPES.find(l=>l.id===id)||LIGHT_TYPES[0]; }
function lightTone(id){ return LIGHT_TONES.find(l=>l.id===id)||LIGHT_TONES[1]; }
function lightTypeId(id){ return lightType(id).id; }
function lightToneId(id){ return lightTone(id).id; }
function normalizeLightDraft(d){
  d=d||{};
  return {type:lightTypeId(d.type), tone:lightToneId(d.tone)};
}
const FIREPIT_SIZES = [
  {id:'round24', shape:'round', label:'24 in', plan:'24x24', wIn:24, hIn:24},
  {id:'round36', shape:'round', label:'36 in', plan:'36x36', wIn:36, hIn:36},
  {id:'round48', shape:'round', label:'48 in', plan:'48x48', wIn:48, hIn:48},
  {id:'square36', shape:'square', label:'36 sq', plan:'36x36', wIn:36, hIn:36},
  {id:'rect24x48', shape:'square', label:'24x48', plan:'24x48', wIn:48, hIn:24},
];
function firepitSize(id,shape){
  const s=FIREPIT_SIZES.find(f=>f.id===id);
  if (s && (!shape || s.shape===shape)) return s;
  return FIREPIT_SIZES.find(f=>f.shape===(shape||'round'))||FIREPIT_SIZES[1];
}
function normalizeFirepitDraft(d){
  d=d||{};
  const shape=d.shape==='square'?'square':'round';
  const size=firepitSize(d.size,shape);
  return {shape:size.shape, size:size.id};
}
function firepitTileSize(f){
  const s=firepitSize(f&&f.size,f&&f.shape);
  return {
    w:Math.max(1,Math.ceil(s.wIn/TILE_IN)),
    h:Math.max(1,Math.ceil(s.hIn/TILE_IN)),
    spec:s
  };
}
const BOULDER_TYPES = [
  {id:'round1',   label:'Round Boulder',       short:'Round',      shape:'round',  plan:'1x1', w:1, h:1, tone:'#808276'},
  {id:'small1',   label:'Small Boulder',       short:'Small 1x1',  shape:'round',  plan:'1x1', w:1, h:1, tone:'#77796e'},
  {id:'small2',   label:'Small Boulder',       short:'Small 2x2',  shape:'round',  plan:'2x2', w:2, h:2, tone:'#86867b'},
  {id:'medium2',  label:'Medium Boulder',      short:'Medium',     shape:'round',  plan:'2x2', w:2, h:2, tone:'#7d8178'},
  {id:'large32',  label:'Large Boulder',       short:'Large 3x2',  shape:'round',  plan:'3x2', w:3, h:2, tone:'#87877e'},
  {id:'large3',   label:'Large Boulder',       short:'Large 3x3',  shape:'round',  plan:'3x3', w:3, h:3, tone:'#777b72'},
  {id:'oblong21', label:'Oblong Boulder',      short:'Oblong 2x1', shape:'oblong', plan:'2x1', w:2, h:1, tone:'#827d72'},
  {id:'oblong31', label:'Long Oblong Boulder', short:'Oblong 3x1', shape:'oblong', plan:'3x1', w:3, h:1, tone:'#797b73'},
  {id:'rect32',   label:'Rectangular Boulder', short:'Rect 3x2',   shape:'rect',   plan:'3x2', w:3, h:2, tone:'#7f7a70'},
];
function boulderType(id){ return BOULDER_TYPES.find(b=>b.id===id)||BOULDER_TYPES[0]; }
function boulderTypeId(id){ return boulderType(id).id; }
function normalizeBoulderDraft(d){ d=d||{}; return {type:boulderTypeId(d.type)}; }
function boulderTileSize(b){
  const spec=boulderType(b&&b.type);
  return {w:Math.max(1,spec.w||1), h:Math.max(1,spec.h||1), spec};
}

/* ---------- vertical supports ----------
   A garden is designed vertically and this app could only draw flat: below 8ft
   of fence there was nothing between the ground and a tree. These are the
   things a climber grows ON — and they exist BECAUSE of the climber, which is
   why the rule between them is symmetric and strict: a `vine` may only be
   planted on a support, and only a `vine` may be planted on one.

   That is the CONTAINER bargain (§12b) rather than a new one. A pot does not
   own its planting — the plant stays an ordinary plant in game.plants on the
   same tile and `potAt` is the predicate that changes the rules — so the
   planting list, the bloom calendar, the plan sheet and discovery all keep
   working untouched. `supportAt` is the same predicate for the same reason.

   `form` names the drawing branch; `ft` is the real height a climber may reach
   on it, drawn through PX_PER_FT like a fence, so a 6ft obelisk and a 6ft
   fence hold their plants at the same height. `face:true` marks the two that
   read differently when turned. */
const SUPPORT_STYLES = [
  {id:'obelisk', label:'Obelisk',       short:'Obelisk', form:'obelisk', wIn:22, dIn:22, ft:7,
   materials:['timber','black','willow']},
  {id:'trellis', label:'Trellis Panel', short:'Trellis', form:'panel',   wIn:34, dIn:4,  ft:6, face:true,
   materials:['timber','black','willow']},
  {id:'arch',    label:'Garden Arch',   short:'Arch',    form:'arch',    wIn:46, dIn:20, ft:8, face:true,
   materials:['black','timber','willow']},
];
const SUPPORT_MATERIALS = [
  {id:'timber', label:'Timber',      wood:'#8a6a44', dark:'#5f4526', light:'#a8865c'},
  {id:'black',  label:'Black Metal', wood:'#2c2c30', dark:'#191919', light:'#4a4a50'},
  {id:'willow', label:'Woven Willow',wood:'#a58b5c', dark:'#7a6339', light:'#c0a878'},
];
function supportStyle(id){ return SUPPORT_STYLES.find(s=>s.id===id)||SUPPORT_STYLES[0]; }
function supportStyleId(id){ return supportStyle(id).id; }
function supportMaterial(id){ return SUPPORT_MATERIALS.find(m=>m.id===id)||SUPPORT_MATERIALS[0]; }
// the materials a support is really made in — the potStyleSizes idiom, ordered
// by the FORM so the first one listed is its default (see waterFeatureFinishes)
function supportMaterials(id){
  const s=supportStyle(id);
  if (!s.materials) return SUPPORT_MATERIALS;
  return s.materials.map(m=>SUPPORT_MATERIALS.find(x=>x.id===m)).filter(Boolean);
}
function supportMaterialFor(styleId,matId){
  const opts=supportMaterials(styleId);
  return opts.some(m=>m.id===matId) ? matId : opts[0].id;
}
function normalizeSupportDraft(d){
  d=d&&typeof d==='object'?d:{};
  const style=supportStyleId(d.style);
  return {style, mat:supportMaterialFor(style,d.mat), face:normalizeFacing(d.face)};
}
function supportTileSize(d){
  const s=supportStyle(d&&d.style);
  const tw=Math.max(1,Math.round(s.wIn/TILE_IN)), td=Math.max(1,Math.round(s.dIn/TILE_IN));
  return normalizeFacing(d&&d.face)%2 ? {w:td,h:tw,spec:s} : {w:tw,h:td,spec:s};
}
function supportLabelFor(d){
  d=normalizeSupportDraft(d);
  return `${supportMaterial(d.mat).label} ${supportStyle(d.style).label.toLowerCase()}`;
}

/* ---------- water features ----------
   Pond, river and lake are AREAS — you paint them, they shelve from a bank,
   and they are the only water this app could draw. But the water that makes a
   garden is usually an OBJECT: a birdbath, a bubbling urn, a basin at the end
   of a path. That is the same argument seating was added on — you plant toward
   the view from a bench, and a water feature is what a path leads TO — and it
   is also the one garden object people ask for by name.

   Sizes are real inches, like seating and containers, and the footprint follows
   the fire-pit pattern: origin tile plus a claimed rectangle. A fire pit is the
   closest sibling in every way (a built focal point with a real footprint and
   its own tray sub-page), which is why these sit beside each other on Hardscape.

   `form` names the drawing branch the way a plant names its `form` and a fence
   names its `infill`; `water` names how the water reads — still, welling up
   over a sealed vessel, or falling. `bed:true` means the vessel stands on a
   gravel reservoir rather than on open ground, which is what a modern bubbler
   actually is: no open water, nothing to drown in, and the reason those two
   are the ones people put in a garden with small children. */
const WATER_FEATURES = [
  {id:'birdbath',  label:'Birdbath',            short:'Birdbath',  form:'pedestal',
   wIn:26, dIn:26, hIn:34, water:'still',   finishes:['stone','slate','bronze']},
  {id:'urn',       label:'Bubbling Urn',        short:'Urn',       form:'urn',
   wIn:26, dIn:26, hIn:32, water:'welling', bed:true, finishes:['stone','corten','glazed']},
  {id:'millstone', label:'Bubbling Millstone',  short:'Millstone', form:'millstone',
   wIn:34, dIn:34, hIn:9,  water:'welling', bed:true, finishes:['stone','slate']},
  {id:'tiered',    label:'Tiered Fountain',     short:'Tiered',    form:'tiered',
   wIn:40, dIn:40, hIn:62, water:'falling', finishes:['stone','slate','bronze']},
  {id:'tsukubai',  label:'Stone Water Basin',   short:'Stone basin', form:'tsukubai',
   wIn:22, dIn:22, hIn:15, water:'still',   finishes:['stone','slate']},
  {id:'spout',     label:'Wall Spout & Trough', short:'Wall spout', form:'spout',
   wIn:38, dIn:16, hIn:54, water:'falling', finishes:['corten','stone','bronze']},
  {id:'tank',      label:'Stock Tank Pool',     short:'Stock tank', form:'tank',
   wIn:70, dIn:70, hIn:24, water:'still',   finishes:['galv','corten']},
  {id:'pool',      label:'Reflecting Basin',    short:'Basin pool', form:'basin',
   wIn:72, dIn:36, hIn:15, water:'still',   finishes:['stone','corten','slate']},
];
/* Finish is an axis of its own, like a seat's, because the same basin really is
   sold in cast stone and in corten and they are different design decisions. Not
   every form takes every finish — a stock tank is galvanised by definition —
   so a form may name the ones it is made in, exactly as a pot style names the
   sizes it comes in. */
const WATER_FINISHES = [
  {id:'stone',  label:'Cast Stone',  body:'#9a9489', rim:'#b3ada1', dark:'#6f6a61'},
  {id:'slate',  label:'Slate',       body:'#6b7276', rim:'#868d91', dark:'#474d51'},
  {id:'corten', label:'Corten',      body:'#8d5134', rim:'#a86840', dark:'#5f341f'},
  {id:'bronze', label:'Bronze',      body:'#6e5a36', rim:'#8d7748', dark:'#463823'},
  {id:'glazed', label:'Glazed Blue', body:'#3f6f86', rim:'#5b8ba2', dark:'#28495a'},
  {id:'galv',   label:'Galvanised',  body:'#8e949a', rim:'#aab0b6', dark:'#666c72'},
];
function waterFeature(id){ return WATER_FEATURES.find(w=>w.id===id)||WATER_FEATURES[0]; }
function waterFeatureId(id){ return waterFeature(id).id; }
function waterFinish(id){ return WATER_FINISHES.find(f=>f.id===id)||WATER_FINISHES[0]; }
/* The finishes a form is really made in — the potStyleSizes idiom, with one
   difference that matters: the order is the FORM's, not the table's, so the
   first one listed is the default. Filtering WATER_FINISHES instead made a
   stock tank default to corten because corten sits earlier in that table than
   galvanised, which is the one finish a stock tank is actually made in. */
function waterFeatureFinishes(id){
  const w=waterFeature(id);
  if (!w.finishes) return WATER_FINISHES;
  return w.finishes.map(fid=>WATER_FINISHES.find(f=>f.id===fid)).filter(Boolean);
}
function waterFinishFor(formId,finishId){
  const opts=waterFeatureFinishes(formId);
  return opts.some(f=>f.id===finishId) ? finishId : opts[0].id;
}
function normalizeWaterFeatureDraft(d){
  d=d&&typeof d==='object'?d:{};
  const form=waterFeatureId(d.form);
  return {form, finish:waterFinishFor(form,d.finish), face:normalizeFacing(d.face)};
}
/* Footprint in tiles. Same rounding as seating, so anything up to about 27in
   claims a single tile and overhangs it the way a shrub canopy does; the tank
   and the basin are genuinely large and take real ground. A quarter turn swaps
   the claim so it follows the drawing. */
function waterFeatureTileSize(d){
  const w=waterFeature(d&&d.form);
  const tw=Math.max(1,Math.round(w.wIn/TILE_IN)), td=Math.max(1,Math.round(w.dIn/TILE_IN));
  return normalizeFacing(d&&d.face)%2 ? {w:td,h:tw,spec:w} : {w:tw,h:td,spec:w};
}
function waterFeatureLabelFor(d){
  d=normalizeWaterFeatureDraft(d);
  return `${waterFinish(d.finish).label} ${waterFeature(d.form).label.toLowerCase()}`;
}

/* ---------- garden pets: a cat or dog as ornament ----------
   All that survives of the retired avatar. A pet is a one-tile decoration with
   no behaviour: it never moves, casts no shade, and is deliberately left OFF
   the design plan and the planting list, which are the documents a client
   sees. Coats are stored by ID (not hex) so the palette can be retuned without
   rewriting saves — same contract as fence styles and path colours. */
const PET_SPECIES = [
  {id:'cat', label:'Cat'},
  {id:'dog', label:'Dog'},
];
/* `d` is the shadow tone: it draws the tail, the legs, the dog's ears and the
   eye patch, so it is what gives a coat its structure. A pale coat needs a
   MUCH deeper `d` than its body colour suggests, or the animal reads as a
   featureless blob against light grass — that is what was wrong with Birch. */
const PET_COATS = [
  {id:'marmalade', label:'Marmalade', c:'#d98a4a', d:'#a35a2e'},
  {id:'russet',    label:'Russet',    c:'#b4562c', d:'#7d3418'},
  {id:'cocoa',     label:'Cocoa',     c:'#7a5236', d:'#54371f'},
  {id:'fawn',      label:'Fawn',      c:'#cfa871', d:'#9a7440'},
  {id:'cream',     label:'Cream',     c:'#e8d9b8', d:'#b99a63'},
  {id:'birch',     label:'Birch',     c:'#f2ede1', d:'#a1957f'},
  {id:'smoke',     label:'Smoke',     c:'#9a9aa2', d:'#66666f'},
  {id:'charcoal',  label:'Charcoal',  c:'#4a4a52', d:'#2e2e34'},
  {id:'ink',       label:'Ink',       c:'#2c2b30', d:'#141317'},
];
const PET_MARKS = [
  {id:'solid',  label:'Solid'},
  {id:'tuxedo', label:'Tuxedo'},
  {id:'patch',  label:'Eye patch'},
];
/* Socks. `c:null` means "same as the coat's shadow", i.e. no socks at all.
   Small, and entirely the point: somebody's black dog has brown feet. */
const PET_PAWS = [
  {id:'match', label:'No socks', c:null},
  {id:'brown', label:'Brown',    c:'#7d5533'},
  {id:'tan',   label:'Tan',      c:'#c9a271'},
  {id:'white', label:'White',    c:'#f4efe4'},
  {id:'black', label:'Black',    c:'#1d1c20'},
];
function petSpecies(id){ return PET_SPECIES.find(s=>s.id===id)||PET_SPECIES[0]; }
function petCoat(id){ return PET_COATS.find(c=>c.id===id)||PET_COATS[0]; }
function petMark(id){ return PET_MARKS.find(m=>m.id===id)||PET_MARKS[0]; }
function petPaw(id){ return PET_PAWS.find(p=>p.id===id)||PET_PAWS[0]; }
function normalizePetDraft(d){
  d=d&&typeof d==='object'?d:{};
  return {species:petSpecies(d.species).id, coat:petCoat(d.coat).id,
    mark:petMark(d.mark).id, paws:petPaw(d.paws).id};
}

/* ---------- containers ----------
   A pot is the only thing in the app that makes PAVING plantable. Every
   planting route refuses `path` terrain — correctly, you cannot dig a gravel
   drive — so before containers a courtyard, patio or roof terrace was a garden
   this app could draw and not plant. That is the reason they exist; the
   ornament is a bonus.

   Style and size are independent the way a fence's material and height are, so
   terracotta comes in every size rather than each combination being its own
   row. `hIn` is a real height and the pot draws through PX_PER_FT (§11d); its
   rim is what lifts the plant's draw anchor. `form` names the silhouette the
   way a plant names its `form` — one painter, no per-style branches. */
const POT_STYLES = [
  {id:'terracotta', label:'Terracotta',   short:'Terracotta', form:'taper',  body:'#b4633f', rim:'#c97a53', soil:'#4a3a2a'},
  {id:'glazed',     label:'Glazed Blue',  short:'Glazed',     form:'belly',  body:'#3f6f86', rim:'#54889e', soil:'#4a3a2a'},
  {id:'concrete',   label:'Cast Stone',   short:'Stone',      form:'square', body:'#9a9789', rim:'#aeab9d', soil:'#4a3a2a'},
  {id:'timber',     label:'Timber Box',   short:'Timber',     form:'crate',  body:'#7d6142', rim:'#96774f', soil:'#4a3a2a'},
  {id:'metal',      label:'Galvanised',   short:'Metal',      form:'tub',    body:'#8e949a', rim:'#a9afb5', soil:'#4a3a2a'},
  {id:'urn',        label:'Classical Urn',short:'Urn',        form:'urn',    body:'#8b8478', rim:'#a09889', soil:'#4a3a2a'},
  {id:'trough',     label:'Long Trough',  short:'Trough',     form:'trough', body:'#8a8175', rim:'#9d9488', soil:'#4a3a2a', sizes:['trough36','trough54']},
];
/* Real diameters. Everything up to 24in claims a single tile — a tile is 18
   inches, so a big pot overhangs its own tile the way a shrub's canopy does,
   which is honest and keeps placement a one-tile question. The troughs are
   genuinely long, so they take a real multi-tile footprint like a fire pit. */
const POT_SIZES = [
  {id:'p10', label:'10 in', wIn:10, hIn:9,  round:true},
  {id:'p14', label:'14 in', wIn:14, hIn:13, round:true},
  {id:'p18', label:'18 in', wIn:18, hIn:16, round:true},
  {id:'p24', label:'24 in', wIn:24, hIn:21, round:true},
  {id:'p30', label:'30 in', wIn:30, hIn:26, round:true},
  {id:'trough36', label:'36 in', wIn:36, hIn:16, round:false},
  {id:'trough54', label:'54 in', wIn:54, hIn:16, round:false},
];
function potStyle(id){ return POT_STYLES.find(p=>p.id===id)||POT_STYLES[0]; }
function potSizeDef(id){ return POT_SIZES.find(p=>p.id===id)||POT_SIZES[2]; }
// the sizes a vessel is really made in — a trough is not a 10in pot
function potStyleSizes(id){
  const st=potStyle(id);
  return st.sizes ? POT_SIZES.filter(s=>st.sizes.includes(s.id)) : POT_SIZES.filter(s=>s.round);
}
function potSizeFor(styleId,sizeId){
  const opts=potStyleSizes(styleId);
  return opts.some(s=>s.id===sizeId) ? sizeId : opts[Math.min(2,opts.length-1)].id;
}
// footprint in tiles; only the troughs are wider than one
function potTileSize(d){
  const s=potSizeDef(potSizeFor(potStyleId(d&&d.style), d&&d.size));
  const w=Math.max(1,Math.round(s.wIn/TILE_IN));
  return normalizeFacing(d&&d.face)%2 ? {w:1,h:w} : {w,h:1};
}
function potStyleId(id){ return potStyle(id).id; }
function normalizePotDraft(d){
  d=d&&typeof d==='object'?d:{};
  const style=potStyleId(d.style);
  // only a trough is directional, but carrying the field for every vessel keeps
  // one placement path rather than two
  return {style, size:potSizeFor(style,d.size), face:normalizeFacing(d.face)};
}
function potLabelFor(d){
  d=normalizePotDraft(d);
  return `${potSizeDef(d.size).label} ${potStyle(d.style).label.toLowerCase()}`;
}

/* ---------- seating ----------
   A plan with nowhere to sit is a plant list, not a garden. Seating also drives
   layout — you plant TOWARD the view from a bench — so it belongs in the model
   even though it grows nothing. Sizes are real inches; the footprint follows
   the fire-pit pattern. `form` picks the drawing branch. */
const SEAT_FINISHES = [
  {id:'teak',   label:'Teak',    wood:'#a97f4e', dark:'#7a5730', metal:'#6b6156'},
  {id:'painted',label:'Painted', wood:'#e6e0d2', dark:'#b3ab99', metal:'#8d8677'},
  {id:'black',  label:'Black',   wood:'#3a3a3e', dark:'#232327', metal:'#2b2b2f'},
  {id:'stone',  label:'Stone',   wood:'#9d998c', dark:'#7b776b', metal:'#8b8779'},
];
/* Tables come WITHOUT chairs and chairs are placed individually. Bundling
   them looked like a convenience and was three problems: the chairs drew over
   the table top because one object cannot depth-sort against itself, the
   footprint claimed ground the table does not actually occupy, and you could
   not seat three people or turn one chair to face the view. A picnic table
   keeps its benches because they are genuinely bolted to it. */
const SEAT_TYPES = [
  {id:'bench4',  label:'Garden Bench 4 ft', short:'Bench 4ft', form:'bench',  wIn:48, dIn:22, hIn:34},
  {id:'bench6',  label:'Garden Bench 6 ft', short:'Bench 6ft', form:'bench',  wIn:72, dIn:22, hIn:34},
  {id:'chair',   label:'Adirondack Chair',  short:'Adirondack',form:'adirondack', wIn:32, dIn:34, hIn:38},
  {id:'dchair',  label:'Dining Chair',      short:'Chair',     form:'chair',  wIn:20, dIn:20, hIn:35},
  {id:'stool',   label:'Garden Stool',      short:'Stool',     form:'stool',  wIn:16, dIn:16, hIn:18},
  {id:'bistro',  label:'Bistro Table',      short:'Bistro',    form:'bistro', wIn:26, dIn:26, hIn:30},
  {id:'dining',  label:'Dining Table',      short:'Dining',    form:'dining', wIn:72, dIn:36, hIn:30},
  {id:'picnic',  label:'Picnic Table',      short:'Picnic',    form:'picnic', wIn:60, dIn:60, hIn:30},
  {id:'lounger', label:'Sun Lounger',       short:'Lounger',   form:'lounger',wIn:26, dIn:76, hIn:36},
];
function seatType(id){ return SEAT_TYPES.find(s=>s.id===id)||SEAT_TYPES[0]; }
function seatFinish(id){ return SEAT_FINISHES.find(f=>f.id===id)||SEAT_FINISHES[0]; }
function seatTileSize(d){
  const t=seatType(d&&d.type);
  const w=Math.max(1,Math.round(t.wIn/TILE_IN)), h=Math.max(1,Math.round(t.dIn/TILE_IN));
  // a quarter turn swaps the footprint, so the claim follows the drawing
  return normalizeFacing(d&&d.face)%2 ? {w:h,h:w} : {w,h};
}
// quarter turns of the object itself, independent of the camera's game.rot
function normalizeFacing(f){ f=Math.round(Number(f)||0)%4; return f<0?f+4:f; }
function normalizeSeatDraft(d){
  d=d&&typeof d==='object'?d:{};
  return {type:seatType(d.type).id, finish:seatFinish(d.finish).id, face:normalizeFacing(d.face)};
}
function seatLabelFor(d){
  d=normalizeSeatDraft(d);
  return `${seatFinish(d.finish).label} ${seatType(d.type).label.toLowerCase()}`;
}

/* The Oudolf palette — PLANTS and PLANT_KEYS — lives in plants.js,
   which index.html loads before this file. */

/* Resolve a species key + optional cultivar into an effective plant def:
   the cultivar's overrides merge over the straight species, including nested
   look knobs and per-season colors. Cached — render asks every frame. */
const _defCache={};
function plantDef(key,v){
  const canonical=canonicalPlantRef(key,v); key=canonical.s; v=canonical.v;
  const base=PLANTS[key];
  if (!v || !base || !base.cv || !base.cv[v]) return base;
  const ck=key+'|'+v;
  if (_defCache[ck]) return _defCache[ck];
  const c=base.cv[v];
  const d=Object.assign({},base,c,{name:c.fullName||base.name+' '+c.name,
    look:Object.assign({},base.look||{},c.look||{}),sea:{}});
  for (const s of SEASONS) d.sea[s]=Object.assign({},base.sea[s],(c.sea||{})[s]);
  if (base.flowerColorFamilies || c.flowerColorFamilies){
    d.flowerColorFamilies={};
    for (const s of SEASONS) d.flowerColorFamilies[s]=Object.assign({},base.flowerColorFamilies||{},c.flowerColorFamilies||{})[s];
  }
  return _defCache[ck]=d;
}

/* Native-plant data is relational: a plant is native TO a region, and a
   named garden selection is not the same thing as the straight species.
   The first selectable ranges are deliberately continental: they are honest
   at this catalog's source resolution and useful on both sides of the
   Atlantic without inventing local boundaries. `nativeTo` lives on every resolved plant definition and
   `provenance` is species | selection | hybrid. */
const NATIVE_REGIONS=Object.freeze([
  {id:'north-america', label:'North America', short:'North America'},
  {id:'europe', label:'Europe', short:'Europe'},
  {id:'asia', label:'Asia', short:'Asia', selectable:false},
  {id:'africa', label:'Africa', short:'Africa', selectable:false},
  {id:'central-america', label:'Mexico and Central America', short:'Mexico/Central America', selectable:false},
  {id:'south-america', label:'South America', short:'South America', selectable:false},
  {id:'australasia', label:'Australasia', short:'Australasia', selectable:false},
]);
const NATIVE_REGION_IDS=new Set(NATIVE_REGIONS.filter(r=>r.selectable!==false).map(r=>r.id));
const DEFAULT_NATIVE_REGION='north-america';
const NATIVE_MODES=Object.freeze([
  {id:'any',label:'Any origin'},
  {id:'regional',label:'Continent natives + selections'},
  {id:'straight',label:'Straight species from continent'},
]);
const NATIVE_MODE_IDS=new Set(NATIVE_MODES.map(m=>m.id));
function normalizeNativeRegion(value){ return NATIVE_REGION_IDS.has(value)?value:DEFAULT_NATIVE_REGION; }
function normalizeNativeMode(value){ return NATIVE_MODE_IDS.has(value)?value:'any'; }
function nativeRegionLabel(id,short){
  const r=NATIVE_REGIONS.find(x=>x.id===id) || NATIVE_REGIONS.find(x=>x.id===DEFAULT_NATIVE_REGION);
  return short?r.short:r.label;
}
function nativeRelation(P,region=DEFAULT_NATIVE_REGION){
  const nativeTo=Array.isArray(P&&P.nativeTo)?P.nativeTo:[];
  const provenance=P&&['species','selection','hybrid'].includes(P.provenance)?P.provenance:'hybrid';
  const nativeHere=nativeTo.includes(normalizeNativeRegion(region));
  const kind=nativeHere
    ? (provenance==='species'?'native':provenance==='selection'?'selection':'hybrid')
    : (provenance==='hybrid'?'hybrid':nativeTo.length?'elsewhere':'garden');
  return {kind,nativeHere,nativeTo,provenance,
    regional:nativeHere&&provenance!=='hybrid',
    straight:nativeHere&&provenance==='species'};
}
function passesNativeFilter(P,criteria){
  const f=criteria||{}, mode=normalizeNativeMode(f.nativeMode), relation=nativeRelation(P,f.nativeRegion);
  return mode==='any' || (mode==='regional'?relation.regional:relation.straight);
}
function nativeCriteriaText(criteria){
  const f=criteria||{}, mode=normalizeNativeMode(f.nativeMode), place=nativeRegionLabel(f.nativeRegion);
  const scope=' Continental origin does not establish local native status or regional invasive risk.';
  if (mode==='regional') return `Species native somewhere in ${place}; named selections included, garden hybrids excluded.`+scope;
  if (mode==='straight') return `Species native somewhere in ${place}; named selections and garden hybrids excluded.`+scope;
  return 'Any origin. Local native status and regional invasive risk are not checked by this filter.';
}
function nativeStatusText(P,region=DEFAULT_NATIVE_REGION){
  const r=nativeRelation(P,region), place=nativeRegionLabel(region);
  if (r.kind==='native') return `Native in parts of ${place}`;
  if (r.kind==='selection') return `Selection of a species native in parts of ${place}`;
  if (r.kind==='hybrid') return r.nativeHere
    ? `Hybrid taxon recorded from ${place} (excluded by native filters)`
    : (r.nativeTo.length?`Hybrid taxon; not native to ${place}`:'Garden hybrid');
  if (r.kind==='garden') return 'Garden-origin plant';
  return `Not native to ${place}`;
}
function nativeOriginText(P){
  const r=nativeRelation(P);
  if (r.provenance==='hybrid' && !r.nativeTo.length) return 'Garden hybrid';
  if (!r.nativeTo.length) return r.provenance==='selection'?'Garden selection':'Origin not assigned';
  const names=r.nativeTo.map(id=>nativeRegionLabel(id));
  const origin=names.length>3?`${names.slice(0,3).join(', ')} +${names.length-3}`:names.join(', ');
  if (r.provenance==='selection') return `Selection of a species native in parts of ${origin}`;
  if (r.provenance==='hybrid') return `Hybrid taxon; native range includes ${origin}`;
  return `Native in parts of ${origin}`;
}
function provenanceLabel(P){
  return P&&P.provenance==='species'?'Straight species':P&&P.provenance==='selection'?'Named selection':'Hybrid';
}
/* Reviewed guidance is separate from continental nativeTo and hard eligibility.
   A missing assessment is UNKNOWN, never a clean bill of health. Area labels
   describe the source's geography, not the gardener's location. Sources are
   bundled as text/links and are never fetched automatically.
   Match the resolved taxon too: a nested choice may be a DIFFERENT species. */
const PLANT_GUIDANCE_SOURCES=Object.freeze({
  marylandGrasses:{label:'University of Maryland Extension',url:'https://www.extension.umd.edu/resource/ornamental-and-native-grasses-landscape'},
  mexicanFeather:{label:'California Invasive Plant Council',url:'https://www.cal-ipc.org/plants/profile/stipa-tenuissima-profile/'},
  cherryLaurel:{label:'King County, Washington',url:'https://kingcounty.gov/en/dept/dnrp/nature-recreation/environment-ecology-conservation/noxious-weeds/identification-control/cherry-laurel'},
  waterlily:{label:'King County, Washington',url:'https://kingcounty.gov/en/dept/dnrp/nature-recreation/environment-ecology-conservation/noxious-weeds/identification-control/fragrant-water-lily'},
  spirea:{label:'NC State Extension',url:'https://plants.ces.ncsu.edu/plants/spiraea-japonica/common-name/japanese-spirea/'},
  milkweed:{label:'EPPO',url:'https://gd.eppo.int/taxon/ASCSY/categorization'},
  fig:{label:'California Invasive Plant Council',url:'https://www.cal-ipc.org/plants/profile/ficus-carica-profile/'},
  olive:{label:'California Invasive Plant Council',url:'https://www.cal-ipc.org/plants/profile/olea-europaea-profile/'},
  blueblossom:{label:'Oregon State University',url:'https://landscapeplants.oregonstate.edu/plants/ceanothus-thyrsiflorus'},
  firebush:{label:'UF/IFAS Extension',url:'https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/firebush/'},
  beachSunflower:{label:'UF/IFAS Extension',url:'https://gardeningsolutions.ifas.ufl.edu/plants/ornamentals/beach-sunflower/'},
  rhododendron:{label:'NC State Extension',url:'https://plants.ces.ncsu.edu/plants/rhododendron-catawbiense/'},
  cenizo:{label:'NC State Extension',url:'https://plants.ces.ncsu.edu/plants/leucophyllum-frutescens/common-name/texas-barometer-bush/'},
});
const PLANT_GUIDANCE=Object.freeze({
  mexicanfeather:{taxon:'Nassella tenuissima',reviewed:'2026-09-06',invasive:[
    {area:'California',source:'mexicanFeather',text:'Cal-IPC rates this species Limited. It escapes from landscaping and spreads by seed. Avoid new planting in this region.'}]},
  miscanthus:{taxon:'Miscanthus sinensis',reviewed:'2026-09-06',invasive:[
    {area:'Maryland',source:'marylandGrasses',text:'Extension recommends avoiding this invasive grass, including commonly sold cultivars. Check current local guidance before buying.'}]},
  fountaingrass:{taxon:'Cenchrus alopecuroides',reviewed:'2026-09-06',invasive:[
    {area:'Maryland',source:'marylandGrasses',text:'Extension recommends avoiding Chinese fountain grass, including commonly sold cultivars. Also listed as Pennisetum alopecuroides or Cenchrus purpurascens.'}]},
  cherrylaurel:{taxon:'Prunus laurocerasus',reviewed:'2026-09-06',invasive:[
    {area:'King County, Washington',source:'cherryLaurel',text:'The county discourages new plantings. Bird-dispersed seeds escape into forests, where dense growth competes with native vegetation.'}]},
  fragrantwaterlily:{taxon:'Nymphaea odorata',reviewed:'2026-09-06',invasive:[
    {area:'Washington',source:'waterlily',text:'A regional noxious weed concern despite its North American origin. It forms dense aquatic mats. Consult local guidance before planting or moving it.'}]},
  japanesespirea:{taxon:'Spiraea japonica',reviewed:'2026-09-06',invasive:[
    {area:'North Carolina',source:'spirea',text:'Escapes cultivation and is classified as invasive by the NC Invasive Plant Council. Choose a locally appropriate alternative.'}]},
  commonmilkweed:{taxon:'Asclepias syriaca',reviewed:'2026-09-06',invasive:[
    {area:'European Union',source:'milkweed',text:'EPPO records this species as an invasive alien plant of EU concern. Check current national guidance before acquiring or planting it.'}]},
  fig:{taxon:'Ficus carica',reviewed:'2026-09-06',invasive:[
    {area:'California',source:'fig',text:'Cal-IPC rates this species Moderate; escaped plants can form thickets along waterways. Cultivar risk is still being studied, so named varieties are not automatically cleared.'}]},
  olive:{taxon:'Olea europaea',reviewed:'2026-09-06',invasive:[
    {area:'California',source:'olive',text:'Cal-IPC rates this species Limited and advises caution near open space. Its guidance suggests seedless varieties; verify the exact nursery selection rather than assuming an exemption.'}]},
  bluestem:{taxon:'Schizachyrium scoparium',reviewed:'2026-09-06',origin:[
    {area:'Maryland',status:'native',source:'marylandGrasses',text:'The species is recorded as native statewide; verify local habitat and stock provenance.'}]},
  bigbluestem:{taxon:'Andropogon gerardii',reviewed:'2026-09-06',origin:[
    {area:'Maryland mountains and Piedmont',status:'native',source:'marylandGrasses',text:'The source identifies these regions as its Maryland native range.'}]},
  switchgrass:{taxon:'Panicum virgatum',reviewed:'2026-09-06',origin:[
    {area:'Maryland',status:'native',source:'marylandGrasses',text:'Recorded as native statewide. A cultivar name does not identify local seed provenance.'}]},
  bluefescue:{taxon:'Festuca glauca',reviewed:'2026-09-06',site:[
    {area:'Maryland',topic:'Drainage and summer heat',source:'marylandGrasses',text:'Needs excellent drainage and performs better in cooler places. Maryland is near its southern heat limit; winter hardiness alone does not predict summer performance.'}]},
  blueblossom:{taxon:'Ceanothus thyrsiflorus',reviewed:'2026-09-06',origin:[
    {area:'California and Oregon Coast Range foothills',status:'native',source:'blueblossom',text:'The reviewed range runs from Santa Barbara County north into Oregon; it is not a statewide habitat recommendation.'}],site:[
    {area:'Western Oregon',topic:'Drainage and winter exposure',source:'blueblossom',text:'Needs good drainage. OSU reports winter losses in some years in Corvallis, so assess shelter and local cold pockets.'}]},
  firebush:{taxon:'Hamelia patens',reviewed:'2026-09-06',origin:[
    {area:'Florida',status:'native',source:'firebush',text:'The native species is distinct from nonlocal dwarf forms sold under similar names. Verify nursery identity and provenance.'}],site:[
    {area:'North versus South Florida',topic:'Freeze response',source:'firebush',text:'Can remain a large shrub in South Florida; freezes cause dieback in North Florida. Water regularly during establishment in well-drained soil.'}]},
  beachsunflower:{taxon:'Helianthus debilis',reviewed:'2026-09-06',origin:[
    {area:'Florida coasts',status:'native',source:'beachSunflower',text:'Subspecies have distinct Gulf and Atlantic ranges. Use the local ecotype; moving coast-to-coast stock can hybridize with local populations.'}],site:[
    {area:'Florida',topic:'Drainage, irrigation and coast',source:'beachSunflower',text:'Favors sandy, well-drained sunny sites; excessive irrigation can cause decline. Tolerates salt spray and soil salts. Freezing sites may grow it as an annual.'}]},
  catawbarhododendron:{taxon:'Rhododendron catawbiense',reviewed:'2026-09-06',origin:[
    {area:'Eastern US Appalachian slopes and ridges',status:'native',source:'rhododendron',text:'Its native mountain range is narrower than its North American origin label.'}],site:[
    {area:'Eastern US gardens',topic:'Soil acidity and drainage',source:'rhododendron',text:'Needs acidic, organic, moist but well-drained soil. Avoid both waterlogging and completely dry roots; a moisture label alone does not capture these needs.'}]},
  cenizo:{taxon:'Leucophyllum frutescens',reviewed:'2026-09-06',site:[
    {area:'Southwestern US and humid growing sites',topic:'Heat, humidity and drainage',source:'cenizo',text:'Tolerates heat and drought, but high humidity and hot nights can be troublesome. Avoid overwatering and poor drainage; consider raised planting areas in high rainfall.'}]},
});
const LOCAL_NATIVE_UNKNOWN='Local native status has not been assessed for your location. Continental origin is not local provenance.';
const SITE_GUIDANCE_SCOPE='Matching the plant filters is a starting point. Check drainage, soil pH, summer heat and humidity, irrigation, and exposure before buying.';
function plantGuidance(ref){
  const c=canonicalPlantRef(ref&&ref.s,ref&&ref.v), P=plantDef(c.s,c.v);
  const entry=PLANT_GUIDANCE[c.s], latin=P&&P.latin;
  const validRef=P && (!c.v || (PLANTS[c.s].cv && Object.prototype.hasOwnProperty.call(PLANTS[c.s].cv,c.v)));
  const matches=validRef && P.provenance!=='hybrid' && entry &&
    (latin===entry.taxon || (typeof latin==='string' && latin.startsWith(entry.taxon+" '")));
  const result={localStatus:'unknown',origin:[],site:[],invasive:[],selection:!!P&&P.provenance!=='species'};
  if (!matches) return result;
  for (const kind of ['origin','site','invasive']) result[kind]=(entry[kind]||[]).map(n=>Object.assign({},n,{reviewed:entry.reviewed}));
  return result;
}
function plantCautionText(ref,withSources=false){
  const notes=plantGuidance(ref).invasive;
  if (!notes.length) return '';
  return notes.map(n=>`${n.area}: ${n.text}`+(withSources?` [${n.reviewed}; ${PLANT_GUIDANCE_SOURCES[n.source].url}]`:'')).join(' ');
}
function isShrubDef(P){ return P && P.type==='shrub'; }
function isTreeDef(P){ return P && P.type==='tree'; }
function isWoodyDef(P){ return isShrubDef(P) || isTreeDef(P); }
/* Woody spread is truth data (inches); h/cw are drawing hints. Keep the
   spread->tile radius conversion here so shade, shrub footprints, plan marks,
   and cards cannot drift into slightly different ideas of plant size. */
function woodyRadiusTiles(P){
  if (!isWoodyDef(P)) return 0;
  const minRadius=isShrubDef(P) ? 0.45 : 0;
  return Math.max(minRadius, ((P.spread||P.space||TILE_IN)/TILE_IN)/2);
}
function woodyVisualCw(P){
  if (!P) return undefined;
  if (!isWoodyDef(P)) return P.cw;
  if (isTreeDef(P)){
    /* T10 compression curve: trees drew ~24x smaller than reality (white oak
       cw:160px vs 3800px of true 75ft crown) while perennials sit near 1:1.
       Blend the art cw toward true screen width in log space — small trees
       land near real size, giants compress to ~16% of real (oak ~605px) so
       one oak reads as a TREE without swallowing the plot. The species' cw
       stays the shape signal, so narrow cultivars stay narrow. */
    const cw=P.cw||100, realPx=woodyRadiusTiles(P)*2*TILE_W;
    if (realPx<=cw) return cw;
    return Math.round(Math.min(realPx, Math.exp(Math.log(cw)*0.58 + Math.log(realPx)*0.42)));
  }
  return Math.max(P.cw||0, woodyRadiusTiles(P)*TILE_W);
}
/* HERB_SCALE (H1): herbaceous plants were drawn at ~half the on-screen scale
   of shrubs — a mature drift at correct spacing showed ~65% bare ground and
   read as scattered sprigs, not a mass. Every herbaceous form derives its
   whole geometry from the drawn height H, so ONE height factor at this seam
   scales width and height together and preserves each species' hand-drawn
   proportions. Bulbs already read closed (~0.85 of spacing) so they opt out.
   Tuned by measuring drawn-width ÷ spacing across all species. */
const HERB_SCALE = 1.75;
/* plantVisualH — the universal drawn-height display transform (data P.h is
   untouched). Trees/shrubs: scale h by the same factor woodyVisualCw applied
   to cw, so the intended h:cw aspect survives (T2 widened shrub bodies toward
   true spread but left height at art px — a low yew drew six times wider than
   tall). Herbaceous (grass/sedge/forb/water): × HERB_SCALE. Bulbs: unchanged. */
function plantVisualH(P){
  if (!P) return undefined;
  if (isWoodyDef(P)) return Math.round((P.h||80) * (woodyVisualCw(P)/(P.cw||P.h||80)));
  if (P.type==='bulb') return P.h;
  return Math.round((P.h||36) * HERB_SCALE);
}
/* Some plants carry a flower scape well above the foliage mass.  Keep this
   display-only extent separate from `h`: the renderer still uses h for the
   plant's basic geometry while icons and sprite bounds reserve enough room
   for the full silhouette. */
function plantArtTop(P){
  const H=plantVisualH(P)||40, L=P&&P.look||{};
  return Math.round(H*Math.max(1,L.topScale||1));
}
/* Grass forms derive their width from H. Counter that coupling for cultivars
   so a taller selection can stay narrow and a shorter one can still be broad.
   Straight species retain their hand-tuned form silhouette. */
function plantVisualWidthScale(P,key){
  const base=key&&PLANTS[key];
  if (!P || P.type!=='grass' || !base || !P.h || !base.h || !P.spread || !base.spread) return 1;
  return (P.spread/base.spread) * (base.h/P.h);
}
// back-compat alias: this used to be woody-only; it now covers every plant.
function woodyVisualH(P){ return plantVisualH(P); }
function plantKeyOf(p){
  for (const k in game.plants) if (game.plants[k]===p) return k;
  return null;
}
