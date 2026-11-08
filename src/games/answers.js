// Small answer helpers shared by the games. Pure.
import { tokens } from '../lang/normalise.js';
import { exactForm } from '../lang/normalise.js';
import { nounPlural } from '../lang/nounForms.js';

/** Lower-cased tokens of a loanword, so `phone` matches however it is typed (same rule as review cards). */
export const loanwordsOf = (word) => new Set(word?.loanword ? [word.roman, ...(word.forms ?? [])].flatMap((s) => tokens(s)).map((t) => t.toLowerCase()) : []);

/** The reveal after a word question: the Urdu, its meaning, and (nouns) the plural, read only through nounPlural(). */
export function wordReveal(word) {
  const { plural = null } = nounPlural(word) ?? {};
  return { roman: word.roman, ur: word.ur, audio: word.audio, en: word.meaning_en, note: plural ? `plural: ${plural.roman}` : null };
}

/** True when the placed tiles spell any accepted order. */
export const isOrderRight = (orders, placed) => orders.some((o) => o.length === placed.length && o.every((t, i) => exactForm(t) === exactForm(placed[i])));
