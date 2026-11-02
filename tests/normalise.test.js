import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exact, compare, check, diffAgainst, tokens, lenientKey, isCorrect } from '../src/lang/normalise.js';

test('exact ignores punctuation, extra spaces and treats a hyphen as a space, but keeps case', () => {
  assert.ok(exact('maiN  Thiik huuN.', 'maiN Thiik huuN'));
  assert.ok(exact('assalaam-o-alaikum!', 'assalaam o alaikum'));
  assert.ok(!exact('Thiik', 'thiik'));
  assert.deepEqual(tokens('kyaa haal hai?'), ['kyaa', 'haal', 'hai']);
});

test('close: capitals are ignored (T/t, D/d, R/r, Gh/gh)', () => {
  assert.equal(compare('thiik', 'Thiik'), 'close');
  assert.equal(compare('dar', 'Dar'), 'close');
  assert.equal(compare('larkaa', 'laRkaa'), 'close');
  assert.equal(compare('ghalat', 'Ghalat'), 'close');
  assert.equal(compare('Thiik', 'Thiik'), 'exact');
});

test('close: a word-final nasal is optional (huuN ~ hun ~ hu)', () => {
  for (const typed of ['huuN', 'huun', 'hun', 'hu', 'huu']) assert.ok(isCorrect(compare(typed, 'huuN')), typed);
  for (const typed of ['nahiiN', 'nahin', 'nahi', 'nahiin']) assert.ok(isCorrect(compare(typed, 'nahiiN')), typed);
  for (const typed of ['maiN', 'main', 'mai']) assert.ok(isCorrect(compare(typed, 'maiN')), typed);
  assert.ok(isCorrect(compare('kahaan', 'kahaaN')));
  assert.ok(isCorrect(compare('laRkon', 'laRkoN')));
});

test('a nasal is optional only when the expected word has N', () => {
  // expected N: a typed final n, N or nothing all match
  for (const typed of ['huuN', 'hun', 'huun', 'hu', 'huu', 'hoon']) assert.ok(isCorrect(compare(typed, 'huuN')), typed);
  for (const typed of ['kahaaN', 'kahaan', 'kahaa', 'kaha']) assert.ok(isCorrect(compare(typed, 'kahaaN')), typed);
});

test('a plain consonant n must match: din ≠ dii, jaan ≠ jaa, both directions', () => {
  // expected has no N → an extra typed n is wrong
  assert.equal(compare('din', 'dii'), 'wrong');
  assert.equal(compare('din', 'di'), 'wrong');
  assert.equal(compare('jaan', 'jaa'), 'wrong');
  assert.equal(compare('huuN', 'huu'), 'wrong', 'a typed nasal marker is not accepted for a word without one');
  // expected has a consonant n → a missing typed n is wrong
  assert.equal(compare('dii', 'din'), 'wrong');
  assert.equal(compare('di', 'din'), 'wrong');
  assert.equal(compare('jaa', 'jaan'), 'wrong');
  assert.equal(compare('kau', 'kaun'), 'wrong');
  // and the correct spellings still pass
  assert.equal(compare('din', 'din'), 'exact');
  assert.ok(isCorrect(compare('jaan', 'jaan')));
  assert.ok(isCorrect(compare('Din', 'din')));
  assert.ok(isCorrect(compare('jan', 'jaan')), 'vowel length is still lenient');
  // inside a longer answer too
  assert.equal(compare('aaj din Thiik hai', 'aaj dii Thiik hai'), 'wrong');
  assert.equal(compare('aaj dii Thiik hai', 'aaj din Thiik hai'), 'wrong');
});

test('close: vowel length and doubled consonants are ignored', () => {
  assert.equal(compare('aap', 'aap'), 'exact');
  assert.equal(compare('ap', 'aap'), 'close');
  assert.equal(compare('thik', 'Thiik'), 'close');
  assert.equal(compare('pakaa', 'pakkaa'), 'close');
  assert.equal(compare('acha', 'acchaa'), 'close');
  assert.equal(compare('shukriya', 'shukriyaa'), 'close');
});

test('close: the common phone spellings (D4)', () => {
  assert.equal(compare('theek', 'Thiik'), 'close');
  assert.equal(compare('hoon', 'huuN'), 'close');
  assert.equal(compare('mein', 'meN'), 'close');
  assert.equal(compare('hain', 'haiN'), 'close');
  assert.equal(compare('nahin', 'nahiiN'), 'close');
  assert.equal(compare('vo', 'wo'), 'close');
  assert.equal(compare('maiN theek hoon.', 'maiN Thiik huuN.'), 'close');
});

