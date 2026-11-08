import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.TZ = 'Europe/London';
const { buildQueue, dueInPriorityOrder, spaceSiblings, pickVaried, insertSpaced, studyDayEnd } = await import('../src/srs/queue.js');
const { createEngine, GRADE, CARD_STATE } = await import('../src/srs/fsrs.js');
const { createSession, nextCard, afterGrade, releaseWaiting, remaining } = await import('../src/srs/session.js');
const { recordReview, reviewsDoneToday, touchStreak } = await import('../src/srs/stats.js');
const { itemKey } = await import('../src/srs/facets.js');
const { defaultData } = await import('../src/db/storage.js');

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T10:00:00Z'); // 10:00 GMT, study day 2026-11-02
const e = await createEngine({ fuzz: false });

/** A Review card last reviewed `ageDays` ago with the given stability, so its retrievability is knowable. */
function reviewCard(stabilityDays, overdueDays, extra = {}) {
  const base = e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.good, NOW - 100 * DAY);
  const lr = NOW - (stabilityDays + overdueDays) * DAY;
  return { ...base, s: stabilityDays, sd: stabilityDays, ls: 0, lr, due: lr + stabilityDays * DAY, st: CARD_STATE.review, ...extra };
}
const deck = (n, make) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`w:word${String(i).padStart(3, '0')}:meaning_ur_en`, make(i)]));

test('the study day ends at the next 04:00 local time', () => {
  assert.equal(studyDayEnd(NOW), Date.parse('2026-11-03T04:00:00Z'));
  assert.equal(studyDayEnd(Date.parse('2026-11-03T02:00:00Z')), Date.parse('2026-11-03T04:00:00Z'), '02:00 still belongs to the previous day');
  // BST: 04:00 local is 03:00Z
  assert.equal(studyDayEnd(Date.parse('2026-07-01T10:00:00Z')), Date.parse('2026-07-02T03:00:00Z'));
});

test('due means before the end of the study day, so cards due later today are included', () => {
  const cards = {
    'w:a:meaning_ur_en': reviewCard(10, 1),
    'w:b:meaning_ur_en': { ...reviewCard(10, 0), due: NOW + 5 * 3600000 },
    'w:c:meaning_ur_en': { ...reviewCard(10, 0), due: studyDayEnd(NOW) + 1 },
  };
  assert.deepEqual(dueInPriorityOrder(cards, NOW).sort(), ['w:a:meaning_ur_en', 'w:b:meaning_ur_en']);
});

test('the script deck and unparseable ids never enter the main queue', () => {
  const cards = { 's:l:alif:sound': reviewCard(5, 3), 'junk': reviewCard(5, 3), 'w:a:meaning_ur_en': reviewCard(5, 3) };
  assert.deepEqual(dueInPriorityOrder(cards, NOW), ['w:a:meaning_ur_en']);
});

test('priority: Learning first, then the most-forgotten, with production and weak boosts', () => {
  const cards = {
    'w:fresh:meaning_ur_en': reviewCard(30, 1), // barely overdue → high retrievability
    'w:forgotten:meaning_ur_en': reviewCard(2, 60), // long overdue → low retrievability
    'w:learn:meaning_ur_en': { ...e.review(e.newCard(NOW), 'meaning_ur_en', GRADE.again, NOW - 600000) },
  };
  assert.deepEqual(dueInPriorityOrder(cards, NOW), ['w:learn:meaning_ur_en', 'w:forgotten:meaning_ur_en', 'w:fresh:meaning_ur_en']);

  // production facet outranks an otherwise identical recognition card
  const same = reviewCard(10, 10);
  const prod = dueInPriorityOrder({ 'w:x:meaning_ur_en': same, 'w:y:meaning_en_ur': same }, NOW);
  assert.equal(prod[0], 'w:y:meaning_en_ur');

  // weak boost: a weak card jumps ahead of one just slightly more forgotten
  const a = reviewCard(10, 10);
  const b = { ...reviewCard(10, 10.5) };
  assert.equal(dueInPriorityOrder({ 'w:a:meaning_ur_en': a, 'w:b:meaning_ur_en': b }, NOW)[0], 'w:b:meaning_ur_en');
  assert.equal(dueInPriorityOrder({ 'w:a:meaning_ur_en': { ...a, weak: NOW - 1000 }, 'w:b:meaning_ur_en': b }, NOW)[0], 'w:a:meaning_ur_en');
});

