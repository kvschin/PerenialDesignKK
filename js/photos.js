'use strict';
/* =====================================================
   §14d  PLANT PHOTOGRAPHS + IMAGE ATTRIBUTION
   =====================================================
   The Plant Library's four seasonal illustrations say how a plant BEHAVES
   through the year, which is what this app is for and what a photograph
   cannot show. A photograph answers a different question — what does it
   actually look like — so it sits BESIDE the illustrations rather than
   replacing them, and is deliberately the smaller of the two.

   Everything here exists to keep one fact in one place. A photograph carries
   licence terms, and those terms are only satisfiable if the credit travels
   with the file: creator, source, licence, the original file page, and
   whether we changed it. So the record is STRUCTURED — never a blob of
   pre-rendered HTML — and every surface that shows a credit (the Library
   card, the Credits page, the dev tooling) reads it through the same pure
   functions below. A second hand-maintained attribution list is the specific
   failure this module prevents: it goes stale silently, and a stale credit is
   a licence breach rather than a typo.

   Shaped by a compliance review (docs/plant-photos.md carries the memo's
   conclusions and the per-image human checklist). Four of its findings are
   load-bearing here and are easy to undo by accident:

     1. NEVER write a modified derivative of a photo to disk. Downscale and
        re-encode only; do all framing with aspect-ratio + object-fit in CSS.
        A stored crop is arguably "Adapted Material", which is what would drag
        a ShareAlike licence toward the rest of the app. Framing at render
        time cannot be, because the file was never modified. This is why
        .ld-photo-frame does the cropping and nothing here does.
     2. A photo must never be drawn to the game canvas — not as a texture, not
        into the sprite cache, not into takePhoto()'s exported PNG. Same
        reason. Photos are DOM <img> elements on the Library screen only.
     3. The credit must be COMPLETE OFFLINE. Full absolute URLs are rendered
        as readable text as well as being links, because in an offline app a
        link is something to transcribe, not something to follow.
     4. Where the author specified their own credit string on Commons, it must
        be reproduced verbatim — see `attributionOverride`.

   This file is loaded by index.html AND, on its own alongside js/plants.js,
   by credits.html. So it must not touch the DOM at load time and must not
   assume any other app module exists at load. The DOM builders at the bottom
   are called only from the app; the pure functions above them are what
   credits.html uses. */

/* ---------- the licence allowlist ----------
   A photograph may enter the product only under a licence on this list.
   Pocket Prairie is SOLD (Steam, the app stores) and SHIPS OFFLINE — the
   service worker precaches it onto the device — so every image is both used
   commercially and redistributed. That disqualifies anything NonCommercial or
   NoDerivatives however good the picture is, and it is why this is an
   ALLOWLIST: a licence nobody has checked against those two facts is not
   "probably fine", it is not shipped.

   Prefer the top of the list. CC0 / public domain / CC BY cost nothing but
   search effort at sourcing time and retire two whole risks — they carry no
   ShareAlike analysis, and their anti-technological-measures exposure (the
   unsettled question of whether store DRM around a binary conflicts with the
   licence) is far weaker than ShareAlike's. Treat CC BY-SA as the fallback
   rather than the default. In practice Commons is mostly BY-SA, so this is
   advice about which file to pick out of a category, not a prohibition.

   `commons` lists the exact LicenseShortName strings the Commons API returns
   for this licence, so dev/commons-photo.js can map an API answer to a slug
   and refuse anything it does not recognise instead of guessing.
   `attribution` is whether the licence REQUIRES a credit — CC0 and public
   domain do not; we credit anyway as a courtesy, and the UI says so rather
   than implying an obligation that is not there.
   `title` marks the licences where the title is MANDATORY: it is required in
   CC 3.0 and earlier and optional only in 4.0, and Commons is version-mixed.
   `cure` marks the licences with a reinstatement window (30 days from YOUR
   discovery, CC 4.0 §6(b)(1)). Pre-4.0 terminates automatically with no
   reinstatement — and for a shipped binary the cure path is an app-store
   review cycle, not a website edit, which is the real argument for preferring
   4.0. */
