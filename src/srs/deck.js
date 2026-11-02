// The main deck: which cards completed lessons call for (PLAN §5.2), and the
// "I already know this" path (BRIEF §5.2). Pure functions over the storage blob; callers persist.
//
// syncDeck is idempotent and ADDITIVE: it creates missing cards and never touches an existing one,
// so running it at lesson commit and once at boot can't disturb anyone's progress.

import { unlockedFeatures, facetsFor, wordCardId, exerciseCardId } from './facets.js';
import { newCard, review, alreadyKnow } from './fsrs.js';

const mainCards = (data) => data.srs.decks.main.cards;
const completedLessonIds = (data) => Object.keys(data.progress.lessons);

/** Retired content keeps its cards but gets no new ones (PLAN §4.5). */
const isLive = (item) => item && !item.retired;

/**
 * Every [cardId, facet] the completed lessons call for right now.
 * @returns {{ id: string, facet: string, wordId?: string }[]}
 */
export function wantedCards(data, content) {
  const done = completedLessonIds(data);
  const features = unlockedFeatures(done, content);
  const wanted = [];
  const seenWords = new Set();
  for (const lessonId of done) {
    const lesson = content.getLesson(lessonId);
    if (!lesson) continue; // progress from a build with content this one lacks: leave it alone
    for (const wordId of lesson.new_vocab ?? []) {
      if (seenWords.has(wordId)) continue;
      seenWords.add(wordId);
      const word = content.getWord(wordId);
      if (!isLive(word)) continue;
      for (const facet of facetsFor(word, features)) wanted.push({ id: wordCardId(wordId, facet), facet, wordId });
    }
    for (const ex of lesson.exercises ?? []) {
      if (isLive(ex)) wanted.push({ id: exerciseCardId(lessonId, ex.id), facet: 'default' });
    }
  }
  return wanted;
}

/**
 * Create the cards completed lessons call for that don't exist yet.
 * @param {any} data  the storage blob (mutated)
 * @param {any} content  content index
 * @param {number} now
 * @param {{ grades?: Record<string, number>, known?: Iterable<string> }} [opts]
 *   grades: first rating per NEW card id (what happened in the lesson; Good if practised correctly, Again if missed)
 *   known:  word ids marked "I already know this" in the lesson → their NEW cards enter with a long first interval
 * @returns {string[]} ids of the cards created
 */
export function syncDeck(data, content, now, { grades = {}, known = [] } = {}) {
  const cards = mainCards(data);
  const knownSet = new Set(known);
  const created = [];
  for (const { id, facet, wordId } of wantedCards(data, content)) {
    if (cards[id]) continue;
    let card = newCard(now);
    if (wordId && knownSet.has(wordId)) card = alreadyKnow(card, facet, now, id);
    else if (grades[id]) card = review(card, facet, grades[id], now, id);
    cards[id] = card;
    created.push(id);
  }
  return created;
}

/**
 * "I already know this" for a word outside the lesson flow: every live facet of the word that is
 * missing or still New gets the known treatment. A card that has already been reviewed is left alone.
 * @returns {string[]} ids of the cards changed
 */
export function markWordKnown(data, content, wordId, now) {
  const word = content.getWord(wordId);
  if (!isLive(word)) return [];
  const features = unlockedFeatures(completedLessonIds(data), content);
  const cards = mainCards(data);
  const changed = [];
  for (const facet of facetsFor(word, features)) {
    const id = wordCardId(wordId, facet);
    const existing = cards[id];
    if (existing && existing.st !== 0) continue;
    cards[id] = alreadyKnow(existing ?? newCard(now), facet, now, id);
    changed.push(id);
  }
  return changed;
}
