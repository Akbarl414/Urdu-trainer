// Lesson-run state machine (PLAN §6.2). A pure reducer: every function takes a run and returns a NEW run,
// so the player can persist `progress.run` after every transition and Node can test the whole flow.
//
//   WARMUP → GRAMMAR → WORDS → PRACTICE → DIALOGUE → SUMMARY → (commit.js) → done
//
// Empty steps are skipped (no due reviews, no dialogue). One screen per index:
//   warmup    one review card per index          (plan.warmup[index])
//   grammar   one grammar screen per index
//   words     one word per index, three possible screens: sub 'intro' → 'recog' → 'prod' ('I already know this' skips the checks)
//   practice  one exercise per index             (plan.exerciseIds[index])
//   dialogue  index 0 = the scene, then one line per index, then the whole exchange played through
//   summary   a single screen
//
// Warm-up reviews are written to the deck as they are graded (real reviews). Everything else is buffered in the
// run until commit.js, so closing the app mid-lesson loses nothing that was already graded.

export const RUN_VERSION = 1;
export const STEPS = Object.freeze(['warmup', 'grammar', 'words', 'practice', 'dialogue', 'summary']);
export const WORD_SUBS = Object.freeze(['intro', 'recog', 'prod']);

/** How many screens a step has in this run. */
export function stepLength(run, lesson, step = run.step) {
  switch (step) {
    case 'warmup':
      return run.plan.warmup.length;
    case 'grammar':
      return lesson.grammar.length;
    case 'words':
      return (lesson.new_vocab ?? []).length;
    case 'practice':
      return run.plan.exerciseIds.length;
    case 'dialogue':
      return lesson.dialogue?.lines?.length ? lesson.dialogue.lines.length + 2 : 0;
    case 'summary':
      return 1;
    default:
      return 0;
  }
}

const initialSub = (step) => (step === 'words' ? 'intro' : null);

/** Skip over steps that have nothing in them. */
function settle(run, lesson) {
  let r = run;
  while (r.step !== 'summary' && r.index >= stepLength(r, lesson)) {
    const next = STEPS[STEPS.indexOf(r.step) + 1];
    r = { ...r, step: next, index: 0, sub: initialSub(next) };
  }
  return r;
}

/**
 * @param {{ lesson: any, plan: ReturnType<import('./planner.js').planLesson>, studyDay: string, now: number }} o
 */
export function startRun({ lesson, plan, studyDay, now }) {
  return settle(
    {
      v: RUN_VERSION,
      lessonId: lesson.id,
      studyDay,
      plan: { mode: plan.mode, estimateSec: plan.estimateSec, warmup: [...plan.warmup], exerciseIds: [...plan.exerciseIds] },
      step: 'warmup',
      index: 0,
      sub: null,
      warmupDone: [],
      knownWordIds: [],
      wordResults: {}, // wordId -> { known?: true, recog?: bool, prod?: bool, sec?: number }
      exerciseResults: {}, // exerciseId -> { correct: bool, hinted: bool, sec?: number }
      activeSec: 0,
      startedAt: now,
    },
    lesson,
  );
}

/** Move to the next screen (words move through their sub-screens first). */
export function advance(run, lesson) {
  if (run.step === 'summary') return run;
  if (run.step === 'words') {
    const word = lesson.new_vocab[run.index];
    const known = run.knownWordIds.includes(word);
    if (run.sub === 'intro' && !known) return { ...run, sub: 'recog' };
    if (run.sub === 'recog') return { ...run, sub: 'prod' };
    return settle({ ...run, index: run.index + 1, sub: 'intro' }, lesson);
  }
  return settle({ ...run, index: run.index + 1, sub: initialSub(run.step) }, lesson);
}

/** Leave the rest of the current step (used for "skip the rest of the warm-up"). */
export const skipStep = (run, lesson) => (run.step === 'summary' ? run : settle({ ...run, index: stepLength(run, lesson) }, lesson));

/** Step back is not offered in the lesson flow; this exists so tests and the player can ask "where are we?". */
export function position(run, lesson) {
  return { step: run.step, index: run.index, sub: run.sub, of: stepLength(run, lesson) };
}

