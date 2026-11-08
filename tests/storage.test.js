import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createStore, migrate, defaultData, STORAGE_VERSION, MIGRATIONS, StorageReadOnlyError, ImportError, BACKUP_FORMAT } from '../src/db/storage.js';
import { DATA_KEY, SNAPSHOTS_KEY, PREFIX, isRecoveryKey } from '../src/db/keys.js';
import { memoryStorage } from './helpers/memoryStorage.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');
const v1 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v1.json'), 'utf8'));
// What the v1 fixture looks like once loaded: v3 → v4 deliberately moved the colour mode from settings.theme to settings.themeMode (PLAN D27).
const v1Loaded = { ...v1, settings: { ...v1.settings, theme: 'truck-art', themeMode: v1.settings.theme } };

const quiet = () => {
  const orig = console.error;
  console.error = () => {};
  return () => (console.error = orig);
};

/** Every leaf in `expected` must exist with the same value in `actual` (version excluded). */
function assertSurvives(expected, actual, path = '') {
  if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', `${path} lost`);
    for (const [k, v] of Object.entries(expected)) {
      if (path === '' && k === 'version') continue;
      assertSurvives(v, actual[k], `${path}.${k}`);
    }
  } else {
    assert.deepEqual(actual, expected, `${path} changed`);
  }
}

function makeStore(opts = {}) {
  const backend = memoryStorage(opts);
  let t = Date.parse('2026-11-12T10:00:00Z');
  const store = createStore({ backend: () => backend, now: () => t });
  return { store, backend, advance: (ms) => (t += ms), setNow: (v) => (t = v) };
}

// ---------------------------------------------------------------- fresh start & prefixing

test('first run creates default data under prefixed keys only', () => {
  const { store, backend } = makeStore();
  assert.equal(store.status().mode, 'ok');
  assert.equal(store.status().firstRun, true);
  assert.equal(store.data.version, STORAGE_VERSION);
  assert.ok(backend._keys().length >= 1);
  for (const k of backend._keys()) assert.ok(k.startsWith(PREFIX), `unprefixed key ${k}`);
  assert.ok(backend.getItem(DATA_KEY));
});

test('defaults include the script-track slots (PLAN §13.6)', () => {
  const d = defaultData();
  assert.deepEqual(d.srs.decks.script, { cards: {} });
  assert.deepEqual(d.progress.script, { lessons: {}, run: null, lastSuggestedAt: null });
  assert.equal(d.settings.scriptDailyCap, 30);
  assert.equal(d.stats.pace.scriptReviewSec, 8);
});

test('storage never touches foreign keys', () => {
  const foreign = { 'german-app-data-v1': '{"keep":1}', 'german-app-snapshots-v1': '[]' };
  const { store, backend } = makeStore({ initial: foreign });
  store.data.settings.dailyReviewCap = 10;
  store.save();
  store.exportBackup();
  for (const [k, v] of Object.entries(foreign)) assert.equal(backend.getItem(k), v);
});

// ---------------------------------------------------------------- migrations

test('migrate chains version steps in order and keeps data', () => {
  const calls = [];
  const migrations = {
    1: (d) => (calls.push(1), { ...d, addedInV2: true }),
    2: (d) => (calls.push(2), { ...d, settings: { ...d.settings, theme: 'light' } }),
  };
  const out = migrate(v1, { version: 3, migrations });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(out.version, 3);
  assert.equal(out.addedInV2, true);
  assert.equal(out.settings.theme, 'light');
  assert.equal(Object.keys(out.srs.decks.main.cards).length, 4);
});

test('migrate refuses to migrate down', () => {
  assert.throws(() => migrate({ ...v1, version: 99 }), /newer/);
});

test('migrate does not mutate its input', () => {
  const before = JSON.stringify(v1);
  migrate(v1);
  assert.equal(JSON.stringify(v1), before);
});

test('additive merge fills missing fields but never drops existing ones', () => {
  const sparse = { version: 1, settings: { dailyReviewCap: 5, somethingCustom: 'x' }, srs: { decks: { main: { cards: { 'w:a:meaning_ur_en': { due: 1 } } } } } };
  const out = migrate(sparse);
  assert.equal(out.settings.dailyReviewCap, 5);
  assert.equal(out.settings.somethingCustom, 'x');
  assert.equal(out.settings.audio, true); // default filled in
  assert.deepEqual(out.srs.decks.main.cards['w:a:meaning_ur_en'], { due: 1 });
  assert.deepEqual(out.srs.decks.script, { cards: {} });
});

