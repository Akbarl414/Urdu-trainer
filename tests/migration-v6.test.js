// v5 → v6 (PLAN D34): days gain `correct`; nothing else may change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { migrate, MIGRATIONS, STORAGE_VERSION } from '../src/db/storage.js';
import { recordReview, dayStats } from '../src/srs/stats.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const v5 = JSON.parse(readFileSync(join(dir, 'storage-v5.json'), 'utf8'));

test('v5 days get correct: null (not recorded); counts, cards, lessons, settings and bests are untouched', () => {
  assert.ok(STORAGE_VERSION >= 6);
  const out = migrate(v5, { version: 6 }); // this version's step only; v6 → v7 has its own test
  assert.equal(out.version, 6);
  for (const [day, d] of Object.entries(v5.stats.days)) {
    assert.equal(out.stats.days[day].correct, null, day);
    for (const [k, v] of Object.entries(d)) assert.deepEqual(out.stats.days[day][k], v, `${day}.${k}`);
  }
  assert.deepEqual(out.srs, v5.srs);
  assert.deepEqual(out.progress.lessons, v5.progress.lessons);
  assert.deepEqual(out.settings, { ...v5.settings });
  assert.deepEqual(out.stats.gameBests, v5.stats.gameBests, 'a best stored as a bare number is kept as it is');
  assert.equal(out.stats.streak, v5.stats.streak);
});

test('a v6 fixture loads unchanged, and an existing correct count is never overwritten', () => {
  const v6 = JSON.parse(readFileSync(join(dir, 'storage-v6.json'), 'utf8'));
  assert.deepEqual(migrate(v6, { version: 6 }).stats, { ...v6.stats, gameOfDay: null }, 'only the new v7 slot is added');
  assert.equal(MIGRATIONS[5]({ stats: { days: { a: { reviews: 3, correct: 2 } } } }).stats.days.a.correct, 2);
});

test('the migration is tolerant of odd shapes and never invents counts', () => {
  assert.deepEqual(MIGRATIONS[5]({ stats: {} }), { stats: {} });
  assert.deepEqual(MIGRATIONS[5]({}), {});
});

test('a day from before v6 (correct: null) is never half-counted; new days count right answers', () => {
  const data = migrate(v5, { version: 6 });
  const old = Object.keys(v5.stats.days)[0];
  const t = Date.parse(`${old}T12:00:00`);
  recordReview(data, { now: t, previousState: 2, correct: true });
  assert.equal(dayStats(data, old).correct, null);
  assert.equal(dayStats(data, old).reviews, v5.stats.days[old].reviews + 1);
  const fresh = Date.parse('2027-01-05T12:00:00');
  recordReview(data, { now: fresh, previousState: 2, correct: true });
  recordReview(data, { now: fresh, previousState: 2, correct: false });
  recordReview(data, { now: fresh, previousState: 1, correct: true }); // a learning repeat: not counted again
  assert.deepEqual([data.stats.days['2027-01-05'].reviews, data.stats.days['2027-01-05'].correct], [2, 1]);
});
