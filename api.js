/* The bridge to the DeadShop server.
 *
 * The site works without a server — that is the whole point of the static
 * copy on GitHub Pages. When a server is there, this module adds the things
 * a static site cannot do: an account that follows you between devices, bug
 * reports that reach the person who runs the site, a leaderboard among the
 * people who play, ad slots, the daily limit and the subscription.
 *
 * Nothing here is allowed to break the app. Every call has a timeout, every
 * failure is swallowed, and the site simply behaves like the local-only
 * build when the server cannot be reached.
 *
 * Where the server is:
 *   data/config.js -> window.DSCONFIG = { server: 'https://...' }
 * Left empty, the same origin is used — which is right when the server
 * serves the site itself.
 */
window.DSCLOUD = (function () {
  'use strict';

  var CFG = window.DSCONFIG || {};
  var TOKEN_KEY = 'deadshop-token-v1';
  var TIMEOUT = 12000;

  var base = '';
  var token = null;
  var available = false;
  var config = null;
  var user = null;
  var ads = [];
  var listeners = [];

  // ------------------------------------------------------------------ state
  function onChange(fn) { listeners.push(fn); }
  function fire() {
    listeners.forEach(function (fn) {
      try { fn(api); } catch (e) { /* a listener must not break the others */ }
    });
  }

  function api() {
    return {
      available: available,
      base: base,
      config: config,
      user: user,
      ads: ads,
      onChange: onChange
    };
  }

  function getToken() {
    if (token === null) {
      try { token = localStorage.getItem(TOKEN_KEY) || ''; }
      catch (e) { token = ''; }
    }
    return token;
  }

  function setToken(t) {
    token = t || '';
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode */ }
  }

  // ------------------------------------------------------------------ calls
  function call(method, path, body, extraHeaders) {
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    var t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (k) { headers[k] = extraHeaders[k]; });
    }
    var ctrl = null;
    try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
    var opt = { method: method, headers: headers, cache: 'no-store' };
    if (body !== undefined && body !== null) opt.body = JSON.stringify(body);
    if (ctrl) opt.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(base + path, opt).then(function (r) {
      clearTimeout(timer);
      return r.text().then(function (raw) {
        var data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = { error: raw }; }
        if (!r.ok) {
          var err = new Error(data.error || ('HTTP ' + r.status));
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    }).catch(function (e) {
      clearTimeout(timer);
      var err = new Error(e && e.message ? e.message : 'no server');
      err.offline = true;
      throw err;
    });
  }

  // ------------------------------------------------------------------ boot
  function init(done) {
    var candidates = [];
    if (CFG.server) candidates.push(String(CFG.server).replace(/\/+$/, ''));
    if (typeof location !== 'undefined' && location.origin &&
        location.origin.indexOf('file:') !== 0) {
      if (candidates.indexOf(location.origin) < 0) candidates.push(location.origin);
    }
    var i = 0;
    function next() {
      if (i >= candidates.length) {
        available = false;
        fire();
        if (done) done(false);
        return;
      }
      base = candidates[i++];
      call('GET', '/api/health').then(function (r) {
        if (!r || !r.ok) throw new Error('not a deadshop server');
        available = true;
        return loadConfig();
      }).then(function () {
        return restore();
      }).then(function () {
        fire();
        if (done) done(true);
      }).catch(function () {
        available = false;
        next();
      });
    }
    next();
  }

  function loadConfig() {
    return call('GET', '/api/config').then(function (r) {
      config = r || null;
      ads = (r && r.ads) || [];
      return r;
    }).catch(function () { return null; });
  }

  function refreshAds() {
    return call('GET', '/api/ads').then(function (r) {
      ads = (r && r.ads) || [];
      fire();
      return ads;
    }).catch(function () { return ads; });
  }

  // the saved account, if there is one
  function restore() {
    if (!getToken()) return Promise.resolve(null);
    return call('GET', '/api/me').then(function (r) {
      user = r.user || null;
      fire();
      return user;
    }).catch(function (e) {
      // a token that no longer works is not worth keeping
      if (e && e.status === 403) setToken('');
      user = null;
      fire();
      return null;
    });
  }

  // ------------------------------------------------------------------ accounts
  function register(email, password, name) {
    return call('POST', '/api/register', { email: email, password: password, name: name || '' })
      .then(function (r) { setToken(r.token); user = r.user; fire(); return r; });
  }

  function login(email, password) {
    return call('POST', '/api/login', { email: email, password: password })
      .then(function (r) { setToken(r.token); user = r.user; fire(); return r; });
  }

  function logout() {
    return call('POST', '/api/logout', {}).catch(function () { })
      .then(function () { setToken(''); user = null; fire(); return true; });
  }

  function saveProfile(state, counters) {
    if (!available || !getToken()) return Promise.resolve(null);
    return call('PUT', '/api/me', { state: state, counters: counters }).catch(function () { return null; });
  }

  function setPublic(on, name) {
    if (!available || !getToken()) return Promise.resolve(null);
    var body = { public: !!on };
    if (name !== undefined && name !== null) body.name = name;
    return call('PUT', '/api/me', body).then(function (r) { user = r.user; fire(); return r; })
      .catch(function () { return null; });
  }

  // ------------------------------------------------------------------ the limit
  function lessonStart(kind) {
    if (!available || !getToken()) return Promise.resolve(null);
    return call('POST', '/api/lesson-start', { kind: kind || 'unit' })
      .catch(function () { return null; });
  }

  // ------------------------------------------------------------------ reports
  function report(payload) {
    if (!available) return Promise.resolve(null);
    return call('POST', '/api/report', payload || {}).catch(function () { return null; });
  }

  function reports(ownerKey, state) {
    if (!available) return Promise.resolve(null);
    var q = state ? ('?state=' + encodeURIComponent(state)) : '';
    return call('GET', '/api/reports' + q, null, { 'X-Owner-Key': ownerKey })
      .catch(function () { return null; });
  }

  function decide(ownerKey, id, decision, reward, note) {
    if (!available) return Promise.resolve(null);
    return call('POST', '/api/reports/decide',
      { id: id, decision: decision, reward: reward, note: note },
      { 'X-Owner-Key': ownerKey }).catch(function () { return null; });
  }

  function claim(code) {
    if (!available) return Promise.resolve(null);
    return call('POST', '/api/claim', { code: code }).catch(function () { return null; });
  }

  function pendingSubs(ownerKey) {
    if (!available) return Promise.resolve(null);
    return call('GET', '/api/owner/pending', null, { 'X-Owner-Key': ownerKey })
      .catch(function () { return null; });
  }

  function grant(ownerKey, email, months) {
    if (!available) return Promise.resolve(null);
    return call('POST', '/api/owner/grant',
      { email: email, months: months || 1 }, { 'X-Owner-Key': ownerKey })
      .catch(function () { return null; });
  }

  // ------------------------------------------------------------------ the rest
  function leaderboard() {
    if (!available) return Promise.resolve(null);
    return call('GET', '/api/leaderboard').catch(function () { return null; });
  }

  function subscription() {
    if (!available || !getToken()) return Promise.resolve(null);
    return call('GET', '/api/subscription').catch(function () { return null; });
  }

  function subscribe(email, plan, source, proof) {
    if (!available) return Promise.resolve(null);
    return call('POST', '/api/subscribe',
      { email: email || '', plan: plan || 'rejuvenator', source: source || 'boosty', proof: proof || '' })
      .catch(function () { return null; });
  }

  return {
    init: init,
    api: api,
    onChange: onChange,
    get available() { return available; },
    get config() { return config; },
    get user() { return user; },
    get ads() { return ads; },
    getToken: getToken,
    register: register,
    login: login,
    logout: logout,
    saveProfile: saveProfile,
    setPublic: setPublic,
    lessonStart: lessonStart,
    report: report,
    reports: reports,
    decide: decide,
    claim: claim,
    leaderboard: leaderboard,
    subscription: subscription,
    subscribe: subscribe,
    pendingSubs: pendingSubs,
    grant: grant,
    refreshAds: refreshAds
  };
})();
