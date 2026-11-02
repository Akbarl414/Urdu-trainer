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
  b = makeBundle(); lesson(b).dialogue.lines[0].roman = 'theek hai'; failsWith(b, /"ee"/);
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
  b = makeBundle(); lesson(b).dialogue.lines[0].ur = 'هيلو'; failsWith(b, /look-alike/);
  b = makeBundle(); lesson(b).dialogue.lines[0].ur = 'hello'; failsWith(b, /Latin letters|no Urdu-script/);
});

// ---- loanwords ---------------------------------------------------------------
// "tv" contains a "v", which the scheme forbids, so it only passes through the loanword exemption.
const asTv = (b) => Object.assign(word(b, 'phone'), { roman: 'tv', forms: ['tv', 'tvN'], ur: 'ٹی وی', example: { roman: 'mera tv yahaaN hai.', ur: 'میرا ٹی وی یہاں ہے۔', en: 'My TV is here.' } });

test('loanword exemption: listed loanwords pass in sentences from the lesson they are introduced in', () => {
  const b = makeBundle();
  asTv(b);
  lesson(b).dialogue.lines[1].roman = 'meraa tv kahaaN hai?';
  assert.deepEqual(run(b).errors, []);
});

test('loanword exemption: an unlisted English word is still rejected', () => {
  const b = makeBundle();
  lesson(b).dialogue.lines[1].roman = 'meraa computer kahaaN hai?';
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
  lesson(b).dialogue.lines[1].roman = 'meraa tv kahaaN hai?';
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

// ---- Phase 3a schema additions (PLAN D22) -----------------------------------------
test('the seed- word id prefix is reserved (D21)', () => {
  const b = makeBundle();
  b.vocabs[0].data.words.push({ ...word(b, 'kitaab'), id: 'seed-kitaab' });
  lesson(b).new_vocab.push('seed-kitaab');
  failsWith(b, /"seed-" prefix is reserved/);
});

test('nouns: every countable noun needs plural and oblique_pl; mass nouns are exempt', () => {
  let b = makeBundle(); delete word(b, 'kitaab').plural; failsWith(b, /plural/);
  b = makeBundle(); delete word(b, 'kitaab').oblique_pl; failsWith(b, /oblique_pl/);
  b = makeBundle(); delete word(b, 'kitaab').plural; delete word(b, 'kitaab').oblique_pl; word(b, 'kitaab').mass = true;
  assert.deepEqual(run(b).errors, []);
  b = makeBundle(); word(b, 'kitaab').mass = true; word(b, 'kitaab').plural_only = true; failsWith(b, /both mass and plural_only/);
});

test('nouns: marked means masculine -aa with regular -e / -oN forms', () => {
  let b = makeBundle(); word(b, 'larkaa').gender = 'f'; failsWith(b, /must be masculine/);
  b = makeBundle(); word(b, 'larkaa').plural = { roman: 'laRkii', ur: 'لڑکی' }; failsWith(b, /plural should be "laRke"/);
  b = makeBundle(); word(b, 'larkaa').oblique_pl = { roman: 'laRkoN', ur: 'لڑکون' }; failsWith(b, /oblique_pl should be "laRkoN"/);
  b = makeBundle(); word(b, 'kitaab').oblique_pl = { roman: 'kitaabeN', ur: 'کتابیں' }; failsWith(b, /should end in "oN"/);
  // after a long -uu the oblique plural is spelt ؤں (ابو → ابوؤں); a plain ؤں elsewhere is still wrong
  b = makeBundle(); word(b, 'kitaab').oblique_pl = { roman: 'kitaabuuoN', ur: 'کتابوؤں' }; assert.deepEqual(run(b).errors, []);
  b = makeBundle(); word(b, 'kitaab').oblique_pl = { roman: 'kitaaboN', ur: 'کتابؤں' }; failsWith(b, /should end in "oN"/);
});

test('nouns: irregular feminine plurals are warnings, not errors; mf gender is allowed', () => {
  let b = makeBundle(); word(b, 'kitaab').plural = { roman: 'kitaabiyaaN', ur: 'کتابیاں' };
  const r = run(b);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /regular feminine plural would be "kitaabeN"/.test(w)));
  b = makeBundle(); word(b, 'kitaab').gender = 'mf'; assert.deepEqual(run(b).errors, []);
  b = makeBundle(); word(b, 'kitaab').gender = 'n'; failsWith(b, /gender/);
});

test('variable words need agreement forms that follow -aa / -ii / -e', () => {
  let b = makeBundle(); delete word(b, 'acchaa').agreement; failsWith(b, /agreement/);
  b = makeBundle(); word(b, 'acchaa').agreement.f = { roman: 'acche', ur: 'اچھے' }; failsWith(b, /agreement.f should be "acchii"/);
  b = makeBundle(); word(b, 'acchaa').agreement.m_pl = { roman: 'acche', ur: 'اچھی' }; failsWith(b, /agreement.m_pl/);
  b = makeBundle(); word(b, 'acchaa').agreement.m_sg = { roman: 'acchii', ur: 'اچھی' }; failsWith(b, /m_sg.roman/);
  b = makeBundle(); word(b, 'larkaa').variable = false; failsWith(b, /only for adjectives/);
  b = makeBundle(); word(b, 'acchaa').variable = false; failsWith(b, /variable is not true/);
});

test('phrases need a situation, checked like prose', () => {
  let b = makeBundle(); delete word(b, 'shukriyaa').situation; failsWith(b, /situation/);
  b = makeBundle(); word(b, 'shukriyaa').situation = 'You say `theek` to it.'; failsWith(b, /"ee"/);
});

