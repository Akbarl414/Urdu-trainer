// Plural forms of a noun, as the app may use them (PLAN D26). Pure.
//
// The ONLY way app code (cards, games) reads a noun's plural. It returns null when there is no plural to
// practise: mass nouns, and nouns flagged `plural_rare` (ammiyaaN, abbuuoN: grammatical but rarely said, so
// they never become plural cards, game items or plural reveals). An `invariable` loanword (aunty, uncle) uses
// its own form for singular, plural and oblique.

/**
 * @returns {{ plural: { roman: string, ur: string }, oblique_pl: { roman: string, ur: string } } | null}
 */
export function nounPlural(word) {
  if (!word || word.pos !== 'noun' || word.mass || word.plural_rare) return null;
  if (word.invariable) {
    const same = { roman: word.roman, ur: word.ur };
    return { plural: same, oblique_pl: same };
  }
  if (!word.plural || !word.oblique_pl) return null;
  return { plural: { roman: word.plural.roman, ur: word.plural.ur }, oblique_pl: { roman: word.oblique_pl.roman, ur: word.oblique_pl.ur } };
}
