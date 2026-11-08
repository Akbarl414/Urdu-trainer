import { test } from 'node:test';
import assert from 'node:assert/strict';
const X = await import('../src/lesson/exercises.js');
const W = await import('../src/lesson/wordChecks.js');
const { GRADE } = await import('../src/srs/fsrs.js');
const { realContent } = await import('./helpers/realContent.js');

const content = realContent();
const lesson = content.getLesson('lesson-001');
const ex = (id) => lesson.exercises.find((e) => e.id === id);

test('every exercise type in the schema has an answer kind', () => {
  const types = ['fill-blank', 'multiple-choice', 'choose-form', 'reorder', 'error-spot', 'translate', 'transform', 'listen'];
  for (const t of types) assert.ok(X.ANSWER_KIND[t], t);
  assert.equal(X.answerKind(ex('e08')), 'tiles');
  assert.equal(X.answerKind(ex('e03')), 'free');
  assert.equal(X.answerKind(ex('e04')), 'choice');
});

test('translate defaults to Speak, typed-form exercises default to Type, and the saved choice wins', () => {
  assert.equal(X.startMode(ex('e12'), null), 'speak');
  assert.equal(X.startMode(ex('e03'), null), 'type');
  assert.equal(X.startMode(ex('e11'), null), 'type');
  assert.equal(X.startMode(ex('e12'), 'type'), 'type');
  assert.equal(X.startMode(ex('e03'), 'speak'), 'speak');
});

test('choice options keep English apart so it can stay hidden until answered', () => {
  const o = X.choiceOptions(ex('e01'));
  assert.equal(o[0].roman, 'assalaam-o-alaikum!');
  assert.equal(o[0].en, 'Peace be upon you!');
  const listen = X.choiceOptions(ex('e02'));
  assert.deepEqual(listen[0], { text: 'How are things?' }, 'plain English options are the answers themselves');
  const forms = X.choiceOptions(ex('e04'));
  assert.equal(forms[1].roman, 'haiN');
  assert.equal(forms[1].en, undefined);
  assert.ok(X.isChoiceCorrect(ex('e04'), 1));
  assert.ok(!X.isChoiceCorrect(ex('e04'), 0));
});

test('typed answers: exact, lenient phone spellings, and wrong', () => {
  assert.ok(X.judgeTyped(ex('e03'), 'huuN').exact);
  const close = X.judgeTyped(ex('e03'), 'hoon');
  assert.ok(close.correct && close.close && !close.exact);
  assert.ok(!X.judgeTyped(ex('e03'), 'haiN').correct);
  assert.ok(X.judgeTyped(ex('e06'), 'maiN Thiik huuN.').exact);
  assert.ok(!X.judgeTyped(ex('e06'), 'maiN Thiik haiN.').correct, 'the faulty sentence is not an answer');
  assert.equal(X.typeStart(ex('e06')), 'maiN Thiik haiN.');
  assert.equal(X.typeStart(ex('e03')), '');
});

test('translate and transform accept every listed phrasing and are free-order', () => {
  assert.ok(X.isFreeOrder(ex('e12')) && X.isFreeOrder(ex('e11')) && !X.isFreeOrder(ex('e03')));
  assert.ok(X.judgeTyped(ex('e12'), 'alhamdulillaah, maiN Thiik huuN. aur aap?').correct);
  assert.ok(X.judgeTyped(ex('e12'), 'Thiik huuN, alhamdulillaah. aur aap?').correct);
  assert.ok(!X.judgeTyped(ex('e12'), 'aur aap Thiik huuN').correct);
  assert.ok(X.judgeTyped(ex('e11'), 'aap Thiik haiN').correct);
});

test('model answers carry roman and script', () => {
  assert.deepEqual(X.modelAnswers(ex('e03')), [{ roman: 'maiN Thiik huuN.', ur: 'میں ٹھیک ہوں۔' }]);
  assert.equal(X.modelAnswers(ex('e12')).length, 4);
  assert.deepEqual(X.modelAnswers(ex('e04')), []);
});

test('reorder accepts every valid order and nothing else', () => {
  const e = ex('e08');
  assert.ok(X.isReorderCorrect(e, ['aap', 'kaise', 'haiN']));
  assert.ok(X.isReorderCorrect(e, ['kaise', 'haiN', 'aap']));
  assert.ok(!X.isReorderCorrect(e, ['haiN', 'aap', 'kaise']));
  assert.ok(!X.isReorderCorrect(ex('e07'), ['maiN', 'Thiik', 'bhii', 'huuN']));
});

test('reorder tiles are a stable shuffle that is not already the answer', () => {
  for (const id of ['e07', 'e08']) {
    const e = ex(id);
    const a = X.reorderTiles(e);
    assert.deepEqual(a, X.reorderTiles(e), 'stable for the same exercise');
    assert.deepEqual([...a].sort(), [...e.tokens].sort());
    assert.ok(!X.isReorderCorrect(e, a));
  }
});

test('exercise rating: correct → Good, hint → Hard, wrong → Again', () => {
  assert.equal(X.gradeForResult({ correct: true, hinted: false }), GRADE.good);
  assert.equal(X.gradeForResult({ correct: true, hinted: true }), GRADE.hard);
  assert.equal(X.gradeForResult({ correct: false, hinted: false }), GRADE.again);
  assert.equal(X.gradeForResult({ correct: false, hinted: true }), GRADE.again);
});

test('word recognition options contain the meaning once, plus distractors from the same lesson', () => {
  const pool = content.newWordsOf('lesson-001');
  for (const w of pool) {
    const { options, answerIndex } = W.recognitionOptions(w, pool);
    assert.equal(options[answerIndex], w.meaning_en);
    assert.equal(new Set(options).size, options.length);
    assert.equal(options.length, 4);
  }
});

test('word production: phrases are prompted by situation, other words by meaning', () => {
  assert.match(W.productionPrompt(content.getWord('assalaam-o-alaikum')).text, /partner's family home/);
  assert.equal(W.productionPrompt(content.getWord('main')).text, 'I');
});
