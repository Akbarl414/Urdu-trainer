// "Record & compare" (BRIEF §5.7): record yourself, hear yourself, hear the model. In memory only.
// Hidden where the browser can't record. `scope` receives the cleanup that frees the microphone and the recording.
import { h } from './dom.js';
import { recordingSupported, createRecorder } from '../audio/recorder.js';
import { canSpeak, speak } from '../audio/tts.js';

/**
 * @param {{ roman?: string, ur?: string, audio?: string }} model  what the learner is trying to say
 * @param {{ add: (fn: () => void) => void }} scope
 */
export function recordCompare(model, scope) {
  if (!recordingSupported()) return null;
  const rec = createRecorder();
  scope.add(() => rec.dispose());
  let state = 'idle'; // idle | recording | recorded
  const note = h('p', { class: 'muted small rec-note' }, 'Your recording stays on this device and is never saved.');
  const row = h('div', { class: 'rec-row' });
  const box = h('div', { class: 'rec' }, row, note);

  function draw() {
    row.replaceChildren();
    if (state === 'recording') {
      row.append(h('button', { class: 'btn btn-small btn-rec', type: 'button', onclick: stop }, '■ Stop'));
      return;
    }
    row.append(h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: start }, state === 'recorded' ? '● Record again' : '● Record yourself'));
    if (state === 'recorded') {
      row.append(h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: () => rec.play() }, '▶ You'));
      if (canSpeak(model)) row.append(h('button', { class: 'btn btn-small btn-secondary', type: 'button', onclick: () => speak(model) }, '▶ Model'));
    }
  }
  async function start() {
    try {
      await rec.start();
      state = 'recording';
      note.textContent = 'Recording…';
    } catch {
      state = 'idle';
      note.textContent = 'The microphone is blocked. Allow it in your browser settings to record yourself.';
    }
    draw();
  }
  async function stop() {
    try {
      await rec.stop();
      state = 'recorded';
      note.textContent = 'Play yours, then the model, and compare. It stays on this device and is never saved.';
    } catch {
      state = 'idle';
    }
    draw();
  }
  draw();
  return box;
}
