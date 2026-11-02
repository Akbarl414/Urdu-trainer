// Words and exercises for the card-face tests (moved from the Phase 2 src/srs/seed.js, PLAN D21).
// Test-only: ids are prefixed `seed-` and never appear in course content.
import { allFacets, wordCardId, exerciseCardId } from '../../src/srs/facets.js';

const t = (roman, ur, en) => ({ roman, ur, en });
const f = (roman, ur) => ({ roman, ur });
const word = (w) => ({ register: 'neutral', introduced_in: 'seed-lesson', ...w });

export const CARD_WORDS = [
  word({ id: 'seed-pani', pos: 'noun', roman: 'paanii', ur: 'پانی', meaning_en: 'water', gender: 'm', marked: false, example: t('mujhe paanii chaahiye.', 'مجھے پانی چاہیے۔', 'I need water.') }),
  word({ id: 'seed-kitab', pos: 'noun', roman: 'kitaab', ur: 'کتاب', meaning_en: 'book', gender: 'f', marked: false, example: t('ye kitaab acchii hai.', 'یہ کتاب اچھی ہے۔', 'This book is good.') }),
  word({ id: 'seed-larka', pos: 'noun', roman: 'laRkaa', ur: 'لڑکا', meaning_en: 'boy', gender: 'm', marked: true, plural: f('laRke', 'لڑکے'), oblique_pl: f('laRkoN', 'لڑکوں'), example: t('wo laRkaa Thiik hai.', 'وہ لڑکا ٹھیک ہے۔', 'That boy is fine.') }),
  word({ id: 'seed-ghar', pos: 'noun', roman: 'ghar', ur: 'گھر', meaning_en: 'house, home', gender: 'm', marked: false, example: t('maiN ghar jaataa huuN.', 'میں گھر جاتا ہوں۔', 'I go home.') }),
  word({ id: 'seed-phone', pos: 'noun', roman: 'phone', ur: 'فون', meaning_en: 'phone', loanword: true, forms: ['phone'], gender: 'm', marked: false, example: t('meraa phone yahaaN hai.', 'میرا فون یہاں ہے۔', 'My phone is here.') }),
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

export const CARD_LESSON = {
  id: 'seed-lesson',
  exercises: [
    { id: 'e01', type: 'fill-blank', explanation: 'The verb `huuN` goes last.', sentence: t('maiN ___ huuN.', 'میں ___ ہوں۔', 'I am fine.'), answer: 'Thiik', answer_ur: 'ٹھیک' },
    { id: 'e02', type: 'choose-form', explanation: '`laRkii` is feminine, so `acchii`.', sentence: t('wo laRkii ___ hai.', 'وہ لڑکی ___ ہے۔', 'That girl is good.'), options: [f('acchaa', 'اچھا'), f('acchii', 'اچھی'), f('acche', 'اچھے')], answerIndex: 1, tags: ['agreement'] },
    { id: 'e03', type: 'translate', explanation: 'Add `bahut` for very much.', en: 'Thank you very much.', answers: [f('bahut shukriyaa.', 'بہت شکریہ۔')] },
    { id: 'e04', type: 'reorder', explanation: 'Urdu verbs go last.', sentence: t('maiN Thiik huuN.', 'میں ٹھیک ہوں۔', 'I am fine.'), tokens: ['maiN', 'Thiik', 'huuN'], answerOrders: [['maiN', 'Thiik', 'huuN'], ['Thiik', 'maiN', 'huuN']] },
    { id: 'e05', type: 'error-spot', explanation: 'A feminine subject needs `gayii`.', sentence: t('wo laRkii gayaa.', 'وہ لڑکی گیا۔', 'The girl went.'), answer: 'wo laRkii gayii.', answer_ur: 'وہ لڑکی گئی۔' },
  ],
};

/** Content lookups for the fixture items, same shape as the content index. */
export const cardSource = {
  getWord: (id) => CARD_WORDS.find((w) => w.id === id),
  getExercise: (lessonId, exerciseId) => (lessonId === CARD_LESSON.id ? CARD_LESSON.exercises.find((e) => e.id === exerciseId) : undefined),
};

/** Every facet of every fixture word (all features treated as unlocked) plus the exercises. */
export function cardIds() {
  const ids = [];
  for (const w of CARD_WORDS) for (const facet of allFacets(w)) ids.push(wordCardId(w.id, facet));
  for (const e of CARD_LESSON.exercises) ids.push(exerciseCardId(CARD_LESSON.id, e.id));
  return ids;
}
