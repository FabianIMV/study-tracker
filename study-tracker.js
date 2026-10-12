/*!
 * study-tracker — guarda respuestas de estudio en el navegador y calcula el avance.
 * Sin dependencias. Funciona como <script> (window.StudyTracker) y con require().
 * Licencia MIT.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyTracker = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA = 1;

  /* ---------- Almacenamiento ---------- */

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  // localStorage puede no existir (Node) o lanzar (modo privado, cookies bloqueadas).
  function browserStorage() {
    try {
      var s = window.localStorage, probe = '__study-tracker__';
      s.setItem(probe, '1'); s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  function emptyData(appId) {
    return { schema: SCHEMA, appId: appId, sessions: [], answers: [] };
  }

  // Punto único para migrar datos guardados con versiones anteriores del esquema.
  function migrate(raw, appId) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions) || !Array.isArray(raw.answers)) {
      return emptyData(appId);
    }
    raw.schema = SCHEMA;
    raw.appId = appId;
    return raw;
  }

  /* ---------- Fechas ---------- */

  function startOfDay(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  // Semana de lunes a domingo, en hora local.
  function startOfWeek(ms) {
    var d = new Date(startOfDay(ms));
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.getTime();
  }
  function startOfMonth(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  function periodStart(period, ms) {
    if (period === 'day') return startOfDay(ms);
    if (period === 'week') return startOfWeek(ms);
    if (period === 'month') return startOfMonth(ms);
    throw new Error('study-tracker: unknown period "' + period + '" (use day, week or month)');
  }
  function nextPeriodStart(period, start) {
    var d = new Date(start);
    if (period === 'day') d.setDate(d.getDate() + 1);
    else if (period === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }
  function prevPeriodStart(period, start) {
    var d = new Date(start);
    if (period === 'day') d.setDate(d.getDate() - 1);
    else if (period === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }

  /* ---------- Cálculos puros ---------- */

  function pct(correct, total) {
    return total ? Math.round(correct / total * 1000) / 10 : null;
  }

  function tally(answers) {
    var out = { answered: 0, correct: 0, pct: null, byTopic: {} };
    answers.forEach(function (a) {
      out.answered++;
      if (a.correct) out.correct++;
      var t = out.byTopic[a.topic] || (out.byTopic[a.topic] = { answered: 0, correct: 0, pct: null });
      t.answered++;
      if (a.correct) t.correct++;
    });
    out.pct = pct(out.correct, out.answered);
    Object.keys(out.byTopic).forEach(function (k) {
      var t = out.byTopic[k];
      t.pct = pct(t.correct, t.answered);
    });
    return out;
  }

  /*
   * Dominio estimado: de las preguntas que has visto, qué porcentaje acertaste
   * la última vez que respondiste cada una. Evita que repetir muchas veces una
   * pregunta fácil infle el resultado, y refleja que ya corregiste un error.
   */
  function masteryOf(answers, until, topics) {
    var latest = {};
    answers.forEach(function (a) {
      if (until != null && a.at >= until) return;
      var prev = latest[a.question];
      if (!prev || a.at >= prev.at) latest[a.question] = a;
    });
    var byTopic = {}, seen = 0, ok = 0;
    Object.keys(latest).forEach(function (q) {
      var a = latest[q];
      var t = byTopic[a.topic] || (byTopic[a.topic] = { seen: 0, mastered: 0 });
      t.seen++; seen++;
      if (a.correct) { t.mastered++; ok++; }
    });
    var totals = topics || {};
    var totalAll = 0;
    Object.keys(totals).forEach(function (k) {
      totalAll += totals[k];
      if (!byTopic[k]) byTopic[k] = { seen: 0, mastered: 0 };
    });
    Object.keys(byTopic).forEach(function (k) {
      var t = byTopic[k];
      t.total = totals[k] != null ? totals[k] : null;
      t.mastery = pct(t.mastered, t.seen);
      t.coverage = t.total ? pct(t.seen, t.total) : null;
    });
    return {
      seen: seen, mastered: ok, mastery: pct(ok, seen),
      total: totalAll || null, coverage: totalAll ? pct(seen, totalAll) : null,
      byTopic: byTopic
    };
  }

  function delta(now, before) {
    return now == null || before == null ? null : Math.round((now - before) * 10) / 10;
  }

  /* ---------- Tracker ---------- */

  function create(opts) {
    opts = opts || {};
    if (!opts.appId || !/^[\w.-]+$/.test(opts.appId)) {
      throw new Error('study-tracker: appId is required (letters, digits, dot, hyphen or underscore)');
    }
    var appId = opts.appId;
    var key = 'study-tracker:' + appId;
    var store = opts.storage || browserStorage();
    var persistent = !!store;
    if (!store) store = memoryStorage();
    var now = opts.now || function () { return Date.now(); };
    var listeners = [];
    var data = load();

    function load() {
      try {
        var raw = store.getItem(key);
        return migrate(raw ? JSON.parse(raw) : null, appId);
      } catch (e) {
        return emptyData(appId);
      }
    }
    function notify() {
      listeners.forEach(function (fn) { try { fn(); } catch (e) { /* no romper al llamador */ } });
    }
    // Relee antes de escribir: si la app está abierta en dos pestañas, ninguna
    // pisa las respuestas que guardó la otra.
    function update(fn) {
      if (persistent) data = load();
      var result = fn();
      try {
        store.setItem(key, JSON.stringify(data));
      } catch (e) {
        persistent = false; // cuota llena o almacenamiento bloqueado: seguimos en memoria
      }
      notify();
      return result;
    }
    if (typeof window !== 'undefined' && !opts.storage && persistent) {
      window.addEventListener('storage', function (ev) {
        if (ev.key === key) { data = load(); notify(); }
      });
    }
    function uid() {
      return now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    function findSession(id) {
      for (var i = 0; i < data.sessions.length; i++) if (data.sessions[i].id === id) return data.sessions[i];
      return null;
    }
    function inRange(a, from, to) {
      return (from == null || a.at >= from) && (to == null || a.at < to);
    }

    var api = {
      appId: appId,
      /** true si los datos sobreviven al cerrar el navegador. */
      isPersistent: function () { return persistent; },

      /** Empieza una sesión de estudio y devuelve su id. */
      startSession: function (o) {
        o = o || {};
        var s = { id: uid(), startedAt: now(), endedAt: null, planned: o.planned != null ? o.planned : null, meta: o.meta || {} };
        return update(function () { data.sessions.push(s); return s.id; });
      },

      /**
       * Guarda una respuesta al instante, así no se pierde nada si se cierra la página.
       * answer: { question, topic, correct, response? }
       */
      recordAnswer: function (sessionId, answer) {
        if (!answer || answer.question == null) throw new Error('study-tracker: answer.question is required');
        update(function () {
          if (!findSession(sessionId)) throw new Error('study-tracker: unknown session ' + sessionId);
          data.answers.push({
            session: sessionId,
            question: String(answer.question),
            topic: answer.topic != null ? String(answer.topic) : '',
            correct: !!answer.correct,
            response: answer.response != null ? answer.response : null,
            at: now()
          });
        });
      },

      /** Marca la sesión como terminada. reason: 'completed' | 'stopped' | texto libre. */
      endSession: function (sessionId, reason) {
        update(function () {
          var s = findSession(sessionId);
          if (!s || s.endedAt) return;
          s.endedAt = now();
          s.reason = reason || 'completed';
        });
      },

      /** Sesiones con al menos una respuesta, de la más reciente a la más antigua. */
      getSessions: function () {
        return data.sessions.map(function (s) {
          var t = tally(data.answers.filter(function (a) { return a.session === s.id; }));
          return {
            id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, reason: s.reason || null,
            planned: s.planned, meta: s.meta,
            answered: t.answered, correct: t.correct, pct: t.pct, byTopic: t.byTopic
          };
        }).filter(function (s) { return s.answered > 0; })
          .sort(function (a, b) { return b.startedAt - a.startedAt; });
      },

      /** Respuestas filtradas por { session, topic, question, from, to }. */
      getAnswers: function (f) {
        f = f || {};
        return data.answers.filter(function (a) {
          return (f.session == null || a.session === f.session) &&
            (f.topic == null || a.topic === String(f.topic)) &&
            (f.question == null || a.question === String(f.question)) &&
            inRange(a, f.from, f.to);
        }).map(function (a) { return Object.assign({}, a); });
      },

      /**
       * Acierto por periodo ('day' | 'week' | 'month'), del más antiguo al más reciente.
       * Incluye los periodos vacíos entre medio (answered = 0, pct = null) para que
       * los huecos se vean en los gráficos. limit: cuántos periodos devolver como máximo.
       */
      periodStats: function (period, o) {
        o = o || {};
        if (!data.answers.length) return [];
        var limit = o.limit || 12;
        var end = periodStart(period, now());
        var first = periodStart(period, Math.min.apply(null, data.answers.map(function (a) { return a.at; })));
        var starts = [];
        for (var s = end; s >= first && starts.length < limit; s = prevPeriodStart(period, s)) starts.unshift(s);
        return starts.map(function (start) {
          var stop = nextPeriodStart(period, start);
          var t = tally(data.answers.filter(function (a) { return inRange(a, start, stop); }));
          t.start = start;
          t.end = stop;
          return t;
        });
      },

      /** Dominio estimado (ver masteryOf). topics: { idTema: totalPreguntas } para calcular cobertura. */
      mastery: function (o) {
        o = o || {};
        return masteryOf(data.answers, o.until, o.topics);
      },

      /**
       * Cuánto has mejorado en el periodo actual: compara el dominio estimado
       * de ahora con el que tenías al empezar el periodo, y el acierto de este
       * periodo con el del anterior.
       */
      progress: function (period, o) {
        o = o || {};
        var start = periodStart(period, now());
        var prevStart = prevPeriodStart(period, start);
        var nowM = masteryOf(data.answers, null, o.topics);
        var beforeM = masteryOf(data.answers, start, o.topics);
        var cur = tally(data.answers.filter(function (a) { return inRange(a, start, null); }));
        var prev = tally(data.answers.filter(function (a) { return inRange(a, prevStart, start); }));
        var topicIds = {};
        [nowM.byTopic, cur.byTopic, prev.byTopic].forEach(function (m) { Object.keys(m).forEach(function (k) { topicIds[k] = 1; }); });
        var byTopic = {};
        Object.keys(topicIds).forEach(function (k) {
          var n = nowM.byTopic[k] || {}, b = beforeM.byTopic[k] || {}, c = cur.byTopic[k] || {}, p = prev.byTopic[k] || {};
          byTopic[k] = {
            mastery: n.mastery != null ? n.mastery : null,
            masteryDelta: delta(n.mastery, b.mastery),
            seen: n.seen || 0, total: n.total != null ? n.total : null, coverage: n.coverage != null ? n.coverage : null,
            answered: c.answered || 0, pct: c.pct != null ? c.pct : null,
            prevPct: p.pct != null ? p.pct : null, pctDelta: delta(c.pct, p.pct)
          };
        });
        return {
          period: period, start: start, prevStart: prevStart,
          mastery: nowM.mastery, masteryDelta: delta(nowM.mastery, beforeM.mastery),
          seen: nowM.seen, total: nowM.total, coverage: nowM.coverage,
          answered: cur.answered, pct: cur.pct, prevAnswered: prev.answered, prevPct: prev.pct,
          pctDelta: delta(cur.pct, prev.pct),
          byTopic: byTopic
        };
      },

      /** Por pregunta: { attempts, correct, lastCorrect, lastAt, topic }. Útil para repasar falladas o no vistas. */
      questionStats: function () {
        var out = {};
        data.answers.forEach(function (a) {
          var q = out[a.question] || (out[a.question] = { attempts: 0, correct: 0, lastCorrect: null, lastAt: 0, topic: a.topic });
          q.attempts++;
          if (a.correct) q.correct++;
          if (a.at >= q.lastAt) { q.lastAt = a.at; q.lastCorrect = a.correct; }
        });
        return out;
      },

      /** Copia completa de los datos, lista para guardar como JSON. */
      exportData: function () {
        return JSON.parse(JSON.stringify(Object.assign({ exportedAt: now() }, data)));
      },

      /**
       * Importa una copia exportada. mode 'merge' (por defecto) suma lo que falte sin
       * duplicar; 'replace' sustituye todo. Devuelve cuántas respuestas se añadieron.
       */
      importData: function (input, mode) {
        var incoming = typeof input === 'string' ? JSON.parse(input) : input;
        if (!incoming || !Array.isArray(incoming.sessions) || !Array.isArray(incoming.answers)) {
          throw new Error('study-tracker: the file does not have the expected format');
        }
        if (incoming.appId && incoming.appId !== appId) {
          throw new Error('study-tracker: the file belongs to another app (' + incoming.appId + ')');
        }
        incoming = migrate(JSON.parse(JSON.stringify(incoming)), appId);
        return update(function () {
          var before = mode === 'replace' ? 0 : data.answers.length;
          if (mode === 'replace') {
            data = incoming;
          } else {
            var sids = {}, aids = {};
            data.sessions.forEach(function (s) { sids[s.id] = 1; });
            data.answers.forEach(function (a) { aids[a.session + '|' + a.question + '|' + a.at] = 1; });
            incoming.sessions.forEach(function (s) { if (!sids[s.id]) data.sessions.push(s); });
            incoming.answers.forEach(function (a) {
              var k = a.session + '|' + a.question + '|' + a.at;
              if (!aids[k]) { aids[k] = 1; data.answers.push(a); }
            });
          }
          return data.answers.length - before;
        });
      },

      /** Borra todos los datos de esta app. */
      clear: function () {
        data = emptyData(appId);
        try { store.removeItem(key); } catch (e) { /* nada que borrar */ }
        notify();
      },

      /** Avisa cada vez que cambian los datos. Devuelve una función para dejar de escuchar. */
      onChange: function (fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
      }
    };
    return api;
  }

  return {
    create: create,
    version: '0.1.0',
    schema: SCHEMA,
    periodStart: periodStart,
    nextPeriodStart: nextPeriodStart,
    memoryStorage: memoryStorage
  };
});
