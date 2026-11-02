import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAjv } from '../scripts/lib/content.js';
import { checkContent, collectIds } from '../scripts/lib/check.js';
import { makeBundle } from './helpers/contentFixture.js';

const ajv = createAjv();
const run = (bundle, shippedIds = []) => checkContent(bundle, { ajv, shippedIds });
const word = (b, id) => b.vocabs[0].data.words.find((w) => w.id === id);
const lesson = (b) => b.lessons[0].data;
const ex = (b, id) => lesson(b).exercises.find((e) => e.id === id);
const failsWith = (b, pattern, shipped) => {
  const { errors } = run(b, shipped);
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got:\n${errors.join('\n') || '(none)'}`);
};

test('the fixture unit is valid (so the failure tests below mean something)', () => {
  const { errors } = run(makeBundle());
  assert.deepEqual(errors, []);
});

test('empty content is valid', () => {
  assert.deepEqual(run({ units: [], vocabs: [], lessons: [] }).errors, []);
});

// ---- romanization -----------------------------------------------------------
test('rejects bad romanization in words, sentences, exercises and dialogue', () => {
  let b = makeBundle(); word(b, 'kitaab').example.roman = 'Kitaab yahaaN hai.'; failsWith(b, /capital "K"/);
  b = makeBundle(); lesson(b).dialogue[0].roman = 'theek hai'; failsWith(b, /"ee"/);
  b = makeBundle(); ex(b, 'e01').answer = 'Thiik hoon'; failsWith(b, /"oo"/);
  b = makeBundle(); ex(b, 'e06').answers[0].roman = 'bahut shukriya 5'; failsWith(b, /not allowed/);
  b = makeBundle(); word(b, 'kitaab').roman = 'kitNaab'; failsWith(b, /plain "n"/);
});

test('rejects word-internal N and prose examples in backticks', () => {
  let b = makeBundle(); word(b, 'kitaab').example.roman = 'aaNkh hai.'; failsWith(b, /plain "n"/);
  b = makeBundle(); lesson(b).grammar[0].body = 'Say `Main Thiik huuN` to mean I am fine.'; failsWith(b, /capital "M"/);
  b = makeBundle(); ex(b, 'e01').explanation = 'Use `Thiik hoon` here.'; failsWith(b, /"oo"/);
});

// ---- Urdu script -------------------------------------------------------------
test('rejects missing ur and Arabic look-alike characters', () => {
  let b = makeBundle(); delete word(b, 'kitaab').ur; failsWith(b, /ur/);
  b = makeBundle(); word(b, 'kitaab').example.ur = ''; failsWith(b, /ur/);
  b = makeBundle(); word(b, 'acchaa').ur = 'اچھا'.replace('ا', 'ا') + 'ي'; failsWith(b, /look-alike U\+064A/);
  b = makeBundle(); word(b, 'larkaa').plural.ur = 'لڑكے'; failsWith(b, /look-alike U\+0643/);
  b = makeBundle(); lesson(b).dialogue[0].ur = 'هيلو'; failsWith(b, /look-alike/);
  b = makeBundle(); lesson(b).dialogue[0].ur = 'hello'; failsWith(b, /Latin letters|no Urdu-script/);
});

// ---- loanwords ---------------------------------------------------------------
// "tv" contains a "v", which the scheme forbids, so it only passes through the loanword exemption.
const asTv = (b) => Object.assign(word(b, 'phone'), { roman: 'tv', forms: ['tv', 'tvN'], ur: 'ٹی وی', example: { roman: 'mera tv yahaaN hai.', ur: 'میرا ٹی وی یہاں ہے۔', en: 'My TV is here.' } });

test('loanword exemption: listed loanwords pass in sentences from the lesson they are introduced in', () => {
  const b = makeBundle();
  asTv(b);
  lesson(b).dialogue[1].roman = 'mera tv kahaaN hai?';
  assert.deepEqual(run(b).errors, []);
});

test('loanword exemption: an unlisted English word is still rejected', () => {
  const b = makeBundle();
  lesson(b).dialogue[1].roman = 'mera computer kahaaN hai?';
  failsWith(b, /"c" is only used/);
});

test('loanword exemption: not valid before the lesson that introduces it', () => {
  const b = makeBundle();
  asTv(b);
  // move the tv loanword to a later lesson; lesson-001 may no longer use it
  const phone = word(b, 'phone');
  phone.introduced_in = 'lesson-002';
  lesson(b).new_vocab = lesson(b).new_vocab.filter((id) => id !== 'phone');
  const l2 = JSON.parse(JSON.stringify(b.lessons[0]));
  l2.file = 'lesson-002.json';
  l2.data = { ...l2.data, id: 'lesson-002', order: 2, new_vocab: ['phone'], review: true };
  b.lessons.push(l2);
  lesson(b).dialogue[1].roman = 'mera tv kahaaN hai?';
  failsWith(b, /dialogue.*"v"/);
});

test('loanword roman itself must be lowercase English (no capitals)', () => {
  const b = makeBundle();
  word(b, 'phone').roman = 'Phone';
  failsWith(b, /loanword "Phone"/);
});

// ---- word fields -------------------------------------------------------------
test('verbs need perfective and an explicit takes_ne', () => {
  let b = makeBundle(); delete word(b, 'jaanaa').perfective; failsWith(b, /perfective/);
  b = makeBundle(); delete word(b, 'jaanaa').takes_ne; failsWith(b, /takes_ne/);
  b = makeBundle(); delete word(b, 'jaanaa').perfective.f_sg; failsWith(b, /f_sg/);
});

test('nouns need gender and marked; marked nouns need plural and oblique_pl; adjectives need variable', () => {
  let b = makeBundle(); delete word(b, 'kitaab').gender; failsWith(b, /gender/);
  b = makeBundle(); delete word(b, 'kitaab').marked; failsWith(b, /marked/);
  b = makeBundle(); delete word(b, 'larkaa').oblique_pl; failsWith(b, /oblique_pl/);
  b = makeBundle(); delete word(b, 'acchaa').variable; failsWith(b, /variable/);
});

// ---- ids & references --------------------------------------------------------
test('rejects duplicate ids', () => {
  let b = makeBundle(); b.vocabs[0].data.words.push({ ...word(b, 'kitaab') }); failsWith(b, /duplicate word id "kitaab"/);
  b = makeBundle(); ex(b, 'e02').id = 'e01'; failsWith(b, /duplicate exercise id "e01"/);
  b = makeBundle(); const dup = JSON.parse(JSON.stringify(b.lessons[0])); dup.file = 'lesson-002.json'; b.lessons.push(dup); failsWith(b, /duplicate id "lesson-001"/);
});

test('a word id may not collide with another namespace', () => {
  const b = makeBundle();
  b.vocabs[0].data.words.push({ ...word(b, 'kitaab'), id: 'unit-01' });
  failsWith(b, /duplicate id "unit-01"/);
});

test('rejects references to unknown vocab ids and inconsistent introduced_in', () => {
  let b = makeBundle(); lesson(b).new_vocab[0] = 'nope'; failsWith(b, /unknown word id "nope"/);
  b = makeBundle(); word(b, 'kitaab').introduced_in = 'lesson-009'; failsWith(b, /not a known lesson|expected "lesson-001"/);
  b = makeBundle(); lesson(b).new_vocab = lesson(b).new_vocab.slice(1); failsWith(b, /(not listed in any lesson|does not list it)/);
});

test('ids must match filenames and folders', () => {
  let b = makeBundle(); b.lessons[0].file = 'lesson-002.json'; failsWith(b, /does not match the filename/);
  b = makeBundle(); b.lessons[0].data.order = 5; failsWith(b, /order 5 does not match/);
  b = makeBundle(); b.units[0].data.id = 'unit-02'; failsWith(b, /does not match its folder/);
});

test('counts: 6–10 new words (0–4 for review lessons), 8–12 exercises, unit ≤ 80 items', () => {
  let b = makeBundle(); lesson(b).new_vocab = lesson(b).new_vocab.slice(0, 5); failsWith(b, /6–10 new items/);
  b = makeBundle(); lesson(b).exercises = lesson(b).exercises.slice(0, 7); failsWith(b, /exercises/);
  b = makeBundle(); lesson(b).review = true; failsWith(b, /at most 4 new items/);
  b = makeBundle(); for (let i = 0; i < 80; i++) b.vocabs[0].data.words.push({ ...word(b, 'kitaab'), id: `extra-${i}` }); failsWith(b, /at most 80/);
});

// ---- exercises ---------------------------------------------------------------
test('exercise rules: blanks, permutations, answerIndex, annotated options', () => {
  let b = makeBundle(); ex(b, 'e01').sentence.roman = 'maiN Thiik huuN.'; failsWith(b, /needs a ___ blank/);
  b = makeBundle(); ex(b, 'e01').sentence.ur = 'میں ٹھیک ہوں۔'; failsWith(b, /needs a ___ blank/);
  b = makeBundle(); delete ex(b, 'e01').sentence.en; failsWith(b, /en/);
  b = makeBundle(); ex(b, 'e04').answerOrders.push(['maiN', 'Thiik', 'hai']); failsWith(b, /not a permutation/);
  b = makeBundle(); ex(b, 'e03').answerIndex = 7; failsWith(b, /out of range/);
  b = makeBundle(); ex(b, 'e02').options[0] = 'Thank you (formal)'; failsWith(b, /annotated options/);
});

test('rejects unknown exercise types and unexpected properties', () => {
  let b = makeBundle(); ex(b, 'e01').type = 'dance'; failsWith(b, /type/);
  b = makeBundle(); ex(b, 'e01').surprise = true; failsWith(b, /surprise/);
});

// ---- lockfile ----------------------------------------------------------------
test('shipped-id lockfile: removing or renaming a shipped id fails; retiring does not', () => {
  const full = [...collectIds(makeBundle())];
  assert.deepEqual(run(makeBundle(), full).errors, []);

  let b = makeBundle(); word(b, 'kitaab').id = 'kitab'; lesson(b).new_vocab = lesson(b).new_vocab.map((i) => (i === 'kitaab' ? 'kitab' : i));
  failsWith(b, /shipped id "word:kitaab" no longer exists/, full);

  b = makeBundle(); lesson(b).exercises = lesson(b).exercises.filter((e) => e.id !== 'e08'); // also breaks the 8–12 rule, but the lock error must show
  failsWith(b, /shipped id "exercise:lesson-001\/e08"/, full);

  b = makeBundle(); word(b, 'kitaab').retired = true; ex(b, 'e08').retired = true;
  assert.deepEqual(run(b, full).errors, []);
});

test('unlocked ids are reported but are not errors', () => {
  const { errors, unlockedIds } = run(makeBundle(), []);
  assert.deepEqual(errors, []);
  assert.ok(unlockedIds.includes('word:larkaa'));
  assert.ok(unlockedIds.includes('lesson:lesson-001'));
});
