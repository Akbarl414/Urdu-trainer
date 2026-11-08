// Speed recall: the English is on screen, type the Urdu against the clock. Credit-eligible (typed / speed recall from memory).
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { poolFor } from '../../games/catalog.js';
import { itemStream } from '../../games/pool.js';
import { answerPoints } from '../../games/round.js';
import { loanwordsOf, wordReveal } from '../../games/answers.js';
import { productionPrompt } from '../../lesson/wordChecks.js';
import { check, isCorrect } from '../../lang/normalise.js';
import { playGame, gbtn, mark, feedbackNodes } from './shell.js';

export const spec = {
  id: 'speed-recall',
  title: 'Speed recall',
  durationMs: 90000,
  rules: ['The English appears. Type it in Roman Urdu.', 'Right answers score 10, up to 15 if you are quick.', 'Misses are marked weak. Right answers can count as a real review.'],
  mount(stage, api) {
    const next = itemStream(poolFor('speed-recall', store.data, getContent(), Date.now()));

    function ask() {
      if (api.isOver()) return;
      const item = next();
      const p = productionPrompt(item.word);
      const shownAt = api.now();
      const input = h('input', { class: 'field game-input', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Roman Urdu', 'aria-label': 'Your answer' });
      const feedback = h('div', { class: 'game-feedback', 'aria-live': 'polite' });
      let done = false;
      const go = gbtn('Check', () => submit(input.value));
      const skip = gbtn('Don’t know', () => submit(''), 'gbtn-ghost');
      input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit(input.value)));

      function submit(text) {
        if (done || api.isOver()) return;
        done = true;
        const r = text.trim() ? check(text, [item.word.roman], { loanwords: loanwordsOf(item.word) }) : { result: 'wrong' };
        const right = isCorrect(r.result);
        const reveal = wordReveal(item.word);
        api.answer({ key: item.id, cardId: item.cardId, correct: right, format: 'speed_recall', points: answerPoints(api.now() - shownAt), miss: reveal });
        input.disabled = go.disabled = skip.disabled = true;
        mark(go, right);
        feedback.replaceChildren(...feedbackNodes(right, reveal));
        if (right) setTimeout(ask, 450);
        else {
          const cont = gbtn('Next', ask);
          feedback.append(cont);
          setTimeout(() => done && cont.isConnected && ask(), 2400);
          cont.focus();
        }
      }

      stage.replaceChildren(h('section', { class: 'card prompt' }, h('p', { class: 'muted small' }, p.label), h('p', { class: 'prompt-text' }, p.text), p.note ? h('p', { class: 'muted small' }, p.note) : null), input, h('div', { class: 'two' }, go, skip), feedback);
      input.focus();
    }
    ask();
  },
};

export function render(container) {
  return playGame(container, spec);
}
