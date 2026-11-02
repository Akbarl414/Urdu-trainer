// Step 5: dialogue. A short scene in one of the learner's contexts, line by line: listen, reveal the English,
// and on the learner's own lines say it aloud (with optional record & compare).
import { h } from '../../../ui/dom.js';
import { urduLine, urduText } from '../../../ui/urduText.js';
import { prose } from '../../../ui/prose.js';
import { recordCompare } from '../../../ui/recordCompare.js';
import { forLearner, learnerAlt } from '../../../lesson/learner.js';

export function mountDialogue(ctx) {
  const d = ctx.lesson.dialogue;
  const speaker = (id) => d.speakers.find((s) => s.id === id);

  if (ctx.run.index === 0) {
    ctx.body.append(
      h(
        'section',
        { class: 'card scene' },
        h('p', { class: 'ex-label' }, 'Dialogue'),
        h('p', { class: 'scene-setting' }, ...prose(d.setting)),
        h('ul', { class: 'cast' }, d.speakers.map((s) => h('li', {}, h('strong', {}, s.en), s.learner && s.en.toLowerCase() !== 'you' ? ' (you)' : ''))),
        h('p', { class: 'muted small' }, 'Listen to each line, then say your own lines out loud.'),
      ),
    );
    ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run) => run) }, 'Start'));
    return;
  }

  const i = ctx.run.index - 1;
  const raw = d.lines[i];
  const who = speaker(raw.speaker);
  const mine = !!who?.learner;
  const line = mine ? forLearner(raw, ctx.learnerGender) : raw;
  const alt = mine ? learnerAlt(raw, ctx.learnerGender) : null;
  const prev = i > 0 ? (speaker(d.lines[i - 1].speaker)?.learner ? forLearner(d.lines[i - 1], ctx.learnerGender) : d.lines[i - 1]) : null;
  const last = i === d.lines.length - 1;

  const english = h('div', { class: 'line-en' });
  const revealBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Show English');
  revealBtn.addEventListener('click', () => {
    english.replaceChildren(...[h('p', { class: 'ex-en-big' }, line.en), alt ? h('p', { class: 'muted small' }, 'A woman would say: ', h('span', { class: 'rom' }, alt.roman)) : null].filter(Boolean));
    revealBtn.hidden = true;
  });

  ctx.body.append(
    ...[
    h('p', { class: 'muted small center' }, `Line ${i + 1} of ${d.lines.length}`),
    prev ? h('div', { class: 'prev-line' }, h('span', { class: 'muted small' }, `${speaker(d.lines[i - 1].speaker)?.en ?? ''}: `), urduText(prev)) : null,
    h(
      'section',
      { class: `card dline${mine ? ' mine' : ''}` },
      h('p', { class: 'speaker' }, who?.en ?? raw.speaker, mine ? h('span', { class: 'chip' }, 'your line') : null),
      h('div', { class: 'ex-sentence' }, urduLine(line, { big: true })),
      mine ? h('p', { class: 'muted center' }, 'Say it out loud.') : h('p', { class: 'muted center' }, 'Listen, then check what it means.'),
      mine ? recordCompare(line, ctx.scope) : null,
      english,
    ),
    ].filter(Boolean),
  );
  const actions = [revealBtn, h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run) => run) }, last ? 'Finish the dialogue' : 'Next line')];
  ctx.setActions(...actions);
}