const PHOTO_LICENSES = Object.freeze({
  'cc0':         {name:'CC0 1.0',       url:'https://creativecommons.org/publicdomain/zero/1.0/',
                  commons:['CC0'], attribution:false, shareAlike:false, title:false, cure:true},
  'pd':          {name:'Public domain', url:'',
                  commons:['Public domain','PD-self','PD-author'], attribution:false, shareAlike:false, title:false, cure:true},
  'pd-old':      {name:'Public domain (copyright expired)', url:'',
                  commons:['PD-old-70','PD-old-100','PD-art'], attribution:false, shareAlike:false, title:false, cure:true},
  'pd-usgov':    {name:'Public domain (U.S. Government work)', url:'',
                  commons:['PD-USGov','PD-USGov-NPS','PD-USDA','PD-USGov-FWS'], attribution:false, shareAlike:false, title:false, cure:true},
  'cc-by-4.0':   {name:'CC BY 4.0',     url:'https://creativecommons.org/licenses/by/4.0/',
                  commons:['CC BY 4.0'], attribution:true, shareAlike:false, title:false, cure:true},
  'cc-by-3.0':   {name:'CC BY 3.0',     url:'https://creativecommons.org/licenses/by/3.0/',
                  commons:['CC BY 3.0'], attribution:true, shareAlike:false, title:true, cure:false},
  'cc-by-2.5':   {name:'CC BY 2.5',     url:'https://creativecommons.org/licenses/by/2.5/',
                  commons:['CC BY 2.5'], attribution:true, shareAlike:false, title:true, cure:false},
  'cc-by-2.0':   {name:'CC BY 2.0',     url:'https://creativecommons.org/licenses/by/2.0/',
                  commons:['CC BY 2.0'], attribution:true, shareAlike:false, title:true, cure:false},
  'cc-by-sa-4.0':{name:'CC BY-SA 4.0',  url:'https://creativecommons.org/licenses/by-sa/4.0/',
                  commons:['CC BY-SA 4.0'], attribution:true, shareAlike:true, title:false, cure:true},
  'cc-by-sa-3.0':{name:'CC BY-SA 3.0',  url:'https://creativecommons.org/licenses/by-sa/3.0/',
                  commons:['CC BY-SA 3.0'], attribution:true, shareAlike:true, title:true, cure:false},
  'cc-by-sa-2.5':{name:'CC BY-SA 2.5',  url:'https://creativecommons.org/licenses/by-sa/2.5/',
                  commons:['CC BY-SA 2.5'], attribution:true, shareAlike:true, title:true, cure:false},
  'cc-by-sa-2.0':{name:'CC BY-SA 2.0',  url:'https://creativecommons.org/licenses/by-sa/2.0/',
                  commons:['CC BY-SA 2.0'], attribution:true, shareAlike:true, title:true, cure:false},
  /* Kevin's own garden photographs. Not a Creative Commons licence — it is the
     absence of a third-party one — but it flows through the same record so the
     Library and the Credits page need no second code path, and so no photo can
     ever be displayed with NO provenance recorded at all. */
  'own':         {name:'Photograph by the author', url:'',
                  commons:[], attribution:false, shareAlike:false, title:false, cure:true},
});

/* Licences that appear constantly on Commons and must NEVER be accepted, kept
   by name so the validator says WHY rather than "unknown licence". Each of
   these has caught somebody out:

   GFDL was written for software manuals. §2 requires a verbatim copy of the
   licence with EVERY copy and forbids adding other conditions — which fights
   a proprietary EULA — and forbids technical measures obstructing copying,
   which fights store DRM. Above 100 copies §3 wants a machine-readable
   transparent copy hosted for a year past your last distribution. The §11
   relicensing window closed in 2009 and never applied to downstream reusers
   anyway. Commons banned GFDL-only for new photo uploads in 2018, but the
   LEGACY files are still there and they are disproportionately the good ones:
   the most decorated Echinacea purpurea image on Commons — Featured Picture,
   Picture of the Day, Picture of the Year — is GFDL 1.2 only. Quality signals
   on Commons are uncorrelated with licence suitability, which is exactly why
   the allowlist is machine-enforced and a human's eye cannot overrule it.

   The Free Art License has an Article 4 "larger work" trigger that is a live
   argument inside a packaged binary. Fair use is here because English
   Wikipedia hosts non-free files LOCALLY: they appear in articles, they are
   not on Commons, and they are not reusable. 1.0 CC licences lack the "or
   later" upgrade path and are too rare to be worth a special case. */
