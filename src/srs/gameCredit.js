// When a correct game answer counts as a Good review (PLAN D30). Pure. Replaces the old rule that games never
// push a card's next review later, with guards so a game can't quietly stand in for real recall:
//   1. Only recall formats earn credit: typed, speed recall from memory, listening. Picking from options never does.
//   2. Only cards in the Review state, and only when the card is due or within 20% of its interval from being due.
//   3. At most one game credit per card per study day (recorded on the card as `gc`).

import { CARD_STATE } from './fsrs.js';

export const GAME_CREDIT_FORMATS = Object.freeze(['typed', 'speed_recall', 'listening']);
export const GAME_CREDIT_WINDOW = 0.2;

/**
 * @param {{ card: any, format: string, now: number, day: string|number }} o  day: the current study day
 * @returns {boolean}
 */
export function earnsGameCredit({ card, format, now, day }) {
  if (!GAME_CREDIT_FORMATS.includes(format)) return false;
  if (!card || card.retired || card.st !== CARD_STATE.review || card.lr == null) return false;
  if (card.gc === day) return false;
  return card.due - now <= GAME_CREDIT_WINDOW * (card.due - card.lr);
}
