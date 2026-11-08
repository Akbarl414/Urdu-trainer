// Which format a word's main card takes today (PLAN D28). Pure.
//
// One main card per word. The format follows how well the word is held, and it never repeats twice in a row:
//   new       multiple choice    (Urdu → pick the meaning)
//   learning  tiles              (build the Urdu)
//   known     typed recall       (English → type or say the Urdu)
//   strong    listening or in-sentence recall
// Phrases rotate between a "meaning" format and a "situation" format instead.
//
// The format last shown is kept on the card as `f`.

/** Stability (days) at which a card moves up a stage. New cards have stability 0. */
export const STAGE_DAYS = Object.freeze({ learning: 4, known: 14, strong: 45 });

export const WORD_FORMATS = Object.freeze(['choice', 'tiles', 'typed', 'listen', 'sentence']);
export const PHRASE_FORMATS = Object.freeze(['meaning_choice', 'situation_choice', 'situation_tiles', 'situation_typed', 'listen', 'meaning_reveal']);

/** @returns {'new'|'learning'|'known'|'strong'} */
export function stageOf(card) {
  const s = card?.s ?? 0;
  if (s >= STAGE_DAYS.strong) return 'strong';
  if (s >= STAGE_DAYS.known) return 'known';
  if (s >= STAGE_DAYS.learning) return 'learning';
  return 'new';
}

// Preference order for each stage. The first one that is available and isn't the last format shown wins.
const WORD_ORDER = {
  new: ['choice', 'tiles', 'typed'],
  learning: ['tiles', 'choice', 'typed'],
  known: ['typed', 'tiles', 'choice'],
  strong: ['listen', 'sentence', 'typed', 'tiles'],
};
const PHRASE_ORDER = {
  new: ['meaning_choice', 'situation_choice', 'situation_tiles'],
  learning: ['situation_tiles', 'meaning_choice', 'situation_choice'],
  known: ['situation_typed', 'listen', 'meaning_reveal', 'situation_tiles'],
  strong: ['situation_typed', 'listen', 'meaning_reveal', 'situation_tiles'],
};

/**
 * @param {{ card?: any, phrase?: boolean, available?: (format: string) => boolean }} o
 * @returns {string} a format name
 */
export function chooseFormat({ card, phrase = false, available = () => true }) {
  const table = phrase ? PHRASE_ORDER : WORD_ORDER;
  const all = phrase ? PHRASE_FORMATS : WORD_FORMATS;
  const last = card?.f;
  const usable = table[stageOf(card)].filter(available);
  const next = usable.find((f) => f !== last);
  if (next) return next;
  // Nothing in this stage works (e.g. no voice and no example sentence): any other available format beats a repeat.
  return all.find((f) => f !== last && available(f)) ?? usable[0] ?? all[0];
}
