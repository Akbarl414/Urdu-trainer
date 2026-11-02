import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContentIndex } from '../src/db/contentIndex.js';
import { defaultData } from '../src/db/storage.js';
import { makeBundle } from './helpers/contentFixture.js';
import { parseCardId, wordCardId, exerciseCardId, itemKey, facetOf, facetsFor, dormantFacets, unlockedFeatures, allFacets } from '../src/srs/facets.js';
import { syncDeck, wantedCards, markWordKnown } from '../src/srs/deck.js';
import { CARD_STATE, GRADE } from '../src/srs/fsrs.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T10:00:00Z');

function makeContent({ unlocks = {}, extraLesson = true } = {}) {
  const b = makeBundle();
  const l1 = b.lessons[0].data;
  l1.unlocks = unlocks.lesson1 ?? [];
  const lessons = [l1];
  if (extraLesson) {
    lessons.push({ ...JSON.parse(JSON.stringify(l1)), id: 'lesson-002', order: 2, new_vocab: [], unlocks: unlocks.lesson2 ?? ['gender'], exercises: [l1.exercises[0]] });
  }
  return buildContentIndex({ units: b.units.map((x) => x.data), vocabs: b.vocabs.map((x) => x.data), lessons });
}
const completed = (...ids) => {
  const d = defaultData(NOW);
  for (const id of ids) d.progress.lessons[id] = { firstCompletedAt: 'x', lastCompletedAt: 'x', timesCompleted: 1, knownWordIds: [] };
  return d;
};

test('card ids build and parse both ways, and the script prefix is reserved', () => {
  assert.equal(wordCardId('larkaa', 'gender'), 'w:larkaa:gender');
  assert.deepEqual(parseCardId('w:larkaa:gender'), { kind: 'word', wordId: 'larkaa', facet: 'gender' });
  assert.equal(exerciseCardId('lesson-001', 'e03'), 'x:lesson-001:e03');
  assert.deepEqual(parseCardId('x:lesson-001:e03'), { kind: 'exercise', lessonId: 'lesson-001', exerciseId: 'e03' });
  assert.equal(parseCardId('s:l:alif:sound').kind, 'script');
  assert.equal(parseCardId('s:w:phone:read').kind, 'script');
  for (const bad of ['', 'w:x', 'w::gender', 'q:a:b', null, undefined, 42]) assert.equal(parseCardId(bad), null, String(bad));
  assert.equal(facetOf('w:larkaa:gender'), 'gender');
  assert.equal(facetOf('x:lesson-001:e03'), 'default');
});

test('siblings share an item key: facets of one word, exercises of one lesson', () => {
  assert.equal(itemKey('w:larkaa:gender'), itemKey('w:larkaa:meaning_en_ur'));
  assert.notEqual(itemKey('w:larkaa:gender'), itemKey('w:larkii:gender'));
  assert.equal(itemKey('x:lesson-001:e01'), itemKey('x:lesson-001:e02'));
});

test('facet table per part of speech (PLAN §5.2, D17)', () => {
  const c = makeContent();
  const all = new Set(['gender', 'perfective', 'ne']);
  assert.deepEqual(facetsFor(c.getWord('larkaa'), all), ['meaning_ur_en', 'meaning_en_ur', 'gender']);
  assert.deepEqual(facetsFor(c.getWord('jaanaa'), all), ['meaning_ur_en', 'meaning_en_ur', 'perfective', 'takes_ne']);
  assert.deepEqual(facetsFor(c.getWord('acchaa'), all), ['meaning_ur_en', 'meaning_en_ur']);
  assert.deepEqual(facetsFor(c.getWord('shukriyaa'), all), ['meaning_ur_en', 'situation_to_phrase']);
  assert.deepEqual(allFacets({ pos: 'postposition' }), ['meaning_ur_en', 'meaning_en_ur']);
  assert.deepEqual(allFacets({ pos: 'pronoun' }), ['meaning_ur_en', 'meaning_en_ur']);
});

