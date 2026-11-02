import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentIndex } from '../src/db/contentIndex.js';
import { makeBundle } from './helpers/contentFixture.js';

const raw = () => {
  const b = makeBundle();
  return { units: b.units.map((x) => x.data), vocabs: b.vocabs.map((x) => x.data), lessons: b.lessons.map((x) => x.data) };
};

test('indexes units, lessons and words', () => {
  const c = buildContentIndex(raw());
  assert.equal(c.units.length, 1);
  assert.equal(c.getLesson('lesson-001').title, 'Salaam and how are you?');
  assert.equal(c.getWord('larkaa').unit, 'unit-01');
  assert.equal(c.newWordsOf('lesson-001').length, 7);
  assert.equal(c.getExercise('lesson-001', 'e03').type, 'choose-form');
  assert.equal(c.lessonsOfUnit('unit-01').length, 1);
  assert.equal(c.nextLesson('lesson-001'), undefined);
});

test('lessons and units are returned in curriculum order regardless of load order', () => {
  const r = raw();
  const l2 = { ...JSON.parse(JSON.stringify(r.lessons[0])), id: 'lesson-002', order: 2 };
  const c = buildContentIndex({ ...r, lessons: [l2, r.lessons[0]] });
  assert.deepEqual(c.lessons.map((l) => l.id), ['lesson-001', 'lesson-002']);
  assert.equal(c.nextLesson('lesson-001').id, 'lesson-002');
});

test('user-added words are merged but never override repo ids', () => {
  const c = buildContentIndex(raw(), [{ id: 'larkaa', roman: 'HIJACK' }, { id: 'my-word', roman: 'x' }]);
  assert.notEqual(c.getWord('larkaa').roman, 'HIJACK');
  assert.equal(c.getWord('my-word').userAdded, true);
});

test('empty content is fine', () => {
  const c = buildContentIndex({});
  assert.deepEqual(c.words, []);
  assert.equal(c.getLesson('lesson-001'), undefined);
});