test('every fixture snapshot survives migration to the current version', () => {
  const fixtures = readdirSync(fixtureDir).filter((f) => /^storage-v\d+\.json$/.test(f));
  assert.ok(fixtures.includes('storage-v1.json'));
  // A fixture must exist for every version up to and including the current one.
  for (let n = 1; n <= STORAGE_VERSION; n++) assert.ok(fixtures.includes(`storage-v${n}.json`), `missing fixture for v${n}`);
  for (const f of fixtures) {
    const fixture = JSON.parse(readFileSync(join(fixtureDir, f), 'utf8'));
    const out = migrate(fixture);
    assert.equal(out.version, STORAGE_VERSION);
    // Cards, lesson records, flags and settings must all still be there, unchanged.
    // (When a future migration deliberately changes a shape, update THIS assertion for that version, never the fixture.)
    const expected = JSON.parse(JSON.stringify(fixture));
    if (fixture.version < 4) {
      // v3 → v4 deliberately moved the old colour mode out of settings.theme into settings.themeMode (PLAN D27).
      expected.settings.themeMode = fixture.settings.theme;
      expected.settings.theme = 'truck-art';
    }
    assertSurvives(expected, out);
  }
});

test('MIGRATIONS has an entry for every version below STORAGE_VERSION that needs one (keys are never removed)', () => {
  for (const key of Object.keys(MIGRATIONS)) assert.ok(Number(key) < STORAGE_VERSION);
});

test('loading an older stored version migrates, keeps a pre-migration snapshot, and persists the result', () => {
  const migrations = { 1: (d) => ({ ...d, settings: { ...d.settings, theme: 'light' } }) };
  const backend = memoryStorage({ initial: { [DATA_KEY]: JSON.stringify(v1) } });
  const store = createStore({ backend: () => backend, version: 2, migrations });
  assert.equal(store.data.version, 2);
  assert.equal(store.data.settings.theme, 'light');
  assertSurvives({ ...v1, settings: { ...v1.settings, theme: 'light' } }, store.data);
  assert.equal(JSON.parse(backend.getItem(DATA_KEY)).version, 2, 'migrated blob persisted');
  const pre = store.listSnapshots().find((s) => s.reason === 'pre-migration');
  assert.ok(pre, 'pre-migration snapshot exists');
  assert.equal(JSON.parse(backend.getItem(SNAPSHOTS_KEY)).find((s) => s.id === pre.id).data.version, 1, 'snapshot holds the ORIGINAL v1 blob');
});

test('a current-version blob loads untouched and takes a daily snapshot', () => {
  const { store, backend } = makeStore({ initial: { [DATA_KEY]: JSON.stringify(v1) } });
  assertSurvives(v1Loaded, store.data);
  assert.equal(store.status().firstRun, false);
  assert.ok(backend.getItem(SNAPSHOTS_KEY));
});

// ---------------------------------------------------------------- corrupt data: no wipe

test('corrupt JSON enters recovery, keeps the original, copies it aside and blocks writes', () => {
  const restore = quiet();
  const bad = '{"version":1,"srs":{"decks":'; // truncated
  const { store, backend } = makeStore({ initial: { [DATA_KEY]: bad } });
  assert.equal(store.status().mode, 'recovery');
  assert.equal(store.status().reason, 'corrupt');
  assert.equal(backend.getItem(DATA_KEY), bad, 'main key untouched');
  const copies = backend._keys().filter(isRecoveryKey);
  assert.equal(copies.length, 1);
  assert.equal(backend.getItem(copies[0]), bad);
  assert.equal(store.recoveryInfo().raw, bad);
  assert.throws(() => store.data, StorageReadOnlyError);
  assert.throws(() => store.save(), StorageReadOnlyError);
  assert.throws(() => store.updateSettings({ audio: false }), StorageReadOnlyError);
  assert.equal(backend.getItem(DATA_KEY), bad, 'still untouched after attempted writes');
  restore();
});

test('reloading corrupt data does not pile up recovery copies', () => {
  const restore = quiet();
  const bad = 'not json';
  const backend = memoryStorage({ initial: { [DATA_KEY]: bad } });
  for (let i = 0; i < 3; i++) createStore({ backend: () => backend, now: () => 1000 + i * 1000 }).status();
  assert.equal(backend._keys().filter(isRecoveryKey).length, 1);
  restore();
});