test('facets that test grammar the learner has not reached stay dormant', () => {
  const c = makeContent();
  const none = new Set();
  assert.deepEqual(facetsFor(c.getWord('larkaa'), none), ['meaning_ur_en', 'meaning_en_ur']);
  assert.deepEqual(dormantFacets(c.getWord('larkaa'), none), ['gender']);
  assert.deepEqual(facetsFor(c.getWord('jaanaa'), new Set(['perfective'])), ['meaning_ur_en', 'meaning_en_ur', 'perfective']);
  assert.deepEqual(dormantFacets(c.getWord('jaanaa'), new Set(['perfective'])), ['takes_ne']);
  // a noun missing its gender data has no gender facet at all
  assert.deepEqual(allFacets({ pos: 'noun' }), ['meaning_ur_en', 'meaning_en_ur']);
});

test('features come from the `unlocks` of completed lessons only', () => {
  const c = makeContent({ unlocks: { lesson1: [], lesson2: ['gender'] } });
  assert.deepEqual([...unlockedFeatures(['lesson-001'], c)], []);
  assert.deepEqual([...unlockedFeatures(['lesson-001', 'lesson-002'], c)], ['gender']);
  assert.deepEqual([...unlockedFeatures(['lesson-999'], c)], [], 'unknown lessons are ignored');
});

test('nothing is created before a lesson is completed', () => {
  const c = makeContent();
  const d = defaultData(NOW);
  assert.deepEqual(syncDeck(d, c, NOW), []);
  assert.equal(Object.keys(d.srs.decks.main.cards).length, 0);
});

test('completing a lesson creates a card per live facet and one per exercise; gender stays dormant', () => {
  const c = makeContent({ unlocks: { lesson1: [] }, extraLesson: false });
  const d = completed('lesson-001');
  const created = syncDeck(d, c, NOW);
  const cards = d.srs.decks.main.cards;
  assert.equal(created.length, Object.keys(cards).length);
  assert.ok(cards['w:larkaa:meaning_en_ur']);
  assert.ok(!cards['w:larkaa:gender'], 'gender is dormant');
  assert.ok(!cards['w:jaanaa:perfective']);
  assert.ok(cards['x:lesson-001:e01']);
  assert.ok(cards['w:shukriyaa:situation_to_phrase']);
  for (const card of Object.values(cards)) {
    assert.equal(card.st, CARD_STATE.new);
    assert.equal(card.due, NOW);
  }
});

test('unlocking a feature creates the dormant cards the same day, without touching existing cards', () => {
  const c = makeContent({ unlocks: { lesson1: [], lesson2: ['gender'] } });
  const d = completed('lesson-001');
  syncDeck(d, c, NOW);
  // study one card so we can see it is untouched
  const id = 'w:larkaa:meaning_ur_en';
  d.srs.decks.main.cards[id] = { ...d.srs.decks.main.cards[id], st: CARD_STATE.review, s: 12.5, r: 4, due: NOW + 9 * DAY };
  const before = JSON.stringify(d.srs.decks.main.cards[id]);

  d.progress.lessons['lesson-002'] = { firstCompletedAt: 'x', lastCompletedAt: 'x', timesCompleted: 1, knownWordIds: [] };
  const created = syncDeck(d, c, NOW + DAY);
  assert.ok(created.includes('w:larkaa:gender'));
  assert.ok(created.includes('w:larkii:gender'));
  assert.ok(created.includes('w:kitaab:gender'));
  assert.ok(!created.includes(id));
  assert.equal(JSON.stringify(d.srs.decks.main.cards[id]), before);
});

test('syncDeck is idempotent', () => {
  const c = makeContent();
  const d = completed('lesson-001', 'lesson-002');
  const first = syncDeck(d, c, NOW);
  const snapshot = JSON.stringify(d.srs.decks.main.cards);
  assert.ok(first.length > 0);
  assert.deepEqual(syncDeck(d, c, NOW + DAY), []);
  assert.equal(JSON.stringify(d.srs.decks.main.cards), snapshot);
});

