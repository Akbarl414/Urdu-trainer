// Prose with Urdu in `backticks` (CLAUDE.md, Content): the backticked parts are Roman Urdu and get their own style.
import { h } from './dom.js';

/** @param {string} text @returns {(Node|string)[]} */
export function prose(text) {
  return String(text ?? '')
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('`') && part.endsWith('`') ? h('span', { class: 'rom' }, part.slice(1, -1)) : part));
}

/** A paragraph of prose. */
export const para = (text, cls = '') => h('p', { class: cls }, ...prose(text));
