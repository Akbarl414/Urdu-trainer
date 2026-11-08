// Single localStorage-backed store for all on-device state.
//
// *** User progress data is sacred. ***
// No change here may reset, wipe, or silently break compatibility with data
// already on someone's device. See CLAUDE.md. In short:
//   * If you change the shape of anything under defaultData(), bump
//     STORAGE_VERSION, add a MIGRATIONS entry, and add tests/fixtures/storage-v<N>.json.
//   * Unparseable / invalid / newer-than-the-code data is NEVER replaced by
//     defaults. The raw string is copied aside, writes are blocked, and the
//     app shows the recovery screen (Phase 1: src/ui/recovery.js).
//   * Every key goes through keys.js and carries the `urdu-trainer:` prefix
//     (localStorage is shared with the German app on the same origin).
//   * localStorage.clear() is banned. "Erase" removes only our own keys.
//
// This is the ONLY file allowed to touch localStorage. The backend is
// injectable so the whole thing is testable in Node.

import { DATA_KEY, SNAPSHOTS_KEY, recoveryKey, isRecoveryKey, isOwnKey } from './keys.js';
import { studyDay } from './day.js';

export const STORAGE_VERSION = 6;
export const BACKUP_FORMAT = 'urdu-trainer-backup';

const DAILY_SNAPSHOTS_KEPT = 3; // D15
const SAFETY_SNAPSHOTS_KEPT = 2; // pre-import / pre-restore / pre-migration copies
const BACKUP_REMINDER_DAYS = 7;

/**
 * Version-gated migrations. MIGRATIONS[n] upgrades a blob from version n to
 * n + 1. Never remove or renumber an entry: a device may still be on any past
 * version. The additive merge in migrate() runs afterwards as a safety net for
 * missing fields; it is NOT a substitute for a real migration.
 * @type {Record<number, (data: any) => any>}
 */
export const MIGRATIONS = {
  // v1 → v2 (Phase 2): settings.answerMode, the remembered Speak/Type choice on the Review screen.
  // null = no choice made yet (each card type uses its own default). Never overwrites a value.
  1: (data) => ({ ...data, settings: { ...(data.settings || {}), answerMode: data.settings?.answerMode ?? null } }),
  // v2 → v3 (Phase 3a, PLAN D23): settings.learnerGender, so lessons show the learner's own lines
  // in the right form ('m' | 'f'). null = not chosen yet: the app asks once. Never overwrites a value.
  2: (data) => ({ ...data, settings: { ...(data.settings || {}), learnerGender: data.settings?.learnerGender ?? null } }),
  // v3 → v4 (Phase 4a, PLAN D27): `settings.theme` changes meaning. Before, it held the colour mode
  // ('system' | 'light' | 'dark'); now it names the look ('truck-art' | 'jewel' | 'neon') and the mode moves to
  // the new `settings.themeMode`. The old value is carried over into themeMode, so a device that chose dark
  // stays dark. Also: `answerMode` null ("no choice yet") becomes 'type', the new default; a saved
  // 'speak' | 'type' is never touched.
  3: (data) => {
    const s = data.settings || {};
    const oldMode = ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system';
    return {
      ...data,
      settings: {
        ...s,
        themeMode: s.themeMode ?? oldMode,
        theme: ['truck-art', 'jewel', 'neon'].includes(s.theme) ? s.theme : 'truck-art',
        answerMode: s.answerMode ?? 'type',
      },
    };
  },
  // v4 → v5 (Phase 4b, PLAN D28): one main card per word. See migrateCardsToV5 for exactly what it does.
  // Also: `dailyReviewCap` moves from the old default of 60 to 35 (a cap anyone actually chose is left alone), and
  // the new `settings.memoryTarget` ('relaxed' | 'balanced' | 'strong', PLAN D29) starts at 'relaxed'.
  4: (data) => ({
    ...data,
    settings: { ...(data.settings || {}), dailyReviewCap: data.settings?.dailyReviewCap === 60 ? 35 : data.settings?.dailyReviewCap, memoryTarget: data.settings?.memoryTarget ?? 'relaxed' },
    srs: migrateCardsToV5(data.srs),
  }),
  // v5 → v6 (Phase 4c, PLAN D34): each study day gains `correct`, the reviews answered right, so the Stats page can draw an accuracy trend.
  // Days written before this build have no such count and can't be reconstructed, so they get null ("not recorded"); the stats code
  // skips null days and never adds to them. Nothing else changes: cards, lessons, flags, settings and `gameBests` are untouched.
  5: (data) => {
    const days = data.stats?.days;
    if (!isPlainObject(days)) return data;
    const out = {};
    for (const [day, d] of Object.entries(days)) out[day] = isPlainObject(d) ? { ...d, correct: d.correct === undefined ? null : d.correct } : d;
    return { ...data, stats: { ...data.stats, days: out } };
  },
};