/** A warm-up review was graded (it is already in the deck). */
export const recordWarmup = (run, cardId) => (run.warmupDone.includes(cardId) ? run : { ...run, warmupDone: [...run.warmupDone, cardId] });

/** "I already know this". */
export function markKnown(run, wordId) {
  const knownWordIds = run.knownWordIds.includes(wordId) ? run.knownWordIds : [...run.knownWordIds, wordId];
  return { ...run, knownWordIds, wordResults: { ...run.wordResults, [wordId]: { ...run.wordResults[wordId], known: true } } };
}

/** @param {{ recog?: boolean, prod?: boolean, sec?: number }} patch */
export function recordWord(run, wordId, patch) {
  return { ...run, wordResults: { ...run.wordResults, [wordId]: { ...run.wordResults[wordId], ...patch } } };
}

/** @param {{ correct: boolean, hinted: boolean, sec?: number }} result */
export function recordExercise(run, exerciseId, result) {
  return { ...run, exerciseResults: { ...run.exerciseResults, [exerciseId]: result } };
}

/** Time actually spent on screens (the player caps each screen so a forgotten phone doesn't count). */
export const addActiveSeconds = (run, sec) => ({ ...run, activeSec: run.activeSec + Math.max(0, sec) });

/**
 * Resuming on a LATER study day: the warm-up part is rebuilt from today's queue (the reviews already done stay done);
 * everything after it continues exactly where it stopped.
 */
export function resumeOn(run, lesson, { studyDay, warmup }) {
  if (run.studyDay === studyDay) return run;
  const fresh = warmup.filter((id) => !run.warmupDone.includes(id));
  if (run.step === 'warmup') return settle({ ...run, studyDay, index: 0, plan: { ...run.plan, warmup: fresh } }, lesson);
  return { ...run, studyDay };
}

/** Is a stored run something this build can continue? Returns a reason when it is not. */
export function runProblem(run, content) {
  if (!run || typeof run !== 'object') return 'The saved lesson progress is unreadable.';
  if (run.v !== RUN_VERSION) return run.v > RUN_VERSION ? 'This lesson was started in a newer version of the app.' : 'The saved lesson progress is from an older format.';
  const lesson = content.getLesson(run.lessonId);
  if (!lesson) return `Lesson ${run.lessonId} is not in this version of the app.`;
  if (!STEPS.includes(run.step) || !Number.isInteger(run.index) || run.index < 0) return 'The saved lesson progress is unreadable.';
  if (!run.plan || !Array.isArray(run.plan.warmup) || !Array.isArray(run.plan.exerciseIds)) return 'The saved lesson progress is unreadable.';
  if (run.step !== 'summary' && run.index >= stepLength(run, lesson)) return 'The saved lesson progress is unreadable.';
  const ids = new Set(lesson.exercises.map((e) => e.id));
  if (!run.plan.exerciseIds.every((id) => ids.has(id))) return 'The lesson has changed since it was started.';
  return null;
}

/** Counts for the summary screen and for Today's "Practice 4 of 12" line. */
export function progressLine(run, lesson) {
  const n = stepLength(run, lesson);
  switch (run.step) {
    case 'warmup':
      return { label: 'Warm-up', current: run.index + 1, of: n };
    case 'grammar':
      return { label: 'Grammar', current: run.index + 1, of: n };
    case 'words':
      return { label: 'New words', current: run.index + 1, of: n };
    case 'practice':
      return { label: 'Practice', current: run.index + 1, of: n };
    case 'dialogue':
      return { label: 'Dialogue', current: run.index + 1, of: n };
    default:
      return { label: 'Summary', current: 1, of: 1 };
  }
}

/** Overall position 0..1 across all the screens of the run, for the progress bar. */
export function overallProgress(run, lesson) {
  let total = 0;
  let done = 0;
  for (const step of STEPS) {
    if (step === 'summary') continue;
    const n = stepLength(run, lesson, step);
    total += n;
    const at = STEPS.indexOf(step);
    const cur = STEPS.indexOf(run.step);
    if (at < cur) done += n;
    else if (at === cur) done += Math.min(run.index, n);
  }
  if (run.step === 'summary') return 1;
  return total === 0 ? 0 : done / total;
}
