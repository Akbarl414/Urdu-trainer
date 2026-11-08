// What a game answer does to the schedule, and what a finished round does to the stats (PLAN §5.6, D30). Pure over the storage blob;
// callers persist with store.save().
//
// EVERY game sends its answers through applyAnswer(), which asks earnsGameCredit() (src/srs/gameCredit.js) before crediting:
//   * a correct answer in a recall format (typed, speed recall, listening) on a due Review-state card, once per card per study day,
//     counts as a Good review (and as one review towards the daily cap);
//   * a correct answer that fails a guard changes nothing;
//   * a wrong answer marks the card weak (and pulls a far-off due date back to the end of today). It never reschedules later.
// Match pairs and Sentence sprint pass a non-recall format, so they can never earn credit, whatever else changes.

import { studyDay } from '../db/day.js';
import { studyDayEnd } from '../srs/queue.js';
import { earnsGameCredit } from '../srs/gameCredit.js';
import { review, markWeak, GRADE } from '../srs/fsrs.js';
import { facetOf } from '../srs/facets.js';
import { dayStats, recordReview, touchStreak } from '../srs/stats.js';
import { markRoundDone } from './gameOfDay.js';

/**
 * @param {any} data  the storage blob (mutated)
 * @param {{ cardId: string|null, correct: boolean, format: 'speed_recall'|'listening'|'tiles'|'match', now: number }} o
 *   cardId null = nothing to update (a lesson exercise that has no card)
 * @returns {{ credited: boolean, weak: boolean }}
 */
export function applyAnswer(data, { cardId, correct, format, now, noWeak = false }) {
  const cards = data.srs.decks.main.cards;
  const card = cardId ? cards[cardId] : null;
  if (!card || card.retired) return { credited: false, weak: false };
  const rollover = data.settings.dayRolloverHour;
  if (!correct) {
    if (noWeak) return { credited: false, weak: false }; // Listen & type in meaning mode: a missed paraphrase says nothing about the card
    cards[cardId] = markWeak(card, now, studyDayEnd(now, rollover));
    return { credited: false, weak: true };
  }
  const day = studyDay(now, rollover);
  if (!earnsGameCredit({ card, format, now, day })) return { credited: false, weak: false };
  const graded = review(card, facetOf(cardId) ?? 'main', GRADE.good, now, cardId);
  cards[cardId] = { ...graded, ...(card.f ? { f: card.f } : {}), gc: day };
  recordReview(data, { now, previousState: card.st, correct: true });
  return { credited: true, weak: false };
}

const asBest = (entry) => (typeof entry === 'number' ? { best: entry } : entry && typeof entry === 'object' ? entry : null);

/** A game's stored personal best, whatever shape an old build left it in (a bare number counts as the score). */
export const bestOf = (data, gameId) => asBest(data.stats.gameBests?.[gameId]);

/**
 * Record a finished round: today's `games` count and the game's personal best.
 * @returns {{ isBest: boolean, first: boolean, previousBest: number|null, best: number }}
 *   isBest: beat an earlier best (the celebration). first: nothing to beat yet (the score becomes the one to beat).
 */
export function recordRound(data, { gameId, score, correct, total, now }) {
  const day = studyDay(now, data.settings.dayRolloverHour);
  dayStats(data, day).games += 1;
  touchStreak(data, day); // any completed round counts towards the streak (D35)
  markRoundDone(data, day, gameId); // a full round of today's game of the day unlocks the others (D37)
  const prev = bestOf(data, gameId);
  const previousBest = prev && typeof prev.best === 'number' ? prev.best : null;
  const accuracy = total > 0 ? correct / total : 0;
  const isBest = previousBest !== null && score > previousBest;
  const first = previousBest === null;
  const beats = first || isBest;
  data.stats.gameBests[gameId] = {
    ...(prev ?? {}),
    best: beats ? score : previousBest,
    bestAccuracy: beats ? accuracy : prev?.bestAccuracy ?? null,
    bestDay: beats ? day : prev?.bestDay ?? null,
    rounds: (prev?.rounds ?? 0) + 1,
    last: { score, correct, total, day },
  };
  return { isBest, first, previousBest, best: beats ? score : previousBest };
}
