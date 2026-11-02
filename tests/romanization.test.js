import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { checkRoman, checkUrdu, checkLoanwordRoman } from '../src/lang/romanization.js';

const here = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(join(here, '../content/ROMANIZATION.md'), 'utf8');

/** Worked examples table (§4): column 2 is roman, column 3 is Urdu; either may hold several forms. */
function workedExamples() {
  const section = doc.slice(doc.indexOf('## 4. Worked examples'), doc.indexOf('## 5. English loanwords'));
  const rows = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || !/^\d+$/.test(cells[1])) continue;
    rows.push({ n: Number(cells[1]), roman: cells[2], ur: cells[3] });
  }
  return rows;
}

test('ROMANIZATION.md has at least 40 worked examples (brief §6)', () => {
  assert.ok(workedExamples().length >= 40);
});

test('every worked example in ROMANIZATION.md passes the validator rules (doc and code agree)', () => {
  for (const { n, roman, ur } of workedExamples()) {
    for (const form of roman.split(/ \/ | · /)) {
      assert.deepEqual(checkRoman(form), [], `example ${n}: "${form}"`);
    }
    for (const form of ur.split(/ \/ | · /)) {
      assert.deepEqual(checkUrdu(form), [], `example ${n} (Urdu): "${form}"`);
    }
  }
});

test('valid sentences and punctuation', () => {
  for (const s of ['maiN Thiik huuN.', 'kyaa aap Thiik haiN?', 'Thiik hai!', 'assalaam-o-alaikum', 'wo ne kahaa: "maiN aauungaa"', 'maiN ___ huuN', 'Ghalat nahiiN hai', 'aaiye, baiThiye…']) {
    assert.deepEqual(checkRoman(s, { allowBlank: true }), [], s);
  }
});

test('rejects capitals other than T D R N Gh', () => {
  assert.notDeepEqual(checkRoman('Main Thiik huuN'), []);
  assert.notDeepEqual(checkRoman('Ahmad'), []);
  assert.notDeepEqual(checkRoman('Gaana'), []); // G not as Gh
  assert.deepEqual(checkRoman('Ghalat'), []);
});

test('rejects characters outside the scheme', () => {
  for (const s of ['maiN 5 huuN', "ma'iN", 'maiN vo hai', 'kya/aap', 'ā', 'maiN_hai', 'maiN Thiik huuN 😀']) {
    assert.notDeepEqual(checkRoman(s), [], s);
  }
});

test('blank marker only with allowBlank', () => {
  assert.notDeepEqual(checkRoman('maiN ___ huuN'), []);
  assert.deepEqual(checkRoman('maiN ___ huuN', { allowBlank: true }), []);
});

test('N only word-final after a vowel', () => {
  for (const s of ['aaNkh', 'paNch', 'NahiiN', 'hN', 'jaauNgaa']) assert.notDeepEqual(checkRoman(s), [], s);
  for (const s of ['aankh', 'paanch', 'jaaungaa', 'huuN', 'nahiiN', 'kahaaN', 'laRkoN', 'kitaabeN', 'assalaam-o-alaikum']) assert.deepEqual(checkRoman(s), [], s);
  assert.notDeepEqual(checkRoman('hai-N'), []); // N after hyphen, not after a vowel
});

test('c only as ch / cch', () => {
  for (const s of ['cat', 'cup', 'cc', 'ac']) assert.notDeepEqual(checkRoman(s), [], s);
  for (const s of ['chaar', 'kuchh', 'acchaa', 'bacchaa', 'chhoTaa']) assert.deepEqual(checkRoman(s), [], s);
});

test('no ee, oo or tripled vowels', () => {
  for (const s of ['theek', 'hoon', 'baaaht', 'kuuuch']) assert.notDeepEqual(checkRoman(s), [], s);
  assert.deepEqual(checkRoman('Thiik huuN'), []);
});

test('loanwords: exempt only when listed, and still lowercase', () => {
  const exempt = new Set(['phone', 'doctor', 'buseN', 'doctoroN ko', 'tv']);
  assert.deepEqual(checkRoman('mera phone kahaaN hai?', { exempt }), []);
  assert.deepEqual(checkRoman('doctoroN ko dikhaao', { exempt }), []);
  assert.deepEqual(checkRoman('wo tv dekh rahaa hai.', { exempt }), []);
  // not listed → checked normally ("v", "c" fail)
  assert.notDeepEqual(checkRoman('mera computer kahaaN hai?', { exempt }), []);
  assert.notDeepEqual(checkRoman('tv dekho'), []);
  // a listed word spelled with capitals is still wrong
  assert.notDeepEqual(checkRoman('Phone', { exempt: new Set(['Phone']) }), []);
  assert.deepEqual(checkLoanwordRoman('phone'), []);
  assert.deepEqual(checkLoanwordRoman('buseN'), []);
  assert.notDeepEqual(checkLoanwordRoman('Phone'), []);
  assert.notDeepEqual(checkLoanwordRoman('buSes'), []);
});

test('Urdu script: look-alikes and Latin letters are rejected', () => {
  assert.deepEqual(checkUrdu('میں ٹھیک ہوں'), []);
  assert.deepEqual(checkUrdu('میں ___ ہوں', { allowBlank: true }), []);
  assert.notDeepEqual(checkUrdu('میں ٹھيک ہوں'), []); // Arabic ي
  assert.notDeepEqual(checkUrdu('كيا'), []); // Arabic ك ي
  assert.notDeepEqual(checkUrdu('هوں'), []); // Arabic ه
  assert.notDeepEqual(checkUrdu('maiN'), []);
  assert.notDeepEqual(checkUrdu(''), []);
  assert.notDeepEqual(checkUrdu('میں ___ ہوں'), []); // blank not allowed unless asked
});
