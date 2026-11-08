// Games core (Phase 4c): the pool, game credit guards, round records, clocks, English matching, match boards, stats numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultData } from '../src/db/storage.js';
import { syncDeck } from '../src/srs/deck.js';
import { CARD_STATE } from '../src/srs/fsrs.js';
import { realContent } from './helpers/realContent.js';
import { wordPool, sentencePool, sampleWeighted, itemStream, weightOf, unlocksAfterLesson, RECENT_DAYS } from '../src/games/pool.js';
import { applyAnswer, recordRound, bestOf } from '../src/games/outcome.js';
import { createClock, remaining, pause, resume, isOver, answerPoints, sentencePoints } from '../src/games/round.js';
import { isMeaningRight, acceptedMeanings } from '../src/games/englishMatch.js';
import { makeBoard, BOARD_SIZE } from '../src/games/matchBoard.js';
import { reviewsPerDay, accuracyTrend, wordsOverTime, unitProgress, lastDays } from '../src/games/history.js';
import { studyDay } from '../src/db/day.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-10T12:00:00Z');
const content = realContent();

/** A device that has finished the first `n` lessons (cards created by the real syncDeck). */
function deviceAfter(n, { at = NOW - 30 * DAY } = {}) {
  const data = defaultData(at);
  for (const l of content.lessons.slice(0, n)) data.progress.lessons[l.id] = { firstCompletedAt: at, lastCompletedAt: at, timesCompleted: 1, knownWordIds: [] };
  syncDeck(data, content, at);
  return data;
}
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- the pool

test('the word pool holds only words from completed lessons, never retired ones', () => {
  const data = deviceAfter(2);
  const pool = wordPool(data, content, NOW);
  const lessonIds = new Set(content.lessons.slice(0, 2).map((l) => l.id));
  assert.ok(pool.length > 0);
  assert.ok(pool.every((p) => lessonIds.has(p.word.introduced_in)));
  assert.equal(wordPool(deviceAfter(0), content, NOW).length, 0);

  // a retired word, or a retired card, drops out
  const w = pool[0];
  data.srs.decks.main.cards[w.cardId].retired = true;
  assert.ok(!wordPool(data, content, NOW).some((p) => p.id === w.id));
});

test('weights follow PLAN §8: (1 - R) * 3, +2 weak, +1.5 recent', () => {
  assert.equal(weightOf({ r: 1, weak: false, recent: false }), 0.1, 'never zero');
  assert.equal(weightOf({ r: 0.5, weak: false, recent: false }), 1.5);
  assert.equal(weightOf({ r: 0.5, weak: true, recent: false }), 3.5);
  assert.equal(weightOf({ r: 0.5, weak: true, recent: true }), 5);
});

test('weak and recently learned words are weighted higher', () => {
  const old = deviceAfter(1, { at: NOW - 60 * DAY });
  const base = wordPool(old, content, NOW);
  const target = base[0];
  old.srs.decks.main.cards[target.cardId].weak = NOW;
  const flagged = wordPool(old, content, NOW).find((p) => p.id === target.id);
  assert.ok(flagged.weight >= target.weight + 2 - 1e-9);

  const fresh = deviceAfter(1, { at: NOW - 2 * DAY });
  assert.ok(wordPool(fresh, content, NOW).every((p) => p.recent));
  assert.ok(wordPool(deviceAfter(1, { at: NOW - (RECENT_DAYS + 2) * DAY }), content, NOW).every((p) => !p.recent));
});

test('weighted sampling is without replacement and favours heavy items', () => {
  const items = [{ k: 'a', weight: 0.1 }, { k: 'b', weight: 0.1 }, { k: 'c', weight: 50 }];
  assert.equal(new Set(sampleWeighted(items, 3, seeded(3)).map((i) => i.k)).size, 3);
  let first = 0;
  for (let s = 1; s <= 200; s++) if (sampleWeighted(items, 1, seeded(s))[0].k === 'c') first++;
  assert.ok(first > 180, `heavy item first ${first}/200`);
});

test('the item stream never repeats the item just shown', () => {
  const next = itemStream([{ k: 1, weight: 1 }, { k: 2, weight: 1 }, { k: 3, weight: 1 }], seeded(7));
  let last = null;
  for (let i = 0; i < 60; i++) {
    const it = next();
    assert.notEqual(it, last);
    last = it;
  }
});

