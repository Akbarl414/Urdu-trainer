import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.TZ = 'Europe/London';
const { planLesson, BUDGET_SEC } = await import('../src/lesson/planner.js');
const M = await import('../src/lesson/machine.js');
const { commitLesson, lessonGrades } = await import('../src/lesson/commit.js');
const { todayState, nextLesson, currentStreak } = await import('../src/lesson/path.js');
const { defaultData } = await import('../src/db/storage.js');
const { buildContentIndex } = await import('../src/db/contentIndex.js');
const { syncDeck } = await import('../src/srs/deck.js');
const { GRADE, CARD_STATE } = await import('../src/srs/fsrs.js');
const { realContent } = await import('./helpers/realContent.js');

const NOW = Date.parse('2026-11-02T10:00:00Z');
const DAY = '2026-11-02';
const content = realContent();
const lesson = content.getLesson('lesson-001');
const queueOf = (n) => Array.from({ length: n }, (_, i) => `w:due${i}:meaning_ur_en`);

// ---------------------------------------------------------------- planner

test('planner: with nothing due the warm-up is empty and practice keeps all 12 exercises', () => {
  const p = planLesson({ lesson, dueQueue: [], pace: {} });
  assert.equal(p.mode, 'normal');
  assert.deepEqual(p.warmup, []);
  assert.equal(p.exerciseIds.length, 12);
  assert.ok(p.estimateSec <= BUDGET_SEC);
});

test('planner: the warm-up fills the time that is left, and the total stays within about 15 minutes', () => {
  const p = planLesson({ lesson, dueQueue: queueOf(40), dueTotal: 40, pace: {} });
  // fixed = 4*30 + 10*20 + 7*12 + 30 = 434; practice 12*20 = 240; (900-434-240)/10 = 22 warm-up slots
  assert.equal(p.warmupSlots, 22);
  assert.equal(p.warmup.length, 22);
  assert.ok(p.estimateSec <= BUDGET_SEC);
  assert.equal(p.mode, 'normal', '40 due is not over 2 × 22');
});

test('planner: the daily cap limits the warm-up', () => {
  const p = planLesson({ lesson, dueQueue: queueOf(40), dueTotal: 40, capRemaining: 5 });
  assert.equal(p.warmup.length, 5);
});

test('planner: a slow learner gets fewer warm-up reviews, never fewer than 8 exercises unless the lesson has fewer', () => {
  const mild = planLesson({ lesson, dueQueue: queueOf(40), dueTotal: 3, pace: { reviewSec: 20, wordSec: 25, exerciseSec: 30 } });
  assert.ok(mild.exerciseIds.length >= 8 && mild.exerciseIds.length <= 12);
  assert.ok(mild.warmup.length < 22, 'slower reviews fit fewer into the time');
  const crawl = planLesson({ lesson, dueQueue: [], pace: { reviewSec: 30, wordSec: 60, exerciseSec: 90 } });
  assert.equal(crawl.exerciseIds.length, 8, 'practice shrinks to its floor when the rest already fills the time');
  assert.equal(crawl.warmupSlots, 0);
  // with no slots left, any due review makes the day review-heavy (due > 2 × 0)
  assert.equal(planLesson({ lesson, dueQueue: queueOf(3), dueTotal: 3, pace: { reviewSec: 30, wordSec: 60, exerciseSec: 90 } }).mode, 'review-heavy');
});

test('planner: review-heavy when due > 2 × slots, with a longer warm-up and 8 exercises', () => {
  const p = planLesson({ lesson, dueQueue: queueOf(60), dueTotal: 60, dailyReviewCap: 60 });
  assert.equal(p.mode, 'review-heavy');
  assert.equal(p.exerciseIds.length, 8);
  assert.equal(p.warmup.length, 48, 'about 8 minutes at 10 s each');
});

