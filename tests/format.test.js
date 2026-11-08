import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseFormat, stageOf, STAGE_DAYS } from '../src/srs/format.js';
import { chunksOf, syllables, graphemes } from '../src/lang/tiles.js';
import { isIrregularPerfective } from '../src/lang/verbs.js';

const card = (s, f) => ({ s, f });

test('the stage follows stability', () => {
  assert.equal(stageOf(undefined), 'new');
  assert.equal(stageOf(card(0)), 'new');
  assert.equal(stageOf(card(STAGE_DAYS.learning)), 'learning');
  assert.equal(stageOf(card(STAGE_DAYS.known)), 'known');
  assert.equal(stageOf(card(STAGE_DAYS.strong)), 'strong');
});

test('words: multiple choice → tiles → typed → listening or in-sentence', () => {
  assert.equal(chooseFormat({ card: card(1) }), 'choice');
  assert.equal(chooseFormat({ card: card(5) }), 'tiles');
  assert.equal(chooseFormat({ card: card(20) }), 'typed');
  assert.equal(chooseFormat({ card: card(60) }), 'listen');
});

test('never the same format twice in a row, at every stage, whatever is available', () => {
  const availabilities = [() => true, (f) => f !== 'listen', (f) => f !== 'listen' && f !== 'sentence', (f) => f !== 'meaning_choice' && f !== 'situation_choice'];
  for (const phrase of [false, true]) {
    for (const available of availabilities) {
      let f;
      for (const s of [0, 1, 2, 5, 13, 20, 40, 60, 200, 500]) {
        for (let i = 0; i < 6; i++) {
          const next = chooseFormat({ card: card(s, f), phrase, available });
          assert.notEqual(next, f, `phrase=${phrase} s=${s}`);
          assert.ok(available(next), next);
          f = next;
        }
      }
    }
  }
});

test('a strong word alternates listening and in-sentence recall; no voice falls back', () => {
  assert.equal(chooseFormat({ card: card(60, 'listen') }), 'sentence');
  assert.equal(chooseFormat({ card: card(60, 'sentence') }), 'listen');
  assert.equal(chooseFormat({ card: card(60, 'typed') }), 'listen');
  assert.equal(chooseFormat({ card: card(60), available: (f) => f !== 'listen' }), 'sentence');
  assert.equal(chooseFormat({ card: card(60, 'typed'), available: (f) => f !== 'listen' && f !== 'sentence' }), 'tiles');
});

test('phrases rotate between a meaning format and a situation format', () => {
  const steps = (s) => {
    let f;
    const out = [];
    for (let i = 0; i < 4; i++) {
      f = chooseFormat({ card: card(s, f), phrase: true });
      out.push(f);
    }
    return out;
  };
  assert.deepEqual(steps(1), ['meaning_choice', 'situation_choice', 'meaning_choice', 'situation_choice']);
  assert.deepEqual(steps(6), ['situation_tiles', 'meaning_choice', 'situation_tiles', 'meaning_choice']);
  assert.deepEqual(steps(20), ['situation_typed', 'listen', 'situation_typed', 'listen']);
});

test('tiles: words, syllables or sounds', () => {
  assert.deepEqual(chunksOf('kyaa haal hai?'), ['kyaa', 'haal', 'hai']);
  assert.deepEqual(chunksOf('assalaam-o-alaikum'), ['assalaam', 'o', 'alaikum']);
  assert.deepEqual(syllables('khaanaa'), ['khaa', 'naa']);
  assert.deepEqual(syllables('alhamdulillaah'), ['al', 'ham', 'du', 'lil', 'laah']);
  assert.deepEqual(syllables('bacchaa'), ['ba', 'cchaa']);
  assert.deepEqual(chunksOf('dost'), ['d', 'o', 's', 't']);
  assert.deepEqual(chunksOf('ghar'), ['gh', 'a', 'r']);
  assert.deepEqual(chunksOf('maiN'), ['m', 'ai', 'N']);
  assert.deepEqual(graphemes('Thiik'), ['Th', 'ii', 'k']);
  assert.deepEqual(chunksOf('doctor'), ['doc', 'tor']);
});

test('tiles put every letter of the answer in a tile, for every word in the course', async () => {
  const { realContent } = await import('./helpers/realContent.js');
  const { tokens } = await import('../src/lang/normalise.js');
  for (const w of realContent().words) {
    const chunks = chunksOf(w.roman);
    assert.ok(chunks.length >= 2, `${w.id}: ${chunks}`);
    assert.equal(chunks.join(''), tokens(w.roman).join(''), w.id);
  }
});

test('irregular perfectives are told apart from the regular ones', () => {
  const v = (stem, m) => ({ stem: { roman: stem }, perfective: { m_sg: { roman: m } } });
  for (const [stem, m] of [['jaa', 'gayaa'], ['kar', 'kiyaa'], ['de', 'diyaa'], ['le', 'liyaa'], ['ho', 'huaa'], ['pii', 'piyaa']]) assert.equal(isIrregularPerfective(v(stem, m)), true, m);
  for (const [stem, m] of [['rah', 'rahaa'], ['mar', 'maraa'], ['khaa', 'khaayaa'], ['aa', 'aayaa'], ['so', 'soyaa']]) assert.equal(isIrregularPerfective(v(stem, m)), false, m);
  assert.equal(isIrregularPerfective({ pos: 'noun' }), false);
});
