import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { romanToDevanagari, unconvertedTokens } from '../src/lang/devanagari.js';

const here = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(join(here, '../content/ROMANIZATION.md'), 'utf8');

// Hand-checked expected output for every roman form in the ROMANIZATION.md §4 table.
const EXPECTED = {
  ab: 'अब', dil: 'दिल', tum: 'तुम', aap: 'आप', Thiik: 'ठीक', huuN: 'हूँ',
  'maiN Thiik huuN': 'मैं ठीक हूँ', mere: 'मेरे', hai: 'है', do: 'दो', aur: 'और',
  maiN: 'मैं', meN: 'में', haiN: 'हैं', nahiiN: 'नहीं', haaN: 'हाँ',
  aankh: 'आंख', paanch: 'पांच', munh: 'मुंह', ThanDaa: 'ठंडा', Dar: 'डर',
  laRkaa: 'लड़्का', laRkii: 'लड़्की', paRhnaa: 'पढ़्ना', chhoTaa: 'छोटा', das: 'दस', tiin: 'तीन',
  chaar: 'चार', kuchh: 'कुछ', khaanaa: 'खाना', ghar: 'घर', bhaaii: 'भाई', phal: 'फल',
  thaa: 'था', dhuup: 'धूप', jhuuTh: 'झूठ', xush: 'ख़ुश', xabar: 'ख़बर', Ghalat: 'ग़लत',
  Ghazal: 'ग़ज़ल', qariib: 'क़रीब', shukriyaa: 'शुक्रिया', zaruur: 'ज़रूर', sab: 'सब',
  waqt: 'वक़्त', yahaaN: 'यहाँ', pakkaa: 'पक्का', bacchaa: 'बच्चा', acchaa: 'अच्छा',
  makkhii: 'मक्खी', maaluum: 'मालूम', aurat: 'औरत', behen: 'बेहेन',
  kyaa: 'क्या', kiyaa: 'किया', huaa: 'हुआ', hawaa: 'हवा',
  gayaa: 'गया', gayii: 'गयी', gaye: 'गये',
  kamraa: 'कम्रा', kamre: 'कम्रे', kamroN: 'कम्रों',
  kitaabeN: 'किताबें', roTiyaaN: 'रोटियाँ',
  ye: 'ये', wo: 'वो', chaae: 'चाए', jaaungaa: 'जाउंगा', aaenge: 'आएंगे',
};

function workedExamples() {
  const section = doc.slice(doc.indexOf('## 4. Worked examples'), doc.indexOf('## 5. English loanwords'));
  const forms = [];
  let rows = 0;
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || !/^\d+$/.test(cells[1])) continue;
    rows++;
    for (const f of cells[2].split(/ \/ | · /)) forms.push({ n: cells[1], roman: f });
  }
  return { rows, forms };
}

test('all 60 worked examples in ROMANIZATION.md convert to the expected Devanagari', () => {
  const { rows, forms } = workedExamples();
  assert.equal(rows, 60);
  for (const { n, roman } of forms) {
    assert.ok(roman in EXPECTED, `example ${n}: no expectation for "${roman}"`);
    assert.equal(romanToDevanagari(roman), EXPECTED[roman], `example ${n}: ${roman}`);
  }
  const used = new Set(forms.map((f) => f.roman));
  for (const k of Object.keys(EXPECTED)) assert.ok(used.has(k), `stale expectation "${k}"`);
});

test('nuqta letters: q x Gh z f and flap R', () => {
  assert.equal(romanToDevanagari('q'), 'क़');
  assert.equal(romanToDevanagari('x'), 'ख़');
  assert.equal(romanToDevanagari('Gh'), 'ग़');
  assert.equal(romanToDevanagari('z'), 'ज़');
  assert.equal(romanToDevanagari('f'), 'फ़');
  assert.equal(romanToDevanagari('fikr'), 'फ़िक्र');
});

test('word-final N: anusvara over a headline vowel sign, chandrabindu otherwise', () => {
  assert.equal(romanToDevanagari('haiN'), 'हैं');
  assert.equal(romanToDevanagari('kahaaN'), 'कहाँ');
  assert.equal(romanToDevanagari('huuN'), 'हूँ');
});

test('geminate n and m are consonants, not nasalisation', () => {
  assert.equal(romanToDevanagari('sunnaa'), 'सुन्ना');
});

test('punctuation and spacing pass through', () => {
  assert.equal(romanToDevanagari('kyaa, aap Thiik haiN?'), 'क्या, आप ठीक हैं?');
});

test('loanwords and non-roman text pass through unchanged', () => {
  assert.equal(romanToDevanagari('phone hai', { loanwords: ['phone'] }), 'phone है');
  assert.equal(romanToDevanagari('میں'), 'میں');
  assert.equal(romanToDevanagari('buseN', { loanwords: ['buseN'] }), 'buseN');
  assert.deepEqual(unconvertedTokens('phone hai', { loanwords: ['phone'] }), ['phone']);
});

test('is deterministic', () => {
  assert.equal(romanToDevanagari('maiN Thiik huuN'), romanToDevanagari('maiN Thiik huuN'));
});
