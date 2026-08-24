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

   Deliberately NO skipWaiting(). A new worker taking over a running tab would
   let a session that started on one build start fetching assets from the next
   one, and this app holds a garden in memory across the whole session. The
   update installs quietly and takes effect on the next visit, which for a
   design tool is the right trade.

   Paths are relative so the worker works both at a domain root and under a
   subpath — GitHub Pages serves this from /PerenialDesignKK/. */
'use strict';

const VERSION = '0.8.20';
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
  './js/library.js',
  './js/screens.js',
  './fonts/fraunces-latin.woff2',
  './fonts/fraunces-latin-ext.woff2',
  './fonts/ibm-plex-sans-latin.woff2',
  './fonts/ibm-plex-sans-latin-ext.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

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
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        /* Match the requested page FIRST. Falling straight through to the shell
           would serve the game at /privacy.html the moment the network was
           gone — the app has more than one navigable page, so index.html is the
           last resort, not the offline answer for every URL. */
        return (await caches.match(req)) ||
               (await caches.match('./index.html')) ||
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
