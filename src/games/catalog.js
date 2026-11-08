// The games on offer, and whether each can be played right now (PLAN §8, Phase 4c). Pure.
// Gender sort, Agreement snap and Ne or no ne? are deferred ("later, if wanted", PLAN D34).
import { wordPool, sentencePool, listenPracticePool, unlocksAfterLesson } from './pool.js';
import { distinctMeanings } from './matchBoard.js';
import { tokens } from '../lang/normalise.js';

export const GAMES = [
  { id: 'speed-recall', title: 'Speed recall', blurb: 'English on screen. Type the Urdu before time runs out.', seconds: 90, credit: true, min: 6 },
  { id: 'listen-type', title: 'Listen & type', blurb: 'Hear a word or phrase, then type what it means or what it says.', seconds: 90, credit: true, min: 6, needsVoice: true },
  { id: 'sentence-sprint', title: 'Sentence sprint', blurb: 'Build short sentences from tiles, one after another.', seconds: 120, credit: false, min: 3 },
  { id: 'match-pairs', title: 'Match pairs', blurb: 'A quick warm-up: match Urdu to English. Never counts as a review.', seconds: 90, credit: false, min: 6 },
];
export const gameById = (id) => GAMES.find((g) => g.id === id);

/** Short enough to hear and type in a few seconds. */
export const isShort = (word) => tokens(word.roman).length <= 5;

/** Items a game would draw from right now. */
export function poolFor(id, data, content, now, { option = null } = {}) {
  const words = wordPool(data, content, now);
  if (id === 'speed-recall') return words;
  if (id === 'listen-type') {
    const short = words.filter((p) => isShort(p.word));
    return option === 'meaning' ? short : [...short, ...listenPracticePool(data, content, now)]; // meaning mode checks single-word meanings only
  }
  if (id === 'match-pairs') return words;
  if (id === 'sentence-sprint') return sentencePool(data, content, now);
  return [];
}

/** How many items the course offers once the given lessons are done (for "Unlocks after lesson N"). */
function courseCount(id, content, done) {
  const lessons = content.lessons.filter((l) => done.has(l.id) && !l.retired);
  const practice = lessons.flatMap((l) => (l.practice_sentences ?? []).filter((p) => !p.retired));
  if (id === 'sentence-sprint') return lessons.reduce((a, l) => a + (l.exercises ?? []).filter((e) => e.type === 'reorder' && !e.retired && e.tokens.length >= 3 && e.tokens.length <= 8).length, 0) + practice.length;
  const words = content.words.filter((w) => !w.retired && done.has(w.introduced_in) && (id !== 'listen-type' || isShort(w)));
  if (id === 'listen-type') return words.length + practice.filter((p) => isShort(p)).length;
  return id === 'match-pairs' ? new Set(words.map((w) => w.meaning_en)).size : words.length;
}

/**
 * @param {string} id
 * @param {{ data: any, content: any, now: number, canListen: boolean }} o
 * @returns {{ ok: boolean, reason?: 'voice'|'lesson', unlocksAfter?: number|null, count: number }}
 */
export function availability(id, { data, content, now, canListen }) {
  const game = gameById(id);
  const count = id === 'match-pairs' ? distinctMeanings(poolFor(id, data, content, now)) : poolFor(id, data, content, now).length;
  if (count < game.min) return { ok: false, reason: 'lesson', unlocksAfter: unlocksAfterLesson(content, (done) => courseCount(id, content, done), game.min), count };
  if (game.needsVoice && !canListen) return { ok: false, reason: 'voice', count };
  return { ok: true, count };
}
