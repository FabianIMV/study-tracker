import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import StudyTracker, { create, memoryStorage, version } from '@fabianimv/study-tracker';

const require = createRequire(import.meta.url);

test('import y require devuelven la misma librería', () => {
  assert.equal(StudyTracker, require('@fabianimv/study-tracker'));
  assert.equal(create, StudyTracker.create);
  assert.equal(version, StudyTracker.version);
  const tr = create({ appId: 'esm-app', storage: memoryStorage() });
  tr.recordAnswer(tr.startSession(), { question: 'q1', topic: 'a', correct: true });
  assert.equal(tr.getSessions().length, 1);
});

test('la vista se puede cargar con require', () => {
  const view = require('@fabianimv/study-tracker/view');
  assert.equal(typeof view.render, 'function');
  assert.equal(typeof view.texts.title, 'string');
});
