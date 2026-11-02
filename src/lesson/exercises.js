// Exercise logic for the lesson player (BRIEF §7.4, PLAN D19). Pure: no DOM, no storage.
// The player draws; this file decides what each exercise type offers and whether an answer is right.
//
// Input exercises are expected to have gone through forLearner() already (D23).

import { check, isCorrect, exactForm } from '../lang/normalise.js';
import { GRADE } from '../srs/fsrs.js';

/** How an exercise is answered: pick an option, order tiles, or give a free answer (spoken or typed). */
export const ANSWER_KIND = Object.freeze({
  'multiple-choice': 'choice',
  'choose-form': 'choice',
  listen: 'choice',
  reorder: 'tiles',
  'fill-blank': 'free',
  'error-spot': 'free',
  translate: 'free',
  transform: 'free',
});

export const answerKind = (ex) => ANSWER_KIND[ex.type] ?? null;

/** Free-answer exercises: which modes exist and which is the default (D19: production → Speak, typed forms → Type). */
export function freeModes(ex) {
  if (ex.type === 'translate') return { modes: ['speak', 'type'], defaultMode: 'speak' };
  return { modes: ['type', 'speak'], defaultMode: 'type' };
}

/** The mode to start in: the learner's saved Speak/Type choice wins when the exercise offers it. */
export function startMode(ex, saved) {
  const { modes, defaultMode } = freeModes(ex);
  return saved && modes.includes(saved) ? saved : defaultMode;
}

/**
 * Options of a choice exercise as { roman?, ur?, en?, text? }.
 * Plain strings are English text (shown as they are); triples keep their English apart so it can stay hidden until answered.
 */
export function choiceOptions(ex) {
  return ex.options.map((o) => (typeof o === 'string' ? { text: o } : { roman: o.roman, ur: o.ur, en: o.en }));
}

export const isChoiceCorrect = (ex, index) => index === ex.answerIndex;

/** Roman answers a typed or spoken answer is compared with. */
export function acceptedAnswers(ex) {
  switch (ex.type) {
    case 'fill-blank':
    case 'error-spot':
      return [ex.answer, ...(ex.altAnswers ?? [])];
    case 'translate':
    case 'transform':
      return ex.answers.map((a) => a.roman);
    default:
      return [];
  }
}

/** Answers shown as the model once the learner has tried: [{ roman, ur }]. */
export function modelAnswers(ex) {
  switch (ex.type) {
    case 'fill-blank':
      return [{ roman: ex.sentence.roman.replace('___', ex.answer), ur: ex.sentence.ur.replace('___', ex.answer_ur) }];
    case 'error-spot':
      return [{ roman: ex.answer, ur: ex.answer_ur }];
    case 'translate':
    case 'transform':
      return ex.answers.map((a) => ({ roman: a.roman, ur: a.ur }));
    default:
      return [];
  }
}

/** Other phrasings are fine in translate/transform (and typed ones can't be judged for certain), so a wrong typed answer is only a suggestion. */
export const isFreeOrder = (ex) => ex.type === 'translate' || ex.type === 'transform';

/** What the typed text starts as: error-spot edits the faulty sentence, everything else starts empty. */
export const typeStart = (ex) => (ex.type === 'error-spot' ? ex.sentence.roman : '');

/**
 * Judge a typed answer.
 * @returns {{ correct: boolean, exact: boolean, close: boolean, diff: {text:string,same:boolean}[], answer: string|null }}
 */
export function judgeTyped(ex, typed, { loanwords } = {}) {
  const r = check(typed, acceptedAnswers(ex), { loanwords });
  return { correct: isCorrect(r.result), exact: r.result === 'exact', close: r.result === 'close', diff: r.diff, answer: r.answer };
}

/** True when the placed tiles make any of the listed valid orders. */
export function isReorderCorrect(ex, placed) {
  const key = (tokens) => tokens.map((t) => exactForm(t)).join(' ');
  return ex.answerOrders.some((order) => key(order) === key(placed));
}

/** Shuffle that is stable for a seed, so tiles don't jump around when the screen is redrawn or resumed. */
export function seededShuffle(list, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Tiles for a reorder exercise, shuffled; never already in a valid order (when that can be avoided). */
export function reorderTiles(ex, seed = ex.id) {
  let tiles = seededShuffle(ex.tokens, seed);
  for (let n = 1; n < 6 && ex.tokens.length > 1 && isReorderCorrect(ex, tiles); n++) tiles = seededShuffle(ex.tokens, `${seed}#${n}`);
  return tiles;
}

/** Rating for an exercise card from the lesson attempt (PLAN §5.3): correct → Good, hint used → Hard, wrong → Again. */
export function gradeForResult({ correct, hinted }) {
  if (!correct) return GRADE.again;
  return hinted ? GRADE.hard : GRADE.good;
}

/** Listen exercises need something that can speak; the planner drops them otherwise. */
export const needsAudio = (ex) => ex.type === 'listen';
