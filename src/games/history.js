// Numbers behind the Stats page. Pure; reads the storage blob and the content index, writes nothing.
import { previousDay, studyDay } from '../db/day.js';
import { stageOf } from '../srs/format.js';
import { MEMORY_TARGETS } from '../srs/fsrs.js';

/** The last `n` study days ending at `endDay`, oldest first. */
export function lastDays(endDay, n) {
  const out = [];
  for (let d = endDay, i = 0; i < n; i++, d = previousDay(d)) out.push(d);
  return out.reverse();
}

/** Reviews per day (the daily cap and today's study day come from the caller). */
export function reviewsPerDay(data, endDay, n = 14) {
  return lastDays(endDay, n).map((day) => ({ day, value: data.stats.days[day]?.reviews ?? 0 }));
}

/**
 * Accuracy over a rolling window, per day: right answers / reviews in the `window` days up to and including that day.
 * Days before v6 have no count (correct is null/missing) and are left out of both sides; a day with nothing recorded is null.
 */
export function accuracyTrend(data, endDay, n = 30, window = 7) {
  const span = lastDays(endDay, n + window - 1);
  return span.slice(window - 1).map((day, i) => {
    let right = 0;
    let total = 0;
    for (const d of span.slice(i, i + window)) {
      const s = data.stats.days[d];
      if (!s || typeof s.correct !== 'number') continue;
      right += s.correct;
      total += s.reviews ?? 0;
    }
    return { day, value: total >= 5 ? Math.min(1, right / total) : null, total };
  });
}

/** The desired retention for the saved memory target (0.8 / 0.85 / 0.9). */
export const targetRetention = (settings) => MEMORY_TARGETS[settings.memoryTarget] ?? MEMORY_TARGETS.relaxed;

/** Words learned so far at the end of each of the last `n` days (a lesson counts on the day it was first completed). */
export function wordsOverTime(data, content, endDay, n = 30) {
  const rollover = data.settings.dayRolloverHour;
  const perDay = {};
  for (const [lessonId, rec] of Object.entries(data.progress.lessons)) {
    const lesson = content.getLesson(lessonId);
    if (!lesson || typeof rec.firstCompletedAt !== 'number') continue;
    const day = studyDay(rec.firstCompletedAt, rollover);
    perDay[day] = (perDay[day] ?? 0) + (lesson.new_vocab ?? []).length;
  }
  const days = lastDays(endDay, n);
  let running = Object.entries(perDay).filter(([d]) => d < days[0]).reduce((a, [, c]) => a + c, 0);
  return days.map((day) => {
    running += perDay[day] ?? 0;
    return { day, value: running };
  });
}

/** Per unit: lessons finished and words learned out of the total, plus how many of those words are well held. */
export function unitProgress(data, content) {
  const cards = data.srs.decks.main.cards;
  return content.units
    .filter((u) => !u.retired)
    .map((unit) => {
      const lessons = content.lessonsOfUnit(unit.id).filter((l) => !l.retired);
      const doneLessons = lessons.filter((l) => data.progress.lessons[l.id]);
      const words = lessons.flatMap((l) => l.new_vocab ?? []);
      const learned = doneLessons.flatMap((l) => l.new_vocab ?? []);
      const strong = learned.filter((id) => {
        const c = cards[`w:${id}:main`];
        return c && !c.retired && (stageOf(c) === 'known' || stageOf(c) === 'strong');
      });
      return { unit, lessonsDone: doneLessons.length, lessonsTotal: lessons.length, wordsLearned: learned.length, wordsTotal: words.length, wordsStrong: strong.length };
    });
}

/** Sum of the last `n` days for one counter. */
export const sumDays = (data, endDay, n, key) => lastDays(endDay, n).reduce((a, d) => a + (data.stats.days[d]?.[key] ?? 0), 0);
