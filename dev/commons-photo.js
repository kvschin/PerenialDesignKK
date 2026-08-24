#!/usr/bin/env node
'use strict';
/* Draft and re-verify plant photo records against Wikimedia Commons.

   DEV ONLY. Nothing here ships: it is not loaded by index.html, it is not in
   sw.js's PRECACHE, and it is the only part of this project that touches the
   network at all. The app itself makes zero third-party requests, which is a
   privacy-policy claim rather than a preference — so metadata is fetched HERE,
   once, by a person, and written into js/plants.js as data.

     node dev/commons-photo.js <plantKey> "File:Something.jpg"
         Fetch a file's licensing metadata and print a record to paste into
         js/plants.js, plus the URL to download. Refuses outright if the
         licence is not on the allowlist in js/photos.js.

     node dev/commons-photo.js --verify
         Re-query every photograph the app currently declares and diff the live
         answer against the stored record. Run before every release. This is
         the only defence against a file being deleted from Commons, or its
         licensing being corrected, after we shipped it — and because the app
         is redistributed offline, a file we shipped keeps existing on people's
         devices whatever Commons later decides.

   What this tool CANNOT do, and must never be trusted to: confirm the licence
   is TRUE. The API repeats whatever the uploader typed. Only a person reading
   the file page can tell whether the uploader is really the author, whether an
   extra condition was bolted on in prose, or whether there is an identifiable
   face in the frame. docs/plant-photos.md is that checklist and it is not
   optional. This tool exists to stop transcription errors and to make the
   allowlist unbypassable — not to replace the reading. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PocketPrairieGardenDesign/dev (https://github.com/kvschin/PerenialDesignKK) node-fetch';

/* Load the app's own licence table and validator rather than restating them.
   A second copy of the allowlist that disagreed with the shipped one would be
   worse than no tool at all. Both files are free of DOM access at load, which
   is what makes this possible. */
function loadAppModules(){
  const ctx = { console, location: { search: '' } };
  vm.createContext(ctx);
  /* Concatenate rather than run each file separately, exactly as
     tests/sandbox.js does and for the same reason: these modules share one
     scope through top-level `const`, which is a LEXICAL binding and never
     becomes a property of the global object. Run separately, plants.js's
     PLANTS would be invisible to photos.js and to us. The epilogue assigns
     onto globalThis so the names do land on the context — a bare assignment
     would throw, since the concatenated script inherits plants.js strict mode. */
  const src = ['js/plants.js', 'js/photos.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n;\n');
  vm.runInContext(src + `
    ;globalThis.__app = { PLANTS, PLANT_KEYS, PHOTO_LICENSES, PHOTO_LICENSES_REFUSED,
               photoRecordProblems, photoCreditParts, photoCreditLine };
  `, ctx, { filename: 'pocket-prairie-modules' });
  return ctx.__app;
}

/* Commons returns Artist and Credit as HTML — usually an anchor to a user
   page. We want the readable name. Keep the text, drop the markup, collapse
   the whitespace; anything else is guesswork. */
