// The pool every game draws from (PLAN §8, Phase 4c). Pure: pass the storage blob, the content index and a clock.
//
// Only items from COMPLETED lessons, never retired ones, and only words/sentences the learner has a card for.
// Weight = (1 - R) * 3 + weak bonus 2 + recent bonus 1.5, so forgotten, flagged and newly learned items come up most.
// Items are sampled without replacement (weighted), so one round never repeats an item until the pool runs out.
//
// Plurals are read ONLY through nounPlural() (PLAN D26). Games never touch word.plural / oblique_pl directly.

import { retrievability, CARD_STATE } from '../srs/fsrs.js';
import { wordCardId, exerciseCardId } from '../srs/facets.js';
import { forLearner } from '../lesson/learner.js';
import { practiceAsExercise, practiceAsWord, practiceTiles } from './practice.js';
import { tokens } from '../lang/normalise.js';

const DAY_MS = 86400000;
export const RECENT_DAYS = 7;
const NEUTRAL_R = 0.8; // a card with no memory yet: same neutral as the review queue
const NO_CARD_R = 0.7; // a sentence the learner has no card for (a lesson exercise that isn't a sentence card)
export const WEAK_BONUS = 2;
export const RECENT_BONUS = 1.5;
const MIN_WEIGHT = 0.1; // nothing is ever impossible to draw

/** Weight of one item (PLAN §8). `r` is the card's current retrievability (0..1). */
export function weightOf({ r, weak, recent }) {
  return Math.max(MIN_WEIGHT, (1 - r) * 3 + (weak ? WEAK_BONUS : 0) + (recent ? RECENT_BONUS : 0));
}

const completedIds = (data) => new Set(Object.keys(data.progress.lessons));

/** Was this lesson first completed within the last RECENT_DAYS days? */
function isRecentLesson(data, lessonId, now) {
  const at = data.progress.lessons[lessonId]?.firstCompletedAt;
  return typeof at === 'number' && now - at <= RECENT_DAYS * DAY_MS;
}

/**
 * Words and phrases the learner has learned (their main card exists), each with a weight.
 * @returns {{ id: string, cardId: string, word: any, card: any, weight: number, recent: boolean }[]}
 */
export function wordPool(data, content, now) {
  const done = completedIds(data);
  const cards = data.srs.decks.main.cards;
  const out = [];
  for (const word of content.words) {
    if (word.retired || !done.has(word.introduced_in)) continue;
    const cardId = wordCardId(word.id, 'main');
    const card = cards[cardId];
    if (!card || card.retired) continue;
    const r = card.st === CARD_STATE.new ? NEUTRAL_R : retrievability(card, 'main', now);
    const recent = isRecentLesson(data, word.introduced_in, now);
    out.push({ id: word.id, cardId, word, card, recent, weight: weightOf({ r, weak: !!card.weak, recent }) });
  }
  return out;
}

/** Short reorder sentences from completed lessons: sentence cards and plain lesson exercises alike. */
export const SENTENCE_MIN_TOKENS = 3;
export const SENTENCE_MAX_TOKENS = 8;

/**
 * @returns {{ id: string, lessonId: string, exercise: any, cardId: string|null, card: any|null, weight: number, recent: boolean }[]}
 */
export function sentencePool(data, content, now) {
  const done = completedIds(data);
  const cards = data.srs.decks.main.cards;
  const gender = data.settings.learnerGender;
  const out = [];
  for (const lesson of content.lessons) {
    if (lesson.retired || !done.has(lesson.id)) continue;
    const recent = isRecentLesson(data, lesson.id, now);
    for (const raw of lesson.exercises ?? []) {
      if (raw.type !== 'reorder' || raw.retired) continue;
      const exercise = forLearner(raw, gender); // the learner's own sentences in their gender (D23)
      const n = exercise.tokens?.length ?? 0;
      if (n < SENTENCE_MIN_TOKENS || n > SENTENCE_MAX_TOKENS) continue;
      const cardId = raw.sentence_card ? exerciseCardId(lesson.id, raw.id) : null;
      const card = cardId ? cards[cardId] ?? null : null;
      if (card?.retired) continue;
      const r = card ? (card.st === CARD_STATE.new ? NEUTRAL_R : retrievability(card, 'default', now)) : NO_CARD_R;
      out.push({ id: `${lesson.id}:${raw.id}`, lessonId: lesson.id, exercise, cardId: card ? cardId : null, card, recent, weight: weightOf({ r, weak: !!card?.weak, recent }) });
    }
    for (const { sentence, key } of practiceOf(lesson, gender)) {
      const n = practiceTiles(sentence.roman).length;
      if (n < SENTENCE_MIN_TOKENS || n > SENTENCE_MAX_TOKENS) continue;
      out.push({ id: key, lessonId: lesson.id, exercise: practiceAsExercise(sentence), cardId: null, card: null, recent, practice: true, weight: weightOf({ r: NO_CARD_R, weak: false, recent }) });
    }
  }
  return out;
}