test('planner: catch-up when due > 2 × the daily cap', () => {
  const p = planLesson({ lesson, dueQueue: queueOf(60), dueTotal: 130, dailyReviewCap: 60 });
  assert.equal(p.mode, 'catch-up');
  assert.equal(p.exerciseIds.length, 8);
});

test('planner: without a voice the listen exercises are dropped', () => {
  const p = planLesson({ lesson, dueQueue: [], canListen: false });
  assert.deepEqual(p.dropped, ['e02']);
  assert.ok(!p.exerciseIds.includes('e02'));
  assert.equal(p.exerciseIds.length, 11);
});

// ---------------------------------------------------------------- machine

const freshRun = (dueQueue = []) => M.startRun({ lesson, plan: planLesson({ lesson, dueQueue }), studyDay: DAY, now: NOW });

test('machine: an empty warm-up is skipped and the run starts at grammar', () => {
  const run = freshRun();
  assert.deepEqual(M.position(run, lesson), { step: 'grammar', index: 0, sub: null, of: 4 });
});

test('machine: a warm-up with reviews starts there', () => {
  const run = freshRun(queueOf(3));
  assert.equal(run.step, 'warmup');
  assert.equal(run.plan.warmup.length, 3);
});

test('machine: walks every step in order and ends on the summary', () => {
  let run = freshRun(queueOf(2));
  const seen = [];
  let guard = 0;
  while (run.step !== 'summary' && guard++ < 500) {
    const w = run.step === 'words' ? lesson.new_vocab[run.index] : null;
    seen.push(`${run.step}:${run.index}${run.sub ? ':' + run.sub : ''}`);
    if (w && run.sub === 'intro' && run.index % 2 === 0) run = M.markKnown(run, w);
    run = M.advance(run, lesson);
  }
  assert.equal(run.step, 'summary');
  const steps = [...new Set(seen.map((s) => s.split(':')[0]))];
  assert.deepEqual(steps, ['warmup', 'grammar', 'words', 'practice', 'dialogue']);
  assert.equal(seen.filter((s) => s.startsWith('warmup')).length, 2);
  assert.equal(seen.filter((s) => s.startsWith('grammar')).length, 4);
  assert.equal(seen.filter((s) => s.startsWith('practice')).length, 12);
  assert.equal(seen.filter((s) => s.startsWith('dialogue')).length, 8, 'the scene plus 7 lines');
  // known words (even indexes) show only the intro; new ones show intro, recog, prod
  assert.equal(seen.filter((s) => s.startsWith('words:0')).length, 1);
  assert.deepEqual(seen.filter((s) => s.startsWith('words:1:')), ['words:1:intro', 'words:1:recog', 'words:1:prod']);
  assert.equal(M.overallProgress(run, lesson), 1);
});

test('machine: reducers do not mutate the run they are given', () => {
  const run = freshRun();
  const frozen = JSON.stringify(run);
  M.advance(run, lesson);
  M.markKnown(run, 'main');
  M.recordWord(run, 'main', { recog: true });
  M.recordExercise(run, 'e01', { correct: true, hinted: false });
  M.recordWarmup(run, 'w:x:meaning_ur_en');
  M.addActiveSeconds(run, 5);
  assert.equal(JSON.stringify(run), frozen);
});

test('machine: results accumulate and survive a JSON round trip (resume after closing the app)', () => {
  let run = freshRun();
  run = M.markKnown(run, 'main');
  run = M.recordWord(run, 'aap', { recog: true, prod: false });
  run = M.recordExercise(run, 'e03', { correct: true, hinted: true });
  run = M.addActiveSeconds(M.addActiveSeconds(run, 12), 8);
  const back = JSON.parse(JSON.stringify(run));
  assert.deepEqual(back, run);
  assert.equal(back.activeSec, 20);
  assert.deepEqual(back.knownWordIds, ['main']);
  assert.equal(M.runProblem(back, content), null);
});