function plainText(html){
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normFileName(name){
  let n = String(name || '').trim().replace(/_/g, ' ');
  n = n.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//i, '').replace(/_/g, ' ');
  if (!/^File:/i.test(n)) n = 'File:' + n;
  return n;
}

async function fetchFile(fileName){
  const url = `${API}?action=query&format=json&formatversion=2&titles=${
    encodeURIComponent(fileName)}&prop=imageinfo&iiprop=extmetadata%7Curl%7Csize&iiurlwidth=1400`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Commons API returned ${res.status}`);
  const data = await res.json();
  const page = data && data.query && data.query.pages && data.query.pages[0];
  if (!page || page.missing) return { missing: true, fileName };
  const ii = page.imageinfo && page.imageinfo[0];
  if (!ii) return { missing: true, fileName };
  const m = ii.extmetadata || {};
  const val = k => (m[k] && m[k].value != null) ? String(m[k].value) : '';
  return {
    missing: false,
    fileName: page.title,
    descriptionUrl: ii.descriptionurl || '',
    thumbUrl: ii.thumburl || '',
    originalUrl: ii.url || '',
    width: ii.width, height: ii.height,
    licenseShortName: plainText(val('LicenseShortName')),
    licenseUrl: plainText(val('LicenseUrl')),
    usageTerms: plainText(val('UsageTerms')),
    artist: plainText(val('Artist')),
    credit: plainText(val('Credit')),
    attribution: plainText(val('Attribution')),
    attributionRequired: plainText(val('AttributionRequired')),
    objectName: plainText(val('ObjectName')),
    copyrighted: plainText(val('Copyrighted')),
    restrictions: plainText(val('Restrictions')),
    gps: !!(val('GPSLatitude') || val('GPSLongitude')),
  };
}

/* Map the API's LicenseShortName onto an allowlist slug. Refuses rather than
   guesses: an unrecognised string is a file a human has to look at, and the
   most decorated images on Commons are disproportionately the ones under a
   licence we cannot use. */
function mapLicense(app, shortName){
  const want = String(shortName || '').trim().toLowerCase();
  if (!want) return { ok: false, why: 'the API reported no licence at all' };
  for (const [slug, lic] of Object.entries(app.PHOTO_LICENSES)){
    if ((lic.commons || []).some(c => c.toLowerCase() === want)) return { ok: true, slug, lic };
  }
  for (const [slug, why] of Object.entries(app.PHOTO_LICENSES_REFUSED)){
    const stem = slug.replace(/^cc-/, 'cc ').replace(/-/g, ' ');
    if (want.replace(/-/g, ' ').includes(stem)) return { ok: false, why, slug };
  }
  if (/\bnc\b|noncommercial/.test(want)) return { ok: false, why: app.PHOTO_LICENSES_REFUSED['cc-by-nc'] };
  if (/\bnd\b|noderiv/.test(want))       return { ok: false, why: app.PHOTO_LICENSES_REFUSED['cc-by-nd'] };
  if (/gfdl|free doc/.test(want))        return { ok: false, why: app.PHOTO_LICENSES_REFUSED['gfdl'] };
  if (/free art|fal/.test(want))         return { ok: false, why: app.PHOTO_LICENSES_REFUSED['fal'] };
  return { ok: false, why: `"${shortName}" is not on the allowlist in js/photos.js. If it is genuinely a free licence, add it there deliberately — do not widen it in passing` };
}

function today(){ return new Date().toISOString().slice(0, 10); }

function suggestFileName(plantKey, info){
  /* Strip the query string before reading the extension. Commons thumbnail
     and original URLs now carry ?utm_source=... tracking parameters, so a
     naive split on '.' returns 'org&utm_campaign=imageinfo' and names the
     saved file after it. The record validator caught this on the first live
     run, which is the point of calling it here as well as in the tests. */
  const clean = String(info.originalUrl || '').split(/[?#]/)[0];
  let ext = (clean.split('.').pop() || 'jpg').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
  return `${plantKey}.${ext}`;
}

async function draft(plantKey, rawName){
  const app = loadAppModules();
  if (!app.PLANTS[plantKey]){
    console.error(`\n  "${plantKey}" is not a key in js/plants.js.\n`);
    process.exitCode = 1; return;
  }
  const P = app.PLANTS[plantKey];
  const fileName = normFileName(rawName);
  const info = await fetchFile(fileName);

  console.log(`\n  ${P.name} (${P.latin})`);
  console.log(`  ${'-'.repeat(60)}`);
  if (info.missing){
    console.error(`  ${fileName} does not exist on Commons.`);
    console.error('  Check the spelling, and check you are not looking at a file that\n' +
                  '  lives on Wikipedia rather than Commons — those are non-free.\n');
    process.exitCode = 1; return;
  }

  console.log(`  file          ${info.fileName}`);
  console.log(`  page          ${info.descriptionUrl}`);
  console.log(`  licence       ${info.licenseShortName || '(none reported)'}`);
  console.log(`  artist        ${info.artist || '(none reported)'}`);
  if (info.attribution)  console.log(`  attribution   ${info.attribution}`);
  if (info.credit)       console.log(`  credit        ${info.credit}`);
  if (info.restrictions) console.log(`  RESTRICTIONS  ${info.restrictions}`);
  console.log(`  size          ${info.width}x${info.height}`);
  if (info.gps) console.log('  EXIF          contains GPS coordinates');

  const mapped = mapLicense(app, info.licenseShortName);
  if (!mapped.ok){
    console.error(`\n  REFUSED — ${mapped.why}\n`);
    console.error('  Pick a different file. Quality signals on Commons (Featured Picture,\n' +
                  '  Picture of the Year) are uncorrelated with whether you may use it.\n');
    process.exitCode = 1; return;
  }

  /* Everything the API cannot answer is left for the human, and the record is
     printed INCOMPLETE where a person must decide — verifiedBy is filled in,
     but the checklist behind it is not something a script can tick. */
  const rec = {
    file: suggestFileName(plantKey, info),
    alt: `${P.name} (${P.latin})`,
    title: info.objectName || '',
    creator: info.artist || '',
    sourceName: 'Wikimedia Commons',
    sourceUrl: info.descriptionUrl,
    commonsFileName: info.fileName,
    license: mapped.slug,
    isModified: true,
    modificationNote: 'Resized and re-encoded for display; not otherwise modified.',
    warrantyDisclaimer: true,
    verifiedBy: process.env.USER || process.env.USERNAME || 'REPLACE-ME',
    verifiedOn: today(),
  };
  if (info.attribution) rec.attributionOverride = info.attribution;
  if (/^\s*©/.test(info.credit)) rec.copyrightNotice = info.credit;

  const problems = app.photoRecordProblems(plantKey, rec);
  console.log(`\n  Paste into js/plants.js under "${plantKey}":\n`);
  console.log('    photo:{');
  for (const [k, v] of Object.entries(rec)){
    if (v === '' || v == null) continue;
    console.log(`      ${k}:${typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : v},`);
  }
  console.log('    },');

  const dl = String(info.thumbUrl || info.originalUrl).split(/[?#]/)[0];
  console.log(`\n  Download the display copy:\n    ${dl}`);
  console.log(`  Save it as  photos/${rec.file}  then run resize-photos.ps1.`);
  console.log('  Downscale and re-encode ONLY. Never save a cropped version: the framing');
  console.log('  is done in CSS at render time so the stored file stays the licensor\'s.');
  console.log(`\n  Add to sw.js PRECACHE:\n    './photos/${rec.file}',`);

  if (problems.length){
    console.log('\n  Still incomplete:');
    for (const p of problems) console.log(`    - ${p}`);
  }
  console.log('\n  NOT DONE YET. This tool repeats what the uploader typed; it cannot tell');
  console.log('  you the licence is true. Work through docs/plant-photos.md before you');
  console.log('  commit — especially: is the uploader really the author, is there an');
  console.log('  identifiable face, is there a brand logo or nursery tag in frame.\n');
}

async function verify(){
  const app = loadAppModules();
  const rows = app.PLANT_KEYS
    .map(k => ({ key: k, plant: app.PLANTS[k], photo: app.PLANTS[k].photo }))
    .filter(r => r.photo && r.photo.sourceName === 'Wikimedia Commons');

  if (!rows.length){
    console.log('\n  No Commons photographs are declared. Nothing to verify.\n');
    return;
  }
  console.log(`\n  Re-checking ${rows.length} photograph${rows.length > 1 ? 's' : ''} against Commons\n`);
  let bad = 0;

  for (const r of rows){
    const stored = r.photo;
    const info = await fetchFile(stored.commonsFileName || normFileName(stored.sourceUrl));
    const drift = [];

    if (info.missing){
      /* The one that cannot be fixed after the fact. Files are deleted from
         Commons when a copyright problem surfaces, sometimes years later —
         and every copy we already shipped is on somebody's device offline. */
      drift.push('DELETED FROM COMMONS — pull this image from the next release');
    } else {
      const mapped = mapLicense(app, info.licenseShortName);
      if (!mapped.ok) drift.push(`licence is now "${info.licenseShortName}" — ${mapped.why}`);
      else if (mapped.slug !== stored.license)
        drift.push(`licence changed: stored "${stored.license}", Commons says "${mapped.slug}"`);
      if (info.artist && stored.creator && info.artist !== stored.creator)
        drift.push(`creator changed: stored "${stored.creator}", Commons says "${info.artist}"`);
      if (info.attribution && info.attribution !== (stored.attributionOverride || ''))
        drift.push(`the author now specifies a credit string: "${info.attribution}"`);
      if (info.restrictions)
        drift.push(`non-copyright restrictions flagged: "${info.restrictions}"`);
    }

    const problems = app.photoRecordProblems(r.key, stored);
    const file = path.join(ROOT, 'photos', stored.file || '');
    if (stored.file && !fs.existsSync(file)) problems.push(`photos/${stored.file} is not in the repo`);

    if (drift.length || problems.length){
      bad++;
      console.log(`  ✗ ${r.key} — ${r.plant.name}`);
      for (const d of drift)    console.log(`      ! ${d}`);
      for (const p of problems) console.log(`      - ${p}`);
    } else {
      console.log(`  ✓ ${r.key} — ${r.plant.name} (${stored.license})`);
    }
  }
  console.log(bad ? `\n  ${bad} need attention.\n` : '\n  All records match Commons.\n');
  if (bad) process.exitCode = 1;
}

(async () => {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--verify') await verify();
    else if (args.length >= 2) await draft(args[0], args.slice(1).join(' '));
    else {
      console.log('\n  node dev/commons-photo.js <plantKey> "File:Something.jpg"   draft a record');
      console.log('  node dev/commons-photo.js --verify                          re-check every record\n');
    }
  } catch (e){
    console.error(`\n  ${e.message}\n`);
    process.exitCode = 1;
  }
})();
