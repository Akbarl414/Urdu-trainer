// Static guards for the shared-origin rules (CLAUDE.md). The German app lives on
// the same origin, so a stray localStorage.clear() or an unprefixed key would
// damage it (and vice versa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p) => relative(root, p).split('\\').join('/');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const sources = [...walk(join(root, 'src')), ...walk(join(root, 'scripts'))]
  .filter((p) => /\.(js|html)$/.test(p))
  .map((p) => ({ path: rel(p), code: stripComments(readFileSync(p, 'utf8')) }));
sources.push({ path: 'index.html', code: readFileSync(join(root, 'index.html'), 'utf8') });
sources.push({ path: 'vite.config.js', code: stripComments(readFileSync(join(root, 'vite.config.js'), 'utf8')) });

const offenders = (pattern, allowed = () => false) => sources.filter((s) => pattern.test(s.code) && !allowed(s.path)).map((s) => s.path);

test('there is source to scan', () => {
  assert.ok(sources.length > 10);
});

test('localStorage.clear() / sessionStorage.clear() is banned everywhere', () => {
  assert.deepEqual(offenders(/(localStorage|sessionStorage)\s*\.\s*clear\s*\(/), []);
});

test('nothing in src/db calls .clear() (the backend could be localStorage)', () => {
  assert.deepEqual(offenders(/\.clear\s*\(/, (p) => !p.startsWith('src/db/')), []);
});

test('only src/db/storage.js may touch localStorage or sessionStorage', () => {
  assert.deepEqual(offenders(/\b(localStorage|sessionStorage)\b/, (p) => p === 'src/db/storage.js'), []);
});

test('caches.delete( appears only in the service worker', () => {
  assert.deepEqual(offenders(/\bcaches\s*\.\s*delete\s*\(/, (p) => p === 'src/sw/sw.js'), []);
});

test('the key prefix literal lives only in src/db/keys.js', () => {
  assert.deepEqual(offenders(/urdu-trainer:/, (p) => p === 'src/db/keys.js'), []);
});

test('no code reads or writes the German app\'s keys or imports from reference/', () => {
  assert.deepEqual(offenders(/german-app|deutsch-trainer/i), []);
});

test('core folders never import from modules/ or ui/ (PLAN §2)', () => {
  const core = ['src/db/', 'src/srs/', 'src/lesson/', 'src/lang/', 'src/audio/', 'src/games/', 'src/script/'];
  const bad = sources.filter((s) => core.some((c) => s.path.startsWith(c)) && /from\s+['"][^'"]*\/(modules|ui)\//.test(s.code)).map((s) => s.path);
  assert.deepEqual(bad, []);
});
