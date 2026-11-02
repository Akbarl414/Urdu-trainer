# Urdu Trainer — Technical Plan

Phase 0 output. Covers architecture, module layout, storage shape, the SRS facet design, the lesson-player state machine, and game design. Product requirements live in [BRIEF.md](./BRIEF.md); the course outline is in [content/CURRICULUM.md](./content/CURRICULUM.md); the spelling rules are in [content/ROMANIZATION.md](./content/ROMANIZATION.md).

Every Phase 0 question has been settled. §12 is the decision log; change a decision there before changing the code that depends on it.

---

## 1. What carries over from Deutsch Trainer, and what changes

**Kept (same patterns, rewritten for this app):**
- Static Vite + vanilla JS ES modules, hash router, lazy-loaded screens.
- Content as schema-validated JSON (draft-07, Ajv), auto-discovered with `import.meta.glob`, `id` matches filename, `npm run validate` runs before `build`.
- One versioned storage blob with `STORAGE_VERSION`, `MIGRATIONS` keyed by the version they upgrade *from*, then an additive merge with defaults.
- Rolling daily snapshots stored under a separate key.
- Export/import backup as a single JSON file.
- The trailing `(...)` hint convention (`resolveHint`), and the hint capping the grade at Hard.
- A reorder checker that accepts several orders (`answerOrders`).
- The GitHub Actions Pages deploy and relative `base: './'`.

**Problems in the reference that this app fixes:**

| Reference behaviour | Risk | Urdu Trainer |
|---|---|---|
| `load()` falls back to `defaultData()` when JSON parsing fails, and the next `persist()` writes those defaults over the real data | **Silent wipe** | Recovery mode: the raw string is copied to a recovery key, writes are blocked, and the user sees a screen with download and restore options (§3.4) |
| `sw.js` activate deletes **every** cache whose name isn't its own | On a shared origin, each German app update deletes the Urdu app's caches, and the Urdu app would do the same to the German app's | Cleanup only deletes caches that start with `urdu-trainer-` (§9). The German app gets its own fix in a separate session in its repo (§12, D1) |
| Keys `german-app-data-v1`, `german-app-snapshots-v1` have no app prefix | Collision-prone | Every key starts with `urdu-trainer:` |
| Day boundaries use `toISOString()` (UTC) | Streaks and "today" are off by an hour in BST | Local day with a configurable rollover at 04:00 |
| SM-2 hand-rolled | — | `ts-fsrs` |
| Packs are activated and triaged by hand | — | Items join the deck automatically when their lesson is completed |
| A renamed id silently orphans cards | — | The validator checks a committed lockfile of shipped ids (§4.5) |

---

## 2. Module layout