test('machine: resuming on a later day rebuilds only the warm-up', () => {
  let run = freshRun(queueOf(5));
  run = M.recordWarmup(M.advance(run, lesson), 'w:due0:meaning_ur_en');
  const fresh = ['w:due0:meaning_ur_en', 'w:newA:meaning_ur_en', 'w:newB:meaning_ur_en'];
  const next = M.resumeOn(run, lesson, { studyDay: '2026-11-03', warmup: fresh });
  assert.equal(next.studyDay, '2026-11-03');
  assert.deepEqual(next.plan.warmup, ['w:newA:meaning_ur_en', 'w:newB:meaning_ur_en'], 'reviews already done stay done');
  assert.equal(next.index, 0);
  // later in the lesson nothing is rebuilt
  let later = freshRun();
  later = M.advance(later, lesson);
  const kept = M.resumeOn(later, lesson, { studyDay: '2026-11-03', warmup: fresh });
  assert.equal(kept.step, later.step);
  assert.equal(kept.index, later.index);
  assert.deepEqual(kept.plan.warmup, later.plan.warmup);
});

test('machine: a run this build can not continue is reported, never silently dropped', () => {
  const run = freshRun();
  assert.equal(M.runProblem({ ...run, v: 99 }, content), 'This lesson was started in a newer version of the app.');
  assert.match(M.runProblem({ ...run, lessonId: 'lesson-777' }, content), /not in this version/);
  assert.match(M.runProblem({ ...run, step: 'nope' }, content), /unreadable/);
  assert.match(M.runProblem(null, content), /unreadable/);
  assert.match(M.runProblem({ ...run, plan: { ...run.plan, exerciseIds: ['e99'] } }, content), /changed/);
});

// ---------------------------------------------------------------- commit

function playThrough({ known = ['main', 'aap'], wrong = ['e03'], hinted = ['e05'] } = {}) {
  let run = freshRun();
  for (const w of lesson.new_vocab) {
    if (known.includes(w)) run = M.markKnown(run, w);
    else run = M.recordWord(run, w, { recog: true, prod: w !== 'aur', sec: 40 });
  }
  for (const id of run.plan.exerciseIds) run = M.recordExercise(run, id, { correct: !wrong.includes(id), hinted: hinted.includes(id), sec: 15 });
  return { ...run, step: 'summary', index: 0, sub: null, activeSec: 540 };
}

test('commit: a finished lesson adds every word, phrase and exercise to the deck, once', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  const r = commitLesson(data, content, NOW);
  const cards = data.srs.decks.main.cards;
  // 10 words, two facets each (recognition + production; phrases use situation_to_phrase for production)
  assert.equal(Object.keys(cards).filter((id) => id.startsWith('w:')).length, lesson.new_vocab.length * 2);
  assert.equal(Object.keys(cards).filter((id) => id.startsWith('x:lesson-001:')).length, 12);
  assert.equal(r.cardsAdded, Object.keys(cards).length);
  assert.equal(data.progress.run, null);
  assert.equal(data.progress.lessons['lesson-001'].timesCompleted, 1);
  assert.deepEqual(data.progress.lessons['lesson-001'].knownWordIds, ['main', 'aap']);
  assert.equal(r.firstTime, true);
});

test('commit: ratings come from what happened in the lesson', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  commitLesson(data, content, NOW);
  const cards = data.srs.decks.main.cards;
  const st = (id) => cards[id].st;
  // practised words: recognition correct → reviewed once; production wrong ('aur') → Again → still Learning
  assert.notEqual(st('w:thiik:meaning_ur_en'), CARD_STATE.new);
  assert.equal(cards['w:thiik:meaning_ur_en'].r, 1);
  assert.equal(cards['w:aur:meaning_en_ur'].l, 0, 'a first Again is a learning step, not a lapse');
  assert.equal(st('w:aur:meaning_en_ur'), CARD_STATE.learning);
  assert.ok(cards['w:aur:meaning_en_ur'].due < cards['w:thiik:meaning_en_ur'].due, 'a missed word comes back sooner');
  // exercises: e03 wrong, e05 hinted (Hard), the rest Good
  assert.equal(st('x:lesson-001:e03'), CARD_STATE.learning);
  assert.ok(cards['x:lesson-001:e03'].due < cards['x:lesson-001:e01'].due);
  assert.ok(cards['x:lesson-001:e05'].due <= cards['x:lesson-001:e01'].due, 'Hard comes back no later than Good');
});