const PHOTO_LICENSES_REFUSED = Object.freeze({
  'cc-by-nc':     'NonCommercial — Pocket Prairie is sold, so this can never be used',
  'cc-by-nc-sa':  'NonCommercial — Pocket Prairie is sold, so this can never be used',
  'cc-by-nc-nd':  'NonCommercial and NoDerivatives — unusable here twice over',
  'cc-by-nd':     'NoDerivatives — do not argue about resizing; pick another file',
  'gfdl':         'GFDL obliges shipping the full licence text with every copy and forbids technical measures; not workable in an app binary',
  'fal':          'Free Art License — its Article 4 "larger work" trigger is a live argument inside a packaged binary',
  'cc-by-1.0':    'CC 1.0 has no "or later" upgrade path; pick a later-licensed file',
  'cc-by-sa-1.0': 'CC 1.0 has no "or later" upgrade path; pick a later-licensed file',
  'fair-use':     'Non-free. English Wikipedia hosts these locally; they are not on Commons and are not reusable',
  'non-free':     'Non-free. Not on Commons, not reusable',
});

const PHOTO_SOURCES = Object.freeze({
  'Wikimedia Commons': 'https://commons.wikimedia.org/',
  'Own photograph': '',
});

const PHOTO_DIR = 'photos/';
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

/* The identical, unmodified image files are also served without any
   technological restriction from the public project site. Saying so on the
   Credits page is the standard mitigation for the unresolved question of
   whether store DRM around a binary conflicts with a licence's
   anti-technological-measures clause — and it costs nothing, because GitHub
   Pages already serves this repository as-is. */
const PHOTO_PARALLEL_SOURCE = 'https://kvschin.github.io/PerenialDesignKK/';

/* A record may be marked as demonstration data. Nothing so marked may ship —
   a test asserts it — and the app refuses to render it unless ?photodemo is
   on the URL. A placeholder credit is INDISTINGUISHABLE from a real one after
   it has sat in the file for a month, and a wrong credit is worse than no
   photograph. */
const PHOTO_SAMPLE_MARK = 'SAMPLE';
function photoIsSample(rec){
  if (!rec) return false;
  if (rec.sample === true) return true;
  return [rec.creator, rec.title, rec.licenseName, rec.sourceUrl, rec.attributionOverride]
    .some(v => typeof v === 'string' && v.toUpperCase().includes(PHOTO_SAMPLE_MARK));
}
function photoDemoMode(){
  return typeof location !== 'undefined' && /[?&]photodemo\b/.test(location.search || '');
}

/* ---------- ?photodemo ----------
   The photo component cannot be seen without a photograph, and this product
   ships with none: inventing a photographer and a licence in order to
   demonstrate a licence-display feature would be exactly the failure the
   feature exists to prevent. So the demonstration is a PLACARD, not an image
   — it says what it is in the picture itself — and every text field says
   SAMPLE. `license` is deliberately NOT a key in PHOTO_LICENSES, so nothing
   resolves it to a real licence name or a real licence URL; the panel shows
   the unverified string and offers no link.

   Three separate things keep it out of the product: photoIsSample() gates it
   behind ?photodemo at runtime, it lives here rather than in plants.js, and a
   test asserts no shipped species carries a sample-marked record. Reach it at
   index.html?photodemo and open Little Bluestem in the Plant Library. */