```
index.html
vite.config.js                 # base './', plugin that writes the SW precache list + BUILD_ID
public/
  manifest.webmanifest         # scope "./", start_url "./"
  icons/
  fonts/                       # self-hosted Noto Nastaliq Urdu woff2 (D5)
  audio/                       # optional pre-generated audio files, referenced by `audio` fields (D2)
src/
  main.js                      # boot: storage load → recovery gate → router → SW registration
  router.js                    # hash router (as in the reference)
  db/                          # ── STABLE CONTRACT ──
    storage.js                 # prefixed keys, STORAGE_VERSION, MIGRATIONS, migrate(), export/import, erase
    keys.js                    # PREFIX = 'urdu-trainer:'; the only place that builds key names
    contentLoader.js           # import.meta.glob discovery, indexes, user-content merge
    day.js                     # local "study day" helpers (04:00 rollover)
  srs/
    fsrs.js                    # ts-fsrs wrapper + compact card adapter (the only ts-fsrs import)
    facets.js                  # facet table, unlock rules, card-id build/parse
    deck.js                    # syncDeck(): create the cards completed lessons call for (idempotent)
    queue.js                   # due selection, daily cap, priority, sibling spacing
  lesson/
    planner.js                 # time budget → LessonPlan (pure, tested)
    machine.js                 # lesson-run state machine (pure reducer, tested)
    commit.js                  # completion: one atomic write that adds items to the deck
  lang/
    romanization.js            # scheme rules shared by the validator and the app
    normalise.js               # lenient/exact answer matching + diff for highlighting
    tokenise.js                # shared by the coverage checker and games
  audio/
    tts.js                     # Urdu voice detection, speak(ur), prefer `audio` file
    recorder.js                # MediaRecorder record & compare (memory only)
  modules/                     # ── FREE TO REDESIGN ──
    today/  lesson/  review/  games/  library/  settings/
    debug/voices.js            # #/debug/voices: lists speechSynthesis voices on this device (Phase 1, D2)
    exercises/                 # one renderer per exercise type
  ui/                          # ── FREE TO REDESIGN ──
    components/ (tabbar, button, card, urduText, audioButton, banner, ...)
    styles/ (tokens.css, base.css, ...)
content/                       # ── STABLE CONTRACT ──
  ROMANIZATION.md  CURRICULUM.md  shipped-ids.json
  schemas/ unit.schema.json, vocab.schema.json, lesson.schema.json, exercise.schema.json
  units/unit-01/ unit.json, vocab.json, lesson-001.json … lesson-010.json
scripts/
  validate-content.js          # schemas + cross-file rules + romanization + id lockfile
  check-coverage.js            # warning-only token coverage per lesson
  lock-ids.js                  # appends newly shipped ids to content/shipped-ids.json
tests/
  fixtures/storage-v1.json     # one snapshot per STORAGE_VERSION, never edited once added
  *.test.js                    # node --test
```

Rule for imports: `modules/` and `ui/` may import from `db/`, `srs/`, `lesson/`, `lang/`, `audio/`. Nothing in those core folders imports from `modules/` or `ui/`. Core logic is pure where possible, so Node can test it without a DOM.

---

## 3. Storage

### 3.1 Keys (all go through `keys.js`)

| Key | Contents |
|---|---|
| `urdu-trainer:data` | The main blob (below) |
| `urdu-trainer:snapshots` | Up to 3 rolling daily copies of the blob (D15) |
| `urdu-trainer:recovery:<ISO timestamp>` | Raw unparseable data, written only when a load fails |

`localStorage.clear()` is banned. The validator/test suite greps `src/` for `localStorage.clear`, `caches.delete(` outside `sw.js`, and raw key strings outside `keys.js`, and fails if it finds any. "Erase all progress" iterates over `localStorage` keys and removes only those that start with `urdu-trainer:`. A test seeds foreign keys such as `german-app-data-v1` and asserts that they survive.

### 3.2 Blob shape (v1)

```js
{
  version: 1,
  meta: { createdAt, lastExportAt, lastOpenedAt, lastSeenBuild },
  settings: {
    showScript: false, audio: true, speechRate: 0.9, voiceURI: null,
    dailyReviewCap: 60, theme: 'system', dayRolloverHour: 4,
    noVoiceNoteSeen: false
  },
  progress: {
    lessons: {                       // lessonId -> record
      'lesson-001': { firstCompletedAt, lastCompletedAt, timesCompleted, knownWordIds: [] }
    },
    run: null                        // the lesson in progress (see §6), or null
  },
  srs: {
    cards: { '<cardId>': CompactCard }
  },
  stats: {
    streak, bestStreak, lastStudyDay,               // 'YYYY-MM-DD' in study-day terms
    days: { 'YYYY-MM-DD': { reviews, newWords, lessons, games, seconds } },
    pace: { reviewSec: 10, wordSec: 20, exerciseSec: 20 },  // moving averages for the planner
    gameBests: {}
  },
  flags: [ { id, createdAt, target: { kind, id, field }, note, build } ],  // "Report a mistake"
  userContent: { words: [] }        // reserved (D9); included in export
}
```