// The exercises flagged `sentence_card` when v5 shipped, frozen here on purpose: a migration must give the same result
// forever, whatever later content says. Lessons not listed had no cards when v5 shipped and are left alone.
const V5_SENTENCE_CARDS = Object.freeze({
  'lesson-001': ['e07', 'e09', 'e12'],
  'lesson-002': ['e06', 'e07', 'e12'],
  'lesson-003': ['e06', 'e08', 'e12'],
  'lesson-004': ['e01', 'e06', 'e11'],
  'lesson-005': ['e03', 'e04', 'e12'],
});

/**
 * v5: no card is ever deleted.
 *   w:X:main          created from X's production card (FSRS state carried over whole). If that was never
 *                     reviewed but the recognition card was, the recognition card is used instead.
 *                     An existing w:X:main is never overwritten.
 *   w:X:meaning_*, w:X:situation_to_phrase, w:X:gender, w:X:takes_ne
 *                     marked retired: stored, frozen, never shown.
 *   x:lesson:eNN      kept as it is when the exercise is a sentence card; otherwise marked retired.
 * Everything else (perfective cards, the script deck) is untouched.
 */
function migrateCardsToV5(srs) {
  const main = srs?.decks?.main?.cards;
  if (!isPlainObject(main)) return srs;
  const cards = { ...main };
  const WORD_ID = /^w:(.+):([a-z_]+)$/;
  const EX_ID = /^x:([^:]+):([^:]+)$/;

  const words = new Set();
  for (const id of Object.keys(main)) {
    const m = WORD_ID.exec(id);
    if (m && ['meaning_ur_en', 'meaning_en_ur', 'situation_to_phrase', 'gender', 'takes_ne'].includes(m[2])) words.add(m[1]);
  }
  for (const wordId of words) {
    const at = (facet) => main[`w:${wordId}:${facet}`];
    const production = at('meaning_en_ur') ?? at('situation_to_phrase');
    const recognition = at('meaning_ur_en');
    const source = production && !(production.st === 0 && recognition && recognition.st !== 0) ? production : recognition;
    const mainId = `w:${wordId}:main`;
    if (source && !cards[mainId]) cards[mainId] = { ...source };
    for (const facet of ['meaning_ur_en', 'meaning_en_ur', 'situation_to_phrase', 'gender', 'takes_ne']) {
      if (at(facet)) cards[`w:${wordId}:${facet}`] = { ...at(facet), retired: true };
    }
  }
  for (const [id, card] of Object.entries(main)) {
    const m = EX_ID.exec(id);
    if (!m) continue;
    const kept = V5_SENTENCE_CARDS[m[1]];
    if (kept && !kept.includes(m[2])) cards[id] = { ...card, retired: true };
  }
  return { ...srs, decks: { ...srs.decks, main: { ...srs.decks.main, cards } } };
}

export class StorageReadOnlyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageReadOnlyError';
  }
}

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

