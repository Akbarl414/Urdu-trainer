// The clock for a timed round. Pure: pass `now` (ms) in, so it is testable and the screen can pause it when the page is hidden.

/** @param {number} durationMs @param {number} now */
export function createClock(durationMs, now) {
  return { durationMs, startedAt: now, pausedAt: null, pausedTotal: 0 };
}

export const elapsed = (c, now) => Math.min(c.durationMs, (c.pausedAt ?? now) - c.startedAt - c.pausedTotal);
export const remaining = (c, now) => Math.max(0, c.durationMs - elapsed(c, now));
export const isOver = (c, now) => remaining(c, now) <= 0;
/** 0..1 of the round left (the striped bar). */
export const fractionLeft = (c, now) => remaining(c, now) / c.durationMs;

export function pause(c, now) {
  if (c.pausedAt === null) c.pausedAt = now;
}
export function resume(c, now) {
  if (c.pausedAt !== null) {
    c.pausedTotal += now - c.pausedAt;
    c.pausedAt = null;
  }
}

/** Score for one right answer: 10, plus up to 5 for a fast one (speed recall / listening). */
export function answerPoints(ms, { fastMs = 3000, slowMs = 9000 } = {}) {
  if (ms <= fastMs) return 15;
  if (ms >= slowMs) return 10;
  return 10 + Math.round((5 * (slowMs - ms)) / (slowMs - fastMs));
}

/** Score for a built sentence: 10 plus 2 per tile, so longer sentences are worth more. */
export const sentencePoints = (tileCount) => 10 + 2 * tileCount;

/** Pairs matched in Match pairs: 10 each, +20 for clearing a board. */
export const PAIR_POINTS = 10;
export const BOARD_BONUS = 20;