test('a New card (a freshly unlocked facet) is due and sits in the middle of the pack, not on top', () => {
  const cards = { 'w:new:gender': e.newCard(NOW), 'w:old:meaning_ur_en': reviewCard(2, 60), 'w:ok:meaning_ur_en': reviewCard(30, 0.2) };
  const order = dueInPriorityOrder(cards, NOW);
  assert.deepEqual(order, ['w:old:meaning_ur_en', 'w:new:gender', 'w:ok:meaning_ur_en']);
});

test('the daily cap limits the session; the rest stays due', () => {
  const cards = deck(200, (i) => reviewCard(5, 1 + i * 0.1));
  const q = buildQueue({ cards, now: NOW, cap: 60, doneToday: 0 });
  assert.equal(q.queue.length, 60);
  assert.equal(q.dueTotal, 200);
  assert.equal(q.held, 140);
  assert.equal(q.capRemaining, 60);
  assert.equal(q.catchUpDays, 4);
  assert.equal(q.catchUpMode, true, 'backlog above 2× the cap switches to catch-up (D7)');
});

test('reviews already done today use up the cap', () => {
  const cards = deck(100, () => reviewCard(5, 2));
  assert.equal(buildQueue({ cards, now: NOW, cap: 60, doneToday: 45 }).queue.length, 15);
  assert.equal(buildQueue({ cards, now: NOW, cap: 60, doneToday: 60 }).queue.length, 0);
  assert.equal(buildQueue({ cards, now: NOW, cap: 60, doneToday: 99 }).queue.length, 0);
  const small = buildQueue({ cards: deck(30, () => reviewCard(5, 2)), now: NOW, cap: 60 });
  assert.equal(small.catchUpMode, false);
  assert.equal(small.held, 0);
});

test('backlog spreading: the most-forgotten go first and the pile drains over several days', () => {
  // 150 cards of rising overdueness. Each simulated "day" the learner does the cap and grades Good.
  const cards = deck(150, (i) => reviewCard(5, 1 + i * 0.2));
  const cap = 60;
  const seen = new Set();
  const perDay = [];
  for (let day = 0; day < 6; day++) {
    const now = NOW + day * DAY;
    const q = buildQueue({ cards, now, cap, doneToday: 0 });
    perDay.push(q.queue.length);
    assert.ok(q.queue.length <= cap, `day ${day} within cap`);
    if (day === 0) {
      // the 60 most overdue (highest index) are taken first
      assert.ok(q.queue.every((id) => Number(id.slice(6, 9)) >= 90), 'most-forgotten first');
    }
    for (const id of q.queue) {
      assert.ok(!seen.has(id) || day > 0, 'no duplicates in a session');
      cards[id] = e.review(cards[id], 'meaning_ur_en', GRADE.good, now);
      seen.add(id);
    }
  }
  assert.deepEqual(perDay.slice(0, 3), [60, 60, 30], 'drained in 3 days at 60/day, never one big dump');
  assert.equal(seen.size, 150);
});

test('sibling spacing: facets of one word are never adjacent when avoidable', () => {
  const ids = ['w:a:meaning_ur_en', 'w:a:meaning_en_ur', 'w:a:gender', 'w:b:meaning_ur_en', 'w:b:meaning_en_ur', 'w:c:meaning_ur_en'];
  const spaced = spaceSiblings(ids);
  assert.deepEqual([...spaced].sort(), [...ids].sort());
  assert.notEqual(itemKey(spaced[0]), itemKey(spaced[1]));
  assert.notEqual(itemKey(spaced[1]), itemKey(spaced[2]));
  assert.notEqual(itemKey(spaced[2]), itemKey(spaced[3]));
  assert.equal(spaced[0], ids[0], 'priority order is kept where spacing allows');
});

test('sibling spacing: when only siblings remain they go to the end rather than being dropped', () => {
  const ids = ['w:a:meaning_ur_en', 'w:a:meaning_en_ur', 'w:a:gender'];
  assert.deepEqual(spaceSiblings(ids), ids);
  const mixed = spaceSiblings(['w:a:meaning_ur_en', 'w:a:meaning_en_ur', 'w:b:meaning_ur_en']);
  assert.deepEqual(mixed, ['w:a:meaning_ur_en', 'w:b:meaning_ur_en', 'w:a:meaning_en_ur']);
});

