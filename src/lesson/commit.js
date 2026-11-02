// Lesson completion (PLAN §6.2). ONE atomic step: the lesson is marked complete, every item it introduced joins the
// deck (words, phrases and exercises, with the ratings earned in the lesson), its grammar unlocks switch on, stats are
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
import { checkFacets } from './wordChecks.js';

const PACE_WEIGHT = 0.1;
const SEC_MIN = 3;
const SEC_MAX = 120;
const clone = (v) => JSON.parse(JSON.stringify(v));

const ema = (old, sample) => Math.round(((1 - PACE_WEIGHT) * old + PACE_WEIGHT * Math.min(SEC_MAX, Math.max(SEC_MIN, sample))) * 10) / 10;

/**
 * The first rating of each NEW card, from what happened in the lesson.
 * @returns {Record<string, number>}
 */
export function lessonGrades(run, lesson, content) {
  const grades = {};
  for (const wordId of lesson.new_vocab ?? []) {
    const word = content.getWord(wordId);
    const r = run.wordResults[wordId];
    if (!word || !r || r.known) continue;
    const { recog, prod } = checkFacets(word);
    if (typeof r.recog === 'boolean') grades[wordCardId(wordId, recog)] = r.recog ? GRADE.good : GRADE.again;
    if (typeof r.prod === 'boolean') grades[wordCardId(wordId, prod)] = r.prod ? GRADE.good : GRADE.again;
  }
  for (const [exerciseId, result] of Object.entries(run.exerciseResults)) {
    grades[exerciseCardId(lesson.id, exerciseId)] = gradeForResult(result);
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
