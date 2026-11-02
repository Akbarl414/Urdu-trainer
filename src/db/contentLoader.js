// Loads all repo-authored content (bundled at build time via import.meta.glob;
// no manifest: drop a file in content/units/unit-NN/ and it is picked up) and
// merges it with on-device user-added words into one index.
// STABLE CONTRACT: UI code reads content through this module only.

import { buildContentIndex } from './contentIndex.js';
import { store } from './storage.js';

const unitDocs = import.meta.glob('../../content/units/*/unit.json', { eager: true, import: 'default' });
const vocabDocs = import.meta.glob('../../content/units/*/vocab.json', { eager: true, import: 'default' });
const lessonDocs = import.meta.glob('../../content/units/*/lesson-*.json', { eager: true, import: 'default' });

const raw = {
  units: Object.values(unitDocs),
  vocabs: Object.values(vocabDocs),
  lessons: Object.values(lessonDocs),
};

let cached = null;
let cachedUserCount = -1;

/** The content index. User-added words are re-merged if their count changed. */
export function getContent() {
  const userWords = store.status().mode === 'ok' ? store.data.userContent.words : [];
  if (!cached || cachedUserCount !== userWords.length) {
    cached = buildContentIndex(raw, userWords);
    cachedUserCount = userWords.length;
  }
  return cached;
}
