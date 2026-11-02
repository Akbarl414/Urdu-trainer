import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.TZ = 'Europe/London';
const { practisableLessons, practiceProblem, startPractice } = await import('../src/lesson/practice.js');
const M = await import('../src/lesson/machine.js');
const { defaultData } = await import('../src/db/storage.js');
const { realContent } = await import('./helpers/realContent.js');

const NOW = Date.parse('2026-11-02T10:00:00Z');
const content = realContent();
const lesson = content.getLesson('lesson-001');
const done = () => {
  const d = defaultData(NOW);
  d.progress.lessons['lesson-001'] = { firstCompletedAt: NOW, lastCompletedAt: NOW, timesCompleted: 1, knownWordIds: [] };
  return d;
};

test('practice: only completed lessons can be replayed', () => {
  const fresh = defaultData(NOW);
  assert.deepEqual(practisableLessons(fresh, content), []);
  assert.match(practiceProblem(fresh, content, 'lesson-001'), /finished/);
  assert.match(practiceProblem(fresh, content, 'lesson-999'), /not in this version/);
  const d = done();
  assert.deepEqual(practisableLessons(d, content).map((l) => l.id), ['lesson-001']);
  assert.equal(practiceProblem(d, content, 'lesson-001'), null);
});

test('practice: no warm-up, every exercise, and listen ones only with a voice', () => {
  const r = startPractice({ lesson, canListen: true, studyDay: '2026-11-02', now: NOW });
  assert.equal(r.practice, true);
  assert.deepEqual(r.plan.warmup, []);
  assert.deepEqual(r.plan.exerciseIds, lesson.exercises.map((e) => e.id));
  assert.equal(r.step, 'grammar', 'the empty warm-up is skipped');
  const quiet = startPractice({ lesson, canListen: false, studyDay: '2026-11-02', now: NOW });
  assert.ok(!quiet.plan.exerciseIds.some((id) => lesson.exercises.find((e) => e.id === id).type === 'listen'));
});

test('practice: a whole replay leaves the stored data untouched', () => {
  const d = done();
  d.progress.run = { v: 1, lessonId: 'lesson-002', marker: 'a real run in progress' };
  const before = JSON.stringify(d);
  let r = startPractice({ lesson, canListen: true, studyDay: '2026-11-02', now: NOW });
  for (let i = 0; i < 200 && r.step !== 'summary'; i++) {
    if (r.step === 'words' && r.sub === 'intro') r = M.markKnown(r, lesson.new_vocab[r.index]);
    if (r.step === 'practice') r = M.recordExercise(r, r.plan.exerciseIds[r.index], { correct: true, hinted: false });
    r = M.advance(r, lesson);
  }
  assert.equal(r.step, 'summary');
  assert.equal(JSON.stringify(d), before, 'the replay run lives in memory only');
});
