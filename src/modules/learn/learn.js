// Placeholder until Phase 5 (grammar library and word list).
import { h } from '../../ui/dom.js';

export function render(container) {
  container.append(h('main', { class: 'page' }, h('h1', {}, 'Learn'), h('section', { class: 'card' }, h('h2', {}, 'Coming soon'), h('p', { class: 'muted' }, 'The grammar library and word list arrive in a later phase. For now your lessons are on the Today tab.'), h('a', { class: 'btn btn-secondary', href: '#/' }, 'Back to Today'))));
}
