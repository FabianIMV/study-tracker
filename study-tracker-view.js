/*!
 * study-tracker-view — pantalla de progreso lista para usar con study-tracker.
 * Sin dependencias. Funciona como <script> (window.StudyTrackerView) y con require(). Licencia MIT.
 *
 *   StudyTrackerView.render(contenedor, tracker, {
 *     topics: [{ id: '1', label: 'Basics', total: 60 }, ...],
 *     getQuestion: function (id) { return { text, options: [...], correct: [indexes] }; }, // opcional
 *     fileName: 'my-progress.json'                                                         // opcional
 *   });
 */
(function (root) {
  'use strict';

  var TEXTS = {
    title: 'Your progress',
    week: 'Week', month: 'Month',
    thisWeek: 'this week', thisMonth: 'this month',
    prevWeek: 'last week', prevMonth: 'last month',
    empty: 'No answers saved yet. Take a quiz and your progress will show up here.',
    notPersistent: 'This browser cannot save data (for example, in private mode). Your progress will be lost when you close the page.',
    mastery: 'Estimated mastery',
    masteryHelp: 'Of the questions you have seen, how many you got right the last time you answered them.',
    accuracy: 'Accuracy',
    seen: 'Questions seen',
    answered: 'Answered',
    noChange: 'no change',
    noPrev: 'no previous data',
    byTopic: 'By topic',
    topic: 'Topic', change: 'Change', seenShort: 'Seen',
    trend: 'Accuracy by', overall: 'Overall',
    history: 'Session history',
    completed: 'Completed', stopped: 'Stopped early', open: 'Not finished',
    of: 'of', answeredOf: 'answered',
    yourAnswer: 'Your answer', correctAnswer: 'Correct',
    data: 'Your data',
    dataHelp: 'Everything is stored only in this browser. Export a copy so you don\'t lose it or to move it to another device.',
    exportBtn: 'Export copy', importBtn: 'Import copy', clearBtn: 'Delete all',
    confirmClear: 'Delete your whole history? This cannot be undone.',
    imported: 'Imported {n} new answers.',
    importError: 'Could not import: ',
    pts: 'pts', points: 'answers', weekOf: 'Week of', inProgress: 'in progress',
    liveNote: 'The hollow dot is the current period: it can still change.'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtPct(v) { return v == null ? '—' : (Math.round(v) + '\u00a0%'); }

  function render(container, tracker, opts) {
    opts = opts || {};
    var T = Object.assign({}, TEXTS, opts.texts || {});
    var locale = opts.locale || 'en';
    var topics = (opts.topics || []).map(function (t) { return { id: String(t.id), label: t.label || String(t.id), total: t.total }; });
    var totals = {};
    topics.forEach(function (t) { if (t.total != null) totals[t.id] = t.total; });
    var state = { period: opts.period || 'week', openSession: null };

    function fmtPeriod(start, long) {
      var d = new Date(start);
      if (state.period === 'month') {
        return d.toLocaleDateString(locale, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
      }
      var s = d.toLocaleDateString(locale, long ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
      return long ? T.weekOf + ' ' + s : s;
    }
    function fmtDate(ms) {
      return new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function topicLabel(id) {
      for (var i = 0; i < topics.length; i++) if (topics[i].id === id) return topics[i].label;
      return id;
    }

    function deltaHtml(d, emptyText) {
      if (d == null) return '<span class="st-delta">' + esc(emptyText) + '</span>';
      if (Math.abs(d) < 0.5) return '<span class="st-delta">' + esc(T.noChange) + '</span>';
      var up = d > 0;
      return '<span class="st-delta"><span class="st-arrow ' + (up ? 'st-up' : 'st-down') + '" aria-hidden="true">' +
        (up ? '▲' : '▼') + '</span>' + (up ? '+' : '−') + Math.round(Math.abs(d)) + ' ' + T.pts + '</span>';
    }

    /* ---------- Gráfico de línea (una serie) ---------- */
    function lineChart(stats, pick, label) {
      var W = 300, H = 130, L = 30, R = 10, Tp = 10, B = 22;
      var iw = W - L - R, ih = H - Tp - B;
      var n = stats.length;
      function x(i) { return L + (n === 1 ? iw / 2 : i * iw / (n - 1)); }
      function y(v) { return Tp + ih - v / 100 * ih; }
      var grid = [0, 50, 100].map(function (g) {
        return '<line class="st-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/>' +
          '<text class="st-axis" x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + g + '</text>';
      }).join('');
      // La línea se corta en los periodos sin respuestas para no inventar datos.
      var paths = [], cur = [];
      stats.forEach(function (s, i) {
        var v = pick(s);
        if (v.pct == null) { if (cur.length) paths.push(cur); cur = []; return; }
        cur.push(x(i) + ',' + y(v.pct));
      });
      if (cur.length) paths.push(cur);
      var lines = paths.map(function (p) {
        return p.length > 1 ? '<polyline class="st-line" points="' + p.join(' ') + '"/>' : '';
      }).join('');
      var dots = stats.map(function (s, i) {
        var v = pick(s);
        if (v.pct == null) return '';
        // El periodo en curso se dibuja hueco: su valor todavía puede cambiar.
        var live = s.end > Date.now();
        var tip = fmtPeriod(s.start, true) + (live ? ' (' + T.inProgress + ')' : '') + ' · ' + label + ': ' + fmtPct(v.pct) + ' (' + v.answered + ' ' + T.points + ')';
        return '<circle class="st-dot' + (live ? ' st-dot-live' : '') + '" cx="' + x(i) + '" cy="' + y(v.pct) + '" r="4"/>' +
          '<circle class="st-hit" cx="' + x(i) + '" cy="' + y(v.pct) + '" r="12" tabindex="0" data-tip="' + esc(tip) + '"><title>' + esc(tip) + '</title></circle>';
      }).join('');
      var xl = n ? '<text class="st-axis" x="' + x(0) + '" y="' + (H - 6) + '" text-anchor="' + (n === 1 ? 'middle' : 'start') + '">' + esc(fmtPeriod(stats[0].start)) + '</text>' +
        (n > 1 ? '<text class="st-axis" x="' + x(n - 1) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtPeriod(stats[n - 1].start)) + '</text>' : '') : '';
      return '<svg class="st-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(T.trend + ' ' + label) + '">' + grid + lines + dots + xl + '</svg>';
    }

    function trendTable(stats, pick) {
      return '<table class="st-table st-sr"><tr><th>' + esc(state.period === 'week' ? T.week : T.month) + '</th><th>' + esc(T.accuracy) + '</th><th>' + esc(T.answered) + '</th></tr>' +
        stats.map(function (s) { var v = pick(s); return '<tr><td>' + esc(fmtPeriod(s.start, true)) + '</td><td>' + fmtPct(v.pct) + '</td><td>' + v.answered + '</td></tr>'; }).join('') +
        '</table>';
    }

    /* ---------- Historial ---------- */
    function sessionDetail(sessionId) {
      if (!opts.getQuestion) return '';
      return '<ol class="st-answers">' + tracker.getAnswers({ session: sessionId }).map(function (a) {
        var q = opts.getQuestion(a.question);
        if (!q) return '';
        var picked = [].concat(a.response == null ? [] : a.response);
        var opt = function (i) { return q.options && q.options[i] != null ? q.options[i] : String(i); };
        return '<li class="' + (a.correct ? 'st-ok' : 'st-ko') + '"><p class="st-q">' + esc(q.text) + '</p>' +
          '<p><span class="st-mark" aria-hidden="true">' + (a.correct ? '✔' : '✘') + '</span> ' + esc(T.yourAnswer) + ': ' + esc(picked.map(opt).join(' · ') || '—') + '</p>' +
          (a.correct ? '' : '<p><span class="st-mark" aria-hidden="true">✔</span> ' + esc(T.correctAnswer) + ': ' + esc([].concat(q.correct || []).map(opt).join(' · ')) + '</p>') +
          '</li>';
      }).join('') + '</ol>';
    }

    function historyHtml(sessions) {
      return sessions.map(function (s) {
        var status = s.endedAt ? (s.reason === 'stopped' ? T.stopped : T.completed) : T.open;
        var count = s.planned ? s.answered + ' ' + T.of + ' ' + s.planned + ' ' + T.answeredOf : s.answered + ' ' + T.answeredOf;
        var open = state.openSession === s.id;
        return '<div class="st-session">' +
          '<button class="st-session-h" data-session="' + esc(s.id) + '" aria-expanded="' + open + '"' + (opts.getQuestion ? '' : ' disabled') + '>' +
          '<span class="st-session-date">' + esc(fmtDate(s.startedAt)) + '</span>' +
          '<span class="st-session-n">' + esc(count) + '</span>' +
          '<span class="st-badge">' + esc(status) + '</span>' +
          '<span class="st-session-pct">' + fmtPct(s.pct) + '</span></button>' +
          (open ? sessionDetail(s.id) : '') + '</div>';
      }).join('');
    }

    /* ---------- Pantalla completa ---------- */
    function paint() {
      var sessions = tracker.getSessions();
      var isWeek = state.period === 'week';
      var head = '<div class="st-head"><h2>' + esc(T.title) + '</h2>' +
        '<div class="st-toggle" role="group">' +
        ['week', 'month'].map(function (p) {
          return '<button data-period="' + p + '" aria-pressed="' + (state.period === p) + '">' + esc(p === 'week' ? T.week : T.month) + '</button>';
        }).join('') + '</div></div>' +
        (tracker.isPersistent() ? '' : '<p class="st-warn">' + esc(T.notPersistent) + '</p>');

      var dataBox = '<section class="st-card"><h3>' + esc(T.data) + '</h3><p class="st-muted">' + esc(T.dataHelp) + '</p>' +
        '<div class="st-actions"><button data-act="export">' + esc(T.exportBtn) + '</button>' +
        '<label class="st-file">' + esc(T.importBtn) + '<input type="file" accept="application/json,.json" data-act="import"></label>' +
        '<button data-act="clear" class="st-danger">' + esc(T.clearBtn) + '</button></div>' +
        '<p class="st-muted st-msg" aria-live="polite"></p></section>';

      if (!sessions.length) {
        container.innerHTML = '<div class="st-root">' + head + '<p class="st-card st-empty">' + esc(T.empty) + '</p>' + dataBox + '</div>';
        return;
      }

      var p = tracker.progress(state.period, { topics: totals });
      var stats = tracker.periodStats(state.period, { limit: 12 });
      var periodWord = isWeek ? T.thisWeek : T.thisMonth;
      var prevWord = isWeek ? T.prevWeek : T.prevMonth;

      var tiles = '<div class="st-tiles">' +
        '<div class="st-tile"><div class="st-tile-k" title="' + esc(T.masteryHelp) + '">' + esc(T.mastery) + '</div><div class="st-tile-v">' + fmtPct(p.mastery) + '</div>' +
          deltaHtml(p.masteryDelta, T.noPrev) + ' <span class="st-muted">' + esc(periodWord) + '</span></div>' +
        '<div class="st-tile"><div class="st-tile-k">' + esc(T.accuracy + ' ' + periodWord) + '</div><div class="st-tile-v">' + fmtPct(p.pct) + '</div>' +
          deltaHtml(p.pctDelta, T.noPrev) + ' <span class="st-muted">vs ' + esc(prevWord) + '</span></div>' +
        '<div class="st-tile"><div class="st-tile-k">' + esc(T.answered + ' ' + periodWord) + '</div><div class="st-tile-v">' + p.answered + '</div>' +
          '<span class="st-muted">' + p.prevAnswered + ' ' + esc(prevWord) + '</span></div>' +
        '<div class="st-tile"><div class="st-tile-k">' + esc(T.seen) + '</div><div class="st-tile-v">' + p.seen + (p.total ? '<small> / ' + p.total + '</small>' : '') + '</div>' +
          (p.coverage != null ? '<span class="st-muted">' + fmtPct(p.coverage) + '</span>' : '') + '</div>' +
        '</div>';

      var topicIds = topics.length ? topics.map(function (t) { return t.id; }) : Object.keys(p.byTopic).sort();
      var topicTable = '<section class="st-card"><h3>' + esc(T.byTopic) + '</h3>' +
        '<p class="st-muted">' + esc(T.mastery + ': ' + T.masteryHelp) + '</p>' +
        '<div class="st-scroll"><table class="st-table"><thead><tr><th>' + esc(T.topic) + '</th><th>' + esc(T.mastery) + '</th><th>' + esc(T.change + ' ' + periodWord) +
        '</th><th>' + esc(T.seenShort) + '</th><th>' + esc(T.accuracy + ' ' + periodWord) + '</th></tr></thead><tbody>' +
        topicIds.map(function (id) {
          var t = p.byTopic[id] || {};
          return '<tr><td>' + esc(topicLabel(id)) + '</td>' +
            '<td><div class="st-bar"><div class="st-bar-track"><div class="st-bar-fill" style="width:' + (t.mastery || 0) + '%"></div></div><span>' + fmtPct(t.mastery) + '</span></div></td>' +
            '<td>' + deltaHtml(t.masteryDelta, '—') + '</td>' +
            '<td>' + (t.seen || 0) + (t.total ? ' / ' + t.total : '') + '</td>' +
            '<td>' + fmtPct(t.pct) + (t.answered ? ' <span class="st-muted">(' + t.answered + ')</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';

      var multiples = [{ label: T.overall, pick: function (s) { return s; } }].concat(topicIds.map(function (id) {
        return { label: topicLabel(id), pick: function (s) { return s.byTopic[id] || { answered: 0, pct: null }; } };
      }));
      var trend = '<section class="st-card"><h3>' + esc(T.trend + ' ' + (isWeek ? T.week : T.month).toLowerCase()) + '</h3>' +
        '<p class="st-muted">' + esc(T.liveNote) + '</p>' +
        '<div class="st-multiples">' + multiples.map(function (m) {
          return '<figure class="st-figure"><figcaption>' + esc(m.label) + '</figcaption>' + lineChart(stats, m.pick, m.label) + trendTable(stats, m.pick) + '</figure>';
        }).join('') + '</div></section>';

      var history = '<section class="st-card"><h3>' + esc(T.history) + '</h3>' + historyHtml(sessions) + '</section>';

      container.innerHTML = '<div class="st-root">' + head + tiles + topicTable + trend + history + dataBox + '<div class="st-tip" hidden></div></div>';
    }

    /* ---------- Eventos (delegados, sobreviven a cada repintado) ---------- */
    function msg(text) {
      var m = container.querySelector('.st-msg');
      if (m) m.textContent = text;
    }
    function onClick(ev) {
      var b = ev.target.closest('button');
      if (!b || !container.contains(b)) return;
      if (b.dataset.period) { state.period = b.dataset.period; paint(); return; }
      if (b.dataset.session) { state.openSession = state.openSession === b.dataset.session ? null : b.dataset.session; paint(); return; }
      if (b.dataset.act === 'export') {
        var blob = new Blob([JSON.stringify(tracker.exportData(), null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = opts.fileName || ('progress-' + tracker.appId + '-' + new Date().toISOString().slice(0, 10) + '.json');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }
      if (b.dataset.act === 'clear' && window.confirm(T.confirmClear)) tracker.clear();
    }
    function onChange(ev) {
      var input = ev.target;
      if (input.dataset.act !== 'import' || !input.files[0]) return;
      input.files[0].text().then(function (text) {
        var n = tracker.importData(text, 'merge');
        msg(T.imported.replace('{n}', n));
      }).catch(function (e) { msg(T.importError + e.message); });
    }
    function showTip(ev) {
      var hit = ev.target.closest && ev.target.closest('.st-hit');
      var tip = container.querySelector('.st-tip');
      if (!tip) return;
      if (!hit) { tip.hidden = true; return; }
      var box = container.querySelector('.st-root').getBoundingClientRect();
      var r = hit.getBoundingClientRect();
      tip.textContent = hit.getAttribute('data-tip');
      tip.hidden = false;
      var left = r.left + r.width / 2 - box.left - tip.offsetWidth / 2;
      tip.style.left = Math.max(0, Math.min(left, box.width - tip.offsetWidth)) + 'px';
      tip.style.top = (r.top - box.top - tip.offsetHeight - 6) + 'px';
    }

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('mouseover', showTip);
    container.addEventListener('focusin', showTip);
    container.addEventListener('mouseleave', showTip);
    var unsubscribe = tracker.onChange(paint);
    paint();

    return {
      refresh: paint,
      destroy: function () {
        unsubscribe();
        container.removeEventListener('click', onClick);
        container.removeEventListener('change', onChange);
        container.removeEventListener('mouseover', showTip);
        container.removeEventListener('focusin', showTip);
        container.removeEventListener('mouseleave', showTip);
        container.innerHTML = '';
      }
    };
  }

  var api = { render: render, texts: TEXTS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyTrackerView = api;
})(typeof self !== 'undefined' ? self : this);