const PHOTO_DEMO_KEY = 'bluestem';
const PHOTO_DEMO_PLACARD = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' +
  '<rect width="600" height="400" fill="#2f231d"/>' +
  '<rect x="14" y="14" width="572" height="372" fill="none" stroke="#c97f3f" stroke-width="2" stroke-dasharray="10 8"/>' +
  '<text x="300" y="186" fill="#efe6d3" font-family="Georgia,serif" font-size="38" text-anchor="middle">SAMPLE</text>' +
  '<text x="300" y="228" fill="#c9b9a0" font-family="sans-serif" font-size="19" text-anchor="middle">not a photograph</text>' +
  '<text x="300" y="258" fill="#9d8f7c" font-family="sans-serif" font-size="15" text-anchor="middle">layout demonstration only</text>' +
  '</svg>');
const PHOTO_DEMO_RECORD = Object.freeze({
  sample: true,
  demoSrc: PHOTO_DEMO_PLACARD,
  alt: 'A placard reading SAMPLE, standing in for a plant photograph',
  title: 'SAMPLE — not a real image title',
  creator: 'SAMPLE — not a real photographer',
  copyrightNotice: 'SAMPLE — not a real copyright notice',
  sourceName: 'Wikimedia Commons',
  sourceUrl: 'https://commons.wikimedia.org/wiki/Main_Page',
  commonsFileName: 'SAMPLE — no real file',
  license: 'sample',
  licenseName: 'SAMPLE — no licence has been verified',
  isModified: true,
  modificationNote: 'SAMPLE — Resized and re-encoded for display.',
  warrantyDisclaimer: true,
});

/* ---------- reading a record ---------- */

/* The one lookup. Returns null for every plant with no photograph, which is
   most of them and is a normal state rather than a degraded one — the
   seasonal illustrations are the Library's primary art and stand alone.
   Callers render nothing at all on null: no empty frame, no disabled credit
   button, no "photo coming soon" plate. */
function plantPhotoRecord(key){
  const P = (typeof PLANTS !== 'undefined' && PLANTS[key]) || null;
  const rec = P && P.photo;
  if (!rec || typeof rec !== 'object'){
    return (photoDemoMode() && key === PHOTO_DEMO_KEY) ? PHOTO_DEMO_RECORD : null;
  }
  if (photoIsSample(rec) && !photoDemoMode()) return null;
  return rec;
}

function photoLicense(rec){
  if (!rec) return null;
  const id = rec.license && String(rec.license).toLowerCase();
  return (id && PHOTO_LICENSES[id]) || null;
}

/* Where the file actually lives. The app self-hosts every asset — it makes
   zero third-party requests by design, which is a privacy-policy claim and a
   store-listing claim rather than a preference — so `file` is a local name
   under photos/, while `sourceUrl` keeps the ORIGINAL Commons file page. Those
   are two different facts, and collapsing them would cost either offline use
   or the provenance. Never point this at upload.wikimedia.org. */
function photoSrc(rec){
  if (!rec) return '';
  if (rec.demoSrc) return rec.demoSrc;          // ?photodemo placard only
  return rec.file ? PHOTO_DIR + rec.file : '';
}

/* Alt text describes the PLANT. A screen-reader user wants to know what the
   picture shows; the credit is separate content reachable through the info
   control. Never put the licence in here. */
function photoAltText(key, rec){
  if (rec && rec.alt) return rec.alt;
  const P = (typeof PLANTS !== 'undefined' && PLANTS[key]) || null;
  if (!P) return 'Plant photograph';
  return `${P.name} (${P.latin})`;
}

/* ---------- the credit, as structured parts ----------
   Returns fields, not sentences, so each surface lays them out in its own
   idiom — a dark definition list in the app, paper cards on the Credits page
   — while the FACTS come from one place. This is the function that must not
   be duplicated. */
