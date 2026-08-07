/* sync.js
   ------------------------------------------------------------------
   One API, three transports, picked automatically:

     firebase  if firebase-config.js holds real values and the SDK loaded.
               Live monitoring from any device, anywhere.

     local     otherwise. BroadcastChannel + localStorage, so a teacher tab
               on the SAME computer sees the session live. Needs no account,
               no server, no configuration whatsoever.

     none      if even localStorage is unavailable. The quest still runs and
               still produces a report; nothing is shared.

   Whichever is active, the finished report is ALSO handed off through a
   link (see Handoff at the bottom), which needs no backend at all.

   app.js and teacher.js do not branch on any of this.
   ------------------------------------------------------------------ */

window.Sync = (function () {
  var mode = 'none';       // 'firebase' | 'local' | 'none'
  var code = null;
  var onStatus = function () {};
  var base = null;         // firebase ref
  var watchers = [];
  var connWatched = false;

  /* ---------------- shared helpers ---------------- */

  function looksLikePlaceholder(cfg) {
    if (!cfg) return true;
    return !cfg.databaseURL || /PASTE_|YOUR_|REGION/i.test(JSON.stringify(cfg));
  }

  function status(kind, detail) {
    try { onStatus(kind, detail); } catch (e) {}
  }

  /* ---------------- local transport ---------------- */
  /* A tiny store in localStorage plus a BroadcastChannel for change notices.
     The store is what lets a teacher tab opened halfway through still see
     the whole session rather than only what happens next. */

  var LKEY = null, chan = null;
  var localSubs = { value: {}, added: {} };

  function lread() {
    try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (e) { return {}; }
  }
  function lwrite(store) {
    try { localStorage.setItem(LKEY, JSON.stringify(store)); } catch (e) {}
  }
  function lfire(path, value) {
    (localSubs.value[path] || []).forEach(function (cb) { try { cb(value); } catch (e) {} });
  }
  function lfireAdded(path, value, key) {
    (localSubs.added[path] || []).forEach(function (cb) { try { cb(value, key); } catch (e) {} });
  }

  function localInit() {
    LKEY = 'sq:' + code;
    try {
      localStorage.getItem(LKEY);
    } catch (e) {
      mode = 'none';
      status('none', 'this browser blocks local storage');
      return false;
    }
    if ('BroadcastChannel' in window) {
      chan = new BroadcastChannel('star-quest-' + code);
      chan.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.kind === 'set') lfire(m.path, m.value);
        else if (m.kind === 'push') lfireAdded(m.path, m.value, m.key);
      };
    }
    // A second tab in the same browser also picks up writes through the
    // storage event, which covers browsers without BroadcastChannel.
    window.addEventListener('storage', function (ev) {
      if (ev.key !== LKEY || !ev.newValue) return;
      var store;
      try { store = JSON.parse(ev.newValue); } catch (e) { return; }
      Object.keys(localSubs.value).forEach(function (p) { lfire(p, store[p] === undefined ? null : store[p]); });
    });
    mode = 'local';
    status('local', code);
    return true;
  }

  /* ---------------- init ---------------- */

  function init(opts) {
    opts = opts || {};
    code = opts.code;
    onStatus = opts.onStatus || onStatus;

    watchers.forEach(function (w) { try { w.ref.off(); } catch (e) {} });
    watchers = [];

    return new Promise(function (resolve) {
      var noFirebase = (typeof firebase === 'undefined' || !firebase.apps) ||
                       looksLikePlaceholder(window.FIREBASE_CONFIG);

      if (noFirebase) {
        localInit();
        return resolve(mode === 'local');
      }

      try {
        if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      } catch (e) {
        localInit();
        return resolve(mode === 'local');
      }

      status('connecting', null);

      firebase.auth().signInAnonymously()
        .then(function () {
          base = firebase.database().ref('sessions/' + code);
          mode = 'firebase';

          if (connWatched) {
            status('firebase', code);
          } else {
            connWatched = true;
            firebase.database().ref('.info/connected').on('value', function (snap) {
              if (snap.val() === true) {
                status('firebase', code);
                if (opts.role === 'student') {
                  base.child('presence').onDisconnect().set(false);
                  base.child('presence').set(true);
                }
              } else {
                status('connecting', code);
              }
            });
          }
          resolve(true);
        })
        .catch(function (err) {
          // Firebase is configured but refused us — fall back rather than
          // leaving the teacher with nothing.
          localInit();
          status('local', 'Firebase sign-in failed (' + err.code + '), using same-device sync');
          resolve(mode === 'local');
        });
    });
  }

  /* ---------------- writes ---------------- */

  function set(path, value) {
    if (mode === 'firebase' && base) return base.child(path).set(value).catch(function () {});
    if (mode === 'local') {
      var s = lread();
      if (value === null) delete s[path]; else s[path] = value;
      lwrite(s);
      lfire(path, value);
      if (chan) chan.postMessage({ kind: 'set', path: path, value: value });
    }
    return Promise.resolve();
  }

  function update(path, value) {
    if (mode === 'firebase' && base) return base.child(path).update(value).catch(function () {});
    if (mode === 'local') {
      var s = lread();
      var merged = Object.assign({}, s[path] || {}, value);
      s[path] = merged;
      lwrite(s);
      lfire(path, merged);
      if (chan) chan.postMessage({ kind: 'set', path: path, value: merged });
    }
    return Promise.resolve();
  }

  function push(path, value) {
    if (mode === 'firebase' && base) return base.child(path).push(value).catch(function () {});
    if (mode === 'local') {
      var s = lread();
      var arr = s['__' + path] || [];
      var key = 'e' + arr.length;
      arr.push({ key: key, value: value });
      s['__' + path] = arr;
      lwrite(s);
      lfireAdded(path, value, key);
      if (chan) chan.postMessage({ kind: 'push', path: path, value: value, key: key });
    }
    return Promise.resolve();
  }

  /* ---------------- reads ---------------- */

  function watch(path, cb) {
    if (mode === 'firebase' && base) {
      var ref = base.child(path);
      var h = ref.on('value', function (snap) { cb(snap.val(), snap); });
      watchers.push({ ref: ref, handler: h });
      return function () { ref.off('value', h); };
    }
    if (mode === 'local') {
      (localSubs.value[path] || (localSubs.value[path] = [])).push(cb);
      var cur = lread()[path];
      if (cur !== undefined) setTimeout(function () { cb(cur); }, 0);
      return function () {
        localSubs.value[path] = (localSubs.value[path] || []).filter(function (f) { return f !== cb; });
      };
    }
    return function () {};
  }

  function watchAdded(path, cb) {
    if (mode === 'firebase' && base) {
      var ref = base.child(path);
      var h = ref.on('child_added', function (snap) { cb(snap.val(), snap.key); });
      watchers.push({ ref: ref, handler: h });
      return function () { ref.off('child_added', h); };
    }
    if (mode === 'local') {
      (localSubs.added[path] || (localSubs.added[path] = [])).push(cb);
      var existing = lread()['__' + path] || [];
      setTimeout(function () { existing.forEach(function (e) { cb(e.value, e.key); }); }, 0);
      return function () {
        localSubs.added[path] = (localSubs.added[path] || []).filter(function (f) { return f !== cb; });
      };
    }
    return function () {};
  }

  function clearSession() {
    if (mode === 'firebase' && base) return base.remove().catch(function () {});
    if (mode === 'local') { try { localStorage.removeItem(LKEY); } catch (e) {} }
    return Promise.resolve();
  }

  function stamp() {
    return (mode === 'firebase' && typeof firebase !== 'undefined' && firebase.database)
      ? firebase.database.ServerValue.TIMESTAMP
      : Date.now();
  }

  return {
    init: init,
    set: set,
    update: update,
    push: push,
    watch: watch,
    watchAdded: watchAdded,
    clearSession: clearSession,
    stamp: stamp,
    mode: function () { return mode; },
    isLive: function () { return mode !== 'none'; },
    code: function () { return code; }
  };
})();


