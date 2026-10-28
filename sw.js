/* DeadShop service worker — offline shell + runtime cache for item icons.
   Only registers in a secure context (https:// or localhost); on a plain-http
   LAN address the browser refuses it, so the app must degrade gracefully. */
var CACHE = 'deadshop-v13';
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
  './assets/icon.svg',
  './assets/owl.svg',
  './assets/flame.svg',
  './assets/soul.svg',
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
  var p = String(pathname || '/').replace(/^\/+/, '');
  return './' + p;
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
  if (url.pathname.indexOf('/api/') === 0) return;

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
