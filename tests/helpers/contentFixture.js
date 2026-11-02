// A small, fully valid unit used by the validator/loader tests.
// Call makeBundle() for a fresh deep copy to mutate.

const t = (roman, ur, en) => ({ roman, ur, en });
const f = (roman, ur) => ({ roman, ur });

const words = [
  { id: 'larkaa', pos: 'noun', roman: 'laRkaa', ur: 'لڑکا', meaning_en: 'boy', gender: 'm', marked: true, plural: f('laRke', 'لڑکے'), oblique_pl: f('laRkoN', 'لڑکوں'), example: t('ye laRkaa Thiik hai.', 'یہ لڑکا ٹھیک ہے۔', 'This boy is fine.') },
  { id: 'larkii', pos: 'noun', roman: 'laRkii', ur: 'لڑکی', meaning_en: 'girl', gender: 'f', marked: false, example: t('wo laRkii yahaaN hai.', 'وہ لڑکی یہاں ہے۔', 'That girl is here.') },
  { id: 'kitaab', pos: 'noun', roman: 'kitaab', ur: 'کتاب', meaning_en: 'book', gender: 'f', marked: false, example: t('kitaab yahaaN hai.', 'کتاب یہاں ہے۔', 'The book is here.') },
  {
    id: 'jaanaa', pos: 'verb', roman: 'jaanaa', ur: 'جانا', meaning_en: 'to go',
    infinitive: f('jaanaa', 'جانا'), stem: f('jaa', 'جا'), transitivity: 'intransitive', takes_ne: false,
    perfective: { m_sg: f('gayaa', 'گیا'), f_sg: f('gayii', 'گئی'), m_pl: f('gaye', 'گئے') },
    example: t('maiN ghar jaataa huuN.', 'میں گھر جاتا ہوں۔', 'I go home.'),
  },
  { id: 'acchaa', pos: 'adjective', roman: 'acchaa', ur: 'اچھا', meaning_en: 'good', variable: true, example: t('ye kitaab acchii hai.', 'یہ کتاب اچھی ہے۔', 'This book is good.') },
  { id: 'phone', pos: 'noun', roman: 'phone', ur: 'فون', meaning_en: 'phone', loanword: true, forms: ['phone'], gender: 'm', marked: false, example: t('mera phone yahaaN hai.', 'میرا فون یہاں ہے۔', 'My phone is here.') },
  { id: 'shukriyaa', pos: 'phrase', roman: 'shukriyaa', ur: 'شکریہ', meaning_en: 'thank you', example: t('bahut shukriyaa.', 'بہت شکریہ۔', 'Thank you very much.') },
].map((w) => ({ register: 'neutral', introduced_in: 'lesson-001', ...w }));

const exercises = [
  { id: 'e01', type: 'fill-blank', explanation: 'The verb `huuN` goes last.', sentence: t('maiN ___ huuN.', 'میں ___ ہوں۔', 'I am fine.'), answer: 'Thiik', answer_ur: 'ٹھیک' },
  { id: 'e02', type: 'multiple-choice', explanation: '`shukriyaa` means thank you.', prompt: 'What does this mean?', sentence: t('shukriyaa', 'شکریہ', 'thank you'), options: ['Thank you', 'Sorry', 'Goodbye'], answerIndex: 0 },
  { id: 'e03', type: 'choose-form', explanation: '`laRkii` is feminine, so `acchii`.', sentence: t('wo laRkii ___ hai.', 'وہ لڑکی ___ ہے۔', 'That girl is good.'), options: [f('acchaa', 'اچھا'), f('acchii', 'اچھی'), f('acche', 'اچھے')], answerIndex: 1, tags: ['agreement'] },
  { id: 'e04', type: 'reorder', explanation: 'Verb last.', sentence: t('maiN Thiik huuN.', 'میں ٹھیک ہوں۔', 'I am fine.'), tokens: ['maiN', 'Thiik', 'huuN'], answerOrders: [['maiN', 'Thiik', 'huuN'], ['Thiik', 'maiN', 'huuN']] },
  { id: 'e05', type: 'error-spot', explanation: 'A feminine subject needs `gayii`.', sentence: t('wo laRkii gayaa.', 'وہ لڑکی گیا۔', 'The girl went.'), answer: 'wo laRkii gayii.', answer_ur: 'وہ لڑکی گئی۔' },
  { id: 'e06', type: 'translate', explanation: 'Add `bahut` for very much.', en: 'Thank you very much.', answers: [f('bahut shukriyaa.', 'بہت شکریہ۔')] },
  { id: 'e07', type: 'transform', explanation: '`aap` takes `haiN`.', from: t('tum Thiik ho.', 'تم ٹھیک ہو۔', 'You are fine.'), instruction: 'Change tum to aap.', answers: [f('aap Thiik haiN.', 'آپ ٹھیک ہیں۔')] },
  { id: 'e08', type: 'listen', explanation: 'You heard `shukriyaa`.', audio_text: t('shukriyaa', 'شکریہ', 'thank you'), options: ['Thank you', 'Sorry'], answerIndex: 0 },
];

const bundle = {
  units: [{ file: 'unit.json', dir: 'unit-01', data: { id: 'unit-01', order: 1, title: 'Salaam!', cefr: 'A1', can_do: ['greet people'] } }],
  vocabs: [{ file: 'vocab.json', dir: 'unit-01', data: { id: 'vocab-unit-01', unit: 'unit-01', words } }],
  lessons: [
    {
      file: 'lesson-001.json',
      dir: 'unit-01',
      data: {
        id: 'lesson-001', unit: 'unit-01', order: 1, title: 'Salaam and how are you?', can_do: 'You can greet someone and say how you are.', context: 'family',
        grammar: [{ heading: 'The verb goes last', body: 'In Urdu the verb comes at the end: `maiN Thiik huuN` is "I fine am".', table: { headers: ['English', 'Urdu'], rows: [['I am fine', t('maiN Thiik huuN.', 'میں ٹھیک ہوں۔', 'I am fine.')]] } }],
        new_vocab: words.map((w) => w.id),
        exercises,
        dialogue: [{ speaker: 'ahmad', ...t('assalaam-o-alaikum!', 'السلام علیکم!', 'Hello!') }, { speaker: 'saarah', ...t('wa-alaikum-assalaam!', 'وعلیکم السلام!', 'Hello to you!') }],
      },
    },
  ],
};

export const makeBundle = () => JSON.parse(JSON.stringify(bundle));