/* ==================================================================
   Handoff — getting the finished report to the teacher with no backend.

   The report is squeezed down to just the facts that cannot be derived
   from questions.json (which item, what she picked, was it right, how
   long, how many replays), then packed into the URL FRAGMENT. A fragment
   never leaves the browser — GitHub Pages never sees it, and it appears
   in no server log anywhere.

   teacher.html rebuilds the full report from that plus questions.json.
   ================================================================== */

window.Handoff = (function () {

  function toB64url(str) {
    // btoa only handles latin1, so widen through UTF-8 first
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64url(s) {
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin = atob(b);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* Compact wire form. Positional arrays, not objects — roughly a third
     the size, which keeps the link short enough to paste into a chat. */
  function pack(report) {
    var v = {
      v: 1,
      n: report.name,
      t: report.finishedAt,
      e: report.elapsedMs,
      a: report.answers.map(function (a) {
        return [a.id, a.said, a.correct ? 1 : 0, Math.round(a.ms / 100), a.plays || 0];
      })
    };
    return toB64url(JSON.stringify(v));
  }

  function unpack(token) {
    var v = JSON.parse(fromB64url(token));
    if (!v || v.v !== 1 || !Array.isArray(v.a)) throw new Error('not a star quest result');
    return {
      name: v.n,
      finishedAt: v.t,
      elapsedMs: v.e,
      answers: v.a.map(function (r) {
        return { id: r[0], said: r[1], correct: !!r[2], ms: r[3] * 100, plays: r[4] };
      })
    };
  }

  function link(report, teacherUrl) {
    var b = teacherUrl || location.href.replace(/[^/]*$/, '') + 'teacher.html';
    return b + '#r=' + pack(report);
  }

  function fromLocation() {
    var m = /[#&]r=([A-Za-z0-9\-_]+)/.exec(location.hash || '');
    if (!m) return null;
    try { return unpack(m[1]); } catch (e) { return { error: e.message }; }
  }

  return { pack: pack, unpack: unpack, link: link, fromLocation: fromLocation };
})();
