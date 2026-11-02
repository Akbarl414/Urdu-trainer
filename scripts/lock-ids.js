#!/usr/bin/env node
// Appends every id currently in content/ to content/shipped-ids.json so the
// validator can refuse any later rename/removal. Never removes an id.
//   npm run lock-ids             add new ids to the lockfile
//   npm run lock-ids -- --check  fail if any id is not locked yet (used by the deploy workflow)
import { createAjv, loadContent, readLockfile, writeLockfile } from './lib/content.js';
import { checkContent, collectIds } from './lib/check.js';

const check = process.argv.includes('--check');
const bundle = loadContent();
const locked = readLockfile();
const { errors, unlockedIds } = checkContent(bundle, { ajv: createAjv(), shippedIds: locked });
if (errors.length) {
  errors.forEach((e) => console.error(`FAIL  ${e}`));
  console.error('Fix the content errors before locking ids.');
  process.exit(1);
}
if (check) {
  if (unlockedIds.length) {
    console.error(`${unlockedIds.length} content id(s) are not locked in content/shipped-ids.json. Run "npm run lock-ids" and commit the result.`);
    unlockedIds.slice(0, 10).forEach((id) => console.error(`  ${id}`));
    process.exit(1);
  }
  console.log('All content ids are locked.');
} else {
  writeLockfile([...locked, ...collectIds(bundle)]);
  console.log(`Locked ${unlockedIds.length} new id(s); ${locked.length + unlockedIds.length} total.`);
}