export function defaultData(now = Date.now()) {
  return {
    version: STORAGE_VERSION,
    meta: {
      createdAt: new Date(now).toISOString(),
      lastExportAt: null,
      lastOpenedAt: null,
      lastSeenBuild: null,
    },
    settings: {
      showScript: false,
      audio: true,
      speechRate: 0.9,
      voiceURI: null,
      dailyReviewCap: 35, // 60 until v5; set from npm run simulate-load (PLAN D28)
      memoryTarget: 'relaxed', // 'relaxed' | 'balanced' | 'strong': desired retention for every card (v5, D29)
      theme: 'truck-art', // the look: 'truck-art' | 'jewel' | 'neon' (v4; before v4 this held the colour mode)
      themeMode: 'system', // 'system' | 'light' | 'dark' (v4)
      dayRolloverHour: 4,
      noVoiceNoteSeen: false,
      answerMode: 'type', // 'speak' | 'type' | null: the remembered Speak/Type toggle (v2). Type is the default since v4; null (no choice) still means each card type uses its own default
      learnerGender: null, // 'm' | 'f' | null (not chosen yet): which form of the learner's own lines to show (v3, D23)
      // Script track (PLAN §13): inert until Phase 7, present now so no migration is needed.
      scriptInDailyReviews: false,
      scriptDailyCap: 30,
      scriptNewWordsPerDay: 5,
      scriptSuggestions: true,
      scriptChartOrder: 'alphabetical',
      scriptChartFont: 'naskh',
    },
    progress: {
      lessons: {}, // lessonId -> { firstCompletedAt, lastCompletedAt, timesCompleted, knownWordIds }
      run: null, // the lesson in progress, or null
      script: { lessons: {}, run: null, lastSuggestedAt: null },
    },
    srs: {
      decks: {
        main: { cards: {} }, // w:… and x:… cards
        script: { cards: {} }, // s:… cards (kept separate so they can never leak into the main queue)
      },
    },
    stats: {
      streak: 0,
      bestStreak: 0,
      lastStudyDay: null,
      days: {}, // 'YYYY-MM-DD' -> { reviews, correct (v6; null on older days), newWords, lessons, games, seconds, scriptReviews, scriptLessons }
      pace: { reviewSec: 10, wordSec: 20, exerciseSec: 20, scriptReviewSec: 8 },
      gameBests: {}, // gameId -> { best, bestAccuracy, bestDay, rounds, last: { score, correct, total, day } } (v6 writes it; before that the slot was empty)
    },
    flags: [], // "Report a mistake": { id, createdAt, target: { kind, id, field }, note, build }
    userContent: { words: [] }, // reserved (D9), included in export
  };
}

// ---------------------------------------------------------------- helpers

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

