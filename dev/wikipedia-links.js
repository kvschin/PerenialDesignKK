#!/usr/bin/env node
'use strict';
/* Resolve a Wikipedia article for every species, and keep them honest.

   DEV ONLY — not loaded by index.html, not in sw.js's PRECACHE. The app makes
   zero third-party requests; the lookup happens HERE, once, and the result is
   written into js/plants.js as data.

     node dev/wikipedia-links.js              report what it would resolve
     node dev/wikipedia-links.js --write      write WIKIPEDIA_ARTICLES into plants.js
     node dev/wikipedia-links.js --verify     re-check every article we ship

   Why a resolver rather than string-building a URL from `latin`: an
   en.wikipedia.org/wiki/<Latin name> URL is trivial to construct and wrong
   often enough to matter. Of this catalog's 473 species, ~50 carry a cultivar
   epithet, a nothospecies ×, a Group name or a subsp./var. that no article is
   titled after; several are filed under a synonym; and a bare genus like
   "Sedum" can land on a disambiguation page. A dead or wrong "Learn more" link
   is worse than none, so nothing is written that the API has not confirmed
   resolves to a real, non-disambiguation article whose text actually mentions
   the genus.

   The fallback ladder is deliberate and its RANK is reported, because the
   answers are not equally good:
     species  the article is about this taxon                     — ideal
     binomial the cultivar/subspecies resolved to its species     — ideal
     synonym  filed under an accepted name we list as a synonym   — good
     genus    no article for the species; the genus article is    — acceptable
              still a real article about this plant
   Anything below that is left unlinked. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'PocketPrairieGardenDesign/dev (https://github.com/kvschin/PerenialDesignKK) node-fetch';
/* 20, not 50: `titles` accepts 50 but prop=extracts caps exlimit at 20 for
   anonymous clients, and it does not error — it just returns the first 20 with
   text and the rest without. Batching higher silently strips the extract from
   half of every batch, which fails the genus check and quietly demotes real
   species articles to a genus fallback. */
const BATCH = 20;

function loadPlants(){
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/plants.js'), 'utf8') +
    ';globalThis.__p={PLANTS,PLANT_KEYS};', ctx, {filename: 'plants.js'});
  return ctx.__p;
}

/* ---------- candidate titles ---------- */

/* Strip everything that is a horticultural label rather than part of the
   taxon name: 'Cultivar' in single quotes, a (Something Group), a trailing
   "/ hybrids", and the abbreviations for infraspecific rank. */
function cleanLatin(s){
  return String(s || '')
    .replace(/^[x×]\s+/i, ' ')         // x Hesperotropsis leylandii (nothogenus)
    .replace(/'[^']*'/g, ' ')          // 'Karl Foerster'
    .replace(/\([^)]*\)/g, ' ')        // (Herbstfreude Group)
    .replace(/\s*\/.*$/, ' ')          // Buxus sempervirens / hybrids
    .replace(/\s+/g, ' ')
    .trim();
}
const isEpithet = w => /^[a-z][a-z-]+$/.test(w);
const isHybridMark = w => w === '×' || w === 'x' || w === 'X';

/* Ordered, de-duplicated candidates for one species. */
function candidates(P){
  const out = [];
  const push = (title, rank) => {
    const t = String(title || '').replace(/\s+/g, ' ').trim();
    if (t && t.split(' ').length && !out.some(c => c.title.toLowerCase() === t.toLowerCase())){
      out.push({title: t, rank});
    }
  };

  const full = cleanLatin(P.latin);
  const words = full.split(' ').filter(Boolean);
  const genus = words[0] || '';

  push(full, words.length > 1 ? 'species' : 'genus');

  /* Drop subsp./var./f. and everything after it. */
  const rankAt = words.findIndex(w => /^(subsp\.|ssp\.|var\.|f\.|forma)$/i.test(w));
  if (rankAt > 1) push(words.slice(0, rankAt).join(' '), 'binomial');

  /* Genus + first epithet, keeping a nothospecies marker if there is one. */
  if (words.length > 1){
    if (isHybridMark(words[1]) && words[2]) push(`${genus} × ${words[2]}`, 'binomial');
    else if (isEpithet(words[1])) push(`${genus} ${words[1]}`, 'binomial');
  }

  for (const syn of (P.synonyms || [])){
    const s = cleanLatin(syn);
    push(s, 'synonym');
    const sw = s.split(' ').filter(Boolean);
    if (sw.length > 2 && isEpithet(sw[1])) push(`${sw[0]} ${sw[1]}`, 'synonym');
  }

  if (genus){
    push(genus, 'genus');
    push(`${genus} (plant)`, 'genus');
    push(`${genus} (genus)`, 'genus');
  }
  return out;
}

