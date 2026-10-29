/* DeadShop service worker — offline shell + runtime cache for item icons.
   Only registers in a secure context (https:// or localhost); on a plain-http
   LAN address the browser refuses it, so the app must degrade gracefully. */
var CACHE = 'deadshop-v24';

/* Where the site lives. On GitHub Pages the service worker sits in
   /DeadShop-pages/, so every path in the site starts there. Without this
   the key of a page ("/DeadShop-pages/") would not match the key of the
   shell ("./index.html"), and a page would be served from the cache while
   the scripts next to it came fresh from the network — a broken build. */
var BASE = (function () {
  var p = self.location.pathname || '/';
  return p.slice(0, p.lastIndexOf('/') + 1);
})();

var SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './core.js',
  './auth.js',
  './api.js',
  './manifest.webmanifest',
  './data/data.js',
  './data/shop_stats.js',
  './data/updates.js',
  './data/config.js',
  './data/heroes.js',
  './data/stat_icons.js',
  './data/stat_branches.js',
  './assets/icon.svg',
  './assets/owl.svg',
  './assets/flame.svg',
  './assets/soul.svg',
  './assets/soul-urn.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
  './assets/icon-maskable-512.png',
  './assets/favicon-32.png',
  './assets/fonts/saira-var.woff2',
  './assets/sfx/lesson-done.m4a'
];

/* './data/data.js' for every path we care about */
function shellPath(pathname) {
  var p = String(pathname || '/');
  if (BASE !== '/' && p.indexOf(BASE) === 0) p = p.slice(BASE.length);
  return './' + p.replace(/^\/+/, '');
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* The API is never cached. The board, the account, the ad slots and the
     daily limit change every minute — a cached answer would show yesterday's
     state, and a cached "you may start a lesson" would be a hole in the
     limit. These requests go straight to the network. */
  /* The check has to look anywhere in the path, not only at its start:
     the site lives in a folder on GitHub Pages, so the door of the API is
     "/DeadShop-pages/api/shop". */
  if (url.pathname.indexOf('/api/') >= 0) return;

  /* A page is always asked for from the network first. The page and the
     scripts beside it have to be of the same build: a cached page with a
     fresh script is a site that throws on the first click. The cache is
     the answer only when there is no network. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  var key = shellPath(url.pathname);
  var isShell = SHELL.indexOf(key) >= 0;

  // app shell: network first so a data update is picked up immediately,
  // cache as the fallback when the device is offline.
  // The cache key is the path without the ?v=… query, so the precached
  // entries and the requests with a version tag hit the same slot.
  if (isShell) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(key, copy); });
        return res;
      }).catch(function () {
        return caches.match(key).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // item icons and everything else: cache first, refresh in the background
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
