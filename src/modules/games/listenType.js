// Listen & type: the voice says a word or short phrase; type what it means, or the Urdu you heard. Credit-eligible (listening).
import { h } from '../../ui/dom.js';
import { audioButton } from '../../ui/audioButton.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { poolFor } from '../../games/catalog.js';
import { itemStream } from '../../games/pool.js';
import { answerPoints } from '../../games/round.js';
import { loanwordsOf, wordReveal } from '../../games/answers.js';
import { isMeaningRight } from '../../games/englishMatch.js';
import { check, isCorrect } from '../../lang/normalise.js';
import { speak, canSpeak } from '../../audio/tts.js';
import { playGame, gbtn, mark, feedbackNodes } from './shell.js';

export const spec = {
  id: 'listen-type',
  title: 'Listen & type',
  durationMs: 90000,
  rules: ['Listen, then type your answer. Tap Play to hear it again.', 'Right answers score 10, up to 15 if you are quick.', 'Misses in “The Urdu” are marked weak (not in “The meaning”). Right answers can count as a real review.'],
  options: { label: 'I will type', choices: [{ id: 'urdu', label: 'The Urdu' }, { id: 'meaning', label: 'The meaning' }] },
  mount(stage, api, { option }) {
    const asMeaning = option === 'meaning';
    const next = itemStream(poolFor('listen-type', store.data, getContent(), Date.now()).filter((p) => canSpeak(p.word)));

    function ask() {
      if (api.isOver()) return;
      const item = next();
      const shownAt = api.now();
      const input = h('input', { class: 'field game-input', type: 'text', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: asMeaning ? 'What does it mean?' : 'Roman Urdu', 'aria-label': 'Your answer' });
      const feedback = h('div', { class: 'game-feedback', 'aria-live': 'polite' });
      const say = { roman: item.word.roman, ur: item.word.ur, audio: item.word.audio };
      let done = false;
      const go = gbtn('Check', () => submit(input.value));
      const skip = gbtn('Don’t know', () => submit(''), 'gbtn-ghost');
      input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit(input.value)));

      function submit(text) {
        if (done || api.isOver()) return;
        done = true;
        let right = false;
        if (text.trim()) right = asMeaning ? isMeaningRight(text, item.word.meaning_en) : isCorrect(check(text, [item.word.roman], { loanwords: loanwordsOf(item.word) }).result);
        const reveal = wordReveal(item.word);
        api.answer({ key: item.id, cardId: item.cardId, correct: right, format: 'listening', points: answerPoints(api.now() - shownAt), miss: reveal, noWeak: asMeaning });
        input.disabled = go.disabled = skip.disabled = true;
        mark(go, right);
        feedback.replaceChildren(...feedbackNodes(right, reveal));
        if (right) setTimeout(ask, 600);
        else {
          const cont = gbtn('Next', ask);
          feedback.append(cont);
          setTimeout(() => done && cont.isConnected && ask(), 2600);
        }
      }

      stage.replaceChildren(h('section', { class: 'card prompt' }, h('p', { class: 'muted small' }, asMeaning ? 'What does it mean?' : 'Type what you hear'), h('div', { class: 'listen-play' }, audioButton(say, { big: true, label: 'Play' }))), input, h('div', { class: 'two' }, go, skip), feedback);
      speak(say); // may be blocked until the first tap on some phones: the Play button always works
      input.focus();
    }
    ask();
  },
};

export function render(container) {
  return playGame(container, spec);
}