/* ---------- the API ---------- */

/* Returns Map<requestedTitle, page|null>. The API reports title normalisation
   and redirect resolution as separate arrays, so the requested string has to be
   walked through both before it can be matched to a page. */
async function resolveTitles(titles){
  const out = new Map();
  for (let i = 0; i < titles.length; i += BATCH){
    const slice = titles.slice(i, i + BATCH);
    const url = `${API}?action=query&format=json&formatversion=2&redirects=1` +
      `&prop=pageprops%7Cextracts&exintro=1&explaintext=1&exsentences=2&exlimit=max` +
      `&titles=${encodeURIComponent(slice.join('|'))}`;
    const res = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}});
    if (!res.ok) throw new Error(`Wikipedia API returned ${res.status}`);
    const q = (await res.json()).query || {};

    const step = new Map();
    for (const n of (q.normalized || [])) step.set(n.from, n.to);
    for (const r of (q.redirects || [])) step.set(r.from, r.to);
    const pages = new Map((q.pages || []).map(p => [p.title, p]));

    for (const want of slice){
      let t = want, hops = 0;
      while (step.has(t) && hops++ < 6) t = step.get(t);
      out.set(want, pages.get(t) || null);
    }
    await new Promise(r => setTimeout(r, 120));   // be a polite API client
  }
  return out;
}

/* A page is only acceptable if it exists, is not a disambiguation page, and
   its opening sentence actually mentions the genus. That last check is what
   catches a redirect landing somewhere unrelated — the failure mode a
   hand-built URL cannot detect at all. */
function pageOk(page, genus, epithet){
  if (!page || page.missing) return false;
  if (page.pageprops && 'disambiguation' in page.pageprops) return false;
  if (String(page.title).trim().length < 3) return false;   // "X" is not a plant
  const hay = `${page.title} ${page.extract || ''}`.toLowerCase();
  if (genus && hay.includes(String(genus).toLowerCase())) return true;
  /* A reclassified taxon keeps its epithet and changes genus, so the epithet is
     the surviving evidence: Calylophus berlandieri is filed under Oenothera,
     and x Hesperotropsis leylandii under "Leyland cypress". Six characters is
     long enough that a match is not a coincidence. */
  return !!(epithet && epithet.length >= 6 && hay.includes(epithet.toLowerCase()));
}

/* Last resort, for a genus whose own name is a disambiguation page — Rosa is a
   given name, Veronica is a given name — so the plant article is titled
   something else entirely ("Rose", "Veronica (plant)"). Search for the genus and
   accept a result only if it reads like a genus article: it has to mention BOTH
   the word "genus" and the genus name. That pair is what separates "Rose" from
   "Rosa Parks", which of course also contains "Rosa". */
async function searchGenus(genus){
  const url = `${API}?action=query&format=json&formatversion=2&list=search` +
    `&srlimit=5&srsearch=${encodeURIComponent(genus + ' plant genus')}`;
  const res = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}});
  if (!res.ok) return null;
  const hits = ((await res.json()).query || {}).search || [];
  if (!hits.length) return null;
  const pages = await resolveTitles(hits.map(h => h.title));
  for (const h of hits){
    const p = pages.get(h.title);
    if (!p || p.missing) continue;
    if (p.pageprops && 'disambiguation' in p.pageprops) continue;
    const hay = `${p.title} ${p.extract || ''}`.toLowerCase();
    if (hay.includes('genus') && hay.includes(genus.toLowerCase())) return p.title;
  }
  return null;
}

