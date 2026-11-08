// Time-budget planner (PLAN §6.1). Pure: given a lesson and today's review queue it decides how many
// warm-up reviews and how many practice exercises fit in about 15 minutes.
//
// budget        = 900 s
// fixed         = grammarScreens*30 + newWords*wordSec + dialogueLines*20 + 30 (summary)
// practiceCount = clamp(exercises, 8, 12)
// warmupSlots   = floor((budget - fixed - practiceCount*exerciseSec) / reviewSec)
// if warmupSlots < 0: shrink practice (never below 8), warm-up 0
// The warm-up is at most WARMUP_MAX cards, chosen for variety (PLAN D28): reviews belong in the Review tab.
//
// Modes (D7):
//   normal        the plan above
//   review-heavy  due > 2 × warmupSlots: practice drops to 8 so there is time for reviews afterwards
//   catch-up      due > 2 × daily cap: Today leads with a review session; if the learner does the lesson anyway it is planned like review-heavy

export const BUDGET_SEC = 900;
export const WARMUP_MAX = 6;
export const SUMMARY_SEC = 30;
export const GRAMMAR_SCREEN_SEC = 30;
export const DIALOGUE_LINE_SEC = 20; // interactive since D31: hear and answer, or build the line
export const PRACTICE_MIN = 8;
export const PRACTICE_MAX = 12;

const DEFAULT_PACE = { reviewSec: 10, wordSec: 20, exerciseSec: 20 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * @param {object} o
 * @param {any} o.lesson
 * @param {string[]} o.dueQueue  today's review queue in the order to show it (already capped and spaced)
 * @param {number} [o.dueTotal]  all cards due today, before the cap (decides the mode)
 * @param {number} [o.capRemaining]  reviews the daily cap still allows
 * @param {number} [o.dailyReviewCap]
 * @param {{ reviewSec?: number, wordSec?: number, exerciseSec?: number }} [o.pace]  moving averages from stats.pace
 * @param {boolean} [o.canListen]  false drops `listen` exercises (no usable voice)
 * @param {(queue: string[], n: number) => string[]} [o.pickWarmup]  chooses the warm-up cards (default: the first n)
 * @returns {{ mode: 'normal'|'review-heavy'|'catch-up', budgetSec: number, estimateSec: number, warmup: string[], exerciseIds: string[],
 *   warmupSlots: number, dropped: string[] }}
 */
export function planLesson({ lesson, dueQueue = [], dueTotal = dueQueue.length, capRemaining = Infinity, dailyReviewCap = 35, pace = {}, canListen = true, pickWarmup = (q, n) => q.slice(0, n) }) {
  const p = { ...DEFAULT_PACE, ...pace };
  const live = (lesson.exercises ?? []).filter((e) => !e.retired);
  const playable = live.filter((e) => canListen || e.type !== 'listen');
  const dropped = live.filter((e) => !playable.includes(e)).map((e) => e.id);

  const newWords = (lesson.new_vocab ?? []).length;
  const fixed = lesson.grammar.length * GRAMMAR_SCREEN_SEC + newWords * p.wordSec + (lesson.dialogue?.lines.length ?? 0) * DIALOGUE_LINE_SEC + SUMMARY_SEC;

  let practiceCount = Math.min(playable.length, clamp(playable.length, PRACTICE_MIN, PRACTICE_MAX));
  let warmupSlots = Math.floor((BUDGET_SEC - fixed - practiceCount * p.exerciseSec) / p.reviewSec);
  if (warmupSlots < 0) {
    const floor = Math.min(practiceCount, PRACTICE_MIN);
    practiceCount = Math.max(floor, practiceCount + Math.floor((warmupSlots * p.reviewSec) / p.exerciseSec));
    warmupSlots = 0;
  }

  let mode = 'normal';
  if (dueTotal > dailyReviewCap * 2) mode = 'catch-up';
  else if (dueTotal > 0 && dueTotal > 2 * warmupSlots) mode = 'review-heavy';
  if (mode !== 'normal') practiceCount = Math.min(practiceCount, Math.min(playable.length, PRACTICE_MIN));

  const take = Math.max(0, Math.min(WARMUP_MAX, Math.max(warmupSlots, 0), capRemaining, dueQueue.length));
  const warmup = pickWarmup(dueQueue, take);
  const exerciseIds = playable.slice(0, practiceCount).map((e) => e.id);
  const estimateSec = Math.round(fixed + warmup.length * p.reviewSec + exerciseIds.length * p.exerciseSec);

  return { mode, budgetSec: BUDGET_SEC, estimateSec, warmup, exerciseIds, warmupSlots, dropped };
}