test('the sentence pool: short reorder exercises of completed lessons, in the learner\'s gender', () => {
  const data = deviceAfter(5);
  const pool = sentencePool(data, content, NOW);
  assert.ok(pool.length >= 5);
  assert.ok(pool.every((p) => p.exercise.type === 'reorder' && p.exercise.tokens.length >= 3 && p.exercise.tokens.length <= 8));
  assert.ok(pool.some((p) => p.cardId), 'sentence cards carry their card');
  assert.ok(pool.some((p) => !p.cardId), 'plain lesson exercises are included without one');
  assert.ok(sentencePool(deviceAfter(1), content, NOW).every((p) => p.lessonId === 'lesson-001'));
});

test('unlocksAfterLesson finds the first lesson that makes the pool big enough', () => {
  const count = (done) => sentencePool({ ...deviceAfter(0), progress: { lessons: Object.fromEntries([...done].map((id) => [id, { firstCompletedAt: NOW }])) }, srs: { decks: { main: { cards: {} } } }, settings: { learnerGender: null } }, content, NOW).length;
  assert.equal(unlocksAfterLesson(content, count, 3), 1, 'lesson 1 has practice sentences (D36), so it unlocks after the first lesson');
  assert.equal(unlocksAfterLesson(content, count, 999), null);
});

// ---------------------------------------------------------------- game credit

/** A device whose first word card is a Review card due now. */
function dueDevice() {
  const data = deviceAfter(1);
  const [id] = Object.keys(data.srs.decks.main.cards).filter((i) => i.startsWith('w:'));
  data.srs.decks.main.cards[id] = { due: NOW - DAY, s: 8, d: 5, st: CARD_STATE.review, r: 3, l: 0, lr: NOW - 9 * DAY, sd: 9, ls: 0, f: 'typed' };
  return { data, id };
}

test('a correct recall answer on a due Review card counts as one Good review, once per day', () => {
  const { data, id } = dueDevice();
  const before = data.stats.days[studyDay(NOW)]?.reviews ?? 0;
  const first = applyAnswer(data, { cardId: id, correct: true, format: 'speed_recall', now: NOW });
  assert.deepEqual(first, { credited: true, weak: false });
  const card = data.srs.decks.main.cards[id];
  assert.equal(card.gc, studyDay(NOW));
  assert.ok(card.due > NOW + DAY, 'rescheduled further out');
  assert.equal(card.f, 'typed', 'the format last shown is kept');
  assert.equal(data.stats.days[studyDay(NOW)].reviews, before + 1);
  assert.equal(data.stats.days[studyDay(NOW)].correct, 1);

  const snapshot = JSON.stringify(card);
  const again = applyAnswer(data, { cardId: id, correct: true, format: 'listening', now: NOW + 1000 });
  assert.equal(again.credited, false, 'second credit the same day');
  assert.equal(JSON.stringify(data.srs.decks.main.cards[id]), snapshot, 'and nothing changes');
});

test('option-picking and tile formats never earn credit, Match pairs and Sentence sprint included', () => {
  for (const format of ['tiles', 'match', 'choice', 'multiple-choice']) {
    const { data, id } = dueDevice();
    const snapshot = JSON.stringify(data.srs.decks.main.cards[id]);
    assert.equal(applyAnswer(data, { cardId: id, correct: true, format, now: NOW }).credited, false, format);
    assert.equal(JSON.stringify(data.srs.decks.main.cards[id]), snapshot, `${format}: card untouched`);
  }
});

test('a correct answer that fails a guard changes nothing (not due, not Review state, retired)', () => {
  const { data, id } = dueDevice();
  const cards = data.srs.decks.main.cards;
  for (const patch of [{ due: NOW + 6 * DAY }, { st: CARD_STATE.learning }, { retired: true }]) {
    const saved = { ...cards[id] };
    cards[id] = { ...saved, ...patch };
    const snapshot = JSON.stringify(cards[id]);
    assert.equal(applyAnswer(data, { cardId: id, correct: true, format: 'speed_recall', now: NOW }).credited, false, JSON.stringify(patch));
    assert.equal(JSON.stringify(cards[id]), snapshot);
    cards[id] = saved;
  }
});