function photoCreditParts(rec){
  if (!rec) return null;
  const lic = photoLicense(rec);
  const own = rec.sourceName === 'Own photograph' || rec.license === 'own';
  return {
    title: rec.title || '',
    creator: rec.creator || '',
    /* Where the author specified their own credit string on the Commons file
       page, that string is what the licence asks for and it is reproduced
       verbatim in place of a generated "by <creator>". Generating our own
       wording over the top of an explicit request is the most common way a
       technically-complete attribution still fails. */
    attributionOverride: rec.attributionOverride || '',
    /* Required if the licensor supplied one. We strip EXIF on ingest for the
       photographer's own privacy (home-garden GPS coordinates are common), so
       a notice that lived in the file's metadata has to be carried here or it
       is simply gone. */
    copyrightNotice: rec.copyrightNotice || '',
    sourceName: rec.sourceName || '',
    sourceUrl: rec.sourceUrl || '',
    licenseName: (lic && lic.name) || rec.licenseName || '',
    licenseUrl: (lic && lic.url) || rec.licenseUrl || '',
    licenseElected: rec.licenseElected || '',
    /* Any change has to be disclosed. We downscale and re-encode; we never
       write a cropped derivative, because the framing is done in CSS at
       render time and the stored file is the licensor's. The default wording
       says exactly that, since "cropped" would claim a modification we did
       not make and would undercut the reason the crop lives in CSS. */
    modificationNote: rec.isModified
      ? (rec.modificationNote || 'Resized and re-encoded for display; not otherwise modified.')
      : '',
    commonsFileName: rec.commonsFileName || '',
    /* CC BY-SA §3(a)(1)(A)(iv) — the notice referring to the disclaimer of
       warranties, the element almost everyone drops. */
    warrantyDisclaimer: rec.warrantyDisclaimer !== false && !own,
    requiresAttribution: !lic || lic.attribution !== false,
    shareAlike: !!(lic && lic.shareAlike),
    isOwn: own,
  };
}

/* One flat line, for anywhere that cannot lay out fields: a plain-text
   export, a dev listing, an image title attribute. Deliberately the same
   order as the panel — title, creator, source, licence, modification — so the
   two can never read as different claims about the same photograph. */
function photoCreditLine(rec){
  const p = photoCreditParts(rec);
  if (!p) return '';
  if (p.isOwn) return `Photograph by ${p.creator || 'the author'}.`;
  const who = p.attributionOverride || (p.creator ? `by ${p.creator}` : '');
  let s = p.title ? `“${p.title}”` : 'Photograph';
  if (who) s += ` ${who}`;
  if (p.sourceName) s += `, via ${p.sourceName}`;
  if (p.sourceUrl) s += ` (${p.sourceUrl})`;
  if (p.licenseName) s += `, licensed under ${p.licenseName}`;
  if (p.licenseUrl) s += ` (${p.licenseUrl})`;
  s += '.';
  if (p.modificationNote) s += ` ${p.modificationNote}`;
  if (p.warrantyDisclaimer) s += ' Provided without warranties.';
  return s;
}

/* Every photograph in the product, for the Credits page. Generated — there is
   no second list to maintain and therefore none to forget. */
function plantsWithPhotos(){
  const keys = (typeof PLANT_KEYS !== 'undefined' && PLANT_KEYS) || Object.keys(PLANTS || {});
  return keys
    .map(k => ({key: k, plant: PLANTS[k], photo: plantPhotoRecord(k)}))
    .filter(r => r.plant && r.photo)
    .sort((a, b) => a.plant.name.localeCompare(b.plant.name));
}

/* ---------- validation ----------
   Shared by the test suite and by dev/commons-photo.js so a record cannot
   pass one and fail the other. Returns human-readable problems; empty means
   the record is structurally complete.

   It cannot tell you the LICENCE IS TRUE. Only a person reading the Commons
   file page can do that — checking that the uploader is the author, that no
   extra conditions were bolted on in prose, that there is no identifiable
   face — which is why docs/plant-photos.md carries a checklist and this
   carries a schema. What it CAN do is make a human's aesthetic judgment
   unable to overrule the allowlist, which is the failure mode that matters:
   the best-looking file in a Commons category is disproportionately likely to
   be the one you may not use. */
