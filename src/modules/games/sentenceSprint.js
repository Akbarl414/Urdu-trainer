// Sentence sprint: build short sentences from tiles against the clock. Never credit-eligible (tiles are not recall), but a miss
// still marks the sentence's card weak when it has one.
import { h } from '../../ui/dom.js';
import { urduLine } from '../../ui/urduText.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { poolFor } from '../../games/catalog.js';
import { itemStream, sampleWeighted } from '../../games/pool.js';
import { sentencePoints } from '../../games/round.js';
import { isOrderRight } from '../../games/answers.js';
import { playGame, gbtn, mark } from './shell.js';

const shuffled = (list, original) => {
  for (let i = 0; i < 5; i++) {
    const s = sampleWeighted(list.map((x, k) => ({ x, k, weight: 1 })), list.length).map((e) => e.x);
    if (s.join(' ') !== original.join(' ')) return s;
  }
  return [...list].reverse();
};

export const spec = {
  id: 'sentence-sprint',
  title: 'Sentence sprint',
  durationMs: 120000,
  rules: ['The English appears. Tap the tiles in the right order.', 'Tap a placed tile to take it back. The last tile checks it.', 'Longer sentences score more. Misses are marked weak.'],
  mount(stage, api) {
    const next = itemStream(poolFor('sentence-sprint', store.data, getContent(), Date.now()));

    function ask() {
      if (api.isOver()) return;
      const item = next();
      const ex = item.exercise;
      const tokens = shuffled(ex.tokens, ex.answerOrders[0]);
      let placed = []; // indexes into tokens
      let locked = false;
      const line = h('div', { class: 'tile-line game-line', 'aria-label': 'Your sentence' });
      const bank = h('div', { class: 'tile-bank', 'aria-label': 'Word tiles' });
      const feedback = h('div', { class: 'game-feedback', 'aria-live': 'polite' });

      const tile = (i, onclick) => h('button', { class: 'gbtn gbtn-tile', type: 'button', onclick: () => !locked && onclick() }, tokens[i]);
      function draw() {
        line.replaceChildren(...(placed.length ? placed.map((i) => tile(i, () => ((placed = placed.filter((p) => p !== i)), draw()))) : [h('span', { class: 'muted small' }, 'Tap the words in order')]));
        bank.replaceChildren(...tokens.map((_, i) => (placed.includes(i) ? h('span', { class: 'gbtn gbtn-tile tile-gap', 'aria-hidden': 'true' }, tokens[i]) : tile(i, () => (placed.push(i), draw(), placed.length === tokens.length && settle()))))); 
      }
      function settle() {
        locked = true;
        const right = isOrderRight(ex.answerOrders, placed.map((i) => tokens[i]));
        api.answer({ key: item.id, cardId: item.cardId, correct: right, format: 'tiles', points: sentencePoints(tokens.length), miss: { roman: ex.sentence.roman, ur: ex.sentence.ur, en: ex.sentence.en } });
        line.classList.add(right ? 'is-correct' : 'is-wrong');
        bank.hidden = true;
        feedback.replaceChildren(h('p', { class: `feedback ${right ? 'good' : 'bad'}` }, right ? '✓ Right' : '✗ Not quite'));
        if (right) return void setTimeout(ask, 500);
        feedback.append(urduLine(ex.sentence));
        const cont = gbtn('Next', ask);
        feedback.append(cont);
        setTimeout(() => cont.isConnected && ask(), 3000);
      }
      const skip = gbtn(
        'Skip',
        () => {
          if (locked) return;
          locked = true;
          api.answer({ key: item.id, cardId: item.cardId, correct: false, format: 'tiles', miss: { roman: ex.sentence.roman, ur: ex.sentence.ur, en: ex.sentence.en } });
          line.classList.add('is-wrong');
          bank.hidden = true;
          const cont = gbtn('Next', ask);
          feedback.replaceChildren(urduLine(ex.sentence), cont);
          setTimeout(() => cont.isConnected && ask(), 3000);
        },
        'gbtn-ghost',
      );
      stage.replaceChildren(h('section', { class: 'card prompt' }, h('p', { class: 'muted small' }, 'Say it in Urdu'), h('p', { class: 'prompt-text' }, ex.sentence.en)), line, bank, skip, feedback);
      draw();
    }
    ask();
  },
};

export function render(container) {
  return playGame(container, spec);
}
