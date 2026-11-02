// Card ids, the facet table and the unlock rules (PLAN §5.1–5.2). Pure.
//
// Card ids (the format never changes; if it ever must, a migration rewrites the keys):
//   w:<wordId>:<facet>            words and phrases (word ids are globally unique)
//   x:<lessonId>:<exerciseId>     one card per exercise
//   s:l:<letterId>:<facet>        script deck (Phase 7); the `s:` prefix is reserved
//   s:w:<wordId>:<facet>

const FACETS_BY_POS = {
  noun: ['meaning_ur_en', 'meaning_en_ur', 'gender'],
  verb: ['meaning_ur_en', 'meaning_en_ur', 'perfective', 'takes_ne'],
  adjective: ['meaning_ur_en', 'meaning_en_ur'],
  // D17: minor parts of speech get both meaning facets.
  adverb: ['meaning_ur_en', 'meaning_en_ur'],
  pronoun: ['meaning_ur_en', 'meaning_en_ur'],
  postposition: ['meaning_ur_en', 'meaning_en_ur'],
  other: ['meaning_ur_en', 'meaning_en_ur'],
  phrase: ['meaning_ur_en', 'situation_to_phrase'],
};

/** Facets that test grammar the learner may not have reached stay dormant until a lesson unlocks the feature. */
export const FACET_FEATURE = Object.freeze({ gender: 'gender', perfective: 'perfective', takes_ne: 'ne' });

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
  if (facet === 'gender') return word.gender === 'm' || word.gender === 'f';
  if (facet === 'perfective') return !!word.perfective;
  if (facet === 'takes_ne') return typeof word.takes_ne === 'boolean';
  return true;
}

/** All facets this word has, unlocked or not. */
export function allFacets(word) {
  return (FACETS_BY_POS[word.pos] ?? FACETS_BY_POS.other).filter((f) => hasFacetData(word, f));
}

/** Facets of this word that are live given the unlocked features. */
export function facetsFor(word, features) {
  return allFacets(word).filter((f) => !FACET_FEATURE[f] || features.has(FACET_FEATURE[f]));
}

/** Facets still dormant (waiting for a lesson to unlock their feature). */
export function dormantFacets(word, features) {
  return allFacets(word).filter((f) => FACET_FEATURE[f] && !features.has(FACET_FEATURE[f]));
}
