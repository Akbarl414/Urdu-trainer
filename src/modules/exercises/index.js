// One exercise on one screen (BRIEF §5.2, §7.4): the prompt, the answer widget for its type, an optional
// Hint, and — once answered — the explanation and Continue. Every schema type is handled here.
//
// ctx: { scope, loanwords, learnerGender, content, setActions(...nodes) }
import { h } from '../../ui/dom.js';
import { urduText, urduLine } from '../../ui/urduText.js';
import { audioButton } from '../../ui/audioButton.js';
import { para, prose } from '../../ui/prose.js';
import { store } from '../../db/storage.js';
import { forLearner, learnerAlt } from '../../lesson/learner.js';
import * as X from '../../lesson/exercises.js';
import { choiceList } from './choice.js';
import { tilesView } from './tiles.js';
import { freeAnswer } from './free.js';

const LABEL = {
  'fill-blank': 'Fill in the blank',
  'multiple-choice': 'Choose',
  'choose-form': 'Pick the right form',
  reorder: 'Put the words in order',
  'error-spot': 'Spot and fix the mistake',
  translate: 'Say it in Urdu',
  transform: null,
  listen: 'Listen and choose',
};

const sentenceBlock = (t, { blank = false } = {}) =>
  h('div', { class: 'ex-sentence' }, blank ? urduText(t, { big: true }) : urduLine(t, { big: true }), t.en ? h('p', { class: 'muted ex-en' }, t.en) : null);

/**
 * @param {any} ctx
 * @param {any} rawExercise  exercise as authored (it may carry learner_f)
 * @param {{ onResult: (r: { correct: boolean, hinted: boolean }) => void, onContinue: () => void }} cb
 * @returns {HTMLElement}
 */
