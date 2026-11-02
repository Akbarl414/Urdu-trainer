#!/usr/bin/env node
// Warning-only: lists Roman Urdu tokens each lesson uses that haven't been taught yet.
//   npm run check-coverage
// See scripts/lib/coverage.js for what counts as "taught". Always exits 0 unless the
// allowlist itself is broken.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_ROOT, loadContent } from './lib/content.js';
import { checkCoverage } from './lib/coverage.js';
import { checkRoman } from '../src/lang/romanization.js';

const allowPath = join(CONTENT_ROOT, 'coverage-allowlist.json');
const allowlist = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};

// The allowlist is Roman Urdu too: hold it to the scheme so a typo can't hide a real gap.
const bad = [...Object.values(allowlist.from_lesson ?? {}).flat(), ...(allowlist.names ?? [])].flatMap((t) => checkRoman(t).map((m) => `coverage-allowlist.json: "${t}" ${m}`));
if (bad.length) {
  bad.forEach((b) => console.error(`FAIL  ${b}`));
  process.exit(1);
}

const bundle = loadContent();
const report = checkCoverage({ vocabs: bundle.vocabs.map((v) => v.data), lessons: bundle.lessons.map((l) => l.data) }, allowlist);

let total = 0;
for (const { lessonId, unknown } of report) {
  if (!unknown.length) {
    console.log(`ok    ${lessonId}`);
    continue;
  }
  total += unknown.length;
  console.warn(`warn  ${lessonId}: ${unknown.length} untaught token(s)`);
  for (const { token, where } of unknown) console.warn(`        ${token.padEnd(16)} first in ${where}`);
}
console.log(total ? `\n${total} untaught token(s). Teach them, add them to a word's forms, or allowlist them (content/coverage-allowlist.json).` : `\nAll ${report.length} lesson(s) only use taught Urdu.`);
