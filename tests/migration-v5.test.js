// The v4 → v5 migration: one main card per word (PLAN D28). No card may be lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { migrate, MIGRATIONS, createStore, STORAGE_VERSION } from '../src/db/storage.js';
import { DATA_KEY, SNAPSHOTS_KEY } from '../src/db/keys.js';
import { memoryStorage } from './helpers/memoryStorage.js';
import { realContent } from './helpers/realContent.js';
import { buildQueue, dueInPriorityOrder } from '../src/srs/queue.js';
import { isReviewable, lessonOfCard } from '../src/srs/cardFace.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixtures = () => readdirSync(fixtureDir).filter((f) => /^storage-v\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(join(fixtureDir, f), 'utf8')));

const NOW = Date.parse('2026-11-08T10:00:00Z');
const DAY = 86400000;
/** A v4 device could only have finished the lessons that existed then (1–5). */
const v4Lessons = (content) => content.lessons.filter((l) => l.order <= 5);
const card = (due, s, st = 2, extra = {}) => ({ due, s, d: 5, st, r: 3, l: 1, lr: due - s * DAY, sd: s, ls: 0, ...extra });

/** A blob as a phone that finished lessons 1–5 would have it under v4: every word's facets and every exercise. */
function phoneV4() {
  const content = realContent();
  const cards = {};
  const lessons = {};
  let n = 0;
  for (const l of v4Lessons(content)) {
    lessons[l.id] = { firstCompletedAt: 'x', lastCompletedAt: 'x', timesCompleted: 1, knownWordIds: [] };
    for (const id of l.new_vocab) {
      const w = content.getWord(id);
      const s = 2 + n++;
      cards[`w:${id}:meaning_ur_en`] = card(NOW + s * DAY, s * 2);
      cards[`w:${id}:${w.pos === 'phrase' ? 'situation_to_phrase' : 'meaning_en_ur'}`] = card(NOW + s * 10000, s, 2, { weak: NOW - DAY });
    }
    for (const e of l.exercises) cards[`x:${l.id}:${e.id}`] = card(NOW + DAY, 5 + l.order);
  }
  return { version: 4, settings: { dailyReviewCap: 60 }, progress: { lessons, run: null, script: {} }, srs: { decks: { main: { cards }, script: { cards: { 's:l:alif:sound': card(NOW, 3) } } } }, stats: {}, meta: {}, flags: [], userContent: { words: [] } };
}

test('no card is ever deleted, and every stored FSRS value survives, for every fixture', () => {
  for (const fixture of fixtures()) {
    const out = migrate(fixture);
    for (const deck of ['main', 'script']) {
      for (const [id, before] of Object.entries(fixture.srs.decks[deck].cards)) {
        const after = out.srs.decks[deck].cards[id];
        assert.ok(after, `${fixture.version}: ${deck} ${id} is gone`);
        for (const [k, v] of Object.entries(before)) assert.deepEqual(after[k], v, `${fixture.version}: ${id}.${k}`);
      }
    }
  }
});

test('a real device: each word gets a main card carrying its production card’s state', () => {
  const before = phoneV4();
  const out = migrate(before);
  const cards = out.srs.decks.main.cards;
  const content = realContent();
  const v4Words = v4Lessons(content).flatMap((l) => l.new_vocab).map((id) => content.getWord(id));
  assert.equal(Object.keys(cards).length, Object.keys(before.srs.decks.main.cards).length + v4Words.length);
  for (const w of v4Words) {
    const prod = before.srs.decks.main.cards[`w:${w.id}:${w.pos === 'phrase' ? 'situation_to_phrase' : 'meaning_en_ur'}`];
    assert.deepEqual(cards[`w:${w.id}:main`], prod, w.id);
    assert.equal(cards[`w:${w.id}:meaning_ur_en`].retired, true, w.id);
    assert.equal(cards[`w:${w.id}:${w.pos === 'phrase' ? 'situation_to_phrase' : 'meaning_en_ur'}`].retired, true, w.id);
  }
});

test('a real device: flagged exercises keep their cards untouched, the others are retired', () => {
  const before = phoneV4();
  const cards = migrate(before).srs.decks.main.cards;
  let kept = 0;
  for (const l of v4Lessons(realContent())) {
    for (const e of l.exercises) {
      const id = `x:${l.id}:${e.id}`;
      if (e.sentence_card) {
        assert.deepEqual(cards[id], before.srs.decks.main.cards[id], id);
        kept++;
      } else assert.equal(cards[id].retired, true, id);
    }
  }
  assert.equal(kept, 15);
});

