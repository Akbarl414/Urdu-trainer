// Speaker button for a piece of Urdu. Hidden unless something on this device can speak it (audio file,
// Urdu voice, or the Hindi fallback — see src/audio/tts.js), and it re-checks when the voice list changes.
import { h } from './dom.js';
import { canSpeak, speak, onAudioChange } from '../audio/tts.js';

/**
 * @param {{ roman?: string, ur?: string, audio?: string }} item
 * @param {{ label?: string, big?: boolean }} [opts]
 */
export function audioButton(item, { label = 'Listen', big = false } = {}) {
  const btn = h('button', { class: `audio-btn${big ? ' audio-big' : ''}`, type: 'button', 'aria-label': label, title: label }, h('span', { 'aria-hidden': 'true' }, '🔊'), big ? h('span', { class: 'audio-label' }, label) : null);
  let off = null;
  const refresh = () => {
    btn.hidden = !canSpeak(item);
    if (!btn.isConnected && off && btn.dataset.seen) off(); // the screen is gone: stop listening
    if (btn.isConnected) btn.dataset.seen = '1';
  };
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.classList.add('playing');
    try {
      await speak(item);
    } finally {
      btn.classList.remove('playing');
    }
  });
  off = onAudioChange(refresh);
  refresh();
  return btn;
}
