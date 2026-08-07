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

  var THEME_KEY = 'star-quest-theme';
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
    if (kind === 'firebase') {
      c.className = 'chip chip--live';
      c.innerHTML = svg('check', '1rem') + ' watching from anywhere';
    } else if (kind === 'local') {
      c.className = 'chip chip--live';
      c.innerHTML = svg('check', '1rem') + ' watching this computer';
      $('joinHint').innerHTML =
        'No backend is configured, so live watching works when she is on <strong>this same ' +
        'computer</strong> (another tab or window). If she is on her own device, skip this ' +
        'and use her finished report link above — that works from anywhere. ' +
        'To watch remotely in real time, set up Firebase (see the README).';
    } else if (kind === 'connecting') {
      c.className = 'chip chip--quiet';
      c.textContent = 'connecting…';
    } else {
      c.className = 'chip chip--offline';
      c.textContent = 'no live view';
      offlineReason = detail || '';
      $('joinHint').innerHTML =
        '<strong>Live watching is unavailable</strong> — this browser blocks local storage. ' +
        'Her finished report link above still works.';
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
  var studentName = '';   // whatever she typed; never hard-coded here

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

    var review = (rep.answers || []).map(function (a) {
      return '<div class="review-item">' +
        '<span class="ri-icon ri-icon--' + (a.correct ? 'yes' : 'no') + '">' +
          svg(a.correct ? 'check' : 'cross', '.9rem') + '</span>' +
        '<span class="ri-body">' +
          '<span class="ri-q">' + esc(a.prompt) + '</span>' +
          '<span class="ri-a">' + esc(a.domainLabel) + ' · L' + esc(a.level) +
            ' · she said “' + esc(a.said) + '”' +
            (a.correct ? '' : ' · answer: “' + esc(a.key) + '”') +
            ' · ' + clockTime(a.ms) +
            (a.plays ? ' · ' + a.plays + ' plays' : '') +
            (a.ketRef ? ' · ' + esc(a.ketRef) : '') +
          '</span>' +
        '</span></div>';
    }).join('');

    $('reportBox').innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
        (rep.name ? '<span class="chip chip--quiet">' + esc(rep.name) + '</span>' : '') +
        '<span class="chip">' + rep.percent + '% overall</span>' +
        '<span class="chip chip--quiet">' + rep.correct + ' of ' + rep.asked + '</span>' +
        '<span class="chip chip--quiet">' + clockTime(rep.elapsedMs) + '</span>' +
      '</div>' +
      '<div class="domain-grid">' + doms + '</div>' +
      '<h3 style="font-size:1rem;margin:18px 0 10px">Strengths</h3>' + list(rep.strengths, 'good', 'check') +
      '<h3 style="font-size:1rem;margin:18px 0 10px">Practise next</h3>' + list(rep.growth, 'work', 'next') +
      (review ? '<h3 style="font-size:1rem;margin:22px 0 10px">Every question</h3>' + review : '');
  }

  /* ---------- opening a finished report from a link ---------- */

  var DATA = null;

  function loadQuestions() {
    if (DATA) return Promise.resolve(DATA);
    return fetch('questions.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { DATA = j; return j; });
  }

  function showHandoffError(msg) {
    $('reportPanel').style.display = 'block';
    $('reportBox').innerHTML = '<div class="t-empty">' + esc(msg) + '</div>';
  }

  function openHandoff(text) {
    var m = /[#&]r=([A-Za-z0-9\-_]+)/.exec(text || '');
    var token = m ? m[1] : (/^[A-Za-z0-9\-_]{40,}$/.test((text || '').trim()) ? text.trim() : null);
    if (!token) { showHandoffError('That does not look like a result link. Paste the whole link she sent.'); return; }

    var packed;
    try { packed = window.Handoff.unpack(token); }
    catch (e) { showHandoffError('That link is damaged or incomplete — ask her to send it again.'); return; }
    if (!packed || !packed.answers) { showHandoffError('Could not read that link.'); return; }

    loadQuestions().then(function (data) {
      var answers = Report.hydrate(packed.answers, data);
      var missing = answers.filter(function (a) { return a.missing; }).length;
      var rep = Report.build({
        name: packed.name,
        data: data,
        answers: answers,
        elapsedMs: packed.elapsedMs,
        finishedAt: packed.finishedAt
      });
      lastReport = null;              // force a re-render
      renderReport(rep);
      $('reportPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (missing) {
        $('reportBox').insertAdjacentHTML('afterbegin',
          '<div class="t-empty" style="text-align:left;padding:12px 0">' + missing +
          ' question(s) in this result are no longer in questions.json, so they show as unknown. ' +
          'That happens if the content changed after she took the test.</div>');
      }
    }).catch(function (err) {
      showHandoffError('Could not load questions.json to rebuild the report (' + err.message + ').');
    });
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
      Sync.watch('student', function (s) {
        studentName = (s && s.name) || '';
        $('sName').textContent = studentName || '—';
      });
      Sync.watch('state', renderState);
      Sync.watch('current', renderCurrent);
      Sync.watch('report', renderReport);
      Sync.watchAdded('events', addEvent);
      Sync.watch('presence', function (p) {
        var c = $('statusChip');
        if (p === true) { c.className = 'chip chip--live'; c.innerHTML = svg('check', '1rem') + ' ' + esc(studentName || 'student') + ' is on the page'; }
        else if (p === false) { c.className = 'chip chip--quiet'; c.textContent = 'she closed the page'; }
      });
    });
  }

  $('openResultBtn').addEventListener('click', function () { openHandoff($('resultInput').value); });
  $('resultInput').addEventListener('paste', function () {
    // paste fires before the value lands, so read it on the next tick
    setTimeout(function () { if ($('resultInput').value.length > 40) openHandoff($('resultInput').value); }, 0);
  });

  // A result link opened directly lands here with #r=... already set.
  if (/[#&]r=/.test(location.hash || '')) {
    $('resultInput').value = location.href;
    openHandoff(location.href);
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
