// Settings (minimal; Phase 5 adds the rest): the look, and the memory target.
import { h } from '../../ui/dom.js';
import { store } from '../../db/storage.js';
import { themeSwitcher } from '../../ui/theme.js';
import { voiceRoute, onAudioChange, isAudioReady } from '../../audio/tts.js';

const MEMORY_NOTE = {
  relaxed: 'Fewest reviews. You will remember about 80% of cards when they come back.',
  balanced: 'More reviews. You will remember about 85% of cards when they come back.',
  strong: 'Most reviews. You will remember about 90% of cards when they come back.',
};

export function render(container) {
  const page = h('main', { class: 'page settings' });
  container.append(page);
  const memory = h('section', { class: 'card' });
  function drawMemory() {
    const current = store.data.settings.memoryTarget;
    const seg = (value, label) => h('button', { class: `seg${current === value ? ' on' : ''}`, type: 'button', 'aria-pressed': current === value ? 'true' : 'false', onclick: () => (store.updateSettings({ memoryTarget: value }), drawMemory()) }, label);
    memory.replaceChildren(
      h('h2', {}, 'Memory target'),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Memory target' }, seg('relaxed', 'Relaxed'), seg('balanced', 'Balanced'), seg('strong', 'Strong')),
      h('p', { class: 'muted small' }, MEMORY_NOTE[current] ?? MEMORY_NOTE.relaxed),
      h('p', { class: 'muted small' }, 'Applies from each card’s next review.'),
    );
  }
  drawMemory();

  const gender = h('section', { class: 'card' });
  function drawGender() {
    const cur = store.data.settings.learnerGender;
    const seg = (value, label) => h('button', { class: `seg${cur === value ? ' on' : ''}`, type: 'button', 'aria-pressed': cur === value ? 'true' : 'false', onclick: () => (store.updateSettings({ learnerGender: value }), drawGender()) }, label);
    gender.replaceChildren(
      h('h2', {}, 'Your lines'),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Forms for your own sentences' }, seg('m', 'Man’s forms'), seg('f', 'Woman’s forms')),
      h('p', { class: 'muted small' }, cur ? 'Your own lines in lessons, exercises and reviews use these forms.' : 'Not chosen yet. Pick which forms of your own sentences you practise.'),
    );
  }
  drawGender();

  const voiceNote = h('p', { class: 'muted small', hidden: true });
  const drawVoice = () => {
    const none = isAudioReady() && voiceRoute() === 'none';
    voiceNote.hidden = !none;
    voiceNote.textContent = none ? 'No voice on this device speaks Urdu or Hindi, so the audio buttons are hidden.' : '';
  };
  drawVoice();
  const offAudio = onAudioChange(drawVoice);
  page.append(h('h1', {}, 'Settings'), themeSwitcher(), memory, gender, h('section', { class: 'card' }, h('h2', {}, 'Voice'), voiceNote, h('p', { class: 'small' }, h('a', { href: '#/debug/voices' }, 'Voice test'))), h('p', { class: 'muted small' }, 'More settings (reminders, backup) arrive in a later phase.'));
  return () => offAudio();
}
