// The "game of the day" card and badge, shared by the Games tab and the Today screen (PLAN D37).
import { h } from '../../ui/dom.js';

export const gotdBadge = (done) => h('span', { class: `chip gotd-badge${done ? ' done' : ''}` }, done ? '✓ Done today' : 'Today’s game');

/** @param {{ game: any, done: boolean }} g @param {{ best?: any }} [o] */
export function gotdCard(g, { best = null } = {}) {
  const meta = g.done ? 'Done for today. Play again any time for a better score.' : 'Play one full round to unlock the other games.';
  return h(
    'a',
    { class: `card gotd${g.done ? ' done' : ''}`, href: `#/games/${g.game.id}` },
    h('p', { class: 'gotd-kicker' }, '◆ Game of the day'),
    h('div', { class: 'row game-row' }, h('h2', {}, g.game.title), gotdBadge(g.done)),
    h('p', {}, g.game.blurb),
    h('p', { class: 'muted small' }, best?.best != null ? `${meta} Best ${best.best}.` : meta),
    h('span', { class: 'btn btn-big' }, g.done ? 'Play again' : 'Play now'),
  );
}
