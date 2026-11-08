// Coverage: does each lesson only use Urdu the learner has met? (BRIEF §7.5, PLAN §4.4). Pure.
//
// For every lesson, tokenises its Roman Urdu (grammar tables and examples, exercises, dialogue, and
// the example sentences of the words it introduces) and subtracts what is known by then:
//   - every word introduced in this or an earlier lesson: its roman, `forms`, `plural`,
//     `oblique_pl` and `agreement` forms (perfectives are NOT included: they are taught much later);
//   - content/coverage-allowlist.json: `from_lesson` tokens (function words taught in a lesson's
//     grammar rather than as vocab, e.g. huuN / haiN / hai in lesson-001) and `names`.
// English prose (bodies, notes, explanations, hints) is not checked: it may preview what's coming.
// Warning-level only: it never fails the build.

import { tokens } from '../../src/lang/normalise.js';

const ROMAN_KEYS = new Set(['roman', 'answer', 'altAnswers', 'tokens', 'answerOrders', 'forms', 'alt_orders']);
const LESSON_NUM = /^lesson-(\d{3})$/;
const lessonNumber = (id) => Number(LESSON_NUM.exec(id)?.[1] ?? NaN);
const isBlank = (t) => /^_+$/.test(t);

/** Roman tokens in a content subtree, with the path where each was first seen. */
function collect(node, path, out, skip = new Set()) {
  if (Array.isArray(node)) return node.forEach((x, i) => collect(x, `${path}[${i}]`, out, skip));
  if (node === null || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (skip.has(k)) continue;
    const here = path ? `${path}.${k}` : k;
    if (ROMAN_KEYS.has(k)) {
      const strings = Array.isArray(v) ? v.flat(2) : [v];
      for (const s of strings) {
        if (typeof s !== 'string') continue;
        for (const t of tokens(s)) if (!isBlank(t) && !out.has(t)) out.set(t, here);
      }
    } else collect(v, here, out, skip);
  }
}

/** Every token a word makes known. */
export function wordTokens(word) {
  const strings = [word.roman, ...(word.forms ?? [])];
  for (const p of [word.plural, word.oblique_pl, word.agreement?.m_sg, word.agreement?.f, word.agreement?.m_pl]) if (p?.roman) strings.push(p.roman);
  return strings.flatMap((s) => tokens(s));
}

/**
 * @param {{ vocabs: any[], lessons: any[] }} raw  parsed documents (vocab.json / lesson-NNN.json data)
 * @param {{ from_lesson?: Record<string, string[]>, names?: string[] }} allowlist
 * @returns {{ lessonId: string, unknown: { token: string, where: string }[] }[]} in lesson order
 */
export function checkCoverage({ vocabs = [], lessons = [] }, allowlist = {}) {
  const words = vocabs.flatMap((v) => v.words ?? []);
  const names = new Set(allowlist.names ?? []);
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  return sorted.map((lesson) => {
    const n = lessonNumber(lesson.id);
    const known = new Set(names);
    for (const w of words) if (lessonNumber(w.introduced_in) <= n) wordTokens(w).forEach((t) => known.add(t));
    for (const [lid, list] of Object.entries(allowlist.from_lesson ?? {})) if (lessonNumber(lid) <= n) list.forEach((t) => known.add(t));

    const seen = new Map();
    collect({ grammar: lesson.grammar, exercises: lesson.exercises, dialogue: lesson.dialogue, practice_sentences: lesson.practice_sentences }, '', seen);
    for (const w of words) if (w.introduced_in === lesson.id) collect(w.example, `vocab ${w.id}.example`, seen);

    const unknown = [...seen].filter(([t]) => !known.has(t)).map(([token, where]) => ({ token, where }));
    return { lessonId: lesson.id, unknown };
  });
}