test('after migrating, the queue shows only main cards and sentence cards', () => {
  const data = migrate(phoneV4());
  const content = realContent();
  const cards = data.srs.decks.main.cards;
  const due = dueInPriorityOrder(cards, NOW + 400 * DAY, { isReviewable: (id) => isReviewable(id, content) });
  assert.equal(due.length, v4Lessons(content).flatMap((l) => l.new_vocab).length + 15);
  for (const id of due) assert.ok(/:main$/.test(id) || id.startsWith('x:'), id);
  const q = buildQueue({ cards, now: NOW + 400 * DAY, cap: 35, isReviewable: (id) => isReviewable(id, content), lessonOf: (id) => lessonOfCard(id, content) });
  assert.equal(q.queue.length, 35);
});

test('the v5 frozen list matches the sentence_card flags in lessons 1–5', () => {
  // Migration uses a frozen list; this catches the two drifting apart while lessons 1–5 are still the only ones shipped.
  const before = phoneV4();
  const cards = migrate(before).srs.decks.main.cards;
  for (const l of realContent().lessons.filter((x) => x.order <= 5)) {
    for (const e of l.exercises) assert.equal(!!cards[`x:${l.id}:${e.id}`].retired, !e.sentence_card, `${l.id} ${e.id}`);
  }
});

test('a production card that was never reviewed gives way to a recognition card that was', () => {
  const blob = { version: 4, settings: {}, srs: { decks: { main: { cards: { 'w:a:meaning_en_ur': card(NOW, 0, 0, { r: 0 }), 'w:a:meaning_ur_en': card(NOW + DAY, 9) } } } } };
  assert.equal(migrate(blob).srs.decks.main.cards['w:a:main'].s, 9);
});

test('a word with only one old card still gets a main card; gender and takes_ne cards retire without creating one', () => {
  const blob = { version: 4, settings: {}, srs: { decks: { main: { cards: { 'w:a:meaning_ur_en': card(NOW, 4), 'w:n:gender': card(NOW, 8), 'w:v:takes_ne': card(NOW, 8), 'w:v:perfective': card(NOW, 7) } } } } };
  const cards = migrate(blob).srs.decks.main.cards;
  assert.equal(cards['w:a:main'].s, 4);
  assert.equal(cards['w:n:gender'].retired, true);
  assert.equal(cards['w:n:main'], undefined, 'no state to carry from a gender card');
  assert.equal(cards['w:v:takes_ne'].retired, true);
  assert.equal(cards['w:v:main'], undefined);
  assert.equal(cards['w:v:perfective'].retired, undefined, 'perfective cards are kept');
});

test('an existing main card is never overwritten', () => {
  const main = card(NOW, 30);
  const blob = { version: 4, settings: {}, srs: { decks: { main: { cards: { 'w:a:main': main, 'w:a:meaning_en_ur': card(NOW, 2) } } } } };
  assert.deepEqual(migrate(blob).srs.decks.main.cards['w:a:main'], main);
});

test('migrating twice changes nothing more', () => {
  const once = migrate(phoneV4());
  const twice = MIGRATIONS[4](JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice.srs, once.srs);
});

test('the daily cap moves only from the old default', () => {
  assert.equal(migrate({ version: 4, settings: { dailyReviewCap: 60 } }).settings.dailyReviewCap, 35);
  assert.equal(migrate({ version: 4, settings: { dailyReviewCap: 45 } }).settings.dailyReviewCap, 45);
  assert.equal(migrate({ version: 4, settings: {} }).settings.dailyReviewCap, 35, 'missing: the default');
});

test('the memory target starts at relaxed and a saved one is kept', () => {
  assert.equal(migrate({ version: 4, settings: {} }).settings.memoryTarget, 'relaxed');
  assert.equal(migrate({ version: 4, settings: { memoryTarget: 'strong' } }).settings.memoryTarget, 'strong');
  for (const f of fixtures()) assert.ok(['relaxed', 'balanced', 'strong'].includes(migrate(f).settings.memoryTarget), `v${f.version}`);
});

test('exercises in lessons the migration does not know about are left alone', () => {
  const later = card(NOW, 3);
  const blob = { version: 4, settings: {}, srs: { decks: { main: { cards: { 'x:lesson-006:e01': later } } } } };
  assert.deepEqual(migrate(blob).srs.decks.main.cards['x:lesson-006:e01'], later);
});

test('a device on v4 loads with a pre-migration snapshot of its old cards', () => {
  const v4 = phoneV4();
  const backend = memoryStorage({ initial: { [DATA_KEY]: JSON.stringify(v4) } });
  const store = createStore({ backend: () => backend });
  assert.equal(store.status().mode, 'ok');
  assert.equal(store.data.version, STORAGE_VERSION);
  const snap = JSON.parse(backend.getItem(SNAPSHOTS_KEY)).find((s) => s.reason === 'pre-migration');
  assert.ok(snap);
  assert.deepEqual(snap.data.srs, v4.srs, 'the snapshot holds the old cards exactly');
});