test('commit: "I already know this" words enter with a long first interval', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough({ known: ['main', 'aap'] });
  commitLesson(data, content, NOW);
  const cards = data.srs.decks.main.cards;
  const week = 6 * 86400000;
  assert.ok(cards['w:main:meaning_ur_en'].due - NOW > week, 'known word is due in more than a week');
  assert.ok(cards['w:aap:meaning_en_ur'].due - NOW > week);
  assert.ok(cards['w:thiik:meaning_ur_en'].due - NOW < week, 'a practised word is not');
});

test('commit: stats, streak and pace are updated', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  const r = commitLesson(data, content, NOW);
  const d = data.stats.days[DAY];
  assert.equal(d.lessons, 1);
  assert.equal(d.newWords, 10);
  assert.equal(d.seconds, 540);
  assert.equal(data.stats.streak, 1);
  assert.equal(data.stats.lastStudyDay, DAY);
  assert.notEqual(data.stats.pace.wordSec, 20);
  assert.equal(r.exercisesCorrect, 11);
  assert.equal(r.exercisesTotal, 12);
  assert.equal(r.wordsKnown, 2);
  assert.equal(r.wordsNew, 8);
});

test('commit: unlocks are reported and apply to the deck', () => {
  const raw = (l) => ({ units: content.units, vocabs: [{ unit: 'unit-01', words: content.words }], lessons: l });
  const l1 = JSON.parse(JSON.stringify(lesson));
  l1.unlocks = ['gender'];
  const c = buildContentIndex(raw([l1]));
  const data = defaultData(NOW);
  data.progress.run = { ...playThrough(), lessonId: 'lesson-001' };
  const r = commitLesson(data, c, NOW);
  assert.deepEqual(r.newFeatures, ['gender']);
});

test('commit: finishing the same lesson again never touches existing cards', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  commitLesson(data, content, NOW);
  const before = JSON.stringify(data.srs.decks.main.cards);
  data.progress.run = playThrough({ known: [], wrong: [], hinted: [] });
  const r = commitLesson(data, content, NOW + 3600000);
  assert.equal(JSON.stringify(data.srs.decks.main.cards), before);
  assert.equal(r.cardsAdded, 0);
  assert.equal(data.progress.lessons['lesson-001'].timesCompleted, 2);
  assert.equal(data.progress.lessons['lesson-001'].firstCompletedAt, NOW);
  assert.deepEqual(data.progress.lessons['lesson-001'].knownWordIds, ['main', 'aap']);
});

test('commit: with no run, or content the build lacks, it changes nothing and throws', () => {
  const data = defaultData(NOW);
  assert.throws(() => commitLesson(data, content, NOW), /no lesson in progress/);
  data.progress.run = { ...playThrough(), lessonId: 'lesson-777' };
  const before = JSON.stringify(data);
  assert.throws(() => commitLesson(data, content, NOW), /not in this version/);
  assert.equal(JSON.stringify(data), before);
});

test('commit: a failure part-way leaves the live data exactly as it was', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  const broken = { ...content, getWord: () => { throw new Error('boom'); } };
  const before = JSON.stringify(data);
  assert.throws(() => commitLesson(data, broken, NOW), /boom/);
  assert.equal(JSON.stringify(data), before);
});

