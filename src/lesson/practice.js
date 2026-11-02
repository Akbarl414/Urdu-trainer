// Practice-only replay of a completed lesson. Pure.
//
// A replay runs the same screens as the real lesson (grammar → words → practice → dialogue → summary) but it is
// held in memory only: no warm-up reviews, nothing written to `progress.run`, no commit, no cards created or
// rescheduled, no stats, no streak. Closing the app mid-replay simply loses the replay.

import { startRun } from './machine.js';

/** Completed, non-retired lessons, in course order: the ones that can be replayed. */
export function practisableLessons(data, content) {
  return content.lessons.filter((l) => !l.retired && !!data.progress.lessons[l.id]);
}

/** Why a lesson can't be replayed (null when it can). */
export function practiceProblem(data, content, lessonId) {
  const lesson = content.getLesson(lessonId);
  if (!lesson || lesson.retired) return 'This lesson is not in this version of the app.';
  if (!data.progress.lessons[lessonId]) return 'Only lessons you have finished can be practised again.';
  return null;
}

/**
 * The in-memory run for a replay: no warm-up, and every live exercise (listen ones only when something can speak),
 * not trimmed by the time budget.
 */
export function startPractice({ lesson, canListen, studyDay, now }) {
  const exerciseIds = lesson.exercises.filter((e) => !e.retired && (canListen || e.type !== 'listen')).map((e) => e.id);
  return { ...startRun({ lesson, plan: { mode: 'normal', estimateSec: 0, warmup: [], exerciseIds }, studyDay, now }), practice: true };
}
