import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createEngine, GRADE, CARD_STATE, RETENTION, formatInterval, markWeak, isProductionFacet } from '../src/srs/fsrs.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T10:00:00Z');
const e = await createEngine({ fuzz: false });

test('a new card is due now, in the New state', () => {
  const c = e.newCard(NOW);
  assert.equal(c.st, CARD_STATE.new);
  assert.equal(c.due, NOW);
  assert.equal(c.lr, null);
  assert.deepEqual(Object.keys(c).sort(), ['d', 'due', 'l', 'lr', 'ls', 'r', 's', 'sd', 'st']);
});

test('buttons preview increasing intervals: Again < Hard < Good < Easy', () => {
  const p = e.preview(e.newCard(NOW), 'meaning_ur_en', NOW);
  const ms = [1, 2, 3, 4].map((g) => p[g].ms);
  assert.deepEqual([...ms].sort((a, b) => a - b), ms);
  assert.ok(ms[0] < 5 * 60000, 'Again is a few minutes at most');
  assert.ok(ms[3] >= 7 * DAY, 'Easy on a new card is days away');
});

test('preview does not change the card, and review returns a new card', () => {
  const c = e.newCard(NOW);
  const copy = JSON.stringify(c);
  e.preview(c, 'meaning_ur_en', NOW);
  const r = e.review(c, 'meaning_ur_en', GRADE.good, NOW);
  assert.equal(JSON.stringify(c), copy);
  assert.notEqual(r, c);
});

test('the interval a button shows is exactly what grading it schedules', () => {
  const c = e.review(e.newCard(NOW), 'meaning_en_ur', GRADE.easy, NOW - 30 * DAY);
  for (const g of [1, 2, 3, 4]) {
    const shown = e.preview(c, 'meaning_en_ur', NOW)[g].due;
    assert.equal(e.review(c, 'meaning_en_ur', g, NOW).due, shown);
  }
});

test('Again on a Review card lapses it into Relearning with a short step', () => {
  let c = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.easy, NOW - 20 * DAY);
  assert.equal(c.st, CARD_STATE.review);
  c = e.review(c, 'meaning_ur_en', GRADE.again, NOW);
  assert.equal(c.st, CARD_STATE.relearning);
  assert.equal(c.l, 1);
  assert.ok(c.due - NOW < 30 * 60000);
});

test('two schedulers: production facets get the shorter intervals (0.90 vs 0.85 retention)', () => {
  assert.equal(RETENTION.production, 0.9);
  assert.equal(RETENTION.recognition, 0.85);
  assert.ok(isProductionFacet('meaning_en_ur') && isProductionFacet('situation_to_phrase'));
  assert.ok(!isProductionFacet('meaning_ur_en') && !isProductionFacet('gender'));
  let rec = e.newCard(NOW);
  let prod = e.newCard(NOW);
  for (let i = 0; i < 3; i++) {
    rec = e.review(rec, 'meaning_ur_en', GRADE.good, NOW + i * 10 * DAY);
    prod = e.review(prod, 'meaning_en_ur', GRADE.good, NOW + i * 10 * DAY);
  }
  assert.ok(prod.due < rec.due, 'production comes back sooner');
});

test('retrievability: 0 for New, falls over time, is between 0 and 1', () => {
  assert.equal(e.retrievability(e.newCard(NOW), 'meaning_ur_en', NOW), 0);
  const c = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.good, NOW - 10 * DAY);
  const soon = e.retrievability(c, 'meaning_ur_en', c.lr + DAY);
  const later = e.retrievability(c, 'meaning_ur_en', c.lr + 60 * DAY);
  assert.ok(soon > later && soon <= 1 && later >= 0);
});

test('"I already know this": first interval of roughly 1-4 weeks, in the Review state', () => {
  for (const facet of ['meaning_ur_en', 'meaning_en_ur', 'gender']) {
    const k = e.alreadyKnow(e.newCard(NOW), facet, NOW);
    const days = (k.due - NOW) / DAY;
    assert.equal(k.st, CARD_STATE.review, facet);
    assert.ok(days >= 7 && days <= 30, `${facet}: ${days} days`);
    assert.equal(k.r, 2);
  }
  const plain = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.good, NOW);
  assert.ok(e.alreadyKnow(e.newCard(NOW), 'meaning_ur_en', NOW).due > plain.due);
});

test('fuzz is on by default and still stays near the unfuzzed interval', async () => {
  const fuzzy = await createEngine();
  const c = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.easy, NOW - 30 * DAY);
  const base = e.preview(c, 'meaning_ur_en', NOW)[3].ms;
  const got = fuzzy.preview(c, 'meaning_ur_en', NOW)[3].ms;
  assert.ok(Math.abs(got - base) / base < 0.3);
});