function photoRecordProblems(key, rec){
  const out = [];
  if (!rec || typeof rec !== 'object') return [`${key}: photo is not an object`];
  const tag = `${key}.photo`;

  if (!rec.file) out.push(`${tag}: no file`);
  else {
    if (/[\\/]|\.\./.test(rec.file)) out.push(`${tag}: file must be a bare name under ${PHOTO_DIR}`);
    const ext = String(rec.file).split('.').pop().toLowerCase();
    if (!PHOTO_EXTS.includes(ext)) out.push(`${tag}: unsupported extension ".${ext}"`);
  }

  const id = rec.license && String(rec.license).toLowerCase();
  if (!id) out.push(`${tag}: no license`);
  else if (PHOTO_LICENSES_REFUSED[id]) out.push(`${tag}: license "${id}" is refused — ${PHOTO_LICENSES_REFUSED[id]}`);
  else if (!PHOTO_LICENSES[id]) out.push(`${tag}: license "${id}" is not on the allowlist in js/photos.js`);

  const lic = PHOTO_LICENSES[id] || null;
  const own = rec.sourceName === 'Own photograph' || id === 'own';

  /* A creator is required even where the licence does not compel one. An
     unattributed photograph is one nobody can re-verify later, and the record
     exists so a future maintainer can retrace it. */
  if (!rec.creator) out.push(`${tag}: no creator`);

  if (!own){
    if (!rec.sourceName) out.push(`${tag}: no sourceName`);
    else if (!(rec.sourceName in PHOTO_SOURCES)) out.push(`${tag}: unknown sourceName "${rec.sourceName}"`);

    /* The original file page is the evidence. Without it the licence claim is
       unfalsifiable, which for a commercial product is the same as absent. */
    if (!rec.sourceUrl) out.push(`${tag}: no sourceUrl — the original file page is the licence evidence`);
    else if (!/^https:\/\//.test(rec.sourceUrl)) out.push(`${tag}: sourceUrl must be https`);
    else if (/^https:\/\/[a-z-]*\.?wikipedia\.org\//.test(rec.sourceUrl))
      out.push(`${tag}: sourceUrl is a Wikipedia page. Wikipedia hosts NON-FREE files locally under fair use; appearing in an article is not permission. Source from commons.wikimedia.org only`);
    else if (/^https:\/\/upload\.wikimedia\.org\//.test(rec.sourceUrl))
      out.push(`${tag}: sourceUrl must be the Commons FILE PAGE, not the raw upload URL — the file page is what carries the licensing`);

    if (rec.sourceName === 'Wikimedia Commons'){
      if (rec.sourceUrl && !/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(rec.sourceUrl))
        out.push(`${tag}: sourceUrl must be a commons.wikimedia.org file page`);
      if (!rec.commonsFileName) out.push(`${tag}: no commonsFileName`);
    }

    /* Mandatory in CC 3.0 and earlier, optional only in 4.0 — and Commons is
       version-mixed, so this is a real per-file difference rather than a
       formality. */
    if (lic && lic.title && !rec.title)
      out.push(`${tag}: ${lic.name} requires the image title in the attribution`);

    if (lic && lic.attribution && !rec.creator && !rec.attributionOverride)
      out.push(`${tag}: ${lic.name} requires a creator credit`);

    if (lic && lic.url && !rec.licenseUrl && !lic.url) out.push(`${tag}: no licenseUrl`);

    /* A dual-licensed file (typically GFDL or CC BY-SA) is usable only on the
       CC arm, and which arm was taken has to be on the record — it is the
       defence against a GFDL claim later. */
    if (rec.isDualLicensed && !rec.licenseElected)
      out.push(`${tag}: dual-licensed file must record licenseElected`);

    /* Evidence for the store review that can ask for it, and for the
       re-verification pass. Not licence-required; required by us. */
    if (!rec.verifiedBy) out.push(`${tag}: no verifiedBy — a person has to have checked the file page`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.verifiedOn || ''))
      out.push(`${tag}: verifiedOn must be an ISO date (YYYY-MM-DD)`);
  }

  if (rec.isModified && rec.modificationNote === '')
    out.push(`${tag}: isModified is set but modificationNote is empty`);

  return out;
}

/* ---------- DOM: the photo component ----------
   Browser only. Called from js/library.js; credits.html uses the pure
   functions above and renders in its own static-page idiom. */

function photoUiIcon(name){
  if (typeof uiIcon === 'function') return uiIcon(name);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ui-icon'); svg.setAttribute('aria-hidden', 'true');
  return svg;
}

/* An outbound link. Three things every one of these needs and that are easy
   to drop: rel="noopener" (a target=_blank link hands the opener to the new
   document without it), rel="noreferrer" (which also keeps the app's
   no-third-party-disclosure property honest), and a visually-hidden "opens in
   a new tab" — a screen reader announces the link TEXT, not the decorative
   arrow, so the arrow cannot be the only signal. */
function photoExtLink(href, label){
  const a = document.createElement('a');
  a.className = 'ext-link';
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.append(label);
  const arrow = document.createElement('span');
  arrow.className = 'ext-arrow'; arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  a.append(arrow);
  const sr = document.createElement('span');
  sr.className = 'sr-only'; sr.textContent = ' (opens in a new tab)';
  a.append(sr);
  return a;
}

/* The full URL, printed. In an offline app a link is not something to follow,
   it is something to transcribe — and the attribution has to be complete
   without a network. So every URL appears as readable text underneath its
   link. Never shortened, never through a redirector. */
function photoUrlText(url){
  const p = document.createElement('p');
  p.className = 'ld-photo-url';
  p.textContent = url;
  return p;
}

let photoCreditSeq = 0;

/* The credit panel. A disclosure in normal document flow rather than a
   floating popover: that is what makes "must not overflow the viewport" true
   by construction instead of by arithmetic — there is no anchor to measure
   and nothing to reposition on a narrow screen. It is a disclosure and not a
   modal on purpose too; aria-expanded/aria-controls is the right pattern for
   revealing adjacent content, and it needs no focus trap, no scrim and no
   restore path to be keyboard- and screen-reader-complete. */
function buildPhotoCreditPanel(rec, id){
  const p = photoCreditParts(rec);
  const box = document.createElement('div');
  box.className = 'ld-photo-credit hidden';
  box.id = id;
  const dl = document.createElement('dl');

  const row = (term, value) => {
    const dt = document.createElement('dt'); dt.textContent = term;
    const dd = document.createElement('dd');
    if (Array.isArray(value)) value.forEach(v => dd.append(v));
    /* nodeType rather than `instanceof Node`: this file is also loaded
       outside a browser realm (the test sandbox, credits.html tooling),
       where Node is not a global. The duck check is true everywhere. */
    else if (value && typeof value === 'object' && value.nodeType) dd.append(value);
    else dd.textContent = value;
    dl.append(dt, dd);
  };

  if (p.title) row('Title', p.title);
  /* The author's own credit string wins where they gave one. */
  if (p.attributionOverride) row('Credit', p.attributionOverride);
  else if (p.creator) row('Photograph', p.creator);
  if (p.copyrightNotice) row('Copyright', p.copyrightNotice);

  if (p.isOwn){
    row('Source', 'Pocket Prairie');
  } else {
    if (p.sourceName) row('Source', p.sourceName);
    if (p.licenseName){
      row('Licence', p.licenseUrl
        ? [photoExtLink(p.licenseUrl, p.licenseName), photoUrlText(p.licenseUrl)]
        : p.licenseName);
    }
    if (p.licenseElected) row('Elected', p.licenseElected);
  }
  if (p.modificationNote) row('Changes', p.modificationNote);
  else row('Changes', 'Unmodified.');
  box.append(dl);

  if (p.sourceUrl){
    const foot = document.createElement('p');
    foot.className = 'ld-photo-credit-foot';
    foot.append(photoExtLink(p.sourceUrl, 'View the original file'));
    box.append(foot, photoUrlText(p.sourceUrl));
  }

  const notes = [];
  if (p.warrantyDisclaimer) notes.push('Provided without warranties.');
  if (!p.requiresAttribution) notes.push('Attribution is not required by this licence; it is offered as a courtesy.');
  /* Naming Wikimedia Commons as the SOURCE is a factual credit and is exactly
     what the licence asks for. Anything reading as a partnership is not — and
     the licence separately forbids implying the PHOTOGRAPHER endorses us — so
     the relationship is stated rather than left as a logo-shaped hole that
     invites one. */
  if (!p.isOwn && p.sourceName === 'Wikimedia Commons'){
    notes.push('The Wikimedia Foundation and the photographer are not affiliated with Pocket Prairie and do not endorse it.');
  }
  if (notes.length){
    const note = document.createElement('p');
    note.className = 'ld-photo-credit-note';
    note.textContent = notes.join(' ');
    box.append(note);
  }
  return box;
}

/* The photo block: framed image, a quiet ⓘ control over it, and the credit
   disclosure beneath. Returns null when there is no photograph, and the
   caller appends nothing — the ordinary case, in which the Library looks
   exactly as it always has. */
function buildPlantPhoto(key){
  const rec = plantPhotoRecord(key);
  if (!rec) return null;
  const src = photoSrc(rec);
  if (!src) return null;

  const fig = document.createElement('figure');
  fig.className = 'ld-photo';

  /* The frame does the cropping — aspect-ratio + object-fit, in CSS, at
     render time. That is not only a layout choice: the stored file stays the
     licensor's unmodified work, so no question of having produced an adapted
     version can arise. Do not "optimise" this by shipping pre-cropped files. */
  const frame = document.createElement('div');
  frame.className = 'ld-photo-frame';

  const img = document.createElement('img');
  img.src = src;
  img.alt = photoAltText(key, rec);
  /* Lazy because the Library detail is a scrolling column and the photo sits
     below the seasonal panel; async decode keeps a large JPEG off the main
     thread. The frame's aspect-ratio reserves the box either way, so neither
     can cause a reflow when the bytes land. */
  img.loading = 'lazy';
  img.decoding = 'async';
  frame.append(img);

  const id = `ldPhotoCredit${++photoCreditSeq}`;
  const panel = buildPhotoCreditPanel(rec, id);

  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'ld-photo-info';
  info.setAttribute('aria-expanded', 'false');
  info.setAttribute('aria-controls', id);
  /* The visible label is "Photo info"; the accessible name says what the
     control actually reveals, because "info" out of context tells a screen
     reader user nothing. It is a real button, so it works from the keyboard
     and on touch — a credit must never be hover-only. */
  info.setAttribute('aria-label', 'Photograph credit and licence');
  info.append(photoUiIcon('info'));
  const lbl = document.createElement('span');
  lbl.className = 'ld-photo-info-label';
  lbl.textContent = 'Photo info';
  info.append(lbl);
  info.onclick = () => {
    const hiddenNow = panel.classList.toggle('hidden');
    info.setAttribute('aria-expanded', hiddenNow ? 'false' : 'true');
  };
  frame.append(info);

  /* A declared photo whose file will not load. Not the same state as "no
     photo": the record exists, so something is wrong, and the frame keeps its
     reserved box and says so quietly. The credit control goes with it —
     nothing is displayed, so there is nothing to attribute, and a credit
     button over an empty plate is the "empty attribution button" failure. */
  img.onerror = () => {
    frame.classList.add('missing');
    img.remove(); info.remove(); panel.remove();
    const p = document.createElement('p');
    p.className = 'ld-photo-missing';
    p.textContent = 'Photograph unavailable';
    frame.append(p);
  };

  fig.append(frame, panel);
  return fig;
}

/* The "Learn more" row. Optional, secondary, and deliberately not a
   description source — Pocket Prairie's own blurb is the editorial voice, and
   an outbound encyclopedia link is a reference rather than a replacement. */
function buildPlantReferences(key){
  const P = (typeof PLANTS !== 'undefined' && PLANTS[key]) || null;
  const links = P && P.externalLinks;
  if (!links || !links.wikipedia) return null;
  const box = document.createElement('div');
  box.className = 'ld-refs';
  const h = document.createElement('h4');
  h.textContent = 'Learn more';
  box.append(h);
  box.append(photoExtLink(links.wikipedia, 'Wikipedia'));
  /* Offline, an outbound link is a dead end rather than a reference, so print
     the URL beside it. This is also the only form that survives being read
     aloud or printed. */
  box.append(photoUrlText(links.wikipedia));
  return box;
}
