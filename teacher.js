/* teacher.js — live monitor
   Subscribes to one session and mirrors what is on the student's screen:
   the question she is looking at, the option she taps, and a running feed.
   Falls back to a clear "offline" message if Firebase is not configured. */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function svg(n, s) { return window.icon ? window.icon(n, s) : ''; }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function clockTime(ms) {
    var s = Math.round((ms || 0) / 1000);
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }

  /* ---------- theme (same behaviour as the student app) ---------- */

  var THEME_KEY = 'lily-quest-theme';
  function applyTheme(mode) {
    if (mode) document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    var dark = mode === 'dark' ||
      (!mode && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('themeBtn').innerHTML = svg(dark ? 'sun' : 'moon', '1.4rem');
  }
  try { applyTheme(localStorage.getItem(THEME_KEY) || null); } catch (e) { applyTheme(null); }
  $('themeBtn').addEventListener('click', function () {
    var now = document.documentElement.getAttribute('data-theme');
    var dark = now === 'dark' ||
      (!now && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  /* ---------- status ---------- */

  var offlineReason = '';

  function statusChip(kind, detail) {
    var c = $('statusChip');
    if (kind === 'live') {
      c.className = 'chip chip--live';
      c.innerHTML = svg('check', '1rem') + ' connected';
    } else if (kind === 'connecting') {
      c.className = 'chip chip--quiet';
      c.textContent = 'connecting…';
    } else {
      c.className = 'chip chip--offline';
      c.textContent = 'offline mode';
      offlineReason = detail || '';
      $('joinHint').innerHTML =
        '<strong>Live monitoring is off.</strong> ' + esc(detail || '') +
        ' Fill in <code>firebase-config.js</code> and enable Anonymous sign-in, ' +
        'then reload. The quest itself still works and still produces a report.';
    }
  }

  /* ---------- codes ---------- */

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function newCode() {
    var s = '', buf = new Uint32Array(8);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length];
    return s;
  }

  function studentUrl(code) {
    return location.href.replace(/teacher\.html.*$/, '') + 'index.html?session=' + code;
  }

  function showLink(code) {
    $('codeBox').textContent = code;
    $('studentLink').textContent = studentUrl(code);
    $('linkBox').style.display = 'block';
  }

  /* ---------- render ---------- */

  var startedFeed = false;
  var lastReport = null;

  function renderState(st) {
    if (!st) return;
    $('sStage').textContent = st.stageLabel || '—';
    $('sProgress').textContent = st.status === 'finished'
      ? 'done'
      : ((st.itemIndex + 1) + ' / ' + st.itemsTotal);
    $('sScore').textContent = st.answered ? (st.correct + ' / ' + st.answered) : '—';
    $('sLevel').textContent = st.level ? ('L' + st.level) : '—';
    $('sTime').textContent = clockTime(st.elapsed);
  }

  function renderCurrent(cur) {
    var box = $('liveNow');
    if (!cur) {
      box.innerHTML = '<div class="t-empty">No question on screen — she has either not started or has finished.</div>';
      return;
    }
    var opts = (cur.options || []).map(function (o, i) {
      var cls = 't-opt';
      if (o === cur.answer) cls += ' is-key';
      if (cur.picked && o === cur.picked) cls += ' is-picked';
      return '<div class="' + cls + '">' + esc(o) + '</div>';
    }).join('');

    box.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<span class="chip chip--quiet">' + esc(cur.domainLabel || cur.domain) + '</span>' +
        '<span class="chip chip--quiet">level ' + esc(cur.level) + '</span>' +
        '<span class="chip chip--quiet">' + esc(cur.kind) + '</span>' +
      '</div>' +
      (cur.passage ? '<div class="t-live-passage">' + esc(cur.passage) + '</div>' : '') +
      '<div class="t-live-q">' + esc(cur.prompt) + '</div>' +
      '<div class="t-opts">' + opts + '</div>' +
      (cur.ketRef ? '<p style="color:var(--muted);font-size:.8rem;margin-top:12px">' + esc(cur.ketRef) + '</p>' : '');
  }

  function addEvent(ev) {
    if (!startedFeed) { $('feed').innerHTML = ''; startedFeed = true; }
    var row = document.createElement('div');
    row.className = 't-feed-row';
    row.innerHTML =
      '<span class="dot dot--' + (ev.correct ? 'yes' : 'no') + '">' +
        svg(ev.correct ? 'check' : 'cross', '.85rem') + '</span>' +
      '<span class="body">' +
        '<span>' + esc(ev.prompt) + '</span>' +
        '<span class="said">said “' + esc(ev.said) + '”' +
          (ev.correct ? '' : ' · answer: “' + esc(ev.key) + '”') +
          ' · ' + esc(ev.domainLabel || ev.domain) + ' L' + esc(ev.level) +
          (ev.plays ? ' · ' + ev.plays + ' plays' : '') +
        '</span>' +
      '</span>' +
      '<span class="when">' + clockTime(ev.ms) + '</span>';
    $('feed').insertBefore(row, $('feed').firstChild);
  }

  function renderReport(rep) {
    if (!rep || rep === lastReport) return;
    lastReport = rep;
    $('reportPanel').style.display = 'block';

    var doms = (rep.domains || []).map(function (d) {
      return '<div class="dcard" data-accent="' + esc(d.accent) + '">' +
        '<div class="dhead">' +
          '<span class="badge-sq">' + svg(d.icon, '1.1rem') + '</span>' +
          '<span class="dname">' + esc(d.label) + '</span>' +
          '<span class="dscore">' + d.correct + '/' + d.asked + '</span>' +
        '</div>' +
        '<div class="bar"><span style="width:' + d.percent + '%"></span></div>' +
        '<div class="dlevel">' + (d.ceiling ? 'top level correct: L' + d.ceiling : 'no correct answers above L1') + '</div>' +
      '</div>';
    }).join('');

    var list = function (arr, badge, ic) {
      return '<ul>' + (arr || []).map(function (s) {
        return '<li><span class="li-badge li-badge--' + badge + '">' + svg(ic, '.9rem') + '</span><span>' + esc(s) + '</span></li>';
      }).join('') + '</ul>';
    };

    $('reportBox').innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
        '<span class="chip">' + rep.percent + '% overall</span>' +
        '<span class="chip chip--quiet">' + rep.correct + ' of ' + rep.asked + '</span>' +
        '<span class="chip chip--quiet">' + clockTime(rep.elapsedMs) + '</span>' +
      '</div>' +
      '<div class="domain-grid">' + doms + '</div>' +
      '<h3 style="font-size:1rem;margin:18px 0 10px">Strengths</h3>' + list(rep.strengths, 'good', 'check') +
      '<h3 style="font-size:1rem;margin:18px 0 10px">Practise next</h3>' + list(rep.growth, 'work', 'next');
  }

  /* ---------- wiring ---------- */

  function watch(code) {
    $('watchArea').style.display = 'block';
    showLink(code);

    Sync.init({ code: code, role: 'teacher', onStatus: statusChip }).then(function (live) {
      if (!live) {
        $('liveNow').innerHTML =
          '<div class="t-empty">Not connected. ' + esc(offlineReason) + '</div>';
        return;
      }
      Sync.watch('student', function (s) { $('sName').textContent = (s && s.name) || '—'; });
      Sync.watch('state', renderState);
      Sync.watch('current', renderCurrent);
      Sync.watch('report', renderReport);
      Sync.watchAdded('events', addEvent);
      Sync.watch('presence', function (p) {
        var c = $('statusChip');
        if (p === true) { c.className = 'chip chip--live'; c.innerHTML = svg('check', '1rem') + ' Lily is on the page'; }
        else if (p === false) { c.className = 'chip chip--quiet'; c.textContent = 'she closed the page'; }
      });
    });
  }

  var fromUrl = new URLSearchParams(location.search).get('session');

  $('newBtn').addEventListener('click', function () {
    var c = newCode();
    $('codeInput').value = c;
    showLink(c);
  });

  $('joinBtn').addEventListener('click', function () {
    var c = ($('codeInput').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 8) { $('codeInput').focus(); return; }
    history.replaceState(null, '', '?session=' + c);
    watch(c);
  });

  $('copyBtn').addEventListener('click', function () {
    var url = $('studentLink').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        $('copyBtn').textContent = 'Copied';
        setTimeout(function () { $('copyBtn').textContent = 'Copy student link'; }, 1600);
      });
    }
  });

  $('codeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('joinBtn').click();
  });

  if (fromUrl && /^[A-Z0-9]{8}$/i.test(fromUrl)) {
    $('codeInput').value = fromUrl.toUpperCase();
    watch(fromUrl.toUpperCase());
  } else {
    // Show the offline explanation early if config is missing, without
    // making the teacher guess a code first.
    Sync.init({ code: 'PREFLIGHT', role: 'teacher', onStatus: statusChip });
  }
})();
