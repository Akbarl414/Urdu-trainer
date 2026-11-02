// Step 6: summary, then completion. "Finish lesson" is the one moment the lesson's items join the deck
// (src/lesson/commit.js does it in a single write). After it: what was added, what unlocked, and what is next.
import { h } from '../../../ui/dom.js';
import { prose } from '../../../ui/prose.js';
import { store } from '../../../db/storage.js';
import { nextLesson } from '../../../lesson/path.js';

const FEATURE_NAME = { gender: 'noun gender', oblique: 'the oblique case', agreement: 'agreement', perfective: 'the past tense', ne: '“ne”' };

function stat(value, label) {
  return h('div', { class: 'stat' }, h('strong', {}, String(value)), h('span', { class: 'muted small' }, label));
}

export function mountSummary(ctx) {
  const { run, lesson } = ctx;
  const results = Object.values(run.exerciseResults);
  const right = results.filter((r) => r.correct).length;
  const newWords = lesson.new_vocab.filter((w) => !run.knownWordIds.includes(w)).length;
  const mins = Math.max(1, Math.round((run.activeSec ?? 0) / 60));

  const finishBtn = h('button', { class: 'btn', type: 'button' }, 'Finish lesson');
  finishBtn.addEventListener('click', () => {
    finishBtn.disabled = true;
    ctx.finish();
  });
  ctx.body.append(
    h(
      'section',
      { class: 'card summary' },
      h('h2', {}, 'Lesson complete'),
      h('p', {}, ...prose(lesson.can_do.replace(/^You can /, 'Now you can '))),
      h('div', { class: 'stats' }, stat(`${right}/${results.length}`, 'exercises right'), stat(newWords, 'new words'), stat(run.knownWordIds.length, 'already known'), stat(`~${mins}`, 'minutes')),
      h('p', { class: 'muted small' }, 'Finishing adds this lesson’s words, phrases and exercises to your reviews.'),
    ),
  );
  ctx.setActions(finishBtn);
}

/** What the player shows after commit. */
export function doneView(ctx, result) {
  const next = nextLesson(store.data, ctx.content);
  const unlocked = result.newFeatures.map((f) => FEATURE_NAME[f] ?? f);
  ctx.body.replaceChildren(
    h(
      'section',
      { class: 'card summary done' },
      h('h2', {}, '✓ Done for today'),
      h('p', {}, result.cardsAdded > 0 ? `${result.cardsAdded} cards were added to your reviews. The first ones come back soon.` : 'Your reviews were already up to date.'),
      unlocked.length ? h('p', {}, 'Unlocked: ', unlocked.join(', '), '.') : null,
      next ? h('p', {}, h('strong', {}, `Lesson ${next.order}: ${next.title}`), ' is scheduled for tomorrow.') : h('p', {}, 'That is every lesson available so far. More arrive as new content is added.'),
      next
        ? h('p', { class: 'muted small' }, `Want to do one more now? Each new lesson adds about ${result.cardsAdded > 0 ? Math.round(result.cardsAdded / 5) * 5 : 30} reviews over the next week, so they will pile up a little faster.`)
        : null,
    ),
  );
  ctx.setActions(
    ...(next ? [h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => ctx.another() }, 'Do one more lesson')] : []),
    h('a', { class: 'btn', href: '#/' }, 'Back to Today'),
  );
}