test('a real review clears the game "weak" mark; markWeak never pushes a due date later', () => {
  let c = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.easy, NOW - 3 * DAY);
  assert.ok(c.due > NOW + DAY);
  const dayEnd = NOW + 6 * 3600000;
  const w = markWeak(c, NOW, dayEnd);
  assert.equal(w.weak, NOW);
  assert.equal(w.due, dayEnd, 'pulled back to the end of today');
  assert.equal(c.weak, undefined, 'input not mutated');
  const due = e.newCard(NOW);
  assert.equal(markWeak(due, NOW, dayEnd).due, due.due, 'an already-due card is not moved');
  assert.equal(e.review(w, 'meaning_ur_en', GRADE.good, NOW).weak, undefined);
});

test('formatInterval is Anki-style', () => {
  const m = 60000;
  const cases = [[10000, '<1m'], [m, '1m'], [10 * m, '10m'], [59 * m, '59m'], [60 * m, '1h'], [5 * 60 * m, '5h'], [DAY, '1d'], [9 * DAY, '9d'], [30 * DAY, '30d'], [74 * DAY, '2.4mo'], [400 * DAY, '1.1y']];
  for (const [ms, label] of cases) assert.equal(formatInterval(ms), label);
});

test('invalid grades are rejected', () => {
  assert.throws(() => e.review(e.newCard(NOW), 'meaning_ur_en', 7, NOW));
});

// ---- the stored card shape and the library upgrade ----

const GRADES_ALL = [1, 2, 3, 4];
const SHAPE = ['d', 'due', 'l', 'lr', 'ls', 'r', 's', 'sd', 'st'];
const keysOf = (c) => Object.keys(c).filter((k) => k !== 'weak').sort();

test('stored shape is unchanged: every card the engine returns has exactly the compact keys', () => {
  let c = e.newCard(NOW);
  assert.deepEqual(keysOf(c), SHAPE);
  for (const g of [GRADE.good, GRADE.again, GRADE.good, GRADE.easy]) {
    c = e.review(c, 'meaning_ur_en', g, NOW);
    assert.deepEqual(keysOf(c), SHAPE);
    for (const k of SHAPE) assert.ok(k === 'lr' && c[k] === null ? false : Number.isFinite(c[k]), k);
  }
  assert.ok(Object.values(e.alreadyKnow(e.newCard(NOW), 'gender', NOW)).every((v) => v === null || Number.isFinite(v)));
});

test('cards saved by the previous (classic API) build still load and schedule, with the same results', () => {
  // Captured from the classic fsrs()/repeat() build before the switch (fuzz off, facet meaning_ur_en).
  const learning = { due: 1790158200000, s: 2.3065, d: 2.11810397, st: 1, r: 1, l: 0, lr: 1790157600000, sd: 0, ls: 1 };
  const at = learning.due; // the moment the card came up for review
  assert.deepEqual([1, 2, 3, 4].map((g) => e.preview(learning, 'meaning_ur_en', at)[g].due), [1790158260000, 1790158530000, 1790503800000, 1790849400000]);
  assert.equal(e.retrievability(learning, 'meaning_ur_en', at + 3 * DAY), 0.88094796);
  assert.deepEqual(e.alreadyKnow(e.newCard(NOW), 'meaning_ur_en', NOW), { due: 1795773660000, s: 13.04606469, d: 1, st: 2, r: 2, l: 0, lr: 1793613660000, sd: 25, ls: 0 });
});

test('every card in the v1 storage fixture (a saved device) previews and reviews, in every state', () => {
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/storage-v1.json', import.meta.url)), 'utf8'));
  const cards = Object.entries(fixture.srs.decks.main.cards);
  assert.ok(cards.length >= 3);
  const states = new Set(cards.map(([, c]) => c.st));
  assert.ok(states.size >= 2, 'fixture covers more than one state');
  for (const [id, card] of cards) {
    const facet = id.split(':')[2];
    const now = card.lr + 2 * DAY;
    const p = e.preview(card, facet, now, id);
    for (const g of GRADES_ALL) {
      assert.ok(p[g].due >= now, `${id} grade ${g}`);
      const next = e.review(card, facet, g, now, id);
      assert.deepEqual(keysOf(next), SHAPE, id);
      assert.equal(next.due, p[g].due, `${id}: the shown interval is what grading does`);
      assert.equal(next.r, card.r + 1);
      assert.equal(next.weak, undefined, 'a real review clears weak');
    }
  }
});

test('the card id seeds fuzz: different cards spread out, the same card is stable', async () => {
  const fuzzy = await createEngine();
  const c = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.easy, NOW - 60 * DAY);
  const dueFor = (id) => fuzzy.review(c, 'meaning_ur_en', GRADE.good, NOW, id).due;
  const ids = Array.from({ length: 20 }, (_, i) => `w:word${i}:meaning_ur_en`);
  assert.ok(new Set(ids.map(dueFor)).size > 3, 'not clumped on one day');
  assert.equal(dueFor(ids[0]), dueFor(ids[0]));
});
