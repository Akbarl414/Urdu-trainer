import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCard, isReviewable, isTilesCorrect } from '../src/srs/cardFace.js';
import { CARD_WORDS, CARD_LESSON, cardSource, cardIds } from './helpers/cardFixture.js';
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

const opts = (extra = {}) => ({ learned: CARD_WORDS, features: new Set(['gender']), canListen: () => true, ...extra });
const cardAt = (stability, f) => ({ s: stability, st: 2, r: 5, f });

test('main card: the format follows stability and uses the right prompts', () => {
  const f = (card, extra) => describeCard('w:seed-ghar:main', src, opts({ card, ...extra }));
  const choice = f(cardAt(1));
  assert.equal(choice.format, 'choice');
  assert.equal(choice.defaultMode, 'choice');
  assert.equal(choice.prompt.roman, 'ghar');
  assert.equal(choice.options[choice.correct].label, 'house, home');
  const tiles = f(cardAt(6));
  assert.equal(tiles.format, 'tiles');
  assert.ok(isTilesCorrect(tiles, ['gh', 'a', 'r']));
  assert.equal(tiles.tiles.partial, true, 'wrong tiles are mixed in');
  const typed = f(cardAt(20));
  assert.equal(typed.format, 'typed');
  assert.equal(typed.prompt.text, 'house, home');
  assert.deepEqual(typed.answers, ['ghar']);
  assert.deepEqual(typed.modes, ['type', 'speak']);
  const listen = f(cardAt(60));
  assert.equal(listen.format, 'listen');
  assert.equal(listen.prompt.roman, undefined, 'nothing is written until the reveal');
  assert.equal(listen.prompt.listen.roman, 'ghar');
  const noVoice = f(cardAt(60), { canListen: () => false });
  assert.equal(noVoice.format, 'sentence');
  assert.equal(noVoice.prompt.roman, 'maiN ___ jaataa huuN.');
  assert.ok(noVoice.prompt.ur.includes('___'));
});

test('main card: a phrase rotates between meaning and situation', () => {
  const f = (card) => describeCard('w:seed-shukriya:main', src, opts({ card }));
  assert.equal(f(cardAt(1)).format, 'meaning_choice');
  const asked = f(cardAt(1, 'meaning_choice'));
  assert.equal(asked.format, 'situation_choice');
  assert.equal(asked.prompt.text, 'Someone hands you a cup of tea.');
  assert.equal(asked.options[asked.correct].label, 'shukriyaa');
  assert.equal(f(cardAt(1, 'situation_choice')).format, 'meaning_choice');
  assert.equal(f(cardAt(20)).format, 'situation_typed');
  assert.equal(f(cardAt(20, 'situation_typed')).format, 'listen');
});

test('main card: nouns ask gender once the feature is unlocked; mf nouns and others never do', () => {
  const noun = (id, extra) => describeCard(`w:${id}:main`, src, opts({ card: cardAt(20), ...extra }));
  assert.equal(noun('seed-larka').gender.correct, 'm');
  assert.equal(noun('seed-kitab').gender.correct, 'f');
  assert.equal(noun('seed-larka').gender.plural.roman, 'laRke', 'plural comes with the reveal');
  assert.equal(noun('seed-larka', { features: new Set() }).gender, null, 'before lesson 11 there is no tap');
  assert.equal(noun('seed-ghar').format, 'typed');
  assert.equal(noun('seed-bahut').gender, null, 'not a noun');
  const mf = { ...CARD_WORDS[0], id: 'seed-dost', pos: 'noun', gender: 'mf', roman: 'dost' };
  const source = { ...src, getWord: (id) => (id === 'seed-dost' ? mf : src.getWord(id)) };
  assert.equal(describeCard('w:seed-dost:main', source, opts({ card: cardAt(20) })).gender, null, 'mf nouns skip the tap');
});

test('perfective card: only irregular verbs, typed', () => {
  const p = describeCard('w:seed-jaana:perfective', src);
  assert.deepEqual(p.answers, ['gayaa']);
  assert.equal(p.defaultMode, 'type');
  assert.deepEqual(p.reveal.slice(0, 3).map((r) => r.roman), ['gayaa', 'gayii', 'gaye']);
  assert.equal(describeCard('w:seed-khaana:perfective', src), null, 'khaayaa is regular');
  assert.equal(isReviewable('w:seed-khaana:perfective', src), false);
});

test('cards of the earlier design are not shown any more', () => {
  for (const facet of ['meaning_ur_en', 'meaning_en_ur', 'situation_to_phrase', 'gender', 'takes_ne']) {
    assert.equal(describeCard(`w:seed-ghar:${facet}`, src), null, facet);
    assert.equal(isReviewable(`w:seed-ghar:${facet}`, src), false, facet);
  }
});

test('typing the answer to a main card runs through the lenient normaliser', () => {
  const face = describeCard('w:seed-larka:main', src, opts({ card: cardAt(20), features: new Set() }));
  assert.equal(check('laRkaa', face.answers).result, 'exact');
  assert.equal(check('larka', face.answers).result, 'close');
  assert.equal(check('laRkii', face.answers).result, 'wrong');
  const phone = describeCard('w:seed-phone:main', src, opts({ card: cardAt(20), features: new Set() }));
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
  assert.deepEqual([...re.tiles.tokens].sort(), ['Thiik', 'huuN', 'maiN']);
  assert.deepEqual(describeCard('x:seed-lesson:e04', src).tiles.tokens, re.tiles.tokens, 'tile order is stable');
  assert.ok(isTilesCorrect(re, ['Thiik', 'maiN', 'huuN']), 'every listed word order is accepted');
  assert.equal(isTilesCorrect(re, ['huuN', 'maiN', 'Thiik']), false);
  assert.deepEqual(f('e05').answers, ['wo laRkii gayii.']);
});

test('only flagged exercises are reviewable; listen exercises, retired items and missing content are not', () => {
  const b = makeBundle();
  const content = buildContentIndex({ units: b.units.map((x) => x.data), vocabs: b.vocabs.map((x) => x.data), lessons: b.lessons.map((x) => x.data) });
  assert.equal(describeCard('x:lesson-001:e08', content), null, 'listen');
  assert.equal(isReviewable('x:lesson-001:e08', content), false);
  assert.equal(describeCard('x:lesson-001:e07', content), null, 'not flagged');
  assert.ok(describeCard('x:lesson-001:e01', content), 'flagged');
  assert.ok(describeCard('w:larkaa:main', content));
  assert.equal(describeCard('w:no-such-word:main', content), null);
  assert.equal(describeCard('x:lesson-001:e99', content), null);
  assert.equal(describeCard('s:l:alif:sound', content), null);
  assert.equal(describeCard('garbage', content), null);
  content.getWord('larkaa').retired = true;
  assert.equal(isReviewable('w:larkaa:main', content), false);
});
