/* Pocket Prairie service worker.

   The app is entirely static — no API, no backend, and since the fonts were
   self-hosted, no third-party origin either — so "works offline" is just a
   matter of holding the shell. Everything it needs is precached on install and
   served cache-first afterwards.

   CACHE is named from VERSION below, which MUST equal APP_VERSION in js/core.js
   and the version in package.json. It is a hand-kept copy — a worker cannot
   importScripts js/core.js (that file touches document at load), and making the
   version a file sw.js imports would defeat the update check, which compares
   THIS script's bytes. A test pins all three together, because bumping core.js
   alone leaves sw.js byte-identical: the browser then never installs a new
   worker and every visitor keeps being served the old cache forever. That is
   exactly what happened between 0.6.4 and 0.6.6. Bumping this is what
   ships an update: the new worker precaches into a new cache, and the old one is
   deleted on activate. Keep the two in step — a version bump with a stale
   PRECACHE list ships a half-updated app.

   Deliberately NO skipWaiting() ON INSTALL. A new worker taking over a running
   tab would let a session that started on one build start fetching assets from
   the next one, and this app holds a garden in memory across the whole session.

   But "takes effect on the next visit" was an assumption that only held on a
   desktop. A waiting worker activates when every client on the origin is gone,
   and on a phone that can simply never happen: an installed PWA's web view
   survives being swiped out of the app switcher, any Safari tab left open on
   the origin is another client, and a PWA is resumed rather than navigated so
   the update check itself fires rarely. The observed result is a phone pinned
   on an old build indefinitely with no way to know — while the same commits
   were live and fine on a desktop the whole time.

   So the takeover is MESSAGE-DRIVEN instead of automatic: the page offers the
   update, and only once the gardener accepts does it ask for skipWaiting. The
   invariant is intact — no session ever silently mixes two builds — and the
   update stops waiting for a moment that never comes.

   Paths are relative so the worker works both at a domain root and under a
   subpath — GitHub Pages serves this from /PerenialDesignKK/. */
'use strict';

const VERSION = '0.8.62';
const CACHE = 'pocket-prairie-v' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './site.webmanifest',
  // Linked from the main menu, and both stores expect them reachable in-app.
  // They are plain static pages, so offline costs nothing to support.
  './privacy.html',
  './terms.html',
  // Reached from the same footer, and the place every image licence is
  // recorded. It builds its list from js/plants.js at load, so it is only
  // correct offline if the data file is cached too — which it already is,
  // below, as the app's own first script.
  './credits.html',
  // The first-run demo garden. Precached because the offer fires on launch and
  // a first launch is exactly when someone might have no connection — an
  // onboarding path that needs the network is not one.
  './demo-garden.json',
  // Load order matters in the browser; it does not here, but the list mirrors
  // index.html so a missing module is easy to spot against it.
  './js/plants.js',
  './js/core.js',
  './js/draw.js',
  './js/world.js',
  './js/view.js',
  './js/renderer.js',
  './js/commands.js',
  './js/input.js',
  './js/io.js',
  './js/collections.js',
  './js/ui.js',
  './js/tray.js',
  './js/photos.js',
  './js/library.js',
  './js/screens.js',
  './fonts/fraunces-latin.woff2',
  './fonts/fraunces-latin-ext.woff2',
  './fonts/ibm-plex-sans-latin.woff2',
  './fonts/ibm-plex-sans-latin-ext.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  /* ---- plant photographs ----
     Every photograph declared in js/plants.js belongs in this list, and a test
     asserts it (see "every plant photograph is precached"). That is not
     tidiness: a photograph carries licence terms, its credit must be readable
     wherever the picture is, and the credit is only complete offline if both
     shipped together. Leaving photos to the runtime cache below would mean the
     first person to open the Plant Library on a plane sees neither.

     There are none yet, deliberately — no image enters the product before a
     person has worked through the checklist in docs/plant-photos.md. Add each
     one here as './photos/<file>' when it does. Watch the budget while you do:
     the shell is ~1.7MB and photographs will dwarf it, so the size of the photo
     set is a product decision to take on purpose rather than discover. */
];

/* The page asks for this only after the gardener has agreed to reload, so it
   is not the skipWaiting() the comment above refuses. */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* addAll is atomic — one 404 rejects the whole install and leaves the old
       worker serving, which is the correct failure. Fetch each with cache:
       'reload' so a stale HTTP cache cannot seed the precache with the previous
       build's files. */
    await cache.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.startsWith('pocket-prairie-v') && n !== CACHE)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nothing else should exist

  /* A navigation must never hard-fail offline. Try the network first so a
     deployed update is picked up promptly, and fall back to the cached shell —
     which is also what makes a deep link work with no connection. */
  /* Pages are cache-first like every other versioned asset, and each is
     cached under ITS OWN url.

     Two bugs lived in the network-first version this replaces. It wrote
     every successful navigation to './index.html' whatever page had been
     asked for, so one visit to privacy.html put the privacy page in the
     shell's slot and the app opened as the privacy page offline. And
     network-first HTML in front of cache-first scripts is precisely the
     mixed release this worker's deliberate lack of skipWaiting exists to
     prevent: a fresh index.html would load against the previous build's
     js/. Serving pages from the same cache generation as their scripts is
     what makes "no session ever silently mixes two builds" true.

     Updates still arrive the same way they already did for every script:
     the update check installs a new worker, it precaches a new generation,
     and #updateBar hands the takeover to the gardener.

     ignoreSearch, because ?debug / ?vp / ?noglass / ?photodemo are read by
     the page from location.search and must not each be a cache miss. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());   // under its own url, never the shell's
        }
        return fresh;
      } catch (_) {
        /* A page we have never seen and no network. The shell is the last
           resort, not the answer for every url — that ordering was already
           right here and is kept. */
        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  /* Everything else is a versioned static asset: cache-first is both the
     fastest and the only answer that holds up with no network. A miss is
     fetched and kept, so anything added to the app without a PRECACHE entry
     still ends up available offline after one online visit. */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return Response.error();
    }
  })());
});