export function mountExercise(ctx, rawExercise, { onResult, onContinue }) {
  const ex = forLearner(rawExercise, ctx.learnerGender);
  const alt = learnerAlt(rawExercise, ctx.learnerGender);
  let hinted = false;
  let finished = false;

  const root = h('section', { class: 'card exercise' });
  const label = ex.type === 'transform' ? h('p', { class: 'ex-label' }, ...prose(ex.instruction)) : h('p', { class: 'ex-label' }, LABEL[ex.type]);
  const promptArea = h('div', { class: 'ex-prompt' });
  const hintArea = h('div', { class: 'ex-hint' });
  const answerArea = h('div', { class: 'ex-answer' });
  const afterArea = h('div', { class: 'ex-after' });
  root.append(label, promptArea, hintArea, answerArea, afterArea);

  if (ex.hint) {
    const btn = h('button', { class: 'btn btn-small btn-secondary', type: 'button' }, 'Hint');
    btn.addEventListener('click', () => {
      hinted = true;
      hintArea.replaceChildren(h('p', { class: 'hint' }, h('strong', {}, 'Hint: '), ...prose(ex.hint)), h('p', { class: 'muted small' }, 'Using the hint caps this one at “Hard” in your reviews.'));
    });
    hintArea.append(btn);
  }

  /** Called once, when the answer is final. */
  function finish(correct, { reveal = [], quiet = false } = {}) {
    if (finished) return;
    finished = true;
    hintArea.replaceChildren();
    onResult({ correct, hinted });
    const nodes = [];
    if (!quiet) nodes.push(h('p', { class: `feedback ${correct ? 'good' : 'bad'}` }, correct ? 'Correct' : 'Not quite'));
    nodes.push(...reveal);
    nodes.push(h('div', { class: 'card explain' }, h('span', { class: 'muted small reveal-label' }, 'Why'), para(ex.explanation)));
    if (alt) {
      const w = X.modelAnswers(alt)[0] ?? alt.sentence ?? alt.audio_text;
      if (w?.roman) nodes.push(h('p', { class: 'muted small' }, 'A woman would say: ', h('span', { class: 'rom' }, w.roman)));
    }
    afterArea.replaceChildren(...nodes);
    ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: onContinue }, 'Continue'));
    afterArea.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  const doneSentence = (t, filled) => h('div', { class: 'card reveal' }, h('div', { class: 'reveal-row' }, urduLine(filled ?? t), t.en ? h('span', { class: 'muted' }, t.en) : null));

  switch (ex.type) {
    case 'multiple-choice': {
      promptArea.append(...[h('p', { class: 'ex-question' }, ex.prompt), ex.sentence ? sentenceBlock(ex.sentence) : null].filter(Boolean));
      const list = choiceList(X.choiceOptions(ex), (i) => {
        list.reveal(X.correctIndexes(ex), i);
        finish(X.isChoiceCorrect(ex, i));
      });
      answerArea.append(list.el);
      break;
    }
    case 'choose-form': {
      promptArea.append(sentenceBlock(ex.sentence, { blank: true }));
      const list = choiceList(X.choiceOptions(ex), (i) => {
        list.reveal(X.correctIndexes(ex), i);
        const right = ex.options[ex.answerIndex];
        finish(X.isChoiceCorrect(ex, i), { reveal: [doneSentence(ex.sentence, { roman: ex.sentence.roman.replace('___', right.roman), ur: ex.sentence.ur.replace('___', right.ur) })] });
      });
      answerArea.append(list.el);
      break;
    }
    case 'listen': {
      promptArea.append(h('p', { class: 'ex-question' }, 'What did you hear?'), h('div', { class: 'listen-play' }, audioButton(ex.audio_text, { big: true, label: 'Play' })), h('p', { class: 'muted small center' }, 'Tap as often as you like.'));
      const list = choiceList(X.choiceOptions(ex), (i) => {
        list.reveal(X.correctIndexes(ex), i);
        finish(X.isChoiceCorrect(ex, i), { reveal: [doneSentence(ex.audio_text)] });
      });
      answerArea.append(list.el);
      break;
    }
    case 'reorder': {
      promptArea.append(h('p', { class: 'ex-question' }, 'Build this in Urdu:'), h('p', { class: 'ex-en-big' }, ex.sentence.en));
      const tv = tilesView(X.reorderTiles(ex), (placed) => {
        const right = X.isReorderCorrect(ex, placed);
        tv.lock(right);
        const others = ex.answerOrders.map((o) => o.join(' ')).filter((o) => o !== placed.join(' '));
        finish(right, {
          reveal: [doneSentence(ex.sentence), others.length > 1 || (!right && others.length) ? h('p', { class: 'muted small' }, right ? 'Also fine: ' : 'All the right orders: ', others.join('  ·  ')) : null].filter(Boolean),
        });
      });
      answerArea.append(tv.el);
      break;
    }
    case 'fill-blank':
    case 'error-spot':
    case 'translate':
    case 'transform': {
      if (ex.type === 'translate') promptArea.append(h('p', { class: 'ex-en-big' }, ex.en));
      else if (ex.type === 'transform') promptArea.append(sentenceBlock(ex.from));
      else promptArea.append(sentenceBlock(ex.sentence, { blank: ex.type === 'fill-blank' }));
      const { modes } = X.freeModes(ex);
      const model = X.modelAnswers(ex).map((m, i) => ({ ...m, en: i === 0 && ex.type === 'fill-blank' ? ex.sentence.en : undefined }));
      answerArea.append(
        freeAnswer({
          scope: ctx.scope,
          modes,
          mode: X.startMode(ex, store.data.settings.answerMode),
          answers: X.acceptedAnswers(ex),
          freeOrder: X.isFreeOrder(ex),
          model,
          typeStart: X.typeStart(ex),
          placeholder: ex.type === 'fill-blank' ? 'Type the missing word' : ex.type === 'error-spot' ? 'Fix the sentence' : undefined,
          loanwords: ctx.loanwords,
          speakPrompt: ex.type === 'fill-blank' ? 'Say the whole sentence out loud, with the missing word.' : undefined,
          onFinish: (correct) => finish(correct, { quiet: true }),
        }),
      );
      break;
    }
    default:
      // Unknown type (content newer than this build): no result is recorded, so no card gets a made-up grade.
      promptArea.append(h('p', { class: 'muted' }, 'This exercise type is not supported by this version of the app.'));
      ctx.setActions(h('button', { class: 'btn', type: 'button', onclick: onContinue }, 'Continue'));
  }
  return root;
}
