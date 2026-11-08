// The Games tab: what is on offer, personal bests, and a way into the stats.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { getContent } from '../../db/contentLoader.js';
import { GAMES, availability } from '../../games/catalog.js';
import { bestOf } from '../../games/outcome.js';
import { canSpeak, onAudioChange, isAudioReady } from '../../audio/tts.js';
import { lockedNote } from './play.js';

export function render(container) {
  const page = h('main', { class: 'page games-hub' });
  container.append(page);
  const draw = () => {
    const ctx = { data: store.data, content: getContent(), now: Date.now(), canListen: canSpeak({ roman: 'x', ur: 'x' }) };
    page.replaceChildren(
      h('h1', {}, 'Games'),
      h('p', { class: 'muted' }, 'Short rounds from words you have learned. Weak and recent ones come up most.'),
      ...GAMES.map((g) => {
        const a = availability(g.id, ctx);
        const best = bestOf(store.data, g.id);
        const body = [
          h('div', { class: 'row game-row' }, h('h2', {}, g.title), g.credit ? h('span', { class: 'chip', title: 'Right answers can count as a review' }, 'counts as review') : null),
          h('p', {}, g.blurb),
          h('p', { class: 'muted small' }, a.ok ? (best?.best != null ? `Best ${best.best} · ${best.rounds ?? 1} round${best.rounds === 1 ? '' : 's'} · ${g.seconds}s a round` : `${g.seconds}s a round · no score yet`) : lockedNote(a)),
        ];
        return a.ok ? h('a', { class: 'card game-card', href: `#/games/${g.id}` }, ...body, h('span', { class: 'btn' }, 'Play')) : h('section', { class: 'card game-card locked', 'aria-disabled': 'true' }, ...body);
      }),
      h('a', { class: 'card game-card stats-link', href: '#/stats' }, h('h2', {}, 'Your progress'), h('p', { class: 'muted' }, 'Reviews, words learned, accuracy, units, streak and personal bests.')),
      h('p', { class: 'muted small' }, 'Gender sort, agreement snap and the “ne” game may come later.'),
    );
  };
  draw();
  const off = onAudioChange(draw);
  void isAudioReady;
  return off;
}