test('valid JSON with a bad shape enters recovery', () => {
  const restore = quiet();
  for (const bad of ['[]', '"hi"', '{"version":"1"}', '{"version":1,"srs":[]}', '{"version":1,"flags":{}}', '{"srsCards":{}}']) {
    const { store, backend } = makeStore({ initial: { [DATA_KEY]: bad } });
    assert.equal(store.status().mode, 'recovery', bad);
    assert.equal(store.status().reason, 'bad-shape', bad);
    assert.equal(backend.getItem(DATA_KEY), bad);
  }
  restore();
});

test('data from a NEWER version is never migrated down or written to', () => {
  const restore = quiet();
  const newer = JSON.stringify({ ...v1, version: STORAGE_VERSION + 1, futureField: true });
  const { store, backend } = makeStore({ initial: { [DATA_KEY]: newer } });
  assert.equal(store.status().reason, 'newer-version');
  assert.match(store.status().message, /Update the app/);
  assert.equal(backend.getItem(DATA_KEY), newer);
  assert.throws(() => store.save(), StorageReadOnlyError);
  restore();
});

test('a migration that throws enters recovery instead of wiping', () => {
  const restore = quiet();
  const raw = JSON.stringify(v1);
  const backend = memoryStorage({ initial: { [DATA_KEY]: raw } });
  const store = createStore({ backend: () => backend, version: 2, migrations: { 1: () => { throw new Error('boom'); } } });
  assert.equal(store.status().reason, 'migration-failed');
  assert.equal(backend.getItem(DATA_KEY), raw);
  assert.throws(() => store.save(), StorageReadOnlyError);
  restore();
});

test('recovery can be left by importing a backup; the raw copy is kept', () => {
  const restore = quiet();
  const bad = '{broken';
  const { store, backend } = makeStore({ initial: { [DATA_KEY]: bad } });
  const backup = JSON.stringify({ format: BACKUP_FORMAT, exportedAt: '2026-11-10T00:00:00Z', version: 1, data: v1 });
  const preview = store.previewImport(backup);
  assert.equal(preview.summary.mainCards, 4);
  store.applyImport(preview);
  assert.equal(store.status().mode, 'ok');
  assertSurvives(v1Loaded, store.data);
  assert.equal(backend._keys().filter(isRecoveryKey).length, 1, 'raw copy kept');
  restore();
});

// ---------------------------------------------------------------- export / import

test('export → import round trip loses nothing', () => {
  const a = makeStore({ initial: { [DATA_KEY]: JSON.stringify(v1) } });
  const json = a.store.exportBackup();
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, BACKUP_FORMAT);

  const b = makeStore();
  const preview = b.store.previewImport(json);
  assert.deepEqual(
    { cards: preview.summary.mainCards, scriptCards: preview.summary.scriptCards, lessons: preview.summary.lessons, flags: preview.summary.flags },
    { cards: 4, scriptCards: 2, lessons: 2, flags: 1 },
  );
  b.store.applyImport(preview);
  assertSurvives({ ...v1Loaded, meta: { ...v1.meta, lastExportAt: parsed.exportedAt } }, b.store.data); // export stamps lastExportAt
  assert.deepEqual(b.store.data.srs.decks.script.cards, v1.srs.decks.script.cards);
  // and it was really written:
  assertSurvives({ ...v1Loaded, meta: { ...v1.meta, lastExportAt: parsed.exportedAt } }, JSON.parse(b.backend.getItem(DATA_KEY)));
});

test('import snapshots the current data first', () => {
  const { store } = makeStore();
  store.data.settings.dailyReviewCap = 11;
  store.save();
  store.applyImport(store.previewImport(JSON.stringify({ format: BACKUP_FORMAT, data: v1 })));
  const snaps = store.listSnapshots();
  assert.ok(snaps.some((s) => s.reason === 'pre-import'));
  const pre = snaps.find((s) => s.reason === 'pre-import');
  store.restoreSnapshot(pre.id);
  assert.equal(store.data.settings.dailyReviewCap, 11);
});

