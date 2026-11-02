// Pure indexing of content (no Vite, no DOM, no storage) so it can be tested in Node.
// contentLoader.js feeds it the import.meta.glob results.

const byOrder = (a, b) => a.order - b.order;

/**
 * @param {{ units: any[], vocabs: any[], lessons: any[] }} raw  parsed JSON documents
 * @param {any[]} [userWords]  on-device user-added words (reserved, PLAN D9); repo ids always win
 */
export function buildContentIndex({ units = [], vocabs = [], lessons = [] }, userWords = []) {
  const sortedUnits = [...units].sort(byOrder);
  const sortedLessons = [...lessons].sort(byOrder);

  const unitById = new Map(sortedUnits.map((u) => [u.id, u]));
  const lessonById = new Map(sortedLessons.map((l) => [l.id, l]));

  /** @type {Map<string, any>} word id -> word with its unit attached */
  const wordById = new Map();
  for (const vocab of vocabs) {
    for (const word of vocab.words) wordById.set(word.id, { ...word, unit: vocab.unit });
  }
  for (const word of userWords) {
    if (!wordById.has(word.id)) wordById.set(word.id, { ...word, unit: null, userAdded: true });
  }

  const lessonsByUnit = new Map();
  for (const l of sortedLessons) {
    if (!lessonsByUnit.has(l.unit)) lessonsByUnit.set(l.unit, []);
    lessonsByUnit.get(l.unit).push(l);
  }

  return {
    units: sortedUnits,
    lessons: sortedLessons,
    words: [...wordById.values()],
    getUnit: (id) => unitById.get(id),
    getLesson: (id) => lessonById.get(id),
    getWord: (id) => wordById.get(id),
    getExercise: (lessonId, exerciseId) => lessonById.get(lessonId)?.exercises.find((e) => e.id === exerciseId),
    lessonsOfUnit: (unitId) => lessonsByUnit.get(unitId) ?? [],
    /** Words a lesson introduces, in the lesson's order. */
    newWordsOf: (lessonId) => (lessonById.get(lessonId)?.new_vocab ?? []).map((id) => wordById.get(id)).filter(Boolean),
    /** The lesson after `lessonId` in curriculum order, or undefined. */
    nextLesson(lessonId) {
      const i = sortedLessons.findIndex((l) => l.id === lessonId);
      return i === -1 ? undefined : sortedLessons[i + 1];
    },
  };
}
