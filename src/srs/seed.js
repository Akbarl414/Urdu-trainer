// Test cards so the Review screen can be tried before lessons exist (Phase 2).
//
// Everything here is namespaced `seed-…`: the words are not part of the course, their card ids
// (`w:seed-…`, `x:seed-lesson:…`) can't collide with real content, and removeSeed() deletes ONLY
// cards whose ids start with those prefixes. Adding seed cards never overwrites an existing card.

import { createEngine, GRADE, CARD_STATE } from './fsrs.js';
import { wordCardId, exerciseCardId, allFacets } from './facets.js';

const t = (roman, ur, en) => ({ roman, ur, en });
const f = (roman, ur) => ({ roman, ur });
const word = (w) => ({ register: 'neutral', introduced_in: 'seed-lesson', ...w });

export const SEED_WORDS = [
  word({ id: 'seed-pani', pos: 'noun', roman: 'paanii', ur: 'پانی', meaning_en: 'water', gender: 'm', marked: false, example: t('mujhe paanii chaahiye.', 'مجھے پانی چاہیے۔', 'I need water.') }),
  word({ id: 'seed-kitab', pos: 'noun', roman: 'kitaab', ur: 'کتاب', meaning_en: 'book', gender: 'f', marked: false, example: t('ye kitaab acchii hai.', 'یہ کتاب اچھی ہے۔', 'This book is good.') }),
  word({ id: 'seed-larka', pos: 'noun', roman: 'laRkaa', ur: 'لڑکا', meaning_en: 'boy', gender: 'm', marked: true, plural: f('laRke', 'لڑکے'), oblique_pl: f('laRkoN', 'لڑکوں'), example: t('wo laRkaa Thiik hai.', 'وہ لڑکا ٹھیک ہے۔', 'That boy is fine.') }),
  word({ id: 'seed-ghar', pos: 'noun', roman: 'ghar', ur: 'گھر', meaning_en: 'house, home', gender: 'm', marked: false, example: t('maiN ghar jaataa huuN.', 'میں گھر جاتا ہوں۔', 'I go home.') }),
  word({ id: 'seed-phone', pos: 'noun', roman: 'phone', ur: 'فون', meaning_en: 'phone', loanword: true, forms: ['phone'], gender: 'm', marked: false, example: t('mera phone yahaaN hai.', 'میرا فون یہاں ہے۔', 'My phone is here.') }),
  word({ id: 'seed-acchaa', pos: 'adjective', roman: 'acchaa', ur: 'اچھا', meaning_en: 'good', variable: true, example: t('ye kitaab acchii hai.', 'یہ کتاب اچھی ہے۔', 'This book is good.') }),
  word({ id: 'seed-bahut', pos: 'adverb', roman: 'bahut', ur: 'بہت', meaning_en: 'very, a lot', example: t('bahut shukriyaa.', 'بہت شکریہ۔', 'Thank you very much.') }),
  word({ id: 'seed-shukriya', pos: 'phrase', roman: 'shukriyaa', ur: 'شکریہ', meaning_en: 'thank you', example: t('bahut shukriyaa.', 'بہت شکریہ۔', 'Thank you very much.') }),
  word({ id: 'seed-kya-haal', pos: 'phrase', roman: 'kyaa haal hai?', ur: 'کیا حال ہے؟', meaning_en: 'how are you? (informal)', register: 'informal', example: t('kyaa haal hai, bhaaii?', 'کیا حال ہے، بھائی؟', 'How are you, brother?') }),
  word({
    id: 'seed-jaana', pos: 'verb', roman: 'jaanaa', ur: 'جانا', meaning_en: 'to go', infinitive: f('jaanaa', 'جانا'), stem: f('jaa', 'جا'), transitivity: 'intransitive', takes_ne: false,
    perfective: { m_sg: f('gayaa', 'گیا'), f_sg: f('gayii', 'گئی'), m_pl: f('gaye', 'گئے') }, example: t('wo ghar gayaa.', 'وہ گھر گیا۔', 'He went home.'),
  }),
  word({
    id: 'seed-khaana', pos: 'verb', roman: 'khaanaa', ur: 'کھانا', meaning_en: 'to eat', infinitive: f('khaanaa', 'کھانا'), stem: f('khaa', 'کھا'), transitivity: 'transitive', takes_ne: true,
    perfective: { m_sg: f('khaayaa', 'کھایا'), f_sg: f('khaayii', 'کھائی'), m_pl: f('khaae', 'کھائے') }, example: t('us ne khaanaa khaayaa.', 'اس نے کھانا کھایا۔', 'He ate the food.'),
  }),
];

