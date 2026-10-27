/* DeadShop — app logic
   Path of 64 generated lessons · spaced repetition per item · local profiles */
(function () {
  'use strict';

  var DS = window.DS;
  var DSC = window.DSC;
  var DSA = window.DSA;
  DSC.setItems(DS.items);

  /* Where a profile lives. The suffix is the storage format: bump it and
     every device starts from a clean profile, and the old entries are
     removed on the first load. */
  var PROFILE_PREFIX = 'deadshop-profile-v2:';
  var OLD_PROFILE_PREFIXES = ['deadshop-profile-v1:'];
  var GUEST = 'guest';

  // the progress of the old format is deleted, not just forgotten
  function wipeOldProfiles() {
    try {
      var dead = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        for (var j = 0; j < OLD_PROFILE_PREFIXES.length; j++) {
          if (k.indexOf(OLD_PROFILE_PREFIXES[j]) === 0) { dead.push(k); break; }
        }
      }
      dead.forEach(function (k) { localStorage.removeItem(k); });
      if (dead.length) return dead.length;
    } catch (e) { }
    return 0;
  }

  // the real lesson ids, used to sanity-check what we read back from storage
  var UNIT_IDS = {};
  (DS.units || []).forEach(function (u) { UNIT_IDS[u.id] = 1; });

  // ---------------------------------------------------------------- utils
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // el() puts its third argument in as TEXT, so a name that came from the
  // game API can never become markup. elHTML() is the explicit opt-in for
  // the few places that really do want markup.
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function elHTML(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function setText(sel, txt) { var n = $(sel); if (n) n.textContent = txt; }

  // ---- the owl ---------------------------------------------------------
  // Grey Talon's owl reacts to how the run went: amber for a good run,
  // teal for a perfect one, plain for a rough one.
  function mascotMood(mood) {
    var card = $('#result-card');
    if (!card) return;
    card.classList.remove('good', 'perfect');
    if (mood) card.classList.add(mood);
    var owl = card.querySelector('.result-owl');
    if (owl) {
      // restart the swoop so it plays again on every result screen
      owl.style.animation = 'none';
      void owl.getBoundingClientRect();
      owl.style.animation = '';
    }
  }

  // A line of advice from the owl. It stays put for the whole day — the
  // owl's counsel of the day — and a tap on it pulls the next one out.
  var OWL_TIPS = [
    'Tier 4 items upgrade into other Tier 4 items. Learn the chain, not just the numbers.',
    'A wrong answer costs you a soul. The hint costs you half the XP but keeps the streak.',
    'Bullet Speed is a raw number. Everything in per cent is a percentage of your weapon.',
    'The owl has seen every shopkeeper patch these cards. Numbers first, opinions later.',
    'Upgrade chains are direct only: one item feeds one item, never two steps at once.',
    'Spirit Power is spent, not stacked. Health and Spirit Resist never scale the same way.',
    'Twenty questions a day beats one hundred on Sunday. The streak is the point.',
    'If two items look equal, the cheaper one is the better buy until the data says otherwise.'
  ];
  function owlTip(advance) {
    var node = $('#owl-tip-text');
    if (!node) return;
    var day = today();
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem('deadshop-tips-v1') || '{}'); } catch (e) { seen = {}; }
    var idx;
    if (typeof seen.i !== 'number' || seen.day !== day) {
      idx = Math.floor(Math.random() * OWL_TIPS.length);
    } else {
      idx = advance ? (seen.i + 1) % OWL_TIPS.length : seen.i;
    }
    try { localStorage.setItem('deadshop-tips-v1', JSON.stringify({ day: day, i: idx })); } catch (e) {}
    node.textContent = OWL_TIPS[idx];
  }
  // local calendar day, not UTC — a streak must not roll over at 00:00 GMT
  function dayKey(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function today() { return dayKey(new Date()); }
  function yesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function decorate(html) { return DSC.decorate(html); }

  // ------------------------------------------------------------- profiles
  function profileName() {
    var s = DSA.getSession();
    return s && s.name ? s.name : null;
  }
  function storageKey() { return PROFILE_PREFIX + (profileName() || GUEST); }

  var DEFAULTS = {
    xp: 0, streak: 0, lastDay: null, dailyDay: null, mastery: {}, right: 0, wrong: 0,
    lessons: 0, unitsDone: [], unlocked: {}, seen: {}, onboarded: false, paused: null,
    display: '', avatar: '', todayCount: 0, todayDay: null, history: {},
    souls: 0, soulsEarned: 0, soulsLedger: [], cosmetics: [], equipped: {},
    gate: null,
    bughunt: { reports: [], inbox: [], grants: [] },
    settings: { theme: 'auto', sound: true, haptics: true, motion: false, goal: 12 }
  };

  var S = load(storageKey());

  function load(key) {
    var d = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var p = JSON.parse(raw);
        for (var k in d) if (p[k] !== undefined && p[k] !== null) d[k] = p[k];
        d.settings = Object.assign({}, DEFAULTS.settings, p.settings || {});
        d.unitsDone = (p.unitsDone || []).filter(function (id) {
          return !!UNIT_IDS[id];   // drop anything that is not a real lesson
        });
        d.unlocked = p.unlocked || {};
        d.seen = p.seen || {};
        d.paused = p.paused || null;
        d.mastery = p.mastery || {};
      }
    } catch (e) { }
    return d;
  }
  function save() {
    try { localStorage.setItem(storageKey(), JSON.stringify(S)); } catch (e) { }
  }
  function reloadProfile() {
    S = load(storageKey());
    applySettings();
    renderAll();
  }

  function mst(slug) {
    if (!S.mastery[slug]) S.mastery[slug] = { box: 0, right: 0, wrong: 0 };
    return S.mastery[slug];
  }
  function boxOf(slug) { return (S.mastery[slug] && S.mastery[slug].box) || 0; }

  // ------------------------------------------------------------- settings
  function applySettings() {
    var t = S.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.toggle('reduce-motion', !!S.settings.motion);
    $$('#theme-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.theme === t);
    });
    var st = $('#sound-toggle'), ht = $('#haptic-toggle'), mt = $('#motion-toggle');
    if (st) st.classList.toggle('on', !!S.settings.sound);
    if (ht) ht.classList.toggle('on', !!S.settings.haptics);
    if (mt) mt.classList.toggle('on', !!S.settings.motion);
  }

  // -------------------------------------------------------------- sounds
  /* Deadlock's interface is metal and steam: a bright ping when an answer
     is right, a dull knock when it is not, and a ring of pipes when the run
     is over. Everything is synthesised in the browser — no files to load,
     nothing to fetch, works offline. */
  var AC = null;
  var audioPrimed = false;
  function audioCtx() {
    if (AC) return AC;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
    return AC;
  }
  function audio() {
    if (!S.settings.sound) return null;
    var c = audioCtx();
    if (!c) return null;
    if (c.state !== 'running') { try { c.resume(); } catch (e) { } }
    return c;
  }
  function env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  /* one voice: a tone with an optional slide down */
  function ping(freq, t, dur, peak, type, slide) {
    var c = audio();
    if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    env(g, t, peak || 0.1, dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  /* a filtered burst of noise: the click of a switch, the hiss of steam */
  function hiss(t, dur, peak, freq, q) {
    var c = audio();
    if (!c) return;
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq || 2400; bp.Q.value = q || 1.1;
    var g = c.createGain(); g.gain.value = peak || 0.05;
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t);
  }
  /* One silent HTML5 clip inside the first touch. On iOS this moves the page
     onto the playback channel, so the effects are heard even with the phone
     on silent — forty milliseconds of nothing, at volume zero. */
  var silentEl = null;
  function silentClip() {
    if (silentEl !== null) return silentEl;
    silentEl = false;
    try {
      var rate = 8000, n = Math.floor(rate * 0.04);
      var bytes = new Uint8Array(44 + n * 2);
      var v = new DataView(bytes.buffer);
      var tag = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      tag(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      tag(36, 'data'); v.setUint32(40, n * 2, true);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      var el = new Audio('data:audio/wav;base64,' + btoa(bin));
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.volume = 0;
      silentEl = el;
    } catch (e) { silentEl = false; }
    return silentEl;
  }
  function primeChannel() {
    var el = silentClip();
    if (!el) return;
    try {
      var p = el.play();
      if (p && p.then) {
        p.then(function () {
          setTimeout(function () { try { el.pause(); el.currentTime = 0; } catch (e) { } }, 80);
        }).catch(function () { });
      }
    } catch (e) { }
  }

  /* The door that opens on the first touch — and the three ways a phone can
     still stay silent afterwards.
       1. iOS only lets an AudioContext sound once the page has been touched,
          and only if the resume() happens inside that gesture with one real
          sound started there.
       2. Safari treats an AudioContext as "ambient": the ring/silent switch
          mutes it even while the context reports "running". Safari 18.4 can
          be asked for the playback channel instead; older builds can be
          nudged onto the same channel by playing one silent HTML5 clip.
       3. The context is suspended again after a call or another app, so
          every gesture resumes it and the tab wakes it up on return.
     The profile also has a TEST button, so a phone that is simply on silent
     is easy to tell from a broken one. */
  function unlockAudio() {
    if (!S.settings.sound) return;
    // Safari 18.4+: ask for the playback channel so the silent switch cannot mute us
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (e) { }
    var c = audioCtx();
    if (!c) return;
    if (c.state !== 'running') {
      try { c.resume(); } catch (e) { }
      // WebKit wants a real sound started inside the gesture, not just a resume
      try {
        var buf = c.createBuffer(1, 1, 22050);
        var src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start(0);
      } catch (e) { }
    }
    if (!audioPrimed) { audioPrimed = true; primeChannel(); }
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, unlockAudio, { passive: true });
  });
  /* The tab comes back suspended — a call, another app, a locked screen. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (!audioPrimed) { unlockAudio(); return; }
    var c = audioCtx();
    if (c && c.state !== 'running') { try { c.resume(); } catch (e) { } }
  });

  /* right: a bright metal ping with a ring on top */
  var sfxOk = function () {
    var c = audio(); if (!c) return;
    var t = c.currentTime;
    ping(784, t, 0.24, 0.10, 'triangle');
    ping(1568, t + 0.015, 0.20, 0.045, 'sine');
    hiss(t, 0.05, 0.03, 3400, 2.2);
  };
  /* wrong: a dull knock that falls away */
  var sfxNo = function () {
    var c = audio(); if (!c) return;
    var t = c.currentTime;
    ping(200, t, 0.30, 0.13, 'triangle', 0.5);
    hiss(t, 0.14, 0.05, 380, 0.8);
  };
  /* finished: pipes rising over a low hum */
  var sfxDone = function () {
    var c = audio(); if (!c) return;
    var t = c.currentTime;
    [392, 523, 659, 784].forEach(function (f, i) {
      ping(f, t + i * 0.075, 0.32, 0.085, 'triangle');
      ping(f * 2, t + i * 0.075, 0.18, 0.025, 'sine');
    });
    ping(98, t, 0.55, 0.11, 'sine');
  };
  /* a door opening: a clank and a rising ring */
  var sfxUnlock = function () {
    var c = audio(); if (!c) return;
    var t = c.currentTime;
    hiss(t, 0.12, 0.05, 1400, 1.4);
    [523, 784, 1046].forEach(function (f, i) {
      ping(f, t + 0.05 + i * 0.07, 0.34, 0.085, 'triangle');
    });
  };
  function buzz(ms) { try { if (S.settings.haptics && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

  // ------------------------------------------------------------- motion
  /* The counters roll up instead of jumping, the chips bounce when a number
     changes, and short toasts announce level ups. All of it is skipped when
     the player asked for less motion. */
  function still() { return !!S.settings.motion; }

  function animateNumber(node, to, dur) {
    if (!node) return;
    // an old tween would keep writing over the new value
    stopTween(node);
    var from = parseFloat(String(node.textContent).replace(/[^0-9.\-]/g, '')) || 0;
    if (!isFinite(to)) to = 0;
    if (from === to || still() || typeof requestAnimationFrame !== 'function') {
      node.textContent = String(to);
      return;
    }
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    dur = dur || 450;
    function step(t) {
      var k = (t - t0) / dur;
      // the first frame can carry a timestamp from before t0
      if (!(k > 0)) k = 0;
      if (k > 1) k = 1;
      var e = 1 - Math.pow(1 - k, 3);
      node.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) node._dsTween = requestAnimationFrame(step);
    }
    node._dsTween = requestAnimationFrame(step);
    // a safety net: if the page never paints a frame (background tab, headless
    // run) the counter still lands on the right number
    node._dsTweenEnd = setTimeout(function () {
      try { cancelAnimationFrame(node._dsTween); } catch (e) { }
      node._dsTween = null;
      node.textContent = String(to);
    }, dur + 80);
  }

  // stop a running counter tween, so nothing writes over the value that is
  // about to be set
  function stopTween(node) {
    if (!node) return;
    if (node._dsTween) { try { cancelAnimationFrame(node._dsTween); } catch (e) { } node._dsTween = null; }
    if (node._dsTweenEnd) { clearTimeout(node._dsTweenEnd); node._dsTweenEnd = null; }
  }

  function bump(node) {
    if (!node || still()) return;
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }

  var toastTimer = null;
  function toast(msg, markup) {
    var t = $('#toast');
    if (!t) return;
    if (markup) t.innerHTML = msg; else t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  // ------------------------------------------------------------- support
  /* Everything a tester might want to tell us, in one block they can copy.
     This is the only place that knows where feedback goes. */
  var APP_VERSION = '0.10.1';
  var BUILD_DATE = '2026-10-26';
  // Where "report a problem" goes. Two options, both need no server:
  //   ISSUES_URL  a GitHub issue with the diagnostics already filled in
  //   SUPPORT_EMAIL  a mailbox (mailto:). Leave it empty to skip it.
  // Both must point at the *site* repository before the site goes public —
  // see LAUNCH.md §3.1.
  var ISSUES_URL = 'https://github.com/Sword3n/DeadShop-site/issues/new';
  var SUPPORT_EMAIL = '';

  var WHATS_NEW = [
    ['Side menu', 'One column of collapsible modules — Learn, Reference, You. It stands next to the app on a desktop and slides in on a phone.'],
    ['Your mistakes hold the door', 'Finish a lesson with a wrong answer and the next one stays shut until you get it right. The drill asks exactly what you missed.'],
    ['The full recall says which row is which', 'Two rows can share a name. The card now groups them by the block they sit in and tells them apart.'],
    ['Souls', 'The shop pays you back: a lesson is worth souls, a flawless one more. Spend them on the colour of the shop, the owl\'s aura and the avatar frame.'],
    ['A blue flame', 'The streak flame is blue now. Cold light, like the spirit side of the game.'],
    ['A level badge', 'The star was only ever XP. Now the top bar shows your level, in a badge like the one in the game.'],
    ['Bughunt', 'Found a bug? Send a report. A report we can act on earns souls — the reward code comes back the same way.'],
    ['Latest update', 'What was buffed, what was nerfed and by how much — checked against the live shop, not a guess.'],
    ['New sounds', 'A metal ping, a dull knock, pipes when the run is over. All synthesised in the browser.'],
    ['Sound that a phone keeps', 'The silent switch cannot mute the game any more, and the profile shows the real audio state next to a TEST button.'],
    ['Deadlock skin', 'Cut-corner panels, teal energy and amber souls, uppercase display type.'],
    ['Grey Talon\'s owl', 'It sits on the path screen, gives you a tip for the day and swoops in when a lesson ends.'],
    ['Questions appear at once', 'No entrance animation and no hidden card — the question is on screen the moment it is asked.'],
    ['Exam mode', 'Ten mixed questions from the whole shop. It only measures: your streak and XP are never touched.'],
    ['Stats', 'A week chart, progress per group, and a list of the items that still need review.'],
    ['Item browser', 'Search, filter by slot, tier or "not studied", and open any item.'],
    ['Hints', 'Press H on a number question for half the XP and the answer you were missing.'],
    ['Email accounts', 'Sign up with an email and a confirmation code. Everything still stays on your device.']
  ];

  function diagnostics() {
    var meta = (window.DS && DS.meta) || {};
    var ua = navigator.userAgent;
    var browser = 'unknown browser';
    var m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/([\d.]+)/);
    if (m) browser = m[1] + ' ' + m[2].split('.')[0];
    var os = 'unknown OS';
    if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    var learned = 0, weak = 0;
    Object.keys(S.mastery || {}).forEach(function (k) {
      var b = (S.mastery[k] && S.mastery[k].box) || 0;
      if (b >= 3) learned++;
      if (b === 1 || b === 2) weak++;
    });
    var size = 0;
    try { size = (localStorage.getItem(storageKey()) || '').length; } catch (e) { }
    return [
      'DeadShop ' + APP_VERSION + ' (build ' + BUILD_DATE + ')',
      'data snapshot: ' + (meta.snapshot || '?') + ' · ' + (meta.items || '?') + ' items · ' +
        (meta.units || '?') + ' lessons · ' + (meta.questions || '?') + ' questions',
      'device: ' + browser + ' on ' + os + ' · screen ' + window.innerWidth + '×' + window.innerHeight,
      'profile: ' + (profileName() || 'guest') + ' · ' + S.xp + ' XP · ' + S.streak + ' day streak · ' +
        S.right + ' right / ' + S.wrong + ' wrong · ' + S.lessons + ' lessons',
      'mastery: ' + learned + ' learned · ' + weak + ' still weak',
      'audio: ' + (!S.settings.sound ? 'off' : (AC ? AC.state : 'not started')) +
        ' · channel ' + ((navigator.audioSession && navigator.audioSession.type) || 'n/a'),
      'stored profile: ' + (Math.round(size / 102.4) / 10) + ' KB in this browser'
    ].join('\n');
  }

  /* The old one-click report. It lives on inside Bughunt now: the fast
     lane is the report code, the tracker is the record. */
  function reportToTracker(body, title) {
    // a real mailbox wins if one is configured; otherwise the issue tracker
    if (SUPPORT_EMAIL) {
      window.location.href = 'mailto:' + SUPPORT_EMAIL +
        '?subject=' + encodeURIComponent(title || 'DeadShop problem') +
        '&body=' + encodeURIComponent(body);
      return;
    }
    if (ISSUES_URL) {
      window.open(ISSUES_URL + '?title=' + encodeURIComponent(title || 'Bug: ') +
        '&body=' + encodeURIComponent(body), '_blank', 'noopener');
      return;
    }
    copyText(body, 'Copied — send it to whoever runs DeadShop');
  }

  function copyText(text, message) {
    var msg = message || 'Copied';
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(msg); }
      catch (e) { toast('Could not copy — select the text manually'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(msg);
      }, fallback);
    } else fallback();
  }

  function showWhatsNew() {
    var box = $('#whatsnew-list');
    if (!box) return;
    box.innerHTML = '';
    WHATS_NEW.forEach(function (row) {
      var item = el('div', 'wn-item');
      item.appendChild(el('div', 'wn-title', row[0]));
      item.appendChild(el('div', 'wn-note', row[1]));
      box.appendChild(item);
    });
    var m = $('#whatsnew-modal');
    if (m) m.classList.add('on');
  }

  /* a little "+10" that floats up from the button you just pressed */
  function floatXP(host, text) {
    if (!host || still()) return;
    var f = el('div', 'float-xp', text);
    f.style.left = (38 + Math.random() * 24) + '%';
    host.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 950);
  }

  // ------------------------------------------------------------- screens
  var current = 'path';
  function show(name) {
    $$('.screen').forEach(function (s) { s.classList.remove('on'); });
    var node = $('#screen-' + name);
    if (node) node.classList.add('on');
    current = name;
    if (name === 'path') renderPath();
    if (name === 'items') {
      // a stale filter would hide items the user thinks are missing
      var search = $('#item-search');
      if (search && search.value) search.value = '';
      renderItems();
    }
    if (name === 'stats') renderStats();
    if (name === 'profile') renderProfile();
    if (name === 'updates') renderUpdates();
    if (name === 'bughunt') renderBughunt();
    syncNavActive(name);
  }
  var lastXp = null, lastStreak = null, lastLeague = null;
  function renderCounters() {
    var xp = S.xp, st = S.streak, lg = league();
    setText('#nav-xp', xp);
    setText('#nav-streak', st);
    // the number is written in one place only: a tween that is still running
    // must be stopped first, otherwise it overwrites the new value and the
    // counter counts up twice
    if (lastXp === null || xp === lastXp) { stopTween($('#xp-val')); setText('#xp-val', xp); }
    else { animateNumber($('#xp-val'), xp); bump($('#xp-val').parentNode); }
    if (lastStreak === null || st === lastStreak) { stopTween($('#streak-val')); setText('#streak-val', st); }
    else {
      animateNumber($('#streak-val'), st);
      bump($('#streak-val').parentNode);
      if (st > lastStreak) toast('<img class="toast-flame" src="assets/flame.svg" alt=""> ' + st + ' day streak', true);
    }
    setText('#league-val', lg);
    if (lastLeague && lg !== lastLeague) {
      toast('⬆ ' + lg);
      sfxDone();
    }
    // the level badge: the number in the plate, the ring around it
    var info = leagueInfo();
    var badge = $('#level-badge');
    if (badge) badge.innerHTML = levelBadge(info);
    var chip = $('#level-chip');
    if (chip) {
      chip.title = 'Level ' + info.level + ' — ' + info.xp + ' XP' +
        (info.nextName ? '. ' + (info.next - info.xp) + ' XP to ' + info.nextName : '. Top league');
    }
    var chip = $('#streak-chip');
    if (chip) chip.classList.toggle('hot', st >= 3);
    lastXp = xp; lastStreak = st; lastLeague = lg;
    renderSouls();
  }
  function renderAll() {
    renderCounters();
    renderPath(); renderStats(); renderProfile();
  }

  /* the tab bar lives on the path screen — keep it in sync when we come back */
  function setActiveTab(name) {
    $$('.tab').forEach(function (x) { x.classList.toggle('active', x.dataset.tab === name); });
  }

  // ------------------------------------------------------------ side menu
  /* One column of collapsible modules. Which module is open is remembered,
     the menu slides in on a phone and stands next to the app on a desktop.
     The bottom tab bar stays on a phone, so nothing that was one tap away
     became two. */
  var NAV_KEY = 'deadshop-nav-v1';
  var NAV_OPEN = { learn: true, reference: false, you: false };

  function loadNavState() {
    try {
      var raw = JSON.parse(localStorage.getItem(NAV_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        Object.keys(NAV_OPEN).forEach(function (k) {
          if (typeof raw[k] === 'boolean') NAV_OPEN[k] = raw[k];
        });
      }
    } catch (e) { }
  }
  function saveNavState() {
    try { localStorage.setItem(NAV_KEY, JSON.stringify(NAV_OPEN)); } catch (e) { }
  }
  function applyNavState() {
    $$('.nav-group').forEach(function (g) {
      var key = g.dataset.group;
      var open = NAV_OPEN[key] !== false;
      g.classList.toggle('open', open);
      var head = g.querySelector('.nav-head');
      if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // what each entry does
  var NAV_ROUTES = {
    path: function () { setActiveTab('path'); show('path'); },
    daily: function () { setActiveTab('path'); show('path'); setTimeout(startDaily, 60); },
    exam: function () { setActiveTab('path'); show('path'); setTimeout(startExam, 60); },
    items: function () { setActiveTab('items'); show('items'); },
    stats: function () { setActiveTab('stats'); show('stats'); },
    profile: function () { show('profile'); },
    updates: function () { show('updates'); },
    bughunt: function () { show('bughunt'); },
    help: function () {
      show('profile');
      setTimeout(function () {
        var h = $('#profile-help');
        if (h) h.scrollIntoView({ block: 'center' });
      }, 140);
    },
    whatsnew: function () { showWhatsNew(); }
  };

  // the entry of the screen you are on is the lit one
  function syncNavActive(screen) {
    var map = {
      path: 'path', items: 'items', stats: 'stats',
      profile: 'profile', updates: 'updates', bughunt: 'bughunt'
    };
    $$('.nav-item').forEach(function (it) {
      it.classList.toggle('on', !!map[screen] && map[screen] === it.dataset.go);
    });
  }

  function navOpen() {
    var n = $('#side-nav');
    if (!n) return;
    n.classList.add('on');
    var sc = $('#nav-scrim');
    if (sc) sc.classList.add('on');
    document.body.classList.add('nav-locked');
  }
  function navClose() {
    var n = $('#side-nav');
    if (n) n.classList.remove('on');
    var sc = $('#nav-scrim');
    if (sc) sc.classList.remove('on');
    document.body.classList.remove('nav-locked');
  }
  function navToggle() {
    var n = $('#side-nav');
    if (!n) return;
    if (n.classList.contains('on')) navClose(); else navOpen();
  }

  function wireNav() {
    loadNavState();
    applyNavState();

    // the menu button goes in every top bar
    $$('.topbar').forEach(function (bar) {
      if (bar.querySelector('.nav-toggle')) return;
      var b = el('button', 'icon-btn nav-toggle');
      b.type = 'button';
      b.setAttribute('aria-label', 'Menu');
      b.innerHTML = '<svg viewBox="0 0 24 24" class="ico ico-line"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
      b.addEventListener('click', navToggle);
      bar.insertBefore(b, bar.firstChild);
    });

    $$('.nav-group').forEach(function (g) {
      var head = g.querySelector('.nav-head');
      if (!head) return;
      head.addEventListener('click', function () {
        var key = g.dataset.group;
        NAV_OPEN[key] = !g.classList.contains('open');
        applyNavState();
        saveNavState();
      });
    });

    $$('.nav-item').forEach(function (it) {
      it.addEventListener('click', function () {
        var go = it.dataset.go;
        var fn = NAV_ROUTES[go];
        if (!fn) return;
        // the group of the entry we jumped to opens itself
        var group = it.closest ? it.closest('.nav-group') : null;
        if (group) {
          NAV_OPEN[group.dataset.group] = true;
          applyNavState();
          saveNavState();
        }
        fn();
        navClose();
      });
    });

    var scrim = $('#nav-scrim');
    if (scrim) scrim.addEventListener('click', navClose);
    var close = $('#nav-close');
    if (close) close.addEventListener('click', navClose);
  }

  // ------------------------------------------------------------- path UI
  var activeGroup = null;
  var pathAnimated = false;

  function renderPath() {
    renderCounters();
    owlTip();

    // a paused lesson waits on the path until you want it back
    var rc = $('#resume-card');
    if (S.paused && S.paused.qs && S.paused.qs.length) {
      var punit = null;
      for (var pi = 0; pi < DS.units.length; pi++) if (DS.units[pi].id === S.paused.unit) punit = DS.units[pi];
      rc.hidden = false;
      setText('#resume-sub', punit
        ? punit.title + ' — question ' + ((S.paused.i || 0) + 1) + ' of ' + S.paused.qs.length
        : 'Pick up where you left off.');
    } else {
      rc.hidden = true;
    }

    // group filter chips
    var chips = $('#group-chips');
    chips.innerHTML = '';
    var groups = DS.groups;
    var all = el('button', 'gchip' + (activeGroup === null ? ' on' : ''), 'All');
    all.addEventListener('click', function () { activeGroup = null; renderPath(); });
    chips.appendChild(all);
    groups.forEach(function (g) {
      var b = el('button', 'gchip' + (activeGroup === g ? ' on' : ''), g);
      b.addEventListener('click', function () {
        activeGroup = activeGroup === g ? null : g;
        if (activeGroup) unlockGroup(activeGroup);
        renderPath();
        setTimeout(function () {
          var first = $('.unit[data-unit]:not(.locked)');
          if (first && activeGroup) first.scrollIntoView({ block: 'center' });
        }, 30);
      });
      chips.appendChild(b);
    });

    var box = $('#path-list');
    box.innerHTML = '';
    // the whole list is rebuilt on every visit — only let it animate once,
    // otherwise the path flashes empty every time you come back to it
    if (pathAnimated) box.classList.add('no-anim'); else pathAnimated = true;
    var lastGroup = null;
    var stagger = 0;
    DS.units.forEach(function (u, idx) {
      if (activeGroup && u.group !== activeGroup) return;
      if (u.group !== lastGroup) {
        lastGroup = u.group;
        box.appendChild(el('div', 'chapter', u.group.toUpperCase()));
      }
      var locked = unitLocked(u, idx);
      var done = S.unitsDone.indexOf(u.id) >= 0;
      var row = el('div', 'unit' + (locked ? ' locked' : '') + (done ? ' done' : ''));
      row.dataset.unit = u.id;
      // the rows walk in one after another
      row.style.setProperty('--d', Math.min(700, stagger) + 'ms');
      stagger += 26;

      var ic = el('div', 'unit-icon');
      if (locked) ic.textContent = '🔒';
      else {
        var img = el('img'); img.src = u.icon; img.alt = ''; img.loading = 'lazy';
        ic.appendChild(img);
        if (done) ic.appendChild(el('div', 'unit-check', '✓'));
      }
      var body = el('div', 'unit-body');
      body.appendChild(el('div', 'unit-title', u.title));
      body.appendChild(el('div', 'unit-note', u.subtitle));
      // a lesson that waits for its mistakes says so, and offers the drill
      if (locked && S.gate && S.gate.unit === u.id) {
        var fixBtn = el('button', 'unit-fix', 'FIX ' + (S.gate.items || []).length +
          (S.gate.items && S.gate.items.length === 1 ? ' MISTAKE' : ' MISTAKES'));
        fixBtn.type = 'button';
        fixBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          startFixMistakes();
        });
        body.appendChild(fixBtn);
        body.appendChild(el('div', 'unit-note unit-note-lock',
          'The next lesson opens when you get these right.'));
      }
      if (!locked) {
        var mr = el('div', 'mastery-row');
        u.items.forEach(function (s) {
          var b = boxOf(s);
          mr.appendChild(el('div', 'mastery-dot' + (b >= 4 ? ' on' : b >= 2 ? ' half' : '')));
        });
        body.appendChild(mr);
      }
      row.appendChild(ic);
      row.appendChild(body);
      row.appendChild(el('div', 'unit-cta', locked ? 'Locked' : done ? 'Replay' : 'Start ›'));
      if (!locked) row.addEventListener('click', function () { startLesson(u.id); });
      box.appendChild(row);
    });

    var dailyDone = S.dailyDay === today();
    $('#daily-sub').textContent = dailyDone
      ? 'Done for today · ' + S.xp + ' XP total'
      : '6 questions · your streak is on the line';
    $('#daily-btn').textContent = dailyDone ? 'Again' : 'Start';

    // today's goal
    var goal = Number(S.settings.goal) || 12;
    var done = S.todayCount || 0;
    var fill = $('#goal-fill');
    if (fill) fill.style.width = Math.min(100, Math.round(done / goal * 100)) + '%';
    var note = $('#goal-note');
    if (note) {
      note.textContent = done >= goal
        ? 'Daily goal reached · ' + done + ' questions today'
        : done + ' / ' + goal + ' questions today';
      note.classList.toggle('done', done >= goal);
    }
  }

  function unitLocked(u, idx) {
    if (idx === 0) return false;
    // a lesson that waits for its mistakes stays shut, whatever the path says
    if (S.gate && S.gate.unit === u.id) return true;
    if (S.unlocked[u.id]) return false;
    var prev = DS.units[idx - 1];
    return S.unitsDone.indexOf(prev.id) < 0;
  }
  function unlockGroup(g) {
    DS.units.forEach(function (u) { if (u.group === g) S.unlocked[u.id] = true; });
    save();
  }

  /* The league. The star used to stand for XP, but XP only ever decided
     the league — so the top bar now shows the level itself, in a badge that
     looks like the one in the game, and the XP number sits with the league
     name where it means something. */
  var LEAGUES = [
    { name: 'Item Cadet', color: '#9FB0B8' },
    { name: 'Shop Apprentice', color: '#7ED957' },
    { name: 'Item Scholar', color: '#6EC8FF' },
    { name: 'Shop Regular', color: '#B79BFF' },
    { name: 'Item Master', color: '#FFC24A' },
    { name: 'Curiosity Shop Veteran', color: '#FF8A5B' }
  ];
  var LEAGUE_STEP = 300;
  function leagueInfo() {
    var lvl = Math.min(LEAGUES.length, Math.floor((Number(S.xp) || 0) / LEAGUE_STEP) + 1);
    var cur = LEAGUES[lvl - 1];
    var base = (lvl - 1) * LEAGUE_STEP;
    var next = lvl < LEAGUES.length ? lvl * LEAGUE_STEP : null;
    var pct = next ? Math.max(0, Math.min(1, ((Number(S.xp) || 0) - base) / (next - base))) : 1;
    return {
      level: lvl, name: cur.name, color: cur.color,
      next: next, nextName: lvl < LEAGUES.length ? LEAGUES[lvl].name : null,
      pct: pct, xp: Number(S.xp) || 0
    };
  }
  function league() { return leagueInfo().name; }

  /* the level badge: a chamfered plate in the league colour, with a ring
     around it that fills up as the XP runs to the next league */
  function levelBadge(info) {
    var r = 15, c = 2 * Math.PI * r;
    var off = c * (1 - info.pct);
    return '<svg class="lvl-badge" viewBox="0 0 36 36" width="30" height="30" aria-hidden="true">' +
      '<circle class="lvl-ring-bg" cx="18" cy="18" r="' + r + '"/>' +
      '<circle class="lvl-ring-fg" cx="18" cy="18" r="' + r + '" stroke="' + info.color + '" ' +
      'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/>' +
      '<path class="lvl-plate" fill="' + info.color + '" d="M12 8h12l4 4v12l-4 4H12l-4-4V12z"/>' +
      '<text class="lvl-num" x="18" y="24" text-anchor="middle">' + info.level + '</text>' +
      '</svg>';
  }

  // --------------------------------------------------------- items browser
  function ring(box) {
    var pct = Math.min(1, box / 5);
    var r = 13, c = 2 * Math.PI * r;
    var svg = '<svg class="ring" viewBox="0 0 32 32">' +
      '<circle class="ring-bg" cx="16" cy="16" r="' + r + '"></circle>' +
      '<circle class="ring-fg" cx="16" cy="16" r="' + r + '" stroke-dasharray="' + c +
      '" stroke-dashoffset="' + (c * (1 - pct)) + '"></circle></svg>';
    return svg;
  }

  var itemFilter = { slot: null, tier: null, fresh: false };

  function renderFilters() {
    var row = $('#item-filters');
    if (!row) return;
    row.innerHTML = '';
    function chip(text, on, fn) {
      var b = el('button', 'fchip' + (on ? ' on' : ''), text);
      b.type = 'button';
      b.addEventListener('click', fn);
      row.appendChild(b);
    }
    var any = !itemFilter.slot && !itemFilter.tier && !itemFilter.fresh;
    chip('All', any, function () {
      itemFilter = { slot: null, tier: null, fresh: false };
      renderItems();
    });
    ['Weapon', 'Vitality', 'Spirit'].forEach(function (s) {
      chip(s, itemFilter.slot === s, function () {
        itemFilter.slot = itemFilter.slot === s ? null : s;
        renderItems();
      });
    });
    [1, 2, 3, 4].forEach(function (t) {
      chip('T' + t, itemFilter.tier === t, function () {
        itemFilter.tier = itemFilter.tier === t ? null : t;
        renderItems();
      });
    });
    chip('Not studied', itemFilter.fresh, function () {
      itemFilter.fresh = !itemFilter.fresh;
      renderItems();
    });
  }

  function renderItems(query) {
    var box = $('#item-list');
    box.innerHTML = '';
    renderFilters();
    var q = (query || '').toLowerCase().trim();
    var list = Object.keys(DS.items).map(function (k) { return DS.items[k]; });
    if (q) list = list.filter(function (i) {
      var stats = i.innate.concat(i.active).map(function (r) { return r.label + ' ' + r.value; }).join(' ');
      return (i.name + ' ' + i.group + ' ' + i.slot + ' ' + i.desc + ' ' + stats).toLowerCase().indexOf(q) >= 0;
    });
    if (itemFilter.slot) list = list.filter(function (i) { return i.slot === itemFilter.slot; });
    if (itemFilter.tier) list = list.filter(function (i) { return i.tier === itemFilter.tier; });
    if (itemFilter.fresh) list = list.filter(function (i) { return boxOf(i.slug) === 0; });
    list.sort(function (a, b) { return a.tier - b.tier || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name); });
    if (!list.length) {
      var why = (itemFilter.slot || itemFilter.tier || itemFilter.fresh)
        ? 'Nothing matches those filters.'
        : 'No items match "' + q + '"';
      box.appendChild(el('div', 'footnote', why));
      return;
    }
    list.forEach(function (it) {
      var row = el('div', 'item-card');
      var img = el('img'); img.src = it.icon; img.alt = ''; img.loading = 'lazy';
      var body = el('div', 'ic-body');
      body.appendChild(el('div', 'ic-name', it.name));
      var stats = it.innate.concat(it.active).map(function (r) { return r.label + ' ' + r.value; }).join(' · ');
      body.appendChild(el('div', 'ic-meta', stats || it.desc || ''));
      row.appendChild(img);
      row.appendChild(body);
      var right = el('div', 'ic-right');
      right.appendChild(el('div', 'ic-tier t' + it.tier, 'T' + it.tier));
      var b = boxOf(it.slug);
      if (b) right.insertAdjacentHTML('beforeend', ring(b));
      row.appendChild(right);
      row.addEventListener('click', function () { openItem(it); });
      box.appendChild(row);
    });
  }

  function openItem(it) {
    var card = $('#modal-card');
    var rows = it.innate.concat(it.active);
    var b = boxOf(it.slug);
    var h = '<div class="modal-head"><img src="' + it.icon + '" alt=""><div><div class="modal-title">' +
      esc(it.name) + '</div><div class="modal-meta">' + esc(it.slot) + ' · Tier ' + it.tier + ' · ' +
      it.cost.toLocaleString() + ' souls · ' + esc(it.activation) + '</div></div>' +
      '<div class="modal-ring">' + ring(b) + '<span>L' + b + '</span></div></div>';
    if (it.desc) h += '<div class="modal-desc">' + decorate(it.desc) + '</div>';
    if (rows.length) {
      h += '<div class="modal-sec">Stats</div><table class="stat-table">';
      rows.forEach(function (r) { h += '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.value) + '</td></tr>'; });
      h += '</table>';
    }
    if (it.upgrades_to.length) h += '<div class="modal-sec">Upgrades into</div><div>' + it.upgrades_to.map(function (n) { return '→ ' + esc(n); }).join('<br>') + '</div>';
    if (it.upgraded_from.length) h += '<div class="modal-sec">Upgraded from</div><div>' + it.upgraded_from.map(function (n) { return '← ' + esc(n); }).join('<br>') + '</div>';
    card.innerHTML = h;
    $('#item-modal').classList.add('on');
  }

  // ------------------------------------------------------------- stats UI
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function weekData() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var k = dayKey(d);
      out.push({ key: k, label: DAY_NAMES[d.getDay()], n: (S.history && S.history[k]) || 0, today: k === today() });
    }
    return out;
  }

  function renderWeek() {
    var box = $('#week-chart');
    if (!box) return;
    box.innerHTML = '';
    var days = weekData();
    var max = 1, total = 0;
    days.forEach(function (d) {
      if (d.n > max) max = d.n;
      total += d.n;
    });
    days.forEach(function (d) {
      var col = el('div', 'week-col');
      var bar = el('div', 'week-bar' + (d.today ? ' today' : ''));
      bar.style.height = (d.n ? Math.max(10, Math.round(d.n / max * 100)) : 0) + '%';
      if (d.n) bar.appendChild(el('i', null, String(d.n)));
      col.appendChild(bar);
      col.appendChild(el('div', 'week-day', d.label));
      box.appendChild(col);
    });
    var goal = Number(S.settings.goal) || 12;
    var note = $('#week-note');
    if (note) {
      note.textContent = total + ' question' + (total === 1 ? '' : 's') + ' in the last 7 days · '
        + 'a goal of ' + goal + ' a day';
    }
  }

  function renderGroupProgress() {
    var box = $('#group-list');
    if (!box) return;
    box.innerHTML = '';
    var byGroup = {};
    Object.keys(DS.items).forEach(function (s) {
      var it = DS.items[s];
      var g = it.group || it.slot;
      if (!byGroup[g]) byGroup[g] = { n: 0, mastered: 0 };
      byGroup[g].n++;
      if (boxOf(s) >= 4) byGroup[g].mastered++;
    });
    Object.keys(byGroup).sort().forEach(function (g) {
      var d = byGroup[g];
      var row = el('div', 'group-row');
      row.appendChild(el('div', 'group-name', g));
      var bar = el('div', 'group-bar');
      var fill = el('i');
      fill.style.width = Math.round(d.mastered / d.n * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('div', 'group-num', d.mastered + '/' + d.n));
      // tap a group to jump straight to it on the path
      row.addEventListener('click', function () {
        activeGroup = g;
        unlockGroup(g);
        renderPath();
        show('path');
        var first = $('.unit[data-unit]:not(.locked)');
        if (first) first.scrollIntoView({ block: 'center' });
      });
      box.appendChild(row);
    });
  }

  function renderStats() {
    renderWeek();
    renderGroupProgress();
    var touched = Object.keys(S.mastery).filter(function (s) { return DS.items[s]; });
    var mastered = touched.filter(function (s) { return boxOf(s) >= 4; }).length;
    setText('#s-mastered', mastered);
    setText('#s-correct', S.right);
    setText('#s-wrong', S.wrong);
    setText('#s-streak', S.streak);

    // weak items — the ones worth another look
    var weak = touched.filter(function (s) {
      var m = S.mastery[s];
      return m.box < 3 || m.wrong > m.right;
    }).sort(function (a, b) {
      var ma = S.mastery[a], mb = S.mastery[b];
      return (ma.box - mb.box) || (mb.wrong - ma.wrong);
    });
    setText('#s-review-count', weak.length ? weak.length + ' item' + (weak.length === 1 ? '' : 's') : '');
    var rb = $('#review-list');
    rb.innerHTML = '';
    weak.slice(0, 12).forEach(function (s) {
      var it = DS.items[s], m = S.mastery[s];
      var row = el('div', 'mrow');
      var img = el('img'); img.src = it.icon; img.alt = '';
      row.appendChild(img);
      row.appendChild(el('div', 'mname', it.name));
      row.appendChild(el('div', 'ri-box', m.wrong + ' wrong'));
      rb.appendChild(row);
    });
    if (!weak.length) rb.appendChild(el('div', 'footnote', 'No weak items — everything you have studied is in good shape.'));
    setText('#s-review-note', weak.length ? '' : 'Nothing to review yet.');

    // per-act progress — the three acts of the course
    var acts = ['facts', 'structure', 'judgment'];
    var actRows = $('#act-list');
    actRows.innerHTML = '';
    acts.forEach(function (act) {
      var inAct = Object.keys(DS.item_acts || {}).filter(function (s) {
        return (DS.item_acts[s] || []).indexOf(act) >= 0;
      });
      var started = inAct.filter(function (s) { return boxOf(s) > 0; }).length;
      // the bar shows how far through the act you are, so it moves while you
      // learn — the number on the right counts fully mastered items
      var progress = inAct.reduce(function (n, s) { return n + Math.min(boxOf(s), 4) / 4; }, 0);
      var row = el('div', 'act-row');
      row.appendChild(el('div', 'act-label act-' + act, ACT_NAME[act]));
      var bar = el('div', 'bar act-bar');
      var i = el('i');
      i.style.width = (inAct.length ? (progress / inAct.length * 100) : 0) + '%';
      bar.appendChild(i);
      row.appendChild(bar);
      row.appendChild(el('div', 'ri-box', started + '/' + inAct.length));
      actRows.appendChild(row);
      if (!started && inAct.length) row.classList.add('dim');
    });

    var box = $('#mastery-list');
    box.innerHTML = '';
    touched.sort(function (a, b) { return boxOf(b) - boxOf(a); }).forEach(function (s) {
      var it = DS.items[s], b = boxOf(s);
      var row = el('div', 'mrow');
      var img = el('img'); img.src = it.icon; img.alt = '';
      row.appendChild(img);
      row.appendChild(el('div', 'mname', it.name));
      var bar = el('div', 'bar'); var i = el('i'); i.style.width = (b / 5 * 100) + '%'; bar.appendChild(i);
      row.appendChild(bar);
      row.appendChild(el('div', 'ri-box', 'L' + b));
      box.appendChild(row);
    });
    if (!touched.length) box.appendChild(el('div', 'footnote', 'No items studied yet — pick any lesson to start.'));
  }

  // -------------------------------------------------------------- lesson
  var L = null;
  var KIND = {
    family: 'Which stat?', value: 'Exact value', blank: 'Missing stat', compare: 'Comparison',
    chain: 'Upgrade path', freeRecall: 'Full recall', valueBlind: 'Exact value',
    tier: 'Tier'
  };
  var ACT_NAME = { facts: 'Facts', structure: 'Structure', judgment: 'Judgment' };

  function startLesson(unitId) {
    S.paused = null;
    var unit = null;
    for (var i = 0; i < DS.units.length; i++) if (DS.units[i].id === unitId) unit = DS.units[i];
    if (!unit) return;
    var qs = unit.questions.slice();

    // spaced repetition: items you have mastered get a light refresh only
    var keep = [];
    qs.forEach(function (q) {
      var b = boxOf(q.item);
      if (b >= 3 && ['family', 'value', 'compare'].indexOf(q.type) < 0) return;
      keep.push(q);
    });
    if (keep.length < 4) keep = qs;

    L = { unit: unit, qs: keep, i: 0, right: 0, wrong: 0, xp: 0, answered: false, sel: null, inputVal: '', kind: 'lesson' };
    show('lesson');
    $('#feedback').classList.remove('on');
    renderQ();
  }

  function startDaily() {
    // six questions, the ones you know least about first
    var pool = [];
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) {
        var b = boxOf(q.item);
        pool.push({ q: q, score: b + (S.seen[q.id] ? 1.5 : 0) + Math.random() * 0.9 });
      });
    });
    pool.sort(function (a, b) { return a.score - b.score; });
    var picked = [], usedItems = {};
    for (var i = 0; i < pool.length && picked.length < 6; i++) {
      var q = pool[i].q;
      if (usedItems[q.item]) continue;
      usedItems[q.item] = 1;
      picked.push(q);
    }
    if (picked.length < 6) {
      for (var j = 0; j < pool.length && picked.length < 6; j++) {
        if (picked.indexOf(pool[j].q) < 0) picked.push(pool[j].q);
      }
    }
    startMixed(picked, 'Daily Shop Run', 'mixed review', 'daily');
  }

  /* a focused review of everything you keep getting wrong */
  function startReview() {
    var weak = {};
    Object.keys(S.mastery).forEach(function (s) {
      var m = S.mastery[s];
      if (!DS.items[s]) return;
      if (m.box < 3 || m.wrong > m.right) weak[s] = 1;
    });
    var pool = [];
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) {
        if (!weak[q.item]) return;
        var m = S.mastery[q.item];
        pool.push({ q: q, score: m.box * 2 + m.wrong - m.right + Math.random() });
      });
    });
    pool.sort(function (a, b) { return a.score - b.score; });
    var picked = [], usedItems = {};
    for (var i = 0; i < pool.length && picked.length < 8; i++) {
      var q = pool[i].q;
      if (usedItems[q.item]) continue;
      usedItems[q.item] = 1;
      picked.push(q);
    }
    if (!picked.length) {
      setText('#s-review-note', 'Nothing to review yet — answer a few questions and mistakes will collect here.');
      return;
    }
    startMixed(picked, 'Review mistakes', Object.keys(weak).length + ' weak item' +
      (Object.keys(weak).length === 1 ? '' : 's'), 'review');
  }

  /* ---------------------------------------------------------------------
     Exam mode: ten mixed questions from the whole catalogue, on the clock.
     An exam never touches mastery, XP or the streak — it only measures. */
  var examTimerId = null;
  function stopExamTimer() {
    if (examTimerId) { clearInterval(examTimerId); examTimerId = null; }
    var t = $('#exam-timer');
    if (t) t.hidden = true;
  }
  function startExamTimer() {
    stopExamTimer();
    var t = $('#exam-timer');
    if (!t) return;
    t.hidden = false;
    function tick() {
      var s = Math.floor((Date.now() - (L.startedAt || Date.now())) / 1000);
      t.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }
    tick();
    examTimerId = setInterval(tick, 1000);
  }

  function startExam() {
    var pool = [];
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) { pool.push(q); });
    });
    // the questions you are worst at come first
    pool.sort(function (a, b) {
      var sa = boxOf(a.item) * 2 + (S.seen[a.id] ? 1 : 0);
      var sb = boxOf(b.item) * 2 + (S.seen[b.id] ? 1 : 0);
      return sa - sb;
    });
    var picked = [], used = {};
    for (var i = 0; i < pool.length && picked.length < 10; i++) {
      var q = pool[i];
      if (used[q.item]) continue;
      used[q.item] = 1;
      picked.push(q);
    }
    for (var j = picked.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = picked[j]; picked[j] = picked[k]; picked[k] = tmp;
    }
    L = {
      unit: { id: 'exam', title: 'Test yourself', subtitle: '10 questions from the whole shop',
        items: Object.keys(used), icon: '', questions: picked },
      qs: picked, i: 0, right: 0, wrong: 0, xp: 0, answered: false, sel: null, inputVal: '',
      kind: 'exam', exam: true, startedAt: Date.now(), wrongItems: []
    };
    show('lesson');
    $('#feedback').classList.remove('on');
    renderQ();
    startExamTimer();
  }

  /* practise only what the exam got wrong */
  function startExamReview() {
    var wrong = (L && L.wrongItems) || [];
    if (!wrong.length) return;
    var pool = [];
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) {
        if (wrong.indexOf(q.item) >= 0) pool.push(q);
      });
    });
    if (!pool.length) return;
    var picked = [], used = {};
    for (var i = 0; i < pool.length && picked.length < 8; i++) {
      var q = pool[i];
      if (used[q.item]) continue;
      used[q.item] = 1;
      picked.push(q);
    }
    startMixed(picked, 'Exam mistakes', 'Straight back at the ones you missed', 'review');
  }

  /* The gate: the next lesson stays shut until the mistakes of this one are
     answered right. The state lives in the profile, so a reload does not
     open the door by accident. */
  function unlockGate() {
    if (S.gate && S.gate.unit) {
      S.unlocked[S.gate.unit] = true;
      S.gate = null;
      save();
    }
  }

  /* The drill itself: the very questions the lesson got wrong. */
  function startFixMistakes() {
    var gate = S.gate;
    var ids = (gate && gate.qs) || [];
    var items = (gate && gate.items) || [];
    if (!ids.length && !items.length) return;
    var pool = [];
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) {
        if (ids.length) {
          if (ids.indexOf(q.id) >= 0) pool.push(q);
        } else if (items.indexOf(q.item) >= 0) {
          if (!pool.some(function (p) { return p.item === q.item; })) pool.push(q);
        }
      });
    });
    if (!pool.length) {
      // nothing left to ask about — do not keep the door shut for nothing
      unlockGate();
      renderPath();
      toast('The next lesson is open');
      return;
    }
    startMixed(pool, 'Fix the mistakes', pool.length + ' question' +
      (pool.length === 1 ? '' : 's') + ' to get right', 'fix');
  }

  function startMixed(picked, title, subtitle, kind) {
    L = {
      unit: { id: title.toLowerCase().replace(/\s+/g, '-'), title: title, subtitle: subtitle,
        items: Object.keys(picked.reduce(function (a, q) { a[q.item] = 1; return a; }, {})), icon: '', questions: picked },
      qs: picked, i: 0, right: 0, wrong: 0, xp: 0, answered: false, sel: null, inputVal: '',
      kind: kind || 'mixed',
      // a drill is not a lesson: the mastery moves, the pay and the streak do not
      drill: kind === 'fix' || kind === 'review'
    };
    show('lesson');
    $('#feedback').classList.remove('on');
    renderQ();
  }

  /* Pause a lesson: the place is remembered, so it can be picked up later
     from the path screen. */
  function pauseLesson() {
    stopExamTimer();
    if (L && L.kind === 'lesson' && L.unit && L.qs && L.i < L.qs.length) {
      S.paused = {
        unit: L.unit.id,
        qs: L.qs.map(function (q) { return q.id; }),
        i: L.i
      };
      save();
    }
    L = null;
    setActiveTab('path');
    show('path');
  }

  function resumeLesson() {
    var p = S.paused;
    if (!p) return;
    var unit = null;
    for (var i = 0; i < DS.units.length; i++) if (DS.units[i].id === p.unit) unit = DS.units[i];
    var byId = {};
    DS.units.forEach(function (u) {
      u.questions.forEach(function (q) { byId[q.id] = q; });
    });
    var qs = (p.qs || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (!unit || !qs.length) { S.paused = null; save(); renderPath(); return; }
    L = { unit: unit, qs: qs, i: Math.min(p.i || 0, qs.length - 1), right: 0, wrong: 0,
      xp: 0, answered: false, sel: null, inputVal: '', fields: [], kind: 'lesson' };
    S.paused = null;
    save();
    show('lesson');
    $('#feedback').classList.remove('on');
    renderQ();
  }

  /* A hint never gives the number away. It tells the player what kind of
     number to type (percentage, metres, seconds) and — when a card carries
     the same stat twice — which of the two rows is meant. */
  function hintFor(q, item) {
    if (!item || !q.statLabel) return '';
    var base = String(q.statLabel).replace(/\s*\(.*\)\s*$/, '').replace(/\s*%$/, '').trim();
    var rows = [];
    (item.innate || []).forEach(function (r) {
      rows.push({ r: r, sec: 'innate' });
    });
    (item.active || []).forEach(function (r) {
      rows.push({ r: r, sec: 'active' });
    });
    var same = rows.filter(function (x) {
      return String(x.r.label).replace(/\s*%$/, '').trim() === base;
    });
    if (same.length > 1) {
      var pick = same.filter(function (x) { return String(x.r.value) === String(q.statValue); })[0] || same[0];
      var sec = pick.sec === 'active'
        ? 'only while the ability is active'
        : (pick.sec === 'innate' ? 'always on' : 'only while the buff is up');
      return 'This card carries <b>' + same.length + '</b> "' + base + '" stats — you want the one that is <b>' +
        sec + '</b>.';
    }
    var m = String(q.statValue || '').match(/([a-z%\/]+)$/i);
    var unit = m ? m[0] : '';
    if (unit === '%') return 'The answer is a <b>percentage</b>.';
    if (unit === 'm/s') return 'The answer is measured in <b>metres per second</b>.';
    if (unit === 'm') return 'The answer is measured in <b>metres</b>.';
    if (unit === 's') return 'The answer is a <b>time in seconds</b>.';
    return 'The answer is a plain number.';
  }

  function renderQ() {
    var q = L.qs[L.i];
    var item = DS.items[q.item];
    var card = $('#q-card');
    // The card is rebuilt from scratch and appears at once. There is no
    // entrance animation on purpose: a hidden-then-revealed card was the
    // reason a question sometimes only showed up after a tap.
    card.innerHTML = '';
    // the question id on the card: handy for debugging and for the test harness
    card.dataset.qid = q.id || '';
    card.dataset.qtype = q.type || '';
    L.sel = null; L.inputVal = ''; L.fields = []; L.answered = false; L.hinted = false;
    // the clock only runs during an exam
    if (!L.exam) stopExamTimer();

    // Every question starts at the top of the column. Without this a long
    // question leaves the next one scrolled out of sight, which reads as a
    // blank screen that only a click (or a scroll) clears.
    var sc = card.closest ? card.closest('.scroll') : null;
    if (sc) sc.scrollTop = 0;

    card.appendChild(el('div', 'q-kind', KIND[q.type] || q.type));
    if (q.act) card.appendChild(el('div', 'q-act act-' + q.act, ACT_NAME[q.act] || q.act));

    // When the item being studied is one of the answer options, its card
    // would hand the answer over — so it is left out.
    var itemName = String(item.name || '').toLowerCase();
    var leaks = !!(q.options && q.options.some(function (opt) {
      return String(opt).toLowerCase().indexOf(itemName) >= 0;
    }));
    if (!leaks) {
      // The head only names the subject. It is deliberately not a link:
      // opening the full card would show every stat and hand over the answer.
      var head = el('div', 'item-head');
      var img = el('img'); img.src = item.icon; img.alt = item.name;
      head.appendChild(img);
      var hb = el('div');
      hb.appendChild(el('div', 'ih-name', item.name));
      hb.appendChild(el('div', 'ih-meta', item.slot + ' · Tier ' + item.tier + ' · ' + item.cost.toLocaleString() + ' souls'));
      head.appendChild(hb);
      card.appendChild(head);
    }

    var qtitle = el('div', 'q-title');
    qtitle.innerHTML = decorate(q.question);
    card.appendChild(qtitle);

    // the "pick an answer" hint only makes sense for option questions
    var kp = $('#kbd-pick');
    if (kp) kp.style.display = q.options ? '' : 'none';

    if (q.options) {
      var opts = el('div', 'opts');
      q.options.forEach(function (o) {
        var b = elHTML('button', 'opt', '<span>' + decorate(o) + '</span>');
        b.dataset.raw = o;
        b.addEventListener('click', function () {
          if (L.answered) return;
          $$('.opt').forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel'); L.sel = o; L.selEl = b;
          $('#check-btn').disabled = false;
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
    } else if (q.type === 'blank') {
      card.appendChild(statTable(q.rows));
      card.appendChild(el('div', 'hint', 'One value is hidden — type it. Units are optional.'));
      card.appendChild(numInput(q));
    } else if (q.type === 'freeRecall') {
      card.appendChild(el('div', 'hint',
        'Fill in the values you remember — every stat you get right counts. Leave a field empty if you do not know it. ' +
        'Two rows can share a name: the block each one sits in tells them apart.'));
      var rt = el('table', 'stat-table recall-table');
      var lastSec = null;
      (q.rows || []).forEach(function (r) {
        var sec = r.sec || 'innate';
        if (sec !== lastSec) {
          lastSec = sec;
          var hrow = el('tr', 'recall-sec');
          var hcell = el('td', null, sec === 'active' ? 'WHILE THE BUFF IS UP' : 'ALWAYS ON');
          hcell.setAttribute('colspan', '2');
          hrow.appendChild(hcell);
          rt.appendChild(hrow);
        }
        var tr = el('tr');
        tr.appendChild(el('td', 'recall-label', r.label));
        var td = el('td');
        var inp = el('input', 'recall-input');
        inp.type = 'text';
        inp.inputMode = 'decimal';
        inp.placeholder = '?';
        inp.setAttribute('aria-label', r.label);
        inp.addEventListener('input', function () {
          L.fields = $$('.recall-input').map(function (x) { return x.value; });
          $('#check-btn').disabled = !L.fields.some(function (v) { return String(v).trim(); });
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (L.answered) next();
          else if (!$('#check-btn').disabled) check();
        });
        td.appendChild(inp);
        tr.appendChild(td);
        rt.appendChild(tr);
      });
      card.appendChild(rt);
    } else {
      card.appendChild(el('div', 'hint', 'Type the number — units are optional.'));
      card.appendChild(numInput(q));
    }

    // a hint for the number questions — it never gives the number away
    if (!q.options) {
      var htext = hintFor(q, item);
      if (htext) {
        var hbtn = el('button', 'hint-btn', '💡 Hint');
        hbtn.type = 'button';
        var hbox = el('div', 'hint-text');
        hbox.innerHTML = htext;
        hbtn.addEventListener('click', function () {
          if (L.hinted) return;
          L.hinted = true;
          hbtn.classList.add('used');
          hbtn.textContent = 'Hint used';
          hbox.classList.add('on');
          buzz(20);
        });
        card.appendChild(hbtn);
        card.appendChild(hbox);
      }
    }

    $('#progress-fill').style.width = (L.i / L.qs.length * 100) + '%';
    setText('#lesson-count', (L.i + 1) + '/' + L.qs.length);
    $('#check-btn').disabled = true;
    $('#check-btn').textContent = 'CHECK';
    $('#action-bar').style.display = '';

    // The new question always starts at the top of the column. The reset
    // happens after the card is complete, otherwise a long question leaves
    // the next one scrolled out of sight.
    var sc = card.closest ? card.closest('.scroll') : null;
    if (sc) sc.scrollTop = 0;
  }

  function numInput(q) {
    var inp = el('input', 'answer-input');
    inp.type = 'text';
    // a phone's numeric keypad has no minus sign, so negative answers need
    // the full keyboard
    var negative = q && q.accept && q.accept.some(function (a) { return /^\s*-/.test(a); });
    inp.inputMode = negative ? 'text' : 'decimal';
    // The placeholder must never contain the expected value — it used to
    // show the answer itself ("e.g. 20%" for a +20% question).
    inp.placeholder = valuePlaceholder(q && q.statValue);
    inp.addEventListener('input', function () { L.inputVal = inp.value; $('#check-btn').disabled = !inp.value.trim(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (L.answered) next();
      else if (!$('#check-btn').disabled) check();
    });
    return inp;
  }

  /* A neutral placeholder that only says which unit to type. */
  function valuePlaceholder(v) {
    var m = String(v || '').match(/([a-z%\/]+)$/i);
    var u = m ? m[0].toLowerCase() : '';
    if (u === '%') return 'value in %';
    if (u === 'm/s') return 'value in m/s';
    if (u === 'm') return 'value in m';
    if (u === 's') return 'value in s';
    return 'value';
  }

  function statTable(rows) {
    var t = el('table', 'stat-table');
    (rows || []).forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r.label));
      var td = el('td');
      if (r.value === '' || r.value === undefined) { td.className = 'blank-cell'; }
      else td.textContent = r.value;
      tr.appendChild(td);
      t.appendChild(tr);
    });
    return t;
  }

  function check() {
    if (L.answered) return;
    var q = L.qs[L.i];
    var item = DS.items[q.item];
    var ok = false, detail = '', partial = 0;

    if (q.options) {
      ok = (L.sel === q.answer);
      $$('.opt').forEach(function (b) {
        var raw = b.dataset.raw;
        if (raw === q.answer) { b.classList.add('right'); b.appendChild(el('span', 'opt-mark', '✓')); }
        else if (b.classList.contains('sel')) { b.classList.add('wrong'); b.appendChild(el('span', 'opt-mark', '✕')); }
      });
    } else if (q.type === 'freeRecall') {
      var rows = q.rows || [];
      var inputs = $$('.recall-input');
      var g = DSC.gradeFields(inputs.map(function (x) { return x.value; }), rows);
      ok = g.ok;
      partial = g.matched;
      L.lastGrade = g;
      detail = g.matched + ' of ' + g.total + ' stats right';
      g.per.forEach(function (good, i) {
        if (!inputs[i]) return;
        inputs[i].disabled = true;
        if (good) inputs[i].classList.add('right');
        else if (String(inputs[i].value).trim()) inputs[i].classList.add('wrong');
      });
    } else {
      ok = DSC.gradeNumber(L.inputVal, q.accept);
    }

    L.answered = true;
    if (L.exam) {
      // an exam only measures — it never touches mastery, XP or the streak
      if (ok) L.right++;
      else {
        L.wrong++;
        if (!L.wrongItems) L.wrongItems = [];
        if (L.wrongItems.indexOf(q.item) < 0) L.wrongItems.push(q.item);
      }
      showFeedback(ok, q, item, detail, partial);
      return;
    }
    /* A drill — fixing the mistakes of a lesson, or the review from the
       stats screen. The mastery moves, but the pay does not: the XP was
       already given for the lesson, and the streak must not be touched. */
    if (L.drill) {
      if (ok) {
        L.right++; S.right++; m.right++;
        m.box = Math.min(5, m.box + 1);
        sfxOk();
      } else {
        L.wrong++; S.wrong++; m.wrong++;
        m.box = Math.max(0, m.box - 1);
        if (!L.wrongItems) L.wrongItems = [];
        if (L.wrongItems.indexOf(q.item) < 0) L.wrongItems.push(q.item);
        if (!L.wrongQs) L.wrongQs = [];
        if (L.wrongQs.indexOf(q.id) < 0) L.wrongQs.push(q.id);
        sfxNo();
        buzz(60);
      }
      save();
      showFeedback(ok, q, item, detail, partial);
      return;
    }
    S.seen[q.id] = Date.now();
    // how much of today's goal is done
    if (S.todayDay !== today()) { S.todayDay = today(); S.todayCount = 0; }
    S.todayCount = (S.todayCount || 0) + 1;
    // and how much was done on every other day
    if (!S.history) S.history = {};
    S.history[today()] = (S.history[today()] || 0) + 1;
    var m = mst(q.item);    // a hinted answer pays half — the hint is worth less than the recall
    var gain = L.hinted ? 5 : 10;
    if (ok) { L.right++; S.right++; m.right++; m.box = Math.min(5, m.box + 1); L.xp += gain; S.xp += gain; sfxOk(); floatXP($('#check-btn'), '+' + gain); }
    else if (partial > 0) {
      // partly right — keep the mastery where it is and pay for what was right
      L.xp += partial; S.xp += partial;
      L.right += 0; S.right += 0;
      floatXP($('#check-btn'), '+' + partial);
    }
    else {
      L.wrong++; S.wrong++; m.wrong++; m.box = Math.max(0, m.box - 1); L.xp += 2; S.xp += 2;
      // the lesson remembers what was missed: the next lesson waits for it
      if (!L.wrongItems) L.wrongItems = [];
      if (L.wrongItems.indexOf(q.item) < 0) L.wrongItems.push(q.item);
      if (!L.wrongQs) L.wrongQs = [];
      if (L.wrongQs.indexOf(q.id) < 0) L.wrongQs.push(q.id);
      sfxNo(); buzz(60);
    }

    save();
    showFeedback(ok, q, item, detail, partial);
  }

  function showFeedback(ok, q, item, detail, partial) {
    var fb = $('#feedback');
    fb.className = 'feedback on ' + (ok ? 'ok' : (partial > 0 ? 'half' : 'no'));
    setText('#feedback-title', ok ? 'Correct!' : (partial > 0 ? 'Partly right' : 'Not quite'));
    setText('#feedback-sub', L.exam
      ? (ok ? 'Correct' : 'Not quite') + ' · ' + L.right + ' of ' + L.qs.length + ' so far'
      : L.drill
        ? (ok ? 'Correct · ' + item.name + ' · mastery L' + mst(item.slug).box
          : 'Not quite · ' + (detail || 'mastery L' + mst(item.slug).box))
        : ok
          ? '+10 XP · ' + item.name + ' · mastery L' + mst(item.slug).box
          : (partial > 0 ? '+' + partial + ' XP · ' + detail
          : (detail || 'Mastery dropped to L' + mst(item.slug).box)));
    var body = $('#feedback-body');
    body.innerHTML = decorate(q.explain || '');
    if (q.type === 'freeRecall' && q.rows) {
      var g = L.lastGrade;
      var recap = '<div class="recap">';
      q.rows.forEach(function (r, i) {
        var good = g && g.per && g.per[i];
        recap += '<div class="' + (good ? 'ok' : 'no') + '">' + esc(r.label) +
          ' &nbsp;<b>' + esc(r.value) + '</b></div>';
      });
      recap += '</div>';
      body.innerHTML += recap;
    }
    fb.setAttribute('aria-hidden', 'false');
    $('#action-bar').style.display = 'none';
    setText('#continue-btn', L.i >= L.qs.length - 1 ? 'FINISH' : 'CONTINUE');
  }

  function next() {
    if (!L || L.i >= L.qs.length) return;
    $('#feedback').classList.remove('on');
    $('#action-bar').style.display = '';
    L.i++;
    if (L.i >= L.qs.length) finish();
    else renderQ();
  }

  function finish() {
    var acc = Math.round(L.right / L.qs.length * 100);
    var day = today();

    // ---- an exam is a measurement, not a lesson ------------------------
    if (L.exam) {
      stopExamTimer();
      var secs = Math.round((Date.now() - (L.startedAt || Date.now())) / 1000);
      setText('#r-xp', L.right + '/' + L.qs.length);
      setText('#r-acc', acc + '%');
      setText('#r-streak', Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2));
      setText('#r-lbl-xp', 'correct');
      setText('#r-lbl-acc', 'score');
      setText('#r-lbl-streak', 'time');
      setText('#r-lbl-souls', 'souls');
      setText('#result-emoji', acc >= 80 ? '🏆' : acc >= 50 ? '📖' : '💪');
      setText('#result-title', acc >= 80 ? 'Exam passed!' : acc >= 50 ? 'Solid run' : 'Keep drilling');
      mascotMood(acc >= 80 ? 'perfect' : (acc >= 50 ? 'good' : ''));
      var exBox = $('#result-items');
      exBox.innerHTML = '';
      var exSeen = {};
      L.qs.forEach(function (q) { exSeen[q.item] = 1; });
      Object.keys(exSeen).forEach(function (s) {
        var it = DS.items[s];
        var missed = (L.wrongItems || []).indexOf(s) >= 0;
        var row = el('div', 'ri');
        var img = el('img'); img.src = it.icon; img.alt = '';
        row.appendChild(img);
        row.appendChild(el('div', 'ri-name', it.name));
        row.appendChild(el('div', 'ri-box ' + (missed ? 'bad' : 'good'), missed ? 'missed' : 'got it'));
        exBox.appendChild(row);
      });
      var exBtn = $('#result-next');
      if ((L.wrongItems || []).length) {
        exBtn.hidden = false;
        exBtn.textContent = 'PRACTISE THE MISTAKES';
        exBtn.onclick = function () { exBtn.hidden = true; startExamReview(); };
      } else {
        exBtn.hidden = true;
        exBtn.onclick = null;
      }
      $('#progress-fill').style.width = '100%';
      show('result');
      sfxDone();
      if (acc >= 80) confetti();
      // an exam pays a little, but it never touches XP, streak or mastery
      awardSouls(SOUL_RULES.exam, 'self-test');
      return;
    }

    /* ---- a drill: fixing the mistakes, or the review ------------------- */
    if (L.drill) {
      var fixed = L.wrong === 0;
      save();
      setText('#r-xp', L.right + '/' + L.qs.length);
      setText('#r-acc', acc + '%');
      setText('#r-streak', fixed ? '0' : String(L.wrong));
      setText('#r-lbl-xp', 'correct');
      setText('#r-lbl-acc', 'score');
      setText('#r-lbl-streak', fixed ? 'all fixed' : 'still wrong');
      setText('#r-lbl-souls', 'souls');
      setText('#r-souls', '+0');
      var dBox = $('#result-items');
      dBox.innerHTML = '';
      var dSeen = {};
      L.qs.forEach(function (q) { dSeen[q.item] = 1; });
      Object.keys(dSeen).forEach(function (s) {
        var it = DS.items[s];
        var missed = (L.wrongItems || []).indexOf(s) >= 0;
        var row = el('div', 'ri');
        var img = el('img'); img.src = it.icon; img.alt = '';
        row.appendChild(img);
        row.appendChild(el('div', 'ri-name', it.name));
        row.appendChild(el('div', 'ri-box ' + (missed ? 'bad' : 'good'), missed ? 'missed' : 'got it'));
        dBox.appendChild(row);
      });
      var drillBtn = $('#result-next');
      if (L.kind === 'fix') {
        if (fixed) {
          unlockGate();
          sfxUnlock();
          setText('#result-emoji', '✅');
          setText('#result-title', 'All fixed!');
          setText('#result-note', 'The next lesson is open. Well done — that is the part that sticks.');
          drillBtn.hidden = true;
          drillBtn.onclick = null;
        } else {
          setText('#result-emoji', '🔒');
          setText('#result-title', 'Not yet');
          setText('#result-note', 'The next lesson stays locked until every one of these is right. Go again.');
          drillBtn.hidden = false;
          drillBtn.className = 'btn btn-red btn-block';
          drillBtn.textContent = 'GO AGAIN';
          drillBtn.onclick = function () { drillBtn.hidden = true; startFixMistakes(); };
        }
      } else {
        setText('#result-emoji', acc >= 80 ? '🏆' : '📖');
        setText('#result-title', 'Review done');
        setText('#result-note', 'The mastery of the items you missed moved up. Keep going.');
        drillBtn.hidden = true;
        drillBtn.onclick = null;
      }
      $('#progress-fill').style.width = '100%';
      show('result');
      sfxDone();
      return;
    }

    if (S.lastDay !== day) {
      if (acc >= 50) S.streak = (S.lastDay === yesterday()) ? S.streak + 1 : 1;
      else S.streak = 0;
      S.lastDay = day;
    }
    S.lessons++;
    if (L.kind === 'daily') S.dailyDay = day;
    // only a real path lesson counts as a completed unit
    var nextUnit = null;
    var mistakes = (L.wrongItems || []).slice();
    if (L.kind === 'lesson' && L.unit && L.unit.id) {
      var idx = DS.units.map(function (u) { return u.id; }).indexOf(L.unit.id);
      if (idx >= 0 && DS.units[idx + 1]) {
        nextUnit = DS.units[idx + 1];
        if (S.unitsDone.indexOf(L.unit.id) < 0) {
          S.unitsDone.push(L.unit.id);
          /* The next lesson stays shut until the mistakes of this one are
             answered right. A wrong answer is not a mistake you can carry
             into the next lesson — you fix it here, now. */
          if (mistakes.length) {
            S.gate = {
              unit: nextUnit.id, items: mistakes, from: L.unit.id,
              qs: (L.wrongQs || []).slice(), at: Date.now()
            };
          } else {
            S.unlocked[DS.units[idx + 1].id] = true;
          }
        }
      }
    }
    save();
    setText('#r-xp', '+' + L.xp);
    setText('#r-acc', acc + '%');
    setText('#r-streak', S.streak);
    setText('#r-lbl-xp', 'XP');
    setText('#r-lbl-acc', 'accuracy');
    setText('#r-lbl-streak', 'day streak');
    setText('#r-lbl-souls', 'souls');
    // the shop pays you back: a lesson is worth souls, a flawless one more
    var soulPay = 0, soulWhy = '';
    if (L.kind === 'daily') {
      soulPay = SOUL_RULES.daily;
      soulWhy = 'daily run';
    } else {
      soulPay = acc >= 100 ? SOUL_RULES.perfect : SOUL_RULES.lesson;
      soulWhy = acc >= 100 ? 'flawless lesson' : 'lesson finished';
    }
    awardSouls(soulPay, soulWhy);
    setText('#r-souls', '+' + soulPay);
    if (mistakes.length) {
      setText('#result-emoji', '🔧');
      setText('#result-title', mistakes.length === 1 ? 'Almost there' : 'Not quite yet');
    } else {
      setText('#result-emoji', acc >= 90 ? '🏆' : acc >= 60 ? '💪' : '🔧');
      setText('#result-title', acc >= 90 ? 'Flawless!' : acc >= 60 ? 'Nice work!' : 'Keep grinding');
    }
    setText('#result-note', nextUnit && mistakes.length
      ? 'The next lesson stays locked until you get the ' + mistakes.length +
        (mistakes.length === 1 ? ' item' : ' items') + ' you missed right.'
      : '');
    mascotMood(mistakes.length ? '' : (acc >= 90 ? 'perfect' : (acc >= 60 ? 'good' : '')));
    var box = $('#result-items');
    box.innerHTML = '';
    var seen = {};
    L.qs.forEach(function (q) { seen[q.item] = 1; });
    Object.keys(seen).forEach(function (s) {
      var it = DS.items[s], m = mst(s);
      var row = el('div', 'ri');
      var img = el('img'); img.src = it.icon; img.alt = '';
      row.appendChild(img);
      row.appendChild(el('div', 'ri-name', it.name));
      var bar = el('div', 'bar'); var i2 = el('i'); i2.style.width = (Math.min(1, m.box / 5) * 100) + '%'; bar.appendChild(i2);
      row.appendChild(bar);
      row.appendChild(el('div', 'ri-box', 'L' + m.box));
      box.appendChild(row);
    });
    $('#progress-fill').style.width = '100%';
    // offer the next lesson straight away when the path has one — but only
    // when there is nothing left to fix
    var nextBtn = $('#result-next');
    if (nextUnit && mistakes.length) {
      nextBtn.hidden = false;
      nextBtn.textContent = 'FIX THE MISTAKES (' + mistakes.length + ')';
      nextBtn.className = 'btn btn-red btn-block';
      nextBtn.onclick = function () { nextBtn.hidden = true; startFixMistakes(); };
    } else if (nextUnit) {
      nextBtn.hidden = false;
      nextBtn.className = 'btn btn-green btn-block';
      nextBtn.textContent = 'NEXT LESSON · ' + nextUnit.title.toUpperCase();
      nextBtn.onclick = function () { nextBtn.hidden = true; startLesson(nextUnit.id); };
    } else {
      nextBtn.hidden = true;
      nextBtn.onclick = null;
    }
    show('result');
    sfxDone();
    if (acc >= 60) confetti();
    // the counters in the top bar move while the result screen is on
    renderAll();
    // a goal that has just been reached deserves a word
    var goal = Number(S.settings.goal) || 12;
    if ((S.todayCount || 0) >= goal && (S.todayCount || 0) - L.qs.length < goal) {
      setTimeout(function () { toast('✓ Daily goal reached'); }, 900);
    }
  }

  // ------------------------------------------------------------ confetti
  function confetti() {
    if (S.settings.motion) return;
    var host = $('#confetti');
    host.innerHTML = '';
    var colors = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#FF9600', '#A560E8'];
    for (var i = 0; i < 40; i++) {
      var p = el('i', 'conf');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.35) + 's';
      p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      host.appendChild(p);
    }
    setTimeout(function () { host.innerHTML = ''; }, 2200);
  }

  // --------------------------------------------------------- auth screen
  var authMode = 'signup';   // signup | signin
  var authKind = 'name';     // name | email
  var authStep = 'form';     // form | verify | reset
  var authEmail = '';
  var authCode = '';

  function showField(id, show) {
    var n = $(id);
    if (n) n.hidden = !show;
    var lbl = document.querySelector('label[for="' + id.slice(1) + '"]');
    if (lbl) lbl.hidden = !show;
  }

  function renderAuth() {
    var signup = authMode === 'signup';
    var byMail = authKind === 'email';
    var verifying = authStep === 'verify';
    var resetting = authStep === 'reset';
    var changing = authStep === 'passwd';

    setText('#auth-title', verifying ? 'Confirm your email'
      : resetting ? 'Reset your password'
      : changing ? 'Change your password'
      : signup ? (byMail ? 'Create your account' : 'Create your profile')
      : 'Welcome back');
    setText('#auth-sub', verifying
      ? 'Enter the code for ' + authEmail + '.'
      : resetting
      ? 'Enter the code and a new password for ' + authEmail + '.'
      : changing
      ? 'Enter your current password and a new one.'
      : byMail
        ? (signup ? 'Your progress stays on this device and is tied to the email.'
                  : 'Sign in with the email you signed up with.')
        : (signup ? 'Your progress is saved on this device only.'
                  : 'Sign in to pick up where you left off.'));
    setText('#auth-submit', verifying ? 'CONFIRM'
      : resetting ? 'SET NEW PASSWORD'
      : changing ? 'UPDATE PASSWORD'
      : signup ? (byMail ? 'CREATE ACCOUNT' : 'CREATE PROFILE') : 'SIGN IN');
    setText('#auth-switch', signup ? 'I already have a profile' : 'Create a new profile');

    showField('#auth-name', !verifying && !resetting && !changing);
    showField('#auth-email', byMail && !changing);
    showField('#auth-code', verifying || resetting);
    showField('#auth-pass', !verifying);
    showField('#auth-pass2', changing);
    setText('#lbl-auth-name', byMail ? 'Display name (optional)' : 'Name');
    setText('#lbl-auth-pass', changing ? 'Current password' : 'Password');
    var pass = $('#auth-pass');
    if (pass) pass.setAttribute('autocomplete', changing || signup ? 'new-password' : 'current-password');
    var pass2 = $('#auth-pass2');
    if (pass2) pass2.value = '';

    var seg = $('#auth-kind-seg');
    if (seg) seg.hidden = verifying || resetting || changing;
    $$('#auth-kind-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.kind === authKind);
    });
    var forgot = $('#auth-forgot'), sw = $('#auth-switch'), gs = $('#auth-guest'), rs = $('#auth-resend');
    if (forgot) forgot.hidden = !(byMail && !signup && !verifying && !resetting && !changing);
    if (sw) sw.hidden = verifying || resetting || changing;
    if (gs) gs.hidden = verifying || resetting || changing;
    if (rs) rs.hidden = !(verifying || resetting);

    var note = $('#auth-note');
    if (note) {
      var msg = '';
      if (verifying || resetting) {
        msg = 'This prototype has no server, so the code is shown here instead of being emailed. ' +
              'Your code is <b>' + (authCode || '······') + '</b>';
      }
      note.innerHTML = msg;
      note.hidden = !msg;
    }
    setText('#auth-error', '');
    var code = $('#auth-code');
    if (code) code.value = '';

    // offer to carry the guest progress over
    var guest = load(PROFILE_PREFIX + GUEST);
    var guestItems = Object.keys(guest.mastery || {}).length;
    var old = $('#guest-import');
    if (old) old.parentNode.removeChild(old);
    if (signup && !verifying && !resetting && !changing && guestItems > 0) {
      var row = el('label', 'guest-import');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = true;
      row.appendChild(cb);
      row.appendChild(el('span', null, 'Keep my guest progress (' + guestItems + ' items)'));
      $('#auth-error').parentNode.insertBefore(row, $('#auth-error'));
      row.id = 'guest-import';
    }
  }

  function finishAuth(name) {
    // carry the guest progress over when asked
    var gi = $('#guest-import');
    if (gi && gi.querySelector('input').checked) {
      var guest = null;
      try { guest = localStorage.getItem(PROFILE_PREFIX + GUEST); } catch (e) { }
      if (guest) {
        try { localStorage.setItem(PROFILE_PREFIX + name, guest); } catch (e) { }
        try { localStorage.removeItem(PROFILE_PREFIX + GUEST); } catch (e) { }
      }
    }
    if (!DSA.setSession(name)) {
      setText('#auth-error', 'This browser is not saving anything, so the profile cannot be stored here.');
      return;
    }
    reloadProfile();
    show('profile');
  }

  function doAuth() {
    var pw = $('#auth-pass').value;
    var res, err;

    if (authStep === 'passwd') {
      // #auth-pass holds the current password, #auth-pass2 the new one
      var newPw = $('#auth-pass2').value;
      var nerr2 = DSA.validPassword(newPw);
      if (nerr2) { setText('#auth-error', nerr2); buzz(60); return; }
      res = DSA.changePassword(profileName(), pw, newPw);
      if (!res.ok) { setText('#auth-error', res.error); buzz(60); return; }
      var box = $('#auth-error');
      box.className = 'auth-error ok';
      box.textContent = 'Password updated.';
      sfxOk();
      setTimeout(function () { show('profile'); }, 700);
      return;
    }

    if (authStep === 'verify') {
      res = DSA.verifyAccount(authEmail, $('#auth-code').value);
      if (!res.ok) { setText('#auth-error', res.error); buzz(60); return; }
      finishAuth(res.name);
      return;
    }
    if (authStep === 'reset') {
      res = DSA.resetPassword(authEmail, $('#auth-code').value, pw);
      if (!res.ok) { setText('#auth-error', res.error); buzz(60); return; }
      finishAuth(res.name);
      return;
    }

    if (authKind === 'email') {
      var email = DSA.normaliseEmail($('#auth-email').value);
      err = DSA.validEmail(email);
      if (err) { setText('#auth-error', err); buzz(60); return; }
      err = DSA.validPassword(pw);
      if (err) { setText('#auth-error', err); buzz(60); return; }
      if (authMode === 'signup') {
        res = DSA.signUpEmail(email, pw, $('#auth-name').value);
        if (res.ok) {
          authEmail = email; authCode = res.code; authStep = 'verify';
          renderAuth();
          return;
        }
      } else {
        res = DSA.signInEmail(email, pw);
        if (!res.ok && res.needCode) {
          // the account exists but was never confirmed — send a fresh code
          var again = DSA.resendCode(email);
          authEmail = email; authCode = again.code; authStep = 'verify';
          renderAuth();
          setText('#auth-error', res.error);
          return;
        }
      }
    } else {
      var name = $('#auth-name').value;
      err = DSA.validName(name);
      if (err) { setText('#auth-error', err); buzz(60); return; }
      err = DSA.validPassword(pw);
      if (err) { setText('#auth-error', err); buzz(60); return; }
      if (authMode === 'signup') {
        if (DSA.exists(name)) { setText('#auth-error', 'That name is taken on this device.'); buzz(60); return; }
        res = DSA.signUp(name, pw);
      } else {
        res = DSA.signIn(name, pw);
      }
    }
    if (!res.ok) { setText('#auth-error', res.error); buzz(60); return; }
    finishAuth(res.name);
  }

  function requestCode() {
    var email = DSA.normaliseEmail($('#auth-email').value);
    var err = DSA.validEmail(email);
    if (err) { setText('#auth-error', err); buzz(60); return; }
    var res = authStep === 'reset' ? DSA.requestReset(email) : DSA.resendCode(email);
    if (!res.ok) { setText('#auth-error', res.error); buzz(60); return; }
    authEmail = email; authCode = res.code;
    if (authStep === 'form') authStep = 'reset';
    renderAuth();
  }

  function signOut() {
    DSA.setSession(null);
    reloadProfile();
    show('path');
  }

  // ------------------------------------------------------- profile screen
  var profileFrom = 'path';  var AVATARS = ['owl', 'burst-fire', 'swift-striker', 'silence-wave', 'boundless-spirit',
    'mystic-reverb', 'improved-spirit', 'juggernaut', 'healing-tempo', 'phantom-strike',
    'surge-of-power', 'superior-cooldown', 'knockdown', 'tankbuster'];
  function openProfile() {
    profileFrom = (current === 'profile') ? 'path' : current;
    show('profile');
  }
  function avatarUrl(slug) {
    if (!slug || slug === 'owl') return 'assets/owl.svg';
    return 'assets/icons/' + slug + '.png';
  }
  function displayLabel() {
    var n = profileName();
    if (S.display) return S.display;
    return n ? DSA.displayName(n) : 'Guest';
  }

  function renderProfile() {
    var name = profileName();
    var lessons = S.lessons;
    var label = displayLabel();
    setText('#profile-name', label);
    var av = $('#profile-avatar');
    av.innerHTML = '<img src="' + avatarUrl(S.avatar) + '" alt="" width="54" height="54">';
    av.classList.add('owl-avatar');
    setText('#profile-meta', (name ? label + ' · ' : '') + league() + ' · ' + S.xp + ' XP · ' +
      lessons + (lessons === 1 ? ' lesson' : ' lessons'));

    // account details
    var mail = name ? DSA.emailOf(name) : null;
    setText('#set-email', mail || (name ? 'profile name only' : 'not set — create a profile'));
    var disp = $('#profile-display');
    if (disp) disp.value = S.display || (name ? DSA.displayName(name) : '');

    // daily goal + how far today is
    var goal = Number(S.settings.goal) || 12;
    $$('#goal-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.goal) === goal);
    });
    setText('#set-today', (S.todayCount || 0) + ' / ' + goal + ' questions');

    // audio state — the quickest way to tell a silent phone from a broken one
    var as = $('#audio-state');
    if (as) {
      var st = !S.settings.sound ? 'off' : (AC ? AC.state : 'idle');
      as.textContent = st;
      as.className = 'set-meta' + (st === 'running' ? ' ok' : '');
    }

    // avatar picker
    var pick = $('#avatar-picker');
    if (pick) {
      pick.innerHTML = '';
      AVATARS.forEach(function (slug) {
        var b = el('button', 'ava' + ((S.avatar || 'owl') === slug ? ' on' : ''));
        b.type = 'button';
        b.title = slug === 'owl' ? 'Guided Owl' : (DS.items[slug] ? DS.items[slug].name : slug);
        b.innerHTML = '<img src="' + avatarUrl(slug) + '" alt="">';
        b.addEventListener('click', function () {
          S.avatar = slug; save(); renderProfile();
        });
        pick.appendChild(b);
      });
    }

    // guest banner
    var banner = $('#guest-banner');
    banner.style.display = name ? 'none' : '';
    var guest = load(PROFILE_PREFIX + GUEST);
    var gItems = Object.keys(guest.mastery || {}).length;
    setText('#guest-note', gItems
      ? 'You are playing as a guest with ' + gItems + ' item' + (gItems === 1 ? '' : 's') + ' studied. '
        + 'Create a profile to keep this progress.'
      : 'You are playing as a guest. Create a profile to keep your progress separate from other players on this device.');

    var box = $('#profile-list');
    box.innerHTML = '';
    var users = DSA.listUsers();
    if (!users.length) box.appendChild(el('div', 'footnote', 'No profiles yet — create one to keep your progress separate.'));
    users.forEach(function (u) {
      var row = el('div', 'prow' + (u.name === name ? ' on' : ''));
      var av = el('div', 'avatar small', (u.display || u.name).charAt(0).toUpperCase());
      row.appendChild(av);
      var body = el('div', 'pr-body');
      body.appendChild(el('div', 'pr-name', u.display || u.name));
      body.appendChild(el('div', 'pr-meta', u.name === name ? 'Current profile'
        : (u.email ? u.email : 'Tap to switch')));
      row.appendChild(body);
      row.addEventListener('click', function () {
        DSA.setSession(u.name);
        reloadProfile();
        show('path');
      });
      box.appendChild(row);
    });

    var so = $('#signout-btn');
    so.style.display = name ? '' : 'none';
    renderCosmetics();
    applySettings();
    applyCosmetics();
  }

  function doExport() {
    var data = JSON.stringify({ profile: profileName() || 'guest', at: new Date().toISOString(), progress: S }, null, 2);
    try {
      var blob = new Blob([data], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'deadshop-progress.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) {
      alert('Export is not available in this browser.');
    }
  }

  /* Import a progress file that came from another device. Only the fields the
     app knows about are taken, and the numbers are checked before anything is
     written — a broken file must never wipe a profile. */
  function doImport(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data = null;
      try { data = JSON.parse(String(reader.result)); } catch (e) { }
      if (!data || typeof data !== 'object') {
        alert('That file is not a DeadShop progress file.');
        return;
      }
      var p = (data.progress && typeof data.progress === 'object') ? data.progress : data;
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        alert('That file does not contain any progress.');
        return;
      }
      var merged = JSON.parse(JSON.stringify(DEFAULTS));
      var taken = 0;
      Object.keys(merged).forEach(function (k) {
        if (p[k] === undefined || p[k] === null) return;
        if (k === 'settings') return;
        if (k === 'xp' || k === 'streak' || k === 'right' || k === 'wrong' ||
            k === 'lessons' || k === 'todayCount' || k === 'souls' || k === 'soulsEarned') {
          if (typeof p[k] === 'number' && isFinite(p[k])) { merged[k] = p[k]; taken++; }
          return;
        }
        if (k === 'mastery' || k === 'unlocked' || k === 'seen' || k === 'history' ||
            k === 'soulsLedger' || k === 'equipped' || k === 'bughunt') {
          if (typeof p[k] === 'object' && !Array.isArray(p[k])) { merged[k] = p[k]; taken++; }
          return;
        }
        if (k === 'cosmetics' && Array.isArray(p[k])) {
          merged.cosmetics = p[k].filter(function (id) { return !!COS_BY_ID[id]; });
          taken++;
          return;
        }
        if (k === 'unitsDone' && Array.isArray(p[k])) {
          merged.unitsDone = p[k].filter(function (id) { return !!UNIT_IDS[id]; });
          taken++;
          return;
        }
        if (typeof p[k] === 'string' || p[k] === null) { merged[k] = p[k]; taken++; }
      });
      merged.settings = Object.assign({}, DEFAULTS.settings, p.settings || {});
      merged.unitsDone = (merged.unitsDone || []).filter(function (id) { return !!UNIT_IDS[id]; });
      if (!taken) {
        alert('That file does not contain any DeadShop progress.');
        return;
      }
      if (!confirm('Importing replaces the progress of this profile (' +
          (profileName() || 'guest') + '). Continue?')) return;
      try { localStorage.setItem(storageKey(), JSON.stringify(merged)); }
      catch (e) { alert('This browser is not saving anything, so the import failed.'); return; }
      reloadProfile();
      show('path');
      toast('Progress imported');
    };
    reader.onerror = function () { alert('That file could not be read.'); };
    try { reader.readAsText(file); }
    catch (e) { alert('That file could not be read.'); }
  }

  function doReset() {
    if (!confirm('Reset all progress for this profile? This cannot be undone.')) return;
    try { localStorage.removeItem(storageKey()); } catch (e) { }
    reloadProfile();
    show('path');
  }

  // ==================================================================
  // SOULS
  // The shop pays you back for the lessons you finish, and you spend
  // the souls on cosmetics. The balance lives in the profile, so an
  // export carries it to another device.
  // ==================================================================
  var SOUL_RULES = {
    lesson: 2,      // a finished path lesson
    perfect: 5,     // a lesson without a single mistake
    daily: 3,       // the daily run
    exam: 2         // a self-test
  };

  function souls() { return Math.max(0, Number(S.souls) || 0); }
  function soulLedger() { return Array.isArray(S.soulsLedger) ? S.soulsLedger : []; }

  function awardSouls(n, why) {
    n = Math.round(Number(n) || 0);
    if (!n) return 0;
    S.souls = souls() + n;
    if (n > 0) S.soulsEarned = (Number(S.soulsEarned) || 0) + n;
    S.soulsLedger = soulLedger().concat([{ at: Date.now(), amount: n, why: why || '' }]);
    if (S.soulsLedger.length > 40) S.soulsLedger = S.soulsLedger.slice(-40);
    save();
    renderSouls();
    return n;
  }
  function spendSouls(n, why) {
    n = Math.round(Number(n) || 0);
    if (souls() < n) return false;
    S.souls = souls() - n;
    S.soulsLedger = soulLedger().concat([{ at: Date.now(), amount: -n, why: why || '' }]);
    save();
    renderSouls();
    return true;
  }

  function renderSouls() {
    var v = souls();
    setText('#souls-val', v);
    setText('#nav-souls', v);
    setText('#souls-balance', v);
    setText('#souls-earned', (Number(S.soulsEarned) || 0) + ' earned');
    var why = $('#souls-why');
    if (why) {
      var last = soulLedger().slice(-1)[0];
      if (!last) {
        why.textContent = 'Finish a lesson and the shop pays you back. A lesson is worth ' +
          SOUL_RULES.lesson + ' souls, a flawless one ' + SOUL_RULES.perfect + '.';
      } else {
        why.textContent = 'Last time: ' + (last.why || 'something') + ' (' +
          (last.amount >= 0 ? '+' : '') + last.amount + ' souls)';
      }
    }
  }

  // ---------------------------------------------------------- cosmetics
  var COSMETICS = [
    { id: 'acc-teal', kind: 'accent', name: 'Shop Teal', cost: 0, desc: 'The colour of the shop itself.' },
    { id: 'acc-cyan', kind: 'accent', name: 'Soul Cyan', cost: 25, desc: 'Cold light on every panel.' },
    { id: 'acc-amber', kind: 'accent', name: 'Amber Cache', cost: 40, desc: 'Warm gold, like a soul in a jar.' },
    { id: 'acc-violet', kind: 'accent', name: 'Void Violet', cost: 60, desc: 'The colour of a rift.' },
    { id: 'acc-crimson', kind: 'accent', name: 'Blood Moon', cost: 60, desc: 'Deep red, no questions asked.' },
    { id: 'aur-none', kind: 'aura', name: 'Plain Owl', cost: 0, desc: 'No glow at all.' },
    { id: 'aur-frost', kind: 'aura', name: 'Frost Aura', cost: 30, desc: 'A cold ring around the owl.' },
    { id: 'aur-ember', kind: 'aura', name: 'Ember Aura', cost: 30, desc: 'A warm ring around the owl.' },
    { id: 'aur-void', kind: 'aura', name: 'Void Aura', cost: 50, desc: 'A dark ring around the owl.' },
    { id: 'frm-none', kind: 'frame', name: 'No Frame', cost: 0, desc: 'A plain avatar.' },
    { id: 'frm-hex', kind: 'frame', name: 'Hex Frame', cost: 25, desc: 'Cut corners, Deadlock style.' },
    { id: 'frm-gold', kind: 'frame', name: 'Soul Frame', cost: 45, desc: 'Gold around the owl.' }
  ];
  var COS_BY_ID = {};
  COSMETICS.forEach(function (c) { COS_BY_ID[c.id] = c; });
  var ACCENTS = {
    'acc-teal': { cls: 'acc-teal', main: '#3DDCC8', dark: '#1FA795', lite: '#D8F7F2' },
    'acc-cyan': { cls: 'acc-cyan', main: '#22D3EE', dark: '#0E7490', lite: '#CFFAFE' },
    'acc-amber': { cls: 'acc-amber', main: '#F5A524', dark: '#B45309', lite: '#FDEBCC' },
    'acc-violet': { cls: 'acc-violet', main: '#A78BFA', dark: '#6D28D9', lite: '#EDE9FE' },
    'acc-crimson': { cls: 'acc-crimson', main: '#F87171', dark: '#991B1B', lite: '#FEE2E2' }
  };
  var COS_KINDS = [
    { id: 'accent', title: 'Colour of the shop' },
    { id: 'aura', title: 'The owl’s aura' },
    { id: 'frame', title: 'Avatar frame' }
  ];

  function cosOwned(id) {
    var c = COS_BY_ID[id];
    if (!c) return false;
    if (c.cost === 0) return true;
    return (S.cosmetics || []).indexOf(id) >= 0;
  }
  function cosEquipped(kind) {
    var eq = S.equipped || {};
    var id = eq[kind];
    if (id && cosOwned(id)) return id;
    // the free one of that kind is worn until something else is bought
    for (var i = 0; i < COSMETICS.length; i++) {
      var c = COSMETICS[i];
      if (c.kind === kind && c.cost === 0) return c.id;
    }
    return '';
  }
  function applyCosmetics() {
    var body = document.body;
    if (!body) return;
    // the accent is a class on <body>: the dark theme keeps its own tint of
    // the colour, so a cyan accent never turns a dark panel light
    Object.keys(ACCENTS).forEach(function (id) { body.classList.remove(ACCENTS[id].cls); });
    var acc = ACCENTS[cosEquipped('accent')] || ACCENTS['acc-teal'];
    body.classList.add(acc.cls);
    ['aura-frost', 'aura-ember', 'aura-void', 'frm-hex', 'frm-gold'].forEach(function (c) {
      body.classList.remove(c);
    });
    var aura = cosEquipped('aura');
    if (aura && aura !== 'aur-none') body.classList.add(aura);
    var frame = cosEquipped('frame');
    if (frame && frame !== 'frm-none') body.classList.add(frame);
  }
  function equipCosmetic(id) {
    var c = COS_BY_ID[id];
    if (!c || !cosOwned(id)) return;
    S.equipped = S.equipped || {};
    S.equipped[c.kind] = id;
    save();
    applyCosmetics();
    renderCosmetics();
  }
  function buyCosmetic(id) {
    var c = COS_BY_ID[id];
    if (!c) return;
    if (cosOwned(id)) { equipCosmetic(id); return; }
    if (!spendSouls(c.cost, c.name)) { toast('Not enough souls'); return; }
    S.cosmetics = (S.cosmetics || []).concat([id]);
    S.equipped = S.equipped || {};
    S.equipped[c.kind] = id;
    save();
    applyCosmetics();
    renderCosmetics();
    toast(c.name + ' unlocked');
  }
  function renderCosmetics() {
    var box = $('#cos-shop');
    if (!box) return;
    box.innerHTML = '';
    COS_KINDS.forEach(function (kind) {
      var wrap = el('div', 'cos-group');
      wrap.appendChild(el('div', 'cos-group-t', kind.title));
      var grid = el('div', 'cos-grid');
      COSMETICS.forEach(function (c) {
        if (c.kind !== kind.id) return;
        var owned = cosOwned(c.id);
        var on = cosEquipped(kind.id) === c.id;
        var card = el('div', 'cos-card' + (on ? ' on' : '') + (owned ? ' owned' : ''));
        card.appendChild(el('div', 'cos-name', c.name));
        card.appendChild(el('div', 'cos-desc', c.desc));
        var foot = el('div', 'cos-foot');
        if (owned) {
          foot.appendChild(el('div', 'cos-cost', on ? 'worn' : 'owned'));
        } else {
          var cost = el('div', 'cos-cost');
          cost.innerHTML = '<img src="assets/soul.svg" alt=""> ' + c.cost;
          foot.appendChild(cost);
        }
        var btn = el('button', 'cos-btn' + (owned ? ' ghost' : ' buy'), owned ? (on ? 'ON' : 'WEAR') : 'BUY');
        btn.type = 'button';
        if (!owned && souls() < c.cost) btn.setAttribute('disabled', 'disabled');
        btn.addEventListener('click', function () {
          if (owned) equipCosmetic(c.id); else buyCosmetic(c.id);
        });
        foot.appendChild(btn);
        card.appendChild(foot);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      box.appendChild(wrap);
    });
  }

  // ==================================================================
  // BUGHUNT
  // A bug report is a small text file with a code in front of it. The
  // reporter copies the code and sends it; whoever runs the site reads
  // it, decides whether the report is worth something, and sends a
  // reward code back.
  // ==================================================================
  var BH_REPORT = 'DSB1-';
  var BH_GRANT = 'DSG1-';

  function bhState() {
    if (!S.bughunt || typeof S.bughunt !== 'object') S.bughunt = {};
    var b = S.bughunt;
    if (!Array.isArray(b.reports)) b.reports = [];
    if (!Array.isArray(b.inbox)) b.inbox = [];
    if (!Array.isArray(b.grants)) b.grants = [];
    return b;
  }

  function b64e(str) {
    var out;
    try {
      var bytes = new TextEncoder().encode(str);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      out = btoa(bin);
    } catch (e) {
      out = btoa(unescape(encodeURIComponent(str)));
    }
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    try {
      var bin = atob(t);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return decodeURIComponent(escape(atob(t)));
    }
  }
  function bhCode(rep) {
    return BH_REPORT + b64e(JSON.stringify({ t: 'report', v: 1, r: rep }));
  }
  function grantCode(id, amount, note, to) {
    return BH_GRANT + b64e(JSON.stringify({ t: 'grant', v: 1, id: id, souls: amount, note: note || '', to: to || '' }));
  }
  function bhKindName(k) {
    return { data: 'wrong data', ui: 'layout', question: 'question', other: 'other' }[k] || 'bug';
  }

  function bhSubmit() {
    var what = ($('#bh-what') && $('#bh-what').value || '').trim();
    if (!what) {
      toast('Say what went wrong first');
      if ($('#bh-what')) $('#bh-what').focus();
      return;
    }
    var kind = 'data';
    var kb = $('#bh-kind .seg-btn.on');
    if (kb && kb.dataset.kind) kind = kb.dataset.kind;
    var rep = {
      id: 'R' + Date.now().toString(36) + Math.floor(Math.random() * 4096).toString(36),
      at: Date.now(),
      kind: kind,
      where: ($('#bh-where') && $('#bh-where').value || '').trim(),
      what: what,
      steps: ($('#bh-steps') && $('#bh-steps').value || '').trim(),
      contact: ($('#bh-contact') && $('#bh-contact').value || '').trim()
    };
    var b = bhState();
    b.reports.unshift(rep);
    save();
    ['#bh-what', '#bh-steps', '#bh-where', '#bh-contact'].forEach(function (sel) {
      var n = $(sel); if (n) n.value = '';
    });
    renderBughunt();
    var done = $('#bh-done');
    if (done) {
      done.innerHTML = '';
      var card = el('div', 'bh-report');
      card.appendChild(el('div', 'bh-report-t', 'Report sent — here is your code'));
      var note = el('div', 'bh-note', 'Copy this code and send it to whoever runs DeadShop. ' +
        'If the report is one we can act on, you get souls for it — a reward code comes back the same way.');
      card.appendChild(note);
      var code = el('div', 'bh-code', bhCode(rep));
      card.appendChild(code);
      var actions = el('div', 'bh-actions');
      var copyBtn = el('button', 'btn btn-green btn-sm', 'COPY THE CODE');
      copyBtn.type = 'button';
      copyBtn.addEventListener('click', function () {
        copyText(bhCode(rep), 'Report code copied');
      });
      actions.appendChild(copyBtn);
      var mailBtn = el('button', 'btn btn-ghost btn-sm btn-plain', 'COPY AS TEXT');
      mailBtn.type = 'button';
      mailBtn.addEventListener('click', function () {
        copyText(bhReportText(rep), 'Report copied');
      });
      actions.appendChild(mailBtn);
      if (ISSUES_URL || SUPPORT_EMAIL) {
        var ghBtn = el('button', 'btn btn-ghost btn-sm btn-plain', 'OPEN AN ISSUE');
        ghBtn.type = 'button';
        ghBtn.addEventListener('click', function () {
          reportToTracker(bhReportText(rep) + '\n\n--- diagnostics ---\n' + diagnostics(),
            'Bug: ' + bhKindName(rep.kind));
        });
        actions.appendChild(ghBtn);
      }
      card.appendChild(actions);
      done.appendChild(card);
    }
    toast('Report saved');
  }

  function bhReportText(rep) {
    return 'DeadShop bug report (' + bhKindName(rep.kind) + ')\n' +
      'Where: ' + (rep.where || 'not said') + '\n' +
      'What happened: ' + rep.what + '\n' +
      'How to reproduce: ' + (rep.steps || 'not said') + '\n' +
      'Contact: ' + (rep.contact || 'not given') + '\n' +
      'Code: ' + bhCode(rep);
  }

  function bhImportReport(rep) {
    if (!rep || !rep.id) return false;
    var b = bhState();
    for (var i = 0; i < b.inbox.length; i++) if (b.inbox[i].id === rep.id) return false;
    b.inbox.unshift(rep);
    save();
    renderBughunt();
    return true;
  }

  function bhApplyGrant(g) {
    if (!g || !g.id) return false;
    var b = bhState();
    for (var i = 0; i < b.grants.length; i++) if (b.grants[i] === g.id) return false;
    b.grants.push(g.id);
    save();
    awardSouls(Number(g.souls) || 0, g.note || 'bughunt reward');
    renderBughunt();
    return true;
  }

  function bhApplyCode() {
    var node = $('#bh-code');
    var raw = (node && node.value || '').trim();
    if (!raw) { toast('Paste a code first'); return; }
    var body = raw.replace(/\s+/g, '');
    var payload = null;
    try {
      if (body.indexOf(BH_REPORT) === 0) payload = JSON.parse(b64d(body.slice(BH_REPORT.length)));
      else if (body.indexOf(BH_GRANT) === 0) payload = JSON.parse(b64d(body.slice(BH_GRANT.length)));
      else payload = JSON.parse(b64d(body));
    } catch (e) {
      toast('That code does not look like one of ours');
      return;
    }
    if (!payload || !payload.t) { toast('That code does not look like one of ours'); return; }
    if (payload.t === 'report') {
      if (bhImportReport(payload.r)) toast('Report imported');
      else toast('That report is already in the inbox');
    } else if (payload.t === 'grant') {
      if (bhApplyGrant(payload)) toast('+' + (payload.souls || 0) + ' souls');
      else toast('That reward was already redeemed');
    } else {
      toast('That code does not look like one of ours');
    }
    if (node) node.value = '';
  }

  function renderBughunt() {
    var b = bhState();
    var mine = $('#bh-mine');
    if (mine) {
      mine.innerHTML = '';
      if (!b.reports.length) {
        mine.appendChild(el('div', 'bh-empty', 'Nothing yet. The first report you send shows up here.'));
      } else {
        b.reports.forEach(function (rep) {
          mine.appendChild(bhReportRow(rep, false));
        });
      }
    }
    var inbox = $('#bh-inbox');
    if (inbox) {
      inbox.innerHTML = '';
      if (!b.inbox.length) {
        inbox.appendChild(el('div', 'bh-empty',
          'No reports yet. A reporter sends you a DSB1-… code; paste it in “I have a code” above and it lands here.'));
      } else {
        b.inbox.forEach(function (rep) {
          inbox.appendChild(bhReportRow(rep, true));
        });
      }
    }
  }

  function bhReportRow(rep, owner) {
    var row = el('div', 'bh-row');
    var body = el('div', 'bh-row-b');
    body.appendChild(el('div', 'bh-row-t', rep.what));
    var meta = [];
    meta.push(bhKindName(rep.kind));
    if (rep.where) meta.push(rep.where);
    if (rep.steps) meta.push('steps given');
    if (rep.contact) meta.push(rep.contact);
    body.appendChild(el('div', 'bh-row-m', meta.join(' · ')));
    if (owner) {
      var amount = el('input', 'bh-amount');
      amount.type = 'number';
      amount.min = '0';
      amount.value = '25';
      amount.setAttribute('aria-label', 'Souls to award');
      var pay = el('button', 'cos-btn buy', 'REWARD');
      pay.type = 'button';
      pay.addEventListener('click', function () {
        var n = Math.max(0, Math.round(Number(amount.value) || 0));
        if (!n) { toast('Put a number of souls in the box'); return; }
        var gid = 'G' + Date.now().toString(36);
        rep.status = 'rewarded';
        rep.awarded = n;
        var code = grantCode(gid, n, 'bughunt reward', rep.contact);
        rep.grant = code;
        save();
        renderBughunt();
        toast('Reward code ready — copy it and send it back');
      });
      var box = el('div', 'bh-actions');
      box.appendChild(amount);
      box.appendChild(pay);
      body.appendChild(box);
      if (rep.grant) {
        var codeBox = el('div', 'bh-code', rep.grant);
        body.appendChild(codeBox);
        var copyBtn = el('button', 'btn btn-green btn-sm', 'COPY THE REWARD CODE');
        copyBtn.type = 'button';
        copyBtn.addEventListener('click', function () { copyText(rep.grant, 'Reward code copied'); });
        var acts = el('div', 'bh-actions');
        acts.appendChild(copyBtn);
        body.appendChild(acts);
      }
    }
    row.appendChild(body);
    var tag = el('div', 'bh-row-s' + (rep.status === 'rewarded' ? ' rewarded' : ''),
      rep.status === 'rewarded' ? 'rewarded' : 'new');
    row.appendChild(tag);
    return row;
  }

  // ==================================================================
  // LATEST UPDATE
  // The app ships a snapshot of the shop. This screen compares it with
  // the live database and says what was buffed, what was nerfed and by
  // how much. The same diff runs in tools/shopdiff.py on the build
  // side, so the two always speak the same language.
  // ==================================================================
  var SHOP_SLOTS = {
    EItemSlotType_Tech: 'Spirit',
    EItemSlotType_Weapon: 'Weapon',
    EItemSlotType_Utility: 'Utility'
  };

  function prettyProp(key) {
    return String(key).replace(/([A-Z])/g, ' $1').replace(/^ /, '')
      .replace(/Bonus /, '').replace(/Percent/g, '%');
  }
  function canonLive(raw) {
    var items = (raw && raw.items) || [];
    var out = {};
    items.forEach(function (it) {
      var slug = it && it.slug;
      if (!slug) return;
      var shop = it.shop || {};
      var act = it.activation || {};
      var stats = {};
      var props = it.properties || {};
      Object.keys(props).forEach(function (pk) {
        var v = parseFloat((props[pk] || {}).value);
        if (!isNaN(v) && v !== 0) stats[pk] = v;
      });
      out[slug] = {
        name: ((it.displayName || {}).english) || slug,
        slot: SHOP_SLOTS[shop.slotType] || shop.slotType || '',
        tier: shop.tier || 0,
        cost: shop.cost || 0,
        activation: act.isPassive ? 'Passive' : (act.isImbue ? 'Imbue' : (act.isActive ? 'Active' : 'Passive')),
        updatedAt: String(it.updatedAt || '').slice(0, 10),
        stats: stats
      };
    });
    return out;
  }
  function diffCanon(oldItems, newItems, labels) {
    labels = labels || {};
    var added = [], removed = [], changed = [];
    Object.keys(newItems).forEach(function (slug) {
      if (!oldItems[slug]) added.push(newItems[slug]);
    });
    Object.keys(oldItems).forEach(function (slug) {
      if (!newItems[slug]) removed.push(oldItems[slug]);
    });
    Object.keys(newItems).forEach(function (slug) {
      var a = oldItems[slug], b = newItems[slug];
      if (!a) return;
      var ch = [], seen = {};
      Object.keys(a.stats).concat(Object.keys(b.stats)).forEach(function (pk) {
        if (seen[pk]) return;
        seen[pk] = 1;
        var av = a.stats[pk] || 0, bv = b.stats[pk] || 0;
        if (av === bv) return;
        var lab = labels[pk] || [prettyProp(pk), 'Other'];
        ch.push({
          prop: pk, label: lab[0], family: lab[1], kind: 'stat',
          old: av, new: bv, dir: bv > av ? 'up' : 'down'
        });
      });
      if (a.cost !== b.cost) ch.push({ prop: 'Cost', label: 'Soul cost', family: 'Economy', kind: 'cost', old: a.cost, new: b.cost, dir: b.cost > a.cost ? 'up' : 'down' });
      if (a.tier !== b.tier) ch.push({ prop: 'Tier', label: 'Tier', family: 'Economy', kind: 'tier', old: a.tier, new: b.tier, dir: b.tier > a.tier ? 'up' : 'down' });
      if (a.activation !== b.activation) ch.push({ prop: 'Activation', label: 'Activation', family: 'Economy', kind: 'activation', old: a.activation, new: b.activation, dir: 'change' });
      if (!ch.length) return;
      var ups = 0, downs = 0;
      ch.forEach(function (c) {
        if (c.kind !== 'stat') return;
        if (c.dir === 'up') ups++;
        if (c.dir === 'down') downs++;
      });
      var verdict = (ups && downs) ? 'mixed' : (ups ? 'buff' : (downs ? 'nerf' : 'change'));
      changed.push({
        slug: slug, name: b.name, slot: b.slot, tier: b.tier, cost: b.cost,
        verdict: verdict, changes: ch
      });
    });
    return {
      added: added, removed: removed, changed: changed,
      counts: {
        added: added.length, removed: removed.length, changed: changed.length,
        buffed: changed.filter(function (c) { return c.verdict === 'buff'; }).length,
        nerfed: changed.filter(function (c) { return c.verdict === 'nerf'; }).length,
        mixed: changed.filter(function (c) { return c.verdict === 'mixed'; }).length,
        other: changed.filter(function (c) { return c.verdict === 'change'; }).length
      }
    };
  }

  function updCounts(d) {
    var c = d.counts || {};
    return {
      added: c.added || 0, removed: c.removed || 0, changed: c.changed || 0,
      buffed: c.buffed || 0, nerfed: c.nerfed || 0, mixed: c.mixed || 0, other: c.other || 0
    };
  }

  function renderUpdates() {
    var cur = (window.DSU && DSU.current) || {};
    setText('#upd-current', 'Snapshot ' + (cur.snapshot || '—') + ' · build ' + (cur.build || '—') +
      ' · ' + (cur.items || 0) + ' items');
    var hist = $('#upd-history');
    if (hist) {
      hist.innerHTML = '';
      var entries = (window.DSU && DSU.history) || [];
      if (!entries.length) {
        hist.appendChild(el('div', 'upd-empty',
          'No patch has been recorded yet. The first entry appears here as soon as the ' +
          'shop files differ from the snapshot the app was built on.'));
      } else {
        entries.forEach(function (e) {
          hist.appendChild(updEntry(e));
        });
      }
    }
    renderTouched();
  }

  /* The game files say when each item was last written. The most recent
     dates are the ones a patch wrote — a hint of what to look at, even
     before the numbers themselves move. */
  function renderTouched() {
    var box = $('#upd-touched');
    if (!box) return;
    box.innerHTML = '';
    var base = window.DSS;
    if (!base || !base.items) return;
    var byDay = {};
    Object.keys(base.items).forEach(function (slug) {
      var it = base.items[slug];
      var day = (it.updatedAt || '').slice(0, 10);
      if (!day) return;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(it);
    });
    var days = Object.keys(byDay).sort().reverse();
    if (!days.length) {
      box.appendChild(el('div', 'upd-empty', 'The snapshot does not say when the items were written.'));
      return;
    }
    days.slice(0, 3).forEach(function (day, i) {
      var list = byDay[day];
      var head = el('div', 'upd-block-t', day + ' — ' + list.length +
        (list.length === 1 ? ' item was' : ' items were') + ' written');
      box.appendChild(head);
      var names = list.slice(0, 5).map(function (it) { return it.name; }).join(' · ');
      if (list.length > 5) names += ' · and ' + (list.length - 5) + ' more';
      box.appendChild(el('div', 'upd-empty', names));
      if (i === 0) {
        box.appendChild(el('div', 'upd-note',
          'A date means the game files were rewritten for that item. It does not mean the ' +
          'numbers changed — the check above is what says that.'));
      }
    });
  }

  function updEntry(e) {
    var block = el('div', 'upd-block');
    block.appendChild(el('div', 'upd-block-t', e.date || 'update'));
    var c = updCounts(e);
    var sum = el('div', 'upd-sum');
    if (c.buffed) sum.appendChild(el('div', 'upd-pill buff', c.buffed + ' buffed'));
    if (c.nerfed) sum.appendChild(el('div', 'upd-pill nerf', c.nerfed + ' nerfed'));
    if (c.mixed) sum.appendChild(el('div', 'upd-pill', c.mixed + ' mixed'));
    if (c.added) sum.appendChild(el('div', 'upd-pill new', c.added + ' new'));
    if (c.removed) sum.appendChild(el('div', 'upd-pill', c.removed + ' removed'));
    if (!sum.childNodes.length) sum.appendChild(el('div', 'upd-pill', 'no numbers moved'));
    block.appendChild(sum);
    (e.items || []).forEach(function (it) { block.appendChild(updItem(it)); });
    (e.added || []).forEach(function (it) {
      var row = el('div', 'upd-item');
      var t = el('div', 'upd-item-t');
      t.appendChild(el('div', 'upd-item-n', it.name));
      t.appendChild(el('div', 'upd-tag new', 'new'));
      row.appendChild(t);
      block.appendChild(row);
    });
    (e.removed || []).forEach(function (it) {
      var row = el('div', 'upd-item');
      var t = el('div', 'upd-item-t');
      t.appendChild(el('div', 'upd-item-n', it.name));
      t.appendChild(el('div', 'upd-tag change', 'gone'));
      row.appendChild(t);
      block.appendChild(row);
    });
    return block;
  }

  function updItem(it) {
    var row = el('div', 'upd-item');
    var t = el('div', 'upd-item-t');
    t.appendChild(el('div', 'upd-item-n', it.name));
    t.appendChild(el('div', 'upd-tag ' + it.verdict, it.verdict));
    t.appendChild(el('div', 'upd-item-m', 'Tier ' + it.tier + ' · ' + it.cost + ' souls'));
    row.appendChild(t);
    var chg = el('div', 'upd-chg');
    (it.changes || []).forEach(function (c) {
      var s = el('span', c.dir === 'up' ? 'up' : (c.dir === 'down' ? 'down' : ''));
      s.innerHTML = esc(c.label) + ' <b>' + esc(c.old) + '</b> → <b>' + esc(c.new) + '</b>';
      chg.appendChild(s);
    });
    row.appendChild(chg);
    return row;
  }

  function checkLiveShop() {
    var status = $('#upd-status');
    var out = $('#upd-live');
    if (out) out.innerHTML = '';
    if (status) {
      status.className = 'upd-status';
      status.textContent = 'Asking the live shop…';
    }
    fetch('api/shop', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (raw) {
        var base = window.DSS;
        if (!base || !base.items) throw new Error('no snapshot in this build');
        var live = canonLive(raw);
        var d = diffCanon(base.items, live, base.labels || {});
        var c = d.counts;
        if (status) {
          status.className = 'upd-status ok';
          status.textContent = c.changed || c.added || c.removed
            ? 'The shop moved: ' + c.changed + ' items changed, ' + c.added + ' new, ' + c.removed + ' gone.'
            : 'The shop has not moved since ' + ((base.meta && base.meta.snapshot) || 'our snapshot') +
              ' — the numbers in the app are still right.';
        }
        if (out) {
          if (c.changed || c.added || c.removed) {
            out.appendChild(updEntry({
              date: 'Live check · ' + ((raw.source || {}).buildId || 'now'),
              counts: c, added: d.added, removed: d.removed, items: d.changed
            }));
          }
        }
      })
      .catch(function (err) {
        if (status) {
          status.className = 'upd-status bad';
          status.textContent = 'Could not reach the live shop (' + (err && err.message ? err.message : 'offline') +
            '). The snapshot below is what the app teaches.';
        }
      });
  }

  // ------------------------------------------------------------- wiring
  /* A small door for the in-page tests: they need to reach the souls
     arithmetic and the diff engine without clicking through the UI. */
  window.DS_TEST = {
    souls: souls,
    awardSouls: awardSouls,
    spendSouls: spendSouls,
    cosmetics: COSMETICS,
    cosOwned: cosOwned,
    cosEquipped: cosEquipped,
    buyCosmetic: buyCosmetic,
    equipCosmetic: equipCosmetic,
    canonLive: canonLive,
    diffCanon: diffCanon,
    b64e: b64e,
    b64d: b64d,
    bhCode: bhCode,
    grantCode: grantCode,
    startLesson: startLesson,
    show: show,
    audioState: function () {
      return {
        state: AC ? AC.state : 'none',
        primed: audioPrimed,
        sound: !!S.settings.sound,
        channel: (navigator.audioSession && navigator.audioSession.type) || 'n/a'
      };
    },
    unlockAudio: unlockAudio,
    currentQuestion: function () { return (L && L.qs) ? L.qs[L.i] : null; },
    lesson: function () { return L; },
    state: function () { return S; },
    save: save
  };

  document.addEventListener('DOMContentLoaded', function () {
    // the progress of the previous storage format goes away for good
    wipeOldProfiles();
    wireNav();
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        show(t.dataset.tab);
      });
    });
    $('#daily-btn').addEventListener('click', startDaily);
    // a tap on the owl pulls out the next line of counsel
    var tipBox = $('#owl-tip');
    if (tipBox) {
      tipBox.setAttribute('role', 'button');
      tipBox.setAttribute('tabindex', '0');
      tipBox.setAttribute('title', 'Tap for another tip');
      tipBox.addEventListener('click', function () { owlTip(true); });
      tipBox.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); owlTip(true); }
      });
    }
    $('#exam-btn').addEventListener('click', startExam);
    $('#review-btn').addEventListener('click', startReview);
    $('#items-back').addEventListener('click', function () { setActiveTab('path'); show('path'); });
    $('#stats-back').addEventListener('click', function () { setActiveTab('path'); show('path'); });
    $('#updates-back').addEventListener('click', function () { setActiveTab('path'); show('path'); });
    $('#bughunt-back').addEventListener('click', function () { setActiveTab('path'); show('path'); });
    $('#profile-btn').addEventListener('click', function () { openProfile(); });
    $('#items-profile').addEventListener('click', function () { openProfile(); });
    $('#stats-profile').addEventListener('click', function () { openProfile(); });
    $('#updates-profile').addEventListener('click', function () { openProfile(); });
    $('#bughunt-profile').addEventListener('click', function () { openProfile(); });
    $('#profile-back').addEventListener('click', function () { show(profileFrom); });    $('#item-search').addEventListener('input', function (e) { renderItems(e.target.value); });
    $('#check-btn').addEventListener('click', check);
    $('#continue-btn').addEventListener('click', next);
    $('#quit-btn').addEventListener('click', pauseLesson);
    $('#resume-btn').addEventListener('click', resumeLesson);
    $('#resume-drop').addEventListener('click', function () {
      S.paused = null; save(); renderPath();
    });
    $('#result-continue').addEventListener('click', function () { setActiveTab('path'); show('path'); });
    $('#item-modal').addEventListener('click', function (e) {
      if (e.target.id === 'item-modal') $('#item-modal').classList.remove('on');
    });
    $('#keys-modal').addEventListener('click', function (e) {
      if (e.target.id === 'keys-modal') $('#keys-modal').classList.remove('on');
    });
    $('#keys-btn').addEventListener('click', function () {
      $('#keys-modal').classList.add('on');
    });
    $('#keys-close').addEventListener('click', function () {
      $('#keys-modal').classList.remove('on');
    });

    // help & feedback
    $('#report-btn').addEventListener('click', function () { show('bughunt'); });
    $('#diag-btn').addEventListener('click', function () { copyText(diagnostics(), 'Diagnostics copied'); });
    $('#whatsnew-btn').addEventListener('click', showWhatsNew);
    $('#whatsnew-close').addEventListener('click', function () {
      $('#whatsnew-modal').classList.remove('on');
    });
    $('#whatsnew-modal').addEventListener('click', function (e) {
      if (e.target.id === 'whatsnew-modal') $('#whatsnew-modal').classList.remove('on');
    });
    setText('#whatsnew-version', 'DeadShop ' + APP_VERSION + ' · ' + BUILD_DATE);

    // latest update
    $('#upd-check').addEventListener('click', checkLiveShop);

    // bughunt
    $('#bh-submit').addEventListener('click', bhSubmit);
    $('#bh-apply').addEventListener('click', bhApplyCode);
    $$('#bh-kind .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#bh-kind .seg-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
    });

    // auth
    $('#auth-submit').addEventListener('click', doAuth);
    $('#auth-switch').addEventListener('click', function () {
      authMode = authMode === 'signup' ? 'signin' : 'signup';
      authStep = 'form';
      renderAuth();
    });
    $('#auth-forgot').addEventListener('click', function () {
      authStep = 'reset';
      renderAuth();
      var em = $('#auth-email');
      if (em) em.focus();
    });
    $('#auth-resend').addEventListener('click', requestCode);
    $$('#auth-kind-seg .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        authKind = b.dataset.kind;
        authStep = 'form';
        renderAuth();
      });
    });
    $('#auth-guest').addEventListener('click', function () {
      DSA.setSession(null);
      reloadProfile();
      show('path');
    });
    $('#auth-back').addEventListener('click', function () { show('profile'); });
    $('#auth-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#auth-pass').focus(); });
    $('#auth-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#auth-pass').focus(); });
    $('#auth-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') doAuth(); });
    $('#auth-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doAuth(); });

    // profile
    $('#profile-new').addEventListener('click', function () {
      authMode = 'signup';
      renderAuth();
      show('auth');
    });
    $('#guest-signup').addEventListener('click', function () {
      authMode = 'signup';
      renderAuth();
      show('auth');
    });
    $('#guest-signin').addEventListener('click', function () {
      authMode = 'signin';
      renderAuth();
      show('auth');
    });
    $('#signout-btn').addEventListener('click', function () {
      if (!confirm('Sign out of ' + displayLabel() + '? Your progress stays on this device.')) return;
      signOut();
    });
    $('#profile-display-save').addEventListener('click', function () {
      var v = String($('#profile-display').value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
      if (v && v.length < 2) { $('#profile-display').focus(); return; }
      S.display = v;
      var n = profileName();
      if (n) DSA.setDisplay(n, v);
      save();
      renderProfile(); renderAll();
    });
    $('#profile-display').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#profile-display-save').click(); }
    });
    $$('#goal-seg .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        S.settings.goal = Number(b.dataset.goal) || 12;
        save(); renderProfile();
      });
    });
    $('#passwd-btn').addEventListener('click', function () {
      if (!profileName()) { alert('Create a profile first — a guest has no password.'); return; }
      authStep = 'passwd';
      renderAuth();
      show('auth');
    });
    $('#export-btn').addEventListener('click', doExport);
    $('#import-btn').addEventListener('click', function () { $('#import-file').click(); });
    $('#import-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      doImport(f);
      e.target.value = '';   // the same file can be imported again
    });
    $('#reset-btn').addEventListener('click', doReset);
    $$('#theme-seg .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        S.settings.theme = b.dataset.theme;
        save(); applySettings();
      });
    });
    $('#sound-toggle').addEventListener('click', function () { S.settings.sound = !S.settings.sound; save(); applySettings(); if (S.settings.sound) { unlockAudio(); sfxOk(); } });
    // a sample, so a silent phone can be told apart from a broken one
    $('#sound-test').addEventListener('click', function () {
      unlockAudio();
      sfxOk();
      setTimeout(function () { sfxDone(); }, 280);
      setTimeout(function () {
        var c = AC;
        var st = c ? c.state : 'none';
        if (st === 'running') toast('Test played · audio: ' + st);
        else toast('No sound · audio: ' + st + ' — tap the page once, then try again');
        var as = $('#audio-state');
        if (as) as.textContent = st;
      }, 420);
    });
    $('#haptic-toggle').addEventListener('click', function () { S.settings.haptics = !S.settings.haptics; save(); applySettings(); });
    $('#motion-toggle').addEventListener('click', function () { S.settings.motion = !S.settings.motion; save(); applySettings(); });

    // onboarding
    $('#onboard-start').addEventListener('click', function () { closeOnboard(); });
    $('#onboard-skip').addEventListener('click', function () { closeOnboard(); });

    applySettings();
    renderAll();

    // the counts on screen come from the data file, not from a hand-written
    // number that goes stale the next time the data is regenerated
    var meta = DS.meta || {};
    var nItems = meta.items || Object.keys(DS.items).length;
    var nUnits = meta.units || DS.units.length;
    setText('#data-counts', nItems + ' items · ' + nUnits + ' lessons');
    setText('#onboard-counts', nItems + ' shop items. ' + nUnits + ' short lessons.');
    if (meta.snapshot) setText('#onboard-snapshot', meta.snapshot);
    if (meta.snapshot) { setText('#data-snapshot', meta.snapshot); setText('#nav-snapshot', meta.snapshot); }

    // first run: a short welcome, then straight into the lessons.
    // no signup wall — accounts live inside the profile screen.
    // The flag lives in the profile state so it persists through the same
    // storage path as everything else (and resets with a profile reset).
    // ?nointro=1 skips the welcome card (handy for screenshots and embeds)
    var skipIntro = /(^|[?&])nointro=1/.test(location.search);
    if (!S.onboarded && !skipIntro) {
      S.onboarded = true;
      save();
      $('#onboard-modal').classList.add('on');
    }
    show('path');

    // deep links: #daily #items #stats #profile #updates #bughunt
    var hash = (location.hash || '').toLowerCase();
    if (hash === '#daily') setTimeout(startDaily, 80);
    if (hash === '#items') setTimeout(function () { setActiveTab('items'); show('items'); }, 80);
    if (hash === '#stats') setTimeout(function () { setActiveTab('stats'); show('stats'); }, 80);
    if (hash === '#profile') setTimeout(function () { show('profile'); }, 80);
    if (hash === '#updates') setTimeout(function () { show('updates'); }, 80);
    if (hash === '#bughunt') setTimeout(function () { show('bughunt'); }, 80);
    if (hash === '#resume') setTimeout(resumeLesson, 80);
    // #unit-<id> opens a lesson straight away
    if (hash.indexOf('#unit-') === 0) {
      var uid = decodeURIComponent(hash.slice(6));
      setTimeout(function () { startLesson(uid); }, 80);
    }
  });

  // ------------------------------------------------------------ keyboard
  // Desktop shortcuts — the phone build never sees them, the PC build
  // should not need the mouse.
  //   1..9  pick an answer option
  //   Enter check the answer / continue to the next question
  //   Esc   leave a lesson, or close whatever popup is open
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    // while typing only Escape is ours — the rest belongs to the field
    if (typing && e.key !== 'Escape') return;
    if (current === 'lesson' && L) {
      if (e.key === 'Escape') {
        e.preventDefault();
        pauseLesson();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (L.answered) next();
        else if (!$('#check-btn').disabled) check();
        return;
      }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && !L.answered) {
        var opts = $$('.opt');
        if (opts[n - 1]) { e.preventDefault(); opts[n - 1].click(); }
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !L.answered) {
        var list = $$('.opt');
        if (!list.length) return;
        e.preventDefault();
        var at = list.indexOf(L.selEl);
        var to = e.key === 'ArrowDown' ? at + 1 : at - 1;
        if (at < 0) to = 0;
        if (to < 0) to = list.length - 1;
        if (to >= list.length) to = 0;
        list[to].click();
        return;
      }
      if ((e.key === 'h' || e.key === 'H') && !L.answered) {
        var hb = $('.hint-btn');
        if (hb) { e.preventDefault(); hb.click(); }
      }
      return;
    }
    if (e.key === 'Escape') {
      var sn = $('#side-nav');
      if (sn && sn.classList.contains('on')) { e.preventDefault(); navClose(); return; }
      var im = $('#item-modal');
      if (im.classList.contains('on')) { e.preventDefault(); im.classList.remove('on'); return; }
      var km = $('#keys-modal');
      if (km.classList.contains('on')) { e.preventDefault(); km.classList.remove('on'); return; }
      var wn = $('#whatsnew-modal');
      if (wn && wn.classList.contains('on')) { e.preventDefault(); wn.classList.remove('on'); return; }
      if ($('#onboard-modal').classList.contains('on')) { e.preventDefault(); closeOnboard(); return; }
      if (current === 'items' || current === 'stats' || current === 'profile') {
        e.preventDefault();
        setActiveTab('path'); show('path');
      }
      return;
    }
    // "/" jumps to the item search from anywhere outside a lesson
    if (e.key === '/' && current !== 'lesson') {
      e.preventDefault();
      setActiveTab('items');
      show('items');
      var s = $('#item-search');
      if (s) s.focus();
    }
  });

  // offline support — only in a secure context (https:// or localhost).
  // on a plain-http LAN address the browser refuses to register, so the app
  // must keep working without it.
  // The version in the URL forces a fresh worker script on every data change,
  // otherwise the browser may keep serving a stale cached data.js.
  var SW_VERSION = 'v9';
  try {
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js?v=' + SW_VERSION).catch(function () { });
    }
  } catch (e) { }

  function closeOnboard() {
    $('#onboard-modal').classList.remove('on');
  }
})();
