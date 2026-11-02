// Speaking Urdu on this device (PLAN §10, D13). The decision of HOW to speak lives in speakPlan.js; this
// module owns the browser side: the voice list, playing a file or an utterance, and "is there anything usable?".
//
//   pre-recorded `audio` file  >  Urdu voice reading the `ur` field  >  Hindi voice reading roman→Devanagari  >  nothing
//
// When nothing can speak, canSpeak() is false and the UI hides its audio buttons (and the planner drops listen exercises).

import { loadVoices, speechSupported } from './voices.js';
import { planSpeech } from './speakPlan.js';

let voices = [];
let ready = false;
let readyPromise = null;
let loanwords = new Set();
let getSettings = () => ({ audio: true, speechRate: 0.9 });
let current = null; // { stop() } for whatever is playing
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

/** @param {{ getSettings?: () => { audio?: boolean, speechRate?: number }, loanwords?: Iterable<string> }} o */
export function configureAudio(o = {}) {
  if (o.getSettings) getSettings = o.getSettings;
  if (o.loanwords) loanwords = new Set(o.loanwords);
}

/** Start loading voices (safe to call many times). Resolves once the list is known (possibly empty). */
export function initAudio() {
  if (readyPromise) return readyPromise;
  if (!speechSupported()) {
    ready = true;
    readyPromise = Promise.resolve();
    return readyPromise;
  }
  readyPromise = loadVoices().then((list) => {
    voices = list;
    ready = true;
    notify();
  });
  // Some devices add voices later (downloads, iOS lazy loading): keep the list current.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voices = window.speechSynthesis.getVoices();
    notify();
  });
  return readyPromise;
}

/** Resolves when voices are known, or after `ms` (a device with no voices must not stall the lesson). */
export function whenAudioReady(ms = 1500) {
  initAudio();
  return Promise.race([readyPromise, new Promise((r) => setTimeout(r, ms))]);
}

export const isAudioReady = () => ready;

/** Subscribe to voice-list changes. Returns the unsubscribe function. */
export function onAudioChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const plan = (item) => planSpeech(item, voices, { loanwords });

/** Can this item be spoken right now? Files always can; otherwise a usable Urdu or Hindi voice is needed. */
export function canSpeak(item) {
  if (getSettings().audio === false) return false;
  return plan(item).kind !== 'none';
}

/** What this device can do in general: 'file' is per item, so this reports the voice route. */
export function voiceRoute() {
  return plan({ roman: 'x', ur: 'x' }).kind; // 'ur' | 'hi' | 'none'
}

const fileUrl = (src) => new URL(/^(https?:|\/|audio\/)/.test(src) ? src : `audio/${src}`, document.baseURI).href;

export function stopSpeaking() {
  current?.stop();
  current = null;
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * Speak an item ({ roman, ur, audio? }). Resolves when it ends (or can't play). Never throws.
 * @returns {Promise<'file'|'ur'|'hi'|'none'>} the route used
 */
export function speak(item) {
  stopSpeaking();
  const p = plan(item);
  if (p.kind === 'none' || getSettings().audio === false) return Promise.resolve('none');
  return new Promise((resolve) => {
    if (p.kind === 'file') {
      const audio = new Audio(fileUrl(p.src));
      current = { stop: () => audio.pause() };
      audio.addEventListener('ended', () => resolve('file'));
      audio.addEventListener('error', () => resolve('none'));
      audio.play().catch(() => resolve('none'));
      return;
    }
    const u = new SpeechSynthesisUtterance(p.text);
    u.voice = p.voice;
    u.lang = p.lang;
    u.rate = getSettings().speechRate ?? 0.9;
    u.onend = () => resolve(p.kind);
    u.onerror = () => resolve('none');
    window.speechSynthesis.speak(u);
  });
}
