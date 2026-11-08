// Step 1: warm-up. Due review cards, exactly as in the Review screen (real reviews, written as they are graded).
import { h } from '../../../ui/dom.js';
import { reviewCard } from '../../review/cardView.js';
import { isReviewable } from '../../../srs/cardFace.js';
import { recordWarmup } from '../../../lesson/machine.js';

export function mountWarmup(ctx) {
  const id = ctx.run.plan.warmup[ctx.run.index];
  if (!isReviewable(id, ctx.content)) return ctx.complete((run) => run); // content changed since the plan: nothing to show
  const holder = h('div', { class: 'warmup' });
  ctx.body.append(h('p', { class: 'muted small center' }, 'Warm-up: a quick review of what is due.'), holder);
  reviewCard({
    id,
    content: ctx.content,
    show: (...nodes) => holder.replaceChildren(...nodes),
    onGraded: () => ctx.complete((run) => recordWarmup(run, id)),
  });
  ctx.setActions(h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => ctx.skipStep() }, 'Skip the rest of the warm-up'));
}