/* ---------- resolve every species ---------- */

async function resolveAll(PLANTS, keys){
  const plan = keys.map(k => ({key: k, P: PLANTS[k], cands: candidates(PLANTS[k])}));
  const every = [...new Set(plan.flatMap(p => p.cands.map(c => c.title)))];
  process.stderr.write(`  querying ${every.length} candidate titles for ${plan.length} species...\n`);
  const pages = await resolveTitles(every);

  const resolved = [], unresolved = [];
  for (const {key, P, cands} of plan){
    const words = cleanLatin(P.latin).split(' ').filter(Boolean);
    const genus = words[0] || '';
    const epithet = (words.find((w, i) => i > 0 && isEpithet(w))) || '';
    let hit = null;
    for (const c of cands){
      const page = pages.get(c.title);
      if (pageOk(page, genus, epithet)){ hit = {article: page.title, rank: c.rank, tried: c.title}; break; }
    }
    if (!hit && genus){
      const found = await searchGenus(genus);
      if (found) hit = {article: found, rank: 'search', tried: genus};
    }
    if (hit) resolved.push({key, name: P.name, latin: P.latin, ...hit});
    else unresolved.push({key, name: P.name, latin: P.latin, tried: cands.map(c => c.title)});
  }
  return {resolved, unresolved};
}

/* ---------- writing the table ---------- */

/* One keyed table rather than 473 inline fields: it is reviewable in a single
   diff, regenerable, and cannot drift entry by entry. It follows BLOOM_MONTHS,
   which established the pattern — and inherits its footgun, so the note above
   the table says so: a key present here WINS over an inline externalLinks. */
function renderTable(resolved){
  const width = resolved.reduce((m, r) => Math.max(m, r.key.length), 0);
  const lines = resolved.map(r =>
    `  ${(r.key + ':').padEnd(width + 1)} ${JSON.stringify(r.article)},`);
  return `
/* ---------- Wikipedia references ----------
   Article TITLE per species, resolved and verified against the Wikipedia API by
   dev/wikipedia-links.js — never hand-built from \`latin\`, because a cultivar
   epithet, a nothospecies ×, a Group name or a subsp./var. usually has no
   article of its own, several taxa here are filed under a synonym, and a bare
   genus can land on a disambiguation page. Every title below resolved to a real,
   non-disambiguation article whose opening sentence names the genus. Re-check
   them with \`node dev/wikipedia-links.js --verify\` before a release.

   The title is stored rather than a URL so the list stays readable and the URL
   is built in exactly one place. Like BLOOM_MONTHS below, this table is copied
   over PLANTS at load, so a key present here OVERRIDES an inline externalLinks
   — put the article here, not on the entry.

   A species with no acceptable article is simply absent, and the Library
   renders no "Learn more" row for it. That is the intended state, not a gap to
   be filled with a plausible guess. */
const WIKIPEDIA_ARTICLES = {
${lines.join('\n')}
};
for (const k in WIKIPEDIA_ARTICLES){
  if (!PLANTS[k]) continue;
  const links = PLANTS[k].externalLinks || (PLANTS[k].externalLinks = {});
  links.wikipedia = 'https://en.wikipedia.org/wiki/' +
    encodeURIComponent(WIKIPEDIA_ARTICLES[k].replace(/ /g, '_'));
}
`;
}