test('bad imports are rejected and change nothing', () => {
  const { store, backend } = makeStore();
  store.data.settings.dailyReviewCap = 7;
  store.save();
  const before = backend.getItem(DATA_KEY);
  const german = JSON.stringify({ version: 2, srsCards: {}, packs: {}, settings: {}, stats: {} });
  const cases = ['not json', '[]', '{}', german, JSON.stringify({ format: BACKUP_FORMAT, data: { ...v1, version: STORAGE_VERSION + 1 } }), JSON.stringify({ format: BACKUP_FORMAT, data: { ...v1, srs: [] } })];
  for (const c of cases) assert.throws(() => store.previewImport(c), ImportError, c.slice(0, 40));
  assert.equal(backend.getItem(DATA_KEY), before);
  assert.equal(store.data.settings.dailyReviewCap, 7);
});

test('exporting records lastExportAt', () => {
  const { store } = makeStore();
  assert.equal(store.data.meta.lastExportAt, null);
  store.exportBackup();
  assert.ok(store.data.meta.lastExportAt);
  assert.equal(store.shouldPromptBackup(), false);
});

// ---------------------------------------------------------------- snapshots

test('daily snapshots roll over at most 3 and one per study day', () => {
  const { store, backend, advance } = makeStore();
  store.data; // day 1 snapshot
  for (let i = 0; i < 5; i++) {
    advance(24 * 3600 * 1000);
    const s2 = createStore({ backend: () => backend, now: () => Date.parse('2026-11-12T10:00:00Z') + (i + 1) * 86400000 });
    s2.data;
    s2.data; // second access same day: no second snapshot
  }
  const list = JSON.parse(backend.getItem(SNAPSHOTS_KEY));
  assert.equal(list.filter((s) => s.kind === 'daily').length, 3);
  assert.equal(new Set(list.map((s) => s.date)).size, list.length);
});

// ---------------------------------------------------------------- quota

test('quota: a full write drops the oldest snapshot and retries; the main key survives', () => {
  const restore = quiet();
  const probe = makeStore();
  const small = JSON.stringify(probe.store.data).length;
  // Room for the blob + its first daily snapshot, but not for a much larger blob without freeing the snapshot.
  const { store, backend } = makeStore({ quotaBytes: small * 2 + 1500 });
  store.data;
  assert.equal(JSON.parse(backend.getItem(SNAPSHOTS_KEY)).length, 1);
  // Extra payload sized so it only fits once the snapshot is gone.
  store.data.userContent.words.push({ pad: 'x'.repeat(1500 + Math.floor(small / 2)) });
  assert.equal(store.save(), true, 'write succeeded after freeing the snapshot');
  assert.equal(JSON.parse(backend.getItem(DATA_KEY)).userContent.words.length, 1);
  assert.equal(JSON.parse(backend.getItem(SNAPSHOTS_KEY)).length, 0, 'oldest snapshot was dropped');
  assert.equal(store.status().quotaFull, false);
  restore();
});

test('quota: when nothing can be freed, keep memory state, flag quotaFull, keep the old stored value', () => {
  const restore = quiet();
  const { store, backend } = makeStore({ quotaBytes: 3000 });
  store.data;
  const stored = backend.getItem(DATA_KEY);
  assert.ok(stored);
  const events = [];
  store.onStatusChange((s) => events.push(s.quotaFull));
  store.data.userContent.words.push({ big: 'x'.repeat(5000) });
  assert.equal(store.save(), false);
  assert.equal(store.status().quotaFull, true);
  assert.equal(backend.getItem(DATA_KEY), stored, 'previously stored data intact');
  assert.equal(store.data.userContent.words.length, 1, 'still in memory');
  assert.ok(events.includes(true));
  restore();
});

// ---------------------------------------------------------------- erase

test('erase removes only prefixed keys and leaves foreign keys', () => {
  const foreign = { 'german-app-data-v1': 'g1', 'german-app-snapshots-v1': 'g2', 'someone-else:data': 'g3', 'urdu-trainerX': 'looks-similar' };
  const restore = quiet();
  const { store, backend } = makeStore({ initial: { ...foreign, [`${PREFIX}recovery:old`]: 'raw' } });
  store.data.settings.dailyReviewCap = 5;
  store.save();
  assert.ok(backend._keys().some((k) => k.startsWith(PREFIX)));
  const removed = store.eraseAll();
  assert.ok(removed.length >= 3);
  assert.ok(removed.every((k) => k.startsWith(PREFIX)));
  assert.deepEqual(backend._keys().sort(), Object.keys(foreign).sort());
  for (const [k, v] of Object.entries(foreign)) assert.equal(backend.getItem(k), v);
  // and the store starts cleanly afterwards
  assert.equal(store.data.settings.dailyReviewCap, 60);
  restore();
});

