// Step 4: guided practice. One exercise per screen; the result is saved into the run when the learner continues.
import { mountExercise } from '../../exercises/index.js';
import { recordExercise } from '../../../lesson/machine.js';
import { canSpeak } from '../../../audio/tts.js';

export function mountPractice(ctx) {
  const id = ctx.run.plan.exerciseIds[ctx.run.index];
  const raw = ctx.lesson.exercises.find((e) => e.id === id);
  if (!raw) return ctx.complete((run) => run);
  // The plan drops listen exercises when nothing can speak; this guards a voice that has gone away since.
  if (raw.type === 'listen' && !canSpeak(raw.audio_text)) return ctx.complete((run) => run);
  let result = null;
  ctx.body.append(
    mountExercise(ctx, raw, {
      onResult: (r) => (result = r),
      onContinue: () => ctx.complete((run, sec) => (result ? recordExercise(run, id, { ...result, sec }) : run)),
    }),
  );
}
