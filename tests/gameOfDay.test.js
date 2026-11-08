// Game of the day (PLAN D37): date seeding, the no-repeat rule, lock and unlock, abandoned rounds, and the v6 → v7 migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { defaultData, migrate, MIGRATIONS, STORAGE_VERSION } from '../src/db/storage.js';
import { pickGame, ensureGameOfDay, isLockedToday, todaysRecord, markRoundDone, seedOf } from '../src/games/gameOfDay.js';
import { recordRound } from '../src/games/outcome.js';
import { studyDay, previousDay } from '../src/db/day.js';

const ALL = ['listen-type', 'match-pairs', 'sentence-sprint', 'speed-recall'];
const fresh = () => defaultData(Date.parse('2026-11-01T12:00:00Z'));
const round = (data, gameId, now) => recordRound(data, { gameId, score: 50, correct: 5, total: 6, now });

test('the pick is seeded by the date: same day, same game, whatever the order or number of calls', () => {
  for (const day of ['2026-11-08', '2026-11-09', '2027-01-01']) {
    const a = pickGame(day, ALL, null);
    assert.equal(pickGame(day, [...ALL].reverse(), null), a);
    assert.equal(pickGame(day, ALL, null), a);
    assert.ok(ALL.includes(a));
  }
  assert.notEqual(seedOf('2026-11-08'), seedOf('2026-11-09'));
});

test('over a few months every game gets picked (the seed spreads)', () => {
  const seen = new Set();
  let day = '2026-11-01';
  let prev = null;
  for (let i = 0; i < 120; i++, day = previousDay(day) === day ? day : nextDay(day)) {
    prev = pickGame(day, ALL, prev);
    seen.add(prev);
  }
  assert.deepEqual([...seen].sort(), ALL);
});
function nextDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return studyDay(new Date(y, m - 1, d + 1, 12).getTime(), 0);
}

test('the day follows the study-day cutoff: 03:59 is still yesterday, 04:00 is a new day', () => {
  const data = fresh();
  const at = (t) => studyDay(Date.parse(t), data.settings.dayRolloverHour);
  assert.equal(at('2026-11-09T03:59:00'), '2026-11-08');
  assert.equal(at('2026-11-09T04:00:00'), '2026-11-09');
  const r1 = ensureGameOfDay(data, at('2026-11-09T01:00:00'), ALL);
  const r2 = ensureGameOfDay(data, at('2026-11-09T03:59:00'), ALL);
  assert.deepEqual(r1, r2, 'the same pick before the cutoff, so a late-night session sees yesterday’s game');
});

test('a pick survives reloads and later unlocks: today’s record is kept as it is', () => {
  const data = fresh();
  const r = ensureGameOfDay(data, '2026-11-08', ['match-pairs', 'speed-recall']);
  const again = ensureGameOfDay(data, '2026-11-08', ALL); // more games unlocked since
  assert.deepEqual(again, r);
  assert.deepEqual(data.stats.gameOfDay, { day: '2026-11-08', id: r.id, done: false });
});

test('never the same game two days running, whatever the seed, unless only one is unlocked', () => {
  const data = fresh();
  let day = '2026-01-01';
  let last = null;
  for (let i = 0; i < 400; i++, day = nextDay(day)) {
    const r = ensureGameOfDay(data, day, ALL);
    if (last) assert.notEqual(r.id, last, day);
    last = r.id;
  }
  const solo = fresh();
  assert.equal(ensureGameOfDay(solo, '2026-11-08', ['match-pairs']).id, 'match-pairs');
  assert.equal(ensureGameOfDay(solo, '2026-11-09', ['match-pairs']).id, 'match-pairs', 'one unlocked game: the repeat is allowed');
  const two = fresh();
  const a = ensureGameOfDay(two, '2026-11-08', ['match-pairs', 'speed-recall']).id;
  assert.notEqual(ensureGameOfDay(two, '2026-11-09', ['match-pairs', 'speed-recall']).id, a);
});

test('a gap day (app not opened yesterday) puts no exclusion on the pick', () => {
  const data = fresh();
  ensureGameOfDay(data, '2026-11-08', ALL);
  const skip = ensureGameOfDay(data, '2026-11-10', ALL);
  assert.equal(skip.id, pickGame('2026-11-10', ALL, null));
});

