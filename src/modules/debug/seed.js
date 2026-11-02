// #/debug/seed — add / refresh / remove the Phase 2 test cards. Touches ONLY cards whose ids start
// with w:seed- or x:seed-lesson: (see src/srs/seed.js); real progress is never read or changed.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { addSeedCards, makeSeedDue, removeSeedCards, isSeedCardId } from '../../srs/seed.js';

export function render(container) {
  const out = h('p', { class: 'muted' });
  const counts = h('p', {});
  const page = h('main', { class: 'page' });

  const refresh = () => {
    const cards = store.data.srs.decks.main.cards;
    const seeds = Object.keys(cards).filter(isSeedCardId).length;
    counts.textContent = `${seeds} test card${seeds === 1 ? '' : 's'} in your deck · ${Object.keys(cards).length - seeds} real cards (untouched).`;
  };
  const act = (fn, message) => () => {
    const n = fn(store.data, Date.now());
    const saved = store.save();
    out.textContent = `${message(n)}${saved ? '' : ' (storage is full: not saved)'}`;
    refresh();
  };

  page.append(
    h('a', { class: 'back', href: '#/' }, '‹ Home'),
    h('h1', {}, 'Review test cards'),
    h('p', { class: 'muted' }, 'Adds a small set of made-up cards (words, phrases, a few exercises) with different schedules, so you can try the Review screen before lessons exist. Only cards named “seed-…” are ever added, changed or removed.'),
    counts,
    h(
      'div',
      { class: 'stack' },
      h('button', { class: 'btn', onclick: act(addSeedCards, (n) => `Added ${n} card${n === 1 ? '' : 's'}.`) }, 'Add test cards'),
      h('button', { class: 'btn btn-secondary', onclick: act(makeSeedDue, (n) => `${n} test card${n === 1 ? ' is' : 's are'} due again.`) }, 'Make them all due now'),
      h('a', { class: 'btn', href: '#/review' }, 'Open Review'),
      h('button', { class: 'btn btn-secondary', onclick: act((d) => removeSeedCards(d), (n) => `Removed ${n} test card${n === 1 ? '' : 's'}.`) }, 'Remove test cards'),
    ),
    out,
  );
  refresh();
  container.append(page);
}
