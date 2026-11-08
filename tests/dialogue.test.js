import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineTask, lineFor, lineAlt, isLearnerLine, isLineOrderCorrect } from '../src/lesson/dialogue.js';
import { realContent } from './helpers/realContent.js';
import { createAjv } from '../scripts/lib/content.js';
import { checkContent } from '../scripts/lib/check.js';
import { makeBundle } from './helpers/contentFixture.js';

const content = realContent();
const dialogue = {
  setting: 'A test scene.',
  speakers: [{ id: 'you', en: 'You', learner: true }, { id: 'aisha', en: 'Aisha', gender: 'f' }],
  lines: [
    { speaker: 'aisha', roman: 'kyaa haal hai?', ur: 'کیا حال ہے؟', en: 'How are things?', check: { question: 'What is she asking?', options: ['How you are', 'Where you live'], answerIndex: 0 } },
    { speaker: 'you', roman: 'maiN thakaa huuN.', ur: 'میں تھکا ہوں۔', en: "I'm tired.", learner_f: { roman: 'maiN thakii huuN.', ur: 'میں تھکی ہوں۔' } },
    { speaker: 'you', roman: 'maiN thakaa huuN.', ur: 'میں تھکا ہوں۔', en: "I'm tired.", options: [{ roman: 'maiN Thiik huuN.', ur: 'میں ٹھیک ہوں۔', en: "I'm fine." }], learner_f: { roman: 'maiN thakii huuN.', ur: 'میں تھکی ہوں۔', options: [{ roman: 'maiN thakaa huuN.', ur: 'میں تھکا ہوں۔', en: 'The man’s form.' }] } },
  ],
};

test('other speakers: a comprehension question, with the right answer kept through the shuffle', () => {
  const t = lineTask(dialogue, 0, 'm');
  assert.equal(t.kind, 'hear');
  assert.equal(t.options[t.answerIndex].text, 'How you are');
  assert.deepEqual(lineTask(dialogue, 0, 'm'), t, 'the order is stable');
});

test('my lines: tiles from my own gender form', () => {
  const man = lineTask(dialogue, 1, 'm');
  assert.equal(man.kind, 'tiles');
  assert.deepEqual([...man.tiles].sort(), ['huuN', 'maiN', 'thakaa']);
  assert.notDeepEqual(man.tiles, man.order, 'never already solved');
  assert.ok(isLineOrderCorrect(man, ['maiN', 'thakaa', 'huuN']));
  assert.equal(isLineOrderCorrect(man, ['thakaa', 'maiN', 'huuN']), false);
  assert.deepEqual([...lineTask(dialogue, 1, 'f').tiles].sort(), ['huuN', 'maiN', 'thakii']);
});

test('my lines: authored options make it a pick, in my gender form with my wrong answers', () => {
  const m = lineTask(dialogue, 2, 'm');
  assert.equal(m.kind, 'pick');
  assert.equal(m.options[m.answerIndex].roman, 'maiN thakaa huuN.');
  assert.equal(m.options[m.answerIndex].en, "I'm tired.");
  const f = lineTask(dialogue, 2, 'f');
  assert.equal(f.options[f.answerIndex].roman, 'maiN thakii huuN.');
  assert.ok(f.options.some((o) => o.roman === 'maiN thakaa huuN.'), "the woman's wrong answer");
});

test('gender only changes the learner’s lines; the other version is offered until a gender is chosen', () => {
  assert.equal(lineFor(dialogue, dialogue.lines[1], 'f').roman, 'maiN thakii huuN.');
  assert.equal(lineFor(dialogue, dialogue.lines[0], 'f').roman, 'kyaa haal hai?');
  assert.equal(lineAlt(dialogue, dialogue.lines[1], null).roman, 'maiN thakii huuN.');
  assert.equal(lineAlt(dialogue, dialogue.lines[1], 'm'), null);
  assert.equal(isLearnerLine(dialogue, dialogue.lines[0]), false);
});

test('every line of the shipped lessons has a task, for each gender', () => {
  for (const l of content.lessons) {
    l.dialogue.lines.forEach((line, i) => {
      for (const g of ['m', 'f', null]) {
        const t = lineTask(l.dialogue, i, g);
        if (t.kind === 'tiles') assert.ok(t.tiles.length >= 2, `${l.id} ${i}`);
        else assert.ok(t.answerIndex >= 0 && t.options.length >= 2, `${l.id} ${i}`);
      }
    });
    assert.ok(l.dialogue.lines.every((line) => isLearnerLine(l.dialogue, line) || line.check), l.id);
  }
});

const ajv = createAjv();
const errorsOf = (b) => checkContent(b, { ajv, shippedIds: [] }).errors;
const lines = (b) => b.lessons[0].data.dialogue.lines;

test('validator: other speakers need a check; only they may have one', () => {
  let b = makeBundle(); delete lines(b)[0].check;
  assert.ok(errorsOf(b).some((e) => /needs a "check" question/.test(e)));
  b = makeBundle(); lines(b)[1].check = { question: 'x', options: ['a', 'b'], answerIndex: 0 };
  assert.ok(errorsOf(b).some((e) => /check is only for other speakers/.test(e)));
  b = makeBundle(); lines(b)[0].check.answerIndex = 5;
  assert.ok(errorsOf(b).some((e) => /out of range/.test(e)));
  b = makeBundle(); lines(b)[0].check.options = ['Greeting (you)', 'Leaving'];
  assert.ok(errorsOf(b).some((e) => /give the answer away/.test(e)));
});

test('validator: options belong to the learner and must be wrong answers', () => {
  const wrong = { roman: 'kyaa haal hai?', ur: 'کیا حال ہے؟', en: 'How are things?' };
  let b = makeBundle(); lines(b)[0].options = [wrong];
  assert.ok(errorsOf(b).some((e) => /only for the learner's own lines/.test(e)));
  b = makeBundle(); lines(b)[1].options = [{ ...wrong, roman: lines(b)[1].roman }];
  assert.ok(errorsOf(b).some((e) => /repeats the line itself/.test(e)));
  b = makeBundle(); lines(b)[1].options = [wrong, wrong];
  assert.ok(errorsOf(b).some((e) => /duplicates/.test(e)));
  b = makeBundle(); lines(b)[1].options = [{ ...wrong, roman: 'Bad' }];
  assert.ok(errorsOf(b).some((e) => /capital/.test(e)));
});
