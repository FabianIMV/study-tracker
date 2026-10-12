'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const StudyTracker = require('../study-tracker.js');

// Reloj controlable: los tests no dependen de la fecha real.
function clock(iso) {
  let t = new Date(iso).getTime();
  const fn = () => t;
  fn.set = (s) => { t = new Date(s).getTime(); };
  return fn;
}

function setup(iso = '2026-10-07T10:00:00') {
  const now = clock(iso);
  const storage = StudyTracker.memoryStorage();
  const tr = StudyTracker.create({ appId: 'test-app', storage, now });
  return { tr, now, storage };
}

test('exige un appId válido', () => {
  assert.throws(() => StudyTracker.create({}), /appId/);
  assert.throws(() => StudyTracker.create({ appId: 'con espacios' }), /appId/);
});

test('guarda cada respuesta al instante y la recupera en otra instancia', () => {
  const { tr, storage, now } = setup();
  const s = tr.startSession({ planned: 10 });
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: true, response: [0] });
  tr.recordAnswer(s, { question: 'q2', topic: 2, correct: false, response: [3] });
  // sin endSession: simula cerrar la pestaña a mitad de la prueba
  const again = StudyTracker.create({ appId: 'test-app', storage, now });
  const [session] = again.getSessions();
  assert.equal(session.answered, 2);
  assert.equal(session.correct, 1);
  assert.equal(session.pct, 50);
  assert.equal(session.endedAt, null);
  assert.deepEqual(again.getAnswers({ question: 'q2' })[0].response, [3]);
});

test('dos pestañas abiertas no se pisan las respuestas', () => {
  const storage = StudyTracker.memoryStorage();
  const tab1 = StudyTracker.create({ appId: 'test-app', storage });
  const tab2 = StudyTracker.create({ appId: 'test-app', storage });
  tab1.recordAnswer(tab1.startSession(), { question: 'q1', topic: 1, correct: true });
  tab2.recordAnswer(tab2.startSession(), { question: 'q2', topic: 1, correct: true });
  const fresh = StudyTracker.create({ appId: 'test-app', storage });
  assert.equal(fresh.getAnswers().length, 2);
});

test('separa los datos de cada app en el mismo navegador', () => {
  const storage = StudyTracker.memoryStorage();
  const a = StudyTracker.create({ appId: 'app-a', storage });
  const b = StudyTracker.create({ appId: 'app-b', storage });
  a.recordAnswer(a.startSession(), { question: 'q1', topic: 1, correct: true });
  assert.equal(b.getSessions().length, 0);
});

test('endSession guarda el motivo y las sesiones vacías no aparecen', () => {
  const { tr } = setup();
  tr.startSession();
  const s = tr.startSession();
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: true });
  tr.endSession(s, 'stopped');
  const list = tr.getSessions();
  assert.equal(list.length, 1);
  assert.equal(list[0].reason, 'stopped');
});

test('dominio estimado usa la última respuesta de cada pregunta', () => {
  const { tr, now } = setup();
  const s = tr.startSession();
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: false });
  now.set('2026-10-07T10:05:00');
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: true });
  tr.recordAnswer(s, { question: 'q2', topic: 1, correct: false });
  const m = tr.mastery({ topics: { 1: 4, 2: 6 } });
  assert.equal(m.seen, 2);
  assert.equal(m.mastery, 50);
  assert.equal(m.coverage, 20);
  assert.equal(m.byTopic['1'].coverage, 50);
  assert.equal(m.byTopic['2'].seen, 0);
});

test('progress compara la semana actual con la anterior', () => {
  const { tr, now } = setup('2026-09-30T09:00:00'); // miércoles de la semana anterior
  const s1 = tr.startSession();
  tr.recordAnswer(s1, { question: 'q1', topic: 1, correct: false });
  tr.recordAnswer(s1, { question: 'q2', topic: 1, correct: true });
  now.set('2026-10-07T09:00:00'); // semana actual
  const s2 = tr.startSession();
  tr.recordAnswer(s2, { question: 'q1', topic: 1, correct: true });
  tr.recordAnswer(s2, { question: 'q2', topic: 1, correct: true });
  const p = tr.progress('week');
  assert.equal(p.prevPct, 50);
  assert.equal(p.pct, 100);
  assert.equal(p.pctDelta, 50);
  assert.equal(p.mastery, 100);
  assert.equal(p.masteryDelta, 50);
  assert.equal(p.byTopic['1'].masteryDelta, 50);
});

test('periodStats agrupa por semana e incluye semanas vacías', () => {
  const { tr, now } = setup('2026-09-21T12:00:00');
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: true });
  now.set('2026-10-07T12:00:00');
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: false });
  const weeks = tr.periodStats('week');
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks.map((w) => w.answered), [1, 0, 1]);
  assert.equal(weeks[1].pct, null);
  assert.equal(new Date(weeks[0].start).getDay(), 1); // lunes
});

test('periodStats por mes', () => {
  const { tr, now } = setup('2026-08-15T12:00:00');
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: true });
  now.set('2026-10-02T12:00:00');
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: true });
  assert.deepEqual(tr.periodStats('month').map((m) => new Date(m.start).getMonth()), [7, 8, 9]);
});

test('questionStats indica qué preguntas fallaste la última vez', () => {
  const { tr, now } = setup();
  const s = tr.startSession();
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: true });
  now.set('2026-10-07T11:00:00');
  tr.recordAnswer(s, { question: 'q1', topic: 1, correct: false });
  const q = tr.questionStats().q1;
  assert.equal(q.attempts, 2);
  assert.equal(q.lastCorrect, false);
});

test('exportar e importar sin duplicar', () => {
  const { tr } = setup();
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: true });
  const dump = JSON.stringify(tr.exportData());
  const other = StudyTracker.create({ appId: 'test-app', storage: StudyTracker.memoryStorage() });
  assert.equal(other.importData(dump), 1);
  assert.equal(other.importData(dump), 0);
  assert.equal(other.getSessions().length, 1);
  assert.throws(() => StudyTracker.create({ appId: 'otra', storage: StudyTracker.memoryStorage() }).importData(dump), /otra app/);
  assert.throws(() => other.importData('{"foo":1}'), /formato/);
});

test('datos corruptos no rompen la app', () => {
  const storage = StudyTracker.memoryStorage();
  storage.setItem('study-tracker:test-app', '{no es json');
  const tr = StudyTracker.create({ appId: 'test-app', storage });
  assert.deepEqual(tr.getSessions(), []);
});

test('clear borra todo y avisa a los oyentes', () => {
  const { tr } = setup();
  let calls = 0;
  tr.onChange(() => calls++);
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 1, correct: true });
  tr.clear();
  assert.equal(tr.getSessions().length, 0);
  assert.ok(calls >= 3);
});

test('la versión publicada coincide con package.json', () => {
  assert.equal(StudyTracker.version, require('../package.json').version);
});
