// Step 5: the interactive dialogue (PLAN D31). The learner plays their part: they build or pick their own lines,
// and hear each other speaker first, answering a quick question before the text appears. It ends with the whole
// exchange played through. The logic is in src/lesson/dialogue.js; this file draws it. Nothing here touches the deck.
import { h } from '../../../ui/dom.js';
import { urduLine, urduText } from '../../../ui/urduText.js';
import { audioButton } from '../../../ui/audioButton.js';
import { prose } from '../../../ui/prose.js';
import { recordCompare } from '../../../ui/recordCompare.js';
import { canSpeak, speak } from '../../../audio/tts.js';
import { lineTask, lineFor, lineAlt, isLearnerLine, isLineOrderCorrect } from '../../../lesson/dialogue.js';
import { choiceList } from '../../exercises/choice.js';
import { tilesView } from '../../exercises/tiles.js';

const feedback = (right) => h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? 'Correct' : 'Not quite');

export function mountDialogue(ctx) {
  const d = ctx.lesson.dialogue;
  const gender = ctx.learnerGender;
  const speaker = (id) => d.speakers.find((s) => s.id === id);
  const next = (label) => ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run) => run) }, label));

  if (ctx.run.index === 0) {
    ctx.body.append(
      h(
        'section',
        { class: 'card scene' },
        h('p', { class: 'ex-label' }, 'Dialogue'),
        h('p', { class: 'scene-setting' }, ...prose(d.setting)),
        h('ul', { class: 'cast' }, d.speakers.map((s) => h('li', {}, h('strong', {}, s.en), s.learner && s.en.toLowerCase() !== 'you' ? ' (you)' : ''))),
        h('p', { class: 'muted small' }, 'You play your part. Build your own lines, and listen to the others before you see what they said.'),
      ),
    );
    next('Start');
    return;
  }

  if (ctx.run.index === d.lines.length + 1) return mountPlaythrough(ctx, d, gender, speaker);

  const i = ctx.run.index - 1;
  const raw = d.lines[i];
  const line = lineFor(d, raw, gender);
  const who = speaker(raw.speaker);
  const mine = isLearnerLine(d, raw);
  const task = lineTask(d, i, gender);
  const last = i === d.lines.length - 1;
  const after = h('div', { class: 'ex-after' });

  const answered = (right) => {
    const alt = lineAlt(d, raw, gender);
    after.replaceChildren(
      ...[
        feedback(right),
        h('div', { class: 'card reveal' }, h('div', { class: 'reveal-row' }, urduLine(line, { big: true }), h('span', { class: 'muted' }, line.en))),
        mine ? h('p', { class: 'muted center' }, 'Say it out loud.') : null,
        mine ? recordCompare(line, ctx.scope) : null,
        alt ? h('p', { class: 'muted small' }, 'A woman would say: ', h('span', { class: 'rom' }, alt.roman)) : null,
      ].filter(Boolean),
    );
    next(last ? 'Hear the whole exchange' : 'Next line');
    after.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };

  const prev = i > 0 ? lineFor(d, d.lines[i - 1], gender) : null;
  const context = prev ? h('div', { class: 'prev-line' }, h('span', { class: 'muted small' }, `${speaker(d.lines[i - 1].speaker)?.en ?? ''}: `), urduText(prev), h('p', { class: 'muted dline-en' }, prev.en)) : null;
  const head = h('p', { class: 'speaker' }, who?.en ?? raw.speaker, mine ? h('span', { class: 'chip' }, 'your line') : null);
  const count = h('p', { class: 'muted small center' }, `Line ${i + 1} of ${d.lines.length}`);

  if (task.kind === 'hear') {
    const voice = canSpeak(line);
    const list = choiceList(task.options, (picked) => {
      list.reveal(task.answerIndex, picked);
      answered(picked === task.answerIndex);
    });
    ctx.body.append(
      ...[
        count,
        context,
        h(
          'section',
          { class: 'card dline' },
          head,
          voice ? h('div', { class: 'listen-play' }, audioButton(line, { big: true, label: 'Play' })) : h('div', { class: 'ex-sentence' }, urduLine(line, { big: true, audio: false })),
          voice ? null : h('p', { class: 'muted small center' }, 'No voice on this device, so read it instead.'),
          h('p', { class: 'ex-question' }, task.question),
          list.el,
          after,
        ),
      ].filter(Boolean),
    );
    if (voice) speak(line); // started from the tap on the previous screen; the Play button is there if the browser blocks it
    return;
  }

  // The learner's own line.
  const area = h('div', { class: 'ex-answer' });
  if (task.kind === 'pick') {
    const list = choiceList(task.options, (picked) => {
      list.reveal(task.correct, picked);
      answered(task.correct.includes(picked));
    });
    area.append(list.el);
  } else {
    const tv = tilesView(task.tiles, (placed) => {
      const right = isLineOrderCorrect(task, placed);
      tv.lock(right);
      answered(right);
    });
    area.append(tv.el);
  }
  ctx.body.append(
    ...[count, context, h('section', { class: 'card dline mine' }, head, h('p', { class: 'ex-question' }, task.kind === 'pick' ? 'Which one do you say?' : 'Build your line:'), h('p', { class: 'ex-en-big' }, line.en), area, after)].filter(Boolean),
  );
}

/** The last screen: every line in order, played one after another. */
function mountPlaythrough(ctx, d, gender, speaker) {
  let alive = true;
  ctx.scope.add(() => (alive = false));
  const lines = d.lines.map((raw) => lineFor(d, raw, gender));
  const rows = lines.map((line, i) =>
    h('div', { class: `card dline${isLearnerLine(d, d.lines[i]) ? ' mine' : ''}` }, h('p', { class: 'speaker' }, speaker(d.lines[i].speaker)?.en ?? d.lines[i].speaker), urduLine(line), h('p', { class: 'muted dline-en' }, line.en)),
  );
  const voice = lines.some((l) => canSpeak(l));
  const play = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Play it again');

  async function playAll() {
    play.disabled = true;
    for (let i = 0; i < lines.length && alive; i++) {
      rows[i].classList.add('playing');
      rows[i].scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      await speak(lines[i]);
      rows[i].classList.remove('playing');
    }
    if (alive) play.disabled = false;
  }
  play.addEventListener('click', playAll);

  ctx.body.append(h('p', { class: 'ex-label center' }, 'The whole exchange'), h('div', { class: 'transcript' }, rows));
  ctx.setActions(...[voice ? play : null, h('button', { class: 'btn', type: 'button', onclick: () => ctx.complete((run) => run) }, 'Finish the dialogue')].filter(Boolean));
  if (voice) playAll();
}