function writeTable(resolved){
  const f = path.join(ROOT, 'js/plants.js');
  const raw = fs.readFileSync(f, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = raw.split('\r\n').join('\n');

  /* The inline externalLinks that predated this table has to go, or there are
     two sources of truth for the same fact and the table silently wins. */
  s = s.replace(/^\s*externalLinks:\{wikipedia:'[^']*'\},\n/gm, '');

  const marker = 'const WIKIPEDIA_ARTICLES = {';
  if (s.includes(marker)){
    const start = s.indexOf('\n/* ---------- Wikipedia references ----------');
    const endTok = "    encodeURIComponent(WIKIPEDIA_ARTICLES[k].replace(/ /g, '_'));\n}\n";
    const end = s.indexOf(endTok);
    if (start < 0 || end < 0) throw new Error('existing table found but its bounds did not parse');
    s = s.slice(0, start) + s.slice(end + endTok.length);
  }

  /* Before the PLANT_KEYS export, so the table has run by the time anything
     reads PLANTS. */
  const tail = 'const PLANT_KEYS = Object.keys(PLANTS);';
  if (!s.includes(tail)) throw new Error('PLANT_KEYS tail not found');
  s = s.replace(tail, renderTable(resolved).trimStart() + '\n' + tail);

  fs.writeFileSync(f, crlf ? s.split('\n').join('\r\n') : s);
}

/* ---------- verify ---------- */

async function verify(){
  const {PLANTS, PLANT_KEYS} = loadPlants();
  const have = PLANT_KEYS
    .filter(k => PLANTS[k].externalLinks && PLANTS[k].externalLinks.wikipedia)
    .map(k => ({
      key: k, P: PLANTS[k],
      title: decodeURIComponent(PLANTS[k].externalLinks.wikipedia.split('/wiki/')[1] || '').replace(/_/g, ' '),
    }));
  if (!have.length){ console.log('\n  No Wikipedia references are declared.\n'); return; }

  console.log(`\n  Re-checking ${have.length} articles\n`);
  const pages = await resolveTitles([...new Set(have.map(h => h.title))]);
  let bad = 0;
  for (const h of have){
    const genus = (cleanLatin(h.P.latin).split(' ')[0]) || '';
    const page = pages.get(h.title);
    if (!pageOk(page, genus)){
      bad++;
      const why = !page || page.missing ? 'no longer exists'
        : (page.pageprops && 'disambiguation' in page.pageprops) ? 'is now a disambiguation page'
        : `no longer mentions ${genus}`;
      console.log(`  x ${h.key} - "${h.title}" ${why}`);
    } else if (page.title !== h.title){
      console.log(`  > ${h.key} - "${h.title}" now redirects to "${page.title}"`);
    }
  }
  console.log(bad ? `\n  ${bad} need attention.\n` : `\n  All ${have.length} articles resolve.\n`);
  if (bad) process.exitCode = 1;
}

/* ---------- main ---------- */

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--verify') return void (await verify());

    const {PLANTS, PLANT_KEYS} = loadPlants();
    const {resolved, unresolved} = await resolveAll(PLANTS, PLANT_KEYS);

    const byRank = {};
    for (const r of resolved) byRank[r.rank] = (byRank[r.rank] || 0) + 1;
    console.log(`\n  ${resolved.length}/${PLANT_KEYS.length} species resolved`);
    for (const rank of ['species', 'binomial', 'synonym', 'genus', 'search']){
      if (byRank[rank]) console.log(`    ${String(byRank[rank]).padStart(4)}  ${rank}`);
    }

    const generic = resolved.filter(r => r.rank === 'genus' || r.rank === 'search');
    if (generic.length){
      console.log(`\n  Genus-level (no article for the taxon itself):`);
      for (const r of generic) console.log(`    ${r.key} - ${r.latin} -> ${r.article}`);
    }
    if (unresolved.length){
      console.log(`\n  ${unresolved.length} left unlinked:`);
      for (const u of unresolved) console.log(`    ${u.key} - ${u.latin}  (tried: ${u.tried.join(', ')})`);
    }

    if (args.includes('--write')){
      writeTable(resolved);
      console.log(`\n  Wrote WIKIPEDIA_ARTICLES into js/plants.js.\n`);
    } else {
      console.log(`\n  Dry run. Re-run with --write to apply.\n`);
    }
  } catch (e){
    console.error(`\n  ${e.message}\n`);
    process.exitCode = 1;
  }
})();