**CompactCard** (`srs/fsrs.js` is the only module that knows how this maps to ts-fsrs's `Card`):
`{ due, s, d, st, r, l, lr, sd, ls, weak? }` stores due (epoch ms), stability, difficulty, state (0 New, 1 Learning, 2 Review, 3 Relearning), reps, lapses, last review (ms), scheduled days, learning step, and an optional game "weak" timestamp. Short keys matter here. A full deck holds about 7,000 cards, roughly 0.6 MB compact versus about 1.8 MB verbose, and localStorage is capped at about 5 MB per origin, **which is shared with the German app**.

### 3.3 Migrations
These work as in the reference: `MIGRATIONS[n]` upgrades n → n+1, entries are never removed or renumbered, and the additive merge runs afterwards. Additions:
- `tests/fixtures/storage-v<N>.json` is added at every version bump. A test loads every fixture, runs it through `migrate()`, and asserts that no card, lesson record, flag, or setting is lost.
- A blob whose `version` is *newer* than the code (for example, an old cached build opening data written by a newer one) is never migrated down and never written to. The app enters recovery mode with the message "Update the app".

### 3.4 Failure handling (fail loud, never wipe)
1. A `JSON.parse` failure or an invalid shape triggers these steps: write the raw string to `urdu-trainer:recovery:<ts>`, set `readOnly = true`, `console.error`, and show a blocking recovery screen with **Download raw data**, **Restore snapshot (date)**, and **Import backup**. No path writes defaults over the main key automatically.
2. `QuotaExceededError` on save: drop the oldest *snapshot* and retry once. If that still fails, show a persistent banner ("Storage full — export a backup") and keep the in-memory state. The main key is never deleted.
3. Import runs parse → shape check → `migrate()` → preview ("Backup from 3 Nov: 412 cards, 14 lessons. Replace current progress?") → snapshot of the current data → write.

### 3.5 Study day
`day.js` treats `today` as the local date of `now − rolloverHour`. A review at 01:00 counts toward the previous day, which matches Anki and is friendlier to late-night study. Streaks, daily caps, and "one lesson per day" all use it.

---

## 4. Content model (beyond §7 of the brief)

### 4.1 Files and ids
- `content/units/unit-NN/unit.json`: `{ id: "unit-01", order, title, cefr, can_do: [] }`.
- `vocab.json`: `{ id: "vocab-unit-01", unit, words: [...] }`. Phrases go here as `pos: "phrase"`.
- `lesson-NNN.json`: lesson ids are **global** (`lesson-001` … `lesson-180`), so each lesson has one stable name for card ids and unlocks.
- Word ids: lowercase kebab-case of the roman, so `laRkaa` becomes `larkaa`. Because lowercasing collides (`Dar` fear / `dar` door, `aam` mango / common), a collision gets a meaning suffix: `dar-fear`, `dar-door`. Phrase ids are kebab-case of the phrase: `kyaa-haal-hai`.
- English loanwords keep English spelling in lowercase (`phone`, `bus`, `tv`, `doctor`) and carry `"loanword": true`. Their `roman` and `forms` are exempt from the scheme rules (ROMANIZATION.md §5).
- Exercise ids are unique within a lesson (`e01`…). The card id includes the lesson id.

### 4.2 Fields added to the brief's content model (D11)
- `unlocks: string[]` lists grammar features this lesson switches on (`gender`, `perfective`, `ne`, …). Facet unlocking keys off these features, not off hard-coded lesson numbers.
- `review: true` marks the unit's review lesson.
- `exercises[].tags: string[]` (e.g. `agreement`, `ne`, `oblique`) lets games pick authored items.
- `game_items` (optional, from Unit 11 on) holds authored sentences for "Ne or no ne?". See §8.
- Every exercise stores its Urdu as triples. For example, `fill-blank` stores `sentence: { roman: "maiN ___ huuN", ur: "میں ___ ہوں", en: "I am fine." }` plus `answer`/`answer_ur`/`altAnswers`. `reorder` has `tokens` (roman), `answerOrders`, and `sentence` (the canonical triple). `translate` has `en`, `answers: [{roman, ur}]`, `self_grade: true` allowed. `transform` has `from` triple, `instruction`, `answers`. `listen` has `audio_text` triple and `options`, `answerIndex`.
- **Every `{roman, ur, en}` triple** (words, examples, exercise sentences, dialogue lines) may carry an optional `audio` path. That way pre-generated audio can be added later for any piece of Urdu without a schema change (D2).
- Words: optional `loanword: true` (D3).

### 4.3 Validator rules (beyond schemas)
- Every `roman` and `answers[].roman` field passes `lang/romanization.js` (character set, the capital rule, `c` only in `ch`/`cch`, `N` only word-final after a vowel, no `v`, no `ee`/`oo`; see ROMANIZATION.md §6).
- Loanword exemption: tokens that match the `roman` or `forms` of a `loanword: true` word introduced in this or an earlier lesson only need to be lowercase (a final `N` from an Urdu ending is allowed). Any other token is checked normally.
- Every `roman` has a non-empty sibling `ur` (Arabic-script range check) and `en`.
- Nouns require `gender` and `marked`; marked nouns require `plural` and `oblique_pl`. Verbs require `infinitive`, `stem`, `transitivity`, `takes_ne`, and `perfective.{m_sg,f_sg,m_pl}`.
- Ids are unique across the whole app (words, lessons, units). `new_vocab` ids exist and their `introduced_in` equals the lesson. Each word is introduced exactly once.
- Lessons have 6–10 new words (0–4 for review lessons) and 8–12 exercises. Units hold ≤ 80 words.
- `reorder`: every `answerOrders` entry is a permutation of `tokens`.
- `fill-blank` requires `sentence.en`. `multiple-choice`/`choose-form` options must not contain `(` (the reference's rule that annotated options give the answer away).
- **Id lockfile**: every id in `content/shipped-ids.json` must still exist (it may be `retired: true`). `npm run lock-ids` appends new ids, and Phase 1 adds it to the deploy workflow before build, so anything that reaches `main` gets locked.

### 4.4 Coverage checker
`check-coverage` tokenises every roman field in each lesson (after stripping punctuation and `___`), then subtracts the following sets: words and their `forms` introduced in this or earlier lessons, an allowlist (`content/coverage-allowlist.json`: `hai, haiN, huuN, ho, kaa, kii, ke, meN, nahiiN, jii, …` added as each is taught), and names (`speaker` values and an explicit `names` list). It prints leftovers per lesson. It never fails.

### 4.5 Retiring content
`retired: true` on a word or exercise keeps its id and SRS card. Such items stop appearing in new sessions and games, but the library still shows them as "retired", and backups still contain them.

---

## 5. SRS design

### 5.1 Card ids
- `w:<wordId>:<facet>` for words and phrases (word ids are globally unique).
- `x:<lessonId>:<exerciseId>` for exercises (one card each).
- `facets.js` builds and parses these. The format never changes; if it ever has to, a migration rewrites the keys.

### 5.2 Facets

| pos | Facets | Unlocked by feature |
|---|---|---|
| noun | `meaning_ur_en`, `meaning_en_ur`, `gender` | `gender` → lesson 11 |
| verb | `meaning_ur_en`, `meaning_en_ur`, `perfective`, `takes_ne` | `perfective` → lesson 101; `ne` → lesson 116 (after exceptions are taught) |
| adjective | `meaning_ur_en`, `meaning_en_ur` | — |
| adverb, pronoun, postposition, other | `meaning_ur_en`, `meaning_en_ur` (D17) | — |
| phrase | `meaning_ur_en`, `situation_to_phrase` | — |
| exercise | `default` | — |

`deck.syncDeck(now)` is idempotent. It walks the completed lessons and unlocked features and creates any missing card. When `perfective` unlocks, every verb already learned gets its `perfective` card the same day. Existing cards are never touched. It runs at lesson commit and once at boot, which catches content added in a new build.

### 5.3 Scheduling (ts-fsrs, pinned to the current major version)
- Two scheduler instances (D16): **production** facets (`meaning_en_ur`, `situation_to_phrase`) use `request_retention: 0.90`; **recognition** and form facets use `0.85`. Production items therefore come back more often, which reflects the goal of speaking. Fuzz is enabled so lessons don't create review clumps.
- Buttons show `scheduler.repeat(card, now)[rating].card.due`, formatted like `10m · 1d · 3d · 9d`.
- **Lesson items on commit**: a new word's cards start New and get one rating from what happened in the lesson (practised correctly → Good, missed → Again). They first come back later the same day or the next day. **"I already know this"** cards get Easy applied twice, about 1 minute apart internally. That gives a first interval of roughly 1–3 weeks, and the facets keep their own memory state.
- **Exercise cards** get their rating from the lesson attempt (correct → Good, hint → Hard, wrong → Again).

### 5.4 Daily queue (`queue.js`)
1. Candidates: all non-retired cards with `due ≤ end of study day`, excluding the New state (every card is born from a lesson, so the deck has no "new card" stream).
2. Priority: Learning/Relearning cards first. Then sort by lowest current retrievability, multiplied by 1.25 for production facets and by 1.2 for weak-flagged cards.
3. **Cap**: take at most `dailyReviewCap − reviewsDoneToday`. The rest stays due. Because the most-forgotten cards go first and FSRS reschedules from the actual review date, a backlog drains over several days instead of arriving in one session. Today shows an honest line: "182 due · about 3 days to catch up at 60/day".
4. **Sibling spacing**: no two adjacent cards share an item key (word id or lesson id). The queue greedily interleaves. If spacing is impossible in a short session, the later sibling moves to the end.

### 5.5 Answer checking (`lang/normalise.js`)
- `exact(a, b)`: trim, collapse whitespace, strip punctuation; then compare byte for byte (case matters because `T ≠ t`).
- `lenientKey(s)` is applied to **both** sides. It lowercases (folding T/D/R/N/Gh), drops a nasal `n` that ends a word after a vowel (so `huuN`, `hun`, and `hu` match), collapses `aa→a`, `ii→i`, `uu→u`, collapses doubled consonants (`pakkaa ~ pakaa`), treats a hyphen as a space, and maps `ee→i`, `oo→u`, `v→w`, `mein→me`, `hain→hai` (D4: accepts the common phone spellings `theek`, `hoon`, `mein`, `vo`). Loanwords are matched case-insensitively, ignoring punctuation.
- A lenient-but-not-exact answer is marked correct, and the screen shows the exact form with a character diff. Typed answers compare against every listed answer and pick the closest one.
- `translate` and other free-word-order answers: if the typed answer matches any listed answer, it is marked correct. Otherwise the app shows the model answers and asks "Did you get it?" (✓ / ✗).
- `normalise.test.js` covers every row of the romanization table and a list of near misses that must **not** pass (`laRkaa` vs `laRkii`, `gayaa` vs `gaye`, `kaa` vs `kii`). Gender and agreement endings are what the lenient match must never blur. Vowel-length collapse could merge `kaa` and `ka`, but no *wrong ending* collapses into a right one, since `aa/ii/e` stay distinct after folding.

### 5.6 Games → SRS
A wrong answer in a game sets `card.weak = now`. If the card is in Review state with `due` more than 1 day away, `due` moves to tomorrow. Games never call `scheduler.repeat` and never push `due` later. The next real review clears `weak`.

---

## 6. Lesson player

### 6.1 Planner (`lesson/planner.js`, pure)
Input: lesson, due queue, `pace` averages, today's counts. Output: a `LessonPlan`.

```
budget        = 900 s
fixed         = grammarScreens*30 + newWords*wordSec + dialogueLines*12 + 30 (summary)
practiceCount = clamp(lesson.exercises.length, 8, 12)
warmupSlots   = floor((budget - fixed - practiceCount*exerciseSec) / reviewSec)
if warmupSlots < 0: practiceCount = max(8, practiceCount + floor(warmupSlots*reviewSec/exerciseSec)); warmupSlots = 0
warmup        = queue.take(min(warmupSlots, capRemaining))
```
Mode (D7):
- **normal**: the plan above.
- **review-heavy**: chosen when `due > 2 × warmupSlots`. Warm-up rises to about 8 minutes and practice drops to 8 items. The lesson still happens.
- **catch-up day**: chosen when `due > dailyReviewCap × 2`. Today offers "15-minute review session" as the big button, with a secondary "Do lesson N anyway". The user never has to make the call: the default is chosen for them, and they can still override it.

`pace` updates after every item (exponential moving average), so after a week the estimates match this learner's speed.

### 6.2 State machine (`lesson/machine.js`)

```
          ┌──────────── resume (run in storage) ─────────────┐
IDLE ─start─► WARMUP ─► GRAMMAR ─► WORDS ─► PRACTICE ─► DIALOGUE ─► SUMMARY ─commit─► DONE
              (skip if   (screen i) (word i: (ex i)      (line i:
               none due)            intro →              listen → reveal
                                    known? →              → say aloud
                                    check)                [→ record])
```
- The run state is `{ lessonId, studyDay, plan, step, index, warmupDone[], knownWordIds[], wordResults{}, exerciseResults{}, startedAt }`, stored in `progress.run` after **every** transition. Closing the app mid-lesson shows "Continue" on Today.
- Warm-up reviews are real reviews and get written as each one is graded. Everything else is buffered in `run` until commit.
- **WORDS** per word: show it in a context sentence with audio, then **I already know this** (marked known; skips the check) or **New to me** (a quick recognition check, then production).
- **Commit** (`lesson/commit.js`) is one `persist()`. It marks the lesson complete, runs `syncDeck` with the run's results (§5.3), updates stats, and clears `run`. A crash before commit loses nothing already graded, and a crash during commit is impossible to half-apply because it's one `setItem`.
- If a run is resumed on a later study day, the remaining warm-up is rebuilt from the current queue, and the rest continues where it stopped.
- Redoing a completed lesson from the Library uses the same player with `practiceOnly: true`. Existing cards are not reset; exercise results there act like game results (§5.6).
- An extra lesson the same day is allowed after a one-line note ("Each lesson adds about 30 reviews over the next week").

### 6.3 Unlock order
Lessons unlock strictly in curriculum order: lesson N+1 opens when lesson N has been completed once. Features unlock when their lesson is completed. The Grammar library lists the grammar of completed lessons.

---

## 7. Screens (UI is free to change; listed for the build order)
- **Tab bar**: Today · Review · Games · Learn · Settings.
- **Today**: big start/continue button, the progress line `Lesson 7 · Unit 1 · 23 due · 🔥 4`, and the catch-up line when relevant.
- **Review**: one card per screen, a prompt adapted to the facet, a typed or self-graded answer, and four grade buttons with intervals.
- **Learn**: Grammar library (sections and practice) and Word list (search, filters for unit, pos, and weak; word card with forms, example, audio, and Report a mistake).
- **Settings**: per §5.6 of the brief.
- **UrduText component**: renders roman (primary) and optionally `ur` below it in Nastaliq (`dir="rtl"`, `lang="ur"`, line-height ≈ 2.2). It is the only way Urdu reaches the screen, so the script toggle works everywhere.

---

## 8. Games

Shared pool (`modules/games/pool.js`): items from completed lessons only, never retired ones. Weight = `(1 − R) × 3 + weak bonus 2 + recent bonus` (recent means introduced in the last 7 study days, bonus 1.5). Sampled without replacement. Games need a minimum pool and show "Unlocks after lesson N" until they have it.

| Game | Pool | Round | Feedback → SRS |
|---|---|---|---|
| **Match pairs** | words and phrases (`meaning_*` cards) | 6 pairs, 45 s timer, tap roman ↔ English; mismatches flash | wrong pair → weak on both items' `meaning_ur_en` |
| **Gender sort** | nouns with `gender` unlocked | 10 nouns, tap/swipe ♂ / ♀; the reveal shows the plural | `gender` facet |
| **Sentence builder** | `reorder` exercises (any `answerOrders` accepted) | 5 sentences, tiles, English shown | that exercise card |
| **Listen & pick** | words and phrases; **hidden without an Urdu voice or `audio` file** | 8 items, hear `ur`, pick from 4 English options | `meaning_ur_en` |
| **Agreement snap** | (a) `choose-form` exercises tagged `agreement`; (b) generated phrases from rule-based fields only: variable adjective + learned noun (`acchaa laRkaa / acchii laRkii / acche laRke` from `gender`, `marked`, `plural`), and after `perfective` unlocks, noun + intransitive perfective (`laRkii gayii`) | 10 items, 3 forms each, fast | exercise card, or the noun's `gender` facet |
| **Ne or no ne?** | unlocks with feature `ne`; authored `game_items` of type `ne` from Units 12+, plus `ne`-tagged exercises | two taps: "needs ne?" then pick the verb form | exercise card / verb's `takes_ne` |

Generated phrases come only from fields the validator has checked. Games never compose free Urdu sentences. Picking from four English meanings uses distractors from the same pos and unit band.

---

## 9. PWA and deploy
- `vite.config.js`: `base: './'`. A small plugin writes `dist/sw.js` with `BUILD_ID` (commit SHA or time) and the list of hashed assets.
- Cache names: `urdu-trainer-static-<BUILD_ID>` and `urdu-trainer-fonts-v1`. Activate deletes only `k.startsWith('urdu-trainer-static-') && k !== current`. The SW is registered as `new URL('sw.js', document.baseURI)` with `scope: './'`, so it controls only `/Urdu-trainer/…` (the German app lives at `/German-Language-App/`, so the scopes don't overlap). It only answers fetches whose path is inside its own scope, and every `caches.match` is called on its own cache (never the global `caches.match`).
- Update flow: the new SW installs and **waits** (no automatic `skipWaiting`). The page sees `registration.waiting` and shows "Update available — Reload". On tap it posts `SKIP_WAITING`, then `controllerchange` triggers a reload. The SW never touches localStorage (it can't anyway) and never deletes non-prefixed caches.
- Until the German app's cleanup is fixed (D1), each German update may delete this app's caches. The app still works online and re-caches on the next load, and progress is unaffected (localStorage is never touched by cache cleanup).
- `navigator.storage.persist()` is requested on first run. If it's refused, Settings shows "Browser may clear data — export backups".
- Deploy: the reference workflow (Node 20 → `npm ci` → `npm run build` → Pages), with `npm test` added before build.

---

## 10. Audio
- **The main device is an iPhone**, which may have no Urdu voice. Phase 1 ships `#/debug/voices`, a small page that lists every `speechSynthesis` voice on the device (name, lang, local/remote, default), highlights `ur*` voices, and has a "speak sample" button per Urdu voice. We confirm what's really there before deciding on pre-generated audio.
- `tts.js` loads voices (handling `voiceschanged` and iOS lazy loading) and filters `voice.lang` to `ur`, `ur-PK`, `ur-IN`. It speaks the **`ur` field** at `speechRate`, and only with an Urdu voice. Without one, `canSpeak()` is false: audio buttons are hidden, listen exercises and the Listen game are skipped, and a one-time note appears in Settings.
- If an item has `audio` (a file path under `public/audio/`), it plays instead of TTS. The SW caches audio on first play (cache-first, prefixed cache).
- `recorder.js` provides record → play back → play model, all in memory (Blob URL revoked on leave), with nothing persisted. It is hidden when `MediaRecorder` or microphone permission is unavailable.

---

## 11. Phase-by-phase test map (brief §10)
- **P1**: storage (migrations over fixtures, prefixing, export/import round trip, corrupt data → recovery with no wipe, erase keeps foreign keys, quota path), validator (bad romanization, word-internal `N`, missing `ur`, missing `perfective`/`takes_ne`, duplicate ids, unknown vocab ids, lockfile, loanword exemption both ways), the banned-API grep. Manual check: open `#/debug/voices` on the iPhone and report the list.
- **P2**: FSRS wiring, facet unlocking, cap, priority, backlog spreading, sibling spacing, already-know path, normaliser.
- **P3**: planner budget and modes, machine transitions and resume, commit adds the right cards exactly once, unlock order.

---

## 12. Decision log (Phase 0)

D1–D4 and the curriculum/romanization changes were decided by you. The rest use my recommendation, as you asked.

| # | Topic | Decision |
|---|---|---|
| D1 | Hosting / German app SW | German app is at `https://akbarl414.github.io/German-Language-App/`, a project site, so SW scopes don't overlap. Its cache-cleanup bug and its progress-wipe-on-parse-error bug will be fixed **in a separate session in the German repo**. The reference copy here is never modified. |
| D2 | Audio on iPhone | Main device is an iPhone. Phase 1 adds the `#/debug/voices` test page (§10) so we confirm the available voices rather than assume. The schema allows an optional `audio` path on every Urdu triple, ready for pre-generated files. |
| D3 | Romanization | All recommendations accepted: `acchaa`/`bacchaa` with `cch`, `chaae`, `ye / wo`, spoken forms (`behen`, `kehnaa`), hyphens allowed, `chhe`, final `-ii` always long. **Changed**: `N` only for word-final nasal vowels; plain `n` everywhere else (`aankh`, `ThanDaa`, `jaaungaa`). **Loanwords** keep English spelling in lowercase (`tv`, `phone`, `doctor`, `bus`), marked `"loanword": true`, and are exempt from scheme rules. See ROMANIZATION.md. |
| D4 | Phone spellings | Accepted as close-enough answers (`theek`, `hoon`, `mein`, `nahin`, `vo`); the exact form is shown with differences highlighted. |
| D5 | Font | Self-host Noto Nastaliq Urdu (OFL) in `public/fonts/`, precached by the SW. |
| D6 | Order | `thaa / thii / the` moved to **Unit 7, lesson 069**. Unit 11 now opens with perfectives (`perfective` unlocks at lesson 101). Chunks before grammar are used, with exercises testing meaning only. |
| D7 | Catch-up day | Backlog above 2× the daily cap → Today defaults to a 15-minute review session, with "Do lesson N anyway" as a secondary button. Review-heavy mode in between (§6.1). |
| D8 | Course size | ≤ 80 items per unit including phrases, ≈ 1,440 in total. Accepted. |
| D9 | User-added words | Storage slot `userContent` reserved and included in export; no UI planned. |
| D10 | Colours | Light: paper `#FAF6EF`, ink `#2A2724`, primary teal `#1F6B66`, accent saffron `#C98A2B`, good `#3C7D4A`, bad `#B4483A`. Dark: warm charcoal `#1C1A18` with muted versions. |
| D11 | Schema additions | `unlocks`, `review`, exercise `tags`, `game_items`, triple-based exercise sentences, optional `audio` on any triple, `loanword` on words (§4.2). |
| D12 | Day rollover | 04:00 local time. |
| D13 | Phrases | In `vocab.json` as `pos: "phrase"`, counted in the unit's 80. |
| D14 | Script toggle and inputs | Inputs stay roman; script is shown read-only under prompts and answers. |
| D15 | Snapshots | 3 rolling daily snapshots in localStorage; on quota pressure the oldest snapshot is dropped first, never the main key. Revisit IndexedDB only if storage gets tight. |
| D16 | Production weighting | Desired retention 0.90 for production facets vs 0.85 for recognition and form facets, plus a 1.25× priority boost. |
| D17 | Minor parts of speech | Adverbs, pronouns, postpositions and `other` get both `meaning_ur_en` and `meaning_en_ur`. |
