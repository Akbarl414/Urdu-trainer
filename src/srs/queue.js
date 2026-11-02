// The daily review queue (PLAN §5.4). Pure: pass cards and a clock, get ids back.
//
// 1. Candidates: every card due before the study day ends (a New card — a freshly unlocked
//    facet that hasn't been seen yet — counts, with a neutral priority).
// 2. Priority: Learning/Relearning first; then the lowest current retrievability, boosted ×1.25
//    for production facets and ×1.2 for cards a game flagged weak.
// 3. Cap: take at most dailyReviewCap − reviewsDoneToday. The rest stays due. Because the
//    most-forgotten cards go first and FSRS reschedules from the actual review date, a backlog
//    drains over several days instead of arriving in one pile.
// 4. Sibling spacing: no two adjacent cards share an item key (word id / lesson id).

import { retrievability, isProductionFacet, CARD_STATE } from './fsrs.js';
import { parseCardId, facetOf, itemKey } from './facets.js';

const HOUR_MS = 3600 * 1000;
// A freshly unlocked facet has no memory yet: it should be introduced soon, but never ahead of cards that are genuinely overdue.
const NEW_CARD_RETRIEVABILITY = 0.8;
const PRODUCTION_BOOST = 1.25;
const WEAK_BOOST = 1.2;

/** Epoch ms at which the current study day ends (the next rollover hour, local time; DST-safe). */
export function studyDayEnd(now, rolloverHour = 4) {
  const d = new Date(now - rolloverHour * HOUR_MS);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, rolloverHour).getTime();
}

const isLearning = (card) => card.st === CARD_STATE.learning || card.st === CARD_STATE.relearning;

function priority(id, card, now) {
  const facet = facetOf(id);
  const r = card.st === CARD_STATE.new ? NEW_CARD_RETRIEVABILITY : retrievability(card, facet, now);
  return (1 - r) * (isProductionFacet(facet) ? PRODUCTION_BOOST : 1) * (card.weak ? WEAK_BOOST : 1);
}

/** Cards due before the study day ends, in priority order (not yet capped or spaced). */
export function dueInPriorityOrder(cards, now, { rolloverHour = 4, isReviewable = () => true } = {}) {
  const end = studyDayEnd(now, rolloverHour);
  const due = [];
  for (const [id, card] of Object.entries(cards)) {
    if (!parseCardId(id) || parseCardId(id).kind === 'script') continue; // the script deck never enters the main queue
    if (card.due >= end || !isReviewable(id)) continue;
    due.push({ id, card, learning: isLearning(card), score: priority(id, card, now) });
  }
  due.sort((a, b) => {
    if (a.learning !== b.learning) return a.learning ? -1 : 1;
    if (a.learning) return a.card.due - b.card.due || (a.id < b.id ? -1 : 1);
    return b.score - a.score || a.card.due - b.card.due || (a.id < b.id ? -1 : 1);
  });
  return due.map((x) => x.id);
}

/** Reorder so adjacent cards never share an item key where avoidable; unavoidable siblings drift to the end. */
export function spaceSiblings(ids) {
  const rest = [...ids];
  const out = [];
  let last = null;
  while (rest.length) {
    let i = rest.findIndex((id) => itemKey(id) !== last);
    if (i === -1) i = 0;
    const [id] = rest.splice(i, 1);
    out.push(id);
    last = itemKey(id);
  }
  return out;
}

/** Insert `id` about `after` places from the front, nudged to the nearest slot with no sibling beside it. */
export function insertSpaced(queue, id, after = 3) {
  const key = itemKey(id);
  const start = Math.min(after, queue.length);
  for (let pos = start; pos <= queue.length; pos++) {
    const prev = pos > 0 ? itemKey(queue[pos - 1]) : null;
    const next = pos < queue.length ? itemKey(queue[pos]) : null;
    if (prev !== key && next !== key) {
      queue.splice(pos, 0, id);
      return queue;
    }
  }
  queue.push(id); // unavoidable
  return queue;
}

/**
 * Today's queue.
 * @param {{ cards: Record<string, any>, now: number, rolloverHour?: number, cap: number, doneToday?: number,
 *   isReviewable?: (id: string) => boolean }} o
 * @returns {{ queue: string[], dueTotal: number, capRemaining: number, held: number, catchUpDays: number, catchUpMode: boolean }}
 *   held: due cards left for later because of the cap. catchUpMode: backlog above 2× the cap (PLAN D7).
 */
export function buildQueue({ cards, now, rolloverHour = 4, cap, doneToday = 0, isReviewable }) {
  const ordered = dueInPriorityOrder(cards, now, { rolloverHour, isReviewable });
  const capRemaining = Math.max(0, cap - doneToday);
  const taken = ordered.slice(0, capRemaining);
  return {
    queue: spaceSiblings(taken),
    dueTotal: ordered.length,
    capRemaining,
    held: ordered.length - taken.length,
    catchUpDays: cap > 0 ? Math.ceil(ordered.length / cap) : Infinity,
    catchUpMode: ordered.length > cap * 2,
  };
}
