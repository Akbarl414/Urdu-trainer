import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nounPlural } from '../src/lang/nounForms.js';
import { describeCard } from '../src/srs/cardFace.js';
import { realContent } from './helpers/realContent.js';

const p = (roman, ur) => ({ roman, ur });
const larkaa = { id: 'larkaa', pos: 'noun', roman: 'laRkaa', ur: 'لڑکا', gender: 'm', marked: true, plural: p('laRke', 'لڑکے'), oblique_pl: p('laRkoN', 'لڑکوں') };

test('nounPlural: ordinary nouns give their listed plural and oblique plural', () => {
  assert.deepEqual(nounPlural(larkaa), { plural: p('laRke', 'لڑکے'), oblique_pl: p('laRkoN', 'لڑکوں') });
});

test('nounPlural: rare plurals, mass nouns and non-nouns give nothing to practise', () => {
  assert.equal(nounPlural({ ...larkaa, plural_rare: true }), null);
  assert.equal(nounPlural({ id: 'paanii', pos: 'noun', roman: 'paanii', ur: 'پانی', gender: 'm', marked: false, mass: true }), null);
  assert.equal(nounPlural({ id: 'meraa', pos: 'pronoun', roman: 'meraa', ur: 'میرا' }), null);
  assert.equal(nounPlural(undefined), null);
});

test('nounPlural: an invariable loanword uses its own form for singular, plural and oblique', () => {
  const aunty = { id: 'aunty', pos: 'noun', roman: 'aunty', ur: 'آنٹی', gender: 'f', marked: false, loanword: true, invariable: true };
  assert.deepEqual(nounPlural(aunty), { plural: p('aunty', 'آنٹی'), oblique_pl: p('aunty', 'آنٹی') });
});

test('course content: ammii and abbuu have rare plurals, so the gender card never reveals them', () => {
  const content = realContent();
  for (const id of ['ammii', 'abbuu']) {
    const w = content.getWord(id);
    assert.equal(w.plural_rare, true, id);
    assert.equal(nounPlural(w), null, id);
    assert.ok(!describeCard(`w:${id}:gender`, content).reveal.some((r) => r.label === 'Plural'), id);
  }
  assert.ok(describeCard('w:behen:gender', content).reveal.some((r) => r.label === 'Plural' && r.roman === 'behneN'), 'ordinary plurals still show');
});