test('buildQueue output is spaced', () => {
  const cards = {};
  for (const w of ['a', 'b', 'c', 'd']) for (const f of ['meaning_ur_en', 'meaning_en_ur']) cards[`w:${w}:${f}`] = reviewCard(5, 3);
  const { queue } = buildQueue({ cards, now: NOW, cap: 60 });
  for (let i = 1; i < queue.length; i++) assert.notEqual(itemKey(queue[i]), itemKey(queue[i - 1]));
});

test('insertSpaced puts a card back a few places on, never beside its sibling', () => {
  const q = ['w:b:meaning_ur_en', 'w:a:gender', 'w:c:meaning_ur_en'];
  insertSpaced(q, 'w:a:meaning_en_ur', 1); // slot 1 would sit beside w:a:gender
  assert.deepEqual(q, ['w:b:meaning_ur_en', 'w:a:gender', 'w:c:meaning_ur_en', 'w:a:meaning_en_ur']);
  const empty = [];
  insertSpaced(empty, 'w:z:meaning_ur_en');
  assert.deepEqual(empty, ['w:z:meaning_ur_en']);
});

test('isReviewable filters out cards that cannot be shown', () => {
  const cards = { 'w:a:meaning_ur_en': reviewCard(5, 3), 'w:gone:meaning_ur_en': reviewCard(5, 3) };
  const q = buildQueue({ cards, now: NOW, cap: 60, isReviewable: (id) => !id.includes('gone') });
  assert.deepEqual(q.queue, ['w:a:meaning_ur_en']);
});

test('retired cards stay stored but never enter the queue', () => {
  const cards = { 'w:a:main': reviewCard(5, 3), 'w:a:meaning_ur_en': reviewCard(5, 3, { retired: true }) };
  const q = buildQueue({ cards, now: NOW, cap: 60 });
  assert.deepEqual(q.queue, ['w:a:main']);
  assert.equal(q.dueTotal, 1);
  assert.ok(cards['w:a:meaning_ur_en'], 'still there');
});

test('interleaving: cards of one lesson are spread apart when there are enough other lessons', () => {
  const lessonOf = (id) => (id.startsWith('x:') ? id.split(':')[1] : `l${id.split(':')[1][0]}`);
  const ids = ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'c1', 'c2', 'd1'].map((w) => `w:${w}:main`);
  const out = spaceSiblings(ids, { lessonOf });
  assert.deepEqual([...out].sort(), [...ids].sort(), 'nothing is lost');
  for (let i = 1; i < 4; i++) assert.notEqual(lessonOf(out[i]), lessonOf(out[i - 1]), `positions ${i - 1},${i}`);
});

test('interleaving: young and old cards are mixed', () => {
  const ids = ['w:y1:main', 'w:y2:main', 'w:o1:main', 'w:o2:main', 'w:y3:main', 'w:o3:main'];
  const out = spaceSiblings(ids, { isYoung: (id) => id.startsWith('w:y') });
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i][2], out[i - 1][2], `${out}`);
});

test('interleaving: exercises of one lesson are not adjacent, and no word repeats back to back', () => {
  const ids = ['x:lesson-001:e01', 'x:lesson-001:e02', 'w:a:main', 'w:a:perfective', 'w:b:main'];
  const out = spaceSiblings(ids);
  for (let i = 1; i < out.length; i++) assert.notEqual(itemKey(out[i]), itemKey(out[i - 1]));
});

test('the warm-up picker prefers different lessons and different formats', () => {
  const lessons = { 'w:a:main': 'l1', 'w:b:main': 'l1', 'w:c:main': 'l2', 'w:d:main': 'l3', 'w:e:main': 'l3' };
  const formats = { 'w:a:main': 'choice', 'w:b:main': 'choice', 'w:c:main': 'choice', 'w:d:main': 'typed', 'w:e:main': 'tiles' };
  const picked = pickVaried(Object.keys(lessons), 3, { lessonOf: (id) => lessons[id], formatOf: (id) => formats[id] });
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((id) => lessons[id])).size, 3, 'three lessons');
  assert.ok(new Set(picked.map((id) => formats[id])).size >= 2, 'more than one format');
  assert.deepEqual(pickVaried(['w:a:main'], 6), ['w:a:main'], 'never invents cards');
});

// ------------------------------------------------------------------ session