function isQuotaError(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

/**
 * Additive deep merge: `base` supplies anything missing, `data` always wins.
 * Never drops a key that exists in `data`; a null/undefined in `data` where the
 * defaults hold an object keeps the default object (so the app can't crash on it).
 */
function mergeAdditive(base, data) {
  if (!isPlainObject(base) || !isPlainObject(data)) return data === undefined ? base : data;
  const out = { ...base };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(base[key])) {
      out[key] = isPlainObject(value) ? mergeAdditive(base[key], value) : value === null ? base[key] : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Returns a problem description, or null if the blob has the minimum valid shape. */
export function checkShape(raw) {
  if (!isPlainObject(raw)) return 'stored data is not an object';
  if (!Number.isInteger(raw.version) || raw.version < 1) return 'missing or invalid "version"';
  for (const key of ['meta', 'settings', 'progress', 'srs', 'stats', 'userContent']) {
    if (raw[key] !== undefined && !isPlainObject(raw[key])) return `"${key}" is not an object`;
  }
  if (raw.flags !== undefined && !Array.isArray(raw.flags)) return '"flags" is not an array';
  if (raw.progress?.lessons !== undefined && !isPlainObject(raw.progress.lessons)) return '"progress.lessons" is not an object';
  if (raw.srs?.decks !== undefined && !isPlainObject(raw.srs.decks)) return '"srs.decks" is not an object';
  for (const deck of ['main', 'script']) {
    const d = raw.srs?.decks?.[deck];
    if (d !== undefined && !isPlainObject(d)) return `"srs.decks.${deck}" is not an object`;
    if (d?.cards !== undefined && !isPlainObject(d.cards)) return `"srs.decks.${deck}.cards" is not an object`;
  }
  return null;
}

/**
 * Upgrade a raw blob to `version` (default STORAGE_VERSION) and apply the
 * additive merge. Pure: does not mutate its input. Throws if the blob is newer
 * than `version` — data is never migrated down.
 */
export function migrate(raw, { version = STORAGE_VERSION, migrations = MIGRATIONS } = {}) {
  let data = clone(raw);
  let v = data.version;
  if (!Number.isInteger(v) || v < 1) throw new Error('Blob has no valid version');
  if (v > version) throw new Error(`Blob version ${v} is newer than supported version ${version}`);
  while (v < version) {
    const step = migrations[v];
    if (step) data = step(data);
    v++;
    data.version = v;
  }
  const merged = mergeAdditive(defaultData(), data);
  merged.version = version;
  return merged;
}

function summarise(blob, exportedAt = null) {
  return {
    exportedAt,
    version: blob.version,
    mainCards: Object.keys(blob.srs?.decks?.main?.cards || {}).length,
    scriptCards: Object.keys(blob.srs?.decks?.script?.cards || {}).length,
    lessons: Object.keys(blob.progress?.lessons || {}).length,
    flags: (blob.flags || []).length,
  };
}

const MESSAGES = {
  corrupt: "Your saved data couldn't be read (it isn't valid JSON). It has not been changed.",
  'bad-shape': "Your saved data doesn't have the expected structure. It has not been changed.",
  'migration-failed': 'Upgrading your saved data failed. It has not been changed.',
  'newer-version': 'Your saved progress was written by a newer version of the app. Update the app (reload) before continuing. Nothing has been changed.',
  unavailable: 'This browser is not letting the app use local storage, so progress cannot be saved.',
};

// ---------------------------------------------------------------- the store

/**
 * @param {{ backend?: () => Storage, now?: () => number, version?: number, migrations?: typeof MIGRATIONS }} [opts]
 */
export function createStore({
  backend = () => globalThis.localStorage,
  now = () => Date.now(),
  // Overridable so tests can simulate a future version of the code.
  version: codeVersion = STORAGE_VERSION,
  migrations = MIGRATIONS,
} = {}) {
  /** null until first load, then { mode:'ok', data } or { mode:'recovery', reason, message, raw, savedAs } */
  let state = null;
  let quotaFull = false;
  let firstRun = false;
  const listeners = new Set();

  const notify = () => listeners.forEach((fn) => fn(status()));
  const ls = () => backend();

  function status() {
    return {
      mode: state?.mode ?? 'unloaded',
      reason: state?.reason ?? null,
      message: state?.message ?? null,
      quotaFull,
      firstRun,
    };
  }

  // ------------------------------------------------------------ snapshots

  function readSnapshots() {
    let raw;
    try {
      raw = ls().getItem(SNAPSHOTS_KEY);
    } catch {
      return [];
    }
    if (raw == null) return [];
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
      throw new Error('snapshots is not an array');
    } catch (e) {
      console.error('Snapshots could not be parsed; keeping a copy before replacing them.', e);
      saveRecoveryCopy(raw);
      return [];
    }
  }

  /** Writes the list; on quota errors drops the oldest entry and retries. */
  function writeSnapshots(list) {
    let current = list.slice();
    for (;;) {
      try {
        ls().setItem(SNAPSHOTS_KEY, JSON.stringify(current));
        return true;
      } catch (e) {
        if (!isQuotaError(e)) {
          console.error('Failed to write snapshots.', e);
          return false;
        }
        if (current.length === 0) return false;
        current = current.slice(1);
      }
    }
  }

  function trimSnapshots(list) {
    const daily = list.filter((s) => s.kind === 'daily').slice(-DAILY_SNAPSHOTS_KEPT);
    const safety = list.filter((s) => s.kind === 'safety').slice(-SAFETY_SNAPSHOTS_KEPT);
    const keep = new Set([...daily, ...safety]);
    return list.filter((s) => keep.has(s));
  }

  function addSnapshot(data, kind, reason) {
    const at = new Date(now()).toISOString();
    const rollover = data.settings?.dayRolloverHour ?? 4;
    const list = readSnapshots();
    let id = at;
    for (let n = 2; list.some((s) => s.id === id); n++) id = `${at}#${n}`;
    list.push({ id, date: studyDay(now(), rollover), kind, reason, data: clone(data) });
    return writeSnapshots(trimSnapshots(list));
  }

  function maybeDailySnapshot(data) {
    const today = studyDay(now(), data.settings.dayRolloverHour);
    if (readSnapshots().some((s) => s.kind === 'daily' && s.date === today)) return;
    addSnapshot(data, 'daily', 'daily');
  }

  function dropOldestSnapshot() {
    const list = readSnapshots();
    if (list.length === 0) return false;
    // Prefer dropping the oldest daily copy; safety copies go last.
    const idx = list.findIndex((s) => s.kind === 'daily');
    list.splice(idx === -1 ? 0 : idx, 1);
    return writeSnapshots(list);
  }

  // ------------------------------------------------------------ recovery

  /** Copies a raw string to urdu-trainer:recovery:<ts> unless an identical copy exists. Returns the key or null. */
  function saveRecoveryCopy(raw) {
    try {
      const l = ls();
      for (let i = 0; i < l.length; i++) {
        const k = l.key(i);
        if (isRecoveryKey(k) && l.getItem(k) === raw) return k;
      }
      const key = recoveryKey(new Date(now()).toISOString());
      l.setItem(key, raw);
      return key;
    } catch (e) {
      console.error('Could not save a recovery copy of the raw data (the original is untouched).', e);
      return null;
    }
  }

  function enterRecovery(reason, raw, detail) {
    const savedAs = raw != null ? saveRecoveryCopy(raw) : null;
    console.error(`Urdu Trainer storage in recovery mode (${reason}): ${detail || MESSAGES[reason]}`);
    state = { mode: 'recovery', reason, message: MESSAGES[reason], detail: detail || null, raw: raw ?? null, savedAs };
    notify();
  }

  // ------------------------------------------------------------ load / persist

  function load() {
    if (state) return state;
    let raw;
    try {
      raw = ls().getItem(DATA_KEY);
    } catch (e) {
      enterRecovery('unavailable', null, String(e));
      return state;
    }

    if (raw == null) {
      firstRun = true;
      state = { mode: 'ok', data: { ...defaultData(now()), version: codeVersion } };
      writeMain(); // may report quota; never throws for it
      maybeDailySnapshot(state.data);
      return state;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      enterRecovery('corrupt', raw, String(e));
      return state;
    }
    const problem = checkShape(parsed);
    if (problem) {
      enterRecovery('bad-shape', raw, problem);
      return state;
    }
    if (parsed.version > codeVersion) {
      enterRecovery('newer-version', raw, `data is version ${parsed.version}, code supports ${codeVersion}`);
      return state;
    }

    let data;
    try {
      data = migrate(parsed, { version: codeVersion, migrations });
    } catch (e) {
      enterRecovery('migration-failed', raw, String(e));
      return state;
    }
    state = { mode: 'ok', data };
    if (parsed.version < codeVersion) {
      // Keep the pre-migration blob, then write the migrated one.
      addSnapshot(parsed, 'safety', 'pre-migration');
      writeMain();
    }
    maybeDailySnapshot(data);
    return state;
  }

  function requireOk() {
    const s = load();
    if (s.mode !== 'ok') {
      throw new StorageReadOnlyError(`Storage is in recovery mode (${s.reason}); refusing to read or write app data.`);
    }
    return s;
  }

  /** Writes state.data to the main key. Returns true on success, false if storage is full. Never deletes the main key. */
  function writeMain() {
    const json = JSON.stringify(state.data);
    const tryWrite = () => {
      ls().setItem(DATA_KEY, json);
    };
    try {
      tryWrite();
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      // Storage full: free space by dropping the oldest snapshot (never the main key), retry once.
      dropOldestSnapshot();
      try {
        tryWrite();
      } catch (e2) {
        if (!isQuotaError(e2)) throw e2;
        console.error('Storage is full: progress is held in memory only. Export a backup now.', e2);
        if (!quotaFull) {
          quotaFull = true;
          notify();
        }
        return false;
      }
    }
    if (quotaFull) {
      quotaFull = false;
      notify();
    }
    return true;
  }

  // ------------------------------------------------------------ public API

  const api = {
    /** Live app data. Throws StorageReadOnlyError in recovery mode. */
    get data() {
      return requireOk().data;
    },

    /** Loads (if needed) and reports { mode:'ok'|'recovery', reason, message, quotaFull, firstRun }. */
    status() {
      load();
      return status();
    },
    onStatusChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Persist the current in-memory data. Returns false if storage is full (data is kept in memory). */
    save() {
      requireOk();
      return writeMain();
    },

    getSettings() {
      return api.data.settings;
    },
    updateSettings(patch) {
      const data = api.data;
      data.settings = { ...data.settings, ...patch };
      return writeMain();
    },
    addFlag(flag) {
      api.data.flags.push(flag);
      return writeMain();
    },
    touchOpened(build) {
      const data = api.data;
      data.meta.lastOpenedAt = new Date(now()).toISOString();
      if (build) data.meta.lastSeenBuild = build;
      return writeMain();
    },

    // --- Backup ---------------------------------------------------------

    exportBackup() {
      const { data } = requireOk();
      const exportedAt = new Date(now()).toISOString();
      data.meta.lastExportAt = exportedAt;
      writeMain(); // if storage is full this returns false, but the export must still work
      return JSON.stringify({ format: BACKUP_FORMAT, exportedAt, version: data.version, data }, null, 2);
    },
    shouldPromptBackup() {
      const { data } = requireOk();
      const last = data.meta.lastExportAt || data.meta.createdAt;
      if (!last) return false;
      return now() - new Date(last).getTime() > BACKUP_REMINDER_DAYS * 86400000;
    },

    /**
     * Step 1 of import: parse, check, migrate, summarise. Touches nothing.
     * Throws ImportError with a user-readable message.
     * @returns {{ blob: any, summary: ReturnType<typeof summarise> }}
     */
    previewImport(json) {
      let obj;
      try {
        obj = JSON.parse(json);
      } catch {
        throw new ImportError("That file isn't valid JSON.");
      }
      let inner;
      let exportedAt = null;
      if (isPlainObject(obj) && obj.format === BACKUP_FORMAT && isPlainObject(obj.data)) {
        inner = obj.data;
        exportedAt = obj.exportedAt ?? null;
      } else if (isPlainObject(obj) && isPlainObject(obj.srs) && isPlainObject(obj.progress)) {
        inner = obj; // a bare blob (e.g. a snapshot copied by hand)
      } else {
        throw new ImportError("That file doesn't look like an Urdu Trainer backup.");
      }
      const problem = checkShape(inner);
      if (problem) throw new ImportError(`That backup is damaged: ${problem}.`);
      if (inner.version > codeVersion) {
        throw new ImportError('That backup was made by a newer version of the app. Update the app first, then import it.');
      }
      let blob;
      try {
        blob = migrate(inner, { version: codeVersion, migrations });
      } catch (e) {
        throw new ImportError(`That backup could not be upgraded: ${e.message}`);
      }
      return { blob, summary: summarise(blob, exportedAt) };
    },
    /** Step 2 of import (after the user confirmed): snapshot current data, then replace it. Also the way out of recovery mode. */
    applyImport(preview) {
      replaceData(preview.blob, 'pre-import');
      return api.data;
    },

    // --- Snapshots ------------------------------------------------------

    /** Newest first. Works in recovery mode too. */
    listSnapshots() {
      load();
      return readSnapshots()
        .map(({ id, date, kind, reason }) => ({ id, date, kind, reason }))
        .reverse();
    },
    restoreSnapshot(id) {
      load();
      const found = readSnapshots().find((s) => s.id === id);
      if (!found) throw new Error(`No snapshot found with id ${id}`);
      const blob = migrate(found.data, { version: codeVersion, migrations });
      replaceData(blob, 'pre-restore');
      return api.data;
    },

    // --- Recovery -------------------------------------------------------

    /** Details for the recovery screen, or null when storage is healthy. */
    recoveryInfo() {
      const s = load();
      if (s.mode !== 'recovery') return null;
      return { reason: s.reason, message: s.message, detail: s.detail, raw: s.raw, savedAs: s.savedAs };
    },

    // --- Erase ----------------------------------------------------------

    /**
     * "Erase all progress": removes ONLY keys carrying our prefix (data,
     * snapshots, recovery copies). Foreign keys (e.g. the German app's) are
     * never touched. Returns the removed keys. Callers must confirm twice first.
     * keepRecovery: leave the urdu-trainer:recovery:* raw copies in place (the
     * recovery screen uses this so "start fresh" never destroys the old data).
     */
    eraseAll({ keepRecovery = false } = {}) {
      const l = ls();
      const ours = [];
      for (let i = 0; i < l.length; i++) {
        const k = l.key(i);
        if (isOwnKey(k) && !(keepRecovery && isRecoveryKey(k))) ours.push(k);
      }
      ours.forEach((k) => l.removeItem(k));
      state = null;
      quotaFull = false;
      firstRun = false;
      notify();
      return ours;
    },
  };

  /** Replace the live data with `blob` (already migrated). Snapshots the current data first when there is any. */
  function replaceData(blob, reason) {
    const s = load();
    const previous = s.mode === 'ok' ? s.data : null;
    if (previous) addSnapshot(previous, 'safety', reason);
    state = { mode: 'ok', data: clone(blob) };
    let ok;
    try {
      ok = writeMain();
    } catch (e) {
      state = s;
      throw e;
    }
    if (!ok) {
      // Couldn't store it. Put the old in-memory state back so nothing is half-applied.
      state = s;
      throw new ImportError('Not enough storage space to import this backup. Nothing was changed.');
    }
    notify();
  }

  return api;
}

export const store = createStore();
