/* app.js — Star quest engine
   ------------------------------------------------------------------
   Loads questions.json, runs an adaptive four-stage quest, streams
   everything to the teacher view via Sync, and builds the score report.

   Nothing in the report is written in advance. Every sentence on that
   screen is derived from the answers actually given — if there is no
   evidence for a claim, the claim is not made.
   ------------------------------------------------------------------ */

(function () {
  'use strict';

  /* ================= helpers ================= */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function svg(name, size) {
    return (window.icon ? window.icon(name, size) : '');
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function clockTime(ms) {
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }

  /* Compare a typed/built answer with the key: case and punctuation blind. */
  function sameText(a, b) {
    var norm = function (t) {
      return String(t).toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').trim();
    };
    return norm(a) === norm(b);
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ================= theme ================= */

  var THEME_KEY = 'lily-quest-theme';

  function applyTheme(mode) {
    if (mode) document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    var dark = mode === 'dark' ||
      (!mode && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('themeBtn').innerHTML = svg(dark ? 'sun' : 'moon', '1.4rem');
    $('themeBtn').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
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

  /* ================= session code ================= */

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — a child may read it aloud

  function newCode() {
    var s = '';
    var buf = new Uint32Array(8);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length];
    return s;
  }

  function sessionCode() {
    var p = new URLSearchParams(location.search).get('session');
    if (p && /^[A-Z0-9]{8}$/i.test(p)) return p.toUpperCase();
    var saved = null;
    try { saved = sessionStorage.getItem('lily-quest-code'); } catch (e) {}
    if (saved) return saved;
    var c = newCode();
    try { sessionStorage.setItem('lily-quest-code', c); } catch (e) {}
    return c;
  }

  var CODE = sessionCode();

  /* ================= state ================= */

  var DATA = null;
  var quest = null;
  var item = null;          // the item on screen
  var itemStart = 0;
  var answered = false;
  var plays = 0;            // how many times she replayed the audio
  var picked = null;        // her working answer for build/spell items

  var KIND_LABEL = {
    'picture-word': 'Tap the right picture',
    'word-choice': 'Choose the best word',
    'spell-word': 'Build the word',
    'notice-match': 'Which sign says this?',
    'reply-choice': 'Choose the best answer',
    'true-false-say': 'Read, then choose',
    'gap-grammar': 'Choose the missing word',
    'sentence-build': 'Put the words in order',
    'listen-picture': 'Listen, then tap the picture',
    'listen-choice': 'Listen, then choose'
  };

  var PRAISE = ['Nice one!', 'Yes!', 'Great!', 'Well done!', 'You got it!', 'Brilliant!'];
  var NUDGE = ['Not that one.', 'Close! Not quite.', 'Good try.'];

  function isListening(k) { return k === 'listen-picture' || k === 'listen-choice'; }

  /* ================= screens ================= */

  function show(id) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    $(id).classList.add('is-active');
    window.scrollTo(0, 0);
  }

  function setAccent(a) { document.documentElement.setAttribute('data-accent', a || 'cyan'); }

  /* ================= status chip ================= */

  function statusChip(kind, detail) {
    var c = $('statusChip');
    if (kind === 'live') {
      c.className = 'chip chip--live';
      c.innerHTML = svg('check', '1rem') + ' teacher is watching';
    } else if (kind === 'connecting') {
      c.className = 'chip chip--quiet';
      c.textContent = 'connecting…';
    } else {
      c.className = 'chip chip--offline';
      c.textContent = 'offline mode';
      c.title = detail || '';
    }
  }

  /* ================= audio ================= */

  var voice = null;
  var audioEl = null;

  function loadVoice() {
    if (!('speechSynthesis' in window)) return;
    var vs = window.speechSynthesis.getVoices() || [];
    if (!vs.length) return;
    // Prefer a British voice — the exam is Cambridge — then any English one.
    voice = vs.filter(function (v) { return /^en-GB/i.test(v.lang); })[0] ||
            vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) {
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }

  function stopAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    var b = document.querySelector('.play-btn');
    if (b) b.classList.remove('is-playing');
  }

  function playCurrent() {
    if (!item) return;
    stopAudio();
    plays++;
    var btn = document.querySelector('.play-btn');
    if (btn) btn.classList.add('is-playing');
    var done = function () { if (btn) btn.classList.remove('is-playing'); };

    if (item.audio) {
      // A real recording wins whenever one is supplied.
      audioEl = new Audio(item.audio);
      audioEl.onended = done;
      audioEl.onerror = function () { done(); speakSay(done); };
      audioEl.play().catch(function () { done(); speakSay(done); });
      return;
    }
    speakSay(done);
  }

  function speakSay(done) {
    if (!('speechSynthesis' in window)) { done(); return; }
    var u = new SpeechSynthesisUtterance(item.say || item.prompt || '');
    u.rate = 0.82;              // slowed for a 7-year-old
    u.pitch = 1.05;
    u.lang = 'en-GB';
    if (voice) u.voice = voice;
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }

  /* ================= boot ================= */

  function boot() {
    Sync.init({ code: CODE, role: 'student', onStatus: statusChip });

    fetch('questions.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        DATA = json;
        renderWelcome();
      })
      .catch(function (err) {
        // Opening index.html straight off disk trips the browser's file://
        // rule before any of this can run. Say exactly that.
        var offline = location.protocol === 'file:';
        $('screen-welcome').innerHTML =
          '<div class="welcome"><h1>Can\'t load the questions</h1>' +
          '<p class="lede">' + (offline
            ? 'This page was opened straight from a folder. Browsers block reading questions.json that way. Run <strong>npx serve</strong> in this folder and open the http:// address it prints — or just use the GitHub Pages URL.'
            : 'questions.json could not be read (' + esc(err.message) + '). Check that it sits next to index.html.') +
          '</p></div>';
      });
  }

  /* ================= welcome ================= */

  function renderWelcome() {
    $('nameInput').value = DATA.meta.student || 'Lily';

    $('stagePreview').innerHTML = DATA.domains.map(function (d) {
      return '<div class="card" data-accent="' + esc(d.accent) + '">' +
        '<span class="badge-sq">' + svg(d.icon, '1.4rem') + '</span>' +
        '<span class="name">' + esc(d.stage) + '</span>' +
        '<span class="blurb">' + esc(d.blurb) + '</span>' +
        '</div>';
    }).join('');

    $('sessionLine').innerHTML = 'Teacher code: <strong>' + esc(CODE) + '</strong>';

    $('startBtn').addEventListener('click', start);
    $('againBtn').addEventListener('click', function () { location.reload(); });
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('stageNextBtn').addEventListener('click', nextStage);
  }

  /* ================= quest lifecycle ================= */

  function start() {
    var name = ($('nameInput').value || 'Lily').trim().slice(0, 24) || 'Lily';
    var a = DATA.meta.adaptive;

    quest = {
      name: name,
      startedAt: Date.now(),
      stageIndex: 0,
      itemIndex: 0,
      stars: 0,
      answers: [],
      dom: {}
    };
    DATA.domains.forEach(function (d) {
      quest.dom[d.id] = { level: a.startLevel, streak: 0, used: [] };
    });

    Sync.set('student', { name: name, startedAt: Sync.stamp(), agent: navigator.userAgent.slice(0, 180) });
    Sync.set('report', null);
    Sync.set('events', null);

    show('screen-quest');
    nextItem();
  }

  function stage() { return DATA.domains[quest.stageIndex]; }

  function pickItem(domId) {
    var st = quest.dom[domId];
    var pool = DATA.items.filter(function (i) {
      return i.domain === domId && st.used.indexOf(i.id) < 0;
    });
    if (!pool.length) return null;

    // Serve at her current level; if that well is dry, step outward.
    var order = [st.level, st.level - 1, st.level + 1, st.level - 2, st.level + 2];
    for (var k = 0; k < order.length; k++) {
      var at = pool.filter(function (i) { return i.level === order[k]; });
      if (at.length) return shuffled(at)[0];
    }
    return pool[0];
  }

  function nextItem() {
    var d = stage();
    var it = pickItem(d.id);
    if (!it) { finishStage(); return; }
    quest.dom[d.id].used.push(it.id);
    renderItem(it, d);
  }

  function adjustLevel(domId, correct) {
    var a = DATA.meta.adaptive;
    var st = quest.dom[domId];
    if (correct) {
      st.streak++;
      if (st.streak >= a.promoteAfterCorrect) {
        st.level = Math.min(a.maxLevel, st.level + 1);
        st.streak = 0;
      }
    } else {
      st.streak = 0;
      st.level = Math.max(a.minLevel, st.level - a.demoteAfterWrong);
    }
  }

  /* ================= rendering one item ================= */

  function renderItem(it, d) {
    item = it;
    itemStart = Date.now();
    answered = false;
    plays = 0;
    picked = null;
    stopAudio();

    setAccent(d.accent);

    $('stageName').innerHTML =
      '<span class="badge-sq">' + svg(d.icon, '1.2rem') + '</span>' + esc(d.stage);

    // star track: one star per stage already won
    var stars = '';
    for (var s = 0; s < DATA.domains.length; s++) {
      stars += '<span class="' + (s < quest.stars ? 'star-won' : '') + '">' + svg('star', '1.4rem') + '</span>';
    }
    $('starTrack').innerHTML = stars;

    var per = DATA.meta.itemsPerDomain;
    var pips = '';
    for (var p = 0; p < per; p++) {
      pips += '<span class="pip ' + (p < quest.itemIndex ? 'is-done' : (p === quest.itemIndex ? 'is-current' : '')) + '"></span>';
    }
    $('pips').innerHTML = pips;

    $('qkind').textContent = KIND_LABEL[it.kind] || d.label;
    $('qpassage').innerHTML = it.text ? '<div class="qpassage">' + esc(it.text) + '</div>' : '';
    $('qtext').textContent = it.prompt;

    // audio control for listening items
    if (isListening(it.kind)) {
      $('qmedia').innerHTML =
        '<div class="audio-row"><button class="play-btn" type="button" id="playBtn">' +
        svg('volume', '1.6rem') + '<span>Listen</span></button>' +
        '<span style="color:var(--muted);font-size:.9rem">You can listen as many times as you like</span></div>';
      $('playBtn').addEventListener('click', playCurrent);
      setTimeout(playCurrent, 350); // best effort; the button is always there
    } else {
      $('qmedia').innerHTML = '';
    }

    $('qfeedback').innerHTML = '';
    $('qactions').innerHTML = '';

    if (it.kind === 'sentence-build') renderBuild(it);
    else if (it.kind === 'spell-word') renderSpell(it);
    else renderChoice(it);

    Sync.set('current', {
      id: it.id,
      domain: it.domain,
      domainLabel: d.label,
      stage: d.stage,
      kind: it.kind,
      ketRef: it.ketRef || '',
      level: it.level,
      prompt: it.prompt,
      passage: it.text || '',
      options: optionTexts(it),
      answer: answerText(it),
      picked: '',
      startedAt: Date.now()
    });
    pushState('working');
  }

  function optionTexts(it) {
    if (it.kind === 'sentence-build') return it.tiles.slice();
    if (it.kind === 'spell-word') return it.letterPool.slice();
    return (it.options || []).map(function (o) { return typeof o === 'string' ? o : o.label; });
  }

  function answerText(it) {
    if (it.kind === 'sentence-build') return it.answer;
    if (it.kind === 'spell-word') return it.word;
    var o = it.options[it.answer];
    return typeof o === 'string' ? o : o.label;
  }

  function pushState(status) {
    var d = stage();
    Sync.set('state', {
      stageIndex: quest.stageIndex,
      stageLabel: d ? d.stage : '',
      domain: d ? d.id : '',
      itemIndex: quest.itemIndex,
      itemsTotal: DATA.meta.itemsPerDomain,
      stagesTotal: DATA.domains.length,
      level: d ? quest.dom[d.id].level : 0,
      stars: quest.stars,
      correct: quest.answers.filter(function (a) { return a.correct; }).length,
      answered: quest.answers.length,
      elapsed: Date.now() - quest.startedAt,
      status: status,
      updatedAt: Sync.stamp()
    });
  }

  /* ---- choice items (text, picture and notice variants) ---- */

  function renderChoice(it) {
    var pics = it.options.length && typeof it.options[0] === 'object';
    var mode = pics ? 'pics' : (it.optionStyle === 'notice' ? 'notice' : 'text');
    var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    var html = '<div class="opts opts--' + mode + '">';
    it.options.forEach(function (o, i) {
      if (pics) {
        html += '<button class="opt opt--pic" type="button" data-i="' + i + '">' +
          '<span class="pic">' + svg(o.icon, '4rem') + '</span>' +
          '<span class="label">' + esc(o.label) + '</span></button>';
      } else if (mode === 'notice') {
        html += '<button class="opt opt--notice" type="button" data-i="' + i + '">' + esc(o) + '</button>';
      } else {
        html += '<button class="opt" type="button" data-i="' + i + '">' +
          '<span class="tag">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
      }
    });
    html += '</div>';
    $('qbody').innerHTML = html;

    Array.prototype.forEach.call($('qbody').querySelectorAll('.opt'), function (btn) {
      btn.addEventListener('click', function () {
        if (answered) return;
        var i = parseInt(btn.getAttribute('data-i'), 10);
        var right = i === item.answer;
        var opts = $('qbody').querySelectorAll('.opt');
        Array.prototype.forEach.call(opts, function (b, j) {
          b.disabled = true;
          if (j === item.answer) b.classList.add('is-correct');
          else if (j === i) b.classList.add('is-wrong');
          else b.classList.add('is-dim');
        });
        if (right) burst(btn);
        settle(right, optionTexts(item)[i]);
      });
    });
  }

  /* ---- sentence build: tap to place, tap again to take back ---- */

  function renderBuild(it) {
    picked = [];
    $('qbody').innerHTML =
      '<div class="slots" id="slots" data-empty="Tap the words below in the right order"></div>' +
      '<div style="height:14px"></div>' +
      '<div class="tiles" id="tiles"></div>';

    var pool = shuffled(it.tiles.map(function (t, i) { return { t: t, i: i }; }));

    function paint() {
      $('slots').innerHTML = picked.map(function (p, n) {
        return '<button class="tile tile--placed" type="button" data-slot="' + n + '">' + esc(p.t) + '</button>';
      }).join('');
      $('tiles').innerHTML = pool.map(function (p) {
        var used = picked.some(function (x) { return x.i === p.i; });
        return '<button class="tile' + (used ? ' is-used' : '') + '" type="button" data-i="' + p.i + '">' + esc(p.t) + '</button>';
      }).join('');

      Array.prototype.forEach.call($('tiles').querySelectorAll('.tile'), function (b) {
        b.addEventListener('click', function () {
          if (answered) return;
          var i = parseInt(b.getAttribute('data-i'), 10);
          if (picked.some(function (x) { return x.i === i; })) return;
          picked.push({ i: i, t: it.tiles[i] });
          paint();
        });
      });
      Array.prototype.forEach.call($('slots').querySelectorAll('.tile'), function (b) {
        b.addEventListener('click', function () {
          if (answered) return;
          picked.splice(parseInt(b.getAttribute('data-slot'), 10), 1);
          paint();
        });
      });

      $('checkBtn').disabled = picked.length !== it.tiles.length;
    }

    $('qactions').innerHTML =
      '<button class="btn btn--accent" id="checkBtn" type="button" disabled>Check my sentence</button>';
    $('checkBtn').addEventListener('click', function () {
      if (answered) return;
      var said = picked.map(function (p) { return p.t; }).join(' ');
      var right = sameText(said, it.answer);
      Array.prototype.forEach.call($('qbody').querySelectorAll('.tile'), function (b) { b.disabled = true; });
      $('slots').className = 'slots';
      if (right) burst($('slots'));
      settle(right, said);
    });

    paint();
  }

  /* ---- spell the word: first letter given, tap letters to fill ---- */

  function renderSpell(it) {
    picked = [];
    var word = it.word;
    var pool = shuffled(it.letterPool.map(function (c, i) { return { c: c, i: i }; }));

    function paint() {
      var slots = '<div class="spell-word">';
      for (var n = 0; n < word.length; n++) {
        if (n === 0) slots += '<span class="spell-slot is-given">' + esc(word[0]) + '</span>';
        else if (picked[n - 1]) slots += '<span class="spell-slot is-filled">' + esc(picked[n - 1].c) + '</span>';
        else slots += '<span class="spell-slot"></span>';
      }
      slots += '</div>';

      $('qbody').innerHTML = slots +
        '<div style="height:20px"></div>' +
        '<div class="letters" id="letters">' +
        pool.map(function (p) {
          var used = picked.some(function (x) { return x.i === p.i; });
          return '<button class="letter' + (used ? ' is-used' : '') + '" type="button" data-i="' + p.i + '">' + esc(p.c) + '</button>';
        }).join('') + '</div>';

      Array.prototype.forEach.call($('letters').querySelectorAll('.letter'), function (b) {
        b.addEventListener('click', function () {
          if (answered || picked.length >= word.length - 1) return;
          var i = parseInt(b.getAttribute('data-i'), 10);
          if (picked.some(function (x) { return x.i === i; })) return;
          picked.push({ i: i, c: it.letterPool[i] });
          paint();
        });
      });

      $('checkBtn').disabled = picked.length !== word.length - 1;
      $('undoBtn').disabled = picked.length === 0;
    }

    $('qactions').innerHTML =
      '<button class="btn btn--accent" id="checkBtn" type="button" disabled>Check my word</button>' +
      '<button class="btn btn--quiet" id="undoBtn" type="button" disabled>Undo</button>';

    $('undoBtn').addEventListener('click', function () {
      if (answered) return;
      picked.pop();
      paint();
    });
    $('checkBtn').addEventListener('click', function () {
      if (answered) return;
      var said = word[0] + picked.map(function (p) { return p.c; }).join('');
      var right = sameText(said, word);
      Array.prototype.forEach.call($('qbody').querySelectorAll('.letter'), function (b) { b.disabled = true; });
      if (right) burst($('qbody'));
      settle(right, said);
    });

    paint();
  }

  /* ================= after an answer ================= */

  function settle(right, saidText) {
    answered = true;
    stopAudio();

    var ms = Date.now() - itemStart;
    var d = stage();

    quest.answers.push({
      id: item.id,
      domain: item.domain,
      domainLabel: d.label,
      kind: item.kind,
      kindLabel: KIND_LABEL[item.kind] || item.kind,
      ketRef: item.ketRef || '',
      level: item.level,
      prompt: item.prompt,
      said: saidText,
      key: answerText(item),
      correct: right,
      ms: ms,
      plays: plays
    });

    adjustLevel(item.domain, right);

    Sync.push('events', {
      id: item.id,
      domain: item.domain,
      domainLabel: d.label,
      kind: item.kind,
      kindLabel: KIND_LABEL[item.kind] || item.kind,
      level: item.level,
      prompt: item.prompt,
      said: String(saidText).slice(0, 280),
      key: answerText(item),
      correct: right,
      ms: ms,
      plays: plays,
      at: Sync.stamp()
    });
    Sync.update('current', { picked: String(saidText).slice(0, 280), wasCorrect: right });
    pushState('answered');

    var msg = right
      ? PRAISE[Math.floor(Math.random() * PRAISE.length)]
      : NUDGE[Math.floor(Math.random() * NUDGE.length)] + ' The answer is “' + answerText(item) + '”.';

    $('qfeedback').innerHTML =
      '<div class="feedback feedback--' + (right ? 'yes' : 'no') + '">' +
      '<span class="fb-icon">' + svg(right ? 'check' : 'cross', '1.5rem') + '</span>' +
      '<span>' + esc(msg) + '</span></div>';

    var last = quest.itemIndex + 1 >= DATA.meta.itemsPerDomain;
    $('qactions').innerHTML =
      '<button class="btn btn--primary" id="nextBtn" type="button">' +
      (last ? 'Finish this stage' : 'Next') + '</button>';
    $('nextBtn').addEventListener('click', advance);
    $('nextBtn').focus();
  }

  function advance() {
    quest.itemIndex++;
    if (quest.itemIndex >= DATA.meta.itemsPerDomain) finishStage();
    else nextItem();
  }

  /* ================= stage + finish ================= */

  function finishStage() {
    var d = stage();
    quest.stars++;

    var mine = quest.answers.filter(function (a) { return a.domain === d.id; });
    var got = mine.filter(function (a) { return a.correct; }).length;

    setAccent(d.accent);
    $('stageDoneStar').innerHTML = svg('star', '5.5rem');
    $('stageDoneTitle').textContent = 'Star piece ' + quest.stars + ' of ' + DATA.domains.length + '!';
    $('stageDoneText').textContent =
      'You got ' + got + ' out of ' + mine.length + ' at ' + d.stage + '.';
    $('stageNextBtn').textContent =
      quest.stageIndex + 1 >= DATA.domains.length ? 'See how I did' : 'Next stage';

    pushState('stage-complete');
    show('screen-stagedone');
  }

  function nextStage() {
    quest.stageIndex++;
    quest.itemIndex = 0;
    if (quest.stageIndex >= DATA.domains.length) { finish(); return; }
    show('screen-quest');
    nextItem();
  }

  function finish() {
    var report = buildReport();
    renderReport(report);
    Sync.set('report', report);
    Sync.set('current', null);
    pushState('finished');
    show('screen-report');
  }

  /* ================= report =================
     Everything below is computed from quest.answers. No fixed narrative. */

  function levelName(n) {
    return (DATA.meta.levelNames && DATA.meta.levelNames[String(n)]) || ('level ' + n);
  }

  /* "a, b and c" — not "a and b and c" */
  function joinList(a) {
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  function buildReport() {
    var A = quest.answers;
    var total = A.length;
    var correct = A.filter(function (a) { return a.correct; }).length;
    var elapsed = Date.now() - quest.startedAt;

    var domains = DATA.domains.map(function (d) {
      var mine = A.filter(function (a) { return a.domain === d.id; });
      var got = mine.filter(function (a) { return a.correct; });
      var levelsRight = got.map(function (a) { return a.level; });
      var levelsSeen = mine.map(function (a) { return a.level; });
      return {
        id: d.id,
        label: d.label,
        stage: d.stage,
        accent: d.accent,
        icon: d.icon,
        asked: mine.length,
        correct: got.length,
        percent: mine.length ? Math.round(got.length / mine.length * 100) : 0,
        ceiling: levelsRight.length ? Math.max.apply(null, levelsRight) : 0,
        reached: levelsSeen.length ? Math.max.apply(null, levelsSeen) : 0,
        avgMs: mine.length ? Math.round(mine.reduce(function (s, a) { return s + a.ms; }, 0) / mine.length) : 0
      };
    });

    // Per task type, so feedback can name the actual activity she struggled with.
    var byKind = {};
    A.forEach(function (a) {
      var k = byKind[a.kind] || (byKind[a.kind] = { label: a.kindLabel, n: 0, got: 0 });
      k.n++; if (a.correct) k.got++;
    });

    return {
      name: quest.name,
      code: CODE,
      exam: DATA.meta.exam,
      finishedAt: Date.now(),
      elapsedMs: elapsed,
      asked: total,
      correct: correct,
      percent: total ? Math.round(correct / total * 100) : 0,
      domains: domains,
      byKind: byKind,
      strengths: strengthsFrom(domains, byKind, A),
      growth: growthFrom(domains, byKind, A),
      answers: A
    };
  }

  function strengthsFrom(domains, byKind, A) {
    var out = [];

    var strong = domains.filter(function (d) { return d.asked && d.percent >= 70; })
      .sort(function (a, b) { return b.percent - a.percent; });

    strong.forEach(function (d) {
      var s = d.label + ' — ' + d.correct + ' out of ' + d.asked + ' right';
      if (d.ceiling >= 2) s += ', including questions at ' + levelName(d.ceiling) + ' level';
      out.push(s + '.');
    });

    // Nothing cleared 70%? Then name the best area anyway — but say it as the
    // relative fact it is, not as praise the numbers don't support.
    if (!strong.length) {
      var best = domains.slice().sort(function (a, b) { return b.percent - a.percent; })[0];
      if (best && best.correct > 0) {
        out.push('Strongest area was ' + best.label.toLowerCase() + ' — ' +
          best.correct + ' out of ' + best.asked + '.');
      }
    }

    // Per-task praise is only informative when it distinguishes something.
    // On a flawless run it just restates the score, so it is suppressed.
    var kinds = Object.keys(byKind);
    var perfect = kinds.filter(function (k) { return byKind[k].n >= 2 && byKind[k].got === byKind[k].n; });
    if (perfect.length && perfect.length < kinds.length) {
      perfect.slice(0, 2).forEach(function (k) {
        out.push('Perfect on “' + byKind[k].label.toLowerCase() + '” — ' +
          byKind[k].n + ' out of ' + byKind[k].n + '.');
      });
    }

    var top = domains.filter(function (d) { return d.ceiling >= 3; });
    if (top.length) {
      out.push('Answered real A2 Key exam questions correctly in ' +
        joinList(top.map(function (d) { return d.label.toLowerCase(); })) + '.');
    }

    var quick = A.filter(function (a) { return a.correct && a.ms < 8000; });
    if (quick.length >= Math.ceil(A.length / 2) && out.length < 5) {
      out.push('Answered most questions confidently — ' + quick.length + ' correct answers in under 8 seconds.');
    }

    // If the evidence supports nothing at all, say that rather than invent praise.
    if (!out.length) {
      out.push('This run does not show a clear strength yet. The questions may be pitched too high — try again after some ' +
        levelName(1) + ' practice.');
    }
    return out.slice(0, 6);
  }

  function growthFrom(domains, byKind, A) {
    var out = [];

    domains.filter(function (d) { return d.asked && d.percent < 70; })
      .sort(function (a, b) { return a.percent - b.percent; })
      .forEach(function (d) {
        out.push(d.label + ' — ' + d.correct + ' out of ' + d.asked + '. ' +
          'She was working at ' + levelName(Math.max(1, d.reached)) + ' here.');
      });

    // Naming every missed task type is noise when she missed most of them —
    // the domain lines above already say that. Two most-attempted only.
    var kinds = Object.keys(byKind);
    var missed = kinds.filter(function (k) { return byKind[k].n >= 2 && byKind[k].got === 0; });
    if (missed.length && missed.length < kinds.length) {
      missed.sort(function (a, b) { return byKind[b].n - byKind[a].n; })
        .slice(0, 2)
        .forEach(function (k) {
          out.push('Missed every “' + byKind[k].label.toLowerCase() + '” question (' +
            byKind[k].n + ' of them) — worth teaching that task type directly.');
        });
    }

    var stuckLow = domains.filter(function (d) { return d.asked && d.reached <= 1; });
    if (stuckLow.length) {
      out.push('Stayed at ' + levelName(1) + ' level throughout ' +
        joinList(stuckLow.map(function (d) { return d.label.toLowerCase(); })) +
        ', so A2 Key material was never reached there.');
    }

    var replayed = A.filter(function (a) { return a.plays >= 3; });
    if (replayed.length >= 2) {
      out.push('Replayed the audio 3+ times on ' + replayed.length + ' listening questions — more listening at natural speed would help.');
    }

    var slow = A.filter(function (a) { return a.ms > 30000; });
    if (slow.length >= 3) {
      out.push(slow.length + ' questions took over 30 seconds, which usually means the wording, not the English, was the obstacle.');
    }

    if (!out.length) {
      out.push('Nothing came out weak in this run — every skill scored 70% or above. ' +
        'The next useful step is a longer test with more ' + levelName(3) + ' questions, since this one may not have found her ceiling.');
    }
    return out.slice(0, 6);
  }

  function renderReport(rep) {
    setAccent('cyan');

    $('reportTitle').textContent = 'Well done, ' + rep.name + '!';
    $('reportPct').textContent = rep.percent + '%';
    $('reportFraction').textContent = rep.correct + ' of ' + rep.asked + ' right';

    var C = 2 * Math.PI * 52;
    var ring = $('ringValue');
    ring.setAttribute('stroke-dasharray', C.toFixed(1));
    ring.setAttribute('stroke-dashoffset', C.toFixed(1));
    setTimeout(function () {
      ring.setAttribute('stroke-dashoffset', (C * (1 - rep.percent / 100)).toFixed(1));
    }, 60);

    var ceilings = rep.domains.map(function (d) { return d.ceiling; });
    var best = Math.max.apply(null, ceilings.concat([0]));

    $('reportMeta').innerHTML =
      '<span class="chip chip--quiet">' + clockTime(rep.elapsedMs) + ' total</span>' +
      '<span class="chip chip--quiet">' + clockTime(rep.elapsedMs / rep.asked) + ' per question</span>' +
      '<span class="chip chip--quiet">' + esc(rep.exam) + '</span>' +
      (best ? '<span class="chip">Reached ' + esc(levelName(best)) + '</span>' : '');

    $('domainGrid').innerHTML = rep.domains.map(function (d) {
      return '<div class="dcard" data-accent="' + esc(d.accent) + '">' +
        '<div class="dhead">' +
          '<span class="badge-sq">' + svg(d.icon, '1.2rem') + '</span>' +
          '<span class="dname">' + esc(d.label) + '</span>' +
          '<span class="dscore">' + d.correct + '/' + d.asked + '</span>' +
        '</div>' +
        '<div class="bar"><span style="width:' + d.percent + '%"></span></div>' +
        '<div class="dlevel">' +
          (d.ceiling ? 'Highest level answered correctly: ' + esc(levelName(d.ceiling))
                     : 'No correct answers above ' + esc(levelName(1))) +
          ' · ' + clockTime(d.avgMs) + ' avg' +
        '</div>' +
      '</div>';
    }).join('');

    $('strengthsList').innerHTML = rep.strengths.map(function (s) {
      return '<li><span class="li-badge li-badge--good">' + svg('check', '.95rem') + '</span><span>' + esc(s) + '</span></li>';
    }).join('');

    $('growthList').innerHTML = rep.growth.map(function (s) {
      return '<li><span class="li-badge li-badge--work">' + svg('next', '.95rem') + '</span><span>' + esc(s) + '</span></li>';
    }).join('');

    $('reviewList').innerHTML = rep.answers.map(function (a) {
      return '<div class="review-item">' +
        '<span class="ri-icon ri-icon--' + (a.correct ? 'yes' : 'no') + '">' +
          svg(a.correct ? 'check' : 'cross', '.9rem') + '</span>' +
        '<span class="ri-body">' +
          '<span class="ri-q">' + esc(a.prompt) + '</span>' +
          '<span class="ri-a">' + esc(a.domainLabel) + ' · ' + esc(levelName(a.level)) +
            ' · she said “' + esc(a.said) + '”' +
            (a.correct ? '' : ' · answer: “' + esc(a.key) + '”') +
            (a.ketRef ? ' · ' + esc(a.ketRef) : '') +
          '</span>' +
        '</span></div>';
    }).join('');
  }

  /* ================= reward burst ================= */

  function burst(anchor) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r = anchor.getBoundingClientRect();
    var host = document.createElement('div');
    host.className = 'burst';
    for (var i = 0; i < 10; i++) {
      var s = document.createElement('span');
      var ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
      var dist = 90 + Math.random() * 90;
      s.style.left = (r.left + r.width / 2) + 'px';
      s.style.top = (r.top + r.height / 2) + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.animationDelay = (Math.random() * 0.1) + 's';
      s.innerHTML = svg('star', '1.5rem');
      host.appendChild(s);
    }
    document.body.appendChild(host);
    setTimeout(function () { host.remove(); }, 1000);
  }

  /* ================= go ================= */

  boot();
})();
