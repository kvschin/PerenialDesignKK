#!/usr/bin/env node
'use strict';
/* Review the whole catalog against a published invasive list, in one pass.

   DEV ONLY. Nothing here ships: it is not loaded by index.html and it is not in
   sw.js's PRECACHE. Like dev/commons-photo.js and dev/wikipedia-links.js it is
   allowed to touch the network, because the app itself makes zero third-party
   requests and that is a privacy-policy claim rather than a preference — so the
   data is fetched HERE, once, by a person, and written into js/core.js as data.

     node dev/invasive-check.js --list
         What sources are configured, and whether each has a local snapshot.

     node dev/invasive-check.js --source easin
         Fetch one list, intersect it with the catalog, and print a draft
         PLANT_GUIDANCE block for anything matched that is not already
         recorded. --cached reads the snapshot instead of the network.

     node dev/invasive-check.js --verify
         Re-check every invasive note the app ships: schema, live source links,
         severity against the source's own rating, and — the part worth having
         — whether any catalog plant is on a list today that was not when we
         last looked.

   WHY THIS SHAPE. Reviewing plant-first is 596 decisions and every one drags in
   "invasive where, and does that state count?". That is what stalled this
   catalog's review at eleven records. Source-first is one list intersected with
   the catalog: the whole catalog is reviewed in a single pass and only the
   intersection needs a human. The other 584 were reviewed too — they just came
   back empty, which is a result rather than a gap.

   WHAT IT CANNOT DO, and must never be trusted to. It cannot decide that a
   plant listed in one county belongs out of a continental filter; it cannot
   judge a cultivar exemption (seedless olive, sterile Miscanthus selections are
   exactly where a name match gets it wrong); and it cannot write the note. It
   drafts, and a person reads the source page and writes the prose. That rule is
   why the eleven existing records are trustworthy and it is not relaxed here.

   It also WRITES NOTHING to js/. Drafts print; you paste. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAP_DIR = path.join(__dirname, 'invasive-lists');
const UA = 'PocketPrairieGardenDesign/dev (https://github.com/kvschin/PerenialDesignKK)';

/* ---------- sources ----------
   A source speaks for ONE served region, and that is the field the filter
   needs (`note.region`). It is a property of the LIST, not of the plant, which
   is the other reason source-first is the right shape: the region falls out of
   the fetch instead of being decided per record.

   `severity` maps the source's own rating onto the app's two levels. Where a
   source has no rating the mapping must justify itself in a comment, not guess. */
const SOURCES = {
  easin: {
    label: 'EU List of Invasive Alien Species of Union Concern (EASIN / JRC)',
    region: 'europe',
    url: 'https://easin.jrc.ec.europa.eu/apixg/catxg/euconcern',
    cite: 'https://easin.jrc.ec.europa.eu/easin/documentation/Factsheet',
    async fetchList(){
      const rows = await getJson(this.url);
      return rows.filter(r => (r.Kingdom || '') === 'Plantae').map(r => ({
        name: r.Name,
        // EASIN publishes synonyms, which is most of what makes a name match work
        synonyms: (r.Synonyms || []).map(s => s && (s.Synonym || s.Name)).filter(Boolean),
        rating: 'Union concern',
        /* Everything on this list is legally actionable EU-wide under
           Regulation 1143/2014 — there is no lower tier to map onto. */
        severity: 'avoid',
        notes: [r.IsPartNative ? 'part-native to the EU' : null,
                r.NativeRange ? 'native range: ' + r.NativeRange : null].filter(Boolean),
      }));
    },
  },
  calipc: {
    label: 'California Invasive Plant Inventory (Cal-IPC)',
    region: 'north-america',
    url: 'https://www.cal-ipc.org/plants/inventory/',
    cite: 'https://www.cal-ipc.org/plants/inventory/',
    async fetchList(){
      const html = await getText(this.url);
      const table = (html.match(/<table[\s\S]*?<\/table>/i) || [])[0] || '';
      const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      const out = [];
      for (const tr of rows){
        const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(stripTags);
        if (cells.length < 3) continue;
        const name = cells[0], rating = cells[2];
        if (!name || !/^[A-Z][a-z]/.test(name)) continue;          // skips the header row
        if (!/^(High|Moderate|Limited|Watch)/i.test(rating)) continue;
        out.push({
          name, synonyms: [], rating,
          /* Cal-IPC's own tiers: High and Moderate are documented ecological
             impact, Limited is "minor or not well documented", Watch is
             potential rather than observed. Mapping Limited onto `avoid` would
             put a watch-list plant in the same bucket as one that smothers
             woodland, which is precisely the distinction `severity` exists for. */
          severity: /^(High|Moderate)/i.test(rating) ? 'avoid' : 'caution',
          /* The Hort column marks plants still in the nursery trade. For a
             GARDEN planner that is the relevance filter: a rangeland weed
             nobody sells is not a planting decision anyone here will make. */
          notes: /&#x2714;|✔/.test((tr.match(/<td[\s\S]*?<\/td>/gi) || [])[5] || '') ? ['in the horticultural trade'] : [],
        });
      }
      return out;
    },
  },
};

