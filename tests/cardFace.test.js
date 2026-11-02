import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCard, isReviewable } from '../src/srs/cardFace.js';
import { CARD_WORDS, CARD_LESSON, cardSource, cardIds } from './helpers/cardFixture.js';
import { defaultData } from '../src/db/storage.js';
import { buildContentIndex } from '../src/db/contentIndex.js';
import { checkRoman, checkUrdu, checkLoanwordRoman } from '../src/lang/romanization.js';
import { check } from '../src/lang/normalise.js';
import { makeBundle } from './helpers/contentFixture.js';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const src = cardSource;

test('every fixture card describes a reviewable face', () => {
  for (const id of cardIds()) {
    const f = describeCard(id, src);
    assert.ok(f, id);
    assert.ok(f.modes.includes(f.defaultMode), id);
    assert.ok(Array.isArray(f.reveal) && f.reveal.length > 0, id);
    assert.ok(f.modes.includes('choice') ? f.options.length >= 2 : true, id);
    if (f.modes.includes('type')) assert.ok(f.answers.length > 0, id);
  }
});

test('fixture content obeys the romanization scheme and Urdu code points', () => {
  const scan = (t, loan) => {
    assert.deepEqual(loan ? checkLoanwordRoman(t.roman) : checkRoman(t.roman, { allowBlank: true }), [], t.roman);
    assert.deepEqual(checkUrdu(t.ur, { allowBlank: true }), [], t.ur);
  };
  for (const w of CARD_WORDS) {
    scan(w, w.loanword);
    if (w.example) assert.deepEqual(checkRoman(w.example.roman.replace(/\bphone\b/, 'phone'), { exempt: new Set(['phone']) }), [], w.example.roman);
  }
  for (const e of CARD_LESSON.exercises) if (e.sentence) assert.deepEqual(checkRoman(e.sentence.roman, { allowBlank: true }), [], e.id);
});

test('facet prompts: recognition reveals, production is Speak/Type, forms and grammar are typed or chosen', () => {
  const f = (id) => describeCard(id, src);
  assert.deepEqual(f('w:seed-ghar:meaning_ur_en').modes, ['reveal']);
  assert.equal(f('w:seed-ghar:meaning_ur_en').prompt.roman, 'ghar');
  const prod = f('w:seed-ghar:meaning_en_ur');
  assert.deepEqual(prod.modes, ['speak', 'type']);
  assert.equal(prod.defaultMode, 'speak');
  assert.deepEqual(prod.answers, ['ghar']);
  assert.equal(prod.prompt.text, 'house, home');
  assert.equal(f('w:seed-shukriya:situation_to_phrase').defaultMode, 'speak');
  const g = f('w:seed-larka:gender');
  assert.equal(g.defaultMode, 'choice');
  assert.equal(g.correct, 'm');
  assert.equal(f('w:seed-kitab:gender').correct, 'f');
  assert.ok(f('w:seed-larka:gender').reveal.some((r) => r.roman === 'laRke'), 'plural shown on reveal');
  const p = f('w:seed-jaana:perfective');
  assert.deepEqual(p.answers, ['gayaa']);
  assert.equal(p.defaultMode, 'type');
  assert.deepEqual(p.reveal.slice(0, 3).map((r) => r.roman), ['gayaa', 'gayii', 'gaye']);
  assert.equal(f('w:seed-khaana:takes_ne').correct, true);
  assert.equal(f('w:seed-jaana:takes_ne').correct, false);
});

test('typing the answer to a production card runs through the lenient normaliser', () => {
  const face = describeCard('w:seed-larka:meaning_en_ur', src);
  assert.equal(check('laRkaa', face.answers).result, 'exact');
  assert.equal(check('larka', face.answers).result, 'close');
  assert.equal(check('laRkii', face.answers).result, 'wrong');
  const phone = describeCard('w:seed-phone:meaning_en_ur', src);
  assert.ok(phone.loanwords.has('phone'));
  assert.equal(check('Phone', phone.answers, { loanwords: phone.loanwords }).result, 'close');
});

test('exercise faces by type', () => {
  const f = (n) => describeCard(`x:seed-lesson:${n}`, src);
  assert.deepEqual(f('e01').answers, ['Thiik']);
  assert.equal(f('e01').defaultMode, 'type');
  const choose = f('e02');
  assert.equal(choose.correct, 1);
  assert.equal(choose.options[1].label, 'acchii');
  const tr = f('e03');
  assert.equal(tr.freeOrder, true);
  assert.deepEqual(tr.answers, ['bahut shukriyaa.']);
  const re = f('e04');
  assert.deepEqual(re.answers, ['maiN Thiik huuN', 'Thiik maiN huuN']);
  assert.deepEqual([...re.prompt.tiles].sort(), ['Thiik', 'huuN', 'maiN']);
  assert.deepEqual(describeCard('x:seed-lesson:e04', src).prompt.tiles, re.prompt.tiles, 'tile order is stable');
  assert.equal(check('Thiik maiN huuN', re.answers).result, 'exact', 'every listed word order is accepted');
  assert.deepEqual(f('e05').answers, ['wo laRkii gayii.']);
});

test('listen exercises, retired items and missing content are not reviewable', () => {
  const b = makeBundle();
  const content = buildContentIndex({ units: b.units.map((x) => x.data), vocabs: b.vocabs.map((x) => x.data), lessons: b.lessons.map((x) => x.data) });
  assert.equal(describeCard('x:lesson-001:e08', content), null, 'needs audio (Phase 3)');
  assert.ok(describeCard('x:lesson-001:e07', content), 'transform');
  assert.ok(describeCard('x:lesson-001:e06', content), 'translate');
  assert.ok(describeCard('w:larkaa:gender', content));
  assert.equal(describeCard('w:no-such-word:meaning_ur_en', content), null);
  assert.equal(describeCard('x:lesson-001:e99', content), null);
  assert.equal(describeCard('s:l:alif:sound', content), null);
  assert.equal(describeCard('garbage', content), null);
  content.getWord('larkaa').retired = true;
  assert.equal(isReviewable('w:larkaa:gender', content), false);
});