test('erase with keepRecovery leaves the raw recovery copies (used by "start fresh" on the recovery screen)', () => {
  const restore = quiet();
  const bad = '{broken';
  const { store, backend } = makeStore({ initial: { [DATA_KEY]: bad, 'german-app-data-v1': 'g' } });
  assert.equal(store.status().mode, 'recovery');
  store.eraseAll({ keepRecovery: true });
  assert.equal(backend.getItem(DATA_KEY), null);
  assert.equal(backend._keys().filter(isRecoveryKey).length, 1);
  assert.equal(backend.getItem('german-app-data-v1'), 'g');
  assert.equal(store.status().mode, 'ok'); // fresh start
  restore();
});

test('v1 → v2 migration adds settings.answerMode (null) and never overwrites a value', () => {
  const out = migrate(v1, { version: 2 });
  assert.equal(out.version, 2);
  assert.equal(out.settings.answerMode, null);
  assert.equal(migrate(v1).settings.answerMode, 'type', 'v3 → v4 later makes Type the default');
  assert.equal(MIGRATIONS[1]({ version: 1, settings: { answerMode: 'type' } }).settings.answerMode, 'type');
  assert.equal(MIGRATIONS[1]({ version: 1 }).settings.answerMode, null, 'even with no settings object');
  const v2 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v2.json'), 'utf8'));
  assert.equal(migrate(v2).settings.answerMode, 'type');
  // every card, lesson record and flag of the v1 device is still there after the migration
  assert.deepEqual(out.srs.decks.main.cards, v1.srs.decks.main.cards);
  assert.deepEqual(out.progress.lessons, v1.progress.lessons);
});

test('a device on v1 loads, is migrated to the current version with a pre-migration snapshot, and keeps its cards', () => {
  const backend = memoryStorage({ initial: { [DATA_KEY]: JSON.stringify(v1) } });
  const store = createStore({ backend: () => backend });
  assert.equal(store.data.version, STORAGE_VERSION);
  assert.equal(store.data.settings.learnerGender, null, 'v2 → v3 ran too');
  assert.equal(store.data.settings.answerMode, 'type', 'v3 → v4 turned "no choice yet" into the Type default');
  assert.deepEqual(store.data.srs.decks.main.cards, v1.srs.decks.main.cards);
  const snaps = JSON.parse(backend.getItem(SNAPSHOTS_KEY));
  assert.ok(snaps.some((s) => s.reason === 'pre-migration' && s.data.version === 1));
});

test('v2 → v3 migration adds settings.learnerGender (null) and never overwrites a value (D23)', () => {
  assert.equal(defaultData().settings.learnerGender, null);
  const v2 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v2.json'), 'utf8'));
  const out = migrate(v2, { version: 3 });
  assert.equal(out.version, 3);
  assert.equal(out.settings.learnerGender, null);
  assert.equal(out.settings.answerMode, 'type', 'earlier settings kept');
  assert.equal(MIGRATIONS[2]({ version: 2, settings: { learnerGender: 'f' } }).settings.learnerGender, 'f');
  assert.equal(MIGRATIONS[2]({ version: 2 }).settings.learnerGender, null, 'even with no settings object');
  const v3 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v3.json'), 'utf8'));
  assert.equal(migrate(v3, { version: 3 }).settings.learnerGender, 'f');
  assert.deepEqual(out.srs.decks.main.cards, v2.srs.decks.main.cards);
  assert.deepEqual(out.progress.lessons, v2.progress.lessons);
  assert.deepEqual(out.flags, v2.flags);
});

