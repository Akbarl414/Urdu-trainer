// The one way Urdu reaches the screen (PLAN §7): Roman Urdu first, the Urdu script beneath it
// only when Settings → "Show Urdu script" is on.
import { h } from './dom.js';

/**
 * @param {{ roman?: string, ur?: string }} item
 * @param {{ showScript: boolean, big?: boolean }} opts
 */
export function urduText({ roman, ur }, { showScript, big = false }) {
  return h(
    'span',
    { class: `urdu${big ? ' urdu-big' : ''}` },
    roman ? h('span', { class: 'urdu-roman' }, roman) : null,
    showScript && ur ? h('span', { class: 'urdu-script', lang: 'ur', dir: 'rtl' }, ur) : null,
  );
}
