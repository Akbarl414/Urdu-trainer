// Lesson completion (PLAN §6.2). ONE atomic step: the lesson is marked complete, every item it introduced joins the
// deck (a main card per word and phrase, plus its sentence cards, with the ratings earned in the lesson), its grammar unlocks switch on, stats are
// updated and the run is cleared. The work happens on a copy of the data; the live blob only changes once everything
// succeeded, and the caller then persists it with a single store.save().
//
// Cards that already exist are never touched (syncDeck is additive), so finishing a lesson twice can't disturb progress.

import { syncDeck } from '../srs/deck.js';
import { unlockedFeatures } from '../srs/facets.js';
import { wordCardId, exerciseCardId } from '../srs/facets.js';
import { GRADE } from '../srs/fsrs.js';
import { dayStats, touchStreak } from '../srs/stats.js';
import { studyDay } from '../db/day.js';
import { gradeForResult } from './exercises.js';

const PACE_WEIGHT = 0.1;
const SEC_MIN = 3;
const SEC_MAX = 120;
const clone = (v) => JSON.parse(JSON.stringify(v));

const ema = (old, sample) => Math.round(((1 - PACE_WEIGHT) * old + PACE_WEIGHT * Math.min(SEC_MAX, Math.max(SEC_MIN, sample))) * 10) / 10;

/**
 * The rating(s) of each NEW card, from what happened in the lesson (PLAN D28). The lesson's checks already are
 * the card's learning steps, so a word answered right twice leaves the lesson graduated and first returns in a few days
 * rather than the same evening. Anything missed comes back soon.
 * @returns {Record<string, number|number[]>}
 */
export function lessonGrades(run, lesson, content) {
  const grades = {};
  for (const wordId of lesson.new_vocab ?? []) {
    const word = content.getWord(wordId);
    const r = run.wordResults[wordId];
    if (!word || !r || r.known) continue;
    const checks = [r.recog, r.prod].filter((v) => typeof v === 'boolean');
    if (checks.length === 0) continue;
    grades[wordCardId(wordId, 'main')] = checks.every(Boolean) ? checks.map(() => GRADE.good) : [GRADE.again];
  }
  for (const [exerciseId, result] of Object.entries(run.exerciseResults)) {
    const ex = lesson.exercises.find((e) => e.id === exerciseId);
    if (!ex?.sentence_card) continue; // the other exercises have no card
    const g = gradeForResult(result);
    grades[exerciseCardId(lesson.id, exerciseId)] = g === GRADE.good ? [GRADE.good, GRADE.good] : [g];
  }
  return grades;
}

/**
 * @param {any} data  the storage blob (changed in place on success, untouched on failure)
 * @param {any} content  content index
 * @param {number} [now]
 * @returns {{ lessonId: string, cardsAdded: number, newFeatures: string[], wordsNew: number, wordsKnown: number,
 *   exercisesCorrect: number, exercisesTotal: number, seconds: number, firstTime: boolean }}
 */
export function commitLesson(data, content, now = Date.now()) {
  const run = data.progress.run;
  if (!run) throw new Error('commitLesson: there is no lesson in progress');
  const lesson = content.getLesson(run.lessonId);
  if (!lesson) throw new Error(`commitLesson: ${run.lessonId} is not in this version of the app`);

  const draft = clone(data);
  const doneBefore = Object.keys(draft.progress.lessons);
  const featuresBefore = unlockedFeatures(doneBefore, content);

  // 1. The lesson is complete.
  const prior = draft.progress.lessons[lesson.id];
  const known = [...new Set([...(prior?.knownWordIds ?? []), ...run.knownWordIds])];
  draft.progress.lessons[lesson.id] = {
    ...(prior ?? {}),
    firstCompletedAt: prior?.firstCompletedAt ?? now,
    lastCompletedAt: now,
    timesCompleted: (prior?.timesCompleted ?? 0) + 1,
    knownWordIds: known,
  };

  // 2. Its items join the deck; its unlocks create the facets that were waiting.
  const created = syncDeck(draft, content, now, { grades: lessonGrades(run, lesson, content), known: run.knownWordIds });
  const newFeatures = [...unlockedFeatures(Object.keys(draft.progress.lessons), content)].filter((f) => !featuresBefore.has(f));

  // 3. Stats and pace (the planner's per-item estimates adapt to this learner).
  const day = studyDay(now, draft.settings.dayRolloverHour);
  const d = dayStats(draft, day);
  d.lessons += 1;
  d.newWords += (lesson.new_vocab ?? []).length;
  d.seconds += Math.round(run.activeSec ?? 0);
  touchStreak(draft, day);
  const pace = draft.stats.pace;
  for (const r of Object.values(run.wordResults)) if (typeof r.sec === 'number' && !r.known) pace.wordSec = ema(pace.wordSec, r.sec);
  for (const r of Object.values(run.exerciseResults)) if (typeof r.sec === 'number') pace.exerciseSec = ema(pace.exerciseSec, r.sec);

  // 4. The run is over.
  draft.progress.run = null;

  // Success: swap in the changed parts. (Nothing above can half-apply to the live data.)
  data.progress = draft.progress;
  data.srs = draft.srs;
  data.stats = draft.stats;

  const results = Object.values(run.exerciseResults);
  return {
    lessonId: lesson.id,
    cardsAdded: created.length,
    newFeatures,
    wordsNew: (lesson.new_vocab ?? []).filter((w) => !run.knownWordIds.includes(w)).length,
    wordsKnown: run.knownWordIds.length,
    exercisesCorrect: results.filter((r) => r.correct).length,
    exercisesTotal: results.length,
    seconds: Math.round(run.activeSec ?? 0),
    firstTime: !prior,
  };
}
