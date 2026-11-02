// Disk access for the content tooling: schemas, content files, the id lockfile.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..');
export const CONTENT_ROOT = join(ROOT, 'content');
export const LOCKFILE = join(CONTENT_ROOT, 'shipped-ids.json');

const SCHEMA_FILES = ['common', 'unit', 'vocab', 'exercise', 'lesson'];

/** Ajv instance with every schema registered under its $id. */
export function createAjv(schemasDir = join(CONTENT_ROOT, 'schemas')) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of SCHEMA_FILES) ajv.addSchema(JSON.parse(readFileSync(join(schemasDir, `${name}.schema.json`), 'utf8')));
  return ajv;
}

/**
 * Reads content/units/** into { units, vocabs, lessons, problems }.
 * Each item is { file, dir, data }. `problems` lists unreadable/unexpected files.
 */
export function loadContent(contentRoot = CONTENT_ROOT) {
  const bundle = { units: [], vocabs: [], lessons: [], problems: [] };
  const unitsDir = join(contentRoot, 'units');
  if (!existsSync(unitsDir)) return bundle;
  for (const dir of readdirSync(unitsDir).sort()) {
    const dirPath = join(unitsDir, dir);
    if (!statSync(dirPath).isDirectory()) continue;
    for (const file of readdirSync(dirPath).sort()) {
      const rel = `units/${dir}/${file}`;
      if (!file.endsWith('.json')) {
        bundle.problems.push(`${rel}: unexpected non-JSON file in a unit folder`);
        continue;
      }
      let data;
      try {
        data = JSON.parse(readFileSync(join(dirPath, file), 'utf8'));
      } catch (e) {
        bundle.problems.push(`${rel}: invalid JSON (${e.message})`);
        continue;
      }
      const item = { file, dir, data, rel };
      if (file === 'unit.json') bundle.units.push(item);
      else if (file === 'vocab.json') bundle.vocabs.push(item);
      else if (/^lesson-\d{3}\.json$/.test(file)) bundle.lessons.push(item);
      else bundle.problems.push(`${rel}: unexpected file name (expected unit.json, vocab.json or lesson-NNN.json)`);
    }
  }
  return bundle;
}

export function readLockfile(path = LOCKFILE) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(parsed.ids) ? parsed.ids : [];
}

export function writeLockfile(ids, path = LOCKFILE) {
  const note = 'Ids of shipped content. Never remove or rename an id; set retired:true instead. Append new ids with: npm run lock-ids';
  writeFileSync(path, JSON.stringify({ note, ids: [...new Set(ids)].sort() }, null, 2) + '\n');
}
