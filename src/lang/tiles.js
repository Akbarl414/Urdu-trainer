// Splits Roman Urdu into tap-to-build tiles (the "tiles" review format, PLAN D28). Pure.
//   several words   → one tile per word
//   one long word   → syllables (khaa · naa, al · ham · du · lil · laah)
//   one short word  → sounds (d · o · s · t)
import { tokens } from './normalise.js';

const GRAPHEME = /chh|cch|kh|gh|ch|sh|Gh|Th|Dh|Rh|th|dh|ph|bh|jh|aa|ii|uu|ai|au|./g;
const isVowel = (g) => /^[aeiou]/.test(g);

export const graphemes = (word) => word.match(GRAPHEME) ?? [];

/** Consonants between two vowels: the last one starts the next syllable, the others close this one. */
export function syllables(word) {
  const g = graphemes(word);
  const out = [];
  let i = 0;
  while (i < g.length) {
    let syl = '';
    while (i < g.length && !isVowel(g[i])) syl += g[i++];
    while (i < g.length && isVowel(g[i])) syl += g[i++];
    if (g[i] === 'N') syl += g[i++];
    let j = i;
    while (j < g.length && !isVowel(g[j])) j++;
    const keepForNext = j < g.length ? 1 : 0; // no vowel left: the rest of the consonants close this syllable
    while (i < j - keepForNext) syl += g[i++];
    out.push(syl);
  }
  return out;
}

/** The tiles that build this word or phrase, in order. */
export function chunksOf(roman) {
  const words = tokens(roman);
  if (words.length > 1) return words;
  const syl = syllables(words[0] ?? '');
  return syl.length > 1 ? syl : graphemes(words[0] ?? '');
}
