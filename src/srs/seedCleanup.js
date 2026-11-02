// One-off boot cleanup for the Phase 2 test cards (PLAN D21). Pure.
//
// Phase 2 shipped a #/debug/seed page that added made-up cards with ids `w:seed-…` and
// `x:seed-lesson:…` to the main deck. Phase 3 removed that page; this deletes any such cards still
// on a device, and NOTHING else. No course word id starts with `seed-` and no lesson is called
// `seed-lesson`, so a real card can never match.
//
// TEMPORARY: delete this file, its test and its call in src/main.js once it has had time to run on
// the devices that used the test cards (it is harmless to keep longer: it is a no-op without them).

export const isSeedCardId = (id) => typeof id === 'string' && (id.startsWith('w:seed-') || id.startsWith('x:seed-lesson:'));

/**
 * Remove the Phase 2 test cards from the main deck. Touches no other card, deck or field.
 * @returns {number} cards removed (0 means nothing changed and nothing needs saving)
 */
export function removeSeedCards(data) {
  const cards = data?.srs?.decks?.main?.cards;
  if (!cards) return 0;
  let n = 0;
  for (const id of Object.keys(cards)) {
    if (isSeedCardId(id)) {
      delete cards[id];
      n++;
    }
  }
  return n;
}
