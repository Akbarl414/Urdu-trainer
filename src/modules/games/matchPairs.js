// Match pairs: a quick warm-up. Tap an Urdu word and its English meaning. Boards of six keep coming until the clock runs out.
// Picking is not recall, so this game never earns review credit; a wrong match still marks both words weak.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { poolFor } from '../../games/catalog.js';
import { makeBoard } from '../../games/matchBoard.js';
import { PAIR_POINTS, BOARD_BONUS } from '../../games/round.js';
import { wordReveal } from '../../games/answers.js';
import { playGame, mark } from './shell.js';

export const spec = {
  id: 'match-pairs',
  title: 'Match pairs',
  durationMs: 90000,
  rules: ['Tap an Urdu word, then the English that matches it.', 'Each pair scores 10. Clear all six for a bonus and a fresh board.', 'This is a warm-up: it never counts as a review. Mismatches mark both words weak.'],
  mount(stage, api) {
    const pool = poolFor('match-pairs', store.data, getContent(), Date.now());

    function board() {
      if (api.isOver()) return;
      const b = makeBoard(pool);
      let left = null; // the selected pair id on each side
      let right = null;
      let remaining = b.pairs.length;
      let busy = false;
      const buttons = new Map();
      const btn = (side, p) => {
        const label = side === 'l' ? p.word.roman : p.word.meaning_en;
        const el = h('button', { class: 'gbtn gbtn-pair', type: 'button', 'data-side': side, onclick: () => tap(side, p, el) }, label);
        buttons.set(`${side}:${p.id}`, el);
        return el;
      };
      function tap(side, p, el) {
        if (busy || api.isOver() || el.disabled) return;
        if (side === 'l') {
          buttons.get(`l:${left?.id}`)?.classList.remove('is-picked');
          left = p;
        } else {
          buttons.get(`r:${right?.id}`)?.classList.remove('is-picked');
          right = p;
        }
        el.classList.add('is-picked');
        if (left && right) resolve();
      }
      function resolve() {
        const [a, c] = [left, right];
        const lb = buttons.get(`l:${a.id}`);
        const rb = buttons.get(`r:${c.id}`);
        left = right = null;
        busy = true;
        if (a.id === c.id) {
          api.answer({ key: a.id, cardId: a.cardId, correct: true, format: 'match', points: PAIR_POINTS });
          for (const e of [lb, rb]) (e.classList.remove('is-picked'), mark(e, true), (e.disabled = true));
          lb.append(' ✓');
          rb.append(' ✓');
          remaining -= 1;
          setTimeout(() => {
            busy = false;
            if (remaining === 0) {
              api.addScore(BOARD_BONUS);
              setTimeout(board, 250);
            }
          }, 250);
        } else {
          api.answer({ key: a.id, cardId: a.cardId, correct: false, format: 'match', miss: wordReveal(a.word) });
          api.answer({ key: c.id, cardId: c.cardId, correct: false, format: 'match', uncounted: true, miss: wordReveal(c.word) });
          for (const e of [lb, rb]) (e.classList.remove('is-picked'), mark(e, false));
          setTimeout(() => {
            for (const e of [lb, rb]) e.classList.remove('is-wrong');
            busy = false;
          }, 450);
        }
      }
      stage.replaceChildren(h('p', { class: 'center muted small' }, 'Tap one on each side'), h('div', { class: 'pairs' }, h('div', { class: 'pair-col' }, b.left.map((p) => btn('l', p))), h('div', { class: 'pair-col' }, b.right.map((p) => btn('r', p)))));
    }
    board();
  },
};

export function render(container) {
  return playGame(container, spec);
}
