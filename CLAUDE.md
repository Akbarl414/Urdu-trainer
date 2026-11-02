# CLAUDE.md

Project guidance for Urdu Trainer. Read BRIEF.md (§3 non-negotiables) and PLAN.md first; if they disagree, PLAN.md wins (it holds the later decisions). The German app in `reference/deutsch-trainer/` is read-only reference: never modify it, never import from it.

## User progress data is sacred

All on-device progress lives in `localStorage`, managed only by `src/db/storage.js`. It is a personal-use app with no server backup, so a data-loss bug is permanent for the user. **No change may reset, wipe, or silently break compatibility with data already on a device.**

- **Changing the stored shape** (anything under `defaultData()`): bump `STORAGE_VERSION`, add a `MIGRATIONS[n]` entry (keyed by the version it upgrades *from*; never remove or renumber entries), and add `tests/fixtures/storage-v<N>.json` for the *old* shape if one doesn't exist yet. The fixture test loads every fixture through `migrate()` and asserts no card, lesson record, flag or setting is lost. Never edit an existing fixture: if a migration deliberately changes a value, change the assertion for that version instead.
- The additive merge in `migrate()` is a safety net for missing fields, not a substitute for a real migration when a value's meaning or shape changes.
- **Fail loud, never wipe.** If stored data won't parse, has the wrong shape, fails to migrate, or was written by a *newer* version of the app, `storage.js` copies the raw string to a `urdu-trainer:recovery:<timestamp>` key, blocks all writes, and the app shows the recovery screen (`src/ui/recovery.js`). Nothing may write defaults over the main key automatically. Never "fix" a load error by catching it and starting empty.
- Data from a newer version is never migrated down and never written to.
- Quota errors: drop the oldest *snapshot*, retry once, then keep the state in memory and show the banner. The main key is never deleted to make room.
- Import: parse → check → migrate → preview → snapshot current data → write. Never write before the user has confirmed.
- "Erase all progress" and the recovery screen's "Start fresh" are explicit, user-confirmed actions. Don't change `eraseAll()` or those screens' behaviour without being explicitly asked.
- `src/db/` and `content/` are stable contracts. `src/ui/` and `src/modules/` can be redesigned freely.

## Shared origin: namespace everything

`localStorage` and the Cache API are shared per **origin**, not per repo. The German app is hosted on the same `<username>.github.io`.

- Every `localStorage` key starts with `urdu-trainer:`. Key names are built **only** in `src/db/keys.js`.
- `localStorage.clear()` is banned everywhere. Only `src/db/storage.js` may touch `localStorage`. "Erase" removes only keys that start with the prefix.
- Service-worker caches are named `urdu-trainer-…`. The worker deletes only `urdu-trainer-static-*` caches that are not the current build, never anything else; it never uses the global `caches.match()` (always `caches.open(ours)` then `.match`); it only answers requests inside its own scope. `caches.delete(` may appear only in `src/sw/sw.js`.
- Never read, write or delete a key/cache this app didn't create. Never reference the German app's keys.
- `tests/banned-apis.test.js` greps for all of the above and fails the build. Don't weaken it.

## Romanization

One scheme everywhere, defined in `content/ROMANIZATION.md` and enforced by `src/lang/romanization.js` through `npm run validate`. Capitals are phonetic only (`T D R N Gh`); never capitalise a sentence start or a name; `N` only marks a word-final nasal vowel (plain `n` elsewhere); English loanwords keep lowercase English spelling and carry `"loanword": true`. `src/lang/devanagari.js` (spoken-audio fallback for devices with no Urdu voice, PLAN D13) is derived from the same scheme and tested on all 60 worked examples, so a scheme change must update it too. If the scheme must change, change the doc first, then the validator, the tests and all content in one pass. Urdu-script fields use Urdu code points (`ی ک ہ ھ`), never the Arabic look-alikes (`ي ك ه`). Every Urdu text is stored as `roman` + `ur` + `en`; never roman alone. Urdu inside prose (grammar bodies, notes, explanations) goes in `` `backticks` `` so the validator can check it.

## Content

- Content ids never change once shipped (lessons, words, exercises, game items, units). Add new ids; retire old content with `"retired": true`, never delete. `content/shipped-ids.json` locks shipped ids and `npm run validate` fails if one disappears. **Before merging content to `main`, run `npm run lock-ids` and commit the result**: the deploy workflow runs `npm run lock-ids -- --check` and fails if any id is unlocked.
- Urdu accuracy matters more than volume: at most one unit (≈10 lessons, ≤80 items) per generation pass; validate and hand-check genders, plurals, obliques, perfectives and `takes_ne` before continuing.
- Lesson ids are global (`lesson-001`…`lesson-180`) and `order` equals the number in the id.

## Commands

`npm run dev` · `validate` · `lock-ids` · `test` (Node's built-in runner, `tests/*.test.js`) · `build` (validates first) · `preview`. A phase is done when `validate`, `test` and `build` all pass, there is no horizontal scroll at phone width, no change touches stored data without a migration, and uncertainties are reported.

## Layout rules

Core folders (`src/db`, `srs`, `lesson`, `lang`, `audio`, `script`) never import from `src/modules` or `src/ui`; keep core logic pure so Node can test it. The service worker source is `src/sw/sw.js`, a template that `vite.config.js` fills in (build id + precache list) and emits as `dist/sw.js`. Updating the app must never touch storage.
