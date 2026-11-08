// The interactive dialogue (PLAN D31). Pure: what each line asks the learner to do.
//   the learner's lines    build it from tiles, or pick it from options when the line has authored `options`
//   other speakers' lines  hear it, answer a quick comprehension question, and only then see the text
// Screens: 0 = the scene, then one per line, then the whole exchange played through.

import { forLearner, learnerAlt } from './learner.js';
import { reorderTiles, isReorderCorrect, seededShuffle } from './exercises.js';
import { tokens } from '../lang/normalise.js';

export const isLearnerLine = (dialogue, line) => !!dialogue.speakers.find((s) => s.id === line.speaker)?.learner;

/** A line as this learner should see it (only the learner's own lines change with gender). */
export const lineFor = (dialogue, line, gender) => (isLearnerLine(dialogue, line) ? forLearner(line, gender) : line);

/** The woman's version to mention, while no gender has been chosen. */
export const lineAlt = (dialogue, line, gender) => (isLearnerLine(dialogue, line) ? learnerAlt(line, gender) : null);

/** Options in a stable shuffled order, with where the right answer ended up. */
function shuffled(right, wrong, seed) {
  const options = seededShuffle([right, ...wrong], seed);
  return { options, answerIndex: options.indexOf(right) };
}

/**
 * @param {any} dialogue
 * @param {number} i  line index
 * @param {'m'|'f'|null|undefined} gender
 * @returns {{ kind: 'hear', question: string, options: {text:string}[], answerIndex: number }
 *   | { kind: 'pick', options: {roman:string,ur:string,en?:string}[], answerIndex: number }
 *   | { kind: 'tiles', tiles: string[], order: string[] }}
 */
export function lineTask(dialogue, i, gender) {
  const raw = dialogue.lines[i];
  const line = lineFor(dialogue, raw, gender);
  const seed = `${dialogue.setting.length}:${i}:${line.roman}`;
  if (!isLearnerLine(dialogue, raw)) {
    const { question, options, answerIndex } = raw.check;
    const picked = shuffled(options[answerIndex], options.filter((_, n) => n !== answerIndex), seed);
    return { kind: 'hear', question, options: picked.options.map((text) => ({ text })), answerIndex: picked.answerIndex };
  }
  if (line.options?.length) return { kind: 'pick', ...shuffled({ roman: line.roman, ur: line.ur, en: line.en }, line.options, seed) };
  const order = tokens(line.roman);
  return { kind: 'tiles', order, tiles: reorderTiles({ id: seed, tokens: order, answerOrders: [order] }) };
}

export const isLineOrderCorrect = (task, placed) => isReorderCorrect({ answerOrders: [task.order] }, placed);
