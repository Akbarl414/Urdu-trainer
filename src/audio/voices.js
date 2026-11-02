// Urdu voice detection. Pure helpers + a loader that copes with iOS/Safari
// returning an empty voice list until `voiceschanged` fires (or later).
// Phase 3's tts.js builds on this; Phase 1 uses it for #/debug/voices.

/** True for ur, ur-PK, ur-IN (also tolerates ur_PK, as some Android builds report it). */
export function isUrduVoice(voice) {
  return /^ur([-_]|$)/i.test(voice?.lang ?? '');
}

export function isHindiVoice(voice) {
  return /^hi([-_]|$)/i.test(voice?.lang ?? '');
}

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Resolves with the voice list once it is non-empty, or after timeoutMs with whatever there is (possibly []).
 * @param {{ timeoutMs?: number }} [opts]
 */
export function loadVoices({ timeoutMs = 4000 } = {}) {
  if (!speechSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearTimeout(timeout);
      synth.removeEventListener?.('voiceschanged', check);
      resolve(synth.getVoices());
    };
    const check = () => {
      if (synth.getVoices().length > 0) finish();
    };
    synth.addEventListener?.('voiceschanged', check);
    const timer = setInterval(check, 250); // some browsers never fire voiceschanged
    const timeout = setTimeout(finish, timeoutMs);
    check();
  });
}

/** Plain-text report of the voices on this device, for pasting into a chat. */
export function formatReport(voices, { userAgent = '', supported = true } = {}) {
  const lines = [`User agent: ${userAgent}`, `speechSynthesis: ${supported ? 'supported' : 'NOT supported'}`, `Voices: ${voices.length}`, `Urdu (ur*) voices: ${voices.filter(isUrduVoice).length}`, `Hindi (hi*) voices: ${voices.filter(isHindiVoice).length}`, ''];
  const sorted = [...voices].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  for (const v of sorted) {
    lines.push(`${isUrduVoice(v) ? '★ ' : '  '}${v.lang}\t${v.name}\t${v.localService ? 'local' : 'remote'}${v.default ? '\tdefault' : ''}`);
  }
  return lines.join('\n');
}