test('a device on v2 loads, is migrated to the current version with a pre-migration snapshot, and keeps everything', () => {
  const v2 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v2.json'), 'utf8'));
  const backend = memoryStorage({ initial: { [DATA_KEY]: JSON.stringify(v2) } });
  const store = createStore({ backend: () => backend });
  assert.equal(store.status().mode, 'ok');
  assert.equal(store.data.version, STORAGE_VERSION);
  assert.equal(store.data.settings.learnerGender, null);
  assertSurvives({ ...v2, settings: { ...v2.settings, theme: 'truck-art', themeMode: 'dark' } }, store.data);
  assert.equal(JSON.parse(backend.getItem(DATA_KEY)).version, STORAGE_VERSION, 'migrated blob persisted');
  const snaps = JSON.parse(backend.getItem(SNAPSHOTS_KEY));
  assert.ok(snaps.some((s) => s.reason === 'pre-migration' && s.data.version === 2));
});

// ---------------------------------------------------------------- v3 → v4 (Phase 4a, PLAN D27)

const v3fixture = () => JSON.parse(readFileSync(join(fixtureDir, 'storage-v3.json'), 'utf8'));

test('v3 → v4: settings.theme becomes the look, the old colour mode moves to themeMode, and nothing else changes', () => {
  assert.equal(STORAGE_VERSION, 4);
  assert.equal(defaultData().settings.theme, 'truck-art');
  assert.equal(defaultData().settings.themeMode, 'system');
  const v3 = v3fixture(); // theme: 'dark'
  const out = migrate(v3);
  assert.equal(out.version, 4);
  assert.equal(out.settings.themeMode, 'dark', 'a device that chose dark stays dark');
  assert.equal(out.settings.theme, 'truck-art');
  for (const old of ['system', 'light', 'dark']) assert.equal(MIGRATIONS[3]({ version: 3, settings: { theme: old } }).settings.themeMode, old);
  assert.equal(MIGRATIONS[3]({ version: 3 }).settings.themeMode, 'system', 'even with no settings object');
  assert.deepEqual(out.srs, v3.srs);
  assert.deepEqual(out.progress, v3.progress);
  assert.deepEqual(out.flags, v3.flags);
  assert.equal(out.settings.learnerGender, 'f');
  assert.equal(out.settings.showScript, true);
});

test('v3 → v4 never overwrites a saved look, mode or answer mode', () => {
  const kept = MIGRATIONS[3]({ version: 3, settings: { theme: 'jewel', themeMode: 'light', answerMode: 'speak' } }).settings;
  assert.equal(kept.theme, 'jewel');
  assert.equal(kept.themeMode, 'light');
  assert.equal(kept.answerMode, 'speak');
  const v3 = v3fixture();
  v3.settings.answerMode = 'speak';
  assert.equal(migrate(v3).settings.answerMode, 'speak');
  v3.settings.answerMode = 'type';
  assert.equal(migrate(v3).settings.answerMode, 'type');
});

test('Type is the default answer mode: new installs, and devices whose answerMode is still null', () => {
  assert.equal(defaultData().settings.answerMode, 'type');
  const v3 = v3fixture();
  v3.settings.answerMode = null;
  assert.equal(migrate(v3).settings.answerMode, 'type');
  delete v3.settings.answerMode;
  assert.equal(migrate(v3).settings.answerMode, 'type');
  const v1 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v1.json'), 'utf8'));
  assert.equal(migrate(v1).settings.answerMode, 'type');
});

test('the v4 fixture keeps its look, mode and answer mode through load', () => {
  const v4 = JSON.parse(readFileSync(join(fixtureDir, 'storage-v4.json'), 'utf8'));
  const out = migrate(v4);
  assert.equal(out.settings.theme, 'jewel');
  assert.equal(out.settings.themeMode, 'dark');
  assert.equal(out.settings.answerMode, 'speak');
  assertSurvives(v4, out);
});

test('a device on v3 loads, is migrated to v4 with a pre-migration snapshot, and keeps everything', () => {
  const v3 = v3fixture();
  const backend = memoryStorage({ initial: { [DATA_KEY]: JSON.stringify(v3) } });
  const store = createStore({ backend: () => backend });
  assert.equal(store.status().mode, 'ok');
  assert.equal(store.data.version, 4);
  assert.equal(store.data.settings.themeMode, 'dark');
  assert.deepEqual(store.data.srs, v3.srs);
  assert.equal(JSON.parse(backend.getItem(DATA_KEY)).version, 4, 'migrated blob persisted');
  assert.ok(JSON.parse(backend.getItem(SNAPSHOTS_KEY)).some((s) => s.reason === 'pre-migration' && s.data.version === 3 && s.data.settings.theme === 'dark'), 'the snapshot holds the original v3 blob');
});
