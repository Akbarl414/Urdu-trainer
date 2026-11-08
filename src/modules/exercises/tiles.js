// Put word tiles in order (reorder exercises). Tap a tile to place it, tap a placed tile to take it back.
import { h } from '../../ui/dom.js';

/**
 * @param {string[]} tokens  the tiles, already shuffled
 * @param {(placed: string[]) => void} onCheck
 * @param {{ partial?: boolean }} [opts]  partial: some tiles are wrong ones, so Check doesn't wait for all of them
 */
export function tilesView(tokens, onCheck, { partial = false } = {}) {
  let placed = []; // indexes into tokens, in the order placed
  let locked = false;
  const line = h('div', { class: 'tile-line', 'aria-label': 'Your sentence' });
  const bank = h('div', { class: 'tile-bank', 'aria-label': 'Word tiles' });
  const check = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => !locked && ((locked = true), onCheck(placed.map((i) => tokens[i]))) }, 'Check');
  const reset = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => !locked && ((placed = []), draw()) }, 'Start again');

  function tile(i, onclick) {
    return h('button', { class: 'tile tile-btn', type: 'button', onclick: () => !locked && onclick() }, tokens[i]);
  }
  function draw() {
    line.replaceChildren(...(placed.length ? placed.map((i) => tile(i, () => ((placed = placed.filter((p) => p !== i)), draw()))) : [h('span', { class: 'muted small' }, 'Tap the words in order')]));
    bank.replaceChildren(...tokens.map((_, i) => (placed.includes(i) ? h('span', { class: 'tile tile-gap', 'aria-hidden': 'true' }, tokens[i]) : tile(i, () => (placed.push(i), draw())))));
    check.disabled = (partial ? placed.length === 0 : placed.length !== tokens.length) || locked;
    reset.hidden = placed.length === 0;
  }
  draw();
  return {
    el: h('div', { class: 'tiles-view' }, line, bank, h('div', { class: 'stack' }, check, reset)),
    /** Colour the line after checking and stop further changes. */
    lock(correct) {
      locked = true;
      check.hidden = true;
      reset.hidden = true;
      line.classList.add(correct ? 'is-correct' : 'is-wrong');
      bank.hidden = true;
      line.querySelectorAll('button').forEach((b) => (b.disabled = true));
    },
  };
}
