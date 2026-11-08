// Game of the day (PLAN D37). Pure over the storage blob; callers persist with store.save().
//
// One unlocked game is picked per study day, seeded by the date string so the choice is stable all day and across reloads.
// It is never the game picked the day before (when that day's pick is on record) unless only one game is unlocked.
// Until one FULL round of it is recorded that day, the other games are locked. A round left halfway never reaches
// recordRound(), so it never counts. Stored as `stats.gameOfDay = { day, id, done }` (v7); only the latest day is kept.
import { previousDay } from '../db/day.js';

/** FNV-1a over the date string: a small, stable, well-spread seed. */
export function seedOf(day) {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The pick for a day: seeded by the date, from the unlocked ids in a fixed (sorted) order, skipping `previousId` when
 * there is any other choice. Same inputs always give the same game.
 * @returns {string|null} null when nothing is unlocked
 */
export function pickGame(day, unlockedIds, previousId = null) {
  const ids = [...new Set(unlockedIds)].sort();
  if (ids.length === 0) return null;
  const pool = ids.length > 1 ? ids.filter((id) => id !== previousId) : ids;
  return pool[seedOf(day) % pool.length];
}

/** The stored record, if it is a well-formed one. */
export function recordOf(data) {
  const r = data.stats?.gameOfDay;
  return r && typeof r === 'object' && typeof r.day === 'string' && typeof r.id === 'string' ? r : null;
}

/**
 * Make sure today has a game of the day, choosing one if not. A pick already made today is kept (even if more games unlock
 * later), so it can't change under the learner. Does not touch anything when nothing is unlocked.
 * @param {any} data  the storage blob (mutated only when a pick is made)
 * @param {string} day  today's study day
 * @param {string[]} unlockedIds
 * @returns {{ id: string, done: boolean } | null}  today's record, or null when no game is unlocked
 */
export function ensureGameOfDay(data, day, unlockedIds) {
  const cur = recordOf(data);
  if (cur && cur.day === day) return { id: cur.id, done: cur.done === true };
  const id = pickGame(day, unlockedIds, cur && cur.day === previousDay(day) ? cur.id : null);
  if (!id) return null;
  data.stats.gameOfDay = { day, id, done: false };
  return { id, done: false };
}

/** Today's record without choosing one, or null. */
export function todaysRecord(data, day) {
  const r = recordOf(data);
  return r && r.day === day ? { id: r.id, done: r.done === true } : null;
}

/**
 * Is this game locked right now? Only while today's game of the day is not done, and never the game itself.
 * `isPlayable(id)` says whether the pick can be played on this device now; if it can't (say the voice went away) nothing
 * is locked, so a missing voice can never block the other games.
 */
export function isLockedToday(data, day, gameId, isPlayable = () => true) {
  const r = todaysRecord(data, day);
  return !!r && !r.done && r.id !== gameId && isPlayable(r.id);
}

/** A full round of `gameId` was recorded: mark today's game done if it is the one. Returns true when it did. */
export function markRoundDone(data, day, gameId) {
  const r = recordOf(data);
  if (!r || r.day !== day || r.id !== gameId || r.done === true) return false;
  data.stats.gameOfDay = { ...r, done: true };
  return true;
}