test('a wrong answer marks the card weak and never pushes it later', () => {
  const { data, id } = dueDevice();
  const cards = data.srs.decks.main.cards;
  cards[id] = { ...cards[id], due: NOW + 20 * DAY, lr: NOW - 10 * DAY, sd: 30 };
  const out = applyAnswer(data, { cardId: id, correct: false, format: 'speed_recall', now: NOW });
  assert.deepEqual(out, { credited: false, weak: true });
  assert.equal(cards[id].weak, NOW);
  assert.ok(cards[id].due < NOW + DAY, 'far-off card comes back today');
  assert.equal(cards[id].st, CARD_STATE.review, 'the scheduler is not called');
  assert.equal(cards[id].s, 8, 'stability unchanged');
  // a wrong answer already due soon: due date untouched
  const soon = { ...cards[id], weak: undefined, due: NOW - DAY };
  cards[id] = soon;
  applyAnswer(data, { cardId: id, correct: false, format: 'listening', now: NOW });
  assert.equal(cards[id].due, NOW - DAY);
});

test('no card, no change; the game never creates cards', () => {
  const data = deviceAfter(1);
  const n = Object.keys(data.srs.decks.main.cards).length;
  assert.deepEqual(applyAnswer(data, { cardId: null, correct: false, format: 'tiles', now: NOW }), { credited: false, weak: false });
  assert.deepEqual(applyAnswer(data, { cardId: 'w:not-a-word:main', correct: false, format: 'speed_recall', now: NOW }), { credited: false, weak: false });
  assert.equal(Object.keys(data.srs.decks.main.cards).length, n);
});

// ---------------------------------------------------------------- personal bests

test('the first round sets the score to beat; only a higher score is a new personal best', () => {
  const data = defaultData(NOW);
  const r1 = recordRound(data, { gameId: 'speed-recall', score: 100, correct: 8, total: 10, now: NOW });
  assert.deepEqual([r1.first, r1.isBest, r1.best], [true, false, 100]);
  const r2 = recordRound(data, { gameId: 'speed-recall', score: 100, correct: 9, total: 10, now: NOW });
  assert.deepEqual([r2.first, r2.isBest, r2.previousBest], [false, false, 100], 'a tie is not a record');
  const r3 = recordRound(data, { gameId: 'speed-recall', score: 130, correct: 10, total: 11, now: NOW });
  assert.deepEqual([r3.isBest, r3.previousBest, r3.best], [true, 100, 130]);
  recordRound(data, { gameId: 'speed-recall', score: 50, correct: 4, total: 9, now: NOW });
  const b = bestOf(data, 'speed-recall');
  assert.equal(b.best, 130);
  assert.equal(b.rounds, 4);
  assert.deepEqual(b.last, { score: 50, correct: 4, total: 9, day: studyDay(NOW) });
  assert.equal(data.stats.days[studyDay(NOW)].games, 4);
  assert.equal(bestOf(data, 'listen-type'), null);
});

test('a personal best an older build stored as a bare number still counts', () => {
  const data = defaultData(NOW);
  data.stats.gameBests['match-pairs'] = 11;
  assert.equal(bestOf(data, 'match-pairs').best, 11);
  const r = recordRound(data, { gameId: 'match-pairs', score: 12, correct: 1, total: 1, now: NOW });
  assert.deepEqual([r.isBest, r.previousBest], [true, 11]);
});

// ---------------------------------------------------------------- clock and scoring

test('the clock counts down and can be paused', () => {
  const c = createClock(90000, 1000);
  assert.equal(remaining(c, 1000), 90000);
  assert.equal(remaining(c, 31000), 60000);
  pause(c, 31000);
  assert.equal(remaining(c, 61000), 60000, 'paused time does not count');
  resume(c, 61000);
  assert.equal(remaining(c, 71000), 50000);
  assert.equal(isOver(c, 1000 + 30000 + 90000 + 1), true);
  assert.equal(remaining(c, 1e12), 0);
});

test('faster answers score more, between 10 and 15', () => {
  assert.equal(answerPoints(1000), 15);
  assert.equal(answerPoints(20000), 10);
  const mid = answerPoints(6000);
  assert.ok(mid > 10 && mid < 15);
  assert.ok(sentencePoints(6) > sentencePoints(3));
});

// ---------------------------------------------------------------- English meanings

