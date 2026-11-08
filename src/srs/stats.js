// Study statistics written by reviews (and, in Phase 3, lessons). Mutates the storage blob; callers persist.
// Uses only fields that already exist in defaultData(): stats.days[day], streak, bestStreak, lastStudyDay, pace.

import { studyDay, previousDay } from '../db/day.js';
import { CARD_STATE } from './fsrs.js';

const SECONDS_MIN = 2;
const SECONDS_MAX = 60;
const PACE_WEIGHT = 0.1; // exponential moving average

export const emptyDay = () => ({ reviews: 0, correct: 0, newWords: 0, lessons: 0, games: 0, seconds: 0, scriptReviews: 0, scriptLessons: 0 });

/** Today's counters (created on first use). */
export function dayStats(data, day) {
  const days = data.stats.days;
  days[day] = { ...emptyDay(), ...(days[day] || {}) };
  return days[day];
}

/** Count the day as studied: extends the streak when yesterday was studied too, restarts it otherwise. */
export function touchStreak(data, day) {
  const s = data.stats;
  if (s.lastStudyDay === day) return;
  s.streak = s.lastStudyDay === previousDay(day) ? s.streak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.lastStudyDay = day;
}

/** Reviews already done in the current study day (this is what the daily cap counts). */
export function reviewsDoneToday(data, now) {
  const day = studyDay(now, data.settings.dayRolloverHour);
  return data.stats.days[day]?.reviews ?? 0;
}

/**
 * Record one graded review. A card's learning steps (Learning/Relearning repeats) don't count
 * against the daily cap again; the first answer of each cycle does.
 * @param {{ now: number, previousState: number, seconds?: number, correct?: boolean }} o  correct: answered right (not Again); feeds the accuracy trend (v6)
 */
export function recordReview(data, { now, previousState, seconds, correct }) {
  const day = studyDay(now, data.settings.dayRolloverHour);
  const d = dayStats(data, day);
  const midLearning = previousState === CARD_STATE.learning || previousState === CARD_STATE.relearning;
  if (!midLearning) {
    d.reviews += 1;
    if (correct && typeof d.correct === 'number') d.correct += 1; // null = a day from before v6: not recorded, never half-counted
  }
  if (typeof seconds === 'number' && seconds >= 0) {
    const s = Math.min(SECONDS_MAX, Math.max(SECONDS_MIN, seconds));
    d.seconds += Math.round(s);
    data.stats.pace.reviewSec = Math.round(((1 - PACE_WEIGHT) * data.stats.pace.reviewSec + PACE_WEIGHT * s) * 10) / 10;
  }
  touchStreak(data, day);
}
