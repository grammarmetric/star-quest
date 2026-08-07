/* sync.js
   ------------------------------------------------------------------
   Thin wrapper over Firebase Realtime Database.

   Design rule: the quest must never depend on this file succeeding.
   If the Firebase CDN is blocked, the config still holds placeholders,
   or auth fails, Sync goes into offline mode and every method becomes
   a silent no-op. app.js does not branch on any of that.

   Data shape, all under sessions/<CODE>/ :
     student   { name, startedAt, agent }
     presence  true | false            (cleared by onDisconnect)
     state     { stageIndex, stageLabel, itemIndex, itemsTotal,
                 level, correct, answered, status, updatedAt }
     current   { id, domain, kind, level, prompt, passage, options[],
                 answer, picked, startedAt }
     events/   push() -> one row per answered question
     report    the finished score report
   ------------------------------------------------------------------ */

window.Sync = (function () {
  var live = false;
  var base = null;         // firebase.database.Reference for this session
  var code = null;
  var onStatus = function () {};
  var watchers = [];
  var connWatched = false; // .info/connected must only ever be hooked once

  function looksLikePlaceholder(cfg) {
    if (!cfg) return true;
    var s = JSON.stringify(cfg);
    return !cfg.databaseURL || /PASTE_|YOUR_|REGION/i.test(s);
  }

  function status(kind, detail) {
    try { onStatus(kind, detail); } catch (e) { /* never let the UI break sync */ }
  }

  /* init({ code, role, onStatus }) -> Promise<boolean>  (true = live) */
  function init(opts) {
    opts = opts || {};
    code = opts.code;
    onStatus = opts.onStatus || onStatus;

    // teacher.html calls init twice: once to preflight the config, again with
    // the real code. Drop the first round's listeners so they cannot fire
    // against the wrong session.
    watchers.forEach(function (w) { try { w.ref.off(); } catch (e) {} });
    watchers = [];

    return new Promise(function (resolve) {
      if (typeof firebase === 'undefined' || !firebase.apps) {
        status('offline', 'Firebase SDK did not load');
        return resolve(false);
      }
      if (looksLikePlaceholder(window.FIREBASE_CONFIG)) {
        status('offline', 'firebase-config.js not filled in yet');
        return resolve(false);
      }

      try {
        if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      } catch (e) {
        status('offline', 'Firebase failed to start: ' + e.message);
        return resolve(false);
      }

      status('connecting', null);

      firebase.auth().signInAnonymously()
        .then(function () {
          base = firebase.database().ref('sessions/' + code);
          live = true;

          // Report the socket state, not just the auth state — this is what
          // actually tells you whether the teacher will see anything.
          // Hook .info/connected once per page; a second init (teacher.html
          // preflight -> real code) reuses it and just re-announces.
          if (connWatched) {
            status('live', code);
          } else {
            connWatched = true;
            firebase.database().ref('.info/connected').on('value', function (snap) {
              if (snap.val() === true) {
                status('live', code);
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
          // Most common cause: Anonymous sign-in is still disabled in the
          // Firebase console. Say so rather than failing silently.
          status('offline', 'Sign-in failed (' + err.code + ')');
          resolve(false);
        });
    });
  }

  function set(path, value) {
    if (!live || !base) return Promise.resolve();
    return base.child(path).set(value).catch(function () {});
  }

  function update(path, value) {
    if (!live || !base) return Promise.resolve();
    return base.child(path).update(value).catch(function () {});
  }

  function push(path, value) {
    if (!live || !base) return Promise.resolve();
    return base.child(path).push(value).catch(function () {});
  }

  /* Teacher side: subscribe to a child of the session. */
  function watch(path, cb) {
    if (!live || !base) return function () {};
    var ref = base.child(path);
    var handler = ref.on('value', function (snap) { cb(snap.val(), snap); });
    watchers.push({ ref: ref, handler: handler });
    return function () { ref.off('value', handler); };
  }

  /* Teacher side: stream events as they arrive rather than re-reading all. */
  function watchAdded(path, cb) {
    if (!live || !base) return function () {};
    var ref = base.child(path);
    var handler = ref.on('child_added', function (snap) { cb(snap.val(), snap.key); });
    watchers.push({ ref: ref, handler: handler });
    return function () { ref.off('child_added', handler); };
  }

  function clearSession() {
    if (!live || !base) return Promise.resolve();
    return base.remove().catch(function () {});
  }

  function stamp() {
    return (live && typeof firebase !== 'undefined' && firebase.database)
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
    isLive: function () { return live; },
    code: function () { return code; }
  };
})();
