// Decides HOW a piece of Urdu gets spoken on this device (PLAN D13). Pure, so Node can test it.
//   1. `audio` file, when the item has one          → { kind: 'file' }
//   2. an Urdu voice, speaking the `ur` field        → { kind: 'ur' }
//   3. else a Hindi voice, speaking roman→Devanagari → { kind: 'hi' }
//   4. else nothing                                  → { kind: 'none' }
import { isUrduVoice, isHindiVoice } from './voices.js';
import { romanToDevanagari } from '../lang/devanagari.js';

const best = (voices) => voices.find((v) => v.localService) ?? voices[0] ?? null;

/**
 * @param {{ roman?: string, ur?: string, audio?: string, loanword?: boolean }} item
 * @param {SpeechSynthesisVoice[]} voices
 * @param {{ loanwords?: Iterable<string> }} [opts]
 */
export function planSpeech(item, voices, opts = {}) {
  if (item.audio) return { kind: 'file', src: item.audio };
  const urdu = best(voices.filter(isUrduVoice));
  if (urdu && item.ur) return { kind: 'ur', voice: urdu, text: item.ur, lang: urdu.lang };
  const hindi = best(voices.filter(isHindiVoice));
  if (hindi && item.roman) return { kind: 'hi', voice: hindi, text: romanToDevanagari(item.roman, opts), lang: hindi.lang };
  return { kind: 'none' };
}
