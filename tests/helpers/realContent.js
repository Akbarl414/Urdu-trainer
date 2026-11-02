// The shipped course content loaded the way Node can (no import.meta.glob), for tests that need Lesson 1 itself.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { buildContentIndex } from '../../src/db/contentIndex.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../content/units');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function realContent() {
  const units = [];
  const vocabs = [];
  const lessons = [];
  for (const dir of readdirSync(root)) {
    const d = join(root, dir);
    units.push(read(join(d, 'unit.json')));
    vocabs.push(read(join(d, 'vocab.json')));
    for (const f of readdirSync(d)) if (/^lesson-\d+\.json$/.test(f)) lessons.push(read(join(d, f)));
  }
  return buildContentIndex({ units, vocabs, lessons });
}
