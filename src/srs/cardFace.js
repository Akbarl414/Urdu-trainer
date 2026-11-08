// What a review card looks like: prompt, how it can be answered, and what to reveal. Pure.
// The Review screen renders this; it never reads content fields directly.
//
// Answer modes:
//   reveal  think of the meaning (or listen), tap to show it, grade yourself
//   speak   say the answer aloud, tap to reveal, grade yourself
//   type    type Roman Urdu; the lenient normaliser checks it (src/lang/normalise.js)
//   choice  pick an option
//   tiles   build the answer from tiles
// A face lists the `modes` it supports; the Review screen offers a Speak/Type toggle when both exist.
// Main cards (one per word, PLAN D28) get their format from format.js, and a noun also asks its gender.

import { nounPlural } from '../lang/nounForms.js';
import { parseCardId, itemKey, unlockedFeatures } from './facets.js';
import { chooseFormat } from './format.js';
import { tokens, exactForm } from '../lang/normalise.js';
import { isIrregularPerfective } from '../lang/verbs.js';
import { chunksOf } from '../lang/tiles.js';
import { forLearner } from '../lesson/learner.js';
import { recognitionOptions } from '../lesson/wordChecks.js';

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

const GENDER_NAME = { m: 'Masculine', f: 'Feminine' };

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Blanks one standalone occurrence of `needle`; null unless it appears exactly once. */
function blankOnce(text, needle) {
  const re = new RegExp(`(?<![\\p{L}\\p{M}-])${escapeRe(needle)}(?![\\p{L}\\p{M}-])`, 'gu');
  return (text.match(re) ?? []).length === 1 ? text.replace(re, '___') : null;
}

/** The word's example with the word blanked out, or null if that can't be done cleanly (inflected, or used twice). */
function blankedExample(word) {
  if (!word.example) return null;
  const roman = blankOnce(word.example.roman, word.roman);
  const ur = blankOnce(word.example.ur, word.ur);
  return roman && ur && roman !== '___' ? { roman, ur, en: word.example.en } : null;
}

const isTileMatch = (a, b) => a.length === b.length && a.every((t, i) => exactForm(t) === exactForm(b[i]));

/** True when the placed tiles build any accepted answer (word chunks, or a sentence in any listed order). */
export const isTilesCorrect = (face, placed) => face.tiles.orders.some((order) => isTileMatch(order, placed));

