// Match pairs boards (PLAN §8): 6 words, shown as Roman Urdu on one side and English on the other. Pure.
import { sampleWeighted } from './pool.js';

export const BOARD_SIZE = 6;

/** A board needs six different English meanings, or two cards would be the same answer. */
export function makeBoard(pool, rng = Math.random) {
  const picked = [];
  const meanings = new Set();
  for (const item of sampleWeighted(pool, pool.length, rng)) {
    const en = item.word.meaning_en;
    if (!en || meanings.has(en)) continue;
    meanings.add(en);
    picked.push(item);
    if (picked.length === BOARD_SIZE) break;
  }
  if (picked.length < BOARD_SIZE) return null;
  const shuffle = (list) => sampleWeighted(list.map((x) => ({ x, weight: 1 })), list.length, rng).map((e) => e.x);
  return { pairs: picked, left: shuffle(picked), right: shuffle(picked) };
}

/** How many distinct meanings the pool offers (does it have enough for a board at all?). */
export const distinctMeanings = (pool) => new Set(pool.map((p) => p.word.meaning_en).filter(Boolean)).size;