export const SEED_LESSON = {
  id: 'seed-lesson',
  exercises: [
    { id: 'e01', type: 'fill-blank', explanation: 'The verb `huuN` goes last.', sentence: t('maiN ___ huuN.', 'میں ___ ہوں۔', 'I am fine.'), answer: 'Thiik', answer_ur: 'ٹھیک' },
    { id: 'e02', type: 'choose-form', explanation: '`laRkii` is feminine, so `acchii`.', sentence: t('wo laRkii ___ hai.', 'وہ لڑکی ___ ہے۔', 'That girl is good.'), options: [f('acchaa', 'اچھا'), f('acchii', 'اچھی'), f('acche', 'اچھے')], answerIndex: 1, tags: ['agreement'] },
    { id: 'e03', type: 'translate', explanation: 'Add `bahut` for very much.', en: 'Thank you very much.', answers: [f('bahut shukriyaa.', 'بہت شکریہ۔')] },
    { id: 'e04', type: 'reorder', explanation: 'Urdu verbs go last.', sentence: t('maiN Thiik huuN.', 'میں ٹھیک ہوں۔', 'I am fine.'), tokens: ['maiN', 'Thiik', 'huuN'], answerOrders: [['maiN', 'Thiik', 'huuN'], ['Thiik', 'maiN', 'huuN']] },
    { id: 'e05', type: 'error-spot', explanation: 'A feminine subject needs `gayii`.', sentence: t('wo laRkii gayaa.', 'وہ لڑکی گیا۔', 'The girl went.'), answer: 'wo laRkii gayii.', answer_ur: 'وہ لڑکی گئی۔' },
  ],
};

/** Content lookups for seed items, same shape as the content index. */
export const seedSource = {
  getWord: (id) => SEED_WORDS.find((w) => w.id === id),
  getExercise: (lessonId, exerciseId) => (lessonId === SEED_LESSON.id ? SEED_LESSON.exercises.find((e) => e.id === exerciseId) : undefined),
};

/** The real content index first, the seed items as a fallback. Seed ids can't clash with course ids. */
export function withSeed(content) {
  return {
    getWord: (id) => content.getWord(id) ?? seedSource.getWord(id),
    getExercise: (lessonId, exerciseId) => content.getExercise(lessonId, exerciseId) ?? seedSource.getExercise(lessonId, exerciseId),
  };
}

export const isSeedCardId = (id) => id.startsWith('w:seed-') || id.startsWith('x:seed-lesson:');

/** Card ids the seed set consists of: every facet of every seed word (all features treated as unlocked) plus the exercises. */
export function seedCardIds() {
  const ids = [];
  for (const w of SEED_WORDS) for (const facet of allFacets(w)) ids.push(wordCardId(w.id, facet));
  for (const e of SEED_LESSON.exercises) ids.push(exerciseCardId(SEED_LESSON.id, e.id));
  return ids;
}

/**
 * Varied schedules so the screen shows every kind of card: overdue Review cards at different ages,
 * Learning cards, a Relearning card, a weak card, and brand-new cards.
 */
const HISTORIES = [
  [[30, GRADE.good], [18, GRADE.good], [6, GRADE.good]], // comfortably overdue
  [[12, GRADE.good]], // young, due about now
  [[5, GRADE.good], [2, GRADE.again]], // lapsed
  [], // New
  [[1, GRADE.good]], // Review, not yet due
];

/**
 * Add the seed cards to the main deck. Existing cards are never overwritten.
 * @returns {number} cards added
 */
export function addSeedCards(data, now) {
  const engine = createEngine({ fuzz: false });
  const cards = data.srs.decks.main.cards;
  let added = 0;
  seedCardIds().forEach((id, i) => {
    if (cards[id]) return;
    const facet = id.startsWith('w:') ? id.split(':')[2] : 'default';
    let card = engine.newCard(now);
    for (const [daysAgo, grade] of HISTORIES[i % HISTORIES.length]) card = engine.review(card, facet, grade, now - daysAgo * 86400000);
    if (i % 7 === 3 && card.st === CARD_STATE.review) card.weak = now - 3600000;
    cards[id] = card;
    added++;
  });
  return added;
}

/** Pull every seed card due now (for repeated tries). Touches seed cards only. */
export function makeSeedDue(data, now) {
  let n = 0;
  for (const [id, card] of Object.entries(data.srs.decks.main.cards)) {
    if (isSeedCardId(id) && card.due > now) {
      card.due = now - 60000;
      n++;
    }
  }
  return n;
}

/** Delete the seed cards, and only those. */
export function removeSeedCards(data) {
  const cards = data.srs.decks.main.cards;
  let n = 0;
  for (const id of Object.keys(cards)) {
    if (isSeedCardId(id)) {
      delete cards[id];
      n++;
    }
  }
  return n;
}
