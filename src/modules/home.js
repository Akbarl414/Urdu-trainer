// Placeholder home screen for Phase 1. The real Today screen arrives in Phase 3.
import { h } from '../ui/dom.js';
import { store } from '../db/storage.js';
import { getContent } from '../db/contentLoader.js';

export function render(container) {
  const content = getContent();
  const data = store.data;
  const cards = Object.keys(data.srs.decks.main.cards).length;

  container.append(
    h(
      'main',
      { class: 'page' },
      h('h1', {}, 'Urdu Trainer'),
      h('p', { class: 'muted' }, 'Phase 1: foundations are in place. Lessons arrive in Phase 3.'),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Status'),
        h(
          'dl',
          { class: 'facts' },
          h('dt', {}, 'Build'),
          h('dd', {}, __BUILD_ID__),
          h('dt', {}, 'Content'),
          h('dd', {}, `${content.units.length} units · ${content.lessons.length} lessons · ${content.words.length} words`),
          h('dt', {}, 'Saved progress'),
          h('dd', {}, `${Object.keys(data.progress.lessons).length} lessons · ${cards} review cards`),
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Voice test'),
        h('p', {}, 'See which text-to-speech voices this device offers, and whether any of them speak Urdu.'),
        h('a', { class: 'btn', href: '#/debug/voices' }, 'Open voice test'),
      ),
    ),
  );
}