test('a session walks the queue; a card marked Again waits for its step instead of reappearing at once', () => {
  const s = createSession(['w:a:meaning_ur_en', 'w:b:meaning_ur_en']);
  assert.deepEqual(nextCard(s, NOW), { id: 'w:a:meaning_ur_en' });
  const lapsed = e.review(reviewCard(5, 1), 'meaning_ur_en', GRADE.again, NOW);
  afterGrade(s, 'w:a:meaning_ur_en', lapsed, { now: NOW });
  assert.deepEqual(nextCard(s, NOW), { id: 'w:b:meaning_ur_en' });
  afterGrade(s, 'w:b:meaning_ur_en', e.review(reviewCard(5, 1), 'meaning_ur_en', GRADE.good, NOW), { now: NOW });
  const wait = nextCard(s, NOW);
  assert.equal(wait.wait, lapsed.due);
  assert.deepEqual(nextCard(s, lapsed.due), { id: 'w:a:meaning_ur_en' }, 'comes back once its step has elapsed');
  assert.equal(s.reviewed, 2);
});

test('"study now" brings waiting cards forward; a finished session returns null', () => {
  const s = createSession(['w:a:meaning_ur_en']);
  nextCard(s, NOW);
  afterGrade(s, 'w:a:meaning_ur_en', e.review(reviewCard(5, 1), 'meaning_ur_en', GRADE.again, NOW), { now: NOW });
  assert.ok('wait' in nextCard(s, NOW));
  assert.equal(remaining(s), 1);
  releaseWaiting(s);
  assert.deepEqual(nextCard(s, NOW), { id: 'w:a:meaning_ur_en' });
  afterGrade(s, 'w:a:meaning_ur_en', e.review(reviewCard(5, 1), 'meaning_ur_en', GRADE.easy, NOW), { now: NOW });
  assert.equal(nextCard(s, NOW), null);
});

test('a card whose next due is days away leaves the session for good', () => {
  const s = createSession(['w:a:meaning_ur_en']);
  nextCard(s, NOW);
  afterGrade(s, 'w:a:meaning_ur_en', e.review(reviewCard(5, 1), 'meaning_ur_en', GRADE.good, NOW), { now: NOW });
  assert.equal(nextCard(s, NOW), null);
});

// ------------------------------------------------------------------ stats

test('recordReview counts toward the cap once per cycle, updates pace, and starts a streak', () => {
  const d = defaultData(NOW);
  recordReview(d, { now: NOW, previousState: CARD_STATE.review, seconds: 8 });
  recordReview(d, { now: NOW, previousState: CARD_STATE.learning, seconds: 5 }); // a learning step: not counted again
  recordReview(d, { now: NOW, previousState: CARD_STATE.new, seconds: 3 });
  assert.equal(reviewsDoneToday(d, NOW), 2);
  const day = d.stats.days['2026-11-02'];
  assert.equal(day.seconds, 16);
  assert.equal(day.lessons, 0, 'other counters exist and are zero');
  assert.equal(d.stats.streak, 1);
  assert.equal(d.stats.lastStudyDay, '2026-11-02');
  assert.notEqual(d.stats.pace.reviewSec, 10);
  assert.equal(reviewsDoneToday(d, NOW + DAY), 0, 'a new study day starts at zero');
});

test('review time is clamped so a forgotten tab does not wreck the pace estimate', () => {
  const d = defaultData(NOW);
  recordReview(d, { now: NOW, previousState: 2, seconds: 3600 });
  assert.ok(d.stats.pace.reviewSec <= 15);
  assert.ok(d.stats.days['2026-11-02'].seconds <= 60);
});

test('streak: consecutive days extend it, a gap restarts it, the best is kept', () => {
  const d = defaultData(NOW);
  touchStreak(d, '2026-11-01');
  touchStreak(d, '2026-11-01');
  touchStreak(d, '2026-11-02');
  touchStreak(d, '2026-11-03');
  assert.equal(d.stats.streak, 3);
  touchStreak(d, '2026-11-06');
  assert.equal(d.stats.streak, 1);
  assert.equal(d.stats.bestStreak, 3);
});

test('study-day rollover: a review at 01:00 counts toward the previous day', () => {
  const d = defaultData(NOW);
  recordReview(d, { now: Date.parse('2026-11-03T01:00:00Z'), previousState: 2 });
  assert.equal(d.stats.days['2026-11-02'].reviews, 1);
  assert.equal(d.stats.days['2026-11-03'], undefined);
});
