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
    /* There is no server to talk to — the app works as a guest. The old code
       kept the address of the last candidate that did not answer, so every
       later call went to a dead address instead of saying "no server". */
    if (!base) {
      var off = new Error('no server');
      off.offline = true;
      return Promise.reject(off);
    }
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
      // the server answered with an error — it is there, it only said no
      if (e && e.status) { e.offline = false; throw e; }
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
        /* not one of them answered: the address of the last one is of no
           use to anybody */
        available = false;
        base = null;
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

  /* The progress of the account on the server. The account may have been
     played on another device, and this is the only way to learn what it
     holds — the browser has to merge it with what is here, so that neither
     life is lost. */
  function state() {
    if (!getToken()) return Promise.resolve(null);
    return call('GET', '/api/me').then(function (r) {
      if (r && r.user) { user = r.user; fire(); }
      /* The server keeps the progress inside the account: the answer of
         GET /api/me is {"ok":true,"user":{…,"state":{…}}}. Reading it from
         the top of the answer found nothing there, so the progress of an
         account played on another device never came down. The old place is
         still read as a fallback, so an older server keeps working. */
      return (r && r.user && r.user.state) || (r && r.state) || null;
    }).catch(function () { return null; });
  }

  // ------------------------------------------------------------------ accounts
  function register(email, password, name) {
    return call('POST', '/api/register', { email: email, password: password, name: name || '' })
      .then(function (r) {
        // with a mailbox on the server the account waits for the letter, and
        // there is no token yet — the code comes first
        if (r && r.token) { setToken(r.token); user = r.user; fire(); }
        return r;
      });
  }

  function verify(email, code, password) {
    return call('POST', '/api/verify', { email: email, code: code, password: password || '' })
      .then(function (r) {
        if (r && r.token) { setToken(r.token); user = r.user; fire(); }
        return r;
      });
  }

  function resendCode(email) {
    return call('POST', '/api/resend-code', { email: email });
  }

  function login(email, password) {
    return call('POST', '/api/login', { email: email, password: password })
      .then(function (r) { setToken(r.token); user = r.user; fire(); return r; });
  }

  function logout() {
    return call('POST', '/api/logout', {}).catch(function () { })
      .then(function () { setToken(''); user = null; fire(); return true; });
  }

  /* Close the account for good. The password goes with the request: the
     server does not take an account away on the word of a token alone. */
  function deleteAccount(password) {
    if (!available || !getToken()) return Promise.reject(new Error('no server'));
    return call('DELETE', '/api/me', { password: password }).then(function (r) {
      setToken('');
      user = null;
      fire();
      return r;
    });
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
    if (!available) return Promise.reject(new Error('no server'));
    /* The answer of the server is not swallowed: a player whose code is
       locked out by too many wrong guesses must not be told that the code
       is dead. */
    return call('POST', '/api/claim', { code: code });
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
    if (!available) return Promise.reject(new Error('no server'));
    /* The answer of the server is not swallowed: a player who paid and
       asks for the code must not be told that the server is down when it
       is the account that is missing. */
    return call('POST', '/api/subscribe',
      { email: email || '', plan: plan || 'rejuvenator', source: source || 'boosty', proof: proof || '' });
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
    verify: verify,
    resendCode: resendCode,
    login: login,
    logout: logout,
    deleteAccount: deleteAccount,
    saveProfile: saveProfile,
    state: state,
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
