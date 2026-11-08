// Card ids, the facet table and the unlock rules (PLAN §5.1–5.2). Pure.
//
// Card ids (the format never changes; if it ever must, a migration rewrites the keys):
//   w:<wordId>:<facet>            words and phrases (word ids are globally unique)
//   x:<lessonId>:<exerciseId>     one card per exercise
//   s:l:<letterId>:<facet>        script deck (Phase 7); the `s:` prefix is reserved
//   s:w:<wordId>:<facet>

import { isIrregularPerfective } from '../lang/verbs.js';

// One main card per word (PLAN D28). Its format rotates (format.js); a noun's gender is asked inside it.
// Irregular verbs also get a perfective card. takes_ne is practised in sentence cards.
const FACETS_BY_POS = {
  verb: ['main', 'perfective'],
};
const DEFAULT_FACETS = ['main'];

/** Facets of the earlier design. Stored cards with these ids are kept but retired (storage v5). */
export const LEGACY_FACETS = Object.freeze(['meaning_ur_en', 'meaning_en_ur', 'situation_to_phrase', 'gender', 'takes_ne']);

/** Facets that test grammar the learner may not have reached stay dormant until a lesson unlocks the feature. */
export const FACET_FEATURE = Object.freeze({ perfective: 'perfective' });

export const wordCardId = (wordId, facet) => `w:${wordId}:${facet}`;
export const exerciseCardId = (lessonId, exerciseId) => `x:${lessonId}:${exerciseId}`;

/**
 * @returns {{ kind: 'word', wordId: string, facet: string }
 *   | { kind: 'exercise', lessonId: string, exerciseId: string }
 *   | { kind: 'script', rest: string[] }
 *   | null}
 */
export function parseCardId(id) {
  if (typeof id !== 'string') return null;
  const p = id.split(':');
  if (p[0] === 'w' && p.length === 3 && p[1] && p[2]) return { kind: 'word', wordId: p[1], facet: p[2] };
  if (p[0] === 'x' && p.length === 3 && p[1] && p[2]) return { kind: 'exercise', lessonId: p[1], exerciseId: p[2] };
  if (p[0] === 's' && p.length >= 3) return { kind: 'script', rest: p.slice(1) };
  return null;
}

/** Facet of a card id ('default' for exercises). */
export function facetOf(id) {
  const p = parseCardId(id);
  return p?.kind === 'word' ? p.facet : p?.kind === 'exercise' ? 'default' : null;
}

/** Siblings share an item key (a word id, or a lesson id for exercises) and are not shown back-to-back. */
export function itemKey(id) {
  const p = parseCardId(id);
  if (!p) return id;
  if (p.kind === 'word') return p.wordId;
  if (p.kind === 'exercise') return p.lessonId;
  return p.rest.slice(0, 2).join(':');
}

/** Grammar features switched on by the given completed lessons (`unlocks` arrays, PLAN D11). */
export function unlockedFeatures(completedLessonIds, content) {
  const features = new Set();
  for (const id of completedLessonIds) {
    for (const f of content.getLesson(id)?.unlocks ?? []) features.add(f);
  }
  return features;
}

function hasFacetData(word, facet) {
  if (facet === 'perfective') return isIrregularPerfective(word);
  return true;
}

/** All facets this word has, unlocked or not. */
export function allFacets(word) {
  return (FACETS_BY_POS[word.pos] ?? DEFAULT_FACETS).filter((f) => hasFacetData(word, f));
}

/** Facets of this word that are live given the unlocked features. */
export function facetsFor(word, features) {
  return allFacets(word).filter((f) => !FACET_FEATURE[f] || features.has(FACET_FEATURE[f]));
}

/** Facets still dormant (waiting for a lesson to unlock their feature). */
export function dormantFacets(word, features) {
  return allFacets(word).filter((f) => FACET_FEATURE[f] && !features.has(FACET_FEATURE[f]));
}
