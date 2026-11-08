// The quick checks after "New to me" on a word (PLAN §6.2): recognition (Urdu → pick the meaning),
// then production (say or type the Urdu). Pure.

import { seededShuffle } from './exercises.js';

/**
 * Pick-the-meaning options for a word.
 * @param {any} word
 * @param {any[]} pool  candidate words for distractors, nearest first (the lesson's other words, then the rest)
 * @param {number} [count] options in total
 * @param {string} [seed]  option order; the review card passes one that changes between reviews
 * @returns {{ options: string[], answerIndex: number }}
 */
export function recognitionOptions(word, pool, count = 4, seed = `recog:${word.id}`) {
  const taken = new Set([word.meaning_en]);
  const samePos = pool.filter((w) => w.id !== word.id && w.pos === word.pos);
  const others = pool.filter((w) => w.id !== word.id && w.pos !== word.pos);
  const distractors = [];
  for (const w of [...samePos, ...others]) {
    if (distractors.length >= count - 1) break;
    if (!w.meaning_en || taken.has(w.meaning_en)) continue;
    taken.add(w.meaning_en);
    distractors.push(w.meaning_en);
  }
  const options = seededShuffle([word.meaning_en, ...distractors], seed);
  return { options, answerIndex: options.indexOf(word.meaning_en) };
}

/** What the production check asks: phrases are prompted by their situation (PLAN D22), other words by their meaning. */
export function productionPrompt(word) {
  if (word.pos === 'phrase') return { label: 'What would you say here?', text: word.situation ?? word.meaning_en };
  return { label: 'How do you say this in Urdu?', text: word.meaning_en, note: word.pos };
}

/** Roman answers accepted for a word's production check. */
export const productionAnswers = (word) => [word.roman];
