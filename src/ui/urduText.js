// The one way Urdu reaches the screen (PLAN §7): Roman Urdu first, the Urdu script beneath it.
// The script is always in the DOM and shown or hidden by CSS (`html.show-script`, set from
// settings.showScript), so the toggle works everywhere instantly without redrawing a screen
// (and without losing a half-typed answer).
import { h } from './dom.js';
import { audioButton } from './audioButton.js';

/**
 * @param {{ roman?: string, ur?: string }} item
 * @param {{ big?: boolean }} [opts]
 */
export function urduText({ roman, ur }, { big = false } = {}) {
  return h(
    'span',
    { class: `urdu${big ? ' urdu-big' : ''}` },
    roman ? h('span', { class: 'urdu-roman' }, roman) : null,
    ur ? h('span', { class: 'urdu-script', lang: 'ur', dir: 'rtl' }, ur) : null,
  );
}

/**
 * Urdu text with a speaker button beside it (the button hides itself when nothing on this device can speak it).
 * @param {{ roman?: string, ur?: string, audio?: string }} item
 */
export function urduLine(item, { big = false, audio = true } = {}) {
  return h('span', { class: 'urdu-line' }, urduText(item, { big }), audio ? audioButton(item) : null);
}
