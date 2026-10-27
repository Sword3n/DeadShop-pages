/* DeadShop accounts — local-only profiles.
   There is no server: a profile is a name + a salted password hash stored in
   localStorage on this device. Passwords are hashed with SHA-256 (pure JS, so
   it also works on a plain-http LAN address where crypto.subtle is missing)
   and stretched with PBKDF2-style iterations. This is obfuscation for a local
   prototype, not a substitute for server-side auth. */
window.DSA = (function () {
  'use strict';

  var USERS_KEY = 'deadshop-users-v1';
  var SESSION_KEY = 'deadshop-session-v1';

  /* The self-test runs against its own keys, so opening the test page can
     never wipe the profiles that live on this device. */
  function setStore(suffix) {
    USERS_KEY = 'deadshop-users-v1' + (suffix || '');
    SESSION_KEY = 'deadshop-session-v1' + (suffix || '');
  }

  /* ---------------- SHA-256 (pure JS) ---------------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        out.push(240 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63), 128 | (c2 & 63));
        i++;
      } else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }

  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length;
    var bitLen = l * 8;
    var msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (var i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    var w = new Array(64);
    for (var b = 0; b < msg.length; b += 64) {
      for (i = 0; i < 16; i++) {
        w[i] = (msg[b + i * 4] << 24) | (msg[b + i * 4 + 1] << 16) | (msg[b + i * 4 + 2] << 8) | msg[b + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) {
      out.push((H[i] >>> 24) & 0xff, (H[i] >>> 16) & 0xff, (H[i] >>> 8) & 0xff, H[i] & 0xff);
    }
    return out;
  }
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  var ITER = 20000;
  function hashPassword(pwd, salt) {
    var bytes = utf8Bytes(salt + '|' + pwd);
    var digest = sha256(bytes);
    for (var i = 0; i < ITER; i++) {
      digest = sha256(digest.concat(utf8Bytes(salt + i)));
    }
    return hex(digest);
  }

  function makeSalt() {
    var a = new Uint8Array(16);
    try {
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
      else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    } catch (e) { for (var j = 0; j < 16; j++) a[j] = Math.floor(Math.random() * 256); }
    return hex(Array.prototype.slice.call(a));
  }

  /* ---------------- profile store ---------------- */
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeUsers(u) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); return true; }
    catch (e) { return false; }
  }

  function normalise(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  }
  function validName(name) {
    if (!name) return 'Pick a name.';
    if (name.length < 2) return 'Name is too short.';
    if (name.length > 20) return 'Name is too long.';
    if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) return 'Use letters, numbers, spaces, . _ - \' only.';
    return null;
  }
  function validPassword(pw) {
    if (!pw || pw.length < 4) return 'Password needs at least 4 characters.';
    if (pw.length > 64) return 'Password is too long.';
    return null;
  }

  function listUsers() {
    var u = readUsers(), out = [];
    Object.keys(u).forEach(function (n) {
      var r = u[n];
      out.push({
        name: n,
        display: displayOf(r, n),
        email: r.email || null,
        kind: r.email ? 'email' : 'name',
        verified: r.email ? !!r.verified : true,
        created: r.created
      });
    });
    return out;
  }
  function exists(name) { return !!readUsers()[normalise(name)]; }

  /* ---------------- email accounts ----------------
     There is still no server: an email account is a record in the same local
     store, keyed by the address itself. "Verification" means the person
     proves they own the address by entering a code — a real deployment would
     mail that code out, here the app shows it because it cannot send mail. */
  function normaliseEmail(e) { return String(e || '').trim().toLowerCase(); }
  function validEmail(e) {
    var s = String(e || '').trim();
    if (!s) return 'Enter your email address.';
    if (s.length > 120) return 'That email is too long.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'That does not look like an email address.';
    return null;
  }
  function displayOf(rec, key) {
    if (rec && rec.display) return rec.display;
    if (rec && rec.email) return rec.email.split('@')[0];
    return key;
  }
  function findByEmail(email) {
    var u = readUsers(), key = normaliseEmail(email), found = null;
    Object.keys(u).forEach(function (n) {
      if (found) return;
      if (u[n].email && normaliseEmail(u[n].email) === key) found = n;
    });
    return found;
  }
  function makeCode() {
    var a = new Uint32Array(1), s = '';
    try {
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
      else a[0] = Math.floor(Math.random() * 4294967295);
    } catch (e) { a[0] = Math.floor(Math.random() * 4294967295); }
    s = String(a[0] % 1000000);
    while (s.length < 6) s = '0' + s;
    return s;
  }
  var CODE_TTL = 15 * 60 * 1000;
  function codeFresh(rec) {
    return rec && rec.code && rec.codeAt && (Date.now() - rec.codeAt) < CODE_TTL;
  }
  function signUpEmail(email, pw, display) {
    var err = validEmail(email);
    if (err) return { ok: false, error: err };
    email = normaliseEmail(email);
    var u = readUsers();
    if (findByEmail(email)) return { ok: false, error: 'That email already has a profile on this device.' };
    var name = normalise(display) || email.split('@')[0] || 'Player';
    if (u[name]) name = email;            // the display name is taken — key by email
    var salt = makeSalt(), code = makeCode();
    u[name] = {
      kind: 'email', email: email, display: displayOf({ display: normalise(display) }, name),
      salt: salt, hash: hashPassword(pw, salt), created: Date.now(),
      verified: false, code: code, codeAt: Date.now()
    };
    if (!writeUsers(u)) {
      return { ok: false, error: 'This browser is not saving anything, so a profile cannot be stored here.' };
    }
    return { ok: true, name: name, code: code, email: email };
  }
  function verifyAccount(email, code) {
    var name = findByEmail(email);
    if (!name) return { ok: false, error: 'No profile for that email on this device.' };
    var u = readUsers(), rec = u[name];
    if (!codeFresh(rec)) return { ok: false, error: 'That code has expired. Send a new one.' };
    if (String(code || '').trim() !== rec.code) return { ok: false, error: 'Wrong code.' };
    rec.verified = true;
    delete rec.code; delete rec.codeAt;
    u[name] = rec;
    writeUsers(u);
    return { ok: true, name: name };
  }
  function resendCode(email) {
    var name = findByEmail(email);
    if (!name) return { ok: false, error: 'No profile for that email on this device.' };
    var u = readUsers(), rec = u[name], code = makeCode();
    rec.code = code; rec.codeAt = Date.now();
    u[name] = rec;
    writeUsers(u);
    return { ok: true, name: name, code: code };
  }
  function signInEmail(email, pw) {
    var name = findByEmail(email);
    if (!name) return { ok: false, error: 'No profile with that email on this device.' };
    var rec = readUsers()[name];
    if (hashPassword(pw, rec.salt) !== rec.hash) return { ok: false, error: 'Wrong password.' };
    if (!rec.verified) return { ok: false, error: 'This email is not confirmed yet.', needCode: true };
    return { ok: true, name: name };
  }
  function requestReset(email) {
    var name = findByEmail(email);
    if (!name) return { ok: false, error: 'No profile with that email on this device.' };
    var u = readUsers(), rec = u[name], code = makeCode();
    rec.code = code; rec.codeAt = Date.now();
    u[name] = rec;
    writeUsers(u);
    return { ok: true, name: name, code: code };
  }
  function resetPassword(email, code, pw) {
    var name = findByEmail(email);
    if (!name) return { ok: false, error: 'No profile for that email on this device.' };
    var u = readUsers(), rec = u[name];
    if (!codeFresh(rec)) return { ok: false, error: 'That code has expired. Ask for a new one.' };
    if (String(code || '').trim() !== rec.code) return { ok: false, error: 'Wrong code.' };
    var perr = validPassword(pw);
    if (perr) return { ok: false, error: perr };
    rec.salt = makeSalt();
    rec.hash = hashPassword(pw, rec.salt);
    rec.verified = true;
    delete rec.code; delete rec.codeAt;
    u[name] = rec;
    writeUsers(u);
    return { ok: true, name: name };
  }
  function changePassword(name, oldPw, newPw) {
    var u = readUsers(), rec = u[normalise(name)];
    if (!rec) return { ok: false, error: 'No such profile.' };
    if (hashPassword(oldPw, rec.salt) !== rec.hash) return { ok: false, error: 'Wrong password.' };
    var perr = validPassword(newPw);
    if (perr) return { ok: false, error: perr };
    rec.salt = makeSalt();
    rec.hash = hashPassword(newPw, rec.salt);
    u[normalise(name)] = rec;
    writeUsers(u);
    return { ok: true };
  }
  function setDisplay(name, display) {
    var u = readUsers(), key = normalise(name), rec = u[key];
    if (!rec) return { ok: false, error: 'No such profile.' };
    rec.display = normalise(display) || displayOf(rec, key);
    u[key] = rec;
    writeUsers(u);
    return { ok: true, display: rec.display };
  }
  function emailOf(name) {
    var rec = readUsers()[normalise(name)];
    return rec && rec.email ? rec.email : null;
  }
  function displayName(name) {
    var key = normalise(name), rec = readUsers()[key];
    return rec ? displayOf(rec, key) : key;
  }
  function signUp(name, pw) {
    name = normalise(name);
    var u = readUsers();
    if (u[name]) return { ok: false, error: 'That name is taken on this device.' };
    var salt = makeSalt();
    u[name] = { kind: 'name', salt: salt, hash: hashPassword(pw, salt), created: Date.now() };
    if (!writeUsers(u)) {
      return { ok: false, error: 'This browser is not saving anything, so a profile cannot be stored here.' };
    }
    return { ok: true, name: name };
  }
  function signIn(name, pw) {
    name = normalise(name);
    var rec = readUsers()[name];
    if (!rec) return { ok: false, error: 'No profile with that name on this device.' };
    if (hashPassword(pw, rec.salt) !== rec.hash) return { ok: false, error: 'Wrong password.' };
    return { ok: true, name: name };
  }
  function removeUser(name) {
    var u = readUsers(); delete u[normalise(name)]; writeUsers(u);
  }

  /* ---------------- session ---------------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(name) {
    try {
      if (name) localStorage.setItem(SESSION_KEY, JSON.stringify({ name: name, at: Date.now() }));
      else localStorage.removeItem(SESSION_KEY);
      return true;
    } catch (e) { return false; }
  }

  return {
    normalise: normalise, validName: validName, validPassword: validPassword,
    listUsers: listUsers, exists: exists, signUp: signUp, signIn: signIn, removeUser: removeUser,
    getSession: getSession, setSession: setSession, setStore: setStore,
    hashPassword: hashPassword, makeSalt: makeSalt,
    // email accounts
    normaliseEmail: normaliseEmail, validEmail: validEmail, findByEmail: findByEmail,
    signUpEmail: signUpEmail, verifyAccount: verifyAccount, resendCode: resendCode,
    signInEmail: signInEmail, requestReset: requestReset, resetPassword: resetPassword,
    changePassword: changePassword, setDisplay: setDisplay, emailOf: emailOf,
    displayName: displayName, makeCode: makeCode
  };
})();
