// Where the learner is on the course, and what Today should offer (BRIEF §5.1, PLAN §6.3). Pure.
// Nothing here is stored: "done today", "next lesson" and the streak are all derived from progress and stats,
// so no stored shape changes.

import { studyDay, previousDay } from '../db/day.js';
import { runProblem, progressLine } from './machine.js';
import { buildQueue } from '../srs/queue.js';
import { describeCard } from '../srs/cardFace.js';
import { reviewsDoneToday } from '../srs/stats.js';

/** Lessons unlock strictly in curriculum order: the next one is the first not yet completed. */
export function nextLesson(data, content) {
  return content.lessons.find((l) => !l.retired && !data.progress.lessons[l.id]);
}

/** The streak as it stands today: a streak whose last study day is older than yesterday has already ended. */
export function currentStreak(stats, day) {
  if (!stats.lastStudyDay) return 0;
  return stats.lastStudyDay === day || stats.lastStudyDay === previousDay(day) ? stats.streak : 0;
}

/** "Lesson 7 · Unit 1" style position of a lesson. */
export function lessonPosition(lesson, content) {
  const unit = content.getUnit(lesson.unit);
  const inUnit = content.lessonsOfUnit(lesson.unit);
  return { lessonNumber: lesson.order, unitNumber: unit?.order ?? null, unitTitle: unit?.title ?? '', indexInUnit: inUnit.findIndex((l) => l.id === lesson.id) + 1 };
}

/**
 * Everything Today needs.
 * @param {{ data: any, content: any, now: number, queue: { dueTotal: number, held: number, catchUpDays: number, catchUpMode: boolean } }} o
 */
export function todayState({ data, content, now, queue }) {
  const day = studyDay(now, data.settings.dayRolloverHour);
  const run = data.progress.run;
  const problem = run ? runProblem(run, content) : null;
  const runLesson = run && !problem ? content.getLesson(run.lessonId) : null;
  const next = nextLesson(data, content);
  const lessonsToday = data.stats.days[day]?.lessons ?? 0;
  const doneToday = lessonsToday > 0;

  /** @type {'resume'|'problem'|'review'|'start'|'done-today'|'all-done'} */
  let primary;
  if (run && problem) primary = 'problem';
  else if (runLesson) primary = 'resume';
  else if (!next) primary = 'all-done';
  else if (doneToday) primary = 'done-today';
  else if (queue.catchUpMode) primary = 'review';
  else primary = 'start';

  return {
    day,
    primary,
    run: runLesson ? run : null,
    runLesson,
    runProgress: runLesson ? progressLine(run, runLesson) : null,
    runProblem: problem,
    lesson: next ?? null,
    position: next ? lessonPosition(next, content) : null,
    lessonsToday,
    doneToday,
    /** After today's lesson: "Lesson N is tomorrow", with an option to do one more. */
    canDoMore: !!next && doneToday && !run,
    dueTotal: queue.dueTotal,
    held: queue.held,
    catchUpDays: queue.catchUpDays,
    catchUpMode: queue.catchUpMode,
    streak: currentStreak(data.stats, day),
    lessonsDone: Object.keys(data.progress.lessons).length,
    needsGender: data.settings.learnerGender !== 'm' && data.settings.learnerGender !== 'f',
  };
}

/** Today's review queue: the same one the Review screen builds (capped, spaced, only cards that can be shown). */
export function todayQueue(data, content, now) {
  return buildQueue({
    cards: data.srs.decks.main.cards,
    now,
    rolloverHour: data.settings.dayRolloverHour,
    cap: data.settings.dailyReviewCap,
    doneToday: reviewsDoneToday(data, now),
    isReviewable: (id) => describeCard(id, content) !== null,
  });
}