test('nothing unlocked: no pick, nothing stored, nothing locked', () => {
  const data = fresh();
  assert.equal(ensureGameOfDay(data, '2026-11-08', []), null);
  assert.equal(data.stats.gameOfDay, null);
  assert.equal(isLockedToday(data, '2026-11-08', 'speed-recall'), false);
});

test('lock and unlock: the other games are locked until one full round of today’s game is recorded', () => {
  const data = fresh();
  const now = Date.parse('2026-11-08T10:00:00');
  const day = studyDay(now, 4);
  const { id } = ensureGameOfDay(data, day, ALL);
  const others = ALL.filter((g) => g !== id);
  assert.equal(isLockedToday(data, day, id), false, 'the game of the day itself is never locked');
  for (const g of others) assert.equal(isLockedToday(data, day, g), true, g);
  // a round of a different game can't be recorded through the UI, but even so it must not unlock anything
  round(data, others[0], now);
  for (const g of others) assert.equal(isLockedToday(data, day, g), true, g);
  round(data, id, now);
  assert.deepEqual(todaysRecord(data, day), { id, done: true });
  for (const g of ALL) assert.equal(isLockedToday(data, day, g), false, g);
  // credit, personal best and streak rules are untouched: it is an ordinary round
  assert.equal(data.stats.gameBests[id].rounds, 1);
  assert.equal(data.stats.days[day].games, 2);
  assert.equal(data.stats.streak, 1);
});

test('an abandoned round does not count: only recordRound (a finished round) unlocks', () => {
  const data = fresh();
  const day = '2026-11-08';
  const { id } = ensureGameOfDay(data, day, ALL);
  // leaving a round halfway never calls recordRound (the shell’s cleanup only saves schedule effects), so nothing changes
  assert.equal(isLockedToday(data, day, ALL.find((g) => g !== id)), true);
  assert.equal(todaysRecord(data, day).done, false);
  assert.equal(data.stats.gameBests[id], undefined);
  assert.equal(markRoundDone(data, day, 'not-the-game'), false);
  assert.equal(markRoundDone(data, '2026-11-09', id), false, 'a round recorded on another day does not count');
});

test('the lock lifts when the pick can’t be played on this device (a missing voice never blocks the rest)', () => {
  const data = fresh();
  const { id } = ensureGameOfDay(data, '2026-11-08', ALL);
  const other = ALL.find((g) => g !== id);
  assert.equal(isLockedToday(data, '2026-11-08', other, () => true), true);
  assert.equal(isLockedToday(data, '2026-11-08', other, () => false), false);
});

test('a new day starts locked again, and done does not carry over', () => {
  const data = fresh();
  const { id } = ensureGameOfDay(data, '2026-11-08', ALL);
  round(data, id, Date.parse('2026-11-08T10:00:00'));
  const next = ensureGameOfDay(data, '2026-11-09', ALL);
  assert.equal(next.done, false);
  assert.equal(isLockedToday(data, '2026-11-09', ALL.find((g) => g !== next.id)), true);
});

test('v6 → v7: stats.gameOfDay starts null; everything else is untouched', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const v6 = JSON.parse(readFileSync(join(dir, 'storage-v6.json'), 'utf8'));
  assert.equal(STORAGE_VERSION, 7);
  const out = migrate(v6);
  assert.equal(out.version, 7);
  assert.equal(out.stats.gameOfDay, null);
  assert.deepEqual({ ...out.stats, gameOfDay: undefined }, { ...v6.stats, gameOfDay: undefined });
  for (const k of ['srs', 'progress', 'settings', 'flags', 'meta', 'userContent']) assert.deepEqual(out[k], v6[k], k);
});

test('a v7 fixture loads unchanged, and the migration never overwrites a pick', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const v7 = JSON.parse(readFileSync(join(dir, 'storage-v7.json'), 'utf8'));
  assert.deepEqual(migrate(v7).stats, v7.stats);
  assert.deepEqual(MIGRATIONS[6]({ stats: { gameOfDay: { day: 'd', id: 'x', done: true } } }).stats.gameOfDay, { day: 'd', id: 'x', done: true });
  assert.deepEqual(MIGRATIONS[6]({}), {});
});
