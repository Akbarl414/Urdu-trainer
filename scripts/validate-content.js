#!/usr/bin/env node
// Validates all content: schemas, cross-file rules, romanization, Urdu script
// code points, and the shipped-id lockfile.  Run: npm run validate
import { createAjv, loadContent, readLockfile } from './lib/content.js';
import { checkContent } from './lib/check.js';

const bundle = loadContent();
const { errors, warnings, unlockedIds, stats } = checkContent(bundle, { ajv: createAjv(), shippedIds: readLockfile() });

console.log(`Checked ${stats.units} unit(s), ${stats.lessons} lesson(s), ${stats.words} word(s)/phrase(s).`);
for (const w of warnings) console.warn(`warn  ${w}`);
if (unlockedIds.length) console.log(`note  ${unlockedIds.length} id(s) are not in content/shipped-ids.json yet. Run "npm run lock-ids" before merging content to main.`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL  ${e}`);
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
}
console.log('All content valid.');