test('dialogue: speakers are declared, the learner has no gender, everyone else does', () => {
  let b = makeBundle(); lesson(b).dialogue.lines[0].speaker = 'nobody'; failsWith(b, /"nobody" is not in dialogue.speakers/);
  b = makeBundle(); delete lesson(b).dialogue.speakers[0].gender; failsWith(b, /needs a gender/);
  b = makeBundle(); lesson(b).dialogue.speakers[0].learner = true; failsWith(b, /at most one/);
  b = makeBundle(); lesson(b).dialogue.speakers.push({ ...lesson(b).dialogue.speakers[0] }); failsWith(b, /duplicate speaker id/);
  b = makeBundle(); delete lesson(b).dialogue.setting; failsWith(b, /setting/);
  b = makeBundle(); lesson(b).dialogue.setting = 'They say `Salaam`.'; failsWith(b, /capital/);
});

test('hints and grammar examples are checked; unlocks must be a known feature', () => {
  let b = makeBundle(); ex(b, 'e01').hint = 'Goes with `mein`.'; assert.deepEqual(run(b).errors, []);
  b = makeBundle(); ex(b, 'e01').hint = 'Goes with `Main`.'; failsWith(b, /capital/);
  b = makeBundle(); lesson(b).grammar[0].examples = [{ roman: 'maiN Thiik hoon.', ur: 'میں ٹھیک ہوں۔', en: 'I am fine.' }]; failsWith(b, /"oo"/);
  b = makeBundle(); lesson(b).unlocks = ['perfectve']; failsWith(b, /unlocks/);
  b = makeBundle(); lesson(b).unlocks = ['gender']; assert.deepEqual(run(b).errors, []);
});

// ---- learner gender and other spellings (PLAN D23) -----------------------------------
const learnerLine = (b) => lesson(b).dialogue.lines[1]; // speaker "you" in the fixture
const firstPerson = (b) => {
  const e = { id: 'e09', type: 'fill-blank', explanation: 'x', sentence: { roman: 'maiN ___ huuN.', ur: 'میں ___ ہوں۔', en: "I'm good." }, answer: 'acchaa', answer_ur: 'اچھا' };
  lesson(b).exercises.push(e);
  return e;
};

test('learner_f: only on the learner\'s own dialogue lines, checked like any line', () => {
  let b = makeBundle(); learnerLine(b).learner_f = { roman: 'wa-alaikum-assalaam!', ur: 'وعلیکم السلام!' };
  assert.deepEqual(run(b).errors, []);
  b = makeBundle(); lesson(b).dialogue.lines[0].learner_f = { roman: 'x', ur: 'ک' }; failsWith(b, /only for the learner's own lines/);
  b = makeBundle(); learnerLine(b).learner_f = { roman: 'Theek', ur: 'ٹھیک' }; failsWith(b, /capital|"ee"/);
  b = makeBundle(); learnerLine(b).learner_f = { roman: 'Thiik', ur: 'ٹهيک' }; failsWith(b, /look-alike/);
  b = makeBundle(); learnerLine(b).learner_f = { roman: 'Thiik' }; failsWith(b, /ur/);
});

test('learner_f on exercises: the merged woman\'s version must be valid too', () => {
  let b = makeBundle(); firstPerson(b).learner_f = { answer: 'acchii', answer_ur: 'اچھی' };
  assert.deepEqual(run(b).errors, []);
  b = makeBundle(); firstPerson(b).learner_f = { answer: 'acchi i', answer_ur: 'اچھی', id: 'e10' }; failsWith(b, /may not replace id/);
  b = makeBundle(); firstPerson(b).learner_f = { sentence: { roman: 'maiN acchii huuN.', ur: 'میں اچھی ہوں۔', en: "I'm good." } }; failsWith(b, /woman's version.*needs a ___ blank/);
  b = makeBundle(); firstPerson(b).learner_f = { sentence: { roman: 'maiN ___ huuN.' } }; failsWith(b, /woman's version.*ur/);
  b = makeBundle(); firstPerson(b).learner_f = { answer: 'Acchii' }; failsWith(b, /capital "A"/);
  b = makeBundle(); firstPerson(b).learner_f = { colour: 'red' }; failsWith(b, /woman's version.*colour/);
});

test('a first-person sentence with a gendered form and no learner_f is a warning, not an error', () => {
  let b = makeBundle(); firstPerson(b);
  let r = run(b);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /e09.*"acchaa".*Add learner_f/.test(w)), r.warnings.join('\n'));
  b = makeBundle(); firstPerson(b).learner_f = { answer: 'acchii', answer_ur: 'اچھی' };
  assert.ok(!run(b).warnings.some((w) => /Add learner_f/.test(w)));
  b = makeBundle(); learnerLine(b).roman = 'maiN ghar jaataa huuN.'; learnerLine(b).ur = 'میں گھر جاتا ہوں۔';
  assert.ok(run(b).warnings.some((w) => /dialogue.lines\[1\].*"jaataa"/.test(w)));
  b = makeBundle(); learnerLine(b).roman = 'Thiik huuN. wo laRkii acchii hai.'; learnerLine(b).ur = 'ٹھیک ہوں۔ وہ لڑکی اچھی ہے۔';
  assert.ok(!run(b).warnings.some((w) => /Add learner_f/.test(w)), 'third-person sentences are not flagged');
});

test('ur_alt: other real spellings, in Urdu code points, not repeating ur', () => {
  let b = makeBundle(); word(b, 'shukriyaa').ur_alt = ['شکریا'];
  assert.deepEqual(run(b).errors, []);
  b = makeBundle(); word(b, 'shukriyaa').ur_alt = ['شکريه']; failsWith(b, /look-alike/);
  b = makeBundle(); word(b, 'shukriyaa').ur_alt = ['شکریہ']; failsWith(b, /repeats ur/);
});
