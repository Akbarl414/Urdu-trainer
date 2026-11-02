import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forLearner, learnerAlt, hasLearnerVariant } from '../src/lesson/learner.js';
import { describeCard } from '../src/srs/cardFace.js';

const t = (roman, ur, en) => ({ roman, ur, en });
// "I'm fine" doesn't change; "I'm good" does (acchaa / acchii).
const ex = {
  id: 'e01', type: 'fill-blank', explanation: 'x', sentence: t('maiN ___ huuN.', 'میں ___ ہوں۔', "I'm good."), answer: 'acchaa', answer_ur: 'اچھا',
  learner_f: { answer: 'acchii', answer_ur: 'اچھی' },
};
const line = { speaker: 'you', ...t('maiN acchaa huuN.', 'میں اچھا ہوں۔', "I'm good."), learner_f: { roman: 'maiN acchii huuN.', ur: 'میں اچھی ہوں۔' } };

test('forLearner: base for a man, the override for a woman, never the learner_f field itself', () => {
  assert.equal(forLearner(ex, 'm').answer, 'acchaa');
  assert.equal(forLearner(ex, 'f').answer, 'acchii');
  assert.equal(forLearner(ex, 'f').answer_ur, 'اچھی');
  assert.equal(forLearner(ex, 'f').sentence, ex.sentence, 'fields not listed are kept');
  for (const g of ['m', 'f', null]) assert.equal('learner_f' in forLearner(ex, g), false);
  assert.equal(forLearner(line, 'f').roman, 'maiN acchii huuN.');
  assert.equal(forLearner(line, 'f').en, "I'm good.", 'en kept when the override has none');
  assert.equal(ex.answer, 'acchaa', 'input not mutated');
});

test('no gender chosen yet: the base form, with the other version offered as alt', () => {
  assert.equal(forLearner(line, null).roman, 'maiN acchaa huuN.');
  assert.equal(learnerAlt(line, null).roman, 'maiN acchii huuN.');
  assert.equal(learnerAlt(line, 'm'), null);
  assert.equal(learnerAlt(line, 'f'), null);
  assert.equal(learnerAlt({ roman: 'maiN Thiik huuN.' }, null), null, 'no alt when nothing differs');
});

test('items without a variant pass through untouched', () => {
  const plain = { roman: 'maiN Thiik huuN.', ur: 'میں ٹھیک ہوں۔', en: "I'm fine." };
  assert.equal(forLearner(plain, 'f'), plain);
  assert.equal(hasLearnerVariant(plain), false);
  assert.equal(hasLearnerVariant(ex), true);
  assert.equal(forLearner(undefined, 'f'), undefined);
});

test('review cards show the learner their own form; the card id is the same', () => {
  const source = { getWord: () => undefined, getExercise: (l, e) => (l === 'lesson-007' && e === 'e01' ? ex : undefined) };
  assert.deepEqual(describeCard('x:lesson-007:e01', source, { learnerGender: 'f' }).answers, ['acchii']);
  assert.deepEqual(describeCard('x:lesson-007:e01', source, { learnerGender: 'm' }).answers, ['acchaa']);
  assert.deepEqual(describeCard('x:lesson-007:e01', source).answers, ['acchaa'], 'default: base form');
  assert.match(describeCard('x:lesson-007:e01', source, { learnerGender: 'f' }).reveal[0].roman, /acchii/);
});