/** A lesson's live practice sentences, in the learner's gender (D23). */
function* practiceOf(lesson, gender) {
  for (const raw of lesson.practice_sentences ?? []) {
    if (!raw.retired) yield { sentence: forLearner(raw, gender), key: `${lesson.id}:${raw.id}` };
  }
}

/** Below a due word, level with a word that isn't due: Listen & type earns SRS credit, and practice sentences must not crowd that out. */
const PRACTICE_LISTEN_R = 0.9;
/** Listen & type hears the short practice sentences only, like the words (≤5 tokens). */
const LISTEN_MAX_TOKENS = 5;

/**
 * Short practice sentences of completed lessons, shaped like wordPool items for Listen & type. Never a card (`cardId` null).
 * @returns {{ id: string, cardId: null, word: any, card: null, weight: number, recent: boolean, practice: true, loanwords: Set<string> }[]}
 */
export function listenPracticePool(data, content, now) {
  const done = completedIds(data);
  const gender = data.settings.learnerGender;
  const loanwords = new Set(content.words.filter((w) => w.loanword).flatMap((w) => [w.roman, ...(w.forms ?? [])]).flatMap((s) => tokens(s)).map((t) => t.toLowerCase()));
  const out = [];
  for (const lesson of content.lessons) {
    if (lesson.retired || !done.has(lesson.id)) continue;
    const recent = isRecentLesson(data, lesson.id, now);
    for (const { sentence, key } of practiceOf(lesson, gender)) {
      if (tokens(sentence.roman).length > LISTEN_MAX_TOKENS) continue;
      out.push({ id: key, cardId: null, word: practiceAsWord(sentence), card: null, recent, practice: true, loanwords, weight: weightOf({ r: PRACTICE_LISTEN_R, weak: false, recent }) });
    }
  }
  return out;
}

/**
 * Weighted order without replacement (Efraimidis–Spirakis): each item gets key u^(1/w), highest first.
 * @template T
 * @param {T[]} items  each with a numeric `weight`
 * @param {number} [n]  how many to return (default all)
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function sampleWeighted(items, n = items.length, rng = Math.random) {
  return items
    .map((item) => ({ item, key: Math.pow(Math.max(rng(), 1e-12), 1 / Math.max(item.weight, MIN_WEIGHT)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.item);
}

/**
 * An endless supply of items for a timed round: weighted passes over the pool, never repeating the item just shown.
 * @template T
 * @param {T[]} items
 * @param {() => number} [rng]
 * @returns {() => T}
 */
export function itemStream(items, rng = Math.random) {
  let queue = [];
  let last = null;
  return () => {
    if (queue.length === 0) {
      queue = sampleWeighted(items, items.length, rng);
      if (queue.length > 1 && queue[0] === last) queue.push(queue.shift());
    }
    last = queue.shift();
    return last;
  };
}

/**
 * The lesson number after which a game's pool is big enough (for "Unlocks after lesson N"), found by pretending lessons
 * are completed in curriculum order. null when no lesson in the course is enough.
 * @param {any} content
 * @param {(completedLessonIds: Set<string>) => number} countFor
 * @param {number} min
 */
export function unlocksAfterLesson(content, countFor, min) {
  const done = new Set();
  for (const lesson of content.lessons) {
    done.add(lesson.id);
    if (countFor(done) >= min) return lesson.order;
  }
  return null;
}
