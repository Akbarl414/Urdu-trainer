import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCard, isReviewable } from '../src/srs/cardFace.js';
import { SEED_WORDS, SEED_LESSON, seedSource, withSeed, seedCardIds, addSeedCards, makeSeedDue, removeSeedCards, isSeedCardId } from '../src/srs/seed.js';
import { defaultData } from '../src/db/storage.js';
import { buildContentIndex } from '../src/db/contentIndex.js';
import { checkRoman, checkUrdu, checkLoanwordRoman } from '../src/lang/romanization.js';
import { check } from '../src/lang/normalise.js';
import { CARD_STATE } from '../src/srs/fsrs.js';
import { makeBundle } from './helpers/contentFixture.js';

const NOW = Date.parse('2026-11-02T10:00:00Z');
const src = seedSource;

test('every seed card describes a reviewable face', () => {
  for (const id of seedCardIds()) {
    const f = describeCard(id, src);
    assert.ok(f, id);
    assert.ok(f.modes.includes(f.defaultMode), id);
    assert.ok(Array.isArray(f.reveal) && f.reveal.length > 0, id);
    assert.ok(f.modes.includes('choice') ? f.options.length >= 2 : true, id);
    if (f.modes.includes('type')) assert.ok(f.answers.length > 0, id);
  }
});

test('seed content obeys the romanization scheme and Urdu code points', () => {
  const scan = (t, loan) => {
    assert.deepEqual(loan ? checkLoanwordRoman(t.roman) : checkRoman(t.roman, { allowBlank: true }), [], t.roman);
    assert.deepEqual(checkUrdu(t.ur, { allowBlank: true }), [], t.ur);
  };
  for (const w of SEED_WORDS) {
    scan(w, w.loanword);
    if (w.example) assert.deepEqual(checkRoman(w.example.roman.replace(/\bphone\b/, 'phone'), { exempt: new Set(['phone']) }), [], w.example.roman);
  }
  for (const e of SEED_LESSON.exercises) if (e.sentence) assert.deepEqual(checkRoman(e.sentence.roman, { allowBlank: true }), [], e.id);
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

test('withSeed prefers real content and falls back to the seed', () => {
  const b = makeBundle();
  const content = buildContentIndex({ units: b.units.map((x) => x.data), vocabs: b.vocabs.map((x) => x.data), lessons: b.lessons.map((x) => x.data) });
  const s = withSeed(content);
  assert.equal(s.getWord('larkaa').roman, 'laRkaa');
  assert.equal(s.getWord('seed-ghar').roman, 'ghar');
  assert.equal(s.getExercise('seed-lesson', 'e01').type, 'fill-blank');
  assert.equal(s.getExercise('lesson-001', 'e01').type, 'fill-blank');
  assert.equal(s.getWord('nope'), undefined);
});

test('seed cards: added without overwriting, varied schedules, removable, and real cards are never touched', () => {
  const d = defaultData(NOW);
  const real = { due: NOW + 5 * 86400000, s: 9, d: 4, st: 2, r: 5, l: 0, lr: NOW - 86400000, sd: 6, ls: 0 };
  d.srs.decks.main.cards['w:ghar-real:meaning_ur_en'] = real;
  const existing = { ...real, r: 99 };
  d.srs.decks.main.cards['w:seed-ghar:meaning_ur_en'] = existing;

  const n = addSeedCards(d, NOW);
  assert.equal(n, seedCardIds().length - 1);
  assert.equal(d.srs.decks.main.cards['w:seed-ghar:meaning_ur_en'], existing, 'an existing card is not overwritten');
  assert.equal(addSeedCards(d, NOW), 0, 'idempotent');

  const states = new Set(Object.entries(d.srs.decks.main.cards).filter(([id]) => isSeedCardId(id)).map(([, c]) => c.st));
  assert.ok(states.has(CARD_STATE.new) && states.has(CARD_STATE.review), 'a mix of New and Review');
  const dues = Object.entries(d.srs.decks.main.cards).filter(([id]) => isSeedCardId(id)).map(([, c]) => c.due);
  assert.ok(dues.some((x) => x <= NOW) && dues.some((x) => x > NOW), 'some due now, some not');

  assert.ok(makeSeedDue(d, NOW) > 0);
  assert.ok(Object.entries(d.srs.decks.main.cards).filter(([id]) => isSeedCardId(id)).every(([, c]) => c.due <= NOW));
  assert.equal(d.srs.decks.main.cards['w:ghar-real:meaning_ur_en'], real, 'real card untouched by makeSeedDue');

  const removed = removeSeedCards(d);
  assert.equal(removed, seedCardIds().length);
  assert.deepEqual(Object.keys(d.srs.decks.main.cards), ['w:ghar-real:meaning_ur_en']);
  assert.equal(d.srs.decks.main.cards['w:ghar-real:meaning_ur_en'], real);
});

test('a lookalike real id such as w:seedling-… is not mistaken for a seed card', () => {
  assert.equal(isSeedCardId('w:seedling:meaning_ur_en'), false);
  assert.equal(isSeedCardId('w:seed-ghar:meaning_ur_en'), true);
  assert.equal(isSeedCardId('x:seed-lesson:e01'), true);
  assert.equal(isSeedCardId('x:lesson-001:e01'), false);
});
