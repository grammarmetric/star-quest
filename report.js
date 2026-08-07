/* report.js — the score report, shared by the student page and the teacher page.
   ------------------------------------------------------------------
   Both pages must produce byte-identical wording, so the whole narrative
   lives here once. Nothing below is pre-written prose: every sentence is
   assembled from the answers actually given. If the evidence supports no
   claim, no claim is made.
   ------------------------------------------------------------------ */

window.Report = (function () {

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

  function levelName(data, n) {
    return (data.meta.levelNames && data.meta.levelNames[String(n)]) || ('level ' + n);
  }

  /* "a, b and c" — not "a and b and c" */
  function joinList(a) {
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  function answerText(it) {
    if (it.kind === 'sentence-build') return it.answer;
    if (it.kind === 'spell-word') return it.word;
    var o = it.options[it.answer];
    return typeof o === 'string' ? o : o.label;
  }

  /* Rebuild full answers from the compact handoff rows plus questions.json.
     Anything derivable from the item bank is looked up, never transmitted. */
  function hydrate(rows, data) {
    var byId = {};
    data.items.forEach(function (i) { byId[i.id] = i; });
    var domById = {};
    data.domains.forEach(function (d) { domById[d.id] = d; });

    return rows.map(function (r) {
      var it = byId[r.id];
      if (!it) {
        return {
          id: r.id, domain: 'unknown', domainLabel: 'Unknown', kind: 'unknown',
          kindLabel: 'Unknown task', level: 1, prompt: '(this question is no longer in questions.json)',
          said: r.said, key: '?', correct: r.correct, ms: r.ms, plays: r.plays, missing: true
        };
      }
      return {
        id: it.id,
        domain: it.domain,
        domainLabel: (domById[it.domain] || {}).label || it.domain,
        kind: it.kind,
        kindLabel: KIND_LABEL[it.kind] || it.kind,
        ketRef: it.ketRef || '',
        level: it.level,
        prompt: it.prompt,
        said: r.said,
        key: answerText(it),
        correct: r.correct,
        ms: r.ms,
        plays: r.plays
      };
    });
  }

  function build(opts) {
    var data = opts.data;
    var A = opts.answers;
    var total = A.length;
    var correct = A.filter(function (a) { return a.correct; }).length;

    var domains = data.domains.map(function (d) {
      var mine = A.filter(function (a) { return a.domain === d.id; });
      var got = mine.filter(function (a) { return a.correct; });
      var levelsRight = got.map(function (a) { return a.level; });
      var levelsSeen = mine.map(function (a) { return a.level; });
      return {
        id: d.id, label: d.label, stage: d.stage, accent: d.accent, icon: d.icon,
        asked: mine.length,
        correct: got.length,
        percent: mine.length ? Math.round(got.length / mine.length * 100) : 0,
        ceiling: levelsRight.length ? Math.max.apply(null, levelsRight) : 0,
        reached: levelsSeen.length ? Math.max.apply(null, levelsSeen) : 0,
        avgMs: mine.length ? Math.round(mine.reduce(function (s, a) { return s + a.ms; }, 0) / mine.length) : 0
      };
    }).filter(function (d) { return d.asked > 0 || A.length === 0; });

    var byKind = {};
    A.forEach(function (a) {
      var k = byKind[a.kind] || (byKind[a.kind] = { label: a.kindLabel, n: 0, got: 0 });
      k.n++; if (a.correct) k.got++;
    });

    return {
      name: opts.name,
      code: opts.code || '',
      exam: data.meta.exam,
      finishedAt: opts.finishedAt || Date.now(),
      elapsedMs: opts.elapsedMs,
      asked: total,
      correct: correct,
      percent: total ? Math.round(correct / total * 100) : 0,
      domains: domains,
      byKind: byKind,
      strengths: strengths(domains, byKind, A, data),
      growth: growth(domains, byKind, A, data),
      answers: A
    };
  }

  function strengths(domains, byKind, A, data) {
    var out = [];
    var LN = function (n) { return levelName(data, n); };

    var strong = domains.filter(function (d) { return d.asked && d.percent >= 70; })
      .sort(function (a, b) { return b.percent - a.percent; });

    strong.forEach(function (d) {
      var s = d.label + ' — ' + d.correct + ' out of ' + d.asked + ' right';
      if (d.ceiling >= 2) s += ', including questions at ' + LN(d.ceiling) + ' level';
      out.push(s + '.');
    });

    // Nothing cleared 70%? Name the best area anyway, as the relative fact it
    // is — not as praise the numbers do not support.
    if (!strong.length) {
      var best = domains.slice().sort(function (a, b) { return b.percent - a.percent; })[0];
      if (best && best.correct > 0) {
        out.push('Strongest area was ' + best.label.toLowerCase() + ' — ' +
          best.correct + ' out of ' + best.asked + '.');
      }
    }

    // Per-task praise only informs when it distinguishes something. On a
    // flawless run it merely restates the score, so it is suppressed.
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

    if (!out.length) {
      out.push('This run does not show a clear strength yet. The questions may be pitched too high — try again after some ' +
        LN(1) + ' practice.');
    }
    return out.slice(0, 6);
  }

  function growth(domains, byKind, A, data) {
    var out = [];
    var LN = function (n) { return levelName(data, n); };

    domains.filter(function (d) { return d.asked && d.percent < 70; })
      .sort(function (a, b) { return a.percent - b.percent; })
      .forEach(function (d) {
        out.push(d.label + ' — ' + d.correct + ' out of ' + d.asked + '. ' +
          'She was working at ' + LN(Math.max(1, d.reached)) + ' here.');
      });

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
      out.push('Stayed at ' + LN(1) + ' level throughout ' +
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
        'The next useful step is a longer test with more ' + LN(3) + ' questions, since this one may not have found her ceiling.');
    }
    return out.slice(0, 6);
  }

  return {
    KIND_LABEL: KIND_LABEL,
    levelName: levelName,
    joinList: joinList,
    answerText: answerText,
    hydrate: hydrate,
    build: build
  };
})();
