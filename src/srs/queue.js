// The daily review queue (PLAN §5.4). Pure: pass cards and a clock, get ids back.
//
// 1. Candidates: every card due before the study day ends (a New card — a freshly unlocked
//    facet that hasn't been seen yet — counts, with a neutral priority).
// 2. Priority: Learning/Relearning first; then the lowest current retrievability, boosted ×1.25
//    for production facets and ×1.2 for cards a game flagged weak.
// 3. Cap: take at most dailyReviewCap − reviewsDoneToday. The rest stays due. Because the
//    most-forgotten cards go first and FSRS reschedules from the actual review date, a backlog
//    drains over several days instead of arriving in one pile.
// 4. Interleaving (PLAN D28): no two cards of one word in a row, cards from the same lesson spread apart,
//    and young cards mixed with old ones.

import { retrievability, isProductionFacet, CARD_STATE } from './fsrs.js';
import { parseCardId, facetOf, itemKey } from './facets.js';
import { stageOf } from './format.js';

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
    if (card.retired || card.due >= end || !isReviewable(id)) continue;
    due.push({ id, card, learning: isLearning(card), score: priority(id, card, now) });
  }
  due.sort((a, b) => {
    if (a.learning !== b.learning) return a.learning ? -1 : 1;
    if (a.learning) return a.card.due - b.card.due || (a.id < b.id ? -1 : 1);
    return b.score - a.score || a.card.due - b.card.due || (a.id < b.id ? -1 : 1);
  });
  return due.map((x) => x.id);
}

/** A card's lesson, when it can be read from the id alone (exercise cards); word cards need `lessonOf` from the caller. */
const defaultLessonOf = (id) => {
  const p = parseCardId(id);
  return p?.kind === 'exercise' ? p.lessonId : null;
};

/** Young cards first, then alternating with old ones, each list keeping its order. */
function mixYoungAndOld(ids, isYoung) {
  const young = ids.filter(isYoung);
  const old = ids.filter((id) => !isYoung(id));
  const out = [];
  for (let i = 0; i < Math.max(young.length, old.length); i++) {
    if (i < young.length) out.push(young[i]);
    if (i < old.length) out.push(old[i]);
  }
  return out;
}

/**
 * Reorder a session (PLAN D28): adjacent cards never share an item key where avoidable (unavoidable siblings drift to
 * the end), cards from one lesson stay apart, and young cards are mixed with old ones.
 * @param {string[]} ids
 * @param {{ lessonOf?: (id: string) => string|null, isYoung?: (id: string) => boolean }} [opts]
 */
export function spaceSiblings(ids, { lessonOf = defaultLessonOf, isYoung = () => false } = {}) {
  const rest = mixYoungAndOld(ids, isYoung);
  // How far apart cards of one lesson can be kept depends on how many lessons are in the session.
  const window = Math.min(3, new Set(rest.map(lessonOf).filter(Boolean)).size - 1);
  const out = [];
  const recentLessons = (n) => out.slice(Math.max(0, out.length - n)).map(lessonOf);
  while (rest.length) {
    const last = out.length ? itemKey(out[out.length - 1]) : null;
    const ok = (id, n) => itemKey(id) !== last && (lessonOf(id) === null || !recentLessons(n).includes(lessonOf(id)));
    let i = -1;
    for (let n = Math.max(0, window); n >= 0 && i === -1; n--) i = rest.findIndex((id) => ok(id, n));
    if (i === -1) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Up to `n` cards from the front of `ids`, chosen so lessons and formats differ as much as possible (the warm-up, PLAN D28).
 * @param {string[]} ids  in priority order
 * @param {number} n
 * @param {{ lessonOf?: (id: string) => string|null, formatOf?: (id: string) => string|null, first?: (id: string) => boolean }} [opts]
 *   first: cards to choose before any others (the previous lesson's new words, PLAN D32)
 */
export function pickVaried(ids, n, { lessonOf = defaultLessonOf, formatOf = () => null, first = () => false } = {}) {
  const rest = [...ids];
  const out = [];
  const lessons = new Set();
  const formats = new Set();
  while (out.length < n && rest.length) {
    let best = 0;
    let bestScore = -1;
    rest.forEach((id, i) => {
      const lesson = lessonOf(id);
      const format = formatOf(id);
      const score = (first(id) ? 10 : 0) + (lesson !== null && !lessons.has(lesson) ? 2 : 0) + (format !== null && !formats.has(format) ? 1 : 0) + (out.some((x) => itemKey(x) === itemKey(id)) ? -3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    const [id] = rest.splice(best, 1);
    out.push(id);
    lessons.add(lessonOf(id));
    formats.add(formatOf(id));
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
 *   isReviewable?: (id: string) => boolean, lessonOf?: (id: string) => string|null }} o
 * @returns {{ queue: string[], dueTotal: number, capRemaining: number, held: number, catchUpDays: number, catchUpMode: boolean }}
 *   held: due cards left for later because of the cap. catchUpMode: backlog above 2× the cap (PLAN D7).
 */
export function buildQueue({ cards, now, rolloverHour = 4, cap, doneToday = 0, isReviewable, lessonOf }) {
  const ordered = dueInPriorityOrder(cards, now, { rolloverHour, isReviewable });
  const capRemaining = Math.max(0, cap - doneToday);
  const taken = ordered.slice(0, capRemaining);
  return {
    queue: spaceSiblings(taken, { lessonOf, isYoung: (id) => isLearning(cards[id]) || stageOf(cards[id]) === 'new' || stageOf(cards[id]) === 'learning' }),
    dueTotal: ordered.length,
    capRemaining,
    held: ordered.length - taken.length,
    catchUpDays: cap > 0 ? Math.ceil(ordered.length / cap) : Infinity,
    catchUpMode: ordered.length > cap * 2,
  };
}