test('NEVER blurred: endings that carry gender and agreement', () => {
  const pairs = [
    ['laRkaa', 'laRkii'], ['laRkaa', 'laRke'], ['laRkii', 'laRke'],
    ['gayaa', 'gayii'], ['gayaa', 'gaye'], ['gayii', 'gaye'],
    ['kaa', 'kii'], ['kaa', 'ke'], ['kii', 'ke'],
    ['acchaa', 'acchii'], ['acchaa', 'acche'], ['acchii', 'acche'],
    ['merii', 'meraa'], ['kiyaa', 'kyaa'],
  ];
  for (const [a, b] of pairs) {
    assert.equal(compare(a, b), 'wrong', `${a} vs ${b}`);
    assert.equal(compare(b, a), 'wrong', `${b} vs ${a}`);
    assert.notEqual(lenientKey(a), lenientKey(b), `${a} / ${b} keys must differ`);
  }
  // even with the lenient allowances stacked on top
  assert.equal(compare('LARKII', 'laRkaa'), 'wrong');
  assert.equal(compare('gayi', 'gaye'), 'wrong');
});

test('different words and word counts are wrong', () => {
  assert.equal(compare('maiN Thiik huuN', 'maiN Thiik'), 'wrong');
  assert.equal(compare('', 'hai'), 'wrong');
  assert.equal(compare('tum', 'aap'), 'wrong');
  assert.equal(compare('dil', 'dal'), 'wrong');
});

test('loanwords match case-insensitively only', () => {
  const loanwords = new Set(['phone']);
  assert.equal(compare('Phone', 'phone', { loanwords }), 'close');
  assert.equal(compare('phone', 'phone', { loanwords }), 'exact');
  assert.equal(compare('fone', 'phone', { loanwords }), 'wrong');
  assert.equal(compare('mera phone', 'mera phone', { loanwords }), 'exact');
});

test('check picks the matching answer among several and reports exact before close', () => {
  const answers = ['maiN Thiik huuN', 'Thiik maiN huuN'];
  assert.equal(check('Thiik maiN huuN', answers).result, 'exact');
  assert.equal(check('Thiik maiN huuN', answers).answer, 'Thiik maiN huuN');
  const close = check('thiik main hoon', answers);
  assert.equal(close.result, 'close');
  assert.equal(close.answer, 'Thiik maiN huuN', 'matched against the listed order it follows');
  assert.equal(check('maiN theek hoon', answers).answer, 'maiN Thiik huuN');
  assert.equal(check('tum kahaaN ho', answers).result, 'wrong');
});

test('a wrong answer is diffed against the nearest answer', () => {
  const r = check('maiN Thiik ho', ['maiN Thiik huuN', 'aap kahaaN haiN']);
  assert.equal(r.result, 'wrong');
  assert.equal(r.answer, 'maiN Thiik huuN');
});

test('check on empty input is wrong and never throws', () => {
  assert.equal(check('', ['hai']).result, 'wrong');
  assert.equal(check('hai', []).result, 'wrong');
});

test('diff highlights the expected characters the typed text did not have', () => {
  const segs = diffAgainst('thiik', 'Thiik');
  assert.equal(segs.map((s) => s.text).join(''), 'Thiik');
  assert.deepEqual(segs.filter((s) => !s.same).map((s) => s.text), ['T']);
  const full = diffAgainst('hun', 'huuN');
  assert.equal(full.map((s) => s.text).join(''), 'huuN');
  assert.ok(full.some((s) => !s.same));
  assert.ok(diffAgainst('hai', 'hai').every((s) => s.same));
});

test('greetings: common phone spellings are close enough, never exact, and only for their own phrase', () => {
  const hello = 'assalaam-o-alaikum';
  for (const typed of ['assalamualaikum', 'Assalamu alaikum', 'asalamualaikum', 'aslamualaikum', 'salam', 'salaam', 'salam alaikum', 'assalam o alaikum']) {
    assert.equal(check(typed, [hello]).result, 'close', typed);
  }
  assert.equal(check('assalaam-o-alaikum', [hello]).result, 'exact');
  assert.equal(check('assalaam o alaikum', [hello]).result, 'exact', 'hyphen = space');
  const reply = 'wa-alaikum-assalaam';
  for (const typed of ['walaikum assalam', 'Walaikumassalam', 'walaikum salam', 'wa alaikum salam', 'wa alaikum assalam']) {
    assert.equal(check(typed, [reply]).result, 'close', typed);
  }
  assert.equal(check('walaikum assalam', [hello]).result, 'wrong', 'the reply is not the greeting');
  assert.equal(check('salam', [reply]).result, 'wrong', 'the greeting is not the reply');
  for (const typed of ['alhamdulillah', 'alhamdolillah', 'alhumdulillah', 'alhamdu lillah']) assert.equal(check(typed, ['alhamdulillaah']).result, 'close', typed);
});

test('greeting spellings also work inside a longer answer, and other words are still checked', () => {
  assert.equal(check('assalamualaikum! aap kaise hain?', ['assalaam-o-alaikum! aap kaise haiN?']).result, 'close');
  assert.equal(check('alhamdulillah, theek hoon. aur aap?', ['alhamdulillaah, Thiik huuN. aur aap?']).result, 'close');
  assert.equal(check('assalamualaikum! aap kaisii hain?', ['assalaam-o-alaikum! aap kaise haiN?']).result, 'wrong', 'an ending that carries grammar still counts');
  assert.equal(check('salam', ['salaam']).result, 'close', 'a different phrase is untouched (ordinary vowel folding only)');
});