test('typed meanings: any listed meaning, optional "to", brackets ignored, one typo allowed', () => {
  assert.equal(isMeaningRight('Home', 'house, home'), true);
  assert.equal(isMeaningRight('house', 'house, home'), true);
  assert.equal(isMeaningRight('go', 'to go'), true);
  assert.equal(isMeaningRight('to go', 'to go'), true);
  assert.equal(isMeaningRight('how are you', 'how are you? (polite)'), true);
  assert.equal(isMeaningRight('how are you?', 'how are you? (polite)'), true);
  assert.equal(isMeaningRight('housse', 'house, home'), true, 'a typo in a 5-letter word');
  assert.equal(isMeaningRight('hous', 'house, home'), false, 'too short to forgive');
  assert.equal(isMeaningRight('mother', 'father'), false);
  assert.equal(isMeaningRight('', 'father'), false);
  assert.ok(acceptedMeanings('thank you').includes('thank you'));
});

// ---------------------------------------------------------------- match boards

test('a board has six pairs with different meanings, both sides shuffled', () => {
  const pool = wordPool(deviceAfter(3), content, NOW);
  const board = makeBoard(pool, seeded(5));
  assert.equal(board.pairs.length, BOARD_SIZE);
  assert.equal(new Set(board.pairs.map((p) => p.word.meaning_en)).size, BOARD_SIZE);
  const ids = (l) => l.map((p) => p.id).sort();
  assert.deepEqual(ids(board.left), ids(board.pairs));
  assert.deepEqual(ids(board.right), ids(board.pairs));
  assert.equal(makeBoard(pool.slice(0, 5), seeded(5)), null, 'not enough words for a board');
});

// ---------------------------------------------------------------- stats numbers

test('reviews per day, and accuracy over a rolling week that skips days with no record', () => {
  const data = defaultData(NOW);
  const end = studyDay(NOW);
  const days = lastDays(end, 10);
  assert.equal(days.length, 10);
  assert.equal(days.at(-1), end);
  days.forEach((d, i) => (data.stats.days[d] = { reviews: 10, correct: i < 3 ? null : 8, games: 0 }));
  assert.deepEqual(reviewsPerDay(data, end, 3).map((x) => x.value), [10, 10, 10]);
  const acc = accuracyTrend(data, end, 4, 7);
  assert.equal(acc.length, 4);
  assert.ok(Math.abs(acc.at(-1).value - 0.8) < 1e-9, 'old null days are left out of both sides');
  assert.equal(accuracyTrend(defaultData(NOW), end, 5).every((x) => x.value === null), true, 'nothing recorded, nothing invented');
});

test('words learned over time counts a lesson on the day it was first completed', () => {
  const data = deviceAfter(2, { at: NOW - 5 * DAY });
  const series = wordsOverTime(data, content, studyDay(NOW), 10);
  const total = content.lessons.slice(0, 2).reduce((a, l) => a + l.new_vocab.length, 0);
  assert.equal(series.at(-1).value, total);
  assert.equal(series[0].value, 0);
  assert.ok(series.every((p, i) => i === 0 || p.value >= series[i - 1].value));
});

test('unit progress: lessons and words done out of the total', () => {
  const data = deviceAfter(3);
  const [u1] = unitProgress(data, content);
  assert.equal(u1.lessonsDone, 3);
  assert.ok(u1.lessonsTotal >= 3);
  assert.ok(u1.wordsLearned > 0 && u1.wordsLearned <= u1.wordsTotal);
  assert.equal(u1.wordsStrong, 0, 'brand-new cards are not yet well held');
});

// ---------------------------------------------------------------- hygiene

test('games read plurals only through nounPlural() (PLAN D26)', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const files = [...walk(join(root, 'games')), ...walk(join(root, 'modules', 'games'))].filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 5);
  const bad = files.filter((f) => /\.plural\b|oblique_pl|\.plural_/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepEqual(bad, []);
});

test('noWeak: a miss changes nothing (Listen & type, meaning mode)', () => {
  const { data, id } = dueDevice();
  const before = JSON.stringify(data.srs.decks.main.cards[id]);
  const out = applyAnswer(data, { cardId: id, correct: false, format: 'listening', now: NOW, noWeak: true });
  assert.deepEqual(out, { credited: false, weak: false });
  assert.equal(JSON.stringify(data.srs.decks.main.cards[id]), before);
  assert.equal(applyAnswer(data, { cardId: id, correct: false, format: 'listening', now: NOW }).weak, true);
});

test('a completed round extends the streak (D35)', () => {
  const data = deviceAfter(1);
  data.stats.streak = 0;
  recordRound(data, { gameId: 'speed-recall', score: 50, correct: 5, total: 6, now: NOW });
  assert.equal(data.stats.streak, 1);
  assert.equal(data.stats.lastStudyDay, studyDay(NOW, data.settings.dayRolloverHour));
});