test('retired words and exercises get no new cards, but keep the ones they have', () => {
  const c = makeContent({ extraLesson: false });
  c.getWord('acchaa').retired = true;
  c.getLesson('lesson-001').exercises[0].retired = true;
  const d = completed('lesson-001');
  d.srs.decks.main.cards['w:acchaa:meaning_ur_en'] = { due: NOW, s: 3, d: 5, st: 2, r: 3, l: 0, lr: NOW - DAY, sd: 3, ls: 0 };
  syncDeck(d, c, NOW);
  const cards = d.srs.decks.main.cards;
  assert.ok(cards['w:acchaa:meaning_ur_en'], 'existing card kept');
  assert.ok(!cards['w:acchaa:meaning_en_ur']);
  assert.ok(!cards['x:lesson-001:e01']);
  assert.ok(cards['x:lesson-001:e02']);
});

test('progress for a lesson this build does not have is left alone', () => {
  const c = makeContent({ extraLesson: false });
  const d = completed('lesson-001', 'lesson-050');
  assert.doesNotThrow(() => syncDeck(d, c, NOW));
});

test('lesson results seed the new cards: Good practised, Again missed', () => {
  const c = makeContent({ extraLesson: false });
  const d = completed('lesson-001');
  syncDeck(d, c, NOW, { grades: { 'w:larkaa:meaning_ur_en': GRADE.good, 'w:larkaa:meaning_en_ur': GRADE.again } });
  const cards = d.srs.decks.main.cards;
  assert.equal(cards['w:larkaa:meaning_ur_en'].r, 1);
  assert.equal(cards['w:larkaa:meaning_ur_en'].st, CARD_STATE.learning);
  assert.equal(cards['w:larkaa:meaning_en_ur'].r, 1);
  assert.ok(cards['w:larkaa:meaning_en_ur'].due < cards['w:larkaa:meaning_ur_en'].due);
  assert.equal(cards['w:larkii:meaning_ur_en'].r, 0, 'no result → still New');
});

test('"I already know this": the word\'s cards enter in Review with a long first interval', () => {
  const c = makeContent({ extraLesson: false });
  const d = completed('lesson-001');
  syncDeck(d, c, NOW, { known: ['larkaa'] });
  const cards = d.srs.decks.main.cards;
  for (const f of ['meaning_ur_en', 'meaning_en_ur']) {
    const k = cards[`w:larkaa:${f}`];
    assert.equal(k.st, CARD_STATE.review);
    assert.ok(k.due - NOW >= 7 * DAY, `${f}: ${(k.due - NOW) / DAY} days`);
  }
  assert.equal(cards['w:larkii:meaning_ur_en'].st, CARD_STATE.new, 'other words are normal');
});

test('markWordKnown upgrades missing or New cards and leaves reviewed ones alone', () => {
  const c = makeContent({ extraLesson: false });
  const d = completed('lesson-001');
  syncDeck(d, c, NOW);
  const reviewed = { due: NOW + 3 * DAY, s: 4, d: 5, st: 2, r: 3, l: 1, lr: NOW - DAY, sd: 3, ls: 0 };
  d.srs.decks.main.cards['w:larkaa:meaning_en_ur'] = reviewed;
  const changed = markWordKnown(d, c, 'larkaa', NOW);
  assert.deepEqual(changed, ['w:larkaa:meaning_ur_en']);
  assert.deepEqual(d.srs.decks.main.cards['w:larkaa:meaning_en_ur'], reviewed);
  assert.equal(d.srs.decks.main.cards['w:larkaa:meaning_ur_en'].st, CARD_STATE.review);
  assert.deepEqual(markWordKnown(d, c, 'no-such-word', NOW), []);
});

test('wantedCards lists each word once even if two completed lessons list it', () => {
  const c = makeContent();
  c.getLesson('lesson-002').new_vocab = ['larkaa'];
  const d = completed('lesson-001', 'lesson-002');
  const ids = wantedCards(d, c).map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
});