test('commit: grades only name cards of this lesson', () => {
  const run = playThrough();
  const grades = lessonGrades(run, lesson, content);
  assert.ok(Object.keys(grades).every((id) => id.startsWith('w:') || id.startsWith('x:lesson-001:')));
  assert.equal(grades['x:lesson-001:e03'], GRADE.again);
  assert.equal(grades['x:lesson-001:e05'], GRADE.hard);
  assert.equal(grades['w:main:meaning_ur_en'], undefined, 'known words are not rated');
});

// ---------------------------------------------------------------- Today

const noQueue = { dueTotal: 0, held: 0, catchUpDays: 0, catchUpMode: false };

test('today: a new learner is offered lesson 1, with the gender question pending', () => {
  const data = defaultData(NOW);
  const t = todayState({ data, content, now: NOW, queue: noQueue });
  assert.equal(t.primary, 'start');
  assert.equal(t.lesson.id, 'lesson-001');
  assert.equal(t.position.lessonNumber, 1);
  assert.equal(t.position.unitNumber, 1);
  assert.equal(t.needsGender, true);
  data.settings.learnerGender = 'f';
  assert.equal(todayState({ data, content, now: NOW, queue: noQueue }).needsGender, false);
});

test('today: a run in progress offers Continue with its position', () => {
  const data = defaultData(NOW);
  data.progress.run = M.advance(freshRun(), lesson);
  const t = todayState({ data, content, now: NOW, queue: noQueue });
  assert.equal(t.primary, 'resume');
  assert.deepEqual(t.runProgress, { label: 'Grammar', current: 2, of: 4 });
});

test('today: a run this build cannot read is reported, not hidden or deleted', () => {
  const data = defaultData(NOW);
  data.progress.run = { ...freshRun(), v: 99 };
  const t = todayState({ data, content, now: NOW, queue: noQueue });
  assert.equal(t.primary, 'problem');
  assert.match(t.runProblem, /newer version/);
  assert.equal(data.progress.run.v, 99);
});

test('today: after the lesson the next one waits for tomorrow, with the option to do one more', () => {
  const l2 = { ...JSON.parse(JSON.stringify(lesson)), id: 'lesson-002', order: 2 };
  const c = buildContentIndex({ units: content.units, vocabs: [{ unit: 'unit-01', words: content.words }], lessons: [lesson, l2] });
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  commitLesson(data, c, NOW);
  const t = todayState({ data, content: c, now: NOW + 3600000, queue: noQueue });
  assert.equal(t.primary, 'done-today');
  assert.equal(t.lesson.id, 'lesson-002');
  assert.equal(t.canDoMore, true);
  const tomorrow = todayState({ data, content: c, now: NOW + 86400000, queue: noQueue });
  assert.equal(tomorrow.primary, 'start');
  assert.equal(tomorrow.doneToday, false);
  assert.equal(tomorrow.streak, 1);
});

test('today: when every lesson is done there is no lesson to start', () => {
  const data = defaultData(NOW);
  data.progress.run = playThrough();
  commitLesson(data, content, NOW);
  const t = todayState({ data, content, now: NOW + 86400000, queue: noQueue });
  assert.equal(t.primary, 'all-done');
  assert.equal(t.lesson, null);
  assert.equal(nextLesson(data, content), undefined);
});

test('today: on a catch-up day a review session leads', () => {
  const data = defaultData(NOW);
  const t = todayState({ data, content, now: NOW, queue: { dueTotal: 200, held: 140, catchUpDays: 4, catchUpMode: true } });
  assert.equal(t.primary, 'review');
  assert.equal(t.lesson.id, 'lesson-001', 'the lesson stays available as "do it anyway"');
});

test('streak: shown while yesterday or today was studied, zero once a day is missed', () => {
  const stats = { streak: 5, lastStudyDay: '2026-11-01' };
  assert.equal(currentStreak(stats, '2026-11-02'), 5);
  assert.equal(currentStreak(stats, '2026-11-01'), 5);
  assert.equal(currentStreak(stats, '2026-11-03'), 0);
  assert.equal(currentStreak({ streak: 0, lastStudyDay: null }, DAY), 0);
});