/** Chunks of other words, used as wrong tiles, so tiles can't be solved by simply placing all of them. */
function distractorChunks(word, chunks, pool, seed, count = 2) {
  const out = [];
  const seen = new Set(chunks);
  for (const w of seededShuffle(pool.filter((x) => x.id !== word.id), seed)) {
    for (const c of chunksOf(w.roman)) {
      if (out.length >= count) return out;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

function mainFace(id, word, source, o) {
  const { card = null, features = new Set(), learned, canListen = () => false } = o;
  const pool = (learned ?? source.words ?? []).filter((w) => !w.retired);
  const others = pool.filter((w) => w.id !== word.id);
  const phrase = word.pos === 'phrase' && !!word.situation;
  const blanked = blankedExample(word);
  const phraseOthers = others.filter((w) => w.pos === 'phrase');

  const format = chooseFormat({
    card,
    phrase,
    available: (f) => {
      if (f === 'choice' || f === 'meaning_choice') return others.length > 0;
      if (f === 'situation_choice') return phraseOthers.length > 0;
      if (f === 'listen') return !!canListen(word);
      if (f === 'sentence') return !!blanked;
      return true;
    },
  });

  const seed = `${id}:${card?.r ?? 0}`;
  const extras = [word.example ? { label: 'Example', ...triple(word.example) } : null, word.notes ? { label: 'Note', en: word.notes } : null].filter(Boolean);
  const answerRows = [{ roman: word.roman, ur: word.ur, en: word.meaning_en }, ...extras];
  const askGender = features.has('gender') && (word.gender === 'm' || word.gender === 'f');
  const base = {
    id,
    facet: 'main',
    kind: 'word',
    format,
    itemKey: itemKey(id),
    loanwords: loanwordSet(word),
    word,
    answers: [word.roman],
    reveal: answerRows,
    gender: askGender ? { correct: word.gender, plural: nounPlural(word)?.plural ?? null, name: GENDER_NAME[word.gender] } : null,
    detail: [],
  };
  const tilesFrom = () => {
    const chunks = chunksOf(word.roman);
    const wrong = distractorChunks(word, chunks, others, seed);
    return { tokens: seededShuffle([...chunks, ...wrong], seed), orders: [chunks], partial: wrong.length > 0 };
  };
  const meaningOptions = () => {
    const { options, answerIndex } = recognitionOptions(word, [...others.filter((w) => w.introduced_in === word.introduced_in), ...others], 4, seed);
    return { modes: ['choice'], defaultMode: 'choice', options: options.map((label, value) => ({ label, value })), correct: answerIndex };
  };
  const urduPrompt = { roman: word.roman, ur: word.ur };
  const typedModes = { modes: ['type', 'speak'], defaultMode: 'type' };

  switch (format) {
    case 'choice':
    case 'meaning_choice':
      return { ...base, label: 'What does this mean?', prompt: urduPrompt, ...meaningOptions() };
    case 'situation_choice': {
      const options = seededShuffle([word, ...phraseOthers.slice(0, 3)], seed);
      return { ...base, label: 'What would you say here?', prompt: { text: word.situation }, modes: ['choice'], defaultMode: 'choice', options: options.map((w, value) => ({ label: w.roman, ur: w.ur, value })), correct: options.indexOf(word) };
    }
    case 'tiles':
      return { ...base, label: 'Build it in Urdu', prompt: { text: word.meaning_en, note: word.pos === 'phrase' ? 'phrase' : word.pos }, modes: ['tiles'], defaultMode: 'tiles', tiles: tilesFrom() };
    case 'situation_tiles':
      return { ...base, label: 'Build what you would say', prompt: { text: word.situation }, modes: ['tiles'], defaultMode: 'tiles', tiles: tilesFrom() };
    case 'situation_typed':
      return { ...base, label: 'What would you say here?', prompt: { text: word.situation }, ...typedModes };
    case 'listen':
      return { ...base, label: 'What does this mean?', prompt: { listen: { roman: word.roman, ur: word.ur, audio: word.audio } }, modes: ['reveal'], defaultMode: 'reveal' };
    case 'meaning_reveal':
      return { ...base, label: 'What does this mean?', prompt: urduPrompt, modes: ['reveal'], defaultMode: 'reveal' };
    case 'sentence':
      return { ...base, label: 'Which word is missing?', prompt: { roman: blanked.roman, ur: blanked.ur, note: blanked.en, noAudio: true }, ...typedModes };
    case 'typed':
    default:
      return { ...base, label: 'How do you say this in Urdu?', prompt: { text: word.meaning_en, note: word.pos === 'phrase' ? 'phrase' : word.pos }, ...typedModes };
  }
}

function wordFace(id, parsed, source, opts) {
  const word = source.getWord(parsed.wordId);
  if (!word || word.retired) return null;
  if (parsed.facet === 'main') return mainFace(id, word, source, opts);
  if (parsed.facet !== 'perfective' || !isIrregularPerfective(word)) return null; // only legacy and regular-verb cards end up here: stored, never shown
  const p = word.perfective;
  const extras = [word.example ? { label: 'Example', ...triple(word.example) } : null, word.notes ? { label: 'Note', en: word.notes } : null].filter(Boolean);
  return {
    id,
    facet: 'perfective',
    kind: 'word',
    itemKey: itemKey(id),
    label: 'Past tense',
    loanwords: loanwordSet(word),
    word,
    detail: [],
    prompt: { roman: word.infinitive?.roman ?? word.roman, ur: word.infinitive?.ur ?? word.ur, note: `${word.meaning_en}: say "he ${word.meaning_en.replace(/^to /, '')}" (past, masculine singular)` },
    modes: ['type', 'speak'],
    defaultMode: 'type',
    answers: [p.m_sg.roman],
    reveal: [{ label: 'm. sg.', ...p.m_sg }, { label: 'f. sg.', ...p.f_sg }, { label: 'm. pl.', ...p.m_pl }, ...extras],
  };
}

function exerciseFace(id, parsed, source, { learnerGender = null } = {}) {
  const raw = source.getExercise(parsed.lessonId, parsed.exerciseId);
  if (!raw || raw.retired || !raw.sentence_card) return null; // only flagged exercises are reviewed (PLAN D28)
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
        accepted: ex.acceptIndexes ?? [],
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
        accepted: ex.acceptIndexes ?? [],
        reveal: [{ roman: sentence.roman.replace('___', ex.options[ex.answerIndex].roman), ur: sentence.ur.replace('___', ex.options[ex.answerIndex].ur), en: sentence.en }, ...why],
      };
    case 'reorder': {
      const orders = ex.answerOrders.map((o) => o.join(' '));
      return {
        ...base,
        label: 'Put the words in order',
        prompt: { text: sentence.en },
        modes: ['tiles'],
        defaultMode: 'tiles',
        tiles: { tokens: seededShuffle(ex.tokens, id), orders: ex.answerOrders, partial: false },
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
      return null; // `listen` exercises are never sentence cards (the validator rejects the flag on them)
  }
}

/**
 * @param {string} id  card id
 * @param {{ getWord: (id: string) => any, getExercise: (lessonId: string, exerciseId: string) => any, words?: any[] }} source
 * @param {{ learnerGender?: 'm'|'f'|null, card?: any, features?: Set<string>, learned?: any[], canListen?: (item: any) => boolean }} [opts]
 *   learnerGender: settings.learnerGender, picks the learner's own form (D23)
 *   card: the stored card (its stability and last format pick today's format)
 *   features: unlocked grammar features ('gender' switches on the gender tap)
 *   learned: words of completed lessons, the pool for wrong answers
 *   canListen: can this item be spoken on this device?
 * @returns {any|null}  null when the card can't be shown (content missing, retired, or from the earlier card design)
 */
export function describeCard(id, source, opts = {}) {
  const parsed = parseCardId(id);
  if (!parsed) return null;
  if (parsed.kind === 'word') return wordFace(id, parsed, source, opts);
  if (parsed.kind === 'exercise') return exerciseFace(id, parsed, source, opts);
  return null;
}

/** For queue building: can this card be shown? Light: checks the content only and builds no options. */
export function isReviewable(id, source) {
  const parsed = parseCardId(id);
  if (parsed?.kind === 'word') {
    const word = source.getWord(parsed.wordId);
    if (!word || word.retired) return false;
    return parsed.facet === 'main' || (parsed.facet === 'perfective' && isIrregularPerfective(word));
  }
  if (parsed?.kind === 'exercise') {
    const ex = source.getExercise(parsed.lessonId, parsed.exerciseId);
    return !!ex && !ex.retired && !!ex.sentence_card && ex.type !== 'listen';
  }
  return false;
}

/** The lesson a card belongs to (interleaving keeps these apart). */
export function lessonOfCard(id, source) {
  const parsed = parseCardId(id);
  if (parsed?.kind === 'exercise') return parsed.lessonId;
  if (parsed?.kind === 'word') return source.getWord(parsed.wordId)?.introduced_in ?? null;
  return null;
}

/** Everything describeCard() needs from the storage blob. */
export function faceOptions(data, source, { canListen } = {}) {
  const done = Object.keys(data.progress.lessons);
  const doneSet = new Set(done);
  return {
    learnerGender: data.settings.learnerGender,
    features: unlockedFeatures(done, source),
    learned: source.words.filter((w) => !w.retired && doneSet.has(w.introduced_in)),
    canListen,
  };
}