/* ---------- network ---------- */
async function getText(url){
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}
async function getJson(url){ return JSON.parse(await getText(url)); }
async function linkAlive(url){
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
    // some hosts refuse HEAD but serve GET; a 405 is not a dead link
    if (res.status === 405 || res.status === 403)
      res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    return res.status;
  } catch (e){ return 0; }
}

/* ---------- snapshots ----------
   A run should be reproducible and --verify should work with the network down,
   so a fetch is cached beside the tool with its retrieval date and count — the
   shape data/zip-zones-2023.json already uses for the zone listing. */
function snapPath(id){ return path.join(SNAP_DIR, id + '.json'); }
function readSnap(id){
  const p = snapPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeSnap(id, entries){
  if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
  const src = SOURCES[id];
  const blob = { source: id, label: src.label, region: src.region, url: src.url,
                 retrieved: new Date().toISOString().slice(0, 10), count: entries.length, entries };
  fs.writeFileSync(snapPath(id), JSON.stringify(blob, null, 1) + '\n');
  return blob;
}
async function listFor(id, cached){
  if (cached){
    const s = readSnap(id);
    if (!s) throw new Error(`no snapshot for ${id}; run without --cached once`);
    return s;
  }
  return writeSnap(id, await SOURCES[id].fetchList());
}

/* ---------- the app's own data ----------
   Loaded through the real modules rather than restated. A second copy of the
   catalog or of PLANT_GUIDANCE that disagreed with the shipped one would be
   worse than no tool: the whole point is to compare what we SHIP against the
   world. core.js touches `document` at load, so this goes through
   tests/sandbox.js — already shared with dev/make-demo-garden.js for the same
   reason. */
function loadApp(){
  const { gameSources, runTier } = require(path.join(ROOT, 'tests', 'sandbox.js'));
  let app = null;
  const probe = `
    __out({
      plants: PLANT_KEYS.map(s => ({
        key: s, latin: PLANTS[s].latin || '', synonyms: PLANTS[s].synonyms || [],
        nativeTo: PLANTS[s].nativeTo || [], hidden: !!PLANTS[s].hidden,
        cv: Object.keys(PLANTS[s].cv || {}).map(v => ({ v, latin: (plantDef(s, v) || {}).latin || '' })),
      })),
      guidance: Object.keys(PLANT_GUIDANCE).map(k => ({
        key: k, taxon: PLANT_GUIDANCE[k].taxon, reviewed: PLANT_GUIDANCE[k].reviewed,
        invasive: (PLANT_GUIDANCE[k].invasive || []).map(n => ({ area: n.area, region: n.region, severity: n.severity, source: n.source })),
      })),
      sources: PLANT_GUIDANCE_SOURCES,
      severities: INVASIVE_SEVERITIES,
      regions: ['north-america', 'europe'],
    });
  `;
  const r = runTier('invasive-check', gameSources().concat([probe]), true, { __out: v => { app = v; } });
  if (!r.ok) throw new Error('could not load the app modules:\n' + r.err);
  return app;
}

/* ---------- names ----------
   Everything is compared as a BINOMIAL. The catalog holds
   `Molinia caerulea subsp. caerulea 'Moorhexe'` and a list holds
   `Pueraria montana (Lour.) Merr. var. lobata`; neither matches anything until
   both are cut back to genus + species. */
function stripTags(s){
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
          .replace(/&#x?[0-9a-f]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function binomial(s){
  const parts = String(s || '').replace(/[×x]\s+/g, ' ').replace(/[^A-Za-z .'-]/g, ' ')
    .trim().split(/\s+/).filter(w => !/^\(/.test(w));
  if (parts.length < 2) return '';
  const [g, e] = parts;
  if (!/^[A-Z][a-z-]+$/.test(g) || !/^[a-z-]+$/.test(e)) return '';
  return (g + ' ' + e).toLowerCase();
}
function buildIndex(plants){
  const byName = new Map(), byEpithet = new Map();
  const add = (map, k, key) => { if (!k) return; if (!map.has(k)) map.set(k, new Set()); map.get(k).add(key); };
  for (const P of plants){
    for (const n of [P.latin, ...(P.synonyms || []), ...P.cv.map(c => c.latin)]){
      const b = binomial(n);
      add(byName, b, P.key);
      if (b) add(byEpithet, b.split(' ')[1], P.key);
    }
  }
  return { byName, byEpithet };
}

/* ---------- intersect ----------
   Three buckets, not two, and the split is what measurement forced. A first cut
   reported "same genus OR same epithet" as one near-miss list and it was mostly
   noise: Nanozostera japonica matched five unrelated japonicas. Same GENUS is
   the useful signal (Cenchrus setaceus beside the catalog's two Cenchrus), and
   same EPITHET is how a genus transfer shows up (Pennisetum alopecuroides ->
   Cenchrus alopecuroides, which the catalog records only in prose) — but it is
   low confidence and belongs in its own bucket so a reviewer's eye goes to the
   right place. A no-match is NEVER silent: a silent miss is how you come to
   believe in coverage you do not have. */
function intersect(entries, index, plants){
  const matched = [], sameGenus = [], sameEpithet = [], clear = [];
  const byKey = new Map(plants.map(P => [P.key, P]));
  for (const e of entries){
    const names = [e.name, ...(e.synonyms || [])];
    const hits = new Set();
    for (const n of names) for (const k of (index.byName.get(binomial(n)) || [])) hits.add(k);
    if (hits.size){
      matched.push({ entry: e, keys: [...hits],
        viaSynonym: !(index.byName.get(binomial(e.name)) || new Set()).size,
        plants: [...hits].map(k => byKey.get(k)) });
      continue;
    }
    const b = binomial(e.name); if (!b){ clear.push(e); continue; }
    const [g, ep] = b.split(' ');
    const genusHits = plants.filter(P => binomial(P.latin).split(' ')[0] === g).map(P => P.latin);
    const epithetHits = [...(index.byEpithet.get(ep) || [])].map(k => byKey.get(k).latin);
    if (genusHits.length){ sameGenus.push({ entry: e, candidates: genusHits }); continue; }
    if (!epithetHits.length){ clear.push(e); continue; }
    /* An epithet carried by several different genera is a descriptive word, not
       a transfer: japonica, americana, glauca and vulgare between them produced
       most of a 50-line bucket nobody would read to the end, and a report that
       long is a report that gets skipped. Suppressed entries are COUNTED, never
       dropped in silence. */
    const genera = new Set(epithetHits.map(n => binomial(n).split(' ')[0]));
    if (genera.size > 3) sameEpithet.push({ entry: e, candidates: epithetHits, common: true });
    else sameEpithet.push({ entry: e, candidates: epithetHits });
  }
  return { matched, sameGenus, sameEpithet, clear };
}
/* A candidate list of thirty Carex is not information. */
function cap(list, n = 4){
  return list.length <= n ? list.join(', ') : list.slice(0, n).join(', ') + ` (+${list.length - n} more)`;
}

/* ---------- drafting ---------- */
function noteFor(app, key, region){
  const g = app.guidance.find(x => x.key === key);
  return g ? g.invasive.filter(n => n.region === region) : [];
}
function draftBlock(id, m, region){
  const src = SOURCES[id], e = m.entry;
  const area = src.region === 'europe' ? 'European Union' : 'California';
  return m.keys.map(k => `  ${k}:{taxon:'${e.name}',reviewed:'${new Date().toISOString().slice(0,10)}',invasive:[
    {area:'${area}',region:'${src.region}',severity:'${e.severity}',source:'TODO',text:'TODO — read ${src.cite} and write this.'}]},`).join('\n');
}

async function runSource(id, opts){
  const src = SOURCES[id];
  if (!src) throw new Error(`unknown source "${id}"; try --list`);
  const app = loadApp();
  const snap = await listFor(id, opts.cached);
  const index = buildIndex(app.plants);
  const res = intersect(snap.entries, index, app.plants);

  console.log(`\n${src.label}`);
  console.log(`  region ${src.region} · ${snap.entries.length} plants · retrieved ${snap.retrieved}${opts.cached ? ' (snapshot)' : ''}`);
  console.log(`  catalog: ${app.plants.length} species, ${index.byName.size} distinct binomials indexed\n`);

  const fresh = [], already = [];
  for (const m of res.matched){
    const recorded = m.keys.every(k => noteFor(app, k, src.region).length);
    (recorded ? already : fresh).push(m);
  }

  console.log(`MATCHED ${res.matched.length}  (${already.length} already recorded, ${fresh.length} new)`);
  for (const m of res.matched){
    const rec = m.keys.map(k => noteFor(app, k, src.region)).flat();
    const flags = [m.viaSynonym ? 'via synonym' : null, ...(m.entry.notes || [])].filter(Boolean);
    console.log(`  ${m.entry.name}  ->  ${m.keys.join(', ')}  [${m.entry.rating} -> ${m.entry.severity}]${flags.length ? '  (' + flags.join('; ') + ')' : ''}`);
    if (rec.length){
      const disagree = rec.filter(n => n.severity !== m.entry.severity);
      console.log(`      recorded: ${rec.map(n => n.severity + ' in ' + n.area).join(', ')}`
        + (disagree.length ? `   <-- SEVERITY DISAGREES with the source` : ''));
    }
  }

  if (fresh.length){
    console.log(`\nDRAFT — paste into PLANT_GUIDANCE in js/core.js, then read the source and write the text:\n`);
    for (const m of fresh) console.log(draftBlock(id, m, src.region));
    console.log(`\n  Every 'TODO' is deliberate. A note nobody read is a citation nobody can defend.`);
  }

  console.log(`\nCHECK ${res.sameGenus.length} — the list names a genus the catalog has, under another species:`);
  for (const m of res.sameGenus) console.log(`  ${m.entry.name}  vs  ${cap(m.candidates)}`);
  /* Same-epithet is how a GENUS TRANSFER shows up (Pennisetum alopecuroides ->
     Cenchrus alopecuroides), which is the one name failure this catalog is
     really exposed to — only 53 of 596 records carry a `synonyms` array. But
     measured against a real list it is overwhelmingly coincidence: 46 of 46 on
     Cal-IPC, Ononis beside Cenchrus and Tamarix beside Astilbe. Printing all of
     it buries MATCHED and CHECK, and a report nobody reads to the end is worse
     than a shorter one. So it is COUNTED by default and printed under --all —
     visible, never silent, and out of the way of the signal. */
  console.log(`\nPOSSIBLE ${res.sameEpithet.length} — share an epithet with a catalog plant, which is how a genus transfer looks.`);
  console.log(`  Nearly always coincidence; the real transfers are caught by the source's own synonyms.`);
  if (opts.all) for (const m of res.sameEpithet) console.log(`  ${m.entry.name}  vs  ${cap(m.candidates)}`);
  else console.log(`  Pass --all to review them.`);
  console.log(`\nNOT IN THE CATALOG ${res.clear.length} — reviewed and clear.`);
  return res;
}

/* ---------- verify ---------- */
async function verify(opts){
  const app = loadApp();
  let problems = 0;
  const fail = m => { problems++; console.log('  FAIL  ' + m); };

  console.log('\nschema');
  const used = new Set();
  for (const g of app.guidance) for (const n of g.invasive){
    const where = `${g.key} (${n.area})`;
    if (!app.regions.includes(n.region)) fail(`${where}: region "${n.region}" is not a served region`);
    if (!app.severities.includes(n.severity)) fail(`${where}: severity "${n.severity}" is not one of ${app.severities.join('/')}`);
    if (!app.sources[n.source]) fail(`${where}: source key "${n.source}" is not in PLANT_GUIDANCE_SOURCES`);
    else used.add(n.source);
  }
  console.log(`  ${app.guidance.reduce((n, g) => n + g.invasive.length, 0)} invasive notes, ${used.size} distinct sources`);

  if (!opts.offline){
    console.log('\nsource links');
    for (const key of [...used].sort()){
      const url = app.sources[key].url, status = await linkAlive(url);
      if (status >= 200 && status < 400) console.log(`  ok    ${key}  ${status}`);
      else fail(`${key}: ${url} -> ${status || 'unreachable'}`);
    }
  }

  console.log('\ncoverage drift');
  for (const id of Object.keys(SOURCES)){
    const src = SOURCES[id];
    let snap;
    try { snap = await listFor(id, opts.offline || opts.cached); }
    catch (e){ console.log(`  skip  ${id}: ${e.message}`); continue; }
    const res = intersect(snap.entries, buildIndex(app.plants), app.plants);
    const missing = [], drift = [];
    for (const m of res.matched) for (const k of m.keys){
      const rec = noteFor(app, k, src.region);
      if (!rec.length) missing.push(`${k} (${m.entry.name}, ${m.entry.rating})`);
      else if (!rec.some(n => n.severity === m.entry.severity))
        drift.push(`${k}: we say ${rec.map(n => n.severity).join('/')}, ${id} rates it ${m.entry.rating} -> ${m.entry.severity}`);
    }
    console.log(`  ${id}: ${snap.entries.length} listed, ${res.matched.length} in the catalog, ${missing.length} unrecorded`);
    /* This is the question the tool exists to answer, and the one nobody could
       answer before: has a plant we ship appeared on a list since we looked? */
    for (const m of missing) fail(`${id}: ${m} is listed and has no recorded caution`);
    for (const d of drift) console.log(`  note  ${d}`);
  }

  console.log(problems ? `\n${problems} problem${problems === 1 ? '' : 's'}.\n` : '\nall clear.\n');
  process.exitCode = problems ? 1 : 0;
}

/* ---------- main ---------- */
function listSources(){
  console.log('\nconfigured sources:\n');
  for (const [id, s] of Object.entries(SOURCES)){
    const snap = readSnap(id);
    console.log(`  ${id.padEnd(8)} ${s.region.padEnd(14)} ${s.label}`);
    console.log(`  ${''.padEnd(8)} ${snap ? `snapshot ${snap.retrieved}, ${snap.count} plants` : 'no snapshot yet'}`);
  }
  /* Recorded so the next person does not spend an afternoon rediscovering it:
     USDA PLANTS is the obvious North American aggregator and its
     Invasive/Noxious dataset was NOT migrated to the 2021 rebuild — the site
     says a replacement will be deployed in a later release. The Invasive Plant
     Atlas (Bugwood) refuses automated requests. Cal-IPC is therefore the one
     working North American source here, and it speaks only for California, so
     North American coverage is a real gap rather than a finished job. */
  console.log(`\n  Not configured, and why:`);
  console.log(`    usda      north-america  Invasive/Noxious dataset was not migrated to the 2021 PLANTS rebuild`);
  console.log(`    ipatlas   north-america  invasiveplantatlas.org refuses automated requests (HTTP 403)`);
  console.log(`    gbnnss    europe         not yet checked for a machine-readable form\n`);
}

async function main(){
  const args = process.argv.slice(2);
  const opts = { cached: args.includes('--cached'), offline: args.includes('--offline'), all: args.includes('--all') };
  const si = args.indexOf('--source');
  try {
    if (args.includes('--list') || !args.length) return listSources();
    if (args.includes('--verify')) return await verify(opts);
    if (si >= 0 && args[si + 1]) return void await runSource(args[si + 1], opts);
    listSources();
  } catch (e){
    console.error('\n' + (e && e.message || e) + '\n');
    process.exitCode = 1;
  }
}
main();
