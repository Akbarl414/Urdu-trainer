// What a review card looks like: prompt, how it can be answered, and what to reveal. Pure.
// The Review screen renders this; it never reads content fields directly.
//
// Answer modes (decided in Phase 2):
//   reveal  recognition: think of the meaning, tap to show it, grade yourself
//   speak   production: say the answer aloud, tap to reveal, grade yourself
//   type    production: type Roman Urdu; the lenient normaliser checks it (src/lang/normalise.js)
//   choice  pick an option (gender, takes_ne, multiple-choice and choose-form exercises)
// A face lists the `modes` it supports; the Review screen offers a Speak/Type toggle when both exist.

import { nounPlural } from '../lang/nounForms.js';
import { parseCardId, itemKey } from './facets.js';
import { tokens } from '../lang/normalise.js';
import { forLearner } from '../lesson/learner.js';

const FACET_LABEL = {
  meaning_ur_en: 'What does this mean?',
  meaning_en_ur: 'How do you say this in Urdu?',
  situation_to_phrase: 'What would you say here?',
  gender: 'Masculine or feminine?',
  perfective: 'Past tense',
  takes_ne: 'Does this verb take ne?',
};

/** Shuffle that is stable for a given seed, so a card looks the same when it is redisplayed. */
function seededShuffle(list, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const loanwordSet = (word) => new Set(word?.loanword ? [word.roman, ...(word.forms ?? [])].flatMap((s) => tokens(s)).map((t) => t.toLowerCase()) : []);
const triple = (t) => (t ? { roman: t.roman, ur: t.ur, en: t.en } : null);
const cleanBlank = (s) => s;

function wordFace(id, parsed, source) {
  const word = source.getWord(parsed.wordId);
  if (!word || word.retired) return null;
  const { facet } = parsed;
  const base = { id, facet, kind: 'word', itemKey: itemKey(id), label: FACET_LABEL[facet], loanwords: loanwordSet(word), word, detail: [] };
  const example = word.example ? { label: 'Example', ...triple(word.example) } : null;
  const noteRow = word.notes ? { label: 'Note', en: word.notes } : null;
  const extras = [example, noteRow].filter(Boolean);

  switch (facet) {
    case 'meaning_ur_en':
      return { ...base, prompt: { roman: word.roman, ur: word.ur }, modes: ['reveal'], defaultMode: 'reveal', answers: [], reveal: [{ en: word.meaning_en }, ...extras] };
    case 'meaning_en_ur':
    case 'situation_to_phrase':
      return {
        ...base,
        // Phrases are prompted by their situation (vocab `situation`, PLAN D22); meaning_en is the fallback.
        prompt: { text: facet === 'situation_to_phrase' ? word.situation ?? word.meaning_en : word.meaning_en, note: word.pos === 'phrase' ? 'phrase' : word.pos },
        modes: ['speak', 'type'],
        defaultMode: 'speak',
        answers: [word.roman],
        reveal: [{ roman: word.roman, ur: word.ur }, ...extras],
      };
    case 'gender':
      return {
        ...base,
        prompt: { roman: word.roman, ur: word.ur, note: word.meaning_en },
        modes: ['choice'],
        defaultMode: 'choice',
        options: [{ label: 'masculine', value: 'm' }, { label: 'feminine', value: 'f' }],
        correct: word.gender,
        reveal: [{ en: word.gender === 'm' ? 'Masculine' : 'Feminine' }, nounPlural(word) ? { label: 'Plural', ...nounPlural(word).plural } : null, ...extras].filter(Boolean),
      };
    case 'perfective': {
      const p = word.perfective;
      return {
        ...base,
        prompt: { roman: word.infinitive?.roman ?? word.roman, ur: word.infinitive?.ur ?? word.ur, note: `${word.meaning_en}: say "he ${word.meaning_en.replace(/^to /, '')}" (past, masculine singular)` },
        modes: ['type', 'speak'],
        defaultMode: 'type',
        answers: [p.m_sg.roman],
        reveal: [{ label: 'm. sg.', ...p.m_sg }, { label: 'f. sg.', ...p.f_sg }, { label: 'm. pl.', ...p.m_pl }, ...extras],
      };
    }
    case 'takes_ne':
      return {
        ...base,
        prompt: { roman: word.infinitive?.roman ?? word.roman, ur: word.infinitive?.ur ?? word.ur, note: word.meaning_en },
        modes: ['choice'],
        defaultMode: 'choice',
        options: [{ label: 'takes ne', value: true }, { label: 'no ne', value: false }],
        correct: word.takes_ne,
        reveal: [{ en: word.takes_ne ? 'Takes ne in the past tense.' : 'Does not take ne.' }, ...extras],
      };
    default:
      return null;
  }
}

function exerciseFace(id, parsed, source, { learnerGender = null } = {}) {
  const raw = source.getExercise(parsed.lessonId, parsed.exerciseId);
  if (!raw || raw.retired) return null;
  // The learner's own sentences in their gender (D23): same card, the matching form.
  const ex = forLearner(raw, learnerGender);
  const base = { id, facet: 'default', kind: 'exercise', itemKey: itemKey(id), loanwords: new Set(), exercise: ex };
  const why = ex.explanation ? [{ label: 'Why', en: ex.explanation }] : [];
  const sentence = ex.sentence ? triple(ex.sentence) : null;

  switch (ex.type) {
    case 'fill-blank': {
      const filled = (t) => cleanBlank(t).replace('___', ex.answer);
      return {
        ...base,
        label: 'Fill in the blank',
        prompt: { roman: sentence.roman, ur: sentence.ur, note: sentence.en },
        modes: ['type', 'speak'],
        defaultMode: 'type',
        answers: [ex.answer, ...(ex.altAnswers ?? [])],
        reveal: [{ roman: filled(sentence.roman), ur: ex.answer_ur ? sentence.ur.replace('___', ex.answer_ur) : sentence.ur, en: sentence.en }, ...why],
      };
    }
    case 'multiple-choice':
      return {
        ...base,
        label: ex.prompt,
        prompt: sentence ? { roman: sentence.roman, ur: sentence.ur } : { text: ex.prompt },
        modes: ['choice'],
        defaultMode: 'choice',
        options: ex.options.map((o, i) => ({ label: typeof o === 'string' ? o : o.roman ?? o.en, value: i })),
        correct: ex.answerIndex,
        reveal: [{ en: typeof ex.options[ex.answerIndex] === 'string' ? ex.options[ex.answerIndex] : ex.options[ex.answerIndex].roman }, ...why],
      };
    case 'choose-form':
      return {
        ...base,
        label: 'Pick the right form',
        prompt: { roman: sentence.roman, ur: sentence.ur, note: sentence.en },
        modes: ['choice'],
        defaultMode: 'choice',
        options: ex.options.map((o, i) => ({ label: o.roman, ur: o.ur, value: i })),
        correct: ex.answerIndex,
        reveal: [{ roman: sentence.roman.replace('___', ex.options[ex.answerIndex].roman), ur: sentence.ur.replace('___', ex.options[ex.answerIndex].ur), en: sentence.en }, ...why],
      };
    case 'reorder': {
      const orders = ex.answerOrders.map((o) => o.join(' '));
      return {
        ...base,
        label: 'Put the words in order',
        prompt: { text: sentence.en, tiles: seededShuffle(ex.tokens, id) },
        modes: ['speak', 'type'],
        defaultMode: 'speak',
        answers: orders,
        reveal: [{ roman: sentence.roman, ur: sentence.ur, en: sentence.en }, orders.length > 1 ? { label: 'Also fine', en: orders.slice(1).join('  ·  ') } : null, ...why].filter(Boolean),
      };
    }
    case 'error-spot':
      return {
        ...base,
        label: 'Spot and fix the mistake',
        prompt: { roman: sentence.roman, ur: sentence.ur, note: sentence.en },
        modes: ['type', 'speak'],
        defaultMode: 'type',
        answers: [ex.answer],
        reveal: [{ roman: ex.answer, ur: ex.answer_ur }, ...why],
      };
    case 'translate':
      return {
        ...base,
        label: 'Say it in Urdu',
        prompt: { text: ex.en },
        modes: ['speak', 'type'],
        defaultMode: 'speak',
        answers: ex.answers.map((a) => a.roman),
        freeOrder: true, // other phrasings are fine: a wrong typed answer is only a suggestion, the user decides
        reveal: [...ex.answers.map((a) => ({ roman: a.roman, ur: a.ur })), ...why],
      };
    case 'transform':
      return {
        ...base,
        label: ex.instruction,
        prompt: { roman: ex.from.roman, ur: ex.from.ur, note: ex.from.en },
        modes: ['type', 'speak'],
        defaultMode: 'type',
        answers: ex.answers.map((a) => a.roman),
        freeOrder: true,
        reveal: [...ex.answers.map((a) => ({ roman: a.roman, ur: a.ur })), ...why],
      };
    default:
      return null; // `listen` needs audio, which arrives with the lesson player (Phase 3)
  }
}

/**
 * @param {string} id  card id
 * @param {{ getWord: (id: string) => any, getExercise: (lessonId: string, exerciseId: string) => any }} source
 * @param {{ learnerGender?: 'm'|'f'|null }} [opts]  settings.learnerGender: picks the learner's own form (D23)
 * @returns {any|null}  null when the card can't be shown (content missing, retired, or needs audio)
 */
export function describeCard(id, source, opts = {}) {
  const parsed = parseCardId(id);
  if (!parsed) return null;
  if (parsed.kind === 'word') return wordFace(id, parsed, source);
  if (parsed.kind === 'exercise') return exerciseFace(id, parsed, source, opts);
  return null;
}

/** For queue building: can this card be shown right now? */
export const isReviewable = (id, source) => describeCard(id, source) !== null;
