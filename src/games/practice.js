// Practice sentences (PLAN D36): extra game material, authored per lesson in `practice_sentences`. Pure.
//
// They feed Sentence sprint and Listen & type only. They are never SRS cards: nothing here creates, reads or changes a card,
// and a wrong answer on one has nothing to mark weak. Everything else about them (ids, romanization, coverage) is checked
// like any other Urdu in the course.
import { tokens } from '../lang/normalise.js';

export const PRACTICE_MIN_TILES = 3;
export const PRACTICE_MAX_TILES = 8;

/** The tiles of a sentence: the same split the dialogues use (hyphen = space, punctuation gone). */
export const practiceTiles = (roman) => tokens(roman);

/** Every accepted word order: the sentence's own, then any listed alternatives. */
export const practiceOrders = (sentence) => [practiceTiles(sentence.roman), ...(sentence.alt_orders ?? [])];

/**
 * A practice sentence in the shape Sentence sprint reads from a reorder exercise.
 * @param {{ id: string, roman: string, ur: string, en: string, audio?: string, alt_orders?: string[][] }} sentence
 */
export function practiceAsExercise(sentence) {
  const { id, roman, ur, en, audio } = sentence;
  return { id, type: 'reorder', sentence: { roman, ur, en, ...(audio ? { audio } : {}) }, tokens: practiceTiles(roman), answerOrders: practiceOrders(sentence) };
}

/**
 * A practice sentence in the shape Listen & type reads from a word. `meaning_en` is kept for reveals; meaning mode doesn't use
 * practice sentences, because a whole sentence can be paraphrased too many ways for the word-meaning check.
 */
export function practiceAsWord(sentence) {
  const { id, roman, ur, en, audio } = sentence;
  return { id, pos: 'sentence', roman, ur, meaning_en: en, ...(audio ? { audio } : {}) };
}
